import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Pelanggan/Outlet (10 Sep 2026, agent inventory-api-schema,
// kontrak F3b/F4 Distributor)
// src/app/api/v1/inventory/customers/route.ts
//
// Fokus test: (1) isolasi tenant (GET/POST hanya lihat/ubah workspace sendiri),
// (2) POST validasi name wajib, (3) POST type dinormalkan ke WARUNG/TOKO/LAINNYA
// (nilai tidak dikenal -> LAINNYA), (4) GET pencarian q by nama/area/phone,
// (5) pagination dasar.
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

describe('inventory-api-schema: inventory/customers', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let customersGET: typeof import('../src/app/api/v1/inventory/customers/route')['GET'];
  let customersPOST: typeof import('../src/app/api/v1/inventory/customers/route')['POST'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let customers: Map<string, any>;
  let seq: number;

  function matchCustomers(where: any): any[] {
    let rows = Array.from(customers.values()).filter((c) => c.workspaceId === where?.workspaceId);
    if (where?.OR) {
      const q = (where.OR[0]?.name?.contains ?? '').toLowerCase();
      rows = rows.filter(
        (c) =>
          (c.name ?? '').toLowerCase().includes(q) ||
          (c.area ?? '').toLowerCase().includes(q) ||
          (c.phone ?? '').toLowerCase().includes(q)
      );
    }
    return rows;
  }

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
            if (method === 'customer.count') {
              return matchCustomers(query.where).length;
            }
            if (method === 'customer.findMany') {
              let rows = matchCustomers(query.where);
              rows = rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
              const skip = query.skip ?? 0;
              const take = query.take ?? rows.length;
              return rows.slice(skip, skip + take);
            }
            if (method === 'customer.create') {
              seq += 1;
              const id = `cust-${seq}`;
              const record = { id, createdAt: new Date(Date.now() + seq).toISOString(), isActive: true, ...query.data };
              customers.set(id, record);
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
    process.env.JWT_SECRET = 'inventory-customers-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: customersGET, POST: customersPOST } = await import('../src/app/api/v1/inventory/customers/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    customers = new Map();
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

  test('POST: validasi name kosong -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('no-name');
    const req = jsonRequest('https://klir.test/api/v1/inventory/customers', token, 'POST', { name: '  ' });
    const res = await customersPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(customers.size, 0);
  });

  test('POST: pelanggan baru dengan field lengkap -> 201, type dipakai apa adanya kalau valid', async () => {
    const { token, wsId } = seedTenant('full');
    const req = jsonRequest('https://klir.test/api/v1/inventory/customers', token, 'POST', {
      name: 'Toko Berkah',
      phone: '0812345',
      address: 'Jl. Mawar 1',
      area: 'Depok',
      type: 'toko',
      notes: 'Langganan tiap Senin',
    });
    const res = await customersPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.customer.name, 'Toko Berkah');
    assert.equal(body.customer.workspaceId, wsId);
    assert.equal(body.customer.type, 'TOKO', 'dinormalkan uppercase');
    assert.equal(body.customer.area, 'Depok');
  });

  test('POST: type tidak dikenal -> fallback LAINNYA', async () => {
    const { token } = seedTenant('unknown-type');
    const req = jsonRequest('https://klir.test/api/v1/inventory/customers', token, 'POST', {
      name: 'Bu Sari',
      type: 'GROSIR',
    });
    const res = await customersPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.customer.type, 'LAINNYA');
  });

  test('POST: type tidak dikirim -> default LAINNYA', async () => {
    const { token } = seedTenant('default-type');
    const req = jsonRequest('https://klir.test/api/v1/inventory/customers', token, 'POST', { name: 'Warung Pak Budi' });
    const res = await customersPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.customer.type, 'LAINNYA');
  });

  test('GET: list pelanggan workspace sendiri saja + isolasi tenant', async () => {
    const { token, wsId } = seedTenant('list');
    customers.set('c1', { id: 'c1', workspaceId: wsId, name: 'Warung A', area: 'Bekasi', phone: '08111', createdAt: '2026-09-01' });
    customers.set('c-other', { id: 'c-other', workspaceId: 'ws-other', name: 'Bukan Punyaku', area: 'Depok', phone: '08222', createdAt: '2026-09-01' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/customers?page=1&limit=10', token, 'GET');
    const res = await customersGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.pagination.total, 1);
    assert.equal(body.customers.length, 1);
    assert.equal(body.customers[0].id, 'c1');
  });

  test('GET: pencarian q cocok ke nama, area, atau phone', async () => {
    const { token, wsId } = seedTenant('search');
    customers.set('c1', { id: 'c1', workspaceId: wsId, name: 'Toko Maju', area: 'Bekasi', phone: '0811', createdAt: '2026-09-01' });
    customers.set('c2', { id: 'c2', workspaceId: wsId, name: 'Warung Sejahtera', area: 'Depok', phone: '0822', createdAt: '2026-09-02' });

    const byArea = await customersGET(jsonRequest('https://klir.test/api/v1/inventory/customers?q=depok', token, 'GET'), {} as any);
    const byAreaBody = await byArea.json();
    assert.equal(byAreaBody.customers.length, 1);
    assert.equal(byAreaBody.customers[0].id, 'c2');

    const byName = await customersGET(jsonRequest('https://klir.test/api/v1/inventory/customers?q=maju', token, 'GET'), {} as any);
    const byNameBody = await byName.json();
    assert.equal(byNameBody.customers.length, 1);
    assert.equal(byNameBody.customers[0].id, 'c1');
  });

  test('GET: pagination membatasi jumlah hasil per halaman', async () => {
    const { token, wsId } = seedTenant('paginate');
    for (let i = 1; i <= 5; i += 1) {
      customers.set(`c${i}`, { id: `c${i}`, workspaceId: wsId, name: `Toko ${i}`, createdAt: `2026-09-0${i}` });
    }
    const req = jsonRequest('https://klir.test/api/v1/inventory/customers?page=1&limit=2', token, 'GET');
    const res = await customersGET(req, {} as any);
    const body = await res.json();
    assert.equal(body.customers.length, 2);
    assert.equal(body.pagination.total, 5);
    assert.equal(body.pagination.totalPages, 3);
  });

  test('POST: field opsional kosong -> null, bukan string kosong', async () => {
    const { token } = seedTenant('minimal');
    const req = jsonRequest('https://klir.test/api/v1/inventory/customers', token, 'POST', { name: 'Pelanggan Minimal' });
    const res = await customersPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.customer.phone, null);
    assert.equal(body.customer.address, null);
    assert.equal(body.customer.area, null);
    assert.equal(body.customer.notes, null);
  });
});
