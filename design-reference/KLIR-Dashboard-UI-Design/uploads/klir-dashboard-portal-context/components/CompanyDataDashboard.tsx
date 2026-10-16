'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { ApexOptions } from 'apexcharts';

// Clean ApexCharts wrapper to strictly guarantee 1 single chart in DOM with 0 ghosts
function CleanApexChart({
  options,
  series,
  type = 'area',
  height = 230,
}: {
  options: ApexOptions;
  series: any[];
  type?: string;
  height?: number | string;
}) {
  const chartRef = React.useRef<HTMLDivElement>(null);
  const chartInstance = React.useRef<any>(null);

  const serializedOptions = React.useMemo(() => JSON.stringify(options), [options]);
  const serializedSeries = React.useMemo(() => JSON.stringify(series), [series]);

  React.useEffect(() => {
    if (!chartRef.current) return;

    // Destroy existing instance
    if (chartInstance.current) {
      try {
        chartInstance.current.destroy();
      } catch (e) {}
      chartInstance.current = null;
    }

    // Force wipe container innerHTML
    chartRef.current.innerHTML = '';

    let isCancelled = false;
    import('apexcharts').then((ApexModule) => {
      if (isCancelled || !chartRef.current) return;
      const ApexCharts = ApexModule.default || ApexModule;
      
      // Make sure container is completely clean before rendering
      chartRef.current.innerHTML = '';

      const chart = new ApexCharts(chartRef.current, {
        ...options,
        chart: {
          ...options.chart,
          type,
          height,
        },
        series,
      });

      chart.render();
      chartInstance.current = chart;
    });

    return () => {
      isCancelled = true;
      if (chartInstance.current) {
        try {
          chartInstance.current.destroy();
        } catch (e) {}
        chartInstance.current = null;
      }
      if (chartRef.current) {
        chartRef.current.innerHTML = '';
      }
    };
  }, [serializedOptions, serializedSeries, type, height]);

  return (
    <div
      ref={chartRef}
      className="w-full flex items-center justify-center"
      style={{ minHeight: typeof height === 'number' ? `${height}px` : height }}
    />
  );
}
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Briefcase,
  Building,
  ShieldCheck,
  Activity,
  Layers,
  FileText,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  BarChart2,
  PieChart,
  Target,
  ArrowUpRight,
  Info,
  Bot,
  Zap,
  ArrowRight,
} from 'lucide-react';

interface CompanyDataDashboardProps {
  workspaceName?: string;
  userName?: string;
  activeNav?: 'dashboard' | 'ai-assistant';
  onNavChange?: (nav: 'dashboard' | 'ai-assistant') => void;
}

