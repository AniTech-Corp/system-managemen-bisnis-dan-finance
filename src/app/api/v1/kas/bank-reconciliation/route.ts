import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { reconcileBankStatement, type BankMutationInput, type CashTransactionInput } from '@/lib/ai-brain/bank-reconciliation';
import { publicApiError } from '@/lib/api-error';

// POST /api/v1/kas/bank-reconciliation
//
// Terima daftar mutasi bank yang SUDAH DIPARSE jadi array (bukan file mentah -- parsing
// upload .xlsx/.pdf/.csv itu sendiri DI LUAR SCOPE endpoint ini per instruksi tugas;
// infrastruktur upload generik (mis. generic-table-ledger.ts / workspace-files) belum
// disambungkan ke sini, jadi body request WAJIB berupa array `mutations` yang siap pakai.
// Fokus endpoint ini murni FUNGSI PENCOCOKAN deterministik (lihat bank-reconciliation.ts)
// terhadap CashTransaction WORKSPACE INI SAJA (withTenantGuard) -- READ-ONLY, tidak pernah
// menulis/mengubah CashTransaction (skemanya juga tidak disentuh sama sekali).
//
// Body:
//   {
//     "mutations": [
//       { "rowNo": 1, "date": "2026-09-01", "description": "Transfer masuk", "amount": 500000 },
//       { "rowNo": 2, "date": "2026-09-02", "description": "Bayar sewa", "amount": -100000 }
//     ],
//     "startDate": "2026-09-01",   // opsional -- batas bawah pencarian CashTransaction
//     "endDate": "2026-09-30",     // opsional -- batas atas pencarian CashTransaction
//     "dateToleranceDays": 0,      // opsional, default 0
//     "amountTolerance": 0         // opsional, default 0
//   }
//
// `amount` bertanda: positif = uang MASUK ke rekening bank, negatif = uang KELUAR --
// lihat JSDoc BankMutationInput di bank-reconciliation.ts untuk aturan lengkapnya
// (termasuk cara menggabungkan kalau sumbernya 2 kolom debit/kredit terpisah).

interface RawMutationBody {
  rowNo?: number | null;
  date?: unknown;
  description?: unknown;
  amount?: unknown;
}

function validateMutationsPayload(mutations: unknown): { ok: true; parsed: BankMutationInput[] } | { ok: false; message: string } {
  if (!Array.isArray(mutations)) {
    return { ok: false, message: '`mutations` wajib berupa array.' };
  }
  if (mutations.length === 0) {
    return { ok: false, message: '`mutations` tidak boleh kosong.' };
  }
  if (mutations.length > 5000) {
    return { ok: false, message: '`mutations` melebihi batas 5000 baris per request.' };
  }

  const parsed: BankMutationInput[] = [];
  for (let i = 0; i < mutations.length; i++) {
    const raw = mutations[i] as RawMutationBody;
    if (!raw || typeof raw !== 'object') {
      return { ok: false, message: `mutations[${i}] bukan objek yang valid.` };
    }
    parsed.push({
      rowNo: typeof raw.rowNo === 'number' ? raw.rowNo : i + 1,
      dateRaw: raw.date,
      description: typeof raw.description === 'string' ? raw.description : '',
      amount: typeof raw.amount === 'number' ? raw.amount : NaN,
    });
  }
  return { ok: true, parsed };
}

export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  try {
    const workspaceId: string = auth.workspace.id;

    if (!workspaceId) {
      return NextResponse.json({ message: 'Workspace ID tidak ditemukan.' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ message: 'Body request bukan JSON valid.' }, { status: 400 });
    }

    const validation = validateMutationsPayload(body?.mutations);
    if (!validation.ok) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const dateToleranceDays =
      typeof body?.dateToleranceDays === 'number' && body.dateToleranceDays >= 0 ? body.dateToleranceDays : 0;
    const amountTolerance =
      typeof body?.amountTolerance === 'number' && body.amountTolerance >= 0 ? body.amountTolerance : 0;

    // Rentang pencarian CashTransaction: kalau startDate/endDate tidak dikasih, ambil
    // dari rentang tanggal mutasi bank itu sendiri (parse cepat -- baris yang gagal
    // diparse tetap kelewat direntang ini, tidak masalah karena akan berakhir di
    // invalidBankRows dan tidak pernah ikut query CashTransaction manapun).
    const explicitStart = typeof body?.startDate === 'string' ? new Date(body.startDate) : null;
    const explicitEnd = typeof body?.endDate === 'string' ? new Date(body.endDate) : null;

    let rangeStart = explicitStart && !isNaN(explicitStart.getTime()) ? explicitStart : null;
    let rangeEnd = explicitEnd && !isNaN(explicitEnd.getTime()) ? explicitEnd : null;

    if (!rangeStart || !rangeEnd) {
      const dateValues = validation.parsed
        .map((m) => (typeof m.dateRaw === 'string' ? new Date(m.dateRaw) : m.dateRaw instanceof Date ? m.dateRaw : null))
        .filter((d): d is Date => d !== null && !isNaN(d.getTime()));
      if (dateValues.length > 0) {
        const minTime = Math.min(...dateValues.map((d) => d.getTime()));
        const maxTime = Math.max(...dateValues.map((d) => d.getTime()));
        // Buffer 1 hari di kedua sisi untuk menampung toleransi dateToleranceDays +
        // perbedaan zona waktu antara parse cepat di sini vs parseIndonesianDate() di
        // dalam bank-reconciliation.ts (yang lebih permisif format-nya).
        const bufferMs = (dateToleranceDays + 1) * 24 * 3600 * 1000;
        if (!rangeStart) rangeStart = new Date(minTime - bufferMs);
        if (!rangeEnd) rangeEnd = new Date(maxTime + bufferMs);
      }
    }

    const cashTransactionsRaw = await prisma.cashTransaction.findMany({
      where: {
        workspaceId,
        ...(rangeStart && rangeEnd ? { transactionDate: { gte: rangeStart, lte: rangeEnd } } : {}),
      },
      select: {
        id: true,
        transactionDate: true,
        type: true,
        amount: true,
        description: true,
        category: true,
      },
      orderBy: { transactionDate: 'asc' },
    });

    const cashTransactions: CashTransactionInput[] = cashTransactionsRaw.map((tx) => ({
      id: tx.id,
      transactionDate: tx.transactionDate,
      type: tx.type,
      amount: tx.amount,
      description: tx.description,
      category: tx.category,
    }));

    const result = reconcileBankStatement(validation.parsed, cashTransactions, {
      dateToleranceDays,
      amountTolerance,
    });

    return NextResponse.json({
      workspaceId,
      summary: result.summary,
      cocok: result.cocok,
      adaDiBankTidakDiCatatan: result.adaDiBankTidakDiCatatan,
      adaDiCatatanTidakDiBank: result.adaDiCatatanTidakDiBank,
      invalidBankRows: result.invalidBankRows,
    });
  } catch (error: any) {
    console.error('Bank Reconciliation Error:', error);
    return NextResponse.json(
      { message: publicApiError('Gagal menjalankan rekonsiliasi bank.') },
      { status: 500 },
    );
  }
});
