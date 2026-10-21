import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// Tes level-route untuk modul Pengelolaan Utang & Piutang. Pola dipinjam dari
// tests/piutang-reminder.test.ts: Prisma proxy in-memory + JWT asli, tanpa
// koneksi DB. Setiap operasi prisma yang tidak dimock akan throw (lihat trap),
// supaya route yang menyentuh query tak terduga gagal keras alih-alih diam.

type InvoiceFixture = {
  id: string;
  workspaceId: string;
  invoiceNumber: string;
  clientName: string;
  partnerId: string | null;
  dueDate: Date;
  totalAmount: number;
  paidAmount: number;
  status: 'UNPAID' | 'OVERDUE' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  lastReminderAt?: Date | null;
  agingBucket?: string | null;
  overdueSince?: Date | null;
};

type ObligationFixture = {
  id: string;
  workspaceId: string;
  name: string;
  billNumber: string | null;
  partnerId: string | null;
  dueDate: Date;
  amount: number;
  paidAmount: number;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  lastReminderAt?: Date | null;
  agingBucket?: string | null;
  overdueSince?: Date | null;
};

type AllocationFixture = {
  workspaceId: string;
  invoiceId: string | null;
  obligationId: string | null;
  amount: number;
  transactionDate: Date;
};

type ActivityFixture = {
  id: string;
  workspaceId: string;
  invoiceId: string | null;
  partnerId: string | null;
  channel: string;
  outcome: string;
  tone: string | null;
  note: string | null;
  amountAtRisk: unknown;
  promisedAt: Date | null;
  activityDate: Date;
  createdByUserId: string | null;
};

