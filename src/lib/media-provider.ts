/** Shared media adapters: validated bytes, honest fallback. Video render sungguhan
 * (roadmap 7 Sep item 4.6) fail-soft ke planned kalau capability off/provider gagal. */
import { MediaError } from './media-errors';
import { OPENROUTER_BASE, hasProviderKey, mediaCapabilities, orHeaders, providerFetch, providerJson, validateMediaModel } from './media-catalog';
import type { MediaGenerateRequest, MediaGenerateResult, TranscriptionResult } from './media-types';
export type { MediaGenerateRequest, MediaGenerateResult } from './media-types';

export interface MediaGenOptions {
  model?: string; aspectRatio?: string; quality?: 'standard' | 'hd' | 'auto' | 'low' | 'medium' | 'high';
  resolution?: string; fps?: number; durationSeconds?: number; outputFormat?: 'png' | 'jpeg' | 'webp';
}
export interface MediaGenResult {
  base64?: string; url?: string; mimeType: string; provider: string; modelUsed: string; latencyMs: number;
  note?: string; usage?: { costUsd?: number };
}
function imageMime(bytes: Buffer): string | null {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
export async function decodeImageResult(value: unknown) {
  if (typeof value !== 'string' || value.length > 48_000_000) throw new MediaError('PROVIDER_ERROR', 'Provider tidak mengembalikan gambar yang valid.', 502);
  const content = value.replace(/^data:image\/(png|jpeg|webp);base64,/, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(content)) throw new MediaError('PROVIDER_ERROR', 'Data gambar provider tidak valid.', 502);
  const bytes = Buffer.from(content, 'base64');
  const mimeType = imageMime(bytes);
  if (bytes.length < 32 || !mimeType) throw new MediaError('PROVIDER_ERROR', 'Format gambar provider tidak dapat ditampilkan.', 502);
  try {
    const { default: sharp } = await import('sharp');
    // Decode actual pixels, not only file signatures; reject truncated and decompression-bomb inputs.
    await sharp(bytes, { limitInputPixels: 32_000_000, failOn: 'warning' }).stats();
  } catch { throw new MediaError('PROVIDER_ERROR', 'File gambar provider rusak atau ukurannya tidak didukung.', 502); }
  return { base64: bytes.toString('base64'), mimeType };
}
function usageOf(value: unknown) {
  const cost = value && typeof value === 'object' ? (value as { cost?: unknown }).cost : undefined;
  return typeof cost === 'number' && Number.isFinite(cost) ? { costUsd: cost } : undefined;
}
// Anti-slop optical anchor (roadmap 7 Sep, Bagian 2 -- diadopsi dari paket evaluasi
// Antigravity/Gemini Studio 5 Sep, 02-KLIR-PUBLIC-PRIVATE/2026-09-05-gemini-studio-
// evaluation/anti-slop/prompt-guardrails.ts). Guardrail lama cuma 1 baris generik;
// ini menambah parameter optik kamera fisik supaya hasil AI-image tidak jatuh ke
// "plastic AI look" (bloom artifisial, kulit terlalu mulus, dst). Murni string
// builder tanpa I/O -- tidak menyentuh auth/tenant-guard/prisma.
const VISUAL_SLOP_TOKENS = [
  'hyperrealistic',
  'ultra realistic 8k',
  'trending on artstation',
  'octane render 3d',
  'unreal engine 5',
  'glowing purple neon cyberpunk',
  'plastic smooth face',
  'airbrushed skin',
];

export interface VisualOpticalParams {
  focalLength?: '35mm' | '50mm' | '85mm' | '24mm';
  aperture?: 'f/1.4' | 'f/1.8' | 'f/2.8' | 'f/4.0';
  lightingSetup?: 'natural soft morning window light' | 'golden hour diffused backlight' | 'editorial cinematic key light';
  textureDetail?: 'natural skin pores and micro-texture' | 'matte organic fabric weave' | 'natural paper grain and ink bleed';
  colorGrading?: 'Kodak Portra 400 neutral warm tone' | 'clean documentary neutral color' | 'subtle Fujifilm classic chrome';
}

function opticalAnchor(overrides?: VisualOpticalParams) {
  const focalLength = overrides?.focalLength ?? '50mm';
  const aperture = overrides?.aperture ?? 'f/1.8';
  const lightingSetup = overrides?.lightingSetup ?? 'natural soft morning window light';
  const textureDetail = overrides?.textureDetail ?? 'natural skin pores and micro-texture';
  const colorGrading = overrides?.colorGrading ?? 'clean documentary neutral color';
  return `[OPTICAL ANCHOR]: Shot on ${focalLength} lens at ${aperture}, ${lightingSetup}, authentic material surface with ${textureDetail}, ${colorGrading}. Zero artificial bloom, zero plastic smoothing.`;
}

export function enrichMarketingImage(prompt: string, brand?: MediaGenerateRequest['brandContext'], optical?: VisualOpticalParams) {
  let cleanPrompt = prompt;
  for (const token of VISUAL_SLOP_TOKENS) {
    cleanPrompt = cleanPrompt.replace(new RegExp(`\\b${token}\\b`, 'gi'), '');
  }
  cleanPrompt = cleanPrompt.replace(/\s+/g, ' ').trim();
  return [
    cleanPrompt,
    brand?.workspaceName ? 'Business: ' + brand.workspaceName + '.' : '',
    brand?.palette ? 'Brand palette: ' + brand.palette + '.' : '',
    brand?.hasLogo ? 'A logo exists but no logo file is attached. Reserve space; do not invent or reproduce a logo.' : 'Do not invent a logo.',
    'Create a polished Indonesian marketing visual. Clear focal subject, intentional composition, negative space, natural lighting and readable requested text. Avoid distorted anatomy, typos, invented text, watermarks and visual clutter.',
    opticalAnchor(optical),
  ].filter(Boolean).join('\n');
}

export function enrichMarketingVideoPrompt(prompt: string, brand?: MediaGenerateRequest['brandContext']) {
  let cleanPrompt = prompt;
  for (const token of VISUAL_SLOP_TOKENS) {
    cleanPrompt = cleanPrompt.replace(new RegExp(`\\b${token}\\b`, 'gi'), '');
  }
  cleanPrompt = cleanPrompt.replace(/\s+/g, ' ').trim();
  return [
    cleanPrompt,
    brand?.workspaceName ? `Business/Brand: ${brand.workspaceName}.` : '',
    brand?.industry ? `Industry: ${brand.industry}.` : '',
    'Style: High-energy TikTok UGC commercial ad, dynamic handheld camera motion, appetizing culinary close-ups, warm inviting restaurant atmosphere, vertical 9:16 framing, modern Indonesian lifestyle aesthetic, vibrant cinematic lighting.',
    'STRICTLY NO static diagrams, NO charts, NO infographics, NO raw data bullet points, NO spreadsheet screens, NO artificial plastic look.',
  ].filter(Boolean).join('\n');
}
export async function generateImageViaGemini(prompt: string, options: MediaGenOptions = {}): Promise<MediaGenResult> {
  if (!hasProviderKey('GEMINI_API_KEY')) throw new MediaError('NO_PROVIDER', 'Provider gambar belum tersedia.', 503);
  const start = Date.now();
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  const json = await providerJson(await providerFetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST', headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['TEXT', 'IMAGE'], ...(options.aspectRatio ? { imageConfig: { aspectRatio: options.aspectRatio } } : {}) } }),
  }));
  const candidates = json.candidates as {content?: {parts?: {inlineData?: {data?: string}}[]}}[] | undefined;
  const data = candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)?.inlineData?.data;
  return { ...await decodeImageResult(data), provider: 'gemini', modelUsed: model, latencyMs: Date.now() - start };
}
export async function generateImageMedia(prompt: string, options: MediaGenOptions = {}): Promise<MediaGenResult> {
  if (!prompt.trim() || prompt.length > 16_000) throw new MediaError('INVALID_INPUT', 'Brief gambar harus berisi 1–16000 karakter.');
  if (!mediaCapabilities().image) throw new MediaError('NO_PROVIDER', 'Generate gambar sedang tidak tersedia.', 503);
  const start = Date.now();
  let fallbackNote = 'OpenRouter belum dikonfigurasi; gambar dibuat melalui Gemini.';
  if (hasProviderKey('OPENROUTER_API_KEY')) {
    try {
      const model = await validateMediaModel('image', options.model);
      const caps = model.capabilities;
      const body: Record<string, unknown> = { model: model.id, prompt };
      const choices: [string, string | undefined, string[] | undefined][] = [
        ['aspect_ratio', options.aspectRatio, caps.aspectRatios],
        ['resolution', options.resolution, caps.resolutions],
        ['quality', options.quality === 'standard' ? 'medium' : options.quality === 'hd' ? 'high' : options.quality, caps.qualities],
        ['output_format', options.outputFormat, caps.outputFormats],
      ];
      for (const [key, value, allowed] of choices) {
        if (value && (!allowed || !allowed.includes(value))) throw new MediaError('INVALID_INPUT', 'Pilihan ' + key + ' tidak didukung model.');
        if (value && allowed) body[key] = value;
      }
      const endpoints = await providerJson(await providerFetch(OPENROUTER_BASE + '/images/models/' + model.id + '/endpoints', { headers: orHeaders() }));
      type Endpoint = {provider_tag?: string; supported_parameters?: Record<string, {values?: string[]}>};
      const records = endpoints.endpoints as Endpoint[] | undefined;
      const endpoint = records?.find(e => choices.every(([key]) => !body[key] || e.supported_parameters?.[key]?.values?.includes(String(body[key]))));
      if (!endpoint) throw new MediaError('INVALID_INPUT', 'Kombinasi pilihan tidak tersedia pada provider model ini.');
      if (endpoint.provider_tag) body.provider = { order: [endpoint.provider_tag], allow_fallbacks: false };
      const json = await providerJson(await providerFetch(OPENROUTER_BASE + '/images', { method: 'POST', headers: orHeaders(), body: JSON.stringify(body) }));
      const items = json.data as { b64_json?: string }[] | undefined;
      return { ...await decodeImageResult(items?.[0]?.b64_json), provider: 'openrouter', modelUsed: model.id, latencyMs: Date.now() - start, usage: usageOf(json.usage) };
    } catch (error) {
      if (error instanceof MediaError && error.status === 400) throw error;
      fallbackNote = 'OpenRouter gagal; gambar ini dibuat melalui fallback Gemini.';
      console.warn('[KLIR media] image fallback', error instanceof MediaError ? error.code : 'PROVIDER_ERROR');
    }
  }
  const fallback = await generateImageViaGemini(prompt, options);
  return { ...fallback, latencyMs: Date.now() - start, note: fallbackNote };
}
export function plannedVideo(): MediaGenerateResult {
  return { kind: 'video', status: 'planned', note: 'Render video otomatis: Segera. Buat storyboard dan naskah lengkap untuk produksi sekarang.', availableAlternative: 'video-plan', attempted: false };
}

