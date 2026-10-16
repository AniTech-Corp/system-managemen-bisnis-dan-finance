import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KELOMPOK 3 (6-7 Sep 2026) -- "TAMBAHAN" dari audit: 19 template dokumen di
// src/lib/doc-templates/ dan 8 gaya visual per-industri di
// src/lib/industry-image-templates.ts SEBELUM perubahan ini hanya dibaca
// generation-engine.ts SAAT generate benar-benar berjalan -- tidak pernah jadi
// pengetahuan yang dibaca LLM saat ngobrol biasa (lihat src/lib/ai-brain/
// capability-catalog.ts untuk detail lengkap + alasan kenapa ini dinilai layak).
//
// Test ini membuktikan blok ringkasan kemampuan itu BENAR-BENAR sampai ke
// systemInstruction yang dikirim ke AI gateway (bukan cuma ada sebagai fungsi
// yang tidak pernah dipanggil) -- dan HARUS GAGAL kalau baris
// `${capabilityCatalogBlock}` di src/app/api/v1/brain/chat/route.ts dilepas lagi.
//
// Label yang diverifikasi diambil LANGSUNG dari listDocTemplates()/
// INDUSTRY_IMAGE_TEMPLATES (bukan string hardcode) supaya test ini tidak rapuh
// kalau Fatur/tim AI menambah-ubah template di masa depan -- yang diverifikasi
// adalah SAMBUNGANNYA, bukan isi persis template hari ini.
//
// Harness: pola sama dengan tests/brain-generate-chat-guard.test.ts (in-memory
// Prisma Proxy + JWT asli + mock.module untuk generation-engine/ai-gateway),
// dipangkas ke satu jalur chat non-generation paling sederhana.
// ---------------------------------------------------------------------------

