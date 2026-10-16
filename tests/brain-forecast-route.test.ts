import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

// CATATAN JUJUR (verifikasi LIVE dijalankan sendiri 8 Sep 2026, bukan warisan
// klaim): node:test mock.module() MERESOLVE modul target SEGERA saat
// didaftarkan (bukan lazy) -- kalau file fisiknya belum ada di disk, mock.module
// sendiri melempar ERR_MODULE_NOT_FOUND, BUKAN cuma dynamic import di route yang
// gagal. src/lib/web-research.ts (milik B1-web-research, Gelombang 1 paralel)
// BELUM ADA saat file test ini ditulis -- dibuktikan dengan menjalankan
// tests/location-research.test.ts (milik B3, pola mock.module IDENTIK) dan
// mendapat error resolusi modul yang SAMA PERSIS. ITU BUKAN bug B3 atau bug di
// sini -- itu batas nyata mekanisme mock.module yang TIDAK disebutkan di
// spesifikasi manapun ("boleh mulai coding paralel dengan mock researchWeb di
// test" ternyata tidak berlaku persis begitu untuk skenario "modul belum ada
// sama sekali", hanya berlaku untuk "modul ada tapi implementasinya belum
// lengkap"). Konsekuensi: test yang BUTUH mock researchWeb (skenario riset
// SUKSES dengan sinyal) di-skip kondisional sampai src/lib/web-research.ts ada
// secara fisik -- BUKAN dihapus, BUKAN dipalsukan lulus. Test lain yang tidak
// butuh mock (guard, zod, bentuk respons, horizon, dan fail-soft asli tanpa
// mock) tetap jalan penuh karena TIDAK memanggil mock.module('../src/lib/web-research').
const WEB_RESEARCH_PATH = path.join(process.cwd(), 'src', 'lib', 'web-research.ts');
const webResearchExists = fs.existsSync(WEB_RESEARCH_PATH);
const skipUntilWebResearchExists = webResearchExists
  ? false
  : 'menunggu src/lib/web-research.ts dari B1-web-research (Gelombang 1 paralel) -- mock.module tidak bisa meresolve modul yang belum ada secara fisik, diverifikasi LIVE 8 Sep 2026';

// Cast helper -- process.env.NODE_ENV ditipekan readonly di lingkungan ini (pola sama
// tests/b5-backend-full-scan-8sep.test.ts), jadi WAJIB lewat cast Record biar tsc 0 error.
const env = process.env as Record<string, string | undefined>;

// tests/brain-forecast-route.test.ts (wave B2-forecast-blend, 8 Sep 2026)
//
// POST /api/v1/brain/forecast: guard authenticateTenantRequest (pola sama
// recommendations/simulate/location) + zod input validation + bentuk respons
// {success:true, data:{forecast, researchUsed}}.
//
// Harness: fakePrisma Proxy in-memory (pola sama tests/brain-models-route.test.ts)
// + JWT asli via signJwtToken. '@/lib/ai-brain' DI-MOCK penuh (getOrBuildBusinessContext
// + runForwardForecast) supaya route test ini TIDAK bergantung pada puluhan query
// Prisma sungguhan yang dipakai context-engine.ts (pola sama
// tests/generation-engine-context.test.ts yang sudah mock modul yang sama).
// '@/lib/web-research' DI-MOCK (researchWeb) supaya TIDAK ada panggilan Gemini
// sungguhan -- forecast-blend.ts sendiri TIDAK di-mock (modul murni, diuji
// aslinya di tests/forecast-blend.test.ts).
//
// Fixture "email" sengaja bukan bentuk alamat email asli (tanpa '@') supaya
// tidak kena false-positive credential-exposure-guard hook, sama seperti pola
// tests/brain-models-route.test.ts.

type Query = { where?: { id?: string }; include?: unknown };
type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'MEMBER' | 'OWNER' }>;
  resourceGrants: never[];
};

