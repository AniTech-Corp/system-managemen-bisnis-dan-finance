import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

/**
 * B1 VIDEO ASYNC (7 Sep 2026, BARU): GET /api/v1/media/video-status?job=.
 * Pola disalin dari tests/media-guard.test.ts (real withMediaGuard, JWT asli, fake
 * Prisma in-memory, jaringan dilarang -- checkVideoJob() saja yang diizinkan lewat
 * fetch, dan hanya dijawab dari mock respond() di bawah, tidak pernah provider
 * sungguhan). Menutupi: auth gate (401/403, sama seperti video-content/route.ts),
 * regex job id (INVALID_INPUT), dan mapping status checkVideoJob diteruskan utuh
 * ke response JSON tanpa dimodifikasi.
 */
describe('GET /api/v1/media/video-status: auth gate + status mapping', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  const ENV_KEYS = ['JWT_SECRET', 'OPENROUTER_API_KEY', 'MARKETING_MEDIA_VIDEO_ENABLED'] as const;
  const previousEnv: Partial<Record<typeof ENV_KEYS[number], string | undefined>> = {};
  let previousPrisma: PropertyDescriptor | undefined;
  let originalFetch: typeof globalThis.fetch;
  let GET: typeof import('../src/app/api/v1/media/video-status/route')['GET'];
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let forbiddenCalls: string[] = [];
  let activityWrites: Array<{ type: string; payload: unknown }> = [];
  let providerCalls: string[] = [];
  let respond: (url: string) => Response;
  type Query = { where?: { id?: string }; include?: unknown; data?: { type?: string; payload?: unknown } };
  type WorkspaceFixture = { id: string; name: string; slug: string; ownerId: string; members: Array<{ role: 'MEMBER' }>; resourceGrants: never[] };
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  type VideoJobFixture = { id: string; providerJobId: string; workspaceId: string; status: string; contentUrl: string | null; costUsd: number | null; createdAt: Date };
  let videoJobs: Map<string, VideoJobFixture>;
  let jobUpdates: Array<{ providerJobId: string; data: Record<string, unknown> }> = [];

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
              return workspace ? (query.include ? workspace : { id: workspace.id }) : null;
            }
            // recordActivity() ditulis dari checkVideoJob HANYA saat status terminal
            // (ready/failed) -- dicatat di sini (bukan ditolak) supaya bisa diverifikasi,
            // dan supaya panggilan fire-and-forget-nya tidak melempar unhandled rejection.
            if (method === 'activityEvent.create') {
              activityWrites.push({ type: String(query.data?.type), payload: query.data?.payload });
              return {};
            }
            // VideoJob (7 Sep malam): pagar kepemilikan job -> workspace. Fixture: job
            // 'job-abc123' milik ws-1; job lain / workspace lain -> null (404 di route).
            if (method === 'videoJob.findFirst') {
              const w = (query as { where?: { providerJobId?: string; workspaceId?: string } }).where;
              const job = videoJobs.get(w?.providerJobId ?? '');
              return job && job.workspaceId === w?.workspaceId ? job : null;
            }
            if (method === 'videoJob.updateMany') {
              const q = query as { where?: { providerJobId?: string }; data?: Record<string, unknown> };
              const job = videoJobs.get(q.where?.providerJobId ?? '');
              if (!job) return { count: 0 };
              videoJobs.set(job.providerJobId, { ...job, ...(q.data ?? {}) });
              jobUpdates.push({ providerJobId: job.providerJobId, data: q.data ?? {} });
              return { count: 1 };
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
    process.env.JWT_SECRET = 'media-video-status-route-tests-only-signing-secret-9d2e5f1b-do-not-use-in-production';
    process.env.OPENROUTER_API_KEY = 'test-only-openrouter-key-not-real-1234567890';
    delete process.env.MARKETING_MEDIA_VIDEO_ENABLED;
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      const url = input instanceof Request ? input.url : String(input);
      providerCalls.push(url);
      return respond(url);
    };
    ({ GET } = await import('../src/app/api/v1/media/video-status/route'));
    ({ signJwtToken } = await import('../src/lib/auth'));
  });

  beforeEach(() => {
    forbiddenCalls = []; activityWrites = []; providerCalls = []; jobUpdates = [];
    videoJobs = new Map([
      ['job-abc123', { id: 'vj-1', providerJobId: 'job-abc123', workspaceId: 'ws-1', status: 'PENDING', contentUrl: null, costUsd: null, createdAt: new Date('2026-09-07T12:00:00Z') }],
      ['job-other1', { id: 'vj-2', providerJobId: 'job-other1', workspaceId: 'ws-9', status: 'PENDING', contentUrl: null, costUsd: null, createdAt: new Date('2026-09-07T12:00:00Z') }],
    ]);
    respond = () => { throw new Error('Unexpected mocked provider call'); };
    users = new Map([['user-a', { id: 'user-a', email: 'a@example.invalid', fullName: 'User A', isSuperAdmin: false }]]);
    workspaces = new Map([
      ['ws-1', { id: 'ws-1', name: 'Workspace 1', slug: 'ws-1', ownerId: 'someone-else', members: [{ role: 'MEMBER' }], resourceGrants: [] }],
      // Workspace tanpa membership user-a sama sekali -- dipakai kasus 403.
      ['ws-2', { id: 'ws-2', name: 'Workspace 2', slug: 'ws-2', ownerId: 'someone-else', members: [], resourceGrants: [] }],
    ]);
  });

  afterEach(() => {
    assert.deepEqual(forbiddenCalls, [], 'No write, raw SQL or unconfigured Prisma operation is allowed');
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  });

  function request(options: { job?: string; token?: string; workspaceId?: string } = {}) {
    const workspaceId = options.workspaceId ?? 'ws-1';
    const job = options.job ?? 'job-abc123';
    const headers: Record<string, string> = {};
    if (options.token !== '') headers.Authorization = `Bearer ${options.token ?? signJwtToken({ userId: 'user-a', workspaceId })}`;
    return new NextRequest(`https://klir.test/api/v1/media/video-status?job=${encodeURIComponent(job)}`, { headers });
  }

  test('tanpa token -> 401 AUTH_REQUIRED, nol panggilan provider', async () => {
    const response = await GET(request({ token: '' }));
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'AUTH_REQUIRED');
    assert.deepEqual(providerCalls, []);
  });

  test('user bukan anggota workspace -> 403 ACCESS_DENIED, nol panggilan provider', async () => {
    const response = await GET(request({ workspaceId: 'ws-2' }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'ACCESS_DENIED');
    assert.deepEqual(providerCalls, []);
  });

  test('job id yang tidak match regex -> 400 INVALID_INPUT, nol panggilan provider', async () => {
    for (const job of ['ab', 'job with spaces', 'a'.repeat(81), '']) {
      const response = await GET(request({ job }));
      assert.equal(response.status, 400, `job=${JSON.stringify(job)}`);
      const body = await response.json();
      assert.equal(body.error.code, 'INVALID_INPUT');
    }
    assert.deepEqual(providerCalls, []);
  });

  test('job milik workspace lain / tidak terdaftar -> 404 NOT_FOUND, nol panggilan provider (pagar VideoJob)', async () => {
    for (const job of ['job-other1', 'job-unknown']) {
      const response = await GET(request({ job }));
      assert.equal(response.status, 404, `job=${job}`);
      const body = await response.json();
      assert.equal(body.error.code, 'NOT_FOUND');
    }
    assert.deepEqual(providerCalls, []);
    assert.deepEqual(jobUpdates, []);
  });

  test('job yang sudah COMPLETED di DB dijawab dari DB tanpa memanggil provider', async () => {
    videoJobs.set('job-abc123', { ...videoJobs.get('job-abc123')!, status: 'COMPLETED', contentUrl: '/api/v1/media/video-content?job=job-abc123&index=0', costUsd: 0.5 });
    const response = await GET(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, 'ready');
    assert.equal(body.data.url, '/api/v1/media/video-content?job=job-abc123&index=0');
    assert.equal(body.data.usage.costUsd, 0.5);
    assert.deepEqual(providerCalls, []);
  });

  test('status in_progress dari checkVideoJob diteruskan utuh sebagai pending, TIDAK mencatat activity', async () => {
    respond = () => Response.json({ id: 'job-abc123', status: 'in_progress' });
    const response = await GET(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, { success: true, data: { status: 'pending', attempted: true } });
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    // status transit -- BUKAN terminal, tidak boleh membanjiri activity log tiap poll 4 detik.
    assert.deepEqual(activityWrites, []);
  });

  test('status completed diteruskan sebagai ready + url proxy, MENCATAT activity', async () => {
    respond = () => Response.json({ id: 'job-abc123', status: 'completed', unsigned_urls: ['https://openrouter.ai/videos/job-abc123.mp4'], usage: { cost: 0.5 } });
    const response = await GET(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, 'ready');
    assert.equal(body.data.url, '/api/v1/media/video-content?job=job-abc123&index=0');
    assert.equal(body.data.usage.costUsd, 0.5);
    assert.deepEqual(activityWrites, [{ type: 'media.generate', payload: { kind: 'video', status: 'ready' } }]);
    // Baris VideoJob diperbarui ke COMPLETED + url proxy + biaya (bukan cuma dikirim ke client).
    assert.equal(jobUpdates.length, 1);
    assert.equal(jobUpdates[0].data.status, 'COMPLETED');
    assert.equal(jobUpdates[0].data.contentUrl, '/api/v1/media/video-content?job=job-abc123&index=0');
    assert.equal(jobUpdates[0].data.costUsd, 0.5);
    assert.equal('providerStatus' in body.data, false, 'providerStatus internal tidak boleh bocor ke client');
  });

  test('status failed diteruskan sebagai failed + note jujur, MENCATAT activity', async () => {
    respond = () => Response.json({ id: 'job-abc123', status: 'failed', error: 'provider overloaded' });
    const response = await GET(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, 'failed');
    assert.match(body.data.note, /gagal/i);
    assert.deepEqual(activityWrites, [{ type: 'media.generate', payload: { kind: 'video', status: 'failed' } }]);
    assert.equal(jobUpdates[0]?.data.status, 'FAILED');
  });

  test('status expired dari provider dicatat sebagai EXPIRED di VideoJob', async () => {
    respond = () => Response.json({ id: 'job-abc123', status: 'expired' });
    const response = await GET(request());
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.status, 'failed');
    assert.equal(jobUpdates[0]?.data.status, 'EXPIRED');
  });

  test('capability video mati -> 503 NO_PROVIDER, nol panggilan provider', async () => {
    process.env.MARKETING_MEDIA_VIDEO_ENABLED = 'false';
    try {
      const response = await GET(request());
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.equal(body.error.code, 'NO_PROVIDER');
      assert.deepEqual(providerCalls, []);
    } finally { delete process.env.MARKETING_MEDIA_VIDEO_ENABLED; }
  });
});
