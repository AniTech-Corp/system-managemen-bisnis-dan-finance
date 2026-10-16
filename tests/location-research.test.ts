import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import type { LocationAnalysisInput, ResearchWebResult } from '../src/lib/research-types';

// tests/location-research.test.ts -- murni logic, NOL network. Dibangun 8 Sep
// 2026 (wave B3-location-research).
//
// researchWeb() (milik B1, src/lib/web-research.ts) di-mock via mock.module
// supaya test ini tidak bergantung pada fetch Gemini sungguhan -- fetch/parse
// grounding sendiri adalah tanggung jawab tests/web-research.test.ts (B1).
// mock.module mencocokkan berdasarkan URL modul yang SUDAH DIRESOLVE, jadi
// spesifier relatif berbeda dari sisi test ini ('../src/lib/web-research')
// vs sisi location-research.ts ('./web-research') tetap match, sama seperti
// pola tests/brain-models-route.test.ts terhadap text-model-catalog.ts.
//
// Catatan: penulisan ke process.env pakai notasi bracket ("process.env['...']
// = ...") bukan notasi titik -- murni gaya penulisan test, bukan perubahan
// perilaku (identik dengan process.env.NAMA = ...).

const GOOGLE_MAPS_ENV_NAME = 'GOOGLE_MAPS_API_KEY';

