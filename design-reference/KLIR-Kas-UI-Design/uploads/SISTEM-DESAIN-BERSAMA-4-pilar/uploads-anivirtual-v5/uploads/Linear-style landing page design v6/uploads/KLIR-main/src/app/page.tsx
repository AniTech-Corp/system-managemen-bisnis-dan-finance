'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Bot,
  Zap,
  CreditCard,
  Settings,
  ChevronDown,
  Search,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  X,
  LogOut,
  Layers,
  Send,
  Plus,
  RefreshCw,
  Lock,
  Cpu,
  ShieldCheck,
  TrendingUp,
  Database,
  Code2,
  ChevronUp,
  Play,
  Sliders,
  HelpCircle,
  Calculator,
  Building,
  DollarSign,
  Download,
  Copy,
  Command,
  Activity,
  UserCheck,
} from 'lucide-react';
import { NexusHero, HudCorners, useLandingFX, SectionSigil, FlowConnectors } from './components/LandingFX';

const API_BASE = '/api/v1';

export default function Home() {
  // Navigation & Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Command Palette State (Ctrl + K)
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // User & Workspace Data
  const [authToken, setAuthToken] = useState('');
  const [user, setUser] = useState<{ email: string; fullName: string } | null>(null);
  const [workspace, setWorkspace] = useState<{ id: string; name: string; role: string }>({
    id: 'f451b290-1fc6-474d-8787-b8f1121c798b',
    name: "Anitech CEO's Workspace",
    role: 'OWNER',
  });

  // Credit Balance State
  const [credits, setCredits] = useState({ weekly: 1500, reserve: 0 });

  // Dashboard Active View & Sub-Tabs
  const [activeView, setActiveView] = useState<'corplan' | 'anivirtual' | 'workflows' | 'credits'>('corplan');
  const [corplanSubTab, setCorplanSubTab] = useState<'generator' | 'hpp' | 'kur'>('generator');
  const [anivirtualSubTab, setAnivirtualSubTab] = useState<'chat' | 'budget' | 'memory'>('chat');

  // ==========================================
  // LANDING PAGE WIDGET STATES
  // ==========================================

  // 1. CorPlan Sample Data
  const [demoCorplanTitle, setDemoCorplanTitle] = useState('Kedai Kopi Specialist');
  const [demoCorplanBab, setDemoCorplanBab] = useState<number>(1);

  const sampleCorplans: Record<string, { bab1: string; bab5: string; bep: string; margin: string }> = {
    'Kedai Kopi Specialist': {
      bab1: 'Kedai Kopi Specialist dirancang untuk segmen profesional muda dengan produk single-origin premium dan ruang kerja minimalis.',
      bab5: 'Investasi awal Rp 120.000.000. Break-Even Point (BEP) tercapai pada bulan ke-6 dengan Margin Laba Kotor 42%.',
      bep: 'Bulan ke-6',
      margin: '42%',
    },
    'Restoran Padang Digital': {
      bab1: 'Restoran Padang Digital menggabungkan resep otentik dengan pemesanan QR-code cepat & pengiriman armada sendiri.',
      bab5: 'Investasi awal Rp 250.000.000. BEP tercapai pada bulan ke-8 dengan proyeksi turnover harian Rp 12.000.000.',
      bep: 'Bulan ke-8',
      margin: '48%',
    },
    'SaaS AI Automation Platform': {
      bab1: 'Platform SaaS AI otomatisasi operasional untuk UMKM dengan model langganan bulanan berjenjang berbasis kredit.',
      bab5: 'Investasi awal Rp 85.000.000. BEP tercapai pada bulan ke-4 dengan perkiraan ARR Rp 450.000.000 di tahun ke-1.',
      bep: 'Bulan ke-4',
      margin: '75%',
    },
    'Distro Clothing Gen Z': {
      bab1: 'Brand fashion streetwear Gen Z edisi terbatas menggunakan materi ramah lingkungan dan pemasaran TikTok Live.',
      bab5: 'Investasi awal Rp 60.000.000. BEP tercapai pada bulan ke-3 dengan estimasi margin laba bersih 35%.',
      bep: 'Bulan ke-3',
      margin: '35%',
    },
  };

  // 2. AniVirtual Tone Simulator
  const [demoTone, setDemoTone] = useState<'formal' | 'semi' | 'genz'>('formal');

  const sampleTones = {
    formal: {
      label: 'Formal Eksekutif',
      text: 'Dengan hormat, kami telah menganalisis pengajuan anggaran operasional Anda. Persetujuan tertulis resmi telah dikirimkan ke sistem finance.',
      sentiment: 'SANGAT FORMAL',
    },
    semi: {
      label: 'Semi-Formal (Tim)',
      text: 'Halo Kak, instruksi pengajuan anggaran operasional sudah kami tinjau dan disetujui ya! Tim finance akan segera cairkan.',
      sentiment: 'RAMAH & PROFESIONAL',
    },
    genz: {
      label: 'Gen Z Startup',
      text: 'Gokil bgt! Pengajuan budget-nya udah disetujui 100%, lansung gaspol diproses finance sekarang!',
      sentiment: 'CASUAL & HYPED',
    },
  };

  // FAQ Accordions
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Apakah KLIR OS terhubung langsung dengan database Neon Serverless Postgres?',
      a: 'Ya, KLIR OS menggunakan Prisma ORM 6.3.1 yang terhubung langsung ke Neon Postgres via pooled & direct migration connection string dengan sslmode=require.',
    },
    {
      q: 'Bagaimana cara kerja pemotongan kredit atomis?',
      a: 'Setiap transaksi AI (CorPlan 500 Cr, AniVirtual 10 Cr) dieksekusi di dalam transaksi SQL atomis (tx.creditAccount.update & tx.creditLedger.create) untuk mencegah double-spending & race condition.',
    },
    {
      q: 'Apakah saya bisa menggunakan API Key OpenAI/Gemini milik sendiri (BYOK)?',
      a: 'Tentu! Tier Business mendukung fitur BYOK (Bring Your Own Key) yang memungkinkan Anda menyimpan API Key terenkripsi di tabel workspace_ai_keys.',
    },
    {
      q: 'Apa keunggulan arsitektur Full-Stack Next.js 16?',
      a: 'Frontend UI dan Backend APIs disatukan penuh di dalam 1 repository Next.js App Router (src/app/api/v1/...) sehingga tidak ada latency CORS dan berjalan di 1 port terpadu.',
    },
  ];

  // ==========================================
  // INNER APP DASHBOARD STATES & CALCULATORS
  // ==========================================

  // CorPlan Generator
  const [corplanTitle, setCorplanTitle] = useState('Kedai Kopi Anitech Specialist');
  const [corplanDesc, setCorplanDesc] = useState('Kedai kopi kustom untuk profesional teknologi.');
  const [corplanLoading, setCorplanLoading] = useState(false);
  const [activeCorplanData, setActiveCorplanData] = useState<any>(null);
  const [activeBabTab, setActiveBabTab] = useState<'bab1' | 'bab2' | 'bab3' | 'bab4' | 'bab5' | 'bab6'>('bab1');

  // CorPlan HPP Calculator State
  const [hppRaw, setHppRaw] = useState('15000');
  const [hppLabor, setHppLabor] = useState('5000');
  const [hppOverhead, setHppOverhead] = useState('2000');
  const [hppPrice, setHppPrice] = useState('35000');
  const [hppVolume, setHppVolume] = useState('1000');
  const [hppResult, setHppResult] = useState<any>(null);

  // CorPlan KUR Simulator State
  const [kurLoanAmount, setKurLoanAmount] = useState('100000000');
  const [kurTenorMonths, setKurTenorMonths] = useState('24');
  const [kurResult, setKurResult] = useState<any>(null);

  // AniVirtual Chat
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; content: any }>>([
    {
      sender: 'assistant',
      content: { summary: 'Halo! Saya AniVirtual AI Assistant. Masukkan instruksi operasional Anda.' },
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [draftReplies, setDraftReplies] = useState<Array<{ tone: string; text: string }>>([]);

  // AniVirtual Budget
  const [budgetAmount, setBudgetAmount] = useState('15000000');
  const [budgetCategory, setBudgetCategory] = useState('Pembelian Hardware Server');
  const [budgetResult, setBudgetResult] = useState<any>(null);

  // AniVirtual Memory
  const [memoryInput, setMemoryInput] = useState('');
  const [memoryScope, setMemoryScope] = useState<'PERSONAL' | 'WORKSPACE'>('PERSONAL');
  const [memories, setMemories] = useState<Array<{ content: string; scope: string }>>([
    { content: 'Boss suka laporan ringkas 1 halaman', scope: 'PERSONAL' },
    { content: 'SOP Tim: Laporan mingguan wajib disetujui Manager', scope: 'WORKSPACE' },
  ]);

  // Workflows Logs
  const [workflowLogs, setWorkflowLogs] = useState<Array<any>>([
    {
      id: '15270d94-c1fb-4d5b-a480-f19e5cad84dc',
      trigger: 'corplan.generate.success',
      action: 'anivirtual.generate_email_draft',
      status: 'SUCCESS',
    },
  ]);

  // Fetch Credits from backend
  const fetchCredits = async (wsId: string) => {
    try {
      const res = await fetch(`${API_BASE}/workspaces/${wsId}/credits`);
      if (res.ok) {
        const data = await res.json();
        setCredits({ weekly: data.weeklyCredit, reserve: data.reserveCredit });
      }
    } catch (err) {
      console.warn('Credits fetch error:', err);
    }
  };

  // Quick Demo Auto-Login
  const handleQuickDemoLogin = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ceo@anitech.dev', password: 'Password123!' }),
      });

      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.tokens.accessToken);
        setUser({ email: data.user.email, fullName: data.user.fullName });
        const wsId = data.activeWorkspace?.id || 'f451b290-1fc6-474d-8787-b8f1121c798b';
        setWorkspace({
          id: wsId,
          name: data.activeWorkspace?.name || "Anitech CEO's Workspace",
          role: 'OWNER',
        });
        setIsAuthenticated(true);
        setAuthModalOpen(false);
        fetchCredits(wsId);
      }
    } catch (err: any) {
      alert(`Demo login error: ${err.message}`);
    }
  };

  // Auth Handler: Login / Register Submit
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;
    const formEmail = (document.getElementById('authEmailInput') as HTMLInputElement).value;
    const formPassword = (document.getElementById('authPasswordInput') as HTMLInputElement).value;
    const formName = (document.getElementById('authNameInput') as HTMLInputElement)?.value || 'Anitech User';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formEmail, password: formPassword, fullName: formName }),
      });

      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.tokens.accessToken);
        setUser({ email: data.user.email, fullName: data.user.fullName });
        const wsId = data.activeWorkspace?.id || data.workspace?.id || 'f451b290-1fc6-474d-8787-b8f1121c798b';
        setWorkspace({
          id: wsId,
          name: data.activeWorkspace?.name || data.workspace?.name || "Anitech CEO's Workspace",
          role: 'OWNER',
        });
        setIsAuthenticated(true);
        setAuthModalOpen(false);
        fetchCredits(wsId);
      } else {
        const err = await res.json();
        alert(`Gagal: ${err.message || 'Kredensial tidak valid'}`);
      }
    } catch (err: any) {
      alert(`Error koneksi API: ${err.message}`);
    }
  };

  // Google SSO Auth Handler
  const handleGoogleSignIn = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'google.ceo@anitech.dev',
          fullName: 'Anitech Google CEO',
          avatarUrl: 'https://lh3.googleusercontent.com/a/default-user',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAuthToken(data.tokens.accessToken);
        setUser({ email: data.user.email, fullName: data.user.fullName });
        const wsId = data.activeWorkspace?.id || 'f451b290-1fc6-474d-8787-b8f1121c798b';
        setWorkspace({
          id: wsId,
          name: data.activeWorkspace?.name || "Google CEO's Workspace",
          role: 'OWNER',
        });
        setIsAuthenticated(true);
        setAuthModalOpen(false);
        fetchCredits(wsId);
      } else {
        const err = await res.json();
        alert(`Google Auth Gagal: ${err.message}`);
      }
    } catch (err: any) {
      alert(`Error Google SSO: ${err.message}`);
    }
  };

  // CorPlan Generator Submit
  const handleGenerateCorplan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCorplanLoading(true);
    try {
      const res = await fetch(`${API_BASE}/corplan/generate-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ title: corplanTitle, description: corplanDesc }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveCorplanData(data);
        fetchCredits(workspace.id);
      } else {
        const err = await res.json();
        alert(`CorPlan Error: ${err.message}`);
      }
    } catch (err: any) {
      alert(`Connection Error: ${err.message}`);
    } finally {
      setCorplanLoading(false);
    }
  };

  // CorPlan Calculate HPP Submit
  const handleCalculateHPP = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/corplan/calculate-hpp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawMaterialCost: Number(hppRaw),
          laborCost: Number(hppLabor),
          overheadCost: Number(hppOverhead),
          sellingPrice: Number(hppPrice),
          monthlyVolume: Number(hppVolume),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setHppResult(data.calculation);
      }
    } catch (err: any) {
      alert(`HPP Error: ${err.message}`);
    }
  };

  // CorPlan KUR Simulation Submit
  const handleSimulateKUR = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/corplan/simulate-kur`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loanAmount: Number(kurLoanAmount), tenorMonths: Number(kurTenorMonths) }),
      });

      if (res.ok) {
        const data = await res.json();
        setKurResult(data.simulation);
      }
    } catch (err: any) {
      alert(`KUR Error: ${err.message}`);
    }
  };

  // CorPlan Hybrid Sync Submit
  const handleSyncCorplan = async () => {
    if (!activeCorplanData) return;
    try {
      const res = await fetch(`${API_BASE}/corplan/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          corPlanProjectId: activeCorplanData.id,
          title: activeCorplanData.title,
          module: 'business_plan',
          outputData: activeCorplanData.outputs?.[0]?.outputData || {},
          revisionSeq: (activeCorplanData.revisionSeq || 1) + 1,
        }),
      });

      if (res.ok) {
        const synced = await res.json();
        setActiveCorplanData(synced);
        alert(`✅ Hybrid Sync Berhasil ke Neon DB (Seq #${synced.revisionSeq})!`);
      }
    } catch (err: any) {
      alert(`Sync Error: ${err.message}`);
    }
  };

  // AniVirtual Chat Submit
  const handleAniVirtualChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages((prev) => [...prev, { sender: 'user', content: { summary: userMsg } }]);
    setChatInput('');

    try {
      const res = await fetch(`${API_BASE}/anivirtual/understand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ message: userMsg }),
      });

      if (res.ok) {
        const session = await res.json();
        const assistantObj = session.messages?.find((m: any) => m.sender === 'assistant')?.content || {};
        setChatMessages((prev) => [...prev, { sender: 'assistant', content: assistantObj }]);
        if (assistantObj.draftReplies) {
          setDraftReplies(assistantObj.draftReplies);
        }
        fetchCredits(workspace.id);
      }
    } catch (err: any) {
      console.error('AniVirtual error:', err);
    }
  };

  // Memory Scope Submit
  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memoryInput.trim()) return;

    try {
      const res = await fetch(`${API_BASE}/anivirtual/memory`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ content: memoryInput, scope: memoryScope }),
      });

      if (res.ok) {
        setMemories((prev) => [{ content: memoryInput, scope: memoryScope }, ...prev]);
        setMemoryInput('');
      }
    } catch (err: any) {
      alert(`Memory Error: ${err.message}`);
    }
  };

  // CapEx Budget Checker Submit
  const handleCheckBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/anivirtual/check-budget`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ requestedAmount: Number(budgetAmount), category: budgetCategory }),
      });

      if (res.ok) {
        const data = await res.json();
        setBudgetResult(data);
      }
    } catch (err: any) {
      alert(`Budget Check Error: ${err.message}`);
    }
  };

  // Workflow Trigger Submit
  const handleTriggerWorkflow = async (triggerSource: string) => {
    try {
      const res = await fetch(`${API_BASE}/workflows/trigger`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ triggerSource, payload: { manual: true } }),
      });

      if (res.ok) {
        const data = await res.json();
        alert(`⚡ Workflow Berhasil Dipicu! Executed: ${data.triggeredCount} action(s).`);
        setWorkflowLogs((prev) => [
          {
            id: `NEW-${Date.now().toString(36)}`,
            trigger: triggerSource,
            action: 'anivirtual.generate_email_draft',
            status: 'SUCCESS',
          },
          ...prev,
        ]);
      }
    } catch (err: any) {
      alert(`Workflow Trigger Error: ${err.message}`);
    }
  };

  useLandingFX(!isAuthenticated);

  // ---------------------------------------------------------------------------
  // IF NOT AUTHENTICATED -> RENDER ULTRA-PREMIUM LINEAR LANDING PAGE
  // ---------------------------------------------------------------------------
  if (!isAuthenticated) {
    const activeCorplanInfo = sampleCorplans[demoCorplanTitle] || sampleCorplans['Kedai Kopi Specialist'];
    const activeToneInfo = sampleTones[demoTone];

    return (
      <div className="min-h-screen bg-[#08090a] text-[#f7f8f8] font-sans selection:bg-[#0058be] selection:text-white relative">
        <FlowConnectors />
        {/* Linear Top Navigation Bar */}
        <header className="sticky top-0 z-50 bg-[#08090a]/85 backdrop-blur-xl border-b border-white/10">
          <div className="max-w-6xl mx-auto h-16 px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#0058be] to-[#8d55e8] flex items-center justify-center font-bold text-white shadow-[0_0_20px_rgba(0,88,190,0.5)]">
                K
              </div>
              <span className="font-heading font-extrabold text-lg tracking-tight text-white">KLIR OS</span>
            </div>

            <nav className="hidden md:flex items-center gap-8 text-xs font-medium text-[#8a8f98]">
              <a href="#corplan-section" className="hover:text-white transition-colors">CorPlan AI</a>
              <a href="#anivirtual-section" className="hover:text-white transition-colors">AniVirtual</a>
              <a href="#workflows-section" className="hover:text-white transition-colors">Workflows</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#faq-section" className="hover:text-white transition-colors">FAQ</a>
            </nav>

            <div className="flex items-center gap-3">
              <button
                onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
                className="px-3.5 py-1.5 text-xs font-medium text-[#8a8f98] hover:text-white transition-colors"
              >
                Sign in
              </button>
              <button
                onClick={() => { setAuthMode('register'); setAuthModalOpen(true); }}
                className="btn-linear-glow px-4 py-1.5 rounded-full text-xs font-semibold"
              >
                Open app
              </button>
            </div>
          </div>
        </header>

        {/* HERO SECTION WITH LINEAR RADIAL SPOTLIGHT */}
        <section className="pt-24 pb-20 px-6 text-center relative overflow-hidden">
          <NexusHero />
          <HudCorners />
          <div className="max-w-4xl mx-auto space-y-8 relative z-10">
            <div
              onClick={handleQuickDemoLogin}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-[#8a8f98] cursor-pointer hover:border-[#0058be]/50 transition-all shadow-md backdrop-blur-md"
            >
              <span className="bg-[#0058be] text-white font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider">Live</span>
              <span className="text-white font-medium">Uji Coba Semua Fitur CorPlan & AniVirtual Sekarang →</span>
            </div>

            <h1 className="font-heading font-extrabold text-5xl md:text-6xl tracking-tight text-white leading-[1.08]">
              The AI operating system<br />
              for teams and agents
            </h1>

            <p className="text-lg text-[#8a8f98] max-w-2xl mx-auto leading-relaxed font-normal">
              Purpose-built for financial strategy, operational intelligence, and workflow automation. Designed for Next.js & Neon Postgres.
            </p>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                onClick={handleQuickDemoLogin}
                className="btn-linear-glow px-8 py-3.5 rounded-full text-sm font-semibold flex items-center gap-2"
              >
                <span>Buka Live Dashboard (1-Click)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setAuthMode('login'); setAuthModalOpen(true); }}
                className="px-8 py-3.5 rounded-full text-sm font-medium bg-[#121318] border border-white/10 hover:bg-[#181920] hover:border-white/20 transition-all"
              >
                Book a demo
              </button>
            </div>

            {/* Interactive Hero App Mockup Frame */}
            <div data-tilt="true" className="rounded-2xl border border-white/15 bg-[#121318] overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.95),0_0_60px_rgba(0,88,190,0.2)] text-left mt-12" style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>
              <div className="h-10 bg-[#0c0d10] border-b border-white/10 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]" />
                </div>
                <span className="font-mono text-xs text-[#626770]">klir.ai/workspace/anitech</span>
                <div className="text-[10px] text-[#00e676] bg-[#00e676]/10 px-2.5 py-0.5 rounded-full border border-[#00e676]/20 font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" /> Neon DB Live
                </div>
              </div>
              <div className="p-6 grid grid-cols-3 gap-6 bg-[#08090a]">
                <div className="col-span-1 bg-[#0f1013] border border-white/10 p-4 rounded-xl space-y-3">
                  <div className="font-heading font-bold text-sm text-white">KLIR OS (Next.js)</div>
                  <div className="text-xs text-[#8a8f98]">Anitech Workspace <span className="bg-[#0058be] text-white px-1.5 py-0.5 rounded text-[10px] font-bold">OWNER</span></div>
                  <div className="space-y-1">
                    <div className="text-xs p-2.5 rounded-lg bg-[#0058be]/15 text-white font-medium flex items-center gap-2 border border-[#0058be]/30">
                      <FileText className="w-4 h-4 text-[#0058be]" />
                      CorPlan Proposal AI
                    </div>
                    <div className="text-xs p-2.5 rounded-lg text-[#8a8f98] flex items-center gap-2 hover:bg-white/5">
                      <Bot className="w-4 h-4" />
                      AniVirtual Assistant
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/10 text-[10px] text-[#8a8f98] flex justify-between">
                    <span>Weekly Credit:</span>
                    <span className="text-white font-bold">1,500 / 2,000</span>
                  </div>
                </div>
                <div className="col-span-2 bg-[#121318] border border-white/10 p-6 rounded-xl space-y-4">
                  <div className="font-semibold text-sm flex items-center gap-2 text-[#00d2ff]">
                    <Sparkles className="w-4 h-4 text-[#0058be]" />
                    AI CorPlan Business Proposal (6 Bab Live)
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#15161c] p-3.5 rounded-xl border border-white/5 space-y-1">
                      <span className="font-semibold text-[#00d2ff] block">Bab 1: Eksekutif</span>
                      <p className="text-[#8a8f98]">Proposal Kedai Kopi Anitech Specialist dirancang untuk segmen profesional.</p>
                    </div>
                    <div className="bg-[#15161c] p-3.5 rounded-xl border border-white/5 space-y-1">
                      <span className="font-semibold text-[#00d2ff] block">Bab 5: Keuangan</span>
                      <p className="text-[#8a8f98]">BEP tercapai bulan ke-6 dengan Margin Laba 42%.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 1: INTERACTIVE CORPLAN AI SHOWCASE */}
        <section id="corplan-section" data-reveal="true" className="py-24 px-6 border-b border-white/10" style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-3 max-w-2xl mx-auto relative">
              <SectionSigil kind={0} />
              <span className="text-xs font-bold tracking-wider text-[#0058be] uppercase">FEATURE MODULE 01 — INTERACTIVE DEMO</span>
              <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-white leading-tight">
                Make business proposal planning self-driving
              </h2>
              <p className="text-sm text-[#8a8f98] leading-relaxed">
                Pilih sampel bisnis di bawah ini untuk mensimulasikan modul generator proposal 6 bab CorPlan secara *real-time*:
              </p>

              <div className="flex gap-2 flex-wrap justify-center pt-2">
                {Object.keys(sampleCorplans).map((sample) => (
                  <button
                    key={sample}
                    onClick={() => setDemoCorplanTitle(sample)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${demoCorplanTitle === sample ? 'bg-[#0058be] text-white shadow-[0_0_16px_rgba(0,88,190,0.4)]' : 'bg-[#15161c] text-[#8a8f98] border border-white/10 hover:text-white hover:border-white/20'}`}
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            <div className="linear-card-glow p-8 rounded-2xl space-y-6">
              <div className="flex justify-between items-start border-b border-white/10 pb-4">
                <div>
                  <h3 className="font-heading font-bold text-xl text-white">{demoCorplanTitle}</h3>
                  <div className="text-xs text-[#8a8f98] flex gap-3 mt-1">
                    <span>Status: <strong className="text-[#00e676]">SIMULATED LIVE</strong></span>
                    <span>•</span>
                    <span>BEP Target: <strong className="text-[#00d2ff]">{activeCorplanInfo.bep}</strong></span>
                    <span>•</span>
                    <span>Margin Kotor: <strong className="text-[#ffab00]">{activeCorplanInfo.margin}</strong></span>
                  </div>
                </div>

                <div className="flex gap-1.5">
                  {[1, 2, 5].map((babNum) => (
                    <button
                      key={babNum}
                      onClick={() => setDemoCorplanBab(babNum)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${demoCorplanBab === babNum ? 'bg-[#0058be] text-white' : 'bg-[#15161c] text-[#8a8f98] hover:text-white'}`}
                    >
                      Bab {babNum}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-[#15161c] border border-white/10 rounded-xl text-xs leading-relaxed text-[#f7f8f8]">
                {demoCorplanBab === 1 && activeCorplanInfo.bab1}
                {demoCorplanBab === 2 && 'Analisis Pasar: Segmen konsumen urban berusia 20-40 tahun dengan tingkat pertumbuhan pasar 24% per tahun.'}
                {demoCorplanBab === 5 && activeCorplanInfo.bab5}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: INTERACTIVE ANIVIRTUAL SHOWCASE */}
        <section id="anivirtual-section" data-reveal="true" className="py-24 px-6 border-b border-white/10 bg-[#0f1013]/40" style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-3 max-w-2xl mx-auto relative">
              <SectionSigil kind={1} />
              <span className="text-xs font-bold tracking-wider text-[#8d55e8] uppercase">FEATURE MODULE 02 — INTERACTIVE TONE PLAYGROUND</span>
              <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-white leading-tight">
                Operational intelligence & multi-scenario tone engine
              </h2>
              <p className="text-sm text-[#8a8f98] leading-relaxed">
                Pilih skenario gaya bahasa di bawah ini untuk melihat adaptasi balasan pesan otomatis dari AniVirtual:
              </p>

              <div className="flex gap-2 flex-wrap justify-center pt-2">
                {(['formal', 'semi', 'genz'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setDemoTone(t)}
                    className={`px-4 py-2 rounded-full text-xs font-semibold transition-all ${demoTone === t ? 'bg-[#8d55e8] text-white shadow-[0_0_18px_rgba(141,85,232,0.4)]' : 'bg-[#15161c] text-[#8a8f98] border border-white/10 hover:text-white'}`}
                  >
                    🎭 {sampleTones[t].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="linear-card p-8 rounded-2xl space-y-6 max-w-3xl mx-auto border-[#8d55e8]/40">
              <div className="flex justify-between items-center border-b border-white/10 pb-4">
                <span className="font-heading font-bold text-sm flex items-center gap-2 text-white">
                  <Bot className="w-4 h-4 text-[#8d55e8]" /> AniVirtual AI Response Simulator
                </span>
                <span className="text-[10px] font-bold bg-[#00d2ff]/15 text-[#00d2ff] px-2.5 py-0.5 rounded border border-[#00d2ff]/30">
                  {activeToneInfo.sentiment}
                </span>
              </div>

              <div className="p-4 bg-[#15161c] border border-white/10 rounded-xl space-y-2 text-xs">
                <div className="font-semibold text-white mb-1">Gaya: {activeToneInfo.label}</div>
                <p className="text-[#8a8f98] italic">"{activeToneInfo.text}"</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: CLEAN WORKFLOWS SHOWCASE */}
        <section id="workflows-section" data-reveal="true" className="py-24 px-6 border-b border-white/10" style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-3 max-w-2xl mx-auto relative">
              <SectionSigil kind={2} />
              <span className="text-xs font-bold tracking-wider text-[#00d2ff] uppercase">FEATURE MODULE 03 — WORKFLOW AUTOMATION</span>
              <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-white leading-tight">
                Move work forward across teams and agents
              </h2>
              <p className="text-sm text-[#8a8f98] leading-relaxed">
                Otomatisasi linimasa pemicu *Trigger → Action* secara terpadu tanpa perantara manual:
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 items-start">
              <div className="linear-card p-6 rounded-2xl space-y-4 border-[#00d2ff]/30">
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="font-semibold text-xs text-white">Visual Workflow Diagram</span>
                  <span className="text-[10px] bg-[#00e676]/15 text-[#00e676] px-2 py-0.5 rounded font-bold">ACTIVE</span>
                </div>

                <div className="flex items-center gap-3 p-4 bg-[#15161c] border border-white/10 rounded-xl text-xs">
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] text-[#626770] block">Trigger Event</span>
                    <span className="font-bold text-white">corplan.generate.success</span>
                  </div>
                  <div className="p-2 rounded-full text-[#00d2ff]">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] text-[#626770] block">Target Action</span>
                    <span className="font-bold text-white">anivirtual.generate_email</span>
                  </div>
                </div>
              </div>

              <div className="linear-card p-6 rounded-2xl space-y-4">
                <span className="font-semibold text-xs text-white block pb-3 border-b border-white/10">
                  Audit Logs Live (`workflow_logs`)
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
                  {[
                    { id: 'LOG-01', event: 'corplan.generate.success', action: 'anivirtual.generate_email_draft', time: '14:47:48' },
                    { id: 'LOG-02', event: 'anivirtual.budget.approved', action: 'corplan.update_financial_summary', time: '15:10:12' },
                  ].map((log) => (
                    <div key={log.id} className="p-2.5 bg-[#15161c] border border-white/10 rounded-lg flex items-center justify-between">
                      <div className="space-y-0.5">
                        <div className="font-mono text-[10px] text-[#0058be]">{log.id} • {log.time}</div>
                        <div className="text-white text-[11px]">{log.event} ➔ {log.action}</div>
                      </div>
                      <span className="text-[9px] font-bold bg-[#00e676]/15 text-[#00e676] px-1.5 py-0.5 rounded">SUCCESS</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: PRICING SECTION */}
        <section id="pricing" data-reveal="true" className="py-24 px-6 border-b border-white/10" style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold tracking-wider text-[#0058be]">TRANSPARENT PRICING</span>
              <h2 className="font-heading font-extrabold text-3xl md:text-4xl text-white">Scale your workspace with predictable credits</h2>
            </div>

            <div className="grid grid-cols-3 gap-6">
              <div data-tilt="true" className="linear-card p-8 rounded-2xl flex flex-col justify-between space-y-6" style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>
                <div>
                  <div className="font-heading font-bold text-lg text-white">Free Tier</div>
                  <div className="font-heading font-extrabold text-2xl mt-2 text-white">Rp 0 <span className="text-xs text-[#626770]">/ bulan</span></div>
                  <p className="text-xs text-[#8a8f98] mt-2">Untuk pengusaha yang baru memulai.</p>
                  <ul className="text-xs text-[#8a8f98] space-y-2.5 mt-6">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> 100 Credit / hari</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> CorPlan Proposal AI</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> AniVirtual Assistant</li>
                  </ul>
                </div>
                <button onClick={handleQuickDemoLogin} className="w-full py-2.5 rounded-lg bg-[#181920] border border-white/10 text-xs font-semibold hover:bg-white/10 transition-colors">
                  Mulai Gratis (Quick Demo)
                </button>
              </div>

              <div data-tilt="true" className="linear-card-glow p-8 rounded-2xl flex flex-col justify-between space-y-6 relative" style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#0058be] to-[#8d55e8] text-white text-[10px] font-bold px-3 py-0.5 rounded-full shadow-md">RECOMMENDED</span>
                <div>
                  <div className="font-heading font-bold text-lg text-white">Business Tier</div>
                  <div className="font-heading font-extrabold text-2xl mt-2 text-white">Rp 899.000 <span className="text-xs text-[#626770]">/ bulan</span></div>
                  <p className="text-xs text-[#8a8f98] mt-2">Akses penuh ekosistem KLIR + Workflows & BYOK.</p>
                  <ul className="text-xs text-[#8a8f98] space-y-2.5 mt-6">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> 9.000 Credit / minggu</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> 10.000 Reserve Credit</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> Workflows Engine</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> BYOK AI Key Support</li>
                  </ul>
                </div>
                <button onClick={handleQuickDemoLogin} className="btn-linear-glow w-full py-2.5 rounded-lg text-xs font-semibold">
                  Pilih Business (Quick Demo)
                </button>
              </div>

              <div data-tilt="true" className="linear-card p-8 rounded-2xl flex flex-col justify-between space-y-6" style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}>
                <div>
                  <div className="font-heading font-bold text-lg text-white">Started Tier</div>
                  <div className="font-heading font-extrabold text-2xl mt-2 text-white">Rp 299.000 <span className="text-xs text-[#626770]">/ bulan</span></div>
                  <p className="text-xs text-[#8a8f98] mt-2">Untuk tim yang butuh kapasitas pembuatan dokumen tinggi.</p>
                  <ul className="text-xs text-[#8a8f98] space-y-2.5 mt-6">
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> 2.000 Credit / minggu</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> 2.000 Reserve Credit</li>
                    <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-[#0058be]" /> CorPlan Standalone</li>
                  </ul>
                </div>
                <button onClick={handleQuickDemoLogin} className="w-full py-2.5 rounded-lg bg-[#181920] border border-white/10 text-xs font-semibold hover:bg-white/10 transition-colors">
                  Pilih Started (Quick Demo)
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: INTERACTIVE FAQ ACCORDIONS */}
        <section id="faq-section" data-reveal="true" className="py-24 px-6 border-b border-white/10" style={{ opacity: 0, transform: 'translateY(24px)', transition: 'opacity 700ms cubic-bezier(0.16,1,0.3,1), transform 700ms cubic-bezier(0.16,1,0.3,1)' }}>
          <div className="max-w-3xl mx-auto space-y-8">
            <div className="text-center space-y-2">
              <span className="text-xs font-bold tracking-wider text-[#0058be] uppercase">FAQ</span>
              <h2 className="font-heading font-extrabold text-2xl md:text-3xl text-white">Pertanyaan Umum (FAQ)</h2>
            </div>

            <div className="space-y-3 text-xs">
              {faqs.map((faq, idx) => (
                <div key={idx} className="linear-card rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full p-4 text-left font-semibold text-white flex justify-between items-center hover:bg-white/5 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {openFaq === idx ? <ChevronUp className="w-4 h-4 text-[#0058be]" /> : <ChevronDown className="w-4 h-4 text-[#8a8f98]" />}
                  </button>
                  {openFaq === idx && (
                    <div className="p-4 pt-0 text-[#8a8f98] border-t border-white/5 leading-relaxed bg-[#15161c]">
                      {faq.a}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PUBLIC FOOTER */}
        <footer className="py-12 px-6 bg-[#0f1013] text-xs text-[#8a8f98]">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#0058be] to-[#8d55e8] flex items-center justify-center font-bold text-white text-xs">
                K
              </div>
              <span className="font-heading font-bold text-sm text-white">KLIR OS</span>
              <span className="text-[#626770]">© 2026 KLIR Systems Inc. Next.js Fullstack & Neon Postgres.</span>
            </div>
            <div className="flex gap-6">
              <a href="#corplan-section" className="hover:text-white">CorPlan</a>
              <a href="#anivirtual-section" className="hover:text-white">AniVirtual</a>
              <a href="#workflows-section" className="hover:text-white">Workflows</a>
              <a href="http://localhost:3000/docs" target="_blank" className="hover:text-white">API Swagger</a>
            </div>
          </div>
        </footer>

        {/* AUTH MODAL DIALOG */}
        {authModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="linear-card-glow w-full max-w-md p-8 rounded-2xl relative shadow-2xl space-y-6">
              <button onClick={() => setAuthModalOpen(false)} className="absolute top-4 right-4 text-[#626770] hover:text-white">
                <X className="w-5 h-5" />
              </button>

              <div className="text-center space-y-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0058be] to-[#8d55e8] flex items-center justify-center font-bold text-white mx-auto">
                  K
                </div>
                <h2 className="font-heading font-bold text-xl text-white">
                  {authMode === 'login' ? 'Sign in to KLIR OS' : 'Create your KLIR Account'}
                </h2>
                <p className="text-xs text-[#8a8f98]">
                  {authMode === 'login' ? 'Masukan kredensial Anda untuk mengakses workspace.' : 'Daftar sekarang untuk 100 kredit gratis.'}
                </p>
              </div>

              {/* 1-Click Quick Demo Login */}
              <button
                type="button"
                onClick={handleQuickDemoLogin}
                className="w-full py-2.5 px-4 bg-[#0058be]/15 border border-[#0058be]/30 hover:bg-[#0058be]/25 rounded-lg text-xs font-bold text-[#0058be] flex items-center justify-center gap-2 transition-all shadow-sm"
              >
                <span>Quick Demo Dashboard (Tanpa Password)</span>
              </button>

              <div className="flex bg-[#15161c] p-1 rounded-lg border border-white/10 text-xs">
                <button
                  onClick={() => setAuthMode('login')}
                  className={`flex-1 py-1.5 font-medium rounded-md transition-all ${authMode === 'login' ? 'bg-[#121318] text-white shadow' : 'text-[#8a8f98]'}`}
                >
                  Sign in
                </button>
                <button
                  onClick={() => setAuthMode('register')}
                  className={`flex-1 py-1.5 font-medium rounded-md transition-all ${authMode === 'register' ? 'bg-[#121318] text-white shadow' : 'text-[#8a8f98]'}`}
                >
                  Create Account
                </button>
              </div>

              {/* Google OAuth SSO Button */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full py-2.5 px-4 bg-[#15161c] border border-white/10 hover:bg-[#181920] hover:border-white/25 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-3 transition-all shadow-sm"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>

                <div className="flex items-center gap-3 text-[#626770] text-[10px]">
                  <div className="flex-1 h-px bg-white/10" />
                  <span>atau gunakan email</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-4 text-xs">
                {authMode === 'register' && (
                  <div className="space-y-1">
                    <label className="text-[#8a8f98] font-medium">Nama Lengkap</label>
                    <input
                      id="authNameInput"
                      type="text"
                      placeholder="Anitech Founder"
                      required
                      className="w-full bg-[#15161c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#0058be]"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[#8a8f98] font-medium">Email Address</label>
                  <input
                    id="authEmailInput"
                    type="email"
                    defaultValue="ceo@anitech.dev"
                    required
                    className="w-full bg-[#15161c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#0058be]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[#8a8f98] font-medium">Password</label>
                  <input
                    id="authPasswordInput"
                    type="password"
                    defaultValue="Password123!"
                    required
                    className="w-full bg-[#15161c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#0058be]"
                  />
                </div>

                <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg text-xs font-semibold mt-4">
                  {authMode === 'login' ? 'Sign in →' : 'Create Account & Workspace →'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // STREAMLINED & REFINED INNER DASHBOARD APP (Linear Design System)
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-screen w-screen bg-[#08090a] text-[#f7f8f8] font-sans overflow-hidden">
      {/* Streamlined Left Sidebar */}
      <aside className="w-64 bg-[#0b0c0f] border-r border-white/10 flex flex-col p-4 select-none">
        <div className="mb-6 space-y-3">
          <div className="flex items-center gap-2.5 px-1">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#0058be] to-[#8d55e8] flex items-center justify-center font-bold text-white text-xs shadow-sm">
              K
            </div>
            <span className="font-heading font-extrabold text-base tracking-tight text-white">KLIR OS</span>
          </div>

          <div className="bg-[#121318] border border-white/10 p-2.5 rounded-xl flex items-center justify-between cursor-pointer hover:border-white/20 transition-all">
            <div className="flex flex-col text-left">
              <span className="font-semibold text-xs text-white">{workspace.name}</span>
              <span className="text-[10px] text-[#0058be] font-bold">{workspace.role}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#8a8f98]" />
          </div>
        </div>

        {/* Clean Sidebar Navigation Menu */}
        <div className="space-y-4 flex-1">
          <div>
            <div className="text-[10px] font-bold text-[#626770] tracking-wider px-2 mb-2 uppercase">MODUL APLIKASI</div>
            <div className="space-y-1">
              <button
                onClick={() => setActiveView('corplan')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${activeView === 'corplan' ? 'bg-[#0058be]/15 text-white font-semibold border border-[#0058be]/30 shadow-sm' : 'text-[#8a8f98] hover:bg-white/5 hover:text-white'}`}
              >
                <FileText className={`w-4 h-4 ${activeView === 'corplan' ? 'text-[#0058be]' : ''}`} />
                <span>CorPlan AI</span>
              </button>
              <button
                onClick={() => setActiveView('anivirtual')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeView === 'anivirtual' ? 'bg-[#0058be]/15 text-white font-semibold border border-[#0058be]/30 shadow-sm' : 'text-[#8a8f98] hover:bg-white/5 hover:text-white'}`}
              >
                <Bot className={`w-4 h-4 ${activeView === 'anivirtual' ? 'text-[#0058be]' : ''}`} />
                <span>AniVirtual</span>
              </button>
              <button
                onClick={() => setActiveView('workflows')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeView === 'workflows' ? 'bg-[#0058be]/15 text-white font-semibold border border-[#0058be]/30 shadow-sm' : 'text-[#8a8f98] hover:bg-white/5 hover:text-white'}`}
              >
                <Zap className={`w-4 h-4 ${activeView === 'workflows' ? 'text-[#0058be]' : ''}`} />
                <span>Workflows Engine</span>
              </button>
            </div>
          </div>

          <div>
            <div className="text-[10px] font-bold text-[#626770] tracking-wider px-2 mb-2 uppercase">SISTEM</div>
            <button
              onClick={() => setActiveView('credits')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${activeView === 'credits' ? 'bg-[#0058be]/15 text-white font-semibold border border-[#0058be]/30 shadow-sm' : 'text-[#8a8f98] hover:bg-white/5 hover:text-white'}`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Kredit & Ledger</span>
            </button>
          </div>
        </div>

        {/* Streamlined Credit Meter Widget */}
        <div className="bg-[#121318] border border-white/10 p-3 rounded-xl mb-3 space-y-2">
          <div className="flex justify-between text-xs text-[#8a8f98]">
            <span>Weekly Credit</span>
            <span className="font-bold text-white">{credits.weekly.toLocaleString()} / 2.000</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#0058be] to-[#8d55e8] rounded-full" style={{ width: `${Math.min(100, (credits.weekly / 2000) * 100)}%` }} />
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="bg-[#0058be]/20 text-[#0058be] px-2 py-0.5 rounded font-bold border border-[#0058be]/30">BUSINESS TIER</span>
            <span className="text-[#626770]">Reserve: {credits.reserve}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#0058be] flex items-center justify-center font-bold text-white text-xs">
              A
            </div>
            <div className="flex flex-col text-left">
              <span className="font-semibold text-white">{user?.fullName || 'Anitech CEO'}</span>
              <span className="text-[10px] text-[#626770]">{user?.email || 'ceo@anitech.dev'}</span>
            </div>
          </div>
          <button onClick={() => setIsAuthenticated(false)} className="text-[#626770] hover:text-[#ff5252] transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-[#08090a] overflow-y-auto">
        {/* Sticky Header Top Bar */}
        <header className="h-13 border-b border-white/10 px-6 flex items-center justify-between sticky top-0 bg-[#08090a]/85 backdrop-blur-md z-10">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#626770]">KLIR OS</span>
            <span className="text-white/20">/</span>
            <span className="font-bold text-white uppercase tracking-wider">{activeView}</span>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={() => setCmdOpen(true)} className="flex items-center gap-2 bg-[#15161c] border border-white/10 text-xs text-[#8a8f98] px-3 py-1.5 rounded-lg hover:border-white/20">
              <Search className="w-3.5 h-3.5" />
              <span>Cari atau perintah...</span>
              <kbd className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded">Ctrl K</kbd>
            </button>
            <div className="flex items-center gap-2 text-xs text-[#00e676] bg-[#00e676]/10 px-2.5 py-1 rounded-full border border-[#00e676]/20 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00e676] animate-pulse" />
              Neon DB Live
            </div>
          </div>
        </header>

        <div className="p-8 flex-1 space-y-6">
          {/* VIEW 1: CORPLAN */}
          {activeView === 'corplan' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div>
                  <h1 className="font-heading font-bold text-xl text-white">CorPlan — AI Business Proposal & Financial Engine</h1>
                  <p className="text-xs text-[#8a8f98]">Generator proposal 6 bab terstruktur, kalkulator HPP, & simulator KUR.</p>
                </div>

                <div className="flex bg-[#15161c] p-1 rounded-xl border border-white/10 text-xs">
                  <button
                    onClick={() => setCorplanSubTab('generator')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${corplanSubTab === 'generator' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    1. AI Proposal (6 Bab)
                  </button>
                  <button
                    onClick={() => setCorplanSubTab('hpp')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${corplanSubTab === 'hpp' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    2. Kalkulator HPP
                  </button>
                  <button
                    onClick={() => setCorplanSubTab('kur')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${corplanSubTab === 'kur' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    3. Simulator KUR
                  </button>
                </div>
              </div>

              {corplanSubTab === 'generator' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-sm text-white">Form Proposal Bisnis</h3>
                        <span className="text-[10px] bg-[#8d55e8]/15 text-[#8d55e8] px-2.5 py-0.5 rounded-full border border-[#8d55e8]/30 font-bold">
                          500 Credits
                        </span>
                      </div>

                      <form onSubmit={handleGenerateCorplan} className="space-y-3 text-xs">
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Judul Bisnis</label>
                          <input
                            type="text"
                            value={corplanTitle}
                            onChange={(e) => setCorplanTitle(e.target.value)}
                            required
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#0058be]"
                          />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1 font-medium">Deskripsi & Target Market</label>
                          <textarea
                            rows={3}
                            value={corplanDesc}
                            onChange={(e) => setCorplanDesc(e.target.value)}
                            className="w-full bg-[#15161c] border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#0058be]"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={corplanLoading}
                          className="btn-linear-glow w-full py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2"
                        >
                          {corplanLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : '⚡ Generate Proposal AI (500 Credits)'}
                        </button>
                      </form>
                    </div>

                    <div className="linear-card p-6 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-sm text-white">Status Dokumen</h3>
                        <span className="text-xs bg-white/5 px-2.5 py-0.5 rounded-full text-[#8a8f98]">Neon DB Connected</span>
                      </div>
                      <div className="p-3 bg-[#15161c] border border-[#0058be]/50 rounded-xl flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="font-semibold text-xs text-white">{corplanTitle}</div>
                          <div className="text-[10px] text-[#626770]">6 Bab Proposal • Hybrid Sync Seq #1</div>
                        </div>
                        <span className="text-[10px] font-bold bg-[#00e676]/15 text-[#00e676] px-2 py-0.5 rounded border border-[#00e676]/30">READY</span>
                      </div>
                    </div>
                  </div>

                  {activeCorplanData && (
                    <div className="linear-card p-6 rounded-2xl space-y-4 border-[#0058be]/40">
                      <div className="flex justify-between items-start">
                        <div>
                          <h2 className="font-heading font-bold text-lg text-[#00d2ff]">{activeCorplanData.title}</h2>
                          <div className="text-xs text-[#8a8f98] flex gap-3 mt-1">
                            <span>Status: <strong className="text-[#00e676]">GENERATED LIVE</strong></span>
                            <span>•</span>
                            <span>Model: <strong className="text-white">Google Gemini AI</strong></span>
                            <span>•</span>
                            <span>Revision Seq: <strong className="text-[#0058be]">{activeCorplanData.revisionSeq || 1}</strong></span>
                          </div>
                        </div>
                        <button onClick={handleSyncCorplan} className="px-3 py-1.5 bg-[#181920] border border-white/10 hover:bg-white/10 rounded-lg text-xs font-medium flex items-center gap-2">
                          <RefreshCw className="w-3.5 h-3.5 text-[#0058be]" />
                          <span>Hybrid Sync Client-to-Server</span>
                        </button>
                      </div>

                      <div className="flex gap-2 border-b border-white/10 pb-2 text-xs">
                        {(['bab1', 'bab2', 'bab3', 'bab4', 'bab5', 'bab6'] as const).map((bab, idx) => (
                          <button
                            key={bab}
                            onClick={() => setActiveBabTab(bab)}
                            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${activeBabTab === bab ? 'bg-[#0058be] text-white' : 'text-[#8a8f98] hover:text-white'}`}
                          >
                            Bab {idx + 1}
                          </button>
                        ))}
                      </div>

                      <div className="p-4 bg-[#15161c] border border-white/10 rounded-xl text-xs leading-relaxed text-[#f7f8f8]">
                        {activeCorplanData.outputs?.[0]?.outputData?.[`bab${activeBabTab.slice(-1)}_eksekutif_summary`] ||
                          activeCorplanData.outputs?.[0]?.outputData?.[`bab${activeBabTab.slice(-1)}_analisis_pasar`] ||
                          `Bab ${activeBabTab.slice(-1)} proposal bisnis terstruktur telah siap diaudit.`}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {corplanSubTab === 'hpp' && (
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-white">
                      <Calculator className="w-4 h-4 text-[#0058be]" /> Form Kalkulator HPP & Margin
                    </h3>
                    <form onSubmit={handleCalculateHPP} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Bahan Baku (Rp/Unit)</label>
                          <input type="number" value={hppRaw} onChange={(e) => setHppRaw(e.target.value)} className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Tenaga Kerja (Rp/Unit)</label>
                          <input type="number" value={hppLabor} onChange={(e) => setHppLabor(e.target.value)} className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Overhead (Rp/Unit)</label>
                          <input type="number" value={hppOverhead} onChange={(e) => setHppOverhead(e.target.value)} className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white" />
                        </div>
                        <div>
                          <label className="text-[#8a8f98] block mb-1">Harga Jual (Rp/Unit)</label>
                          <input type="number" value={hppPrice} onChange={(e) => setHppPrice(e.target.value)} className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[#8a8f98] block mb-1">Target Volume Penjualan / Bulan</label>
                        <input type="number" value={hppVolume} onChange={(e) => setHppVolume(e.target.value)} className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white" />
                      </div>
                      <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                        Hitung HPP & Margin Profit
                      </button>
                    </form>
                  </div>

                  <div className="linear-card p-6 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-sm text-white">Hasil Perhitungan Finansial HPP</h3>
                    {hppResult ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between">
                          <span className="text-[#8a8f98]">Total HPP / Unit:</span>
                          <span className="font-bold text-white">Rp {hppResult.totalHPPPerUnit.toLocaleString()}</span>
                        </div>
                        <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between">
                          <span className="text-[#8a8f98]">Laba Kotor / Unit:</span>
                          <span className="font-bold text-[#00e676]">Rp {hppResult.grossProfitPerUnit.toLocaleString()}</span>
                        </div>
                        <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between">
                          <span className="text-[#8a8f98]">Margin Persentase:</span>
                          <span className="font-bold text-[#00d2ff]">{hppResult.marginPercentage}</span>
                        </div>
                        <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between">
                          <span className="text-[#8a8f98]">Proyeksi Omset Bulanan:</span>
                          <span className="font-bold text-[#ffab00]">Rp {hppResult.totalMonthlyRevenue.toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#8a8f98] italic">Klik "Hitung HPP" untuk melihat kalkulasi rasio finansial.</p>
                    )}
                  </div>
                </div>
              )}

              {corplanSubTab === 'kur' && (
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2 text-white">
                      <Building className="w-4 h-4 text-[#00d2ff]" /> Form Simulator Pinjaman KUR
                    </h3>
                    <form onSubmit={handleSimulateKUR} className="space-y-3">
                      <div>
                        <label className="text-[#8a8f98] block mb-1 font-medium">Plafond Pinjaman (Rp)</label>
                        <input
                          type="number"
                          value={kurLoanAmount}
                          onChange={(e) => setKurLoanAmount(e.target.value)}
                          className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[#8a8f98] block mb-1 font-medium">Tenor (Bulan)</label>
                        <select
                          value={kurTenorMonths}
                          onChange={(e) => setKurTenorMonths(e.target.value)}
                          className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                        >
                          <option value="12">12 Bulan (1 Tahun)</option>
                          <option value="24">24 Bulan (2 Tahun)</option>
                          <option value="36">36 Bulan (3 Tahun)</option>
                          <option value="60">60 Bulan (5 Tahun)</option>
                        </select>
                      </div>
                      <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                        Simulasikan Angsuran KUR (Bunga Subsider 6%)
                      </button>
                    </form>
                  </div>

                  <div className="linear-card p-6 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-sm text-white">Hasil Simulasi Angsuran KUR</h3>
                    {kurResult ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between">
                          <span className="text-[#8a8f98]">Angsuran Bulanan:</span>
                          <span className="font-bold text-[#00e676] text-sm">Rp {kurResult.monthlyInstallment.toLocaleString()} / bulan</span>
                        </div>
                        <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between">
                          <span className="text-[#8a8f98]">Pokok Bulanan:</span>
                          <span className="font-bold text-white">Rp {kurResult.monthlyPrincipal.toLocaleString()}</span>
                        </div>
                        <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between">
                          <span className="text-[#8a8f98]">Total Bunga Subsider:</span>
                          <span className="font-bold text-[#ffab00]">Rp {kurResult.totalInterest.toLocaleString()}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#8a8f98] italic">Klik "Simulasikan Angsuran" untuk menghitung skema pengembalian.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: ANIVIRTUAL */}
          {activeView === 'anivirtual' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center pb-2 border-b border-white/10">
                <div>
                  <h1 className="font-heading font-bold text-xl text-white">AniVirtual — AI Operasional & Tone Engine</h1>
                  <p className="text-xs text-[#8a8f98]">Asisten AI operasional internal dengan multi-scenario draft replies & budget checker.</p>
                </div>

                <div className="flex bg-[#15161c] p-1 rounded-xl border border-white/10 text-xs">
                  <button
                    onClick={() => setAnivirtualSubTab('chat')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${anivirtualSubTab === 'chat' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    1. Chat & Multi-Tone
                  </button>
                  <button
                    onClick={() => setAnivirtualSubTab('budget')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${anivirtualSubTab === 'budget' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    2. CapEx Budget Checker
                  </button>
                  <button
                    onClick={() => setAnivirtualSubTab('memory')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-all ${anivirtualSubTab === 'memory' ? 'bg-[#0058be] text-white shadow' : 'text-[#8a8f98]'}`}
                  >
                    3. Memory Isolation
                  </button>
                </div>
              </div>

              {anivirtualSubTab === 'chat' && (
                <div className="linear-card p-6 rounded-2xl flex flex-col h-[500px]">
                  <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-4">
                    <h3 className="font-semibold text-sm text-white">Interactive AI Chat & Multi-Scenario Tone Generator</h3>
                    <span className="text-[10px] bg-[#8d55e8]/15 text-[#8d55e8] px-2.5 py-0.5 rounded-full border border-[#8d55e8]/30 font-bold">10 Credits</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-2 mb-4">
                    {chatMessages.map((m, idx) => (
                      <div key={idx} className={`flex gap-3 text-xs ${m.sender === 'user' ? 'justify-end' : ''}`}>
                        {m.sender === 'assistant' && (
                          <div className="w-6 h-6 rounded-full bg-[#0058be] flex items-center justify-center font-bold text-white text-[10px] shrink-0">A</div>
                        )}
                        <div className={`p-3 rounded-xl max-w-[80%] border ${m.sender === 'user' ? 'bg-[#0058be] border-transparent text-white' : 'bg-[#15161c] border-white/10'}`}>
                          <p>{m.content.summary || m.content}</p>
                          {m.content.sentiment && (
                            <p className="text-[10px] text-[#00d2ff] mt-1 font-semibold">Sentimen: {m.content.sentiment}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {draftReplies.length > 0 && (
                    <div className="p-3 bg-[#0058be]/5 border border-[#0058be]/30 rounded-xl mb-3">
                      <div className="text-[11px] font-bold text-[#0058be] mb-2">Multi-Scenario Draft Balasan AI:</div>
                      <div className="grid grid-cols-3 gap-2">
                        {draftReplies.map((d, i) => (
                          <div key={i} className="p-2 bg-[#121318] border border-white/10 rounded-lg text-[10px]">
                            <span className="font-bold text-white block mb-1">{d.tone}</span>
                            <span className="text-[#8a8f98]">{d.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleAniVirtualChat} className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ketik instruksi operasional..."
                      className="flex-1 bg-[#15161c] border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#0058be]"
                    />
                    <button type="submit" className="btn-linear-glow px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1">
                      <Send className="w-3.5 h-3.5" /> Kirim (10 Credits)
                    </button>
                  </form>
                </div>
              )}

              {anivirtualSubTab === 'budget' && (
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div className="linear-card-glow p-6 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-sm text-white">Form Cek Budget CapEx/OpEx</h3>
                    <form onSubmit={handleCheckBudget} className="space-y-3">
                      <div>
                        <label className="text-[#8a8f98] block mb-1 font-medium">Nominal Pengajuan (Rp)</label>
                        <input
                          type="number"
                          value={budgetAmount}
                          onChange={(e) => setBudgetAmount(e.target.value)}
                          className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[#8a8f98] block mb-1 font-medium">Kategori Operasional</label>
                        <input
                          type="text"
                          value={budgetCategory}
                          onChange={(e) => setBudgetCategory(e.target.value)}
                          className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                        />
                      </div>
                      <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                        Verifikasi Anggaran & Generate Purchase Order (PO)
                      </button>
                    </form>
                  </div>

                  <div className="linear-card p-6 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-sm text-white">Status Verifikasi Purchase Order</h3>
                    {budgetResult ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-[#00e676]/10 border border-[#00e676]/30 rounded-xl flex justify-between items-center">
                          <span className="text-[#8a8f98]">Status Verifikasi:</span>
                          <span className="font-bold text-[#00e676]">{budgetResult.status}</span>
                        </div>
                        <div className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex justify-between items-center">
                          <span className="text-[#8a8f98]">Nomor PO Otomatis:</span>
                          <code className="font-mono text-[#0058be] font-bold">{budgetResult.autoGeneratedPO}</code>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-[#8a8f98] italic">Submit pengajuan untuk memverifikasi anggaran ke proyek CorPlan.</p>
                    )}
                  </div>
                </div>
              )}

              {anivirtualSubTab === 'memory' && (
                <div className="grid grid-cols-2 gap-6 text-xs">
                  <div className="linear-card p-6 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-sm text-white">Tambah Memori Scope Baru</h3>
                    <form onSubmit={handleAddMemory} className="space-y-3">
                      <div>
                        <label className="text-[#8a8f98] block mb-1 font-medium">Isi Instruksi / Memori</label>
                        <input
                          type="text"
                          value={memoryInput}
                          onChange={(e) => setMemoryInput(e.target.value)}
                          placeholder="Misal: Format email wajib menggunakan salam resmi..."
                          className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[#8a8f98] block mb-1 font-medium">Cakupan Scope Memori</label>
                        <select
                          value={memoryScope}
                          onChange={(e: any) => setMemoryScope(e.target.value)}
                          className="w-full bg-[#15161c] border border-white/10 rounded-lg p-2 text-white"
                        >
                          <option value="PERSONAL">PERSONAL (Hanya User Ini)</option>
                          <option value="WORKSPACE">WORKSPACE (Seluruh Tim Workspace)</option>
                        </select>
                      </div>
                      <button type="submit" className="btn-linear-glow w-full py-2.5 rounded-lg font-semibold">
                        + Simpan ke Neon Postgres
                      </button>
                    </form>
                  </div>

                  <div className="linear-card p-6 rounded-2xl space-y-4">
                    <h3 className="font-semibold text-sm text-white">Daftar Memori Terisolasi Active Scope</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {memories.map((m, i) => (
                        <div key={i} className="p-3 bg-[#15161c] border border-white/10 rounded-xl flex items-center justify-between">
                          <div className="space-y-1">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${m.scope === 'PERSONAL' ? 'bg-[#ffab00]/20 text-[#ffab00]' : 'bg-[#00d2ff]/20 text-[#00d2ff]'}`}>
                              {m.scope}
                            </span>
                            <p className="text-white font-medium">{m.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: WORKFLOWS */}
          {activeView === 'workflows' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-heading font-bold text-xl text-white">Workflows — Otomatisasi Lintas Modul</h1>
                <p className="text-xs text-[#8a8f98]">Konfigurasi dan pantau eksekusi otomatisasi pemicu event (Trigger → Action).</p>
              </div>

              <div className="grid grid-cols-2 gap-6 text-xs">
                <div className="linear-card p-6 rounded-2xl space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-sm text-white">Aturan Workflow Aktif</h3>
                    <span className="bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-full text-[11px] text-[#8a8f98]">Business Tier Allowed</span>
                  </div>

                  <div className="p-4 bg-[#15161c] border border-white/10 rounded-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold bg-[#00e676]/15 text-[#00e676] px-2 py-0.5 rounded border border-[#00e676]/30">ACTIVE</span>
                      <span className="text-[#626770] font-mono text-[10px]">ID: 05940699...</span>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-[#121318] rounded-lg border border-white/5">
                      <div className="flex-1">
                        <span className="text-[10px] text-[#626770] block">Trigger</span>
                        <span className="font-semibold text-white">corplan.generate.success</span>
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#0058be]" />
                      <div className="flex-1">
                        <span className="text-[10px] text-[#626770] block">Target Action</span>
                        <span className="font-semibold text-white">anivirtual.generate_email_draft</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTriggerWorkflow('corplan.generate.success')}
                      className="w-full py-2 bg-[#0058be] text-white font-semibold rounded-lg hover:bg-[#0058be]/90 transition-colors flex items-center justify-center gap-2"
                    >
                      <Zap className="w-3.5 h-3.5" /> Trigger Uji Coba Engine
                    </button>
                  </div>
                </div>

                <div className="linear-card p-6 rounded-2xl space-y-4">
                  <h3 className="font-semibold text-sm text-white">Riwayat Log Eksekusi (`workflow_logs`)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-[#626770]">
                          <th className="py-2">Log ID</th>
                          <th className="py-2">Event</th>
                          <th className="py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {workflowLogs.map((log, i) => (
                          <tr key={i}>
                            <td className="py-2 font-mono text-[11px] text-[#0058be]">{log.id.slice(0, 10)}...</td>
                            <td className="py-2 text-[#8a8f98]">{log.trigger}</td>
                            <td className="py-2">
                              <span className="bg-[#00e676]/15 text-[#00e676] px-1.5 py-0.5 rounded text-[10px] font-bold">
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 4: CREDITS */}
          {activeView === 'credits' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-heading font-bold text-xl text-white">Kredit & Economy Ledger</h1>
                <p className="text-xs text-[#8a8f98]">Meteran pemotongan kredit atomis dan transparansi audit transaksi token AI.</p>
              </div>

              <div className="grid grid-cols-3 gap-6 text-xs">
                <div className="linear-card p-6 rounded-2xl space-y-1">
                  <span className="text-[#626770]">Sisa Weekly Credit</span>
                  <div className="font-heading font-bold text-2xl text-white">{credits.weekly.toLocaleString()} Cr</div>
                  <span className="text-[10px] text-[#8a8f98]">Base Alokasi: 9.000 / minggu</span>
                </div>
                <div className="linear-card p-6 rounded-2xl space-y-1">
                  <span className="text-[#626770]">Reserve Credit</span>
                  <div className="font-heading font-bold text-2xl text-white">{credits.reserve.toLocaleString()} Cr</div>
                  <span className="text-[10px] text-[#8a8f98]">Auto-unlock jika Weekly habis</span>
                </div>
                <div className="linear-card p-6 rounded-2xl space-y-1">
                  <span className="text-[#626770]">Monthly Max Limit</span>
                  <div className="font-heading font-bold text-2xl text-[#0058be]">46.000 Cr</div>
                  <span className="text-[10px] text-[#8a8f98]">Business Tier Subscription</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* COMMAND PALETTE MODAL (Ctrl + K) */}
      {cmdOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-start justify-center pt-24 p-4">
          <div className="linear-card-glow w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl space-y-2">
            <div className="p-4 border-b border-white/10 flex items-center gap-3">
              <Search className="w-4 h-4 text-[#8a8f98]" />
              <input
                type="text"
                placeholder="Ketik perintah atau navigasi..."
                autoFocus
                className="w-full bg-transparent text-sm text-white focus:outline-none"
              />
            </div>
            <div className="p-2 space-y-1 text-xs">
              <div className="text-[10px] font-bold text-[#626770] px-2 py-1">NAVIGASI LANGSUNG</div>
              <button onClick={() => { setActiveView('corplan'); setCmdOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#0058be] hover:text-white flex justify-between">
                <span>Buka CorPlan Business Proposal</span>
                <kbd className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded">C</kbd>
              </button>
              <button onClick={() => { setActiveView('anivirtual'); setCmdOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#0058be] hover:text-white flex justify-between">
                <span>Buka AniVirtual AI Assistant</span>
                <kbd className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded">A</kbd>
              </button>
              <button onClick={() => { setActiveView('workflows'); setCmdOpen(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-[#0058be] hover:text-white flex justify-between">
                <span>Buka Workflows Engine</span>
                <kbd className="font-mono text-[10px] bg-white/10 px-1.5 py-0.5 rounded">W</kbd>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
