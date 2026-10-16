/**
 * Registry murni slash-command composer KLIR (fitur Setelan Jawaban + Toolbar,
 * dibangun 8 Sep 2026, agent B6-slash-commands, dari feedback Mecca sore 8 Sep +
 * syarat GO Council 5 poin). File ini TIDAK BOLEH punya efek samping/side-effect
 * dan TIDAK BOLEH mengimpor apapun selain (idealnya) type dari chat-composer-
 * types.ts -- lihat catatan "TIPE LOKAL SEMENTARA" di bawah untuk kenapa saat
 * ini nol import.
 *
 * TIPE LOKAL SEMENTARA (8 Sep 2026): src/lib/chat-composer-types.ts (SSOT milik
 * agent B1-lib-katalog-prefs, gelombang 1 paralel) BELUM ADA di disk saat file
 * ini ditulis -- dicek langsung (`test -f`) sebelum menulis, hasilnya MISSING.
 * Spesifikasi build sendiri mengizinkan ini: kriteria_selesai B6 eksplisit
 * bilang "maksimal 1 baris import type dari chat-composer-types.ts ATAU NOL
 * IMPORT SAMA SEKALI". SlashCommandKind dan SlashCommand di bawah didefinisikan
 * PERSIS sama bentuknya dengan kontrak_tipe_ts di spesifikasi supaya kompatibel
 * begitu direkonsiliasi. WAJIB DITINDAKLANJUTI: begitu chat-composer-types.ts
 * milik B1 sudah ada di disk, seseorang (komando/B2/B5) WAJIB mengganti 2
 * definisi lokal di bawah jadi `import type { SlashCommandKind, SlashCommand }
 * from './chat-composer-types';` dan menghapus definisi lokal ini -- supaya
 * tidak ada 2 sumber kebenaran untuk tipe yang sama (pola persis peringatan
 * SEDANG soal reader-profile.ts vs reader-preferences.ts di hasil kritik).
 */

// 8 Sep 2026 (rekonsiliasi komando): tipe diambil dari SSOT chat-composer-types.ts,
// bukan didefinisikan ulang di sini. Di-re-export supaya import lama tetap jalan.
import type { SlashCommandKind, SlashCommand } from './chat-composer-types';
export type { SlashCommandKind, SlashCommand };

