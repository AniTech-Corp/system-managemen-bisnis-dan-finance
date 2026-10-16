/**
 * FASE BUILD 7 Sep 2026 -- Integrasi data upload -> Buku Kas/dashboard.
 * Fix untuk integrasi-01 (KRITIS: Pusat Data tidak pernah lewat ledger-parser),
 * integrasi-02 (KRITIS: tidak ada jalur tulis ke CashTransaction), dan integrasi-04
 * (SEDANG: linkedRecordIds ada di schema tapi tidak pernah ditulis).
 *
 * Modul ini SATU-SATUNYA titik pemakaian parseLedgerWorkbook/validateLedger untuk
 * jalur Pusat Data (workspace-files) -- dipakai dari DUA tempat:
 *  1. workspace-files/route.ts POST -- enrichment `extractedSummary` (blok ANGKA
 *     TERVERIFIKASI, sama filosofi dengan wiring KELOMPOK 4 di documents/extract-
 *     text/route.ts untuk jalur chat attachment) supaya AI chat (via
 *     getAccumulatedCompanyKnowledge) tidak lagi menebak angka dari teks mentah
 *     untuk file yang diupload lewat Pusat Data.
 *  2. workspace-files/[id]/import-ledger/route.ts -- "Impor ke Buku Kas": ubah
 *     Transaction[] hasil parse jadi baris CashTransaction siap ditulis.
 *
 * DIDUPLIKASI (bukan pindah logic) dari pola yang identik di documents/extract-
 * text/route.ts (fungsi tryParseStructuredLedgerForExtractText) -- SENGAJA, karena
 * extract-text/route.ts BUKAN bagian dari lane file agent ini (batas file
 * eksklusif tugas), jadi tidak boleh disentuh untuk menghindari collision dengan
 * agent lain yang mungkin sedang mengerjakannya paralel. Kalau heuristik "dikenali
 * sebagai ledger" berubah di sana, sinkronkan manual ke sini juga -- sudah dicatat
 * sebagai technical debt di temuan integrasi-05.
 *
 * KETERBATASAN JUJUR (integrasi-03, lihat laporan agent): parseLedgerWorkbook cuma
 * mengenali SATU template spesifik (sheet "kode posting" + sheet ber-nama "kas"
 * dengan kolom TARIKH/URAIAN/KODE/DEBET/KREDIT/SALDO) -- diuji langsung ke fixture
 * PT Makan Mania Mantap (laporan-penjualan-bulanan.xlsx, daftar-transaksi-mentah.csv,
 * dll) dan HASILNYA TIDAK DIKENALI (chartOfAccounts.size=0). Fungsi-fungsi di sini
 * TIDAK mengubah itu -- mereka cuma menyambungkan parser yang SUDAH ADA ke Pusat
 * Data, bukan memperluas cakupan formatnya (itu scope pengembangan terpisah yang
 * butuh keputusan manusia, lihat integrasi-03 di gapTidakDitambal).
 *
 * UPDATE (build B4, 7 Sep 2026 malam): keterbatasan di atas sekarang punya JALUR KEDUA
 * -- tryDetectGenericLedgerForWorkspaceFile() di bawah, fallback heuristik kolom generik
 * (bukan template chart-of-accounts) yang dipakai import-ledger/route.ts HANYA kalau
 * jalur klasik gagal. Lihat generic-table-ledger.ts untuk detail lengkap + alasan tiap
 * keputusan desain. Jalur klasik di atas TIDAK diubah sama sekali (100% additive).
 */

import { parseLedgerWorkbook, validateLedger, type DiscrepancyReport, type ParsedLedger } from '@/lib/ai-brain';
// FASE B4 build 7 Sep 2026 -- jalur KEDUA (fallback) kalau file BUKAN ledger klasik
// (chart-of-accounts + sheet "kas"). Lihat JSDoc lengkap di generic-table-ledger.ts.
// Import langsung dari file-nya (BUKAN lewat barrel '@/lib/ai-brain') SENGAJA -- barrel
// index.ts itu di luar file_milik agent ini, jangan disentuh supaya tidak tabrakan
// dengan agent lain yang mungkin sedang mengerjakannya paralel di sesi yang sama.
import { detectGenericLedger, type GenericLedgerDetectionResult } from '@/lib/ai-brain/generic-table-ledger';

export interface StructuredLedgerSummary {
  periode: { mulai: string | null; akhir: string | null };
  sheetPrimer: string | null;
  jumlahTransaksi: number;
  totalPerKode: Array<{ kode: number; namaAkun: string | null; debit: number; credit: number }>;
  totalPendapatan: number | null;
  totalBiaya: number | null;
  labaOperasional: number | null;
  zakat: number | null;
  labaBersih: number | null;
  saldoAkhir: number | null;
}

/** Sama persis dengan syarat "dikenali sebagai ledger" di documents/extract-text/route.ts
 *  (tryParseStructuredLedgerForExtractText) -- WAJIB tetap identik supaya file yang sama
 *  dianggap konsisten dikenali/tidak-dikenali di kedua jalur (Pusat Data vs chat). */
