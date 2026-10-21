'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  TrendingUp,
  TrendingDown,
  Save,
  RotateCcw,
  BarChart2,
  DollarSign,
  Clock,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { apiSend } from './client';

const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
    </div>
  ),
});

interface MonthlyBaseline {
  month: string;
  monthLabel: string;
  revenue: number;
  expense: number;
  netIncome: number;
  cashBalance: number;
  dso: number;
  arBalance: number;
}

interface MonthProjection {
  month: number;
  monthLabel: string;
  revenue: number;
  expense: number;
  netIncome: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  cashBalance: number;
  runwayMonths: number | null;
  dso: number;
  arBalance: number;
}

interface ScenarioProjection {
  id: string;
  label: string;
  months: MonthProjection[];
  summary: {
    finalCashBalance: number;
    avgRunwayMonths: number | null;
    cashOutMonth: number | null;
    totalRevenue: number;
    totalExpense: number;
    totalNetIncome: number;
  };
}

interface ProjectionResult {
  baseline: MonthlyBaseline[];
  scenarios: ScenarioProjection[];
  kpis: {
    currentCash: number;
    currentRunway: number | null;
    currentDso: number;
    projectionHorizon: number;
  };
}

interface ScenarioParams {
  id: string;
  label: string;
  salesDeltaPct: number;
  opexDeltaPct: number;
  delayDays: number;
}

const DEFAULT_SCENARIOS: ScenarioParams[] = [
  { id: 'optimistic', label: 'Optimistis', salesDeltaPct: 10, opexDeltaPct: 2, delayDays: 0 },
  { id: 'normal', label: 'Normal', salesDeltaPct: 0, opexDeltaPct: 0, delayDays: 0 },
  { id: 'pessimistic', label: 'Pesimistis', salesDeltaPct: -20, opexDeltaPct: 5, delayDays: 15 },
];

const SCENARIO_COLORS: Record<string, string> = {
  optimistic: '#00C853',
  normal: '#2979FF',
  pessimistic: '#FF6D00',
};

const SCENARIO_BG: Record<string, string> = {
  optimistic: 'rgba(0, 200, 83, 0.1)',
  normal: 'rgba(41, 121, 255, 0.1)',
  pessimistic: 'rgba(255, 109, 0, 0.1)',
};

function formatRupiah(val: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(val);
}

function formatRupiahShort(val: number): string {
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
}

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const AR_CONVERGENCE = 1 / 3;

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  return { year: targetYear, month: targetMonth };
}

function round2Decimal(value: number): number {
  return Math.round(value * 100) / 100;
}

