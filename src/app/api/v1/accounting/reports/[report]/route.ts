import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, notFound, serializeReportValue, serverError } from '@/lib/accounting/api';
import { comparativeRange, resolveReportRange, shiftMonth } from '@/lib/accounting/period';
import {
  getBalanceSheet,
  getCashFlowStatement,
  getEquityStatement,
  getIncomeStatement,
  getLedger,
  getTrialBalance,
} from '@/lib/accounting/reports';

const SUPPORTED = new Set([
  'income-statement',
  'balance-sheet',
  'cash-flow',
  'equity',
  'trial-balance',
  'ledger',
]);

export const GET = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const { report } = (await params) as { report: string };
      if (!SUPPORTED.has(report)) return notFound('Jenis laporan tidak dikenal.');

      const sp = req.nextUrl.searchParams;
      const setting = await prisma.accountingSetting.findUnique({
        where: { workspaceId: auth.workspace.id },
      });
      const fiscalYearStartMonth = setting?.fiscalYearStartMonth ?? 1;

      const range = resolveReportRange({
        period: sp.get('period'),
        startDate: sp.get('startDate'),
        endDate: sp.get('endDate'),
      });

      const comparativeMode = (sp.get('comparative') || 'none') as
        | 'prev_month'
        | 'prev_year'
        | 'ytd'
        | 'none';

      const workspaceId = auth.workspace.id;

      switch (report) {
        case 'income-statement': {
          const current = await getIncomeStatement(workspaceId, range);
          const compRange = comparativeRange(comparativeMode, range, fiscalYearStartMonth);
          const comparison = compRange ? await getIncomeStatement(workspaceId, compRange) : null;
          return NextResponse.json({
            success: true,
            data: serializeReportValue({
              period: range,
              comparativeMode,
              current,
              comparison,
            }),
          });
        }

        case 'balance-sheet': {
          const current = await getBalanceSheet(workspaceId, range.endDate, fiscalYearStartMonth);
          let comparison = null;
          if (comparativeMode === 'prev_month' && range.month) {
            const prev = shiftMonth(range.year, range.month, -1);
            const prevRange = resolveReportRange({ period: `${prev.year}-${String(prev.month).padStart(2, '0')}` });
            comparison = await getBalanceSheet(workspaceId, prevRange.endDate, fiscalYearStartMonth);
          } else if (comparativeMode === 'prev_year' && range.month) {
            const prevRange = resolveReportRange({
              period: `${range.year - 1}-${String(range.month).padStart(2, '0')}`,
            });
            comparison = await getBalanceSheet(workspaceId, prevRange.endDate, fiscalYearStartMonth);
          }
          return NextResponse.json({
            success: true,
            data: serializeReportValue({ period: range, comparativeMode, current, comparison }),
          });
        }

        case 'cash-flow': {
          const current = await getCashFlowStatement(workspaceId, range);
          return NextResponse.json({
            success: true,
            data: serializeReportValue({ period: range, current }),
          });
        }

        case 'equity': {
          const current = await getEquityStatement(workspaceId, range, setting?.currentYearProfitAccountId);
          const compRange = comparativeRange(comparativeMode, range, fiscalYearStartMonth);
          const comparison = compRange
            ? await getEquityStatement(workspaceId, compRange, setting?.currentYearProfitAccountId)
            : null;
          return NextResponse.json({
            success: true,
            data: serializeReportValue({ period: range, comparativeMode, current, comparison }),
          });
        }

        case 'trial-balance': {
          const current = await getTrialBalance(workspaceId, range);
          return NextResponse.json({ success: true, data: serializeReportValue({ period: range, current }) });
        }

        case 'ledger': {
          const accountId = sp.get('accountId');
          if (!accountId) return badRequest('Parameter accountId wajib untuk laporan buku besar.');
          const current = await getLedger(workspaceId, accountId, range);
          return NextResponse.json({ success: true, data: serializeReportValue({ period: range, current }) });
        }

        default:
          return notFound('Jenis laporan tidak dikenal.');
      }
    } catch (err) {
      if (err instanceof Error && /periode|tanggal|bulan/i.test(err.message)) {
        return badRequest(err.message);
      }
      return serverError('reports', err, 'Gagal menghitung laporan keuangan.');
    }
  },
  { minRole: 'VIEWER' }
);
