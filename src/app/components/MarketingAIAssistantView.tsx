'use client';

import React, { useState, useEffect, useRef } from 'react';
import { consumeInitialPrompt } from '@/lib/initial-prompt-storage';
import TermHint from './TermHint';
import MediaStudio from './marketing-media/MediaStudio';
import StudioResult from './marketing-media/StudioResult';
// Roadmap 7 Sep item 4.5 -- kartu hasil document-checker/tabular-checker.
import DocumentCheckCard from './DocumentCheckCard';
// T3 (8 Sep 2026) -- kartu verdict relevansi lampiran chat, dipakai identik di 3 view.
import AttachmentVerdictCard, { type AttachmentVerdict } from './AttachmentVerdictCard';
import type { DocumentCheckReport } from '@/lib/ai-brain/document-checker';
import type { TabularCheckReport } from '@/lib/ai-brain/tabular-checker';
// RISET WEB + PREDIKSI FORECAST + LOKASI (8 Sep 2026, wave B5-chat-wiring-ui) --
// 3 kartu presentasi baru (murni, identik di 3 AI Assistant View) untuk field
// additif brain/chat data.researchSources/forecast/locationPrompt (B1/B2/B3/B4).
import ResearchSourcesCard from './chat/ResearchSourcesCard';
import ForecastCard from './chat/ForecastCard';
import LocationForm from './chat/LocationForm';
import type { ResearchSource, BlendedForecastResult, ForecastExtraData, LocationPromptNeeded, LocationAnalysisInput, LocationAnalysisResult } from '@/lib/research-types';
// V1 RENDER KAYA + V3 TOMBOL LANJUTAN (8 Sep 2026) -- render markdown kaya (tabel/blok kode)
// + tombol aksi lanjutan deterministik di bawah gelembung jawaban AI. Pengganti fungsi lokal
// parseInline/FormattedMessage (dulu diduplikasi persis di 3 view, lihat CHANGELOG 8 Sep).
import RichMessage from './chat/RichMessage';
import NextActionsBar from './chat/NextActionsBar';
import type { NextAction } from '@/lib/ai-brain/next-actions';
import { executeActionCardOnServer } from '@/lib/ai-brain/action-card-execution';
import WorkspaceDataHub from './WorkspaceDataHub';
import StorageFilePickerModal, { type StorageFileItem } from './StorageFilePickerModal';
import AttachmentMenuButton from './chat/AttachmentMenuButton';
import DragDropFileOverlay from './chat/DragDropFileOverlay';
import { apiRequest, ApiRequestError, createSendQueue, detectStudioIntent, pollVideoJob, resolveStudioSource, validMediaResult, type StudioKind, type StudioMessage, type StudioSubmission, type MediaResult } from './marketing-media/client';
import type { NotebookResult } from '@/lib/notebook-types';
// SETELAN JAWABAN + COMPOSER TOOLBAR (8 Sep 2026, wave B5-wiring-3-view) -- komponen
// adapter murni (B2) + SSOT tipe/localStorage (B1) + logic preferensi pembaca (B4) +
// registry slash-command (B6). Diimpor apa adanya, cuma disambungkan ke state/
// handleSendMessage/openStudio yang sudah ada di file ini (pola identik Finance/Executive).
import ComposerToolbar from './chat/ComposerToolbar';
import { useAutoGrowTextarea } from '@/lib/use-autogrow-textarea';
import type { ComposerToolbarHandle } from './chat/ComposerToolbar';
import AnswerFeedbackBar from './chat/AnswerFeedbackBar';
import type { ComposerMode, ComposerPrefs, EffortLevel } from '@/lib/chat-composer-types';
import { DEFAULT_COMPOSER_PREFS } from '@/lib/chat-composer-types';
import { readComposerPrefs, writeComposerPrefs } from '@/lib/chat-composer-prefs';
import type { SlashCommand } from '@/lib/slash-commands';
import { getClientAuthHeaders, getActiveClientWorkspaceId } from '@/lib/client-auth';
import type { ReaderPreferences } from '@/lib/reader-preferences';
import { DEFAULT_READER_PREFERENCES, inferFromHistory, mergeExplicitFeedback } from '@/lib/reader-preferences';
import { readCeoAiChatParams } from '@/lib/ceo-ai-settings-client';
import { sanitizeLiveCompanyState } from '@/lib/live-company-state';
import mediaStyles from './marketing-media/studio.module.css';
import { MarketingSettingsModal, type MarketingSettingsTab } from './settings/MarketingSettingsModal';
// Panel proaktif "Perlu perhatian" (F2 Tingkat B, 10 Sep 2026, kontrak marketing-build
// item f) -- wadah reusable sudah dipasang identik di Executive + Finance AI Assistant,
// sumber 'brain' di registry proactive-alerts.ts role-agnostic jadi tidak butuh backend
// baru. Lihat komentar di titik pemasangan (dekat "A. EMPTY HERO HOME VIEW") untuk detail.
import ProactiveAlertsPanel from './chat/ProactiveAlertsPanel';
import {
  Megaphone,
  User,
  Plus,
  PanelLeftClose,
  PanelLeft,
  ShieldCheck,
  Paperclip,
  X,
  Send,
  Check,
  Copy,
  ThumbsUp,
  Zap,
  RefreshCw,
  LogOut,
  FileText,
  Settings2,
  ArrowRight,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  Video,
  Image as ImageIcon,
  Palette,
  Tag,
  Target,
  DollarSign,
  Layers,
  Globe,
  Play,
  FileSpreadsheet,
  Download,
  Shield,
  ClipboardCheck,
  PieChart,
  Search,
  BookOpen,
  MessageSquare,
  Calendar,
  Presentation,
  Terminal,
  GraduationCap,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Folder,
  Database,
  Users,
  Receipt,
  Mic,
  Trash2,
} from 'lucide-react';

interface MarketingAIAssistantViewProps {
  workspaceId?: string;
  workspaceName?: string;
  userName?: string;
  onDeployCampaign?: (campaign: any) => void;
  /** Return to the authenticated gateway before switching division. */
  onRoleChange?: () => void;
}

interface ActionCard {
  type: 'LAUNCH_ADS' | 'SCALE_BUDGET' | 'CREATE_PROMO' | string;
  recommendationId?: string;
  title: string;
  description: string;
  impactText?: string;
  actionLabel?: string;
  actionPayload?: { confirmationMessage?: string };
}

interface ChatMessage extends StudioMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  attachment?: {
    name: string;
    size: string;
  };
  actionCard?: ActionCard;
  /** gambar ASLI hasil generate server */
  realImage?: { url: string; prompt: string; provider: string };
  /** file ASLI (docx/xlsx/pptx/storyboard) hasil generate server */
  realFile?: { fileName: string; mimeType: string; fileBase64: string; type: string };
  /** T3 (8 Sep 2026) -- verdict relevansi lampiran (field additif brain/chat),
   * absen kalau lampiran tidak ada/gagal tersimpan -- BUKAN error. */
  attachmentVerdict?: AttachmentVerdict;
  /** V3 TOMBOL LANJUTAN (8 Sep 2026) -- field additif brain/chat `data.nextActions`,
   * array kosong/absen = tidak render NextActionsBar sama sekali. */
  nextActions?: NextAction[];
  /** SETELAN JAWABAN (8 Sep 2026, B5) -- nama model yang BENAR-BENAR dipakai server
   * (field response `data.model`). Absen kalau jalur respons ini tidak mengisinya. */
  modelUsed?: string;
  /** SETELAN JAWABAN OTOMATIS (11 Sep 2026, kontrak modul 1+2) -- lihat komentar
   * identik di ExecutiveAIAssistantView.tsx. */
  effortAuto?: boolean;
  effortUsed?: string;
  modelTierUsed?: string;
  assistantModeUsed?: string;
  /** RISET WEB + PREDIKSI + LOKASI (8 Sep 2026, wave B5) -- lihat komentar identik
   * di ExecutiveAIAssistantView.tsx (satu-satunya sumber acuan panjang). */
  researchSources?: { sources: ResearchSource[]; fetchedAt: string; note?: string };
  prediction?: BlendedForecastResult;
  locationPrompt?: LocationPromptNeeded;
  locationResult?: LocationAnalysisResult;
}

interface ChatSession {
  id: string;
  updatedAt: number;
  messages: ChatMessage[];
}

// V1 RENDER KAYA (8 Sep 2026): parseInline + FormattedMessage lokal DIHAPUS dari sini --
// digantikan komponen bersama src/app/components/chat/RichMessage.tsx (lihat call site
// <RichMessage content={msg.text} accent="marketing" /> di bawah). Logic parsing markdown
// murni sekarang hidup di src/lib/chat-markdown.ts (testable tanpa React).

// Brand kit warna literal (identik dengan mockup Claude Design v5 -- WAJIB sama persis).
const BRAND_PALETTES: { name: string; colors: [string, string, string] }[] = [
  { name: 'Biru korporat', colors: ['#0058BE', '#4E9BFF', '#06080C'] },
  { name: 'Emas premium', colors: ['#D8A33C', '#C9A66B', '#0B0E14'] },
  { name: 'Hijau segar', colors: ['#3FBF8F', '#8CE0C2', '#06080C'] },
  { name: 'Monokrom tegas', colors: ['#F5F7FA', '#8A93A3', '#06080C'] },
];

// 5 preset produksi eksklusif role marketing (identik dengan PRESETS mockup v5).
const MARKETING_PRESETS = [
  {
    key: 'poster',
    style: 'glass',
    styleLabel: '3D glassmorphism',
    title: 'Poster iklan 3D glassmorphism',
    note: 'Panel kaca tembus pandang, cahaya lembut, kesan premium.',
    cta: 'Buat poster',
    prompt:
      'Buatkan poster iklan bergaya 3D glassmorphism untuk produk kami: panel kaca tembus pandang, cahaya lembut, headline tebal, dan tombol ajakan bertindak.',
  },
  {
    key: 'tiktok',
    style: 'neon',
    styleLabel: 'Sinematik dark-neon',
    title: 'Video TikTok vertikal 9:16',
    note: 'Empat scene siap rekam, durasi total 30 detik.',
    cta: 'Buat video',
    prompt:
      'Buatkan video TikTok vertikal 9:16 bergaya sinematik dark-neon dengan empat scene: hook, masalah, solusi, dan ajakan bertindak.',
  },
  {
    key: 'copy',
    style: 'ugc',
    styleLabel: 'Testimoni UGC',
    title: 'Naskah copywriting hook-problem-solution-CTA',
    note: 'Formula empat bagian dengan gaya testimoni pengguna.',
    cta: 'Tulis naskah',
    prompt:
      'Tuliskan naskah copywriting dengan formula hook, problem, solution, dan CTA bergaya testimoni pengguna asli untuk produk kami.',
  },
  {
    key: 'roas',
    style: 'studio',
    styleLabel: 'Foto produk studio',
    title: 'Audit performa ROAS iklan',
    note: 'Bedah ROAS, CAC, dan kanal paling efisien.',
    cta: 'Jalankan audit',
    prompt:
      'Lakukan audit performa ROAS iklan bulan ini: bedah ROAS per kanal, CAC, biaya per lead, dan rekomendasi realokasi anggaran.',
  },
  {
    key: 'voucher',
    style: 'glass',
    styleLabel: '3D glassmorphism',
    title: 'Kode voucher promo flash sale',
    note: 'Set kode, aturan pakai, dan batas waktu.',
    cta: 'Buat voucher',
    prompt:
      'Buatkan set kode voucher promo flash sale: format kode, besaran diskon, aturan pemakaian, kuota, dan batas waktu berlaku.',
  },
];

// Ikon "Semua kemampuan AI" — key string identik dengan nama lucide di mockup Claude Design v6,
// diresolve ke komponen lucide-react saat render lewat CAP_ICON_MAP.
const CAP_ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  shield: Shield,
  'clipboard-check': ClipboardCheck,
  'trending-up': TrendingUp,
  'pie-chart': PieChart,
  search: Search,
  'book-open': BookOpen,
  'message-square': MessageSquare,
  globe: Globe,
  video: Video,
  image: ImageIcon,
  megaphone: Megaphone,
  calendar: Calendar,
  sparkles: Palette,
  presentation: Presentation,
  target: Target,
  layers: Layers,
  'graduation-cap': GraduationCap,
};

// "Semua kemampuan AI" -- 5 kategori, hanya kapabilitas yang relevan role marketing
// (porting 1:1 dari CAPABILITIES()/CAP_CATS() mockup v6, difilter roles.includes('marketing')).
const CAP_GROUPS: {
  title: string;
  tone: string;
  items: { key: string; label: string; note: string; icon: string; prompt: string }[];
}[] = [
  {
    title: 'Dokumen & korespondensi',
    tone: '#4E9BFF',
    items: [
      { key: 'complaint', label: 'Balasan komplain klien', note: 'Redakan dulu, akui fakta, tawarkan jalan keluar', icon: 'shield', prompt: 'Buatkan balasan untuk komplain klien yang kecewa dengan keterlambatan pengerjaan: akui fakta, jelaskan penyebab, tawarkan solusi konkret dan kompensasi yang masuk akal.' },
      { key: 'sop', label: 'SOP & prosedur kerja', note: 'Langkah bernomor, penanggung jawab, kriteria selesai', icon: 'clipboard-check', prompt: 'Susun SOP prosedur kerja lengkap: tujuan, ruang lingkup, langkah berurutan, penanggung jawab tiap langkah, dan kriteria selesai.' },
    ],
  },
  {
    title: 'Analisis & data',
    tone: '#3FBF8F',
    items: [
      { key: 'ads_audit', label: 'Evaluasi performa iklan', note: 'ROAS dan CAC per kanal, mana yang dihentikan', icon: 'trending-up', prompt: 'Evaluasi performa iklan bulan ini berdasarkan ROAS, CAC, dan kontribusi tiap kanal.' },
      { key: 'chart', label: 'Grafik & visualisasi data', note: 'Angka mentah jadi grafik plus temuan utamanya', icon: 'pie-chart', prompt: 'Ubah angka mentah ini menjadi visualisasi data: pilih jenis grafik yang tepat, jelaskan alasannya, sebutkan sumbu dan label, lalu tuliskan temuan utamanya.' },
      { key: 'research', label: 'Riset & analisis data', note: 'Temuan, angka pendukung, dan rekomendasi tindakan', icon: 'search', prompt: 'Lakukan riset dan analisis data bisnis perusahaan bulan ini, sertakan temuan utama, angka pendukung, dan rekomendasi.' },
    ],
  },
  {
    title: 'Dokumen panjang & rapat',
    tone: '#8CBEFF',
    items: [
      { key: 'longdoc', label: 'Ringkasan & tanya-jawab dokumen', note: 'Unggah PDF ratusan halaman, tanya isinya', icon: 'book-open', prompt: 'Ringkas dokumen panjang yang saya unggah menjadi poin-poin utama, lalu siap menjawab pertanyaan lanjutan tentang isinya.' },
      { key: 'minutes', label: 'Notulen dari transkrip rapat', note: 'Keputusan, daftar tugas, dan tenggatnya', icon: 'message-square', prompt: 'Ubah transkrip rapat ini menjadi notulen resmi: ringkasan pembahasan, keputusan yang diambil, daftar tugas dengan penanggung jawab, dan tenggat waktunya.' },
      { key: 'translate', label: 'Terjemahan bahasa', note: 'ID, EN, Mandarin, Jepang, istilah teknis dijaga', icon: 'globe', prompt: 'Terjemahkan dokumen ini ke bahasa Inggris dengan gaya bisnis formal, pertahankan istilah teknis, dan tandai bagian yang ambigu.' },
    ],
  },
  {
    title: 'Materi promosi',
    tone: '#C9A66B',
    items: [
      { key: 'video', label: 'Video promosi 9:16', note: '30 detik, 4 scene, naskah dan visual per scene', icon: 'video', prompt: 'Buatkan video TikTok vertikal 9:16 dengan empat scene: hook, masalah, solusi, dan ajakan bertindak.' },
      { key: 'image', label: 'Poster & banner promosi', note: 'Feed, story, thumbnail, satu headline konsisten', icon: 'image', prompt: 'Buatkan poster promosi produk untuk feed dan story, sertakan headline dan variasi tiap ukuran.' },
      { key: 'copywriting', label: 'Naskah copywriting', note: 'Pola hook, masalah, solusi, ajakan bertindak', icon: 'megaphone', prompt: 'Tuliskan naskah copywriting dengan formula hook, problem, solution, dan CTA untuk produk kami.' },
      { key: 'content_cal', label: 'Jadwal konten sepekan', note: '7 hari caption lengkap dengan jam tayang', icon: 'calendar', prompt: 'Buatkan rencana konten sosial satu pekan lengkap dengan caption harian dan jadwal tayang.' },
      { key: 'naming', label: 'Nama produk & tagline', note: 'Sepuluh opsi dengan alasan tiap pilihan', icon: 'sparkles', prompt: 'Usulkan sepuluh nama produk beserta taglinenya, jelaskan alasan tiap pilihan, dan tandai mana yang paling mudah diingat pasar Indonesia.' },
      { key: 'slide', label: 'Presentasi & slide', note: '10 slide berjudul dengan poin isi tiap halaman', icon: 'presentation', prompt: 'Buatkan kerangka presentasi 10 slide untuk rapat strategi bulanan, sertakan judul dan poin isi tiap slide.' },
    ],
  },
  {
    title: 'Teknis & riset pasar',
    tone: '#D8A33C',
    items: [
      { key: 'competitor', label: 'Riset kompetitor', note: 'Peta harga pesaing dan celah yang bisa diambil', icon: 'target', prompt: 'Lakukan riset kompetitor: bandingkan posisi harga, keunggulan, kelemahan, dan tunjukkan celah pasar yang bisa kami ambil.' },
      { key: 'swot', label: 'Analisis SWOT & risiko', note: 'Kekuatan, kelemahan, peluang, ancaman', icon: 'layers', prompt: 'Susun analisis SWOT perusahaan kami berdasarkan data yang ada, lalu urutkan risiko terbesar beserta langkah mitigasinya.' },
      { key: 'training', label: 'Materi pelatihan & onboarding', note: 'Modul, latihan, dan kuis penilaian', icon: 'graduation-cap', prompt: 'Buatkan materi pelatihan onboarding staf baru: modul per topik, latihan praktik, dan kuis penilaian di akhir.' },
    ],
  },
];

// Render visual placeholder per gaya (port 1:1 dari styleArt() mockup v5, React.createElement -> JSX).
function StyleArt({ style, tone }: { style: string; tone: string }) {
  const accent = tone || '#D8A33C';

  if (style === 'glass') {
    return (
      <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'linear-gradient(150deg,#101A2E,#0A0D14 62%)' }}>
        <span style={{ position: 'absolute', left: '-14%', top: '14%', width: '58%', height: '62%', borderRadius: '999px', background: `radial-gradient(circle at 30% 30%,${accent}88,${accent}10 70%)`, filter: 'blur(2px)' }} />
        <span style={{ position: 'absolute', right: '-8%', bottom: '-12%', width: '52%', height: '58%', borderRadius: '999px', background: 'radial-gradient(circle at 40% 40%,#4E9BFF88,#4E9BFF10 70%)', filter: 'blur(2px)' }} />
        <span
          style={{
            position: 'absolute',
            left: '18%',
            top: '24%',
            width: '64%',
            height: '52%',
            borderRadius: '14px',
            background: 'linear-gradient(140deg,rgba(255,255,255,0.16),rgba(255,255,255,0.03))',
            border: '1px solid rgba(255,255,255,0.24)',
            backdropFilter: 'blur(6px)',
            boxShadow: '0 18px 40px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            padding: '11px 12px',
          }}
        >
          <span style={{ display: 'block', width: '58%', height: '7px', borderRadius: '99px', background: '#FFFFFF', opacity: 0.82 }} />
          <span style={{ display: 'block', width: '84%', height: '4px', borderRadius: '99px', background: '#FFFFFF', opacity: 0.34 }} />
          <span style={{ display: 'block', width: '70%', height: '4px', borderRadius: '99px', background: '#FFFFFF', opacity: 0.24 }} />
          <span style={{ marginTop: 'auto', width: '42%', height: '11px', borderRadius: '4px', background: accent }} />
        </span>
      </span>
    );
  }

  if (style === 'studio') {
    return (
      <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'linear-gradient(180deg,#1A1E26 58%,#0D1016)' }}>
        <span style={{ position: 'absolute', left: '50%', top: '16%', width: '54%', height: '52%', transform: 'translateX(-50%)', borderRadius: '10px', background: 'linear-gradient(165deg,#F5F7FA,#B9C2CF)', boxShadow: '0 22px 34px rgba(0,0,0,0.55)' }} />
        <span style={{ position: 'absolute', left: '50%', top: '66%', width: '46%', height: '9px', transform: 'translateX(-50%)', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', filter: 'blur(4px)' }} />
        <span style={{ position: 'absolute', left: '50%', top: '78%', width: '58%', height: '5px', transform: 'translateX(-50%)', borderRadius: '99px', background: accent, opacity: 0.85 }} />
      </span>
    );
  }

  if (style === 'ugc') {
    return (
      <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'linear-gradient(160deg,#241E1A,#0C0D12)' }}>
        <span style={{ position: 'absolute', left: '9%', top: '12%', width: '46%', height: '54%', borderRadius: '10px', background: 'linear-gradient(150deg,#6C5A4A,#3A322C)', border: '1px solid rgba(255,255,255,0.14)', transform: 'rotate(-5deg)', boxShadow: '0 16px 30px rgba(0,0,0,0.5)' }} />
        <span style={{ position: 'absolute', right: '10%', top: '20%', width: '34%', height: '42%', borderRadius: '10px', background: 'linear-gradient(150deg,#8A7461,#4A4038)', border: '1px solid rgba(255,255,255,0.12)', transform: 'rotate(6deg)', boxShadow: '0 16px 30px rgba(0,0,0,0.5)' }} />
        <span style={{ position: 'absolute', left: '12%', right: '12%', bottom: '13%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ display: 'flex', gap: '3px' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} style={{ width: '8px', height: '8px', borderRadius: '2px', background: accent, opacity: i === 4 ? 0.32 : 1 }} />
            ))}
          </span>
          <span style={{ display: 'block', width: '80%', height: '4px', borderRadius: '99px', background: '#FFFFFF', opacity: 0.3 }} />
        </span>
      </span>
    );
  }

  // neon (default)
  return (
    <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'linear-gradient(165deg,#0B1220,#07080D)' }}>
      <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(75% 55% at 26% 22%,#4E9BFF44,rgba(0,0,0,0) 68%)' }} />
      <span style={{ position: 'absolute', inset: 0, background: `radial-gradient(65% 50% at 78% 82%,${accent}3D,rgba(0,0,0,0) 66%)` }} />
      <span style={{ position: 'absolute', left: '16%', right: '16%', top: '38%', height: '2px', background: 'linear-gradient(90deg,rgba(255,255,255,0),#4E9BFF,rgba(255,255,255,0))' }} />
      <span style={{ position: 'absolute', left: '24%', right: '24%', top: '52%', height: '1px', background: `linear-gradient(90deg,rgba(255,255,255,0),${accent},rgba(255,255,255,0))` }} />
      <span style={{ position: 'absolute', left: '50%', top: '62%', width: '44%', height: '10px', transform: 'translateX(-50%)', borderRadius: '4px', background: `linear-gradient(90deg,#4E9BFF,${accent})`, opacity: 0.9 }} />
    </span>
  );
}

