/**
 * Generalisasi "upload dokumen -> cek data lama/baru, typo, konsistensi" ke luar
 * ledger (roadmap 2026-09-06 Bagian 3.4). Berlaku untuk dokumen teks bebas apapun
 * (CV, kontrak, surat, hasil ekstraksi PDF/DOCX) -- BUKAN untuk file tabular
 * (xlsx/xls/csv), yang punya modul terpisah lebih akurat: lihat tabular-checker.ts.
 *
 * DETERMINISTIK DULU, LLM BELAKANGAN (prinsip inti ledger-parser dipertahankan):
 * file ini TIDAK PERNAH memanggil LLM. Semua entitas + anomali dihitung lewat
 * regex/heuristik murni supaya hasilnya reproducible dan bisa dipercaya sebagai
 * dasar sebelum LLM menarasikan.
 *
 * REUSE, bukan duplikasi (pelajaran M-895-class -- 2 jalur baca tanggal/angka
 * berbeda untuk hal yang sama = sumber bug diam-diam): parser tanggal dan angka
 * TIDAK ditulis ulang di sini, dipakai langsung dari date-normalizer.ts dan
 * ledger-parser.ts yang sudah teruji.
 *
 * BATASAN JUJUR (bukan diklaim seakurat ledger-parser): fungsi ini menerima
 * `text` hasil extractTextFromFile() di documents/analyze/route.ts, yang untuk
 * PDF/DOCX adalah teks hasil "flatten" (kolom/tabel asli sudah hilang, lihat
 * catatan di ledger-parser.ts soal keterbatasan serupa). Deteksi di sini karena
 * itu bekerja di atas teks linear, bukan struktur tabel asli -- untuk file
 * tabular (xlsx/xls/csv) pakai tabular-checker.ts yang punya akses ke baris/kolom
 * asli dan jauh lebih presisi.
 */

import { parseIndonesianDate, detectDateAnomalies, type DateAnomalyInput } from './date-normalizer';
import { parseIndoNumber } from './ledger-parser';

// ---------------------------------------------------------------------------
// Tipe publik
// ---------------------------------------------------------------------------

export type DocumentEntityType = 'tanggal' | 'nominal' | 'nik' | 'npwp' | 'email' | 'hp' | 'nama';

export interface DocumentEntity {
  type: DocumentEntityType;
  raw: string;
  normalized: string | null;
  /** Nomor baris (1-based, berdasarkan pemisah baris teks) tempat entitas ditemukan. */
  row?: number;
}

export type DocumentAnomalyKind =
  | 'impossible-date'
  | 'date-range-invalid'
  | 'nominal-mismatch'
  | 'nik-invalid-length'
  | 'duplicate-row'
  | 'typo-candidate'
  | 'missing-required-cell';

export type DocumentAnomalySeverity = 'info' | 'warning' | 'critical';

export interface DocumentAnomaly {
  kind: DocumentAnomalyKind;
  severity: DocumentAnomalySeverity;
  explanation: string;
  evidence: Record<string, unknown>;
  suggestion: string | null;
}

export interface DocumentCheckReport {
  entities: DocumentEntity[];
  anomalies: DocumentAnomaly[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Regex heuristik (belum ada di codebase sebelum modul ini)
// ---------------------------------------------------------------------------

const RE_NIK = /\b\d{16}\b/g;
const RE_NPWP = /\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b/g;
const RE_EMAIL = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
// Nomor HP Indonesia: +62/62/0 diikuti 8, lalu 8-11 digit lagi.
const RE_HP = /\b(?:\+62|62|0)8\d{8,11}\b/g;
// Kandidat nama: 2+ kata berurutan yang masing-masing diawali huruf kapital
// (mis. "Budi Santoso", "Siti Aminah Putri"). Sengaja tidak menangkap 1 kata
// kapital tunggal (terlalu banyak false-positive: awal kalimat, judul dokumen).
const RE_NAMA_KAPITAL = /\b[A-Z][a-zA-Z'.]*(?:[ \t]+[A-Z][a-zA-Z'.]*){1,3}\b/g;
// Kandidat tanggal tekstual (untuk diserahkan ke parseIndonesianDate) -- pola umum
// dd/mm/yyyy, dd-mm-yyyy, "dd Bulan yyyy", ISO yyyy-mm-dd.
const RE_TANGGAL_KANDIDAT =
  /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+[A-Za-z]+\.?\s+\d{4})\b/g;