// B1 VIDEO ASYNC (7 Sep 2026, gap-fix roadmap integrasi video): dulu (roadmap 7 Sep
// item 4.6) generateVideoMedia() submit job LALU poll DI DALAM SATU HTTP REQUEST
// sampai 150 detik (videoPollTimeoutMs) sebelum membalas -- itu akar bug "berhasil di
// OpenRouter tapi enggak muncul" yang dilaporkan Mecca: kalau render >150s ATAU koneksi
// diputus reverse-proxy/browser sebelum polling selesai, client dapat fallback
// 'planned' walau job SUDAH selesai sungguhan di provider (kredit terbakar, hasil
// hilang). Fungsi itu (plus pollVideoJob/videoPollIntervalMs/videoPollTimeoutMs
// internal-nya) DIHAPUS TOTAL di sini, BUKAN dipertahankan paralel -- satu-satunya
// pemanggilnya (generate/route.ts) sudah diarahkan ke submitVideoJob() di bawah, jadi
// mempertahankan kode lama cuma jadi dead code yang tetap harus dites (lihat laporan
// scan video temuan T10). Diganti pola async job 2 endpoint:
//   1. submitVideoJob() -- submit job SEKALI, balas cepat {status:'pending', jobId}.
//   2. checkVideoJob()  -- cek status SEKALI (dipanggil GET /api/v1/media/video-status),
//      TANPA loop/deadline internal -- deadline sekarang tanggung jawab CLIENT
//      (client.ts pollVideoJob, poll tiap 4 detik maksimal 6 menit).
// Konsekuensi: tidak ada lagi satu koneksi HTTP yang ditahan lama untuk video -- baik
// submit maupun tiap poll GET sama-sama request pendek (<1-2 detik normal), jadi timeout
// reverse-proxy/browser di tengah jalan tidak lagi bikin hasil "hilang" -- poll
// berikutnya 4 detik kemudian tetap menemukan job SELESAI kalau memang selesai.
type VideoJobStatus = {
  id?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired';
  unsigned_urls?: string[];
  usage?: { cost?: number };
  error?: string;
};

