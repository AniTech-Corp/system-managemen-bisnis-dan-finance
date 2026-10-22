import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// FASE BUILD 7 Sep 2026 -- regression tests untuk fix integrasi-02 (KRITIS: tidak
// ada jalur tulis dari upload dokumen ke prisma.cashTransaction) + integrasi-04
// (SEDANG: WorkspaceFile.linkedRecordIds ada di schema tapi tidak pernah ditulis).
//
// src/app/api/v1/workspace-files/[id]/import-ledger/route.ts
//
// Bukti gap SEBELUM fix (lihat laporan agent integrasi-02): grep
// 'cashTransaction.create' di seluruh src/ -- NOL hasil dari jalur upload dokumen
// manapun. Test di bawah membuktikan endpoint baru ini genuinely menulis baris
// CashTransaction dari isi buku kas yang diparse, dan mengisi linkedRecordIds.
//
// Pola: in-memory fake Prisma proxy (termasuk $transaction bentuk-array) + JWT
// asli, sama filosofi dengan tests/extract-text-ledger-wiring.test.ts. Jalankan
// dengan `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

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
    // Saldo Awal: debit=0, credit=null -- amount=0, HARUS dilewati saat impor
    // (endpoint /api/v1/kas/transactions menolak amount<=0).
    [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
    [2, d(2024, 1, 1), 'Modal awal', 10, 1000000, null, 1000000],
    [3, d(2024, 1, 2), 'Penjualan Barang Umum', 25, 500000, null, 1500000],
    [4, d(2024, 1, 3), 'Bayar Sewa Kantor', 60, null, 100000, 1400000],
    [5, d(2024, 1, 4), 'Penjualan Jasa', 26, 300000, null, 1700000],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bukuKasRows), 'buku kas');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function buildNonLedgerXlsx(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Bukan buku kas'], ['Cuma catatan biasa']]), 'Notulen');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// FASE B4 (7 Sep 2026 malam) -- fixture BUKAN ledger klasik (tidak ada "kode posting"),
// tapi punya kolom tanggal+jumlah+keterangan generik yang HARUS terdeteksi lewat jalur
// KEDUA (heuristik kolom, lihat generic-table-ledger.ts). Dipakai untuk menguji
// genericMapping di GET dan alur confirm+mappingHash di POST.
function buildGenericTableXlsx(): Buffer {
  const wb = XLSX.utils.book_new();
  const rows: unknown[][] = [
    ['Tanggal', 'Keterangan', 'Jumlah'],
    ['2026-08-01', 'Penjualan A', 500000],
    ['2026-08-02', 'Penjualan B', 300000],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Transaksi');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function jsonRequest(url: string, token: string, method: 'GET' | 'POST') {
  return new NextRequest(url, { method, headers: { Authorization: `Bearer ${token}` } });
}

function jsonRequestWithBody(url: string, token: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Fix integrasi-02/integrasi-04: workspace-files/[id]/import-ledger', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let importLedgerGET: typeof import('../src/app/api/v1/workspace-files/[id]/import-ledger/route')['GET'];
  let importLedgerPOST: typeof import('../src/app/api/v1/workspace-files/[id]/import-ledger/route')['POST'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let workspaceFiles: Map<string, any>;
  let cashTransactions: Map<string, any>;
  let cashTxSeq: number;

  const fakePrisma = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'then') return undefined;
      if (prop === '$transaction') {
        return async (arg: any) => {
          if (Array.isArray(arg)) return Promise.all(arg);
          if (typeof arg === 'function') return arg(fakePrisma);
          throw new Error('Unsupported $transaction arg shape in test fixture');
        };
      }
      if (prop.startsWith('$')) return async () => { throw new Error(`Forbidden Prisma operation: ${prop}`); };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: any) => {
            const method = `${prop}.${operation}`;
            if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
            if (method === 'workspace.findUnique') {
              const found = workspaces.get(query.where?.id ?? '');
              return found
                ? { id: found.id, name: found.name, slug: found.slug, ownerId: found.ownerId, members: found.members, resourceGrants: found.resourceGrants }
                : null;
            }
            if (method === 'workspaceFile.findFirst') {
              const record = workspaceFiles.get(query.where?.id ?? '');
              if (!record || record.workspaceId !== query.where?.workspaceId) return null;
              return record;
            }
            if (method === 'workspaceFile.update') {
              const existing = workspaceFiles.get(query.where.id);
              const updated = { ...existing, ...query.data };
              workspaceFiles.set(query.where.id, updated);
              return updated;
            }
            // Klaim atomik anti-dobel (7 Sep malam): tiru semantik Postgres untuk filter
            // scalar-list `isEmpty` / `equals` -- hanya baris yang cocok yang diubah.
            if (method === 'workspaceFile.updateMany') {
              const existing = workspaceFiles.get(query.where?.id ?? '');
              if (!existing) return { count: 0 };
              if (query.where?.workspaceId && existing.workspaceId !== query.where.workspaceId) return { count: 0 };
              const filter = query.where?.linkedRecordIds;
              if (filter?.isEmpty === true && existing.linkedRecordIds.length > 0) return { count: 0 };
              if (filter?.equals && JSON.stringify(filter.equals) !== JSON.stringify(existing.linkedRecordIds)) return { count: 0 };
              workspaceFiles.set(existing.id, { ...existing, ...query.data });
              return { count: 1 };
            }
            if (method === 'cashTransaction.create') {
              cashTxSeq += 1;
              const id = `tx-${cashTxSeq}`;
              const record = { id, ...query.data };
              cashTransactions.set(id, record);
              return record;
            }
            if (method === 'cashTransaction.createManyAndReturn') {
              const rows = Array.isArray(query.data) ? query.data : [query.data];
              return rows.map((item: any) => {
                cashTxSeq += 1;
                const id = `tx-${cashTxSeq}`;
                const record = { id, ...item };
                cashTransactions.set(id, record);
                return record;
              });
            }
            if (method === 'accountingSetting.findUnique') {
              return null;
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
    process.env.JWT_SECRET = 'workspace-files-import-ledger-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: importLedgerGET, POST: importLedgerPOST } = await import('../src/app/api/v1/workspace-files/[id]/import-ledger/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    workspaceFiles = new Map();
    cashTransactions = new Map();
    cashTxSeq = 0;
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedTenantWithFile(idSuffix: string, fileBuffer: Buffer, fileName: string) {
    const userId = `user-${idSuffix}`;
    const wsId = `ws-${idSuffix}`;
    const fileId = `wf-${idSuffix}`;
    users.set(userId, { id: userId, email: `${userId}@example.invalid`, fullName: `Test ${userId}`, isSuperAdmin: false });
    workspaces.set(wsId, { id: wsId, name: `Toko ${idSuffix}`, slug: `toko-${idSuffix}`, ownerId: userId, members: [], resourceGrants: [] });
    workspaceFiles.set(fileId, {
      id: fileId, workspaceId: wsId, fileName, fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      storageBlob: fileBuffer, linkedRecordIds: [], status: 'PROCESSED',
    });
    const token = signJwtToken({ userId, workspaceId: wsId });
    return { token, fileId, wsId };
  }

  async function callWithParams(
    handler: (req: NextRequest, ctx: any) => Promise<Response>,
    req: NextRequest,
    id: string
  ) {
    return handler(req, { params: Promise.resolve({ id }) });
  }

  test('GET preview: xlsx ledger dikenali -> recognized true, angka & jumlah transaksi importable benar (Saldo Awal dilewati)', async () => {
    const { token, fileId } = seedTenantWithFile('preview-ok', buildSyntheticLedgerWorkbook(), 'PT-Sintetis.xlsx');
    const req = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'GET');
    const res = await callWithParams(importLedgerGET as any, req, fileId);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.recognized, true);
    assert.equal(body.alreadyImported, false);
    assert.equal(body.structuredLedger.jumlahTransaksi, 5, 'parser tetap menghitung 5 baris valid (termasuk Saldo Awal)');
    assert.equal(body.importableTransactionCount, 4, 'Saldo Awal (amount 0) TIDAK ikut diimpor -- hanya 4 baris bernilai');
    assert.equal(body.totalIncome, 1000000 + 500000 + 300000);
    assert.equal(body.totalExpense, 100000);
  });

  test('GET preview: xlsx BUKAN ledger -> recognized false dengan pesan jujur (integrasi-03)', async () => {
    const { token, fileId } = seedTenantWithFile('preview-notrecognized', buildNonLedgerXlsx(), 'notulen.xlsx');
    const req = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'GET');
    const res = await callWithParams(importLedgerGET as any, req, fileId);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.recognized, false);
    assert.match(body.message, /tidak dikenali sebagai buku kas/);
  });

  test('POST import: menulis 4 CashTransaction (2 INCOME dari debit, 1 EXPENSE dari kredit, total 3 INCOME + 1 EXPENSE) + mengisi linkedRecordIds', async () => {
    const { token, fileId, wsId } = seedTenantWithFile('import-ok', buildSyntheticLedgerWorkbook(), 'PT-Sintetis.xlsx');
    const req = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'POST');
    const res = await callWithParams(importLedgerPOST as any, req, fileId);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.importedCount, 4);
    assert.equal(body.linkedRecordIds.length, 4);

    // Verifikasi baris CashTransaction genuinely tertulis ke "database" (fake prisma).
    assert.equal(cashTransactions.size, 4);
    const rows = Array.from(cashTransactions.values());
    assert.ok(rows.every((r) => r.workspaceId === wsId));
    const incomeRows = rows.filter((r) => r.type === 'INCOME');
    const expenseRows = rows.filter((r) => r.type === 'EXPENSE');
    assert.equal(incomeRows.length, 3, 'Modal awal + Penjualan Barang Umum + Penjualan Jasa = 3 INCOME (dari kolom DEBET)');
    assert.equal(expenseRows.length, 1, 'Bayar Sewa Kantor = 1 EXPENSE (dari kolom KREDIT)');
    assert.equal(incomeRows.reduce((s, r) => s + r.amount, 0), 1800000);
    assert.equal(expenseRows[0].amount, 100000);
    assert.ok(incomeRows.some((r) => r.category === 'Penjualan Barang Umum'), 'kategori diambil dari chart-of-accounts (kode 25)');

    // integrasi-04: WorkspaceFile.linkedRecordIds sekarang benar-benar terisi.
    const updatedFile = workspaceFiles.get(fileId);
    assert.equal(updatedFile.linkedRecordIds.length, 4);
    assert.deepEqual(updatedFile.linkedRecordIds.sort(), body.linkedRecordIds.sort());
  });

  test('POST import dua kali -> percobaan kedua ditolak 409 (anti dobel-hitung)', async () => {
    const { token, fileId } = seedTenantWithFile('import-twice', buildSyntheticLedgerWorkbook(), 'PT-Sintetis.xlsx');
    const req1 = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'POST');
    const res1 = await callWithParams(importLedgerPOST as any, req1, fileId);
    assert.equal(res1.status, 200);

    const req2 = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'POST');
    const res2 = await callWithParams(importLedgerPOST as any, req2, fileId);
    assert.equal(res2.status, 409);
    const body2 = await res2.json();
    assert.match(body2.message, /sudah pernah diimpor/);
    // Tidak ada transaksi TAMBAHAN yang tertulis dari percobaan kedua.
    assert.equal(cashTransactions.size, 4);
  });

  test('POST import file yang tidak dikenali sebagai ledger -> 422, tidak menulis apapun', async () => {
    const { token, fileId } = seedTenantWithFile('import-notrecognized', buildNonLedgerXlsx(), 'notulen.xlsx');
    const req = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'POST');
    const res = await callWithParams(importLedgerPOST as any, req, fileId);
    assert.equal(res.status, 422);
    assert.equal(cashTransactions.size, 0);
  });

  test('GET/POST file dari workspace lain -> 404 (isolasi tenant)', async () => {
    const { fileId } = seedTenantWithFile('victim', buildSyntheticLedgerWorkbook(), 'PT-Sintetis.xlsx');
    // Attacker: user/workspace BEDA, mencoba akses fileId milik "victim" di atas.
    const attackerUserId = 'user-attacker';
    const attackerWsId = 'ws-attacker';
    users.set(attackerUserId, { id: attackerUserId, email: 'attacker@example.invalid', fullName: 'Attacker', isSuperAdmin: false });
    workspaces.set(attackerWsId, { id: attackerWsId, name: 'Attacker Co', slug: 'attacker-co', ownerId: attackerUserId, members: [], resourceGrants: [] });
    const attackerToken = signJwtToken({ userId: attackerUserId, workspaceId: attackerWsId });

    const req = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, attackerToken, 'GET');
    const res = await callWithParams(importLedgerGET as any, req, fileId);
    assert.equal(res.status, 404);
  });

  // -------------------------------------------------------------------------
  // FASE B4 (7 Sep 2026 malam) -- jalur KEDUA (heuristik kolom generik), dipakai
  // HANYA setelah jalur klasik (chart-of-accounts) gagal mengenali file. Kasus
  // existing di atas (chart-of-accounts recognized) TIDAK disentuh/diubah sama sekali.
  // -------------------------------------------------------------------------

  test('GET preview: xlsx BUKAN ledger klasik tapi punya kolom generik -> genericMapping terisi + mappingHash', async () => {
    const { token, fileId } = seedTenantWithFile('generic-preview', buildGenericTableXlsx(), 'transaksi-generik.xlsx');
    const req = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'GET');
    const res = await callWithParams(importLedgerGET as any, req, fileId);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.recognized, false, '"recognized" tetap berarti "bukan ledger klasik" -- TIDAK berubah bentuk (backward compatible)');
    assert.ok(body.genericMapping, 'genericMapping harus ada untuk file yang cocok heuristik kolom');
    assert.ok(body.genericMapping.confidence > 0);
    assert.equal(typeof body.genericMapping.mappingHash, 'string');
    assert.equal(body.genericMapping.importableTransactionCount, 2);
    assert.equal(body.genericMapping.totalIncome, 800000);
  });

  test('POST generik tanpa confirm -> 400, tidak menulis apapun', async () => {
    const { token, fileId } = seedTenantWithFile('generic-noconfirm', buildGenericTableXlsx(), 'transaksi-generik.xlsx');
    const req = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'POST');
    const res = await callWithParams(importLedgerPOST as any, req, fileId);
    assert.equal(res.status, 400);
    assert.equal(cashTransactions.size, 0);
  });

  test('POST generik dengan mappingHash SALAH -> 409, tidak menulis apapun', async () => {
    const { token, fileId } = seedTenantWithFile('generic-badhash', buildGenericTableXlsx(), 'transaksi-generik.xlsx');
    const req = jsonRequestWithBody(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, {
      confirm: true,
      mappingHash: 'hash-palsu-atau-basi',
    });
    const res = await callWithParams(importLedgerPOST as any, req, fileId);
    assert.equal(res.status, 409);
    assert.equal(cashTransactions.size, 0);
  });

  test('POST generik dengan confirm+mappingHash BENAR (dari GET) -> menulis CashTransaction + linkedRecordIds', async () => {
    const { token, fileId, wsId } = seedTenantWithFile('generic-ok', buildGenericTableXlsx(), 'transaksi-generik.xlsx');

    const getReq = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'GET');
    const getRes = await callWithParams(importLedgerGET as any, getReq, fileId);
    const preview = await getRes.json();
    assert.ok(preview.genericMapping?.mappingHash);

    const postReq = jsonRequestWithBody(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, {
      confirm: true,
      mappingHash: preview.genericMapping.mappingHash,
    });
    const postRes = await callWithParams(importLedgerPOST as any, postReq, fileId);
    assert.equal(postRes.status, 200);
    const body = await postRes.json();
    assert.equal(body.success, true);
    assert.equal(body.importedCount, 2);

    assert.equal(cashTransactions.size, 2);
    const rows = Array.from(cashTransactions.values());
    assert.ok(rows.every((r) => r.workspaceId === wsId));
    assert.ok(rows.every((r) => r.type === 'INCOME'));
    assert.equal(rows.reduce((s, r) => s + r.amount, 0), 800000);

    const updatedFile = workspaceFiles.get(fileId);
    assert.equal(updatedFile.linkedRecordIds.length, 2);
  });

  test('POST generik dua kali (impor ulang) -> percobaan kedua ditolak 409 anti-dobel (sama seperti jalur klasik)', async () => {
    const { token, fileId } = seedTenantWithFile('generic-twice', buildGenericTableXlsx(), 'transaksi-generik.xlsx');

    const getReq = jsonRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, 'GET');
    const getRes = await callWithParams(importLedgerGET as any, getReq, fileId);
    const preview = await getRes.json();

    const postReq1 = jsonRequestWithBody(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, {
      confirm: true,
      mappingHash: preview.genericMapping.mappingHash,
    });
    const postRes1 = await callWithParams(importLedgerPOST as any, postReq1, fileId);
    assert.equal(postRes1.status, 200);

    const postReq2 = jsonRequestWithBody(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, token, {
      confirm: true,
      mappingHash: preview.genericMapping.mappingHash,
    });
    const postRes2 = await callWithParams(importLedgerPOST as any, postReq2, fileId);
    assert.equal(postRes2.status, 409);
    assert.equal(cashTransactions.size, 2, 'tidak ada transaksi tambahan dari percobaan kedua');
  });
});
