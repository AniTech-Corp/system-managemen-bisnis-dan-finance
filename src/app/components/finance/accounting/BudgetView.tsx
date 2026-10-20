'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2, Wallet } from 'lucide-react';
import { apiSend, formatMoney, formatPercent, MONTH_LABELS } from './client';
import { ReportShell, ReportToolbar, useApi } from './ReportViews';

/**
 * Anggaran tahunan + realisasi.
 *
 * Input 12 kolom mengikuti tahun buku (bukan selalu Januari–Desember): kolom
 * pertama = bulan pertama tahun buku dari Pengaturan. Realisasi diambil dari
 * laporan Laba Rugi lewat `/reports/budget`, jadi angkanya selalu sama dengan
 * laporan resmi.
 */

interface BudgetAccountOption {
  id: string;
  code: string;
  name: string;
  type: 'REVENUE' | 'EXPENSE';
}

interface BudgetItemDto {
  accountId: string;
  code: string;
  name: string;
  type: 'REVENUE' | 'EXPENSE';
  monthly: string[];
  total: string;
  note: string | null;
}

interface BudgetListDto {
  fiscalYear: number;
  fiscalStartMonth: number;
  accounts: BudgetAccountOption[];
  items: BudgetItemDto[];
}

interface BudgetReportDto {
  current: {
    fiscalYear: number;
    fiscalStartMonth: number;
    monthIndex: number;
    rows: Array<{
      accountId: string;
      code: string;
      name: string;
      type: 'REVENUE' | 'EXPENSE';
      budgetMonth: string;
      actualMonth: string;
      budgetYtd: string;
      actualYtd: string;
      varianceYtd: string;
      variancePctYtd: number | null;
      favorableYtd: boolean;
    }>;
    totals: {
      revenue: { budgetYtd: string; actualYtd: string };
      expense: { budgetYtd: string; actualYtd: string };
      profit: { budgetYtd: string; actualYtd: string };
    };
    warnings: string[];
  };
}

interface EditRow {
  accountId: string;
  code: string;
  name: string;
  type: 'REVENUE' | 'EXPENSE';
  monthly: string[];
}

const EMPTY_ROW = (): string[] => Array.from({ length: 12 }, () => '');

function monthLabels(fiscalStartMonth: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = ((fiscalStartMonth - 1 + i) % 12) + 1;
    return MONTH_LABELS[m - 1].slice(0, 3);
  });
}

