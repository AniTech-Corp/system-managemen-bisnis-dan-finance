/**
 * FIX gap kemampuan-003 (audit 7 Sep 2026): di src/app/api/v1/brain/chat/route.ts,
 * buildActionCard() dipasang murni dari keyword pesan pengguna + truthiness kasar
 * data DB -- SAMA SEKALI TIDAK MEMBACA isi jawaban LLM itu sendiri. Terbukti live:
 * prompt "Scale budget iklan video TikTok 20% dan update ke dashboard" ke workspace
 * tanpa data budget TikTok menghasilkan teks AI yang JUJUR bilang "tidak ada nilai
 * budget iklan TikTok yang tercatat di sistem", TAPI actionCard SCALE_ADS dengan
 * tombol "Setujui & Terapkan" tetap muncul mengajak eksekusi -- kontradiksi langsung
 * dengan narasi AI sendiri.
 *
 * aiTextIndicatesMissingData() adalah pagar minimal: kalau jawaban AI sendiri
 * secara eksplisit bilang datanya tidak ada/belum tercatat, actionCard TIDAK boleh
 * dipasang, apapun hasil keyword+truthiness DB dari buildActionCard(). Diletakkan di
 * src/lib/ai-brain/ (bukan langsung di route.ts) supaya bisa diuji via node:test
 * tanpa perlu memuat seluruh handler route Next.js (route.ts App Router hanya
 * mengizinkan export method HTTP + config yang dikenal Next -- export fungsi bantu
 * lepas dari sana berisiko kena validasi tipe route Next.js yang ketat).
 */

const MISSING_DATA_PHRASES = [
  'tidak ada nilai',
  'tidak ada data',
  'belum ada data',
  'belum tercatat',
  'tidak tercatat',
  'data tidak tersedia',
  'datanya belum ada',
  'belum punya data',
  'tidak ditemukan data',
];

export function aiTextIndicatesMissingData(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return MISSING_DATA_PHRASES.some((phrase) => lower.includes(phrase));
}
