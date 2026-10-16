import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

/**
 * Real generate route (withMediaGuard + JWT + in-memory Prisma) for the audio draft stage.
 * No module mocking is available under `node --import tsx --test`, so the paid draft call
 * (executeAIRequest) is observed through its only side effects: the subscription read it
 * performs and the provider fetch it makes. Both are trapped here; nothing reaches a network.
 */
type Query = { where?: { id?: string; workspaceId?: string; OR?: unknown[] }; include?: unknown; select?: unknown };
type DbCall = { method: string; query: Query };
const AUTH_READS = ['user.findUnique', 'workspace.findUnique', 'workspace.findUnique'];
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const ENV_KEYS = [
  'JWT_SECRET', 'OPENROUTER_API_KEY', 'GROQ_API_KEY', 'EMERGENT_LLM_KEY', 'OPENCODE_API_KEY', 'OPENAI_API_KEY',
  'GEMINI_API_KEY', 'MARKETING_MEDIA_TTS_ENABLED', 'OPENROUTER_TTS_MODEL', 'OPENROUTER_TTS_VOICE',
] as const;

/** Exactly `length` characters, no leading or trailing whitespace, so trim() keeps the length. */
function draftOf(length: number) {
  return 'Naskah uji voiceover KLIR. '.repeat(Math.ceil(length / 27)).slice(0, length - 1) + 'X';
}

