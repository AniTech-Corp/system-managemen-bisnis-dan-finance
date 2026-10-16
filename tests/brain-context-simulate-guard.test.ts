import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// -----------------------------------------------------------------------------
// KELOMPOK B -- guard tests for /api/v1/brain/context (GET) and
// /api/v1/brain/simulate (POST). Verifies both routes now resolve workspaceId
// EXCLUSIVELY via authenticateTenantRequest() (session/JWT), never from
// searchParams/body/header supplied by the caller.
//
// Fake Prisma below traps every model.operation call; anything not explicitly
// configured throws "Forbidden Prisma operation" so a wrongly-skipped guard
// (which would fall straight into getOrBuildBusinessContext's own broader
// query set) is caught immediately rather than silently reading real-shaped
// data.
// -----------------------------------------------------------------------------

type Query = {
  where?: Record<string, any>;
  include?: Record<string, any>;
  select?: Record<string, any>;
};
type DbCall = { method: string; query: Query };
type UserFixture = { id: string; email: string; fullName: string; isSuperAdmin: boolean };
type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('brain/context + brain/simulate: tenant-guard wiring (real JWT + in-memory Prisma)', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let invalidateContextCache: typeof import('../src/lib/ai-brain')['invalidateContextCache'];
  let contextGET: typeof import('../src/app/api/v1/brain/context/route')['GET'];
  let simulatePOST: typeof import('../src/app/api/v1/brain/simulate/route')['POST'];

  let reads: DbCall[] = [];
  let forbiddenCalls: string[] = [];
  let users: Map<string, UserFixture>;
  let workspaces: Map<string, WorkspaceFixture>;
  let handlers: Record<string, (query: Query) => unknown>;
  let contextCallsFor: string[]; // workspaceIds passed to cashTransaction.findMany (proxy for getOrBuildBusinessContext scope)

  // Every unconfigured Prisma method (including writes/bootstrap) is trapped --
  // no path to a real database client, and no silent bootstrap fallback.
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
              return async (query: Query) => {
                const method = `${model}.${operation}`;
                const handler = handlers[method];
                if (!handler) {
                  forbiddenCalls.push(method);
                  throw new Error(`Forbidden Prisma operation: ${method}`);
                }
                reads.push({ method, query });
                return handler(query);
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
    process.env.JWT_SECRET = 'brain-guard-tests-only-signing-secret-1a2b3c4d-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    // Import after the fake Prisma singleton and test-only JWT secret are set,
    // so every module that does `globalForPrisma.prisma ?? new PrismaClient()`
    // (src/lib/prisma.ts) picks up the fake instead of a real client.
    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ invalidateContextCache } = await import('../src/lib/ai-brain'));
    ({ GET: contextGET } = await import('../src/app/api/v1/brain/context/route'));
    ({ POST: simulatePOST } = await import('../src/app/api/v1/brain/simulate/route'));
  });

  beforeEach(() => {
    reads = [];
    forbiddenCalls = [];
    contextCallsFor = [];
    invalidateContextCache(); // getOrBuildBusinessContext has a 15-min in-memory cache; clear between tests

    users = new Map([
      ['user-member', { id: 'user-member', email: 'member@example.invalid', fullName: 'Test Member', isSuperAdmin: false }],
    ]);
    workspaces = new Map([
      [
        'ws-member',
        {
          id: 'ws-member',
          name: 'Member workspace',
          slug: 'member',
          ownerId: 'other-owner',
          members: [{ role: 'MEMBER' }],
          resourceGrants: [],
        },
      ],
      [
        'ws-foreign',
        { id: 'ws-foreign', name: 'Foreign (victim) workspace', slug: 'foreign', ownerId: 'foreign-owner', members: [], resourceGrants: [] },
      ],
    ]);

    handlers = {
      'user.findUnique': (query) => users.get(query.where?.id ?? '') ?? null,
      // Real (unchanged) tenant-guard.ts dev-mode fallback for a request with no
      // recognizable userId: "first user in the DB". Configured here so the
      // no-token bootstrap path (below) exercises its REAL logic instead of
      // failing on an unconfigured Prisma call.
      'user.findFirst': () => Array.from(users.values())[0] ?? null,
      'workspace.findUnique': (query) => {
        const ws = workspaces.get(query.where?.id ?? '');
        if (!ws) return null;
        if (query.include?.members) {
          // tenant-guard.ts shape: membership + resourceGrants lookup
          return {
            id: ws.id,
            name: ws.name,
            slug: ws.slug,
            ownerId: ws.ownerId,
            members: ws.members,
            resourceGrants: ws.resourceGrants,
          };
        }
        // context-engine.ts shape: business-data lookup
        return { id: ws.id, name: ws.name, onboardingProfile: null, corplanProjects: [] };
      },
      // Real tenant-guard.ts dev-mode fallback for "no workspace hint at all":
      // ownerId-scoped lookup first, then first workspace in the DB.
      'workspace.findFirst': (query) => {
        if (query.where?.ownerId) {
          const owned = Array.from(workspaces.values()).find((w) => w.ownerId === query.where!.ownerId);
          return owned ? { id: owned.id } : null;
        }
        const first = workspaces.values().next().value as WorkspaceFixture | undefined;
        return first ? { id: first.id } : null;
      },
      'cashTransaction.findMany': (query) => {
        contextCallsFor.push(query.where?.workspaceId as string);
        return [];
      },
      'invoice.findMany': () => [],
      'promoCoupon.findMany': () => [],
      'workTask.findMany': () => [],
      // context-engine.ts (push Fatur 6 Sep, "enhance ... brain context engine")
      // sekarang baca [COMPANY_PROFILE] dari memoryItem, tenant-scoped by
      // workspaceId+scope -- bukan lubang keamanan baru, cuma perlu di-allow-list.
      'memoryItem.findFirst': () => null,
    };
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function token(claims: object = {}) {
    return signJwtToken({ userId: 'user-member', workspaceId: 'ws-member', ...claims });
  }

  function contextRequest(options: { token?: string; query?: string } = {}) {
    return new NextRequest(`https://klir.test/api/v1/brain/context${options.query ?? ''}`, {
      method: 'GET',
      headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
    });
  }

  function simulateRequest(options: { token?: string; body?: string; query?: string } = {}) {
    return new NextRequest(`https://klir.test/api/v1/brain/simulate${options.query ?? ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ?? JSON.stringify({ promptDescription: 'rekrut 2 orang gaji 5jt' }),
    });
  }

  // ---------------------------------------------------------------------------
  // (1) GET brain/context: a token that is present-but-invalid (garbled/expired/
  //     tampered/missing-claims), aimed via ?workspaceId=ws-foreign at a
  //     workspace the caller has no membership in, is denied -- and
  //     getOrBuildBusinessContext(ws-foreign) is never reached.
  //
  // NOTE ON PRECEDENCE (traced from tenant-guard.ts lines 119-124): the guard
  // itself reads ?workspaceId from the URL and x-workspace-id from headers
  // with HIGHER priority than the JWT's own workspaceId claim -- this route's
  // fix (calling authenticateTenantRequest(req, {}) with no requiredWorkspaceId)
  // does not change that precedence, it only stops the ROUTE from separately
  // trusting body/query/header itself. The actual isolation guarantee comes
  // from the guard's real DB membership check further down (lines 176-189):
  // a caller who supplies *any* Authorization header (even a garbage one --
  // `!token` is false as long as SOME string was extracted) is denied 403
  // unless the resolved workspace is one they own or are a member of. That is
  // exactly what this test proves.
  // ---------------------------------------------------------------------------
  test('GET brain/context: present-but-invalid tokens spoofing ?workspaceId=ws-foreign are denied 403, never read ws-foreign', async () => {
    const expired = signJwtToken({ userId: 'user-member', workspaceId: 'ws-member' }, -1);
    const valid = token();
    const tampered = valid.slice(0, valid.lastIndexOf('.') + 1) + 'invalid-signature';
    const noWorkspaceClaim = signJwtToken({ userId: 'user-member' });

    for (const jwt of ['not-a-jwt', expired, tampered, noWorkspaceClaim]) {
      reads = [];
      const response = await contextGET(contextRequest({ token: jwt, query: '?workspaceId=ws-foreign' }));
      assert.equal(response.status, 403, `token ${jwt} must be denied with 403`);
      const body = await response.json();
      assert.equal(body.code, 'TENANT_ACCESS_DENIED');
      assert.ok(!contextCallsFor.includes('ws-foreign'), `token ${jwt} must never reach getOrBuildBusinessContext(ws-foreign)`);
    }
  });

  // ---------------------------------------------------------------------------
  // DOCUMENTED OUT-OF-SCOPE RESIDUAL BEHAVIOR (context pack "A-tambahan",
  // tenant-guard.ts line 176): a request with ZERO Authorization header/cookie
  // AND zero workspace hint (no query, no x-workspace-id) still authenticates
  // successfully, because `token` itself is `null` there and `!token` makes
  // `isOwner` true regardless of real ownership/membership. This is the exact,
  // already-known, separate finding the context pack explicitly told this
  // task NOT to fix (it needs a Fatur/Mecca decision on tenant-guard.ts
  // itself). It is asserted here, honestly, so it is documented rather than
  // silently hidden by an incomplete test suite -- it must NOT be read as
  // "brain/context requires authentication": it does not, yet, for a caller
  // who supplies no Authorization header at all. What this fix DOES close
  // (see the tests above and below) is attacker CONTROL over which workspace
  // is exposed via body/query/header spoofing -- the anonymous caller here
  // gets whichever workspace tenant-guard.ts's own bootstrap resolves to, not
  // one of their choosing.
  // ---------------------------------------------------------------------------
  test('DOCUMENTED OUT-OF-SCOPE: fully anonymous request (no Authorization header at all) still succeeds via tenant-guard.ts dev bootstrap', async () => {
    const response = await contextGET(contextRequest({})); // no Authorization header, no query hint
    assert.equal(response.status, 200, 'tenant-guard.ts `!token` bypass (line 176) is unchanged by this fix -- see NOTE above');
    const body = await response.json();
    assert.equal(body.success, true);
    // Resolves to whichever workspace tenant-guard.ts's own bootstrap picks
    // (first-owned-by-first-user, else first workspace in the DB) -- NOT one
    // an attacker can choose, since this request supplied no hint at all.
    assert.equal(body.data.workspaceId, 'ws-member');
  });

  // ---------------------------------------------------------------------------
  // (2) GET brain/context with a valid token -> workspaceId comes from the
  //     session (JWT claim, validated against real DB membership).
  // ---------------------------------------------------------------------------
  test('GET brain/context: valid token with no spoof resolves workspace from the session (JWT claim + DB membership)', async () => {
    const response = await contextGET(contextRequest({ token: token() }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.workspaceId, 'ws-member');
    assert.deepEqual(contextCallsFor, ['ws-member', 'ws-member']); // all-time + 30d windows, both scoped to session workspace
  });

  test('GET brain/context: valid token + spoofed ?workspaceId=ws-foreign is DENIED 403 (real DB membership check), never reads ws-foreign', async () => {
    const response = await contextGET(contextRequest({ token: token(), query: '?workspaceId=ws-foreign' }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.code, 'TENANT_ACCESS_DENIED');
    assert.ok(!contextCallsFor.includes('ws-foreign'), 'spoofed foreign workspaceId must never reach getOrBuildBusinessContext');
    assert.deepEqual(contextCallsFor, [], 'guard must deny before getOrBuildBusinessContext runs at all');
  });

  test('GET brain/context: forceFresh (?fresh=true) is preserved and still scoped to the session workspace', async () => {
    // Prime the cache first.
    await contextGET(contextRequest({ token: token() }));
    contextCallsFor = [];
    reads = [];
    const response = await contextGET(contextRequest({ token: token(), query: '?fresh=true' }));
    assert.equal(response.status, 200);
    assert.ok(contextCallsFor.length > 0, 'fresh=true must bypass the cache and re-read the session workspace');
    assert.ok(contextCallsFor.every((id) => id === 'ws-member'));
  });

  test('GET brain/context: caller claiming MEMBER of ws-foreign via header alone (no real DB membership) is denied', async () => {
    const response = await contextGET(
      new NextRequest('https://klir.test/api/v1/brain/context', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token()}`, 'x-workspace-id': 'ws-foreign' },
      })
    );
    // x-workspace-id header is honored by authenticateTenantRequest as a
    // *requested* workspace, but 'ws-foreign' has no membership for
    // user-member and is not owned by user-member -> must be denied.
    assert.equal(response.status, 403);
    assert.ok(!contextCallsFor.includes('ws-foreign'));
  });

  // ---------------------------------------------------------------------------
  // (3) POST brain/simulate: a present-but-invalid token, combined with an
  //     explicit attempt (query string; a POST request's URL can still carry
  //     one, and tenant-guard.ts reads it regardless of HTTP method) to target
  //     a workspace the caller has no membership in, is denied 403 and never
  //     reaches getOrBuildBusinessContext(ws-foreign). Mirrors the GET test
  //     above -- see its NOTE ON PRECEDENCE for why an invalid-but-present
  //     token does not, by itself, guarantee rejection (tenant-guard.ts falls
  //     back to "first user in DB" for identity, then does a REAL membership
  //     check against the resolved workspace).
  // ---------------------------------------------------------------------------
  test('POST brain/simulate: present-but-invalid token spoofing ?workspaceId=ws-foreign is denied 403, never reads ws-foreign', async () => {
    const expired = signJwtToken({ userId: 'user-member', workspaceId: 'ws-member' }, -1);
    const response = await simulatePOST(
      simulateRequest({
        token: expired,
        query: '?workspaceId=ws-foreign',
        body: JSON.stringify({ workspaceId: 'ws-foreign', promptDescription: 'test' }),
      })
    );
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.code, 'TENANT_ACCESS_DENIED');
    assert.ok(!contextCallsFor.includes('ws-foreign'));
  });

  // DOCUMENTED OUT-OF-SCOPE RESIDUAL BEHAVIOR (see the GET test of the same
  // name above for the full explanation): a POST with an invalid token and NO
  // workspace hint at all (no query, no x-workspace-id, and the body is never
  // read by the guard) still succeeds via tenant-guard.ts's own bootstrap.
  test('DOCUMENTED OUT-OF-SCOPE: POST brain/simulate with an invalid token and no workspace hint still succeeds via tenant-guard.ts bootstrap', async () => {
    const expired = signJwtToken({ userId: 'user-member', workspaceId: 'ws-member' }, -1);
    const response = await simulatePOST(
      simulateRequest({ token: expired, body: JSON.stringify({ workspaceId: 'ws-foreign', promptDescription: 'test' }) })
    );
    assert.equal(response.status, 200, 'tenant-guard.ts bootstrap fallback is unchanged by this fix -- see NOTE above');
    const body = await response.json();
    assert.equal(body.success, true);
    // Resolves to the DB's own default workspace, never the body's spoofed one.
    assert.ok(contextCallsFor.includes('ws-member'));
    assert.ok(!contextCallsFor.includes('ws-foreign'), 'body.workspaceId=ws-foreign is never read by the guard');
  });

  test('POST brain/simulate: body.workspaceId spoof to a foreign workspace is ignored even with a valid token for a different workspace', async () => {
    const response = await simulatePOST(
      simulateRequest({ token: token(), body: JSON.stringify({ workspaceId: 'ws-foreign', promptDescription: 'test spoof' }) })
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(!contextCallsFor.includes('ws-foreign'), 'body.workspaceId=ws-foreign must never reach getOrBuildBusinessContext');
    assert.ok(contextCallsFor.includes('ws-member'), 'must use the session workspace instead');
  });

  // ---------------------------------------------------------------------------
  // (4) POST brain/simulate with a valid token -> runs normally, simulation
  //     result is produced.
  // ---------------------------------------------------------------------------
  test('POST brain/simulate: valid token produces a full simulation result scoped to the session workspace', async () => {
    const response = await simulatePOST(
      simulateRequest({
        token: token(),
        body: JSON.stringify({
          promptDescription: 'rekrut 2 orang gaji 5jt, naikkan iklan 20%',
          scenarioTitle: 'Ekspansi tim Q4',
        }),
      })
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.scenarioTitle, 'Ekspansi tim Q4');
    assert.ok(Array.isArray(body.data.monthlyProjections));
    assert.equal(body.data.monthlyProjections.length, 6); // default durationMonths
    assert.ok(['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(body.data.riskLevel));
    assert.deepEqual(contextCallsFor, ['ws-member', 'ws-member']);
  });

  test('POST brain/simulate: explicit adjustments override the heuristic prompt parser', async () => {
    const response = await simulatePOST(
      simulateRequest({
        token: token(),
        body: JSON.stringify({
          promptDescription: 'irrelevant text',
          adjustments: { additionalMonthlyExpense: 10000000, durationMonths: 3 },
        }),
      })
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.monthlyProjections.length, 3);
  });
});
