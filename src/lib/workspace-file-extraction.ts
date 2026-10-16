/**
 * FASE BUILD 7 Sep 2026 -- Upload (PPTX/gambar) + Integrasi data upload.
 * Fix untuk upload-001 (KRITIS), upload-002 (TINGGI), upload-006 (RENDAH) dari audit
 * "Upload pipeline & cakupan tipe file" -- SCOPE: jalur Pusat Data (workspace-files)
 * SAJA. src/app/api/v1/documents/extract-text/route.ts dan documents/analyze/route.ts
 * (jalur chat attachment ketiga AI Assistant) BUKAN bagian dari lane file agent ini
 * (lihat batas file eksklusif di kontrak tugas) -- fungsi extractTextFromBuffer di
 * sana TIDAK diubah, cuma di-import apa adanya (pola sama seperti workspace-files/
 * route.ts sebelumnya). Root cause bug yang sama (pptx dibaca sebagai teks UTF-8,
 * byte NUL bocor ke Postgres, error mentah bocor ke client) KEMUNGKINAN BESAR masih
 * ada di jalur chat attachment -- lihat catatan_jujur laporan agent untuk rekomendasi
 * ke lane yang memegang documents/**.
 *
 * BUKTI ROOT CAUSE (direproduksi via HTTP nyata 7 Sep, workspace test 3da87aff):
 * POST /api/v1/workspace-files dengan file .pptx asli (236256 bytes) -> HTTP 200,
 * file.status:"FAILED", message berisi RATUSAN BARIS source Next.js/webpack + stack
 * trace Prisma mentah (`PostgresError { code: "22021", message: "invalid byte
 * sequence for encoding \"UTF8\": 0x00" }`). Akar: extractTextFromBuffer() fallback
 * catch-all (`return buffer.toString('utf8')`) dipanggil untuk SEMUA ekstensi tak
 * dikenal termasuk .pptx (arsip ZIP biner) -- hasilnya mengandung byte NUL, ditulis
 * ke Postgres, ditolak, error mentah diteruskan verbatim ke client.
 */

import { extractTextFromBuffer, listZipEntries, cellToDisplayString, cellToRawNumeric, sanitizeNulBytes } from '@/app/api/v1/documents/extract-text/route';
export { cellToDisplayString, cellToRawNumeric, sanitizeNulBytes };

// ---------------------------------------------------------------------------
// upload-002: allowlist ekstensi -- ditolak bersih SEBELUM buffer besar dibaca /
// record PROCESSING dibuat, alih-alih ketahuan gagal setelah proses penuh berjalan.
// ---------------------------------------------------------------------------

/**
 * Ekstensi yang genuinely dipahami pipeline ekstraksi (extractTextFromBuffer +
 * extractPptxText di bawah). ".ppt" (biner lama, bukan OOXML) SENGAJA TIDAK masuk --
 * JSZip tidak bisa membaca format itu sama sekali (bukan arsip zip), jadi lebih jujur
 * ditolak di depan dengan pesan jelas daripada dibiarkan lolos allowlist lalu gagal
 * di tengah jalan dengan pesan yang sama.
 *
 * FASE BUILD 7 Sep 2026 (roadmap integrasi data upload, item 1) -- 'zip' ditambahkan:
 * extractTextFromBuffer() (di documents/extract-text/route.ts, diimpor di bawah) kini
 * punya cabang khusus extractZipText() yang membuka arsip via JSZip DENGAN batas
 * keamanan (maks 50 entri, maks 40MB hasil dekompresi, tolak zip-di-dalam-zip) --
 * lihat komentar besar di dekat extractZipText untuk alasan batas itu (risiko zip
 * bomb di proses Node/PM2 tunggal yang melayani seluruh workspace).
 */
export const SUPPORTED_WORKSPACE_FILE_EXTENSIONS: ReadonlySet<string> = new Set([
  'txt', 'md', 'json', 'log', 'csv', 'tsv',
  'png', 'jpg', 'jpeg', 'webp', 'bmp',
  'pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'zip',
]);

export function getFileExtension(fileName: string): string {
  return (fileName.split('.').pop() || '').toLowerCase();
}

export function isSupportedWorkspaceFileExtension(fileName: string): boolean {
  return SUPPORTED_WORKSPACE_FILE_EXTENSIONS.has(getFileExtension(fileName));
}

/** Pesan penolakan yang jujur (bukan generik "format tidak didukung") -- sebut ekstensi
 *  persis dan sebutkan format yang genuinely didukung, supaya user tahu harus konversi
 *  ke apa, bukan cuma "coba lagi". */
