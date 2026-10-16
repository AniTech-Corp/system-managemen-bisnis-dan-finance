// src/lib/text-model-catalog.ts
// SERVER-ONLY. JANGAN PERNAH diimpor dari komponen client -- pelajaran paling
// kritis dari insiden 8 Sep siang: komponen client yang menyeret modul
// node-only bikin SELURUH halaman 500 walau tsc 0 error + test lulus. File
// ini memanggil fetch() ke luar dan membaca process.env, jadi harus lewat
// endpoint HTTP (src/app/api/v1/brain/models/route.ts) untuk dikonsumsi UI.
// Dibuat 8 Sep 2026 untuk fitur Setelan Jawaban + Composer Toolbar KLIR.
//
// Verifikasi bentuk response OpenRouter /api/v1/models dilakukan lewat skrip
// node sekali-pakai (dijalankan 8 Sep 2026, kredensial dibaca dari .env lewat
// process.env, TIDAK PERNAH dicetak ke console/log) -- skrip itu sudah dihapus
// setelah dipakai, TIDAK disertakan di repo. Temuan kunci dari verifikasi
// tersebut (dipakai sebagai dasar implementasi di bawah):
//   - response.data adalah array, tiap item punya architecture.output_modalities
//     (array string) -- filter model teks pakai .includes('text').
//   - pricing.prompt BERTIPE STRING (mis. "0.00001"), BUKAN number -- wajib
//     Number()/parseFloat() dulu sebelum dikali, dengan penanganan NaN/undefined
//     eksplisit (root cause temuan KRITIS/TINGGI kritik "terlewat" 8 Sep: kalau
//     tidak di-parse, hasil kali jadi NaN diam-diam untuk sebagian model).
//   - Ke-5 ID fallback statis di bawah SEMUA terverifikasi ADA di katalog live
//     OpenRouter per 8 Sep 2026 (dicek satu-satu, bukan diasumsikan).
//   - field `reasoning` (kalau ada) berbentuk
//     { mandatory?, default_enabled?, supported_efforts?: string[], default_effort? }
//     dan supported_efforts SANGAT bervariasi antar model (22 kombinasi
//     berbeda ditemukan dari 428 model saat verifikasi) -- makanya
//     getModelReasoningEfforts() diekspos di bawah supaya B3 bisa mengecek
//     dukungan model tujuan sebelum mengirim reasoning.effort literal
//     ('medium'/'high'), bukan asumsi semua model mendukung nilai yang sama.

import type { ModelCostClass, TextModelOption } from './chat-composer-types';

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 jam, sesuai spesifikasi wave
const FETCH_TIMEOUT_MS = 15_000;
// Kontrol biaya server-side (syarat GO Council poin 2): model dengan harga
// prompt di atas ini per-juta-token dibuang total dari katalog, tidak pernah
// muncul di hasil discoverTextModels() sama sekali (bukan cuma disembunyikan
// di UI) -- jadi validateTextModel() otomatis menolak ID model semahal ini juga.
const MAX_PRICE_PER_MILLION_USD = 20;

/** 5 fallback dipakai HANYA kalau fetch OpenRouter gagal (network/401/402/bentuk
 * response berubah). Semua 5 ID diverifikasi ADA di katalog live OpenRouter
 * per 8 Sep 2026 (lihat catatan verifikasi di atas). pricingKnown SENGAJA
 * false untuk seluruh entri fallback -- kondisi ini terjadi persis saat kita
 * TIDAK punya data harga terkini (fetch live gagal), jadi jujur bilang "tidak
 * diketahui" lebih benar daripada menampilkan angka harga yang mungkin sudah
 * basi. reasoning di bawah adalah fakta yang diamati saat verifikasi 8 Sep
 * (bisa berubah di sisi provider kapan saja, makanya tidak dianggap live). */
const FALLBACK_MODELS: TextModelOption[] = [
  { id: 'deepseek/deepseek-v4.1-flash', name: 'DeepSeek v4.1 Flash', provider: 'deepseek', costClass: 'hemat', pricingKnown: false, reasoning: true, recommended: true },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', costClass: 'hemat', pricingKnown: false, reasoning: false, recommended: true },
  { id: 'openai/gpt-5.6-luna', name: 'GPT-5.6 Luna', provider: 'openai', costClass: 'standar', pricingKnown: false, reasoning: true, recommended: true },
  { id: 'qwen/qwen3.8-flash', name: 'Qwen 3.8 Flash', provider: 'qwen', costClass: 'hemat', pricingKnown: false, reasoning: true, recommended: true },
  { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'google', costClass: 'standar', pricingKnown: false, reasoning: true, recommended: true },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'deepseek', costClass: 'standar', pricingKnown: false, reasoning: true, recommended: true },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek', costClass: 'standar', pricingKnown: false, reasoning: false, recommended: true },
  { id: 'z-ai/glm-5.2', name: 'GLM 5.2', provider: 'z-ai', costClass: 'standar', pricingKnown: false, reasoning: true, recommended: true },
  { id: 'openai/gpt-5.3-codex', name: 'GPT-5.3 Codex', provider: 'openai', costClass: 'standar', pricingKnown: false, reasoning: true, recommended: true },
];
const RECOMMENDED_IDS = new Set(FALLBACK_MODELS.map(m => m.id));

type RawReasoning = { mandatory?: boolean; default_enabled?: boolean; supported_efforts?: string[]; default_effort?: string };
type RawModel = {
  id?: string;
  name?: string;
  context_length?: number;
  architecture?: { output_modalities?: string[] };
  pricing?: { prompt?: string | number };
  supported_parameters?: string[];
  reasoning?: RawReasoning;
};

