export type MediaKind = 'image' | 'audio' | 'video';
export type CatalogKind = 'image' | 'audio' | 'transcription' | 'video';
export interface MediaModelOption {
  id: string;
  name: string;
  provider: string;
  verified: boolean;
  capabilities: {
    inputModalities?: string[];
    outputModalities?: string[];
    aspectRatios?: string[];
    resolutions?: string[];
    qualities?: string[];
    outputFormats?: string[];
    supportsReferenceImages?: boolean;
    voices?: string[];
    supportsSpeed?: boolean;
    durations?: number[];
  };
  pricing?: { unit?: string; costUsd?: number };
}
export interface MediaGenerateRequest {
  kind: MediaKind;
  prompt?: string;
  script?: string;
  model?: string;
  voice?: string;
  speed?: number;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number;
  quality?: 'auto' | 'low' | 'medium' | 'high';
  outputFormat?: 'png' | 'jpeg' | 'webp' | 'mp3' | 'wav';
  brandContext?: { workspaceName?: string; palette?: string; hasLogo?: boolean; industry?: string };
  role?: 'marketing' | 'executive' | 'finance';
}
export interface MediaGenerateResult {
  kind: MediaKind;
  /** B1 VIDEO ASYNC (7 Sep 2026): 'pending' ditambah supaya POST /media/generate untuk
   * kind=video bisa balas CEPAT (submit job saja, tanpa menahan HTTP request sampai
   * selesai render) -- root cause bug "berhasil di provider tapi enggak muncul" adalah
   * satu request HTTP yang menahan poll sampai 150 detik (lihat video-provider lama).
   * Status akhir video TETAP cuma 'ready' atau 'planned' (gagal/timeout dipetakan balik
   * ke 'planned' + attempted:true) -- 'pending' murni status TRANSIT sebelum poll client
   * selesai, bukan status final yang pernah disimpan/ditampilkan permanen. */
  status: 'ready' | 'planned' | 'pending';
  /** B1 (7 Sep 2026): id job render video di provider, HANYA diisi saat status:'pending'.
   * Dipakai client untuk poll GET /api/v1/media/video-status?job=<jobId>. */
  jobId?: string;
  mimeType?: string;
  fileName?: string;
  dataUrl?: string;
  url?: string;
  provider?: string;
  modelUsed?: string;
  prompt?: string;
  script?: string;
  latencyMs?: number;
  note?: string;
  availableAlternative?: 'video-plan';
  usage?: { costUsd?: number };
  /** video-005 (7 Sep, gap-fix video UX): true kalau render video SUDAH genuinely
   * dicoba ke provider (job disubmit lalu timeout/gagal) -- beda dari planned murni
   * karena capability off. Dipakai client untuk membedakan badge "Segera" (belum
   * diaktifkan) vs "Gagal, coba lagi" (sudah dicoba, gagal kali ini). Undefined/false
   * untuk kind selain video, atau saat capability video memang mati. */
  attempted?: boolean;
}
export interface TranscriptionResult {
  text: string;
  language: string;
  provider: string;
  modelUsed: string;
  durationSeconds?: number;
  latencyMs: number;
  usage?: { costUsd?: number };
}
