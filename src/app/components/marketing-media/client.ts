'use client';

import type { NotebookKind, NotebookResult } from '@/lib/notebook-types';

export type StudioKind = 'image' | 'audio' | 'video' | 'quiz' | 'flashcard' | 'transcription';

/** Vertikal industri untuk enrich prompt gambar. Nilai `value` WAJIB sama persis
 * dengan kunci INDUSTRY_TEMPLATES di src/lib/industry-image-templates.ts -- kalau
 * meleset, resolveIndustryTemplate() balikin null dan enrich jadi no-op diam-diam.
 * Dijaga oleh tests/studio-notebook-contract.test.ts. */
export const INDUSTRY_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'fnb', label: 'Kuliner & F&B' },
  { value: 'retail', label: 'Retail & Toko' },
  { value: 'jasa', label: 'Jasa & Layanan' },
  { value: 'fashion', label: 'Fashion & Pakaian' },
  { value: 'kesehatan', label: 'Kesehatan & Medis' },
  { value: 'pendidikan', label: 'Pendidikan' },
  { value: 'properti', label: 'Properti & Real Estate' },
  { value: 'otomotif', label: 'Otomotif' },
];

/** Label Bahasa Indonesia untuk 9 jenis kartu notebook yang didukung backend. */
export const NOTEBOOK_KIND_OPTIONS: ReadonlyArray<{ value: NotebookKind; label: string }> = [
  { value: 'quiz', label: 'Kuis pilihan ganda' },
  { value: 'flashcard', label: 'Flashcard hafalan' },
  { value: 'summary-report', label: 'Ringkasan berbagian' },
  { value: 'mindmap', label: 'Peta pikiran' },
  { value: 'table', label: 'Tabel fakta' },
  { value: 'infographic', label: 'Infografis angka' },
  { value: 'deck', label: 'Kerangka slide' },
  { value: 'audio-overview-script', label: 'Naskah dialog audio' },
  { value: 'video-storyboard', label: 'Storyboard video' },
];

/** Batas jumlah item per jenis kartu. Angka di sini WAJIB sama dengan schema
 * server (notebook-engine.ts untuk quiz/flashcard, extraNotebookCountRanges di
 * notebook-cards.ts untuk 7 sisanya). Sengaja disalin sebagai data biasa, bukan
 * di-import, supaya zod tidak ikut terbawa ke bundle browser. Kalau server
 * berubah dan sini tidak, tests/studio-notebook-contract.test.ts akan gagal. */
export const NOTEBOOK_COUNT_RANGES: Record<NotebookKind, { min: number; max: number; default: number }> = {
  quiz: { min: 2, max: 10, default: 5 },
  flashcard: { min: 2, max: 20, default: 8 },
  'summary-report': { min: 2, max: 8, default: 4 },
  mindmap: { min: 2, max: 10, default: 5 },
  table: { min: 2, max: 20, default: 8 },
  infographic: { min: 3, max: 12, default: 6 },
  deck: { min: 3, max: 15, default: 8 },
  'audio-overview-script': { min: 4, max: 40, default: 12 },
  'video-storyboard': { min: 3, max: 20, default: 10 },
};

