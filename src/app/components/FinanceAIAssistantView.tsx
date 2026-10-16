'use client';

import React, { useState, useEffect, useRef } from 'react';
import { consumeInitialPrompt } from '@/lib/initial-prompt-storage';
import { INVENTORY_AI_PROMPT } from '@/lib/ai-brain/inventory-product-command';
import TermHint from './TermHint';
import { sanitizeLiveCompanyState } from '@/lib/live-company-state';
import { FinanceSettingsModal } from './settings/FinanceSettingsModal';
import { TAX_FEATURE_LOCKED, TAX_FEATURE_LOCK_MESSAGE } from '@/lib/tax-feature';
// ===== Studio Template Dokumen & Notebook (additive, tim AI, lihat blok "STUDIO TEMPLATE
// & NOTEBOOK" di bawah untuk cara membatalkan) -- komponen berikut SUDAH ADA & LIVE di
// MarketingAIAssistantView.tsx, tidak dimodifikasi sama sekali di sini, cuma diimpor. =====
import MediaStudio from './marketing-media/MediaStudio';
import StudioResult from './marketing-media/StudioResult';
// Roadmap 7 Sep item 4.1 -- Pusat Data (Hub Upload), fitur baru prioritas #1. Modal
// baru, pola sama seperti "File hasil AI" (filesOpen) yang sudah ada di file ini.
import WorkspaceDataHub from './WorkspaceDataHub';
import StorageFilePickerModal, { type StorageFileItem } from './StorageFilePickerModal';
import AttachmentMenuButton from './chat/AttachmentMenuButton';
import DragDropFileOverlay from './chat/DragDropFileOverlay';
// Roadmap 7 Sep item 4.5 -- kartu hasil document-checker/tabular-checker, backend
// sudah nyambung ke /documents/analyze tapi belum pernah ada tampilannya.
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
import ProactiveAlertsPanel from './chat/ProactiveAlertsPanel';
import type { ResearchSource, BlendedForecastResult, ForecastExtraData, LocationPromptNeeded, LocationAnalysisInput, LocationAnalysisResult } from '@/lib/research-types';
// V1 RENDER KAYA + V3 TOMBOL LANJUTAN (8 Sep 2026) -- lihat komentar identik di
// MarketingAIAssistantView.tsx (satu-satunya sumber acuan, tidak diulang panjang di sini).
import RichMessage from './chat/RichMessage';
import NextActionsBar from './chat/NextActionsBar';
import type { NextAction } from '@/lib/ai-brain/next-actions';
import { executeActionCardOnServer } from '@/lib/ai-brain/action-card-execution';
import { apiRequest, ApiRequestError, pollVideoJob, resolveStudioSource, validMediaResult, type StudioKind, type StudioMessage, type StudioSubmission, type MediaResult } from './marketing-media/client';
import type { NotebookResult } from '@/lib/notebook-types';
// SETELAN JAWABAN + COMPOSER TOOLBAR (8 Sep 2026, wave B5-wiring-3-view) -- komponen
// adapter murni (B2) + SSOT tipe/localStorage (B1) + logic preferensi pembaca (B4) +
// registry slash-command (B6). Diimpor apa adanya, cuma disambungkan ke state/
// handleSendMessage/openStudio yang sudah ada di file ini.
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
  ArrowRight,
  Receipt,
  DollarSign,
  TrendingUp,
  BarChart2,
  Calculator,
  Search,
  CheckCircle2,
  CreditCard,
  Building,
  Calendar,
  AlertTriangle,
  Layers,
  ArrowDownRight,
  ArrowUpRight,
  HelpCircle,
  FileCheck,
  Rocket,
  Download,
  ChevronDown,
  ChevronUp,
  Mail,
  Globe,
  MessageSquare,
  Code,
  ClipboardCheck,
  Package,
  BookOpen,
  Users,
  Database,
  Wallet,
  PieChart,
  Scale,
  Terminal,
  Target,
  GraduationCap,
  Gauge,
  Shield,
  Presentation,
  Video,
  Image as ImageIcon,
  Lock,
  Folder,
  Trash2,
} from 'lucide-react';
import { KLIR_AI_TOOLS } from '@/lib/ai-tools-registry';
import { readCeoAiChatParams } from '@/lib/ceo-ai-settings-client';

interface FinanceAIAssistantViewProps {
  workspaceId?: string;
  workspaceName?: string;
  userName?: string;
  /** Return to the authenticated gateway before switching division. */
  onRoleChange?: () => void;
  /** Open feature surfaces without putting their full UI inside the dashboard overview. */
  onOpenInventory?: () => void;
}

interface ActionCard {
  type: 'RESOLVE_INVOICE' | 'OPTIMIZE_EXPENSES' | 'RECONCILE_BANK' | 'TAX_PROJECTION' | string;
  recommendationId?: string;
  title: string;
  description: string;
  impactText?: string;
  actionLabel?: string;
  actionPayload?: { confirmationMessage?: string };
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
  simulation?: SimulationResult;
  /** gambar ASLI hasil generate server */
  realImage?: { url: string; prompt: string; provider: string };
  /** file ASLI (docx/xlsx/pptx/storyboard) hasil generate server */
  realFile?: { fileName: string; mimeType: string; fileBase64: string; type: string };
  /** ===== Studio Template Dokumen & Notebook (additive) =====
   * Field diberi prefix "studio" (bukan nama polos "media"/"notebook") supaya tidak pernah
   * bentrok dengan field lain manapun yang mungkin ditambahkan di file ini nanti. Diisi oleh
   * submitStudio() di bawah, dirender oleh StudioResult (komponen bersama, sudah dipakai
   * MarketingAIAssistantView.tsx, tidak diubah). */
  studioMedia?: MediaResult;
  studioNotebook?: NotebookResult;
  studioSubmission?: StudioSubmission;
  studioPending?: boolean;
  studioFailed?: boolean;
  studioDraftScript?: string;
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

interface SimulationResult {
  scenarioTitle: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  summary: string;
  baselineRunwayMonths: number;
  simulatedRunwayMonths: number;
  runwayDeltaMonths: number;
  breakEvenMonthEstimated: number | null;
  cashOutDateProjected: string | null;
  monthlyProjections: { monthName: string; projectedCash: number }[];
  strategicVerdict: string;
  actionableSteps: string[];
}

interface ChatSession {
  id: string;
  updatedAt: number;
  messages: ChatMessage[];
}

// V1 RENDER KAYA (8 Sep 2026): parseInline + FormattedMessage lokal DIHAPUS dari sini --
// digantikan komponen bersama src/app/components/chat/RichMessage.tsx (lihat call site
// <RichMessage content={msg.text} accent="finance" /> di bawah).

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

// Kartu-art animasi untuk galeri "Mulai dari tugas nyata" -- disalin verbatim dari
// ExecutiveAIAssistantView.tsx (satu-satunya sumber acuan) supaya tampilan Finance
// sama persis dengan CEO/Marketing, bukan versi flat/statis yang lama.
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

export default function FinanceAIAssistantView({
  workspaceId,
  workspaceName = 'Perusahaan Anda',
  userName = 'Finance Controller',
  onRoleChange,
  onOpenInventory,
}: FinanceAIAssistantViewProps) {
  const userTitle = (!userName || userName.toLowerCase().includes('ceo') || userName.toLowerCase().includes('owner'))
    ? 'Finance Controller'
    : userName;

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [inputMessage, setInputMessage] = useState('');

  useEffect(() => {
    const initialPrompt = consumeInitialPrompt('FINANCE');
    if (initialPrompt) setInputMessage(initialPrompt);
  }, []);

  const [isTyping, setIsTyping] = useState(false);
  // Gap kemampuan-001 (audit 7 Sep): id actionCard yang sedang dieksekusi ke backend
  // nyata (POST /api/v1/brain/execute) -- disable tombol supaya tidak double-submit.
  const [executingCardTitle, setExecutingCardTitle] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // T3 (8 Sep 2026): + workspaceFileId?: string; workspaceFileIds?: string[] -- diisi setelah lampiran ini
  // berhasil dipersist ke Pusat Data di handleFileSelect; ikut terkirim ke
  // brain/chat karena `attachment: currentAttachment` men-spread object ini.
  const [attachedFiles, setAttachedFiles] = useState<Record<string, { name: string; size: string; content?: string; imageBase64?: string; mimeType?: string; documentCheck?: DocumentCheckReport | TabularCheckReport; workspaceFileId?: string; workspaceFileIds?: string[] } | null>>({});
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [pluginOpen, setPluginOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // FIX (audit role-fit 7 Sep): dipakai supaya link "Integrasi Akuntansi & Pajak" bisa
  // langsung buka tab Pajak, bukan selalu jatuh ke tab default 'Buku Kas'.
  const [settingsInitialTab, setSettingsInitialTab] = useState<'cashflow' | 'tax' | 'invoices' | 'export'>('cashflow');
  const [pluginToggles, setPluginToggles] = useState<Record<string, boolean>>({
    pdf: true,
    excel: true,
    word: true,
    image: true,
    audio: false,
    websearch: false,
    code: false,
  });
  const [filesOpen, setFilesOpen] = useState(false);
  const [dataHubOpen, setDataHubOpen] = useState(false);
  const [storagePickerOpen, setStoragePickerOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [activeChatId, setActiveChatId] = useState('chat-fin-current');
  const attachedFile = attachedFiles[activeChatId] || null;
  const setAttachedFile = (file: { name: string; size: string; content?: string; imageBase64?: string; mimeType?: string; documentCheck?: DocumentCheckReport | TabularCheckReport; workspaceFileId?: string; workspaceFileIds?: string[] } | null, chatId = activeChatId) => setAttachedFiles(previous => ({ ...previous, [chatId]: file }));
  const attachmentReads = useRef(new Map<string, string>());
  const [adminOpen, setAdminOpen] = useState(false);
  // FIX FIN-01 (8 Sep 2026, temuan scan finance) -- tombol "Generator Invoice Formal"
  // sebelumnya langsung kirim prompt generik tanpa nama klien/nominal, sehingga tidak
  // pernah memenuhi syarat ekstraksi CREATE_INVOICE di brain/chat/route.ts (butuh
  // invoice.clientName & invoice.amount) dan hanya jadi obrolan teks biasa, bukan
  // invoice sungguhan. Mini-form ini memaksa 2 field wajib diisi dulu, lalu compose
  // pesan eksplisit menyebut nama klien & nominal sebelum dikirim ke handleSendMessage.
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [invoiceFormClient, setInvoiceFormClient] = useState('');
  const [invoiceFormAmount, setInvoiceFormAmount] = useState('');
  const [invoiceFormItem, setInvoiceFormItem] = useState('');
  const [invoiceFormDueDays, setInvoiceFormDueDays] = useState('14');
  // RBAC admin panel state -- paritas dengan ExecutiveAIAssistantView.tsx: 'private'
  // (default) membiarkan admin toggle tiap kemampuan per divisi di bawah; 'public'
  // memaksa semua kemampuan terbuka untuk semua divisi (toggle jadi read-only).
  // Client-side saja (belum terhubung ke backend akses granular yang sungguhan).
  const [accessMode, setAccessMode] = useState<'public' | 'private'>('private');
  const [adminOverrides, setAdminOverrides] = useState<Record<string, boolean>>({});
  const toggleAdminCap = (division: string, toolId: string) => {
    const key = `${division}|${toolId}`;
    setAdminOverrides((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };
  // "File hasil AI" -- dulu useState di sini isinya 4 file HARDCODE (seedFiles()
  // mockup v6), TANPA setter -- gak pernah bertambah walau chat sudah generate
  // banyak file (bug nyata, FIX 7 Sep). generatedFiles sekarang DIHITUNG LIVE dari
  // `chats` -- lihat definisinya di dekat filesCreatedCount (pola sumber sama:
  // realFile/realImage/studioMedia.status==='ready'/studioNotebook). fileKind/
  // fileBadge/relTime/downloadSeedFile tetap dipakai (fileKind & relTime untuk
  // render list, downloadSeedFile untuk unduh entri studioNotebook -- lihat komentar
  // di generatedFiles).
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
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: `${size}px`, height: `${size}px`, flexShrink: 0, borderRadius: '11px', background: `${kind.tone}1F`, border: `1px solid ${kind.tone}33`, color: kind.tone }}>
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
  const downloadSeedFile = (f: { name: string; content?: string }) => {
    try {
      const blob = new Blob([f.content || ''], { type: 'text/plain;charset=utf-8' });
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
  const [showToolsNav, setShowToolsNav] = useState(true);
  const [showActionsNav, setShowActionsNav] = useState(true);
  // 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): panel "Ringkasan perusahaan
  // Anda" DEFAULT TERSEMBUNYI sekarang (dulu useState(true)) -- lihat useEffect baca
  // localStorage di bawah, logikanya DIBALIK juga ('1' eksplisit = tampilkan, bukan '0'
  // eksplisit = sembunyikan).
  const [showData, setShowData] = useState(false);
  // showCaps (grid "Semua kemampuan AI") DIHAPUS -- grid itu sendiri dihapus dari area
  // utama (11 Sep 2026, kontrak B4), isinya dipindah ke sidebar "Kemampuan & tools AI"
  // (lihat capSidebarGroups di render sidebar). State + localStorage key
  // 'klir_finance_ai_show_caps' jadi yatim tanpa grid untuk ditoggle -- dihapus bersih.

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const storageKey = `klir_ai_chats_fin_${workspaceId || 'default'}`;

  const [chats, setChats] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(`klir_ai_chats_fin_${workspaceId || 'default'}`);
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
        id: 'chat-fin-current',
        updatedAt: Date.now(),
        messages: [
          {
            id: 'msg-fin-welcome',
            sender: 'ai',
            text: `Halo **${userTitle}**! Saya adalah **KLIR Finance AI Assistant**.\n\nSaya memiliki akses langsung ke **buku kas operasional, saldo rekening koran, tagihan invoice klien, alokasi pos beban, dan laporan laba rugi** ${workspaceName}.\n\nAnda dapat mengaudit arus kas, meminta draf penagihan invoice, mengunggah laporan CSV/Excel rekening koran, atau memberi perintah keuangan langsung. Perpajakan **belum tersedia saat ini**. Ada yang ingin Anda proses hari ini?`,
            timestamp: 'Hari ini 09:15',
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
        console.warn('Gagal menyimpan riwayat chat keuangan:', e);
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

  // Preferensi tampilan navigasi sidebar (murni kosmetik per-browser, bukan data bisnis)
  useEffect(() => {
    try {
      const t = localStorage.getItem('klir_finance_ai_nav_tools');
      const a = localStorage.getItem('klir_finance_ai_nav_actions');
      const d = localStorage.getItem('klir_finance_ai_show_data');
      if (t !== null) setShowToolsNav(t !== '0');
      if (a !== null) setShowActionsNav(a !== '0');
      // 11 Sep 2026: dibalik -- default sekarang sembunyi, '1' eksplisit = tampilkan.
      if (d === '1') setShowData(true);
      const savedToggles = localStorage.getItem('klir_finance_ai_plugin_toggles');
      if (savedToggles) setPluginToggles((prev) => ({ ...prev, ...JSON.parse(savedToggles) }));
    } catch (e) {
      /* storage blocked */
    }
  }, []);

  const togglePlugin = (key: string) => {
    setPluginToggles((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem('klir_finance_ai_plugin_toggles', JSON.stringify(next));
      } catch (e) {
        /* storage blocked */
      }
      return next;
    });
  };

  // WIRING BARU (sesi ini): berkas ini sebelumnya SAMA SEKALI tidak membaca
  // klir_live_company_state untuk panel "Ringkasan perusahaan Anda" di bawah --
  // stats/hsScore/divisionLoad/aiOutputs semua literal tetap di kode, lebih parah
  // dari pola "||" di Executive/Marketing (yang minimal mencoba baca dulu). Blok
  // ini di-porting verbatim dari MarketingAIAssistantView.tsx (baris 943, 952-964)
  // supaya 3 role membaca sumber data yang sama. CARA MEMBATALKAN: hapus state
  // liveCompanyState + useEffect ini, lalu kembalikan literal lama di const
  // stats/hsScore/divisionLoad/aiOutputs di bawah.
  const [liveCompanyState, setLiveCompanyState] = useState<any>(null);
  // FIX (8 Sep malam, audit integrasi 3-portal) -- klir_live_company_state TIDAK PERNAH
  // ditulis dengan angka finansial ASLI oleh manapun (dikonfirmasi grep seluruh src/:
  // satu-satunya penulis field .financials adalah blok reset-ke-nol di file ini sendiri
  // dan applyDirectiveToDashboard yang cuma nulis .directives). Akibatnya "Kas bersih" &
  // skor kesehatan di panel ini permanen "Belum ada data" walau data asli ada di database
  // (sama seperti FinanceModuleView.tsx sudah benar fetch dari /api/v1/kas/*). Tambahkan
  // fetch LANGSUNG (pola sama persis loadRealData() milik dashboard) lalu tulis balik ke
  // localStorage supaya checkArPending() di atas (yang baca localStorage) ikut benar TANPA
  // diubah, dan panel lain yang baca key yang sama (mis. Executive) ikut ke-warm cache-nya.
  const loadRealFinancials = async () => {
    try {
      const [txRes, healthRes, ctxRes] = await Promise.all([
        fetch('/api/v1/kas/transactions', { credentials: 'include' }),
        fetch('/api/v1/kas/financial-health', { credentials: 'include' }),
        fetch('/api/v1/brain/context', { credentials: 'include' }),
      ]);
      const financialsPatch: any = {};
      let healthPatch: any = null;
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
            breakdown: {
              finance: hData.health.totalScore ?? 0,
              growth: null,
              operations: null,
              strategy: null,
            },
          };
        }
      }
      // FIX (sesi ini): runwayMonths sebelumnya konstanta literal 99 di bawah (lihat
      // komentar lama "JANGAN diubah/diwire ke liveFinancials sesi ini" -- sesi itu
      // sudah lewat) -- sidebar ini permanen nampilin "24 bulan+ aman" hijau ntah
      // gimanapun kondisi kas asli. /api/v1/brain/context = sumber yang sama dipakai
      // CompanyDataDashboard.tsx (Fatur) dan ExecutiveAIAssistantView.tsx (fix sesi
      // ini juga), dipakai di sini juga supaya konsisten lintas portal.
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
      if (Object.keys(financialsPatch).length === 0 && !healthPatch) return;
      try {
        const saved = localStorage.getItem('klir_live_company_state');
        const current = sanitizeLiveCompanyState(saved ? JSON.parse(saved) : {}) || {};
        const updated = {
          ...current,
          financials: { ...(current.financials || {}), ...financialsPatch },
          ...(healthPatch ? { healthScore: healthPatch } : {}),
        };
        localStorage.setItem('klir_live_company_state', JSON.stringify(updated));
        setLiveCompanyState(updated);
      } catch (e) {
        /* localStorage blocked -- tetap set state React langsung, sekali pakai */
        setLiveCompanyState((prev: any) => {
          const cleanPrev = sanitizeLiveCompanyState(prev) || {};
          return {
            ...cleanPrev,
            financials: { ...(cleanPrev.financials || {}), ...financialsPatch },
            ...(healthPatch ? { healthScore: healthPatch } : {}),
          };
        });
      }
    } catch (e) {
      console.warn('Finance AI panel: gagal fetch data finansial live', e);
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
    const refresh = () => {
      readLiveState();
      loadRealFinancials();
    };
    readLiveState();
    loadRealFinancials();
    window.addEventListener('klir-ai-state-updated', refresh);
    window.addEventListener('klir-kas-updated', refresh);
    return () => {
      window.removeEventListener('klir-ai-state-updated', refresh);
      window.removeEventListener('klir-kas-updated', refresh);
    };
  }, []);

  const showToast = (msg: string, ms = 4000) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(null), ms);
  };

  // ===== SETELAN JAWABAN + COMPOSER TOOLBAR (8 Sep 2026, B5-wiring-3-view) =====
  // ComposerPrefs per-workspace, dibaca/ditulis lewat chat-composer-prefs.ts (B1).
  // ComposerToolbar (B2) adalah adapter murni -- TIDAK menulis localStorage sendiri,
  // controlled prop, jadi persist terjadi DI SINI di titik onPrefsChange.
  // FIX 8 Sep 2026 malam (audit Finance: bug composer-prefs role-bleed, verifikasi
  // independen fase KRITIK) -- role literal 'fin' dioper eksplisit supaya setelan
  // Composer Finance TERISOLASI dari Executive/Marketing (dulu 3 portal berbagi 1
  // kunci localStorage yang sama per-workspace). Literal 'fin' KONSISTEN dengan pola
  // existing klir_ai_chats_fin_<workspaceId> di file ini. Lihat src/lib/chat-composer-prefs.ts
  // untuk detail parameter `role` opsional (backward compatible untuk Executive/Marketing
  // yang belum dipatch di putaran ini).
  const [composerPrefs, setComposerPrefs] = useState<ComposerPrefs>(DEFAULT_COMPOSER_PREFS);
  useEffect(() => {
    setComposerPrefs(readComposerPrefs(workspaceId || 'default', 'fin'));
  }, [workspaceId]);
  // Ref ke toolbar untuk navigasi keyboard menu slash (panah/Enter/Esc) dari input composer.
  const composerToolbarRef = useRef<ComposerToolbarHandle>(null);
  // 8 Sep malam (feedback Mecca: composer kayak AI umum) -- textarea auto-tinggi,
  // Enter kirim / Shift+Enter baris baru (lihat komentar di use-autogrow-textarea.ts).
  const composerTextareaRef = useAutoGrowTextarea(inputMessage);
  const handleComposerPrefsChange = (next: ComposerPrefs) => {
    setComposerPrefs(next);
    writeComposerPrefs(workspaceId || 'default', next, 'fin');
  };

  // Preferensi cara AI menjawab (feedback Mecca poin 6 -- belajar dari histori chat +
  // feedback eksplisit AnswerFeedbackBar). reader-preferences.ts (B4) MURNI logic,
  // sengaja TIDAK menyediakan baca/tulis localStorage sendiri -- 2 helper kecil di
  // bawah ini bagian dari tugas wiring (B5), kunci 'klir_reader_prefs_<workspaceId>'
  // persis sesuai keputusan D-6 spesifikasi.
  // FIX 8 Sep 2026 malam (audit Finance, temuan BONUS sekelas bug composer-prefs --
  // kritik fase verifikasi independen menandai ini sebagai bug NYATA severity lebih
  // rendah dari composer-prefs, karena 'signals' cuma enum label pendek tetap bukan
  // teks bebas, jadi TIDAK ada risiko kebocoran konten bisnis lintas-portal, cuma
  // preferensi gaya jawaban yang nyasar). Suffix '_fin' ditambah ke kunci localStorage
  // supaya Finance tidak berbagi klir_reader_prefs_<workspaceId> dengan CEO/Marketing --
  // konsisten dengan pola yang dipakai Marketing (lihat git diff MarketingAIAssistantView.tsx
  // malam ini, sama-sama suffix '_mkt'). Berkas ini murni milik Finance (inline, tidak
  // lewat chat-composer-prefs.ts) jadi aman diubah sendiri tanpa risiko tabrakan lintas-agent.
  const readReaderPrefs = (): ReaderPreferences => {
    try {
      if (typeof window === 'undefined') return DEFAULT_READER_PREFERENCES;
      const raw = localStorage.getItem(`klir_reader_prefs_${workspaceId || 'default'}_fin`);
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
      localStorage.setItem(`klir_reader_prefs_${workspaceId || 'default'}_fin`, JSON.stringify(prefs));
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
      if (mode === 'video') {
        showToast('Generate video hanya tersedia untuk CEO dan Marketing.');
        return;
      }
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
      showToast('Generate video hanya tersedia untuk CEO dan Marketing.');
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

  // T1 (8 Sep 2026): cap wajar per pesan chat -- sama alasan dengan Executive
  // view (lihat komentar identik di sana), lebih dari ini toh terpotong duluan
  // oleh MAX_ATTACH_CHARS.
  const MAX_ATTACH_FILES = 6;
  const MAX_ATTACH_CHARS = 32000;

  // T1+T3 (8 Sep 2026): dirombak dari 1-file jadi multi-file, pola PERSIS sama
  // dengan ExecutiveAIAssistantView.tsx (lihat komentar panjang di sana) --
  // digabung jadi SATU attachedFile dengan header "=== [i/N] nama ===", cap
  // total 32000 char, gambar PERTAMA saja jadi field vision, dan setiap file
  // yang berhasil diekstrak di-AWAIT-persist ke Pusat Data (T3 poin 1).
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
      files.length > 1 ? `Membaca dan mengekstrak ${files.length} dokumen...` : `Membaca dan mengekstrak dokumen "${files[0].name}"...`,
      60000
    );

    type Piece = { file: File; text: string; rawText: string; ok: boolean; via: 'text' | 'binary'; isImage: boolean };
    const pieces: Piece[] = [];
    let firstImageBase64: string | undefined;
    let firstImageMimeType: string | undefined;

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
          } catch { /* non-fatal */ }
        }

