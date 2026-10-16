import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// FASE 4 wiring regression tests (roadmap anti-halusinasi 2026-09-06) for:
//   - src/app/api/v1/documents/analyze/route.ts  (tryParseStructuredLedger +
//     structuredLedger/discrepancies response fields)
//   - src/app/api/v1/brain/chat/route.ts (attachment.structuredLedger replaces
//     the raw attachment-text block in the prompt with a verified-numbers block)
//
// Same in-memory-Prisma-Proxy + real-signed-JWT + node:test `mock.module`
// pattern as tests/brain-generate-chat-guard.test.ts (see that file for the
// original pattern this is adapted from). Requires
// `node --experimental-test-module-mocks --import tsx --test <file>` (Node
// v25.2.1 does not enable module mocks by default).
//
// Fixture: a small SYNTHETIC ledger workbook built in-memory (same technique
// as tests/ledger-parser.test.ts), NOT the real client fixture -- privacy per
// context pack ATURAN MUTLAK. Real-fixture cross-checks live in
// tests/ledger-real-fixture.test.ts (built earlier this session, separate file).
//
// Guard auth (authenticateTenantRequest / withTenantGuard) is NOT touched or
// weakened by this change -- every test below goes through a real, validly
// signed JWT for an owner of a real seeded workspace, same as the reference
// pattern; one regression test per route confirms zero-token requests are
// still rejected exactly like before this wiring was added.
// ---------------------------------------------------------------------------

// --- synthetic workbook builders --------------------------------------------------

/**
 * Minimal ledger workbook: "kode posting" (chart of accounts, 2 kode/nama pairs) +
 * "buku kas" (5 real TARIKH-bearing rows + 1 footer JUMLAH row without TARIKH, which
 * must be excluded). Enough for tryParseStructuredLedger's recognition rule
 * (chartOfAccounts non-empty AND at least one "kas" sheet with transactions).
 */
function buildSyntheticLedgerWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  const kodePostingRows: unknown[][] = [
    ['Contoh Usaha Sintetis'],
    ['KODE ETIK PEMBUKUAN'],
    [],
    [null, 25, 'Penjualan Barang Umum', null, null, null, null, null, 60, 'Sewa Kantor'],
    [null, 26, 'Penjualan Jasa', null, null, null, null, null, 61, 'Konsumsi'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kodePostingRows), 'kode posting');

  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  const bukuKasRows: unknown[][] = [
    ['BUKU KAS'],
    [],
    [],
    [],
    [],
    [],
    ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
    [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
    [2, d(2024, 1, 1), 'Modal awal', 10, 1000000, null, 1000000],
    [3, d(2024, 1, 2), 'Penjualan Barang Umum', 25, 500000, null, 1500000],
    [4, d(2024, 1, 3), 'Bayar Sewa Kantor', 60, null, 100000, 1400000],
    [5, d(2024, 1, 4), 'Penjualan Jasa', 26, 300000, null, 1700000],
    // baris footer JUMLAH -- TIDAK punya TARIKH, harus dilewati parser.
    [null, null, null, null, 1800000, 100000, null],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bukuKasRows), 'buku kas');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Plain xlsx with neither a "kode posting" sheet nor any "kas" sheet -- must NOT be
 *  recognized as a ledger, so the analyze route's response shape stays untouched. */
function buildNonLedgerXlsxWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();
  const rows: unknown[][] = [
    ['Catatan Rapat Mingguan'],
    ['Agenda', 'Pembahasan strategi marketing kuartal ini'],
    ['Tindak lanjut', 'Follow-up ke tim sales minggu depan'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Notulen');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function multipartFileRequest(url: string, token: string, fileName: string, buffer: Buffer, mimeType: string) {
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName);
  return new NextRequest(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
}

function jsonRequest(url: string, options: { token?: string; body: object } = { body: {} }) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify(options.body),
  });
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// --- shared test fixtures for the chat-route assertions ---------------------------

