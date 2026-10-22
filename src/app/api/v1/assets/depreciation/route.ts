import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { decimalToNumber, serializeDepreciationEntry } from '@/lib/assets/service';
import {
  assertPeriodWritableForDepreciation,
  runDepreciation,
} from '@/lib/assets/depreciation-run';
import { PeriodClosedError } from '@/lib/accounting/period';
import { postDepreciationInTx } from '@/lib/assets/posting';

/**
 * Penyusutan aset.
 *  GET  /api/v1/assets/depreciation?year=&month=&assetId=
 *       -> daftar entri penyusutan + ringkasan periode
 *  POST /api/v1/assets/depreciation
 *       body: { year, month, unitsByAsset?, assetIds?, action?: 'run' | 'post' }
 *       -> jalankan penyusutan bulanan atau posting ulang entri yang belum terjurnal
 */

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;

      const year = searchParams.get('year') ? Number(searchParams.get('year')) : null;
      const month = searchParams.get('month') ? Number(searchParams.get('month')) : null;
      const assetId = searchParams.get('assetId') || undefined;
      const from = searchParams.get('from');
      const to = searchParams.get('to');

      const where: any = { workspaceId };
      if (assetId) where.assetId = assetId;
      if (year && month) {
        where.periodYear = year;
        where.periodMonth = month;
      } else {
        const conditions: any[] = [];
        if (from) {
          const fromYear = Number(from.slice(0, 4));
          const fromMonth = Number(from.slice(5, 7)) || 1;
          conditions.push({
            OR: [
              { periodYear: { gt: fromYear } },
              { periodYear: fromYear, periodMonth: { gte: fromMonth } },
            ],
          });
        }
        if (to) {
          const toYear = Number(to.slice(0, 4));
          const toMonth = Number(to.slice(5, 7)) || 12;
          conditions.push({
            OR: [
              { periodYear: { lt: toYear } },
              { periodYear: toYear, periodMonth: { lte: toMonth } },
            ],
          });
        }
        if (conditions.length > 0) where.AND = conditions;
      }

      const entries = await prisma.depreciationEntry.findMany({
        where,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { asset: { assetCode: 'asc' } }],
        take: 1000,
        include: {
          asset: {
            select: {
              id: true,
              assetCode: true,
              name: true,
              category: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      const totalAmount = entries.reduce(
        (sum, entry) => sum + decimalToNumber(entry.depreciationAmount),
        0
      );
      const unposted = entries.filter((entry) => !entry.isPosted);

      return NextResponse.json({
        success: true,
        data: entries.map((entry) => ({
          ...serializeDepreciationEntry(entry),
          asset: entry.asset,
        })),
        summary: {
          entries: entries.length,
          totalAmount: Math.round(totalAmount * 100) / 100,
          unpostedCount: unposted.length,
          unpostedAmount:
            Math.round(
              unposted.reduce(
                (sum, entry) => sum + decimalToNumber(entry.depreciationAmount),
                0
              ) * 100
            ) / 100,
        },
      });
    } catch (err) {
      console.error('[Depreciation GET]', err);
      return NextResponse.json(
        { message: publicApiError('Gagal memuat data penyusutan.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const body = await req.json();
      const action = String(body?.action ?? 'run');

      if (action === 'post') {
        return await postUnpostedEntries(auth, body);
      }

      const year = Number(body?.year);
      const month = Number(body?.month);
      if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
        return NextResponse.json(
          { message: 'Periode penyusutan tidak valid. Isi tahun dan bulan (1-12).' },
          { status: 400 }
        );
      }

      await assertPeriodWritableForDepreciation(workspaceId, year, month);

      const unitsByAsset: Record<string, number> = {};
      if (body?.unitsByAsset && typeof body.unitsByAsset === 'object') {
        for (const [assetId, value] of Object.entries(body.unitsByAsset)) {
          const units = Number(value);
          if (Number.isFinite(units) && units > 0) unitsByAsset[assetId] = units;
        }
      }

      const result = await runDepreciation({
        workspaceId,
        userId: auth.user.id,
        year,
        month,
        unitsByAsset,
        assetIds: Array.isArray(body?.assetIds) ? body.assetIds.map(String) : undefined,
      });

      return NextResponse.json({
        success: true,
        ...result,
        message:
          result.createdEntries > 0
            ? `${result.createdEntries} entri penyusutan dibuat untuk periode ${month}/${year}.`
            : 'Tidak ada penyusutan baru yang perlu dicatat pada periode ini.',
      });
    } catch (err) {
      console.error('[Depreciation POST]', err);
      if (err instanceof PeriodClosedError) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
      return NextResponse.json(
        { message: publicApiError('Proses penyusutan gagal dijalankan.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);

/** Posting ulang entri yang belum punya jurnal (mis. akuntansi baru diaktifkan). */
async function postUnpostedEntries(auth: any, body: any) {
  const workspaceId = auth.workspace.id;

  const where: any = { workspaceId, isPosted: false };
  if (Array.isArray(body?.entryIds) && body.entryIds.length > 0) {
    where.id = { in: body.entryIds.map(String) };
  }

  const entries = await prisma.depreciationEntry.findMany({
    where,
    include: { asset: true },
    orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }],
    take: 500,
  });

  let posted = 0;
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const entry of entries) {
    try {
      const journal = await prisma.$transaction(async (tx) => {
        const created = await postDepreciationInTx(tx, {
          workspaceId,
          userId: auth.user.id,
          asset: entry.asset,
          depreciationEntryId: entry.id,
          amount: decimalToNumber(entry.depreciationAmount),
          entryDate: new Date(Date.UTC(entry.periodYear, entry.periodMonth - 1, 1)),
          description: `Penyusutan ${entry.asset.name} periode ${entry.periodYear}-${String(
            entry.periodMonth
          ).padStart(2, '0')}`,
        });

        if (created) {
          await tx.depreciationEntry.update({
            where: { id: entry.id },
            data: {
              journalEntryId: created.id,
              isPosted: true,
              postedAt: new Date(),
              postedBy: auth.user.id,
            },
          });
        }
        return created;
      });

      if (journal) posted += 1;
      else skipped.push({ id: entry.id, reason: 'Modul akuntansi belum aktif atau nominal nol.' });
    } catch (err) {
      skipped.push({
        id: entry.id,
        reason: err instanceof Error ? err.message : 'Gagal membuat jurnal.',
      });
    }
  }

  return NextResponse.json({
    success: true,
    posted,
    skipped,
    message:
      posted > 0
        ? `${posted} entri penyusutan berhasil dijurnal.`
        : 'Tidak ada entri yang bisa dijurnal.',
  });
}
