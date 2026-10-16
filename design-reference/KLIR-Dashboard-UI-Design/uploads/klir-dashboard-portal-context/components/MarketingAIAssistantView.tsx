'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  RefreshCw,
  Image as ImageIcon,
  Video,
  Copy,
  Check,
  Rocket,
  Play,
  Pause,
  Download,
  Volume2,
  VolumeX,
  FileText,
  Paperclip,
  PanelLeft,
  PanelLeftClose,
  ChevronRight,
  ShieldCheck,
  Megaphone,
  Lightbulb,
  Zap,
  TrendingUp,
  Tag,
  BarChart3,
  X,
  CheckCircle2,
  Sliders,
  Eye,
} from 'lucide-react';

interface MarketingAIAssistantViewProps {
  workspaceName?: string;
  userName?: string;
  onDeployCampaign?: (campaign: any) => void;
}

interface MarketingChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  mediaType?: 'image' | 'video' | 'both' | 'none';
  imageAssetIdx?: 1 | 2;
  videoData?: {
    hook: string;
    body: string;
    cta: string;
    duration: string;
  };
  scriptData?: {
    hook: string;
    body: string;
    cta: string;
    hashtags: string;
  };
  actionCard?: {
    type: 'LAUNCH_ADS' | 'SCALE_BUDGET' | 'CREATE_PROMO';
    title: string;
    description: string;
    actionLabel?: string;
    impactText?: string;
    executed?: boolean;
  };
}

