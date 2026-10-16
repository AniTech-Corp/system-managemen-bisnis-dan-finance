import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

// ---------------------------------------------------------------------------
// B3_AI TESTS (11 Sep 2026) -- src/lib/ai-brain/conversation-memory.ts
// (kontrak modul 5).
//
// CATATAN JUJUR (ditemukan LIVE menjalankan test ini, bukan warisan klaim):
// TIDAK ADA import statis apapun dari '../src/lib/ai-brain/conversation-memory'
// di level modul file test ini -- src/lib/prisma.ts mem-bind `export const
// prisma = globalForPrisma.prisma ?? new PrismaClient(...)` SEKALI saat modul
// itu PERTAMA di-import di proses ini (pola SAMA PERSIS yang didokumentasikan
// tests/brain-chat-composer-extras.test.ts baris 6-21). Kalau ada import statis
// modul-under-test di atas file (bahkan untuk fungsi PURE seperti
// extractAnswerCore yang sendirinya tidak butuh Prisma), import itu tetap
// men-trigger evaluasi 'conversation-memory.ts' -> '@/lib/prisma' SEBELUM
// before() sempat memasang fakePrisma ke globalThis -- akibatnya PrismaClient
// ASLI ter-bind permanen, dan seluruh fakePrisma di describe manapun di FILE
// INI tidak pernah kepakai (root cause 10 test recordConversationTurn/
// buildConversationMemoryBlock gagal "memoryItems.length tetap 0" pada draft
// pertama test ini). Fix: SATU before() top-level memasang fakePrisma ke
// globalThis DULU, baru dynamic import modul-under-test SEKALI, dipakai
// bersama oleh kedua describe di bawah (pure + Prisma-backed).
// ---------------------------------------------------------------------------