function projectScenariosClient(
  baseline: MonthlyBaseline[],
  scenarios: ScenarioParams[],
  horizonMonths: number = 6
): ScenarioProjection[] {
  if (baseline.length === 0) {
    return scenarios.map((s) => ({
      id: s.id,
      label: s.label,
      months: [],
      summary: {
        finalCashBalance: 0,
        avgRunwayMonths: null,
        cashOutMonth: null,
        totalRevenue: 0,
        totalExpense: 0,
        totalNetIncome: 0,
      },
    }));
  }

  const activeMonths = baseline.filter((b) => b.revenue > 0 || b.expense > 0);
  const basis = activeMonths.length > 0 ? activeMonths : baseline;
  const avgRevenue = basis.reduce((s, b) => s + b.revenue, 0) / basis.length;
  const avgExpense = basis.reduce((s, b) => s + b.expense, 0) / basis.length;
  const avgDso = basis.reduce((s, b) => s + b.dso, 0) / basis.length;
  const lastBaseline = baseline[baseline.length - 1];
  const startCash = lastBaseline.cashBalance;
  const startAr = lastBaseline.arBalance;

  const results: ScenarioProjection[] = [];

  for (const scenario of scenarios) {
    const months: MonthProjection[] = [];
    let cashBalance = startCash;
    let arBalance = startAr;
    let cashOutMonth: number | null = null;
    let totalRevenue = 0;
    let totalExpense = 0;
    let totalNetIncome = 0;
    const runways: number[] = [];

    const salesMultiplier = 1 + scenario.salesDeltaPct / 100;
    const opexMultiplier = 1 + scenario.opexDeltaPct / 100;
    const projectedDso = avgDso + scenario.delayDays;

    const baseYear = parseInt(lastBaseline.month.slice(0, 4));
    const baseMonth = parseInt(lastBaseline.month.slice(5, 7));

    for (let m = 1; m <= horizonMonths; m++) {
      const futureMonth = shiftMonth(baseYear, baseMonth, m);
      const monthLabel = `${MONTH_SHORT[futureMonth.month - 1]} ${String(futureMonth.year).slice(-2)}`;

      const projectedRevenue = avgRevenue * salesMultiplier;
      const projectedExpense = avgExpense * opexMultiplier;

      const targetAr = (projectedRevenue * projectedDso) / 30;
      const nextAr = arBalance + (targetAr - arBalance) * AR_CONVERGENCE;
      const deltaAr = nextAr - arBalance;
      arBalance = nextAr;

      const cashInflow = projectedRevenue - deltaAr;
      const cashOutflow = projectedExpense;
      const netCashFlow = cashInflow - cashOutflow;

      cashBalance = Math.max(0, cashBalance + netCashFlow);
      const netIncome = projectedRevenue - projectedExpense;
      const runway = projectedExpense > 0 ? cashBalance / projectedExpense : null;

      if (cashBalance <= 0 && cashOutMonth === null) {
        cashOutMonth = m;
      }

      if (runway !== null) runways.push(runway);

      months.push({
        month: m,
        monthLabel,
        revenue: round2Decimal(projectedRevenue),
        expense: round2Decimal(projectedExpense),
        netIncome: round2Decimal(netIncome),
        cashInflow: round2Decimal(cashInflow),
        cashOutflow: round2Decimal(cashOutflow),
        netCashFlow: round2Decimal(netCashFlow),
        cashBalance: round2Decimal(cashBalance),
        runwayMonths: runway ? Math.round(runway * 10) / 10 : null,
        dso: Math.round(projectedDso * 10) / 10,
        arBalance: round2Decimal(arBalance),
      });

      totalRevenue += projectedRevenue;
      totalExpense += projectedExpense;
      totalNetIncome += netIncome;
    }

    const avgRunway =
      runways.length > 0
        ? Math.round((runways.reduce((a, b) => a + b, 0) / runways.length) * 10) / 10
        : null;

    results.push({
      id: scenario.id,
      label: scenario.label,
      months,
      summary: {
        finalCashBalance: round2Decimal(cashBalance),
        avgRunwayMonths: avgRunway,
        cashOutMonth,
        totalRevenue: round2Decimal(totalRevenue),
        totalExpense: round2Decimal(totalExpense),
        totalNetIncome: round2Decimal(totalNetIncome),
      },
    });
  }

  return results;
}