/** Hasil satu kali cek status job render video -- kontrak dipakai
 * src/app/api/v1/media/video-status/route.ts (GET, dipanggil client tiap 4 detik). */
export interface VideoJobStatusResult {
  status: 'pending' | 'ready' | 'failed';
  url?: string;
  mimeType?: string;
  note?: string;
  usage?: { costUsd?: number };
  /** Selalu true: endpoint status hanya pernah dipanggil untuk job yang memang sudah
   * disubmit ke provider (jobId didapat dari submitVideoJob), jadi "attempted" selalu
   * benar di titik ini -- beda dari MediaGenerateResult.attempted yang bisa false. */
  attempted: true;
  /** Status mentah provider saat terminal (failed/cancelled/expired) -- dipakai
   * video-status route untuk mencatat enum VideoJobStatus yang tepat; TIDAK diteruskan
   * ke client (dibuang di route). */
  providerStatus?: string;
}

/** Submit job render video ke provider SEKALI, TANPA menunggu hasilnya (beda dari
 * generateVideoMedia lama yang menunggu sampai selesai/timeout). Validasi input/model/
 * aspectRatio/resolution/duration disalin verbatim dari fungsi lama -- perilaku jujur
 * menolak (INVALID_INPUT) untuk pilihan yang genuinely tidak didukung TETAP SAMA,
 * cuma bagian tunggu-hasil yang dipindah ke checkVideoJob(). */
