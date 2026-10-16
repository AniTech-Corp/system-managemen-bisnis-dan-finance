/**
 * Video brief / storyboard templates - struktur scene deterministik untuk permintaan
 * "penawaran/proposal disertai video ber-voice-over" (temuan demo ke calon klien pertama, 5 Sep 2026).
 *
 * PENTING, jujur ke pengguna: KLIR belum bisa merender video secara otomatis
 * (lihat src/lib/media-provider.ts -> plannedVideo(), status selalu 'planned').
 * Template di file ini TIDAK menjanjikan video jadi. Yang dihasilkan adalah BRIEF
 * PRODUKSI: urutan scene, visual yang disarankan, teks layar, dan arahan naskah
 * voice-over - siap dieksekusi manusia (videografer/editor) atau alat pembuat
 * video lain di luar KLIR.
 *
 * Pola file ini sama dengan src/lib/industry-image-templates.ts: data template
 * deterministik (bukan tebakan LLM) + fungsi resolve + fungsi builder instruksi.
 * Struktur scene (jumlah, urutan, tujuan tiap scene) DITENTUKAN DI SINI, bukan oleh
 * LLM. LLM (di fase integrate nanti) hanya mengisi kalimat naskah/teks layar yang
 * spesifik sesuai brief pengguna, mengikuti arahan tiap scene.
 *
 * NOL panggilan LLM di file ini - murni data + fungsi sinkron.
 */

export type VideoBriefTemplateId =
  | 'video-penawaran-produk'
  | 'video-profil-usaha'
  | 'video-penjelasan-fitur'
  | 'video-testimoni-pelanggan';

/** Satu scene dalam storyboard. Field *Saran = arahan untuk pengisi konten (manusia
 *  atau LLM di fase integrate), bukan naskah final yang sudah jadi. */
export interface VideoBriefScene {
  nomor: number;
  tujuan: string;
  durasiDetikSaran: number;
  visualSaran: string;
  teksLayarSaran: string;
  arahanNaskahVoiceOver: string;
}

export interface VideoBriefTemplate {
  id: VideoBriefTemplateId;
  label: string;
  deskripsi: string;
  cocokUntuk: string;
  durasiTotalDetikSaran: number;
  platformSaran: string;
  scenes: VideoBriefScene[];
  aturanKhusus: string[];
}

/** Aturan yang berlaku untuk SEMUA template video, di luar aturan khusus per-template. */
export const VIDEO_BRIEF_ATURAN_UNIVERSAL: string[] = [
  'Hook wajib ada di 3 detik pertama - penonton memutuskan lanjut atau skip dalam 3 detik itu.',
  'Satu video = satu pesan utama. Jangan gabung beberapa pesan besar dalam satu video.',
  'Ajakan bertindak (CTA) wajib eksplisit di penutup - sebutkan tindakan konkret (hubungi, kunjungi, pesan, coba), jangan cuma "terima kasih".',
  'Dilarang menjanjikan hasil/angka yang tidak bisa dibuktikan atau diverifikasi (contoh: "dijamin laku", "pasti untung", "nomor satu se-Indonesia") kecuali user memang punya data yang mendukung klaim itu.',
  'Bahasa naskah = bahasa Indonesia natural yang diucapkan, bukan bahasa tulisan formal yang kaku dibaca lantang.',
  'Setiap scene wajib punya durasi target - total durasi scene dijumlah harus mendekati durasiTotalDetikSaran template.',
];

/** Catatan status produk - WAJIB disertakan tiap kali brief ini ditampilkan/dipakai,
 *  supaya ekspektasi pengguna soal "video jadi" tidak salah arah. */
export const VIDEO_BRIEF_CATATAN_STATUS_PRODUK: string =
  'Render video otomatis belum tersedia di KLIR. Keluaran ini adalah brief/storyboard produksi ' +
  '(urutan scene, visual, teks layar, arahan naskah voice-over) yang siap dieksekusi videografer, ' +
  'editor, atau alat pembuat video lain di luar KLIR - bukan file video jadi.';

