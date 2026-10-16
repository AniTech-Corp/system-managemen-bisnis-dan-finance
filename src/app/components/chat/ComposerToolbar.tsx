'use client';

// COMPOSER TOOLBAR -- chip mode (Tanya/Gambar/Video) + mic + panel "Setelan jawaban",
// dibuat 8 Sep 2026 (agent B2-toolbar, Gelombang 2 fitur Setelan Jawaban + Composer
// Toolbar KLIR). Komponen ADAPTER murni: TIDAK tahu apa-apa soal state 3 view (Executive/
// Finance/Marketing) -- semua baca/tulis lewat props. B5 yang memasang ini 6x dan
// menyambungkannya ke handleSendMessage/localStorage/Studio masing-masing view.
//
// KENAPA VoiceRecorder di-LAZY-LOAD (React.lazy), bukan import statis:
// (1) VoiceRecorder.tsx meng-import './studio.module.css' -- kalau diimpor statis di
//     module top-level, file INI jadi tidak bisa diimpor sama sekali oleh test node:test
//     polos (node --test tidak punya loader CSS, "Unexpected token '.'" -- dibuktikan
//     langsung sebelum menulis file ini, bukan tebakan). Lazy-load menunda import sampai
//     popover mic benar-benar dirender, jadi modul murni (helper functions) di file ini
//     tetap bisa diuji tanpa menyentuh CSS module sama sekali.
// (2) Bonus: mic bukan hal yang dipakai di setiap kunjungan composer -- code-splitting
//     VoiceRecorder (yang lumayan besar, punya AudioContext/MediaRecorder/wav encoder)
//     keluar dari initial bundle 3 view chat adalah keuntungan, bukan korbankan apapun.
// VoiceRecorder TETAP dipakai "apa adanya" -- tidak ada logic rekam yang ditulis ulang
// di sini, komponen ini cuma membungkusnya dalam popover kecil.
//
// PELAJARAN 8 Sep siang (paling kritis, lihat context pack): komponen client yang
// meng-import modul node-only (ai-gateway/media-provider/route/prisma/dst) bikin
// SELURUH halaman 500 walau tsc 0 + test lulus. Import file ini WAJIB persis:
// react, lucide-react, chat-composer-types.ts, slash-commands.ts, marketing-media/
// client.ts (tipe + apiRequest, murni fetch+helper, sudah diverifikasi bersih dari
// import node-only), dan marketing-media/VoiceRecorder.tsx (lewat dynamic import saja,
// lihat di atas). TIDAK PERNAH text-model-catalog.ts / media-catalog.ts / media-
// provider.ts / prisma / auth / session / rate-limiter -- akses ke situ SELALU lewat
// endpoint HTTP (GET /api/v1/brain/models, GET /api/v1/media/models).
import React from 'react';
import { MessageSquare, Image as ImageIcon, Video, Mic, X, SlidersHorizontal, Search, GraduationCap, BarChart2 } from 'lucide-react';
import type { AssistantMode, ComposerMode, ComposerPrefs, EffortLevel, ImagePrefs, TextModelOption, VideoPrefs } from '@/lib/chat-composer-types';
import { EFFORT_MAP, RESEARCH_MODES, RESEARCH_MODE_LABEL } from '@/lib/chat-composer-types';
import type { SlashCommand } from '@/lib/slash-commands';
import { matchSlash } from '@/lib/slash-commands';
import { apiRequest, defaultImageRatio, IMAGE_RATIOS, supportedImageRatios } from '@/app/components/marketing-media/client';
import type { ModelCatalog, ModelOption } from '@/app/components/marketing-media/client';

// Lazy: lihat komentar header file soal kenapa ini WAJIB dynamic import, bukan statis.
const LazyVoiceRecorder = React.lazy(() => import('@/app/components/marketing-media/VoiceRecorder'));

// ---------------------------------------------------------------------------
// TOKEN GAYA -- disamakan persis dengan AnswerFeedbackBar.tsx/NextActionsBar.tsx
// tetangganya (font Outfit, aksen #0058BE, dasar gelap #0B0E14) supaya toolbar ini
// terasa satu sistem, bukan komponen baru dengan bahasa visual sendiri.
// ---------------------------------------------------------------------------
const ACCENT = '#0058BE';
const BASE_BG = '#0B0E14';
const BORDER = '#263449';
const MUTED = '#8A93A3';
const TEXT_COLOR = '#DCECFF';
const FONT = "'Outfit', sans-serif";

const SR_ONLY: React.CSSProperties = {
  position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px',
  overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0,
};

// ---------------------------------------------------------------------------
// LOGIKA MURNI (diekspor supaya bisa diuji tanpa merender React sama sekali --
// lihat tests/composer-toolbar.test.ts). TIDAK ADA satupun fungsi di bawah ini
// yang menyentuh window/document/fetch -- input->output deterministik.
// ---------------------------------------------------------------------------

/** 3 chip mode yang DITAMPILKAN (bukan 4) -- 'audio' sengaja tidak dipasang sebagai
 * chip aktif, sesuai keputusan D-5 spesifikasi wave ini (union ComposerMode tetap
 * punya 'audio' untuk future-proof, cuma tidak dirender di sini). */
export const VISIBLE_MODE_CHIPS: ReadonlyArray<{ mode: Exclude<ComposerMode, 'audio'>; label: string }> = [
  { mode: 'chat', label: 'Tanya' },
  { mode: 'image', label: 'Gambar' },
  { mode: 'video', label: 'Video' },
];

/** Kembalikan chip mode yang tampil berdasarkan hak akses allowVideo (Jalur A). */
export function getVisibleModeChips(allowVideo = true): ReadonlyArray<{ mode: Exclude<ComposerMode, 'audio'>; label: string }> {
  return allowVideo ? VISIBLE_MODE_CHIPS : VISIBLE_MODE_CHIPS.filter((c) => c.mode !== 'video');
}

/** Filter slash commands agar /video tidak tampil di autocomplete jika allowVideo=false. */
export function filterSlashCommands(commands: SlashCommand[], allowVideo = true): SlashCommand[] {
  if (allowVideo) return commands;
  return commands.filter((c) => c.id !== 'video' && !(c.kind === 'mode' && (c.payload as { mode?: string })?.mode === 'video'));
}

