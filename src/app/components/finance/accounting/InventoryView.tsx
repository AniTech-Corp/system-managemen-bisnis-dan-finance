'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Boxes, Loader2, Printer, RefreshCw } from 'lucide-react';
import { apiGet, formatMoney, formatNumber, periodLabel } from './client';
import { ReportShell, useApi } from './ReportViews';

/**
 * Laporan Persediaan: nilai stok (rata-rata bergerak) + kontrol saldo akun
 * 1-1400, dan kartu stok per produk.
 */

interface InventoryValuationRow {
  productId: string;
  sku: string | null;
  name: string;
  unit: string;
  qty: number;
  avgCost: number;
  value: number;
  ownershipType: string;
  warnings: string[];
}

interface InventoryReportData {
  current: {
    accountCode: string;
    asOf: string;
    totals: {
      productCount: number;
      quantity: number;
      value: number;
      ledgerValue: string;
      difference: string;
      warningCount: number;
    };
    items: InventoryValuationRow[];
    warnings: string[];
  };
}

interface StockCardData {
  card: {
    product: { id: string; sku: string | null; name: string; unit: string; qty: number; avgCost: number; value: number };
    openingQty: number;
    movements: Array<{
      id: string;
      createdAt: string;
      type: string;
      qtyChange: number;
      unitCost: number | null;
      note: string | null;
      balanceQty: number;
    }>;
    closingQty: number;
  };
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
}

const MOVEMENT_LABELS: Record<string, string> = {
  PURCHASE_IN: 'Pembelian',
  SALE_OUT: 'Penjualan',
  RETURN_IN: 'Retur masuk',
  RETURN_OUT: 'Retur keluar',
  ADJUSTMENT_IN: 'Koreksi tambah',
  ADJUSTMENT_OUT: 'Koreksi kurang',
  OPENING_BALANCE: 'Saldo awal',
};

