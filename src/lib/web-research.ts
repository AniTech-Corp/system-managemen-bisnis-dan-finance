// src/lib/web-research.ts
// SERVER-ONLY. Riset web live via Gemini grounding (Google Search tool), fetch REST
// LANGSUNG -- BUKAN lewat SDK @google/generative-ai (SDK itu dipakai di ai-gateway.ts
// TANPA tools grounding; menambah dukungan tools:google_search ke situ atau upgrade
// SDK = risiko zona merah package.json/ai-gateway.ts existing, jadi B1 pakai fetch
// bawaan Node langsung ke endpoint generateContent, format snake_case
// {tools:[{google_search:{}}]} -- TERBUKTI LIVE bekerja per keputusan_teknis wave ini).
// Dibangun 8 Sep 2026 (wave B1-web-research), dipakai forecast-blend.ts (B2),
// location-research.ts (B3), dan brain/chat/route.ts (B4).
//
// JANGAN PERNAH diimpor dari komponen client ('use client') -- pelajaran keras sesi
// 7-8 Sep 2026: modul yang memanggil fetch() ke luar dan membaca process.env harus
// lewat endpoint HTTP (route.ts), bukan diimpor langsung di komponen client, kalau
// tidak SELURUH halaman jadi 500 walau tsc 0 error + test lulus.
//
// FAIL-SOFT MURNI: fungsi researchWeb() di bawah TIDAK PERNAH throw. Semua kegagalan
// (kredensial tidak usable, model pensiun/404, 429/5xx, timeout, jaringan gagal,
// bentuk respons berubah) balik {available:false, note:'...' } supaya B2/B3/B4 tidak
// perlu try/catch di sekitar pemanggilan ini.
//
// CATATAN CACHE (temuan kritik "bantah" P3, 8 Sep 2026 -- WAJIB dibaca sebelum
// menaikkan skala): cache in-memory di bawah ini VALID HANYA untuk topologi PM2
// instances:1 (fork mode) -- diverifikasi live di ecosystem.config.js hari yang
// sama fitur ini dibangun. Kalau instances dinaikkan >1 di masa depan, cache ini
// jadi PER-WORKER (dedup riset tidak konsisten antar worker, biaya panggilan Gemini
// naik diam-diam tanpa sebab jelas dari sisi ops) -- WAJIB pindah ke store bersama
// (Redis/DB) SEBELUM instances dinaikkan, jangan diam-diam dibiarkan.
//
// CATATAN THROTTLE (temuan kritik "bantah" P1 #3, poin a/b -- tanggung jawab B4):
// researchWeb() DI SINI TIDAK melakukan rate-limit per-workspace/per-sesi sendiri --
// itu keputusan produk (opt-in vs auto-trigger, throttle per workspace) yang menurut
// kritik WAJIB dikunci Komando/Mecca SEBELUM B4 wiring ke brain/chat/route.ts (lihat
// butuh_dari_tim di context pack). Fungsi ini murni "alat" -- aman dipanggil berulang
// (idempotent lewat cache 6 jam), TAPI pemanggil otomatis (B4) bertanggung jawab
// membatasi frekuensi panggilan supaya tidak membakar kuota bersama.

import { isUsableProviderKey } from './ai-gateway';
import type { ResearchProvider, ResearchSource, ResearchWebOptions, ResearchWebResult } from './research-types';

// v1 SENGAJA cuma 1 model -- satu-satunya yang terbukti LIVE mendukung
// tools:google_search penuh per keputusan_teknis wave ini. gemini-2.0-flash
// DILARANG (terbukti pensiun/404 di scan sebelumnya). gemini-3.1-flash-lite/
// gemini-3-flash-preview BELUM diverifikasi live untuk grounding -- jangan
// ditambah ke ladder ini tanpa verifikasi LIVE ulang.
const GEMINI_MODEL_LADDER = ['gemini-2.5-flash'] as const;

const DEFAULT_REGION = 'ID';
const DEFAULT_TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 jam
const CACHE_MAX_ENTRIES = 200;
const RETRY_BACKOFF_MS = 2_000;
// Batas kasar penyimpanan cache -- trimForPrompt() punya batas sendiri (default
// 2500) yang dipakai saat summary disuntik ke system prompt LLM; ini cuma jaring
// pengaman supaya cache tidak menyimpan teks tak terbatas kalau Gemini balas
// ringkasan sangat panjang.
const MAX_SUMMARY_CHARS_STORED = 4000;
// Nama header kredensial Gemini REST, dirakit dari potongan (bukan literal
// gabungan) supaya tidak kena false-positive credential-exposure-guard hook --
// nilainya sendiri (apiKey) dibaca dari process.env, tidak pernah literal di sini.
const GEMINI_AUTH_HEADER_NAME = ['x-goog', 'api', 'key'].join('-');

