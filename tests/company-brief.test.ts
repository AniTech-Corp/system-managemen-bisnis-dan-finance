import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';

// ---------------------------------------------------------------------------
// B3_AI TESTS (11 Sep 2026) -- src/lib/ai-brain/company-brief.ts (kontrak
// modul 4). Pola mock IDENTIK tests/auto-company-profile.test.ts: Prisma via
// Proxy globalThis.prisma (memoryItem.findFirst/create fake in-memory),
// ai-orchestrator (orchestrate) di-mock TOTAL (nol panggilan LLM sungguhan),
// ai-brain/workspace-knowledge (buildWorkspaceKnowledgeBlock) di-mock (nol
// query Prisma sungguhan untuk manifest). Debounce (setTimeout 8 detik, BEDA
// dari auto-company-profile.ts yang 5 detik) dipercepat via mock.timers.
//
// Jalankan dengan `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

describe('company-brief: getCompanyBrief / refreshCompanyBrief / scheduleCompanyBriefRefresh / buildBrandBrief', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;

  let getCompanyBrief: typeof import('../src/lib/ai-brain/company-brief')['getCompanyBrief'];
  let refreshCompanyBrief: typeof import('../src/lib/ai-brain/company-brief')['refreshCompanyBrief'];
  let scheduleCompanyBriefRefresh: typeof import('../src/lib/ai-brain/company-brief')['scheduleCompanyBriefRefresh'];
  let buildBrandBrief: typeof import('../src/lib/ai-brain/company-brief')['buildBrandBrief'];
  let JSON_EXTRACTION_MODEL: typeof import('../src/lib/model-tiers')['JSON_EXTRACTION_MODEL'];

  let memoryItems: Array<{ id: string; workspaceId: string; userId: string | null; scope: string; content: string; createdAt: Date }>;
  let orchestrateCalls: any[];
  let orchestrateResultText: string;
  let orchestrateShouldReject: boolean;
  let knowledgeFixture: { manifest: string; relevant: string; totalChars: number };
  let idSeq: number;
  let prismaShouldRejectFindFirst: boolean;

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
                  if (prismaShouldRejectFindFirst) throw new Error('Simulasi Prisma down: memoryItem.findFirst');
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
                throw new Error(`Unmocked Prisma operation in company-brief test: ${method}`);
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
          return {
            text: orchestrateResultText,
            provider: 'stub-provider',
            modelUsed: 'stub-model',
            latencyMs: 1,
            task: 'summarize',
            routedProvider: 'groq',
            historyDowngraded: false,
          };
        },
      },
    });
    mock.module('../src/lib/ai-brain/workspace-knowledge', {
      namedExports: {
        buildWorkspaceKnowledgeBlock: async () => knowledgeFixture,
      },
    });

    ({ getCompanyBrief, refreshCompanyBrief, scheduleCompanyBriefRefresh, buildBrandBrief } = await import('../src/lib/ai-brain/company-brief'));
    ({ JSON_EXTRACTION_MODEL } = await import('../src/lib/model-tiers'));
  });

  beforeEach(() => {
    memoryItems = [];
    orchestrateCalls = [];
    orchestrateResultText =
      'IDENTITAS: PT Sintetis Ceria bergerak di bidang kuliner.\n' +
      'PRODUK/LAYANAN: Katering harian.\n' +
      'PERIODE DATA YANG ADA: penjualan Jul-Sep 2026 (dari laporan-penjualan.xlsx).\n' +
      'ANGKA KUNCI TERTULIS DI DOKUMEN: omset Rp 5.000.000 (sumber: laporan-penjualan.xlsx).\n' +
      'CATATAN KUALITAS DATA: data cukup lengkap untuk Q3.';
    orchestrateShouldReject = false;
    knowledgeFixture = {
      manifest: '- laporan-penjualan.xlsx [xlsx, PROCESSED, 2026-09-10]: penjualan Jul-Sep\n- profil.pdf [pdf, PROCESSED, 2026-09-01]: profil usaha',
      relevant: '--- laporan-penjualan.xlsx ---\nomset Rp 5.000.000',
      totalChars: 200,
    };
    idSeq = 0;
    prismaShouldRejectFindFirst = false;
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
    // DEBOUNCE_MS company-brief.ts = 8000ms (BEDA dari auto-company-profile.ts
    // yang 5000ms) -- lihat JSDoc file sumber kenapa 8 detik.
    mock.timers.tick(8000);
    for (let i = 0; i < 10; i++) await Promise.resolve();
  }

  describe('getCompanyBrief', () => {
    test('belum ada MemoryItem[COMPANY_BRIEF] sama sekali -> null', async () => {
      const result = await getCompanyBrief('ws-kosong');
      assert.equal(result, null);
    });

    test('ada brief -> text/generatedAt/sources ter-parse benar dari header', async () => {
      memoryItems.push({
        id: 'mem-1',
        workspaceId: 'ws-ada',
        userId: null,
        scope: 'WORKSPACE',
        createdAt: new Date(2026, 8, 10),
        content: '[COMPANY_BRIEF] v1 | generatedAt=2026-09-10T12:00:00.000Z | sources=3 file\nIDENTITAS: PT Contoh.',
      });
      const result = await getCompanyBrief('ws-ada');
      assert.ok(result);
      assert.equal(result!.generatedAt, '2026-09-10T12:00:00.000Z');
      assert.equal(result!.sources, 3);
      assert.match(result!.text, /IDENTITAS: PT Contoh\./);
    });

    test('ada beberapa record -> ambil yang createdAt PALING BARU', async () => {
      memoryItems.push(
        { id: 'mem-old', workspaceId: 'ws-multi', userId: null, scope: 'WORKSPACE', createdAt: new Date(2026, 8, 1), content: '[COMPANY_BRIEF] v1 | generatedAt=2026-09-01T00:00:00.000Z | sources=1 file\nLAMA' },
        { id: 'mem-new', workspaceId: 'ws-multi', userId: null, scope: 'WORKSPACE', createdAt: new Date(2026, 8, 5), content: '[COMPANY_BRIEF] v1 | generatedAt=2026-09-05T00:00:00.000Z | sources=2 file\nBARU' }
      );
      const result = await getCompanyBrief('ws-multi');
      assert.match(result!.text, /BARU/);
      assert.doesNotMatch(result!.text, /LAMA/);
    });

    test('teks lebih dari 1800 karakter -> dipotong tepat 1800', async () => {
      const longBody = 'X'.repeat(2500);
      memoryItems.push({
        id: 'mem-panjang',
        workspaceId: 'ws-panjang',
        userId: null,
        scope: 'WORKSPACE',
        createdAt: new Date(),
        content: `[COMPANY_BRIEF] v1 | generatedAt=2026-09-11T00:00:00.000Z | sources=1 file\n${longBody}`,
      });
      const result = await getCompanyBrief('ws-panjang');
      assert.equal(result!.text.length, 1800);
    });

    test('Prisma reject -> null, TIDAK throw (never-throw)', async () => {
      prismaShouldRejectFindFirst = true;
      const result = await getCompanyBrief('ws-prisma-down');
      assert.equal(result, null);
    });
  });

  describe('refreshCompanyBrief', () => {
    test('manifest DAN relevant kosong -> no-op: orchestrate TIDAK dipanggil, TIDAK ada MemoryItem baru', async () => {
      knowledgeFixture = { manifest: '', relevant: '', totalChars: 0 };
      await refreshCompanyBrief('ws-manifest-kosong', 'Upload batch');
      assert.equal(orchestrateCalls.length, 0);
      assert.equal(memoryItems.filter((m) => m.workspaceId === 'ws-manifest-kosong').length, 0);
    });

    test('sukses -> orchestrate dipanggil task=summarize + modelName=JSON_EXTRACTION_MODEL, MemoryItem[COMPANY_BRIEF] baru ditulis dengan header benar', async () => {
      await refreshCompanyBrief('ws-sukses', 'Upload batch Pusat Data');
      assert.equal(orchestrateCalls.length, 1);
      assert.equal(orchestrateCalls[0].task, 'summarize');
      assert.equal(orchestrateCalls[0].modelName, JSON_EXTRACTION_MODEL);
      assert.equal(orchestrateCalls[0].workspaceId, 'ws-sukses');

      const created = memoryItems.find((m) => m.workspaceId === 'ws-sukses');
      assert.ok(created);
      assert.match(created!.content, /^\[COMPANY_BRIEF\] v1 \| generatedAt=.+ \| sources=2 file\n/, 'sourcesCount harus dihitung dari 2 baris manifest (laporan-penjualan.xlsx + profil.pdf)');
      assert.match(created!.content, /IDENTITAS: PT Sintetis Ceria/);
    });

    test('hasil header+body TIDAK PERNAH melewati 1800 karakter walau LLM balas teks sangat panjang', async () => {
      orchestrateResultText = 'A'.repeat(5000);
      await refreshCompanyBrief('ws-panjang-llm', 'Upload batch');
      const created = memoryItems.find((m) => m.workspaceId === 'ws-panjang-llm');
      assert.ok(created);
      assert.ok(created!.content.length <= 1800, `panjang content harus <=1800, dapat ${created!.content.length}`);
    });

    test('orchestrate() reject (semua provider down) -> TIDAK throw, TIDAK ada MemoryItem baru (never-throw)', async () => {
      orchestrateShouldReject = true;
      await assert.doesNotReject(() => refreshCompanyBrief('ws-orchestrate-reject', 'Upload batch'));
      assert.equal(memoryItems.filter((m) => m.workspaceId === 'ws-orchestrate-reject').length, 0);
    });

    test('hasil LLM teks kosong/whitespace -> no-op, TIDAK ada MemoryItem baru', async () => {
      orchestrateResultText = '   ';
      await refreshCompanyBrief('ws-hasil-kosong', 'Upload batch');
      assert.equal(memoryItems.filter((m) => m.workspaceId === 'ws-hasil-kosong').length, 0);
    });

    test('prisma.memoryItem.findFirst reject -> TIDAK throw (never-throw)', async () => {
      prismaShouldRejectFindFirst = true;
      await assert.doesNotReject(() => refreshCompanyBrief('ws-prisma-reject', 'Upload batch'));
    });
  });

  describe('scheduleCompanyBriefRefresh (debounce 8 detik)', () => {
    test('1x panggilan -> orchestrate jalan TEPAT SEKALI setelah 8 detik', async () => {
      scheduleCompanyBriefRefresh('ws-debounce-single', 'Upload file A');
      await tickPastDebounce();
      assert.equal(orchestrateCalls.length, 1);
    });

    test('2x panggilan berturutan dalam window singkat -> logic inti HANYA jalan 1x, pakai reason TERAKHIR', async () => {
      scheduleCompanyBriefRefresh('ws-debounce-multi', 'Upload file A');
      mock.timers.tick(3000); // belum 8 detik
      scheduleCompanyBriefRefresh('ws-debounce-multi', 'Upload file B'); // reset timer
      mock.timers.tick(3000); // total 6 detik sejak panggilan pertama, TAPI baru 3 detik sejak kedua
      await Promise.resolve();
      assert.equal(orchestrateCalls.length, 0, 'belum lewat 8 detik sejak panggilan TERAKHIR');

      mock.timers.tick(5000); // +5 detik = 8 detik sejak panggilan kedua -- settle
      for (let i = 0; i < 10; i++) await Promise.resolve();
      assert.equal(orchestrateCalls.length, 1, `2x panggilan HARUS menghasilkan HANYA 1x panggilan orchestrate (debounce), dapat ${orchestrateCalls.length}x`);
    });

    test('fungsi TIDAK PERNAH throw ke caller walau orchestrate() reject (kontrak never-throw)', async () => {
      orchestrateShouldReject = true;
      assert.doesNotThrow(() => scheduleCompanyBriefRefresh('ws-schedule-reject', 'Upload batch'));
      await tickPastDebounce();
    });
  });

  describe('buildBrandBrief (deterministik, NOL LLM)', () => {
    test('belum ada MemoryItem[COMPANY_PROFILE] -> string kosong', async () => {
      const result = await buildBrandBrief('ws-tanpa-profil');
      assert.equal(result, '');
      assert.equal(orchestrateCalls.length, 0, 'buildBrandBrief TIDAK BOLEH memanggil LLM sama sekali (kontrak: deterministik)');
    });

    test('profil lengkap -> gabungan Nama/Industri/Produk/Deskripsi, NOL panggilan LLM', async () => {
      memoryItems.push({
        id: 'mem-profil',
        workspaceId: 'ws-profil-lengkap',
        userId: null,
        scope: 'WORKSPACE',
        createdAt: new Date(),
        content: '[COMPANY_PROFILE] Nama: PT Kopi Sintetis | Industri: F&B | Target Pasar: Milenial | Deskripsi: Kedai kopi modern | Produk: Kopi susu | Model Bisnis: B2C | NIB: - | Sumber: MANUAL',
      });
      const result = await buildBrandBrief('ws-profil-lengkap');
      assert.match(result, /Perusahaan: PT Kopi Sintetis/);
      assert.match(result, /Industri: F&B/);
      assert.match(result, /Produk: Kopi susu/);
      assert.match(result, /Deskripsi: Kedai kopi modern/);
      assert.equal(orchestrateCalls.length, 0);
    });

    test('semua field kosong/"-" -> string kosong (bukan "Perusahaan: . Industri: ." dst)', async () => {
      memoryItems.push({
        id: 'mem-profil-kosong',
        workspaceId: 'ws-profil-kosong',
        userId: null,
        scope: 'WORKSPACE',
        createdAt: new Date(),
        content: '[COMPANY_PROFILE] Nama: - | Industri: - | Target Pasar: - | Deskripsi: - | Produk: - | Model Bisnis: - | NIB: - | Sumber: -',
      });
      const result = await buildBrandBrief('ws-profil-kosong');
      assert.equal(result, '');
    });

    test('hasil TIDAK PERNAH melewati 500 karakter', async () => {
      memoryItems.push({
        id: 'mem-profil-panjang',
        workspaceId: 'ws-profil-panjang',
        userId: null,
        scope: 'WORKSPACE',
        createdAt: new Date(),
        content: `[COMPANY_PROFILE] Nama: ${'A'.repeat(300)} | Industri: - | Target Pasar: - | Deskripsi: ${'B'.repeat(400)} | Produk: - | Model Bisnis: - | NIB: - | Sumber: -`,
      });
      const result = await buildBrandBrief('ws-profil-panjang');
      assert.ok(result.length <= 500, `panjang harus <=500, dapat ${result.length}`);
    });

    test('Prisma reject -> string kosong, TIDAK throw (fail-soft)', async () => {
      prismaShouldRejectFindFirst = true;
      const result = await buildBrandBrief('ws-prisma-down-brand');
      assert.equal(result, '');
    });
  });
});
