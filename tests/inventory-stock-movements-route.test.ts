import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Riwayat keluar-masuk stok (10 Sep 2026, agent api-inventory-read)
// src/app/api/v1/inventory/stock-movements/route.ts
//
// Fokus test: (1) isolasi tenant, (2) filter productId, (3) filter type,
// (4) type tidak valid -> 400, (5) include product {id,name,sku,unit} ikut
// terkirim (dipakai UI tab riwayat), (6) pagination.
//
// Pola: in-memory fake Prisma proxy, sama filosofi dengan tests/purchase-orders.test.ts.
// Jalankan: node --experimental-test-module-mocks --import tsx --test
// ---------------------------------------------------------------------------

function jsonRequest(url: string, token: string, method: 'GET') {
  return new NextRequest(url, {
    method,
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('api-inventory-read: inventory/stock-movements', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let movementsGET: typeof import('../src/app/api/v1/inventory/stock-movements/route')['GET'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let products: Map<string, any>;
  let stockMovements: Map<string, any>;

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
            if (method === 'stockMovement.count') {
              return matchMovements(query.where).length;
            }
            if (method === 'stockMovement.findMany') {
              let rows = matchMovements(query.where);
              rows = rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
              const skip = query.skip ?? 0;
              const take = query.take ?? rows.length;
              rows = rows.slice(skip, skip + take);
              if (query.include?.product) {
                rows = rows.map((m) => {
                  const p = products.get(m.productId);
                  return {
                    ...m,
                    product: p ? { id: p.id, name: p.name, sku: p.sku, unit: p.unit } : null,
                  };
                });
              }
              return rows;
            }
            throw new Error(`Forbidden Prisma operation in test fixture: ${method}`);
          };
        },
      });
    },
  });

  function matchMovements(where: any): any[] {
    let rows = Array.from(stockMovements.values()).filter((m) => m.workspaceId === where?.workspaceId);
    if (where?.productId) rows = rows.filter((m) => m.productId === where.productId);
    if (where?.type) rows = rows.filter((m) => m.type === where.type);
    return rows;
  }

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'inventory-stock-movements-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: movementsGET } = await import('../src/app/api/v1/inventory/stock-movements/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
    stockMovements = new Map();
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

  test('GET: isolasi tenant -- hanya movement milik workspace sendiri', async () => {
    const { token, wsId } = seedTenant('isolate');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: 'A1', unit: 'pcs' });
    stockMovements.set('m1', { id: 'm1', workspaceId: wsId, productId: 'p1', type: 'PURCHASE_IN', qtyChange: 10, createdAt: '2026-09-01' });
    stockMovements.set('m-other', { id: 'm-other', workspaceId: 'ws-other', productId: 'p-other', type: 'PURCHASE_IN', qtyChange: 50, createdAt: '2026-09-01' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-movements', token, 'GET');
    const res = await movementsGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.movements.length, 1);
    assert.equal(body.movements[0].id, 'm1');
  });

  test('GET: include product {id,name,sku,unit} ikut terkirim per movement', async () => {
    const { token, wsId } = seedTenant('include-product');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Beras 5kg', sku: 'BRS-5', unit: 'karung' });
    stockMovements.set('m1', { id: 'm1', workspaceId: wsId, productId: 'p1', type: 'PURCHASE_IN', qtyChange: 20, createdAt: '2026-09-01' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-movements', token, 'GET');
    const res = await movementsGET(req, {} as any);
    const body = await res.json();
    assert.equal(body.movements[0].product.name, 'Beras 5kg');
    assert.equal(body.movements[0].product.sku, 'BRS-5');
    assert.equal(body.movements[0].product.unit, 'karung');
  });

  test('GET: filter productId', async () => {
    const { token, wsId } = seedTenant('filter-product');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'A', sku: null, unit: 'pcs' });
    products.set('p2', { id: 'p2', workspaceId: wsId, name: 'B', sku: null, unit: 'pcs' });
    stockMovements.set('m1', { id: 'm1', workspaceId: wsId, productId: 'p1', type: 'PURCHASE_IN', qtyChange: 5, createdAt: '2026-09-01' });
    stockMovements.set('m2', { id: 'm2', workspaceId: wsId, productId: 'p2', type: 'PURCHASE_IN', qtyChange: 8, createdAt: '2026-09-01' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-movements?productId=p2', token, 'GET');
    const res = await movementsGET(req, {} as any);
    const body = await res.json();
    assert.equal(body.movements.length, 1);
    assert.equal(body.movements[0].productId, 'p2');
  });

  test('GET: filter type', async () => {
    const { token, wsId } = seedTenant('filter-type');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'A', sku: null, unit: 'pcs' });
    stockMovements.set('m1', { id: 'm1', workspaceId: wsId, productId: 'p1', type: 'PURCHASE_IN', qtyChange: 5, createdAt: '2026-09-01' });
    stockMovements.set('m2', { id: 'm2', workspaceId: wsId, productId: 'p1', type: 'SALE_OUT', qtyChange: -2, createdAt: '2026-09-02' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-movements?type=SALE_OUT', token, 'GET');
    const res = await movementsGET(req, {} as any);
    const body = await res.json();
    assert.equal(body.movements.length, 1);
    assert.equal(body.movements[0].type, 'SALE_OUT');
  });

  test('GET: type tidak valid -> 400', async () => {
    const { token } = seedTenant('bad-type');
    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-movements?type=BUKAN_TIPE_VALID', token, 'GET');
    const res = await movementsGET(req, {} as any);
    assert.equal(res.status, 400);
  });

  test('GET: pagination -- orderBy createdAt desc, skip/take benar', async () => {
    const { token, wsId } = seedTenant('pagination');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'A', sku: null, unit: 'pcs' });
    stockMovements.set('m1', { id: 'm1', workspaceId: wsId, productId: 'p1', type: 'PURCHASE_IN', qtyChange: 1, createdAt: '2026-09-01' });
    stockMovements.set('m2', { id: 'm2', workspaceId: wsId, productId: 'p1', type: 'PURCHASE_IN', qtyChange: 1, createdAt: '2026-09-02' });
    stockMovements.set('m3', { id: 'm3', workspaceId: wsId, productId: 'p1', type: 'PURCHASE_IN', qtyChange: 1, createdAt: '2026-09-03' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-movements?page=2&limit=1', token, 'GET');
    const res = await movementsGET(req, {} as any);
    const body = await res.json();
    assert.equal(body.pagination.total, 3);
    assert.equal(body.pagination.totalPages, 3);
    assert.equal(body.movements.length, 1);
    assert.equal(body.movements[0].id, 'm2', 'urut desc createdAt: m3,m2,m1 -- halaman 2 = m2');
  });
});