export function isRecognizedLedgerWorkbook(parsed: ParsedLedger): boolean {
  return parsed.chartOfAccounts.size > 0 && Object.keys(parsed.transactionsBySheet).length > 0;
}

/**
 * Parse buffer xlsx/xls jadi ringkasan terstruktur + laporan diskrepansi. Return `null`
 * (non-fatal) kalau bukan xlsx/xls, bukan ledger yang dikenali, atau parsing melempar
 * error apapun -- pemanggil WAJIB memperlakukan null sebagai "lanjut jalur biasa",
 * BUKAN error yang menggagalkan upload.
 */
export function tryParseWorkspaceFileAsLedger(
  fileName: string,
  buffer: Buffer
): { parsed: ParsedLedger; structuredLedger: StructuredLedgerSummary; discrepancies: DiscrepancyReport } | null {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') return null;

  try {
    const parsed = parseLedgerWorkbook(buffer);
    if (!isRecognizedLedgerWorkbook(parsed)) return null;

    const report = validateLedger(parsed);
    const primarySheet = report.computed.primarySheet;
    const primaryTx = primarySheet ? parsed.transactionsBySheet[primarySheet] || [] : [];
    const periodeMulai = primaryTx.length > 0 ? primaryTx[0].dateIso : null;
    const periodeAkhir = primaryTx.length > 0 ? primaryTx[primaryTx.length - 1].dateIso : null;

    const totalPerKode = Object.entries(report.computed.kodeAggregates).map(([kodeStr, agg]) => {
      const kode = Number(kodeStr);
      return {
        kode,
        namaAkun: parsed.chartOfAccounts.get(kode) ?? null,
        debit: agg.debit,
        credit: agg.credit,
      };
    });

    const structuredLedger: StructuredLedgerSummary = {
      periode: { mulai: periodeMulai, akhir: periodeAkhir },
      sheetPrimer: primarySheet,
      jumlahTransaksi: report.computed.transactionCount,
      totalPerKode,
      totalPendapatan: report.computed.totalPendapatan,
      totalBiaya: report.computed.totalBiaya,
      labaOperasional: report.computed.labaOperasional,
      zakat: report.computed.zakat,
      labaBersih: report.computed.labaBersih,
      saldoAkhir: report.computed.saldoAkhir,
    };

    return { parsed, structuredLedger, discrepancies: report };
  } catch (err) {
    console.warn('[workspace-file-ledger] parseLedgerWorkbook/validateLedger gagal (non-fatal):', err);
    return null;
  }
}

/**
 * FASE B4 (7 Sep 2026) -- jalur KEDUA. Dipanggil oleh import-ledger/route.ts HANYA
 * setelah tryParseWorkspaceFileAsLedger() di atas mengembalikan `null` (bukan ledger
 * klasik) -- jalur klasik TETAP JALAN DULU dan TIDAK diubah sama sekali oleh fungsi ini,
 * murni fallback additive. Menerima xlsx/xls/csv (gate ekstensi lebih luas dari fungsi
 * klasik yang cuma xlsx/xls -- lihat detectGenericLedger untuk alasan tiap ekstensi).
 * Return `null` (non-fatal) kalau ekstensi di luar cakupan atau deteksi melempar error
 * tak terduga -- pemanggil WAJIB memperlakukan null sama seperti "tidak dikenali",
 * BUKAN error yang menggagalkan preview/impor.
 */
export function tryDetectGenericLedgerForWorkspaceFile(fileName: string, buffer: Buffer): GenericLedgerDetectionResult | null {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls' && ext !== 'csv') return null;
  try {
    return detectGenericLedger(buffer, fileName);
  } catch (err) {
    console.warn('[workspace-file-ledger] detectGenericLedger gagal (non-fatal):', err);
    return null;
  }
}