const structuredLedgerFixture = {
  periode: { mulai: '2024-01-01', akhir: '2024-01-04' },
  sheetPrimer: 'buku kas',
  jumlahTransaksi: 5,
  totalPerKode: [
    { kode: 25, namaAkun: 'Penjualan Barang Umum', debit: 500000, credit: 0 },
    { kode: 60, namaAkun: 'Sewa Kantor', debit: 0, credit: 100000 },
  ],
  totalPendapatan: 800000,
  totalBiaya: 100000,
  labaOperasional: 700000,
  zakat: 17500,
  labaBersih: 682500,
  saldoAkhir: 1700000,
};

const discrepanciesFixture = {
  discrepancies: [
    {
      kind: 'label-vs-computed-mismatch',
      expected: 22,
      actual: 12,
      where: 'neraca baris 30 ("Akumulasi Depresiasi ( 12 bulan )")',
      severity: 'info',
      explanation: 'Label menulis "(12 bulan)" tapi jadwal depresiasi punya 22 kolom bulan terisi.',
    },
  ],
  reconciled: [],
  computed: {
    primarySheet: 'buku kas',
    transactionCount: 5,
    saldoAkhir: 1700000,
    kodeAggregates: {},
    totalPendapatan: 800000,
    totalBiaya: 100000,
    labaOperasional: 700000,
    zakat: 17500,
    labaBersih: 682500,
  },
  staleDataSignals: [],
  warnings: [],
};

const RAW_MARKER_WITH_LEDGER = 'MAGIC_MARKER_RAW_TEXT_MUST_NOT_REACH_LLM_ABC123';
const RAW_MARKER_LEGACY = 'MAGIC_MARKER_LEGACY_RAW_TEXT_XYZ789';