let cache: { expires: number; models: TextModelOption[] } | null = null;
// Diisi HANYA saat live fetch berhasil (lihat discoverTextModels) -- kosong
// selama katalog memakai FALLBACK_MODELS, karena kita genuinely tidak punya
// data reasoning live untuk kondisi itu.
const reasoningCache = new Map<string, RawReasoning>();

function computeCostClass(pricePromptPerM: number | undefined): ModelCostClass {
  if (pricePromptPerM === undefined) return 'standar';
  if (pricePromptPerM < 0.5) return 'hemat';
  if (pricePromptPerM < 3) return 'standar';
  return 'premium';
}

function normalize(raw: RawModel): TextModelOption | null {
  if (!raw.id || !raw.architecture?.output_modalities?.includes('text')) return null;
  const rawPrice = raw.pricing?.prompt;
  const parsedPrice = typeof rawPrice === 'string' ? Number(rawPrice) : rawPrice;
  const pricingKnown = typeof parsedPrice === 'number' && Number.isFinite(parsedPrice);
  const pricePromptPerM = pricingKnown ? (parsedPrice as number) * 1_000_000 : undefined;
  if (pricingKnown && pricePromptPerM !== undefined && pricePromptPerM > MAX_PRICE_PER_MILLION_USD) return null;
  const reasoning = !!raw.reasoning || (Array.isArray(raw.supported_parameters) && raw.supported_parameters.includes('reasoning'));
  return {
    id: raw.id,
    name: raw.name || raw.id,
    provider: raw.id.split('/')[0] || 'unknown',
    costClass: pricingKnown ? computeCostClass(pricePromptPerM) : 'standar',
    pricePromptPerM: pricingKnown ? pricePromptPerM : undefined,
    pricingKnown,
    reasoning,
    recommended: RECOMMENDED_IDS.has(raw.id),
    contextLength: raw.context_length,
  };
}

/** Ambil katalog model teks OpenRouter, di-cache in-memory 1 jam. TIDAK
 * PERNAH throw -- kalau fetch gagal dengan alasan apapun (network, 401, 402
 * saldo habis, bentuk response berubah, kredensial kosong), fungsi ini
 * diam-diam jatuh ke FALLBACK_MODELS. Konsumen (route.ts, B3 di brain/chat)
 * tidak perlu try/catch di sekitar pemanggilan ini. */
export async function discoverTextModels(): Promise<TextModelOption[]> {
  const now = Date.now();
  if (cache && cache.expires > now) return cache.models;
  try {
    const authToken = process.env.OPENROUTER_API_KEY;
    if (!authToken) throw new Error('Kredensial OpenRouter belum dikonfigurasi');
    const res = await fetch(OPENROUTER_MODELS_URL, {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`OpenRouter /models HTTP ${res.status}`);
    const json = (await res.json()) as { data?: RawModel[] };
    if (!Array.isArray(json.data)) throw new Error('Bentuk respons /models tidak dikenal');
    const models: TextModelOption[] = [];
    const nextReasoningCache = new Map<string, RawReasoning>();
    for (const raw of json.data) {
      const normalized = normalize(raw);
      if (normalized) {
        models.push(normalized);
        if (raw.id && raw.reasoning) nextReasoningCache.set(raw.id, raw.reasoning);
      }
    }
    if (!models.length) throw new Error('Katalog model teks kosong setelah filter');
    reasoningCache.clear();
    for (const [id, r] of nextReasoningCache) reasoningCache.set(id, r);
    cache = { expires: now + CACHE_TTL_MS, models };
    return models;
  } catch {
    // Fetch gagal -- fallback statis. SENGAJA TIDAK di-set ke `cache` supaya
    // percobaan live berikutnya (request selanjutnya, setelah OR pulih) tetap
    // dicoba dari awal, bukan terkunci ke fallback selama 1 jam penuh.
    return FALLBACK_MODELS;
  }
}

/** Cek apakah sebuah model ID ada di katalog (live atau fallback). Dipakai
 * B3 SEBELUM meneruskan modelId dari body request ke provider -- allowlist +
 * kontrol biaya server-side (syarat GO Council poin 2). ID yang tidak
 * ditemukan (termasuk model mahal yang sudah dibuang di normalize()) balik
 * false, BUKAN throw -- pemanggil yang memutuskan fallback ke 'auto'. */
export async function validateTextModel(id: string): Promise<boolean> {
  if (!id) return false;
  const models = await discoverTextModels();
  return models.some(m => m.id === id);
}

/** Daftar reasoning effort yang didukung sebuah model, berdasarkan data live
 * OpenRouter (lihat catatan verifikasi di atas file ini). Undefined kalau:
 * model tidak diketahui, model tidak mendukung reasoning sama sekali, atau
 * katalog sedang memakai FALLBACK_MODELS (tidak ada data live untuk kondisi
 * itu). Pemanggil (B3) WAJIB treat undefined sebagai "jangan kirim field
 * reasoning" -- JANGAN asumsikan semua model mendukung 'medium'/'high'. */
export function getModelReasoningEfforts(id: string): string[] | undefined {
  return reasoningCache.get(id)?.supported_efforts;
}

/** Test-only / operational helper: kosongkan cache in-memory supaya panggilan
 * berikutnya mencoba fetch live lagi dari awal. */
export function clearTextModelCatalogCache(): void {
  cache = null;
  reasoningCache.clear();
}