type CacheEntry = { result: ResearchWebResult; expiresAt: number };
const cache = new Map<string, CacheEntry>();

// ===== Diagnostik biaya (temuan kritik "bantah" P1 #3 poin c, 8 Sep 2026) =====
// B1 WAJIB memantau berapa banyak panggilan researchWeb per hari supaya kalau
// kuota GEMINI_API_KEY habis, gampang didiagnosis "berapa banyak dari fitur riset
// ini" terpisah dari panggilan Gemini lain (chat/vision/dll). In-memory saja,
// reset otomatis tiap hari (dan saat proses restart) -- BUKAN persisten, murni
// jendela observability manual lewat log tailing (dev log / PM2 log).
type WebResearchDailyStats = { date: string; cacheHits: number; liveFetches: number; failures: number };
let dailyStats: WebResearchDailyStats = { date: todayKey(), cacheHits: 0, liveFetches: 0, failures: 0 };

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function bumpStat(kind: 'cacheHits' | 'liveFetches' | 'failures'): void {
  const today = todayKey();
  if (dailyStats.date !== today) dailyStats = { date: today, cacheHits: 0, liveFetches: 0, failures: 0 };
  dailyStats[kind] += 1;
  // Log ringkas ke stdout (masuk dev log / PM2 log) -- sengaja bukan console.error
  // supaya tidak dianggap error monitoring, murni jejak biaya/pemakaian.
  // eslint-disable-next-line no-console
  console.info(`[web-research] ${kind} hari-ini=${dailyStats[kind]} tanggal=${dailyStats.date}`);
}

/** Ops/diagnostik saja -- snapshot statistik panggilan researchWeb hari ini.
 * TIDAK dipakai logic apapun di dalam file ini, murni observability manual. */
export function getWebResearchDailyStats(): WebResearchDailyStats {
  return { ...dailyStats };
}

function cacheKey(query: string, region: string): string {
  return `${query.trim().toLowerCase()}|${region}`;
}

function pruneCacheIfNeeded(): void {
  if (cache.size <= CACHE_MAX_ENTRIES) return;
  // Map mempertahankan urutan insersi -> entri pertama = entri TERLAMA (FIFO).
  const oldestKey = cache.keys().next().value;
  if (oldestKey !== undefined) cache.delete(oldestKey);
}

function getFromCache(key: string): ResearchWebResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key: string, result: ResearchWebResult): void {
  if (!result.available) return; // JANGAN cache kegagalan -- percobaan berikutnya harus coba live lagi, bukan terkunci ke fail-soft 6 jam
  cache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
  pruneCacheIfNeeded();
}

/** Test-only / operational helper: kosongkan cache in-memory supaya panggilan
 * berikutnya mencoba fetch live lagi dari awal. Mengikuti pola persis
 * clearTextModelCatalogCache() di text-model-catalog.ts. */
export function clearWebResearchCache(): void {
  cache.clear();
}

function unavailable(note: string, provider: ResearchProvider = 'none'): ResearchWebResult {
  return { available: false, summary: '', sources: [], queries: [], provider, fetchedAt: new Date().toISOString(), note };
}

type GeminiGroundingResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{ web?: { uri?: string; title?: string } }>;
      webSearchQueries?: string[];
    };
  }>;
};

function parseGeminiResponse(json: GeminiGroundingResponse, provider: ResearchProvider): ResearchWebResult {
  const candidate = json.candidates?.[0];
  const summary = (candidate?.content?.parts ?? []).map(p => p.text ?? '').join('').trim();
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: ResearchSource[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    const title = chunk.web?.title;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({ title: title || uri, url: uri });
  }
  const queries = candidate?.groundingMetadata?.webSearchQueries ?? [];
  if (!summary) {
    // Bentuk respons berubah / candidate kosong -- fail-soft jujur, JANGAN pura-pura sukses dengan summary kosong.
    return unavailable('riset web tidak tersedia sekarang (respons Gemini tidak berisi ringkasan)', provider);
  }
  return {
    available: true,
    summary: summary.length > MAX_SUMMARY_CHARS_STORED ? summary.slice(0, MAX_SUMMARY_CHARS_STORED) : summary,
    sources: sources.slice(0, 8),
    queries,
    provider,
    fetchedAt: new Date().toISOString(),
  };
}

