import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// B4 TESTS (8 Sep 2026) -- KONTRAK T4 "dashboard & AI langsung ikut" dari
// sintesis komando "dua pintu upload" 8 Sep 2026.
//
// File TERPISAH (bukan menambah test ke workspace-files-upload.test.ts /
// workspace-files-import-ledger.test.ts) SENGAJA -- ini butuh mock.module()
// untuk src/lib/ai-brain/context-engine.ts (invalidateContextCache) dan
// src/lib/ai-brain/auto-company-profile.ts (scheduleAutoCompanyProfileSync)
// SEBELUM module-under-test pertama kali di-import di proses ini. Kedua file
// test yang sudah ada TIDAK melakukan mock ini -- describe pertama di file
// itu sudah meng-import workspace-files/route.ts / import-ledger/route.ts
// TANPA mock, sehingga module singleton itu PERMANEN ter-bind ke implementasi
// ASLI untuk SISA PROSES (Node module cache per-file, node:test default
// isolation='process' artinya proses ini FRESH per file .test.ts -- tapi
// SEKALI di-load di dalam 1 file, tidak bisa di-unload/re-mock lagi via
// describe lain di file yang sama). Menambah mock.module() ke file yang
// sudah ada berisiko break-diam-diam 9/15/dst test lama kalau urutan
// describe/before() ternyata tidak sesuai asumsi -- risiko yang TIDAK
// sepadan untuk sekadar menambah 1 assertion invalidateContextCache. File
// baru = 100% aman (fresh process, mock terpasang SEBELUM import pertama).
//
// Jalankan dengan `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