describe('FASE 4 wiring: documents/analyze ledger fields + brain/chat verified-numbers prompt', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let originalFetch: typeof globalThis.fetch;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let analyzePOST: typeof import('../src/app/api/v1/documents/analyze/route')['POST'];
  let chatPOST: typeof import('../src/app/api/v1/brain/chat/route')['POST'];

  type Query = { where?: { id?: string; ownerId?: string }; select?: unknown; include?: unknown };
  type DbCall = { method: string; query: Query };
  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  let reads: DbCall[] = [];
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let handlers: Record<string, (query: Query) => unknown>;

  let analyzeCompanyDocumentCalls: any[] = [];
  let recordCompanyKnowledgeCalls: any[] = [];
  let executeAIRequestCalls: any[] = [];
  let runGenerationCalls: any[] = [];

  const fakePrisma = new Proxy({}, {
    get(_target, model: string) {
      if (model === 'then') return undefined;
      if (model.startsWith('$')) return async () => { throw new Error(`Forbidden Prisma operation: ${model}`); };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: Query) => {
            const method = `${model}.${operation}`;
            const handler = handlers[method];
            if (!handler) throw new Error(`Forbidden Prisma operation: ${method}`);
            reads.push({ method, query });
            return handler(query);
          };
        },
      });
    },
  });

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    originalFetch = globalThis.fetch;
    process.env.JWT_SECRET = 'ledger-wiring-tests-only-signing-secret-7c1e4f-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async (input) => {
      throw new Error(`Network prohibited in ledger-wiring tests: ${input instanceof Request ? input.url : String(input)}`);
    };

    // analyze route: replace the LLM-based company-profile analysis with a stub so
    // this test never needs the real AI gateway -- we only care about the NEW
    // structuredLedger/discrepancies fields, the old `analysis` field's content is
    // irrelevant here.
    mock.module('../src/lib/document-ai', {
      namedExports: {
        analyzeCompanyDocument: async (workspaceId: string, content: string, fileName?: string) => {
          analyzeCompanyDocumentCalls.push({ workspaceId, content, fileName });
          return {
            analysis: { name: 'Stub Co', industry: '', description: '', targetMarket: '', primaryProduct: '', phone: '', address: '', foundedYear: '', employeeCount: '', problems: [], solutions: [], financialSummary: '', keyHighlights: [] },
            provider: 'stub-provider',
            modelUsed: 'stub-model',
            latencyMs: 1,
          };
        },
      },
    });
    // company-memory: capture what BOTH routes try to persist/read, without touching
    // Prisma at all -- lets the ledger-summary-vs-JSON branch in analyze/route.ts be
    // asserted directly, and keeps chat/route.ts's dataBlock free of accumulated
    // "knowledge" noise (irrelevant to what's being tested here).
    mock.module('../src/lib/ai-brain/company-memory', {
      namedExports: {
        recordCompanyKnowledge: async (workspaceId: string, sourceFileName: string, factsSummary: string) => {
          recordCompanyKnowledgeCalls.push({ workspaceId, sourceFileName, factsSummary });
        },
        getAccumulatedCompanyKnowledge: async () => '',
      },
    });
    // chat route: never let a plain question be mistaken for a "buatkan PPT/Word/..."
    // command, and stub the AI gateway so the exact prompt/systemInstruction built by
    // the route can be inspected directly (this IS the thing under test).
    mock.module('../src/lib/generation-engine', {
      namedExports: {
        runGeneration: async (req: any) => { runGenerationCalls.push(req); return { fileName: 'stub.docx', mimeType: 'application/octet-stream', fileBase64: null, summary: 'stub', provider: 'stub', modelUsed: 'stub', latencyMs: 1 }; },
        detectGenerationIntent: () => null,
      },
    });
    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        executeAIRequest: async (opts: any) => {
          executeAIRequestCalls.push(opts);
          return { text: 'Ini balasan stub dari AI gateway yang sengaja dibuat cukup panjang untuk lolos validasi panjang minimum di brain/chat.', provider: 'stub-provider', modelUsed: 'stub-model' };
        },
        analyzeImageWithGemini: async () => ({ text: 'stub-vision', modelUsed: 'stub-vision-model' }),
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: analyzePOST } = await import('../src/app/api/v1/documents/analyze/route'));
    ({ POST: chatPOST } = await import('../src/app/api/v1/brain/chat/route'));
  });

  beforeEach(() => {
    reads = [];
    users = new Map();
    workspaces = new Map();
    handlers = {};
    analyzeCompanyDocumentCalls = [];
    recordCompanyKnowledgeCalls = [];
    executeAIRequestCalls = [];
    runGenerationCalls = [];
  });

  after(() => {
    globalThis.fetch = originalFetch;
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedUser(id: string) {
    const user = { id, email: `${id}@example.invalid`, fullName: `Test ${id}`, isSuperAdmin: false };
    users.set(id, user);
    handlers['user.findUnique'] = (query) => users.get(query.where?.id ?? '') ?? null;
    return user;
  }

  function seedWorkspace(ws: WorkspaceFixture) {
    workspaces.set(ws.id, ws);
    handlers['workspace.findUnique'] = (query) => {
      const found = workspaces.get(query.where?.id ?? '');
      if (!found) return null;
      return { id: found.id, name: found.name, slug: found.slug, ownerId: found.ownerId, members: found.members, resourceGrants: found.resourceGrants };
    };
  }

  // =========================================================================
  // documents/analyze
  // =========================================================================

  test('analyze: workbook sintetis ledger -> response berisi structuredLedger + discrepancies, analysis LLM lama tetap ada', async () => {
    seedUser('user-ledger-1');
    seedWorkspace({ id: 'ws-ledger-1', name: 'Toko Ledger 1', slug: 'toko-ledger-1', ownerId: 'user-ledger-1', members: [], resourceGrants: [] });
    const token = signJwtToken({ userId: 'user-ledger-1', workspaceId: 'ws-ledger-1' });

    const buffer = buildSyntheticLedgerWorkbook();
    const response = await analyzePOST(
      multipartFileRequest('https://klir.test/api/v1/documents/analyze', token, 'PT-Sintetis.xlsx', buffer, XLSX_MIME)
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);

    // Old path untouched: LLM analysis result is still present.
    assert.ok(body.analysis, 'field `analysis` (hasil LLM lama) harus tetap ada');
    assert.equal(analyzeCompanyDocumentCalls.length, 1, 'analyzeCompanyDocument (jalur LLM lama) harus tetap dipanggil persis seperti sebelumnya');

    // New fields.
    assert.ok(body.structuredLedger, 'field `structuredLedger` harus ada untuk workbook ledger yang dikenali');
    assert.equal(body.structuredLedger.jumlahTransaksi, 5, 'Saldo Awal + 4 transaksi = 5 baris valid (baris footer JUMLAH tanpa TARIKH harus dilewati)');
    assert.equal(body.structuredLedger.saldoAkhir, 1700000);
    assert.equal(body.structuredLedger.periode.mulai, '2024-01-01');
    assert.equal(body.structuredLedger.periode.akhir, '2024-01-04');
    const kode25 = body.structuredLedger.totalPerKode.find((k: any) => k.kode === 25);
    assert.ok(kode25, 'rincian per kode harus memuat kode 25');
    assert.equal(kode25.namaAkun, 'Penjualan Barang Umum', 'nama akun harus di-lookup dari sheet kode posting');
    assert.equal(kode25.debit, 500000);

    assert.ok(body.discrepancies, 'field `discrepancies` (DiscrepancyReport) harus ada');
    assert.ok(Array.isArray(body.discrepancies.discrepancies));
    assert.ok(Array.isArray(body.discrepancies.reconciled));

    // Company memory dipanggil dengan RINGKASAN ledger (bukan raw JSON hasil LLM),
    // via recordCompanyKnowledge yang SUDAH ADA -- tidak ada fungsi/tag baru.
    assert.equal(recordCompanyKnowledgeCalls.length, 1);
    assert.match(recordCompanyKnowledgeCalls[0].factsSummary, /Ledger bookkeeping/);
    assert.ok(recordCompanyKnowledgeCalls[0].factsSummary.length <= 1500);
  });

  test('analyze: xlsx BUKAN ledger (tanpa kode posting/kas) -> response TIDAK punya structuredLedger/discrepancies, perilaku lama persis', async () => {
    seedUser('user-ledger-2');
    seedWorkspace({ id: 'ws-ledger-2', name: 'Toko Ledger 2', slug: 'toko-ledger-2', ownerId: 'user-ledger-2', members: [], resourceGrants: [] });
    const token = signJwtToken({ userId: 'user-ledger-2', workspaceId: 'ws-ledger-2' });

    const buffer = buildNonLedgerXlsxWorkbook();
    const response = await analyzePOST(
      multipartFileRequest('https://klir.test/api/v1/documents/analyze', token, 'notulen-rapat.xlsx', buffer, XLSX_MIME)
    );

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(body.analysis);
    assert.equal('structuredLedger' in body, false, 'file non-ledger tidak boleh menambahkan field structuredLedger sama sekali');
    assert.equal('discrepancies' in body, false, 'file non-ledger tidak boleh menambahkan field discrepancies sama sekali');

    // Memory tetap pakai jalur lama (JSON.stringify hasil analisis LLM) untuk file non-ledger.
    assert.equal(recordCompanyKnowledgeCalls.length, 1);
    assert.doesNotMatch(recordCompanyKnowledgeCalls[0].factsSummary, /Ledger bookkeeping/);
  });

  // =========================================================================
  // brain/chat
  // =========================================================================

  test('chat: attachment.structuredLedger -> prompt berisi blok ANGKA TERVERIFIKASI + DISKREPANSI, TIDAK menyuntik teks lampiran mentah', async () => {
    seedUser('user-chat-1');
    seedWorkspace({ id: 'ws-chat-1', name: 'Toko Chat 1', slug: 'toko-chat-1', ownerId: 'user-chat-1', members: [], resourceGrants: [] });
    const token = signJwtToken({ userId: 'user-chat-1', workspaceId: 'ws-chat-1' });

    const response = await chatPOST(jsonRequest('https://klir.test/api/v1/brain/chat', {
      token,
      body: {
        message: 'Tolong jelaskan kondisi laba rugi dari laporan yang saya lampirkan.',
        history: [],
        attachment: {
          name: 'PT-Sintetis.xlsx',
          content: RAW_MARKER_WITH_LEDGER,
          structuredLedger: structuredLedgerFixture,
          discrepancies: discrepanciesFixture,
        },
      },
    }));

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(executeAIRequestCalls.length, 1);

    const { systemInstruction, prompt } = executeAIRequestCalls[0];
    assert.match(systemInstruction, /ANGKA TERVERIFIKASI/);
    assert.match(systemInstruction, /DISKREPANSI YANG DITEMUKAN SISTEM/);
    assert.match(systemInstruction, /JANGAN dihitung ulang/);
    // Sebutkan angka konkret dari fixture supaya pasti diambil dari structuredLedger,
    // bukan cuma judul blok yang kebetulan match.
    assert.match(systemInstruction, /682\.500|682500/);
    // Diskrepansi dari fixture harus disebutkan eksplisit, tidak ditutup-tutupi.
    assert.match(systemInstruction, /Label menulis "\(12 bulan\)"/);

    assert.doesNotMatch(systemInstruction, new RegExp(RAW_MARKER_WITH_LEDGER), 'teks lampiran mentah TIDAK BOLEH ikut masuk ke system instruction kalau structuredLedger ada');
    assert.doesNotMatch(String(prompt), new RegExp(RAW_MARKER_WITH_LEDGER), 'teks lampiran mentah TIDAK BOLEH ikut masuk ke prompt user-turn kalau structuredLedger ada');
  });

  test('chat: attachment TANPA structuredLedger -> perilaku lama (teks lampiran mentah) tetap dikirim ke prompt', async () => {
    seedUser('user-chat-2');
    seedWorkspace({ id: 'ws-chat-2', name: 'Toko Chat 2', slug: 'toko-chat-2', ownerId: 'user-chat-2', members: [], resourceGrants: [] });
    const token = signJwtToken({ userId: 'user-chat-2', workspaceId: 'ws-chat-2' });

    const response = await chatPOST(jsonRequest('https://klir.test/api/v1/brain/chat', {
      token,
      body: {
        message: 'Tolong jelaskan isi dokumen ini.',
        history: [],
        attachment: { name: 'catatan.txt', content: RAW_MARKER_LEGACY },
      },
    }));

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(executeAIRequestCalls.length, 1);

    const { systemInstruction, prompt } = executeAIRequestCalls[0];
    assert.doesNotMatch(systemInstruction, /ANGKA TERVERIFIKASI/, 'tanpa structuredLedger, blok ANGKA TERVERIFIKASI tidak boleh muncul');
    assert.match(systemInstruction, /DOKUMEN YANG DIUNGGAH PENGGUNA/, 'jalur lama (label dokumen mentah) harus tetap ada');
    assert.match(systemInstruction, new RegExp(RAW_MARKER_LEGACY), 'teks lampiran mentah harus tetap masuk ke system instruction seperti sebelum wiring ini');
    assert.match(String(prompt), new RegExp(RAW_MARKER_LEGACY), 'teks lampiran mentah harus tetap masuk ke prompt user-turn seperti sebelum wiring ini');
  });

  test('chat: request tanpa token tetap ditolak (guard tidak dilemahkan oleh wiring ini)', async () => {
    seedUser('victim-owner-ledger');
    seedWorkspace({ id: 'ws-victim-ledger', name: 'Toko Korban Ledger', slug: 'toko-korban-ledger', ownerId: 'victim-owner-ledger', members: [], resourceGrants: [] });

    const response = await chatPOST(jsonRequest('https://klir.test/api/v1/brain/chat', {
      body: { message: 'Halo, ada info penting?', attachment: { structuredLedger: structuredLedgerFixture } },
    }));

    assert.notEqual(response.status, 200);
    const body = await response.json();
    assert.notEqual(body.success, true);
    assert.equal(executeAIRequestCalls.length, 0, 'AI gateway tidak boleh pernah dipanggil untuk request tanpa autentikasi');
    assert.deepEqual(reads, [], 'tidak boleh ada Prisma call sama sekali sebelum guard menolak request tanpa token');
  });
});