/** 4 pil tingkat upaya, urutan tetap santai->maksimal (dari yang paling murah ke
 * paling berat), dipakai untuk render + test tanpa hardcode ulang union order. */
export const EFFORT_LEVELS: ReadonlyArray<EffortLevel> = ['santai', 'normal', 'serius', 'maksimal'];

/** Bangun URL GET /api/v1/brain/models?q=&limit= dari query mentah pengguna.
 * Query kosong/whitespace = param `q` TIDAK disertakan (server balikin semua model
 * sampai batas limit, bukan filter ke string kosong). limit di-clamp ke 1..50 (server
 * B1 sendiri men-cap ke 50, clamp di sini cuma mencegah kita mengirim angka aneh). */
export function buildBrainModelsUrl(query: string, limit = 20): string {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set('q', trimmed);
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit) || 20));
  params.set('limit', String(safeLimit));
  return `/api/v1/brain/models?${params.toString()}`;
}

/** Filter client-side sederhana (substring, case-insensitive, di id ATAU name) --
 * dipakai untuk model Gambar/Video karena GET /api/v1/media/models tidak punya
 * parameter pencarian server-side (beda dari GET /api/v1/brain/models milik B1).
 * Query kosong mengembalikan seluruh daftar apa adanya (tidak memfilter apapun). */
export function filterModelsByQuery<T extends { id: string; name: string }>(models: T[], query: string): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return models;
  return models.filter((model) => model.id.toLowerCase().includes(needle) || model.name.toLowerCase().includes(needle));
}

/** Resolve `sttModel` (ComposerPrefs) jadi field `model` yang dikirim ke POST
 * /api/v1/media/transcribe -- 9 Sep 2026, gap-fix audio-catalog-search (panel mic
 * dulu cuma toggle boolean, lihat context pack agent audio-catalog-search).
 *
 * 'auto' -> undefined (TIDAK mengirim field model sama sekali). Ini SENGAJA
 * mempertahankan automatic routing: transcribeAudio() di media-provider.ts
 * mencoba Gemini direct dulu, lalu Groq, baru fallback ke model default
 * OpenRouter kalau provider sebelumnya gagal/tidak ada key. Kalau kita kirim string apapun di sini, direct-provider fast-path
 * MATI (lihat `if (hasProviderKey('GROQ_API_KEY') && !requestedModel)`).
 *
 * Model dengan provider !== 'openrouter' (yaitu entri Gemini direct/Groq
 * yang di-unshift manual oleh GET /api/v1/media/models?kind=transcription,
 * lihat route.ts) diperlakukan sama seperti 'auto' -- keduanya memakai jalur
 * direct-provider otomatis, bukan dikirim ke validator OpenRouter.
 * Verified LIVE 9 Sep via GET openrouter.ai/api/v1/models?output_modalities=
 * transcription: 20 model transkripsi genuinely ada di katalog (Whisper x3,
 * GPT-Transcribe, Deepgram Nova-3, Qwen ASR, Mistral Voxtral, dst) -- ini BUKAN
 * kasus "1 provider tanpa pilihan", search+pilih model beneran berguna. */
export function resolveSttModelParam(
  selectedId: string,
  models: ReadonlyArray<Pick<ModelOption, 'id' | 'provider'>>,
): string | undefined {
  if (!selectedId || selectedId === 'auto') return undefined;
  const model = models.find((m) => m.id === selectedId);
  if (!model || model.provider !== 'openrouter') return undefined;
  return model.id;
}

/** Kontrol "kualitas" untuk mode Gambar HANYA muncul kalau model yang dipilih
 * genuinely mendeklarasikan capabilities.qualities tidak kosong -- per keputusan D-9,
 * menampilkan kontrol yang diabaikan backend = berbohong ke user. `undefined`/model
 * belum dipilih (masih 'auto') = jangan tampilkan (tidak ada model konkret untuk
 * ditanya kapabilitasnya). */
export function shouldShowImageQualityControl(model: Pick<ModelOption, 'capabilities'> | null | undefined): boolean {
  return Array.isArray(model?.capabilities?.qualities) && (model!.capabilities.qualities as string[]).length > 0;
}

/** Indeks berikutnya untuk navigasi panah atas/bawah di menu slash, wrap-around
 * (dari item terakhir panah-bawah kembali ke item pertama, dan sebaliknya). Kembalikan
 * -1 kalau daftar kosong (tidak ada yang bisa di-highlight). */
export function wrapIndex(current: number, delta: number, length: number): number {
  if (length <= 0) return -1;
  return ((current + delta) % length + length) % length;
}

/** Merge murni field ImagePrefs ke dalam ComposerPrefs tanpa mutasi -- dipakai tiap
 * kontrol di panel mode Gambar berubah (model/kualitas/rasio). */
export function withImagePrefs(prefs: ComposerPrefs, patch: Partial<ImagePrefs>): ComposerPrefs {
  return { ...prefs, image: { ...prefs.image, ...patch } };
}

/** Merge murni field VideoPrefs ke dalam ComposerPrefs tanpa mutasi -- dipakai tiap
 * kontrol di panel mode Video berubah (model/resolusi/durasi). TIDAK ADA field
 * `quality` di VideoPrefs (lihat chat-composer-types.ts) -- konsisten dengan
 * keputusan D-9 (kontrol kualitas video tidak pernah dirender/dikirim). */
export function withVideoPrefs(prefs: ComposerPrefs, patch: Partial<VideoPrefs>): ComposerPrefs {
  return { ...prefs, video: { ...prefs.video, ...patch } };
}

/** Label tampil untuk 1 tingkat upaya, dipetakan dari EFFORT_MAP (SSOT B1) --
 * TIDAK hardcode ulang string, supaya kalau EFFORT_MAP berubah, tampilan ikut
 * berubah otomatis. */
export function effortEtaLabel(level: EffortLevel): string {
  return EFFORT_MAP[level].etaLabel;
}