export function unsupportedExtensionMessage(fileName: string): string {
  const ext = getFileExtension(fileName);
  return `Format ".${ext || '(tanpa ekstensi)'}" belum didukung. Format yang didukung: PDF, Word (.docx/.doc), Excel (.xlsx/.xls), PowerPoint (.pptx), ZIP, CSV/TSV, gambar (PNG/JPG/WEBP/BMP), dan teks (TXT/MD/JSON/LOG). Konversi file Anda ke salah satu format ini lalu unggah ulang.`;
}

// ---------------------------------------------------------------------------
// upload-001 (a): ekstraksi .pptx via JSZip -- baca ppt/slides/slideN.xml, strip tag
// XML, gabung jadi teks per-slide. TIDAK mengarang isi -- hanya teks yang genuinely
// ada di run <a:t> OOXML standar yang diambil.
// ---------------------------------------------------------------------------

/**
 * Ekstrak teks dari .pptx (arsip OOXML/ZIP). BUKAN untuk .ppt lama (biner, bukan zip)
 * -- pemanggil WAJIB memfilter ekstensi sebelum memanggil ini (lihat
 * SUPPORTED_WORKSPACE_FILE_EXTENSIONS, ".ppt" sengaja tidak termasuk).
 */
export async function extractPptxText(buffer: Buffer): Promise<string> {
  const JSZip = (await import('jszip')).default;

  let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (zipErr: any) {
    throw new Error(
      `Berkas .pptx tidak bisa dibuka sebagai arsip (${zipErr?.message || 'arsip rusak'}). File kemungkinan korup, atau sebenarnya format .ppt lama (bukan .pptx) -- konversi ulang dari PowerPoint/Google Slides ke .pptx lalu unggah ulang.`
    );
  }

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  if (slideFiles.length === 0) {
    throw new Error('Arsip .pptx tidak berisi slide yang bisa dibaca (ppt/slides/*.xml tidak ditemukan) -- kemungkinan file korup atau bukan format PowerPoint OOXML yang valid.');
  }

  const lines: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('string');
    // Teks PowerPoint OOXML selalu ada di dalam run <a:t>...</a:t> -- strip tag lain,
    // decode 5 entity XML dasar. TIDAK mengarang/menyimpulkan isi gambar/grafik di
    // slide (di luar scope teks-only extraction ini).
    const texts = Array.from(xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)).map((m) =>
      m[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
    );
    const slideText = texts.map((t) => t.trim()).filter(Boolean).join(' | ');
    lines.push(`\n### Slide ${i + 1}`);
    lines.push(slideText || '(slide ini tidak punya teks -- kemungkinan hanya berisi gambar/grafik/diagram)');
  }
  return lines.join('\n').trim();
}

// ---------------------------------------------------------------------------
// upload-001 (b) + upload-006: pengaman terakhir -- kalau HASIL ekstraksi (dari
// sumber manapun, termasuk extractTextFromBuffer yang tidak dimiliki lane ini)
// ternyata mengandung byte NUL, itu SELALU tanda ekstraksi gagal diam-diam
// menghasilkan garbage biner, TIDAK PERNAH teks dokumen bisnis yang sah. Cek ini
// dijalankan SEBELUM hasil ekstraksi ditulis ke Postgres -- mencegah kelas bug
// "invalid byte sequence for encoding UTF8: 0x00" muncul sama sekali untuk jalur
// Pusat Data, apapun ekstensi/cabang yang menghasilkannya.
// ---------------------------------------------------------------------------

export function containsNulByte(text: string): boolean {
  return text.indexOf('\x00') !== -1;
}

// ---------------------------------------------------------------------------
// upload-001 (c): sanitasi pesan error sebelum dikirim ke client -- error MENTAH
// (stack trace Prisma/Postgres, source webpack ter-bundle) TIDAK PERNAH boleh
// diteruskan verbatim ke response JSON. Detail penuh tetap di-log server-side
// (console.error) untuk debugging -- yang disembunyikan HANYA dari client.
// ---------------------------------------------------------------------------

const RAW_ERROR_LEAK_SIGNS = [
  'PostgresError', 'invalid byte sequence', 'webpackHotUpdate', 'at Object.',
  'at async', '__webpack_require__', 'node_modules', '.next/', 'Prisma',
];

/**
 * Pesan error dari `err` dianggap "aman ditampilkan apa adanya" HANYA kalau pendek
 * (di bawah 300 karakter -- pesan error yang genuinely ditulis manusia untuk manusia
 * di codebase ini semuanya jauh di bawah itu, lihat pesan-pesan di extractPptxText/
 * extractTextFromBuffer di atas) DAN tidak mengandung tanda-tanda internal (stack
 * trace/nama package/path file). Kalau salah satu syarat gagal, kembalikan pesan
 * generik yang jujur (sebut nama file, ekstensi, saran konversi) -- BUKAN pesan
 * teknis mentah.
 */
