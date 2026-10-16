import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

// ---------------------------------------------------------------------------
// KELOMPOK 3 (6-7 Sep 2026) -- sambungan "ingatan dokumen" ke otak AI.
//
// Bug yang diperbaiki: src/lib/ai-brain/context-engine.ts (baris ~49, sebelum
// perubahan ini) HANYA mencari memoryItem yang isinya berawalan
// "[COMPANY_PROFILE]" -- padahal dokumen yang diupload pengguna dicatat lewat
// src/lib/ai-brain/company-memory.ts dengan awalan "[COMPANY_KNOWLEDGE]" (tag
// BEDA). BusinessContextSnapshot (dipakai brain/alerts, brain/nudges,
// brain/recommendations, brain/simulate, brain/decision-memory, brain/execute
// lewat execution-engine.ts, dan generation-engine.ts) TIDAK PERNAH membawa
// pengetahuan itu -- consumer-consumer itu buta terhadap dokumen yang sudah
// diupload dan dicatat.
//
// (CATATAN JUJUR, ditemukan lewat investigasi sebelum menulis fix: brain/chat/
// route.ts SENDIRI sudah punya jalur terpisah -- independen dari context-engine.ts
// -- yang memanggil getAccumulatedCompanyKnowledge() langsung dan menyuntikkannya
// ke system prompt [lihat companyMemorySuffix di file itu]. Jadi klaim "otak AI
// TIDAK PERNAH membacanya" hanya benar untuk BusinessContextSnapshot/context-engine,
// BUKAN untuk asisten chat utama, yang sudah menerimanya lewat jalur lain sejak
// sebelum sesi ini. Fix di bawah TIDAK menduplikasi jalur brain/chat itu -- lihat
// komentar di context-engine.ts dan brain/chat/route.ts untuk alasan lengkapnya.)
//
// Fix: getOrBuildBusinessContext() sekarang BISA membawa companyKnowledgeSummary
// (field baru, opsional) lewat opsi eksplisit { includeCompanyKnowledge: true } --
// opt-in, BUKAN otomatis, supaya nol query prisma tambahan untuk pemanggil lama
// yang tidak minta field ini (lihat test pertama di bawah).
//
// Test-test ini HARUS GAGAL kalau sambungan [COMPANY_KNOWLEDGE] -> snapshot
// dilepas/dirusak lagi -- itu tujuan eksplisit tugas ini.
// ---------------------------------------------------------------------------

type MemoryItemFixture = { id: string; content: string; createdAt: Date };
type Query = { where?: { id?: string }; include?: unknown };

