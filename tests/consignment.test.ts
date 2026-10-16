import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Konsinyasi (9 Sep 2026, konsinyasi-retur)
// src/lib/ai-brain/consignment-engine.ts + src/app/api/v1/inventory/consignment/route.ts
//
// Bagian 1: unit test murni untuk consignment-engine.ts (Prisma-free, tanpa fixture).
// Bagian 2: test endpoint GET (list konsinyasi + ringkasan valuasi) & PATCH (toggle
// ownershipType), pola in-memory fake Prisma proxy sama dengan tests/purchase-orders.test.ts.
// Jalankan: node --experimental-test-module-mocks --import tsx --test
// ---------------------------------------------------------------------------

describe('consignment-engine (pure, Prisma-free)', () => {
  test('isConsignedProduct: true hanya untuk "CONSIGNED" persis', async () => {
    const { isConsignedProduct } = await import('../src/lib/ai-brain/consignment-engine');
    assert.equal(isConsignedProduct('CONSIGNED'), true);
    assert.equal(isConsignedProduct('OWNED'), false);
    assert.equal(isConsignedProduct(null), false);
    assert.equal(isConsignedProduct(undefined), false);
    assert.equal(isConsignedProduct('consigned'), false, 'case-sensitive, bukan fuzzy match');
  });

  test('isValidOwnershipType: hanya "OWNED"/"CONSIGNED" yang lolos', async () => {
    const { isValidOwnershipType } = await import('../src/lib/ai-brain/consignment-engine');
    assert.equal(isValidOwnershipType('OWNED'), true);
    assert.equal(isValidOwnershipType('CONSIGNED'), true);
    assert.equal(isValidOwnershipType('owned'), false);
    assert.equal(isValidOwnershipType(''), false);
    assert.equal(isValidOwnershipType(123), false);
    assert.equal(isValidOwnershipType(undefined), false);
  });

  test('calculateStockValueBreakdown: konsinyasi TIDAK ikut ownedValue', async () => {
    const { calculateStockValueBreakdown } = await import('../src/lib/ai-brain/consignment-engine');
    const result = calculateStockValueBreakdown([
      { id: 'p1', ownershipType: 'OWNED', currentStock: 10, costPrice: 5000 }, // 50.000
      { id: 'p2', ownershipType: 'OWNED', currentStock: 4, costPrice: 25000 }, // 100.000
      { id: 'p3', ownershipType: 'CONSIGNED', currentStock: 20, costPrice: 3000 }, // 60.000, TIDAK boleh masuk ownedValue
    ]);
    assert.equal(result.ownedValue, 150000, '50.000 + 100.000, TIDAK termasuk produk konsinyasi');
    assert.equal(result.consignedValue, 60000);
    assert.equal(result.ownedQty, 14);
    assert.equal(result.consignedQty, 20);
  });

  test('calculateStockValueBreakdown: array kosong -> semua nol, tidak NaN/crash', async () => {
    const { calculateStockValueBreakdown } = await import('../src/lib/ai-brain/consignment-engine');
    const result = calculateStockValueBreakdown([]);
    assert.deepEqual(result, { ownedValue: 0, consignedValue: 0, ownedQty: 0, consignedQty: 0 });
  });

  test('planConsignmentSaleLiability: amount = qty x costPrice, kategori Kewajiban Konsinyasi', async () => {
    const { planConsignmentSaleLiability, CONSIGNMENT_LIABILITY_CATEGORY } = await import(
      '../src/lib/ai-brain/consignment-engine'
    );
    const plan = planConsignmentSaleLiability({
      workspaceId: 'ws-1',
      userId: 'user-1',
      productId: 'prod-1',
      productName: 'Kaos Anime Konsinyasi',
      qty: 3,
      costPrice: 40000,
      sourceType: 'SALE',
      sourceId: 'sale-1',
    });
    assert.ok(!('error' in plan), 'input valid, tidak boleh error');
    if ('error' in plan) return;

    // StockMovement SALE_OUT, qtyChange NEGATIF (barang keluar)
    assert.equal(plan.stockMovement.type, 'SALE_OUT');
    assert.equal(plan.stockMovement.qtyChange, -3);
    assert.equal(plan.stockMovement.workspaceId, 'ws-1');
    assert.equal(plan.stockMovement.productId, 'prod-1');
    assert.equal(plan.stockMovement.sourceType, 'SALE');
    assert.equal(plan.stockMovement.sourceId, 'sale-1');

    // Product decrement qty sama persis dengan qty terjual
    assert.equal(plan.productDecrement.qty, 3);
    assert.equal(plan.productDecrement.productId, 'prod-1');

    // CashTransaction: EXPENSE, kategori Kewajiban Konsinyasi, amount = qty x costPrice
    assert.equal(plan.cashTransaction.type, 'EXPENSE');
    assert.equal(plan.cashTransaction.category, CONSIGNMENT_LIABILITY_CATEGORY);
    assert.equal(plan.cashTransaction.amount, 120000, '3 x 40.000 = 120.000');
    assert.equal(plan.cashTransaction.workspaceId, 'ws-1');
    assert.match(plan.cashTransaction.description, /Kaos Anime Konsinyasi/);
  });

  test('planConsignmentSaleLiability: qty <= 0 -> error, tidak menghasilkan plan', async () => {
    const { planConsignmentSaleLiability } = await import('../src/lib/ai-brain/consignment-engine');
    const plan = planConsignmentSaleLiability({
      workspaceId: 'ws-1',
      productId: 'prod-1',
      productName: 'Produk X',
      qty: 0,
      costPrice: 1000,
    });
    assert.ok('error' in plan);
  });

  test('planConsignmentSaleLiability: costPrice negatif -> error', async () => {
    const { planConsignmentSaleLiability } = await import('../src/lib/ai-brain/consignment-engine');
    const plan = planConsignmentSaleLiability({
      workspaceId: 'ws-1',
      productId: 'prod-1',
      productName: 'Produk X',
      qty: 2,
      costPrice: -500,
    });
    assert.ok('error' in plan);
  });
});

