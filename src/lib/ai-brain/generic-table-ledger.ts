/**
 * Detektor ledger generik berbasis heuristik kolom (tanggal/jumlah/keterangan/jenis/
 * kategori) -- FASE B4 build 7 Sep 2026, roadmap integrasi-03 (lihat catatan jujur di
 * workspace-file-ledger.ts). parseLedgerWorkbook (ledger-parser.ts) HANYA mengenali SATU
 * template spesifik (sheet "kode posting" + sheet ber-nama "kas" berkolom TARIKH/URAIAN/
 * KODE/DEBET/KREDIT/SALDO) -- dibuktikan langsung: SEMUA 5 file dummy PT Makan Mania
 * Mantap (laporan penjualan/laba-rugi/inventori/payroll/csv transaksi mentah) TIDAK
 * dikenali template itu. Modul ini adalah JALUR KEDUA (fallback), dipakai HANYA kalau
 * parseLedgerWorkbook gagal mengenali file sebagai ledger klasik -- lihat wiring di
 * workspace-file-ledger.ts (tryDetectGenericLedgerForWorkspaceFile) dan
 * import-ledger/route.ts (GET mencoba klasik dulu, baru generik).
 *
 * DETERMINISTIK, NOL LLM -- pola yang sama dengan ledger-parser.ts/tabular-checker.ts:
 * REUSE parseIndonesianDate (date-normalizer.ts) dan parseIndoNumber (ledger-parser.ts,
 * sudah diexport) untuk validasi ISI, bukan menulis parser tanggal/angka baru.
 *
 * FILOSOFI ANTI-HALUSINASI (pelajaran LANGSUNG dari kelas bug yang memotivasi
 * ledger-parser.ts sendiri -- salah baca laporan keuangan 37 juta vs 3 M karena dokumen
 * ditempel mentah ke prompt LLM):
 *  1. Syarat MINIMUM mutlak: kolom TANGGAL (exact-match sinonim, BUKAN prefix/substring --
 *     lihat alasan di DATE_SYNONYMS di bawah) DAN kolom JUMLAH (atau pasangan
 *     DEBET+KREDIT) harus SAMA-SAMA ketemu di baris header yang sama. Kalau salah satu
 *     tidak ada -> REJECT TOTAL (return null dari detectSheetMapping), BUKAN
 *     confidence rendah -- sheet yang secara struktural bukan ledger (statement
 *     agregat, snapshot stok, roster tanpa tanggal transaksi) tidak boleh dipaksa
 *     jadi kandidat sama sekali.
 *  2. Validasi ISI (bukan cuma nama kolom): kolom TANGGAL & JUMLAH yang lolos exact-match
 *     nama TETAP divalidasi terhadap isi 10 baris sampel -- kalau <70% baris berhasil
 *     diparse, confidence dipotong tajam + peringatan eksplisit dengan angka konkret.
 *     Ini mencegah kelas bug "nama kolom cocok tapi isinya bukan itu" (mis. kolom
 *     bernama tanggal tapi berisi tanggal join karyawan, bukan tanggal transaksi).
 *  3. Kolom TANGGAL WAJIB exact-match (TANGGAL/TGL/TARIKH/dst persis, BUKAN
 *     startsWith/includes) -- "Tgl Bergabung" (data-karyawan-payroll.xlsx) sengaja
 *     TIDAK match "TGL" karena normalisasi menyatukan jadi "TGLBERGABUNG" (tidak persis
 *     sama dengan kunci kamus manapun). Ini KEPUTUSAN SADAR: lebih baik menolak
 *     (false-negative, aman) daripada menebak salah kolom tanggal (false-positive,
 *     berbahaya untuk data finansial) -- konsisten dengan "DILARANG KERAS menebak" di
 *     workspace-file-ledger.ts buildVerifiedNumbersBlock().
 *  4. Kolom JUMLAH boleh dikenali via startsWith untuk root kata tertentu (JUMLAH/
 *     TOTAL/NOMINAL/SUBTOTAL/OMZET) -- PRESEDEN SUDAH ADA di ledger-parser.ts sendiri
 *     (findStatementHeaderRow baris ~615: `norm.startsWith('JUMLAH')`), supaya header
 *     majemuk seperti "Total Harian (Rp)" tetap terdeteksi. TIDAK dipakai untuk
 *     TANGGAL/URAIAN/JENIS/KATEGORI (exact-match saja, lebih berisiko kalau longgar).
 *     HARGA/PRICE SENGAJA TIDAK dimasukkan jadi sinonim JUMLAH -- "Harga Satuan" adalah
 *     harga per unit, BUKAN nominal transaksi baris itu (kalau ikut jadi sinonim,
 *     risiko salah pilih kolom harga-satuan alih-alih subtotal transaksi).
 *  5. Sinyal "kemungkinan data AGREGAT/RINGKASAN" (bukan transaksi per-baris): kalau ada
 *     kolom LAIN (selain kolom JUMLAH yang dipilih) yang headernya mengandung penanda
 *     mata uang "(Rp)" -- ciri breakdown kategori berdampingan dengan kolom Total (mis.
 *     "Makanan Utama (Rp)", "Minuman (Rp)", ... , "Total Harian (Rp)") -- confidence
 *     dipotong + peringatan eksplisit risiko dobel-hitung. TIDAK reject total (sheet
 *     semacam ini MASIH sah kalau memang mau diimpor sebagai ringkasan harian, tapi
 *     WAJIB tahu risikonya sebelum konfirmasi).
 *  6. Kolom JENIS (income/expense) TIDAK WAJIB ada. Kalau tidak ada, SEMUA baris
 *     didefaultkan sebagai PEMASUKAN (asumsi paling umum untuk tabel transaksi tanpa
 *     kolom jenis eksplisit -- kebanyakan kasus adalah daftar penjualan) TAPI WAJIB
 *     ditulis eksplisit di peringatan[], BUKAN diam-diam. Confidence dipotong lebih
 *     dalam kalau nama file/sheet TIDAK mengandung konteks penjualan/transaksi apapun
 *     (sinyal tambahan bahwa asumsi "semua pemasukan" makin kurang pasti).
 */

