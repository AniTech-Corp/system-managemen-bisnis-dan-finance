import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { NextRequest, NextResponse } from 'next/server';
import type { AuthContext } from '../src/lib/tenant-guard';

type Query = { where?: { id?: string; OR?: unknown[] }; include?: unknown; select?: unknown };
type DbCall = { method: string; query: Query };
type WorkspaceFixture = {
  id: string; name: string; slug: string; ownerId: string;
  members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('media HTTP guard and bounded JSON with real test JWTs and in-memory Prisma', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  let http: typeof import('../src/lib/media-http');
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let reads: DbCall[] = [];
  let forbiddenCalls: string[] = [];
  let networkCalls: string[] = [];
  let users: Map<string, AuthContext['user']>;
  let workspaces: Map<string, WorkspaceFixture>;
  let handlers: Record<string, (query: Query) => unknown>;
  let handlerCalls: number;
  let observedAuth: AuthContext | undefined;

  // Every unconfigured Prisma method, including writes, raw SQL, transactions and connect,
  // is trapped. This object has no path to an actual database client.
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
    process.env.JWT_SECRET = 'media-http-tests-only-signing-secret-8cc51bb6-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      networkCalls.push(input instanceof Request ? input.url : String(input));
      throw new Error('Network prohibited in media HTTP tests');
    };
    // Import after setting the test-only signing secret and fake Prisma singleton.
    http = await import('../src/lib/media-http');
    ({ signJwtToken } = await import('../src/lib/auth'));
  });

  beforeEach(() => {
    reads = []; forbiddenCalls = []; networkCalls = []; handlerCalls = 0; observedAuth = undefined;
    users = new Map([['user-member', {
      id: 'user-member', email: 'member@example.invalid', fullName: 'Test Member', isSuperAdmin: false,
    }]]);
    workspaces = new Map([
      ['ws-member', { id: 'ws-member', name: 'Member workspace', slug: 'member', ownerId: 'other-owner', members: [{ role: 'MEMBER' }], resourceGrants: [] }],
      ['ws-foreign', { id: 'ws-foreign', name: 'Foreign workspace', slug: 'foreign', ownerId: 'foreign-owner', members: [], resourceGrants: [] }],
    ]);
    handlers = {
      'user.findUnique': query => users.get(query.where?.id ?? '') ?? null,
      'workspace.findUnique': query => {
        const workspace = workspaces.get(query.where?.id ?? '');
        return workspace ? query.include ? workspace : { id: workspace.id } : null;
      },
      'workspace.findFirst': () => ({ id: 'ws-member' }),
      // recordActivity (src/lib/activity-log.ts) fires non-fatally after a real route
      // handler completes successfully; allow it here so the "real generate route"
      // test below stays about auth/network, not this unrelated write.
      'activityEvent.create': () => ({ id: 'stub-activity-event' }),
    };
  });

  afterEach(() => {
    assert.deepEqual(forbiddenCalls, [], 'No bootstrap, write, raw SQL or unconfigured Prisma operation is allowed');
    assert.deepEqual(networkCalls, [], 'No provider or other network requests are allowed');
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
  function request(options: { token?: string; headers?: Record<string, string>; body?: string; query?: string } = {}) {
    return new NextRequest(`https://klir.test/api/v1/media/generate${options.query ?? ''}`, {
      method: 'POST',
      // FIX (7 Sep, gap MEDIUM): withMediaGuard's origin-check now compares the Origin
      // header's host against the *request* Host header (commit 168060e -- nextUrl.origin
      // is not proxy-aware in production), not NextRequest's own URL. NextRequest does NOT
      // auto-populate a 'host' header from the constructor URL (verified: headers.get('host')
      // is null without this), so every test fixture below was silently exercising ONLY the
      // foreign-origin-rejected branch of that check -- the same-origin-accepted branch had
      // zero coverage. Default Host to the request URL's own host (matches what a real
      // reverse-proxied request looks like); a test that needs a genuine host mismatch still
      // overrides it via options.headers below.
      headers: { 'Content-Type': 'application/json', Host: 'klir.test', ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...options.headers },
      body: options.body ?? '{"kind":"video"}',
    });
  }
  function guarded(options: import('../src/lib/media-http').MediaGuardOptions = {}) {
    return http.withMediaGuard(async (_req, { auth }) => {
      handlerCalls++; observedAuth = auth;
      return NextResponse.json({ success: true, workspaceId: auth.workspace.id, role: auth.membership.role });
    }, options);
  }
  async function expectError(response: Response, status: number, code: string) {
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, code);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    return body.error;
  }

  test('missing token returns 401 before any database read or provider handler', async () => {
    await expectError(await guarded()(request()), 401, 'AUTH_REQUIRED');
    assert.deepEqual(reads, []); assert.equal(handlerCalls, 0);
  });

  test('invalid and expired tokens return 401 without database access', async () => {
    const expired = signJwtToken({ userId: 'user-member', workspaceId: 'ws-member' }, -1);
    const valid = token();
    const tampered = valid.slice(0, valid.lastIndexOf('.') + 1) + 'invalid-signature';
    for (const jwt of ['not-a-jwt', expired, tampered, signJwtToken({ workspaceId: 'ws-member' })]) {
      await expectError(await guarded()(request({ token: jwt })), 401, 'AUTH_REQUIRED');
    }
    assert.deepEqual(reads, []); assert.equal(handlerCalls, 0);
  });

  test('signed token for a nonexistent user never bootstraps a user or workspace', async () => {
    users.clear();
    await expectError(await guarded()(request({ token: token() })), 401, 'AUTH_REQUIRED');
    assert.deepEqual(reads.map(read => read.method), ['user.findUnique']);
    assert.deepEqual(reads[0].query.where, { id: 'user-member' });
    assert.equal(handlerCalls, 0);
  });

  test('foreign Origin is denied before database access even with valid JWT', async () => {
    await expectError(await guarded()(request({ token: token(), headers: { Origin: 'https://foreign.test' } })), 403, 'ACCESS_DENIED');
    assert.deepEqual(reads, []); assert.equal(handlerCalls, 0);
  });

  test('cross-workspace access is denied despite OWNER in body, headers and signed claims', async () => {
    const response = await guarded()(request({
      token: token({ role: 'OWNER', isSuperAdmin: true }),
      headers: { 'x-workspace-id': 'ws-foreign', 'x-role': 'OWNER' },
      body: JSON.stringify({ kind: 'video', role: 'OWNER', workspaceId: 'ws-foreign', isOwner: true }),
    }));
    await expectError(response, 403, 'ACCESS_DENIED');
    assert.equal(handlerCalls, 0);
    assert.deepEqual(reads.filter(read => read.method === 'workspace.findUnique').map(read => read.query.where), [{ id: 'ws-foreign' }, { id: 'ws-foreign' }]);
  });

  test('MEMBER is accepted based on database membership with scoped membership/grant queries', async () => {
    const response = await guarded()(request({ token: token(), headers: { Origin: 'https://klir.test' } }));
    assert.equal(response.status, 200); assert.equal(handlerCalls, 1);
    assert.equal(observedAuth?.membership.role, 'MEMBER');
    assert.equal(observedAuth?.membership.isOwner, false);
    assert.equal(observedAuth?.workspace.id, 'ws-member');
    assert.deepEqual(reads[2].query.include, {
      members: { where: { userId: 'user-member' }, select: { role: true } },
      resourceGrants: { where: { userId: 'user-member' }, select: { resource: true, action: true } },
    });
  });

  test('VIEWER remains denied even when the request claims OWNER', async () => {
    workspaces.get('ws-member')!.members = [{ role: 'VIEWER' }];
    await expectError(await guarded()(request({ token: token({ role: 'OWNER' }), body: '{"role":"OWNER"}' })), 403, 'ACCESS_DENIED');
    assert.equal(handlerCalls, 0);
  });

  test('database owner without a membership row is accepted as OWNER', async () => {
    const workspace = workspaces.get('ws-member')!;
    workspace.ownerId = 'user-member'; workspace.members = [];
    assert.equal((await guarded()(request({ token: token() }))).status, 200);
    assert.deepEqual(observedAuth?.membership, { role: 'OWNER', divisionRole: null, isOwner: true });
  });

  test('workspace header overrides token but is validated; body workspace is ignored', async () => {
    const response = await guarded()(request({
      token: token({ workspaceId: 'ws-foreign' }), headers: { 'x-workspace-id': 'ws-member' },
      body: '{"workspaceId":"ws-foreign","role":"OWNER"}',
    }));
    assert.equal(response.status, 200);
    assert.equal(observedAuth?.workspace.id, 'ws-member');
    assert.ok(reads.filter(read => read.method === 'workspace.findUnique').every(read => read.query.where?.id === 'ws-member'));
  });

  test('token workspace is used when header is absent regardless of body workspace', async () => {
    assert.equal((await guarded()(request({ token: token(), body: '{"workspaceId":"ws-foreign"}' }))).status, 200);
    assert.equal(observedAuth?.workspace.id, 'ws-member');
  });

  // ---------------------------------------------------------------------------
  // requiredWorkspaceId option (added 2026-09-07 to restore brain/chat's
  // multi-workspace switcher additively -- see src/app/api/v1/brain/chat/route.ts
  // resolveRequestedWorkspaceId + tests/brain-generate-chat-guard.test.ts). This
  // is the caller passing an explicit option, distinct from the header/query/body
  // resolution above -- it must take priority over all of those, but is still
  // subject to the exact same membership verification, never a bypass.
  // ---------------------------------------------------------------------------

  test('requiredWorkspaceId option takes priority over header/query/token but is still membership-checked', async () => {
    const response = await guarded({ requiredWorkspaceId: 'ws-foreign' })(request({
      token: token(), headers: { 'x-workspace-id': 'ws-member' },
    }));
    await expectError(response, 403, 'ACCESS_DENIED');
    assert.equal(handlerCalls, 0);
    assert.ok(reads.filter(read => read.method === 'workspace.findUnique').every(read => read.query.where?.id === 'ws-foreign'), 'requiredWorkspaceId must win over the x-workspace-id header, not just be OR-ed with it');
  });

  test('requiredWorkspaceId option is honored end-to-end when the caller is a verified member of that workspace', async () => {
    workspaces.set('ws-second', { id: 'ws-second', name: 'Second workspace', slug: 'second', ownerId: 'other-owner-2', members: [{ role: 'MEMBER' }], resourceGrants: [] });
    const response = await guarded({ requiredWorkspaceId: 'ws-second' })(request({ token: token() }));
    assert.equal(response.status, 200);
    assert.equal(observedAuth?.workspace.id, 'ws-second', 'the resolved auth context must reflect the explicitly requested workspace, not the JWT default (ws-member)');
  });

  test('query workspace is validated and cannot bypass membership', async () => {
    await expectError(await guarded()(request({ token: token(), query: '?workspaceId=ws-foreign' })), 403, 'ACCESS_DENIED');
    assert.equal(handlerCalls, 0);
  });

  test('missing requested workspace and a disappeared workspace never trigger bootstrap writes', async () => {
    workspaces.clear();
    await expectError(await guarded()(request({ token: token() })), 403, 'WORKSPACE_NOT_FOUND');
    assert.equal(handlerCalls, 0);
    let lookups = 0;
    handlers['workspace.findUnique'] = () => ++lookups === 1 ? { id: 'ws-member' } : null;
    await expectError(await guarded()(request({ token: token() })), 403, 'WORKSPACE_NOT_FOUND');
    assert.equal(lookups, 2); assert.equal(handlerCalls, 0);
  });

  test('no workspace claim uses only the current user ownership/membership lookup', async () => {
    const jwt = signJwtToken({ userId: 'user-member' });
    assert.equal((await guarded()(request({ token: jwt, body: '{"workspaceId":"ws-foreign"}' }))).status, 200);
    assert.deepEqual(reads.find(read => read.method === 'workspace.findFirst')?.query, {
      where: { OR: [{ ownerId: 'user-member' }, { members: { some: { userId: 'user-member' } } }] }, select: { id: true },
    });
    handlers['workspace.findFirst'] = () => null;
    await expectError(await guarded()(request({ token: jwt })), 403, 'WORKSPACE_NOT_FOUND');
  });

  test('cookie JWT uses the same existing user and membership checks', async () => {
    assert.equal((await guarded()(request({ headers: { Cookie: `klir_token=${token()}` } }))).status, 200);
    assert.equal(observedAuth?.user.id, 'user-member');
  });

  test('unknown handler/provider errors are sanitized and never leak private details', async () => {
    const wrapped = http.withMediaGuard(async () => {
      throw new Error('private-provider-secret prompt=confidential upstream-body=hidden');
    });
    const error = await expectError(await wrapped(request({ token: token() })), 502, 'PROVIDER_ERROR');
    assert.equal(error.retryable, true);
    assert.doesNotMatch(JSON.stringify(error), /secret|confidential|hidden|upstream/);
  });

  test('database exceptions are sanitized without trying a bootstrap fallback', async () => {
    handlers['user.findUnique'] = () => { throw new Error('private-database-connection-string'); };
    const error = await expectError(await guarded()(request({ token: token() })), 502, 'PROVIDER_ERROR');
    assert.doesNotMatch(error.message, /private|connection/);
    assert.deepEqual(reads.map(read => read.method), ['user.findUnique']);
    assert.equal(handlerCalls, 0);
  });

  test('bounded JSON accepts valid JSON at exactly the byte limit', async () => {
    const body = JSON.stringify({ text: 'a'.repeat(79989) });
    assert.equal(Buffer.byteLength(body), 80000);
    assert.deepEqual(await http.readMediaJson(request({ body })), { text: 'a'.repeat(79989) });
    assert.deepEqual(reads, []);
  });

  test('bounded JSON rejects malformed JSON, empty body and wrong content type', async () => {
    for (const body of ['{broken', '']) {
      await assert.rejects(http.readMediaJson(request({ body })), (error: unknown) =>
        error instanceof Error && 'code' in error && error.code === 'INVALID_INPUT');
    }
    await assert.rejects(http.readMediaJson(request({ body: '{}', headers: { 'Content-Type': 'text/plain' } })),
      (error: unknown) => error instanceof Error && 'status' in error && error.status === 415);
  });

  test('bounded JSON rejects oversized declared, actual and multibyte bodies', async () => {
    for (const req of [
      request({ body: '{}', headers: { 'Content-Length': '80001' } }),
      request({ body: JSON.stringify({ text: 'a'.repeat(80000) }) }),
      request({ body: JSON.stringify({ text: 'é'.repeat(40000) }) }),
      request({ body: JSON.stringify({ text: 'a'.repeat(80000) }), headers: { 'Content-Length': '1' } }),
    ]) {
      await assert.rejects(http.readMediaJson(req), (error: unknown) =>
        error instanceof Error && 'code' in error && error.code === 'FILE_TOO_LARGE' && 'status' in error && error.status === 413);
    }
    assert.deepEqual(reads, []);
  });

  test('real generate route returns planned video with zero provider fetch when video capability is off', async () => {
    // Item 4.6 (7 Sep): video sekarang genuinely render kalau capability ON (lihat
    // tests/media-provider.test.ts untuk skenario itu) -- test HTTP/guard ini
    // sengaja menonaktifkan capability-nya secara eksplisit (bukan bergantung diam-
  });

  test('workspace header overrides token but is validated; body workspace is ignored', async () => {
    const response = await guarded()(request({
      token: token({ workspaceId: 'ws-foreign' }), headers: { 'x-workspace-id': 'ws-member' },
      body: '{"workspaceId":"ws-foreign","role":"OWNER"}',
    }));
    assert.equal(response.status, 200);
    assert.equal(observedAuth?.workspace.id, 'ws-member');
    assert.ok(reads.filter(read => read.method === 'workspace.findUnique').every(read => read.query.where?.id === 'ws-member'));
  });

  test('token workspace is used when header is absent regardless of body workspace', async () => {
    assert.equal((await guarded()(request({ token: token(), body: '{"workspaceId":"ws-foreign"}' }))).status, 200);
    assert.equal(observedAuth?.workspace.id, 'ws-member');
  });

  // ---------------------------------------------------------------------------
  // requiredWorkspaceId option (added 2026-09-07 to restore brain/chat's
  // multi-workspace switcher additively -- see src/app/api/v1/brain/chat/route.ts
  // resolveRequestedWorkspaceId + tests/brain-generate-chat-guard.test.ts). This
  // is the caller passing an explicit option, distinct from the header/query/body
  // resolution above -- it must take priority over all of those, but is still
  // subject to the exact same membership verification, never a bypass.
  // ---------------------------------------------------------------------------

  test('requiredWorkspaceId option takes priority over header/query/token but is still membership-checked', async () => {
    const response = await guarded({ requiredWorkspaceId: 'ws-foreign' })(request({
      token: token(), headers: { 'x-workspace-id': 'ws-member' },
    }));
    await expectError(response, 403, 'ACCESS_DENIED');
    assert.equal(handlerCalls, 0);
    assert.ok(reads.filter(read => read.method === 'workspace.findUnique').every(read => read.query.where?.id === 'ws-foreign'), 'requiredWorkspaceId must win over the x-workspace-id header, not just be OR-ed with it');
  });

  test('requiredWorkspaceId option is honored end-to-end when the caller is a verified member of that workspace', async () => {
    workspaces.set('ws-second', { id: 'ws-second', name: 'Second workspace', slug: 'second', ownerId: 'other-owner-2', members: [{ role: 'MEMBER' }], resourceGrants: [] });
    const response = await guarded({ requiredWorkspaceId: 'ws-second' })(request({ token: token() }));
    assert.equal(response.status, 200);
    assert.equal(observedAuth?.workspace.id, 'ws-second', 'the resolved auth context must reflect the explicitly requested workspace, not the JWT default (ws-member)');
  });

  test('query workspace is validated and cannot bypass membership', async () => {
    await expectError(await guarded()(request({ token: token(), query: '?workspaceId=ws-foreign' })), 403, 'ACCESS_DENIED');
    assert.equal(handlerCalls, 0);
  });

  test('missing requested workspace and a disappeared workspace never trigger bootstrap writes', async () => {
    workspaces.clear();
    await expectError(await guarded()(request({ token: token() })), 403, 'WORKSPACE_NOT_FOUND');
    assert.equal(handlerCalls, 0);
    let lookups = 0;
    handlers['workspace.findUnique'] = () => ++lookups === 1 ? { id: 'ws-member' } : null;
    await expectError(await guarded()(request({ token: token() })), 403, 'WORKSPACE_NOT_FOUND');
    assert.equal(lookups, 2); assert.equal(handlerCalls, 0);
  });

  test('no workspace claim uses only the current user ownership/membership lookup', async () => {
    const jwt = signJwtToken({ userId: 'user-member' });
    assert.equal((await guarded()(request({ token: jwt, body: '{"workspaceId":"ws-foreign"}' }))).status, 200);
    assert.deepEqual(reads.find(read => read.method === 'workspace.findFirst')?.query, {
      where: { OR: [{ ownerId: 'user-member' }, { members: { some: { userId: 'user-member' } } }] }, select: { id: true },
    });
    handlers['workspace.findFirst'] = () => null;
    await expectError(await guarded()(request({ token: jwt })), 403, 'WORKSPACE_NOT_FOUND');
  });

  test('cookie JWT uses the same existing user and membership checks', async () => {
    assert.equal((await guarded()(request({ headers: { Cookie: `klir_token=${token()}` } }))).status, 200);
    assert.equal(observedAuth?.user.id, 'user-member');
  });

  test('unknown handler/provider errors are sanitized and never leak private details', async () => {
    const wrapped = http.withMediaGuard(async () => {
      throw new Error('private-provider-secret prompt=confidential upstream-body=hidden');
    });
    const error = await expectError(await wrapped(request({ token: token() })), 502, 'PROVIDER_ERROR');
    assert.equal(error.retryable, true);
    assert.doesNotMatch(JSON.stringify(error), /secret|confidential|hidden|upstream/);
  });

  test('database exceptions are sanitized without trying a bootstrap fallback', async () => {
    handlers['user.findUnique'] = () => { throw new Error('private-database-connection-string'); };
    const error = await expectError(await guarded()(request({ token: token() })), 502, 'PROVIDER_ERROR');
    assert.doesNotMatch(error.message, /private|connection/);
    assert.deepEqual(reads.map(read => read.method), ['user.findUnique']);
    assert.equal(handlerCalls, 0);
  });

  test('bounded JSON accepts valid JSON at exactly the byte limit', async () => {
    const body = JSON.stringify({ text: 'a'.repeat(79989) });
    assert.equal(Buffer.byteLength(body), 80000);
    assert.deepEqual(await http.readMediaJson(request({ body })), { text: 'a'.repeat(79989) });
    assert.deepEqual(reads, []);
  });

  test('bounded JSON rejects malformed JSON, empty body and wrong content type', async () => {
    for (const body of ['{broken', '']) {
      await assert.rejects(http.readMediaJson(request({ body })), (error: unknown) =>
        error instanceof Error && 'code' in error && error.code === 'INVALID_INPUT');
    }
    await assert.rejects(http.readMediaJson(request({ body: '{}', headers: { 'Content-Type': 'text/plain' } })),
      (error: unknown) => error instanceof Error && 'status' in error && error.status === 415);
  });

  test('bounded JSON rejects oversized declared, actual and multibyte bodies', async () => {
    for (const req of [
      request({ body: '{}', headers: { 'Content-Length': '80001' } }),
      request({ body: JSON.stringify({ text: 'a'.repeat(80000) }) }),
      request({ body: JSON.stringify({ text: 'é'.repeat(40000) }) }),
      request({ body: JSON.stringify({ text: 'a'.repeat(80000) }), headers: { 'Content-Length': '1' } }),
    ]) {
      await assert.rejects(http.readMediaJson(req), (error: unknown) =>
        error instanceof Error && 'code' in error && error.code === 'FILE_TOO_LARGE' && 'status' in error && error.status === 413);
    }
    assert.deepEqual(reads, []);
  });

  test('real generate route returns planned video with zero provider fetch when video capability is off', async () => {
    // Item 4.6 (7 Sep): video sekarang genuinely render kalau capability ON (lihat
    // tests/media-provider.test.ts untuk skenario itu) -- test HTTP/guard ini
    // sengaja menonaktifkan capability-nya secara eksplisit (bukan bergantung diam-
    // diam ke .env asli) supaya "zero provider fetch" tetap jaminan yang benar dan
    // deterministik, murni menguji lapisan auth/guard, bukan logic provider video.
    const previousOr = process.env.OPENROUTER_API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    try {
      const { POST } = await import('../src/app/api/v1/media/generate/route');
      const response = await POST(request({ token: token(), body: '{"kind":"video","workspaceId":"ws-foreign","prompt":"Cuplikan promosi kopi 8 detik","role":"marketing"}' }));
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.success, true); assert.equal(body.data.kind, 'video');
      assert.equal(body.data.status, 'planned'); assert.equal(body.data.availableAlternative, 'video-plan');
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
      // Trailing 'activityEvent.create' is the non-fatal recordActivity audit write
      // (src/lib/activity-log.ts) fired after the video branch succeeds.
      assert.deepEqual(reads.map(read => read.method), ['user.findUnique', 'workspace.findUnique', 'workspace.findUnique', 'activityEvent.create']);
      assert.deepEqual(networkCalls, []);
    } finally {
      if (previousOr === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previousOr;
    }
  });

  test('real generate route rejects video request with no prompt before any provider work', async () => {
    const { POST } = await import('../src/app/api/v1/media/generate/route');
    const response = await POST(request({ token: token(), body: '{"kind":"video","workspaceId":"ws-foreign","role":"marketing"}' }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.deepEqual(networkCalls, []);
  });
});
