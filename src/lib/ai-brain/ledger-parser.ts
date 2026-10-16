/**
 * Deterministic double-entry bookkeeping (buku kas) workbook parser.
 *
 * FASE 1 dari roadmap anti-halusinasi (2026-09-06-roadmap-analisis-data-enterprise-anti-halusinasi.md).
 * Motivasi langsung: demo ke calon klien pertama (5 Sep 2026) di mana AI KLIR salah baca laporan
 * keuangan 2 order-magnitude (37 juta vs 3 M) karena dokumen upload cuma ditempel jadi
 * TEKS mentah ke prompt LLM lalu LLM menebak angka (lihat
 * src/app/api/v1/documents/analyze/route.ts extractTextFromFile() dan
 * src/app/api/v1/documents/extract-text/route.ts extractTextFromBuffer() -- keduanya
 * "blind flattener", TIDAK paham semantik kolom).
 *
 * Modul ini TIDAK PERNAH memanggil LLM. Semua parsing murni kode (pola yang sama dengan
 * hpp-calculator.ts calculateHPP() -- deterministik, bisa diuji, tidak bisa berhalusinasi).
 * Konsumsi tanggal memakai date-normalizer.ts (parseIndonesianDate) yang sudah dibangun
 * paralel di sesi yang sama untuk FASE 2 -- sengaja TIDAK menulis parser tanggal baru di
 * sini supaya tidak duplikasi jalur baca (pelajaran M-895-class sesi ini soal
 * getRecentMistakeCorrections yang sempat dobel).
 *
 * Struktur workbook target (diverifikasi langsung dari fixture asli
 * PT-Tujuh-Mata-Air_jan14-okt15.xlsx, 11 sheet):
 *   - "kode posting"       : tabel statis 2 blok kolom (kode akun -> nama akun), BUKAN ledger.
 *   - sheet bernama mengandung "kas" (mis. "buku kas ", "buku kas  (2)") : ledger transaksi
 *     kronologis dengan kolom TARIKH/URAIAN/KODE/DEBET/KREDIT/SALDO. Baris footer/subtotal/
 *     tanda-tangan TIDAK punya TARIKH valid -- itulah cara membedakannya dari transaksi asli
 *     (jangan pernah anggap "ada sel terisi di baris itu" = transaksi; sudah dibuktikan
 *     langsung menggandakan total kalau salah).
 *   - "depresiasi" / "amortisasi" : jadwal non-kas, header 2 baris (field label lalu label
 *     bulan "Jan`14".."Okt`15"), baris JUMLAH menandai akhir daftar aset.
 *   - "cash flow"          : dua kolom sisi (Pemasukan kiri, Pengeluaran kanan) + footer
 *     CATATAN (saldo bank / dana tunai / jumlah kas dan bank).
 *   - "laba-rugi " / "neraca" : sheet turunan (hasil AGREGASI dari buku kas + jadwal non-kas),
 *     bukan data mentah -- diparse apa adanya jadi LabelValueEntry[], validasi silang
 *     terhadap hitungan ulang dilakukan di ledger-validator.ts, BUKAN di sini.
 *
 * Sheet lain (mis. "cover", "Rek Bank", "piutang") sengaja TIDAK diparse jadi struktur
 * khusus pada modul ini -- di luar scope FASE 1/3 yang diminta (ledger + validator inti);
 * dicatat di laporan agent sebagai keterbatasan/ide pengembangan lanjutan, bukan diputuskan
 * sendiri untuk skip permanen.
 */

import * as XLSX from 'xlsx';
import { parseIndonesianDate } from './date-normalizer';

// ---------------------------------------------------------------------------
// Tipe publik
// ---------------------------------------------------------------------------

export interface Transaction {
  /** Nomor baris Excel 1-based (bukan index array 0-based). */
  rowNo: number;
  sheet: string;
  /** Tanggal ISO "YYYY-MM-DD" hasil parseIndonesianDate(), atau null kalau baris ini
   *  ternyata tidak valid sebagai transaksi (harusnya tidak pernah terjadi karena baris
   *  tanpa TARIKH valid sudah difilter sebelum masuk array ini). */
  dateIso: string | null;
  /** Nilai mentah asli sel TARIKH -- disimpan untuk audit/debug. */
  dateRaw: unknown;
  description: string;
  kode: number | null;
  debit: number | null;
  credit: number | null;
  runningBalance: number | null;
}

/**
 * Baris yang jelas MENCOBA jadi transaksi (kolom TARIKH-nya berisi sesuatu, bukan
 * kosong) tapi gagal diparse jadi tanggal valid -- mis. "31/02/2024" (tanggal
 * mustahil). BERBEDA dari baris footer/subtotal/tanda-tangan yang kolom TARIKH-nya
 * memang KOSONG (itu tetap dilewati diam-diam seperti sebelumnya, bukan noise).
 *
 * Bug ditemukan Codex 2026-09-06: sebelumnya baris begini DIBUANG total oleh
 * parseLedgerSheet (parsedDate.iso null -> `continue`), jadi nominalnya hilang
 * tanpa jejak dari agregasi DAN tidak pernah sampai ke detectDateAnomalies()
 * (yang sebenarnya sudah punya kelas 'impossible-date' persis untuk kasus ini).
 * Sekarang baris begini TETAP DIPERTAHANKAN di sini (bukan masuk Transaction[])
 * supaya ledger-validator.ts bisa melaporkannya sebagai anomali tanggal, TANPA
 * ikut ke agregasi finansial mana pun.
 */
export interface InvalidTransactionRow {
  rowNo: number;
  sheet: string;
  /** Nilai mentah asli sel TARIKH yang gagal diparse. */
  dateRaw: unknown;
  description: string;
}

export interface DepreciationItem {
  rowNo: number;
  nama: string | null;
  kode: number | null;
  biaya: number | null;
  tempoBulan: number | null;
  nilaiPerBulan: number | null;
  /** Nilai per kolom bulanan, urut sejajar dengan `monthLabels` induknya. */
  monthlyValues: number[];
}