import * as XLSX from 'xlsx';
import { parseIndonesianDate } from './date-normalizer';
import { parseIndoNumber } from './ledger-parser';
import type { CashTransactionDraft } from '../workspace-file-ledger';

// ---------------------------------------------------------------------------
// Tipe publik
// ---------------------------------------------------------------------------

/** Pemetaan kolom hasil deteksi -- index kolom 0-based, `null` kalau peran itu tidak
 *  ketemu di sheet/tabel ini. `date` dan (`amount` ATAU `debit`+`credit`) WAJIB terisi
 *  kalau `recognized` true -- itulah syarat minimum (lihat poin 1 JSDoc modul). */
export interface GenericColumnMapping {
  /** Nama sheet (untuk xlsx/xls) -- `null` untuk CSV (tidak ada konsep sheet). */
  sheetName: string | null;
  /** Index baris header di dalam array rows mentah (0-based). */
  headerRowIdx: number;
  date: number;
  amount: number | null;
  description: number | null;
  type: number | null;
  category: number | null;
  debit: number | null;
  credit: number | null;
  /** Teks header ASLI (apa adanya, index sejajar dengan kolom) -- murni untuk
   *  ditampilkan ke user di UI pratinjau (mis. "kolom terdeteksi sebagai Tanggal:
   *  'Tanggal'"), TIDAK dipakai untuk logic apapun (logic selalu pakai index). */
  headerLabels: (string | null)[];
}

