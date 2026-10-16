/**
 * PREFERENSI PEMBACA -- dibuat 8 Sep 2026 (B4-jawaban-mudah), fitur Setelan Jawaban AI.
 * Latar: feedback Mecca poin 6 -- "jawaban WAJIB mudah dicerna penanya + belajar dari
 * histori chat apa yang user suka/tidak suka".
 *
 * Berkas MURNI (no I/O, no framework import) -- boleh dipakai di komponen client
 * (AnswerFeedbackBar tidak mengimpor ini langsung, tapi B5 yang wiring ke 3 view BOLEH)
 * maupun dari server (route.ts). SATU-SATUNYA import di file ini adalah dari
 * chat-composer-types.ts (murni juga, "TANPA IMPORT APAPUN" per komentar file itu
 * sendiri) -- NOL import framework/node-only (fs/path/prisma/react/dst) supaya aman
 * diimpor dari kedua sisi tanpa risiko menyeret modul node-only (pelajaran insiden
 * 8 Sep siang: komponen client yang menyeret modul node-only bikin seluruh halaman 500).
 *
 * RIWAYAT KOORDINASI TIPE (dibaca sebelum sentuh ReaderPreferences di sini):
 * Saat berkas ini MULAI ditulis, src/lib/chat-composer-types.ts (SSOT tipe milik agent
 * B1-lib-katalog-prefs) BELUM ADA di disk (dicek 6x selama ~90 detik, tetap tidak
 * ditemukan) -- ReaderPreferences/DEFAULT_READER_PREFERENCES sempat didefinisikan LOKAL
 * sebagai sementara. Sebelum berkas ini SELESAI, chat-composer-types.ts sudah muncul di
 * disk (dicek ulang) dengan bentuk ReaderPreferences PERSIS SAMA (field per field, union
 * per field identik) -- maka definisi lokal DIHAPUS, digantikan re-export di bawah supaya
 * HANYA ADA SATU SSOT untuk tipe ini. JANGAN definisikan ulang ReaderPreferences di file
 * manapun -- import dari chat-composer-types.ts.
 *
 * Juga ada kemungkinan file src/lib/ai-brain/reader-profile.ts (fallback sementara milik
 * agent B3-backend-chat, kalau B3 sampai ke titik itu sebelum berkas ini siap) -- per cek
 * terakhir saat berkas ini ditulis, file itu BELUM ADA. Fungsi di file ITU (rencana nama
 * buildReaderProfileLine) BEDA NAMA dari buildReaderInstruction di bawah, tapi domainnya
 * SAMA (menyuntik profil/preferensi pembaca ke system prompt). Kalau file itu MUNCUL,
 * JANGAN biarkan 2 logic hidup berdampingan -- selaraskan pesan/formatnya dan pastikan
 * route.ts akhirnya memanggil SATU fungsi saja (idealnya buildReaderInstruction di sini,
 * karena file ini yang dirancang jadi SSOT permanen sesuai spesifikasi, bukan fallback).
 */

// SSOT tunggal untuk bentuk ReaderPreferences -- lihat "RIWAYAT KOORDINASI TIPE" di atas.
// JANGAN redefine interface ini di sini atau di file lain, import dari chat-composer-types.ts.
import type { ReaderPreferences } from './chat-composer-types';
import { DEFAULT_READER_PREFERENCES } from './chat-composer-types';
export type { ReaderPreferences };
export { DEFAULT_READER_PREFERENCES };

/** Satu pesan histori chat, dipakai murni untuk heuristik -- role bebas string (bukan
 * union ketat) supaya cocok dengan bentuk data yang berbeda-beda di 3 view (Executive/
 * Finance/Marketing menyimpan role sebagai 'user'/'assistant' atau kadang 'ai', dsb).
 * Perbandingan role dilakukan case-insensitive di dalam inferFromHistory. */
export interface ReaderHistoryMessage {
  role: string;
  content: string;
}

const MAX_SIGNALS = 5;
const MAX_SIGNAL_LENGTH = 80;

/** Ambang panjang pesan (karakter, sudah di-trim) yang dianggap "pendek" -- sinyal
 * lemah ke arah lebih_sederhana kalau tidak ada kata kunci eksplisit lain yang bicara
 * sebaliknya di pesan yang sama. */
const SHORT_MESSAGE_THRESHOLD = 20;

/** Kata kunci literal (bukan regex fuzzy) yang menandakan user ingin jawaban lebih
 * ringkas/sederhana. Dicek case-insensitive sebagai substring kata utuh. */
const SIMPLE_SIGNAL_WORDS = ['ringkas', 'simpel', 'simple', 'singkat'];

/** Kata kunci literal yang menandakan user ingin jawaban lebih detail/lengkap. */
const DETAIL_SIGNAL_WORDS = ['detail', 'lengkap', 'mendalam', 'jelasin panjang', 'jelaskan panjang'];

/** Berapa pesan user terakhir yang dilihat untuk heuristik -- histori lama diabaikan
 * supaya preferensi mengikuti gaya TERKINI user, bukan rata-rata sepanjang masa chat. */
const HISTORY_WINDOW = 5;

function containsWholeWord(text: string, word: string): boolean {
  // Pencarian substring kata kunci case-insensitive. Sengaja BUKAN regex \b (word
  // boundary) murni per-kata supaya frasa 2 kata ("jelasin panjang") tetap match --
  // cukup substring biasa, heuristik ini memang tidak perlu presisi linguistik tinggi.
  return text.toLowerCase().includes(word.toLowerCase());
}

