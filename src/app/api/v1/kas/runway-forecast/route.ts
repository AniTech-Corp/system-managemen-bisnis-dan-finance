import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { TransactionType } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { customCashReserve, customMonthlyExpense, customMonthlyRevenue } = await req.json();

      let currentCashReserve = Number(customCashReserve);
      let monthlyExpense = Number(customMonthlyExpense);
      let monthlyRevenue = Number(customMonthlyRevenue);

      const hasCustomCashReserve = customCashReserve !== undefined && customCashReserve !== null && customCashReserve !== '' && Number.isFinite(currentCashReserve);
      const hasCustomMonthlyExpense = customMonthlyExpense !== undefined && customMonthlyExpense !== null && customMonthlyExpense !== '' && Number.isFinite(monthlyExpense);
      const hasCustomMonthlyRevenue = customMonthlyRevenue !== undefined && customMonthlyRevenue !== null && customMonthlyRevenue !== '' && Number.isFinite(monthlyRevenue);

      // Jika data tidak diinput manual, hitung otomatis dari transaksi kas nyata.
      // Saldo kas = seluruh transaksi sampai sekarang. Run-rate bulanan = rata-rata
      // tiga bulan kalender terakhir, bukan total seumur hidup yang diberi label
      // "bulanan". Dengan begitu tenant yang baru mengunggah transaksi lama tidak
      // membuat forecast terlihat puluhan kali lebih besar dari kondisi operasional.
      if (!hasCustomCashReserve || !hasCustomMonthlyExpense || !hasCustomMonthlyRevenue) {
        const now = new Date();
        const lookbackStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
        const [allTimeAggregates, lookbackTransactions] = await Promise.all([
          prisma.cashTransaction.groupBy({
            by: ['type'],
            where: {
              workspaceId: auth.workspace.id,
              transactionDate: { lte: now },
            },
            _sum: { amount: true },
          }),
          prisma.cashTransaction.findMany({
            where: {
              workspaceId: auth.workspace.id,
              transactionDate: {
                gte: lookbackStart,
                lte: now,
              },
            },
            select: { type: true, amount: true, transactionDate: true },
          }),
        ]);

        let balanceIncome = 0;
        let balanceExpense = 0;
        for (const agg of allTimeAggregates) {
          if (agg.type === TransactionType.INCOME) balanceIncome += agg._sum.amount || 0;
          else balanceExpense += agg._sum.amount || 0;
        }

        let runRateIncome = 0;
        let runRateExpense = 0;
        const runRateMonths = new Set<string>();
        for (const transaction of lookbackTransactions) {
          const amount = Number(transaction.amount) || 0;
          if (transaction.type === TransactionType.INCOME) runRateIncome += amount;
          if (transaction.type === TransactionType.EXPENSE) runRateExpense += amount;
          if (transaction.transactionDate) {
            const d = new Date(transaction.transactionDate);
            runRateMonths.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
          }
        }

        const monthCount = Math.max(1, runRateMonths.size);
        if (!hasCustomCashReserve) currentCashReserve = balanceIncome - balanceExpense;
        if (!hasCustomMonthlyExpense) monthlyExpense = runRateExpense / monthCount;
        if (!hasCustomMonthlyRevenue) monthlyRevenue = runRateIncome / monthCount;
      }

      const netBurnRate = Math.max(monthlyExpense - monthlyRevenue, 0); // Pengeluaran melebihi pemasukan
      const grossBurnRate = monthlyExpense;

      // Runway kalkulasi.
      // FIX (audit workflow, sesi ini): dulu runwayMonths bisa negatif (mis. "-1 Bulan")
      // saat currentCashReserve sudah minus -- angka jujur dihitung dari data asli, tapi
      // "runway -1 bulan" tidak masuk akal secara bisnis (runway minimal 0). Math.max
      // floor + status DEFISIT_KAS terpisah dari CRITICAL_ALERT biasa (yang mengasumsikan
      // kas masih positif tapi menipis, bukan sudah minus).
      let runwayMonths = 0;
      if (netBurnRate > 0) {
        runwayMonths = Math.max(Number((currentCashReserve / netBurnRate).toFixed(1)), 0);
      } else {
        runwayMonths = 999; // Cashflow positif (Infinite runway)
      }
      const isDeficit = currentCashReserve < 0;

      let status = 'HEALTHY_RUNWAY';
      let statusColor = '#00e676';
      let recommendation = 'Arus kas bisnis Anda surplus dan berada dalam kondisi prima.';

      if (isDeficit) {
        status = 'DEFISIT_KAS';
        statusColor = '#ff5252';
        recommendation = `🚨 KAS SUDAH MINUS Rp ${Math.abs(currentCashReserve).toLocaleString('id-ID')}! Ini bukan lagi soal "berapa bulan tersisa" -- segera suntik modal atau lunasi kewajiban mendesak sebelum menambah pengeluaran apapun.`;
      } else if (netBurnRate > 0) {
        if (runwayMonths < 3) {
          status = 'CRITICAL_ALERT';
          statusColor = '#ff5252';
          recommendation = '🚨 KAS KRITIS! Sisa cadangan kas kurang dari 3 bulan. Segera lakukan pemotongan OpEx non-esensial atau percepat penagihan piutang.';
        } else if (runwayMonths <= 6) {
          status = 'MODERATE_WARNING';
          statusColor = '#ffab00';
          recommendation = '⚠️ Waspada! Cadangan kas bertahan 3-6 bulan. Disarankan mempercepat konversi penjualan dan meninjau kembali pengeluaran rutin.';
        } else {
          status = 'STABLE_RUNWAY';
          statusColor = '#00d2ff';
          recommendation = 'Cadangan kas cukup aman (> 6 bulan). Pertahankan rasio efisiensi dan diversifikasi kanal pendapatan.';
        }
      }

      return NextResponse.json({
        success: true,
        forecast: {
          currentCashReserve,
          monthlyRevenue,
          monthlyExpense: grossBurnRate,
          netBurnRate,
          runwayMonths: runwayMonths > 120 ? 'Surplus (Kas Positif)' : `${runwayMonths} Bulan`,
          status,
          statusColor,
          recommendation,
          calculatedAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal menghitung proyeksi runway.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
