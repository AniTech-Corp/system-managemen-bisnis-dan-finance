import { prisma } from '@/lib/prisma';
import { getAccumulatedCompanyKnowledge } from './company-memory';
import { filterFilesForRole, visibilityPolicyLine, type DivisionRole } from './data-visibility';

/**
 * KLIR AI Brain — Workspace Knowledge (7 Sep 2026, malam, KELOMPOK B3 KNOWLEDGE).
 *
 * Latar belakang (root cause Q1, laporan scan "upload-knowledge" 7 Sep 2026):
 * sebelum file ini ada, brain/chat/route.ts cuma menyuntik pengetahuan
 * perusahaan lewat getAccumulatedCompanyKnowledge() (company-memory.ts) yang
 * dipotong 3 lapis berturut-turut (4000 char/file -> 1500 char/item ->
 * 3000 char TOTAL gabungan 10 item TERBARU). Untuk workspace dengan 12 file
 * upload (mis. data dummy "PT MAKAN MANIA MANTAP"), hasilnya AI Brain
 * genuinely cuma "melihat" isi ~2 file paling akhir diupload -- 10 file
 * lain ADA di Pusat Data (WorkspaceFile, bisa dilihat manusia di UI) tapi
 * TIDAK PERNAH sampai ke LLM sama sekali.
 *
 * Modul ini menggantikan cara baca itu dengan 2 blok:
 * 1. `manifest` -- daftar SEMUA WorkspaceFile milik workspace (nama, tipe,
 *    status, tanggal, gist 1 baris <=120 karakter). Ini yang bikin AI bisa
 *    jawab jujur "ada berapa file dan apa saja namanya" walau isi detailnya
 *    belum semua ikut terbaca.
 * 2. `relevant` -- isi lengkap (<=3000 char/file) dari 4 file yang paling
 *    relevan dengan pertanyaan user SEKARANG, dipilih lewat skor leksikal
 *    sederhana (overlap token, BUKAN embedding/vector DB -- NOL panggilan
 *    API berbayar tambahan, sesuai ATURAN KERAS context pack 7 Sep).
 *
 * Anti-duplikasi (poin eksplisit dari tugas: "pastikan TIDAK ada data yang
 * dikirim 2x"): recordCompanyKnowledge() (company-memory.ts) dipanggil dari
 * DUA tempat -- workspace-files/route.ts (SETIAP file yang sukses diupload
 * ke Pusat Data, sumbernya SAMA PERSIS dengan WorkspaceFile.extractedSummary
 * yang sudah dibaca via `manifest`/`relevant` di atas -- DUPLIKAT) dan
 * documents/analyze/route.ts (lampiran chat yang TIDAK PERNAH jadi baris
 * WorkspaceFile -- lihat gap Q2 di laporan scan upload-knowledge, BUKAN
 * duplikat). Daripada membuang getAccumulatedCompanyKnowledge() begitu saja
 * (itu akan menghilangkan pengetahuan dari lampiran chat, regresi), fungsi
 * di bawah memfilter MemoryItem[COMPANY_KNOWLEDGE] yang source-nya SUDAH ada
 * di manifest WorkspaceFile -- yang lolos filter cuma entri dari sumber
 * BUKAN-WorkspaceFile. Konsekuensi yang disengaja: kalau workspace ini BELUM
 * punya WorkspaceFile sama sekali (Pusat Data kosong), Set nama file yang
 * difilter itu KOSONG -- otomatis SEMUA entri MemoryItem lolos, jadi
 * `relevant` di bawah otomatis berfungsi sebagai fallback penuh persis
 * seperti perilaku lama getAccumulatedCompanyKnowledge() (lihat caps yang
 * dinaikkan di company-memory.ts, komentar di sana).
 *
 * Non-fatal: query gagal (Prisma error apapun) -> return blok kosong semua,
 * TIDAK PERNAH throw ke resolveBusinessData()/brain-chat -- kegagalan modul
 * ini paling buruk membuat AI Brain balik "buta" ke pengetahuan dokumen
 * (perilaku lama sebelum companyMemorySuffix ada sama sekali), BUKAN crash
 * chat atau data salah tertulis ke DB (modul ini murni baca, tidak menulis).
 */

export interface WorkspaceKnowledgeBlock {
  /** Daftar SEMUA WorkspaceFile workspace ini, 1 baris per file + gist singkat. */
  manifest: string;
  /** Isi lengkap (dipotong per file) dari file-file paling relevan dengan pertanyaan. */
  relevant: string;
  /** Total karakter manifest + relevant SETELAH pemotongan budget akhir. */
  totalChars: number;
}

// --- Konstanta budget & bobot -- angka-angka ini dipilih supaya total tetap
// jauh di bawah window konteks LLM tanpa perlu tuning rumit; lihat komentar
// per konstanta untuk alasannya. ---