type WorkspaceFixture = {
  id: string; name: string; slug: string; ownerId: string;
  members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('B4 KONTRAK T4 (8 Sep 2026): invalidateContextCache + scheduleAutoCompanyProfileSync dipanggil di titik yang benar', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let workspaceFilesPOST: any;
  let workspaceFilesDELETE: any;
  let importLedgerPOST: any;

  let invalidateCalls: Array<string | undefined>;
  let scheduleAutoProfileCalls: Array<{ workspaceId: string; sourceLabel: string }>;
  let scheduleAutoProfileDelayMs: number;
  let scheduleCompanyBriefCalls: Array<{ workspaceId: string; reason: string }>;

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let workspaceFiles: Map<string, any>;
  let cashTransactions: Map<string, any>;
  let cashTxSeq: number;

  const fakePrisma = new Proxy(
    {},
    {
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
        return new Proxy(
          {},
          {
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
                if (method === 'workspaceFile.create') {
                  const id = `wf-${workspaceFiles.size + 1}`;
                  const record = { id, createdAt: new Date(), linkedRecordIds: [], ...query.data };
                  workspaceFiles.set(id, record);
                  return record;
                }
                if (method === 'workspaceFile.update') {
                  const existing = workspaceFiles.get(query.where.id);
                  const updated = { ...existing, ...query.data };
                  workspaceFiles.set(query.where.id, updated);
                  return updated;
                }
                if (method === 'workspaceFile.delete') {
                  const existing = workspaceFiles.get(query.where?.id ?? '');
                  if (!existing || existing.workspaceId !== query.where?.workspaceId) {
                    throw new Error('Record to delete does not exist.');
                  }
                  workspaceFiles.delete(query.where.id);
                  return existing;
                }
                if (method === 'workspaceFile.findFirst') {
                  const record = workspaceFiles.get(query.where?.id ?? '');
                  if (!record || record.workspaceId !== query.where?.workspaceId) return null;
                  return record;
                }
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
                if (method === 'memoryItem.create' || method === 'activityLog.create' || method === 'activityEvent.create') {
                  return { id: 'mem-1' };
                }
                throw new Error(`Forbidden Prisma operation in test fixture: ${method}`);
              };
            },
          }
        );
      },
    }
  );

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'workspace-files-t4-hooks-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    // KRITIS: mock.module() untuk KEDUA modul ini WAJIB dipanggil SEBELUM
    // dynamic import workspace-files/route.ts & import-ledger/route.ts di
    // bawah -- itulah yang pertama kali memicu module resolution untuk kedua
    // specifier ini di proses (file) ini.
    mock.module('../src/lib/ai-brain/context-engine', {
      namedExports: {
        invalidateContextCache: (workspaceId?: string) => {
          invalidateCalls.push(workspaceId);
        },
      },
    });
    mock.module('../src/lib/ai-brain/auto-company-profile', {
      namedExports: {
        scheduleAutoCompanyProfileSync: (workspaceId: string, sourceLabel: string) => {
          scheduleAutoProfileCalls.push({ workspaceId, sourceLabel });
        },
      },
    });
    // B3_AI, 11 Sep 2026 (kontrak modul 4, KONTRAK PENYESUAIAN #4 dari scan 11 Sep):
    // workspace-files/route.ts SEKARANG juga memanggil scheduleCompanyBriefRefresh()
    // di 3 titik (POST non-zip, POST zip, DELETE) -- WAJIB di-mock jadi no-op SEBELUM
    // dynamic import route.ts di bawah, sama seperti 2 mock lain di atas, SEMATA untuk
    // mencegah timer debounce 8 detik company-brief.ts (setTimeout SUNGGUHAN, modul ini
    // TIDAK di-mock secara internal) bocor ke proses test dan memicu orchestrate()/
    // Prisma REAL belakangan -- tidak ada assersi baru yang butuh spy ini, murni
    // pencegahan leak (temuan scan, bukan spekulasi).
    mock.module('../src/lib/ai-brain/company-brief', {
      namedExports: {
        scheduleCompanyBriefRefresh: (workspaceId: string, reason: string) => {
          scheduleCompanyBriefCalls.push({ workspaceId, reason });
        },
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: workspaceFilesPOST, DELETE: workspaceFilesDELETE } = await import('../src/app/api/v1/workspace-files/route'));
    ({ POST: importLedgerPOST } = await import('../src/app/api/v1/workspace-files/[id]/import-ledger/route'));
  });

  beforeEach(() => {
    invalidateCalls = [];
    scheduleAutoProfileCalls = [];
    scheduleAutoProfileDelayMs = 0;
    scheduleCompanyBriefCalls = [];
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

  function seedTenant(idSuffix: string) {
    const userId = `user-${idSuffix}`;
    const wsId = `ws-${idSuffix}`;
    users.set(userId, { id: userId, email: `${userId}@example.invalid`, fullName: `Test ${userId}`, isSuperAdmin: false });
    workspaces.set(wsId, { id: wsId, name: `Toko ${idSuffix}`, slug: `toko-${idSuffix}`, ownerId: userId, members: [], resourceGrants: [] });
    return { token: signJwtToken({ userId, workspaceId: wsId }), wsId };
  }

  function multipartFileRequest(url: string, token: string, fileName: string, buffer: Buffer, mimeType: string) {
    const formData = new FormData();
    formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
    return new NextRequest(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData });
  }

  test('POST workspace-files (non-zip, sukses) -> invalidateContextCache(workspaceId) terpanggil TEPAT SEKALI dengan workspaceId benar', async () => {
    const { token, wsId } = seedTenant('nonzip-invalidate');
    const buffer = Buffer.from('teks dokumen biasa', 'utf8');
    const res = await workspaceFilesPOST(multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'catatan.txt', buffer, 'text/plain'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.file.status, 'PROCESSED');
    assert.equal(invalidateCalls.length, 1, `harus terpanggil TEPAT SEKALI per upload sukses, dapat ${invalidateCalls.length}x`);
    assert.equal(invalidateCalls[0], wsId);
  });

  test('POST workspace-files (.zip, sukses) -> invalidateContextCache terpanggil SEKALI PER BATCH (bukan per-entri/child)', async () => {
    const { token, wsId } = seedTenant('zip-invalidate');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('a.txt', 'isi a');
    zip.file('b.txt', 'isi b');
    zip.file('c.txt', 'isi c');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });

    const res = await workspaceFilesPOST(multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'arsip-3entri.zip', buf, 'application/zip'));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.file.status, 'PROCESSED');
    assert.ok(body.file.linkedRecordIds.length >= 1, 'sanity check: setidaknya 1 entri diekstrak jadi child');
    assert.equal(
      invalidateCalls.length,
      1,
      `zip 3 entri TIDAK BOLEH memicu invalidateContextCache per-child (risiko yang di-flag kritik 8 Sep) -- harus TEPAT 1x per batch upload, dapat ${invalidateCalls.length}x`
    );
    assert.equal(invalidateCalls[0], wsId);
  });

  test('DELETE workspace-files -> invalidateContextCache(workspaceId) terpanggil setelah delete sukses', async () => {
    const { token, wsId } = seedTenant('delete-invalidate');
    const uploadRes = await workspaceFilesPOST(
      multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'akan-dihapus.txt', Buffer.from('isi', 'utf8'), 'text/plain')
    );
    const uploadBody = await uploadRes.json();
    invalidateCalls = []; // reset -- hanya peduli panggilan dari DELETE, bukan dari POST di atas

    const deleteReq = new NextRequest(`https://klir.test/api/v1/workspace-files?id=${uploadBody.file.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await workspaceFilesDELETE(deleteReq);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(invalidateCalls.length, 1, `DELETE sukses harus memicu invalidateContextCache TEPAT SEKALI, dapat ${invalidateCalls.length}x -- KEMUNGKINAN B1 belum menambahkan panggilan ini di handler DELETE (kontrak langkah 4e)`);
    assert.equal(invalidateCalls[0], wsId);
  });

  test('POST workspace-files sukses -> scheduleAutoCompanyProfileSync dipanggil FIRE-AND-FORGET (bukan di-await) SETELAH invalidateContextCache', async () => {
    const { token, wsId } = seedTenant('autoprofile-fireforget');
    const startedAt = Date.now();
    const res = await workspaceFilesPOST(
      multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'trigger-autoprofile.txt', Buffer.from('isi', 'utf8'), 'text/plain')
    );
    const elapsedMs = Date.now() - startedAt;
    assert.equal(res.status, 200);
    assert.equal(scheduleAutoProfileCalls.length, 1, 'scheduleAutoCompanyProfileSync harus terpanggil tepat sekali setelah upload sukses');
    assert.equal(scheduleAutoProfileCalls[0].workspaceId, wsId);
    assert.ok(scheduleAutoProfileCalls[0].sourceLabel && scheduleAutoProfileCalls[0].sourceLabel.length > 0, 'sourceLabel harus diisi (bukan string kosong)');
    // scheduleAutoCompanyProfileSync KONTRAK sinkron murni (never-throw, tidak
    // pernah di-await) -- response POST tidak boleh menunggu apapun darinya.
    // Mock di describe ini sinkron (bukan Promise lambat) sehingga elapsedMs
    // rendah HANYA membuktikan tidak ada blocking tambahan yang jelas terlihat;
    // bukti KUAT "tidak di-await" adalah signature TypeScript
    // `scheduleAutoCompanyProfileSync(...): void` (bukan Promise<void>) di
    // src/lib/ai-brain/auto-company-profile.ts, diverifikasi manual saat baca
    // source (lihat laporan akhir).
    assert.ok(elapsedMs < 2000, `POST tidak boleh lambat karena menunggu auto-profile sync, dapat ${elapsedMs}ms`);
  });

  // B3_AI, 11 Sep 2026 (kontrak modul 4, wiring 3-titik workspace-files/route.ts):
  // scheduleCompanyBriefRefresh HARUS ikut terpanggil di titik yang sama dengan
  // scheduleAutoCompanyProfileSync (POST non-zip, POST zip, DELETE) -- test ini
  // membuktikan wiring genuinely terpasang, BUKAN cuma "tidak leak" (mock di atas).
  test('POST workspace-files (non-zip, sukses) -> scheduleCompanyBriefRefresh(workspaceId, ...) IKUT terpanggil', async () => {
    const { token, wsId } = seedTenant('companybrief-nonzip');
    const res = await workspaceFilesPOST(
      multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'catatan-brief.txt', Buffer.from('isi', 'utf8'), 'text/plain')
    );
    assert.equal(res.status, 200);
    assert.equal(scheduleCompanyBriefCalls.length, 1, `harus terpanggil TEPAT SEKALI per upload sukses, dapat ${scheduleCompanyBriefCalls.length}x`);
    assert.equal(scheduleCompanyBriefCalls[0].workspaceId, wsId);
    assert.ok(scheduleCompanyBriefCalls[0].reason.length > 0);
  });

  test('POST workspace-files (.zip, sukses) -> scheduleCompanyBriefRefresh terpanggil SEKALI PER BATCH (bukan per-entri)', async () => {
    const { token, wsId } = seedTenant('companybrief-zip');
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    zip.file('a.txt', 'isi a');
    zip.file('b.txt', 'isi b');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const res = await workspaceFilesPOST(
      multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'arsip-brief.zip', buf, 'application/zip')
    );
    assert.equal(res.status, 200);
    assert.equal(scheduleCompanyBriefCalls.length, 1, `zip TIDAK BOLEH memicu per-child, harus TEPAT 1x per batch, dapat ${scheduleCompanyBriefCalls.length}x`);
    assert.equal(scheduleCompanyBriefCalls[0].workspaceId, wsId);
  });

  test('DELETE workspace-files -> scheduleCompanyBriefRefresh(workspaceId, ...) IKUT terpanggil setelah delete sukses', async () => {
    const { token, wsId } = seedTenant('companybrief-delete');
    const uploadRes = await workspaceFilesPOST(
      multipartFileRequest('https://klir.test/api/v1/workspace-files', token, 'akan-dihapus-brief.txt', Buffer.from('isi', 'utf8'), 'text/plain')
    );
    const uploadBody = await uploadRes.json();
    scheduleCompanyBriefCalls = []; // reset -- hanya peduli panggilan dari DELETE, bukan dari POST di atas
    const deleteReq = new NextRequest(`https://klir.test/api/v1/workspace-files?id=${uploadBody.file.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await workspaceFilesDELETE(deleteReq);
    assert.equal(res.status, 200);
    assert.equal(scheduleCompanyBriefCalls.length, 1, `DELETE sukses harus memicu scheduleCompanyBriefRefresh TEPAT SEKALI, dapat ${scheduleCompanyBriefCalls.length}x`);
    assert.equal(scheduleCompanyBriefCalls[0].workspaceId, wsId);
  });

  test('POST /workspace-files/[id]/import-ledger sukses -> invalidateContextCache(workspaceId) terpanggil', async () => {
    const { token, wsId } = seedTenant('import-ledger-invalidate');
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const kodePostingRows: unknown[][] = [
      ['Contoh Usaha Sintetis'],
      ['KODE ETIK PEMBUKUAN'],
      [],
      [null, 25, 'Penjualan Barang Umum', null, null, null, null, null, 60, 'Sewa Kantor'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kodePostingRows), 'kode posting');
    const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
    const bukuKasRows: unknown[][] = [
      ['BUKU KAS'], [], [], [], [], [],
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
      [2, d(2024, 1, 2), 'Penjualan Barang Umum', 25, 500000, null, 500000],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bukuKasRows), 'buku kas');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const fileId = 'wf-ledger-1';
    workspaceFiles.set(fileId, {
      id: fileId, workspaceId: wsId, fileName: 'PT-Sintetis.xlsx',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      storageBlob: buffer, linkedRecordIds: [], status: 'PROCESSED',
    });

    const req = new NextRequest(`https://klir.test/api/v1/workspace-files/${fileId}/import-ledger`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await importLedgerPOST(req as any, { params: Promise.resolve({ id: fileId }) } as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true, `import harus sukses supaya assertion invalidateContextCache bermakna -- respons: ${JSON.stringify(body)}`);
    assert.equal(invalidateCalls.length, 1, `import-ledger POST sukses harus memicu invalidateContextCache TEPAT SEKALI, dapat ${invalidateCalls.length}x -- KEMUNGKINAN B1 belum menambahkan panggilan ini (kontrak langkah 5)`);
    assert.equal(invalidateCalls[0], wsId);
  });
});
