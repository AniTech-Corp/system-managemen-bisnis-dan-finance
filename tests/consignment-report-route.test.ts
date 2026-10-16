import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Laporan settlement konsinyasi (10 Sep 2026, api-stock-ops, F3 Tingkat B)
// src/app/api/v1/inventory/consignment/report/route.ts + buildConsignmentReportRows
// di src/lib/ai-brain/consignment-engine.ts
//
// Fokus test: (1) hanya produk CONSIGNED aktif yang muncul, (2) qtySold benar
// dari |SALE_OUT|, (3) amountDueToSupplier = qtySold x costPrice, (4) qtyIn dari
// PURCHASE_IN + RETURN_IN, (5) qtyReturnedToSupplier dari StockReturn TO_SUPPLIER,
// (6) totals dijumlah benar, (7) default periode 30 hari terakhir kalau
// from/to tidak dikirim, (8) zero-data (tidak ada produk konsinyasi) -> rows
// kosong bukan error, (9) isolasi tenant.
//
// Pola: in-memory fake Prisma proxy, sama filosofi dengan tests/purchase-orders.test.ts.
// Jalankan: node --experimental-test-module-mocks --import tsx --test
// ---------------------------------------------------------------------------

function jsonRequest(url: string, token: string) {
  return new NextRequest(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

describe('consignment-report: inventory/consignment/report', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let reportGET: typeof import('../src/app/api/v1/inventory/consignment/report/route')['GET'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let products: Map<string, any>;
  let stockMovements: Map<string, any>;
  let stockReturns: Map<string, any>;
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
              const wsId = query.where?.workspaceId;
              let rows = Array.from(products.values()).filter((p) => p.workspaceId === wsId);
              if (query.where?.isActive !== undefined) rows = rows.filter((p) => p.isActive === query.where.isActive);
              if (query.where?.ownershipType !== undefined) rows = rows.filter((p) => p.ownershipType === query.where.ownershipType);
              if (query.select) {
                return rows.map((p) => {
                  const picked: any = {};
                  for (const key of Object.keys(query.select)) picked[key] = p[key];
                  return picked;
                });
              }
              return rows;
            }
            if (method === 'stockMovement.findMany') {
              const wsId = query.where?.workspaceId;
              const ids: string[] = query.where?.productId?.in ?? [];
              const gte: Date | undefined = query.where?.createdAt?.gte;
              const lte: Date | undefined = query.where?.createdAt?.lte;
              let rows = Array.from(stockMovements.values()).filter(
                (m) => m.workspaceId === wsId && ids.includes(m.productId)
              );
              if (gte) rows = rows.filter((m) => new Date(m.createdAt).getTime() >= gte.getTime());
              if (lte) rows = rows.filter((m) => new Date(m.createdAt).getTime() <= lte.getTime());
              if (query.select) {
                return rows.map((m) => {
                  const picked: any = {};
                  for (const key of Object.keys(query.select)) picked[key] = m[key];
                  return picked;
                });
              }
              return rows;
            }
            if (method === 'stockReturn.findMany') {
              const wsId = query.where?.workspaceId;
              const ids: string[] = query.where?.productId?.in ?? [];
              const gte: Date | undefined = query.where?.createdAt?.gte;
              const lte: Date | undefined = query.where?.createdAt?.lte;
              let rows = Array.from(stockReturns.values()).filter(
                (r) => r.workspaceId === wsId && ids.includes(r.productId)
              );
              if (gte) rows = rows.filter((r) => new Date(r.createdAt).getTime() >= gte.getTime());
              if (lte) rows = rows.filter((r) => new Date(r.createdAt).getTime() <= lte.getTime());
              if (query.select) {
                return rows.map((r) => {
                  const picked: any = {};
                  for (const key of Object.keys(query.select)) picked[key] = r[key];
                  return picked;
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

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'consignment-report-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: reportGET } = await import('../src/app/api/v1/inventory/consignment/report/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
    stockMovements = new Map();
    stockReturns = new Map();
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

  function addProduct(wsId: string, p: { id: string; name: string; sku?: string | null; unit?: string; costPrice: number; currentStock: number; ownershipType: string; isActive?: boolean }) {
    products.set(p.id, {
      id: p.id,
      workspaceId: wsId,
      name: p.name,
      sku: p.sku ?? null,
      unit: p.unit ?? 'pcs',
      costPrice: p.costPrice,
      currentStock: p.currentStock,
      ownershipType: p.ownershipType,
      isActive: p.isActive ?? true,
    });
  }

  function addMovement(wsId: string, productId: string, type: string, qtyChange: number, daysAgo: number) {
    seq += 1;
    const id = `sm-${seq}`;
    stockMovements.set(id, {
      id,
      workspaceId: wsId,
      productId,
      type,
      qtyChange,
      createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    });
  }

  function addReturn(wsId: string, productId: string, direction: string, qty: number, daysAgo: number) {
    seq += 1;
    const id = `ret-${seq}`;
    stockReturns.set(id, {
      id,
      workspaceId: wsId,
      productId,
      direction,
      qty,
      createdAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
    });
  }

  test('GET: qtySold dari |SALE_OUT| + amountDueToSupplier = qtySold x costPrice', async () => {
    const { token, wsId } = seedTenant('sold');
    addProduct(wsId, { id: 'prod-1', name: 'Kaos Titip Jual', costPrice: 30000, currentStock: 5, ownershipType: 'CONSIGNED' });
    addMovement(wsId, 'prod-1', 'SALE_OUT', -3, 2);
    addMovement(wsId, 'prod-1', 'SALE_OUT', -2, 5);

    const req = jsonRequest(`https://klir.test/api/v1/inventory/consignment/report`.concat(''), token);
    const res = await reportGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.rows.length, 1);
    assert.equal(body.rows[0].qtySold, 5, '3 + 2 = 5');
    assert.equal(body.rows[0].amountDueToSupplier, 5 * 30000);
    assert.equal(body.totals.qtySold, 5);
    assert.equal(body.totals.amountDueToSupplier, 5 * 30000);
    assert.equal(body.totals.products, 1);
  });

  test('GET: qtyIn dari PURCHASE_IN + RETURN_IN, qtyReturnedToSupplier dari StockReturn TO_SUPPLIER', async () => {
    const { token, wsId } = seedTenant('flows');
    addProduct(wsId, { id: 'prod-1', name: 'Sepatu Titip Jual', costPrice: 80000, currentStock: 4, ownershipType: 'CONSIGNED' });
    addMovement(wsId, 'prod-1', 'PURCHASE_IN', 10, 3);
    addMovement(wsId, 'prod-1', 'RETURN_IN', 2, 4);
    addReturn(wsId, 'prod-1', 'TO_SUPPLIER', 1, 1);

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment/report', token);
    const res = await reportGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.rows[0].qtyIn, 12, '10 + 2 = 12');
    assert.equal(body.rows[0].qtyReturnedToSupplier, 1);
    assert.equal(body.rows[0].currentStock, 4);
  });

  test('GET: produk OWNED tidak ikut, produk CONSIGNED nonaktif tidak ikut', async () => {
    const { token, wsId } = seedTenant('mix2');
    addProduct(wsId, { id: 'prod-consigned', name: 'Kaos Titip Jual', costPrice: 30000, currentStock: 5, ownershipType: 'CONSIGNED' });
    addProduct(wsId, { id: 'prod-owned', name: 'Beras Beli Putus', costPrice: 12000, currentStock: 20, ownershipType: 'OWNED' });
    addProduct(wsId, { id: 'prod-inactive', name: 'Sudah Nonaktif', costPrice: 5000, currentStock: 0, ownershipType: 'CONSIGNED', isActive: false });

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment/report', token);
    const res = await reportGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.rows.length, 1);
    assert.equal(body.rows[0].productId, 'prod-consigned');
  });

  test('GET: zero-data (tidak ada produk konsinyasi) -> rows kosong, bukan error', async () => {
    const { token, wsId } = seedTenant('empty');
    addProduct(wsId, { id: 'prod-owned', name: 'Beras Beli Putus', costPrice: 12000, currentStock: 20, ownershipType: 'OWNED' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment/report', token);
    const res = await reportGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.rows, []);
    assert.equal(body.totals.products, 0);
    assert.equal(body.totals.qtySold, 0);
    assert.equal(body.totals.amountDueToSupplier, 0);
  });

  test('GET: totals dijumlah benar untuk >1 produk', async () => {
    const { token, wsId } = seedTenant('totals');
    addProduct(wsId, { id: 'prod-1', name: 'Produk A', costPrice: 10000, currentStock: 5, ownershipType: 'CONSIGNED' });
    addProduct(wsId, { id: 'prod-2', name: 'Produk B', costPrice: 20000, currentStock: 3, ownershipType: 'CONSIGNED' });
    addMovement(wsId, 'prod-1', 'SALE_OUT', -4, 1);
    addMovement(wsId, 'prod-2', 'SALE_OUT', -1, 1);

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment/report', token);
    const res = await reportGET(req, {} as any);
    const body = await res.json();
    assert.equal(body.totals.products, 2);
    assert.equal(body.totals.qtySold, 5, '4 + 1');
    assert.equal(body.totals.amountDueToSupplier, 4 * 10000 + 1 * 20000);
  });

  test('GET: pergerakan di luar periode (from/to) tidak ikut kehitung', async () => {
    const { token, wsId } = seedTenant('outside-period');
    addProduct(wsId, { id: 'prod-1', name: 'Produk Lama', costPrice: 10000, currentStock: 5, ownershipType: 'CONSIGNED' });
    addMovement(wsId, 'prod-1', 'SALE_OUT', -9, 200); // jauh di luar default 30 hari

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment/report', token);
    const res = await reportGET(req, {} as any);
    const body = await res.json();
    assert.equal(body.rows[0].qtySold, 0, 'pergerakan 200 hari lalu di luar window default 30 hari');
  });

  test('GET: isolasi tenant -- produk workspace lain tidak ikut', async () => {
    const { token, wsId } = seedTenant('victim');
    addProduct(wsId, { id: 'prod-mine', name: 'Punya Saya', costPrice: 10000, currentStock: 5, ownershipType: 'CONSIGNED' });
    addProduct('ws-other', { id: 'prod-other', name: 'Punya Orang Lain', costPrice: 99999, currentStock: 5, ownershipType: 'CONSIGNED' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment/report', token);
    const res = await reportGET(req, {} as any);
    const body = await res.json();
    assert.equal(body.rows.length, 1);
    assert.equal(body.rows[0].productId, 'prod-mine');
  });

  test('GET: parameter "from" tanggal invalid -> 400', async () => {
    const { token } = seedTenant('bad-from');
    const req = jsonRequest('https://klir.test/api/v1/inventory/consignment/report?from=bukan-tanggal', token);
    const res = await reportGET(req, {} as any);
    assert.equal(res.status, 400);
  });
});