export interface GenericSampleRow {
  rowNo: number;
  raw: unknown[];
  mapped: {
    tanggal: string | null;
    jumlah: number | null;
    keterangan: string | null;
    jenis: 'INCOME' | 'EXPENSE' | null;
    kategori: string | null;
  };
}

export interface GenericLedgerDetectionResult {
  recognized: boolean;
  mapping: GenericColumnMapping | null;
  /** 0..1. Lihat rumus & alasan tiap komponen di computeConfidence() di bawah. */
  confidence: number;
  /** Bentuk PERSIS sama dengan CashTransactionDraft di workspace-file-ledger.ts --
   *  REUSE type yang sudah ada (bukan bikin type baru), supaya kode penulisan ke
   *  prisma.cashTransaction.create di import-ledger/route.ts bisa dipakai ulang tanpa
   *  cabang if/else per-sumber. */
  drafts: CashTransactionDraft[];
  sample: GenericSampleRow[];
  warnings: string[];
  /** Terisi HANYA kalau recognized=false -- alasan jujur kenapa file ini ditolak
   *  total (bukan sekadar confidence rendah). */
  rejectReason?: string;
}

// ---------------------------------------------------------------------------
// Kamus sinonim header (exact-match kecuali dicatat lain -- lihat poin 3-4 JSDoc)
// ---------------------------------------------------------------------------

type Row = unknown[];

/** Normalisasi header: uppercase + buang semua karakter selain A-Z/0-9 -- pola PERSIS
 *  sama dengan normalizeHeaderCell() di ledger-parser.ts. Fungsi itu TIDAK diexport dari
 *  sana (private ke modul itu), jadi diimplementasi ulang di sini -- 3 baris, tidak ada
 *  logic tersembunyi yang bisa divergen diam-diam dari sumbernya. */
function normalizeHeader(v: unknown): string {
  return typeof v === 'string' ? v.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
}

// Sinonim ID+EN persis seperti diminta pack (tanggal/tgl/date) + tambahan yang sudah
// terbukti relevan dari riset ledger-parser.ts (tarikh, waktu, transactiondate) --
// EXACT MATCH SAJA (lihat poin 3 JSDoc modul, alasan kenapa TIDAK startsWith).
const DATE_SYNONYMS = new Set(['TANGGAL', 'TGL', 'TARIKH', 'WAKTU', 'DATE', 'TRANSACTIONDATE']);

// Sinonim persis diminta pack (jumlah/nominal/total/amount/nilai) + subtotal/omzet/omset
// yang genuinely muncul di fixture nyata (daftar-transaksi-mentah.csv kolom "Subtotal").
// SENGAJA TIDAK ada harga/price/unitprice -- itu harga PER UNIT, bukan nominal transaksi
// baris itu (lihat poin 4 JSDoc modul untuk kelas bug yang dicegah).
const AMOUNT_EXACT = new Set(['JUMLAH', 'NOMINAL', 'TOTAL', 'AMOUNT', 'NILAI', 'SUBTOTAL', 'OMZET', 'OMSET']);
// StartsWith fallback -- preseden ledger-parser.ts findStatementHeaderRow (norm.startsWith
// ('JUMLAH')) -- menangkap header majemuk seperti "Total Harian (Rp)"/"Total Omzet (Rp)".
const AMOUNT_PREFIX = ['JUMLAH', 'TOTAL', 'NOMINAL', 'SUBTOTAL', 'OMZET', 'OMSET'];