export interface DepreciationSchedule {
  sheet: string;
  /** Label kolom bulanan apa adanya dari sheet, mis. "Jan`14".."Okt`15". */
  monthLabels: string[];
  items: DepreciationItem[];
  /** Total BIAYA dari baris JUMLAH (basis penuh sebelum dibagi bulan). */
  totalBiaya: number | null;
  /** Total per kolom bulan dari baris JUMLAH -- SUM(array ini) = nilai yang seharusnya
   *  muncul di laba-rugi sebagai beban depresiasi/amortisasi periode berjalan (BUKAN
   *  totalBiaya, yang mana itu basis penuh aset, bukan akumulasi-sampai-sekarang). */
  totalPerBulan: number[];
}

export interface LabelValueEntry {
  rowNo: number;
  /** Gabungan semua sel teks di baris itu (selain kolom KODE/JUMLAH), apa adanya --
   *  bisa berupa label detail ("Penjualan Barang Umum") atau label subtotal/section
   *  ("Jumlah", "A Belanja Barang Modal", "LABA / RUGI  OPERASIONAL"). */
  label: string;
  kode: number | null;
  value: number | null;
}

export interface CashFlowLine {
  rowNo: number;
  label: string;
  kode: number | null;
  value: number | null;
}

export interface CashFlowSheet {
  sheet: string;
  pemasukan: CashFlowLine[];
  pengeluaran: CashFlowLine[];
  jumlahPemasukan: number | null;
  jumlahPengeluaran: number | null;
  /** Baris CATATAN di bagian bawah (mis. "Saldo di Bank", "Dana Tunai", "Jumlah Kas dan Bank"). */
  catatan: { label: string; value: number }[];
}

export interface ParsedLedger {
  sheetNames: string[];
  /** Peta kode akun (2-3 digit) -> nama akun, dari sheet "kode posting". */
  chartOfAccounts: Map<number, string>;
  /** Semua sheet yang namanya mengandung "kas" (case-insensitive), diparse jadi Transaction[]. */
  transactionsBySheet: Record<string, Transaction[]>;
  /** Baris di sheet "kas" yang jelas mencoba jadi transaksi tapi tanggalnya gagal
   *  diparse (lihat InvalidTransactionRow) -- dikunci per nama sheet, sejajar dengan
   *  transactionsBySheet. TIDAK ikut agregasi finansial mana pun; ledger-validator.ts
   *  melaporkannya sebagai anomali tanggal (kind 'impossible-date'). */
  invalidRows: Record<string, InvalidTransactionRow[]>;
  /** Sheet depresiasi/amortisasi, dikunci oleh nama sheet aslinya. */
  depreciationSchedules: Record<string, DepreciationSchedule>;
  /** Sheet turunan (laba-rugi/neraca/dll yang berbentuk URAIAN+JUMLAH), dikunci nama sheet. */
  statementSheets: Record<string, LabelValueEntry[]>;
  /** Sheet cash flow, dikunci nama sheet. */
  cashFlowSheets: Record<string, CashFlowSheet>;
  /** Catatan parsing (sheet dilewati, header tidak ketemu, dll) -- transparansi, bukan error fatal. */
  warnings: string[];
  /** Sinyal mentah untuk deteksi "data basi" (template lama dipakai ulang) di
   *  ledger-validator.ts -- dikumpulkan di sini karena butuh akses ke sel mentah tiap
   *  sheet yang tidak disimpan lagi setelah diklasifikasi jadi struktur di atas. */
  metadata: {
    /** Nama entitas yang muncul di sheet "kode posting" (mis. " HQQ Co."), kalau ada. */
    staleCompanyNameCandidates: string[];
    /** Nama entitas kanonik dari sheet "cover" (mis. "PT. CONTOH SEJAHTERA"), kalau ada. */
    canonicalCompanyNameCandidates: string[];
    /** Tanda tangan tanggal ("Kota, DD Bulan YYYY") yang ditemukan di sheet "kode posting". */
    kodePostingDateSignatures: string[];
    /** Tanda tangan tanggal yang sama tapi dari sheet LAIN (laba-rugi/neraca/dst) --
     *  ini yang dianggap tanggal laporan yang sebenarnya. */
    reportDateSignatures: string[];
  };
}

// ---------------------------------------------------------------------------
// Helper generik
// ---------------------------------------------------------------------------

type Row = unknown[];

/** Normalisasi header: uppercase + buang semua karakter selain A-Z/0-9. Menyatukan
 *  variasi spasi ("U R A I A N" -> "URAIAN") dan tanda baca ("NO." -> "NO"). */
function normalizeHeaderCell(v: unknown): string {
  return typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
}

/**
 * Parsing angka tahan format Indonesia (titik ribuan, koma desimal) DAN format umum
 * lainnya (koma ribuan, titik desimal) -- dokumen bookkeeping Indonesia sering campur
 * gaya sesuai siapa yang mengetik. Angka yang sudah bertipe `number` (kasus paling umum
 * di file ini karena SheetJS sudah membaca sel numerik sebagai number) dikembalikan
 * langsung tanpa modifikasi.
 */
export function parseIndoNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (!s) return null;
  s = s.replace(/^Rp\.?\s*/i, '').replace(/\s/g, '');
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s);
  if (negative) s = s.slice(1, -1);

  const hasDot = s.includes('.');
  const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      // pola Indonesia: titik = ribuan, koma = desimal -- "1.234.567,89"
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // pola Barat: koma = ribuan, titik = desimal -- "1,234,567.89"
      s = s.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    const commaCount = (s.match(/,/g) || []).length;
    s = commaCount > 1 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasDot) {
    const dotCount = (s.match(/\./g) || []).length;
    if (dotCount > 1) {
      s = s.replace(/\./g, '');
    } else {
      const parts = s.split('.');
      // "1.234" gaya Indonesia (titik ribuan, tepat 3 digit setelahnya) vs "1.23" desimal asli.
      if (parts[1] && parts[1].length === 3) s = s.replace('.', '');
    }
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function sheetRows(wb: XLSX.WorkBook, sheetName: string): Row[] {
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, defval: null }) as Row[];
}

