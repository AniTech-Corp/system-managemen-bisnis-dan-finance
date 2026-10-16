/**
 * FASE BUILD 8 Sep 2026 -- V4a/V4b/V4c: deteksi kesalahan data end-to-end di
 * jalur Pusat Data (workspace-files). REUSE deterministik document-checker.ts /
 * tabular-checker.ts (SUDAH ADA & teruji, sebelumnya HANYA dipakai jalur
 * lampiran chat via documents/analyze/route.ts) -- modul ini SATU-SATUNYA
 * titik pemakaian keduanya untuk jalur Pusat Data, dipanggil dari
 * workspace-files/route.ts (jalur non-zip DAN per-entri zip, pola SAMA PERSIS).
 *
 * DETERMINISTIK, NOL LLM (document-checker.ts/tabular-checker.ts sendiri sudah
 * NOL LLM -- modul ini cuma menyambungkan, tidak menambah panggilan apapun).
 * NOL kolom Prisma baru -- dataQualityCount/dataQualityWorst di GET list
 * workspace-files/route.ts DIPARSE dari HEADER TEKS blok "[PEMERIKSAAN DATA]"
 * yang disisipkan di awal WorkspaceFile.extractedSummary (regex, bukan struktur
 * DB baru), sesuai instruksi keras context pack "tanpa kolom baru".
 *
 * KETERBATASAN JUJUR (WAJIB dibaca sebelum mengira ini bug baru): TABULAR_EXT
 * (xlsx/xls/xlsm/csv) memakai checkTabularText() yang mengasumsikan `content`
 * berformat CSV (dipisah koma) -- untuk xlsx/xls, extractTextForWorkspaceFile()
 * SEBENARNYA menghasilkan teks TABEL MARKDOWN ("| sel | sel |"), BUKAN CSV murni
 * (lihat cabang xlsx di documents/extract-text/route.ts, dipakai lewat
 * extractTextForWorkspaceFile()). Ini BUKAN bug baru yang diperkenalkan modul
 * ini -- pola ini SAMA PERSIS dengan tryCheckDocument() yang sudah lebih dulu
 * ada di documents/analyze/route.ts (TABULAR_EXTENSIONS yang sama, dipanggil
 * dengan `content` hasil ekstraksi yang juga markdown-table untuk xlsx).
 * Akibatnya checkTabularText() menganggap 1 baris markdown sebagai 1 kolom
 * tunggal (tidak ada koma) -- deteksi kolom tanggal/nominal by-name jadi tidak
 * relevan, TAPI cek duplikat-baris dan sel-kosong-tipikal tetap bisa memicu
 * temuan info-level (DIBUKTIKAN lewat probe manual terhadap fixture sintetis
 * 8 Sep -- lihat catatan_jujur laporan build). Memperbaiki asumsi format
 * checker ini DI LUAR scope wave 8 Sep (butuh keputusan: parse ulang jadi CSV
 * asli sebelum cek, atau checker versi tabel-markdown terpisah) -- TIDAK
 * disentuh di sini, hanya diwariskan apa adanya dari pola yang sudah ada.
 */

import { checkDocumentText, type DocumentAnomaly, type DocumentCheckReport } from './ai-brain/document-checker';
import { checkTabularText, type TabularCheckReport } from './ai-brain/tabular-checker';
import { getFileExtension } from './workspace-file-extraction';
// 8 Sep: helper murni dipindah ke modul aman-browser (lihat JSDoc di sana); re-export utk pemakai server.
import { worstSeverity, parseDataQualityHeader, extractDqBlockText, DQ_HEADER_RE } from './workspace-file-dataquality-shared';
export { worstSeverity, parseDataQualityHeader, extractDqBlockText, DQ_HEADER_RE };

/** Sama persis TABULAR_EXTENSIONS di documents/analyze/route.ts (L147) --
 *  DISALIN (bukan diimpor) supaya modul lib ini tidak menyeret dependency ke
 *  file `route.ts` App Router (import lintas route handler dari modul lib
 *  biasa berisiko efek samping build Next.js yang tidak perlu untuk 1 baris
 *  konstanta). Kalau daftar ekstensi tabular berubah di sana, sinkronkan manual
 *  ke sini juga -- technical debt kecil yang sama filosofinya dengan duplikasi
 *  workspace-file-ledger.ts vs documents/extract-text/route.ts. */