export function sanitizeExtractionErrorMessage(err: unknown, fileName: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const looksLikeInternalLeak =
    raw.length > 300 || RAW_ERROR_LEAK_SIGNS.some((sign) => raw.includes(sign));

  if (looksLikeInternalLeak) {
    console.error(`[workspace-files] Error internal disembunyikan dari client untuk "${fileName}" (detail penuh di log server):`, raw);
    const ext = getFileExtension(fileName);
    return `Gagal memproses "${fileName}" (.${ext || 'tanpa ekstensi'}) -- terjadi kesalahan internal saat membaca isi file. Coba unggah ulang, atau konversi ke PDF/XLSX/CSV lalu coba lagi.`;
  }
  return raw || `Gagal memproses "${fileName}" -- format tidak didukung.`;
}

// ---------------------------------------------------------------------------
// Orkestrator: dipanggil workspace-files/route.ts menggantikan pemanggilan
// extractTextFromBuffer langsung.
// ---------------------------------------------------------------------------

export async function extractTextForWorkspaceFile(fileName: string, buffer: Buffer): Promise<string> {
  const ext = getFileExtension(fileName);
  const raw = ext === 'pptx' ? await extractPptxText(buffer) : await extractTextFromBuffer(fileName, buffer);

  if (containsNulByte(raw)) {
    throw new Error(
      `Hasil ekstraksi "${fileName}" mengandung data biner yang tidak valid sebagai teks -- kemungkinan format .${ext} ini tidak didukung penuh atau file korup. Coba konversi ke PDF/XLSX/CSV lalu unggah ulang.`
    );
  }
  return raw;
}

// ---------------------------------------------------------------------------
// B1 BACKEND, 8 Sep 2026 (T2 zip-per-entri, jalur Pusat Data) -- lihat
// dokumen sintesis komando "dua pintu upload" 8 Sep untuk kontrak lengkap.
// ---------------------------------------------------------------------------

/** Batas panjang VarChar(255) kolom WorkspaceFile.fileName (prisma/schema.prisma). */
const WORKSPACE_FILE_NAME_MAX_LEN = 255;

/**
 * Gabungkan nama file induk + path entri zip jadi "induk.zip/entri.ext",
 * dipotong cerdas kalau melebihi VarChar(255) -- EKSTENSI ENTRI (bagian
 * setelah titik TERAKHIR di entryPath) WAJIB tetap utuh di akhir hasil,
 * supaya getFileExtension()/deteksi ledger/badge impor-ke-kas tetap benar
 * untuk child hasil pemotongan. Kalau muat (kasus normal, mayoritas), hasil
 * = gabungan APA ADANYA tanpa potongan sama sekali.
 */
export function buildSafeChildFileName(parentFileName: string, entryPath: string): string {
  const combined = `${parentFileName}/${entryPath}`;
  if (combined.length <= WORKSPACE_FILE_NAME_MAX_LEN) return combined;

  const entryExt = getFileExtension(entryPath);
  const extSuffix = entryExt ? `.${entryExt}` : '';

  // Kasus ekstrem (extSuffix sendiri >= batas): ambil ekor extSuffix persis
  // sepanjang batas -- tidak ada ruang tersisa untuk bagian nama apapun.
  if (extSuffix.length >= WORKSPACE_FILE_NAME_MAX_LEN) {
    return extSuffix.slice(-WORKSPACE_FILE_NAME_MAX_LEN);
  }

  const budgetForBase = WORKSPACE_FILE_NAME_MAX_LEN - extSuffix.length;
  // Sisipkan penanda potongan "..." kalau ruang masih cukup (>=3 char) supaya
  // jelas ini nama yang dipotong, bukan kebetulan pas panjangnya.
  const base =
    budgetForBase >= 3
      ? `${combined.slice(0, budgetForBase - 3)}...`
      : combined.slice(0, budgetForBase);

  return `${base}${extSuffix}`;
}

/** Hasil ekstraksi SATU entri di dalam arsip .zip yang diupload ke Pusat Data. */
export interface WorkspaceZipEntryResult {
  /** Nama entri APA ADANYA di dalam arsip (path lengkap termasuk folder). */
  name: string;
  /** Nama child WorkspaceFile hasil buildSafeChildFileName -- dipakai sbg fileName saat create. */
  childFileName: string;
  status: 'extracted' | 'skipped_nested_zip' | 'skipped_unsupported' | 'failed';
  /** Terisi HANYA kalau status='extracted' -- bytes asli entri (jadi storageBlob child). */
  buffer?: Buffer;
  /** Terisi HANYA kalau status='extracted' -- hasil ekstraksi teks entri ini. */
  content?: string;
  /** Terisi kalau status='failed' -- alasan gagal, sudah aman ditampilkan (bukan stack trace). */
  error?: string;
}

