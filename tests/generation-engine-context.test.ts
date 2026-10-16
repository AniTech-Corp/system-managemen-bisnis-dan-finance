import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';

// ---------------------------------------------------------------------------
// B4 TESTS (8 Sep 2026) -- KONTRAK T5 "Generate sesuai data" dari sintesis
// komando "dua pintu upload" 8 Sep 2026.
//
// generation-engine.ts (src/lib/generation-engine.ts) sebelum sesi ini TIDAK
// PERNAH diimpor langsung oleh test manapun (F5, laporan scan cache-generate-
// dashboard 8 Sep -- 4 test lain yang menyentuhnya semua mock.module SELURUH
// modul). File ini mengimpor modul ASLI dan memverifikasi buildContextSnippet
// (fungsi privat, diuji TIDAK LANGSUNG lewat 4 pemanggilnya yang exported:
// generateWordDoc/generateExcelDoc/generatePptDoc/generateVideoPlan, semuanya
// lewat satu pintu masuk publik runGeneration()) benar-benar:
//   1. memanggil buildWorkspaceKnowledgeBlock(workspaceId, req.brief) -- BUKAN
//      brief kosong hardcode -- di SEMUA 4 titik panggil generator.
//   2. menyuntikkan hasilnya (manifest+relevant) ke prompt yang dikirim ke
//      generateStructuredJson (ai-gateway.ts, di-mock supaya tidak ada
//      panggilan LLM sungguhan).
//   3. tidak pernah throw untuk workspace kosong (Pusat Data kosong DAN
//      belum ada data finansial) -- tetap menghasilkan dokumen, dengan
//      instruksi eksplisit "JANGAN mengarang".
//
// Mock 3 modul: ai-gateway (generateStructuredJson/generateImage -- NOL
// panggilan LLM/network sungguhan), ai-brain (getOrBuildBusinessContext --
// NOL query Prisma sungguhan), ai-brain/workspace-knowledge
// (buildWorkspaceKnowledgeBlock -- fixture terkontrol, TIDAK query Prisma).
// generation-engine.ts sendiri TIDAK di-mock -- ini SATU-SATUNYA test yang
// mengimpor modul aslinya secara langsung.
//
// Jalankan dengan `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

type StructuredJsonCall = { workspaceId: string; prompt: string; systemInstruction?: string };
type KnowledgeCall = { workspaceId: string; query: string };

