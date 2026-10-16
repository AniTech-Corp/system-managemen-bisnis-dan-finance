import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// KELOMPOK C -- 5 route GET readonly di src/app/api/v1/brain/*:
//   nudges, alerts, recommendations, decision-memory, data-trust
// Sebelum fix: workspaceId diambil langsung dari header/searchParams TANPA verifikasi
// apapun, fallback ke workspace pertama di seluruh DB / UUID hardcode. Fix ini
// menyambungkan kelima route ke authenticateTenantRequest() (src/lib/tenant-guard.ts)
// yang sudah dipakai dengan benar oleh src/app/api/v1/workspaces/[workspaceId]/credits/route.ts.
//
// UPDATE (2026-09-07, KELOMPOK 2 -- tenant-guard.ts ZONA KUNING, lihat
// src/lib/tenant-guard.ts baris ~210): bug terpisah yang tadinya didokumentasikan
// di sini SUDAH DITUTUP --
//   const isOwner = workspace.ownerId === user.id || user.isSuperAdmin || !token;
// klausa `|| !token` sudah DIHAPUS (bukan digantikan gate NODE_ENV -- terbukti
// lewat penelusuran jalur bahwa klausa itu cuma dipakai untuk kasus workspace yang
// BUKAN milik si fallback user, persis skenario serangan; skenario dev sah "test
// tanpa login ke workspace milik sendiri" tetap lolos lewat `ownerId === user.id`).
// Kelima test "tanpa token" di bawah sekarang LULUS PENUH tanpa bantuan `todo` --
// tanda todo-nya sudah dihapus.