export async function submitVideoJob(prompt: string, options: MediaGenOptions = {}): Promise<MediaGenerateResult> {
  if (!prompt.trim() || prompt.length > 16_000) throw new MediaError('INVALID_INPUT', 'Brief video harus berisi 1–16000 karakter.');
  if (!mediaCapabilities().video) return plannedVideo();
  try {
    const model = await validateMediaModel('video', options.model);
    const caps = model.capabilities;
    const body: Record<string, unknown> = { model: model.id, prompt };
    // FIX (7 Sep, gap LOW #4 -- parity dengan validasi gambar): sebelumnya pilihan
    // aspect ratio/resolution/durasi yang tidak didukung model DIAM-DIAM diabaikan di
    // sini (provider lalu memakai default sendiri, mis. user pilih 16:9 tapi hasilnya
    // vertikal, tanpa pesan apapun) -- beda dari jalur gambar (generateImageMedia di
    // atas) yang jujur menolak (throw INVALID_INPUT) saat pilihan tidak didukung.
    // Disamakan HANYA untuk kasus yang genuinely diketahui tidak didukung (caps.X ada
    // TAPI pilihan user tidak ada di situ) -- kalau caps.X sendiri tidak dideklarasikan
    // provider (belum tentu tidak didukung, cuma metadata belum lengkap; video baru
    // render sungguhan mulai hari ini), tetap diteruskan apa adanya seperti sebelumnya
    // supaya tidak menambah kegagalan baru untuk kasus ambigu yang belum teruji.
    if (options.aspectRatio) {
      if (caps.aspectRatios && !caps.aspectRatios.includes(options.aspectRatio)) throw new MediaError('INVALID_INPUT', 'Pilihan aspect_ratio tidak didukung model.');
      body.aspect_ratio = options.aspectRatio;
    }
    if (options.resolution) {
      if (caps.resolutions && !caps.resolutions.includes(options.resolution)) throw new MediaError('INVALID_INPUT', 'Pilihan resolution tidak didukung model.');
      body.resolution = options.resolution;
    }
    if (options.durationSeconds) {
      if (caps.durations && !caps.durations.includes(options.durationSeconds)) throw new MediaError('INVALID_INPUT', 'Pilihan duration tidak didukung model.');
      body.duration = options.durationSeconds;
    }

    const submitJson = await providerJson(await providerFetch(OPENROUTER_BASE + '/videos', {
      method: 'POST', headers: orHeaders(), body: JSON.stringify(body),
    }));
    const jobId = submitJson.id as string | undefined;
    if (!jobId) throw new MediaError('PROVIDER_ERROR', 'Provider tidak mengembalikan job render video.', 502);
    return {
      kind: 'video', status: 'pending', jobId,
      provider: 'openrouter', modelUsed: model.id,
      note: 'Video sedang dirender di provider. Biasanya 1-3 menit -- status akan diperbarui otomatis di chat ini.',
    };
  } catch (error) {
    if (error instanceof MediaError && error.status === 400) throw error;
    // Gagal SEBELUM job pernah disubmit (validasi model/katalog/HTTP submit) -- belum
    // pernah genuinely dicoba ke provider, jadi attempted:false (badge "Segera") tepat,
    // konsisten dengan semantik attempted lama (video-005).
    const errMessage = error instanceof Error ? error.message : 'Kesalahan jaringan atau provider.';
    console.warn('[KLIR media] video submit gagal, fallback ke planned', {
      code: error instanceof MediaError ? error.code : undefined,
      message: errMessage,
    });
    return {
      ...plannedVideo(),
      note: `Render video otomatis gagal saat disubmit (${errMessage}). Storyboard tetap dapat dibuat sekarang.`,
    };
  }
}

