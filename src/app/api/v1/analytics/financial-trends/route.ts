import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { TransactionType } from '@prisma/client';
import {
  generateMonthBuckets,
  generateDayBuckets,
  zeroFillMonthlySeries,
  addCumulativeCashToMonthlySeries,
  resolveDateRange,
} from '@/lib/time-series-engine';
import { publicApiError } from '@/lib/api-error';

/**
 * GET /api/v1/analytics/financial-trends
 * Endpoint khusus agregasi time-series untuk grafik dashboard (ApexCharts)
 * Mendukung granularitas bulanan (misal: 6 / 12 bulan terakhir) dan harian (30 hari terakhir).
 */
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { searchParams } = req.nextUrl;
      // Tenant authority must come from the authenticated membership. Header,
      // query string, and "first workspace" fallbacks allow a caller to read a
      // different tenant by guessing its UUID; the dashboard only needs the
      // current authenticated workspace anyway.
      const workspaceId = auth?.workspace?.id;

      if (!workspaceId) {
        return NextResponse.json({ message: 'Workspace ID tidak ditemukan.' }, { status: 400 });
      }

      const targetWorkspaceId: string = workspaceId;

      const granularity = (searchParams.get('granularity') || 'monthly').toLowerCase();
      const countParam = searchParams.get('count') || searchParams.get('months') || '6';
      const count = Math.min(Math.max(parseInt(countParam, 10), 1), 24);
      const targetMonth = searchParams.get('targetMonth'); // e.g. "2026-08"

      // Tentukan tanggal acuan
      let referenceDate = new Date();
      if (targetMonth && /^\d{4}-\d{2}$/.test(targetMonth.trim())) {
        const [y, m] = targetMonth.trim().split('-');
        // Pasang di akhir bulan dalam kalender WIB. Menggunakan 23:59 UTC
        // akan bergeser ke tanggal/bulan berikutnya bagi pengguna Indonesia.
        referenceDate = new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10), 1) - 7 * 60 * 60 * 1000 - 1);
      }

      // =======================================================================
      // MODE 1: GRANULARITAS BULANAN (Default: 6 atau 12 bulan terakhir)
      // =======================================================================
      if (granularity === 'monthly') {
        const buckets = generateMonthBuckets(count, referenceDate);
        const earliestDate = buckets[0].startDate;
        const latestDate = buckets[buckets.length - 1].endDate;

        // Ambil transaksi dalam rentang bucket
        const transactions = await prisma.cashTransaction.findMany({
          where: {
            workspaceId: targetWorkspaceId,
            transactionDate: {
              gte: earliestDate,
              lte: latestDate,
            },
          },
          select: {
            type: true,
            amount: true,
            category: true,
            transactionDate: true,
          },
        });

        // Historical closing cash must be derived from the ledger, not inferred
        // from the current balance or a profit ratio. This query establishes the
        // real opening balance immediately before the first requested bucket.
        const transactionsBeforeRange = await prisma.cashTransaction.findMany({
          where: {
            workspaceId: targetWorkspaceId,
            transactionDate: { lt: earliestDate },
          },
          select: { type: true, amount: true },
        });
        const openingCash = transactionsBeforeRange.reduce(
          (balance, transaction) => balance + (transaction.type === TransactionType.INCOME ? transaction.amount : -transaction.amount),
          0
        );

        // Agregasi in-memory per "YYYY-MM"
        const aggregatesMap = new Map<
          string,
          {
            income: number;
            expense: number;
            count: number;
            categories: Record<string, number>;
          }
        >();

        for (const t of transactions) {
          // CashTransaction stores an instant; bucket it by the Indonesian
          // business calendar, not the server's UTC calendar.
          const d = new Date(t.transactionDate.getTime() + 7 * 60 * 60 * 1000);
          const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

          const existing = aggregatesMap.get(key) || {
            income: 0,
            expense: 0,
            count: 0,
            categories: {},
          };

          if (t.type === TransactionType.INCOME) {
            existing.income += t.amount;
          } else {
            existing.expense += t.amount;
          }
          existing.count += 1;
          existing.categories[t.category] = (existing.categories[t.category] || 0) + t.amount;

          aggregatesMap.set(key, existing);
        }

        // Lakukan Zero-Filling agar semua bulan memiliki data (0 jika tidak ada transaksi)
        const filledSeries = addCumulativeCashToMonthlySeries(
          zeroFillMonthlySeries(buckets, aggregatesMap),
          openingCash
        );

        // Hitung total dan statistik keseluruhan
        let totalIncome = 0;
        let totalExpense = 0;
        let highestIncomeMonth = { key: '', income: 0 };
        let lowestExpenseMonth = { key: '', expense: Number.MAX_SAFE_INTEGER };

        for (const s of filledSeries) {
          totalIncome += s.income;
          totalExpense += s.expense;

          if (s.income > highestIncomeMonth.income) {
            highestIncomeMonth = { key: s.label, income: s.income };
          }
          if (s.expense > 0 && s.expense < lowestExpenseMonth.expense) {
            lowestExpenseMonth = { key: s.label, expense: s.expense };
          }
        }

        const totalNet = totalIncome - totalExpense;
        const overallMarginPct =
          totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 1000) / 10 : 0;

        return NextResponse.json({
          success: true,
          granularity: 'monthly',
          range: {
            start: earliestDate.toISOString(),
            end: latestDate.toISOString(),
            bucketCount: buckets.length,
          },
          summary: {
            totalIncome,
            totalExpense,
            totalNet,
            overallMarginPct,
            averageMonthlyIncome: Math.round(totalIncome / buckets.length),
            averageMonthlyExpense: Math.round(totalExpense / buckets.length),
            openingCash,
            endingCash: filledSeries[filledSeries.length - 1]?.closingCash ?? openingCash,
            highestIncomeMonth: highestIncomeMonth.key ? highestIncomeMonth : null,
            lowestExpenseMonth: lowestExpenseMonth.expense !== Number.MAX_SAFE_INTEGER ? lowestExpenseMonth : null,
          },
          // Format siap pakai untuk chart ApexCharts
          chartSeries: {
            categories: filledSeries.map((s) => s.shortLabel),
            fullLabels: filledSeries.map((s) => s.label),
            keys: filledSeries.map((s) => s.key),
            incomeSeries: filledSeries.map((s) => s.income),
            expenseSeries: filledSeries.map((s) => s.expense),
            netSeries: filledSeries.map((s) => s.netCash),
            marginSeries: filledSeries.map((s) => s.marginPct),
            openingCashSeries: filledSeries.map((s) => s.openingCash),
            closingCashSeries: filledSeries.map((s) => s.closingCash),
          },
          details: filledSeries,
        });
      }

      // =======================================================================
      // MODE 2: GRANULARITAS HARIAN (Misal: 30 hari dalam 1 bulan)
      // =======================================================================
      const resolution = resolveDateRange({
        month: targetMonth,
        range: searchParams.get('range') || (targetMonth ? undefined : 'this_month'),
      });

      const dayBuckets = generateDayBuckets(resolution.startDate, resolution.endDate);

      const transactions = await prisma.cashTransaction.findMany({
        where: {
          workspaceId: targetWorkspaceId,
          transactionDate: {
            gte: resolution.startDate,
            lte: resolution.endDate,
          },
        },
        select: {
          type: true,
          amount: true,
          transactionDate: true,
        },
      });

      const dayMap = new Map<string, { income: number; expense: number }>();
      for (const t of transactions) {
        const d = new Date(t.transactionDate.getTime() + 7 * 60 * 60 * 1000);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
          d.getUTCDate()
        ).padStart(2, '0')}`;

        const item = dayMap.get(key) || { income: 0, expense: 0 };
        if (t.type === TransactionType.INCOME) item.income += t.amount;
        else item.expense += t.amount;
        dayMap.set(key, item);
      }

      const filledDaily = dayBuckets.map((b) => {
        const found = dayMap.get(b.key) || { income: 0, expense: 0 };
        return {
          ...b,
          income: found.income,
          expense: found.expense,
          net: found.income - found.expense,
        };
      });

      return NextResponse.json({
        success: true,
        granularity: 'daily',
        period: {
          key: resolution.periodKey,
          label: resolution.periodLabel,
        },
        chartSeries: {
          categories: filledDaily.map((d) => d.label),
          keys: filledDaily.map((d) => d.key),
          incomeSeries: filledDaily.map((d) => d.income),
          expenseSeries: filledDaily.map((d) => d.expense),
          netSeries: filledDaily.map((d) => d.net),
        },
        details: filledDaily,
      });
    } catch (err: any) {
      console.error('[Financial Trends API Error]:', err);
      return NextResponse.json({ message: publicApiError('Gagal memuat tren keuangan.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
