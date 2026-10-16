/**
 * Rekonsiliasi bank deterministik.
 *
 * Sibling ledger-parser.ts -- SAMA FILOSOFI: NOL panggilan LLM untuk mencocokkan angka.
 * Ini bukan saran, ini pelajaran langsung dari bug demo 5 Sep 2026 (AI KLIR salah baca
 * laporan keuangan 2 order-magnitude karena dokumen ditempel mentah ke prompt LLM lalu
 * LLM MENEBAK angka -- lihat komentar pembuka ledger-parser.ts untuk detail insidennya).
 * Pencocokan mutasi-bank vs catatan-kas di sini murni kode: bandingkan tanggal + nominal
 * + arah (masuk/keluar), tidak ada model bahasa yang dilibatkan sama sekali.
 *
 * Parsing tanggal REUSE date-normalizer.ts (parseIndonesianDate) -- SENGAJA TIDAK menulis
 * parser tanggal baru di sini, sama seperti alasan ledger-parser.ts (hindari duplikasi
 * jalur baca tanggal, kelas masalah M-895 soal fungsi yang sempat dobel).
 *
 * Modul ini TIDAK menyentuh Prisma / database sama sekali -- murni fungsi transformasi
 * (input: mutasi bank yang sudah diparse dari Excel/PDF di lapisan lain, + daftar
 * CashTransaction workspace yang sudah dibaca route.ts). Itu supaya bisa dites tanpa
 * koneksi DB (lihat tests/bank-reconciliation.test.ts, murni data sintetis).
 */

import { parseIndonesianDate } from './date-normalizer';

// ---------------------------------------------------------------------------
// Tipe publik
// ---------------------------------------------------------------------------

/** Arah mutasi -- MASUK = uang masuk ke rekening bank (setara CashTransaction.type
 *  INCOME), KELUAR = uang keluar dari rekening (setara CashTransaction.type EXPENSE). */
export type MutationDirection = 'MASUK' | 'KELUAR';

/**
 * Satu baris mutasi bank MENTAH, sebagaimana datang dari lapisan parsing upload
 * (Excel/PDF -> array). `dateRaw` melewati parseIndonesianDate() yang sama dipakai
 * ledger-parser.ts -- boleh Date, angka serial Excel, atau string tanggal Indonesia.
 * `amount` BERTANDA (signed): positif = uang masuk, negatif = uang keluar -- ini pola
 * paling umum di mutasi rekening koran (satu kolom nominal, bukan dua kolom debet/kredit
 * terpisah kayak buku kas UMKM). Kalau sumbernya sudah 2 kolom terpisah (debit/kredit),
 * pemanggil WAJIB menggabungkan jadi satu angka bertanda SEBELUM masuk sini (kredit
 * positif, debit negatif) -- bukan tanggung jawab modul ini menebak dari nama kolom.
 */
export interface BankMutationInput {
  /** Nomor baris asli di sumber (Excel row / index array), untuk audit -- opsional,
   *  dipakai apa adanya kalau ada, atau null kalau pemanggil tidak melacaknya. */
  rowNo?: number | null;
  dateRaw: unknown;
  description: string;
  /** Bertanda: positif = MASUK, negatif = KELUAR. Nol ditolak (bukan mutasi nyata --
   *  lihat parseBankMutations). */
  amount: number;
}

/** Mutasi bank yang tanggalnya BERHASIL diparse -- siap dicocokkan. */
export interface ParsedBankMutation {
  rowNo: number | null;
  dateIso: string;
  dateRaw: unknown;
  description: string;
  /** Nilai absolut (selalu positif) -- arahnya sudah dipisah ke `direction`. */
  amount: number;
  direction: MutationDirection;
}

/** Baris mutasi bank yang GAGAL diparse tanggalnya (mis. "31/02/2026") ATAU nominalnya
 *  nol/tidak valid -- dipertahankan (bukan dibuang diam-diam) supaya kelihatan di laporan,
 *  sama prinsipnya dengan InvalidTransactionRow di ledger-parser.ts. */
export interface InvalidBankMutationRow {
  rowNo: number | null;
  dateRaw: unknown;
  description: string;
  amount: number;
  reason: string;
}

/** Bentuk minimal CashTransaction yang dibutuhkan modul ini -- route.ts memetakan hasil
 *  `prisma.cashTransaction.findMany()` ke bentuk ini (murni field yang dipakai, supaya
 *  modul ini TIDAK bergantung pada @prisma/client -- bisa dites tanpa Prisma sama sekali). */
export interface CashTransactionInput {
  id: string;
  transactionDate: Date | string;
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  category: string;
}

/** Satu pasangan yang berhasil dicocokkan otomatis. */
export interface MatchedPair {
  bankMutation: ParsedBankMutation;
  cashTransaction: CashTransactionInput;
  /** Selisih tanggal dalam hari (0 = tanggal persis sama). */
  dateDiffDays: number;
  /** Selisih nominal absolut (0 = persis sama; > 0 hanya mungkin kalau dalam toleransi
   *  pembulatan yang diizinkan opsi `amountTolerance`). */
  amountDiff: number;
}

