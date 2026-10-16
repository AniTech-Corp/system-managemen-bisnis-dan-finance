/** Intercept explicit creation, not discussion about media. No network side effects. */
export function stripMediaRoleContext(text: string) {
  return text.trim().replace(/^\[Konteks (?:Finansial\/Kas Bisnis|Marketing & Growth)\]:\s*/i, '');
}
export function detectMediaIntent(text: string): 'image' | 'audio' | 'video' | 'quiz' | 'flashcard' | null {
  const input = stripMediaRoleContext(text).toLowerCase();
  const command = input.match(/^(?:(?:tolong|bisa|bisakah|boleh|please|can you|mohon|coba|saya ingin|aku mau|gue mau)\s+)*(?:buat(?:kan)?|bikin(?:kan)?|generate|hasilkan|create|render)\b\s*([\s\S]*)/);
  if (!command) return null;
  const subject = command[1];
  // Naskah, konsep, ide, and prompts are ordinary text work, unless audio is explicitly requested.
  if (/^(?:(?:sebuah|satu|a|an|\d+)\s+)?(?:naskah|skrip|script|konsep|ide|prompt|deskripsi|copywriting)\b/.test(subject)) return null;
  if (/\b(quiz|kuis)\b/.test(input)) return 'quiz';
  if (/\b(flashcards?|flashcard|kartu belajar)\b/.test(input)) return 'flashcard';
  if (/\b(audio|voiceover|voice-over|mp3|tts|sulih suara)\b/.test(input)) return 'audio';
  if (/\b(video|reels|tiktok|storyboard)\b/.test(input)) return 'video';
  // 'visual' dan 'desain' dikembalikan dari heuristik asli Fatur di brain/chat
  // (origin/main baris 475 dan 477). Sempat hilang waktu deteksi niat dipindah
  // ke modul ini, sehingga kalimat seperti "buatkan visual promosi toko" tidak
  // lagi menghasilkan gambar. Gerbang kata kerja di atas TETAP dipertahankan,
  // karena itu yang mencegah kalimat biasa ikut memicu pembuatan gambar.
  if (/\b(gambar|image|poster|banner|foto|thumbnail|ilustrasi|logo|visual|desain)\b/.test(input)) return 'image';
  return null;
}
