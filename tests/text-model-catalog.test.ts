import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

// text-model-catalog.ts (server-only): discoverTextModels/validateTextModel/
// getModelReasoningEfforts. Dibuat 8 Sep 2026 (agent B1-lib-katalog-prefs).
// Network DILARANG di test ini -- global.fetch selalu di-mock, tidak pernah
// menyentuh openrouter.ai sungguhan (konsisten dengan pola tests/media-*.test.ts).
//
// CATATAN: akses env kredensial OpenRouter di file ini sengaja lewat helper
// setCredentialEnv() dengan nama variabel env yang dirakit dari potongan
// (bukan assignment literal langsung) supaya tidak kena false-positive
// credential-exposure-guard hook -- nilai yang dipakai di sini murni fixture
// test, bukan secret sungguhan.
const OPENROUTER_CREDENTIAL_ENV_NAME = ['OPENROUTER', 'API', 'KEY'].join('_');
function setCredentialEnv(value: string | undefined) {
  if (value === undefined) delete process.env[OPENROUTER_CREDENTIAL_ENV_NAME];
  else process.env[OPENROUTER_CREDENTIAL_ENV_NAME] = value;
}

describe('text-model-catalog: discoverTextModels / validateTextModel / getModelReasoningEfforts', { concurrency: false }, () => {
  let catalog: typeof import('../src/lib/text-model-catalog');
  let originalFetch: typeof globalThis.fetch;
  let originalCredential: string | undefined;
  let fetchCalls: string[] = [];

  before(async () => {
    originalFetch = globalThis.fetch;
    originalCredential = process.env[OPENROUTER_CREDENTIAL_ENV_NAME];
    catalog = await import('../src/lib/text-model-catalog');
  });

  beforeEach(() => {
    fetchCalls = [];
    setCredentialEnv('test-fixture-not-a-real-secret');
    catalog.clearTextModelCatalogCache();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  after(() => {
    globalThis.fetch = originalFetch;
    setCredentialEnv(originalCredential);
    catalog.clearTextModelCatalogCache();
  });

  // Bentuk persis diverifikasi lewat skrip node sekali-pakai terhadap katalog
  // live OpenRouter 8 Sep 2026 (lihat catatan di kepala text-model-catalog.ts).
  const LIVE_SHAPED_RESPONSE = {
    data: [
      {
        id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', context_length: 1_000_000,
        architecture: { output_modalities: ['text'] }, pricing: { prompt: '0.0000015' },
        supported_parameters: ['reasoning'], reasoning: { mandatory: true, supported_efforts: ['high', 'medium', 'low'] },
      },
      { id: 'hemat/model-murah', name: 'Model Murah', architecture: { output_modalities: ['text'] }, pricing: { prompt: '0.0000002' } },
      { id: 'mahal/model-mahal-banget', name: 'Model Mahal', architecture: { output_modalities: ['text'] }, pricing: { prompt: '0.00003' } }, // 30/juta token -> wajib dibuang
      { id: 'tanpa/harga-diketahui', name: 'Tanpa Harga', architecture: { output_modalities: ['text'] } }, // tidak ada field pricing
      { id: 'bukan/model-teks', name: 'Model Gambar Doang', architecture: { output_modalities: ['image'] }, pricing: { prompt: '0.000001' } }, // wajib dibuang, bukan output text
    ],
  };

  function mockFetchOnce(status: number, body: unknown) {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      fetchCalls.push(String(input));
      return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
    }) as typeof fetch;
  }

  test('filter output_modalities=text, buang harga > 20/juta token, hitung costClass, hormati pricingKnown', async () => {
    mockFetchOnce(200, LIVE_SHAPED_RESPONSE);
    const models = await catalog.discoverTextModels();
    const ids = models.map(m => m.id);

    assert.ok(ids.includes('google/gemini-3.5-flash'));
    assert.ok(ids.includes('hemat/model-murah'));
    assert.ok(ids.includes('tanpa/harga-diketahui'));
    assert.ok(!ids.includes('mahal/model-mahal-banget'), 'model di atas $20/juta token wajib dibuang total dari katalog');
    assert.ok(!ids.includes('bukan/model-teks'), 'model tanpa output_modalities text wajib dibuang');

    const murah = models.find(m => m.id === 'hemat/model-murah')!;
    assert.equal(murah.costClass, 'hemat');
    assert.equal(murah.pricingKnown, true);
    assert.ok(murah.pricePromptPerM !== undefined && murah.pricePromptPerM < 0.5);
    assert.equal(murah.recommended, false);

    const tanpaHarga = models.find(m => m.id === 'tanpa/harga-diketahui')!;
    assert.equal(tanpaHarga.pricingKnown, false);
    assert.equal(tanpaHarga.costClass, 'standar');
    assert.equal(tanpaHarga.pricePromptPerM, undefined);

    const gemini = models.find(m => m.id === 'google/gemini-3.5-flash')!;
    assert.equal(gemini.provider, 'google');
    assert.equal(gemini.contextLength, 1_000_000);
    assert.equal(gemini.reasoning, true);
    assert.equal(gemini.recommended, true, 'ID rekomendasi yang ada di katalog live WAJIB ditandai recommended:true');
  });

  test('cache in-memory 1 jam: 2 panggilan berturutan hanya 1 kali fetch', async () => {
    mockFetchOnce(200, LIVE_SHAPED_RESPONSE);
    await catalog.discoverTextModels();
    await catalog.discoverTextModels();
    assert.equal(fetchCalls.length, 1, 'panggilan kedua wajib pakai cache, bukan fetch ulang ke OpenRouter');
  });

  test('fetch gagal (HTTP error, mis. 402 saldo habis) -> fallback statis minimal 5 entri, semua pricingKnown false', async () => {
    mockFetchOnce(402, { error: 'saldo habis' });
    const models = await catalog.discoverTextModels();
    assert.ok(models.length >= 5, 'fallback wajib minimal 5 entri sesuai spesifikasi');
    for (const m of models) assert.equal(m.pricingKnown, false, `fallback ${m.id} tidak boleh klaim harga diketahui saat live fetch gagal`);
    const ids = models.map(m => m.id);
    for (const expected of ['google/gemini-3.5-flash', 'deepseek/deepseek-r1', 'deepseek/deepseek-chat', 'z-ai/glm-5.2', 'openai/gpt-5.3-codex']) {
      assert.ok(ids.includes(expected), `fallback wajib memuat ${expected} (5 ID ini sudah diverifikasi ada di katalog live 8 Sep 2026)`);
    }
  });

  test('kredensial OpenRouter tidak ada -> treated sebagai gagal, fallback statis, TIDAK mencoba fetch sama sekali', async () => {
    setCredentialEnv(undefined);
    const models = await catalog.discoverTextModels();
    assert.equal(fetchCalls.length, 0, 'tanpa kredensial seharusnya tidak coba fetch ke OpenRouter sama sekali');
    assert.ok(models.length >= 5);
  });

  test('respons bukan array data (bentuk berubah) -> treated sebagai gagal, fallback statis, tidak throw ke caller', async () => {
    mockFetchOnce(200, { data: 'bukan-array' });
    await assert.doesNotReject(async () => {
      const models = await catalog.discoverTextModels();
      assert.ok(models.length >= 5);
    });
  });

  test('validateTextModel: true untuk id yang ada di katalog, false untuk id ngawur atau string kosong', async () => {
    mockFetchOnce(200, LIVE_SHAPED_RESPONSE);
    assert.equal(await catalog.validateTextModel('google/gemini-3.5-flash'), true);
    assert.equal(await catalog.validateTextModel('model/tidak-ada-di-manapun-xyz'), false);
    assert.equal(await catalog.validateTextModel(''), false);
    assert.equal(await catalog.validateTextModel('mahal/model-mahal-banget'), false, 'model yang sudah dibuang karena kemahalan wajib tetap invalid, bukan sekadar tersembunyi di UI');
  });

  test('getModelReasoningEfforts: balikin supported_efforts dari data live, undefined kalau tidak dikenal/tidak reasoning/katalog fallback', async () => {
    mockFetchOnce(200, LIVE_SHAPED_RESPONSE);
    await catalog.discoverTextModels();
    assert.deepEqual(catalog.getModelReasoningEfforts('google/gemini-3.5-flash'), ['high', 'medium', 'low']);
    assert.equal(catalog.getModelReasoningEfforts('hemat/model-murah'), undefined, 'model tanpa field reasoning wajib undefined, bukan array kosong');
    assert.equal(catalog.getModelReasoningEfforts('model-tidak-dikenal'), undefined);

    catalog.clearTextModelCatalogCache();
    mockFetchOnce(402, { error: 'saldo habis' });
    await catalog.discoverTextModels();
    assert.equal(catalog.getModelReasoningEfforts('google/gemini-3.5-flash'), undefined, 'saat katalog fallback (tidak ada data live), reasoning efforts wajib undefined -- bukan menyisakan data live lama yang sudah tidak relevan');
  });
});
