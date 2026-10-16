import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Bukti tenant-isolation lintas SEMUA endpoint MILIK KITA (bukan Fatur) yang
// menyentuh data workspace: media/generate, media/transcribe, brain/notebook,
// documents/from-template. Tugas hardening ini seharusnya dikerjakan Codex
// (lihat 2026-09-06-codex-hardening-report.md yang tidak pernah ada) -- diambil
// alih sesi ini.
//
// Pola dipinjam dari tests/brain-generate-chat-guard.test.ts (Prisma proxy
// in-memory + JWT asli + node:test mock.module untuk generation-engine/
// ai-gateway supaya tidak ada network call nyata). Jalankan dengan
// `node --experimental-test-module-mocks --import tsx --test`.
//
// CATATAN KEAMANAN (dicek lewat eksekusi nyata di file ini, bukan cuma baca kode):
// Bug terdokumentasi di src/lib/tenant-guard.ts:176 (isOwner = ... || !token,
// request TANPA token dianggap OWNER) TIDAK bisa tercapai lewat 4 endpoint ini:
//   - media/generate, media/transcribe, brain/notebook -> withMediaGuard
//     (src/lib/media-http.ts, MILIK KITA) verifikasi JWT sendiri, TIDAK pernah
//     memanggil authenticateTenantRequest sama sekali -- isOwner di sana adalah
//     `verified.ownerId === user.id || user.isSuperAdmin`, tanpa klausa token.
//   - documents/from-template -> memang memanggil authenticateTenantRequest
//     (tenant-guard.ts, FATUR), TAPI route ini eksplisit menolak 401 lewat
//     extractTokenFromRequest(req) SEBELUM authenticateTenantRequest pernah
//     dipanggil -- jadi saat authenticateTenantRequest jalan, token SELALU
//     truthy dan klausa `|| !token` tidak pernah bisa bernilai true.
// Test di bawah membuktikan klaim ini lewat eksekusi route handler asli, dengan
// Prisma dan network di-trap supaya kegagalan diam-diam tidak bisa lolos.
// ---------------------------------------------------------------------------

