import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';

// ---------------------------------------------------------------------------
// B4 TESTS (8 Sep 2026) -- KONTRAK T4d "profil perusahaan otomatis, sekali per
// batch, JANGAN timpa manual" dari sintesis komando "dua pintu upload" 8 Sep,
// menguji src/lib/ai-brain/auto-company-profile.ts (scheduleAutoCompanyProfileSync).
//
// Mock TOTAL: ai-orchestrator (orchestrate -- NOL panggilan Groq/Gemini
// sungguhan), ai-brain/workspace-knowledge (buildWorkspaceKnowledgeBlock --
// NOL query Prisma sungguhan untuk sumber manifest), ai-brain/context-engine
// (invalidateContextCache -- spy). Prisma di-mock via globalThis.prisma
// (memoryItem.findFirst/create) untuk membaca/menulis MemoryItem[COMPANY_PROFILE]
// SESUNGGUHNYA (fake in-memory, bukan DB nyata).
//
// Debounce (setTimeout 5 detik) dipercepat pakai `mock.timers` (node:test
// built-in, Node 20.4+) -- TIDAK menunggu 5 detik sungguhan di test suite.
//
// Jalankan dengan `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

describe('auto-company-profile: scheduleAutoCompanyProfileSync (T4d) -- merge-safe, debounce, never-throw', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;

  let scheduleAutoCompanyProfileSync: typeof import('../src/lib/ai-brain/auto-company-profile')['scheduleAutoCompanyProfileSync'];

  let memoryItems: Array<{ id: string; workspaceId: string; userId: string | null; scope: string; content: string; createdAt: Date }>;
  let orchestrateCalls: any[];
  let orchestrateResultFixture: { name?: string; industry?: string; targetMarket?: string; description?: string; primaryProduct?: string; businessModel?: string; nib?: string } | null;
  let orchestrateShouldReject: boolean;
  let knowledgeFixture: { manifest: string; relevant: string; totalChars: number };
  let invalidateCalls: Array<string | undefined>;
  let companyBriefRefreshCalls: Array<{ workspaceId: string; reason: string }>;
  let idSeq: number;

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
                  const row = { id: `mem-${idSeq}`, createdAt: new Date(Date.now() + idSeq), ...query.data };
                  memoryItems.push(row);
                  return row;
                }
                throw new Error(`Unmocked Prisma operation in auto-company-profile test: ${method}`);
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

    mock.module('../src/lib/ai-orchestrator', {
      namedExports: {
        orchestrate: async (opts: any) => {
          orchestrateCalls.push(opts);
          if (orchestrateShouldReject) throw new Error('Simulasi semua provider AI down');
          return { text: JSON.stringify(orchestrateResultFixture ?? {}), json: orchestrateResultFixture, provider: 'stub-provider', modelUsed: 'stub-model', latencyMs: 1, task: 'extract_json', routedProvider: 'groq', historyDowngraded: false };
        },
      },
    });
    mock.module('../src/lib/ai-brain/workspace-knowledge', {
      namedExports: {
        buildWorkspaceKnowledgeBlock: async () => knowledgeFixture,
      },
    });
    mock.module('../src/lib/ai-brain/context-engine', {
      namedExports: {
        invalidateContextCache: (workspaceId?: string) => {
          invalidateCalls.push(workspaceId);
        },
      },
    });
    // B3_AI, 11 Sep 2026 (kontrak modul 4): auto-company-profile.ts SEKARANG juga
    // memanggil scheduleCompanyBriefRefresh() di langkah (h) setelah profil sync
    // sukses -- di-mock jadi no-op spy SEMATA untuk mencegah timer 8 detik company-
    // brief.ts bocor jadi setTimeout SUNGGUHAN setelah mock.timers.reset() (afterEach)
    // mengembalikan implementasi setTimeout asli. Tanpa mock ini, timer company-brief
    // yang belum settle (test hanya maju 5 detik dari 8 detik yang dibutuhkan) akan
    // tertinggal sebagai real timer yang bisa memicu orchestrate()/prisma SUNGGUHAN
    // belakangan di proses test yang sama -- pola risiko SAMA PERSIS dengan yang
    // diflag scan 11 Sep untuk tests/workspace-files-t4-hooks.test.ts.
    mock.module('../src/lib/ai-brain/company-brief', {
      namedExports: {
        scheduleCompanyBriefRefresh: (workspaceId: string, reason: string) => {
          companyBriefRefreshCalls.push({ workspaceId, reason });
        },
      },
    });

    ({ scheduleAutoCompanyProfileSync } = await import('../src/lib/ai-brain/auto-company-profile'));
  });

  beforeEach(() => {
    memoryItems = [];
    orchestrateCalls = [];
    orchestrateResultFixture = { name: 'PT Sintetis Ceria', industry: 'Kuliner', targetMarket: 'Keluarga urban', description: 'Usaha katering rumahan', primaryProduct: 'Katering harian', businessModel: 'B2C langganan', nib: '' };
    orchestrateShouldReject = false;
    knowledgeFixture = { manifest: '- katalog.pdf [pdf, PROCESSED, 2026-09-08]: profil usaha', relevant: '--- katalog.pdf ---\nPT Sintetis Ceria bergerak di bidang kuliner', totalChars: 100 };
    invalidateCalls = [];
    companyBriefRefreshCalls = [];
    idSeq = 0;
    mock.timers.enable({ apis: ['setTimeout'] });
  });

  afterEach(() => {
    mock.timers.reset();
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
  });

  async function tickPastDebounce() {
    // Debounce window fungsi ini 5000ms (DEBOUNCE_MS di auto-company-profile.ts)
    // -- majukan clock palsu, LALU beri microtask queue kesempatan menyelesaikan
    // chain async di dalam handler timer (findFirst -> orchestrate -> create ->
    // invalidateContextCache) sebelum assertion dibaca.
    mock.timers.tick(5000);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }

  test('field kosong/"-" pada MemoryItem existing terisi dari hasil ekstraksi (workspace baru, belum ada profil sama sekali)', async () => {
    scheduleAutoCompanyProfileSync('ws-fresh', 'Upload batch Pusat Data');
    await tickPastDebounce();

    assert.equal(orchestrateCalls.length, 1, 'logic inti (LLM extract) harus jalan TEPAT SEKALI setelah debounce settle');
    const created = memoryItems.find((m) => m.workspaceId === 'ws-fresh');
    assert.ok(created, 'MemoryItem[COMPANY_PROFILE] baru harus ditulis untuk workspace yang belum punya profil sama sekali');
    assert.match(created!.content, /Nama: PT Sintetis Ceria/);
    assert.match(created!.content, /Industri: Kuliner/);
    assert.match(created!.content, /Model Bisnis: B2C langganan/);
    assert.match(created!.content, /Sumber: Upload batch Pusat Data/);
  });

  test('field yang SUDAH terisi manual TIDAK ditimpa oleh hasil ekstraksi otomatis (syarat keras T4)', async () => {
    memoryItems.push({
      id: 'mem-manual', workspaceId: 'ws-manual', userId: null, scope: 'WORKSPACE', createdAt: new Date(2026, 8, 1),
      content: '[COMPANY_PROFILE] Nama: PT Sudah Diisi Manual | Industri: - | Target Pasar: - | Deskripsi: - | Produk: - | Model Bisnis: - | NIB: - | Sumber: MANUAL',
    });
    scheduleAutoCompanyProfileSync('ws-manual', 'Upload batch Pusat Data');
    await tickPastDebounce();

    const latest = memoryItems.filter((m) => m.workspaceId === 'ws-manual').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    assert.match(latest.content, /Nama: PT Sudah Diisi Manual/, 'Nama yang sudah diisi manual TIDAK BOLEH tertimpa oleh hasil ekstraksi ("PT Sintetis Ceria")');
    assert.doesNotMatch(latest.content, /PT Sintetis Ceria/);
    // Field LAIN yang masih kosong ('-') tetap boleh diisi dari ekstraksi.
    assert.match(latest.content, /Industri: Kuliner/, 'field lain yang masih kosong/"-" tetap harus diisi dari ekstraksi');
  });

  test('Sumber=MANUAL pada existing DIPERTAHANKAN, TIDAK didowngrade ke sourceLabel batch', async () => {
    memoryItems.push({
      id: 'mem-manual-2', workspaceId: 'ws-sumber-manual', userId: null, scope: 'WORKSPACE', createdAt: new Date(2026, 8, 1),
      content: '[COMPANY_PROFILE] Nama: - | Industri: - | Target Pasar: - | Deskripsi: - | Produk: - | Model Bisnis: - | NIB: - | Sumber: MANUAL',
    });
    scheduleAutoCompanyProfileSync('ws-sumber-manual', 'Upload batch Pusat Data');
    await tickPastDebounce();

    const latest = memoryItems.filter((m) => m.workspaceId === 'ws-sumber-manual').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    assert.match(latest.content, /Sumber: MANUAL/, 'Sumber MANUAL harus dipertahankan, BUKAN didowngrade ke sourceLabel batch');
  });

  test('Model Bisnis dan NIB (field BARU 8 Sep pagi) ikut ter-preserve saat sudah terisi -- TIDAK direset ke "-"', async () => {
    memoryItems.push({
      id: 'mem-newfields', workspaceId: 'ws-newfields', userId: null, scope: 'WORKSPACE', createdAt: new Date(2026, 8, 1),
      content: '[COMPANY_PROFILE] Nama: - | Industri: - | Target Pasar: - | Deskripsi: - | Produk: - | Model Bisnis: B2B Reseller | NIB: 1234567890123 | Sumber: CEO',
    });
    orchestrateResultFixture = { name: 'PT Baru', industry: 'Retail', businessModel: 'Model Baru Hasil Ekstraksi', nib: '9999999999999' };
    scheduleAutoCompanyProfileSync('ws-newfields', 'Upload batch Pusat Data');
    await tickPastDebounce();

    const latest = memoryItems.filter((m) => m.workspaceId === 'ws-newfields').sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    assert.match(latest.content, /Model Bisnis: B2B Reseller/, 'Model Bisnis yang sudah terisi TIDAK BOLEH tertimpa/reset');
    assert.match(latest.content, /NIB: 1234567890123/, 'NIB yang sudah terisi TIDAK BOLEH tertimpa/reset');
    assert.doesNotMatch(latest.content, /Model Baru Hasil Ekstraksi/);
    assert.doesNotMatch(latest.content, /9999999999999/);
  });

  test('manifest kosong (tidak ada WorkspaceFile) -> TIDAK menulis MemoryItem apapun (no-op), TIDAK memanggil orchestrate', async () => {
    knowledgeFixture = { manifest: '', relevant: '', totalChars: 0 };
    scheduleAutoCompanyProfileSync('ws-kosong', 'Upload batch Pusat Data');
    await tickPastDebounce();

    assert.equal(orchestrateCalls.length, 0, 'manifest kosong = tidak ada bahan ekstraksi -- orchestrate TIDAK BOLEH dipanggil (nol biaya LLM sia-sia)');
    assert.equal(memoryItems.filter((m) => m.workspaceId === 'ws-kosong').length, 0);
    assert.equal(invalidateCalls.filter((id) => id === 'ws-kosong').length, 0);
  });

  test('hasil merge = existing PERSIS (tidak ada field berubah) -> TIDAK menulis MemoryItem baru (cegah penumpukan sia-sia)', async () => {
    memoryItems.push({
      id: 'mem-sudah-lengkap', workspaceId: 'ws-unchanged', userId: null, scope: 'WORKSPACE', createdAt: new Date(2026, 8, 1),
      content: '[COMPANY_PROFILE] Nama: PT Sintetis Ceria | Industri: Kuliner | Target Pasar: Keluarga urban | Deskripsi: Usaha katering rumahan | Produk: Katering harian | Model Bisnis: B2C langganan | NIB: - | Sumber: Upload lama',
    });
    // orchestrateResultFixture (default di beforeEach) PERSIS SAMA dengan field
    // existing di atas (kecuali nib yang sama-sama kosong) -- merge = no-op.
    scheduleAutoCompanyProfileSync('ws-unchanged', 'Upload batch Pusat Data');
    await tickPastDebounce();

    const rowsForWs = memoryItems.filter((m) => m.workspaceId === 'ws-unchanged');
    assert.equal(rowsForWs.length, 1, 'TIDAK BOLEH ada MemoryItem baru ditulis kalau merge hasilnya identik dengan existing');
  });

  test('debounce: 2x panggilan berturutan dalam window singkat -> logic inti (panggilan orchestrate) HANYA jalan 1x', async () => {
    scheduleAutoCompanyProfileSync('ws-debounce', 'Upload file A');
    mock.timers.tick(2000); // BELUM lewat 5 detik
    scheduleAutoCompanyProfileSync('ws-debounce', 'Upload file B'); // reset timer
    mock.timers.tick(2000); // total 4 detik sejak panggilan PERTAMA, TAPI baru 2 detik sejak panggilan KEDUA -- belum settle
    await Promise.resolve();
    assert.equal(orchestrateCalls.length, 0, 'sebelum window debounce lewat SEJAK PANGGILAN TERAKHIR, logic inti belum boleh jalan sama sekali');

    mock.timers.tick(3000); // +3 detik lagi = 5 detik sejak panggilan KEDUA -- sekarang settle
    for (let i = 0; i < 10; i++) await Promise.resolve();

    assert.equal(orchestrateCalls.length, 1, `2x panggilan scheduleAutoCompanyProfileSync berturutan HARUS menghasilkan HANYA 1x panggilan orchestrate (debounce, bukan queue), dapat ${orchestrateCalls.length}x`);
    const rowsForWs = memoryItems.filter((m) => m.workspaceId === 'ws-debounce');
    assert.equal(rowsForWs.length, 1);
    assert.match(rowsForWs[0].content, /Sumber: Upload file B/, 'sourceLabel yang dipakai harus dari panggilan TERAKHIR (yang benar-benar menang debounce-nya)');
  });

  test('fungsi TIDAK PERNAH throw ke caller walau orchestrate() reject (kontrak never-throw)', async () => {
    orchestrateShouldReject = true;
    assert.doesNotThrow(() => scheduleAutoCompanyProfileSync('ws-orchestrate-reject', 'Upload batch'));
    await tickPastDebounce();
    // Tidak ada assertion tambahan diperlukan -- kalau handler internal
    // melempar unhandled rejection, node:test akan menandai proses ini GAGAL
    // (uncaughtException/unhandledRejection) walau test ini sendiri "lulus".
    assert.equal(memoryItems.filter((m) => m.workspaceId === 'ws-orchestrate-reject').length, 0, 'kegagalan orchestrate -> no-op aman, TIDAK ada MemoryItem parsial yang tertulis');
  });

  test('fungsi TIDAK PERNAH throw ke caller walau prisma.memoryItem.findFirst reject', async () => {
    const originalPrisma = (globalThis as any).prisma;
    (globalThis as any).prisma = new Proxy(
      {},
      {
        get(_t, model: string) {
          return new Proxy({}, { get(_d, op: string) { return async () => { throw new Error(`Simulasi Prisma down: ${model}.${op}`); }; } });
        },
      }
    );
    try {
      assert.doesNotThrow(() => scheduleAutoCompanyProfileSync('ws-prisma-reject', 'Upload batch'));
      await tickPastDebounce();
    } finally {
      (globalThis as any).prisma = originalPrisma;
    }
  });

  test('sukses menulis profil baru -> invalidateContextCache(workspaceId) dipanggil di akhir', async () => {
    scheduleAutoCompanyProfileSync('ws-invalidate', 'Upload batch');
    await tickPastDebounce();
    assert.ok(invalidateCalls.includes('ws-invalidate'), 'invalidateContextCache harus dipanggil setelah MemoryItem baru berhasil ditulis');
  });

  // B3_AI, 11 Sep 2026 (kontrak modul 4, wiring langkah (h)): scheduleCompanyBriefRefresh
  // harus IKUT terpanggil setelah profil 7-field sukses sync -- brief naratif company-brief.ts
  // tidak boleh ketinggalan zaman dibanding profil yang baru saja ter-auto-isi.
  test('sukses menulis profil baru -> scheduleCompanyBriefRefresh(workspaceId, sourceLabel) IKUT dipanggil (wiring modul 4)', async () => {
    scheduleAutoCompanyProfileSync('ws-brief-wiring', 'Upload batch Pusat Data');
    await tickPastDebounce();
    assert.equal(companyBriefRefreshCalls.length, 1, 'scheduleCompanyBriefRefresh harus terpanggil tepat sekali setelah profil sukses sync');
    assert.equal(companyBriefRefreshCalls[0].workspaceId, 'ws-brief-wiring');
    assert.equal(companyBriefRefreshCalls[0].reason, 'Upload batch Pusat Data');
  });

  test('manifest kosong -> scheduleCompanyBriefRefresh TIDAK dipanggil (fungsi ini ada di jalur SETELAH tulis MemoryItem, no-op sejak awal)', async () => {
    knowledgeFixture = { manifest: '', relevant: '', totalChars: 0 };
    scheduleAutoCompanyProfileSync('ws-brief-noop', 'Upload batch');
    await tickPastDebounce();
    assert.equal(companyBriefRefreshCalls.length, 0);
  });
});
