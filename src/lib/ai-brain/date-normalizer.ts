/**
 * Deterministic Indonesian-ledger date parsing + anomaly detection.
 *
 * FASE 2 dari roadmap anti-halusinasi (2026-09-06-roadmap-analisis-data-enterprise-anti-halusinasi.md).
 * Pure functions, TIDAK PERNAH memanggil LLM -- mengikuti pola deterministik yang sama
 * dengan hpp-calculator.ts (kalkulasi/parsing selalu di kode, LLM cuma boleh menarasikan
 * hasilnya). Motivasi langsung: dokumen sumber (workbook pembukuan double-entry UMKM)
 * memakai format tanggal non-standar yang TIDAK bisa diandalkan ke `new Date(string)` biasa
 * -- termasuk header kolom bulan seperti "Jan`14" (verified langsung dari fixture asli
 * PT-Tujuh-Mata-Air_jan14-okt15.xlsx sheet 'depresiasi' baris 6, lihat catatan di bawah).
 *
 * Filosofi anti-halusinasi: kalau sebuah string tidak cocok salah satu format yang
 * dikenali di bawah, fungsi ini WAJIB mengembalikan iso:null + confidence:0 + warning
 * yang jujur -- TIDAK PERNAH menebak tanggal dari fallback parser generik (mis.
 * `new Date(str)` bawaan JS yang permisif dan sering salah-tafsir format non-ISO).
 *
 * detectDateAnomalies() TIDAK PERNAH menimpa data sumber -- ia hanya mengusulkan
 * (suggestion) apa yang mungkin salah, untuk ditampilkan ke user/log. Keputusan
 * mengoreksi data tetap di tangan manusia.
 */

// ---------------------------------------------------------------------------
// Tipe publik
// ---------------------------------------------------------------------------

export interface ParsedDate {
  /** Tanggal hasil parse dalam format "YYYY-MM-DD", atau null kalau tidak bisa/tidak valid. */
  iso: string | null;
  /** 0..1 -- seberapa yakin parser terhadap hasil ini (lihat komentar per-format di bawah). */
  confidence: number;
  /** Nama format yang terdeteksi (atau 'unknown' kalau tidak cocok satupun). */
  sourceFormat: string;
  /** Peringatan manusia-terbaca (mis. "tahun 2 digit diasumsikan...", "hari default ke 1"). */
  warnings: string[];
}

export type DateAnomalyKind =
  | 'non-monotonic'
  | 'day-name-mismatch'
  | 'impossible-date'
  | 'suspicious-year-jump'
  | 'duplicate'
  | 'out-of-period';

export interface DateAnomalyInput {
  row: number;
  /** Hasil parseIndonesianDate().iso untuk baris ini (null kalau gagal parse / mustahil). */
  iso: string | null;
  /** Nilai mentah asli dari sel/sumbernya -- dipakai untuk pesan & pendeteksian impossible-date. */
  raw: unknown;
  /** Nama hari yang tertulis di sumber (kalau ada), mis. "Senin". Opsional. */
  dayName?: string;
}

export interface DateAnomaly {
  row: number;
  kind: DateAnomalyKind;
  raw: unknown;
  /** Usulan perbaikan (teks manusia-terbaca) -- TIDAK PERNAH dipakai untuk auto-overwrite. */
  suggestion: string | null;
  severity: 'low' | 'medium' | 'high';
}

