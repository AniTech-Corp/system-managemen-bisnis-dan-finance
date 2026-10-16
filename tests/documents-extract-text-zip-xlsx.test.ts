import assert from 'node:assert/strict';
import { before, describe, test } from 'node:test';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// FASE BUILD 7 Sep 2026 (B2 -- roadmap integrasi data upload item 1+2) --
// regression test untuk:
//   src/app/api/v1/documents/extract-text/route.ts (extractTextFromBuffer
//   cabang 'zip' baru + extractZipText() + ringkasan xlsx generik)
//   src/lib/workspace-file-extraction.ts (allowlist 'zip' + guard NUL byte
//   tetap jalan untuk hasil ekstraksi zip)
//
// Fungsi yang diuji di sini PURE (tidak sentuh Prisma/DB/auth) -- TIDAK
// perlu fake-prisma/JWT seperti tests/extract-text-ledger-wiring.test.ts,
// cukup import langsung dan panggil.
//
// Zip disintesis via JSZip DI DALAM test (BUKAN file dummy Mecca asli) --
// sesuai ATURAN KERAS context pack 7 Sep. Jalankan dengan
// `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

async function buildZipBuffer(entries: Array<{ name: string; content: Buffer | string }>): Promise<Buffer> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const e of entries) zip.file(e.name, e.content);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function buildPlainTabularXlsx(): Buffer {
  // Xlsx BUKAN ledger klasik (tidak ada "kode posting"/sheet "kas") --
  // representasi generik laporan-penjualan-bulanan.xlsx dummy Mecca (data
  // sintetis, bukan file asli). Kolom "Jumlah" numerik murni, "Tanggal" dan
  // "Item" teks -- dipakai untuk membuktikan deteksi kolom "mayoritas numerik".
  const wb = XLSX.utils.book_new();
  const rows: unknown[][] = [
    ['Tanggal', 'Item', 'Jumlah'],
    ['2026-09-01', 'Nasi Goreng', 25000],
    ['2026-09-02', 'Mie Ayam', 18000],
    ['2026-09-03', 'Es Teh', 5000],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Data Harian');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('B2: extractZipText (arsip .zip generik)', { concurrency: false }, () => {
  let extractTextFromBuffer: typeof import('../src/app/api/v1/documents/extract-text/route')['extractTextFromBuffer'];
  let extractZipText: typeof import('../src/app/api/v1/documents/extract-text/route')['extractZipText'];
  let extractTextForWorkspaceFile: typeof import('../src/lib/workspace-file-extraction')['extractTextForWorkspaceFile'];
  let isSupportedWorkspaceFileExtension: typeof import('../src/lib/workspace-file-extraction')['isSupportedWorkspaceFileExtension'];

  before(async () => {
    ({ extractTextFromBuffer, extractZipText } = await import('../src/app/api/v1/documents/extract-text/route'));
    ({ extractTextForWorkspaceFile, isSupportedWorkspaceFileExtension } = await import('../src/lib/workspace-file-extraction'));
  });

  test('.zip masuk SUPPORTED_WORKSPACE_FILE_EXTENSIONS (upload Pusat Data tidak lagi 422)', () => {
    assert.equal(isSupportedWorkspaceFileExtension('arsip-laporan.zip'), true);
  });

  test('zip berisi .txt + .csv -> kedua isi entri muncul, header "=== [n/N] nama ===" per entri', async () => {
    const buf = await buildZipBuffer([
      { name: 'catatan.txt', content: 'Ini catatan teks biasa di dalam zip.' },
      { name: 'transaksi.csv', content: 'Tanggal,Jumlah\n2026-09-01,10000' },
    ]);
    const output = await extractTextFromBuffer('arsip.zip', buf);
    assert.match(output, /=== \[1\/2\] catatan\.txt ===/);
    assert.match(output, /Ini catatan teks biasa di dalam zip\./);
    assert.match(output, /=== \[2\/2\] transaksi\.csv ===/);
    // extractTextFromBuffer utk csv membungkusnya jadi tabel markdown -- cek isi datanya tetap ada.
    assert.match(output, /2026-09-01/);
    assert.match(output, /10000/);
  });

  test('extractZipText bisa dipanggil langsung (bukan cuma lewat extractTextFromBuffer)', async () => {
    const buf = await buildZipBuffer([{ name: 'a.txt', content: 'halo dunia' }]);
    const output = await extractZipText(buf);
    assert.match(output, /=== \[1\/1\] a\.txt ===/);
    assert.match(output, /halo dunia/);
  });

  test('entri gambar/tidak didukung DIDAFTAR namanya, bukan digagalkan (tidak trigger OCR)', async () => {
    const buf = await buildZipBuffer([
      { name: 'foto-nota.png', content: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03]) },
      { name: 'data.txt', content: 'teks yang genuinely diekstrak' },
    ]);
    const output = await extractTextFromBuffer('arsip-campuran.zip', buf);
    assert.match(output, /foto-nota\.png/);
    assert.match(output, /tidak diekstrak otomatis di dalam arsip/);
    // TIDAK memicu OCR Gemini (yang butuh network/API key) -- kalau ini pernah
    // dipanggil, hasilnya akan mengandung penanda "[Hasil OCR Gambar Dokumen".
    assert.doesNotMatch(output, /Hasil OCR Gambar Dokumen/);
    assert.match(output, /teks yang genuinely diekstrak/);
  });

  test('entri .zip di dalam .zip DITOLAK per-entri (dicatat namanya), tidak menggagalkan seluruh arsip', async () => {
    const nestedZipBytes = Buffer.from('bukan perlu jadi zip valid, tidak pernah dibuka', 'utf8');
    const buf = await buildZipBuffer([
      { name: 'nested.zip', content: nestedZipBytes },
      { name: 'catatan.txt', content: 'entri normal tetap diproses' },
    ]);
    const output = await extractTextFromBuffer('arsip-bersarang.zip', buf);
    assert.match(output, /nested\.zip/);
    assert.match(output, /zip di dalam \.zip tidak didukung/);
    assert.match(output, /entri normal tetap diproses/);
  });

  test('arsip dengan >50 entri DITOLAK TOTAL (cap ZIP_MAX_ENTRIES)', async () => {
    const entries = Array.from({ length: 51 }, (_, i) => ({ name: `f${i}.txt`, content: 'x' }));
    const buf = await buildZipBuffer(entries);
    await assert.rejects(
      () => extractZipText(buf),
      /melebihi batas 50 entri/
    );
  });

  test('total hasil dekompresi >40MB DITOLAK (cap ZIP_MAX_TOTAL_DECOMPRESSED_BYTES, dicek streaming)', async () => {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    // 45MB byte seragam -- kompres DEFLATE ke ukuran nyaris nol (cepat dibuat),
    // tapi hasil DEKOMPRESI tetap 45MB > cap 40MB -> harus ditolak sebelum
    // seluruh buffer termaterialisasi (lihat readZipEntryWithinBudget).
    zip.file('big.txt', Buffer.alloc(45 * 1024 * 1024, 'a'), { compression: 'DEFLATE', compressionOptions: { level: 9 } });
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    await assert.rejects(
      () => extractZipText(buf),
      /melebihi batas 40MB/
    );
  });

  test('arsip korup (bukan zip valid) -> pesan jelas, bukan exception mentah', async () => {
    const buf = Buffer.from('INI BUKAN ARSIP ZIP SAMA SEKALI', 'utf8');
    await assert.rejects(
      () => extractZipText(buf),
      /tidak bisa dibuka/
    );
  });

  test('guard containsNulByte (workspace-file-extraction.ts) tetap menolak hasil ekstraksi zip yang mengandung byte NUL', async () => {
    const buf = await buildZipBuffer([
      { name: 'rusak.txt', content: Buffer.from('teks valid\x00lalu ada byte NUL di tengah', 'utf8') },
    ]);
    await assert.rejects(
      () => extractTextForWorkspaceFile('arsip-nul.zip', buf),
      /data biner yang tidak valid/
    );
  });

  test('xlsx generik (BUKAN ledger klasik) -> blok RINGKASAN DATA berisi header/jumlah baris/kolom numerik', async () => {
    const buf = buildPlainTabularXlsx();
    const output = await extractTextFromBuffer('laporan-penjualan-sintetis.xlsx', buf);
    assert.match(output, /RINGKASAN DATA/);
    assert.match(output, /Header terdeteksi: Tanggal \| Item \| Jumlah/);
    assert.match(output, /Jumlah baris data \(di luar header\): 3/);
    // kolom "Jumlah" (25000+18000+5000=48000) harus terdeteksi sbg kolom numerik.
    assert.match(output, /Jumlah \(kolom 3\): total 48\.000/);
    // "Tanggal"/"Item" (teks) TIDAK boleh muncul sbg kolom numerik.
    assert.doesNotMatch(output, /Tanggal \(kolom 1\): total/);
  });

  test('xlsx generik: 25 baris pertama disertakan sebagai CSV', async () => {
    const buf = buildPlainTabularXlsx();
    const output = await extractTextFromBuffer('laporan-penjualan-sintetis-2.xlsx', buf);
    assert.match(output, /baris pertama \(format CSV/);
    assert.match(output, /Tanggal,Item,Jumlah/);
    assert.match(output, /2026-09-01,Nasi Goreng,25000/);
  });
});

