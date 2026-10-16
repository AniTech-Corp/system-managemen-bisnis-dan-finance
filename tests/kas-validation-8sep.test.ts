import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// B4 TESTS -- V4f: validasi ringan kas/invoices + kas/transactions POST
// (8 Sep 2026, kasus Pak Fajrul: nama klien angka semua, harga negatif,
// tanggal tidak masuk akal). Pola fake-Prisma-Proxy + real-signed-JWT + real
// withTenantGuard SAMA PERSIS tests/extract-text-ledger-wiring.test.ts (kedua
// endpoint kas dibungkus withTenantGuard yang sama).
//
// PENYIMPANGAN JUJUR dari draft kontrak awal (dicatat eksplisit): draft
// kontrak menyebut skenario "(b) item price=0 -> 400". Dibaca ULANG dari
// disk (src/app/api/v1/kas/invoices/route.ts, 8 Sep 2026) -- kode FINAL
// menolak harga NEGATIF (`price < 0`), BUKAN `price <= 0` -- harga 0 (item
// bonus/gratis) tetap SAH lolos 200, sesuai temuan kritik sesi ini (menolak
// `<=0` akan meregresi pola input lama yang sah, lihat "bantahan #4" di
// kritik). Test di bawah mengikuti perilaku FINAL: harga NEGATIF -> 400,
// harga 0 -> TETAP 200 (regresi nol untuk item bonus).
// ---------------------------------------------------------------------------

