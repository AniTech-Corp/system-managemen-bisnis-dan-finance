import { MediaError } from './media-errors';
import type { CatalogKind, MediaModelOption } from './media-types';

export const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
// REVISI 11 Sep 2026 sore (arahan Mecca: "generate video dan gambar defaultnya
// yang model murah juga", selaras doktrin default-murah yang sudah dipakai chat
// teks di model-tiers.ts): diganti dari 'google/gemini-3.1-flash-image' (verified
// live 2026-09-04) ke varian 'flash-lite' saudaranya sendiri -- HARGA LIVE dicek
// langsung ke /images/models/{id}/endpoints (bukan asumsi): flash-image
// $0.00006/token output-image vs flash-lite-image $0.00003/token -- PERSIS
// SETENGAH harga, provider+family sama (Google), jadi perbandingan apple-to-apple.
// Trade-off jujur: flash-lite-image cuma dukung resolution "1K" (flash-image
// dukung 512/1K/2K/4K) -- aspect_ratio (14 opsi) dan input_references (0-14,
// dipakai brand-consistency) IDENTIK, jadi yang hilang cuma opsi resolusi di atas
// 1K. Wajar untuk tier default/murah; user yang butuh 2K/4K tinggal pilih model
// lain eksplisit dari dropdown (GET /api/v1/media/models?kind=image, live).
export const DEFAULT_IMAGE_MODEL = 'bytedance-seed/seedream-5-0-lite';
export const PRO_IMAGE_MODEL = 'bytedance-seed/seedream-5-0-pro';
export const DEFAULT_TTS_MODEL = 'google/lyria-3-clip-preview';
export const DEFAULT_STT_MODEL = 'google/chirp-3';
export const DEFAULT_GEMINI_STT_MODEL = 'gemini-3.1-flash-preview';
export const DEFAULT_VIDEO_MODEL = 'bytedance/seedance-1-5-pro';
export const PRO_VIDEO_MODEL = 'bytedance/seedance-2.5';
const cache = new Map<CatalogKind, { expires: number; models: MediaModelOption[] }>();
export function hasProviderKey(name: string) {
  const value = process.env[name]?.trim();
  return !!value && value.length > 10 && !/dummy|placeholder|your[_-]|changeme|\.\.\./i.test(value);
}
export function mediaCapabilities() {
  const or = hasProviderKey('OPENROUTER_API_KEY');
  return {
    image: process.env.MARKETING_MEDIA_IMAGE_ENABLED !== 'false' && (or || hasProviderKey('GEMINI_API_KEY')),
    audio: process.env.MARKETING_MEDIA_TTS_ENABLED !== 'false' && or,
    transcription: process.env.MARKETING_MEDIA_STT_ENABLED !== 'false' && (or || hasProviderKey('GROQ_API_KEY') || hasProviderKey('GEMINI_API_KEY')),
    notebook: process.env.MARKETING_NOTEBOOK_ENABLED !== 'false',
    // Roadmap 7 Sep item 4.6: video render OpenRouter (POST /api/v1/videos, async
    // job-based, beda dari image/audio yang sinkron) -- diverifikasi endpoint-nya
    // genuinely ada via WebSearch dokumentasi resmi OpenRouter hari ini, BUKAN
    // asumsi. Sama seperti image/audio, default ON begitu OPENROUTER_API_KEY ada
    // (Mecca eksplisit approve pemakaian saldo OpenRouter perusahaan untuk ini).
    video: process.env.MARKETING_MEDIA_VIDEO_ENABLED !== 'false' && or,
  };
}
export function orHeaders() {
  if (!hasProviderKey('OPENROUTER_API_KEY')) throw new MediaError('NO_PROVIDER', 'Provider OpenRouter belum dikonfigurasi.', 503);
  return { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json', 'X-OpenRouter-Title': 'KLIR Media' };
}
export async function providerFetch(url: string, init: RequestInit = {}) {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(120_000), cache: 'no-store' });
  } catch {
    throw new MediaError('PROVIDER_ERROR', 'Provider tidak merespons. Coba lagi nanti.', 502, true);
  }
  if (!response.ok) {
    // Never forward provider bodies: they may contain credentials, prompts, or binary data.
    throw new MediaError('PROVIDER_ERROR', `Provider mengembalikan HTTP ${response.status}. Periksa kuota atau coba lagi.`, 502, response.status === 429 || response.status >= 500);
  }
  return response;
}
export async function providerJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value: unknown = await response.json();
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  } catch { /* normalized below */ }
  throw new MediaError('PROVIDER_ERROR', 'Respons provider tidak dapat dibaca.', 502, true);
}
type Descriptor = { type?: string; values?: string[] };
type PricingLine = { billable?: string; unit?: string; cost_usd?: number | string };
type RawModel = {
  id?: string; name?: string;
  architecture?: {input_modalities?: string[]; output_modalities?: string[]};
  supported_parameters?: Record<string, Descriptor>;
  pricing?: PricingLine[];
};
// CATATAN JUJUR (verified 7 Sep via panggilan langsung ke API): /images/models
// TIDAK membawa field pricing sama sekali -- harga per model image cuma ada di
// sub-resource /images/models/{id}/endpoints (per-provider, butuh 1 fetch
// terpisah tiap model). Fetch itu untuk SEMUA model di katalog upfront (28+
// model) terlalu mahal/lambat cuma buat isi dropdown, jadi TIDAK dilakukan --
// fungsi ini tetap ada untuk kalau-kalau OpenRouter suatu saat menambah field ini
// di /images/models, tapi realistisnya selalu return undefined untuk image hari
// ini. Biaya nyata gambar tetap kelihatan SETELAH generate (lihat MediaResult.
// usage.costUsd, ditampilkan di StudioResult.tsx). /videos/models BEDA -- endpoint
// itu genuinely membawa pricing_skus langsung di listing (lihat normalizeVideoModel),
// makanya model-picker video bisa tampil harga di awal tapi gambar belum bisa.
function extractPricing(raw: RawModel): MediaModelOption['pricing'] {
  const line = raw.pricing?.[0];
  const cost = typeof line?.cost_usd === 'string' ? Number(line.cost_usd) : line?.cost_usd;
  if (typeof cost !== 'number' || !Number.isFinite(cost)) return undefined;
  return { unit: line?.billable || line?.unit, costUsd: cost };
}
export function normalizeImageModel(raw: RawModel): MediaModelOption | null {
  if (!raw.id || !raw.architecture?.output_modalities?.includes('image')) return null;
  const params = raw.supported_parameters || {};
  const formats = params.output_format?.values;
  // Raster-only UI: never render unsanitized provider SVG.
  if (formats?.length && !formats.some(x => ['png', 'jpeg', 'webp'].includes(x))) return null;
  return {
    id: raw.id, name: raw.name || raw.id, provider: 'openrouter', verified: true,
    capabilities: {
      inputModalities: raw.architecture.input_modalities, outputModalities: raw.architecture.output_modalities,
      aspectRatios: params.aspect_ratio?.values, resolutions: params.resolution?.values,
      qualities: params.quality?.values, outputFormats: formats,
      supportsReferenceImages: !!params.input_references,
    },
    pricing: extractPricing(raw),
  };
}
// Shape /api/v1/videos/models (beda dari /images/models -- verified via WebSearch
// dokumentasi resmi OpenRouter 7 Sep, bukan asumsi dari pola image).
type RawVideoModel = {
  id?: string; canonical_slug?: string; name?: string; description?: string;
  supported_durations?: number[]; supported_resolutions?: string[]; supported_aspect_ratios?: string[];
  pricing_skus?: Record<string, number | string>;
};
export function normalizeVideoModel(raw: RawVideoModel): MediaModelOption | null {
  if (!raw.id) return null;
  const skuEntries = Object.entries(raw.pricing_skus || {});
  const [unit, rawCost] = skuEntries[0] || [];
  const cost = typeof rawCost === 'string' ? Number(rawCost) : rawCost;
  return {
    id: raw.id, name: raw.name || raw.id, provider: 'openrouter', verified: true,
    capabilities: {
      resolutions: raw.supported_resolutions, aspectRatios: raw.supported_aspect_ratios,
      durations: raw.supported_durations,
    },
    pricing: typeof cost === 'number' && Number.isFinite(cost) ? { unit, costUsd: cost } : undefined,
  };
}
export function configuredModel(kind: CatalogKind) {
  return kind === 'image' ? process.env.OPENROUTER_IMAGE_MODEL || DEFAULT_IMAGE_MODEL
    : kind === 'audio' ? process.env.OPENROUTER_TTS_MODEL || DEFAULT_TTS_MODEL
      : kind === 'video' ? process.env.OPENROUTER_VIDEO_MODEL || DEFAULT_VIDEO_MODEL
        : process.env.OPENROUTER_STT_MODEL || DEFAULT_STT_MODEL;
}
export function ttsVoices(model: string): string[] {
  if (process.env.OPENROUTER_TTS_MODEL === model && process.env.OPENROUTER_TTS_VOICE) return [process.env.OPENROUTER_TTS_VOICE];
  if (model.startsWith('google/')) return ['Kore', 'Puck', 'Charon'];
  if (model.startsWith('openai/')) return ['alloy', 'nova', 'shimmer'];
  return [];
}
export async function discoverMediaModels(kind: CatalogKind): Promise<MediaModelOption[]> {
  const saved = cache.get(kind);
  if (saved && saved.expires > Date.now()) return saved.models;
  // /videos/models -- endpoint terpisah dari /images/models, shape beda (verified
  // via WebSearch dokumentasi resmi OpenRouter 7 Sep -- lihat normalizeVideoModel).
  const path = kind === 'image' ? '/images/models'
    : kind === 'video' ? '/videos/models'
      : `/models?output_modalities=${kind === 'audio' ? 'speech' : 'transcription'}`;
  const json = await providerJson(await providerFetch(OPENROUTER_BASE + path, { headers: orHeaders() }));
  if (!Array.isArray(json.data)) throw new MediaError('PROVIDER_ERROR', 'Katalog model tidak tersedia.', 502, true);
  const models: MediaModelOption[] = [];
  for (const raw of json.data as RawModel[]) {
    if (kind === 'image') { const m = normalizeImageModel(raw); if (m) models.push(m); }
    else if (kind === 'video') { const m = normalizeVideoModel(raw as RawVideoModel); if (m) models.push(m); }
    else if (raw.id && raw.architecture?.output_modalities?.includes(kind === 'audio' ? 'speech' : 'transcription')) {
      models.push({ id: raw.id, name: raw.name || raw.id, provider: 'openrouter', verified: true,
        capabilities: { inputModalities: raw.architecture.input_modalities, outputModalities: raw.architecture.output_modalities,
          ...(kind === 'audio' ? { voices: ttsVoices(raw.id), supportsSpeed: raw.id.startsWith('openai/'), outputFormats: ['mp3'] } : {}) } });
    }
  }
  if (!models.length) throw new MediaError('MODEL_UNAVAILABLE', 'Tidak ada model yang sesuai di katalog.', 503);
  // Model default konfigurasi tetap PALING ATAS (MediaStudio.tsx pre-select posisi
  // [0] sebagai pilihan awal -- jangan ganti perilaku itu diam-diam). Sisanya
  // diurutkan murah -> mahal (Mecca eksplisit minta bisa pilih model biar hemat)
  // supaya begitu user buka dropdown, opsi termurah gampang ditemukan. Item tanpa
  // harga diketahui ditaruh paling akhir, bukan dianggap "termurah".
  const preferred = configuredModel(kind);
  models.sort((a, b) => {
    const prefA = Number(b.id === preferred) - Number(a.id === preferred);
    if (prefA !== 0) return prefA;
    const costA = a.pricing?.costUsd ?? Number.POSITIVE_INFINITY;
    const costB = b.pricing?.costUsd ?? Number.POSITIVE_INFINITY;
    return costA - costB;
  });
  cache.set(kind, { expires: Date.now() + 300_000, models });
  return models;
}
export function clearMediaCatalogCache() { cache.clear(); }
export async function validateMediaModel(kind: CatalogKind, requested?: string) {
  const id = requested || configuredModel(kind);
  const models = await discoverMediaModels(kind);
  const model = models.find(m => m.id === id);
  if (!model) throw new MediaError('MODEL_UNAVAILABLE', 'Model pilihan tidak tersedia. Muat ulang daftar model.', 400);
  return model;
}
