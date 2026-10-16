import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';
import type { AuthContext } from '../src/lib/tenant-guard';

// -----------------------------------------------------------------------------
// POST /api/v1/brain/execute is the most sensitive brain route: actionType
// 'SCALE_MARKETING' is a REAL database write (prisma.promoCoupon.create --
// 15% discount, quota 150). Before the fix, workspaceId came straight from the
// request body/header/query (no auth at all), so anyone could trigger a real
// coupon write against any workspace in the database. These tests prove the
// route is now wired to authenticateTenantRequest() from '@/lib/tenant-guard'
// with minRole MANAGER, that the coupon write is never reached when auth/role
// fails, and that workspaceId + approvedBy come only from the verified session
// (never from a spoofed request body).
// -----------------------------------------------------------------------------

type Query = { where?: Record<string, any>; include?: unknown; select?: unknown; data?: Record<string, any>; orderBy?: unknown; take?: number };
type DbCall = { method: string; query: Query };
type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
  onboardingProfile: null;
  corplanProjects: never[];
};

describe('brain/execute route -- tenant guard wiring and real-attribution', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let POST: typeof import('../src/app/api/v1/brain/execute/route')['POST'];
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let DecisionMemoryEngine: typeof import('../src/lib/ai-brain/decision-memory-engine')['DecisionMemoryEngine'];

  let reads: DbCall[] = [];
  let requestSeq = 0;
  let forbiddenCalls: string[] = [];
  let promoCouponCreateCalls: Query[] = [];
  let activityEvents: Array<{ workspaceId: string; type: string; payload: unknown; createdAt: Date }> = [];
  let users: Map<string, AuthContext['user']>;
  let workspaces: Map<string, WorkspaceFixture>;
  let handlers: Record<string, (query: Query) => unknown>;

  // Every unconfigured Prisma method (including any write besides the one handler we
  // define below) is trapped and fails the test via afterEach. This object has no path
  // to a real database.
  const fakePrisma = new Proxy(
    {},
    {
      get(_target, model: string) {
        if (model === 'then') return undefined;
        if (model === '$transaction') {
          return async (callback: (tx: unknown) => Promise<unknown>) => callback(fakePrisma);
        }
        if (model === '$executeRaw') {
          return async () => 0;
        }
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
                const handler = handlers[method];
                if (!handler) {
                  forbiddenCalls.push(method);
                  throw new Error(`Forbidden Prisma operation: ${method}`);
                }
                reads.push({ method, query });
                if (method === 'promoCoupon.create') promoCouponCreateCalls.push(query);
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
    process.env.JWT_SECRET = 'brain-execute-guard-tests-only-signing-secret-6a2f9c11-do-not-use';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    // Imported only after the fake Prisma singleton and test-only JWT secret are in
    // place, so every transitive import (tenant-guard, auth, ai-brain engines) binds
    // to the fake client / test secret instead of a real database connection.
    ({ POST } = await import('../src/app/api/v1/brain/execute/route'));
    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ DecisionMemoryEngine } = await import('../src/lib/ai-brain/decision-memory-engine'));
  });

  beforeEach(() => {
    reads = [];
    forbiddenCalls = [];
    promoCouponCreateCalls = [];
    activityEvents = [];
    users = new Map([
      ['user-manager', { id: 'user-manager', email: 'manager@example.invalid', fullName: 'Rangga Manager', isSuperAdmin: false }],
      ['user-member', { id: 'user-member', email: 'member@example.invalid', fullName: 'Sari Member', isSuperAdmin: false }],
    ]);
    workspaces = new Map([
      [
        'ws-real',
        {
          id: 'ws-real',
          name: 'Real Workspace',
          slug: 'real-ws',
          ownerId: 'someone-else-owner',
          members: [],
          resourceGrants: [],
          onboardingProfile: null,
          corplanProjects: [],
        },
      ],
    ]);
    handlers = {
      'user.findUnique': ({ where }) => users.get(where?.id ?? '') ?? null,
      'workspace.findUnique': ({ where }) => {
        const ws = workspaces.get(where?.id ?? '');
        return ws ? { ...ws } : null;
      },
      // Downstream ExecutionEngine.executeAction -> ContextEngine.getSnapshot reads.
      'cashTransaction.findMany': () => [],
      'invoice.findMany': () => [],
      'promoCoupon.findMany': () => [],
      'workTask.findMany': () => [],
      // context-engine.ts (push Fatur 6 Sep) baca [COMPANY_PROFILE] via
      // memoryItem.findFirst, tenant-scoped -- bukan lubang keamanan, cuma perlu
      // di-allow-list.
      'memoryItem.findFirst': () => null,
      // Durable idempotency receipt used by ExecutionEngine after a successful
      // action. The fake keeps it in-memory so replay behavior is testable
      // without a real database.
      'activityEvent.findMany': ({ where }) => activityEvents.filter((event) => event.workspaceId === where?.workspaceId && event.type === where?.type),
      'activityEvent.create': ({ data }) => {
        const event = { workspaceId: data!.workspaceId, type: String(data!.type), payload: data!.payload, createdAt: new Date() };
        activityEvents.push(event);
        return event;
      },
      // The write under test. Only reached when auth + role checks both pass.
      'promoCoupon.create': ({ data }) => ({ id: 'coupon-test-1', ...data }),
    };
  });

  afterEach(() => {
    assert.deepEqual(forbiddenCalls, [], 'No unconfigured/unexpected Prisma operation should ever be reached');
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function managerToken() {
    return signJwtToken({ userId: 'user-manager', workspaceId: 'ws-real' });
  }
  function memberToken() {
    return signJwtToken({ userId: 'user-member', workspaceId: 'ws-real' });
  }
  function request(options: { token?: string; body?: Record<string, any> } = {}) {
    return new NextRequest('https://klir.test/api/v1/brain/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `test-idempotency-key-${++requestSeq}`,
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify(
        options.body ?? {
          recommendationId: 'rec-mkt-create-coupon',
          actionType: 'SCALE_MARKETING',
          actionPayload: { scaleBudgetPercent: 25 },
        }
      ),
    });
  }

  test('POST without any token is rejected before any database read or coupon write', async () => {
    const response = await POST(request());
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.code, 'AUTH_REQUIRED');
    assert.deepEqual(reads, [], 'no Prisma read should happen for an unauthenticated caller');
    assert.equal(promoCouponCreateCalls.length, 0);
  });

  test('valid token but role below MANAGER (MEMBER) is rejected, coupon never created', async () => {
    workspaces.get('ws-real')!.members = [{ role: 'MEMBER' }];
    const response = await POST(request({ token: memberToken() }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.code, 'INSUFFICIENT_ROLE');
    assert.equal(promoCouponCreateCalls.length, 0);
  });

  test('valid MANAGER token succeeds using the session workspace (spoofed body workspaceId ignored) and real approvedBy', async () => {
    workspaces.get('ws-real')!.members = [{ role: 'MANAGER' }];
    const response = await POST(
      request({
        token: managerToken(),
        body: {
          recommendationId: 'rec-mkt-create-coupon',
          actionType: 'SCALE_MARKETING',
          actionPayload: { scaleBudgetPercent: 25 },
          // Spoofing attempt: attacker-controlled body tries to redirect the write to a
          // workspace it does not belong to, and tries to fake the approver identity.
          workspaceId: 'ws-spoofed-attacker-workspace',
          approvedBy: 'Attacker Fake Name',
        },
      })
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);

    assert.equal(promoCouponCreateCalls.length, 1, 'coupon must be created exactly once');
    assert.equal(promoCouponCreateCalls[0].data?.workspaceId, 'ws-real', 'coupon must be scoped to the session workspace');
    assert.ok(
      reads.every((read) => read.query.where?.id !== 'ws-spoofed-attacker-workspace'),
      'the spoofed workspaceId from the body must never be queried'
    );

    const decision = DecisionMemoryEngine.getDecisionById('ws-real', body.data.decisionMemoryId);
    assert.equal(decision?.approvedBy, 'Rangga Manager', 'approvedBy must reflect the authenticated caller');
    assert.notEqual(decision?.approvedBy, 'Attacker Fake Name');
    assert.notEqual(decision?.approvedBy, 'CEO / Business Owner');
  });

  test('OWNER (no explicit membership row, ownerId match) is also accepted at MANAGER threshold', async () => {
    const ws = workspaces.get('ws-real')!;
    ws.ownerId = 'user-manager';
    ws.members = [];
    const response = await POST(request({ token: managerToken() }));
    assert.equal(response.status, 200);
    assert.equal(promoCouponCreateCalls.length, 1);
    const body = await response.json();
    const decision = DecisionMemoryEngine.getDecisionById('ws-real', body.data.decisionMemoryId);
    assert.equal(decision?.approvedBy, 'Rangga Manager');
  });
});
