import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { TransactionType } from '@prisma/client';
import { resolveDateRange, calculateMoM } from '@/lib/time-series-engine';
import { publicApiError } from '@/lib/api-error';
import { createApprovalRequest } from '@/lib/security-guardrail';
import { invalidateContextCache } from '@/lib/ai-brain/context-engine';
import { invalidateDashboardInsightCache } from '@/lib/ai-brain/dashboard-insight';

// V4f, 8 Sep 2026 (validasi ringan input keuangan -- kasus Pak Fajrul): DIDUPLIKASI
// inline persis sama di kas/invoices/route.ts (bukan diekstrak ke lib terpisah) --
// lihat komentar JSDoc di file itu untuk alasan (konsisten gaya validasi inline
// yang sudah ada di kedua route, coupling lintas-file tidak perlu untuk 4 baris).
function checkBusinessDate(raw: string, label: string): string | null {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return `Format ${label} tidak valid.`;
  const now = Date.now();
  if (d.getTime() - now > 365 * 24 * 3600 * 1000) return `${label} tidak boleh lebih dari 1 tahun ke depan.`;
  if (d.getFullYear() < 2000) return `${label} tidak boleh sebelum tahun 2000.`;
  return null;
}

// GET: Ambil ringkasan kas & riwayat transaksi dengan filter tanggal dinamis
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      // Workspace authority comes from the authenticated tenant context. The
      // old header/query-first fallback let a caller point this read endpoint
      // at another workspace by guessing its UUID.
      const workspaceId = auth.workspace.id;

      if (!workspaceId) {
        return NextResponse.json({ message: 'Workspace ID tidak ditemukan.' }, { status: 400 });
      }

      // 1. Ekstraksi Parameter Filter Waktu
      const { searchParams } = req.nextUrl;
      const monthParam = searchParams.get('month'); // "YYYY-MM"
      const startDateParam = searchParams.get('startDate');
      const endDateParam = searchParams.get('endDate');
      const rangeParam = searchParams.get('range'); // "this_month", "last_month", "last_30_days", etc.
      const typeParam = searchParams.get('type'); // "INCOME" | "EXPENSE"
      const categoryParam = searchParams.get('category');
      const limitParam = parseInt(searchParams.get('limit') || '100', 10);

      // 2. Tentukan Rentang Waktu Terpilih & Periode Pembanding (MoM)
      const resolution = resolveDateRange({
        month: monthParam,
        startDate: startDateParam,
        endDate: endDateParam,
        range: rangeParam,
      });

      // Filter dasar untuk periode terpilih
      const whereCondition: any = {
        workspaceId,
        transactionDate: {
          gte: resolution.startDate,
          lte: resolution.endDate,
        },
      };

      if (typeParam && (typeParam === 'INCOME' || typeParam === 'EXPENSE')) {
        whereCondition.type = typeParam as TransactionType;
      }

      if (categoryParam) {
        whereCondition.category = categoryParam;
      }

      // 3. Ambil Transaksi & Hitung Agregasi Periode Terpilih
      const [periodTransactions, periodAggregates, prevAggregates, allTimeAggregates] = await Promise.all([
        // Daftar transaksi per periode
        prisma.cashTransaction.findMany({
          where: whereCondition,
          orderBy: { transactionDate: 'desc' },
          take: Math.min(Math.max(limitParam, 1), 500),
        }),

        // Agregat periode saat ini
        prisma.cashTransaction.groupBy({
          by: ['type'],
          where: whereCondition,
          _sum: { amount: true },
          _count: { id: true },
        }),

        // Agregat periode sebelumnya (untuk MoM)
        prisma.cashTransaction.groupBy({
          by: ['type'],
          where: {
            workspaceId,
            transactionDate: {
              gte: resolution.previousRange.startDate,
              lte: resolution.previousRange.endDate,
            },
            ...(typeParam === 'INCOME' || typeParam === 'EXPENSE' ? { type: typeParam as TransactionType } : {}),
            ...(categoryParam ? { category: categoryParam } : {}),
          },
          _sum: { amount: true },
        }),

        // Saldo kumulatif hingga batas akhir periode ini
        prisma.cashTransaction.groupBy({
          by: ['type'],
          where: {
            workspaceId,
            transactionDate: {
              lte: resolution.endDate,
            },
          },
          _sum: { amount: true },
        }),
      ]);

      // Ekstraksi angka periode terpilih
      let totalIncome = 0;
      let totalExpense = 0;
      let incomeCount = 0;
      let expenseCount = 0;

      for (const agg of periodAggregates) {
        if (agg.type === TransactionType.INCOME) {
          totalIncome = agg._sum.amount || 0;
          incomeCount = agg._count.id || 0;
        } else {
          totalExpense = agg._sum.amount || 0;
          expenseCount = agg._count.id || 0;
        }
      }

      const netCashBalance = totalIncome - totalExpense;

      // Ekstraksi angka periode sebelumnya
      let prevIncome = 0;
      let prevExpense = 0;
      for (const agg of prevAggregates) {
        if (agg.type === TransactionType.INCOME) {
          prevIncome = agg._sum.amount || 0;
        } else {
          prevExpense = agg._sum.amount || 0;
        }
      }
      const prevNetCash = prevIncome - prevExpense;

      // Ekstraksi saldo kumulatif kas hingga akhir periode
      let allTimeInc = 0;
      let allTimeExp = 0;
      for (const agg of allTimeAggregates) {
        if (agg.type === TransactionType.INCOME) {
          allTimeInc = agg._sum.amount || 0;
        } else {
          allTimeExp = agg._sum.amount || 0;
        }
      }
      const cumulativeCashBalance = allTimeInc - allTimeExp;

      // 4. Hitung Metrik Pertumbuhan MoM (Month-over-Month)
      const incomeMoM = calculateMoM(totalIncome, prevIncome);
      const expenseMoM = calculateMoM(totalExpense, prevExpense);
      const netMoM = calculateMoM(netCashBalance, prevNetCash);

      return NextResponse.json({
        success: true,
        period: {
          key: resolution.periodKey,
          label: resolution.periodLabel,
          startDate: resolution.startDate.toISOString(),
          endDate: resolution.endDate.toISOString(),
          isCurrentMonth: resolution.isCurrentMonth,
          comparisonPeriodLabel: resolution.previousRange.periodLabel,
        },
        summary: {
          totalIncome,
          totalExpense,
          netCashBalance,
          cumulativeCashBalance,
          // Count harus berasal dari agregasi penuh, bukan panjang page yang sedang
          // ditampilkan. Kalau ada 500+ transaksi, KPI tetap benar.
          transactionCount: incomeCount + expenseCount,
          incomeCount,
          expenseCount,
          mom: {
            income: incomeMoM,
            expense: expenseMoM,
            netCash: netMoM,
          },
        },
        transactions: periodTransactions,
      });
    } catch (err: any) {
      console.error('[Transactions API Error]:', err);
      return NextResponse.json({ message: publicApiError('Gagal memuat data transaksi kas. Coba lagi beberapa saat.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Catat transaksi kas baru (Masuk / Keluar atau Batch Import)
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();

      // Pintu 4 & 11: Dukungan batch import mutasi bank & silsilah data sourceFileId
      const rawBatch = Array.isArray(body) ? body : Array.isArray(body.batch) ? body.batch : null;
      const batchSourceFileId = typeof body?.sourceFileId === 'string' ? body.sourceFileId : null;
      if (rawBatch && rawBatch.length > 0) {
        const validRows = rawBatch
          .filter((row: any) => row && (row.amount != null || row.nominal != null || row.kredit != null || row.debit != null))
          .map((row: any) => {
            const rawType = String(row.type || (row.kategori === 'INCOME' || row.pemasukan ? 'INCOME' : 'EXPENSE')).toUpperCase();
            const type = rawType === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE;
            const amount = Math.abs(Number(row.amount ?? row.nominal ?? row.kredit ?? row.debit ?? 0));
            const category = String(row.category || row.kategori || (type === TransactionType.INCOME ? 'Penjualan' : 'Operasional')).trim();
            const description = String(row.description || row.keterangan || 'Mutasi Bank Terimpor').trim();
            const paymentMethod = row.paymentMethod || 'TRANSFER_BANK';
            const rawDate = row.transactionDate || row.tanggal || row.date;
            const sourceFileId = (typeof row?.sourceFileId === 'string' ? row.sourceFileId : batchSourceFileId) || null;
            let validDate = new Date();
            if (rawDate) {
              // Dukung format tanggal DD/MM/YYYY
              if (typeof rawDate === 'string' && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate.trim())) {
                const [d, m, y] = rawDate.trim().split('/').map(Number);
                validDate = new Date(y, m - 1, d);
              } else {
                const parsed = new Date(rawDate);
                if (!isNaN(parsed.getTime())) validDate = parsed;
              }
            }

            return {
              workspaceId: auth.workspace.id,
              userId: auth.user.id,
              sourceFileId,
              type,
              category,
              amount,
              description,
              paymentMethod,
              transactionDate: validDate,
            };
          })
          .filter((row: any) => row.amount > 0);

        if (validRows.length === 0) {
          return NextResponse.json({ message: 'Tidak ada baris transaksi yang valid dalam batch.' }, { status: 400 });
        }

        const created = await prisma.cashTransaction.createMany({
          data: validRows,
        });

        invalidateContextCache(auth.workspace.id);
        void invalidateDashboardInsightCache(auth.workspace.id);

        return NextResponse.json({
          success: true,
          message: `${created.count} transaksi kas berhasil diimpor ke database.`,
          count: created.count,
        });
      }

      const { type, category, amount, description, paymentMethod = 'TRANSFER_BANK', transactionDate, sourceFileId } = body;

      if (!type || !category || !amount || !description) {
        return NextResponse.json({ message: 'Type (INCOME/EXPENSE), kategori, nominal, dan deskripsi wajib diisi.' }, { status: 400 });
      }

      if (Number(amount) <= 0) {
        return NextResponse.json({ message: 'Nominal transaksi harus lebih besar dari 0.' }, { status: 400 });
      }

      // V4f, 8 Sep 2026 -- tanggal transaksi dicek HANYA kalau diisi (kosong tetap
      // pakai default new Date() existing di bawah, yang selalu valid).
      if (transactionDate) {
        const transactionDateError = checkBusinessDate(transactionDate, 'Tanggal transaksi');
        if (transactionDateError) {
          return NextResponse.json({ message: transactionDateError }, { status: 400 });
        }
      }

      const transaction = await prisma.cashTransaction.create({
        data: {
          workspaceId: auth.workspace.id,
          userId: auth.user.id,
          sourceFileId: typeof sourceFileId === 'string' ? sourceFileId : null,
          type: type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE,
          category,
          amount: Number(amount),
          description,
          paymentMethod,
          transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
        },
      });

      invalidateContextCache(auth.workspace.id);
      void invalidateDashboardInsightCache(auth.workspace.id);

      return NextResponse.json({
        success: true,
        message: `Transaksi ${type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} sebesar Rp ${Number(amount).toLocaleString('id-ID')} berhasil dicatat.`,
        transaction,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Transaksi kas gagal disimpan. Periksa data dan coba lagi.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// DELETE: Hapus transaksi kas (spesifik per id atau seluruh transaksi workspace)
export const DELETE = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { searchParams } = req.nextUrl;
      const id = searchParams.get('id');
      const all = searchParams.get('all') === 'true' || searchParams.get('clear') === 'true';

      if (all) {
        const approvalRequest = await createApprovalRequest({
          workspaceId: auth.workspace.id,
          requesterRole: auth.membership.role,
          requesterName: auth.user.fullName || auth.user.email,
          actionType: 'PURGE_CASH',
          title: 'Hapus Seluruh Transaksi Kas',
          description: 'Menghapus seluruh transaksi kas workspace. Invoice tidak ikut dihapus.',
          originalPrompt: 'DELETE /api/v1/kas/transactions?all=true',
        });
        return NextResponse.json({
          success: false,
          code: 'APPROVAL_REQUIRED',
          requiresApproval: true,
          approvalRequest,
          message: 'Penghapusan seluruh transaksi kas ditahan sampai tiket disetujui Owner/CEO.',
        }, { status: 202 });
      }

      if (!id) {
        return NextResponse.json({ message: 'Parameter id transaksi atau all=true wajib disertakan.' }, { status: 400 });
      }

      await prisma.cashTransaction.delete({
        where: {
          id,
          workspaceId: auth.workspace.id,
        },
      });

      invalidateContextCache(auth.workspace.id);
      void invalidateDashboardInsightCache(auth.workspace.id);

      return NextResponse.json({
        success: true,
        message: 'Transaksi berhasil dihapus.',
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Transaksi kas gagal dihapus. Coba lagi beberapa saat.') }, { status: 500 });
    }
  },
  { minRole: 'MEMBER' }
);
