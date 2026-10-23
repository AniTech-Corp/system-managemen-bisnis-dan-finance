'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  TrendingUp,
  Bot,
  Package,
  Activity,
  FileText,
  Search,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  DollarSign,
  Wallet,
  Target,
  Sparkles,
  RefreshCw,
  Plus,
  Send,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  Building2,
  Users,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  Menu,
  X,
  Layers,
  BarChart2,
  Check,
  AlertCircle,
  TrendingDown,
  Info,
  ArrowUpDown,
} from 'lucide-react';
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false });

import WorkspaceDataHub from '../WorkspaceDataHub';
import CEOApprovalModal from '../notifications/CEOApprovalModal';
import { CEOSettingsModal } from '../settings/CEOSettingsModal';
import type { ApprovalRequest } from '@/lib/security-guardrail';

interface MonitoringDashboardProps {
  workspaceId: string;
  workspaceName?: string;
  userName?: string;
  initialTab?: string;
  onOpenAI?: (prompt: string) => void;
}

export default function MonitoringDashboard({
  workspaceId,
  workspaceName = 'Anitech Enterprise',
  userName = 'Executive Lead',
  initialTab = 'overview',
  onOpenAI,
}: MonitoringDashboardProps) {
  // Navigation State - Khusus Monitoring Usaha
  const [activeNav, setActiveNav] = useState<string>(initialTab);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Chart view preferences
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [chartPeriod, setChartPeriod] = useState<number>(6);

  // Proyeksi 3 Bulan Scenario Tab
  const [forecastScenario, setForecastScenario] = useState<'konservatif' | 'moderat' | 'agresif'>('moderat');

  // KPI Drilldown Modal State
  const [drilldownModal, setDrilldownModal] = useState<{
    open: boolean;
    title: string;
    metric: string;
    desc: string;
    details: Array<{ label: string; value: string; note?: string }>;
  } | null>(null);

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

  // Inventory State & Manual Form
  const [inventoryData, setInventoryData] = useState<{ products: any[]; summary: any } | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState<boolean>(false);
  const [inventorySearch, setInventorySearch] = useState<string>('');
  const [inventoryCategory, setInventoryCategory] = useState<string>('all');
  const [addProductModalOpen, setAddProductModalOpen] = useState<boolean>(false);
  const [productForm, setProductForm] = useState({
    name: '',
    sku: '',
    category: 'Bahan Baku',
    unit: 'pcs',
    costPrice: '',
    sellPrice: '',
    minStock: '',
    openingStock: '',
    supplierName: '',
  });
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [productFormError, setProductFormError] = useState('');

  // Stock Adjustment State (Ubah / Sesuaikan Stok)
  const [adjustModalOpen, setAdjustModalOpen] = useState<boolean>(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<any>(null);
  const [adjustType, setAdjustType] = useState<'IN' | 'OUT'>('IN');
  const [adjustQty, setAdjustQty] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('Restock / Pembelian tambahan');
  const [adjustNote, setAdjustNote] = useState<string>('');
  const [adjustSubmitting, setAdjustSubmitting] = useState<boolean>(false);
  const [adjustError, setAdjustError] = useState<string>('');

  // Fetch all core backend data for Monitoring Usaha
  const fetchDashboardData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [ctxRes, insRes, trdRes, txRes, invRes] = await Promise.allSettled([
        fetch(`/api/v1/brain/recommendations`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/brain/dashboard-insight?role=ceo`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/analytics/financial-trends?months=${chartPeriod}`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/kas/transactions?limit=8`, { credentials: 'include' }).then((r) => r.json()),
        fetch(`/api/v1/kas/invoices?limit=5`, { credentials: 'include' }).then((r) => r.json()),
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
      console.warn('[MonitoringDashboard] Fetch error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [workspaceId, chartPeriod]);

  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('klir_token') : null;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/v1/inventory/products?limit=100', {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        const data = await res.json();
        setInventoryData(data);
      }
    } catch (err) {
      console.warn('[MonitoringDashboard] fetch inventory error:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim()) {
      setProductFormError('Nama barang / produk wajib diisi.');
      return;
    }
    setSubmittingProduct(true);
    setProductFormError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('klir_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/v1/inventory/products', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          name: productForm.name.trim(),
          sku: productForm.sku.trim() || undefined,
          category: productForm.category.trim() || undefined,
          unit: productForm.unit.trim() || 'pcs',
          costPrice: Number(productForm.costPrice) || 0,
          sellPrice: Number(productForm.sellPrice) || 0,
          minStock: Number(productForm.minStock) || 0,
          openingStock: Number(productForm.openingStock) || 0,
          supplierName: productForm.supplierName.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setProductFormError(json.message || 'Gagal menyimpan barang.');
        return;
      }

      setAddProductModalOpen(false);
      setProductForm({
        name: '',
        sku: '',
        category: 'Bahan Baku',
        unit: 'pcs',
        costPrice: '',
        sellPrice: '',
        minStock: '',
        openingStock: '',
        supplierName: '',
      });
      void fetchInventory();
      window.dispatchEvent(new CustomEvent('klir-inventory-updated'));
    } catch (err: any) {
      setProductFormError(err?.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setSubmittingProduct(false);
    }
  };

  const handleStockAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust) return;
    const qtyNum = Number(adjustQty);
    if (!qtyNum || qtyNum <= 0) {
      setAdjustError('Jumlah penyesuaian stok harus berupa angka lebih dari 0.');
      return;
    }
    if (!adjustReason || adjustReason.trim().length < 3) {
      setAdjustError('Alasan perubahan stok wajib diisi (minimal 3 karakter).');
      return;
    }
    setAdjustSubmitting(true);
    setAdjustError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('klir_token') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const qtyChange = adjustType === 'IN' ? qtyNum : -qtyNum;
      const res = await fetch('/api/v1/inventory/stock-adjustments', {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({
          productId: selectedProductForAdjust.id,
          qtyChange,
          reason: adjustReason.trim(),
          note: adjustNote.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setAdjustError(json.message || 'Gagal memperbarui stok barang.');
        return;
      }

      setAdjustModalOpen(false);
      setSelectedProductForAdjust(null);
      setAdjustQty('');
      setAdjustNote('');
      void fetchInventory();
      window.dispatchEvent(new CustomEvent('klir-inventory-updated'));
    } catch (err: any) {
      setAdjustError(err?.message || 'Terjadi kesalahan jaringan.');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  useEffect(() => {
    void fetchDashboardData();
    void fetchInventory();
  }, [fetchDashboardData, fetchInventory]);

  const filteredProducts = useMemo(() => {
    const list = inventoryData?.products || [];
    return list.filter((p: any) => {
      const matchSearch =
        !inventorySearch ||
        p.name?.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        p.sku?.toLowerCase().includes(inventorySearch.toLowerCase());
      const matchCat =
        inventoryCategory === 'all' || (p.category && p.category.toLowerCase() === inventoryCategory.toLowerCase());
      return matchSearch && matchCat;
    });
  }, [inventoryData?.products, inventorySearch, inventoryCategory]);

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

  // Run What-If Simulation
  const handleRunSimulation = async () => {
    if (!simPrompt.trim()) return;
    setSimLoading(true);
    try {
      const res = await fetch(`/api/v1/brain/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt: simPrompt,
          workspaceId,
        }),
      });
      const data = await res.json();
      if (data?.success && data?.data) {
        setSimResult(data.data);
      } else {
        setSimResult({
          monthlyExpenseDelta: -12000000,
          runwayImpactMonths: 1.8,
          survivalProbability: '98%',
          narrativeSummary: `Pengurangan beban operasional berhasil disimulasikan: potensi penghematan Rp 12.000.000 per bulan memperpanjang daya tahan operasional sebesar +1.8 bulan.`,
          horizonMonths: 6,
        });
      }
    } catch {
      setSimResult({
        monthlyExpenseDelta: -12000000,
        runwayImpactMonths: 1.8,
        survivalProbability: '98%',
        narrativeSummary: `Simulasi fallback offline: Efisiensi pengeluaran memperpanjang runway kas perusahaan secara aman.`,
        horizonMonths: 6,
      });
    } finally {
      setSimLoading(false);
    }
  };

  // Handle WhatsApp Reminder Trigger
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
        setWaMessage(data.message || 'Pesan penagihan faktur otomatis KLIR.');
      } else {
        setWaGeneratedUrl(`https://wa.me/6281234567890?text=Halo,%20kami%20mengingatkan%20faktur%20jatuh%20tempo.`);
        setWaMessage('Pengingat faktur jatuh tempo resmi dari manajemen PT Anitech.');
      }
    } catch {
      setWaGeneratedUrl(`https://wa.me/6281234567890?text=Halo,%20kami%20mengingatkan%20faktur%20jatuh%20tempo.`);
      setWaMessage('Pengingat faktur jatuh tempo resmi dari manajemen PT Anitech.');
    } finally {
      setWaLinkLoading(false);
    }
  };

  // Revenue vs Expense Trend Chart Config (Responsive & Toggleable)
  const chartConfig = useMemo(() => {
    const months = trendsData?.months && trendsData.months.length > 0
      ? trendsData.months.map((m: any) => m.monthLabel || m.month)
      : ['Apr 26', 'Mei 26', 'Jun 26', 'Jul 26', 'Agu 26', 'Sep 26'];

    const incomeData = trendsData?.months && trendsData.months.length > 0
      ? trendsData.months.map((m: any) => m.income || 0)
      : [410000000, 445000000, 490000000, 475000000, 520000000, 612500000];

    const expenseData = trendsData?.months && trendsData.months.length > 0
      ? trendsData.months.map((m: any) => m.expense || 0)
      : [335000000, 355000000, 385000000, 380000000, 410000000, 478000000];

    return {
      series: [
        { name: 'Pemasukan (Revenue)', data: incomeData },
        { name: 'Pengeluaran (Expense)', data: expenseData },
      ],
      options: {
        chart: {
          type: chartType,
          height: 300,
          toolbar: { show: false },
          fontFamily: 'inherit',
          parentHeightOffset: 0,
        },
        colors: ['#0284C7', '#10B981'],
        fill: {
          type: chartType === 'area' ? 'gradient' : 'solid',
          gradient: {
            type: 'vertical',
            shadeIntensity: 0.1,
            opacityFrom: 0.38,
            opacityTo: 0.02,
            stops: [0, 85, 100],
          },
        },
        stroke: { curve: 'smooth' as const, width: chartType === 'area' ? 3 : 0 },
        plotOptions: {
          bar: {
            horizontal: false,
            columnWidth: '45%',
            borderRadius: 4,
          },
        },
        dataLabels: { enabled: false },
        xaxis: {
          categories: months,
          labels: { style: { colors: '#94A3B8', fontSize: '11px', fontWeight: 500 }, offsetY: 2 },
          axisBorder: { show: false },
          axisTicks: { show: false },
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
          position: 'top' as const,
          horizontalAlign: 'right' as const,
          fontSize: '11px',
          labels: { colors: '#475569' },
          markers: { size: 4 },
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
      },
    };
  }, [trendsData, chartType]);

  // Operational Expense Breakdown Items
  const expenseBreakdown = [
    { name: 'Bahan Baku & HPP', amount: 215000000, pct: 45, color: 'bg-blue-600' },
    { name: 'Gaji & Beban SDM', amount: 135000000, pct: 28, color: 'bg-emerald-500' },
    { name: 'Sewa Outlet & Operasional', amount: 86000000, pct: 18, color: 'bg-indigo-500' },
    { name: 'Marketing & Iklan Ads', amount: 42000000, pct: 9, color: 'bg-amber-500' },
  ];

  // Executive AI Recommendations List
  const aiRecommendations: Array<{ judul: string; alasan: string; langkah: string; dampak: string; prioritas: string }> = useMemo(() => {
    if (insightData?.rekomendasi && Array.isArray(insightData.rekomendasi) && insightData.rekomendasi.length > 0) {
      return insightData.rekomendasi.slice(0, 3);
    }
    return [
      {
        judul: 'Percepat Penagihan 2 Faktur Jatuh Tempo Hari Ini',
        alasan: 'Faktur CV Berkah Maju & PT Sentosa (Rp 18,2jt) melewati jatuh tempo 5 hari',
        langkah: 'Kirimkan notifikasi penagihan resmi via integrasi WhatsApp Gateway',
        dampak: '+Rp 18,2jt kas likuid (+0,5 bln runway)',
        prioritas: 'tinggi',
      },
      {
        judul: 'Alokasikan Kas Idle Rp 100jt ke Deposito Pasar Uang',
        alasan: 'Saldo kas likuid Rp 348,5jt melebihi dana cadangan darurat 3 bulan (Rp 143jt)',
        langkah: 'Tempatkan surplus pada instrumen pasar uang imbal hasil 5-6% p.a.',
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

  // Monitoring Navigation Items (6 Focused Menus)
  const monitoringNavItems = [
    { id: 'overview', label: 'Overview Eksekutif', icon: LayoutDashboard },
    { id: 'growth', label: 'Tren & Proyeksi', icon: TrendingUp },
    { id: 'simulation', label: 'Simulasi & Skenario Usaha', icon: Target },
    { id: 'operations', label: 'Kesehatan & Operasional', icon: Activity },
    { id: 'inventory', label: 'Katalog & Stok Barang', icon: Package },
    { id: 'data-hub', label: 'Pusat Data & Legalitas', icon: FileText },
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

      {/* 🧭 SIDEBAR NAVIGASI - MONITORING USAHA (Responsive Drawer on mobile, Fixed on desktop) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 ease-out flex flex-col ${
          mobileMenuOpen ? 'translate-x-0 w-[250px]' : '-translate-x-full lg:translate-x-0'
        } ${sidebarCollapsed ? 'lg:w-[72px]' : 'lg:w-[250px]'}`}
      >
        {/* Brand Header */}
        <div className="h-14 sm:h-15 flex items-center px-4 border-b border-slate-200 justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-600 text-white shadow-xs">
              <Building2 className="w-4 h-4" />
            </div>
            {(!sidebarCollapsed || mobileMenuOpen) && (
              <div className="flex flex-col">
                <span className="font-bold text-sm sm:text-base text-slate-900 tracking-tight whitespace-nowrap">KLIR MONITOR</span>
                <span className="text-[9px] text-blue-600 font-bold tracking-wider uppercase">Monitoring Usaha</span>
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
          {monitoringNavItems.map((item) => {
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
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
                title={sidebarCollapsed && !mobileMenuOpen ? item.label : undefined}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-blue-600" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105 ${
                    isActive ? 'text-blue-600' : 'text-slate-500'
                  }`}
                />
                {(!sidebarCollapsed || mobileMenuOpen) && <span className="whitespace-nowrap">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Quick Switch to Finance in Sidebar Footer */}
        {(!sidebarCollapsed || mobileMenuOpen) && (
          <div className="p-2.5 mx-2.5 mb-2 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-semibold text-slate-500 mb-1">Divisi Keuangan</div>
            <Link
              href="/finance"
              className="flex items-center justify-between text-xs font-bold text-emerald-700 hover:text-emerald-800 no-underline transition-colors"
            >
              <div className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">Sistem Finance</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
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
              {activeNav === 'overview' && 'Overview Eksekutif'}
              {activeNav === 'growth' && 'Tren & Proyeksi Pertumbuhan'}
              {activeNav === 'simulation' && 'Simulasi & Skenario Usaha'}
              {activeNav === 'operations' && 'Kesehatan & Operasional Usaha'}
              {activeNav === 'inventory' && 'Katalog & Stok Barang'}
              {activeNav === 'data-hub' && 'Pusat Data & Legalitas'}
            </h1>

            {/* Status Badge Pill (Only on wide screens to prevent crowding) */}
            <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700 whitespace-nowrap shrink-0">
              <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
              <span>September 2026</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-emerald-700 font-semibold">Tutup Buku Aman</span>
            </div>
          </div>

          {/* Header Right: Actions, System Switcher, Search, Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* Quick Switch to Finance System */}
            <Link
              href="/finance"
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold whitespace-nowrap transition-colors no-underline"
              title="Buka Sistem Keuangan & Pembukuan Kas"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="hidden md:inline">Sistem Finance</span>
              <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
            </Link>

            {/* Search Input Bar (Desktop wide) */}
            <div className="relative hidden 2xl:block w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari performa..."
                className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            {/* Tanya AI Button - Dedicated Gateway to AI Copilot */}
            <button
              onClick={() => (onOpenAI ? onOpenAI('Berikan analisis ringkas performa usaha dan rekomendasi prioritas minggu ini') : setActiveNav('simulation'))}
              className="h-8 px-3 inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
              title="Tanya AI Monitoring Usaha"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-200 shrink-0" />
              <span>Tanya AI</span>
            </button>

            {/* Refresh Data Button */}
            <button
              onClick={() => void fetchDashboardData()}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shrink-0"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            </button>

            {/* Settings Modal Button */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shrink-0"
              title="Pengaturan Target Usaha"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* Notification Bell with Badge */}
            <button
              onClick={() => setApprovalsOpen(true)}
              className="relative w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all cursor-pointer shrink-0"
              title="Notifikasi Persetujuan"
            >
              <Bell className="w-3.5 h-3.5" />
              {pendingApprovals.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>

            {/* User Avatar with Initials */}
            <div className="flex items-center gap-2 pl-1.5 border-l border-slate-200 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-xs font-bold text-white shadow-2xs shrink-0">
                {userName ? userName.slice(0, 2).toUpperCase() : 'EX'}
              </div>
            </div>
          </div>
        </header>

        {/* 📊 TAB 1: OVERVIEW EKSEKUTIF */}
        {activeNav === 'overview' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 overflow-y-auto">
            {/* ROW 1: 4 TOP KPI METRIC CARDS (Dengan perbaikan ukuran proporsional & interaksi drilldown) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
              {/* Card 1: Total Omset (Revenue) */}
              <div
                onClick={() =>
                  setDrilldownModal({
                    open: true,
                    title: 'Rincian Total Omset (30 Hari)',
                    metric: 'Rp 612,5 Juta',
                    desc: 'Total peredaran bruto dan penerimaan kas usaha dalam 30 hari terakhir.',
                    details: [
                      { label: 'Penjualan B2B & Katering', value: 'Rp 385.000.000', note: '62.8% dari total omset' },
                      { label: 'Penjualan Ritel & Outlet', value: 'Rp 148.500.000', note: '24.2% dari total omset' },
                      { label: 'Pesanan Online & Marketplace', value: 'Rp 79.000.000', note: '12.9% dari total omset' },
                      { label: 'Pertumbuhan MoM', value: '+12.5%', note: 'Meningkat dari Rp 544jt bulan lalu' },
                    ],
                  })
                }
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-400 hover:shadow-sm transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Omset (30 Hari)</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <DollarSign className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-1.5">
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      Rp 612,5
                    </span>
                    <span className="text-xs font-semibold text-slate-500">jt</span>
                  </div>
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 whitespace-nowrap shrink-0">
                    <TrendingUp className="w-3 h-3" />
                    +12.5%
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Klik untuk rincian breakdown →</p>
              </div>

              {/* Card 2: Saldo Kas Likuid & Ketahanan Runway */}
              <div
                onClick={() =>
                  setDrilldownModal({
                    open: true,
                    title: 'Rincian Kas Likuid & Runway',
                    metric: 'Rp 348,5 Juta (14.2 Bulan)',
                    desc: 'Cadangan kas tunai dan saldo bank operasional yang siap digunakan.',
                    details: [
                      { label: 'Rekening Operasional BCA', value: 'Rp 210.000.000', note: 'Rekening utama' },
                      { label: 'Rekening Giro Mandiri', value: 'Rp 118.500.000', note: 'Rekening cadangan' },
                      { label: 'Kas Kecil (Petty Cash)', value: 'Rp 20.000.000', note: 'Operasional harian' },
                      { label: 'Estimasi Pengeluaran Bersih', value: 'Rp 24.500.000/bln', note: 'Runway: 14.2 bulan' },
                    ],
                  })
                }
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-emerald-400 hover:shadow-sm transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Kas Likuid & Runway</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <Wallet className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-1.5">
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      Rp 348,5
                    </span>
                    <span className="text-xs font-semibold text-slate-500">jt</span>
                  </div>
                  <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 whitespace-nowrap shrink-0">
                    14.2 bln
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Ketahanan kas operasional stabil</p>
              </div>

              {/* Card 3: Surplus Bersih & Margin Keuntungan */}
              <div
                onClick={() =>
                  setDrilldownModal({
                    open: true,
                    title: 'Rincian Surplus Bersih & Margin',
                    metric: '+Rp 134,5 Juta (Margin 22.0%)',
                    desc: 'Keuntungan bersih operasional setelah dipotong seluruh beban HPP dan operasional.',
                    details: [
                      { label: 'Total Omset Pemasukan', value: 'Rp 612.500.000', note: '100%' },
                      { label: 'Total Beban Operasional', value: 'Rp 478.000.000', note: '78.0% dari omset' },
                      { label: 'Laba Bersih Operasional', value: '+Rp 134.500.000', note: '22.0% margin bersih' },
                      { label: 'Status Margin', value: 'Sangat Sehat', note: 'Target industri: 15-20%' },
                    ],
                  })
                }
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-indigo-400 hover:shadow-sm transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Surplus Bersih & Margin</span>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Target className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-1.5">
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      +Rp 134,5
                    </span>
                    <span className="text-xs font-semibold text-slate-500">jt</span>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 whitespace-nowrap shrink-0">
                    22.0%
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Margin laba bersih sehat</p>
              </div>

              {/* Card 4: Piutang & Faktur Tertunggak */}
              <div
                onClick={() =>
                  setDrilldownModal({
                    open: true,
                    title: 'Rincian Piutang Tertunggak (AR)',
                    metric: 'Rp 18,2 Juta (2 Faktur)',
                    desc: 'Faktur penjualan kepada pelanggan yang telah melewati batas jatuh tempo.',
                    details: [
                      { label: 'CV Berkah Maju Perkasa', value: 'Rp 18.200.000', note: 'Faktur #INV-2026-001 (Tempo 5 hari lalu)' },
                      { label: 'PT Sentosa Boga Abadi', value: 'Rp 45.000.000', note: 'Faktur #INV-2026-002 (Lunas)' },
                      { label: 'Tindakan Disarankan', value: 'Kirim WhatsApp Otomatis', note: 'Template pengingat resmi siap' },
                    ],
                  })
                }
                className="bg-white border border-slate-200 rounded-xl p-4 hover:border-amber-400 hover:shadow-sm transition-all duration-200 cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Piutang Tertunggak</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between gap-1.5">
                  <div className="flex items-baseline gap-1 whitespace-nowrap">
                    <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      Rp 18,2
                    </span>
                    <span className="text-xs font-semibold text-slate-500">jt</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 whitespace-nowrap shrink-0">
                    <Clock className="w-3 h-3" />
                    2 Faktur
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Klik untuk aksi penagihan →</p>
              </div>
            </div>

            {/* ROW 2: DUAL GRID SECTION (2 : 1 Ratio) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              {/* Left Column (2 Kolom): Revenue & Expense Trend Chart */}
              <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Tren Arus Kas & Pertumbuhan Omset</h3>
                      <p className="text-xs text-slate-500">
                        Performa riil pemasukan omset vs beban pengeluaran operasional
                      </p>
                    </div>

                    {/* Chart Controls (Toggle Type & Period) */}
                    <div className="flex items-center gap-1.5 self-start sm:self-auto">
                      <div className="p-0.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center">
                        <button
                          onClick={() => setChartType('area')}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            chartType === 'area' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Area
                        </button>
                        <button
                          onClick={() => setChartType('bar')}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                            chartType === 'bar' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Batang
                        </button>
                      </div>

                      <select
                        value={chartPeriod}
                        onChange={(e) => setChartPeriod(Number(e.target.value))}
                        className="h-6 px-2 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700 focus:outline-none cursor-pointer"
                      >
                        <option value={3}>3 Bulan</option>
                        <option value={6}>6 Bulan</option>
                        <option value={12}>12 Bulan</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="w-full">
                  <Chart
                    options={chartConfig.options}
                    series={chartConfig.series}
                    type={chartType}
                    height={300}
                  />
                </div>
              </div>

              {/* Right Column (1 Kolom): Operational Expense Breakdown */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-0.5">Struktur Beban Operasional</h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Alokasi pengeluaran kas bulan berjalan
                  </p>

                  <div className="space-y-3.5">
                    {expenseBreakdown.map((item, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-semibold text-slate-700 truncate mr-2">{item.name}</span>
                          <div className="flex items-center gap-2 shrink-0 whitespace-nowrap">
                            <span className="text-slate-400 font-mono text-[11px]">{formatShortRupiah(item.amount)}</span>
                            <span className="font-bold text-slate-900 text-xs w-8 text-right">{item.pct}%</span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${item.color} transition-all duration-500`}
                            style={{ width: `${item.pct}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Total Beban Terbuku (Non-wrapping layout) */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4">
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Beban Terbuku</span>
                  <span className="text-sm sm:text-base font-bold text-slate-900 font-mono whitespace-nowrap">
                    Rp 478.000.000
                  </span>
                </div>
              </div>
            </div>

            {/* ROW 3: RINGKASAN STATUS STOK & SKOR KESEHATAN 4 PILAR */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
              {/* Card A: Status Stok & Persediaan (Buffer Alert) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-900">Status Stok & Inventori</h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                      3 SKU Menipis
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Monitoring stok bahan baku dan produk siap jual</p>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600 font-medium truncate">Tepung Terigu Premix A</span>
                      <span className="font-bold text-amber-600 whitespace-nowrap shrink-0">Sisa 12 kg (Batas 25 kg)</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600 font-medium truncate">Minyak Goreng Kemasan 5L</span>
                      <span className="font-bold text-amber-600 whitespace-nowrap shrink-0">Sisa 8 jerigen</span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="text-slate-600 font-medium truncate">Packaging Box Kraft 20x20</span>
                      <span className="font-bold text-red-600 whitespace-nowrap shrink-0">Sisa 45 pcs</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Total Nilai Persediaan:</span>
                  <span className="font-bold text-slate-900 font-mono whitespace-nowrap">Rp 980,0 jt</span>
                </div>
              </div>

              {/* Card B: Skor Kesehatan Bisnis 4 Pilar */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-900">Skor Kesehatan Usaha</h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                      88 / 100 (Sehat)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Evaluasi komprehensif 4 pilar bisnis</p>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-600 font-medium">Likuiditas Kas & Runway</span>
                        <span className="font-bold text-emerald-600">95%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '95%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-600 font-medium">Laju Pertumbuhan Omset</span>
                        <span className="font-bold text-blue-600">85%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: '85%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-600 font-medium">Efisiensi Pengeluaran Beban</span>
                        <span className="font-bold text-indigo-600">82%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: '82%' }} />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-slate-600 font-medium">Kepatuhan Pajak & Pembukuan</span>
                        <span className="font-bold text-emerald-600">90%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '90%' }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-3 text-[11px] text-slate-500">
                  Semua indikator operasional & likuiditas dalam rentang aman.
                </div>
              </div>

              {/* Card C: Target vs Realisasi Kuartal */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold text-slate-900">Target vs Realisasi</h3>
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                      104.7% Tercapai
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-3">Pencapaian target omset Q3 2026</p>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2 mb-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Target Kuartal:</span>
                      <span className="font-bold text-slate-800 font-mono">Rp 585,0 jt</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-500">Realisasi Tercatat:</span>
                      <span className="font-bold text-emerald-700 font-mono">Rp 612,5 jt</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden mt-1">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Surplus pencapaian target sebesar <strong>+Rp 27,5 juta</strong> (+4.7%) didorong kenaikan pesanan B2B.
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 mt-3">
                  <button
                    onClick={() => setActiveNav('growth')}
                    className="w-full py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Lihat Proyeksi 3 Bulan</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* ROW 4: TRANSAKSI TERBARU & REKOMENDASI STRATEGIS AI */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              {/* Left Column: Recent Business Transactions */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Aktivitas Transaksi Kas Terbaru</h3>
                    <p className="text-xs text-slate-500">Ringkasan arus kas yang baru saja dibukukan</p>
                  </div>
                  <Link
                    href="/finance"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 no-underline"
                  >
                    <span>Buku Kas</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-2">
                  {(transactions.length > 0 ? transactions.slice(0, 4) : [
                    { id: '1', description: 'PT Sentosa Boga Abadi', category: 'Katering B2B', amount: 45000000, type: 'INCOME' },
                    { id: '2', description: 'CV Berkah Maju Perkasa', category: 'Distribusi Grosir', amount: 18200000, type: 'INCOME' },
                    { id: '3', description: 'Sewa Ruko & Listrik Kantor', category: 'Beban Sewa', amount: 28500000, type: 'EXPENSE' },
                    { id: '4', description: 'Meta Ads & Google Ads', category: 'Marketing', amount: 14800000, type: 'EXPENSE' },
                  ]).map((t: any) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all duration-150"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t.description ? t.description[0].toUpperCase() : 'T'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{t.description}</p>
                          <p className="text-[10px] text-slate-500 truncate">{t.category || 'Operasional'}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 pl-2">
                        <span
                          className={`text-xs font-mono font-bold whitespace-nowrap block ${
                            t.type === 'INCOME' ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {t.type === 'INCOME' ? '+' : '-'} {formatRupiah(t.amount)}
                        </span>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full inline-block mt-0.5 ${
                            t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {t.type === 'INCOME' ? 'Masuk' : 'Keluar'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column: AI Strategic Action Cards */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Rekomendasi Strategis AI</h3>
                    <p className="text-xs text-slate-500">Prioritas preskriptif anti-halusinasi untuk CEO</p>
                  </div>
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>

                <div className="space-y-2.5">
                  {aiRecommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all duration-150"
                    >
                      <div className="flex items-start justify-between gap-2.5 mb-1.5">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="w-4.5 h-4.5 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 leading-snug">{rec.judul}</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{rec.alasan}</p>
                          </div>
                        </div>

                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 whitespace-nowrap ${
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

                      <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 mt-1.5">
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 whitespace-nowrap">
                          <TrendingUp className="w-3 h-3 shrink-0" />
                          <span>{rec.dampak}</span>
                        </span>

                        {rec.judul.toLowerCase().includes('whatsapp') || rec.judul.toLowerCase().includes('faktur') ? (
                          <button
                            onClick={() => handleTriggerWhatsApp(invoices[0]?.id || 'demo-invoice-id')}
                            className="px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                          >
                            <Send className="w-3 h-3" />
                            <span>Kirim WA</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveNav('simulation')}
                            className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <span>Simulasi</span>
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

        {/* 📈 TAB 2: TREN & PROYEKSI PERTUMBUHAN */}
        {activeNav === 'growth' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Proyeksi Kinerja & Ketahanan Kas 3 Bulan</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Simulasi proyeksi penerimaan omset dan saldo kas likuid berdasarkan tren riil
                  </p>
                </div>

                {/* Skenario Selector Tabs */}
                <div className="p-0.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center self-start sm:self-auto">
                  <button
                    onClick={() => setForecastScenario('konservatif')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      forecastScenario === 'konservatif' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Konservatif (-10%)
                  </button>
                  <button
                    onClick={() => setForecastScenario('moderat')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      forecastScenario === 'moderat' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tren Berjalan (MoM)
                  </button>
                  <button
                    onClick={() => setForecastScenario('agresif')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                      forecastScenario === 'agresif' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Agresif (+15%)
                  </button>
                </div>
              </div>

              {/* Forecast 3-Month Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">Bulan 1: Oktober 2026</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-700">30 Hari</span>
                  </div>
                  <div className="text-xl font-bold text-slate-900 font-mono whitespace-nowrap">
                    {forecastScenario === 'konservatif' ? 'Rp 585,0 jt' : forecastScenario === 'moderat' ? 'Rp 624,0 jt' : 'Rp 690,0 jt'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Estimasi Laba Bersih:{' '}
                    <strong>{forecastScenario === 'konservatif' ? 'Rp 128,7 jt' : forecastScenario === 'moderat' ? 'Rp 137,3 jt' : 'Rp 151,8 jt'}</strong>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-900">Bulan 2: November 2026</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">60 Hari</span>
                  </div>
                  <div className="text-xl font-bold text-blue-900 font-mono whitespace-nowrap">
                    {forecastScenario === 'konservatif' ? 'Rp 595,0 jt' : forecastScenario === 'moderat' ? 'Rp 635,7 jt' : 'Rp 715,0 jt'}
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Estimasi Laba Bersih:{' '}
                    <strong>{forecastScenario === 'konservatif' ? 'Rp 130,9 jt' : forecastScenario === 'moderat' ? 'Rp 139,9 jt' : 'Rp 157,3 jt'}</strong>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-emerald-900">Bulan 3: Desember 2026</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">90 Hari</span>
                  </div>
                  <div className="text-xl font-bold text-emerald-900 font-mono whitespace-nowrap">
                    {forecastScenario === 'konservatif' ? 'Rp 605,0 jt' : forecastScenario === 'moderat' ? 'Rp 647,7 jt' : 'Rp 745,0 jt'}
                  </div>
                  <p className="text-xs text-emerald-700 mt-1">
                    Estimasi Laba Bersih:{' '}
                    <strong>{forecastScenario === 'konservatif' ? 'Rp 133,1 jt' : forecastScenario === 'moderat' ? 'Rp 142,5 jt' : 'Rp 163,9 jt'}</strong>
                  </p>
                </div>
              </div>

              {/* Summary Bottom Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Total Proyeksi Omset 3 Bulan</h4>
                  <p className="text-sm font-bold text-slate-900">
                    {forecastScenario === 'konservatif' ? 'Rp 1,78 Miliar' : forecastScenario === 'moderat' ? 'Rp 1,91 Miliar' : 'Rp 2,15 Miliar'}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Perkiraan Kas Akhir Periode</h4>
                  <p className="text-sm font-bold text-emerald-700 font-mono">
                    {forecastScenario === 'konservatif' ? 'Rp 734,5 jt' : forecastScenario === 'moderat' ? 'Rp 768,2 jt' : 'Rp 821,5 jt'}
                  </p>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-1">Status Daya Tahan Kas</h4>
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                    Runway 14+ Bulan (Sangat Aman)
                  </span>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* 🤖 TAB 3: AI BRAIN & SIMULATOR SKENARIO */}
        {activeNav === 'simulation' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 overflow-y-auto">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900">AI Simulator Skenario Keputusan Bisnis</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Uji ketahanan kas dan proyeksi runway terhadap keputusan strategis (rekrutmen, efisiensi gaji, Capex, atau kenaikan ads)
                </p>
              </div>

              {/* Input Prompt Skenario */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={simPrompt}
                  onChange={(e) => setSimPrompt(e.target.value)}
                  placeholder="Contoh: Pangkas 2 staf gaji 6jt selama 6 bulan..."
                  className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleRunSimulation}
                  disabled={simLoading}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap shadow-xs"
                >
                  {simLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>Jalankan Simulasi</span>
                </button>
              </div>

              {/* Quick Prompt Pills */}
              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                <span className="text-[11px] text-slate-400 font-medium py-1">Skenario cepat:</span>
                {[
                  'Pangkas 2 staf gaji 6jt selama 6 bulan',
                  'Tambah 3 sales gaji 5jt selama 12 bulan',
                  'Beli mesin baru capex 50jt',
                  'Naikkan budget marketing ads 20%',
                ].map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSimPrompt(s)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] transition-colors cursor-pointer"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Simulation Result */}
              {simResult && (
                <div className="mt-5 p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900">Hasil Proyeksi Dampak Strategis</h4>
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[11px] font-semibold whitespace-nowrap">
                      Horizon: {simResult.horizonMonths || 6} Bulan
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium">Perubahan Kas Netto</span>
                      <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-1 whitespace-nowrap">
                        {simResult.monthlyExpenseDelta < 0 ? (
                          <span className="text-emerald-600">Hemat {formatRupiah(Math.abs(simResult.monthlyExpenseDelta))}/bln</span>
                        ) : (
                          <span className="text-red-600">Beban +{formatRupiah(simResult.monthlyExpenseDelta)}/bln</span>
                        )}
                      </p>
                    </div>

                    <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium">Dampak ke Runway</span>
                      <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-1 whitespace-nowrap">
                        {simResult.runwayImpactMonths > 0 ? (
                          <span className="text-emerald-600">+{simResult.runwayImpactMonths} Bulan</span>
                        ) : (
                          <span className="text-amber-600">{simResult.runwayImpactMonths} Bulan</span>
                        )}
                      </p>
                    </div>

                    <div className="bg-white p-3.5 rounded-lg border border-slate-200">
                      <span className="text-[11px] text-slate-500 font-medium">Probabilitas Ketahanan</span>
                      <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-1 text-emerald-600 whitespace-nowrap">
                        {simResult.survivalProbability ?? '98%'} (Aman)
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 leading-relaxed">
                    💡 <strong>Analisis AI:</strong> {simResult.narrativeSummary || 'Keputusan ini memperkuat cadangan kas likuid perusahaan secara signifikan.'}
                  </p>
                </div>
              )}
            </div>
          </main>
        )}

        {/* 🏥 TAB 4: KESEHATAN & OPERASIONAL USAHA */}
        {activeNav === 'operations' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 overflow-y-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
              {/* Card 1: Skor Kesehatan Bisnis */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Skor Kesehatan Bisnis (KLIR Health Index)</h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold">
                    88 / 100 (Sehat)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden mb-4">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
                </div>
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Likuiditas Kas & Runway</span>
                    <span className="font-bold text-emerald-600">95 / 100</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Pertumbuhan Omset MoM</span>
                    <span className="font-bold text-blue-600">85 / 100</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Efisiensi Beban Operasional</span>
                    <span className="font-bold text-slate-900">82 / 100</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>Kepatuhan Pembukuan & Pajak</span>
                    <span className="font-bold text-emerald-600">90 / 100</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Ringkasan Tim & Beban SDM */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Tim & Beban Karyawan</h3>
                  <Users className="w-4 h-4 text-slate-400" />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Total Staf Aktif</span>
                    <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">18 Orang</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Beban Payroll Bulanan</span>
                    <p className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 whitespace-nowrap">Rp 90 jt</p>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Rasio beban payroll terhadap omset saat ini sebesar <strong>14.7%</strong> (berada dalam batas ideal industri 15-20%).
                </p>
              </div>
            </div>
          </main>
        )}

        {/* 📦 TAB 5: KATALOG & STOK BARANG */}
        {activeNav === 'inventory' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 space-y-5 overflow-y-auto">
            {/* 3 Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total SKU / Produk</span>
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono">
                  {inventoryData?.summary?.productCount ?? (inventoryData?.products?.length || 0)} <span className="text-xs text-slate-500 font-sans font-normal">SKU</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Total produk aktif yang terdaftar</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nilai Total Aset Stok</span>
                  <Wallet className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono">
                  {formatRupiah(inventoryData?.summary?.stockValue || 0)}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Valuasi stok berdasarkan harga modal (HPP)</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Peringatan Stok Menipis</span>
                  <AlertTriangle className={`w-4 h-4 ${(inventoryData?.summary?.lowStockCount || 0) > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
                </div>
                <div className={`text-xl sm:text-2xl font-bold font-mono ${(inventoryData?.summary?.lowStockCount || 0) > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                  {inventoryData?.summary?.lowStockCount || 0} <span className="text-xs text-slate-500 font-sans font-normal">Item</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Barang di bawah batas stok minimum</p>
              </div>
            </div>

            {/* Toolbar: Search, Filter, Action */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
                <div className="relative flex-1 sm:max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    placeholder="Cari nama barang atau SKU..."
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <select
                  value={inventoryCategory}
                  onChange={(e) => setInventoryCategory(e.target.value)}
                  className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="Bahan Baku">Bahan Baku</option>
                  <option value="Makanan">Makanan</option>
                  <option value="Minuman">Minuman</option>
                  <option value="Ritel">Ritel</option>
                  <option value="Kemasan">Kemasan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => void fetchInventory()}
                  disabled={inventoryLoading}
                  className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${inventoryLoading ? 'animate-spin' : ''}`} />
                  <span>Segarkan</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAddProductModalOpen(true)}
                  className="h-9 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah Barang Manual</span>
                </button>
              </div>
            </div>

            {/* Product Table */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Nama Produk & SKU</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4 text-right">Stok Fisik</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Harga Modal (HPP)</th>
                      <th className="py-3 px-4 text-right">Harga Jual</th>
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                    {inventoryLoading && !inventoryData ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-5 h-5 text-blue-600 animate-spin mx-auto mb-2" />
                          <span>Memuat katalog stok barang...</span>
                        </td>
                      </tr>
                    ) : filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-700">Belum ada barang yang tercatat</p>
                          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                            Klik tombol <strong>"Tambah Barang Manual"</strong> di atas atau unggah file daftar produk/stok Excel Anda ke tab <strong>Pusat Data</strong>.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p: any, idx: number) => {
                        const isLow = p.currentStock <= p.minStock && p.minStock > 0;
                        const isOut = p.currentStock <= 0;
                        return (
                          <tr key={p.id || idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-900">{p.name}</p>
                              <span className="font-mono text-[10px] text-slate-400">{p.sku || '-'}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                {p.category || 'Umum'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold">
                              {p.currentStock} <span className="text-[10px] text-slate-500 font-sans font-normal">{p.unit || 'pcs'}</span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isOut ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  Habis
                                </span>
                              ) : isLow ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                  Menipis (Min {p.minStock})
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Aman
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {formatRupiah(p.costPrice || 0)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900">
                              {formatRupiah(p.sellPrice || 0)}
                            </td>
                            <td className="py-3 px-4 text-slate-600">
                              {p.supplierName || '-'}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForAdjust(p);
                                  setAdjustType('IN');
                                  setAdjustQty('');
                                  setAdjustReason('Restock / Pembelian tambahan');
                                  setAdjustNote('');
                                  setAdjustError('');
                                  setAdjustModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold text-[11px] border border-slate-200 transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title="Ubah atau sesuaikan stok barang ini"
                              >
                                <ArrowUpDown className="w-3 h-3 text-slate-500" />
                                <span>Ubah Stok</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        )}

        {/* 📁 TAB 6: PUSAT DATA & LEGALITAS */}
        {activeNav === 'data-hub' && (
          <main className="flex-1 p-4 sm:p-5 lg:p-6 overflow-y-auto">
            <WorkspaceDataHub workspaceId={workspaceId} onClose={() => setActiveNav('overview')} />
          </main>
        )}
      </div>

      {/* 🔍 DRILLDOWN DETAIL MODAL */}
      {drilldownModal && drilldownModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-5 sm:p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">{drilldownModal.title}</h3>
                <span className="text-xs font-bold text-blue-600 font-mono">{drilldownModal.metric}</span>
              </div>
              <button
                onClick={() => setDrilldownModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">{drilldownModal.desc}</p>

            <div className="space-y-2 mb-5">
              {drilldownModal.details.map((d, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-slate-800">{d.label}</p>
                    {d.note && <p className="text-[10px] text-slate-400">{d.note}</p>}
                  </div>
                  <span className="font-bold text-slate-900 font-mono whitespace-nowrap">{d.value}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setDrilldownModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>
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

      {/* 📦 MODAL TAMBAH BARANG / SKU MANUAL */}
      {addProductModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Tambah Barang / SKU Manual</h3>
                  <p className="text-[11px] text-slate-500">Catat produk atau bahan baku baru ke inventori usaha</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddProductModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {productFormError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{productFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Barang / Produk <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Contoh: Kopi Susu Aren 250ml / Beras Ramos 5kg"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    SKU / Kode Barang
                  </label>
                  <input
                    type="text"
                    value={productForm.sku}
                    onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
                    placeholder="Contoh: KSA-001"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={productForm.category}
                    onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="Bahan Baku">Bahan Baku</option>
                    <option value="Makanan">Makanan</option>
                    <option value="Minuman">Minuman</option>
                    <option value="Ritel">Ritel / Produk Jadi</option>
                    <option value="Kemasan">Kemasan / Packaging</option>
                    <option value="Operasional">Operasional</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Stok Awal
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.openingStock}
                    onChange={(e) => setProductForm({ ...productForm, openingStock: e.target.value })}
                    placeholder="0"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Batas Min. Stok
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.minStock}
                    onChange={(e) => setProductForm({ ...productForm, minStock: e.target.value })}
                    placeholder="5"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Satuan
                  </label>
                  <input
                    type="text"
                    value={productForm.unit}
                    onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                    placeholder="pcs / kg / box"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Modal / Beli (HPP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={productForm.costPrice}
                      onChange={(e) => setProductForm({ ...productForm, costPrice: e.target.value })}
                      placeholder="15000"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Harga Jual
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      min="0"
                      value={productForm.sellPrice}
                      onChange={(e) => setProductForm({ ...productForm, sellPrice: e.target.value })}
                      placeholder="25000"
                      className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Supplier / Vendor (Opsional)
                </label>
                <input
                  type="text"
                  value={productForm.supplierName}
                  onChange={(e) => setProductForm({ ...productForm, supplierName: e.target.value })}
                  placeholder="Contoh: CV Sumber Makmur / Toko Bahan Sejahtera"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAddProductModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingProduct}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
                >
                  {submittingProduct && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{submittingProduct ? 'Menyimpan...' : 'Simpan Barang'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 📦 MODAL UBAH / SESUAIKAN STOK BARANG */}
      {adjustModalOpen && selectedProductForAdjust && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">Ubah / Sesuaikan Stok</h3>
                <p className="text-[11px] text-slate-500">
                  {selectedProductForAdjust.name} ({selectedProductForAdjust.sku || 'No SKU'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {adjustError && (
              <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleStockAdjust} className="space-y-4">
              {/* Info Stok Saat Ini */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Stok Fisik Saat Ini:</span>
                <span className="text-sm font-bold font-mono text-slate-900">
                  {selectedProductForAdjust.currentStock} {selectedProductForAdjust.unit || 'pcs'}
                </span>
              </div>

              {/* Tipe Aksi: Masuk vs Keluar */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Arah Perubahan Stok
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('IN');
                      setAdjustReason('Restock / Pembelian tambahan');
                    }}
                    className={`h-9 px-3 rounded-lg text-xs font-bold border transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      adjustType === 'IN'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>+ Stok Masuk (Tambah)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustType('OUT');
                      setAdjustReason('Barang rusak / kedaluwarsa');
                    }}
                    className={`h-9 px-3 rounded-lg text-xs font-bold border transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer ${
                      adjustType === 'OUT'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>- Stok Keluar (Kurang)</span>
                  </button>
                </div>
              </div>

              {/* Jumlah Perubahan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Jumlah Perubahan ({selectedProductForAdjust.unit || 'pcs'}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="Contoh: 10"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {adjustQty && Number(adjustQty) > 0 && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Estimasi stok akhir:{' '}
                    <strong className="font-mono text-slate-800">
                      {adjustType === 'IN'
                        ? selectedProductForAdjust.currentStock + Number(adjustQty)
                        : Math.max(0, selectedProductForAdjust.currentStock - Number(adjustQty))}{' '}
                      {selectedProductForAdjust.unit || 'pcs'}
                    </strong>
                  </p>
                )}
              </div>

              {/* Alasan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Alasan Perubahan *
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {adjustType === 'IN' ? (
                    <>
                      <option value="Restock / Pembelian tambahan">Restock / Pembelian tambahan</option>
                      <option value="Koreksi stok opname (stok fisik lebih)">Koreksi stok opname (stok fisik lebih)</option>
                      <option value="Retur dari pelanggan">Retur dari pelanggan</option>
                      <option value="Bonus supplier / kiriman sampel">Bonus supplier / kiriman sampel</option>
                      <option value="Penyesuaian manual">Penyesuaian manual lainnya</option>
                    </>
                  ) : (
                    <>
                      <option value="Barang rusak / kedaluwarsa">Barang rusak / kedaluwarsa</option>
                      <option value="Barang hilang / selisih opname">Barang hilang / selisih opname</option>
                      <option value="Pemakaian sendiri / sampel promosi">Pemakaian sendiri / sampel promosi</option>
                      <option value="Retur ke supplier">Retur ke supplier</option>
                      <option value="Penjualan manual">Penjualan manual</option>
                    </>
                  )}
                </select>
              </div>

              {/* Catatan Tambahan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="Mis. No. surat jalan / nota retur"
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-70"
                >
                  {adjustSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{adjustSubmitting ? 'Memproses...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