type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('kas/ar-ap routes', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let paymentSchedule: typeof import('../src/app/api/v1/kas/payment-schedule/route');
  let overdueWatchlist: typeof import('../src/app/api/v1/kas/overdue-watchlist/route');
  let collectionActivities: typeof import('../src/app/api/v1/kas/collection-activities/route');
  let overdueSweep: typeof import('../src/app/api/v1/kas/overdue-sweep/route');

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let partners: Map<string, { id: string; workspaceId: string; name: string }>;
  let invoices: Map<string, InvoiceFixture>;
  let obligations: Map<string, ObligationFixture>;
  let allocations: AllocationFixture[];
  let activities: ActivityFixture[];

  let seq = 0;

  function withPartner<T extends { partnerId: string | null }>(doc: T): T & { partner: { name: string } | null } {
    const partner = doc.partnerId ? partners.get(doc.partnerId) ?? null : null;
    return { ...doc, partner: partner ? { name: partner.name } : null };
  }

  const fakePrisma: any = {
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
    paymentAllocation: {
      groupBy: async ({ where }: { where: { workspaceId: string; transactionDate?: { lte: Date } } }) => {
        const map = new Map<string, { invoiceId: string | null; obligationId: string | null; sum: number }>();
        for (const a of allocations) {
          if (a.workspaceId !== where.workspaceId) continue;
          if (where.transactionDate?.lte && a.transactionDate.getTime() > where.transactionDate.lte.getTime()) continue;
          const key = `${a.invoiceId ?? ''}|${a.obligationId ?? ''}`;
          const cur = map.get(key) ?? { invoiceId: a.invoiceId, obligationId: a.obligationId, sum: 0 };
          cur.sum += a.amount;
          map.set(key, cur);
        }
        return Array.from(map.values()).map((v) => ({
          invoiceId: v.invoiceId,
          obligationId: v.obligationId,
          _sum: { amount: v.sum },
        }));
      },
    },
    invoice: {
      findMany: async ({ where }: { where: Record<string, any> }) => {
        let list = Array.from(invoices.values()).filter((i) => i.workspaceId === where.workspaceId);
        if (where.status?.in) list = list.filter((i) => where.status.in.includes(i.status));
        if (where.dueDate?.lt) list = list.filter((i) => i.dueDate.getTime() < where.dueDate.lt.getTime());
        if (where.issueDate?.lte) list = list.filter((i) => i.dueDate.getTime() <= where.issueDate.lte.getTime());
        list.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
        return list.map(withPartner);
      },
      findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => {
        const inv = invoices.get(where.id);
        if (!inv || inv.workspaceId !== where.workspaceId) return null;
        return inv;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const inv = invoices.get(where.id);
        if (!inv) throw new Error('invoice not found');
        Object.assign(inv, data);
        return inv;
      },
    },
    scheduledObligation: {
      findMany: async ({ where }: { where: Record<string, any> }) => {
        let list = Array.from(obligations.values()).filter((o) => o.workspaceId === where.workspaceId);
        if (where.status?.in) list = list.filter((o) => where.status.in.includes(o.status));
        if (where.dueDate?.lt) list = list.filter((o) => o.dueDate.getTime() < where.dueDate.lt.getTime());
        if (where.createdAt?.lte) list = list.filter(() => true);
        list.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
        return list.map(withPartner);
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const ob = obligations.get(where.id);
        if (!ob) throw new Error('obligation not found');
        Object.assign(ob, data);
        return ob;
      },
    },
    collectionActivity: {
      create: async ({ data }: { data: Omit<ActivityFixture, 'id'> }) => {
        const created: ActivityFixture = { id: `act-${++seq}`, ...data };
        activities.push(created);
        return created;
      },
      findMany: async ({ where, take }: { where: Record<string, any>; take?: number }) => {
        let list = activities.filter((a) => a.workspaceId === where.workspaceId);
        if (where.partnerId) list = list.filter((a) => a.partnerId === where.partnerId);
        if (where.invoiceId) list = list.filter((a) => a.invoiceId === where.invoiceId);
        list.sort((a, b) => b.activityDate.getTime() - a.activityDate.getTime());
        if (take) list = list.slice(0, take);
        return list.map((a) => ({
          ...a,
          invoice: a.invoiceId
            ? { invoiceNumber: invoices.get(a.invoiceId)?.invoiceNumber, clientName: invoices.get(a.invoiceId)?.clientName }
            : null,
          partner: a.partnerId ? { name: partners.get(a.partnerId)?.name } : null,
        }));
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakePrisma),
  };

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'ar-ap-routes-tests-only-signing-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    paymentSchedule = await import('../src/app/api/v1/kas/payment-schedule/route');
    overdueWatchlist = await import('../src/app/api/v1/kas/overdue-watchlist/route');
    collectionActivities = await import('../src/app/api/v1/kas/collection-activities/route');
    overdueSweep = await import('../src/app/api/v1/kas/overdue-sweep/route');
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    partners = new Map();
    invoices = new Map();
    obligations = new Map();
    allocations = [];
    activities = [];
    seq = 0;
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
  function seedPartner(id: string, workspaceId: string, name: string) {
    partners.set(id, { id, workspaceId, name });
  }
  function seedInvoice(inv: Partial<InvoiceFixture> & { id: string; workspaceId: string }): InvoiceFixture {
    const full: InvoiceFixture = {
      invoiceNumber: inv.id.toUpperCase(),
      clientName: 'Pelanggan',
      partnerId: null,
      dueDate: new Date(),
      totalAmount: 0,
      paidAmount: 0,
      status: 'UNPAID',
      lastReminderAt: null,
      agingBucket: null,
      overdueSince: null,
      ...inv,
    };
    invoices.set(full.id, full);
    return full;
  }
  function seedObligation(ob: Partial<ObligationFixture> & { id: string; workspaceId: string }): ObligationFixture {
    const full: ObligationFixture = {
      name: 'Tagihan Vendor',
      billNumber: null,
      partnerId: null,
      dueDate: new Date(),
      amount: 0,
      paidAmount: 0,
      status: 'PENDING',
      lastReminderAt: null,
      agingBucket: null,
      overdueSince: null,
      ...ob,
    };
    obligations.set(full.id, full);
    return full;
  }

  const day = (n: number) => new Date(Date.now() + n * 86_400_000);

  function getRequest(url: string, token?: string) {
    return new NextRequest(url, { method: 'GET', headers: token ? { Authorization: `Bearer ${token}` } : {} });
  }
  function postRequest(url: string, body: object | undefined, token?: string) {
    return new NextRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  const ownerWs: WorkspaceFixture = { id: 'ws-1', name: 'Toko Satu', slug: 'toko-satu', ownerId: 'owner-1', members: [], resourceGrants: [] };

  describe('GET /kas/payment-schedule', () => {
    test('menampilkan tagihan utang belum lunas + proyeksi kas, mengabaikan yang lunas', async () => {
      seedUser('owner-1');
      seedWorkspace(ownerWs);
      seedPartner('p-v1', 'ws-1', 'PT Vendor Satu');
      seedObligation({ id: 'ob-1', workspaceId: 'ws-1', partnerId: 'p-v1', name: 'Sewa Gudang', dueDate: day(2), amount: 1_000_000 });
      seedObligation({ id: 'ob-2', workspaceId: 'ws-1', name: 'Listrik', dueDate: day(-1), amount: 500_000 });
      seedObligation({ id: 'ob-paid', workspaceId: 'ws-1', name: 'Sudah Lunas', dueDate: day(1), amount: 300_000, status: 'PAID' });
      seedInvoice({ id: 'inv-1', workspaceId: 'ws-1', clientName: 'Pelanggan A', dueDate: day(5), totalAmount: 2_000_000 });

      const token = signJwtToken({ userId: 'owner-1', workspaceId: 'ws-1' });
      const res = await paymentSchedule.GET(getRequest('https://klir.test/api/v1/kas/payment-schedule', token));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      const bills = body.data.bills;
      assert.equal(bills.length, 2, 'tagihan lunas tidak muncul');
      assert.equal(bills[0].id, 'ob-2', 'diurut menurut jatuh tempo');
      assert.equal(bills[0].partner, 'Listrik');
      assert.equal(bills[1].partner, 'PT Vendor Satu');
      assert.equal(body.data.totalPayable, '1500000.00');
      assert.equal(body.data.overduePayable, '500000.00');
      // proyeksi: AR 2jt masuk, AP 1,5jt keluar
      assert.equal(body.data.forecast.inflowTotal, '2000000.00');
      assert.equal(body.data.forecast.outflowTotal, '1500000.00');
    });

    test('tenant isolation: workspace lain tidak bocor walau x-workspace-id dipalsukan', async () => {
      seedUser('attacker-1');
      seedWorkspace({ id: 'ws-attacker', name: 'Attacker', slug: 'attacker', ownerId: 'attacker-1', members: [], resourceGrants: [] });
      seedWorkspace({ id: 'ws-victim', name: 'Korban', slug: 'korban', ownerId: 'someone-else', members: [], resourceGrants: [] });
      seedObligation({ id: 'ob-victim', workspaceId: 'ws-victim', name: 'Rahasia Vendor', dueDate: day(1), amount: 9_000_000 });

      const token = signJwtToken({ userId: 'attacker-1', workspaceId: 'ws-attacker' });
      const req = new NextRequest('https://klir.test/api/v1/kas/payment-schedule', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': 'ws-victim' },
      });
      const res = await paymentSchedule.GET(req);
      assert.notEqual(res.status, 200);
      const text = await res.text();
      assert.ok(!text.includes('Rahasia Vendor'));
    });
  });

  describe('GET /kas/overdue-watchlist', () => {
    test('hanya menampilkan yang lewat jatuh tempo, diurut risiko', async () => {
      seedUser('owner-1');
      seedWorkspace(ownerWs);
      seedInvoice({ id: 'inv-big', workspaceId: 'ws-1', clientName: 'Besar Lama', dueDate: day(-40), totalAmount: 10_000_000, status: 'OVERDUE' });
      seedInvoice({ id: 'inv-small', workspaceId: 'ws-1', clientName: 'Kecil Baru', dueDate: day(-1), totalAmount: 100_000, status: 'UNPAID' });
      seedInvoice({ id: 'inv-future', workspaceId: 'ws-1', clientName: 'Belum Jatuh Tempo', dueDate: day(10), totalAmount: 50_000_000, status: 'UNPAID' });

      const token = signJwtToken({ userId: 'owner-1', workspaceId: 'ws-1' });
      const res = await overdueWatchlist.GET(getRequest('https://klir.test/api/v1/kas/overdue-watchlist', token));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.data.count, 2);
      assert.equal(body.data.items[0].id, 'inv-big', 'risiko terbesar didahulukan');
      assert.equal(body.data.totalReceivableOverdue, '10100000.00');
      assert.equal(body.data.items[0].dunning.level, 4);
    });
  });

  describe('POST /kas/collection-activities', () => {
    test('mencatat penagihan, mengisi amountAtRisk dari sisa, dan memperbarui lastReminderAt', async () => {
      seedUser('member-1');
      seedWorkspace({ id: 'ws-2', name: 'Toko Dua', slug: 'toko-dua', ownerId: 'someone', members: [{ role: 'MEMBER' }], resourceGrants: [] });
      seedInvoice({ id: 'inv-c1', workspaceId: 'ws-2', invoiceNumber: 'INV-C1', clientName: 'Wati', dueDate: day(-4), totalAmount: 1_000_000, paidAmount: 250_000, status: 'PARTIAL' });

      const token = signJwtToken({ userId: 'member-1', workspaceId: 'ws-2' });
      const res = await collectionActivities.POST(
        postRequest('https://klir.test/api/v1/kas/collection-activities', { invoiceId: 'inv-c1', channel: 'whatsapp', outcome: 'sent' }, token)
      );
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.amountAtRisk, '750000.00', 'sisa tagihan dihitung dari total - dibayar');
      assert.equal(body.data.channel, 'WHATSAPP');
      assert.equal(activities.length, 1);
      assert.ok(invoices.get('inv-c1')!.lastReminderAt instanceof Date, 'lastReminderAt diperbarui');
    });

    test('menolak channel/outcome tak dikenal dan invoiceId wajib valid', async () => {
      seedUser('member-2');
      seedWorkspace({ id: 'ws-3', name: 'Toko Tiga', slug: 'toko-tiga', ownerId: 'someone', members: [{ role: 'MEMBER' }], resourceGrants: [] });
      const token = signJwtToken({ userId: 'member-2', workspaceId: 'ws-3' });

      const bad = await collectionActivities.POST(
        postRequest('https://klir.test/api/v1/kas/collection-activities', { channel: 'TELEGRAM' }, token)
      );
      assert.equal(bad.status, 400);

      const missing = await collectionActivities.POST(
        postRequest('https://klir.test/api/v1/kas/collection-activities', { invoiceId: 'nope', channel: 'WHATSAPP' }, token)
      );
      assert.equal(missing.status, 404);
    });

    test('tenant isolation: invoiceId milik workspace lain -> 404 tanpa bocor', async () => {
      seedUser('attacker-2');
      seedWorkspace({ id: 'ws-a2', name: 'A2', slug: 'a2', ownerId: 'attacker-2', members: [], resourceGrants: [] });
      seedWorkspace({ id: 'ws-v2', name: 'V2', slug: 'v2', ownerId: 'someone-else', members: [], resourceGrants: [] });
      seedInvoice({ id: 'inv-v2', workspaceId: 'ws-v2', invoiceNumber: 'INV-V2', clientName: 'Korban Dua', dueDate: day(-1), totalAmount: 5_000_000, status: 'OVERDUE' });

      const token = signJwtToken({ userId: 'attacker-2', workspaceId: 'ws-a2' });
      const res = await collectionActivities.POST(
        postRequest('https://klir.test/api/v1/kas/collection-activities', { invoiceId: 'inv-v2', channel: 'WHATSAPP' }, token)
      );
      assert.equal(res.status, 404);
      const text = await res.text();
      assert.ok(!text.includes('Korban Dua'));
      assert.equal(activities.length, 0);
    });
  });

  describe('GET /kas/collection-activities', () => {
    test('menampilkan riwayat dengan nama partner/invoice dan filter invoice', async () => {
      seedUser('owner-1');
      seedWorkspace(ownerWs);
      seedInvoice({ id: 'inv-h1', workspaceId: 'ws-1', invoiceNumber: 'INV-H1', clientName: 'Budi', dueDate: day(-1), totalAmount: 100_000 });
      seedInvoice({ id: 'inv-h2', workspaceId: 'ws-1', invoiceNumber: 'INV-H2', clientName: 'Siti', dueDate: day(-1), totalAmount: 200_000 });
      activities.push(
        { id: 'a1', workspaceId: 'ws-1', invoiceId: 'inv-h1', partnerId: null, channel: 'WHATSAPP', outcome: 'SENT', tone: null, note: null, amountAtRisk: null, promisedAt: null, activityDate: day(-1), createdByUserId: 'owner-1' },
        { id: 'a2', workspaceId: 'ws-1', invoiceId: 'inv-h2', partnerId: null, channel: 'PHONE', outcome: 'PROMISED_PAYMENT', tone: null, note: null, amountAtRisk: null, promisedAt: null, activityDate: day(0), createdByUserId: 'owner-1' }
      );

      const token = signJwtToken({ userId: 'owner-1', workspaceId: 'ws-1' });
      const all = await (await collectionActivities.GET(getRequest('https://klir.test/api/v1/kas/collection-activities', token))).json();
      assert.equal(all.data.length, 2);
      assert.equal(all.data[0].id, 'a2', 'terbaru dulu');
      assert.equal(all.data[0].invoiceNumber, 'INV-H2');

      const filtered = await (
        await collectionActivities.GET(getRequest('https://klir.test/api/v1/kas/collection-activities?invoiceId=inv-h1', token))
      ).json();
      assert.equal(filtered.data.length, 1);
      assert.equal(filtered.data[0].invoiceNumber, 'INV-H1');
    });
  });

  describe('POST /kas/overdue-sweep', () => {
    test('menandai faktur lewat jatuh tempo jadi OVERDUE dan mengisi bucket', async () => {
      seedUser('owner-1');
      seedWorkspace(ownerWs);
      seedInvoice({ id: 'inv-late', workspaceId: 'ws-1', clientName: 'Telat', dueDate: day(-45), totalAmount: 1_000_000, status: 'UNPAID' });
      seedInvoice({ id: 'inv-ok', workspaceId: 'ws-1', clientName: 'Aman', dueDate: day(5), totalAmount: 1_000_000, status: 'UNPAID' });
      seedInvoice({ id: 'inv-gone', workspaceId: 'ws-1', clientName: 'Lunas', dueDate: day(-3), totalAmount: 1_000_000, paidAmount: 1_000_000, status: 'UNPAID' });
      allocations.push({ workspaceId: 'ws-1', invoiceId: 'inv-gone', obligationId: null, amount: 1_000_000, transactionDate: day(0) });

      const token = signJwtToken({ userId: 'owner-1', workspaceId: 'ws-1' });
      const res = await overdueSweep.POST(postRequest('https://klir.test/api/v1/kas/overdue-sweep', {}, token));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.markedOverdue, 1);
      assert.equal(invoices.get('inv-late')!.status, 'OVERDUE');
      assert.equal(invoices.get('inv-late')!.agingBucket, 'd31_60');
      assert.ok(invoices.get('inv-late')!.overdueSince instanceof Date);
      assert.equal(invoices.get('inv-ok')!.status, 'UNPAID');
      assert.equal(invoices.get('inv-ok')!.agingBucket, 'current');
      assert.equal(invoices.get('inv-gone')!.status, 'UNPAID', 'dokumen lunas tidak disentuh');
    });
  });
});
