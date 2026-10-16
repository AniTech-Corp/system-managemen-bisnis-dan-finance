import assert from 'node:assert/strict';
import { before, describe, mock, test } from 'node:test';
import {
  readRoasTarget,
  groupCampaignsByMonth,
  buildCampaignYearEndProjection,
  pickTopMarketingRecommendations,
  formatDashboardInsightTimestamp,
  deriveMarketingMetrics,
} from '../src/app/components/MarketingModuleView';

// Kontrak marketing-build (10 Sep 2026) -- helper murni untuk dashboard Marketing
// (D3 target ROAS, blok "AI analisa & prediksi kampanye") dan AI Assistant Marketing
// (katalog produk baca-saja). >= 8 test per kontrak, ditulis 17 test agar tiap edge
// case (localStorage rusak, <2 bulan data, prioritas rekomendasi, dst) tercakup jelas.
//
// MarketingAIAssistantView.tsx meng-import CSS module (./marketing-media/studio.module.css)
// yang tidak bisa di-require Node/tsx langsung (SyntaxError) -- sama seperti pola
// mock.module di tests/ai-orchestrator.test.ts dkk, di-mock dulu SEBELUM dynamic import
// modul under test, dijalankan sekali di before() karena node:test module mocks berlaku
// global untuk sisa proses. Jalankan: node --experimental-test-module-mocks --import tsx --test

let formatProductCatalogLabel: typeof import('../src/app/components/MarketingAIAssistantView').formatProductCatalogLabel;
let applyProductCatalogToCopyForm: typeof import('../src/app/components/MarketingAIAssistantView').applyProductCatalogToCopyForm;
let applyProductCatalogToCalendarForm: typeof import('../src/app/components/MarketingAIAssistantView').applyProductCatalogToCalendarForm;

before(async () => {
  mock.module('../src/app/components/marketing-media/studio.module.css', {
    defaultExport: {},
  });
  const mod = await import('../src/app/components/MarketingAIAssistantView');
  formatProductCatalogLabel = mod.formatProductCatalogLabel;
  applyProductCatalogToCopyForm = mod.applyProductCatalogToCopyForm;
  applyProductCatalogToCalendarForm = mod.applyProductCatalogToCalendarForm;
});

describe('readRoasTarget (D3 -- target ROAS dari Pengaturan Marketing)', () => {
  test('targetRoas valid -> dipakai apa adanya', () => {
    assert.equal(readRoasTarget(JSON.stringify({ targetRoas: 4.2 })), 4.2);
  });

  test('raw null/kosong -> fallback 3.0', () => {
    assert.equal(readRoasTarget(null), 3.0);
    assert.equal(readRoasTarget(''), 3.0);
    assert.equal(readRoasTarget(undefined), 3.0);
  });

  test('JSON rusak -> fallback 3.0, tidak melempar error', () => {
    assert.equal(readRoasTarget('{bukan json valid'), 3.0);
  });

  test('targetRoas bukan angka positif (nol/negatif/string) -> fallback 3.0', () => {
    assert.equal(readRoasTarget(JSON.stringify({ targetRoas: 0 })), 3.0);
    assert.equal(readRoasTarget(JSON.stringify({ targetRoas: -2 })), 3.0);
    assert.equal(readRoasTarget(JSON.stringify({ targetRoas: 'abc' })), 3.0);
  });

  test('object tanpa field targetRoas -> fallback 3.0', () => {
    assert.equal(readRoasTarget(JSON.stringify({ maxCac: 100000 })), 3.0);
  });
});

