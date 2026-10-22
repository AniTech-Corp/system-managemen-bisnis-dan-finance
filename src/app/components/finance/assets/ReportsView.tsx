'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, RefreshCw } from 'lucide-react';
import {
  apiGet,
  downloadCsv,
  formatDate,
  formatMoney,
  MAINTENANCE_LABELS,
  METHOD_LABELS,
  STATUS_LABELS,
  type AssetCategory,
} from './client';
import {
  Alert,
  EmptyState,
  SecondaryButton,
  SelectInput,
  Spinner,
  TextInput,
} from './ui';

type ReportType =
  | 'register'
  | 'book-value'
  | 'depreciation-schedule'
  | 'maintenance'
  | 'disposal'
  | 'impairment';

const REPORT_TYPES: Array<{ value: ReportType; label: string; description: string }> = [
  {
    value: 'register',
    label: 'Daftar Aset (Register)',
    description: 'Seluruh aset beserta harga perolehan, penyusutan, dan nilai buku.',
  },
  {
    value: 'book-value',
    label: 'Nilai Buku',
    description: 'Posisi nilai buku aset aktif untuk pelaporan neraca.',
  },
  {
    value: 'depreciation-schedule',
    label: 'Jadwal Penyusutan',
    description: 'Rincian beban penyusutan per aset per periode.',
  },
  {
    value: 'maintenance',
    label: 'Riwayat Pemeliharaan',
    description: 'Biaya pemeliharaan aset dalam rentang tanggal.',
  },
  {
    value: 'disposal',
    label: 'Pelepasan & Laba/Rugi',
    description: 'Aset yang sudah dilepas beserta hasil dan laba/ruginya.',
  },
  {
    value: 'impairment',
    label: 'Penurunan Nilai',
    description: 'Kerugian penurunan nilai yang pernah diakui.',
  },
];

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  numeric?: boolean;
}

const COLUMNS: Record<ReportType, Column[]> = {
  register: [
    { key: 'assetCode', label: 'Kode' },
    { key: 'name', label: 'Nama Aset' },
    { key: 'categoryName', label: 'Kategori' },
    { key: 'acquisitionDate', label: 'Perolehan' },
    { key: 'acquisitionCost', label: 'Harga Perolehan', align: 'right', numeric: true },
    { key: 'accumulatedDepreciation', label: 'Akum. Penyusutan', align: 'right', numeric: true },
    { key: 'bookValue', label: 'Nilai Buku', align: 'right', numeric: true },
    { key: 'method', label: 'Metode' },
    { key: 'status', label: 'Status', align: 'center' },
  ],
  'book-value': [
    { key: 'assetCode', label: 'Kode' },
    { key: 'name', label: 'Nama Aset' },
    { key: 'categoryName', label: 'Kategori' },
    { key: 'acquisitionCost', label: 'Harga Perolehan', align: 'right', numeric: true },
    { key: 'accumulatedDepreciation', label: 'Akum. Penyusutan', align: 'right', numeric: true },
    { key: 'accumulatedImpairment', label: 'Penurunan Nilai', align: 'right', numeric: true },
    { key: 'bookValue', label: 'Nilai Buku', align: 'right', numeric: true },
    { key: 'location', label: 'Lokasi' },
  ],
  'depreciation-schedule': [
    { key: 'period', label: 'Periode' },
    { key: 'assetCode', label: 'Kode' },
    { key: 'assetName', label: 'Nama Aset' },
    { key: 'method', label: 'Metode' },
    { key: 'depreciationAmount', label: 'Beban', align: 'right', numeric: true },
    { key: 'accumulatedDepreciation', label: 'Akumulasi', align: 'right', numeric: true },
    { key: 'bookValue', label: 'Nilai Buku', align: 'right', numeric: true },
    { key: 'posted', label: 'Jurnal', align: 'center' },
  ],
  maintenance: [
    { key: 'maintenanceDate', label: 'Tanggal' },
    { key: 'assetCode', label: 'Kode' },
    { key: 'assetName', label: 'Nama Aset' },
    { key: 'type', label: 'Jenis' },
    { key: 'description', label: 'Deskripsi' },
    { key: 'cost', label: 'Biaya', align: 'right', numeric: true },
    { key: 'vendor', label: 'Vendor' },
  ],
  disposal: [
    { key: 'assetCode', label: 'Kode' },
    { key: 'name', label: 'Nama Aset' },
    { key: 'categoryName', label: 'Kategori' },
    { key: 'disposalDate', label: 'Tanggal Lepas' },
    { key: 'disposalMethod', label: 'Metode' },
    { key: 'disposalProceeds', label: 'Hasil', align: 'right', numeric: true },
    { key: 'disposalGainLoss', label: 'Laba/Rugi', align: 'right', numeric: true },
  ],
  impairment: [
    { key: 'impairmentDate', label: 'Tanggal' },
    { key: 'assetCode', label: 'Kode' },
    { key: 'assetName', label: 'Nama Aset' },
    { key: 'carryingAmount', label: 'Nilai Buku', align: 'right', numeric: true },
    { key: 'recoverableAmount', label: 'Nilai Pulih', align: 'right', numeric: true },
    { key: 'impairmentLoss', label: 'Kerugian', align: 'right', numeric: true },
  ],
};

