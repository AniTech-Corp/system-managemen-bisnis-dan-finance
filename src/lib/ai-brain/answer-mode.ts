/**
 * Mode-Trigger -- KLIR AI Brain, dipakai di LAPIS 4 (OUTPUT INTEGRITY) dari
 * dynamicSystemInstruction (lihat src/app/api/v1/brain/chat/route.ts).
 *
 * Mode dikenali dari CARA pengguna bertanya, BUKAN dari toggle pengaturan
 * yang harus dipilih manual di UI. Dua mode:
 *
 *   - JAWABAN   : pertanyaan pendek/langsung, tidak ada tanda bingung
 *                 -> jawab RINGKAS, angka/kesimpulan di depan.
 *   - PEMAHAMAN : ada tanda bingung ("kenapa", "gimana caranya",
 *                 "saya belum paham", "maksudnya apa", dst)
 *                 -> jelaskan BERTAHAP, pakai analogi dari dunia usaha
 *                 pengguna, baru simpulkan di akhir.
 *
 * Berkas BARU milik tim AI (bukan berkas Fatur) -- dipisah dari
 * brain/chat/route.ts sengaja supaya (a) bisa diuji terpisah tanpa perlu
 * mem-boot seluruh route Next.js, dan (b) jejak perubahan di berkas Fatur
 * tetap kecil (route.ts cuma memanggil 2 fungsi dari sini).
 *
 * Deteksinya SENGAJA sederhana: daftar pola kata kunci (regex), bukan model
 * bahasa terpisah -- supaya gampang diuji dan gampang ditelusuri KENAPA
 * suatu pesan jatuh ke mode tertentu (lihat `matchedSignal` di hasil).
 */

export type AnswerMode = 'JAWABAN' | 'PEMAHAMAN';

export interface AnswerModeDetection {
  mode: AnswerMode;
  /** Pola/kata kunci yang memicu PEMAHAMAN; null kalau jatuh ke default JAWABAN. */
  matchedSignal: string | null;
}

/**
 * Anchor literal dari brief tugas: "kenapa", "gimana caranya",
 * "saya belum paham", "maksudnya apa" -- ditambah variasi wajar (bahasa gaul,
 * "mengapa", "aku"/"gue"/"gua", "ngerti" vs "paham", "tolong jelaskan") supaya
 * deteksi tidak terlalu getas ke satu kalimat literal saja.
 *
 * Urutan dicek dari atas ke bawah, berhenti di kecocokan PERTAMA -- cukup
 * untuk kebutuhan ini karena semua pola sama-sama berarti "pengguna bingung",
 * tidak ada prioritas antar pola yang perlu dibedakan.
 */
const CONFUSION_SIGNALS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  { pattern: /\bkenapa\b/i, label: 'kenapa' },
  { pattern: /\bmengapa\b/i, label: 'mengapa' },
  { pattern: /\b(gimana|bagaimana)(nya)?\s+cara(nya)?\b/i, label: 'gimana caranya' },
  { pattern: /\bcara(nya)?\s+(gimana|bagaimana)\b/i, label: 'caranya gimana' },
  { pattern: /\b(saya|aku|gue|gua)\s+(masih\s+)?belum\s+(paham|ngerti)\b/i, label: 'saya belum paham' },
  { pattern: /\b(masih\s+)?belum\s+(paham|ngerti)\b/i, label: 'belum paham' },
  { pattern: /\bmaksud(nya)?\s+apa\b/i, label: 'maksudnya apa' },
  { pattern: /\bapa\s+maksud(nya)?\b/i, label: 'apa maksudnya' },
  { pattern: /\btolong\s+jelas(kan|in)\b/i, label: 'tolong jelaskan' },
  { pattern: /\bjelas(kan|in)\s+(dong|donk|ya)\b/i, label: 'jelaskan dong' },
];

/**
 * Deteksi mode dari satu pesan pengguna. Pure function, tidak menyentuh
 * database/network -- aman dipanggil sinkron di route handler.
 */
export function detectAnswerMode(message: string | null | undefined): AnswerModeDetection {
  const text = typeof message === 'string' ? message : '';
  for (const signal of CONFUSION_SIGNALS) {
    if (signal.pattern.test(text)) {
      return { mode: 'PEMAHAMAN', matchedSignal: signal.label };
    }
  }
  return { mode: 'JAWABAN', matchedSignal: null };
}

/**
 * Teks instruksi yang disuntikkan ke dynamicSystemInstruction (LAPIS 4:
 * OUTPUT INTEGRITY) sesuai mode yang terdeteksi. `workspaceName` opsional,
 * cuma dipakai untuk kalimat analogi di mode PEMAHAMAN -- fungsi ini tetap
 * jalan tanpanya (fallback ke "bisnis pengguna").
 */
export function getAnswerModeInstruction(
  detection: AnswerModeDetection,
  workspaceName?: string | null
): string {
  if (detection.mode === 'PEMAHAMAN') {
    const bizPhrase = workspaceName ? `bisnis ${workspaceName}` : 'bisnis pengguna';
    return `MODE PEMAHAMAN (terdeteksi dari tanda bingung: "${detection.matchedSignal}") -- pengguna butuh dijelasin, bukan cuma dikasih angka. Jelaskan BERTAHAP: (1) mulai dari konteks/kenapa hal ini relevan buat ${bizPhrase}, (2) pakai analogi dari dunia usaha sehari-hari kalau membantu, (3) baru di kalimat terakhir simpulkan jawaban/angkanya. JANGAN lompat langsung ke kesimpulan di kalimat pertama.`;
  }
  return 'MODE JAWABAN (pertanyaan langsung, tidak ada tanda bingung) -- jawab RINGKAS: angka/kesimpulan di depan, penjelasan pendukung secukupnya di belakang kalau memang perlu. Jangan bertele-tele.';
}
