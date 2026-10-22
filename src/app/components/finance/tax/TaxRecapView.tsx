'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Info, PieChart, RefreshCw, Table2 } from 'lucide-react';
import { apiGet, formatMoney } from '../accounting/client';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  InlineError,
  LoadingState,
  Money,
  StatCard,
  buttonCls,
} from './ui';
import {
  ACTIVE_TAX_TYPES,
  TAX_TYPE_LABEL,
  taxTypeShort,
} from '@/lib/tax/constants';
import type { RecapResponse } from './types';

const GROUP_OPTIONS = [
  { value: 'category', label: 'Kategori transaksi' },
  { value: 'source', label: 'Sumber dokumen' },
  { value: 'month', label: 'Bulan' },
];

const DIRECTION_BADGE: Record<string, string> = {
  OUTPUT: 'bg-blue-50 text-blue-700 border-blue-200',
  INPUT: 'bg-violet-50 text-violet-700 border-violet-200',
  WITHHOLDING: 'bg-amber-50 text-amber-700 border-amber-200',
  PAYABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const DIRECTION_LABEL: Record<string, string> = {
  OUTPUT: 'Keluaran',
  INPUT: 'Masukan',
  WITHHOLDING: 'Potongan',
  PAYABLE: 'Terutang',
};

function fmtDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
}