describe('deriveMarketingMetrics (SSOT kartu, export, dan drilldown)', () => {
  test('menghasilkan metrik konsisten dari budget, ROAS, dan leads kampanye', () => {
    const result = deriveMarketingMetrics([
      { dailyBudget: 450000, roas: '4,6', leads: 285, status: 'ACTIVE' },
      { dailyBudget: 350000, roas: '3,8', leads: 194, status: 'ACTIVE' },
      { dailyBudget: 250000, roas: '4,1', leads: 142, status: 'ACTIVE' },
    ]);
    assert.equal(result.spend, 31500000);
    assert.equal(result.revenue, 132750000);
    assert.equal(result.leads, 621);
    assert.equal(result.activeCampaignsCount, 3);
    assert.equal(result.roas, '4,2x');
  });

  test('real API rows mengalahkan default nol dan status pause tidak dihitung aktif', () => {
    const result = deriveMarketingMetrics([
      { dailyBudget: 100000, roas: 2, leads: 10, status: 'PAUSED' },
      { dailyBudget: 50000, roas: 4, leads: 5, status: 'ACTIVE' },
    ]);
    assert.equal(result.spend, 4500000);
    assert.equal(result.revenue, 12000000);
    assert.equal(result.leads, 15);
    assert.equal(result.activeCampaignsCount, 1);
    assert.equal(result.roas, '2,7x');
  });

  test('nilai rusak/negatif tidak menjadi NaN, Infinity, atau angka negatif', () => {
    const result = deriveMarketingMetrics([
      { dailyBudget: 'bukan angka', roas: -4, leads: -9, status: 'ACTIVE' },
      { dailyBudget: 100000, roas: 'x', leads: 'x', status: 'PAUSED' },
    ]);
    assert.deepEqual(result, {
      roas: '0x',
      revenue: 0,
      spend: 3000000,
      leads: 0,
      activeCampaignsCount: 1,
    });
  });
});

describe('groupCampaignsByMonth (gerbang AI analisa & prediksi kampanye)', () => {
  test('kampanye tanpa createdAt diabaikan, tidak error', () => {
    const samples = groupCampaignsByMonth([{ dailyBudget: 100000, roas: 3 } as any]);
    assert.equal(samples.length, 0);
  });

  test('2 kampanye di bulan yang sama digabung jadi 1 sample', () => {
    const samples = groupCampaignsByMonth([
      { createdAt: '2026-07-05T00:00:00Z', dailyBudget: 100000, roas: 3 },
      { createdAt: '2026-07-20T00:00:00Z', dailyBudget: 50000, roas: 2 },
    ]);
    assert.equal(samples.length, 1);
    assert.equal(samples[0].monthKey, '2026-07');
    assert.equal(samples[0].spend, (100000 + 50000) * 30);
  });

  test('kampanye di bulan berbeda menghasilkan sample terpisah, terurut ascending', () => {
    const samples = groupCampaignsByMonth([
      { createdAt: '2026-08-01T00:00:00Z', dailyBudget: 100000, roas: 3 },
      { createdAt: '2026-06-01T00:00:00Z', dailyBudget: 100000, roas: 3 },
    ]);
    assert.equal(samples.length, 2);
    assert.deepEqual(samples.map((s) => s.monthKey), ['2026-06', '2026-08']);
  });

  test('roas string (format lama) tetap terhitung ke revenue', () => {
    const samples = groupCampaignsByMonth([{ createdAt: '2026-05-01T00:00:00Z', dailyBudget: 100000, roas: '2.5' }]);
    assert.equal(samples[0].revenue, 100000 * 30 * 2.5);
  });

  test('createdAt tidak valid (NaN date) tidak membuat sample', () => {
    const samples = groupCampaignsByMonth([{ createdAt: 'bukan-tanggal', dailyBudget: 100000, roas: 3 } as any]);
    assert.equal(samples.length, 0);
  });
});

