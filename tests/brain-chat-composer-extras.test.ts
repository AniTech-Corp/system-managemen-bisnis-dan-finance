import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// FAKE PRISMA -- DIPASANG DI TOP-LEVEL (bukan di dalam before() suite HTTP di
// bawah) SENGAJA. `src/lib/prisma.ts` melakukan `export const prisma =
// globalForPrisma.prisma ?? new PrismaClient()` -- binding itu DIEVALUASI SEKALI
// saja, pada IMPOR PERTAMA modul itu di seluruh proses test ini. Suite unit murni
// di bawah (validateRequestedModel/EFFORT_SETTINGS) mengimpor ai-gateway.ts SECARA
// REAL (tidak dimock) LEBIH DULU (urutan deklarasi describe di file ini) -- dan
// ai-gateway.ts mengimpor './prisma' di baris pertamanya. Kalau global override
// baru dipasang di dalam before() suite HTTP (describe ketiga), modul prisma sudah
// KETERLANJUR dievaluasi dengan PrismaClient ASLI oleh suite pertama, dan binding
// itu TIDAK BISA diganti lagi oleh override belakangan (const, bukan getter) --
// itu sebabnya versi awal file ini gagal dengan error Prisma ASLI ("Error creating
// UUID...") walau fakePrisma sudah didefinisikan. Fix: pasang override di sini,
// sebagai efek samping level-modul yang berjalan SEBELUM describe/test manapun
// mulai dieksekusi (registrasi describe() memang jalan duluan, tapi callback
// test()/before() di dalamnya baru jalan belakangan -- override level-modul di
// bawah ini menang lomba itu).
// ---------------------------------------------------------------------------
type ComposerExtrasQuery = { where?: any; data?: any; orderBy?: unknown; take?: number; include?: unknown };
const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
const previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
const previousJwtSecret = process.env.JWT_SECRET;
const originalFetch = globalThis.fetch;

let composerUsers: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }> = new Map();
let composerWorkspaces: Map<
  string,
  { id: string; name: string; slug: string; ownerId: string; members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>; resourceGrants: Array<{ resource: string; action: string }> }
> = new Map();
let composerMemoryItems: any[] = [];
let composerNetworkCalls: string[] = [];

const composerFakePrisma = new Proxy(
  {},
  {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      return new Proxy(
        {},
        {
          get(_delegate, operation: string) {
            if (operation === 'then') return undefined;
            return async (query: ComposerExtrasQuery = {}) => {
              const method = `${model}.${operation}`;
              if (method === 'user.findUnique') return composerUsers.get(query.where?.id ?? '') ?? null;
              if (method === 'workspace.findUnique') {
                const found = composerWorkspaces.get(query.where?.id ?? '');
                return found ? (query.include ? found : { id: found.id }) : null;
              }
              // Bookkeeping internal ai-orchestrator.ts (pickRouteWithHistory baca riwayat,
              // recordRouteStats tulis riwayat) -- non-fatal di sumbernya sendiri, tapi
              // didukung genuinely di sini (pola sama persis dengan
              // tests/brain-chat-attachment-verdict.test.ts).
              if (model === 'memoryItem' && operation === 'findMany') return [];
              if (model === 'memoryItem' && operation === 'create') {
                const row = { id: `mem-${composerMemoryItems.length + 1}`, createdAt: new Date(), ...query.data };
                composerMemoryItems.push(row);
                return row;
              }
              if (operation === 'findMany') return [];
              if (operation === 'findFirst' || operation === 'findUnique') return null;
              if (operation === 'count') return 0;
              throw new Error(`Unmocked Prisma operation in composer-extras test: ${method}`);
            };
          },
        }
      );
    },
  }
);

process.env.JWT_SECRET = 'composer-extras-tests-only-signing-value-do-not-use-in-production';
Object.defineProperty(globalPrisma, 'prisma', { value: composerFakePrisma, writable: true, configurable: true });
globalThis.fetch = (async (input: any) => {
  composerNetworkCalls.push(input instanceof Request ? input.url : String(input));
  throw new Error('Network prohibited in composer-extras test');
}) as typeof fetch;