const DESC_SYNONYMS = new Set(['KETERANGAN', 'URAIAN', 'DESKRIPSI', 'ITEM', 'DESCRIPTION', 'DESC', 'NOTES', 'NAMA']);
const CATEGORY_SYNONYMS = new Set(['KATEGORI', 'KELOMPOK', 'DIVISI', 'CATEGORY', 'GROUP']);
// KATEGORI SENGAJA TIDAK dimasukkan ke sini walau pack menulis "jenis/tipe/type/kategori"
// dalam satu kelompok -- mapping kontrak yang diminta pack punya field `type` dan
// `category` TERPISAH, dan di fixture nyata "Kategori" berisi kategori MENU (Dessert,
// Makanan Utama, dst), bukan indikator pemasukan/pengeluaran. Disambiguasi: KATEGORI ->
// peran `category` (label bebas), JENIS/TIPE/TYPE -> peran `type` (income/expense).
const TYPE_SYNONYMS = new Set(['JENIS', 'TIPE', 'TYPE']);
const DEBIT_SYNONYMS = new Set(['DEBET', 'DEBIT']);
const CREDIT_SYNONYMS = new Set(['KREDIT', 'CREDIT']);

const RUPIAH_MARKER_RE = /\(\s*rp\.?\s*\)/i;

const INCOME_KEYWORDS = ['pemasukan', 'income', 'masuk', 'penjualan', 'pendapatan', 'debit', 'debet', 'sale', 'in'];
const EXPENSE_KEYWORDS = ['pengeluaran', 'expense', 'keluar', 'beban', 'biaya', 'kredit', 'credit', 'out'];

// Konteks nama file/sheet yang mengindikasikan "kemungkinan besar semua baris memang
// pemasukan/penjualan" -- dipakai HANYA untuk menentukan seberapa besar confidence
// dipotong saat kolom JENIS tidak ada (lihat poin 6 JSDoc), TIDAK PERNAH dipakai untuk
// menaikkan confidence di atas skenario "kolom JENIS eksplisit ada".
const SALES_CONTEXT_RE = /(penjualan|sales|transaksi|omzet|omset|kasir|\bpos\b|order)/i;

// ---------------------------------------------------------------------------
// Parser CSV minimal (tanpa dependency baru) -- reimplementasi kecil, pola sama
// dengan parseCsvLine di tabular-checker.ts (tidak diexport dari sana, jadi ditulis
// ulang di sini; ~15 baris, tidak ada logic tersembunyi).
// ---------------------------------------------------------------------------

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

/**
 * Parser CSV utuh (state machine SATU lintasan atas seluruh teks), 7 Sep 2026 malam --
 * menggantikan pola "split baris dulu, baru parse kutip per baris" yang salah untuk
 * sel ber-newline di dalam tanda kutip (umum di ekspor Excel/POS: kolom Keterangan
 * berisi alamat/catatan 2 baris). Dengan pola lama, baris seperti itu pecah jadi 2+
 * baris data dan menggeser kolom jumlah/jenis baris berikutnya -- dan hasil geseran
 * itu yang akan ditulis ke CashTransaction saat user konfirmasi (temuan refuter
 * keamanan, severity SEDANG). parseCsvLine (di atas) tetap dipakai test lama; jalur
 * produksi lewat fungsi ini.
 */
export function parseCsvText(text: string): string[][] {
  // Buang BOM UTF-8 di awal file kalau ada (umum pada CSV hasil export Excel/POS --
  // ditemukan langsung di fixture daftar-transaksi-mentah.csv Mecca).
  const clean = text.replace(/^﻿/, '');
  const rows: string[][] = [];
  let cells: string[] = [];
  let current = '';
  let inQuotes = false;
  let cellStarted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else current += ch;
      continue;
    }
    if (ch === '"') { inQuotes = true; cellStarted = true; continue; }
    if (ch === ',') { cells.push(current.trim()); current = ''; cellStarted = true; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && clean[i + 1] === '\n') i++;
      if (cellStarted || current.length > 0) { cells.push(current.trim()); rows.push(cells); }
      else rows.push([]); // baris kosong dipertahankan sebagai [] (perilaku lama)
      cells = []; current = ''; cellStarted = false;
      continue;
    }
    current += ch; cellStarted = true;
  }
  if (cellStarted || current.length > 0) { cells.push(current.trim()); rows.push(cells); }
  return rows;
}

