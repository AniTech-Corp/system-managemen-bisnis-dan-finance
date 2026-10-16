import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// FASE BUILD 7 Sep 2026 -- regression tests untuk fix upload-001 (KRITIS),
// upload-002 (TINGGI), upload-006 (RENDAH, defensif), integrasi-01 (KRITIS) di
// src/app/api/v1/workspace-files/route.ts + src/lib/workspace-file-extraction.ts +
// src/lib/workspace-file-ledger.ts.
//
// Bukti bug sebelum fix (direproduksi via HTTP nyata 7 Sep, workspace test
// 3da87aff): upload .pptx asli -> HTTP 200, status FAILED, message berisi RATUSAN
// BARIS source Next.js/webpack + stack trace Prisma mentah (byte NUL 0x00 dari
// buffer.toString('utf8') fallback ditolak Postgres). Test di bawah membuktikan
// (a) .pptx sekarang genuinely diekstrak (bukan garbage), (b) ekstensi tak
// didukung ditolak BERSIH di depan (422, pesan manusiawi), (c) file .xlsx ledger
// yang diupload lewat Pusat Data SEKARANG ikut disisipi blok ANGKA TERVERIFIKASI
// (integrasi-01 -- sebelumnya jalur ini 0% pernah lewat ledger-parser sama sekali).
//
// Pola: in-memory fake Prisma proxy + JWT asli, sama dengan
// tests/extract-text-ledger-wiring.test.ts (endpoint ini dibungkus withTenantGuard
// yang sama). Jalankan dengan `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

