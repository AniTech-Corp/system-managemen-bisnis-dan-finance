'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldAlert,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { formatMoney, formatPercent } from './client';
import { useApi } from './ReportViews';

const Chart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
  loading: () => <div className="h-[300px] animate-pulse rounded-lg bg-slate-100" />,
});

interface CrisisPoint {
  date: string;
  day: number;
  projectedBalance: number;
  expectedCollection: number;
  obligation: number;
  operatingExpense: number;
}

interface CrisisObligation {
  id: string;
  name: string;
  dueDate: string;
  amount: number;
  daysUntilDue: number;
  overdue: boolean;
}

interface CrisisReceivable {
  id: string;
  reference: string;
  client: string;
  dueDate: string;
  amount: number;
  daysOverdue: number;
  collectionProbability: number;
  expectedCollectionDate: string;
  expectedAmount: number;
}

interface CrisisRecommendation {
  priority: 'TINGGI' | 'SEDANG' | 'RENDAH';
  title: string;
  detail: string;
}

interface CashCrisisData {
  asOf: string;
  horizonDays: number;
  status: 'SAFE' | 'WATCH' | 'WARNING' | 'CRITICAL';
  statusLabel: string;
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT';
  currentCash: number;
  monthlyOperatingExpense: number;
  dailyOperatingExpense: number;
  projectedBalance: number;
  minimumProjectedBalance: number;
  minimumProjectedDate: string;
  firstShortfallDate: string | null;
  firstShortfallDay: number | null;
  runwayDays: number;
  totalExpectedCollections: number;
  totalObligations: number;
  totalOverdueReceivables: number;
  collectionRisk: {
    level: 'RENDAH' | 'SEDANG' | 'TINGGI' | 'TIDAK_DAPAT_DIHITUNG';
    overdueCount: number;
    overdueAmount: number;
    overdueRatio: number | null;
    averageDaysOverdue: number | null;
    historicalAverageDaysLate: number | null;
    historicalPaidInvoiceCount: number;
    hasHistory: boolean;
  };
  obligations: CrisisObligation[];
  receivables: CrisisReceivable[];
  points: CrisisPoint[];
  recommendations: CrisisRecommendation[];
  warnings: string[];
}

const STATUS_STYLE: Record<CashCrisisData['status'], { banner: string; dot: string; text: string }> = {
  SAFE: { banner: 'border-emerald-200 bg-emerald-50', dot: 'bg-emerald-500', text: 'text-emerald-800' },
  WATCH: { banner: 'border-amber-200 bg-amber-50', dot: 'bg-amber-500', text: 'text-amber-900' },
  WARNING: { banner: 'border-orange-200 bg-orange-50', dot: 'bg-orange-500', text: 'text-orange-900' },
  CRITICAL: { banner: 'border-red-200 bg-red-50', dot: 'bg-red-600', text: 'text-red-800' },
};

const RISK_STYLE: Record<CashCrisisData['collectionRisk']['level'], string> = {
  RENDAH: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  SEDANG: 'border-amber-200 bg-amber-50 text-amber-800',
  TINGGI: 'border-red-200 bg-red-50 text-red-700',
  TIDAK_DAPAT_DIHITUNG: 'border-slate-200 bg-slate-50 text-slate-600',
};

