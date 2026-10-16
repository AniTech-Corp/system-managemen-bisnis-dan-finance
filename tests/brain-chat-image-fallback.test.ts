import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';
import { MediaError } from '../src/lib/media-errors';
// FIX (7 Sep, gap MEDIUM-HIGH -- unifikasi enrichment gambar): captured BEFORE
// mock.module() runs below, so this is the real, unmocked implementation --
// enrichImagePromptAntiSlop (brain/chat/route.ts) now delegates to this function
// (see src/lib/industry-image-templates.ts test for why), and mock.module's
// namedExports below REPLACES media-provider's entire export surface, not just
// generateImageMedia. Without re-exporting this real reference through the mock,
// every call to enrichImagePromptAntiSlop would hit `undefined` and throw --
// which is exactly what broke this suite (502 PROVIDER_ERROR on every test) before
// this fix.
import { enrichMarketingImage } from '../src/lib/media-provider';

// ---------------------------------------------------------------------------
// brain/chat image branch: primary-provider-with-safety-net regression tests
// (2026-09-07 fix restoring Fatur's generateSedanceImage + workspace switcher).
//
// Exercises the REAL route handler end to end (real withMediaGuard, real JWT,
// in-memory Prisma) with only the network-facing image provider mocked via
// node:test's `mock.module` (same technique as tests/brain-generate-chat-guard.test.ts).
// Goal: prove generateSedanceImage is actually INVOKED at runtime when the primary
// provider fails -- not just present-but-dead code -- and that it is NOT invoked
// when the primary provider succeeds. Also proves the image branch honors
// body.workspaceId (requiredWorkspaceId) exactly like the non-image branch.
//
// SEDANCE_API_KEY/SEEDANCE_API_KEY are forced unset here, so generateSedanceImage's
// own fallback path never calls fetch (it only builds a pollinations.ai URL string)
// -- keeping this suite network-free like every other guard test in this repo.
//
// Second pass (same date): a prior implementation of this fallback caught EVERY
// error type from the primary provider, including MediaError('INVALID_INPUT', ...)
// -- the user's own input being rejected by our validation -- and would still route
// it to pollinations.ai (a public, unauthenticated third party) and report success,
// which both defeated the validation and leaked the tenant's business name (baked
// into the prompt for anti-slop styling) into that public URL's query string. Two
// more tests below cover the fix: INVALID_INPUT must re-throw instead of falling
// back, and the prompt actually sent to the fallback must exclude the business name.
// ---------------------------------------------------------------------------