/** Satuan item per jenis kartu, dipakai untuk label form ("Jumlah pertanyaan"). */
export const NOTEBOOK_COUNT_LABELS: Record<NotebookKind, string> = {
  quiz: 'pertanyaan',
  flashcard: 'kartu',
  'summary-report': 'bagian',
  mindmap: 'cabang',
  table: 'baris',
  infographic: 'statistik',
  deck: 'slide',
  'audio-overview-script': 'baris dialog',
  'video-storyboard': 'scene',
};
export interface ModelOption {
  id: string; name: string; provider?: string; verified?: boolean;
  capabilities: {
    aspectRatios?: string[]; resolutions?: string[]; qualities?: string[];
    outputFormats?: string[]; voices?: string[]; supportsSpeed?: boolean;
    durations?: number[];
  };
  pricing?: { unit?: string; costUsd?: number };
}
export interface ModelCatalog {
  success: true;
  data: ModelOption[];
  capabilities: { image: boolean; audio: boolean; transcription: boolean; notebook: boolean; video: boolean };
  note?: string;
}
export const IMAGE_RATIOS = ['1:1', '4:5', '9:16', '16:9'] as const;
export function supportedImageRatios(model?: ModelOption): string[] {
  // No descriptor means no ratio assertion. Let the provider choose its default.
  return IMAGE_RATIOS.filter(ratio => model?.capabilities.aspectRatios?.includes(ratio));
}
export function defaultImageRatio(model?: ModelOption): string {
  return supportedImageRatios(model)[0] || '';
}
export interface MediaRequest {
  kind: 'image' | 'audio' | 'video'; prompt?: string; script?: string;
  model?: string; voice?: string; speed?: number; aspectRatio?: string;
  quality?: string; resolution?: string; outputFormat?: string; durationSeconds?: number;
  /** Backend contract yang sudah ada; role baru dipetakan ke `executive` oleh
   * MediaStudio sampai template/provider khusus role tersedia. */
  role: 'marketing' | 'executive' | 'finance';
  /** `industry` opsional: kalau diisi, route media/generate meneruskannya ke
   * enrichWithIndustry() supaya prompt gambar dapat gaya per vertikal. Kalau
   * kosong, perilaku lama persis sama (prompt tidak disentuh). */
  brandContext?: { workspaceName: string; palette?: string; hasLogo: boolean; industry?: string };
}
export interface MediaResult {
  kind: 'image' | 'audio' | 'video';
  /** B1 VIDEO ASYNC (7 Sep 2026): 'pending' ditambah -- POST /media/generate untuk
   * kind=video sekarang balas cepat dengan status ini + jobId, BUKAN menunggu render
   * selesai (dulu 1 HTTP request ditahan sampai 150 detik, akar bug "berhasil di
   * provider tapi enggak muncul"). Client (pollVideoJob di bawah) yang melanjutkan
   * polling; 'pending' tidak pernah disimpan sebagai status akhir yang ditampilkan
   * StudioResult -- selalu berujung 'ready' atau 'planned'. */
  status: 'ready' | 'planned' | 'pending';
  /** B1: id job render video di provider, HANYA ada saat status:'pending'. Dipakai
   * pollVideoJob() untuk polling GET /api/v1/media/video-status?job=<jobId>. */
  jobId?: string;
  dataUrl?: string; url?: string; mimeType?: string; fileName?: string; provider?: string;
  modelUsed?: string; prompt?: string; script?: string; latencyMs?: number;
  note?: string; availableAlternative?: string;
  // Biaya nyata per-generate (bukan estimasi) -- backend sudah mengirim ini sejak
  // lama (usageOf() di media-provider.ts), tapi belum pernah ditampilkan ke user.
  // Item 4.6 (7 Sep, Mecca eksplisit minta transparansi biaya): ditambahkan supaya
  // user tahu biaya sungguhan tiap kali generate gambar/audio/video.
  usage?: { costUsd?: number };
  /** video-005: true kalau render video ini SUDAH genuinely disubmit ke provider dan
   * gagal/timeout -- beda dari planned murni (capability belum diaktifkan). Server
   * (media-provider.ts submitVideoJob/checkVideoJob, diganti dari generateVideoMedia
   * lama saat B1 VIDEO ASYNC 7 Sep 2026) adalah satu-satunya sumber kebenaran; client
   * tidak pernah menebak ini sendiri. Undefined/false untuk semua kasus lain. */
  attempted?: boolean;
}
export type StudioSubmission =
  | { type: 'media'; request: MediaRequest }
  | { type: 'notebook'; request: { kind: NotebookKind; sourceText: string; count: number; difficulty: 'easy' | 'medium' | 'hard'; role: 'marketing' | 'executive' | 'finance' } }
  | { type: 'storyboard'; request: { type: 'video-plan'; brief: string; role: 'marketing' | 'executive' | 'finance' } };