describe('V4f kas/invoices + kas/transactions -- validasi ringan input keuangan', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let invoicesPOST: typeof import('../src/app/api/v1/kas/invoices/route')['POST'];
  let transactionsPOST: typeof import('../src/app/api/v1/kas/transactions/route')['POST'];

  type Query = { where?: Record<string, unknown>; data?: Record<string, unknown>; select?: unknown; include?: unknown };
  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let handlers: Record<string, (query: Query) => unknown>;
  let createdInvoices: Array<Record<string, unknown>>;
  let createdTransactions: Array<Record<string, unknown>>;

  const fakePrisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      if (model.startsWith('$')) return async () => { throw new Error(`Forbidden Prisma operation: ${model}`); };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: Query) => {
            const method = `${model}.${operation}`;
            const handler = handlers[method];
            if (!handler) throw new Error(`Forbidden Prisma operation: ${method}`);
            return handler(query);
          };
        },
      });
    },
  });

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'kas-validation-tests-only-secret-8sep-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: invoicesPOST } = await import('../src/app/api/v1/kas/invoices/route'));
    ({ POST: transactionsPOST } = await import('../src/app/api/v1/kas/transactions/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    handlers = {};
    createdInvoices = [];
    createdTransactions = [];
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedUser(id: string) {
    const user = { id, email: `${id}@example.invalid`, fullName: `Test ${id}`, isSuperAdmin: false };
    users.set(id, user);
    handlers['user.findUnique'] = (query) => users.get((query.where?.id as string) ?? '') ?? null;
  }

  function seedWorkspace(ws: WorkspaceFixture) {
    workspaces.set(ws.id, ws);
    handlers['workspace.findUnique'] = (query) => {
      const found = workspaces.get((query.where?.id as string) ?? '');
      if (!found) return null;
      return { id: found.id, name: found.name, slug: found.slug, ownerId: found.ownerId, members: found.members, resourceGrants: found.resourceGrants };
    };
  }

  function seedInvoiceCreate() {
    handlers['invoice.create'] = (query) => {
      const data = query.data ?? {};
      const record = { id: `inv-${createdInvoices.length + 1}`, invoiceNumber: `INV-TEST-${createdInvoices.length + 1}`, ...data };
      createdInvoices.push(record);
      return record;
    };
  }

  function seedTransactionCreate() {
    handlers['cashTransaction.create'] = (query) => {
      const data = query.data ?? {};
      const record = { id: `tx-${createdTransactions.length + 1}`, ...data };
      createdTransactions.push(record);
      return record;
    };
  }

  function jsonRequest(url: string, token: string, body: Record<string, unknown>) {
    return new NextRequest(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function setupTenant(userId: string, wsId: string) {
    seedUser(userId);
    seedWorkspace({ id: wsId, name: `Toko ${wsId}`, slug: wsId, ownerId: userId, members: [], resourceGrants: [] });
    return signJwtToken({ userId, workspaceId: wsId });
  }

  const validItems = [{ name: 'Jasa Konsultasi', price: 500000, qty: 1 }];

  // -- kas/invoices POST ------------------------------------------------------

  describe('kas/invoices POST', () => {
    test('(a) nama klien angka semua ("12345") -> 400, pesan menyebut nama klien', async () => {
      const token = await setupTenant('user-inv-a', 'ws-inv-a');
      seedInvoiceCreate();
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, { clientName: '12345', items: validItems })
      );
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.message, /[Nn]ama klien/);
      assert.equal(createdInvoices.length, 0, 'invoice tidak boleh sampai dibuat kalau validasi gagal');
    });

    test('nama klien wajar (bukan angka semua) -> TETAP 200 (regresi nol)', async () => {
      const token = await setupTenant('user-inv-a2', 'ws-inv-a2');
      seedInvoiceCreate();
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, { clientName: 'Toko Rejeki Baru', items: validItems })
      );
      assert.equal(res.status, 200);
    });

    test('(b) harga item NEGATIF -> 400', async () => {
      const token = await setupTenant('user-inv-b', 'ws-inv-b');
      seedInvoiceCreate();
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, {
          clientName: 'Toko Sukses Mandiri',
          items: [{ name: 'Diskon salah ketik', price: -50000, qty: 1 }],
        })
      );
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.message, /tidak boleh negatif/);
    });

    test('harga item TEPAT 0 (item bonus/gratis) -> TETAP 200 (regresi nol, bukan `<=0`)', async () => {
      const token = await setupTenant('user-inv-b2', 'ws-inv-b2');
      seedInvoiceCreate();
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, {
          clientName: 'Toko Sukses Mandiri',
          items: [{ name: 'Item Bonus', price: 0, qty: 1 }],
        })
      );
      assert.equal(res.status, 200, 'harga 0 (bonus/gratis) harus tetap sah, sesuai pola input lama');
    });

    test('qty item 0 -> 400 (qty 0 tidak masuk akal secara bisnis)', async () => {
      const token = await setupTenant('user-inv-b3', 'ws-inv-b3');
      seedInvoiceCreate();
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, {
          clientName: 'Toko Sukses Mandiri',
          items: [{ name: 'Barang', price: 10000, qty: 0 }],
        })
      );
      assert.equal(res.status, 400);
    });

    test('(c) dueDate format tidak valid ("bukan-tanggal") -> 400', async () => {
      const token = await setupTenant('user-inv-c', 'ws-inv-c');
      seedInvoiceCreate();
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, {
          clientName: 'Toko Maju Jaya',
          items: validItems,
          dueDate: 'bukan-tanggal',
        })
      );
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.message, /[Tt]idak valid/);
    });

    test('(d) dueDate tahun 1990 (sebelum 2000) -> 400', async () => {
      const token = await setupTenant('user-inv-d', 'ws-inv-d');
      seedInvoiceCreate();
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, {
          clientName: 'Toko Maju Jaya',
          items: validItems,
          dueDate: '1990-01-01',
        })
      );
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.message, /sebelum tahun 2000/);
    });

    test('dueDate lebih dari 1 tahun ke depan -> 400', async () => {
      const token = await setupTenant('user-inv-d2', 'ws-inv-d2');
      seedInvoiceCreate();
      const farFuture = new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, {
          clientName: 'Toko Maju Jaya',
          items: validItems,
          dueDate: farFuture,
        })
      );
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.message, /1 tahun ke depan/);
    });

    test('(e) dueDate wajar (30 hari ke depan) -> TETAP 200', async () => {
      const token = await setupTenant('user-inv-e', 'ws-inv-e');
      seedInvoiceCreate();
      const wajar = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, { clientName: 'Toko Maju Jaya', items: validItems, dueDate: wajar })
      );
      assert.equal(res.status, 200);
    });

    test('(e) dueDate ABSEN -> TETAP 200, default +7 hari existing tidak berubah (regresi nol)', async () => {
      const token = await setupTenant('user-inv-e2', 'ws-inv-e2');
      seedInvoiceCreate();
      const res = await invoicesPOST(
        jsonRequest('https://klir.test/api/v1/kas/invoices', token, { clientName: 'Toko Maju Jaya', items: validItems })
      );
      assert.equal(res.status, 200);
      assert.equal(createdInvoices.length, 1);
      const dueDate = createdInvoices[0].dueDate as Date;
      const daysFromNow = Math.round((dueDate.getTime() - Date.now()) / (24 * 3600 * 1000));
      assert.ok(daysFromNow >= 6 && daysFromNow <= 8, `default dueDate harus ~7 hari ke depan, got ${daysFromNow} hari`);
    });

    test('payload dasar tidak lengkap (tanpa clientName/items) -> tetap 400 seperti sebelum V4f (perilaku lama)', async () => {
      const token = await setupTenant('user-inv-f', 'ws-inv-f');
      seedInvoiceCreate();
      const res = await invoicesPOST(jsonRequest('https://klir.test/api/v1/kas/invoices', token, { clientName: '', items: [] }));
      assert.equal(res.status, 400);
    });
  });

  // -- kas/transactions POST ---------------------------------------------------

  describe('kas/transactions POST', () => {
    const validBody = { type: 'INCOME', category: 'Penjualan', amount: 250000, description: 'Penjualan harian' };

    test('(f) transactionDate format tidak valid ("xxxx") -> 400', async () => {
      const token = await setupTenant('user-tx-f', 'ws-tx-f');
      seedTransactionCreate();
      const res = await transactionsPOST(
        jsonRequest('https://klir.test/api/v1/kas/transactions', token, { ...validBody, transactionDate: 'xxxx' })
      );
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.message, /[Tt]idak valid/);
    });

    test('transactionDate tahun 1990 (sebelum 2000) -> 400', async () => {
      const token = await setupTenant('user-tx-f2', 'ws-tx-f2');
      seedTransactionCreate();
      const res = await transactionsPOST(
        jsonRequest('https://klir.test/api/v1/kas/transactions', token, { ...validBody, transactionDate: '1990-05-05' })
      );
      assert.equal(res.status, 400);
    });

    test('transactionDate lebih dari 1 tahun ke depan -> 400', async () => {
      const token = await setupTenant('user-tx-f3', 'ws-tx-f3');
      seedTransactionCreate();
      const farFuture = new Date(Date.now() + 400 * 24 * 3600 * 1000).toISOString();
      const res = await transactionsPOST(
        jsonRequest('https://klir.test/api/v1/kas/transactions', token, { ...validBody, transactionDate: farFuture })
      );
      assert.equal(res.status, 400);
    });

    test('(g) transactionDate wajar (kemarin) -> TETAP 200', async () => {
      const token = await setupTenant('user-tx-g', 'ws-tx-g');
      seedTransactionCreate();
      const kemarin = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const res = await transactionsPOST(
        jsonRequest('https://klir.test/api/v1/kas/transactions', token, { ...validBody, transactionDate: kemarin })
      );
      assert.equal(res.status, 200);
    });

    test('(g) transactionDate BACKFILL 2 tahun lalu (tapi masih >=2000) -> TETAP 200 (jaring pengaman anti "polaritas kebalik")', async () => {
      const token = await setupTenant('user-tx-g2', 'ws-tx-g2');
      seedTransactionCreate();
      const duaTahunLalu = new Date();
      duaTahunLalu.setFullYear(duaTahunLalu.getFullYear() - 2);
      const res = await transactionsPOST(
        jsonRequest('https://klir.test/api/v1/kas/transactions', token, { ...validBody, transactionDate: duaTahunLalu.toISOString() })
      );
      assert.equal(res.status, 200, 'transaksi backfill 2 tahun lalu (masih >=2000) TIDAK boleh ditolak -- cek polaritas checkBusinessDate');
    });

    test('(g) transactionDate ABSEN -> TETAP 200, default new Date() existing tidak berubah (regresi nol)', async () => {
      const token = await setupTenant('user-tx-g3', 'ws-tx-g3');
      seedTransactionCreate();
      const res = await transactionsPOST(jsonRequest('https://klir.test/api/v1/kas/transactions', token, validBody));
      assert.equal(res.status, 200);
    });

    test('(h) amount=0 tetap 400 (perilaku LAMA -- amount=0 falsy, kena guard field-wajib generik lebih dulu, BUKAN pesan V4f)', async () => {
      const token = await setupTenant('user-tx-h', 'ws-tx-h');
      seedTransactionCreate();
      const res = await transactionsPOST(
        jsonRequest('https://klir.test/api/v1/kas/transactions', token, { ...validBody, amount: 0 })
      );
      // CATATAN: `amount: 0` sudah 400 SEBELUM V4f ada -- guard `!amount` di baris
      // pertama route (perilaku LAMA, tidak disentuh V4f) menganggap 0 falsy dan
      // menolaknya lewat pesan generik "wajib diisi", BUKAN pesan spesifik
      // "harus lebih besar dari 0" (baris kedua tidak pernah tercapai untuk 0).
      // Test ini memverifikasi status 400 tetap terjaga (bukan isi pesannya).
      assert.equal(res.status, 400);
    });

    test('(h) amount NEGATIF tetap 400 dengan pesan spesifik "lebih besar dari 0" (perilaku LAMA, pastikan belum rusak oleh V4f)', async () => {
      const token = await setupTenant('user-tx-h2', 'ws-tx-h2');
      seedTransactionCreate();
      const res = await transactionsPOST(
        jsonRequest('https://klir.test/api/v1/kas/transactions', token, { ...validBody, amount: -500 })
      );
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.match(body.message, /lebih besar dari 0/);
    });

    test('payload dasar tidak lengkap (tanpa category/description) -> tetap 400 seperti sebelum V4f (perilaku lama)', async () => {
      const token = await setupTenant('user-tx-i', 'ws-tx-i');
      seedTransactionCreate();
      const res = await transactionsPOST(
        jsonRequest('https://klir.test/api/v1/kas/transactions', token, { type: 'INCOME', amount: 1000 })
      );
      assert.equal(res.status, 400);
    });
  });
});