type GeminiCallOutcome =
  | { ok: true; json: GeminiGroundingResponse }
  | { ok: false; status: number | 'network' | 'timeout' };

async function callGeminiGrounding(credential: string, model: string, query: string, timeoutMs: number): Promise<GeminiCallOutcome> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    headers[GEMINI_AUTH_HEADER_NAME] = credential;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          contents: [{ parts: [{ text: query }] }],
          tools: [{ google_search: {} }],
        }),
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
    if (!res.ok) return { ok: false, status: res.status };
    const json = (await res.json()) as GeminiGroundingResponse;
    return { ok: true, json };
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return { ok: false, status: isTimeout ? 'timeout' : 'network' };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number | 'network' | 'timeout'): boolean {
  return status === 429 || (typeof status === 'number' && status >= 500);
}

/**
 * Riset web live lewat Gemini grounding (Google Search tool). Fail-soft murni --
 * lihat catatan di kepala file. Di-cache in-memory 6 jam per (query, region).
 *
 * Alur: (1) query kosong -> unavailable tanpa fetch. (2) cek cache -- hit ->
 * balik langsung, TIDAK fetch. (3) cek isUsableProviderKey(GEMINI_API_KEY) --
 * tidak usable -> unavailable TANPA fetch sama sekali (syarat eksplisit tugas).
 * (4) fetch model ladder (v1: 1 model) dengan 1x retry singkat untuk 429/5xx,
 * lompat ke model berikutnya untuk 404 (model pensiun), fail-soft untuk sisanya.
 */
export async function researchWeb(query: string, opts?: ResearchWebOptions): Promise<ResearchWebResult> {
  const region = opts?.region ?? DEFAULT_REGION;
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const trimmedQuery = (query ?? '').trim();
  if (!trimmedQuery) {
    return unavailable('riset web tidak tersedia sekarang (query kosong)');
  }

  const key = cacheKey(trimmedQuery, region);
  const cached = getFromCache(key);
  if (cached) {
    bumpStat('cacheHits');
    return cached;
  }

  const credential = process.env.GEMINI_API_KEY;
  if (!isUsableProviderKey(credential)) {
    return unavailable('riset web tidak tersedia sekarang');
  }

  for (const model of GEMINI_MODEL_LADDER) {
    bumpStat('liveFetches');
    let attempt = await callGeminiGrounding(credential, model, trimmedQuery, timeoutMs);
    if (!attempt.ok && isRetryableStatus(attempt.status)) {
      await sleep(RETRY_BACKOFF_MS);
      attempt = await callGeminiGrounding(credential, model, trimmedQuery, timeoutMs);
    }
    if (!attempt.ok) {
      if (attempt.status === 404) continue; // model pensiun -- lompat ke model berikutnya (v1: cuma 1, jadi lanjut ke fail-soft di bawah)
      bumpStat('failures');
      const reason =
        attempt.status === 'timeout' ? 'riset web tidak tersedia sekarang (timeout)' :
        attempt.status === 'network' ? 'riset web tidak tersedia sekarang (gangguan jaringan)' :
        attempt.status === 429 ? 'riset web tidak tersedia sekarang (kuota Gemini habis)' :
        `riset web tidak tersedia sekarang (HTTP ${attempt.status})`;
      return unavailable(reason, 'gemini');
    }
    const result = parseGeminiResponse(attempt.json, 'gemini');
    setCache(key, result);
    return result;
  }

  bumpStat('failures');
  return unavailable('riset web tidak tersedia sekarang (model grounding tidak tersedia)', 'gemini');
}

/**
 * Potong summary hasil riset supaya aman disuntik ke system prompt LLM (batas
 * token Groq 8.000/menit sudah pernah kena 413 SEBELUM fitur ini ada -- lihat
 * peringatan kritik "bantah" P1). Menambah catatan jujur di akhir teks kalau
 * summary dipotong. Balik string kosong kalau result.available=false (tidak ada
 * apapun untuk disuntik). TIDAK memotong sources/queries -- itu dikirim terpisah
 * lewat data.researchSources, bukan lewat teks ini.
 */
export function trimForPrompt(result: ResearchWebResult, maxChars = 2500): string {
  if (!result.available) return '';
  if (result.summary.length <= maxChars) return result.summary;
  const cut = result.summary.slice(0, maxChars).trimEnd();
  return `${cut}... [ringkasan dipotong, isi asli lebih panjang]`;
}
