// src/lib/research-types.ts
// SSOT tipe murni untuk fitur riset web + prediksi forecast + analisis lokasi.
// Dibangun 8 Sep 2026 (wave B1, dipakai B2/B3/B4/B5). NOL import, NOL efek
// samping -- aman diimpor modul server (web-research.ts, forecast-blend.ts,
// location-research.ts, route handler) MAUPUN modul client (ResearchSourcesCard.tsx,
// ForecastCard.tsx, LocationForm.tsx) tanpa risiko menyeret dependency node-only
// ke bundle client (pelajaran keras sesi 7-8 Sep, lihat context pack PERJALANAN).
// JANGAN definisikan ulang tipe ini di tempat lain -- import dari sini saja.

// ===== RISET WEB =====

export type ResearchProvider = 'gemini' | 'openrouter' | 'none';

export interface ResearchSource {
  title: string;
  url: string;
}

export interface ResearchWebResult {
  available: boolean;
  summary: string;           // dipotong maks ~2500 char (lihat trimForPrompt), kosong kalau available=false
  sources: ResearchSource[]; // maks ~8, dari groundingChunks, uri di-dedupe
  queries: string[];         // dari webSearchQueries provider
  provider: ResearchProvider;
  fetchedAt: string;         // ISO 8601
  note?: string;             // WAJIB diisi kalau available=false (alasan jujur) atau kalau summary dipotong
}

export interface ResearchWebOptions {
  region?: string;    // default 'ID'
  maxSources?: number; // default 6
  timeoutMs?: number;  // default 25000
}

// ===== DETEKSI INTENT (murni, dipakai brain/chat/route.ts) =====

export type ResearchIntentKind = 'trend' | 'competitor' | 'location' | 'forecast';

export type HorizonMonths = 1 | 3 | 6 | 12;

// ===== PREDIKSI / FORECAST BLEND =====

export interface ExternalSignal {
  label: string;
  effectPct: number;              // + dorong naik, - dorong turun, terhadap baseline bulan berjalan
  source: string;                 // judul/URL singkat sumber riset dasar sinyal ini
  confidence: 'low' | 'medium';   // heuristik dari riset web TIDAK PERNAH 'high' -- hanya data internal boleh setara itu
}

export interface ForecastExtraData {
  targetRevenue?: number;   // harus > 0 kalau diisi
  priceChangePct?: number;  // -100..500
  newBranch?: boolean;
  costChangePct?: number;   // -100..500
  notes?: string;           // maks 500 karakter
}

export interface BlendedForecastMonth {
  month: string; // label "Jan 2027" dst
  baseline: number;
  pessimistic: number;
  optimistic: number;
}

export interface DataSufficiency {
  ok: boolean;
  reason: string; // WAJIB diisi walau ok=true, mis. "cukup, 4 bulan histori transaksi"
}

export interface BlendedForecastResult {
  horizonMonths: HorizonMonths;
  table: BlendedForecastMonth[];
  assumptions: string[];
  externalSignalsUsed: ExternalSignal[];
  dataSufficiency: DataSufficiency;
  summary: string; // 1 paragraf naratif, WAJIB pisah DATA INTERNAL vs DATA PUBLIK vs ASUMSI
}

// ===== ANALISIS LOKASI =====

export type LocationPurpose = 'cabang_baru' | 'sekitar_kantor';

export interface LocationCompetitor {
  name: string;
  category?: string;
  note?: string;   // harga/rating/jarak dari riset, kalau ada
  source?: string; // URL asal info, kalau ada
}

export type LocationVerdict = 'cocok' | 'hati-hati' | 'kurang cocok' | 'tidak cukup data';

export interface LocationAnalysisInput {
  businessName: string;
  category: string;
  area: string;       // alamat/lokasi bebas teks
  radiusKm?: number;  // default 2
  purpose: LocationPurpose;
}

export interface LocationAnalysisResult {
  providerUsed: 'google_maps' | 'web';
  competitors: LocationCompetitor[];
  summary: string;
  verdict: LocationVerdict;
  reasons: string[];
  sources: ResearchSource[];
}

export interface LocationPromptNeeded {
  needs: Array<'businessName' | 'area'>;
}