export const VIDEO_BRIEF_TEMPLATES: Record<VideoBriefTemplateId, VideoBriefTemplate> = {
  'video-penawaran-produk': {
    id: 'video-penawaran-produk',
    label: 'Video Penawaran Produk/Jasa',
    deskripsi:
      'Video pendek untuk menawarkan produk/jasa ke calon pelanggan atau calon klien, melengkapi dokumen penawaran/invoice tertulis.',
    cocokUntuk:
      'Pitch produk baru, promo terbatas, penawaran ke calon klien B2B setelah surat penawaran dikirim.',
    durasiTotalDetikSaran: 45,
    platformSaran: 'Vertikal 9:16 untuk WhatsApp/Instagram/TikTok, atau 16:9 kalau disisipkan ke slide presentasi.',
    scenes: [
      {
        nomor: 1,
        tujuan: 'Hook - tangkap perhatian dengan masalah/pertanyaan yang relevan buat calon pelanggan.',
        durasiDetikSaran: 3,
        visualSaran: 'Close-up momen masalah yang relate, atau produk dalam kondisi menarik perhatian.',
        teksLayarSaran: 'Satu kalimat pertanyaan atau pernyataan masalah, singkat.',
        arahanNaskahVoiceOver:
          'Satu kalimat yang memancing rasa relevan/penasaran terhadap masalah target pelanggan. Jangan sebut nama produk dulu di scene ini.',
      },
      {
        nomor: 2,
        tujuan: 'Perkenalkan solusi - hubungkan masalah di scene 1 dengan produk/jasa yang ditawarkan.',
        durasiDetikSaran: 8,
        visualSaran: 'Produk/jasa ditampilkan jelas, sedang dipakai atau ditunjukkan detailnya.',
        teksLayarSaran: 'Nama produk/jasa + satu kalimat manfaat utama.',
        arahanNaskahVoiceOver: 'Perkenalkan produk/jasa sebagai jawaban langsung atas masalah di scene sebelumnya.',
      },
      {
        nomor: 3,
        tujuan: 'Nilai pembeda - kenapa produk/jasa ini beda dari alternatif lain.',
        durasiDetikSaran: 10,
        visualSaran: 'Demo fitur unggulan atau proses kerja yang jadi pembeda, tunjukkan bukan cuma diceritakan.',
        teksLayarSaran: '1-2 poin pembeda utama, singkat dan konkret.',
        arahanNaskahVoiceOver:
          'Sebutkan maksimal 2 pembeda paling kuat sesuai brief user - jangan mendaftar semua fitur sekaligus.',
      },
      {
        nomor: 4,
        tujuan: 'Penawaran - detail harga/promo/syarat yang berlaku, selaras dengan dokumen penawaran tertulis.',
        durasiDetikSaran: 10,
        visualSaran: 'Grafis harga/promo yang jelas terbaca, atau produk dengan label penawaran.',
        teksLayarSaran: 'Angka harga/promo dan syarat berlaku (kalau ada masa berlaku, wajib disebut).',
        arahanNaskahVoiceOver:
          'Sebutkan penawaran sesuai angka yang diberikan user di brief - JANGAN mengarang angka harga/diskon sendiri.',
      },
      {
        nomor: 5,
        tujuan: 'Ajakan bertindak - dorong calon pelanggan menghubungi/memesan sekarang.',
        durasiDetikSaran: 6,
        visualSaran: 'Logo/kontak/kode QR atau tombol pemesanan, jelas dan mudah dibaca.',
        teksLayarSaran: 'Cara menghubungi/memesan (nomor WA, link, atau nama akun).',
        arahanNaskahVoiceOver: 'Ajakan bertindak eksplisit sesuai kontak yang diberikan user, sebut batas waktu kalau ada.',
      },
    ],
    aturanKhusus: [
      'Angka harga/promo/diskon WAJIB berasal dari brief atau dokumen penawaran user - dilarang mengarang nominal.',
      'Kalau penawaran punya masa berlaku (expiry), wajib disebut eksplisit di scene penawaran dan/atau CTA.',
    ],
  },

  'video-profil-usaha': {
    id: 'video-profil-usaha',
    label: 'Video Profil Usaha',
    deskripsi:
      'Video perkenalan usaha/perusahaan - siapa, bergerak di bidang apa, kenapa layak dipercaya. Cocok dilampirkan ke dokumen presentasi/proposal untuk calon investor atau klien baru.',
    cocokUntuk:
      'Company profile untuk calon klien/investor, konten "kenalan dulu" di media sosial usaha.',
    durasiTotalDetikSaran: 75,
    platformSaran: '16:9 untuk website/presentasi, atau 9:16 versi ringkas untuk media sosial.',
    scenes: [
      {
        nomor: 1,
        tujuan: 'Hook - suasana usaha yang menarik perhatian di awal.',
        durasiDetikSaran: 3,
        visualSaran: 'Cuplikan suasana usaha yang paling representatif (tempat, produk, atau aktivitas utama).',
        teksLayarSaran: 'Nama usaha.',
        arahanNaskahVoiceOver: 'Kalimat pembuka singkat yang menangkap identitas usaha, bukan sejarah panjang dulu.',
      },
      {
        nomor: 2,
        tujuan: 'Latar belakang - kapan berdiri dan kenapa usaha ini ada.',
        durasiDetikSaran: 12,
        visualSaran: 'Foto/klip tempat usaha, produk, atau tim, disesuaikan brief user.',
        teksLayarSaran: 'Tahun berdiri (kalau ada) + satu kalimat latar belakang.',
        arahanNaskahVoiceOver: 'Latar belakang singkat sesuai fakta dari brief user - jangan mengarang tahun/cerita.',
      },
      {
        nomor: 3,
        tujuan: 'Apa yang dikerjakan usaha ini dan manfaatnya untuk pelanggan.',
        durasiDetikSaran: 15,
        visualSaran: 'Proses kerja, produk, atau layanan sedang berjalan.',
        teksLayarSaran: 'Ringkasan bidang usaha dalam satu kalimat.',
        arahanNaskahVoiceOver: 'Jelaskan bidang usaha dan manfaat konkret ke pelanggan, hindari klaim generik seperti "terbaik".',
      },
      {
        nomor: 4,
        tujuan: 'Kredibilitas - tim, proses, atau fasilitas yang menunjukkan usaha ini serius/terpercaya.',
        durasiDetikSaran: 15,
        visualSaran: 'Tim bekerja, fasilitas, peralatan, atau sertifikasi (kalau ada dan sah).',
        teksLayarSaran: 'Angka faktual kalau ada (jumlah cabang, tahun pengalaman, jumlah pelanggan) - hanya jika user berikan angka nyata.',
        arahanNaskahVoiceOver:
          'Sebutkan hal konkret yang menunjukkan kredibilitas - HANYA angka/fakta yang diberikan user di brief, jangan mengarang statistik.',
      },
      {
        nomor: 5,
        tujuan: 'Ajakan bertindak - dorong penonton kerja sama, kunjungi, atau hubungi usaha ini.',
        durasiDetikSaran: 10,
        visualSaran: 'Logo, alamat, atau kontak usaha ditampilkan jelas.',
        teksLayarSaran: 'Kontak/alamat/tautan usaha.',
        arahanNaskahVoiceOver: 'Ajakan bertindak yang jelas, sebut cara menghubungi sesuai brief user.',
      },
    ],
    aturanKhusus: [
      'Semua angka pencapaian (jumlah cabang, tahun berdiri, jumlah pelanggan, dsb) wajib berasal dari brief user - dilarang mengarang statistik untuk kesan meyakinkan.',
      'Kalau usaha punya lebih dari satu entitas/badan hukum, sebutkan sesuai brief - jangan mencampur identitas entitas yang berbeda jadi satu klaim.',
    ],
  },

  'video-penjelasan-fitur': {
    id: 'video-penjelasan-fitur',
    label: 'Video Penjelasan Fitur',
    deskripsi:
      'Video pendek yang menjelaskan satu fitur/produk secara ringkas - masalah, cara pakai, manfaat. Cocok untuk onboarding pelanggan baru atau demo fitur ke calon klien.',
    cocokUntuk: 'Demo fitur produk/aplikasi, tutorial singkat cara pakai layanan.',
    durasiTotalDetikSaran: 40,
    platformSaran: 'Vertikal 9:16 untuk media sosial, atau layar penuh screen-recording kalau fiturnya digital.',
    scenes: [
      {
        nomor: 1,
        tujuan: 'Hook - tunjukkan masalah yang dialami pengguna sebelum fitur ini ada.',
        durasiDetikSaran: 3,
        visualSaran: 'Situasi repot/masalah yang relate dengan target pengguna fitur ini.',
        teksLayarSaran: 'Satu kalimat masalah.',
        arahanNaskahVoiceOver: 'Satu kalimat masalah yang langsung dikenali target pengguna fitur ini.',
      },
      {
        nomor: 2,
        tujuan: 'Perkenalkan fitur sebagai jawaban atas masalah tersebut.',
        durasiDetikSaran: 7,
        visualSaran: 'Tampilan fitur (screen-recording atau demo produk fisik).',
        teksLayarSaran: 'Nama fitur.',
        arahanNaskahVoiceOver: 'Perkenalkan nama fitur dan satu kalimat apa fungsinya.',
      },
      {
        nomor: 3,
        tujuan: 'Cara pakai - langkah-langkah singkat menggunakan fitur ini.',
        durasiDetikSaran: 15,
        visualSaran: 'Demo langkah demi langkah, maksimal 3 langkah supaya tidak terasa rumit.',
        teksLayarSaran: 'Nomor langkah (Langkah 1, 2, 3) muncul sinkron dengan visual.',
        arahanNaskahVoiceOver: 'Jelaskan langkah pakai fitur secara berurutan, maksimal 3 langkah, bahasa sederhana.',
      },
      {
        nomor: 4,
        tujuan: 'Manfaat konkret setelah fitur ini dipakai.',
        durasiDetikSaran: 8,
        visualSaran: 'Hasil akhir/kondisi setelah fitur dipakai, kontras dengan masalah di scene 1.',
        teksLayarSaran: 'Satu kalimat manfaat utama.',
        arahanNaskahVoiceOver: 'Sebutkan manfaat konkret yang langsung terasa, hindari klaim yang tidak bisa dibuktikan.',
      },
      {
        nomor: 5,
        tujuan: 'Ajakan bertindak - dorong penonton mencoba fitur ini.',
        durasiDetikSaran: 7,
        visualSaran: 'Tombol/tautan/cara akses fitur ditampilkan jelas.',
        teksLayarSaran: 'Cara mengakses fitur.',
        arahanNaskahVoiceOver: 'Ajakan mencoba fitur sekarang, sebut cara akses sesuai brief user.',
      },
    ],
    aturanKhusus: [
      'Langkah cara pakai dibatasi maksimal 3 langkah di naskah - detail teknis lebih lanjut cukup disebut ada di dokumentasi/bantuan, bukan dijejalkan ke video pendek.',
      'Dilarang klaim manfaat berupa angka (contoh: "hemat waktu 50 persen") kecuali angka itu berasal dari data yang diberikan user di brief.',
    ],
  },

  'video-testimoni-pelanggan': {
    id: 'video-testimoni-pelanggan',
    label: 'Video Testimoni Pelanggan',
    deskripsi:
      'Video yang menampilkan pengalaman pelanggan nyata memakai produk/jasa - dari masalah sebelum pakai sampai hasil setelah pakai. Kredibel karena bersumber dari cerita nyata, bukan klaim sepihak usaha.',
    cocokUntuk: 'Bukti sosial untuk melengkapi penawaran/proposal, konten kepercayaan di media sosial.',
    durasiTotalDetikSaran: 45,
    platformSaran: 'Vertikal 9:16 untuk media sosial, format wawancara natural (bukan skrip kaku dibaca).',
    scenes: [
      {
        nomor: 1,
        tujuan: 'Hook - perkenalan singkat pelanggan yang memberi testimoni.',
        durasiDetikSaran: 3,
        visualSaran: 'Pelanggan tampil natural, disebutkan namanya (dengan izin pelanggan tersebut).',
        teksLayarSaran: 'Nama dan peran/usaha pelanggan (kalau bersedia dicantumkan).',
        arahanNaskahVoiceOver:
          'Perkenalan singkat pelanggan sesuai data yang diberikan user di brief - HANYA cantumkan nama/identitas kalau ada izin eksplisit dari pelanggan tersebut.',
      },
      {
        nomor: 2,
        tujuan: 'Masalah yang dialami pelanggan sebelum memakai produk/jasa.',
        durasiDetikSaran: 10,
        visualSaran: 'Pelanggan bercerita natural, bisa disisipi ilustrasi masalah yang dimaksud.',
        teksLayarSaran: 'Kutipan singkat masalah yang dialami.',
        arahanNaskahVoiceOver: 'Ceritakan masalah nyata yang dialami pelanggan sebelum pakai, sesuai cerita di brief.',
      },
      {
        nomor: 3,
        tujuan: 'Pengalaman memakai produk/jasa - apa yang dirasakan selama proses.',
        durasiDetikSaran: 12,
        visualSaran: 'Cuplikan proses pemakaian atau interaksi dengan usaha.',
        teksLayarSaran: 'Kutipan singkat pengalaman positif.',
        arahanNaskahVoiceOver: 'Ceritakan pengalaman memakai produk/jasa secara natural, hindari bahasa iklan yang terdengar dibuat-buat.',
      },
      {
        nomor: 4,
        tujuan: 'Hasil/perubahan konkret yang dirasakan setelah memakai produk/jasa.',
        durasiDetikSaran: 12,
        visualSaran: 'Kondisi sesudah, kontras dengan masalah di scene 2.',
        teksLayarSaran: 'Hasil konkret dalam satu kalimat.',
        arahanNaskahVoiceOver:
          'Sebutkan hasil konkret yang dirasakan pelanggan - HANYA hasil yang benar dialami/bisa diverifikasi pelanggan tersebut, dilarang menambah klaim di luar cerita aslinya.',
      },
      {
        nomor: 5,
        tujuan: 'Rekomendasi pelanggan ke penonton, sekaligus jadi ajakan bertindak tidak langsung.',
        durasiDetikSaran: 8,
        visualSaran: 'Pelanggan menutup dengan rekomendasi, lalu tampilkan kontak/logo usaha.',
        teksLayarSaran: 'Cara menghubungi usaha.',
        arahanNaskahVoiceOver: 'Rekomendasi natural dari pelanggan, ditutup dengan info kontak usaha.',
      },
    ],
    aturanKhusus: [
      'Wajib ada izin eksplisit dari pelanggan yang ditampilkan sebelum video dipublikasikan - template ini tidak menggantikan proses izin/consent tersebut.',
      'Cerita dan hasil yang disebut wajib sesuai pengalaman nyata pelanggan dari brief user - dilarang menambah atau melebih-lebihkan klaim demi kesan meyakinkan.',
    ],
  },
};