/** Mutasi bank yang KEMUNGKINAN kelewat dicatat di buku kas -- ada di rekening bank,
 *  tidak ada pasangannya di CashTransaction. */
export interface UnmatchedBankMutation {
  bankMutation: ParsedBankMutation;
}

/** CashTransaction yang KEMUNGKINAN salah catat atau duplikat -- ada di buku kas,
 *  tidak ada pasangannya di mutasi bank yang diupload. */
export interface UnmatchedCashTransaction {
  cashTransaction: CashTransactionInput;
}

export interface ReconciliationOptions {
  /** Toleransi selisih tanggal (hari) yang masih dianggap "tanggal sama" -- default 0
   *  (persis sama hari). Berguna kalau bank posting H+1 dari tanggal transaksi dicatat
   *  di buku kas internal. */
  dateToleranceDays?: number;
  /** Toleransi selisih nominal (rupiah, nilai absolut) untuk "cocok karena pembulatan" --
   *  default 0 (harus persis sama). Contoh: bank mencatat 149999 karena biaya admin
   *  dipotong di sisi lain, sementara buku kas mencatat 150000 bulat. */
  amountTolerance?: number;
}

export interface ReconciliationResult {
  cocok: MatchedPair[];
  adaDiBankTidakDiCatatan: UnmatchedBankMutation[];
  adaDiCatatanTidakDiBank: UnmatchedCashTransaction[];
  invalidBankRows: InvalidBankMutationRow[];
  /** Ringkasan angka -- dihitung ulang dari array di atas (bukan dihitung terpisah),
   *  supaya tidak ada dua sumber kebenaran yang bisa divergen (pelajaran ledger-validator.ts:
   *  angka ringkasan HARUS diturunkan dari data, bukan dikarang/dihitung independen). */
  summary: {
    totalBankMutations: number;
    totalCashTransactions: number;
    matchedCount: number;
    unmatchedBankCount: number;
    unmatchedCashCount: number;
    invalidBankRowCount: number;
  };
}

// ---------------------------------------------------------------------------
// Tahap 1: parse mutasi bank mentah -> ParsedBankMutation[] + InvalidBankMutationRow[]
// ---------------------------------------------------------------------------

/**
 * Parse daftar mutasi bank mentah jadi bentuk siap-cocok. Baris ditolak (masuk
 * `invalid`, BUKAN ikut pencocokan) kalau: (a) tanggalnya gagal diparse
 * parseIndonesianDate(), atau (b) nominalnya 0/NaN/bukan angka finite -- nol bukan
 * mutasi nyata (kemungkinan baris kosong/separator ikut terbaca dari Excel/PDF).
 */
export function parseBankMutations(rows: BankMutationInput[]): {
  valid: ParsedBankMutation[];
  invalid: InvalidBankMutationRow[];
} {
  const valid: ParsedBankMutation[] = [];
  const invalid: InvalidBankMutationRow[] = [];

  for (const row of rows) {
    const rowNo = row.rowNo ?? null;
    const amount = typeof row.amount === 'number' ? row.amount : NaN;

    if (!Number.isFinite(amount) || amount === 0) {
      invalid.push({
        rowNo,
        dateRaw: row.dateRaw,
        description: row.description ?? '',
        amount: Number.isFinite(amount) ? amount : 0,
        reason: 'Nominal nol, bukan angka, atau tidak finite -- bukan mutasi nyata.',
      });
      continue;
    }

    const parsedDate = parseIndonesianDate(row.dateRaw);
    if (!parsedDate.iso) {
      invalid.push({
        rowNo,
        dateRaw: row.dateRaw,
        description: row.description ?? '',
        amount,
        reason: `Kolom tanggal berisi "${String(row.dateRaw)}" tapi tidak bisa diparse sebagai tanggal valid.`,
      });
      continue;
    }

    valid.push({
      rowNo,
      dateIso: parsedDate.iso,
      dateRaw: row.dateRaw,
      description: row.description ?? '',
      amount: Math.abs(amount),
      direction: amount > 0 ? 'MASUK' : 'KELUAR',
    });
  }

  return { valid, invalid };
}

// ---------------------------------------------------------------------------
// Tahap 2: cocokkan ParsedBankMutation[] vs CashTransactionInput[]
// ---------------------------------------------------------------------------