/**
 * Heuristik sederhana dari pola pesan user di histori chat untuk menebak preferensi
 * simplicity (lihat Rule #6 permintaan Mecca -- AI belajar dari histori chat).
 * Pendek/kata 'ringkas'/'simpel'/'singkat' -> lebih_sederhana.
 * Kata 'detail'/'lengkap'/'mendalam' -> lebih_detail.
 * Tidak ada sinyal jelas (termasuk history kosong/cuma pesan assistant) -> 'normal'.
 *
 * Return HANYA nilai simplicity (bukan ReaderPreferences penuh) -- pemanggil yang
 * memutuskan cara menggabungkannya ke ReaderPreferences dasar (mis. field lain seperti
 * visual/signals tetap dari localStorage, tidak disentuh fungsi ini).
 */
export function inferFromHistory(history: ReaderHistoryMessage[] | null | undefined): ReaderPreferences['simplicity'] {
  if (!Array.isArray(history) || history.length === 0) return 'normal';

  const userMessages = history
    .filter((m) => m && typeof m.content === 'string' && String(m.role).toLowerCase() === 'user')
    .slice(-HISTORY_WINDOW);

  if (userMessages.length === 0) return 'normal';

  let simpleVotes = 0;
  let detailVotes = 0;

  for (const msg of userMessages) {
    const text = msg.content.trim();
    if (text.length === 0) continue;

    const hasSimpleWord = SIMPLE_SIGNAL_WORDS.some((w) => containsWholeWord(text, w));
    const hasDetailWord = DETAIL_SIGNAL_WORDS.some((w) => containsWholeWord(text, w));

    if (hasSimpleWord) simpleVotes += 1;
    if (hasDetailWord) detailVotes += 1;

    // Heuristik panjang pesan HANYA dihitung kalau pesan itu tidak sudah membawa kata
    // kunci eksplisit (menghindari double-count 1 pesan pendek yang isinya "ringkas dong").
    if (!hasSimpleWord && !hasDetailWord && text.length <= SHORT_MESSAGE_THRESHOLD) {
      simpleVotes += 1;
    }
  }

  if (simpleVotes > detailVotes) return 'lebih_sederhana';
  if (detailVotes > simpleVotes) return 'lebih_detail';
  return 'normal';
}

/**
 * Tambah 1 signal feedback eksplisit (dari AnswerFeedbackBar, lewat B5) ke
 * ReaderPreferences.signals. FIFO cap 5 item (signal terlama dibuang duluan kalau
 * sudah penuh) dan tiap signal di-truncate ke maksimal 80 karakter SEBELUM disimpan.
 * Fungsi PURE -- return objek baru, TIDAK memutasi `base`.
 *
 * Signal kosong/whitespace-only diabaikan (base dikembalikan apa adanya) -- bukan
 * error, karena ini preferensi UX bukan validasi keamanan ketat (lihat keputusan_teknis
 * D-3 di spesifikasi sintesis).
 */
export function mergeExplicitFeedback(base: ReaderPreferences, signal: string): ReaderPreferences {
  const safeBase: ReaderPreferences = base && Array.isArray(base.signals) ? base : { ...DEFAULT_READER_PREFERENCES };
  const trimmed = typeof signal === 'string' ? signal.trim() : '';
  if (trimmed.length === 0) return safeBase;

  const truncated = trimmed.slice(0, MAX_SIGNAL_LENGTH);
  const nextSignals = [...safeBase.signals, truncated];
  const capped = nextSignals.length > MAX_SIGNALS ? nextSignals.slice(nextSignals.length - MAX_SIGNALS) : nextSignals;

  return { ...safeBase, signals: capped };
}

function isDefaultPrefs(prefs: ReaderPreferences): boolean {
  return (
    prefs.simplicity === 'normal' &&
    prefs.visual === 'auto' &&
    (!Array.isArray(prefs.signals) || prefs.signals.length === 0)
  );
}

/**
 * Bangun 1 blok instruksi teks (untuk disuntik ke system prompt oleh B3) dari
 * ReaderPreferences. Return STRING KOSONG kalau prefs kosong/default -- supaya route.ts
 * tidak menambah noise ke system prompt untuk user yang belum pernah kasih sinyal apapun
 * (perilaku klien lama/user baru tidak berubah).
 */
export function buildReaderInstruction(prefs: ReaderPreferences | null | undefined): string {
  if (!prefs) return '';
  if (isDefaultPrefs(prefs)) return '';

  const lines: string[] = [];

  if (prefs.simplicity === 'lebih_sederhana') {
    lines.push('Pembaca ini terbukti lebih suka jawaban SEDERHANA dan ringkas -- kurangi jargon, langsung ke inti, jangan bertele-tele.');
  } else if (prefs.simplicity === 'lebih_detail') {
    lines.push('Pembaca ini terbukti lebih suka jawaban DETAIL dan lengkap -- boleh lebih panjang, jelaskan alasan/trade-off di balik rekomendasi.');
  }

  if (prefs.visual === 'tabel') {
    lines.push('Pembaca ini lebih suka jawaban dalam bentuk TABEL kalau datanya memungkinkan.');
  } else if (prefs.visual === 'prosa') {
    lines.push('Pembaca ini lebih suka jawaban dalam bentuk PROSA/kalimat biasa -- hindari tabel/bar chart kalau tidak benar-benar perlu.');
  }

  if (Array.isArray(prefs.signals) && prefs.signals.length > 0) {
    lines.push(`Feedback eksplisit dari pembaca ini (dari yang paling lama ke paling baru): ${prefs.signals.join(' | ')}.`);
  }

  if (lines.length === 0) return '';

  return `PREFERENSI PEMBACA INI (dipelajari dari histori chat + feedback eksplisit -- sesuaikan GAYA jawaban, JANGAN mengorbankan akurasi data):\n${lines
    .map((l) => `- ${l}`)
    .join('\n')}`;
}
