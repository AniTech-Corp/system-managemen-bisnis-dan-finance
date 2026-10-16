'use client';

import React, { useState, useEffect, useRef } from 'react';
import { consumeInitialPrompt } from '@/lib/initial-prompt-storage';
import { INVENTORY_AI_PROMPT } from '@/lib/ai-brain/inventory-product-command';
import TermHint from './TermHint';
import { CEOSettingsModal } from './settings/CEOSettingsModal';
import { KLIR_AI_TOOLS } from '@/lib/ai-tools-registry';
import { sanitizeLiveCompanyState } from '@/lib/live-company-state';
import { analyzeSalesTarget, detectSalesTargetIntent } from '@/lib/ai-brain/sales-target-engine';
import { TAX_FEATURE_LOCKED, TAX_FEATURE_LOCK_MESSAGE } from '@/lib/tax-feature';
// ===== Studio Template Dokumen & Notebook (additive, tim AI, lihat blok "STUDIO TEMPLATE
// & NOTEBOOK" di bawah untuk cara membatalkan) -- komponen berikut SUDAH ADA & LIVE di
// MarketingAIAssistantView.tsx, tidak dimodifikasi sama sekali di sini, cuma diimpor.
// Nama field pesan diberi prefix "studio" (studioMedia dkk, BUKAN "media" polos) karena
// interface ChatMessage di file ini SUDAH punya field media?:GeneratedMedia sendiri (fitur
// simulasi poster milik Fatur, lihat detectMedia() di bawah) -- tidak boleh bentrok. =====
import MediaStudio from './marketing-media/MediaStudio';
import StudioResult from './marketing-media/StudioResult';
// Roadmap 7 Sep item 4.1 -- Pusat Data (Hub Upload), fitur baru prioritas #1. Modal
import WorkspaceDataHub from './WorkspaceDataHub';
import StorageFilePickerModal, { type StorageFileItem } from './StorageFilePickerModal';
import AttachmentMenuButton from './chat/AttachmentMenuButton';
import DragDropFileOverlay from './chat/DragDropFileOverlay';
// Roadmap 7 Sep item 4.5 -- kartu hasil document-checker/tabular-checker.
import DocumentCheckCard from './DocumentCheckCard';
// T3 (8 Sep 2026) -- kartu verdict relevansi lampiran chat (relevan/tidak +
// tombol hapus/tetap simpan), dipakai identik di 3 AI Assistant View.
import AttachmentVerdictCard, { type AttachmentVerdict } from './AttachmentVerdictCard';
import type { DocumentCheckReport } from '@/lib/ai-brain/document-checker';
import type { TabularCheckReport } from '@/lib/ai-brain/tabular-checker';
// RISET WEB + PREDIKSI FORECAST + LOKASI (8 Sep 2026, wave B5-chat-wiring-ui) --
// 3 kartu presentasi baru (murni, dipakai identik di 3 AI Assistant View) untuk
// field additif brain/chat data.researchSources/forecast/locationPrompt (B1/B2/B3/B4).
import ResearchSourcesCard from './chat/ResearchSourcesCard';
import ForecastCard from './chat/ForecastCard';
import LocationForm from './chat/LocationForm';
import ProactiveAlertsPanel from './chat/ProactiveAlertsPanel';
import type { ResearchSource, BlendedForecastResult, ForecastExtraData, LocationPromptNeeded, LocationAnalysisInput, LocationAnalysisResult } from '@/lib/research-types';
// V1 RENDER KAYA + V3 TOMBOL LANJUTAN (8 Sep 2026) -- lihat komentar identik di
// MarketingAIAssistantView.tsx (satu-satunya sumber acuan, tidak diulang panjang di sini).
// CATATAN Executive-only: pola [[src:xxx]] (badge sumber data) tetap didukung
// RichMessage.tsx untuk accent="executive" lewat salinan verbatim registry-nya sendiri
// (EXEC_SOURCE_REGISTRY di chat/RichMessage.tsx) -- lihat chat-markdown.ts.
import RichMessage from './chat/RichMessage';
import NextActionsBar from './chat/NextActionsBar';
import type { NextAction } from '@/lib/ai-brain/next-actions';
import { executeActionCardOnServer } from '@/lib/ai-brain/action-card-execution';
import { apiRequest, ApiRequestError, pollVideoJob, resolveStudioSource, validMediaResult, type StudioKind, type StudioMessage, type StudioSubmission, type MediaResult } from './marketing-media/client';
import type { NotebookResult } from '@/lib/notebook-types';
// SETELAN JAWABAN + COMPOSER TOOLBAR (8 Sep 2026, wave B5-wiring-3-view) -- komponen
// adapter murni (B2) + SSOT tipe/localStorage (B1) + logic preferensi pembaca (B4) +
// registry slash-command (B6). Semua diimpor APA ADANYA (bukan diduplikasi), file ini
// cuma menyambungkan ke state/handleSendMessage/openStudio yang sudah ada.
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
import {
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
  FileText,
  FileSpreadsheet,
  Settings2,
  Video,
  Presentation,
  Image as ImageIcon,
  Search,
  Mic,
  Lightbulb,
  BookOpen,
  TrendingUp,
  Users,
  Receipt,
  Calendar,
  CheckCircle2,
  Mail,
  BarChart2,
  ChevronDown,
  Folder,
  Database,
  Download,
  Languages,
  ArrowRight as ArrowRightIcon,
  Volume2,
  VolumeX,
  ChevronUp,
  Wand2,
  Gauge,
  Globe,
  ClipboardCheck,
  Package,
  Scale,
  Terminal,
  Target,
  Wallet,
  Calculator,
  PieChart,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Layers,
  GraduationCap,
  Shield,
  Copy as CopyIconAlt,
  Sliders,
  Megaphone,
  Trash2,
  Lock,
} from 'lucide-react';

// V1 RENDER KAYA (8 Sep 2026): SOURCE_REGISTRY lokal ini DIHAPUS -- satu-satunya
// pemakainya (parseInline lama, pola [[src:xxx]]) sudah digantikan RichMessage.tsx yang
// menyimpan salinan verbatim registry ini sendiri (lihat EXEC_SOURCE_REGISTRY di
// src/app/components/chat/RichMessage.tsx) supaya komponen bersama itu tidak perlu
// bergantung ke const lokal file ini. `dataSources` di bawah (untuk panel "Sumber data
// yang dibaca AI") independen, tidak pernah membaca const ini.

interface ExecutiveAIAssistantViewProps {
  workspaceId?: string;
  workspaceName?: string;
  userName?: string;
  /** Keep chat history isolated when the same workspace is opened by another role. */
  portalRole?: 'CEO' | 'FINANCE' | 'MARKETING';
  /** Return to the authenticated gateway before switching division. */
  onRoleChange?: () => void;
  /** Open feature surfaces without putting their full UI inside the dashboard overview. */
  onOpenWorkspace?: () => void;
  onOpenSchedule?: () => void;
  onOpenInventory?: () => void;
}

interface ActionCard {
  type: 'SCALE_ADS' | 'HIRE_STAFF' | 'RESOLVE_INVOICE' | 'WEEKLY_REC' | string;
  recommendationId?: string;
  title: string;
  description: string;
  impactText?: string;
  actionLabel?: string;
  actionPayload?: { confirmationMessage?: string };
}

interface GeneratedMedia {
  kind: 'image' | 'video';
  style?: string;
  title?: string;
  size?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  attachment?: {
    name: string;
    size: string;
  };
  actionCard?: ActionCard;
  media?: GeneratedMedia;
  /** gambar ASLI hasil generate server (bukan simulasi styleArt di atas) */
  realImage?: { url: string; prompt: string; provider: string };
  /** file ASLI (docx/xlsx/pptx/storyboard) hasil generate server */
  realFile?: { fileName: string; mimeType: string; fileBase64: string; type: string };
  /**
   * true kalau pesan ini pesan GAGAL KONEKSI (server tidak terjangkau / jawaban
   * kosong) -- BUKAN jawaban AI biasa. Dipakai render bubble supaya beri penanda
   * visual berbeda (border amber + label), tidak boleh tertukar tampilan dengan
   * jawaban asli. Ditambahkan setelah insiden demo gagal ke calon klien pertama
   * (5-6 Sep 2026): akar masalahnya fallback SENYAP ke data karangan berformat
   * identik jawaban asli -- lihat getConnectionErrorReply() di bawah.
   */
  isSystemError?: boolean;
  /** teks prompt user asli, dipakai tombol "Coba Lagi" saat isSystemError true */
  retryText?: string;
  /** T3 (8 Sep 2026) -- verdict relevansi lampiran (dari brain/chat, field
   * additif `data.attachmentVerdict`), absen kalau lampiran tidak ada/gagal
   * tersimpan -- BUKAN error, kartu verdict cukup tidak dirender. */
  attachmentVerdict?: AttachmentVerdict;
  /** RISET WEB + PREDIKSI + LOKASI (8 Sep 2026, wave B5) -- field additif brain/chat
   * `data.researchSources`/`data.researchFetchedAt`/`data.researchNote` DIGABUNG jadi
   * 1 objek di sini (bukan 3 field terpisah) supaya render call site tinggal cek
   * `msg.researchSources` sekali. Absen kalau pesan ini tidak memicu riset web sama
   * sekali -- BEDA dari `sources: []` (riset dicoba tapi gagal/di-throttle, `note`
   * WAJIB terisi untuk kasus itu, lihat ResearchSourcesCard.tsx). */
  researchSources?: { sources: ResearchSource[]; fetchedAt: string; note?: string };
  /** field additif brain/chat `data.forecast` (BlendedForecastResult, milik B2) --
   * absen kalau pesan ini bukan permintaan prediksi. Bisa diperbarui lagi lewat
   * ForecastCard "Tambah data saya" (lihat handleForecastRefine). */
  prediction?: BlendedForecastResult;
  /** field additif brain/chat `data.locationPrompt` -- terisi kalau intent lokasi
   * terdeteksi TAPI area/lokasi belum jelas dari teks pesan, LocationForm.tsx
   * WAJIB minta input manual (bukan menebak). */
  locationPrompt?: LocationPromptNeeded;
  /** hasil POST /api/v1/brain/location (milik B3) SETELAH user submit LocationForm
   * -- BUKAN field dari brain/chat (chat tidak pernah panggil analyzeLocation
   * langsung, lihat komentar GATING di route.ts), diisi client-side oleh
   * handleLocationSubmit di bawah. */
  locationResult?: LocationAnalysisResult;
  /** ===== Studio Template Dokumen & Notebook (additive) =====
   * Prefix "studio" sengaja dipakai (bukan "media" polos) supaya TIDAK bentrok dengan field
   * media?:GeneratedMedia di atas (fitur simulasi poster milik Fatur, tipe beda, jangan
   * disatukan). Diisi oleh submitStudio() di bawah, dirender StudioResult (komponen bersama,
   * sudah dipakai MarketingAIAssistantView.tsx, tidak diubah). */
  studioMedia?: MediaResult;
  studioNotebook?: NotebookResult;
  studioSubmission?: StudioSubmission;
  studioPending?: boolean;
  studioFailed?: boolean;
  studioDraftScript?: string;
  /** V3 TOMBOL LANJUTAN (8 Sep 2026) -- field additif brain/chat `data.nextActions`,
   * array kosong/absen = tidak render NextActionsBar sama sekali. */
  nextActions?: NextAction[];
  /** SETELAN JAWABAN (8 Sep 2026, B5) -- nama model yang BENAR-BENAR dipakai server
   * (field response `data.model`, BUKAN `data.modelUsed` -- lihat catatan_jujur laporan
   * B3 soal nama field asli). Absen kalau jalur respons ini tidak mengisinya (fallback
   * lokal tanpa LLM, dsb) -- bukan error, cuma tidak ditampilkan. */
  modelUsed?: string;
  /** SETELAN JAWABAN OTOMATIS (11 Sep 2026, kontrak modul 1+2: model-tiers.ts + auto-
   * effort.ts) -- field additif brain/chat `data.effortAuto`/`data.effortUsed`/
   * `data.modelTierUsed`. effortAuto true = backend MEMILIHKAN effort sendiri (body.effort
   * tidak dikirim eksplisit dari composer) -- dipakai badge "Otomatis: <effort> - <tier>"
   * di bawah gelembung jawaban. Absen/false = user sudah pilih effort manual di Setelan
   * jawaban, badge ini TIDAK ditampilkan (tidak relevan, bukan "otomatis"). */
  effortAuto?: boolean;
  effortUsed?: string;
  modelTierUsed?: string;
  /** Mode asisten yang BENAR-BENAR dipakai backend (`data.assistantModeUsed`) -- bisa beda
   * dari yang dikirim kalau backend menormalkan nilai tidak dikenal ke 'tanya'. Absen =
   * jalur respons ini tidak mengisinya (fallback lokal, dsb). */
  assistantModeUsed?: string;
}

interface ChatSession {
  id: string;
  updatedAt: number;
  messages: ChatMessage[];
}

// V1 RENDER KAYA (8 Sep 2026): parseInline + FormattedMessage lokal DIHAPUS dari sini --
// digantikan komponen bersama src/app/components/chat/RichMessage.tsx (lihat call site
// <RichMessage content={msg.text} accent="executive" /> di bawah). Pola [[src:xxx]]
// (dulu dibaca lewat SOURCE_REGISTRY lokal, sekarang sudah dihapus dari file ini) tetap
// dirender lewat salinan verbatim registry-nya di RichMessage.tsx.

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

// 4-source -> hub data-flow animation paths ("Sumber data yang dibaca AI"),
// scaled down from the mockup's 76x188 viewBox (baris 3136-3156) to fit this
// component's 52x150 flow column. Each path pairs with dataSources[i] by index.
const DATA_FLOW_PATHS = [
  'M0 15 C 25 15, 27 75, 52 75',
  'M0 55 C 25 55, 27 75, 52 75',
  'M0 95 C 25 95, 27 75, 52 75',
  'M0 135 C 25 135, 27 75, 52 75',
];

// Mini sparkline for a stat-card series -- mirrors mockup spark() (baris 2013-2043).
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

// Triangle caret + percent delta chip -- mirrors mockup deltaChip() (baris 3215-3234).
// Compares only the series' last two points so the arrow/colour can never
// contradict the sparkline it sits next to.
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

const IMAGE_STYLE_LIST: { key: string; label: string }[] = [
  { key: 'glass', label: '3D glassmorphism' },
  { key: 'studio', label: 'Foto produk studio' },
  { key: 'ugc', label: 'Testimoni UGC' },
  { key: 'neon', label: 'Sinematik dark-neon' },
];

const VIDEO_SCENES = [
  { label: 'Hook', dur: '0-3s' },
  { label: 'Masalah', dur: '4-12s' },
  { label: 'Solusi', dur: '13-24s' },
  { label: 'CTA', dur: '25-30s' },
];

// 8 Sep 2026 (temuan F1 audit): dulu detectMedia() match longgar -- kata kunci muncul di
// MANAPUN dalam kalimat langsung dianggap niat generate media, walau kalimatnya cuma
// MENYEBUT kata itu (mis. "...cocokkan buku kas dengan mutasi bank... voucher promo bulan
// lalu" ikut memunculkan kartu voucher palsu). Server (src/lib/media-intent.ts,
// detectMediaIntent) mewajibkan kalimat DIAWALI kata kerja perintah dulu (buat/bikin/
// generate/dst) sebelum mengecek kata kunci media -- syarat yang sama disamakan di sini
// supaya kartu simulasi client ini tidak lagi longgar sepihak dari niat generate server.
const MEDIA_COMMAND_VERB = /^(?:(?:tolong|bisa|bisakah|boleh|please|can you|mohon|coba|saya ingin|aku mau|gue mau)\s+)*(?:buat(?:kan)?|bikin(?:kan)?|generate|hasilkan|create|render)\b/i;

function detectMedia(userText: string): GeneratedMedia | null {
  const lower = String(userText || '').toLowerCase();
  const cmd = MEDIA_COMMAND_VERB.exec(lower);
  if (!cmd) return null;
  // 8 Sep 2026: samakan dengan exclude-gate server (media-intent.ts:11) -- "buatkan naskah/
  // skrip/konsep/ide/prompt/deskripsi/copywriting video ..." = kerja teks, bukan kartu media.
  const subject = lower.slice(cmd.index + cmd[0].length).trimStart();
  if (/^(?:(?:sebuah|satu|a|an|\d+)\s+)?(?:naskah|skrip|script|konsep|ide|prompt|deskripsi|copywriting)\b/.test(subject)) return null;
  if (/video tiktok|9:16|vertikal|storyboard|buat video|naskah video/.test(lower)) {
    return { kind: 'video', title: 'Video promosi vertikal 9:16' };
  }
  if (/poster|banner|gambar|glassmorphism|visual|materi grafis|voucher/.test(lower)) {
    const style = /glassmorphism|poster|voucher/.test(lower)
      ? 'glass'
      : /studio|produk/.test(lower)
      ? 'studio'
      : /testimoni|ugc/.test(lower)
      ? 'ugc'
      : 'neon';
    return {
      kind: 'image',
      style,
      title: /voucher/.test(lower) ? 'Kartu voucher flash sale' : 'Poster promosi produk',
      size: '1080 × 1350',
    };
  }
  return null;
}

