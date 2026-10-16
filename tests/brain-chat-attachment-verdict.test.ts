import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// B4 TESTS (8 Sep 2026) -- KONTRAK T3 "lampiran chat -> database + verdict
// relevansi" dari sintesis komando "dua pintu upload" 8 Sep 2026.
//
// Menguji buildAttachmentVerdictPromise() + titik penyisipannya di
// src/app/api/v1/brain/chat/route.ts (cabang vision gambar & jalur LLM utama)
// TANPA memanggil Groq/Gemini sungguhan -- HANYA mock.module ai-gateway
// (executeAIRequest/analyzeImageWithGemini), orchestrate() (ai-orchestrator.ts)
// TETAP ASLI/tidak dimock supaya routing task->jsonMode (extract_json vs chat)
// genuinely teruji, bukan diasumsikan. Pola harness: SAMA PERSIS dengan
// tests/brain-chat-capability-catalog.test.ts (in-memory Prisma Proxy + JWT
// asli + mock.module ai-gateway), ditambah memoryItem.findMany/create untuk
// bookkeeping internal orchestrate() (pickRouteWithHistory/recordRouteStats).
//
// Jalankan dengan `node --experimental-test-module-mocks --import tsx --test`.
// ---------------------------------------------------------------------------

type Query = { where?: any; data?: any; orderBy?: unknown; take?: number; include?: unknown };
type WorkspaceFixture = {
  id: string; name: string; slug: string; ownerId: string;
  members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('brain/chat: attachmentVerdict (T3) -- Promise.all paralel, syarat content+workspaceFileId, never-throw', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let chatPOST: typeof import('../src/app/api/v1/brain/chat/route')['POST'];

  let executeAIRequestCalls: any[] = [];
  let networkCalls: string[] = [];
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let memoryItems: any[];

  // Kontrol perilaku executeAIRequest mock per-test.
  let verdictFixture: { relevant: boolean; reason: string } | null;
  let mainChatShouldReject: boolean;
  let visionAnalysisResult: { text: string; modelUsed: string };
  let chatCallDelayMs: number;
  let verdictCallDelayMs: number;

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
                const method = `${model}.${operation}`;
                if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
                if (method === 'workspace.findUnique') {
                  const found = workspaces.get(query.where?.id ?? '');
                  return found ? (query.include ? found : { id: found.id }) : null;
                }
                // Bookkeeping internal ai-orchestrator.ts (pickRouteWithHistory
                // baca riwayat, recordRouteStats tulis riwayat) -- non-fatal di
                // sumbernya sendiri kalau gagal, tapi didukung genuinely di sini
                // supaya tidak menimbulkan warning yang mengaburkan output test.
                if (model === 'memoryItem' && operation === 'findMany') return [];
                if (model === 'memoryItem' && operation === 'create') {
                  const row = { id: `mem-${memoryItems.length + 1}`, createdAt: new Date(), ...query.data };
                  memoryItems.push(row);
                  return row;
                }
                if (operation === 'findMany') return [];
                if (operation === 'findFirst' || operation === 'findUnique') return null;
                if (operation === 'count') return 0;
                throw new Error(`Unmocked Prisma operation in attachment-verdict test: ${method}`);
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
    originalFetch = globalThis.fetch;
    process.env.JWT_SECRET = 'attachment-verdict-tests-only-signing-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async (input) => {
      networkCalls.push(input instanceof Request ? input.url : String(input));
      throw new Error('Network prohibited in attachment-verdict test');
    };

    mock.module('../src/lib/generation-engine', {
      namedExports: {
        runGeneration: async () => {
          throw new Error('runGeneration must not be called in attachment-verdict tests');
        },
        detectGenerationIntent: () => null,
      },
    });
    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        executeAIRequest: async (opts: any) => {
          executeAIRequestCalls.push(opts);
          if (opts.jsonMode) {
            if (verdictCallDelayMs) await delay(verdictCallDelayMs);
            if (verdictFixture === null) {
              // Simulasikan LLM balas non-JSON/tidak sesuai skema -- verdict
              // harus null (bukan throw) di titik parsing buildAttachmentVerdictPromise.
              return { text: 'bukan JSON valid', provider: 'stub-provider', modelUsed: 'stub-model' };
            }
            return { text: JSON.stringify(verdictFixture), json: verdictFixture, provider: 'stub-provider', modelUsed: 'stub-model' };
          }
          if (chatCallDelayMs) await delay(chatCallDelayMs);
          if (mainChatShouldReject) {
            throw new Error('Simulasi semua provider chat down');
          }
          return { text: 'Ini balasan chat utama stub yang cukup panjang untuk lolos validasi panjang minimum di brain/chat route.', provider: 'stub-provider', modelUsed: 'stub-model' };
        },
        analyzeImageWithGemini: async () => visionAnalysisResult,
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: chatPOST } = await import('../src/app/api/v1/brain/chat/route'));
  });

  beforeEach(() => {
    executeAIRequestCalls = [];
    networkCalls = [];
    memoryItems = [];
    verdictFixture = { relevant: true, reason: 'Ini dokumen keuangan bisnis' };
    mainChatShouldReject = false;
    visionAnalysisResult = { text: 'Deskripsi hasil vision stub', modelUsed: 'stub-vision-model' };
    chatCallDelayMs = 0;
    verdictCallDelayMs = 0;
    users = new Map([['user-verdict', { id: 'user-verdict', email: 'verdict@example.invalid', fullName: 'Test Verdict', isSuperAdmin: false }]]);
    workspaces = new Map([
      ['ws-verdict', { id: 'ws-verdict', name: 'Toko Verdict', slug: 'toko-verdict', ownerId: 'user-verdict', members: [], resourceGrants: [] }],
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

  test('attachment TANPA workspaceFileId -> attachmentVerdict ABSEN, orchestrate verdict TIDAK PERNAH dipanggil', async () => {
    const token = signJwtToken({ userId: 'user-verdict', workspaceId: 'ws-verdict' });
    const response = await chatPOST(
      chatRequest({ message: 'Tolong analisis file ini', attachment: { name: 'nota.txt', content: 'isi nota lengkap' } }, token)
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal('attachmentVerdict' in body.data, false, 'attachmentVerdict harus ABSEN (bukan null) kalau workspaceFileId tidak dikirim');
    assert.equal(executeAIRequestCalls.filter((c) => c.jsonMode).length, 0, 'TIDAK BOLEH ada panggilan jsonMode (verdict) kalau workspaceFileId kosong -- biaya LLM harus nol untuk kasus ini');
  });

  test('attachment.content + workspaceFileId LENGKAP -> attachmentVerdict {relevant,reason,fileId} muncul, DUA panggilan LLM (chat+verdict) PARALEL bukan serial', async () => {
    chatCallDelayMs = 150;
    verdictCallDelayMs = 150;
    verdictFixture = { relevant: false, reason: 'Ini resep masakan pribadi, tidak terkait usaha' };
    const token = signJwtToken({ userId: 'user-verdict', workspaceId: 'ws-verdict' });

    const startedAt = Date.now();
    const response = await chatPOST(
      chatRequest(
        { message: 'Ini apa ya', attachment: { name: 'resep.txt', content: 'resep nasi goreng', workspaceFileId: 'wf-resep-1' } },
        token
      )
    );
    const elapsedMs = Date.now() - startedAt;

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.deepEqual(body.data.attachmentVerdict, { relevant: false, reason: 'Ini resep masakan pribadi, tidak terkait usaha', fileId: 'wf-resep-1' });

    const jsonModeCalls = executeAIRequestCalls.filter((c) => c.jsonMode);
    const chatModeCalls = executeAIRequestCalls.filter((c) => !c.jsonMode);
    assert.equal(jsonModeCalls.length, 1, 'orchestrate verdict (task extract_json, jsonMode:true) harus terpanggil TEPAT SEKALI');
    assert.equal(chatModeCalls.length, 1, 'orchestrate chat utama harus terpanggil TEPAT SEKALI');
    assert.ok(
      elapsedMs < chatCallDelayMs + verdictCallDelayMs - 50,
      `Promise.all HARUS paralel (elapsed ~${Math.max(chatCallDelayMs, verdictCallDelayMs)}ms), BUKAN serial (~${chatCallDelayMs + verdictCallDelayMs}ms) -- dapat elapsed ${elapsedMs}ms`
    );
  });

  test('orchestrate verdict balas non-JSON/skema tidak cocok -> attachmentVerdict ABSEN (null), jawaban chat utama TETAP jalan normal', async () => {
    verdictFixture = null as any;
    const token = signJwtToken({ userId: 'user-verdict', workspaceId: 'ws-verdict' });
    const response = await chatPOST(
      chatRequest(
        { message: 'Tolong cek dokumen ini', attachment: { name: 'dokumen.txt', content: 'isi dokumen', workspaceFileId: 'wf-x' } },
        token
      )
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.ok(body.data.text.length > 0, 'jawaban chat utama harus tetap ada walau verdict gagal parse');
    assert.equal('attachmentVerdict' in body.data, false, 'attachmentVerdict harus ABSEN kalau LLM balas non-JSON -- kontrak never-throw, BUKAN error 500');
  });

  test('orchestrate chat utama GAGAL (semua provider down) -> fallback jawaban lokal, attachmentVerdict SENGAJA ABSEN (bukan kelalaian)', async () => {
    mainChatShouldReject = true;
    verdictFixture = { relevant: true, reason: 'Relevan' };
    const token = signJwtToken({ userId: 'user-verdict', workspaceId: 'ws-verdict' });
    const response = await chatPOST(
      chatRequest(
        { message: 'Tolong cek', attachment: { name: 'dokumen.txt', content: 'isi dokumen', workspaceFileId: 'wf-y' } },
        token
      )
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true, 'fallback jawaban lokal tetap success:true (bukan error)');
    assert.equal('attachmentVerdict' in body.data, false, 'jalur fallback tanpa-LLM SENGAJA tidak diberi attachmentVerdict per kontrak T3 (file tetap tersimpan dari sisi B2, cuma kartu verdict tidak tampil)');
  });

  test('cabang vision (imageBase64+mimeType) DENGAN attachment.content (OCR) + workspaceFileId -> attachmentVerdict IKUT muncul di response vision', async () => {
    verdictFixture = { relevant: true, reason: 'Foto nota belanja usaha' };
    const token = signJwtToken({ userId: 'user-verdict', workspaceId: 'ws-verdict' });
    const response = await chatPOST(
      chatRequest(
        {
          message: 'Ini foto apa',
          attachment: {
            name: 'foto-nota.jpg',
            imageBase64: 'ZmFrZS1iYXNlNjQ=',
            mimeType: 'image/jpeg',
            content: 'Hasil OCR: Nota belanja bahan baku Rp 250.000',
            workspaceFileId: 'wf-foto-1',
          },
        },
        token
      )
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.data.provider, 'gemini-vision');
    assert.deepEqual(body.data.attachmentVerdict, { relevant: true, reason: 'Foto nota belanja usaha', fileId: 'wf-foto-1' });
  });

  test('cabang vision TANPA attachment.content (gambar murni, tidak ada teks OCR terpisah) -> attachmentVerdict ABSEN, TIDAK memaksa panggil LLM verdict dgn prompt kosong', async () => {
    const token = signJwtToken({ userId: 'user-verdict', workspaceId: 'ws-verdict' });
    const response = await chatPOST(
      chatRequest(
        { message: 'Ini foto apa', attachment: { name: 'foto-polos.jpg', imageBase64: 'ZmFrZQ==', mimeType: 'image/jpeg', workspaceFileId: 'wf-foto-2' } },
        token
      )
    );
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.data.provider, 'gemini-vision');
    assert.equal('attachmentVerdict' in body.data, false, 'gambar tanpa content (OCR) harus SKIP verdict total, bukan panggil LLM dgn prompt kosong');
    assert.equal(executeAIRequestCalls.filter((c) => c.jsonMode).length, 0);
  });
});
