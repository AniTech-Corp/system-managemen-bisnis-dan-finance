import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Retur stok (9 Sep 2026, konsinyasi-retur)
// src/app/api/v1/inventory/returns/route.ts
//
// Fokus test: (1) TO_SUPPLIER decrement currentStock + StockMovement RETURN_OUT
// qtyChange negatif, (2) FROM_CUSTOMER increment currentStock + StockMovement
// RETURN_IN qtyChange positif, (3) TO_SUPPLIER dengan stok tidak cukup ditolak
// (tidak jatuh negatif), (4) isolasi tenant productId, (5) validasi input dasar,
// (6) GET list + filter direction.
//
// Pola: in-memory fake Prisma proxy ($transaction bentuk-callback), sama
// filosofi dengan tests/purchase-orders.test.ts.
// Jalankan: node --experimental-test-module-mocks --import tsx --test
// ---------------------------------------------------------------------------

function jsonRequest(url: string, token: string, method: 'GET' | 'POST', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('stock-returns: inventory/returns', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let returnsGET: typeof import('../src/app/api/v1/inventory/returns/route')['GET'];
  let returnsPOST: typeof import('../src/app/api/v1/inventory/returns/route')['POST'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let products: Map<string, any>;
  let stockReturns: Map<string, any>;
  let stockMovements: Map<string, any>;
  let seq: number;

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
            if (method === 'product.findFirst') {
              const found = Array.from(products.values()).find(
                (p) => p.id === query.where?.id && p.workspaceId === query.where?.workspaceId
              );
              if (!found) return null;
              if (query.select) {
                const picked: any = {};
                for (const key of Object.keys(query.select)) picked[key] = found[key];
                return picked;
              }
              return found;
            }
            if (method === 'product.update') {
              const existing = products.get(query.where.id);
              if (!existing) throw new Error('product not found in fixture');
              if (query.data?.currentStock?.increment !== undefined) {
                existing.currentStock += query.data.currentStock.increment;
              } else if (query.data?.currentStock?.decrement !== undefined) {
                existing.currentStock -= query.data.currentStock.decrement;
              } else if (query.data?.currentStock !== undefined) {
                existing.currentStock = query.data.currentStock;
              }
              products.set(existing.id, existing);
              return existing;
            }
            if (method === 'stockReturn.create') {
              seq += 1;
              const id = `ret-${seq}`;
              const record = { id, createdAt: new Date(Date.now() + seq).toISOString(), ...query.data };
              stockReturns.set(id, record);
              return record;
            }
            if (method === 'stockReturn.count') {
              let rows = Array.from(stockReturns.values()).filter((r) => r.workspaceId === query.where?.workspaceId);
              if (query.where?.direction) rows = rows.filter((r) => r.direction === query.where.direction);
              return rows.length;
            }
            if (method === 'stockReturn.findMany') {
              let rows = Array.from(stockReturns.values()).filter((r) => r.workspaceId === query.where?.workspaceId);
              if (query.where?.direction) rows = rows.filter((r) => r.direction === query.where.direction);
              rows = rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
              const skip = query.skip ?? 0;
              const take = query.take ?? rows.length;
              rows = rows.slice(skip, skip + take);
              if (query.include?.product) {
                rows = rows.map((r) => {
                  const p = products.get(r.productId);
                  return { ...r, product: p ? { id: p.id, name: p.name, sku: p.sku ?? null } : null };
                });
              }
              return rows;
            }
            if (method === 'stockMovement.create') {
              seq += 1;
              const id = `sm-${seq}`;
              const record = { id, ...query.data };
              stockMovements.set(id, record);
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
    process.env.JWT_SECRET = 'stock-returns-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: returnsGET, POST: returnsPOST } = await import('../src/app/api/v1/inventory/returns/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
    stockReturns = new Map();
    stockMovements = new Map();
    seq = 0;
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedTenant(idSuffix: string, productSeed: Array<{ id: string; currentStock: number; name?: string }>) {
    const userId = `user-${idSuffix}`;
    const wsId = `ws-${idSuffix}`;
    users.set(userId, { id: userId, email: `${userId}@example.invalid`, fullName: `Test ${userId}`, isSuperAdmin: false });
    workspaces.set(wsId, { id: wsId, name: `Toko ${idSuffix}`, slug: `toko-${idSuffix}`, ownerId: userId, members: [], resourceGrants: [] });
    for (const p of productSeed) {
      products.set(p.id, { id: p.id, workspaceId: wsId, currentStock: p.currentStock, name: p.name ?? p.id });
    }
    const token = signJwtToken({ userId, workspaceId: wsId });
    return { token, wsId, userId };
  }

  test('POST TO_SUPPLIER: currentStock DECREMENT + StockMovement RETURN_OUT qtyChange negatif', async () => {
    const { token } = seedTenant('to-supplier', [{ id: 'prod-1', currentStock: 20, name: 'Produk A' }]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/returns', token, 'POST', {
      productId: 'prod-1',
      direction: 'TO_SUPPLIER',
      qty: 5,
      reason: 'Rusak saat pengiriman',
    });
    const res = await returnsPOST(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    assert.equal(products.get('prod-1').currentStock, 15, '20 - 5 = 15');
    assert.equal(stockReturns.size, 1);
    const ret = Array.from(stockReturns.values())[0];
    assert.equal(ret.direction, 'TO_SUPPLIER');
    assert.equal(ret.qty, 5);
    assert.equal(ret.reason, 'Rusak saat pengiriman');

    assert.equal(stockMovements.size, 1);
    const mov = Array.from(stockMovements.values())[0];
    assert.equal(mov.type, 'RETURN_OUT');
    assert.equal(mov.qtyChange, -5, 'barang keluar dari toko, qtyChange negatif');
    assert.equal(mov.sourceType, 'STOCK_RETURN');
    assert.equal(mov.sourceId, ret.id);
  });

  test('POST FROM_CUSTOMER: currentStock INCREMENT + StockMovement RETURN_IN qtyChange positif', async () => {
    const { token } = seedTenant('from-customer', [{ id: 'prod-1', currentStock: 10, name: 'Produk B' }]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/returns', token, 'POST', {
      productId: 'prod-1',
      direction: 'FROM_CUSTOMER',
      qty: 2,
      reason: 'Salah ukuran',
    });
    const res = await returnsPOST(req, {} as any);
    assert.equal(res.status, 200);

    assert.equal(products.get('prod-1').currentStock, 12, '10 + 2 = 12');
    assert.equal(stockMovements.size, 1);
    const mov = Array.from(stockMovements.values())[0];
    assert.equal(mov.type, 'RETURN_IN');
    assert.equal(mov.qtyChange, 2, 'barang masuk lagi ke toko, qtyChange positif');
  });

  test('POST TO_SUPPLIER: qty > currentStock -> ditolak, TIDAK ada yang berubah (anti stok negatif)', async () => {
    const { token } = seedTenant('insufficient', [{ id: 'prod-1', currentStock: 3, name: 'Produk C' }]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/returns', token, 'POST', {
      productId: 'prod-1',
      direction: 'TO_SUPPLIER',
      qty: 10,
    });
    const res = await returnsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-1').currentStock, 3, 'stok TIDAK berubah/jatuh negatif');
    assert.equal(stockReturns.size, 0);
    assert.equal(stockMovements.size, 0);
  });

  test('POST: productId dari workspace lain -> ditolak, isolasi tenant', async () => {
    const { token } = seedTenant('victim', [{ id: 'prod-victim', currentStock: 10 }]);
    products.set('prod-attacker', { id: 'prod-attacker', workspaceId: 'ws-someone-else', currentStock: 999, name: 'Punya orang lain' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/returns', token, 'POST', {
      productId: 'prod-attacker',
      direction: 'TO_SUPPLIER',
      qty: 5,
    });
    const res = await returnsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-attacker').currentStock, 999, 'stok produk workspace lain TIDAK berubah');
    assert.equal(stockReturns.size, 0);
  });

  test('POST: direction tidak valid -> 400', async () => {
    const { token } = seedTenant('bad-direction', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/returns', token, 'POST', {
      productId: 'prod-1',
      direction: 'SAMPING',
      qty: 1,
    });
    const res = await returnsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(stockReturns.size, 0);
  });

  test('POST: qty <= 0 -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('bad-qty', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/returns', token, 'POST', {
      productId: 'prod-1',
      direction: 'FROM_CUSTOMER',
      qty: 0,
    });
    const res = await returnsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-1').currentStock, 10, 'stok tidak berubah');
    assert.equal(stockReturns.size, 0);
  });

  test('POST: productId kosong -> 400', async () => {
    const { token } = seedTenant('no-product', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/returns', token, 'POST', {
      direction: 'FROM_CUSTOMER',
      qty: 1,
    });
    const res = await returnsPOST(req, {} as any);
    assert.equal(res.status, 400);
  });

  test('GET: list retur milik workspace sendiri saja + filter direction', async () => {
    const { token, wsId } = seedTenant('list', [{ id: 'prod-1', currentStock: 10 }]);
    stockReturns.set('ret-a', { id: 'ret-a', workspaceId: wsId, productId: 'prod-1', direction: 'TO_SUPPLIER', qty: 1, createdAt: '2026-09-01' });
    stockReturns.set('ret-b', { id: 'ret-b', workspaceId: wsId, productId: 'prod-1', direction: 'FROM_CUSTOMER', qty: 2, createdAt: '2026-09-02' });
    stockReturns.set('ret-other', { id: 'ret-other', workspaceId: 'ws-other', productId: 'prod-1', direction: 'TO_SUPPLIER', qty: 9, createdAt: '2026-09-03' });

    const reqAll = jsonRequest('https://klir.test/api/v1/inventory/returns?page=1&limit=10', token, 'GET');
    const resAll = await returnsGET(reqAll, {} as any);
    assert.equal(resAll.status, 200);
    const bodyAll = await resAll.json();
    assert.equal(bodyAll.pagination.total, 2, 'hanya milik workspace sendiri');
    assert.ok(bodyAll.stockReturns.every((r: any) => r.workspaceId === wsId));

    const reqFiltered = jsonRequest('https://klir.test/api/v1/inventory/returns?direction=TO_SUPPLIER', token, 'GET');
    const resFiltered = await returnsGET(reqFiltered, {} as any);
    const bodyFiltered = await resFiltered.json();
    assert.equal(bodyFiltered.pagination.total, 1);
    assert.equal(bodyFiltered.stockReturns[0].direction, 'TO_SUPPLIER');
  });
});