/** Cek status job render video SEKALI (tanpa loop) -- dipanggil GET
 * /api/v1/media/video-status per poll client (tiap 4 detik, maksimal 6 menit, lihat
 * client.ts pollVideoJob). Gagal/dibatalkan/kedaluwarsa di provider dipetakan ke
 * status:'failed' (BUKAN throw) supaya endpoint tetap 200 dan client bisa memutuskan
 * fallback storyboard -- konsisten semangat fail-soft yang sudah ada di generateImageMedia. */
export async function checkVideoJob(jobId: string): Promise<VideoJobStatusResult> {
  if (!mediaCapabilities().video) throw new MediaError('NO_PROVIDER', 'Render video sedang tidak tersedia.', 503);
  const json = await providerJson(await providerFetch(OPENROUTER_BASE + '/videos/' + jobId, { headers: orHeaders() }));
  const job = json as VideoJobStatus;
  if (job.status === 'completed' && job.unsigned_urls?.length) {
    // FIX (7 Sep 2026, bug "video masih kurang"): unsigned_urls[0] milik provider WAJIB
    // API key server (dibuktikan curl tanpa auth -> 401). Browser tidak bisa memuatnya,
    // jadi URL yang dikirim ke client menunjuk ke proxy KLIR sendiri
    // (src/app/api/v1/media/video-content/route.ts) yang menyertakan key di sisi server.
    return {
      status: 'ready', mimeType: 'video/mp4',
      url: `/api/v1/media/video-content?job=${encodeURIComponent(jobId)}&index=0`,
      usage: typeof job.usage?.cost === 'number' ? { costUsd: job.usage.cost } : undefined,
      note: 'Video diambil lewat server KLIR dari provider dan bisa kedaluwarsa di sisi provider -- unduh sekarang kalau ingin menyimpannya permanen.',
      attempted: true,
    };
  }
  if (job.status === 'failed' || job.status === 'cancelled' || job.status === 'expired') {
    console.warn('[KLIR media] video job tidak selesai', { jobId, status: job.status, error: job.error });
    let noteText = job.status === 'expired'
      ? 'Render video melewati batas waktu tunggu di provider. Storyboard tetap dapat dibuat sekarang.'
      : 'Render video gagal pada provider saat ini. Storyboard tetap dapat dibuat sekarang.';
    if (job.error) {
      noteText = `Render video gagal (${job.error}). Storyboard tetap dapat dibuat sekarang.`;
    }
    return {
      status: 'failed', attempted: true, providerStatus: job.status,
      note: noteText,
    };
  }
  // pending / in_progress / status lain yang belum dikenal -- client akan poll lagi.
  return { status: 'pending', attempted: true };
}
export async function generateSpeech(script: string, options: {voice?: string; speed?: number; model?: string} = {}): Promise<MediaGenerateResult> {
  if (!mediaCapabilities().audio) throw new MediaError('NO_PROVIDER', 'Voiceover belum tersedia. Naskah Anda tetap dapat disalin.', 503);
  if (!script.trim() || script.length > 6000) throw new MediaError('INVALID_INPUT', 'Naskah harus berisi 1–6000 karakter.');
  const start = Date.now();
  const model = await validateMediaModel('audio', options.model);
  const voices = model.capabilities.voices || [];
  const voice = options.voice || voices[0];
  if (!voice || !voices.includes(voice)) throw new MediaError('INVALID_INPUT', 'Voice tidak tersedia untuk model yang dikonfigurasi.');
  const speed = options.speed ?? 1;
  if (!Number.isFinite(speed) || speed < 0.5 || speed > 2) throw new MediaError('INVALID_INPUT', 'Kecepatan harus antara 0.5–2.');
  if (!model.capabilities.supportsSpeed && speed !== 1) throw new MediaError('INVALID_INPUT', 'Model ini belum mendukung pilihan kecepatan.');
  const googlePcm = model.id === 'google/gemini-3.1-flash-tts-preview';
  const response = await providerFetch(OPENROUTER_BASE + '/audio/speech', {
    method: 'POST', headers: orHeaders(),
    body: JSON.stringify({ model: model.id, input: script, voice, response_format: googlePcm ? 'pcm' : 'mp3', ...(model.capabilities.supportsSpeed ? { speed } : {}) }),
  });
  let bytes = await readProviderAudio(response);
  if (/^audio\/(pcm|l16)(;|$)/i.test(response.headers.get('content-type') || '')) bytes = await pcmToMp3(bytes);
  const { parseBuffer } = await import('music-metadata');
  const meta = await parseBuffer(bytes, undefined, { duration: true }).catch(() => null);
  if (!meta?.format.codec || !meta.format.duration || meta.format.duration <= 0) throw new MediaError('PROVIDER_ERROR', 'Provider tidak mengembalikan audio yang valid.', 502);
  const wav = bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE';
  const mp3 = bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224);
  if (!wav && !mp3) throw new MediaError('PROVIDER_ERROR', 'Format audio provider belum didukung player.', 502);
  const mimeType = wav ? 'audio/wav' : 'audio/mpeg';
  return { kind: 'audio', status: 'ready', mimeType, fileName: 'klir-voiceover.' + (wav ? 'wav' : 'mp3'),
    dataUrl: 'data:' + mimeType + ';base64,' + bytes.toString('base64'), script, provider: 'openrouter', modelUsed: model.id, latencyMs: Date.now() - start,
    ...(wav ? { note: 'Provider mengembalikan WAV; unduhan mempertahankan format audio asli.' } : {}) };
}
/** Gemini TTS documented wire format: signed little-endian 16-bit mono at 24kHz. */
export async function pcmToMp3(bytes: Buffer) {
  if (bytes.length < 480 || bytes.length % 2 !== 0) throw new MediaError('PROVIDER_ERROR', 'Audio PCM provider tidak valid.', 502);
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const encoder = new Mp3Encoder(1, 24000, 128);
  const samples = new Int16Array(bytes.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = bytes.readInt16LE(i * 2);
  const chunks: Buffer[] = [];
  for (let i = 0; i < samples.length; i += 1152) chunks.push(Buffer.from(encoder.encodeBuffer(samples.subarray(i, i + 1152))));
  chunks.push(Buffer.from(encoder.flush()));
  return Buffer.concat(chunks);
}
async function readProviderAudio(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new MediaError('PROVIDER_ERROR', 'Audio provider kosong.', 502);
  const chunks: Buffer[] = []; let total = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    total += value.byteLength;
    if (total > 25 * 1024 * 1024) { await reader.cancel(); throw new MediaError('PROVIDER_ERROR', 'Audio hasil terlalu besar.', 502); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export async function validateAudioFile(bytes: Buffer, mime: string, name: string) {
  if (!bytes.length) throw new MediaError('INVALID_INPUT', 'Rekaman kosong.');
  if (bytes.length > MAX_AUDIO_BYTES) throw new MediaError('FILE_TOO_LARGE', 'Audio maksimal 25 MB.', 413);
  const format = /\.(wav|mp3|mp4|m4a|webm|ogg|flac|mpeg|mpga)$/i.exec(name)?.[1]?.toLowerCase();
  if (!format || !/^(audio\/|video\/mp4|video\/webm)/.test(mime)) throw new MediaError('UNSUPPORTED_FORMAT', 'Unggah WAV, MP3, MP4, M4A, WebM, OGG, atau FLAC.', 415);
  const { parseBuffer } = await import('music-metadata');
  const meta = await parseBuffer(bytes, { mimeType: mime, size: bytes.length }, { duration: true }).catch(() => null);
  const duration = meta?.format.duration;
  if (!duration || !Number.isFinite(duration) || duration <= 0) throw new MediaError('INVALID_INPUT', 'Durasi audio tidak dapat dibaca. Coba unggah WAV/MP3.');
  if (duration > 120.5) throw new MediaError('INVALID_INPUT', 'Voice command maksimal 120 detik.');
  // Provider format follows decoded bytes, never a user-controlled filename extension.
  const signature = bytes.toString('ascii', 0, 4);
  const actualFormat = signature === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WAVE' ? 'wav'
    : signature === 'fLaC' ? 'flac' : signature === 'OggS' ? 'ogg'
    : bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) ? 'webm'
    : bytes.toString('ascii', 4, 8) === 'ftyp' ? 'mp4'
    : bytes.toString('ascii', 0, 3) === 'ID3' || (bytes[0] === 255 && (bytes[1] & 224) === 224) ? 'mp3' : null;
  if (!actualFormat) throw new MediaError('UNSUPPORTED_FORMAT', 'Format audio aktual belum didukung.', 415);
  return { duration, format: actualFormat };
}
const GEMINI_AUDIO_MIME: Record<string, string> = {
  wav: 'audio/wav', mp3: 'audio/mpeg', mp4: 'audio/mp4', webm: 'audio/webm', ogg: 'audio/ogg', flac: 'audio/flac',
};

async function transcribeAudioViaGemini(bytes: Buffer, format: string, language: string) {
  const model = process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-3.1-flash-preview';
  const response = await providerFetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: `Transkripsikan seluruh ucapan dari file audio/video ini ke teks biasa. Pertahankan bahasa asli (kode bahasa: ${language}). Jangan menambahkan ringkasan, komentar, atau instruksi lain; keluarkan hanya transkrip.` },
          { inlineData: { mimeType: GEMINI_AUDIO_MIME[format] || 'audio/mpeg', data: bytes.toString('base64') } },
        ],
      }],
    }),
  });
  const json = await providerJson(response);
  const candidates = Array.isArray(json.candidates) ? json.candidates as Array<{ content?: { parts?: Array<{ text?: unknown }> } }> : [];
  const text = candidates
    .flatMap((candidate) => candidate.content?.parts || [])
    .map((part) => typeof part.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n')
    .trim();
  if (!text) throw new MediaError('PROVIDER_ERROR', 'Gemini tidak mengembalikan transkrip.', 502, true);
  return { text, model };
}

