'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Archive,
  BadgeCheck,
  Building2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { apiSend, formatMoney, formatPercent, periodLabel } from './client';
import { ReportShell, ReportToolbar, useApi } from './ReportViews';
import { DIVISIONS, divisionLabel } from '@/lib/accounting/budget-divisions';

const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-lg bg-slate-100" />,
});

interface ProfitRowDto {
  key: string;
  label: string;
  revenue: string;
  cogs: string;
  operatingExpenses: string;
  taxExpenses: string;
  totalCost: string;
  profit: string;
  marginPct: number | null;
  revenueSharePct: number | null;
  costSharePct: number | null;
  profitSharePct: number | null;
  costRank: number | null;
  profitRank: number | null;
  isHighestCost: boolean;
  isMostProfitable: boolean;
}

interface ProjectRowDto extends ProfitRowDto {
  code: string | null;
  clientName: string | null;
  division: string | null;
  divisionLabel: string;
  status: string | null;
  startDate: string | null;
  endDate: string | null;
}

interface ProductRowDto {
  productId: string;
  sku: string | null;
  name: string;
  unit: string;
  pricedQty: number;
  unpricedQty: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number | null;
  revenueSharePct: number | null;
}

interface ProfitabilityDto {
  trendMonths: number;
  current: {
    totals: {
      revenue: string;
      cogs: string;
      operatingExpenses: string;
      taxExpenses: string;
      totalCost: string;
      profit: string;
      marginPct: number | null;
    };
    divisions: ProfitRowDto[];
    projects: ProjectRowDto[];
    warnings: string[];
  };
  comparison: {
    totals: ProfitabilityDto['current']['totals'];
    divisions: ProfitRowDto[];
  } | null;
  comparisonPeriod: { startDate: string; endDate: string } | null;
  trend: {
    months: Array<{
      period: string;
      label: string;
      revenue: string;
      totalCost: string;
      profit: string;
      marginPct: number | null;
    }>;
    divisions: Array<{
      key: string;
      label: string;
      months: Array<{ period: string; label: string; revenue: string; totalCost: string; profit: string; marginPct: number | null }>;
    }>;
  };
  products: {
    items: ProductRowDto[];
    totals: {
      pricedQty: number;
      unpricedQty: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
      marginPct: number | null;
    };
    warnings: string[];
  };
}

