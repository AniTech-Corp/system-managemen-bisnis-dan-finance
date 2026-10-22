import { Prisma, type Asset } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { PeriodClosedError, getOrCreatePeriod, isPeriodWritable } from '@/lib/accounting/period';
import {
  buildDepreciationSchedule,
  jakartaYearMonth,
  periodKey,
  type DepreciationMethodKey,
} from './depreciation';
import { postDepreciationInTx } from './posting';

/**
 * Menjalankan penyusutan bulanan untuk seluruh aset aktif sebuah workspace.
 *
 * Aturan:
 *  - Bulan target harus menerima jurnal (periode tidak CLOSED/LOCKED).
 *  - Bulan-bulan yang terlewat (belum punya entri) ikut dibuatkan entri, supaya
 *    nilai buku tidak melompat ketika user baru menjalankan lagi setelah lama
 *    tidak membuka modul. Ini "catch-up" yang eksplisit, bukan diam-diam.
 *  - Metode unit produksi hanya membuat entri untuk bulan target karena
 *    membutuhkan angka produksi aktual per periode.
 *  - Kalau modul akuntansi aktif, setiap entri langsung dijurnal dan ditandai
 *    posted. Kalau belum aktif, entri tetap tersimpan sebagai catatan operasional.
 */

export interface RunDepreciationParams {
  workspaceId: string;
  userId: string;
  year: number;
  month: number;
  /** Unit produksi bulan target per aset (khusus metode unit produksi). */
  unitsByAsset?: Record<string, number>;
  /** Batasi ke aset tertentu (opsional). */
  assetIds?: string[];
}

export interface RunDepreciationResult {
  period: { year: number; month: number };
  createdEntries: number;
  postedJournals: number;
  totalAmount: number;
  skipped: Array<{ assetId: string; assetCode: string; name: string; reason: string }>;
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export async function runDepreciation(
  params: RunDepreciationParams
): Promise<RunDepreciationResult> {
  const { workspaceId, year, month } = params;

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Periode penyusutan tidak valid.');
  }

  const targetDate = new Date(Date.UTC(year, month - 1, 1));
  const targetIndex = year * 12 + month;

  const assets = await prisma.asset.findMany({
    where: {
      workspaceId,
      status: { in: ['ACTIVE', 'UNDER_MAINTENANCE', 'IMPAIRED'] },
      ...(params.assetIds && params.assetIds.length > 0 ? { id: { in: params.assetIds } } : {}),
    },
    orderBy: { assetCode: 'asc' },
  });

  const result: RunDepreciationResult = {
    period: { year, month },
    createdEntries: 0,
    postedJournals: 0,
    totalAmount: 0,
    skipped: [],
  };

  for (const asset of assets) {
    try {
      const summary = await runForAsset(asset, params, targetDate, targetIndex);
      result.createdEntries += summary.created;
      result.postedJournals += summary.posted;
      result.totalAmount = round2(result.totalAmount + summary.amount);
      if (summary.skipReason) {
        result.skipped.push({
          assetId: asset.id,
          assetCode: asset.assetCode,
          name: asset.name,
          reason: summary.skipReason,
        });
      }
    } catch (err) {
      if (err instanceof PeriodClosedError) throw err;
      result.skipped.push({
        assetId: asset.id,
        assetCode: asset.assetCode,
        name: asset.name,
        reason: err instanceof Error ? err.message : 'Gagal menghitung penyusutan.',
      });
    }
  }

  return result;
}

