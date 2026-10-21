'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileSpreadsheet, Loader2, Printer, RefreshCw } from 'lucide-react';
import { apiGet, formatMoney, formatPercent, periodLabel } from './client';

/* ── Hook fetch sederhana dengan reload ───────────────────────────────── */

export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    setLoading(true);
    setError(null);
    apiGet<{ success: boolean; data: T }>(url)
      .then((res) => {
        if (alive) setData(res.data);
      })
      .catch((err) => {
        if (alive) setError(err?.message || 'Gagal memuat data.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload };
}

/* ── Komponen tampilan bersama ────────────────────────────────────────── */

export function ReportToolbar({
  period,
  onPeriodChange,
  comparative,
  onComparativeChange,
  onRefresh,
  loading,
  exportUrl,
}: {
  period: string;
  onPeriodChange: (value: string) => void;
  comparative: string;
  onComparativeChange: (value: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  exportUrl?: string;
}) {
  const [month, year] = period.split('-').map(Number);
  const years = [year - 1, year, year + 1];

  return (
    <div className="klir-no-print flex flex-wrap items-center gap-2 pb-4">
      <select
        value={month}
        onChange={(e) => onPeriodChange(`${year}-${String(Number(e.target.value)).padStart(2, '0')}`)}
        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {periodLabel(`${year}-${String(m).padStart(2, '0')}`).split(' ')[0]}
          </option>
        ))}
      </select>

      <select
        value={year}
        onChange={(e) => onPeriodChange(`${Number(e.target.value)}-${String(month).padStart(2, '0')}`)}
        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      <select
        value={comparative}
        onChange={(e) => onComparativeChange(e.target.value)}
        className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700"
      >
        <option value="none">Tanpa pembanding</option>
        <option value="prev_month">Banding: bulan lalu</option>
        <option value="prev_year">Banding: tahun lalu</option>
        <option value="ytd">Banding: YTD</option>
      </select>

      <button
        onClick={onRefresh}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Muat ulang
      </button>

      {exportUrl && (
        <a
          href={exportUrl}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Ekspor Excel
        </a>
      )}

      <button
        onClick={() => window.print()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        <Printer className="h-3.5 w-3.5" />
        Cetak / PDF
      </button>
    </div>
  );
}

export function ReportShell({
  title,
  subtitle,
  children,
  loading,
  error,
  warnings,
  onRetry,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  error?: string | null;
  warnings?: string[];
  onRetry?: () => void;
}) {
  return (
    <div className="klir-print-area rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="klir-print-header mb-2">
          <p className="text-sm font-bold text-slate-900">KLIR OS — {title}</p>
          {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
        </div>
        <h3 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500">{subtitle}</p>}
      </div>

      {warnings && warnings.length > 0 && (
        <div className="klir-no-print border-b border-amber-100 bg-amber-50 px-4 py-2.5">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-[11px] font-medium text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {w}
            </p>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Menghitung laporan…
        </div>
      )}

      {!loading && error && (
        <div className="px-4 py-10 text-center">
          <p className="text-sm font-medium text-red-600">{error}</p>
          {onRetry && (
            <button onClick={onRetry} className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
              Coba lagi
            </button>
          )}
        </div>
      )}

      {!loading && !error && <div className="p-1 sm:p-2">{children}</div>}
    </div>
  );
}

function Row({
  label,
  code,
  value,
  bold,
  indent,
  negative,
  compare,
}: {
  label: string;
  code?: string;
  value: string | number | null;
  bold?: boolean;
  indent?: boolean;
  negative?: boolean;
  compare?: string | number | null;
}) {
  return (
    <tr className={`border-b border-slate-50 ${bold ? 'bg-slate-50/70' : ''}`}>
      <td className={`py-1.5 pr-2 text-xs ${indent ? 'pl-6' : 'pl-3'} ${bold ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
        {code && <span className="mr-2 font-mono text-[10px] text-slate-400">{code}</span>}
        {label}
      </td>
      <td className={`py-1.5 pr-3 text-right text-xs tabular-nums ${bold ? 'font-semibold text-slate-900' : 'text-slate-700'} ${negative ? 'text-red-600' : ''}`}>
        {formatMoney(value)}
      </td>
      {compare !== undefined && (
        <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-slate-500">{formatMoney(compare)}</td>
      )}
    </tr>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-200">
      <td colSpan={3} className="pb-1 pl-3 pt-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        {children}
      </td>
    </tr>
  );
}

/* ── Ringkasan ─────────────────────────────────────────────────────────── */

interface SummaryData {
  cashPosition: string;
  income: { revenue: string; grossProfit: string; operatingProfit: string; netIncome: string; operatingExpenses: string };
  balance: { assets: string; liabilities: string; equity: string; difference: string };
  ratios: Record<string, string | null>;
  draftCount: number;
  warnings: string[];
  latestPeriod: { year: number; month: number; status: string } | null;
}

export function SummaryView({ period, onPeriodChange, comparative, onComparativeChange }: { period: string; onPeriodChange: (v: string) => void; comparative: string; onComparativeChange: (v: string) => void }) {
  const { data, loading, error, reload } = useApi<SummaryData>(`/api/v1/accounting/reports/summary?period=${period}`);

  return (
    <div className="space-y-4">
      <ReportToolbar
        period={period}
        onPeriodChange={onPeriodChange}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
      />

      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Saldo Kas & Bank" value={formatMoney(data.cashPosition)} tone="emerald" />
          <KpiCard label="Pendapatan Periode" value={formatMoney(data.income.revenue)} tone="slate" />
          <KpiCard label="Laba Bersih" value={formatMoney(data.income.netIncome)} tone={Number(data.income.netIncome) >= 0 ? 'emerald' : 'red'} />
          <KpiCard label="Total Aset" value={formatMoney(data.balance.assets)} tone="slate" />
        </div>
      )}

      <ReportShell title="Ringkasan & Rasio" subtitle={`Periode ${periodLabel(period)}`} loading={loading} error={error} warnings={data?.warnings} onRetry={reload}>
        {data && (
          <div className="grid grid-cols-1 gap-4 p-3 md:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Kinerja</h4>
              <dl className="space-y-1.5 text-xs">
                <RowKV label="Pendapatan" value={formatMoney(data.income.revenue)} />
                <RowKV label="Laba Kotor" value={formatMoney(data.income.grossProfit)} />
                <RowKV label="Beban Operasional" value={formatMoney(data.income.operatingExpenses)} />
                <RowKV label="Laba Operasional" value={formatMoney(data.income.operatingProfit)} />
                <RowKV label="Laba Bersih" value={formatMoney(data.income.netIncome)} bold />
              </dl>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Rasio</h4>
              <dl className="space-y-1.5 text-xs">
                <RowKV label="Margin Laba Kotor" value={formatPercent(data.ratios.grossMarginPct)} />
                <RowKV label="Margin Laba Bersih" value={formatPercent(data.ratios.netMarginPct)} />
                <RowKV label="Beban Operasional / Pendapatan" value={formatPercent(data.ratios.opexToRevenuePct)} />
                <RowKV label="Rasio Lancar" value={data.ratios.currentRatio ? `${data.ratios.currentRatio}x` : '-'} />
                <RowKV label="Rata-rata Hari Piutang" value={data.ratios.receivableDays ? `${data.ratios.receivableDays} hari` : '-'} />
                <RowKV label="Rata-rata Hari Utang" value={data.ratios.payableDays ? `${data.ratios.payableDays} hari` : '-'} />
                <RowKV label="Runway Kas" value={data.ratios.cashRunwayMonths ? `${data.ratios.cashRunwayMonths} bulan` : '-'} />
              </dl>
            </div>
          </div>
        )}
      </ReportShell>
    </div>
  );
}

function RowKV({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 py-1">
      <dt className={bold ? 'font-semibold text-slate-900' : 'text-slate-600'}>{label}</dt>
      <dd className={`tabular-nums ${bold ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{value}</dd>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'red' | 'slate' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}

/* ── Laba Rugi ─────────────────────────────────────────────────────────── */

interface ReportLineDto {
  accountId: string;
  code: string;
  name: string;
  amount: string;
}

interface IncomeData {
  current: {
    revenue: ReportLineDto[];
    cogs: ReportLineDto[];
    operatingExpenses: ReportLineDto[];
    taxExpenses: ReportLineDto[];
    totals: Record<string, string>;
  };
  comparison: { totals: Record<string, string> } | null;
}

export function IncomeStatementView({ period, comparative, onComparativeChange }: { period: string; comparative: string; onComparativeChange: (v: string) => void }) {
  const { data, loading, error, reload } = useApi<IncomeData>(
    `/api/v1/accounting/reports/income-statement?period=${period}&comparative=${comparative}`
  );
  const cur = data?.current;
  const cmp = data?.comparison?.totals;

  return (
    <div>
      <ReportToolbar
        period={period}
        onPeriodChange={() => undefined}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
        exportUrl={`/api/v1/accounting/reports/export?period=${period}`}
      />
      <ReportShell title="Laporan Laba Rugi" subtitle={`Periode ${periodLabel(period)}`} loading={loading} error={error} onRetry={reload}>
        {cur && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pl-3 pb-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">Akun</th>
                <th className="pr-3 pb-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">Jumlah</th>
                {cmp && <th className="pr-3 pb-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500">Pembanding</th>}
              </tr>
            </thead>
            <tbody>
              <SectionTitle>Pendapatan</SectionTitle>
              {cur.revenue.map((r) => (
                <Row key={r.accountId} code={r.code} label={r.name} value={r.amount} indent />
              ))}
              <Row label="Total Pendapatan" value={cur.totals.revenue} bold compare={cmp?.revenue} />

              {cur.cogs.length > 0 && (
                <>
                  <SectionTitle>Harga Pokok Penjualan</SectionTitle>
                  {cur.cogs.map((r) => (
                    <Row key={r.accountId} code={r.code} label={r.name} value={r.amount} indent />
                  ))}
                  <Row label="Laba Kotor" value={cur.totals.grossProfit} bold compare={cmp?.grossProfit} />
                </>
              )}

              <SectionTitle>Beban Operasional</SectionTitle>
              {cur.operatingExpenses.map((r) => (
                <Row key={r.accountId} code={r.code} label={r.name} value={r.amount} indent negative />
              ))}
              <Row label="Total Beban Operasional" value={cur.totals.operatingExpenses} bold compare={cmp?.operatingExpenses} negative />
              <Row label="Laba Operasional" value={cur.totals.operatingProfit} bold compare={cmp?.operatingProfit} />

              {cur.taxExpenses.length > 0 && (
                <>
                  <SectionTitle>Pajak</SectionTitle>
                  {cur.taxExpenses.map((r) => (
                    <Row key={r.accountId} code={r.code} label={r.name} value={r.amount} indent negative />
                  ))}
                </>
              )}

              <tr className="border-t-2 border-slate-300">
                <td className="py-2 pl-3 text-sm font-bold text-slate-900">LABA BERSIH</td>
                <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(cur.totals.netIncome)}</td>
                {cmp && <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-500">{formatMoney(cmp.netIncome)}</td>}
              </tr>
            </tbody>
          </table>
        )}
      </ReportShell>
    </div>
  );
}

/* ── Neraca ────────────────────────────────────────────────────────────── */

interface BalanceData {
  current: {
    assets: ReportLineDto[];
    liabilities: ReportLineDto[];
    equityAccounts: ReportLineDto[];
    totals: Record<string, string>;
    warnings: string[];
  };
}

export function BalanceSheetView({ period, comparative, onComparativeChange }: { period: string; comparative: string; onComparativeChange: (v: string) => void }) {
  const { data, loading, error, reload } = useApi<BalanceData>(
    `/api/v1/accounting/reports/balance-sheet?period=${period}&comparative=${comparative}`
  );
  const cur = data?.current;

  return (
    <div>
      <ReportToolbar
        period={period}
        onPeriodChange={() => undefined}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
        exportUrl={`/api/v1/accounting/reports/export?period=${period}`}
      />
      <ReportShell title="Neraca" subtitle={`Per akhir ${periodLabel(period)}`} loading={loading} error={error} warnings={cur?.warnings} onRetry={reload}>
        {cur && (
          <table className="w-full border-collapse">
            <tbody>
              <SectionTitle>Aset</SectionTitle>
              {cur.assets.map((r) => (
                <Row key={r.accountId} code={r.code} label={r.name} value={r.amount} indent />
              ))}
              <Row label="Total Aset" value={cur.totals.assets} bold />

              <SectionTitle>Liabilitas</SectionTitle>
              {cur.liabilities.map((r) => (
                <Row key={r.accountId} code={r.code} label={r.name} value={r.amount} indent />
              ))}
              <Row label="Total Liabilitas" value={cur.totals.liabilities} bold />

              <SectionTitle>Ekuitas</SectionTitle>
              {cur.equityAccounts.map((r) => (
                <Row key={r.accountId} code={r.code} label={r.name} value={r.amount} indent />
              ))}
              <Row label="Laba Tahun Berjalan" value={cur.totals.currentYearProfit} indent />
              <Row label="Total Ekuitas" value={cur.totals.equity} bold />

              <tr className="border-t-2 border-slate-300">
                <td className="py-2 pl-3 text-sm font-bold text-slate-900">Total Liabilitas + Ekuitas</td>
                <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">
                  {formatMoney(cur.totals.liabilitiesAndEquity)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </ReportShell>
    </div>
  );
}

/* ── Arus Kas ──────────────────────────────────────────────────────────── */

interface CashFlowData {
  current: {
    openingCash: string;
    items: Array<{ section: string; code: string; name: string; amount: string }>;
    totals: Record<string, string>;
    warnings: string[];
  };
}

export function CashFlowView({ period, comparative, onComparativeChange }: { period: string; comparative: string; onComparativeChange: (v: string) => void }) {
  const { data, loading, error, reload } = useApi<CashFlowData>(`/api/v1/accounting/reports/cash-flow?period=${period}`);
  const cur = data?.current;

  const groups: Array<{ key: string; label: string }> = [
    { key: 'OPERATING', label: 'Arus Kas dari Aktivitas Operasional' },
    { key: 'INVESTING', label: 'Arus Kas dari Aktivitas Investasi' },
    { key: 'FINANCING', label: 'Arus Kas dari Aktivitas Pendanaan' },
  ];

  return (
    <div>
      <ReportToolbar
        period={period}
        onPeriodChange={() => undefined}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
        exportUrl={`/api/v1/accounting/reports/export?period=${period}`}
      />
      <ReportShell title="Laporan Arus Kas" subtitle={`Metode langsung — ${periodLabel(period)}`} loading={loading} error={error} warnings={cur?.warnings} onRetry={reload}>
        {cur && (
          <table className="w-full border-collapse">
            <tbody>
              <Row label="Kas Awal Periode" value={cur.openingCash} bold />
              {groups.map((g) => {
                const items = cur.items.filter((i) => i.section === g.key);
                if (items.length === 0) return null;
                return (
                  <React.Fragment key={g.key}>
                    <SectionTitle>{g.label}</SectionTitle>
                    {items.map((i) => (
                      <Row key={`${g.key}-${i.code}`} code={i.code} label={i.name} value={i.amount} indent negative={Number(i.amount) < 0} />
                    ))}
                    <Row
                      label={`Total ${g.label.replace('Arus Kas dari Aktivitas ', '')}`}
                      value={cur.totals[g.key.toLowerCase()]}
                      bold
                    />
                  </React.Fragment>
                );
              })}
              <tr className="border-t-2 border-slate-300">
                <td className="py-2 pl-3 text-sm font-bold text-slate-900">Kas Akhir Periode</td>
                <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(cur.totals.closingCash)}</td>
              </tr>
              <Row label="Saldo rekening (pemeriksaan)" value={cur.totals.actualCashBalance} indent />
            </tbody>
          </table>
        )}
      </ReportShell>
    </div>
  );
}

/* ── Perubahan Ekuitas ─────────────────────────────────────────────────── */

interface EquityData {
  current: {
    openingEquity: string;
    netIncome: string;
    contributions: Array<{ code: string; name: string; amount: string }>;
    withdrawals: Array<{ code: string; name: string; amount: string }>;
    totals: Record<string, string>;
  };
}

export function EquityView({ period, comparative, onComparativeChange }: { period: string; comparative: string; onComparativeChange: (v: string) => void }) {
  const { data, loading, error, reload } = useApi<EquityData>(
    `/api/v1/accounting/reports/equity?period=${period}&comparative=${comparative}`
  );
  const cur = data?.current;

  return (
    <div>
      <ReportToolbar
        period={period}
        onPeriodChange={() => undefined}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
        exportUrl={`/api/v1/accounting/reports/export?period=${period}`}
      />
      <ReportShell title="Laporan Perubahan Ekuitas" subtitle={`Periode ${periodLabel(period)}`} loading={loading} error={error} onRetry={reload}>
        {cur && (
          <table className="w-full border-collapse">
            <tbody>
              <Row label="Ekuitas Awal Periode" value={cur.openingEquity} bold />
              <Row label="Laba Bersih Periode" value={cur.netIncome} indent />
              {cur.contributions.map((c) => (
                <Row key={`c-${c.code}`} code={c.code} label={`Setoran Modal — ${c.name}`} value={c.amount} indent />
              ))}
              {cur.withdrawals.map((w) => (
                <Row key={`w-${w.code}`} code={w.code} label={`Prive / Dividen — ${w.name}`} value={w.amount} indent negative />
              ))}
              <tr className="border-t-2 border-slate-300">
                <td className="py-2 pl-3 text-sm font-bold text-slate-900">Ekuitas Akhir Periode</td>
                <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(cur.totals.closingEquity)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </ReportShell>
    </div>
  );
}

/* ── Neraca Saldo ──────────────────────────────────────────────────────── */

interface TrialData {
  current: {
    rows: Array<{ accountId: string; code: string; name: string; debitSide: string; creditSide: string }>;
    totals: { debit: string; credit: string; difference: string };
  };
}

export function TrialBalanceView({ period, comparative, onComparativeChange }: { period: string; comparative: string; onComparativeChange: (v: string) => void }) {
  const { data, loading, error, reload } = useApi<TrialData>(`/api/v1/accounting/reports/trial-balance?period=${period}`);
  const cur = data?.current;

  return (
    <div>
      <ReportToolbar
        period={period}
        onPeriodChange={() => undefined}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
        exportUrl={`/api/v1/accounting/reports/export?period=${period}`}
      />
      <ReportShell title="Neraca Saldo" subtitle={`Periode ${periodLabel(period)}`} loading={loading} error={error} onRetry={reload}>
        {cur && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pl-3 pb-1.5 text-left text-[10px] font-semibold uppercase text-slate-500">Akun</th>
                <th className="pr-3 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Debit</th>
                <th className="pr-3 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Kredit</th>
              </tr>
            </thead>
            <tbody>
              {cur.rows.map((r) => (
                <tr key={r.accountId} className="border-b border-slate-50">
                  <td className="py-1.5 pl-3 text-xs text-slate-700">
                    <span className="mr-2 font-mono text-[10px] text-slate-400">{r.code}</span>
                    {r.name}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-slate-700">
                    {Number(r.debitSide) !== 0 ? formatMoney(r.debitSide) : '-'}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-slate-700">
                    {Number(r.creditSide) !== 0 ? formatMoney(r.creditSide) : '-'}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300">
                <td className="py-2 pl-3 text-sm font-bold text-slate-900">TOTAL</td>
                <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(cur.totals.debit)}</td>
                <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(cur.totals.credit)}</td>
              </tr>
            </tbody>
          </table>
        )}
      </ReportShell>
    </div>
  );
}

/* ── Umur Piutang / Utang (aging) ──────────────────────────────────────── */

interface AgingData {
  current: {
    type: 'AR' | 'AP';
    asOf: string;
    rows: Array<{
      id: string;
      reference: string;
      partner: string;
      dueDate: string;
      daysOverdue: number;
      amount: string;
      bucket: string;
    }>;
    buckets: Array<{ key: string; label: string; amount: string; count: number }>;
    byPartner: Array<{
      partnerId: string | null;
      partner: string;
      total: string;
      count: number;
      maxDaysOverdue: number;
      share: number;
      buckets: Record<string, string>;
    }>;
    total: string;
    ledgerBalance: string;
    difference: string;
    warnings: string[];
  };
}

export function AgingView({ comparative: _comparative, onComparativeChange: _onComparativeChange }: { period: string; comparative: string; onComparativeChange: (v: string) => void }) {
  const [type, setType] = useState<'AR' | 'AP'>('AR');
  const today = new Date().toISOString().slice(0, 10);
  const [asOf, setAsOf] = useState(today);
  const { data, loading, error, reload } = useApi<AgingData>(
    `/api/v1/accounting/reports/aging?type=${type}&asOf=${asOf}`
  );
  const cur = data?.current;

  return (
    <div className="space-y-4">
      <div className="klir-no-print flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
          {(['AR', 'AP'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-2 text-xs font-semibold ${
                type === t ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t === 'AR' ? 'Piutang (AR)' : 'Utang (AP)'}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
          Per tanggal
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
          />
        </label>
        <button
          onClick={reload}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Muat ulang
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5" />
          Cetak / PDF
        </button>
      </div>

      {cur && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard label="Total dokumen terbuka" value={formatMoney(cur.total)} tone="slate" />
          <KpiCard label="Saldo buku besar" value={formatMoney(cur.ledgerBalance)} tone="slate" />
          <KpiCard
            label="Selisih"
            value={formatMoney(cur.difference)}
            tone={Number(cur.difference) === 0 ? 'emerald' : 'red'}
          />
        </div>
      )}

      <ReportShell
        title={type === 'AR' ? 'Umur Piutang' : 'Umur Utang'}
        subtitle={`Per tanggal ${asOf}`}
        loading={loading}
        error={error}
        warnings={cur?.warnings}
        onRetry={reload}
      >
        {cur && (
          <>
            <div className="grid grid-cols-2 gap-2 border-b border-slate-100 p-3 sm:grid-cols-5">
              {cur.buckets.map((b) => (
                <div key={b.key} className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{b.label}</p>
                  <p className="mt-0.5 text-sm font-bold tabular-nums text-slate-900">{formatMoney(b.amount)}</p>
                  <p className="text-[10px] text-slate-500">{b.count} dokumen</p>
                </div>
              ))}
            </div>

            {cur.byPartner.length > 0 && (
              <div className="border-b border-slate-100">
                <p className="px-3 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Ringkasan per {type === 'AR' ? 'Pelanggan' : 'Vendor'}
                </p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="pl-3 pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">
                        {type === 'AR' ? 'Pelanggan' : 'Vendor'}
                      </th>
                      <th className="pb-1.5 pt-2 text-right text-[10px] font-semibold uppercase text-slate-500">Dokumen</th>
                      <th className="pb-1.5 pt-2 text-right text-[10px] font-semibold uppercase text-slate-500">Terlama</th>
                      <th className="pr-3 pb-1.5 pt-2 text-right text-[10px] font-semibold uppercase text-slate-500">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cur.byPartner.map((p) => (
                      <tr key={p.partnerId ?? p.partner} className="border-b border-slate-50">
                        <td className="py-1.5 pl-3 text-xs font-medium text-slate-800">{p.partner}</td>
                        <td className="py-1.5 text-right text-xs tabular-nums text-slate-600">{p.count}</td>
                        <td className={`py-1.5 text-right text-xs tabular-nums ${p.maxDaysOverdue > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                          {p.maxDaysOverdue > 0 ? `${p.maxDaysOverdue} hari` : '-'}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-xs font-medium tabular-nums text-slate-900">{formatMoney(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pl-3 pb-1.5 text-left text-[10px] font-semibold uppercase text-slate-500">Dokumen</th>
                  <th className="pb-1.5 text-left text-[10px] font-semibold uppercase text-slate-500">
                    {type === 'AR' ? 'Pelanggan' : 'Kewajiban'}
                  </th>
                  <th className="pb-1.5 text-left text-[10px] font-semibold uppercase text-slate-500">Jatuh tempo</th>
                  <th className="pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Terlambat</th>
                  <th className="pr-3 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {cur.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-xs text-slate-500">
                      Tidak ada {type === 'AR' ? 'piutang' : 'utang'} terbuka pada tanggal ini.
                    </td>
                  </tr>
                )}
                {cur.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50">
                    <td className="py-1.5 pl-3 text-xs font-medium text-slate-800">{r.reference}</td>
                    <td className="py-1.5 text-xs text-slate-600">{r.partner}</td>
                    <td className="py-1.5 text-xs text-slate-600">
                      {new Date(r.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className={`py-1.5 text-right text-xs tabular-nums ${r.daysOverdue > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                      {r.daysOverdue > 0 ? `${r.daysOverdue} hari` : '-'}
                    </td>
                    <td className="py-1.5 pr-3 text-right text-xs font-medium tabular-nums text-slate-900">{formatMoney(r.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-300">
                  <td colSpan={4} className="py-2 pl-3 text-sm font-bold text-slate-900">TOTAL</td>
                  <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(cur.total)}</td>
                </tr>
              </tbody>
            </table>
          </>
        )}
      </ReportShell>
    </div>
  );
}

/* ── Ringkasan PPN ─────────────────────────────────────────────────────── */

interface TaxData {
  current: {
    isPkp: boolean;
    outputTax: string;
    inputTax: string;
    netPayable: string;
    withholding: Array<{ code: string; name: string; amount: string }>;
    warnings: string[];
  };
}

export function TaxView({ period, comparative, onComparativeChange }: { period: string; comparative: string; onComparativeChange: (v: string) => void }) {
  const { data, loading, error, reload } = useApi<TaxData>(`/api/v1/accounting/reports/tax?period=${period}`);
  const cur = data?.current;

  return (
    <div className="space-y-4">
      <ReportToolbar
        period={period}
        onPeriodChange={() => undefined}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
      />

      {cur && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <KpiCard label="PPN Keluaran" value={formatMoney(cur.outputTax)} tone="slate" />
          <KpiCard label="PPN Masukan" value={formatMoney(cur.inputTax)} tone="slate" />
          <KpiCard
            label={Number(cur.netPayable) >= 0 ? 'Kurang bayar' : 'Lebih bayar'}
            value={formatMoney(cur.netPayable)}
            tone={Number(cur.netPayable) > 0 ? 'red' : 'emerald'}
          />
        </div>
      )}

      <ReportShell
        title="Ringkasan PPN"
        subtitle={`Periode ${periodLabel(period)}`}
        loading={loading}
        error={error}
        warnings={cur?.warnings}
        onRetry={reload}
      >
        {cur && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pl-3 pb-1.5 text-left text-[10px] font-semibold uppercase text-slate-500">Komponen</th>
                <th className="pr-3 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Jumlah</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-50">
                <td className="py-1.5 pl-3 text-xs text-slate-700">
                  <span className="mr-2 font-mono text-[10px] text-slate-400">2-1310</span>
                  PPN Keluaran (dipungut dari pembeli)
                </td>
                <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-slate-800">{formatMoney(cur.outputTax)}</td>
              </tr>
              <tr className="border-b border-slate-50">
                <td className="py-1.5 pl-3 text-xs text-slate-700">
                  <span className="mr-2 font-mono text-[10px] text-slate-400">1-1600</span>
                  PPN Masukan (dibayar ke pemasok)
                </td>
                <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-slate-800">{formatMoney(cur.inputTax)}</td>
              </tr>
              <tr className="border-t-2 border-slate-300">
                <td className="py-2 pl-3 text-sm font-bold text-slate-900">
                  {Number(cur.netPayable) >= 0 ? 'PPN kurang bayar' : 'PPN lebih bayar'}
                </td>
                <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(cur.netPayable)}</td>
              </tr>
              {cur.withholding.some((w) => Number(w.amount) !== 0) && (
                <>
                  <tr>
                    <td colSpan={2} className="pb-1 pl-3 pt-4 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      Pajak dipotong (PPh)
                    </td>
                  </tr>
                  {cur.withholding
                    .filter((w) => Number(w.amount) !== 0)
                    .map((w) => (
                      <tr key={w.code} className="border-b border-slate-50">
                        <td className="py-1.5 pl-3 text-xs text-slate-700">
                          <span className="mr-2 font-mono text-[10px] text-slate-400">{w.code}</span>
                          {w.name}
                        </td>
                        <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-slate-800">{formatMoney(w.amount)}</td>
                      </tr>
                    ))}
                </>
              )}
            </tbody>
          </table>
        )}
      </ReportShell>

      {cur && !cur.isPkp && (
        <p className="klir-no-print text-[11px] text-slate-500">
          Profil pajak workspace saat ini non-PKP, sehingga akun PPN seharusnya tidak dipakai. Ubah profil di Pengaturan bila status PKP sudah berubah.
        </p>
      )}
    </div>
  );
}