export interface StudioMessage {
  media?: MediaResult;
  notebook?: NotebookResult;
  submission?: StudioSubmission;
  pending?: boolean;
  failed?: boolean;
  draftScript?: string;
}

/** Server-side cap for a voiceover script (route zod + generateSpeech both enforce 6000). */
export const MAX_TTS_SCRIPT_CHARS = 6000;

/** Retry must reuse a draft script the server already produced instead of paying
 * for a second drafting call (and possibly changing the substance). Only audio
 * media submissions carry a draft; everything else is returned untouched. An
 * oversize draft can never pass TTS, so fall back to the original brief then. */
export function buildRetrySubmission(submission: StudioSubmission, draftScript?: string): StudioSubmission {
  const script = draftScript?.trim();
  if (!script || script.length > MAX_TTS_SCRIPT_CHARS) return submission;
  if (submission.type !== 'media' || submission.request.kind !== 'audio') return submission;
  const request: MediaRequest = { ...submission.request, script };
  delete request.prompt; // explicit script: the route must not draft again from the brief
  return { type: 'media', request };
}

export const MAX_STUDIO_SOURCE_CHARS = 12000;

/** Source text handed to the studio panel. Quiz/flashcard treat what the user
 * just typed in the composer as the material (it beats attachment and old
 * history); the other kinds keep the existing order attachment > history > composer. */
export function resolveStudioSource(input: { kind: StudioKind; composerText?: string; attachmentText?: string; historyText?: string }): string {
  const composer = (input.composerText || '').trim();
  const attachment = input.attachmentText || '';
  const history = input.historyText || '';
  const source = input.kind === 'quiz' || input.kind === 'flashcard'
    ? composer || attachment || history
    : attachment || history || composer;
  return source.slice(0, MAX_STUDIO_SOURCE_CHARS);
}

/** Per-chat FIFO of messages typed while that chat still has a request in flight.
 * Pure data structure so the drain rule (one item per finished request) is testable
 * without React: enqueue while busy, takeNext exactly once when the request settles. */
export interface SendQueue {
  enqueue(chatId: string, text: string): boolean;
  takeNext(chatId: string): string | undefined;
  size(chatId: string): number;
}
export function createSendQueue(): SendQueue {
  const pending = new Map<string, string[]>();
  return {
    enqueue(chatId, text) {
      const value = text.trim();
      if (!value) return false;
      const list = pending.get(chatId) || [];
      list.push(value);
      pending.set(chatId, list);
      return true;
    },
    takeNext(chatId) {
      const list = pending.get(chatId);
      if (!list?.length) return undefined;
      const next = list.shift();
      if (!list.length) pending.delete(chatId);
      return next;
    },
    size(chatId) { return pending.get(chatId)?.length || 0; },
  };
}

