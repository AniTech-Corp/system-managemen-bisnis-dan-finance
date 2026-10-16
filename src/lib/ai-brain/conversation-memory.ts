import { prisma } from '@/lib/prisma';
import { canRoleReadTurnOf, type DivisionRole } from './data-visibility';

/**
 * KLIR AI Brain -- Conversation Memory (11 Sep 2026, KOMANDO Fable 5.1, B3_AI knowledge).
 *
 * CATATAN RACE CONDITION (ditulis ulang B3_AI setelah ketahuan): file ini
 * sempat DITIMPA sementara oleh stub agent B2 (backend-chat-route, dibuat
 * paralel karena B2 juga butuh modul ini untuk tsc lokalnya SEBELUM implementasi
 * asli B3 ini sempat ditulis ke disk). Versi INI adalah implementasi ASLI B3.
 *
 * Latar belakang (context pack keluhan Mecca #10: "riwayat chat jadi memori;
 * semua role tahu apa yang sedang dikerjakan lintas divisi"): sebelum modul ini,
 * riwayat chat HANYA hidup di localStorage client (per-browser, per-role, TIDAK
 * pernah sampai ke server) -- CEO tidak pernah tahu Finance baru saja menanyakan
 * apa ke AI Assistant-nya sendiri, dan sebaliknya. Modul ini menambah memori
 * SERVER-SIDE ringan (8 giliran terakhir LINTAS ROLE) memakai model MemoryItem
 * yang SUDAH ADA (tag baru [CHAT_TURN]), pola yang SAMA PERSIS dengan
 * [COMPANY_KNOWLEDGE]/[BRAIN_MISTAKE]/[ORCH_ROUTE_STATS] -- NOL migration baru.
 *
 * NOL LLM (kontrak keras modul 5): recordConversationTurn() dan
 * buildConversationMemoryBlock() TIDAK PERNAH memanggil orchestrate()/LLM
 * apapun -- extractAnswerCore() (fungsi "inti jawaban") murni regex+string
 * deterministik, dites langsung di tests/conversation-memory.test.ts.
 *
 * KENAPA "inti" BUKAN jawaban penuh: menyimpan jawaban LLM APA ADANYA (bisa
 * ratusan/ribuan karakter) ke MemoryItem lalu membacanya balik ke prompt LAPIS 3
 * request LAIN akan membengkakkan budget prompt (SAFE_SYSTEM_PROMPT_CHAR_BUDGET
 * 26000 char, route.ts) dengan cepat kalau 8 turn semuanya jawaban panjang --
 * extractAnswerCore() memampatkan tiap jawaban jadi <=220 karakter (kalimat yang
 * mengandung angka/kesimpulan, atau 220 char pertama teks bersih) supaya total
 * blok tetap masuk akal (dibatasi lagi ke <=2000 char total di
 * buildConversationMemoryBlock).
 *
 * NEVER-THROW: kedua fungsi publik membungkus isinya di try/catch tunggal --
 * recordConversationTurn dipanggil fire-and-forget dari route.ts (B2) setelah
 * jawaban chat/generate sukses, kegagalan mencatat TIDAK BOLEH menggagalkan
 * respons chat yang sudah terkirim ke user.
 */

const CHAT_TURN_TAG = '[CHAT_TURN]';

/** Jumlah giliran terakhir (lintas role) yang diambil untuk blok memori. */
const RECENT_TURN_COUNT = 8;
/** Batas panjang pertanyaan yang disimpan per giliran. */
const MAX_QUESTION_CHARS = 180;
/** Batas panjang "inti jawaban" (lihat JSDoc extractAnswerCore). */
const MAX_ANSWER_CORE_CHARS = 220;
/** Batas panjang nama pengguna yang disimpan per giliran. */
const MAX_USER_NAME_CHARS = 40;
/** Batas keras TOTAL karakter blok yang dikembalikan ke prompt (kontrak modul 5). */
const TOTAL_BLOCK_BUDGET = 2000;

/** Role divisi authoritative yang boleh disimpan ke memory. */
export type ChatTurnRole = DivisionRole;

/** Jenis artefak yang dihasilkan dari giliran chat ini (kontrak modul 5). */
export type ChatTurnArtifact = 'none' | 'word' | 'excel' | 'ppt' | 'pdf' | 'image' | 'video' | 'storyboard';

const KNOWN_ARTIFACTS: ReadonlyArray<ChatTurnArtifact> = [
  'none',
  'word',
  'excel',
  'ppt',
  'pdf',
  'image',
  'video',
  'storyboard',
];

export interface RecordConversationTurnInput {
  workspaceId: string;
  role: string;
  userName: string;
  question: string;
  answer: string;
  artifact?: string;
}

/** Normalisasi role bebas (dari membership/userRole route.ts) ke 4 nilai yang
 * dikenal tag [CHAT_TURN] -- role tidak dikenal/kosong/typo jatuh ke 'LAIN'
 * (bukan error), supaya recordConversationTurn tidak pernah gagal gara-gara
 * nilai role yang "aneh". */
function normalizeRole(role: string): ChatTurnRole {
  const r = (role || '').trim().toUpperCase();
  if (r === 'CEO' || r === 'FINANCE' || r === 'MARKETING' || r === 'SEKRETARIS' || r === 'MANAGER_UMUM' || r === 'MANAGER_OPERASIONAL') return r;
  return 'LAIN';
}

function normalizeArtifact(artifact: string | undefined): ChatTurnArtifact {
  const a = (artifact || 'none').trim().toLowerCase();
  return (KNOWN_ARTIFACTS as readonly string[]).includes(a) ? (a as ChatTurnArtifact) : 'none';
}

function truncate(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + '…';
}