/**
 * Ekstrak SEMUA entri di dalam arsip .zip yang didukung, satu-per-satu,
 * SUPAYA masing-masing bisa jadi WorkspaceFile TERPISAH (T2). Reuse penuh
 * listZipEntries() (documents/extract-text/route.ts, tidak diedit) untuk
 * buka arsip + tegakkan cap keamanan (50 entri/40MB/no-rekursi-zip) --
 * kalau itu throw (arsip korup/melebihi cap), error PROPAGATE APA ADANYA ke
 * pemanggil (workspace-files/route.ts) supaya parent record ditandai FAILED
 * dan ZERO child dibuat (tidak ada child yang sempat ditulis sebagian).
 *
 * SENGAJA memakai SUPPORTED_WORKSPACE_FILE_EXTENSIONS (allowlist file ini
 * sendiri, baris 45-49 di atas) -- LEBIH LUAS dari ZIP_ENTRY_EXTRACTABLE_
 * EXTENSIONS milik jalur chat (documents/extract-text/route.ts): pptx DAN
 * gambar (OCR) IKUT diekstrak per-entri di sini. Ini KEPUTUSAN SADAR (bukan
 * kelalaian) -- upload ke Pusat Data adalah tindakan eksplisit "masukkan ke
 * database perusahaan", beda konteks dari lampiran chat sekali-pakai, jadi
 * biaya OCR/parsing pptx per entri diterima. Konsekuensi biaya: zip berisi
 * N gambar men-trigger N panggilan Gemini Vision OCR SEKUENSIAL dalam SATU
 * request HTTP -- dicatat eksplisit di laporan akhir, BUKAN disembunyikan.
 *
 * Kegagalan SATU entri (containsNulByte, parser melempar, dst) TIDAK
 * menggagalkan entri lain -- status='failed' per-entri, proses lanjut.
 */
export async function extractWorkspaceZipEntries(
  buffer: Buffer,
  parentFileName: string
): Promise<WorkspaceZipEntryResult[]> {
  // Boleh throw (cap ZIP_MAX_ENTRIES/ZIP_MAX_TOTAL_DECOMPRESSED_BYTES/arsip
  // korup) -- SENGAJA TIDAK ditangkap di sini, propagate ke caller.
  const entries = await listZipEntries(buffer);
  const results: WorkspaceZipEntryResult[] = [];

  for (const entry of entries) {
    const childFileName = buildSafeChildFileName(parentFileName, entry.name);

    if (entry.isNestedZip) {
      results.push({ name: entry.name, childFileName, status: 'skipped_nested_zip' });
      continue;
    }
    if (entry.readError) {
      results.push({ name: entry.name, childFileName, status: 'failed', error: entry.readError });
      continue;
    }

    const entryExt = getFileExtension(entry.name);
    // 8 Sep (temuan refuter KRITIS biaya): gambar di dalam zip TIDAK di-OCR otomatis -- N foto = N
    // panggilan Gemini Vision berbayar tanpa persetujuan. Didaftar saja; unggah gambar terpisah bila perlu.
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(entryExt)) {
      results.push({ name: entry.name, childFileName, status: 'skipped_unsupported', error: 'gambar di dalam arsip tidak di-OCR otomatis (hemat biaya) -- unggah gambar ini terpisah bila isinya perlu dibaca' });
      continue;
    }
    if (!SUPPORTED_WORKSPACE_FILE_EXTENSIONS.has(entryExt)) {
      results.push({ name: entry.name, childFileName, status: 'skipped_unsupported' });
      continue;
    }

    // entry.buffer dijamin non-null di sini: bukan isNestedZip, bukan readError
    // (lihat kontrak ZipEntryRaw di documents/extract-text/route.ts).
    const entryBuffer = entry.buffer as Buffer;
    try {
      const raw = entryExt === 'pptx' ? await extractPptxText(entryBuffer) : await extractTextFromBuffer(entry.name, entryBuffer);
      if (containsNulByte(raw)) {
        results.push({
          name: entry.name,
          childFileName,
          status: 'failed',
          error: `Hasil ekstraksi "${entry.name}" mengandung data biner yang tidak valid sebagai teks.`,
        });
        continue;
      }
      results.push({ name: entry.name, childFileName, status: 'extracted', buffer: entryBuffer, content: raw });
    } catch (err: any) {
      results.push({ name: entry.name, childFileName, status: 'failed', error: err?.message || 'gagal diekstrak' });
    }
  }

  return results;
}
