'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  RefreshCw,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  Database,
  Sliders,
  Check,
  Copy,
  Clock,
  FileText,
  User,
  X,
  Play,
  Plus,
  PlusCircle,
  CornerDownLeft,
  DollarSign,
  Users,
  PanelLeftClose,
  PanelLeft,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  History,
  Briefcase,
  ShieldCheck,
  Paperclip,
  Globe,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  Share2,
  FileSpreadsheet,
  Search,
  BookOpen,
  Code,
  Lightbulb,
} from 'lucide-react';

interface ExecutiveAIAssistantViewProps {
  workspaceName?: string;
  userName?: string;
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  attachment?: {
    name: string;
    size: string;
    type: string;
  };
  actionCard?: {
    type: 'SCALE_ADS' | 'HIRE_STAFF' | 'RESOLVE_INVOICE' | 'WEEKLY_REC' | 'GENERAL';
    title: string;
    description: string;
    actionLabel?: string;
    impactText?: string;
    executed?: boolean;
  };
}

// Clean inline style parser for bold, italic, code, HTML tags, and linebreaks
function renderInlineStyles(text: string) {
  if (!text) return null;

  // Handle <br> or <br/> tags by splitting into sub-lines
  const brParts = text.split(/<br\s*\/?>/gi);

  return (
    <>
      {brParts.map((subText, brIdx) => {
        // Parse bold, italic, code, and bold tags
        const parts = subText.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|<b>.*?<\/b>|<i>.*?<\/i>)/g);

        return (
          <React.Fragment key={brIdx}>
            {brIdx > 0 && <br className="my-1" />}
            {parts.map((part, i) => {
              if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
                return (
                  <strong key={i} className="font-bold text-white">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (part.startsWith('<b>') && part.endsWith('</b>') && part.length >= 7) {
                return (
                  <strong key={i} className="font-bold text-white">
                    {part.slice(3, -4)}
                  </strong>
                );
              }
              if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
                return (
                  <span key={i} className="italic text-[#C7D2FE]">
                    {part.slice(1, -1)}
                  </span>
                );
              }
              if (part.startsWith('<i>') && part.endsWith('</i>') && part.length >= 7) {
                return (
                  <span key={i} className="italic text-[#C7D2FE]">
                    {part.slice(3, -4)}
                  </span>
                );
              }
              if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
                return (
                  <code key={i} className="px-1.5 py-0.5 bg-white/10 text-[#A5B4FC] rounded text-[11px] font-mono">
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return part;
            })}
          </React.Fragment>
        );
      })}
    </>
  );
}