// Clean inline style parser
function renderInlineStyles(text: string) {
  if (!text) return null;
  const brParts = text.split(/<br\s*\/?>/gi);

  return (
    <>
      {brParts.map((subText, brIdx) => {
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

// Clean formatted markdown message renderer
function FormattedMarketingText({ content }: { content: string }) {
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

    // Headings
    if (trimmed.startsWith('#')) {
      const headingText = trimmed.replace(/^#+\s*/, '');
      elements.push(
        <div key={`h-${i}`} className="font-heading font-extrabold text-white text-xs sm:text-sm pt-2 pb-0.5 flex items-center gap-1.5">
          {renderInlineStyles(headingText)}
        </div>
      );
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <div key={`quote-${i}`} className="p-2.5 my-1.5 bg-white/5 border-l-2 border-[#6366F1] rounded-r-xl text-[#E0E7FF] text-xs italic">
          {renderInlineStyles(quoteText)}
        </div>
      );
      i++;
      continue;
    }

    // Bullet List
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

    // Numbered List
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

    // Paragraph
    elements.push(
      <div key={`p-${i}`} className="leading-relaxed text-[#E0E7FF]">
        {renderInlineStyles(line)}
      </div>
    );
    i++;
  }

  return <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">{elements}</div>;
}

export default function MarketingAIAssistantView({
  workspaceName = 'Anitech Workspace',
  userName = 'Nime Nimasi',
  onDeployCampaign,
}: MarketingAIAssistantViewProps) {
  // Collapsible Sidebar State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Chat State
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Active Video Player Controls per message
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState(25);
  const [activeScene, setActiveScene] = useState<1 | 2 | 3>(1);
  const [isMuted, setIsMuted] = useState(false);

  // Selected Image Variation Map
  const [imageVariations, setImageVariations] = useState<Record<string, 1 | 2>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initial Welcome Messages
  const [messages, setMessages] = useState<MarketingChatMessage[]>([
    {
      id: 'msg-welcome-mkt',
      sender: 'ai',
      text: `Halo Pak **${userName}**! Saya adalah **KLIR Marketing & Generative Creative AI Studio**.\n\nSaya dapat membuatkan **desain gambar poster iklan visual HD**, **video motion TikTok / Reels 9:16**, **naskah copywriting konversi tinggi**, dan langsung meluncurkannya ke kampanye iklan Meta atau TikTok dalam 1 klik.\n\nApa materi promosi atau strategi kampanye yang ingin kita buat hari ini?`,
      timestamp: 'Hari ini 08:30',
      mediaType: 'both',
      imageAssetIdx: 1,
      videoData: {
        hook: 'Stop buang-buang waktu rekonsiliasi kas manual tiap akhir bulan! 🤯',
        body: 'KLIR otomatis sinkronkan omset masuk, pantau ROAS iklan real-time, dan beri rekomendasi keputusan bisnis 10x lebih cepat.',
        cta: 'Klaim diskon 30% kode GROWTH30 sekarang di link bio! 🚀',
        duration: '28 detik',
      },
      scriptData: {
        hook: 'Stop buang-buang waktu rekonsiliasi kas manual tiap akhir bulan! 🤯',
        body: 'KLIR otomatis sinkronkan omset masuk, pantau ROAS iklan real-time, dan beri rekomendasi keputusan bisnis 10x lebih cepat.',
        cta: 'Gunakan kode GROWTH30 untuk diskon 30% hari ini. Coba gratis sekarang! 🚀',
        hashtags: '#MarketingAI #ScaleUpBisnis #KLIRGrowth #DigitalAds',
      },
      actionCard: {
        type: 'LAUNCH_ADS',
        title: 'Luncurkan Materi Iklan Ini ke Meta Ads & TikTok',
        description: 'Targetkan ke audiens pemilik bisnis & UMKM dengan budget Rp 300.000/hari.',
        impactText: 'Estimasi +140 Leads Baru / Minggu',
        actionLabel: '🚀 Luncurkan ke Dashboard Marketing',
      },
    },
  ]);

  // Video progress loop
  useEffect(() => {
    let interval: any;
    if (playingVideoId) {
      interval = setInterval(() => {
        setVideoProgress((prev) => {
          const next = prev >= 100 ? 0 : prev + 4;
          if (next < 33) setActiveScene(1);
          else if (next < 66) setActiveScene(2);
          else setActiveScene(3);
          return next;
        });
      }, 300);
    }
    return () => clearInterval(interval);
  }, [playingVideoId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle Send Message
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = (textToSend || inputMessage).trim();
    if (!rawText || isTyping) return;

    const userMsgId = `msg-u-${Date.now()}`;
    const newMsg: MarketingChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: rawText,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMessage('');
    setIsTyping(true);

    const lower = rawText.toLowerCase();
    const wantsImage = lower.includes('gambar') || lower.includes('poster') || lower.includes('banner') || lower.includes('visual') || lower.includes('desain');
    const wantsVideo = lower.includes('vidio') || lower.includes('video') || lower.includes('tiktok') || lower.includes('reels');
    const isPromoOrCreative = lower.includes('promo') || lower.includes('diskon') || lower.includes('iklan') || lower.includes('konten') || wantsImage || wantsVideo;

    try {
      // Call Backend Brain Chat API (Powered by Groq Ultra-Fast AI)
      const res = await fetch('/api/v1/brain/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: rawText,
          userName,
          workspaceName,
          model: 'fast',
          history: messages.slice(-4).map((m) => ({
            role: m.sender === 'ai' ? 'assistant' : 'user',
            content: m.text,
          })),
        }),
      });

      const data = await res.json();
      const aiResponseText = data?.data?.text || data?.reply || 'Materi promosi telah berhasil diproses secara otomatis.';

      const mediaType: 'image' | 'video' | 'both' | 'none' =
        wantsImage && wantsVideo
          ? 'both'
          : wantsImage
          ? 'image'
          : wantsVideo
          ? 'video'
          : isPromoOrCreative
          ? 'both'
          : 'none';

      const aiMsg: MarketingChatMessage = {
        id: `msg-ai-${Date.now()}`,
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        mediaType,
        imageAssetIdx: Math.random() > 0.5 ? 1 : 2,
        videoData:
          mediaType === 'video' || mediaType === 'both'
            ? {
                hook: `Rahasia scale-up bisnis lebih cepat: ${rawText.slice(0, 35)}... 🔥`,
                body: `Otomatisasi operasional dan finansial perusahaan Anda secara cerdas bersama KLIR. Hilangkan inefisiensi dan lipatgandakan profit harian.`,
                cta: `Daftar sekarang dan nikmati penawaran khusus hari ini! 🚀`,
                duration: '28 detik',
              }
            : undefined,
        scriptData: isPromoOrCreative
          ? {
              hook: `Rahasia scale-up bisnis lebih cepat: ${rawText.slice(0, 35)}... 🔥`,
              body: `Otomatisasi operasional dan finansial perusahaan Anda secara cerdas bersama KLIR. Hilangkan inefisiensi dan lipatgandakan profit harian.`,
              cta: `Daftar sekarang dan nikmati penawaran khusus diskon 30% hari ini! 🚀`,
              hashtags: `#MarketingAI #GrowthStrategy #AIBusiness #KLIR`,
            }
          : undefined,
        actionCard: isPromoOrCreative
          ? {
              type: 'LAUNCH_ADS',
              title: `Luncurkan Materi Ini ke Kampanye Live`,
              description: `Otomatis daftarkan materi visual & naskah ini ke antrean kampanye iklan aktif.`,
              impactText: 'Target ROAS: 3.8x',
              actionLabel: '🚀 Luncurkan ke Dashboard Marketing',
            }
          : undefined,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      console.warn('AI Marketing Error:', err);
      // Fallback
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-ai-${Date.now()}`,
          sender: 'ai',
          text: `Berikut adalah rancangan strategi pemasaran dan materi kreatif siap pakai untuk **${rawText}**:\n\n1. **Target Audiens**: Segmen B2B & Pemilik Bisnis Usaha Berkembang.\n2. **Kanal Utama**: Meta Ads (Instagram Feed 1:1) dan TikTok Video (9:16 Reels).\n3. **Rekomendasi Anggaran**: Alokasikan Rp 300.000/hari dengan target ROAS 3.8x.`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          mediaType: 'both',
          imageAssetIdx: 1,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // Handle Deploy Action Card to Live Dashboard
  const handleExecuteAction = (msgId: string, card: any) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.actionCard
          ? { ...m, actionCard: { ...m.actionCard, executed: true } }
          : m
      )
    );

    const newCamp = {
      id: `cmp-${Date.now()}`,
      name: `AI Creative — ${card.title}`,
      platform: 'Meta Ads',
      dailyBudget: 300000,
      spent: 0,
      roas: '3.8x (Target)',
      leads: 0,
      status: 'ACTIVE',
      creativeType: 'AI Multimodal Creative',
    };

    if (onDeployCampaign) {
      onDeployCampaign(newCamp);
    }

    setToastMsg(`🚀 Kampanye "${newCamp.name}" berhasil diluncurkan ke Dashboard Marketing!`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Handle Download Image
  const handleDownloadImage = (idx: 1 | 2) => {
    const imgUrl = idx === 1 ? '/marketing/ad_feed_1.jpg' : '/marketing/ad_feed_2.jpg';
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = `KLIR_AI_Marketing_Creative_${idx}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMsg('📥 Gambar visual HD berhasil diunduh.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Handle Copy Script
  const handleCopyScript = (script: any) => {
    const fullText = `HOOK:\n${script.hook}\n\nBODY:\n${script.body}\n\nCTA:\n${script.cta}\n\nHASHTAGS:\n${script.hashtags}`;
    navigator.clipboard.writeText(fullText);
    setToastMsg('📋 Teks naskah lengkap berhasil disalin.');
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleNewChat = () => {
    setMessages([
      {
        id: `msg-welcome-${Date.now()}`,
        sender: 'ai',
        text: `Studio AI Marketing baru dimulai. Tuliskan konsep produk, penawaran promo, atau minta AI membuatkan gambar poster dan video sekarang!`,
        timestamp: 'Baru saja',
      },
    ]);
  };

  return (
    <div className="flex h-full w-full font-sans text-[#F5F7FA] bg-[#0E121A] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative animate-fadeIn">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="absolute top-4 right-4 z-50 p-3.5 bg-[#10B981]/20 border border-[#10B981]/40 text-[#D1FAE5] rounded-xl text-xs flex items-center gap-2.5 shadow-2xl backdrop-blur-md animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span className="font-semibold">{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="text-[#8A93A3] hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ======================================================================= */}
      {/* 1. COLLAPSIBLE LEFT SIDEBAR (PRESETS & QUICK TOOLS) */}
      {/* ======================================================================= */}
      {isSidebarOpen && (
        <aside className="w-72 sm:w-80 bg-[#0A0D14] border-r border-white/[0.04] p-4 flex flex-col justify-between shrink-0 transition-all duration-300">
          <div className="space-y-4">
            {/* Top Brand & Collapse Button */}
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-white font-bold text-xs shadow-md">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-xs text-white">Marketing AI Studio</h3>
                  <span className="text-[10px] text-[#10B981] font-mono font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                    Groq Ultra-Fast Live
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-[#8A93A3] hover:text-white transition-all cursor-pointer"
                title="Tutup Menu Samping"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>

            {/* New Creative Session Button */}
            <button
              type="button"
              onClick={handleNewChat}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:brightness-110 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>+ Buat Materi Baru</span>
            </button>

            {/* Quick Action Prompt Tools in Sidebar */}
            <div className="space-y-1.5 pt-2">
              <span className="text-[10px] uppercase font-bold text-[#8A93A3] tracking-wider px-2 block">
                💡 Ide & Rekomendasi Prompt Cepat
              </span>

              {[
                {
                  label: 'Poster Iklan 3D Glassmorphism (Diskon 30%)',
                  prompt: 'Buatkan poster iklan visual 3D Glassmorphism bertema promo diskon 30% untuk software bisnis',
                  icon: ImageIcon,
                  color: 'text-[#818CF8]',
                },
                {
                  label: 'Video TikTok 9:16 Durasi 28 Detik',
                  prompt: 'Rancang video motion 9:16 durasi 28 detik lengkap dengan naskah hook 3 detik dan call to action',
                  icon: Video,
                  color: 'text-[#F59E0B]',
                },
                {
                  label: 'Copywriting Formula Hook & CTA',
                  prompt: 'Tuliskan naskah copywriting iklan dengan formula Hook, Problem, Solution, dan Call to Action',
                  icon: FileText,
                  color: 'text-[#3B82F6]',
                },
                {
                  label: 'Analisis & Audit ROAS Iklan 3.5x',
                  prompt: 'Analisis performa iklan kami saat ini dengan ROAS 3.5x dan berikan rekomendasi scaling',
                  icon: TrendingUp,
                  color: 'text-[#10B981]',
                },
                {
                  label: 'Buat Kode Voucher Promo Flash Sale',
                  prompt: 'Buatkan konsep program voucher diskon flash sale akhir pekan untuk menarik prospek baru',
                  icon: Tag,
                  color: 'text-[#EC4899]',
                },
              ].map((tool, i) => {
                const Icon = tool.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(tool.prompt)}
                    className="w-full p-2 hover:bg-white/5 rounded-xl text-left text-xs font-semibold text-[#D6E8FF] hover:text-white transition-all cursor-pointer flex items-center gap-2.5 group"
                  >
                    <Icon className={`w-3.5 h-3.5 ${tool.color} group-hover:scale-110 transition-transform shrink-0`} />
                    <span className="truncate">{tool.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Info */}
          <div className="pt-3 text-[10px] text-[#64748B] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#10B981]" />
              <span>Multi-Modal Generative Engine</span>
            </span>
            <span className="font-mono text-[9px] bg-white/5 px-1.5 py-0.5 rounded">v5.0</span>
          </div>
        </aside>
      )}

      {/* ======================================================================= */}
      {/* 2. MAIN CHAT & CREATIVE CANVAS VIEWPORT */}
      {/* ======================================================================= */}
      <main className="flex-1 flex flex-col h-full bg-[#0E121A] overflow-hidden p-4 sm:p-5">
        {/* Top Chat Header */}
        <div className="flex items-center justify-between pb-3 mb-2 shrink-0">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              >
                <PanelLeft className="w-4 h-4 text-[#818CF8]" />
                <span className="hidden sm:inline text-xs">Menu Studio</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <h2 className="font-heading font-extrabold text-sm sm:text-base text-white">
                Marketing AI Assistant & Studio
              </h2>
              <span className="flex items-center gap-1 text-[10px] text-[#10B981] font-mono font-bold bg-[#10B981]/15 px-2 py-0.5 rounded-full border border-[#10B981]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                <span>Creative Mode Active</span>
              </span>
            </div>
          </div>

          <div className="text-xs text-[#8A93A3] font-mono hidden sm:block">
            {workspaceName}
          </div>
        </div>

        {/* ===================================================================== */}
        {/* CHAT MESSAGES STREAM */}
        {/* ===================================================================== */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 sm:pr-2 pb-4">
          {messages.map((msg) => {
            const isAI = msg.sender === 'ai';
            const imgIdx = imageVariations[msg.id] || msg.imageAssetIdx || 1;

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isAI ? 'justify-start' : 'justify-end'} animate-fadeIn`}
              >
                {/* AI Avatar */}
                {isAI && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-white shrink-0 shadow-md">
                    <Sparkles className="w-4 h-4" />
                  </div>
                )}

                {/* Message Bubble Container */}
                <div
                  className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5 ${
                    isAI
                      ? 'bg-[#141820] border border-white/10 text-[#F5F7FA]'
                      : 'bg-gradient-to-r from-[#4F46E5] to-[#4338CA] text-white border border-white/15'
                  }`}
                >
                  {/* Sender & Timestamp */}
                  <div className="flex items-center justify-between text-[11px] opacity-70 pb-1">
                    <span className="font-bold">{isAI ? 'Marketing AI Brain' : userName}</span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Message Content */}
                  <FormattedMarketingText content={msg.text} />

                  {/* ============================================================= */}
                  {/* MULTIMODAL CANVAS: GENERATED IMAGE ASSET */}
                  {/* ============================================================= */}
                  {isAI && (msg.mediaType === 'image' || msg.mediaType === 'both') && (
                    <div className="mt-3 p-3 bg-[#0E121A] border border-white/10 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5 text-[#818CF8]" />
                          <span>AI Visual Ad Poster (1:1 Feed HD)</span>
                        </span>
                        <span className="px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] text-[10px] font-bold rounded-md">
                          1024x1024 Ready
                        </span>
                      </div>

                      {/* Image Frame */}
                      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black/50 max-h-[280px] flex items-center justify-center group">
                        <img
                          src={imgIdx === 1 ? '/marketing/ad_feed_1.jpg' : '/marketing/ad_feed_2.jpg'}
                          alt="Generated Ad Creative"
                          className="w-full h-full object-contain rounded-xl transition-transform duration-500 group-hover:scale-[1.02]"
                        />

                        {/* Top Badges */}
                        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                          <span className="px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-md text-[9px] font-bold text-white border border-white/10">
                            ⚡ AI Rendered
                          </span>
                          <span className="px-2 py-0.5 bg-[#10B981]/80 backdrop-blur-md text-white rounded-md text-[9px] font-bold">
                            Diskon 30%
                          </span>
                        </div>

                        {/* Download Button Overlay */}
                        <div className="absolute top-2.5 right-2.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadImage(imgIdx)}
                            className="px-2.5 py-1 bg-black/70 hover:bg-black/90 backdrop-blur-md text-white border border-white/20 rounded-lg text-[10px] font-semibold transition-all cursor-pointer flex items-center gap-1 shadow-lg"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download HD</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-[#8A93A3] pt-1">
                        <span>Gaya Visual: <strong>3D Glassmorphism & Dark Neon</strong></span>
                        <button
                          type="button"
                          onClick={() =>
                            setImageVariations((prev) => ({
                              ...prev,
                              [msg.id]: imgIdx === 1 ? 2 : 1,
                            }))
                          }
                          className="text-[#60A5FA] hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <span>Ganti Variasi Visual #{imgIdx === 1 ? '2' : '1'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ============================================================= */}
                  {/* MULTIMODAL CANVAS: GENERATED VIDEO MOTION (9:16) */}
                  {/* ============================================================= */}
                  {isAI && (msg.mediaType === 'video' || msg.mediaType === 'both') && msg.videoData && (
                    <div className="mt-3 p-3 bg-[#0E121A] border border-white/10 rounded-2xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                          <Video className="w-3.5 h-3.5 text-[#F59E0B]" />
                          <span>AI Video Motion Player (9:16 Reels / TikTok)</span>
                        </span>
                        <span className="px-2 py-0.5 bg-red-600/80 text-white text-[10px] font-bold rounded-md uppercase">
                          28s Motion Storyboard
                        </span>
                      </div>

                      {/* Video Player Frame */}
                      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-[#080B10] p-4 flex flex-col justify-between h-[260px]">
                        <div className="flex items-center justify-between z-10">
                          <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[9px] text-[#10B981] font-mono font-bold">
                            Scene {activeScene} / 3
                          </span>
                          <button
                            type="button"
                            onClick={() => setIsMuted(!isMuted)}
                            className="p-1 rounded bg-black/40 text-white hover:text-[#60A5FA]"
                          >
                            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                          </button>
                        </div>

                        {/* Center Animated Caption */}
                        <div className="flex flex-col items-center justify-center text-center space-y-2 z-10 px-3">
                          <button
                            type="button"
                            onClick={() =>
                              setPlayingVideoId(playingVideoId === msg.id ? null : msg.id)
                            }
                            className="w-10 h-10 rounded-full bg-[#6366F1] hover:bg-[#4F46E5] text-white flex items-center justify-center transition-all cursor-pointer shadow-lg shadow-[#6366F1]/40"
                          >
                            {playingVideoId === msg.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                          </button>

                          <div className="p-2.5 bg-black/85 backdrop-blur-md border border-white/10 rounded-xl max-w-[95%] shadow-xl">
                            <span className="text-[9px] font-mono font-bold text-[#10B981] uppercase block mb-0.5">
                              {activeScene === 1 ? '🔥 Hook Visual' : activeScene === 2 ? '💡 Solusi Produk' : '🚀 Call To Action'}
                            </span>
                            <p className="text-[11px] font-bold text-white leading-snug">
                              {activeScene === 1 ? msg.videoData.hook : activeScene === 2 ? msg.videoData.body : msg.videoData.cta}
                            </p>
                          </div>
                        </div>

                        {/* Bottom Scrubber */}
                        <div className="space-y-1 z-10">
                          <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[#6366F1] to-[#10B981] transition-all duration-300"
                              style={{ width: `${playingVideoId === msg.id ? videoProgress : 30}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Copywriting Script Box */}
                  {isAI && msg.scriptData && (
                    <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-[#60A5FA]" />
                          <span>Naskah Iklan Terstruktur</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyScript(msg.scriptData)}
                          className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Salin Naskah</span>
                        </button>
                      </div>

                      <p className="text-xs text-[#CBD5E1] leading-relaxed">
                        {msg.scriptData.body}
                      </p>
                    </div>
                  )}

                  {/* Action Card (Deploy to Dashboard) */}
                  {isAI && msg.actionCard && (
                    <div className="p-3.5 bg-gradient-to-r from-[#181E2B] to-[#141820] border border-[#10B981]/30 rounded-xl space-y-2 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white flex items-center gap-1.5">
                          <Rocket className="w-3.5 h-3.5 text-[#10B981]" />
                          <span>{msg.actionCard.title}</span>
                        </span>
                        <span className="px-2 py-0.5 bg-[#10B981]/15 text-[#10B981] text-[10px] font-mono font-bold rounded">
                          {msg.actionCard.impactText}
                        </span>
                      </div>

                      <p className="text-[11px] text-[#8A93A3] leading-relaxed">
                        {msg.actionCard.description}
                      </p>

                      <button
                        type="button"
                        onClick={() => handleExecuteAction(msg.id, msg.actionCard)}
                        disabled={msg.actionCard.executed}
                        className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 ${
                          msg.actionCard.executed
                            ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 cursor-default'
                            : 'bg-[#10B981] hover:bg-[#059669] text-white shadow-[#10B981]/20'
                        }`}
                      >
                        {msg.actionCard.executed ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#10B981]" />
                            <span>Telah Diluncurkan ke Dashboard</span>
                          </>
                        ) : (
                          <>
                            <Rocket className="w-3.5 h-3.5" />
                            <span>{msg.actionCard.actionLabel || 'Luncurkan Sekarang'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* User Avatar */}
                {!isAI && (
                  <div className="w-8 h-8 rounded-xl bg-[#0058BE] border border-[#00D2FF]/40 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
                    👑
                  </div>
                )}
              </div>
            );
          })}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-center gap-3 animate-fadeIn">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6366F1] to-[#4F46E5] flex items-center justify-center text-white shrink-0 shadow-md">
                <Sparkles className="w-4 h-4 animate-spin" />
              </div>
              <div className="bg-[#141820] border border-white/10 rounded-2xl px-4 py-3 text-xs text-[#CBD5E1] flex items-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#818CF8]" />
                <span>AI sedang merender gambar visual, video motion, dan copywriting...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ===================================================================== */}
        {/* BOTTOM PROMPT INPUT CONTAINER */}
        {/* ===================================================================== */}
        <div className="pt-2 shrink-0">
          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 bg-[#141820] border border-white/10 focus-within:border-[#6366F1] rounded-2xl p-2 shadow-xl transition-all"
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setToastMsg(`📁 File "${file.name}" siap dianalisis.`);
                  setTimeout(() => setToastMsg(null), 3000);
                }
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-[#8A93A3] hover:text-white hover:bg-white/5 rounded-xl transition-all cursor-pointer"
              title="Unggah Aset/Dokumen"
            >
              <Paperclip className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ketik ide promo, minta poster gambar, atau video TikTok di sini..."
              className="flex-1 bg-transparent border-none text-white text-xs sm:text-sm focus:outline-none placeholder-[#64748B] px-2"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim() || isTyping}
              className="p-2.5 bg-gradient-to-r from-[#6366F1] to-[#4F46E5] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl transition-all cursor-pointer shadow-md shadow-[#6366F1]/25 shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
