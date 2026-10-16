import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// KELOMPOK 4 wiring regression tests (2026-09-07, roadmap anti-halusinasi
// 2026-09-06-roadmap-analisis-data-enterprise-anti-halusinasi.md) untuk:
//   src/app/api/v1/documents/extract-text/route.ts
//
// Sebelum wiring ini, /documents/extract-text (endpoint yang BENERAN dipanggil
// Executive/Finance/Marketing AI Assistant, lihat komentar KELOMPOK 4 di route
// itu) cuma menempel jadi "blind flattener" teks -- parser ledger deterministik
// (parseLedgerWorkbook + validateLedger) yang sudah teruji ke 583 transaksi
// asli TIDAK PERNAH jalan di jalur ini. Audit menemukan NOL berkas uji yang
// menyentuh endpoint ini sama sekali -- berkas ini mengisi kekosongan itu.
//
// Same in-memory-Prisma-Proxy + real-signed-JWT pattern seperti
// tests/ledger-wiring.test.ts (dipakai lagi di sini karena endpoint ini kini
// dibungkus withTenantGuard oleh agent lain di sesi paralel yang sama -- lihat
// komentar "Guard tenant dikembalikan" di route.ts). TIDAK perlu
// --experimental-test-module-mocks (tidak ada mock.module di berkas ini,
// hanya penggantian globalThis.prisma) tapi flag itu aman dibiarkan ikut di
// perintah test suite penuh.
//
// Fixture: workbook SINTETIS in-memory (sama teknik dengan
// tests/ledger-parser.test.ts / tests/ledger-wiring.test.ts), BUKAN data
// klien asli -- privasi per context pack ATURAN MUTLAK.
// ---------------------------------------------------------------------------

/**
 * Minimal ledger workbook: "kode posting" (chart of accounts) + "buku kas"
 * (5 baris transaksi valid + 1 baris footer JUMLAH tanpa TARIKH yang harus
 * dilewati). Sama persis dengan builder di tests/ledger-wiring.test.ts supaya
 * angka hasil (jumlahTransaksi=5, saldoAkhir=1700000, dst) sudah diverifikasi
 * silang lewat test suite lain yang sudah ada (ledger-parser.test.ts,
 * ledger-wiring.test.ts) -- test ini fokus ke WIRING-nya, bukan re-verifikasi
 * matematika parser yang sudah dites di tempat lain.
 */
function buildSyntheticLedgerWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  const kodePostingRows: unknown[][] = [
    ['Contoh Usaha Sintetis'],
    ['KODE ETIK PEMBUKUAN'],
    [],
    [null, 25, 'Penjualan Barang Umum', null, null, null, null, null, 60, 'Sewa Kantor'],
    [null, 26, 'Penjualan Jasa', null, null, null, null, null, 61, 'Konsumsi'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kodePostingRows), 'kode posting');

  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  const bukuKasRows: unknown[][] = [
    ['BUKU KAS'],
    [],
    [],
    [],
    [],
    [],
    ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
    [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
    [2, d(2024, 1, 1), 'Modal awal', 10, 1000000, null, 1000000],
    [3, d(2024, 1, 2), 'Penjualan Barang Umum', 25, 500000, null, 1500000],
    [4, d(2024, 1, 3), 'Bayar Sewa Kantor', 60, null, 100000, 1400000],
    [5, d(2024, 1, 4), 'Penjualan Jasa', 26, 300000, null, 1700000],
    // baris footer JUMLAH -- TIDAK punya TARIKH, harus dilewati parser.
    [null, null, null, null, 1800000, 100000, null],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bukuKasRows), 'buku kas');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Xlsx biasa (bukan ledger): tidak punya "kode posting" atau sheet "kas" apapun --
 *  jalur lama extractTextFromBuffer() harus tetap jalan APA ADANYA, tanpa field baru. */
function buildNonLedgerXlsxWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  const rows: unknown[][] = [
    ['Catatan Rapat Mingguan'],
    ['Agenda', 'Pembahasan strategi marketing kuartal ini'],
    ['Tindak lanjut', 'Follow-up ke tim sales minggu depan'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Notulen');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function multipartFileRequest(url: string, token: string, fileName: string, buffer: Buffer, mimeType: string) {
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
  return new NextRequest(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('KELOMPOK 4 wiring: documents/extract-text ledger parser + blok ANGKA TERVERIFIKASI', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let extractTextPOST: typeof import('../src/app/api/v1/documents/extract-text/route')['POST'];

  type Query = { where?: { id?: string; ownerId?: string }; select?: unknown; include?: unknown };
  type DbCall = { method: string; query: Query };
  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let reads: DbCall[] = [];
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let handlers: Record<string, (query: Query) => unknown>;

  const fakePrisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      if (model.startsWith('$')) return async () => { throw new Error(`Forbidden Prisma operation: ${model}`); };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: Query) => {
            const method = `${model}.${operation}`;
            const handler = handlers[method];
            if (!handler) throw new Error(`Forbidden Prisma operation: ${method}`);
            reads.push({ method, query });
            return handler(query);
          };
        },
      });
    },
  });

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'extract-text-ledger-wiring-tests-only-secret-9d2b6a-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: extractTextPOST } = await import('../src/app/api/v1/documents/extract-text/route'));
  });

  beforeEach(() => {
    reads = [];
    users = new Map();
    workspaces = new Map();
    handlers = {};
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedUser(id: string) {
    const user = { id, email: `${id}@example.invalid`, fullName: `Test ${id}`, isSuperAdmin: false };
    users.set(id, user);
    handlers['user.findUnique'] = (query) => users.get(query.where?.id ?? '') ?? null;
    return user;
  }

  function seedWorkspace(ws: WorkspaceFixture) {
    workspaces.set(ws.id, ws);
    handlers['workspace.findUnique'] = (query) => {
      const found = workspaces.get(query.where?.id ?? '');
      if (!found) return null;
      return { id: found.id, name: found.name, slug: found.slug, ownerId: found.ownerId, members: found.members, resourceGrants: found.resourceGrants };
    };
  }

  test('xlsx ledger dikenali -> content diawali blok ANGKA TERVERIFIKASI, isi dokumen asli tetap ikut, field structuredLedger/discrepancies ada', async () => {
    seedUser('user-extract-1');
    seedWorkspace({ id: 'ws-extract-1', name: 'Toko Extract 1', slug: 'toko-extract-1', ownerId: 'user-extract-1', members: [], resourceGrants: [] });
    const token = signJwtToken({ userId: 'user-extract-1', workspaceId: 'ws-extract-1' });

    const buffer = buildSyntheticLedgerWorkbook();
    const response = await extractTextPOST(
      multipartFileRequest('https://klir.test/api/v1/documents/extract-text', token, 'PT-Sintetis.xlsx', buffer, XLSX_MIME)
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);

    // Blok ANGKA TERVERIFIKASI harus ada dan berada di AWAL content (bukan di
    // tengah/akhir) -- supaya kalau kepotong MAX_CHARS, blok ini yang selamat.
    assert.match(body.content, /^===== ANGKA TERVERIFIKASI/);
    assert.match(body.content, /DILARANG KERAS/);
    assert.match(body.content, /JANGAN dihitung ulang|menghitung ulang/);
    assert.match(body.content, /DISKREPANSI YANG DITEMUKAN SISTEM/);
    assert.match(body.content, /AKHIR BLOK ANGKA TERVERIFIKASI -- ISI DOKUMEN ASLI DI BAWAH INI/);

    // Angka konkret dari parser deterministik harus muncul persis (bukan cuma
    // judul blok yang kebetulan match).
    assert.match(body.content, /Saldo Akhir: Rp 1\.700\.000/);

    // Isi dokumen ASLI (hasil extractTextFromBuffer lama, tabel ExcelJS) tetap
    // ikut di BAWAH blok verifikasi -- jalur lama tidak dihapus/diganti.
    assert.match(body.content, /Lembar Kerja \(Sheet\): buku kas/);
    assert.match(body.content, /Penjualan Barang Umum/);

    // Field TAMBAHAN.
    assert.ok(body.structuredLedger, 'field structuredLedger harus ada untuk workbook ledger yang dikenali');
    assert.equal(body.structuredLedger.jumlahTransaksi, 5, 'Saldo Awal + 4 transaksi = 5 baris valid (baris footer JUMLAH tanpa TARIKH dilewati)');
    assert.equal(body.structuredLedger.saldoAkhir, 1700000);
    assert.equal(body.structuredLedger.periode.mulai, '2024-01-01');
    assert.equal(body.structuredLedger.periode.akhir, '2024-01-04');
    const kode25 = body.structuredLedger.totalPerKode.find((k: any) => k.kode === 25);
    assert.ok(kode25, 'rincian per kode harus memuat kode 25');
    assert.equal(kode25.namaAkun, 'Penjualan Barang Umum');
    assert.equal(kode25.debit, 500000);

    assert.ok(body.discrepancies, 'field discrepancies (DiscrepancyReport) harus ada');
    assert.ok(Array.isArray(body.discrepancies.discrepancies));
    assert.ok(Array.isArray(body.discrepancies.reconciled));

    // totalChars/truncated harus dihitung dari content YANG SUDAH DISISIPI blok
    // (bukan dari trimmed lama) -- fixture ini jauh di bawah MAX_CHARS (32000),
    // jadi truncated harus false dan totalChars harus persis panjang content.
    assert.equal(body.truncated, false);
    assert.equal(body.totalChars, body.content.length);
  });

  test('xlsx BUKAN ledger (tanpa kode posting/kas) -> content sama persis seperti sebelum wiring ini, tanpa field baru', async () => {
    seedUser('user-extract-2');
    seedWorkspace({ id: 'ws-extract-2', name: 'Toko Extract 2', slug: 'toko-extract-2', ownerId: 'user-extract-2', members: [], resourceGrants: [] });
    const token = signJwtToken({ userId: 'user-extract-2', workspaceId: 'ws-extract-2' });

    const buffer = buildNonLedgerXlsxWorkbook();
    const response = await extractTextPOST(
      multipartFileRequest('https://klir.test/api/v1/documents/extract-text', token, 'notulen-rapat.xlsx', buffer, XLSX_MIME)
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);

    // Blok verifikasi TIDAK BOLEH muncul sama sekali untuk file non-ledger.
    assert.doesNotMatch(body.content, /ANGKA TERVERIFIKASI/);
    assert.equal('structuredLedger' in body, false, 'file non-ledger tidak boleh menambahkan field structuredLedger sama sekali');
    assert.equal('discrepancies' in body, false, 'file non-ledger tidak boleh menambahkan field discrepancies sama sekali');

    // Jalur ekstraksi teks lama (ExcelJS) tetap jalan apa adanya.
    assert.match(body.content, /Lembar Kerja \(Sheet\): Notulen/);
    assert.match(body.content, /Catatan Rapat Mingguan/);
    assert.equal(body.totalChars, body.content.length);
    assert.equal(body.truncated, false);
  });

  test('request tanpa file -> tetap 400 seperti sebelum wiring ini (guard sudah lolos, validasi form-data lama tidak berubah)', async () => {
    seedUser('user-extract-3');
    seedWorkspace({ id: 'ws-extract-3', name: 'Toko Extract 3', slug: 'toko-extract-3', ownerId: 'user-extract-3', members: [], resourceGrants: [] });
    const token = signJwtToken({ userId: 'user-extract-3', workspaceId: 'ws-extract-3' });

    const formData = new FormData();
    const req = new NextRequest('https://klir.test/api/v1/documents/extract-text', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const response = await extractTextPOST(req);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
  });
});