describe('buildCampaignYearEndProjection (gate >= 2 bulan data)', () => {
  test('kurang dari 2 sample -> null (jujur, tidak proyeksi dari 1 titik data)', () => {
    assert.equal(buildCampaignYearEndProjection([]), null);
    assert.equal(buildCampaignYearEndProjection([{ monthKey: '2026-07', spend: 100, revenue: 300 }]), null);
  });

  test('>= 2 sample -> proyeksi dihitung dari rata-rata run-rate', () => {
    const now = new Date('2026-09-10T00:00:00Z'); // bulan index 8 (September)
    const result = buildCampaignYearEndProjection(
      [
        { monthKey: '2026-07', spend: 1000000, revenue: 3000000 },
        { monthKey: '2026-08', spend: 2000000, revenue: 5000000 },
      ],
      now
    );
    assert.ok(result);
    assert.equal(result!.monthsTracked, 2);
    assert.equal(result!.avgMonthlySpend, 1500000);
    assert.equal(result!.avgMonthlyRevenue, 4000000);
    // sisa bulan setelah September (index 8) di tahun itu = Okt,Nov,Des = 3
    assert.equal(result!.monthsRemainingInYear, 3);
    assert.equal(result!.projectedRevenueEndOfYear, 4000000 * 4);
  });

  test('avgMonthlySpend nol -> avgMonthlyRoas nol (bukan Infinity/NaN)', () => {
    const result = buildCampaignYearEndProjection([
      { monthKey: '2026-07', spend: 0, revenue: 0 },
      { monthKey: '2026-08', spend: 0, revenue: 0 },
    ]);
    assert.ok(result);
    assert.equal(result!.avgMonthlyRoas, 0);
  });
});

describe('pickTopMarketingRecommendations (2 rekomendasi dari brain/recommendations)', () => {
  const base = (over: Partial<{ id: string; category: string; priority: string; title: string }>) => ({
    id: 'x',
    category: 'MARKETING',
    priority: 'MEDIUM',
    title: 't',
    prescription: 'p',
    ...over,
  });

  test('hanya kategori MARKETING yang lolos', () => {
    const picked = pickTopMarketingRecommendations([
      base({ id: '1', category: 'FINANCE' }),
      base({ id: '2', category: 'MARKETING' }),
    ]);
    assert.equal(picked.length, 1);
    assert.equal(picked[0].id, '2');
  });

  test('diurutkan prioritas CRITICAL > HIGH > MEDIUM > LOW', () => {
    const picked = pickTopMarketingRecommendations([
      base({ id: 'low', priority: 'LOW' }),
      base({ id: 'critical', priority: 'CRITICAL' }),
      base({ id: 'high', priority: 'HIGH' }),
    ]);
    assert.deepEqual(picked.map((p) => p.id), ['critical', 'high']);
  });

  test('limit membatasi jumlah hasil (default 2)', () => {
    const picked = pickTopMarketingRecommendations([
      base({ id: '1' }),
      base({ id: '2' }),
      base({ id: '3' }),
    ]);
    assert.equal(picked.length, 2);
  });

  test('input bukan array / null -> array kosong, tidak error', () => {
    assert.deepEqual(pickTopMarketingRecommendations(null), []);
    assert.deepEqual(pickTopMarketingRecommendations(undefined), []);
  });
});

describe('formatProductCatalogLabel (katalog produk baca-saja)', () => {
  test('dengan unit -> "Nama (Rp harga/unit)"', () => {
    assert.equal(
      formatProductCatalogLabel({ id: '1', name: 'Kopi Susu', sellPrice: 15000, unit: 'pcs' }),
      'Kopi Susu (Rp 15.000/pcs)'
    );
  });

  test('tanpa unit -> "Nama (Rp harga)"', () => {
    assert.equal(
      formatProductCatalogLabel({ id: '1', name: 'Kopi Susu', sellPrice: 15000 }),
      'Kopi Susu (Rp 15.000)'
    );
  });
});