// Stylized art-direction placeholder for generated image/video previews. Mirrors the
// four brand-kit visual styles (glass / studio / ugc / neon) so a message's media card
// reads as "already produced" rather than an empty placeholder.
function styleArt(style: string, tone: string) {
  const box = (extra?: React.CSSProperties): React.CSSProperties => ({ position: 'absolute', inset: 0, overflow: 'hidden', ...extra });
  const accent = tone || '#D8A33C';

  if (style === 'glass') {
    return (
      <span style={box({ background: 'linear-gradient(150deg,#101A2E,#0A0D14 62%)' })}>
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
      <span style={box({ background: 'linear-gradient(180deg,#1A1E26 58%,#0D1016)' })}>
        <span style={{ position: 'absolute', left: '50%', top: '16%', width: '54%', height: '52%', transform: 'translateX(-50%)', borderRadius: '10px', background: 'linear-gradient(165deg,#F5F7FA,#B9C2CF)', boxShadow: '0 22px 34px rgba(0,0,0,0.55)' }} />
        <span style={{ position: 'absolute', left: '50%', top: '66%', width: '46%', height: '9px', transform: 'translateX(-50%)', borderRadius: '999px', background: 'rgba(0,0,0,0.55)', filter: 'blur(4px)' }} />
        <span style={{ position: 'absolute', left: '50%', top: '78%', width: '58%', height: '5px', transform: 'translateX(-50%)', borderRadius: '99px', background: accent, opacity: 0.85 }} />
      </span>
    );
  }

  if (style === 'ugc') {
    return (
      <span style={box({ background: 'linear-gradient(160deg,#241E1A,#0C0D12)' })}>
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

  return (
    <span style={box({ background: 'linear-gradient(165deg,#0B1220,#07080D)' })}>
      <span style={{ position: 'absolute', inset: 0, background: 'radial-gradient(75% 55% at 26% 22%,#4E9BFF44,rgba(0,0,0,0) 68%)' }} />
      <span style={{ position: 'absolute', inset: 0, background: `radial-gradient(65% 50% at 78% 82%,${accent}3D,rgba(0,0,0,0) 66%)` }} />
      <span style={{ position: 'absolute', left: '16%', right: '16%', top: '38%', height: '2px', background: 'linear-gradient(90deg,rgba(255,255,255,0),#4E9BFF,rgba(255,255,255,0))' }} />
      <span style={{ position: 'absolute', left: '24%', right: '24%', top: '52%', height: '1px', background: `linear-gradient(90deg,rgba(255,255,255,0),${accent},rgba(255,255,255,0))` }} />
      <span style={{ position: 'absolute', left: '50%', top: '62%', width: '44%', height: '10px', transform: 'translateX(-50%)', borderRadius: '4px', background: `linear-gradient(90deg,#4E9BFF,${accent})`, opacity: 0.9 }} />
    </span>
  );
}

export default function ExecutiveAIAssistantView({
  workspaceId,
  workspaceName = 'Perusahaan Anda',
  userName = 'Nime Nimasi',
  portalRole = 'CEO',
  onRoleChange,
  onOpenWorkspace,
  onOpenSchedule,
  onOpenInventory,
}: ExecutiveAIAssistantViewProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    const initialPrompt = consumeInitialPrompt('CEO');
    if (initialPrompt) setInputMessage(initialPrompt);
  }, []);

  const [isTyping, setIsTyping] = useState(false);
  // Gap kemampuan-001 (audit 7 Sep): id actionCard yang sedang dieksekusi ke backend
  // nyata (POST /api/v1/brain/execute) -- dipakai untuk disable tombol supaya tidak
  // double-submit sambil menunggu, BUKAN state UI kosmetik.
  const [executingCardTitle, setExecutingCardTitle] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // T3 (8 Sep 2026): + workspaceFileId?: string; workspaceFileIds?: string[] -- diisi SETELAH lampiran ini
  // berhasil dipersist ke Pusat Data (POST /api/v1/workspace-files) di dalam
  // handleFileSelect. Ikut terkirim ke brain/chat karena `attachment: currentAttachment`
  // di handleSendMessage men-spread SELURUH object ini apa adanya (tidak perlu
  // diubah titik pengirimannya).
  const [attachedFiles, setAttachedFiles] = useState<Record<string, { name: string; size: string; content?: string; imageBase64?: string; mimeType?: string; documentCheck?: DocumentCheckReport | TabularCheckReport; workspaceFileId?: string; workspaceFileIds?: string[] } | null>>({});
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [pluginOpen, setPluginOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState('chat-current');
  const attachedFile = attachedFiles[activeChatId] || null;
  const setAttachedFile = (file: { name: string; size: string; content?: string; imageBase64?: string; mimeType?: string; documentCheck?: DocumentCheckReport | TabularCheckReport; workspaceFileId?: string; workspaceFileIds?: string[] } | null, chatId = activeChatId) => setAttachedFiles(previous => ({ ...previous, [chatId]: file }));
  const attachmentReads = useRef(new Map<string, string>());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [dataHubOpen, setDataHubOpen] = useState(false);
  const [storagePickerOpen, setStoragePickerOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  // V4d (8 Sep 2026) -- jembatan dari tombol "Buka Pusat Data" di alert dashboard
  // CompanyDataDashboard.tsx (satu-satunya tempat komponen itu dipasang, lihat page.tsx
  // -- selalu bermuara ke portal CEO/ExecutiveAIAssistantView, tidak pernah ke Marketing/
  // Finance). String event ini KONTRAK dengan lane dashboard -- JANGAN ganti nama sepihak.
  useEffect(() => {
    const openHub = () => setDataHubOpen(true);
    window.addEventListener('klir-open-data-hub', openHub);
    // 8 Sep (temuan verifikator KRITIS): kalau tombol dashboard diklik SEBELUM view ini ter-mount,
    // event di atas hilang -- baca flag yang ditulis CompanyDataDashboard, lalu bersihkan.
    try {
      if (localStorage.getItem('klir_pending_open_data_hub') === '1') {
        localStorage.removeItem('klir_pending_open_data_hub');
        setDataHubOpen(true);
      }
    } catch { /* abaikan */ }
    return () => window.removeEventListener('klir-open-data-hub', openHub);
  }, []);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  // RBAC admin panel state -- 'private' (default) lets the admin toggle each
  // tool per division below; 'public' matches the mockup's "Uji coba publik"
  // mode where every capability is force-open for every role and the toggles
  // go read-only. Both are pure client-side state (no backend yet -- the real
  // access scheme still needs to come from Fatur, see roadmap 4 Sep butir 2),
  // same tier as the other localStorage-free UI-only state in this file.
  const [accessMode, setAccessMode] = useState<'public' | 'private'>('private');
  const [adminOverrides, setAdminOverrides] = useState<Record<string, boolean>>({});
  const toggleAdminCap = (division: string, toolId: string) => {
    const key = `${division}|${toolId}`;
    setAdminOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };
  const [skillName, setSkillName] = useState('');
  const [skillInstruction, setSkillInstruction] = useState('');
  // 8 Sep 2026 (temuan F4 audit): dulu state ini murni in-memory (nol localStorage,
  // nol endpoint) walau toast saveCustomSkill() bilang "disimpan" dan sidebar menyiratkan
  // shortcut ini akan tetap ada -- refresh/tutup tab menghapus semuanya balik ke 2 seed
  // default. Inisialisasi dari localStorage sekarang, ditulis balik lewat useEffect
  // seperti pola `chats` di file yang sama (baris ~962-987) -- masih localStorage per
  // browser (belum server-side), tapi minimal klaim "disimpan" jadi benar untuk 1 browser.
  const customSkillsStorageKey = `klir_ai_skills_exec_${workspaceId || 'default'}`;
  const [customSkills, setCustomSkills] = useState<{ id: string; name: string; instruction: string }[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`klir_ai_skills_exec_${workspaceId || 'default'}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) {}
    }
    return [
      { id: 'sk-1', name: 'Rapat Senin', instruction: 'Susun agenda rapat mingguan: ringkas kas dan ROAS pekan lalu, tandai tiga hambatan utama, lalu usulkan tiga keputusan yang perlu saya ambil.' },
      { id: 'sk-2', name: 'Review vendor', instruction: 'Bandingkan penawaran vendor yang masuk: harga, ruang lingkup, risiko, dan rekomendasi pilihan dengan alasannya.' },
    ];
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(customSkillsStorageKey, JSON.stringify(customSkills));
      } catch (e) {}
    }
  }, [customSkills, customSkillsStorageKey]);
  // Collapsible-section + data-panel visibility, remembered per browser like the
  // other local-only UI prefs in this file (mediaMap, pluginEnabled). Default is
  // always `true` during the initial render (server AND client) -- the actual
  // localStorage value is only applied AFTER mount, inside useEffect below, same
  // pattern as readLiveStats() elsewhere in this file. Reading localStorage
  // straight from a useState initializer would run during SSR too (where there
  // is no localStorage) and desync from the client's real stored value the
  // moment a viewer had ever toggled one of these, breaking hydration.
  const [showToolsNav, setShowToolsNav] = useState(true);
  const [showActionsNav, setShowActionsNav] = useState(true);
  // 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): panel "Ringkasan perusahaan
  // Anda" DEFAULT TERSEMBUNYI sekarang (dulu useState(true)) -- Mecca minta data mentah
  // tidak langsung memenuhi layar begitu buka AI Assistant. Logika localStorage DIBALIK
  // juga: dulu key '0' berarti "sembunyikan" (nilai eksplisit menyembunyikan dari default
  // tampil); sekarang key '1' berarti "tampilkan" (nilai eksplisit menampilkan dari default
  // sembunyi) -- kalau tidak dibalik, viewer lama yang belum pernah klik toggle akan
  // otomatis lolos default lama (localStorage kosong -> tetap true) dan tidak pernah
  // merasakan default baru ini.
  const [showData, setShowData] = useState(false);
  // showCaps (grid "Semua kemampuan AI") DIHAPUS -- grid itu sendiri dihapus dari area
  // utama (11 Sep 2026, kontrak B4), isinya dipindah ke sidebar "Kemampuan & tools AI"
  // (lihat capGroups di render sidebar). State toggle + localStorage key
  // 'klir_ai_show_caps' jadi yatim tanpa grid untuk ditoggle -- dihapus bersih, bukan
  // dibiarkan mati supaya tsc tidak menyisakan variabel tak terpakai.
  useEffect(() => {
    try {
      if (localStorage.getItem('klir_ai_nav_tools') === '0') setShowToolsNav(false);
      if (localStorage.getItem('klir_ai_nav_actions') === '0') setShowActionsNav(false);
      if (localStorage.getItem('klir_ai_show_data') === '1') setShowData(true);
    } catch (e) {
      /* storage blocked */
    }
  }, []);
  const toggleBoolPref = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    setter((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch (e) {
        /* storage blocked */
      }
      return next;
    });
  };
  const [liveStats, setLiveStats] = useState<any>({});
  const [pluginEnabled, setPluginEnabled] = useState<Record<string, boolean>>({
    pdf: true,
    excel: true,
    word: true,
    image: true,
    audio: true,
  });
  // 8 Sep 2026 (temuan F3 audit): dulu state ini murni in-memory walau footer sidebar
  // (baris ~3627 versi lama) mengklaim "File tetap tersimpan meskipun percakapan ditutup"
  // -- refresh browser mengosongkannya ke 0. Sekarang di-persist ke localStorage per
  // workspace, pola identik `chats` di file ini (useState lazy-init + useEffect sync).
  // CATATAN: fileBase64 bisa besar -- risiko kuota localStorage penuh untuk sesi dengan
  // banyak file besar (belum ada guard kuota, di luar cakupan fix surgical ini).
  const generatedFilesStorageKey = `klir_ai_files_exec_${workspaceId || 'default'}`;
  const [generatedFiles, setGeneratedFiles] = useState<{ id: string; name: string; createdAt: number; content?: string; mimeType?: string; fileBase64?: string }[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`klir_ai_files_exec_${workspaceId || 'default'}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {}
    }
    return [];
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(generatedFilesStorageKey, JSON.stringify(generatedFiles));
      } catch (e) {
        // Kemungkinan kuota localStorage penuh (fileBase64 besar) -- gagal diam sesuai
        // pola try/catch lain di file ini, tapi TIDAK melempar error ke UI.
      }
    }
  }, [generatedFiles, generatedFilesStorageKey]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Per-message state for generated image/video previews (style pick, scene step,
  // variant count, play/mute) — keyed by message id, separate from chat history so
  // switching an image's style doesn't rewrite the stored AI response text.
  const [mediaMap, setMediaMap] = useState<Record<string, { style?: string; scene?: number; variant?: number; playing?: boolean; muted?: boolean }>>({});
  const sceneTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const storageKey = `klir_ai_chats_exec_${workspaceId || 'default'}_${portalRole}`;

  const [chats, setChats] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
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
        id: 'chat-current',
        updatedAt: Date.now(),
        messages: [
          {
            id: 'msg-welcome',
            sender: 'ai',
            text: `Halo Pak **${userName}**! Saya adalah **KLIR Executive AI Assistant**.\n\nSaya memiliki akses membaca langsung **seluruh data riil perusahaan Anda** (Keuangan & Kas, Metrik Pemasaran/Iklan, Beban Tim/SDM, serta Piutang Klien). Setiap angka yang saya sebut selalu disertai penanda sumbernya, seperti ini [[src:finance]].\n\nAnda dapat menanyakan analisis data, meminta draf penulisan bisnis, mengunggah dokumen data/CSV untuk dibaca, atau memberikan instruksi langsung ke sistem. Ada yang bisa saya bantu?`,
            timestamp: 'Hari ini 08:30',
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
        console.warn('Gagal menyimpan riwayat chat:', e);
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

  const readLiveStats = () => {
    try {
      const saved = localStorage.getItem('klir_live_company_state');
      if (saved) setLiveStats(sanitizeLiveCompanyState(JSON.parse(saved)));
    } catch (e) {
      /* dashboard state not present */
    }
  };

  // FIX (8 Sep malam, audit integrasi 3-portal) -- klir_live_company_state.financials/
  // marketing TIDAK PUNYA penulis manapun lagi (dikonfirmasi grep seluruh src/), jadi
  // "Kas bersih"/"Blended ROAS" di panel ini permanen kosong walau data asli ada di
  // database (pola sama yang dibetulkan di FinanceAIAssistantView.tsx/
  // MarketingAIAssistantView.tsx sesi ini). Fetch LANGSUNG 3 endpoint yang sama dipakai
  // dashboard CEO (kas/transactions, kas/financial-health, marketing/campaigns) lalu
  // tulis balik ke localStorage supaya konsisten sama cache yang dibaca panel lain.
  // Formula blendedRoas (spend-weighted, kampanye ACTIVE) identik dengan yang dipakai
  // di MarketingAIAssistantView.tsx -- keputusan lane Claude, belum dikonfirmasi Fatur/
  // Mecca sebagai definisi resmi.
  const loadRealCompanyStats = async () => {
    try {
      const [txRes, healthRes, campRes, ctxRes] = await Promise.all([
        fetch('/api/v1/kas/transactions', { credentials: 'include' }),
        fetch('/api/v1/kas/financial-health', { credentials: 'include' }),
        fetch('/api/v1/marketing/campaigns', { credentials: 'include' }),
        fetch('/api/v1/brain/context', { credentials: 'include' }),
      ]);
      const financialsPatch: any = {};
      let healthPatch: any = null;
      const marketingPatch: any = {};
      if (txRes.ok) {
        const txData = await txRes.json();
        financialsPatch.netCashBalance = txData.summary?.netCashBalance ?? 0;
      }
      if (healthRes.ok) {
        const hData = await healthRes.json();
        if (hData.health) {
          healthPatch = {
            totalScore: hData.health.totalScore ?? 0,
            grade: hData.health.grade ?? 'WAITING',
            breakdown: { finance: hData.health.totalScore ?? 0, growth: null, operations: null, strategy: null },
          };
        }
      }
      // FIX (sesi ini): runwayMonths TIDAK PERNAH ada di kedua endpoint di atas --
      // widget "Runway kas" sidebar ini permanen nampilin fallback 99/"24 bulan+ aman"
      // ntah gimanapun kondisi asli perusahaan (CompanyDataDashboard.tsx punya angka
      // yang BENAR karena fetch endpoint ini). /api/v1/brain/context = single source
      // of truth yang sama dipakai dashboard Fatur, jadi dipakai di sini juga supaya
      // runway + breakdown skor kesehatan konsisten lintas portal, bukan diam-diam
      // beda karena satu sisi lupa fetch field-nya.
      if (ctxRes.ok) {
        const ctxData = await ctxRes.json();
        const snap = ctxData?.data;
        if (snap?.financials) {
          financialsPatch.runwayMonths = snap.financials.runwayMonths;
        }
        if (snap?.healthScore) {
          healthPatch = {
            totalScore: snap.healthScore.totalScore ?? 0,
            grade: snap.healthScore.grade ?? 'WAITING',
            breakdown: {
              finance: snap.healthScore.breakdown?.financeScore ?? 0,
              growth: snap.healthScore.breakdown?.growthScore ?? 0,
              operations: snap.healthScore.breakdown?.opsScore ?? 0,
              strategy: snap.healthScore.breakdown?.strategyScore ?? 0,
            },
          };
        }
      }
      if (campRes.ok) {
        const campData = await campRes.json();
        const rows: any[] = Array.isArray(campData.campaigns) ? campData.campaigns : [];
        const active = rows.filter((c) => c.status === 'ACTIVE');
        const totalBudget = active.reduce((a, c) => a + (Number(c.dailyBudget) || 0), 0);
        const blendedRoas = totalBudget > 0
          ? active.reduce((a, c) => a + (parseFloat(c.roas) || 0) * (Number(c.dailyBudget) || 0), 0) / totalBudget
          : 0;
        marketingPatch.blendedRoas = Math.round(blendedRoas * 100) / 100;
        marketingPatch.adSpendBudget = totalBudget;
        marketingPatch.activeCampaignsCount = active.length;
      }
      if (Object.keys(financialsPatch).length === 0 && !healthPatch && Object.keys(marketingPatch).length === 0) return;
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
        setLiveStats(updated);
      } catch (e) {
        setLiveStats((prev: any) => {
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
      console.warn('Executive AI panel: gagal fetch data perusahaan live', e);
    }
  };

  useEffect(() => {
    const refresh = () => { readLiveStats(); loadRealCompanyStats(); };
    readLiveStats();
    loadRealCompanyStats();
    window.addEventListener('klir-ai-state-updated', refresh);
    window.addEventListener('klir-kas-updated', refresh);
    return () => {
      window.removeEventListener('klir-ai-state-updated', refresh);
      window.removeEventListener('klir-kas-updated', refresh);
    };
  }, []);

  // 8 Sep 2026 (temuan F2 audit): dulu pilihan Tab "AI Brain" di Pengaturan CEO
  // (model & gaya komunikasi) TIDAK PERNAH dibaca lagi setelah tersimpan ke
  // localStorage -- request chat selalu hardcode model:'opencode' dan tidak
  // pernah kirim tone sama sekali, walau server (brain/chat/route.ts baris
  // 553,563-564) sudah siap menerima keduanya. Dibaca di sini + didengarkan
  // event 'klir-settings-updated' (didispatch CEOSettingsModal.handleSave)
  // supaya pilihan baru langsung berlaku tanpa perlu reload halaman.
  //
  // CATATAN JUJUR mapping tidak 1:1 -- dua kosakata berbeda yang harus disatukan:
  // 1. aiModel: CEOSettingsModal punya 3 opsi (deepseek/gemini/fast=Groq Llama 3.3),
  //    server body.model cuma kenal 3 nilai ('deep'->deepseek r1, 'fast'->gemini-2.5-
  //    flash, default->deepseek-chat, lihat brain/chat/route.ts baris 1535) -- TIDAK
  //    ADA jalur Groq sama sekali di server manapun. Pilihan "Groq Llama 3.3" di
  //    Tab AI Brain karena itu TETAP tidak bisa benar-benar dipenuhi -- dipetakan ke
  //    default (deepseek-chat) sebagai fallback paling aman, BUKAN Groq sungguhan.
  //    Ini gap baru yang ditemukan saat wiring, dilaporkan apa adanya, bukan diklaim
  //    beres.
  // 2. aiTone: CEOSettingsModal punya 3 opsi persona (consultant/concise/partner),
  //    tone-presets.ts (dipakai getToneInstruction di server) isinya 5 preset FORMAT
  //    (gen-z-casual/clean-formal-ascii/flowing-prose-external/professional-warm/
  //    anti-ai-natural) -- dua daftar berbeda konsep (persona vs format), tidak ada
  //    ID yang sama persis. Dipetakan ke padanan makna paling dekat di bawah ini
  //    (bukan terjemahan tepat) supaya minimal ADA efek, bukan nol efek seperti
  //    sebelumnya.
  const [ceoAiSettings, setCeoAiSettings] = useState<{ aiModel: string; aiTone: string }>({ aiModel: 'deepseek', aiTone: 'consultant' });
  const readCeoAiSettings = () => {
    try {
      const saved = localStorage.getItem(`klir_settings_ceo_${workspaceId || 'default'}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCeoAiSettings({
          aiModel: parsed.aiModel || 'deepseek',
          aiTone: parsed.aiTone || 'consultant',
        });
      }
    } catch (e) {
      /* pengaturan CEO belum pernah disimpan di browser ini */
    }
  };
  useEffect(() => {
    readCeoAiSettings();
    window.addEventListener('klir-settings-updated', readCeoAiSettings);
    return () => window.removeEventListener('klir-settings-updated', readCeoAiSettings);
  }, [workspaceId]);
  const resolveChatModelParam = (aiModel: string): string => {
    if (aiModel === 'deepseek') return 'deep';
    if (aiModel === 'gemini') return 'gemini';
    return 'fast';
  };
  const resolveChatToneParam = (aiTone: string): string => {
    if (aiTone === 'consultant') return 'professional-warm';
    if (aiTone === 'concise') return 'clean-formal-ascii';
    return 'gen-z-casual'; // aiTone === 'partner'
  };

  // ===== SETELAN JAWABAN + COMPOSER TOOLBAR (8 Sep 2026, B5-wiring-3-view) =====
  // ComposerPrefs per-workspace, dibaca/ditulis lewat chat-composer-prefs.ts (B1).
  // ComposerToolbar (B2) adalah adapter murni -- TIDAK menulis localStorage sendiri,
  // controlled prop, jadi persist terjadi DI SINI di titik onPrefsChange.
  const [composerPrefs, setComposerPrefs] = useState<ComposerPrefs>(DEFAULT_COMPOSER_PREFS);
  useEffect(() => {
    setComposerPrefs(readComposerPrefs(workspaceId || 'default'));
  }, [workspaceId]);
  // Ref ke toolbar untuk navigasi keyboard menu slash (panah/Enter/Esc) dari input composer.
  const composerToolbarRef = useRef<ComposerToolbarHandle>(null);
  // 8 Sep malam (feedback Mecca: composer kayak AI umum) -- textarea auto-tinggi,
  // Enter kirim / Shift+Enter baris baru (lihat komentar di use-autogrow-textarea.ts).
  const composerTextareaRef = useAutoGrowTextarea(inputMessage);
  const handleComposerPrefsChange = (next: ComposerPrefs) => {
    setComposerPrefs(next);
    writeComposerPrefs(workspaceId || 'default', next);
  };

  // Preferensi cara AI menjawab (feedback Mecca poin 6 -- belajar dari histori chat +
  // feedback eksplisit AnswerFeedbackBar). reader-preferences.ts (B4) MURNI logic,
  // sengaja TIDAK menyediakan baca/tulis localStorage sendiri -- 2 helper kecil di
  // bawah ini bagian dari tugas wiring (B5), kunci 'klir_reader_prefs_<workspaceId>'
  // persis sesuai keputusan D-6 spesifikasi.
  const readReaderPrefs = (): ReaderPreferences => {
    try {
      if (typeof window === 'undefined') return DEFAULT_READER_PREFERENCES;
      const raw = localStorage.getItem(`klir_reader_prefs_${workspaceId || 'default'}`);
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
      localStorage.setItem(`klir_reader_prefs_${workspaceId || 'default'}`, JSON.stringify(prefs));
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
    // 8 Sep 2026 sore (smoke browser komando): teks perintah "/ppt ..." harus DIBUANG dari
    // input setelah dipilih -- kalau tidak, "/" tertinggal dan brief yang terkirim jadi "/ppt".
    const slashBrief = inputMessage.replace(/^\/\S*\s*/, '').trim();
    setInputMessage(slashBrief);
    if (command.kind === 'mode') {
      const mode = command.payload.mode as ComposerMode;
      handleComposerPrefsChange({ ...composerPrefs, mode });
      return;
    }
    if (command.kind === 'setting') {
      // 11 Sep 2026 (kontrak modul 7, B6 slash '/template'): payload.templatePicker
      // menandakan command ini SPESIFIK '/template', beda dari setting umum (mic/model)
      // di bawah -- kirim pesan pemicu daftar template (template-picker.ts milik B6
      // mendeteksi frasa ini sebagai intent 'list', balas markdown deterministik nol-LLM,
      // lihat detectTemplateIntent di route.ts B2). Dicek dulu SEBELUM payload.disabled
      // karena command '/template' tidak mengisi field disabled sama sekali (bukan bagian
      // dari union command setting lama itu).
      if (command.payload.templatePicker) {
        void handleSendMessage('template apa saja yang tersedia');
        return;
      }
      if (command.payload.disabled) {
        showToast(String(command.payload.reason || 'Fitur ini belum tersedia.'), 2500);
        return;
      }
      // ComposerToolbar (B2) memegang sendiri state buka/tutup panel Setelan/mic --
      // tidak ada method yang diekspos lewat ref/props untuk membukanya dari luar
      // (ComposerToolbarHandle cuma expose handleSlashKeyDown). Degradasi jujur:
      // arahkan user klik tombolnya manual, jangan pura-pura command ini "jalan".
      showToast('Klik tombol "Setelan jawaban" atau ikon mic di composer untuk mengaturnya.', 2500);
      return;
    }
    // command.kind === 'nextAction'
    const templateId = typeof command.payload.templateId === 'string' ? command.payload.templateId : undefined;
    if (templateId) {
      // '/deck' -- 2 arsitektur pitch deck belum disatukan (keputusan D-13), dibuka
      // lewat tab "Template Dokumen" Studio existing yang sama dipakai /ppt /word
      // /excel -- user tinggal pilih template di sana (termasuk 'pitch-investor-ringkas').
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

  const getMediaState = (id: string) => mediaMap[id] || {};

  const setMediaState = (
    id: string,
    patch: Partial<{ style: string; scene: number; variant: number; playing: boolean; muted: boolean }>
  ) => {
    setMediaMap((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), ...patch } }));
  };

  const advanceScene = (id: string, total: number) => {
    setMediaState(id, { playing: true });
    if (sceneTimersRef.current[id]) clearInterval(sceneTimersRef.current[id]);
    sceneTimersRef.current[id] = setInterval(() => {
      setMediaMap((prev) => {
        const st = prev[id] || {};
        if (!st.playing) {
          clearInterval(sceneTimersRef.current[id]);
          return prev;
        }
        const next = ((st.scene || 0) + 1) % total;
        return { ...prev, [id]: { ...st, scene: next } };
      });
    }, 1400);
  };

  const stopScenes = (id: string) => {
    setMediaState(id, { playing: false });
    if (sceneTimersRef.current[id]) clearInterval(sceneTimersRef.current[id]);
  };

  const varyImage = (id: string, media: GeneratedMedia) => {
    const cur = getMediaState(id).style || media.style || 'glass';
    const idx = IMAGE_STYLE_LIST.findIndex((x) => x.key === cur);
    const nextStyle = IMAGE_STYLE_LIST[(idx + 1) % IMAGE_STYLE_LIST.length].key;
    setMediaState(id, { style: nextStyle, variant: ((getMediaState(id).variant || 0) + 1) % 4 });
    // 8 Sep 2026 (temuan F1): dulu toast bilang "Variasi baru dibuat" seolah AI benar-benar
    // me-render ulang gambar -- padahal ini cuma ganti preset gaya CSS pratinjau lokal, tidak
    // ada request generate apapun ke server. Toast diubah jujur.
    showToast(`Tampilan pratinjau diganti ke gaya ${IMAGE_STYLE_LIST[(idx + 1) % IMAGE_STYLE_LIST.length].label} (bukan render ulang AI).`, 2600);
  };

  useEffect(() => {
    return () => {
      Object.values(sceneTimersRef.current).forEach((t) => clearInterval(t));
    };
  }, []);

  const showToast = (msg: string, ms = 4000) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), ms);
  };

  // Skill kustom: nama+instruksi disimpan sebagai state lokal murni (belum ada
  // penyimpanan di server) -- "Jalankan" memanggil handleSendMessage sungguhan,
  // bukan simulasi, jadi shortcut ini benar-benar mengeksekusi instruksinya.
  const saveCustomSkill = () => {
    const name = skillName.trim();
    const instruction = skillInstruction.trim();
    if (!name || !instruction) {
      showToast('Isi nama shortcut dan instruksinya dulu.', 3000);
      return;
    }
    setCustomSkills((prev) => [{ id: `sk-${Date.now()}`, name, instruction }, ...prev]);
    setSkillName('');
    setSkillInstruction('');
    showToast(`Skill "${name}" disimpan. Sekarang bisa dipanggil dari menu samping.`, 3600);
  };

  const deleteCustomSkill = (id: string) => {
    setCustomSkills((prev) => prev.filter((sk) => sk.id !== id));
  };

  const handleCopyText = (text: string, id: string) => {
    const cleanText = String(text)
      .replace(/\[\[src:[a-zA-Z]+\]\]/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/^>\s*/gm, '');
    if (navigator.clipboard) navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fileKind = (name: string) => {
    const ext = String(name || '').split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'doc') return { label: 'Dokumen Word', icon: <FileText size={17} color="#4E9BFF" strokeWidth={1.6} />, tone: '#4E9BFF' };
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return { label: 'Spreadsheet Excel', icon: <FileSpreadsheet size={17} color="#3FBF8F" strokeWidth={1.6} />, tone: '#3FBF8F' };
    if (ext === 'pptx' || ext === 'ppt') return { label: 'Presentasi', icon: <Presentation size={17} color="#C9A66B" strokeWidth={1.6} />, tone: '#C9A66B' };
    if (ext === 'pdf') return { label: 'Dokumen PDF', icon: <FileText size={17} color="#4E9BFF" strokeWidth={1.6} />, tone: '#4E9BFF' };
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return { label: 'Gambar', icon: <ImageIcon size={17} color="#C9A66B" strokeWidth={1.6} />, tone: '#C9A66B' };
    if (ext === 'txt' || ext === 'md') return { label: 'Storyboard & Naskah', icon: <Video size={17} color="#C9A66B" strokeWidth={1.6} />, tone: '#C9A66B' };
    return { label: 'Dokumen', icon: <FileText size={17} color="#8A93A3" strokeWidth={1.6} />, tone: '#8A93A3' };
  };

  const fileBadge = (name: string, size = 38) => {
    const kind = fileKind(name);
    return (
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${size}px`,
          height: `${size}px`,
          flexShrink: 0,
          borderRadius: '11px',
          background: `${kind.tone}1F`,
          border: `1px solid ${kind.tone}33`,
          color: kind.tone,
        }}
      >
        {kind.icon}
      </span>
    );
  };

  const relTime = (ts: number) => {
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return 'Baru saja';
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Kemarin';
    if (days < 7) return `${days} hari lalu`;
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? 'Pekan lalu' : `${weeks} pekan lalu`;
  };

  const downloadFile = (f: { name: string; content?: string; mimeType?: string; fileBase64?: string }) => {
    try {
      let blob: Blob;
      if (f.fileBase64) {
        // File ASLI dari server (base64 biner) -- decode ke bytes sesungguhnya,
        // JANGAN dibungkus sebagai text/plain, itu yang bikin file rusak saat dibuka.
        const byteChars = atob(f.fileBase64);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        blob = new Blob([new Uint8Array(byteNumbers)], { type: f.mimeType || 'application/octet-stream' });
      } else {
        blob = new Blob([f.content || ''], { type: 'text/plain;charset=utf-8' });
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = f.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast(`File "${f.name}" diunduh ulang.`, 3000);
    } catch (e) {
      showToast('Gagal mengunduh file. Coba lagi.', 3000);
    }
  };

  // Daftarkan file HANYA kalau backend beneran membuat file asli (data.generated
  // dari /api/v1/brain/chat) -- sebelumnya fungsi ini menebak jenis file dari kata
  // kunci pesan user lalu menyimpan teks balasan AI diberi nama .docx/.xlsx/.pptx,
  // hasilnya file rusak saat diunduh & dibuka karena isinya cuma teks polos.
  const registerRealGeneratedFile = (gen: { fileName: string; mimeType: string; fileBase64: string; type: string }) => {
    const rec = { id: `file-${Date.now()}`, name: gen.fileName, createdAt: Date.now(), mimeType: gen.mimeType, fileBase64: gen.fileBase64 };
    setGeneratedFiles((prev) => [rec, ...prev].slice(0, 14));
  };

  // Target penjualan adalah insight bisnis yang dipakai lintas permukaan: AI
  // menghitungnya, dashboard CEO menampilkan statusnya. Simpan hanya ketika
  // prompt berisi target + realisasi yang bisa dihitung; prompt umum tidak boleh
  // membuat angka target baru atau menggantikan data transaksi resmi.
  const persistSalesTargetAnalysis = (prompt: string) => {
    if (!detectSalesTargetIntent(prompt)) return;
    const analysis = analyzeSalesTarget(prompt);
    if (!analysis || typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem('klir_live_company_state');
      const current = sanitizeLiveCompanyState(saved ? JSON.parse(saved) : {}) || {};
      const updated = {
        ...current,
        salesTarget: {
          ...analysis,
          capturedAt: new Date().toISOString(),
          source: 'AI Assistant',
        },
      };
      localStorage.setItem('klir_live_company_state', JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
    } catch (e) {
      console.warn('Gagal menyimpan analisis target penjualan ke dashboard:', e);
    }
  };

  // T1 (8 Sep 2026): cap wajar per pesan chat -- lebih dari ini toh akan
  // terpotong duluan oleh MAX_ATTACH_CHARS di bawah (angka sama dengan cap
  // server documents/extract-text/route.ts), jadi tidak ada gunanya lebih besar.
  const MAX_ATTACH_FILES = 6;
  const MAX_ATTACH_CHARS = 32000;

  // T1+T3 (8 Sep 2026): dirombak dari 1-file jadi multi-file. Per file tetap
  // memakai alur ekstraksi LAMA PERSIS (branch teks lokal vs extract-text
  // binary/OCR) -- yang baru cuma: (a) loop atas beberapa file, digabung jadi
  // SATU attachedFile dengan header "=== [i/N] nama ===" (format SAMA dengan
  // extractZipText server, konsisten satu bahasa sistem), cap TOTAL 32000
  // char; (b) gambar PERTAMA saja yang dikirim sbg field vision (imageBase64),
  // brain/chat cuma terima 1 gambar -- gambar berikutnya tetap diekstrak
  // (OCR) dan masuk sbg teks di blok gabungan, BUKAN dibuang; (c) T3: setiap
  // file yang berhasil diekstrak di-AWAIT-persist ke Pusat Data lewat endpoint
  // yang SAMA (POST /api/v1/workspace-files, preExtractedContent = teks
  // mentah supaya server TIDAK mengekstrak ulang) -- fileId yang disimpan
  // HANYA dari file PERTAMA yang sukses (kartu verdict 1 fileId per pesan,
  // keputusan eksplisit, bukan gap diam-diam).
  const processFileList = async (filesToProcess: File[]) => {
    if (!filesToProcess || filesToProcess.length === 0) return;
    const chatId = activeChatId;
    const requestId = crypto.randomUUID();
    attachmentReads.current.set(chatId, requestId);
    const isCurrentRead = () => attachmentReads.current.get(chatId) === requestId;
    const allFiles = Array.from(filesToProcess);
    const files = allFiles.slice(0, MAX_ATTACH_FILES);
    if (allFiles.length > files.length) {
      showToast(`Hanya ${MAX_ATTACH_FILES} file pertama yang dipakai (dari ${allFiles.length} dipilih).`, 4000);
    }

    setIsReadingFile(true);
    showToast(
      files.length > 1 ? `Membaca dan mengekstrak ${files.length} file...` : `Membaca dan mengekstrak isi "${files[0].name}"...`,
      60000
    );

    type Piece = { file: File; text: string; rawText: string; ok: boolean; via: 'text' | 'binary'; isImage: boolean };
    const pieces: Piece[] = [];
    let firstImageBase64: string | undefined;
    let firstImageMimeType: string | undefined;
    const targetWorkspaceId = workspaceId || getActiveClientWorkspaceId() || undefined;

    try {
      for (const file of files) {
        const isTextLike = file.type.includes('text') || /\.(txt|csv|json|md|log|tsv)$/i.test(file.name);
        const isImage = file.type.startsWith('image/');

        if (isTextLike) {
          try {
            const text = await file.text();
            pieces.push({ file, text, rawText: text, ok: true, via: 'text', isImage: false });
          } catch {
            pieces.push({ file, text: '', rawText: '', ok: false, via: 'text', isImage: false });
          }
          continue;
        }

        if (isImage && !firstImageBase64) {
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result as string);
              r.onerror = () => reject(new Error('gagal baca gambar'));
              r.readAsDataURL(file);
            });
            const match = dataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
            if (match) {
              firstImageMimeType = match[1];
              firstImageBase64 = match[2];
            }
          } catch { /* non-fatal, tetap lanjut coba OCR di bawah */ }
        }

        try {
          const formData = new FormData();
          formData.append('file', file);
          const headers = getClientAuthHeaders({}, targetWorkspaceId);
          const res = await fetch('/api/v1/documents/extract-text', {
            method: 'POST',
            credentials: 'include',
            headers,
            body: formData,
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json?.success && json?.content) {
            const rawText = typeof json.rawContent === 'string' && json.rawContent ? json.rawContent : json.content;
            pieces.push({ file, text: json.content, rawText, ok: true, via: 'binary', isImage });
          } else {
            pieces.push({ file, text: '', rawText: '', ok: false, via: 'binary', isImage });
          }
        } catch {
          pieces.push({ file, text: '', rawText: '', ok: false, via: 'binary', isImage });
        }
      }

      if (!isCurrentRead()) return;

      const combined = pieces
        .map((p, i) => `=== [${i + 1}/${pieces.length}] ${p.file.name} ===\n${p.text || '(gagal diekstrak)'}`)
        .join('\n\n')
        .slice(0, MAX_ATTACH_CHARS);
      const combinedName = files.length === 1 ? files[0].name : `${files.length} file: ${files.map((f) => f.name).join(', ')}`;
      const combinedSize = `${(files.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(1)} KB`;

      setAttachedFile({ name: combinedName, size: combinedSize, content: combined, imageBase64: firstImageBase64, mimeType: firstImageMimeType }, chatId);

      const okCount = pieces.filter((p) => p.ok).length;
      showToast(
        files.length > 1
          ? `${okCount}/${files.length} file berhasil diekstrak dan siap dianalisis.`
          : okCount > 0
            ? `Dokumen "${files[0].name}" berhasil diekstrak dan siap dianalisis.`
            : `Gagal mengekstrak teks dari "${files[0].name}".`,
        3500
      );

      let persistedFileId: string | undefined;
      const persistedFileIds: string[] = [];
      for (const p of pieces) {
        if (!p.ok || !p.rawText) continue;
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
          if (!isCurrentRead()) return;
          if (wfJson?.success && wfJson?.file?.id) {
            if (!persistedFileId) persistedFileId = wfJson.file.id;
            persistedFileIds.push(wfJson.file.id);
            window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
          }
        } catch (persistErr) {
          console.warn('[workspace-files] gagal menyimpan lampiran chat ke Pusat Data (non-fatal):', persistErr);
        }
      }
      if (persistedFileId) {
        const fid = persistedFileId;
        setAttachedFiles((previous) => {
          const current = previous[chatId];
          return { ...previous, [chatId]: current ? { ...current, workspaceFileId: fid, workspaceFileIds: persistedFileIds } : current };
        });
      }

      if (files.length === 1 && pieces[0]?.via === 'binary' && !pieces[0].isImage && pieces[0].ok) {
        const file = files[0];
        fetch('/api/v1/documents/analyze', { method: 'POST', headers: getClientAuthHeaders({}, targetWorkspaceId), body: (() => { const fd = new FormData(); fd.append('file', file); return fd; })() })
          .then((r) => r.json())
          .then((analyzeJson) => {
            if (analyzeJson?.documentCheck && isCurrentRead()) {
              setAttachedFiles((previous) => {
                const current = previous[chatId];
                return { ...previous, [chatId]: current && current.name === file.name ? { ...current, documentCheck: analyzeJson.documentCheck } : current };
              });
            }
          })
          .catch(() => {});
      }
    } catch (err) {
      showToast(`Gagal membaca lampiran (koneksi terputus).`, 5000);
    } finally {
      if (isCurrentRead()) setIsReadingFile(false);
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
        id: `dir-${Date.now()}`,
        no: existingDirectives.length + 1,
        type: directive.type,
        title: directive.title,
        impact: directive.impact,
        timestamp: 'Baru saja diinstruksikan via AI Assistant',
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
      // ExecutionEngine (directive.impact, lihat handleCardExecution) -- bukan lagi
      // klaim generik "berhasil diperbarui di Dashboard" untuk sesuatu yang belum
      // tentu benar-benar mengubah angka dashboard (statePatch kini kosong).
      showToast(directive.impact, 7000);
    } catch (e) {
      console.warn('Failed to dispatch state:', e);
    }
  };

  // FIX gap kemampuan-001 (audit 7 Sep 2026): handleCardExecution dulu TIDAK PERNAH
  // memanggil backend -- cuma menulis angka simulasi hardcode ke localStorage lewat
  // applyDirectiveToDashboard() (lihat riwayat di git blame / bukti audit). Sekarang
  // memanggil backend NYATA yang sudah ada dan terbukti menulis DB sungguhan (POST
  // /api/v1/brain/execute -> ExecutionEngine, lihat src/lib/ai-brain/execution-engine.ts
  // dan src/lib/ai-brain/action-card-execution.ts untuk pemetaan actionCard.type ->
  // actionType). Pesan yang ditampilkan (toast + log directive) adalah message ASLI
  // dari ExecutionEngine -- termasuk bagian yang jujur bilang "kenaikan anggaran iklan
  // masih perlu diterapkan manual" untuk SCALE_MARKETING, BUKAN dikarang ulang di sini.
  // Dashboard Perusahaan TIDAK LAGI ditimpa angka KPI simulasi (marketing/teamOps/
  // financials/healthScore) dari tombol ini -- statePatch dikirim kosong, cuma entri
  // log "directives" yang ditambah (fitur log itu sendiri legit, tidak pernah palsu).
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

    if (card.type === 'CONFIRM_PURGE_FINANCE') {
      handleSendMessage('[CONFIRMED_PURGE_FINANCE] Saya mengonfirmasi penghapusan seluruh data keuangan secara permanen.');
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
    } finally {
      setExecutingCardTitle(null);
    }
  };

  // KEPUTUSAN (audit demo gagal, ditambahkan 6-7 Sep 2026): getDemoReply() di
  // bawah TIDAK LAGI dipanggil otomatis saat panggilan ke /api/v1/brain/chat
  // gagal atau balasannya kosong. Sebelumnya isi karangannya (ROAS/omset/beban
  // tim/piutang fiktif, LENGKAP dengan penanda [[src:...]] yang secara visual
  // berarti "angka ini dari data nyata") dipakai sebagai fallback SENYAP dengan
  // format identik jawaban asli -- pengguna tidak bisa membedakan. Ini kandidat
  // penjelas paling kuat untuk insiden demo gagal ke calon klien pertama (angka
  // keuangan salah jauh, bertahan setelah chat di-reset).
  // Sekarang kegagalan koneksi/data kosong menampilkan getConnectionErrorReply()
  // (jujur + actionable, tanpa tag sumber palsu, tanpa actionCard) -- lihat 2
  // titik pemanggilan di handleSendMessage di bawah.
  // getDemoReply() DIPERTAHANKAN (tidak dihapus) untuk referensi/kemungkinan
  // dipakai lagi secara EKSPLISIT/manual di masa depan (bukan otomatis saat
  // gagal). CARA MEMBATALKAN fix ini: ganti balik 2 pemanggilan
  // getConnectionErrorReply() di handleSendMessage jadi getDemoReply(userPrompt,
  // currentAttachment) seperti semula.
  const getConnectionErrorReply = () => {
    return {
      text:
        'Maaf, saya sedang tidak bisa mengakses data terbaru dari server (koneksi ke otak AI gagal atau tidak mengembalikan jawaban).\n\n' +
        'Jawaban ini BUKAN berdasarkan data riil perusahaan Anda -- mohon jangan dijadikan acuan keputusan.\n\n' +
        'Silakan coba kirim pesan ini lagi dalam beberapa saat. Kalau terus gagal, hubungi admin workspace Anda.',
      actionCard: undefined as ActionCard | undefined,
    };
  };

  // Fallback offline aman: mengembalikan pesan koneksi jujur tanpa mengarang rekomendasi atau entitas fiktif.
  const getDemoReply = (_userText: string, _attachment: any) => {
    return getConnectionErrorReply();
  };

  const handleSendMessage = async (customText?: string) => {
    const targetChatId = activeChatId;
    const currentAttachment = attachedFiles[targetChatId] || null;
    const textToSend = String(customText || inputMessage || '').trim();
    if (!textToSend && !currentAttachment) return;

    const userPrompt = textToSend || (currentAttachment ? `Tolong analisis dan jelaskan isi file ini: ${currentAttachment.name}` : '');
    const userMsgId = `user-${Date.now()}`;
    const aiMsgId = `ai-${Date.now()}`;

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

    const updatedMessages = [...messages, userMsg, aiPlaceholder];
    setChats((prev) =>
      prev.map((c) => (c.id === targetChatId ? { ...c, updatedAt: Date.now(), messages: updatedMessages } : c))
    );
    setInputMessage('');
    setAttachedFile(null, targetChatId);
    setPluginOpen(false);
    setIsTyping(true);

    try {
      let liveStateObj = null;
      try {
        const saved = localStorage.getItem('klir_live_company_state');
        if (saved) liveStateObj = sanitizeLiveCompanyState(JSON.parse(saved));
      } catch (e) {}

      const history = messages.filter((m) => m.text.trim()).slice(-8).map((m) => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));

      // SETELAN JAWABAN composer (8 Sep 2026, B5) -- modelId/effort/preferences/media
      // opsional dikirim di sini. 'auto' TIDAK dikirim (undefined) -- cascade lama
      // (Groq->OpenRouter->OpenCode->Gemini) tetap jalan persis seperti sebelum fitur
      // ini ada untuk user yang belum sentuh Setelan jawaban (composerPrefs default).
      const composerModelId = composerPrefs.textModel === 'auto' ? undefined : composerPrefs.textModel;
      const composerEffort: EffortLevel = composerPrefs.effort;
      const storedReaderPrefs = readReaderPrefs();
      // Sinyal EKSPLISIT (tombol AnswerFeedbackBar) selalu menang -- inferFromHistory
      // (implisit dari pola pesan) HANYA dipakai untuk field simplicity kalau user
      // belum pernah kasih feedback eksplisit sama sekali (saran B4, disepakati B3).
      const composerPreferences: ReaderPreferences = storedReaderPrefs.signals.length > 0
        ? storedReaderPrefs
        : { ...storedReaderPrefs, simplicity: inferFromHistory(history) };
      const composerMedia = composerPrefs.mode === 'image' ? composerPrefs.image : undefined;
      // 11 Sep 2026 (kontrak modul 3+4, keluhan Mecca poin 7 "mode riset/belajar/analis"):
      // assistantMode 'riset' DISINKRONKAN otomatis di sini kalau tombol Riset composer
      // aktif (researchMode !== 'off') -- "boleh disinkronkan" per kontrak, dipilih dihitung
      // sesaat sebelum kirim (bukan ditulis balik ke composerPrefs/localStorage) supaya
      // chip Belajar/Analis yang mungkin sudah dipilih user TETAP TERSIMPAN utuh begitu
      // riset dimatikan lagi -- override ini murni untuk 1 request ini, bukan permanen.
      const effectiveAssistantMode = composerPrefs.researchMode && composerPrefs.researchMode !== 'off' ? 'riset' : composerPrefs.assistantMode;

      // Keputusan D-7: guard gagal-jujur untuk semua tingkat upaya (bukan hanya
      // maksimal) -- 45 detik untuk santai/normal/serius, 120 detik untuk maksimal
      // (LLM reasoning tinggi genuinely bisa lebih lama, bukan hang tanpa batas).
      const requestController = new AbortController();
      const requestTimeoutMs = composerEffort === 'maksimal' ? 180_000 : 90_000 /* 8 Sep sore: 45s memutus cascade Groq->OR->OpenCode yang sah */;
      const requestTimeoutId = setTimeout(() => requestController.abort(), requestTimeoutMs);

      let res: Response;
      try {
        res = await fetch('/api/v1/brain/chat', {
          method: 'POST',
          credentials: 'include',
          headers: getClientAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            workspaceId,
            message: userPrompt,
            userName,
            userRole: 'CEO',
            workspaceName,
            // 8 Sep 2026 (temuan F2): dulu hardcode 'opencode' terlepas apapun pilihan
            // Tab AI Brain di Pengaturan CEO. Sekarang ikut ceoAiSettings (lihat komentar
            // panjang di dekat readCeoAiSettings soal keterbatasan mapping model/tone).
            model: resolveChatModelParam(ceoAiSettings.aiModel),
            tone: resolveChatToneParam(ceoAiSettings.aiTone),
            liveState: liveStateObj,
            attachment: currentAttachment,
            history,
            modelId: composerModelId,
            researchMode: composerPrefs.researchMode && composerPrefs.researchMode !== 'off' ? composerPrefs.researchMode : undefined, // tombol Riset (8 Sep malam)
            effort: composerEffort,
            preferences: composerPreferences,
            media: composerMedia,
            // 11 Sep 2026 (kontrak modul 3+4): mode asisten aktif (tanya/riset/belajar/
            // analis) -- backend (B2) menyuntik instruksi lapis 4 + menaikkan effort floor
            // sesuai assistantModeDefaults (B3). Lihat effectiveAssistantMode di atas.
            assistantMode: effectiveAssistantMode,
          }),
          signal: requestController.signal,
        });
      } finally {
        clearTimeout(requestTimeoutId);
      }

      let responseText = '';
      let responseActionCard: ActionCard | undefined;
      let responseRealImage: { url: string; prompt: string; provider: string } | undefined;
      let responseRealFile: { fileName: string; mimeType: string; fileBase64: string; type: string } | undefined;
      let responseIsSystemError = false;
      let responseModelUsed: string | undefined;
      // SETELAN JAWABAN OTOMATIS (11 Sep 2026, kontrak modul 1+2) -- lihat komentar field
      // additif ChatMessage di atas.
      let responseEffortAuto: boolean | undefined;
      let responseEffortUsed: string | undefined;
      let responseModelTierUsed: string | undefined;
      let responseAssistantModeUsed: string | undefined;
      // T3 (8 Sep 2026): field additif dari brain/chat -- absen kalau lampiran
      // tidak dikirim/tidak lolos syarat B3, BUKAN error.
      let responseAttachmentVerdict: AttachmentVerdict | undefined;
      // V3 TOMBOL LANJUTAN (8 Sep 2026): field additif brain/chat -- absen/array kosong
      // = NextActionsBar tidak render sama sekali. Gate render JUGA cek !msg.isSystemError
      // (lihat call site di bawah) supaya tombol "Buat X dari jawaban di atas" tidak pernah
      // nempel di pesan gagal koneksi (failure.text di bawah).
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
        }
        // SETELAN JAWABAN (8 Sep 2026, B5) -- nama field response ASLI adalah `data.model`
        // (bukan `data.modelUsed`, lihat catatan_jujur laporan B3), dipertahankan apa
        // adanya supaya tidak breaking change untuk field yang sudah dipakai lama.
        if (json?.success && typeof json?.data?.model === 'string' && json.data.model) {
          responseModelUsed = json.data.model;
        }
        // SETELAN JAWABAN OTOMATIS (11 Sep 2026) -- semua opsional, absen kalau backend
        // (B2) belum/tidak mengisinya (mis. jalur fallback lokal tanpa LLM).
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
        // RISET WEB + PREDIKSI + LOKASI (8 Sep 2026, wave B5) -- gabung 3 field respons
        // terpisah (researchSources/researchFetchedAt/researchNote) jadi 1 objek. Sengaja
        // dibangun juga kalau sources kosong TAPI researchNote terisi (riset gagal/di-
        // throttle -- fail-soft NORMAL per catatan B4, bukan error) supaya ResearchSourcesCard
        // tetap bisa menampilkan alasannya secara jujur, bukan cuma diam-diam hilang.
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
        if (json?.success && json?.data?.systemEvent) {
          window.dispatchEvent(new Event(json.data.systemEvent));
          if (/\b(hapus|delete|bersihkan|kosongkan|reset)\s+(semua\s+|seluruh\s+)?(data\s+)?(keuangan|kas|transaksi|invoice)\b/i.test(userPrompt)) {
            try {
              const saved = localStorage.getItem('klir_live_company_state');
              if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.financials) {
                  parsed.financials.cleanCashBalance = 0;
                  parsed.financials.netCashBalance = 0;
                  parsed.financials.revenue30d = 0;
                  parsed.financials.expense30d = 0;
                  parsed.financials.grossProfit = 0;
                  parsed.financials.netProfit = 0;
                  parsed.financials.runwayMonths = 0;
                  parsed.financials.arOverdue = 0;
                  localStorage.setItem('klir_live_company_state', JSON.stringify(parsed));
                  window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
                }
              }
            } catch (e) {}
          }
        }
        if (json?.success && json?.data?.generatedImage?.url) {
          responseRealImage = json.data.generatedImage;
        }
        if (json?.success && json?.data?.generated?.fileBase64) {
          responseRealFile = json.data.generated;
        }
      }

      if (!responseText) {
        // Server merespons OK tapi tanpa data.text yang valid (mis. payload
        // AI kosong) -- perlakukan sama seperti kegagalan koneksi: jujur,
        // BUKAN diam-diam diganti data karangan. Lihat komentar keputusan di
        // atas getConnectionErrorReply().
        const failure = getConnectionErrorReply();
        responseText = failure.text;
        responseActionCard = undefined;
        responseIsSystemError = true;
      }

      let currentLength = 0;
      const chunkSize = Math.max(3, Math.floor(responseText.length / 30));
      const interval = setInterval(() => {
        currentLength += chunkSize;
        if (currentLength >= responseText.length) {
          clearInterval(interval);
          // Eliminasi kartu CSS simulasi palsu (detectMedia) yang menghasilkan file .txt dummy.
          // Gambar asli dari server ditangani oleh responseRealImage di bawah.
          const media = undefined;
          setChats((prev) =>
            prev.map((c) =>
              c.id === targetChatId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === aiMsgId
                        ? {
                            ...m,
                            text: responseText,
                            actionCard: responseActionCard,
                            media,
                            realImage: responseRealImage,
                            realFile: responseRealFile,
                            attachmentVerdict: responseAttachmentVerdict,
                            // BUGFIX live-test 8 Sep 2026: msg.attachment cuma pernah diisi di
                            // userMsg (lihat baris ~1600-an), TIDAK PERNAH di pesan AI -- kartu
                            // verdict yang dirender di sisi pesan AI selalu jatuh ke fallback
                            // "dokumen" tanpa ini. Nama file diambil dari currentAttachment
                            // (masih ada di closure sebelum di-null-kan di awal fungsi ini).
                            attachment: responseAttachmentVerdict && currentAttachment ? { name: currentAttachment.name, size: currentAttachment.size } : undefined,
                            isSystemError: responseIsSystemError,
                            retryText: responseIsSystemError ? userPrompt : undefined,
                            nextActions: responseNextActions,
                            modelUsed: responseModelUsed,
                            effortAuto: responseEffortAuto,
                            effortUsed: responseEffortUsed,
                            modelTierUsed: responseModelTierUsed,
                            assistantModeUsed: responseAssistantModeUsed,
                            researchSources: responseResearchSources,
                            prediction: responsePrediction,
                            locationPrompt: responseLocationPrompt,
                          }
                        : m
                    ),
                  }
                : c
            )
          );
          setIsTyping(false);
          persistSalesTargetAnalysis(userPrompt);
          if (responseRealFile) registerRealGeneratedFile(responseRealFile);
        } else {
          const slice = responseText.slice(0, currentLength);
          setChats((prev) =>
            prev.map((c) =>
              c.id === targetChatId
                ? {
                    ...c,
                    messages: c.messages.map((m) => (m.id === aiMsgId ? { ...m, text: slice } : m)),
                  }
                : c
            )
          );
        }
      }, 25);
    } catch (e) {
      // Exception jaringan/parsing -- sama seperti cabang !responseText di atas:
      // tampilkan kegagalan jujur, JANGAN diam-diam diganti data karangan.
      const failure = getConnectionErrorReply();
      const media = undefined;
      setChats((prev) =>
        prev.map((c) =>
          c.id === targetChatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, text: failure.text, actionCard: undefined, media, isSystemError: true, retryText: userPrompt }
                    : m
                ),
              }
            : c
        )
      );
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    const newId = `chat-${Date.now()}`;
    const welcomeMsg: ChatMessage = {
      id: `msg-welcome-${Date.now()}`,
      sender: 'ai',
      text: `Percakapan baru dimulai. KLIR AI Assistant siap menjawab pertanyaan apa saja atau menjalankan instruksi strategis untuk **${workspaceName}**.`,
      timestamp: 'Baru saja',
    };
    const newSession: ChatSession = {
      id: newId,
      updatedAt: Date.now(),
      messages: [welcomeMsg],
    };
    setChats((prev) => [newSession, ...prev]);
    setActiveChatId(newId);
    setInputMessage('');
    setAttachedFile(null, newId);
    setPluginOpen(false);
    setIsTyping(false);
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    setChats((prev) => {
      const filtered = prev.filter((c) => c.id !== chatId);
      if (filtered.length === 0) {
        const freshId = `chat-${Date.now()}`;
        const freshSession: ChatSession = {
          id: freshId,
          updatedAt: Date.now(),
          messages: [
            {
              id: `msg-welcome-${Date.now()}`,
              sender: 'ai',
              text: `Percakapan baru dimulai. Ada yang bisa saya bantu untuk **${workspaceName}**?`,
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
      label: 'Draf Email & Surat Kerjasama',
      prompt: 'Buatkan draf email penawaran kerjasama B2B profesional untuk calon klien enterprise',
      icon: <FileText size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      label: 'Ide Konten & Copywriting Video',
      prompt: 'Berikan 3 ide konsep konten naskah video TikTok viral untuk produk teknologi kami',
      icon: <Lightbulb size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      label: 'Penjelasan Konsep Unit Economics',
      prompt: 'Jelaskan konsep unit economics CAC vs LTV dan rasio idealnya untuk bisnis kami',
      icon: <Gauge size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      // FIX (konsolidasi zona tombol AI, 7 Sep -- putaran 3, dedup redundansi
      // dalam-1-list): dulu ADA 2 baris terpisah di sini ("Unggah & Analisis
      // Dokumen" + "Ringkasan & Tanya Jawab Dokumen") yang KEDUANYA cuma
      // prompt:'upload_trigger' -- 100% mekanisme identik, tanpa pembeda apapun
      // (bukan cuma mirip, benar-benar dua tombol yang melakukan hal PERSIS
      // sama). Digabung jadi 1 baris ini. TIDAK menyentuh 3 entri pluginCatalog
      // (pdf/excel/word, ~baris 1808) -- itu bagian dari sistem toggle
      // pluginEnabled yang genuinely berbeda (customization surface tersendiri,
      // bisa jadi disengaja granular untuk pengembangan nanti), jadi di luar
      // scope dedup yang aman dilakukan sepihak sesi ini.
      label: 'Unggah & Analisis Dokumen',
      prompt: 'upload_trigger',
      icon: <Paperclip size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      label: 'Terjemahan Bahasa',
      prompt: 'Terjemahkan dokumen ini ke bahasa Inggris dengan gaya bisnis formal, pertahankan istilah teknis, dan tandai bagian yang ambigu.',
      icon: <Globe size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      label: 'Ringkasan Notulen Rapat',
      prompt: 'Ubah transkrip rapat ini menjadi notulen resmi: ringkasan pembahasan, keputusan yang diambil, daftar tugas dengan penanggung jawab, dan tenggat waktunya.',
      icon: <ClipboardCheck size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      label: 'Grafik & Visualisasi Data',
      prompt: 'Ubah angka mentah ini menjadi visualisasi data: pilih jenis grafik yang tepat, jelaskan alasannya, sebutkan sumbu dan label, lalu tuliskan temuan utamanya.',
      icon: <BarChart2 size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      label: 'Draf Kontrak & Dokumen Legal',
      prompt: 'Buatkan draf kontrak kerjasama sederhana beserta klausul pembayaran, lingkup pekerjaan, kerahasiaan, dan masa berlaku. Tandai bagian yang perlu ditinjau ahli hukum.',
      icon: <Scale size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      label: 'Tulis & Jelaskan Kode Program',
      prompt: 'Tuliskan skrip untuk mengotomatiskan pekerjaan ini, lalu jelaskan tiap bagian kodenya dalam bahasa sederhana.',
      icon: <Terminal size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      label: 'Dokumen SOP & Prosedur Kerja',
      prompt: 'Susun SOP prosedur kerja lengkap: tujuan, ruang lingkup, langkah berurutan, penanggung jawab tiap langkah, dan kriteria selesai.',
      icon: <ClipboardCheck size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
    {
      label: 'Riset Kompetitor',
      prompt: 'Lakukan riset kompetitor: bandingkan posisi harga, keunggulan, kelemahan, dan tunjukkan celah pasar yang bisa kami ambil.',
      icon: <Target size={15} color="#C6CEDA" strokeWidth={1.7} />,
    },
  ];

  const actions = [
    {
      label: 'Scale Budget Iklan (+20%)',
      prompt: 'Scale budget iklan video TikTok 20% dan update ke dashboard',
      icon: <TrendingUp size={15} color="#3FBF8F" strokeWidth={1.7} />,
    },
    {
      label: 'Rekrut 1 Staf Video Editor',
      prompt: 'Rekrut 1 staf video editor tambahan untuk kurangi beban tim',
      icon: <Users size={15} color="#4E9BFF" strokeWidth={1.7} />,
    },
    {
      // FIX (sesi ini): dulu "Tagih Invoice PT Sentosa" -- nama klien fiktif di
      // tombol "Aksi dashboard perusahaan" yang selalu tampil terlepas dari ada/
      // tidaknya data piutang nyata. TEMUAN TAMBAHAN di luar 5 titik P0 dari
      // commander -- ditemukan+diverifikasi sesi ini via grep "PT Sentosa" (kelas
      // bug identik). Genericized, samakan pola dgn stat card Piutang &
      // decisionsList kartu 'ar' di file ini. CARA MEMBATALKAN: kembalikan label
      // 'Tagih Invoice PT Sentosa' + prompt lama.
      label: 'Tinjau Piutang Jatuh Tempo',
      prompt: 'Tinjau status piutang jatuh tempo kami saat ini.',
      icon: <Receipt size={15} color="#C9A66B" strokeWidth={1.7} />,
    },
    {
      label: 'Laporan Analisis Mingguan',
      prompt: 'Tampilkan laporan analisis strategis mingguan otomatis',
      icon: <Calendar size={15} color="#8CBEFF" strokeWidth={1.7} />,
    },
  ];

  const pills = [
    { label: 'Laporan kinerja bulanan', icon: <Gauge size={14} strokeWidth={1.7} />, prompt: 'Susun laporan kinerja perusahaan bulan ini dalam satu halaman untuk direksi: keuangan, marketing, operasional, plus tiga hal yang butuh keputusan saya.' },
    { label: 'Presentasi rapat direksi', icon: <Presentation size={14} strokeWidth={1.7} />, prompt: 'Buatkan presentasi rapat direksi bulan ini: pencapaian, angka kunci, masalah utama, dan keputusan yang diminta, lengkap dengan judul dan poin isi tiap slide.' },
    { label: 'Ringkas arus kas', icon: <Wallet size={14} strokeWidth={1.7} />, prompt: 'Ringkas arus kas 30 hari terakhir: kas masuk, kas keluar, saldo bersih, dan sisa runway dalam bulan.' },
    { label: 'Target & prediksi penjualan', icon: <Target size={14} strokeWidth={1.7} />, prompt: 'Analisis target penjualan tahunan dan realisasi per kuartal kami. Hitung target per kuartal, total realisasi, selisih yang masih kurang, kebutuhan kuartal berikutnya agar target tahunan tercapai, diagnosis penyebab periode yang tertinggal, dan prediksi sampai Desember. Jangan mengarang angka: jika target atau realisasi belum ada, minta saya mengisinya.' },
    { label: 'Beban tim & tugas', icon: <Users size={14} strokeWidth={1.7} />, prompt: 'Periksa beban tim per divisi, tugas yang tertunda, dan capaian SLA bulan ini. Tandai divisi yang kelebihan beban.' },
    { label: 'Simulasi skenario bisnis', icon: <BarChart2 size={14} strokeWidth={1.7} />, prompt: 'Simulasikan skenario keputusan bisnis ini untuk 6 bulan ke depan berdasarkan data kas dan beban kami: sebutkan dampaknya ke kas, titik balik modal, sisa runway setelahnya, dan tingkat risikonya. Skenario yang ingin saya uji: tambah dua staf sales dan naikkan budget iklan 30%.' },
    { label: 'Riset & analisis data', icon: <Search size={14} strokeWidth={1.7} />, prompt: 'Lakukan riset dan analisis data bisnis perusahaan bulan ini, sertakan temuan utama, angka pendukung, dan rekomendasi.' },
  ];

  const pluginCatalog: { key: string; title: string; desc: string; icon: React.ReactNode; tone: string; upload?: boolean; prompt?: string; kind?: StudioKind; docTemplate?: boolean; locked?: boolean }[] = [
    { key: 'pdf', title: 'Analisis Dokumen PDF', desc: 'Unggah PDF, AI membaca dan meringkas isinya', icon: <FileText size={16} color="#4E9BFF" strokeWidth={1.7} />, tone: '#4E9BFF', upload: true },
    { key: 'excel', title: 'Analisis Excel & Spreadsheet', desc: 'Baca angka mentah lalu hitung ulang otomatis', icon: <FileSpreadsheet size={16} color="#3FBF8F" strokeWidth={1.7} />, tone: '#3FBF8F', upload: true },
    { key: 'word', title: 'Analisis Dokumen Word', desc: 'Periksa dan sempurnakan draf tulisan bisnis', icon: <FileText size={16} color="#4E9BFF" strokeWidth={1.7} />, tone: '#4E9BFF', upload: true },
    // FIX (audit role-fit 7 Sep): 'image'/'audio' di bawah ini DULU tidak punya `kind`,
    // jadi klik-nya jatuh ke simulasi CSS-art lama (handleSendMessage(prompt)), BUKAN
    // generate asli lewat MediaStudio seperti tombol berlabel SAMA PERSIS di
    // MarketingAIAssistantView.tsx (kind:'image'/'audio'). Ditambah `kind` (menyamai
    // Marketing persis) + 2 entri yang sebelumnya TIDAK ADA sama sekali di CEO:
    // 'Rekam Suara' (transkripsi) dan 'Buat Video' (sama seperti Marketing --
    // render video asli sudah live lewat OpenRouter sejak commit 5b43250).
    { key: 'image', title: 'Buat Gambar', desc: 'Model, rasio, kualitas, preview dan unduh', icon: <ImageIcon size={16} color="#C9A66B" strokeWidth={1.7} />, tone: '#C9A66B', kind: 'image' },
    { key: 'audio', title: 'Buat Audio / Voiceover', desc: 'Script atau brief menjadi file audio', icon: <Mic size={16} color="#C9A66B" strokeWidth={1.7} />, tone: '#C9A66B', kind: 'audio' },
    { key: 'transcription', title: 'Rekam Suara', desc: 'Rekam / unggah, transkripsikan, edit sebelum kirim', icon: <Mic size={16} color="#C9A66B" strokeWidth={1.7} />, tone: '#C9A66B', kind: 'transcription' },
    { key: 'video', title: 'Buat Video', desc: 'Render video sungguhan lewat OpenRouter, model murah sampai mahal, harga tampil; proses nyata, bisa sampai sekitar 2 menit', icon: <Video size={16} color="#C9A66B" strokeWidth={1.7} />, tone: '#C9A66B', kind: 'video' },
    // FIX (audit role-fit 7 Sep): 2 entri finance-only ini sebelumnya TIDAK ADA
    // padanannya di CEO sama sekali (lihat FinanceAIAssistantView.tsx pluginItems
    // baris 1550-1551) -- CEO seharusnya superset semua divisi.
    { key: 'tax_calc', title: 'Kalkulator Pajak Bisnis (Belum tersedia)', desc: 'Fitur ini belum tersedia saat ini.', icon: <Lock size={16} color="#737B89" strokeWidth={1.7} />, tone: '#C9A66B', prompt: 'Hitung estimasi kewajiban pajak bulanan dari omset dan laba perusahaan.', locked: TAX_FEATURE_LOCKED },
    { key: 'invoice_gen', title: 'Generator Invoice Formal', desc: 'Susun draf faktur tagihan lengkap dengan termin', icon: <Receipt size={16} color="#3FBF8F" strokeWidth={1.7} />, tone: '#3FBF8F', prompt: 'Buatkan struktur draf invoice formal lengkap dengan no faktur, rincian item, dan bank tujuan.' },
    // ===== Additive (tim AI): sama persis dengan 2 entri "Kuis"/"Flashcard" yang sudah
    // live di pluginItems MarketingAIAssistantView.tsx -- termasuk tab "Template Dokumen"
    // (19 template: proposal/invoice/laporan keuangan/dst) yang ada DI DALAM studio yang
    // sama begitu dibuka, persis seperti akses yang sudah dipakai Marketing hari ini. =====
    { key: 'quiz', title: 'Kuis', desc: 'Pertanyaan interaktif dari materi sumber', icon: <GraduationCap size={16} color="#4E9BFF" strokeWidth={1.7} />, tone: '#4E9BFF', kind: 'quiz' },
    { key: 'flashcard', title: 'Flashcard', desc: 'Kartu belajar, balik jawaban, tandai progres', icon: <BookOpen size={16} color="#4E9BFF" strokeWidth={1.7} />, tone: '#4E9BFF', kind: 'flashcard' },
    // FIX (temuan gap-fix 7 Sep, reachability HIGH): 19 template dokumen (laporan keuangan/
    // invoice/deck/video-brief) sebelumnya CUMA bisa dijangkau lewat tab kedua di dalam studio
    // gambar/audio/video/kuis/flashcard -- tidak ada satupun tombol sidebar yang eksplisit
    // mengarah ke situ. Entri ini buka MediaStudio LANGSUNG di tab "Template Dokumen"
    // (docTemplate:true -> openStudio(..., 'template') di handler klik di bawah).
    { key: 'doc_templates', title: 'Template Dokumen', desc: '19 template siap pakai: laporan keuangan, invoice, presentasi, storyboard video', icon: <FileText size={16} color="#3FBF8F" strokeWidth={1.7} />, tone: '#3FBF8F', kind: 'image', docTemplate: true },
  ];


  const pluginItems = pluginCatalog.filter((p) => pluginEnabled[p.key] !== false);

  // ===== STUDIO TEMPLATE & NOTEBOOK (additive, sesi maintenance gelombang terakhir 7 Sep) =====
  // Menyambungkan MediaStudio (sudah ada & LIVE di MarketingAIAssistantView.tsx) ke portal
  // Executive/CEO, supaya CEO juga bisa akses Template Dokumen (19 template) + notebook (9
  // jenis kartu: kuis/flashcard/ringkasan/mindmap/tabel/infografis/deck/naskah audio/
  // storyboard video). Backend (/api/v1/media/generate, /api/v1/brain/notebook) SUDAH
  // menerima role:'executive' sejak sebelum sesi ini (lihat zod schema di route masing-
  // masing) -- cuma UI-nya yang belum tersambung di file ini. TIDAK ADA baris/perilaku
  // Fatur yang diubah atau dihapus (termasuk fitur simulasi poster GeneratedMedia/
  // detectMedia() di atas -- dibiarkan utuh, berjalan berdampingan lewat field terpisah).
  // CARA MEMBATALKAN: hapus (1) 4 baris import "Studio Template Dokumen & Notebook" di
  // paling atas file, (2) 6 field "studio*" di interface ChatMessage, (3) 2 entri kind:
  // 'quiz'/'flashcard' di pluginCatalog tepat di atas, (4) blok ini sendiri, (5) blok
  // render <MediaStudio/> + <StudioResult/> di JSX (dicari via komentar sama).
  // FIX (temuan gap-fix 7 Sep): field `mode` opsional ditambah -- default 'media' (perilaku
  // lama persis). Dipakai tombol baru "Template Dokumen" di pluginCatalog di bawah supaya bisa
  // membuka MediaStudio LANGSUNG di tab Template Dokumen, bukan lewat tab media dulu.
  const [mediaPanel, setMediaPanel] = useState<{ id: string; kind: StudioKind; chatId: string; text: string; source: string; mode?: 'media' | 'template' } | null>(null);
  const studioRequestsInFlight = useRef<Set<string>>(new Set());

  const openStudio = (kind: StudioKind, text = '', chatId = activeChatId, mode: 'media' | 'template' = 'media') => {
    const sourceChat = chats.find(chat => chat.id === chatId);
    const attachmentText = attachedFiles[chatId]?.content || '';
    const historyText = sourceChat?.messages.filter(message => message.text.trim() && !message.studioFailed).slice(-8).map(message => message.text).join('\n\n') || '';
    const source = resolveStudioSource({ kind, composerText: text, attachmentText, historyText });
    setPluginOpen(false);
    setMediaPanel({ id: crypto.randomUUID(), kind, chatId, text, source, mode });
  };

  const submitStudio = async (submission: StudioSubmission, chatId: string) => {
    if (studioRequestsInFlight.current.has(chatId)) throw new Error('Masih ada permintaan di chat ini. Tunggu hasilnya sebelum mencoba kembali.');
    studioRequestsInFlight.current.add(chatId);
    const id = crypto.randomUUID();
    const summary = submission.type === 'notebook' ? `Buat ${submission.request.kind === 'quiz' ? 'kuis' : 'flashcard'} dari materi:\n${submission.request.sourceText}`
      : submission.type === 'storyboard' ? `Buat storyboard DOCX: ${submission.request.brief}`
      : `${submission.request.kind === 'image' ? 'Generate gambar' : submission.request.kind === 'audio' ? 'Generate voiceover' : 'Cek status video'}: ${submission.request.script || submission.request.prompt || ''}`;
    const update = (patch: Partial<ChatMessage>) => setChats(previous => previous.map(chat => chat.id === chatId ? {
      ...chat, updatedAt: Date.now(), messages: chat.messages.map(message => message.id === id ? { ...message, ...patch } : message),
    } : chat));
    setChats(previous => previous.map(chat => chat.id === chatId ? { ...chat, updatedAt: Date.now(), messages: [...chat.messages,
      { id: `user-${id}`, sender: 'user' as const, text: summary, timestamp: 'Baru saja' },
      { id, sender: 'ai' as const, text: '', timestamp: 'Baru saja', studioPending: true, studioSubmission: submission },
    ] } : chat));
    try {
      if (submission.type === 'media') {
        const result = await apiRequest<{ success: true; data: MediaResult }>('/api/v1/media/generate', { method: 'POST', body: JSON.stringify(submission.request) });
        if (!result.data || result.data.kind !== submission.request.kind || !validMediaResult(result.data)) throw new Error('Server tidak mengembalikan media valid. Tidak ada hasil yang ditandai berhasil.');
        // B1 VIDEO ASYNC (7 Sep 2026): pola identik MarketingAIAssistantView.tsx --
        // portal Executive punya menu "Buat Video" yang genuinely reachable (submitStudio
        // duplikat sendiri, field studioPending/studioMedia). Kalau titik ini terlewat,
        // video submit balas {status:'pending'} lalu langsung update studioPending:false
        // TANPA pernah poll -- StudioResult.tsx tidak punya cabang render untuk status
        // 'pending', jadi user Executive akan melihat card kosong (lebih buruk dari
        // sebelum fix). studioRequestsInFlight tetap dipegang selama poll (try block sama).
        if (result.data.kind === 'video' && result.data.status === 'pending' && result.data.jobId) {
          const final = await pollVideoJob(result.data.jobId, { intervalMs: 4000, maxMs: 360_000 });
          const merged: MediaResult = { ...result.data, ...final };
          update({ studioPending: false, studioMedia: merged, text: merged.status === 'planned' ? 'Render video masih berstatus Segera.' : 'Video telah diterima dari server.' });
        } else {
          update({ studioPending: false, studioMedia: result.data, text: result.data.status === 'planned' ? 'Render video masih berstatus Segera.' : submission.request.kind === 'image' ? 'Gambar telah diterima dari server.' : 'Voiceover telah diterima dari server.' });
        }
      } else if (submission.type === 'notebook') {
        const result = await apiRequest<{ success: true; data: NotebookResult }>('/api/v1/brain/notebook', { method: 'POST', body: JSON.stringify(submission.request) });
        if (!result.data?.payload || result.data.kind !== submission.request.kind) throw new Error('Payload notebook tidak valid. Coba kembali.');
        update({ studioPending: false, studioNotebook: result.data, text: result.data.title });
      } else {
        const result = await apiRequest<{ success: true; data: { fileName: string; mimeType: string; fileBase64: string | null; summary: string; provider: string; modelUsed: string; note?: string } }>('/api/v1/brain/generate', { method: 'POST', body: JSON.stringify(submission.request) });
        if (!result.data?.fileBase64 || !result.data.fileName) throw new Error('Server belum mengembalikan file storyboard. Coba kembali.');
        update({ studioPending: false, text: `Storyboard DOCX -- bukan render video.\n${result.data.summary}\n${result.data.provider} · ${result.data.modelUsed}${result.data.note ? `\n${result.data.note}` : ''}`, realFile: { ...result.data, fileBase64: result.data.fileBase64, type: 'video-plan' } });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Permintaan gagal. Coba kembali.';
      const scriptReady = err instanceof ApiRequestError && err.data && typeof err.data === 'object'
        && (err.data as { kind?: string; status?: string; script?: unknown }).kind === 'audio'
        && (err.data as { status?: string }).status === 'script-ready'
        && typeof (err.data as { script?: unknown }).script === 'string'
        ? (err.data as { script: string }).script.trim() : undefined;
      update({ studioPending: false, studioFailed: true, text: `${message}${scriptReady ? '\n\nDraft script berhasil dibuat dan disimpan. Retry akan memakai script ini.' : ''}`, studioDraftScript: scriptReady });
      throw err instanceof Error ? err : new Error(message);
    } finally { studioRequestsInFlight.current.delete(chatId); }
  };
  // ===== /STUDIO TEMPLATE & NOTEBOOK =====

  // V3 TOMBOL LANJUTAN (8 Sep 2026) -- adaptor kecil dari klik chip NextActionsBar ke
  // fungsi Studio/generate yang SUDAH ADA. Lihat komentar identik di
  // MarketingAIAssistantView.tsx untuk alasan lengkap kind 'ppt'/'word'/'excel' pakai
  // placeholder StudioKind 'image' + mode 'template'.
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
      // RISET WEB + PREDIKSI + LOKASI (8 Sep 2026, wave B5) -- brief-nya SENGAJA teks
      // yang lolos detectResearchIntent() (research-intent.ts, B1), lihat komentar
      // next-actions.ts B4 -- klik chip ini beneran memicu jalur riset/forecast/lokasi
      // di brain/chat/route.ts, sama seperti mengetik teks itu manual.
      void handleSendMessage(action.brief);
    } else if (action.kind === 'template') {
      // 11 Sep 2026 (kontrak modul 7, B6 template-picker.ts) -- brief chip ini SENGAJA
      // teks pemicu deteksi intent 'list' (mis. "template apa saja yang tersedia untuk
      // <tipe>", lihat next-actions.ts B6), jadi cukup dikirim sebagai pesan chat biasa
      // sama seperti slash '/template' di handleComposerSlashSelect -- BUKAN openStudio,
      // karena balasannya deterministik nol-LLM (buildTemplateListReply), tidak perlu
      // modal Studio.
      void handleSendMessage(action.brief);
    }
  };

  // RISET WEB + PREDIKSI + LOKASI (8 Sep 2026, wave B5-chat-wiring-ui) -- 2 handler
  // baru untuk kartu ForecastCard ("Tambah data saya") dan LocationForm (submit form),
  // memanggil endpoint B2/B3 LANGSUNG (bukan lewat brain/chat lagi) supaya pengguna
  // bisa perbaiki input tanpa mengirim ulang pesan chat. Pola fetch sama seperti
  // '/api/v1/brain/chat' di atas -- cookie sesi (klir_token/auth_token) terkirim
  // otomatis untuk request same-origin, tidak perlu header Authorization eksplisit
  // (lihat authenticateTenantRequest di tenant-guard.ts).
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

  // NOTE (audit konsistensi UI 7 Sep): togglePlugin() + pluginPanelStyle (dropdown
  // "Plugin & Tools" yang dulu mengambang di atas composer) dihapus di sini -- isinya
  // (pluginItems) sudah dipindah jadi bagian sidebar "Kemampuan & tools AI". pluginOpen/
  // setPluginOpen TETAP ADA (state dipakai openStudio() untuk menutup panel lama & masih
  // di-reset di handleSendMessage/handleNewChat) meski sekarang tidak ada lagi UI yang
  // membacanya untuk render. Untuk membatalkan: lihat histori git commit sesi ini.

  const liveFinancials = liveStats.financials || {};
  const liveMarketing = liveStats.marketing || {};
  const liveTeamOps = liveStats.teamOps || {};
  const juta = (n: number) => `Rp ${(n / 1000000).toFixed(1).replace('.', ',')} jt`;

  // GUARD (sesi ini): field ini boleh bernilai 0/undefined ASLI kalau workspace
  // kosong -- "||" lama salah menganggap 0 sebagai "kosong" dan jatuh ke angka
  // fiktif tetap (25,5jt / 3,1x / 92% / PT Sentosa Abadi 19,4jt), padahal Dashboard
  // Perusahaan (CompanyDataDashboard.tsx) sudah jujur menunjukkan Rp 0 di workspace
  // yang sama. Pola hasRoas (typeof + >0) di-port persis dari MarketingModuleView.tsx
  // baris 74-77 supaya konsisten. Piutang (arOverdue) memang belum ada penulis live
  // manapun -- tampilkan empty-state jujur, JANGAN karang endpoint baru.
  // CARA MEMBATALKAN: hapus 8 const has*/live*/*.Display di bawah, kembalikan
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

  const gallery = [
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
        { t: 'Ringkas arus kas 30 hari terakhir', n: 'Kas masuk, kas keluar, sisa runway', p: 'Analisis arus kas 30 hari terakhir perusahaan dan jelaskan posisi runway kami saat ini.', kind: 'file-spreadsheet', kindLabel: 'Spreadsheet' },
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

  // ===========================================================================
  // Katalog kemampuan AI (grid "Semua kemampuan AI") -- 28 kemampuan nyata,
  // tiap kartu memanggil handleSendMessage(prompt) yang sama dengan tombol
  // lain di file ini. Tidak ada satupun kartu di sini yang terkunci untuk role
  // eksekutif (RBAC per-divisi ala mockup sengaja TIDAK dibawa -- itu perlu
  // keputusan arsitektur admin/akses dari Fatur, di luar scope visual-matching).
  const capCats = [
    { title: 'Dokumen & korespondensi', tone: '#4E9BFF' },
    { title: 'Analisis & data', tone: '#3FBF8F' },
    { title: 'Dokumen panjang & rapat', tone: '#8CBEFF' },
    { title: 'Materi promosi', tone: '#C9A66B' },
    { title: 'Teknis & riset pasar', tone: '#D8A33C' },
  ];
  const capabilities: { cat: number; icon: React.ReactNode; label: string; note: string; prompt: string; openStudioKind?: StudioKind; locked?: boolean }[] = [
    { cat: 0, icon: <FileText size={17} strokeWidth={1.7} />, label: 'Draf proposal kerjasama', note: 'Dokumen 4 bagian: latar, lingkup, harga, syarat', prompt: 'Buatkan draf proposal kerjasama untuk klien enterprise: latar belakang, ruang lingkup pekerjaan, skema harga, dan syarat kerjasama.' },
    { cat: 0, icon: <Receipt size={17} strokeWidth={1.7} />, label: 'Surat penagihan invoice', note: 'Nada sopan tapi tegas, siap kirim hari ini', prompt: 'Buatkan surat penagihan invoice yang sopan namun tegas untuk klien yang telat bayar 3 hari.' },
    { cat: 0, icon: <Mail size={17} strokeWidth={1.7} />, label: 'Email tindak lanjut rapat', note: 'Poin sepakat, pemilik tugas, langkah berikutnya', prompt: 'Buatkan email tindak lanjut setelah rapat klien berisi ringkasan poin yang disepakati dan langkah berikutnya.' },
    { cat: 0, icon: <Scale size={17} strokeWidth={1.7} />, label: 'Draf kontrak & dokumen legal', note: 'MoU dan NDA, pasal berisiko ditandai untuk ahli', prompt: 'Buatkan draf kontrak kerjasama sederhana beserta klausul pembayaran, lingkup pekerjaan, kerahasiaan, dan masa berlaku. Tandai bagian yang perlu ditinjau ahli hukum.' },
    { cat: 0, icon: <Shield size={17} strokeWidth={1.7} />, label: 'Balasan komplain klien', note: 'Redakan dulu, akui fakta, tawarkan jalan keluar', prompt: 'Buatkan balasan untuk komplain klien yang kecewa dengan keterlambatan pengerjaan: akui fakta, jelaskan penyebab, tawarkan solusi konkret dan kompensasi yang masuk akal.' },
    { cat: 0, icon: <ClipboardCheck size={17} strokeWidth={1.7} />, label: 'SOP & prosedur kerja', note: 'Langkah bernomor, penanggung jawab, kriteria selesai', prompt: 'Susun SOP prosedur kerja lengkap: tujuan, ruang lingkup, langkah berurutan, penanggung jawab tiap langkah, dan kriteria selesai.' },
    // FIX (audit role-fit 7 Sep): item baru -- padanan verbatim tools[] key 'sop' di
    // FinanceAIAssistantView.tsx (baris 1502-1506, SOP kas & reimbursement spesifik,
    // berbeda dari SOP generik di atas). CEO sebelumnya tidak punya ini sama sekali.
    { cat: 0, icon: <ClipboardCheck size={17} strokeWidth={1.7} />, label: 'SOP kas & reimbursement', note: 'Alur pengajuan, persetujuan, kriteria kuitansi', prompt: 'Susun SOP alur pengajuan kas kecil, persetujuan reimbursement, dan kriteria kuitansi valid.' },
    { cat: 1, icon: <Wallet size={17} strokeWidth={1.7} />, label: 'Ringkas arus kas 30 hari', note: 'Kas masuk, keluar, dan sisa runway dalam bulan', prompt: 'Analisis arus kas 30 hari terakhir perusahaan dan jelaskan posisi runway kami saat ini.' },
    { cat: 1, icon: <TrendingUp size={17} strokeWidth={1.7} />, label: 'Evaluasi performa iklan', note: 'ROAS dan CAC per kanal, mana yang dihentikan', prompt: 'Evaluasi performa iklan bulan ini berdasarkan ROAS, CAC, dan kontribusi tiap kanal.' },
    { cat: 1, icon: <Users size={17} strokeWidth={1.7} />, label: 'Beban tim & tugas tertunda', note: 'Utilisasi tiap divisi, SLA, dan titik lembur', prompt: 'Periksa beban tim per divisi, tugas yang tertunda, dan capaian SLA bulan ini.' },
    { cat: 1, icon: <FileSpreadsheet size={17} strokeWidth={1.7} />, label: 'Spreadsheet Excel', note: 'Kolom, rumus, dan format siap tempel ke Excel', prompt: 'Buatkan struktur spreadsheet Excel untuk laporan arus kas bulanan, lengkap dengan nama kolom dan rumus yang dipakai.' },
    { cat: 1, icon: <PieChart size={17} strokeWidth={1.7} />, label: 'Grafik & visualisasi data', note: 'Angka mentah jadi grafik plus temuan utamanya', prompt: 'Ubah angka mentah ini menjadi visualisasi data: pilih jenis grafik yang tepat, jelaskan alasannya, sebutkan sumbu dan label, lalu tuliskan temuan utamanya.' },
    { cat: 1, icon: <BarChart2 size={17} strokeWidth={1.7} />, label: 'Proyeksi kas 3 bulan', note: 'Skenario pesimis, dasar, dan optimis', prompt: 'Buatkan proyeksi arus kas tiga bulan ke depan dalam tiga skenario (pesimis, dasar, optimis) berdasarkan data kas dan beban kami saat ini.' },
    { cat: 1, icon: <Target size={17} strokeWidth={1.7} />, label: 'Target penjualan & prediksi kuartal', note: 'Bandingkan target tahunan, realisasi, dan kebutuhan periode berikutnya', prompt: 'Analisis target penjualan tahunan dan realisasi per kuartal kami. Hitung target per kuartal, total realisasi sampai kuartal terakhir, selisih yang masih kurang, pembagian kebutuhan kuartal berikutnya agar target tahunan tercapai, diagnosis penyebab periode yang tertinggal, dan prediksi sampai Desember. Jangan mengarang angka: jika target atau realisasi belum ada, minta saya mengisinya.' },
    { cat: 1, icon: <AlertTriangle size={17} strokeWidth={1.7} />, label: 'Deteksi anomali biaya', note: 'Pos belanja yang melonjak di luar kebiasaan', prompt: 'Periksa data pengeluaran kami dan tandai pos biaya yang melonjak di luar kebiasaan, sertakan besar selisih dan kemungkinan penyebabnya.' },
    { cat: 1, icon: <Search size={17} strokeWidth={1.7} />, label: 'Riset & analisis data', note: 'Temuan, angka pendukung, dan rekomendasi tindakan', prompt: 'Lakukan riset dan analisis data bisnis perusahaan bulan ini, sertakan temuan utama, angka pendukung, dan rekomendasi.' },
    // FIX (audit role-fit 7 Sep): 2 item baru. 'Estimasi setoran pajak PPh/PPN' = padanan
    // verbatim tools[] key 'tax' (baris 1460-1463) di FinanceAIAssistantView.tsx.
    // 'Rekonsiliasi kas & rekening koran' TERINSPIRASI tools[] key 'upload' (baris 1478-1481,
    // 'Unggah & Analisis Rekening Koran') TAPI BUKAN verbatim -- key 'upload' Finance itu
    // upload-trigger (prompt literal 'upload_trigger', membuka file picker, lihat
    // FinanceAIAssistantView.tsx:1975), sedangkan grid "Semua kemampuan AI" ini cuma manggil
    // handleSendMessage(prompt) teks biasa -- jadi ditulis ulang jadi prompt analisis teks.
    // CEO sebelumnya tidak punya jalan pintas apapun untuk estimasi pajak atau rekonsiliasi
    // kas/rekening koran.
    { cat: 1, icon: <Lock size={17} strokeWidth={1.7} />, label: 'Perpajakan (Belum tersedia)', note: 'Fitur ini belum tersedia saat ini.', prompt: 'Hitung estimasi kewajiban setor PPh Final 0,5% dan ringkasan PPN untuk periode berjalan.', locked: TAX_FEATURE_LOCKED },
    { cat: 1, icon: <FileSpreadsheet size={17} strokeWidth={1.7} />, label: 'Rekonsiliasi kas & rekening koran', note: 'Cocokkan buku kas dengan mutasi bank', prompt: 'Buatkan rekonsiliasi kas dan mutasi bank untuk bulan ini, cocokkan saldo buku kas internal dengan rekening koran, dan tandai selisih yang perlu ditelusuri.' },
    { cat: 2, icon: <BookOpen size={17} strokeWidth={1.7} />, label: 'Ringkasan & tanya-jawab dokumen', note: 'Unggah PDF ratusan halaman, tanya isinya', prompt: 'Ringkas dokumen panjang yang saya unggah menjadi poin-poin utama, lalu siap menjawab pertanyaan lanjutan tentang isinya.' },
    { cat: 2, icon: <MessageSquare size={17} strokeWidth={1.7} />, label: 'Notulen dari transkrip rapat', note: 'Keputusan, daftar tugas, dan tenggatnya', prompt: 'Ubah transkrip rapat ini menjadi notulen resmi: ringkasan pembahasan, keputusan yang diambil, daftar tugas dengan penanggung jawab, dan tenggat waktunya.' },
    { cat: 2, icon: <CopyIconAlt size={17} strokeWidth={1.7} />, label: 'Bandingkan dua dokumen', note: 'Selisih pasal, angka, dan tanggal antar versi', prompt: 'Bandingkan dua versi dokumen ini dan tunjukkan selisihnya: pasal yang berubah, angka yang berbeda, tanggal yang bergeser, dan mana yang perlu dinegosiasikan.' },
    { cat: 2, icon: <Globe size={17} strokeWidth={1.7} />, label: 'Terjemahan bahasa', note: 'ID, EN, Mandarin, Jepang, istilah teknis dijaga', prompt: 'Terjemahkan dokumen ini ke bahasa Inggris dengan gaya bisnis formal, pertahankan istilah teknis, dan tandai bagian yang ambigu.' },
    // FIX (temuan F1 audit 8 Sep): dulu kartu ini onClick-nya sama seperti kartu lain di
    // grid ini -- handleSendMessage(prompt) biasa -- padahal server /api/v1/brain/chat
    // TIDAK PUNYA jalur generate video sama sekali, jadi selalu jatuh ke kartu simulasi
    // CSS palsu (detectMedia -> styleArt) yang tombol unduhnya cuma kasih file .txt.
    // openStudioKind:'video' mengarahkan onClick ke openStudio('video', ...) -- jalur
    // ASLI yang sudah dipakai pluginCatalog di file ini (submitStudio -> POST
    // /api/v1/media/generate -> VideoJob async -> polling nyata).
    { cat: 3, icon: <Video size={17} strokeWidth={1.7} />, label: 'Video promosi 9:16', note: '30 detik, 4 scene, naskah dan visual per scene', prompt: 'Buatkan video TikTok vertikal 9:16 dengan empat scene: hook, masalah, solusi, dan ajakan bertindak.', openStudioKind: 'video' },
    { cat: 3, icon: <ImageIcon size={17} strokeWidth={1.7} />, label: 'Poster & banner promosi', note: 'Feed, story, thumbnail, satu headline konsisten', prompt: 'Buatkan poster promosi produk untuk feed dan story, sertakan headline dan variasi tiap ukuran.', openStudioKind: 'image' },
    { cat: 3, icon: <Megaphone size={17} strokeWidth={1.7} />, label: 'Naskah copywriting', note: 'Pola hook, masalah, solusi, ajakan bertindak', prompt: 'Tuliskan naskah copywriting dengan formula hook, problem, solution, dan CTA untuk produk kami.' },
    { cat: 3, icon: <Calendar size={17} strokeWidth={1.7} />, label: 'Jadwal konten sepekan', note: '7 hari caption lengkap dengan jam tayang', prompt: 'Buatkan rencana konten sosial satu pekan lengkap dengan caption harian dan jadwal tayang.' },
    { cat: 3, icon: <Sparkles size={17} strokeWidth={1.7} />, label: 'Nama produk & tagline', note: 'Sepuluh opsi dengan alasan tiap pilihan', prompt: 'Usulkan sepuluh nama produk beserta taglinenya, jelaskan alasan tiap pilihan, dan tandai mana yang paling mudah diingat pasar Indonesia.' },
    { cat: 3, icon: <Presentation size={17} strokeWidth={1.7} />, label: 'Presentasi & slide', note: '10 slide berjudul dengan poin isi tiap halaman', prompt: 'Buatkan kerangka presentasi 10 slide untuk rapat strategi bulanan, sertakan judul dan poin isi tiap slide.' },
    { cat: 4, icon: <Terminal size={17} strokeWidth={1.7} />, label: 'Tulis & jelaskan kode program', note: 'Skrip jalan plus penjelasan tiap baris', prompt: 'Tuliskan skrip untuk mengotomatiskan pekerjaan ini, lalu jelaskan tiap bagian kodenya dalam bahasa sederhana.' },
    { cat: 4, icon: <Target size={17} strokeWidth={1.7} />, label: 'Riset kompetitor', note: 'Peta harga pesaing dan celah yang bisa diambil', prompt: 'Lakukan riset kompetitor: bandingkan posisi harga, keunggulan, kelemahan, dan tunjukkan celah pasar yang bisa kami ambil.' },
    { cat: 4, icon: <Layers size={17} strokeWidth={1.7} />, label: 'Analisis SWOT & risiko', note: 'Kekuatan, kelemahan, peluang, ancaman', prompt: 'Susun analisis SWOT perusahaan kami berdasarkan data yang ada, lalu urutkan risiko terbesar beserta langkah mitigasinya.' },
    { cat: 4, icon: <GraduationCap size={17} strokeWidth={1.7} />, label: 'Materi pelatihan & onboarding', note: 'Modul, latihan, dan kuis penilaian', prompt: 'Buatkan materi pelatihan onboarding staf baru: modul per topik, latihan praktik, dan kuis penilaian di akhir.' },
    { cat: 4, icon: <Gauge size={17} strokeWidth={1.7} />, label: 'Penjelasan unit economics', note: 'CAC, LTV, dan rasio ideal dengan angka Anda', prompt: 'Jelaskan konsep unit economics CAC vs LTV dan rasio idealnya untuk bisnis kami.' },
  ];
  const capGroups = capCats
    .map((cat, ci) => ({ ...cat, items: capabilities.filter((c) => c.cat === ci) }))
    .filter((g) => g.items.length > 0);

  // 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): grid "Semua kemampuan AI"
  // dihapus dari area utama, isinya PINDAH ke sidebar "Kemampuan & tools AI" -- dikelompokkan
  // per kategori (judul kecil) di bawah tools/pluginItems/pills yang sudah ada. Dedup HANYA
  // exact-label-match (case-insensitive, trim) terhadap label yang SUDAH ada di sidebar --
  // sengaja KONSERVATIF (bukan fuzzy/substring) karena capabilities.md sendiri mencatat
  // beberapa label MIRIP tapi TIDAK identik tujuannya (mis. "Riset & analisis data" vs
  // "Riset Kompetitor", confidence rendah, lihat komentar lama di dekat pills) -- dedup
  // fuzzy berisiko menghapus kemampuan unik (regresi fungsional), dedup exact-match tidak.
  const sidebarExistingLabels = new Set<string>([
    ...tools.map((t) => t.label.trim().toLowerCase()),
    ...pluginItems.map((p) => p.title.trim().toLowerCase()),
    ...pills.map((p) => p.label.trim().toLowerCase()),
  ]);
  const capSidebarGroups = capGroups
    .map((grp) => ({ ...grp, items: grp.items.filter((c) => !sidebarExistingLabels.has(c.label.trim().toLowerCase())) }))
    .filter((grp) => grp.items.length > 0);
  const capSidebarCount = capSidebarGroups.reduce((sum, grp) => sum + grp.items.length, 0);

  // Sumber data yang dibaca AI -- daftar kategori yang sama dengan EXEC_SOURCE_REGISTRY
  // di RichMessage.tsx (dipakai untuk penanda [[src:...]] di jawaban AI), murni informatif.
  const dataSources = [
    { label: 'Kas & Keuangan', meta: 'saldo, beban, runway', icon: <FileSpreadsheet size={14} strokeWidth={1.7} />, tone: '#3FBF8F' },
    { label: 'Metrik Pemasaran', meta: 'ROAS, CAC, lead', icon: <TrendingUp size={14} strokeWidth={1.7} />, tone: '#4E9BFF' },
    { label: 'Beban Tim & SDM', meta: 'utilisasi, SLA', icon: <Users size={14} strokeWidth={1.7} />, tone: '#8CBEFF' },
    { label: 'Piutang Klien', meta: 'invoice, jatuh tempo', icon: <Receipt size={14} strokeWidth={1.7} />, tone: '#C9A66B' },
  ];

  // Skor kesehatan bisnis -- data NYATA dari klir_live_company_state (healthScore).
  // FIX (sesi ini): komentar lama di sini KLAIM fallback "sama persis dengan default
  // CompanyDataDashboard.tsx" TAPI TERBUKTI SALAH -- default asli dashboard itu
  // (CompanyDataDashboard.tsx baris 523-527) adalah {totalScore:0, grade:'WAITING',
  // breakdown semua 0}, BUKAN {85,'EXCELLENT',95/100/35/100}. Akibatnya utk workspace
  // kosong yang sama, Dashboard Perusahaan bilang Skor 0/WAITING tapi sidebar ini
  // bilang Skor 85/Sangat baik -- kontradiksi identik kelas bug kas bersih. Sekarang
  // di-copy verbatim dari CompanyDataDashboard.tsx supaya benar-benar konsisten.
  // CARA MEMBATALKAN: kembalikan literal 85/EXCELLENT/95-100-35-100 di 4 baris di bawah.
  const hsRaw = liveStats.healthScore || { totalScore: 0, grade: 'WAITING', breakdown: { finance: 0, growth: 0, operations: 0, strategy: 0 } };
  const hsScore = hsRaw.totalScore ?? 0;
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

  // Belum ada sumber backend struktur tim per divisi. Jangan tampilkan org-chart
  // ilustratif sebagai data perusahaan nyata.
  const hasDivisions = Array.isArray(liveTeamOps.divisions) && liveTeamOps.divisions.length > 0;
  const divisionLoad: { name: string; members: number; loadPercent: number }[] =
    hasDivisions ? liveTeamOps.divisions : [];

  // Runway kas -- data NYATA dari liveFinancials.runwayMonths.
  // FIX (sesi ini): `|| 99` menangkap runway KRITIS beneran (0 bulan, backend
  // context-engine.ts sengaja mengembalikan 0.0 literal untuk kas habis) sebagai
  // falsy sama seperti "belum ada data" -- widget ini jadi nampilin hijau/100% aman
  // padahal perusahaan lagi kehabisan kas. `??` cuma fallback kalau field-nya
  // BENERAN belum ada (liveFinancials = {} sebelum data pertama masuk), bukan
  // kalau nilainya 0 yang sah.
  const hasRunway = typeof liveFinancials.runwayMonths === 'number' && (
    (liveFinancials.netCashBalance ?? 0) !== 0 ||
    (liveFinancials.revenue30d ?? 0) !== 0 ||
    (liveFinancials.expense30d ?? 0) !== 0
  );
  const runwayMonths = hasRunway ? liveFinancials.runwayMonths : 0;
  const runwayCapped = Math.min(Math.max(runwayMonths, 0), 24);
  const runwayPercent = Math.round((runwayCapped / 24) * 100);
  // FIX (audit workflow, sesi ini): tambah tier merah, konsisten dengan fix yang sama
  // di FinanceAIAssistantView.tsx -- dulu cuma 3 tier, gak ada yang genuinely "kritis".
  const runwayColor = !hasRunway ? '#8A93A3' : runwayMonths >= 12 ? '#3FBF8F' : runwayMonths >= 6 ? '#C9A66B' : runwayMonths >= 3 ? '#D8A33C' : '#EF4444';

  // FIX (audit role-fit 7 Sep): generatedFiles.length menghitung 4 file seed demo
  // (lihat useState di atas) yang tidak pernah benar-benar dibuat AI untuk workspace
  // ini -- baseline permanen +4 walau workspace baru kosong, kontradiksi komentar
  // ini sendiri yang klaim "nyata, bukan karangan". Diganti pola yang SUDAH BENAR di
  // FinanceAIAssistantView.tsx & MarketingAIAssistantView.tsx: hitung dari pesan chat
  // yang benar-benar berisi file/gambar/media/notebook nyata.
  const filesCreatedCount = chats.reduce(
    (n, c) => n + c.messages.filter((m) => m.realFile || m.realImage || m.studioMedia?.status === 'ready' || m.studioNotebook).length,
    0
  );
  const aiOutputs = [
    { label: 'File dibuat', value: filesCreatedCount },
    { label: 'Instruksi dieksekusi', value: (liveStats.directives || []).length },
    { label: 'Percakapan', value: chats.length },
  ];


  // Rekomendasi siap dieksekusi -- 3 rekomendasi baku yang sama dengan tombol
  // "Aksi dashboard perusahaan" di sidebar, tapi statusnya (sudah diterapkan
  // atau belum) dihitung dari angka live yang sama dipakai kartu ringkasan di
  // atas -- bukan status yang dikarang.
  // FIX (sesi ini): 3 masalah null-safety/data-karangan di sini --
  // (1) 'ads' -- done: liveRoas>=3.4 crash-prone kalau liveRoas null (workspace
  //     kosong), sekarang di-guard hasRoas &&.
  // (2) 'ar' -- KELUARKAN kartu ini kalau !hasAr (tidak ada sumber piutang live
  //     sama sekali) -- merekomendasikan "Tagih piutang PT Sentosa Abadi Rp19,4jt"
  //     sementara kartu ringkasan di atas sendiri baru saja mengaku "belum ada
  //     data piutang tercatat" adalah kontradiksi baru. Opsi paling aman: hide,
  //     bukan genericize (ikuti anjuran commander).
  // (3) 'hire' -- BUG BARU yang lolos kalau cuma ganti isi tanpa cek edge case:
  //     `null <= 80` javascript coercion = `0 <= 80` = TRUE, artinya kartu akan
  //     SALAH ditandai "sudah diterapkan" walau kita belum punya data beban tim
  //     sama sekali. KELUARKAN kartu ini juga kalau !hasLoad (konsisten dgn poin 2),
  //     dan teks impact diganti generik tanpa angka tetap.
  // CARA MEMBATALKAN: kembalikan 3 objek literal lama (liveRoas>=3.4 tanpa guard,
  // kartu 'ar'/'hire' tanpa filter kondisional, teks lama termasuk nama klien).
  const decisionsList = [
    ...(hasRoas ? [{
      key: 'ads', icon: <TrendingUp size={16} strokeWidth={1.7} />, tone: '#3FBF8F',
      title: 'Scale anggaran iklan video +20%', impact: '+Rp 6,2 jt omset / bulan',
      done: liveRoas >= 3.4, prompt: 'Scale budget iklan video TikTok 20% dan update ke dashboard',
    }] : []),
    ...(hasAr ? [{
      key: 'ar', icon: <Receipt size={16} strokeWidth={1.7} />, tone: '#C9A66B',
      title: 'Tinjau piutang jatuh tempo', impact: `${arDisplay} berpotensi tertagih`,
      done: false, prompt: 'Tinjau status piutang jatuh tempo kami saat ini.',
    }] : []),
    ...(hasLoad ? [{
      key: 'hire', icon: <Users size={16} strokeWidth={1.7} />, tone: '#4E9BFF',
      title: 'Rekrut 1 staf video editor', impact: 'Kurangi beban tim yang tinggi dengan tambahan staf',
      done: hasLoad && liveLoad <= 80, prompt: 'Rekrut 1 staf video editor tambahan untuk kurangi beban tim',
    }] : []),
  ];
  const pendingDecisions = decisionsList.filter((d) => !d.done).length;

  return (
    <div style={{ height: '100%', background: '#06080C', padding: '14px', fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", color: '#F5F7FA', WebkitFontSmoothing: 'antialiased', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes klirFade { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
        @keyframes klirSpin { to { transform: rotate(360deg); } }
        @keyframes klirFloat { 0%, 100% { transform: translateY(-3px) rotateX(13deg) rotateY(-17deg); } 50% { transform: translateY(4px) rotateX(8deg) rotateY(-11deg); } }
        @keyframes klirRise { 0%, 100% { transform: scaleY(0.55); } 50% { transform: scaleY(1); } }
        @keyframes klirGlow { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes klirSweep { 0% { transform: translateX(-140%) skewX(-18deg); } 55%, 100% { transform: translateX(320%) skewX(-18deg); } }
        @keyframes klirBarIn { from { width: 0; } }
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
        style={{ display: 'flex', height: '100%', background: '#080A0F', border: 0, borderRadius: '20px', overflow: 'hidden', position: 'relative', boxShadow: '0 4px 24px -2px rgba(0,0,0,0.5)' }}
      >
        <DragDropFileOverlay isDragging={isDraggingFile} />
        {/* ========================================================================= */}
        {/* 1. SIDEBAR */}
        {/* ========================================================================= */}
        {sidebarOpen && (
          <aside style={{ width: '274px', flexShrink: 0, background: '#06080C', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '14px 12px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', minHeight: 0, paddingRight: '2px' }}>
              {/* Workspace Badge Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2px 4px 12px', borderBottom: 0 }}>
                <span style={{ display: 'flex', width: '31px', height: '31px', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: '#0058BE', fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>
                  {workspaceName.trim().charAt(0).toUpperCase()}
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, textAlign: 'left' }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {workspaceName}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userName}
                  </span>
                </span>
                <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#C9A66B', border: 0, background: 'rgba(201,166,107,0.14)', borderRadius: '999px', padding: '2.5px 8px' }}>
                  Business
                </span>
              </div>

              {/* Action Buttons: New Chat + Collapse */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleNewChat}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '9px 11px', border: 0, borderRadius: '12px', background: '#0058BE', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Plus size={14} strokeWidth={2.1} />
                    <span>Obrolan Baru</span>
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', ui-monospace, Menlo, monospace", fontSize: '9px', letterSpacing: '0.04em', background: 'rgba(0,0,0,0.28)', padding: '3px 6px', borderRadius: '6px' }}>
                    Ctrl K
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  title="Sembunyikan Menu Samping"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 9px', border: 0, borderRadius: '12px', background: 'rgba(255,255,255,0.04)', color: '#8A93A3', cursor: 'pointer' }}
                >
                  <PanelLeftClose size={14} color="#4E9BFF" strokeWidth={1.7} />
                </button>
              </div>

              {/* Ruang Kerja */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', padding: '0 8px 7px', textAlign: 'left' }}>
                  Ruang kerja
                </span>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'rgba(78,155,255,0.08)', color: '#4E9BFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Settings2 size={15} color="#4E9BFF" strokeWidth={2} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pengaturan CEO</span>
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#4E9BFF', background: 'rgba(78,155,255,0.18)', padding: '2px 6px', borderRadius: '6px' }}>
                    4 Tab
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilesOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Folder size={15} color="#4E9BFF" strokeWidth={1.7} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>File hasil AI</span>
                  <span style={{ flexShrink: 0, fontSize: '10.5px', color: '#8A93A3' }}>{generatedFiles.length}</span>
                </button>
                {/* Item 4.1 roadmap 7 Sep -- Pusat Data, terpisah dari "File hasil AI" di
                    atas: yang itu hasil GENERATE AI (mockup, session-only), ini file yang
                    DIUNGGAH user dan tersimpan permanen server-side. */}
                <button
                  type="button"
                  onClick={() => setDataHubOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Database size={15} color="#4E9BFF" strokeWidth={1.7} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pusat Data</span>
                </button>
                {/* 'Kelola plugin' dihapus (audit role-fit 7 Sep) -- setPluginEnabled tidak
                    pernah dipanggil dari UI manapun di file ini (cuma dideklarasikan), dan
                    tombol ini cuma duplikat fungsi tombol "Pengaturan CEO" di atas (sama-sama
                    onClick={() => setSettingsOpen(true)}). Perlakuan sama diterapkan di
                    FinanceAIAssistantView.tsx sesi ini juga. Untuk membatalkan: kembalikan
                    blok <button> 'Kelola plugin' (lihat histori git). */}
                <button
                  type="button"
                  onClick={() => setSkillsOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Wand2 size={15} color="#D8A33C" strokeWidth={1.7} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Skill kustom</span>
                  <span style={{ flexShrink: 0, fontSize: '10.5px', color: '#8A93A3' }}>{customSkills.length}</span>
                </button>
                {/* FIX gap kemampuan-002/005 (audit 7 Sep 2026): tombol ini dulu membuka
                    modal "akses per-divisi" penuh dengan grid toggle yang terlihat 100%
                    berfungsi (bisa diklik, berubah warna) TAPI 0% berefek di manapun --
                    adminOverrides/accessMode HANYA dibaca di dalam modal itu sendiri
                    (tidak pernah menggating capGroups/tools/actions), dan bahkan kalau
                    dibaca pun, Finance/Marketing adalah instance komponen React TERPISAH
                    (state tidak dibagi lintas portal) -- jadi toggle di modal CEO ini
                    struktural TIDAK BISA membatasi apapun untuk divisi lain tanpa
                    penyimpanan bersama (localStorage/DB) + skema akses granular, yang
                    perlu keputusan Fatur/Mecca (lihat audit gap-002, butuhKeputusanManusia).
                    Sampai itu ada, disamakan dengan perilaku Marketing (toast jujur,
                    bukan modal yang keliatan lengkap tapi kosong). Modal lama (adminOpen/
                    accessMode/adminOverrides/toggleAdminCap di bawah) DIPERTAHANKAN
                    apa adanya sebagai referensi/starting point kalau RBAC nyata sudah
                    siap -- tapi sekarang jadi unreachable karena tidak ada lagi pemanggil
                    setAdminOpen(true). CARA MEMBATALKAN: kembalikan onClick di bawah jadi
                    () => setAdminOpen(true). */}
                {/* 10 Sep 2026 (Fable, kontrak ceo-build item g) -- DIGANTI dari
                    tombol toast-only jadi baris teks non-klik: tombol yang
                    bisa diklik tapi cuma memicu toast "belum tersambung"
                    tetap terasa seperti janji palsu (ada affordance klik,
                    hasilnya nol). Baris teks statis lebih jujur -- tidak ada
                    lagi kesan "ini fitur yang bisa dipencet". */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', color: '#6B7280', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left' }}
                >
                  <Sliders size={15} color="#6B7280" strokeWidth={1.7} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pengaturan akses per divisi belum tersedia</span>
                </div>
              </div>

              {/* Kemampuan & Tools AI */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => toggleBoolPref('klir_ai_nav_tools', setShowToolsNav)}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '0 8px 7px', border: 0, background: 'transparent', color: '#8A93A3', fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  {showToolsNav ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Kemampuan &amp; tools AI</span>
                  {/* 11 Sep 2026 (kontrak B4): +capSidebarCount -- 28 kemampuan eks-grid
                      "Semua kemampuan AI" (dikurangi yang di-dedup) sekarang ikut dihitung
                      di sini karena isinya genuinely pindah ke bawah, bukan dihapus. */}
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#8A93A3' }}>{tools.length + pluginItems.length + pills.length + capSidebarCount}</span>
                </button>
                {showToolsNav && tools.map((tool, idx) => (
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
                {/* Studio Media & Plugin AI -- dipindah dari dropdown "Plugin & Tools" di
                    composer (dulu 2 titik render: welcome state + active-chat state, plus
                    1 tombol toggle di tiap titik) ke sini, biar SATU zona kemampuan AI
                    konsisten di sidebar kiri (audit konsistensi UI 7 Sep, arahan Mecca).
                    Mekanisme onClick per item TIDAK diubah dari aslinya:
                      p.kind    -> openStudio(p.kind, inputMessage)  (buka modal Studio Media)
                      p.upload  -> fileInputRef.current?.click()    (buka file picker)
                      lainnya   -> handleSendMessage(p.prompt)      (kirim prompt tetap)
                    CATATAN JUJUR: 3 item di sini (pdf/excel/word) mekanismenya identik satu
                    sama lain DAN identik dengan 2 item tools[] di atas ("Unggah & Analisis
                    Dokumen" / "Ringkasan & Tanya Jawab Dokumen") -- kelimanya cuma buka file
                    picker generik yang sama, tanpa filter tipe file. SENGAJA belum di-dedup
                    (di luar cakupan literal rule dedup pills-vs-tools) -- diflag ke Mecca,
                    lihat laporan sesi build. */}
                {showToolsNav && pluginItems.map((p, idx) => (
                  <button
                    key={`plugin-${idx}`}
                    type="button"
                    onClick={() => {
                      if (p.locked) {
                        showToast(TAX_FEATURE_LOCK_MESSAGE, 3200);
                      } else if (p.docTemplate) {
                        openStudio(p.kind || 'image', inputMessage, undefined, 'template');
                      } else if (p.kind) {
                        openStudio(p.kind, inputMessage);
                      } else if (p.upload) {
                        fileInputRef.current?.click();
                      } else {
                        handleSendMessage(p.prompt);
                      }
                    }}
                    aria-disabled={p.locked || undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: p.locked ? 'rgba(255,255,255,0.025)' : 'transparent', color: p.locked ? '#737B89' : '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: p.locked ? 'not-allowed' : 'pointer' }}
                  >
                    {p.icon}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.title}
                    </span>
                  </button>
                ))}
                {/* Pintasan prompt -- dulu "pills" di bawah kotak input (2 titik render:
                    welcome state + active-chat state), dipindah ke sini. Mekanisme onClick
                    TETAP handleSendMessage(pill.prompt). Tidak ada yang di-dedup (1 kandidat
                    "Riset & analisis data" vs "Riset Kompetitor" di atas, confidence RENDAH
                    -- beda tujuan: riset data internal bulanan vs riset kompetitor eksternal). */}
                {showToolsNav && pills.map((pill, idx) => (
                  <button
                    key={`pill-${idx}`}
                    type="button"
                    onClick={() => handleSendMessage(pill.prompt)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                  >
                    {pill.icon}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {pill.label}
                    </span>
                  </button>
                ))}
                {/* 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): eks-grid "Semua
                    kemampuan AI" -- dikelompokkan per kategori (judul kecil, dedup exact-label
                    terhadap tools/pluginItems/pills di atas, lihat capSidebarGroups). Klik = perilaku
                    SAMA seperti grid lama (openStudio kalau openStudioKind ada, kalau tidak
                    handleSendMessage(prompt)). */}
                {showToolsNav && capSidebarGroups.map((grp, gi) => (
                  <div key={`capgrp-${gi}`} style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: gi === 0 ? '6px' : '0' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 8px 3px', fontSize: '10px', fontWeight: 600, color: grp.tone, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      <span style={{ display: 'block', width: '5px', height: '5px', borderRadius: '99px', background: grp.tone, flexShrink: 0 }} />
                      {grp.title}
                    </span>
                    {grp.items.map((cap, ci) => (
                      <button
                        key={`cap-${gi}-${ci}`}
                        type="button"
                        onClick={() => cap.locked ? showToast(TAX_FEATURE_LOCK_MESSAGE, 3200) : (cap.openStudioKind ? openStudio(cap.openStudioKind, cap.prompt) : handleSendMessage(cap.prompt))}
                        aria-disabled={cap.locked || undefined}
                        title={cap.note}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: cap.locked ? 'rgba(255,255,255,0.025)' : 'transparent', color: cap.locked ? '#737B89' : '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: cap.locked ? 'not-allowed' : 'pointer' }}
                      >
                        {cap.icon}
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cap.label}</span>
                          <span style={{ fontSize: '10.5px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cap.note}</span>
                        </span>
                        {cap.locked && <Lock size={11} color="#C9A66B" strokeWidth={2} style={{ flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>

              {/* Aksi Dashboard Perusahaan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => toggleBoolPref('klir_ai_nav_actions', setShowActionsNav)}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '0 8px 7px', border: 0, background: 'transparent', color: '#8A93A3', fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  {showActionsNav ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Aksi dashboard perusahaan</span>
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#8A93A3' }}>{actions.length}</span>
                </button>
                {showActionsNav && actions.map((act, idx) => (
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

              {/* Fitur kerja dibuka dari AI Assistant, bukan ditumpuk di bawah
                  dashboard overview. Label mengikuti fitur yang benar-benar
                  dilihat pengguna; nama modul internal tidak dipajang. */}
              {(onOpenWorkspace || onOpenSchedule || onOpenInventory) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', padding: '0 8px 7px', textAlign: 'left' }}>
                    Pintasan kerja
                  </span>
                  {onOpenWorkspace && (
                    <button
                      type="button"
                      onClick={onOpenWorkspace}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                    >
                      <ClipboardCheck size={14} strokeWidth={1.7} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Buka operasional tim</span>
                    </button>
                  )}
                  {onOpenSchedule && (
                    <button
                      type="button"
                      onClick={onOpenSchedule}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                    >
                      <Calendar size={14} strokeWidth={1.7} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Buka reservasi &amp; antrean</span>
                    </button>
                  )}
                  {onOpenInventory && (
                    <button
                      type="button"
                      onClick={() => setInputMessage(INVENTORY_AI_PROMPT)}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                    >
                      <Package size={14} strokeWidth={1.7} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Kelola stok lewat AI</span>
                    </button>
                  )}
                </div>
              )}

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
                      ? `${firstUserMsg.text.slice(0, 34).trim()}…`
                      : firstUserMsg.text
                    : 'Percakapan baru';

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '12px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#8A93A3' }}>
                <ShieldCheck size={12} color="#3FBF8F" strokeWidth={1.8} />
                <span>Open Intelligence &amp; OS</span>
              </span>
            </div>
          </aside>
        )}

        {/* ========================================================================= */}
        {/* 2. MAIN CHAT WORKSPACE */}
        {/* ========================================================================= */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#080A0F' }}>
          {/* Sub Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 18px', borderBottom: 0, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  title="Tampilkan Menu Samping"
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <PanelLeft size={15} color="#4E9BFF" strokeWidth={1.7} />
                  <span>Menu AI</span>
                </button>
              )}
              <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.01em', color: '#F5F7FA', whiteSpace: 'nowrap' }}>
                KLIR Executive AI Assistant
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
              <span style={{ fontSize: '11.5px', color: '#8A93A3', whiteSpace: 'nowrap' }}>{workspaceName}</span>
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={handleNewChat}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 11px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#8A93A3', fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={13} />
                  <span>Obrolan Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* Toast Notification */}
          {toastMsg && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: '12px 18px 0', padding: '10px 14px', border: 0, borderRadius: '12px', background: 'rgba(63,191,143,0.12)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', animation: 'klirFade 220ms ease-out', flexShrink: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12.5px', fontWeight: 500, color: '#BFEFDC' }}>
                <CheckCircle2 size={15} color="#3FBF8F" strokeWidth={1.9} />
                <span>{toastMsg}</span>
              </span>
              <button
                type="button"
                onClick={() => setToastMsg(null)}
                style={{ border: 0, background: 'transparent', color: '#8A93A3', cursor: 'pointer', display: 'flex', padding: '2px' }}
              >
                <X size={15} strokeWidth={1.9} />
              </button>
            </div>
          )}

          {/* Peringatan proaktif (F2 Tingkat B, 10 Sep 2026): wadah reusable, sumber dari
              registry proactive-alerts.ts. Tidak render apa pun kalau 0 kartu. */}
          <div style={{ padding: '12px 18px 0' }}>
            <ProactiveAlertsPanel role="CEO" workspaceId={workspaceId || ''} onOpenInventory={onOpenInventory} onAskAI={(p) => setInputMessage(p)} />
          </div>

          {/* ======================================================================= */}
          {/* A. EMPTY HERO HOME VIEW */}
          {/* ======================================================================= */}
          {!hasUserMessage ? (
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'radial-gradient(115% 62% at 50% -6%, rgba(0,88,190,0.11), rgba(0,88,190,0) 62%)' }}>
              <div style={{ maxWidth: '1180px', margin: '0 auto', width: '100%', padding: '0 40px 76px', display: 'flex', flexDirection: 'column', flex: '1 0 auto' }}>
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
                    Ada yang bisa saya bantu hari ini, {userName}?
                  </h1>
                </div>

                {/* Composer Box */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '880px', margin: '0 auto' }}>
                  {/* Attachment Pill */}
                  {attachedFile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', padding: '11px 14px', border: 0, borderRadius: '14px', background: '#0D1117', boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
                      {fileBadge(attachedFile.name, 38)}
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {attachedFile.name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fileKind(attachedFile.name).label} &middot; {attachedFile.size}
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontSize: '10.5px', color: '#3FBF8F' }}>
                        <CheckCircle2 size={12} color="#3FBF8F" strokeWidth={1.9} />
                        <span>Siap dibaca</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        title="Hapus lampiran"
                        style={{ display: 'flex', flexShrink: 0, border: 0, background: 'transparent', color: '#8A93A3', cursor: 'pointer', padding: '3px', borderRadius: '7px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {/* Item 4.5 roadmap 7 Sep -- kartu pemeriksaan dokumen. */}
                  {attachedFile?.documentCheck && (
                    <div style={{ marginBottom: '10px' }}>
                      <DocumentCheckCard report={attachedFile.documentCheck} fileName={attachedFile.name} />
                    </div>
                  )}

                  {/* Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '11px', padding: '17px 17px 13px', border: 0, borderRadius: '18px', background: '#0D1117', boxShadow: '0 14px 38px rgba(0,0,0,0.45)' }}
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

                    {/* Setelan Jawaban + chip mode/mic (8 Sep 2026, B5-wiring-3-view) --
                        row baru, TIDAK menggantikan row Paperclip/Kirim di bawah. */}
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
                          disabled={(!inputMessage.trim() && !attachedFile) || isTyping}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                                                      width: '34px', height: '34px', padding: 0, justifyContent: 'center',
                            borderRadius: '999px',
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: (inputMessage.trim() || attachedFile) && !isTyping ? 'pointer' : 'not-allowed',
                            background: (inputMessage.trim() || attachedFile) && !isTyping ? '#0058BE' : 'rgba(255,255,255,0.04)',
                            border: 0,
                            color: (inputMessage.trim() || attachedFile) && !isTyping ? '#FFFFFF' : '#8A93A3',
                          }}
                        >
                          <Send size={15} strokeWidth={1.9} />
                        </button>
                      }
                    />
                  </form>
                </div>

                {/* Tombol perlihatkan/sembunyikan blok data perusahaan */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                  <button
                    type="button"
                    onClick={() => toggleBoolPref('klir_ai_show_data', setShowData)}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.04)', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {showData ? <ChevronUp size={14} strokeWidth={1.7} /> : <BarChart2 size={14} strokeWidth={1.7} />}
                    <span>{showData ? 'Sembunyikan data perusahaan' : 'Tampilkan data perusahaan'}</span>
                  </button>
                </div>

                {showData && (
                  <>
                    {/* Ringkasan Perusahaan Card */}
                    <div style={{ marginTop: '14px', border: 0, borderRadius: '16px', background: '#0D1117', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '14px 18px', borderBottom: 0, background: 'transparent' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
                          <span style={{ width: '5px', height: '5px', borderRadius: '99px', background: '#3FBF8F' }} />
                          <span>Ringkasan perusahaan Anda</span>
                        </span>
                        <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>Tren tampil setelah histori pembanding tersedia</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', padding: '0 14px 14px', background: 'transparent' }}>
                        {stats.map((s, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(s.prompt)}
                            style={{ display: 'flex', flexDirection: 'column', gap: '7px', padding: '14px 15px', border: 0, borderRadius: '12px', background: 'rgba(255,255,255,0.02)', textAlign: 'left', cursor: 'pointer' }}
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
                              <Database size={10.5} color="#8A93A3" strokeWidth={1.9} />
                              <span>{s.source}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Skor kesehatan bisnis + Sumber data yang dibaca AI */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginTop: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', border: 0, borderRadius: '16px', background: '#0D1117', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        <div style={{ padding: '14px 18px', borderBottom: 0, background: 'transparent' }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Skor kesehatan bisnis</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '0 18px 18px' }}>
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

                      <div style={{ display: 'flex', flexDirection: 'column', border: 0, borderRadius: '16px', background: '#0D1117', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '14px 18px', borderBottom: 0, background: 'transparent' }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Sumber data yang dibaca AI</span>
                          <span style={{ flex: 1, textAlign: 'right', fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>4 sistem divisi &middot; tersambung langsung</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '0 18px 18px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, minWidth: 0 }}>
                            {dataSources.map((src, idx) => (
                              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', flexShrink: 0, borderRadius: '9px', background: `${src.tone}1C`, border: 0, color: src.tone }}>
                                  {src.icon}
                                </span>
                                <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
                                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.label}<TermHint label={src.label} /></span>
                                  <span style={{ fontSize: '10.5px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.meta}</span>
                                </span>
                              </span>
                            ))}
                          </div>
                          <div style={{ position: 'relative', width: '52px', height: '150px', flexShrink: 0 }} aria-hidden="true">
                            <svg width={52} height={150} viewBox="0 0 52 150" style={{ display: 'block' }}>
                              {DATA_FLOW_PATHS.map((d, i) => (
                                <path key={`t${i}`} d={d} style={{ fill: 'none', stroke: 'rgba(255,255,255,0.09)', strokeWidth: 1.4 }} />
                              ))}
                              {DATA_FLOW_PATHS.map((d, i) => (
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
                    <div style={{ marginTop: '14px', border: 0, borderRadius: '16px', background: '#0D1117', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '14px 18px', borderBottom: 0, background: 'transparent' }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Rekomendasi siap dieksekusi</span>
                        <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>
                          {pendingDecisions ? `${pendingDecisions} menunggu keputusan Anda` : 'Semua rekomendasi sudah diterapkan'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', padding: '0 10px 10px', gap: '6px' }}>
                        {decisionsList.map((d) => (
                          <div key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '11px', flex: '1 1 252px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flexShrink: 0, borderRadius: '10px', background: d.done ? 'rgba(63,191,143,0.14)' : `${d.tone}1F`, border: 0, color: d.done ? '#3FBF8F' : d.tone }}>
                              {d.done ? <Check size={16} strokeWidth={1.7} /> : d.icon}
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
                      <div style={{ display: 'flex', flexDirection: 'column', border: 0, borderRadius: '16px', background: '#0D1117', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '14px 18px', borderBottom: 0, background: 'transparent' }}>
                          <span style={{ flexShrink: 0, fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Beban per divisi</span>
                          <span style={{ flex: 1, textAlign: 'right', fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ambang aman di bawah 80%</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', padding: '0 18px 18px' }}>
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
                          }) : <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Belum ada data struktur tim tercatat.</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', border: 0, borderRadius: '16px', background: '#0D1117', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '14px 18px', borderBottom: 0, background: 'transparent' }}>
                          <span style={{ flexShrink: 0, fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>Hasil kerja AI</span>
                          <span style={{ flex: 1, textAlign: 'right', fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ringkasan operasional</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 18px 18px' }}>
                          <div style={{ display: 'flex', gap: '8px', background: 'transparent' }}>
                            {aiOutputs.map((out, idx) => (
                              <span key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', minWidth: 0 }}>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1, color: '#F5F7FA' }}>{out.value}</span>
                                <span style={{ fontSize: '10px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{out.label}</span>
                              </span>
                            ))}
                          </div>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingTop: '2px' }}>
                            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', paddingTop: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Runway kas</span>
                              {/* FIX (sesi ini): warna teks angka ini dulu hardcode hijau (#3FBF8F)
                                  permanen -- teks sudah benar nunjukin "0 bulan" (kritis) tapi
                                  warnanya tetap hijau seolah aman, kontradiksi visual sama teksnya
                                  sendiri. Pakai runwayColor yang sudah dihitung benar (sama yang
                                  dipakai bar progress di bawah), bukan warna lepas sendiri. */}
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, color: runwayColor }}>{hasRunway ? (runwayMonths >= 24 ? '24 bulan+' : `${runwayMonths} bulan`) : 'Belum ada data'}</span>
                            </span>
                            <span style={{ display: 'block', height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                              <span style={{ display: 'block', height: '100%', borderRadius: '99px', width: `${hasRunway ? runwayPercent : 0}%`, background: runwayColor }} />
                            </span>
                            <span style={{ fontSize: '10px', color: '#8A93A3' }}>{hasRunway ? (runwayMonths >= 18 ? 'Kas aman jauh di atas ambang 6 bulan' : 'Pantau laju belanja bulanan') : 'Belum ada data runway tercatat'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
                </div>

                {/* 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): grid "Semua
                    kemampuan AI" DIHAPUS dari area utama -- 28 kemampuan (capabilities/
                    capCats/capGroups di atas, TIDAK dihapus datanya) dipindah ke sidebar
                    kiri "Kemampuan & tools AI" (lihat render grouped-list dekat
                    tools.map/pluginItems.map/pills.map). Galeri "Mulai dari tugas nyata"
                    di bawah TETAP (tidak diminta hapus). */}

                {/* "Mulai dari tugas nyata" Gallery */}
                <div style={{ marginTop: '64px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', paddingBottom: '14px', borderBottom: 0 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, letterSpacing: '-0.012em', color: '#F5F7FA' }}>
                        Mulai dari tugas nyata
                      </span>
                      <span style={{ fontSize: '12px', color: '#8A93A3' }}>
                        Sembilan pekerjaan yang paling sering diminta pimpinan. Satu klik, langsung dikerjakan.
                      </span>
                    </span>
                    <span style={{ flexShrink: 0, fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>Tanpa perlu menulis prompt</span>
                  </div>

                  {gallery.map((cat, ci) => (
                    <div key={ci} style={{ marginTop: '30px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                        <span style={{ display: 'block', width: '6px', height: '6px', borderRadius: '99px', background: cat.dotColor, flexShrink: 0 }} />
                        <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#C6CEDA', whiteSpace: 'nowrap' }}>
                          {cat.title}
                        </h4>
                        <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '16px' }}>
                        {cat.cards.map((card, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSendMessage(card.p)}
                            style={{ display: 'flex', flexDirection: 'column', padding: 0, border: 0, borderRadius: '16px', background: '#0D1117', overflow: 'hidden', textAlign: 'left', cursor: 'pointer', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.35)' }}
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
                              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '11px 0 14px', borderTop: 0, fontSize: '11.5px', fontWeight: 500, color: '#8A93A3' }}>
                                <span>Jalankan sekarang</span>
                                <ArrowRightIcon size={14} strokeWidth={1.7} />
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
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '20px 18px 8px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
                  {messages.map((msg) => {
                    const isAI = msg.sender === 'ai';

                    return (
                      <div key={msg.id} className="group" style={{ display: 'flex', flexDirection: 'column' }}>
                        {isAI ? (
                          /* AI Message */
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
                            <span style={{ display: 'flex', width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: 'rgba(255,255,255,0.05)', border: 0, flexShrink: 0, marginTop: '2px', overflow: 'hidden' }}>
                              {/* 8 Sep malam (feedback Mecca: kayak Claude/ChatGPT/Gemini -- avatar
                                  logo produk, bukan ikon robot generik). Sama seperti logo layar
                                  kosong di file ini. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/Logo-KLIR.png" alt="KLIR" width={16} height={16} style={{ display: 'block', objectFit: 'contain' }} />
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: 'min(88%, 660px)', minWidth: 0 }}>
                              {/* Penanda GAGAL KONEKSI -- tidak mungkin terlewat, beda dari jawaban
                                  asli manapun (lihat komentar isSystemError di interface ChatMessage) */}
                              {msg.isSystemError && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start', padding: '4px 10px', borderRadius: '999px', border: 0, background: 'rgba(216,163,60,0.14)', fontSize: '10.5px', fontWeight: 700, color: '#D8A33C' }}>
                                  <AlertTriangle size={12} color="#D8A33C" strokeWidth={2} />
                                  <span>Koneksi data terputus — bukan jawaban dari data asli</span>
                                </div>
                              )}
                              <div style={{ padding: '14px 16px', border: msg.isSystemError ? '1px solid rgba(216,163,60,0.35)' : 0, boxShadow: '0 4px 18px rgba(0,0,0,0.35)', borderRadius: '16px', borderTopLeftRadius: '5px', background: '#0D1117', fontSize: '13px', lineHeight: 1.65, color: '#C6CEDA' }}>
                                <RichMessage content={msg.text} accent="executive" />
                                {/* 8 Sep malam (feedback Mecca: sumber tampil LANGSUNG di jawaban,
                                    ala Claude/ChatGPT/Gemini -- bukan kartu terpisah di luar
                                    gelembung). Dipindah ke sini, tepat di bawah teks jawaban. */}
                                {msg.researchSources && (
                                  <ResearchSourcesCard sources={msg.researchSources.sources} fetchedAt={msg.researchSources.fetchedAt} note={msg.researchSources.note} />
                                )}
                              </div>

                              {msg.isSystemError && msg.retryText && (
                                <button
                                  type="button"
                                  onClick={() => handleSendMessage(msg.retryText)}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', alignSelf: 'flex-start', padding: '8px 14px', border: 0, borderRadius: '10px', background: 'rgba(216,163,60,0.14)', color: '#D8A33C', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  <RefreshCw size={13} strokeWidth={1.9} />
                                  <span>Coba Lagi</span>
                                </button>
                              )}

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
                                      {copiedId === msg.id ? <Check size={13} color="#3FBF8F" strokeWidth={1.7} /> : <Copy size={13} strokeWidth={1.7} />}
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
                                  {/* SETELAN JAWABAN OTOMATIS (11 Sep 2026, kontrak modul 1+2+4) --
                                      badge kecil "Otomatis: <effort> - <tier>", HANYA tampil kalau
                                      backend genuinely memilihkan effort sendiri (effortAuto true,
                                      body.effort tidak dikirim eksplisit dari composer). Style
                                      IDENTIK msg.timestamp/msg.modelUsed di atas (non-intrusif,
                                      bukan warna/ukuran baru) sesuai kontrak. */}
                                  {msg.effortAuto && msg.effortUsed && (
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#454C59' }}>
                                      &middot; Otomatis: {msg.effortUsed}{msg.modelTierUsed ? ` - ${msg.modelTierUsed}` : ''}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* V3 TOMBOL LANJUTAN (8 Sep 2026) -- lihat handleNextAction dekat
                                  openStudio/submitStudio. Digate juga oleh !msg.isSystemError
                                  supaya tidak nempel di pesan "koneksi data terputus" di atas. */}
                              {msg.nextActions && msg.nextActions.length > 0 && !msg.isSystemError && (
                                <NextActionsBar actions={msg.nextActions} accent="executive" onAction={handleNextAction} />
                              )}

                              {msg.realImage && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, border: 0, borderRadius: '16px', background: '#0D1117', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', overflow: 'hidden', maxWidth: '398px' }}>
                                  <div style={{ position: 'relative' }}>
                                    <span style={{ position: 'absolute', top: '10px', left: '11px', zIndex: 2, fontSize: '9.5px', fontWeight: 600, color: '#3FBF8F', background: 'rgba(6,8,12,0.78)', border: 0, padding: '3px 9px', borderRadius: '999px' }}>
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
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', height: '34px', borderRadius: '9px', background: '#3FBF8F', color: '#06080C', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
                                    >
                                      <Download size={13} />
                                      <span>Buka / unduh gambar</span>
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* Studio Template & Notebook (additive) -- lihat komentar di dekat pluginCatalog */}
                              {(msg.studioMedia || msg.studioNotebook || msg.studioSubmission) && <StudioResult
                                message={{ media: msg.studioMedia, notebook: msg.studioNotebook, submission: msg.studioSubmission, pending: msg.studioPending, failed: msg.studioFailed, draftScript: msg.studioDraftScript } as StudioMessage}
                                onRetry={submission => { void submitStudio(submission, currentChat.id).catch(err => showToast(err instanceof Error ? err.message : 'Permintaan gagal.')); }}
                              />}

                              {msg.realFile && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: '1px solid rgba(78,155,255,0.3)', borderRadius: '14px', background: '#0B0E14', maxWidth: '398px' }}>
                                  <span style={{ display: 'flex', width: '36px', height: '36px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '10px', background: 'rgba(78,155,255,0.14)' }}>
                                    <FileText size={16} color="#4E9BFF" />
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.realFile.fileName}</div>
                                    <div style={{ fontSize: '10.5px', color: '#8A93A3' }}>File asli, siap dibuka</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => downloadFile({ name: msg.realFile!.fileName, mimeType: msg.realFile!.mimeType, fileBase64: msg.realFile!.fileBase64 })}
                                    style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '6px', height: '32px', padding: '0 12px', borderRadius: '8px', background: '#4E9BFF', border: 0, color: '#06080C', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                                  >
                                    <Download size={13} />
                                    <span>Unduh</span>
                                  </button>
                                </div>
                              )}

                              {msg.media?.kind === 'image' && (
                                <div style={{ display: 'flex', flexDirection: 'column', padding: 0, border: '1px solid rgba(255,255,255,0.09)', borderRadius: '16px', background: '#0B0E14', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)', overflow: 'hidden', maxWidth: '398px' }}>
                                  <div style={{ position: 'relative', height: '212px', overflow: 'hidden' }}>
                                    {styleArt(getMediaState(msg.id).style || msg.media.style || 'glass', '#D8A33C')}
                                    <span style={{ position: 'absolute', top: '10px', left: '11px', zIndex: 2, whiteSpace: 'nowrap', fontSize: '9.5px', fontWeight: 500, color: '#F5F7FA', background: 'rgba(6,8,12,0.74)', border: '1px solid rgba(255,255,255,0.09)', padding: '3px 9px', borderRadius: '999px' }}>
                                      {(IMAGE_STYLE_LIST.find((v) => v.key === (getMediaState(msg.id).style || msg.media?.style)) || IMAGE_STYLE_LIST[0]).label}
                                    </span>
                                    <span style={{ position: 'absolute', top: '10px', right: '11px', zIndex: 2, whiteSpace: 'nowrap', fontSize: '9.5px', fontWeight: 500, color: '#8A93A3', background: 'rgba(6,8,12,0.74)', border: '1px solid rgba(255,255,255,0.09)', padding: '3px 9px', borderRadius: '999px' }}>
                                      {msg.media.size || '1080 × 1350'}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '13px 14px 14px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
                                        {msg.media.title || 'Poster promosi'}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#8A93A3' }}>
                                        Variasi {(getMediaState(msg.id).variant || 0) + 1} &middot; PNG &middot; palet bawaan
                                      </span>
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          downloadFile({
                                            name: `Poster-Promosi-${(getMediaState(msg.id).variant || 0) + 1}.txt`,
                                            content: `Spesifikasi poster promosi\n\nGaya: ${getMediaState(msg.id).style || msg.media?.style || 'glass'}\nUkuran: 1080 x 1350`,
                                          })
                                        }
                                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', border: 0, borderRadius: '10px', background: '#0058BE', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                                      >
                                        <Download size={13} strokeWidth={1.7} />
                                        {/* 8 Sep 2026 (temuan F1): label lama "Unduh" menyiratkan file gambar --
                                            padahal downloadFile() di atas mengunduh .txt berisi spesifikasi teks,
                                            bukan gambar. Label diubah jujur supaya tidak menipu ekspektasi. */}
                                        <span>Unduh spesifikasi (.txt)</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => varyImage(msg.id, msg.media!)}
                                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 500, cursor: 'pointer' }}
                                      >
                                        <RefreshCw size={13} strokeWidth={1.7} />
                                        <span>Coba variasi lain</span>
                                      </button>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                      {IMAGE_STYLE_LIST.map((v) => {
                                        const on = (getMediaState(msg.id).style || msg.media?.style || 'glass') === v.key;
                                        return (
                                          <button
                                            key={v.key}
                                            type="button"
                                            onClick={() => setMediaState(msg.id, { style: v.key })}
                                            style={{
                                              padding: '5px 11px',
                                              border: `1px solid ${on ? 'rgba(78,155,255,0.5)' : 'rgba(255,255,255,0.09)'}`,
                                              borderRadius: '999px',
                                              background: on ? 'rgba(78,155,255,0.12)' : 'rgba(255,255,255,0.02)',
                                              color: on ? '#F5F7FA' : '#8A93A3',
                                              fontFamily: "'Outfit', sans-serif",
                                              fontSize: '10.5px',
                                              fontWeight: 500,
                                              cursor: 'pointer',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {v.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {msg.media?.kind === 'video' && (
                                <div style={{ display: 'flex', gap: '14px', padding: '14px', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '16px', background: '#0B0E14', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)', maxWidth: '430px' }}>
                                  <div style={{ position: 'relative', flexShrink: 0, width: '126px', height: '224px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.10)', background: '#06080C', overflow: 'hidden' }}>
                                    <span style={{ position: 'absolute', inset: 0 }}>
                                      {styleArt(['glass', 'ugc', 'studio', 'neon'][getMediaState(msg.id).scene || 0], '#D8A33C')}
                                      <span
                                        style={{
                                          position: 'absolute',
                                          left: 0,
                                          right: 0,
                                          bottom: 0,
                                          padding: '9px 10px',
                                          background: 'linear-gradient(180deg,rgba(6,8,12,0),rgba(6,8,12,0.9))',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '4px',
                                        }}
                                      >
                                        <span style={{ fontSize: '9.5px', color: '#8A93A3' }}>Scene {(getMediaState(msg.id).scene || 0) + 1}/4</span>
                                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 600, color: '#F5F7FA' }}>
                                          {VIDEO_SCENES[getMediaState(msg.id).scene || 0].label}
                                        </span>
                                      </span>
                                      {!getMediaState(msg.id).playing && (
                                        <span
                                          style={{
                                            position: 'absolute',
                                            left: '50%',
                                            top: '50%',
                                            transform: 'translate(-50%,-50%)',
                                            width: '38px',
                                            height: '38px',
                                            borderRadius: '999px',
                                            background: 'rgba(6,8,12,0.66)',
                                            border: '1px solid rgba(255,255,255,0.2)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          <span style={{ width: 0, height: 0, marginLeft: '3px', borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '11px solid #FFFFFF' }} />
                                        </span>
                                      )}
                                    </span>
                                    <span style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 3, whiteSpace: 'nowrap', fontSize: '9px', fontWeight: 500, color: '#8A93A3', background: 'rgba(6,8,12,0.76)', border: '1px solid rgba(255,255,255,0.09)', padding: '2.5px 7px', borderRadius: '999px' }}>
                                      9:16
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '12px', minWidth: 0, flex: 1 }}>
                                    <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', lineHeight: 1.35 }}>
                                        {msg.media.title || 'Video promosi vertikal'}
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#8A93A3' }}>30 detik &middot; 4 scene &middot; MP4 1080&times;1920</span>
                                    </span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                      {VIDEO_SCENES.map((sc, i) => {
                                        const cur = getMediaState(msg.id).scene || 0;
                                        const done = i < cur;
                                        const active = i === cur;
                                        return (
                                          <button
                                            key={i}
                                            type="button"
                                            onClick={() => setMediaState(msg.id, { scene: i })}
                                            style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: 0, border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
                                          >
                                            <span style={{ flexShrink: 0, width: '26px', fontSize: '9.5px', color: active ? '#F5F7FA' : done ? '#8A93A3' : '#8A93A3' }}>
                                              {sc.label}
                                            </span>
                                            <span style={{ flex: 1, height: '5px', borderRadius: '99px', background: 'rgba(255,255,255,0.09)', overflow: 'hidden' }}>
                                              <span
                                                style={{
                                                  display: 'block',
                                                  height: '100%',
                                                  borderRadius: '99px',
                                                  width: done ? '100%' : active ? '62%' : '0%',
                                                  background: active ? '#0058BE' : done ? 'rgba(78,155,255,0.45)' : 'transparent',
                                                  transition: 'width 300ms ease',
                                                }}
                                              />
                                            </span>
                                            <span style={{ flexShrink: 0, fontSize: '9.5px', color: active ? '#F5F7FA' : done ? '#8A93A3' : '#8A93A3' }}>{sc.dur}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          getMediaState(msg.id).playing ? stopScenes(msg.id) : advanceScene(msg.id, VIDEO_SCENES.length)
                                        }
                                        style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', border: 0, borderRadius: '10px', background: '#0058BE', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
                                      >
                                        {getMediaState(msg.id).playing ? (
                                          <span style={{ display: 'flex', gap: '3px' }}>
                                            <span style={{ width: '3px', height: '11px', background: 'currentColor', borderRadius: '1px' }} />
                                            <span style={{ width: '3px', height: '11px', background: 'currentColor', borderRadius: '1px' }} />
                                          </span>
                                        ) : (
                                          <span style={{ width: 0, height: 0, marginLeft: '1px', borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: '9px solid currentColor' }} />
                                        )}
                                        <span>{getMediaState(msg.id).playing ? 'Jeda' : 'Putar'}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setMediaState(msg.id, { muted: !getMediaState(msg.id).muted })}
                                        title={getMediaState(msg.id).muted ? 'Nyalakan suara' : 'Bisukan'}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '33px', height: '33px', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: getMediaState(msg.id).muted ? '#C9A66B' : '#8A93A3', cursor: 'pointer' }}
                                      >
                                        {getMediaState(msg.id).muted ? <VolumeX size={14} strokeWidth={1.7} /> : <Volume2 size={14} strokeWidth={1.7} />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          downloadFile({
                                            name: 'Storyboard-Video-9x16.txt',
                                            content: `STORYBOARD VIDEO 9:16\n\n${VIDEO_SCENES.map((sc, i) => `${i + 1}. ${sc.label} (${sc.dur})`).join('\n')}`,
                                          })
                                        }
                                        // 8 Sep 2026 (temuan F1): title lama "Unduh video" -- downloadFile() di
                                        // atas cuma mengunduh .txt berisi daftar scene, bukan file video apapun.
                                        title="Unduh storyboard (.txt)"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '33px', height: '33px', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: '#8A93A3', cursor: 'pointer' }}
                                      >
                                        <Download size={14} strokeWidth={1.7} />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* T3 (8 Sep 2026) -- kartu verdict relevansi lampiran, dari field
                                  additif data.attachmentVerdict (brain/chat). Ditaruh DI DALAM
                                  messages.map (bukan area attachedFile/composer) karena attachedFile
                                  sudah null saat respons ini datang. */}
                              {msg.attachmentVerdict && (
                                <AttachmentVerdictCard verdict={msg.attachmentVerdict} fileName={msg.attachment?.name || 'dokumen'} />
                              )}

                              {/* RISET WEB (sumber) dipindah ke dalam gelembung jawaban di atas --
                                  lihat dekat <RichMessage>. PREDIKSI + LOKASI tetap kartu terpisah
                                  di sini (widget interaktif sendiri, bukan "sumber"). */}
                              {msg.prediction && (
                                <ForecastCard data={msg.prediction} onRefine={(extraData) => handleForecastRefine(msg.id, extraData, msg.prediction!.horizonMonths)} />
                              )}
                              {(msg.locationPrompt || msg.locationResult) && (
                                <LocationForm onSubmit={(input) => handleLocationSubmit(msg.id, input)} result={msg.locationResult} />
                              )}

                              {msg.actionCard && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', padding: '14px', border: '1px solid rgba(0,88,190,0.35)', borderRadius: '12px', background: 'rgba(0,88,190,0.06)', maxWidth: '520px', textAlign: 'left' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                    <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 700, color: '#F5F7FA' }}>
                                      {msg.actionCard.title}
                                    </h4>
                                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#C9A66B', whiteSpace: 'nowrap' }}>
                                      Aksi eksekutif
                                    </span>
                                  </div>
                                  <p style={{ margin: 0, fontSize: '11.5px', color: '#8A93A3', lineHeight: 1.55 }}>
                                    {msg.actionCard.description}
                                  </p>
                                  {msg.actionCard.impactText && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 600, color: '#3FBF8F' }}>
                                      <Zap size={12} color="#3FBF8F" strokeWidth={1.8} />
                                      <span>Dampak: {msg.actionCard.impactText}</span>
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    disabled={!!executingCardTitle}
                                    onClick={() => handleCardExecution(msg.actionCard!)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px', borderRadius: '11px', background: executingCardTitle ? '#5A6472' : '#0058BE', border: 0, color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: executingCardTitle ? 'default' : 'pointer' }}
                                  >
                                    <Zap size={14} strokeWidth={1.9} />
                                    <span>
                                      {executingCardTitle === msg.actionCard.title
                                        ? 'Menjalankan...'
                                        : (msg.actionCard.actionLabel || 'Terapkan & Update ke Dashboard')}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* User Message */
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', gap: '11px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '7px', maxWidth: 'min(84%, 600px)', minWidth: 0 }}>
                              {msg.attachment && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '13px', background: '#0B0E14', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)', maxWidth: '320px' }}>
                                  {fileBadge(msg.attachment.name, 34)}
                                  <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {msg.attachment.name}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {fileKind(msg.attachment.name).label} &middot; {msg.attachment.size}
                                    </span>
                                  </span>
                                </span>
                              )}
                              <div style={{ padding: '12px 15px', borderRadius: '16px', borderTopRightRadius: '5px', background: '#0058BE', fontSize: '13px', lineHeight: 1.6, color: '#FFFFFF', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {msg.text}
                              </div>
                              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9px', color: '#454C59' }}>{msg.timestamp}</span>
                            </div>
                            <span style={{ display: 'flex', width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, marginTop: '2px' }}>
                              <User size={14} color="#C6CEDA" strokeWidth={1.7} />
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {isTyping && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', width: 'fit-content', padding: '9px 13px', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', background: '#0B0E14', fontSize: '11.5px', color: '#8A93A3' }}>
                      <RefreshCw size={13} color="#4E9BFF" strokeWidth={1.9} style={{ animation: 'klirSpin 1s linear infinite' }} />
                      {/* SETELAN JAWABAN (8 Sep 2026, B5) -- indikator beda saat effort
                          'maksimal' (EFFORT_MAP.maksimal.etaLabel: bisa sampai 1 menit). */}
                      <span>{composerPrefs.effort === 'maksimal' ? 'Berpikir keras... (bisa sampai 1 menit)' : 'KLIR AI sedang menyusun jawaban terbaik...'}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Composer */}
              <div style={{ flexShrink: 0, padding: '8px 18px 16px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
                  {attachedFile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', padding: '11px 13px', border: '1px solid rgba(255,255,255,0.09)', borderRadius: '14px', background: '#0B0E14', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.035)' }}>
                      {fileBadge(attachedFile.name, 38)}
                      <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {attachedFile.name}
                        </span>
                        <span style={{ fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {fileKind(attachedFile.name).label} &middot; {attachedFile.size}
                        </span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, fontSize: '10.5px', color: '#3FBF8F' }}>
                        <CheckCircle2 size={12} color="#3FBF8F" strokeWidth={1.9} />
                        <span>Siap dibaca</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        title="Hapus lampiran"
                        style={{ display: 'flex', flexShrink: 0, border: 0, background: 'transparent', color: '#8A93A3', cursor: 'pointer', padding: '3px', borderRadius: '7px' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '9px', padding: '12px 12px 10px', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '16px', background: '#0B0E14' }}
                  >
                    <textarea
                      ref={composerTextareaRef}
                      rows={1}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => { if (composerToolbarRef.current?.handleSlashKeyDown(e)) { e.preventDefault(); return; } if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if ((inputMessage.trim() || attachedFile) && !isTyping) void handleSendMessage(); } }}
                      placeholder="Tanya apa saja (email, ide konten, strategi, coding) atau beri instruksi untuk Dashboard..."
                      style={{ display: 'block', width: '100%', minHeight: '24px', maxHeight: '200px', overflowY: 'auto', resize: 'none', border: 0, outline: 'none', background: 'transparent', padding: '4px 3px', fontFamily: "'Outfit', sans-serif", fontSize: '13.5px', lineHeight: 1.45, color: '#F5F7FA' }}
                    />

                    {/* Setelan Jawaban + chip mode/mic (8 Sep 2026, B5-wiring-3-view) --
                        row baru, TIDAK menggantikan row Paperclip/Kirim di bawah. */}
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
                          disabled={(!inputMessage.trim() && !attachedFile) || isTyping}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '34px', height: '34px', padding: 0, justifyContent: 'center',
                            borderRadius: '999px',
                            fontFamily: "'Outfit', sans-serif",
                            fontSize: '12.5px',
                            fontWeight: 600,
                            cursor: (inputMessage.trim() || attachedFile) && !isTyping ? 'pointer' : 'not-allowed',
                            background: (inputMessage.trim() || attachedFile) && !isTyping ? '#0058BE' : 'rgba(255,255,255,0.03)',
                            border: (inputMessage.trim() || attachedFile) && !isTyping ? '0' : '1px solid rgba(255,255,255,0.08)',
                            color: (inputMessage.trim() || attachedFile) && !isTyping ? '#FFFFFF' : '#8A93A3',
                          }}
                        >
                          <Send size={15} strokeWidth={1.9} />
                        </button>
                      }
                    />
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Studio Template Dokumen & Notebook Modal (additive) -- lihat komentar di
            dekat pluginCatalog untuk penjelasan lengkap + cara membatalkan. */}
        {mediaPanel && <MediaStudio
          key={mediaPanel.id}
          kind={mediaPanel.kind}
          initialText={mediaPanel.text}
          sourceText={mediaPanel.source}
          initialStudioMode={mediaPanel.mode}
          role="executive"
          allowVideo={true}
          brand={{ workspaceName: workspaceName || 'Workspace', hasLogo: false }}
          onClose={() => setMediaPanel(null)}
          onSubmit={async submission => {
            await submitStudio(submission, mediaPanel.chatId);
            if (activeChatId === mediaPanel.chatId) setInputMessage(current => current === mediaPanel.text ? '' : current);
          }}
          onTranscript={text => { setMediaPanel(null); void handleSendMessage(text); }}
        />}

        {/* Pengaturan Divisi CEO Modal */}
        <CEOSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          workspaceId={workspaceId}
          workspaceName={workspaceName}
        />

        {dataHubOpen && (
          <WorkspaceDataHub
            workspaceId={workspaceId}
            portal={portalRole || 'CEO'}
            onClose={() => setDataHubOpen(false)}
            onAskAI={(prompt) => setInputMessage(prompt)}
          />
        )}

        {storagePickerOpen && (
          <StorageFilePickerModal
            isOpen={true}
            workspaceId={workspaceId}
            portalRole={portalRole || 'CEO'}
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

        {/* File Hasil AI Modal */}
        {filesOpen && (
          <div
            onClick={() => setFilesOpen(false)}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px', background: 'rgba(4,6,10,0.74)', zIndex: 60, animation: 'klirFade 160ms ease-out' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '620px', maxHeight: '100%', border: 0, borderRadius: '18px', background: '#0B0E14', boxShadow: '0 30px 80px rgba(0,0,0,0.62)', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '16px 18px 14px', borderBottom: 0, flexShrink: 0 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>File hasil AI</span>
                  <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>
                    {generatedFiles.length ? `${generatedFiles.length} file tersimpan · siap diunduh ulang` : 'Belum ada file tersimpan'}
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
                    {generatedFiles.map((f) => {
                      const kind = fileKind(f.name);
                      const bytes = (f.content || '').length;
                      const size = bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
                      return (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 12px', border: 0, borderRadius: '13px', background: 'rgba(255,255,255,0.03)' }}>
                          {fileBadge(f.name, 38)}
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#8A93A3' }}>
                              <span style={{ color: '#8A93A3' }}>{kind.label}</span>
                              <span>&middot;</span>
                              <span>{relTime(f.createdAt)}</span>
                              <span>&middot;</span>
                              <span>{size}</span>
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => downloadFile(f)}
                            title="Unduh ulang"
                            style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0, padding: '7px 13px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 500, cursor: 'pointer' }}
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
                    <span style={{ fontSize: '11.5px', color: '#8A93A3', textAlign: 'center' }}>Minta AI membuat dokumen, spreadsheet, atau presentasi. Hasilnya tersimpan di sini.</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 18px', borderTop: 0, flexShrink: 0 }}>
                <span style={{ fontSize: '11px', color: '#8A93A3' }}>File tetap tersimpan meskipun percakapan ditutup.</span>
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

        {/* Skill Kustom Modal */}
        {skillsOpen && (
          <div
            onClick={() => setSkillsOpen(false)}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px', background: 'rgba(4,6,10,0.74)', zIndex: 60, animation: 'klirFade 160ms ease-out' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '580px', maxHeight: '100%', border: 0, borderRadius: '18px', background: '#0B0E14', boxShadow: '0 30px 80px rgba(0,0,0,0.62)', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '16px 18px 14px', borderBottom: 0, flexShrink: 0 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>Skill kustom</span>
                  <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Simpan instruksi panjang yang sering dipakai jadi shortcut bernama.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSkillsOpen(false)}
                  title="Tutup"
                  style={{ display: 'flex', flexShrink: 0, padding: '5px', border: 0, borderRadius: '8px', background: 'transparent', color: '#8A93A3', cursor: 'pointer' }}
                >
                  <X size={16} strokeWidth={1.9} />
                </button>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 18px 18px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3' }}>Buat shortcut baru</span>
                  <input
                    type="text"
                    value={skillName}
                    onChange={(e) => setSkillName(e.target.value)}
                    placeholder="Nama shortcut, misal: Rapat Senin"
                    style={{ width: '100%', padding: '11px 13px', border: 0, borderRadius: '11px', background: 'rgba(255,255,255,0.03)', outline: 'none', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', color: '#F5F7FA' }}
                  />
                  <textarea
                    value={skillInstruction}
                    onChange={(e) => setSkillInstruction(e.target.value)}
                    rows={4}
                    placeholder="Tulis instruksi lengkapnya di sini. Ini yang akan dijalankan tiap kali shortcut dipanggil."
                    style={{ width: '100%', padding: '11px 13px', border: 0, borderRadius: '11px', background: 'rgba(255,255,255,0.03)', outline: 'none', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)', resize: 'vertical', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', lineHeight: 1.55, color: '#F5F7FA' }}
                  />
                  <button
                    type="button"
                    onClick={saveCustomSkill}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', border: 0, borderRadius: '11px', background: '#0058BE', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Plus size={14} strokeWidth={1.9} />
                    <span>Simpan sebagai skill</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', whiteSpace: 'nowrap' }}>Skill tersimpan</span>
                    <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
                  </div>
                  {customSkills.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      {customSkills.map((sk) => (
                        <div key={sk.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 12px', border: 0, borderRadius: '13px', background: 'rgba(255,255,255,0.03)' }}>
                          <span style={{ display: 'flex', width: '32px', height: '32px', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: '10px', background: 'rgba(216,163,60,0.14)', border: 0 }}>
                            <Wand2 size={15} color="#D8A33C" strokeWidth={1.7} />
                          </span>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{sk.name}</span>
                            <span style={{ fontSize: '11px', lineHeight: 1.4, color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sk.instruction}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSkillsOpen(false);
                              handleSendMessage(sk.instruction);
                            }}
                            style={{ flexShrink: 0, padding: '7px 13px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 500, cursor: 'pointer' }}
                          >
                            Jalankan
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCustomSkill(sk.id)}
                            title="Hapus skill"
                            style={{ display: 'flex', flexShrink: 0, padding: '6px', border: 0, borderRadius: '8px', background: 'transparent', color: '#8A93A3', cursor: 'pointer' }}
                          >
                            <X size={14} strokeWidth={1.8} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ padding: '30px 20px', textAlign: 'center', fontSize: '11.5px', lineHeight: 1.55, color: '#8A93A3' }}>
                      Belum ada skill tersimpan. Buat satu di atas, lalu panggil kapan saja tanpa menulis ulang instruksinya.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pengaturan Admin (RBAC per-divisi). Catatan paradigma layout: mockup v6
            menaruh layar ini sebagai LAYAR PENUH terpisah (bukan modal terpusat),
            lihat roadmap 4 Sep butir 2 Executive. Tetap dipertahankan sebagai modal
            untuk sementara (lebih aman daripada dihapus total) sampai skema akses
            granular yang sebenarnya siap dari Fatur -- BELUM FINAL PARADIGMA
            LAYOUTNYA. Yang sudah dibuat fungsional di sini: selector "Kondisi akses"
            dan toggle per-kemampuan per-divisi yang beneran bisa diklik (state
            client-side murni, belum terhubung ke backend akses asli). */}
        {adminOpen && (
          <div
            onClick={() => setAdminOpen(false)}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px', background: 'rgba(4,6,10,0.74)', zIndex: 60, animation: 'klirFade 160ms ease-out' }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '760px', maxHeight: '100%', border: 0, borderRadius: '18px', background: '#0B0E14', boxShadow: '0 30px 80px rgba(0,0,0,0.62)', overflow: 'hidden' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '16px 18px 14px', borderBottom: 0, flexShrink: 0 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>Pengaturan Admin — Hak Akses Divisi</span>
                  <span style={{ fontSize: '11.5px', color: '#8A93A3' }}>Kontrol kemampuan mana yang aktif untuk tiap divisi.</span>
                </span>
                <button
                  type="button"
                  onClick={() => setAdminOpen(false)}
                  title="Tutup"
                  style={{ display: 'flex', flexShrink: 0, padding: '5px', border: 0, borderRadius: '8px', background: 'transparent', color: '#8A93A3', cursor: 'pointer' }}
                >
                  <X size={16} strokeWidth={1.9} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 18px', borderBottom: 0, flexShrink: 0, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#8A93A3', whiteSpace: 'nowrap' }}>Kondisi akses</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px', padding: '3px', border: 0, borderRadius: '11px', background: 'rgba(255,255,255,0.04)' }}>
                  {[
                    { key: 'public' as const, label: 'Uji coba publik' },
                    { key: 'private' as const, label: 'Langganan privat' },
                  ].map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => setAccessMode(a.key)}
                      style={{ padding: '7px 10px', border: 0, borderRadius: '8px', background: accessMode === a.key ? '#0058BE' : 'transparent', color: accessMode === a.key ? '#FFFFFF' : '#8A93A3', fontFamily: "'Outfit', sans-serif", fontSize: '10.5px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <span style={{ flex: '1 1 220px', fontSize: '10.5px', lineHeight: 1.5, color: '#8A93A3' }}>
                  {accessMode === 'public'
                    ? 'Semua kemampuan terbuka untuk semua divisi — tombol pengatur di bawah nonaktif sementara.'
                    : 'Admin mengatur kemampuan tiap divisi lewat toggle di bawah.'}
                </span>
              </div>

              <div style={{ padding: '10px 18px', margin: '0 18px', borderRadius: '12px', borderBottom: 0, background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', lineHeight: 1.5, color: '#8A93A3' }}>
                  Atur hak akses kemampuan kecerdasan buatan untuk masing-masing divisi perusahaan. Perubahan berlaku langsung pada sesi saat ini.
                </span>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 18px 18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px 64px 64px', alignItems: 'center', gap: '10px', padding: '10px 4px', position: 'sticky', top: 0, background: '#0B0E14', zIndex: 1 }}>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#8A93A3', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Kemampuan</span>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#8A93A3', textAlign: 'center' }}>Eksekutif</span>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#8A93A3', textAlign: 'center' }}>Finance</span>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#8A93A3', textAlign: 'center' }}>Marketing</span>
                </div>
                {KLIR_AI_TOOLS.filter((t) => t.status === 'ready').map((tool) => (
                  <div
                    key={tool.id}
                    style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px 64px 64px', alignItems: 'center', gap: '10px', padding: '9px 8px', border: 0, borderRadius: '10px' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 500, color: '#C6CEDA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tool.name}</span>
                    </span>
                    {['exec', 'finance', 'marketing'].map((division) => {
                      const key = `${division}|${tool.id}`;
                      const on = accessMode === 'public' ? true : adminOverrides[key] ?? true;
                      const disabled = accessMode === 'public';
                      return (
                        <span key={division} style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => toggleAdminCap(division, tool.id)}
                            title={disabled ? 'Nonaktif selama mode "Uji coba publik" -- semua kemampuan terbuka' : on ? 'Klik untuk matikan untuk divisi ini' : 'Klik untuk nyalakan untuk divisi ini'}
                            style={{ display: 'flex', alignItems: 'center', width: '30px', height: '17px', padding: '2px', border: 0, borderRadius: '999px', background: on ? 'rgba(0,88,190,0.85)' : 'rgba(255,255,255,0.11)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, justifyContent: on ? 'flex-end' : 'flex-start' }}
                          >
                            <span style={{ width: '13px', height: '13px', borderRadius: '999px', background: on ? '#F5F7FA' : '#8A93A3' }} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