export class ApiRequestError extends Error {
  constructor(message: string, public readonly code?: string, public readonly data?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// video-004 (7 Sep, gap-fix video UX): server sudah punya guard idempotency LENGKAP
// dan teruji (media-http.ts runIdempotent -- coalesce request yang masih in-flight,
// replay hasil yang <5 menit selesai) tapi TIDAK ADA satupun caller yang pernah kirim
// header Idempotency-Key, jadi guard itu sepenuhnya no-op. Akibat nyata: kalau user
// klik "Coba kembali" setelah kegagalan-palsu (mis. nginx 504 padahal render sebenarnya
// masih/sudah sukses di server, lihat video-001), request BARU dikirim ke provider --
// membakar kredit OpenRouter perusahaan KEDUA KALINYA untuk brief yang identik.
// Fix di sini genuinely mandiri di file yang kita miliki (client.ts) -- TIDAK perlu
// mengubah ExecutiveAIAssistantView.tsx/FinanceAIAssistantView.tsx/MarketingAIAssistantView.tsx
// (di luar batas edit kita) karena kuncinya diturunkan dari ISI body request itu sendiri,
// bukan dari state komponen: retry yang mengirim body BYTE-IDENTIK (submission yang sama
// persis, termasuk lewat buildRetrySubmission untuk kind video yang tidak mengubah apapun)
// otomatis dapat Idempotency-Key yang sama -> server men-coalesce (kalau job sebelumnya
// masih berjalan) atau me-replay (kalau sudah selesai <5 menit) TANPA memanggil provider
// lagi. Cakupan sengaja SEMUA POST ke media/generate (bukan cuma video) -- image/audio
// juga memakai kredit provider berbayar dan sama-sama diuntungkan.
// Trade-off yang disadari: dua submission yang DELIBERATE (bukan retry, brief identik
// dikirim ulang oleh user dalam <5 menit) juga akan dapat hasil yang sama (di-replay),
// bukan render baru -- konsisten dengan desain guard server (TTL 5 menit), bukan bug.
const MEDIA_GENERATE_PATH = '/api/v1/media/generate';
async function bodyIdempotencyKey(body: string): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
    return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
  } catch { return null; } // crypto.subtle absent (very old browser / insecure context): skip, no idempotency this request -- not fatal.
}

/** Current login stores JWT in HttpOnly klir_token or localStorage klir_token.
 * Send that cookie, Bearer token, and JSON headers. */
export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  if (typeof window !== 'undefined') {
    let token = localStorage.getItem('klir_token');
    if (!token && typeof document !== 'undefined') {
      const match = document.cookie.match(/(?:^|;\s*)(?:klir_token|auth_token)=([^;]*)/);
      if (match && match[1]) {
        token = decodeURIComponent(match[1]);
        try { localStorage.setItem('klir_token', token); } catch {}
      }
    }
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }
  if (url === MEDIA_GENERATE_PATH && init.method === 'POST' && typeof init.body === 'string' && !headers.has('Idempotency-Key')) {
    const key = await bodyIdempotencyKey(init.body);
    if (key) headers.set('Idempotency-Key', key);
  }
  const response = await fetch(url, { ...init, headers, credentials: 'include', cache: 'no-store' });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    if (response.status === 401) throw new ApiRequestError('Sesi login tidak valid atau kedaluwarsa. Masuk kembali untuk menggunakan media.', json?.error?.code, json?.data);
    throw new ApiRequestError(json?.error?.message || json?.message || `Permintaan gagal (${response.status}). Coba kembali.`, json?.error?.code, json?.data);
  }
  return json as T;
}

export { detectMediaIntent as detectStudioIntent } from '@/lib/media-intent';