function parseCsvRows(text: string): Row[] {
  return parseCsvText(text);
}

// ---------------------------------------------------------------------------
// Deteksi header per sheet/tabel
// ---------------------------------------------------------------------------

interface HeaderDetection {
  rowIdx: number;
  dateCol: number;
  amountCol: number | null;
  amountIsPrefixMatch: boolean;
  debitCol: number | null;
  creditCol: number | null;
  descriptionCol: number | null;
  typeCol: number | null;
  categoryCol: number | null;
  /** Header ASLI (bukan dinormalisasi) kolom lain yang mengandung penanda "(Rp)" tapi
   *  BUKAN kolom JUMLAH yang dipilih -- sinyal "kemungkinan data agregat" (poin 5 JSDoc). */
  rpSiblingHeaders: string[];
}

function findGenericHeaderRow(rows: Row[]): HeaderDetection | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let dateCol = -1;
    let amountCol = -1;
    let amountIsPrefixMatch = false;
    let debitCol = -1;
    let creditCol = -1;
    let descriptionCol = -1;
    let typeCol = -1;
    let categoryCol = -1;
    const rpMarked: string[] = [];

    for (let c = 0; c < row.length; c++) {
      const cellRaw = row[c];
      const norm = normalizeHeader(cellRaw);
      if (!norm) continue;
      if (dateCol === -1 && DATE_SYNONYMS.has(norm)) {
        dateCol = c;
        continue;
      }
      if (descriptionCol === -1 && DESC_SYNONYMS.has(norm)) {
        descriptionCol = c;
        continue;
      }
      if (categoryCol === -1 && CATEGORY_SYNONYMS.has(norm)) {
        categoryCol = c;
        continue;
      }
      if (typeCol === -1 && TYPE_SYNONYMS.has(norm)) {
        typeCol = c;
        continue;
      }
      if (debitCol === -1 && DEBIT_SYNONYMS.has(norm)) {
        debitCol = c;
        continue;
      }
      if (creditCol === -1 && CREDIT_SYNONYMS.has(norm)) {
        creditCol = c;
        continue;
      }
      if (amountCol === -1 && (AMOUNT_EXACT.has(norm) || AMOUNT_PREFIX.some((p) => norm.startsWith(p)))) {
        amountCol = c;
        amountIsPrefixMatch = !AMOUNT_EXACT.has(norm);
        continue;
      }
      if (typeof cellRaw === 'string' && RUPIAH_MARKER_RE.test(cellRaw)) {
        rpMarked.push(cellRaw.trim());
      }
    }

    const hasAmountShape = amountCol !== -1 || (debitCol !== -1 && creditCol !== -1);
    if (dateCol !== -1 && hasAmountShape) {
      return {
        rowIdx: r,
        dateCol,
        amountCol: amountCol === -1 ? null : amountCol,
        amountIsPrefixMatch,
        debitCol: debitCol === -1 ? null : debitCol,
        creditCol: creditCol === -1 ? null : creditCol,
        descriptionCol: descriptionCol === -1 ? null : descriptionCol,
        typeCol: typeCol === -1 ? null : typeCol,
        categoryCol: categoryCol === -1 ? null : categoryCol,
        rpSiblingHeaders: rpMarked,
      };
    }
  }
  return null;
}

function getDataRows(rows: Row[], headerRowIdx: number): { rowNo: number; row: Row }[] {
  const out: { rowNo: number; row: Row }[] = [];
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    if (row.every((cell) => cell === null || cell === undefined || cell === '')) continue;
    out.push({ rowNo: r + 1, row });
  }
  return out;
}

function classifyTypeCell(v: unknown): 'INCOME' | 'EXPENSE' | null {
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (INCOME_KEYWORDS.some((k) => s.includes(k))) return 'INCOME';
  if (EXPENSE_KEYWORDS.some((k) => s.includes(k))) return 'EXPENSE';
  return null;
}