// Kartu ilustrasi "Mulai dari tugas nyata" -- port 1:1 dari cardArt() mockup Claude Design v6 /
// ExecutiveAIAssistantView.tsx (baris 364-623), dipakai persis sama karena section ini UNIVERSAL
// (bukan role-gated) di mockup: sama untuk exec/finance/marketing.
function cardArt(kind: string, tone: string, idx: number) {
  const delay = (idx % 3) * 0.9;
  const sheet = (w: number, ht: number, extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: `${w}px`,
    height: `${ht}px`,
    borderRadius: '7px',
    background: 'linear-gradient(158deg,#161C28,#0C1018)',
    border: '1px solid rgba(255,255,255,0.15)',
    boxShadow: '0 20px 34px rgba(0,0,0,0.55)',
    overflow: 'hidden',
    flexShrink: 0,
    ...extra,
  });
  const line = (w: string, o: number, c?: string) => (
    <span style={{ display: 'block', height: '3px', width: w, borderRadius: '99px', background: c || '#FFFFFF', opacity: o }} />
  );
  const stage = (children: React.ReactNode) => (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '32px',
        perspective: '780px',
        background: `radial-gradient(130% 95% at 50% 118%, ${tone}1C, rgba(255,255,255,0) 62%)`,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          transformStyle: 'preserve-3d',
          animation: 'klirFloat 7.5s ease-in-out infinite',
          animationDelay: `${delay}s`,
        }}
      >
        {children}
      </span>
    </span>
  );

  if (kind === 'mail') {
    return stage(
      <>
        <span style={sheet(84, 62, { marginRight: '-46px', opacity: 0.5, transform: 'translateZ(-26px)' })} />
        <span style={sheet(96, 70, { padding: '9px 10px', gap: '6px' })}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '14px', height: '10px', borderRadius: '2px', border: `1px solid ${tone}`, opacity: 0.9 }} />
            {line('42%', 0.5)}
          </span>
          {line('86%', 0.28)}
          {line('72%', 0.22)}
          {line('80%', 0.18)}
          <span style={{ marginTop: 'auto', width: '38%', height: '9px', borderRadius: '3px', background: tone, opacity: 0.85 }} />
        </span>
      </>
    );
  }

  if (kind === 'bar-chart' || kind === 'trending-up') {
    const bars = [30, 44, 26, 54, 38];
    return stage(
      <span style={sheet(112, 74, { padding: '10px 11px', gap: '8px' })}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {line('34%', 0.4)}
          <span style={{ width: '16px', height: '5px', borderRadius: '99px', background: tone, opacity: 0.85 }} />
        </span>
        {kind === 'bar-chart' ? (
          <span style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '38px' }}>
            {bars.map((b, i) => (
              <span
                key={i}
                style={{
                  display: 'block',
                  width: '11px',
                  height: `${b}px`,
                  borderRadius: '2px 2px 1px 1px',
                  background: i === 3 ? tone : 'rgba(255,255,255,0.16)',
                  transformOrigin: 'bottom',
                  animation: 'klirRise 3.4s ease-in-out infinite',
                  animationDelay: `${i * 0.22 + delay}s`,
                }}
              />
            ))}
          </span>
        ) : (
          <span style={{ position: 'relative', height: '38px' }}>
            <svg viewBox="0 0 100 38" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
              <polyline points="2,33 22,26 42,29 62,15 82,9 98,4" fill="none" stroke={tone} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="2,33 22,26 42,29 62,15 82,9 98,4 98,38 2,38" fill={tone} opacity={0.14} stroke="none" />
              <circle cx={98} cy={4} r={3.4} fill={tone} style={{ animation: 'klirGlow 2.6s ease-in-out infinite', animationDelay: `${delay}s` }} />
            </svg>
          </span>
        )}
      </span>
    );
  }

  if (kind === 'users') {
    return stage(
      <span style={sheet(112, 74, { padding: '11px', gap: '9px' })}>
        {[72, 46, 88].map((pct, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '99px', background: i === 2 ? tone : 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
            <span style={{ flex: 1, height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.09)', overflow: 'hidden' }}>
              <span
                style={{
                  display: 'block',
                  width: `${pct}%`,
                  height: '100%',
                  borderRadius: '99px',
                  background: i === 2 ? tone : 'rgba(255,255,255,0.28)',
                  animation: i === 2 ? 'klirGlow 3s ease-in-out infinite' : 'none',
                  animationDelay: `${delay}s`,
                }}
              />
            </span>
          </span>
        ))}
      </span>
    );
  }

  if (kind === 'video') {
    return stage(
      <span style={sheet(118, 68, { alignItems: 'center', justifyContent: 'center' })}>
        <span
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '26px',
            background: 'linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,0.10),rgba(255,255,255,0))',
            animation: 'klirSweep 5.5s ease-in-out infinite',
            animationDelay: `${delay}s`,
          }}
        />
        <span
          style={{
            width: '26px',
            height: '26px',
            borderRadius: '99px',
            background: `${tone}2E`,
            border: `1px solid ${tone}66`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ width: 0, height: 0, marginLeft: '2px', borderTop: '5px solid transparent', borderBottom: '5px solid transparent', borderLeft: `8px solid ${tone}` }} />
        </span>
        <span style={{ position: 'absolute', left: '8px', right: '8px', bottom: '7px', display: 'flex', gap: '4px' }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ flex: 1, height: '8px', borderRadius: '2px', background: i === 1 ? `${tone}80` : 'rgba(255,255,255,0.12)' }} />
          ))}
        </span>
      </span>
    );
  }

  if (kind === 'image') {
    return stage(
      <>
        <span style={sheet(76, 58, { marginRight: '-40px', opacity: 0.45, transform: 'translateZ(-28px)' })} />
        <span style={sheet(102, 72, { padding: '9px', gap: '7px' })}>
          <span style={{ flex: 1, borderRadius: '4px', background: `linear-gradient(135deg,${tone}55,${tone}18)`, border: '1px solid rgba(255,255,255,0.10)' }} />
          <span style={{ display: 'flex', gap: '4px' }}>
            {[tone, '#4E9BFF', '#3FBF8F', 'rgba(255,255,255,0.22)'].map((c, i) => (
              <span key={i} style={{ width: '13px', height: '7px', borderRadius: '2px', background: c }} />
            ))}
          </span>
        </span>
      </>
    );
  }

  if (kind === 'calendar') {
    const filled: Record<number, number> = { 1: 1, 4: 1, 6: 1, 9: 1, 13: 1 };
    return stage(
      <span style={sheet(112, 74, { padding: '10px', gap: '7px' })}>
        <span style={{ display: 'flex', justifyContent: 'space-between' }}>
          {line('30%', 0.4)}
          {line('16%', 0.22)}
        </span>
        <span style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '3px' }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              style={{
                height: '10px',
                borderRadius: '2px',
                background: filled[i] ? tone : 'rgba(255,255,255,0.08)',
                opacity: filled[i] ? 0.9 : 1,
                animation: filled[i] ? 'klirGlow 3.2s ease-in-out infinite' : 'none',
                animationDelay: `${i * 0.12 + delay}s`,
              }}
            />
          ))}
        </span>
      </span>
    );
  }

  if (kind === 'file-spreadsheet') {
    return stage(
      <span style={sheet(114, 74, { padding: 0 })}>
        <span style={{ display: 'flex', gap: '1px', background: 'rgba(255,255,255,0.08)', padding: '0 0 1px' }}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ flex: 1, height: '13px', background: i === 0 ? `${tone}3A` : 'rgba(255,255,255,0.05)' }} />
          ))}
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'rgba(255,255,255,0.06)', flex: 1 }}>
          {[0, 1, 2, 3].map((r) => (
            <span key={r} style={{ display: 'flex', gap: '1px', flex: 1 }}>
              {[0, 1, 2, 3].map((c) => (
                <span key={c} style={{ flex: 1, background: '#0F131C', display: 'flex', alignItems: 'center', padding: '0 3px' }}>
                  <span
                    style={{
                      display: 'block',
                      height: '3px',
                      width: c === 3 ? '60%' : '75%',
                      borderRadius: '99px',
                      background: c === 3 && r === 3 ? tone : '#FFFFFF',
                      opacity: c === 3 && r === 3 ? 0.9 : 0.16,
                    }}
                  />
                </span>
              ))}
            </span>
          ))}
        </span>
      </span>
    );
  }

  return stage(
    <>
      <span style={sheet(72, 80, { marginRight: '-42px', opacity: 0.45, transform: 'translateZ(-28px)' })} />
      <span style={sheet(80, 92, { padding: '9px 10px', gap: '5px' })}>
        <span style={{ display: 'block', height: '7px', width: '54%', borderRadius: '2px', background: tone, opacity: 0.9, marginBottom: '3px' }} />
        {line('92%', 0.22)}
        {line('84%', 0.18)}
        {line('88%', 0.18)}
        {line('62%', 0.14)}
        <span style={{ height: '4px' }} />
        {line('90%', 0.16)}
        {line('70%', 0.12)}
        <span style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {line('30%', 0.3)}
          <span style={{ width: '22px', height: '6px', borderRadius: '2px', background: tone, opacity: 0.8 }} />
        </span>
      </span>
    </>
  );
}

// 4-source -> hub data-flow animation ("Sumber data yang dibaca AI") -- port 1:1 dari
// ExecutiveAIAssistantView.tsx (DATA_FLOW_PATHS, baris 628-633). Section ini UNIVERSAL
// (bukan role-gated) di mockup, jadi paths-nya sama persis.
const MKT_DATA_FLOW_PATHS = [
  'M0 15 C 25 15, 27 75, 52 75',
  'M0 55 C 25 55, 27 75, 52 75',
  'M0 95 C 25 95, 27 75, 52 75',
  'M0 135 C 25 135, 27 75, 52 75',
];

// Mini sparkline kartu stat -- port 1:1 dari ExecutiveAIAssistantView.tsx (baris 636-652).
function StatSparkline({ series, tone }: { series: number[]; tone: string }) {
  const W = 128;
  const H = 32;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * W, H - ((v - min) / span) * (H - 7) - 3.5]);
  const line = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: `${H}px` }} aria-hidden="true">
      <polygon points={`${line} ${W},${H} 0,${H}`} style={{ fill: tone, opacity: 0.12, stroke: 'none' }} />
      <polyline points={line} style={{ fill: 'none', stroke: tone, strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', vectorEffect: 'non-scaling-stroke' }} />
      <circle cx={last[0]} cy={last[1]} r={2.4} style={{ fill: tone, animation: 'klirGlow 2.8s ease-in-out infinite' }} />
    </svg>
  );
}

// Chip delta segitiga + persen -- port 1:1 dari ExecutiveAIAssistantView.tsx (baris 657-679).
function StatDeltaChip({ series, invert }: { series: number[]; invert?: boolean }) {
  const prev = series[series.length - 2];
  const lastV = series[series.length - 1];
  const pct = prev ? Math.round(((lastV - prev) / prev) * 100) : 0;
  const up = pct >= 0;
  const good = invert ? !up : up;
  const tone = pct === 0 ? '#8A93A3' : good ? '#3FBF8F' : '#C9A66B';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: tone }}>
      <span
        style={{
          width: 0,
          height: 0,
          borderLeft: '3.5px solid transparent',
          borderRight: '3.5px solid transparent',
          borderBottom: up ? `5px solid ${tone}` : 'none',
          borderTop: up ? 'none' : `5px solid ${tone}`,
        }}
      />
      <span>{up ? '+' : ''}{pct}%</span>
    </span>
  );
}

function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Baru saja';
  if (mins < 60) return `${mins} mnt lalu`;
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return 'Kemarin';
  if (days < 7) return `${days} hari lalu`;
  return new Date(ts).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// Katalog produk baca-saja (10 Sep 2026, Fable, kontrak marketing-build item g, audit
// temuan A2/L3) -- Marketing sebelumnya tidak punya cara melihat produk yang sudah
// tercatat di Inventory (GET /api/v1/inventory/products) dari dalam AI Assistant, jadi
// productName di form Copywriting selalu diketik ulang manual walau datanya sudah ada di
// workspace yang sama. Select ini OPSIONAL -- ditaruh DI ATAS field manual, tidak
// menggantikannya, supaya UMKM yang belum pernah pakai modul Inventory tidak terhambat.
export interface ProductCatalogItem {
  id: string;
  name: string;
  sellPrice: number;
  unit?: string;
}

// Label tampilan 1 baris untuk opsi <select> -- "Nama (Rp 15.000/pcs)".
export function formatProductCatalogLabel(product: ProductCatalogItem): string {
  const price = `Rp ${Math.round(product.sellPrice || 0).toLocaleString('id-ID')}`;
  return product.unit ? `${product.name} (${price}/${product.unit})` : `${product.name} (${price})`;
}

// Terapkan produk terpilih ke form Copywriting: isi productName, dan tambahkan baris
// harga jual ke productDesc TANPA menghapus teks manual yang sudah diketik user (kalau
// productDesc sudah ada isinya, harga ditambahkan sebagai baris baru, bukan menimpa).
export function applyProductCatalogToCopyForm<T extends { productName: string; productDesc: string }>(
  form: T,
  product: ProductCatalogItem | null
): T {
  if (!product) return form;
  const priceLine = `Harga jual Rp ${Math.round(product.sellPrice || 0).toLocaleString('id-ID')}`;
  const existingDesc = form.productDesc?.trim() || '';
  const productDesc = existingDesc && !existingDesc.includes(priceLine) ? `${existingDesc}\n${priceLine}` : existingDesc || priceLine;
  return { ...form, productName: product.name, productDesc };
}

// Terapkan produk terpilih ke form Kalender Konten: isi tema kampanye utama (mainCampaign)
// dengan nama produk + harga, field lain (title/industry) TIDAK disentuh -- tetap manual.
export function applyProductCatalogToCalendarForm<T extends { mainCampaign: string }>(
  form: T,
  product: ProductCatalogItem | null
): T {
  if (!product) return form;
  const price = `Rp ${Math.round(product.sellPrice || 0).toLocaleString('id-ID')}`;
  return { ...form, mainCampaign: `Promo ${product.name} (${price})` };
}

// FIX (relokasi kemampuan AI, 7 Sep -- keputusan Mecca): pill Studio Media DULU tampil
// terpisah di baris chip atas kotak chat (composer) DAN di baris pill bawah kotak chat --
// dua lokasi visual berbeda dari sidebar "Kemampuan & tools AI". Mecca eksplisit minta
// SATU zona konsisten dipakai di ketiga AI Assistant (CEO/Finance/Marketing); zona yang
// dipilih = sidebar kiri (satu-satunya yang sudah ada strukturnya di ketiga file). Semua
// tombol Studio Media + pills composer dipindah ke situ (lihat render tools.map di bawah,
// sekitar baris 2030), pakai gaya tombol sidebar yang SUDAH ADA (bukan pill bulat lagi).
// pillButtonStyle (gaya pill bulat lama) jadi tidak terpakai sama sekali setelah
// pemindahan ini -- dihapus di sini supaya tidak jadi dead code (sudah diverifikasi
// grep: nol pemakaian lain di file).

