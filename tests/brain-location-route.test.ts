import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';
import type { LocationAnalysisInput, LocationAnalysisResult } from '../src/lib/research-types';

// tests/brain-location-route.test.ts -- POST /api/v1/brain/location: guard
// (authenticateTenantRequest, pola sama recommendations/simulate) + validasi
// zod + bentuk respons. Dibangun 8 Sep 2026 (wave B3-location-research).
//
// analyzeLocation() (logic murni) DI-MOCK di sini via mock.module -- logic
// verdict/heuristik/dedupe sendiri sudah diuji penuh di
// tests/location-research.test.ts. Test ini murni soal WIRING: guard jalan
// SEBELUM analyzeLocation, body tervalidasi SEBELUM analyzeLocation, dan
// bentuk respons {success, data} konsisten.
//
// Harness: pola sama tests/brain-context-simulate-guard.test.ts (JWT asli +
// Prisma proxy in-memory trap-semua, network sungguhan dilarang).

type Query = {
  where?: Record<string, any>;
  include?: Record<string, any>;
  select?: Record<string, any>;
};
type UserFixture = { id: string; email: string; fullName: string; isSuperAdmin: boolean };
type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('POST /api/v1/brain/location: guard + validasi zod + bentuk respons', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let originalFetch: typeof globalThis.fetch;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let locationPOST: typeof import('../src/app/api/v1/brain/location/route')['POST'];

  let forbiddenCalls: string[] = [];
  let networkCalls: string[] = [];
  let analyzeLocationCalls: LocationAnalysisInput[] = [];
  let analyzeLocationImpl: (input: LocationAnalysisInput) => Promise<LocationAnalysisResult>;
  let users: Map<string, UserFixture>;
  let workspaces: Map<string, WorkspaceFixture>;

  const STUB_RESULT: LocationAnalysisResult = {
    providerUsed: 'web',
    competitors: [{ name: 'Kompetitor Stub', source: 'https://stub.example/a' }],
    summary: 'DATA PUBLIK (riset internet, bukan Google Maps -- kunci Google Maps belum diisi): stub.',
    verdict: 'cocok',
    reasons: ['stub reason'],
    sources: [{ title: 'Kompetitor Stub', url: 'https://stub.example/a' }],
  };

  const fakePrisma = new Proxy(
    {},
    {
      get(_target, model: string) {
        if (model === 'then') return undefined;
        if (model.startsWith('$')) {
          return async () => {
            forbiddenCalls.push(model);
            throw new Error(`Forbidden Prisma operation: ${model}`);
          };
        }
        return new Proxy(
          {},
          {
            get(_delegate, operation: string) {
              if (operation === 'then') return undefined;
              return async (query: Query = {}) => {
                const method = `${model}.${operation}`;
                if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
                if (method === 'user.findFirst') return Array.from(users.values())[0] ?? null;
                if (method === 'workspace.findUnique') {
                  const ws = workspaces.get(query.where?.id ?? '');
                  if (!ws) return null;
                  if (query.include?.members) {
                    return { id: ws.id, name: ws.name, slug: ws.slug, ownerId: ws.ownerId, members: ws.members, resourceGrants: ws.resourceGrants };
                  }
                  return { id: ws.id };
                }
                if (method === 'workspace.findFirst') {
                  if (query.where?.ownerId) {
                    const owned = Array.from(workspaces.values()).find((w) => w.ownerId === query.where!.ownerId);
                    return owned ? { id: owned.id } : null;
                  }
                  const first = workspaces.values().next().value as WorkspaceFixture | undefined;
                  return first ? { id: first.id } : null;
                }
                forbiddenCalls.push(method);
                throw new Error(`Forbidden Prisma operation: ${method}`);
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
    process.env.JWT_SECRET = 'brain-location-route-tests-only-signing-secret-4f8b1c22-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async (input) => {
      networkCalls.push(input instanceof Request ? input.url : String(input));
      throw new Error('Network prohibited in brain/location route tests');
    };

    // analyzeLocation() DI-MOCK -- logic murninya sendiri sudah diuji penuh di
    // tests/location-research.test.ts. Test route ini murni soal wiring guard
    // + validasi, bukan re-test heuristik verdict.
    mock.module('../src/lib/location-research', {
      namedExports: {
        analyzeLocation: async (input: LocationAnalysisInput) => {
          analyzeLocationCalls.push(input);
          return analyzeLocationImpl(input);
        },
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: locationPOST } = await import('../src/app/api/v1/brain/location/route'));
  });

  beforeEach(() => {
    forbiddenCalls = [];
    networkCalls = [];
    analyzeLocationCalls = [];
    analyzeLocationImpl = async () => STUB_RESULT;
    users = new Map([['user-member', { id: 'user-member', email: 'member-fixture-account', fullName: 'Test Member', isSuperAdmin: false }]]);
    workspaces = new Map([
      ['ws-member', { id: 'ws-member', name: 'Member workspace', slug: 'member', ownerId: 'other-owner', members: [{ role: 'MEMBER' }], resourceGrants: [] }],
      ['ws-foreign', { id: 'ws-foreign', name: 'Foreign workspace', slug: 'foreign', ownerId: 'foreign-owner', members: [], resourceGrants: [] }],
    ]);
  });

  afterEach(() => {
    assert.deepEqual(forbiddenCalls, []);
    assert.deepEqual(networkCalls, []);
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function token(claims: object = {}) {
    return signJwtToken({ userId: 'user-member', workspaceId: 'ws-member', ...claims });
  }

  const validBody: LocationAnalysisInput = {
    businessName: 'Kedai Kopi Contoh',
    category: 'kedai kopi',
    area: 'Bekasi Timur',
    purpose: 'cabang_baru',
  };

  function request(options: { token?: string; body?: unknown; rawBody?: string; query?: string } = {}) {
    return new NextRequest(`https://klir.test/api/v1/brain/location${options.query ?? ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.rawBody ?? JSON.stringify(options.body ?? validBody),
    });
  }

  // ---------------------------------------------------------------------
  // Guard: token invalid/spoofed
  // ---------------------------------------------------------------------

  test('token present-tapi-invalid + spoof ?workspaceId=ws-foreign -> 403, analyzeLocation TIDAK PERNAH terpanggil', async () => {
    const expired = signJwtToken({ userId: 'user-member', workspaceId: 'ws-member' }, -1);
    const response = await locationPOST(request({ token: expired, query: '?workspaceId=ws-foreign', body: validBody }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.code, 'TENANT_ACCESS_DENIED');
    assert.deepEqual(analyzeLocationCalls, [], 'analyzeLocation tidak boleh dipanggil kalau guard menolak');
  });

  test('token valid untuk workspace lain, body TIDAK bisa spoof workspace (analyzeLocation workspace-agnostic, tapi guard tetap wajib jalan)', async () => {
    const response = await locationPOST(request({ token: token(), body: validBody }));
    assert.equal(response.status, 200);
    assert.equal(analyzeLocationCalls.length, 1);
  });

  // ---------------------------------------------------------------------
  // Validasi zod
  // ---------------------------------------------------------------------

  test('businessName kosong -> 400, analyzeLocation TIDAK terpanggil', async () => {
    const response = await locationPOST(request({ token: token(), body: { ...validBody, businessName: '' } }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.deepEqual(analyzeLocationCalls, []);
  });

  test('area kosong -> 400, analyzeLocation TIDAK terpanggil', async () => {
    const response = await locationPOST(request({ token: token(), body: { ...validBody, area: '   ' } }));
    assert.equal(response.status, 400);
    assert.deepEqual(analyzeLocationCalls, []);
  });

  test('category hilang -> 400', async () => {
    const { category, ...withoutCategory } = validBody;
    const response = await locationPOST(request({ token: token(), body: withoutCategory }));
    assert.equal(response.status, 400);
    assert.deepEqual(analyzeLocationCalls, []);
  });

  test('purpose bukan salah satu enum yang sah -> 400', async () => {
    const response = await locationPOST(request({ token: token(), body: { ...validBody, purpose: 'ekspansi-agresif' } }));
    assert.equal(response.status, 400);
    assert.deepEqual(analyzeLocationCalls, []);
  });

  test('radiusKm di luar rentang 0.5..20 -> 400', async () => {
    const tooSmall = await locationPOST(request({ token: token(), body: { ...validBody, radiusKm: 0.1 } }));
    assert.equal(tooSmall.status, 400);
    const tooBig = await locationPOST(request({ token: token(), body: { ...validBody, radiusKm: 999 } }));
    assert.equal(tooBig.status, 400);
    assert.deepEqual(analyzeLocationCalls, []);
  });

  test('radiusKm valid (dalam rentang) diteruskan apa adanya ke analyzeLocation', async () => {
    const response = await locationPOST(request({ token: token(), body: { ...validBody, radiusKm: 5 } }));
    assert.equal(response.status, 200);
    assert.equal(analyzeLocationCalls[0].radiusKm, 5);
  });

  test('body bukan JSON valid -> 400, bukan 500', async () => {
    const response = await locationPOST(request({ token: token(), rawBody: '{ini bukan json' }));
    assert.equal(response.status, 400);
    assert.deepEqual(analyzeLocationCalls, []);
  });

  // ---------------------------------------------------------------------
  // Bentuk respons sukses
  // ---------------------------------------------------------------------

  test('input valid -> 200, {success:true, data:<LocationAnalysisResult>} persis hasil analyzeLocation', async () => {
    const response = await locationPOST(request({ token: token(), body: validBody }));
    assert.equal(response.status, 200);
    const json = await response.json();
    assert.equal(json.success, true);
    assert.deepEqual(json.data, STUB_RESULT);
  });

  test('input valid diteruskan persis (businessName/category/area/purpose) ke analyzeLocation', async () => {
    await locationPOST(request({ token: token(), body: validBody }));
    assert.equal(analyzeLocationCalls.length, 1);
    assert.equal(analyzeLocationCalls[0].businessName, validBody.businessName);
    assert.equal(analyzeLocationCalls[0].category, validBody.category);
    assert.equal(analyzeLocationCalls[0].area, validBody.area);
    assert.equal(analyzeLocationCalls[0].purpose, validBody.purpose);
  });

  test('analyzeLocation melempar error -> 500, respons {success:false}, bukan crash tak tertangani', async () => {
    analyzeLocationImpl = async () => {
      throw new Error('simulasi kegagalan riset internal');
    };
    const response = await locationPOST(request({ token: token(), body: validBody }));
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.equal(body.success, false);
  });
});