export interface ReportPeriod {
  startIso: string | null;
  endIso: string | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Peta nama bulan (Indonesia penuh + singkatan, Inggris singkatan/penuh)
// ---------------------------------------------------------------------------
// CATATAN PENTING (verified langsung dari fixture asli 2026-09-06): sheet 'depresiasi'
// baris 6 workbook PT-Tujuh-Mata-Air_jan14-okt15.xlsx memakai CAMPURAN singkatan dan
// nama penuh dalam satu baris header yang sama -- "Jan`14","Feb`14","Mar`14","Apr`14",
// "Mei`14","Juni`14","Juli`14","Ags`14","Sep`14","Okt`14","Nov`14","Des`14" (lalu ulang
// untuk `15). "Juni"/"Juli" di sini adalah nama PENUH, bukan singkatan 3-huruf seperti
// bulan lain di baris yang sama -- peta di bawah WAJIB kenali keduanya (singkatan DAN
// penuh) supaya baris header asli ini ke-parse semua tanpa kecuali.
const MONTH_MAP: Record<string, number> = {
  // Indonesia -- nama penuh
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6, juli: 7,
  agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  // Indonesia -- singkatan umum
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7,
  agu: 8, ags: 8, agst: 8, sep: 9, sept: 9, okt: 10, nov: 11, des: 12,
  // Inggris -- nama penuh (untuk kasus dokumen campur Inggris)
  january: 1, february: 2, march: 3, june: 6, july: 7,
  august: 8, october: 10, december: 12,
  // Inggris -- singkatan yang beda ejaan dari versi Indonesia
  may: 5, aug: 8, oct: 10, dec: 12,
};

// Nama hari Indonesia -> index gaya Date.getUTCDay() (0=Minggu..6=Sabtu).
const WEEKDAY_MAP: Record<string, number> = {
  minggu: 0, ahad: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
};
const WEEKDAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function normalizeToken(s: string): string {
  return s.trim().toLowerCase().replace(/[.\s]+$/g, '');
}

function lookupMonth(token: string): number | null {
  const key = normalizeToken(token);
  return Object.prototype.hasOwnProperty.call(MONTH_MAP, key) ? MONTH_MAP[key] : null;
}

function lookupWeekday(token: string): number | null {
  const key = normalizeToken(token).replace(/[^a-z]/g, '');
  return Object.prototype.hasOwnProperty.call(WEEKDAY_MAP, key) ? WEEKDAY_MAP[key] : null;
}

// ---------------------------------------------------------------------------
// Helper tanggal murni (semua pakai UTC supaya deterministik lintas timezone proses)
// ---------------------------------------------------------------------------

function daysInMonth(year: number, month: number): number {
  // Trik standar: hari ke-0 bulan berikutnya = hari terakhir bulan ini.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1) return false;
  return day <= daysInMonth(year, month);
}

function toIso(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Aturan 2-digit -> 4-digit tahun: 00-69 => 20xx, 70-99 => 19xx (selalu diberi warning). */
function resolveTwoDigitYear(yy: number): { year: number; warning: string } {
  const year = yy <= 69 ? 2000 + yy : 1900 + yy;
  return {
    year,
    warning: `Tahun 2 digit '${String(yy).padStart(2, '0')}' diasumsikan sebagai ${year} (aturan 00-69->20xx, 70-99->19xx) -- konfirmasi manual disarankan.`,
  };
}

/**
 * Cek tahun 4-digit masuk akal (1950..2100). Dipakai SEMUA cabang yang menerima tahun
 * 4-digit literal (ISO, dd/mm/yyyy, dd-namabulan-yyyy, bulan-tahun-4digit) -- sebelumnya
 * cuma cabang Excel-serial yang punya cek ini, sehingga typo satu digit seperti
 * "2104-01-03" (maksudnya 2014) lolos dengan confidence 1 tanpa peringatan apapun
 * (ditemukan verifier adversarial 2026-09-06). Cek ini TIDAK menolak tanggalnya (bisa
 * saja memang benar), cuma menurunkan confidence dan memberi warning -- keputusan
 * akhir tetap di manusia / detectDateAnomalies() yang lihat konteks baris tetangga.
 */
const PLAUSIBLE_YEAR_MIN = 1950;
const PLAUSIBLE_YEAR_MAX = 2100;
function yearPlausibilityWarning(year: number, str: string): string | null {
  if (year < PLAUSIBLE_YEAR_MIN || year > PLAUSIBLE_YEAR_MAX) {
    return `Tahun ${year} (dari "${str}") di luar rentang wajar ${PLAUSIBLE_YEAR_MIN}-${PLAUSIBLE_YEAR_MAX} -- kemungkinan salah ketik digit, periksa manual.`;
  }
  return null;
}

function indonesianWeekdayName(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_NAMES[dow];
}

// ---------------------------------------------------------------------------
// parseIndonesianDate
// ---------------------------------------------------------------------------

// Kelompok 4 (opsional) di kedua regex di bawah menangkap SISA komponen jam:menit:detik
// (plus pecahan detik/timezone) kalau ada -- pola nyata ditemukan riset database HR
// enterprise (babak 2, 2026-09-06): "tanggal biografis selalu jam 00:00:00, tapi tanggal
// transaksional bawa timestamp sampai milidetik dari jam sistem batch" dalam BERKAS YANG
// SAMA. Sebelum perbaikan ini, string dengan sisa jam (mis. "2015-10-15 14:23:05.123" hasil
// export sistem batch) gagal total dikenali (anchor `$` menolak karakter sisa) padahal
// bagian TANGGAL-nya sendiri tidak ambigu sama sekali -- kehilangan baris transaksi bukan
// karena tanggalnya salah, tapi karena presisinya beda dari baris lain di sheet yang sama.
// Komponen jam SELALU dibuang (diambil cuma tanggal kalendernya) -- TIDAK PERNAH dipakai
// untuk menentukan tanggal, jadi tidak menambah ambiguitas apapun.
const RE_TIME_SUFFIX_ISO = `(?:[ T]\\d{1,2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?\\s*(?:Z|[+-]\\d{2}:?\\d{2})?)?`;
const RE_TIME_SUFFIX_SIMPLE = `(?:[ T]\\d{1,2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?)?`;
const RE_ISO = new RegExp(`^(\\d{4})-(\\d{1,2})-(\\d{1,2})(${RE_TIME_SUFFIX_ISO})$`);
const RE_DDMMYYYY = new RegExp(`^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})(${RE_TIME_SUFFIX_SIMPLE})$`);
const RE_DD_MONTHNAME_YYYY = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/;
// Menangkap SEMUA varian "bulan+tahun ringkas": "Jan`14", "Jan'14", "Jan 14", "JAN.2014",
// "Januari 2014" -- satu regex untuk semua karena bedanya cuma karakter pemisah dan
// panjang digit tahun (2 vs 4). Anchor $ membuat \d{2,4} greedy menangkap SEMUA digit
// yang tersisa, jadi otomatis membedakan tahun 2-digit vs 4-digit dengan benar.
const RE_MONTH_YEAR_COMPACT = /^([A-Za-z]+)[\s'`.]*(\d{2,4})$/;

function parseFromDate(input: Date): ParsedDate {
  if (Number.isNaN(input.getTime())) {
    return { iso: null, confidence: 0, sourceFormat: 'js-date', warnings: ['Objek Date tidak valid (Invalid Date).'] };
  }
  // Dibaca via getter LOKAL (bukan UTC) -- objek Date ini datang dari caller yang
  // membangunnya sendiri (mis. new Date(2014,0,2)), jadi tanggal kalender yang
  // "dimaksud" caller ada di komponen lokal, bukan instant UTC-nya.
  const iso = toIso(input.getFullYear(), input.getMonth() + 1, input.getDate());
  return { iso, confidence: 1, sourceFormat: 'js-date', warnings: [] };
}

function parseFromExcelSerial(serial: number): ParsedDate {
  if (!Number.isFinite(serial) || serial < 1) {
    return { iso: null, confidence: 0, sourceFormat: 'excel-serial', warnings: [`Excel serial number tidak valid: ${serial}`] };
  }
  // Formula standar SheetJS/industri: offset 25569 hari antara epoch Excel (1900-01-01,
  // serial=1) dan epoch Unix (1970-01-01) -- berlaku benar untuk semua tanggal >= 1900-03-01
  // (serial >= 61), yaitu SELURUH rentang data ledger UMKM 2014-2015 yang jadi target modul ini.
  const unixDays = Math.floor(serial - 25569);
  const ms = unixDays * 86400000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const warnings: string[] = [];
  if (year < 1950 || year > 2100) {
    warnings.push(`Tahun hasil konversi serial Excel (${year}) di luar rentang wajar -- periksa manual.`);
  }
  return { iso: toIso(year, month, day), confidence: warnings.length ? 0.5 : 0.9, sourceFormat: 'excel-serial', warnings };
}

export function parseIndonesianDate(input: unknown): ParsedDate {
  if (input instanceof Date) return parseFromDate(input);
  if (typeof input === 'number') return parseFromExcelSerial(input);

  if (typeof input !== 'string') {
    return { iso: null, confidence: 0, sourceFormat: 'unknown', warnings: [`Tipe input tidak didukung: ${typeof input}`] };
  }

  const str = input.trim();
  if (!str) {
    return { iso: null, confidence: 0, sourceFormat: 'unknown', warnings: ['Input kosong.'] };
  }

  // 1) ISO "YYYY-MM-DD" (opsional dengan sisa jam:menit:detik, lihat komentar RE_ISO)
  let m = RE_ISO.exec(str);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const timeSuffix = m[4];
    if (!isValidYmd(year, month, day)) {
      return {
        iso: null, confidence: 0, sourceFormat: 'iso',
        warnings: [`Tanggal mustahil: ${str} (hari ${day} tidak ada di bulan ${month}/${year}).`],
      };
    }
    const yearWarn = yearPlausibilityWarning(year, str);
    const warnings = yearWarn ? [yearWarn] : [];
    if (timeSuffix) {
      warnings.push(
        `Input membawa komponen jam ("${timeSuffix.trim()}") -- diabaikan, hanya tanggal kalender yang dipakai (presisi tanggal biografis vs transaksional bisa berbeda dalam berkas yang sama).`,
      );
    }
    return {
      iso: toIso(year, month, day),
      confidence: yearWarn ? 0.5 : 1,
      sourceFormat: 'iso',
      warnings,
    };
  }

  // 2) "DD/MM/YYYY" (konvensi Indonesia: dd/mm, BUKAN mm/dd ala Amerika; opsional sisa jam)
  m = RE_DDMMYYYY.exec(str);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const timeSuffix = m[4];
    const warnings: string[] = [];
    const isAmbiguousDdMm = day <= 12;
    if (isAmbiguousDdMm) {
      warnings.push(`Format dd/mm/yyyy ambigu untuk "${str}" (hari <=12) -- diasumsikan dd/mm sesuai konvensi Indonesia, BUKAN mm/dd.`);
    }
    if (!isValidYmd(year, month, day)) {
      return {
        iso: null, confidence: 0, sourceFormat: 'dd/mm/yyyy',
        warnings: [`Tanggal mustahil: ${str} (hari ${day} tidak ada di bulan ${month}/${year}).`],
      };
    }
    const yearWarnDdmm = yearPlausibilityWarning(year, str);
    if (yearWarnDdmm) warnings.push(yearWarnDdmm);
    if (timeSuffix) {
      warnings.push(
        `Input membawa komponen jam ("${timeSuffix.trim()}") -- diabaikan, hanya tanggal kalender yang dipakai (presisi tanggal biografis vs transaksional bisa berbeda dalam berkas yang sama).`,
      );
    }
    return {
      iso: toIso(year, month, day),
      // Confidence HANYA turun karena ambiguitas dd/mm atau tahun tidak wajar -- catatan
      // komponen jam (timeSuffix) murni transparansi, BUKAN sumber keraguan tambahan
      // (tanggalnya sendiri tetap sama pastinya, jam yang dibuang bukan bagian yang ditebak).
      confidence: yearWarnDdmm ? 0.5 : isAmbiguousDdMm ? 0.75 : 0.85,
      sourceFormat: 'dd/mm/yyyy',
      warnings,
    };
  }

  // 3) "15 Oktober 2015" (dd + nama bulan + yyyy 4-digit, tidak ambigu karena nama bulan eksplisit)
  m = RE_DD_MONTHNAME_YYYY.exec(str);
  if (m) {
    const day = Number(m[1]);
    const monthToken = m[2];
    const year = Number(m[3]);
    const month = lookupMonth(monthToken);
    if (month === null) {
      return { iso: null, confidence: 0, sourceFormat: 'dd-monthname-yyyy', warnings: [`Nama bulan tidak dikenali: "${monthToken}" (dari "${str}").`] };
    }
    if (!isValidYmd(year, month, day)) {
      return {
        iso: null, confidence: 0, sourceFormat: 'dd-monthname-yyyy',
        warnings: [`Tanggal mustahil: ${str} (hari ${day} tidak ada di bulan ${month}/${year}).`],
      };
    }
    const yearWarnMn = yearPlausibilityWarning(year, str);
    return {
      iso: toIso(year, month, day),
      confidence: yearWarnMn ? 0.5 : 0.95,
      sourceFormat: 'dd-monthname-yyyy',
      warnings: yearWarnMn ? [yearWarnMn] : [],
    };
  }

  // 4) Bulan+tahun ringkas: "Jan`14" / "Jan'14" / "Jan 14" / "JAN.2014" / "Januari 2014" / "Juni`14"
  m = RE_MONTH_YEAR_COMPACT.exec(str);
  if (m) {
    const monthToken = m[1];
    const yearDigits = m[2];
    const month = lookupMonth(monthToken);
    if (month === null) {
      return { iso: null, confidence: 0, sourceFormat: 'unknown', warnings: [`Nama bulan tidak dikenali: "${monthToken}" (dari "${str}").`] };
    }
    const warnings: string[] = ['Tidak ada informasi hari pada input -- diasumsikan tanggal 1 pada bulan tersebut.'];
    let year: number;
    let sourceFormat: string;
    let confidence: number;
    if (yearDigits.length >= 4) {
      year = Number(yearDigits);
      sourceFormat = 'month-year-4digit';
      const yearWarnMy = yearPlausibilityWarning(year, str);
      if (yearWarnMy) warnings.push(yearWarnMy);
      confidence = yearWarnMy ? 0.5 : 0.75;
    } else {
      const resolved = resolveTwoDigitYear(Number(yearDigits));
      year = resolved.year;
      warnings.push(resolved.warning);
      sourceFormat = 'month-year-2digit';
      confidence = 0.55;
    }
    return { iso: toIso(year, month, 1), confidence, sourceFormat, warnings };
  }

  return { iso: null, confidence: 0, sourceFormat: 'unknown', warnings: [`Format tanggal tidak dikenali: "${str}".`] };
}

// ---------------------------------------------------------------------------
// parseReportPeriod
// ---------------------------------------------------------------------------

const PERIOD_SEPARATOR_RE = /\s*(?:s\.?\s?d\.?|sampai(?:\s+dengan)?|hingga|-|–|—)\s*/i;
const PERIOD_PREFIX_RE = /^(?:bulan|periode)\s+/i;

function splitPeriodHeader(header: string): [string, string] | null {
  const match = PERIOD_SEPARATOR_RE.exec(header);
  if (!match || match.index === undefined) return null;
  const left = header.slice(0, match.index).trim().replace(PERIOD_PREFIX_RE, '').trim();
  const right = header.slice(match.index + match[0].length).trim().replace(PERIOD_PREFIX_RE, '').trim();
  if (!left || !right) return null;
  return [left, right];
}

/**
 * Parse header periode laporan gaya "BULAN JAN.2014 - OKT.2015" atau
 * "JANUARI 2014 s.d. OKTOBER 2015" jadi rentang tanggal ISO. Fragmen awal diperlakukan
 * sebagai AWAL bulan (tanggal 1), fragmen akhir diperlakukan sebagai AKHIR bulan
 * (tanggal terakhir di bulan itu) -- supaya rentang mencakup seluruh bulan terakhir,
 * bukan cuma tanggal 1-nya.
 */
export function parseReportPeriod(header: string): ReportPeriod {
  const warnings: string[] = [];
  const parts = splitPeriodHeader(header.trim());
  if (!parts) {
    return { startIso: null, endIso: null, warnings: [`Tidak bisa memisahkan header periode: "${header}" (pemisah "-" atau "s.d." tidak ditemukan).`] };
  }
  const [leftRaw, rightRaw] = parts;
  const startParsed = parseIndonesianDate(leftRaw);
  const endParsed = parseIndonesianDate(rightRaw);
  warnings.push(...startParsed.warnings, ...endParsed.warnings);

  let endIso = endParsed.iso;
  if (endIso && (endParsed.sourceFormat === 'month-year-4digit' || endParsed.sourceFormat === 'month-year-2digit')) {
    const [y, mo] = endIso.split('-').map(Number);
    endIso = toIso(y, mo, daysInMonth(y, mo));
  }

  return { startIso: startParsed.iso, endIso, warnings };
}

// ---------------------------------------------------------------------------
// detectDateAnomalies
// ---------------------------------------------------------------------------

function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

function isDigitTransposition(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length - 1; i++) {
    const swapped = a.slice(0, i) + a[i + 1] + a[i] + a.slice(i + 2);
    if (swapped === b) return true;
  }
  return false;
}