/** Alias Indonesia/Inggris umum -> id template kanonik. Dicek via substring dua arah
 *  setelah exact-key match gagal, sama seperti pola industry-image-templates.ts. */
export const VIDEO_BRIEF_ALIASES: Record<string, VideoBriefTemplateId> = {
  penawaran: 'video-penawaran-produk',
  promosi: 'video-penawaran-produk',
  promo: 'video-penawaran-produk',
  pitch: 'video-penawaran-produk',
  jualan: 'video-penawaran-produk',
  produk: 'video-penawaran-produk',
  'company-profile': 'video-profil-usaha',
  'profil-usaha': 'video-profil-usaha',
  profil: 'video-profil-usaha',
  perusahaan: 'video-profil-usaha',
  usaha: 'video-profil-usaha',
  tentangkami: 'video-profil-usaha',
  fitur: 'video-penjelasan-fitur',
  tutorial: 'video-penjelasan-fitur',
  demo: 'video-penjelasan-fitur',
  'cara-pakai': 'video-penjelasan-fitur',
  panduan: 'video-penjelasan-fitur',
  testimoni: 'video-testimoni-pelanggan',
  review: 'video-testimoni-pelanggan',
  ulasan: 'video-testimoni-pelanggan',
  pelanggan: 'video-testimoni-pelanggan',
};

