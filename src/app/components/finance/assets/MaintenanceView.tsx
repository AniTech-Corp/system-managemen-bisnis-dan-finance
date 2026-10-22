'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Download, Plus, RefreshCw, Trash2, Wrench } from 'lucide-react';
import {
  apiGet,
  apiSend,
  downloadCsv,
  formatDate,
  formatMoney,
  MAINTENANCE_LABELS,
  MAINTENANCE_TYPES,
  type AssetMaintenance,
} from './client';
import {
  Alert,
  EmptyState,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  Spinner,
  StatCard,
  TextInput,
} from './ui';

interface Response {
  data: AssetMaintenance[];
  pagination: { total: number; page: number; limit: number; pages: number };
  summary: { totalRecords: number; totalCost: number };
}

export default function MaintenanceView({
  refreshKey,
  onAdd,
  onChanged,
}: {
  refreshKey: number;
  onAdd: () => void;
  onChanged: () => void;
}) {
  const [rows, setRows] = useState<AssetMaintenance[]>([]);
  const [summary, setSummary] = useState<Response['summary'] | null>(null);
  const [pagination, setPagination] = useState<Response['pagination'] | null>(null);
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (type) params.set('type', type);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await apiGet<Response>(`/api/v1/assets/maintenance?${params.toString()}`);
      setRows(response.data);
      setSummary(response.summary);
      setPagination(response.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat pemeliharaan.');
    } finally {
      setLoading(false);
    }
  }, [type, from, to, page]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const remove = async (row: AssetMaintenance) => {
    if (!window.confirm(`Hapus catatan pemeliharaan "${row.description}"?`)) return;
    try {
      await apiSend(`/api/v1/assets/maintenance/${row.id}`, 'DELETE');
      onChanged();
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Catatan gagal dihapus.');
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `pemeliharaan-aset-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Tanggal', 'Kode Aset', 'Nama Aset', 'Jenis', 'Deskripsi', 'Biaya', 'Vendor', 'Dikerjakan Oleh'],
      rows.map((row) => [
        formatDate(row.maintenanceDate),
        row.asset?.assetCode ?? '',
        row.asset?.name ?? '',
        MAINTENANCE_LABELS[row.type] ?? row.type,
        row.description,
        row.cost,
        row.vendor ?? '',
        row.performedBy ?? '',
      ])
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">Pemeliharaan Aset</h2>
          <p className="text-xs text-slate-500">
            Riwayat servis, perbaikan, dan inspeksi beserta biayanya.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-3.5 w-3.5" /> Ekspor CSV
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </SecondaryButton>
          <PrimaryButton type="button" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> Catat Pemeliharaan
          </PrimaryButton>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Total Catatan"
          value={String(summary?.totalRecords ?? 0)}
          hint="Sesuai filter aktif"
          icon={Wrench}
          tone="blue"
        />
        <StatCard
          label="Total Biaya"
          value={formatMoney(summary?.totalCost ?? 0)}
          hint="Biaya pemeliharaan terfilter"
          icon={Wrench}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SelectInput
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Semua jenis</option>
          {MAINTENANCE_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectInput>
        <TextInput
          type="date"
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
          placeholder="Dari tanggal"
        />
        <TextInput
          type="date"
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(1);
          }}
          placeholder="Sampai tanggal"
        />
      </div>

      {loading && rows.length === 0 ? (
        <Spinner label="Memuat pemeliharaan..." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Belum ada catatan pemeliharaan"
          description="Catat servis atau perbaikan agar biaya pemeliharaan aset tidak hilang."
          action={
            <PrimaryButton type="button" onClick={onAdd}>
              <Plus className="h-3.5 w-3.5" /> Catat Pemeliharaan
            </PrimaryButton>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full min-w-[860px] text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Tanggal</th>
                <th className="px-3 py-2.5 text-left">Aset</th>
                <th className="px-3 py-2.5 text-left">Jenis</th>
                <th className="px-3 py-2.5 text-left">Deskripsi</th>
                <th className="px-3 py-2.5 text-right">Biaya</th>
                <th className="px-3 py-2.5 text-left">Vendor</th>
                <th className="px-3 py-2.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 text-slate-600">{formatDate(row.maintenanceDate)}</td>
                  <td className="px-3 py-2">
                    <span className="block font-mono text-[10px] text-slate-400">
                      {row.asset?.assetCode}
                    </span>
                    <span className="font-semibold text-slate-800">{row.asset?.name}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {MAINTENANCE_LABELS[row.type] ?? row.type}
                  </td>
                  <td className="max-w-[260px] px-3 py-2 text-slate-600">
                    <span className="line-clamp-2">{row.description}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                    {formatMoney(row.cost)}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{row.vendor ?? '-'}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void remove(row)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
