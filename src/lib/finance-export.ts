// Berkas BARU milik tim AI (ZONA HIJAU) -- deterministic xlsx builder untuk tombol
// Ekspor Excel di FinanceModuleView.tsx. TIDAK memanggil AI/LLM apapun: fungsi ini
// murni menyalin angka yang SUDAH dihitung/diambil dari backend (summary, transaksi,
// invoice) ke dalam sel spreadsheet, byte-per-byte deterministik untuk input yang sama.
//
// KENAPA tidak lewat generation-engine.ts (mesin dokumen AI Brain milik Fatur):
// generateExcelDoc() di sana memanggil LLM (generateStructuredJson) untuk MENGARANG isi
// sheet dari sebuah "brief" teks bebas -- cocok untuk "bikinin laporan dari deskripsi",
// TAPI salah alat untuk ekspor buku besar transaksi asli: menyalurkan angka keuangan
// nyata lewat langkah re-generasi LLM membuka risiko persis kelas bug yang menggagalkan
// demo (angka berubah/salah karena AI, bukan karena data). Modul ini memakai library
// yang sama filosofinya (paket 'xlsx' / SheetJS, sudah jadi dependency proyek dan sudah
// dipakai Fatur secara read-only di ai-brain/ledger-parser.ts) tapi tanpa AI di jalurnya
// sama sekali -- transkripsi data ke sel, bukan generasi konten.
//
// Dipakai dari 'use client' component (FinanceModuleView.tsx) via dynamic import supaya
// tidak membengkakkan bundle awal halaman, dan bisa diuji langsung di Node (tests/) tanpa
// DOM karena fungsi ini tidak menyentuh document/window/Blob sama sekali.

import * as XLSX from 'xlsx';

export interface FinanceExportSummary {
  cashBalance: number;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  grossMargin: number;
  runwayMonths: number;
  // Ditambahkan setelah wiring runway asli di FinanceModuleView.tsx (loadRealData):
  // runwayMonths cuma valid kalau net-burn 30 hari > 0 (ada dasar proyeksi). Kalau false,
  // runwayMonths di atas adalah placeholder 0, BUKAN angka nyata -- sheet Ringkasan wajib
  // menulis "Belum bisa dihitung" di baris ini, pola yang sama dipakai widget PPN masukan.
  // Optional supaya kompatibel ke belakang (pemanggil/tes lama yang belum kirim field ini
  // tetap dianggap tersedia, konsisten dengan perilaku sebelum flag ini ada).
  runwayAvailable?: boolean;
}

export interface FinanceExportTransaction {
  createdAt: string;
  type: string;
  category: string;
  description: string;
  amount: number;
}

export interface FinanceExportInvoice {
  invoiceNumber: string;
  clientName: string;
  dueDate: string;
  status: string;
  amount: number;
}

export interface FinanceExportInput {
  workspaceName: string;
  generatedAt: Date;
  summary: FinanceExportSummary;
  transactions: FinanceExportTransaction[];
  invoices: FinanceExportInvoice[];
}

/**
 * Bangun workbook .xlsx ASLI (format OOXML/ZIP yang sama dipakai Excel/Google Sheets),
 * dari data yang sudah dihitung sebelumnya -- tidak mengarang, tidak memanggil AI.
 * Return ArrayBuffer siap dibungkus Blob di sisi browser, atau ditulis langsung ke disk
 * di sisi Node (dipakai test).
 *
 * Catatan kejujuran: sheet Ringkasan HANYA berisi label + angka mentah dari `summary`,
 * TANPA komentar/analisis editorial ("prima", "risiko nol", "+28.5% MoM", dst) --
 * versi HTML-menyamar-xls sebelumnya menempelkan narasi pujian yang dikarang (tidak
 * berasal dari perhitungan apapun) di kolom "Keterangan & Analisis Strategis". Itu
 * dihapus di sini, bukan dipindah -- kalau sebuah metrik (mis. grossMargin/runwayMonths)
 * belum pernah dihitung di tempat lain pada sistem ini, nilainya tetap ditampilkan apa
 * adanya (angka yang benar-benar ada di state), tidak dibungkus klaim kualitatif palsu.
 */