/**
 * Daftar tunggal, statis, murni -- TIDAK ada logic async/fetch/network di sini.
 * Command yang belum punya fungsi nyata di app SENGAJA TIDAK dimasukkan
 * (kejujuran > kelengkapan, sesuai instruksi tugas) -- lihat catatan per-entri
 * dan bagian item_belum di laporan untuk daftar yang dipertimbangkan lalu
 * dibuang.
 *
 * Urutan array = urutan tampil default di menu slash (B2 boleh re-sort by
 * relevance kalau perlu, tapi urutan ini yang dipakai kalau tidak).
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'gambar',
    label: '/gambar',
    desc: 'Ganti mode composer ke Gambar (generate image dari chat).',
    kind: 'mode',
    payload: { mode: 'image' },
  },
  {
    id: 'video',
    label: '/video',
    desc: 'Ganti mode composer ke Video (generate video dari chat, lewat jalur Studio).',
    kind: 'mode',
    payload: { mode: 'video' },
  },
  {
    id: 'ppt',
    // REUSE NextActionKind existing (src/lib/ai-brain/next-actions.ts) --
    // 'ppt' persis salah satu union NextActionKind, TIDAK didefinisikan ulang
    // di sini supaya tidak drift dari SSOT lane tombol lanjutan.
    label: '/ppt',
    desc: 'Buat presentasi (PPT) dari jawaban terakhir.',
    kind: 'nextAction',
    payload: { nextActionKind: 'ppt' },
  },
  {
    id: 'word',
    label: '/word',
    desc: 'Buat dokumen Word dari jawaban terakhir.',
    kind: 'nextAction',
    payload: { nextActionKind: 'word' },
  },
  {
    id: 'excel',
    label: '/excel',
    desc: 'Buat spreadsheet Excel dari jawaban terakhir.',
    kind: 'nextAction',
    payload: { nextActionKind: 'excel' },
  },
  {
    id: 'pdf',
    label: '/pdf',
    // KLIR belum punya endpoint generate PDF (cuma bisa upload/analisis PDF
    // yang sudah ada) -- temuan scan dokumen-template, dikonfirmasi ulang di
    // hasil kritik. Command ini TETAP didaftarkan (bukan disembunyikan total)
    // supaya user yang ketik /pdf dapat penjelasan jujur, bukan seolah-olah
    // command tidak dikenal -- tapi payload disabled:true, B2/B5 WAJIB
    // menampilkan reason ini alih-alih menjalankan aksi apapun.
    desc: 'PDF generate belum tersedia -- hanya bisa upload/analisis dokumen PDF.',
    kind: 'setting',
    payload: {
      disabled: true,
      reason: 'PDF generate belum ada di KLIR, hanya bisa upload/analisis dokumen PDF',
    },
  },
  {
    id: 'flashcard',
    label: '/flashcard',
    desc: 'Buat flashcard belajar dari jawaban terakhir.',
    kind: 'nextAction',
    payload: { nextActionKind: 'flashcard' },
  },
  {
    id: 'kuis',
    label: '/kuis',
    // NextActionKind existing pakai 'quiz' (Inggris) sementara command user-
    // facing pakai '/kuis' (Indonesia) -- ini SENGAJA beda, id/label boleh
    // lokal, payload.nextActionKind WAJIB persis salah satu union asli.
    desc: 'Buat kuis dari jawaban terakhir.',
    kind: 'nextAction',
    payload: { nextActionKind: 'quiz' },
  },
  {
    id: 'deck',
    label: '/deck',
    // Mengarah ke doc-templates deck 'pitch-investor-ringkas' (hasil file
    // .pptx nyata lewat POST /api/v1/documents/from-template, body
    // {templateId, brief, ...}) -- BUKAN /pitchdeck, dan BUKAN corplan/
    // pitchdeck (JSON tersimpan di Prisma tanpa file). Keputusan D-13:
    // 2 "pitch deck" berbeda arsitektur ini SENGAJA tidak disatukan di wave
    // ini, diserahkan ke Mecca (lihat butuh_dari_tim). templateId 'pitch-
    // investor-ringkas' diverifikasi ADA di src/lib/doc-templates/deck-
    // templates.ts baris 193-196 (dibaca ulang langsung, bukan tebakan).
    desc: 'Buat deck pitch investor ringkas (file presentasi, dari template).',
    kind: 'nextAction',
    payload: { templateId: 'pitch-investor-ringkas' },
  },
  {
    id: 'riset',
    // 8 Sep 2026 (wave B4-chat-wiring-backend) -- payload.nextActionKind persis
    // salah satu union NextActionKind baru (next-actions.ts), sama pola reuse
    // seperti /ppt di atas.
    label: '/riset',
    desc: 'Riset kompetitor/tren pasar di sekitar bisnis Anda (data publik dari internet).',
    kind: 'nextAction',
    payload: { nextActionKind: 'riset' },
  },
  {
    id: 'kompetitor',
    // Alias ke kind yang sama dengan /riset (brief beda, lebih spesifik) --
    // sesuai instruksi tugas B4.
    label: '/kompetitor',
    desc: 'Riset kompetitor dan tren pasar untuk bisnis Anda.', // 8 Sep sore: tanpa frasa "lokasi bisnis" (salah rute ke intent lokasi)
    kind: 'nextAction',
    payload: { nextActionKind: 'riset' },
  },
  {
    id: 'lokasi',
    label: '/lokasi',
    desc: 'Analisis kecocokan lokasi usaha (buka cabang baru / sekitar kantor).',
    kind: 'nextAction',
    payload: { nextActionKind: 'lokasi' },
  },
  {
    id: 'prediksi',
    label: '/prediksi',
    desc: 'Buat prediksi bisnis ke depan (1/3/6/12 bulan) dari data internal + riset pasar.',
    kind: 'nextAction',
    payload: { nextActionKind: 'prediksi' },
  },
  {
    id: 'template',
    // 11 Sep 2026 (B6, kontrak modul 7): buka daftar template dokumen +
    // gaya visual gambar. kind 'setting' (bukan 'nextAction') karena ini
    // TIDAK memakai NextActionKind existing manapun -- payload.templatePicker
    // adalah sinyal khusus untuk B2/B5 mengirim pesan "template apa saja
    // yang tersedia" ke chat (lihat detectTemplateIntent di
    // src/lib/ai-brain/template-picker.ts, yang mengenali frasa itu sebagai
    // kind 'list' tanpa outputType -> tampilkan SEMUA template).
    label: '/template',
    desc: 'Lihat daftar template dokumen (laporan/invoice/deck/video) & gaya visual gambar.',
    kind: 'setting',
    payload: { templatePicker: true },
  },
  {
    id: 'model',
    label: '/model',
    desc: 'Buka pemilih model AI (teks) di panel Setelan jawaban.',
    kind: 'setting',
    payload: { action: 'openModelPicker' },
  },
  {
    id: 'upaya',
    label: '/upaya',
    desc: 'Buka pemilih tingkat upaya (santai/normal/serius/maksimal).',
    kind: 'setting',
    payload: { action: 'openEffortPicker' },
  },
  {
    id: 'mic',
    label: '/mic',
    desc: 'Mulai rekam suara (speech-to-text) untuk pesan berikutnya.',
    kind: 'setting',
    payload: { action: 'startRecording' },
  },
];

/**
 * Cari command yang label-nya berawalan `input` (case-insensitive, substring
 * prefix sederhana -- TANPA fuzzy search, sesuai instruksi tugas).
 *
 * Kontrak: input '/' kosong (cuma garis miring) mengembalikan SEMUA command
 * (prefix kosong cocok semua). Input yang tidak diawali '/' TETAP diproses
 * apa adanya (dibandingkan sebagai prefix label, yang semuanya diawali '/')
 * -- pemanggil (B2) yang memutuskan kapan memanggil fungsi ini (biasanya
 * hanya saat inputValue diawali '/', sesuai tugas B2 poin d).
 */
export function matchSlash(input: string): SlashCommand[] {
  const needle = input.trim().toLowerCase();
  if (needle.length === 0) {
    return [...SLASH_COMMANDS];
  }
  return SLASH_COMMANDS.filter((cmd) => cmd.label.toLowerCase().startsWith(needle));
}