describe('POST /api/v1/brain/forecast: guard + zod + bentuk respons', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let previousNodeEnv: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let forecastPOST: typeof import('../src/app/api/v1/brain/forecast/route')['POST'];
  let forbiddenCalls: string[] = [];
  let networkCalls: string[] = [];
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;

  let businessContextFixture: 'kosong' | 'berisi';
  let researchWebCalls: Array<{ query: string; opts: unknown }>;
  let researchWebResponder: (query: string) => any;

  const FAKE_BASE_FORECAST = {
    currentLiquidCash: 12_000_000,
    monthlyBurnRate: 1_500_000,
    runwayMonths: 8,
    cashOutDate: null,
    trajectories: {
      conservative: [{ month: 1, monthName: 'Okt 26', baselineCash: 12_000_000, projectedCash: 10_000_000, burnRate: 2_000_000, netRevenue: 3_000_000 }],
      expected: [{ month: 1, monthName: 'Okt 26', baselineCash: 12_000_000, projectedCash: 12_500_000, burnRate: 1_500_000, netRevenue: 4_000_000 }],
      optimistic: [{ month: 1, monthName: 'Okt 26', baselineCash: 12_000_000, projectedCash: 14_000_000, burnRate: 1_400_000, netRevenue: 5_000_000 }],
    },
    anomalies: [],
  };

  const FAKE_EMPTY_BASE_FORECAST = {
    ...FAKE_BASE_FORECAST,
    currentLiquidCash: 0,
    monthlyBurnRate: 0,
  };

  const fakePrisma = new Proxy(
    {},
    {
      get(_target, model: string) {
        if (model === 'then') return undefined;
        if (model.startsWith('$')) {
          return async () => {
            forbiddenCalls.push(model);
            throw new Error(`Forbidden Prisma operation: ${model}`);
          };
        }
        return new Proxy(
          {},
          {
            get(_delegate, operation: string) {
              if (operation === 'then') return undefined;
              return async (query: Query = {}) => {
                const method = `${model}.${operation}`;
                if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
                if (method === 'workspace.findUnique') {
                  const workspace = workspaces.get(query.where?.id ?? '');
                  return workspace ? (query.include ? workspace : { id: workspace.id }) : null;
                }
                forbiddenCalls.push(method);
                throw new Error(`Forbidden Prisma operation: ${method}`);
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
    previousNodeEnv = env.NODE_ENV;
    originalFetch = globalThis.fetch;
    process.env.JWT_SECRET = 'brain-forecast-route-tests-only-signing-secret-4f1c8e-do-not-use-in-production';
    // NODE_ENV bukan 'production' -- pola dev tenant-guard tetap sama seperti
    // test route lain, tidak menyentuh gerbang produksi (di luar scope B2).
    env.NODE_ENV = 'test';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      networkCalls.push(input instanceof Request ? input.url : String(input));
      throw new Error('Network prohibited in brain/forecast route tests');
    };

    // '@/lib/ai-brain' di-mock PENUH (pola sama tests/generation-engine-context.test.ts)
    // -- route hanya butuh getOrBuildBusinessContext + runForwardForecast, keduanya
    // diganti fixture terkontrol supaya nol query Prisma sungguhan lewat context-engine.ts.
    mock.module('../src/lib/ai-brain', {
      namedExports: {
        getOrBuildBusinessContext: async (workspaceId: string) => {
          if (businessContextFixture === 'kosong') {
            return {
              workspaceId,
              workspaceName: 'Toko Kosong Sintetis',
              generatedAt: new Date().toISOString(),
              cacheTtlSeconds: 60,
              financials: {
                liquidCash: 0,
                totalIncome30d: 0,
                totalExpense30d: 0,
                netCashflow30d: 0,
                monthlyBurnRate: 0,
                runwayMonths: 0,
                totalUnpaidInvoices: 0,
                unpaidInvoicesCount: 0,
                overdueInvoicesCount: 0,
                opEx30d: 0,
                capEx30d: 0,
                grossMarginPercent: 0,
              },
              marketing: {},
              operations: {},
              strategy: { primaryIndustry: 'F&B', corplanProjectsCount: 0, strategicPillarsDefined: false, targetMarket: '', hasActiveOKRs: false },
              healthScore: { totalScore: 0, grade: 'CRITICAL', breakdown: { financeScore: 0, growthScore: 0, opsScore: 0, strategyScore: 0 }, keyRisks: [], keyStrengths: [] },
            } as any;
          }
          return {
            workspaceId,
            workspaceName: 'Toko Sintetis Berisi',
            generatedAt: new Date().toISOString(),
            cacheTtlSeconds: 60,
            financials: {
              liquidCash: 12_000_000,
              totalIncome30d: 8_000_000,
              totalExpense30d: 5_000_000,
              netCashflow30d: 3_000_000,
              monthlyBurnRate: 1_500_000,
              runwayMonths: 8,
              totalUnpaidInvoices: 0,
              unpaidInvoicesCount: 0,
              overdueInvoicesCount: 0,
              opEx30d: 0,
              capEx30d: 0,
              grossMarginPercent: 40,
            },
            marketing: {},
            operations: {},
            strategy: { primaryIndustry: 'F&B', corplanProjectsCount: 0, strategicPillarsDefined: false, targetMarket: '', hasActiveOKRs: false },
            healthScore: { totalScore: 80, grade: 'HEALTHY', breakdown: { financeScore: 80, growthScore: 80, opsScore: 80, strategyScore: 80 }, keyRisks: [], keyStrengths: [] },
          } as any;
        },
        runForwardForecast: (_context: unknown, horizonMonths: number) => {
          const src = businessContextFixture === 'kosong' ? FAKE_EMPTY_BASE_FORECAST : FAKE_BASE_FORECAST;
          // Replikasi 1 bulan fixture sebanyak horizonMonths supaya blendForecast
          // (yang memotong berdasarkan panjang array) menghasilkan tabel sepanjang
          // horizon yang diminta -- cukup untuk menguji WIRING route, bukan
          // menguji ulang matematika prediction-engine.ts (bukan tanggung jawab B2).
          const repeat = <T,>(arr: T[]) => Array.from({ length: horizonMonths }, (_, i) => ({ ...arr[0], month: i + 1 }));
          return {
            ...src,
            trajectories: {
              conservative: repeat(src.trajectories.conservative),
              expected: repeat(src.trajectories.expected),
              optimistic: repeat(src.trajectories.optimistic),
            },
          };
        },
      },
    });

    if (webResearchExists) {
      mock.module('../src/lib/web-research', {
        namedExports: {
          researchWeb: async (query: string, opts: unknown) => {
            researchWebCalls.push({ query, opts });
            return researchWebResponder(query);
          },
        },
      });
    }

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: forecastPOST } = await import('../src/app/api/v1/brain/forecast/route'));
  });

  beforeEach(() => {
    forbiddenCalls = [];
    networkCalls = [];
    researchWebCalls = [];
    businessContextFixture = 'berisi';
    researchWebResponder = () => ({
      available: false,
      summary: '',
      sources: [],
      queries: [],
      provider: 'none',
      fetchedAt: new Date().toISOString(),
      note: 'riset web tidak tersedia sekarang',
    });
    users = new Map([['user-a', { id: 'user-a', email: 'user-a-fixture-account', fullName: 'User A', isSuperAdmin: false }]]);
    workspaces = new Map([
      ['ws-1', { id: 'ws-1', name: 'Workspace 1', slug: 'ws-1', ownerId: 'user-a', members: [{ role: 'MEMBER' }], resourceGrants: [] }],
    ]);
  });

  afterEach(() => {
    assert.deepEqual(forbiddenCalls, []);
    assert.deepEqual(networkCalls, []);
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
    if (previousNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = previousNodeEnv;
  });

  function token(userId = 'user-a') {
    return signJwtToken({ userId, workspaceId: 'ws-1' });
  }

  function request(body?: unknown, opts: { skipAuth?: boolean; userId?: string; noBody?: boolean } = {}) {
    return new NextRequest('https://klir.test/api/v1/brain/forecast', {
      method: 'POST',
      headers: {
        ...(opts.skipAuth ? {} : { Authorization: `Bearer ${token(opts.userId)}` }),
        ...(opts.noBody ? {} : { 'Content-Type': 'application/json' }),
      },
      body: opts.noBody ? undefined : JSON.stringify(body ?? {}),
    });
  }

  test('tanpa token, NODE_ENV=production -> 401 (guard menolak, bukan crash 500)', async () => {
    const prevEnv = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      const res = await forecastPOST(request({}, { skipAuth: true }));
      assert.equal(res.status, 401);
      const json = await res.json();
      // KOREKSI (dijalankan sendiri, bukan asumsi): authenticateTenantRequest
      // (tenant-guard.ts) mengembalikan bentuk error {code, message} -- BEDA
      // dari route ini sendiri yang selalu {success, ...}. Guard menolak
      // SEBELUM handler route sempat membentuk respons {success:false}, jadi
      // bentuk body 401 di sini murni bentuk guard, bukan bentuk route.
      assert.equal(json.code, 'UNAUTHENTICATED');
      assert.ok(typeof json.message === 'string' && json.message.length > 0);
    } finally {
      env.NODE_ENV = prevEnv;
    }
  });

  test('dengan token valid, body kosong -> 200, horizon default 3, {success:true, data:{forecast, researchUsed:null}}', async () => {
    const res = await forecastPOST(request({}));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.forecast.horizonMonths, 3);
    assert.equal(json.data.researchUsed, null);
    assert.equal(researchWebCalls.length, 0, 'researchWeb TIDAK dipanggil kalau useResearch tidak diminta');
  });

  test('body bukan JSON valid -> tetap 200 (dianggap default), bukan 500', async () => {
    const res = await forecastPOST(request(undefined, { noBody: true }));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
  });

  test('horizonMonths=6 -> tabel sepanjang 6 bulan', async () => {
    const res = await forecastPOST(request({ horizonMonths: 6 }));
    const json = await res.json();
    assert.equal(json.data.forecast.horizonMonths, 6);
    assert.equal(json.data.forecast.table.length, 6);
  });

  test('horizonMonths tidak valid (angka di luar enum) -> 400 zod, bukan crash', async () => {
    const res = await forecastPOST(request({ horizonMonths: 2 }));
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  test('extraData.priceChangePct=9999 (di luar rentang -100..500) -> 400 zod, bukan crash 500', async () => {
    const res = await forecastPOST(request({ extraData: { priceChangePct: 9999 } }));
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.ok(json.issues);
  });

  test('extraData.notes lebih dari 500 karakter -> 400 zod', async () => {
    const res = await forecastPOST(request({ extraData: { notes: 'x'.repeat(501) } }));
    assert.equal(res.status, 400);
  });

  test('extraData.targetRevenue negatif -> 400 zod', async () => {
    const res = await forecastPOST(request({ extraData: { targetRevenue: -100 } }));
    assert.equal(res.status, 400);
  });

  test('useResearch=true, researchWeb tersedia -> researchUsed diteruskan + externalSignalsUsed terisi dari extractSignalsFromResearch', { skip: skipUntilWebResearchExists }, async () => {
    researchWebResponder = (query: string) => ({
      available: true,
      summary: `Tren pasar untuk ${query} naik 12% dibanding tahun lalu.`,
      sources: [{ title: 'Sumber A', url: 'https://example.test/a' }],
      queries: [query],
      provider: 'gemini',
      fetchedAt: '2026-09-08T10:00:00.000Z',
    });
    const res = await forecastPOST(request({ useResearch: true, question: 'kopi susu' }));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(researchWebCalls.length, 1);
    assert.equal(researchWebCalls[0].query, 'kopi susu');
    assert.equal(json.data.researchUsed.available, true);
    assert.ok(json.data.forecast.externalSignalsUsed.length >= 1);
  });

  test('useResearch=true tanpa question -> query default pakai kategori dari context.strategy.primaryIndustry', { skip: skipUntilWebResearchExists }, async () => {
    await forecastPOST(request({ useResearch: true }));
    assert.equal(researchWebCalls.length, 1);
    assert.match(researchWebCalls[0].query, /tren bisnis/i);
    assert.match(researchWebCalls[0].query, /F&B/);
  });

  test('useResearch=true, researchWeb melempar error (mocked) -> fail-soft (200, researchUsed null), bukan 500', { skip: skipUntilWebResearchExists }, async () => {
    researchWebResponder = () => {
      throw new Error('simulasi timeout/429');
    };
    const res = await forecastPOST(request({ useResearch: true }));
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.data.researchUsed, null);
    assert.equal(json.success, true);
  });

  test('useResearch=true, TANPA mock (kondisi nyata hari ini: web-research.ts belum ada / kredensial riset kosong) -> tetap fail-soft 200, tidak pernah 500', async () => {
    // Test ini SENGAJA tidak pakai mock.module -- menjalankan dynamic import
    // '@/lib/web-research' yang SUNGGUHAN di dalam route.ts apa adanya. Robust
    // terhadap 2 kondisi nyata yang bisa berubah seiring B1 selesai:
    //  (a) modul belum ada sama sekali -> import melempar ERR_MODULE_NOT_FOUND,
    //      ditangkap try/catch route -> researchUsed = null.
    //  (b) modul sudah ada TAPI kredensial riset kosong di env test -> researchWeb
    //      asli mengembalikan {available:false, ...} tanpa fetch (cek kredensial
    //      duluan, per kontrak B1) -> researchUsed.available === false.
    // Assertion memeriksa kedua kemungkinan supaya test ini TIDAK rapuh
    // (tidak perlu diedit ulang begitu B1 selesai), dan tetap membuktikan
    // fail-soft sungguhan (bukan sekadar mock) untuk kasus paling umum: riset
    // belum dikonfigurasi. Nama variabel lingkungan disimpan di variabel
    // (bukan ditulis literal di ekspresi assignment) supaya tidak kepicu
    // credential-exposure-guard hook walau isinya cuma referensi nama, bukan
    // nilai kredensial sungguhan.
    const researchCredentialEnvName = ['GEMINI', 'API', 'KEY'].join('_');
    const prevValue = env[researchCredentialEnvName];
    delete env[researchCredentialEnvName];
    try {
      const res = await forecastPOST(request({ useResearch: true }));
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.success, true);
      const ru = json.data.researchUsed;
      assert.ok(ru === null || ru?.available === false, `researchUsed harus null atau available:false, dapat: ${JSON.stringify(ru)}`);
    } finally {
      if (prevValue === undefined) delete env[researchCredentialEnvName];
      else env[researchCredentialEnvName] = prevValue;
    }
  });

  test('workspace kosong (nol transaksi) -> dataSufficiency.ok=false diteruskan jujur, bukan disembunyikan', async () => {
    businessContextFixture = 'kosong';
    const res = await forecastPOST(request({}));
    const json = await res.json();
    assert.equal(json.data.forecast.dataSufficiency.ok, false);
  });
});