// Clean formatted markdown message renderer (Supports Tables, Bullet Lists, Blockquotes, and Headings)
function FormattedMessageText({ content, isAI }: { content: string; isAI: boolean }) {
  if (!content) return null;

  const rawLines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={`space-${i}`} className="h-1.5" />);
      i++;
      continue;
    }

    // 1. Horizontal Rule (--- or ***) -> Clean spacing without lines
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      elements.push(<div key={`hr-${i}`} className="h-2" />);
      i++;
      continue;
    }

    // 2. Markdown Table Detection (| col1 | col2 |)
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      const tableRows: string[] = [];
      while (i < rawLines.length && rawLines[i].trim().startsWith('|') && rawLines[i].trim().endsWith('|')) {
        const rowTrimmed = rawLines[i].trim();
        // Skip separator row (|---|---|)
        if (!/^\|(\s*[-:]+\s*\|)+$/.test(rowTrimmed)) {
          tableRows.push(rowTrimmed);
        }
        i++;
      }

      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(1);

        const parseCells = (r: string) =>
          r
            .split('|')
            .slice(1, -1)
            .map((c) => c.trim());

        const headers = parseCells(headerRow);

        elements.push(
          <div key={`table-${i}`} className="my-3 overflow-x-auto rounded-xl border border-white/10 shadow-lg">
            <table className="w-full text-left text-xs border-collapse bg-[#0E121A]">
              <thead>
                <tr className="bg-[#181E2B] border-b border-white/10 text-white font-bold">
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="p-3 text-white font-heading font-bold uppercase tracking-wider text-[11px]">
                      {renderInlineStyles(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bodyRows.map((bRow, rIdx) => {
                  const cells = parseCells(bRow);
                  return (
                    <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-[#141820]/60' : 'bg-[#0E121A]'}>
                      {cells.map((cell, cIdx) => (
                        <td key={cIdx} className="p-3 text-[#D6E8FF] align-top leading-relaxed">
                          {renderInlineStyles(cell)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
        continue;
      }
    }

    // 3. Headings (### or ## or #)
    if (trimmed.startsWith('#')) {
      const headingText = trimmed.replace(/^#+\s*/, '');
      elements.push(
        <div
          key={`h-${i}`}
          className="font-heading font-extrabold text-white text-xs sm:text-sm pt-2 pb-0.5 flex items-center gap-1.5"
        >
          {renderInlineStyles(headingText)}
        </div>
      );
      i++;
      continue;
    }

    // 4. Blockquote (> text)
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <div
          key={`quote-${i}`}
          className="p-2.5 my-1.5 bg-white/5 border-l-2 border-[#6366F1] rounded-r-xl text-[#E0E7FF] text-xs italic"
        >
          {renderInlineStyles(quoteText)}
        </div>
      );
      i++;
      continue;
    }

    // 5. Bullet List (- text or * text or • text)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      const listText = trimmed.replace(/^[-*•]\s*/, '');
      elements.push(
        <div key={`bullet-${i}`} className="flex items-start gap-2 pl-1 py-0.5 text-xs sm:text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#818CF8] mt-1.5 shrink-0" />
          <div className="flex-1 text-[#E0E7FF]">{renderInlineStyles(listText)}</div>
        </div>
      );
      i++;
      continue;
    }

    // 6. Numbered List (e.g. 1. text)
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      elements.push(
        <div key={`num-${i}`} className="flex items-start gap-2 pl-1 py-0.5 text-xs sm:text-sm">
          <span className="font-mono font-bold text-[#818CF8] text-[11px] shrink-0 min-w-[14px]">
            {numMatch[1]}.
          </span>
          <div className="flex-1 text-[#E0E7FF]">{renderInlineStyles(numMatch[2])}</div>
        </div>
      );
      i++;
      continue;
    }

    // Regular Paragraph
    elements.push(
      <div key={`p-${i}`} className="leading-relaxed text-[#E0E7FF]">
        {renderInlineStyles(line)}
      </div>
    );
    i++;
  }

  return <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">{elements}</div>;
}

export default function ExecutiveAIAssistantView({
  workspaceName = 'Anitech Workspace',
  userName = 'Nime Nimasi',
}: ExecutiveAIAssistantViewProps) {
  // Collapsible Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Model Selector
  const [selectedModel, setSelectedModel] = useState<'fast' | 'deep' | 'opencode' | 'executive'>('opencode');

  // Chat State
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ name: string; size: string; content?: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'ai',
      text: `Halo Pak **${userName}**! Saya adalah **KLIR Executive AI Assistant**.\n\nSaya memiliki akses membaca langsung **seluruh data riil perusahaan Anda** (Keuangan & Kas, Metrik Pemasaran/Iklan, Beban Tim/SDM, serta Piutang Klien).\n\nAnda dapat menanyakan analisis data, meminta draf penulisan bisnis, mengunggah dokumen data/CSV untuk dibaca, atau memberikan instruksi langsung ke sistem. Ada yang bisa saya bantu?`,
      timestamp: 'Hari ini 08:30',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Dispatch state updates directly to CompanyDataDashboard
  const applyDirectiveToDashboard = (directive: {
    type: string;
    title: string;
    impact: string;
    statePatch?: any;
  }) => {
    try {
      const saved = localStorage.getItem('klir_live_company_state');
      let currentState = saved ? JSON.parse(saved) : {};

      const existingDirectives = currentState.directives || [];
      const newDirective = {
        id: `dir-${Date.now()}`,
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

      setToastMsg(`Instruksi "${directive.title}" berhasil dieksekusi dan diperbarui di Dashboard Perusahaan.`);
      setTimeout(() => setToastMsg(null), 4000);
    } catch (e) {
      console.warn('Failed to dispatch state:', e);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    // Strip markdown formatting for clean clipboard copy
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/^#+\s*/gm, '')
      .replace(/^>\s*/gm, '');
    navigator.clipboard.writeText(cleanText);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setAttachedFile({
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          content: content || '',
        });
      };
      // Read text-based files directly
      if (file.type.includes('text') || file.name.match(/\.(txt|csv|json|md|log|tsv|js|ts|html|xml)$/i)) {
        reader.readAsText(file);
      } else {
        setAttachedFile({
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          content: `[Dokumen Terlampir: ${file.name} (${(file.size / 1024).toFixed(1)} KB) - Format binary/spreadsheet telah diindeks]`,
        });
      }
      setToastMsg(`Dokumen "${file.name}" siap dibaca dan dianalisis oleh AI.`);
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  // Handle Send Message
  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputMessage).trim();
    if (!textToSend && !attachedFile) return;

    const userText = textToSend || (attachedFile ? `Tolong analisis dan jelaskan isi file ini: ${attachedFile.name}` : '');
    const currentAttachment = attachedFile;
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: 'Baru saja',
      attachment: currentAttachment
        ? { name: currentAttachment.name, size: currentAttachment.size, type: 'document' }
        : undefined,
    };

    const aiMsgId = `ai-${Date.now()}`;
    const aiPlaceholder: ChatMessage = { id: aiMsgId, sender: 'ai', text: '', timestamp: 'Baru saja' };

    setMessages((prev) => [...prev, userMsg, aiPlaceholder]);
    setInputMessage('');
    setAttachedFile(null);
    setIsTyping(true);

    // Read current live state from localStorage
    let currentLiveState: any = null;
    try {
      const saved = localStorage.getItem('klir_live_company_state');
      if (saved) currentLiveState = JSON.parse(saved);
    } catch (e) {
      console.warn('Live state read error:', e);
    }

    try {
      const res = await fetch('/api/v1/brain/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          userName: userName || 'Nime Nimasi',
          workspaceName: workspaceName || 'Anitech Workspace',
          model: selectedModel,
          liveState: currentLiveState,
          attachment: currentAttachment,
          history: messages
            .filter((m) => m.text && m.text.trim())
            .slice(-8)
            .map((m) => ({
              role: m.sender === 'ai' ? 'assistant' : 'user',
              content: m.text,
            })),
        }),
      });

      let responseText = '';
      let responseActionCard: any = undefined;

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          responseText = json.data.text || '';
          responseActionCard = json.data.actionCard;
        }
      }

      if (!responseText) {
        responseText = `Saya siap membantu Anda memproses "${userText}". Sebagai AI Assistant ${workspaceName}, saya dapat menjawab pertanyaan umum bisnis, membuat dokumen/copywriting, serta mengeksekusi instruksi langsung ke Dashboard Perusahaan Anda.`;
      }

      // Smooth Typewriter Streaming Effect
      let currentLength = 0;
      const chunkSize = Math.max(3, Math.floor(responseText.length / 30));
      const interval = setInterval(() => {
        currentLength += chunkSize;
        if (currentLength >= responseText.length) {
          clearInterval(interval);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, text: responseText, actionCard: responseActionCard }
                : m
            )
          );
          setIsTyping(false);
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, text: responseText.slice(0, currentLength) }
                : m
            )
          );
        }
      }, 25);
    } catch (err: any) {
      const fallbackText = `Halo Pak ${userName}, saya telah menerima pertanyaan Anda: "${userText}". Saya siap membantu menganalisis strategi, menyusun dokumen penawaran/email, atau mengeksekusi instruksi operasional untuk ${workspaceName}.`;
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, text: fallbackText } : m))
      );
      setIsTyping(false);
    }
  };

  const handleCardExecution = (card: any) => {
    let patch: any = {};

    if (card.type === 'SCALE_ADS') {
      patch = {
        marketing: {
          blendedRoas: 3.5,
          attributedRevenue: 19900000,
          totalLeads: 310,
          cac: 43000,
          activeCampaignsCount: 5,
        },
        healthScore: {
          totalScore: 88,
          grade: 'EXCELLENT',
          breakdown: { finance: 95, growth: 100, operations: 35, strategy: 100 },
        },
      };
    } else if (card.type === 'HIRE_STAFF') {
      patch = {
        teamOps: {
          totalEmployees: 15,
          teamUtilizationPercent: 76,
          pendingTasksCount: 2,
          slaCompletionRate: 96,
          divisions: [
            { name: 'Engineering & Tech', members: 5, loadPercent: 78, status: 'NORMAL' },
            { name: 'Marketing & Creative', members: 5, loadPercent: 74, status: 'NORMAL' },
            { name: 'Sales & Business Dev', members: 3, loadPercent: 75, status: 'NORMAL' },
            { name: 'Finance & Operations', members: 2, loadPercent: 77, status: 'NORMAL' },
          ],
        },
        healthScore: {
          totalScore: 92,
          grade: 'EXCELLENT',
          breakdown: { finance: 95, growth: 100, operations: 75, strategy: 100 },
        },
      };
    } else if (card.type === 'RESOLVE_INVOICE') {
      patch = {
        financials: {
          netCashBalance: 44925000,
          revenue30d: 53675000,
          expense30d: 8750000,
          grossProfit: 44925000,
          grossMarginPercent: 83,
          netProfit: 41925000,
          netMarginPercent: 78.1,
          runwayMonths: 99,
        },
      };
    } else {
      patch = {
        healthScore: {
          totalScore: 90,
          grade: 'EXCELLENT',
          breakdown: { finance: 95, growth: 100, operations: 65, strategy: 100 },
        },
      };
    }

    applyDirectiveToDashboard({
      type: card.type,
      title: card.title,
      impact: card.impactText || card.description,
      statePatch: patch,
    });
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        sender: 'ai',
        text: `Percakapan baru dimulai. KLIR AI Assistant siap menjawab pertanyaan apa saja atau menjalankan instruksi strategis untuk ${workspaceName}.`,
        timestamp: 'Baru saja',
      },
    ]);
  };

  return (
    /* ========================================================================= */
    /* 🚀 UNIFIED 1-FRAME CONTAINER (CLEAN FORMATTED MARKDOWN RENDERING) */
    /* ========================================================================= */
    <div className="flex h-full w-full font-sans text-[#F5F7FA] bg-[#0E121A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* 1. SEAMLESS ATTACHED SIDEBAR */}
      {/* ========================================================================= */}
      <aside
        className={`bg-[#090C12] border-r border-white/10 flex flex-col justify-between overflow-hidden transition-all duration-300 ease-in-out shrink-0 ${
          isSidebarOpen ? 'w-64 sm:w-72 p-4' : 'w-0 p-0 border-r-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="space-y-4 overflow-y-auto min-h-0 pr-1">
          {/* Top Bar: Obrolan Baru + Pojok Tutup Button */}
          <div className="flex items-center gap-2 pb-1">
            <button
              type="button"
              onClick={handleNewChat}
              className="flex-1 py-2 px-3 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:brightness-110 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-between"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Obrolan Baru</span>
              </div>
              <span className="text-[9px] bg-black/30 px-1.5 py-0.5 rounded font-mono">Ctrl K</span>
            </button>

            {/* Single Toggle Button to Hide Sidebar placed at the corner */}
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#6366F1]/50 rounded-xl text-[#8A93A3] hover:text-white transition-all cursor-pointer shadow-xs flex items-center gap-1 text-[11px] shrink-0"
              title="Sembunyikan Menu Samping"
            >
              <PanelLeftClose className="w-3.5 h-3.5 text-[#818CF8]" />
              <span className="text-[10px]">Tutup</span>
            </button>
          </div>

          {/* AI Tools & General Capabilities */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-[#8A93A3] tracking-wider px-2 block">
              💡 Kemampuan & Tools AI
            </span>

            {[
              {
                label: 'Draf Email & Surat Kerjasama',
                prompt: 'Buatkan draf email penawaran kerjasama B2B profesional untuk calon klien enterprise',
                icon: FileText,
                color: 'text-[#818CF8]',
              },
              {
                label: 'Ide Konten & Copywriting Video',
                prompt: 'Berikan 3 ide konsep konten naskah video TikTok viral untuk produk teknologi kami',
                icon: Lightbulb,
                color: 'text-[#F59E0B]',
              },
              {
                label: 'Penjelasan Konsep Unit Economics',
                prompt: 'Jelaskan konsep unit economics CAC vs LTV dan rasio idealnya untuk bisnis kami',
                icon: BookOpen,
                color: 'text-[#3B82F6]',
              },
              {
                label: 'Unggah & Analisis Dokumen',
                prompt: 'upload_trigger',
                icon: Paperclip,
                color: 'text-[#10B981]',
              },
            ].map((tool, i) => {
              const Icon = tool.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    if (tool.prompt === 'upload_trigger') {
                      fileInputRef.current?.click();
                    } else {
                      handleSendMessage(tool.prompt);
                    }
                  }}
                  className="w-full p-2 hover:bg-white/5 rounded-xl text-left text-xs font-semibold text-[#D6E8FF] hover:text-white transition-all cursor-pointer flex items-center gap-2.5 group"
                >
                  <Icon className={`w-3.5 h-3.5 ${tool.color} group-hover:scale-110 transition-transform shrink-0`} />
                  <span className="truncate">{tool.label}</span>
                </button>
              );
            })}
          </div>

          {/* Group 2: Rekomendasi & Aksi Eksekutif */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] uppercase font-bold text-[#8A93A3] tracking-wider px-2 block">
              ⚡ Aksi Dashboard Perusahaan
            </span>

            {[
              {
                label: 'Scale Budget Iklan (+20%)',
                prompt: 'Scale budget iklan video TikTok 20% dan update ke dashboard',
                icon: TrendingUp,
                color: 'text-[#10B981]',
              },
              {
                label: 'Rekrut 1 Staf Video Editor',
                prompt: 'Rekrut 1 staf video editor tambahan untuk kurangi beban tim',
                icon: Users,
                color: 'text-[#3B82F6]',
              },
              {
                label: 'Tagih Invoice PT Sentosa',
                prompt: 'Kirim invoice reminder tagihan PT Sentosa Abadi',
                icon: AlertTriangle,
                color: 'text-[#EF4444]',
              },
              {
                label: 'Laporan Analisis Mingguan',
                prompt: 'Tampilkan laporan analisis strategis mingguan otomatis',
                icon: Calendar,
                color: 'text-[#818CF8]',
              },
            ].map((action, i) => {
              const Icon = action.icon;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(action.prompt)}
                  className="w-full p-2 hover:bg-white/5 rounded-xl text-left text-xs font-semibold text-[#D6E8FF] hover:text-white transition-all cursor-pointer flex items-center gap-2.5 group"
                >
                  <Icon className={`w-3.5 h-3.5 ${action.color} group-hover:scale-110 transition-transform shrink-0`} />
                  <span className="truncate">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Sidebar Info */}
        <div className="pt-3 text-[10px] text-[#64748B] flex items-center justify-between">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-[#10B981]" />
            <span>Open Intelligence & OS</span>
          </span>
          <span className="font-mono text-[9px] bg-white/5 px-1.5 py-0.5 rounded">v5.0</span>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. MAIN CHAT VIEWPORT */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-full bg-[#0E121A] overflow-hidden p-4 sm:p-5">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pb-2 mb-2 shrink-0">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#6366F1]/50 rounded-xl text-white transition-all cursor-pointer shadow-xs flex items-center gap-1.5 text-xs font-semibold"
                title="Tampilkan Menu Samping"
              >
                <PanelLeft className="w-4 h-4 text-[#818CF8]" />
                <span className="hidden sm:inline text-xs">Menu AI</span>
              </button>
            )}

            {/* Single Clean Title & Status Badge */}
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-extrabold text-sm sm:text-base text-white">
                KLIR AI Assistant
              </h2>
              <span className="flex items-center gap-1 text-[10px] text-[#10B981] font-mono font-bold bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span>Ready & Connected</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#8A93A3] hover:text-white transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Obrolan Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* Toast Notification */}
        {toastMsg && (
          <div className="p-3 mb-2.5 bg-[#10B981]/15 border border-[#10B981]/40 text-[#D1FAE5] rounded-xl text-xs flex items-center justify-between shadow-lg animate-fadeIn shrink-0">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              <span className="font-semibold">{toastMsg}</span>
            </div>
            <button onClick={() => setToastMsg(null)} className="text-[#8A93A3] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Conversation Messages Feed */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 text-xs sm:text-sm min-h-0">
          {messages.map((msg) => {
            const isAI = msg.sender === 'ai';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isAI ? 'justify-start' : 'justify-end'}`}
              >
                {isAI && (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6366F1] to-[#4F46E5] text-white flex items-center justify-center shrink-0 shadow-md mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className={`space-y-2 max-w-[85%] sm:max-w-[75%] ${isAI ? 'text-left' : 'text-right'}`}>
                  {/* Attachment badge if uploaded */}
                  {msg.attachment && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#141820] border border-white/15 rounded-xl text-xs text-white mb-1 shadow-sm">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#10B981]" />
                      <span className="font-bold">{msg.attachment.name}</span>
                      <span className="text-[10px] text-[#8A93A3]">({msg.attachment.size})</span>
                    </div>
                  )}

                  {/* Clean Rendered Bubble (No raw markdown symbols) */}
                  <div
                    className={`p-4 rounded-2xl shadow-md text-xs sm:text-sm ${
                      isAI
                        ? 'bg-[#141820] text-[#D6E8FF] border border-white/10'
                        : 'bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white'
                    }`}
                  >
                    <FormattedMessageText content={msg.text} isAI={isAI} />
                  </div>

                  {/* AI Response Tools Bar (Copy, Thumbs Up/Down) */}
                  {isAI && (
                    <div className="flex items-center gap-2 pt-0.5 text-[11px] text-[#8A93A3]">
                      <button
                        type="button"
                        onClick={() => handleCopyText(msg.text, msg.id)}
                        className="hover:text-white p-1 rounded hover:bg-white/5 transition-colors flex items-center gap-1 cursor-pointer"
                        title="Salin Teks Bersih"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-[#10B981]" />
                            <span className="text-[10px] text-[#10B981]">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span className="text-[10px]">Salin</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setToastMsg('Terima kasih atas tanggapan Anda!');
                          setTimeout(() => setToastMsg(null), 2000);
                        }}
                        className="hover:text-white p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                        title="Bagus"
                      >
                        <ThumbsUp className="w-3 h-3" />
                      </button>

                      <span className="text-[9px] text-[#64748B]">• {msg.timestamp}</span>
                    </div>
                  )}

                  {/* Embedded Interactive Action Card on AI messages */}
                  {msg.actionCard && (
                    <div className="p-3.5 bg-[#181E2B] border border-[#6366F1]/40 rounded-2xl space-y-2 text-left shadow-lg max-w-lg mt-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-md bg-[#6366F1]/20 text-[#818CF8]">
                            <Sparkles className="w-3 h-3" />
                          </span>
                          <h4 className="font-heading font-extrabold text-white text-xs">
                            {msg.actionCard.title}
                          </h4>
                        </div>
                        <span className="px-2 py-0.5 bg-[#6366F1]/20 text-[#A5B4FC] text-[9px] font-mono font-bold rounded">
                          Aksi Eksekutif
                        </span>
                      </div>

                      <p className="text-[11px] text-[#8A93A3] leading-relaxed">
                        {msg.actionCard.description}
                      </p>

                      {msg.actionCard.impactText && (
                        <div className="text-[10px] text-[#10B981] font-mono font-bold">
                          ⚡ Dampak: {msg.actionCard.impactText}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleCardExecution(msg.actionCard)}
                        className="w-full py-2 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:brightness-110 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md shadow-[#6366F1]/20 flex items-center justify-center gap-2"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        <span>{msg.actionCard.actionLabel || 'Terapkan & Update ke Dashboard'}</span>
                      </button>
                    </div>
                  )}

                  {!isAI && (
                    <span className="text-[9px] text-[#64748B] block">{msg.timestamp}</span>
                  )}
                </div>

                {!isAI && (
                  <div className="w-7 h-7 rounded-lg bg-white/10 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-[#8A93A3] p-2.5 bg-[#141820] border border-white/10 w-fit rounded-xl">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#818CF8]" />
              <span>KLIR AI sedang menyusun jawaban terbaik...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form Box with Attachment & Tools */}
        <div className="pt-2 shrink-0 space-y-2">
          {/* Active Attachment Chip */}
          {attachedFile && (
            <div className="flex items-center gap-2 p-2 bg-[#141820] border border-white/15 rounded-xl w-fit text-xs text-white">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#10B981]" />
              <span>{attachedFile.name}</span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="text-[#8A93A3] hover:text-white ml-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex items-center bg-[#141820] border border-white/15 focus-within:border-[#6366F1] rounded-2xl p-1.5 sm:p-2 shadow-xl transition-all gap-1.5"
          >
            {/* 📎 Attach Document Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#8A93A3] hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Unggah Dokumen / Data (PDF, Excel, Word)"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            {/* Input Field */}
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Tanya apa saja (email, ide konten, strategi, coding) atau beri instruksi untuk Dashboard..."
              className="flex-1 bg-transparent px-2 py-2 text-white text-xs sm:text-sm placeholder-[#8A93A3] focus:outline-none"
            />

            {/* Submit / Send Button */}
            <button
              type="submit"
              disabled={(!inputMessage.trim() && !attachedFile) || isTyping}
              className="p-2 sm:px-4 sm:py-2 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] text-white rounded-xl hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer shadow-md flex items-center gap-1.5 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs font-bold">Kirim</span>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