/** Deterministic resolve: exact id dulu, lalu alias substring match (dua arah).
 *  Input tidak dikenal -> null (tidak pernah throw), sama seperti resolveIndustryTemplate. */
export function resolveVideoBriefTemplate(input?: string): VideoBriefTemplate | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized in VIDEO_BRIEF_TEMPLATES) {
    return VIDEO_BRIEF_TEMPLATES[normalized as VideoBriefTemplateId];
  }
  for (const [alias, id] of Object.entries(VIDEO_BRIEF_ALIASES)) {
    if (normalized.includes(alias) || alias.includes(normalized)) {
      return VIDEO_BRIEF_TEMPLATES[id];
    }
  }
  return null;
}

/** Daftar semua template - untuk kebutuhan UI (dropdown pemilihan template, dsb). */
export function listVideoBriefTemplates(): VideoBriefTemplate[] {
  return Object.values(VIDEO_BRIEF_TEMPLATES);
}

/**
 * Susun instruksi terstruktur untuk disisipkan ke prompt LLM (fase integrate nanti) -
 * struktur scene/durasi/tujuan SUDAH TETAP dari template, LLM hanya mengisi kalimat
 * naskah/teks layar final sesuai brief pengguna. Fungsi ini sendiri TIDAK memanggil LLM.
 *
 * Kalau templateId tidak dikenal, kembalikan string kosong (jangan mengarang struktur) -
 * pola sama dengan buildTemplateInstruction() di generation-engine.ts.
 */