export default function CompanyDataDashboard({
  workspaceName = 'Anitech Workspace',
  userName = 'Nime Nimasi',
  activeNav = 'dashboard',
  onNavChange,
}: CompanyDataDashboardProps) {
  // Real-time Business Metrics State (Synchronized with AI Assistant)
  const [financials, setFinancials] = useState({
    netCashBalance: 25500000,
    revenue30d: 34250000,
    expense30d: 8750000,
    grossProfit: 25500000,
    grossMarginPercent: 74,
    netProfit: 22500000,
    netMarginPercent: 65.6,
    runwayMonths: 99,
  });

  const [marketing, setMarketing] = useState({
    blendedRoas: 3.5,
    attributedRevenue: 13700000,
    totalLeads: 245,
    cac: 45000,
    activeCampaignsCount: 4,
  });

  const [teamOps, setTeamOps] = useState({
    totalEmployees: 14,
    teamUtilizationPercent: 92,
    pendingTasksCount: 12,
    slaCompletionRate: 88,
    divisions: [
      { name: 'Engineering & Tech', members: 5, loadPercent: 82, status: 'NORMAL' },
      { name: 'Marketing & Creative', members: 4, loadPercent: 95, status: 'OVERLOAD' },
      { name: 'Sales & Business Dev', members: 3, loadPercent: 78, status: 'NORMAL' },
      { name: 'Finance & Operations', members: 2, loadPercent: 90, status: 'BUSY' },
    ],
  });

  const [companyProfile] = useState({
    companyName: 'PT Anitech Digital Solusindo',
    brandName: 'Anitech Enterprise',
    industry: 'Software & Technology Agency',
    activeClientsCount: 28,
    businessLicense: 'NIB: 9120008123901 • NPWP Terverifikasi',
    enterpriseTier: 'KLIR Enterprise Business OS',
  });

  const [healthScore, setHealthScore] = useState({
    totalScore: 85,
    grade: 'EXCELLENT',
    breakdown: {
      finance: 95,
      growth: 100,
      operations: 35,
      strategy: 100,
    },
  });

  // Live Directives from AI Assistant
  const [activeAIDirectives, setActiveAIDirectives] = useState<any[]>([
    {
      id: 'dir-initial',
      type: 'SCALE_ADS',
      title: 'Optimasi AI: Peningkatan Anggaran Iklan TikTok +20%',
      impact: 'Proyeksi kenaikan omset teratribusi +Rp 6.200.000 / bulan',
      timestamp: 'Aktif via AI Assistant',
      status: 'EXECUTED',
    },
  ]);

  // Collapsible Monthly Chart States per Sector
  const [showFinanceChart, setShowFinanceChart] = useState(false);
  const [showMarketingChart, setShowMarketingChart] = useState(false);
  const [showTeamChart, setShowTeamChart] = useState(false);

  // Client-side hydration check to prevent duplicate ApexChart rendering
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Master Synchronized Month Filter (Controls Entire Dashboard Overview & Sectors)
  const [selectedMonth, setSelectedMonth] = useState<string>('Agu');
  const selectedFinanceMonth = selectedMonth;
  const selectedMarketingMonth = selectedMonth;
  const selectedTeamMonth = selectedMonth;
  const setSelectedFinanceMonth = (m: string) => setSelectedMonth(m);
  const setSelectedMarketingMonth = (m: string) => setSelectedMonth(m);
  const setSelectedTeamMonth = (m: string) => setSelectedMonth(m);

  // 1. DATASET BULANAN KEUANGAN
  const financeMonthlyMap: Record<string, {
    monthName: string;
    revenue: number;
    expense: number;
    grossProfit: number;
    netProfit: number;
    netMargin: number;
    growthMoM: string;
    hpp: number;
    opsExpense: number;
    marketingExpense: number;
    payrollExpense: number;
    unpaidPiutang: number;
  }> = {
    Jan: { monthName: 'Januari 2026', revenue: 21000000, expense: 7200000, grossProfit: 15600000, netProfit: 13800000, netMargin: 65.7, growthMoM: '+15.2%', hpp: 2200000, opsExpense: 1800000, marketingExpense: 1200000, payrollExpense: 2000000, unpaidPiutang: 4500000 },
    Feb: { monthName: 'Februari 2026', revenue: 23500000, expense: 7500000, grossProfit: 17800000, netProfit: 16000000, netMargin: 68.1, growthMoM: '+11.9%', hpp: 2300000, opsExpense: 1900000, marketingExpense: 1300000, payrollExpense: 2000000, unpaidPiutang: 6200000 },
    Mar: { monthName: 'Maret 2026', revenue: 25800000, expense: 7800000, grossProfit: 19800000, netProfit: 18000000, netMargin: 69.8, growthMoM: '+9.8%', hpp: 2400000, opsExpense: 2000000, marketingExpense: 1400000, payrollExpense: 2000000, unpaidPiutang: 8400000 },
    Apr: { monthName: 'April 2026', revenue: 28000000, expense: 8100000, grossProfit: 21600000, netProfit: 19900000, netMargin: 71.1, growthMoM: '+8.5%', hpp: 2500000, opsExpense: 2100000, marketingExpense: 1500000, payrollExpense: 2000000, unpaidPiutang: 11000000 },
    Mei: { monthName: 'Mei 2026', revenue: 29500000, expense: 8300000, grossProfit: 23000000, netProfit: 21200000, netMargin: 71.9, growthMoM: '+5.4%', hpp: 2600000, opsExpense: 2100000, marketingExpense: 1600000, payrollExpense: 2000000, unpaidPiutang: 14200000 },
    Jun: { monthName: 'Juni 2026', revenue: 31000000, expense: 8500000, grossProfit: 24200000, netProfit: 22500000, netMargin: 72.6, growthMoM: '+5.1%', hpp: 2700000, opsExpense: 2200000, marketingExpense: 1600000, payrollExpense: 2000000, unpaidPiutang: 16800000 },
    Jul: { monthName: 'Juli 2026', revenue: 32800000, expense: 8600000, grossProfit: 25800000, netProfit: 24200000, netMargin: 73.8, growthMoM: '+5.8%', hpp: 2750000, opsExpense: 2250000, marketingExpense: 1600000, payrollExpense: 2000000, unpaidPiutang: 18500000 },
    Agu: { monthName: 'Agustus 2026 (Bulan Berjalan)', revenue: 34250000, expense: 8750000, grossProfit: 25500000, netProfit: 25500000, netMargin: 74.4, growthMoM: '+4.4%', hpp: 2800000, opsExpense: 2350000, marketingExpense: 1600000, payrollExpense: 2000000, unpaidPiutang: 19425000 },
    Sep: { monthName: 'September 2026 (Periode Baru Mulai)', revenue: 0, expense: 0, grossProfit: 0, netProfit: 0, netMargin: 0, growthMoM: 'Baru Mulai', hpp: 0, opsExpense: 0, marketingExpense: 0, payrollExpense: 0, unpaidPiutang: 0 },
    YTD: { monthName: 'Rekap Historis Tahunan 2026 (YTD)', revenue: 225850000, expense: 64750000, grossProfit: 173800000, netProfit: 161100000, netMargin: 71.3, growthMoM: '+12.4% Avg', hpp: 20250000, opsExpense: 16700000, marketingExpense: 11800000, payrollExpense: 16000000, unpaidPiutang: 19425000 },
  };

  // 2. DATASET BULANAN MARKETING
  const marketingMonthlyMap: Record<string, {
    monthName: string;
    adSpend: number;
    attributedRevenue: number;
    roas: number;
    leads: number;
    cac: number;
    convRate: string;
    metaShare: number;
    tiktokShare: number;
    googleShare: number;
  }> = {
    Jan: { monthName: 'Januari 2026', adSpend: 2500000, attributedRevenue: 6000000, roas: 2.4, leads: 110, cac: 54000, convRate: '3.8%', metaShare: 55, tiktokShare: 30, googleShare: 15 },
    Feb: { monthName: 'Februari 2026', adSpend: 2800000, attributedRevenue: 7200000, roas: 2.6, leads: 130, cac: 52000, convRate: '4.1%', metaShare: 52, tiktokShare: 33, googleShare: 15 },
    Mar: { monthName: 'Maret 2026', adSpend: 3200000, attributedRevenue: 8900000, roas: 2.8, leads: 155, cac: 49500, convRate: '4.4%', metaShare: 50, tiktokShare: 35, googleShare: 15 },
    Apr: { monthName: 'April 2026', adSpend: 3500000, attributedRevenue: 10100000, roas: 2.9, leads: 175, cac: 48000, convRate: '4.6%', metaShare: 48, tiktokShare: 38, googleShare: 14 },
    Mei: { monthName: 'Mei 2026', adSpend: 3800000, attributedRevenue: 11500000, roas: 3.0, leads: 195, cac: 47200, convRate: '4.9%', metaShare: 46, tiktokShare: 40, googleShare: 14 },
    Jun: { monthName: 'Juni 2026', adSpend: 4200000, attributedRevenue: 12800000, roas: 3.1, leads: 215, cac: 46500, convRate: '5.2%', metaShare: 45, tiktokShare: 42, googleShare: 13 },
    Jul: { monthName: 'Juli 2026', adSpend: 4800000, attributedRevenue: 14500000, roas: 3.3, leads: 230, cac: 45800, convRate: '5.5%', metaShare: 44, tiktokShare: 44, googleShare: 12 },
    Agu: { monthName: 'Agustus 2026 (Bulan Berjalan)', adSpend: 5200000, attributedRevenue: 18200000, roas: 3.5, leads: 245, cac: 45000, convRate: '5.8%', metaShare: 45, tiktokShare: 43, googleShare: 12 },
    Sep: { monthName: 'September 2026 (Periode Baru Mulai)', adSpend: 0, attributedRevenue: 0, roas: 0, leads: 0, cac: 0, convRate: '0%', metaShare: 0, tiktokShare: 0, googleShare: 0 },
    YTD: { monthName: 'Rekap Historis Tahunan 2026 (YTD)', adSpend: 30000000, attributedRevenue: 89200000, roas: 2.97, leads: 1455, cac: 48500, convRate: '4.8%', metaShare: 48, tiktokShare: 38, googleShare: 14 },
  };

  // 3. DATASET BULANAN KARYAWAN & SDM
  const teamMonthlyMap: Record<string, {
    monthName: string;
    totalStaff: number;
    workloadPercent: number;
    overloadCount: number;
    completedTasks: number;
    slaPercent: number;
    payrollTotal: number;
    engLoad: number;
    mktLoad: number;
    salesLoad: number;
    finLoad: number;
  }> = {
    Jan: { monthName: 'Januari 2026', totalStaff: 10, workloadPercent: 68, overloadCount: 0, completedTasks: 88, slaPercent: 94, payrollTotal: 62000000, engLoad: 68, mktLoad: 72, salesLoad: 62, finLoad: 70 },
    Feb: { monthName: 'Februari 2026', totalStaff: 11, workloadPercent: 72, overloadCount: 1, completedTasks: 95, slaPercent: 93, payrollTotal: 68000000, engLoad: 72, mktLoad: 82, salesLoad: 65, finLoad: 68 },
    Mar: { monthName: 'Maret 2026', totalStaff: 12, workloadPercent: 75, overloadCount: 1, completedTasks: 112, slaPercent: 92, payrollTotal: 74000000, engLoad: 74, mktLoad: 85, salesLoad: 70, finLoad: 72 },
    Apr: { monthName: 'April 2026', totalStaff: 12, workloadPercent: 79, overloadCount: 2, completedTasks: 124, slaPercent: 90, payrollTotal: 74000000, engLoad: 76, mktLoad: 88, salesLoad: 74, finLoad: 78 },
    Mei: { monthName: 'Mei 2026', totalStaff: 13, workloadPercent: 83, overloadCount: 2, completedTasks: 138, slaPercent: 89, payrollTotal: 80000000, engLoad: 79, mktLoad: 90, salesLoad: 78, finLoad: 84 },
    Jun: { monthName: 'Juni 2026', totalStaff: 13, workloadPercent: 86, overloadCount: 3, completedTasks: 145, slaPercent: 88, payrollTotal: 80000000, engLoad: 80, mktLoad: 92, salesLoad: 82, finLoad: 88 },
    Jul: { monthName: 'Juli 2026', totalStaff: 14, workloadPercent: 89, overloadCount: 3, completedTasks: 160, slaPercent: 88, payrollTotal: 86000000, engLoad: 81, mktLoad: 94, salesLoad: 76, finLoad: 89 },
    Agu: { monthName: 'Agustus 2026 (Bulan Berjalan)', totalStaff: 14, workloadPercent: 92, overloadCount: 4, completedTasks: 172, slaPercent: 88, payrollTotal: 86000000, engLoad: 82, mktLoad: 95, salesLoad: 78, finLoad: 90 },
    Sep: { monthName: 'September 2026 (Periode Baru Mulai)', totalStaff: 14, workloadPercent: 0, overloadCount: 0, completedTasks: 0, slaPercent: 100, payrollTotal: 86000000, engLoad: 0, mktLoad: 0, salesLoad: 0, finLoad: 0 },
    YTD: { monthName: 'Rekap Historis Tahunan 2026 (YTD)', totalStaff: 14, workloadPercent: 81, overloadCount: 2, completedTasks: 1034, slaPercent: 90, payrollTotal: 610000000, engLoad: 77, mktLoad: 87, salesLoad: 73, finLoad: 79 },
  };

  // Load / Sync State with localStorage & Custom Events
  const syncFromStorage = () => {
    try {
      const savedState = localStorage.getItem('klir_live_company_state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.financials) {
          setFinancials((prev) => ({
            ...prev,
            ...parsed.financials,
            netCashBalance: parsed.financials.netCashBalance ?? parsed.financials.cleanCashBalance ?? prev.netCashBalance ?? 25500000,
            revenue30d: parsed.financials.revenue30d ?? parsed.financials.revenue ?? prev.revenue30d ?? 34250000,
            expense30d: parsed.financials.expense30d ?? parsed.financials.expense ?? prev.expense30d ?? 8750000,
            grossProfit: parsed.financials.grossProfit ?? prev.grossProfit ?? 25500000,
            netProfit: parsed.financials.netProfit ?? parsed.financials.cleanCashBalance ?? prev.netProfit ?? 22500000,
            netMarginPercent: parsed.financials.netMarginPercent ?? parsed.financials.grossMargin ?? prev.netMarginPercent ?? 65.6,
            runwayMonths: parsed.financials.runwayMonths ?? prev.runwayMonths ?? 99,
          }));
        }
        if (parsed.marketing) {
          setMarketing((prev) => ({
            ...prev,
            ...parsed.marketing,
            blendedRoas: parsed.marketing.blendedRoas ?? prev.blendedRoas ?? 3.5,
            attributedRevenue: parsed.marketing.attributedRevenue ?? prev.attributedRevenue ?? 13700000,
            totalLeads: parsed.marketing.totalLeads ?? parsed.marketing.totalLeads30d ?? prev.totalLeads ?? 245,
            cac: parsed.marketing.cac ?? parsed.marketing.cacCurrent ?? prev.cac ?? 45000,
          }));
        }
        if (parsed.teamOps) setTeamOps((prev) => ({ ...prev, ...parsed.teamOps }));
        if (parsed.healthScore) setHealthScore((prev) => ({ ...prev, ...parsed.healthScore }));
        if (parsed.directives && Array.isArray(parsed.directives)) setActiveAIDirectives(parsed.directives);
      }
    } catch (e) {
      console.warn('Sync error:', e);
    }
  };

  useEffect(() => {
    syncFromStorage();
    const handleSync = () => syncFromStorage();
    window.addEventListener('klir-ai-state-updated', handleSync);
    window.addEventListener('klir-kas-updated', handleSync);
    window.addEventListener('klir-mkt-updated', handleSync);
    window.addEventListener('klir-campaign-deployed', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('klir-ai-state-updated', handleSync);
      window.removeEventListener('klir-kas-updated', handleSync);
      window.removeEventListener('klir-mkt-updated', handleSync);
      window.removeEventListener('klir-campaign-deployed', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Export to Excel / CSV (Formatted XLS)
  const handleExportExcel = () => {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const excelContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <style>
            body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; }
            .header-banner { background-color: #4F46E5; color: #FFFFFF; font-size: 16pt; font-weight: bold; text-align: center; height: 45px; vertical-align: middle; }
            .sub-banner { background-color: #EEF2FF; color: #3730A3; font-size: 10pt; font-style: italic; text-align: center; height: 25px; }
            .section-header { background-color: #1E293B; color: #FFFFFF; font-size: 12pt; font-weight: bold; height: 32px; vertical-align: middle; padding-left: 10px; }
            .th-header { background-color: #334155; color: #FFFFFF; font-weight: bold; text-align: center; border: 1px solid #94A3B8; height: 28px; }
            .td-cell { border: 1px solid #CBD5E1; padding: 6px 10px; vertical-align: middle; }
            .td-num { border: 1px solid #CBD5E1; padding: 6px 10px; text-align: right; font-family: 'Consolas', monospace; font-weight: bold; }
            .td-center { border: 1px solid #CBD5E1; padding: 6px 10px; text-align: center; }
            .row-even { background-color: #F8FAFC; }
            .row-odd { background-color: #FFFFFF; }
          </style>
        </head>
        <body>
          <table>
            <tr>
              <td colspan="5" class="header-banner">LAPORAN KEUANGAN & EKSEKUTIF PERUSAHAAN — KLIR OS</td>
            </tr>
            <tr>
              <td colspan="5" class="sub-banner">PT Anitech Digital Solusindo • Tanggal: ${today.toLocaleDateString('id-ID', { dateStyle: 'full' })} • Status: Verified Live Data</td>
            </tr>
            <tr><td colspan="5" style="height: 15px;"></td></tr>

            <tr>
              <td colspan="5" class="section-header">1. RINGKASAN ARUS KAS & FINANSIAL BISNIS</td>
            </tr>
            <tr>
              <td class="th-header" style="width: 260px;">Indikator Keuangan</td>
              <td class="th-header" style="width: 180px;">Nominal (IDR)</td>
              <td class="th-header" colspan="3">Keterangan & Target</td>
            </tr>
            <tr class="row-odd">
              <td class="td-cell"><strong>Saldo Kas Bersih</strong></td>
              <td class="td-num" style="color: #10B981;">Rp ${financials.netCashBalance.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="3">Dana kas likuid siap pakai (Runway: ${financials.runwayMonths}+ bulan)</td>
            </tr>
            <tr class="row-even">
              <td class="td-cell"><strong>Pendapatan 30 Hari (Revenue)</strong></td>
              <td class="td-num" style="color: #10B981;">Rp ${financials.revenue30d.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="3">Pertumbuhan MoM meningkat +28.5%</td>
            </tr>
            <tr class="row-odd">
              <td class="td-cell"><strong>Pengeluaran & HPP (Expense)</strong></td>
              <td class="td-num" style="color: #EF4444;">Rp ${financials.expense30d.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="3">Efisiensi pengeluaran optimal (-12.2%)</td>
            </tr>
            <tr class="row-even">
              <td class="td-cell"><strong>Laba Kotor</strong></td>
              <td class="td-num">Rp ${financials.grossProfit.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="3">Gross Margin stabil di ${financials.netMarginPercent}%</td>
            </tr>
            <tr class="row-odd">
              <td class="td-cell"><strong>Laba Bersih (Net Profit)</strong></td>
              <td class="td-num" style="color: #10B981;">Rp ${financials.netProfit.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="3">Net Margin 65.6% — Sangat Sehat (Grade A)</td>
            </tr>
            <tr><td colspan="5" style="height: 20px;"></td></tr>

            <tr>
              <td colspan="5" class="section-header">2. METRIK MARKETING & PERTUMBUHAN</td>
            </tr>
            <tr>
              <td class="th-header">Metrik Pemasaran</td>
              <td class="th-header">Pencapaian</td>
              <td class="th-header" colspan="3">Benchmark / Target</td>
            </tr>
            <tr class="row-odd">
              <td class="td-cell">Blended ROAS</td>
              <td class="td-num" style="color: #10B981;">${marketing.blendedRoas}x</td>
              <td class="td-cell" colspan="3">Target minimum 3.0x terlampaui</td>
            </tr>
            <tr class="row-even">
              <td class="td-cell">Omset Teratribusi Iklan</td>
              <td class="td-num" style="color: #10B981;">Rp ${marketing.attributedRevenue.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="3">Dari 4 materi iklan aktif</td>
            </tr>
            <tr class="row-odd">
              <td class="td-cell">Total Leads Masuk</td>
              <td class="td-num">${marketing.totalLeads} Leads</td>
              <td class="td-cell" colspan="3">Biaya Akuisisi (CAC): Rp ${marketing.cac.toLocaleString('id-ID')} / lead</td>
            </tr>
            <tr><td colspan="5" style="height: 20px;"></td></tr>

            <tr>
              <td colspan="5" class="section-header">3. DATA DIVISI KARYAWAN / SDM</td>
            </tr>
            <tr>
              <td class="th-header" style="width: 260px;">Nama Divisi</td>
              <td class="th-header">Jumlah Staf</td>
              <td class="th-header">Tingkat Beban</td>
              <td class="th-header" colspan="2">Status Operasional</td>
            </tr>
            ${teamOps.divisions.map((d, idx) => `
              <tr class="${idx % 2 === 0 ? 'row-odd' : 'row-even'}">
                <td class="td-cell"><strong>${d.name}</strong></td>
                <td class="td-center">${d.members} Orang</td>
                <td class="td-center font-bold">${d.loadPercent}%</td>
                <td class="td-cell" colspan="2"><strong>${d.status}</strong></td>
              </tr>
            `).join('')}
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Laporan_Bisnis_Anitech_${dateStr}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Gagal download file: ' + err.message);
    }
  };

  // Export to PDF
  const handleExportPDF = () => {
    try {
      const today = new Date();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Mohon izinkan pop-up browser untuk mencetak/menyimpan PDF.');
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Laporan Bisnis & Keuangan - PT Anitech Digital Solusindo</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #0f172a; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; color: #6366f1; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
            .card-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; }
            .card-value { font-size: 20px; font-weight: 800; margin-top: 5px; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 10px; font-weight: 700; color: #475569; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .text-right { text-align: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">KLIR ENTERPRISE OS</div>
              <div style="font-size: 18px; font-weight: 700;">PT Anitech Digital Solusindo</div>
              <div style="font-size: 12px; color: #64748b;">NIB: 9120008123901 • Enterprise Verified</div>
            </div>
            <div style="text-align: right; font-size: 12px; color: #64748b;">
              <div><strong>Tanggal Cetak:</strong> ${today.toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
              <div><strong>Health Score:</strong> ${healthScore.totalScore}/100 (${healthScore.grade})</div>
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: 700;">1. Ringkasan Finansial Perusahaan</h3>
          <div class="grid">
            <div class="card">
              <div class="card-title">Saldo Kas Bersih</div>
              <div class="card-value">Rp ${financials.netCashBalance.toLocaleString('id-ID')}</div>
              <div style="font-size: 11px; color: #10b981; font-weight: 600;">Runway: ${financials.runwayMonths}+ Bulan</div>
            </div>
            <div class="card">
              <div class="card-title">Pendapatan 30 Hari</div>
              <div class="card-value" style="color: #10b981;">Rp ${financials.revenue30d.toLocaleString('id-ID')}</div>
              <div style="font-size: 11px; color: #10b981; font-weight: 600;">↑ +28.5% MoM</div>
            </div>
            <div class="card">
              <div class="card-title">Pengeluaran & HPP</div>
              <div class="card-value" style="color: #ef4444;">Rp ${financials.expense30d.toLocaleString('id-ID')}</div>
              <div style="font-size: 11px; color: #64748b;">Margin Bersih: ${financials.netMarginPercent}%</div>
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: 700;">2. Distribusi Divisi SDM & Beban Kerja</h3>
          <table>
            <thead>
              <tr>
                <th>Divisi</th>
                <th>Jumlah Anggota</th>
                <th>Tingkat Beban Kerja</th>
                <th>Status Operasional</th>
              </tr>
            </thead>
            <tbody>
              ${teamOps.divisions.map(d => `
                <tr>
                  <td><strong>${d.name}</strong></td>
                  <td>${d.members} Staf</td>
                  <td style="font-family: monospace; font-weight: 700;">${d.loadPercent}%</td>
                  <td>${d.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            Laporan Bisnis Eksekutif PT Anitech Digital Solusindo • Dicetak pada ${today.toLocaleString('id-ID')} via KLIR AI OS.
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err: any) {
      alert('Gagal membuat PDF: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-[#F5F7FA] font-sans pb-12 w-full max-w-[1360px] mx-auto">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER (CLEAN & MINIMAL) */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white">
              Dashboard Perusahaan
            </h1>
            <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[11px] font-mono font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span>Data Riil Terintegrasi AI</span>
            </div>
          </div>
          <p className="text-xs text-[#8A93A3] mt-1">
            Ringkasan menyeluruh Keuangan, Marketing, Karyawan/SDM, dan Profil Bisnis {companyProfile.companyName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* MASTER MONTH SELECTOR DIRECTLY IN TOP HEADER */}
          <div className="flex items-center gap-2 bg-[#0E121A] border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-xl shadow-xs transition-colors">
            <Calendar className="w-4 h-4 text-[#10B981]" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white font-bold text-xs focus:outline-none cursor-pointer pr-1"
            >
              <option value="Jan" className="bg-[#141820] text-white">Januari 2026</option>
              <option value="Feb" className="bg-[#141820] text-white">Februari 2026</option>
              <option value="Mar" className="bg-[#141820] text-white">Maret 2026</option>
              <option value="Apr" className="bg-[#141820] text-white">April 2026</option>
              <option value="Mei" className="bg-[#141820] text-white">Mei 2026</option>
              <option value="Jun" className="bg-[#141820] text-white">Juni 2026</option>
              <option value="Jul" className="bg-[#141820] text-white">Juli 2026</option>
              <option value="Agu" className="bg-[#141820] text-[#10B981] font-bold">Agustus 2026 (Aktif)</option>
              <option value="Sep" className="bg-[#141820] text-[#38BDF8] font-bold">September 2026</option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#D6E8FF] border border-white/10 text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            title="Download spreadsheet Excel laporan bisnis"
          >
            <span>📥 Export Excel</span>
          </button>
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3 py-1.5 rounded-xl bg-[#6366F1]/15 hover:bg-[#6366F1]/25 text-[#A5B4FC] border border-[#6366F1]/30 text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
            title="Cetak atau simpan Laporan Bisnis ke PDF"
          >
            <span>📄 Cetak PDF</span>
          </button>
        </div>
      </div>



      {/* ========================================================================= */}
      {/* 2. EXECUTIVE RADAR & 6-MONTH TRAJECTORY FORECAST */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Company Health Score Gauge (5 Cols) */}
        <div className="lg:col-span-5 bg-[#0E121A] border border-white/[0.08] rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3.5">
          <div className="flex items-center justify-between pb-1">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Company Health Score (CHS)</span>
              </span>
              <span className="text-[10px] text-[#8A93A3] block">Audit kesehatan 4 pilar fundamental bisnis</span>
            </div>
            <span className="text-[11px] text-[#10B981] font-mono font-bold bg-[#10B981]/15 border border-[#10B981]/30 px-2.5 py-1 rounded-lg">
              {healthScore.totalScore}/100 • {healthScore.grade}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center flex-1">
            {/* Gauge Circle */}
            <div className="sm:col-span-5 flex flex-col items-center justify-center text-center">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-white/10"
                    strokeWidth="3.2"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#10B981] transition-all duration-1000 ease-out"
                    strokeDasharray={`${healthScore.totalScore}, 100`}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-3xl font-extrabold font-mono text-white leading-none">
                    {healthScore.totalScore}
                  </span>
                  <span className="text-[9px] text-[#8A93A3] font-bold mt-0.5">/ 100</span>
                  <span className="text-[10px] text-[#10B981] font-bold mt-1">
                    {healthScore.grade}
                  </span>
                </div>
              </div>
            </div>

            {/* 4 Pillar Bars */}
            <div className="sm:col-span-7 space-y-2.5 text-xs">
              <div>
                <div className="flex justify-between text-[11px] text-[#8A93A3] mb-1">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                    Keuangan
                  </span>
                  <span className="font-mono text-[#10B981] font-bold">{healthScore.breakdown.finance}/100</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#10B981] rounded-full" style={{ width: `${healthScore.breakdown.finance}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#8A93A3] mb-1">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                    Pertumbuhan
                  </span>
                  <span className="font-mono text-[#60A5FA] font-bold">{healthScore.breakdown.growth}/100</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#3B82F6] rounded-full" style={{ width: `${healthScore.breakdown.growth}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#8A93A3] mb-1">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                    Operasional
                  </span>
                  <span className="font-mono text-[#F59E0B] font-bold">{healthScore.breakdown.operations}/100</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#F59E0B] rounded-full" style={{ width: `${healthScore.breakdown.operations}%` }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-[#8A93A3] mb-1">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                    Strategi
                  </span>
                  <span className="font-mono text-[#C4B5FD] font-bold">{healthScore.breakdown.strategy}/100</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: `${healthScore.breakdown.strategy}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Bottom AI Insight Footer */}
          <div className="p-2.5 bg-[#141820] border border-white/5 rounded-xl flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-[#8A93A3]">
              <Sparkles className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
              <span>Status Operasional perlu perhatian beban tim (35/100)</span>
            </div>
            <span className="text-[#10B981] font-bold text-[10px] font-mono shrink-0">Audit AI Aktif</span>
          </div>
        </div>

        {/* 6-Month Actual Growth Trend Chart (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0E121A] border border-white/[0.08] rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h3 className="font-heading font-bold text-sm text-white">
                Tren Kinerja & Pertumbuhan 6 Bulan Terakhir
              </h3>
              <span className="text-[10px] text-[#8A93A3]">Data historis riil Maret 2026 s/d Agustus 2026 (Bulan Berjalan)</span>
            </div>
          </div>

          {(() => {
            const trajectoryCategories = ['Mar 2026', 'Apr 2026', 'Mei 2026', 'Jun 2026', 'Jul 2026', 'Agu 2026'];
            const trajectorySeries = [
              {
                name: 'Omset / Pendapatan',
                data: [
                  financeMonthlyMap['Mar'].revenue,
                  financeMonthlyMap['Apr'].revenue,
                  financeMonthlyMap['Mei'].revenue,
                  financeMonthlyMap['Jun'].revenue,
                  financeMonthlyMap['Jul'].revenue,
                  financials.revenue || financeMonthlyMap['Agu'].revenue
                ]
              },
              {
                name: 'Laba Bersih Bisnis',
                data: [
                  financeMonthlyMap['Mar'].netProfit,
                  financeMonthlyMap['Apr'].netProfit,
                  financeMonthlyMap['Mei'].netProfit,
                  financeMonthlyMap['Jun'].netProfit,
                  financeMonthlyMap['Jul'].netProfit,
                  financials.netCashBalance || financeMonthlyMap['Agu'].netProfit
                ]
              }
            ];

            const trajectoryOptions: ApexOptions = {
              chart: {
                id: 'apex-trajectory-projection',
                type: 'area',
                background: 'transparent',
                toolbar: { show: false },
                zoom: { enabled: false },
                animations: { enabled: true, easing: 'easeinout', speed: 600 }
              },
              colors: ['#10B981', '#38BDF8'],
              stroke: {
                curve: 'smooth',
                width: [3, 2.5],
                dashArray: [0, 0]
              },
              fill: {
                type: 'gradient',
                gradient: {
                  shadeIntensity: 1,
                  opacityFrom: 0.35,
                  opacityTo: 0.04,
                  stops: [0, 90, 100]
                }
              },
              markers: {
                size: 4,
                strokeColors: '#0E121A',
                strokeWidth: 2,
                hover: { size: 6 }
              },
              dataLabels: { enabled: false },
              grid: {
                borderColor: 'rgba(255, 255, 255, 0.06)',
                strokeDashArray: 3,
                padding: { left: 15, right: 10 },
                xaxis: { lines: { show: true } },
                yaxis: { lines: { show: true } }
              },
              xaxis: {
                categories: trajectoryCategories,
                labels: {
                  style: { colors: '#94A3B8', fontSize: '11px', fontWeight: 600 }
                },
                axisBorder: { show: false },
                axisTicks: { show: false }
              },
              yaxis: {
                opposite: true,
                labels: {
                  formatter: (val: number) => {
                    if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)} Miliar`;
                    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(0)} Jt`;
                    if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)} Rb`;
                    return `Rp ${val}`;
                  },
                  style: { colors: '#64748B', fontSize: '10px' }
                }
              },
              legend: {
                position: 'top',
                horizontalAlign: 'left',
                labels: { colors: '#94A3B8' },
                fontSize: '11px',
                markers: { shape: 'circle' }
              },
              tooltip: {
                theme: 'dark',
                y: {
                  formatter: (val: number) => `Rp ${val.toLocaleString('id-ID')}`
                }
              }
            };

            return (
              <div className="bg-[#141820] p-2.5 rounded-xl border border-white/5 w-full min-h-[190px]">
                {isMounted ? (
                  <CleanApexChart
                    key="apex-trajectory-6m"
                    type="area"
                    height={180}
                    series={trajectorySeries}
                    options={trajectoryOptions}
                  />
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-xs text-[#8A93A3]">
                    Memuat grafik tren...
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SECTOR 1: DATA KEUANGAN (FINANCIAL SECTOR WITH MONTHLY CHART) */}
      {/* ========================================================================= */}
      <div className="bg-[#0E121A] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#10B981]/20 text-[#10B981]">
              <DollarSign className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-bold text-base text-white">
              1. Data Keuangan & Arus Kas Bisnis
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFinanceChart(!showFinanceChart)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 ${
                showFinanceChart
                  ? 'bg-[#10B981] text-white shadow-md shadow-[#10B981]/20'
                  : 'bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/30'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{showFinanceChart ? 'Tutup Grafik' : 'Lihat Grafik'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showFinanceChart ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* 5 Financial Metric Cards */}
        {(() => {
          const fin = financeMonthlyMap[selectedMonth] || financeMonthlyMap['Agu'];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Saldo Kas Bersih</span>
                <div className="text-base font-bold font-mono text-white">
                  Rp {(fin.revenue > 0 ? (financials?.netCashBalance ?? financials?.cleanCashBalance ?? 25500000) : 25500000).toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-[#10B981] font-semibold block">Runway: {financials?.runwayMonths ?? 99}+ bln</span>
              </div>

              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Pendapatan ({selectedMonth})</span>
                <div className="text-base font-bold font-mono text-[#10B981]">
                  Rp {(fin.revenue ?? 0).toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-[#10B981] font-semibold block">MoM: {fin.growthMoM}</span>
              </div>

              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Pengeluaran & HPP</span>
                <div className="text-base font-bold font-mono text-[#EF4444]">
                  Rp {(fin.expense ?? 0).toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-[#8A93A3] block">HPP + Operasional</span>
              </div>

              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Laba Kotor</span>
                <div className="text-base font-bold font-mono text-white">
                  Rp {(fin.grossProfit ?? 0).toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-[#10B981] font-semibold block">Margin: {fin.netMargin}%</span>
              </div>

              <div className="p-3.5 bg-gradient-to-r from-[#0058BE]/20 to-[#0E121A] border border-[#00D2FF]/30 rounded-xl space-y-1">
                <span className="text-[#D6E8FF] text-[11px] block font-semibold">Laba Bersih Usaha</span>
                <div className="text-base font-bold font-mono text-[#3FBF8F]">
                  +Rp {(fin.netProfit ?? 0).toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-[#3FBF8F] font-bold block">{fin.netProfit > 0 ? 'Sangat Sehat' : 'Mulai Baru'}</span>
              </div>
            </div>
          );
        })()}

        {/* 📊 COLLAPSIBLE MONTHLY FINANCIAL CHART & SINGLE-MONTH DETAILS */}
        {showFinanceChart && (
          <div className="p-5 bg-[#0A0D14] border border-[#10B981]/25 rounded-2xl space-y-5 animate-fadeIn mt-4">
            {/* Selected Single Month Visual Chart & Analytics */}
            {(() => {
              const fin = financeMonthlyMap[selectedMonth] || financeMonthlyMap['Agu'];
              return (
                <div className="space-y-4">
                  {/* 📊 SIDE-BY-SIDE: APEXCHARTS AREA LINE GRAPH (LEFT) & RINCIAN (RIGHT) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Left: Interactive Full-Height ApexCharts Area Chart (7 Cols) */}
                    <div className="lg:col-span-7 bg-[#0E121A] p-4 rounded-xl border border-white/5 flex flex-col justify-between space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-white uppercase tracking-wider block">
                            Grafik Arus Kas & Komponen Biaya Harian — {fin.monthName}
                          </span>
                          <span className="text-[10px] text-[#8A93A3]">Fluktuasi harian Omset, HPP Proyek, Beban, dan Laba Bersih</span>
                        </div>
                      </div>

                      {/* ApexCharts Area Chart for Sector 1 */}
                      {(() => {
                        const categories = ['Tgl 01', 'Tgl 06', 'Tgl 12', 'Tgl 18', 'Tgl 24', 'Tgl 30'];

                        const series = [
                          {
                            name: 'Omset / Pendapatan',
                            data: [0.18, 0.35, 0.58, 0.74, 0.89, 1.0].map(m => Math.round(fin.revenue * m))
                          },
                          {
                            name: 'Laba Bersih',
                            data: [0.12, 0.30, 0.54, 0.72, 0.87, 1.0].map(m => Math.round(fin.netProfit * m))
                          },
                          {
                            name: 'HPP Proyek',
                            data: [0.10, 0.25, 0.48, 0.68, 0.84, 1.0].map(m => Math.round(fin.hpp * m))
                          },
                          {
                            name: 'Beban Operasional',
                            data: [0.15, 0.32, 0.52, 0.70, 0.88, 1.0].map(m => Math.round(fin.opsExpense * m))
                          }
                        ];

                        const options: ApexOptions = {
                          chart: {
                            id: `apex-fin-${selectedFinanceMonth}`,
                            type: 'area',
                            background: 'transparent',
                            toolbar: { show: false },
                            zoom: { enabled: false },
                            animations: { enabled: true, easing: 'easeinout', speed: 600 }
                          },
                          colors: ['#10B981', '#38BDF8', '#F59E0B', '#EF4444'],
                          stroke: {
                            curve: 'smooth',
                            width: [3, 2.5, 2, 2],
                            dashArray: [0, 0, 0, 4]
                          },
                          fill: {
                            type: 'gradient',
                            gradient: {
                              shadeIntensity: 1,
                              opacityFrom: 0.35,
                              opacityTo: 0.04,
                              stops: [0, 90, 100]
                            }
                          },
                          markers: {
                            size: 4,
                            strokeColors: '#0E121A',
                            strokeWidth: 2,
                            hover: { size: 6 }
                          },
                          dataLabels: { enabled: false },
                          grid: {
                            borderColor: 'rgba(255, 255, 255, 0.06)',
                            strokeDashArray: 3,
                            xaxis: { lines: { show: true } },
                            yaxis: { lines: { show: true } }
                          },
                          xaxis: {
                            categories,
                            labels: {
                              style: { colors: '#94A3B8', fontSize: '11px', fontWeight: 600 }
                            },
                            axisBorder: { show: false },
                            axisTicks: { show: false }
                          },
                          yaxis: {
                            opposite: true,
                            labels: {
                              formatter: (val: number) => {
                                if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)} Miliar`;
                                if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(0)} Jt`;
                                if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)} Rb`;
                                return `Rp ${val}`;
                              },
                              style: { colors: '#64748B', fontSize: '10px' }
                            }
                          },
                          legend: {
                            position: 'top',
                            horizontalAlign: 'left',
                            labels: { colors: '#94A3B8' },
                            fontSize: '11px',
                            markers: { shape: 'circle' }
                          },
                          tooltip: {
                            theme: 'dark',
                            y: {
                              formatter: (val: number) => `Rp ${val.toLocaleString('id-ID')}`
                            }
                          }
                        };

                        return (
                          <div className="bg-[#141820] p-2.5 rounded-xl border border-white/5 w-full min-h-[240px]">
                            {isMounted ? (
                              <CleanApexChart
                                key={`apex-fin-${selectedFinanceMonth}`}
                                type="area"
                                height={230}
                                series={series}
                                options={options}
                              />
                            ) : (
                              <div className="h-[230px] flex items-center justify-center text-xs text-[#8A93A3]">
                                Memuat grafik...
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right: Rincian Alokasi Biaya (Di Samping) (5 Cols - Horizontal Rectangular Bars Stacked) */}
                    <div className="lg:col-span-5 bg-[#0E121A] p-4 rounded-xl border border-white/5 flex flex-col justify-between space-y-2.5">
                      <div className="flex items-center justify-between pb-1">
                        <div>
                          <span className="text-xs font-bold text-white uppercase tracking-wider block">
                            Rincian Alokasi Biaya
                          </span>
                          <span className="text-[10px] text-[#8A93A3] font-mono">{fin.monthName}</span>
                        </div>
                        <span className="px-2.5 py-1 bg-[#10B981]/15 text-[#10B981] font-mono text-[11px] font-bold rounded-lg border border-[#10B981]/25">
                          Margin {fin.netMargin}%
                        </span>
                      </div>

                      {/* 4 Horizontal Rectangular Breakdown Cards (Persegi Panjang ke Bawah) */}
                      <div className="space-y-2 flex-1 flex flex-col justify-between">
                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                            <span className="text-white text-xs font-bold">HPP / Pokok Proyek</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#F59E0B] text-xs">
                              Rp {fin.hpp.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9px] font-mono text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded font-bold">
                              {fin.expense > 0 ? Math.round((fin.hpp / fin.expense) * 100) : 0}%
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                            <span className="text-white text-xs font-bold">Beban Operasional Usaha</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#EF4444] text-xs">
                              Rp {fin.opsExpense.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9px] font-mono text-[#EF4444] bg-[#EF4444]/10 px-1.5 py-0.5 rounded font-bold">
                              {fin.expense > 0 ? Math.round((fin.opsExpense / fin.expense) * 100) : 0}%
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                            <span className="text-white text-xs font-bold">Budget Iklan Marketing</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#60A5FA] text-xs">
                              Rp {fin.marketingExpense.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9px] font-mono text-[#60A5FA] bg-[#3B82F6]/10 px-1.5 py-0.5 rounded font-bold">
                              {fin.expense > 0 ? Math.round((fin.marketingExpense / fin.expense) * 100) : 0}%
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#A855F7]" />
                            <span className="text-white text-xs font-bold">Beban Gaji Staf (Payroll)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">
                              Rp {fin.payrollExpense.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9px] font-mono text-[#C084FC] bg-[#A855F7]/10 px-1.5 py-0.5 rounded font-bold">
                              {fin.expense > 0 ? Math.round((fin.payrollExpense / fin.expense) * 100) : 0}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Highlight: Piutang Klien Tertagih */}
                      <div className="p-3 bg-[#141820] rounded-xl border border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                          <div>
                            <span className="text-white text-[11px] font-semibold block">Piutang Klien Tertagih</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-[#F59E0B] text-xs block">Rp {fin.unpaidPiutang.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. SECTOR 2: DATA MARKETING & PERTUMBUHAN (GROWTH SECTOR WITH COMPACT SELECTOR) */}
      {/* ========================================================================= */}
      <div className="bg-[#0E121A] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#3B82F6]/20 text-[#3B82F6]">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-bold text-base text-white">
              2. Data Marketing & Pertumbuhan Pelanggan
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMarketingChart(!showMarketingChart)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 ${
                showMarketingChart
                  ? 'bg-[#3B82F6] text-white shadow-md shadow-[#3B82F6]/20'
                  : 'bg-[#3B82F6]/15 hover:bg-[#3B82F6]/25 text-[#60A5FA] border border-[#3B82F6]/30'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>{showMarketingChart ? 'Tutup Grafik' : 'Lihat Grafik'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showMarketingChart ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {(() => {
          const mkt = marketingMonthlyMap[selectedMonth] || marketingMonthlyMap['Agu'];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Blended ROAS Iklan</span>
                <div className="text-xl font-bold font-mono text-[#10B981]">{mkt.roas}x</div>
              </div>

              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Omset Teratribusi ({selectedMonth})</span>
                <div className="text-xl font-bold font-mono text-white">
                  Rp {(mkt.attributedRevenue ?? 0).toLocaleString('id-ID')}
                </div>
              </div>

              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Total Prospek (Leads)</span>
                <div className="text-xl font-bold font-mono text-white">{mkt.leads ?? 0} Leads</div>
              </div>

              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Biaya Akuisisi (CAC)</span>
                <div className="text-xl font-bold font-mono text-[#4E9BFF]">
                  Rp {(mkt.cac ?? 0).toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          );
        })()}

        {/* 📈 COLLAPSIBLE MONTHLY MARKETING CHART & SINGLE-MONTH DETAILS */}
        {showMarketingChart && (
          <div className="p-5 bg-[#0A0D14] border border-[#3B82F6]/25 rounded-2xl space-y-5 animate-fadeIn mt-4">
            {/* Selected Single Month Highlight Dashboard */}
            {(() => {
              const mkt = marketingMonthlyMap[selectedMonth] || marketingMonthlyMap['Agu'];
              return (
                <div className="space-y-4">
                  {/* 📈 SIDE-BY-SIDE: APEXCHARTS MARKETING AREA CHART & CHANNEL BREAKDOWN */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Left: Interactive Full-Height ApexCharts Area Chart for Marketing (7 Cols) */}
                    <div className="lg:col-span-7 bg-[#0E121A] p-4 rounded-xl border border-white/5 flex flex-col justify-between space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-white uppercase tracking-wider block">
                            Grafik Performa Iklan Harian — {mkt.monthName}
                          </span>
                          <span className="text-[10px] text-[#8A93A3]">Omset teratribusi vs alokasi biaya Meta, TikTok, dan Google</span>
                        </div>
                      </div>

                      {/* ApexCharts Area Chart for Sector 2 */}
                      {(() => {
                        const categories = ['Tgl 01', 'Tgl 06', 'Tgl 12', 'Tgl 18', 'Tgl 24', 'Tgl 30'];

                        const series = [
                          {
                            name: 'Omset Teratribusi Iklan',
                            data: [0.15, 0.32, 0.54, 0.72, 0.88, 1.0].map(m => Math.round(mkt.attributedRevenue * m))
                          },
                          {
                            name: 'Meta Ads (IG & FB)',
                            data: [0.14, 0.30, 0.50, 0.68, 0.85, 1.0].map(m => Math.round((mkt.adSpend * mkt.metaShare / 100) * m))
                          },
                          {
                            name: 'TikTok Motion Ads',
                            data: [0.10, 0.28, 0.52, 0.74, 0.90, 1.0].map(m => Math.round((mkt.adSpend * mkt.tiktokShare / 100) * m))
                          },
                          {
                            name: 'Google Search & PMax',
                            data: [0.12, 0.29, 0.48, 0.66, 0.84, 1.0].map(m => Math.round((mkt.adSpend * mkt.googleShare / 100) * m))
                          }
                        ];

                        const options: ApexOptions = {
                          chart: {
                            id: `apex-mkt-${selectedMarketingMonth}`,
                            type: 'area',
                            background: 'transparent',
                            toolbar: { show: false },
                            zoom: { enabled: false },
                            animations: { enabled: true, easing: 'easeinout', speed: 600 }
                          },
                          colors: ['#38BDF8', '#10B981', '#818CF8', '#F59E0B'],
                          stroke: {
                            curve: 'smooth',
                            width: [3.5, 2.5, 2.5, 2.5],
                            dashArray: [0, 0, 0, 3]
                          },
                          fill: {
                            type: 'gradient',
                            gradient: {
                              shadeIntensity: 1,
                              opacityFrom: 0.35,
                              opacityTo: 0.04,
                              stops: [0, 90, 100]
                            }
                          },
                          markers: {
                            size: 4,
                            strokeColors: '#0E121A',
                            strokeWidth: 2,
                            hover: { size: 6 }
                          },
                          dataLabels: { enabled: false },
                          grid: {
                            borderColor: 'rgba(255, 255, 255, 0.06)',
                            strokeDashArray: 3,
                            xaxis: { lines: { show: true } },
                            yaxis: { lines: { show: true } }
                          },
                          xaxis: {
                            categories,
                            labels: {
                              style: { colors: '#94A3B8', fontSize: '11px', fontWeight: 600 }
                            },
                            axisBorder: { show: false },
                            axisTicks: { show: false }
                          },
                          yaxis: {
                            opposite: true,
                            labels: {
                              formatter: (val: number) => {
                                if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)} Miliar`;
                                if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(0)} Jt`;
                                if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)} Rb`;
                                return `Rp ${val}`;
                              },
                              style: { colors: '#64748B', fontSize: '10px' }
                            }
                          },
                          legend: {
                            position: 'top',
                            horizontalAlign: 'left',
                            labels: { colors: '#94A3B8' },
                            fontSize: '11px',
                            markers: { shape: 'circle' }
                          },
                          tooltip: {
                            theme: 'dark',
                            y: {
                              formatter: (val: number) => `Rp ${val.toLocaleString('id-ID')}`
                            }
                          }
                        };

                        return (
                          <div className="bg-[#141820] p-2.5 rounded-xl border border-white/5 w-full min-h-[240px]">
                            {isMounted ? (
                              <CleanApexChart
                                key={`apex-mkt-${selectedMarketingMonth}`}
                                type="area"
                                height={230}
                                series={series}
                                options={options}
                              />
                            ) : (
                              <div className="h-[230px] flex items-center justify-center text-xs text-[#8A93A3]">
                                Memuat grafik...
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right: Distribusi Kanal Iklan (Di Samping) (5 Cols - Horizontal Rectangular Bars Stacked) */}
                    <div className="lg:col-span-5 bg-[#0E121A] p-4 rounded-xl border border-white/5 flex flex-col justify-between space-y-2.5">
                      <div className="flex items-center justify-between pb-1">
                        <div>
                          <span className="text-xs font-bold text-white uppercase tracking-wider block">
                            Distribusi Kanal Iklan
                          </span>
                          <span className="text-[10px] text-[#8A93A3] font-mono">{mkt.monthName}</span>
                        </div>
                        <span className="px-2.5 py-1 bg-[#3B82F6]/15 text-[#60A5FA] font-mono text-[11px] font-bold rounded-lg border border-[#3B82F6]/25">
                          {mkt.leads} Leads
                        </span>
                      </div>

                      {/* 4 Horizontal Rectangular Channel Cards (Persegi Panjang ke Bawah) */}
                      <div className="space-y-2 flex-1 flex flex-col justify-between">
                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                            <span className="text-white text-xs font-bold">Meta Ads (IG & FB)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">
                              Rp {((mkt.adSpend * mkt.metaShare) / 100).toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9px] font-mono text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded font-bold">
                              {mkt.metaShare}% Porsi
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#818CF8]" />
                            <span className="text-white text-xs font-bold">TikTok Video Motion</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">
                              Rp {((mkt.adSpend * mkt.tiktokShare) / 100).toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9px] font-mono text-[#818CF8] bg-[#818CF8]/10 px-1.5 py-0.5 rounded font-bold">
                              {mkt.tiktokShare}% Porsi
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                            <span className="text-white text-xs font-bold">Google Search & PMax</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">
                              Rp {((mkt.adSpend * mkt.googleShare) / 100).toLocaleString('id-ID')}
                            </span>
                            <span className="text-[9px] font-mono text-[#F59E0B] bg-[#F59E0B]/10 px-1.5 py-0.5 rounded font-bold">
                              {mkt.googleShare}% Porsi
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                            <span className="text-white text-xs font-bold">Biaya Akuisisi (CAC)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#38BDF8] text-xs">
                              Rp {mkt.cac.toLocaleString('id-ID')} / Lead
                            </span>
                            <span className="text-[9px] font-mono text-[#38BDF8] bg-[#38BDF8]/10 px-1.5 py-0.5 rounded font-bold">
                              Konv: {mkt.convRate}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Banner: Total Attributed Revenue */}
                      <div className="p-3 bg-[#141820] rounded-xl border border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                          <div>
                            <span className="text-white text-[11px] font-semibold block">Omset Teratribusi Iklan</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-[#38BDF8] text-xs block">Rp {mkt.attributedRevenue.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 5. SECTOR 3: DATA KARYAWAN / SDM & OPERASIONAL (TEAM & OPS WITH COMPACT SELECTOR) */}
      {/* ========================================================================= */}
      <div className="bg-[#0E121A] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#F59E0B]/20 text-[#F59E0B]">
              <Users className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-bold text-base text-white">
              3. Data Karyawan, SDM & Beban Operasional Tim
            </h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTeamChart(!showTeamChart)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center gap-1.5 ${
                showTeamChart
                  ? 'bg-[#F59E0B] text-black shadow-md shadow-[#F59E0B]/20'
                  : 'bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#FBBF24] border border-[#F59E0B]/30'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{showTeamChart ? 'Tutup Grafik' : 'Lihat Grafik'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${showTeamChart ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {(() => {
          const tm = teamMonthlyMap[selectedMonth] || teamMonthlyMap['Agu'];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Total Anggota Tim</span>
                <div className="text-xl font-bold font-mono text-white">{tm.totalStaff} Karyawan</div>
              </div>

              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Beban Kerja Tim</span>
                <div className={`text-xl font-bold font-mono ${tm.workloadPercent > 80 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
                  {tm.workloadPercent}%
                </div>
              </div>

              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Tugas Selesai</span>
                <div className="text-xl font-bold font-mono text-white">
                  {tm.completedTasks} Tugas
                </div>
              </div>

              <div className="p-3.5 bg-[#141820] rounded-xl space-y-1 border border-white/5">
                <span className="text-[#8A93A3] text-[11px] block">Beban Payroll</span>
                <div className="text-xl font-bold font-mono text-[#38BDF8]">
                  Rp {tm.payrollTotal.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Breakdown per Divisi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
          {teamOps.divisions.map((div, i) => (
            <div key={i} className="p-3 bg-[#141820] rounded-xl flex items-center justify-between border border-white/5">
              <div>
                <span className="font-bold text-white block">{div.name}</span>
                <span className="text-[10px] text-[#8A93A3]">{div.members} Anggota Staf</span>
              </div>
              <div className="text-right">
                <span className="font-mono font-bold text-white text-xs">{div.loadPercent}% Beban</span>
                <span
                  className={`text-[9px] font-mono font-bold block ${
                    div.status === 'OVERLOAD'
                      ? 'text-[#EF4444]'
                      : div.status === 'BUSY'
                      ? 'text-[#F59E0B]'
                      : 'text-[#10B981]'
                  }`}
                >
                  {div.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* 👥 COLLAPSIBLE MONTHLY TEAM & HR CHART & SINGLE-MONTH DETAILS */}
        {showTeamChart && (
          <div className="p-5 bg-[#0A0D14] border border-[#F59E0B]/25 rounded-2xl space-y-5 animate-fadeIn mt-4">
            {/* Selected Single Month Highlight Dashboard */}
            {(() => {
              const tm = teamMonthlyMap[selectedMonth] || teamMonthlyMap['Agu'];
              return (
                <div className="space-y-4">
                  {/* 👥 SIDE-BY-SIDE: APEXCHARTS TEAM WORKLOAD AREA CHART & DIVISION BREAKDOWN */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Left: Interactive Full-Height ApexCharts Area Chart for Team (7 Cols) */}
                    <div className="lg:col-span-7 bg-[#0E121A] p-4 rounded-xl border border-white/5 flex flex-col justify-between space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-white uppercase tracking-wider block">
                            Grafik Utilisasi & Beban Divisi Harian — {tm.monthName}
                          </span>
                          <span className="text-[10px] text-[#8A93A3]">Tingkat utilisasi per divisi vs ambang batas overload 75%</span>
                        </div>
                      </div>

                      {/* ApexCharts Area Chart for Sector 3 */}
                      {(() => {
                        const categories = ['Tgl 01', 'Tgl 06', 'Tgl 12', 'Tgl 18', 'Tgl 24', 'Tgl 30'];

                        const series = [
                          {
                            name: 'Marketing & Creative',
                            data: [0.65, 0.74, 0.82, 0.89, 0.94, 1.0].map(m => Math.min(100, Math.round(tm.mktLoad * m)))
                          },
                          {
                            name: 'Engineering & Tech',
                            data: [0.55, 0.64, 0.73, 0.81, 0.88, 1.0].map(m => Math.min(100, Math.round(tm.engLoad * m)))
                          },
                          {
                            name: 'Sales & BizDev',
                            data: [0.45, 0.58, 0.69, 0.76, 0.84, 1.0].map(m => Math.min(100, Math.round(tm.salesLoad * m)))
                          },
                          {
                            name: 'SLA Delivery Rate',
                            data: [0.96, 0.94, 0.92, 0.90, 0.89, 1.0].map(m => Math.min(100, Math.round(tm.slaPercent * m)))
                          }
                        ];

                        const options: ApexOptions = {
                          chart: {
                            id: `apex-team-${selectedTeamMonth}`,
                            type: 'area',
                            background: 'transparent',
                            toolbar: { show: false },
                            zoom: { enabled: false },
                            animations: { enabled: true, easing: 'easeinout', speed: 600 }
                          },
                          colors: ['#EF4444', '#F59E0B', '#38BDF8', '#10B981'],
                          stroke: {
                            curve: 'smooth',
                            width: [3.5, 2.5, 2.5, 2.5],
                            dashArray: [0, 0, 0, 4]
                          },
                          fill: {
                            type: 'gradient',
                            gradient: {
                              shadeIntensity: 1,
                              opacityFrom: 0.35,
                              opacityTo: 0.04,
                              stops: [0, 90, 100]
                            }
                          },
                          markers: {
                            size: 4,
                            strokeColors: '#0E121A',
                            strokeWidth: 2,
                            hover: { size: 6 }
                          },
                          dataLabels: { enabled: false },
                          annotations: {
                            yaxis: [
                              {
                                y: 75,
                                borderColor: '#EF4444',
                                strokeDashArray: 4,
                                label: {
                                  borderColor: '#EF4444',
                                  style: {
                                    color: '#fff',
                                    background: '#EF4444',
                                    fontSize: '9px',
                                    fontWeight: 700
                                  },
                                  text: '⚠️ Batas Aman 75%'
                                }
                              }
                            ]
                          },
                          grid: {
                            borderColor: 'rgba(255, 255, 255, 0.06)',
                            strokeDashArray: 3,
                            xaxis: { lines: { show: true } },
                            yaxis: { lines: { show: true } }
                          },
                          xaxis: {
                            categories,
                            labels: {
                              style: { colors: '#94A3B8', fontSize: '11px', fontWeight: 600 }
                            },
                            axisBorder: { show: false },
                            axisTicks: { show: false }
                          },
                          yaxis: {
                            opposite: true,
                            min: 30,
                            max: 100,
                            labels: {
                              formatter: (val: number) => `${Math.round(val)}%`,
                              style: { colors: '#64748B', fontSize: '10px' }
                            }
                          },
                          legend: {
                            position: 'top',
                            horizontalAlign: 'left',
                            labels: { colors: '#94A3B8' },
                            fontSize: '11px',
                            markers: { shape: 'circle' }
                          },
                          tooltip: {
                            theme: 'dark',
                            y: {
                              formatter: (val: number) => `${val}% Utilisasi`
                            }
                          }
                        };

                        return (
                          <div className="bg-[#141820] p-2.5 rounded-xl border border-white/5 w-full min-h-[240px]">
                            {isMounted ? (
                              <CleanApexChart
                                key={`apex-team-${selectedTeamMonth}`}
                                type="area"
                                height={230}
                                series={series}
                                options={options}
                              />
                            ) : (
                              <div className="h-[230px] flex items-center justify-center text-xs text-[#8A93A3]">
                                Memuat grafik...
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Right: Beban Divisi (Di Samping) (5 Cols - Horizontal Rectangular Bars Stacked) */}
                    <div className="lg:col-span-5 bg-[#0E121A] p-4 rounded-xl border border-white/5 flex flex-col justify-between space-y-2.5">
                      <div className="flex items-center justify-between pb-1">
                        <div>
                          <span className="text-xs font-bold text-white uppercase tracking-wider block">
                            Beban Kerja Per Divisi
                          </span>
                          <span className="text-[10px] text-[#8A93A3] font-mono">{tm.monthName}</span>
                        </div>
                        <span className="px-2.5 py-1 bg-[#8B5CF6]/15 text-[#C4B5FD] font-mono text-[11px] font-bold rounded-lg border border-[#8B5CF6]/25">
                          {tm.totalStaff} Karyawan
                        </span>
                      </div>

                      {/* 4 Horizontal Rectangular Division Cards (Persegi Panjang ke Bawah) */}
                      <div className="space-y-2 flex-1 flex flex-col justify-between">
                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                            <span className="text-white text-xs font-bold">Engineering & Tech</span>
                            <span className="text-[10px] text-[#8A93A3] font-mono">(5 Staf)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">
                              {tm.engLoad}% Beban
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                            <span className="text-white text-xs font-bold">Marketing & Creative</span>
                            <span className="text-[10px] text-[#8A93A3] font-mono">(4 Staf)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-[#EF4444] text-xs">
                              {tm.mktLoad}% Beban
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
                            <span className="text-white text-xs font-bold">Sales & BizDev</span>
                            <span className="text-[10px] text-[#8A93A3] font-mono">(3 Staf)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">
                              {tm.salesLoad}% Beban
                            </span>
                          </div>
                        </div>

                        <div className="p-3 bg-[#141820] rounded-xl border border-white/5 flex items-center justify-between hover:border-white/10 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                            <span className="text-white text-xs font-bold">Finance & Operations</span>
                            <span className="text-[10px] text-[#8A93A3] font-mono">(2 Staf)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-white text-xs">
                              {tm.finLoad}% Beban
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bottom Banner: Total Payroll */}
                      <div className="p-3 bg-[#141820] rounded-xl border border-white/10 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-[#A855F7]" />
                          <div>
                            <span className="text-white text-[11px] font-semibold block">Total Beban Payroll</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-[#D6E8FF] text-xs block">Rp {tm.payrollTotal.toLocaleString('id-ID')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 6. SECTOR 4: DATA PROFIL PERUSAHAAN & ASET BISNIS (ENTERPRISE PROFILE) */}
      {/* ========================================================================= */}
      <div className="bg-[#0E121A] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#8B5CF6]/20 text-[#8B5CF6]">
              <Building className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-bold text-base text-white">
              4. Data Master Perusahaan, Klien & Legalitas Bisnis
            </h3>
          </div>
          <span className="px-2.5 py-0.5 bg-[#8B5CF6]/20 text-[#C4B5FD] text-[10px] font-mono font-bold rounded-full">
            Enterprise Verified
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-[#141820] rounded-xl space-y-1">
            <span className="text-[#8A93A3] text-[10px] uppercase font-bold block">Nama Entitas Resmi</span>
            <div className="text-sm font-bold text-white">{companyProfile.companyName}</div>
            <span className="text-[11px] text-[#8A93A3]">{companyProfile.industry}</span>
          </div>

          <div className="p-3.5 bg-[#141820] rounded-xl space-y-1">
            <span className="text-[#8A93A3] text-[10px] uppercase font-bold block">Portofolio Klien Aktif</span>
            <div className="text-sm font-bold text-[#10B981]">{companyProfile.activeClientsCount} Klien Retainer</div>
            <span className="text-[11px] text-[#8A93A3]">Tingkat Retensi: 84% MoM</span>
          </div>

          <div className="p-3.5 bg-[#141820] rounded-xl space-y-1">
            <span className="text-[#8A93A3] text-[10px] uppercase font-bold block">Legalitas & Sistem</span>
            <div className="text-xs font-mono text-white">{companyProfile.businessLicense}</div>
            <span className="text-[10px] text-[#3FBF8F] font-bold block mt-0.5">{companyProfile.enterpriseTier}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. SECTOR 5: RIWAYAT & LOG INSTRUKSI AI ASISTEN (BERURUTAN NOMOR) */}
      {/* ========================================================================= */}
      <div className="bg-[#0E121A] border border-white/[0.08] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#6366F1]/20 text-[#818CF8]">
              <Sparkles className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-bold text-base text-white">
              5. Log & Riwayat Instruksi AI Asisten
            </h3>
          </div>
          <span className="px-2.5 py-0.5 bg-[#6366F1]/20 text-[#A5B4FC] text-[10px] font-mono font-bold rounded-full">
            {activeAIDirectives.length} Instruksi Terkoneksi
          </span>
        </div>

        <div className="space-y-2.5">
          {activeAIDirectives.map((directive, index) => (
            <div
              key={directive.id || index}
              className="p-3.5 bg-[#141820] border border-white/5 hover:border-[#6366F1]/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
            >
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-[#6366F1]/20 border border-[#6366F1]/40 text-[#A5B4FC] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                  {index + 1}
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs sm:text-sm font-bold text-white">
                    {directive.title}
                  </div>
                  <div className="text-[11px] text-[#8A93A3] flex items-center gap-2">
                    <span>⚡ {directive.impact}</span>
                    <span>•</span>
                    <span className="text-[#64748B]">{directive.timestamp}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <span className="px-2.5 py-1 rounded-lg bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[11px] font-mono font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Diterapkan ke Dashboard</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