/**
 * PENGERASAN (2026-09-06, riset database HR enterprise babak 2, pola #1 "sentinel kosong
 * ganda"): tabel dunia nyata mencampur SPASI TUNGGAL dan literal teks "NULL" sebagai
 * penanda "sel ini kosong" di kolom yang sama -- bukan cuma null/undefined/'' JS biasa.
 * Sebelum fungsi ini ada, `rawDate !== null && rawDate !== undefined && rawDate !== ''`
 * di parseLedgerSheet() TIDAK mengenali ' ' atau 'NULL' sebagai "kosong", sehingga baris
 * footer/subtotal/tanda-tangan yang kolom TARIKH-nya kebetulan berisi salah satu sentinel
 * itu (bukan benar-benar diketik kosong) SALAH diklasifikasi sebagai "percobaan tanggal
 * yang gagal diparse" (InvalidTransactionRow + warning "impossible-date" palsu) -- padahal
 * baris itu memang tidak pernah mencoba jadi transaksi sama sekali.
 */
function isEmptySentinelCell(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return true;
    if (t.toUpperCase() === 'NULL') return true;
  }
  return false;
}

/**
 * PENGERASAN (pola #3 "konsep sama, tipe data beda antar sheet/baris"): kolom KODE
 * seharusnya berisi angka (2-3 digit, lihat parseKodePostingSheet), tapi ditemukan di
 * data dunia nyata bisa ketik sebagai TEKS ("61" bukan 61) kalau kolom Excel-nya kebetulan
 * berformat Text -- sebelum fungsi ini, seluruh baris/aset dengan KODE bertipe string
 * SENYAP dianggap null (tidak match `typeof x === 'number'`), yang berarti (a) transaksi
 * ledger tidak ikut agregasi per-kode ledger-validator.ts (bisa menyembunyikan discrepancy
 * yang sebenarnya harusnya terdeteksi), dan (b) baris ITEM ASET di jadwal depresiasi
 * dibuang total dari `items[]` tanpa jejak (lihat `typeof kodeVal !== 'number' -> continue`
 * yang lama). Angka yang ditulis sebagai teks digit murni ("61") TIDAK ambigu -- ini bukan
 * menebak, cuma menerima representasi lain dari nilai yang sama persis.
 *
 * SENGAJA TIDAK dipakai di parseKodePostingSheet(): di sana kode & label section
 * ("1.", "Pendapatan") tercampur di sel yang sama secara struktural, jadi menerima
 * string apa pun yang "kelihatan seperti angka" berisiko salah menangkap label section
 * sebagai kode akun (ambigu sungguhan) -- beda dari sini yang selalu berada di kolom
 * KODE bernama eksplisit hasil deteksi header.
 */
