import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR Inventory -- Penjualan keluar manual/kasir (10 Sep 2026, api-stock-ops, F3 Tingkat B)
// src/app/api/v1/inventory/sales/route.ts
//
// Fokus test: (1) CashTransaction INCOME dibuat dengan amount = totalAmount
// benar, (2) StockMovement SALE_OUT qtyChange negatif per item, sourceId ke
// CashTransaction, (3) currentStock decrement benar, (4) stok kurang -> 400
// tolak SEMUA (tidak ada penulisan parsial), (5) isolasi tenant + produk
// nonaktif ditolak, (6) validasi input dasar, (7) 2 baris item produk sama
// dijumlah untuk cek stok.
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

describe('inventory-sales: inventory/sales', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let salesPOST: typeof import('../src/app/api/v1/inventory/sales/route')['POST'];

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
  // Additive 10 Sep 2026 (Fable) -- kontrak inventory-api-schema, F3b/F4:
  // customerId opsional di POST sales.
  let customersFixture: Map<string, any>;
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
              const requireActive = query.where?.isActive;
              const rows = ids
                .map((id) => products.get(id))
                .filter((p) => p && p.workspaceId === wsId && (requireActive === undefined || p.isActive === requireActive));
              if (query.select) {
                return rows.map((p) => {
                  const picked: any = {};
                  for (const key of Object.keys(query.select)) picked[key] = p[key];
                  return picked;
                });
              }
              return rows;
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
            if (method === 'customer.findFirst') {
              const found = Array.from(customersFixture.values()).find(
                (c) => c.id === query.where?.id && c.workspaceId === query.where?.workspaceId
              );
              if (!found) return null;
              if (query.select) {
                const picked: any = {};
                for (const key of Object.keys(query.select)) picked[key] = found[key];
                return picked;
              }
              return found;
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
    process.env.JWT_SECRET = 'inventory-sales-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: salesPOST } = await import('../src/app/api/v1/inventory/sales/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    products = new Map();
    stockMovements = new Map();
    cashTransactions = new Map();
    customersFixture = new Map();
    seq = 0;
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedTenant(
    idSuffix: string,
    productSeed: Array<{ id: string; currentStock: number; name?: string; costPrice?: number; isActive?: boolean; ownershipType?: string }>
  ) {
    const userId = `user-${idSuffix}`;
    const wsId = `ws-${idSuffix}`;
    users.set(userId, { id: userId, email: `${userId}@example.invalid`, fullName: `Test ${userId}`, isSuperAdmin: false });
    workspaces.set(wsId, { id: wsId, name: `Toko ${idSuffix}`, slug: `toko-${idSuffix}`, ownerId: userId, members: [], resourceGrants: [] });
    for (const p of productSeed) {
      products.set(p.id, {
        id: p.id,
        workspaceId: wsId,
        currentStock: p.currentStock,
        name: p.name ?? p.id,
        costPrice: p.costPrice ?? 1000,
        isActive: p.isActive ?? true,
        ownershipType: p.ownershipType ?? 'OWNED',
      });
    }
    const token = signJwtToken({ userId, workspaceId: wsId });
    return { token, wsId, userId };
  }

  test('POST: produk TITIP JUAL (CONSIGNED) -> INCOME penuh + EXPENSE "Kewajiban Konsinyasi" = qty x costPrice (tambalan komando 10 Sep)', async () => {
    const { token } = seedTenant('cons', [
      { id: 'p-own', currentStock: 10, name: 'Milik Sendiri', costPrice: 1000, ownershipType: 'OWNED' },
      { id: 'p-cons', currentStock: 10, name: 'Titipan Supplier', costPrice: 4000, ownershipType: 'CONSIGNED' },
    ]);
    const res = await salesPOST(jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [
        { productId: 'p-own', qty: 2, unitPrice: 1500 },
        { productId: 'p-cons', qty: 3, unitPrice: 6000 },
      ],
    }));
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.sale.totalAmount, 2 * 1500 + 3 * 6000);
    assert.equal(body.sale.consignmentLiability.amount, 3 * 4000);
    assert.equal(body.sale.consignmentLiability.itemCount, 1);

    const txs = Array.from(cashTransactions.values());
    assert.equal(txs.length, 2, 'INCOME penjualan + EXPENSE kewajiban konsinyasi');
    const income = txs.find((t) => t.type === 'INCOME');
    const liability = txs.find((t) => t.type === 'EXPENSE');
    assert.ok(income && liability);
    assert.equal(income.amount, 2 * 1500 + 3 * 6000);
    assert.equal(liability.amount, 3 * 4000);
    assert.equal(liability.category, 'Kewajiban Konsinyasi');
  });

  test('POST: semua produk OWNED -> hanya 1 CashTransaction (tidak ada kewajiban konsinyasi)', async () => {
    const { token } = seedTenant('own-only', [{ id: 'p1', currentStock: 5, costPrice: 1000 }]);
    const res = await salesPOST(jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'p1', qty: 1, unitPrice: 2000 }],
    }));
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.sale.consignmentLiability.amount, 0);
    assert.equal(cashTransactions.size, 1);
  });

  test('POST: CashTransaction INCOME amount benar + StockMovement SALE_OUT qtyChange negatif + currentStock decrement', async () => {
    const { token, wsId } = seedTenant('happy', [
      { id: 'prod-1', currentStock: 20, name: 'Kopi Sachet', costPrice: 2000 },
      { id: 'prod-2', currentStock: 10, name: 'Gula 1kg', costPrice: 12000 },
    ]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [
        { productId: 'prod-1', qty: 5, unitPrice: 3000 },
        { productId: 'prod-2', qty: 2, unitPrice: 15000 },
      ],
      paymentMethod: 'TUNAI',
      customerName: 'Bu Rina',
    });

    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 201);
    const body = await res.json();

    const expectedTotal = 5 * 3000 + 2 * 15000; // 15000 + 30000 = 45000
    assert.equal(body.sale.totalAmount, expectedTotal);
    assert.equal(body.sale.itemCount, 2);

    assert.equal(cashTransactions.size, 1);
    const cashTx = Array.from(cashTransactions.values())[0];
    assert.equal(cashTx.type, 'INCOME');
    assert.equal(cashTx.amount, expectedTotal);
    assert.equal(cashTx.category, 'Penjualan Stok/Kasir');
    assert.equal(cashTx.workspaceId, wsId);
    assert.match(cashTx.description, /Bu Rina/);
    assert.equal(body.sale.cashTransactionId, cashTx.id);

    assert.equal(products.get('prod-1').currentStock, 15, '20 - 5 = 15');
    assert.equal(products.get('prod-2').currentStock, 8, '10 - 2 = 8');

    assert.equal(stockMovements.size, 2);
    const movements = Array.from(stockMovements.values());
    assert.ok(movements.every((m) => m.type === 'SALE_OUT'));
    assert.ok(movements.every((m) => m.qtyChange < 0), 'SALE_OUT qtyChange harus negatif');
    assert.ok(movements.every((m) => m.sourceType === 'SALE'));
    assert.ok(movements.every((m) => m.sourceId === cashTx.id));
    const mov1 = movements.find((m) => m.productId === 'prod-1');
    assert.equal(mov1.qtyChange, -5);
    assert.equal(mov1.unitCost, 2000, 'unitCost = costPrice produk, bukan unitPrice jual');
  });

  test('POST: stok tidak cukup -> 400, TIDAK ada penulisan parsial', async () => {
    const { token } = seedTenant('insufficient', [{ id: 'prod-1', currentStock: 3, name: 'Roti Tawar' }]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 10, unitPrice: 5000 }],
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /Roti Tawar/);

    assert.equal(products.get('prod-1').currentStock, 3, 'stok TIDAK berubah');
    assert.equal(cashTransactions.size, 0, 'TIDAK ada CashTransaction yang tercipta');
    assert.equal(stockMovements.size, 0, 'TIDAK ada StockMovement yang tercipta');
  });

  test('POST: 2 baris item produk yang sama dijumlah untuk cek stok', async () => {
    const { token } = seedTenant('same-product-twice', [{ id: 'prod-1', currentStock: 5, name: 'Air Mineral' }]);

    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [
        { productId: 'prod-1', qty: 3, unitPrice: 4000 },
        { productId: 'prod-1', qty: 4, unitPrice: 4000 },
      ],
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 400, 'total 3+4=7 > stok 5, harus ditolak walau tiap baris kecil');
    assert.equal(products.get('prod-1').currentStock, 5, 'stok TIDAK berubah');
  });

  test('POST: productId dari workspace lain -> ditolak (isolasi tenant)', async () => {
    const { token } = seedTenant('victim', [{ id: 'prod-victim', currentStock: 10 }]);
    products.set('prod-attacker', { id: 'prod-attacker', workspaceId: 'ws-someone-else', currentStock: 999, name: 'Milik Orang Lain', costPrice: 1000, isActive: true });

    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-attacker', qty: 1, unitPrice: 5000 }],
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-attacker').currentStock, 999, 'stok produk workspace lain TIDAK berubah');
    assert.equal(cashTransactions.size, 0);
  });

  test('POST: produk nonaktif -> ditolak', async () => {
    const { token } = seedTenant('inactive', [{ id: 'prod-1', currentStock: 10, isActive: false }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 1, unitPrice: 5000 }],
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(cashTransactions.size, 0);
  });

  test('POST: items kosong -> 400, tidak menulis apapun', async () => {
    const { token } = seedTenant('empty-items', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', { items: [] });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(cashTransactions.size, 0);
  });

  test('POST: qty <= 0 -> 400', async () => {
    const { token } = seedTenant('bad-qty', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 0, unitPrice: 5000 }],
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(products.get('prod-1').currentStock, 10);
  });

  test('POST: unitPrice negatif -> 400', async () => {
    const { token } = seedTenant('bad-price', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 1, unitPrice: -100 }],
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 400);
  });

  test('POST: default paymentMethod = TUNAI kalau tidak dikirim', async () => {
    const { token } = seedTenant('default-payment', [{ id: 'prod-1', currentStock: 10 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 1, unitPrice: 5000 }],
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 201);
    const cashTx = Array.from(cashTransactions.values())[0];
    assert.equal(cashTx.paymentMethod, 'TUNAI');
  });

  // -------------------------------------------------------------------------
  // Additive 10 Sep 2026 (Fable) -- kontrak inventory-api-schema, F3b/F4:
  // customerId opsional. Soft-relasi ke Customer TERSTRUKTUR, beda dari
  // customerName teks bebas (test lama di atas TETAP jalan tanpa diubah --
  // customerName tidak dihapus/diganti maknanya).
  // -------------------------------------------------------------------------

  test('POST: customerId valid -> StockMovement.customerId terisi + deskripsi kas menyertakan nama customer', async () => {
    const { token, wsId } = seedTenant('with-customer', [{ id: 'prod-1', currentStock: 20, name: 'Rokok Batangan', costPrice: 1000 }]);
    customersFixture.set('cust-1', { id: 'cust-1', workspaceId: wsId, name: 'Warung Bu Rina' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 3, unitPrice: 2000 }],
      customerId: 'cust-1',
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 201);

    assert.equal(stockMovements.size, 1);
    const mov = Array.from(stockMovements.values())[0];
    assert.equal(mov.customerId, 'cust-1');

    const cashTx = Array.from(cashTransactions.values())[0];
    assert.match(cashTx.description, /Warung Bu Rina/);
  });

  test('POST: customerId dari workspace lain -> ditolak (isolasi tenant), TIDAK ada penulisan parsial', async () => {
    const { token } = seedTenant('customer-other-ws', [{ id: 'prod-1', currentStock: 20 }]);
    customersFixture.set('cust-attacker', { id: 'cust-attacker', workspaceId: 'ws-someone-else', name: 'Pelanggan Orang Lain' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 1, unitPrice: 2000 }],
      customerId: 'cust-attacker',
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(stockMovements.size, 0, 'TIDAK ada StockMovement tertulis');
    assert.equal(cashTransactions.size, 0, 'TIDAK ada CashTransaction tertulis');
    assert.equal(products.get('prod-1').currentStock, 20, 'stok TIDAK berubah');
  });

  test('POST: customerId tidak ditemukan (id acak) -> ditolak', async () => {
    const { token } = seedTenant('customer-missing', [{ id: 'prod-1', currentStock: 20 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 1, unitPrice: 2000 }],
      customerId: 'cust-does-not-exist',
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 400);
    assert.equal(cashTransactions.size, 0);
  });

  test('POST: tanpa customerId -> StockMovement.customerId null, perilaku lama TIDAK berubah', async () => {
    const { token } = seedTenant('no-customer', [{ id: 'prod-1', currentStock: 20 }]);
    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 1, unitPrice: 2000 }],
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 201);
    const mov = Array.from(stockMovements.values())[0];
    assert.equal(mov.customerId, null);
  });

  test('POST: customerId + customerName dikirim bersamaan -- deskripsi kas pakai nama Customer terstruktur, bukan teks bebas', async () => {
    const { token, wsId } = seedTenant('both-customer-fields', [{ id: 'prod-1', currentStock: 20 }]);
    customersFixture.set('cust-1', { id: 'cust-1', workspaceId: wsId, name: 'Toko Terdaftar' });

    const req = jsonRequest('https://klir.test/api/v1/inventory/sales', token, 'POST', {
      items: [{ productId: 'prod-1', qty: 1, unitPrice: 2000 }],
      customerId: 'cust-1',
      customerName: 'Nama Teks Bebas Beda',
    });
    const res = await salesPOST(req, {} as any);
    assert.equal(res.status, 201);
    const cashTx = Array.from(cashTransactions.values())[0];
    assert.match(cashTx.description, /Toko Terdaftar/);
    assert.doesNotMatch(cashTx.description, /Nama Teks Bebas Beda/);
  });
});