        try {
          const formData = new FormData();
          formData.append('file', file);
          const headers: Record<string, string> = {};
          if (typeof window !== 'undefined') {
            const token = localStorage.getItem('klir_token');
            if (token) headers['Authorization'] = `Bearer ${token}`;
          }
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
          ? `${okCount}/${files.length} dokumen berhasil dibaca dan siap dianalisis.`
          : okCount > 0
            ? `Dokumen "${files[0].name}" berhasil dibaca dan siap dianalisis.`
            : `Gagal membaca isi "${files[0].name}". File tetap dilampirkan tanpa analisis konten.`,
        3500
      );

      // T3 poin 1 -- persist SETIAP file yang berhasil diekstrak ke Pusat Data
      // (endpoint sama, preExtractedContent = teks mentah). fileId disimpan
      // HANYA dari file PERTAMA yang sukses persist.
      let persistedFileId: string | undefined;
      const persistedFileIds: string[] = []; // 8 Sep: SEMUA id (temuan verifikator: hapus cuma file pertama)
      const targetWorkspaceId = workspaceId || getActiveClientWorkspaceId() || undefined;
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

      // Item 4.5 roadmap 7 Sep -- document-checker, DIPERTAHANKAN PERSIS
      // seperti perilaku lama: hanya untuk 1 file binary non-gambar. Batch
      // >1 file SENGAJA di-skip demi kecepatan wave ini (lihat catatan_jujur).
      if (files.length === 1 && pieces[0]?.via === 'binary' && !pieces[0].isImage && pieces[0].ok) {
        const file = files[0];
        fetch('/api/v1/documents/analyze', { method: 'POST', body: (() => { const fd = new FormData(); fd.append('file', file); return fd; })() })
          .then((r) => r.json())
          .then((analyzeJson) => {
            if (analyzeJson?.documentCheck && isCurrentRead()) {
              setAttachedFiles((previous) => {
                const current = previous[chatId];
                return { ...previous, [chatId]: current && current.name === file.name ? { ...current, documentCheck: analyzeJson.documentCheck } : current };
              });
            }
          })
          .catch((err) => console.warn('[document-checker] analisis tambahan gagal (non-fatal):', err));
      }
    } catch (err) {
      showToast(`Gagal membaca lampiran (koneksi bermasalah).`, 5000);
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
        id: `dir-fin-${Date.now()}`,
        no: existingDirectives.length + 1,
        type: directive.type,
        title: directive.title,
        impact: directive.impact,
        timestamp: 'Baru saja diinstruksikan via Finance AI Assistant',
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
      // generik "berhasil diterapkan ke Dashboard" -- statePatch kini kosong, tidak
      // ada lagi angka KPI simulasi yang ditimpakan ke Dashboard dari tombol ini.
      showToast(directive.impact, 7000);
    } catch (e) {
      console.warn('Failed to dispatch state:', e);
    }
  };

  // Decode file base64 ASLI dari server jadi Blob biner sungguhan -- BUKAN
  // membungkus teks polos dengan ekstensi .docx/.xlsx palsu (itu pola yang
  // ketauan bikin file rusak di Executive AI Assistant, sengaja dihindari di sini).
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

  // FIX gap kemampuan-001 (audit 7 Sep 2026): handleCardExecution dulu TIDAK PERNAH
  // memanggil backend -- cuma menulis angka simulasi hardcode ke localStorage.
  // Sekarang memanggil backend NYATA (POST /api/v1/brain/execute -> ExecutionEngine,
  // lihat src/lib/ai-brain/action-card-execution.ts untuk pemetaan actionCard.type).
  // Pesan yang ditampilkan adalah message ASLI dari ExecutionEngine (jujur soal
  // cakupan yang sudah/belum tersambung), bukan dikarang ulang di sini. Dashboard
  // Perusahaan tidak lagi ditimpa angka KPI simulasi dari tombol ini.
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
    } finally {
      setExecutingCardTitle(null);
    }
  };

  const SIM_RISK_STYLE: Record<string, { bg: string; border: string; color: string; label: string }> = {
    LOW: { bg: 'rgba(63,191,143,0.12)', border: 'rgba(63,191,143,0.32)', color: '#3FBF8F', label: 'Risiko rendah' },
    MODERATE: { bg: 'rgba(216,163,60,0.12)', border: 'rgba(216,163,60,0.32)', color: '#D8A33C', label: 'Risiko sedang' },
    HIGH: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.32)', color: '#EF4444', label: 'Risiko tinggi' },
    CRITICAL: { bg: 'rgba(239,68,68,0.18)', border: 'rgba(239,68,68,0.45)', color: '#EF4444', label: 'Risiko kritis' },
  };

  const detectSimulation = (text: string): boolean => {
    const lower = String(text || '').toLowerCase();
    return /simulasi|skenario|seandainya|gimana kalau|bagaimana jika|rencana ke depan|ekspansi|buka cabang|profitable lagi|proyeksi.*runway|rekrut.*(orang|karyawan|staff|dev)/i.test(
      lower
    );
  };

  const runFinanceSimulation = async (promptText: string): Promise<SimulationResult | null> => {
    try {
      let liveStateObj = null;
      try {
        const saved = localStorage.getItem('klir_live_company_state');
        if (saved) liveStateObj = sanitizeLiveCompanyState(JSON.parse(saved));
      } catch (e) {}
      const res = await fetch('/api/v1/brain/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptDescription: promptText,
          scenarioTitle: promptText.slice(0, 50),
          adjustments: { durationMonths: 6 },
          liveState: liveStateObj,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) return null;
      return json.data as SimulationResult;
    } catch (e) {
      return null;
    }
  };

  // KEPUTUSAN (audit demo gagal, ditambahkan 6-7 Sep 2026 di ExecutiveAIAssistantView.tsx,
  // di-porting verbatim ke Finance sesi ini): getDemoReply() di bawah TIDAK LAGI dipanggil
  // otomatis saat panggilan ke /api/v1/brain/chat gagal atau balasannya kosong. Sebelumnya
  // isi karangannya (piutang PT Sentosa Abadi Rp19.425.000 lengkap No. Faktur palsu, proyeksi
  // pajak, dst) dipakai sebagai fallback SENYAP dengan format identik jawaban asli --
  // pengguna tidak bisa membedakan mana data nyata mana karangan. Ini KANDIDAT KUAT sebagai
  // akar penyebab (atau satu kelas dengan) insiden demo gagal ke calon klien yang disebut
  // berulang di memory Mecca.
  // Sekarang kegagalan koneksi/data kosong menampilkan getConnectionErrorReply() (jujur +
  // actionable, tanpa tag sumber palsu, tanpa actionCard) -- lihat 2 titik pemanggilan di
  // handleSendMessage di bawah.
  // getDemoReply() DIPERTAHANKAN (tidak dihapus) untuk referensi/kemungkinan dipakai lagi
  // secara EKSPLISIT/manual di masa depan (bukan otomatis saat gagal). CARA MEMBATALKAN fix
  // ini: ganti balik 2 pemanggilan getConnectionErrorReply() di handleSendMessage jadi
  // getDemoReply(userPrompt, currentAttachment) seperti semula.
  const getConnectionErrorReply = () => {
    return {
      text:
        'Maaf, saya sedang tidak bisa mengakses data terbaru dari server (koneksi ke otak AI gagal atau tidak mengembalikan jawaban).\n\n' +
        'Jawaban ini BUKAN berdasarkan data riil perusahaan Anda -- mohon jangan dijadikan acuan keputusan.\n\n' +
        'Silakan coba kirim pesan ini lagi dalam beberapa saat. Kalau terus gagal, hubungi admin workspace Anda.',
      actionCard: undefined as ActionCard | undefined,
    };
  };

  // Fallback offline aman: mengembalikan pesan koneksi jujur tanpa mengarang invoice atau mutasi fiktif.
  const getDemoReply = (_userText: string, _attachment: any) => {
    return getConnectionErrorReply();
  };

  const handleSendMessage = async (customText?: string) => {
    const targetChatId = activeChatId;
    const currentAttachment = attachedFiles[targetChatId] || null;
    const textToSend = String(customText || inputMessage || '').trim();
    if (!textToSend && !currentAttachment) return;

    const userPrompt = textToSend || (currentAttachment ? `Tolong audit dan jelaskan rincian kas dari file: ${currentAttachment.name}` : '');
    const userMsgId = `user-fin-${Date.now()}`;
    const aiMsgId = `ai-fin-${Date.now()}`;

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

      const wantsSimulation = detectSimulation(userPrompt);

      // 11 Sep 2026 (kontrak modul 3+4) -- lihat komentar identik di
      // ExecutiveAIAssistantView.tsx: assistantMode 'riset' disinkronkan otomatis dari
      // tombol Riset composer, dihitung sesaat sebelum kirim.
      const effectiveAssistantMode = composerPrefs.researchMode && composerPrefs.researchMode !== 'off' ? 'riset' : composerPrefs.assistantMode;

      const [res, simulation] = await Promise.all([
        fetch('/api/v1/brain/chat', {
          method: 'POST',
          credentials: 'include',
          headers: getClientAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            workspaceId,
            message: `[Konteks Finansial/Kas Bisnis]: ${userPrompt}`,
            userName: userTitle,
            userRole: 'FINANCE',
            workspaceName,
            // 8 Sep 2026: ikut pilihan model/tone dari Pengaturan CEO (dulu hardcode 'opencode').
            ...readCeoAiChatParams(workspaceId, 'opencode'),
            // SETELAN JAWABAN composer (8 Sep 2026): 'auto' tidak dikirim -> cascade lama tetap
            // jalan; preferensi pembaca = sinyal eksplisit (AnswerFeedbackBar) menang, kalau
            // belum ada baru ditebak dari pola pesan (inferFromHistory). Sama persis dgn Executive.
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
        }),
        wantsSimulation ? runFinanceSimulation(userPrompt) : Promise.resolve(null),
      ]);

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
        const demo = getConnectionErrorReply();
        responseText = demo.text;
        responseActionCard = demo.actionCard as ActionCard;
      }

      if (simulation || responseRealImage || responseRealFile) {
        setChats((prev) =>
          prev.map((c) =>
            c.id === activeChatId
              ? { ...c, messages: c.messages.map((m) => (m.id === aiMsgId ? { ...m, simulation: simulation ?? undefined, realImage: responseRealImage, realFile: responseRealFile } : m)) }
              : c
          )
        );
      }

      let currentLength = 0;
      const chunkSize = Math.max(3, Math.floor(responseText.length / 30));
      const interval = setInterval(() => {
        currentLength += chunkSize;
        if (currentLength >= responseText.length) {
          clearInterval(interval);
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
                            modelUsed: responseModelUsed,
                            effortAuto: responseEffortAuto,
                            effortUsed: responseEffortUsed,
                            modelTierUsed: responseModelTierUsed,
                            assistantModeUsed: responseAssistantModeUsed,
                            actionCard: responseActionCard,
                            attachmentVerdict: responseAttachmentVerdict,
                            // BUGFIX live-test 8 Sep 2026 (sama dgn Executive): msg.attachment
                            // cuma pernah diisi di userMsg, tidak pernah di pesan AI -- tanpa ini
                            // kartu verdict di sisi AI selalu fallback nama "dokumen".
                            attachment: responseAttachmentVerdict && currentAttachment ? { name: currentAttachment.name, size: currentAttachment.size } : undefined,
                            nextActions: responseNextActions,
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
      const demo = getConnectionErrorReply();
      setChats((prev) =>
        prev.map((c) =>
          c.id === targetChatId
            ? {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === aiMsgId ? { ...m, text: demo.text, actionCard: demo.actionCard as ActionCard } : m
                ),
              }
            : c
        )
      );
      setIsTyping(false);
    }
  };

  const handleNewChat = () => {
    const newId = `chat-fin-${Date.now()}`;
    const welcomeMsg: ChatMessage = {
      id: `msg-fin-welcome-${Date.now()}`,
      sender: 'ai',
      text: `Sesi baru Finance AI Assistant aktif. Siap membantu audit arus kas, pembuatan invoice, atau analisis buku kas **${workspaceName}**. Perpajakan: **belum tersedia saat ini**.`,
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
        const freshId = `chat-fin-${Date.now()}`;
        const freshSession: ChatSession = {
          id: freshId,
          updatedAt: Date.now(),
          messages: [
            {
              id: `msg-fin-welcome-${Date.now()}`,
              sender: 'ai',
              text: `Sesi baru Finance AI Assistant aktif. Ada yang ingin Anda proses untuk **${workspaceName}**?`,
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

  // Semua tools aktif untuk divisi keuangan, tidak ada kunci buatan (anti-slop).
  const ADMIN_LOCKED_FOR_FINANCE = new Set<string>();

  // Sidebar "Kemampuan & tools AI" -- terfokus 100% pada fungsi akuntansi & keuangan
  // Konsolidasi 7 Sep: dulu kemampuan AI tersebar di 3 lokasi berbeda (sidebar ini +
  // chip pills di composer + dropdown "Plugin"), membingungkan (Mecca). Sekarang SEMUA
  // kemampuan AI cuma di sini -- 1 zona konsisten, sama di CEO/Finance/Marketing.
  // Item berlabel 'prompt' -> handleSendMessage(prompt). Item berlabel 'kind' ->
  // openStudio(kind, inputMessage) (buka modal MediaStudio, mekanisme dipertahankan
  // persis dari dropdown Plugin lama). prompt:'upload_trigger' -> file picker.
  const tools = ([
    {
      key: 'invoice',
      label: 'Draf Surat Penagihan Invoice',
      prompt: 'Buatkan surat penagihan invoice yang sopan namun tegas untuk klien yang telah jatuh tempo.',
      icon: <Receipt size={15} color="#3FBF8F" />,
    },
    {
      key: 'audit',
      label: 'Audit Beban & Arus Kas',
      prompt: 'Audit seluruh pos pengeluaran operasional bulan ini dan tandai anomali biaya yang melonjak.',
      icon: <AlertTriangle size={15} color="#F2A83B" />,
    },
    {
      key: 'tax',
      label: 'Estimasi Setoran Pajak PPh/PPN',
      prompt: 'Hitung estimasi kewajiban setor PPh Final 0,5% dan ringkasan PPN untuk periode berjalan.',
      icon: <Calculator size={15} color="#4E9BFF" />,
      locked: TAX_FEATURE_LOCKED,
    },
    {
      key: 'excel',
      label: 'Spreadsheet & Rekonsiliasi Kas',
      prompt: 'Buatkan struktur spreadsheet Excel untuk laporan buku kas harian dan rekonsiliasi bank.',
      icon: <FileSpreadsheet size={15} color="#3FBF8F" />,
    },
    {
      key: 'unitEcon',
      label: 'Analisis Margin & Unit Economics',
      prompt: 'Jelaskan konsep unit economics CAC dan LTV serta hitung rasio ideal untuk margin produk kami.',
      icon: <Layers size={15} color="#8A93A3" />,
    },
    {
      key: 'upload',
      label: 'Unggah & Analisis Rekening Koran',
      prompt: 'upload_trigger',
      icon: <Paperclip size={15} color="#8A93A3" />,
    },
    {
      key: 'longdoc',
      label: 'Ringkasan & Tanya Jawab Dokumen',
      prompt: 'Ringkas dokumen laporan keuangan atau kontrak yang saya unggah menjadi poin-poin utama.',
      icon: <BookOpen size={15} color="#8A93A3" />,
    },
    {
      key: 'legal',
      label: 'Draf Kontrak Perjanjian Finansial',
      prompt: 'Buatkan klausul termin pembayaran, denda keterlambatan, dan jaminan wanprestasi untuk kontrak kerjasama.',
      icon: <FileCheck size={15} color="#8A93A3" />,
    },
    {
      key: 'chart',
      label: 'Grafik & Tren Keuangan',
      prompt: 'Ubah angka transaksi keuangan ini menjadi visualisasi grafik dan simpulkan tren labanya.',
      icon: <BarChart2 size={15} color="#8A93A3" />,
    },
    {
      key: 'sop',
      label: 'SOP Kas & Reimbursement',
      prompt: 'Susun SOP alur pengajuan kas kecil, persetujuan reimbursement, dan kriteria kuitansi valid.',
      icon: <ClipboardCheck size={15} color="#8A93A3" />,
    },
    // ===== Dipindah 7 Sep dari "pills" (chip row composer) -- mekanisme handleSendMessage
    // dipertahankan persis. 2 item pills lama ("Deteksi anomali biaya", "Rekap & tagih
    // piutang") TIDAK dipindah -- duplikat fungsional dari 'audit' dan 'invoice' di atas,
    // sudah terwakili. =====
    {
      key: 'monthlyReport',
      label: 'Laporan keuangan bulanan',
      prompt: 'Susun draf laporan laba rugi (PnL Statement) komprehensif untuk periode bulan ini.',
      icon: <FileText size={15} color="#8A93A3" />,
    },
    {
      key: 'pdfReport',
      label: 'Laporan PDF siap kirim',
      prompt: 'Buatkan ringkasan neraca kas dan laba rugi siap cetak untuk laporan akhir bulan dalam format PDF.',
      icon: <FileCheck size={15} color="#8A93A3" />,
    },
    {
      key: 'presentation',
      label: 'Presentasi laporan',
      prompt: 'Buatkan kerangka presentasi 10 slide untuk rapat laporan keuangan bulanan.',
      icon: <Rocket size={15} color="#8A93A3" />,
    },
    {
      key: 'excelCashbook',
      label: 'Spreadsheet Excel',
      prompt: 'Buatkan kerangka spreadsheet buku kas harian lengkap dengan formula debit-kredit.',
      icon: <FileSpreadsheet size={15} color="#3FBF8F" />,
    },
    {
      key: 'bizSimulation',
      label: 'Simulasi skenario bisnis',
      prompt: 'Simulasikan skenario ke depan: naikkan budget iklan 30% dan rekrut 1 karyawan gaji 6 juta, apa dampaknya ke runway kas 6 bulan ke depan dan gimana caranya tetap profitable?',
      icon: <DollarSign size={15} color="#8A93A3" />,
    },
    // ===== Dipindah 7 Sep dari "pluginItems" (dropdown "Plugin" composer) -- mekanisme
    // dipertahankan persis (handleSendMessage / openStudio). 3 item pluginItems lama
    // ("Analisis Dokumen PDF", "Analisis Excel & Spreadsheet", "Kalkulator Pajak Bisnis")
    // TIDAK dipindah -- duplikat fungsional dari 'upload' (2x, file-picker generik sama
    // persis) dan 'tax' di atas, sudah terwakili. =====
    // FIX FIN-01 (8 Sep 2026, temuan scan finance -- diperbaiki di edit ini): dulu tombol ini
    // BERNAMA seperti template invoice tapi mekanismenya cuma handleSendMessage(prompt) generik
    // tanpa nama klien/nominal, sehingga TIDAK PERNAH memenuhi syarat ekstraksi CREATE_INVOICE
    // di brain/chat/route.ts (butuh invoice.clientName & invoice.amount) -- hasilnya cuma
    // obrolan teks, bukan invoice sungguhan. Sekarang klik tombol ini membuka mini-form
    // (invoiceFormOpen, lihat modal dekat akhir file) yang mewajibkan nama klien + nominal
    // diisi dulu, lalu compose pesan eksplisit sebelum dikirim -- lihat handler onClick
    // tools.map di bawah (cabang `tool.key === 'invoiceGenerator'`). Entri 'docTemplates' di
    // bawah TETAP ada sebagai jalur alternatif (19-template dengan guardrail invoice-templates.ts
    // penuh) untuk kebutuhan invoice yang lebih formal/kompleks.
    {
      key: 'invoiceGenerator',
      label: 'Generator Invoice Formal',
      prompt: 'Buatkan struktur draf invoice formal lengkap dengan no faktur, rincian item, dan bank tujuan.',
      icon: <Receipt size={15} color="#3FBF8F" />,
    },
    {
      key: 'quiz',
      label: 'Kuis',
      kind: 'quiz',
      icon: <GraduationCap size={15} color="#4E9BFF" />,
    },
    {
      key: 'flashcard',
      label: 'Flashcard',
      kind: 'flashcard',
      icon: <BookOpen size={15} color="#4E9BFF" />,
    },
    // FIX (temuan gap-fix 7 Sep, reachability HIGH): 19 template dokumen (laporan keuangan/
    // invoice/deck/video-brief) sebelumnya CUMA bisa dijangkau lewat tab kedua di dalam studio
    // gambar/audio/video/kuis/flashcard -- tidak ada satupun tombol sidebar yang eksplisit
    // mengarah ke situ, padahal beberapa tombol di atas ("Generator Invoice Formal" dkk) sudah
    // BERNAMA seperti template tapi sebenarnya cuma kirim prompt chat generik tanpa guardrail
    // template (lihat catatan di key 'invoiceGenerator' di atas). Entri ini buka MediaStudio
    // LANGSUNG di tab "Template Dokumen" (docTemplate:true -> openStudio(..., 'template') di
    // handler klik di bawah).
    {
      key: 'docTemplates',
      label: 'Template Dokumen',
      docTemplate: true,
      icon: <FileText size={15} color="#3FBF8F" />,
    },
  ] as { key: string; label: string; prompt?: string; kind?: StudioKind; icon: React.ReactNode; docTemplate?: boolean; locked?: boolean }[]).map((t) => ({ ...t, locked: t.locked ?? false }));

  // Aksi Cepat Dashboard Keuangan (Aksi nyata divisi finance)
  const actions = [
    {
      // Digenerickan 7 Sep -- sebelumnya hard-code "PT Sentosa Abadi" + nominal
      // Rp 19.425.000 seolah-olah itu piutang sungguhan, padahal quick-action ini
      // tampil di SETIAP workspace baru (termasuk yang belum ada data piutang sama
      // sekali). Untuk membatalkan: kembalikan label/prompt ke versi PT Sentosa.
      label: 'Tagih Invoice Klien yang Menunggak',
      prompt: 'Kirim invoice reminder untuk tagihan klien yang menunggak pembayaran.',
      icon: <Receipt size={15} color="#C9A66B" />,
    },
    {
      label: 'Audit Beban Operasional',
      prompt: 'Audit seluruh pos pengeluaran operasional 30 hari terakhir dan tandai pos terbesar',
      icon: <AlertTriangle size={15} color="#F2A83B" />,
    },
    {
      label: 'Estimasi Setoran Pajak PPh',
      prompt: 'Hitung estimasi kewajiban setor PPh Final 0,5% bulan berjalan',
      icon: <Calculator size={15} color="#3FBF8F" />,
      locked: TAX_FEATURE_LOCKED,
    },
    {
      label: 'Rekap Arus Kas & Runway',
      prompt: 'Buatkan ringkasan arus kas masuk-keluar dan posisi sisa runway kas saat ini',
      icon: <TrendingUp size={15} color="#4E9BFF" />,
    },
  ];

  // pills[] dan pluginItems[] (dulu di sini) DIHAPUS 7 Sep -- konsolidasi 3-lokasi
  // kemampuan AI jadi 1 (lihat komentar "Konsolidasi 7 Sep" di atas const tools).
  // Isinya sudah dipindah ke tools[] (5 item unik + 1 item unik dari pluginItems +
  // 2 item kind quiz/flashcard); 5 item lain dihapus sebagai duplikat fungsional dari
  // item tools[] yang sudah ada (audit/invoice/tax/upload). Untuk membatalkan: lihat
  // histori git komit ini, blok pills[]/pluginItems[] lengkap ada di sana.

  // ===== STUDIO TEMPLATE & NOTEBOOK (additive, sesi maintenance gelombang terakhir 7 Sep) =====
  // Menyambungkan MediaStudio (sudah ada & LIVE di MarketingAIAssistantView.tsx) ke portal
  // Finance, supaya Finance juga bisa akses Template Dokumen (19 template) + notebook (9
  // jenis kartu: kuis/flashcard/ringkasan/mindmap/tabel/infografis/deck/naskah audio/
  // storyboard video). Backend (/api/v1/media/generate, /api/v1/brain/notebook) SUDAH
  // menerima role:'finance' sejak sebelum sesi ini (lihat zod schema di route masing-masing)
  // -- cuma UI-nya yang belum tersambung di file ini. TIDAK ADA baris/perilaku Fatur yang
  // diubah atau dihapus; blok ini murni menambah.
  // CARA MEMBATALKAN: hapus (1) 4 baris import "Studio Template Dokumen & Notebook" di
  // paling atas file, (2) 6 field "studio*" di interface ChatMessage, (3) 2 entri kind:
  // 'quiz'/'flashcard' di tools[] (dipindah 7 Sep dari pluginItems, lihat komentar
  // "Konsolidasi 7 Sep" di atas const tools), (4) blok ini sendiri,
  // (5) blok render <MediaStudio/> + <StudioResult/> di JSX (dicari via komentar sama).
  // FIX (temuan gap-fix 7 Sep): field `mode` opsional ditambah -- default 'media' (perilaku
  // lama persis). Dipakai tombol baru "Template Dokumen" di tools[] di atas supaya bisa
  // membuka MediaStudio LANGSUNG di tab Template Dokumen, bukan lewat tab media dulu.
  const [mediaPanel, setMediaPanel] = useState<{ id: string; kind: StudioKind; chatId: string; text: string; source: string; mode?: 'media' | 'template' } | null>(null);
  const studioRequestsInFlight = useRef<Set<string>>(new Set());

  const openStudio = (kind: StudioKind, text = '', chatId = activeChatId, mode: 'media' | 'template' = 'media') => {
    if (kind === 'video') {
      showToast('Generate video hanya tersedia untuk CEO dan Marketing.');
      return;
    }
    const sourceChat = chats.find(chat => chat.id === chatId);
    const attachmentText = attachedFiles[chatId]?.content || '';
    const historyText = sourceChat?.messages.filter(message => message.text.trim() && !message.studioFailed).slice(-8).map(message => message.text).join('\n\n') || '';
    const source = resolveStudioSource({ kind, composerText: text, attachmentText, historyText });
    setPluginOpen(false);
    setMediaPanel({ id: crypto.randomUUID(), kind, chatId, text, source, mode });
  };

  const submitStudio = async (submission: StudioSubmission, chatId: string) => {
    if (submission.type === 'media' && submission.request.kind === 'video') {
      showToast('Generate video hanya tersedia untuk CEO dan Marketing.');
      throw new Error('Fitur generate video hanya diizinkan untuk peran CEO (Executive) dan Marketing.');
    }
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
        // 8 Sep 2026 (temuan scan composer-ui #3): Finance BELUM dapat fix B1 VIDEO ASYNC
        // 7 Sep yang sudah ada di Executive/Marketing -- video pending harus di-poll,
        // kalau tidak kartu hasil kosong selamanya. Pola identik ExecutiveAIAssistantView.
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
    } else if (action.kind === 'video') {
      showToast('Generate video hanya tersedia untuk CEO dan Marketing.');
    } else if (action.kind === 'image' || action.kind === 'flashcard' || action.kind === 'quiz') {
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
  // acuan) -- 2 handler baru memanggil endpoint B2/B3 langsung.
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

  // Ringkasan perusahaan Anda -- SEBELUM fix ini 4 kartu di bawah 100% literal tetap
  // (Rp 25,5 jt / 3.1x / 92% / Rp 19,4 jt), TIDAK PERNAH mencoba baca liveCompanyState
  // sama sekali -- lebih parah dari pola "||" di Executive/Marketing (yang minimal
  // mencoba baca dulu sebelum jatuh ke fallback). Guard di bawah di-porting verbatim
  // dari ExecutiveAIAssistantView.tsx (yang porting dari MarketingModuleView.tsx baris
  // 74-77) supaya 3 role konsisten. Piutang (arOverdue) memang belum ada penulis live
  // manapun di seluruh codebase -- tampilkan empty-state jujur, JANGAN karang endpoint
  // baru. CARA MEMBATALKAN: hapus 9 const has*/live*/*Display di bawah, kembalikan
  // literal lama ('Rp 25,5 jt' dst) di const stats.
  const liveStats = liveCompanyState || {};
  const liveFinancials = liveStats.financials || {};
  const liveMarketing = liveStats.marketing || {};
  const liveTeamOps = liveStats.teamOps || {};
  const juta = (n: number) => `Rp ${(n / 1000000).toFixed(1).replace('.', ',')} jt`;
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
  // Status rekomendasi AR hanya boleh mengikuti sumber AR aktual. Saldo kas
  // tidak membuktikan invoice sudah ditagih atau reminder sudah dieksekusi.
  const pendingAr = hasAr;

  // "delta" (dulu literal +4%/+2%/+1%/+2%) DIHAPUS isinya -- tidak ada satupun tempat
  // di codebase yang menyimpan angka pekan-lalu untuk dihitung selisihnya, jadi delta
  // apapun yang ditampilkan pasti karangan, bukan cuma saat workspace kosong.
  const stats = [
    { label: 'Kas bersih', value: cashDisplay, trendAvailable: false, source: 'Kas & Keuangan', prompt: 'Ringkas arus kas 30 hari terakhir dan jelaskan posisi runway kami saat ini.' },
    { label: 'Blended ROAS', value: roasDisplay, trendAvailable: false, source: 'Metrik Pemasaran', prompt: 'Evaluasi performa iklan bulan ini berdasarkan ROAS, CAC, dan kontribusi tiap kanal.' },
    { label: 'Beban tim', value: loadDisplay, trendAvailable: false, source: 'Beban Tim & SDM', prompt: 'Periksa beban tim per divisi, tugas yang tertunda, dan capaian SLA bulan ini.' },
    { label: 'Piutang jatuh tempo', value: arDisplay, trendAvailable: false, source: 'Piutang Klien', prompt: 'Tinjau status piutang jatuh tempo kami saat ini.' },
  ];

  // Skor kesehatan bisnis -- data NYATA dari klir_live_company_state (healthScore),
  // fallback COPY VERBATIM dari CompanyDataDashboard.tsx baris 523-527 (dikonfirmasi
  // langsung baca file itu) supaya konsisten dengan angka yang Mecca lihat di Dashboard
  // Perusahaan -- literal lama (88/'Sangat baik'/95-100-35-100) TERBUKTI SALAH, itu
  // bukan default asli manapun, cuma angka mockup v6 yang ditinggal begitu saja.
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

  // Sumber data yang dibaca AI -- 4 sistem, sama untuk semua role.
  const dataSources = [
    { label: 'Kas & Keuangan', meta: 'saldo, beban, runway', icon: <FileSpreadsheet size={14} color="#3FBF8F" />, tone: '#3FBF8F' },
    { label: 'Metrik Pemasaran', meta: 'ROAS, CAC, lead', icon: <TrendingUp size={14} color="#4E9BFF" />, tone: '#4E9BFF' },
    { label: 'Beban Tim & SDM', meta: 'utilisasi, SLA', icon: <Users size={14} color="#8CBEFF" />, tone: '#8CBEFF' },
    { label: 'Piutang Klien', meta: 'invoice, jatuh tempo', icon: <Receipt size={14} color="#C9A66B" />, tone: '#C9A66B' },
  ];
  const DATA_FLOW_PATHS = [
    'M0 19 C 36 19, 40 94, 76 94',
    'M0 69 C 36 69, 40 94, 76 94',
    'M0 119 C 36 119, 40 94, 76 94',
    'M0 169 C 36 169, 40 94, 76 94',
  ];

  // Belum ada sumber backend struktur tim per divisi. Jangan tampilkan org-chart
  // ilustratif sebagai data perusahaan nyata.
  const hasDivisions = Array.isArray(liveTeamOps.divisions) && liveTeamOps.divisions.length > 0;
  const divisionLoad: { name: string; members: number; loadPercent: number }[] =
    hasDivisions ? liveTeamOps.divisions : [];

  // Hasil kerja AI -- SEBELUM fix ini "File dibuat" (4) & "Instruksi dieksekusi" (0)
  // adalah angka tetap di kode, BUKAN hitungan nyata (padahal Marketing sudah punya
  // hitungan nyata, baris ~1589-1596: filesCreatedCount dari chats.reduce(...) dan
  // (liveCompanyState.directives||[]).length). Pola itu di-porting verbatim ke sini,
  // disesuaikan nama field ChatMessage Finance (realFile/realImage/studioMedia/
  // studioNotebook, prefix "studio" -- lihat interface ChatMessage baris ~95).
  // "Percakapan" tetap dihitung dari chats.length seperti sebelumnya (sudah nyata).
  // Histori output mingguan belum punya sumber backend, jadi jangan menggambar bar
  // seed yang tampak seperti performa enam pekan terakhir.
  const filesCreatedCount = chats.reduce(
    (n, c) => n + c.messages.filter((m) => m.realFile || m.realImage || m.studioMedia?.status === 'ready' || m.studioNotebook).length,
    0
  );
  // "File hasil AI" panel (modal filesOpen, baris ~3210) -- FIX bug nyata 7 Sep:
  // dulu generatedFiles = useState hardcode 4 file, TANPA setter, gak pernah nambah
  // walau chat sudah generate banyak file. Sekarang DAFTAR live dari `chats`, sumber
  // SAMA dengan filesCreatedCount di atas (realFile/realImage/studioMedia.status===
  // 'ready'/studioNotebook). Tombol Unduh tiap entri pakai FUNGSI UNDUH YANG SUDAH
  // ADA -- TIDAK ada logic unduh baru: realFile -> downloadRealFile() (baris ~1044,
  // decode base64 asli); realImage -> window.open(url) (pola sama seperti tombol
  // "Buka / unduh gambar" di bubble chat, baris ~2884); studioMedia ready -> anchor
  // href=dataUrl+download (pola SAMA PERSIS dengan StudioResult.tsx baris ~228,
  // video pakai url+window.open sama seperti StudioResult baris ~215); studioNotebook
  // -> downloadSeedFile() (fungsi lama di file ini, baris ~729, dipakai apa adanya)
  // dengan isi JSON asli payload notebook -- BUKAN teks karangan.
  // createdAt: id pesan realFile/realImage berpola `ai-fin-${Date.now()}` (baris
  // ~1246) jadi epoch-nya diekstrak langsung dari id (akurat per pesan). Pesan
  // studio (studioMedia/studioNotebook) memakai id crypto.randomUUID() (baris
  // ~1619) -- TIDAK ada epoch per-pesan tersimpan di state -- fallback ke
  // chat.updatedAt (epoch nyata juga, cuma granularitas per-chat bukan per-pesan,
  // BUKAN tebakan/hardcode).
  const extractEpochFromMsgId = (id: string): number | null => {
    const match = /(\d{13})$/.exec(id || '');
    if (!match) return null;
    const n = Number(match[1]);
    return Number.isFinite(n) ? n : null;
  };
  const guessImageExt = (url: string, fallback: string) => {
    const dataMatch = /^data:[a-z]+\/([a-z0-9.+-]+);base64,/i.exec(url || '');
    if (dataMatch) {
      const sub = dataMatch[1].toLowerCase();
      return sub === 'jpeg' ? 'jpg' : sub;
    }
    const clean = (url || '').split('?')[0].split('#')[0];
    const seg = clean.split('.').pop();
    if (seg && seg.length <= 5 && /^[a-z0-9]+$/i.test(seg)) return seg.toLowerCase();
    return fallback;
  };
  // Perkiraan ukuran file dari data yang benar-benar ada (base64/teks), BUKAN
  // dikarang. base64 -> bytes pakai rasio 3/4 standar; null kalau sumbernya URL
  // remote tanpa data (mis. realImage/studioMedia video yang cuma punya link).
  const base64ByteSize = (base64: string) => Math.max(0, Math.round((base64 || '').replace(/^data:[^,]*,/, '').length * 0.75));
  type GeneratedFileEntry = { id: string; name: string; createdAt: number; sizeBytes: number | null; chatId: string; messageId: string; downloadFn: () => void };
  const generatedFiles: GeneratedFileEntry[] = chats
    .flatMap((c) =>
      c.messages.flatMap((m) => {
        const createdAt = extractEpochFromMsgId(m.id) ?? c.updatedAt ?? Date.now();
        const entries: GeneratedFileEntry[] = [];
        if (m.realFile) {
          const rf = m.realFile;
          entries.push({
            id: `${m.id}-realfile`,
            name: rf.fileName,
            createdAt,
            sizeBytes: base64ByteSize(rf.fileBase64),
            chatId: c.id,
            messageId: m.id,
            downloadFn: () => downloadRealFile(rf),
          });
        }
        if (m.realImage) {
          const ri = m.realImage;
          const ext = guessImageExt(ri.url, 'png');
          const isDataUrl = ri.url.startsWith('data:');
          entries.push({
            id: `${m.id}-realimage`,
            name: `Gambar-${(ri.prompt || 'hasil-generate').slice(0, 40).trim().replace(/[^a-zA-Z0-9]+/g, '-')}.${ext}`,
            createdAt,
            sizeBytes: isDataUrl ? base64ByteSize(ri.url) : null,
            chatId: c.id,
            messageId: m.id,
            downloadFn: () => { window.open(ri.url, '_blank', 'noopener'); },
          });
        }
        if (m.studioMedia?.status === 'ready') {
          const media = m.studioMedia;
          const ext = media.mimeType === 'audio/wav' ? 'wav' : media.mimeType === 'audio/mpeg' ? 'mp3' : media.mimeType === 'image/jpeg' ? 'jpg' : media.mimeType === 'image/webp' ? 'webp' : media.kind === 'video' ? 'mp4' : 'png';
          entries.push({
            id: `${m.id}-studiomedia`,
            name: media.fileName || `Media-${media.kind}-${m.id}.${ext}`,
            createdAt,
            sizeBytes: media.dataUrl ? base64ByteSize(media.dataUrl) : null,
            chatId: c.id,
            messageId: m.id,
            downloadFn: () => {
              if (media.kind === 'video' && media.url) { window.open(media.url, '_blank', 'noopener'); return; }
              if (media.dataUrl) {
                const a = document.createElement('a');
                a.href = media.dataUrl;
                a.download = media.fileName || `klir-media.${ext}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              }
            },
          });
        }
        if (m.studioNotebook) {
          const nb = m.studioNotebook;
          const nbTitle = (nb.title || 'Notebook').replace(/[^a-zA-Z0-9 _-]+/g, '').trim() || 'Notebook';
          const nbContent = JSON.stringify(nb.payload, null, 2);
          entries.push({
            id: `${m.id}-studionotebook`,
            name: `${nbTitle}.json`,
            createdAt,
            sizeBytes: nbContent.length,
            chatId: c.id,
            messageId: m.id,
            downloadFn: () => downloadSeedFile({ name: `${nbTitle}.json`, content: nbContent }),
          });
        }
        return entries;
      })
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  const aiOutputs = [
    { label: 'File dibuat', value: filesCreatedCount },
    { label: 'Instruksi dieksekusi', value: (liveStats.directives || []).length },
    { label: 'Percakapan', value: chats.length },
  ];
  // FIX (sesi ini): dulu konstanta literal 99 -- sidebar ini permanen hijau "24 bulan+
  // aman" ntah gimanapun kondisi kas asli. loadRealFinancials() di atas sekarang fetch
  // /api/v1/brain/context (sumber yang sama dipakai CompanyDataDashboard.tsx Fatur),
  // jadi dibaca dari liveFinancials seperti field lain di file ini. 99 = fallback SAH
  // (belum ada data burn-rate sama sekali), BUKAN nilai permanen.
  const hasRunway = typeof liveFinancials.runwayMonths === 'number' && (
    (liveFinancials.netCashBalance ?? 0) !== 0 ||
    (liveFinancials.revenue30d ?? 0) !== 0 ||
    (liveFinancials.expense30d ?? 0) !== 0
  );
  const runwayMonths = hasRunway ? liveFinancials.runwayMonths : 0;
  const runwayCapped = Math.min(Math.max(runwayMonths, 0), 24);
  const runwayPercent = Math.round((runwayCapped / 24) * 100);
  // FIX (audit workflow, sesi ini): dulu cuma 3 tier (hijau/tan/oranye), gak ada
  // tier merah walau runway sudah kritis/negatif (kas minus) -- warna paling
  // "parah" yang bisa muncul cuma oranye, understate urgensi. #EF4444 dipakai
  // konsisten dengan warna merah lain di file ini (risk badge, simulasi negatif).
  const runwayColor = !hasRunway ? '#8A93A3' : runwayMonths >= 12 ? '#3FBF8F' : runwayMonths >= 6 ? '#C9A66B' : runwayMonths >= 3 ? '#D8A33C' : '#EF4444';

  // Semua kemampuan AI -- katalog PENUH mockup v6 (CAPABILITIES(), 28 item)
  // difilter untuk role Finance saja (roles.includes('finance')) -- 22 item,
  // dikelompokkan ke 5 kategori yang sama dengan mockup.
  const capCats = [
    { title: 'Dokumen & korespondensi', tone: '#4E9BFF' },
    { title: 'Analisis & data', tone: '#3FBF8F' },
    { title: 'Dokumen panjang & rapat', tone: '#8CBEFF' },
    { title: 'Materi promosi', tone: '#C9A66B' },
    { title: 'Teknis & riset pasar', tone: '#D8A33C' },
  ];
  const capabilities = [
    { key: 'doc_proposal', cat: 0, icon: <FileText size={17} strokeWidth={1.7} />, label: 'Draf proposal kerjasama', note: 'Dokumen 4 bagian: latar, lingkup, harga, syarat', prompt: 'Buatkan draf proposal kerjasama untuk klien enterprise: latar belakang, ruang lingkup pekerjaan, skema harga, dan syarat kerjasama.' },
    { key: 'doc_invoice', cat: 0, icon: <Receipt size={17} strokeWidth={1.7} />, label: 'Surat penagihan invoice', note: 'Nada sopan tapi tegas, siap kirim hari ini', prompt: 'Buatkan surat penagihan invoice yang sopan namun tegas untuk klien yang telat bayar 3 hari.' },
    { key: 'doc_email', cat: 0, icon: <Mail size={17} strokeWidth={1.7} />, label: 'Email tindak lanjut rapat', note: 'Poin sepakat, pemilik tugas, langkah berikutnya', prompt: 'Buatkan email tindak lanjut setelah rapat klien berisi ringkasan poin yang disepakati dan langkah berikutnya.' },
    { key: 'legal', cat: 0, icon: <Scale size={17} strokeWidth={1.7} />, label: 'Draf kontrak & dokumen legal', note: 'MoU dan NDA, pasal berisiko ditandai untuk ahli', prompt: 'Buatkan draf kontrak kerjasama sederhana beserta klausul pembayaran, lingkup pekerjaan, kerahasiaan, dan masa berlaku. Tandai bagian yang perlu ditinjau ahli hukum.' },
    { key: 'complaint', cat: 0, icon: <Shield size={17} strokeWidth={1.7} />, label: 'Balasan komplain klien', note: 'Redakan dulu, akui fakta, tawarkan jalan keluar', prompt: 'Buatkan balasan untuk komplain klien yang kecewa dengan keterlambatan pengerjaan: akui fakta, jelaskan penyebab, tawarkan solusi konkret dan kompensasi yang masuk akal.' },
    { key: 'sop', cat: 0, icon: <ClipboardCheck size={17} strokeWidth={1.7} />, label: 'SOP & prosedur kerja', note: 'Langkah bernomor, penanggung jawab, kriteria selesai', prompt: 'Susun SOP prosedur kerja lengkap: tujuan, ruang lingkup, langkah berurutan, penanggung jawab tiap langkah, dan kriteria selesai.' },
    { key: 'cashflow', cat: 1, icon: <Wallet size={17} strokeWidth={1.7} />, label: 'Ringkas arus kas 30 hari', note: 'Kas masuk, keluar, dan sisa runway dalam bulan', prompt: 'Analisis arus kas 30 hari terakhir perusahaan dan jelaskan posisi runway kami saat ini.' },
    { key: 'excel', cat: 1, icon: <FileSpreadsheet size={17} strokeWidth={1.7} />, label: 'Spreadsheet Excel', note: 'Kolom, rumus, dan format siap tempel ke Excel', prompt: 'Buatkan struktur spreadsheet Excel untuk laporan arus kas bulanan, lengkap dengan nama kolom dan rumus yang dipakai.' },
    { key: 'chart', cat: 1, icon: <PieChart size={17} strokeWidth={1.7} />, label: 'Grafik & visualisasi data', note: 'Angka mentah jadi grafik plus temuan utamanya', prompt: 'Ubah angka mentah ini menjadi visualisasi data: pilih jenis grafik yang tepat, jelaskan alasannya, sebutkan sumbu dan label, lalu tuliskan temuan utamanya.' },
    { key: 'forecast', cat: 1, icon: <BarChart2 size={17} strokeWidth={1.7} />, label: 'Proyeksi kas 3 bulan', note: 'Skenario pesimis, dasar, dan optimis', prompt: 'Buatkan proyeksi arus kas tiga bulan ke depan dalam tiga skenario (pesimis, dasar, optimis) berdasarkan data kas dan beban kami saat ini.' },
    { key: 'anomaly', cat: 1, icon: <AlertTriangle size={17} strokeWidth={1.7} />, label: 'Deteksi anomali biaya', note: 'Pos belanja yang melonjak di luar kebiasaan', prompt: 'Periksa data pengeluaran kami dan tandai pos biaya yang melonjak di luar kebiasaan, sertakan besar selisih dan kemungkinan penyebabnya.' },
    { key: 'research', cat: 1, icon: <Search size={17} strokeWidth={1.7} />, label: 'Riset & analisis data', note: 'Temuan, angka pendukung, dan rekomendasi tindakan', prompt: 'Lakukan riset dan analisis data bisnis perusahaan bulan ini, sertakan temuan utama, angka pendukung, dan rekomendasi.' },
    { key: 'longdoc', cat: 2, icon: <BookOpen size={17} strokeWidth={1.7} />, label: 'Ringkasan & tanya-jawab dokumen', note: 'Unggah PDF ratusan halaman, tanya isinya', prompt: 'Ringkas dokumen panjang yang saya unggah menjadi poin-poin utama, lalu siap menjawab pertanyaan lanjutan tentang isinya.' },
    { key: 'minutes', cat: 2, icon: <MessageSquare size={17} strokeWidth={1.7} />, label: 'Notulen dari transkrip rapat', note: 'Keputusan, daftar tugas, dan tenggatnya', prompt: 'Ubah transkrip rapat ini menjadi notulen resmi: ringkasan pembahasan, keputusan yang diambil, daftar tugas dengan penanggung jawab, dan tenggat waktunya.' },
    { key: 'doc_compare', cat: 2, icon: <Copy size={17} strokeWidth={1.7} />, label: 'Bandingkan dua dokumen', note: 'Selisih pasal, angka, dan tanggal antar versi', prompt: 'Bandingkan dua versi dokumen ini dan tunjukkan selisihnya: pasal yang berubah, angka yang berbeda, tanggal yang bergeser, dan mana yang perlu dinegosiasikan.' },
    { key: 'translate', cat: 2, icon: <Globe size={17} strokeWidth={1.7} />, label: 'Terjemahan bahasa', note: 'ID, EN, Mandarin, Jepang, istilah teknis dijaga', prompt: 'Terjemahkan dokumen ini ke bahasa Inggris dengan gaya bisnis formal, pertahankan istilah teknis, dan tandai bagian yang ambigu.' },
    { key: 'slide', cat: 3, icon: <Presentation size={17} strokeWidth={1.7} />, label: 'Presentasi & slide', note: '10 slide berjudul dengan poin isi tiap halaman', prompt: 'Buatkan kerangka presentasi 10 slide untuk rapat strategi bulanan, sertakan judul dan poin isi tiap slide.' },
    { key: 'code', cat: 4, icon: <Terminal size={17} strokeWidth={1.7} />, label: 'Tulis & jelaskan kode program', note: 'Skrip jalan plus penjelasan tiap baris', prompt: 'Tuliskan skrip untuk mengotomatiskan pekerjaan ini, lalu jelaskan tiap bagian kodenya dalam bahasa sederhana.' },
    { key: 'competitor', cat: 4, icon: <Target size={17} strokeWidth={1.7} />, label: 'Riset kompetitor', note: 'Peta harga pesaing dan celah yang bisa diambil', prompt: 'Lakukan riset kompetitor: bandingkan posisi harga, keunggulan, kelemahan, dan tunjukkan celah pasar yang bisa kami ambil.' },
    { key: 'swot', cat: 4, icon: <Layers size={17} strokeWidth={1.7} />, label: 'Analisis SWOT & risiko', note: 'Kekuatan, kelemahan, peluang, ancaman', prompt: 'Susun analisis SWOT perusahaan kami berdasarkan data yang ada, lalu urutkan risiko terbesar beserta langkah mitigasinya.' },
    { key: 'training', cat: 4, icon: <GraduationCap size={17} strokeWidth={1.7} />, label: 'Materi pelatihan & onboarding', note: 'Modul, latihan, dan kuis penilaian', prompt: 'Buatkan materi pelatihan onboarding staf baru: modul per topik, latihan praktik, dan kuis penilaian di akhir.' },
    { key: 'unit_econ', cat: 4, icon: <Gauge size={17} strokeWidth={1.7} />, label: 'Penjelasan unit economics', note: 'CAC, LTV, dan rasio ideal dengan angka Anda', prompt: 'Jelaskan konsep unit economics CAC vs LTV dan rasio idealnya untuk bisnis kami.' },
  ].map((c) => ({ ...c, locked: false }));
  const capGroups = capCats
    .map((cat, ci) => ({ ...cat, items: capabilities.filter((c) => c.cat === ci) }))
    .filter((g) => g.items.length > 0);
  const capOpenCount = capabilities.length;
  const capSummary = `${capOpenCount} kemampuan aktif untuk divisi keuangan`;
  // 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): grid "Semua kemampuan AI"
  // dihapus dari area utama, isinya PINDAH ke sidebar "Kemampuan & tools AI" -- dikelompokkan
  // per kategori (judul kecil). Dedup HANYA exact-label-match (case-insensitive, trim)
  // terhadap tools[] yang sudah ada di sidebar -- KONSERVATIF (lihat alasan sama di
  // ExecutiveAIAssistantView.tsx, dedup fuzzy berisiko menghapus kemampuan unik).
  const sidebarExistingLabels = new Set<string>(tools.map((t) => t.label.trim().toLowerCase()));
  const capSidebarGroups = capGroups
    .map((grp) => ({ ...grp, items: grp.items.filter((c) => !sidebarExistingLabels.has(c.label.trim().toLowerCase())) }))
    .filter((grp) => grp.items.length > 0);
  const capSidebarCount = capSidebarGroups.reduce((sum, grp) => sum + grp.items.length, 0);

  // "Mulai dari tugas nyata" -- 3 kategori/9 kartu ini IDENTIK di mockup v6
  // untuk ketiga role (statis, tidak difilter per role), sama dengan yang
  // dipakai ExecutiveAIAssistantView.tsx. Field kind/kindLabel (bukan icon)
  // dipakai bareng cardArt() supaya kartunya animasi, sama persis dengan
  // CEO/Marketing -- sebelum ini Finance pakai field `icon` + render flat
  // 80px yang gak match (temuan Mecca 7 Sep). Untuk membatalkan: kembalikan
  // field ke `icon: <Komponen size={20} color={warna} />` per kartu dan
  // pakai lagi render block lama (lihat histori git file ini).
  const gallery: { title: string; dotColor: string; cards: { t: string; n: string; p: string; kind: string; kindLabel: string; locked?: boolean }[] }[] = [
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
        { t: 'Deteksi anomali biaya operasional', n: 'Pos belanja yang melonjak di luar kebiasaan', p: 'Periksa data pengeluaran kami dan tandai pos biaya yang melonjak di luar kebiasaan, sertakan besar selisih dan kemungkinan penyebabnya.', kind: 'trending-up', kindLabel: 'Tren & metrik' },
        { t: 'Periksa beban tim dan tugas tertunda', n: 'Utilisasi per divisi dan capaian SLA', p: 'Periksa beban tim per divisi, tugas yang tertunda, dan capaian SLA bulan ini.', kind: 'users', kindLabel: 'Beban tim' },
      ],
    },
    {
      // FIX (audit role-fit 7 Sep): kategori "Materi promosi" (tugas Marketing murni:
      // naskah video, banner promo, konten sosial) DIGANTI kategori finansial. Untuk
      // membatalkan: kembalikan 3 kartu Materi Promosi (lihat histori git file ini).
      title: 'Pajak & kepatuhan',
      dotColor: '#C9A66B',
      cards: [
        { t: 'Estimasi setoran pajak PPh dan PPN bulan ini', n: 'Fitur perpajakan belum tersedia saat ini', p: 'Hitung estimasi kewajiban setor PPh Final 0,5% dan ringkasan PPN untuk periode berjalan.', kind: 'file-spreadsheet', kindLabel: 'Belum tersedia', locked: TAX_FEATURE_LOCKED },
        { t: 'Rekonsiliasi kas dan mutasi bank bulan ini', n: 'Cocokkan saldo buku kas dengan rekening koran', p: 'Buatkan rekonsiliasi kas dan mutasi bank untuk bulan ini, cocokkan saldo buku kas internal dengan rekening koran, dan tandai selisih yang perlu ditelusuri.', kind: 'file-spreadsheet', kindLabel: 'Rekonsiliasi' },
        { t: 'SOP kas kecil dan reimbursement karyawan', n: 'Alur pengajuan, persetujuan, kriteria kuitansi', p: 'Susun SOP alur pengajuan kas kecil, persetujuan reimbursement, dan kriteria kuitansi valid.', kind: 'file-text', kindLabel: 'Template dokumen' },
      ],
    },
  ];

  return (
    <div style={{ height: '100%', background: '#06080C', padding: '14px', fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", color: '#F5F7FA', WebkitFontSmoothing: 'antialiased', boxSizing: 'border-box' }}>
      {/* Keyframes dipakai cardArt() (galeri "Mulai dari tugas nyata") + animasi lain di
          file ini (mis. klirFlow line 2176-an). Disalin dari ExecutiveAIAssistantView.tsx
          -- sebelum ini file ini TIDAK punya blok <style> sendiri sama sekali, jadi
          animasinya cuma "kebetulan jalan" kalau Executive/Marketing sempat ke-mount
          duluan di sesi yang sama. Untuk membatalkan: hapus blok <style> ini. */}
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
          <aside style={{ width: '274px', flexShrink: 0, background: '#06080C', borderRight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '14px 12px', overflow: 'hidden' }}>
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
                  <span style={{ fontSize: '10.5px', color: '#5C6474', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {userTitle}
                  </span>
                </span>
                <span style={{ marginLeft: 'auto', flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#C9A66B', border: 0, borderRadius: '999px', padding: '2.5px 8px', background: 'rgba(201,166,107,0.12)' }}>
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
                    <Plus size={14} strokeWidth={2.5} />
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
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '9px 9px', border: 0, borderRadius: '12px', background: 'rgba(255,255,255,0.06)', color: '#8A93A3', cursor: 'pointer' }}
                >
                  <PanelLeftClose size={14} color="#4E9BFF" />
                </button>
              </div>

              {/* Ruang kerja Finance: hanya pintasan yang relevan untuk divisi.
                  Pengaturan akses/admin milik CEO tidak boleh tampak sebagai
                  kemampuan Finance sebelum RBAC sungguhan tersedia. */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#5C6474', padding: '0 8px 7px', textAlign: 'left' }}>
                  Ruang kerja
                </span>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: '1px solid rgba(63,191,143,0.22)', borderRadius: '10px', background: 'rgba(63,191,143,0.08)', color: '#3FBF8F', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Settings2 size={15} color="#3FBF8F" strokeWidth={2} />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pengaturan Finance</span>
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#3FBF8F', background: 'rgba(63,191,143,0.18)', padding: '2px 6px', borderRadius: '6px' }}>
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
                  <span style={{ flexShrink: 0, fontSize: '10.5px', color: '#5C6474' }}>{generatedFiles.length}</span>
                </button>
                {/* Item 4.1 roadmap 7 Sep -- Pusat Data, terpisah dari "File hasil AI" di
                    atas: yang itu hasil GENERATE AI (mockup, session-only), ini file yang
                    DIUNGGAH user dan tersimpan permanen server-side. */}
                <button
                  type="button"
                  onClick={() => setDataHubOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  <Database size={15} color="#4E9BFF" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Pusat Data</span>
                </button>
                {/* 'Kelola plugin' dihapus (audit role-fit 7 Sep) -- togglePlugin tidak pernah
                    dipanggil dari UI manapun di file ini (cuma dideklarasikan), dan tombol ini
                    cuma duplikat fungsi tombol "Pengaturan Finance" di atas (sama-sama
                    onClick={() => setSettingsOpen(true)}). CATATAN: ExecutiveAIAssistantView.tsx
                    (CEO) punya pola serupa, ditangani terpisah di file itu sesi ini juga. Untuk
                    membatalkan: kembalikan blok <button> 'Kelola plugin' (lihat histori git). */}
                {/* FIX (konsolidasi zona tombol AI, 7 Sep -- putaran 2, keputusan Mecca):
                    dropdown "Plugin" composer dulu disisakan 1-item ("Integrasi Akuntansi &
                    Pajak") supaya minimal-diff -- tapi itu tetap 1 tombol AI-related yang
                    hidup DI LUAR sidebar (bertentangan dengan tujuan "satu zona konsisten,
                    berlaku ke SEMUA AI Assistant"). Dipindah ke sini supaya Finance genuinely
                    sama seperti Executive & Marketing -- composer sekarang 0 tombol dropdown. */}
                <button
                  type="button"
                  onClick={() => showToast(TAX_FEATURE_LOCK_MESSAGE, 3200)}
                  aria-disabled="true"
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.025)', color: '#737B89', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'not-allowed' }}
                >
                  <Lock size={15} color="#737B89" />
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Integrasi Akuntansi &amp; Pajak (Belum tersedia)</span>
                </button>
                {/* FIX gap kemampuan-002/005 (audit 7 Sep 2026, porting dari
                    ExecutiveAIAssistantView.tsx): tombol ini dulu membuka modal "akses
                    per-divisi" penuh dengan grid toggle yang terlihat 100% berfungsi TAPI
                    0% berefek di manapun -- adminOverrides/accessMode HANYA dibaca di
                    dalam modal itu sendiri, dan Finance/Marketing/Executive adalah
                    instance komponen React TERPISAH (state tidak dibagi lintas portal),
                    jadi struktural TIDAK BISA membatasi apapun tanpa penyimpanan bersama +
                    skema akses granular (keputusan Fatur/Mecca, lihat audit gap-002).
                    Disamakan dengan Marketing (toast jujur). Modal lama DIPERTAHANKAN
                    sebagai referensi tapi sekarang unreachable. CARA MEMBATALKAN:
                    kembalikan onClick jadi () => setAdminOpen(true). */}
              </div>

              {/* Kemampuan & Tools AI Keuangan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowToolsNav((v) => {
                      const next = !v;
                      try { localStorage.setItem('klir_finance_ai_nav_tools', next ? '1' : '0'); } catch (e) { /* storage blocked */ }
                      return next;
                    });
                  }}
                  aria-expanded={showToolsNav}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '0 8px 7px', border: 0, background: 'transparent', color: '#5C6474', fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  {showToolsNav ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Kemampuan &amp; tools AI
                  </span>
                  {/* 11 Sep 2026 (kontrak B4): +capSidebarCount -- 22 kemampuan eks-grid
                      "Semua kemampuan AI" (dikurangi yang di-dedup) sekarang ikut dihitung
                      di sini karena isinya genuinely pindah ke bawah, bukan dihapus. */}
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#5C6474' }}>{tools.length + capSidebarCount}</span>
                </button>
                {showToolsNav && tools.map((tool, idx) => (
                  <button
                    key={idx}
                    type="button"
                    aria-disabled={tool.locked || undefined}
                    title={tool.locked ? 'Fitur ini belum tersedia saat ini.' : tool.label}
                    onClick={() => {
                      if (tool.locked) {
                        showToast('Kemampuan ini belum diaktifkan untuk divisi Anda.', 3200);
                        return;
                      }
                      if (tool.docTemplate) {
                        openStudio(tool.kind || 'image', inputMessage, undefined, 'template');
                      } else if (tool.key === 'invoiceGenerator') {
                        // FIX FIN-01 (8 Sep) -- buka mini-form dulu, jangan langsung
                        // kirim prompt generik (lihat komentar di deklarasi tools[]).
                        setInvoiceFormOpen(true);
                      } else if (tool.kind) {
                        openStudio(tool.kind, inputMessage);
                      } else if (tool.prompt === 'upload_trigger') {
                        fileInputRef.current?.click();
                      } else {
                        handleSendMessage(tool.prompt);
                      }
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: tool.locked ? '#8A93A3' : '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: tool.locked ? 'not-allowed' : 'pointer' }}
                  >
                    {tool.icon}
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0, flex: 1 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tool.label}
                      </span>
                      {tool.locked && <span style={{ fontSize: '9.5px', fontWeight: 500, color: '#C9A66B' }}>Belum tersedia</span>}
                    </span>
                    {tool.locked && <Lock size={11} color="#C9A66B" strokeWidth={2} style={{ flexShrink: 0 }} />}
                  </button>
                ))}
                {/* 11 Sep 2026 (kontrak modul UI B4, keluhan Mecca poin 8): eks-grid "Semua
                    kemampuan AI" -- dikelompokkan per kategori (judul kecil, dedup exact-label
                    terhadap tools[] di atas, lihat capSidebarGroups). Klik = perilaku SAMA
                    seperti grid lama (cek cap.locked dulu -- toast kalau terkunci -- baru
                    handleSendMessage(prompt), TIDAK ada openStudio, grid lama Finance juga
                    tidak pernah pakai openStudio). */}
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
                        aria-disabled={cap.locked || undefined}
                        title={cap.locked ? 'Fitur ini belum tersedia saat ini.' : cap.note}
                        onClick={() => {
                          if (cap.locked) {
                            showToast(`"${cap.label}" dinonaktifkan admin untuk divisi ini.`, 3200);
                            return;
                          }
                          handleSendMessage(cap.prompt);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: cap.locked ? '#8A93A3' : '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: cap.locked ? 'not-allowed' : 'pointer' }}
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

              {/* Aksi Kas & Keuangan Langsung */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionsNav((v) => {
                      const next = !v;
                      try { localStorage.setItem('klir_finance_ai_nav_actions', next ? '1' : '0'); } catch (e) { /* storage blocked */ }
                      return next;
                    });
                  }}
                  aria-expanded={showActionsNav}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', width: '100%', padding: '0 8px 7px', border: 0, background: 'transparent', color: '#5C6474', fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                >
                  {showActionsNav ? <ChevronUp size={12} strokeWidth={2} /> : <ChevronDown size={12} strokeWidth={2} />}
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Aksi dashboard perusahaan
                  </span>
                  <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 600, color: '#5C6474' }}>{actions.length}</span>
                </button>
                {showActionsNav && actions.map((act, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => act.locked ? showToast(TAX_FEATURE_LOCK_MESSAGE, 3200) : handleSendMessage(act.prompt)}
                    aria-disabled={act.locked || undefined}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: act.locked ? 'rgba(255,255,255,0.025)' : 'transparent', color: act.locked ? '#737B89' : '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: act.locked ? 'not-allowed' : 'pointer' }}
                  >
                    {act.locked ? <Lock size={14} color="#737B89" /> : act.icon}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {act.locked ? `${act.label} (Belum tersedia)` : act.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Fitur kerja dibuka dari AI Assistant, bukan ditumpuk di bawah
                  dashboard overview -- sama pola dengan ExecutiveAIAssistantView. */}
              {onOpenInventory && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: '#5C6474', padding: '0 8px 7px', textAlign: 'left' }}>
                    Pintasan kerja
                  </span>
                  <button
                    type="button"
                    onClick={() => setInputMessage(INVENTORY_AI_PROMPT)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px', border: 0, borderRadius: '10px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 500, textAlign: 'left', cursor: 'pointer' }}
                  >
                    <Package size={14} strokeWidth={1.7} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Kelola stok lewat AI</span>
                  </button>
                </div>
              )}

              {/* Riwayat Percakapan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '11px', fontWeight: 500, color: '#5C6474', padding: '0 8px 7px', textAlign: 'left' }}>
                  Riwayat
                </span>
                {chats.map((c) => {
                  const isActive = c.id === activeChatId;
                  const firstUserMsg = c.messages.find((m) => m.sender === 'user');
                  const title = firstUserMsg?.text
                    ? firstUserMsg.text.length > 34
                      ? `${firstUserMsg.text.slice(0, 34)}...`
                      : firstUserMsg.text
                    : 'Audit kas baru';

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
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px', color: '#5C6474' }}>
                <ShieldCheck size={12} color="#3FBF8F" />
                <span>KLIR Finance Intelligence</span>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <PanelLeft size={15} color="#4E9BFF" />
                  <span>Menu AI</span>
                </button>
              )}
              <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '14.5px', fontWeight: 700, letterSpacing: '-0.01em', color: '#F5F7FA', whiteSpace: 'nowrap' }}>
                KLIR Finance AI Assistant
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
              {!sidebarOpen && (
                <button
                  type="button"
                  onClick={handleNewChat}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 11px', border: 0, borderRadius: '10px', background: 'rgba(255,255,255,0.06)', color: '#8A93A3', fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                >
                  <Plus size={13} />
                  <span>Obrolan Baru</span>
                </button>
              )}
            </div>
          </div>

          {/* Toast Notification */}
          {toastMsg && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: '12px 18px 0', padding: '10px 12px', border: 0, borderRadius: '12px', background: 'rgba(63,191,143,0.12)', flexShrink: 0 }}>
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

          {/* Peringatan proaktif (F2 Tingkat B, 10 Sep 2026): wadah reusable, sumber dari
              registry proactive-alerts.ts. Tidak render apa pun kalau 0 kartu. */}
          <div style={{ padding: '12px 18px 0' }}>
            <ProactiveAlertsPanel role="FINANCE" workspaceId={workspaceId || ''} onOpenInventory={onOpenInventory} onAskAI={(p) => setInputMessage(p)} />
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
                  <img
                    src="/Logo-KLIR.png"
                    alt="KLIR"
                    style={{ width: '42px', height: '42px', objectFit: 'contain' }}
                  />
                  <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(28px, 2.5vw, 37px)', fontWeight: 700, letterSpacing: '0.045em', lineHeight: 1, color: '#F5F7FA' }}>
                    KLIR
                  </span>
                  <h1 style={{ margin: '16px 0 0', fontFamily: "'Outfit', sans-serif", fontSize: 'clamp(16.5px, 1.3vw, 19px)', fontWeight: 500, letterSpacing: '-0.008em', color: '#8A93A3', textAlign: 'center' }}>
                    Ada yang bisa saya bantu hari ini, {userTitle}?
                  </h1>
                </div>

                {/* Composer Box */}
                <div style={{ position: 'relative', width: '100%', maxWidth: '880px', margin: '0 auto' }}>
                  {/* FIX (konsolidasi zona tombol AI, 7 Sep -- putaran 2): dropdown "Plugin"
                      dihapus total dari sini -- 1 item terakhirnya ("Integrasi Akuntansi &
                      Pajak") sudah pindah ke sidebar "Kemampuan & tools AI". */}

                  {/* Attachment Pill */}
                  {attachedFile && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '9px', padding: '6px 10px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.06)', fontSize: '11.5px', color: '#F5F7FA' }}>
                      <FileSpreadsheet size={14} color="#3FBF8F" />
                      <span>{attachedFile.name}</span>
                      <span style={{ fontSize: '11px', color: '#5C6474' }}>({attachedFile.size})</span>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        style={{ display: 'flex', border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}
                  {/* Item 4.5 roadmap 7 Sep -- kartu pemeriksaan dokumen, muncul begitu
                      analisis tambahan (fire-and-forget di atas) selesai. */}
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
                      placeholder="Tanya soal arus kas, laba rugi, invoice, HPP, atau beri instruksi..."
                      style={{ display: 'block', width: '100%', minHeight: '24px', maxHeight: '200px', overflowY: 'auto', resize: 'none', border: 0, outline: 'none', background: 'transparent', padding: '5px 3px', fontFamily: "'Outfit', sans-serif", fontSize: '15.5px', lineHeight: 1.45, color: '#F5F7FA' }}
                    />
                    <ComposerToolbar
                      prefs={composerPrefs}
                      onPrefsChange={handleComposerPrefsChange}
                      onSend={handleComposerSend}
                      onMicTranscript={handleComposerMicTranscript}
                      onSlashSelect={handleComposerSlashSelect}
                      inputValue={inputMessage}
                      disabled={isTyping}
                      allowVideo={false}
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
                  {/* Pills quick-action row (dulu di sini) DIPINDAH 7 Sep ke sidebar
                      "Kemampuan & tools AI" -- konsolidasi 3-lokasi kemampuan AI jadi 1. */}
                </div>

                {/* Tombol perlihatkan/sembunyikan blok data perusahaan */}
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '30px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowData((v) => {
                        const next = !v;
                        try { localStorage.setItem('klir_finance_ai_show_data', next ? '1' : '0'); } catch (e) { /* storage blocked */ }
                        return next;
                      });
                    }}
                    aria-expanded={showData}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 14px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.06)', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '11.5px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    {showData ? <ChevronUp size={14} /> : <BarChart2 size={14} />}
                    <span>{showData ? 'Sembunyikan data perusahaan' : 'Tampilkan data perusahaan'}</span>
                  </button>
                </div>

                {showData && (
                  <>
                    {/* Ringkasan Perusahaan Card */}
                    <div style={{ marginTop: '14px', border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 17px', borderBottom: 0, background: 'rgba(255,255,255,0.015)' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
                          <span>Ringkasan perusahaan Anda</span>
                        </span>
                        <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>Tren tampil setelah histori pembanding tersedia</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '8px', background: 'transparent', padding: '0 8px 8px' }}>
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
                            </span>
                            <span style={{ display: 'block', margin: '2px 0 1px', fontSize: '10.5px', color: '#5C6474' }}>
                              {s.trendAvailable ? 'Tren tersedia' : 'Belum ada tren pembanding'}
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
                                  {src.icon}
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
                            <span style={{ position: 'absolute', width: '52px', height: '52px', borderRadius: '999px', border: 0 }} />
                            <span style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '12px', background: 'linear-gradient(150deg,#0F6FE0,#0058BE)', boxShadow: '0 10px 26px rgba(0,88,190,0.34)' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M8.2 6.6v10.8M8.2 12l6.4-5.4M8.2 12l6.9 5.4" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rekomendasi Siap Dieksekusi -- SEBELUM fix ini kartu ini SELALU tampil dengan
                        nama klien fiktif "PT Sentosa Abadi" + nominal tetap Rp 19,4 jt, walau tidak
                        ada satupun sumber live (arOverdue) yang menyimpan piutang sungguhan di
                        seluruh codebase -- kontradiksi sekelas kas bersih Rp25,5jt di sidebar padahal
                        Dashboard Perusahaan sudah jujur Rp0. Keputusan disamakan dengan
                        ExecutiveAIAssistantView.tsx (kartu 'ar' di decisionsList sana): kartu di-HIDE
                        seluruhnya kalau !hasAr (tidak ada data piutang live), teks digenericize kalau
                        hasAr suatu saat benar-benar terisi. CARA MEMBATALKAN: hapus wrapper
                        "{hasAr && (...)}" di bawah, kembalikan literal "Tagih piutang PT Sentosa Abadi"
                        + "+Rp 19,4 jt kas masuk" + prompt lama. */}
                    {hasAr && (
                    <div style={{ marginTop: '14px', border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 16px', borderBottom: 0, background: 'rgba(255,255,255,0.015)' }}>
                        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>
                          Rekomendasi siap dieksekusi
                        </span>
                        <span style={{ fontSize: '11px', color: '#8A93A3', whiteSpace: 'nowrap' }}>
                          {pendingAr ? '1 menunggu keputusan Anda' : 'Semua rekomendasi sudah diterapkan'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '14px 16px', minWidth: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', flexShrink: 0, borderRadius: '10px', background: pendingAr ? 'rgba(201,166,107,0.12)' : 'rgba(63,191,143,0.14)', border: 0 }}>
                          {pendingAr ? <Receipt size={16} color="#C9A66B" /> : <Check size={16} color="#3FBF8F" />}
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12px', fontWeight: 600, lineHeight: 1.3, color: '#F5F7FA' }}>
                            Tinjau piutang jatuh tempo
                          </span>
                          <span style={{ fontSize: '11px', color: pendingAr ? '#8A93A3' : '#3FBF8F' }}>
                            {pendingAr ? `${arDisplay} berpotensi tertagih` : 'Sudah diterapkan ke dashboard'}
                          </span>
                        </span>
                        {pendingAr && (
                          <button
                            type="button"
                            onClick={() => handleSendMessage('Tinjau status piutang jatuh tempo kami saat ini.')}
                            style={{ flexShrink: 0, padding: '7px 12px', border: 0, borderRadius: '9px', background: 'rgba(255,255,255,0.06)', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
                          >
                            Tinjau
                          </button>
                        )}
                      </div>
                    </div>
                    )}

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
                          <span style={{ flex: 1, textAlign: 'right', fontSize: '11px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Riwayat output mingguan belum dilacak</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '15px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '56px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)' }}>
                            <span style={{ fontSize: '11px', color: '#5C6474' }}>Belum ada histori output mingguan</span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', background: 'transparent' }}>
                            {aiOutputs.map((out, idx) => (
                              <span key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, padding: '10px 11px', background: 'rgba(255,255,255,0.03)', borderRadius: '9px', minWidth: 0 }}>
                                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1, color: '#F5F7FA' }}>{out.value}</span>
                                <span style={{ fontSize: '10px', color: '#8A93A3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{out.label}</span>
                              </span>
                            ))}
                          </div>
                          <span style={{ display: 'flex', flexDirection: 'column', gap: '5px', paddingTop: '2px', borderTop: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px', paddingTop: '8px' }}>
                              <span style={{ fontSize: '11px', color: '#8A93A3' }}>Runway kas</span>
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
                    kemampuan AI" DIHAPUS dari area utama -- 22 kemampuan (capabilities/
                    capCats/capGroups di atas, TIDAK dihapus datanya) dipindah ke sidebar
                    kiri "Kemampuan & Tools AI Keuangan" (lihat render grouped-list dekat
                    tools.map). Galeri "Mulai dari tugas nyata" di bawah TETAP. */}

                {/* "Mulai dari tugas nyata" Gallery */}
                <div style={{ marginTop: '64px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', paddingBottom: '14px', borderBottom: 0 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, letterSpacing: '-0.012em', color: '#F5F7FA' }}>
                        Mulai dari tugas nyata
                      </span>
                      <span style={{ fontSize: '12px', color: '#8A93A3' }}>
                        Sembilan pekerjaan yang paling sering dipakai divisi finance. Satu klik, langsung dikerjakan.
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
                            onClick={() => card.locked ? showToast(TAX_FEATURE_LOCK_MESSAGE, 3200) : handleSendMessage(card.p)}
                            aria-disabled={card.locked || undefined}
                            style={{ display: 'flex', flexDirection: 'column', padding: 0, border: 0, borderRadius: '14px', background: '#0B0E14', overflow: 'hidden', textAlign: 'left', cursor: card.locked ? 'not-allowed' : 'pointer', opacity: card.locked ? 0.72 : 1, boxShadow: '0 4px 20px -2px rgba(0,0,0,0.4)' }}
                          >
                            <span style={{ position: 'relative', display: 'block', height: '140px', borderBottom: 0, overflow: 'hidden' }}>
                              {cardArt(card.kind, cat.dotColor, idx)}
                              <span style={{ position: 'absolute', top: '10px', left: '11px', zIndex: 2, whiteSpace: 'nowrap', fontSize: '9.5px', fontWeight: 500, letterSpacing: '0.02em', color: '#8A93A3', background: 'rgba(6,8,12,0.72)', border: 0, padding: '3px 8px', borderRadius: '999px' }}>
                                {card.locked ? 'Belum tersedia' : card.kindLabel}
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
                                <span>{card.locked ? 'Belum tersedia saat ini' : 'Jalankan sekarang'}</span>
                                {card.locked ? <Lock size={13} strokeWidth={1.7} /> : <ArrowRight size={14} strokeWidth={1.7} />}
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
                            <span style={{ display: 'flex', width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center', borderRadius: '9px', background: 'rgba(255,255,255,0.05)', border: 0, flexShrink: 0, marginTop: '2px', overflow: 'hidden' }}>
                              {/* 8 Sep malam (feedback Mecca: kayak Claude/ChatGPT/Gemini -- avatar
                                  logo produk, bukan ikon robot generik). Sama seperti logo layar
                                  kosong di file ini. */}
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/Logo-KLIR.png" alt="KLIR" width={16} height={16} style={{ display: 'block', objectFit: 'contain' }} />
                            </span>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: 'min(88%, 680px)', minWidth: 0 }}>
                              <div style={{ padding: '14px 16px', border: 0, borderRadius: '16px 16px 16px 2px', background: '#0B0E14', fontSize: '13px', lineHeight: 1.6, color: '#C6CEDA', boxShadow: '0 4px 18px rgba(0,0,0,0.35)' }}>
                                <RichMessage content={msg.text} accent="finance" />
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
                                      {copiedId === msg.id ? <Check size={12} color="#3FBF8F" strokeWidth={1.7} /> : <Copy size={12} strokeWidth={1.7} />}
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
                                  openStudio/submitStudio. */}
                              {msg.nextActions && msg.nextActions.length > 0 && (
                                <NextActionsBar actions={msg.nextActions} accent="finance" onAction={handleNextAction} />
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', border: 0, borderRadius: '12px', background: 'rgba(0,88,190,0.08)', maxWidth: '520px', textAlign: 'left' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                    <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 700, color: '#F5F7FA' }}>
                                      {msg.actionCard.title}
                                    </h4>
                                    <span style={{ fontSize: '10.5px', fontWeight: 600, color: '#C9A66B', whiteSpace: 'nowrap' }}>
                                      Aksi finance
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
                                        : (msg.actionCard.actionLabel || 'Terapkan Aksi ke Kas Perusahaan')}
                                    </span>
                                  </button>
                                </div>
                              )}

                              {msg.realImage && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: 0, border: 0, borderRadius: '16px', background: '#0B0E14', overflow: 'hidden', maxWidth: '398px', boxShadow: '0 4px 18px rgba(0,0,0,0.4)' }}>
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
                                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', height: '34px', borderRadius: '9px', background: '#0058BE', color: '#FFFFFF', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}
                                    >
                                      <Download size={13} />
                                      <span>Buka / unduh gambar</span>
                                    </a>
                                  </div>
                                </div>
                              )}

                              {/* Studio Template & Notebook (additive) -- lihat komentar di dekat pluginItems */}
                              {(msg.studioMedia || msg.studioNotebook || msg.studioSubmission) && <StudioResult
                                message={{ media: msg.studioMedia, notebook: msg.studioNotebook, submission: msg.studioSubmission, pending: msg.studioPending, failed: msg.studioFailed, draftScript: msg.studioDraftScript } as StudioMessage}
                                onRetry={submission => { void submitStudio(submission, currentChat.id).catch(err => showToast(err instanceof Error ? err.message : 'Permintaan gagal.')); }}
                              />}

                              {msg.realFile && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: 0, borderRadius: '14px', background: '#0B0E14', maxWidth: '398px', boxShadow: '0 4px 18px rgba(0,0,0,0.35)' }}>
                                  <span style={{ display: 'flex', width: '36px', height: '36px', flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: '10px', background: 'rgba(63,191,143,0.14)' }}>
                                    <FileCheck size={16} color="#3FBF8F" />
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#F5F7FA', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.realFile.fileName}</div>
                                    <div style={{ fontSize: '10.5px', color: '#5C6474' }}>File asli, siap dibuka</div>
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

                              {msg.simulation && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '14px', border: 0, borderRadius: '12px', background: 'rgba(78,155,255,0.06)', maxWidth: '560px', textAlign: 'left', boxShadow: '0 4px 18px rgba(0,0,0,0.35)' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                                    <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 700, color: '#F5F7FA' }}>
                                      {msg.simulation.scenarioTitle}
                                    </h4>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: SIM_RISK_STYLE[msg.simulation.riskLevel]?.bg, border: 0, color: SIM_RISK_STYLE[msg.simulation.riskLevel]?.color }}>
                                      {SIM_RISK_STYLE[msg.simulation.riskLevel]?.label || msg.simulation.riskLevel}
                                    </span>
                                  </div>

                                  <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: '#C3CBD8' }}>{msg.simulation.summary}</p>

                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '9px' }}>
                                    <div style={{ padding: '9px 11px', background: '#10141C', border: 0, borderRadius: '9px' }}>
                                      <div style={{ fontSize: '10px', color: '#8A93A3', marginBottom: '3px' }}>Runway sebelum</div>
                                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>{msg.simulation.baselineRunwayMonths} bulan</div>
                                    </div>
                                    <div style={{ padding: '9px 11px', background: '#10141C', border: 0, borderRadius: '9px' }}>
                                      <div style={{ fontSize: '10px', color: '#8A93A3', marginBottom: '3px' }}>Runway setelah</div>
                                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600, color: msg.simulation.runwayDeltaMonths < 0 ? '#EF4444' : '#3FBF8F' }}>
                                        {msg.simulation.simulatedRunwayMonths} bulan ({msg.simulation.runwayDeltaMonths >= 0 ? '+' : ''}{msg.simulation.runwayDeltaMonths})
                                      </div>
                                    </div>
                                    <div style={{ padding: '9px 11px', background: '#10141C', border: 0, borderRadius: '9px' }}>
                                      <div style={{ fontSize: '10px', color: '#8A93A3', marginBottom: '3px' }}>Titik impas</div>
                                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>
                                        {msg.simulation.breakEvenMonthEstimated ? `Bulan ke-${msg.simulation.breakEvenMonthEstimated}` : '—'}
                                      </div>
                                    </div>
                                    <div style={{ padding: '9px 11px', background: '#10141C', border: 0, borderRadius: '9px' }}>
                                      <div style={{ fontSize: '10px', color: '#8A93A3', marginBottom: '3px' }}>Kas habis diproyeksi</div>
                                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 600, color: msg.simulation.cashOutDateProjected ? '#EF4444' : '#F5F7FA' }}>
                                        {msg.simulation.cashOutDateProjected || 'Tidak diproyeksi'}
                                      </div>
                                    </div>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', height: '46px' }}>
                                    {msg.simulation.monthlyProjections.map((mo, i) => {
                                      const maxCash = Math.max(...msg.simulation!.monthlyProjections.map((p) => p.projectedCash), 1);
                                      const pct = Math.max(4, (mo.projectedCash / maxCash) * 100);
                                      return (
                                        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                          <span
                                            title={`${mo.monthName}: kas Rp ${mo.projectedCash.toLocaleString('id-ID')}`}
                                            style={{ width: '100%', height: `${pct}%`, borderRadius: '2px', background: mo.projectedCash <= 0 ? '#EF4444' : '#4E9BFF' }}
                                          />
                                          <span style={{ fontSize: '8px', color: '#5C6474' }}>{mo.monthName.split(' ')[0]}</span>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <p style={{ margin: 0, fontSize: '11.5px', lineHeight: 1.55, color: '#DCE3EC' }}>{msg.simulation.strategicVerdict}</p>

                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {msg.simulation.actionableSteps.map((step, i) => (
                                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <span style={{ width: '4px', height: '4px', borderRadius: '99px', background: '#4E9BFF', flexShrink: 0, marginTop: '6px' }} />
                                        <span style={{ fontSize: '11px', lineHeight: 1.5, color: '#C3CBD8' }}>{step}</span>
                                      </div>
                                    ))}
                                  </div>
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
                                  <FileSpreadsheet size={14} color="#3FBF8F" />
                                  <span style={{ fontWeight: 600 }}>{msg.attachment.name}</span>
                                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '9.5px', color: '#5C6474' }}>
                                    {msg.attachment.size}
                                  </span>
                                </span>
                              )}
                              <div style={{ padding: '12px 16px', borderRadius: '16px 16px 16px 2px', background: '#0058BE', fontSize: '13px', lineHeight: 1.55, color: '#FFFFFF', textAlign: 'left', boxShadow: '0 4px 16px rgba(0,88,190,0.3)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', width: 'fit-content', padding: '8px 12px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.06)', fontSize: '12px', color: '#8A93A3' }}>
                      <RefreshCw size={13} color="#4E9BFF" className="animate-spin" />
                      <span>KLIR Finance AI sedang menganalisis pembukuan...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Composer */}
              <div style={{ flexShrink: 0, padding: '12px 20px 16px' }}>
                <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
                  {/* FIX (konsolidasi zona tombol AI, 7 Sep -- putaran 2): dropdown "Plugin"
                      dihapus juga di sini -- lihat komentar identik di Composer Box
                      (welcome-view) untuk alasan lengkap. */}

                  {attachedFile && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px', padding: '5px 10px', border: 0, borderRadius: '999px', background: 'rgba(255,255,255,0.06)', fontSize: '11.5px', color: '#F5F7FA' }}>
                      <FileSpreadsheet size={14} color="#3FBF8F" />
                      <span>{attachedFile.name}</span>
                      <span style={{ fontSize: '11px', color: '#5C6474' }}>({attachedFile.size})</span>
                      <button
                        type="button"
                        onClick={() => setAttachedFile(null)}
                        style={{ display: 'flex', border: 0, background: 'transparent', color: '#5C6474', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendMessage();
                    }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', border: 0, borderRadius: '16px', background: '#0B0E14', boxShadow: '0 6px 20px rgba(0,0,0,0.5)' }}
                  >
                    <textarea
                      ref={composerTextareaRef}
                      rows={1}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => { if (composerToolbarRef.current?.handleSlashKeyDown(e)) { e.preventDefault(); return; } if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if ((inputMessage.trim() || attachedFile) && !isTyping) void handleSendMessage(); } }}
                      placeholder="Tanya soal arus kas, laba rugi, invoice, HPP, atau beri instruksi untuk Dashboard..."
                      style={{ display: 'block', width: '100%', minHeight: '24px', maxHeight: '200px', overflowY: 'auto', resize: 'none', border: 0, outline: 'none', background: 'transparent', padding: '4px 2px', fontFamily: "'Outfit', sans-serif", fontSize: '14px', lineHeight: 1.45, color: '#F5F7FA' }}
                    />
                    <ComposerToolbar
                      prefs={composerPrefs}
                      onPrefsChange={handleComposerPrefsChange}
                      onSend={handleComposerSend}
                      onMicTranscript={handleComposerMicTranscript}
                      onSlashSelect={handleComposerSlashSelect}
                      inputValue={inputMessage}
                      disabled={isTyping}
                      allowVideo={false}
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
      </div>

      {/* ========================================================================= */}
      {/* MODAL: Studio Template Dokumen & Notebook (additive) -- lihat komentar di
          dekat pluginItems untuk penjelasan lengkap + cara membatalkan. */}
      {/* ========================================================================= */}
      {mediaPanel && <MediaStudio
        key={mediaPanel.id}
        kind={mediaPanel.kind}
        initialText={mediaPanel.text}
        sourceText={mediaPanel.source}
        initialStudioMode={mediaPanel.mode}
        role="finance"
        allowVideo={false}
        brand={{ workspaceName: workspaceName || 'Workspace', hasLogo: false }}
        onClose={() => setMediaPanel(null)}
        onSubmit={async submission => {
          await submitStudio(submission, mediaPanel.chatId);
          if (activeChatId === mediaPanel.chatId) setInputMessage(current => current === mediaPanel.text ? '' : current);
        }}
        onTranscript={text => { setMediaPanel(null); void handleSendMessage(text); }}
      />}

      {/* ========================================================================= */}
      {/* MODAL: Pengaturan Divisi Finance */}
      {/* ========================================================================= */}
      <FinanceSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        initialTab={settingsInitialTab}
      />

      {/* ========================================================================= */}
      {/* MODAL: File Hasil AI -- paritas mockup v6 (seedFiles(), role-invariant,
          4 file). Sebelumnya tombol ini tidak ada sama sekali di sidebar Finance. */}
      {dataHubOpen && (
        <WorkspaceDataHub
          workspaceId={workspaceId}
          portal="FINANCE"
          onClose={() => setDataHubOpen(false)}
          onAskAI={(prompt) => setInputMessage(prompt)}
        />
      )}

      {storagePickerOpen && (
        <StorageFilePickerModal
          isOpen={true}
          workspaceId={workspaceId}
          portalRole="FINANCE"
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
                <span style={{ fontSize: '11.5px', color: '#5C6474' }}>
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
                    const size = f.sizeBytes === null ? 'Ukuran tidak diketahui' : f.sizeBytes < 1024 ? `${f.sizeBytes} B` : `${(f.sizeBytes / 1024).toFixed(1)} KB`;
                    return (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 12px', border: 0, borderRadius: '13px', background: 'rgba(255,255,255,0.02)' }}>
                        {fileBadge(f.name, 38)}
                        <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0, flex: 1 }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5C6474' }}>
                            <span>{kind.label}</span>
                            <span>&middot;</span>
                            <span>{relTime(f.createdAt)}</span>
                            <span>&middot;</span>
                            <span>{size}</span>
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => f.downloadFn()}
                          title="Unduh ulang"
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
                  <span style={{ fontSize: '11.5px', color: '#8A93A3', textAlign: 'center' }}>Minta AI membuat dokumen, spreadsheet, atau presentasi. Hasilnya tersimpan di sini.</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '12px 18px', borderTop: 0, flexShrink: 0 }}>
              <span style={{ fontSize: '11px', color: '#5C6474' }}>File tetap tersimpan meskipun percakapan ditutup.</span>
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
      {/* MODAL: Generator Invoice Formal -- FIX FIN-01 (8 Sep 2026). Mini-form wajib
          isi nama klien + nominal SEBELUM dikirim ke chat, supaya pesan yang terkirim
          genuinely memicu ekstraksi CREATE_INVOICE di brain/chat/route.ts (butuh
          invoice.clientName & invoice.amount), bukan cuma obrolan generik. */}
      {/* ========================================================================= */}
      {invoiceFormOpen && (
        <div
          onClick={() => setInvoiceFormOpen(false)}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px', background: 'rgba(4,6,10,0.74)', zIndex: 60 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '440px', border: '1px solid rgba(255,255,255,0.11)', borderRadius: '18px', background: '#0B0E14', boxShadow: '0 30px 80px rgba(0,0,0,0.62)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '16px 18px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>Generator Invoice Formal</span>
                <span style={{ fontSize: '11.5px', color: '#5C6474' }}>Isi nama klien &amp; nominal supaya invoice benar-benar diterbitkan ke database.</span>
              </span>
              <button
                type="button"
                onClick={() => setInvoiceFormOpen(false)}
                title="Tutup"
                style={{ display: 'flex', flexShrink: 0, padding: '5px', border: 0, borderRadius: '8px', background: 'transparent', color: '#8A93A3', cursor: 'pointer' }}
              >
                <X size={16} strokeWidth={1.9} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 18px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#C6CEDA' }}>Nama klien / perusahaan *</span>
                <input
                  type="text"
                  value={invoiceFormClient}
                  onChange={(e) => setInvoiceFormClient(e.target.value)}
                  placeholder="Contoh: PT Maju Bersama Sejahtera"
                  style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '13px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#C6CEDA' }}>Nominal tagihan (Rp) *</span>
                <input
                  type="number"
                  min="1"
                  value={invoiceFormAmount}
                  onChange={(e) => setInvoiceFormAmount(e.target.value)}
                  placeholder="Contoh: 5000000"
                  style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '13px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#C6CEDA' }}>Rincian layanan/item (opsional)</span>
                <input
                  type="text"
                  value={invoiceFormItem}
                  onChange={(e) => setInvoiceFormItem(e.target.value)}
                  placeholder="Contoh: Jasa konsultasi bulan September"
                  style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '13px' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#C6CEDA' }}>Jatuh tempo (hari dari sekarang)</span>
                <input
                  type="number"
                  min="1"
                  value={invoiceFormDueDays}
                  onChange={(e) => setInvoiceFormDueDays(e.target.value)}
                  style={{ padding: '10px 12px', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: '#F5F7FA', fontFamily: "'Outfit', sans-serif", fontSize: '13px' }}
                />
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button
                type="button"
                onClick={() => setInvoiceFormOpen(false)}
                style={{ padding: '9px 16px', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '11px', background: 'transparent', color: '#C6CEDA', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const clientName = invoiceFormClient.trim();
                  const amountNum = Number(invoiceFormAmount);
                  if (!clientName) { showToast('Nama klien wajib diisi.', 3200); return; }
                  if (!amountNum || amountNum <= 0) { showToast('Nominal tagihan wajib diisi angka lebih dari 0.', 3200); return; }
                  const dueDaysNum = Number(invoiceFormDueDays) || 14;
                  const itemText = invoiceFormItem.trim();
                  const composed = `Buatkan invoice formal untuk klien ${clientName} sebesar Rp${amountNum.toLocaleString('id-ID')}` +
                    (itemText ? ` untuk rincian layanan: ${itemText}` : '') +
                    `, jatuh tempo ${dueDaysNum} hari dari sekarang. Sertakan no faktur dan bank tujuan.`;
                  setInvoiceFormOpen(false);
                  setInvoiceFormClient('');
                  setInvoiceFormAmount('');
                  setInvoiceFormItem('');
                  setInvoiceFormDueDays('14');
                  handleSendMessage(composed);
                }}
                style={{ padding: '9px 18px', border: 0, borderRadius: '11px', background: '#0058BE', color: '#FFFFFF', fontFamily: "'Outfit', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Terbitkan Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Pengaturan Admin -- akses per-divisi, IDENTIK dengan
          ExecutiveAIAssistantView.tsx (mockup v6 tidak menggate panel ini per role;
          tabelnya sendiri selalu menampilkan ketiga divisi Eksekutif/Finance/Marketing). */}
      {/* ========================================================================= */}
      {adminOpen && (
        <div
          onClick={() => setAdminOpen(false)}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '26px', background: 'rgba(4,6,10,0.74)', zIndex: 60 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '760px', maxHeight: '100%', border: 0, borderRadius: '18px', background: '#0B0E14', boxShadow: '0 30px 80px rgba(0,0,0,0.8)', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', padding: '16px 18px 14px', borderBottom: 0, flexShrink: 0 }}>
              <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: '15px', fontWeight: 600, color: '#F5F7FA' }}>Pengaturan Admin — Hak Akses Divisi</span>
                <span style={{ fontSize: '11.5px', color: '#5C6474' }}>Kontrol kemampuan mana yang aktif untuk tiap divisi.</span>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '4px', padding: '3px', border: 0, borderRadius: '11px', background: 'rgba(255,255,255,0.02)' }}>
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
                  ? 'Semua kemampuan terbuka untuk semua divisi — konfigurasi di bawah nonaktif sementara.'
                  : 'Admin mengatur kemampuan tiap divisi lewat tombol di bawah.'}
              </span>
            </div>

            <div style={{ padding: '10px 18px', borderBottom: 0, background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
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
                  style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px 64px 64px', alignItems: 'center', gap: '10px', padding: '9px 4px', borderTop: 0 }}
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
                          title={disabled ? 'Nonaktif selama mode "Uji coba publik" — semua kemampuan terbuka' : on ? 'Klik untuk matikan untuk divisi ini' : 'Klik untuk nyalakan untuk divisi ini'}
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
  );
}
