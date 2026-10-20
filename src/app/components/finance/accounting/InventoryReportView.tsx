'use client';

import React from 'react';
import { AlertTriangle, Loader2, Printer, RefreshCw } from 'lucide-react';
import { formatMoney, formatNumber, periodLabel } from './client';
import { ReportShell, useApi } from './ReportViews';

interface InventoryRow {
  productId: string;
  sku: string | null;
  name: string;
  unit: string;
  qty: number;
  avgCost: number;
  value: number;
  warnings: string[];
}

interface InventoryReportData {
  current: {
    accountCode: string;
    totals: {
      productCount: number;
      quantity: number;
      value: number;
      ledgerValue: string;
      difference: string;
    };
    items: InventoryRow[];
    warnings: string[];
  };
}

export function InventoryReportView({
  period,
  onPeriodChange,
}: {
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const { data, loading, error, reload } = useApi<InventoryReportData>(
    `/api/v1/accounting/reports/inventory?period=${period}`
  );
  const current = data?.current;
  const balanced = current ? Math.abs(Number(current.totals.difference)) < 0.005 : true;

  return (
    <div className="space-y-4">
      <div className="klir-no-print flex flex-wrap items-center gap-2">
        <label className="flex min-h-10 items-center gap-2 text-xs font-medium text-slate-600">
          Periode
          <input
            type="month"
            value={period}
            onChange={(event) => onPeriodChange(event.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
          />
        </label>
        <span className="text-xs text-slate-500">{periodLabel(period)}</span>
        <button
          onClick={reload}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Muat ulang
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <Printer className="h-3.5 w-3.5" />
          Cetak / PDF
        </button>
      </div>

      {current && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Nilai stok" value={formatMoney(current.totals.value)} />
          <Kpi label={`Saldo akun ${current.accountCode}`} value={formatMoney(current.totals.ledgerValue)} />
          <Kpi
            label="Selisih terhadap buku"
            value={formatMoney(current.totals.difference)}
            tone={balanced ? 'emerald' : 'red'}
          />
          <Kpi label="Produk dengan stok" value={formatNumber(current.totals.productCount)} />
        </div>
      )}

      <ReportShell
        title="Laporan Persediaan"
        subtitle={`Nilai stok per ${periodLabel(period)} · metode rata-rata bergerak`}
        loading={loading}
        error={error}
        warnings={current?.warnings}
        onRetry={reload}
      >
        {current && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  {['SKU', 'Produk', 'Satuan', 'Jumlah stok', 'Harga rata-rata', 'Nilai buku', 'Catatan'].map((label) => (
                    <th
                      key={label}
                      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${
                        ['Jumlah stok', 'Harga rata-rata', 'Nilai buku'].includes(label) ? 'text-right' : 'text-left'
                      }`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-500">
                      Belum ada persediaan yang tercatat untuk periode ini.
                    </td>
                  </tr>
                ) : (
                  current.items.map((item) => (
                    <tr key={item.productId} className="border-b border-slate-50">
                      <td className="px-3 py-2 text-[11px] text-slate-500">{item.sku || '—'}</td>
                      <td className="px-3 py-2 text-xs font-medium text-slate-800">{item.name}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{item.unit}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">{formatNumber(item.qty)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">{formatMoney(item.avgCost)}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">{formatMoney(item.value)}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">
                        {item.warnings.length > 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            {item.warnings.length} catatan
                          </span>
                        ) : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </ReportShell>
    </div>
  );
}

function Kpi({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'emerald' | 'red' }) {
  const color = tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