type Query = { where?: { id?: string }; include?: unknown };
type WorkspaceFixture = {
  id: string; name: string; slug: string; ownerId: string;
  members: Array<{ role: 'OWNER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('brain/chat: capability catalog (19 doc template + 8 gaya industri) sampai ke systemInstruction LLM', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let originalFetch: typeof globalThis.fetch;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let chatPOST: typeof import('../src/app/api/v1/brain/chat/route')['POST'];
  let listDocTemplates: typeof import('../src/lib/doc-templates')['listDocTemplates'];
  let INDUSTRY_IMAGE_TEMPLATES: typeof import('../src/lib/industry-image-templates')['INDUSTRY_IMAGE_TEMPLATES'];

  let executeAIRequestCalls: any[] = [];
  let networkCalls: string[] = [];
  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;

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
                // Query pendukung lain (memoryItem/cashTransaction/invoice/promoCoupon/
                // workTask) sengaja TIDAK dimock di sini -- resolveBusinessData() di
                // brain/chat/route.ts sudah membungkus context-engine dan company-memory
                // dengan try/catch non-fatal masing-masing, jadi ctx jatuh ke fallback
                // "tidak ada data" dengan aman. Test ini cuma peduli pada
                // capabilityCatalogBlock, yang TIDAK bergantung pada ctx sama sekali.
                if (operation === 'findMany') return [];
                if (operation === 'findFirst' || operation === 'findUnique') return null;
                if (operation === 'count') return 0;
                throw new Error(`Unmocked Prisma operation in capability-catalog test: ${method}`);
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
    process.env.JWT_SECRET = 'capability-catalog-tests-only-signing-secret-9z8y7x-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    globalThis.fetch = async input => {
      networkCalls.push(input instanceof Request ? input.url : String(input));
      throw new Error('Network prohibited in capability-catalog test');
    };

    mock.module('../src/lib/generation-engine', {
      namedExports: {
        runGeneration: async () => {
          throw new Error('runGeneration must not be called for a plain question in this test');
        },
        detectGenerationIntent: () => null,
      },
    });
    mock.module('../src/lib/ai-gateway', {
      namedExports: {
        executeAIRequest: async (opts: any) => {
          executeAIRequestCalls.push(opts);
          return { text: 'Ini balasan stub yang sengaja dibuat cukup panjang untuk lolos validasi panjang minimum di brain/chat.', provider: 'stub-provider', modelUsed: 'stub-model' };
        },
        analyzeImageWithGemini: async () => ({ text: 'stub-vision', modelUsed: 'stub-vision-model' }),
      },
    });

    ({ signJwtToken } = await import('../src/lib/auth'));
    ({ POST: chatPOST } = await import('../src/app/api/v1/brain/chat/route'));
    ({ listDocTemplates } = await import('../src/lib/doc-templates'));
    ({ INDUSTRY_IMAGE_TEMPLATES } = await import('../src/lib/industry-image-templates'));
  });

  beforeEach(() => {
    executeAIRequestCalls = [];
    networkCalls = [];
    users = new Map([['user-cap', { id: 'user-cap', email: 'cap@example.invalid', fullName: 'Test Cap', isSuperAdmin: false }]]);
    workspaces = new Map([
      ['ws-cap-default', { id: 'ws-cap-default', name: 'Toko Kapabilitas', slug: 'toko-kapabilitas', ownerId: 'user-cap', members: [], resourceGrants: [] }],
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

  test('pertanyaan biasa (bukan permintaan generate/gambar): systemInstruction membawa daftar template dokumen + gaya industri yang REAL, bukan generik', async () => {
    const token = signJwtToken({ userId: 'user-cap', workspaceId: 'ws-cap-default' });
    const response = await chatPOST(chatRequest({ message: 'Sebenarnya sistem ini bisa bikinin dokumen apa aja sih?', history: [] }, token));

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(executeAIRequestCalls.length, 1, 'AI gateway harus terpanggil tepat sekali untuk pertanyaan biasa');

    const systemInstruction: string = executeAIRequestCalls[0].systemInstruction;
    assert.equal(typeof systemInstruction, 'string');

    const allDocTemplates = listDocTemplates();
    assert.ok(allDocTemplates.length > 0, 'sanity check: registry template dokumen tidak boleh kosong (kalau ini gagal, masalahnya di doc-templates/, bukan di sambungan capability-catalog)');
    const sampleTemplate = allDocTemplates[0];
    assert.ok(
      systemInstruction.includes(sampleTemplate.label),
      `systemInstruction harus memuat label template dokumen REAL dari registry (mis. "${sampleTemplate.label}") -- INI YANG GAGAL kalau capabilityCatalogBlock dilepas dari dynamicSystemInstruction`
    );

    const industries = Object.values(INDUSTRY_IMAGE_TEMPLATES);
    assert.ok(industries.length > 0, 'sanity check: registry gaya visual per-industri tidak boleh kosong');
    const sampleIndustry = industries[0];
    assert.ok(
      systemInstruction.includes(sampleIndustry.label),
      `systemInstruction harus memuat label gaya visual per-industri REAL dari registry (mis. "${sampleIndustry.label}")`
    );

    assert.match(
      systemInstruction,
      /KEMAMPUAN PEMBUATAN DOKUMEN & GAMBAR YANG TERSEDIA DI SISTEM/,
      'harus ada heading yang jelas menandai blok ini sebagai kemampuan sistem, bukan data bisnis workspace'
    );
  });

  test('capabilityCatalogBlock hadir walau context-engine gagal total (ctx null) -- tidak bergantung pada data bisnis workspace', async () => {
    // fakePrisma di file ini SUDAH membuat context-engine gagal (memoryItem/
    // cashTransaction/dll dikembalikan default aman, bukan mensimulasikan
    // kegagalan) -- justru itu poinnya: walau ctx TIDAK punya data finansial
    // apapun (workspace baru/kosong), katalog kemampuan tetap muncul karena ini
    // pengetahuan statis sistem, bukan turunan data bisnis.
    const token = signJwtToken({ userId: 'user-cap', workspaceId: 'ws-cap-default' });
    const response = await chatPOST(chatRequest({ message: 'Ada bantuan lain?', history: [] }, token));

    assert.equal(response.status, 200);
    const systemInstruction: string = executeAIRequestCalls[0].systemInstruction;
    const sampleTemplate = listDocTemplates()[0];
    assert.ok(systemInstruction.includes(sampleTemplate.label));
  });
});
