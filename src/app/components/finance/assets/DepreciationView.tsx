'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  Play,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import {
  apiGet,
  apiSend,
  currentJakartaPeriod,
  downloadCsv,
  formatMoney,
  MONTH_LABELS,
  monthLabel,
  type Asset,
  type DepreciationEntry,
} from './client';
import {
  Alert,
  Badge,
  EmptyState,
  Field,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  Spinner,
  StatCard,
  TextInput,
} from './ui';

interface EntriesResponse {
  data: DepreciationEntry[];
  summary: { entries: number; totalAmount: number; unpostedCount: number; unpostedAmount: number };
}

interface RunResponse {
  createdEntries: number;
  postedJournals: number;
  totalAmount: number;
  skipped: Array<{ assetCode: string; name: string; reason: string }>;
  message?: string;
}

export default function DepreciationView({ refreshKey, onChanged }: { refreshKey: number; onChanged: () => void }) {
  const initial = currentJakartaPeriod();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [entries, setEntries] = useState<DepreciationEntry[]>([]);
  const [summary, setSummary] = useState<EntriesResponse['summary'] | null>(null);
  const [uopAssets, setUopAssets] = useState<Asset[]>([]);
  const [units, setUnits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<RunResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [entriesResponse, assetsResponse] = await Promise.all([
        apiGet<EntriesResponse>(`/api/v1/assets/depreciation?year=${year}&month=${month}`),
        apiGet<{ data: Asset[] }>('/api/v1/assets?limit=200&status=ACTIVE'),
      ]);
      setEntries(entriesResponse.data);
      setSummary(entriesResponse.summary);
      setUopAssets(
        assetsResponse.data.filter(
          (asset) => asset.depreciationMethod === 'UNITS_OF_PRODUCTION' && asset.isDepreciable
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data penyusutan.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const inputUnits = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(units)
          .map(([assetId, value]) => [assetId, Number(value)] as const)
          .filter(([, value]) => Number.isFinite(value) && value > 0)
      ),
    [units]
  );

  const run = async () => {
    setRunning(true);
    setError(null);
    setNotice(null);
    setRunResult(null);
    try {
      const response = await apiSend<RunResponse>('/api/v1/assets/depreciation', 'POST', {
        year,
        month,
        unitsByAsset: inputUnits,
      });
      setRunResult(response);
      setNotice(response.message ?? 'Penyusutan selesai dijalankan.');
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Penyusutan gagal dijalankan.');
    } finally {
      setRunning(false);
    }
  };

  const postUnposted = async () => {
    setPosting(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiSend<{ posted: number; message?: string }>(
        '/api/v1/assets/depreciation',
        'POST',
        { action: 'post' }
      );
      setNotice(response.message ?? 'Entri berhasil dijurnal.');
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memposting entri.');
    } finally {
      setPosting(false);
    }
  };

  const exportCsv = () => {
    downloadCsv(
      `penyusutan-${year}-${String(month).padStart(2, '0')}.csv`,
      ['Periode', 'Kode Aset', 'Nama Aset', 'Beban Penyusutan', 'Akumulasi', 'Nilai Buku', 'Status'],
      entries.map((entry) => [
        monthLabel(entry.periodYear, entry.periodMonth),
        entry.asset?.assetCode ?? '',
        entry.asset?.name ?? '',
        entry.depreciationAmount,
        entry.accumulatedDepreciation,
        entry.bookValue,
        entry.isPosted ? 'Posted' : 'Belum',
      ])
    );
  };

  const currentPeriod = currentJakartaPeriod();
  const isFuture =
    year * 12 + month > currentPeriod.year * 12 + currentPeriod.month;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">Penyusutan Bulanan</h2>
          <p className="text-xs text-slate-500">
            Hitung dan jurnal beban penyusutan seluruh aset aktif untuk periode terpilih.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Tahun">
            <SelectInput
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-28"
            >
              {Array.from({ length: 7 }, (_, index) => currentPeriod.year - 3 + index).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Bulan">
            <SelectInput
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="w-36"
            >
              {MONTH_LABELS.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <PrimaryButton type="button" onClick={run} disabled={running || isFuture}>
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {running ? 'Menjalankan...' : 'Jalankan Penyusutan'}
          </PrimaryButton>
        </div>
      </div>

      {isFuture && (
        <Alert tone="warning">
          Periode yang dipilih melebihi bulan berjalan. Pilih bulan ini atau sebelumnya.
        </Alert>
      )}
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {runResult && runResult.skipped.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <p className="font-semibold">{runResult.skipped.length} aset dilewati:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {runResult.skipped.slice(0, 8).map((item) => (
              <li key={`${item.assetCode}-${item.reason}`}>
                <span className="font-mono">{item.assetCode}</span> — {item.reason}
              </li>
            ))}
            {runResult.skipped.length > 8 && <li>…dan {runResult.skipped.length - 8} lainnya</li>}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label="Entri Periode"
          value={String(summary?.entries ?? 0)}
          hint={monthLabel(year, month)}
          icon={CalendarDays}
          tone="blue"
        />
        <StatCard
          label="Total Beban"
          value={formatMoney(summary?.totalAmount ?? 0)}
          hint="Beban penyusutan periode ini"
          icon={ClipboardCheck}
          tone="emerald"
        />
        <StatCard
          label="Belum Terjurnal"
          value={String(summary?.unpostedCount ?? 0)}
          hint={formatMoney(summary?.unpostedAmount ?? 0)}
          icon={TriangleAlert}
          tone={summary?.unpostedCount ? 'amber' : 'slate'}
        />
        <StatCard
          label="Aset Unit Produksi"
          value={String(uopAssets.length)}
          hint="Perlu input unit bulan ini"
          icon={RefreshCw}
          tone={uopAssets.length ? 'indigo' : 'slate'}
        />
      </div>

      {uopAssets.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5">
          <p className="text-xs font-bold text-indigo-900">Input Unit Produksi — {monthLabel(year, month)}</p>
          <p className="mb-2 text-[11px] text-indigo-700">
            Metode unit produksi hanya menghitung beban bila jumlah unit diisi. Aset tanpa unit akan dilewati.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {uopAssets.map((asset) => (
              <label key={asset.id} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-[11px] text-slate-600">
                  <span className="font-mono text-[10px] text-slate-400">{asset.assetCode}</span>{' '}
                  {asset.name}
                </span>
                <TextInput
                  type="number"
                  min={0}
                  value={units[asset.id] ?? ''}
                  onChange={(event) =>
                    setUnits((current) => ({ ...current, [asset.id]: event.target.value }))
                  }
                  placeholder="0"
                  className="w-20 px-2 py-1 text-right text-[11px]"
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">Entri Penyusutan</h3>
        <div className="flex flex-wrap gap-2">
          {(summary?.unpostedCount ?? 0) > 0 && (
            <SecondaryButton type="button" onClick={postUnposted} disabled={posting}>
              {posting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Jurnal Entri Belum Posted
            </SecondaryButton>
          )}
          <SecondaryButton type="button" onClick={exportCsv} disabled={entries.length === 0}>
            <Download className="h-3.5 w-3.5" /> Ekspor CSV
          </SecondaryButton>
          <SecondaryButton type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </SecondaryButton>
        </div>
      </div>

      {loading && entries.length === 0 ? (
        <Spinner label="Memuat entri penyusutan..." />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Belum ada penyusutan untuk periode ini"
          description="Klik Jalankan Penyusutan untuk menghitung beban bulan berjalan. Bulan yang terlewat akan dilengkapi otomatis."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Aset</th>
                <th className="px-3 py-2.5 text-right">Beban</th>
                <th className="px-3 py-2.5 text-right">Akumulasi</th>
                <th className="px-3 py-2.5 text-right">Nilai Buku</th>
                <th className="px-3 py-2.5 text-right">Unit</th>
                <th className="px-3 py-2.5 text-center">Jurnal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2">
                    <span className="block font-mono text-[10px] text-slate-400">
                      {entry.asset?.assetCode}
                    </span>
                    <span className="font-semibold text-slate-800">{entry.asset?.name}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-slate-800">
                    {formatMoney(entry.depreciationAmount)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-600">
                    {formatMoney(entry.accumulatedDepreciation)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-emerald-700">
                    {formatMoney(entry.bookValue)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-500">
                    {entry.unitsProduced === null ? '-' : entry.unitsProduced.toLocaleString('id-ID')}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Badge
                      className={
                        entry.isPosted
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }
                    >
                      {entry.isPosted ? 'Posted' : 'Belum'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
