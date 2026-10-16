import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

// web-research.ts (server-only): researchWeb/trimForPrompt/clearWebResearchCache.
// Dibuat 8 Sep 2026 (wave B1-web-research). Network DILARANG sungguhan di test ini
// -- globalThis.fetch SELALU di-override manual (pola persis tests/media-provider.test.ts),
// TIDAK PERNAH menyentuh generativelanguage.googleapis.com sungguhan.

const CREDENTIAL_ENV_NAME = ['GEMINI', 'API', 'KEY'].join('_');

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

function geminiSuccessBody(summary: string, sources: Array<{ title: string; url: string }> = [], queries: string[] = []) {
  return {
    candidates: [
      {
        content: { parts: [{ text: summary }] },
        groundingMetadata: {
          groundingChunks: sources.map(s => ({ web: { uri: s.url, title: s.title } })),
          webSearchQueries: queries,
        },
      },
    ],
  };
}

describe('web-research: researchWeb / trimForPrompt / clearWebResearchCache', { concurrency: false }, () => {
  let mod: typeof import('../src/lib/web-research');
  let originalFetch: typeof globalThis.fetch;
  let originalCredential: string | undefined;
  let fetchCalls: Array<{ url: string; init?: RequestInit }>;
  let respond: (url: string, init?: RequestInit) => Response | Promise<Response>;

  before(async () => {
    originalFetch = globalThis.fetch;
    originalCredential = process.env[CREDENTIAL_ENV_NAME];
    mod = await import('../src/lib/web-research');
  });

  beforeEach(() => {
    fetchCalls = [];
    process.env[CREDENTIAL_ENV_NAME] = 'test-fixture-not-a-real-secret';
    mod.clearWebResearchCache();
    respond = () => { throw new Error('Unexpected fetch call in test'); };
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      fetchCalls.push({ url, init });
      return respond(url, init);
    }) as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (originalCredential === undefined) delete process.env[CREDENTIAL_ENV_NAME];
    else process.env[CREDENTIAL_ENV_NAME] = originalCredential;
    mod.clearWebResearchCache();
  });

  test('query kosong -> available:false tanpa fetch dipanggil', async () => {
    const result = await mod.researchWeb('   ');
    assert.equal(result.available, false);
    assert.equal(result.provider, 'none');
    assert.equal(fetchCalls.length, 0);
  });

  test('key kosong -> available:false tanpa fetch dipanggil', async () => {
    delete process.env[CREDENTIAL_ENV_NAME];
    const result = await mod.researchWeb('tren kopi Indonesia');
    assert.equal(result.available, false);
    assert.equal(result.provider, 'none');
    assert.equal(result.note, 'riset web tidak tersedia sekarang');
    assert.equal(fetchCalls.length, 0);
  });

  test('key placeholder -> available:false tanpa fetch dipanggil', async () => {
    process.env[CREDENTIAL_ENV_NAME] = 'your_key_here_placeholder';
    const result = await mod.researchWeb('tren kopi Indonesia');
    assert.equal(result.available, false);
    assert.equal(fetchCalls.length, 0);
  });

  test('fetch sukses -> available:true, sources ter-dedupe, dan hasil ter-cache pada panggilan kedua', async () => {
    respond = () => json(geminiSuccessBody(
      'Kopi susu gula aren masih naik daun di 2026.',
      [
        { title: 'Artikel A', url: 'https://contoh.id/a' },
        { title: 'Artikel A duplikat', url: 'https://contoh.id/a' },
        { title: 'Artikel B', url: 'https://contoh.id/b' },
      ],
      ['tren kopi 2026'],
    ));
    const first = await mod.researchWeb('tren kopi Indonesia 2026');
    assert.equal(first.available, true);
    assert.equal(first.provider, 'gemini');
    assert.equal(first.sources.length, 2); // duplikat uri di-dedupe
    assert.equal(fetchCalls.length, 1);

    const second = await mod.researchWeb('tren kopi Indonesia 2026');
    assert.equal(second.available, true);
    assert.equal(second.summary, first.summary);
    assert.equal(fetchCalls.length, 1, 'panggilan kedua query sama WAJIB dari cache, fetch tidak nambah');
  });

  test('cache dibedakan per region -- region berbeda = fetch baru', async () => {
    let callCount = 0;
    respond = () => { callCount += 1; return json(geminiSuccessBody(`ringkasan ke-${callCount}`)); };
    const idResult = await mod.researchWeb('kompetitor kopi', { region: 'ID' });
    const usResult = await mod.researchWeb('kompetitor kopi', { region: 'US' });
    assert.equal(fetchCalls.length, 2);
    assert.notEqual(idResult.summary, usResult.summary);
  });

  test('fetch 404 (model pensiun) -> available:false + note jujur, TIDAK cache', async () => {
    respond = () => new Response('not found', { status: 404 });
    const result = await mod.researchWeb('query yang modelnya sudah pensiun');
    assert.equal(result.available, false);
    assert.equal(result.provider, 'gemini');
    assert.ok(result.note && result.note.length > 0);

    // Kegagalan TIDAK di-cache -- panggilan kedua harus coba fetch lagi (bukan diam2 balik hasil gagal yang sama tanpa fetch).
    respond = () => json(geminiSuccessBody('sekarang berhasil'));
    const second = await mod.researchWeb('query yang modelnya sudah pensiun');
    assert.equal(second.available, true);
  });

  test('respons Gemini tanpa ringkasan (bentuk berubah) -> fail-soft, bukan crash', async () => {
    respond = () => json({ candidates: [{ content: { parts: [] } }] });
    const result = await mod.researchWeb('query bentuk aneh');
    assert.equal(result.available, false);
    assert.equal(result.provider, 'gemini');
  });

  test('trimForPrompt: summary pendek dikembalikan apa adanya', () => {
    const result = { available: true as const, summary: 'ringkas', sources: [], queries: [], provider: 'gemini' as const, fetchedAt: new Date().toISOString() };
    assert.equal(mod.trimForPrompt(result), 'ringkas');
  });

  test('trimForPrompt: summary >2500 char dipotong + catatan potongan ditambahkan', () => {
    const longSummary = 'x'.repeat(3000);
    const result = { available: true as const, summary: longSummary, sources: [], queries: [], provider: 'gemini' as const, fetchedAt: new Date().toISOString() };
    const trimmed = mod.trimForPrompt(result, 2500);
    assert.ok(trimmed.length < longSummary.length);
    assert.ok(trimmed.startsWith('x'.repeat(2500)));
    assert.match(trimmed, /dipotong/);
  });

  test('trimForPrompt: available=false balik string kosong', () => {
    const result = { available: false as const, summary: '', sources: [], queries: [], provider: 'none' as const, fetchedAt: new Date().toISOString(), note: 'x' };
    assert.equal(mod.trimForPrompt(result), '');
  });

  test('getWebResearchDailyStats: cache hit dan live fetch tercatat terpisah', async () => {
    respond = () => json(geminiSuccessBody('ringkasan stats'));
    const before1 = mod.getWebResearchDailyStats();
    await mod.researchWeb('query stats unik 1');
    await mod.researchWeb('query stats unik 1'); // cache hit
    const after1 = mod.getWebResearchDailyStats();
    assert.equal(after1.liveFetches - before1.liveFetches, 1);
    assert.equal(after1.cacheHits - before1.cacheHits, 1);
  });
});
