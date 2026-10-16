import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Guard regression tests for src/app/api/v1/brain/generate/route.ts and
// src/app/api/v1/brain/chat/route.ts.
//
// Before the fix these two routes read `workspaceId` straight from the request
// body/header/query (fully caller-controlled) and, failing that, fell back to
// `prisma.workspace.findFirst()` with NO where-clause -- the first workspace in
// the WHOLE DATABASE, for ANY caller, with zero authentication. Both routes now
// call the shared `authenticateTenantRequest` (src/lib/tenant-guard.ts) exactly
// like the already-correct src/app/api/v1/workspaces/[workspaceId]/credits/route.ts,
// and use `guard.auth.workspace.id` for everything downstream instead of trusting
// the request-supplied workspaceId.
//
// UPDATE (2026-09-07, brain/chat ONLY -- brain/generate is untouched and still
// ignores body.workspaceId entirely): body.workspaceId is now additionally passed
// as `requiredWorkspaceId` into authenticateTenantRequest's own GuardOptions, to
// restore the pre-merge multi-workspace switcher UI capability. This does NOT
// weaken the "instead of trusting the request-supplied workspaceId" guarantee
// above -- the guard still verifies the caller is actually a member before
// honoring it, so `guard.auth.workspace.id` is still the only value ever used
// downstream, it is just allowed to equal a NON-default workspace when the caller
// explicitly asked for one they belong to. See the two chat tests further below
// for the "rejected when not a member" / "honored when a verified member" split.
//
// Uses the same in-memory-Prisma-Proxy + real-signed-JWT pattern as
// tests/media-http.test.ts (see that file for the original pattern this is
// adapted from). `node:test`'s built-in `mock.module` (Node 22+,
// --experimental-test-module-mocks) replaces the heavy generation/AI dependencies
// (docx/exceljs/pptxgenjs generation engine, AI gateway HTTP calls) so these tests
// stay fast, deterministic and network-free while still exercising the REAL
// route handlers end to end.
// ---------------------------------------------------------------------------