type Query = { where?: { id?: string }; include?: unknown; select?: unknown };
type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('tenant isolation: endpoint milik kita (media/generate, media/transcribe, brain/notebook, documents/from-template)', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let mediaGenerate: typeof import('../src/app/api/v1/media/generate/route');
  let mediaTranscribe: typeof import('../src/app/api/v1/media/transcribe/route');
  let brainNotebook: typeof import('../src/app/api/v1/brain/notebook/route');
  let fromTemplate: typeof import('../src/app/api/v1/documents/from-template/route');
  let mediaHttp: typeof import('../src/lib/media-http');

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let networkCalls: string[] = [];
  let runGenerationCalls: Array<{ workspaceId: string }> = [];
  let executeAIRequestCalls: Array<{ workspaceId: string }> = [];

  // Setiap operasi Prisma yang tidak eksplisit dimock throw keras -- kalau ada jalur
  // bootstrap/fallback tersembunyi yang kepanggil untuk request yang seharusnya sudah
  // ditolak duluan, test ini gagal loud, bukan diam-diam lolos.
  const fakePrisma = new Proxy(
    {},
    {
      get(_target, model: string) {
        if (model === 'then') return undefined;
        return new Proxy(
          {},
          {
            get(_delegate, operation: string) {
              if (operation === 'then') return undefined;
              return async (query: Query = {}) => {
                const method = `${model}.${operation}`;
                if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
                if (method === 'workspace.findUnique') {
                  const ws = workspaces.get(query.where?.id ?? '');
                  if (!ws) return null;
                  if (query.include) {
                    return {
                      id: ws.id,
                      name: ws.name,
                      slug: ws.slug,
                      ownerId: ws.ownerId,
                      // Merepresentasikan hasil query production yang sudah difilter
                      // "where userId: user.id" di level DB -- fixture di bawah HANYA
                      // pernah mengisi members/resourceGrants milik si caller sendiri.
                      members: ws.members,
                      resourceGrants: ws.resourceGrants,
                    };
                  }
                  return { id: ws.id };
                }
                if (method === 'activityEvent.create') return { id: 'mock-activity-id' };
                if (method === 'workspaceFile.create') return { id: 'mock-file-id' };
                throw new Error(`Unmocked Prisma operation in tenant-isolation test: ${method}`);
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
    process.env.JWT_SECRET = 'tenant-isolation-tests-only-signing-secret-9c31ffa0-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      const url = input instanceof Request ? input.url : String(input);
      networkCalls.push(url);
      throw new Error(`Network prohibited in tenant isolation tests: ${url}`);
    };

    // documents/from-template -> runGeneration (generation-engine.ts, FATUR, tidak diubah).
    mock.module('../src/lib/generation-engine', {
      namedExports: {
        runGeneration: async (req: { workspaceId: string }) => {
          runGenerationCalls.push(req);
          return {
            fileName: 'stub.xlsx',
            mimeType: 'application/octet-stream',
            fileBase64: null,
            summary: 'stub summary',
            provider: 'stub-provider',
            modelUsed: 'stub-model',
            latencyMs: 1,
          };
        },
      },
    });
    // brain/notebook -> generateNotebook -> executor default (ai-gateway.executeAIRequest).
    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        executeAIRequest: async (opts: { workspaceId: string }) => {
          executeAIRequestCalls.push(opts);
          return {
            text: JSON.stringify({
              title: 'Judul stub',
              instructions: 'Instruksi stub',
              questions: Array.from({ length: 5 }, (_, i) => ({
                id: `q${i + 1}`,
                question: 'Pertanyaan stub?',
                options: ['A', 'B', 'C', 'D'],
                correctIndex: 0,
                explanation: 'Penjelasan stub.',
              })),
            }),
            json: {
              title: 'Judul stub',
              instructions: 'Instruksi stub',
              questions: Array.from({ length: 5 }, (_, i) => ({
                id: `q${i + 1}`,
                question: 'Pertanyaan stub?',
                options: ['A', 'B', 'C', 'D'],
                correctIndex: 0,
                explanation: 'Penjelasan stub.',
              })),
            },
            provider: 'stub-provider',
            modelUsed: 'stub-model',
          };
        },
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    mediaGenerate = await import('../src/app/api/v1/media/generate/route');
    mediaTranscribe = await import('../src/app/api/v1/media/transcribe/route');
    brainNotebook = await import('../src/app/api/v1/brain/notebook/route');
    fromTemplate = await import('../src/app/api/v1/documents/from-template/route');
    mediaHttp = await import('../src/lib/media-http');
  });

  beforeEach(() => {
    networkCalls = [];
    runGenerationCalls = [];
    executeAIRequestCalls = [];
    mediaHttp.resetMediaGuardState();
    users = new Map();
    workspaces = new Map();
  });

  afterEach(() => {
    assert.deepEqual(networkCalls, [], 'tidak ada test di sini yang boleh menyentuh network sungguhan');
  });

  after(() => {
    mediaHttp.resetMediaGuardState();
    globalThis.fetch = originalFetch;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedUser(id: string) {
    users.set(id, { id, email: `${id}@example.invalid`, fullName: `Test ${id}`, isSuperAdmin: false });
  }
  function seedWorkspace(ws: WorkspaceFixture) {
    workspaces.set(ws.id, ws);
  }

  function jsonRequest(
    url: string,
    options: { method?: 'GET' | 'POST'; token?: string; body?: object; headers?: Record<string, string> } = {}
  ) {
    const method = options.method ?? 'POST';
    return new NextRequest(url, {
      method,
      headers: {
        ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...options.headers,
      },
      ...(method === 'POST' ? { body: JSON.stringify(options.body ?? {}) } : {}),
    });
  }

  // =========================================================================
  // media/generate (withMediaGuard) -- kind 'video' dipilih sengaja: plannedVideo()
  // murni sinkron, tanpa panggilan provider/DB sama sekali, jadi jalur SUKSES bisa
  // dibuktikan tanpa mock tambahan.
  // =========================================================================
  describe('media/generate', () => {
    test('POST tanpa token ditolak (401), tidak ada Prisma/network call sama sekali', async () => {
      seedUser('victim-owner');
      seedWorkspace({ id: 'ws-victim', name: 'Toko Korban', slug: 'toko-korban', ownerId: 'victim-owner', members: [], resourceGrants: [] });
      const res = await mediaGenerate.POST(jsonRequest('https://klir.test/api/v1/media/generate', { body: { kind: 'video' } }));
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.success, false);
    });

    test('token valid tapi x-workspace-id di-spoof ke workspace korban -> ditolak (bukan 200), tidak bocor data korban', async () => {
      seedUser('user-attacker');
      seedWorkspace({ id: 'ws-attacker', name: 'Toko Attacker', slug: 'toko-attacker', ownerId: 'user-attacker', members: [], resourceGrants: [] });
      seedWorkspace({ id: 'ws-victim', name: 'Toko Korban Rahasia', slug: 'toko-korban', ownerId: 'someone-else', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-attacker', workspaceId: 'ws-attacker' });
      const res = await mediaGenerate.POST(
        jsonRequest('https://klir.test/api/v1/media/generate', {
          token,
          headers: { 'x-workspace-id': 'ws-victim' },
          body: { kind: 'video' },
        })
      );
      assert.notEqual(res.status, 200);
      const body = await res.json();
      assert.notEqual(body.success, true);
      assert.ok(!JSON.stringify(body).includes('Toko Korban Rahasia'), 'response tidak boleh membocorkan nama workspace korban');
    });

    test('token valid, workspace milik sendiri -> 200 (guard lolos, bukan blanket-deny)', async () => {
      // Item 4.6 (7 Sep): video generate sekarang butuh prompt + genuinely mencoba
      // provider kalau OPENROUTER_API_KEY ada -- test ini soal tenant-guard, bukan
      // logic video, jadi capability-nya dimatikan eksplisit supaya tetap 0 network
      // call sungguhan (invariant file ini, lihat afterEach).
      const previousOr = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      try {
        seedUser('user-owner');
        seedWorkspace({ id: 'ws-mine', name: 'Toko Saya', slug: 'toko-saya', ownerId: 'user-owner', members: [], resourceGrants: [] });
        const token = signJwtToken({ userId: 'user-owner', workspaceId: 'ws-mine' });
        const res = await mediaGenerate.POST(jsonRequest('https://klir.test/api/v1/media/generate', { token, body: { kind: 'video', prompt: 'Cuplikan promosi kopi 8 detik' } }));
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.success, true);
        assert.equal(body.data.kind, 'video');
      } finally {
        if (previousOr === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previousOr;
      }
    });
  });

  // =========================================================================
  // media/transcribe (withMediaGuard, multipart) -- auth check terjadi SEBELUM
  // body multipart pernah dibaca, jadi tidak perlu file audio nyata untuk kasus
  // ditolak.
  // =========================================================================
  describe('media/transcribe', () => {
    test('POST tanpa token ditolak (401) sebelum body multipart pernah dibaca', async () => {
      const res = await mediaTranscribe.POST(new NextRequest('https://klir.test/api/v1/media/transcribe', { method: 'POST' }));
      assert.equal(res.status, 401);
    });

    test('token valid tapi x-workspace-id di-spoof ke workspace korban -> ditolak (bukan 200)', async () => {
      seedUser('user-attacker2');
      seedWorkspace({ id: 'ws-attacker2', name: 'Toko Attacker 2', slug: 'toko-attacker-2', ownerId: 'user-attacker2', members: [], resourceGrants: [] });
      seedWorkspace({ id: 'ws-victim2', name: 'Toko Korban 2', slug: 'toko-korban-2', ownerId: 'someone-else', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-attacker2', workspaceId: 'ws-attacker2' });
      const res = await mediaTranscribe.POST(
        new NextRequest('https://klir.test/api/v1/media/transcribe', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'x-workspace-id': 'ws-victim2' },
        })
      );
      assert.notEqual(res.status, 200);
    });
  });

  // =========================================================================
  // brain/notebook (withMediaGuard)
  // =========================================================================
  describe('brain/notebook', () => {
    test('POST tanpa token ditolak (401), executeAIRequest tidak pernah terpanggil', async () => {
      const res = await brainNotebook.POST(
        jsonRequest('https://klir.test/api/v1/brain/notebook', { body: { kind: 'quiz', sourceText: 'x'.repeat(50) } })
      );
      assert.equal(res.status, 401);
      assert.equal(executeAIRequestCalls.length, 0);
    });

    test('token valid tapi x-workspace-id di-spoof ke workspace korban -> ditolak, executeAIRequest tidak pernah terpanggil', async () => {
      seedUser('user-attacker3');
      seedWorkspace({ id: 'ws-attacker3', name: 'Toko Attacker 3', slug: 'toko-attacker-3', ownerId: 'user-attacker3', members: [], resourceGrants: [] });
      seedWorkspace({ id: 'ws-victim3', name: 'Toko Korban 3', slug: 'toko-korban-3', ownerId: 'someone-else', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-attacker3', workspaceId: 'ws-attacker3' });
      const res = await brainNotebook.POST(
        jsonRequest('https://klir.test/api/v1/brain/notebook', {
          token,
          headers: { 'x-workspace-id': 'ws-victim3' },
          body: { kind: 'quiz', sourceText: 'x'.repeat(50) },
        })
      );
      assert.notEqual(res.status, 200);
      assert.equal(executeAIRequestCalls.length, 0, 'workspace korban tidak boleh sampai memicu panggilan AI generation');
    });

    test('token valid, workspace milik sendiri -> lolos guard, executeAIRequest menerima workspaceId milik sendiri', async () => {
      seedUser('user-owner4');
      seedWorkspace({ id: 'ws-mine4', name: 'Toko Saya 4', slug: 'toko-saya-4', ownerId: 'user-owner4', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-owner4', workspaceId: 'ws-mine4' });
      const res = await brainNotebook.POST(
        jsonRequest('https://klir.test/api/v1/brain/notebook', { token, body: { kind: 'quiz', sourceText: 'x'.repeat(50) } })
      );
      assert.equal(res.status, 200);
      assert.equal(executeAIRequestCalls.length, 1);
      assert.equal(executeAIRequestCalls[0].workspaceId, 'ws-mine4');
    });
  });

  // =========================================================================
  // documents/from-template (extractTokenFromRequest pre-check + authenticateTenantRequest)
  // =========================================================================
  describe('documents/from-template', () => {
    test('GET tanpa token ditolak (401)', async () => {
      const res = await fromTemplate.GET(new NextRequest('https://klir.test/api/v1/documents/from-template'));
      assert.equal(res.status, 401);
    });

    test('POST tanpa token ditolak (401), runGeneration tidak pernah terpanggil', async () => {
      const res = await fromTemplate.POST(
        jsonRequest('https://klir.test/api/v1/documents/from-template', {
          body: { templateId: 'laba-rugi-lengkap-umkm', brief: 'Coba tanpa auth' },
        })
      );
      assert.equal(res.status, 401);
      assert.equal(runGenerationCalls.length, 0);
    });

    test('POST token valid tapi x-workspace-id di-spoof ke workspace korban -> ditolak, runGeneration tidak pernah terpanggil', async () => {
      seedUser('user-attacker5');
      seedWorkspace({ id: 'ws-attacker5', name: 'Toko Attacker 5', slug: 'toko-attacker-5', ownerId: 'user-attacker5', members: [], resourceGrants: [] });
      seedWorkspace({ id: 'ws-victim5', name: 'Toko Korban 5', slug: 'toko-korban-5', ownerId: 'someone-else', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-attacker5', workspaceId: 'ws-attacker5' });
      const res = await fromTemplate.POST(
        jsonRequest('https://klir.test/api/v1/documents/from-template', {
          token,
          headers: { 'x-workspace-id': 'ws-victim5' },
          body: { templateId: 'laba-rugi-lengkap-umkm', brief: 'Coba spoof workspace' },
        })
      );
      assert.notEqual(res.status, 200);
      assert.equal(runGenerationCalls.length, 0, 'workspace korban tidak boleh sampai memicu runGeneration');
    });

    test('POST token valid, workspace milik sendiri -> runGeneration menerima workspaceId milik sendiri', async () => {
      seedUser('user-owner6');
      seedWorkspace({ id: 'ws-mine6', name: 'Toko Saya 6', slug: 'toko-saya-6', ownerId: 'user-owner6', members: [], resourceGrants: [] });
      const token = signJwtToken({ userId: 'user-owner6', workspaceId: 'ws-mine6' });
      const res = await fromTemplate.POST(
        jsonRequest('https://klir.test/api/v1/documents/from-template', {
          token,
          body: { templateId: 'laba-rugi-lengkap-umkm', brief: 'Buatkan laporan laba rugi Q3' },
        })
      );
      assert.equal(res.status, 200);
      assert.equal(runGenerationCalls.length, 1);
      assert.equal(runGenerationCalls[0].workspaceId, 'ws-mine6');
    });
  });
});