/** Panjang maksimum gist per baris manifest (1 baris = 1 file). */
const MANIFEST_GIST_MAX_CHARS = 120;
/** Berapa file paling relevan yang isi lengkapnya ikut disuntik ke prompt (dinaikkan dari 4 ke 12 agar 10-12 file workspace dapat terbaca utuh). */
const TOP_K_COUNT = 12;
/** Batas karakter isi extractedSummary PER FILE di blok `relevant`. */
const TOP_K_FILE_CHAR_BUDGET = 3000;
/** Jaring pengaman terakhir -- total manifest+relevant TIDAK PERNAH melewati ini. */
const TOTAL_CHAR_BUDGET = 14000;
/** Token yang match NAMA FILE dihitung 3x lebih berat dari token yang match ISI. */
const FILE_NAME_TOKEN_WEIGHT = 3;

// Stopword kecil ID+EN (bukan daftar lengkap linguistik -- cukup buang kata
// sambung paling umum supaya skor overlap tidak "kebanjiran" match kata
// generik yang tidak bermakna buat relevansi).
const STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'pada', 'dengan', 'ini', 'itu',
  'ada', 'apa', 'saja', 'atau', 'juga', 'akan', 'sudah', 'belum', 'tidak',
  'bukan', 'saya', 'kamu', 'kita', 'mereka', 'dia', 'nya', 'kah', 'lah',
  'the', 'and', 'for', 'are', 'was', 'you', 'ini', 'itu', 'gimana', 'gmn',
]);

/** Tokenize sederhana: lowercase, pecah non-alfanumerik, buang token pendek/stopword. */
function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/** Skor overlap token pertanyaan vs (nama file + isi ringkasan), bobot nama file 3x. */
function overlapScore(queryTokens: Set<string>, fileName: string, summary: string): number {
  if (queryTokens.size === 0) return 0;
  let score = 0;
  for (const t of tokenize(fileName)) {
    if (queryTokens.has(t)) score += FILE_NAME_TOKEN_WEIGHT;
  }
  for (const t of tokenize(summary)) {
    if (queryTokens.has(t)) score += 1;
  }
  return score;
}

interface WorkspaceFileLite {
  fileName: string;
  fileType: string;
  status: string;
  createdAt: Date;
  extractedSummary: string | null;
  uploadedBy?: string | null;
}

/**
 * TAMBAHAN 11 Sep 2026 sore (keputusan produk Mecca, filter per divisi):
 * `viewer` opsional. Tanpa viewer (pemanggil lama: company-brief, context-engine,
 * auto-company-profile -- semuanya level WORKSPACE, konsumennya CEO/sistem) =
 * perilaku lama, SEMUA file. Dengan viewer = file disaring lewat
 * data-visibility.ts (CEO semua; FINANCE keuangan+SDM+umum; MARKETING
 * marketing+umum), file yang diupload viewer sendiri selalu ikut.
 */
export interface KnowledgeViewer {
  role: DivisionRole;
  userId?: string | null;
}