export function buildVideoBriefInstruction(templateId: string | undefined, brief: string): string {
  const template = resolveVideoBriefTemplate(templateId);
  if (!template) return '';

  const sceneList = template.scenes
    .map((sc) => {
      const lines = [
        `Scene ${sc.nomor} (${sc.durasiDetikSaran} detik) - Tujuan: ${sc.tujuan}`,
        `  Visual disarankan: ${sc.visualSaran}`,
        `  Teks layar disarankan: ${sc.teksLayarSaran}`,
        `  Arahan naskah voice-over: ${sc.arahanNaskahVoiceOver}`,
      ];
      return lines.join('\n');
    })
    .join('\n');

  const aturan = [...VIDEO_BRIEF_ATURAN_UNIVERSAL, ...template.aturanKhusus].map((a) => `- ${a}`).join('\n');

  return [
    `Ikuti struktur storyboard template "${template.label}" berikut sebagai kerangka scene ` +
      `(urutan dan tujuan tiap scene tetap, tapi isi naskah voice-over/teks layar final WAJIB disesuaikan ` +
      `dengan brief pengguna berikut: "${brief}"; kalau brief pengguna meminta struktur berbeda, ikuti brief pengguna):`,
    sceneList,
    'Aturan wajib dipatuhi:',
    aturan,
    `Catatan status produk (wajib disertakan ke pengguna, jangan dihapus): ${VIDEO_BRIEF_CATATAN_STATUS_PRODUK}`,
  ].join('\n\n');
}
