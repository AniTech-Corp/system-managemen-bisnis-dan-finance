import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

// ---------------------------------------------------------------------------
// KELOMPOK B3 KNOWLEDGE (7 Sep 2026) -- tests untuk src/lib/ai-brain/workspace-knowledge.ts
//
// Latar belakang (root cause Q1, laporan scan "upload-knowledge" 7 Sep 2026):
// sebelum modul ini ada, brain/chat/route.ts cuma menyuntik pengetahuan lewat
// getAccumulatedCompanyKnowledge() (company-memory.ts) yang dipotong 3 lapis
// berturut-turut (4000/file -> 1500/item -> 3000 TOTAL gabungan 10 item
// TERBARU) -- untuk workspace 12 file, AI Brain genuinely cuma "melihat" isi
// ~2 file paling akhir diupload. buildWorkspaceKnowledgeBlock() menggantikan
// itu dengan 2 blok: manifest (SEMUA file, gist pendek) + relevant (isi
// lengkap 4 file paling relevan dengan pertanyaan, PLUS pengetahuan dari
// lampiran chat yang bukan WorkspaceFile, anti-dobel terhadap manifest).
//
// Pola mock Prisma di bawah SAMA dengan tests/context-engine-company-knowledge.test.ts
// (Proxy sederhana, globalThis.prisma di-set SEBELUM import dinamis modul yang
// diuji -- src/lib/prisma.ts pakai pola singleton globalForPrisma.prisma yang
// dieksekusi saat modul pertama kali di-load).
// ---------------------------------------------------------------------------

type WorkspaceFileFixture = {
  fileName: string;
  fileType: string;
  status: 'PROCESSING' | 'PROCESSED' | 'FAILED';
  createdAt: Date;
  extractedSummary: string | null;
};
type MemoryItemFixture = { id: string; content: string; createdAt: Date };
type Query = { where?: Record<string, unknown>; orderBy?: unknown; take?: number };