// ---------------------------------------------------------------------------
// B3-backend-chat TESTS (8 Sep 2026) -- "Setelan Jawaban" composer wiring:
// modelId/effort/preferences/media di body POST /api/v1/brain/chat.
//
// Tiga lapis:
//   1. Unit murni: validateRequestedModel + EFFORT_SETTINGS (ai-gateway.ts) --
//      diimpor LANGSUNG (TIDAK dimock) supaya kode aslinya benar-benar dieksekusi.
//   2. Unit murni: buildReaderProfileLine (ai-brain/reader-profile.ts) -- pure,
//      tanpa import apapun, jadi juga diimpor langsung tanpa mock.
//   3. HTTP end-to-end lewat route.ts + ai-orchestrator.ts (REAL, tidak dimock)
//      dengan HANYA ai-gateway.executeAIRequest yang dimock (pola SAMA PERSIS
//      dengan tests/brain-chat-attachment-verdict.test.ts) -- membuktikan
//      route.ts benar mem-parse body baru dan orchestrate() benar meneruskan
//      forceProvider/effort/requestedModelId/maxOutputTokens/temperature ke
//      executeAIRequest TANPA dibuang diam-diam (temuan KRITIS #1 kritik "bantah"
//      8 Sep -- orchestrate() sebelum perbaikan ini men-destructure field terbatas).
//
// CATATAN JUJUR (lihat laporan B3 lengkap): jalur INTERNAL ai-gateway.ts
// (tryExplicitOpenRouterModel memanggil OpenRouter sungguhan dengan reasoning.effort)
// TIDAK diuji di file ini secara network-level -- itu tugas tes manual/curl di
// kriteria_selesai (butuh OPENROUTER_API_KEY nyata + server dev jalan). Di sini HTTP
// layer memock seluruh ai-gateway (pola sama seperti attachment-verdict), jadi yang
// teruji genuinely adalah WIRING route.ts -> ai-orchestrator.ts -> executeAIRequest,
// bukan logic internal callOpenRouterChat/validateRequestedModel di titik itu (yang
// sudah diuji terpisah di layer unit murni di atas).
//
// Jalankan dengan `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

describe('ai-gateway.ts: validateRequestedModel + EFFORT_SETTINGS (unit murni, TIDAK dimock)', () => {
  // CATATAN: validateRequestedModel sekarang ASYNC, delegasi ke validateTextModel (B1,
  // text-model-catalog.ts) yang fetch katalog OpenRouter live. globalThis.fetch di-stub
  // (lihat top-level override di atas) untuk SELALU gagal di file test ini -- itu artinya
  // discoverTextModels() jatuh ke FALLBACK_MODELS (5 entri statis, SAMA PERSIS 5 ID yang
  // tadinya di-hardcode versi stopgap lama), jadi assertion di bawah tetap deterministik
  // tanpa panggilan network sungguhan.
  test('menolak model yang tidak ada di katalog (fallback statis, network di-stub gagal)', async () => {
    const { validateRequestedModel } = await import('../src/lib/ai-gateway');
    assert.equal(await validateRequestedModel('some-vendor/mahal-banget-model'), false);
  });

  test('menerima model yang ADA di fallback statis (5 model yang diverifikasi live 8 Sep oleh B1)', async () => {
    const { validateRequestedModel } = await import('../src/lib/ai-gateway');
    assert.equal(await validateRequestedModel('google/gemini-3.5-flash'), true);
    assert.equal(await validateRequestedModel('deepseek/deepseek-r1'), true);
    assert.equal(await validateRequestedModel('deepseek/deepseek-chat'), true);
    assert.equal(await validateRequestedModel('z-ai/glm-5.2'), true);
    assert.equal(await validateRequestedModel('openai/gpt-5.3-codex'), true);
  });

  test('menolak bentuk yang tidak wajar (bukan string, kosong, kepanjangan)', async () => {
    const { validateRequestedModel } = await import('../src/lib/ai-gateway');
    assert.equal(await validateRequestedModel(''), false);
    assert.equal(await validateRequestedModel('tanpa-slash'), false);
    assert.equal(await validateRequestedModel('a'.repeat(250) + '/x'), false);
    // @ts-expect-error -- sengaja kirim tipe salah untuk membuktikan guard runtime, bukan cuma TS
    assert.equal(await validateRequestedModel(12345), false);
  });

  test('EFFORT_SETTINGS: 4 level, angka teknis (temperature/maxOutputTokens/openRouterReasoningEffort) persis sesuai kontrak_tipe_ts (anti-drift)', async () => {
    // Sejak rekonsiliasi ke EFFORT_MAP asli (chat-composer-types.ts, B1), objek per level
    // punya field TAMBAHAN (instruction/preferReasoning/etaLabel, untuk kebutuhan UI B2) --
    // assertion di bawah HANYA cek 3 field teknis yang benar-benar dipakai backend (B3),
    // bukan deepEqual seluruh objek, supaya tidak rapuh terhadap perubahan copy UI B1/B2.
    const { EFFORT_SETTINGS } = await import('../src/lib/ai-gateway');
    assert.deepEqual(Object.keys(EFFORT_SETTINGS).sort(), ['maksimal', 'normal', 'santai', 'serius']);
    const pick = (level: keyof typeof EFFORT_SETTINGS) => ({
      temperature: EFFORT_SETTINGS[level].temperature,
      maxOutputTokens: EFFORT_SETTINGS[level].maxOutputTokens,
      openRouterReasoningEffort: EFFORT_SETTINGS[level].openRouterReasoningEffort,
    });
    assert.deepEqual(pick('santai'), { temperature: 0.5, maxOutputTokens: 500, openRouterReasoningEffort: undefined });
    assert.deepEqual(pick('normal'), { temperature: 0.7, maxOutputTokens: 1200, openRouterReasoningEffort: undefined });
    assert.deepEqual(pick('serius'), { temperature: 0.6, maxOutputTokens: 2200, openRouterReasoningEffort: 'medium' });
    assert.deepEqual(pick('maksimal'), { temperature: 0.4, maxOutputTokens: 4000, openRouterReasoningEffort: 'high' });
  });
});