// Kandidat nominal rupiah: "Rp" opsional + digit dengan pemisah ribuan/desimal.
const RE_NOMINAL_KANDIDAT = /\bRp\.?\s?[\d.,]+\b|\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?\b/g;
// Label field "tanggal mulai" vs "tanggal akhir/berakhir/selesai" untuk deteksi
// kontrak yang interval-nya kebalik.
//
// PENGERASAN (pola #6 "pergeseran penamaan kolom/label antar berkas untuk konsep yang
// sama"): sebelumnya prefiks "tanggal"/"tgl" WAJIB ada persis sebelum "mulai"/"akhir" --
// dokumen yang menulis "Mulai Kerja: ..." atau "Berakhir Kontrak: ..." (tanpa kata
// "tanggal"/"tgl" sama sekali, sama umumnya di kontrak kerja Indonesia) LOLOS TOTAL dari
// deteksi tanggal-akhir-sebelum-mulai. Sinonim di bawah dibatasi ke kombinasi kata yang
// SUDAH jelas berarti field tanggal (bukan kata "mulai"/"berakhir" bebas dalam kalimat
// biasa, mis. "kegiatan akan dimulai tahun depan") -- setiap alternatif tetap butuh
// kualifier eksplisit ("tanggal/tgl" ATAU "kerja/kontrak/bekerja") supaya tidak jadi
// menebak dari prosa bebas.
const RE_LABEL_MULAI = /(?:(?:tanggal|tgl)\.?\s*mulai|mulai\s*(?:kerja|kontrak|bekerja))[^\n:]*:?\s*([^\n]+)/i;
const RE_LABEL_AKHIR =
  /(?:(?:tanggal|tgl)\.?\s*(?:akhir|berakhir|selesai)|(?:berakhir|selesai)\s*(?:kerja|kontrak))[^\n:]*:?\s*([^\n]+)/i;

// ---------------------------------------------------------------------------
// Helper internal
// ---------------------------------------------------------------------------

function findLineNumber(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

/** Jarak Levenshtein dibatasi hanya untuk membedakan distance <= 1 dari sisanya
 *  (cukup untuk deteksi typo-kandidat, tidak perlu implementasi penuh O(n*m) DP
 *  generik -- tapi tetap dipakai versi standar supaya benar untuk semua panjang). */
function levenshteinAtMost1(a: string, b: string): boolean {
  if (a === b) return false;
  const lenDiff = Math.abs(a.length - b.length);
  if (lenDiff > 1) return false;
  if (a.length === b.length) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) {
        diff++;
        if (diff > 1) return false;
      }
    }
    return diff === 1;
  }
  // Panjang beda 1 -- cek apakah salah satu adalah hasil sisip/hapus 1 karakter dari yang lain.
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else if (!skipped) {
      skipped = true;
      j++;
    } else {
      return false;
    }
  }
  return true;
}