async function runForAsset(
  asset: Asset,
  params: RunDepreciationParams,
  targetDate: Date,
  targetIndex: number
): Promise<{ created: number; posted: number; amount: number; skipReason?: string }> {
  const startDate = asset.depreciationStartDate ?? asset.acquisitionDate;
  const start = jakartaYearMonth(startDate);
  const startIndex = start.year * 12 + start.month;

  if (startIndex > targetIndex) {
    return { created: 0, posted: 0, amount: 0, skipReason: 'Penyusutan belum dimulai pada periode ini.' };
  }

  if (!asset.isDepreciable) {
    return { created: 0, posted: 0, amount: 0, skipReason: 'Aset ini tidak disusutkan.' };
  }

  const cost = toNumber(asset.acquisitionCost);
  const salvage = toNumber(asset.salvageValue);
  const depreciable = round2(cost - salvage);

  if (depreciable <= 0) {
    return { created: 0, posted: 0, amount: 0, skipReason: 'Nilai yang dapat disusutkan nol.' };
  }

  const method = asset.depreciationMethod as DepreciationMethodKey;

  // Metode unit produksi: hanya bulan target, membutuhkan angka produksi.
  if (method === 'UNITS_OF_PRODUCTION') {
    const units = params.unitsByAsset?.[asset.id];
    if (!units || units <= 0) {
      return {
        created: 0,
        posted: 0,
        amount: 0,
        skipReason: 'Unit produksi bulan ini belum diisi.',
      };
    }

    const existing = await prisma.depreciationEntry.findUnique({
      where: {
        workspaceId_assetId_periodYear_periodMonth: {
          workspaceId: asset.workspaceId,
          assetId: asset.id,
          periodYear: params.year,
          periodMonth: params.month,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return { created: 0, posted: 0, amount: 0, skipReason: 'Entri periode ini sudah ada.' };
    }

    const totalUnits = toNumber(asset.totalEstimatedUnits);
    const ratePerUnit = totalUnits > 0 ? depreciable / totalUnits : 0;
    const previousAccumulated = toNumber(asset.accumulatedDepreciation);
    const amount = round2(
      Math.min(round2(units * ratePerUnit), round2(depreciable - previousAccumulated))
    );
    if (amount <= 0) {
      return { created: 0, posted: 0, amount: 0, skipReason: 'Aset sudah tersusut penuh.' };
    }

    const accumulated = round2(previousAccumulated + amount);
    const bookValue = round2(cost - accumulated);

    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.depreciationEntry.create({
        data: {
          workspaceId: asset.workspaceId,
          assetId: asset.id,
          periodYear: params.year,
          periodMonth: params.month,
          depreciationAmount: new Prisma.Decimal(amount),
          accumulatedDepreciation: new Prisma.Decimal(accumulated),
          bookValue: new Prisma.Decimal(bookValue),
          unitsProduced: new Prisma.Decimal(units),
        },
      });

      const journal = await postDepreciationInTx(tx, {
        workspaceId: asset.workspaceId,
        userId: params.userId,
        asset,
        depreciationEntryId: entry.id,
        amount,
        entryDate: targetDate,
        description: `Penyusutan ${asset.name} periode ${periodKey(params.year, params.month)}`,
      });

      const updated = await tx.depreciationEntry.update({
        where: { id: entry.id },
        data: {
          journalEntryId: journal?.id ?? null,
          isPosted: Boolean(journal),
          postedAt: journal ? new Date() : null,
          postedBy: journal ? params.userId : null,
        },
        select: { id: true, isPosted: true },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: new Prisma.Decimal(accumulated),
          unitsProducedToDate: new Prisma.Decimal(round2(toNumber(asset.unitsProducedToDate) + units)),
          lastDepreciationDate: targetDate,
        },
      });

      return { posted: updated.isPosted ? 1 : 0 };
    });

    return { created: 1, posted: created.posted, amount };
  }

  // Metode lain: bangun jadwal deterministik lalu buat entri yang belum ada.
  const schedule = buildDepreciationSchedule({
    acquisitionCost: cost,
    salvageValue: salvage,
    usefulLifeMonths: asset.usefulLifeMonths,
    method,
    startDate,
    totalEstimatedUnits: asset.totalEstimatedUnits ? toNumber(asset.totalEstimatedUnits) : null,
  });

  const lastEntry = await prisma.depreciationEntry.findFirst({
    where: { workspaceId: asset.workspaceId, assetId: asset.id },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    select: { periodYear: true, periodMonth: true },
  });
  const lastIndex = lastEntry ? lastEntry.periodYear * 12 + lastEntry.periodMonth : startIndex - 1;

  const due = schedule.filter((p) => {
    const index = p.year * 12 + p.month;
    return index > lastIndex && index <= targetIndex && p.amount > 0;
  });

  if (due.length === 0) {
    return {
      created: 0,
      posted: 0,
      amount: 0,
      skipReason:
        lastIndex >= targetIndex
          ? 'Entri periode ini sudah ada.'
          : 'Belum ada penyusutan yang jatuh tempo.',
    };
  }

  let posted = 0;
  let total = 0;

  for (const period of due) {
    const entryDate = new Date(Date.UTC(period.year, period.month - 1, 1));

    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.depreciationEntry.create({
        data: {
          workspaceId: asset.workspaceId,
          assetId: asset.id,
          periodYear: period.year,
          periodMonth: period.month,
          depreciationAmount: new Prisma.Decimal(period.amount),
          accumulatedDepreciation: new Prisma.Decimal(period.accumulated),
          bookValue: new Prisma.Decimal(period.bookValue),
        },
      });

      const journal = await postDepreciationInTx(tx, {
        workspaceId: asset.workspaceId,
        userId: params.userId,
        asset,
        depreciationEntryId: entry.id,
        amount: period.amount,
        entryDate,
        description: `Penyusutan ${asset.name} periode ${periodKey(period.year, period.month)}`,
      });

      const updated = await tx.depreciationEntry.update({
        where: { id: entry.id },
        data: {
          journalEntryId: journal?.id ?? null,
          isPosted: Boolean(journal),
          postedAt: journal ? new Date() : null,
          postedBy: journal ? params.userId : null,
        },
        select: { isPosted: true },
      });

      await tx.asset.update({
        where: { id: asset.id },
        data: {
          accumulatedDepreciation: new Prisma.Decimal(period.accumulated),
          lastDepreciationDate: entryDate,
        },
      });

      return updated.isPosted ? 1 : 0;
    });

    posted += created;
    total = round2(total + period.amount);
  }

  return { created: due.length, posted, amount: total };
}

/**
 * Pastikan periode target bisa menerima jurnal sebelum menjalankan penyusutan.
 * Bila modul akuntansi tidak aktif, tidak ada jurnal sehingga periode tidak perlu
 * diperiksa.
 */
export async function assertPeriodWritableForDepreciation(
  workspaceId: string,
  year: number,
  month: number
): Promise<void> {
  const setting = await prisma.accountingSetting.findUnique({
    where: { workspaceId },
    select: { isEnabled: true },
  });
  if (!setting?.isEnabled) return;

  const date = new Date(Date.UTC(year, month - 1, 1));
  const period = await getOrCreatePeriod(prisma as unknown as Prisma.TransactionClient, workspaceId, date);
  if (!isPeriodWritable(period.status)) {
    throw new PeriodClosedError(period.status);
  }
}
