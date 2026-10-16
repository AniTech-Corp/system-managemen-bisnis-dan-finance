import { prisma } from '@/lib/prisma';
import { recordActivity } from '@/lib/activity-log';

/**
 * KLIR AI Brain — Company Memory (POC kecil, NOL migration baru).
 *
 * Latar belakang: Mecca mau AI Assistant "makin pintar seiring data
 * terintegrasi, makin kenal perusahaan dan pemakainya, bisa belajar dari
 * pengalaman dan kesalahan" -- versi kecil dulu, bukan solusi penuh.
 * Semua penyimpanan di file ini SENGAJA memakai model MemoryItem yang
 * SUDAH ADA (lihat prisma/schema.prisma) dengan konvensi encode-tag di
 * `content` yang sudah dipakai di brain/chat/route.ts ([BRAIN_MISTAKE]),
 * BUKAN tabel/kolom baru. Cuma menyimpan RINGKASAN/FAKTA teks hasil
 * ekstraksi, tidak pernah isi file mentah/binary/base64.
 */

const COMPANY_KNOWLEDGE_TAG = '[COMPANY_KNOWLEDGE]';
const BRAIN_MISTAKE_TAG = '[BRAIN_MISTAKE]';

/**
 * Catat 1 ringkasan/fakta hasil ekstraksi dokumen perusahaan sebagai
 * MemoryItem baru (scope WORKSPACE, level-workspace, userId null) --
 * supaya dokumen yang diupload "diinget" lintas-sesi.
 *
 * Non-fatal: kalau gagal, cukup di-log (console.warn), JANGAN throw ke
 * caller. Mengikuti pola logCorrectionPromise di brain/chat/route.ts.
 */
export async function recordCompanyKnowledge(
  workspaceId: string,
  sourceFileName: string,
  factsSummary: string
): Promise<void> {
  try {
    await prisma.memoryItem.create({
      data: {
        workspaceId,
        userId: null,
        scope: 'WORKSPACE',
        // Cap dinaikkan 1500 -> 4000 (7 Sep 2026, integrasi workspace-knowledge.ts) --
        // WorkspaceFile.extractedSummary sendiri sudah dicap 4000 char di sumbernya
        // (workspace-files/route.ts), jadi 1500 lama membuang >60% isi yang sebenarnya
        // sudah lolos cap sumber. Signature fungsi TIDAK berubah (dipanggil dari
        // workspace-files/route.ts:127 milik B2 dan analyze/route.ts:285 di luar
        // scope B3 -- keduanya tetap kompatibel penuh).
        content: `${COMPANY_KNOWLEDGE_TAG} source="${sourceFileName}" | facts: ${factsSummary.slice(0, 4000)}`,
      },
    });
    // Non-fatal, fire-and-forget: dicatat SETELAH memoryItem berhasil dibuat, tidak
    // pernah menggagalkan penyimpanan company knowledge itu sendiri kalau gagal.
    void recordActivity(workspaceId, null, 'documents.company_knowledge_recorded', { sourceFileName });
  } catch (err) {
    console.warn('[CompanyMemory] gagal mencatat COMPANY_KNOWLEDGE ke memory (non-fatal):', err);
  }
}

