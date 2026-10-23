'use client';

/**
 * FinancialDecisionSimulator
 *
 * UI untuk AI Financial Decision Simulator. Semua state form berada di
 * sub-komponen masing-masing (bukan di dalam fungsi render) supaya tidak
 * melanggar Rules of Hooks saat pengguna berpindah tab.
 *
 * Indikator sukses yang ditampilkan ke pengguna:
 *  - status request (berhasil / gagal beserta alasannya)
 *  - skor kelayakan 0-100 + peringkat antar skenario
 *  - level risiko (Rendah/Sedang/Tinggi/Kritis) + alasan terukur
 *  - dampak laba bulanan, arus kas bulan pertama, payback, runway
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Calculator,
  CheckCircle2,
  DollarSign,
  Info,
  Loader2,
  Minus,
  Plus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';

import type {
  DecisionRiskLevel,
  DecisionScenarioResult,
  DecisionSimulationAdjustments,
  DecisionSimulationResult,
  DecisionScenarioType,
} from '@/lib/ai-brain/simulator-engine-enhanced';

/* ------------------------------------------------------------------ */
/* Format helpers                                                      */
/* ------------------------------------------------------------------ */

const rupiah = (value: number | null | undefined, compact = false): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (compact) {
    if (abs >= 1_000_000_000) return `${value < 0 ? '-' : ''}Rp ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
    if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')} jt`;
    if (abs >= 1_000) return `${value < 0 ? '-' : ''}Rp ${(abs / 1_000).toFixed(0)} rb`;
  }
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
};

const signedRupiah = (value: number | null | undefined): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : '-'}${rupiah(Math.abs(value), true)}`;
};

const percent = (value: number | null | undefined, digits = 1): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(digits).replace('.', ',')}%`;
};