/**
 * Buang markdown dasar (code fence, inline code, gambar, link, heading/bold/
 * italic/bullet) dari teks jawaban -- deterministik, dipakai extractAnswerCore
 * supaya "inti jawaban" yang disimpan tidak mengandung simbol markdown mentah
 * (```, **, #, -, dst) saat ditampilkan sebagai memori lintas-divisi ke LLM lain.
 */
function stripMarkdown(text: string): string {
  return (text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_#>]+/g, ' ')
    .replace(/^\s*-\s+/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Ambil "inti" 1 jawaban LLM: kalimat PERTAMA yang mengandung angka (heuristik
 * sederhana untuk "ini kemungkinan kesimpulan/data penting", bukan basa-basi
 * pembuka) -- kalau TIDAK ADA kalimat yang mengandung angka sama sekali, pakai
 * <=220 karakter pertama dari teks bersih (setelah markdown dibuang). Murni
 * deterministik (regex + string), NOL LLM, NOL Prisma -- diekspor supaya bisa
 * dites langsung tanpa mem-mock apapun.
 */
export function extractAnswerCore(answer: string): string {
  const clean = stripMarkdown(answer);
  if (!clean) return '';
  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const withNumber = sentences.find((s) => /\d/.test(s));
  const core = (withNumber || clean).trim();
  return truncate(core, MAX_ANSWER_CORE_CHARS);
}

/**
 * Catat 1 giliran percakapan (pertanyaan user + inti jawaban AI) sebagai
 * MemoryItem baru (scope WORKSPACE, userId null -- level-workspace, bukan
 * personal, supaya kebaca lintas-role) -- pola append-only yang sama dengan
 * tag lain di ai-brain/*.ts. Never-throw: gagal cukup di-log, TIDAK PERNAH
 * dilempar ke caller (dipanggil fire-and-forget dari route.ts, B2).
 */
export async function recordConversationTurn(input: RecordConversationTurnInput): Promise<void> {
  try {
    const role = normalizeRole(input.role);
    const userName = truncate(input.userName || 'Pengguna', MAX_USER_NAME_CHARS) || 'Pengguna';
    const question = truncate(input.question, MAX_QUESTION_CHARS);
    const inti = extractAnswerCore(input.answer);
    const artifact = normalizeArtifact(input.artifact);
    const content =
      `${CHAT_TURN_TAG} role=${role} user=${userName} at=${new Date().toISOString()} ` +
      `| tanya: ${question} | inti: ${inti} | artefak: ${artifact}`;

    await prisma.memoryItem.create({
      data: { workspaceId: input.workspaceId, userId: null, scope: 'WORKSPACE', content },
    });
  } catch (err) {
    console.warn('[ConversationMemory] gagal mencatat giliran percakapan (non-fatal):', err);
  }
}

/**
 * Bangun blok "AKTIVITAS TERBARU LINTAS DIVISI" (8 giliran terakhir workspace
 * ini, lintas SEMUA role) untuk disisipkan ke dataBlock (route.ts, B2). Baris
 * untuk role LAIN dari currentRole diberi awalan "[divisi X]" supaya LLM tahu
 * mana konteks divisinya sendiri vs divisi lain. String kosong kalau belum ada
 * giliran tercatat sama sekali. Never-throw: query gagal -> string kosong,
 * kegagalan modul ini paling buruk membuat LLM "buta" ke aktivitas lintas
 * divisi (bukan crash chat).
 */
export async function buildConversationMemoryBlock(workspaceId: string, currentRole: string): Promise<string> {
  try {
    const items = await prisma.memoryItem.findMany({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: { startsWith: CHAT_TURN_TAG },
      },
      orderBy: { createdAt: 'desc' },
      take: RECENT_TURN_COUNT,
    });
    if (items.length === 0) return '';

    const normalizedCurrent = normalizeRole(currentRole);
    const lines = items.map((item: { content: string }) => {
      const roleMatch = item.content.match(/role=([A-Z_]+)/);
      const itemRole = (roleMatch ? roleMatch[1] : 'LAIN') as ChatTurnRole;
      const body = item.content.replace(`${CHAT_TURN_TAG} `, '');
      if (itemRole === normalizedCurrent) return `- ${body}`;
      // FILTER DIVISI (11 Sep 2026 sore, keputusan Mecca): giliran divisi yang
      // datanya TIDAK boleh dibaca pembaca ini (mis. MARKETING membaca giliran
      // FINANCE/CEO) tetap muncul sebagai "sedang mengerjakan apa" (pertanyaan
      // saja, dipendekkan) TANPA inti jawaban -- awareness lintas divisi tetap
      // ada (poin 10 Mecca), angka keuangan tidak bocor (keputusan sore).
      if (!canRoleReadTurnOf(normalizedCurrent, itemRole)) {
        const q = (body.match(/\| tanya: (.*?) \| inti:/) || [])[1] || '';
        const who = (body.match(/user=(.*?) at=/) || [])[1] || 'pengguna';
        return `- [divisi ${itemRole}] ${who} sedang membahas: ${truncate(q, 80)} (detail jawaban tidak dibagikan ke divisi ini)`;
      }
      return `- [divisi ${itemRole}] ${body}`;
    });

    const header = 'AKTIVITAS TERBARU LINTAS DIVISI (memori percakapan, 8 terakhir):';
    let block = `${header}\n${lines.join('\n')}`;
    if (block.length > TOTAL_BLOCK_BUDGET) {
      block = block.slice(0, Math.max(0, TOTAL_BLOCK_BUDGET - 1)) + '…';
    }
    return block;
  } catch (err) {
    console.warn('[ConversationMemory] gagal membangun blok memori percakapan (non-fatal):', err);
    return '';
  }
}
