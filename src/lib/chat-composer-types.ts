// src/lib/chat-composer-types.ts
// Kontrak tipe murni untuk fitur Setelan Jawaban + Composer Toolbar KLIR.
// Dibuat 8 Sep 2026. TANPA IMPORT APAPUN -- file ini boleh diimpor dari
// komponen client maupun server tanpa risiko menyeret modul node-only.
// JANGAN duplikat definisi ini di file lain -- semua agent WAJIB import dari sini.

/** Mode composer aktif. 'audio' disediakan untuk future-proof, TIDAK dipasang
 * sebagai chip aktif di wave build ini (lihat keputusan_teknis D-5). */
export type ComposerMode = 'chat' | 'image' | 'video' | 'audio';

/** 4 tingkat upaya, dipetakan ke parameter teknis lewat EFFORT_MAP di bawah. */
export type EffortLevel = 'santai' | 'normal' | 'serius' | 'maksimal';

export interface ImagePrefs {
  model: 'auto' | string;
  quality?: string;
  aspectRatio?: string;
  resolution?: string;
}

export interface VideoPrefs {
  model: 'auto' | string;
  resolution?: string;
  aspectRatio?: string;
  durationSeconds?: number;
}

/** Preferensi composer per-workspace, disimpan di localStorage
 * (kunci 'klir_composer_prefs_<workspaceId>', lihat chat-composer-prefs.ts). */
/** Tombol "Riset" di composer (8 Sep malam, feedback Mecca: pre-search seperti ChatGPT/Gemini/
 * Claude) -- memaksa jalur riset tanpa bergantung deteksi kata kunci. 'off' = ikut deteksi otomatis. */
export type ResearchMode = 'off' | 'web' | 'competitor' | 'location' | 'forecast';
export const RESEARCH_MODES: ReadonlyArray<ResearchMode> = ['off', 'web', 'competitor', 'location', 'forecast'];
export const RESEARCH_MODE_LABEL: Record<ResearchMode, { label: string; desc: string }> = {
  off: { label: 'Mati', desc: 'Riset hanya kalau pertanyaan memang minta (deteksi otomatis)' },
  web: { label: 'Riset web', desc: 'Cari data terbaru dari internet lalu jawab dengan sumber' },
  competitor: { label: 'Riset kompetitor', desc: 'Pesaing dan tren pasar untuk bisnis ini' },
  location: { label: 'Analisis lokasi', desc: 'Cocok tidaknya area / cabang baru + kompetitor di sekitar' },
  forecast: { label: 'Prediksi', desc: 'Proyeksi 1/3/6/12 bulan dari data internal + riset' },
};

/** Mode asisten (tanya/riset/belajar/analis) -- 11 Sep 2026, kontrak modul 3 (context pack
 * "integrasi AI-data, model hemat, UI asisten"). SSOT SEBENARNYA ada di
 * '@/lib/ai-brain/assistant-modes.ts' (agent B3, dibangun paralel oleh agent lain di sesi
 * yang sama) -- TAPI file itu TIDAK bisa diimpor di sini karena chat-composer-types.ts
 * sengaja "TANPA IMPORT APAPUN" (lihat komentar header file, supaya aman diimpor dari mana
 * saja tanpa risiko menyeret modul lain). Union di bawah DIDUPLIKASI secara sadar (bukan lupa
 * sync) -- kalau union AssistantMode di assistant-modes.ts berubah, file ini WAJIB
 * diperbarui manual mengikuti, tidak ada mekanisme sync otomatis. TODO rekonsiliasi:
 * begitu ada keputusan arsitektur untuk melonggarkan aturan "tanpa import" file ini (atau
 * assistant-modes.ts dipindah jadi benar-benar zero-dependency), evaluasi ulang duplikasi
 * ini. Dicatat juga di contract_notes laporan agent B4 (11 Sep 2026). */
export type AssistantMode = 'tanya' | 'riset' | 'belajar' | 'analis';
export const ASSISTANT_MODES: ReadonlyArray<AssistantMode> = ['tanya', 'riset', 'belajar', 'analis'];

export interface ComposerPrefs {
  mode: ComposerMode;
  researchMode: ResearchMode;
  textModel: 'auto' | string;
  effort: EffortLevel;
  image: ImagePrefs;
  video: VideoPrefs;
  /** Model transkripsi (STT) untuk panel mic -- 9 Sep 2026, gap-fix audio-catalog-search.
   * 'auto' (default) TIDAK mengirim field `model` ke POST /media/transcribe sama sekali,
   * mempertahankan PERSIS perilaku lama (Groq fast-path kalau GROQ_API_KEY ada, baru
   * fallback ke OpenRouter default) -- lihat transcribeAudio() di media-provider.ts.
   * String eksplisit = id model dari GET /api/v1/media/models?kind=transcription yang
   * dikirim sebagai `model` di form data, MEMAKSA jalur OpenRouter (skip Groq fast-path,
   * lihat requestedModel check di transcribeAudio). */
  sttModel: 'auto' | string;
  /** Mode asisten aktif (11 Sep 2026, kontrak modul 3+4) -- dikirim sebagai
   * body.assistantMode ke POST /api/v1/brain/chat dari 3 view. Chip composer HANYA
   * menampilkan 'Belajar'/'Analis' (lihat ComposerToolbar.tsx toggleAssistantMode) --
   * 'tanya' adalah keadaan default/tidak-ada-yang-aktif, 'riset' disinkronkan otomatis
   * dari tombol Riset yang sudah ada (bukan dari chip mode asisten ini) di titik kirim
   * body masing-masing view, BUKAN disimpan sebagai 'riset' permanen di sini. */
  assistantMode: AssistantMode;
}

