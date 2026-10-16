import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Produk (10 Sep 2026, agent api-inventory-read)
// src/app/api/v1/inventory/products/route.ts
//
// Fokus test: (1) isolasi tenant (GET/POST hanya lihat/ubah workspace sendiri),
// (2) summary.stockValue & lowStockCount dihitung benar dari populasi penuh
// produk aktif (bukan cuma halaman yang sedang ditampilkan), (3) POST validasi
// (name wajib, angka >=0), (4) POST openingStock>0 -> StockMovement
// OPENING_BALANCE tertulis dalam transaksi yang sama, (5) invalidateContextCache
// dipanggil best-effort setelah create sukses.
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

describe('api-inventory-read: inventory/products', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let productsGET: typeof import('../src/app/api/v1/inventory/products/route')['GET'];
  let productsPOST: typeof import('../src/app/api/v1/inventory/products/route')['POST'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let products: Map<string, any>;
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
            if (method === 'product.count') {
              return matchProducts(query.where).length;
            }
            if (method === 'product.findMany') {
              let rows = matchProducts(query.where);
              rows = rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
            if (method === 'product.findFirst') {
              // Pre-check SKU duplikat (F1, 10 Sep): where { workspaceId, sku }
              const rows = matchProducts(query.where).filter((p) => p.sku === query.where?.sku);
              const found = rows[0] ?? null;
              if (!found) return null;
              if (query.select) {
                const picked: any = {};
                for (const key of Object.keys(query.select)) picked[key] = found[key];
                return picked;
              }
              return found;
            }
            if (method === 'product.create') {
              seq += 1;
              const id = `prod-${seq}`;
              const record = {
                id,
                createdAt: new Date().toISOString(),
                isActive: true,
                ...query.data,
              };
              products.set(id, record);
              return record;
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

  function matchProducts(where: any): any[] {
    let rows = Array.from(products.values()).filter((p) => p.workspaceId === where?.workspaceId);
    if (where?.isActive !== undefined) {
      rows = rows.filter((p) => p.isActive === where.isActive);
    }
    if (where?.OR) {
      const q = (where.OR[0]?.name?.contains ?? '').toLowerCase();
      rows = rows.filter(
        (p) =>
          (p.name ?? '').toLowerCase().includes(q) ||
          (p.sku ?? '').toLowerCase().includes(q)
      );
    }
    return rows;
  }

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'inventory-products-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: productsGET, POST: productsPOST } = await import('../src/app/api/v1/inventory/products/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
    stockMovements = new Map();
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

  test('GET: list produk workspace sendiri saja + isolasi tenant', async () => {
    const { token, wsId } = seedTenant('list');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: 'A1', unit: 'pcs', currentStock: 10, minStock: 2, costPrice: 1000, sellPrice: 1500, isActive: true, createdAt: '2026-09-01' });
    products.set('p-other', { id: 'p-other', workspaceId: 'ws-other', name: 'Bukan Punyaku', unit: 'pcs', currentStock: 999, minStock: 0, costPrice: 1, sellPrice: 1, isActive: true, createdAt: '2026-09-01' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/products?page=1&limit=10', token, 'GET');
    const res = await productsGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.products.length, 1);
    assert.equal(body.products[0].id, 'p1');
  });

  test('GET: summary.stockValue & lowStockCount dihitung benar dari SEMUA produk aktif (bukan cuma 1 halaman)', async () => {
    const { token, wsId } = seedTenant('summary');
    // 3 produk aktif: 2 di bawah minimum, 1 aman. limit=1 supaya "products" hasil
    // halaman cuma 1 baris -- summary tetap harus menghitung dari populasi penuh.
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Beras', unit: 'kg', currentStock: 5, minStock: 10, costPrice: 12000, sellPrice: 15000, isActive: true, createdAt: '2026-09-03' });
    products.set('p2', { id: 'p2', workspaceId: wsId, name: 'Gula', unit: 'kg', currentStock: 3, minStock: 5, costPrice: 14000, sellPrice: 17000, isActive: true, createdAt: '2026-09-02' });
    products.set('p3', { id: 'p3', workspaceId: wsId, name: 'Minyak', unit: 'liter', currentStock: 50, minStock: 10, costPrice: 20000, sellPrice: 25000, isActive: true, createdAt: '2026-09-01' });
    // Produk nonaktif TIDAK ikut dihitung ke summary
    products.set('p4', { id: 'p4', workspaceId: wsId, name: 'Sudah Discontinue', unit: 'pcs', currentStock: 0, minStock: 5, costPrice: 1000, sellPrice: 1000, isActive: false, createdAt: '2026-09-01' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/products?page=1&limit=1', token, 'GET');
    const res = await productsGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();

    assert.equal(body.products.length, 1, 'halaman hasil tetap dibatasi limit');
    assert.equal(body.summary.activeCount, 3);
    const expectedStockValue = 5 * 12000 + 3 * 14000 + 50 * 20000;
    assert.equal(body.summary.stockValue, expectedStockValue);
    assert.equal(body.summary.lowStockCount, 2, 'p1 dan p2 currentStock <= minStock');
    assert.ok(body.summary.lowStock.some((p: any) => p.id === 'p1'));
    assert.ok(body.summary.lowStock.some((p: any) => p.id === 'p2'));
    assert.ok(!body.summary.lowStock.some((p: any) => p.id === 'p3'), 'p3 aman, tidak masuk lowStock');
  });

  test('POST: validasi name kosong -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('no-name');
    const req = jsonRequest('https://klir.test/api/v1/inventory/products', token, 'POST', { name: '' });
    const res = await productsPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.size, 0);
  });

  test('POST: produk baru tanpa openingStock -> 201, TIDAK ada StockMovement', async () => {
    const { token, wsId } = seedTenant('no-opening');
    const req = jsonRequest('https://klir.test/api/v1/inventory/products', token, 'POST', {
      name: 'Kopi Sachet',
      unit: 'pcs',
      costPrice: 2000,
      sellPrice: 3000,
      minStock: 10,
    });
    const res = await productsPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.product.name, 'Kopi Sachet');
    assert.equal(body.product.workspaceId, wsId);
    assert.equal(body.product.currentStock, 0);
    assert.equal(stockMovements.size, 0, 'openingStock 0 -- tidak ada movement');
  });

  test('POST: produk baru dengan openingStock>0 -> StockMovement OPENING_BALANCE tertulis dalam transaksi yang sama', async () => {
    const { token, wsId } = seedTenant('with-opening');
    const req = jsonRequest('https://klir.test/api/v1/inventory/products', token, 'POST', {
      name: 'Beras 5kg',
      sku: 'BRS-5',
      unit: 'karung',
      costPrice: 60000,
      sellPrice: 75000,
      minStock: 5,
      openingStock: 20,
    });
    const res = await productsPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.product.currentStock, 20);

    assert.equal(stockMovements.size, 1);
    const mov = Array.from(stockMovements.values())[0];
    assert.equal(mov.type, 'OPENING_BALANCE');
    assert.equal(mov.qtyChange, 20);
    assert.equal(mov.productId, body.product.id);
    assert.equal(mov.workspaceId, wsId);
    assert.equal(mov.unitCost, 60000);
  });

  test('POST: SKU sama di workspace yang sama -> 409 + pesan menyebut produk pemilik, tidak menulis apapun (F1 10 Sep)', async () => {
    const { token, wsId } = seedTenant('a');
    const first = await productsPOST(jsonRequest('http://localhost/api/v1/inventory/products', token, 'POST', { name: 'Kopi Susu', sku: 'KS-001' }));
    assert.equal(first.status, 201);
    const before = products.size;

    const dup = await productsPOST(jsonRequest('http://localhost/api/v1/inventory/products', token, 'POST', { name: 'Kopi Susu Baru', sku: 'KS-001' }));
    assert.equal(dup.status, 409);
    const body = await dup.json();
    assert.match(body.message, /SKU/);
    assert.match(body.message, /Kopi Susu/);
    assert.equal(typeof body.conflictProductId, 'string');
    assert.equal(products.size, before, 'produk duplikat tidak boleh tertulis');
    assert.equal(Array.from(products.values()).filter((p) => p.workspaceId === wsId).length, 1);
  });

  test('POST: SKU sama tapi workspace BEDA -> 201 (isolasi tenant, constraint per workspace)', async () => {
    const a = seedTenant('a');
    const b = seedTenant('b');
    const r1 = await productsPOST(jsonRequest('http://localhost/api/v1/inventory/products', a.token, 'POST', { name: 'Produk A', sku: 'SAMA-01' }));
    const r2 = await productsPOST(jsonRequest('http://localhost/api/v1/inventory/products', b.token, 'POST', { name: 'Produk B', sku: 'SAMA-01' }));
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
  });

  test('POST: SKU beda huruf besar-kecil ("ks-001" vs "KS-001") dianggap BERBEDA -- sama persis dengan constraint Postgres, tanpa normalisasi diam-diam', async () => {
    const { token } = seedTenant('a');
    const r1 = await productsPOST(jsonRequest('http://localhost/api/v1/inventory/products', token, 'POST', { name: 'P1', sku: 'KS-001' }));
    const r2 = await productsPOST(jsonRequest('http://localhost/api/v1/inventory/products', token, 'POST', { name: 'P2', sku: 'ks-001' }));
    assert.equal(r1.status, 201);
    assert.equal(r2.status, 201);
  });

  // ---------------------------------------------------------------------------
  // Additive 10 Sep 2026 (Fable) -- kontrak inventory-api-schema, F3b/F4:
  // packSize/packUnit/supplierName opsional di POST products.
  // ---------------------------------------------------------------------------

  test('POST: packSize/packUnit/supplierName dikirim -> tersimpan apa adanya', async () => {
    const { token } = seedTenant('pack-fields');
    const req = jsonRequest('https://klir.test/api/v1/inventory/products', token, 'POST', {
      name: 'Rokok Batangan',
      packSize: 20,
      packUnit: 'bungkus',
      supplierName: 'CV Sumber Rejeki',
    });
    const res = await productsPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.product.packSize, 20);
    assert.equal(body.product.packUnit, 'bungkus');
    assert.equal(body.product.supplierName, 'CV Sumber Rejeki');
  });

  test('POST: packSize tidak dikirim -> default 1 (konsisten default schema, perilaku lama tidak berubah)', async () => {
    const { token } = seedTenant('pack-default');
    const req = jsonRequest('https://klir.test/api/v1/inventory/products', token, 'POST', { name: 'Produk Biasa' });
    const res = await productsPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.product.packSize, 1);
    assert.equal(body.product.packUnit, null);
    assert.equal(body.product.supplierName, null);
  });

  test('POST: packSize 0 atau negatif -> fallback ke 1 (tidak boleh packSize < 1)', async () => {
    const { token } = seedTenant('pack-invalid');
    const req = jsonRequest('https://klir.test/api/v1/inventory/products', token, 'POST', {
      name: 'Produk Aneh',
      packSize: -5,
    });
    const res = await productsPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.product.packSize, 1);
  });

  test('POST: angka negatif (costPrice) -> fallback ke 0, tidak error', async () => {
    const { token } = seedTenant('neg-cost');
    const req = jsonRequest('https://klir.test/api/v1/inventory/products', token, 'POST', {
      name: 'Produk Angka Aneh',
      costPrice: -500,
      sellPrice: -100,
      minStock: -1,
      openingStock: -5,
    });
    const res = await productsPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.product.costPrice, 0);
    assert.equal(body.product.sellPrice, 0);
    assert.equal(body.product.minStock, 0);
    assert.equal(body.product.currentStock, 0, 'openingStock negatif fallback ke 0 -- tidak boleh stok minus');
    assert.equal(stockMovements.size, 0);
  });
});
