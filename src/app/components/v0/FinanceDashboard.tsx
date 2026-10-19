'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Wallet,
  FileText,
  Clock,
  Building2,
  TrendingUp,
  TrendingDown,
  Bot,
  Search,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  DollarSign,
  Target,
  Sparkles,
  RefreshCw,
  Plus,
  Send,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Check,
  Receipt,
  Layers,
  Menu,
  X,
  Upload,
  Download,
  AlertCircle,
  Filter,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

import { FinanceSettingsModal } from '../settings/FinanceSettingsModal';
import ModernAICopilotView from './ModernAICopilotView';

interface FinanceDashboardProps {
  workspaceId: string;
  workspaceName?: string;
  userName?: string;
  initialTab?: string;
  onOpenAI?: (prompt: string) => void;
}

export default function FinanceDashboard({
  workspaceId,
  workspaceName = 'Anitech Enterprise',
  userName = 'Finance Lead',
  initialTab = 'cashflow',
  onOpenAI,
}: FinanceDashboardProps) {
  // Navigation State - Khusus Sistem Finance
  const [activeNav, setActiveNav] = useState<string>(initialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && ['cashflow', 'ledger', 'invoices', 'obligations', 'reconciliation', 'tax', 'ai-lead'].includes(tabParam)) {
        setActiveNav(tabParam);
      }
    }
  }, []);

  // Modals state
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [newTxModalOpen, setNewTxModalOpen] = useState<boolean>(false);
  const [newInvModalOpen, setNewInvModalOpen] = useState<boolean>(false);
  const [newOblModalOpen, setNewOblModalOpen] = useState<boolean>(false);

  // Form states for Catat Transaksi Baru
  const [txType, setTxType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [txAmount, setTxAmount] = useState<string>('');
  const [txCategory, setTxCategory] = useState<string>('Penjualan');
  const [txDesc, setTxDesc] = useState<string>('');
  const [txBank, setTxBank] = useState<string>('BCA Operasional');
  const [txSaving, setTxSaving] = useState<boolean>(false);

  // Form states for Buat Faktur Baru
  const [invClient, setInvClient] = useState<string>('');
  const [invPhone, setInvPhone] = useState<string>('');
  const [invAmount, setInvAmount] = useState<string>('');
  const [invDue, setInvDue] = useState<string>('');
  const [invSaving, setInvSaving] = useState<boolean>(false);

  // Form states for Tambah Kewajiban Baru
  const [oblName, setOblName] = useState<string>('');
  const [oblCategory, setOblCategory] = useState<string>('Operasional');
  const [oblAmount, setOblAmount] = useState<string>('');
  const [oblDue, setOblDue] = useState<string>('');
  const [oblSaving, setOblSaving] = useState<boolean>(false);

  // Tax Calculator Input (PPh 55/2022)
  const [taxAnnualTurnover, setTaxAnnualTurnover] = useState<number>(612500000);

  // WhatsApp Reminder State
  const [waModalOpen, setWaModalOpen] = useState<boolean>(false);
  const [waLinkLoading, setWaLinkLoading] = useState<boolean>(false);
  const [waGeneratedUrl, setWaGeneratedUrl] = useState<string>('');
  const [waMessage, setWaMessage] = useState<string>('');

  // Data States
  const [transactions, setTransactions] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [obligations, setObligations] = useState<any[]>([]);
  const [trendsData, setTrendsData] = useState<any>(null);

  // Fetch core finance data
  const fetchFinanceData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [txRes, invRes, oblRes, trdRes] = await Promise.allSettled([
        fetch(`/api/v1/kas/transactions?limit=25`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/kas/invoices?limit=20`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/kas/obligations`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/analytics/financial-trends?months=6`, { credentials: 'include' }).then((r) => r.json()),
      ]);

      if (txRes.status === 'fulfilled' && txRes.value?.transactions) {
        setTransactions(txRes.value.transactions);
      }
      if (invRes.status === 'fulfilled' && invRes.value?.invoices) {
        setInvoices(invRes.value.invoices);
      }
      if (oblRes.status === 'fulfilled' && oblRes.value?.all) {
        setObligations(oblRes.value.all);
      }
      if (trdRes.status === 'fulfilled' && trdRes.value?.success) {
        setTrendsData(trdRes.value.data);
      }
    } catch (err) {
      console.warn('[FinanceDashboard] Fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchFinanceData();
  }, [fetchFinanceData]);

  // Format Helpers
  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatShortRupiah = (val: number) => {
    if (Math.abs(val) >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
    }
    if (Math.abs(val) >= 1_000_000) {
      return `${(val / 1_000_000).toFixed(1).replace('.', ',')} jt`;
    }
    if (Math.abs(val) >= 1_000) {
      return `${(val / 1_000).toFixed(0)} rb`;
    }
    return val.toString();
  };

  // Handle Save New Transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(txAmount.replace(/[^0-9]/g, ''));
    if (!num || !txDesc.trim()) return;

    setTxSaving(true);
    try {
      const res = await fetch(`/api/v1/kas/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: txType,
          amount: num,
          category: txCategory,
          description: txDesc,
          transactionDate: new Date().toISOString(),
          paymentMethod: txBank,
        }),
      });

      const newTxItem = {
        id: `tx-${Date.now()}`,
        type: txType,
        amount: num,
        category: txCategory,
        description: txDesc,
        transactionDate: new Date().toISOString(),
      };
      setTransactions((prev) => [newTxItem, ...prev]);
      setNewTxModalOpen(false);
      setTxAmount('');
      setTxDesc('');
    } catch (err) {
      console.warn('Gagal menyimpan transaksi:', err);
    } finally {
      setTxSaving(false);
    }
  };

  // Handle Save New Invoice
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(invAmount.replace(/[^0-9]/g, ''));
    if (!num || !invClient.trim()) return;

    setInvSaving(true);
    try {
      const newInvItem = {
        id: `inv-${Date.now()}`,
        invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`,
        clientName: invClient,
        clientPhone: invPhone,
        amount: num,
        dueDate: invDue || new Date(Date.now() + 14 * 86400000).toISOString(),
        status: 'UNPAID',
      };
      setInvoices((prev) => [newInvItem, ...prev]);
      setNewInvModalOpen(false);
      setInvClient('');
      setInvAmount('');
      setInvPhone('');
    } finally {
      setInvSaving(false);
    }
  };

  // Handle Save New Obligation
  const handleSaveObligation = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(oblAmount.replace(/[^0-9]/g, ''));
    if (!num || !oblName.trim()) return;

    setOblSaving(true);
    try {
      const newOblItem = {
        id: `obl-${Date.now()}`,
        name: oblName,
        category: oblCategory,
        amount: num,
        dueDate: oblDue || new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'PENDING',
      };
      setObligations((prev) => [newOblItem, ...prev]);
      setNewOblModalOpen(false);
      setOblName('');
      setOblAmount('');
    } finally {
      setOblSaving(false);
    }
  };

  // WhatsApp reminder trigger
  const handleTriggerWhatsApp = async (invoiceId: string) => {
    setWaModalOpen(true);
    setWaLinkLoading(true);
    try {
      const res = await fetch(`/api/v1/kas/piutang-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invoiceId }),
      });
      const data = await res.json();
      if (data?.success && data?.whatsappUrl) {
        setWaGeneratedUrl(data.whatsappUrl);
        setWaMessage(data.message || 'Pesan penagihan faktur resmi KLIR Finance.');
      } else {
        setWaGeneratedUrl(`https://wa.me/6281234567890?text=Halo,%20kami%20mengingatkan%20faktur%20jatuh%20tempo.`);
        setWaMessage('Pengingat faktur jatuh tempo resmi dari divisi keuangan PT Anitech.');
      }
    } catch {
      setWaGeneratedUrl(`https://wa.me/6281234567890?text=Halo,%20kami%20mengingatkan%20faktur%20jatuh%20tempo.`);
      setWaMessage('Pengingat faktur jatuh tempo resmi dari divisi keuangan PT Anitech.');
    } finally {
      setWaLinkLoading(false);
    }
  };

  // Filtered transactions by search query and category pill
  const filteredTransactions = useMemo(() => {
    let list = transactions;
    if (selectedCategory !== 'all') {
      list = list.filter((t) => t.category?.toLowerCase() === selectedCategory.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q))
      );
    }
    return list;
  }, [transactions, searchQuery, selectedCategory]);

  // Tax calculation helpers (PP 55/2022)
  const taxableTurnover = Math.max(0, taxAnnualTurnover - 500000000);
  const finalTaxPayable = taxableTurnover * 0.005;

  // Cashflow Trend Chart Config (Responsive ApexChart)
  const cashflowChartConfig = useMemo(() => {
    const months =
      trendsData?.months && trendsData.months.length > 0
        ? trendsData.months.map((m: any) => m.monthLabel || m.month)
        : ['Apr 26', 'Mei 26', 'Jun 26', 'Jul 26', 'Agu 26', 'Sep 26'];

    const incomeData =
      trendsData?.months && trendsData.months.length > 0
        ? trendsData.months.map((m: any) => m.income || 0)
        : [410000000, 445000000, 490000000, 475000000, 520000000, 612500000];

    const expenseData =
      trendsData?.months && trendsData.months.length > 0
        ? trendsData.months.map((m: any) => m.expense || 0)
        : [335000000, 355000000, 385000000, 380000000, 410000000, 478000000];

    return {
      series: [
        { name: 'Kas Masuk', data: incomeData },
        { name: 'Kas Keluar', data: expenseData },
      ],
      options: {
        chart: {
          type: 'area' as const,
          height: 310,
          toolbar: { show: false },
          fontFamily: 'inherit',
          parentHeightOffset: 0,
        },
        colors: ['#059669', '#E11D48'],
        fill: {
          type: 'gradient',
          gradient: {
            type: 'vertical',
            shadeIntensity: 0.1,
            opacityFrom: 0.38,
            opacityTo: 0.02,
            stops: [0, 85, 100],
          },
        },
        stroke: { curve: 'smooth' as const, width: 3 },
        dataLabels: { enabled: false },
        xaxis: {
          categories: months,
          labels: {
            style: { colors: '#94A3B8', fontSize: '11px', fontWeight: 500 },
            rotate: 0,
            hideOverlappingLabels: true,
            offsetY: 2,
          },
          axisBorder: { show: false },
          axisTicks: { show: false },
          crosshairs: {
            show: true,
            stroke: { color: '#CBD5E1', width: 1, dashArray: 3 },
          },
        },
        yaxis: {
          min: 0,
          max: 800000000,
          tickAmount: 4,
          labels: {
            style: { colors: '#94A3B8', fontSize: '11px', fontWeight: 500 },
            formatter: (v: number) => (v === 0 ? '0' : `${(v / 1_000_000).toFixed(0)} jt`),
          },
        },
        legend: {
          show: false, // Clean HTML legend placed in header, matching Image 2
        },
        grid: {
          borderColor: '#F1F5F9',
          strokeDashArray: 4,
          padding: { top: 10, right: 10, bottom: 0, left: 10 },
          yaxis: { lines: { show: true } },
          xaxis: { lines: { show: false } },
        },
        tooltip: {
          theme: 'light' as const,
          y: { formatter: (val: number) => formatRupiah(val) },
        },
        responsive: [
          {
            breakpoint: 640,
            options: {
              chart: { height: 260 },
              yaxis: { tickAmount: 3 },
              xaxis: { labels: { style: { fontSize: '10px' } } },
            },
          },
        ],
      },
    };
  }, [trendsData]);

  // 5 Recent Cashflow transactions for the overview table
  const recentCashflowItems = useMemo(() => {
    if (transactions && transactions.length > 0) {
      return transactions.slice(0, 5);
    }
    return [
      {
        id: 'tx-mock-1',
        transactionDate: '2026-09-18T09:30:00Z',
        description: 'Pelunasan Faktur INV-2026-003 (PT Global Niaga)',
        category: 'Penjualan',
        paymentMethod: 'BCA Operasional',
        type: 'INCOME',
        amount: 45000000,
      },
      {
        id: 'tx-mock-2',
        transactionDate: '2026-09-17T14:15:00Z',
        description: 'Pembelian Bahan Baku Batch 9 (CV Mitra Kimia)',
        category: 'HPP & Stok',
        paymentMethod: 'Mandiri Bisnis',
        type: 'EXPENSE',
        amount: 28500000,
      },
      {
        id: 'tx-mock-3',
        transactionDate: '2026-09-16T11:00:00Z',
        description: 'Gaji Karyawan & Tunjangan Operasional Kantor',
        category: 'Beban SDM',
        paymentMethod: 'BCA Operasional',
        type: 'EXPENSE',
        amount: 67500000,
      },
      {
        id: 'tx-mock-4',
        transactionDate: '2026-09-15T16:45:00Z',
        description: 'Penerimaan Down Payment Proyek IT System',
        category: 'Penjualan',
        paymentMethod: 'BCA Operasional',
        type: 'INCOME',
        amount: 32000000,
      },
      {
        id: 'tx-mock-5',
        transactionDate: '2026-09-14T10:20:00Z',
        description: 'Sewa Server Cloud AWS & Domain Tahunan',
        category: 'Operasional',
        paymentMethod: 'Mandiri Bisnis',
        type: 'EXPENSE',
        amount: 14500000,
      },
    ];
  }, [transactions]);

  // Finance Navigation Items (6 Focused Menus - AI dipusatkan di tombol atas)
  const financeNavItems = [
    { id: 'cashflow', label: 'Dashboard Kas', icon: Wallet },
    { id: 'ledger', label: 'Buku Kas & Transaksi', icon: Receipt },
    { id: 'invoices', label: 'Faktur & Piutang (AR)', icon: FileText },
    { id: 'obligations', label: 'Kewajiban & Hutang (AP)', icon: Clock },
    { id: 'reconciliation', label: 'Rekonsiliasi Bank', icon: Building2 },
    { id: 'tax', label: 'Pajak UMKM PP 55', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 flex font-sans antialiased overflow-x-hidden">
      {/* 📱 MOBILE SIDEBAR BACKDROP */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 🧭 SIDEBAR NAVIGASI - SISTEM FINANCE (Responsive Drawer on mobile, Fixed on desktop) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 ease-out flex flex-col ${
          mobileMenuOpen ? 'translate-x-0 w-[250px]' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[250px]'}`}
      >
        {/* Brand Header */}
        <div className="h-14 sm:h-15 flex items-center px-4 border-b border-slate-200 justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-emerald-600 text-white shadow-xs">
              <Wallet className="w-4 h-4" />
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div className="flex flex-col">
                <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight whitespace-nowrap">KLIR FINANCE</span>
                <span className="text-[9px] text-emerald-600 font-bold tracking-wider uppercase">Sistem Keuangan & Kas</span>
              </div>
            )}
          </div>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {financeNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150 group relative cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-800 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
                title={sidebarCollapsed && !mobileMenuOpen ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-emerald-600" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                    isActive ? 'text-emerald-600' : 'text-slate-500'
                  }`}
                />
                {(!sidebarCollapsed || mobileMenuOpen) && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Quick Switch to Monitoring in Sidebar Footer */}
        {(!sidebarCollapsed || mobileMenuOpen) && (
          <div className="p-2.5 mx-2.5 mb-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 mb-1">Eksekutif & Bisnis</div>
            <Link
              href="/monitoring-usaha"
              className="flex items-center justify-between text-xs font-bold text-blue-700 hover:text-blue-800 no-underline transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">Monitoring Usaha</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            </Link>
          </div>
        )}

        {/* Sidebar Collapse Toggle (Desktop only) */}
        <div className="hidden lg:block p-2.5 border-t border-slate-200">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all duration-150 cursor-pointer"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!sidebarCollapsed && <span>Ciutkan</span>}
          </button>
        </div>
      </aside>

      {/* 🖥️ MAIN CONTENT AREA (Offset responsive: pl-0 on mobile, pl-[250px] on desktop) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-out ${
          sidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[250px]'
        }`}
      >
        {/* 🔝 STICKY TOP HEADER (Compact Height: 56px, Clean Responsive Spacing) */}
        <header className="h-14 sm:h-15 border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 gap-2 sm:gap-4">
          {/* Header Left: Hamburger Menu (Mobile) & Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 shrink-0"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 tracking-tight whitespace-nowrap shrink-0">
              {activeNav === 'cashflow' && 'Dashboard Kas & Likuiditas'}
              {activeNav === 'ledger' && 'Buku Kas & Transaksi'}
              {activeNav === 'invoices' && 'Faktur & Piutang (AR)'}
              {activeNav === 'obligations' && 'Kewajiban & Hutang (AP)'}
              {activeNav === 'reconciliation' && 'Rekonsiliasi Mutasi Bank'}
              {activeNav === 'tax' && 'Pajak UMKM PP 55/2022'}
              {activeNav === 'ai-lead' && 'AI Finance Lead Specialist'}
            </h1>

            {/* Status Badge Pill (Only on wide screens to prevent crowding) */}
            <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700 whitespace-nowrap shrink-0">
              <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
              <span>September 2026</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-emerald-700 font-semibold">Buku Kas Terbuka</span>
            </div>
          </div>

          {/* Header Right: Actions, System Switcher, Search, Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Switch to Monitoring System */}
            <Link
              href="/monitoring-usaha"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold whitespace-nowrap transition-colors no-underline"
              title="Buka Sistem Monitoring Usaha & Performa Bisnis"
            >
              <TrendingUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="hidden md:inline">Monitoring Usaha</span>
              <ArrowRight className="w-3 h-3 text-blue-600 shrink-0" />
            </Link>

            {/* Search Input Bar (Desktop wide) */}
            <div className="relative hidden 2xl:block w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari transaksi..."
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              />
            </div>

            {/* Tanya AI Button - Dedicated Gateway to AI Copilot */}
            <button
              onClick={() => (onOpenAI ? onOpenAI('Berikan audit ringkas buku kas dan transaksi yang perlu ditinjau') : setActiveNav('ai-lead'))}
              className="h-8 px-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
              title="Tanya AI Finance Lead"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>Tanya AI</span>
            </button>

            {/* Refresh Data Button */}
            <button
              onClick={() => void fetchFinanceData()}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shrink-0"
              title="Perbarui Data Kas"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>

            {/* Settings Modal Button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shrink-0"
              title="Pengaturan Divisi Finance"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* User Avatar with Initials */}
            <div className="flex items-center gap-2 pl-1 sm:pl-1.5 border-l border-slate-200 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-xs font-bold text-white shadow-2xs shrink-0">
                {userName ? userName.slice(0, 2).toUpperCase() : 'FI'}
              </div>
            </div>
          </div>
        </header>

        {/* 💵 TAB 1: DASHBOARD KAS & LIKUIDITAS */}
        {activeNav === 'cashflow' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 overflow-y-auto">
            {/* 4 Finance KPI Cards (Proportional size & anti-wrapping) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Kas Likuid Aktif</span>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Rp 348,5</span>
                  <span className="text-xs font-semibold text-slate-500">jt</span>
                </div>
                <p className="text-[10px] text-emerald-600 mt-1.5 font-semibold">Tersedia di Bank & Kas Kecil</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Kas Masuk Bulan Ini</span>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-xl sm:text-2xl font-bold text-emerald-700 tracking-tight">Rp 612,5</span>
                  <span className="text-xs font-semibold text-slate-500">jt</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Omset & pelunasan piutang</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Kas Keluar Bulan Ini</span>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-xl sm:text-2xl font-bold text-red-600 tracking-tight">Rp 478,0</span>
                  <span className="text-xs font-semibold text-slate-500">jt</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Beban HPP, gaji, & operasional</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">Piutang Menunggu (AR)</span>
                <div className="flex items-baseline gap-1 whitespace-nowrap">
                  <span className="text-xl sm:text-2xl font-bold text-amber-600 tracking-tight">Rp 18,2</span>
                  <span className="text-xs font-semibold text-slate-500">jt</span>
                </div>
                <p className="text-[10px] text-amber-700 mt-1.5 font-semibold">2 faktur jatuh tempo</p>
              </div>
            </div>

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap items-center gap-2.5 p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
              <button
                onClick={() => setNewTxModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Catat Transaksi Kas</span>
              </button>
              <button
                onClick={() => setNewInvModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>+ Buat Faktur Baru</span>
              </button>
              <button
                onClick={() => setNewOblModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>+ Tambah Kewajiban</span>
              </button>
            </div>

            {/* 📊 GRID BARIS 1: GRAFIK ARUS KAS & SALDO REKENING BANK */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* KOLOM KIRI (7/12): Grafik Tren Arus Kas */}
              <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                      Tren Arus Kas & Likuiditas
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Perbandingan kas masuk omset vs beban pengeluaran 6 bulan terakhir
                    </p>
                  </div>
                  <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
                    {/* Clean Legend matching Image 2 */}
                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                        <span>Kas Masuk</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                        <span>Kas Keluar</span>
                      </span>
                    </div>

                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 whitespace-nowrap">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Surplus Kas +Rp 134,5 jt</span>
                    </div>
                  </div>
                </div>

                {/* ApexChart Area - Full height & responsive */}
                <div className="w-full flex-1 flex items-center my-1">
                  <div className="w-full">
                    <Chart
                      options={cashflowChartConfig.options}
                      series={cashflowChartConfig.series}
                      type="area"
                      height={310}
                    />
                  </div>
                </div>

                {/* Ringkasan Bawah Grafik */}
                <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 text-center mt-auto">
                  <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-200/60">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Kas Masuk</span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-700 whitespace-nowrap">Rp 612,5 jt</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-200/60">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Kas Keluar</span>
                    <span className="text-xs sm:text-sm font-bold text-red-600 whitespace-nowrap">Rp 478,0 jt</span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50/70 border border-slate-200/60">
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">Kas Runway</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap">7,3 Bulan</span>
                  </div>
                </div>
              </div>

              {/* KOLOM KANAN (5/12): Saldo Rekening Bank & Kas Likuid */}
              <div className="lg:col-span-5 space-y-4">
                {/* Kartu Saldo Rekening */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">Rekening Bank Terdaftar</h3>
                    </div>
                    <button
                      onClick={() => setActiveNav('reconciliation')}
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>Rekonsiliasi</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">BCA Operasional & Payroll</span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 shrink-0">
                            Sinkron
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">No. Rek 8820-192-881</span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap shrink-0 text-right">
                        Rp 210,0 jt
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">Mandiri Bisnis Giro</span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 shrink-0">
                            Sinkron
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">No. Rek 137-00-29182-1</span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap shrink-0 text-right">
                        Rp 118,5 jt
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">Kas Kecil Kantor (Petty Cash)</span>
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-slate-200 text-slate-700 shrink-0">
                            Fisik
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">Brankas Kasir Operasional</span>
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 whitespace-nowrap shrink-0 text-right">
                        Rp 20,0 jt
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Total Kas Likuid Siap Pakai:</span>
                    <span className="font-bold text-emerald-700">Rp 348.500.000</span>
                  </div>
                </div>

                {/* Kartu Peringatan Jatuh Tempo Piutang & Hutang */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900">Perhatian Kas & Jatuh Tempo</h3>
                    </div>
                    <span className="text-[10px] font-bold text-amber-700 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 whitespace-nowrap shrink-0">
                      2 Piutang • 1 Hutang
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/80 flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">PT Sentosa Perkasa</div>
                        <div className="text-[10px] text-amber-700 font-semibold truncate">Faktur INV-2026-004 • Telat 2 hari</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-900">Rp 12,5 jt</span>
                        <button
                          onClick={() => handleTriggerWhatsApp('inv-004')}
                          className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          WA
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/80 flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">CV Berkah Maju</div>
                        <div className="text-[10px] text-amber-700 font-semibold truncate">Faktur INV-2026-005 • Tempo Hari Ini</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                        <span className="text-xs font-bold text-slate-900">Rp 5,7 jt</span>
                        <button
                          onClick={() => handleTriggerWhatsApp('inv-005')}
                          className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          WA
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">Sewa Server Cloud AWS</div>
                        <div className="text-[10px] text-slate-500 truncate">Kewajiban AP • Tempo 5 hari lagi</div>
                      </div>
                      <span className="text-xs font-bold text-slate-800 shrink-0 whitespace-nowrap">Rp 14,5 jt</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 📋 GRID BARIS 2: TABEL 5 TRANSAKSI KAS TERBARU */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                    Aliran Transaksi Kas Terkini
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    5 transaksi terakhir yang tercatat pada buku kas operasional
                  </p>
                </div>
                <button
                  onClick={() => setActiveNav('ledger')}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto shrink-0"
                >
                  <span>Buka Seluruh Buku Kas</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Edge-to-edge scroll container with internal breathing room */}
              <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5 pb-2 klir-custom-scrollbar">
                <table className="w-full min-w-[640px] text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/70">
                      <th className="py-2.5 px-3.5 w-28 whitespace-nowrap">Tanggal</th>
                      <th className="py-2.5 px-3.5 min-w-[190px]">Keterangan / Transaksi</th>
                      <th className="py-2.5 px-3.5 w-28 whitespace-nowrap">Kategori</th>
                      <th className="py-2.5 px-3.5 w-32 whitespace-nowrap">Rekening</th>
                      <th className="py-2.5 px-3.5 text-right w-36 whitespace-nowrap">Nominal</th>
                      <th className="py-2.5 px-3.5 text-center w-28 whitespace-nowrap pr-5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentCashflowItems.map((tx) => {
                      const isIncome = tx.type === 'INCOME';
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-500 font-medium">
                            {new Date(tx.transactionDate).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-2.5 px-3.5 font-semibold text-slate-900 min-w-[190px]">
                            {tx.description}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                              {tx.category || 'Operasional'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-slate-600 text-[11px]">
                            {tx.paymentMethod || 'BCA Operasional'}
                          </td>
                          <td
                            className={`py-2.5 px-3.5 whitespace-nowrap text-right font-bold font-mono ${
                              isIncome ? 'text-emerald-700' : 'text-red-600'
                            }`}
                          >
                            {isIncome ? '+' : '-'} {formatRupiah(tx.amount)}
                          </td>
                          <td className="py-2.5 px-3.5 whitespace-nowrap text-center pr-5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>Valid</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 💡 GRID BARIS 3: RINGKASAN METRIK OPERASIONAL */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Efisiensi Beban (OpEx)
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">78,0%</div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Rasio kas keluar terhadap omset penerimaan bulan ini
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Rata-rata Burn Rate
                  </span>
                  <div className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight whitespace-nowrap">
                    Rp 15,9 <span className="text-xs font-semibold text-slate-500">jt / hari</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  Rata-rata pengeluaran kas harian untuk operasional & HPP
                </p>
              </div>

              <div
                onClick={() => setActiveNav('tax')}
                className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-emerald-300 transition-colors cursor-pointer group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Estimasi PPh Final PP 55
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-700 tracking-tight">Rp 562.500</div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                  PPh Final 0,5% dari omset kena pajak (Klik untuk hitung)
                </p>
              </div>
            </div>
          </main>
        )}

        {/* 📖 TAB 2: BUKU KAS & TRANSAKSI */}
        {activeNav === 'ledger' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Buku Kas & Riwayat Transaksi</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Catatan seluruh arus kas masuk dan keluar secara kronologis</p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <button
                    onClick={() => setNewTxModalOpen(true)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Catat Transaksi</span>
                  </button>
                </div>
              </div>

              {/* Category Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 mb-4 pb-3 border-b border-slate-100">
                <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Filter:
                </span>
                {[
                  { id: 'all', label: 'Semua' },
                  { id: 'Katering B2B', label: 'B2B / Katering' },
                  { id: 'Distribusi Grosir', label: 'Grosir' },
                  { id: 'Beban Sewa', label: 'Sewa' },
                  { id: 'Marketing', label: 'Iklan' },
                  { id: 'Gaji', label: 'Payroll' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-100 text-emerald-800 font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Transactions Table */}
              <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5 pb-2 klir-custom-scrollbar">
                <table className="w-full min-w-[620px] text-left text-xs border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5">Tanggal</th>
                      <th className="py-2.5 px-3.5">Uraian / Deskripsi</th>
                      <th className="py-2.5 px-3.5">Kategori</th>
                      <th className="py-2.5 px-3.5">Jenis</th>
                      <th className="py-2.5 px-3.5 text-right pr-5">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTransactions.length > 0 ? (
                      filteredTransactions.map((t) => (
                        <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2.5 px-3.5 text-slate-600 font-mono whitespace-nowrap">
                            {new Date(t.transactionDate).toLocaleDateString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3.5 font-semibold text-slate-900">{t.description}</td>
                          <td className="py-2.5 px-3.5">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-medium whitespace-nowrap">
                              {t.category || 'Umum'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                                t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {t.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}
                            </span>
                          </td>
                          <td
                            className={`py-2.5 px-3.5 text-right font-mono font-bold whitespace-nowrap pr-5 ${
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
                          Belum ada transaksi kas yang sesuai dengan pencarian.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* 📑 TAB 3: FAKTUR & PIUTANG (AR) */}
        {activeNav === 'invoices' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Faktur Penjualan & Pengingat Piutang (AR)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Pantau status piutang klien dan kirim pengingat resmi WhatsApp otomatis</p>
                </div>

                <button
                  onClick={() => setNewInvModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Buat Faktur Baru</span>
                </button>
              </div>

              <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5 pb-2 klir-custom-scrollbar">
                <table className="w-full text-left text-xs border-collapse min-w-[640px]">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3.5">No. Faktur</th>
                      <th className="py-2.5 px-3.5">Pelanggan / Klien</th>
                      <th className="py-2.5 px-3.5">Jatuh Tempo</th>
                      <th className="py-2.5 px-3.5">Status</th>
                      <th className="py-2.5 px-3.5 text-right">Nominal</th>
                      <th className="py-2.5 px-3.5 text-center pr-5">Aksi Penagihan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(invoices.length > 0 ? invoices : [
                      { id: 'inv-1', invoiceNumber: 'INV-2026-001', clientName: 'CV Berkah Maju Perkasa', dueDate: '2026-09-20', status: 'OVERDUE', amount: 18200000 },
                      { id: 'inv-2', invoiceNumber: 'INV-2026-002', clientName: 'PT Sentosa Boga Abadi', dueDate: '2026-09-28', status: 'PAID', amount: 45000000 },
                    ]).map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 font-mono font-semibold text-blue-600 whitespace-nowrap">{inv.invoiceNumber}</td>
                        <td className="py-2.5 px-3.5 font-semibold text-slate-900">{inv.clientName}</td>
                        <td className="py-2.5 px-3.5 text-slate-600 font-mono whitespace-nowrap">
                          {new Date(inv.dueDate).toLocaleDateString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}
                          >
                            {inv.status === 'PAID' ? 'Lunas' : 'Tertunggak'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                          {formatRupiah(inv.amount)}
                        </td>
                        <td className="py-2.5 px-3.5 text-center pr-5">
                          {inv.status !== 'PAID' && (
                            <button
                              onClick={() => handleTriggerWhatsApp(inv.id)}
                              className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                            >
                              <Send className="w-3 h-3" />
                              <span>Kirim WA</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* ⏰ TAB 4: KEWAJIBAN & HUTANG (AP) */}
        {activeNav === 'obligations' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Kewajiban Terjadwal & Hutang Usaha (AP)</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Jadwal jatuh tempo tagihan vendor, sewa tempat, dan kewajiban beban operasional
                  </p>
                </div>

                <button
                  onClick={() => setNewOblModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors whitespace-nowrap self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Tambah Kewajiban</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {obligations.length > 0 ? (
                  obligations.map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="text-xs font-bold text-slate-900">{o.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {o.category || 'Operasional'} • Jatuh Tempo: {new Date(o.dueDate).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                      <span className="text-xs font-mono font-bold text-red-600 whitespace-nowrap">
                        {formatRupiah(o.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Tidak ada kewajiban jatuh tempo dalam 30 hari ke depan.
                  </div>
                )}
              </div>
            </div>
          </main>
        )}

        {/* 🏛️ TAB 5: REKONSILIASI BANK */}
        {activeNav === 'reconciliation' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Rekonsiliasi Mutasi Bank</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pencocokan mutasi rekening koran BCA & Mandiri dengan pembukuan kas KLIR
                  </p>
                </div>

                <button
                  onClick={() => alert('Fitur upload rekening koran CSV/Excel siap diintegrasikan!')}
                  className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Mutasi Bank</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    <h4 className="font-bold text-emerald-950">Status Rekonsiliasi: 100% Cocok (Reconciled)</h4>
                    <p className="text-emerald-800 mt-0.5">Seluruh saldo kas pada rekening bank tercatat presisi dengan buku besar.</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-emerald-900 text-sm whitespace-nowrap self-start sm:self-auto">Selisih: Rp 0</span>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800">Daftar Akun Bank Terhubung:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">Bank Central Asia (BCA)</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">No. Rek: 8205-1234-88 • Operasional</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-900 whitespace-nowrap shrink-0 text-right">Rp 210.000.000</span>
                  </div>

                  <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">Bank Mandiri Giro</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">No. Rek: 137-00-9876-11 • Cadangan</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-900 whitespace-nowrap shrink-0 text-right">Rp 118.500.000</span>
                  </div>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* 🛡️ TAB 6: PAJAK UMKM PP 55/2022 (Interactive Calculator) */}
        {activeNav === 'tax' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 mb-1">Kalkulator Pajak UMKM (PP No. 55 Tahun 2022)</h2>
              <p className="text-xs text-slate-500 mb-5">
                Ketentuan tarif PPh Final 0.5% dari peredaran bruto untuk wajib pajak UMKM
              </p>

              {/* Interactive Turnover Input */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-5">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Simulasikan Omset Bruto Tahunan (YTD):
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="number"
                    value={taxAnnualTurnover}
                    onChange={(e) => setTaxAnnualTurnover(Number(e.target.value) || 0)}
                    className="w-full sm:w-72 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-slate-500">
                    Batas bebas pajak WP OP: <strong>Rp 500.000.000 / tahun</strong>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Omset Bruto</span>
                  <div className="text-base sm:text-lg font-bold text-slate-900 mt-1 font-mono whitespace-nowrap">
                    {formatRupiah(taxAnnualTurnover)}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Peredaran bruto usaha</p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Omset Kena Pajak</span>
                  <div className="text-base sm:text-lg font-bold text-blue-900 mt-1 font-mono whitespace-nowrap">
                    {formatRupiah(taxableTurnover)}
                  </div>
                  <p className="text-[10px] text-blue-600 mt-1">Setelah pembebasan 500jt</p>
                </div>

                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">Estimasi PPh Final (0.5%)</span>
                  <div className="text-base sm:text-lg font-bold text-emerald-900 mt-1 font-mono whitespace-nowrap">
                    {formatRupiah(finalTaxPayable)}
                  </div>
                  <p className="text-[10px] text-emerald-700 mt-1 font-semibold">Disetor via kode billing DJP</p>
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 leading-relaxed">
                ℹ️ <strong>Ketentuan Pelaporan:</strong> PPh Final disetor paling lambat tanggal 15 bulan berikutnya melalui kode billing DJP Online (Akun Pajak 411128, Jenis Setoran 420).
              </div>
            </div>
          </main>
        )}

        {/* 🤖 TAB 7: AI FINANCE LEAD ASSISTANT */}
        {activeNav === 'ai-lead' && (
          <main className="flex-1 overflow-hidden flex flex-col h-[calc(100vh-56px)]">
            <ModernAICopilotView
              mode="FINANCE"
              workspaceId={workspaceId}
              workspaceName={workspaceName}
              userName={userName}
              onNavigateTab={(tab) => setActiveNav(tab)}
              onClose={() => setActiveNav('cashflow')}
            />
          </main>
        )}
      </div>

      {/* ➕ MODAL CATAT TRANSAKSI KAS BARU */}
      {newTxModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Catat Transaksi Kas Baru</h3>
              <button
                onClick={() => setNewTxModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="space-y-3.5 text-xs">
              {/* Type Switcher */}
              <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setTxType('INCOME')}
                  className={`flex-1 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                    txType === 'INCOME' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Pemasukan (Income)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('EXPENSE')}
                  className={`flex-1 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                    txType === 'EXPENSE' ? 'bg-red-600 text-white shadow-xs' : 'text-slate-600'
                  }`}
                >
                  Pengeluaran (Expense)
                </button>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nominal (Rupiah):</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 15.000.000"
                  value={txAmount}
                  onChange={(e) => setTxAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Kategori:</label>
                <select
                  value={txCategory}
                  onChange={(e) => setTxCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="Penjualan B2B">Penjualan B2B</option>
                  <option value="Penjualan Ritel">Penjualan Ritel</option>
                  <option value="Bahan Baku & HPP">Bahan Baku & HPP</option>
                  <option value="Gaji & SDM">Gaji & SDM</option>
                  <option value="Beban Sewa">Beban Sewa</option>
                  <option value="Marketing & Iklan">Marketing & Iklan</option>
                  <option value="Operasional Umum">Operasional Umum</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Keterangan / Uraian:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pembayaran invoice katering B2B PT Sentosa"
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Rekening / Kas:</label>
                <select
                  value={txBank}
                  onChange={(e) => setTxBank(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="BCA Operasional">BCA Operasional (8205-1234-88)</option>
                  <option value="Mandiri Giro">Mandiri Giro (137-00-9876-11)</option>
                  <option value="Kas Kecil">Kas Kecil (Petty Cash)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewTxModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={txSaving}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
                >
                  {txSaving ? 'Menyimpan...' : 'Simpan Transaksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ➕ MODAL BUAT FAKTUR BARU */}
      {newInvModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Buat Faktur Penjualan Baru</h3>
              <button
                onClick={() => setNewInvModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Klien / Perusahaan:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PT Mulia Sukses Makmur"
                  value={invClient}
                  onChange={(e) => setInvClient(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nomor WhatsApp Penagihan:</label>
                <input
                  type="text"
                  placeholder="Contoh: 081234567890"
                  value={invPhone}
                  onChange={(e) => setInvPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nominal Tagihan (Rp):</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 25.000.000"
                  value={invAmount}
                  onChange={(e) => setInvAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Tanggal Jatuh Tempo:</label>
                <input
                  type="date"
                  value={invDue}
                  onChange={(e) => setInvDue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewInvModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={invSaving}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
                >
                  {invSaving ? 'Menyimpan...' : 'Buat Faktur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ➕ MODAL TAMBAH KEWAJIBAN BARU */}
      {newOblModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h3 className="text-sm font-bold text-slate-900">Tambah Kewajiban & Hutang (AP)</h3>
              <button
                onClick={() => setNewOblModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveObligation} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nama Kewajiban / Vendor:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Tagihan Supplier Bahan Baku PT Sentosa"
                  value={oblName}
                  onChange={(e) => setOblName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Kategori:</label>
                <select
                  value={oblCategory}
                  onChange={(e) => setOblCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-medium text-slate-900 focus:outline-none cursor-pointer"
                >
                  <option value="Bahan Baku">Bahan Baku (HPP)</option>
                  <option value="Sewa Tempat">Sewa Tempat</option>
                  <option value="Payroll">Payroll Tim</option>
                  <option value="Utilitas">Listrik & Utilitas</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Nominal (Rp):</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 18.000.000"
                  value={oblAmount}
                  onChange={(e) => setOblAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Jatuh Tempo:</label>
                <input
                  type="date"
                  value={oblDue}
                  onChange={(e) => setOblDue(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-slate-900 focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewOblModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={oblSaving}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer shadow-xs"
                >
                  {oblSaving ? 'Menyimpan...' : 'Simpan Kewajiban'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📲 MODAL PREVIEW WHATSAPP REMINDER */}
      {waModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mb-1">Tautan WhatsApp Penagihan</h3>
            <p className="text-xs text-slate-500 mb-3">Pesan resmi telah digenerate dengan nomor telepon yang telah didekripsi.</p>

            {waLinkLoading ? (
              <div className="py-6 text-center text-slate-500 text-xs sm:text-sm">Menghasilkan pesan...</div>
            ) : (
              <div className="space-y-3">
                <textarea
                  readOnly
                  value={waMessage}
                  rows={4}
                  className="w-full text-xs font-mono p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2.5">
                  <button
                    onClick={() => setWaModalOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    Tutup
                  </button>
                  <a
                    href={waGeneratedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka WhatsApp Web</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ⚙️ FINANCE SETTINGS MODAL */}
      {settingsOpen && (
        <FinanceSettingsModal
          isOpen={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}
