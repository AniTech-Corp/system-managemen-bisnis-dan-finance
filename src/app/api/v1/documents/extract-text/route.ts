import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { checkUploadRateLimit, uploadRateLimitResponse } from '@/lib/upload-rate-limit';
import { analyzeImageWithGemini } from '@/lib/ai-gateway';
// Guard tenant dikembalikan (M-temuan audit keamanan 6 Sep) -- versi sebelum rewrite
// Excel/OCR (commit 57bcf65) sudah membungkus POST dengan withTenantGuard, tapi
// pembungkus itu ikut hilang saat berkas ini ditulis ulang total untuk dukungan
// Excel/OCR. Endpoint ini menerima file dokumen bisnis milik tenant tanpa
// verifikasi apapun sebelum fix ini -- terbukti 200 tanpa login di produksi.
import { withTenantGuard } from '@/lib/tenant-guard';
// KELOMPOK 4 wiring (2026-09-07, roadmap anti-halusinasi 2026-09-06): parser
// ledger deterministik yang SAMA dipakai /documents/analyze (parseLedgerWorkbook
// + validateLedger, TIDAK PERNAH memanggil LLM) -- lihat komentar panjang di
// dekat pemakaiannya di bawah untuk alasan kenapa disambungkan ke endpoint ini.
import { parseLedgerWorkbook, validateLedger, type DiscrepancyReport } from '@/lib/ai-brain';

// Ekstraksi teks & data dokumen cerdas (PDF, Excel, Word, CSV, Image/OCR)
// Digunakan oleh Executive, Finance, dan Marketing AI Assistant agar dokumen
// yang diunggah pengguna terbaca secara akurat, presisi, dan lengkap.

let pdfWorkerConfigured = false;
async function ensurePdfWorkerConfigured() {
  if (pdfWorkerConfigured) return;
  try {
    // @ts-expect-error -- pdfjs-dist side-effect import untuk inisialisasi worker
    await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    pdfWorkerConfigured = true;
  } catch (e) {
    console.warn('[extract-text] PDF worker init warning:', e);
  }
}

