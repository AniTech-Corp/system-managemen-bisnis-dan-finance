/**
 * Tone presets — gaya bahasa opsional untuk AI Brain (chat + generation-engine).
 *
 * Sumber: hasil scan preferensi bahasa dari knowledge base internal (sudah digenerikkan
 * lintas-perusahaan, tidak spesifik ke satu tenant/pengguna mana pun). Dipakai sebagai instruksi
 * tambahan opsional yang disisipkan ke system instruction / prompt AI — TIDAK menggantikan
 * instruksi yang sudah ada.
 *
 * Catatan kontradiksi yang sengaja dipertahankan (lihat masing-masing description):
 * beberapa preset sama-sama menyebut dirinya "formal" tapi menuntut format berbeda
 * tergantung siapa pembaca akhirnya (internal vs eksternal). Ini bukan bug — dua sumber
 * memang berbeda pendapat, dan presetnya dibiarkan terpisah alih-alih digabung diam-diam.
 */

export interface TonePreset {
  id: string;
  label: string;
  description: string;
  instructionSnippet: string;
}

export const TONE_PRESETS: TonePreset[] = [
  {
    id: 'gen-z-casual',
    label: 'Santai Gen Z',
    description:
      'Gaya obrolan kasual anak muda: kalimat pendek langsung ke poin, sapa pembaca secara personal, sisipan bahasa gaul wajar. Catatan kontradiksi: aturan formal-ASCII dari sumber lain bilang deliverable apa pun wajib nol emoji, tapi skill brand-voice dari sumber yang sama tetap memakai emoji (maksimal sekitar 3) di caption/slide sebagai konten sosial final — jadi "boleh emoji" di preset ini cuma berlaku kalau outputnya memang konten kasual/sosial, bukan dokumen formal.',
    instructionSnippet:
      'Tulis dengan nada santai dan personal seolah ngobrol langsung ke satu orang pembaca, pakai kalimat pendek yang to the point, sapa pembaca secara langsung, dan wajar saja menyisipkan ungkapan sehari-hari yang lebih santai daripada bahasa baku kaku. Hindari basa-basi pembuka yang panjang, langsung ke masalah atau poin utamanya.',
  },
  {
    id: 'clean-formal-ascii',
    label: 'Formal Bersih ASCII',
    description:
      'Untuk dokumen/kontrak/prompt internal yang akan disalin, diparse, atau dieksekusi sistem: teks Latin/ASCII polos, tanda baca standar, markdown dan daftar bernomor tetap boleh dipakai untuk struktur, tapi nol emoji dan nol glyph dekoratif (panah unicode, bullet-titik, simbol matematika, angka-lingkaran, checklist unicode) — diganti notasi ASCII biasa.',
    instructionSnippet:
      'Tulis memakai karakter dan tanda baca standar saja, tanpa emoji dan tanpa simbol dekoratif seperti panah unicode, bullet titik bulat, simbol matematika, angka dalam lingkaran, atau tanda centang/silang unicode — ganti dengan notasi polos seperti tanda panah dua karakter, tanda hubung, atau angka dalam kurung. Struktur dengan heading dan daftar bernomor tetap boleh dipakai selama tujuannya dokumen atau instruksi teknis yang akan diproses lebih lanjut, bukan konten yang dibaca casual.',
  },
  {
    id: 'flowing-prose-external',
    label: 'Prosa Mengalir untuk Pihak Luar',
    description:
      'Untuk teks/prompt yang akan dikirim keluar ke organisasi, AI, atau orang lain di luar sistem: paragraf mengalir dengan tanda baca normal, TANPA heading pagar atau bullet dash bertumpuk (beda dari preset clean-formal-ascii yang justru mengizinkan markdown/heading untuk dokumen internal) — sumbernya sama-sama menyebut dirinya "formal" tapi menuntut hasil berbeda tergantung siapa pembacanya, jadi ini kontradiksi eksplisit yang perlu dikenali, bukan digabung diam-diam. Daftar bernomor tetap boleh untuk breakdown, tapi bentuknya angka literal dalam kalimat, bukan bullet list markdown.',
    instructionSnippet:
      'Tulis sebagai paragraf yang mengalir dengan tanda baca dan huruf kapital normal, bukan sebagai daftar heading atau bullet bertumpuk. Kalau perlu memecah beberapa langkah konkret, pakai penomoran literal di dalam kalimat, dan tiap nomor sebutkan secara spesifik apa yang harus dikerjakan, bukan instruksi umum yang samar. Hindari juga simbol dekoratif seperti emoji atau panah unicode supaya bacaannya terasa alami, bukan seperti dokumen teknis.',
  },
  {
    id: 'professional-warm',
    label: 'Profesional tapi Personal',
    description:
      'Untuk dokumen bisnis ke pihak eksternal (klien, mitra, tim lintas-perusahaan): tetap terstruktur dan profesional, tapi kalimat penutup atau bagian ajakan bertindak wajib aktif-personal, bukan pasif-menyerah yang cuma bilang "mungkin belum final" tanpa jalan keluar — ini koreksi langsung atas draft nyata yang dianggap terlalu pasif oleh pemilik proyek.',
    instructionSnippet:
      'Jaga struktur dan bahasa tetap profesional dan jelas untuk pembaca bisnis, tapi tutup bagian ajakan bertindak atau kontak dengan nada personal dan aktif, mengundang pembaca menghubungi langsung kalau ada yang belum terjawab, bukan kalimat pasif yang hanya menyiratkan ketidakpastian tanpa memberi jalan keluar. Hindari juga bahasa korporat generik yang terasa seperti template kosong.',
  },
  {
    id: 'anti-ai-natural',
    label: 'Natural, Bukan Kayak AI',
    description:
      'Lapisan pemeriksaan akhir yang berlaku lintas semua register (formal maupun santai): buang ciri khas tulisan AI seperti kosakata inflatif, tanda pisah em-dash berlebihan, pembuka generik, kelompok tiga yang dipaksakan, dan bahasa sok-ramah — dipakai sebagai pass terakhir setelah draft ditulis dengan preset gaya bahasa manapun di atas.',
    instructionSnippet:
      'Setelah draf selesai, baca ulang dan hilangkan ciri tulisan AI seperti kosakata berlebihan (kata-kata muluk yang menyiratkan pentingnya sesuatu secara berlebihan), tanda pisah panjang yang dipakai berulang-ulang, kalimat pembuka generik yang basa-basi, pengelompokan tiga hal yang dipaksakan biar terlihat lengkap, dan nada sok-ramah atau menyanjung berlebihan. Ganti dengan kalimat yang bervariasi panjangnya, spesifik, dan punya sudut pandang jelas.',
  },
];

/**
 * Cari instructionSnippet berdasarkan toneId. Kalau toneId kosong/tidak ketemu,
 * kembalikan string kosong — TIDAK error, TIDAK mengarang preset baru.
 */
export function getToneInstruction(toneId?: string): string {
  if (!toneId) return '';
  const preset = TONE_PRESETS.find((p) => p.id === toneId);
  return preset ? preset.instructionSnippet : '';
}