function parseCodeCellTracked(v: unknown, tracker: { any: boolean }): number | null {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  if (typeof v === 'string') {
    const t = v.trim();
    if (/^\d+$/.test(t)) {
      tracker.any = true;
      return Number(t);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sinyal data-basi (dikumpulkan mentah di sini, dianalisis di ledger-validator.ts)
// ---------------------------------------------------------------------------

const COMPANY_PT_RE = /\bPT\.?\s+[A-Z][A-Za-z. ]{2,60}/;
const COMPANY_CO_RE = /\b[A-Z][A-Za-z]{1,30}\s+Co\.?\s*$/;
// "Kota, DD Bulan YYYY" -- pola tanda-tangan penutup dokumen bookkeeping Indonesia,
// dipakai untuk membandingkan tahun template kode-posting vs tahun laporan sebenarnya.
const DATE_SIGNATURE_RE = /^[A-Za-z .]{2,40},\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}$/;

function collectDateSignatures(rows: Row[]): string[] {
  const found: string[] = [];
  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell === 'string' && DATE_SIGNATURE_RE.test(cell.trim())) {
        found.push(cell.trim());
      }
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// (a) "kode posting" -- chart of accounts statis, 2 blok kolom
// ---------------------------------------------------------------------------

/**
 * Sheet "kode posting" bukan ledger -- tidak ada header TARIKH/URAIAN sama sekali, hanya
 * 2 blok kolom (kiri & kanan) berisi pasangan (kode, nama akun) plus baris judul section
 * ("1.","Permodalan", dst) yang HARUS dilewati. Deteksi generik: scan SEMUA sel workbook-
 * lebar untuk pasangan (angka bulat 1-999, diikuti langsung string non-kosong di kolom
 * sebelahnya) -- pola ini otomatis menangkap kedua blok tanpa hardcode huruf kolom B/C/D
 * vs I/J/K, dan otomatis melewati baris judul section karena label section selalu string
 * ("1.", "5.") bukan number, jadi tidak pernah match sebagai "kode".
 */
function parseKodePostingSheet(rows: Row[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const row of rows) {
    for (let c = 0; c < row.length - 1; c++) {
      const kode = row[c];
      const nama = row[c + 1];
      if (
        typeof kode === 'number' &&
        Number.isInteger(kode) &&
        kode > 0 &&
        kode < 1000 &&
        typeof nama === 'string' &&
        nama.trim()
      ) {
        if (!map.has(kode)) map.set(kode, nama.trim());
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// (c) sheet ledger ("buku kas", dst) -- deteksi header otomatis via kolom TARIKH
// ---------------------------------------------------------------------------

const LEDGER_HEADER_KEYS = ['NO', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'] as const;

/**
 * PENGERASAN (pola #6 "pergeseran penamaan kolom antar berkas untuk konsep yang sama"):
 * `normalizeHeaderCell` sudah menyatukan variasi SPASI/tanda-baca ("U R A I A N" ->
 * "URAIAN"), tapi tidak menyatukan SINONIM kata yang beda sama sekali untuk konsep yang
 * sama -- "Tarikh" adalah istilah regional/arsip untuk "Tanggal" (fixture asli calon
 * klien pertama pakai "Tarikh", tapi dokumen buku kas UMKM lain pada umumnya pakai
 * "Tanggal"/"Tgl"). Sebelum peta ini ada, sheet ledger yang headernya persis sama
 * strukturnya tapi memakai "TANGGAL" bukan "TARIKH" GAGAL TOTAL dikenali sebagai ledger
 * (findLedgerHeaderRow return null, seluruh sheet dilewati) -- padahal cuma beda LABEL,
 * bukan beda struktur data. Sinonim yang diterima di sini SEMUANYA tidak ambigu (istilah
 * baku akuntansi Indonesia untuk konsep yang sama persis) -- setiap kali sinonim (bukan
 * label asli) dipakai, WAJIB dicatat sebagai warning transparansi (lihat parseLedgerSheet)
 * supaya tidak jadi "menebak diam-diam".
 */
const HEADER_SYNONYMS: Record<string, (typeof LEDGER_HEADER_KEYS)[number]> = {
  NO: 'NO',
  TARIKH: 'TARIKH',
  TANGGAL: 'TARIKH',
  TGL: 'TARIKH',
  URAIAN: 'URAIAN',
  KETERANGAN: 'URAIAN',
  DESKRIPSI: 'URAIAN',
  KODE: 'KODE',
  DEBET: 'DEBET',
  DEBIT: 'DEBET',
  KREDIT: 'KREDIT',
  CREDIT: 'KREDIT',
  SALDO: 'SALDO',
};

function findLedgerHeaderRow(
  rows: Row[],
): { rowIdx: number; colMap: Partial<Record<(typeof LEDGER_HEADER_KEYS)[number], number>>; synonymsUsed: string[] } | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let tarikhIdx = -1;
    for (let c = 0; c < row.length; c++) {
      if (HEADER_SYNONYMS[normalizeHeaderCell(row[c])] === 'TARIKH') {
        tarikhIdx = c;
        break;
      }
    }
    if (tarikhIdx === -1) continue;
    const colMap: Partial<Record<(typeof LEDGER_HEADER_KEYS)[number], number>> = {};
    const synonymsUsed: string[] = [];
    for (let c = 0; c < row.length; c++) {
      const norm = normalizeHeaderCell(row[c]);
      const canonical = HEADER_SYNONYMS[norm];
      if (canonical && colMap[canonical] === undefined) {
        colMap[canonical] = c;
        if (norm !== canonical) synonymsUsed.push(`"${norm}"->${canonical}`);
      }
    }
    return { rowIdx: r, colMap, synonymsUsed };
  }
  return null;
}

/**
 * Parse satu sheet ledger jadi Transaction[]. Baris dianggap transaksi ASLI hanya kalau
 * kolom TARIKH-nya berhasil diparse jadi tanggal valid (parseIndonesianDate().iso !== null)
 * -- BUKAN "ada sel terisi di baris itu". Aturan ini terbukti krusial: baris footer JUMLAH
 * / baris subtotal per-kode ("N Total") / baris tanda tangan penutup semuanya punya sel
 * DEBET/KREDIT terisi tapi TARIKH kosong -- kalau difilter pakai "any cell non-null" maka
 * baris-baris itu ikut ke-hitung sebagai transaksi dan MENGGANDAKAN total (reproduced live
 * saat scan fixture: sheet 'piutang' tanpa filter TARIKH menghasilkan total 2x lipat).
 */
function parseLedgerSheet(
  rows: Row[],
  sheetName: string,
  warnings: string[],
): { transactions: Transaction[]; invalidRows: InvalidTransactionRow[] } {
  const header = findLedgerHeaderRow(rows);
  if (!header) {
    warnings.push(`Sheet "${sheetName}": tidak ditemukan baris header ledger (kolom TARIKH) -- dilewati.`);
    return { transactions: [], invalidRows: [] };
  }
  const { rowIdx, colMap, synonymsUsed } = header;
  if (synonymsUsed.length > 0) {
    warnings.push(
      `Sheet "${sheetName}": header ledger memakai label kolom non-standar (${synonymsUsed.join(', ')}) -- dikenali sebagai sinonim yang sudah dikenal, tapi verifikasi manual disarankan kalau labelnya ternyata berarti lain dari yang diasumsikan.`,
    );
  }
  const transactions: Transaction[] = [];
  const invalidRows: InvalidTransactionRow[] = [];
  const codeAsTextTracker = { any: false };
  for (let r = rowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const rawDate = colMap.TARIKH !== undefined ? row[colMap.TARIKH] : null;
    const parsedDate = parseIndonesianDate(rawDate);
    const descCell =
      colMap.URAIAN !== undefined && typeof row[colMap.URAIAN] === 'string' ? (row[colMap.URAIAN] as string).trim() : '';
    if (!parsedDate.iso) {
      // Kolom TARIKH benar-benar kosong (null/undefined/'' ATAU sentinel kosong lain
      // yang dipakai campur di dunia nyata seperti ' ' atau literal 'NULL', lihat
      // isEmptySentinelCell) = footer/subtotal/spacer/tanda-tangan, BUKAN transaksi --
      // lewati diam-diam seperti sebelumnya, tidak ada isi yang hilang karena memang
      // tidak pernah ada percobaan tanggal di baris itu. Kolom TARIKH berisi SESUATU
      // tapi gagal diparse (mis. "31/02/2024") = percobaan transaksi dengan tanggal
      // mustahil -- WAJIB dipertahankan sebagai InvalidTransactionRow (bukan dibuang
      // total) supaya ledger-validator.ts bisa melaporkannya sebagai anomali
      // 'impossible-date', bukan lenyap tanpa jejak.
      if (!isEmptySentinelCell(rawDate)) {
        invalidRows.push({ rowNo: r + 1, sheet: sheetName, dateRaw: rawDate, description: descCell });
        warnings.push(
          `Sheet "${sheetName}" baris ${r + 1}: kolom TARIKH berisi "${String(rawDate)}" tapi tidak bisa diparse sebagai tanggal valid -- baris DIKECUALIKAN dari agregasi finansial dan dilaporkan sebagai anomali tanggal, bukan dibuang diam-diam.`,
        );
      }
      continue;
    }

    const kodeRaw = colMap.KODE !== undefined ? row[colMap.KODE] : null;
    const kode = parseCodeCellTracked(kodeRaw, codeAsTextTracker);

    transactions.push({
      rowNo: r + 1,
      sheet: sheetName,
      dateIso: parsedDate.iso,
      dateRaw: rawDate,
      description: descCell,
      kode,
      debit: colMap.DEBET !== undefined ? parseIndoNumber(row[colMap.DEBET]) : null,
      credit: colMap.KREDIT !== undefined ? parseIndoNumber(row[colMap.KREDIT]) : null,
      runningBalance: colMap.SALDO !== undefined ? parseIndoNumber(row[colMap.SALDO]) : null,
    });
  }
  if (codeAsTextTracker.any) {
    warnings.push(
      `Sheet "${sheetName}": kolom KODE berisi kode dalam bentuk TEKS (bukan angka) pada sebagian baris -- otomatis dikonversi ke angka, tapi tipe data yang tidak seragam untuk konsep yang sama sebaiknya dirapikan di sumber.`,
    );
  }
  if (transactions.length === 0 && invalidRows.length === 0) {
    warnings.push(
      `Sheet "${sheetName}": header ledger ditemukan tapi NOL baris transaksi valid -- kemungkinan sheet ini kosong/wadah-dekoi (data asli mungkin ada di sheet lain, pola umum "tabel bernama jelas ternyata kosong") atau memang periode tanpa transaksi. Verifikasi manual sebelum dianggap "tidak ada aktivitas".`,
    );
  }
  return { transactions, invalidRows };
}

// ---------------------------------------------------------------------------
// (d) depresiasi / amortisasi -- header 2 baris (field label, lalu label bulan)
// ---------------------------------------------------------------------------

function parseDepreciationSheet(rows: Row[], sheetName: string, warnings: string[]): DepreciationSchedule | null {
  let fieldRowIdx = -1;
  let namaCol = -1;
  let kodeCol = -1;
  let biayaCol = -1;
  let tempoCol = -1;
  let nilaiCol = -1;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let hasKode = false;
    let hasBiaya = false;
    const local: Record<string, number> = {};
    for (let c = 0; c < row.length; c++) {
      const norm = normalizeHeaderCell(row[c]);
      if (norm === 'KODE') {
        hasKode = true;
        local.KODE = c;
      } else if (norm === 'BIAYA') {
        hasBiaya = true;
        local.BIAYA = c;
      } else if (norm === 'NAMABARANG') {
        local.NAMA = c;
      } else if (norm.startsWith('TEMPO')) {
        local.TEMPO = c;
      } else if (norm.startsWith('NILAIPERBULAN')) {
        local.NILAI = c;
      }
    }
    if (hasKode && hasBiaya) {
      fieldRowIdx = r;
      namaCol = local.NAMA ?? -1;
      kodeCol = local.KODE;
      biayaCol = local.BIAYA;
      tempoCol = local.TEMPO ?? -1;
      nilaiCol = local.NILAI ?? -1;
      break;
    }
  }
  if (fieldRowIdx === -1) {
    warnings.push(`Sheet "${sheetName}": tidak ditemukan baris header field (KODE + BIAYA) -- dilewati.`);
    return null;
  }

  const monthRowIdx = fieldRowIdx + 1;
  const monthRow = rows[monthRowIdx] || [];
  const startScan = (nilaiCol >= 0 ? nilaiCol : biayaCol) + 1;
  const monthColIndices: number[] = [];
  const monthLabels: string[] = [];
  for (let c = startScan; c < monthRow.length; c++) {
    const cell = monthRow[c];
    if (typeof cell === 'string' && cell.trim()) {
      monthColIndices.push(c);
      monthLabels.push(cell.trim());
    }
  }

  const items: DepreciationItem[] = [];
  let totalBiaya: number | null = null;
  let totalPerBulan: number[] = [];
  const codeAsTextTracker = { any: false };

  for (let r = monthRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const namaCell = namaCol >= 0 ? row[namaCol] : null;
    if (typeof namaCell === 'string' && normalizeHeaderCell(namaCell) === 'JUMLAH') {
      totalBiaya = biayaCol >= 0 ? parseIndoNumber(row[biayaCol]) : null;
      totalPerBulan = monthColIndices.map((c) => parseIndoNumber(row[c]) ?? 0);
      break; // baris JUMLAH = akhir daftar aset
    }
    // Pola #3 (konsep sama, tipe data beda antar baris/sheet): KODE aset kadang ketik
    // sebagai teks ("5" bukan 5) kalau kolomnya berformat Text di Excel -- sebelumnya
    // baris begini DIBUANG TOTAL (`typeof kodeVal !== 'number' -> continue`), padahal
    // itu aset VALID yang cuma tipenya beda, bukan baris placeholder/spacer sungguhan
    // (placeholder sungguhan kolom KODE-nya kosong, bukan teks angka).
    const kodeVal = parseCodeCellTracked(row[kodeCol], codeAsTextTracker);
    if (kodeVal === null) continue; // baris placeholder/spacer, bukan aset valid
    items.push({
      rowNo: r + 1,
      nama: typeof namaCell === 'string' ? namaCell.trim() : null,
      kode: kodeVal,
      biaya: biayaCol >= 0 ? parseIndoNumber(row[biayaCol]) : null,
      tempoBulan: tempoCol >= 0 ? parseIndoNumber(row[tempoCol]) : null,
      nilaiPerBulan: nilaiCol >= 0 ? parseIndoNumber(row[nilaiCol]) : null,
      monthlyValues: monthColIndices.map((c) => parseIndoNumber(row[c]) ?? 0),
    });
  }

  if (codeAsTextTracker.any) {
    warnings.push(
      `Sheet "${sheetName}": kolom KODE berisi kode dalam bentuk TEKS (bukan angka) pada sebagian baris aset -- otomatis dikonversi ke angka, tapi tipe data yang tidak seragam sebaiknya dirapikan di sumber.`,
    );
  }
  if (items.length === 0) {
    warnings.push(
      `Sheet "${sheetName}": header jadwal depresiasi/amortisasi ditemukan tapi NOL baris aset -- kemungkinan sheet kosong/wadah-dekoi (data asli mungkin ada di sheet lain). Verifikasi manual.`,
    );
  }

  return { sheet: sheetName, monthLabels, items, totalBiaya, totalPerBulan };
}

// ---------------------------------------------------------------------------
// (e) sheet turunan (laba-rugi / neraca) -- header URAIAN + JUMLAH
// ---------------------------------------------------------------------------

function findStatementHeaderRow(rows: Row[]): { rowIdx: number; kodeCol: number; jumlahCol: number; usedUraianSynonym: string | null } | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let uraianCol = -1;
    let uraianSynonym: string | null = null;
    let kodeCol = -1;
    let jumlahCol = -1;
    for (let c = 0; c < row.length; c++) {
      const norm = normalizeHeaderCell(row[c]);
      // Pola #6: terima sinonim URAIAN yang sudah dikenal (lihat HEADER_SYNONYMS),
      // sama seperti sheet ledger -- sheet turunan (laba-rugi/neraca) sama-sama bisa
      // memakai label "KETERANGAN"/"DESKRIPSI" untuk konsep yang identik.
      if (HEADER_SYNONYMS[norm] === 'URAIAN' && uraianCol === -1) {
        uraianCol = c;
        if (norm !== 'URAIAN') uraianSynonym = norm;
      } else if (norm === 'KODE' && kodeCol === -1) kodeCol = c;
      else if (norm.startsWith('JUMLAH') && jumlahCol === -1) jumlahCol = c;
    }
    if (uraianCol !== -1 && jumlahCol !== -1) {
      return { rowIdx: r, kodeCol, jumlahCol, usedUraianSynonym: uraianSynonym };
    }
  }
  return null;
}

/**
 * Parse "apa adanya" (sesuai instruksi tugas): tiap baris jadi satu LabelValueEntry,
 * label = gabungan semua sel string di baris itu (selain kolom JUMLAH), kode = sel numerik
 * di kolom KODE (kalau sheet punya kolom itu -- neraca TIDAK punya kolom KODE sama sekali),
 * value = sel di kolom JUMLAH. TIDAK ada resolusi semantik/dedup label duplikat (mis. baris
 * "Jumlah" bisa muncul berkali-kali untuk section berbeda) -- disambiguasi berdasar konteks
 * jadi tanggung jawab pemanggil (ledger-validator.ts), yang punya akses ke kode dan urutan
 * baris untuk itu.
 */
function parseStatementSheet(
  rows: Row[],
  sheetName: string,
  warnings: string[],
): { entries: LabelValueEntry[]; headerFound: boolean } {
  const header = findStatementHeaderRow(rows);
  if (!header) {
    warnings.push(`Sheet "${sheetName}": tidak ditemukan baris header statement (URAIAN + JUMLAH) -- dilewati.`);
    return { entries: [], headerFound: false };
  }
  const { rowIdx, kodeCol, jumlahCol, usedUraianSynonym } = header;
  if (usedUraianSynonym) {
    warnings.push(
      `Sheet "${sheetName}": header statement memakai label kolom non-standar ("${usedUraianSynonym}"->URAIAN) -- dikenali sebagai sinonim, verifikasi manual disarankan.`,
    );
  }
  const entries: LabelValueEntry[] = [];
  const codeAsTextTracker = { any: false };
  for (let r = rowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const labelParts: string[] = [];
    for (let c = 0; c < row.length; c++) {
      if (c === jumlahCol) continue;
      const v = row[c];
      if (typeof v === 'string') {
        const t = v.trim();
        if (t && t !== '-') labelParts.push(t);
      }
    }
    const label = labelParts.join(' ').replace(/\s+/g, ' ').trim();
    const kode = kodeCol >= 0 ? parseCodeCellTracked(row[kodeCol], codeAsTextTracker) : null;
    const value = jumlahCol >= 0 ? parseIndoNumber(row[jumlahCol]) : null;
    if (!label && kode === null && value === null) continue; // baris kosong total
    entries.push({ rowNo: r + 1, label, kode, value });
  }
  if (codeAsTextTracker.any) {
    warnings.push(
      `Sheet "${sheetName}": kolom KODE berisi kode dalam bentuk TEKS (bukan angka) pada sebagian baris -- otomatis dikonversi ke angka, tapi tipe data yang tidak seragam sebaiknya dirapikan di sumber.`,
    );
  }
  if (entries.length === 0) {
    // BEDA dari "tidak ditemukan header sama sekali" di atas -- di sini headernya
    // KETEMU (URAIAN+JUMLAH), cuma nol baris data di bawahnya. Pola #4 (wadah bernama
    // jelas ternyata kosong): jangan disamakan diam-diam dengan "tidak cocok pola
    // manapun" di pemanggil (parseLedgerWorkbook), supaya sinyal "kosong/dekoi" ini
    // tidak hilang dari warnings.
    warnings.push(
      `Sheet "${sheetName}": header statement (URAIAN + JUMLAH) ditemukan tapi NOL baris data -- kemungkinan sheet kosong/wadah-dekoi (data asli mungkin ada di sheet lain), BUKAN berarti "tidak cocok pola manapun".`,
    );
  }
  return { entries, headerFound: true };
}

// ---------------------------------------------------------------------------
// cash flow -- dua blok sisi (Pemasukan / Pengeluaran) + footer CATATAN
// ---------------------------------------------------------------------------

/**
 * CATATAN PENTING (ditemukan langsung dari fixture asli): posisi kolom teks JUDUL
 * "Pemasukan"/"Pengeluaran" TIDAK selalu sejajar dengan posisi kolom DATA blok itu sendiri
 * -- pada fixture ini judul "Pengeluaran" ada di kolom index 7, tapi label/kode/value baris
 * data blok kanan sebenarnya mulai di kolom index 5 (kemungkinan quirk penempatan visual
 * manual di spreadsheet aslinya, bukan pola yang bisa diandalkan). Karena itu offset kolom
 * blok di bawah pakai struktur TETAP yang sudah diverifikasi langsung dari baris data
 * (blok kiri index 0-2, blok kanan index 5-7), dan pencarian teks "Pemasukan"/"Pengeluaran"
 * di sheet HANYA dipakai untuk menemukan baris header (supaya baris judul/basmalah di
 * atasnya ikut dilewati), bukan untuk menurunkan posisi kolom.
 */
function findCashFlowHeaderRow(rows: Row[]): number {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let hasPemasukan = false;
    let hasPengeluaran = false;
    for (const cell of row) {
      if (typeof cell === 'string') {
        const t = cell.trim().toLowerCase();
        if (t === 'pemasukan') hasPemasukan = true;
        if (t === 'pengeluaran') hasPengeluaran = true;
      }
    }
    if (hasPemasukan && hasPengeluaran) return r;
  }
  return -1;
}

function parseCashFlowSheet(rows: Row[], sheetName: string, warnings: string[]): CashFlowSheet | null {
  const headerRowIdx = findCashFlowHeaderRow(rows);
  if (headerRowIdx === -1) {
    warnings.push(`Sheet "${sheetName}": tidak ditemukan header Pemasukan/Pengeluaran -- dilewati.`);
    return null;
  }
  const pLabelCol = 0;
  const pKodeCol = 1;
  const pValueCol = 2;
  const kLabelCol = 5;
  const kKodeCol = 6;
  const kValueCol = 7;

  const pemasukan: CashFlowLine[] = [];
  const pengeluaran: CashFlowLine[] = [];
  let jumlahPemasukan: number | null = null;
  let jumlahPengeluaran: number | null = null;
  let jumlahRowIdx = -1;
  const codeAsTextTracker = { any: false };

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const pLabel = row[pLabelCol];
    if (typeof pLabel === 'string' && normalizeHeaderCell(pLabel) === 'JUMLAH') {
      jumlahPemasukan = parseIndoNumber(row[pValueCol]);
      jumlahPengeluaran = parseIndoNumber(row[kValueCol]);
      jumlahRowIdx = r;
      break;
    }
    if (typeof pLabel === 'string' && pLabel.trim()) {
      pemasukan.push({
        rowNo: r + 1,
        label: pLabel.trim(),
        kode: parseCodeCellTracked(row[pKodeCol], codeAsTextTracker),
        value: parseIndoNumber(row[pValueCol]),
      });
    }
    const kLabel = row[kLabelCol];
    if (typeof kLabel === 'string' && kLabel.trim()) {
      pengeluaran.push({
        rowNo: r + 1,
        label: kLabel.trim(),
        kode: parseCodeCellTracked(row[kKodeCol], codeAsTextTracker),
        value: parseIndoNumber(row[kValueCol]),
      });
    }
  }
  if (codeAsTextTracker.any) {
    warnings.push(
      `Sheet "${sheetName}": kolom KODE berisi kode dalam bentuk TEKS (bukan angka) pada sebagian baris -- otomatis dikonversi ke angka, tapi tipe data yang tidak seragam sebaiknya dirapikan di sumber.`,
    );
  }
  if (pemasukan.length === 0 && pengeluaran.length === 0) {
    warnings.push(
      `Sheet "${sheetName}": header Pemasukan/Pengeluaran ditemukan tapi NOL baris data pada kedua sisi -- kemungkinan sheet kosong/wadah-dekoi (data asli mungkin ada di sheet lain). Verifikasi manual.`,
    );
  }

  const catatan: { label: string; value: number }[] = [];
  if (jumlahRowIdx !== -1) {
    for (let r = jumlahRowIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const label = row[pLabelCol];
      const value = parseIndoNumber(row[pValueCol]);
      if (typeof label === 'string' && label.trim() && value !== null) {
        catatan.push({ label: label.trim().replace(/^-+\s*/, ''), value });
      }
    }
  }

  return { sheet: sheetName, pemasukan, pengeluaran, jumlahPemasukan, jumlahPengeluaran, catatan };
}