describe('generation-engine: buildContextSnippet(workspaceId, brief) menyuntik pengetahuan Pusat Data ke SEMUA 4 generator (T5)', { concurrency: false }, () => {
  let structuredJsonCalls: StructuredJsonCall[];
  let knowledgeCalls: KnowledgeCall[];
  let businessContextHasData: boolean;
  let knowledgeFixtureFor: (query: string) => { manifest: string; relevant: string; totalChars: number };
  let structuredJsonFixtureFor: (prompt: string) => any;

  let runGeneration: typeof import('../src/lib/generation-engine')['runGeneration'];

  before(async () => {
    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        generateStructuredJson: async (workspaceId: string, prompt: string, systemInstruction?: string) => {
          structuredJsonCalls.push({ workspaceId, prompt, systemInstruction });
          return { data: structuredJsonFixtureFor(prompt), provider: 'stub-provider', latencyMs: 1 };
        },
        generateImage: async () => ({ imageBase64: null, mimeType: 'image/png', provider: 'stub', modelUsed: 'stub', latencyMs: 1 }),
      },
    });
    mock.module('../src/lib/ai-brain', {
      namedExports: {
        getOrBuildBusinessContext: async (workspaceId: string) => {
          if (!businessContextHasData) {
            return {
              workspaceId,
              workspaceName: 'Toko Kosong Sintetis',
              generatedAt: new Date().toISOString(),
              cacheTtlSeconds: 60,
              financials: { totalIncome30d: 0, totalExpense30d: 0, liquidCash: 0, unpaidInvoicesCount: 0, totalUnpaidInvoices: 0 },
              healthScore: { totalScore: 0, grade: 'D' },
            } as any;
          }
          return {
            workspaceId,
            workspaceName: 'Toko Sintetis Berisi',
            generatedAt: new Date().toISOString(),
            cacheTtlSeconds: 60,
            financials: { totalIncome30d: 5000000, totalExpense30d: 2000000, liquidCash: 3000000, unpaidInvoicesCount: 1, totalUnpaidInvoices: 500000 },
            healthScore: { totalScore: 80, grade: 'B' },
          } as any;
        },
      },
    });
    mock.module('../src/lib/ai-brain/workspace-knowledge', {
      namedExports: {
        buildWorkspaceKnowledgeBlock: async (workspaceId: string, query: string) => {
          knowledgeCalls.push({ workspaceId, query });
          return knowledgeFixtureFor(query);
        },
      },
    });

    ({ runGeneration } = await import('../src/lib/generation-engine'));
  });

  beforeEach(() => {
    structuredJsonCalls = [];
    knowledgeCalls = [];
    businessContextHasData = true;
    knowledgeFixtureFor = () => ({ manifest: '', relevant: '', totalChars: 0 });
    structuredJsonFixtureFor = () => ({});
  });

  const fixtureByType: Record<string, any> = {
    word: { fileName: 'doc', title: 'Judul', sections: [{ heading: 'Bagian 1', paragraphs: ['isi'], bullets: [] }] },
    excel: { fileName: 'sheet', sheets: [{ name: 'Data', headers: ['A', 'B'], rows: [[1, 2]] }] },
    ppt: { fileName: 'deck', title: 'Judul', subtitle: 'Sub', slides: [{ title: 'Slide 1', bullets: ['poin 1'] }] },
    'video-plan': { fileName: 'video', title: 'Judul Video', durasiTotalDetik: 30, scenes: [{ no: 1, durasiDetik: 5, visual: 'shot 1', narasi: 'narasi 1' }] },
  };

  test('SEMUA 4 titik panggil (Word/Excel/PPT/VideoPlan) memanggil buildWorkspaceKnowledgeBlock dengan req.brief ASLI (bukan string kosong hardcode)', async () => {
    structuredJsonFixtureFor = (prompt) => {
      if (prompt.includes('Excel')) return fixtureByType.excel;
      if (prompt.includes('slide presentasi')) return fixtureByType.ppt;
      if (prompt.includes('storyboard')) return fixtureByType['video-plan'];
      return fixtureByType.word;
    };

    const types: Array<{ type: 'word' | 'excel' | 'ppt' | 'video-plan'; brief: string }> = [
      { type: 'word', brief: 'Brief unik untuk dokumen Word sintesis 8 Sep' },
      { type: 'excel', brief: 'Brief unik untuk Excel sintesis 8 Sep' },
      { type: 'ppt', brief: 'Brief unik untuk PPT sintesis 8 Sep' },
      { type: 'video-plan', brief: 'Brief unik untuk VideoPlan sintesis 8 Sep' },
    ];

    for (const { type, brief } of types) {
      await runGeneration({ workspaceId: 'ws-t5-brief', type, brief });
    }

    assert.equal(knowledgeCalls.length, 4, `buildWorkspaceKnowledgeBlock harus terpanggil 4x (1x per generator), dapat ${knowledgeCalls.length}x`);
    for (let i = 0; i < types.length; i++) {
      assert.equal(
        knowledgeCalls[i].query,
        types[i].brief,
        `panggilan ke-${i + 1} (${types[i].type}) harus membawa req.brief ASLI sbg query, dapat "${knowledgeCalls[i].query}"`
      );
      assert.equal(knowledgeCalls[i].workspaceId, 'ws-t5-brief');
    }
  });

  test('knowledge block (manifest+relevant) non-kosong -> masuk ke prompt generateStructuredJson dgn instruksi "JANGAN MENGARANG" + nama file sumber', async () => {
    knowledgeFixtureFor = () => ({
      manifest: 'DAFTAR SEMUA FILE DI WORKSPACE INI (1 file):\n- katalog-produk.xlsx [xlsx, PROCESSED, 2026-09-08]',
      relevant: '--- katalog-produk.xlsx ---\nProduk A Rp 50.000, Produk B Rp 75.000',
      totalChars: 200,
    });
    structuredJsonFixtureFor = () => fixtureByType.word;

    await runGeneration({ workspaceId: 'ws-t5-nonkosong', type: 'word', brief: 'Buatkan katalog produk jadi dokumen Word' });

    assert.equal(structuredJsonCalls.length, 1);
    const prompt = structuredJsonCalls[0].prompt;
    assert.match(prompt, /DATA PERUSAHAAN \(dari file yang diupload ke Pusat Data\)/);
    assert.match(prompt, /katalog-produk\.xlsx/);
    assert.match(prompt, /Produk A Rp 50\.000/);
    assert.match(prompt, /JANGAN MENGARANG/);
    assert.match(prompt, /sebutkan nama file/i);
  });

  test('workspace KOSONG (Pusat Data kosong DAN belum ada data finansial) -> TIDAK throw, prompt tetap memuat "JANGAN mengarang"/"data belum tersedia"', async () => {
    businessContextHasData = false;
    knowledgeFixtureFor = () => ({ manifest: '', relevant: '', totalChars: 0 });
    structuredJsonFixtureFor = () => fixtureByType.excel;

    await assert.doesNotReject(() => runGeneration({ workspaceId: 'ws-t5-kosong', type: 'excel', brief: 'Buatkan laporan keuangan bulanan' }));

    assert.equal(structuredJsonCalls.length, 1);
    const prompt = structuredJsonCalls[0].prompt;
    assert.match(
      prompt,
      /JANGAN mengarang/i,
      'workspace kosong harus tetap menghasilkan instruksi eksplisit JANGAN MENGARANG (dari fallback finansial ATAU dari blok pengetahuan), bukan diam-diam kosong'
    );
  });

  test('query BERBEDA (brief spesifik vs generic) -> buildWorkspaceKnowledgeBlock dipanggil dengan query yang PERSIS mengikuti brief tiap kali (bukan selalu sama)', async () => {
    const seenQueries: string[] = [];
    knowledgeFixtureFor = (query) => {
      seenQueries.push(query);
      return query.includes('katalog')
        ? { manifest: '- katalog-produk.xlsx', relevant: '--- katalog-produk.xlsx ---\nisi katalog', totalChars: 50 }
        : { manifest: '- profil-perusahaan.pdf', relevant: '--- profil-perusahaan.pdf ---\nisi profil', totalChars: 50 };
    };
    structuredJsonFixtureFor = () => fixtureByType.word;

    await runGeneration({ workspaceId: 'ws-t5-query-beda', type: 'word', brief: 'Bikin pitch deck katalog produk kami' });
    await runGeneration({ workspaceId: 'ws-t5-query-beda', type: 'word', brief: 'Bikin profil perusahaan singkat' });

    assert.equal(seenQueries.length, 2);
    assert.notEqual(seenQueries[0], seenQueries[1], 'query yang dikirim ke buildWorkspaceKnowledgeBlock harus mengikuti brief yang berbeda, bukan nilai statis');
    assert.match(structuredJsonCalls[0].prompt, /katalog-produk\.xlsx/);
    assert.doesNotMatch(structuredJsonCalls[0].prompt, /profil-perusahaan\.pdf/);
    assert.match(structuredJsonCalls[1].prompt, /profil-perusahaan\.pdf/);
    assert.doesNotMatch(structuredJsonCalls[1].prompt, /katalog-produk\.xlsx/);
  });
});