type Query = { where?: { id?: string; ownerId?: string; OR?: unknown[] }; include?: unknown; select?: unknown };
type DbCall = { method: string; query: Query };
type WorkspaceFixture = {
  id: string; name: string; slug: string; ownerId: string;
  members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('brain/generate and brain/chat: tenant-guard wiring (no body/header/query workspaceId trust)', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let generatePOST: typeof import('../src/app/api/v1/brain/generate/route')['POST'];
  let chatPOST: typeof import('../src/app/api/v1/brain/chat/route')['POST'];

  let reads: DbCall[] = [];
  let forbiddenCalls: string[] = [];
  let networkCalls: string[] = [];
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let handlers: Record<string, (query: Query) => unknown>;

  let runGenerationCalls: any[] = [];
  let executeAIRequestCalls: any[] = [];

  // Every unconfigured Prisma method (including bootstrap writes like user.create /
  // workspace.create) is trapped and throws -- same technique as tests/media-http.test.ts.
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
            const handler = handlers[method];
            if (!handler) {
              forbiddenCalls.push(method); throw new Error(`Forbidden Prisma operation: ${method}`);
            }
            reads.push({ method, query });
            return handler(query);
          };
        },
      });
    },
  });

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    originalFetch = globalThis.fetch;
    process.env.JWT_SECRET = 'brain-guard-tests-only-signing-secret-3f9d21ab-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      networkCalls.push(input instanceof Request ? input.url : String(input));
      throw new Error('Network prohibited in brain guard tests');
    };

    // Replace the heavy generation engine (docx/exceljs/pptxgenjs + AI calls) with a
    // spy that only records the workspaceId it was invoked with. detectGenerationIntent
    // is stubbed to always return null: every test message here is a plain question,
    // never a "buatkan PPT/Word/..." command, so the real chat generation-intent
    // branch is never meant to fire in these tests regardless.
    mock.module('../src/lib/generation-engine', {
      namedExports: {
        runGeneration: async (req: any) => {
          runGenerationCalls.push(req);
          return { fileName: 'stub.docx', mimeType: 'application/octet-stream', fileBase64: null, summary: 'stub summary', provider: 'stub-provider', modelUsed: 'stub-model', latencyMs: 1 };
        },
        detectGenerationIntent: () => null,
      },
    });
    // Replace the AI gateway (real HTTP calls to LLM providers) with a spy that
    // records the workspaceId it was invoked with and returns a canned reply long
    // enough to pass brain/chat's own "is this a real answer" length/text checks.
    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        executeAIRequest: async (opts: any) => {
          executeAIRequestCalls.push(opts);
          return { text: 'Ini balasan stub dari AI gateway yang sengaja dibuat cukup panjang untuk lolos validasi panjang minimum di brain/chat.', provider: 'stub-provider', modelUsed: 'stub-model' };
        },
        analyzeImageWithGemini: async () => ({ text: 'stub-vision', modelUsed: 'stub-vision-model' }),
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: generatePOST } = await import('../src/app/api/v1/brain/generate/route'));
    ({ POST: chatPOST } = await import('../src/app/api/v1/brain/chat/route'));
  });

  beforeEach(() => {
    reads = []; forbiddenCalls = []; networkCalls = [];
    runGenerationCalls = []; executeAIRequestCalls = [];
    users = new Map();
    workspaces = new Map();
    // context-engine.ts (push Fatur 6 Sep) baca [COMPANY_PROFILE] via
    // memoryItem.findFirst (tenant-scoped); company-memory.ts baca akumulasi
    // pengetahuan via memoryItem.findMany -- keduanya legit non-security call,
    // default-kan null/kosong di sini biar gak ke-flag "Forbidden".
    handlers = {
      'memoryItem.findFirst': () => null,
      'memoryItem.findMany': () => [],
    };
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedUser(id: string) {
    const user = { id, email: `${id}@example.invalid`, fullName: `Test ${id}`, isSuperAdmin: false };
    users.set(id, user);
    handlers['user.findUnique'] = query => users.get(query.where?.id ?? '') ?? null;
    return user;
  }

  function seedWorkspace(ws: WorkspaceFixture) {
    workspaces.set(ws.id, ws);
    handlers['workspace.findUnique'] = query => {
      const found = workspaces.get(query.where?.id ?? '');
      if (!found) return null;
      return { id: found.id, name: found.name, slug: found.slug, ownerId: found.ownerId, members: found.members, resourceGrants: found.resourceGrants };
    };
  }

  function jsonRequest(url: string, options: { token?: string; body: object; headers?: Record<string, string> } = { body: {} }) {
    return new NextRequest(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...options.headers },
      body: JSON.stringify(options.body),
    });
  }

  // =========================================================================
  // brain/generate
  // =========================================================================

  test('generate: request with NO token is rejected (not 200) in a REALISTIC populated database, before runGeneration is ever called', async () => {
    // Realistic production shape: a real user owning a real workspace already exists
    // in the DB (unlike an empty-DB fixture, where tenant-guard's own bootstrap
    // fallbacks fail closed for unrelated reasons and would pass this test even
    // WITHOUT the fix). With zero auth material (no Authorization header, no
    // cookie, no x-workspace-id header, no body.workspaceId) the route must reject
    // BEFORE ever calling authenticateTenantRequest -- otherwise tenant-guard's own
    // `isOwner = ... || !token` fallback (tenant-guard.ts:176) would grant this
    // anonymous caller full OWNER access to 'victim-owner'\'s real workspace.
    seedUser('victim-owner');
    seedWorkspace({ id: 'ws-victim-real', name: 'Toko Korban Nyata', slug: 'toko-korban', ownerId: 'victim-owner', members: [], resourceGrants: [] });

    const response = await generatePOST(jsonRequest('https://klir.test/api/v1/brain/generate', {
      body: { type: 'word', brief: 'coba generate tanpa auth sama sekali, db populated' },
    }));

    assert.notEqual(response.status, 200);
    const body = await response.json();
    assert.notEqual(body.success, true);
    assert.equal(runGenerationCalls.length, 0, 'runGeneration must never be invoked for a request with zero authentication');
    assert.deepEqual(reads, [], 'no Prisma call at all should happen -- the route must reject on the missing token before ever reaching tenant-guard');
    assert.deepEqual(forbiddenCalls, [], 'no arbitrary-user/workspace fallback should ever be attempted for an unauthenticated request');
  });

  test('generate: valid token uses the caller\'s REAL workspace; a spoofed body.workspaceId is ignored', async () => {
    seedUser('user-a');
    seedWorkspace({ id: 'ws-real-a', name: 'Toko Nyata A', slug: 'toko-a', ownerId: 'user-a', members: [], resourceGrants: [] });
    // A second, unrelated workspace the attacker is trying to read/write into by
    // naming it directly in the request body.
    seedWorkspace({ id: 'ws-attacker-target', name: 'Workspace Korban', slug: 'korban', ownerId: 'someone-else', members: [], resourceGrants: [] });

    const token = signJwtToken({ userId: 'user-a', workspaceId: 'ws-real-a' });
    const response = await generatePOST(jsonRequest('https://klir.test/api/v1/brain/generate', {
      token,
      body: { type: 'word', brief: 'Buatkan draft SOP kasir toko', workspaceId: 'ws-attacker-target' },
    }));

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);

    assert.equal(runGenerationCalls.length, 1);
    assert.equal(runGenerationCalls[0].workspaceId, 'ws-real-a', 'runGeneration must receive the token owner\'s real workspace');
    assert.notEqual(runGenerationCalls[0].workspaceId, 'ws-attacker-target');

    // The spoofed id must never even be looked up in the database.
    const workspaceLookups = reads.filter(r => r.method === 'workspace.findUnique').map(r => r.query.where?.id);
    assert.ok(workspaceLookups.includes('ws-real-a'));
    assert.ok(!workspaceLookups.includes('ws-attacker-target'), 'the caller-supplied body.workspaceId must never be queried');
  });

  test('generate: valid token but spoofed `x-workspace-id` HEADER pointing at an unrelated workspace is rejected (not 200), runGeneration never called', async () => {
    // authenticateTenantRequest(req, {}) is called WITHOUT requiredWorkspaceId, so its
    // own resolution order (requiredWorkspaceId || header x-workspace-id || query ||
    // token.workspaceId) DOES read this header. The route is only safe because the
    // guard's OWN membership/ownership check then rejects a workspace the caller does
    // not own and is not a member of -- this test proves that end-to-end through the
    // real route handler, not just the body-spoof vector.
    seedUser('user-a2');
    seedWorkspace({ id: 'ws-real-a2', name: 'Toko Nyata A2', slug: 'toko-a2', ownerId: 'user-a2', members: [], resourceGrants: [] });
    // Owned by someone else, caller has no membership entry for it.
    seedWorkspace({ id: 'ws-victim-a', name: 'Workspace Korban Header', slug: 'korban-header-a', ownerId: 'someone-else', members: [], resourceGrants: [] });

    const token = signJwtToken({ userId: 'user-a2', workspaceId: 'ws-real-a2' });
    const response = await generatePOST(jsonRequest('https://klir.test/api/v1/brain/generate', {
      token,
      headers: { 'x-workspace-id': 'ws-victim-a' },
      body: { type: 'word', brief: 'Buatkan draft SOP kasir toko' },
    }));

    assert.notEqual(response.status, 200);
    const body = await response.json();
    assert.notEqual(body.success, true);
    assert.equal(runGenerationCalls.length, 0, 'runGeneration must never be invoked when the header-spoofed workspace is rejected by the guard');
  });

  // =========================================================================
  // brain/chat (non-image branch)
  // =========================================================================

  test('chat: request with NO token is rejected (not 200) in a REALISTIC populated database, before the chat/generation pipeline runs', async () => {
    // Same realistic-populated-DB shape as the generate test above: a real user
    // owning a real workspace already exists. Zero auth material must be rejected
    // before authenticateTenantRequest ever runs, otherwise tenant-guard's own
    // `isOwner = ... || !token` fallback would hand this anonymous caller full
    // OWNER access to 'victim-owner-chat'\'s real workspace.
    seedUser('victim-owner-chat');
    seedWorkspace({ id: 'ws-victim-real-chat', name: 'Toko Korban Chat', slug: 'toko-korban-chat', ownerId: 'victim-owner-chat', members: [], resourceGrants: [] });

    const response = await chatPOST(jsonRequest('https://klir.test/api/v1/brain/chat', {
      body: { message: 'Halo, ada info penting hari ini?' },
    }));

    assert.notEqual(response.status, 200);
    const body = await response.json();
    assert.notEqual(body.success, true);
    assert.equal(executeAIRequestCalls.length, 0, 'the AI gateway must never be called for a request with zero authentication');
    assert.equal(runGenerationCalls.length, 0);
    assert.deepEqual(reads, [], 'no Prisma call at all should happen -- the route must reject on the missing token before ever reaching tenant-guard');
    assert.deepEqual(forbiddenCalls, [], 'no arbitrary-user/workspace fallback should ever be attempted for an unauthenticated request');
  });

  // ---------------------------------------------------------------------------
  // UPDATE (2026-09-07, restore Fatur's multi-workspace switcher, additively):
  // body.workspaceId is no longer blanket-ignored. It now flows into tenant-guard's
  // own `requiredWorkspaceId` (src/lib/tenant-guard.ts GuardOptions) so a caller who
  // belongs to more than one workspace can steer a single chat request at whichever
  // one they explicitly pick in the UI (this is exactly what
  // FinanceAIAssistantView.tsx / ExecutiveAIAssistantView.tsx already send). The
  // security invariant does NOT change: tenant-guard still verifies membership
  // before honoring it, so a caller-supplied workspaceId for a workspace they
  // cannot access is rejected (403), never silently substituted. The two tests
  // below replace the single old one that asserted body.workspaceId was always
  // ignored -- that assumption is now the thing being fixed.
  // ---------------------------------------------------------------------------

  test('chat: body.workspaceId pointing at a workspace the caller is NOT a member of is rejected (403), never silently substituted', async () => {
    // Same shape as the x-workspace-id header-spoof test below: an attacker (or a
    // buggy client) naming a workspace the caller has no membership in must fail
    // loudly. Silently falling back to the token's own workspace (the old
    // behavior) would hide a real client bug and would not generalize to a caller
    // who has NO workspace of their own to fall back to.
    seedUser('user-b');
    seedWorkspace({ id: 'ws-real-b', name: 'Toko Nyata B', slug: 'toko-b', ownerId: 'user-b', members: [], resourceGrants: [] });
    seedWorkspace({ id: 'ws-attacker-target-2', name: 'Workspace Korban 2', slug: 'korban-2', ownerId: 'someone-else', members: [], resourceGrants: [] });

    const token = signJwtToken({ userId: 'user-b', workspaceId: 'ws-real-b' });
    const response = await chatPOST(jsonRequest('https://klir.test/api/v1/brain/chat', {
      token,
      body: { message: 'Halo, apa kabar bisnis saya hari ini?', workspaceId: 'ws-attacker-target-2', history: [] },
    }));

    assert.notEqual(response.status, 200);
    const body = await response.json();
    assert.notEqual(body.success, true);
    assert.equal(executeAIRequestCalls.length, 0, 'the AI gateway must never be called when body.workspaceId targets a workspace the caller cannot access');
  });

  test('chat: body.workspaceId IS honored (multi-workspace switch) when the caller is a verified member of that workspace', async () => {
    // The actual capability being restored: a caller who is a member of a SECOND
    // workspace (different from the one baked into their JWT) can point a single
    // chat request at it explicitly. tenant-guard verifies membership first --
    // this only succeeds because `members` proves user-multi belongs there.
    seedUser('user-multi');
    seedWorkspace({ id: 'ws-token-default', name: 'Toko Default', slug: 'toko-default', ownerId: 'user-multi', members: [], resourceGrants: [] });
    seedWorkspace({ id: 'ws-second-legit', name: 'Toko Kedua', slug: 'toko-kedua', ownerId: 'someone-else', members: [{ role: 'MEMBER' }], resourceGrants: [] });

    const token = signJwtToken({ userId: 'user-multi', workspaceId: 'ws-token-default' });
    const response = await chatPOST(jsonRequest('https://klir.test/api/v1/brain/chat', {
      token,
      body: { message: 'Halo, apa kabar bisnis saya hari ini?', workspaceId: 'ws-second-legit', history: [] },
    }));

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(executeAIRequestCalls.length, 1);
    assert.equal(executeAIRequestCalls[0].workspaceId, 'ws-second-legit', 'executeAIRequest must receive the explicitly requested workspace the caller is a verified member of, not the JWT default');
  });

  test('chat: valid token but spoofed `x-workspace-id` HEADER pointing at an unrelated workspace is rejected (not 200), executeAIRequest never called', async () => {
    seedUser('user-b2');
    seedWorkspace({ id: 'ws-real-b2', name: 'Toko Nyata B2', slug: 'toko-b2', ownerId: 'user-b2', members: [], resourceGrants: [] });
    seedWorkspace({ id: 'ws-victim2', name: 'Workspace Korban Header 2', slug: 'korban-header-2', ownerId: 'someone-else', members: [], resourceGrants: [] });

    const token = signJwtToken({ userId: 'user-b2', workspaceId: 'ws-real-b2' });
    const response = await chatPOST(jsonRequest('https://klir.test/api/v1/brain/chat', {
      token,
      headers: { 'x-workspace-id': 'ws-victim2' },
      body: { message: 'Halo, apa kabar bisnis saya hari ini?', history: [] },
    }));

    assert.notEqual(response.status, 200);
    const body = await response.json();
    assert.notEqual(body.success, true);
    assert.equal(executeAIRequestCalls.length, 0, 'the AI gateway must never be called when the header-spoofed workspace is rejected by the guard');
    assert.equal(runGenerationCalls.length, 0);
  });
});