/** Toggle chip mode asisten Belajar/Analis (11 Sep 2026, kontrak modul 3+4). Klik chip
 * yang SUDAH aktif mengembalikan ke 'tanya' (default, "tidak ada mode khusus aktif") --
 * pola toggle yang sama dipakai state boolean lain di 3 view (mis. showData/showCaps).
 * 'riset' SENGAJA tidak pernah dihasilkan fungsi ini -- assistantMode 'riset' disinkronkan
 * otomatis dari tombol Riset yang sudah ada (di titik kirim body brain/chat milik tiap
 * view, lihat kontrak_penyesuaian laporan B4), bukan lewat toggle chip ini. */
export function toggleAssistantMode(current: AssistantMode, target: Extract<AssistantMode, 'belajar' | 'analis'>): AssistantMode {
  return current === target ? 'tanya' : target;
}

// Bentuk minimal event keyboard yang dibutuhkan handleSlashKeyDown -- sengaja BUKAN
// React.KeyboardEvent supaya file ini tidak memaksa pemanggil (B5) memakai tipe event
// React tertentu; cukup punya `.key` dan bisa di-preventDefault.
export interface MinimalKeyboardEvent {
  key: string;
  preventDefault: () => void;
}

export interface ComposerToolbarHandle {
  /** B5 WAJIB memanggil ini dari onKeyDown <textarea> composer mereka sendiri kalau
   * mau navigasi panah/Enter/Escape di menu slash benar-benar berfungsi -- lihat
   * catatan_jujur laporan B2 kenapa ComposerToolbar sendiri tidak bisa menangkap
   * keydown itu (textarea composer dimiliki 3 view, bukan komponen ini). Kembalikan
   * `true` kalau event ditangani (pemanggil sebaiknya berhenti memproses key itu
   * lebih lanjut), `false` kalau bukan urusan menu slash (menu tertutup/tidak match).
   */
  handleSlashKeyDown: (event: MinimalKeyboardEvent) => boolean;
}

export interface ComposerToolbarProps {
  prefs: ComposerPrefs;
  onPrefsChange: (next: ComposerPrefs) => void;
  /** Dipanggil saat memilih chip mode Gambar/Video SAAT composer sudah berisi teks --
   * meniru pola tombol Studio existing (openStudio(kind, inputMessage)) yang langsung
   * mengeksekusi memakai teks yang sudah diketik, bukan cuma mengganti mode untuk nanti.
   * Klik chip Tanya TIDAK PERNAH memanggil ini (pesan chat biasa selalu lewat tombol
   * Kirim milik view, bukan trigger otomatis dari toolbar). Lihat kontrak_untuk_agent_lain
   * di laporan untuk detail lengkap kontrak ini. */
  onSend: (mode: ComposerMode) => void;
  onMicTranscript: (text: string) => void;
  onSlashSelect: (command: SlashCommand) => void;
  inputValue: string;
  disabled?: boolean;
  /** Role capability gate. False keeps generic research out of role-new UI. */
  allowResearch?: boolean;
  /** Role capability gate for video generation. False limits to chat/image only (Finance/Manager/Ops/Secretary). */
  allowVideo?: boolean;
  /** LAYOUT SATU BARIS (8 Sep 2026 sore, koreksi Mecca "terlihat aneh"): view menaruh
   * tombol lampiran di `leading` dan tombol Kirim di `trailing`, lalu toolbar ini
   * merender SATU baris penuh: [lampiran][Tanya|Gambar|Video] ... [mic][setelan][kirim]
   * -- pola composer AI pada umumnya (Claude/ChatGPT), bukan tiga baris bertumpuk. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Tutup popover saat klik di luar dirinya + tombol pemicunya, atau saat Escape
 * ditekan di mana pun di halaman (bukan cuma saat popover fokus) -- popover kecil
 * seperti ini harus mudah ditutup, user tidak selalu fokus di dalamnya. */
function useDismissablePanel(active: boolean, onDismiss: () => void, containerRef: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    if (!active) return;
    const handlePointer = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) onDismiss();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [active, onDismiss, containerRef]);
}

function pillButtonStyle(active: boolean, disabled?: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '5px', height: '28px', padding: '0 11px',
    borderRadius: '8px', border: 0,
    background: active ? `${ACCENT}22` : 'rgba(255,255,255,0.04)', color: active ? ACCENT : MUTED,
    fontFamily: FONT, fontSize: '11.5px', fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
  };
}

/** Segmented control mode (satu kapsul, item aktif terisi aksen) -- pengganti 3 pill lepas. */
const segmentGroupStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '2px', padding: '3px', borderRadius: '999px',
  border: 0, background: 'rgba(255,255,255,0.035)',
};
function segmentStyle(active: boolean, disabled?: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: '5px', height: '26px', padding: '0 11px',
    borderRadius: '999px', border: 0, background: active ? ACCENT : 'transparent',
    color: active ? '#FFFFFF' : MUTED, fontFamily: FONT, fontSize: '11.5px', fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
  };
}
/** Tombol ikon bulat 31px -- identik dengan tombol lampiran milik view supaya satu bahasa visual. */
function iconButtonStyle(active: boolean, disabled?: boolean, withText?: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: '31px',
    minWidth: '31px', padding: withText ? '0 12px 0 10px' : 0, borderRadius: '999px',
    border: 0,
    background: active ? `${ACCENT}22` : 'rgba(255,255,255,0.04)', color: active ? ACCENT : MUTED,
    fontFamily: FONT, fontSize: '11.5px', fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
  };
}

const popoverStyle: React.CSSProperties = {
  position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 40,
  width: 'min(320px, 90vw)', maxHeight: '70vh', overflowY: 'auto',
  background: BASE_BG, border: 0, borderRadius: '14px',
  padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px',
  boxShadow: '0 20px 50px #0009', color: TEXT_COLOR, fontFamily: FONT,
};

