import assert from 'node:assert/strict';
import { before, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

describe('GET /api/v1/dashboard/role: 6-role visual parity backend support', { concurrency: false }, () => {
  let currentUser = { id: 'u-1', email: 'owner@klir.id', fullName: 'Owner CEO' };
  let currentMembership = { role: 'OWNER', divisionRole: null as string | null, isOwner: true };
  let authError: any = null;
  let dashboardGET: typeof import('../src/app/api/v1/dashboard/role/route')['GET'];

  before(async () => {
    mock.module('../src/lib/tenant-guard', {
      namedExports: {
        authenticateTenantRequest: async () => {
          if (authError) return { errorResponse: authError };
          return {
            auth: {
              user: currentUser,
              workspace: { id: 'ws-1', name: 'Workspace Test', slug: 'workspace-test', ownerId: 'u-1' },
              membership: currentMembership,
              grants: [],
            },
          };
        },
      },
    });

    mock.module('../src/lib/prisma', {
      namedExports: {
        prisma: {
          cashTransaction: {
            aggregate: async () => ({
              _sum: { amount: 15000000 },
              _count: 5,
            }),
            findMany: async () => [],
          },
          invoice: {
            aggregate: async () => ({
              _sum: { totalAmount: 4500000 },
              _count: 3,
            }),
            count: async () => 3,
            findMany: async () => [],
          },
          customer: {
            count: async () => 12,
          },
          campaign: {
            findMany: async () => [
              { id: 'c-1', name: 'Promo Merdeka', dailyBudget: 100000, roas: 4.2, leads: 50, status: 'ACTIVE' },
            ],
            count: async () => 1,
          },
          promoCoupon: {
            count: async () => 4,
          },
          workTask: {
            count: async () => 2,
          },
          workspaceFile: {
            count: async () => 8,
          },
          attendanceRecord: {
            count: async () => 15,
          },
          product: {
            findMany: async () => [
              { currentStock: 20, minStock: 5 },
              { currentStock: 2, minStock: 5 },
            ],
          },
          purchaseOrder: {
            count: async () => 1,
          },
          supplierScore: {
            count: async () => 2,
          },
          productBatch: {
            count: async () => 0,
          },
          scheduledObligation: {
            aggregate: async () => ({
              _sum: { amount: 5000000 },
              _count: 2,
            }),
            count: async () => 2,
          },
          contentCalendar: {
            count: async () => 1,
          },
          memoryItem: {
            findMany: async () => [],
            deleteMany: async () => ({ count: 0 }),
          },
        },
      },
    });

    ({ GET: dashboardGET } = await import('../src/app/api/v1/dashboard/role/route'));
  });

  async function request(role?: string) {
    const url = role
      ? `https://klir.test/api/v1/dashboard/role?role=${encodeURIComponent(role)}`
      : 'https://klir.test/api/v1/dashboard/role';
    return dashboardGET(new NextRequest(url));
  }

  test('CEO dapat memuat dashboard CEO dengan cards lengkap', async () => {
    currentUser = { id: 'u-1', email: 'owner@klir.id', fullName: 'Owner CEO' };
    currentMembership = { role: 'OWNER', divisionRole: null, isOwner: true };
    authError = null;

    const res = await request('CEO');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.role, 'CEO');
    assert.ok(json.data.cards.some((c: any) => c.id === 'rev-mtd'));
    assert.ok(json.data.cards.some((c: any) => c.id === 'net-margin'));
    assert.ok(json.data.cards.some((c: any) => c.id === 'runway'));
    assert.ok(json.data.cards.some((c: any) => c.id === 'health-grade'));
    assert.ok(json.data.insight);
  });

  test('CEO dapat memuat dashboard FINANCE dan MARKETING untuk inspeksi lintas role', async () => {
    currentUser = { id: 'u-1', email: 'owner@klir.id', fullName: 'Owner CEO' };
    currentMembership = { role: 'OWNER', divisionRole: null, isOwner: true };

    const resFin = await request('FINANCE');
    assert.equal(resFin.status, 200);
    const jsonFin = await resFin.json();
    assert.equal(jsonFin.data.role, 'FINANCE');
    assert.ok(jsonFin.data.cards.some((c: any) => c.id === 'cash-active'));
    assert.ok(!jsonFin.data.cards.some((c: any) => ['pph-final', 'ppn-collected', 'sp2dk-risk'].includes(c.id)));
    assert.ok(jsonFin.data.cards.some((c: any) => c.id === 'ap-due7'));

    const resMkt = await request('MARKETING');
    assert.equal(resMkt.status, 200);
    const jsonMkt = await resMkt.json();
    assert.equal(jsonMkt.data.role, 'MARKETING');
    assert.ok(jsonMkt.data.cards.some((c: any) => c.id === 'spend-mtd'));
    assert.ok(jsonMkt.data.cards.some((c: any) => c.id === 'blended-roas'));
    assert.ok(jsonMkt.data.cards.some((c: any) => c.id === 'leads-count'));
  });

  test('CEO dapat memuat dashboard SEKRETARIS, MANAGER_UMUM, dan MANAGER_OPERASIONAL', async () => {
    currentUser = { id: 'u-1', email: 'owner@klir.id', fullName: 'Owner CEO' };
    currentMembership = { role: 'OWNER', divisionRole: null, isOwner: true };

    const resSek = await request('SEKRETARIS');
    assert.equal(resSek.status, 200);
    const jsonSek = await resSek.json();
    assert.equal(jsonSek.data.role, 'SEKRETARIS');
    assert.ok(jsonSek.data.cards.some((c: any) => c.id === 'legal-contracts'));
    assert.ok(jsonSek.data.cards.some((c: any) => c.id === 'coordination-tasks'));

    const resMan = await request('MANAGER_UMUM');
    assert.equal(resMan.status, 200);
    assert.equal((await resMan.json()).data.role, 'MANAGER_UMUM');

    const resOps = await request('MANAGER_OPERASIONAL');
    assert.equal(resOps.status, 200);
    const jsonOps = await resOps.json();
    assert.equal(jsonOps.data.role, 'MANAGER_OPERASIONAL');
    assert.ok(jsonOps.data.cards.some((c: any) => c.id === 'cogs-ratio'));
    assert.ok(jsonOps.data.cards.some((c: any) => c.id === 'supplier-performance'));
  });

  test('Finance user dapat memuat dashboard FINANCE miliknya', async () => {
    currentUser = { id: 'u-2', email: 'finance@klir.id', fullName: 'Finance Officer' };
    currentMembership = { role: 'MEMBER', divisionRole: 'FINANCE', isOwner: false };

    const res = await request('FINANCE');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.role, 'FINANCE');
  });

  test('Finance user DITOLAK (403) jika mencoba memuat dashboard CEO', async () => {
    currentUser = { id: 'u-2', email: 'finance@klir.id', fullName: 'Finance Officer' };
    currentMembership = { role: 'MEMBER', divisionRole: 'FINANCE', isOwner: false };

    const res = await request('CEO');
    assert.equal(res.status, 403);
    const json = await res.json();
    assert.equal(json.code, 'ROLE_DASHBOARD_FORBIDDEN');
  });

  test('Marketing user DITOLAK (403) jika mencoba memuat dashboard FINANCE', async () => {
    currentUser = { id: 'u-3', email: 'marketing@klir.id', fullName: 'Marketing Lead' };
    currentMembership = { role: 'MEMBER', divisionRole: 'MARKETING', isOwner: false };

    const res = await request('FINANCE');
    assert.equal(res.status, 403);
  });

  test('Sekretaris user dapat memuat dashboard SEKRETARIS miliknya', async () => {
    currentUser = { id: 'u-4', email: 'sekretaris@klir.id', fullName: 'Sekretaris' };
    currentMembership = { role: 'MEMBER', divisionRole: 'SEKRETARIS', isOwner: false };

    const res = await request('SEKRETARIS');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.role, 'SEKRETARIS');
  });

  test('Role tak dikenal (LAIN) ditolak dengan 403', async () => {
    currentUser = { id: 'u-5', email: 'tamu@klir.id', fullName: 'Tamu' };
    currentMembership = { role: 'MEMBER', divisionRole: null, isOwner: false };

    const res = await request();
    assert.equal(res.status, 403);
  });
});