// Roadmap 7 Sep item 4.1/4.2 (Hub Upload Data): diekspor supaya
// /api/v1/workspace-files/route.ts bisa memanggil pipeline ekstraksi yang SAMA
// PERSIS dengan chat attachment (roadmap eksplisit: "bukan jalur baru yang
// terpisah"), bukan reimplementasi. Perilaku fungsi ini sendiri tidak berubah.
export async function extractTextFromBuffer(fileName: string, buffer: Buffer): Promise<string> {
  const ext = (fileName.split('.').pop() || '').toLowerCase();

  try {
    // 1. Format Plain Text, CSV, JSON, Log, TSV, Markdown
    if (ext === 'txt' || ext === 'md' || ext === 'json' || ext === 'log') {
      return buffer.toString('utf8');
    }

    if (ext === 'csv' || ext === 'tsv') {
      const raw = buffer.toString('utf8').replace(/\0/g, '');
      let delimiter = ext === 'tsv' ? '\t' : ',';
      if (ext === 'csv') {
        const sampleLines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 5);
        let semicolonCount = 0;
        let commaCount = 0;
        let tabCount = 0;
        for (const line of sampleLines) {
          semicolonCount += (line.match(/;/g) || []).length;
          commaCount += (line.match(/,/g) || []).length;
          tabCount += (line.match(/\t/g) || []).length;
        }
        if (semicolonCount > commaCount && semicolonCount > tabCount) {
          delimiter = ';';
        } else if (tabCount > commaCount && tabCount > semicolonCount) {
          delimiter = '\t';
        }
      }
      const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length === 0) return '';
      
      const formatted: string[] = [];
      let isFirstRow = true;
      for (const line of lines) {
        const cols = parseCsvLine(line, delimiter);
        formatted.push(`| ${cols.join(' | ')} |`);
        if (isFirstRow) {
          formatted.push(`| ${cols.map(() => '---').join(' | ')} |`);
          isFirstRow = false;
        }
      }
      return formatted.join('\n').replace(/\0/g, '');
    }

    // 2. Format Gambar (Foto Nota, Kwitansi, Laporan Keuangan, Papan Tulis) -> OCR Vision Cerdas
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp' || ext === 'bmp') {
      const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const base64 = buffer.toString('base64');
      try {
        const ocrPrompt =
          'Anda adalah asisten OCR cerdas tingkat tinggi untuk dokumen bisnis dan keuangan KLIR OS.\n' +
          'Tolong transkripsikan dan ekstrak SELURUH teks, tabel, angka, tanggal, dan informasi yang tertera di gambar ini secara 100% akurat dan lengkap.\n' +
          'Jika terdapat tabel transaksi atau laporan keuangan, buatkan tabel markdown dengan kolom yang jelas (Tanggal, Keterangan, Jumlah/Nominal, Kategori).\n' +
          'Pertahankan angka dan nama persis seperti aslinya tanpa mengarang.';
        
        const ocrResult = await analyzeImageWithGemini(
          base64,
          mimeType,
          ocrPrompt,
          'Sistem OCR dokumen bisnis & finansial tingkat presisi tinggi.'
        );

        return `[Hasil OCR Gambar Dokumen: ${fileName}]\n\n${ocrResult.text}`;
      } catch (ocrErr: any) {
        console.warn('[extract-text] Gemini OCR fallback:', ocrErr?.message);
        return `[Gambar Terlampir: ${fileName} (${(buffer.length / 1024).toFixed(1)} KB)]`;
      }
    }

    // 3. Format Dokumen PDF
    if (ext === 'pdf') {
      await ensurePdfWorkerConfigured();
      const { PDFParse } = await import('pdf-parse');
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      const text = (result.text || '').trim();
      
      if (!text) {
        return `[Dokumen PDF Terlampir: ${fileName} - Dokumen merupakan hasil scan tanpa teks selektabel.]`;
      }

      // Normalisasi spasi ganda dan baris kosong berlebih
      return text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
    }

    // 4. Format Microsoft Word (.docx, .doc)
    if (ext === 'docx' || ext === 'doc') {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || '').trim();
    }

    // 5. Format Microsoft Excel (.xlsx, .xls)
    if (ext === 'xlsx' || ext === 'xls') {
      try {
        const ExcelJS = (await import('exceljs')).default;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer as any);
        const lines: string[] = [];

        workbook.eachSheet((sheet) => {
          lines.push(`\n### Lembar Kerja (Sheet): ${sheet.name}`);

          // KELOMPOK B2 wiring (7 Sep 2026, roadmap integrasi data upload item
          // 2/3): kumpulkan dulu SEMUA baris (nilai mentah UNTUK deteksi kolom
          // numerik + string tampilan UNTUK tabel markdown, tidak berubah dari
          // sebelumnya) sebelum di-dump -- supaya bisa dihitung ringkasan
          // generik (header/jumlah baris/kolom numerik/25 baris sampel) untuk
          // workbook APAPUN, bukan cuma yang dikenali parseLedgerWorkbook
          // (chart-of-accounts + sheet "kas", di luar scope berkas ini). Lihat
          // buildGenericSheetSummaryBlock() di bawah untuk detail heuristik.
          const rawRows: unknown[][] = [];
          const displayRows: string[][] = [];

          sheet.eachRow((row) => {
            const rawCells = (row.values as any[]).slice(1);
            const display = rawCells.map(cellToDisplayString);
            if (display.some((c) => c !== '')) {
              rawRows.push(rawCells);
              displayRows.push(display);
            }
          });

          lines.push(buildGenericSheetSummaryBlock(sheet.name, rawRows, displayRows));

          let isHeader = true;
          for (const cells of displayRows) {
            lines.push(`| ${cells.join(' | ')} |`);
            if (isHeader) {
              lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
              isHeader = false;
            }
          }
        });

        const output = lines.join('\n').trim();
        if (output) return output;
      } catch (excelErr) {
        console.warn('[extract-text] ExcelJS error, trying SheetJS fallback:', excelErr);
      }

      // Fallback SheetJS (jarang tercapai -- hanya kalau ExcelJS gagal parse
      // buffer). SENGAJA TIDAK dapat ringkasan generik yang sama seperti jalur
      // ExcelJS di atas -- fallback ini murni jaring pengaman format lawas/
      // korup ringan, bukan jalur utama yang perlu diperkaya (keputusan
      // sadar, dicatat di laporan build 7 Sep supaya bukan diam-diam kelewat).
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(buffer, { type: 'buffer' });
        const lines: string[] = [];
        for (const name of wb.SheetNames) {
          lines.push(`\n### Lembar Kerja (Sheet): ${name}`);
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
          lines.push(csv);
        }
        return lines.join('\n').trim();
      } catch (sheetJsErr) {
        console.warn('[extract-text] SheetJS fallback error:', sheetJsErr);
      }
    }

    // 6. Format arsip .zip -- KELOMPOK B2 wiring (7 Sep 2026, roadmap integrasi
    // data upload item 1). Lihat extractZipText() di bawah untuk batas
    // keamanan (maks 50 entri, maks 40MB hasil dekompresi, zip-di-dalam-zip
    // ditolak) -- tanpa batas ini, arsip kecil berisi data terkompresi
    // ekstrem (zip bomb) bisa menjatuhkan SATU proses Node/PM2 yang melayani
    // SELURUH workspace (produksi bukan sandboxed/serverless).
    if (ext === 'zip') {
      return await extractZipText(buffer);
    }

    // Format umum lainnya
    return buffer.toString('utf8');
  } catch (err: any) {
    console.warn(`[extract-text] Gagal ekstraksi ${ext}:`, err?.message);
    throw err;
  }
}

/**
 * Parser 1 baris CSV dengan dukungan quote-aware (menghormati string ber-kutip yang memuat delimiter)
 * dan sanitasi tanda kutip pembungkus.
 */