function findNearestValid(dates: DateAnomalyInput[], idx: number, direction: 1 | -1): DateAnomalyInput | null {
  for (let i = idx + direction; i >= 0 && i < dates.length; i += direction) {
    if (dates[i].iso) return dates[i];
  }
  return null;
}

/**
 * Mendeteksi 6 kelas anomali tanggal pada satu deret baris ledger yang SUDAH diparse
 * lewat parseIndonesianDate(). Tidak pernah mengubah input -- hanya mengusulkan.
 * `period` opsional: kalau diisi (dari parseReportPeriod), baris di luar rentang
 * periode laporan ikut ditandai (kelas 'out-of-period').
 */
export function detectDateAnomalies(dates: DateAnomalyInput[], period?: { startIso: string | null; endIso: string | null }): DateAnomaly[] {
  const anomalies: DateAnomaly[] = [];
  let lastValid: DateAnomalyInput | null = null;
  const seen = new Map<string, number>();

  for (let i = 0; i < dates.length; i++) {
    const row = dates[i];

    // (c) tanggal mustahil / tidak bisa diparse sama sekali, TAPI ada raw input yang
    // sebetulnya coba menyatakan tanggal (bukan sekadar sel kosong).
    if (row.iso === null && row.raw !== null && row.raw !== undefined && row.raw !== '') {
      anomalies.push({
        row: row.row, kind: 'impossible-date', raw: row.raw,
        suggestion: 'Tidak bisa diparse sebagai tanggal valid -- periksa manual (kemungkinan tanggal mustahil, mis. 31 Februari, atau format tidak dikenali).',
        severity: 'high',
      });
    }

    if (row.iso) {
      // (a) urutan tidak monoton (mundur dibanding baris valid sebelumnya)
      if (lastValid && row.iso < lastValid.iso!) {
        anomalies.push({
          row: row.row, kind: 'non-monotonic', raw: row.raw,
          suggestion: `Tanggal (${row.iso}) mundur dibanding baris ${lastValid.row} (${lastValid.iso}) -- ledger diasumsikan kronologis.`,
          severity: 'medium',
        });
      }

      // (b) nama hari tidak cocok
      if (row.dayName) {
        const writtenIdx = lookupWeekday(row.dayName);
        const actualName = indonesianWeekdayName(row.iso);
        if (writtenIdx !== null && WEEKDAY_NAMES[writtenIdx] !== actualName) {
          anomalies.push({
            row: row.row, kind: 'day-name-mismatch', raw: row.raw,
            suggestion: `Tanggal ${row.iso} sebenarnya hari ${actualName}, bukan ${row.dayName} seperti tertulis.`,
            severity: 'low',
          });
        }
      }

      // (f) di luar rentang periode laporan yang dideklarasikan
      if (period?.startIso && period?.endIso && (row.iso < period.startIso || row.iso > period.endIso)) {
        anomalies.push({
          row: row.row, kind: 'out-of-period', raw: row.raw,
          suggestion: `Tanggal ${row.iso} di luar rentang periode laporan (${period.startIso} s.d. ${period.endIso}).`,
          severity: 'medium',
        });
      }

      // (e) duplikat persis (iso + raw sama persis dengan baris sebelumnya)
      const dupKey = `${row.iso}::${JSON.stringify(row.raw)}`;
      const firstRow = seen.get(dupKey);
      if (firstRow !== undefined) {
        anomalies.push({
          row: row.row, kind: 'duplicate', raw: row.raw,
          suggestion: `Baris ${row.row} tampak duplikat persis dari baris ${firstRow} (tanggal ${row.iso}, nilai raw identik).`,
          severity: 'low',
        });
      } else {
        seen.set(dupKey, row.row);
      }

      lastValid = row;
    }
  }

  // (d) lompatan tahun mencurigakan -- dicek terpisah karena butuh tetangga KIRI dan KANAN,
  // bukan cuma histori berjalan dari kiri seperti (a).
  for (let i = 0; i < dates.length; i++) {
    const row = dates[i];
    if (!row.iso) continue;
    const year = yearOf(row.iso);
    const prev = findNearestValid(dates, i, -1);
    const next = findNearestValid(dates, i, 1);
    const prevYear = prev ? yearOf(prev.iso!) : null;
    const nextYear = next ? yearOf(next.iso!) : null;

    let suspicious = false;
    let referenceYear: number | null = null;
    if (prevYear !== null && nextYear !== null) {
      if (year !== prevYear && year !== nextYear && Math.abs(prevYear - nextYear) <= 2 && Math.abs(year - prevYear) >= 20) {
        suspicious = true;
        referenceYear = prevYear;
      }
    } else if (prevYear !== null && Math.abs(year - prevYear) >= 50) {
      suspicious = true;
      referenceYear = prevYear;
    } else if (nextYear !== null && Math.abs(year - nextYear) >= 50) {
      suspicious = true;
      referenceYear = nextYear;
    }

    if (suspicious && referenceYear !== null) {
      const transposed = isDigitTransposition(String(year), String(referenceYear));
      anomalies.push({
        row: row.row, kind: 'suspicious-year-jump', raw: row.raw,
        suggestion: transposed
          ? `Tahun ${year} kemungkinan salah ketik (digit tertukar) dari ${referenceYear} -- baris tetangga konsisten di ${referenceYear}.`
          : `Tahun ${year} melompat jauh dibanding baris sekitarnya (sekitar ${referenceYear}) -- kemungkinan salah ketik.`,
        severity: 'high',
      });
    }
  }

  return anomalies;
}
