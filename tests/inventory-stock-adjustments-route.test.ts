import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Penyesuaian stok manual (10 Sep 2026, api-stock-ops, F3 Tingkat B)
// src/app/api/v1/inventory/stock-adjustments/route.ts
//
// Fokus test: (1) qtyChange positif -> ADJUSTMENT_IN + currentStock bertambah,
// (2) qtyChange negatif -> ADJUSTMENT_OUT + currentStock berkurang, (3) hasil
// currentStock < 0 ditolak (tidak menulis apapun), (4) reason kosong/pendek
// ditolak, (5) qtyChange = 0 ditolak, (6) isolasi tenant productId, (7) TIDAK
// ada CashTransaction yang ditulis (penyesuaian bukan event uang).
//
// Pola: in-memory fake Prisma proxy ($transaction bentuk-callback), sama
// filosofi dengan tests/purchase-orders.test.ts dan tests/stock-returns.test.ts.
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

describe('stock-adjustments: inventory/stock-adjustments', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let stockAdjustmentsPOST: typeof import('../src/app/api/v1/inventory/stock-adjustments/route')['POST'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let products: Map<string, any>;
  let stockMovements: Map<string, any>;
  let cashTransactions: Map<string, any>;
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
            if (method === 'stockMovement.create') {
              seq += 1;
              const id = `sm-${seq}`;
              const record = { id, createdAt: new Date(Date.now() + seq).toISOString(), ...query.data };
              stockMovements.set(id, record);
              return record;
            }
            if (method === 'cashTransaction.create') {
              seq += 1;
              const id = `tx-${seq}`;
              const record = { id, ...query.data };
              cashTransactions.set(id, record);
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
    process.env.JWT_SECRET = 'stock-adjustments-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: stockAdjustmentsPOST } = await import('../src/app/api/v1/inventory/stock-adjustments/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
    stockMovements = new Map();
    cashTransactions = new Map();
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

  test('POST qtyChange positif -> ADJUSTMENT_IN + currentStock bertambah', async () => {
    const { token } = seedTenant('increase', [{ id: 'prod-1', currentStock: 10, name: 'Beras 5kg' }]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-adjustments', token, 'POST', {
      productId: 'prod-1',
      qtyChange: 7,
      reason: 'Stok opname, ketemu tambahan',
    });
    const res = await stockAdjustmentsPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();

    assert.equal(products.get('prod-1').currentStock, 17, '10 + 7 = 17');
    assert.equal(body.product.currentStock, 17);
    assert.equal(stockMovements.size, 1);
    const mov = Array.from(stockMovements.values())[0];
    assert.equal(mov.type, 'ADJUSTMENT_IN');
    assert.equal(mov.qtyChange, 7);
    assert.equal(mov.sourceType, 'manual_adjustment');
    assert.match(mov.note, /Stok opname/);
    assert.equal(cashTransactions.size, 0, 'penyesuaian TIDAK menulis CashTransaction');
  });

  test('POST qtyChange negatif -> ADJUSTMENT_OUT + currentStock berkurang', async () => {
    const { token } = seedTenant('decrease', [{ id: 'prod-1', currentStock: 10, name: 'Beras 5kg' }]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-adjustments', token, 'POST', {
      productId: 'prod-1',
      qtyChange: -4,
      reason: 'Rusak kena air',
    });
    const res = await stockAdjustmentsPOST(req, {} as any);
    assert.equal(res.status, 201);

    assert.equal(products.get('prod-1').currentStock, 6, '10 - 4 = 6');
    assert.equal(stockMovements.size, 1);
    const mov = Array.from(stockMovements.values())[0];
    assert.equal(mov.type, 'ADJUSTMENT_OUT');
    assert.equal(mov.qtyChange, -4);
  });

  test('POST hasil currentStock < 0 -> ditolak, tidak menulis apapun', async () => {
    const { token } = seedTenant('negative', [{ id: 'prod-1', currentStock: 3, name: 'Beras 5kg' }]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-adjustments', token, 'POST', {
      productId: 'prod-1',
      qtyChange: -10,
      reason: 'Salah hitung',
    });
    const res = await stockAdjustmentsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-1').currentStock, 3, 'stok tidak berubah');
    assert.equal(stockMovements.size, 0);
  });

  test('POST reason kosong -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('no-reason', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-adjustments', token, 'POST', {
      productId: 'prod-1',
      qtyChange: 5,
      reason: '',
    });
    const res = await stockAdjustmentsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(stockMovements.size, 0);
    assert.equal(products.get('prod-1').currentStock, 10);
  });

  test('POST reason terlalu pendek (< 3 huruf) -> 400', async () => {
    const { token } = seedTenant('short-reason', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-adjustments', token, 'POST', {
      productId: 'prod-1',
      qtyChange: 5,
      reason: 'ab',
    });
    const res = await stockAdjustmentsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(stockMovements.size, 0);
  });

  test('POST qtyChange = 0 -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('zero-qty', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-adjustments', token, 'POST', {
      productId: 'prod-1',
      qtyChange: 0,
      reason: 'Coba nol',
    });
    const res = await stockAdjustmentsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(stockMovements.size, 0);
  });

  test('POST productId dari workspace lain -> ditolak (isolasi tenant)', async () => {
    const { token } = seedTenant('victim', [{ id: 'prod-victim', currentStock: 10 }]);
    products.set('prod-attacker', { id: 'prod-attacker', workspaceId: 'ws-someone-else', currentStock: 999, name: 'Milik Orang Lain' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-adjustments', token, 'POST', {
      productId: 'prod-attacker',
      qtyChange: 5,
      reason: 'Coba nyolong stok',
    });
    const res = await stockAdjustmentsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-attacker').currentStock, 999, 'stok produk workspace lain TIDAK berubah');
    assert.equal(stockMovements.size, 0);
  });

  test('POST productId tidak dikirim -> 400', async () => {
    const { token } = seedTenant('no-product', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/stock-adjustments', token, 'POST', {
      qtyChange: 5,
      reason: 'Tanpa produk',
    });
    const res = await stockAdjustmentsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(stockMovements.size, 0);
  });
});