export const TABULAR_EXT: ReadonlySet<string> = new Set(['xlsx', 'xls', 'xlsm', 'csv']);

/**
 * Coba jalankan document-check/tabular-check deterministik atas `content` (teks
 * HASIL EKSTRAKSI, bukan buffer mentah). Non-fatal: guard teks terlalu pendek
 * (<20 char, cermin guard yang sama di documents/analyze/route.ts L246 --
 * caption/OCR super pendek jangan dipaksa dicek) dan try/catch supaya kegagalan
 * checker TIDAK PERNAH menggagalkan upload utama (pola sama persis dengan
 * tryCheckDocument() dan tryParseWorkspaceFileAsLedger()).
 */
export function tryCheckWorkspaceFileDataQuality(
  fileName: string,
  content: string
): DocumentCheckReport | TabularCheckReport | null {
  try {
    if (!content || content.trim().length < 20) return null;
    const ext = getFileExtension(fileName);
    if (TABULAR_EXT.has(ext)) {
      return checkTabularText(content, { fileName });
    }
    return checkDocumentText(content, { fileName });
  } catch (err) {
    console.warn('[workspace-file-dataquality] checker gagal (non-fatal, upload tetap lanjut apa adanya):', err);
    return null;
  }
}

/** Severity terburuk dari daftar anomali -- urutan critical > warning > info. */

const DQ_BLOCK_MAX_CHARS = 1200;

/**
 * Blok teks "[PEMERIKSAAN DATA]" -- disisipkan di AWAL extractedSummary, gaya
 * sama seperti blok "ANGKA TERVERIFIKASI" (workspace-file-ledger.ts) tapi
 * levelnya info+saran (bukan larangan keras menghitung ulang). Header WAJIB
 * bisa diparse regex sederhana -- kontrak dgn parseDataQualityHeader() di bawah
 * DAN dengan GET workspace-files/route.ts (parsing dari extractedSummary MENTAH
 * di DB, bukan dari sini langsung -- modul ini cuma penghasil teksnya).
 *
 * File bersih (anomalies=0) mengembalikan STRING KOSONG -- SENGAJA, supaya file
 * sehat tidak dapat noise "[PEMERIKSAAN DATA] 0 temuan" di extractedSummary-nya
 * (kriteria_selesai eksplisit: nol noise untuk file bersih).
 */
export function buildDataQualityBlock(report: { anomalies: DocumentAnomaly[] }): string {
  const anomalies = report.anomalies;
  if (!anomalies || anomalies.length === 0) return '';

  const critCount = anomalies.filter((a) => a.severity === 'critical').length;
  const warnCount = anomalies.filter((a) => a.severity === 'warning').length;
  const infoCount = anomalies.filter((a) => a.severity === 'info').length;
  const severityParts: string[] = [];
  if (critCount > 0) severityParts.push(`${critCount} kritis`);
  if (warnCount > 0) severityParts.push(`${warnCount} perhatian`);
  if (infoCount > 0) severityParts.push(`${infoCount} info`);

  const header = `[PEMERIKSAAN DATA] ${anomalies.length} temuan (${severityParts.join(', ')})`;
  // Maks 5 baris pertama di TEKS (field dataQuality.anomalies di respons POST
  // tetap kirim sampai 10 -- lihat workspace-files/route.ts -- tapi teks yang
  // disimpan ke extractedSummary dibatasi supaya realistis muat 1200 char).
  const lines = anomalies
    .slice(0, 5)
    .map((a) => `- [${a.severity}] ${a.explanation} Saran: ${a.suggestion ?? 'Periksa manual.'}`);

  let block = [header, ...lines].join('\n');
  if (block.length > DQ_BLOCK_MAX_CHARS) block = block.slice(0, DQ_BLOCK_MAX_CHARS - 3) + '...';
  return block;
}



