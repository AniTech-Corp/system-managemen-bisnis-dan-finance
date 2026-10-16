/**
 * V3 TOMBOL LANJUTAN -- tombol aksi lanjutan di bawah gelembung jawaban AI
 * (mis. "Buat slide ringkasan", "Buat visual promosi"). Dibuat 8 Sep 2026.
 *
 * DETERMINISTIK MURNI: regex atas pesan pengguna (`lowerMessage`, sudah di-
 * lowercase oleh pemanggil) + nama lampiran opsional -- NOL panggilan LLM/
 * fetch/DB tambahan (larangan keras context pack: "HARAM LLM call tambahan
 * per pesan untuk nextActions"). Dipanggil di src/app/api/v1/brain/chat/
 * route.ts pada 2 titik return jawaban teks (jalur LLM sukses + jalur
 * fallback lokal tanpa LLM), memakai variabel `lower` yang sudah ada di
 * scope sejak awal handler -- tidak menghitung ulang toLowerCase().
 *
 * Konsumen: NextActionsBar.tsx (lane UI, src/app/components/chat/) meng-
 * IMPORT type NextAction/NextActionKind dari sini sebagai SSOT -- jangan
 * didefinisikan ulang di tempat lain. Kalau shape field berubah, itu
 * breaking change untuk lane UI, WAJIB dicatat eksplisit di laporan.
 *
 * Keputusan produk yang dikunci di sini (supaya lane lain tidak menebak):
 * urutan pemicu di bawah = urutan PRIORITAS slot kalau >1 kategori kata
 * kunci cocok bersamaan dalam 1 pesan (mis. pesan yang sekaligus menyebut
 * "laporan keuangan" DAN "kuis" -- kategori laporan/keuangan yang dipush
 * lebih dulu akan lebih dulu mengisi slot maksimal 4).
 */

export type NextActionKind =
  | 'ppt'
  | 'word'
  | 'excel'
  | 'image'
  | 'video'
  | 'flashcard'
  | 'quiz'
  | 'summary'
  | 'import-ledger'
  | 'riset'
  | 'prediksi'
  | 'lokasi'
  | 'template';

export interface NextAction {
  id: string;
  label: string;
  kind: NextActionKind;
  brief: string;
}

const REPORT_SIGNAL = /laporan|keuangan|kas|omset|penjualan|margin|anggaran|profit|rugi/;
const PROMO_SIGNAL = /konten|promo|kampanye|iklan|materi pemasaran|banner|poster/;
const LEARNING_SIGNAL = /belajar|materi|pelajari|latihan|training|kuis|flashcard/;
const LEDGER_ATTACHMENT_SIGNAL = /\.(xlsx|xls|csv)$/i;

// 8 Sep 2026 (wave B4-chat-wiring-backend, fitur riset web + prediksi + lokasi):
// 3 regex baru untuk 3 NextActionKind baru. CATATAN DESAIN: COMPETITOR_SIGNAL
// SENGAJA TIDAK memuat "cabang baru" (beda dari draf awal di spesifikasi) --
// dipindah ke LOCATION_SIGNAL sendiri supaya tidak tabrakan slot dengan kind
// 'lokasi' untuk pesan yang sama ("mau buka cabang baru" harusnya nawarin
// analisis LOKASI, bukan riset kompetitor generik). Keputusan sepihak lane ini,
// aman diubah kalau Komando/Mecca berpendapat lain -- dicatat di laporan.
const COMPETITOR_SIGNAL = /kompetitor|pesaing|trending|di sekitar/;
const LOCATION_SIGNAL = /cabang baru|lokasi (usaha|bisnis|kantor|toko)|alamat (kantor|usaha|toko)/;
const PREDICTION_SIGNAL = /prediksi|proyeksi|masa depan|1 bulan|3 bulan|1 kuartal|1 tahun/;

