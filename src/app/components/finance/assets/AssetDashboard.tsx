'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Boxes,
  Building2,
  CircleDollarSign,
  Plus,
  RefreshCw,
  TrendingDown,
  Wrench,
} from 'lucide-react';
import {
  apiGet,
  formatMoney,
  monthLabel,
  type AssetSummary,
} from './client';
import { Alert, PrimaryButton, SecondaryButton, Spinner, StatCard } from './ui';

export default function AssetDashboard({
  refreshKey,
  onNavigate,
  onAddAsset,
}: {
  refreshKey: number;
  onNavigate: (section: 'assets' | 'depreciation' | 'maintenance' | 'reports' | 'categories') => void;
  onAddAsset: () => void;
}) {
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet<{ data: AssetSummary }>('/api/v1/assets/reports?type=summary');
      setSummary(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan aset.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (loading && !summary) return <Spinner label="Menghitung ringkasan aset..." />;
  if (error) return <Alert tone="error">{error}</Alert>;
  if (!summary) return null;

  const maxCategoryValue = Math.max(
    1,
    ...summary.byCategory.map((category) => category.acquisitionCost)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">Ringkasan Aset Tetap</h2>
          <p className="text-xs text-slate-500">
            Posisi nilai perolehan, penyusutan, dan nilai buku seluruh aset perusahaan.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SecondaryButton type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </SecondaryButton>
          <PrimaryButton type="button" onClick={onAddAsset}>
            <Plus className="h-3.5 w-3.5" /> Catat Aset
          </PrimaryButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Jumlah Aset"
          value={String(summary.activeAssets)}
          hint={`${summary.disposedAssets} sudah dilepas`}
          icon={Boxes}
          tone="blue"
        />
        <StatCard
          label="Harga Perolehan"
          value={formatMoney(summary.totalAcquisitionCost)}
          hint={`${summary.totalAssets} aset tercatat`}
          icon={CircleDollarSign}
          tone="slate"
        />
        <StatCard
          label="Akumulasi Penyusutan"
          value={formatMoney(summary.totalAccumulatedDepreciation)}
          hint={
            summary.totalAccumulatedImpairment > 0
              ? `+ penurunan nilai ${formatMoney(summary.totalAccumulatedImpairment)}`
              : 'Tanpa penurunan nilai'
          }
          icon={TrendingDown}
          tone="amber"
        />
        <StatCard
          label="Nilai Buku"
          value={formatMoney(summary.totalBookValue)}
          hint="Nilai bersih yang dilaporkan"
          icon={Building2}
          tone="emerald"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Komposisi per Kategori</h3>
            <button
              type="button"
              onClick={() => onNavigate('categories')}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Kelola kategori <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          {summary.byCategory.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-400">
              Belum ada kategori. Tambahkan kategori terlebih dahulu.
            </p>
          ) : (
            <div className="space-y-2.5">
              {summary.byCategory.map((category) => {
                const ratio = (category.acquisitionCost / maxCategoryValue) * 100;
                return (
                  <div key={category.id}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">
                        {category.name}{' '}
                        <span className="font-normal text-slate-400">({category.count} aset)</span>
                      </span>
                      <span className="font-mono text-slate-600">{formatMoney(category.bookValue)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                        style={{ width: `${Math.max(2, ratio)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Pemeliharaan Tahun Ini
              </span>
              <Wrench className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <p className="mt-1 font-mono text-lg font-bold text-amber-900">
              {formatMoney(summary.maintenanceThisYear.cost)}
            </p>
            <p className="text-[10px] text-amber-700">{summary.maintenanceThisYear.count} catatan</p>
            <button
              type="button"
              onClick={() => onNavigate('maintenance')}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-900"
            >
              Lihat riwayat <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Pelepasan Aset
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="block text-[10px] text-slate-400">Hasil</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatMoney(summary.disposals.proceeds)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400">Laba/Rugi</span>
                <span
                  className={`font-mono font-bold ${
                    summary.disposals.netGainLoss >= 0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {formatMoney(summary.disposals.netGainLoss)}
                </span>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">{summary.disposals.count} aset dilepas</p>
          </div>

          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700">
              Penurunan Nilai
            </span>
            <p className="mt-1 font-mono text-lg font-bold text-rose-900">
              {formatMoney(summary.impairments.totalLoss)}
            </p>
            <p className="text-[10px] text-rose-700">{summary.impairments.count} kali diakui</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Penyusutan Terbaru</h3>
          <button
            type="button"
            onClick={() => onNavigate('depreciation')}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Buka penyusutan <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>

        {summary.recentDepreciation.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-400">
            Belum ada penyusutan. Jalankan penyusutan bulanan untuk mulai menghitung.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="text-[10px] uppercase tracking-wider text-slate-500">
                <tr className="border-b border-slate-100">
                  <th className="px-2 py-2 text-left">Periode</th>
                  <th className="px-2 py-2 text-left">Aset</th>
                  <th className="px-2 py-2 text-right">Beban</th>
                  <th className="px-2 py-2 text-center">Jurnal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.recentDepreciation.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-2 py-2 font-medium text-slate-700">
                      {monthLabel(
                        Number(entry.period.slice(0, 4)),
                        Number(entry.period.slice(5, 7))
                      )}
                    </td>
                    <td className="px-2 py-2 text-slate-600">
                      <span className="font-mono text-[11px] text-slate-400">{entry.assetCode}</span>{' '}
                      {entry.assetName}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{formatMoney(entry.amount)}</td>
                    <td className="px-2 py-2 text-center">
                      <span
                        className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                          entry.isPosted
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : 'border-amber-200 bg-amber-50 text-amber-700'
                        }`}
                      >
                        {entry.isPosted ? 'Posted' : 'Belum'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