interface ProjectDto {
  id: string;
  name: string;
  code: string | null;
  clientName: string | null;
  description: string | null;
  division: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

interface ProjectDraft {
  name: string;
  code: string;
  clientName: string;
  description: string;
  division: string;
  status: string;
  startDate: string;
  endDate: string;
}

const emptyDraft = (): ProjectDraft => ({
  name: '',
  code: '',
  clientName: '',
  description: '',
  division: '',
  status: 'ACTIVE',
  startDate: '',
  endDate: '',
});

const statusLabel: Record<string, string> = {
  ACTIVE: 'Aktif',
  ON_HOLD: 'Ditunda',
  COMPLETED: 'Selesai',
  ARCHIVED: 'Diarsipkan',
};

function toNumber(value: string | number | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? n : 0;
}

function deltaPct(current: string | number, previous: string | number): number | null {
  const now = toNumber(current);
  const before = toNumber(previous);
  if (before === 0) return null;
  return ((now - before) / Math.abs(before)) * 100;
}

export function ProfitabilityView({
  period,
  onPeriodChange,
  comparative,
  onComparativeChange,
  canManageProjects,
}: {
  period: string;
  onPeriodChange: (value: string) => void;
  comparative: string;
  onComparativeChange: (value: string) => void;
  canManageProjects: boolean;
}) {
  const [tab, setTab] = useState<'division' | 'project' | 'product'>('division');
  const [trendMonths, setTrendMonths] = useState(12);
  const [trendDivision, setTrendDivision] = useState('');
  const [showProjectPanel, setShowProjectPanel] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [projectMessage, setProjectMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const url = `/api/v1/accounting/reports/profitability?period=${encodeURIComponent(period)}&comparative=${encodeURIComponent(comparative)}&trend=${trendMonths}`;
  const { data, loading, error, reload } = useApi<ProfitabilityDto>(url);
  const {
    data: projectData,
    loading: projectsLoading,
    reload: reloadProjects,
  } = useApi<{ projects: ProjectDto[] }>(showProjectPanel ? '/api/v1/accounting/projects?includeArchived=true' : null);

  const warnings = useMemo(
    () => [...(data?.current.warnings ?? []), ...(data?.products.warnings ?? [])],
    [data]
  );

  const divisions = useMemo(() => data?.current.divisions ?? [], [data]);
  const projects = useMemo(() => data?.current.projects ?? [], [data]);
  const products = useMemo(() => data?.products.items ?? [], [data]);

  const topDivision = divisions.find((row) => row.isMostProfitable) ?? null;
  const topCostDivision = divisions.find((row) => row.isHighestCost) ?? null;

  const comparisonDeltaProfit = data?.comparison
    ? deltaPct(data.current.totals.profit, data.comparison.totals.profit)
    : null;

  const divisionChart = useMemo(() => {
    // Divisi tanpa aktivitas tetap ada di tabel sebagai nol yang jujur, tetapi
    // tidak perlu memenuhi grafik dengan batang kosong.
    const rows = divisions.filter(
      (row) => row.key !== 'TANPA_DIVISI' && (toNumber(row.revenue) !== 0 || toNumber(row.totalCost) !== 0)
    );
    return {
      series: [
        { name: 'Pendapatan', data: rows.map((row) => toNumber(row.revenue)) },
        { name: 'Total Biaya', data: rows.map((row) => toNumber(row.totalCost)) },
        { name: 'Laba', data: rows.map((row) => toNumber(row.profit)) },
      ],
      options: {
        chart: { type: 'bar' as const, height: 300, toolbar: { show: false }, fontFamily: 'inherit' },
        colors: ['#059669', '#e11d48', '#0f172a'],
        plotOptions: { bar: { horizontal: false, columnWidth: '55%', borderRadius: 4 } },
        dataLabels: { enabled: false },
        stroke: { show: true, width: 2, colors: ['transparent'] },
        xaxis: { categories: rows.map((row) => row.label) },
        yaxis: {
          labels: {
            formatter: (value: number) =>
              Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(0)} jt` : String(Math.round(value)),
          },
        },
        legend: { position: 'top' as const, horizontalAlign: 'left' as const },
        grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
        tooltip: { y: { formatter: (value: number) => formatMoney(value) } },
      },
    };
  }, [divisions]);

  const trendSeries = useMemo(() => {
    const selected = trendDivision
      ? data?.trend.divisions.find((row) => row.key === trendDivision)
      : null;
    const rows = selected?.months ?? data?.trend.months ?? [];
    return {
      categories: rows.map((row) => row.label),
      series: [
        { name: 'Pendapatan', data: rows.map((row) => toNumber(row.revenue)) },
        { name: 'Total Biaya', data: rows.map((row) => toNumber(row.totalCost)) },
        { name: 'Laba', data: rows.map((row) => toNumber(row.profit)) },
      ],
    };
  }, [data, trendDivision]);

  const trendOptions = useMemo(
    () => ({
      chart: { type: 'line' as const, height: 300, toolbar: { show: false }, fontFamily: 'inherit' },
      colors: ['#059669', '#e11d48', '#0f172a'],
      stroke: { curve: 'smooth' as const, width: [3, 2, 3] },
      markers: { size: 3 },
      dataLabels: { enabled: false },
      xaxis: { categories: trendSeries.categories },
      yaxis: {
        labels: {
          formatter: (value: number) =>
            Math.abs(value) >= 1_000_000 ? `${(value / 1_000_000).toFixed(0)} jt` : String(Math.round(value)),
        },
      },
      legend: { position: 'top' as const, horizontalAlign: 'left' as const },
      grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
      tooltip: { y: { formatter: (value: number) => formatMoney(value) } },
    }),
    [trendSeries]
  );

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setProjectMessage(null);
    setShowProjectPanel(true);
  }

  function startEdit(project: ProjectDto) {
    setEditingId(project.id);
    setDraft({
      name: project.name,
      code: project.code ?? '',
      clientName: project.clientName ?? '',
      description: project.description ?? '',
      division: project.division ?? '',
      status: project.status,
      startDate: project.startDate ? project.startDate.slice(0, 10) : '',
      endDate: project.endDate ? project.endDate.slice(0, 10) : '',
    });
    setProjectMessage(null);
    setShowProjectPanel(true);
  }

  async function submitProject(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setProjectMessage(null);
    try {
      const payload = {
        ...draft,
        code: draft.code || null,
        clientName: draft.clientName || null,
        description: draft.description || null,
        division: draft.division || null,
        startDate: draft.startDate || null,
        endDate: draft.endDate || null,
      };
      if (editingId) {
        await apiSend(`/api/v1/accounting/projects/${editingId}`, 'PATCH', payload);
      } else {
        await apiSend('/api/v1/accounting/projects', 'POST', payload);
      }
      setProjectMessage({ type: 'ok', text: editingId ? 'Proyek berhasil diperbarui.' : 'Proyek berhasil dibuat.' });
      setEditingId(null);
      setDraft(emptyDraft());
      reloadProjects();
      reload();
    } catch (err) {
      setProjectMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menyimpan proyek.' });
    } finally {
      setSaving(false);
    }
  }

  async function archiveProject(id: string, name: string) {
    if (!window.confirm(`Arsipkan proyek "${name}"? Histori jurnal tetap tersimpan.`)) return;
    setSaving(true);
    try {
      await apiSend(`/api/v1/accounting/projects/${id}`, 'DELETE');
      setProjectMessage({ type: 'ok', text: 'Proyek diarsipkan.' });
      reloadProjects();
      reload();
    } catch (err) {
      setProjectMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal mengarsipkan proyek.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <ReportToolbar
        period={period}
        onPeriodChange={onPeriodChange}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
        exportUrl={`/api/v1/accounting/reports/export?period=${encodeURIComponent(period)}`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Pendapatan" value={formatMoney(data?.current.totals.revenue)} />
        <Kpi label="Total Biaya" value={formatMoney(data?.current.totals.totalCost)} tone="red" />
        <Kpi
          label="Laba Bersih"
          value={formatMoney(data?.current.totals.profit)}
          tone={toNumber(data?.current.totals.profit) >= 0 ? 'emerald' : 'red'}
        />
        <Kpi label="Margin Bersih" value={formatPercent(data?.current.totals.marginPct)} />
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <HighlightCard
          icon={<BadgeCheck className="h-4 w-4 text-emerald-700" />}
          label="Divisi Paling Untung"
          value={topDivision?.label ?? 'Belum ada laba positif'}
          detail={topDivision ? `${formatMoney(topDivision.profit)} · ${formatPercent(topDivision.marginPct)}` : undefined}
          tone="emerald"
        />
        <HighlightCard
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          label="Divisi Biaya Tertinggi"
          value={topCostDivision?.label ?? 'Belum ada biaya'}
          detail={topCostDivision ? `${formatMoney(topCostDivision.totalCost)} · ${formatPercent(topCostDivision.costSharePct)} dari total` : undefined}
          tone="red"
        />
      </div>

      {data?.comparison && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Perbandingan antarperiode</p>
              <p className="mt-1 text-xs text-slate-600">
                {comparisonLabel(comparative)} · {formatPeriodRange(data.comparisonPeriod)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs">
              <Metric label="Laba periode ini" value={formatMoney(data.current.totals.profit)} />
              <Metric label="Laba pembanding" value={formatMoney(data.comparison.totals.profit)} />
              <div className={`flex items-center gap-1 font-semibold ${comparisonDeltaProfit !== null && comparisonDeltaProfit < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {comparisonDeltaProfit !== null && comparisonDeltaProfit < 0 ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                {formatPercent(comparisonDeltaProfit)}
              </div>
            </div>
          </div>
        </div>
      )}

      <ReportShell
        title="Profitabilitas per Unit Bisnis"
        subtitle={`Periode ${periodLabel(period)} · ${data?.trendMonths ?? trendMonths} bulan tren`}
        loading={loading}
        error={error}
        warnings={warnings}
        onRetry={reload}
      >
        <div className="klir-no-print flex flex-wrap gap-1.5 px-3 pt-3">
          {[
            { id: 'division', label: 'Divisi' },
            { id: 'project', label: 'Proyek' },
            { id: 'product', label: 'Produk' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as typeof tab)}
              className={`min-h-9 rounded-lg border px-3 text-xs font-medium ${
                tab === item.id
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === 'division' && (
          <div className="space-y-4 p-3">
            <div className="rounded-lg border border-slate-200 p-3">
              {divisionChart.series[0].data.length > 0 ? (
                <Chart options={divisionChart.options} series={divisionChart.series} type="bar" height={300} />
              ) : (
                <Empty />
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Divisi</th>
                    <th className="py-2 pr-3 text-right">Pendapatan</th>
                    <th className="py-2 pr-3 text-right">HPP</th>
                    <th className="py-2 pr-3 text-right">Beban Ops</th>
                    <th className="py-2 pr-3 text-right">Pajak</th>
                    <th className="py-2 pr-3 text-right">Total Biaya</th>
                    <th className="py-2 pr-3 text-right">Laba</th>
                    <th className="py-2 pr-3 text-right">Margin</th>
                    <th className="py-2 pr-3 text-right">Porsi Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {divisions.map((row) => (
                    <tr key={row.key} className="border-b border-slate-50">
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-800">{row.label}</span>
                          {row.isMostProfitable && <Badge tone="emerald">Paling Untung</Badge>}
                          {row.isHighestCost && <Badge tone="red">Biaya Tertinggi</Badge>}
                          {row.key === 'TANPA_DIVISI' && <Badge tone="amber">Belum terklasifikasi</Badge>}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.revenue)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.cogs)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.operatingExpenses)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.taxExpenses)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.totalCost)}</td>
                      <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${toNumber(row.profit) < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatMoney(row.profit)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatPercent(row.marginPct)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatPercent(row.profitSharePct)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(data?.current.totals.revenue)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(data?.current.totals.cogs)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(data?.current.totals.operatingExpenses)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(data?.current.totals.taxExpenses)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(data?.current.totals.totalCost)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(data?.current.totals.profit)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatPercent(data?.current.totals.marginPct)}</td>
                    <td className="py-2 pr-3" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {tab === 'project' && (
          <div className="space-y-4 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="max-w-2xl text-[11px] leading-relaxed text-slate-500">
                Laba proyek adalah <strong className="text-slate-700">laba langsung</strong>: hanya pendapatan dan biaya yang ditandai ke proyek. Overhead bersama tidak dialokasikan otomatis.
              </p>
              {canManageProjects && (
                <button
                  onClick={startCreate}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                >
                  <Plus className="h-3.5 w-3.5" /> Kelola Proyek
                </button>
              )}
            </div>

            {showProjectPanel && canManageProjects && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                    {editingId ? 'Ubah Proyek' : 'Proyek Baru'}
                  </h4>
                  <button
                    onClick={() => {
                      setShowProjectPanel(false);
                      setEditingId(null);
                      setDraft(emptyDraft());
                    }}
                    className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
                    aria-label="Tutup form proyek"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={submitProject} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Nama proyek *">
                    <input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={inputClass} />
                  </Field>
                  <Field label="Kode">
                    <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} className={inputClass} placeholder="PRJ-001" />
                  </Field>
                  <Field label="Divisi">
                    <select value={draft.division} onChange={(e) => setDraft({ ...draft, division: e.target.value })} className={inputClass}>
                      <option value="">Tanpa Divisi</option>
                      {DIVISIONS.map((value) => (
                        <option key={value} value={value}>{divisionLabel(value)}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Klien">
                    <input value={draft.clientName} onChange={(e) => setDraft({ ...draft, clientName: e.target.value })} className={inputClass} />
                  </Field>
                  <Field label="Status">
                    <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })} className={inputClass}>
                      <option value="ACTIVE">Aktif</option>
                      <option value="ON_HOLD">Ditunda</option>
                      <option value="COMPLETED">Selesai</option>
                      <option value="ARCHIVED">Diarsipkan</option>
                    </select>
                  </Field>
                  <Field label="Mulai">
                    <input type="date" value={draft.startDate} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} className={inputClass} />
                  </Field>
                  <Field label="Selesai">
                    <input type="date" value={draft.endDate} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} className={inputClass} />
                  </Field>
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Field label="Deskripsi">
                      <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={2} className={inputClass} />
                    </Field>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      {editingId ? 'Simpan Perubahan' : 'Buat Proyek'}
                    </button>
                    {projectMessage && (
                      <span className={`text-xs ${projectMessage.type === 'ok' ? 'text-emerald-700' : 'text-red-600'}`}>
                        {projectMessage.text}
                      </span>
                    )}
                  </div>
                </form>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Proyek</th>
                    <th className="py-2 pr-3">Divisi</th>
                    <th className="py-2 pr-3 text-right">Pendapatan</th>
                    <th className="py-2 pr-3 text-right">Total Biaya</th>
                    <th className="py-2 pr-3 text-right">Laba</th>
                    <th className="py-2 pr-3 text-right">Margin</th>
                    <th className="py-2 pr-3 text-right">Porsi Laba</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((row) => (
                    <tr key={row.key} className="border-b border-slate-50">
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-slate-800">{row.label}</span>
                          {row.code && <span className="font-mono text-[10px] text-slate-400">{row.code}</span>}
                          {row.key === 'TANPA_PROYEK' && <Badge tone="amber">Belum ditandai</Badge>}
                        </div>
                        {row.clientName && <p className="text-[10px] text-slate-400">{row.clientName}</p>}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{row.divisionLabel}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.revenue)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.totalCost)}</td>
                      <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${toNumber(row.profit) < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatMoney(row.profit)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatPercent(row.marginPct)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatPercent(row.profitSharePct)}</td>
                    </tr>
                  ))}
                  {projects.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Belum ada proyek dengan aktivitas pendapatan/biaya pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {canManageProjects && (
              <div className="border-t border-slate-100 pt-3">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Master Proyek</h4>
                {projectsLoading ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat proyek…</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {(projectData?.projects ?? []).map((project) => (
                      <div key={project.id} className="rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-800">{project.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {project.code || 'Tanpa kode'} · {project.division ? divisionLabel(project.division) : 'Tanpa Divisi'}
                            </p>
                          </div>
                          <Badge tone={project.status === 'ACTIVE' ? 'emerald' : project.status === 'ARCHIVED' ? 'slate' : 'amber'}>
                            {statusLabel[project.status] ?? project.status}
                          </Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button onClick={() => startEdit(project)} className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 hover:text-slate-900">
                            <Pencil className="h-3 w-3" /> Ubah
                          </button>
                          {project.status !== 'ARCHIVED' && (
                            <button onClick={() => archiveProject(project.id, project.name)} className="inline-flex items-center gap-1 text-[10px] font-medium text-red-500 hover:text-red-700">
                              <Archive className="h-3 w-3" /> Arsipkan
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    {(projectData?.projects ?? []).length === 0 && (
                      <p className="text-xs text-slate-400">Belum ada proyek. Buat proyek pertama lewat tombol Kelola Proyek.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'product' && (
          <div className="space-y-4 p-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MiniKpi label="Pendapatan Produk" value={formatMoney(data?.products.totals.revenue)} />
              <MiniKpi label="HPP Produk" value={formatMoney(data?.products.totals.cogs)} tone="red" />
              <MiniKpi label="Laba Kotor" value={formatMoney(data?.products.totals.grossProfit)} tone="emerald" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-3">Produk</th>
                    <th className="py-2 pr-3 text-right">Qty Terjual</th>
                    <th className="py-2 pr-3 text-right">Qty Tanpa Harga</th>
                    <th className="py-2 pr-3 text-right">Pendapatan</th>
                    <th className="py-2 pr-3 text-right">HPP</th>
                    <th className="py-2 pr-3 text-right">Laba Kotor</th>
                    <th className="py-2 pr-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((row) => (
                    <tr key={row.productId} className="border-b border-slate-50">
                      <td className="py-2 pr-3">
                        <p className="font-medium text-slate-800">{row.name}</p>
                        <p className="text-[10px] text-slate-400">{row.sku || 'Tanpa SKU'} · {row.unit}</p>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{row.pricedQty.toLocaleString('id-ID')}</td>
                      <td className={`py-2 pr-3 text-right tabular-nums ${row.unpricedQty > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                        {row.unpricedQty.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.revenue)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.cogs)}</td>
                      <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${row.grossProfit < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatMoney(row.grossProfit)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatPercent(row.marginPct)}</td>
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Belum ada penjualan stok pada periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Tren Kinerja Antarperiode</h4>
              <p className="text-[10px] text-slate-400">Pendapatan, biaya, dan laba bulanan</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={trendDivision}
                onChange={(e) => setTrendDivision(e.target.value)}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-700"
              >
                <option value="">Semua divisi</option>
                {(data?.trend.divisions ?? []).map((row) => (
                  <option key={row.key} value={row.key}>{row.label}</option>
                ))}
              </select>
              <select
                value={trendMonths}
                onChange={(e) => setTrendMonths(Number(e.target.value))}
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-[11px] text-slate-700"
              >
                <option value={6}>6 bulan</option>
                <option value={12}>12 bulan</option>
                <option value={24}>24 bulan</option>
              </select>
              <button onClick={reload} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2 text-[11px] font-medium text-slate-600 hover:bg-slate-50">
                <RefreshCw className="h-3 w-3" /> Muat ulang
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-2">
            {trendSeries.categories.length > 0 ? (
              <Chart options={trendOptions} series={trendSeries.series} type="line" height={300} />
            ) : (
              <Empty />
            )}
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3">Bulan</th>
                  <th className="py-2 pr-3 text-right">Pendapatan</th>
                  <th className="py-2 pr-3 text-right">Total Biaya</th>
                  <th className="py-2 pr-3 text-right">Laba</th>
                  <th className="py-2 pr-3 text-right">Margin</th>
                  <th className="py-2 pr-3 text-right">Δ Laba</th>
                </tr>
              </thead>
              <tbody>
                {trendSeriesData(data, trendDivision).map((row, index, rows) => {
                  const previous = index > 0 ? rows[index - 1] : null;
                  const delta = previous ? toNumber(row.profit) - toNumber(previous.profit) : null;
                  return (
                    <tr key={row.period} className="border-b border-slate-50">
                      <td className="py-2 pr-3 font-medium text-slate-700">{row.label}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.revenue)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(row.totalCost)}</td>
                      <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${toNumber(row.profit) < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatMoney(row.profit)}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{formatPercent(row.marginPct)}</td>
                      <td className={`py-2 pr-3 text-right tabular-nums ${delta !== null && delta < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {delta === null ? '-' : `${delta > 0 ? '+' : ''}${formatMoney(delta)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </ReportShell>
    </div>
  );
}

function trendSeriesData(data: ProfitabilityDto | null, division: string) {
  if (!data) return [];
  if (!division) return data.trend.months;
  return data.trend.divisions.find((row) => row.key === division)?.months ?? [];
}

function comparisonLabel(mode: string): string {
  if (mode === 'prev_month') return 'Dibanding bulan sebelumnya';
  if (mode === 'prev_year') return 'Dibanding tahun sebelumnya';
  if (mode === 'ytd') return 'Dibanding awal tahun buku (YTD)';
  return 'Tanpa pembanding';
}

function formatPeriodRange(range: { startDate: string; endDate: string } | null): string {
  if (!range) return '-';
  const start = new Date(range.startDate);
  const end = new Date(range.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
  return `${start.toLocaleDateString('id-ID')} – ${end.toLocaleDateString('id-ID')}`;
}

function Kpi({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'emerald' | 'red' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function MiniKpi({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'emerald' | 'red' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-sm font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

function HighlightCard({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: 'emerald' | 'red';
}) {
  return (
    <div className={`rounded-xl border bg-white p-4 ${tone === 'emerald' ? 'border-emerald-200' : 'border-red-200'}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      </div>
      <p className={`mt-2 text-sm font-bold ${tone === 'emerald' ? 'text-emerald-800' : 'text-red-700'}`}>{value}</p>
      {detail && <p className="mt-1 text-[11px] tabular-nums text-slate-500">{detail}</p>}
    </div>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'emerald' | 'red' | 'amber' | 'slate' }) {
  const classes = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-50 text-slate-600 border-slate-200',
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${classes}`}>{children}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-semibold tabular-nums text-slate-800">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Empty() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-slate-400">
      <Building2 className="h-6 w-6" />
      <p className="text-xs">Belum ada data untuk ditampilkan.</p>
    </div>
  );
}

const inputClass =
  'h-9 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200';