function extractEntities(text: string): DocumentEntity[] {
  const entities: DocumentEntity[] = [];

  for (const m of text.matchAll(RE_NIK)) {
    entities.push({ type: 'nik', raw: m[0], normalized: m[0], row: findLineNumber(text, m.index ?? 0) });
  }
  for (const m of text.matchAll(RE_NPWP)) {
    entities.push({ type: 'npwp', raw: m[0], normalized: m[0].replace(/[.\-]/g, ''), row: findLineNumber(text, m.index ?? 0) });
  }
  for (const m of text.matchAll(RE_EMAIL)) {
    entities.push({ type: 'email', raw: m[0], normalized: m[0].toLowerCase(), row: findLineNumber(text, m.index ?? 0) });
  }
  for (const m of text.matchAll(RE_HP)) {
    entities.push({ type: 'hp', raw: m[0], normalized: m[0], row: findLineNumber(text, m.index ?? 0) });
  }
  for (const m of text.matchAll(RE_TANGGAL_KANDIDAT)) {
    const parsed = parseIndonesianDate(m[0]);
    entities.push({ type: 'tanggal', raw: m[0], normalized: parsed.iso, row: findLineNumber(text, m.index ?? 0) });
  }
  for (const m of text.matchAll(RE_NOMINAL_KANDIDAT)) {
    const parsed = parseIndoNumber(m[0]);
    entities.push({ type: 'nominal', raw: m[0], normalized: parsed !== null ? String(parsed) : null, row: findLineNumber(text, m.index ?? 0) });
  }
  for (const m of text.matchAll(RE_NAMA_KAPITAL)) {
    entities.push({ type: 'nama', raw: m[0], normalized: m[0].trim(), row: findLineNumber(text, m.index ?? 0) });
  }

  return entities;
}

/** (impossible-date + di luar 1950-2100) dari SEMUA entitas tanggal yang berhasil
 *  di-extract, mendelegasikan pekerjaan deteksi ke detectDateAnomalies() yang
 *  sudah ada -- tidak menulis ulang logikanya di sini. */
