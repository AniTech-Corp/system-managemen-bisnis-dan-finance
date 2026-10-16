import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

type FetchCall = { url: string; init: RequestInit; body: any };
type Query = { where?: Record<string, unknown> };

const ENV_KEYS = [
  'EMERGENT_LLM_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'OPENCODE_API_KEY',
  'OPENAI_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_TEXT_MODEL', 'OPENROUTER_TEXT_MODEL_DEEP',
  // DITAMBAH 11 Sep 2026 (wave B1-backend-routing): env override tier baru (model-tiers.ts)
  // -- WAJIB masuk ENV_KEYS supaya beforeEach's setEnv({}) benar-benar membersihkannya
  // antar-test. Tanpa ini, sebuah test yang set OPENROUTER_MODEL_MAKSIMAL bocor ke test
  // berikutnya (M-style test-isolation bug, ditemukan live saat menulis test tier ini).
  'OPENROUTER_MODEL_HEMAT', 'OPENROUTER_MODEL_STANDAR', 'OPENROUTER_MODEL_MAKSIMAL',
] as const;

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const TEST_OPENROUTER_KEY = 'test-openrouter-key-0123456789abcdef';
const TEST_GROQ_KEY = 'gsk_test-groq-key-0123456789abcdef';

describe('ai-gateway text routing with mocked fetch and in-memory Prisma', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousEnv: Record<string, string | undefined> = {};
  let originalFetch: typeof globalThis.fetch;
  let originalWarn: typeof console.warn;
  let gateway: typeof import('../src/lib/ai-gateway');
  let fetchCalls: FetchCall[] = [];
  let forbiddenCalls: string[] = [];
  let prismaCalls: string[] = [];
  let responses: Array<() => Response> = [];

  // Every Prisma method except subscription.findUnique (plan lookup -> FREE) is trapped.
  const fakePrisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      if (model.startsWith('$')) return async () => {
        forbiddenCalls.push(model); throw new Error(`Forbidden Prisma operation: ${model}`);
      };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (_query: Query) => {
            const method = `${model}.${operation}`;
            prismaCalls.push(method);
            if (method === 'subscription.findUnique') return null;
            forbiddenCalls.push(method); throw new Error(`Forbidden Prisma operation: ${method}`);
          };
        },
      });
    },
  });

  function jsonResponse(status: number, payload: unknown) {
    return () => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
  }
  function chatCompletion(content: string) {
    return { choices: [{ message: { role: 'assistant', content } }] };
  }
  function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
    for (const key of ENV_KEYS) {
      const value = values[key];
      if (value === undefined || value === '') delete process.env[key];
      else process.env[key] = value;
    }
  }
  function openRouterOnly(extra: Partial<Record<(typeof ENV_KEYS)[number], string>> = {}) {
    setEnv({ GROQ_API_KEY: 'dummy-groq-key', OPENROUTER_API_KEY: TEST_OPENROUTER_KEY, ...extra });
  }

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    for (const key of ENV_KEYS) previousEnv[key] = process.env[key];
    originalFetch = globalThis.fetch;
    originalWarn = console.warn;
    console.warn = () => {};
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async (input, init = {}) => {
      const url = input instanceof Request ? input.url : String(input);
      const rawBody = typeof init.body === 'string' ? init.body : '';
      fetchCalls.push({ url, init, body: rawBody ? JSON.parse(rawBody) : null });
      const next = responses.shift();
      if (!next) throw new Error(`Unexpected network call in ai-gateway tests: ${url}`);
      return next();
    };
    // Import after installing the fake Prisma singleton so no real client is constructed.
    gateway = await import('../src/lib/ai-gateway');
  });

  beforeEach(() => {
    fetchCalls = []; forbiddenCalls = []; prismaCalls = []; responses = [];
    setEnv({});
  });

  afterEach(() => {
    assert.deepEqual(forbiddenCalls, [], 'No write, raw SQL or unconfigured Prisma operation is allowed');
    assert.deepEqual(responses, [], 'Every queued provider response must be consumed');
  });

  after(() => {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  });

  test('OpenRouter-only config routes text through openrouter.ai with OPENROUTER_API_KEY and default HEMAT-tier model', async () => {
    openRouterOnly();
    responses.push(jsonResponse(200, chatCompletion('Halo dari OpenRouter')));

    const result = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'Sapa pelanggan' });

    assert.equal(result.provider, 'openrouter');
    assert.equal(result.modelUsed, 'deepseek/deepseek-v4.1-flash');
    assert.equal(result.text, 'Halo dari OpenRouter');
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].url, OPENROUTER_URL);
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, `Bearer ${TEST_OPENROUTER_KEY}`);
    assert.equal(headers['HTTP-Referer'], 'https://anitech.dev');
    assert.equal(headers['X-Title'], 'KLIR OS');
    assert.equal(fetchCalls[0].body.model, 'deepseek/deepseek-v4.1-flash');
    assert.equal(fetchCalls[0].body.messages.at(-1).content, 'Sapa pelanggan');
    assert.ok(!('max_tokens' in fetchCalls[0].body), 'max_tokens must be absent when maxOutputTokens is not given');
    assert.ok(!('reasoning' in fetchCalls[0].body), 'tier hemat tidak punya reasoningEffort, jangan kirim body.reasoning');
    assert.ok(fetchCalls[0].init.signal instanceof AbortSignal, 'OpenRouter fetch carries a timeout signal');
    // workspaceId is not a UUID so the BYOK lookup is skipped; only the plan lookup runs.
    assert.deepEqual(prismaCalls, ['subscription.findUnique']);
  });

  test('preferredProvider=openrouter is enforced before Groq when both providers are available', async () => {
    setEnv({ GROQ_API_KEY: TEST_GROQ_KEY, OPENROUTER_API_KEY: TEST_OPENROUTER_KEY });
    responses.push(jsonResponse(200, chatCompletion('Jawaban dari OpenRouter yang dipilih')));

    const result = await gateway.executeAIRequest({
      workspaceId: 'ws-test',
      prompt: 'analisis beberapa file perusahaan',
      preferredProvider: 'openrouter',
    });

    assert.equal(result.provider, 'openrouter');
    assert.equal(fetchCalls.length, 1, 'provider pilihan harus dicoba sebelum provider fallback');
    assert.equal(fetchCalls[0].url, OPENROUTER_URL);
    assert.equal(fetchCalls[0].init.headers && (fetchCalls[0].init.headers as Record<string, string>).Authorization, `Bearer ${TEST_OPENROUTER_KEY}`);
  });

  test('modelName mengandung slash passthrough eksplisit -- TANPA daftar fallback tier', async () => {
    openRouterOnly();
    responses.push(jsonResponse(200, chatCompletion('explicit')));
    const explicit = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', modelName: 'anthropic/claude-sonnet-4' });
    assert.equal(explicit.modelUsed, 'anthropic/claude-sonnet-4');
    assert.equal(fetchCalls[0].body.model, 'anthropic/claude-sonnet-4');

    // Kalau model eksplisit ini gagal, TIDAK ADA fallback tier yang dicoba (pemanggil sudah
    // pilih model spesifik, bukan tier) -- cascade langsung pindah ke provider berikutnya
    // (Groq/dst, semua tak tersedia di sini) lalu jatuh ke deterministic_fallback dalam 1 fetch call.
    responses.push(() => new Response('{"error":"down"}', { status: 500 }));
    const failedExplicit = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', modelName: 'anthropic/claude-sonnet-4' });
    assert.equal(failedExplicit.provider, 'deterministic_fallback');
    assert.equal(fetchCalls.length, 2, 'hanya 1 percobaan network untuk model passthrough yang gagal, bukan 3 seperti tier');
  });

  test('nama model tanpa slash yang tak dikenal (mis. gaya Groq) jatuh ke tier hemat, bukan literal', async () => {
    openRouterOnly();
    responses.push(jsonResponse(200, chatCompletion('d')));
    const groqName = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', modelName: 'llama-3.3-70b-versatile' });
    assert.equal(groqName.modelUsed, 'deepseek/deepseek-v4.1-flash');
  });

  test('modelName deep resolves to tier maksimal (primary gpt-5.6-luna, fallback tier kalau primary gagal)', async () => {
    openRouterOnly();
    responses.push(jsonResponse(200, chatCompletion('deep ok')));
    const deep = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', modelName: 'deep' });
    assert.equal(deep.modelUsed, 'openai/gpt-5.6-luna');
    assert.equal(fetchCalls[0].body.model, 'openai/gpt-5.6-luna');

    responses.push(
      () => new Response('{"error":"primary maksimal down"}', { status: 500 }),
      jsonResponse(200, chatCompletion('fallback tier maksimal ok')),
    );
    const deepFallback = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', modelName: 'deep' });
    assert.equal(deepFallback.modelUsed, 'google/gemini-3.5-flash');
    assert.equal(fetchCalls.length, 3);
    assert.ok(fetchCalls.every(call => call.url === OPENROUTER_URL));
  });

  test('nama model lama yang mengandung deepseek-r1 tanpa slash juga masuk tier maksimal', async () => {
    openRouterOnly();
    responses.push(jsonResponse(200, chatCompletion('r1 ok')));
    const r1 = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', modelName: 'deepseek-r1-distill-llama-70b' });
    assert.equal(r1.modelUsed, 'openai/gpt-5.6-luna');
  });

  test('env override tier hemat/maksimal', async () => {
    openRouterOnly({ OPENROUTER_TEXT_MODEL: 'openai/gpt-5-mini' });
    responses.push(jsonResponse(200, chatCompletion('hemat override')));
    assert.equal(
      (await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x' })).modelUsed,
      'openai/gpt-5-mini'
    );

    process.env.OPENROUTER_MODEL_MAKSIMAL = 'openai/o4-mini';
    responses.push(jsonResponse(200, chatCompletion('maksimal override')));
    assert.equal(
      (await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', modelName: 'deep' })).modelUsed,
      'openai/o4-mini'
    );
    assert.ok(fetchCalls.every(call => call.url === OPENROUTER_URL));
  });

  test('options.effort memilih tier: santai/normal -> hemat, serius -> standar, maksimal -> maksimal', async () => {
    openRouterOnly();
    responses.push(jsonResponse(200, chatCompletion('a')));
    assert.equal((await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', effort: 'santai' })).modelUsed, 'qwen/qwen3.8-flash');
    responses.push(jsonResponse(200, chatCompletion('b')));
    assert.equal((await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', effort: 'normal' })).modelUsed, 'deepseek/deepseek-v4.1-flash');
    responses.push(jsonResponse(200, chatCompletion('c')));
    assert.equal((await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', effort: 'serius' })).modelUsed, 'openai/gpt-5.6-luna');
    responses.push(jsonResponse(200, chatCompletion('d')));
    assert.equal((await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', effort: 'maksimal' })).modelUsed, 'openai/gpt-5.6-luna');
  });

  test('OpenRouter tier fallback: primary tier gagal -> fallback tier dicoba sebelum cascade pindah provider lain', async () => {
    openRouterOnly();
    responses.push(
      () => new Response('{"error":"primary hemat down"}', { status: 500 }),
      jsonResponse(200, chatCompletion('jawaban dari fallback tier hemat')),
    );
    const result = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x' });
    assert.equal(result.provider, 'openrouter');
    assert.equal(result.modelUsed, 'openai/gpt-4o-mini');
    assert.equal(fetchCalls.length, 2);
    assert.ok(fetchCalls.every(call => call.url === OPENROUTER_URL));
    assert.equal(fetchCalls[0].body.model, 'deepseek/deepseek-v4.1-flash');
    assert.equal(fetchCalls[1].body.model, 'openai/gpt-4o-mini');
  });

  test('reasoning effort dikirim untuk tier maksimal hanya kalau katalog live bilang model mendukung', async () => {
    openRouterOnly();
    const catalog = await import('../src/lib/text-model-catalog');
    catalog.clearTextModelCatalogCache();
    try {
      responses.push(jsonResponse(200, {
        data: [
          {
            id: 'openai/gpt-5.6-luna',
            name: 'GPT 5.6 Luna',
            architecture: { output_modalities: ['text'] },
            pricing: { prompt: '0.0000015' },
            reasoning: { supported_efforts: ['low', 'medium', 'high'] },
          },
        ],
      }));
      await catalog.discoverTextModels();
      fetchCalls = [];

      responses.push(jsonResponse(200, chatCompletion('jawaban maksimal dengan reasoning')));
      const result = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', effort: 'maksimal' });
      assert.equal(result.modelUsed, 'openai/gpt-5.6-luna');
      assert.deepEqual(fetchCalls[0].body.reasoning, { effort: 'high' });

      responses.push(jsonResponse(200, chatCompletion('jawaban serius tanpa reasoning')));
      const seriusResult = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', effort: 'serius' });
      assert.equal(seriusResult.modelUsed, 'openai/gpt-5.6-luna');
      assert.ok(!('reasoning' in fetchCalls[1].body));
    } finally {
      catalog.clearTextModelCatalogCache();
    }
  });

  test('OpenRouter jsonMode sends response_format and parses fenced JSON', async () => {
    openRouterOnly();
    responses.push(jsonResponse(200, chatCompletion('```json\n{"ok":true,"items":[1,2]}\n```')));
    const result = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'json please', jsonMode: true });
    assert.equal(result.provider, 'openrouter');
    assert.deepEqual(result.json, { ok: true, items: [1, 2] });
    assert.deepEqual(fetchCalls[0].body.response_format, { type: 'json_object' });
  });

  test('placeholder OPENROUTER_API_KEY is skipped and cascade ends in deterministic fallback without network', async () => {
    for (const bad of ['dummy-openrouter-key', 'your_openrouter_key_here', 'sk-or-...', 'short']) {
      setEnv({ GROQ_API_KEY: 'dummy-groq-key', OPENROUTER_API_KEY: bad });
      const result = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'apa saja' });
      assert.equal(result.provider, 'deterministic_fallback', `key "${bad}" must not reach the network`);
    }
    assert.deepEqual(fetchCalls, []);
  });

  // DIUBAH 11 Sep 2026 (wave B1-backend-routing): dulu 1 percobaan OpenRouter cukup untuk
  // membuktikan cascade jatuh ke deterministic_fallback. Sekarang provider 'openrouter'
  // mencoba SEMUA kandidat tier hemat (primary + 2 fallback, model-tiers.ts) dulu sebelum
  // menyerah.
  test('OpenRouter HTTP error is sanitized (no provider body) and cascades to fallback', async () => {
    openRouterOnly();
    responses.push(
      () => new Response('{"error":"secret-upstream-detail-1"}', { status: 500 }),
      () => new Response('{"error":"secret-upstream-detail-2"}', { status: 500 }),
      () => new Response('{"error":"secret-upstream-detail-3"}', { status: 500 }),
    );
    // 3 kandidat OpenRouter dicoba semua sebelum cascade menyerah.
    const result = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'apa saja' });
    assert.equal(result.provider, 'deterministic_fallback');
    assert.equal(fetchCalls.length, 3);
    assert.ok(fetchCalls.every(call => call.url === OPENROUTER_URL));
  });

  test('Groq 429 then Qwen retry 200 with jsonMode returns parsed json and modelUsed qwen/qwen3.8-27b', async () => {
    setEnv({ GROQ_API_KEY: TEST_GROQ_KEY });
    responses.push(
      jsonResponse(429, { error: { message: 'rate limit' } }),
      jsonResponse(200, chatCompletion('{"headline":"Promo","bullets":["a","b"]}')),
    );

    const result = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'buat json', jsonMode: true });

    assert.equal(result.provider, 'groq');
    assert.equal(result.modelUsed, 'qwen/qwen3.8-27b');
    assert.deepEqual(result.json, { headline: 'Promo', bullets: ['a', 'b'] });
    assert.equal(fetchCalls.length, 2);
    assert.ok(fetchCalls.every(call => call.url === GROQ_URL));
    assert.equal(fetchCalls[1].body.model, 'qwen/qwen3.8-27b');
    assert.deepEqual(fetchCalls[1].body.response_format, { type: 'json_object' });
  });

  test('maxOutputTokens 1800 is forwarded as max_tokens to Groq and OpenRouter', async () => {
    setEnv({ GROQ_API_KEY: TEST_GROQ_KEY });
    responses.push(jsonResponse(200, chatCompletion('groq ok')));
    const groq = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', maxOutputTokens: 1800 });
    assert.equal(groq.provider, 'groq');
    assert.equal(fetchCalls[0].url, GROQ_URL);
    assert.equal(fetchCalls[0].body.max_tokens, 1800);

    openRouterOnly();
    responses.push(jsonResponse(200, chatCompletion('or ok')));
    const or = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', maxOutputTokens: 1800 });
    assert.equal(or.provider, 'openrouter');
    assert.equal(fetchCalls[1].url, OPENROUTER_URL);
    assert.equal(fetchCalls[1].body.max_tokens, 1800);

    // Non-positive values keep the provider default (no max_tokens key at all).
    responses.push(jsonResponse(200, chatCompletion('or ok')));
    await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x', maxOutputTokens: 0 });
    assert.ok(!('max_tokens' in fetchCalls[2].body));
  });

  test('OpenRouter tier gagal total lalu cascade lanjut ke Groq (bukan lagi Groq di depan)', async () => {
    setEnv({ GROQ_API_KEY: TEST_GROQ_KEY, OPENROUTER_API_KEY: TEST_OPENROUTER_KEY, OPENCODE_API_KEY: 'sk-opencode-test-key-0123456789' });
    responses.push(
      jsonResponse(500, { error: 'down' }),
      jsonResponse(500, { error: 'down' }),
      jsonResponse(500, { error: 'down' }),
      jsonResponse(200, chatCompletion('via groq')),
    );
    // tier hemat = 3 kandidat, semua gagal -> Groq.
    const result = await gateway.executeAIRequest({ workspaceId: 'ws-test', prompt: 'x' });
    assert.equal(result.provider, 'groq');
    assert.deepEqual(fetchCalls.map(call => call.url), [OPENROUTER_URL, OPENROUTER_URL, OPENROUTER_URL, GROQ_URL]);
  });
});
