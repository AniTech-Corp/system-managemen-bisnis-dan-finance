'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  apiGet,
  apiSend,
  downloadCsv,
  formatDate,
  formatMoney,
  METHOD_LABELS,
  STATUS_CLASSES,
  STATUS_LABELS,
  type Asset,
  type AssetCategory,
} from './client';
import {
  Alert,
  Badge,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  Spinner,
  TextInput,
} from './ui';

interface ListResponse {
  data: Asset[];
  pagination: { total: number; page: number; limit: number; pages: number };
  summary: {
    totalAssets: number;
    totalAcquisitionCost: number;
    totalAccumulatedDepreciation: number;
    totalAccumulatedImpairment: number;
    totalBookValue: number;
  };
}

export default function AssetList({
  categories,
  refreshKey,
  onAdd,
  onSelect,
  onEdit,
  onChanged,
}: {
  categories: AssetCategory[];
  refreshKey: number;
  onAdd: () => void;
  onSelect: (assetId: string) => void;
  onEdit: (asset: Asset) => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<Asset[]>([]);
  const [summary, setSummary] = useState<ListResponse['summary'] | null>(null);
  const [pagination, setPagination] = useState<ListResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryId, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (categoryId) params.set('categoryId', categoryId);
      if (status) params.set('status', status);
      params.set('page', String(page));
      params.set('limit', '50');

      const response = await apiGet<ListResponse>(`/api/v1/assets?${params.toString()}`);
      setRows(response.data);
      setSummary(response.summary);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar aset.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, categoryId, status, page]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const categoryName = useMemo(() => {
    const map = new Map(categories.map((category) => [category.id, category.name]));
    return (id: string) => map.get(id) ?? '-';
  }, [categories]);

  const remove = async (asset: Asset) => {
    if (!window.confirm(`Hapus aset ${asset.assetCode} — ${asset.name}? Tindakan ini tidak bisa dibatalkan.`)) {
      return;
    }
    try {
      await apiSend(`/api/v1/assets/${asset.id}`, 'DELETE');
      setNotice('Aset berhasil dihapus.');
      onChanged();
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aset gagal dihapus.');
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `daftar-aset-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        'Kode',
        'Nama',
        'Kategori',
        'Tanggal Perolehan',
        'Harga Perolehan',
        'Akumulasi Penyusutan',
        'Penurunan Nilai',
        'Nilai Buku',
        'Metode',
        'Status',
        'Lokasi',
        'Penanggung Jawab',
      ],
      rows.map((asset) => [
        asset.assetCode,
        asset.name,
        asset.category?.name ?? categoryName(asset.categoryId),
        formatDate(asset.acquisitionDate),
        asset.acquisitionCost,
        asset.accumulatedDepreciation,
        asset.accumulatedImpairment,
        asset.bookValue,
        METHOD_LABELS[asset.depreciationMethod] ?? asset.depreciationMethod,
        STATUS_LABELS[asset.status] ?? asset.status,
        asset.location ?? '',
        asset.custodian?.fullName ?? '',
      ])
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">Daftar Aset</h2>
          <p className="text-xs text-slate-500">
            {pagination?.total ?? 0} aset · nilai buku{' '}
            <strong className="text-emerald-700">{formatMoney(summary?.totalBookValue ?? 0)}</strong>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </SecondaryButton>
          <SecondaryButton type="button" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-3.5 w-3.5" /> Ekspor CSV
          </SecondaryButton>
          <PrimaryButton type="button" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Catat Aset
          </PrimaryButton>
        </div>
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_180px_170px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <TextInput
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode, nama, merek, atau nomor seri..."
            className="pl-8"
          />
        </div>
        <SelectInput value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Semua kategori</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Semua status</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectInput>
      </div>

      {loading && rows.length === 0 ? (
        <Spinner label="Memuat aset..." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title={search || categoryId || status ? 'Tidak ada aset yang cocok' : 'Belum ada aset tercatat'}
          description={
            search || categoryId || status
              ? 'Ubah kata kunci atau filter untuk melihat aset lain.'
              : 'Mulai dengan mencatat aset tetap pertama perusahaan.'
          }
          action={
            !search && !categoryId && !status ? (
              <PrimaryButton type="button" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" /> Catat Aset Pertama
              </PrimaryButton>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full min-w-[980px] text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Aset</th>
                <th className="px-3 py-2.5 text-left">Perolehan</th>
                <th className="px-3 py-2.5 text-right">Harga Perolehan</th>
                <th className="px-3 py-2.5 text-right">Akum. Penyusutan</th>
                <th className="px-3 py-2.5 text-right">Nilai Buku</th>
                <th className="px-3 py-2.5 text-left">Lokasi / PJ</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((asset) => (
                <tr key={asset.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onSelect(asset.id)}
                      className="text-left"
                    >
                      <span className="block font-mono text-[10px] text-slate-400">{asset.assetCode}</span>
                      <span className="block font-semibold text-slate-800 hover:text-emerald-700">
                        {asset.name}
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        {asset.category?.name ?? categoryName(asset.categoryId)} ·{' '}
                        {METHOD_LABELS[asset.depreciationMethod] ?? asset.depreciationMethod}
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{formatDate(asset.acquisitionDate)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-slate-700">
                    {formatMoney(asset.acquisitionCost)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-amber-700">
                    {formatMoney(asset.accumulatedDepreciation)}
                    {asset.accumulatedImpairment > 0 && (
                      <span className="block text-[10px] text-rose-500">
                        + {formatMoney(asset.accumulatedImpairment)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700">
                    {formatMoney(asset.bookValue)}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    <span className="block text-[11px]">{asset.location || '-'}</span>
                    <span className="block text-[10px] text-slate-400">
                      {asset.custodian?.fullName ?? 'Belum ada PJ'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <Badge className={STATUS_CLASSES[asset.status] ?? 'border-slate-200 bg-slate-100 text-slate-600'}>
                      {STATUS_LABELS[asset.status] ?? asset.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onSelect(asset.id)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        title="Lihat detail"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(asset)}
                        className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        title="Ubah aset"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(asset)}
                        className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        title="Hapus aset"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Halaman {pagination.page} dari {pagination.pages}
          </span>
          <div className="flex gap-1.5">
            <SecondaryButton
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Sebelumnya
            </SecondaryButton>
            <SecondaryButton
              type="button"
              disabled={pagination.page >= pagination.pages}
              onClick={() => setPage((current) => current + 1)}
            >
              Berikutnya
            </SecondaryButton>
          </div>
        </div>
      )}
    </div>
  );
}