function checkDateAnomalies(dateEntities: DocumentEntity[]): DocumentAnomaly[] {
  if (dateEntities.length === 0) return [];
  const inputs: DateAnomalyInput[] = dateEntities.map((e) => ({
    row: e.row ?? 0,
    iso: e.normalized,
    raw: e.raw,
  }));
  const found = detectDateAnomalies(inputs);
  return found
    .filter((a) => a.kind === 'impossible-date' || a.kind === 'suspicious-year-jump')
    .map((a) => ({
      kind: 'impossible-date' as const,
      severity: (a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info') as DocumentAnomalySeverity,
      explanation: a.suggestion ?? `Tanggal bermasalah pada baris ${a.row}: ${String(a.raw)}`,
      evidence: { row: a.row, raw: a.raw },
      suggestion: a.suggestion,
    }));
}

/** Deteksi tanggal-akhir-sebelum-tanggal-mulai untuk pola kontrak "tanggal mulai: ...
 *  tanggal akhir/berakhir/selesai: ..." di teks bebas. */
function checkDateRangeInterval(text: string): DocumentAnomaly[] {
  const mulaiMatch = RE_LABEL_MULAI.exec(text);
  const akhirMatch = RE_LABEL_AKHIR.exec(text);
  if (!mulaiMatch || !akhirMatch) return [];

  const mulaiRaw = mulaiMatch[1].trim();
  const akhirRaw = akhirMatch[1].trim();
  const mulaiParsed = parseIndonesianDate(mulaiRaw);
  const akhirParsed = parseIndonesianDate(akhirRaw);
  if (!mulaiParsed.iso || !akhirParsed.iso) return [];

  if (akhirParsed.iso < mulaiParsed.iso) {
    return [
      {
        kind: 'date-range-invalid',
        severity: 'critical',
        explanation: `Tanggal akhir (${akhirParsed.iso}, ditulis "${akhirRaw}") berada sebelum tanggal mulai (${mulaiParsed.iso}, ditulis "${mulaiRaw}") -- kemungkinan salah tulis atau tertukar.`,
        evidence: { mulaiRaw, akhirRaw, mulaiIso: mulaiParsed.iso, akhirIso: akhirParsed.iso },
        suggestion: 'Periksa manual apakah tanggal mulai/akhir tertukar atau salah ketik.',
      },
    ];
  }
  return [];
}

/** Nominal ditulis 2x beda untuk konteks yang sama (mis. angka vs terbilang) --
 *  heuristik sederhana: kalau ada >=2 nominal berbeda ditemukan dalam jarak
 *  dekat (baris yang sama atau baris berdekatan) tanpa label pembeda jelas,
 *  ditandai info-level (bukan pasti error, cuma layak dicek manual). */
function checkNominalConsistency(entities: DocumentEntity[]): DocumentAnomaly[] {
  const nominals = entities.filter((e) => e.type === 'nominal' && e.normalized !== null);
  const byLine = new Map<number, DocumentEntity[]>();
  for (const n of nominals) {
    const line = n.row ?? 0;
    const arr = byLine.get(line) ?? [];
    arr.push(n);
    byLine.set(line, arr);
  }
  const anomalies: DocumentAnomaly[] = [];
  for (const [line, group] of byLine) {
    const uniqueValues = new Set(group.map((g) => g.normalized));
    if (uniqueValues.size > 1) {
      anomalies.push({
        kind: 'nominal-mismatch',
        severity: 'warning',
        explanation: `Baris ${line} punya ${uniqueValues.size} nilai nominal berbeda (${Array.from(uniqueValues).join(', ')}) -- kemungkinan angka vs terbilang tidak konsisten.`,
        evidence: { row: line, values: Array.from(uniqueValues) },
        suggestion: 'Periksa manual apakah angka dan terbilang menyatakan nilai yang sama.',
      });
    }
  }
  return anomalies;
}

/** NIK harus tepat 16 digit -- RE_NIK sudah men-anchor \b...\b jadi false-negative
 *  untuk NIK yang salah panjang (mis. 15 atau 17 digit tertulis berdempetan tanpa
 *  spasi) mungkin lolos dari regex NIK itu sendiri. Untuk kasus yang teksnya
 *  eksplisit menyebut "NIK" diikuti angka yang BUKAN 16 digit, ditandai di sini
 *  memakai pola label terpisah.
 *
 * PENGERASAN (pola #3 "konsep sama, representasi beda"): NIK kadang ditulis
 * TERSEGMENTASI dengan pemisah dash/titik antar kelompok digit (gaya penulisan yang
 * umum untuk nomor identitas panjang, mis. 4 kelompok dipisah dash) -- SEBELUM
 * perbaikan ini, `\d{1,20}` berhenti di pemisah pertama (cuma menangkap kelompok
 * PERTAMA) sehingga NIK yang SEBENARNYA VALID (16 digit kalau pemisah dibuang) salah
 * ditandai sebagai nik-invalid-length -- false positive. Sekarang capture group
 * pertama tetap murni digit (`\d+`, unbounded -- BUKAN regresi untuk kasus contiguous
 * yang sudah benar), lalu grup berikutnya (opsional, berulang) menangkap kelanjutan
 * segmen "pemisah+digit" -- panjang akhir dihitung SETELAH pemisah dibuang. Pemisah
 * SENGAJA dibatasi ke dash/titik saja (BUKAN spasi bebas) -- spasi terlalu umum di
 * prosa biasa (mis. NIK diikuti keterangan tahun terpisah spasi) dan kalau diterima
 * sebagai penyambung segmen akan menelan angka tak terkait sebagai bagian NIK (false
 * positive ke arah sebaliknya).
 */
const RE_LABEL_NIK = /\bNIK\b\s*:?\s*(\d+(?:[-.]\d+)*)/gi;
function checkNikLength(text: string): DocumentAnomaly[] {
  const anomalies: DocumentAnomaly[] = [];
  for (const m of text.matchAll(RE_LABEL_NIK)) {
    const raw = m[1];
    const digits = raw.replace(/[^\d]/g, '');
    if (digits.length !== 16) {
      anomalies.push({
        kind: 'nik-invalid-length',
        severity: 'critical',
        explanation: `NIK "${raw}" berjumlah ${digits.length} digit, seharusnya tepat 16 digit.`,
        evidence: { row: findLineNumber(text, m.index ?? 0), raw, length: digits.length },
        suggestion: 'Periksa manual -- kemungkinan digit tertinggal/tertukar saat pengetikan.',
      });
    }
  }
  return anomalies;
}

/** Duplikat baris identik (teks baris non-kosong yang sama persis muncul >1x). */
function checkDuplicateRows(text: string): DocumentAnomaly[] {
  const lines = text.split('\n').map((l) => l.trim());
  const seen = new Map<string, number>();
  const anomalies: DocumentAnomaly[] = [];
  lines.forEach((line, idx) => {
    if (line.length < 8) return; // baris terlalu pendek (mis. header kosong) diabaikan
    const firstSeenAt = seen.get(line);
    if (firstSeenAt !== undefined) {
      anomalies.push({
        kind: 'duplicate-row',
        severity: 'info',
        explanation: `Baris ${idx + 1} identik persis dengan baris ${firstSeenAt + 1}.`,
        evidence: { row: idx + 1, duplicateOfRow: firstSeenAt + 1, text: line },
        suggestion: 'Periksa apakah ini duplikasi data yang tidak disengaja.',
      });
    } else {
      seen.set(line, idx);
    }
  });
  return anomalies;
}

/** Typo-kandidat: nama-nama yang sudah diekstrak (BUKAN token generik dalam
 *  dokumen -- membatasi scope supaya tidak noise di CV/kontrak panjang) yang
 *  berjarak Levenshtein <=1 satu sama lain dan keduanya benar-benar muncul di
 *  teks -- kemungkinan orang yang sama tertulis beda karena typo. Severity info
 *  (bukan warning/critical) karena false-positive tetap mungkin (mis. dua orang
 *  beda dengan nama mirip). */
function checkTypoCandidates(entities: DocumentEntity[]): DocumentAnomaly[] {
  const names = Array.from(new Set(entities.filter((e) => e.type === 'nama').map((e) => e.normalized ?? e.raw)));
  const anomalies: DocumentAnomaly[] = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      if (levenshteinAtMost1(names[i], names[j])) {
        anomalies.push({
          kind: 'typo-candidate',
          severity: 'info',
          explanation: `Nama "${names[i]}" dan "${names[j]}" hanya berbeda 1 karakter -- kemungkinan orang yang sama tertulis dengan typo/variasi.`,
          evidence: { nameA: names[i], nameB: names[j] },
          suggestion: 'Periksa manual apakah keduanya merujuk orang yang sama.',
        });
      }
    }
  }
  return anomalies;
}