// ---------------------------------------------------------------------------
// Bagian 2: endpoint GET (list + summary) & PATCH (toggle ownershipType)
// ---------------------------------------------------------------------------

function jsonRequest(url: string, token: string, method: 'GET' | 'PATCH', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('inventory/consignment route (GET + PATCH)', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let consignmentGET: typeof import('../src/app/api/v1/inventory/consignment/route')['GET'];
  let consignmentPATCH: typeof import('../src/app/api/v1/inventory/consignment/route')['PATCH'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let products: Map<string, any>;

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
            if (method === 'product.findMany') {
              let rows = Array.from(products.values()).filter((p) => p.workspaceId === query.where?.workspaceId);
              if (query.where?.isActive !== undefined) {
                rows = rows.filter((p) => p.isActive === query.where.isActive);
              }
              if (query.where?.ownershipType !== undefined) {
                rows = rows.filter((p) => p.ownershipType === query.where.ownershipType);
              }
              if (query.orderBy?.name === 'asc') {
                rows = rows.slice().sort((a, b) => (a.name > b.name ? 1 : -1));
              }
              const skip = query.skip ?? 0;
              const take = query.take ?? rows.length;
              rows = rows.slice(skip, skip + take);
              if (query.select) {
                rows = rows.map((p) => {
                  const picked: any = {};
                  for (const key of Object.keys(query.select)) picked[key] = p[key];
                  return picked;
                });
              }
              return rows;
            }
            if (method === 'product.count') {
              let rows = Array.from(products.values()).filter((p) => p.workspaceId === query.where?.workspaceId);
              if (query.where?.isActive !== undefined) rows = rows.filter((p) => p.isActive === query.where.isActive);
              if (query.where?.ownershipType !== undefined) rows = rows.filter((p) => p.ownershipType === query.where.ownershipType);
              return rows.length;
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
              Object.assign(existing, query.data);
              products.set(existing.id, existing);
              return existing;
            }
            if (method === 'product.updateMany') {
              const existing = products.get(query.where?.id);
              if (!existing || existing.workspaceId !== query.where?.workspaceId) return { count: 0 };
              Object.assign(existing, query.data);
              products.set(existing.id, existing);
              return { count: 1 };
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
    process.env.JWT_SECRET = 'consignment-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: consignmentGET, PATCH: consignmentPATCH } = await import('../src/app/api/v1/inventory/consignment/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
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

  test('GET: list hanya produk CONSIGNED + summary ownedValue/consignedValue benar', async () => {
    const { token, wsId } = seedTenant('list');
    products.set('p-owned', { id: 'p-owned', workspaceId: wsId, name: 'Owned A', ownershipType: 'OWNED', currentStock: 10, costPrice: 5000, isActive: true });
    products.set('p-consigned-1', { id: 'p-consigned-1', workspaceId: wsId, name: 'Consigned A', ownershipType: 'CONSIGNED', currentStock: 6, costPrice: 2000, isActive: true });
    products.set('p-consigned-2', { id: 'p-consigned-2', workspaceId: wsId, name: 'Consigned B', ownershipType: 'CONSIGNED', currentStock: 4, costPrice: 3000, isActive: true });
    products.set('p-inactive', { id: 'p-inactive', workspaceId: wsId, name: 'Inactive Consigned', ownershipType: 'CONSIGNED', currentStock: 99, costPrice: 1000, isActive: false });
    products.set('p-other-ws', { id: 'p-other-ws', workspaceId: 'ws-other', name: 'Other', ownershipType: 'CONSIGNED', currentStock: 99, costPrice: 1000, isActive: true });

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment', token, 'GET');
    const res = await consignmentGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.pagination.total, 2, 'hanya 2 produk CONSIGNED aktif milik workspace ini');
    assert.equal(body.consignedProducts.length, 2);
    assert.ok(body.consignedProducts.every((p: any) => p.ownershipType === 'CONSIGNED'));
    assert.ok(body.consignedProducts.every((p: any) => p.workspaceId === wsId));

    // Summary: ownedValue cuma dari p-owned (10 x 5000 = 50.000), consignedValue
    // dari SEMUA produk aktif workspace ini yang CONSIGNED (6x2000 + 4x3000 = 24.000)
    assert.equal(body.summary.ownedValue, 50000);
    assert.equal(body.summary.consignedValue, 24000);
  });

  test('PATCH: toggle OWNED -> CONSIGNED sukses', async () => {
    const { token, wsId } = seedTenant('toggle');
    products.set('p-1', { id: 'p-1', workspaceId: wsId, name: 'Produk Toggle', ownershipType: 'OWNED', currentStock: 5, costPrice: 1000, isActive: true });

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment', token, 'PATCH', {
      productId: 'p-1',
      ownershipType: 'CONSIGNED',
    });
    const res = await consignmentPATCH(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.product.ownershipType, 'CONSIGNED');
    assert.equal(products.get('p-1').ownershipType, 'CONSIGNED');
    // currentStock TIDAK berubah -- toggle murni reklasifikasi
    assert.equal(products.get('p-1').currentStock, 5);
  });

  test('PATCH: productId dari workspace lain -> 404, tidak ke-update', async () => {
    const { token } = seedTenant('attacker');
    products.set('p-victim', { id: 'p-victim', workspaceId: 'ws-victim', name: 'Punya Orang Lain', ownershipType: 'OWNED', currentStock: 5, costPrice: 1000, isActive: true });

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment', token, 'PATCH', {
      productId: 'p-victim',
      ownershipType: 'CONSIGNED',
    });
    const res = await consignmentPATCH(req, {} as any);
    assert.equal(res.status, 404);
    assert.equal(products.get('p-victim').ownershipType, 'OWNED', 'TIDAK berubah -- isolasi tenant');
  });

  test('PATCH: ownershipType tidak valid -> 400', async () => {
    const { token, wsId } = seedTenant('invalid-type');
    products.set('p-1', { id: 'p-1', workspaceId: wsId, name: 'Produk', ownershipType: 'OWNED', currentStock: 5, costPrice: 1000, isActive: true });

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment', token, 'PATCH', {
      productId: 'p-1',
      ownershipType: 'SEWA', // bukan OWNED/CONSIGNED
    });
    const res = await consignmentPATCH(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('p-1').ownershipType, 'OWNED');
  });

  test('PATCH: productId kosong -> 400', async () => {
    const { token } = seedTenant('no-product-id');
    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment', token, 'PATCH', {
      ownershipType: 'CONSIGNED',
    });
    const res = await consignmentPATCH(req, {} as any);
    assert.equal(res.status, 400);
  });
});