export function TaxRecapView({
  workspaceId,
  year,
  month,
}: {
  workspaceId: string;
  year: number;
  month: number;
}) {
  const [taxType, setTaxType] = useState<string>('PPN');
  const [groupBy, setGroupBy] = useState('category');
  const [data, setData] = useState<RecapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<RecapResponse & { success: boolean }>(
        `/api/v1/tax/recap?taxType=${taxType}&year=${year}&month=${month}&groupBy=${groupBy}`
      );
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyusun rekap pajak.');
    } finally {
      setLoading(false);
    }
  }, [taxType, groupBy, year, month]);

  useEffect(() => {
    void load();
  }, [load, workspaceId]);

  const maxGroup = data?.groups.reduce((max, group) => Math.max(max, group.taxAmount), 0) ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Rekap Transaksi Pajak"
          subtitle={`Masa ${month.toString().padStart(2, '0')}/${year} • angka mengikuti dokumen sumber`}
          icon={<Table2 className="h-4 w-4" />}
          action={
            <button type="button" onClick={() => void load()} className={buttonCls.secondary}>
              <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
            </button>
          }
        />

        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
          {ACTIVE_TAX_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTaxType(value)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                taxType === value
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {taxTypeShort(value)}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400">Kelompokkan</span>
            <select
              value={groupBy}
              onChange={(event) => setGroupBy(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-emerald-500"
            >
              {GROUP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <div className="px-4 pt-3"><InlineError message={error} onRetry={() => void load()} /></div> : null}

        {loading && !data ? (
          <LoadingState label="Menghitung rekap..." />
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-2.5 px-4 py-3 sm:grid-cols-3">
              <StatCard label="DPP" value={formatMoney(data.totals.dpp)} hint="Dasar pengenaan pajak" />
              <StatCard
                label={`Pajak ${taxTypeShort(data.taxType)}`}
                value={formatMoney(data.totals.taxAmount)}
                hint={`${data.totals.count} baris transaksi`}
                tone="emerald"
              />
              <StatCard
                label="Rata-rata tarif efektif"
                value={
                  data.totals.dpp > 0
                    ? `${((data.totals.taxAmount / data.totals.dpp) * 100).toFixed(2)}%`
                    : '—'
                }
                hint="Pajak ÷ DPP"
                tone="blue"
              />
            </div>

            <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-relaxed text-blue-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {data.note}
            </div>

            {data.groups.length > 0 ? (
              <div className="border-t border-slate-100 px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                  <PieChart className="h-3.5 w-3.5 text-emerald-600" />
                  Komposisi per {GROUP_OPTIONS.find((option) => option.value === groupBy)?.label.toLowerCase()}
                </p>
                <div className="space-y-1.5">
                  {data.groups.slice(0, 10).map((group) => (
                    <div key={group.key} className="grid grid-cols-[1fr_auto] items-center gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[10px] font-medium text-slate-600">{group.label}</span>
                          <span className="shrink-0 text-[10px] text-slate-400">{group.count} baris</span>
                        </div>
                        <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{
                              width: `${maxGroup > 0 ? Math.max(2, (group.taxAmount / maxGroup) * 100) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="font-mono text-[10px] font-semibold text-slate-700">
                        {formatMoney(group.taxAmount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {data.rows.length === 0 ? (
              <EmptyState
                title="Belum ada transaksi pada periode ini"
                message="Pastikan faktur, transaksi kas, payroll, atau bukti potong sudah dicatat pada bulan berjalan."
              />
            ) : (
              <div className="overflow-x-auto border-t border-slate-100">
                <table className="w-full min-w-[820px] text-left">
                  <thead>
                    <tr className="bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 font-semibold">Tanggal</th>
                      <th className="px-3 py-2 font-semibold">Referensi</th>
                      <th className="px-3 py-2 font-semibold">Pihak</th>
                      <th className="px-3 py-2 font-semibold">Kategori</th>
                      <th className="px-3 py-2 font-semibold">Arah</th>
                      <th className="px-3 py-2 text-right font-semibold">DPP</th>
                      <th className="px-3 py-2 text-right font-semibold">Tarif</th>
                      <th className="px-3 py-2 text-right font-semibold">Pajak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.slice(0, 500).map((row, index) => (
                      <tr
                        key={`${row.sourceType}-${row.sourceId}-${index}`}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                      >
                        <td className="whitespace-nowrap px-3 py-2 text-[10px] text-slate-600">{fmtDate(row.date)}</td>
                        <td className="max-w-[220px] px-3 py-2">
                          <p className="truncate text-[11px] font-medium text-slate-800">{row.reference}</p>
                          <p className="text-[9px] text-slate-400">{row.sourceType}</p>
                        </td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-[10px] text-slate-600">{row.partner}</td>
                        <td className="px-3 py-2">
                          <Badge>{row.category}</Badge>
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={DIRECTION_BADGE[row.direction] ?? ''}>
                            {DIRECTION_LABEL[row.direction] ?? row.direction}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Money value={row.dpp} className="text-[10px] text-slate-600" />
                        </td>
                        <td className="px-3 py-2 text-right text-[10px] text-slate-500">
                          {row.rate > 0 ? `${row.rate}%` : '—'}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Money value={row.taxAmount} className="text-[11px] font-semibold text-slate-900" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-800">
                      <td colSpan={5} className="px-3 py-2 text-right">
                        TOTAL
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Money value={data.totals.dpp} />
                      </td>
                      <td />
                      <td className="px-3 py-2 text-right">
                        <Money value={data.totals.taxAmount} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {data.rows.length > 500 ? (
              <p className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">
                Menampilkan 500 dari {data.rows.length} baris. Gunakan ekspor Excel/CSV untuk daftar lengkap.
              </p>
            ) : null}
          </>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title={`Catatan ${TAX_TYPE_LABEL[data?.taxType ?? 'PPN'] ?? ''}`}
          subtitle="Sumber angka dan batasan perhitungan."
        />
        <div className="space-y-1.5 px-4 py-3 text-[10px] leading-relaxed text-slate-500">
          <p>• PPN Keluaran diambil dari faktur penjualan; PPN Masukan dari transaksi beban bertanda PPN.</p>
          <p>• PPh Final dihitung per bulan dari transaksi kas masuk dengan ambang tahunan kumulatif.</p>
          <p>• PPh 21 &amp; BPJS diambil dari slip gaji yang diinput manual pada modul payroll.</p>
          <p>• PPh 23/4(2)/26 berasal dari daftar bukti potong yang diinput atau diimpor.</p>
          <p>• Rekap ini alat bantu administrasi; verifikasi akhir tetap tanggung jawab wajib pajak.</p>
        </div>
      </Card>
    </div>
  );
}