function buildSummary(entities: DocumentEntity[], anomalies: DocumentAnomaly[]): string {
  const entityCounts = entities.reduce<Record<string, number>>((acc, e) => {
    acc[e.type] = (acc[e.type] ?? 0) + 1;
    return acc;
  }, {});
  const entityText = Object.entries(entityCounts)
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');
  if (anomalies.length === 0) {
    return `Entitas ditemukan (${entityText || 'tidak ada'}). Tidak ada anomali terdeteksi.`;
  }
  const bySeverity = anomalies.reduce<Record<string, number>>((acc, a) => {
    acc[a.severity] = (acc[a.severity] ?? 0) + 1;
    return acc;
  }, {});
  const severityText = Object.entries(bySeverity)
    .map(([sev, count]) => `${sev}: ${count}`)
    .join(', ');
  return `Entitas ditemukan (${entityText || 'tidak ada'}). ${anomalies.length} anomali terdeteksi (${severityText}).`;
}

// ---------------------------------------------------------------------------
// Entry point publik
// ---------------------------------------------------------------------------

/**
 * Cek dokumen teks bebas (hasil ekstraksi PDF/DOCX/TXT atau teks JSON) secara
 * deterministik: ekstrak entitas terstruktur + deteksi anomali. NOL panggilan
 * LLM. `meta.fileName` dipakai hanya untuk konteks pesan, tidak mempengaruhi
 * logika deteksi.
 */
export function checkDocumentText(text: string, meta: { fileName: string }): DocumentCheckReport {
  void meta; // dicadangkan untuk konteks pesan di masa depan, belum dipakai logic saat ini
  const entities = extractEntities(text);

  const anomalies: DocumentAnomaly[] = [
    ...checkDateAnomalies(entities.filter((e) => e.type === 'tanggal')),
    ...checkDateRangeInterval(text),
    ...checkNominalConsistency(entities),
    ...checkNikLength(text),
    ...checkDuplicateRows(text),
    ...checkTypoCandidates(entities),
  ];

  return {
    entities,
    anomalies,
    summary: buildSummary(entities, anomalies),
  };
}
