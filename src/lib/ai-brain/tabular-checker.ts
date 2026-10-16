/**
 * Generalisasi document-check untuk file TABULAR non-ledger (xlsx/xls/csv yang
 * bukan buku kas/ledger bookkeeping -- roadmap 2026-09-06 Bagian 3.4). Ledger
 * beneran tetap lewat ledger-parser.ts/ledger-validator.ts yang jauh lebih
 * spesifik (chart-of-accounts, debit/kredit, reconciliation). Modul ini untuk
 * tabel generik lain: daftar karyawan, absensi, daftar kontak, dsb -- yang
 * hanya butuh cek struktur dasar (header, duplikat baris, sel kosong wajib,
 * kolom bertipe tanggal) tanpa pengetahuan domain akuntansi.
 *
 * DETERMINISTIK, NOL LLM. REUSE parseIndoNumber + parseIndonesianDate dari
 * modul yang sudah ada (hindari 2 implementasi beda untuk hal yang sama,
 * pelajaran M-895-class), bukan ditulis ulang di sini.
 *
 * Input `csvOrTabularText` diasumsikan format CSV/TSV-like (baris dipisah \n,
 * sel dipisah koma) -- konsisten dengan extractTextFromFile() di
 * documents/analyze/route.ts yang mengubah sheet xlsx jadi CSV via
 * XLSX.utils.sheet_to_csv() sebelum diteruskan ke checker manapun.
 */

import { parseIndonesianDate } from './date-normalizer';
import { parseIndoNumber } from './ledger-parser';
import type { DocumentAnomaly } from './document-checker';

export interface TabularCheckReport {
  headers: string[];
  rowCount: number;
  anomalies: DocumentAnomaly[];
}

/** Parser CSV baris-per-baris yang sangat sederhana (tanpa dependency baru):
 *  menangani sel dikutip dengan tanda kutip ganda ("...") termasuk koma di
 *  dalamnya, cukup untuk output XLSX.utils.sheet_to_csv() yang jadi sumber
 *  utama input fungsi ini. TIDAK menangani newline di dalam sel berkutip
 *  (sheet_to_csv tidak menghasilkan itu untuk sel sheet biasa). */
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

function looksLikeDateColumn(header: string): boolean {
  const h = header.toLowerCase();
  return h.includes('tanggal') || h.includes('tgl') || h.includes('date');
}

function rowHash(row: string[]): string {
  return row.join('');
}

/**
 * Cek tabel generik: deteksi header, jumlah baris data, kolom bertipe tanggal
 * yang gagal parse (via parseIndonesianDate), duplikat baris identik, dan sel
 * kosong pada kolom yang seharusnya wajib terisi (kolom yang di sebagian besar
 * baris lain terisi, tapi kosong di baris tertentu -- heuristik "incomplete-row").
 */
export function checkTabularText(csvOrTabularText: string, meta: { fileName: string }): TabularCheckReport {
  void meta;
  const rawLines = csvOrTabularText.split('\n').filter((l) => l.trim().length > 0);
  if (rawLines.length === 0) {
    return { headers: [], rowCount: 0, anomalies: [] };
  }

  const rows = rawLines.map(parseCsvLine);
  const headers = rows[0];
  const dataRows = rows.slice(1);
  const anomalies: DocumentAnomaly[] = [];

  // --- kolom bertipe tanggal: cek tiap sel di kolom itu bisa diparse ---
  headers.forEach((header, colIdx) => {
    if (!looksLikeDateColumn(header)) return;
    dataRows.forEach((row, rowIdx) => {
      const cell = row[colIdx];
      if (!cell) return;
      const parsed = parseIndonesianDate(cell);
      if (!parsed.iso) {
        anomalies.push({
          kind: 'impossible-date',
          severity: 'warning',
          explanation: `Kolom "${header}" baris ${rowIdx + 2} berisi "${cell}" yang tidak bisa diparse sebagai tanggal.`,
          evidence: { column: header, row: rowIdx + 2, raw: cell },
          suggestion: 'Periksa format tanggal pada sel ini.',
        });
      }
    });
  });

  // --- duplikat baris identik ---
  const seen = new Map<string, number>();
  dataRows.forEach((row, rowIdx) => {
    const hash = rowHash(row);
    if (row.every((cell) => !cell)) return; // baris kosong total diabaikan
    const firstSeenAt = seen.get(hash);
    if (firstSeenAt !== undefined) {
      anomalies.push({
        kind: 'duplicate-row',
        severity: 'info',
        explanation: `Baris data ${rowIdx + 2} identik persis dengan baris ${firstSeenAt + 2}.`,
        evidence: { row: rowIdx + 2, duplicateOfRow: firstSeenAt + 2 },
        suggestion: 'Periksa apakah ini duplikasi data yang tidak disengaja.',
      });
    } else {
      seen.set(hash, rowIdx);
    }
  });

  // --- sel kosong wajib: kolom terisi di >=80% baris lain, tapi kosong di baris ini ---
  if (dataRows.length >= 3) {
    headers.forEach((header, colIdx) => {
      const filledCount = dataRows.filter((row) => (row[colIdx] ?? '').trim().length > 0).length;
      const fillRatio = filledCount / dataRows.length;
      if (fillRatio < 0.8 || fillRatio === 0) return; // kolom memang jarang/tidak pernah terisi -- bukan anomali per-baris
      dataRows.forEach((row, rowIdx) => {
        const cell = (row[colIdx] ?? '').trim();
        if (cell.length === 0) {
          anomalies.push({
            kind: 'missing-required-cell',
            severity: 'info',
            explanation: `Kolom "${header}" terisi di ${Math.round(fillRatio * 100)}% baris lain, tapi kosong di baris ${rowIdx + 2}.`,
            evidence: { column: header, row: rowIdx + 2, fillRatio },
            suggestion: 'Periksa apakah data untuk sel ini terlewat saat pengisian.',
          });
        }
      });
    });
  }

  // --- nominal parse-check ringan (opsional, membantu deteksi kolom finansial
  //     bertipe string berformat, temuan riset Trakindo babak2) ---
  headers.forEach((header, colIdx) => {
    const h = header.toLowerCase();
    if (!h.includes('nominal') && !h.includes('gaji') && !h.includes('jumlah') && !h.includes('total')) return;
    dataRows.forEach((row, rowIdx) => {
      const cell = row[colIdx];
      if (!cell) return;
      const parsed = parseIndoNumber(cell);
      if (parsed === null) {
        anomalies.push({
          kind: 'nominal-mismatch',
          severity: 'info',
          explanation: `Kolom "${header}" baris ${rowIdx + 2} berisi "${cell}" yang tidak bisa diparse sebagai angka.`,
          evidence: { column: header, row: rowIdx + 2, raw: cell },
          suggestion: 'Periksa format angka pada sel ini.',
        });
      }
    });
  });

  return { headers, rowCount: dataRows.length, anomalies };
}
