'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Gauge,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { formatMoney, formatPercent } from './client';
import { useApi } from './ReportViews';

interface HealthComponent {
  key: string;
  label: string;
  weight: number;
  score: number | null;
  status: 'SEHAT' | 'CUKUP' | 'BERISIKO' | 'KRITIS' | 'TIDAK_ADA_DATA';
  summary: string;
  metrics: Record<string, number | null>;
}

interface Recommendation {
  component: string;
  priority: 'TINGGI' | 'SEDANG' | 'RENDAH';
  title: string;
  detail: string;
}

interface HealthData {
  asOf: string;
  totalScore: number | null;
  grade: string;
  gradeLabel: string;
  summary: string;
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT';
  components: HealthComponent[];
  strengths: string[];
  risks: string[];
  recommendations: Recommendation[];
  metrics: Record<string, number | null>;
  monthlyCashFlows: Array<{ key: string; label: string; net: number }>;
  warnings: string[];
}

const COMPONENT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  LIQUIDITY: Wallet,
  PROFITABILITY: ArrowUpRight,
  DEBT_BURDEN: ArrowDownRight,
  RECEIVABLE_TURNOVER: BarChart3,
  CASH_STABILITY: Gauge,
};

function scoreColor(score: number | null): string {
  if (score === null) return '#94a3b8';
  if (score >= 85) return '#059669';
  if (score >= 70) return '#0d9488';
  if (score >= 55) return '#d97706';
  if (score >= 40) return '#ea580c';
  return '#dc2626';
}

