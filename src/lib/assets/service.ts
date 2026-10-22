import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { DepreciationMethodKey } from './depreciation';

/**
 * Perkakas bersama modul Manajemen Aset: kategori bawaan, pembuatan kode aset
 * atomik, dan serialisasi Decimal -> number untuk respons JSON.
 */

export interface DefaultCategorySeed {
  code: string;
  name: string;
  description: string;
  defaultUsefulLifeMonths: number;
  defaultDepreciationMethod: DepreciationMethodKey | null;
  defaultSalvageValueRate: number;
  isDepreciable: boolean;
}

/**
 * Kategori bawaan mengikuti kelompok aset tetap yang lazim di Indonesia
 * (masa manfaat & metode mengacu praktik PSAK/pajak, bukan angka mutlak --
 * pengguna tetap boleh mengubahnya).
 */
export const DEFAULT_ASSET_CATEGORIES: DefaultCategorySeed[] = [
  {
    code: 'TANAH',
    name: 'Tanah',
    description: 'Tanah dan lahan, tidak disusutkan.',
    defaultUsefulLifeMonths: 0,
    defaultDepreciationMethod: null,
    defaultSalvageValueRate: 0,
    isDepreciable: false,
  },
  {
    code: 'BANGUNAN',
    name: 'Bangunan & Gedung',
    description: 'Bangunan permanen dan instalasinya.',
    defaultUsefulLifeMonths: 240,
    defaultDepreciationMethod: 'STRAIGHT_LINE',
    defaultSalvageValueRate: 10,
    isDepreciable: true,
  },
  {
    code: 'KENDARAAN',
    name: 'Kendaraan Bermotor',
    description: 'Mobil, motor, dan kendaraan operasional.',
    defaultUsefulLifeMonths: 96,
    defaultDepreciationMethod: 'DECLINING_BALANCE',
    defaultSalvageValueRate: 20,
    isDepreciable: true,
  },
  {
    code: 'PERALATAN',
    name: 'Peralatan & Mesin',
    description: 'Mesin produksi, peralatan kerja, dan perlengkapan teknis.',
    defaultUsefulLifeMonths: 96,
    defaultDepreciationMethod: 'STRAIGHT_LINE',
    defaultSalvageValueRate: 10,
    isDepreciable: true,
  },
  {
    code: 'MEBEL',
    name: 'Mebel & Perabotan',
    description: 'Meja, kursi, lemari, dan perabotan kantor.',
    defaultUsefulLifeMonths: 96,
    defaultDepreciationMethod: 'STRAIGHT_LINE',
    defaultSalvageValueRate: 10,
    isDepreciable: true,
  },
  {
    code: 'KOMPUTER',
    name: 'Komputer & Elektronik',
    description: 'Laptop, server, printer, dan perangkat elektronik.',
    defaultUsefulLifeMonths: 48,
    defaultDepreciationMethod: 'DECLINING_BALANCE',
    defaultSalvageValueRate: 10,
    isDepreciable: true,
  },
  {
    code: 'SOFTWARE',
    name: 'Perangkat Lunak',
    description: 'Lisensi perangkat lunak dan sistem informasi.',
    defaultUsefulLifeMonths: 48,
    defaultDepreciationMethod: 'STRAIGHT_LINE',
    defaultSalvageValueRate: 0,
    isDepreciable: true,
  },
  {
    code: 'LAINNYA',
    name: 'Aset Lainnya',
    description: 'Aset tetap lain yang belum masuk kategori di atas.',
    defaultUsefulLifeMonths: 96,
    defaultDepreciationMethod: 'STRAIGHT_LINE',
    defaultSalvageValueRate: 10,
    isDepreciable: true,
  },
];

/** Jumlahkan array Decimal / number dengan aman. */
export function sumAmounts(values: Array<Prisma.Decimal | number | null | undefined>): number {
  const total = values.reduce<Prisma.Decimal>(
    (acc, value) => acc.plus(new Prisma.Decimal(value ?? 0)),
    new Prisma.Decimal(0)
  );
  return Number(total);
}

export function decimalToNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

/**
 * Nomor urut dokumen atomik (pola sama dengan DocumentSequence jurnal).
 * Dipakai untuk kode aset `AST-<KATEGORI>-0001`.
 */
export async function nextAssetSequence(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  categoryCode: string
): Promise<number> {
  const key = `AST-${categoryCode}`.slice(0, 30);
  const rows = await tx.$queryRaw<Array<{ next_number: number }>>`
    INSERT INTO document_sequences (id, workspace_id, key, next_number)
    VALUES (gen_random_uuid(), ${workspaceId}::uuid, ${key}, 2)
    ON CONFLICT (workspace_id, key)
    DO UPDATE SET next_number = document_sequences.next_number + 1
    RETURNING next_number - 1 AS next_number
  `;
  return rows[0]?.next_number ?? 1;
}