// ---------------------------------------------------------------------------
// Pola #5 -- sheet kembar/duplikat (pola khas "Sheet1" & "Sheet1 (2)")
// ---------------------------------------------------------------------------

/**
 * Sinyal NAMA: pola penamaan salinan default Excel/spreadsheet ("Nama" + " (2)", " (3)",
 * dst) -- kalau base-name-nya JUGA ada sebagai sheet lain di workbook yang sama, itu
 * sinyal kuat sheet ini adalah salinan/duplikat, bukan sengaja dipisah untuk periode/
 * kategori berbeda (yang biasanya dinamai eksplisit, bukan angka generik dalam kurung).
 * Murni berbasis NAMA -- tidak menyentuh isi sheet lain manapun, jadi aman dipanggil
 * untuk SEMUA sheet (bukan cuma yang sudah diklasifikasi jadi ledger/statement/dll).
 */
function detectDuplicateSheetNamePattern(sheetNames: string[], warnings: string[]): void {
  const baseNames = new Set(sheetNames.map((n) => n.trim().toLowerCase()));
  for (const name of sheetNames) {
    const m = /^(.*?)\s*\(\d+\)\s*$/.exec(name.trim());
    if (!m) continue;
    const base = m[1].trim();
    if (base && baseNames.has(base.toLowerCase())) {
      warnings.push(
        `Sheet "${name}" memakai pola penamaan salinan default spreadsheet ("${base}" + "(N)"), dan sheet "${base}" juga ada di workbook ini -- kemungkinan duplikat/salinan yang belum dibersihkan, bukan sheet yang sengaja dipisah. Verifikasi mana yang data asli sebelum dipakai.`,
      );
    }
  }
}