function statusClass(status: HealthComponent['status']): string {
  if (status === 'SEHAT') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'CUKUP') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'BERISIKO') return 'border-orange-200 bg-orange-50 text-orange-800';
  if (status === 'KRITIS') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function priorityClass(priority: Recommendation['priority']): string {
  if (priority === 'TINGGI') return 'border-red-200 bg-red-50 text-red-700';
  if (priority === 'SEDANG') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function metricLabel(key: string): string {
  const labels: Record<string, string> = {
    liquidityRatio: 'Kas + piutang / liabilitas',
    cashRunwayMonths: 'Runway kas (bulan)',
    netMarginPct: 'Margin laba',
    previousNetMarginPct: 'Margin periode sebelumnya',
    debtRatio: 'Utang / aset',
    obligationCoverage: 'Pendapatan / kewajiban 30 hari',
    obligationsDue30: 'Kewajiban 30 hari',
    dsoDays: 'DSO (hari)',
    overdueReceivableRatio: 'Piutang jatuh tempo',
    receivables: 'Piutang',
    positiveMonthsRatio: 'Bulan arus kas positif',
    cashFlowCv: 'Variasi arus kas',
    averageMonthlyCashFlow: 'Rata-rata arus kas bulanan',
  };
  return labels[key] ?? key;
}

function metricValue(key: string, value: number | null): string {
  if (value === null || value === undefined) return '—';
  const percentKeys = new Set([
    'netMarginPct',
    'previousNetMarginPct',
    'debtRatio',
    'overdueReceivableRatio',
    'positiveMonthsRatio',
  ]);
  if (percentKeys.has(key)) {
    return formatPercent(key === 'netMarginPct' || key === 'previousNetMarginPct' ? value : value * 100);
  }
  if (key === 'liquidityRatio' || key === 'obligationCoverage') {
    return `${value.toFixed(2)}x`;
  }
  if (key === 'cashRunwayMonths') return `${value.toFixed(2)} bulan`;
  if (key === 'dsoDays') return `${value.toFixed(0)} hari`;
  if (key === 'cashFlowCv') return value.toFixed(2);
  if (/(obligationsDue30|receivables|averageMonthlyCashFlow)/.test(key)) return formatMoney(value);
  return String(Math.round(value * 100) / 100);
}

export function FinancialHealthView() {
  const { data, loading, error, reload } = useApi<HealthData>('/api/v1/accounting/financial-health');

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-20 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Menghitung kesehatan keuangan…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" /> Gagal memuat kesehatan keuangan
        </p>
        <p className="mt-1 text-xs">{error}</p>
        <button onClick={reload} className="mt-3 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold">
          Coba lagi
        </button>
      </div>
    );
  }

  if (!data) return null;

  const score = data.totalScore;
  const color = scoreColor(score);
  const degrees = score === null ? 0 : Math.max(0, Math.min(100, score)) * 3.6;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Financial Health Score
            </p>
            <p className="mt-0.5 max-w-2xl text-[11px] text-slate-500">{data.summary}</p>
          </div>
          <button
            type="button"
            onClick={reload}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Hitung ulang
          </button>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr]">
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-5">
            <div
              className="relative flex h-36 w-36 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${color} ${degrees}deg, #e2e8f0 0deg)` }}
            >
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <span className="text-3xl font-black tabular-nums" style={{ color }}>
                  {score === null ? '—' : score}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">dari 100</span>
              </div>
            </div>
            <span
              className="mt-3 rounded-full border px-3 py-1 text-xs font-bold"
              style={{ borderColor: color, color, backgroundColor: `${color}12` }}
            >
              {data.gradeLabel}
            </span>
            <span className="mt-2 text-[10px] text-slate-500">
              Data: {data.dataQuality === 'COMPLETE' ? 'Lengkap' : data.dataQuality === 'PARTIAL' ? 'Sebagian' : 'Belum cukup'}
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {data.components.map((component) => {
              const Icon = COMPONENT_ICON[component.key] ?? Gauge;
              return (
                <div key={component.key} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                      <Icon className="h-3.5 w-3.5 text-slate-400" /> {component.label}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">{component.weight}%</span>
                  </div>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-2xl font-black tabular-nums" style={{ color: scoreColor(component.score) }}>
                      {component.score === null ? '—' : component.score}
                    </span>
                    <span className="pb-1 text-[10px] text-slate-400">/100</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${component.score ?? 0}%`, backgroundColor: scoreColor(component.score) }}
                    />
                  </div>
                  <span className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-bold ${statusClass(component.status)}`}>
                    {component.status.replaceAll('_', ' ')}
                  </span>
                  <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-slate-500">{component.summary}</p>
                </div>
              );
            })}
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" /> Faktor Positif
          </p>
          {data.strengths.length === 0 ? (
            <p className="mt-3 text-[11px] text-slate-500">Belum ada komponen dengan skor di atas 80.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.strengths.map((item) => (
                <li key={item} className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-800">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <ArrowDownRight className="h-3.5 w-3.5 text-red-600" /> Faktor Risiko
          </p>
          {data.risks.length === 0 ? (
            <p className="mt-3 text-[11px] text-slate-500">Tidak ada komponen berisiko berdasarkan data saat ini.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.risks.map((item) => (
                <li key={item} className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-[11px] text-red-800">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Rekomendasi Perbaikan
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {data.recommendations.map((rec) => (
            <div key={`${rec.component}-${rec.title}`} className="rounded-lg border border-slate-200 p-3">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold text-slate-800">Metrik Utama</p>
          <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
            {Object.entries(data.metrics).map(([key, value]) => (
              <div key={key} className="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-1.5">
                <dt className="text-[10px] text-slate-500">{metricLabel(key)}</dt>
                <dd className="font-mono text-[11px] font-semibold text-slate-800">{metricValue(key, value)}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold text-slate-800">Arus Kas 6 Bulan</p>
          <div className="mt-4 flex h-40 items-end gap-2">
            {data.monthlyCashFlows.map((point) => {
              const max = Math.max(...data.monthlyCashFlows.map((p) => Math.abs(p.net)), 1);
              const height = Math.max(4, (Math.abs(point.net) / max) * 100);
              return (
                <div key={point.key} className="flex flex-1 flex-col items-center gap-1">
                  <span className={`text-[9px] font-semibold ${point.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {point.net >= 0 ? '+' : '−'}{Math.round(Math.abs(point.net) / 1_000_000)}jt
                  </span>
                  <div className="flex h-28 w-full items-end justify-center">
                    <div
                      className={`w-full max-w-8 rounded-t ${point.net >= 0 ? 'bg-emerald-400' : 'bg-red-400'}`}
                      style={{ height: `${height}%` }}
                      title={formatMoney(point.net)}
                    />
                  </div>
                  <span className="text-[9px] text-slate-500">{point.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
