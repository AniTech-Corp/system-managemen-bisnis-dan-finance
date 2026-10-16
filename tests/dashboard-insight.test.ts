import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';

// ---------------------------------------------------------------------------
// B3_AI TESTS (11 Sep 2026) -- src/lib/ai-brain/dashboard-insight.ts (kontrak
// modul 6). Pola mock: '@/lib/ai-brain/{context-engine,decision-engine,
// prediction-engine,company-brief}' DAN '@/lib/ai-orchestrator' di-mock TOTAL
// (nol query Prisma sungguhan lewat context-engine, nol panggilan LLM
// sungguhan) -- mengikuti pola tests/brain-forecast-route.test.ts (mock
// '@/lib/ai-brain' penuh) tapi di sini per-file karena dashboard-insight.ts
// mengimpor langsung dari file spesifik (bukan barrel index.ts), plus fakePrisma
// (Proxy) untuk cache MemoryItem[DASHBOARD_INSIGHT] + query sumberData
// (cashTransaction.count/product.count/workspaceFile.findMany).
//
// Waktu (TTL cache 30 menit, rate limit refresh 2 menit) dikontrol via
// mock.timers.enable({apis:['Date']}) supaya test TIDAK perlu menunggu
// sungguhan -- dashboard-insight.ts membaca Date.now()/new Date() untuk
// keduanya, jadi mocking Date cukup (TIDAK butuh mock setTimeout, modul ini
// tidak pakai debounce/setTimeout sama sekali).
//
// Jalankan dengan `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

const BASE_TIME = 1_757_000_000_000; // titik waktu tetap sembarang, hanya perlu konsisten antar-tick.

function makeContext(overrides: Partial<any> = {}): any {
  return {
    workspaceId: 'ws-x',
    workspaceName: 'Toko Sintetis',
    generatedAt: new Date(BASE_TIME).toISOString(),
    cacheTtlSeconds: 60,
    financials: {
      liquidCash: 10_000_000,
      totalIncome30d: 8_000_000,
      totalExpense30d: 5_000_000,
      netCashflow30d: 3_000_000,
      monthlyBurnRate: 0,
      runwayMonths: 99,
      runwayIsUnbounded: true,
      totalUnpaidInvoices: 0,
      unpaidInvoicesCount: 0,
      overdueInvoicesCount: 0,
      opEx30d: 0,
      capEx30d: 0,
      grossMarginPercent: 37,
    },
    marketing: { activeCampaignsCount: 2, activeCouponsCount: 0, couponRedemptions30d: 0, estimatedMarketingSpend30d: 0, attributedRevenue30d: 0, estimatedROAS: 0, estimatedCAC: 0 },
    operations: { totalTasks: 5, completedTasks: 3, inProgressTasks: 1, todoTasks: 1, completionRatePercent: 60, overdueTasksCount: 0 },
    strategy: { corplanProjectsCount: 0, strategicPillarsDefined: false, primaryIndustry: 'F&B', targetMarket: 'Umum', hasActiveOKRs: false },
    healthScore: { totalScore: 70, grade: 'HEALTHY', breakdown: { financeScore: 70, growthScore: 70, opsScore: 70, strategyScore: 70 }, keyRisks: ['Risiko sintetis satu'], keyStrengths: ['Kekuatan sintetis satu'] },
    ...overrides,
  };
}

const RECOMMENDATIONS_FIXTURE = [
  {
    id: 'rec-fin-1', category: 'FINANCE', priority: 'HIGH', title: 'Audit OpEx',
    triggerReason: 'Pengeluaran naik', prescription: 'Kurangi biaya non-esensial',
    projectedImpact: { costSavingsEstimated: 1_000_000, confidenceScore: 0.8 },
    suggestedActionType: 'AUDIT_OPEX', isExecutable: true,
  },
  {
    id: 'rec-mkt-1', category: 'MARKETING', priority: 'MEDIUM', title: 'Naikkan budget iklan',
    triggerReason: 'ROAS bagus', prescription: 'Tambah 20% budget',
    projectedImpact: { revenueBoostPercent: 15, confidenceScore: 0.6 },
    suggestedActionType: 'SCALE_MARKETING', isExecutable: true,
  },
];

const FORECAST_FIXTURE = {
  currentLiquidCash: 10_000_000,
  monthlyBurnRate: 0,
  runwayMonths: 99,
  cashOutDate: null,
  trajectories: { conservative: [], expected: [], optimistic: [] },
  anomalies: [],
};

