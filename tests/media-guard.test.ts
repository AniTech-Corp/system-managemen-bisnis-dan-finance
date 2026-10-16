import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { NextRequest, NextResponse } from 'next/server';

type Query = { where?: { id?: string }; include?: unknown };
type WorkspaceFixture = { id: string; name: string; slug: string; ownerId: string; members: Array<{ role: 'MEMBER' }>; resourceGrants: never[] };

// Interim P8 guards inside withMediaGuard: idempotency coalescing + sliding-window rate limit.
// Same harness as media-http.test.ts: real test JWTs, in-memory Prisma proxy, network forbidden.
describe('media guard interim idempotency and rate limit', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  const ENV_KEYS = ['JWT_SECRET', 'MEDIA_RATE_LIMIT_PER_MIN', 'MEDIA_IDEMPOTENCY_TTL_MS', 'MEDIA_IDEMPOTENCY_MAX_ENTRIES', 'MEDIA_IDEMPOTENCY_MAX_BODY_BYTES'] as const;
  const previousEnv: Partial<Record<typeof ENV_KEYS[number], string | undefined>> = {};
  let previousPrisma: PropertyDescriptor | undefined;
  let originalFetch: typeof globalThis.fetch;
  let http: typeof import('../src/lib/media-http');
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let forbiddenCalls: string[] = [];
  let networkCalls: string[] = [];
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let handlerCalls = 0;
  let clock = 1_700_000_000_000;
  const now = () => clock;

  const fakePrisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      if (model.startsWith('$')) return async () => { forbiddenCalls.push(model); throw new Error(`Forbidden Prisma operation: ${model}`); };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: Query) => {
            const method = `${model}.${operation}`;
            if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
            if (method === 'workspace.findUnique') {
              const workspace = workspaces.get(query.where?.id ?? '');
              return workspace ? query.include ? workspace : { id: workspace.id } : null;
            }
            forbiddenCalls.push(method); throw new Error(`Forbidden Prisma operation: ${method}`);
          };
        },
      });
    },
  });

  before(async () => {
    for (const key of ENV_KEYS) previousEnv[key] = process.env[key];
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    originalFetch = globalThis.fetch;
    process.env.JWT_SECRET = 'media-guard-tests-only-signing-secret-4f1e2c9a-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      networkCalls.push(input instanceof Request ? input.url : String(input));
      throw new Error('Network prohibited in media guard tests');
    };
    http = await import('../src/lib/media-http');
    ({ signJwtToken } = await import('../src/lib/auth'));
  });

  beforeEach(() => {
    forbiddenCalls = []; networkCalls = []; handlerCalls = 0; clock = 1_700_000_000_000;
    delete process.env.MEDIA_RATE_LIMIT_PER_MIN; delete process.env.MEDIA_IDEMPOTENCY_TTL_MS;
    delete process.env.MEDIA_IDEMPOTENCY_MAX_ENTRIES; delete process.env.MEDIA_IDEMPOTENCY_MAX_BODY_BYTES;
    http.resetMediaGuardState();
    users = new Map([
      ['user-a', { id: 'user-a', email: 'a@example.invalid', fullName: 'User A', isSuperAdmin: false }],
      ['user-b', { id: 'user-b', email: 'b@example.invalid', fullName: 'User B', isSuperAdmin: false }],
    ]);
    workspaces = new Map([['ws-1', { id: 'ws-1', name: 'Workspace 1', slug: 'ws-1', ownerId: 'someone-else', members: [{ role: 'MEMBER' }], resourceGrants: [] }]]);
  });

  afterEach(() => {
    assert.deepEqual(forbiddenCalls, []);
    assert.deepEqual(networkCalls, []);
  });

  after(() => {
    http.resetMediaGuardState();
    globalThis.fetch = originalFetch;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  });

  function token(userId = 'user-a') { return signJwtToken({ userId, workspaceId: 'ws-1' }); }
  function request(options: { method?: 'POST' | 'GET'; userId?: string; key?: string; path?: string; body?: string } = {}) {
    const method = options.method ?? 'POST';
    return new NextRequest(`https://klir.test${options.path ?? '/api/v1/media/generate'}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(options.userId)}`, ...(options.key ? { 'Idempotency-Key': options.key } : {}) },
      ...(method === 'POST' ? { body: options.body ?? '{"kind":"audio"}' } : {}),
    });
  }
  type Gate = { release: () => void; wait: Promise<void> };
  function gate(): Gate { let release = () => {}; const wait = new Promise<void>(resolve => { release = resolve; }); return { release, wait }; }
  function guarded(options: { gate?: Gate; body?: () => unknown; fail?: boolean } = {}) {
    return http.withMediaGuard(async () => {
      handlerCalls++;
      if (options.gate) await options.gate.wait;
      if (options.fail) throw new Error('provider exploded');
      return NextResponse.json({ success: true, call: handlerCalls, ...(options.body ? { extra: options.body() } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
    }, { now });
  }
  const flush = () => new Promise<void>(resolve => setImmediate(resolve));

  test('two parallel POSTs with the same Idempotency-Key run the handler once and share the body', async () => {
    const g = gate();
    const route = guarded({ gate: g });
    const first = route(request({ key: 'audio-1' }));
    const second = route(request({ key: 'audio-1' }));
    await flush();
    assert.equal(handlerCalls, 1, 'second request must wait on the in-flight handler, not start a new one');
    g.release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    const [bodyA, bodyB] = await Promise.all([a.text(), b.text()]);
    assert.equal(bodyA, bodyB);
    assert.equal(JSON.parse(bodyA).call, 1);
    assert.equal(a.headers.get('Idempotency-Replayed'), null);
    assert.equal(b.headers.get('Idempotency-Replayed'), 'coalesced');
    assert.equal(b.headers.get('Content-Type'), a.headers.get('Content-Type'));
    assert.equal(b.headers.get('Cache-Control'), 'no-store');
    assert.equal(handlerCalls, 1);
  });

  test('different Idempotency-Keys run the handler separately', async () => {
    const route = guarded();
    const [a, b] = await Promise.all([route(request({ key: 'audio-1' })), route(request({ key: 'audio-2' }))]);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.equal(handlerCalls, 2);
    assert.notEqual(await a.text(), await b.text());
  });

  test('rate limit of 2 per minute rejects the third POST with 429 and recovers after the window', async () => {
    process.env.MEDIA_RATE_LIMIT_PER_MIN = '2';
    const route = guarded();
    assert.equal((await route(request())).status, 200);
    clock += 10_000;
    assert.equal((await route(request())).status, 200);
    clock += 10_000;
    const limited = await route(request());
    assert.equal(limited.status, 429);
    const body = await limited.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'RATE_LIMITED');
    assert.equal(body.error.retryable, true);
    assert.match(body.error.message, /permintaan/i);
    assert.equal(limited.headers.get('Retry-After'), '40');
    assert.equal(limited.headers.get('Cache-Control'), 'no-store');
    assert.equal(handlerCalls, 2);
    // Another user in the same workspace has an independent window.
    assert.equal((await route(request({ userId: 'user-b' }))).status, 200);
    assert.equal(handlerCalls, 3);
    // Sliding window: 61s after the first hit only one hit remains inside the window.
    clock += 41_000;
    assert.equal((await route(request())).status, 200);
    assert.equal((await route(request())).status, 429);
    assert.equal(handlerCalls, 4);
  });

  test('rate limit 0 disables the limiter', async () => {
    process.env.MEDIA_RATE_LIMIT_PER_MIN = '0';
    const route = guarded();
    for (let i = 0; i < 40; i++) assert.equal((await route(request())).status, 200);
    assert.equal(handlerCalls, 40);
  });

  test('GET is untouched by idempotency and rate limiting', async () => {
    process.env.MEDIA_RATE_LIMIT_PER_MIN = '1';
    const route = guarded();
    const a = await route(request({ method: 'GET', key: 'same-key', path: '/api/v1/media/models' }));
    const b = await route(request({ method: 'GET', key: 'same-key', path: '/api/v1/media/models' }));
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    assert.equal(handlerCalls, 2);
    assert.equal(b.headers.get('Idempotency-Replayed'), null);
    assert.notEqual(await a.text(), await b.text());
  });

  test('completed POST is replayed from cache within TTL and re-executed after expiry', async () => {
    process.env.MEDIA_IDEMPOTENCY_TTL_MS = '1000';
    const route = guarded();
    const first = await route(request({ key: 'audio-1' }));
    const firstBody = await first.text();
    clock += 999;
    const replay = await route(request({ key: 'audio-1' }));
    assert.equal(replay.headers.get('Idempotency-Replayed'), 'replayed');
    assert.equal(await replay.text(), firstBody);
    assert.equal(handlerCalls, 1);
    clock += 2;
    const fresh = await route(request({ key: 'audio-1' }));
    assert.equal(fresh.headers.get('Idempotency-Replayed'), null);
    assert.equal(JSON.parse(await fresh.text()).call, 2);
    assert.equal(handlerCalls, 2);
  });

  test('idempotency scope is per user, per path and ignores keys longer than 200 chars', async () => {
    const route = guarded();
    await route(request({ key: 'shared' }));
    await route(request({ key: 'shared', userId: 'user-b' }));
    assert.equal(handlerCalls, 2, 'same key from another user must not replay');
    await route(request({ key: 'shared', path: '/api/v1/media/transcribe' }));
    assert.equal(handlerCalls, 3, 'same key on another path must not replay');
    await route(request({ key: 'x'.repeat(201) }));
    await route(request({ key: 'x'.repeat(201) }));
    assert.equal(handlerCalls, 5, 'oversized keys are treated as absent');
    await route(request({ key: 'x'.repeat(200) }));
    await route(request({ key: 'x'.repeat(200) }));
    assert.equal(handlerCalls, 6, 'a 200-char key is still honoured');
  });

  test('handler failures propagate to coalesced waiters and are never cached', async () => {
    const g = gate();
    const route = guarded({ gate: g, fail: true });
    const first = route(request({ key: 'boom' }));
    const second = route(request({ key: 'boom' }));
    await flush();
    g.release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.status, 502); assert.equal(b.status, 502);
    assert.equal((await a.json()).error.code, 'PROVIDER_ERROR');
    assert.equal(handlerCalls, 1);
    const retry = await route(request({ key: 'boom' }));
    assert.equal(retry.status, 502);
    assert.equal(handlerCalls, 2, 'a failed result must not be replayed; the retry runs the handler again');
  });

  test('bodies above the cache cap are coalesced in flight but not stored for replay', async () => {
    process.env.MEDIA_IDEMPOTENCY_MAX_BODY_BYTES = '64';
    const g = gate();
    const route = guarded({ gate: g, body: () => 'z'.repeat(200) });
    const first = route(request({ key: 'big' }));
    const second = route(request({ key: 'big' }));
    await flush();
    g.release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(await a.text(), await b.text());
    assert.equal(handlerCalls, 1);
    const later = await route(request({ key: 'big' }));
    assert.equal(later.headers.get('Idempotency-Replayed'), null);
    assert.equal(handlerCalls, 2);
  });

  test('cache entry cap evicts the oldest key first', async () => {
    process.env.MEDIA_IDEMPOTENCY_MAX_ENTRIES = '2';
    const route = guarded();
    await route(request({ key: 'k1' }));
    await route(request({ key: 'k2' }));
    await route(request({ key: 'k3' }));
    assert.equal(handlerCalls, 3);
    assert.equal((await route(request({ key: 'k3' }))).headers.get('Idempotency-Replayed'), 'replayed');
    assert.equal((await route(request({ key: 'k2' }))).headers.get('Idempotency-Replayed'), 'replayed');
    assert.equal(handlerCalls, 3);
    await route(request({ key: 'k1' }));
    assert.equal(handlerCalls, 4, 'k1 was evicted as the oldest entry');
  });

  test('rate-limited request with an Idempotency-Key is not cached and later succeeds', async () => {
    process.env.MEDIA_RATE_LIMIT_PER_MIN = '1';
    const route = guarded();
    assert.equal((await route(request())).status, 200);
    const limited = await route(request({ key: 'after-limit' }));
    assert.equal(limited.status, 429);
    clock += 61_000;
    const ok = await route(request({ key: 'after-limit' }));
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('Idempotency-Replayed'), null);
    assert.equal(handlerCalls, 2);
  });
});
