import { NextRequest, NextResponse } from 'next/server';
import { JournalSource, JournalStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { guardAccounting, serverError } from '@/lib/accounting/api';
import { fiscalYearRange } from '@/lib/accounting/period';

export const GET = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const workspaceId = auth.workspace.id;

      const [periods, setting] = await Promise.all([
        prisma.fiscalPeriod.findMany({
          where: { workspaceId },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          take: 36,
          include: {
            _count: { select: { entries: true } },
          },
        }),
        prisma.accountingSetting.findUnique({
          where: { workspaceId },
          select: { fiscalYearStartMonth: true },
        }),
      ]);

      const draftCounts = await prisma.journalEntry.groupBy({
        by: ['periodId'],
        where: {
          workspaceId,
          status: JournalStatus.DRAFT,
          periodId: { in: periods.map((p) => p.id) },
        },
        _count: { _all: true },
      });
      const draftMap = new Map(draftCounts.map((d) => [d.periodId, d._count._all]));

      // Jurnal penutup tahun: dipakai untuk menandai periode bulan terakhir yang
      // sudah ditutup tahunnya, supaya tombol "Tutup Tahun" bisa dinonaktifkan.
      const startMonth = setting?.fiscalYearStartMonth ?? 1;
      const closingEntries = await prisma.journalEntry.findMany({
        where: {
          workspaceId,
          source: JournalSource.CLOSING,
          status: JournalStatus.POSTED,
          reversedBy: null,
        },
        select: { entryDate: true, entryNumber: true },
      });

      const closingByEndDate = new Map<string, string>();
      for (const entry of closingEntries) {
        const fy = fiscalYearRange(
          entry.entryDate.getUTCFullYear(),
          entry.entryDate.getUTCMonth() + 1,
          startMonth
        );
        closingByEndDate.set(fy.endDate.toISOString().slice(0, 10), entry.entryNumber);
      }

      return NextResponse.json({
        success: true,
        data: periods.map((p) => {
          const fy = fiscalYearRange(p.year, p.month, startMonth);
          const key = fy.endDate.toISOString().slice(0, 10);
          return {
            id: p.id,
            year: p.year,
            month: p.month,
            status: p.status,
            closedAt: p.closedAt,
            lockedAt: p.lockedAt,
            entryCount: p._count.entries,
            draftCount: draftMap.get(p.id) ?? 0,
            fiscalYearEndMonth: startMonth === 1 ? 12 : startMonth - 1,
            fiscalYearClosed: closingByEndDate.has(key),
            closingEntryNumber: closingByEndDate.get(key) ?? null,
          };
        }),
      });
    } catch (err) {
      return serverError('periods:get', err, 'Gagal memuat daftar periode.');
    }
  },
  { minRole: 'VIEWER' }
);