describe('ai-brain/reader-profile.ts: buildReaderProfileLine (pure, TIDAK dimock, TANPA import apapun)', () => {
  test('prefs kosong/tidak ada -> string kosong', async () => {
    const { buildReaderProfileLine } = await import('../src/lib/ai-brain/reader-profile');
    assert.equal(buildReaderProfileLine(undefined), '');
    assert.equal(buildReaderProfileLine(null), '');
    assert.equal(buildReaderProfileLine({}), '');
    assert.equal(buildReaderProfileLine({ simplicity: 'normal', visual: 'auto', signals: [] }), '');
  });

  test('simplicity lebih_sederhana/lebih_detail menghasilkan instruksi yang berbeda (teks dari buildReaderInstruction, B4 SSOT)', async () => {
    const { buildReaderProfileLine } = await import('../src/lib/ai-brain/reader-profile');
    const sederhana = buildReaderProfileLine({ simplicity: 'lebih_sederhana' });
    const detail = buildReaderProfileLine({ simplicity: 'lebih_detail' });
    assert.match(sederhana, /SEDERHANA/);
    assert.match(detail, /DETAIL/);
    assert.notEqual(sederhana, detail);
  });

  test('signals lebih dari 5 item -> dipotong diam-diam ke 5 TERAKHIR (FIFO drop), bukan error', async () => {
    const { buildReaderProfileLine } = await import('../src/lib/ai-brain/reader-profile');
    const signals = ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh'];
    const line = buildReaderProfileLine({ signals });
    assert.doesNotMatch(line, /satu/, 'item paling lama (di luar 5 terakhir) harus dibuang');
    assert.doesNotMatch(line, /\bdua\b/, 'item ke-2 juga harus dibuang (hanya 5 terakhir yang disimpan)');
    assert.match(line, /tiga/);
    assert.match(line, /tujuh/);
  });

  test('signal lebih dari 80 karakter -> dipotong ke 80 karakter, bukan error', async () => {
    const { buildReaderProfileLine } = await import('../src/lib/ai-brain/reader-profile');
    const longSignal = 'x'.repeat(120);
    const line = buildReaderProfileLine({ signals: [longSignal] });
    const match = line.match(/x+/);
    assert.ok(match, 'signal harus tetap muncul (dipotong, bukan dibuang)');
    assert.equal(match![0].length, 80, 'panjang signal di output harus persis 80 karakter');
  });

  test('input non-object (string/number) -> string kosong, tidak throw', async () => {
    const { buildReaderProfileLine } = await import('../src/lib/ai-brain/reader-profile');
    assert.equal(buildReaderProfileLine('bukan objek'), '');
    assert.equal(buildReaderProfileLine(42), '');
  });
});