type Query = { where?: { id?: string }; include?: unknown; select?: unknown };
type DbCall = { method: string; query: Query };
type WorkspaceFixture = {
  id: string; name: string; slug: string; ownerId: string;
  members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('brain/chat image branch: generateChatImage with generateSedanceImage (Fatur) safety net', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let previousSedanceKey: string | undefined;
  let previousSeedanceKey: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let chatPOST: typeof import('../src/app/api/v1/brain/chat/route')['POST'];

  let reads: DbCall[] = [];
  let forbiddenCalls: string[] = [];
  let networkCalls: string[] = [];
  let capturedPrompts: string[] = [];
  let providerMode: 'success' | 'throw' | 'invalid-input' = 'success';
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;

  const fakePrisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      if (model.startsWith('$')) return async () => {
        forbiddenCalls.push(model); throw new Error(`Forbidden Prisma operation: ${model}`);
      };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: Query) => {
            const method = `${model}.${operation}`;
            if (method === 'user.findUnique') { reads.push({ method, query }); return users.get(query.where?.id ?? '') ?? null; }
            if (method === 'workspace.findUnique') {
              reads.push({ method, query });
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
    previousSedanceKey = process.env.SEDANCE_API_KEY;
    previousSeedanceKey = process.env.SEEDANCE_API_KEY;
    originalFetch = globalThis.fetch;
    process.env.JWT_SECRET = 'brain-chat-image-tests-only-signing-secret-1a2b3c4d-do-not-use-in-production';
    delete process.env.SEDANCE_API_KEY;
    delete process.env.SEEDANCE_API_KEY;
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      networkCalls.push(input instanceof Request ? input.url : String(input));
      throw new Error('Network prohibited in brain/chat image-fallback tests');
    };

    // The only thing mocked: the paid image provider generateChatImage() calls
    // internally via a dynamic import of '@/lib/media-provider'. Everything else
    // in the route (withMediaGuard, tenant-guard, generateSedanceImage, prompt
    // enrichment) runs for real.
    mock.module('../src/lib/media-provider', {
      namedExports: {
        generateImageMedia: async (prompt: string) => {
          capturedPrompts.push(prompt);
          if (providerMode === 'throw') throw new Error('Simulasi provider utama gagal (test)');
          if (providerMode === 'invalid-input') throw new MediaError('INVALID_INPUT', 'Brief gambar harus berisi 1-16000 karakter.');
          return { base64: 'QUFB', mimeType: 'image/png', provider: 'gemini', modelUsed: 'gemini-image-test', latencyMs: 3 };
        },
        // Real implementation (captured above, before this mock replaces the module) --
        // enrichImagePromptAntiSlop's prompt-enrichment step must keep "running for real"
        // as this suite's own header comment already promises.
        enrichMarketingImage,
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: chatPOST } = await import('../src/app/api/v1/brain/chat/route'));
  });

  beforeEach(() => {
    reads = []; forbiddenCalls = []; networkCalls = []; capturedPrompts = []; providerMode = 'success';
    users = new Map([['user-img', { id: 'user-img', email: 'img@example.invalid', fullName: 'Test Img', isSuperAdmin: false }]]);
    workspaces = new Map([
      ['ws-img-default', { id: 'ws-img-default', name: 'Toko Gambar Default', slug: 'toko-gambar-default', ownerId: 'user-img', members: [], resourceGrants: [] }],
      ['ws-img-second', { id: 'ws-img-second', name: 'Toko Gambar Kedua', slug: 'toko-gambar-kedua', ownerId: 'someone-else-img', members: [{ role: 'MEMBER' }], resourceGrants: [] }],
      ['ws-img-foreign', { id: 'ws-img-foreign', name: 'Toko Korban Gambar', slug: 'toko-korban-gambar', ownerId: 'someone-else-img-2', members: [], resourceGrants: [] }],
    ]);
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousJwtSecret;
    if (previousSedanceKey === undefined) delete process.env.SEDANCE_API_KEY; else process.env.SEDANCE_API_KEY = previousSedanceKey;
    if (previousSeedanceKey === undefined) delete process.env.SEEDANCE_API_KEY; else process.env.SEEDANCE_API_KEY = previousSeedanceKey;
  });

  function chatRequest(body: object, token?: string) {
    return new NextRequest('https://klir.test/api/v1/brain/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  }

  test('primary provider succeeds: generateChatImage result is used, generateSedanceImage (Fatur) is never invoked', async () => {
    const token = signJwtToken({ userId: 'user-img', workspaceId: 'ws-img-default' });
    const response = await chatPOST(chatRequest({ message: 'Tolong buatkan gambar promosi toko kami', history: [] }, token));

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.provider, 'gemini', 'must report the primary provider, not the Fatur fallback');
    assert.match(body.data.generatedImage.url, /^data:image\/png;base64,/, 'primary path returns a data: url built from the mocked base64/mimeType');
    assert.equal(capturedPrompts.length, 1, 'primary provider must be called exactly once');
    assert.deepEqual(networkCalls, [], 'no fetch call means generateSedanceImage never ran (it only fetches with a Sedance API key set, which is unset here)');
  });

  test('primary provider throws: generateSedanceImage (Fatur) is invoked as a live fallback, response still succeeds', async () => {
    providerMode = 'throw';
    const token = signJwtToken({ userId: 'user-img', workspaceId: 'ws-img-default' });
    const response = await chatPOST(chatRequest({ message: 'Tolong buatkan gambar promosi toko kami', history: [] }, token));

    assert.equal(response.status, 200, 'user must still get a successful response, not a 500/502 error');
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(capturedPrompts.length, 1, 'the primary provider was attempted first (and failed) before falling back');
    // These exact strings only ever come out of generateSedanceImage (Fatur's function) --
    // proof that it, specifically, ran and produced this response, not just that "some"
    // image came back.
    assert.equal(body.data.provider, 'Flux HD (layanan publik pollinations.ai)', 'provider reported to the user must be honest about which engine actually ran');
    assert.match(body.data.generatedImage.url, /^https:\/\/image\.pollinations\.ai\/prompt\//);
    assert.deepEqual(networkCalls, [], 'generateSedanceImage takes the no-API-key branch here (SEDANCE_API_KEY unset), so it builds a URL without ever calling fetch');
    // PRIVACY: pollinations.ai is a public, unauthenticated third party -- the tenant's
    // business name ("Toko Gambar Default") must never ride along in the query string of
    // an image URL that goes straight to it. It IS allowed in the prompt sent to the
    // primary internal provider (see capturedPrompts assertion in the previous test-style
    // checks), just not in the one handed to the third-party fallback.
    const decodedFallbackUrl = decodeURIComponent(body.data.generatedImage.url);
    assert.doesNotMatch(decodedFallbackUrl, /Toko Gambar Default/, 'tenant business name must not leak to the public pollinations.ai fallback URL');
  });

  test('primary provider rejects input (MediaError INVALID_INPUT): no fallback to Fatur/pollinations, error surfaces to user', async () => {
    providerMode = 'invalid-input';
    const token = signJwtToken({ userId: 'user-img', workspaceId: 'ws-img-default' });
    const response = await chatPOST(chatRequest({ message: 'Tolong buatkan gambar promosi toko kami', history: [] }, token));

    // Our own validation rejected the input -- this must come back as an honest error,
    // NOT be silently smoothed over by routing the (already-rejected) prompt to a public
    // third party just so the user sees a "success" response.
    assert.notEqual(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error?.code, 'INVALID_INPUT');
    assert.equal(capturedPrompts.length, 1, 'primary provider was still attempted once');
    assert.deepEqual(networkCalls, [], 'generateSedanceImage (and therefore pollinations.ai) must never be invoked for a validation rejection');
  });

  test('image branch honors body.workspaceId (multi-workspace switch) when the caller is a verified member', async () => {
    const token = signJwtToken({ userId: 'user-img', workspaceId: 'ws-img-default' });
    const response = await chatPOST(chatRequest({
      message: 'Tolong buatkan gambar promosi toko kami', history: [], workspaceId: 'ws-img-second',
    }, token));

    assert.equal(response.status, 200);
    assert.equal(capturedPrompts.length, 1);
    assert.match(capturedPrompts[0], /Toko Gambar Kedua/, 'the enriched prompt must carry the EXPLICITLY requested workspace\'s name, proving withMediaGuard resolved auth.workspace to it');
  });

  test('image branch rejects body.workspaceId for a workspace the caller is NOT a member of (403), provider never called', async () => {
    const token = signJwtToken({ userId: 'user-img', workspaceId: 'ws-img-default' });
    const response = await chatPOST(chatRequest({
      message: 'Tolong buatkan gambar promosi toko kami', history: [], workspaceId: 'ws-img-foreign',
    }, token));

    assert.notEqual(response.status, 200);
    const body = await response.json();
    assert.notEqual(body.success, true);
    assert.equal(capturedPrompts.length, 0, 'no image provider call may happen for a workspace the caller cannot access');
  });
});
