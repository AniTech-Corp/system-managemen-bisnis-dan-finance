import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Skor Keandalan Supplier (9 Sep 2026, supplier-score)
// src/app/api/v1/inventory/supplier-score/route.ts
//
// Beda fokus dari tests/supplier-reliability-engine.test.ts (yang menguji fungsi
// kalkulasi murni): file ini menguji WIRING route.ts sendiri -- (1) cache-first di
// GET (baris SupplierScore sudah ada -> TIDAK recalc), (2) ?recalculate=1 memaksa
// hitung ulang + upsert, (3) POST selalu recalculate, (4) pemadanan by-index 2-lapis
// resolusi retur (passA/passB di route.ts) tidak salah pasang saat ada campuran
// retur yang resolve di lapis 1 vs lapis 2 vs sama sekali tidak resolve.
//
// Pola: in-memory fake Prisma proxy ($transaction tidak dipakai endpoint ini, tapi
// method lain sama filosofi dgn tests/purchase-orders.test.ts).
// ---------------------------------------------------------------------------

function jsonRequest(url: string, token: string, method: 'GET' | 'POST') {
  return new NextRequest(url, { method, headers: { Authorization: `Bearer ${token}` } });
}

describe('supplier-score: inventory/supplier-score', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let supplierScoreGET: typeof import('../src/app/api/v1/inventory/supplier-score/route')['GET'];
  let supplierScorePOST: typeof import('../src/app/api/v1/inventory/supplier-score/route')['POST'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let purchaseOrders: Map<string, any>;
  let stockReturns: Map<string, any>;
  let supplierScores: Map<string, any>;
  let upsertCallCount: number;
  let seq: number;

  const fakePrisma = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'then') return undefined;
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
            if (method === 'purchaseOrder.findMany') {
              const wsId = query.where?.workspaceId;
              return Array.from(purchaseOrders.values()).filter((p) => p.workspaceId === wsId && p.status !== 'CANCELLED');
            }
            if (method === 'stockReturn.findMany') {
              const wsId = query.where?.workspaceId;
              const direction = query.where?.direction;
              return Array.from(stockReturns.values()).filter((r) => r.workspaceId === wsId && r.direction === direction);
            }
            if (method === 'supplierScore.findMany') {
              const wsId = query.where?.workspaceId;
              return Array.from(supplierScores.values()).filter((s) => s.workspaceId === wsId);
            }
            if (method === 'supplierScore.upsert') {
              upsertCallCount += 1;
              const key = `${query.where.workspaceId_supplierName.workspaceId}::${query.where.workspaceId_supplierName.supplierName}`;
              const existing = supplierScores.get(key);
              seq += 1;
              const record = existing ? { ...existing, ...query.update } : { id: `ss-${seq}`, ...query.create };
              supplierScores.set(key, record);
              return record;
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
    process.env.JWT_SECRET = 'supplier-score-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: supplierScoreGET, POST: supplierScorePOST } = await import('../src/app/api/v1/inventory/supplier-score/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    purchaseOrders = new Map();
    stockReturns = new Map();
    supplierScores = new Map();
    upsertCallCount = 0;
    seq = 0;
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
    const token = signJwtToken({ userId, workspaceId: wsId });
    return { token, wsId, userId };
  }

  function seedPO(wsId: string, id: string, supplierName: string, purchaseDate: string, items: Array<{ id: string; productId: string; qty: number; unitCost: number }>) {
    purchaseOrders.set(id, { id, workspaceId: wsId, supplierName, purchaseDate: new Date(purchaseDate), status: 'RECEIVED', items });
  }

  function seedReturn(wsId: string, id: string, opts: { productId: string; qty: number; createdAt: string; sourceType?: string | null; sourceId?: string | null }) {
    stockReturns.set(id, {
      id, workspaceId: wsId, direction: 'TO_SUPPLIER', productId: opts.productId, qty: opts.qty,
      createdAt: new Date(opts.createdAt), sourceType: opts.sourceType ?? null, sourceId: opts.sourceId ?? null,
    });
  }

  test('GET pertama kali (belum ada cache) -> recalculate otomatis + upsert tersimpan', async () => {
    const { token, wsId } = seedTenant('fresh');
    seedPO(wsId, 'po-1', 'CV Andalan', '2026-09-01', [{ id: 'poi-1', productId: 'p1', qty: 10, unitCost: 5000 }]);

    const res = await supplierScoreGET(jsonRequest('https://klir.test/api/v1/inventory/supplier-score', token, 'GET'), {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.recalculated, true);
    assert.equal(body.supplierScores.length, 1);
    assert.equal(body.supplierScores[0].supplierName, 'CV Andalan');
    assert.equal(upsertCallCount, 1, 'harus upsert 1x untuk 1 supplier yang kena hitung');
    assert.equal(supplierScores.size, 1, 'cache tersimpan utk panggilan GET berikutnya');
  });

  test('GET kedua (cache sudah ada) -> TIDAK recalculate, tidak upsert lagi', async () => {
    const { token, wsId } = seedTenant('cached');
    seedPO(wsId, 'po-1', 'CV Andalan', '2026-09-01', [{ id: 'poi-1', productId: 'p1', qty: 10, unitCost: 5000 }]);

    await supplierScoreGET(jsonRequest('https://klir.test/api/v1/inventory/supplier-score', token, 'GET'), {} as any);
    assert.equal(upsertCallCount, 1);

    // Ubah data sumber (kalau recalc jalan lagi, score akan berubah) -- tapi GET kedua
    // TANPA ?recalculate=1 harus tetap baca cache lama, bukan hitung ulang.
    seedPO(wsId, 'po-2', 'CV Andalan', '2026-09-02', [{ id: 'poi-2', productId: 'p1', qty: 10, unitCost: 999999 }]);

    const res2 = await supplierScoreGET(jsonRequest('https://klir.test/api/v1/inventory/supplier-score', token, 'GET'), {} as any);
    const body2 = await res2.json();
    assert.equal(body2.recalculated, false);
    assert.equal(upsertCallCount, 1, 'GET kedua TIDAK boleh nambah upsert -- baca cache saja');
  });

  test('GET ?recalculate=1 -> paksa hitung ulang walau cache sudah ada', async () => {
    const { token, wsId } = seedTenant('force');
    seedPO(wsId, 'po-1', 'CV Andalan', '2026-09-01', [{ id: 'poi-1', productId: 'p1', qty: 10, unitCost: 5000 }]);
    await supplierScoreGET(jsonRequest('https://klir.test/api/v1/inventory/supplier-score', token, 'GET'), {} as any);
    assert.equal(upsertCallCount, 1);

    const res2 = await supplierScoreGET(jsonRequest('https://klir.test/api/v1/inventory/supplier-score?recalculate=1', token, 'GET'), {} as any);
    const body2 = await res2.json();
    assert.equal(body2.recalculated, true);
    assert.equal(upsertCallCount, 2, 'recalculate=1 harus trigger upsert lagi');
  });

  test('POST selalu recalculate walau cache ada', async () => {
    const { token, wsId } = seedTenant('post');
    seedPO(wsId, 'po-1', 'CV Andalan', '2026-09-01', [{ id: 'poi-1', productId: 'p1', qty: 10, unitCost: 5000 }]);
    await supplierScoreGET(jsonRequest('https://klir.test/api/v1/inventory/supplier-score', token, 'GET'), {} as any);
    assert.equal(upsertCallCount, 1);

    const res = await supplierScorePOST(jsonRequest('https://klir.test/api/v1/inventory/supplier-score', token, 'POST'), {} as any);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(upsertCallCount, 2);
  });

  test('resolusi retur 2-lapis: campuran sourceId-resolve + fallback-resolve + unresolved TIDAK salah pasang (index-alignment)', async () => {
    const { token, wsId } = seedTenant('mixed-resolve');
    // 2 supplier, 2 produk beda -- kalau by-index route.ts salah pasang, retur milik
    // supplier A bisa "nyasar" jadi defect supplier B.
    seedPO(wsId, 'po-a', 'Supplier A', '2026-09-01', [{ id: 'poi-a1', productId: 'p-a', qty: 20, unitCost: 1000 }]);
    seedPO(wsId, 'po-b', 'Supplier B', '2026-09-01', [{ id: 'poi-b1', productId: 'p-b', qty: 20, unitCost: 2000 }]);

    // Retur #1: resolve lewat LAPIS 1 (sourceId eksplisit ke poi-a1 -> Supplier A)
    seedReturn(wsId, 'ret-1', { productId: 'p-a', qty: 5, createdAt: '2026-09-05', sourceType: 'PURCHASE_ORDER_ITEM', sourceId: 'poi-a1' });
    // Retur #2: TIDAK ada sourceId (kondisi nyata endpoint returns/route.ts hari ini) ->
    // resolve lewat LAPIS 2 fallback (histori pembelian p-b -> Supplier B)
    seedReturn(wsId, 'ret-2', { productId: 'p-b', qty: 4, createdAt: '2026-09-06' });
    // Retur #3: produk yang TIDAK PERNAH dibeli sama sekali -> unresolved di kedua lapis
    seedReturn(wsId, 'ret-3', { productId: 'p-ghost', qty: 99, createdAt: '2026-09-07' });

    const res = await supplierScoreGET(jsonRequest('https://klir.test/api/v1/inventory/supplier-score', token, 'GET'), {} as any);
    const body = await res.json();

    const supplierA = body.supplierScores.find((s: any) => s.supplierName === 'Supplier A');
    const supplierB = body.supplierScores.find((s: any) => s.supplierName === 'Supplier B');

    assert.equal(supplierA.defectRate, 25, 'Supplier A: 5/20 = 25%, dari retur lapis-1');
    assert.equal(supplierB.defectRate, 20, 'Supplier B: 4/20 = 20%, dari retur lapis-2 fallback, TIDAK ketuker sama Supplier A');
    assert.equal(body.meta.unresolvedReturnCount, 1, 'ret-3 (produk ghost) harus kehitung unresolved, bukan hilang diam2 atau nyasar ke supplier lain');
  });
});