function priorityClass(priority: CrisisRecommendation['priority']): string {
  if (priority === 'TINGGI') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'SEDANG') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function dateLabel(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function CashCrisisView() {
  const [horizon, setHorizon] = useState('30');
  const url = `/api/v1/accounting/cash-crisis?horizon=${horizon}`;
  const { data, loading, error, reload } = useApi<CashCrisisData>(url);

  const chart = useMemo(() => {
    if (!data) return null;
    const labels = data.points.map((p) => `H+${p.day}`);
    const values = data.points.map((p) => p.projectedBalance);
    return {
      labels,
      values,
    };
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-20 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Menghitung proyeksi kas…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" /> Gagal memuat peringatan dini kas
        </p>
        <p className="mt-1 text-xs">{error}</p>
        <button onClick={reload} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold">
          Coba lagi
        </button>
      </div>
    );
  }

  if (!data) return null;

  const style = STATUS_STYLE[data.status];
  const chartOptions = {
    chart: { toolbar: { show: false }, zoom: { enabled: false }, fontFamily: 'inherit' },
    stroke: { curve: 'smooth' as const, width: 2.5 },
    colors: [data.status === 'CRITICAL' || data.status === 'WARNING' ? '#dc2626' : data.status === 'WATCH' ? '#d97706' : '#059669'],
    dataLabels: { enabled: false },
    grid: { borderColor: '#e2e8f0', strokeDashArray: 3 },
    xaxis: {
      categories: chart?.labels ?? [],
      tickAmount: Math.min(10, data.points.length - 1),
      labels: { style: { fontSize: '10px', colors: '#64748b' }, rotate: 0 },
    },
    yaxis: {
      labels: {
        style: { fontSize: '10px', colors: '#64748b' },
        formatter: (value: number) => {
          if (Math.abs(value) >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`;
          if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}jt`;
          if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}rb`;
          return String(Math.round(value));
        },
      },
    },
    annotations: {
      yaxis: [
        {
          y: 0,
          borderColor: '#ef4444',
          strokeDashArray: 4,
          label: { text: 'Batas kas 0', style: { fontSize: '9px', color: '#b91c1c', background: '#fee2e2' } },
        },
      ],
    },
    tooltip: {
      y: { formatter: (value: number) => formatMoney(value) },
    },
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <ShieldAlert className="h-4 w-4 text-amber-600" /> Cash Crisis Early Warning
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Proyeksi saldo kas berdasarkan kewajiban, piutang, dan beban operasional aktual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            {[7, 14, 30, 60, 90].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setHorizon(String(value))}
                className={`min-h-8 rounded-md px-2.5 text-[11px] font-semibold transition-colors ${
                  horizon === String(value) ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {value}h
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reload}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Muat ulang
          </button>
        </div>
      </div>

      <div className={`rounded-xl border p-4 ${style.banner}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-3 w-3 rounded-full ${style.dot} ${data.status === 'CRITICAL' ? 'animate-pulse' : ''}`} />
            <div>
              <p className={`text-sm font-bold ${style.text}`}>Status: {data.statusLabel}</p>
              <p className="mt-0.5 text-[11px] text-slate-600">
                {data.firstShortfallDate
                  ? `Proyeksi kas diperkirakan minus pada ${dateLabel(data.firstShortfallDate)} (H+${data.firstShortfallDay}).`
                  : `Tidak ada proyeksi saldo minus dalam ${data.horizonDays} hari ke depan.`}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                Data: {data.dataQuality === 'COMPLETE' ? 'lengkap' : data.dataQuality === 'PARTIAL' ? 'sebagian' : 'belum cukup'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-4">
            <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Kas saat ini</p>
              <p className="mt-0.5 text-xs font-bold text-slate-900">{formatMoney(data.currentCash)}</p>
            </div>
            <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Proyeksi H+{data.horizonDays}</p>
              <p className={`mt-0.5 text-xs font-bold ${data.projectedBalance < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                {formatMoney(data.projectedBalance)}
              </p>
            </div>
            <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Kewajiban</p>
              <p className="mt-0.5 text-xs font-bold text-slate-900">{formatMoney(data.totalObligations)}</p>
            </div>
            <div className="rounded-lg border border-white/70 bg-white/70 px-3 py-2">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Piutang jatuh tempo</p>
              <p className="mt-0.5 text-xs font-bold text-slate-900">{formatMoney(data.totalOverdueReceivables)}</p>
            </div>
          </div>
        </div>
      </div>

      {data.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          {data.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-[11px] text-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {warning}
            </p>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Wallet className="h-3.5 w-3.5" /> Saldo minimum
          </p>
          <p className={`mt-1 text-lg font-black ${data.minimumProjectedBalance < 0 ? 'text-red-700' : 'text-slate-900'}`}>
            {formatMoney(data.minimumProjectedBalance)}
          </p>
          <p className="text-[10px] text-slate-500">{dateLabel(data.minimumProjectedDate)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Clock3 className="h-3.5 w-3.5" /> Runway
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">
            {data.firstShortfallDate ? `${data.runwayDays} hari` : `≥ ${data.horizonDays} hari`}
          </p>
          <p className="text-[10px] text-slate-500">
            {data.firstShortfallDate ? 'sebelum proyeksi minus' : 'tidak ada shortfall dalam horizon'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <TrendingDown className="h-3.5 w-3.5" /> Ekspektasi piutang
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatMoney(data.totalExpectedCollections)}</p>
          <p className="text-[10px] text-slate-500">tertimbang probabilitas umur</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <CalendarClock className="h-3.5 w-3.5" /> Beban operasional
          </p>
          <p className="mt-1 text-lg font-black text-slate-900">{formatMoney(data.monthlyOperatingExpense)}</p>
          <p className="text-[10px] text-slate-500">per bulan (rata-rata 3 bulan)</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-800">Proyeksi Saldo Kas</p>
          <span className="text-[10px] text-slate-500">Garis merah = batas saldo nol</span>
        </div>
        <div className="mt-2">
          <Chart type="area" height={300} options={chartOptions} series={[{ name: 'Saldo proyeksi', data: chart?.values ?? [] }]} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-bold text-slate-800">Kewajiban Terdekat</p>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
              {data.obligations.length} dokumen
            </span>
          </div>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {data.obligations.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500">Tidak ada kewajiban terjadwal dalam horizon ini.</p>
            ) : (
              data.obligations.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-800">{row.name}</p>
                    <p className="text-[10px] text-slate-500">
                      Jatuh tempo {dateLabel(row.dueDate)} · {row.overdue ? 'sudah lewat' : `H+${row.daysUntilDue}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-slate-900">{formatMoney(row.amount)}</p>
                    {row.overdue && <span className="text-[9px] font-semibold text-red-600">Terlambat</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-xs font-bold text-slate-800">Risiko Pembayaran Pelanggan</p>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${RISK_STYLE[data.collectionRisk.level]}`}>
              {data.collectionRisk.level.replaceAll('_', ' ')}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
            <div>
              <p className="text-[9px] uppercase tracking-wide text-slate-500">Faktur telat</p>
              <p className="text-sm font-bold text-slate-900">{data.collectionRisk.overdueCount}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wide text-slate-500">Nilai telat</p>
              <p className="text-sm font-bold text-slate-900">{formatMoney(data.collectionRisk.overdueAmount)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wide text-slate-500">Rata-rata telat</p>
              <p className="text-sm font-bold text-slate-900">
                {data.collectionRisk.averageDaysOverdue === null ? '—' : `${Math.round(data.collectionRisk.averageDaysOverdue)} hari`}
              </p>
            </div>
          </div>
          <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
            {data.receivables.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-slate-500">Tidak ada piutang terbuka.</p>
            ) : (
              data.receivables.slice(0, 12).map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold text-slate-800">{row.reference} · {row.client}</p>
                    <p className="text-[10px] text-slate-500">
                      {row.daysOverdue > 0 ? `Telat ${row.daysOverdue} hari` : `Jatuh tempo ${dateLabel(row.dueDate)}`} · peluang {formatPercent(row.collectionProbability * 100)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-bold text-slate-900">{formatMoney(row.amount)}</p>
                    <p className="text-[9px] text-emerald-700">ekspektasi {formatMoney(row.expectedAmount)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          {data.collectionRisk.historicalPaidInvoiceCount > 0 && (
            <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-500">
              Histori {data.collectionRisk.historicalPaidInvoiceCount} faktur lunas: rata-rata terlambat{' '}
              {data.collectionRisk.historicalAverageDaysLate === null ? '—' : `${Math.round(data.collectionRisk.historicalAverageDaysLate)} hari`}.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Rekomendasi Tindakan
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {data.recommendations.map((rec) => (
            <div key={`${rec.priority}-${rec.title}`} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-slate-800">{rec.title}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${priorityClass(rec.priority)}`}>
                  {rec.priority}
                </span>
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{rec.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
