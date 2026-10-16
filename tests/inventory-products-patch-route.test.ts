import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- PATCH produk (10 Sep 2026, agent inventory-api-schema,
// kontrak F3b/F4)
// src/app/api/v1/inventory/products/[id]/route.ts
//
// Fokus test: (1) isolasi tenant (id workspace lain -> 404), (2) update subset
// field TIDAK menyentuh field yang tidak dikirim, (3) SKU duplikat -> 409 +
// tidak menulis apapun, (4) SKU sama dengan diri sendiri (tidak ganti) -> lolos,
// (5) validasi angka negatif ditolak, (6) packSize/packUnit/supplierName bisa
// diubah, (7) isActive bisa dimatikan, (8) body kosong -> 400 (tidak ada field
// untuk diubah), (9) produk tidak ditemukan -> 404.
//
// Pola: in-memory fake Prisma proxy, sama filosofi tests/inventory-products-route.test.ts.
// Jalankan: node --experimental-test-module-mocks --import tsx --test
// ---------------------------------------------------------------------------

function jsonRequest(url: string, token: string, method: 'PATCH', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe('inventory-api-schema: inventory/products/[id] PATCH', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let productsPATCH: typeof import('../src/app/api/v1/inventory/products/[id]/route')['PATCH'];

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
            if (method === 'product.findFirst') {
              // 2 shape berbeda dipakai route: (a) {id, workspaceId} cek eksistensi,
              // (b) {workspaceId, sku, NOT:{id}} pre-check duplikat SKU.
              if (query.where?.id !== undefined && query.where?.sku === undefined) {
                const found = Array.from(products.values()).find(
                  (p) => p.id === query.where.id && p.workspaceId === query.where.workspaceId
                );
                if (!found) return null;
                if (query.select) {
                  const picked: any = {};
                  for (const key of Object.keys(query.select)) picked[key] = found[key];
                  return picked;
                }
                return found;
              }
              if (query.where?.sku !== undefined) {
                const excludeId = query.where?.NOT?.id;
                const found = Array.from(products.values()).find(
                  (p) =>
                    p.workspaceId === query.where.workspaceId &&
                    p.sku === query.where.sku &&
                    p.id !== excludeId
                );
                if (!found) return null;
                if (query.select) {
                  const picked: any = {};
                  for (const key of Object.keys(query.select)) picked[key] = found[key];
                  return picked;
                }
                return found;
              }
              return null;
            }
            if (method === 'product.updateMany') {
              const existing = products.get(query.where.id);
              if (!existing || existing.workspaceId !== query.where.workspaceId) return { count: 0 };
              const updated = { ...existing, ...query.data };
              products.set(existing.id, updated);
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
    process.env.JWT_SECRET = 'inventory-products-patch-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ PATCH: productsPATCH } = await import('../src/app/api/v1/inventory/products/[id]/route'));
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

  function callPatch(token: string, id: string, body: unknown) {
    return productsPATCH(
      jsonRequest(`https://klir.test/api/v1/inventory/products/${id}`, token, 'PATCH', body),
      { params: Promise.resolve({ id }) } as any
    );
  }

  test('PATCH: produk tidak ditemukan -> 404', async () => {
    const { token } = seedTenant('missing');
    const res = await callPatch(token, 'not-exist', { name: 'Baru' });
    assert.equal(res.status, 404);
  });

  test('PATCH: produk workspace lain -> 404 (isolasi tenant)', async () => {
    const { token } = seedTenant('victim');
    products.set('p-attacker', { id: 'p-attacker', workspaceId: 'ws-someone-else', name: 'Punya Orang Lain', sku: null, isActive: true });
    const res = await callPatch(token, 'p-attacker', { name: 'Diubah Attacker' });
    assert.equal(res.status, 404);
    assert.equal(products.get('p-attacker').name, 'Punya Orang Lain', 'TIDAK berubah');
  });

  test('PATCH: body kosong -> 400, tidak ada field untuk diubah', async () => {
    const { token, wsId } = seedTenant('empty-body');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: null, isActive: true });
    const res = await callPatch(token, 'p1', {});
    assert.equal(res.status, 400);
  });

  test('PATCH: name kosong -> 400', async () => {
    const { token, wsId } = seedTenant('bad-name');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: null, isActive: true });
    const res = await callPatch(token, 'p1', { name: '   ' });
    assert.equal(res.status, 400);
    assert.equal(products.get('p1').name, 'Produk A', 'TIDAK berubah');
  });

  test('PATCH: update subset field -- field yang tidak dikirim TIDAK berubah', async () => {
    const { token, wsId } = seedTenant('subset');
    products.set('p1', {
      id: 'p1', workspaceId: wsId, name: 'Kopi Sachet', sku: 'KS-1', category: 'Minuman',
      unit: 'pcs', costPrice: 1000, sellPrice: 1500, minStock: 5, isActive: true,
    });
    const res = await callPatch(token, 'p1', { sellPrice: 2000 });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.product.sellPrice, 2000);
    assert.equal(body.product.name, 'Kopi Sachet', 'name tidak dikirim -- tidak berubah');
    assert.equal(body.product.sku, 'KS-1', 'sku tidak dikirim -- tidak berubah');
    assert.equal(body.product.costPrice, 1000, 'costPrice tidak dikirim -- tidak berubah');
  });

  test('PATCH: costPrice/sellPrice/minStock negatif -> 400', async () => {
    const { token, wsId } = seedTenant('neg-number');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: null, isActive: true, costPrice: 1000 });
    const res = await callPatch(token, 'p1', { costPrice: -500 });
    assert.equal(res.status, 400);
    assert.equal(products.get('p1').costPrice, 1000, 'TIDAK berubah');
  });

  test('PATCH: SKU duplikat produk LAIN di workspace sama -> 409, tidak menulis apapun', async () => {
    const { token, wsId } = seedTenant('dup-sku');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: 'SKU-A', isActive: true });
    products.set('p2', { id: 'p2', workspaceId: wsId, name: 'Produk B', sku: 'SKU-B', isActive: true });
    const res = await callPatch(token, 'p2', { sku: 'SKU-A' });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.match(body.message, /SKU/);
    assert.equal(body.conflictProductId, 'p1');
    assert.equal(products.get('p2').sku, 'SKU-B', 'TIDAK berubah');
  });

  test('PATCH: SKU diubah ke nilai yang sama dengan dirinya sendiri -- lolos (excluded via NOT id)', async () => {
    const { token, wsId } = seedTenant('same-sku');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: 'SKU-A', isActive: true });
    const res = await callPatch(token, 'p1', { sku: 'SKU-A', category: 'Baru' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.product.sku, 'SKU-A');
    assert.equal(body.product.category, 'Baru');
  });

  test('PATCH: sku dikirim null -> hapus SKU (jadi null)', async () => {
    const { token, wsId } = seedTenant('clear-sku');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: 'SKU-A', isActive: true });
    const res = await callPatch(token, 'p1', { sku: null });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.product.sku, null);
  });

  test('PATCH: packSize/packUnit/supplierName bisa diubah', async () => {
    const { token, wsId } = seedTenant('pack');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Rokok Batangan', sku: null, isActive: true, packSize: 1, packUnit: null, supplierName: null });
    const res = await callPatch(token, 'p1', { packSize: 20, packUnit: 'bungkus', supplierName: 'CV Sumber Rejeki' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.product.packSize, 20);
    assert.equal(body.product.packUnit, 'bungkus');
    assert.equal(body.product.supplierName, 'CV Sumber Rejeki');
  });

  test('PATCH: packSize < 1 -> 400', async () => {
    const { token, wsId } = seedTenant('bad-pack');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: null, isActive: true, packSize: 1 });
    const res = await callPatch(token, 'p1', { packSize: 0 });
    assert.equal(res.status, 400);
    assert.equal(products.get('p1').packSize, 1, 'TIDAK berubah');
  });

  test('PATCH: isActive bisa dimatikan (soft-deactivate)', async () => {
    const { token, wsId } = seedTenant('deactivate');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk Discontinue', sku: null, isActive: true });
    const res = await callPatch(token, 'p1', { isActive: false });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.product.isActive, false);
  });

  test('PATCH: supplierName dikirim null -> hapus (jadi null)', async () => {
    const { token, wsId } = seedTenant('clear-supplier');
    products.set('p1', { id: 'p1', workspaceId: wsId, name: 'Produk A', sku: null, isActive: true, supplierName: 'Lama' });
    const res = await callPatch(token, 'p1', { supplierName: null });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.product.supplierName, null);
  });
});
