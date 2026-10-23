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
import { getAgingReport, getTaxSummary, type AgingType } from '@/lib/accounting/aux-reports';
import { getBudgetReport } from '@/lib/accounting/budgets';
import { getInventoryReport, getStockCard } from '@/lib/accounting/inventory-report';
import { getProfitabilityReport } from '@/lib/accounting/profitability';

const SUPPORTED = new Set([
  'income-statement',
  'balance-sheet',
  'cash-flow',
  'equity',
  'trial-balance',
  'ledger',
  'aging',
  'tax',
  'budget',
  'inventory',
  'profitability',
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

        case 'aging': {
          const rawType = (sp.get('type') || 'AR').toUpperCase();
          if (rawType !== 'AR' && rawType !== 'AP') {
            return badRequest('Parameter type harus AR atau AP.');
          }
          const asOfRaw = sp.get('asOf');
          let asOf = range.endDate;
          if (asOfRaw) {
            asOf = new Date(`${asOfRaw}T23:59:59+07:00`);
            if (Number.isNaN(asOf.getTime())) return badRequest('Tanggal potong (asOf) tidak valid.');
          }
          const current = await getAgingReport(workspaceId, rawType as AgingType, asOf);
          return NextResponse.json({ success: true, data: serializeReportValue({ period: range, current }) });
        }

        case 'budget': {
          // `division` menyaring laporan ke satu divisi; tanpa parameter, semua
          // divisi ikut tampil.
          const current = await getBudgetReport(
            workspaceId,
            range,
            fiscalYearStartMonth,
            sp.get('division')
          );
          return NextResponse.json({ success: true, data: serializeReportValue({ period: range, current }) });
        }

        case 'inventory': {
          // Tanpa productId: laporan nilai persediaan. Dengan productId: kartu stok
          // (mutasi satu produk) untuk periode yang dipilih.
          const productId = sp.get('productId');
          if (productId) {
            const card = await getStockCard(workspaceId, productId, range);
            if (!card) return notFound('Produk tidak ditemukan atau bukan milik workspace ini.');
            return NextResponse.json({ success: true, data: serializeReportValue({ period: range, card }) });
          }
          const current = await getInventoryReport(workspaceId, range);
          return NextResponse.json({ success: true, data: serializeReportValue({ period: range, current }) });
        }

        case 'tax': {
          const current = await getTaxSummary(
            workspaceId,
            range,
            setting?.taxProfile ?? 'UMKM_NON_PKP'
          );
          return NextResponse.json({ success: true, data: serializeReportValue({ period: range, current }) });
        }

        case 'profitability': {
          // `trend` = jumlah bulan yang ditampilkan di grafik tren (3–24).
          const trendRaw = Number(sp.get('trend'));
          const trendMonths = Number.isFinite(trendRaw) && trendRaw > 0 ? trendRaw : 12;
          const current = await getProfitabilityReport(workspaceId, range, {
            comparativeMode,
            fiscalStartMonth: fiscalYearStartMonth,
            trendMonths,
          });
          return NextResponse.json({
            success: true,
            data: serializeReportValue({ ...current, period: range }),
          });
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