function displayCell(row: any, key: string): string {
  const value = row[key];
  if (value === null || value === undefined) return '-';
  if (key === 'acquisitionDate' || key === 'maintenanceDate' || key === 'disposalDate' || key === 'impairmentDate') {
    return formatDate(value);
  }
  if (key === 'method') return METHOD_LABELS[value] ?? value;
  if (key === 'status') return STATUS_LABELS[value] ?? value;
  if (key === 'type') return MAINTENANCE_LABELS[value] ?? value;
  if (key === 'disposalMethod') {
    const labels: Record<string, string> = {
      SALE: 'Dijual',
      SCRAP: 'Scrap',
      DONATION: 'Sumbangan',
      TRANSFER: 'Dialihkan',
      LOSS: 'Hilang',
      WRITE_OFF: 'Hapus Buku',
    };
    return labels[value] ?? value;
  }
  if (key === 'posted') return value ? 'Posted' : 'Belum';
  if (key === 'disposalGainLoss') return formatMoney(value);
  return String(value);
}

const NUMERIC_KEYS = new Set([
  'acquisitionCost',
  'accumulatedDepreciation',
  'accumulatedImpairment',
  'bookValue',
  'depreciationAmount',
  'cost',
  'disposalProceeds',
  'disposalGainLoss',
  'carryingAmount',
  'recoverableAmount',
  'impairmentLoss',
]);

export default function ReportsView({
  categories,
  refreshKey,
}: {
  categories: AssetCategory[];
  refreshKey: number;
}) {
  const [type, setType] = useState<ReportType>('register');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeConfig = useMemo(
    () => REPORT_TYPES.find((item) => item.value === type) ?? REPORT_TYPES[0],
    [type]
  );

  const usesDateRange = ['depreciation-schedule', 'maintenance', 'disposal', 'impairment'].includes(type);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ type });
      if (categoryId) params.set('categoryId', categoryId);
      if (status) params.set('status', status);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const response = await apiGet<{ data: any[]; summary?: Record<string, any> }>(
        `/api/v1/assets/reports?${params.toString()}`
      );
      setRows(response.data ?? []);
      setSummary(response.summary ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat laporan.');
    } finally {
      setLoading(false);
    }
  }, [type, categoryId, status, from, to]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const columns = COLUMNS[type];

  const exportCsv = () => {
    downloadCsv(
      `laporan-aset-${type}-${new Date().toISOString().slice(0, 10)}.csv`,
      columns.map((column) => column.label),
      rows.map((row) =>
        columns.map((column) => {
          const value = row[column.key];
          if (NUMERIC_KEYS.has(column.key)) return Number(value) || 0;
          return displayCell(row, column.key);
        })
      )
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">Laporan Aset</h2>
          <p className="text-xs text-slate-500">{activeConfig.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-3.5 w-3.5" /> Ekspor CSV
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Muat Ulang
          </SecondaryButton>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <SelectInput
          value={type}
          onChange={(event) => setType(event.target.value as ReportType)}
        >
          {REPORT_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </SelectInput>
        <SelectInput value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Semua kategori</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectInput>
        {(type === 'register' || type === 'book-value') && (
          <SelectInput value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Status aktif saja</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectInput>
        )}
        {usesDateRange && (
          <>
            <TextInput
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              title="Dari tanggal"
            />
            <TextInput
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              title="Sampai tanggal"
            />
          </>
        )}
      </div>

      {summary && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
          {Object.entries(summary)
            .filter(([, value]) => typeof value === 'number' || typeof value === 'string')
            .map(([key, value]) => (
              <span key={key} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 shadow-2xs">
                <span className="text-slate-400">{humanizeSummaryKey(key)}</span>
                <strong className="font-mono text-slate-800">
                  {typeof value === 'number' &&
                  /amount|cost|value|proceeds|gain|loss|accumulated|totalcost|totalbook/i.test(key)
                    ? formatMoney(value)
                    : String(value)}
                </strong>
              </span>
            ))}
        </div>
      )}

      {loading && rows.length === 0 ? (
        <Spinner label="Menyusun laporan..." />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title="Tidak ada data untuk filter ini"
          description="Ubah filter atau rentang tanggal untuk melihat data lain."
        />
      ) : (
        <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`whitespace-nowrap px-3 py-2.5 ${
                      column.align === 'right'
                        ? 'text-right'
                        : column.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={row.id ?? index} className="hover:bg-slate-50/70">
                  {columns.map((column) => {
                    const numeric = NUMERIC_KEYS.has(column.key);
                    const negative =
                      numeric && Number(row[column.key]) < 0;
                    return (
                      <td
                        key={column.key}
                        className={`px-3 py-1.5 ${
                          column.align === 'right'
                            ? 'text-right font-mono'
                            : column.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                        } ${numeric ? (negative ? 'text-rose-700' : 'text-slate-800') : 'text-slate-600'}`}
                      >
                        {numeric ? formatMoney(row[column.key]) : displayCell(row, column.key)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        {rows.length} baris ditampilkan. Laporan mengikuti jurnal penyusutan yang sudah tercatat; gunakan tab
        Penyusutan untuk melengkapi periode yang belum dijalankan.
      </p>
    </div>
  );
}

function humanizeSummaryKey(key: string): string {
  const map: Record<string, string> = {
    count: 'Jumlah',
    totalCost: 'Total Biaya',
    totalAmount: 'Total Beban',
    totalAccumulated: 'Akumulasi',
    totalImpairment: 'Penurunan Nilai',
    totalBookValue: 'Nilai Buku',
    totalProceeds: 'Total Hasil',
    totalGain: 'Total Untung',
    totalLoss: 'Total Rugi',
    netGainLoss: 'Laba/Rugi Bersih',
    unpostedCount: 'Belum Posted',
    unpostedAmount: 'Nominal Belum Posted',
  };
  return map[key] ?? key;
}
