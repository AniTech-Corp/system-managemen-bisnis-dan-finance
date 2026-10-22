import { analyzeImageWithGemini } from '@/lib/ai-gateway';
import { parseLedgerWorkbook, validateLedger, type DiscrepancyReport } from '@/lib/ai-brain';

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

    // 6. Format arsip .zip
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
    if (Array.isArray(obj.richText)) {
      const combined = obj.richText
        .map((t: any) => (t && t.text != null ? (typeof t.text === 'string' ? t.text : cellToDisplayString(t.text)) : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return combined;
    }
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
    if (obj.text !== undefined) {
      return typeof obj.text === 'object' ? cellToDisplayString(obj.text) : String(obj.text).trim().replace(/\0/g, '');
    }
    if (obj.hyperlink !== undefined) {
      return String(obj.hyperlink).trim().replace(/\0/g, '');
    }
    if (obj.error !== undefined) {
      if (obj.error === null) return '';
      return typeof obj.error === 'object' ? cellToDisplayString(obj.error) : String(obj.error).trim();
    }
    if (obj.formula !== undefined) {
      return String(obj.formula).trim();
    }
    return '';
  }
  const str = String(v).trim().replace(/\0/g, '');
  return str === '[object Object]' ? '' : str;
}

export function sanitizeNulBytes(text: string): string {
  return (text || '').replace(/\0/g, '');
}

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

function buildGenericSheetSummaryBlock(sheetName: string, rawRows: unknown[][], displayRows: string[][]): string {
  if (rawRows.length === 0) {
    return `RINGKASAN: sheet "${sheetName}" tidak berisi baris data apapun.`;
  }

  const headerRow = displayRows[0];
  const dataRawRows = rawRows.slice(1);
  const dataDisplayRows = displayRows.slice(1);
  const rowCount = dataRawRows.length;
  let columnCount = headerRow.length;
  for (const r of dataRawRows) if (r.length > columnCount) columnCount = r.length;

  const numericColumnLines: string[] = [];
  for (let c = 0; c < columnCount; c++) {
    const nonEmptyCount = dataDisplayRows.filter((r) => (r[c] ?? '').trim() !== '').length;
    if (nonEmptyCount === 0) continue;
    const numericValues = dataRawRows
      .map((r) => cellToRawNumeric(r[c]))
      .filter((n): n is number => n !== null);
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

const ZIP_MAX_ENTRIES = 50;
const ZIP_MAX_TOTAL_DECOMPRESSED_BYTES = 40 * 1024 * 1024; // 40MB

const ZIP_ENTRY_EXTRACTABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  'txt', 'md', 'json', 'log', 'csv', 'tsv', 'pdf', 'docx', 'doc', 'xlsx', 'xls',
]);

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

export interface ZipEntryRaw {
  name: string;
  buffer: Buffer | null;
  isNestedZip: boolean;
  readError?: string;
}

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
      results.push({ name: entry.name, buffer: null, isNestedZip: true });
      continue;
    }

    try {
      const entryBuffer = await readZipEntryWithinBudget(entry, budgetState);
      results.push({ name: entry.name, buffer: entryBuffer, isNestedZip: false });
    } catch (readErr: any) {
      if (readErr?.message === 'ZIP_BUDGET_EXCEEDED') {
        throw new Error(
          `Total ukuran hasil dekompresi arsip .zip melebihi batas ${ZIP_MAX_TOTAL_DECOMPRESSED_BYTES / (1024 * 1024)}MB (kemungkinan zip bomb atau isi arsip terlalu besar) -- proses dihentikan sebelum "${entry.name}" selesai dibaca.`
        );
      }
      results.push({ name: entry.name, buffer: null, isNestedZip: false, readError: readErr?.message || 'error tidak diketahui' });
    }
  }

  return results;
}

export async function extractZipText(buffer: Buffer): Promise<string> {
  const entries = await listZipEntries(buffer);
  const total = entries.length;
  const sections: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const entryExt = (entry.name.split('.').pop() || '').toLowerCase();
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

export function tryParseStructuredLedgerForExtractText(
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

export function buildVerifiedNumbersBlock(structuredLedger: StructuredLedgerSummary, report: DiscrepancyReport): string {
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