export function buildFinanceLedgerWorkbook(input: FinanceExportInput): ArrayBuffer {
  const wb = XLSX.utils.book_new();

  // --- Sheet 1: Ringkasan ---
  const tanggalEkspor = input.generatedAt.toLocaleDateString('id-ID', { dateStyle: 'full' });
  // runwayAvailable default true kalau tidak dikirim (pemanggil lama) -- lihat komentar
  // di interface FinanceExportSummary. Kalau false, jangan tulis angka 0 seolah dihitung.
  const runwayAvailable = input.summary.runwayAvailable !== false;
  const summaryRows: Array<Array<string | number>> = [
    [`Laporan Keuangan - ${input.workspaceName || 'Perusahaan'}`],
    [`Sumber: KLIR Financial OS. Tanggal ekspor: ${tanggalEkspor}`],
    [],
    ['Indikator', 'Nominal (IDR)'],
    ['Saldo Kas Tersedia', input.summary.cashBalance],
    ['Total Pemasukan', input.summary.totalIncome],
    ['Total Pengeluaran', input.summary.totalExpense],
    ['Arus Kas Bersih', input.summary.netCashflow],
    ['Margin Laba Kotor (%)', input.summary.grossMargin],
    [
      'Ketahanan Kas / Runway (bulan)',
      runwayAvailable ? input.summary.runwayMonths : 'Belum bisa dihitung (belum ada net-burn bulan ini)',
    ],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 34 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // --- Sheet 2: Buku besar transaksi kas ---
  const txHeader = ['Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Pemasukan (Rp)', 'Pengeluaran (Rp)'];
  const txRows: Array<Array<string | number>> = input.transactions.map((tx) => {
    const isIncome = tx.type === 'INCOME';
    return [
      tx.createdAt,
      tx.type,
      tx.category,
      tx.description,
      isIncome ? tx.amount : '',
      !isIncome ? tx.amount : '',
    ];
  });
  const totalIncomeRow = ['', '', '', 'TOTAL', input.summary.totalIncome, input.summary.totalExpense];
  const wsTx = XLSX.utils.aoa_to_sheet([txHeader, ...txRows, totalIncomeRow]);
  wsTx['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 36 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsTx, 'Transaksi Kas');

  // --- Sheet 3: Invoice & piutang ---
  const invHeader = ['Nomor Invoice', 'Nama Klien', 'Jatuh Tempo', 'Status', 'Nominal Tagihan (Rp)'];
  const invRows: Array<Array<string | number>> = input.invoices.map((inv) => [
    inv.invoiceNumber,
    inv.clientName,
    inv.dueDate,
    inv.status,
    inv.amount,
  ]);
  const wsInv = XLSX.utils.aoa_to_sheet([invHeader, ...invRows]);
  wsInv['!cols'] = [{ wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsInv, 'Invoice & Piutang');

  // SheetJS bisa mengembalikan Uint8Array ATAU ArrayBuffer tergantung environment --
  // dinormalisasi ke ArrayBuffer murni (byte demi byte, hormati byteOffset) supaya
  // pemanggil (Blob di browser, fs.writeFile/tes di Node) selalu dapat tipe yang sama
  // dan konsisten dengan lib.dom.d.ts (BlobPart butuh ArrayBuffer, bukan ArrayBufferLike).
  const out: unknown = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const bytes = out instanceof Uint8Array ? out : new Uint8Array(out as ArrayBuffer);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

/** Nama berkas konsisten dengan pola lama (Laporan_Keuangan_<workspace>_<tanggal>.xlsx). */
export function financeExportFileName(workspaceName: string | undefined, date: Date): string {
  const dateStr = date.toISOString().split('T')[0];
  const safeName = (workspaceName || 'Perusahaan').replace(/\s+/g, '_');
  return `Laporan_Keuangan_${safeName}_${dateStr}.xlsx`;
}
