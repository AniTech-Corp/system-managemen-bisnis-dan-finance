/**
 * KLIR AI Brain -- Mode Asisten (11 Sep 2026, KOMANDO Fable 5.1, B3_AI knowledge).
 *
 * CATATAN RACE CONDITION (ditulis ulang B3_AI setelah ketahuan): file ini
 * sempat DITIMPA sementara oleh stub agent B2 (backend-chat-route, dibuat
 * paralel karena B2 juga butuh modul ini untuk tsc lokalnya SEBELUM implementasi
 * asli B3 ini sempat ditulis ke disk). Versi INI adalah implementasi ASLI B3 --
 * kalau versi stub ("STUB B2") muncul lagi di sesi berikutnya, itu tanda race
 * yang SAMA terulang (dua agent menulis file yang sama secara paralel), BUKAN
 * B3 lupa mengimplementasikan modul ini.
 *
 * Latar belakang (context pack seksi 3F -- keluhan Mecca #7 "mode riset/belajar/
 * analis: framework matang"): sebelum modul ini, KLIR sudah punya beberapa sinyal
 * mode YANG TERPISAH-PISAH (composer chip Riset, answer-mode.ts JAWABAN/PEMAHAMAN,
 * persona-skin per role) tapi TIDAK ADA satu SSOT "mode asisten" yang memetakan
 * pilihan user (tanya/riset/belajar/analis) ke instruksi prompt + effort floor +
 * pemicu riset paksa sekaligus. Modul ini murni PETA/KEBIJAKAN -- TIDAK memanggil
 * LLM, TIDAK menyentuh Prisma, TIDAK fetch apapun -- supaya AMAN diimpor dari
 * komponen client (ComposerToolbar dkk, milik B4) untuk menampilkan
 * label/deskripsi mode yang identik dengan yang dipakai server (route.ts, B2).
 *
 * KONTRAK KERAS "PURE" (context pack seksi 4, kontrak modul 3): nol import
 * node-only, nol process.env di top-level (dan sebenarnya nol process.env sama
 * sekali di file ini) -- diverifikasi manual: hanya literal string/objek, tidak
 * ada import lain di file ini.
 */

/** 4 mode yang bisa dipilih user di composer (chip Tanya/Riset/Belajar/Analis). */
export type AssistantMode = 'tanya' | 'riset' | 'belajar' | 'analis';

export const ASSISTANT_MODES: ReadonlyArray<AssistantMode> = ['tanya', 'riset', 'belajar', 'analis'];

/** Label + deskripsi singkat per mode -- dipakai UI (chip, tooltip) DAN dasar
 * instruksi di getAssistantModeInstruction() supaya makna satu mode konsisten
 * di seluruh permukaan (composer, dokumentasi internal, prompt LLM). */
export const ASSISTANT_MODE_LABEL: Record<AssistantMode, { label: string; desc: string }> = {
  tanya: {
    label: 'Tanya',
    desc: 'Jawaban langsung dan ringkas untuk pertanyaan sehari-hari.',
  },
  riset: {
    label: 'Riset',
    desc: 'Jawaban dengan sumber & tingkat ketidakpastian eksplisit; memaksa riset web.',
  },
  belajar: {
    label: 'Belajar',
    desc: 'Penjelasan bertahap dengan analogi, ditutup 1 latihan/pertanyaan cek pemahaman.',
  },
  analis: {
    label: 'Analis',
    desc: 'Angka dulu, tabel, asumsi eksplisit, rekomendasi berperingkat, dan risiko.',
  },
};

/**
 * Terima input APAPUN (biasanya body.assistantMode dari request chat, bentuknya
 * `unknown` karena datang dari JSON client yang tidak dipercaya bentuknya) dan
 * kembalikan AssistantMode yang VALID. Default 'tanya' kalau raw bukan salah
 * satu dari 4 mode yang dikenal (termasuk undefined/null/tipe salah/typo) --
 * fail-safe ke mode paling ringan, BUKAN melempar error.
 */
export function resolveAssistantMode(raw: unknown): AssistantMode {
  if (typeof raw === 'string' && (ASSISTANT_MODES as readonly string[]).includes(raw)) {
    return raw as AssistantMode;
  }
  return 'tanya';
}

/**
 * Instruksi tambahan (Bahasa Indonesia) yang disuntikkan ke LAPIS 4 system
 * prompt (route.ts, B2) SETELAH modeInstruction (answer-mode.ts) yang sudah
 * ada -- keduanya melengkapi, bukan saling menggantikan (answer-mode mengatur
 * PANJANG/gaya jawaban JAWABAN vs PEMAHAMAN; assistant-modes mengatur PENDEKATAN
 * pedagogis/analitis/riset). workspaceName opsional murni untuk membuat kalimat
 * instruksi lebih personal, tidak mengubah makna instruksi kalau kosong/null.
 */
export function getAssistantModeInstruction(mode: AssistantMode, workspaceName?: string | null): string {
  const ws = workspaceName && workspaceName.trim() ? workspaceName.trim() : 'workspace ini';
  switch (mode) {
    case 'belajar':
      return (
        `MODE BELAJAR: jelaskan bertahap (langkah demi langkah), asumsikan pengguna ${ws} baru ` +
        'mengenal topik ini. Pakai minimal 1 analogi sederhana dari kehidupan sehari-hari/bisnis ' +
        'UMKM supaya mudah dicerna. Tutup jawaban dengan 1 latihan singkat atau pertanyaan cek ' +
        'pemahaman untuk pengguna.'
      );
    case 'analis':
      return (
        'MODE ANALIS: mulai jawaban dengan angka (kalau tersedia data), sajikan dalam tabel bila ' +
        `relevan untuk ${ws}, sebutkan ASUMSI secara eksplisit, beri rekomendasi BERPERINGKAT ` +
        '(prioritas tinggi ke rendah), dan sebutkan RISIKO dari tiap rekomendasi.'
      );
    case 'riset':
      return (
        'MODE RISET: jawaban WAJIB menyebutkan sumber informasi (nama situs/dokumen) dan tingkat ' +
        'ketidakpastian jawaban secara eksplisit. JANGAN mengarang sumber -- kalau riset tidak ' +
        'tersedia/gagal, katakan jujur bahwa jawaban ini belum berbasis riset terkini.'
      );
    case 'tanya':
    default:
      return 'MODE TANYA: jawab ringkas dan langsung ke inti pertanyaan, hindari bertele-tele.';
  }
}

/**
 * Efek default 1 mode terhadap effort & riset -- dipakai route.ts (B2) untuk
 * MENAIKKAN (tidak pernah menurunkan) effort otomatis dari classifyEffort()
 * (auto-effort.ts, milik B1), dan untuk memutuskan apakah jalur riset web WAJIB
 * dipaksa aktif walau user tidak eksplisit memilih chip Riset di composer.
 */
export function assistantModeDefaults(
  mode: AssistantMode
): { effortFloor: 'santai' | 'normal' | 'serius'; forceResearch?: 'web' } {
  switch (mode) {
    case 'riset':
      return { effortFloor: 'serius', forceResearch: 'web' };
    case 'analis':
      return { effortFloor: 'serius' };
    case 'belajar':
      return { effortFloor: 'normal' };
    case 'tanya':
    default:
      return { effortFloor: 'santai' };
  }
}
