/**
 * Registry kemampuan AI Brain KLIR -- SATU sumber kebenaran dipakai baik oleh
 * endpoint /api/v1/brain/tools (UI panel Plugins) maupun oleh chat brain sendiri
 * saat pengguna nanya "apa aja yang bisa kamu lakukan" -- supaya dua tempat itu
 * tidak pernah beda-beda daftar (drift).
 * status: 'ready' = bisa dipakai sekarang, 'planned' = jujur belum tersedia.
 */
export interface KlirAiTool {
  id: string;
  name: string;
  description: string;
  endpoint: string | null;
  payloadHint?: Record<string, string>;
  status: 'ready' | 'planned';
  category: 'analisis' | 'generate' | 'data';
}

export const KLIR_AI_TOOLS: KlirAiTool[] = [
  {
    id: 'chat',
    name: 'Chat Eksekutif',
    description: 'Tanya jawab strategi bisnis dengan konteks data riil perusahaan.',
    endpoint: '/api/v1/brain/chat',
    status: 'ready',
    category: 'analisis',
  },
  {
    id: 'analyze-document',
    name: 'Analisis Dokumen',
    description: 'Unggah dokumen (teks/CSV) untuk dibaca dan dianalisis AI.',
    endpoint: '/api/v1/brain/chat',
    status: 'ready',
    category: 'analisis',
  },
  {
    id: 'analyze-image',
    name: 'Analisis Foto (Papan Tulis / Dokumen Difoto)',
    description: 'Unggah foto papan tulis, catatan tangan, atau dokumen hasil scan untuk dibaca dan dijelaskan AI.',
    endpoint: '/api/v1/brain/chat',
    status: 'ready',
    category: 'analisis',
  },
  {
    id: 'generate-word',
    name: 'Buat Dokumen Word',
    description: 'Surat, proposal, laporan, atau kontrak dalam format .docx siap pakai.',
    endpoint: '/api/v1/brain/generate',
    payloadHint: { type: 'word', brief: 'contoh: buatkan proposal penawaran jasa untuk klien baru' },
    status: 'ready',
    category: 'generate',
  },
  {
    id: 'generate-excel',
    name: 'Buat Spreadsheet Excel',
    description: 'Tabel data, laporan keuangan, atau template perhitungan dalam .xlsx.',
    endpoint: '/api/v1/brain/generate',
    payloadHint: { type: 'excel', brief: 'contoh: buatkan template laporan arus kas bulanan' },
    status: 'ready',
    category: 'generate',
  },
  {
    id: 'generate-ppt',
    name: 'Buat Presentasi PPT',
    description: 'Slide deck profesional (pitch, laporan, materi meeting) dalam .pptx.',
    endpoint: '/api/v1/brain/generate',
    payloadHint: { type: 'ppt', brief: 'contoh: buatkan presentasi laporan kinerja bulanan' },
    status: 'ready',
    category: 'generate',
  },
  {
    id: 'generate-image',
    name: 'Buat Gambar / Banner / Stiker',
    description: 'Generate gambar dari deskripsi teks untuk materi promosi, dengan arahan gaya anti-generik.',
    endpoint: '/api/v1/brain/generate',
    payloadHint: { type: 'image', brief: 'contoh: banner promo diskon 20% nuansa biru modern' },
    status: 'ready',
    category: 'generate',
  },
  {
    id: 'generate-video-plan',
    name: 'Buat Storyboard Video',
    description: 'Naskah + storyboard video lengkap per-scene (dokumen produksi, bukan video jadi).',
    endpoint: '/api/v1/brain/generate',
    payloadHint: { type: 'video-plan', brief: 'contoh: video promosi 60 detik untuk produk baru' },
    status: 'ready',
    category: 'generate',
  },
  {
    // PERUBAHAN (11 Sep 2026, sesi Fable "integrasi AI-data...", B2, context pack
    // bagian 3.C): status DIGANTI dari 'planned' ke 'ready' -- render video jadi
    // SUDAH bisa dipakai lewat mode Video di composer (endpoint POST
    // /api/v1/media/generate kind 'video', dibuktikan spend OpenRouter 7 & 11 Sep
    // di context pack). Entry ini SEBELUMNYA jujur bilang "belum tersedia" padahal
    // fiturnya sudah live lewat jalur UI yang berbeda (mode Video, bukan chat teks)
    // -- registry ini yang dibaca chat brain sendiri untuk jawab "apa aja yang bisa
    // kamu lakukan" (lihat blok 0.7 DAFTAR KEMAMPUAN AI di route.ts), jadi kalau
    // dibiarkan 'planned' LLM akan terus salah bilang fitur ini belum ada.
    id: 'render-video',
    name: 'Render Video Otomatis',
    description: 'Render video jadi via mode Video di composer (OpenRouter, proses 1-3 menit).',
    endpoint: '/api/v1/media/generate',
    status: 'ready',
    category: 'generate',
  },
  {
    id: 'calculate-hpp',
    name: 'Kalkulator HPP',
    description: 'Hitung Harga Pokok Penjualan, margin, dan proyeksi laba bulanan dari biaya bahan baku/tenaga kerja/overhead.',
    endpoint: '/api/v1/brain/chat',
    status: 'ready',
    category: 'analisis',
  },
  {
    id: 'simulate-kur',
    name: 'Simulasi KUR',
    description: 'Hitung cicilan bulanan, total bunga, dan total pembayaran pinjaman KUR (Kredit Usaha Rakyat) dari jumlah pinjaman dan tenor.',
    endpoint: '/api/v1/brain/chat',
    status: 'ready',
    category: 'analisis',
  },
  {
    id: 'business-context',
    name: 'Konteks Bisnis Live',
    description: 'Snapshot data keuangan, marketing, dan operasional real-time dari database.',
    endpoint: '/api/v1/brain/context',
    status: 'ready',
    category: 'data',
  },
  {
    id: 'simulate',
    name: 'Simulasi What-If',
    description: 'Simulasi skenario bisnis (rekrut staf, scale iklan, dsb).',
    endpoint: '/api/v1/brain/simulate',
    status: 'ready',
    category: 'analisis',
  },
  {
    id: 'proactive-insight',
    name: 'Wawasan Bisnis Proaktif',
    description: 'Nudge hal yang perlu diperhatikan, proyeksi kas 6 bulan ke depan, audit keandalan data, dan tugas tim yang telat.',
    endpoint: '/api/v1/brain/chat',
    status: 'ready',
    category: 'analisis',
  },
];