// ---------------------------------------------------------------------------
// Deteksi + bangun draft untuk SATU sheet/tabel
// ---------------------------------------------------------------------------

interface SheetDetection {
  mapping: GenericColumnMapping;
  confidence: number;
  drafts: CashTransactionDraft[];
  sample: GenericSampleRow[];
  warnings: string[];
}

function detectSheetMapping(rows: Row[], sheetName: string | null, fileName: string): SheetDetection | null {
  const header = findGenericHeaderRow(rows);
  if (!header) return null;

  const dataRows = getDataRows(rows, header.rowIdx);
  const warnings: string[] = [];

  // --- validasi ISI (poin 2 JSDoc): sample 10 baris pertama, hitung proporsi valid ---
  const sampleSize = Math.min(10, dataRows.length);
  const sampled = dataRows.slice(0, sampleSize);
  let dateValidCount = 0;
  let amountValidCount = 0;
  for (const { row } of sampled) {
    const parsedDate = parseIndonesianDate(row[header.dateCol]);
    if (parsedDate.iso) dateValidCount++;
    const amountOk =
      header.amountCol !== null
        ? parseIndoNumber(row[header.amountCol]) !== null
        : (header.debitCol !== null && parseIndoNumber(row[header.debitCol]) !== null) ||
          (header.creditCol !== null && parseIndoNumber(row[header.creditCol]) !== null);
    if (amountOk) amountValidCount++;
  }
  const dateValidRatio = sampleSize > 0 ? dateValidCount / sampleSize : 0;
  const amountValidRatio = sampleSize > 0 ? amountValidCount / sampleSize : 0;
  if (sampleSize > 0 && dateValidRatio < 0.7) {
    warnings.push(
      `Kolom tanggal terdeteksi (kolom ${header.dateCol + 1}) tapi hanya ${dateValidCount} dari ${sampleSize} baris sampel berhasil diparse sebagai tanggal valid -- kemungkinan kolom ini BUKAN tanggal transaksi (mis. tanggal biografis/join, bukan tanggal harian). Verifikasi manual sebelum konfirmasi impor.`,
    );
  }
  if (sampleSize > 0 && amountValidRatio < 0.7) {
    warnings.push(
      `Kolom nominal terdeteksi tapi hanya ${amountValidCount} dari ${sampleSize} baris sampel berhasil diparse sebagai angka -- verifikasi manual sebelum konfirmasi impor.`,
    );
  }

  // --- sinyal agregasi (poin 5 JSDoc) ---
  if (header.rpSiblingHeaders.length > 0) {
    warnings.push(
      `Ditemukan kolom lain berpenanda mata uang "(Rp)" di sheet/tabel ini selain kolom nominal yang dipilih (${header.rpSiblingHeaders.join(', ')}) -- pola khas tabel RINGKASAN/AGREGAT (breakdown per kategori berdampingan dengan kolom Total), BUKAN transaksi per-baris. Risiko DOBEL-HITUNG kalau data mentah per-transaksi juga diimpor terpisah. Verifikasi manual sebelum konfirmasi impor.`,
    );
  }
  if (header.amountIsPrefixMatch) {
    warnings.push(
      `Kolom nominal dikenali lewat kecocokan awalan kata (bukan nama kolom baku persis) -- verifikasi manual bahwa kolom ini benar mewakili nominal transaksi.`,
    );
  }

  // --- kolom JENIS (poin 6 JSDoc) ---
  const contextMatches = SALES_CONTEXT_RE.test(fileName) || (sheetName ? SALES_CONTEXT_RE.test(sheetName) : false);
  if (header.typeCol === null) {
    warnings.push(
      `Kolom jenis transaksi (pemasukan/pengeluaran) tidak ditemukan -- SEMUA baris didefaultkan sebagai PEMASUKAN berdasarkan ${
        contextMatches
          ? 'konteks nama file/sheet yang mengindikasikan data penjualan/transaksi'
          : 'asumsi umum (konteks nama file/sheet TIDAK secara eksplisit mengindikasikan penjualan -- verifikasi ekstra disarankan)'
      }. WAJIB diverifikasi manual sebelum konfirmasi impor.`,
    );
  }

  // --- hitung confidence (formula transparan, tiap komponen dijelaskan di JSDoc) ---
  let confidence = 0.35; // kolom tanggal ditemukan (syarat wajib sudah lolos di titik ini)
  confidence += 0.35; // kolom jumlah/debit-kredit ditemukan (syarat wajib sudah lolos)
  if (header.descriptionCol !== null) confidence += 0.1;
  if (header.categoryCol !== null) confidence += 0.05;
  if (header.typeCol !== null) confidence += 0.15;
  else confidence -= contextMatches ? 0.05 : 0.15;
  if (header.rpSiblingHeaders.length > 0) confidence -= 0.25;
  if (header.amountIsPrefixMatch) confidence -= 0.05;
  if (dateValidRatio < 0.7) confidence *= Math.max(0.15, dateValidRatio);
  if (amountValidRatio < 0.7) confidence *= Math.max(0.15, amountValidRatio);
  confidence = Math.max(0, Math.min(1, confidence));

  // --- bangun drafts (SEMUA baris data, bukan cuma sampel) ---
  const drafts: CashTransactionDraft[] = [];
  const sample: GenericSampleRow[] = [];
  const categoryFallback = `Impor Ledger Generik (${sheetName ?? fileName})`.slice(0, 100);

  for (const { rowNo, row } of dataRows) {
    const parsedDate = parseIndonesianDate(row[header.dateCol]);
    const descriptionRaw = header.descriptionCol !== null ? row[header.descriptionCol] : null;
    const description = typeof descriptionRaw === 'string' ? descriptionRaw.trim() : descriptionRaw != null ? String(descriptionRaw) : '';
    const categoryRaw = header.categoryCol !== null ? row[header.categoryCol] : null;
    const category = (typeof categoryRaw === 'string' && categoryRaw.trim() ? categoryRaw.trim() : categoryFallback).slice(0, 100);
    const typeCellValue = header.typeCol !== null ? classifyTypeCell(row[header.typeCol]) : null;
    const resolvedType: 'INCOME' | 'EXPENSE' = typeCellValue ?? 'INCOME';

    let amount: number | null = null;
    let type: 'INCOME' | 'EXPENSE' = resolvedType;
    if (header.amountCol !== null) {
      amount = parseIndoNumber(row[header.amountCol]);
    } else {
      const debitVal = header.debitCol !== null ? parseIndoNumber(row[header.debitCol]) : null;
      const creditVal = header.creditCol !== null ? parseIndoNumber(row[header.creditCol]) : null;
      if (debitVal !== null && debitVal > 0) {
        amount = debitVal;
        type = 'INCOME';
      } else if (creditVal !== null && creditVal > 0) {
        amount = creditVal;
        type = 'EXPENSE';
      }
    }

    if (sample.length < 5) {
      sample.push({
        rowNo,
        raw: row,
        mapped: {
          tanggal: parsedDate.iso,
          jumlah: amount,
          keterangan: description || null,
          jenis: amount !== null ? type : null,
          kategori: header.categoryCol !== null ? category : null,
        },
      });
    }

    if (!parsedDate.iso) continue; // tanggal gagal parse -- baris ini TIDAK ikut draft (anti-halusinasi, bukan ditebak)
    if (amount === null || amount <= 0) continue; // nominal tidak valid/nol -- bukan transaksi kas yang bisa dicatat

    drafts.push({
      type,
      category,
      amount,
      description: description || `Transaksi baris ${rowNo} (${sheetName ?? fileName})`,
      transactionDate: new Date(parsedDate.iso),
      sourceRowNo: rowNo,
    });
  }

  const headerRow = rows[header.rowIdx] || [];
  const headerLabels: (string | null)[] = headerRow.map((cell) => (typeof cell === 'string' ? cell.trim() : cell != null ? String(cell) : null));

  const mapping: GenericColumnMapping = {
    sheetName,
    headerRowIdx: header.rowIdx,
    date: header.dateCol,
    amount: header.amountCol,
    description: header.descriptionCol,
    type: header.typeCol,
    category: header.categoryCol,
    debit: header.debitCol,
    credit: header.creditCol,
    headerLabels,
  };

  return { mapping, confidence, drafts, sample, warnings };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Deteksi tabel transaksi generik dari buffer xlsx/xls/csv. Untuk xlsx/xls multi-sheet,
 * SETIAP sheet dicoba, sheet dengan confidence TERTINGGI di antara yang lolos syarat
 * minimum (tanggal + jumlah) yang dipilih jadi hasil akhir -- sheet yang gugur syarat
 * minimum dicatat di warnings (transparansi) tapi tidak menghalangi sheet lain.
 *
 * TIDAK PERNAH melempar exception ke pemanggil untuk input yang bisa dibaca -- error
 * baca file (buffer korup, dll) ditangkap dan dikembalikan sebagai rejectReason (non-fatal),
 * konsisten dengan tryParseWorkspaceFileAsLedger() di workspace-file-ledger.ts.
 */
export function detectGenericLedger(workbookOrCsvBuffer: Buffer, fileName: string): GenericLedgerDetectionResult {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls') {
    return {
      recognized: false,
      mapping: null,
      confidence: 0,
      drafts: [],
      sample: [],
      warnings: [],
      rejectReason: `Ekstensi file ".${ext || '(tidak ada)'}" tidak didukung oleh detektor ledger generik (hanya csv/xlsx/xls).`,
    };
  }

  let sheets: { name: string | null; rows: Row[] }[];
  try {
    if (ext === 'csv') {
      sheets = [{ name: null, rows: parseCsvRows(workbookOrCsvBuffer.toString('utf8')) }];
    } else {
      const wb = XLSX.read(workbookOrCsvBuffer, { type: 'buffer', cellDates: true });
      sheets = wb.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<Row>(wb.Sheets[name], { header: 1, raw: true, defval: null }) as Row[],
      }));
    }
  } catch (err) {
    return {
      recognized: false,
      mapping: null,
      confidence: 0,
      drafts: [],
      sample: [],
      warnings: [],
      rejectReason: `Gagal membaca isi file: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const candidates: SheetDetection[] = [];
  const skipNotes: string[] = [];
  for (const sheet of sheets) {
    const detected = detectSheetMapping(sheet.rows, sheet.name, fileName);
    if (detected) {
      candidates.push(detected);
    } else {
      skipNotes.push(
        `Sheet/tabel "${sheet.name ?? fileName}": tidak ditemukan kombinasi kolom TANGGAL + JUMLAH (atau DEBET+KREDIT) yang cocok -- dilewati dari kandidat ledger generik.`,
      );
    }
  }

  if (candidates.length === 0) {
    return {
      recognized: false,
      mapping: null,
      confidence: 0,
      drafts: [],
      sample: [],
      warnings: skipNotes,
      rejectReason:
        'Tidak ada sheet/tabel di file ini yang punya kombinasi kolom TANGGAL dan JUMLAH (atau DEBET+KREDIT) yang bisa dikenali -- file ini kemungkinan bukan data transaksi kas (mis. laporan agregat per periode, snapshot stok, atau roster tanpa tanggal transaksi harian per baris).',
    };
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  const best = candidates[0];
  return {
    recognized: true,
    mapping: best.mapping,
    confidence: best.confidence,
    drafts: best.drafts,
    sample: best.sample,
    warnings: [...best.warnings, ...skipNotes],
  };
}
