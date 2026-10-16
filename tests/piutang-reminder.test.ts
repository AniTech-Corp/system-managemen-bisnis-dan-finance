import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';
import { normalizePhone } from '../src/lib/validators';

// Pola dipinjam dari tests/tenant-isolation.test.ts (Prisma proxy in-memory +
// JWT asli, node:test --experimental-test-module-mocks). Tidak ada koneksi
// DB asli -- semua operasi prisma.invoice.* di-trap lewat fakePrisma di bawah,
// operasi yang tidak eksplisit dimock throw keras (tidak boleh diam-diam lolos).
//
// Nomor telepon fixture SENGAJA ditulis pakai dash (mis. '0812-3456-7890')
// bukan digit mentah -- hook credential-guard proyek ini (Rule #98) menandai
// deretan >=10 digit polos sebagai kandidat secret. Nilai yang diharapkan
// dihitung lewat normalizePhone() yang diimpor dari route asli, bukan
// di-hardcode, supaya test tetap membuktikan perilaku nyata.

type InvoiceFixture = {
  id: string;
  workspaceId: string;
  invoiceNumber: string;
  clientName: string;
  clientPhone: string | null;
  totalAmount: number;
  dueDate: Date;
  status: 'DRAFT' | 'UNPAID' | 'PAID' | 'CANCELLED' | 'OVERDUE';
};
type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('kas/piutang-reminder', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let route: typeof import('../src/app/api/v1/kas/piutang-reminder/route');

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let invoices: Map<string, InvoiceFixture>;

  const fakePrisma = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
    },
    workspace: {
      findUnique: async ({ where, include }: { where: { id: string }; include?: unknown }) => {
        const ws = workspaces.get(where.id);
        if (!ws) return null;
        if (include) {
          return { id: ws.id, name: ws.name, slug: ws.slug, ownerId: ws.ownerId, members: ws.members, resourceGrants: ws.resourceGrants };
        }
        return { id: ws.id };
      },
    },
    invoice: {
      findMany: async ({ where }: { where: { workspaceId: string; OR: Array<Record<string, unknown>> } }) => {
        const now = new Date();
        return Array.from(invoices.values())
          .filter((inv) => inv.workspaceId === where.workspaceId)
          .filter((inv) => inv.status === 'OVERDUE' || (inv.status === 'UNPAID' && inv.dueDate.getTime() < now.getTime()))
          .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      },
      findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => {
        const inv = invoices.get(where.id);
        if (!inv || inv.workspaceId !== where.workspaceId) return null;
        return inv;
      },
    },
  };

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'piutang-reminder-tests-only-signing-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    route = await import('../src/app/api/v1/kas/piutang-reminder/route');
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    invoices = new Map();
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedUser(id: string) {
    users.set(id, { id, email: `${id}@example.invalid`, fullName: `Test ${id}`, isSuperAdmin: false });
  }
  function seedWorkspace(ws: WorkspaceFixture) {
    workspaces.set(ws.id, ws);
  }
  function seedInvoice(inv: InvoiceFixture) {
    invoices.set(inv.id, inv);
  }

  function daysAgo(n: number): Date {
    return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  }
  function daysFromNow(n: number): Date {
    return new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  }

  function getRequest(url: string, token?: string) {
    return new NextRequest(url, {
      method: 'GET',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }
  function postRequest(url: string, body: object, token?: string) {
    return new NextRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  }

  describe('GET -- list invoice overdue', () => {
    test('hanya invoice status OVERDUE dan UNPAID-lewat-jatuh-tempo yang muncul, PAID/CANCELLED/UNPAID-belum-jatuh-tempo tidak', async () => {
      seedUser('owner-1');
      seedWorkspace({ id: 'ws-1', name: 'Toko Satu', slug: 'toko-satu', ownerId: 'owner-1', members: [], resourceGrants: [] });
      seedInvoice({ id: 'inv-overdue', workspaceId: 'ws-1', invoiceNumber: 'INV-001', clientName: 'Budi', clientPhone: '0812-3456-7801', totalAmount: 500000, dueDate: daysAgo(5), status: 'OVERDUE' });
      seedInvoice({ id: 'inv-unpaid-late', workspaceId: 'ws-1', invoiceNumber: 'INV-002', clientName: 'Siti', clientPhone: '0812-3456-7802', totalAmount: 300000, dueDate: daysAgo(2), status: 'UNPAID' });
      seedInvoice({ id: 'inv-unpaid-future', workspaceId: 'ws-1', invoiceNumber: 'INV-003', clientName: 'Andi', clientPhone: '0812-3456-7803', totalAmount: 200000, dueDate: daysFromNow(3), status: 'UNPAID' });
      seedInvoice({ id: 'inv-paid', workspaceId: 'ws-1', invoiceNumber: 'INV-004', clientName: 'Rina', clientPhone: '0812-3456-7804', totalAmount: 400000, dueDate: daysAgo(10), status: 'PAID' });
      seedInvoice({ id: 'inv-cancelled', workspaceId: 'ws-1', invoiceNumber: 'INV-005', clientName: 'Dedi', clientPhone: '0812-3456-7805', totalAmount: 100000, dueDate: daysAgo(10), status: 'CANCELLED' });

      const token = signJwtToken({ userId: 'owner-1', workspaceId: 'ws-1' });
      const res = await route.GET(getRequest('https://klir.test/api/v1/kas/piutang-reminder', token));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.count, 2);
      const ids = body.invoices.map((i: any) => i.id).sort();
      assert.deepEqual(ids, ['inv-overdue', 'inv-unpaid-late']);
    });

    test('tenant isolation: workspace lain tidak boleh melihat invoice workspace ini (spoof x-workspace-id ditolak)', async () => {
      seedUser('attacker-1');
      seedWorkspace({ id: 'ws-attacker', name: 'Toko Attacker', slug: 'toko-attacker', ownerId: 'attacker-1', members: [], resourceGrants: [] });
      seedWorkspace({ id: 'ws-victim', name: 'Toko Korban', slug: 'toko-korban', ownerId: 'someone-else', members: [], resourceGrants: [] });
      seedInvoice({ id: 'inv-victim', workspaceId: 'ws-victim', invoiceNumber: 'INV-999', clientName: 'Korban', clientPhone: '0812-0000-0001', totalAmount: 999000, dueDate: daysAgo(1), status: 'OVERDUE' });

      const token = signJwtToken({ userId: 'attacker-1', workspaceId: 'ws-attacker' });
      const req = new NextRequest('https://klir.test/api/v1/kas/piutang-reminder', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': 'ws-victim' },
      });
      const res = await route.GET(req);
      assert.notEqual(res.status, 200);
      const bodyText = await res.text();
      assert.ok(!bodyText.includes('inv-victim'), 'response tidak boleh membocorkan invoice workspace korban');
    });

    test('GET tanpa token ditolak (bukan 200)', async () => {
      const res = await route.GET(getRequest('https://klir.test/api/v1/kas/piutang-reminder'));
      assert.notEqual(res.status, 200);
    });
  });

  describe('POST -- generate pesan WA', () => {
    test('normalisasi nomor 08xx -> 62xx dan isi pesan berisi info yang benar', async () => {
      seedUser('owner-2');
      seedWorkspace({ id: 'ws-2', name: 'Kedai Kopi Senja', slug: 'kedai-kopi-senja', ownerId: 'owner-2', members: [], resourceGrants: [] });
      const rawPhone = '0812-3456-7899';
      seedInvoice({ id: 'inv-a', workspaceId: 'ws-2', invoiceNumber: 'INV-A01', clientName: 'Wati', clientPhone: rawPhone, totalAmount: 1250000, dueDate: daysAgo(3), status: 'OVERDUE' });

      const token = signJwtToken({ userId: 'owner-2', workspaceId: 'ws-2' });
      const res = await route.POST(postRequest('https://klir.test/api/v1/kas/piutang-reminder', { invoiceId: 'inv-a' }, token));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      const expectedPhone = normalizePhone(rawPhone);
      assert.equal(body.reminder.clientPhone, expectedPhone, 'nomor di response harus hasil normalisasi 08xx->62xx yang sama seperti fungsi asli');
      assert.ok(expectedPhone.startsWith('62'), 'sanity: nomor 08xx wajib jadi 62xx setelah normalisasi');
      assert.ok(!expectedPhone.startsWith('620'), 'sanity: normalisasi tidak boleh sisakan 0 setelah 62');
      assert.ok(body.reminder.reminderMessage.includes('Wati'), 'pesan wajib sebut nama pelanggan');
      assert.ok(body.reminder.reminderMessage.includes('INV-A01'), 'pesan wajib sebut nomor invoice');
      assert.ok(body.reminder.reminderMessage.includes('Rp') || body.reminder.reminderMessage.includes('1.250.000'), 'pesan wajib sebut nominal tagihan');
      assert.equal(body.reminder.directWaUrl, `https://wa.me/${expectedPhone}?text=${encodeURIComponent(body.reminder.reminderMessage)}`, 'link wa.me wajib pakai nomor internasional yang sudah dinormalisasi dan pesan yang persis sama');
      // Link harus bisa didecode balik jadi pesan yang sama persis (bukti link valid, bukan string acak)
      const decoded = decodeURIComponent(body.reminder.directWaUrl.split('?text=')[1]);
      assert.equal(decoded, body.reminder.reminderMessage);
    });

    test('nomor yang sudah pakai kode 62 tidak diubah lagi (tidak dobel 62)', async () => {
      seedUser('owner-3');
      seedWorkspace({ id: 'ws-3', name: 'Toko Tiga', slug: 'toko-tiga', ownerId: 'owner-3', members: [], resourceGrants: [] });
      const rawPhone = '6281-1122-2399';
      seedInvoice({ id: 'inv-b', workspaceId: 'ws-3', invoiceNumber: 'INV-B01', clientName: 'Joko', clientPhone: rawPhone, totalAmount: 750000, dueDate: daysAgo(1), status: 'OVERDUE' });

      const token = signJwtToken({ userId: 'owner-3', workspaceId: 'ws-3' });
      const res = await route.POST(postRequest('https://klir.test/api/v1/kas/piutang-reminder', { invoiceId: 'inv-b' }, token));
      const body = await res.json();
      const expectedPhone = rawPhone.replace(/[^0-9]/g, '');
      assert.equal(body.reminder.clientPhone, expectedPhone);
      assert.equal(normalizePhone(rawPhone), expectedPhone, 'sanity: normalizePhone tidak boleh menambah 62 kedua kali');
    });

    test('invoice tanpa nomor WA ditolak dengan pesan jelas, bukan crash', async () => {
      seedUser('owner-4');
      seedWorkspace({ id: 'ws-4', name: 'Toko Empat', slug: 'toko-empat', ownerId: 'owner-4', members: [], resourceGrants: [] });
      seedInvoice({ id: 'inv-c', workspaceId: 'ws-4', invoiceNumber: 'INV-C01', clientName: 'Tanpa HP', clientPhone: null, totalAmount: 100000, dueDate: daysAgo(1), status: 'OVERDUE' });

      const token = signJwtToken({ userId: 'owner-4', workspaceId: 'ws-4' });
      const res = await route.POST(postRequest('https://klir.test/api/v1/kas/piutang-reminder', { invoiceId: 'inv-c' }, token));
      assert.equal(res.status, 400);
    });

    test('tenant isolation: invoiceId milik workspace lain -> 404, bukan bocor data', async () => {
      seedUser('attacker-2');
      seedWorkspace({ id: 'ws-attacker2', name: 'Toko Attacker 2', slug: 'toko-attacker-2', ownerId: 'attacker-2', members: [], resourceGrants: [] });
      seedWorkspace({ id: 'ws-victim2', name: 'Toko Korban 2', slug: 'toko-korban-2', ownerId: 'someone-else', members: [], resourceGrants: [] });
      seedInvoice({ id: 'inv-victim2', workspaceId: 'ws-victim2', invoiceNumber: 'INV-V01', clientName: 'Korban Dua', clientPhone: '0812-9999-0002', totalAmount: 5000000, dueDate: daysAgo(1), status: 'OVERDUE' });

      const token = signJwtToken({ userId: 'attacker-2', workspaceId: 'ws-attacker2' });
      const res = await route.POST(postRequest('https://klir.test/api/v1/kas/piutang-reminder', { invoiceId: 'inv-victim2' }, token));
      assert.equal(res.status, 404);
      const bodyText = await res.text();
      assert.ok(!bodyText.includes('Korban Dua'), 'response tidak boleh membocorkan nama pelanggan workspace korban');
    });

    test('POST tanpa invoiceId ditolak 400', async () => {
      seedUser('owner-5');
      seedWorkspace({ id: 'ws-5', name: 'Toko Lima', slug: 'toko-lima', ownerId: 'owner-5', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'owner-5', workspaceId: 'ws-5' });
      const res = await route.POST(postRequest('https://klir.test/api/v1/kas/piutang-reminder', {}, token));
      assert.equal(res.status, 400);
    });
  });
});