describe('context-engine: companyKnowledgeSummary (sambungan [COMPANY_KNOWLEDGE])', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let getOrBuildBusinessContext: typeof import('../src/lib/ai-brain/context-engine')['getOrBuildBusinessContext'];
  let invalidateContextCache: typeof import('../src/lib/ai-brain/context-engine')['invalidateContextCache'];

  let calls: string[];
  let memoryItemFindManyResult: MemoryItemFixture[];
  let memoryItemFindFirstResult: { content: string } | null;

  // Proxy Prisma sederhana: workspace.findUnique dan memoryItem.findFirst/findMany
  // eksplisit dimock (satu-satunya yang relevan untuk field baru ini + invariant
  // [COMPANY_PROFILE]); operasi findMany lain (cashTransaction/invoice/promoCoupon/
  // workTask) default ke [] supaya getOrBuildBusinessContext bisa selesai penuh
  // tanpa perlu memock tiap tabel finansial satu-satu (pola sama dengan
  // tests/brain-readonly-guard.test.ts).
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
                if (model === 'workspace' && operation === 'findUnique') {
                  return { id: query.where?.id, name: 'Toko Uji Coba', onboardingProfile: null, corplanProjects: [] };
                }
                if (model === 'memoryItem' && operation === 'findFirst') return memoryItemFindFirstResult;
                if (model === 'memoryItem' && operation === 'findMany') return memoryItemFindManyResult;
                if (operation === 'findMany') return [];
                if (operation === 'findUnique' || operation === 'findFirst') return null;
                if (operation === 'count') return 0;
                throw new Error(`Unmocked Prisma operation in context-engine-company-knowledge test: ${model}.${operation}`);
              };
            },
          }
        );
      },
    }
  );

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    // globalThis.prisma HARUS diset SEBELUM context-engine.ts pertama kali di-import
    // (src/lib/prisma.ts pakai pola singleton globalForPrisma.prisma ?? new
    // PrismaClient() yang dieksekusi saat modul pertama kali di-load) -- import
    // dinamis di sini, bukan static import di atas file.
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    ({ getOrBuildBusinessContext, invalidateContextCache } = await import('../src/lib/ai-brain/context-engine'));
  });

  beforeEach(() => {
    calls = [];
    memoryItemFindManyResult = [];
    memoryItemFindFirstResult = null;
    // CACHE_TTL_MS di context-engine.ts adalah 60 detik, di-share lintas test lewat
    // module-level Map -- wajib di-invalidate tiap test biar tidak baca snapshot basi
    // dari test sebelumnya (tiap test di bawah juga pakai workspaceId unik sebagai
    // lapis pertahanan kedua).
    invalidateContextCache();
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
  });

  test('default (tanpa opsi): companyKnowledgeSummary undefined DAN memoryItem.findMany TIDAK PERNAH dipanggil -- pemanggil lama nol berubah', async () => {
    // Sengaja isi data [COMPANY_KNOWLEDGE] di fixture -- kalau test ini GAGAL (field
    // terisi atau findMany terpanggil), berarti opt-in gate-nya bocor dan SEMUA
    // pemanggil lama (brain/alerts, brain/nudges, brain/recommendations, brain/
    // simulate, brain/execute, generation-engine) diam-diam kena query tambahan.
    memoryItemFindManyResult = [
      { id: 'x', content: '[COMPANY_KNOWLEDGE] source="seharusnya-tidak-terbaca.xlsx" | facts: ini tidak boleh muncul', createdAt: new Date() },
    ];
    const ctx = await getOrBuildBusinessContext('ws-default-no-opt-in', true, null);
    assert.equal(ctx.companyKnowledgeSummary, undefined);
    assert.equal(calls.includes('memoryItem.findMany'), false, 'includeCompanyKnowledge tidak diminta -> memoryItem.findMany tidak boleh dipanggil sama sekali');
  });

  test('includeCompanyKnowledge: true -- dokumen [COMPANY_KNOWLEDGE] yang pernah diupload BENAR-BENAR masuk ke snapshot (ini yang GAGAL kalau sambungan dilepas)', async () => {
    memoryItemFindManyResult = [
      {
        id: '1',
        content: '[COMPANY_KNOWLEDGE] source="rekap-kas-agustus.xlsx" | facts: total pendapatan Agustus Rp 87.500.000, biaya operasional Rp 42.000.000',
        createdAt: new Date(),
      },
    ];
    const ctx = await getOrBuildBusinessContext('ws-with-knowledge', true, null, { includeCompanyKnowledge: true });
    assert.ok(ctx.companyKnowledgeSummary, 'companyKnowledgeSummary harus terisi kalau ada [COMPANY_KNOWLEDGE] tersimpan untuk workspace ini');
    assert.match(
      ctx.companyKnowledgeSummary as string,
      /rekap-kas-agustus\.xlsx/,
      'nama sumber dokumen dari tag [COMPANY_KNOWLEDGE] harus sampai ke snapshot'
    );
    assert.match(ctx.companyKnowledgeSummary as string, /87\.500\.000/, 'isi ringkasan fakta harus ikut sampai, bukan cuma nama file');
    assert.ok(calls.includes('memoryItem.findMany'), 'includeCompanyKnowledge: true harus benar-benar memicu query memoryItem.findMany');
  });

  test('tidak ada [COMPANY_KNOWLEDGE] tersimpan untuk workspace ini -> companyKnowledgeSummary undefined (bukan string kosong)', async () => {
    memoryItemFindManyResult = [];
    const ctx = await getOrBuildBusinessContext('ws-no-knowledge-yet', true, null, { includeCompanyKnowledge: true });
    assert.equal(ctx.companyKnowledgeSummary, undefined);
  });

  test('[COMPANY_PROFILE] TIDAK terganggu sama sekali oleh penambahan [COMPANY_KNOWLEDGE] -- dua tag beda dibaca berdampingan dengan benar', async () => {
    memoryItemFindFirstResult = {
      content: '[COMPANY_PROFILE] Nama: Toko Kopi Senja | Industri: F&B | Target Pasar: Anak muda urban',
    };
    memoryItemFindManyResult = [
      { id: '2', content: '[COMPANY_KNOWLEDGE] source="profil-usaha.pdf" | facts: berdiri sejak 2022, sudah 3 cabang', createdAt: new Date() },
    ];
    const ctx = await getOrBuildBusinessContext('ws-both-tags', true, null, { includeCompanyKnowledge: true });

    // Invariant WAJIB dari instruksi tugas: cara baca [COMPANY_PROFILE] tidak boleh
    // berubah sedikit pun -- masih lewat memoryIndustry/workspaceName seperti semula.
    assert.equal(ctx.strategy.primaryIndustry, 'F&B');
    assert.equal(ctx.workspaceName, 'Toko Kopi Senja');
    assert.equal(ctx.strategy.targetMarket, 'Anak muda urban');
    // Dan field baru tetap terisi berdampingan, tidak saling menimpa/hilang.
    assert.match(ctx.companyKnowledgeSummary as string, /profil-usaha\.pdf/);
  });
});
