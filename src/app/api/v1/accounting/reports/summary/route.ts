import { NextRequest, NextResponse } from 'next/server';
import { JournalStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { guardAccounting, serializeReportValue, serverError } from '@/lib/accounting/api';
import { resolveReportRange } from '@/lib/accounting/period';
import { getBalanceSheet, getIncomeStatement } from '@/lib/accounting/reports';
import { ZERO } from '@/lib/accounting/money';

const ZERO_DEC = ZERO;

function ratio(numerator: Prisma.Decimal, denominator: Prisma.Decimal): Prisma.Decimal | null {
  if (denominator.isZero()) return null;
  return numerator.dividedBy(denominator);
}

function pct(value: Prisma.Decimal | null) {
  return value === null ? null : value.times(100).toDecimalPlaces(2).toFixed(2);
}

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const sp = req.nextUrl.searchParams;
      const workspaceId = auth.workspace.id;

      const setting = await prisma.accountingSetting.findUnique({ where: { workspaceId } });
      const range = resolveReportRange({
        period: sp.get('period'),
        startDate: sp.get('startDate'),
        endDate: sp.get('endDate'),
      });

      const [income, balance, cashLines, draftCount, latestPeriod] = await Promise.all([
        getIncomeStatement(workspaceId, range),
        getBalanceSheet(workspaceId, range.endDate, setting?.fiscalYearStartMonth ?? 1),
        prisma.journalLine.findMany({
          where: {
            workspaceId,
            cashAccountId: { not: null },
            entry: { status: JournalStatus.POSTED, entryDate: { lte: range.endDate } },
          },
          select: { debit: true, credit: true },
        }),
        prisma.journalEntry.count({ where: { workspaceId, status: JournalStatus.DRAFT } }),
        prisma.fiscalPeriod.findFirst({ where: { workspaceId }, orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
      ]);

      const cashPosition = cashLines.reduce((acc, l) => acc.plus(l.debit).minus(l.credit), ZERO_DEC);

      const currentAssets = balance.assets
        .filter((a) => a.code.startsWith('1-1'))
        .reduce((acc, a) => acc.plus(a.amount), ZERO_DEC);
      const currentLiabilities = balance.liabilities
        .filter((a) => a.code.startsWith('2-1'))
        .reduce((acc, a) => acc.plus(a.amount), ZERO_DEC);

      const receivables = balance.assets
        .filter((a) => a.code.startsWith('1-13'))
        .reduce((acc, a) => acc.plus(a.amount), ZERO_DEC);
      const payables = balance.liabilities
        .filter((a) => a.code === '2-1100')
        .reduce((acc, a) => acc.plus(a.amount), ZERO_DEC);

      const days = Math.max(
        1,
        Math.round((range.endDate.getTime() - range.startDate.getTime()) / (24 * 3600 * 1000)) + 1
      );

      const revenue = income.totals.revenue;
      const opex = income.totals.operatingExpenses;

      const ratios = {
        grossMarginPct: pct(ratio(income.totals.grossProfit, revenue)),
        netMarginPct: pct(ratio(income.totals.netIncome, revenue)),
        opexToRevenuePct: pct(ratio(opex, revenue)),
        currentRatio: ratio(currentAssets, currentLiabilities)?.toDecimalPlaces(2).toFixed(2) ?? null,
        receivableDays: ratio(receivables, revenue)
          ?.times(days)
          .toDecimalPlaces(1)
          .toFixed(1),
        payableDays: ratio(payables, income.totals.cogs)
          ?.times(days)
          .toDecimalPlaces(1)
          .toFixed(1),
        cashRunwayMonths: opex.isZero() ? null : cashPosition.dividedBy(opex).toDecimalPlaces(1).toFixed(1),
      };

      const warnings: string[] = [...balance.warnings];
      if (draftCount > 0) {
        warnings.push(`Ada ${draftCount} jurnal draft yang belum diposting sehingga belum masuk laporan.`);
      }
      if (!setting?.isEnabled) {
        warnings.push('Modul akuntansi belum diaktifkan untuk workspace ini.');
      }

      return NextResponse.json({
        success: true,
        data: serializeReportValue({
          period: range,
          cashPosition,
          income: income.totals,
          balance: balance.totals,
          ratios,
          draftCount,
          latestPeriod,
          warnings,
        }),
      });
    } catch (err) {
      return serverError('reports:summary', err, 'Gagal memuat ringkasan keuangan.');
    }
  },
  { minRole: 'VIEWER' }
);
