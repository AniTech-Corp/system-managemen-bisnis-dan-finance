import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';

// ---------------------------------------------------------------------------
// FASE 3.5 "Hermes-lite" (roadmap 6 Sep) tests for src/lib/ai-orchestrator.ts.
//
// Same technique as tests/ai-gateway-routing.test.ts (in-memory Prisma Proxy
// via globalThis.prisma) combined with node:test's `mock.module` for
// ../src/lib/ai-gateway (same pattern as tests/brain-generate-chat-guard.test.ts)
// so executeAIRequest never makes a real network call. Requires
// `node --experimental-test-module-mocks --import tsx --test <file>`.
// ---------------------------------------------------------------------------

type MemoryItemRow = { id: string; workspaceId: string; userId: string | null; scope: string; content: string; createdAt: Date };

describe('ai-orchestrator: task routing, history downgrade, non-fatal stats', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let originalWarn: typeof console.warn;
  let orchestratorModule: typeof import('../src/lib/ai-orchestrator');
  let executeAIRequestCalls: any[] = [];
  let nextResults: Array<() => Promise<any>> = [];
  let memoryItems: MemoryItemRow[] = [];
  let forbiddenCalls: string[] = [];
  let idCounter = 0;

  const fakePrisma = {
    memoryItem: {
      create: async ({ data }: { data: any }) => {
        const row: MemoryItemRow = {
          id: `mi-${++idCounter}`,
          workspaceId: data.workspaceId,
          userId: data.userId ?? null,
          scope: data.scope,
          content: data.content,
          createdAt: new Date(Date.now() + idCounter), // monotonic increasing for stable desc ordering
        };
        memoryItems.push(row);
        return row;
      },
      findMany: async ({ where, orderBy, take }: any) => {
        let rows = memoryItems.filter((r) => r.workspaceId === where.workspaceId && r.scope === where.scope);
        if (where.content?.startsWith) rows = rows.filter((r) => r.content.startsWith(where.content.startsWith));
        if (where.content?.contains) rows = rows.filter((r) => r.content.includes(where.content.contains));
        const desc = orderBy?.createdAt === 'desc';
        rows = [...rows].sort((a, b) => (desc ? b.createdAt.getTime() - a.createdAt.getTime() : a.createdAt.getTime() - b.createdAt.getTime()));
        return typeof take === 'number' ? rows.slice(0, take) : rows;
      },
    },
    // Anything else touched is a bug in the orchestrator (it must only ever read/write memoryItem).
    __other: new Proxy({}, {
      get(_t, model: string) {
        return new Proxy({}, { get(_d, op: string) { return async () => { forbiddenCalls.push(`${model}.${op}`); throw new Error(`Forbidden: ${model}.${op}`); }; } });
      },
    }),
  };

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    originalWarn = console.warn;
    console.warn = () => {};
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        executeAIRequest: async (opts: any) => {
          executeAIRequestCalls.push(opts);
          const next = nextResults.shift();
          if (!next) throw new Error('Unexpected executeAIRequest call: no queued result');
          return next();
        },
      },
    });

    orchestratorModule = await import('../src/lib/ai-orchestrator');
  });

  beforeEach(() => {
    executeAIRequestCalls = [];
    nextResults = [];
    memoryItems = [];
    forbiddenCalls = [];
  });

  afterEach(() => {
    assert.deepEqual(forbiddenCalls, [], 'orchestrator must only touch prisma.memoryItem');
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    console.warn = originalWarn;
  });

  function ok(text: string, provider = 'openrouter', modelUsed = 'google/gemini-3.5-flash', latencyMs = 5) {
    return async () => ({ text, provider, modelUsed, latencyMs });
  }
  function fallback(latencyMs = 5) {
    return async () => ({ text: 'fallback deterministik', provider: 'deterministic_fallback', modelUsed: 'none', latencyMs });
  }

  test('research task routes to gemini per TASK_ROUTES, temperature 0.3, jsonMode false', async () => {
    nextResults.push(ok('hasil riset', 'gemini', 'gemini-flash-lite-latest'));
    const result = await orchestratorModule.orchestrate({ workspaceId: 'ws-1', task: 'research', prompt: 'cari info kompetitor' });
    assert.equal(result.task, 'research');
    assert.equal(result.routedProvider, 'gemini');
    assert.equal(result.historyDowngraded, false);
    assert.equal(result.provider, 'gemini');
    assert.equal(executeAIRequestCalls[0].preferredProvider, 'gemini');
    assert.equal(executeAIRequestCalls[0].temperature, 0.3);
    assert.equal(executeAIRequestCalls[0].jsonMode, false);
  });

  // DIUBAH 11 Sep 2026 (wave B1-backend-routing, arahan Mecca 11 Sep poin 4: "OpenRouter =
  // UTAMA. Groq + Gemini = cadangan"). Sebelum perubahan ini TASK_ROUTES.extract_json.
  // preferredProvider = 'groq' -- test ini dulu mengunci itu. Sekarang extract_json (dan
  // summarize) preferredProvider='openrouter' dengan modelName=JSON_EXTRACTION_MODEL
  // (model-tiers.ts, murah + mendukung response_format json_object), fallbackProvider
  // 'groq' jadi cadangan (dites terpisah di bawah lewat getTaskRoutes()).
  test('extract_json task routes to openrouter with JSON_EXTRACTION_MODEL, jsonMode true, temperature 0', async () => {
    nextResults.push(ok('{"a":1}', 'openrouter', 'deepseek/deepseek-v4-flash-0731'));
    const result = await orchestratorModule.orchestrate({ workspaceId: 'ws-1', task: 'extract_json', prompt: 'ekstrak angka' });
    assert.equal(result.routedProvider, 'openrouter');
    assert.equal(executeAIRequestCalls[0].preferredProvider, 'openrouter');
    assert.equal(executeAIRequestCalls[0].temperature, 0);
    assert.equal(executeAIRequestCalls[0].jsonMode, true);
    assert.equal(executeAIRequestCalls[0].modelName, 'deepseek/deepseek-v4-flash-0731');
  });

  // BARU 11 Sep 2026: summarize juga dipetakan ke openrouter+JSON_EXTRACTION_MODEL (kontrak
  // B1) -- beda dari extract_json, jsonMode summarize tetap false (ringkasan teks bebas,
  // bukan struktur JSON).
  test('summarize task routes to openrouter with JSON_EXTRACTION_MODEL, jsonMode false', async () => {
    nextResults.push(ok('ringkasan singkat', 'openrouter', 'deepseek/deepseek-v4-flash-0731'));
    const result = await orchestratorModule.orchestrate({ workspaceId: 'ws-1', task: 'summarize', prompt: 'ringkas dokumen ini' });
    assert.equal(result.routedProvider, 'openrouter');
    assert.equal(executeAIRequestCalls[0].preferredProvider, 'openrouter');
    assert.equal(executeAIRequestCalls[0].jsonMode, false);
    assert.equal(executeAIRequestCalls[0].modelName, 'deepseek/deepseek-v4-flash-0731');
  });

  // BARU 11 Sep 2026: chat dan analyze juga pindah ke openrouter-first (kontrak B1) --
  // dites eksplisit di sini (bukan cuma lewat getTaskRoutes()) supaya regresi ke
  // groq-first pada task yang paling sering dipakai (chat) tidak lolos diam-diam.
  test('chat task routes to openrouter (bukan lagi groq) per arahan Mecca 11 Sep', async () => {
    nextResults.push(ok('halo balik'));
    const result = await orchestratorModule.orchestrate({ workspaceId: 'ws-1', task: 'chat', prompt: 'halo' });
    assert.equal(result.routedProvider, 'openrouter');
    assert.equal(executeAIRequestCalls[0].preferredProvider, 'openrouter');
  });

  test('analyze task routes to openrouter with fallback groq (bukan lagi gemini)', async () => {
    nextResults.push(ok('hasil analisis'));
    const result = await orchestratorModule.orchestrate({ workspaceId: 'ws-1', task: 'analyze', prompt: 'analisis dokumen ini' });
    assert.equal(result.routedProvider, 'openrouter');
    assert.equal(executeAIRequestCalls[0].preferredProvider, 'openrouter');
    assert.equal(orchestratorModule.getTaskRoutes().analyze.fallbackProvider, 'groq');
  });

  test('explicit caller overrides (temperature/jsonMode/modelName) beat TASK_ROUTES defaults', async () => {
    nextResults.push(ok('x'));
    await orchestratorModule.orchestrate({
      workspaceId: 'ws-1', task: 'chat', prompt: 'halo',
      temperature: 0.1, jsonMode: true, modelName: 'anthropic/claude-sonnet-4',
    });
    assert.equal(executeAIRequestCalls[0].temperature, 0.1);
    assert.equal(executeAIRequestCalls[0].jsonMode, true);
    assert.equal(executeAIRequestCalls[0].modelName, 'anthropic/claude-sonnet-4');
  });

  // provider di-assert 'openrouter' (bukan 'groq' seperti sebelum 11 Sep 2026) karena
  // TASK_ROUTES.chat.preferredProvider sekarang 'openrouter' (arahan Mecca 11 Sep poin 4)
  // -- lihat komentar dated di TASK_ROUTES ai-orchestrator.ts.
  test('each successful orchestrate() call records one non-fatal [ORCH_ROUTE_STATS] MemoryItem', async () => {
    nextResults.push(ok('halo balik', 'openrouter', 'deepseek/deepseek-v4-flash-0731', 42));
    await orchestratorModule.orchestrate({ workspaceId: 'ws-stats', task: 'chat', prompt: 'halo' });
    assert.equal(memoryItems.length, 1);
    assert.equal(memoryItems[0].workspaceId, 'ws-stats');
    assert.equal(memoryItems[0].scope, 'WORKSPACE');
    assert.equal(memoryItems[0].userId, null);
    // provider recorded is the ROUTED provider ('openrouter' for task 'chat' per TASK_ROUTES
    // sejak 11 Sep 2026), sama dengan result.provider di test ini karena mock executeAIRequest
    // mengembalikan provider 'openrouter' juga -- lihat orchestrate()'s comment kenapa stats
    // key off the route, bukan result.provider, untuk kasus umum (deterministic_fallback dsb).
    assert.match(memoryItems[0].content, /^\[ORCH_ROUTE_STATS\] provider=openrouter\|task=chat\|ok=true\|latencyMs=\d+$/);
  });

  test('a deterministic_fallback result is recorded as ok=false (not a thrown error)', async () => {
    nextResults.push(fallback());
    const result = await orchestratorModule.orchestrate({ workspaceId: 'ws-stats', task: 'chat', prompt: 'halo' });
    assert.equal(result.provider, 'deterministic_fallback');
    assert.match(memoryItems[0].content, /ok=false/);
  });

  // provider di-assert 'openrouter' (dulu 'groq') -- sama alasan seperti test di atas,
  // mengikuti TASK_ROUTES.chat.preferredProvider baru sejak 11 Sep 2026.
  test('executeAIRequest throwing is recorded as ok=false stats then rethrown to the caller', async () => {
    nextResults.push(async () => { throw new Error('provider meledak'); });
    await assert.rejects(
      orchestratorModule.orchestrate({ workspaceId: 'ws-stats', task: 'chat', prompt: 'halo' }),
      /provider meledak/
    );
    assert.equal(memoryItems.length, 1);
    assert.match(memoryItems[0].content, /provider=openrouter\|task=chat\|ok=false/);
  });

  test('pickRouteWithHistory downgrades to fallbackProvider after >=3 failures in the last 20 records for that task', async () => {
    const ws = 'ws-downgrade';
    // Seed history via real orchestrate() calls (each failure is one deterministic_fallback response).
    nextResults.push(fallback(), fallback(), fallback());
    await orchestratorModule.orchestrate({ workspaceId: ws, task: 'research', prompt: 'x' });
    await orchestratorModule.orchestrate({ workspaceId: ws, task: 'research', prompt: 'x' });
    await orchestratorModule.orchestrate({ workspaceId: ws, task: 'research', prompt: 'x' });

    // 4th call: pickRouteWithHistory must now see 3 gemini failures and downgrade to the 'auto' fallback.
    nextResults.push(ok('akhirnya berhasil', 'auto-resolved-provider'));
    const result = await orchestratorModule.orchestrate({ workspaceId: ws, task: 'research', prompt: 'x' });
    assert.equal(result.routedProvider, 'auto');
    assert.equal(result.historyDowngraded, true);
    assert.equal(executeAIRequestCalls.at(-1).preferredProvider, 'auto');
  });

  test('history downgrade is scoped per-task: 3 failures on research must not affect chat routing', async () => {
    const ws = 'ws-scope';
    nextResults.push(fallback(), fallback(), fallback());
    await orchestratorModule.orchestrate({ workspaceId: ws, task: 'research', prompt: 'x' });
    await orchestratorModule.orchestrate({ workspaceId: ws, task: 'research', prompt: 'x' });
    await orchestratorModule.orchestrate({ workspaceId: ws, task: 'research', prompt: 'x' });

    nextResults.push(ok('chat masih normal', 'auto-provider'));
    const chatResult = await orchestratorModule.orchestrate({ workspaceId: ws, task: 'chat', prompt: 'halo' });
    assert.equal(chatResult.historyDowngraded, false);
    // 'openrouter' (dulu 'groq') -- TASK_ROUTES.chat.preferredProvider baru sejak 11 Sep 2026.
    assert.equal(executeAIRequestCalls.at(-1).preferredProvider, 'openrouter');
  });

  test('history downgrade is scoped per-workspace: another workspace with clean history stays on gemini', async () => {
    const wsA = 'ws-a-fail';
    nextResults.push(fallback(), fallback(), fallback());
    await orchestratorModule.orchestrate({ workspaceId: wsA, task: 'research', prompt: 'x' });
    await orchestratorModule.orchestrate({ workspaceId: wsA, task: 'research', prompt: 'x' });
    await orchestratorModule.orchestrate({ workspaceId: wsA, task: 'research', prompt: 'x' });

    nextResults.push(ok('riset workspace lain', 'gemini'));
    const resultB = await orchestratorModule.orchestrate({ workspaceId: 'ws-b-clean', task: 'research', prompt: 'x' });
    assert.equal(resultB.routedProvider, 'gemini');
    assert.equal(resultB.historyDowngraded, false);
  });

  test('unknown task throws synchronously without touching Prisma or ai-gateway', async () => {
    await assert.rejects(
      // @ts-expect-error deliberately invalid task to test the guard clause
      orchestratorModule.orchestrate({ workspaceId: 'ws-1', task: 'not-a-real-task', prompt: 'x' }),
      /task tidak dikenal/
    );
    assert.equal(executeAIRequestCalls.length, 0);
    assert.equal(memoryItems.length, 0);
  });

  // Assersi diperluas 11 Sep 2026 (wave B1-backend-routing) untuk mengunci arahan Mecca
  // "OpenRouter = UTAMA, Groq + Gemini = cadangan": chat/analyze/extract_json/summarize
  // WAJIB preferredProvider 'openrouter' dengan fallbackProvider 'groq'; extract_json dan
  // summarize WAJIB modelName JSON_EXTRACTION_MODEL (model-tiers.ts); research/creative
  // TIDAK BERUBAH (gemini/openrouter sudah sesuai arahan sebelumnya).
  test('getTaskRoutes exposes the full deterministic routing table read-only', () => {
    const routes = orchestratorModule.getTaskRoutes();
    assert.deepEqual(Object.keys(routes).sort(), ['analyze', 'chat', 'creative', 'extract_json', 'research', 'summarize'].sort());
    assert.equal(routes.creative.preferredProvider, 'openrouter');
    assert.equal(routes.extract_json.jsonMode, true);

    for (const task of ['chat', 'analyze', 'extract_json', 'summarize'] as const) {
      assert.equal(routes[task].preferredProvider, 'openrouter', `${task} harus preferredProvider openrouter`);
      assert.equal(routes[task].fallbackProvider, 'groq', `${task} harus fallbackProvider groq`);
    }
    assert.equal(routes.extract_json.modelName, 'deepseek/deepseek-v4-flash-0731');
    assert.equal(routes.summarize.modelName, 'deepseek/deepseek-v4-flash-0731');
    // research TIDAK BERUBAH -- masih gemini-first dengan fallback 'auto'.
    assert.equal(routes.research.preferredProvider, 'gemini');
    assert.equal(routes.research.fallbackProvider, 'auto');
  });
});