describe('media generate route: audio draft gate before paid AI call', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
  let originalFetch: typeof globalThis.fetch;
  let POST: typeof import('../src/app/api/v1/media/generate/route')['POST'];
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let reads: DbCall[] = [];
  let forbiddenCalls: string[] = [];
  let fetchCalls: string[] = [];
  let draftText = '';
  let handlers: Record<string, (query: Query) => unknown>;

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
    for (const key of ENV_KEYS) previousEnv[key] = process.env[key];
    originalFetch = globalThis.fetch;
    process.env.JWT_SECRET = 'media-generate-route-tests-only-signing-secret-3f1a9c2e-do-not-use-in-production';
    // Test-only placeholder credentials: they satisfy the "key configured" checks and
    // route the draft to the mocked fetch below. Real providers are never contacted.
    process.env.OPENROUTER_API_KEY = 'test-only-openrouter-key-not-real-1234567890';
    process.env.GROQ_API_KEY = 'gsk_test_only_not_real_key_1234567890';
    for (const key of ['EMERGENT_LLM_KEY', 'OPENCODE_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_TTS_MODEL', 'OPENROUTER_TTS_VOICE'] as const) delete process.env[key];
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      const url = input instanceof Request ? input.url : String(input);
      fetchCalls.push(url);
      if (url === GROQ_URL) {
        return new Response(JSON.stringify({ choices: [{ message: { content: draftText } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      // Every other provider (OpenRouter catalog, TTS, Gemini) is unavailable in tests.
      return new Response('provider disabled in tests', { status: 500 });
    };
    // Import after the signing secret, fake Prisma and fetch trap are in place.
    ({ POST } = await import('../src/app/api/v1/media/generate/route'));
    ({ signJwtToken } = await import('../src/lib/auth'));
  });

  beforeEach(() => {
    reads = []; forbiddenCalls = []; fetchCalls = []; draftText = '';
    delete process.env.MARKETING_MEDIA_TTS_ENABLED;
    handlers = {
      'user.findUnique': () => ({ id: 'user-member', email: 'member@example.invalid', fullName: 'Test Member', isSuperAdmin: false }),
      'workspace.findUnique': query => query.include
        ? { id: 'ws-member', name: 'Member workspace', slug: 'member', ownerId: 'other-owner', members: [{ role: 'MEMBER' }], resourceGrants: [] }
        : { id: 'ws-member' },
      // Read by executeAIRequest (plan routing). Its presence in `reads` proves the draft call started.
      'subscription.findUnique': () => null,
    };
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
    previousEnv = {};
  });

  function request(body: object) {
    return new NextRequest('https://klir.test/api/v1/media/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${signJwtToken({ userId: 'user-member', workspaceId: 'ws-member' })}` },
      body: JSON.stringify(body),
    });
  }

  test('P3: TTS disabled with prompt only fails NO_PROVIDER before any draft call is made', async () => {
    process.env.MARKETING_MEDIA_TTS_ENABLED = 'false';
    draftText = draftOf(120);
    const response = await POST(request({ kind: 'audio', prompt: 'Brief voiceover promo kopi 30 detik.' }));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NO_PROVIDER');
    assert.match(body.error.message, /Voiceover belum tersedia/);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    // executeAIRequest was never entered: no plan lookup and zero provider fetches.
    assert.deepEqual(reads.map(read => read.method), AUTH_READS);
    assert.deepEqual(fetchCalls, []);
  });

  test('P4b: draft longer than 6000 characters is returned as script-ready without calling TTS', async () => {
    draftText = draftOf(6500);
    const response = await POST(request({ kind: 'audio', prompt: 'Brief voiceover panjang untuk webinar.' }));
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'INVALID_INPUT');
    // The route's own message, not the generic generateSpeech length error.
    assert.match(body.error.message, /Naskah hasil draft melebihi 6000 karakter/);
    assert.match(body.error.message, /kirim sebagai naskah/);
    assert.equal(body.error.retryable, false);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual({ kind: body.data.kind, status: body.data.status, scriptDrafted: body.data.scriptDrafted }, { kind: 'audio', status: 'script-ready', scriptDrafted: true });
    assert.equal(body.data.script, draftText, 'the oversized draft is preserved verbatim, never trimmed');
    assert.equal(body.data.script.length, 6500);
    // 11 Sep 2026 (komando, arahan Mecca "OpenRouter utama, Groq cadangan"): cascade
    // 'auto' sekarang mencoba tier hemat OpenRouter dulu (mock di sini menjawab 500),
    // baru Groq yang menjawab draft. Yang dikunci: Groq dipanggil TEPAT SEKALI, semua
    // panggilan sebelumnya adalah chat completions OpenRouter, dan TIDAK ADA panggilan
    // katalog/speech setelahnya.
    assert.equal(fetchCalls.filter((u) => u === GROQ_URL).length, 1);
    assert.equal(fetchCalls[fetchCalls.length - 1], GROQ_URL);
    assert.ok(fetchCalls.slice(0, -1).every((u) => u === 'https://openrouter.ai/api/v1/chat/completions'));
    assert.deepEqual(reads.map(read => read.method), [...AUTH_READS, 'subscription.findUnique']);
  });

  test('P4b boundary: a 6000-character draft still proceeds to the speech stage', async () => {
    draftText = draftOf(6000);
    const response = await POST(request({ kind: 'audio', prompt: 'Brief voiceover tepat di batas.' }));
    // The speech stage reached the (disabled) OpenRouter catalog, so the length gate did not block it.
    // 11 Sep 2026 (komando): sebelum Groq ada percobaan tier hemat OpenRouter (mock 500) --
    // yang dikunci: Groq tepat sekali, lalu TEPAT SATU panggilan katalog speech sesudahnya.
    const groqIdx = fetchCalls.indexOf(GROQ_URL);
    assert.ok(groqIdx >= 0);
    assert.equal(fetchCalls.filter((u) => u === GROQ_URL).length, 1);
    assert.equal(fetchCalls.length, groqIdx + 2);
    assert.match(fetchCalls[groqIdx + 1], /^https:\/\/openrouter\.ai\/api\/v1\/models\?output_modalities=speech$/);
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.error.code, 'PROVIDER_ERROR');
    assert.equal(body.data.status, 'script-ready');
    assert.equal(body.data.script.length, 6000);
    assert.equal(body.data.scriptDrafted, true);
  });

  test('audio with a user script skips the draft call entirely', async () => {
    process.env.MARKETING_MEDIA_TTS_ENABLED = 'false';
    const response = await POST(request({ kind: 'audio', script: 'Naskah dari pengguna.' }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error.code, 'NO_PROVIDER');
    assert.deepEqual(fetchCalls, []);
    assert.deepEqual(reads.map(read => read.method), AUTH_READS);
  });

  test('video generation is forbidden for finance role', async () => {
    const response = await POST(request({ kind: 'video', prompt: 'Video promo kopi', role: 'finance' }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.match(body.error.message, /Fitur generate video hanya diizinkan untuk peran CEO \(Executive\) dan Marketing/);
  });

  test('video generation is forbidden for manager role', async () => {
    const response = await POST(request({ kind: 'video', prompt: 'Video briefing mingguan', role: 'manager' }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.match(body.error.message, /Fitur generate video hanya diizinkan untuk peran CEO \(Executive\) dan Marketing/);
  });

  test('video generation is forbidden for manager_ops role', async () => {
    const response = await POST(request({ kind: 'video', prompt: 'Video alur gudang', role: 'manager_ops' }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.match(body.error.message, /Fitur generate video hanya diizinkan untuk peran CEO \(Executive\) dan Marketing/);
  });

  test('video generation is forbidden for sekretaris role', async () => {
    const response = await POST(request({ kind: 'video', prompt: 'Video notulen rapat', role: 'sekretaris' }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
    assert.match(body.error.message, /Fitur generate video hanya diizinkan untuk peran CEO \(Executive\) dan Marketing/);
  });

  test('video generation is forbidden for non-owner when role is omitted', async () => {
    const response = await POST(request({ kind: 'video', prompt: 'Video tanpa peran eksplisit' }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('image generation is permitted for manager role without schema error', async () => {
    process.env.MARKETING_MEDIA_IMAGE_ENABLED = 'false';
    const response = await POST(request({ kind: 'image', prompt: 'Poster alur inventaris', role: 'manager' }));
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.error.code, 'NO_PROVIDER');
  });

  test('video dryRun is permitted for CEO/executive with 0 credit spent', async () => {
    const response = await POST(request({ kind: 'video', prompt: 'Brief video CEO', role: 'ceo', dryRun: true }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'dry-run-ok');
    assert.equal(body.data.dryRun, true);
    assert.match(body.data.message, /0 biaya kredit/);
  });

  test('video dryRun is permitted for marketing with 0 credit spent', async () => {
    const response = await POST(request({ kind: 'video', prompt: 'Brief video marketing', role: 'marketing', dryRun: true }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'dry-run-ok');
    assert.equal(body.data.dryRun, true);
  });

  test('video dryRun is strictly forbidden for finance role (403)', async () => {
    const response = await POST(request({ kind: 'video', prompt: 'Brief video finance', role: 'finance', dryRun: true }));
    assert.equal(response.status, 403);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'FORBIDDEN');
  });

  test('image dryRun is permitted for any role (finance, manager, sekretaris)', async () => {
    const resFinance = await POST(request({ kind: 'image', prompt: 'Banner invoice', role: 'finance', dryRun: true }));
    assert.equal(resFinance.status, 200);
    const bodyFin = await resFinance.json();
    assert.equal(bodyFin.success, true);
    assert.equal(bodyFin.data.dryRun, true);

    const resMgr = await POST(request({ kind: 'image', prompt: 'Poster SOP', role: 'manager_ops', dryRun: true }));
    assert.equal(resMgr.status, 200);
    const bodyMgr = await resMgr.json();
    assert.equal(bodyMgr.success, true);
    assert.equal(bodyMgr.data.dryRun, true);
  });
});


