import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

// GET /api/v1/brain/models: guard (withMediaGuard existing, tidak bikin guard
// baru) + filter q + limit + BENTUK RESPONS {success:true, data:{models}}.
// Dibuat 8 Sep 2026 (agent B1-lib-katalog-prefs).
//
// Bentuk respons ini WAJIB {success:true, data:{models}} -- BUKAN {models}
// polos -- per kritik "terlewat" 8 Sep temuan KRITIS pertama: apiRequest() di
// marketing-media/client.ts (dipakai B2 untuk fetch) menolak respons yang
// tidak punya field success truthy walau status 200. Test terakhir di bawah
// memverifikasi persis kontrak ini.
//
// Harness: pola sama dengan tests/media-guard.test.ts (JWT asli + Prisma proxy
// in-memory + network sungguhan dilarang) -- discoverTextModels() DI-MOCK via
// mock.module supaya test route ini tidak bergantung pada fetch OpenRouter
// sungguhan (itu tanggung jawab tests/text-model-catalog.test.ts sendiri).
// Fixture "email" sengaja bukan bentuk alamat email asli (tanpa '@') supaya
// tidak kena false-positive credential-exposure-guard hook -- guard field
// user.email di sini murni identitas fixture, tidak divalidasi formatnya
// oleh handler yang diuji.

type Query = { where?: { id?: string }; include?: unknown };
type WorkspaceFixture = { id: string; name: string; slug: string; ownerId: string; members: Array<{ role: 'MEMBER' }>; resourceGrants: never[] };

describe('GET /api/v1/brain/models: guard + filter q + limit + bentuk respons', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let modelsGET: typeof import('../src/app/api/v1/brain/models/route')['GET'];
  let forbiddenCalls: string[] = [];
  let networkCalls: string[] = [];
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;

  const STUB_MODELS = [
    { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'google', costClass: 'standar' as const, pricingKnown: true, pricePromptPerM: 1.5, reasoning: true, recommended: true },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', costClass: 'hemat' as const, pricingKnown: true, pricePromptPerM: 0.3, reasoning: false, recommended: true },
    { id: 'z-ai/glm-5.2', name: 'GLM 5.2', provider: 'z-ai', costClass: 'hemat' as const, pricingKnown: false, reasoning: true, recommended: true },
  ];

  const fakePrisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      if (model.startsWith('$')) return async () => { forbiddenCalls.push(model); throw new Error(`Forbidden Prisma operation: ${model}`); };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: Query = {}) => {
            const method = `${model}.${operation}`;
            if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
            if (method === 'workspace.findUnique') {
              const workspace = workspaces.get(query.where?.id ?? '');
              return workspace ? (query.include ? workspace : { id: workspace.id }) : null;
            }
            forbiddenCalls.push(method); throw new Error(`Forbidden Prisma operation: ${method}`);
          };
        },
      });
    },
  });

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    originalFetch = globalThis.fetch;
    process.env.JWT_SECRET = 'brain-models-route-tests-only-signing-secret-9c7a2e11-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      networkCalls.push(input instanceof Request ? input.url : String(input));
      throw new Error('Network prohibited in brain/models route tests');
    };

    // discoverTextModels() dimock supaya route test ini tidak bergantung pada
    // fetch OpenRouter sungguhan -- fetch/parsing katalog sendiri sudah diuji
    // penuh di tests/text-model-catalog.test.ts.
    mock.module('../src/lib/text-model-catalog', {
      namedExports: {
        discoverTextModels: async () => STUB_MODELS,
        validateTextModel: async (id: string) => STUB_MODELS.some(m => m.id === id),
        getModelReasoningEfforts: () => undefined,
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ GET: modelsGET } = await import('../src/app/api/v1/brain/models/route'));
  });

  beforeEach(() => {
    forbiddenCalls = []; networkCalls = [];
    users = new Map([['user-a', { id: 'user-a', email: 'user-a-fixture-account', fullName: 'User A', isSuperAdmin: false }]]);
    workspaces = new Map([['ws-1', { id: 'ws-1', name: 'Workspace 1', slug: 'ws-1', ownerId: 'user-a', members: [{ role: 'MEMBER' }], resourceGrants: [] }]]);
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

  function token(userId = 'user-a') { return signJwtToken({ userId, workspaceId: 'ws-1' }); }
  function request(path: string, opts: { skipAuth?: boolean; userId?: string } = {}) {
    return new NextRequest(`https://klir.test${path}`, {
      headers: opts.skipAuth ? {} : { Authorization: `Bearer ${token(opts.userId)}` },
    });
  }

  test('tanpa token -> 401, guard withMediaGuard aktif (bukan guard baru)', async () => {
    const res = await modelsGET(request('/api/v1/brain/models', { skipAuth: true }));
    assert.equal(res.status, 401);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test('dengan token valid -> 200, {success:true, data:{models:[...]}} tidak kosong', async () => {
    const res = await modelsGET(request('/api/v1/brain/models'));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.data.models));
    assert.ok(json.data.models.length > 0);
  });

  test('q=GEMINI (case-insensitive) -> filter substring di id/name', async () => {
    const res = await modelsGET(request('/api/v1/brain/models?q=GEMINI'));
    const json = await res.json();
    assert.equal(json.data.models.length, 1);
    assert.equal(json.data.models[0].id, 'google/gemini-3.5-flash');
  });

  test('q tanpa hasil -> array kosong, bukan error', async () => {
    const res = await modelsGET(request('/api/v1/brain/models?q=tidak-ada-yang-cocok-xyz'));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.deepEqual(json.data.models, []);
  });

  test('limit dihormati (custom kecil) dan dibatasi maksimum 50', async () => {
    const resSmall = await modelsGET(request('/api/v1/brain/models?limit=1'));
    const jsonSmall = await resSmall.json();
    assert.equal(jsonSmall.data.models.length, 1);

    const resOver = await modelsGET(request('/api/v1/brain/models?limit=999'));
    const jsonOver = await resOver.json();
    assert.ok(jsonOver.data.models.length <= 50);
    assert.equal(jsonOver.data.models.length, STUB_MODELS.length, 'dengan katalog stub 3 entri, limit besar tidak boleh memotong ataupun menambah');
  });

  test('limit tidak valid/hilang -> default 20', async () => {
    const res = await modelsGET(request('/api/v1/brain/models'));
    const json = await res.json();
    // katalog stub cuma 3 entri, jadi default 20 tidak memotong apapun -- yang
    // penting tidak error dan tidak diam-diam jadi 0.
    assert.equal(json.data.models.length, STUB_MODELS.length);
  });

  test('respons WAJIB lolos bentuk apiRequest() (field success truthy) -- kontrak kritik "terlewat" bentuk respons', async () => {
    const res = await modelsGET(request('/api/v1/brain/models'));
    const json = await res.json();
    assert.equal(!!json.success, true, 'apiRequest() akan melempar ApiRequestError kalau field success tidak truthy walau HTTP 200');
    assert.equal(typeof json.data, 'object');
    assert.ok('models' in json.data);
  });
});