// 11 Sep 2026 (Context Pack integrasi-ai-data-model-hemat, agent B6, kontrak
// modul 7): tombol "Pilih template" untuk pesan yang menyinggung dokumen
// terstruktur. KENAPA regex ini TIDAK memuat kata "laporan" polos (beda dari
// draf literal di kontrak "laporan/proposal/presentasi/invoice"): REPORT_SIGNAL
// di atas SUDAH memuat "laporan" dan hasil buildNextActions untuk pesan
// "laporan keuangan ..." DIKUNCI test lama (tests/next-actions-8sep.test.ts +
// tests/next-actions-riset-prediksi-lokasi.test.ts, deepEqual persis
// ['ppt','excel','word'] / ['ppt','excel','word','image']) -- kalau "laporan"
// polos ikut memicu kind 'template', slot ke-4 yang sudah dikunci test lama
// bakal terisi 'template' bukan 'image', MERUSAK 2 test yang sudah ada tanpa
// perlu (Kontrak Penyesuaian #6 di context pack, keputusan desain B6 yang
// diizinkan eksplisit di sana). "laporan" HANYA dianggap sinyal template kalau
// berpasangan dengan kata "format"/"contoh format"/"template" -- proposal,
// presentasi, invoice AMAN dipakai polos karena TIDAK overlap dengan
// REPORT_SIGNAL/kategori manapun yang sudah ditest.
const TEMPLATE_SIGNAL = /\btemplate\b|contoh format|format (laporan|dokumen|slide|presentasi|invoice)|\bproposal\b|\bpresentasi\b|\binvoice\b/;
// Kata tipe dokumen untuk mengisi "<tipe>" di brief tombol, dicek TERPISAH
// dari TEMPLATE_SIGNAL (regex trigger di atas boleh cocok dari "template"
// polos yang tidak menyebut tipe apapun -- brief lalu jatuh ke default umum).
const TEMPLATE_TYPE_WORD = /\b(proposal|presentasi|invoice|laporan|dokumen|slide)\b/;

/**
 * Bangun daftar tombol aksi lanjutan dari pesan pengguna (sudah lowercase)
 * dan lampiran opsional. Pure function, sinkron, aman dipanggil di jalur
 * response teks manapun -- TAPI pemanggil WAJIB tidak memanggilnya untuk
 * balasan yang sebetulnya pesan gagal/degraded (lihat catatan di route.ts
 * dekat titik panggil ke-2 -- "layanan AI sedang tidak tersedia" TIDAK
 * boleh dapat tombol "Buat PPT dari jawaban di atas" karena di atas cuma
 * pesan error, bukan jawaban berisi data).
 */