export default function MarketingAIAssistantView({
  workspaceId,
  workspaceName = 'Perusahaan Anda',
  userName = 'Marketing Lead',
  onDeployCampaign,
  onRoleChange,
}: MarketingAIAssistantViewProps) {
  const userTitle = (!userName || userName.toLowerCase().includes('ceo') || userName.toLowerCase().includes('owner'))
    ? 'Marketing Lead'
    : userName;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 767px)');
    const adaptSidebar = () => { if (narrow.matches) setSidebarOpen(false); };
    adaptSidebar();
    narrow.addEventListener('change', adaptSidebar);
    return () => narrow.removeEventListener('change', adaptSidebar);
  }, []);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    const initialPrompt = consumeInitialPrompt('MARKETING');
    if (initialPrompt) setInputMessage(initialPrompt);
  }, []);

  const [typingChatId, setTypingChatId] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // MERGE 8ce46d6->1224990 (dicatat utk Fatur): kerangka per-chat "attachedFiles"
  // (kami, cegah race lampiran chat A tertimpa chat B) DISATUKAN dengan field
  // imageBase64/mimeType (Fatur, dipakai handleFileSelect utk vision Gemini) --
  // dua fitur beda tujuan digabung, bukan pilih salah satu.
  // T3 (8 Sep 2026): + workspaceFileId?: string; workspaceFileIds?: string[] -- diisi setelah lampiran ini
  // berhasil dipersist ke Pusat Data di handleFileSelect; ikut terkirim ke
  // brain/chat karena `attachment: currentAttachment` men-spread object ini.
  const [attachedFiles, setAttachedFiles] = useState<Record<string, { name: string; size: string; content?: string; imageBase64?: string; mimeType?: string; documentCheck?: DocumentCheckReport | TabularCheckReport; workspaceFileId?: string; workspaceFileIds?: string[] } | null>>({});
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [pluginOpen, setPluginOpen] = useState(false);
  const [dataHubOpen, setDataHubOpen] = useState(false);
  const [storagePickerOpen, setStoragePickerOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  // Item sidebar "File hasil AI" -- dulu placeholder toast ("segera hadir"), Executive
  // dan Finance sudah punya versi nyata. Bendera panel di sini; daftar isinya sendiri
  // (generatedFiles) dihitung di bawah dari `chats`, bukan array seed statis.
  const [filesOpen, setFilesOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState('chat-mkt-current');
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Tab awal modal Pengaturan Marketing -- 'channels' kalau dibuka dari tombol
  // "Integrasi Meta Ads & TikTok Pixel", 'metrics' dari tombol Pengaturan biasa.
  const [settingsTab, setSettingsTab] = useState<MarketingSettingsTab>('metrics');
  // Gap kemampuan-001 (audit 7 Sep): id actionCard yang sedang dieksekusi ke backend
  // nyata (POST /api/v1/brain/execute) -- disable tombol supaya tidak double-submit.
  const [executingCardTitle, setExecutingCardTitle] = useState<string | null>(null);
  const attachedFile = attachedFiles[activeChatId] || null;
  const setAttachedFile = (file: { name: string; size: string; content?: string; imageBase64?: string; mimeType?: string; documentCheck?: DocumentCheckReport | TabularCheckReport; workspaceFileId?: string; workspaceFileIds?: string[] } | null, chatId = activeChatId) => setAttachedFiles(previous => ({ ...previous, [chatId]: file }));
  const attachmentReads = useRef(new Map<string, string>());
  const isTyping = typingChatId === activeChatId;
  // FIX (temuan gap-fix 7 Sep): field `mode` opsional ditambah -- default 'media' (perilaku
  // lama persis). Dipakai tombol baru "Template Dokumen" di "Studio media Marketing" di bawah
  // supaya bisa membuka MediaStudio LANGSUNG di tab Template Dokumen, bukan lewat tab media dulu.
  const [mediaPanel, setMediaPanel] = useState<{ id: string; kind: StudioKind; chatId: string; text: string; source: string; mode?: 'media' | 'template' } | null>(null);
  const requestsInFlight = useRef(new Set<string>());
  // Messages typed while a chat is busy wait here instead of being dropped (P6).
  // Drained one item per finished request; the sender ref always points at the
  // latest handleSendMessage so a queued send reads current chat history.
  const pendingSends = useRef(createSendQueue());
  const latestSend = useRef<(text: string, chatId: string) => Promise<void>>(async () => {});
  const flushPendingSend = (chatId: string) => {
    const next = pendingSends.current.takeNext(chatId);
    if (next === undefined) return;
    // Defer one tick so the queued send runs after React commits the state of the request that just settled.
    setTimeout(() => { void latestSend.current(next, chatId); }, 0);
  };
  const [brandKitOpen, setBrandKitOpen] = useState(false);
  const [brandKit, setBrandKit] = useState<{ logo: boolean; palette: string | null; refs: number[] }>({
    logo: false,
    palette: null,
    refs: [],
  });
  const [brandKitTipShown, setBrandKitTipShown] = useState(false);
  const [showBrandKitTip, setShowBrandKitTip] = useState(false);

  // WIRE (8 Sep 2026, MKT-05/06/07): 3 endpoint deterministik sudah lengkap di backend
  // (promo/calendar, promo/copywriting, promo/biolink) tapi NOL pintu masuk UI -- semua
  // tombol "copywriting"/"jadwal konten" yang ada cuma mengirim ke /api/v1/brain/chat
  // generik (jawaban teks bebas LLM, kehilangan struktur JSON terstruktur yang sudah
  // dibangun endpoint khusus ini). Modal ini adalah pintu masuk barunya. CATATAN: 2 dari
  // 3 endpoint (calendar & copywriting) memanggil executeAIRequest sungguhan dan memotong
  // kredit -- tidak dites klik-generate beneran di sesi ini (HARAM panggil AI sungguhan
  // saat dev/build), hanya diverifikasi baca kode kontrak req/res. biolink gratis & tanpa
  // AI, ini AMAN dites langsung.
  const [growthToolsOpen, setGrowthToolsOpen] = useState(false);
  const [growthTab, setGrowthTab] = useState<'calendar' | 'copywriting' | 'biolink'>('calendar');
  const [growthLoading, setGrowthLoading] = useState(false);
  const [growthError, setGrowthError] = useState<string | null>(null);
  const [calendarForm, setCalendarForm] = useState({ title: '', industry: 'F&B & Retail', mainCampaign: 'Brand Awareness & Promo Mingguan' });
  const [calendarResult, setCalendarResult] = useState<any>(null);
  const [copyForm, setCopyForm] = useState({ productName: '', productDesc: '', targetAudience: '', promoTone: 'SKENA_JAKSEL', promoAngle: 'DISKON_GAJIAN' });
  const [copywritingResult, setCopywritingResult] = useState<any>(null);
  const [biolinkForm, setBiolinkForm] = useState({ businessName: '', tagline: '', whatsappPhone: '', locationAddress: '' });
  const [biolinkResult, setBiolinkResult] = useState<any>(null);

  // Katalog produk baca-saja (kontrak marketing-build item g) -- dimuat SEKALI saat modal
  // Alat Pertumbuhan pertama kali dibuka (bukan saat mount view, supaya tidak menambah
  // fetch yang tidak perlu untuk user yang tidak pernah membuka modal ini). GET saja,
  // TIDAK PERNAH menulis ke Product manapun.
  const [productCatalog, setProductCatalog] = useState<ProductCatalogItem[]>([]);
  const [productCatalogLoaded, setProductCatalogLoaded] = useState(false);
  const loadProductCatalog = async () => {
    if (productCatalogLoaded) return;
    try {
      const res = await fetch('/api/v1/inventory/products?limit=50', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const rows = Array.isArray(data?.products) ? data.products : [];
        setProductCatalog(
          rows.map((p: any) => ({ id: p.id, name: p.name, sellPrice: p.sellPrice ?? 0, unit: p.unit }))
        );
      }
    } catch (err) {
      console.warn('Marketing load product catalog failed:', err);
    } finally {
      setProductCatalogLoaded(true);
    }
  };

  const runGrowthTool = async (path: string, body: Record<string, unknown>, onSuccess: (data: any) => void) => {
    setGrowthLoading(true);
    setGrowthError(null);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Permintaan gagal, coba lagi.');
      onSuccess(data);
    } catch (err) {
      setGrowthError(err instanceof Error ? err.message : 'Permintaan gagal, coba lagi.');
    } finally {
      setGrowthLoading(false);
    }
  };

  // 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8 + DEVIASI #3 pack): panel "Ringkasan
  // perusahaan Anda" DEFAULT TERSEMBUNYI sekarang (dulu useState(true), TANPA localStorage sama
  // sekali -- beda dari Executive/Finance yang sudah localStorage-backed sejak awal). Ditambah
  // localStorage 'klir_marketing_ai_show_data' pola IDENTIK persis Exec ('klir_ai_show_data')
  // / Finance ('klir_finance_ai_show_data'): key '1' berarti "tampilkan" (eksplisit menampilkan
  // dari default sembunyi).
  const [dataExpanded, setDataExpanded] = useState(false);
  // capsExpanded (grid "Semua kemampuan AI") DIHAPUS -- grid itu sendiri dihapus dari area
  // utama (11 Sep 2026, kontrak B4), isinya dipindah ke sidebar "Kemampuan & Tools AI
  // Marketing" (lihat capSidebarGroups di render sidebar). State toggle jadi yatim tanpa
  // grid untuk ditoggle -- dihapus bersih.
  useEffect(() => {
    try {
      if (localStorage.getItem('klir_marketing_ai_show_data') === '1') setDataExpanded(true);
    } catch (e) {
      /* storage blocked */
    }
  }, []);
  const [liveCompanyState, setLiveCompanyState] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Baca state perusahaan yang sama dipakai applyDirectiveToDashboard/handleSendMessage --
  // BUKAN sumber data baru, cuma bikin panel "Ringkasan performa" di bawah ikut ter-update
  // live tiap kali ada directive baru dieksekusi (event yang sudah di-dispatch di file ini).
  //
  // FIX (8 Sep malam, audit integrasi 3-portal) -- panel ini harus memakai sumber live
  // yang sama untuk kampanye, kas, dan skor kesehatan. Sebelumnya Marketing hanya
  // refresh kampanye; healthScore lama dari localStorage bisa tertinggal dari CEO/Finance
  // dan menampilkan angka historis yang sudah tidak sesuai. Formula blended ROAS tetap
  // spend-weighted dari kampanye ACTIVE, sama dengan portal lain.
  const loadRealCompanyStats = async () => {
    try {
      const [campRes, txRes, healthRes, ctxRes] = await Promise.all([
        fetch('/api/v1/marketing/campaigns', { credentials: 'include' }),
        fetch('/api/v1/kas/transactions', { credentials: 'include' }),
        fetch('/api/v1/kas/financial-health', { credentials: 'include' }),
        fetch('/api/v1/brain/context', { credentials: 'include' }),
      ]);
      const marketingPatch: any = {};
      const financialsPatch: any = {};
      let healthPatch: any = null;
      if (campRes.ok) {
        const data = await campRes.json();
        const rows: any[] = Array.isArray(data.campaigns) ? data.campaigns : [];
        const active = rows.filter((c) => c.status === 'ACTIVE');
        const totalBudget = active.reduce((a, c) => a + (Number(c.dailyBudget) || 0), 0);
        const blendedRoas = totalBudget > 0
          ? active.reduce((a, c) => a + (parseFloat(c.roas) || 0) * (Number(c.dailyBudget) || 0), 0) / totalBudget
          : 0;
        Object.assign(marketingPatch, {
          blendedRoas: Math.round(blendedRoas * 100) / 100,
          adSpendBudget: totalBudget,
          activeCampaignsCount: active.length,
        });
      }
      if (txRes.ok) {
        const data = await txRes.json();
        financialsPatch.netCashBalance = data.summary?.netCashBalance ?? 0;
        financialsPatch.revenue30d = data.summary?.totalIncome ?? 0;
        financialsPatch.expense30d = data.summary?.totalExpense ?? 0;
      }
      if (healthRes.ok) {
        const data = await healthRes.json();
        if (data.health) {
          healthPatch = {
            totalScore: data.health.totalScore ?? 0,
            grade: data.health.grade ?? 'WAITING',
            breakdown: { finance: data.health.totalScore ?? 0, growth: null, operations: null, strategy: null },
          };
        }
      }
      if (ctxRes.ok) {
        const data = await ctxRes.json();
        const snapshot = data?.data;
        if (snapshot?.financials) {
          financialsPatch.runwayMonths = snapshot.financials.runwayMonths;
        }
        if (snapshot?.healthScore) {
          healthPatch = {
            totalScore: snapshot.healthScore.totalScore ?? 0,
            grade: snapshot.healthScore.grade ?? 'WAITING',
            breakdown: {
              finance: snapshot.healthScore.breakdown?.financeScore ?? 0,
              growth: snapshot.healthScore.breakdown?.growthScore ?? 0,
              operations: snapshot.healthScore.breakdown?.opsScore ?? 0,
              strategy: snapshot.healthScore.breakdown?.strategyScore ?? 0,
            },
          };
        }
      }
      if (Object.keys(marketingPatch).length === 0 && Object.keys(financialsPatch).length === 0 && !healthPatch) return;
      try {
        const saved = localStorage.getItem('klir_live_company_state');
        const current = sanitizeLiveCompanyState(saved ? JSON.parse(saved) : {}) || {};
        const updated = {
          ...current,
          financials: { ...(current.financials || {}), ...financialsPatch },
          marketing: { ...(current.marketing || {}), ...marketingPatch },
          ...(healthPatch ? { healthScore: healthPatch } : {}),
        };
        localStorage.setItem('klir_live_company_state', JSON.stringify(updated));
        setLiveCompanyState(updated);
      } catch (e) {
        setLiveCompanyState((prev: any) => {
          const cleanPrev = sanitizeLiveCompanyState(prev) || {};
          return {
            ...cleanPrev,
            financials: { ...(cleanPrev.financials || {}), ...financialsPatch },
            marketing: { ...(cleanPrev.marketing || {}), ...marketingPatch },
            ...(healthPatch ? { healthScore: healthPatch } : {}),
          };
        });
      }
    } catch (e) {
      console.warn('Marketing AI panel: gagal fetch data perusahaan live', e);
    }
  };
  useEffect(() => {
    const readLiveState = () => {
      try {
        const saved = localStorage.getItem('klir_live_company_state');
        setLiveCompanyState(saved ? sanitizeLiveCompanyState(JSON.parse(saved)) : null);
      } catch (e) {
        setLiveCompanyState(null);
      }
    };
    const refresh = () => { readLiveState(); loadRealCompanyStats(); };
    readLiveState();
    loadRealCompanyStats();
    window.addEventListener('klir-ai-state-updated', refresh);
    window.addEventListener('klir-mkt-updated', refresh);
    window.addEventListener('klir-marketing-updated', refresh);
    return () => {
      window.removeEventListener('klir-ai-state-updated', refresh);
      window.removeEventListener('klir-mkt-updated', refresh);
      window.removeEventListener('klir-marketing-updated', refresh);
    };
  }, []);

  const storageKey = `klir_ai_chats_mkt_${workspaceId || 'default'}`;

  const [chats, setChats] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`klir_ai_chats_mkt_${workspaceId || 'default'}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      } catch (e) {}
    }
    return [
      {
        id: 'chat-mkt-current',
        updatedAt: Date.now(),
        messages: [
          {
            id: 'msg-mkt-welcome',
            sender: 'ai',
            text: `Halo **${userTitle}**! Saya adalah **KLIR Marketing & Growth AI Assistant**.\n\nSaya terhubung dengan **kampanye Meta Ads, TikTok Ads, tracking blended ROAS, perolehan prospek baru, dan analitik konversi** ${workspaceName}.\n\nAnda dapat meminta pembuatan skrip video reels/TikTok, desain copy iklan dengan angle baru, optimasi budget kampanye berkinerja tinggi, atau meluncurkan promo instan. Apa fokus pertumbuhan pemasaran hari ini?`,
            timestamp: 'Hari ini 10:20',
          },
        ],
      },
    ];
  });

  // Sinkronisasi otomatis ke localStorage setiap kali chats berubah
  useEffect(() => {
    if (typeof window !== 'undefined' && chats && chats.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(chats));
      } catch (e) {
        console.warn('Gagal menyimpan riwayat chat marketing:', e);
      }
    }
  }, [chats, storageKey]);

  // Muat ulang riwayat jika workspaceId berganti
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChats(parsed);
            setActiveChatId(parsed[0].id);
          }
        }
      } catch (e) {}
    }
  }, [storageKey]);

  const currentChat = chats.find((c) => c.id === activeChatId) || chats[0];
  const messages = currentChat.messages;
  const hasUserMessage = messages.some((m) => m.sender === 'user');

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const showToast = (msg: string, ms = 4000) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), ms);
  };

  // ===== SETELAN JAWABAN + COMPOSER TOOLBAR (8 Sep 2026, B5-wiring-3-view) =====
  // ComposerPrefs per-workspace, dibaca/ditulis lewat chat-composer-prefs.ts (B1).
  // ComposerToolbar (B2) adalah adapter murni -- TIDAK menulis localStorage sendiri,
  // controlled prop, jadi persist terjadi DI SINI di titik onPrefsChange. Pola
  // identik Finance/Executive (lihat git diff Finance sebagai cetakan).
  // FIX (audit malam 8 Sep -- bug composer-prefs bocor lintas-portal, dikonfirmasi 2x
  // independen): chat-composer-prefs.ts storageKey() cuma pakai workspaceId, TANPA
  // pembeda portal -- CEO/Finance/Marketing yang dibuka dengan workspaceId sama akan
  // BERBAGI satu kunci localStorage 'klir_composer_prefs_<workspaceId>', jadi setelan
  // Composer (mode Tanya/Gambar/Video dkk) nyasar antar portal. Fix di sini TIDAK
  // mengubah chat-composer-prefs.ts (berkas bersama dipakai 3 portal, berisiko
  // tabrakan kalau Finance/Executive menyentuhnya juga) -- cukup tambah suffix '_mkt'
  // ke workspaceId yang dioper, pola sama dengan storageKey riwayat chat baris di atas
  // (klir_ai_chats_mkt_<workspaceId>) yang memang sudah portal-scoped.
  const composerPrefsWorkspaceId = `${workspaceId || 'default'}_mkt`;
  const [composerPrefs, setComposerPrefs] = useState<ComposerPrefs>(DEFAULT_COMPOSER_PREFS);
  useEffect(() => {
    setComposerPrefs(readComposerPrefs(composerPrefsWorkspaceId));
  }, [workspaceId]);
  // Ref ke toolbar untuk navigasi keyboard menu slash (panah/Enter/Esc) dari input composer.
  const composerToolbarRef = useRef<ComposerToolbarHandle>(null);
  // 8 Sep malam (feedback Mecca: composer kayak AI umum) -- textarea auto-tinggi,
  // Enter kirim / Shift+Enter baris baru (lihat komentar di use-autogrow-textarea.ts).
  const composerTextareaRef = useAutoGrowTextarea(inputMessage);
  const handleComposerPrefsChange = (next: ComposerPrefs) => {
    setComposerPrefs(next);
    writeComposerPrefs(composerPrefsWorkspaceId, next);
  };

  // Preferensi cara AI menjawab (feedback Mecca poin 6 -- belajar dari histori chat +
  // feedback eksplisit AnswerFeedbackBar). reader-preferences.ts (B4) MURNI logic,
  // sengaja TIDAK menyediakan baca/tulis localStorage sendiri -- 2 helper kecil di
  // bawah ini bagian dari tugas wiring (B5), kunci 'klir_reader_prefs_<workspaceId>'
  // persis sesuai keputusan D-6 spesifikasi.
  const readReaderPrefs = (): ReaderPreferences => {
    try {
      if (typeof window === 'undefined') return DEFAULT_READER_PREFERENCES;
      // FIX (audit 8 Sep, temuan sekelas composer-prefs -- lihat komentar di atas):
      // suffix '_mkt' supaya klir_reader_prefs_<workspaceId> tidak dibagi rata 3 portal.
      const raw = localStorage.getItem(`klir_reader_prefs_${workspaceId || 'default'}_mkt`);
      if (!raw) return DEFAULT_READER_PREFERENCES;
      const parsed = JSON.parse(raw);
      const simplicity = parsed?.simplicity === 'lebih_sederhana' || parsed?.simplicity === 'lebih_detail' ? parsed.simplicity : 'normal';
      const visual = parsed?.visual === 'tabel' || parsed?.visual === 'prosa' ? parsed.visual : 'auto';
      const signals = Array.isArray(parsed?.signals) ? parsed.signals.filter((s: unknown) => typeof s === 'string').slice(-5) : [];
      return { simplicity, visual, signals };
    } catch {
      return DEFAULT_READER_PREFERENCES;
    }
  };
  const writeReaderPrefs = (prefs: ReaderPreferences) => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(`klir_reader_prefs_${workspaceId || 'default'}_mkt`, JSON.stringify(prefs));
    } catch {
      /* localStorage penuh/nonaktif -- feedback tidak persist, bukan error fatal */
    }
  };
  const handleAnswerFeedback = (signal: string) => {
    const merged = mergeExplicitFeedback(readReaderPrefs(), signal);
    writeReaderPrefs(merged);
    showToast('Terima kasih, catatan ini dipakai untuk menyesuaikan jawaban berikutnya.', 2200);
  };

  const handleComposerSlashSelect = (command: SlashCommand) => {
    // 8 Sep 2026 sore: buang teks perintah "/ppt ..." dari input setelah dipilih (pola Executive/Finance).
    const slashBrief = inputMessage.replace(/^\/\S*\s*/, '').trim();
    setInputMessage(slashBrief);
    if (command.kind === 'mode') {
      const mode = command.payload.mode as ComposerMode;
      handleComposerPrefsChange({ ...composerPrefs, mode });
      return;
    }
    if (command.kind === 'setting') {
      // 11 Sep 2026 (kontrak modul 7, B6 slash '/template') -- lihat komentar identik di
      // ExecutiveAIAssistantView.tsx untuk alasan lengkap: payload.templatePicker
      // membedakan command '/template' dari setting umum (mic/model) di bawah.
      if (command.payload.templatePicker) {
        void handleSendMessage('template apa saja yang tersedia');
        return;
      }
      if (command.payload.disabled) {
        showToast(String(command.payload.reason || 'Fitur ini belum tersedia.'), 2500);
        return;
      }
      // ComposerToolbar (B2) memegang sendiri state buka/tutup panel Setelan/mic --
      // tidak ada method yang diekspos lewat ref/props untuk membukanya dari luar.
      // Degradasi jujur: arahkan user klik tombolnya manual.
      showToast('Klik tombol "Setelan jawaban" atau ikon mic di composer untuk mengaturnya.', 2500);
      return;
    }
    // command.kind === 'nextAction'
    const templateId = typeof command.payload.templateId === 'string' ? command.payload.templateId : undefined;
    if (templateId) {
      // '/deck' -- 2 arsitektur pitch deck belum disatukan (keputusan D-13), dibuka
      // lewat tab "Template Dokumen" Studio existing yang sama dipakai /ppt /word /excel.
      openStudio('image', slashBrief || command.desc, currentChat.id, 'template');
      return;
    }
    const kind = command.payload.nextActionKind as NextAction['kind'] | undefined;
    if (kind) {
      handleNextAction({ id: command.id, label: command.label, kind, brief: slashBrief || command.desc });
    }
  };

  const handleComposerSend = (mode: ComposerMode) => {
    const text = inputMessage.trim();
    if (!text) return;
    if (mode === 'video') {
      setInputMessage('');
      const submission: StudioSubmission = {
        type: 'media',
        request: {
          kind: 'video',
          prompt: text,
          model: composerPrefs.video.model === 'auto' ? undefined : composerPrefs.video.model,
          aspectRatio: composerPrefs.video.aspectRatio,
          resolution: composerPrefs.video.resolution,
          durationSeconds: composerPrefs.video.durationSeconds,
          role: 'marketing',
        },
      };
      void submitStudio(submission, activeChatId).catch((err) => showToast(err instanceof Error ? err.message : 'Permintaan video gagal.'));
      return;
    }
    // mode === 'image': jalur chat biasa -- backend (route.ts, sudah di-extend B3)
    // otomatis mendeteksi niat gambar dari teks (detectMediaIntent) dan memakai
    // body.media (dikirim di handleSendMessage di bawah) untuk model/rasio/kualitas.
    void handleSendMessage(text);
  };

  const handleComposerMicTranscript = (text: string) => {
    setInputMessage((current) => (current ? `${current} ${text}` : text));
  };

  const handleCopyText = (text: string, id: string) => {
    const cleanText = String(text)
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/^>\s*/gm, '');
    if (navigator.clipboard) navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // T1 (8 Sep 2026): cap wajar per pesan chat -- sama alasan dengan Executive/
  // Finance view.
  const MAX_ATTACH_FILES = 6;
  const MAX_ATTACH_CHARS = 32000;

  // T1+T3 (8 Sep 2026): dirombak dari 1-file jadi multi-file. Kerangka
  // staleness-guard per-chat (chatId/requestId, dari merge Fatur) DIPERTAHANKAN
  // sebagai kerangka UTAMA -- sekarang SATU requestId dipakai utk SELURUH batch
  // (bukan per file) supaya kalau user pindah chat di tengah batch, SEMUA
  // update batch ini dibuang bersamaan, bukan sebagian nyasar sebagian tidak.
  const processFileList = async (filesToProcess: File[]) => {
    if (!filesToProcess || filesToProcess.length === 0) return;
    const allFiles = Array.from(filesToProcess);
    const files = allFiles.slice(0, MAX_ATTACH_FILES);
    if (allFiles.length > files.length) {
      showToast(`Hanya ${MAX_ATTACH_FILES} file pertama yang dipakai (dari ${allFiles.length} dipilih).`, 4000);
    }

    const chatId = activeChatId;
    const requestId = crypto.randomUUID();
    attachmentReads.current.set(chatId, requestId);
    setIsReadingFile(true);

    type Piece = { file: File; text: string; rawText: string; ok: boolean; isImage: boolean };
    const pieces: Piece[] = [];
    let firstImageBase64: string | undefined;
    let firstImageMimeType: string | undefined;

    try {
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) {
          pieces.push({ file, text: '', rawText: '', ok: false, isImage: false });
          continue;
        }
        const isImage = file.type.startsWith('image/');
        const isTextLike = file.type.includes('text') || /\.(txt|csv|json|md|log|tsv)$/i.test(file.name);

        // Baca gambar jadi base64 (vision Gemini di brain/chat) -- HANYA
        // gambar PERTAMA dalam batch (backend cuma terima 1 field vision,
        // lihat kontrak T1). Gambar berikutnya tetap coba OCR di bawah.
        if (isImage && !firstImageBase64) {
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result as string);
              r.onerror = () => reject(new Error('gagal baca gambar'));
              r.readAsDataURL(file);
            });
            const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (match) { firstImageMimeType = match[1]; firstImageBase64 = match[2]; }
          } catch { /* non-fatal */ }
        }

        if (isTextLike) {
          try {
            const text = (await file.text()).slice(0, 16000);
            pieces.push({ file, text, rawText: text, ok: true, isImage: false });
          } catch {
            pieces.push({ file, text: '', rawText: '', ok: false, isImage: false });
          }
          continue;
        }

        // T1-3 (8 Sep 2026, temuan SCAN A): regex ini dulu HANYA pdf/docx/xlsx
        // -- pptx/doc/xls/zip yang SUDAH ADA di accept attribute input (lihat
        // <input> di bawah) diam-diam TIDAK PERNAH terekstrak (attachedFile
        // terpasang tapi content selalu undefined). DIPERLUAS supaya sejalan
        // dengan Executive/Finance dan tidak membuat T3 mempersist file dengan
        // isi kosong seolah berhasil (lihat risiko_regresi #3 kritik 8 Sep).
        if (/\.(pdf|docx|doc|xlsx|xls|pptx|zip)$/i.test(file.name) || isImage) {
          // Gambar juga dikirim ke extract-text (OCR/Vision di backend, jalur
          // milik Fatur) supaya isi teks-nya (kalau ada) tetap terbaca AI
          // selain lewat imageBase64 mentah.
          try {
            const form = new FormData(); form.set('file', file);
            const result = await apiRequest<{ success: true; content: string; rawContent?: string }>('/api/v1/documents/extract-text', { method: 'POST', body: form });
            const rawText = typeof result.rawContent === 'string' && result.rawContent ? result.rawContent : result.content;
            pieces.push({ file, text: result.content, rawText, ok: true, isImage });
          } catch {
            pieces.push({ file, text: '', rawText: '', ok: false, isImage });
          }
        } else {
          // Ekstensi tidak dikenali sama sekali -- tetap dilampirkan sbg
          // metadata (perilaku lama), tanpa konten yang dikirim ke AI.
          pieces.push({ file, text: '', rawText: '', ok: false, isImage: false });
        }
      }

      if (attachmentReads.current.get(chatId) !== requestId) return;

      const anyContent = pieces.some((p) => p.text);
      const combined = pieces
        .map((p, i) => `=== [${i + 1}/${pieces.length}] ${p.file.name} ===\n${p.text || '(tidak ada teks terbaca)'}`)
        .join('\n\n')
        .slice(0, MAX_ATTACH_CHARS);
      const combinedName = files.length === 1 ? files[0].name : `${files.length} file: ${files.map((f) => f.name).join(', ')}`;
      const combinedSize = `${(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1)} KB`;

      setAttachedFile({ name: combinedName, size: combinedSize, content: anyContent ? combined : undefined, imageBase64: firstImageBase64, mimeType: firstImageMimeType }, chatId);
      showToast(
        anyContent
          ? `Isi ${files.length > 1 ? `${files.length} file` : `"${files[0].name}"`} telah dibaca untuk chat asal.${firstImageBase64 ? ' Gambar siap dianalisis AI.' : ''}`
          : `${files.length > 1 ? 'File dipilih' : `"${files[0].name}" dipilih`} sebagai metadata. Referensi visual belum dikirim ke generator.`,
        3500
      );

      // T3 poin 1 -- persist SETIAP file yang berhasil diekstrak ke Pusat Data
      // (endpoint sama, preExtractedContent = teks mentah). Dijaga staleness-
      // guard chatId/requestId yang SAMA -- kalau user sudah pindah chat,
      // hentikan (jangan lanjut network call sia-sia / salah taruh fileId).
      let persistedFileId: string | undefined;
      const persistedFileIds: string[] = []; // 8 Sep: SEMUA id (temuan verifikator: hapus cuma file pertama)
      const targetWorkspaceId = workspaceId || getActiveClientWorkspaceId() || undefined;
      for (const p of pieces) {
        if (!p.ok || !p.rawText) continue;
        if (attachmentReads.current.get(chatId) !== requestId) break;
        try {
          const persistForm = new FormData();
          persistForm.append('file', p.file);
          persistForm.append('preExtractedContent', p.rawText);
          if (targetWorkspaceId) {
            persistForm.append('workspaceId', targetWorkspaceId);
          }
          const uploadUrl = targetWorkspaceId
            ? `/api/v1/workspace-files?workspaceId=${encodeURIComponent(targetWorkspaceId)}`
            : '/api/v1/workspace-files';
          const wfRes = await fetch(uploadUrl, {
            method: 'POST',
            credentials: 'include',
            headers: getClientAuthHeaders({}, targetWorkspaceId),
            body: persistForm,
          });
          const wfJson = await wfRes.json().catch(() => ({}));
          if (wfJson?.success && wfJson?.file?.id) {
            if (!persistedFileId) persistedFileId = wfJson.file.id;
            persistedFileIds.push(wfJson.file.id);
            window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
          }
        } catch (persistErr) {
          console.warn('[workspace-files] gagal menyimpan lampiran chat ke Pusat Data (non-fatal):', persistErr);
        }
      }
      if (persistedFileId && attachmentReads.current.get(chatId) === requestId) {
        const fid = persistedFileId;
        setAttachedFiles((previous) => {
          const current = previous[chatId];
          if (!current) return previous;
          return { ...previous, [chatId]: { ...current, workspaceFileId: fid, workspaceFileIds: persistedFileIds } };
        });
      }

      // Item 4.5 roadmap 7 Sep -- fire-and-forget, dijaga staleness-guard yang
      // sama, DIPERTAHANKAN PERSIS seperti perilaku lama: hanya utk 1 file
      // non-gambar dgn ekstensi yang didukung /documents/analyze. Batch >1
      // file SENGAJA di-skip demi kecepatan wave ini (lihat catatan_jujur).
      if (files.length === 1 && !pieces[0]?.isImage && pieces[0]?.ok && /\.(pdf|docx|xlsx|txt|csv|json|md|log|tsv)$/i.test(files[0].name)) {
        const file = files[0];
        const form = new FormData(); form.set('file', file);
        fetch('/api/v1/documents/analyze', { method: 'POST', body: form })
          .then((r) => r.json())
          .then((analyzeJson) => {
            if (analyzeJson?.documentCheck && attachmentReads.current.get(chatId) === requestId) {
              setAttachedFiles((previous) => {
                const current = previous[chatId];
                if (!current || current.name !== file.name) return previous;
                return { ...previous, [chatId]: { ...current, documentCheck: analyzeJson.documentCheck } };
              });
            }
          })
          .catch((err) => console.warn('[document-checker] analisis tambahan gagal (non-fatal):', err));
      }
    } catch (err) {
      if (attachmentReads.current.get(chatId) === requestId) {
        showToast(err instanceof Error ? err.message : 'Dokumen gagal dibaca.');
      }
    } finally {
      if (attachmentReads.current.get(chatId) === requestId) setIsReadingFile(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    e.target.value = '';
    if (list && list.length > 0) {
      void processFileList(Array.from(list));
    }
  };

  const handleSelectStorageFile = (sf: StorageFileItem) => {
    setAttachedFile({
      name: sf.name,
      size: sf.size,
      content: sf.content,
      workspaceFileId: sf.id,
      workspaceFileIds: [sf.id],
    }, activeChatId);
    showToast(`Dokumen "${sf.name}" dipilih dari Pusat Data dan siap dianalisis.`, 3500);
  };

  const applyDirectiveToDashboard = (directive: {
    type: string;
    title: string;
    impact: string;
    statePatch: any;
  }) => {
    try {
      const saved = localStorage.getItem('klir_live_company_state');
      const currentState = sanitizeLiveCompanyState(saved ? JSON.parse(saved) : {}) || {};
      const existingDirectives = currentState.directives || [];
      const newDirective = {
        id: `dir-mkt-${Date.now()}`,
        no: existingDirectives.length + 1,
        type: directive.type,
        title: directive.title,
        impact: directive.impact,
        timestamp: 'Baru saja diinstruksikan via Marketing AI Assistant',
        status: 'EXECUTED',
      };
      const updatedState = {
        ...currentState,
        ...directive.statePatch,
        directives: [newDirective, ...existingDirectives],
      };
      localStorage.setItem('klir_live_company_state', JSON.stringify(updatedState));
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      // FIX gap kemampuan-001: toast sekarang menampilkan pesan ASLI dari
      // ExecutionEngine (directive.impact, lihat handleCardExecution), bukan klaim
      // generik "berhasil dieksekusi" -- statePatch kini kosong, tidak ada lagi angka
      // ROAS/leads simulasi yang ditimpakan ke Dashboard dari tombol ini.
      showToast(directive.impact, 7000);
    } catch (e) {
      console.warn('Failed to dispatch state:', e);
    }
  };

  // FIX gap kemampuan-001 (audit 7 Sep 2026): handleCardExecution dulu TIDAK PERNAH
  // memanggil backend -- cuma menulis angka simulasi hardcode ke localStorage, dan
  // untuk LAUNCH_ADS memanggil onDeployCampaign() SEBELUM ada eksekusi nyata apapun
  // (kesan "kampanye sudah jalan" padahal cuma pindah tab -- lihat page.tsx). Sekarang
  // memanggil backend NYATA (POST /api/v1/brain/execute -> ExecutionEngine, lihat
  // src/lib/ai-brain/action-card-execution.ts untuk pemetaan actionCard.type), dan
  // onDeployCampaign() hanya dipanggil SETELAH eksekusi backend sukses -- bukan lagi
  // dipanggil optimistically. CATATAN JUJUR: onDeployCampaign itu sendiri (didefinisikan
  // di src/app/page.tsx, di luar kepemilikan file agent ini) saat ini cuma
  // setMarketingActiveNav('dashboard') -- pindah tab, tidak membuat campaign apapun.
  // Menyambungkan itu ke ExecutionEngine perlu edit page.tsx, di luar cakupan fix ini.
  const handleCardExecution = async (card: ActionCard) => {
    if (card.type === 'CONFIRM_DATA_ACTION') {
      const confirmationMessage = card.actionPayload?.confirmationMessage;
      if (typeof confirmationMessage !== 'string' || !confirmationMessage.trim()) {
        showToast('Pratinjau aksi sudah kedaluwarsa. Kirim ulang permintaannya dari awal.', 6000);
        return;
      }
      void handleSendMessage(confirmationMessage);
      return;
    }

    const confirmed = window.confirm(
      `Setujui dan eksekusi rekomendasi "${card.title}"? Tindakan ini memanggil sistem eksekusi ` +
      'nyata (menulis data ke database sesuai cakupan yang didukung saat ini) dan tercatat di log audit.'
    );
    if (!confirmed) {
      return;
    }

    if (executingCardTitle) return;
    setExecutingCardTitle(card.title);
    try {
      const result = await executeActionCardOnServer({
        cardType: card.type,
        cardTitle: card.title,
        recommendationId: card.recommendationId || '',
        workspaceId,
      });

      if (!result.ok) {
        showToast(`Gagal mengeksekusi "${card.title}": ${result.message}`, 6000);
        return;
      }

      applyDirectiveToDashboard({
        type: card.type,
        title: card.title,
        impact: result.message,
        statePatch: {},
      });

      if (card.type === 'LAUNCH_ADS' && onDeployCampaign) {
        onDeployCampaign({ name: card.title });
      }
    } finally {
      setExecutingCardTitle(null);
    }
  };


  // Decode file base64 ASLI dari server jadi Blob biner sungguhan -- BUKAN
  // membungkus teks polos dengan ekstensi .docx/.xlsx palsu.
  const downloadRealFile = (f: { fileName: string; mimeType: string; fileBase64: string }) => {
    try {
      const byteChars = atob(f.fileBase64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: f.mimeType || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) {
      showToast('Gagal mengunduh file. Coba lagi.', 3000);
    }
  };

  const openStudio = (kind: StudioKind, text = '', chatId = activeChatId, mode: 'media' | 'template' = 'media') => {
    const sourceChat = chats.find(chat => chat.id === chatId);
    const sourceAttachment = attachedFiles[chatId];
    const attachmentText = sourceAttachment?.content || '';
    const historyText = sourceChat?.messages.filter(message => message.text.trim() && !message.failed && !message.id.startsWith('msg-mkt-welcome') && !['m1-u', 'm1-a'].includes(message.id)).slice(-8).map(message => message.text).join('\n\n') || '';
    // Quiz/flashcard: what the user just typed is the material and must beat old history (P7).
    const source = resolveStudioSource({ kind, composerText: text, attachmentText, historyText });
    setPluginOpen(false);
    setMediaPanel({ id: crypto.randomUUID(), kind, chatId, text, source, mode });
  };

  const submitStudio = async (submission: StudioSubmission, chatId: string) => {
    if (requestsInFlight.current.has(chatId)) throw new Error('Masih ada permintaan di chat ini. Tunggu hasilnya sebelum mencoba kembali.');
    requestsInFlight.current.add(chatId);
    const id = crypto.randomUUID();
    const summary = submission.type === 'notebook' ? `Buat ${submission.request.kind === 'quiz' ? 'kuis' : 'flashcard'} dari materi:\n${submission.request.sourceText}`
      : submission.type === 'storyboard' ? `Buat storyboard DOCX: ${submission.request.brief}`
      : `${submission.request.kind === 'image' ? 'Generate gambar' : submission.request.kind === 'audio' ? 'Generate voiceover' : 'Cek status video'}: ${submission.request.script || submission.request.prompt || ''}`;
    const update = (patch: Partial<ChatMessage>) => setChats(previous => previous.map(chat => chat.id === chatId ? {
      ...chat, updatedAt: Date.now(), messages: chat.messages.map(message => message.id === id ? { ...message, ...patch } : message),
    } : chat));
    setChats(previous => previous.map(chat => chat.id === chatId ? { ...chat, updatedAt: Date.now(), messages: [...chat.messages,
      { id: `user-${id}`, sender: 'user', text: summary, timestamp: 'Baru saja' },
      { id, sender: 'ai', text: '', timestamp: 'Baru saja', pending: true, submission },
    ] } : chat));
    try {
      if (submission.type === 'media') {
        const result = await apiRequest<{ success: true; data: MediaResult }>('/api/v1/media/generate', { method: 'POST', body: JSON.stringify(submission.request) });
        if (!result.data || result.data.kind !== submission.request.kind || !validMediaResult(result.data)) throw new Error('Server tidak mengembalikan media valid. Tidak ada hasil yang ditandai berhasil.');
        // B1 VIDEO ASYNC (7 Sep 2026): video submit balas cepat {status:'pending', jobId}
        // (server sudah tidak lagi menahan HTTP request sampai render selesai -- akar bug
        // "berhasil di provider tapi enggak muncul", context pack [POSISI] item 1). Selama
        // poll berjalan, JANGAN set pending:false dulu -- StudioResult.tsx (PendingStatus)
        // otomatis terus tampil karena message.pending masih true, tanpa perubahan render
        // apapun. requestsInFlight tetap dipegang selama poll (kode di try block yang sama),
        // jadi semantik lock per-chat (baris atas) tidak berubah.
        if (result.data.kind === 'video' && result.data.status === 'pending' && result.data.jobId) {
          const final = await pollVideoJob(result.data.jobId, { intervalMs: 4000, maxMs: 360_000 });
          const merged: MediaResult = { ...result.data, ...final };
          update({ pending: false, media: merged, text: merged.status === 'planned' ? 'Render video masih berstatus Segera.' : 'Video telah diterima dari server.' });
        } else {
          update({ pending: false, media: result.data, text: result.data.status === 'planned' ? 'Render video masih berstatus Segera.' : submission.request.kind === 'image' ? 'Gambar telah diterima dari server.' : 'Voiceover telah diterima dari server.' });
        }
      } else if (submission.type === 'notebook') {
        const result = await apiRequest<{ success: true; data: NotebookResult }>('/api/v1/brain/notebook', { method: 'POST', body: JSON.stringify(submission.request) });
        if (!result.data?.payload || result.data.kind !== submission.request.kind) throw new Error('Payload notebook tidak valid. Coba kembali.');
        update({ pending: false, notebook: result.data, text: result.data.title });
      } else {
        const result = await apiRequest<{ success: true; data: { fileName: string; mimeType: string; fileBase64: string | null; summary: string; provider: string; modelUsed: string; note?: string } }>('/api/v1/brain/generate', { method: 'POST', body: JSON.stringify(submission.request) });
        if (!result.data?.fileBase64 || !result.data.fileName) throw new Error('Server belum mengembalikan file storyboard. Coba kembali.');
        update({ pending: false, text: `Storyboard DOCX — bukan render video.\n${result.data.summary}\n${result.data.provider} · ${result.data.modelUsed}${result.data.note ? `\n${result.data.note}` : ''}`, realFile: { ...result.data, fileBase64: result.data.fileBase64, type: 'video-plan' } });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Permintaan gagal. Coba kembali.';
      const scriptReady = err instanceof ApiRequestError && err.data && typeof err.data === 'object'
        && (err.data as { kind?: string; status?: string; script?: unknown }).kind === 'audio'
        && (err.data as { status?: string }).status === 'script-ready'
        && typeof (err.data as { script?: unknown }).script === 'string'
        ? (err.data as { script: string }).script.trim() : undefined;
      update({ pending: false, failed: true, text: `${message}${scriptReady ? '\n\nDraft script berhasil dibuat dan disimpan. Retry akan memakai script ini.' : ''}`, draftScript: scriptReady });
      throw err instanceof Error ? err : new Error(message);
    } finally { requestsInFlight.current.delete(chatId); flushPendingSend(chatId); }
  };

  // V3 TOMBOL LANJUTAN (8 Sep 2026) -- adaptor kecil dari klik chip NextActionsBar ke
  // fungsi Studio/generate yang SUDAH ADA. ppt/word/excel lewat mode 'template' (kind
  // 'image' dipakai murni sebagai placeholder StudioKind valid -- DIABAIKAN sistem saat
  // mode='template', lihat MediaStudio.tsx; user tetap klik tab format manual di Studio,
  // batasan teknis nyata, bukan bug -- lihat "ditunda" di laporan sintesis wave ini).
  const handleNextAction = (action: NextAction) => {
    if (action.kind === 'ppt' || action.kind === 'word' || action.kind === 'excel') {
      openStudio('image', action.brief, currentChat.id, 'template');
    } else if (action.kind === 'image' || action.kind === 'video' || action.kind === 'flashcard' || action.kind === 'quiz') {
      openStudio(action.kind, action.brief, currentChat.id, 'media');
    } else if (action.kind === 'summary') {
      void handleSendMessage(action.brief);
    } else if (action.kind === 'import-ledger') {
      setDataHubOpen(true);
    } else if (action.kind === 'riset' || action.kind === 'prediksi' || action.kind === 'lokasi') {
      // RISET WEB + PREDIKSI + LOKASI (8 Sep 2026, wave B5) -- lihat komentar identik
      // di ExecutiveAIAssistantView.tsx.
      void handleSendMessage(action.brief);
    } else if (action.kind === 'template') {
      // 11 Sep 2026 (kontrak modul 7, B6 template-picker.ts) -- lihat komentar identik
      // di ExecutiveAIAssistantView.tsx: kirim sebagai pesan chat biasa, balasannya
      // deterministik nol-LLM (buildTemplateListReply), tidak perlu openStudio.
      void handleSendMessage(action.brief);
    }
  };

  // RISET WEB + PREDIKSI + LOKASI (8 Sep 2026, wave B5-chat-wiring-ui) -- lihat
  // komentar panjang identik di ExecutiveAIAssistantView.tsx (satu-satunya sumber
  // acuan) -- 2 handler baru memanggil endpoint B2/B3 langsung, patch pesan di
  // activeChatId (kartu ini hanya dirender untuk pesan di chat yang sedang aktif).
  const handleForecastRefine = async (msgId: string, extraData: ForecastExtraData, horizonMonths: BlendedForecastResult['horizonMonths']) => {
    try {
      const res = await fetch('/api/v1/brain/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizonMonths, extraData }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.data?.forecast) {
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChatId
              ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, prediction: json.data.forecast } : m)) }
              : c
          )
        );
      }
    } catch (err) {
      console.warn('[ForecastCard] Gagal memperbarui prediksi:', err);
    }
  };

  const handleLocationSubmit = async (msgId: string, input: LocationAnalysisInput) => {
    try {
      const res = await fetch('/api/v1/brain/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.success && json?.data) {
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChatId
              ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, locationResult: json.data } : m)) }
              : c
          )
        );
      }
    } catch (err) {
      console.warn('[LocationForm] Analisis lokasi gagal:', err);
    }
  };

  const handleSendMessage = async (customText?: string, targetChatId = activeChatId, options: { queued?: boolean } = {}) => {
    const textToSend = String(customText || inputMessage || '').trim();
    if (!textToSend && !attachedFile) return;
    const mediaIntent = detectStudioIntent(textToSend);
    if (mediaIntent) { openStudio(mediaIntent, textToSend, targetChatId); return; }
    if (requestsInFlight.current.has(targetChatId)) {
      // Keep the text (including an edited transcript) instead of dropping it; sent once the active request settles.
      if (pendingSends.current.enqueue(targetChatId, textToSend)) {
        if (targetChatId === activeChatId && !options.queued) setInputMessage('');
        showToast('Disimpan, akan dikirim setelah permintaan aktif selesai.');
      } else showToast('Tunggu permintaan di chat ini selesai.');
      return;
    }
    requestsInFlight.current.add(targetChatId);
    const requestMessages = chats.find(chat => chat.id === targetChatId)?.messages || [];

    const currentAttachment = attachedFiles[targetChatId] || null;
    const userPrompt = textToSend || (currentAttachment ? `Tolong buatkan strategi pemasaran berdasarkan aset: ${currentAttachment.name}` : '');
    const userMsgId = `user-mkt-${Date.now()}`;
    const aiMsgId = `ai-mkt-${Date.now()}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: userPrompt,
      timestamp: 'Baru saja',
      attachment: currentAttachment ? { name: currentAttachment.name, size: currentAttachment.size } : undefined,
    };

    const aiPlaceholder: ChatMessage = {
      id: aiMsgId,
      sender: 'ai',
      text: '',
      timestamp: 'Baru saja',
    };

    setChats((prev) =>
      prev.map((c) => (c.id === targetChatId ? { ...c, updatedAt: Date.now(), messages: [...c.messages, userMsg, aiPlaceholder] } : c))
    );
    // A queued send must not wipe whatever the user has typed since it was queued.
    if (targetChatId === activeChatId && !options.queued) setInputMessage('');
    setAttachedFile(null, targetChatId);
    setPluginOpen(false);
    setTypingChatId(targetChatId);

    try {
      let liveStateObj = null;
      try {
        const saved = localStorage.getItem('klir_live_company_state');
        if (saved) liveStateObj = sanitizeLiveCompanyState(JSON.parse(saved));
      } catch (e) {}

      const history = requestMessages.filter((m) => m.text.trim()).slice(-8).map((m) => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));

      // 11 Sep 2026 (kontrak modul 3+4) -- lihat komentar identik di
      // ExecutiveAIAssistantView.tsx: assistantMode 'riset' disinkronkan otomatis dari
      // tombol Riset composer, dihitung sesaat sebelum kirim (bukan ditulis balik ke
      // composerPrefs/localStorage).
      const effectiveAssistantMode = composerPrefs.researchMode && composerPrefs.researchMode !== 'off' ? 'riset' : composerPrefs.assistantMode;

      const res = await fetch('/api/v1/brain/chat', {
        method: 'POST',
        credentials: 'include',
        headers: getClientAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          workspaceId,
          message: `[Konteks Marketing & Growth]: ${userPrompt}`,
          userName: userTitle,
          userRole: 'MARKETING',
          workspaceName,
          // 8 Sep 2026: ikut pilihan model/tone dari Pengaturan CEO (dulu hardcode 'fast').
          ...readCeoAiChatParams(workspaceId, 'fast'),
          // SETELAN JAWABAN composer (8 Sep 2026): 'auto' tidak dikirim -> cascade lama tetap
          // jalan; preferensi pembaca = sinyal eksplisit (AnswerFeedbackBar) menang, kalau
          // belum ada baru ditebak dari pola pesan (inferFromHistory). Sama persis dgn Finance/Executive.
          modelId: composerPrefs.textModel === 'auto' ? undefined : composerPrefs.textModel,
          researchMode: composerPrefs.researchMode && composerPrefs.researchMode !== 'off' ? composerPrefs.researchMode : undefined, // tombol Riset (8 Sep malam)
          effort: composerPrefs.effort,
          preferences: (() => { const stored = readReaderPrefs(); return stored.signals.length > 0 ? stored : { ...stored, simplicity: inferFromHistory(history) }; })(),
          media: composerPrefs.mode === 'image' ? composerPrefs.image : undefined,
          // 11 Sep 2026 (kontrak modul 3+4) -- lihat effectiveAssistantMode di atas.
          assistantMode: effectiveAssistantMode,
          liveState: liveStateObj,
          attachment: currentAttachment,
          history,
        }),
      });

      let responseText = '';
      let responseModelUsed: string | undefined;
      // SETELAN JAWABAN OTOMATIS (11 Sep 2026, kontrak modul 1+2) -- lihat komentar
      // identik di ExecutiveAIAssistantView.tsx.
      let responseEffortAuto: boolean | undefined;
      let responseEffortUsed: string | undefined;
      let responseModelTierUsed: string | undefined;
      let responseAssistantModeUsed: string | undefined;
      let responseActionCard: ActionCard | undefined;
      let responseRealImage: { url: string; prompt: string; provider: string } | undefined;
      let responseRealFile: { fileName: string; mimeType: string; fileBase64: string; type: string } | undefined;
      // T3 (8 Sep 2026): field additif dari brain/chat -- absen kalau lampiran
      // tidak dikirim/tidak lolos syarat B3, BUKAN error.
      let responseAttachmentVerdict: AttachmentVerdict | undefined;
      // V3 TOMBOL LANJUTAN (8 Sep 2026): field additif brain/chat -- absen/array kosong
      // = NextActionsBar tidak render sama sekali (lihat gate di render call site).
      let responseNextActions: NextAction[] | undefined;
      // RISET WEB + PREDIKSI + LOKASI (8 Sep 2026, wave B5) -- field additif brain/chat,
      // absen = pesan ini tidak memicu riset/forecast/lokasi sama sekali.
      let responseResearchSources: { sources: ResearchSource[]; fetchedAt: string; note?: string } | undefined;
      let responsePrediction: BlendedForecastResult | undefined;
      let responseLocationPrompt: LocationPromptNeeded | undefined;

      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data?.text) {
          responseText = json.data.text;
          responseActionCard = json.data.actionCard;
          if (typeof json.data.model === 'string') responseModelUsed = json.data.model;
        }
        // SETELAN JAWABAN OTOMATIS (11 Sep 2026) -- semua opsional, absen kalau backend
        // (B2) belum/tidak mengisinya.
        // KOMANDO 11 Sep 2026 (ADENDUM fase 2): jawaban jalur data-cepat (provider 'quick-data',
        // nol LLM) diberi badge "Otomatis: data - nol (tanpa kredit AI)" supaya pengguna tahu
        // pertanyaan ringan seperti "gaji saya bulan ini" tidak memakan kredit AI sama sekali.
        if (json?.success && json?.data?.provider === 'quick-data') {
          responseEffortAuto = true;
          responseEffortUsed = 'data';
          responseModelTierUsed = 'nol (tanpa kredit AI)';
        }
        if (json?.success && typeof json?.data?.effortAuto === 'boolean') {
          responseEffortAuto = json.data.effortAuto;
        }
        if (json?.success && typeof json?.data?.effortUsed === 'string' && json.data.effortUsed) {
          responseEffortUsed = json.data.effortUsed;
        }
        if (json?.success && typeof json?.data?.modelTierUsed === 'string' && json.data.modelTierUsed) {
          responseModelTierUsed = json.data.modelTierUsed;
        }
        if (json?.success && typeof json?.data?.assistantModeUsed === 'string' && json.data.assistantModeUsed) {
          responseAssistantModeUsed = json.data.assistantModeUsed;
        }
        if (json?.success && json?.data?.attachmentVerdict) {
          responseAttachmentVerdict = json.data.attachmentVerdict;
        }
        if (json?.success && json?.data?.nextActions) {
          responseNextActions = json.data.nextActions;
        }
        if (json?.success && ((json?.data?.researchSources && json.data.researchSources.length > 0) || json?.data?.researchNote)) {
          responseResearchSources = {
            sources: json.data.researchSources || [],
            fetchedAt: json.data.researchFetchedAt || new Date().toISOString(),
            note: json.data.researchNote || undefined,
          };
        }
        if (json?.success && json?.data?.forecast) {
          responsePrediction = json.data.forecast;
        }
        if (json?.success && json?.data?.locationPrompt) {
          responseLocationPrompt = json.data.locationPrompt;
        }
        // FIX (8 Sep malam, audit integrasi 3-portal) -- blok ini SUDAH ADA di
        // FinanceAIAssistantView.tsx (baris 1326-1327) dan ExecutiveAIAssistantView.tsx
        // (baris 1707-1708), tapi hilang di sini (kemungkinan gap porting). Server
        // (brain/chat/route.ts) mengklasifikasi intent chat LINTAS PORTAL -- kalau
        // Mecca/user kirim chat dari portal Marketing yang ternyata masuk kategori
        // RECORD_CASH/CREATE_INVOICE/dsb, server sudah balas systemEvent yang tepat
        // (klir-kas-updated / klir-ai-state-updated) tapi tanpa blok ini sinyalnya
        // dibuang diam-diam di sisi client Marketing.
        if (json?.success && json?.data?.systemEvent) {
          window.dispatchEvent(new Event(json.data.systemEvent));
        }
        if (json?.success && json?.data?.generatedImage?.url) {
          responseRealImage = json.data.generatedImage;
        }
        if (json?.success && json?.data?.generated?.fileBase64) {
          responseRealFile = json.data.generated;
        }
      }

      if (!responseText && !responseRealImage && !responseRealFile) throw new Error('Assistant belum mengembalikan jawaban. Periksa koneksi atau sesi login, lalu coba lagi.');
      // BUGFIX live-test 8 Sep 2026 (sama dgn Executive/Finance): msg.attachment cuma
      // pernah diisi di userMsg, tidak pernah di pesan AI -- tanpa `attachment` di sini
      // kartu verdict di sisi AI selalu fallback nama generik "dokumen".
      const aiAttachmentForVerdict = responseAttachmentVerdict && currentAttachment ? { name: currentAttachment.name, size: currentAttachment.size } : undefined;
      setChats(previous => previous.map(chat => chat.id === targetChatId ? { ...chat, messages: chat.messages.map(message => message.id === aiMsgId ? { ...message, text: responseText, modelUsed: responseModelUsed, effortAuto: responseEffortAuto, effortUsed: responseEffortUsed, modelTierUsed: responseModelTierUsed, assistantModeUsed: responseAssistantModeUsed, actionCard: responseActionCard, realImage: responseRealImage, realFile: responseRealFile, attachmentVerdict: responseAttachmentVerdict, attachment: aiAttachmentForVerdict, nextActions: responseNextActions, researchSources: responseResearchSources, prediction: responsePrediction, locationPrompt: responseLocationPrompt } : message) } : chat));
    } catch (e) {
      setChats((prev) =>
        prev.map((c) =>
          c.id === targetChatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === aiMsgId ? { ...m, text: e instanceof Error ? e.message : 'Koneksi assistant gagal. Coba kembali.' } : m
                ),
              }
            : c
        )
      );
    } finally {
      requestsInFlight.current.delete(targetChatId);
      setTypingChatId(previous => previous === targetChatId ? null : previous);
      flushPendingSend(targetChatId);
    }
  };
  // Runs after every commit so a deferred queued send always uses the freshest closure (current chats/history).
  useEffect(() => { latestSend.current = (text, chatId) => handleSendMessage(text, chatId, { queued: true }); });

  const handleNewChat = () => {
    const newId = `chat-mkt-${Date.now()}`;
    const welcomeMsg: ChatMessage = {
      id: `msg-mkt-welcome-${Date.now()}`,
      sender: 'ai',
      text: `Sesi baru Marketing AI Assistant aktif. Siap membantu pembuatan konten video viral, skrip iklan, optimasi ROAS, atau strategi scale up **${workspaceName}**.`,
      timestamp: 'Baru saja',
    };
    const newSession: ChatSession = {
      id: newId,
      updatedAt: Date.now(),
      messages: [welcomeMsg],
    };
    setChats(previous => [newSession, ...previous]);
    setActiveChatId(newId);
    setInputMessage('');
    setAttachedFile(null);
    setPluginOpen(false);
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId);
      if (filtered.length === 0) {
        const freshId = `chat-mkt-${Date.now()}`;
        const freshSession: ChatSession = {
          id: freshId,
          updatedAt: Date.now(),
          messages: [
            {
              id: `msg-mkt-welcome-${Date.now()}`,
              sender: 'ai',
              text: `Sesi baru Marketing AI Assistant aktif. Ada yang ingin Anda optimalkan untuk **${workspaceName}**?`,
              timestamp: 'Baru saja',
            },
          ],
        };
        setActiveChatId(freshId);
        return [freshSession];
      }
      if (activeChatId === chatId) {
        setActiveChatId(filtered[0].id);
      }
      return filtered;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chats]);

  const tools = [
    {
      label: 'Ide Konten & Copywriting Video',
      prompt: 'Berikan 3 ide konsep konten naskah video TikTok viral untuk produk teknologi kami',
      icon: <Lightbulb size={15} color="#4E9BFF" />,
    },
    {
      label: 'Ringkasan & Tanya Jawab Dokumen',
      prompt: 'upload_trigger',
      icon: <BookOpen size={15} color="#4E9BFF" />,
    },
    {
      label: 'Terjemahan Bahasa',
      prompt: 'Terjemahkan dokumen ini ke bahasa Inggris dengan gaya bisnis formal, pertahankan istilah teknis, dan tandai bagian yang ambigu.',
      icon: <Globe size={15} color="#4E9BFF" />,
    },
    {
      // FIX (audit role-fit 7 Sep): item coding sebelumnya tidak muncul di CAP_GROUPS
      // (grid "Semua kemampuan AI" yang sudah dikurasi khusus role marketing) --
      // diganti item yang genuinely marketing, sama seperti CAP_GROUPS 'content_cal'.
      label: 'Jadwal Konten Sosial Sepekan',
      prompt: 'Buatkan rencana konten sosial satu pekan lengkap dengan caption harian dan jadwal tayang.',
      icon: <Calendar size={15} color="#4E9BFF" />,
    },
    {
      label: 'Riset Kompetitor',
      prompt: 'Lakukan riset kompetitor: bandingkan posisi harga, keunggulan, kelemahan, dan tunjukkan celah pasar yang bisa kami ambil.',
      icon: <Target size={15} color="#4E9BFF" />,
    },
    // FIX (konsolidasi zona tombol AI, 7 Sep -- keputusan Mecca): 4 item ini dulu di
    // dropdown "Plugin" composer (array pluginItems, sekarang dihapus). 6 item lain di
    // dropdown lama SENGAJA tidak ikut dipindah ke sini -- itu duplikat fungsional dari
    // tombol Studio Media (Gambar/Voiceover/Video/Kuis/Flashcard/Rekam) yang sudah lebih
    // dulu berdiri sendiri di bawah (lihat wrapper aria-label="Studio media Marketing").
    // 4 item di bawah GENUINELY unik -- tidak ada padanan di manapun lagi di file ini.
    {
      label: 'Generator Naskah Video AI',
      prompt: 'Buatkan naskah video TikTok promosi pendek yang engaging lengkap dengan shot-by-shot visual guide.',
      icon: <Video size={15} color="#4E9BFF" />,
    },
    {
      // Dulu field `upload: true` (mekanisme lain), disamakan ke sentinel 'upload_trigger'
      // yang sudah dipakai tools[] lain supaya onClick handler tools.map di bawah cukup 1
      // pola tanpa perlu cabang baru.
      label: 'Studio Visual Iklan AI',
      prompt: 'upload_trigger',
      icon: <ImageIcon size={15} color="#4E9BFF" />,
    },
    {
      label: 'Kalkulator ROAS & CAC',
      prompt: 'Hitung Customer Acquisition Cost (CAC) dan rasio LTV/CAC dari data pemasaran saat ini.',
      icon: <DollarSign size={15} color="#3FBF8F" />,
    },
    {
      label: 'Generator Kupon & Promo',
      prompt: 'Rancang skema promo diskon dengan perhitungan batas minimum margin laba kotor.',
      icon: <Tag size={15} color="#4E9BFF" />,
    },
  ];

  const actions = [
    {
      label: 'Scale Budget Iklan (+20%)',
      prompt: 'Naikkan budget harian kampanye Meta Ads sebesar +20% untuk memperbesar volume leads',
      icon: <TrendingUp size={15} color="#3FBF8F" />,
    },
    {
      label: 'Luncurkan Kampanye TikTok Baru',
      prompt: 'Rancang dan daftarkan kampanye iklan TikTok Ads baru dengan target ROAS 3,8x',
      icon: <Play size={15} color="#4E9BFF" />,
    },
    {
      label: 'Buat Kode Promo Flash GROWTH30',
      prompt: 'Aktifkan kode voucher diskon 30% GROWTH30 untuk kampanye akhir pekan ini',
      icon: <Tag size={15} color="#4E9BFF" />,
    },
    {
      label: 'Laporan Performa Mingguan',
      prompt: 'Buatkan ringkasan performa marketing mingguan: total belanja iklan, omset, dan perolehan prospek',
      icon: <FileText size={15} color="#8CBEFF" />,
    },
  ];

  // 'Buat video' dan 'Buat gambar' SENGAJA dibuang dari sini (dulu ada, versi
  // prompt-teks). Sekarang duplikat dengan tombol Studio Media (Gambar/Video)
  // yang dipindah ke sidebar "Kemampuan & tools AI" -- itu jalur yang lebih lengkap
  // (bukaan studio asli dengan kontrol brand/rasio), bukan cuma prompt teks.
  // Kemampuannya tidak hilang, cuma label yang tumpang tindih dihapus.
  //
  // FIX (relokasi kemampuan AI, 7 Sep): array ini DULU dirender sebagai pill bulat di
  // composer (2 titik: welcome view + chat aktif) -- sekarang dipindah jadi bagian render
  // sidebar "Kemampuan & tools AI" (lihat tools.map, sekitar baris 2030), MEKANISME SAMA
  // PERSIS (handleSendMessage(pill.prompt)), tidak ada render pill/chip composer lagi.
  // DEDUP: item 'Jadwal konten sepekan' DIHAPUS dari sini -- fungsional identik dengan
  // tools[3] 'Jadwal Konten Sosial Sepekan' yang sudah ada di sidebar (mekanisme sama
  // handleSendMessage, tujuan sama: susun jadwal konten sepekan lengkap caption + jadwal
  // tayang; beda kata tapi hasil yang diminta ke AI pada dasarnya sama). Kemampuan itu
  // tidak hilang -- sudah terwakili tools[3].
  const pills = [
    { label: 'Laporan performa iklan', icon: <TrendingUp size={14} />, prompt: 'Susun laporan performa iklan bulan ini: ROAS dan CAC per kanal, konten dengan hasil terbaik, anggaran terbuang, dan rekomendasi alokasi bulan depan.' },
    { label: 'Presentasi hasil campaign', icon: <Presentation size={14} />, prompt: 'Buatkan presentasi hasil campaign bulan ini: target versus capaian, kanal terbaik, materi yang paling berhasil, dan rencana campaign berikutnya.' },
    { label: 'Naskah copywriting', icon: <Megaphone size={14} />, prompt: 'Tuliskan naskah copywriting iklan produk kami dengan pola masalah, solusi, dan ajakan bertindak dalam tiga variasi panjang.' },
  ];

  // FIX (konsolidasi zona tombol AI, 7 Sep): array `pluginItems` (dulu isi dropdown
  // "Plugin" composer) DIHAPUS -- 6 item kind-based (Gambar/Voiceover/Rekam/Video/Kuis/
  // Flashcard) sudah duplikat tombol Studio Media di sidebar, 4 item unik dipindah ke
  // tools[] di atas, 1 item sisa ("Integrasi Meta Ads & TikTok Pixel") jadi tombol
  // tersendiri di sidebar (lihat sekitar baris 1995). Untuk membatalkan: kembalikan array
  // ini dari git history commit sebelum tanggal ini.

  const kitReady = !!brandKit.palette;
  const activeBrandPalette = BRAND_PALETTES.find((p) => p.name === brandKit.palette);
  const brandTone = activeBrandPalette ? activeBrandPalette.colors[0] : '#D8A33C';

  // ---------------------------------------------------------------------------
  // Panel "data perusahaan" (Ringkasan / Skor kesehatan / Sumber data / Rekomendasi /
  // Beban per divisi / Hasil kerja AI) -- section ini UNIVERSAL di mockup Claude Design
  // v6 (sama untuk exec/finance/marketing, TIDAK di-gate per role), verified cross-check
  // 1:1 dengan ExecutiveAIAssistantView.tsx (baris 1633-1832, dikonfirmasi benar oleh
  // Mecca). Dulu file ini menimpa panel ini dengan angka khusus marketing (ROAS/CPL/leads)
  // yang menyimpang dari mockup -- sekarang porting literal, baca dari klir_live_company_state
  // yang SAMA persis dipakai Executive/Finance supaya 3 role menampilkan angka konsisten.
  const liveStats = liveCompanyState || {};
  const liveFinancials = liveStats.financials || {};
  const liveMarketing = liveStats.marketing || {};
  const liveTeamOps = liveStats.teamOps || {};
  const juta = (n: number) => 'Rp ' + (n / 1000000).toFixed(1).replace('.', ',') + ' jt';

  // GUARD (sesi ini): "liveLoad = ... || 92" dan "liveRoas = ... || 3.1" lama salah
  // menganggap 0/undefined ASLI (workspace kosong) sebagai "kosong" lalu jatuh ke
  // angka fiktif tetap -- padahal Dashboard Perusahaan (CompanyDataDashboard.tsx)
  // sudah jujur menunjukkan Rp 0 untuk workspace yang sama. Di-porting verbatim dari
  // ExecutiveAIAssistantView.tsx (yang porting dari MarketingModuleView.tsx baris
  // 74-77) supaya 3 role konsisten. Piutang (arOverdue) memang belum ada penulis
  // live manapun di codebase -- tampilkan empty-state jujur, JANGAN karang endpoint
  // baru. CARA MEMBATALKAN: hapus 9 const has*/live*/*Display di bawah, kembalikan
  // "const liveLoad = liveTeamOps.teamUtilizationPercent || 92;" dan
  // "const liveRoas = liveMarketing.blendedRoas || 3.1;".
  const hasCash = typeof liveFinancials.netCashBalance === 'number';
  const cashDisplay = hasCash ? juta(liveFinancials.netCashBalance) : 'Belum ada data kas';
  const hasRoas = typeof liveMarketing.blendedRoas === 'number' && liveMarketing.blendedRoas > 0;
  const liveRoas = hasRoas ? liveMarketing.blendedRoas : null;
  const roasDisplay = hasRoas ? `${liveRoas.toFixed(1).replace('.', ',')}x` : 'Belum ada data ROAS';
  const hasLoad = typeof liveTeamOps.teamUtilizationPercent === 'number';
  const liveLoad = hasLoad ? liveTeamOps.teamUtilizationPercent : null;
  const loadDisplay = hasLoad ? `${liveLoad}%` : 'Belum ada data';
  const hasAr = typeof liveFinancials.arOverdue === 'number' && liveFinancials.arOverdue > 0;
  const arDisplay = hasAr ? juta(liveFinancials.arOverdue) : 'Belum ada data piutang tercatat';

  // Belum ada histori backend untuk membandingkan delapan pekan. Menyembunyikan
  // sparkline/delta placeholder menjaga angka demo tidak terlihat sebagai tren nyata.
  const stats = [
    { label: 'Kas bersih', value: cashDisplay, trendAvailable: false, series: [] as number[], tone: '#3FBF8F', invert: false, source: 'Kas & Keuangan', prompt: 'Ringkas arus kas 30 hari terakhir dan jelaskan posisi runway kami saat ini.' },
    { label: 'Blended ROAS', value: roasDisplay, trendAvailable: false, series: [] as number[], tone: '#4E9BFF', invert: false, source: 'Metrik Pemasaran', prompt: 'Evaluasi performa iklan bulan ini berdasarkan ROAS, CAC, dan kontribusi tiap kanal.' },
    { label: 'Beban tim', value: loadDisplay, trendAvailable: false, series: [] as number[], tone: '#8CBEFF', invert: true, source: 'Beban Tim & SDM', prompt: 'Periksa beban tim per divisi, tugas yang tertunda, dan capaian SLA bulan ini.' },
    { label: 'Piutang jatuh tempo', value: arDisplay, trendAvailable: false, series: [] as number[], tone: '#C9A66B', invert: true, source: 'Piutang Klien', prompt: 'Tinjau status piutang jatuh tempo kami saat ini.' },
  ];

  const dataSources = [
    { label: 'Kas & Keuangan', meta: 'saldo, beban, runway', Icon: FileSpreadsheet, tone: '#3FBF8F' },
    { label: 'Metrik Pemasaran', meta: 'ROAS, CAC, lead', Icon: TrendingUp, tone: '#4E9BFF' },
    { label: 'Beban Tim & SDM', meta: 'utilisasi, SLA', Icon: Users, tone: '#8CBEFF' },
    { label: 'Piutang Klien', meta: 'invoice, jatuh tempo', Icon: Receipt, tone: '#C9A66B' },
  ];

  // FIX (sesi ini): fallback lama {85, breakdown 95/100/35/100} TERBUKTI SALAH --
  // default asli CompanyDataDashboard.tsx (baris 523-527, dikonfirmasi langsung baca
  // file itu) adalah {totalScore:0, grade:'WAITING', breakdown semua 0}. Akibatnya utk
  // workspace kosong yang sama, Dashboard Perusahaan bilang Skor 0/WAITING tapi sidebar
  // Marketing ini bilang Skor 85/Sangat baik -- kontradiksi identik kelas bug kas
  // bersih. CARA MEMBATALKAN: kembalikan literal 85/95-100-35-100 di 2 baris di bawah.
  const hsRaw = liveStats.healthScore || { totalScore: 0, grade: 'WAITING', breakdown: { finance: 0, growth: 0, operations: 0, strategy: 0 } };
  const hsScore = typeof hsRaw.totalScore === 'number' ? hsRaw.totalScore : 0;
  const hsBreakdown = hsRaw.breakdown || { finance: 0, growth: 0, operations: 0, strategy: 0 };
  const hasHealthScore = hsRaw.grade !== 'WAITING' && hsScore > 0;
  const hsGradeLabel = !hasHealthScore ? 'Menunggu data' : hsScore >= 85 ? 'Sangat baik' : hsScore >= 70 ? 'Baik' : hsScore >= 50 ? 'Cukup' : 'Perlu perhatian';
  const hsTone = !hasHealthScore ? '#8A93A3' : hsScore >= 85 ? '#3FBF8F' : hsScore >= 70 ? '#4E9BFF' : hsScore >= 50 ? '#C9A66B' : '#D8A33C';
  const hsCirc = 326.73;
  const hsBars = [
    { label: 'Keuangan', value: hsBreakdown.finance ?? 0 },
    { label: 'Pertumbuhan', value: hsBreakdown.growth ?? 0 },
    { label: 'Operasional', value: hsBreakdown.operations ?? 0 },
    { label: 'Strategi', value: hsBreakdown.strategy ?? 0 },
  ];

  // FIX (audit role-fit 7 Sep): divisionSeed dihapus -- fallback org-chart fiktif
  // (5/5/3/2 orang, beban tetap) tampil sebagai data nyata begitu liveTeamOps.divisions
  // kosong (yang selalu terjadi, belum ada backend struktur tim). Sekarang honest-empty.
  const hasDivisions = !!(liveTeamOps.divisions && liveTeamOps.divisions.length > 0);
  const divisionLoad: { name: string; members: number; loadPercent: number }[] =
    hasDivisions ? liveTeamOps.divisions : [];

  // FIX (audit role-fit 7 Sep): fallback 99 bulan dihapus -- satu-satunya metrik di
  // panel ini yang belum ikut pola hasCash/hasRoas/hasLoad/hasAr di atas.
  const hasRunway = typeof liveFinancials.runwayMonths === 'number' && (
    (liveFinancials.netCashBalance ?? 0) !== 0 ||
    (liveFinancials.revenue30d ?? 0) !== 0 ||
    (liveFinancials.expense30d ?? 0) !== 0
  );
  const runwayMonths = hasRunway ? liveFinancials.runwayMonths : 0;
  const runwayCapped = Math.min(Math.max(runwayMonths, 0), 24);
  const runwayPercent = Math.round((runwayCapped / 24) * 100);
  // FIX (audit workflow, sesi ini): tambah tier merah, konsisten dengan fix yang sama
  // di FinanceAIAssistantView.tsx/ExecutiveAIAssistantView.tsx.
  const runwayColor = !hasRunway ? '#8A93A3' : runwayMonths >= 12 ? '#3FBF8F' : runwayMonths >= 6 ? '#C9A66B' : runwayMonths >= 3 ? '#D8A33C' : '#EF4444';

  // "Hasil kerja AI" -- 3 hitungan NYATA dari state lokal file ini (bukan angka karangan):
  // file/gambar yang benar-benar di-generate server, instruksi yang benar-benar dieksekusi
  // ke Dashboard (liveStats.directives, ditulis applyDirectiveToDashboard di atas), dan
  // jumlah percakapan.
  const filesCreatedCount = chats.reduce(
    (n, c) => n + c.messages.filter((m) => m.realFile || m.realImage || m.media?.status === 'ready' || m.notebook).length,
    0
  );

  // Panel sidebar "File hasil AI" -- daftar NYATA, dibangun dari filter yang sama
  // dengan filesCreatedCount di atas (bukan array seed statis 4-file seperti
  // FinanceAIAssistantView.tsx; ExecutiveAIAssistantView.tsx sendiri sedang
  // ditinggalkan dari pola seed itu ke arah yang sama dengan ini). createdAt memakai
  // chat.updatedAt karena ChatMessage cuma menyimpan `timestamp` string tampilan
  // ("Baru saja" dkk), bukan epoch per-pesan -- granularitas per-chat, bukan
  // per-pesan, tapi tetap waktu nyata (bukan karangan).
  type GeneratedFileItem = {
    id: string;
    kind: 'file' | 'image' | 'media' | 'notebook';
    name: string;
    createdAt: number;
    realFile?: ChatMessage['realFile'];
    realImage?: ChatMessage['realImage'];
    media?: MediaResult;
    notebook?: NotebookResult;
  };
  const generatedFiles: GeneratedFileItem[] = chats
    .flatMap((c) =>
      c.messages
        .filter((m) => m.realFile || m.realImage || m.media?.status === 'ready' || m.notebook)
        .map((m): GeneratedFileItem => {
          if (m.realFile) return { id: m.id, kind: 'file', name: m.realFile.fileName, createdAt: c.updatedAt, realFile: m.realFile };
          if (m.realImage) return { id: m.id, kind: 'image', name: `Gambar -- ${m.realImage.prompt.slice(0, 48)}`, createdAt: c.updatedAt, realImage: m.realImage };
          if (m.media?.status === 'ready') return { id: m.id, kind: 'media', name: m.media.fileName || `${m.media.kind === 'audio' ? 'Audio' : m.media.kind === 'video' ? 'Video' : 'Gambar'} Studio Media`, createdAt: c.updatedAt, media: m.media };
          return { id: m.id, kind: 'notebook', name: m.notebook?.title || 'Hasil Notebook', createdAt: c.updatedAt, notebook: m.notebook };
        })
    )
    .sort((a, b) => b.createdAt - a.createdAt);

  const generatedFileKind = (item: GeneratedFileItem) => {
    if (item.kind === 'file') return { label: 'File dokumen', icon: <FileText size={17} color="#4E9BFF" strokeWidth={1.6} />, tone: '#4E9BFF' };
    if (item.kind === 'image') return { label: 'Gambar', icon: <ImageIcon size={17} color="#C9A66B" strokeWidth={1.6} />, tone: '#C9A66B' };
    if (item.kind === 'media') return { label: item.media?.kind === 'audio' ? 'Audio' : item.media?.kind === 'video' ? 'Video' : 'Gambar', icon: item.media?.kind === 'audio' ? <Mic size={17} color="#C9A66B" strokeWidth={1.6} /> : item.media?.kind === 'video' ? <Video size={17} color="#C9A66B" strokeWidth={1.6} /> : <ImageIcon size={17} color="#C9A66B" strokeWidth={1.6} />, tone: '#C9A66B' };
    return { label: 'Hasil Notebook', icon: <FileSpreadsheet size={17} color="#3FBF8F" strokeWidth={1.6} />, tone: '#3FBF8F' };
  };

  // Unduh per item -- REUSE mekanisme yang sudah ada di file ini, bukan logic baru:
  // realFile pakai downloadRealFile() (decode base64) persis seperti dipakai di kartu
  // pesan chat; realImage & media (dataUrl/url) pakai anchor href+download persis pola
  // yang sudah dipakai inline untuk kartu "Gambar asli hasil generate" & StudioResult.
  // Hanya notebook yang genuinely tidak punya file biner -- payload-nya dump JSON apa
  // adanya (data nyata, bukan karangan), bukan meniru salah satu formatter per-kind di
  // StudioResult.tsx (itu 8 komponen terpisah, di luar cakupan perbaikan ini).
  const downloadGeneratedItem = (item: GeneratedFileItem) => {
    if (item.realFile) {
      downloadRealFile(item.realFile);
      return;
    }
    if (item.realImage) {
      window.open(item.realImage.url, '_blank', 'noopener');
      return;
    }
    if (item.media?.status === 'ready') {
      try {
        const a = document.createElement('a');
        a.href = item.media.dataUrl || item.media.url || '';
        a.download = item.media.fileName || `klir-media-${item.id}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) {
        showToast('Gagal mengunduh file. Coba lagi.', 3000);
      }
      return;
    }
    if (item.notebook) {
      try {
        const blob = new Blob([JSON.stringify(item.notebook.payload, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(item.notebook.title || 'notebook').replace(/[^a-z0-9-_]+/gi, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
      } catch (e) {
        showToast('Gagal mengunduh file. Coba lagi.', 3000);
      }
    }
  };

  const aiOutputs = [
    { label: 'File dibuat', value: filesCreatedCount },
    { label: 'Instruksi dieksekusi', value: (liveStats.directives || []).length },
    { label: 'Percakapan', value: chats.length },
  ];
  // Role-gate identik dengan mockup (KLIR AI Assistant v6.dc.html baris 3158-3174):
  // DECISIONS punya array `roles` per-entry lalu di-filter berdasarkan role aktif.
  // Komponen ini SELALU role marketing (file terpisah per-role), jadi filter statis
  // ke 'marketing' -- hanya kartu 'ads' yang lolos (roles: ['exec','marketing']),
  // 'ar' (['exec','finance']) dan 'hire' (['exec']) TIDAK boleh muncul di sini.
  // FIX (sesi ini, hygiene -- kartu 'ar'/'hire' tetap TIDAK PERNAH tampil ke user
  // marketing karena kena filter role di bawah, tapi diperbaiki juga demi konsistensi
  // kalau role-gating berubah suatu saat, SELARAS dengan keputusan yang sama dipakai
  // ExecutiveAIAssistantView.tsx & FinanceAIAssistantView.tsx sesi ini):
  // (1) 'ads' -- done: liveRoas>=3.4 crash-prone kalau liveRoas null, di-guard hasRoas &&.
  // (2) 'ar' -- KELUARKAN kartu ini kalau !hasAr (tidak ada sumber piutang live sama
  //     sekali), teks digenericize (tanpa nama klien/nominal tetap) kalau hasAr true.
  // (3) 'hire' -- `null <= 80` coercion = `0 <= 80` = TRUE, salah menandai "sudah
  //     diterapkan" walau belum ada data beban tim -- di-guard hasLoad &&, dan
  //     KELUARKAN kartu ini juga kalau !hasLoad, teks impact digenericize.
  const decisionsList = [
    ...(hasRoas ? [{
      key: 'ads', roles: ['exec', 'marketing'], Icon: TrendingUp, tone: '#3FBF8F',
      title: 'Scale anggaran iklan video +20%', impact: '+Rp 6,2 jt omset / bulan',
      done: liveRoas >= 3.4, prompt: 'Scale budget iklan video TikTok 20% dan update ke dashboard',
    }] : []),
    ...(hasAr ? [{
      key: 'ar', roles: ['exec', 'finance'], Icon: Receipt, tone: '#C9A66B',
      title: 'Tinjau piutang jatuh tempo', impact: `${arDisplay} berpotensi tertagih`,
      done: false, prompt: 'Tinjau status piutang jatuh tempo kami saat ini.',
    }] : []),
    ...(hasLoad ? [{
      key: 'hire', roles: ['exec'], Icon: Users, tone: '#4E9BFF',
      title: 'Rekrut 1 staf video editor', impact: 'Kurangi beban tim yang tinggi dengan tambahan staf',
      done: hasLoad && liveLoad <= 80, prompt: 'Rekrut 1 staf video editor tambahan untuk kurangi beban tim',
    }] : []),
  ].filter((d) => d.roles.indexOf('marketing') >= 0);
  const pendingDecisions = decisionsList.filter((d) => !d.done).length;

  // "Mulai dari tugas nyata" -- UNIVERSAL juga di mockup (sama untuk semua role), port 1:1
  // dari ExecutiveAIAssistantView.tsx (baris 1666-1694), menggantikan section custom
  // "Inspirasi Kampanye & Pertumbuhan" yang sebelumnya ada di sini tapi tidak ada di mockup.
  const realTasksGallery = [
    {
      title: 'Dokumen & korespondensi',
      dotColor: '#4E9BFF',
      cards: [
        { t: 'Draf proposal kerjasama untuk klien enterprise', n: 'Latar belakang, lingkup kerja, skema harga', p: 'Buatkan draf proposal kerjasama untuk klien enterprise: latar belakang, ruang lingkup pekerjaan, skema harga, dan syarat kerjasama.', kind: 'file-text', kindLabel: 'Template dokumen' },
        { t: 'Surat penagihan invoice yang telat 3 hari', n: 'Sopan, tetap tegas, siap kirim', p: 'Buatkan surat penagihan invoice yang sopan namun tegas untuk klien yang telat bayar 3 hari.', kind: 'file-text', kindLabel: 'Template dokumen' },
        { t: 'Email tindak lanjut setelah rapat klien', n: 'Ringkasan poin dan langkah berikutnya', p: 'Buatkan email tindak lanjut setelah rapat klien berisi ringkasan poin yang disepakati dan langkah berikutnya.', kind: 'mail', kindLabel: 'Template email' },
      ],
    },
    {
      title: 'Analisis data perusahaan',
      dotColor: '#3FBF8F',
      cards: [
        { t: 'Laporan performa marketing bulan ini', n: 'Leads, konversi, dan ROAS per kanal', p: 'Buatkan laporan performa marketing bulan ini: total leads, tingkat konversi, dan ROAS per kanal, sertakan rekomendasi alokasi budget berikutnya.', kind: 'file-spreadsheet', kindLabel: 'Laporan performa' },
        { t: 'Evaluasi performa iklan bulan ini', n: 'ROAS, CAC, kontribusi tiap kanal', p: 'Evaluasi performa iklan bulan ini berdasarkan ROAS, CAC, dan kontribusi tiap kanal.', kind: 'trending-up', kindLabel: 'Tren & metrik' },
        { t: 'Periksa beban tim dan tugas tertunda', n: 'Utilisasi per divisi dan capaian SLA', p: 'Periksa beban tim per divisi, tugas yang tertunda, dan capaian SLA bulan ini.', kind: 'users', kindLabel: 'Beban tim' },
      ],
    },
    {
      title: 'Materi promosi',
      dotColor: '#C9A66B',
      cards: [
        { t: 'Naskah video promosi 30 detik', n: 'Hook, isi, ajakan bertindak', p: 'Buatkan naskah video promosi 30 detik dengan hook kuat di 3 detik pertama.', kind: 'video', kindLabel: 'Storyboard video' },
        { t: 'Konsep banner promo untuk feed dan story', n: 'Headline dan variasi tiap ukuran', p: 'Buatkan konsep banner promo produk untuk feed dan story, sertakan headline dan variasi tiap ukuran.', kind: 'image', kindLabel: 'Materi grafis' },
        { t: 'Rencana konten sosial satu pekan', n: 'Caption harian dan jadwal tayang', p: 'Buatkan rencana konten sosial satu pekan lengkap dengan caption harian dan jadwal tayang.', kind: 'calendar', kindLabel: 'Jadwal konten' },
      ],
    },
  ];

  const capGroups = CAP_GROUPS.map((grp) => ({
    ...grp,
    items: grp.items.map((item) => ({ ...item, Icon: CAP_ICON_MAP[item.icon] })),
  }));
  // 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): `totalCapabilities` (dulu
  // dipakai counter header grid "Semua kemampuan AI") DIHAPUS -- yatim setelah grid-nya
  // sendiri dihapus dari area utama, isinya PINDAH ke sidebar "Kemampuan & Tools AI
  // Marketing" (dikelompokkan per kategori, CAP_GROUPS sudah punya title/tone per
  // kategori). Padanan counter yang baru = capSidebarCount di bawah (dihitung dari
  // capSidebarGroups SETELAH dedup, bukan capGroups mentah). Dedup HANYA exact-label-match
  // (case-insensitive, trim) terhadap tools[]/pills[] yang sudah ada di sidebar --
  // KONSERVATIF, sama alasannya seperti Exec/Fin (label mirip tapi beda tujuan tidak
  // boleh ikut kehapus, lihat komentar dedup 'content_cal'/tools[3] di atas yang SUDAH
  // dilakukan manual di data -- exact-match di sini menangkap sisanya).
  const sidebarExistingLabels = new Set<string>([
    ...tools.map((t) => t.label.trim().toLowerCase()),
    ...pills.map((p) => p.label.trim().toLowerCase()),
  ]);
  const capSidebarGroups = capGroups
    .map((grp) => ({ ...grp, items: grp.items.filter((c) => !sidebarExistingLabels.has(c.label.trim().toLowerCase())) }))
    .filter((grp) => grp.items.length > 0);
  const capSidebarCount = capSidebarGroups.reduce((sum, grp) => sum + grp.items.length, 0);

  return (
    <div style={{ height: '100%', background: '#06080C', padding: '14px', fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", color: '#F5F7FA', WebkitFontSmoothing: 'antialiased', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes klirFade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
        @keyframes klirFloat { 0%, 100% { transform: translateY(-3px) rotateX(13deg) rotateY(-17deg); } 50% { transform: translateY(4px) rotateX(8deg) rotateY(-11deg); } }
        @keyframes klirRise { 0%, 100% { transform: scaleY(0.55); } 50% { transform: scaleY(1); } }
        @keyframes klirGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes klirSweep { 0% { transform: translateX(-140%) skewX(-18deg); } 55%, 100% { transform: translateX(320%) skewX(-18deg); } }
        @keyframes klirRing { 0% { transform: scale(1); opacity: 0.5; } 70%, 100% { transform: scale(1.9); opacity: 0; } }
        @keyframes klirFlow { to { stroke-dashoffset: -88; } }
        @keyframes klirGrowY { from { transform: scaleY(0.04); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; }
        }
      `}</style>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.pptx,.csv,.tsv,.txt,.md,.json,.png,.jpg,.jpeg,.webp,.bmp"
        style={{ display: 'none' }}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer?.types?.includes('Files')) setIsDraggingFile(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDraggingFile(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingFile(false);
          if (e.dataTransfer?.files?.length) {
            void processFileList(Array.from(e.dataTransfer.files));
          }
        }}
        style={{ display: 'flex', height: '100%', background: '#080A0F', border: 0, borderRadius: '20px', boxShadow: '0 4px 24px -2px rgba(0,0,0,0.5)', overflow: 'hidden', position: 'relative' }}
      >
        <DragDropFileOverlay isDragging={isDraggingFile} />
        {/* ========================================================================= */}
        {/* 1. SIDEBAR */}
        {/* ========================================================================= */}
        {sidebarOpen && (
          <aside className={mediaStyles.sidebar} style={{ width: '274px', flexShrink: 0, background: '#06080C', borderRight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '14px 12px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', minHeight: 0, paddingRight: '2px' }}>
              {/* Workspace Badge Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2px 4px 12px', borderBottom: 0 }}>
                <span style={{ display: 'flex', width: '31px', height: '31px', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: '#0058BE', fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>
                  {workspaceName.trim().charAt(0).toUpperCase() || 'K'}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {workspaceName}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userTitle}
                  </span>
                </span>
                <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#C9A66B', border: 0, background: 'rgba(201,166,107,0.15)', borderRadius: '999px', padding: '2.5px 8px' }}>
                  Business
                </span>
              </div>



              {/* Brand Kit -- eksklusif role marketing */}
              <button
                type="button"
                onClick={() => setBrandKitOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 11px', border: 0, borderRadius: '12px', background: kitReady ? 'rgba(216,163,60,0.09)' : 'rgba(255,255,255,0.03)', textAlign: 'left', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', width: '30px', height: '30px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: kitReady ? 'rgba(216,163,60,0.14)' : 'rgba(255,255,255,0.05)' }}>
                  <Palette size={15} color={kitReady ? '#D8A33C' : '#8A93A3'} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>
                    {kitReady ? 'Brand Kit aktif' : 'Brand Kit'}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {kitReady ? `Palet ${brandKit.palette}${brandKit.logo ? ' + logo' : ''}` : 'Atur logo & warna brand sekali, dipakai otomatis'}
                  </span>
                </span>
                {kitReady && activeBrandPalette && (
                  <span style={{ display: 'flex', flexShrink: 0, gap: '3px' }}>
                    {activeBrandPalette.colors.map((c, ci) => (
                      <span key={ci} style={{ width: '10px', height: '10px', borderRadius: '999px', background: c, border: 0 }} />
                    ))}
                  </span>
                )}
              </button>

              {/* WIRE (8 Sep 2026, MKT-05/06/07): pintu masuk baru ke 3 endpoint deterministik
                  (promo/calendar, promo/copywriting, promo/biolink) yang sebelumnya 0 tombol UI
                  di seluruh app -- lihat modal growthToolsOpen di bawah untuk detail kontrak. */}
              <button
                type="button"
                onClick={() => { setGrowthToolsOpen(true); loadProductCatalog(); }}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 11px', border: '1px dashed rgba(78,155,255,0.4)', borderRadius: '12px', background: 'rgba(78,155,255,0.06)', textAlign: 'left', cursor: 'pointer' }}
              >
                <span style={{ display: 'flex', width: '30px', height: '30px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: 'rgba(78,155,255,0.14)' }}>
                  <Zap size={15} color="#4E9BFF" />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, color: '#F5F7FA' }}>
                    Alat Pertumbuhan
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Kalender konten, copywriting multi-platform, bio-link
                  </span>
                </span>
              </button>

              {/* Action Buttons: New Chat + Collapse */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleNewChat}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '9px 11px', border: 0, borderRadius: '12px', background: '#0058BE', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Plus size={14} strokeWidth={2.5} />
                    <span>Obrolan Baru</span>
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: '9px', letterSpacing: '0.04em', background: 'rgba(0,0,0,0.2)', padding: '3px 6px', borderRadius: '6px' }}>
                    Ctrl K
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  title="Sembunyikan Menu Samping"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 9px', border: 0, borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: '#8A93A3', cursor: 'pointer' }}
                >
                  <PanelLeftClose size={14} color="#4E9BFF" />
                </button>
              </div>

              {/* Ruang kerja */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', padding: '0 8px 7px', textAlign: 'left' }}>
                  Ruang kerja
                </span>
                <button
                  type="button"
                  onClick={() => { setSettingsTab('metrics'); setSettingsOpen(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'rgba(242,168,59,0.08)', color: '#F2A83B', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Settings2 size={15} color="#F2A83B" strokeWidth={2} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pengaturan Marketing</span>
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#F2A83B', background: 'rgba(242,168,59,0.18)', padding: '2px 6px', borderRadius: '6px' }}>
                    4 Tab
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilesOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Folder size={15} color="#4E9BFF" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>File hasil AI</span>
                  <span style={{ flexShrink: 0, fontSize: '10.5px', color: '#8A93A3' }}>{generatedFiles.length}</span>
                </button>
                {/* Item 4.1 roadmap 7 Sep -- Pusat Data, terpisah dari "File hasil AI" di
                    atas (yang itu sekarang sudah nyata, bukan placeholder toast lagi). Ini genuinely
                    fungsional: upload/lihat/hapus file tersimpan server-side. */}
                <button
                  type="button"
                  onClick={() => setDataHubOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Database size={15} color="#4E9BFF" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pusat Data</span>
                </button>
                {/* FIX (konsolidasi zona tombol AI, 7 Sep -- keputusan Mecca): dulu tombol
                    "Kelola plugin" (buka dropdown Plugin di composer). Dropdown itu sekarang
                    dihapus (isinya dipindah ke sidebar di bawah), jadi tombol ini direpurpose
                    jadi shortcut langsung ke satu-satunya item non-kemampuan-AI yang dulu
                    nempel di ekor dropdown itu ("Integrasi Meta Ads & TikTok Pixel"). */}
                {/* FIX gap kemampuan-004 (audit 7 Sep 2026): tombol ini dan "Pengaturan
                    Marketing" di atas memanggil handler yang PERSIS SAMA
                    (setSettingsOpen(true), tanpa parameter tab) -- keduanya selalu
                    mendarat di tab pertama modal ("Target Metrik"), BUKAN tab "Kanal
                    Iklan" (activeTab==='channels') tempat toggle Meta Ads/TikTok Ads
                    sungguhan berada (diverifikasi baca src/app/components/settings/
                    MarketingSettingsModal.tsx baris 346-421). MarketingSettingsModal
                    belum punya prop initialTab untuk membuka langsung ke tab tertentu,
                    dan file itu di luar kepemilikan file agent ini (lihat batas file
                    tugas) -- jadi TIDAK diedit di sini. Fix minimal dalam cakupan:
                    toast wayfinding jujur supaya pengguna tahu harus klik tab "Kanal
                    Iklan" setelah panel terbuka, bukan diam-diam berharap dia landing
                    di tempat yang benar. Fix penuh (initialTab prop) perlu sentuh file
                    settings/MarketingSettingsModal.tsx -- direkomendasikan ke agent/
                    sesi yang memegang lane itu. */}
                <button
                  type="button"
                  onClick={() => {
                    // FIX (7 Sep 2026, lanjutan gap kemampuan-004): MarketingSettingsModal
                    // sekarang punya prop initialTab -> langsung mendarat di tab "Kanal Iklan".
                    setSettingsTab('channels');
                    setSettingsOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Settings2 size={15} color="#8A93A3" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Integrasi Meta Ads &amp; TikTok Pixel</span>
                </button>
                {/* Akses dan pengaturan admin hanya milik CEO/Owner. Tidak
                    ditampilkan di portal Marketing agar daftar fitur benar-
                    benar menggambarkan pekerjaan role ini. */}
                {/* FIX (audit role-fit 7 Sep): onRoleChange dulu diterima sebagai prop tapi
                    tidak pernah dipanggil di manapun -- tidak ada cara user Marketing pindah
                    role/divisi dari layar ini. Untuk membatalkan: hapus blok ini. */}
                {onRoleChange && (
                  <button
                    type="button"
                    onClick={onRoleChange}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <LogOut size={15} color="#8A93A3" />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ganti Divisi</span>
                  </button>
                )}
              </div>

              {/* Kemampuan & Tools AI Marketing */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {/* 11 Sep 2026 (kontrak B4, DEVIASI #4 pack): header ini dulu TIDAK PUNYA
                    counter angka sama sekali (beda dari Exec/Finance yang sudah punya) --
                    ditambah dari nol supaya "jumlah kemampuan per role" genuinely
                    ditampilkan di sini juga. */}
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 500, color: '#8A93A3', padding: '0 8px 7px', textAlign: 'left' }}>
                  <span style={{ flex: 1 }}>Kemampuan &amp; tools AI</span>
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#8A93A3' }}>{tools.length + pills.length + capSidebarCount}</span>
                </span>
                {tools.map((tool, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (tool.prompt === 'upload_trigger') {
                        fileInputRef.current?.click();
                      } else {
                        handleSendMessage(tool.prompt);
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                  >
                    {tool.icon}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tool.label}
                    </span>
                  </button>
                ))}
                {/* FIX (relokasi kemampuan AI, 7 Sep -- keputusan Mecca): pindahan array
                    `pills` (dulu pill bulat di composer, 2 titik render, sudah dihapus dari
                    situ). Mekanisme SAMA PERSIS: handleSendMessage(pill.prompt). Gaya tombol
                    disamakan PERSIS dengan tools.map di atas (bukan style pill lama). */}
                {pills.map((pill, idx) => (
                  <button
                    key={`pill-${idx}`}
                    type="button"
                    onClick={() => handleSendMessage(pill.prompt)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', color: '#4E9BFF' }}>{pill.icon}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pill.label}
                    </span>
                  </button>
                ))}
                {/* 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): eks-grid "Semua
                    kemampuan AI" -- dikelompokkan per kategori (judul kecil, dedup exact-label
                    terhadap tools/pills di atas, lihat capSidebarGroups). Klik = perilaku SAMA
                    seperti grid lama (handleSendMessage(cap.prompt), TIDAK ada openStudio di
                    sini -- grid lama Marketing juga tidak pernah pakai openStudio). */}
                {capSidebarGroups.map((grp, gi) => (
                  <div key={`capgrp-${gi}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: gi === 0 ? '6px' : '0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 8px 3px', fontSize: '10px', fontWeight: 600, color: grp.tone, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      <span style={{ display: 'block', width: '5px', height: '5px', borderRadius: '99px', background: grp.tone, flexShrink: 0 }} />
                      {grp.title}
                    </span>
                    {grp.items.map((cap) => (
                      <button
                        key={cap.key}
                        type="button"
                        onClick={() => handleSendMessage(cap.prompt)}
                        title={cap.note}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                      >
                        {cap.Icon ? <cap.Icon size={15} color={grp.tone} /> : null}
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cap.label}</span>
                          <span style={{ fontSize: '10.5px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cap.note}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                {/* FIX (relokasi kemampuan AI, 7 Sep): tombol Studio Media (Gambar/Voiceover/
                    Video/Kuis/Flashcard/Rekam) -- dulu chip di composer (2 titik render: baris
                    chip atas welcome view + baris chip atas form chat aktif). Mekanisme SAMA
                    PERSIS: openStudio(kind, ...). Wrapper aria-label="Studio media Marketing"
                    DIPERTAHANKAN (kini 1 instance, bukan 2) karena tests/marketing-browser.cjs
                    baris 119 mencari elemen ini untuk membuka Studio -- kalau wrapper ini hilang,
                    gerbang penerimaan resmi itu patah walau tombolnya sendiri kelihatan baik-baik
                    saja. data-testid="composer-microphone" + aria-label="Rekam suara" pada tombol
                    Rekam juga DIPERTAHANKAN (dipakai test lain sebagai sinyal "app sudah siap"). */}
                <div aria-label="Studio media Marketing" style={{ display: 'contents' }}>
                  {(['image', 'audio', 'video', 'quiz', 'flashcard'] as const).map(kind => {
                    const meta = {
                      image: { label: 'Gambar', icon: <ImageIcon size={14} /> },
                      audio: { label: 'Voiceover', icon: <Play size={14} /> },
                      video: { label: 'Video', icon: <Video size={14} /> },
                      quiz: { label: 'Kuis', icon: <GraduationCap size={14} /> },
                      flashcard: { label: 'Flashcard', icon: <BookOpen size={14} /> },
                    }[kind];
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => openStudio(kind, inputMessage)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                      >
                        <span style={{ display: 'flex', color: '#4E9BFF' }}>{meta.icon}</span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {meta.label}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    data-testid="composer-microphone"
                    aria-label="Rekam suara"
                    onClick={() => openStudio('transcription')}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', color: '#4E9BFF' }}><Mic size={14} /></span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Rekam
                    </span>
                  </button>
                  {/* FIX (temuan gap-fix 7 Sep, reachability HIGH): 19 template dokumen (laporan
                      keuangan/invoice/deck/video-brief) sebelumnya CUMA bisa dijangkau lewat tab
                      kedua di dalam studio gambar/audio/video/kuis/flashcard -- tidak ada satupun
                      tombol sidebar yang eksplisit mengarah ke situ. Tombol ini buka MediaStudio
                      LANGSUNG di tab "Template Dokumen" (mode 'template' -> openStudio(...)). */}
                  <button
                    type="button"
                    onClick={() => openStudio('image', inputMessage, undefined, 'template')}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <span style={{ display: 'flex', color: '#4E9BFF' }}><FileText size={14} /></span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Template Dokumen
                    </span>
                  </button>
                </div>
              </div>

              {/* Aksi Kampanye Langsung */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', padding: '0 8px 7px', textAlign: 'left' }}>
                  Aksi dashboard perusahaan
                </span>
                {actions.map((act, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(act.prompt)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                  >
                    {act.icon}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {act.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Riwayat Percakapan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', padding: '0 8px 7px', textAlign: 'left' }}>
                  Riwayat
                </span>
                {chats.map((c) => {
                  const isActive = c.id === activeChatId;
                  const firstUserMsg = c.messages.find((m) => m.sender === 'user');
                  const title = firstUserMsg?.text
                    ? firstUserMsg.text.length > 34
                      ? `${firstUserMsg.text.slice(0, 34)}...`
                      : firstUserMsg.text
                    : 'Kampanye baru';

                  return (
                    <div
                      key={c.id}
                      onClick={() => setActiveChatId(c.id)}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                        width: '100%',
                        padding: '8px 9px',
                        borderRadius: '10px',
                        background: isActive ? 'rgba(255,255,255,0.06)' : 'transparent',
                        boxShadow: isActive ? 'inset 2px 0 0 #0058BE' : 'none',
                        cursor: 'pointer',
                        transition: 'background 120ms ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px', minWidth: 0, flex: 1, textAlign: 'left' }}>
                        <span style={{ maxWidth: '100%', fontSize: '12.5px', fontWeight: isActive ? 600 : 500, color: isActive ? '#F5F7FA' : '#C6CEDA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {title}
                        </span>
                        <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>
                          {isActive ? 'Sekarang' : relTime(c.updatedAt)}
                        </span>
                      </div>
                      {chats.length > 1 && (
                        <button
                          type="button"
                          title="Hapus percakapan ini"
                          onClick={(e) => handleDeleteChat(e, c.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '4px',
                            border: 0,
                            borderRadius: '6px',
                            background: 'transparent',
                            color: '#5C6474',
                            cursor: 'pointer',
                            flexShrink: 0,
                            opacity: isActive ? 0.8 : 0.4,
                            transition: 'color 150ms ease, opacity 150ms ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#EF4444';
                            e.currentTarget.style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = '#5C6474';
                            e.currentTarget.style.opacity = isActive ? '0.8' : '0.4';
                          }}
                        >
                          <Trash2 size={12} strokeWidth={1.8} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', marginTop: '12px', borderTop: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#8A93A3' }}>
                <ShieldCheck size={12} color="#3FBF8F" />
                <span>Open Intelligence &amp; OS</span>
              </span>
            </div>
          </aside>
        )}

        {/* ========================================================================= */}
        {/* 2. MAIN CHAT WORKSPACE */}
        {/* ========================================================================= */}
        <main data-testid="marketing-chat-workspace" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#080A0F' }}>
          {/* Sub Header */}
          <div className={mediaStyles.subHeader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 18px', borderBottom: 0, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  title="Tampilkan Menu Samping"
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <PanelLeft size={15} color="#4E9BFF" />
                  <span>Menu Marketing</span>
                </button>
              )}
              <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.01em', color: '#F5F7FA', whiteSpace: 'nowrap' }}>
                KLIR Marketing AI Assistant
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={handleNewChat}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 11px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: '#8A93A3', fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={13} />
                  <span>Obrolan Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* Toast Notification */}
          {toastMsg && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: '12px 18px 0', padding: '10px 12px', border: 0, borderRadius: '12px', background: 'rgba(63,191,143,0.14)', boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)', flexShrink: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12.5px', fontWeight: 500, color: '#BFEFDC' }}>
                <CheckCircle2 size={15} color="#3FBF8F" />
                <span>{toastMsg}</span>
              </span>
              <button
                type="button"
                onClick={() => setToastMsg(null)}
                style={{ border: 0, background: 'transparent', color: '#8A93A3', cursor: 'pointer', display: 'flex', padding: '2px' }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {/* Peringatan proaktif (kontrak marketing-build item f, 10 Sep 2026): wadah
              reusable, sumber 'brain' di registry proactive-alerts.ts (roles-agnostic,
              lihat audit 10 Sep temuan A1). Tidak render apa pun kalau 0 kartu. Cermin
              persis pemasangan di FinanceAIAssistantView.tsx (tanpa onOpenInventory --
              Marketing tidak punya akses modul Inventory). */}
          <div style={{ padding: '12px 18px 0' }}>
            <ProactiveAlertsPanel role="MARKETING" workspaceId={workspaceId || ''} onAskAI={(p) => setInputMessage(p)} />
          </div>

          {/* ======================================================================= */}
          {/* A. EMPTY HERO HOME VIEW */}
          {/* ======================================================================= */}
          {!hasUserMessage ? (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'radial-gradient(115% 62% at 50% -6%, rgba(0,88,190,0.11), rgba(0,88,190,0) 62%)' }}>
              <div className={mediaStyles.heroContent} style={{ maxWidth: '1180px', margin: '0 auto', width: '100%', padding: '0 40px 76px', display: 'flex', flexDirection: 'column', flex: '1 0 auto' }}>
                {/* Hero cluster (logo+sapaan+composer) diposisikan tengah viewport, bukan
                    mepet atas -- referensi Kimi AI, koreksi Mecca 11 Sep: dropdown composer
                    (mis. panel Mode Video) sempat kepotong tepi layar karena hero ketinggian. */}
                <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 'min(58vh, 560px)', padding: '40px 0 16px' }}>
                {/* Logo & Greeting */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', marginBottom: '168px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/Logo-KLIR.png" alt="KLIR" width={40} height={40} style={{ display: 'block' }} />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 2.5vw, 37px)', fontWeight: 700, letterSpacing: '0.045em', lineHeight: 1, color: '#F5F7FA' }}>
                    KLIR
                  </span>
                  <h1 style={{ margin: '16px 0 0', fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(16.5px, 1.3vw, 19px)', fontWeight: 500, letterSpacing: '-0.008em', color: '#8A93A3', textAlign: 'center' }}>
                    Ada yang bisa saya bantu hari ini, {userTitle}?
                  </h1>
                </div>

                {showBrandKitTip && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px', width: '100%', maxWidth: '880px', margin: '0 auto 22px', padding: '13px 15px', borderRadius: '12px', background: 'rgba(216,163,60,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)' }}>
                    <span style={{ display: 'flex', width: '26px', height: '26px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(216,163,60,0.16)' }}>
                      <Palette size={13} color="#D8A33C" />
                    </span>
                    <span style={{ flex: 1, fontSize: '12px', lineHeight: 1.55, color: '#DCE3EC' }}>
                      Brand kit kamu sekarang aktif (palet <strong>{brandKit.palette}</strong>{brandKit.logo ? ' + logo' : ''}). Mulai sekarang, materi promosi yang dibuat di sini — poster, video TikTok, atau naskah copywriting — otomatis mengikuti warna dan gaya brand kit ini, biasanya kelar dalam 10-30 menit.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowBrandKitTip(false)}
                      aria-label="Tutup"
                      style={{ flexShrink: 0, border: 0, background: 'transparent', color: '#8A93A3', cursor: 'pointer', padding: '2px' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* Composer Box */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '880px', margin: '0 auto' }}>
                  {attachedFile && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '9px', padding: '6px 10px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.06)', fontSize: '11.5px', color: '#F5F7FA' }}>
                      <ImageIcon size={14} color="#4E9BFF" />
                      <span>{attachedFile.name}</span>
                      <span style={{ fontSize: '11px', color: '#8A93A3' }}>({attachedFile.size})</span>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        style={{ display: 'flex', border: 0, background: 'transparent', color: '#8A93A3', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                  {/* Item 4.5 roadmap 7 Sep -- kartu pemeriksaan dokumen. */}
                  {attachedFile?.documentCheck && (
                    <div style={{ marginBottom: '9px' }}>
                      <DocumentCheckCard report={attachedFile.documentCheck} fileName={attachedFile.name} />
                    </div>
                  )}

                  {/* Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '11px', padding: '17px 17px 13px', border: 0, borderRadius: '18px', background: '#0B0E14', boxShadow: '0 14px 38px rgba(0,0,0,0.5)' }}
                  >
                    <textarea
                      ref={composerTextareaRef}
                      rows={1}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => { if (composerToolbarRef.current?.handleSlashKeyDown(e)) { e.preventDefault(); return; } if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if ((inputMessage.trim() || attachedFile) && !isTyping) void handleSendMessage(); } }}
                      placeholder="Tanya apa saja (email, ide konten, strategi, coding) atau beri instruksi untuk Dashboard..."
                      style={{ display: 'block', width: '100%', minHeight: '24px', maxHeight: '200px', overflowY: 'auto', resize: 'none', border: 0, outline: 'none', background: 'transparent', padding: '5px 3px', fontFamily: "'Outfit', sans-serif", fontSize: '15.5px', lineHeight: 1.45, color: '#F5F7FA' }}
                    />
                    <ComposerToolbar
                      prefs={composerPrefs}
                      allowVideo={true}
                      onPrefsChange={handleComposerPrefsChange}
                      onSend={handleComposerSend}
                      onMicTranscript={handleComposerMicTranscript}
                      onSlashSelect={handleComposerSlashSelect}
                      inputValue={inputMessage}
                      disabled={isTyping}
                      ref={composerToolbarRef}
                      leading={
                        <AttachmentMenuButton
                          disabled={isTyping}
                          onUploadComputer={() => fileInputRef.current?.click()}
                          onOpenStorage={() => setStoragePickerOpen(true)}
                        />
                      }
                      trailing={
                        <button
                          type="submit"
                          aria-label="Kirim"
                          title="Kirim (Enter)"
                          disabled={!inputMessage.trim() && !attachedFile}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '7px 14px',
                            borderRadius: '999px',
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '12.5px',
                            fontWeight: 700,
                            cursor: inputMessage.trim() || attachedFile ? 'pointer' : 'not-allowed',
                            background: inputMessage.trim() || attachedFile ? '#0058BE' : 'rgba(255,255,255,0.03)',
                            border: 0,
                            color: inputMessage.trim() || attachedFile ? '#FFFFFF' : '#5C6474',
                          }}
                        >
                          <Send size={13} />
                          <span>Kirim</span>
                        </button>
                      }
                    />
                  </form>
                </div>

                {/* Tombol perlihatkan/sembunyikan blok data perusahaan */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                  <button
                    type="button"
                    onClick={() => setDataExpanded((v) => {
                      const next = !v;
                      // 11 Sep 2026: persist ke localStorage -- pola SAMA seperti
                      // toggleBoolPref milik Exec/Finance (key '1' = tampilkan).
                      try { localStorage.setItem('klir_marketing_ai_show_data', next ? '1' : '0'); } catch (e) { /* storage blocked */ }
                      return next;
                    })}
                    aria-expanded={dataExpanded}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.04)', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {dataExpanded ? <ChevronUp size={14} color="#4E9BFF" /> : <BarChart3 size={14} color="#4E9BFF" />}
                    <span>{dataExpanded ? 'Sembunyikan data perusahaan' : 'Tampilkan data perusahaan'}</span>
                  </button>
                </div>

                {dataExpanded && (
                  <div style={{ marginTop: '14px' }}>
                    {/* Ringkasan perusahaan Anda */}
                    <div style={{ border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 17px', borderBottom: 0, background: 'rgba(255,255,255,0.015)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
                          <span>Ringkasan perusahaan Anda</span>
                        </span>
                        <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>Tren tampil setelah histori pembanding tersedia</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '6px', background: 'transparent' }}>
                        {stats.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(s.prompt)}
                            style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '16px 17px 17px', border: 0, background: 'rgba(255,255,255,0.02)', borderRadius: '12px', textAlign: 'left', cursor: 'pointer' }}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', fontSize: '11px', color: '#8A93A3' }}>{s.label}<TermHint label={s.label} /></span>
                            <span style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '23px', fontWeight: 600, letterSpacing: '-0.022em', lineHeight: 1, color: '#F5F7FA' }}>
                                {s.value}
                              </span>
                              {s.trendAvailable && <StatDeltaChip series={s.series} invert={s.invert} />}
                            </span>
                            <span style={{ display: 'block', margin: '2px 0 1px' }}>
                              {s.trendAvailable ? <StatSparkline series={s.series} tone={s.tone} /> : <span style={{ fontSize: '10.5px', color: '#5C6474' }}>Belum ada tren pembanding</span>}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#8A93A3' }}>
                              <Database size={10.5} color="#8A93A3" />
                              <span>{s.source}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginTop: '14px' }}>
                      {/* Skor kesehatan bisnis */}
                      <div style={{ display: 'flex', flexDirection: 'column', border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: 0, background: 'rgba(255,255,255,0.015)' }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Skor kesehatan bisnis</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
                          <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '114px', height: '114px', flexShrink: 0 }}>
                            <svg width={114} height={114} viewBox="0 0 114 114" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
                              <circle cx={57} cy={57} r={52} style={{ fill: 'none', stroke: 'rgba(255,255,255,0.07)', strokeWidth: 9 }} />
                              <circle cx={57} cy={57} r={52} style={{ fill: 'none', stroke: hsTone, strokeWidth: 9, strokeLinecap: 'round', strokeDasharray: hsCirc, strokeDashoffset: (hsCirc * (1 - hsScore / 100)).toFixed(1) }} />
                            </svg>
                            <span style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '29px', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: '#F5F7FA' }}>{hsScore}</span>
                              <span style={{ fontSize: '10px', color: '#8A93A3' }}>dari 100</span>
                            </span>
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0, flex: 1 }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 600, color: hsTone }}>{hsGradeLabel}</span>
                            {hsBars.map((b, i) => (
                              <span key={i} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                  <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>{b.label}</span>
                                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#C6CEDA' }}>{b.value}</span>
                                </span>
                                <span style={{ display: 'block', height: '4px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                  <span style={{ display: 'block', height: '100%', borderRadius: '99px', width: `${b.value}%`, background: b.value >= 70 ? '#3FBF8F' : b.value >= 45 ? '#C9A66B' : '#D8A33C' }} />
                                </span>
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>

                      {/* Sumber data yang dibaca AI */}
                      <div style={{ display: 'flex', flexDirection: 'column', border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 16px', borderBottom: 0, background: 'rgba(255,255,255,0.015)' }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sumber data yang dibaca AI</span>
                          <span style={{ flex: 1, textAlign: 'right', fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>4 sistem divisi &middot; tersambung langsung</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minWidth: 0 }}>
                            {dataSources.map((src, idx) => (
                              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', flexShrink: 0, borderRadius: '9px', background: `${src.tone}1C`, border: 0, color: src.tone }}>
                                  <src.Icon size={14} color={src.tone} />
                                </span>
                                <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
                                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.label}</span>
                                  <span style={{ fontSize: '10.5px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.meta}</span>
                                </span>
                              </span>
                            ))}
                          </div>
                          <div style={{ position: 'relative', width: '52px', height: '150px', flexShrink: 0 }} aria-hidden="true">
                            <svg width={52} height={150} viewBox="0 0 52 150" style={{ display: 'block' }}>
                              {MKT_DATA_FLOW_PATHS.map((d, i) => (
                                <path key={`t${i}`} d={d} style={{ fill: 'none', stroke: 'rgba(255,255,255,0.09)', strokeWidth: 1.4 }} />
                              ))}
                              {MKT_DATA_FLOW_PATHS.map((d, i) => (
                                <path
                                  key={`f${i}`}
                                  d={d}
                                  style={{
                                    fill: 'none',
                                    stroke: dataSources[i]?.tone || '#4E9BFF',
                                    strokeWidth: 1.6,
                                    strokeLinecap: 'round',
                                    strokeDasharray: '5 83',
                                    animation: 'klirFlow 3.4s linear infinite',
                                    animationDelay: `${(i * 0.62).toFixed(2)}s`,
                                  }}
                                />
                              ))}
                            </svg>
                          </div>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', flexShrink: 0 }}>
                            <span style={{ position: 'absolute', width: '52px', height: '52px', borderRadius: '999px', border: '1px solid rgba(0,88,190,0.5)', animation: 'klirRing 3.6s ease-out infinite' }} />
                            <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(150deg,#0F6FE0,#0058BE)', boxShadow: '0 10px 26px rgba(0,88,190,0.34)' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M8.2 6.6v10.8M8.2 12l6.4-5.4M8.2 12l6.9 5.4" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rekomendasi siap dieksekusi */}
                    <div style={{ marginTop: '14px', border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 16px', borderBottom: 0, background: 'rgba(255,255,255,0.015)' }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Rekomendasi siap dieksekusi</span>
                        <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>
                          {pendingDecisions ? `${pendingDecisions} menunggu keputusan Anda` : 'Semua rekomendasi sudah diterapkan'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                        {decisionsList.map((d, idx) => (
                          <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '11px', flex: '1 1 252px', padding: '14px 16px', borderTop: 0, minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flexShrink: 0, borderRadius: '10px', background: d.done ? 'rgba(63,191,143,0.14)' : `${d.tone}1F`, border: 0, color: d.done ? '#3FBF8F' : d.tone }}>
                              {d.done ? <Check size={16} /> : <d.Icon size={16} />}
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, lineHeight: 1.3, color: '#F5F7FA' }}>{d.title}</span>
                              <span style={{ fontSize: '11px', color: d.done ? '#3FBF8F' : '#8A93A3' }}>{d.done ? 'Sudah diterapkan ke dashboard' : d.impact}</span>
                            </span>
                            {!d.done && (
                              <button
                                type="button"
                                onClick={() => handleSendMessage(d.prompt)}
                                style={{ flexShrink: 0, padding: '7px 12px', border: 0, borderRadius: '9px', background: 'rgba(255,255,255,0.05)', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                              >
                                Tinjau
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Beban per divisi + Hasil kerja AI */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginTop: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 16px', borderBottom: 0, background: 'rgba(255,255,255,0.015)' }}>
                          <span style={{ flexShrink: 0, fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Beban per divisi</span>
                          <span style={{ flex: 1, textAlign: 'right', fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ambang aman di bawah 80%</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', padding: '15px 16px' }}>
                          {hasDivisions ? divisionLoad.map((dv, idx) => {
                            const pct = dv.loadPercent || 0;
                            const tone = pct > 88 ? '#D8A33C' : pct > 80 ? '#C9A66B' : '#3FBF8F';
                            return (
                              <span key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                                  <span style={{ display: 'flex', alignItems: 'baseline', gap: '7px', minWidth: 0 }}>
                                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 600, color: '#C6CEDA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dv.name}</span>
                                    <span style={{ flexShrink: 0, fontSize: '10px', color: '#8A93A3' }}>{dv.members || 0} orang</span>
                                  </span>
                                  <span style={{ fontSize: '11px', fontWeight: 600, color: tone }}>{pct}%</span>
                                </span>
                                <span style={{ display: 'block', height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                                  <span style={{ display: 'block', height: '100%', borderRadius: '99px', width: `${pct}%`, background: tone }} />
                                </span>
                              </span>
                            );
                          }) : (
                            <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Belum ada data struktur tim tercatat.</span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 16px', borderBottom: 0, background: 'rgba(255,255,255,0.015)' }}>
                          <span style={{ flexShrink: 0, fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Hasil kerja AI</span>
                          <span style={{ flex: 1, textAlign: 'right', fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Output pekan ini (histori mingguan belum dilacak)</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '15px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '56px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                            <span style={{ fontSize: '11px', color: '#5C6474' }}>Belum ada histori output mingguan</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', background: 'transparent', borderRadius: '11px', overflow: 'hidden' }}>
                            {aiOutputs.map((out, idx) => (
                              <span key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, padding: '10px 11px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', minWidth: 0 }}>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1, color: '#F5F7FA' }}>{out.value}</span>
                                <span style={{ fontSize: '10px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{out.label}</span>
                              </span>
                            ))}
                          </div>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingTop: '2px', borderTop: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', paddingTop: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Runway kas</span>
                              {/* FIX (sesi ini): dulu hardcode hijau selama hasRunway true, ntah
                                  runway-nya 0 atau 24+ -- pakai runwayColor yang sudah dihitung
                                  benar (sama seperti bar di bawahnya), bukan warna lepas sendiri. */}
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, color: hasRunway ? runwayColor : '#8A93A3' }}>{hasRunway ? (runwayMonths >= 24 ? '24 bulan+' : `${runwayMonths} bulan`) : 'Belum ada data'}</span>
                            </span>
                            <span style={{ display: 'block', height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <span style={{ display: 'block', height: '100%', borderRadius: '99px', width: `${hasRunway ? runwayPercent : 0}%`, background: hasRunway ? runwayColor : 'rgba(255,255,255,0.15)' }} />
                            </span>
                            <span style={{ fontSize: '10px', color: '#8A93A3' }}>{hasRunway ? (runwayMonths >= 18 ? 'Kas aman jauh di atas ambang 6 bulan' : 'Pantau laju belanja bulanan') : 'Belum ada data runway tercatat'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                </div>

                {/* 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): grid "Semua
                    kemampuan AI" DIHAPUS dari area utama -- isinya (CAP_GROUPS/capGroups
                    di atas, TIDAK dihapus datanya) dipindah ke sidebar kiri "Kemampuan &
                    Tools AI Marketing" (lihat capSidebarGroups di render sidebar). Preset
                    khusus marketing di bawah TETAP (tidak diminta hapus). */}

                {/* 5 Preset Produksi Eksklusif Marketing */}
                <div style={{ marginTop: '54px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', paddingBottom: '14px', borderBottom: 0 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, letterSpacing: '-0.012em', color: '#F5F7FA' }}>
                        Preset khusus marketing
                      </span>
                      <span style={{ fontSize: '12px', color: '#8A93A3' }}>
                        Lima alur produksi yang hanya tersedia untuk tim marketing. Pilih gaya, sisanya dikerjakan AI.
                      </span>
                    </span>
                    <span style={{ flexShrink: 0, fontSize: '11px', color: '#D8A33C', whiteSpace: 'nowrap' }}>
                      Eksklusif role marketing
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '16px', marginTop: '20px' }}>
                    {MARKETING_PRESETS.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        onClick={() => handleSendMessage(preset.prompt)}
                        style={{ display: 'flex', flexDirection: 'column', padding: 0, border: 0, borderRadius: '14px', background: '#0B0E14', boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)', overflow: 'hidden', textAlign: 'left', cursor: 'pointer' }}
                      >
                        <span style={{ position: 'relative', display: 'block', height: '148px', borderBottom: 0, overflow: 'hidden' }}>
                          <StyleArt style={preset.style} tone={brandTone} />
                          <span style={{ position: 'absolute', top: '10px', left: '11px', zIndex: 2, whiteSpace: 'nowrap', fontSize: '9.5px', fontWeight: 500, color: '#F5F7FA', background: 'rgba(6,8,12,0.74)', border: 0, padding: '3px 9px', borderRadius: '999px' }}>
                            {preset.styleLabel}
                          </span>
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, gap: '13px', padding: '14px 17px 0' }}>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14.5px', fontWeight: 600, lineHeight: 1.35, color: '#F5F7FA' }}>
                              {preset.title}
                            </span>
                            <span style={{ fontSize: '12px', lineHeight: 1.5, color: '#8A93A3' }}>{preset.note}</span>
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 0 12px', borderTop: 0, fontSize: '11.5px', fontWeight: 500, color: '#8A93A3' }}>
                            <span>{preset.cta}</span>
                            <ArrowRight size={14} color="#8A93A3" />
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* "Mulai dari tugas nyata" */}
                <div style={{ marginTop: '64px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', paddingBottom: '14px', borderBottom: 0 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, letterSpacing: '-0.012em', color: '#F5F7FA' }}>
                        Mulai dari tugas nyata
                      </span>
                      <span style={{ fontSize: '12px', color: '#8A93A3' }}>
                        Sembilan pekerjaan yang paling sering dipakai divisi marketing. Satu klik, langsung dikerjakan.
                      </span>
                    </span>
                    <span style={{ flexShrink: 0, fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>Tanpa perlu menulis prompt</span>
                  </div>

                  {realTasksGallery.map((cat, ci) => (
                    <div key={ci} style={{ marginTop: '30px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '99px', background: cat.dotColor, flexShrink: 0 }} />
                        <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#C6CEDA', whiteSpace: 'nowrap' }}>
                          {cat.title}
                        </h4>
                        <span style={{ flex: 1, height: '1px', background: 'transparent' }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
                        {cat.cards.map((card, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(card.p)}
                            style={{ display: 'flex', flexDirection: 'column', padding: 0, border: 0, borderRadius: '14px', background: '#0B0E14', overflow: 'hidden', textAlign: 'left', cursor: 'pointer', boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)' }}
                          >
                            <span style={{ position: 'relative', display: 'block', height: '140px', borderBottom: 0, overflow: 'hidden' }}>
                              {cardArt(card.kind, cat.dotColor, idx)}
                              <span style={{ position: 'absolute', top: '10px', left: '11px', zIndex: 2, whiteSpace: 'nowrap', fontSize: '9.5px', fontWeight: 500, letterSpacing: '0.02em', color: '#8A93A3', background: 'rgba(6,8,12,0.72)', border: 0, padding: '3px 8px', borderRadius: '999px' }}>
                                {card.kindLabel}
                              </span>
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, gap: '13px', padding: '14px 17px 0' }}>
                              <span style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '14.5px', fontWeight: 600, lineHeight: 1.35, color: '#F5F7FA' }}>
                                  {card.t}
                                </span>
                                <span style={{ fontSize: '12px', lineHeight: 1.5, color: '#8A93A3' }}>{card.n}</span>
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 0 12px', borderTop: 0, fontSize: '11.5px', fontWeight: 500, color: '#8A93A3' }}>
                                <span>Jalankan sekarang</span>
                                <ArrowRight size={14} strokeWidth={1.7} />
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================================= */
            /* B. CHAT STREAM VIEW */
            /* ======================================================================= */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '18px 20px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {messages.map((msg) => {
                    const isAI = msg.sender === 'ai';

                    return (
                      <div key={msg.id} className="group" style={{ display: 'flex', flexDirection: 'column' }}>
                        {isAI ? (
                          /* AI Message */
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <span style={{ display: 'flex', width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 0, flexShrink: 0, marginTop: '2px', overflow: 'hidden' }}>
                              {/* 8 Sep malam (feedback Mecca: kayak Claude/ChatGPT/Gemini -- avatar
                                  logo produk, bukan ikon robot generik). Sama seperti logo layar
                                  kosong di file ini. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/Logo-KLIR.png" alt="KLIR" width={16} height={16} style={{ display: 'block', objectFit: 'contain' }} />
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: 'min(88%, 680px)', minWidth: 0 }}>
                              <div style={{ padding: '14px 16px', border: 0, borderRadius: '16px 16px 16px 2px', background: '#0B0E14', fontSize: '13px', lineHeight: 1.6, color: '#C6CEDA', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                                <RichMessage content={msg.text} accent="marketing" />
                                {/* 8 Sep malam (feedback Mecca: sumber tampil LANGSUNG di jawaban,
                                    ala Claude/ChatGPT/Gemini -- bukan kartu terpisah di luar
                                    gelembung). Dipindah ke sini, tepat di bawah teks jawaban. */}
                                {msg.researchSources && (
                                  <ResearchSourcesCard sources={msg.researchSources.sources} fetchedAt={msg.researchSources.fetchedAt} note={msg.researchSources.note} />
                                )}
                              </div>

                              {msg.text && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '2px' }}>
                                  {/* 8 Sep malam (feedback Mecca: gaya AI umum spt Claude/ChatGPT/Gemini) --
                                      tombol Salin + AnswerFeedbackBar disembunyikan sampai gelembung ini
                                      di-hover/fokus (className group di wrapper pesan), ikon polos tanpa
                                      teks. Waktu + nama model TETAP selalu tampil (bukan ikut hover) --
                                      itu sinyal kepercayaan, bukan noise. */}
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(msg.text, msg.id)}
                                      title={copiedId === msg.id ? 'Tersalin' : 'Salin jawaban'}
                                      aria-label={copiedId === msg.id ? 'Tersalin' : 'Salin jawaban'}
                                      className="hover:bg-white/[0.06]"
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '7px', border: 0, background: 'transparent', cursor: 'pointer' }}
                                    >
                                      {copiedId === msg.id ? <Check size={12} color="#4E9BFF" strokeWidth={1.7} /> : <Copy size={12} strokeWidth={1.7} />}
                                    </button>
                                    <AnswerFeedbackBar onFeedback={handleAnswerFeedback} />
                                  </div>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#454C59' }}>
                                    {msg.timestamp}
                                  </span>
                                  {msg.modelUsed && (
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#454C59' }}>
                                      &middot; {msg.modelUsed}
                                    </span>
                                  )}
                                  {/* SETELAN JAWABAN OTOMATIS (11 Sep 2026) -- lihat komentar identik
                                      di ExecutiveAIAssistantView.tsx. */}
                                  {msg.effortAuto && msg.effortUsed && (
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#454C59' }}>
                                      &middot; Otomatis: {msg.effortUsed}{msg.modelTierUsed ? ` - ${msg.modelTierUsed}` : ''}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* V3 TOMBOL LANJUTAN (8 Sep 2026) -- lihat handleNextAction dekat
                                  openStudio/submitStudio. Digate juga oleh !msg.pending/!msg.failed
                                  (StudioMessage) supaya tidak nempel di gelembung media yang masih
                                  diproses/gagal. */}
                              {msg.nextActions && msg.nextActions.length > 0 && !msg.pending && !msg.failed && (
                                <NextActionsBar actions={msg.nextActions} accent="marketing" onAction={handleNextAction} />
                              )}

                              {msg.realImage && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', overflow: 'hidden', maxWidth: '398px' }}>
                                  <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', top: '10px', left: '11px', zIndex: 2, fontSize: '9.5px', fontWeight: 600, color: '#4E9BFF', background: 'rgba(6,8,12,0.78)', border: 0, padding: '3px 9px', borderRadius: '999px' }}>
                                      Visualisasi Dokumen Terverifikasi
                                    </span>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={msg.realImage.url} alt={msg.realImage.prompt} style={{ display: 'block', width: '100%', maxHeight: '320px', objectFit: 'cover' }} />
                                  </div>
                                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: '#8A93A3' }}>{msg.realImage.prompt}</span>
                                    <a
                                      href={msg.realImage.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', height: '34px', borderRadius: '9px', background: '#0058BE', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
                                    >
                                      <Download size={13} />
                                      <span>Buka / unduh gambar</span>
                                    </a>
                                  </div>
                                </div>
                              )}

                              {(msg.media || msg.notebook || msg.submission) && <StudioResult message={msg} onRetry={submission => {
                                if (submission.type === 'storyboard' && !submission.request.brief.trim()) { openStudio('video', '', currentChat.id); return; }
                                void submitStudio(submission, currentChat.id).catch(err => showToast(err instanceof Error ? err.message : 'Permintaan gagal.'));
                              }} />}

                              {msg.realFile && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: 0, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', maxWidth: '398px' }}>
                                  <span style={{ display: 'flex', width: '36px', height: '36px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '10px', background: 'rgba(78,155,255,0.14)' }}>
                                    <FileText size={16} color="#4E9BFF" />
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.realFile.fileName}</div>
                                    <div style={{ fontSize: '10.5px', color: '#8A93A3' }}>File asli, siap dibuka</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => downloadRealFile(msg.realFile!)}
                                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '8px', background: '#0058BE', border: 0, color: '#FFFFFF', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    <Download size={13} />
                                    <span>Unduh</span>
                                  </button>
                                </div>
                              )}

                              {/* T3 (8 Sep 2026) -- kartu verdict relevansi lampiran, field additif
                                  data.attachmentVerdict (brain/chat). Dekat msg.actionCard (bukan area
                                  attachedFile/composer -- attachedFile sudah null saat respons datang). */}
                              {msg.attachmentVerdict && (
                                <AttachmentVerdictCard verdict={msg.attachmentVerdict} fileName={msg.attachment?.name || 'dokumen'} />
                              )}

                              {/* RISET WEB (sumber) dipindah ke dalam gelembung jawaban di atas --
                                  lihat dekat <RichMessage>. */}
                              {msg.prediction && (
                                <ForecastCard data={msg.prediction} onRefine={(extraData) => handleForecastRefine(msg.id, extraData, msg.prediction!.horizonMonths)} />
                              )}
                              {(msg.locationPrompt || msg.locationResult) && (
                                <LocationForm onSubmit={(input) => handleLocationSubmit(msg.id, input)} result={msg.locationResult} />
                              )}

                              {msg.actionCard && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', border: 0, borderRadius: '12px', background: 'rgba(0,88,190,0.09)', boxShadow: '0 4px 18px rgba(0,0,0,0.3)', maxWidth: '520px', textAlign: 'left' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                    <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 700, color: '#F5F7FA' }}>
                                      {msg.actionCard.title}
                                    </h4>
                                    <span style={{ fontSize: '10.5px', fontWeight: 500, color: '#C9A66B', whiteSpace: 'nowrap' }}>
                                      Aksi marketing
                                    </span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '11.5px', color: '#8A93A3', lineHeight: 1.5 }}>
                                    {msg.actionCard.description}
                                  </p>
                                  {msg.actionCard.impactText && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: '#3FBF8F' }}>
                                      <Zap size={12} color="#3FBF8F" />
                                      <span>Dampak: {msg.actionCard.impactText}</span>
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    disabled={!!executingCardTitle}
                                    onClick={() => handleCardExecution(msg.actionCard!)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', width: '100%', padding: '10px', borderRadius: '10px', background: executingCardTitle ? '#5A6472' : '#0058BE', border: 0, color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 700, cursor: executingCardTitle ? 'default' : 'pointer' }}
                                  >
                                    <Zap size={14} />
                                    <span>
                                      {executingCardTitle === msg.actionCard.title
                                        ? 'Menjalankan...'
                                        : (msg.actionCard.actionLabel || 'Terapkan Aksi ke Kampanye Live')}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* User Message */
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', maxWidth: 'min(84%, 620px)', minWidth: 0 }}>
                              {msg.attachment && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 11px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.06)', fontSize: '11.5px', color: '#F5F7FA' }}>
                                  <ImageIcon size={14} color="#4E9BFF" />
                                  <span style={{ fontWeight: 600 }}>{msg.attachment.name}</span>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', color: '#8A93A3' }}>
                                    {msg.attachment.size}
                                  </span>
                                </span>
                              )}
                              <div style={{ padding: '12px 16px', borderRadius: '16px 5px 16px 16px', background: '#0058BE', fontSize: '13px', lineHeight: 1.55, color: '#FFFFFF', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {msg.text}
                              </div>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#454C59' }}>{msg.timestamp}</span>
                            </div>
                            <span style={{ display: 'flex', width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: 0, flexShrink: 0, marginTop: '2px' }}>
                              <User size={14} color="#C6CEDA" />
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {isTyping && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', width: 'fit-content', padding: '8px 12px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.05)', fontSize: '12px', color: '#8A93A3' }}>
                      <RefreshCw size={13} color="#4E9BFF" className="animate-spin" />
                      <span>KLIR Marketing AI sedang merancang materi kampanye...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Composer */}
              <div style={{ flexShrink: 0, padding: '12px 20px 16px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
                  {attachedFile && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '5px 10px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.06)', fontSize: '11.5px', color: '#F5F7FA' }}>
                      <ImageIcon size={14} color="#4E9BFF" />
                      <span>{attachedFile.name}</span>
                      <span style={{ fontSize: '11px', color: '#8A93A3' }}>({attachedFile.size})</span>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        style={{ display: 'flex', border: 0, background: 'transparent', color: '#8A93A3', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                  {/* Item 4.5 roadmap 7 Sep -- kartu pemeriksaan dokumen. */}
                  {attachedFile?.documentCheck && (
                    <div style={{ marginBottom: '8px' }}>
                      <DocumentCheckCard report={attachedFile.documentCheck} fileName={attachedFile.name} />
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 6px 24px rgba(0,0,0,0.5)' }}
                  >
                    <textarea
                      ref={composerTextareaRef}
                      rows={1}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => { if (composerToolbarRef.current?.handleSlashKeyDown(e)) { e.preventDefault(); return; } if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if ((inputMessage.trim() || attachedFile) && !isTyping) void handleSendMessage(); } }}
                      placeholder="Tanya apa saja (email, ide konten, strategi, coding) atau beri instruksi untuk Dashboard..."
                      style={{ display: 'block', width: '100%', minHeight: '24px', maxHeight: '200px', overflowY: 'auto', resize: 'none', border: 0, outline: 'none', background: 'transparent', padding: '4px 2px', fontFamily: "'Outfit', sans-serif", fontSize: '14px', lineHeight: 1.45, color: '#F5F7FA' }}
                    />
                    <ComposerToolbar
                      prefs={composerPrefs}
                      allowVideo={true}
                      onPrefsChange={handleComposerPrefsChange}
                      onSend={handleComposerSend}
                      onMicTranscript={handleComposerMicTranscript}
                      onSlashSelect={handleComposerSlashSelect}
                      inputValue={inputMessage}
                      disabled={isTyping}
                      ref={composerToolbarRef}
                      leading={
                        <AttachmentMenuButton
                          disabled={isTyping}
                          onUploadComputer={() => fileInputRef.current?.click()}
                          onOpenStorage={() => setStoragePickerOpen(true)}
                        />
                      }
                      trailing={
                        <button
                          type="submit"
                          aria-label="Kirim"
                          title="Kirim (Enter)"
                          disabled={!inputMessage.trim() && !attachedFile}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 13px',
                            borderRadius: '999px',
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: inputMessage.trim() || attachedFile ? 'pointer' : 'not-allowed',
                            background: inputMessage.trim() || attachedFile ? '#0058BE' : 'rgba(255,255,255,0.03)',
                            border: 0,
                            color: inputMessage.trim() || attachedFile ? '#FFFFFF' : '#5C6474',
                          }}
                        >
                          <Send size={13} />
                          <span>Kirim</span>
                        </button>
                      }
                    />
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>

        {dataHubOpen && (
          <WorkspaceDataHub
            workspaceId={workspaceId}
            portal="MARKETING"
            onClose={() => setDataHubOpen(false)}
            onAskAI={(prompt) => setInputMessage(prompt)}
          />
        )}

        {storagePickerOpen && (
          <StorageFilePickerModal
            isOpen={true}
            workspaceId={workspaceId}
            portalRole="MARKETING"
            onClose={() => setStoragePickerOpen(false)}
            onSelectFile={(file) => {
              handleSelectStorageFile(file);
              setStoragePickerOpen(false);
            }}
            onUploadNew={() => {
              setStoragePickerOpen(false);
              fileInputRef.current?.click();
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* MODAL: File Hasil AI -- versi nyata (dulu placeholder toast). Daftar dari
            generatedFiles, dihitung di atas dari `chats` (filter yang sama dengan
            filesCreatedCount), bukan array seed statis. */}
        {/* ========================================================================= */}
        {filesOpen && (
          <div
            onClick={() => setFilesOpen(false)}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px', background: 'rgba(4,6,10,0.74)', zIndex: 60 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '620px', maxHeight: '100%', border: 0, borderRadius: '18px', background: '#0B0E14', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '16px 18px 14px', borderBottom: 0, flexShrink: 0 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>File hasil AI</span>
                  <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>
                    {generatedFiles.length ? `${generatedFiles.length} file tersimpan · siap diunduh` : 'Belum ada file tersimpan'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setFilesOpen(false)}
                  title="Tutup"
                  style={{ display: 'flex', flexShrink: 0, padding: '5px', border: 0, borderRadius: '8px', background: 'transparent', color: '#8A93A3', cursor: 'pointer' }}
                >
                  <X size={16} strokeWidth={1.9} />
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 14px 16px' }}>
                {generatedFiles.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {generatedFiles.map((item) => {
                      const kind = generatedFileKind(item);
                      return (
                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 12px', border: 0, borderRadius: '13px', background: 'rgba(255,255,255,0.02)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', flexShrink: 0, borderRadius: '11px', background: `${kind.tone}1F`, border: 0, color: kind.tone }}>
                            {kind.icon}
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#8A93A3' }}>
                              <span>{kind.label}</span>
                              <span>&middot;</span>
                              <span>{relTime(item.createdAt)}</span>
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => downloadGeneratedItem(item)}
                            title="Unduh"
                            style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0, padding: '7px 13px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 500, cursor: 'pointer' }}
                          >
                            <Download size={13} strokeWidth={1.7} />
                            <span>Unduh</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px', padding: '44px 20px' }}>
                    <Folder size={26} color="#8A93A3" strokeWidth={1.4} />
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#C6CEDA' }}>Belum ada file</span>
                    <span style={{ fontSize: '11.5px', color: '#8A93A3', textAlign: 'center' }}>Minta AI membuat dokumen, gambar, atau media Studio. Hasilnya tersimpan di sini.</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 18px', borderTop: 0, flexShrink: 0 }}>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>File tetap tersimpan selama percakapan tersimpan di perangkat ini.</span>
                <button
                  type="button"
                  onClick={() => setFilesOpen(false)}
                  style={{ flexShrink: 0, padding: '9px 18px', border: 0, borderRadius: '11px', background: '#0058BE', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. BRAND KIT MODAL (eksklusif role marketing) */}
        {/* ========================================================================= */}
        {mediaPanel && <MediaStudio
          key={mediaPanel.id}
          kind={mediaPanel.kind}
          initialText={mediaPanel.text}
          sourceText={mediaPanel.source}
          initialStudioMode={mediaPanel.mode}
          role="marketing"
          allowVideo={true}
          brand={{ workspaceName, palette: activeBrandPalette ? `${activeBrandPalette.name}: ${activeBrandPalette.colors.join(', ')}` : undefined, hasLogo: brandKit.logo }}
          onClose={() => setMediaPanel(null)}
          onSubmit={async submission => {
            await submitStudio(submission, mediaPanel.chatId);
            if (activeChatId === mediaPanel.chatId) setInputMessage(current => current === mediaPanel.text ? '' : current);
          }}
          onTranscript={text => { const target = mediaPanel.chatId; setMediaPanel(null); void handleSendMessage(text, target); }}
        />}
        {brandKitOpen && (
          <div
            onClick={() => setBrandKitOpen(false)}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px', background: 'rgba(4,6,10,0.74)', zIndex: 60 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '560px', maxHeight: '100%', border: 0, borderRadius: '18px', background: '#0B0E14', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '16px 18px 14px', borderBottom: 0, flexShrink: 0 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>Brand Kit — Identitas Visual Brand</span>
                  <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Diatur sekali, dipakai di semua materi promosi yang dibuat AI.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setBrandKitOpen(false)}
                  title="Tutup"
                  style={{ display: 'flex', flexShrink: 0, padding: '5px', border: 0, borderRadius: '8px', background: 'transparent', color: '#8A93A3', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Logo perusahaan */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3' }}>Logo perusahaan</span>
                  <button
                    type="button"
                    onClick={() => setBrandKit((prev) => ({ ...prev, logo: !prev.logo }))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '13px',
                      padding: '13px 14px',
                      border: 0,
                      borderRadius: '13px',
                      background: brandKit.logo ? 'rgba(216,163,60,0.09)' : 'rgba(255,255,255,0.02)',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', width: '38px', height: '38px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '10px', background: brandKit.logo ? 'rgba(216,163,60,0.14)' : 'rgba(255,255,255,0.04)', border: 0 }}>
                      {brandKit.logo ? <Check size={16} color="#D8A33C" /> : <ImageIcon size={16} color="#5C6474" />}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
                        {brandKit.logo ? 'Brand memiliki logo (metadata)' : 'Tandai bahwa brand memiliki logo'}
                      </span>
                      <span style={{ fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        File logo belum diunggah dan tidak disisipkan ke gambar.
                      </span>
                    </span>
                  </button>
                </div>

                {/* Warna brand */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3' }}>Warna brand</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {BRAND_PALETTES.map((pal) => {
                      const on = brandKit.palette === pal.name;
                      return (
                        <button
                          key={pal.name}
                          type="button"
                          onClick={() => setBrandKit((prev) => ({ ...prev, palette: pal.name }))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            padding: '7px 11px 7px 8px',
                            border: 0,
                            borderRadius: '11px',
                            background: on ? 'rgba(216,163,60,0.15)' : 'rgba(255,255,255,0.02)',
                            color: on ? '#F5F7FA' : '#8A93A3',
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '11.5px',
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          <span style={{ display: 'flex', gap: '3px' }}>
                            {pal.colors.map((c, i) => (
                              <span key={i} style={{ width: '11px', height: '11px', borderRadius: '3px', background: c, border: 0 }} />
                            ))}
                          </span>
                          <span>{pal.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Foto referensi produk */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3' }}>Foto referensi produk</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '9px' }}>
                    {[0, 1, 2].map((i) => {
                      const filled = brandKit.refs.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled
                          style={{
                            position: 'relative',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '74px',
                            border: 0,
                            borderRadius: '11px',
                            background: filled ? 'linear-gradient(150deg,rgba(216,163,60,0.16),rgba(255,255,255,0.02))' : 'rgba(255,255,255,0.02)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                          }}
                        >
                          {filled ? (
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', color: '#D8A33C' }}>
                              <Check size={15} />
                              <span style={{ fontSize: '10px', color: '#C6CEDA' }}>Foto {i + 1}</span>
                            </span>
                          ) : (
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', color: '#8A93A3' }}>
                              <ImageIcon size={15} />
                              <span style={{ fontSize: '10px' }}>Segera</span>
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: '10.5px', color: '#8A93A3' }}>
                    Upload foto referensi belum tersedia. Saat ini generator memakai metadata warna brand saja.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 18px', borderTop: 0, flexShrink: 0 }}>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>
                  {kitReady ? 'Palet brand dipakai sebagai konteks prompt gambar.' : 'Pilih warna untuk mengaktifkan konteks brand.'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {kitReady && (
                    <button
                      type="button"
                      onClick={() => setBrandKit({ logo: false, palette: null, refs: [] })}
                      style={{ padding: '9px 14px', border: 0, borderRadius: '11px', background: 'rgba(255,255,255,0.04)', color: '#8A93A3', fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                    >
                      Atur ulang
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setBrandKitOpen(false);
                      if (kitReady) {
                        showToast('Metadata palet brand disimpan untuk prompt gambar.', 3000);
                        if (!brandKitTipShown) {
                          setBrandKitTipShown(true);
                          setShowBrandKitTip(true);
                          const tipMsg: ChatMessage = {
                            id: `ai-mkt-tip-${Date.now()}`,
                            sender: 'ai',
                            text: `Palet **${brandKit.palette}** sekarang dipakai sebagai konteks prompt gambar. Logo hanya berupa metadata; file logo dan foto referensi belum dikirim ke generator. Coba "buatkan poster promosi diskon akhir bulan" untuk membuka studio gambar.`,
                            timestamp: 'Baru saja',
                          };
                          setChats((prev) =>
                            prev.map((c) =>
                              c.id === activeChatId
                                ? { ...c, updatedAt: Date.now(), messages: [...c.messages, tipMsg] }
                                : c
                            )
                          );
                        }
                      }
                    }}
                    style={{ padding: '9px 18px', border: 0, borderRadius: '11px', background: '#0058BE', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {kitReady ? 'Selesai' : 'Aktifkan brand kit'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Alat Pertumbuhan -- WIRE (8 Sep 2026, MKT-05/06/07) */}
        {growthToolsOpen && (
          <div
            onClick={() => setGrowthToolsOpen(false)}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px', background: 'rgba(4,6,10,0.74)', zIndex: 60 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '640px', maxHeight: '92%', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '18px', background: '#0B0E14', boxShadow: '0 30px 80px rgba(0,0,0,0.62)', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '16px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>Alat Pertumbuhan</span>
                  <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Hasil terstruktur langsung dari backend, bukan jawaban chat bebas.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setGrowthToolsOpen(false)}
                  title="Tutup"
                  style={{ display: 'flex', flexShrink: 0, padding: '5px', border: 0, borderRadius: '8px', background: 'transparent', color: '#8A93A3', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Tab switcher */}
              <div style={{ display: 'flex', gap: '6px', padding: '12px 18px 0', flexShrink: 0 }}>
                {([
                  { key: 'calendar', label: 'Kalender Konten', Icon: Calendar },
                  { key: 'copywriting', label: 'Copywriting', Icon: MessageSquare },
                  { key: 'biolink', label: 'Bio-Link', Icon: Globe },
                ] as const).map((t) => {
                  const active = growthTab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => { setGrowthTab(t.key); setGrowthError(null); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px 10px 0 0', border: 0, borderBottom: active ? '2px solid #4E9BFF' : '2px solid transparent', background: active ? 'rgba(78,155,255,0.10)' : 'transparent', color: active ? '#4E9BFF' : '#8A93A3', fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      <t.Icon size={13} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {growthError && (
                  <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5', fontSize: '12px' }}>
                    {growthError}
                  </div>
                )}

                {/* TAB: KALENDER KONTEN 7 HARI */}
                {growthTab === 'calendar' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '9px 12px', borderRadius: '9px', background: 'rgba(242,168,59,0.08)', border: '1px solid rgba(242,168,59,0.22)', fontSize: '11px', color: '#D8B77A' }}>
                      Memanggil AI sungguhan dan memotong 30 kredit workspace per generate -- isi dulu sebelum klik.
                    </div>
                    {/* Katalog produk baca-saja (kontrak marketing-build item g) -- opsional,
                        DI ATAS field manual, mengisi tema kampanye dari produk tercatat di
                        Inventory. Tidak menggantikan field manual di bawah. */}
                    {productCatalogLoaded && productCatalog.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#5C6474' }}>Belum ada produk tercatat.</div>
                    ) : productCatalog.length > 0 ? (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const product = productCatalog.find((p) => p.id === e.target.value) || null;
                          setCalendarForm((p) => applyProductCatalogToCalendarForm(p, product));
                          e.target.value = '';
                        }}
                        style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#8A93A3', fontSize: '12.5px' }}
                      >
                        <option value="" disabled>Pilih dari produk tercatat (opsional)</option>
                        {productCatalog.map((p) => (
                          <option key={p.id} value={p.id}>{formatProductCatalogLabel(p)}</option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      type="text"
                      placeholder="Nama bisnis / kampanye (wajib)"
                      value={calendarForm.title}
                      onChange={(e) => setCalendarForm((p) => ({ ...p, title: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      placeholder="Industri (contoh: F&B & Retail)"
                      value={calendarForm.industry}
                      onChange={(e) => setCalendarForm((p) => ({ ...p, industry: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      placeholder="Tema kampanye utama"
                      value={calendarForm.mainCampaign}
                      onChange={(e) => setCalendarForm((p) => ({ ...p, mainCampaign: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      disabled={growthLoading || !calendarForm.title.trim()}
                      onClick={() => runGrowthTool('/api/v1/promo/calendar', calendarForm, (data) => setCalendarResult(data.calendar))}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: 0, background: '#4E9BFF', color: '#06080C', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', opacity: growthLoading || !calendarForm.title.trim() ? 0.5 : 1 }}
                    >
                      {growthLoading ? 'Menyusun...' : 'Susun Kalender 7 Hari (30 kredit)'}
                    </button>

                    {calendarResult && Array.isArray(calendarResult.days) && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>{calendarResult.calendarTitle}</span>
                        {calendarResult.days.map((d: any) => (
                          <div key={d.day} style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.08)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#4E9BFF', fontWeight: 600 }}>
                              <span>Hari {d.day} - {d.dayName}</span>
                              <span>{d.bestPostingTime}</span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#F5F7FA', fontWeight: 600, marginTop: '4px' }}>{d.headlineIdea}</div>
                            <div style={{ fontSize: '11px', color: '#8A93A3', marginTop: '2px' }}>{d.pillar} - {d.contentType}</div>
                            <div style={{ fontSize: '11px', color: '#8A93A3', marginTop: '2px' }}>{d.visualConcept}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: COPYWRITING MULTI-PLATFORM */}
                {growthTab === 'copywriting' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '9px 12px', borderRadius: '9px', background: 'rgba(242,168,59,0.08)', border: '1px solid rgba(242,168,59,0.22)', fontSize: '11px', color: '#D8B77A' }}>
                      Memanggil AI sungguhan dan memotong 20 kredit workspace per generate -- isi dulu sebelum klik.
                    </div>
                    {/* Katalog produk baca-saja (kontrak marketing-build item g) -- opsional,
                        DI ATAS field manual, mengisi productName + harga jual ke productDesc
                        dari produk tercatat di Inventory. Field manual di bawah tetap ada. */}
                    {productCatalogLoaded && productCatalog.length === 0 ? (
                      <div style={{ fontSize: '11px', color: '#5C6474' }}>Belum ada produk tercatat.</div>
                    ) : productCatalog.length > 0 ? (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const product = productCatalog.find((p) => p.id === e.target.value) || null;
                          setCopyForm((p) => applyProductCatalogToCopyForm(p, product));
                          e.target.value = '';
                        }}
                        style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#8A93A3', fontSize: '12.5px' }}
                      >
                        <option value="" disabled>Pilih dari produk tercatat (opsional)</option>
                        {productCatalog.map((p) => (
                          <option key={p.id} value={p.id}>{formatProductCatalogLabel(p)}</option>
                        ))}
                      </select>
                    ) : null}
                    <input
                      type="text"
                      placeholder="Nama produk / layanan (wajib)"
                      value={copyForm.productName}
                      onChange={(e) => setCopyForm((p) => ({ ...p, productName: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      placeholder="Deskripsi produk (opsional)"
                      value={copyForm.productDesc}
                      onChange={(e) => setCopyForm((p) => ({ ...p, productDesc: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      placeholder="Target audiens (opsional)"
                      value={copyForm.targetAudience}
                      onChange={(e) => setCopyForm((p) => ({ ...p, targetAudience: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <select
                      value={copyForm.promoTone}
                      onChange={(e) => setCopyForm((p) => ({ ...p, promoTone: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    >
                      <option value="SKENA_JAKSEL">Kasual Anak Muda (Skena Jaksel)</option>
                      <option value="RAMAH_SELLER">Ramah Seller Marketplace</option>
                      <option value="FORMAL_KORPORAT">Formal Korporat B2B</option>
                      <option value="STORYTELLING">Storytelling Emosional</option>
                    </select>
                    <button
                      type="button"
                      disabled={growthLoading || !copyForm.productName.trim()}
                      onClick={() => runGrowthTool('/api/v1/promo/copywriting', copyForm, (data) => setCopywritingResult(data.copywriting))}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: 0, background: '#4E9BFF', color: '#06080C', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', opacity: growthLoading || !copyForm.productName.trim() ? 0.5 : 1 }}
                    >
                      {growthLoading ? 'Menyusun...' : 'Buat Copywriting 4-Platform (20 kredit)'}
                    </button>

                    {copywritingResult && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '11px', color: '#4E9BFF', fontWeight: 600, marginBottom: '4px' }}>Instagram</div>
                          <div style={{ fontSize: '12.5px', color: '#F5F7FA', fontWeight: 600 }}>{copywritingResult.instagram?.headline}</div>
                          <div style={{ fontSize: '11.5px', color: '#8A93A3', marginTop: '3px' }}>{copywritingResult.instagram?.caption}</div>
                          <div style={{ fontSize: '11px', color: '#3FBF8F', marginTop: '3px' }}>{copywritingResult.instagram?.callToAction}</div>
                        </div>
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '11px', color: '#A5B4FC', fontWeight: 600, marginBottom: '4px' }}>TikTok</div>
                          <div style={{ fontSize: '12.5px', color: '#F5F7FA', fontWeight: 600 }}>{copywritingResult.tiktok?.hook3Detik}</div>
                          <div style={{ fontSize: '11.5px', color: '#8A93A3', marginTop: '3px' }}>{copywritingResult.tiktok?.scriptVideo}</div>
                        </div>
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '11px', color: '#3FBF8F', fontWeight: 600, marginBottom: '4px' }}>WhatsApp Broadcast</div>
                          <div style={{ fontSize: '11.5px', color: '#8A93A3' }}>{copywritingResult.whatsappBroadcast?.salamPembuka} {copywritingResult.whatsappBroadcast?.isiPesan}</div>
                        </div>
                        <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ fontSize: '11px', color: '#F2A83B', fontWeight: 600, marginBottom: '4px' }}>Meta Ads</div>
                          <div style={{ fontSize: '12.5px', color: '#F5F7FA', fontWeight: 600 }}>{copywritingResult.metaAds?.adHeadline}</div>
                          <div style={{ fontSize: '11.5px', color: '#8A93A3', marginTop: '3px' }}>{copywritingResult.metaAds?.primaryText}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: BIO-LINK / MICROSITE */}
                {growthTab === 'biolink' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ padding: '9px 12px', borderRadius: '9px', background: 'rgba(63,191,143,0.08)', border: '1px solid rgba(63,191,143,0.22)', fontSize: '11px', color: '#8FD9BB' }}>
                      Tidak memanggil AI dan gratis (tanpa potong kredit) -- aman dicoba berkali-kali.
                    </div>
                    <input
                      type="text"
                      placeholder="Nama bisnis (kosongkan untuk pakai nama workspace)"
                      value={biolinkForm.businessName}
                      onChange={(e) => setBiolinkForm((p) => ({ ...p, businessName: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      placeholder="Tagline (opsional)"
                      value={biolinkForm.tagline}
                      onChange={(e) => setBiolinkForm((p) => ({ ...p, tagline: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      placeholder="Nomor WhatsApp (contoh: 6281234567890)"
                      value={biolinkForm.whatsappPhone}
                      onChange={(e) => setBiolinkForm((p) => ({ ...p, whatsappPhone: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <input
                      type="text"
                      placeholder="Alamat lokasi (opsional)"
                      value={biolinkForm.locationAddress}
                      onChange={(e) => setBiolinkForm((p) => ({ ...p, locationAddress: e.target.value }))}
                      style={{ padding: '10px 12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.12)', color: '#F5F7FA', fontSize: '13px' }}
                    />
                    <button
                      type="button"
                      disabled={growthLoading}
                      onClick={() => runGrowthTool('/api/v1/promo/biolink', {
                        businessName: biolinkForm.businessName || undefined,
                        tagline: biolinkForm.tagline || undefined,
                        whatsappPhone: biolinkForm.whatsappPhone || undefined,
                        locationAddress: biolinkForm.locationAddress || undefined,
                      }, (data) => setBiolinkResult(data.bioProfile))}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: 0, background: '#3FBF8F', color: '#06080C', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', opacity: growthLoading ? 0.5 : 1 }}
                    >
                      {growthLoading ? 'Menyusun...' : 'Buat Profil Bio-Link (gratis)'}
                    </button>

                    {biolinkResult && (
                      <div style={{ padding: '12px', borderRadius: '10px', background: '#10141C', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>{biolinkResult.businessName}</div>
                        <div style={{ fontSize: '11.5px', color: '#8A93A3' }}>{biolinkResult.tagline}</div>
                        <div style={{ fontSize: '11px', color: '#8A93A3' }}>{biolinkResult.locationAddress}</div>
                        {(biolinkResult.actionButtons || []).map((btn: any, i: number) => (
                          <a
                            key={i}
                            href={btn.url}
                            target="_blank"
                            rel="noreferrer"
                            style={{ display: 'block', padding: '9px 12px', borderRadius: '9px', background: btn.isPrimary ? 'rgba(63,191,143,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${btn.isPrimary ? 'rgba(63,191,143,0.35)' : 'rgba(255,255,255,0.1)'}`, color: '#F5F7FA', fontSize: '11.5px', textDecoration: 'none' }}
                          >
                            {btn.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL: Pengaturan Divisi Marketing */}
        <MarketingSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          initialTab={settingsTab}
        />
      </div>
    </div>
  );
}