async function buildSyntheticPptxBuffer(): Promise<Buffer> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  const slideXml = (text: string) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">` +
    `<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
  zip.file('ppt/slides/slide1.xml', slideXml('Profil Perusahaan PT Makan Mania Mantap'));
  zip.file('ppt/slides/slide2.xml', slideXml('Visi and Misi'));
  return zip.generateAsync({ type: 'nodebuffer' });
}

function buildCorruptPptxBuffer(): Buffer {
  // Bukan arsip ZIP sama sekali (byte acak) -- mensimulasikan file .pptx yang
  // benar-benar korup, bukan cuma "tidak dikenali JSZip karena isinya beda".
  return Buffer.from('INI BUKAN ZIP SAMA SEKALI \x00\x00\x00 GARBAGE BINER', 'utf8');
}

function buildSyntheticLedgerWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  const kodePostingRows: unknown[][] = [
    ['Contoh Usaha Sintetis'],
    ['KODE ETIK PEMBUKUAN'],
    [],
    [null, 25, 'Penjualan Barang Umum', null, null, null, null, null, 60, 'Sewa Kantor'],
    [null, 26, 'Penjualan Jasa', null, null, null, null, null, 10, 'Modal'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kodePostingRows), 'kode posting');

  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  const bukuKasRows: unknown[][] = [
    ['BUKU KAS'],
    [], [], [], [], [],
    ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
    [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
    [2, d(2024, 1, 1), 'Modal awal', 10, 1000000, null, 1000000],
    [3, d(2024, 1, 2), 'Penjualan Barang Umum', 25, 500000, null, 1500000],
    [4, d(2024, 1, 3), 'Bayar Sewa Kantor', 60, null, 100000, 1400000],
    [5, d(2024, 1, 4), 'Penjualan Jasa', 26, 300000, null, 1700000],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bukuKasRows), 'buku kas');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function multipartFileRequest(url: string, token: string, fileName: string, buffer: Buffer, mimeType: string) {
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
  return new NextRequest(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
}

// B4 TESTS (8 Sep 2026) -- KONTRAK T3 (kontrak dgn B2): dipakai membuktikan
// `preExtractedContent` diteruskan APA ADANYA (skip ekstraksi ulang) untuk
// ekstensi non-pptx, dan DIABAIKAN (tetap ekstraksi asli) khusus .pptx (T3-05).
function multipartFileRequestWithPreExtracted(
  url: string,
  token: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string,
  preExtractedContent: string
) {
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
  formData.append('preExtractedContent', preExtractedContent);
  return new NextRequest(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
}

// B4 TESTS (8 Sep 2026) -- helper zip generik (dipakai test T2 di bawah,
// pola SAMA dgn buildZipBuffer di tests/documents-extract-text-zip-xlsx.test.ts).
async function buildZipBufferForUpload(entries: Array<{ name: string; content: Buffer | string }>): Promise<Buffer> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const e of entries) zip.file(e.name, e.content);
  return zip.generateAsync({ type: 'nodebuffer' });
}

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('Fix upload-001/upload-002/integrasi-01: workspace-files POST', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let workspaceFilesPOST: typeof import('../src/app/api/v1/workspace-files/route')['POST'];

  type Query = { where?: any; data?: any; select?: unknown };
  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let workspaceFiles: Map<string, any>;
  let simulateDbWriteFailureOnUpdate: boolean;

  const fakePrisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      if (model.startsWith('$')) return async () => { throw new Error(`Forbidden Prisma operation: ${model}`); };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: Query) => {
            const method = `${model}.${operation}`;
            if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
            if (method === 'workspace.findUnique') {
              const found = workspaces.get(query.where?.id ?? '');
              return found
                ? { id: found.id, name: found.name, slug: found.slug, ownerId: found.ownerId, members: found.members, resourceGrants: found.resourceGrants }
                : null;
            }
            if (method === 'workspaceFile.create') {
              const id = `wf-${workspaceFiles.size + 1}`;
              const record = { id, createdAt: new Date(), ...query.data };
              workspaceFiles.set(id, record);
              return record;
            }
            if (method === 'workspaceFile.update') {
              // Simulasi kegagalan write Postgres mentah (byte NUL) untuk membuktikan
              // upload-001 (c): pesan yang sampai ke client HARUS sudah disaring,
              // bukan pesan Postgres asli ini.
              if (simulateDbWriteFailureOnUpdate && query.data?.status === 'PROCESSED') {
                throw new Error(
                  'PostgresError { severity: "ERROR", code: "22021", message: "invalid byte sequence for encoding \\"UTF8\\": 0x00" } at Object.query (/app/node_modules/.next/server/chunks/1234.js:9876:54) at async __webpack_require__'
                );
              }
              const existing = workspaceFiles.get(query.where.id);
              const updated = { ...existing, ...query.data };
              workspaceFiles.set(query.where.id, updated);
              return updated;
            }
            if (method === 'memoryItem.create' || method === 'activityLog.create' || method === 'activityEvent.create') {
              // Non-fatal fire-and-forget di company-memory.ts/activity-log.ts --
              // tidak perlu disimulasikan penuh, cukup tidak melempar.
              return { id: 'mem-1' };
            }
            throw new Error(`Forbidden Prisma operation in test fixture: ${method}`);
          };
        },
      });
    },
  });

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'workspace-files-upload-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: workspaceFilesPOST } = await import('../src/app/api/v1/workspace-files/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    workspaceFiles = new Map();
    simulateDbWriteFailureOnUpdate = false;
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedTenant(idSuffix: string) {
    const userId = `user-${idSuffix}`;
    const wsId = `ws-${idSuffix}`;
    users.set(userId, { id: userId, email: `${userId}@example.invalid`, fullName: `Test ${userId}`, isSuperAdmin: false });
    workspaces.set(wsId, { id: wsId, name: `Toko ${idSuffix}`, slug: `toko-${idSuffix}`, ownerId: userId, members: [], resourceGrants: [] });
    return signJwtToken({ userId, workspaceId: wsId });
  }

  test('upload .pptx asli -> PROCESSED, extractedSummary berisi teks slide (bukan garbage biner)', async () => {
    const token = seedTenant('pptx-ok');
    const buffer = await buildSyntheticPptxBuffer();
    const res = await workspaceFilesPOST(multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'company-profile.pptx', buffer, PPTX_MIME));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.file.status, 'PROCESSED');
    assert.match(body.file.extractedSummary, /Profil Perusahaan PT Makan Mania Mantap/);
    assert.match(body.file.extractedSummary, /Visi and Misi/);
    assert.match(body.file.extractedSummary, /### Slide 1/);
    assert.match(body.file.extractedSummary, /### Slide 2/);
    // upload-001 root cause: hasil ekstraksi TIDAK BOLEH mengandung byte NUL.
    assert.equal(body.file.extractedSummary.includes('\x00'), false);
  });

  test('upload .pptx korup (bukan arsip ZIP valid) -> FAILED dengan pesan manusiawi, bukan stack trace mentah', async () => {
    const token = seedTenant('pptx-corrupt');
    const buffer = buildCorruptPptxBuffer();
    const res = await workspaceFilesPOST(multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'rusak.pptx', buffer, PPTX_MIME));
    assert.equal(res.status, 200); // desain existing: upload sukses tersimpan, status FAILED di body
    const body = await res.json();
    assert.equal(body.file.status, 'FAILED');
    assert.ok(body.message);
    assert.ok(body.message.length < 400, `pesan error harus pendek & manusiawi, dapat ${body.message.length} karakter`);
    assert.doesNotMatch(body.message, /at Object\.|__webpack_require__|node_modules|PostgresError/);
  });

  test('upload ekstensi tidak didukung (.mp4) -> 422 ditolak BERSIH di depan, bukan diproses lalu gagal', async () => {
    const token = seedTenant('mp4-reject');
    const buffer = Buffer.from('bukan video sungguhan, cuma bytes acak untuk tes', 'utf8');
    const res = await workspaceFilesPOST(multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'video-promo.mp4', buffer, 'video/mp4'));
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.match(body.message, /\.mp4/);
    assert.match(body.message, /PDF|Word|Excel|PowerPoint/);
    // Ekstensi ditolak SEBELUM record apapun dibuat -- tidak ada WorkspaceFile tersimpan.
    assert.equal(workspaceFiles.size, 0);
  });

  test('upload xlsx ledger yang dikenali -> extractedSummary diawali blok ANGKA TERVERIFIKASI (integrasi-01)', async () => {
    const token = seedTenant('xlsx-ledger');
    const buffer = buildSyntheticLedgerWorkbook();
    const res = await workspaceFilesPOST(multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'PT-Sintetis.xlsx', buffer, XLSX_MIME));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.file.status, 'PROCESSED');
    assert.equal(body.isRecognizedLedger, true);
    // V4a, 8 Sep 2026: assertion di-longgarkan dari anchor `^` ke non-anchor --
    // fixture sintetis ini SEKARANG genuinely memicu blok "[PEMERIKSAAN DATA]"
    // (checkTabularText menemukan duplicate-row/missing-required-cell info-level
    // atas markdown-table hasil ekstraksi xlsx, lihat keterbatasan jujur di
    // workspace-file-dataquality.ts) yang SENGAJA disisipkan LEBIH DULU dari
    // blok ANGKA TERVERIFIKASI (kontrak: dqBlock di posisi PALING AWAL
    // extractedSummary). Substansi test (blok ledger genuinely ada & isinya
    // benar) TIDAK berubah -- cuma posisi absolut-di-awal yang dilonggarkan.
    assert.match(body.file.extractedSummary, /===== ANGKA TERVERIFIKASI/);
    assert.match(body.file.extractedSummary, /Saldo Akhir: Rp 1\.700\.000/);
  });

  test('upload xlsx BUKAN ledger -> tidak ada blok ANGKA TERVERIFIKASI, tidak ada field isRecognizedLedger', async () => {
    const token = seedTenant('xlsx-plain');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Catatan'], ['Bukan buku kas sama sekali']]), 'Notulen');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const res = await workspaceFilesPOST(multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'notulen.xlsx', buffer, XLSX_MIME));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal('isRecognizedLedger' in body, false);
    assert.doesNotMatch(body.file.extractedSummary, /ANGKA TERVERIFIKASI/);
  });

  test('kegagalan Postgres mentah saat menyimpan hasil ekstraksi -> pesan ke client disaring (upload-001 poin c)', async () => {
    const token = seedTenant('pg-fail');
    simulateDbWriteFailureOnUpdate = true;
    const buffer = Buffer.from('teks dokumen biasa, valid utf8', 'utf8');
    const res = await workspaceFilesPOST(multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'catatan.txt', buffer, 'text/plain'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.file.status, 'FAILED');
    assert.doesNotMatch(body.message, /PostgresError|invalid byte sequence|__webpack_require__|node_modules/);
    assert.ok(body.message.length < 400);
  });

  test('file > 15MB -> 200, batas 15MB dihapus per arahan Mecca 13 Sep (no size limit)', async () => {
    const token = seedTenant('too-big');
    const bigBuffer = Buffer.alloc(15 * 1024 * 1024 + 1, 'x');
    const res = await workspaceFilesPOST(multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'besar.txt', bigBuffer, 'text/plain'));
    assert.equal(res.status, 200);
  });

  // -------------------------------------------------------------------------
  // B4 TESTS (8 Sep 2026) -- KONTRAK T2 (zip per-entri) + T3 (preExtractedContent)
  // dari sintesis komando "dua pintu upload" 8 Sep. Ditambahkan sebagai test()
  // BARU di DALAM describe yang sudah ada (bukan describe terpisah) supaya
  // reuse seedTenant/workspaceFiles/workspaceFilesPOST yang sama -- fakePrisma
  // di file ini di-bind SEKALI ke module singleton `@/lib/prisma` saat before()
  // di atas jalan pertama kali; describe terpisah dalam file yang sama TIDAK
  // bisa mengganti binding itu lagi (lihat catatan_jujur laporan akhir B4).
  // Tidak SATUPUN assertion 15 test di atas diubah -- murni penambahan.
  // -------------------------------------------------------------------------

  test('T2: upload .zip berisi txt + xlsx-ledger + pptx + nested-zip -> parent PROCESSED, linkedRecordIds = jumlah entri diekstrak, zipSummary benar', async () => {
    const token = seedTenant('zip-multi-entry');
    const pptxBytes = await buildSyntheticPptxBuffer();
    const ledgerBytes = buildSyntheticLedgerWorkbook();
    const buf = await buildZipBufferForUpload([
      { name: 'catatan.txt', content: 'Catatan biasa di dalam arsip.' },
      { name: 'PT-Sintetis.xlsx', content: ledgerBytes },
      { name: 'profil.pptx', content: pptxBytes },
      { name: 'nested.zip', content: Buffer.from('tidak pernah dibuka', 'utf8') },
    ]);

    const res = await workspaceFilesPOST(
      multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'arsip-lengkap.zip', buf, 'application/zip')
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.file.status, 'PROCESSED');

    // 3 entri didukung (txt, xlsx, pptx) diekstrak; nested.zip dilewati -- BUKAN
    // digagalkan (T2-5 divergensi sengaja: pptx IKUT diekstrak di jalur Pusat Data).
    assert.equal(body.file.linkedRecordIds.length, 3, 'linkedRecordIds harus berisi 3 child id (txt+xlsx+pptx), nested.zip TIDAK dihitung');
    assert.ok(body.zipSummary, 'response zip harus punya field additif zipSummary');
    assert.equal(body.zipSummary.totalEntries, 4);
    assert.equal(body.zipSummary.extractedCount, 3);
    assert.equal(body.zipSummary.skippedCount, 1);
    assert.equal(body.zipSummary.failedCount, 0);

    // Verifikasi child WorkspaceFile GENUINELY dibuat (bukan cuma dihitung) --
    // fileName berpola "induk.zip/entri.ext", storageBlob = bytes entri asli
    // (fakePrisma.workspaceFile.create menyimpan `data` apa adanya).
    const childRecords = Array.from(workspaceFiles.values()).filter((f: any) => f.id !== body.file.id);
    assert.equal(childRecords.length, 3);
    const childNames = childRecords.map((f: any) => f.fileName).sort();
    assert.ok(childNames.some((n: string) => n === 'arsip-lengkap.zip/catatan.txt'), `nama child harus berpola "induk.zip/entri.ext", dapat: ${JSON.stringify(childNames)}`);
    assert.ok(childNames.some((n: string) => n === 'arsip-lengkap.zip/PT-Sintetis.xlsx'));
    assert.ok(childNames.some((n: string) => n === 'arsip-lengkap.zip/profil.pptx'));

    // Child xlsx-ledger harus ikut disisipi blok ANGKA TERVERIFIKASI PER CHILD
    // (integrasi-01 diterapkan juga untuk entri zip, sesuai kontrak T2).
    const ledgerChild: any = childRecords.find((f: any) => f.fileName.endsWith('PT-Sintetis.xlsx'));
    // V4a, 8 Sep 2026: sama alasan dengan test non-zip di atas -- assertion
    // dilonggarkan dari anchor `^` karena blok "[PEMERIKSAAN DATA]" SEKARANG
    // genuinely mendahului blok ANGKA TERVERIFIKASI untuk fixture ini.
    assert.match(ledgerChild.extractedSummary, /===== ANGKA TERVERIFIKASI/);

    // Child pptx harus genuinely diekstrak (bukan skip) -- isinya harus memuat
    // teks slide asli, BUKTI LANGSUNG divergensi T2-5 dari jalur chat.
    const pptxChild: any = childRecords.find((f: any) => f.fileName.endsWith('profil.pptx'));
    assert.match(pptxChild.extractedSummary, /Profil Perusahaan PT Makan Mania Mantap/);

    // Record INDUK (parent) TIDAK boleh punya storageBlob milik salah satu
    // child -- summary induk = manifest daftar entri, bukan isi 1 entri.
    assert.match(body.file.extractedSummary, /nested\.zip/);
    assert.match(body.file.extractedSummary, /catatan\.txt/);
  });

  test('T2: zip melebihi ZIP_MAX_ENTRIES (>50 entri) -> parent FAILED, ZERO child dibuat', async () => {
    const token = seedTenant('zip-over-limit');
    const entries = Array.from({ length: 51 }, (_, i) => ({ name: `f${i}.txt`, content: 'x' }));
    const buf = await buildZipBufferForUpload(entries);

    const res = await workspaceFilesPOST(
      multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'arsip-kebanyakan-entri.zip', buf, 'application/zip')
    );
    assert.equal(res.status, 200); // desain existing: upload tersimpan, status FAILED di body
    const body = await res.json();
    assert.equal(body.file.status, 'FAILED');
    // HANYA record parent yang pernah dibuat (PROCESSING lalu di-update jadi
    // FAILED) -- extractWorkspaceZipEntries harus throw SEBELUM child manapun
    // sempat ditulis (propagate ke catch block, bukan partial-commit).
    assert.equal(workspaceFiles.size, 1, `tidak boleh ada child WorkspaceFile yang sempat ditulis sebelum cap terlanggar, dapat ${workspaceFiles.size} record`);
  });

  test('T3: preExtractedContent dipakai APA ADANYA untuk file non-pptx -- ekstraksi ulang di-skip', async () => {
    const token = seedTenant('preextracted-nonpptx');
    // Isi buffer ASLI sengaja BEDA dari preExtractedContent -- kalau server
    // diam-diam mengekstrak ulang dari buffer (bukan pakai preExtractedContent),
    // extractedSummary akan berisi isi buffer asli, BUKAN teks pengganti ini.
    const buffer = Buffer.from('ISI ASLI BUFFER FILE (seharusnya TIDAK dipakai kalau preExtractedContent bekerja)', 'utf8');
    const preExtracted = 'TEKS HASIL EKSTRAKSI CHAT (rawContent dari /documents/extract-text) -- INI yang harus dipakai apa adanya';

    const res = await workspaceFilesPOST(
      multipartFileRequestWithPreExtracted('https://klir.test/api/v1/workspace-files', token, 'catatan-dari-chat.txt', buffer, 'text/plain', preExtracted)
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.file.status, 'PROCESSED');
    assert.ok(body.file.extractedSummary.includes(preExtracted), 'extractedSummary harus memuat preExtractedContent');
    assert.doesNotMatch(body.file.extractedSummary, /ISI ASLI BUFFER FILE/);
  });

  test('T3-05: preExtractedContent DIABAIKAN untuk .pptx -- server tetap ekstraksi ulang dari buffer asli', async () => {
    const token = seedTenant('preextracted-pptx-exception');
    const pptxBuffer = await buildSyntheticPptxBuffer();
    // preExtractedContent GARBAGE sengaja ditulis -- extract-text/route.ts TIDAK
    // punya cabang .pptx (T3-05), jadi kalau server naif memakai field ini apa
    // adanya untuk SEMUA ekstensi, test ini akan menangkapnya sebagai regresi.
    const garbagePreExtracted = 'TEKS SAMPAH DARI CLIENT (extract-text TIDAK BISA baca pptx dgn benar, ini TIDAK BOLEH dipakai)';

    const res = await workspaceFilesPOST(
      multipartFileRequestWithPreExtracted('https://klir.test/api/v1/workspace-files', token, 'company-profile.pptx', pptxBuffer, PPTX_MIME, garbagePreExtracted)
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.file.status, 'PROCESSED');
    assert.match(body.file.extractedSummary, /Profil Perusahaan PT Makan Mania Mantap/, 'untuk .pptx, server HARUS tetap ekstraksi ulang dari buffer asli (T3-05), bukan pakai preExtractedContent');
    assert.doesNotMatch(body.file.extractedSummary, /TEKS SAMPAH DARI CLIENT/);
  });
});