/**
 * Popover untuk tombol di sisi KANAN baris (mic/setelan).
 *
 * Composer hidup di dalam beberapa scroller flex. Dengan `position: absolute`,
 * popover dapat terpotong oleh ancestor `overflow: auto` ketika area chat sedang
 * terscroll (terutama pilihan upaya paling atas). Fixed positioning membuat panel
 * menjadi viewport-bound; lebar tetap dibatasi oleh `90vw` dan inset kanan kecil
 * agar tetap aman di viewport desktop maupun mobile.
 */
const popoverRightStyle: React.CSSProperties = {
  ...popoverStyle,
  position: 'fixed',
  left: 'auto',
  right: '12px',
  bottom: '12px',
};

const fieldLabelStyle: React.CSSProperties = { fontSize: '11px', color: MUTED, fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: '100%', minWidth: 0, padding: '8px 9px', borderRadius: '8px', border: 0,
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
  background: '#10141C', color: TEXT_COLOR, fontFamily: FONT, fontSize: '12px',
};
const selectStyle: React.CSSProperties = { ...inputStyle };

interface ModelListState<T> {
  items: T[];
  loading: boolean;
  error: string | null;
}

const EMPTY_LIST_STATE = { items: [], loading: false, error: null };

export default React.forwardRef<ComposerToolbarHandle, ComposerToolbarProps>(function ComposerToolbar(
  { prefs, onPrefsChange, onSend, onMicTranscript, onSlashSelect, inputValue, disabled = false, allowResearch = true, allowVideo = true, leading, trailing },
  ref,
) {
  const reactId = React.useId();
  const [activePanel, setActivePanel] = React.useState<'mic' | 'settings' | 'research' | null>(null);
  const [slashDismissed, setSlashDismissed] = React.useState(false);
  const [slashActiveIndex, setSlashActiveIndex] = React.useState(0);

  const micButtonRef = React.useRef<HTMLButtonElement>(null);
  const settingsButtonRef = React.useRef<HTMLButtonElement>(null);
  const micPanelRef = React.useRef<HTMLDivElement>(null);
  const settingsPanelRef = React.useRef<HTMLDivElement>(null);
  const researchButtonRef = React.useRef<HTMLButtonElement>(null);
  const researchPanelRef = React.useRef<HTMLDivElement>(null);

  // Auto-reset mode to 'chat' if video is not allowed on current role
  React.useEffect(() => {
    if (!allowVideo && prefs.mode === 'video') {
      onPrefsChange({ ...prefs, mode: 'chat' });
    }
  }, [allowVideo, prefs, onPrefsChange]);

  const closePanel = React.useCallback(() => {
    setActivePanel((current) => {
      if (current === 'mic') micButtonRef.current?.focus();
      if (current === 'settings') settingsButtonRef.current?.focus();
      return null;
    });
  }, []);

  useDismissablePanel(activePanel === 'mic', closePanel, micPanelRef);
  useDismissablePanel(activePanel === 'settings', closePanel, settingsPanelRef);
  useDismissablePanel(activePanel === 'research', closePanel, researchPanelRef);

  React.useEffect(() => {
    if (!allowResearch && prefs.researchMode !== 'off') {
      onPrefsChange({ ...prefs, researchMode: 'off' });
      if (activePanel === 'research') setActivePanel(null);
    }
  }, [allowResearch, prefs, onPrefsChange, activePanel]);

  // Reset "sudah ditutup manual" tiap kali isi input berubah -- supaya lain kali user
  // ketik '/' lagi dari awal, menu slash muncul lagi (bukan permanen tersembunyi).
  React.useEffect(() => {
    setSlashDismissed(false);
  }, [inputValue]);

  const slashMatches = React.useMemo(() => {
    if (disabled || slashDismissed || !inputValue.startsWith('/')) return [];
    return filterSlashCommands(matchSlash(inputValue), allowVideo);
  }, [disabled, slashDismissed, inputValue, allowVideo]);

  React.useEffect(() => {
    setSlashActiveIndex(0);
  }, [slashMatches.length]);

  const selectSlash = React.useCallback(
    (command: SlashCommand) => {
      setSlashDismissed(true);
      onSlashSelect(command);
    },
    [onSlashSelect],
  );

  React.useImperativeHandle(
    ref,
    (): ComposerToolbarHandle => ({
      handleSlashKeyDown(event) {
        if (slashMatches.length === 0) return false;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSlashActiveIndex((current) => wrapIndex(current, 1, slashMatches.length));
          return true;
        }
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSlashActiveIndex((current) => wrapIndex(current, -1, slashMatches.length));
          return true;
        }
        if (event.key === 'Enter') {
          const command = slashMatches[slashActiveIndex];
          if (command) {
            event.preventDefault();
            selectSlash(command);
          }
          return true;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          setSlashDismissed(true);
          return true;
        }
        return false;
      },
    }),
    [slashMatches, slashActiveIndex, selectSlash],
  );

  const handleModeClick = (mode: Exclude<ComposerMode, 'audio'>) => {
    if (disabled) return;
    if (!allowVideo && mode === 'video') return;
    onPrefsChange({ ...prefs, mode });
    if (mode !== 'chat' && inputValue.trim().length > 0) onSend(mode);
  };

  // --- Panel "Setelan jawaban": model teks (search + debounce 300ms) -----------------
  const [textModelQuery, setTextModelQuery] = React.useState('');
  const debouncedTextModelQuery = useDebouncedValue(textModelQuery, 300);
  const [textModels, setTextModels] = React.useState<ModelListState<TextModelOption>>(EMPTY_LIST_STATE);

  React.useEffect(() => {
    if (activePanel !== 'settings') return;
    const controller = new AbortController();
    setTextModels((prev) => ({ ...prev, loading: true, error: null }));
    apiRequest<{ success: true; data: { models: TextModelOption[] } }>(buildBrainModelsUrl(debouncedTextModelQuery), {
      signal: controller.signal,
    })
      .then((res) => setTextModels({ items: res.data.models, loading: false, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setTextModels({ items: [], loading: false, error: err instanceof Error ? err.message : 'Gagal memuat daftar model.' });
      });
    return () => controller.abort();
  }, [activePanel, debouncedTextModelQuery]);

  // --- Panel "Setelan jawaban": model Gambar (fetch sekali per buka panel) ----------
  const [imageModelQuery, setImageModelQuery] = React.useState('');
  const [imageModels, setImageModels] = React.useState<ModelListState<ModelOption>>(EMPTY_LIST_STATE);

  React.useEffect(() => {
    if (activePanel !== 'settings' || prefs.mode !== 'image') return;
    const controller = new AbortController();
    setImageModels((prev) => ({ ...prev, loading: true, error: null }));
    apiRequest<ModelCatalog>('/api/v1/media/models?kind=image', { signal: controller.signal })
      .then((res) => setImageModels({ items: res.data, loading: false, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setImageModels({ items: [], loading: false, error: err instanceof Error ? err.message : 'Gagal memuat model gambar.' });
      });
    return () => controller.abort();
  }, [activePanel, prefs.mode]);

  // --- Panel "Setelan jawaban": model Video (fetch sekali per buka panel) -----------
  const [videoModelQuery, setVideoModelQuery] = React.useState('');
  const [videoModels, setVideoModels] = React.useState<ModelListState<ModelOption>>(EMPTY_LIST_STATE);

  React.useEffect(() => {
    if (activePanel !== 'settings' || prefs.mode !== 'video') return;
    const controller = new AbortController();
    setVideoModels((prev) => ({ ...prev, loading: true, error: null }));
    apiRequest<ModelCatalog>('/api/v1/media/models?kind=video', { signal: controller.signal })
      .then((res) => setVideoModels({ items: res.data, loading: false, error: null }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setVideoModels({ items: [], loading: false, error: err instanceof Error ? err.message : 'Gagal memuat model video.' });
      });
    return () => controller.abort();
  }, [activePanel, prefs.mode]);

  // --- Panel mic: katalog model transkripsi (search + fetch sekali per buka panel) --
  // Pola SAMA PERSIS dengan model Gambar/Video di atas (fetch sekali saat panel
  // dibuka, filter pencarian di client lewat filterModelsByQuery -- GET
  // /api/v1/media/models tidak punya parameter pencarian server-side untuk kind
  // apapun, lihat komentar filterModelsByQuery). Dulu efek ini CUMA membaca
  // res.capabilities.transcription (boolean on/off) dan membuang res.data sama
  // sekali -- itulah gap yang diperbaiki di sini (context pack: "panel mic saat
  // ini cuma toggle boolean capabilities.transcription").
  const [micModelQuery, setMicModelQuery] = React.useState('');
  const [sttModels, setSttModels] = React.useState<ModelListState<ModelOption>>(EMPTY_LIST_STATE);
  const [micEnabled, setMicEnabled] = React.useState<boolean | null>(null);
  const [micCapError, setMicCapError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (activePanel !== 'mic') return;
    const controller = new AbortController();
    setMicCapError(null);
    setSttModels((prev) => ({ ...prev, loading: true, error: null }));
    apiRequest<ModelCatalog>('/api/v1/media/models?kind=transcription', { signal: controller.signal })
      .then((res) => {
        setMicEnabled(!!res.capabilities.transcription);
        setSttModels({ items: res.data, loading: false, error: null });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setMicEnabled(false);
        setSttModels({ items: [], loading: false, error: null });
        setMicCapError(err instanceof Error ? err.message : 'Gagal memeriksa ketersediaan transkripsi.');
      });
    return () => controller.abort();
  }, [activePanel]);

  const filteredSttModels = filterModelsByQuery(sttModels.items, micModelQuery);
  // Dikirim sebagai prop `model` ke VoiceRecorder -> masuk FormData -> POST
  // /api/v1/media/transcribe. undefined kalau Auto/entri Groq dipilih (lihat
  // resolveSttModelParam), persis perilaku lama (tidak ada field model dikirim).
  const sttModelParam = resolveSttModelParam(prefs.sttModel, sttModels.items);

  const handleMicTranscriptSend = React.useCallback(
    (text: string) => {
      onMicTranscript(text);
      closePanel();
    },
    [onMicTranscript, closePanel],
  );

  const selectedImageModel = imageModels.items.find((m) => m.id === prefs.image.model);
  const selectedVideoModel = videoModels.items.find((m) => m.id === prefs.video.model);
  const imageRatioOptions = React.useMemo(() => {
    const fromModel = supportedImageRatios(selectedImageModel);
    return fromModel.length > 0 ? fromModel : [...IMAGE_RATIOS];
  }, [selectedImageModel]);
  const showImageQuality = shouldShowImageQualityControl(selectedImageModel);

  const filteredImageModels = filterModelsByQuery(imageModels.items, imageModelQuery);
  const filteredVideoModels = filterModelsByQuery(videoModels.items, videoModelQuery);

  const settingsPanelId = `composer-settings-panel-${reactId}`;
  const micPanelId = `composer-mic-panel-${reactId}`;
  // Ringkasan setelan yang tampil di tombol (mis. "Auto · Normal") supaya pengguna
  // tahu kondisi aktif tanpa membuka panel.
  const textModelShort = prefs.textModel === 'auto' ? 'Auto' : prefs.textModel.split('/').pop() || prefs.textModel;
  const effortShort = prefs.effort.charAt(0).toUpperCase() + prefs.effort.slice(1);
  const settingsSummary = `${textModelShort.length > 18 ? textModelShort.slice(0, 17) + '...' : textModelShort} · ${effortShort}`;

  return (
    <div style={{ position: 'relative', display: 'flex', width: '100%', flexWrap: 'wrap', alignItems: 'center', gap: '8px', fontFamily: FONT }}>
      {leading}
      {/* (a) mode Tanya/Gambar/Video sebagai satu segmented control */}
      <div role="group" aria-label="Pilih mode composer" style={segmentGroupStyle}>
        {getVisibleModeChips(allowVideo).map(({ mode, label }) => {
          const Icon = mode === 'chat' ? MessageSquare : mode === 'image' ? ImageIcon : Video;
          const active = prefs.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => handleModeClick(mode)}
              style={segmentStyle(active, disabled)}
            >
              <Icon size={12} strokeWidth={2} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* (a2) tombol RISET (8 Sep malam, feedback Mecca: pre-search seperti ChatGPT/Gemini/Claude,
          "plugin" tersendiri). Aktif = memaksa jalur riset di server (body.researchMode). */}
      {allowResearch && <div style={{ position: 'relative' }}>
        <button
          ref={researchButtonRef}
          type="button"
          disabled={disabled}
          aria-label="Riset (web, kompetitor, lokasi, prediksi)"
          aria-haspopup="dialog"
          aria-expanded={activePanel === 'research'}
          onClick={() => setActivePanel((p) => (p === 'research' ? null : 'research'))}
          title="Riset: cari data dunia nyata sebelum menjawab"
          style={iconButtonStyle(prefs.researchMode !== 'off' || activePanel === 'research', disabled, true)}
        >
          <Search size={13} strokeWidth={2} />
          <span>{prefs.researchMode === 'off' ? 'Riset' : RESEARCH_MODE_LABEL[prefs.researchMode].label}</span>
        </button>
        {activePanel === 'research' && (
          <div ref={researchPanelRef} role="dialog" aria-label="Pilih jenis riset" style={{ ...popoverStyle, width: 'min(300px, 90vw)', gap: '6px' }}>
            <p style={SR_ONLY}>Tekan Escape untuk menutup panel ini.</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '12.5px' }}>Riset sebelum menjawab</strong>
              <button type="button" aria-label="Tutup panel riset" onClick={closePanel} style={{ background: 'transparent', border: 0, color: MUTED, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
            {RESEARCH_MODES.map((mode) => (
              <ModelChoiceRow
                key={mode}
                selected={prefs.researchMode === mode}
                label={RESEARCH_MODE_LABEL[mode].label}
                sub={RESEARCH_MODE_LABEL[mode].desc}
                onClick={() => { onPrefsChange({ ...prefs, researchMode: mode }); closePanel(); }}
              />
            ))}
            <span style={{ fontSize: '10.5px', color: MUTED }}>Sumber ditampilkan sebagai chip yang bisa diklik. Riset web memakai Google (Gemini), 12-25 detik.</span>
          </div>
        )}
      </div>}

      {/* (a3) Mode asisten Belajar/Analis (11 Sep 2026, kontrak modul 3+4 -- keluhan Mecca
          poin 5 "jawaban adaptif" + poin 7 "mode riset/belajar/analis"). 'tanya' (default)
          TIDAK dirender sebagai chip terpisah -- itu keadaan "tidak ada mode khusus aktif",
          sama seperti researchMode 'off' tidak punya chip sendiri. 'riset' JUGA tidak
          dirender di sini -- disinkronkan otomatis dari tombol Riset di atas oleh pemanggil
          (view) saat membangun body brain/chat, komponen ini TIDAK membaca researchMode
          untuk override assistantMode sendiri (tetap murni controlled by props). */}
      <button
        type="button"
        disabled={disabled}
        aria-pressed={prefs.assistantMode === 'belajar'}
        onClick={() => onPrefsChange({ ...prefs, assistantMode: toggleAssistantMode(prefs.assistantMode, 'belajar') })}
        title="Mode Belajar: AI menjelaskan bertahap, pakai analogi, tutup dengan 1 pertanyaan cek paham"
        style={iconButtonStyle(prefs.assistantMode === 'belajar', disabled, true)}
      >
        <GraduationCap size={13} strokeWidth={2} />
        <span>Belajar</span>
      </button>
      <button
        type="button"
        disabled={disabled}
        aria-pressed={prefs.assistantMode === 'analis'}
        onClick={() => onPrefsChange({ ...prefs, assistantMode: toggleAssistantMode(prefs.assistantMode, 'analis') })}
        title="Mode Analis: angka dulu, tabel, asumsi eksplisit, rekomendasi berperingkat, risiko"
        style={iconButtonStyle(prefs.assistantMode === 'analis', disabled, true)}
      >
        <BarChart2 size={13} strokeWidth={2} />
        <span>Analis</span>
      </button>

      {/* Kelompok kanan: mic + setelan + tombol kirim milik view (trailing) */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* (b) tombol Mic -> popover membungkus VoiceRecorder apa adanya */}
      <div style={{ position: 'relative' }}>
        <button
          ref={micButtonRef}
          type="button"
          disabled={disabled}
          aria-label="Rekam suara (speech-to-text)"
          aria-haspopup="dialog"
          aria-expanded={activePanel === 'mic'}
          aria-controls={micPanelId}
          onClick={() => setActivePanel((p) => (p === 'mic' ? null : 'mic'))}
          title="Rekam suara (ubah ucapan jadi teks)"
          style={iconButtonStyle(activePanel === 'mic', disabled)}
        >
          <Mic size={13} strokeWidth={2} />
        </button>
        {activePanel === 'mic' && (
          <div ref={micPanelRef} id={micPanelId} role="dialog" aria-label="Rekam suara" style={popoverRightStyle}>
            <p style={SR_ONLY}>Tekan Escape untuk menutup panel ini.</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '12.5px' }}>Rekam suara</strong>
              <button type="button" aria-label="Tutup panel rekam suara" onClick={closePanel} style={{ background: 'transparent', border: 0, color: MUTED, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>
            {micCapError && <p style={{ fontSize: '11px', color: '#ffb4b4', margin: 0 }}>{micCapError}</p>}

            {/* Model transkripsi: search + pilih -- pengganti toggle boolean lama.
                Cuma dirender kalau transkripsi memang aktif (micEnabled truthy);
                kalau tidak aktif, cari model pun percuma (backend akan 503). */}
            {micEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderBottom: `1px solid ${BORDER}`, paddingBottom: '10px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={fieldLabelStyle}>Model transkripsi</span>
                  <input
                    type="text"
                    value={micModelQuery}
                    onChange={(e) => setMicModelQuery(e.target.value)}
                    placeholder="Cari model (kosongkan untuk Auto)..."
                    style={inputStyle}
                    aria-label="Cari model transkripsi"
                  />
                </label>
                <div role="listbox" aria-label="Pilihan model transkripsi" style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '130px', overflowY: 'auto' }}>
                  <ModelChoiceRow
                    selected={prefs.sttModel === 'auto'}
                    label="Auto"
                    sub="Tercepat/termurah yang tersedia (bawaan sistem)"
                    onClick={() => onPrefsChange({ ...prefs, sttModel: 'auto' })}
                  />
                  {sttModels.loading && <p style={{ fontSize: '11px', color: MUTED, margin: 0 }}>Memuat model...</p>}
                  {sttModels.error && <p style={{ fontSize: '11px', color: '#ffb4b4', margin: 0 }}>{sttModels.error}</p>}
                  {filteredSttModels.map((model) => (
                    <ModelChoiceRow
                      key={model.id}
                      selected={prefs.sttModel === model.id}
                      label={model.name}
                      sub={
                        model.provider === 'groq'
                          ? 'Groq -- sama seperti Auto (fast-path bawaan)'
                          : `OpenRouter${model.pricing?.costUsd != null ? ` -- $${model.pricing.costUsd}/${model.pricing.unit || 'unit'}` : ''}`
                      }
                      onClick={() => onPrefsChange({ ...prefs, sttModel: model.id })}
                    />
                  ))}
                </div>
              </div>
            )}

            <React.Suspense fallback={<p style={{ fontSize: '12px', color: MUTED, margin: 0 }}>Memuat perekam suara...</p>}>
              <LazyVoiceRecorder enabled={micEnabled === true} model={sttModelParam} onSend={handleMicTranscriptSend} />
            </React.Suspense>
          </div>
        )}
      </div>

      {/* (c) tombol "Setelan jawaban" -> popover model teks + upaya + mode Gambar/Video */}
      <div style={{ position: 'relative' }}>
        <button
          ref={settingsButtonRef}
          type="button"
          disabled={disabled}
          aria-label="Setelan jawaban"
          aria-haspopup="dialog"
          aria-expanded={activePanel === 'settings'}
          aria-controls={settingsPanelId}
          onClick={() => setActivePanel((p) => (p === 'settings' ? null : 'settings'))}
          title="Setelan jawaban: model, tingkat upaya, kualitas gambar/video"
          style={iconButtonStyle(activePanel === 'settings', disabled, true)}
        >
          <SlidersHorizontal size={13} strokeWidth={2} />
          <span>{settingsSummary}</span>
        </button>
        {activePanel === 'settings' && (
          <div ref={settingsPanelRef} id={settingsPanelId} role="dialog" aria-label="Setelan jawaban" style={popoverRightStyle}>
            <p style={SR_ONLY}>Tekan Escape untuk menutup panel ini.</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '12.5px' }}>Setelan jawaban</strong>
              <button type="button" aria-label="Tutup panel setelan jawaban" onClick={closePanel} style={{ background: 'transparent', border: 0, color: MUTED, cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            {/* Model teks (selalu tampil -- berlaku untuk mode Tanya) */}
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={fieldLabelStyle}>Model teks</span>
              <input
                type="text"
                value={textModelQuery}
                onChange={(e) => setTextModelQuery(e.target.value)}
                placeholder="Cari model (kosongkan untuk Auto)..."
                style={inputStyle}
                aria-label="Cari model teks"
              />
            </label>
            <div role="listbox" aria-label="Pilihan model teks" style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto' }}>
              <ModelChoiceRow
                selected={prefs.textModel === 'auto'}
                label="Auto"
                sub="Ikut rute hemat bawaan sistem"
                onClick={() => onPrefsChange({ ...prefs, textModel: 'auto' })}
              />
              {textModels.loading && <p style={{ fontSize: '11px', color: MUTED, margin: 0 }}>Memuat model...</p>}
              {textModels.error && <p style={{ fontSize: '11px', color: '#ffb4b4', margin: 0 }}>{textModels.error}</p>}
              {textModels.items.map((model) => (
                <ModelChoiceRow
                  key={model.id}
                  selected={prefs.textModel === model.id}
                  label={model.name}
                  sub={`${costClassLabel(model.costClass)}${model.pricingKnown && model.pricePromptPerM != null ? ` -- $${model.pricePromptPerM.toFixed(2)}/juta token` : ' -- harga belum diketahui'}`}
                  onClick={() => onPrefsChange({ ...prefs, textModel: model.id })}
                />
              ))}
            </div>

            {/* Tingkat upaya (selalu tampil) */}
            <div>
              <span style={fieldLabelStyle}>Tingkat upaya</span>
              <div role="group" aria-label="Pilih tingkat upaya" style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
                {EFFORT_LEVELS.map((level) => {
                  const active = prefs.effort === level;
                  return (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onPrefsChange({ ...prefs, effort: level })}
                      title={effortEtaLabel(level)}
                      style={{ ...pillButtonStyle(active, false), flexDirection: 'column', height: 'auto', padding: '6px 10px', gap: '2px', alignItems: 'flex-start' }}
                    >
                      <span style={{ textTransform: 'capitalize' }}>{level}</span>
                      <span style={{ fontSize: '9.5px', fontWeight: 500, color: active ? ACCENT : MUTED }}>{effortEtaLabel(level)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode Gambar: model + kualitas (kondisional) + rasio */}
            {prefs.mode === 'image' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: `1px solid ${BORDER}`, paddingTop: '10px' }}>
                <span style={fieldLabelStyle}>Mode Gambar</span>
                <input
                  type="text"
                  value={imageModelQuery}
                  onChange={(e) => setImageModelQuery(e.target.value)}
                  placeholder="Cari model gambar..."
                  style={inputStyle}
                  aria-label="Cari model gambar"
                />
                {imageModels.loading && <p style={{ fontSize: '11px', color: MUTED, margin: 0 }}>Memuat model gambar...</p>}
                {imageModels.error && <p style={{ fontSize: '11px', color: '#ffb4b4', margin: 0 }}>{imageModels.error}</p>}
                <select
                  value={prefs.image.model}
                  onChange={(e) => onPrefsChange(withImagePrefs(prefs, { model: e.target.value }))}
                  style={selectStyle}
                  aria-label="Pilih model gambar"
                >
                  <option value="auto">Auto</option>
                  {filteredImageModels.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
                {showImageQuality && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={fieldLabelStyle}>Kualitas</span>
                    <select
                      value={prefs.image.quality || ''}
                      onChange={(e) => onPrefsChange(withImagePrefs(prefs, { quality: e.target.value || undefined }))}
                      style={selectStyle}
                    >
                      <option value="">Bawaan model</option>
                      {(selectedImageModel?.capabilities.qualities || []).map((q) => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={fieldLabelStyle}>Rasio</span>
                  <select
                    value={prefs.image.aspectRatio || ''}
                    onChange={(e) => onPrefsChange(withImagePrefs(prefs, { aspectRatio: e.target.value || undefined }))}
                    style={selectStyle}
                  >
                    <option value="">{defaultImageRatio(selectedImageModel) ? `Bawaan (${defaultImageRatio(selectedImageModel)})` : 'Bawaan model'}</option>
                    {imageRatioOptions.map((ratio) => (
                      <option key={ratio} value={ratio}>{ratio}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* Mode Video: model + resolusi + durasi -- TANPA kontrol kualitas (D-9:
                submitVideoJob backend tidak pernah membaca field itu, menampilkannya
                akan jadi kontrol bohong). */}
            {allowVideo && prefs.mode === 'video' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: `1px solid ${BORDER}`, paddingTop: '10px' }}>
                <span style={fieldLabelStyle}>Mode Video</span>
                <input
                  type="text"
                  value={videoModelQuery}
                  onChange={(e) => setVideoModelQuery(e.target.value)}
                  placeholder="Cari model video..."
                  style={inputStyle}
                  aria-label="Cari model video"
                />
                {videoModels.loading && <p style={{ fontSize: '11px', color: MUTED, margin: 0 }}>Memuat model video...</p>}
                {videoModels.error && <p style={{ fontSize: '11px', color: '#ffb4b4', margin: 0 }}>{videoModels.error}</p>}
                <select
                  value={prefs.video.model}
                  onChange={(e) => onPrefsChange(withVideoPrefs(prefs, { model: e.target.value }))}
                  style={selectStyle}
                  aria-label="Pilih model video"
                >
                  <option value="auto">Auto</option>
                  {filteredVideoModels.map((model) => (
                    <option key={model.id} value={model.id}>{model.name}</option>
                  ))}
                </select>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={fieldLabelStyle}>Resolusi</span>
                  {(selectedVideoModel?.capabilities.resolutions || []).length > 0 ? (
                    <select
                      value={prefs.video.resolution || ''}
                      onChange={(e) => onPrefsChange(withVideoPrefs(prefs, { resolution: e.target.value || undefined }))}
                      style={selectStyle}
                    >
                      <option value="">Bawaan model</option>
                      {(selectedVideoModel?.capabilities.resolutions || []).map((res) => (
                        <option key={res} value={res}>{res}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={prefs.video.resolution || ''}
                      onChange={(e) => onPrefsChange(withVideoPrefs(prefs, { resolution: e.target.value || undefined }))}
                      placeholder="Bawaan model"
                      style={inputStyle}
                    />
                  )}
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={fieldLabelStyle}>Durasi (detik)</span>
                  {(selectedVideoModel?.capabilities.durations || []).length > 0 ? (
                    <select
                      value={String(prefs.video.durationSeconds ?? '')}
                      onChange={(e) => onPrefsChange(withVideoPrefs(prefs, { durationSeconds: e.target.value ? Number(e.target.value) : undefined }))}
                      style={selectStyle}
                    >
                      <option value="">Bawaan model</option>
                      {(selectedVideoModel?.capabilities.durations || []).map((d) => (
                        <option key={d} value={d}>{d} detik</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={prefs.video.durationSeconds ?? ''}
                      onChange={(e) => onPrefsChange(withVideoPrefs(prefs, { durationSeconds: e.target.value ? Number(e.target.value) : undefined }))}
                      placeholder="Bawaan model"
                      style={inputStyle}
                    />
                  )}
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {trailing}
      </div>

      {/* (d) menu slash -- muncul saat inputValue diawali '/' */}
      {slashMatches.length > 0 && (
        <ul
          role="listbox"
          aria-label="Perintah slash"
          style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, zIndex: 40,
            width: 'min(300px, 90vw)', maxHeight: '220px', overflowY: 'auto',
            background: BASE_BG, border: 0, borderRadius: '12px',
            padding: '6px', margin: 0, listStyle: 'none', boxShadow: '0 20px 50px #0009',
          }}
        >
          {slashMatches.map((command, idx) => (
            <li key={command.id} role="option" aria-selected={idx === slashActiveIndex}>
              <button
                type="button"
                onClick={() => selectSlash(command)}
                onMouseEnter={() => setSlashActiveIndex(idx)}
                style={{
                  display: 'flex', flexDirection: 'column', gap: '1px', width: '100%', textAlign: 'left',
                  padding: '7px 9px', borderRadius: '8px', border: 0, cursor: 'pointer', fontFamily: FONT,
                  background: idx === slashActiveIndex ? `${ACCENT}22` : 'transparent',
                  color: idx === slashActiveIndex ? ACCENT : TEXT_COLOR,
                }}
              >
                <span style={{ fontSize: '12px', fontWeight: 700 }}>{command.label}</span>
                <span style={{ fontSize: '10.5px', color: MUTED }}>{command.desc}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

function costClassLabel(costClass: TextModelOption['costClass']): string {
  if (costClass === 'hemat') return 'Hemat';
  if (costClass === 'premium') return 'Premium';
  return 'Standar';
}

function ModelChoiceRow({ selected, label, sub, onClick }: { selected: boolean; label: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', gap: '1px', width: '100%', textAlign: 'left',
        padding: '6px 8px', borderRadius: '8px', border: 0,
        cursor: 'pointer', fontFamily: FONT, background: selected ? `${ACCENT}22` : 'transparent',
        boxShadow: selected ? `inset 2px 0 0 ${ACCENT}` : 'none',
        color: selected ? ACCENT : TEXT_COLOR,
      }}
    >
      <span style={{ fontSize: '12px', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '10px', color: MUTED }}>{sub}</span>
    </button>
  );
}
