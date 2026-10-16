import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Purchase Order + auto-post Kas (9 Sep 2026, purchase-order-backend)
// src/app/api/v1/inventory/purchase-orders/route.ts
//
// Fokus test: (1) currentStock Product ke-update benar (increment, bukan
// overwrite), (2) CashTransaction EXPENSE ke-buat dengan amount = totalAmount
// yang benar, (3) StockMovement PURCHASE_IN tertulis per item, (4) isolasi
// tenant productId, (5) validasi input dasar.
//
// Pola: in-memory fake Prisma proxy ($transaction bentuk-callback), sama
// filosofi dengan tests/workspace-files-import-ledger.test.ts.
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

describe('purchase-order-backend: inventory/purchase-orders', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let purchaseOrdersGET: typeof import('../src/app/api/v1/inventory/purchase-orders/route')['GET'];
  let purchaseOrdersPOST: typeof import('../src/app/api/v1/inventory/purchase-orders/route')['POST'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let products: Map<string, any>;
  let purchaseOrders: Map<string, any>;
  let purchaseOrderItems: Map<string, any>;
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
            if (method === 'product.findMany') {
              const ids: string[] = query.where?.id?.in ?? [];
              const wsId = query.where?.workspaceId;
              const rows = ids
                .map((id) => products.get(id))
                .filter((p) => p && p.workspaceId === wsId);
              return rows.map((p) => ({ id: p.id }));
            }
            if (method === 'product.update') {
              const existing = products.get(query.where.id);
              if (!existing) throw new Error('product not found in fixture');
              if (query.data?.currentStock?.increment !== undefined) {
                existing.currentStock += query.data.currentStock.increment;
              } else if (query.data?.currentStock !== undefined) {
                existing.currentStock = query.data.currentStock;
              }
              products.set(existing.id, existing);
              return existing;
            }
            if (method === 'purchaseOrder.create') {
              seq += 1;
              const id = `po-${seq}`;
              const record = { id, items: [], ...query.data };
              purchaseOrders.set(id, record);
              return record;
            }
            if (method === 'purchaseOrder.update') {
              const existing = purchaseOrders.get(query.where.id);
              const updated = { ...existing, ...query.data };
              purchaseOrders.set(existing.id, updated);
              if (query.include?.items) {
                updated.items = Array.from(purchaseOrderItems.values()).filter((i) => i.purchaseOrderId === existing.id);
              }
              return updated;
            }
            if (method === 'purchaseOrder.count') {
              return Array.from(purchaseOrders.values()).filter((p) => p.workspaceId === query.where?.workspaceId).length;
            }
            if (method === 'purchaseOrder.findMany') {
              let rows = Array.from(purchaseOrders.values()).filter((p) => p.workspaceId === query.where?.workspaceId);
              rows = rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
              const skip = query.skip ?? 0;
              const take = query.take ?? rows.length;
              rows = rows.slice(skip, skip + take);
              if (query.include?.items) {
                rows = rows.map((p) => ({ ...p, items: Array.from(purchaseOrderItems.values()).filter((i) => i.purchaseOrderId === p.id) }));
              }
              return rows;
            }
            if (method === 'purchaseOrderItem.create') {
              seq += 1;
              const id = `poi-${seq}`;
              const record = { id, ...query.data };
              purchaseOrderItems.set(id, record);
              return record;
            }
            if (method === 'stockMovement.create') {
              seq += 1;
              const id = `sm-${seq}`;
              const record = { id, ...query.data };
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
    process.env.JWT_SECRET = 'purchase-orders-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: purchaseOrdersGET, POST: purchaseOrdersPOST } = await import('../src/app/api/v1/inventory/purchase-orders/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
    purchaseOrders = new Map();
    purchaseOrderItems = new Map();
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

  function seedTenant(idSuffix: string, productSeed: Array<{ id: string; currentStock: number }>) {
    const userId = `user-${idSuffix}`;
    const wsId = `ws-${idSuffix}`;
    users.set(userId, { id: userId, email: `${userId}@example.invalid`, fullName: `Test ${userId}`, isSuperAdmin: false });
    workspaces.set(wsId, { id: wsId, name: `Toko ${idSuffix}`, slug: `toko-${idSuffix}`, ownerId: userId, members: [], resourceGrants: [] });
    for (const p of productSeed) {
      products.set(p.id, { id: p.id, workspaceId: wsId, currentStock: p.currentStock });
    }
    const token = signJwtToken({ userId, workspaceId: wsId });
    return { token, wsId, userId };
  }

  test('POST: currentStock ke-update benar (increment) + CashTransaction EXPENSE amount = totalAmount', async () => {
    const { token, wsId } = seedTenant('happy', [{ id: 'prod-1', currentStock: 10 }, { id: 'prod-2', currentStock: 5 }]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/purchase-orders', token, 'POST', {
      supplierName: 'CV Sumber Makmur',
      supplierPhone: 'contoh-nomor-wa-supplier',
      items: [
        { productId: 'prod-1', qty: 20, unitCost: 5000 },
        { productId: 'prod-2', qty: 3, unitCost: 15000 },
      ],
      paymentMethod: 'TUNAI',
      notes: 'Restock bulanan',
    });

    const res = await purchaseOrdersPOST(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);

    // (1) currentStock genuinely bertambah (increment, bukan overwrite dari 0)
    assert.equal(products.get('prod-1').currentStock, 30, '10 + 20 = 30');
    assert.equal(products.get('prod-2').currentStock, 8, '5 + 3 = 8');

    // (2) CashTransaction EXPENSE dengan amount = totalAmount yang benar
    const expectedTotal = 20 * 5000 + 3 * 15000; // 100000 + 45000 = 145000
    assert.equal(cashTransactions.size, 1);
    const cashTx = Array.from(cashTransactions.values())[0];
    assert.equal(cashTx.type, 'EXPENSE');
    assert.equal(cashTx.amount, expectedTotal);
    assert.equal(cashTx.category, 'Pembelian Stok/Purchasing');
    assert.equal(cashTx.workspaceId, wsId);
    assert.match(cashTx.description, /CV Sumber Makmur/);

    // PurchaseOrder.cashTransactionId ke-link ke CashTransaction yang sama
    assert.equal(body.purchaseOrder.totalAmount, expectedTotal);
    assert.equal(body.purchaseOrder.cashTransactionId, cashTx.id);

    // (3) StockMovement PURCHASE_IN tertulis per item, qtyChange positif
    assert.equal(stockMovements.size, 2);
    const movements = Array.from(stockMovements.values());
    assert.ok(movements.every((m) => m.type === 'PURCHASE_IN'));
    assert.ok(movements.every((m) => m.qtyChange > 0));
    assert.ok(movements.every((m) => m.sourceType === 'PURCHASE_ORDER_ITEM'));
    const mov1 = movements.find((m) => m.productId === 'prod-1');
    assert.equal(mov1.qtyChange, 20);

    // PurchaseOrderItem.subtotal disimpan (bukan dihitung ulang saat baca)
    assert.equal(purchaseOrderItems.size, 2);
    const item1 = Array.from(purchaseOrderItems.values()).find((i) => i.productId === 'prod-1');
    assert.equal(item1.subtotal, 20 * 5000);
  });

  test('POST: productId dari workspace lain -> ditolak, TIDAK ada stok/kas yang berubah (isolasi tenant)', async () => {
    const { token } = seedTenant('victim', [{ id: 'prod-victim', currentStock: 10 }]);
    // Produk milik workspace lain
    products.set('prod-attacker', { id: 'prod-attacker', workspaceId: 'ws-someone-else', currentStock: 999 });

    const req = jsonRequest('https://klir.test/api/v1/inventory/purchase-orders', token, 'POST', {
      supplierName: 'Supplier Nakal',
      items: [{ productId: 'prod-attacker', qty: 5, unitCost: 1000 }],
    });

    const res = await purchaseOrdersPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-attacker').currentStock, 999, 'stok produk workspace lain TIDAK berubah');
    assert.equal(cashTransactions.size, 0);
    assert.equal(purchaseOrders.size, 0);
  });

  test('POST: items kosong -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('empty-items', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/purchase-orders', token, 'POST', {
      supplierName: 'Toko A',
      items: [],
    });
    const res = await purchaseOrdersPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(purchaseOrders.size, 0);
  });

  test('POST: supplierName kosong -> 400', async () => {
    const { token } = seedTenant('no-supplier', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/purchase-orders', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 1, unitCost: 1000 }],
    });
    const res = await purchaseOrdersPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(purchaseOrders.size, 0);
  });

  test('POST: qty <= 0 -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('bad-qty', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/purchase-orders', token, 'POST', {
      supplierName: 'Toko A',
      items: [{ productId: 'prod-1', qty: 0, unitCost: 1000 }],
    });
    const res = await purchaseOrdersPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-1').currentStock, 10, 'stok tidak berubah');
    assert.equal(purchaseOrders.size, 0);
  });

  test('GET: list Purchase Order milik workspace sendiri saja + paginated', async () => {
    const { token, wsId } = seedTenant('list', [{ id: 'prod-1', currentStock: 10 }]);
    // Seed 2 PO milik tenant ini + 1 milik tenant lain (harus tidak muncul)
    purchaseOrders.set('po-a', { id: 'po-a', workspaceId: wsId, poNumber: 'PO-A', totalAmount: 1000, createdAt: '2026-09-01' });
    purchaseOrders.set('po-b', { id: 'po-b', workspaceId: wsId, poNumber: 'PO-B', totalAmount: 2000, createdAt: '2026-09-02' });
    purchaseOrders.set('po-other', { id: 'po-other', workspaceId: 'ws-other', poNumber: 'PO-X', totalAmount: 9999, createdAt: '2026-09-03' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/purchase-orders?page=1&limit=10', token, 'GET');
    const res = await purchaseOrdersGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pagination.total, 2);
    assert.equal(body.purchaseOrders.length, 2);
    assert.ok(body.purchaseOrders.every((p: any) => p.workspaceId === wsId));
  });
});