export function validMediaResult(result: MediaResult): boolean {
  if (result.kind === 'video') {
    if (result.status === 'planned') return true;
    // B1 VIDEO ASYNC (7 Sep 2026): status transit setelah submit -- valid HANYA kalau
    // server juga mengirim jobId (tanpa itu client tidak bisa poll sama sekali, jadi
    // response tidak berguna dan lebih baik dianggap invalid daripada diam-diam macet
    // sebagai pending selamanya).
    if (result.status === 'pending') return typeof result.jobId === 'string' && result.jobId.length > 0;
    // Render sungguhan (roadmap 7 Sep item 4.6): server mengembalikan URL provider
    // (bukan dataUrl base64 seperti image/audio -- video terlalu besar untuk itu),
    // jadi validasinya beda: cek https url valid + metadata provider, bukan prefix
    // data: URI.
    if (result.status === 'ready') {
      if (!result.provider || result.provider === 'deterministic_fallback' || !result.modelUsed) return false;
      // FIX (7 Sep 2026): server sekarang mengirim path proxy same-origin
      // (/api/v1/media/video-content?job=...) karena URL provider butuh API key
      // (401 di browser). URL https absolut tetap diterima untuk kompatibilitas.
      if (!result.url || !(/^https:\/\//.test(result.url) || /^\/api\/v1\/media\/video-content\?/.test(result.url))) return false;
      return !!result.mimeType?.startsWith('video/');
    }
    return false;
  }
  if (!result.provider || result.provider === 'deterministic_fallback' || !result.modelUsed) return false;
  const family = result.kind === 'image' ? 'image/' : 'audio/';
  return result.status === 'ready' && !!result.mimeType?.startsWith(family)
    && !!result.dataUrl?.startsWith(`data:${result.mimeType};base64,`)
    && result.dataUrl.length > result.dataUrl.indexOf(',') + 1;
}

/** Bentuk respons GET /api/v1/media/video-status?job= (lihat checkVideoJob di
 * media-provider.ts, dikonsumsi lewat route video-status/route.ts). */
export interface VideoJobStatusResponse {
  status: 'pending' | 'ready' | 'failed';
  url?: string; mimeType?: string; note?: string; usage?: { costUsd?: number }; attempted?: boolean;
}

// B1 VIDEO ASYNC (7 Sep 2026): dulu client cuma menunggu SATU respons POST
// /media/generate yang (sisi server) menahan koneksi sampai 150 detik untuk video --
// akar bug "berhasil di provider tapi enggak muncul" (context pack [POSISI] item 1).
// Sekarang POST balas cepat {status:'pending', jobId} dan fungsi INI yang melanjutkan
// polling dari sisi CLIENT lewat request-request PENDEK terpisah (GET video-status,
// tiap request <1-2 detik normal) -- kalau satu poll putus (nginx timeout, tab
// pindah), poll berikutnya 4 detik kemudian tetap jalan dan akan menemukan job SELESAI
// kalau memang selesai di provider. Hasil gagal/dibatalkan/kedaluwarsa DIPETAKAN balik
// ke status:'planned' + attempted:true (BUKAN status baru) supaya StudioResult.tsx yang
// SUDAH ADA (cabang planned/attempted) menangani ini tanpa perubahan render apapun.
export async function pollVideoJob(
  jobId: string,
  options: { intervalMs?: number; maxMs?: number } = {},
): Promise<Pick<MediaResult, 'kind' | 'status' | 'url' | 'mimeType' | 'note' | 'usage' | 'attempted' | 'availableAlternative'>> {
  const intervalMs = options.intervalMs ?? 4000;
  const maxMs = options.maxMs ?? 360_000; // ~6 menit, selaras copy PendingStatus StudioResult.tsx ("1-3 menit").
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const res = await apiRequest<{ success: true; data: VideoJobStatusResponse }>(
      `/api/v1/media/video-status?job=${encodeURIComponent(jobId)}`,
    );
    if (res.data.status === 'ready') {
      return { kind: 'video', status: 'ready', url: res.data.url, mimeType: res.data.mimeType, note: res.data.note, usage: res.data.usage };
    }
    if (res.data.status === 'failed') {
      return { kind: 'video', status: 'planned', attempted: true, note: res.data.note, availableAlternative: 'video-plan' };
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  return {
    kind: 'video', status: 'planned', attempted: true, availableAlternative: 'video-plan',
    note: 'Render video melewati batas waktu tunggu di klien. Video mungkin masih selesai di provider -- coba render ulang jika perlu.',
  };
}

export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_SECONDS = 120;
export function validateAudio(file: Blob, duration: number) {
  if (!file.size) throw new Error('Rekaman kosong. Rekam ulang atau pilih audio lain.');
  if (file.size > MAX_AUDIO_BYTES) throw new Error('Audio maksimal 25 MB. Pilih file yang lebih kecil.');
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Durasi audio tidak dapat dibaca. Coba file MP3, WAV, atau rekam ulang.');
  if (duration > MAX_AUDIO_SECONDS) throw new Error('Audio maksimal 120 detik. Potong file sebelum diunggah.');
}