describe('conversation-memory (kontrak modul 5)', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;

  let extractAnswerCore: typeof import('../src/lib/ai-brain/conversation-memory')['extractAnswerCore'];
  let recordConversationTurn: typeof import('../src/lib/ai-brain/conversation-memory')['recordConversationTurn'];
  let buildConversationMemoryBlock: typeof import('../src/lib/ai-brain/conversation-memory')['buildConversationMemoryBlock'];

  let memoryItems: Array<{ id: string; workspaceId: string; userId: string | null; scope: string; content: string; createdAt: Date }>;
  let idSeq: number;
  let prismaShouldReject: boolean;

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
                if (prismaShouldReject) throw new Error(`Simulasi Prisma down: ${model}.${operation}`);
                const method = `${model}.${operation}`;
                if (method === 'memoryItem.create') {
                  idSeq += 1;
                  const row = { id: `mem-${idSeq}`, createdAt: new Date(Date.now() + idSeq), ...query.data };
                  memoryItems.push(row);
                  return row;
                }
                if (method === 'memoryItem.findMany') {
                  const rows = memoryItems
                    .filter((r) => r.workspaceId === query.where?.workspaceId && r.scope === query.where?.scope)
                    .filter((r) => !query.where?.content?.startsWith || r.content.startsWith(query.where.content.startsWith))
                    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                  const take = typeof query.take === 'number' ? query.take : rows.length;
                  return rows.slice(0, take);
                }
                throw new Error(`Unmocked Prisma operation in conversation-memory test: ${method}`);
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
    ({ extractAnswerCore, recordConversationTurn, buildConversationMemoryBlock } = await import('../src/lib/ai-brain/conversation-memory'));
  });

  beforeEach(() => {
    memoryItems = [];
    idSeq = 0;
    prismaShouldReject = false;
  });

  afterEach(() => {
    prismaShouldReject = false;
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
  });

  describe('extractAnswerCore (pure, nol Prisma)', () => {
    test('kalimat pertama yang mengandung angka dipilih sebagai inti', () => {
      const answer = 'Halo, terima kasih sudah bertanya. Omset bulan ini Rp 5.000.000. Semoga membantu.';
      const core = extractAnswerCore(answer);
      assert.match(core, /Omset bulan ini Rp 5\.000\.000\./);
      assert.doesNotMatch(core, /Halo, terima kasih/, 'kalimat pembuka tanpa angka TIDAK BOLEH dipilih kalau ada kalimat lain yang mengandung angka');
    });

    test('tidak ada kalimat mengandung angka -> pakai <=220 char pertama teks bersih', () => {
      const answer = 'Ini jawaban tanpa angka sama sekali, murni penjelasan naratif tentang strategi pemasaran yang bisa dicoba.';
      const core = extractAnswerCore(answer);
      assert.equal(core, answer);
    });

    test('markdown (bold/heading/code/link/bullet) dibuang sebelum diambil intinya', () => {
      const answer = '# Judul\n**Omset** `Rp 5.000.000` [lihat detail](https://x.test) - poin penting.';
      const core = extractAnswerCore(answer);
      assert.doesNotMatch(core, /[*_#`]/);
      assert.doesNotMatch(core, /\[lihat detail\]\(/);
      assert.match(core, /Omset/);
    });

    test('teks lebih dari 220 char -> dipotong tepat 220 dengan ellipsis', () => {
      const answer = 'Tanpa angka apapun di sini. ' + 'kata '.repeat(100);
      const core = extractAnswerCore(answer);
      assert.equal(core.length, 220);
      assert.ok(core.endsWith('…'));
    });

    test('string kosong/whitespace -> string kosong, TIDAK throw', () => {
      assert.equal(extractAnswerCore(''), '');
      assert.equal(extractAnswerCore('   '), '');
    });

    test('code fence panjang dibuang total (bukan disisakan sebagai teks mentah)', () => {
      const answer = '```js\nconst x = 1;\nconsole.log(x);\n```\nKesimpulan: berhasil.';
      const core = extractAnswerCore(answer);
      assert.doesNotMatch(core, /const x/);
      assert.match(core, /Kesimpulan: berhasil\./);
    });
  });

  describe('recordConversationTurn (Prisma palsu)', () => {
    test('menulis 1 MemoryItem[CHAT_TURN] dengan format persis (role/user/tanya/inti/artefak)', async () => {
      await recordConversationTurn({
        workspaceId: 'ws-1',
        role: 'CEO',
        userName: 'Mecca',
        question: 'Apakah profit bulan ini?',
        answer: 'Ya, profit Rp 2.000.000 bulan ini.',
        artifact: 'none',
      });
      assert.equal(memoryItems.length, 1);
      const content = memoryItems[0].content;
      assert.match(content, /^\[CHAT_TURN\] role=CEO user=Mecca at=\d{4}-\d{2}-\d{2}T/);
      assert.match(content, /\| tanya: Apakah profit bulan ini\?/);
      assert.match(content, /\| inti: Ya, profit Rp 2\.000\.000 bulan ini\./);
      assert.match(content, /\| artefak: none$/);
      assert.equal(memoryItems[0].scope, 'WORKSPACE');
      assert.equal(memoryItems[0].userId, null);
    });

    test('role tidak dikenal (typo/kosong) -> dinormalisasi jadi LAIN', async () => {
      await recordConversationTurn({ workspaceId: 'ws-2', role: 'OWNER', userName: 'X', question: 'q', answer: 'a' });
      assert.match(memoryItems[0].content, /role=LAIN/);
    });

    test('role lowercase -> dinormalisasi ke uppercase yang dikenal', async () => {
      await recordConversationTurn({ workspaceId: 'ws-3', role: 'finance', userName: 'X', question: 'q', answer: 'a' });
      assert.match(memoryItems[0].content, /role=FINANCE/);
    });

    test('artifact tidak dikenal -> dinormalisasi jadi none; artifact tidak dikirim -> default none', async () => {
      await recordConversationTurn({ workspaceId: 'ws-4', role: 'CEO', userName: 'X', question: 'q', answer: 'a', artifact: 'pdf-tidak-dikenal' });
      assert.match(memoryItems[0].content, /artefak: none$/);
      await recordConversationTurn({ workspaceId: 'ws-4', role: 'CEO', userName: 'X', question: 'q', answer: 'a' });
      assert.match(memoryItems[1].content, /artefak: none$/);
    });

    test('artifact dikenal (image/video/word/excel/ppt/storyboard) dipertahankan apa adanya', async () => {
      for (const artifact of ['image', 'video', 'word', 'excel', 'ppt', 'storyboard']) {
        await recordConversationTurn({ workspaceId: `ws-artifact-${artifact}`, role: 'CEO', userName: 'X', question: 'q', answer: 'a', artifact });
      }
      const artifacts = memoryItems.map((m) => m.content.match(/artefak: (\w+)$/)?.[1]);
      assert.deepEqual(artifacts, ['image', 'video', 'word', 'excel', 'ppt', 'storyboard']);
    });

    test('pertanyaan/nama dipotong sesuai batas (180/40 char)', async () => {
      await recordConversationTurn({
        workspaceId: 'ws-truncate',
        role: 'CEO',
        userName: 'N'.repeat(80),
        question: 'Q'.repeat(300),
        answer: 'tanpa angka, teks pendek',
      });
      const userMatch = memoryItems[0].content.match(/user=(\S+) at=/);
      const questionMatch = memoryItems[0].content.match(/tanya: (.+) \| inti:/);
      assert.ok(userMatch![1].length <= 40);
      assert.ok(questionMatch![1].length <= 180);
    });

    test('Prisma reject -> TIDAK throw ke caller (never-throw)', async () => {
      prismaShouldReject = true;
      await assert.doesNotReject(() => recordConversationTurn({ workspaceId: 'ws-reject', role: 'CEO', userName: 'X', question: 'q', answer: 'a' }));
    });
  });

  describe('buildConversationMemoryBlock (Prisma palsu)', () => {
    test('belum ada giliran tercatat -> string kosong', async () => {
      const block = await buildConversationMemoryBlock('ws-kosong-block', 'CEO');
      assert.equal(block, '');
    });

    test('giliran dari role SAMA dengan currentRole -> TIDAK diberi awalan "[divisi X]"', async () => {
      await recordConversationTurn({ workspaceId: 'ws-same-role', role: 'CEO', userName: 'Mecca', question: 'q1', answer: 'a1' });
      const block = await buildConversationMemoryBlock('ws-same-role', 'CEO');
      assert.match(block, /AKTIVITAS TERBARU LINTAS DIVISI/);
      assert.doesNotMatch(block, /\[divisi CEO\]/);
    });

    test('giliran dari role LAIN dari currentRole -> diberi awalan "[divisi X]"', async () => {
      await recordConversationTurn({ workspaceId: 'ws-cross-role', role: 'FINANCE', userName: 'Rina', question: 'Berapa kas?', answer: 'Kas Rp 10.000.000' });
      const block = await buildConversationMemoryBlock('ws-cross-role', 'CEO');
      assert.match(block, /\[divisi FINANCE\]/);
    });

    test('mengambil MAKSIMAL 8 giliran terbaru (bukan semua histori)', async () => {
      for (let i = 0; i < 12; i++) {
        await recordConversationTurn({ workspaceId: 'ws-limit-8', role: 'CEO', userName: 'X', question: `pertanyaan ke-${i}`, answer: `jawaban ${i}` });
      }
      const block = await buildConversationMemoryBlock('ws-limit-8', 'CEO');
      const lineCount = block.split('\n').length - 1; // -1 untuk baris header
      assert.equal(lineCount, 8);
      assert.match(block, /pertanyaan ke-11/, 'harus berisi giliran PALING BARU (index 11)');
      assert.doesNotMatch(block, /pertanyaan ke-0\b/, 'giliran PALING LAMA (index 0, di luar 8 terbaru) tidak boleh ikut');
    });

    test('total blok TIDAK PERNAH melewati 2000 karakter', async () => {
      for (let i = 0; i < 8; i++) {
        await recordConversationTurn({
          workspaceId: 'ws-budget',
          role: 'CEO',
          userName: 'X'.repeat(40),
          question: 'Q'.repeat(180),
          answer: 'tanpa angka ' + 'kata '.repeat(60),
        });
      }
      const block = await buildConversationMemoryBlock('ws-budget', 'CEO');
      assert.ok(block.length <= 2000, `panjang block harus <=2000, dapat ${block.length}`);
    });

    test('workspace lain TIDAK ikut tercampur (isolasi antar workspace)', async () => {
      await recordConversationTurn({ workspaceId: 'ws-a-isolasi', role: 'CEO', userName: 'X', question: 'punya ws-a', answer: 'jawaban a' });
      await recordConversationTurn({ workspaceId: 'ws-b-isolasi', role: 'CEO', userName: 'X', question: 'punya ws-b', answer: 'jawaban b' });
      const block = await buildConversationMemoryBlock('ws-a-isolasi', 'CEO');
      assert.match(block, /punya ws-a/);
      assert.doesNotMatch(block, /punya ws-b/);
    });

    test('Prisma reject -> string kosong, TIDAK throw (never-throw)', async () => {
      prismaShouldReject = true;
      const block = await buildConversationMemoryBlock('ws-reject-block', 'CEO');
      assert.equal(block, '');
    });
  });
});