/** Preferensi cara AI menjawab, dipelajari dari histori + feedback eksplisit.
 * Disimpan di localStorage (kunci 'klir_reader_prefs_<workspaceId>'). */
export interface ReaderPreferences {
  simplicity: 'lebih_sederhana' | 'normal' | 'lebih_detail';
  visual: 'auto' | 'tabel' | 'prosa';
  /** Maksimal 5 signal, tiap signal maksimal 80 karakter. Kelebihan dibuang
   * diam-diam (FIFO, yang terlama dibuang duluan) -- bukan error. */
  signals: string[];
}

/** Field tambahan opsional di body POST /api/v1/brain/chat. Semua opsional --
 * tidak dikirim = perilaku lama tidak berubah sama sekali. */
export interface ChatRequestExtras {
  modelId?: string;
  effort?: EffortLevel;
  preferences?: ReaderPreferences;
  media?: ImagePrefs | VideoPrefs;
}

export type ModelCostClass = 'hemat' | 'standar' | 'premium';

/** 1 baris hasil katalog model teks (text-model-catalog.ts, server-only). */
export interface TextModelOption {
  id: string;
  name: string;
  provider: string;
  costClass: ModelCostClass;
  /** Harga prompt per juta token dalam USD. Undefined kalau provider tidak
   * mempublikasikan pricing (lihat pricingKnown). */
  pricePromptPerM?: number;
  pricingKnown: boolean;
  reasoning: boolean;
  recommended: boolean;
  contextLength?: number;
}

export type SlashCommandKind = 'mode' | 'nextAction' | 'setting';

/** payload bertipe unknown dengan sengaja -- tiap kind punya bentuk payload
 * beda (lihat slash-commands.ts untuk daftar payload konkret per command),
 * konsumen (ComposerToolbar/handleSendMessage) yang narrow berdasarkan kind. */
export interface SlashCommand {
  id: string;
  label: string;
  desc: string;
  kind: SlashCommandKind;
  payload: Record<string, unknown>;
}

/** Parameter teknis + instruksi per tingkat upaya. SSOT tunggal -- backend
 * (B3) dan UI (B2) WAJIB baca dari sini, jangan hardcode ulang angkanya.
 * preferReasoning=true berarti body.reasoning={effort} dikirim ke OpenRouter
 * HANYA kalau modelId eksplisit dipilih (bukan 'auto') -- lihat keputusan D-8. */
export const EFFORT_MAP: Record<
  EffortLevel,
  {
    temperature: number;
    maxOutputTokens: number;
    instruction: string;
    preferReasoning: boolean;
    /** dikirim sebagai body.reasoning.effort ke OpenRouter, undefined = field
     * reasoning tidak dikirim sama sekali (hemat, biarkan default provider). */
    openRouterReasoningEffort?: 'low' | 'medium' | 'high';
    /** perkiraan waktu tunggu untuk ditampilkan ke user di panel Setelan. */
    etaLabel: string;
  }
> = {
  santai: {
    temperature: 0.5,
    maxOutputTokens: 500,
    instruction: 'Jawab singkat dan langsung ke inti, tanpa detail tambahan yang tidak diminta.',
    preferReasoning: false,
    etaLabel: 'Cepat, beberapa detik',
  },
  normal: {
    temperature: 0.7,
    maxOutputTokens: 1200,
    instruction: 'Jawab dengan penjelasan secukupnya, seimbang antara ringkas dan lengkap.',
    preferReasoning: false,
    etaLabel: 'Normal, sekitar 10-20 detik',
  },
  serius: {
    temperature: 0.6,
    maxOutputTokens: 2200,
    instruction: 'Jawab mendalam dengan pertimbangan trade-off, sertakan alasan di balik rekomendasi.',
    preferReasoning: false,
    openRouterReasoningEffort: 'medium',
    etaLabel: 'Lebih lama, sekitar 20-40 detik',
  },
  maksimal: {
    temperature: 0.4,
    maxOutputTokens: 4000,
    instruction:
      'Berpikir keras: pertimbangkan banyak sudut pandang, uji asumsi sendiri, baru simpulkan jawaban akhir.',
    preferReasoning: true,
    openRouterReasoningEffort: 'high',
    etaLabel: 'Berpikir keras, bisa sampai 1 menit',
  },
};

/** Nilai default ComposerPrefs kalau localStorage kosong/corrupt. */
export const DEFAULT_COMPOSER_PREFS: ComposerPrefs = {
  mode: 'chat',
  researchMode: 'off',
  textModel: 'auto',
  effort: 'normal',
  image: { model: 'auto' },
  video: { model: 'auto' },
  sttModel: 'auto',
  assistantMode: 'tanya',
};

/** Nilai default ReaderPreferences kalau localStorage kosong/corrupt. */
export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  simplicity: 'normal',
  visual: 'auto',
  signals: [],
};