const RISK_STYLE: Record<DecisionRiskLevel, { label: string; text: string; bg: string; border: string; dot: string }> = {
  LOW: { label: 'Risiko Rendah', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  MODERATE: { label: 'Risiko Sedang', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', dot: 'bg-amber-500' },
  HIGH: { label: 'Risiko Tinggi', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', dot: 'bg-orange-500' },
  CRITICAL: { label: 'Risiko Kritis', text: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', dot: 'bg-rose-500' },
};

function verdict(scenario: DecisionScenarioResult): { label: string; tone: string } {
  if (scenario.riskLevel === 'CRITICAL' || scenario.score < 40) {
    return { label: 'Tidak disarankan', tone: 'text-rose-700 bg-rose-50 border-rose-200' };
  }
  if (scenario.score >= 65 && (scenario.riskLevel === 'LOW' || scenario.riskLevel === 'MODERATE')) {
    return { label: 'Layak dijalankan', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  }
  return { label: 'Perlu penyesuaian', tone: 'text-amber-700 bg-amber-50 border-amber-200' };
}

/* ------------------------------------------------------------------ */
/* Sub-komponen form (satu komponen per skenario -> hooks aman)        */
/* ------------------------------------------------------------------ */

interface FormProps {
  disabled: boolean;
  onSubmit: (type: DecisionScenarioType, adjustments: DecisionSimulationAdjustments, title: string) => void;
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>
      <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
        {prefix && <span className="pl-3 text-xs font-medium text-slate-400">{prefix}</span>}
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent px-2.5 py-2 text-sm font-semibold text-slate-900 outline-none"
        />
        {suffix && <span className="pr-3 text-xs font-medium text-slate-400">{suffix}</span>}
      </div>
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-400">{hint}</span>}
    </label>
  );
}

function SliderField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  display,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  display: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">{label}</span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-800">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-600"
      />
      {hint && <span className="mt-1 block text-[11px] leading-snug text-slate-400">{hint}</span>}
    </div>
  );
}

function StepperField({
  label,
  value,
  onChange,
  min = 0,
  max = 999,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix: string;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50"
          aria-label={`Kurangi ${label}`}
        >
          <Minus className="h-4 w-4" />
        </button>
        <div className="flex-1 rounded-lg border border-slate-300 bg-white py-2 text-center text-sm font-bold text-slate-900">
          {value} {suffix}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-colors hover:bg-slate-50"
          aria-label={`Tambah ${label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SubmitButton({ disabled, label = 'Analisis Skenario' }: { disabled: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {disabled ? 'Menganalisis...' : label}
    </button>
  );
}

function HiringForm({ disabled, onSubmit }: FormProps) {
  const [count, setCount] = useState(2);
  const [salary, setSalary] = useState(7_000_000);
  const [onboarding, setOnboarding] = useState(1_000_000);
  const [productivity, setProductivity] = useState(15);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          'employee_hiring',
          {
            scenarioType: 'employee_hiring',
            hiringCount: count,
            averageSalary: salary,
            onboardingCost: onboarding,
            productivityImpact: productivity / 100,
            durationMonths: 12,
          },
          `Simulasi Rekrutmen ${count} Orang`
        );
      }}
    >
      <StepperField label="Jumlah karyawan direkrut" value={count} onChange={setCount} suffix="orang" />
      <NumberField label="Rata-rata gaji per bulan" prefix="Rp" value={salary} onChange={setSalary} step={500_000} />
      <NumberField
        label="Biaya onboarding per karyawan"
        prefix="Rp"
        value={onboarding}
        onChange={setOnboarding}
        step={500_000}
        hint="Rekrutmen, pelatihan awal, dan peralatan kerja."
      />
      <SliderField
        label="Kenaikan pendapatan dari produktivitas"
        value={productivity}
        onChange={setProductivity}
        min={0}
        max={100}
        display={`${productivity}%`}
        hint="Perkiraan kenaikan pendapatan bulanan setelah tim baru produktif."
      />
      <SubmitButton disabled={disabled} />
    </form>
  );
}

function AssetForm({ disabled, onSubmit }: FormProps) {
  const [cost, setCost] = useState(150_000_000);
  const [years, setYears] = useState(5);
  const [method, setMethod] = useState<'cash' | 'installment' | 'lease'>('cash');
  const [roi, setRoi] = useState(18);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          'asset_purchase',
          {
            scenarioType: 'asset_purchase',
            assetCost: cost,
            depreciationPeriodYears: years,
            financingMethod: method,
            expectedROI: roi / 100,
            durationMonths: years * 12,
          },
          `Simulasi Pembelian Aset ${rupiah(cost, true)}`
        );
      }}
    >
      <NumberField label="Harga aset" prefix="Rp" value={cost} onChange={setCost} step={10_000_000} />
      <StepperField label="Periode penyusutan" value={years} onChange={setYears} min={1} max={20} suffix="tahun" />
      <div>
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Metode pembiayaan</span>
        <div className="grid grid-cols-3 gap-1.5">
          {([
            { id: 'cash', label: 'Tunai' },
            { id: 'installment', label: 'Angsuran' },
            { id: 'lease', label: 'Leasing' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setMethod(opt.id)}
              className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
                method === opt.id
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="mt-1 block text-[11px] leading-snug text-slate-400">
          Angsuran memakai bunga flat 6%/tahun, leasing 8%/tahun (asumsi internal).
        </span>
      </div>
      <SliderField
        label="Return tahunan yang diharapkan"
        value={roi}
        onChange={setRoi}
        min={0}
        max={60}
        display={`${roi}%`}
        hint="Tambahan laba tahunan dari aset, dihitung terhadap harga aset."
      />
      <SubmitButton disabled={disabled} />
    </form>
  );
}

function PricingForm({ disabled, onSubmit }: FormProps) {
  const [priceChange, setPriceChange] = useState(5);
  const [volume, setVolume] = useState(-6);
  const [competitive, setCompetitive] = useState(true);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          'pricing_change',
          {
            scenarioType: 'pricing_change',
            priceChangePercent: priceChange,
            volumeChangeImpact: 1 + volume / 100,
            competitiveResponse: competitive,
            durationMonths: 12,
          },
          `Simulasi Perubahan Harga ${percent(priceChange, 0)}`
        );
      }}
    >
      <SliderField
        label="Perubahan harga jual"
        value={priceChange}
        onChange={setPriceChange}
        min={-30}
        max={50}
        display={percent(priceChange, 0)}
      />
      <SliderField
        label="Perubahan volume penjualan"
        value={volume}
        onChange={setVolume}
        min={-50}
        max={80}
        display={percent(volume, 0)}
        hint="Perkiraan dampak ke jumlah unit terjual. Negatif bila harga naik."
      />
      <div>
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">Respons kompetitor</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setCompetitive(true)}
            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
              competitive ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Ada (tambah biaya promosi)
          </button>
          <button
            type="button"
            onClick={() => setCompetitive(false)}
            className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors ${
              !competitive ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            Tidak ada
          </button>
        </div>
      </div>
      <SubmitButton disabled={disabled} />
    </form>
  );
}

function CostForm({ disabled, onSubmit }: FormProps) {
  const [material, setMaterial] = useState(-5);
  const [labor, setLabor] = useState(-2);
  const [efficiency, setEfficiency] = useState(5);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          'cost_change',
          {
            scenarioType: 'cost_change',
            materialCostChangePercent: material,
            laborCostChangePercent: labor,
            operationalEfficiency: 1 + efficiency / 100,
            durationMonths: 12,
          },
          'Simulasi Efisiensi Biaya'
        );
      }}
    >
      <SliderField
        label="Perubahan biaya bahan baku"
        value={material}
        onChange={setMaterial}
        min={-30}
        max={30}
        display={percent(material, 0)}
      />
      <SliderField
        label="Perubahan biaya tenaga kerja"
        value={labor}
        onChange={setLabor}
        min={-30}
        max={30}
        display={percent(labor, 0)}
      />
      <SliderField
        label="Peningkatan efisiensi overhead"
        value={efficiency}
        onChange={setEfficiency}
        min={-20}
        max={40}
        display={percent(efficiency, 0)}
        hint="Efisiensi dari otomasi, negosiasi sewa, atau pengurangan pemborosan."
      />
      <SubmitButton disabled={disabled} />
    </form>
  );
}

function CustomForm({ disabled, onSubmit }: FormProps) {
  const [expense, setExpense] = useState(10_000_000);
  const [capex, setCapex] = useState(0);
  const [revenue, setRevenue] = useState(10);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(
          'custom',
          {
            scenarioType: 'custom',
            additionalMonthlyExpense: expense,
            oneTimeCapex: capex,
            expectedRevenueDeltaPercent: revenue,
            durationMonths: 12,
          },
          'Simulasi Skenario Bebas'
        );
      }}
    >
      <NumberField
        label="Tambahan biaya bulanan"
        prefix="Rp"
        value={expense}
        onChange={setExpense}
        step={1_000_000}
        hint="Isi negatif untuk penghematan biaya."
      />
      <NumberField label="Belanja modal sekali bayar" prefix="Rp" value={capex} onChange={setCapex} step={10_000_000} />
      <SliderField
        label="Perubahan pendapatan"
        value={revenue}
        onChange={setRevenue}
        min={-50}
        max={100}
        display={percent(revenue, 0)}
      />
      <SubmitButton disabled={disabled} />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Kartu hasil                                                         */
/* ------------------------------------------------------------------ */

function ScoreRing({ score, size = 56 }: { score: number; size?: number }) {
  const color = score >= 65 ? '#059669' : score >= 45 ? '#D97706' : '#E11D48';
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-slate-800">
        {Math.round(score)}
      </span>
    </div>
  );
}

function MetricTile({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | 'neutral' }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-rose-700' : 'text-slate-900';
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

function ScenarioCard({ scenario, isTop }: { scenario: DecisionScenarioResult; isTop: boolean }) {
  const risk = RISK_STYLE[scenario.riskLevel];
  const v = verdict(scenario);
  const detailEntries = Object.entries(scenario.metrics.detail).slice(0, 6);

  return (
    <article
      className={`rounded-xl border bg-white p-4 shadow-xs transition-shadow hover:shadow-sm ${
        isTop ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">
              #{scenario.rank}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${risk.bg} ${risk.border} ${risk.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${risk.dot}`} />
              {risk.label}
            </span>
            {isTop && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <BadgeCheck className="h-3 w-3" /> Rekomendasi utama
              </span>
            )}
          </div>
          <h4 className="truncate text-sm font-bold text-slate-900">{scenario.title}</h4>
          <p className="mt-0.5 text-[11px] text-slate-500">
            Keamanan risiko {scenario.riskScore}/100 · Strategic fit {scenario.strategicFit.score}/100
          </p>
        </div>
        <ScoreRing score={scenario.score} />
      </div>

      <div className={`mt-3 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${v.tone}`}>{v.label}</div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MetricTile
          label="Dampak laba / bulan"
          value={signedRupiah(scenario.metrics.monthlyNetProfitImpact)}
          tone={scenario.metrics.monthlyNetProfitImpact >= 0 ? 'good' : 'bad'}
        />
        <MetricTile
          label="Arus kas bulan 1"
          value={signedRupiah(scenario.metrics.firstMonthCashFlowImpact)}
          tone={scenario.metrics.firstMonthCashFlowImpact >= 0 ? 'good' : 'bad'}
        />
        <MetricTile label="Belanja di muka" value={rupiah(scenario.metrics.upfrontCashOutflow, true)} />
        <MetricTile
          label="Payback"
          value={scenario.metrics.paybackMonths === null ? 'Tidak tercapai' : `${scenario.metrics.paybackMonths} bulan`}
          tone={scenario.metrics.paybackMonths === null ? 'bad' : 'neutral'}
        />
        <MetricTile
          label="Margin kotor baru"
          value={percent(scenario.metrics.newGrossMarginPercent)}
          tone={scenario.metrics.marginChangePoints >= 0 ? 'good' : 'bad'}
        />
        <MetricTile
          label="Runway setelah skenario"
          value={scenario.metrics.projectedRunwayMonths === null ? 'Tidak terbatas' : `${scenario.metrics.projectedRunwayMonths} bulan`}
          tone={
            scenario.metrics.projectedRunwayMonths !== null && scenario.metrics.projectedRunwayMonths < 6 ? 'bad' : 'neutral'
          }
        />
      </div>

      {detailEntries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {detailEntries.map(([key, value]) => (
            <span
              key={key}
              className="rounded-md bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"
              title={key}
            >
              {key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}: {value === null ? '—' : value.toLocaleString('id-ID')}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-1">
        {scenario.riskReasons.slice(0, 3).map((reason, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
            <span>{reason}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function ResultsPanel({ result }: { result: DecisionSimulationResult }) {
  const top = result.scenarioResults[0];
  const [detailId, setDetailId] = useState<string | null>(null);
  const active = result.scenarioResults.find((s) => s.id === detailId) ?? top;

  return (
    <div className="space-y-4">
      {/* Ringkasan + indikator sukses */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Analisis berhasil
            </div>
            <h3 className="text-base font-bold text-slate-900">{result.scenarioTitle}</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600">{result.summary}</p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Risiko keseluruhan</div>
            <span
              className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${
                RISK_STYLE[result.overallRiskLevel].bg
              } ${RISK_STYLE[result.overallRiskLevel].border} ${RISK_STYLE[result.overallRiskLevel].text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${RISK_STYLE[result.overallRiskLevel].dot}`} />
              {RISK_STYLE[result.overallRiskLevel].label}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricTile label="Pendapatan / bulan" value={rupiah(result.baseline.monthlyRevenue, true)} />
          <MetricTile label="Laba bersih / bulan" value={rupiah(result.baseline.monthlyNetProfit, true)} />
          <MetricTile label="Kas likuid" value={rupiah(result.baseline.liquidCash, true)} />
          <MetricTile
            label="Runway saat ini"
            value={result.baseline.runwayMonths === null ? 'Tidak terbatas' : `${result.baseline.runwayMonths} bulan`}
          />
        </div>
      </section>

      {/* Daftar skenario berperingkat */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Peringkat Skenario</h3>
          <span className="text-[11px] text-slate-500">
            Horizon {result.horizonMonths} bulan · {result.comparison.totalScenarios} skenario
          </span>
        </div>
        {result.scenarioResults.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            onClick={() => setDetailId(scenario.id)}
            className="block w-full text-left"
          >
            <ScenarioCard scenario={scenario} isTop={scenario.rank === 1} />
          </button>
        ))}
      </section>

      {/* Rekomendasi */}
      {result.recommendations.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <Sparkles className="h-4 w-4 text-amber-500" /> Rekomendasi
          </h3>
          <div className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <div key={`${rec.scenarioId}-${i}`} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      rec.priority === 'HIGH'
                        ? 'bg-rose-100 text-rose-700'
                        : rec.priority === 'MEDIUM'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {rec.priority}
                  </span>
                  <span className="text-xs font-semibold text-slate-900">{rec.title}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-600">{rec.reason}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  Estimasi implementasi {rec.implementationMonths} bulan · skenario #{active?.rank ?? 1}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Detail skenario terpilih */}
      {active && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-900">
            <BarChart3 className="h-4 w-4 text-slate-500" /> Detail: {active.title}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {active.strategicFit.factors.map((f) => (
              <div key={f.factor} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span>{f.label}</span>
                  <span>{f.score}/100</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${f.score}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1">
            {active.strategicFit.recommendations.map((rec, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-600">
                <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Komponen utama                                                      */
/* ------------------------------------------------------------------ */

type TabId = DecisionScenarioType;

const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'employee_hiring', label: 'Rekrutmen', icon: Users },
  { id: 'asset_purchase', label: 'Beli Aset', icon: Building2 },
  { id: 'pricing_change', label: 'Ubah Harga', icon: DollarSign },
  { id: 'cost_change', label: 'Efisiensi Biaya', icon: TrendingDown },
  { id: 'custom', label: 'Bebas', icon: Calculator },
];

export default function FinancialDecisionSimulator() {
  const [activeTab, setActiveTab] = useState<TabId>('employee_hiring');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DecisionSimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (
    scenarioType: DecisionScenarioType,
    adjustments: DecisionSimulationAdjustments,
    scenarioTitle: string
  ) => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/brain/financial-simulator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          scenarioTitle,
          promptDescription: scenarioTitle,
          adjustments: { ...adjustments, scenarioType },
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.success) {
        if (res.status === 401) {
          setError('Sesi Anda tidak valid atau sudah berakhir. Silakan login ulang.');
        } else if (res.status === 403) {
          setError(json?.message || 'Role Anda tidak memiliki akses ke simulasi keputusan finansial.');
        } else {
          setError(json?.message || json?.error || `Analisis gagal (HTTP ${res.status}). Coba lagi.`);
        }
        return;
      }

      setResult(json.data as DecisionSimulationResult);
    } catch (err) {
      console.error('[FinancialDecisionSimulator] request failed', err);
      setError('Tidak dapat menghubungi server. Periksa koneksi lalu coba lagi.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const activeForm = useMemo(() => {
    const props: FormProps = { disabled: isAnalyzing, onSubmit: handleAnalyze };
    switch (activeTab) {
      case 'asset_purchase':
        return <AssetForm {...props} />;
      case 'pricing_change':
        return <PricingForm {...props} />;
      case 'cost_change':
        return <CostForm {...props} />;
      case 'custom':
        return <CustomForm {...props} />;
      default:
        return <HiringForm {...props} />;
    }
  }, [activeTab, isAnalyzing]);

  return (
    <div className="w-full space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Wallet className="h-5 w-5 text-emerald-600" />
            Simulator Keputusan Finansial
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
            Bandingkan skenario rekrutmen, pembelian aset, perubahan harga, dan efisiensi biaya terhadap laba, arus kas,
            serta runway perusahaan Anda.
          </p>
        </div>
        {result && (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Analisis baru
          </button>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Panel input */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      isActive
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {activeForm}

            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-[11px] leading-snug text-rose-700">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-snug text-slate-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              Perhitungan memakai data keuangan workspace Anda saat ini. Hasil adalah estimasi, bukan jaminan.
            </p>
          </div>
        </section>

        {/* Panel hasil */}
        <section className="lg:col-span-3">
          {result ? (
            <ResultsPanel result={result} />
          ) : (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              {isAnalyzing ? (
                <>
                  <Loader2 className="mb-3 h-8 w-8 animate-spin text-emerald-600" />
                  <p className="text-sm font-semibold text-slate-700">Menghitung skenario...</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Membandingkan dampak laba, arus kas, dan risiko tiap opsi.
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                    <TrendingUp className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700">Belum ada analisis</p>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                    Isi parameter di sebelah kiri lalu tekan <span className="font-semibold">Analisis Skenario</span>.
                    Anda akan mendapat peringkat opsi, skor kelayakan, level risiko, dan rekomendasi.
                  </p>
                  <div className="mt-4 grid w-full max-w-sm grid-cols-2 gap-2 text-left">
                    {[
                      ['Skor kelayakan', '0-100 per skenario'],
                      ['Level risiko', 'Rendah → Kritis'],
                      ['Dampak laba', 'Per bulan'],
                      ['Payback & runway', 'Kembali modal'],
                    ].map(([title, sub]) => (
                      <div key={title} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <div className="text-[11px] font-semibold text-slate-700">{title}</div>
                        <div className="text-[10px] text-slate-500">{sub}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