export async function buildWorkspaceKnowledgeBlock(
  workspaceId: string,
  userQuery: string,
  viewer?: KnowledgeViewer
): Promise<WorkspaceKnowledgeBlock> {
  try {
    const allFiles: WorkspaceFileLite[] = await prisma.workspaceFile.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      select: {
        fileName: true,
        fileType: true,
        status: true,
        createdAt: true,
        extractedSummary: true,
        uploadedBy: true,
      },
    });

    // 0. FILTER DIVISI (11 Sep sore) -- lihat JSDoc KnowledgeViewer di atas.
    let files: WorkspaceFileLite[] = allFiles;
    let hiddenCount = 0;
    if (viewer && viewer.role !== 'CEO') {
      const filtered = filterFilesForRole(allFiles, viewer.role, { viewerUserId: viewer.userId ?? null });
      files = filtered.visible;
      hiddenCount = filtered.hiddenCount;
    }

    // 1. MANIFEST -- SEMUA file (bukan cuma yang PROCESSED), supaya AI tetap tahu
    //    ada file yang lagi diproses/gagal juga (jujur soal statusnya), bukan
    //    diam-diam disembunyikan dari daftar.
    const manifestLines = files.map((f) => {
      const gist = (f.extractedSummary || '').replace(/\s+/g, ' ').trim().slice(0, MANIFEST_GIST_MAX_CHARS);
      const tanggal = f.createdAt.toISOString().slice(0, 10);
      return `- ${f.fileName} [${f.fileType}, ${f.status}, ${tanggal}]${gist ? `: ${gist}` : ''}`;
    });
    const hiddenNote = hiddenCount > 0
      ? `\n(${hiddenCount} file lain disembunyikan karena di luar divisi pembaca -- jangan menebak isinya.)`
      : '';
    const policyLine = viewer ? visibilityPolicyLine(viewer.role) : '';
    const manifest = manifestLines.length
      ? `DAFTAR SEMUA FILE DI WORKSPACE INI (${files.length} file, urut upload terbaru dulu):\n${manifestLines.join('\n')}${hiddenNote}${policyLine ? `\n${policyLine}` : ''}`
      : hiddenCount > 0
        ? `DAFTAR FILE: tidak ada file yang boleh dilihat divisi ini (${hiddenCount} file disembunyikan).${policyLine ? `\n${policyLine}` : ''}`
        : '';

    // 2. TOP-K RELEVAN -- cuma file berstatus PROCESSED yang punya isi ekstraksi.
    const queryTokens = new Set(tokenize(userQuery));
    const candidates = files.filter((f) => f.status === 'PROCESSED' && f.extractedSummary);
    const scoredAll = candidates
      .map((f) => ({ f, score: overlapScore(queryTokens, f.fileName, f.extractedSummary || '') }))
      .sort((a, b) => b.score - a.score);
    const hasAnyMatch = scoredAll.some((s) => s.score > 0);
    // Kalau tidak ada satupun file yang match token pertanyaan (query kosong, atau
    // pertanyaan generik tanpa overlap kata), tetap kasih 4 file TERBARU sebagai
    // fallback -- lebih baik AI dapat sesuatu yang mungkin relevan daripada blok
    // relevant kosong sama sekali walau workspace punya banyak file.
    const topKFiles = (hasAnyMatch ? scoredAll : candidates.map((f) => ({ f, score: 0 }))).slice(0, TOP_K_COUNT);

    const relevantFileBlocks = topKFiles.map(
      ({ f }) => `--- ${f.fileName} ---\n${(f.extractedSummary || '').slice(0, TOP_K_FILE_CHAR_BUDGET)}`
    );

    // 3. ANTI-DUPLIKASI -- lihat komentar panjang di atas file ini. fileNameSet
    //    dipakai buat menyaring MemoryItem[COMPANY_KNOWLEDGE] yang source-nya
    //    SUDAH terwakili di manifest WorkspaceFile di atas.
    // Pakai allFiles (bukan files tersaring) supaya pengetahuan dari lampiran chat
    // yang sumbernya file TERSEMBUNYI tetap ikut tersaring (anti-bocor lewat jalur
    // MemoryItem[COMPANY_KNOWLEDGE]).
    const fileNameSet = new Set(allFiles.map((f) => f.fileName));
    const chatOnlyKnowledge = await getAccumulatedCompanyKnowledge(workspaceId, {
      excludeSourceNames: fileNameSet,
    });

    let relevant = [relevantFileBlocks.join('\n\n'), chatOnlyKnowledge].filter(Boolean).join('\n\n');
    let manifestOut = manifest;

    // 4. JARING PENGAMAN BUDGET TOTAL -- potong `relevant` dulu (manifest lebih
    //    penting buat "data apa yang ada"), baru manifest kalau masih lewat juga
    //    (kasus ekstrem: ratusan file bikin manifest sendiri > 14000 char).
    //    PENTING: slice(0, N-1) + '…' (BUKAN slice(0, N) + '…') supaya hasil akhir
    //    PERSIS N karakter, bukan N+1 -- versi awal sempat salah nambah 1 karakter
    //    ellipsis DI ATAS budget yang sudah pas-pasan, ketahuan lewat test budget.
    let totalChars = manifestOut.length + relevant.length;
    if (totalChars > TOTAL_CHAR_BUDGET) {
      const relevantBudget = Math.max(0, TOTAL_CHAR_BUDGET - manifestOut.length);
      if (relevant.length > relevantBudget) {
        relevant = relevantBudget > 0 ? relevant.slice(0, relevantBudget - 1) + '…' : '';
      }
      totalChars = manifestOut.length + relevant.length;
      if (totalChars > TOTAL_CHAR_BUDGET) {
        // Kasus ekstrem: manifest SENDIRI sudah >= budget (ratusan file). relevant
        // sudah dikosongkan/dipotong maksimal di atas -- potong manifest juga.
        manifestOut = manifestOut.slice(0, TOTAL_CHAR_BUDGET - 1) + '…';
        totalChars = manifestOut.length + relevant.length;
      }
    }

    return { manifest: manifestOut, relevant, totalChars };
  } catch (err) {
    console.warn('[WorkspaceKnowledge] gagal membangun blok pengetahuan workspace (non-fatal):', err);
    return { manifest: '', relevant: '', totalChars: 0 };
  }
}