/**
 * Ambil pengetahuan perusahaan yang terakumulasi dari upload-upload
 * dokumen sebelumnya (30 terakhir, digabung jadi 1 blok teks, potong
 * total ~8000 karakter). Return string kosong kalau belum ada apa-apa.
 * Non-fatal: query gagal -> return string kosong, tidak pernah throw.
 *
 * Cap dinaikkan 10->30 item / 3000->8000 char total (7 Sep 2026, integrasi
 * workspace-knowledge.ts) -- fungsi ini sekarang berperan RANGKAP: (a)
 * fallback lengkap untuk consumer yang belum sempat diintegrasikan ke
 * workspace-knowledge.ts (context-engine.ts, dipanggil brain/alerts dkk,
 * TIDAK diubah panggilannya di sesi ini -- di luar scope), dan (b) sumber
 * "pengetahuan dari lampiran chat" untuk workspace-knowledge.ts lewat
 * parameter `excludeSourceNames` di bawah.
 *
 * @param options.excludeSourceNames Set nama file (dari `source="..."` di
 *   tag [COMPANY_KNOWLEDGE]) yang HARUS DIBUANG dari hasil -- dipakai
 *   workspace-knowledge.ts untuk mencegah dobel-kirim data yang sumbernya
 *   SUDAH terbaca lewat WorkspaceFile.extractedSummary (lihat komentar
 *   panjang di workspace-knowledge.ts). Opsional & backward-compatible:
 *   pemanggil lama (context-engine.ts, 1 argumen saja) TIDAK terpengaruh
 *   sama sekali -- filter cuma jalan kalau argumen ini eksplisit dikirim.
 *   TIDAK menambah panggilan Prisma baru (masih 1 findMany yang sama,
 *   filter murni di memori/JS).
 */
export async function getAccumulatedCompanyKnowledge(
  workspaceId: string,
  options?: { excludeSourceNames?: Set<string> }
): Promise<string> {
  try {
    const items = await prisma.memoryItem.findMany({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: { startsWith: COMPANY_KNOWLEDGE_TAG },
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const excludeSet = options?.excludeSourceNames;
    const filtered =
      excludeSet && excludeSet.size > 0
        ? items.filter((item) => {
            const match = item.content.match(/source="([^"]*)"/);
            // Kalau format tag tidak match (harusnya tidak pernah terjadi, format
            // dikontrol recordCompanyKnowledge di atas) -- JANGAN diam-diam dibuang,
            // lebih aman ikutkan daripada kehilangan data tanpa alasan jelas.
            return !match || !excludeSet.has(match[1]);
          })
        : items;

    if (filtered.length === 0) return '';

    const combined = filtered
      .map((item, i) => `${i + 1}. ${item.content.replace(/^\[COMPANY_KNOWLEDGE\]\s*/, '')}`)
      .join('\n');

    return combined.slice(0, 8000);
  } catch (err) {
    console.warn('[CompanyMemory] gagal membaca accumulated company knowledge (non-fatal):', err);
    return '';
  }
}

/**
 * Hapus MemoryItem[COMPANY_KNOWLEDGE] untuk 1 atau beberapa nama file spesifik.
 * Dipanggil saat single file (atau zip child files) dihapus dari Pusat Data.
 */
export async function deleteCompanyKnowledgeByFile(
  workspaceId: string,
  sourceFileNames: string | string[]
): Promise<number> {
  try {
    const names = Array.isArray(sourceFileNames) ? sourceFileNames : [sourceFileNames];
    if (names.length === 0) return 0;

    let deletedTotal = 0;
    for (const name of names) {
      const res = await prisma.memoryItem.deleteMany({
        where: {
          workspaceId,
          scope: 'WORKSPACE',
          content: {
            startsWith: `${COMPANY_KNOWLEDGE_TAG} source="${name}"`,
          },
        },
      });
      deletedTotal += res.count;
    }
    return deletedTotal;
  } catch (err) {
    console.warn('[CompanyMemory] gagal menghapus company knowledge per file (non-fatal):', err);
    return 0;
  }
}

/**
 * Hapus SEMUA MemoryItem[COMPANY_KNOWLEDGE] milik workspace.
 * Dipanggil saat "Hapus Semua" file di Pusat Data dijalankan.
 */
export async function deleteAllCompanyKnowledge(workspaceId: string): Promise<number> {
  try {
    const res = await prisma.memoryItem.deleteMany({
      where: {
        workspaceId,
        scope: 'WORKSPACE',
        content: {
          startsWith: COMPANY_KNOWLEDGE_TAG,
        },
      },
    });
    return res.count;
  } catch (err) {
    console.warn('[CompanyMemory] gagal menghapus semua company knowledge (non-fatal):', err);
    return 0;
  }
}