describe('brain/chat route: Setelan Jawaban composer wiring (route.ts + ai-orchestrator.ts REAL, ai-gateway MOCKED)', { concurrency: false }, () => {
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let chatPOST: typeof import('../src/app/api/v1/brain/chat/route')['POST'];
  let executeAIRequestCalls: any[] = [];

  before(async () => {
    mock.module('../src/lib/generation-engine', {
      namedExports: {
        runGeneration: async () => {
          throw new Error('runGeneration must not be called in composer-extras tests');
        },
        detectGenerationIntent: () => null,
      },
    });
    // mock.module namedExports REPLACES the entire module's export surface (bukan cuma
    // executeAIRequest) -- lihat komentar identik di tests/brain-chat-image-fallback.test.ts.
    // route.ts sekarang JUGA mengimpor validateRequestedModel + EFFORT_SETTINGS dari modul
    // yang sama, jadi keduanya HARUS di-capture dulu dari implementasi ASLI (sebelum baris
    // mock.module ini jalan) lalu di-re-export apa adanya -- tanpa ini, route.ts akan
    // memanggil `undefined(...)` begitu body mengirim modelId/effort (persis bug yang
    // ditemukan versi pertama file ini: 500 "validateRequestedModel is not a function").
    const realAiGateway = await import('../src/lib/ai-gateway');
    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        executeAIRequest: async (opts: any) => {
          executeAIRequestCalls.push(opts);
          return {
            text: 'Ini balasan chat utama stub yang cukup panjang untuk lolos validasi panjang minimum di brain/chat route.',
            provider: 'stub-provider',
            modelUsed: 'stub-model',
          };
        },
        analyzeImageWithGemini: async () => ({ text: 'stub vision', modelUsed: 'stub-vision-model' }),
        validateRequestedModel: realAiGateway.validateRequestedModel,
        EFFORT_SETTINGS: realAiGateway.EFFORT_SETTINGS,
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: chatPOST } = await import('../src/app/api/v1/brain/chat/route'));
  });

  beforeEach(() => {
    executeAIRequestCalls = [];
    composerNetworkCalls = [];
    composerMemoryItems = [];
    composerUsers = new Map([['user-cx', { id: 'user-cx', email: 'user-cx-test-fixture', fullName: 'Test Composer', isSuperAdmin: false }]]);
    composerWorkspaces = new Map([
      ['ws-cx', { id: 'ws-cx', name: 'Toko Composer', slug: 'toko-composer', ownerId: 'user-cx', members: [], resourceGrants: [] }],
    ]);
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function chatRequest(body: object, token?: string) {
    return new NextRequest('https://klir.test/api/v1/brain/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  }

  test('KLIEN LAMA (tanpa modelId/effort/preferences sama sekali) -> PERUBAHAN SENGAJA 11 Sep 2026 (arahan Mecca "default WAJIB model murah" + "AI tahu kapan perlu jawaban kompleks vs singkat"): auto-effort SEKARANG aktif -- pesan santai singkat -> effort "santai" otomatis (temperature 0.5, maxOutputTokens 500), BUKAN LAGI temperature 0.7/maxOutputTokens undefined lama. forceProvider/requestedModelId tetap undefined (tidak ada modelId eksplisit).', async () => {
    const token = signJwtToken({ userId: 'user-cx', workspaceId: 'ws-cx' });
    // 11 Sep 2026 siang (revisi komando, Council SPEED pagar #1): pesan yang menyebut entitas data
    // ("kondisi bisnis bulan ini") sekarang minimal 'normal', jadi kasus 'santai' memakai sapaan murni.
    const response = await chatPOST(chatRequest({ message: 'Halo, apa kabar?', history: [] }, token));

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(executeAIRequestCalls.length, 1);
    const call = executeAIRequestCalls[0];
    assert.equal(call.temperature, 0.5, 'auto-effort "santai" (EFFORT_SETTINGS.santai.temperature) -- BUKAN lagi hardcode 0.7 lama, lihat komentar bertanggal 11 Sep di route.ts blok "effort:"');
    assert.equal(call.maxOutputTokens, 500, 'auto-effort "santai" (EFFORT_SETTINGS.santai.maxOutputTokens) -- BUKAN lagi undefined lama');
    assert.equal(call.forceProvider, undefined);
    assert.equal(call.effort, 'santai', 'classifyEffort() klasifikasi pesan pendek tanpa kata analitis -> santai');
    assert.equal(call.requestedModelId, undefined);
    assert.equal(body.data.modelRequested, null);
    assert.equal(body.data.effortUsed, 'santai');
    assert.equal(body.data.effortAuto, true, 'effortAuto WAJIB true -- body.effort tidak dikirim sama sekali, hasil ini murni klasifikasi otomatis');
    assert.ok(typeof body.data.effortReason === 'string' && body.data.effortReason.length > 0, 'effortReason WAJIB terisi string non-kosong kalau effortAuto true');
    assert.equal(body.data.fallbackNote, null);
  });

  test('pesan ANALITIS (kata "analisis"/"strategi" dst, tanpa body.effort) -> auto-effort "serius", maxOutputTokens 2200, effortAuto true', async () => {
    const token = signJwtToken({ userId: 'user-cx', workspaceId: 'ws-cx' });
    const response = await chatPOST(
      chatRequest({ message: 'Tolong buatkan analisis mendalam soal strategi bisnis kami bulan ini', history: [] }, token)
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    const call = executeAIRequestCalls[0];
    assert.equal(call.effort, 'serius', 'kata "analisis"/"strategi" WAJIB kena classifyEffort() -> serius, bukan santai/normal');
    assert.equal(call.temperature, 0.6);
    assert.equal(call.maxOutputTokens, 2200);
    assert.equal(body.data.effortUsed, 'serius');
    assert.equal(body.data.effortAuto, true);
  });

  test('body.effort EKSPLISIT selalu menang atas auto-effort -- pesan analitis TAPI effort:"santai" dikirim manual -> effortAuto false, effort tetap "santai" (bukan dinaikkan paksa jadi "serius")', async () => {
    const token = signJwtToken({ userId: 'user-cx', workspaceId: 'ws-cx' });
    const response = await chatPOST(
      chatRequest({ message: 'Analisis mendalam strategi pemasaran kami', history: [], effort: 'santai' }, token)
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    const call = executeAIRequestCalls[0];
    assert.equal(call.effort, 'santai', 'pilihan eksplisit pengguna WAJIB dihormati apa adanya, TIDAK PERNAH ditimpa classifyEffort() walau isi pesan analitis');
    assert.equal(call.temperature, 0.5);
    assert.equal(call.maxOutputTokens, 500);
    assert.equal(body.data.effortUsed, 'santai');
    assert.equal(body.data.effortAuto, false, 'effortAuto WAJIB false kalau body.effort dikirim eksplisit oleh klien, terlepas dari apa isi pesannya');
  });

  test('modelId VALID (di stopgap allowlist) + effort maksimal -> forceProvider openrouter, requestedModelId, temperature/maxOutputTokens dari EFFORT_SETTINGS.maksimal', async () => {
    const token = signJwtToken({ userId: 'user-cx', workspaceId: 'ws-cx' });
    const response = await chatPOST(
      chatRequest({ message: 'Buatkan analisis mendalam kondisi bisnis', history: [], modelId: 'google/gemini-3.5-flash', effort: 'maksimal' }, token)
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(executeAIRequestCalls.length, 1);
    const call = executeAIRequestCalls[0];
    assert.equal(call.forceProvider, 'openrouter');
    assert.equal(call.requestedModelId, 'google/gemini-3.5-flash');
    assert.equal(call.effort, 'maksimal');
    assert.equal(call.temperature, 0.4);
    assert.equal(call.maxOutputTokens, 4000);
    assert.equal(body.data.modelRequested, 'google/gemini-3.5-flash');
    assert.equal(body.data.effortUsed, 'maksimal');
    assert.equal(body.data.fallbackNote, null, 'mocked executeAIRequest sukses (tidak mengembalikan fallbackNote) -- tidak boleh ada fallbackNote palsu');
  });

  test('modelId TIDAK DIKENAL (bukan di stopgap allowlist) -> DITOLAK sebelum sampai ai-gateway: forceProvider TIDAK terkirim, fallbackNote terisi, tetap 200 (BUKAN 500)', async () => {
    const token = signJwtToken({ userId: 'user-cx', workspaceId: 'ws-cx' });
    const response = await chatPOST(
      chatRequest({ message: 'Halo', history: [], modelId: 'vendor-mahal/model-tidak-dikenal' }, token)
    );

    assert.equal(response.status, 200, 'modelId tidak dikenal TIDAK BOLEH menyebabkan 500 -- harus jatuh rapi ke cascade default');
    const body = await response.json();
    assert.equal(body.success, true);
    const call = executeAIRequestCalls[0];
    assert.equal(call.forceProvider, undefined, 'modelId invalid TIDAK BOLEH menembus jadi forceProvider ke ai-gateway (syarat GO Council #2)');
    assert.equal(call.requestedModelId, undefined);
    // modelRequested TETAP menunjukkan model yang DIMINTA (walau ditolak) -- untuk
    // transparansi debugging di client, SAMA seperti fallbackNote di bawah. Ini beda
    // dari "auto"/tidak dikirim (yang null, lihat test terpisah) karena di sini user
    // benar-benar meminta model eksplisit, cuma ditolak validasi.
    assert.equal(body.data.modelRequested, 'vendor-mahal/model-tidak-dikenal');
    assert.match(body.data.fallbackNote ?? '', /vendor-mahal\/model-tidak-dikenal/, 'fallbackNote harus menyebut model yang ditolak, untuk transparansi ke client');
  });

  test('effort dikirim tapi STRING TIDAK DIKENAL -> fallback ke "normal" (BUKAN dibuang jadi undefined, BUKAN error)', async () => {
    const token = signJwtToken({ userId: 'user-cx', workspaceId: 'ws-cx' });
    const response = await chatPOST(chatRequest({ message: 'Halo', history: [], effort: 'super-duper-effort-ngasal' }, token));

    assert.equal(response.status, 200);
    const body = await response.json();
    const call = executeAIRequestCalls[0];
    assert.equal(call.effort, 'normal');
    assert.equal(call.temperature, 0.7);
    assert.equal(call.maxOutputTokens, 1200);
    assert.equal(body.data.effortUsed, 'normal');
  });

  test('preferences.signals lebih dari 5 -> hanya 5 TERAKHIR yang masuk systemInstruction (dibuktikan via opts.systemInstruction yang diterima ai-gateway)', async () => {
    const token = signJwtToken({ userId: 'user-cx', workspaceId: 'ws-cx' });
    const signals = ['pertama-dibuang', 'kedua-dibuang', 'ketiga', 'keempat', 'kelima', 'keenam', 'ketujuh'];
    const response = await chatPOST(
      chatRequest({ message: 'Halo', history: [], preferences: { signals } }, token)
    );

    assert.equal(response.status, 200);
    const call = executeAIRequestCalls[0];
    assert.ok(typeof call.systemInstruction === 'string');
    assert.doesNotMatch(call.systemInstruction, /pertama-dibuang/);
    assert.doesNotMatch(call.systemInstruction, /kedua-dibuang/);
    assert.match(call.systemInstruction, /ketujuh/);
  });

  test('modelId="auto" (bukan model eksplisit) -> diperlakukan SAMA seperti tidak dikirim, forceProvider tidak terkirim', async () => {
    const token = signJwtToken({ userId: 'user-cx', workspaceId: 'ws-cx' });
    const response = await chatPOST(chatRequest({ message: 'Halo', history: [], modelId: 'auto' }, token));

    assert.equal(response.status, 200);
    const body = await response.json();
    const call = executeAIRequestCalls[0];
    assert.equal(call.forceProvider, undefined);
    assert.equal(body.data.modelRequested, null);
    assert.equal(body.data.fallbackNote, null, '"auto" bukan penolakan -- tidak boleh muncul sebagai fallbackNote seolah user salah pilih model');
  });
});