describe('workspace-knowledge: buildWorkspaceKnowledgeBlock', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let buildWorkspaceKnowledgeBlock: typeof import('../src/lib/ai-brain/workspace-knowledge')['buildWorkspaceKnowledgeBlock'];

  let calls: string[];
  let workspaceFileResult: WorkspaceFileFixture[];
  let memoryItemResult: MemoryItemFixture[];
  let shouldThrowOnWorkspaceFile: boolean;

  // Proxy Prisma minimal: workspaceFile.findMany dan memoryItem.findMany eksplisit
  // dimock (satu-satunya operasi yang dipanggil buildWorkspaceKnowledgeBlock lewat
  // getAccumulatedCompanyKnowledge internal) -- operasi lain sengaja throw supaya
  // kalau modul ini suatu saat diam-diam nambah query lain, test ini gagal loud
  // bukan diam-diam lolos.
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
              return async (query: Query = {}) => {
                calls.push(`${model}.${operation}`);
                if (model === 'workspaceFile' && operation === 'findMany') {
                  if (shouldThrowOnWorkspaceFile) throw new Error('Simulasi Prisma gagal (workspaceFile)');
                  return workspaceFileResult;
                }
                if (model === 'memoryItem' && operation === 'findMany') return memoryItemResult;
                throw new Error(`Unmocked Prisma operation in workspace-knowledge test: ${model}.${operation}`);
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
    ({ buildWorkspaceKnowledgeBlock } = await import('../src/lib/ai-brain/workspace-knowledge'));
  });

  beforeEach(() => {
    calls = [];
    workspaceFileResult = [];
    memoryItemResult = [];
    shouldThrowOnWorkspaceFile = false;
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
  });

  function file(overrides: Partial<WorkspaceFileFixture> & { fileName: string }): WorkspaceFileFixture {
    return {
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      status: 'PROCESSED',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      extractedSummary: 'isi ringkasan default',
      ...overrides,
    };
  }

  test('workspace kosong (0 WorkspaceFile, 0 MemoryItem) -> manifest & relevant kosong, non-fatal', async () => {
    const result = await buildWorkspaceKnowledgeBlock('ws-empty', 'ada data apa saja');
    assert.equal(result.manifest, '');
    assert.equal(result.relevant, '');
    assert.equal(result.totalChars, 0);
  });

  test('manifest memuat SEMUA WorkspaceFile (bukan cuma yang match query), 1 baris/file, gist <=120 char', async () => {
    workspaceFileResult = [
      file({
        fileName: 'laporan-penjualan-bulanan.xlsx',
        createdAt: new Date('2026-09-07T10:00:00Z'),
        extractedSummary: 'x'.repeat(500), // isi panjang -- gist di manifest WAJIB dipotong, bukan isi penuh
      }),
      file({ fileName: 'sop-kasir.docx', fileType: 'application/msword', createdAt: new Date('2026-09-06T10:00:00Z'), extractedSummary: 'SOP kasir toko' }),
      file({ fileName: 'menu.txt', fileType: 'text/plain', createdAt: new Date('2026-09-05T10:00:00Z'), extractedSummary: null }),
    ];

    const result = await buildWorkspaceKnowledgeBlock('ws-manifest', 'pertanyaan yang tidak nyambung sama sekali xyz');

    assert.match(result.manifest, /DAFTAR SEMUA FILE DI WORKSPACE INI \(3 file/);
    assert.match(result.manifest, /laporan-penjualan-bulanan\.xlsx/);
    assert.match(result.manifest, /sop-kasir\.docx/);
    assert.match(result.manifest, /menu\.txt/);

    // Gist per baris file pertama WAJIB terpotong <=120 char (bukan 500 char penuh).
    const gistLine = result.manifest.split('\n').find((l) => l.includes('laporan-penjualan-bulanan.xlsx'));
    assert.ok(gistLine, 'baris manifest untuk file pertama harus ketemu');
    const gistPart = gistLine!.split(': ').slice(1).join(': ');
    assert.ok(gistPart.length <= 120, `gist harus <=120 char, dapat ${gistPart.length}`);

    // Urutan manifest WAJIB createdAt desc (terbaru dulu) -- file 7 Sep sebelum 6 Sep sebelum 5 Sep.
    const idxPenjualan = result.manifest.indexOf('laporan-penjualan-bulanan.xlsx');
    const idxSop = result.manifest.indexOf('sop-kasir.docx');
    const idxMenu = result.manifest.indexOf('menu.txt');
    assert.ok(idxPenjualan < idxSop && idxSop < idxMenu, 'manifest harus urut createdAt desc (terbaru dulu)');
  });

  test('top-K relevan: file yang nama/isinya match token pertanyaan naik peringkat, bobot nama file 3x', async () => {
    workspaceFileResult = [
      file({ fileName: 'data-inventori-stok.xlsx', createdAt: new Date('2026-09-01T00:00:00Z'), extractedSummary: 'daftar barang gudang' }),
      file({ fileName: 'laporan-penjualan-bulanan.xlsx', createdAt: new Date('2026-09-02T00:00:00Z'), extractedSummary: 'rekap omzet per cabang bulan ini' }),
      file({ fileName: 'notulen-rapat.docx', fileType: 'application/msword', createdAt: new Date('2026-09-03T00:00:00Z'), extractedSummary: 'hasil diskusi tim' }),
    ];

    const result = await buildWorkspaceKnowledgeBlock('ws-topk', 'berapa penjualan bulan ini?');

    // File yang namanya match token "penjualan"/"bulanan" (bobot 3x) harus MUNCUL
    // di blok relevant, isinya lengkap (bukan cuma gist manifest).
    assert.match(result.relevant, /--- laporan-penjualan-bulanan\.xlsx ---/);
    assert.match(result.relevant, /rekap omzet per cabang bulan ini/);

    // File yang skornya lebih tinggi (match nama file) harus tampil LEBIH DULU
    // dari file yang cuma match sedikit/tidak sama sekali di blok relevant.
    const idxPenjualan = result.relevant.indexOf('laporan-penjualan-bulanan.xlsx');
    const idxInventori = result.relevant.indexOf('data-inventori-stok.xlsx');
    assert.ok(idxPenjualan !== -1, 'file paling relevan harus ikut di blok relevant');
    if (idxInventori !== -1) {
      assert.ok(idxPenjualan < idxInventori, 'file dengan skor lebih tinggi harus muncul lebih dulu');
    }
  });

  test('file dengan status BUKAN PROCESSED tidak ikut blok relevant (cuma muncul di manifest)', async () => {
    workspaceFileResult = [
      file({ fileName: 'sedang-diproses.xlsx', status: 'PROCESSING', extractedSummary: null }),
      file({ fileName: 'gagal-diekstrak.xlsx', status: 'FAILED', extractedSummary: null }),
      file({ fileName: 'sukses.xlsx', status: 'PROCESSED', extractedSummary: 'isi sukses lengkap' }),
    ];

    const result = await buildWorkspaceKnowledgeBlock('ws-status', 'sukses');

    // Manifest tetap jujur menyebut SEMUA file termasuk yang belum/gagal diproses.
    assert.match(result.manifest, /sedang-diproses\.xlsx/);
    assert.match(result.manifest, /gagal-diekstrak\.xlsx/);
    // Blok relevant HANYA berisi file PROCESSED.
    assert.doesNotMatch(result.relevant, /sedang-diproses\.xlsx/);
    assert.doesNotMatch(result.relevant, /gagal-diekstrak\.xlsx/);
    assert.match(result.relevant, /sukses\.xlsx/);
  });

  test('query kosong/tidak match apapun -> tetap fallback ke file TERBARU (bukan blok relevant kosong)', async () => {
    // Fixture SENGAJA sudah urut createdAt desc (persis hasil query Prisma
    // orderBy:{createdAt:'desc'} yang sungguhan -- modul ini TIDAK sort ulang
    // di JS, dia percaya urutan yang dikembalikan Prisma).
    workspaceFileResult = [
      file({ fileName: 'file-terbaru.xlsx', createdAt: new Date('2026-09-07T00:00:00Z'), extractedSummary: 'isi terbaru' }),
      file({ fileName: 'file-lama.xlsx', createdAt: new Date('2026-08-01T00:00:00Z'), extractedSummary: 'isi lama' }),
    ];

    const result = await buildWorkspaceKnowledgeBlock('ws-fallback', '');

    assert.ok(result.relevant.length > 0, 'query kosong tidak boleh membuat blok relevant kosong total kalau ada file PROCESSED');
    assert.match(result.relevant, /file-terbaru\.xlsx/);
  });

  test('anti-duplikasi: MemoryItem[COMPANY_KNOWLEDGE] yang source-nya SUDAH ada di manifest WorkspaceFile TIDAK diikutkan lagi', async () => {
    workspaceFileResult = [
      file({ fileName: 'rekap-kas-agustus.xlsx', extractedSummary: 'total kas Rp 10.000.000' }),
    ];
    memoryItemResult = [
      // Duplikat -- source ini SUDAH ada sebagai WorkspaceFile di atas (direkam
      // dobel oleh workspace-files/route.ts:127 tiap upload). WAJIB DIBUANG.
      {
        id: 'dup-1',
        content: '[COMPANY_KNOWLEDGE] source="rekap-kas-agustus.xlsx" | facts: DUPLIKAT_JANGAN_MUNCUL_LAGI',
        createdAt: new Date(),
      },
      // Bukan duplikat -- ini representasi lampiran chat yang TIDAK PERNAH jadi
      // baris WorkspaceFile (dicatat documents/analyze/route.ts). WAJIB TETAP ADA.
      {
        id: 'chat-only-1',
        content: '[COMPANY_KNOWLEDGE] source="foto-nota-kasir.jpg" | facts: nota belanja bahan baku Rp 500.000',
        createdAt: new Date(),
      },
    ];

    const result = await buildWorkspaceKnowledgeBlock('ws-antidup', 'kas');

    assert.doesNotMatch(result.relevant, /DUPLIKAT_JANGAN_MUNCUL_LAGI/, 'entri MemoryItem yang source-nya sudah ada di WorkspaceFile harus disaring, bukan dikirim dobel');
    assert.match(result.relevant, /foto-nota-kasir\.jpg/, 'entri dari sumber BUKAN-WorkspaceFile (lampiran chat) harus tetap muncul');
    assert.match(result.relevant, /nota belanja bahan baku/);
  });

  test('WorkspaceFile kosong sama sekali -> MemoryItem[COMPANY_KNOWLEDGE] otomatis jadi fallback PENUH (Set pengecualian kosong)', async () => {
    workspaceFileResult = [];
    memoryItemResult = [
      { id: '1', content: '[COMPANY_KNOWLEDGE] source="lampiran-chat-lama.pdf" | facts: profil usaha berdiri 2022', createdAt: new Date() },
    ];

    const result = await buildWorkspaceKnowledgeBlock('ws-fallback-full', 'profil usaha');

    assert.equal(result.manifest, '', 'manifest harus kosong kalau tidak ada WorkspaceFile sama sekali');
    assert.match(result.relevant, /lampiran-chat-lama\.pdf/);
    assert.match(result.relevant, /profil usaha berdiri 2022/);
  });

  test('budget total <=14000 char -- banyak file besar tidak meledakkan totalChars, dipotong bukan crash', async () => {
    const bigSummary = 'y'.repeat(6000);
    workspaceFileResult = Array.from({ length: 8 }, (_, i) =>
      file({
        fileName: `dokumen-besar-${i}.xlsx`,
        createdAt: new Date(2026, 8, 1 + i),
        extractedSummary: bigSummary,
      })
    );

    const result = await buildWorkspaceKnowledgeBlock('ws-budget', 'dokumen besar');

    assert.ok(result.totalChars <= 14000, `totalChars harus <=14000, dapat ${result.totalChars}`);
    assert.equal(result.totalChars, result.manifest.length + result.relevant.length);
  });

  test('query gagal (Prisma error) -> non-fatal, return blok kosong semua (TIDAK throw ke pemanggil)', async () => {
    shouldThrowOnWorkspaceFile = true;
    const result = await buildWorkspaceKnowledgeBlock('ws-error', 'apa saja');
    assert.deepEqual(result, { manifest: '', relevant: '', totalChars: 0 });
  });
});