function toNumber(value: string): number {
  const n = Number(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function BudgetView({
  period,
  onPeriodChange,
  comparative,
  onComparativeChange,
  canEdit,
  fiscalStartMonth,
}: {
  period: string;
  onPeriodChange: (value: string) => void;
  comparative: string;
  onComparativeChange: (v: string) => void;
  canEdit: boolean;
  fiscalStartMonth: number;
}) {
  const [year, month] = period.split('-').map(Number);
  const fiscalYear = month >= fiscalStartMonth ? year : year - 1;

  const budgetUrl = `/api/v1/accounting/budgets?year=${fiscalYear}`;
  const reportUrl = `/api/v1/accounting/reports/budget?period=${period}`;
  const { data, loading, error, reload } = useApi<BudgetListDto>(budgetUrl);
  const report = useApi<BudgetReportDto>(reportUrl);

  const [rows, setRows] = useState<EditRow[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [addAccountId, setAddAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setRows(
      data.items.map((item) => ({
        accountId: item.accountId,
        code: item.code,
        name: item.name,
        type: item.type,
        monthly: Array.from({ length: 12 }, (_, i) => {
          const n = Number(item.monthly?.[i] ?? 0);
          return n ? String(n) : '';
        }),
      }))
    );
    setRemoved([]);
  }, [data]);

  const labels = useMemo(
    () => monthLabels(data?.fiscalStartMonth ?? fiscalStartMonth),
    [data?.fiscalStartMonth, fiscalStartMonth]
  );

  const availableAccounts = useMemo(() => {
    const used = new Set(rows.map((r) => r.accountId));
    return (data?.accounts ?? []).filter((a) => !used.has(a.id));
  }, [data?.accounts, rows]);

  const rowTotal = (row: EditRow) => row.monthly.reduce((acc, v) => acc + toNumber(v), 0);

  const updateCell = (accountId: string, index: number, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.accountId !== accountId) return row;
        const monthly = [...row.monthly];
        monthly[index] = value;
        return { ...row, monthly };
      })
    );
    setNotice(null);
  };

  const addRow = () => {
    const account = availableAccounts.find((a) => a.id === addAccountId);
    if (!account) return;
    setRows((prev) => [
      ...prev,
      {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        monthly: EMPTY_ROW(),
      },
    ]);
    setRemoved((prev) => prev.filter((id) => id !== account.id));
    setAddAccountId('');
    setNotice(null);
  };

  const removeRow = (accountId: string) => {
    setRows((prev) => prev.filter((r) => r.accountId !== accountId));
    setRemoved((prev) => (prev.includes(accountId) ? prev : [...prev, accountId]));
    setNotice(null);
  };

  const save = async () => {
    setSaving(true);
    setNotice(null);
    setSaveError(null);
    try {
      const items = rows.map((row) => ({
        accountId: row.accountId,
        monthly: row.monthly.map((v) => toNumber(v)),
      }));
      // Baris yang dihapus dikirim sebagai nol supaya server menghapus anggarannya.
      for (const accountId of removed) {
        items.push({ accountId, monthly: Array.from({ length: 12 }, () => 0) });
      }
      if (items.length === 0) {
        setSaveError('Belum ada baris anggaran yang diisi.');
        return;
      }
      const res = await apiSend<{ success: boolean; message?: string }>(
        '/api/v1/accounting/budgets',
        'PUT',
        { year: fiscalYear, items }
      );
      setNotice(res.message ?? 'Anggaran tersimpan.');
      setRemoved([]);
      reload();
      report.reload();
    } catch (err: any) {
      setSaveError(err?.message || 'Gagal menyimpan anggaran.');
    } finally {
      setSaving(false);
    }
  };

  const cur = report.data?.current;

  return (
    <div className="space-y-4">
      <div className="klir-no-print flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700">
          <Wallet className="h-3.5 w-3.5" />
          Tahun buku {fiscalYear}
          {fiscalStartMonth !== 1 && (
            <span className="text-slate-400">
              ({MONTH_LABELS[fiscalStartMonth - 1]} {fiscalYear} – {MONTH_LABELS[(fiscalStartMonth + 10) % 12]}{' '}
              {fiscalYear + 1})
            </span>
          )}
        </span>

        <select
          value={addAccountId}
          onChange={(e) => setAddAccountId(e.target.value)}
          disabled={!canEdit || availableAccounts.length === 0}
          className="h-9 max-w-xs rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
        >
          <option value="">Tambah akun…</option>
          {availableAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
        <button
          onClick={addRow}
          disabled={!canEdit || !addAccountId}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:text-slate-400"
        >
          <Plus className="h-3.5 w-3.5" />
          Tambah
        </button>

        {canEdit && (
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Simpan anggaran
          </button>
        )}

        {notice && <span className="text-[11px] font-medium text-emerald-700">{notice}</span>}
        {saveError && <span className="text-[11px] font-medium text-red-600">{saveError}</span>}
      </div>

      {!canEdit && (
        <p className="klir-no-print rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          Anda hanya bisa melihat anggaran. Mengubah anggaran memerlukan izin pengaturan keuangan.
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Anggaran per Akun</h3>
          <p className="text-[11px] text-slate-500">
            Isi rencana per bulan. Kosongkan bila tidak ada rencana. Angka tidak membuat jurnal.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat anggaran…
          </div>
        )}
        {!loading && error && <p className="px-4 py-8 text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Akun
                  </th>
                  {labels.map((label, i) => (
                    <th key={`${label}-${i}`} className="min-w-[92px] px-1 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">
                      {label}
                    </th>
                  ))}
                  <th className="min-w-[110px] px-2 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Total</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={15} className="px-3 py-10 text-center text-slate-500">
                      Belum ada anggaran. Pilih akun di atas lalu klik “Tambah”.
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.accountId} className="border-b border-slate-50 hover:bg-slate-50/40">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5">
                      <p className="font-medium text-slate-800">
                        <span className="mr-1.5 font-mono text-[10px] text-slate-400">{row.code}</span>
                        {row.name}
                      </p>
                      <p className="text-[10px] text-slate-400">{row.type === 'REVENUE' ? 'Pendapatan' : 'Beban'}</p>
                    </td>
                    {row.monthly.map((value, i) => (
                      <td key={i} className="px-1 py-1">
                        <input
                          inputMode="numeric"
                          value={value}
                          onChange={(e) => updateCell(row.accountId, i, e.target.value)}
                          disabled={!canEdit}
                          placeholder="0"
                          className="h-8 w-full rounded border border-slate-200 px-1.5 text-right text-[11px] tabular-nums text-slate-700 focus:border-emerald-400 focus:outline-none disabled:bg-slate-50"
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right text-[11px] font-semibold tabular-nums text-slate-800">
                      {formatMoney(rowTotal(row))}
                    </td>
                    <td className="pr-1">
                      {canEdit && (
                        <button
                          onClick={() => removeRow(row.accountId)}
                          title="Hapus baris"
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReportToolbar
        period={period}
        onPeriodChange={onPeriodChange}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={() => {
          reload();
          report.reload();
        }}
        loading={report.loading}
        exportUrl={`/api/v1/accounting/reports/export?period=${period}`}
      />

      {cur && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Pendapatan YTD</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
              {formatMoney(cur.totals.revenue.actualYtd)}
            </p>
            <p className="text-[11px] text-slate-500">Anggaran {formatMoney(cur.totals.revenue.budgetYtd)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Beban YTD</p>
            <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">
              {formatMoney(cur.totals.expense.actualYtd)}
            </p>
            <p className="text-[11px] text-slate-500">Anggaran {formatMoney(cur.totals.expense.budgetYtd)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Laba YTD</p>
            <p
              className={`mt-1 text-sm font-bold tabular-nums ${
                Number(cur.totals.profit.actualYtd) >= 0 ? 'text-emerald-700' : 'text-red-600'
              }`}
            >
              {formatMoney(cur.totals.profit.actualYtd)}
            </p>
            <p className="text-[11px] text-slate-500">Anggaran {formatMoney(cur.totals.profit.budgetYtd)}</p>
          </div>
        </div>
      )}

      <ReportShell
        title="Realisasi vs Anggaran"
        subtitle={`Tahun buku ${cur?.fiscalYear ?? fiscalYear}`}
        loading={report.loading}
        error={report.error}
        warnings={cur?.warnings}
        onRetry={report.reload}
      >
        {cur && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pl-3 pb-1.5 text-left text-[10px] font-semibold uppercase text-slate-500">Akun</th>
                <th className="px-2 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Anggaran bulan</th>
                <th className="px-2 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Realisasi bulan</th>
                <th className="px-2 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Anggaran YTD</th>
                <th className="px-2 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Realisasi YTD</th>
                <th className="px-2 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">Selisih YTD</th>
                <th className="pr-3 pb-1.5 text-right text-[10px] font-semibold uppercase text-slate-500">%</th>
              </tr>
            </thead>
            <tbody>
              {cur.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-xs text-slate-500">
                    Belum ada anggaran untuk tahun buku ini.
                  </td>
                </tr>
              )}
              {cur.rows.map((row) => (
                <tr key={row.accountId} className="border-b border-slate-50">
                  <td className="py-1.5 pl-3 text-xs text-slate-700">
                    <span className="mr-1.5 font-mono text-[10px] text-slate-400">{row.code}</span>
                    {row.name}
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-600">{formatMoney(row.budgetMonth)}</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-800">{formatMoney(row.actualMonth)}</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-600">{formatMoney(row.budgetYtd)}</td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-slate-800">{formatMoney(row.actualYtd)}</td>
                  <td
                    className={`px-2 py-1.5 text-right text-xs font-medium tabular-nums ${
                      row.favorableYtd ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {formatMoney(row.varianceYtd)}
                  </td>
                  <td className="pr-3 py-1.5 text-right text-xs tabular-nums text-slate-600">
                    {row.variancePctYtd === null ? '-' : formatPercent(row.variancePctYtd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportShell>
    </div>
  );
}