describe('location-research: googleMapsProvider (wadah, belum aktif) + webFallbackProvider (aktif) + analyzeLocation', { concurrency: false }, () => {
  let previousGoogleMapsKey: string | undefined;
  let researchWebCalls: Array<{ query: string; opts?: Record<string, unknown> }>;
  let researchWebImpl: (query: string, opts?: Record<string, unknown>) => Promise<ResearchWebResult>;

  let googleMapsProvider: typeof import('../src/lib/location-research')['googleMapsProvider'];
  let webFallbackProvider: typeof import('../src/lib/location-research')['webFallbackProvider'];
  let analyzeLocation: typeof import('../src/lib/location-research')['analyzeLocation'];

  function stubResult(overrides: Partial<ResearchWebResult> = {}): ResearchWebResult {
    return {
      available: true,
      summary: 'ringkasan stub',
      sources: [],
      queries: [],
      provider: 'gemini',
      fetchedAt: '2026-09-08T10:00:00.000Z',
      ...overrides,
    };
  }

  before(async () => {
    previousGoogleMapsKey = process.env[GOOGLE_MAPS_ENV_NAME];
    delete process.env[GOOGLE_MAPS_ENV_NAME]; // default: key TIDAK ada, sama seperti prod saat ini

    mock.module('../src/lib/web-research', {
      namedExports: {
        researchWeb: async (query: string, opts?: Record<string, unknown>) => {
          researchWebCalls.push({ query, opts });
          return researchWebImpl(query, opts);
        },
      },
    });

    ({ googleMapsProvider, webFallbackProvider, analyzeLocation } = await import('../src/lib/location-research'));
  });

  beforeEach(() => {
    researchWebCalls = [];
    researchWebImpl = async () => stubResult();
  });

  after(() => {
    if (previousGoogleMapsKey === undefined) delete process.env[GOOGLE_MAPS_ENV_NAME];
    else process.env[GOOGLE_MAPS_ENV_NAME] = previousGoogleMapsKey;
  });

  const baseInput: LocationAnalysisInput = {
    businessName: 'Kedai Kopi Rahasia Mecca',
    category: 'kedai kopi',
    area: 'Bekasi Timur',
    purpose: 'cabang_baru',
  };

  // ---------------------------------------------------------------------
  // googleMapsProvider -- wadah, belum aktif
  // ---------------------------------------------------------------------

  test('googleMapsProvider.available = false selalu saat GOOGLE_MAPS_API_KEY tidak di-set', () => {
    assert.equal(googleMapsProvider.available, false);
  });

  test('googleMapsProvider.available tetap false untuk nilai env placeholder (bukan cuma "tidak di-set")', () => {
    const prev = process.env[GOOGLE_MAPS_ENV_NAME];
    process.env[GOOGLE_MAPS_ENV_NAME] = 'placeholder-belum-diisi-bukan-kredensial-asli';
    try {
      assert.equal(googleMapsProvider.available, false);
    } finally {
      if (prev === undefined) delete process.env[GOOGLE_MAPS_ENV_NAME];
      else process.env[GOOGLE_MAPS_ENV_NAME] = prev;
    }
  });

  test('googleMapsProvider.searchNearby() sendiri (dipanggil langsung) selalu balikin [] -- wadah kosong, bukan bug', async () => {
    const result = await googleMapsProvider.searchNearby('kedai kopi di Bekasi');
    assert.deepEqual(result, []);
  });

  test('analyzeLocation TIDAK PERNAH memanggil googleMapsProvider.searchNearby ketika available=false (assert mock call count 0)', async () => {
    const spy = mock.method(googleMapsProvider, 'searchNearby');
    try {
      await analyzeLocation(baseInput);
      assert.equal(spy.mock.calls.length, 0, 'googleMapsProvider.searchNearby tidak boleh terpanggil saat key tidak usable');
    } finally {
      spy.mock.restore();
    }
  });

  test('analyzeLocation memakai providerUsed="web" ketika GOOGLE_MAPS_API_KEY tidak ada', async () => {
    const result = await analyzeLocation(baseInput);
    assert.equal(result.providerUsed, 'web');
  });

  // ---------------------------------------------------------------------
  // webFallbackProvider + researchWeb (di-mock)
  // ---------------------------------------------------------------------

  test('webFallbackProvider.available selalu true (bergantung fail-soft researchWeb, bukan pre-check kredensial sendiri)', () => {
    assert.equal(webFallbackProvider.available, true);
  });

  test('researchWeb tersedia (available:true) -> sources jadi LocationCompetitor (name dari title, source dari url)', async () => {
    researchWebImpl = async () =>
      stubResult({
        sources: [
          { title: 'Kopi Kenangan - Bekasi Timur', url: 'https://maps.example/kopi-kenangan' },
          { title: 'Warung Kopi Pak Budi', url: 'https://maps.example/warkop-budi' },
        ],
      });

    const result = await analyzeLocation(baseInput);
    assert.equal(result.providerUsed, 'web');
    assert.equal(result.competitors.length, 2);
    assert.deepEqual(result.competitors[0], { name: 'Kopi Kenangan - Bekasi Timur', source: 'https://maps.example/kopi-kenangan' });
    assert.deepEqual(result.sources, [
      { title: 'Kopi Kenangan - Bekasi Timur', url: 'https://maps.example/kopi-kenangan' },
      { title: 'Warung Kopi Pak Budi', url: 'https://maps.example/warkop-budi' },
    ]);
  });

  test('researchWeb TIDAK tersedia (available:false) -> verdict "tidak cukup data", competitors kosong', async () => {
    researchWebImpl = async () => stubResult({ available: false, summary: '', note: 'riset web tidak tersedia sekarang' });

    const result = await analyzeLocation(baseInput);
    assert.equal(result.verdict, 'tidak cukup data');
    assert.deepEqual(result.competitors, []);
    assert.deepEqual(result.sources, []);
    assert.ok(result.reasons.length > 0, 'reasons WAJIB diisi, bukan array kosong, biar user tahu KENAPA tidak cukup data');
  });

  test('sources dengan URL duplikat di-dedupe sebelum jadi kompetitor', async () => {
    researchWebImpl = async () =>
      stubResult({
        sources: [
          { title: 'Kopi A (halaman utama)', url: 'https://dup.example/a' },
          { title: 'Kopi A (halaman menu)', url: 'https://dup.example/a' },
          { title: 'Kopi B', url: 'https://dup.example/b' },
        ],
      });

    const result = await analyzeLocation(baseInput);
    assert.equal(result.competitors.length, 2, 'URL sama HARUS dihitung 1 kompetitor, bukan 2');
  });

  test('query yang dikirim ke researchWeb TIDAK menyertakan businessName (privasi) -- hanya category + area', async () => {
    await analyzeLocation(baseInput);
    assert.equal(researchWebCalls.length, 1);
    const sentQuery = researchWebCalls[0].query;
    assert.ok(!sentQuery.includes(baseInput.businessName), `query "${sentQuery}" tidak boleh memuat nama bisnis "${baseInput.businessName}"`);
    assert.ok(sentQuery.includes(baseInput.category), 'query wajib memuat kategori supaya riset relevan');
    assert.ok(sentQuery.includes(baseInput.area), 'query wajib memuat area supaya riset relevan lokasi');
  });

  test('researchWeb dipanggil dengan region ID', async () => {
    await analyzeLocation(baseInput);
    assert.equal(researchWebCalls[0].opts?.region, 'ID');
  });

  // ---------------------------------------------------------------------
  // Heuristik verdict (kasar, disebut jujur di reasons)
  // ---------------------------------------------------------------------

  test('0 kompetitor + riset tersedia -> verdict "cocok" (bukan "tidak cukup data")', async () => {
    researchWebImpl = async () => stubResult({ sources: [] });
    const result = await analyzeLocation(baseInput);
    assert.equal(result.verdict, 'cocok');
  });

  test('radius default 2km dipakai kalau radiusKm tidak diisi', async () => {
    researchWebImpl = async () =>
      stubResult({
        sources: Array.from({ length: 2 }, (_, i) => ({ title: `Kompetitor ${i}`, url: `https://x.example/${i}` })),
      });
    // 2 kompetitor / 2km default = density 1 -> masih 'cocok' (<=1)
    const result = await analyzeLocation({ ...baseInput, radiusKm: undefined });
    assert.equal(result.verdict, 'cocok');
  });

  test('kepadatan tinggi (banyak kompetitor, radius kecil) -> verdict "kurang cocok"', async () => {
    researchWebImpl = async () =>
      stubResult({
        sources: Array.from({ length: 8 }, (_, i) => ({ title: `Kompetitor ${i}`, url: `https://x.example/${i}` })),
      });
    const result = await analyzeLocation({ ...baseInput, radiusKm: 1 });
    assert.equal(result.verdict, 'kurang cocok');
  });

  test('kepadatan sedang -> verdict "hati-hati"', async () => {
    researchWebImpl = async () =>
      stubResult({
        sources: Array.from({ length: 4 }, (_, i) => ({ title: `Kompetitor ${i}`, url: `https://x.example/${i}` })),
      });
    const result = await analyzeLocation({ ...baseInput, radiusKm: 2 }); // density = 2
    assert.equal(result.verdict, 'hati-hati');
  });

  test('reasons[] selalu menyebut ini perkiraan kasar, bukan data presisi (HARAM klaim presisi statistik)', async () => {
    researchWebImpl = async () =>
      stubResult({ sources: [{ title: 'Kompetitor 1', url: 'https://x.example/1' }] });
    const result = await analyzeLocation(baseInput);
    const joined = result.reasons.join(' ').toLowerCase();
    assert.ok(joined.includes('perkiraan') || joined.includes('kasar'), 'reasons wajib jujur soal ketidakpastian heuristik');
  });

  test('summary memisahkan label DATA PUBLIK secara eksplisit (aturan context pack: pisahkan tegas sumber data)', async () => {
    const result = await analyzeLocation(baseInput);
    assert.ok(result.summary.includes('DATA PUBLIK'), 'summary wajib eksplisit menyebut DATA PUBLIK');
  });

  test('purpose "sekitar_kantor" tetap menghasilkan verdict + summary yang valid (bukan hanya cabang_baru)', async () => {
    const result = await analyzeLocation({ ...baseInput, purpose: 'sekitar_kantor' });
    assert.ok(['cocok', 'hati-hati', 'kurang cocok', 'tidak cukup data'].includes(result.verdict));
    assert.ok(result.summary.length > 0);
  });
});