/** Fingerprint isi transaksi (tanggal+uraian+debit+kredit per baris, urut) -- dipakai
 *  HANYA untuk membandingkan apakah dua sheet "kas" berisi data yang PERSIS SAMA
 *  (bukan cuma nama mirip). Tidak menyertakan `kode`/`rowNo`/`sheet` supaya salinan yang
 *  posisi barisnya sedikit bergeser (mis. baris header disisipkan ulang) tetap terdeteksi
 *  selama urutan transaksinya sama. */
function transactionFingerprint(txs: Transaction[]): string {
  return txs.map((t) => `${t.dateIso}|${t.description.trim().toLowerCase()}|${t.debit ?? ''}|${t.credit ?? ''}`).join('\n');
}

/**
 * Sinyal ISI: dua (atau lebih) sheet "kas" yang HASIL PARSE-nya persis identik (jumlah
 * baris sama DAN setiap baris tanggal+uraian+debit+kredit sama persis). Ini sinyal
 * paling kuat untuk "salinan/duplikat", jauh lebih pasti daripada sinyal nama saja --
 * ledger-validator.ts sudah punya mekanisme untuk memilih satu sheet sebagai sumber
 * utama agregasi (lihat pickPrimaryLedgerSheet), tapi sinyal ini tetap berguna di level
 * parser supaya kecurigaan "kedua sheet ini kembar" terlihat dari `warnings` walau
 * pemanggil cuma baca ParsedLedger tanpa lewat validator.
 */