describe('applyProductCatalogToCopyForm (form Copywriting, tanpa menghapus input manual)', () => {
  test('product null -> form tidak berubah', () => {
    const form = { productName: 'Manual', productDesc: 'Deskripsi manual', targetAudience: '', promoTone: 'x', promoAngle: 'y' };
    assert.deepEqual(applyProductCatalogToCopyForm(form, null), form);
  });

  test('productDesc kosong -> diisi baris harga', () => {
    const form = { productName: '', productDesc: '', targetAudience: '', promoTone: 'x', promoAngle: 'y' };
    const result = applyProductCatalogToCopyForm(form, { id: '1', name: 'Kopi Susu', sellPrice: 15000 });
    assert.equal(result.productName, 'Kopi Susu');
    assert.equal(result.productDesc, 'Harga jual Rp 15.000');
  });

  test('productDesc manual sudah terisi -> harga ditambahkan sebagai baris baru, teks manual TIDAK hilang', () => {
    const form = { productName: '', productDesc: 'Kopi susu gula aren enak', targetAudience: '', promoTone: 'x', promoAngle: 'y' };
    const result = applyProductCatalogToCopyForm(form, { id: '1', name: 'Kopi Susu', sellPrice: 15000 });
    assert.match(result.productDesc, /Kopi susu gula aren enak/);
    assert.match(result.productDesc, /Harga jual Rp 15\.000/);
  });

  test('pilih produk yang sama 2x tidak menduplikasi baris harga', () => {
    const form = { productName: '', productDesc: '', targetAudience: '', promoTone: 'x', promoAngle: 'y' };
    const product = { id: '1', name: 'Kopi Susu', sellPrice: 15000 };
    const once = applyProductCatalogToCopyForm(form, product);
    const twice = applyProductCatalogToCopyForm(once, product);
    const occurrences = (twice.productDesc.match(/Harga jual Rp 15\.000/g) || []).length;
    assert.equal(occurrences, 1);
  });
});

describe('applyProductCatalogToCalendarForm (form Kalender Konten)', () => {
  test('mengisi mainCampaign dari nama + harga produk', () => {
    const form = { title: 'Judul manual', industry: 'F&B', mainCampaign: 'Brand Awareness & Promo Mingguan' };
    const result = applyProductCatalogToCalendarForm(form, { id: '1', name: 'Kopi Susu', sellPrice: 15000 });
    assert.equal(result.mainCampaign, 'Promo Kopi Susu (Rp 15.000)');
    // field lain tidak disentuh
    assert.equal(result.title, 'Judul manual');
    assert.equal(result.industry, 'F&B');
  });

  test('product null -> form tidak berubah', () => {
    const form = { title: 'x', industry: 'y', mainCampaign: 'z' };
    assert.deepEqual(applyProductCatalogToCalendarForm(form, null), form);
  });
});

// KONTRAK MODUL 6 (11 Sep 2026, Fable) -- header kartu "Analisis & rekomendasi
// AI" (dashboard-insight). MURNI Date getters lokal, TIDAK pakai Intl supaya
// tidak bergantung ketersediaan data locale ICU di runtime test.
describe('formatDashboardInsightTimestamp (kartu Analisis & rekomendasi AI)', () => {
  test('jam & menit diformat 2-digit dengan leading zero', () => {
    // 09-11 03:05 WIB (Asia/Jakarta, UTC+7) = 08-31T20:05Z hari sebelumnya.
    assert.equal(formatDashboardInsightTimestamp('2026-08-31T20:05:00.000Z', false), 'Diperbarui 03:05');
  });

  test('cached true -> suffix "(cache)" ditambahkan', () => {
    assert.equal(formatDashboardInsightTimestamp('2026-08-31T20:05:00.000Z', true), 'Diperbarui 03:05 (cache)');
  });

  test('generatedAt tidak valid -> jujur tampilkan "--", bukan "Invalid Date" mentah', () => {
    assert.equal(formatDashboardInsightTimestamp('bukan-tanggal', false), 'Diperbarui --');
    assert.equal(formatDashboardInsightTimestamp('bukan-tanggal', true), 'Diperbarui -- (cache)');
  });
});
