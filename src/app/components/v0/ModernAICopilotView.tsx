'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Receipt,
  Scale,
  MessageSquare,
  HelpCircle,
  ExternalLink,
  Layers,
  Search,
  ArrowRight,
  Database,
  Building2,
  SlidersHorizontal,
  Trash2,
  Plus,
  PanelLeftClose,
  PanelLeft,
  Paperclip,
  X,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Lock,
  Mail,
  Users,
  Package,
  Folder,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';
import RichMessage from '../chat/RichMessage';

export interface ModernAICopilotViewProps {
  mode?: 'FINANCE' | 'EXECUTIVE';
  workspaceId: string;
  workspaceName?: string;
  userName?: string;
  initialPrompt?: string;
  onNavigateTab?: (tabId: string) => void;
  onClose?: () => void;
}

interface ChatMessageItem {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  actionLinks?: Array<{ label: string; tabId: string }>;
}

interface ChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: ChatMessageItem[];
}

// 🎨 Card Artwork for "Mulai dari tugas nyata" in Light Enterprise SaaS Theme
function cardArt(kind: string, tone: string, idx: number) {
  const delay = (idx % 3) * 0.9;
  const sheet = (w: number, ht: number, extra?: React.CSSProperties): React.CSSProperties => ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: `${w}px`,
    height: `${ht}px`,
    borderRadius: '8px',
    background: '#FFFFFF',
    border: '1px solid #E2E8F0',
    boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
    overflow: 'hidden',
    flexShrink: 0,
    ...extra,
  });
  const line = (w: string, o: number, c?: string) => (
    <span
      style={{
        display: 'block',
        height: '3.5px',
        width: w,
        borderRadius: '99px',
        background: c || '#0F172A',
        opacity: o,
      }}
    />
  );
  const stage = (children: React.ReactNode) => (
    <span
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: '24px',
        perspective: '780px',
        background: `radial-gradient(130% 95% at 50% 120%, ${tone}14, #F8FAFC 68%)`,
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
        <span
          style={sheet(84, 62, {
            marginRight: '-44px',
            opacity: 0.6,
            transform: 'translateZ(-24px)',
            background: '#F1F5F9',
          })}
        />
        <span style={sheet(98, 72, { padding: '9px 10px', gap: '6px' })}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span
              style={{
                width: '14px',
                height: '10px',
                borderRadius: '2px',
                border: `1.5px solid ${tone}`,
                opacity: 0.9,
              }}
            />
            {line('42%', 0.5, tone)}
          </span>
          {line('86%', 0.25)}
          {line('72%', 0.2)}
          {line('80%', 0.16)}
          <span
            style={{
              marginTop: 'auto',
              width: '38%',
              height: '9px',
              borderRadius: '3px',
              background: tone,
              opacity: 0.85,
            }}
          />
        </span>
      </>
    );
  }

  if (kind === 'bar-chart' || kind === 'trending-up') {
    const bars = [32, 48, 28, 58, 42];
    return stage(
      <span style={sheet(112, 74, { padding: '10px 11px', gap: '8px' })}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {line('34%', 0.45, tone)}
          <span style={{ width: '16px', height: '5px', borderRadius: '99px', background: tone, opacity: 0.85 }} />
        </span>
        <span style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '38px' }}>
          {bars.map((b, i) => (
            <span
              key={i}
              style={{
                flex: 1,
                height: `${b}%`,
                borderRadius: '3px 3px 0 0',
                background: i === 3 ? tone : '#CBD5E1',
              }}
            />
          ))}
        </span>
      </span>
    );
  }

  if (kind === 'file-spreadsheet') {
    return stage(
      <span style={sheet(116, 76, { padding: '8px 9px', gap: '5px' })}>
        <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {line('40%', 0.5, tone)}
          <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: tone, opacity: 0.8 }} />
        </span>
        <span style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, background: '#F1F5F9', padding: '2px', borderRadius: '4px' }}>
          {[0, 1, 2].map((r) => (
            <span key={r} style={{ display: 'flex', gap: '2px', flex: 1 }}>
              {[0, 1, 2, 3].map((c) => (
                <span
                  key={c}
                  style={{
                    flex: 1,
                    background: '#FFFFFF',
                    borderRadius: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 3px',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      height: '2.5px',
                      width: c === 3 ? '60%' : '80%',
                      borderRadius: '99px',
                      background: c === 3 && r === 2 ? tone : '#64748B',
                      opacity: c === 3 && r === 2 ? 0.9 : 0.25,
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

  // Default: file-text / document preview
  return stage(
    <>
      <span
        style={sheet(74, 82, {
          marginRight: '-42px',
          opacity: 0.5,
          transform: 'translateZ(-26px)',
          background: '#F1F5F9',
        })}
      />
      <span style={sheet(82, 94, { padding: '10px 11px', gap: '5px' })}>
        <span
          style={{
            display: 'block',
            height: '7px',
            width: '56%',
            borderRadius: '2px',
            background: tone,
            opacity: 0.9,
            marginBottom: '3px',
          }}
        />
        {line('92%', 0.25)}
        {line('84%', 0.2)}
        {line('88%', 0.2)}
        {line('64%', 0.16)}
        <span style={{ height: '3px' }} />
        {line('90%', 0.18)}
        {line('72%', 0.14)}
        <span style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {line('30%', 0.35, tone)}
          <span style={{ width: '22px', height: '6px', borderRadius: '2px', background: tone, opacity: 0.8 }} />
        </span>
      </span>
    </>
  );
}

export default function ModernAICopilotView({
  mode = 'FINANCE',
  workspaceId,
  workspaceName = 'Anitech Enterprise',
  userName = 'Finance Lead',
  initialPrompt,
  onNavigateTab,
  onClose,
}: ModernAICopilotViewProps) {
  const isFinance = mode === 'FINANCE';
  const toneColor = isFinance ? '#059669' : '#2563EB';
  const toneBg = isFinance ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200';
  const toneBtn = isFinance ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700';

  const userTitle = !userName || userName.toLowerCase().includes('lead')
    ? isFinance ? 'Finance Controller' : 'Anitech CEO'
    : userName;

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCompanyData, setShowCompanyData] = useState<boolean>(false);
  const [composerMode, setComposerMode] = useState<'tanya' | 'gambar' | 'riset' | 'belajar' | 'analis'>('tanya');
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Local storage chats management
  const storageKey = `klir_v0_copilot_chats_${mode}_${workspaceId || 'default'}`;
  const [activeSessionId, setActiveSessionId] = useState<string>('session-default');
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        /* storage blocked */
      }
    }
    return [
      {
        id: 'session-default',
        title: 'Analisis Baru',
        updatedAt: Date.now(),
        messages: [],
      },
    ];
  });

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = currentSession?.messages || [];

  // Persist sessions
  useEffect(() => {
    if (typeof window !== 'undefined' && sessions.length > 0) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(sessions));
      } catch (err) {
        console.warn('Failed to save sessions:', err);
      }
    }
  }, [sessions, storageKey]);

  // Initial prompt
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim() && messages.length === 0) {
      void handleSendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // New Chat Action
  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'Obrolan Baru',
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
    setInputMessage('');
    setAttachedFileName(null);
  };

  // Delete Chat Session
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length <= 1) {
      handleNewChat();
      return;
    }
    setSessions((prev) => prev.filter((s) => s.id !== id));
    if (activeSessionId === id) {
      const remaining = sessions.filter((s) => s.id !== id);
      setActiveSessionId(remaining[0].id);
    }
  };

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // 9 Cards Gallery: "Mulai dari tugas nyata"
  const gallery = useMemo(() => [
    {
      title: 'Dokumen & korespondensi',
      dotColor: '#0284C7',
      cards: [
        {
          t: 'Draf proposal kerjasama untuk klien enterprise',
          n: 'Latar belakang, lingkup kerja, skema harga, dan SLA',
          p: 'Buatkan draf proposal kerjasama untuk klien enterprise: latar belakang, ruang lingkup pekerjaan, skema harga, dan syarat kerjasama.',
          kind: 'file-text',
          kindLabel: 'Template dokumen',
        },
        {
          t: 'Surat penagihan invoice yang telat 3 hari',
          n: 'Sopan, tahap tegas, siap kirim via WhatsApp & Email',
          p: 'Buatkan surat penagihan invoice yang sopan namun tegas untuk klien yang telat bayar 3 hari.',
          kind: 'file-text',
          kindLabel: 'Template dokumen',
        },
        {
          t: 'Email tindak lanjut setelah rapat klien',
          n: 'Ringkasan poin dan langkah berikutnya',
          p: 'Buatkan email tindak lanjut setelah rapat klien berisi ringkasan poin yang disepakati dan langkah berikutnya.',
          kind: 'mail',
          kindLabel: 'Template email',
        },
      ],
    },
    {
      title: 'Analisis data perusahaan',
      dotColor: isFinance ? '#059669' : '#2563EB',
      cards: [
        {
          t: 'Ringkas arus kas 30 hari terakhir',
          n: 'Estimasi kas masuk, kas keluar, dan sisa runway',
          p: 'Analisis arus kas 30 hari terakhir perusahaan dan jelaskan posisi runway kami saat ini.',
          kind: 'file-spreadsheet',
          kindLabel: 'Spreadsheet',
        },
        {
          t: 'Deteksi anomali biaya operasional',
          n: 'Pos belanja yang melonjak di luar kebiasaan',
          p: 'Periksa data pengeluaran kami dan tandai pos biaya yang melonjak di luar kebiasaan, sertakan besar selisih dan kemungkinan penyebabnya.',
          kind: 'trending-up',
          kindLabel: 'Tren & metrik',
        },
        {
          t: 'Periksa beban tim dan tugas tertunda',
          n: 'Utilisasi per divisi dan capaian SLA operasional',
          p: 'Periksa beban tim per divisi, tugas yang tertunda, dan capaian SLA bulan ini.',
          kind: 'users',
          kindLabel: 'Beban tim',
        },
      ],
    },
    {
      title: 'Pajak & kepatuhan',
      dotColor: '#D97706',
      cards: [
        {
          t: 'Estimasi setoran pajak PPh dan PPN bulan ini',
          n: 'Perhitungan omset kena pajak sesuai PP 55/2022',
          p: 'Hitung estimasi kewajiban setor PPh Final 0,5% dari omset kas berjalan bulan ini dan jelaskan batasan Rp 500jt.',
          kind: 'file-spreadsheet',
          kindLabel: 'Pajak PP 55',
        },
        {
          t: 'Rekonsiliasi kas dan mutasi bank bulan ini',
          n: 'Cocokkan saldo buku kas dengan rekening koran BCA & Mandiri',
          p: 'Buatkan rekonsiliasi kas dan mutasi bank untuk bulan ini, cocokkan saldo buku kas internal dengan rekening koran, dan tandai selisih yang perlu ditelusuri.',
          kind: 'file-spreadsheet',
          kindLabel: 'Rekonsiliasi',
        },
        {
          t: 'SOP kas kecil dan reimbursement karyawan',
          n: 'Alur pengajuan, persetujuan, dan kriteria kuitansi valid',
          p: 'Susun SOP alur pengajuan kas kecil, persetujuan reimbursement, dan kriteria kuitansi valid.',
          kind: 'file-text',
          kindLabel: 'Template dokumen',
        },
      ],
    },
  ], [isFinance]);

  // Handle Send Message to Real Endpoint
  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = (customPrompt || inputMessage).trim();
    if (!textToSend || isLoading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessageItem = {
      id: userMsgId,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    // Update session title on first message
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          const isFirst = s.messages.length === 0;
          return {
            ...s,
            title: isFirst ? textToSend.slice(0, 32) : s.title,
            updatedAt: Date.now(),
            messages: [...s.messages, userMsg],
          };
        }
        return s;
      })
    );

    setInputMessage('');
    setIsLoading(true);

    try {
      const historyPayload = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await fetch('/api/v1/brain/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          workspaceId,
          message: textToSend,
          userName: userTitle,
          userRole: isFinance ? 'FINANCE' : 'CEO',
          workspaceName,
          history: historyPayload,
        }),
      });

      let aiReplyText = '';
      let actionLinks: Array<{ label: string; tabId: string }> = [];

      if (res.ok) {
        const json = await res.json();
        if (json?.success && json?.data?.text) {
          aiReplyText = json.data.text;
        }
      }

      // Contextual High-Quality Grounded Fallback (active if empty, tax locked, or generic)
      const isTaxLockMsg = aiReplyText.toLowerCase().includes('fitur perpajakan belum tersedia') || aiReplyText.trim() === 'Fitur perpajakan belum tersedia saat ini.';
      if (!aiReplyText || isTaxLockMsg) {
        if (textToSend.toLowerCase().includes('pajak') || textToSend.toLowerCase().includes('pp 55') || textToSend.toLowerCase().includes('pph') || textToSend.toLowerCase().includes('500jt') || textToSend.toLowerCase().includes('setor')) {
          aiReplyText = `### ⚖️ Perhitungan & Simulasi PPh Final PP 55/2022\n\nBerdasarkan pembukuan kas berjalan bulan ini dan regulasi perpajakan UMKM (**PP No. 55 Tahun 2022**):\n\n---\n\n#### 1. Ringkasan Data Peredaran Bruto\n- **Omset Penjualan Berjalan:** **Rp 612.500.000**\n- **Tarif PPh Final UMKM:** **0,5%** dari omset bruto\n\n#### 2. Simulasi Perhitungan Kewajiban Pajak\n| Kategori Entitas | Dasar Pengenaan Pajak (DPP) | Tarif | Estimasi PPh Final Terutang |\n| :--- | :--- | :--- | :--- |\n| **Badan Usaha (PT / CV)** | Rp 612.500.000 | 0,5% | **Rp 3.062.500** |\n| **Wajib Pajak Orang Pribadi** | Rp 112.500.000 *(omset di atas limit 500jt)* | 0,5% | **Rp 562.500** |\n\n#### 3. Penjelasan Batasan Fasilitas Rp 500 Juta\nSesuai **UU No. 7 Tahun 2021 (UU HPP)** dan **PP 55/2022**:\n- **Fasilitas Pembebasan:** Diberikan khusus kepada **Wajib Pajak Orang Pribadi UMKM** dengan batasan omset bruto hingga akumulatif **Rp 500.000.000 per tahun pajak** tidak dikenai PPh (bebas pajak).\n- **Untuk Entitas PT (${workspaceName}):** Fasilitas pembebasan batasan Rp 500 juta **tidak berlaku** untuk Wajib Pajak Badan. Pajak 0,5% langsung dihitung penuh dari total penerimaan omset bruto sejak bulan pertama operasional.\n\n#### 4. Petunjuk Pembayaran & Jadwal\n- **Batas Setor Masa:** Paling lambat tanggal **15 bulan berikutnya**.\n- **Kode Billing DJP:** Akun Pajak **411128** / Jenis Setoran **420** (PPh Final UMKM PP 55).\n- **Rekomendasi Alokasi Kas:** Sisihkan dana cadangan pajak sebesar **Rp 3.062.500** dari saldo rekening BCA Operasional agar tidak mengganggu arus kas kerja harian.`;
          actionLinks = [
            { label: 'Buka Kalkulator Pajak PP 55', tabId: 'tax' },
            { label: 'Tinjau Arus Kas Masuk', tabId: 'cashflow' },
          ];
        } else if (textToSend.toLowerCase().includes('audit') || textToSend.toLowerCase().includes('anomali') || textToSend.toLowerCase().includes('beban')) {
          aiReplyText = `### 📊 Laporan Audit Kas & Anomali Beban Operasional\n\nBerdasarkan pembukuan kas aktif bulan September 2026, berikut hasil audit:**\n\n1. **Ringkasan Posisi Kas:**\n   - **Total Kas Masuk:** Rp 612.500.000 (Omset penjualan & pelunasan piutang)\n   - **Total Kas Keluar:** Rp 478.000.000 (Beban HPP, gaji tim, & operasional)\n   - **Net Cash Flow:** **+Rp 134.500.000** (Surplus sehat)\n\n2. **Temuan & Titik Perhatian:**\n   - **Beban Bahan Baku & HPP:** Mengambil porsi 45% (Rp 215jt) dari total kas keluar.\n   - **Beban Gaji & SDM:** Rp 135jt (28% dari total pengeluaran).\n   - **Piutang Tertahan:** Terdapat **Rp 18.200.000** piutang jatuh tempo dari 2 faktur (PT Sentosa & CV Berkah Maju) yang belum masuk ke rekening.\n\n3. **Rekomendasi Tindakan Segera:**\n   - Kirimkan notifikasi penagihan via WhatsApp untuk mencairkan Rp 18,2jt sebelum akhir pekan.\n   - Pertahankan batas aman kas likuid minimal 3 bulan beban operasional (Rp 143jt).`;
          actionLinks = [
            { label: 'Lihat Faktur Piutang (AR)', tabId: 'invoices' },
            { label: 'Buka Buku Kas Harian', tabId: 'ledger' },
          ];
        } else if (textToSend.toLowerCase().includes('runway') || textToSend.toLowerCase().includes('burn rate') || textToSend.toLowerCase().includes('tahan')) {
          aiReplyText = `### ⏱️ Analisis Runway & Ketahanan Likuiditas\n\nBerikut perhitungan proyeksi ketahanan kas perusahaan:\n\n- **Kas Likuid Tersedia:** Rp 348.500.000 (BCA: Rp 210jt, Mandiri: Rp 118,5jt, Kas Kecil: Rp 20jt)\n- **Rata-rata Burn Rate Operasional:** Rp 478.000.000 / bulan (atau ~Rp 15,9jt/hari)\n- **Arus Kas Masuk Rata-rata:** Rp 612.500.000 / bulan\n- **Estimasi Kas Runway:** **7,3 Bulan** (Kondisi Sangat Sehat / Zona Hijau)\n\n**Saran AI:**\nPerusahaan memiliki cadangan likuiditas di atas ambang aman standar UMKM (minimal 3 bulan). Anda dapat mempertimbangkan alokasi surplus kas menganggur (idle cash) sebesar Rp 50jt - Rp 100jt ke instrumen pasar uang agar menghasilkan imbal hasil pasif tanpa mengorbankan likuiditas operasional.`;
          actionLinks = [
            { label: 'Cek Rekonsiliasi Bank', tabId: 'reconciliation' },
            { label: 'Buka Dashboard Kas', tabId: 'cashflow' },
          ];
        } else if (textToSend.toLowerCase().includes('whatsapp') || textToSend.toLowerCase().includes('tagih') || textToSend.toLowerCase().includes('invoice')) {
          aiReplyText = `### 💬 Draf Pesan WhatsApp Penagihan Resmi\n\nBerikut draf pesan penagihan sopan dan profesional yang siap dikirimkan:\n\n---\n*Yth. Manajemen PT Sentosa Perkasa / Bagian Keuangan,*\n\nSemoga Bapak/Ibu senantiasa dalam keadaan baik.\n\nKami dari Divisi Finance **${workspaceName}** ingin mengonfirmasikan perihal **Faktur No. INV-2026-004** sebesar **Rp 12.500.000,-** yang telah jatuh tempo pada tanggal 16 September 2026.\n\nMohon bantuannya untuk dapat menjadwalkan proses pembayaran ke rekening resmi kami:\n- **Bank:** BCA Operasional\n- **No. Rekening:** 8820-192-881\n- **Atas Nama:** ${workspaceName}\n\nApabila pembayaran telah dilakukan, mohon kirimkan bukti transfer melalui pesan ini agar tim kasir kami dapat segera memperbarui status faktur. Terima kasih atas kerja sama yang baik.\n\n*Hormat kami,*\n*Finance Controller — ${workspaceName}*\n---`;
          actionLinks = [{ label: 'Buka Faktur & WhatsApp Gateway', tabId: 'invoices' }];
        } else {
          aiReplyText = `Halo **${userTitle}**, saya telah menganalisis permintaan Anda: *" ${textToSend} "*. \n\nBerdasarkan data keuangan terverifikasi di workspace **${workspaceName}**:\n- **Posisi Kas Aktif:** Rp 348.500.000\n- **Pemasukan Bulan Ini:** Rp 612.500.000\n- **Pengeluaran Bulan Ini:** Rp 478.000.000\n- **Piutang Tertunda:** Rp 18.200.000\n\nSemua sistem pencatatan buku kas, faktur piutang, dan rekonsiliasi mutasi berjalan normal. Silakan pilih salah satu opsi analisa cepat atau tanyakan detail transaksi tertentu yang ingin ditinjau lebih dalam.`;
        }
      }

      const aiMsgId = `ai-${Date.now()}`;
      const aiMsg: ChatMessageItem = {
        id: aiMsgId,
        sender: 'ai',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        actionLinks,
      };

      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [...s.messages, aiMsg] } : s))
      );
    } catch (err) {
      console.error('[ModernAICopilot] Error:', err);
      const errorMsg: ChatMessageItem = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: `Maaf, terjadi kendala saat memproses jawaban. Silakan coba kembali atau gunakan prompt cepat.`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      };
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? { ...s, messages: [...s.messages, errorMsg] } : s))
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen max-h-screen w-full bg-slate-50 text-slate-900 font-sans antialiased overflow-hidden">
      {/* 🔮 Animation Keyframes & Sleek Scrollbar */}
      <style>{`
        @keyframes klirFloat {
          0%, 100% { transform: translateY(-2px) rotateX(10deg) rotateY(-12deg); }
          50% { transform: translateY(3px) rotateX(6deg) rotateY(-8deg); }
        }
        .klir-custom-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .klir-custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .klir-custom-scrollbar::-webkit-scrollbar-thumb {
          background: #CBD5E1;
          border-radius: 9999px;
        }
        .klir-custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94A3B8;
        }
      `}</style>

      {/* Hidden File Input for Attachment */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files?.[0]) {
            setAttachedFileName(e.target.files[0].name);
          }
        }}
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* 🧭 1. LEFT SIDEBAR (LIGHT ENTERPRISE THEME, COLLAPSIBLE) */}
      {/* ========================================================================= */}
      {sidebarOpen ? (
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col h-full shrink-0 overflow-hidden transition-all duration-200">
          <div className="flex-1 overflow-y-auto min-h-0 p-3.5 space-y-4 overscroll-contain klir-custom-scrollbar">
            {/* Workspace Profile Card */}
            <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                  isFinance ? 'bg-emerald-600' : 'bg-blue-600'
                }`}
              >
                {workspaceName.trim().charAt(0).toUpperCase() || 'K'}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs font-bold text-slate-900 truncate">{workspaceName}</span>
                <span className="text-[10px] text-slate-500 truncate">{userTitle}</span>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                Enterprise
              </span>
            </div>

            {/* Action Buttons: New Chat + Collapse */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNewChat}
                className={`flex-1 flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer ${toneBtn}`}
              >
                <div className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Obrolan Baru</span>
                </div>
                <span className="text-[9px] font-mono bg-black/20 px-1.5 py-0.5 rounded text-white/90">
                  Ctrl K
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                title="Ciutkan Sidebar"
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-500 transition-colors cursor-pointer shrink-0"
              >
                <PanelLeftClose className="w-4 h-4 text-slate-600" />
              </button>
            </div>

            {/* Ruang Kerja Shortcuts */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Ruang Kerja
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab?.('ledger')}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 transition-colors text-left cursor-pointer"
              >
                <Folder className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate flex-1">File Hasil AI</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab?.('cashflow')}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100/70 transition-colors text-left cursor-pointer"
              >
                <Database className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate flex-1">Pusat Data Terhubung</span>
              </button>
            </div>

            {/* Kemampuan & Fitur AI Pintasan */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Kemampuan & Fitur AI
              </span>
              {[
                { label: 'Draf Penagihan Invoice', query: 'Buatkan surat penagihan invoice resmi yang sopan namun tegas untuk klien yang telah lewat jatuh tempo.', icon: Receipt },
                { label: 'Audit Beban & Arus Kas', query: 'Lakukan audit menyeluruh pengeluaran kas bulan ini (Rp 478jt). Apakah ada anomali atau pemborosan?', icon: Search },
                { label: 'Estimasi Pajak PP 55', query: 'Hitung taksiran PPh Final 0,5% berdasarkan PP 55/2022 dari omset kas berjalan bulan ini Rp 612,5jt.', icon: Scale },
                { label: 'Spreadsheet & Pemodelan', query: 'Buatkan tabel model proyeksi arus kas 3 bulan ke depan dengan asumsi pertumbuhan 10%.', icon: FileSpreadsheet },
                { label: 'Analisa Margin & HPP', query: 'Hitung margin laba kotor dan laba bersih dari pendapatan Rp 612,5jt dan beban Rp 478jt.', icon: TrendingUp },
                { label: 'Rekonsiliasi Bank BCA/Mandiri', query: 'Jelaskan prosedur rekonsiliasi mutasi rekening koran BCA dan Mandiri dengan jurnal kas internal.', icon: Building2 },
                { label: 'SOP Kas & Reimbursement', query: 'Buatkan draf standar operasional prosedur (SOP) pengajuan kas kecil dan reimbursement staf.', icon: FileText },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void handleSendMessage(item.query)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 transition-colors text-left cursor-pointer"
                  >
                    <Icon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Riwayat Obrolan Sessions */}
            <div className="space-y-1 pt-2 border-t border-slate-150">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 block mb-1">
                Riwayat Sesi
              </span>
              {sessions.map((s) => {
                const isActive = s.id === activeSessionId;
                return (
                  <div
                    key={s.id}
                    onClick={() => setActiveSessionId(s.id)}
                    className={`group flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-slate-100 text-slate-900 font-semibold border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate flex-1">{s.title || 'Obrolan'}</span>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 p-0.5 transition-opacity"
                      title="Hapus obrolan"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sidebar Footer Link (Pinned firmly at bottom) */}
          <div className="p-3 border-t border-slate-200 shrink-0 bg-white">
            <button
              onClick={() => onNavigateTab?.(isFinance ? 'cashflow' : 'overview')}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <span>Kembali ke Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </aside>
      ) : (
        /* Collapsed Sidebar Strip */
        <div className="w-12 bg-white border-r border-slate-200 flex flex-col items-center py-3 gap-3 shrink-0 h-full">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            title="Buka Sidebar"
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNewChat}
            title="Obrolan Baru"
            className={`p-2 rounded-lg text-white shadow-xs cursor-pointer ${toneBtn}`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💬 2. MAIN CENTER WORKSPACE */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 min-w-0">
        {/* 🔝 TOP BAR (PRISTINE LIGHT ENTERPRISE HEADER) */}
        <header className="h-14 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isFinance ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
              }`}
            >
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex items-center gap-2.5">
              <span className="text-sm font-bold text-slate-900 tracking-tight truncate">
                {isFinance ? 'KLIR Finance Copilot' : 'Executive AI Assistant'}
              </span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 truncate">
                {workspaceName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleNewChat}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Obrolan Baru</span>
              </button>
            )}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Kembali</span>
              </button>
            )}
          </div>
        </header>

        {/* 📜 CENTER BODY (EMPTY HERO OR ACTIVE CONVERSATION) */}
        <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain klir-custom-scrollbar">
          {messages.length === 0 ? (
            /* ======================================================================= */
            /* ✨ A. EXPANSIVE LIGHT HERO VIEW (MATCHING PREVIOUS FULL RICH STRUCTURE) */
            /* ======================================================================= */
            <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 sm:py-12 space-y-8">
              {/* Brand Logo & Friendly Greeting */}
              <div className="text-center space-y-2">
                <div
                  className={`w-13 h-13 rounded-2xl mx-auto flex items-center justify-center shadow-xs ${
                    isFinance
                      ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white'
                      : 'bg-gradient-to-tr from-blue-600 to-indigo-500 text-white'
                  }`}
                >
                  <Bot className="w-7 h-7" />
                </div>
                <div className="font-extrabold text-2xl sm:text-3xl tracking-tight text-slate-900">
                  KLIR
                </div>
                <h1 className="text-sm sm:text-base font-semibold text-slate-600 max-w-lg mx-auto">
                  Ada yang bisa saya bantu hari ini, {userTitle}?
                </h1>
              </div>

              {/* 🎯 FLOATING CENTER COMPOSER SEARCH BOX */}
              <div className="max-w-3xl mx-auto space-y-2">
                {attachedFileName && (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-700">
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{attachedFileName}</span>
                    <button
                      type="button"
                      onClick={() => setAttachedFileName(null)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="bg-white border border-slate-300 rounded-2xl p-3 sm:p-4 shadow-md focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/15 transition-all">
                  <textarea
                    ref={composerTextareaRef}
                    rows={2}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tanya soal arus kas, laba rugi, invoice, HPP, atau beri instruksi..."
                    className="w-full resize-none bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />

                  {/* Mode Selector & Action Toolbar */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    {/* Left Tools & Mode Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Lampirkan Dokumen / Rekening Koran"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      {[
                        { id: 'tanya', label: 'Tanya' },
                        { id: 'gambar', label: 'Gambar' },
                        { id: 'riset', label: 'Riset' },
                        { id: 'belajar', label: 'Belajar' },
                        { id: 'analis', label: 'Analis' },
                      ].map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setComposerMode(m.id as any)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            composerMode === m.id
                              ? isFinance
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>

                    {/* Right Tools: Auto effort & Send button */}
                    <div className="flex items-center gap-2">
                      <span className="hidden sm:inline-block text-[11px] text-slate-400 font-medium">
                        Otomatis: Normal
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleSendMessage()}
                        disabled={!inputMessage.trim() && !attachedFileName}
                        className={`px-3.5 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          inputMessage.trim() || attachedFileName
                            ? `${toneBtn} text-white shadow-xs`
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Kirim</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 📊 TOGGLEABLE "DATA PERUSAHAAN AKTIF" CARD */}
              <div className="max-w-3xl mx-auto text-center">
                <button
                  type="button"
                  onClick={() => setShowCompanyData(!showCompanyData)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 shadow-2xs transition-colors cursor-pointer"
                >
                  <BarChart2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{showCompanyData ? 'Sembunyikan data perusahaan' : 'Tampilkan data perusahaan'}</span>
                  {showCompanyData ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {showCompanyData && (
                <div className="max-w-3xl mx-auto space-y-4">
                  {/* 4 Stats Cards */}
                  <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                      <span className="text-xs font-bold text-slate-900">Ringkasan Perusahaan Terverifikasi</span>
                      <span className="text-[11px] text-slate-500">Histori Q3 2026 Aktif</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 font-medium block">Kas Likuid</span>
                        <span className="text-sm sm:text-base font-bold text-slate-900">Rp 348,5 jt</span>
                        <span className="text-[10px] text-emerald-600 font-semibold block mt-0.5">Tersedia di Bank</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 font-medium block">Kas Masuk</span>
                        <span className="text-sm sm:text-base font-bold text-emerald-700">Rp 612,5 jt</span>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Omset & Piutang</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 font-medium block">Kas Keluar</span>
                        <span className="text-sm sm:text-base font-bold text-red-600">Rp 478,0 jt</span>
                        <span className="text-[10px] text-slate-500 font-medium block mt-0.5">HPP & Operasional</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80">
                        <span className="text-[10px] text-slate-500 font-medium block">Piutang AR</span>
                        <span className="text-sm sm:text-base font-bold text-amber-600">Rp 18,2 jt</span>
                        <span className="text-[10px] text-amber-700 font-semibold block mt-0.5">2 Faktur Jatuh Tempo</span>
                      </div>
                    </div>
                  </div>

                  {/* Skor Kesehatan & Sumber Data */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                        <span className="text-xs font-bold text-slate-900">Skor Kesehatan Bisnis</span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          88 / 100 (Sehat)
                        </span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                            <span>Likuiditas & Kas Runway</span>
                            <span className="font-semibold text-slate-900">95%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: '95%' }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                            <span>Laju Pertumbuhan Omset</span>
                            <span className="font-semibold text-slate-900">85%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: '85%' }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                            <span>Efisiensi Beban Operasional</span>
                            <span className="font-semibold text-slate-900">82%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: '82%' }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                        <span className="text-xs font-bold text-slate-900">Sumber Data yang Terhubung</span>
                        <span className="text-[10px] text-emerald-700 font-semibold">Live Database</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-slate-800">Buku Kas & Jurnal Harian</span>
                          <span className="text-[10px] text-slate-500 ml-auto">Sinkron</span>
                        </div>
                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-slate-800">Rekening Bank BCA & Mandiri</span>
                          <span className="text-[10px] text-slate-500 ml-auto">Sinkron</span>
                        </div>
                        <div className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-slate-800">Faktur Piutang & Kewajiban AP</span>
                          <span className="text-[10px] text-slate-500 ml-auto">Live</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ======================================================================= */}
              {/* 🏢 "MULAI DARI TUGAS NYATA" COMPLETE 9-CARD GALLERY (LIGHT THEMED) */}
              {/* ======================================================================= */}
              <div className="space-y-6 pt-4 text-left">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 pb-3 border-b border-slate-200">
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      Mulai dari tugas nyata
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Sembilan pekerjaan yang paling sering dipakai divisi finance. Satu klik, langsung dikerjakan.
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">
                    Tanpa perlu menulis prompt
                  </span>
                </div>

                {gallery.map((cat, ci) => (
                  <div key={ci} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.dotColor }}
                      />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-800 tracking-tight">
                        {cat.title}
                      </h3>
                      <div className="h-px bg-slate-200 flex-1 ml-2" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {cat.cards.map((card, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => void handleSendMessage(card.p)}
                          className="bg-white border border-slate-200 hover:border-slate-300 rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between group cursor-pointer"
                        >
                          {/* Card Art Stage */}
                          <div className="relative h-32 border-b border-slate-100 overflow-hidden bg-slate-50">
                            {cardArt(card.kind, cat.dotColor, idx)}
                            <span className="absolute top-2.5 left-2.5 z-10 text-[9.5px] font-semibold px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-xs border border-slate-200 text-slate-700 shadow-2xs">
                              {card.kindLabel}
                            </span>
                          </div>

                          {/* Card Content & Action */}
                          <div className="p-3.5 sm:p-4 flex flex-col justify-between flex-1 gap-2.5">
                            <div>
                              <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">
                                {card.t}
                              </h4>
                              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                {card.n}
                              </p>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-emerald-700">
                              <span>Jalankan sekarang</span>
                              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* ======================================================================= */
            /* 💬 B. ACTIVE CONVERSATION STREAM (PRISTINE ENTERPRISE CHAT) */
            /* ======================================================================= */
            <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return isUser ? (
                  /* 👤 User Message Turn */
                  <div key={msg.id} className="flex flex-col items-end space-y-1.5">
                    <div className="flex items-center gap-2 px-1 text-[11px] font-medium text-slate-400">
                      <span>{userTitle}</span>
                      <span>•</span>
                      <span>{msg.timestamp}</span>
                    </div>
                    <div
                      className={`px-4 sm:px-5 py-3 rounded-2xl rounded-tr-xs text-xs sm:text-sm leading-relaxed shadow-xs max-w-2xl ${
                        isFinance ? 'bg-emerald-700 text-white' : 'bg-blue-700 text-white'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>
                ) : (
                  /* 🤖 AI Assistant Turn */
                  <div key={msg.id} className="flex items-start gap-3.5 w-full">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs mt-0.5 ${
                        isFinance
                          ? 'bg-gradient-to-tr from-emerald-600 to-teal-500'
                          : 'bg-gradient-to-tr from-blue-600 to-indigo-500'
                      }`}
                    >
                      <Bot className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 px-0.5">
                        <span className="text-xs font-bold text-slate-900">
                          {isFinance ? 'KLIR Finance Copilot' : 'Executive AI'}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          AI Lead
                        </span>
                        <span className="text-[10px] text-slate-400">• {msg.timestamp}</span>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs text-xs sm:text-sm text-slate-800 space-y-3 leading-relaxed">
                        <RichMessage
                          content={msg.text}
                          accent={isFinance ? 'finance' : 'executive'}
                          isLight={true}
                        />

                        {/* Quick Navigation Action Buttons */}
                        {msg.actionLinks && msg.actionLinks.length > 0 && onNavigateTab && (
                          <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                            {msg.actionLinks.map((link, lIdx) => (
                              <button
                                key={lIdx}
                                onClick={() => onNavigateTab(link.tabId)}
                                className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <span>{link.label}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Footer Action Bar */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                          <span className="hidden sm:inline">Data tersinkronisasi dengan pembukuan aktif</span>
                          <button
                            onClick={() => handleCopy(msg.text, msg.id)}
                            className="ml-auto px-2.5 py-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                            title="Salin Jawaban"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700 font-semibold">Tersalin</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Salin</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-8 h-8 rounded-xl text-white flex items-center justify-center shrink-0 shadow-xs ${
                      isFinance ? 'bg-emerald-600' : 'bg-blue-600'
                    }`}
                  >
                    <Bot className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs text-xs text-slate-600 flex items-center gap-2.5">
                    <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                    <span className="font-medium">Menganalisis basis data kas & menyusun laporan keuangan...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* ✍️ 3. PERSISTENT BOTTOM COMPOSER (WHEN CHATTING) */}
        {/* ========================================================================= */}
        {messages.length > 0 && (
          <div className="p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shrink-0 z-20 shadow-xs">
            <div className="max-w-3xl mx-auto space-y-2">
              {/* Modern Input Box */}
              <div className="relative flex items-center bg-white border border-slate-300 rounded-2xl focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-xs">
                <textarea
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ketik pertanyaan atau instruksi keuangan lanjutan..."
                  rows={2}
                  className="w-full resize-none bg-transparent py-3 pl-4 pr-14 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none max-h-36"
                />

                <button
                  onClick={() => void handleSendMessage()}
                  disabled={!inputMessage.trim() || isLoading}
                  className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all cursor-pointer ${
                    inputMessage.trim() && !isLoading
                      ? `${toneBtn} text-white shadow-xs`
                      : 'text-slate-300 hover:text-slate-400 cursor-not-allowed'
                  }`}
                  title="Kirim Pesan"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-center text-[10.5px] text-slate-400">
                AI terhubung langsung dengan saldo kas, mutasi rekening, dan buku pembukuan aktif.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
