import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Batch/kadaluarsa produk (10 Sep 2026, agent inventory-api-schema,
// kontrak F3b/F4)
// src/app/api/v1/inventory/product-batches/route.ts
//
// Fokus test: (1) isolasi tenant (POST productId workspace lain -> ditolak),
// (2) POST validasi (productId wajib, expiryDate wajib+valid, qty>0),
// (3) POST TIDAK mengubah Product.currentStock, (4) GET urut expiryDate asc,
// (5) GET filter productId, (6) GET filter expiringWithinDays,
// (7) GET expiringSoon menghitung batch <=7 hari dari sekarang,
// (8) GET include product {id,name,sku,unit}.
//
// Pola: in-memory fake Prisma proxy, sama filosofi tests/inventory-products-route.test.ts.
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

function daysFromNow(days: number): string {
  const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

describe('inventory-api-schema: inventory/product-batches', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let batchesGET: typeof import('../src/app/api/v1/inventory/product-batches/route')['GET'];
  let batchesPOST: typeof import('../src/app/api/v1/inventory/product-batches/route')['POST'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let products: Map<string, any>;
  let batches: Map<string, any>;
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
            if (method === 'productBatch.create') {
              seq += 1;
              const id = `batch-${seq}`;
              const record = {
                id,
                createdAt: new Date(Date.now() + seq).toISOString(),
                updatedAt: new Date(Date.now() + seq).toISOString(),
                ...query.data,
              };
              // Normalisasi expiryDate ke Date object, meniru perilaku Prisma
              // (kolom DateTime selalu balik sebagai Date instance).
              record.expiryDate = new Date(record.expiryDate);
              batches.set(id, record);
              return record;
            }
            if (method === 'productBatch.findMany') {
              let rows = Array.from(batches.values()).filter((b) => b.workspaceId === query.where?.workspaceId);
              if (query.where?.productId) {
                rows = rows.filter((b) => b.productId === query.where.productId);
              }
              if (query.where?.expiryDate?.lte) {
                const cutoff = new Date(query.where.expiryDate.lte);
                rows = rows.filter((b) => new Date(b.expiryDate) <= cutoff);
              }
              rows = rows
                .map((b) => ({ ...b, expiryDate: new Date(b.expiryDate) }))
                .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
              if (query.include?.product) {
                rows = rows.map((b) => {
                  const p = products.get(b.productId);
                  return { ...b, product: p ? { id: p.id, name: p.name, sku: p.sku, unit: p.unit } : null };
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
    process.env.JWT_SECRET = 'inventory-product-batches-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: batchesGET, POST: batchesPOST } = await import('../src/app/api/v1/inventory/product-batches/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
    batches = new Map();
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

  test('POST: validasi productId wajib -> 400', async () => {
    const { token } = seedTenant('no-product');
    const req = jsonRequest('https://klir.test/api/v1/inventory/product-batches', token, 'POST', {
      expiryDate: daysFromNow(10),
      qty: 5,
    });
    const res = await batchesPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(batches.size, 0);
  });

  test('POST: validasi expiryDate wajib -> 400', async () => {
    const { token, wsId } = seedTenant('no-expiry');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Susu UHT', sku: 'SU-1', unit: 'kotak', currentStock: 100 });
    const req = jsonRequest('https://klir.test/api/v1/inventory/product-batches', token, 'POST', {
      productId: 'p1',
      qty: 5,
    });
    const res = await batchesPOST(req, {} as any);
    assert.equal(res.status, 400);
  });

  test('POST: expiryDate tidak valid -> 400', async () => {
    const { token, wsId } = seedTenant('bad-expiry');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Susu UHT', currentStock: 100 });
    const req = jsonRequest('https://klir.test/api/v1/inventory/product-batches', token, 'POST', {
      productId: 'p1',
      expiryDate: 'bukan-tanggal',
      qty: 5,
    });
    const res = await batchesPOST(req, {} as any);
    assert.equal(res.status, 400);
  });

  test('POST: qty <= 0 -> 400', async () => {
    const { token, wsId } = seedTenant('bad-qty');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Susu UHT', currentStock: 100 });
    const req = jsonRequest('https://klir.test/api/v1/inventory/product-batches', token, 'POST', {
      productId: 'p1',
      expiryDate: daysFromNow(10),
      qty: 0,
    });
    const res = await batchesPOST(req, {} as any);
    assert.equal(res.status, 400);
  });

  test('POST: productId dari workspace lain -> ditolak (isolasi tenant)', async () => {
    const { token } = seedTenant('victim');
    products.set('p-attacker', { id: 'p-attacker', workspaceId: 'ws-someone-else', name: 'Punya Orang Lain', currentStock: 999 });
    const req = jsonRequest('https://klir.test/api/v1/inventory/product-batches', token, 'POST', {
      productId: 'p-attacker',
      expiryDate: daysFromNow(10),
      qty: 5,
    });
    const res = await batchesPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(batches.size, 0);
  });

  test('POST: batch valid -> 201, currentStock Product TIDAK berubah', async () => {
    const { token, wsId } = seedTenant('happy');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Roti Tawar', sku: 'RT-1', unit: 'bungkus', currentStock: 50 });
    const req = jsonRequest('https://klir.test/api/v1/inventory/product-batches', token, 'POST', {
      productId: 'p1',
      expiryDate: daysFromNow(5),
      qty: 20,
      batchCode: 'BATCH-A',
    });
    const res = await batchesPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.batch.qty, 20);
    assert.equal(body.batch.batchCode, 'BATCH-A');
    assert.equal(body.batch.productId, 'p1');
    assert.equal(products.get('p1').currentStock, 50, 'currentStock TIDAK berubah oleh POST batch');
  });

  test('GET: urut expiryDate ascending (paling dekat kadaluarsa duluan)', async () => {
    const { token, wsId } = seedTenant('order');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', unit: 'pcs' });
    batches.set('b-far', { id: 'b-far', workspaceId: wsId, productId: 'p1', qty: 10, expiryDate: new Date(daysFromNow(60)), batchCode: 'FAR' });
    batches.set('b-near', { id: 'b-near', workspaceId: wsId, productId: 'p1', qty: 5, expiryDate: new Date(daysFromNow(2)), batchCode: 'NEAR' });
    batches.set('b-mid', { id: 'b-mid', workspaceId: wsId, productId: 'p1', qty: 8, expiryDate: new Date(daysFromNow(20)), batchCode: 'MID' });

    const res = await batchesGET(jsonRequest('https://klir.test/api/v1/inventory/product-batches', token, 'GET'), {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.batches.length, 3);
    assert.equal(body.batches[0].batchCode, 'NEAR');
    assert.equal(body.batches[1].batchCode, 'MID');
    assert.equal(body.batches[2].batchCode, 'FAR');
  });

  test('GET: filter productId hanya tampilkan batch produk itu', async () => {
    const { token, wsId } = seedTenant('filter-product');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', unit: 'pcs' });
    products.set('p2', { id: 'p2', workspaceId: wsId, name: 'Produk B', unit: 'pcs' });
    batches.set('b1', { id: 'b1', workspaceId: wsId, productId: 'p1', qty: 10, expiryDate: new Date(daysFromNow(10)) });
    batches.set('b2', { id: 'b2', workspaceId: wsId, productId: 'p2', qty: 5, expiryDate: new Date(daysFromNow(15)) });

    const res = await batchesGET(jsonRequest('https://klir.test/api/v1/inventory/product-batches?productId=p1', token, 'GET'), {} as any);
    const body = await res.json();
    assert.equal(body.batches.length, 1);
    assert.equal(body.batches[0].id, 'b1');
  });

  test('GET: filter expiringWithinDays hanya tampilkan batch dalam rentang itu', async () => {
    const { token, wsId } = seedTenant('filter-days');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', unit: 'pcs' });
    batches.set('b-soon', { id: 'b-soon', workspaceId: wsId, productId: 'p1', qty: 10, expiryDate: new Date(daysFromNow(5)) });
    batches.set('b-later', { id: 'b-later', workspaceId: wsId, productId: 'p1', qty: 10, expiryDate: new Date(daysFromNow(60)) });

    const res = await batchesGET(jsonRequest('https://klir.test/api/v1/inventory/product-batches?expiringWithinDays=30', token, 'GET'), {} as any);
    const body = await res.json();
    assert.equal(body.batches.length, 1);
    assert.equal(body.batches[0].id, 'b-soon');
  });

  test('GET: expiringSoon menghitung batch <=7 hari dari sekarang', async () => {
    const { token, wsId } = seedTenant('expiring-soon');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', unit: 'pcs' });
    batches.set('b-critical', { id: 'b-critical', workspaceId: wsId, productId: 'p1', qty: 10, expiryDate: new Date(daysFromNow(3)) });
    batches.set('b-warning', { id: 'b-warning', workspaceId: wsId, productId: 'p1', qty: 10, expiryDate: new Date(daysFromNow(20)) });

    const res = await batchesGET(jsonRequest('https://klir.test/api/v1/inventory/product-batches?expiringWithinDays=30', token, 'GET'), {} as any);
    const body = await res.json();
    assert.equal(body.batches.length, 2);
    assert.equal(body.expiringSoon, 1, 'cuma b-critical yang <=7 hari');
  });

  test('GET: include product {id,name,sku,unit}', async () => {
    const { token, wsId } = seedTenant('include-product');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Kopi Sachet', sku: 'KS-1', unit: 'pcs', currentStock: 100 });
    batches.set('b1', { id: 'b1', workspaceId: wsId, productId: 'p1', qty: 10, expiryDate: new Date(daysFromNow(10)) });

    const res = await batchesGET(jsonRequest('https://klir.test/api/v1/inventory/product-batches', token, 'GET'), {} as any);
    const body = await res.json();
    assert.equal(body.batches[0].product.name, 'Kopi Sachet');
    assert.equal(body.batches[0].product.sku, 'KS-1');
    assert.equal(body.batches[0].product.unit, 'pcs');
  });

  test('GET: workspace lain tidak ikut tampil (isolasi tenant)', async () => {
    const { token, wsId } = seedTenant('isolate');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk Sendiri', unit: 'pcs' });
    batches.set('b1', { id: 'b1', workspaceId: wsId, productId: 'p1', qty: 10, expiryDate: new Date(daysFromNow(10)) });
    batches.set('b-other', { id: 'b-other', workspaceId: 'ws-other', productId: 'p-other', qty: 999, expiryDate: new Date(daysFromNow(1)) });

    const res = await batchesGET(jsonRequest('https://klir.test/api/v1/inventory/product-batches', token, 'GET'), {} as any);
    const body = await res.json();
    assert.equal(body.batches.length, 1);
    assert.equal(body.batches[0].id, 'b1');
  });
});