function detectDuplicateKasContent(transactionsBySheet: Record<string, Transaction[]>, warnings: string[]): void {
  const names = Object.keys(transactionsBySheet);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = transactionsBySheet[names[i]];
      const b = transactionsBySheet[names[j]];
      if (a.length === 0 || b.length === 0 || a.length !== b.length) continue;
      if (transactionFingerprint(a) === transactionFingerprint(b)) {
        warnings.push(
          `Sheet "${names[i]}" dan sheet "${names[j]}" berisi transaksi yang PERSIS SAMA (${a.length} baris) -- pola khas salinan/duplikat sheet ("EMPLOYEE vs EMPLOYEE1"-style), BUKAN dua ledger yang berbeda. Konfirmasi manual mana yang data asli sebelum mengandalkan salah satunya.`,
        );
      }
    }
  }
}

function detectDuplicateSheetSignals(
  sheetNames: string[],
  transactionsBySheet: Record<string, Transaction[]>,
  warnings: string[],
): void {
  detectDuplicateSheetNamePattern(sheetNames, warnings);
  detectDuplicateKasContent(transactionsBySheet, warnings);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Parse seluruh workbook bookkeeping jadi struktur deterministik. TIDAK PERNAH memanggil
 * LLM. Klasifikasi sheet murni berdasar nama sheet + konten header (lihat komentar tiap
 * fungsi di atas untuk aturan deteksinya masing-masing).
 */
export function parseLedgerWorkbook(buffer: Buffer | ArrayBuffer): ParsedLedger {
  const isNodeBuffer = typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer);
  const data: Buffer | Uint8Array = isNodeBuffer ? (buffer as Buffer) : new Uint8Array(buffer as ArrayBuffer);
  const wb = XLSX.read(data, { type: isNodeBuffer ? 'buffer' : 'array', cellDates: true });

  const warnings: string[] = [];
  const chartOfAccounts = new Map<number, string>();
  const transactionsBySheet: Record<string, Transaction[]> = {};
  const invalidRows: Record<string, InvalidTransactionRow[]> = {};
  const depreciationSchedules: Record<string, DepreciationSchedule> = {};
  const statementSheets: Record<string, LabelValueEntry[]> = {};
  const cashFlowSheets: Record<string, CashFlowSheet> = {};
  const staleCompanyNameCandidates: string[] = [];
  const canonicalCompanyNameCandidates: string[] = [];
  const kodePostingDateSignatures: string[] = [];
  const reportDateSignatures: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const rows = sheetRows(wb, sheetName);
    const normName = sheetName.toUpperCase().replace(/[^A-Z]/g, '');

    if (normName === 'KODEPOSTING') {
      for (const [k, v] of parseKodePostingSheet(rows)) {
        if (!chartOfAccounts.has(k)) chartOfAccounts.set(k, v);
      }
      // Nama entitas & tanda-tangan tanggal di sheet ini dipakai untuk deteksi
      // "template bagan akun lama dipakai ulang" (data-basi) -- lihat ground truth #11.
      for (const row of rows.slice(0, 6)) {
        for (const cell of row) {
          if (typeof cell === 'string' && COMPANY_CO_RE.test(cell.trim())) {
            staleCompanyNameCandidates.push(cell.trim());
          }
        }
      }
      kodePostingDateSignatures.push(...collectDateSignatures(rows));
      continue;
    }
    if (normName === 'COVER') {
      for (const row of rows) {
        for (const cell of row) {
          if (typeof cell === 'string' && COMPANY_PT_RE.test(cell.trim())) {
            canonicalCompanyNameCandidates.push(cell.trim());
          }
        }
      }
      continue;
    }

    // Sheet lain (buku kas/laba-rugi/neraca/depresiasi/amortisasi/cash flow/dst) biasanya
    // punya baris tanda-tangan penutup "Kota, DD Bulan YYYY" -- ini jadi rujukan tahun
    // laporan yang SEBENARNYA, dibandingkan dengan tanggal template di "kode posting".
    reportDateSignatures.push(...collectDateSignatures(rows));

    if (normName.includes('DEPRESIASI') || normName.includes('AMORTISASI')) {
      const schedule = parseDepreciationSheet(rows, sheetName, warnings);
      if (schedule) depreciationSchedules[sheetName] = schedule;
      continue;
    }
    if (normName === 'CASHFLOW') {
      const cf = parseCashFlowSheet(rows, sheetName, warnings);
      if (cf) cashFlowSheets[sheetName] = cf;
      continue;
    }
    if (sheetName.toLowerCase().includes('kas')) {
      const parsedSheet = parseLedgerSheet(rows, sheetName, warnings);
      transactionsBySheet[sheetName] = parsedSheet.transactions;
      if (parsedSheet.invalidRows.length > 0) invalidRows[sheetName] = parsedSheet.invalidRows;
      continue;
    }
    const statementResult = parseStatementSheet(rows, sheetName, warnings);
    // Pola #4: header statement KETEMU (headerFound true) tapi nol baris data tetap
    // diklasifikasi sebagai statement sheet (kosong) -- BUKAN jatuh ke warning generik
    // "tidak cocok pola manapun" di bawah, karena itu justru menyembunyikan sinyal
    // "wadah-dekoi" yang sudah dilaporkan lebih spesifik di dalam parseStatementSheet().
    if (statementResult.entries.length > 0 || statementResult.headerFound) {
      statementSheets[sheetName] = statementResult.entries;
      continue;
    }
    warnings.push(
      `Sheet "${sheetName}": tidak cocok pola manapun (kode posting/kas/depresiasi/amortisasi/cash flow/statement) -- dilewati.`,
    );
  }

  detectDuplicateSheetSignals(wb.SheetNames, transactionsBySheet, warnings);

  return {
    sheetNames: wb.SheetNames,
    chartOfAccounts,
    transactionsBySheet,
    invalidRows,
    depreciationSchedules,
    statementSheets,
    cashFlowSheets,
    warnings,
    metadata: {
      staleCompanyNameCandidates,
      canonicalCompanyNameCandidates,
      kodePostingDateSignatures,
      reportDateSignatures,
    },
  };
}
