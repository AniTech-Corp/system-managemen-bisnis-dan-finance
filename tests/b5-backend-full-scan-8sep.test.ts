import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Tes untuk 3 perubahan B5-Backend, full-scan pajangan 8 Sep 2026:
//   1. PATCH /api/v1/promo/coupons  (MKT-04 split -- kuota voucher, field
//      `quota` SUDAH ADA di schema, murni handler baru)
//   2. POST + GET /api/v1/workspaces/[workspaceId]/profile -- field baru
//      businessModel & nib (F2-exec split), round-trip lewat string
//      [COMPANY_PROFILE] yang sama, NOL perubahan schema.
//   3. POST /api/v1/kas/runway-forecast -- floor palsu 50jt/15jt/20jt dihapus
//      (FIN-06), nilai asli (termasuk 0) harus lolos apa adanya.
//
// Pola sama dengan tests/ledger-wiring.test.ts: fake Prisma Proxy in-memory
// (handlers keyed "model.operation") + JWT asli via signJwtToken + node:test
// mock.module tidak dibutuhkan di sini (tidak ada panggilan AI/network).
// Jalankan: node --experimental-test-module-mocks --import tsx --test
// ---------------------------------------------------------------------------

type Query = {
  where?: Record<string, any>;
  data?: Record<string, any>;
  include?: unknown;
  select?: unknown;
  orderBy?: unknown;
};
type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('B5-Backend full-scan 8 Sep: promo/coupons PATCH + workspaces profile NIB/businessModel + runway-forecast floor removal', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let originalFetch: typeof globalThis.fetch;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let couponsRoute: typeof import('../src/app/api/v1/promo/coupons/route');
  let profileRoute: typeof import('../src/app/api/v1/workspaces/[workspaceId]/profile/route');
  let runwayRoute: typeof import('../src/app/api/v1/kas/runway-forecast/route');

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let coupons: Map<string, { id: string; workspaceId: string; code: string; quota: number }>;
  let memoryItems: Array<{ workspaceId: string; scope: string; content: string; createdAt: Date }>;
  let cashTransactions: Array<{ workspaceId: string; type: 'INCOME' | 'EXPENSE'; amount: number }>;

  const fakePrisma = new Proxy(
    {},
    {
      get(_target, model: string) {
        if (model === 'then') return undefined;
        return new Proxy(
          {},
          {
            get(_delegate, operation: string) {
              if (operation === 'then') return undefined;
              return async (query: Query = {}) => {
                const method = `${model}.${operation}`;

                if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;

                if (method === 'workspace.findUnique') {
                  const ws = workspaces.get(query.where?.id ?? '');
                  if (!ws) return null;
                  if (query.include) {
                    return {
                      id: ws.id, name: ws.name, slug: ws.slug, ownerId: ws.ownerId,
                      members: ws.members, resourceGrants: ws.resourceGrants,
                    };
                  }
                  return { id: ws.id, name: ws.name, slug: ws.slug, ownerId: ws.ownerId, updatedAt: new Date() };
                }

                if (method === 'workspace.update') {
                  const ws = workspaces.get(query.where?.id ?? '');
                  if (ws && query.data?.name) ws.name = query.data.name;
                  return ws;
                }

                if (method === 'promoCoupon.update') {
                  const coupon = coupons.get(query.where?.id ?? '');
                  if (!coupon || coupon.workspaceId !== query.where?.workspaceId) {
                    throw new Error('Record to update not found.');
                  }
                  if (typeof query.data?.quota === 'number') {
                    coupon.quota = query.data.quota;
                  } else if (query.data?.quota?.increment !== undefined) {
                    coupon.quota += query.data.quota.increment;
                  }
                  return { ...coupon };
                }

                if (method === 'memoryItem.findFirst') {
                  const matches = memoryItems
                    .filter(m => m.workspaceId === query.where?.workspaceId && m.scope === query.where?.scope)
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                  return matches[0] ?? null;
                }

                if (method === 'memoryItem.create') {
                  const record = {
                    workspaceId: query.data!.workspaceId,
                    scope: query.data!.scope,
                    content: query.data!.content,
                    createdAt: new Date(),
                  };
                  memoryItems.push(record);
                  return record;
                }

                if (method === 'cashTransaction.findMany') {
                  return cashTransactions.filter(t => t.workspaceId === query.where?.workspaceId);
                }

                throw new Error(`Unmocked Prisma operation in b5-backend test: ${method}`);
              };
            },
          }
        );
      },
    }
  );

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    originalFetch = globalThis.fetch;
    process.env.JWT_SECRET = 'b5-backend-tests-only-signing-secret-4f9a1c-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      throw new Error(`Network prohibited in b5-backend tests: ${input instanceof Request ? input.url : String(input)}`);
    };

    ({ signJwtToken } = await import('../src/lib/auth'));
    couponsRoute = await import('../src/app/api/v1/promo/coupons/route');
    profileRoute = await import('../src/app/api/v1/workspaces/[workspaceId]/profile/route');
    runwayRoute = await import('../src/app/api/v1/kas/runway-forecast/route');
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    coupons = new Map();
    memoryItems = [];
    cashTransactions = [];
  });

  after(() => {
    globalThis.fetch = originalFetch;
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
  function jsonRequest(url: string, opts: { method?: string; token?: string; body?: object } = {}) {
    const method = opts.method ?? 'POST';
    const isBodylessMethod = method === 'GET' || method === 'HEAD';
    return new NextRequest(url, {
      method,
      headers: {
        ...(isBodylessMethod ? {} : { 'Content-Type': 'application/json' }),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      ...(isBodylessMethod ? {} : { body: JSON.stringify(opts.body ?? {}) }),
    });
  }

  /**
   * "Tanpa token" pada withTenantGuard polos (promo/coupons PATCH, kas/runway-forecast
   * POST -- beda dari documents/from-template yang punya pre-check token eksplisit di
   * level route) HANYA menghasilkan 401 kalau NODE_ENV === 'production' (gerbang di
   * tenant-guard.ts:109, lihat komentar "GERBANG PRODUKSI" di file itu) -- di mode
   * dev, request tanpa token jatuh ke fallback "user pertama di DB" yang memang
   * disengaja untuk kemudahan lokal Fatur. Test ini membuktikan gerbang produksi,
   * bukan perilaku dev-fallback (yang bukan bug, sudah didokumentasikan).
   */
  async function withProductionGate<T>(fn: () => Promise<T>): Promise<T> {
    const env = process.env as Record<string, string | undefined>; // NODE_ENV readonly di typing Next -- cast utk test
    const previous = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      return await fn();
    } finally {
      env.NODE_ENV = previous;
    }
  }

  // =========================================================================
  // PATCH /api/v1/promo/coupons
  // =========================================================================
  describe('PATCH /api/v1/promo/coupons (MKT-04)', () => {
    test('quota absolut -> tersimpan (persist di fake DB, bukan cuma di response)', async () => {
      seedUser('user-mkt-1');
      seedWorkspace({ id: 'ws-mkt-1', name: 'Toko Kupon 1', slug: 'toko-kupon-1', ownerId: 'user-mkt-1', members: [], resourceGrants: [] });
      coupons.set('coupon-1', { id: 'coupon-1', workspaceId: 'ws-mkt-1', code: 'DISKON10', quota: 5 });
      const token = signJwtToken({ userId: 'user-mkt-1', workspaceId: 'ws-mkt-1' });

      const res = await couponsRoute.PATCH(jsonRequest('https://klir.test/api/v1/promo/coupons', { token, body: { id: 'coupon-1', quota: 80 } }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.coupon.quota, 80);
      assert.equal(coupons.get('coupon-1')?.quota, 80, 'perubahan harus benar-benar ter-update di DB, bukan cuma response');
    });

    test('quotaIncrement -> menambah kuota yang ada (bukan menimpa)', async () => {
      seedUser('user-mkt-2');
      seedWorkspace({ id: 'ws-mkt-2', name: 'Toko Kupon 2', slug: 'toko-kupon-2', ownerId: 'user-mkt-2', members: [], resourceGrants: [] });
      coupons.set('coupon-2', { id: 'coupon-2', workspaceId: 'ws-mkt-2', code: 'HEMAT20', quota: 3 });
      const token = signJwtToken({ userId: 'user-mkt-2', workspaceId: 'ws-mkt-2' });

      const res = await couponsRoute.PATCH(jsonRequest('https://klir.test/api/v1/promo/coupons', { token, body: { id: 'coupon-2', quotaIncrement: 50 } }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.coupon.quota, 53);
    });

    test('tanpa quota maupun quotaIncrement -> 400, tidak ada tulis ke DB', async () => {
      seedUser('user-mkt-3');
      seedWorkspace({ id: 'ws-mkt-3', name: 'Toko Kupon 3', slug: 'toko-kupon-3', ownerId: 'user-mkt-3', members: [], resourceGrants: [] });
      coupons.set('coupon-3', { id: 'coupon-3', workspaceId: 'ws-mkt-3', code: 'ABC', quota: 10 });
      const token = signJwtToken({ userId: 'user-mkt-3', workspaceId: 'ws-mkt-3' });

      const res = await couponsRoute.PATCH(jsonRequest('https://klir.test/api/v1/promo/coupons', { token, body: { id: 'coupon-3' } }));
      assert.equal(res.status, 400);
      assert.equal(coupons.get('coupon-3')?.quota, 10);
    });

    test('kupon milik workspace lain -> ditolak (tenant-guarded lewat where:{id, workspaceId}), tidak bocor/ubah data korban', async () => {
      seedUser('user-attacker-mkt');
      seedWorkspace({ id: 'ws-attacker-mkt', name: 'Toko Attacker', slug: 'toko-attacker-mkt', ownerId: 'user-attacker-mkt', members: [], resourceGrants: [] });
      seedWorkspace({ id: 'ws-victim-mkt', name: 'Toko Korban', slug: 'toko-korban-mkt', ownerId: 'someone-else', members: [], resourceGrants: [] });
      coupons.set('coupon-victim', { id: 'coupon-victim', workspaceId: 'ws-victim-mkt', code: 'RAHASIA', quota: 999 });
      const token = signJwtToken({ userId: 'user-attacker-mkt', workspaceId: 'ws-attacker-mkt' });

      const res = await couponsRoute.PATCH(jsonRequest('https://klir.test/api/v1/promo/coupons', { token, body: { id: 'coupon-victim', quota: 1 } }));
      assert.notEqual(res.status, 200);
      assert.equal(coupons.get('coupon-victim')?.quota, 999, 'kuota kupon korban tidak boleh berubah sama sekali');
    });

    test('tanpa token -> 401 (gerbang produksi), tidak ada tulis ke DB', async () => {
      await withProductionGate(async () => {
        const res = await couponsRoute.PATCH(jsonRequest('https://klir.test/api/v1/promo/coupons', { body: { id: 'coupon-x', quota: 1 } }));
        assert.equal(res.status, 401);
      });
    });
  });

  // =========================================================================
  // POST + GET /api/v1/workspaces/[workspaceId]/profile -- businessModel & nib
  // =========================================================================
  describe('workspaces/[workspaceId]/profile -- businessModel & NIB round-trip (F2-exec)', () => {
    test('POST simpan businessModel+nib -> GET baca balik nilai yang sama', async () => {
      seedUser('user-profile-1');
      seedWorkspace({ id: 'ws-profile-1', name: 'Toko Profil 1', slug: 'toko-profil-1', ownerId: 'user-profile-1', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-profile-1', workspaceId: 'ws-profile-1' });

      const postRes = await profileRoute.POST(jsonRequest('https://klir.test/api/v1/workspaces/ws-profile-1/profile', {
        token,
        body: {
          name: 'PT Makan Mania Mantap',
          industry: 'F&B',
          businessModel: 'B2C Direct Selling',
          nib: '1234567890123',
        },
      }));
      assert.equal(postRes.status, 200);
      const postBody = await postRes.json();
      assert.equal(postBody.success, true);
      assert.equal(postBody.data.businessModel, 'B2C Direct Selling');
      assert.equal(postBody.data.nib, '1234567890123');

      const getRes = await profileRoute.GET(jsonRequest('https://klir.test/api/v1/workspaces/ws-profile-1/profile', { method: 'GET', token }));
      assert.equal(getRes.status, 200);
      const getBody = await getRes.json();
      assert.equal(getBody.success, true);
      assert.equal(getBody.data.businessModel, 'B2C Direct Selling', 'businessModel harus terbaca balik persis seperti yang disimpan');
      assert.equal(getBody.data.nib, '1234567890123', 'NIB harus terbaca balik persis seperti yang disimpan');
      // Field lama (industri dst) tidak boleh rusak oleh field baru.
      assert.equal(getBody.data.industry, 'F&B');
    });

    test('POST tanpa businessModel/nib -> GET default jujur ("Belum ditentukan" / "-"), bukan undefined/crash', async () => {
      seedUser('user-profile-2');
      seedWorkspace({ id: 'ws-profile-2', name: 'Toko Profil 2', slug: 'toko-profil-2', ownerId: 'user-profile-2', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-profile-2', workspaceId: 'ws-profile-2' });

      await profileRoute.POST(jsonRequest('https://klir.test/api/v1/workspaces/ws-profile-2/profile', { token, body: { name: 'Toko Sederhana' } }));
      const getRes = await profileRoute.GET(jsonRequest('https://klir.test/api/v1/workspaces/ws-profile-2/profile', { method: 'GET', token }));
      const getBody = await getRes.json();
      assert.equal(getBody.data.businessModel, 'Belum ditentukan');
      assert.equal(getBody.data.nib, '-');
    });

    test('workspace belum pernah diisi profil sama sekali -> GET tidak crash, businessModel/nib default jujur', async () => {
      seedUser('user-profile-3');
      seedWorkspace({ id: 'ws-profile-3', name: 'Toko Profil 3', slug: 'toko-profil-3', ownerId: 'user-profile-3', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-profile-3', workspaceId: 'ws-profile-3' });

      const getRes = await profileRoute.GET(jsonRequest('https://klir.test/api/v1/workspaces/ws-profile-3/profile', { method: 'GET', token }));
      assert.equal(getRes.status, 200);
      const getBody = await getRes.json();
      assert.equal(getBody.data.businessModel, 'Belum ditentukan');
      assert.equal(getBody.data.nib, '-');
    });
  });

  // =========================================================================
  // POST /api/v1/kas/runway-forecast -- floor palsu dihapus (FIN-06)
  // =========================================================================
  describe('POST /api/v1/kas/runway-forecast -- FIN-06 floor palsu dihapus', () => {
    test('tenant tanpa transaksi sama sekali (kas Rp0 sungguhan) -> forecast melaporkan Rp0 apa adanya, BUKAN floor 50jt/15jt/20jt', async () => {
      seedUser('user-runway-1');
      seedWorkspace({ id: 'ws-runway-1', name: 'Toko Runway 1', slug: 'toko-runway-1', ownerId: 'user-runway-1', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-runway-1', workspaceId: 'ws-runway-1' });

      const res = await runwayRoute.POST(jsonRequest('https://klir.test/api/v1/kas/runway-forecast', { token, body: {} }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.forecast.currentCashReserve, 0, 'kas Rp0 sungguhan tidak boleh dilaporkan sebagai minimal Rp50jt lagi');
      assert.equal(body.forecast.monthlyExpense, 0, 'pengeluaran Rp0 sungguhan tidak boleh dilaporkan sebagai minimal Rp15jt lagi');
      assert.equal(body.forecast.monthlyRevenue, 0, 'pemasukan Rp0 sungguhan tidak boleh dilaporkan sebagai minimal Rp20jt lagi');
    });

    test('tenant dengan transaksi kecil (di bawah floor lama) -> angka asli dipakai, bukan dibulatkan naik ke floor lama', async () => {
      seedUser('user-runway-2');
      seedWorkspace({ id: 'ws-runway-2', name: 'Toko Runway 2', slug: 'toko-runway-2', ownerId: 'user-runway-2', members: [], resourceGrants: [] });
      cashTransactions.push({ workspaceId: 'ws-runway-2', type: 'INCOME', amount: 1000000 });
      cashTransactions.push({ workspaceId: 'ws-runway-2', type: 'EXPENSE', amount: 400000 });
      const token = signJwtToken({ userId: 'user-runway-2', workspaceId: 'ws-runway-2' });

      const res = await runwayRoute.POST(jsonRequest('https://klir.test/api/v1/kas/runway-forecast', { token, body: {} }));
      const body = await res.json();
      assert.equal(body.forecast.currentCashReserve, 600000, 'cadangan kas asli (1jt - 400rb) harus dipakai apa adanya, bukan floor 50jt lama');
      assert.equal(body.forecast.monthlyExpense, 400000, 'pengeluaran asli, bukan floor 15jt lama');
      assert.equal(body.forecast.monthlyRevenue, 1000000, 'pemasukan asli, bukan floor 20jt lama');
    });

    test('customCashReserve/customMonthlyExpense/customMonthlyRevenue manual tetap dihormati (perilaku manual-override tidak berubah)', async () => {
      seedUser('user-runway-3');
      seedWorkspace({ id: 'ws-runway-3', name: 'Toko Runway 3', slug: 'toko-runway-3', ownerId: 'user-runway-3', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-runway-3', workspaceId: 'ws-runway-3' });

      const res = await runwayRoute.POST(jsonRequest('https://klir.test/api/v1/kas/runway-forecast', {
        token,
        body: { customCashReserve: 12345, customMonthlyExpense: 2000, customMonthlyRevenue: 500 },
      }));
      const body = await res.json();
      assert.equal(body.forecast.currentCashReserve, 12345);
      assert.equal(body.forecast.monthlyExpense, 2000);
      assert.equal(body.forecast.monthlyRevenue, 500);
    });

    test('tanpa token -> 401 (gerbang produksi)', async () => {
      await withProductionGate(async () => {
        const res = await runwayRoute.POST(jsonRequest('https://klir.test/api/v1/kas/runway-forecast', { body: {} }));
        assert.equal(res.status, 401);
      });
    });
  });
});
