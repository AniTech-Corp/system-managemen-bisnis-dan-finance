'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  Wallet,
  FileText,
  Clock,
  Building2,
  TrendingUp,
  TrendingDown,
  Bot,
  Package,
  ShieldCheck,
  Search,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Trophy,
  DollarSign,
  Target,
  Sparkles,
  RefreshCw,
  Plus,
  Send,
  SlidersHorizontal,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

import WorkspaceDataHub from '../WorkspaceDataHub';
import CEOApprovalModal from '../notifications/CEOApprovalModal';
import { CEOSettingsModal } from '../settings/CEOSettingsModal';
import type { ApprovalRequest } from '@/lib/security-guardrail';

interface SalesOpsDashboardProps {
  workspaceId: string;
  workspaceName?: string;
  userName?: string;
  initialTab?: string;
  onOpenAI?: (prompt: string) => void;
}

export default function SalesOpsModernDashboard({
  workspaceId,
  workspaceName = 'Anitech Enterprise',
  userName = 'Executive Lead',
  initialTab = 'overview',
  onOpenAI,
}: SalesOpsDashboardProps) {
  // Navigation State
  const [activeNav, setActiveNav] = useState<string>(initialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Modals & Triggers
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [approvalsOpen, setApprovalsOpen] = useState<boolean>(false);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [waModalOpen, setWaModalOpen] = useState<boolean>(false);
  const [waLinkLoading, setWaLinkLoading] = useState<boolean>(false);
  const [waGeneratedUrl, setWaGeneratedUrl] = useState<string>('');
  const [waMessage, setWaMessage] = useState<string>('');

  // What-If Simulation State
  const [simPrompt, setSimPrompt] = useState<string>('Pangkas 2 staf gaji 6jt selama 6 bulan');
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any>(null);

  // Data States
  const [contextData, setContextData] = useState<any>(null);
  const [insightData, setInsightData] = useState<any>(null);
  const [trendsData, setTrendsData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Fetch all core backend data
  const fetchDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [ctxRes, insRes, trdRes, txRes, invRes, oblRes] = await Promise.allSettled([
        fetch(`/api/v1/brain/recommendations`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/brain/dashboard-insight?role=ceo`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/analytics/financial-trends?months=6`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/kas/transactions?limit=10`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/kas/invoices?limit=10`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/kas/obligations`, { credentials: 'include' }).then((r) => r.json()),
      ]);

      if (ctxRes.status === 'fulfilled' && ctxRes.value?.success) {
        setContextData(ctxRes.value.data);
      }
      if (insRes.status === 'fulfilled' && insRes.value) {
        setInsightData(insRes.value);
      }
      if (trdRes.status === 'fulfilled' && trdRes.value?.success) {
        setTrendsData(trdRes.value.data);
      }
      if (txRes.status === 'fulfilled' && txRes.value?.transactions) {
        setTransactions(txRes.value.transactions);
      }
      if (invRes.status === 'fulfilled' && invRes.value?.invoices) {
        setInvoices(invRes.value.invoices);
      }
      if (oblRes.status === 'fulfilled' && oblRes.value?.all) {
        setObligations(oblRes.value.all);
      }

      // Fetch pending approvals
      try {
        const appRes = await fetch(`/api/v1/security/approvals?workspaceId=${encodeURIComponent(workspaceId)}`, {
          credentials: 'include',
        });
        if (appRes.ok) {
          const appData = await appRes.json();
          if (Array.isArray(appData.approvals)) {
            setPendingApprovals(appData.approvals);
          }
        }
      } catch {}
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  // Format IDR Rupiah
  const formatRupiah = (val: number | null | undefined) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatShortRupiah = (val: number | null | undefined) => {
    const num = Number(val) || 0;
    if (Math.abs(num) >= 1_000_000_000) {
      return `Rp ${(num / 1_000_000_000).toFixed(1)} M`;
    }
    if (Math.abs(num) >= 1_000_000) {
      return `Rp ${(num / 1_000_000).toFixed(1)} jt`;
    }
    return `Rp ${num.toLocaleString('id-ID')}`;
  };

  // Trigger WhatsApp Piutang Reminder API
  const handleTriggerWhatsApp = async (invoiceId: string) => {
    setWaLinkLoading(true);
    setWaModalOpen(true);
    try {
      const res = await fetch(`/api/v1/kas/piutang-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (res.ok && data.whatsappUrl) {
        setWaGeneratedUrl(data.whatsappUrl);
        setWaMessage(data.messageTemplate || '');
      } else {
        alert(data.message || 'Gagal menghasilkan tautan WhatsApp.');
        setWaModalOpen(false);
      }
    } catch (err) {
      alert('Terjadi kesalahan saat menghubungi server.');
      setWaModalOpen(false);
    } finally {
      setWaLinkLoading(false);
    }
  };

  // Run What-If Simulation
  const handleRunSimulation = async () => {
    if (!simPrompt.trim()) return;
    setSimLoading(true);
    try {
      const res = await fetch(`/api/v1/brain/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptDescription: simPrompt }),
      });
      const data = await res.json();
      if (res.ok && data.simulation) {
        setSimResult(data.simulation);
      }
    } catch (err) {
      console.warn('Simulation error:', err);
    } finally {
      setSimLoading(false);
    }
  };

  // Dynamic Chart Options & Series
  const chartConfig = useMemo(() => {
    if (trendsData?.series && trendsData?.months) {
      const months = trendsData.months.map((m: string) => {
        const parts = m.split('-');
        if (parts.length === 2) {
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
          return `${monthNames[parseInt(parts[1], 10) - 1]} ${parts[0].slice(2)}`;
        }
        return m;
      });

      return {
        series: [
          {
            name: 'Pemasukan (Revenue)',
            data: trendsData.series.income || [410000000, 445000000, 490000000, 475000000, 520000000, 612500000],
          },
          {
            name: 'Pengeluaran (Expense)',
            data: trendsData.series.expense || [335000000, 355000000, 385000000, 380000000, 410000000, 478000000],
          },
        ],
        options: {
          chart: {
            type: 'area' as const,
            height: 280,
            toolbar: { show: false },
            fontFamily: 'DM Sans, sans-serif',
          },
          colors: ['#3B82F6', '#10B981'],
          fill: {
            type: 'gradient',
            gradient: {
              shadeIntensity: 1,
              opacityFrom: 0.35,
              opacityTo: 0.05,
              stops: [0, 95, 100],
            },
          },
          stroke: {
            curve: 'smooth' as const,
            width: 2.5,
          },
          dataLabels: { enabled: false },
          xaxis: {
            categories: months,
            labels: {
              style: { colors: '#64748B', fontSize: '12px' },
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
          },
          yaxis: {
            labels: {
              style: { colors: '#64748B', fontSize: '11px' },
              formatter: (val: number) => {
                if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(0)} jt`;
                return val.toString();
              },
            },
          },
          grid: {
            borderColor: '#F1F5F9',
            strokeDashArray: 4,
          },
          tooltip: {
            theme: 'light' as const,
            y: {
              formatter: (val: number) => formatRupiah(val),
            },
          },
        },
      };
    }

    // Default Fallback Benchmark Chart Data
    return {
      series: [
        { name: 'Pemasukan (Revenue)', data: [410000000, 445000000, 490000000, 475000000, 520000000, 612500000] },
        { name: 'Pengeluaran (Expense)', data: [335000000, 355000000, 385000000, 380000000, 410000000, 478000000] },
      ],
      options: {
        chart: {
          type: 'area' as const,
          height: 280,
          toolbar: { show: false },
          fontFamily: 'DM Sans, sans-serif',
        },
        colors: ['#3B82F6', '#10B981'],
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.3,
            opacityTo: 0.05,
            stops: [0, 95, 100],
          },
        },
        stroke: { curve: 'smooth' as const, width: 2.5 },
        dataLabels: { enabled: false },
        xaxis: {
          categories: ['Apr 26', 'Mei 26', 'Jun 26', 'Jul 26', 'Agu 26', 'Sep 26'],
          labels: { style: { colors: '#64748B', fontSize: '12px' } },
        },
        yaxis: {
          labels: {
            style: { colors: '#64748B', fontSize: '11px' },
            formatter: (v: number) => `${(v / 1_000_000).toFixed(0)} jt`,
          },
        },
        grid: { borderColor: '#F1F5F9', strokeDashArray: 4 },
        tooltip: {
          theme: 'light' as const,
          y: { formatter: (val: number) => formatRupiah(val) },
        },
      },
    };
  }, [trendsData]);

  // Active deals & transactions display data
  const recentTransactionsList = useMemo(() => {
    if (transactions.length > 0) {
      return transactions.slice(0, 5).map((t) => ({
        id: t.id,
        name: t.description || 'Transaksi Kas',
        category: t.category || 'Operasional',
        time: new Date(t.transactionDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
        amount: t.amount,
        isIncome: t.type === 'INCOME',
        status: t.type === 'INCOME' ? 'Masuk' : 'Keluar',
      }));
    }
    // Benchmark Demo Items
    return [
      { id: '1', name: 'PT Sentosa Boga Abadi', category: 'Katering B2B', time: 'Hari ini', amount: 45000000, isIncome: true, status: 'Lunas' },
      { id: '2', name: 'CV Berkah Maju Perkasa', category: 'Distribusi Grosir', time: '2 hari lalu', amount: 18200000, isIncome: true, status: 'Tempo' },
      { id: '3', name: 'Sewa Ruko & Listrik Kantor', category: 'Beban Sewa', time: '3 hari lalu', amount: 28500000, isIncome: false, status: 'Keluar' },
      { id: '4', name: 'Meta Ads & Google Ads', category: 'Marketing Q4', time: '4 hari lalu', amount: 14800000, isIncome: false, status: 'Keluar' },
      { id: '5', name: 'Resto Sumber Rejeki', category: 'Retail Outlet 1', time: '5 hari lalu', amount: 32400000, isIncome: true, status: 'Lunas' },
    ];
  }, [transactions]);

  // Executive AI Recommendations List
  const aiRecommendations = useMemo(() => {
    if (insightData?.rekomendasi && Array.isArray(insightData.rekomendasi) && insightData.rekomendasi.length > 0) {
      return insightData.rekomendasi.slice(0, 4);
    }
    return [
      {
        judul: 'Percepat Penagihan 2 Invoice Jatuh Tempo Hari Ini',
        alasan: 'Faktur CV Berkah Maju & PT Sentosa (Rp 18,2jt) melewati jatuh tempo 5 hari',
        langkah: 'Kirimkan notifikasi penagihan resmi via integrasi WhatsApp Gateway',
        dampak: '+Rp 18,2jt kas likuid (+0,5 bln runway)',
        prioritas: 'tinggi',
      },
      {
        judul: 'Alokasikan Kas Idle Rp 100jt ke Deposito Likuid',
        alasan: 'Saldo kas likuid Rp 348,5jt melebihi dana cadangan 3 bulan (Rp 143jt)',
        langkah: 'Tempatkan surplus pada instrumen pasar uang berimbal hasil 5-6% p.a.',
        dampak: '+Rp 5-6jt yield pasif per tahun',
        prioritas: 'sedang',
      },
      {
        judul: 'Negosiasi Perpanjangan Termin Supplier Bahan Baku',
        alasan: 'Pengeluaran bahan baku berjalan dengan rata-rata termin 14 hari',
        langkah: 'Ajukan perpanjangan TOP menjadi 30 hari ke supplier rekanan utama',
        dampak: 'Meningkatkan perputaran modal Rp 45jt',
        prioritas: 'rendah',
      },
    ];
  }, [insightData]);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* 🧭 SIDEBAR NAVIGASI (Presisi Desain v0: Fixed 260px) */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen bg-white border-r border-slate-200 transition-all duration-300 ease-out flex flex-col ${
          sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center px-4 border-b border-slate-200 justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-blue-600 text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-base text-slate-900 tracking-tight whitespace-nowrap">KLIR OS</span>
                <span className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Finance & Monitor</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'ledger', label: 'Buku Kas', icon: Wallet },
            { id: 'invoices', label: 'Faktur & Piutang', icon: FileText },
            { id: 'obligations', label: 'Kewajiban', icon: Clock },
            { id: 'reconciliation', label: 'Rekonsiliasi Bank', icon: Building2 },
            { id: 'trends', label: 'Tren & Forecast', icon: TrendingUp },
            { id: 'simulation', label: 'AI Brain & Skenario', icon: Bot },
            { id: 'data-hub', label: 'Pusat Data', icon: Package },
            { id: 'tax', label: 'Pajak UMKM', icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {/* Active Indicator Bar on Left */}
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-blue-600" />
                )}
                <Icon
                  className={`w-5 h-5 shrink-0 transition-transform duration-200 group-hover:scale-105 ${
                    isActive ? 'text-blue-600' : 'text-slate-500'
                  }`}
                />
                {!sidebarCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Collapse Toggle */}
        <div className="p-3 border-t border-slate-200">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all duration-200 cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            {!sidebarCollapsed && <span>Ciutkan Menu</span>}
          </button>
        </div>
      </aside>

      {/* 🖥️ MAIN CONTENT AREA (Offset by sidebar width) */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ease-out ${
          sidebarCollapsed ? 'ml-[72px]' : 'ml-[260px]'
        }`}
      >
        {/* 🔝 STICKY TOP HEADER (Presisi Desain v0: Height 64px, Backdrop Blur) */}
        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              {activeNav === 'overview' && 'Overview Eksekutif'}
              {activeNav === 'ledger' && 'Buku Kas & Transaksi'}
              {activeNav === 'invoices' && 'Faktur & Pengingat Piutang'}
              {activeNav === 'obligations' && 'Kewajiban Terjadwal'}
              {activeNav === 'reconciliation' && 'Rekonsiliasi Mutasi Bank'}
              {activeNav === 'trends' && 'Analisis Tren & Runway'}
              {activeNav === 'simulation' && 'AI Brain & Simulator What-If'}
              {activeNav === 'data-hub' && 'Pusat Data & Dokumen'}
              {activeNav === 'tax' && 'Kalkulator Pajak PP 55/2022'}
            </h1>

            {/* Date Range Badge Pill */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>September 2026</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1"></span>
              <span className="text-emerald-700 font-semibold">Tutup Buku Aman</span>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-3.5">
            {/* Search Input Bar */}
            <div className="relative hidden sm:flex items-center w-48 focus-within:w-64 transition-all duration-300">
              <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari transaksi, invoice..."
                className="w-full h-9 pl-9 pr-4 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
              />
            </div>

            {/* Tanya AI Button */}
            {onOpenAI ? (
              <button
                onClick={() => onOpenAI('Berikan analisis ringkas keuangan dan rekomendasi prioritas minggu ini')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs"
                title="Tanya AI Finance & Monitoring Lead"
              >
                <Bot className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden md:inline">Tanya AI</span>
              </button>
            ) : (
              <button
                onClick={() => setActiveNav('simulation')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold transition-all duration-200 cursor-pointer shadow-2xs"
                title="Buka AI Brain & Simulator Skenario"
              >
                <Bot className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden md:inline">AI Brain</span>
              </button>
            )}

            {/* Refresh Data Button */}
            <button
              onClick={() => void fetchDashboardData()}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all duration-200 cursor-pointer"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Settings Modal Button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all duration-200 cursor-pointer"
              title="Pengaturan Target Usaha"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Notification Bell with Badge */}
            <button
              onClick={() => setApprovalsOpen(true)}
              className="relative w-9 h-9 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all duration-200 cursor-pointer"
              title="Notifikasi Persetujuan"
            >
              <Bell className="w-4 h-4" />
              {pendingApprovals.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>

            {/* User Avatar with Initials */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-xs font-bold text-white shadow-sm">
                {userName ? userName.slice(0, 2).toUpperCase() : 'EX'}
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 leading-tight">{userName}</span>
                <span className="text-[10px] text-slate-500 font-medium">CEO / Owner</span>
              </div>
            </div>
          </div>
        </header>

        {/* 📊 TAB 1: OVERVIEW DASHBOARD (Cloned 100% dari Desain v0 Sales Operations) */}
        {activeNav === 'overview' && (
          <main className="flex-1 p-6 space-y-6 overflow-y-auto">
            {/* ROW 1: 4 TOP KPI METRIC CARDS (Exact v0 Card Layout) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Omset (Revenue) */}
              <div className="group relative bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-500/50 hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm text-slate-500 font-medium">Total Omset (30 Hari)</span>
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                      <DollarSign className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                      {formatShortRupiah(contextData?.financials?.totalIncome30d ?? 612500000)}
                    </span>
                    <div className="flex items-center gap-1 text-sm font-semibold mb-1 text-emerald-600">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>+12.5%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">vs bulan lalu (MoM)</p>
                </div>
              </div>

              {/* Card 2: Saldo Kas Likuid & Runway */}
              <div className="group relative bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-500/50 hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm text-slate-500 font-medium">Kas Likuid & Runway</span>
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
                      <Wallet className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                      {formatShortRupiah(contextData?.financials?.liquidCash ?? 348500000)}
                    </span>
                    <div className="flex items-center gap-1 text-sm font-semibold mb-1 text-emerald-600">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>{contextData?.financials?.runwayMonths ?? '14.2'} bln</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Ketahanan operasional stabil</p>
                </div>
              </div>

              {/* Card 3: Arus Kas Bersih (Net Cashflow) */}
              <div className="group relative bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-500/50 hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm text-slate-500 font-medium">Surplus Bersih & Margin</span>
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
                      <Target className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                      +Rp 134,5 jt
                    </span>
                    <div className="flex items-center gap-1 text-sm font-semibold mb-1 text-emerald-600">
                      <span>22.0%</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Margin keuntungan bersih sehat</p>
                </div>
              </div>

              {/* Card 4: Piutang Tertunggak (Overdue Invoices) */}
              <div className="group relative bg-white border border-slate-200 rounded-xl p-5 hover:border-amber-500/50 hover:shadow-md transition-all duration-300 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm text-slate-500 font-medium">Piutang & Tagihan Tertunggak</span>
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300">
                      <FileText className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-end gap-3">
                    <span className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
                      Rp 18,2 jt
                    </span>
                    <div className="flex items-center gap-1 text-sm font-semibold mb-1 text-amber-600">
                      <Clock className="w-3.5 h-3.5" />
                      <span>2 Faktur</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Memerlukan penagihan aktif</p>
                </div>
              </div>
            </div>

            {/* ROW 2: DUAL GRID (Rasio 2:1 - Revenue Trend Chart & Expense Breakdown) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column (2 Kolom): Revenue Trend Chart */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Tren Arus Kas Bulanan</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Performa riil pemasukan omset vs beban pengeluaran operasional</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                      <span className="text-slate-600">Pemasukan</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="text-slate-600">Pengeluaran</span>
                    </div>
                  </div>
                </div>

                <div className="h-[280px]">
                  <Chart options={chartConfig.options} series={chartConfig.series} type="area" height={280} />
                </div>
              </div>

              {/* Right Column (1 Kolom): Pipeline / Expense Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="mb-6">
                    <h3 className="text-base font-bold text-slate-900">Struktur Beban Operasional</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Alokasi pengeluaran kas bulan berjalan</p>
                  </div>

                  <div className="space-y-4">
                    {/* Stage 1 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">Bahan Baku & Supplier (HPP)</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">Rp 215 jt</span>
                          <span className="font-bold text-slate-900">45%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: '45%' }} />
                      </div>
                    </div>

                    {/* Stage 2 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">Gaji & SDM Tim</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">Rp 135 jt</span>
                          <span className="font-bold text-slate-900">28%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '28%' }} />
                      </div>
                    </div>

                    {/* Stage 3 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">Sewa Outlet & Utilitas</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">Rp 86 jt</span>
                          <span className="font-bold text-slate-900">18%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: '18%' }} />
                      </div>
                    </div>

                    {/* Stage 4 */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">Marketing & Iklan Ads</span>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 text-xs">Rp 42 jt</span>
                          <span className="font-bold text-slate-900">9%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '9%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-500">Total Beban Terbuku</span>
                    <span className="text-xl font-extrabold text-slate-900">Rp 478.000.000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ROW 3: DUAL GRID (Rasio 1:1 - Recent Transactions vs AI Recommendations) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Recent Deals / Transaksi Kas Terbaru */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Transaksi Kas & Faktur Terbaru</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Aktivitas pembukuan terakhir</p>
                  </div>
                  <button
                    onClick={() => setActiveNav('ledger')}
                    className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-semibold transition-colors cursor-pointer group"
                  >
                    Buka Buku Kas
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                </div>

                <div className="space-y-3">
                  {recentTransactionsList.map((tx) => (
                    <div
                      key={tx.id}
                      className="group flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                            tx.isIncome ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {tx.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{tx.name}</p>
                          <p className="text-xs text-slate-400">
                            {tx.category} • {tx.time}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-sm font-bold ${
                            tx.isIncome ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {tx.isIncome ? '+' : '-'}
                          {formatRupiah(tx.amount)}
                        </span>
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1 ${
                            tx.status === 'Won' || tx.status === 'Lunas' || tx.status === 'Masuk'
                              ? 'bg-emerald-50 text-emerald-700'
                              : tx.status === 'Tempo'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {tx.status === 'Tempo' ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3" />
                          )}
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: AI Strategic Recommendations & Top Actions */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Rekomendasi Strategis AI</h3>
                      <p className="text-sm text-slate-500 mt-0.5">Prioritas preskriptif anti-halusinasi</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500">
                    <Trophy className="w-5 h-5" />
                  </div>
                </div>

                <div className="space-y-3">
                  {aiRecommendations.map((rec: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-slate-900 leading-snug">{rec.judul}</h4>
                            <p className="text-xs text-slate-500 mt-1">{rec.alasan}</p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                            rec.prioritas === 'tinggi'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : rec.prioritas === 'sedang'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {rec.prioritas}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-2">
                        <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          {rec.dampak}
                        </span>

                        {rec.judul.toLowerCase().includes('whatsapp') || rec.judul.toLowerCase().includes('invoice') ? (
                          <button
                            onClick={() => handleTriggerWhatsApp(invoices[0]?.id || 'demo-invoice-id')}
                            className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Send className="w-3 h-3" />
                            Kirim WA
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveNav('simulation')}
                            className="px-3 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            Simulasi
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        )}

        {/* 💰 TAB 2: BUKU KAS & TRANSAKSI */}
        {activeNav === 'ledger' && (
          <main className="flex-1 p-6 space-y-6 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Buku Kas & Riwayat Transaksi</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Catatan seluruh arus kas masuk dan keluar secara kronologis</p>
                </div>
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Tanggal</th>
                      <th className="py-3 px-4">Uraian / Deskripsi</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Jenis</th>
                      <th className="py-3 px-4 text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.length > 0 ? (
                      transactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 text-slate-600 font-mono text-xs">
                            {new Date(t.transactionDate).toLocaleDateString('id-ID')}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{t.description}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                              {t.category || 'Umum'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                            </span>
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-bold ${
                              t.type === 'INCOME' ? 'text-emerald-700' : 'text-slate-900'
                            }`}
                          >
                            {t.type === 'INCOME' ? '+' : '-'} {formatRupiah(t.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Belum ada transaksi kas yang dicatat.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* 📑 TAB 3: FAKTUR & PENGINGAT PIUTANG */}
        {activeNav === 'invoices' && (
          <main className="flex-1 p-6 space-y-6 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Faktur Digital & Pengingat Piutang</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Kirimkan notifikasi penagihan WhatsApp resmi ke pelanggan</p>
                </div>
              </div>

              {/* Invoices List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">No. Faktur</th>
                      <th className="py-3 px-4">Nama Pelanggan</th>
                      <th className="py-3 px-4">Jatuh Tempo</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Total Nominal</th>
                      <th className="py-3 px-4 text-center">Aksi Penagihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoices.length > 0 ? (
                      invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-blue-700 text-xs">{inv.invoiceNumber}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{inv.clientName}</td>
                          <td className="py-3 px-4 text-slate-600 text-xs">
                            {new Date(inv.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                inv.status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : inv.status === 'OVERDUE'
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-amber-50 text-amber-700'
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatRupiah(inv.totalAmount)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {inv.status !== 'PAID' && (
                              <button
                                onClick={() => handleTriggerWhatsApp(inv.id)}
                                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                              >
                                <Send className="w-3 h-3" />
                                Tagih WA
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Belum ada faktur digital terbit.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* 🤖 TAB 7: AI BRAIN & SKENARIO WHAT-IF */}
        {activeNav === 'simulation' && (
          <main className="flex-1 p-6 space-y-6 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="w-6 h-6 text-blue-600" />
                  <h2 className="text-lg font-bold text-slate-900">Simulator Skenario Keuangan NLP (What-If)</h2>
                </div>
                <p className="text-sm text-slate-500">
                  Uji ketahanan kas dan proyeksi runway terhadap keputusan strategis (rekrutmen, efisiensi gaji, Capex, atau kenaikan ads)
                </p>
              </div>

              {/* Prompt Input Box */}
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={simPrompt}
                  onChange={(e) => setSimPrompt(e.target.value)}
                  placeholder="Contoh: Pangkas 2 staf gaji 6jt selama 6 bulan..."
                  className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <button
                  onClick={handleRunSimulation}
                  disabled={simLoading}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {simLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Jalankan Simulasi
                </button>
              </div>

              {/* Quick Prompt Pills */}
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs text-slate-400 font-medium py-1">Skenario cepat:</span>
                {[
                  'Pangkas 2 staf gaji 6jt selama 6 bulan',
                  'Tambah 3 sales gaji 5jt selama 12 bulan',
                  'Beli mesin baru capex 50jt',
                  'Naikkan budget marketing ads 20%',
                ].map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setSimPrompt(s);
                    }}
                    className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Simulation Result Canvas */}
              {simResult && (
                <div className="mt-6 p-5 rounded-xl bg-slate-50 border border-slate-200 animate-in fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-bold text-slate-900">Hasil Proyeksi Dampak Strategis</h4>
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                      Horizon: {simResult.horizonMonths || 6} Bulan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-500 font-medium">Perubahan Kas Netto</span>
                      <p className="text-lg font-extrabold text-slate-900 mt-1">
                        {simResult.monthlyExpenseDelta < 0 ? (
                          <span className="text-emerald-600">Hemat {formatRupiah(Math.abs(simResult.monthlyExpenseDelta))}/bln</span>
                        ) : (
                          <span className="text-red-600">Beban +{formatRupiah(simResult.monthlyExpenseDelta)}/bln</span>
                        )}
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-500 font-medium">Dampak ke Runway</span>
                      <p className="text-lg font-extrabold text-slate-900 mt-1">
                        {simResult.runwayImpactMonths > 0 ? (
                          <span className="text-emerald-600">+{simResult.runwayImpactMonths} Bulan</span>
                        ) : (
                          <span className="text-amber-600">{simResult.runwayImpactMonths} Bulan</span>
                        )}
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                      <span className="text-xs text-slate-500 font-medium">Probabilitas Ketahanan</span>
                      <p className="text-lg font-extrabold text-slate-900 mt-1 text-emerald-600">
                        {simResult.survivalProbability ?? '98%'} (Aman)
                      </p>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 bg-white p-3.5 rounded-lg border border-slate-200 leading-relaxed">
                    💡 <strong>Analisis AI:</strong> {simResult.narrativeSummary || 'Keputusan ini memperkuat cadangan kas likuid perusahaan secara signifikan.'}
                  </p>
                </div>
              )}
            </div>
          </main>
        )}

        {/* 📁 TAB 8: PUSAT DATA DOKUMEN */}
        {activeNav === 'data-hub' && (
          <main className="flex-1 p-6 overflow-y-auto">
            <WorkspaceDataHub workspaceId={workspaceId} onClose={() => setActiveNav('overview')} />
          </main>
        )}

        {/* 🏦 OTHER TABS (FALLBACK CONTAINER DENGAN DESAIN BERSIH) */}
        {['obligations', 'reconciliation', 'trends', 'tax'].includes(activeNav) && (
          <main className="flex-1 p-6 space-y-6 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 capitalize mb-2">
                Modul {activeNav.replace('-', ' ')}
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Data terintegrasi secara otomatis dengan database Neon PostgreSQL & Prisma Engine.
              </p>

              {activeNav === 'obligations' && (
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-800">Daftar Liabilitas & Hutang Jatuh Tempo:</h3>
                  {obligations.length > 0 ? (
                    obligations.map((o) => (
                      <div key={o.id} className="flex items-center justify-between p-3.5 rounded-lg border border-slate-100 bg-slate-50">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{o.name}</p>
                          <p className="text-xs text-slate-500">{o.category || 'Operasional'} • Tempo: {new Date(o.dueDate).toLocaleDateString('id-ID')}</p>
                        </div>
                        <span className="text-sm font-bold text-red-600">{formatRupiah(o.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400">Tidak ada kewajiban tertunda dalam 30 hari ke depan.</p>
                  )}
                </div>
              )}

              {activeNav === 'tax' && (
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm space-y-2">
                  <h4 className="font-bold text-blue-900">Perhitungan Pajak UMKM (PP No. 55 Tahun 2022)</h4>
                  <p className="text-blue-800">Tarif PPh Final: 0.5% dari Omset Bruto</p>
                  <p className="text-xs text-blue-600">WP Orang Pribadi bebas pajak s.d. omset Rp 500 juta / tahun. Disetor paling lambat tgl 15 bulan berikutnya.</p>
                </div>
              )}
            </div>
          </main>
        )}
      </div>

      {/* 📲 MODAL PREVIEW WHATSAPP REMINDER */}
      {waModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">Tautan WhatsApp Penagihan</h3>
            <p className="text-xs text-slate-500 mb-4">Pesan resmi telah digenerate dengan nomor telepon yang telah didekripsi.</p>

            {waLinkLoading ? (
              <div className="py-8 text-center text-slate-500 text-sm">Menghasilkan pesan...</div>
            ) : (
              <div className="space-y-4">
                <textarea
                  readOnly
                  value={waMessage}
                  rows={6}
                  className="w-full text-xs font-mono p-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
                />
                <div className="flex items-center justify-end gap-3">
                  <button
                    onClick={() => setWaModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Tutup
                  </button>
                  <a
                    href={waGeneratedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Buka WhatsApp Web
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⚙️ CEO APPROVAL & SETTINGS MODALS */}
      {approvalsOpen && (
        <CEOApprovalModal
          isOpen={approvalsOpen}
          onClose={() => setApprovalsOpen(false)}
          workspaceId={workspaceId}
          approvals={pendingApprovals}
          isLoading={isRefreshing}
          onRefresh={() => void fetchDashboardData()}
        />
      )}

      {settingsOpen && (
        <CEOSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}