function ScenarioCard({
  scenario,
  onChange,
  color,
  bgColor,
}: {
  scenario: ScenarioParams;
  onChange: (id: string, field: keyof ScenarioParams, value: number) => void;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="linear-card p-4" style={{ borderLeft: `4px solid ${color}`, background: bgColor }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-bold text-sm" style={{ color }}>{scenario.label}</h4>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ background: color, color: '#fff' }}>
          {scenario.id === 'optimistic' && '📈'}
          {scenario.id === 'normal' && '➖'}
          {scenario.id === 'pessimistic' && '📉'}
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span>Perubahan Penjualan</span>
            <span className="font-bold" style={{ color }}>
              {scenario.salesDeltaPct >= 0 ? '+' : ''}{scenario.salesDeltaPct}%
            </span>
          </label>
          <input
            type="range"
            min="-50"
            max="100"
            step="1"
            value={scenario.salesDeltaPct}
            onChange={(e) => onChange(scenario.id, 'salesDeltaPct', parseInt(e.target.value))}
            className="w-full h-1.5 appearance-none rounded-lg bg-slate-200 cursor-pointer"
            style={{ accentColor: color }}
          />
        </div>

        <div>
          <label className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span>Perubahan Biaya Operasional</span>
            <span className="font-bold" style={{ color }}>
              {scenario.opexDeltaPct >= 0 ? '+' : ''}{scenario.opexDeltaPct}%
            </span>
          </label>
          <input
            type="range"
            min="-30"
            max="100"
            step="1"
            value={scenario.opexDeltaPct}
            onChange={(e) => onChange(scenario.id, 'opexDeltaPct', parseInt(e.target.value))}
            className="w-full h-1.5 appearance-none rounded-lg bg-slate-200 cursor-pointer"
            style={{ accentColor: color }}
          />
        </div>

        <div>
          <label className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span>Keterlambatan Bayar Pelanggan</span>
            <span className="font-bold" style={{ color }}>
              +{scenario.delayDays} hari
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="60"
            step="1"
            value={scenario.delayDays}
            onChange={(e) => onChange(scenario.id, 'delayDays', parseInt(e.target.value))}
            className="w-full h-1.5 appearance-none rounded-lg bg-slate-200 cursor-pointer"
            style={{ accentColor: color }}
          />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, trend, icon, color }: {
  label: string;
  value: string | number;
  trend?: { label: string; positive: boolean };
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="linear-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{label}</p>
          <p className="text-lg font-extrabold text-slate-900 mt-1" style={{ color }}>{value}</p>
          {trend && (
            <p className="text-xs mt-1" style={{ color: trend.positive ? '#00C853' : '#FF6D00' }}>
              {trend.positive ? '▲' : '▼'} {trend.label}
            </p>
          )}
        </div>
        {icon && <div className="p-2 rounded-lg" style={{ background: `${color}15`, color }}>{icon}</div>}
      </div>
    </div>
  );
}

export default function ScenarioProjectionView() {
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [baseline, setBaseline] = useState<MonthlyBaseline[]>([]);
  const [kpis, setKpis] = useState<ProjectionResult['kpis'] | null>(null);
  const [scenarios, setScenarios] = useState<ScenarioParams[]>(DEFAULT_SCENARIOS);
  const [lookbackMonths, setLookbackMonths] = useState(6);
  const [horizonMonths, setHorizonMonths] = useState(6);
  const [activeChartTab, setActiveChartTab] = useState<'cash' | 'pnl' | 'runway'>('cash');
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [pnlScenario, setPnlScenario] = useState('optimistic');

  const fetchBaseline = useCallback(async () => {
    setError(null);
    setFetching(true);
    try {
      const res = await apiSend<{ success: boolean; data: ProjectionResult; message?: string }>(
        '/api/v1/accounting/scenarios/project',
        'POST',
        { horizonMonths, lookbackMonths, scenarios: DEFAULT_SCENARIOS }
      );
      if (res.success) {
        setBaseline(res.data.baseline);
        setKpis(res.data.kpis);
      } else {
        setError(res.message || 'Gagal memuat proyeksi');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat memuat proyeksi');
      console.error(err);
    } finally {
      setLoading(false);
      setFetching(false);
    }
  }, [lookbackMonths, horizonMonths]);

  useEffect(() => {
    fetchBaseline();
  }, [fetchBaseline]);

  // Recalculate projections client-side instantly when any slider moves
  const scenariosResult = useMemo(() => {
    if (!baseline || baseline.length === 0) return [];
    return projectScenariosClient(baseline, scenarios, horizonMonths);
  }, [baseline, scenarios, horizonMonths]);

  const result = useMemo<ProjectionResult | null>(() => {
    if (baseline.length === 0 || !kpis) return null;
    return {
      baseline,
      scenarios: scenariosResult,
      kpis: {
        ...kpis,
        projectionHorizon: horizonMonths,
      },
    };
  }, [baseline, scenariosResult, kpis, horizonMonths]);

  // Sync pnlScenario with first available scenario when result loads
  useEffect(() => {
    if (result && result.scenarios.length > 0 && !result.scenarios.some((s) => s.id === pnlScenario)) {
      setPnlScenario(result.scenarios[0].id);
    }
  }, [result, pnlScenario]);

  const handleScenarioChange = (id: string, field: keyof ScenarioParams, value: number) => {
    setScenarios((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleRunProjection = () => {
    fetchBaseline();
  };

  const handleResetDefaults = () => {
    setScenarios(DEFAULT_SCENARIOS);
  };

  const handleSaveScenario = async () => {
    if (!saveName.trim() || !result) return;
    setSaving(true);
    try {
      await apiSend<{ success: boolean }>('/api/v1/accounting/scenarios', 'POST', {
        name: saveName,
        lookbackMonths,
        horizonMonths,
        scenarios,
        baselineJson: result.baseline,
        resultsJson: result.scenarios,
      });
      alert('Skenario berhasil disimpan!');
      setSaveName('');
    } catch {
      alert('Gagal menyimpan skenario');
    } finally {
      setSaving(false);
    }
  };

  if (loading && baseline.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-slate-500 text-sm">Memuat proyeksi skenario...</p>
        </div>
      </div>
    );
  }

  if (error && baseline.length === 0) {
    return (
      <div className="linear-card p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
        <p className="text-slate-600">{error}</p>
        <button
          onClick={fetchBaseline}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (!result) return null;

  // Chart data preparation
  const chartCategories = result.scenarios[0]?.months.map((m) => m.monthLabel) || [];

  const cashSeries = result.scenarios.map((s) => ({
    name: s.label,
    data: s.months.map((m) => m.cashBalance),
  }));

  const runwaySeries = result.scenarios.map((s) => ({
    name: s.label,
    data: s.months.map((m) => m.runwayMonths ?? null),
  }));

  const dsoSeries = result.scenarios.map((s) => ({
    name: s.label,
    data: s.months.map((m) => m.dso),
  }));

  // P&L chart: need a selector for which scenario to show
  const pnlData = result.scenarios.find((s) => s.id === pnlScenario);

  const pnlSeries = pnlData
    ? [
        { name: 'Pendapatan', data: pnlData.months.map((m) => m.revenue), type: 'column' },
        { name: 'Biaya', data: pnlData.months.map((m) => m.expense), type: 'column' },
        { name: 'Laba Bersih', data: pnlData.months.map((m) => m.netIncome), type: 'line' },
      ]
    : [];

  // Colors per scenario order
  const SCENARIO_COLORS_ARRAY = result.scenarios.map((s) => SCENARIO_COLORS[s.id]);

  const getChartConfig = () => {
    const baseOptions = {
      chart: { toolbar: { show: false }, animations: { enabled: true } },
      stroke: { curve: 'smooth' as const, width: 2 },
      markers: { size: 4 },
      legend: { position: 'top' as const, horizontalAlign: 'center' as const, fontSize: '11px' },
      tooltip: { theme: 'light' as const },
      grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
      xaxis: { categories: chartCategories, labels: { style: { fontSize: '11px' } } },
      yaxis: { labels: { style: { fontSize: '11px' }, formatter: (val: number) => formatRupiahShort(val) } },
    };

    if (activeChartTab === 'cash') {
      return {
        options: {
          ...baseOptions,
          colors: SCENARIO_COLORS_ARRAY,
          yaxis: { ...baseOptions.yaxis, title: { text: 'Saldo Kas (Rp)' } },
          fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.1, stops: [0, 100] } },
        },
        series: cashSeries,
      };
    }

    if (activeChartTab === 'pnl') {
      const pnlColors = ['#00C853', '#FF6D00', '#2979FF'];
      return {
        options: {
          ...baseOptions,
          colors: pnlColors,
          yaxis: { ...baseOptions.yaxis, title: { text: 'Jumlah (Rp)' } },
          plotOptions: { bar: { columnWidth: '60%' } },
        },
        series: pnlSeries,
      };
    }

    // runway + dso combo (mixed chart)
    const mixedColors = [
      ...SCENARIO_COLORS_ARRAY, // runway lines
      ...SCENARIO_COLORS_ARRAY.map((c) => c + '80'), // dso columns (50% opacity)
    ];
    return {
      options: {
        ...baseOptions,
        colors: mixedColors,
        yaxis: [
          { title: { text: 'Runway (Bulan)' }, labels: { style: { fontSize: '11px' } }, opposite: false },
          { title: { text: 'DSO (Hari)' }, labels: { style: { fontSize: '11px' } }, opposite: true },
        ],
      },
      series: [
        ...runwaySeries.map((s) => ({ ...s, type: 'line' as const })),
        ...dsoSeries.map((s) => ({ ...s, type: 'column' as const, yAxisIndex: 1 })),
      ],
    };
  };

  const chartConfig = getChartConfig();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Proyeksi Skenario Keuangan</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Bandingkan dampak skenario optimistis, normal, dan pesimistis terhadap kas, laba rugi, dan runway
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunProjection}
            disabled={fetching}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} /> Jalankan
          </button>
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Default
          </button>
        </div>
      </div>

      {/* Period Controls */}
      <div className="linear-card p-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-slate-600 font-medium">Lookback:</label>
            <select
              value={lookbackMonths}
              onChange={(e) => setLookbackMonths(parseInt(e.target.value))}
              className="input-linear px-2 py-1 text-xs rounded border-slate-200"
            >
              <option value={3}>3 Bulan</option>
              <option value={6}>6 Bulan</option>
              <option value={12}>12 Bulan</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-slate-600 font-medium">Horizon:</label>
            <select
              value={horizonMonths}
              onChange={(e) => setHorizonMonths(parseInt(e.target.value))}
              className="input-linear px-2 py-1 text-xs rounded border-slate-200"
            >
              <option value={3}>3 Bulan</option>
              <option value={6}>6 Bulan</option>
              <option value={12}>12 Bulan</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scenario Controls */}
      <div className="linear-card p-4">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-blue-600" />
          Parameter Skenario
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {scenarios.map(s => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              onChange={handleScenarioChange}
              color={SCENARIO_COLORS[s.id]}
              bgColor={SCENARIO_BG[s.id]}
            />
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Kas Saat Ini"
          value={formatRupiah(result.kpis.currentCash)}
          icon={<DollarSign className="w-5 h-5" />}
          color="#2979FF"
        />
        <KpiCard
          label="Runway Saat Ini"
          value={result.kpis.currentRunway ? `${result.kpis.currentRunway} bln` : '∞'}
          trend={result.kpis.currentRunway !== null && result.kpis.currentRunway < 3
            ? { label: 'Kritis', positive: false }
            : result.kpis.currentRunway !== null && result.kpis.currentRunway < 6
            ? { label: 'Waspada', positive: false }
            : { label: 'Aman', positive: true }}
          icon={<TrendingUp className="w-5 h-5" />}
          color="#00C853"
        />
        <KpiCard
          label="DSO Saat Ini"
          value={`${result.kpis.currentDso.toFixed(1)} hari`}
          icon={<Clock className="w-5 h-5" />}
          color="#FF6D00"
        />
        <KpiCard
          label="Horizon Proyeksi"
          value={`${result.kpis.projectionHorizon} Bulan`}
          icon={<TrendingDown className="w-5 h-5" />}
          color="#7C3AED"
        />
      </div>

      {/* Charts */}
      <div className="linear-card">
        <div className="p-4 border-b border-slate-100">
          <div className="flex flex-wrap gap-1" role="tablist">
            {[
              { id: 'cash', label: 'Kas Proyeksi', icon: DollarSign },
              { id: 'pnl', label: 'Laba Rugi', icon: BarChart2 },
              { id: 'runway', label: 'Runway & DSO', icon: TrendingUp },
            ].map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeChartTab === tab.id}
                onClick={() => setActiveChartTab(tab.id as typeof activeChartTab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                  activeChartTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 h-80">
          <Chart
            options={chartConfig.options}
            series={chartConfig.series}
            type={activeChartTab === 'pnl' ? 'bar' : 'line'}
            height={350}
          />
        </div>
      </div>

      {/* Comparison Table */}
      <div className="linear-card overflow-x-auto">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">Perbandingan Bulanan</h3>
        </div>
        <table className="sap-smart-table w-full">
          <thead>
            <tr>
              <th className="sticky left-0 z-10">Bulan</th>
              {result.scenarios.map(s => (
                <React.Fragment key={s.id}>
                  <th className="text-center" colSpan={4} style={{ color: SCENARIO_COLORS[s.id] }}>
                    {s.label}
                  </th>
                </React.Fragment>
              ))}
            </tr>
            <tr>
              <th className="sticky left-0 z-10">—</th>
              {result.scenarios.map(s => (
                <React.Fragment key={s.id}>
                  <th className="text-right">Pendapatan</th>
                  <th className="text-right">Biaya</th>
                  <th className="text-right">Laba Bersih</th>
                  <th className="text-right">Saldo Kas</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Baseline months */}
            {result.baseline.map(b => (
              <tr key={`baseline-${b.month}`} className="bg-slate-50/50">
                <td className="font-medium text-slate-700 sticky left-0 z-10 bg-slate-50/50">{b.monthLabel} (Aktual)</td>
                {result.scenarios.map(s => (
                  <React.Fragment key={s.id}>
                    <td className="text-right text-slate-600">{formatRupiah(b.revenue)}</td>
                    <td className="text-right text-slate-600">{formatRupiah(b.expense)}</td>
                    <td className="text-right font-medium" style={{ color: b.netIncome >= 0 ? '#00C853' : '#FF6D00' }}>
                      {formatRupiah(b.netIncome)}
                    </td>
                    <td className="text-right font-medium">{formatRupiah(b.cashBalance)}</td>
                  </React.Fragment>
                ))}
            </tr>
            ))}
            {/* Separator */}
            <tr>
              <td colSpan={13} className="py-1 border-t-2 border-slate-200" />
            </tr>
            {/* Projected months */}
            {result.scenarios[0]?.months.map((_, mIdx) => (
              <tr key={`proj-${mIdx}`}>
                <td className="font-medium text-slate-900 sticky left-0 z-10">
                  {result.scenarios[0].months[mIdx].monthLabel} (Proyeksi)
                </td>
                {result.scenarios.map(s => {
                  const month = s.months[mIdx];
                  return (
                    <React.Fragment key={s.id}>
                      <td className="text-right text-slate-700">{formatRupiah(month.revenue)}</td>
                      <td className="text-right text-slate-700">{formatRupiah(month.expense)}</td>
                      <td className="text-right font-medium" style={{ color: month.netIncome >= 0 ? '#00C853' : '#FF6D00' }}>
                        {formatRupiah(month.netIncome)}
                      </td>
                      <td className="text-right font-bold" style={{ color: SCENARIO_COLORS[s.id] }}>
                        {formatRupiah(month.cashBalance)}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {result.scenarios.map(s => (
          <div key={s.id} className="linear-card p-4" style={{ borderTop: `3px solid ${SCENARIO_COLORS[s.id]}` }}>
            <h4 className="font-bold text-sm mb-3" style={{ color: SCENARIO_COLORS[s.id] }}>
              {s.label}
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Pendapatan</span>
                <span className="font-bold">{formatRupiah(s.summary.totalRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Biaya</span>
                <span className="font-bold">{formatRupiah(s.summary.totalExpense)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Total Laba Bersih</span>
                <span className="font-bold" style={{ color: s.summary.totalNetIncome >= 0 ? '#00C853' : '#FF6D00' }}>
                  {formatRupiah(s.summary.totalNetIncome)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-600">Saldo Kas Akhir</span>
                <span className="font-extrabold" style={{ color: SCENARIO_COLORS[s.id] }}>
                  {formatRupiah(s.summary.finalCashBalance)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Rata-rata Runway</span>
                <span className="font-bold" style={{ color: s.summary.avgRunwayMonths !== null && s.summary.avgRunwayMonths < 3 ? '#FF6D00' : '#00C853' }}>
                  {s.summary.avgRunwayMonths ? `${s.summary.avgRunwayMonths} bln` : '∞'}
                </span>
              </div>
              {s.summary.cashOutMonth && (
                <div className="flex justify-between text-amber-600 font-medium">
                  <span>⚠️ Kas Habis di Bulan</span>
                  <span>Ke-{s.summary.cashOutMonth}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Save Scenario */}
      <div className="linear-card p-4 border-t-2 border-slate-100">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Save className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-sm font-medium text-slate-900">Simpan Skenario</p>
              <p className="text-xs text-slate-500">Simpan parameter dan hasil proyeksi untuk referensi kelak</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Nama skenario (contoh: Ekspansi Q3 2026)"
              className="input-linear px-3 py-2 text-sm flex-1 max-w-xs"
            />
            <button
              onClick={handleSaveScenario}
              disabled={saving || !saveName.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}