// ---------------------------------------------------------------------------
// B4 TESTS (8 Sep 2026) -- KONTRAK T2 "dua pintu upload": listZipEntries()
// (documents/extract-text/route.ts, dipecah dari extractZipText) +
// extractWorkspaceZipEntries() / buildSafeChildFileName() (workspace-file-
// extraction.ts, milik B1). Test ditulis terhadap KONTRAK di rencana komando
// SEBELUM/SELAMA B1 membangunnya -- kalau export belum ada saat suite ini
// jalan, `before()` di bawah mencatatnya sebagai `undefined` (dynamic import,
// TIDAK melempar SyntaxError seperti static import) dan tiap test men-declare
// jujur "belum diimplementasikan" lewat assert.fail, BUKAN skip diam-diam.
//
// Sengaja SIBLING describe baru (bukan menambah test ke describe di atas) --
// fungsi-fungsi ini pure (tidak sentuh Prisma/auth) jadi aman berbagi proses
// yang sama tanpa risiko cross-describe module-cache seperti modul yang
// bergantung pada globalThis.prisma (lihat catatan_jujur laporan akhir B4).
// ---------------------------------------------------------------------------

describe('B4 KONTRAK T2 (8 Sep 2026): listZipEntries / extractWorkspaceZipEntries / buildSafeChildFileName', { concurrency: false }, () => {
  let listZipEntries: typeof import('../src/app/api/v1/documents/extract-text/route')['listZipEntries'] | undefined;
  let extractWorkspaceZipEntries: typeof import('../src/lib/workspace-file-extraction')['extractWorkspaceZipEntries'] | undefined;
  let buildSafeChildFileName: typeof import('../src/lib/workspace-file-extraction')['buildSafeChildFileName'] | undefined;
  let extractZipText: typeof import('../src/app/api/v1/documents/extract-text/route')['extractZipText'];
  let getFileExtension: typeof import('../src/lib/workspace-file-extraction')['getFileExtension'];

  before(async () => {
    const extractTextRoute: any = await import('../src/app/api/v1/documents/extract-text/route');
    const workspaceExtraction: any = await import('../src/lib/workspace-file-extraction');
    listZipEntries = extractTextRoute.listZipEntries;
    extractZipText = extractTextRoute.extractZipText;
    extractWorkspaceZipEntries = workspaceExtraction.extractWorkspaceZipEntries;
    buildSafeChildFileName = workspaceExtraction.buildSafeChildFileName;
    getFileExtension = workspaceExtraction.getFileExtension;
  });

  async function buildPptxEntryBuffer(text: string): Promise<Buffer> {
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const slideXml =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
      `<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
    zip.file('ppt/slides/slide1.xml', slideXml);
    return zip.generateAsync({ type: 'nodebuffer' });
  }

  test('listZipEntries: dua entri normal -> buffer terisi, isNestedZip false untuk keduanya', async () => {
    if (!listZipEntries) return assert.fail('listZipEntries belum diekspor dari documents/extract-text/route.ts (B1 belum implementasi T2)');
    const buf = await buildZipBuffer([
      { name: 'a.txt', content: 'isi a' },
      { name: 'b.csv', content: 'Kolom\nnilai' },
    ]);
    const entries = await listZipEntries(buf);
    assert.equal(entries.length, 2);
    for (const e of entries) {
      assert.equal(e.isNestedZip, false);
      assert.ok(Buffer.isBuffer(e.buffer), `entri ${e.name} harus punya buffer non-null`);
    }
  });

  test('listZipEntries: entri .zip bersarang ditandai isNestedZip=true, TIDAK dibaca (buffer null)', async () => {
    if (!listZipEntries) return assert.fail('listZipEntries belum diekspor (B1 belum implementasi T2)');
    const buf = await buildZipBuffer([
      { name: 'nested.zip', content: Buffer.from('bukan perlu jadi zip valid, tidak pernah dibuka', 'utf8') },
      { name: 'normal.txt', content: 'teks biasa' },
    ]);
    const entries = await listZipEntries(buf);
    const nested = entries.find((e) => e.name === 'nested.zip');
    const normal = entries.find((e) => e.name === 'normal.txt');
    assert.ok(nested, 'entri nested.zip harus ada di hasil listZipEntries');
    assert.equal(nested!.isNestedZip, true);
    assert.equal(nested!.buffer, null, 'entri zip bersarang TIDAK PERNAH dibaca -- buffer harus null');
    assert.equal(normal!.isNestedZip, false);
    assert.ok(Buffer.isBuffer(normal!.buffer));
  });

  test('listZipEntries: tetap menegakkan cap ZIP_MAX_ENTRIES (>50 entri) sama seperti extractZipText', async () => {
    if (!listZipEntries) return assert.fail('listZipEntries belum diekspor (B1 belum implementasi T2)');
    const entries = Array.from({ length: 51 }, (_, i) => ({ name: `f${i}.txt`, content: 'x' }));
    const buf = await buildZipBuffer(entries);
    await assert.rejects(() => listZipEntries!(buf), /melebihi batas 50 entri/);
  });

  test('extractWorkspaceZipEntries: pptx DI DALAM zip DIEKSTRAK (beda dari extractZipText/jalur chat yang skip pptx)', async () => {
    if (!extractWorkspaceZipEntries) return assert.fail('extractWorkspaceZipEntries belum diekspor dari workspace-file-extraction.ts (B1 belum implementasi T2)');
    const pptxBytes = await buildPptxEntryBuffer('Profil Perusahaan Sintetis Pusat Data');
    const buf = await buildZipBuffer([{ name: 'company-profile.pptx', content: pptxBytes }]);

    const workspaceResults = await extractWorkspaceZipEntries(buf, 'arsip-pptx.zip');
    const pptxResult = workspaceResults.find((r) => r.name === 'company-profile.pptx');
    assert.ok(pptxResult, 'entri pptx harus ada di hasil extractWorkspaceZipEntries');
    assert.equal(pptxResult!.status, 'extracted', 'jalur Pusat Data (workspace) HARUS mengekstrak pptx di dalam zip (T2-5)');
    assert.match(pptxResult!.content || '', /Profil Perusahaan Sintetis Pusat Data/);

    // Bukti DIVERGENSI yang disengaja: jalur chat (extractZipText) TETAP skip pptx
    // untuk input ZIP YANG SAMA -- dua kebijakan berbeda, bukan bug.
    const chatOutput = await extractZipText(buf);
    assert.match(chatOutput, /tidak diekstrak otomatis di dalam arsip/, 'extractZipText (jalur chat) harus TETAP skip pptx di dalam zip');
    assert.doesNotMatch(chatOutput, /Profil Perusahaan Sintetis Pusat Data/);
  });

  test('extractWorkspaceZipEntries: 1 entri korup (byte NUL) berstatus failed, entri lain TETAP extracted (partial failure isolated)', async () => {
    if (!extractWorkspaceZipEntries) return assert.fail('extractWorkspaceZipEntries belum diekspor (B1 belum implementasi T2)');
    const buf = await buildZipBuffer([
      { name: 'rusak.txt', content: Buffer.from('teks valid\x00lalu ada byte NUL di tengah', 'utf8') },
      { name: 'sehat.txt', content: 'entri ini benar-benar sehat dan harus tetap terekstrak' },
    ]);
    const results = await extractWorkspaceZipEntries(buf, 'arsip-campuran-nul.zip');
    const rusak = results.find((r) => r.name === 'rusak.txt');
    const sehat = results.find((r) => r.name === 'sehat.txt');
    assert.equal(rusak!.status, 'failed', '1 entri korup TIDAK BOLEH menggagalkan seluruh batch, tapi entri itu sendiri harus failed');
    assert.ok(rusak!.error && rusak!.error.length > 0);
    assert.equal(sehat!.status, 'extracted');
    assert.match(sehat!.content || '', /entri ini benar-benar sehat/);
  });

  test('extractWorkspaceZipEntries: entri .zip bersarang -> status skipped_nested_zip (bukan extracted, bukan failed)', async () => {
    if (!extractWorkspaceZipEntries) return assert.fail('extractWorkspaceZipEntries belum diekspor (B1 belum implementasi T2)');
    const buf = await buildZipBuffer([{ name: 'nested.zip', content: Buffer.from('isi tidak penting', 'utf8') }]);
    const results = await extractWorkspaceZipEntries(buf, 'arsip-nested.zip');
    assert.equal(results[0].status, 'skipped_nested_zip');
  });

  test('buildSafeChildFileName: nama gabungan pendek -> apa adanya "induk.zip/entri.ext"', () => {
    if (!buildSafeChildFileName) return assert.fail('buildSafeChildFileName belum diekspor dari workspace-file-extraction.ts (B1 belum implementasi T2)');
    const result = buildSafeChildFileName('arsip.zip', 'laporan.xlsx');
    assert.equal(result, 'arsip.zip/laporan.xlsx');
    assert.equal(getFileExtension(result), 'xlsx', 'getFileExtension harus tetap benar untuk nama gabungan (ambil setelah titik TERAKHIR)');
  });

  test('buildSafeChildFileName: gabungan >255 karakter dipotong cerdas, TOTAL tetap <=255, ekstensi entri tetap utuh di akhir', () => {
    if (!buildSafeChildFileName) return assert.fail('buildSafeChildFileName belum diekspor (B1 belum implementasi T2)');
    const longParent = 'arsip-laporan-keuangan-lengkap-tahun-2026-milik-perusahaan-sintetis-yang-namanya-sangat-panjang.zip';
    const longEntryPath = 'folder/sub-folder/dalam/lagi/laporan-keuangan-bulanan-lengkap-dengan-rincian-per-departemen-dan-per-cabang-final-revisi-terbaru.xlsx';
    const result = buildSafeChildFileName(longParent, longEntryPath);
    assert.ok(result.length <= 255, `hasil harus <=255 karakter (VarChar limit), dapat ${result.length}`);
    assert.match(result, /\.xlsx$/, 'ekstensi entri (.xlsx) WAJIB tetap utuh di akhir hasil pemotongan');
    assert.equal(getFileExtension(result), 'xlsx');
  });
});