export function parseCsvLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(cur.trim().replace(/^["']|["']$/g, ''));
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur.trim().replace(/^["']|["']$/g, ''));
  return result;
}

// ---------------------------------------------------------------------------
// KELOMPOK B2 wiring (7 Sep 2026, roadmap integrasi data upload item 2/3):
// ringkasan xlsx GENERIK -- dipakai untuk workbook APAPUN, bukan cuma yang
// dikenali parseLedgerWorkbook (chart-of-accounts + sheet "kas", di
// src/lib/ai-brain/ledger-parser.ts, di luar scope berkas ini). Alasan:
// audit 7 Sep menemukan file dummy Mecca (laporan penjualan/laba-rugi/
// inventori/payroll) semuanya BUKAN ledger klasik -- tanpa ringkasan ini,
// AI cuma dapat dump tabel markdown mentah tanpa tahu berapa baris/kolom
// mana yang angka/berapa totalnya (Q3b, laporan scan upload-knowledge 7 Sep).
//
// Ditempel oleh PEMANGGIL (documents/extract-text/route.ts POST + workspace-
// files/route.ts POST) SETELAH pengecekan ledger klasik -- karena blok ANGKA
// TERVERIFIKASI (buildVerifiedNumbersBlock, workspace-file-ledger.ts / fungsi
// serupa di berkas ini) di-prepend oleh pemanggil DI LUAR extractTextFromBuffer
// setelah fungsi ini kembali. Jadi urutan akhir untuk file yang dikenali
// SEBAGAI ledger klasik adalah: [ANGKA TERVERIFIKASI] lalu [ringkasan generik
// di bawah] lalu [dump tabel mentah] -- ringkasan generik ini SELALU lapis
// TAMBAHAN, tidak pernah menggantikan/mendobel blok ledger klasik.
// ---------------------------------------------------------------------------

/** Representasi 1 sel Excel jadi string tampilan -- membongkar seluruh AST ExcelJS
 *  (richText, formula result, hyperlink, native error, Date) sehingga eliminasi
 *  total string "[object Object]". */
export function cellToDisplayString(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toLocaleDateString('id-ID');
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) {
    return v.map(cellToDisplayString).filter(Boolean).join(' ').trim();
  }
  if (typeof v === 'object') {
    const obj = v as any;
    // 1. ExcelJS RichText: { richText: [{ text: string, font?: ... }, ...] }
    if (Array.isArray(obj.richText)) {
      const combined = obj.richText
        .map((t: any) => (t && t.text != null ? (typeof t.text === 'string' ? t.text : cellToDisplayString(t.text)) : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return combined;
    }
    // 2. ExcelJS Formula Cell: { formula: string, result: unknown }
    if (obj.result !== undefined) {
      if (obj.result === null) {
        return '';
      }
      if (typeof obj.result === 'object') {
        if (obj.result.error) {
          return typeof obj.result.error === 'object' ? cellToDisplayString(obj.result.error) : String(obj.result.error).trim();
        }
        if (obj.result instanceof Date) return obj.result.toLocaleDateString('id-ID');
        return cellToDisplayString(obj.result);
      }
      return String(obj.result).trim().replace(/\0/g, '');
    }
    // 3. ExcelJS Hyperlink: { text: string, hyperlink: string }
    if (obj.text !== undefined) {
      return typeof obj.text === 'object' ? cellToDisplayString(obj.text) : String(obj.text).trim().replace(/\0/g, '');
    }
    if (obj.hyperlink !== undefined) {
      return String(obj.hyperlink).trim().replace(/\0/g, '');
    }
    // 4. ExcelJS Native Cell Error: { error: '#REF!' }
    if (obj.error !== undefined) {
      if (obj.error === null) return '';
      return typeof obj.error === 'object' ? cellToDisplayString(obj.error) : String(obj.error).trim();
    }
    // 5. Plain formula fallback without result
    if (obj.formula !== undefined) {
      return String(obj.formula).trim();
    }
    // Fallback: jangan pernah mengembalikan literal [object Object]
    return '';
  }
  const str = String(v).trim().replace(/\0/g, '');
  return str === '[object Object]' ? '' : str;
}

export function sanitizeNulBytes(text: string): string {
  return (text || '').replace(/\0/g, '');
}

/** Nilai numerik MENTAH 1 sel Excel, atau null kalau bukan angka. Dipakai
 *  KHUSUS untuk deteksi kolom numerik -- membongkar formula dan richText numerik. */
export function cellToRawNumeric(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (v != null && typeof v === 'object') {
    const obj = v as any;
    if (typeof obj.result === 'number' && Number.isFinite(obj.result)) return obj.result;
    if (typeof obj.result === 'string') {
      const parsed = Number(obj.result.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed) && obj.result.trim() !== '') return parsed;
    }
    if (Array.isArray(obj.richText)) {
      const text = obj.richText.map((t: any) => (t && t.text != null ? String(t.text) : '')).join('').trim();
      const parsed = Number(text.replace(/[^0-9.-]/g, ''));
      if (Number.isFinite(parsed) && text !== '') return parsed;
    }
  }
  return null;
}

function toCsvCell(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Ringkasan generik 1 sheet: nama, header terdeteksi (baris pertama), jumlah
 * baris data, kolom yang MAYORITAS (>=50% nilai non-kosong di kolom itu)
 * berisi angka (total/min/max), dan 25 baris pertama sebagai CSV.
 * `rawRows`/`displayRows` SUDAH difilter baris kosong oleh pemanggil (lihat
 * pemakaian di extractTextFromBuffer di atas) dan SEJAJAR indeksnya.
 * Sheet kosong (0 baris tersisa setelah filter) -> catatan singkat, bukan
 * error/exception -- non-fatal sesuai prinsip fungsi ini (tambahan, bukan
 * pengganti jalur ekstraksi tabel yang sudah ada).
 */
function buildGenericSheetSummaryBlock(sheetName: string, rawRows: unknown[][], displayRows: string[][]): string {
  if (rawRows.length === 0) {
    return `RINGKASAN: sheet "${sheetName}" tidak berisi baris data apapun.`;
  }

  const headerRow = displayRows[0];
  const dataRawRows = rawRows.slice(1);
  const dataDisplayRows = displayRows.slice(1);
  const rowCount = dataRawRows.length;
  // Hindari spread (Math.max(...array)) untuk array baris/kolom -- sheet
  // bisnis nyata bisa punya ribuan baris, dan spread ke argumen fungsi
  // berisiko kena batas jumlah argumen JS engine untuk array sebesar itu.
  // Manual reduce/loop di seluruh fungsi ini aman untuk ukuran berapapun.
  let columnCount = headerRow.length;
  for (const r of dataRawRows) if (r.length > columnCount) columnCount = r.length;

  const numericColumnLines: string[] = [];
  for (let c = 0; c < columnCount; c++) {
    const nonEmptyCount = dataDisplayRows.filter((r) => (r[c] ?? '').trim() !== '').length;
    if (nonEmptyCount === 0) continue;
    const numericValues = dataRawRows
      .map((r) => cellToRawNumeric(r[c]))
      .filter((n): n is number => n !== null);
    // "mayoritas numerik" -- ambang >=50% nilai non-kosong di kolom itu
    // berupa angka. Di bawah ambang ini SENGAJA tidak dianggap kolom numerik
    // -- lebih baik tidak melaporkan total/min/max daripada menghitung dari
    // kolom yang sebagian besar isinya teks (prinsip "jangan menebak" yang
    // sama dipakai ledger-parser.ts untuk data finansial, lihat JSDoc-nya).
    if (numericValues.length === 0 || numericValues.length / nonEmptyCount < 0.5) continue;
    let total = 0;
    let min = numericValues[0];
    let max = numericValues[0];
    for (const n of numericValues) {
      total += n;
      if (n < min) min = n;
      if (n > max) max = n;
    }
    const headerLabel = headerRow[c]?.trim() || `Kolom ${c + 1}`;
    numericColumnLines.push(
      `  - ${headerLabel} (kolom ${c + 1}): total ${total.toLocaleString('id-ID')}, min ${min.toLocaleString('id-ID')}, max ${max.toLocaleString('id-ID')} (dari ${numericValues.length}/${nonEmptyCount} nilai non-kosong)`
    );
  }

  const sampleCount = Math.min(25, displayRows.length);
  const csvLines = displayRows.slice(0, sampleCount).map((r) => r.map(toCsvCell).join(','));

  return [
    'RINGKASAN DATA (dihitung PROGRAM, generik untuk sheet apapun -- 7 Sep 2026):',
    `- Sheet: ${sheetName}`,
    `- Header terdeteksi: ${headerRow.join(' | ') || '(baris pertama kosong)'}`,
    `- Jumlah baris data (di luar header): ${rowCount}`,
    '- Kolom mayoritas numerik:',
    numericColumnLines.length > 0 ? numericColumnLines.join('\n') : '  - (tidak ada kolom yang mayoritas berisi angka)',
    `- ${sampleCount} baris pertama (format CSV, termasuk header kalau baris pertama adalah header):`,
    csvLines.join('\n'),
  ].join('\n');
}

// ---------------------------------------------------------------------------
// KELOMPOK B2 wiring (7 Sep 2026, roadmap integrasi data upload item 1):
// ekstraksi .zip generik. JSZip SUDAH jadi dependency terpasang (dipakai
// extractPptxText di src/lib/workspace-file-extraction.ts) -- TIDAK install
// dependency baru.
//
// BATAS KEAMANAN (WAJIB -- lihat kritik audit 7 Sep soal risiko zip-bomb):
// produksi = 1 proses Node/PM2 TUNGGAL yang melayani SELURUH workspace
// (bukan sandboxed/serverless per-request) -- tanpa batas ini, arsip kecil
// berisi data terkompresi ekstrem bisa dekompresi jadi ratusan MB/GB di
// memori dan menjatuhkan proses itu untuk SEMUA tenant sekaligus.
//   - ZIP_MAX_ENTRIES (50): arsip dengan lebih banyak entri DITOLAK TOTAL
//     (bukan diproses sebagian) -- jumlah entri sangat banyak adalah ciri
//     khas zip bomb (banyak entri kecil yang masing-masing membengkak).
//   - ZIP_MAX_TOTAL_DECOMPRESSED_BYTES (40MB): dicek SECARA STREAMING per
//     chunk (nodeStream), BUKAN setelah 1 entri selesai didekompresi penuh
//     ke memori -- begitu total lintas-entri melebihi batas, stream entri
//     yang sedang dibaca LANGSUNG dihentikan (destroy), bukan menunggu
//     buffer penuh dulu baru dibuang. Ini mencegah SATU entri kecil-
//     terkompresi yang didekompresi jadi raksasa membebani memori sebelum
//     sempat ditolak (skenario zip-bomb klasik: 1 entri kecil -> ratusan MB).
//   - Entri BERUPA .zip lagi (zip di dalam zip) DITOLAK per-entri (dicatat
//     namanya di output, TIDAK menggagalkan seluruh arsip), TIDAK direkursi
//     -- mencegah proses zip-di-dalam-zip-di-dalam-zip tak berujung.
//   - Entri gambar/PowerPoint/ekstensi lain yang tidak diekstrak fungsi ini
//     (lihat ZIP_ENTRY_EXTRACTABLE_EXTENSIONS) DIDAFTAR namanya saja (bukan
//     digagalkan) -- OCR gambar (panggilan Gemini, biaya+latensi) & parser
//     .pptx khusus (extractPptxText, tinggal di workspace-file-extraction.ts,
//     TIDAK bisa diimpor ke sini tanpa circular import karena file itu
//     justru mengimpor extractTextFromBuffer DARI berkas ini) sengaja di
//     luar scope entri zip untuk sesi build ini.
// ---------------------------------------------------------------------------

const ZIP_MAX_ENTRIES = 50;
const ZIP_MAX_TOTAL_DECOMPRESSED_BYTES = 40 * 1024 * 1024; // 40MB

/** Ekstensi entri di dalam .zip yang diekstrak lewat extractTextFromBuffer
 *  (pipeline yang SAMA dipakai file top-level, sesuai instruksi tugas).
 *  SENGAJA TIDAK termasuk gambar/pptx/zip -- lihat komentar besar di atas. */
const ZIP_ENTRY_EXTRACTABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'txt', 'md', 'json', 'log', 'csv', 'tsv', 'pdf', 'docx', 'doc', 'xlsx', 'xls',
]);

/** Baca 1 entri zip lewat stream, hentikan (reject) SEGERA begitu total byte
 *  yang sudah dibaca (entri ini + entri-entri sebelumnya, lewat
 *  `budgetState` yang dibagi lintas-entri) melebihi jatah -- lihat komentar
 *  besar ZIP_MAX_TOTAL_DECOMPRESSED_BYTES di atas untuk alasannya. */
function readZipEntryWithinBudget(
  entry: { nodeStream: (type?: 'nodebuffer') => NodeJS.ReadableStream },
  budgetState: { usedBytes: number }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = entry.nodeStream('nodebuffer');
    let settled = false;
    stream.on('data', (chunk: Buffer) => {
      if (settled) return;
      budgetState.usedBytes += chunk.length;
      if (budgetState.usedBytes > ZIP_MAX_TOTAL_DECOMPRESSED_BYTES) {
        settled = true;
        (stream as unknown as { destroy?: (err?: Error) => void }).destroy?.(new Error('ZIP_BUDGET_EXCEEDED'));
        reject(new Error('ZIP_BUDGET_EXCEEDED'));
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    stream.on('error', (err: Error) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// B1 BACKEND, 8 Sep 2026 (T2 zip-per-entri, roadmap "dua pintu upload") --
// extractZipText dipecah jadi 2 lapis:
//   (1) listZipEntries() -- BARU, EXPORT. Tanggung jawab TUNGGAL: buka JSZip,
//       tegakkan cap ZIP_MAX_ENTRIES/ZIP_MAX_TOTAL_DECOMPRESSED_BYTES (angka
//       TIDAK berubah), baca tiap entri non-zip via readZipEntryWithinBudget
//       (TIDAK disentuh), tandai isNestedZip (TIDAK PERNAH direkursi/dibaca).
//       Fungsi ini TIDAK tahu ekstensi mana yang "didukung" -- itu keputusan
//       CALLER (extractZipText di sini untuk jalur chat; extractWorkspaceZip-
//       Entries di workspace-file-extraction.ts untuk jalur Pusat Data, yang
//       butuh allowlist LEBIH LUAS termasuk pptx/gambar -- lihat T2-5 di
//       laporan scan upload-hub 8 Sep untuk alasan cakupan lebih luas itu).
//   (2) extractZipText() -- DIPERTAHANKAN sbg export yang sama, sekarang jadi
//       wrapper tipis di atas listZipEntries() + ZIP_ENTRY_EXTRACTABLE_EXTEN-
//       SIONS (tidak berubah). KONTRAK KERAS: output string BYTE-IDENTIK
//       dengan sebelum refactor ini -- dibuktikan 9 test existing di
//       tests/documents-extract-text-zip-xlsx.test.ts lulus TANPA dimodifikasi
//       assertion-nya.
//
// CATATAN JUJUR (trade-off yang disadari, BUKAN diam-diam): listZipEntries
// sekarang MEMBACA buffer semua entri non-zip (termasuk gambar/pptx yang
// dulu di jalur chat SAMA SEKALI tidak pernah dibaca -- extractZipText lama
// skip baca untuk ekstensi tak didukung). Ini berarti BUDGET 40MB sekarang
// ikut terpakai oleh entri yang akhirnya dibuang di extractZipText (dulu
// gratis, tidak terhitung). Untuk 9 test existing (semua entri kecil) ini
// TIDAK mengubah hasil apapun -- byte-identik terbukti. TAPI untuk kasus
// EKSTREM tak-diuji (arsip berisi banyak gambar/pptx besar yang totalnya
// >40MB, sebelumnya lolos karena tak pernah dibaca) extractZipText jalur
// chat SEKARANG bisa menolak arsip yang dulu lolos -- perubahan perilaku
// nyata di luar cakupan test, tapi dianggap dapat diterima (lebih ketat,
// bukan lebih longgar, terhadap risiko zip-bomb) demi satu sumber kebenaran
// tunggal (listZipEntries) dipakai kedua jalur. Dilaporkan eksplisit ke
// komando, bukan disembunyikan.
// ---------------------------------------------------------------------------

export interface ZipEntryRaw {
  name: string;
  /** null kalau isNestedZip=true (tidak pernah dibaca) ATAU readError terisi
   *  (gagal dibaca) -- CALLER wajib cek kedua flag itu dulu sebelum pakai. */
  buffer: Buffer | null;
  isNestedZip: boolean;
  readError?: string;
}

/**
 * Buka arsip .zip, tegakkan batas keamanan, baca SEMUA entri non-nested-zip
 * ke buffer (budget dibagi lintas-entri). TIDAK melakukan filter ekstensi --
 * itu keputusan pemanggil (lihat catatan di atas). Melempar (throw) untuk 2
 * kondisi fatal yang SAMA PERSIS seperti extractZipText lama: arsip korup,
 * >ZIP_MAX_ENTRIES, atau total dekompresi >ZIP_MAX_TOTAL_DECOMPRESSED_BYTES.
 */
export async function listZipEntries(buffer: Buffer): Promise<ZipEntryRaw[]> {
  const JSZip = (await import('jszip')).default;

  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (zipErr: any) {
    throw new Error(
      `Arsip .zip tidak bisa dibuka (${zipErr?.message || 'arsip rusak'}). File kemungkinan korup -- unggah ulang.`
    );
  }

  const entries = Object.values(zip.files).filter((f) => !f.dir);
  if (entries.length > ZIP_MAX_ENTRIES) {
    throw new Error(
      `Arsip .zip berisi ${entries.length} berkas -- melebihi batas ${ZIP_MAX_ENTRIES} entri yang bisa diproses sekaligus. Pecah arsip jadi beberapa bagian lebih kecil lalu unggah ulang.`
    );
  }
  entries.sort((a, b) => a.name.localeCompare(b.name));

  const budgetState = { usedBytes: 0 };
  const results: ZipEntryRaw[] = [];

  for (const entry of entries) {
    const entryExt = (entry.name.split('.').pop() || '').toLowerCase();
    if (entryExt === 'zip') {
      // zip-di-dalam-zip: TIDAK PERNAH dibaca/direkursi -- sama seperti sebelumnya.
      results.push({ name: entry.name, buffer: null, isNestedZip: true });
      continue;
    }

    try {
      const entryBuffer = await readZipEntryWithinBudget(entry, budgetState);
      results.push({ name: entry.name, buffer: entryBuffer, isNestedZip: false });
    } catch (readErr: any) {
      if (readErr?.message === 'ZIP_BUDGET_EXCEEDED') {
        // Fatal, sama seperti extractZipText lama -- hentikan SELURUH arsip,
        // bukan cuma entri ini (mencegah zip bomb membengkak lewat entri lain).
        throw new Error(
          `Total ukuran hasil dekompresi arsip .zip melebihi batas ${ZIP_MAX_TOTAL_DECOMPRESSED_BYTES / (1024 * 1024)}MB (kemungkinan zip bomb atau isi arsip terlalu besar) -- proses dihentikan sebelum "${entry.name}" selesai dibaca.`
        );
      }
      results.push({ name: entry.name, buffer: null, isNestedZip: false, readError: readErr?.message || 'error tidak diketahui' });
    }
  }

  return results;
}

/**
 * Ekstraksi teks dari arsip .zip -- daftar semua entri, ekstrak entri dengan
 * ekstensi didukung lewat pipeline extractTextFromBuffer yang sama (reuse
 * penuh, bukan reimplementasi per-format), daftar (BUKAN gagalkan) entri
 * gambar/pptx/tidak dikenal, tolak entri .zip bersarang (dicatat namanya).
 * Header "=== [n/N] namaentri ===" per entri (N = total entri dalam arsip,
 * dihitung SETELAH lolos cap ZIP_MAX_ENTRIES; n = urutan 1-based).
 *
 * B1 BACKEND, 8 Sep 2026: sekarang wrapper tipis di atas listZipEntries() --
 * lihat komentar besar di atasnya. Output byte-identik dengan sebelum refactor.
 */
export async function extractZipText(buffer: Buffer): Promise<string> {
  const entries = await listZipEntries(buffer);
  const total = entries.length;
  const sections: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const entryExt = (entry.name.split('.').pop() || '').toLowerCase();
    // Nama entri dikendalikan penyusun arsip -- buang karakter kontrol/newline dan
    // batasi panjang supaya tidak bisa dipakai memalsukan penanda blok lain di teks
    // (temuan refuter 7 Sep malam, severity RENDAH).
    const safeName = entry.name.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
    const header = `=== [${i + 1}/${total}] ${safeName} ===`;

    if (entry.isNestedZip) {
      sections.push(`${header}\n(arsip .zip di dalam .zip tidak didukung -- dilewati untuk mencegah proses bertingkat/zip bomb)`);
      continue;
    }
    if (!ZIP_ENTRY_EXTRACTABLE_EXTENSIONS.has(entryExt)) {
      sections.push(`${header}\n(format ".${entryExt || 'tanpa ekstensi'}" tidak diekstrak otomatis di dalam arsip -- nama berkas dicatat sebagai referensi)`);
      continue;
    }
    if (entry.readError) {
      sections.push(`${header}\n(gagal membaca entri ini dari arsip: ${entry.readError})`);
      continue;
    }

    try {
      const entryText = await extractTextFromBuffer(entry.name, entry.buffer as Buffer);
      sections.push(`${header}\n${(entryText || '').trim() || '(entri ini kosong setelah diekstrak)'}`);
    } catch (extractErr: any) {
      sections.push(`${header}\n(gagal diekstrak: ${extractErr?.message || 'format tidak didukung'})`);
    }
  }

  return sections.join('\n\n').trim();
}

// ---------------------------------------------------------------------------
// KELOMPOK 4 wiring (2026-09-07, roadmap anti-halusinasi 2026-09-06-roadmap-
// analisis-data-enterprise-anti-halusinasi.md).
//
// MASALAH: parseLedgerWorkbook + validateLedger (ledger-parser.ts / ledger-
// validator.ts) sudah teruji ke 583 transaksi asli dan sudah disambungkan ke
// /api/v1/documents/analyze (lihat tryParseStructuredLedger di route itu).
// Tapi ketiga tampilan AI Assistant (Executive/Finance/Marketing) TIDAK
// memanggil /documents/analyze -- mereka memanggil endpoint INI. Jadi parser
// yang sudah benar tidak pernah menyentuh dokumen yang beneran diupload user,
// dan LLM tetap menebak angka dari teks mentah hasil extractTextFromBuffer()
// di atas -- inilah root cause langsung kasus salah baca angka keuangan (demo
// ke calon klien pertama, 5 Sep 2026, 37 juta vs 3 M).
//
// KENAPA blok "ANGKA TERVERIFIKASI" disisipkan ke DALAM field `content`
// (bukan cuma field JSON terpisah seperti di /documents/analyze): brain/chat/
// route.ts SUDAH punya wiring untuk field `attachment.structuredLedger` yang
// dikirim frontend, TAPI ketiga file frontend yang manggil endpoint ini
// (FinanceAIAssistantView.tsx, ExecutiveAIAssistantView.tsx,
// MarketingAIAssistantView.tsx) hanya menyimpan+mengirim `content` (string)
// dari respons endpoint ini -- lihat attachedFile state di ketiga file itu.
// Dua dari tiga file itu (Finance, Executive) WAJIB tetap NOL-DIFF di sesi
// ini, jadi menyambungkan field structuredLedger sampai ke body request
// brain/chat BUKAN pilihan yang tersedia sekarang. Field structuredLedger/
// discrepancies tetap ditambahkan di respons endpoint ini (lihat pemakaiannya
// di POST handler di bawah) untuk konsistensi dengan /documents/analyze dan
// supaya siap dipakai kalau frontend disambungkan di sesi lain -- tapi jalur
// yang BENERAN sampai ke LLM sekarang adalah blok teks di dalam `content`.
//
// DIDUPLIKASI (bukan di-share lewat modul bersama) dari pola yang identik di
// analyze/route.ts (fungsi tryParseStructuredLedger + interface
// StructuredLedgerSummary) SUPAYA perubahan sesi ini 100% terisolasi di
// SATU berkas -- tidak menyentuh analyze/route.ts yang mungkin sedang
// dikerjakan agent lain di sesi paralel yang sama. Kalau heuristik "dikenali
// sebagai ledger" (chartOfAccounts + sheet "kas") berubah di analyze/route.ts,
// sinkronkan manual ke sini juga.
//
// CARA MEMBATALKAN SELURUH KELOMPOK 4 wiring: hapus bagian ini (dari komentar
// ini sampai penutup fungsi buildVerifiedNumbersBlock di bawah), lalu di
// dalam POST hapus pemanggilan tryParseStructuredLedgerForExtractText() dan
// kembalikan pemakaian `trimmed` langsung (persis kondisi sebelum blok ini
// ditambahkan). Non-fatal murni: kalau file bukan xlsx/xls, bukan ledger yang
// dikenali, atau parsing melempar error apapun, hasilnya null dan jalur
// ekstraksi teks lama berjalan TANPA PERUBAHAN sama sekali.
// ---------------------------------------------------------------------------

interface StructuredLedgerSummary {
  periode: { mulai: string | null; akhir: string | null };
  sheetPrimer: string | null;
  jumlahTransaksi: number;
  totalPerKode: Array<{ kode: number; namaAkun: string | null; debit: number; credit: number }>;
  /** null (BUKAN 0) kalau sheet laba-rugi tidak ditemukan -- lihat JSDoc
   *  DiscrepancyReport.computed di ledger-validator.ts. */
  totalPendapatan: number | null;
  totalBiaya: number | null;
  labaOperasional: number | null;
  zakat: number | null;
  labaBersih: number | null;
  saldoAkhir: number | null;
}

function tryParseStructuredLedgerForExtractText(
  fileName: string,
  buffer: Buffer
): { structuredLedger: StructuredLedgerSummary; discrepancies: DiscrepancyReport } | null {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  if (ext !== 'xlsx' && ext !== 'xls') return null;

  try {
    const parsed = parseLedgerWorkbook(buffer);
    const isRecognizedLedger = parsed.chartOfAccounts.size > 0 && Object.keys(parsed.transactionsBySheet).length > 0;
    if (!isRecognizedLedger) return null;

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

    return { structuredLedger, discrepancies: report };
  } catch (err) {
    console.warn('[extract-text] parseLedgerWorkbook/validateLedger gagal (non-fatal, lanjut jalur ekstraksi teks lama):', err);
    return null;
  }
}

function formatRupiahForExtractText(n: number | null | undefined): string {
  return `Rp ${Math.round(n || 0).toLocaleString('id-ID')}`;
}

function formatRupiahOrUnknownForExtractText(n: number | null | undefined): string {
  return n === null || n === undefined
    ? 'tidak diketahui (sheet laba-rugi tidak ditemukan di dokumen)'
    : formatRupiahForExtractText(n);
}

/**
 * Blok teks "ANGKA TERVERIFIKASI" yang disisipkan di AWAL `content` (bukan
 * field JSON terpisah) -- lihat komentar besar di atas untuk alasannya. Kalau
 * `content` nanti kepotong oleh MAX_CHARS di POST handler, blok ini yang
 * TETAP UTUH (bukan isi dokumen mentah di baris-baris berikutnya), karena
 * inilah bagian paling kritis untuk mencegah LLM mengarang angka.
 */
function buildVerifiedNumbersBlock(structuredLedger: StructuredLedgerSummary, report: DiscrepancyReport): string {
  const periodeText =
    structuredLedger.periode.mulai && structuredLedger.periode.akhir
      ? `${structuredLedger.periode.mulai} s.d. ${structuredLedger.periode.akhir}`
      : 'tidak diketahui';
  const totalPerKodeLines = structuredLedger.totalPerKode
    .map(
      (k) =>
        `  - ${k.namaAkun || `Kode ${k.kode}`} (kode ${k.kode}): debit ${formatRupiahForExtractText(k.debit)}, kredit ${formatRupiahForExtractText(k.credit)}`
    )
    .join('\n');
  const discrepancyLines =
    report.discrepancies.length > 0
      ? report.discrepancies.map((d) => `  - [${d.severity}] ${d.explanation}`).join('\n')
      : '  - Tidak ada diskrepansi terdeteksi antara angka tertulis di dokumen dan hasil hitung ulang sistem.';

  const lines: string[] = [
    '===== ANGKA TERVERIFIKASI (dihitung PROGRAM secara deterministik dari isi berkas ini, BUKAN oleh AI) =====',
    'PERINGATAN UNTUK MODEL AI: angka di blok ini WAJIB dipakai apa adanya. DILARANG KERAS',
    'menghitung ulang, menebak, membulatkan, atau "mengoreksi" angka finansial dari dokumen',
    'ini -- HANYA jelaskan persis angka yang tertulis di blok ini. Kalau pengguna bertanya',
    'angka yang TIDAK ada di blok ini, jawab jujur datanya tidak tersedia, JANGAN menebak',
    'dari teks dokumen mentah di bawah blok ini.',
    '',
    `- Periode: ${periodeText}`,
    `- Jumlah transaksi: ${structuredLedger.jumlahTransaksi}`,
    `- Total Pendapatan (hitung ulang): ${formatRupiahOrUnknownForExtractText(structuredLedger.totalPendapatan)}`,
    `- Total Biaya (hitung ulang): ${formatRupiahOrUnknownForExtractText(structuredLedger.totalBiaya)}`,
    `- Laba Operasional (hitung ulang): ${formatRupiahOrUnknownForExtractText(structuredLedger.labaOperasional)}`,
    `- Zakat (hitung ulang): ${formatRupiahOrUnknownForExtractText(structuredLedger.zakat)}`,
    `- Laba Bersih (hitung ulang): ${formatRupiahOrUnknownForExtractText(structuredLedger.labaBersih)}`,
    `- Saldo Akhir: ${structuredLedger.saldoAkhir != null ? formatRupiahForExtractText(structuredLedger.saldoAkhir) : 'tidak diketahui'}`,
  ];
  if (totalPerKodeLines) lines.push(`- Rincian per kode akun:\n${totalPerKodeLines}`);
  lines.push(
    '',
    'DISKREPANSI YANG DITEMUKAN SISTEM (sebutkan ke pengguna apa adanya, jangan ditutup-tutupi):',
    discrepancyLines,
    '===== AKHIR BLOK ANGKA TERVERIFIKASI -- ISI DOKUMEN ASLI DI BAWAH INI ====='
  );
  return lines.join('\n');
}

/**
 * POST /api/v1/documents/extract-text
 * Mengekstrak teks & struktur data dari dokumen (PDF, Excel, Word, CSV, Gambar OCR).
 * Dibungkus withTenantGuard (minRole MEMBER, sama seperti versi lama 57bcf65 dan
 * pola /documents/analyze) -- endpoint ini membaca isi dokumen bisnis milik tenant,
 * jadi wajib user yang sudah terautentikasi & jadi anggota workspace-nya.
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  // 8 Sep (temuan verifikator TINGGI): rate-limit ekstraksi lampiran chat -- multi-file (6/pesan) + OCR berbayar.
  { const rl = checkUploadRateLimit(req, { max: 40, windowMs: 60 * 1000 }); if (!rl.allowed) return uploadRateLimitResponse(rl.resetTime); }
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { success: false, message: 'Kirim file via multipart/form-data dengan field "file".' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json(
        { success: false, message: 'File tidak ditemukan dalam form data.' },
        { status: 400 }
      );
    }

    const fileName = file.name || 'dokumen';
    // FIX (7 Sep 2026): batas ukuran DICEK dari file.size SEBELUM arrayBuffer() -- kalau
    // dicek setelahnya, memori sudah terlanjur dialokasikan dan batasnya tidak berguna.
    const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { success: false, message: 'Ukuran file melebihi batas 15 MB. Kecilkan file atau pecah menjadi beberapa bagian.' },
        { status: 413 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());

    let content: string;
    try {
      content = await extractTextFromBuffer(fileName, buffer);
      // Pagar byte NUL untuk jalur lampiran chat (7 Sep malam) -- jalur Pusat Data sudah
      // punya guard ini (workspace-file-extraction.ts); hasil endpoint ini dikirim ke
      // LLM dan bisa disimpan konsumen lain ke Postgres (error 22021 kalau ada NUL).
      if (content.includes('\u0000')) content = content.replace(/\u0000+/g, '');
    } catch (extractErr: any) {
      return NextResponse.json(
        {
          success: false,
          message: `Gagal membaca isi "${fileName}" (${extractErr?.message || 'format tidak didukung'}). Coba unggah ulang atau konversi ke format PDF/XLSX/CSV.`,
        },
        { status: 422 }
      );
    }

    const trimmed = (content || '').trim();
    if (!trimmed) {
      return NextResponse.json(
        {
          success: false,
          message: `Dokumen "${fileName}" terbaca tetapi tidak ada teks atau data yang terdeteksi.`,
        },
        { status: 422 }
      );
    }

    // KELOMPOK 4 wiring -- kalau berkas ini xlsx/xls DAN dikenali sebagai
    // ledger bookkeeping, hitung ANGKA TERVERIFIKASI deterministik dan
    // sisipkan sebagai blok di AWAL `content` (lihat komentar besar di atas
    // fungsi buildVerifiedNumbersBlock). null (non-fatal) kalau bukan
    // xlsx/xls, bukan ledger yang dikenali, atau parsing gagal -- dalam
    // ketiga kasus itu `finalContent` sama persis dengan `trimmed`, artinya
    // field `content`/`truncated`/`totalChars` di bawah BYTE-IDENTIK dengan
    // perilaku sebelum wiring ini.
    const ledgerResult = tryParseStructuredLedgerForExtractText(fileName, buffer);
    const finalContent = ledgerResult
      ? `${buildVerifiedNumbersBlock(ledgerResult.structuredLedger, ledgerResult.discrepancies)}\n\n${trimmed}`
      : trimmed;

    // Batas karakter aman untuk context AI
    const MAX_CHARS = 32000;
    const truncated = finalContent.length > MAX_CHARS;

    return NextResponse.json({
      success: true,
      fileName,
      content: truncated ? finalContent.slice(0, MAX_CHARS) : finalContent,
      truncated,
      totalChars: finalContent.length,
      // B1 BACKEND, 8 Sep 2026 (T3 lampiran chat -> Pusat Data, kontrak dgn B2) --
      // field ADDITIF: teks ekstraksi MURNI (sebelum blok ANGKA TERVERIFIKASI,
      // sebelum truncation MAX_CHARS) -- `trimmed` sudah didefinisikan di atas,
      // NUL byte sudah distrip sebelumnya (baris ~760-an), jadi aman ditulis ke
      // Postgres tanpa proses ulang. Dipakai B2 sbg nilai form-field
      // `preExtractedContent` saat POST ULANG ke /api/v1/workspace-files supaya
      // TIDAK ekstraksi 2x (T3-03: gambar akan kena OCR Gemini dobel kalau tidak
      // ada field ini). TIDAK mengubah `content`/`truncated`/`totalChars` sama
      // sekali -- consumer lama yang cuma baca field itu tidak terpengaruh.
      rawContent: trimmed,
      // Field TAMBAHAN (bukan pengganti `content`) -- konsisten dengan
      // /documents/analyze, disiapkan untuk pemakaian frontend di sesi lain.
      // Absen sama sekali (bukan null) kalau bukan ledger, supaya pemanggil
      // lama yang cuma cek `json.content`/`json.success` tidak terpengaruh.
      ...(ledgerResult
        ? { structuredLedger: ledgerResult.structuredLedger, discrepancies: ledgerResult.discrepancies }
        : {}),
    });
  } catch (err: any) {
    console.error('[extract-text] Internal error:', err);
    return NextResponse.json(
      { success: false, message: publicApiError('Gagal memproses dan mengekstrak dokumen.') },
      { status: 500 }
    );
  }
}, { minRole: 'MEMBER' });