export function InventoryView({ period, onPeriodChange }: { period: string; onPeriodChange: (v: string) => void }) {
  const { data, loading, error, reload } = useApi<InventoryReportData>(
    `/api/v1/accounting/reports/inventory?period=${period}`
  );
  const cur = data?.current;

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    let alive = true;
    apiGet<{ products: ProductOption[] }>('/api/v1/inventory/products?limit=100')
      .then((res) => {
        if (alive) setProducts(res.products ?? []);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const cardUrl = selected
    ? `/api/v1/accounting/reports/inventory?period=${period}&productId=${selected}`
    : null;
  const { data: cardData, loading: cardLoading, error: cardError, reload: reloadCard } =
    useApi<StockCardData>(cardUrl);
  const card = cardData?.card;

  const difference = cur ? Number(cur.totals.difference) : 0;
  const balanced = useMemo(() => Math.abs(difference) < 0.005, [difference]);

  return (
    <div className="space-y-4">
      <div className="klir-no-print flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
          Periode
          <input
            type="month"
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
          />
        </label>
        <span className="text-[11px] font-medium text-slate-500">{periodLabel(period)}</span>
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Kpi label="Nilai persediaan (kartu stok)" value={formatMoney(cur.totals.value)} tone="slate" />
          <Kpi label={`Saldo akun ${cur.accountCode}`} value={formatMoney(cur.totals.ledgerValue)} tone="slate" />
          <Kpi
            label="Selisih"
            value={formatMoney(cur.totals.difference)}
            tone={balanced ? 'emerald' : 'red'}
          />
          <Kpi label="Produk dinilai" value={`${cur.totals.productCount}`} tone="slate" />
        </div>
      )}

      <ReportShell
        title="Nilai Persediaan"
        subtitle={`Per ${periodLabel(period)} · rata-rata bergerak · kontrol akun ${cur?.accountCode ?? '1-1400'}`}
        loading={loading}
        error={error}
        warnings={cur?.warnings}
        onRetry={reload}
      >
        {cur && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  {['SKU', 'Produk', 'Satuan', 'Stok', 'Harga rata-rata', 'Nilai buku', 'Catatan'].map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${
                        ['Stok', 'Harga rata-rata', 'Nilai buku'].includes(h) ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cur.items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-xs text-slate-500">
                      Belum ada produk bernilai. Catat pembelian stok untuk mengisi persediaan.
                    </td>
                  </tr>
                )}
                {cur.items.map((row) => (
                  <tr key={row.productId} className="border-b border-slate-50">
                    <td className="px-3 py-2 text-[11px] text-slate-500">{row.sku ?? '—'}</td>
                    <td className="px-3 py-2 text-xs font-medium text-slate-800">
                      <button
                        onClick={() => setSelected(row.productId)}
                        className="text-left hover:text-emerald-700 hover:underline"
                      >
                        {row.name}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600">{row.unit}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">
                      {formatNumber(row.qty)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">
                      {formatMoney(row.avgCost)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                      {formatMoney(row.value)}
                    </td>
                    <td className="px-3 py-2">
                      {row.warnings.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> {row.warnings.length} catatan
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              {cur.items.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/60">
                    <td colSpan={3} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Total
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-700">
                      {formatNumber(cur.totals.quantity)}
                    </td>
                    <td />
                    <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-slate-900">
                      {formatMoney(cur.totals.value)}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </ReportShell>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="klir-no-print flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Boxes className="h-4 w-4 text-slate-400" /> Kartu Stok
            </h3>
            <p className="text-[11px] text-slate-500">Mutasi satu produk pada periode terpilih.</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="h-9 max-w-[260px] rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
            >
              <option value="">Pilih produk…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku ? `${p.sku} — ${p.name}` : p.name}
                </option>
              ))}
            </select>
            {selected && (
              <button
                onClick={reloadCard}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {cardLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Muat
              </button>
            )}
          </div>
        </div>

        {!selected && <p className="px-4 py-8 text-center text-xs text-slate-500">Pilih produk untuk melihat kartu stok.</p>}
        {selected && cardLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat kartu stok…
          </div>
        )}
        {selected && !cardLoading && cardError && <p className="px-4 py-8 text-center text-sm text-red-600">{cardError}</p>}

        {selected && !cardLoading && !cardError && card && (
          <>
            <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-4 sm:grid-cols-4">
              <Kpi label="Stok saat ini" value={formatNumber(card.product.qty)} tone="slate" />
              <Kpi label="Harga rata-rata" value={formatMoney(card.product.avgCost)} tone="slate" />
              <Kpi label="Nilai buku" value={formatMoney(card.product.value)} tone="slate" />
              <Kpi label="Stok awal periode" value={formatNumber(card.openingQty)} tone="slate" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/60">
                    {['Tanggal', 'Jenis', 'Masuk', 'Keluar', 'Harga satuan', 'Saldo stok', 'Catatan'].map((h) => (
                      <th
                        key={h}
                        className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${
                          ['Masuk', 'Keluar', 'Harga satuan', 'Saldo stok'].includes(h) ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {card.movements.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-xs text-slate-500">
                        Tidak ada mutasi stok pada periode ini.
                      </td>
                    </tr>
                  )}
                  {card.movements.map((m) => (
                    <tr key={m.id} className="border-b border-slate-50">
                      <td className="px-3 py-2 text-[11px] text-slate-600">
                        {new Date(m.createdAt).toLocaleDateString('id-ID')}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700">{MOVEMENT_LABELS[m.type] ?? m.type}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-emerald-700">
                        {m.qtyChange > 0 ? formatNumber(m.qtyChange) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-red-600">
                        {m.qtyChange < 0 ? formatNumber(Math.abs(m.qtyChange)) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">
                        {m.unitCost === null ? '—' : formatMoney(m.unitCost)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">
                        {formatNumber(m.balanceQty)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-slate-500">{m.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
                {card.movements.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50/60">
                      <td colSpan={5} className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        Saldo akhir
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold tabular-nums text-slate-900">
                        {formatNumber(card.closingQty)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'red' | 'slate' }) {
  const toneClass = tone === 'emerald' ? 'text-emerald-700' : tone === 'red' ? 'text-red-600' : 'text-slate-900';
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  );
}