describe('dashboard-insight: getDashboardInsight (cache/rate-limit/fallback)', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;

  let getDashboardInsight: typeof import('../src/lib/ai-brain/dashboard-insight')['getDashboardInsight'];

  let memoryItems: Array<{ id: string; workspaceId: string; userId: string | null; scope: string; content: string; createdAt: Date }>;
  let contextCalls: number;
  let orchestrateCalls: any[];
  let orchestrateResponder: () => { text: string; json?: any };
  let companyBriefFixture: { text: string; generatedAt: string | null; sources: number } | null;
  let idSeq: number;
  let cashTxCount: number;
  let productCount: number;
  let workspaceFilesFixture: Array<{ fileName: string; extractedSummary: string | null }>;

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
              return async (query: any = {}) => {
                const method = `${model}.${operation}`;
                if (method === 'memoryItem.findFirst') {
                  const rows = memoryItems
                    .filter((r) => r.workspaceId === query.where?.workspaceId && r.scope === query.where?.scope)
                    .filter((r) => !query.where?.content?.startsWith || r.content.startsWith(query.where.content.startsWith))
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                  return rows[0] ?? null;
                }
                if (method === 'memoryItem.create') {
                  idSeq += 1;
                  const row = { id: `mem-${idSeq}`, createdAt: new Date(), ...query.data };
                  memoryItems.push(row);
                  return row;
                }
                if (method === 'cashTransaction.count') return cashTxCount;
                if (method === 'product.count') return productCount;
                if (method === 'workspaceFile.findMany') return workspaceFilesFixture;
                throw new Error(`Unmocked Prisma operation in dashboard-insight test: ${method}`);
              };
            },
          }
        );
      },
    }
  );

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    mock.module('../src/lib/ai-brain/context-engine', {
      namedExports: {
        getOrBuildBusinessContext: async () => {
          contextCalls += 1;
          return makeContext();
        },
      },
    });
    mock.module('../src/lib/ai-brain/decision-engine', {
      namedExports: {
        generateStrategicRecommendations: () => RECOMMENDATIONS_FIXTURE,
      },
    });
    mock.module('../src/lib/ai-brain/prediction-engine', {
      namedExports: {
        runForwardForecast: () => FORECAST_FIXTURE,
      },
    });
    mock.module('../src/lib/ai-brain/company-brief', {
      namedExports: {
        getCompanyBrief: async () => companyBriefFixture,
      },
    });
    mock.module('../src/lib/ai-orchestrator', {
      namedExports: {
        orchestrate: async (opts: any) => {
          orchestrateCalls.push(opts);
          const resp = orchestrateResponder();
          return { text: resp.text, json: resp.json, provider: 'stub-provider', modelUsed: 'stub-model', latencyMs: 1, task: 'analyze', routedProvider: 'openrouter', historyDowngraded: false };
        },
      },
    });

    ({ getDashboardInsight } = await import('../src/lib/ai-brain/dashboard-insight'));
  });

  beforeEach(() => {
    memoryItems = [];
    contextCalls = 0;
    orchestrateCalls = [];
    orchestrateResponder = () => ({ text: '', json: undefined });
    companyBriefFixture = null;
    idSeq = 0;
    cashTxCount = 0;
    productCount = 0;
    workspaceFilesFixture = [];
    mock.timers.enable({ apis: ['Date'], now: BASE_TIME });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
  });

  const VALID_LLM_JSON = {
    ringkasan: 'Bisnis stabil bulan ini berdasarkan transaksi tercatat.',
    sorotan: ['Omset naik dibanding bulan lalu.'],
    rekomendasi: [{ judul: 'Audit OpEx', alasan: 'Biaya naik', langkah: 'Kurangi biaya', dampak: 'Hemat Rp 1jt', prioritas: 'tinggi' }],
    prediksi: { teks: 'Kas diperkirakan aman.', keyakinan: 'sedang' },
    peringatan: [],
    pertanyaanLanjutan: ['Apakah profit bulan ini?'],
    catatanJujur: [],
  };

  test('cache kosong, LLM sukses -> insight dari LLM (cached:false), cache ditulis', async () => {
    orchestrateResponder = () => ({ text: JSON.stringify(VALID_LLM_JSON), json: VALID_LLM_JSON });
    const insight = await getDashboardInsight('ws-llm-sukses', 'ceo');
    assert.equal(insight.cached, false);
    assert.equal(insight.ringkasan, VALID_LLM_JSON.ringkasan);
    assert.equal(insight.rekomendasi[0].judul, 'Audit OpEx');
    assert.equal(insight.prediksi.keyakinan, 'sedang');
    assert.equal(orchestrateCalls.length, 1);
    assert.equal(orchestrateCalls[0].task, 'analyze');
    assert.equal(orchestrateCalls[0].jsonMode, true);
    assert.ok(memoryItems.some((m) => m.content.startsWith('[DASHBOARD_INSIGHT role=ceo]')), 'cache MemoryItem harus ditulis');
  });

  test('LLM gagal (json invalid & text bukan JSON) -> fallback DETERMINISTIK, catatanJujur menyebut "mekanis"', async () => {
    orchestrateResponder = () => ({ text: 'bukan json valid sama sekali', json: undefined });
    const insight = await getDashboardInsight('ws-llm-gagal', 'ceo');
    assert.ok(insight.catatanJujur.some((c) => /mekanis/i.test(c)));
    assert.ok(insight.ringkasan.length > 0);
  });

  test('orchestrate() reject (provider down) -> fallback DETERMINISTIK, TIDAK throw', async () => {
    orchestrateResponder = () => {
      throw new Error('simulasi provider down');
    };
    const insight = await getDashboardInsight('ws-llm-reject', 'ceo');
    assert.ok(insight.catatanJujur.some((c) => /mekanis/i.test(c)));
  });

  test('role finance -> deterministic fallback hanya berisi rekomendasi kategori FINANCE', async () => {
    orchestrateResponder = () => ({ text: 'invalid', json: undefined });
    const insight = await getDashboardInsight('ws-role-finance', 'finance');
    assert.ok(insight.rekomendasi.length >= 1);
    assert.ok(insight.rekomendasi.every((r) => r.judul !== 'Naikkan budget iklan'), 'rekomendasi MARKETING tidak boleh muncul untuk role finance');
  });

  test('material LLM Finance tidak membawa detail Marketing, brief lintas divisi, atau health composite', async () => {
    orchestrateResponder = () => ({ text: JSON.stringify(VALID_LLM_JSON), json: VALID_LLM_JSON });
    companyBriefFixture = { text: 'BRIEF berisi angka marketing rahasia Rp 999jt', generatedAt: null, sources: 1 };
    const insight = await getDashboardInsight('ws-finance-boundary', 'finance');
    const prompt = String(orchestrateCalls[0]?.prompt || '');
    assert.equal(insight.sumberData.kampanye, 0);
    assert.doesNotMatch(prompt, /Naikkan budget iklan|kampanye aktif/);
    assert.doesNotMatch(prompt, /BRIEF berisi angka marketing rahasia/);
    assert.match(prompt, /SKOR KESEHATAN BISNIS: tidak dibagikan/);
    assert.match(prompt, /Audit OpEx/);
  });

  test('role marketing -> deterministic fallback hanya berisi rekomendasi kategori MARKETING', async () => {
    orchestrateResponder = () => ({ text: 'invalid', json: undefined });
    const insight = await getDashboardInsight('ws-role-marketing', 'marketing');
    assert.ok(insight.rekomendasi.every((r) => r.judul !== 'Audit OpEx'), 'rekomendasi FINANCE tidak boleh muncul untuk role marketing');
  });

  test('sumberData dihitung dari prisma count/findMany, bukan angka karangan', async () => {
    orchestrateResponder = () => ({ text: 'invalid', json: undefined });
    cashTxCount = 7;
    productCount = 3;
    workspaceFilesFixture = [
      { fileName: 'laporan-penjualan-agustus.xlsx', extractedSummary: 'isi biasa' },
      { fileName: 'notulen-rapat.docx', extractedSummary: '===== ANGKA TERVERIFIKASI ===== ...' },
      { fileName: 'foto-produk.png', extractedSummary: null },
    ];
    const insight = await getDashboardInsight('ws-sumberdata', 'ceo');
    assert.equal(insight.sumberData.jumlahTransaksi, 7);
    assert.equal(insight.sumberData.transaksiTercatat, true);
    assert.equal(insight.sumberData.produk, 3);
    assert.equal(insight.sumberData.dokumen, 3);
    assert.equal(insight.sumberData.dokumenLedgerTerdeteksi, 2, 'laporan-penjualan (nama cocok regex) + notulen (ANGKA TERVERIFIKASI) = 2');
    assert.equal(insight.sumberData.kampanye, 2);
    assert.equal(insight.sumberData.tugas, 5);
  });

  test('cache HIT dalam TTL 30 menit -> gatherMaterial TIDAK dipanggil ulang (context-engine 0x panggilan tambahan)', async () => {
    orchestrateResponder = () => ({ text: JSON.stringify(VALID_LLM_JSON), json: VALID_LLM_JSON });
    await getDashboardInsight('ws-cache-hit', 'ceo');
    assert.equal(contextCalls, 1);
    const second = await getDashboardInsight('ws-cache-hit', 'ceo');
    assert.equal(contextCalls, 1, 'panggilan kedua (masih dalam TTL) harus baca cache, TIDAK rebuild');
    assert.equal(second.cached, true);
  });

  test('cache EXPIRED (>30 menit) -> dibangun ulang', async () => {
    orchestrateResponder = () => ({ text: JSON.stringify(VALID_LLM_JSON), json: VALID_LLM_JSON });
    await getDashboardInsight('ws-cache-expired', 'ceo');
    assert.equal(contextCalls, 1);
    mock.timers.tick(31 * 60 * 1000);
    const second = await getDashboardInsight('ws-cache-expired', 'ceo');
    assert.equal(contextCalls, 2, 'setelah TTL lewat, harus rebuild fresh');
    assert.equal(second.cached, false);
  });

  test('refresh=true melewati cache walau masih fresh', async () => {
    orchestrateResponder = () => ({ text: JSON.stringify(VALID_LLM_JSON), json: VALID_LLM_JSON });
    await getDashboardInsight('ws-refresh-bypass', 'ceo');
    assert.equal(contextCalls, 1);
    const second = await getDashboardInsight('ws-refresh-bypass', 'ceo', { refresh: true });
    assert.equal(contextCalls, 2, 'refresh=true harus tetap rebuild walau cache belum expired');
    assert.equal(second.cached, false);
  });

  test('refresh=true 2x dalam <2 menit -> rate limit, panggilan kedua balas CACHED (tidak rebuild lagi)', async () => {
    orchestrateResponder = () => ({ text: JSON.stringify(VALID_LLM_JSON), json: VALID_LLM_JSON });
    await getDashboardInsight('ws-rate-limit', 'ceo', { refresh: true }); // build #1 (rate limit key belum ada -> lolos)
    assert.equal(contextCalls, 1);
    mock.timers.tick(30 * 1000); // 30 detik kemudian, MASIH < 2 menit
    const second = await getDashboardInsight('ws-rate-limit', 'ceo', { refresh: true });
    assert.equal(contextCalls, 1, 'refresh kedua dalam window rate-limit harus DIAM-DIAM turun ke cache, bukan rebuild lagi');
    assert.equal(second.cached, true);
  });

  test('refresh=true setelah >2 menit -> rate limit lepas, boleh rebuild lagi', async () => {
    orchestrateResponder = () => ({ text: JSON.stringify(VALID_LLM_JSON), json: VALID_LLM_JSON });
    await getDashboardInsight('ws-rate-limit-lepas', 'ceo', { refresh: true });
    assert.equal(contextCalls, 1);
    mock.timers.tick(2 * 60 * 1000 + 1000); // 2 menit 1 detik kemudian
    const second = await getDashboardInsight('ws-rate-limit-lepas', 'ceo', { refresh: true });
    assert.equal(contextCalls, 2, 'setelah lewat 2 menit, refresh berikutnya harus boleh rebuild lagi');
    assert.equal(second.cached, false);
  });

  test('workspace berbeda -> rate limit/cache TIDAK saling mempengaruhi (isolasi per workspace+role)', async () => {
    orchestrateResponder = () => ({ text: JSON.stringify(VALID_LLM_JSON), json: VALID_LLM_JSON });
    await getDashboardInsight('ws-isolasi-a', 'ceo', { refresh: true });
    await getDashboardInsight('ws-isolasi-b', 'ceo', { refresh: true });
    assert.equal(contextCalls, 2, 'workspace berbeda harus dihitung independen, TIDAK kena rate limit workspace lain');
  });

  test('role berbeda pada workspace SAMA -> cache/rate limit TIDAK saling mempengaruhi (isolasi per role)', async () => {
    orchestrateResponder = () => ({ text: JSON.stringify(VALID_LLM_JSON), json: VALID_LLM_JSON });
    await getDashboardInsight('ws-role-isolasi', 'ceo', { refresh: true });
    await getDashboardInsight('ws-role-isolasi', 'finance', { refresh: true });
    assert.equal(contextCalls, 2, 'role finance TIDAK BOLEH kena rate limit dari refresh role ceo di workspace yang sama');
  });
});
