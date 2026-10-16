// src/lib/research-intent.ts
// MURNI (nol import selain research-types.ts, nol I/O, nol efek samping) --
// aman diimpor server MAUPUN client tanpa risiko menyeret dependency node-only.
// Dibangun 8 Sep 2026 (wave B1-web-research). Dipakai brain/chat/route.ts (B4)
// untuk mendeteksi kapan pesan pengguna menyiratkan kebutuhan riset web/prediksi/
// lokasi, DAN untuk mengekstrak parameter (horizon bulan, lokasi) dari teks bebas.
//
// CATATAN GATING (temuan kritik "bantah" P0 #2, 8 Sep 2026 -- WAJIB dibaca sebelum
// dipakai di jalur otomatis): fungsi detectResearchIntent() di bawah TIDAK tahu apa
// yang akan dilakukan pemanggilnya dengan hasilnya -- keputusan APAKAH deteksi ini
// boleh memicu researchWeb()/forecast OTOMATIS untuk setiap pesan bebas (vs HANYA
// lewat slash-command/tombol next-action eksplisit) adalah keputusan produk yang
// menurut kritik WAJIB dikunci Komando/Mecca SEBELUM B4 wiring. Untuk mengurangi
// risiko salah-picu di pesan bisnis biasa, regex di bawah SENGAJA dibuat butuh
// KOMBINASI kata kunci yang cukup spesifik (bukan kata tunggal umum seperti
// "alamat" atau "di sekitar" berdiri sendiri) -- tapi ini TETAP heuristik teks
// bebas, bukan pengganti keputusan gating di B4.

import type { HorizonMonths, ResearchIntentKind } from './research-types';

// Urutan prioritas saat >1 kind cocok sekaligus (mis. "prediksi kompetitor 3 bulan
// ke depan" cocok forecast DAN competitor): forecast > location > competitor > trend.
// Alasan: forecast paling spesifik (biasanya minta angka proyeksi konkret), location
// juga spesifik (soal buka cabang/analisis lokasi), sementara competitor/trend lebih
// umum dan lebih berisiko salah-picu (lihat catatan gating di atas).

const FORECAST_INTENT_RE = /\b(prediksi|proyeksi|proyeksikan|perkirakan|masa depan|target\s+ke\s*depan)\b/i;

const LOCATION_INTENT_RE = /\b(cabang\s+baru|buka\s+cabang|lokasi\s+(usaha|bisnis|kantor|toko)(?:\s+(baru|saya))?|alamat\s+(kantor|usaha|toko)(?:\s+(baru|saya))?)\b/i;

const COMPETITOR_INTENT_RE = /\b(kompetitor|pesaing|riset\s+pasar|(?:bisnis|usaha|toko)\s+(?:di\s+)?sekitar|(?:di\s+)?sekitar\s+(?:lokasi|kantor|toko|usaha)(?:\s+saya)?)\b/i;

const TREND_INTENT_RE = /\b(tren(?:d(?:ing)?)?|lagi\s+(?:ngetren|hits|viral|rame|ramai)|sedang\s+terjadi|lagi\s+terjadi)\b/i;

/**
 * Deteksi kind riset dari teks bebas pengguna. Balik null kalau tidak ada
 * kombinasi kata kunci yang cocok sama sekali -- TIDAK menebak, TIDAK pernah
 * memaksa salah satu kind kalau memang tidak yakin.
 */
export function detectResearchIntent(text: string): ResearchIntentKind | null {
  if (!text || !text.trim()) return null;
  if (FORECAST_INTENT_RE.test(text)) return 'forecast';
  if (LOCATION_INTENT_RE.test(text)) return 'location';
  if (COMPETITOR_INTENT_RE.test(text)) return 'competitor';
  if (TREND_INTENT_RE.test(text)) return 'trend';
  return null;
}

/**
 * Ekstrak horizon bulan dari teks bebas ("1 bulan", "3 bulan"/"kuartal"/"triwulan",
 * "6 bulan"/"semester", "1 tahun"/"tahun depan"/"setahun"). Balik null kalau tidak
 * ada pola yang cocok -- pemanggil (forecast-blend/route) yang menentukan default
 * (spesifikasi wave ini: default 3 bulan kalau null).
 */
export function extractHorizonMonths(text: string): HorizonMonths | null {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\b1\s*tahun\b|\btahun\s+depan\b|\bsetahun\b/.test(t)) return 12;
  if (/\b6\s*bulan\b|\bsemester\b/.test(t)) return 6;
  if (/\bkuartal\b|\btriwulan\b|\b3\s*bulan\b/.test(t)) return 3;
  if (/\b1\s*bulan\b|\bsebulan\b|\bbulan\s+depan\b/.test(t)) return 1;
  return null;
}

// Frasa pemicu ekstraksi lokasi, dicoba berurutan -- yang pertama cocok dipakai.
// Best-effort: kalau tidak ada frasa cocok atau teks setelahnya terlalu pendek,
// balik null. JANGAN PERNAH mengarang lokasi yang tidak ada di teks aslinya.
const LOCATION_EXTRACT_PATTERNS: RegExp[] = [
  // 8 Sep sore (temuan verifikator): "mau buka cabang baru di Bandung" -> Bandung
  /(?:cabang\s+baru|buka\s+cabang)(?:\s+\w+){0,3}?\s+di\s+([^.,;\n]{3,80})/i,
  /(?:di\s+sekitar|sekitar)\s+([^.,;\n]{3,80})/i,
  /lokasi(?:nya)?(?:\s+(?:usaha|bisnis|kantor|toko))?(?:\s+(?:saya|kami))?(?:\s+(?:di|adalah|:))\s*([^.,;\n]{3,80})/i,
  /alamat(?:nya)?(?:\s+(?:usaha|bisnis|kantor|toko))?(?:\s+(?:saya|kami))?(?:\s+(?:di|adalah|:))\s*([^.,;\n]{3,80})/i,
];

/**
 * Ekstrak teks lokasi/alamat dari pesan bebas (heuristik best-effort, BUKAN
 * NLP terstruktur). Balik null kalau tidak yakin -- pemanggil (B4/LocationForm)
 * yang bertanggung jawab minta klarifikasi user lewat data.locationPrompt kalau
 * hasilnya null, BUKAN menebak alamat.
 */
export function extractLocation(text: string): string | null {
  if (!text) return null;
  for (const pattern of LOCATION_EXTRACT_PATTERNS) {
    const match = text.match(pattern);
    const candidate = match?.[1]?.trim();
    if (candidate && candidate.length >= 3) return candidate;
  }
  return null;
}