export function buildNextActions(
  lowerMessage: string,
  attachment?: { name?: string } | null,
  // 8 Sep malam (feedback Mecca, diulang 2x -- "generate PPT dari riset, sumbernya ikut"):
  // daftar sumber riset (judul+url) untuk PESAN INI, kalau ada. Opsional + fail-soft murni
  // (tidak ada -> perilaku identik sebelum field ini ditambahkan, klien lama aman).
  sources?: Array<{ title: string; url: string }> | null
): NextAction[] {
  const out: NextAction[] = [];
  const push = (kind: NextActionKind, label: string, brief: string) => {
    if (out.length < 4) out.push({ id: `na-${kind}`, kind, label, brief });
  };

  // Ditempel ke brief ppt/word/excel supaya Studio (openStudio -> resolveStudioSource,
  // marketing-media/client.ts:159-166) ikut membawa sumbernya sebagai bagian dari
  // "jawaban di atas" yang dirujuk brief -- bukan cuma prosa temuan tanpa rujukan.
  // Dipotong 6 sumber supaya brief tidak membengkak (dokumen tetap fokus).
  // Dedupe by url dulu (temuan smoke 8 Sep malam: grounding Gemini bisa mengembalikan
  // domain yang sama 2x) -- pola sama seperti dedupeSources di ResearchSourcesCard.tsx,
  // ditulis ulang murni di sini (tidak import file 'use client' dari lib server).
  const seenUrls = new Set<string>();
  const uniqueSources = (sources || []).filter((s) => {
    if (!s.url || seenUrls.has(s.url)) return false;
    seenUrls.add(s.url);
    return true;
  });
  const sourceSuffix = uniqueSources.length > 0
    ? '\n\nSumber:\n' + uniqueSources.slice(0, 6).map((s) => `- ${s.title || s.url}: ${s.url}`).join('\n')
    : '';

  if (REPORT_SIGNAL.test(lowerMessage)) {
    push('ppt', 'Buat slide ringkasan', `Buatkan PPT ringkasan dari jawaban di atas, format profesional 5-7 slide.${sourceSuffix}`);
    push('excel', 'Buat rekap Excel', `Buatkan file Excel berisi rincian angka dari jawaban di atas dalam bentuk tabel.${sourceSuffix}`);
    push('word', 'Buat laporan Word', `Buatkan dokumen Word naratif dari jawaban di atas, gaya laporan formal.${sourceSuffix}`);
  }
  if (PROMO_SIGNAL.test(lowerMessage)) {
    push('image', 'Buat visual promosi', 'Buatkan gambar/banner promosi berdasarkan konteks jawaban di atas.');
    push('video', 'Buat video pendek', 'Buatkan storyboard video pendek berdasarkan konteks jawaban di atas.');
  }
  if (LEARNING_SIGNAL.test(lowerMessage)) {
    push('quiz', 'Buat kuis', 'Buatkan kuis dari materi/jawaban di atas.');
    push('flashcard', 'Buat flashcard', 'Buatkan flashcard dari materi/jawaban di atas.');
  }
  // 8 Sep 2026 (wave B4): 3 slot baru fitur riset/prediksi/lokasi. Brief di sini
  // SENGAJA teks yang lolos detectResearchIntent() di src/lib/research-intent.ts
  // (dipakai brain/chat/route.ts) -- supaya klik tombol ini beneran memicu jalur
  // riset/forecast/lokasi begitu diteruskan sebagai pesan chat oleh B5, bukan
  // cuma teks kosmetik yang tidak match regex.
  if (COMPETITOR_SIGNAL.test(lowerMessage)) {
    // 8 Sep sore (temuan verifikator TINGGI): frasa "lokasi bisnis" bikin brief ini terdeteksi
    // sebagai intent LOKASI (minta input manual), bukan riset web kompetitor. Teks diganti.
    push('riset', 'Riset kompetitor', 'Riset kompetitor dan tren pasar untuk bisnis saya.');
  }
  if (LOCATION_SIGNAL.test(lowerMessage)) {
    push('lokasi', 'Analisis lokasi', 'Analisis kecocokan lokasi bisnis saya, termasuk kompetitor di sekitarnya.');
  }
  if (PREDICTION_SIGNAL.test(lowerMessage)) {
    push('prediksi', 'Buat prediksi', 'Buatkan prediksi 3 bulan ke depan berdasarkan data bisnis + riset pasar.');
  }
  // 11 Sep 2026 (B6, kontrak modul 7) -- lihat catatan panjang di TEMPLATE_SIGNAL
  // kenapa "laporan" polos sengaja tidak ikut memicu ini.
  if (TEMPLATE_SIGNAL.test(lowerMessage)) {
    const typeMatch = lowerMessage.match(TEMPLATE_TYPE_WORD);
    const brief = typeMatch
      ? `template apa saja yang tersedia untuk ${typeMatch[1]}`
      : 'template apa saja yang tersedia';
    push('template', 'Pilih template', brief);
  }
  if (attachment?.name && LEDGER_ATTACHMENT_SIGNAL.test(attachment.name)) {
    push('import-ledger', 'Impor ke Buku Kas', `Impor data dari file "${attachment.name}" ke Buku Kas.`);
  }

  return out.slice(0, 4);
}
