// src/lib/ai-brain/auto-effort.ts
// BARU 11 Sep 2026 (wave B1-backend-routing, Context Pack integrasi-ai-data-model-hemat).
// KENAPA: arahan Mecca 11 Sep poin 5 -- "jawaban adaptif: AI tahu kapan perlu jawaban
// kompleks vs singkat." Sebelumnya (route.ts:744-747 versi lama) kalau body.effort tidak
// dikirim client, effort jadi `undefined` -> maxOutputTokens TANPA BATAS + temperature
// 0.7 tetap dipakai untuk SEMUA pesan, sapaan singkat maupun pertanyaan analitis berat --
// tidak ada klasifikasi kompleksitas otomatis sama sekali. Modul ini PURE (nol import
// selain type) dan DETERMINISTIK (bukan LLM judge) supaya murah + testable + tidak
// menambah 1 network round-trip cuma untuk memutuskan effort.
//
// TIDAK PERNAH mengembalikan 'maksimal' -- tier itu satu-satunya yang harus jadi PILIHAN
// USER SENDIRI (lihat model-tiers.ts, resolveTierForEffort). classifyEffort() cuma
// membedakan santai/normal/serius.
//
// CATATAN OPERASIONAL 11 Sep 2026 (komando/B1): file ini SEMPAT ditimpa stub sementara
// agent B2 (butuh signature modul ini untuk tsc/test lokal file B2 sebelum implementasi
// resmi ini ada di disk). Versi INI adalah SSOT final -- JANGAN ditimpa balik ke stub.

export interface AutoEffortResult {
  effort: 'santai' | 'normal' | 'serius';
  reason: string;
  signals: string[];
}

/** Kata kunci analitis (kontrak Context Pack modul 2, persis daftar yang ditentukan
 * komando) -- kecocokan substring case-insensitive terhadap pesan. */
const ANALYTICAL_KEYWORDS = [
  'analisis',
  'strategi',
  'evaluasi',
  'bandingkan',
  'prediksi',
  'proyeksi',
  'rencana',
  'kenapa',
  'dampak',
  'risiko',
  'rekomendasi',
  'laporan',
  'hitung',
  'simulasi',
  'profit',
  'rugi',
  'untung',
  'kelayakan',
] as const;

/**
 * REVISI KOMANDO 11 Sep 2026 siang (Council SPEED pagar #1 + arahan Mecca "gaji saya
 * bulan ini / tugas minggu depan harus efektif"): pesan pendek yang menyebut ENTITAS DATA
 * bisnis (kas, gaji, tugas, invoice, stok, dst) BUKAN sapaan -- pengguna mengharapkan
 * jawaban berisi angka/daftar, jadi minimal 'normal' (bukan 'santai' 500 token). 'santai'
 * dikhususkan untuk sapaan/konfirmasi/basa-basi. Pertanyaan data ringan idealnya dijawab
 * quick-data-router.ts (nol LLM) SEBELUM sampai ke klasifikasi ini.
 */
const DATA_ENTITY_KEYWORDS = [
  'kas', 'saldo', 'omset', 'omzet', 'penjualan', 'pendapatan', 'pengeluaran', 'biaya',
  'gaji', 'payroll', 'karyawan', 'staf', 'tugas', 'kerjaan', 'jadwal', 'agenda', 'reservasi',
  'booking', 'invoice', 'faktur', 'tagihan', 'piutang', 'hutang', 'utang', 'pajak',
  'stok', 'produk', 'barang', 'supplier', 'pelanggan', 'klien', 'kampanye', 'iklan',
  'promo', 'kupon', 'roas', 'margin', 'harga', 'target', 'kondisi', 'bisnis', 'usaha', 'perusahaan',
] as const;

function countWords(message: string): number {
  const trimmed = message.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Klasifikasi effort dari isi pesan + konteks composer. Aturan (persis kontrak Context
 * Pack, urutan evaluasi PENTING -- kondisi "serius" dicek LEBIH DULU supaya pesan panjang
 * atau berlampiran tidak pernah salah jatuh ke 'santai' hanya karena kebetulan pendek):
 *   1. Kata analitis ATAU ada lampiran ATAU pesan > 60 kata ATAU assistantMode
 *      'analis'/'riset' -> 'serius'.
 *   2. Selain itu, pesan <= 12 kata (sapaan/pertanyaan singkat tanpa kata analitis)
 *      -> 'santai'.
 *   3. Selain keduanya -> 'normal'.
 */
export function classifyEffort(input: {
  message: string;
  hasAttachment?: boolean;
  historyLength?: number;
  researchMode?: string;
  assistantMode?: string;
}): AutoEffortResult {
  const message = typeof input.message === 'string' ? input.message : '';
  const lower = message.toLowerCase();
  const wordCount = countWords(message);
  const signals: string[] = [];

  const matchedKeywords = ANALYTICAL_KEYWORDS.filter((kw) => lower.includes(kw));
  if (matchedKeywords.length > 0) signals.push(`kata analitis: ${matchedKeywords.join(', ')}`);
  if (input.hasAttachment) signals.push('ada lampiran');
  if (wordCount > 60) signals.push(`pesan panjang (${wordCount} kata)`);
  if (input.assistantMode === 'analis' || input.assistantMode === 'riset') {
    signals.push(`mode asisten: ${input.assistantMode}`);
  }

  const isSerius =
    matchedKeywords.length > 0 ||
    !!input.hasAttachment ||
    wordCount > 60 ||
    input.assistantMode === 'analis' ||
    input.assistantMode === 'riset';

  if (isSerius) {
    return {
      effort: 'serius',
      reason: 'Sinyal kompleksitas terdeteksi pada pesan/konteks -- butuh jawaban lebih dalam.',
      signals,
    };
  }

  // Batas kata (bukan substring): "terima kasih" TIDAK boleh cocok dengan "kas".
  const matchedData = DATA_ENTITY_KEYWORDS.filter((kw) => new RegExp(`\\b${kw}\\b`, 'i').test(lower));
  if (wordCount <= 12 && matchedData.length === 0) {
    return {
      effort: 'santai',
      reason: 'Pesan pendek (<=12 kata) tanpa kata analitis, entitas data, lampiran, atau mode analis/riset.',
      signals: ['pesan <= 12 kata, tanpa sinyal analitis'],
    };
  }
  if (matchedData.length > 0) signals.push(`entitas data: ${matchedData.slice(0, 3).join(', ')}`);

  return {
    effort: 'normal',
    reason: 'Pesan sedang tanpa sinyal khusus -- default menengah.',
    signals: signals.length > 0 ? signals : ['tidak ada sinyal khusus'],
  };
}