const ASSET_CODE_INVALID = /[^A-Z0-9]/g;

export function normalizeCategoryCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(ASSET_CODE_INVALID, '_')
    .replace(/_+/g, '_')
    .slice(0, 12);
}

/**
 * Buat kode aset unik. Kalau kode bentrok (mis. karena data lama), tambahkan
 * sufiks sampai tidak ada duplikat.
 */
export async function generateAssetCode(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  categoryCode: string
): Promise<string> {
  const prefix = `AST-${normalizeCategoryCode(categoryCode) || 'UMUM'}`;
  let sequence = await nextAssetSequence(tx, workspaceId, categoryCode);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${prefix}-${String(sequence).padStart(4, '0')}`;
    const exists = await tx.asset.findFirst({
      where: { workspaceId, assetCode: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    sequence += 1;
  }

  // Jaring pengaman terakhir: timestamp supaya tidak pernah gagal menyimpan.
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

/** Pastikan seluruh kategori bawaan tersedia untuk workspace (idempoten). */
export async function seedDefaultCategories(workspaceId: string): Promise<number> {
  let created = 0;
  for (const category of DEFAULT_ASSET_CATEGORIES) {
    const existing = await prisma.assetCategory.findUnique({
      where: { workspaceId_code: { workspaceId, code: category.code } },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.assetCategory.create({
      data: {
        workspaceId,
        code: category.code,
        name: category.name,
        description: category.description,
        defaultUsefulLifeMonths: category.defaultUsefulLifeMonths,
        defaultDepreciationMethod: category.defaultDepreciationMethod ?? undefined,
        defaultSalvageValueRate: category.defaultSalvageValueRate,
        isSystem: true,
      },
    });
    created += 1;
  }
  return created;
}

/** Include standar untuk detail aset. */
export const assetDetailInclude = Prisma.validator<Prisma.AssetInclude>()({
  category: true,
  custodian: { select: { id: true, fullName: true, email: true } },
  creator: { select: { id: true, fullName: true, email: true } },
  depreciationEntries: { orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }] },
  maintenanceRecords: { orderBy: { maintenanceDate: 'desc' } },
  transferHistory: { orderBy: { transferDate: 'desc' } },
  impairmentRecords: { orderBy: { impairmentDate: 'desc' } },
});

/** Ubah baris aset (Decimal) menjadi bentuk JSON yang ramah klien. */
export function serializeAsset(asset: any) {
  if (!asset) return asset;
  return {
    ...asset,
    acquisitionCost: decimalToNumber(asset.acquisitionCost),
    salvageValue: decimalToNumber(asset.salvageValue),
    accumulatedDepreciation: decimalToNumber(asset.accumulatedDepreciation),
    accumulatedImpairment: decimalToNumber(asset.accumulatedImpairment),
    totalEstimatedUnits: asset.totalEstimatedUnits === null ? null : decimalToNumber(asset.totalEstimatedUnits),
    unitsProducedToDate: decimalToNumber(asset.unitsProducedToDate),
    disposalProceeds: asset.disposalProceeds === null ? null : decimalToNumber(asset.disposalProceeds),
    disposalGainLoss: asset.disposalGainLoss === null ? null : decimalToNumber(asset.disposalGainLoss),
    bookValue: decimalToNumber(
      new Prisma.Decimal(asset.acquisitionCost)
        .minus(new Prisma.Decimal(asset.accumulatedDepreciation))
        .minus(new Prisma.Decimal(asset.accumulatedImpairment ?? 0))
    ),
    depreciationEntries: Array.isArray(asset.depreciationEntries)
      ? asset.depreciationEntries.map(serializeDepreciationEntry)
      : asset.depreciationEntries,
    maintenanceRecords: Array.isArray(asset.maintenanceRecords)
      ? asset.maintenanceRecords.map((row: any) => ({ ...row, cost: decimalToNumber(row.cost) }))
      : asset.maintenanceRecords,
    impairmentRecords: Array.isArray(asset.impairmentRecords)
      ? asset.impairmentRecords.map((row: any) => ({
          ...row,
          recoverableAmount: decimalToNumber(row.recoverableAmount),
          carryingAmount: decimalToNumber(row.carryingAmount),
          impairmentLoss: decimalToNumber(row.impairmentLoss),
        }))
      : asset.impairmentRecords,
  };
}

export function serializeDepreciationEntry(entry: any) {
  if (!entry) return entry;
  return {
    ...entry,
    depreciationAmount: decimalToNumber(entry.depreciationAmount),
    accumulatedDepreciation: decimalToNumber(entry.accumulatedDepreciation),
    bookValue: decimalToNumber(entry.bookValue),
    unitsProduced: entry.unitsProduced === null ? null : decimalToNumber(entry.unitsProduced),
  };
}