type Query = {
  where?: Record<string, unknown>;
  include?: unknown;
  orderBy?: unknown;
  select?: unknown;
  take?: number;
};
type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('brain readonly routes (nudges/alerts/recommendations/decision-memory/data-trust) tenant guard', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let invalidateContextCache: typeof import('../src/lib/ai-brain')['invalidateContextCache'];
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let handlers: Record<string, (query: Query) => unknown>;

  // Proxy Prisma: operasi yang eksplisit dimock dipakai; findMany/findUnique/findFirst/count
  // yang tidak dimock jatuh ke default aman (array/null/0) supaya engine ai-brain (yang
  // membaca banyak tabel seperti cashTransaction/invoice/promoCoupon/workTask) bisa jalan
  // end-to-end tanpa perlu memock tiap tabel satu-satu -- operasi TULIS (create/update/
  // upsert/delete/$transaction) tetap TIDAK dimock -> throw kalau kepanggil, supaya test
  // ini gagal keras kalau ada jalur bootstrap-tulis yang tidak sengaja terpicu.
  const fakePrisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: Query = {}) => {
            const method = `${model}.${operation}`;
            const handler = handlers[method];
            if (handler) return handler(query);
            if (operation === 'findMany') return [];
            if (operation === 'findUnique' || operation === 'findFirst') return null;
            if (operation === 'count') return 0;
            throw new Error(`Unmocked Prisma operation in brain-readonly-guard test: ${method}`);
          };
        },
      });
    },
  });

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'brain-readonly-guard-tests-only-secret-3f9a7d21-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ invalidateContextCache } = await import('../src/lib/ai-brain'));
  });

  beforeEach(() => {
    invalidateContextCache();
    users = new Map([
      ['user-owner', { id: 'user-owner', email: 'owner@example.invalid', fullName: 'Test Owner', isSuperAdmin: false }],
    ]);
    workspaces = new Map([
      ['ws-mine', {
        id: 'ws-mine', name: 'My Workspace', slug: 'my-workspace', ownerId: 'user-owner',
        members: [], resourceGrants: [],
      }],
      ['ws-victim', {
        id: 'ws-victim', name: 'Victim Workspace', slug: 'victim-workspace', ownerId: 'someone-else',
        members: [], resourceGrants: [],
      }],
    ]);
    handlers = {
      'user.findUnique': (q) => users.get((q.where?.id as string) ?? '') ?? null,
      // Representasikan DB produksi yang realistis (TIDAK kosong): findFirst tanpa
      // token mengembalikan user nyata yang sudah ada, bukan null -- supaya jalur
      // bootstrap-create tenant-guard.ts tidak sengaja terpicu dan menutupi perilaku
      // asli guard di balik error 500 yang tidak relevan dengan security.
      'user.findFirst': () => users.get('user-owner') ?? null,
      'workspace.findUnique': (q) => {
        const ws = workspaces.get((q.where?.id as string) ?? '');
        if (!ws) return null;
        // Satu bentuk objek dipakai baik oleh tenant-guard.ts (butuh members/resourceGrants)
        // maupun context-engine.ts getOrBuildBusinessContext (butuh onboardingProfile/corplanProjects).
        return {
          id: ws.id, name: ws.name, slug: ws.slug, ownerId: ws.ownerId,
          members: ws.members, resourceGrants: ws.resourceGrants,
          onboardingProfile: null, corplanProjects: [],
        };
      },
    };
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function ownerToken() {
    return signJwtToken({ userId: 'user-owner', workspaceId: 'ws-mine' });
  }

  function request(path: string, options: { token?: string; headers?: Record<string, string> } = {}) {
    return new NextRequest(`https://klir.test${path}`, {
      method: 'GET',
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
    });
  }

  const routes: Array<{ name: string; modulePath: string }> = [
    { name: 'nudges', modulePath: '../src/app/api/v1/brain/nudges/route' },
    { name: 'alerts', modulePath: '../src/app/api/v1/brain/alerts/route' },
    { name: 'recommendations', modulePath: '../src/app/api/v1/brain/recommendations/route' },
    { name: 'decision-memory', modulePath: '../src/app/api/v1/brain/decision-memory/route' },
    { name: 'data-trust', modulePath: '../src/app/api/v1/brain/data-trust/route' },
  ];

  for (const route of routes) {
    describe(route.name, () => {
      test(
        `GET /api/v1/brain/${route.name} tanpa token, dengan x-workspace-id di-spoof ke workspace korban, TIDAK boleh mengembalikan 200 data korban`,
        async () => {
          const { GET } = await import(route.modulePath);
          const res: Response = await GET(request(`/api/v1/brain/${route.name}`, {
            headers: { 'x-workspace-id': 'ws-victim' },
          }));
          assert.notEqual(res.status, 200, 'request tanpa token tidak boleh sukses (200)');
        }
      );

      test(
        `GET /api/v1/brain/${route.name} dengan token valid milik user sendiri -> 200, workspaceId = milik user (bukan hasil spoof header)`,
        async () => {
          const { GET } = await import(route.modulePath);

          // Baseline: token valid, tanpa header spoof -> 200, workspaceId = ws-mine.
          const okRes: Response = await GET(request(`/api/v1/brain/${route.name}`, { token: ownerToken() }));
          assert.equal(okRes.status, 200);
          const okBody = await okRes.json();
          assert.equal(okBody.success, true);
          assert.equal(okBody.data.workspaceId, 'ws-mine');

          // Spoofing: token valid milik user-owner (workspace ws-mine), TAPI header
          // x-workspace-id di-spoof ke ws-victim (user-owner BUKAN owner/member di sana).
          // Harus DITOLAK (bukan 200 dengan data ws-victim) -- membuktikan spoofing gagal.
          const spoofRes: Response = await GET(request(`/api/v1/brain/${route.name}`, {
            token: ownerToken(),
            headers: { 'x-workspace-id': 'ws-victim' },
          }));
          assert.notEqual(spoofRes.status, 200, 'spoof x-workspace-id ke workspace lain tidak boleh sukses');
          const spoofBody = await spoofRes.json();
          assert.notEqual(spoofBody?.data?.workspaceId, 'ws-victim', 'response tidak boleh membocorkan data ws-victim');
        }
      );
    });
  }
});