function toDateIso(d: Date | string): string {
  if (typeof d === 'string') {
    // Sudah "YYYY-MM-DD..." (Prisma DateTime.toISOString() atau string ISO lain) --
    // ambil 10 karakter pertama, tidak perlu re-parse lewat parseIndonesianDate (itu
    // untuk input MENTAH dari upload, bukan data yang sudah tersimpan rapi di DB).
    return d.slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function dayDiff(isoA: string, isoB: string): number {
  const a = Date.parse(`${isoA}T00:00:00Z`);
  const b = Date.parse(`${isoB}T00:00:00Z`);
  return Math.abs(Math.round((a - b) / 86_400_000));
}

const DIRECTION_TO_TYPE: Record<MutationDirection, CashTransactionInput['type']> = {
  MASUK: 'INCOME',
  KELUAR: 'EXPENSE',
};

/**
 * Cocokkan mutasi bank vs catatan kas. Algoritma GREEDY deterministik: untuk tiap
 * mutasi bank (urut sesuai array input, stabil), cari SEMUA kandidat CashTransaction
 * yang (a) belum kepakai, (b) tipe-nya sesuai arah (MASUK->INCOME, KELUAR->EXPENSE),
 * (c) selisih tanggal <= dateToleranceDays, (d) selisih nominal <= amountTolerance --
 * lalu pilih kandidat dengan selisih PALING KECIL (nominal dulu, tanggal jadi
 * tie-breaker, lalu `id` string sebagai tie-breaker terakhir supaya hasilnya 100%
 * deterministik walau ada beberapa kandidat identik persis).
 *
 * Greedy per-bank-mutation (bukan optimal-assignment global) SENGAJA dipilih: transaksi
 * keuangan UMKM jarang punya banyak transaksi nominal+tanggal identik yang perlu
 * di-assign optimal secara global -- kompleksitas Hungarian algorithm tidak sepadan
 * untuk kasus ini, dan greedy jauh lebih mudah diaudit manusia ("kenapa X cocok
 * dengan Y" -> karena Y kandidat terdekat yang tersedia saat X diproses).
 */
export function matchBankMutations(
  bankMutations: ParsedBankMutation[],
  cashTransactions: CashTransactionInput[],
  options: ReconciliationOptions = {},
): {
  matched: MatchedPair[];
  unmatchedBank: UnmatchedBankMutation[];
  unmatchedCash: UnmatchedCashTransaction[];
} {
  const dateToleranceDays = options.dateToleranceDays ?? 0;
  const amountTolerance = options.amountTolerance ?? 0;

  const usedCashIds = new Set<string>();
  const matched: MatchedPair[] = [];
  const unmatchedBank: UnmatchedBankMutation[] = [];

  for (const bm of bankMutations) {
    const wantType = DIRECTION_TO_TYPE[bm.direction];
    let best: { tx: CashTransactionInput; dateDiff: number; amountDiff: number } | null = null;

    for (const tx of cashTransactions) {
      if (usedCashIds.has(tx.id)) continue;
      if (tx.type !== wantType) continue;

      const txDateIso = toDateIso(tx.transactionDate);
      const dDiff = dayDiff(bm.dateIso, txDateIso);
      if (dDiff > dateToleranceDays) continue;

      const aDiff = Math.abs(tx.amount - bm.amount);
      if (aDiff > amountTolerance) continue;

      if (
        !best ||
        aDiff < best.amountDiff ||
        (aDiff === best.amountDiff && dDiff < best.dateDiff) ||
        (aDiff === best.amountDiff && dDiff === best.dateDiff && tx.id < best.tx.id)
      ) {
        best = { tx, dateDiff: dDiff, amountDiff: aDiff };
      }
    }

    if (best) {
      usedCashIds.add(best.tx.id);
      matched.push({
        bankMutation: bm,
        cashTransaction: best.tx,
        dateDiffDays: best.dateDiff,
        amountDiff: best.amountDiff,
      });
    } else {
      unmatchedBank.push({ bankMutation: bm });
    }
  }

  const unmatchedCash: UnmatchedCashTransaction[] = cashTransactions
    .filter((tx) => !usedCashIds.has(tx.id))
    .map((tx) => ({ cashTransaction: tx }));

  return { matched, unmatchedBank, unmatchedCash };
}

// ---------------------------------------------------------------------------
// Entry point gabungan
// ---------------------------------------------------------------------------

/**
 * Entry point utama: parse mutasi bank mentah + cocokkan terhadap CashTransaction
 * workspace, hasilkan 3 kategori (COCOK / ADA_DI_BANK_TIDAK_DI_CATATAN /
 * ADA_DI_CATATAN_TIDAK_DI_BANK) plus baris mutasi bank yang gagal diparse.
 */
export function reconcileBankStatement(
  rawBankMutations: BankMutationInput[],
  cashTransactions: CashTransactionInput[],
  options: ReconciliationOptions = {},
): ReconciliationResult {
  const { valid, invalid } = parseBankMutations(rawBankMutations);
  const { matched, unmatchedBank, unmatchedCash } = matchBankMutations(valid, cashTransactions, options);

  return {
    cocok: matched,
    adaDiBankTidakDiCatatan: unmatchedBank,
    adaDiCatatanTidakDiBank: unmatchedCash,
    invalidBankRows: invalid,
    summary: {
      totalBankMutations: rawBankMutations.length,
      totalCashTransactions: cashTransactions.length,
      matchedCount: matched.length,
      unmatchedBankCount: unmatchedBank.length,
      unmatchedCashCount: unmatchedCash.length,
      invalidBankRowCount: invalid.length,
    },
  };
}