export async function transcribeAudio(bytes: Buffer, mime: string, name: string, language = 'id', requestedModel?: string): Promise<TranscriptionResult> {
  if (!mediaCapabilities().transcription) throw new MediaError('NO_PROVIDER', 'Transkripsi belum tersedia. Anda tetap dapat mengetik pesan.', 503);
  const { duration, format } = await validateAudioFile(bytes, mime, name);
  if (!/^[a-z]{2}$/.test(language)) throw new MediaError('INVALID_INPUT', 'Kode bahasa tidak valid.');
  const start = Date.now();
  let transcriptText: string | undefined;
  let provider = 'gemini'; let model = process.env.GEMINI_TRANSCRIPTION_MODEL || 'gemini-3.1-flash-preview';
  let usage: { costUsd?: number } | undefined;

  // Product routing contract: direct Gemini is the default for transcription.
  // An explicit OpenRouter model still wins; otherwise provider failure falls
  // back to Groq, then to the OpenRouter STT catalog.
  if (hasProviderKey('GEMINI_API_KEY') && !requestedModel) {
    try {
      const result = await transcribeAudioViaGemini(bytes, format, language);
      transcriptText = result.text;
      model = result.model;
    } catch { console.warn('[KLIR media] Gemini transcription unavailable; trying Groq'); }
  }
  if (!transcriptText && hasProviderKey('GROQ_API_KEY') && !requestedModel) {
    provider = 'groq';
    model = process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo';
    try {
      const actualMime = format === 'mp3' ? 'audio/mpeg' : 'audio/' + format;
      const form = new FormData(); form.set('file', new Blob([new Uint8Array(bytes)], {type: actualMime}), 'voice.' + format);
      form.set('model', model); form.set('language', language); form.set('response_format', 'verbose_json');
      const json = await providerJson(await providerFetch('https://api.groq.com/openai/v1/audio/transcriptions', {method: 'POST', headers: {Authorization: 'Bearer ' + process.env.GROQ_API_KEY}, body: form}));
      if (typeof json.text === 'string' && json.text.trim()) transcriptText = json.text.trim();
      usage = usageOf(json.usage);
    } catch { console.warn('[KLIR media] Groq STT unavailable; trying OpenRouter'); }
  }
  if (!transcriptText) {
    model = (await validateMediaModel('transcription', requestedModel)).id; provider = 'openrouter';
    const json = await providerJson(await providerFetch(OPENROUTER_BASE + '/audio/transcriptions', {
      method: 'POST', headers: orHeaders(), body: JSON.stringify({model, input_audio: { data: bytes.toString('base64'), format }, language}),
    }));
    if (typeof json.text === 'string' && json.text.trim()) transcriptText = json.text.trim();
    usage = usageOf(json.usage);
  }
  if (!transcriptText) throw new MediaError('INVALID_INPUT', 'Tidak ada ucapan yang terdeteksi. Rekam ulang atau ketik pesan.');
  return { text: transcriptText.slice(0, 16_000), language, provider, modelUsed: model, durationSeconds: duration, latencyMs: Date.now() - start, usage };
}