function formatRupiah(n: number | null | undefined): string {
  return `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;
}

function formatRupiahOrUnknown(n: number | null | undefined): string {
  return n === null || n === undefined ? 'tidak diketahui (sheet laba-rugi tidak ditemukan di dokumen)' : formatRupiah(n);
}

/**
 * Blok teks "ANGKA TERVERIFIKASI" -- disisipkan di AWAL summary yang disimpan ke
 * WorkspaceFile.extractedSummary DAN company-memory, sama filosofi dengan wiring
 * KELOMPOK 4 di documents/extract-text/route.ts: LLM dilarang menebak angka dari teks
 * mentah kalau angka terverifikasi program sudah tersedia.
 */
export function buildVerifiedNumbersBlock(structuredLedger: StructuredLedgerSummary, report: DiscrepancyReport): string {
  const periodeText =
    structuredLedger.periode.mulai && structuredLedger.periode.akhir
      ? `${structuredLedger.periode.mulai} s.d. ${structuredLedger.periode.akhir}`
      : 'tidak diketahui';
  const totalPerKodeLines = structuredLedger.totalPerKode
    .map((k) => `  - ${k.namaAkun || `Kode ${k.kode}`} (kode ${k.kode}): debit ${formatRupiah(k.debit)}, kredit ${formatRupiah(k.credit)}`)
    .join('\n');
  const discrepancyLines =
    report.discrepancies.length > 0
      ? report.discrepancies.map((d) => `  - [${d.severity}] ${d.explanation}`).join('\n')
      : '  - Tidak ada diskrepansi terdeteksi antara angka tertulis di dokumen dan hasil hitung ulang sistem.';

  const lines: string[] = [
    '===== ANGKA TERVERIFIKASI (dihitung PROGRAM secara deterministik dari isi berkas ini, BUKAN oleh AI) =====',
    'PERINGATAN UNTUK MODEL AI: angka di blok ini WAJIB dipakai apa adanya. DILARANG KERAS',
    'menghitung ulang, menebak, membulatkan, atau "mengoreksi" angka finansial dari dokumen',
    'ini -- HANYA jelaskan persis angka yang tertulis di blok ini.',
    '',
    `- Periode: ${periodeText}`,
    `- Jumlah transaksi: ${structuredLedger.jumlahTransaksi}`,
    `- Total Pendapatan (hitung ulang): ${formatRupiahOrUnknown(structuredLedger.totalPendapatan)}`,
    `- Total Biaya (hitung ulang): ${formatRupiahOrUnknown(structuredLedger.totalBiaya)}`,
    `- Laba Operasional (hitung ulang): ${formatRupiahOrUnknown(structuredLedger.labaOperasional)}`,
    `- Laba Bersih (hitung ulang): ${formatRupiahOrUnknown(structuredLedger.labaBersih)}`,
    `- Saldo Akhir: ${structuredLedger.saldoAkhir != null ? formatRupiah(structuredLedger.saldoAkhir) : 'tidak diketahui'}`,
  ];
  if (totalPerKodeLines) lines.push(`- Rincian per kode akun:\n${totalPerKodeLines}`);
  lines.push('', 'DISKREPANSI YANG DITEMUKAN SISTEM:', discrepancyLines, '===== AKHIR BLOK ANGKA TERVERIFIKASI -- ISI DOKUMEN ASLI DI BAWAH INI =====');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// integrasi-02: konversi Transaction[] (buku kas) -> baris siap tulis ke
// prisma.cashTransaction.
// ---------------------------------------------------------------------------

export interface CashTransactionDraft {
  type: 'INCOME' | 'EXPENSE';
  category: string;
  amount: number;
  description: string;
  transactionDate: Date;
  sourceRowNo: number;
}

/**
 * Konvensi buku kas (BUKAN akuntansi debit/kredit per-akun umum): kolom DEBET di buku
 * kas = kas BERTAMBAH (uang masuk), kolom KREDIT = kas BERKURANG (uang keluar) --
 * diverifikasi langsung dari struktur fixture (mis. "Modal awal" debit 1.000.000 =
 * uang masuk, "Bayar Sewa Kantor" kredit 100.000 = uang keluar). Baris "Saldo Awal"
 * (debit=0 & credit=null, lihat contoh di tests/ledger-wiring.test.ts) dan baris
 * lain bernilai 0 SENGAJA dilewati -- endpoint /api/v1/kas/transactions menolak
 * `amount <= 0` (lihat route.ts baris 200-202), jadi baris begini tidak mungkin
 * ditulis sebagai transaksi kas yang valid.
 */
export function buildCashTransactionDraftsFromLedger(
  parsed: ParsedLedger,
  primarySheetName: string | null
): CashTransactionDraft[] {
  if (!primarySheetName) return [];
  const transactions = parsed.transactionsBySheet[primarySheetName] || [];
  const drafts: CashTransactionDraft[] = [];

  for (const tx of transactions) {
    const debit = tx.debit ?? 0;
    const credit = tx.credit ?? 0;
    const amount = debit > 0 ? debit : credit > 0 ? credit : 0;
    if (amount <= 0) continue; // baris "Saldo Awal"/nol -- bukan transaksi kas yang bisa dicatat (lihat JSDoc di atas)

    const type: 'INCOME' | 'EXPENSE' = debit > 0 ? 'INCOME' : 'EXPENSE';
    // Kolom CashTransaction.category = VarChar(100) di schema Prisma (lane Fatur, tidak
    // diubah). Nama akun dari sheet bisa lebih panjang -> potong di sini supaya insert
    // tidak gagal di tengah transaksi atomik.
    const category = (
      tx.kode !== null && parsed.chartOfAccounts.has(tx.kode)
        ? parsed.chartOfAccounts.get(tx.kode)!
        : 'Impor Buku Kas (kode akun tidak dikenal)'
    ).slice(0, 100);

    drafts.push({
      type,
      category,
      amount,
      description: tx.description || `Transaksi baris ${tx.rowNo} (${primarySheetName})`,
      transactionDate: tx.dateIso ? new Date(tx.dateIso) : new Date(),
      sourceRowNo: tx.rowNo,
    });
  }
  return drafts;
}
