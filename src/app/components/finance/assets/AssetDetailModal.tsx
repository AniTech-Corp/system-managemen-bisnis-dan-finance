'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Gauge,
  MapPin,
  Pencil,
  ShieldAlert,
  UserRound,
  Wrench,
} from 'lucide-react';
import {
  apiGet,
  formatDate,
  formatMoney,
  METHOD_LABELS,
  monthLabel,
  STATUS_CLASSES,
  STATUS_LABELS,
  yearsFromMonths,
  type Asset,
  type AssetImpairment,
  type AssetMaintenance,
  type AssetTransfer,
  type DepreciationEntry,
  type DepreciationPeriodItem,
} from './client';
import { Badge, EmptyState, Modal, SecondaryButton, Spinner } from './ui';

interface DetailResponse {
  data: Asset;
  schedule: DepreciationPeriodItem[];
  depreciationSummary: {
    plannedAccumulated: number;
    plannedBookValue: number;
    postedAccumulated: number;
    accumulatedImpairment: number;
    bookValue: number;
    remainingMonths: number;
    progressPct: number;
  };
  depreciationEntries: DepreciationEntry[];
}

type TabKey = 'schedule' | 'entries' | 'maintenance' | 'transfers' | 'impairments';

export default function AssetDetailModal({
  open,
  assetId,
  onClose,
  onEdit,
  onDispose,
  onTransfer,
  onImpair,
  onAddMaintenance,
}: {
  open: boolean;
  assetId: string | null;
  onClose: () => void;
  onEdit: (asset: Asset) => void;
  onDispose: (asset: Asset) => void;
  onTransfer: (asset: Asset) => void;
  onImpair: (asset: Asset) => void;
  onAddMaintenance: (asset: Asset) => void;
}) {
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('schedule');

  const load = useCallback(async () => {
    if (!assetId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet<DetailResponse>(`/api/v1/assets/${assetId}`);
      setDetail(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat detail aset.');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    if (open && assetId) {
      setTab('schedule');
      void load();
    } else {
      setDetail(null);
    }
  }, [open, assetId, load]);

  const asset = detail?.data;
  const schedule = detail?.schedule ?? [];
  const entries = detail?.depreciationEntries ?? [];
  const summary = detail?.depreciationSummary;

  const scheduleRows = useMemo(() => {
    const list = detail?.schedule ?? [];
    const entryList = detail?.depreciationEntries ?? [];
    const postedByPeriod = new Map(
      entryList.map((entry) => [`${entry.periodYear}-${entry.periodMonth}`, entry])
    );
    return list.map((period) => ({
      ...period,
      posted: postedByPeriod.get(`${period.year}-${period.month}`) ?? null,
    }));
  }, [detail]);

  const canAct = asset && asset.status !== 'DISPOSED' && asset.status !== 'SOLD';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={asset ? `${asset.assetCode} — ${asset.name}` : 'Detail Aset'}
      description={
        asset
          ? `${asset.category?.name ?? 'Tanpa kategori'} · Diperoleh ${formatDate(asset.acquisitionDate)}`
          : 'Memuat data aset...'
      }
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose}>
            Tutup
          </SecondaryButton>
          {asset && (
            <>
              <SecondaryButton type="button" onClick={() => onEdit(asset)}>
                <Pencil className="h-3.5 w-3.5" /> Ubah
              </SecondaryButton>
              <SecondaryButton type="button" onClick={() => onAddMaintenance(asset)}>
                <Wrench className="h-3.5 w-3.5" /> Pemeliharaan
              </SecondaryButton>
              {canAct && (
                <>
                  <SecondaryButton type="button" onClick={() => onTransfer(asset)}>
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Mutasi
                  </SecondaryButton>
                  <SecondaryButton type="button" onClick={() => onImpair(asset)}>
                    <ShieldAlert className="h-3.5 w-3.5" /> Turun Nilai
                  </SecondaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={() => onDispose(asset)}
                    className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  >
                    <AlertTriangle className="h-3.5 w-3.5" /> Pelepasan
                  </SecondaryButton>
                </>
              )}
            </>
          )}
        </>
      }
    >
      {loading && !detail && <Spinner label="Memuat detail aset..." />}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}

      {asset && summary && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={STATUS_CLASSES[asset.status] ?? 'border-slate-200 bg-slate-100 text-slate-600'}>
              {STATUS_LABELS[asset.status] ?? asset.status}
            </Badge>
            <Badge className="border-slate-200 bg-slate-50 text-slate-600">
              {METHOD_LABELS[asset.depreciationMethod] ?? asset.depreciationMethod}
            </Badge>
            {!asset.isDepreciable && (
              <Badge className="border-blue-200 bg-blue-50 text-blue-700">Tidak Disusutkan</Badge>
            )}
            {asset.impairmentRecords && asset.impairmentRecords.length > 0 && (
              <Badge className="border-rose-200 bg-rose-50 text-rose-700">
                {asset.impairmentRecords.length}× penurunan nilai
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Metric label="Nilai Perolehan" value={formatMoney(asset.acquisitionCost)} />
            <Metric
              label="Akumulasi Penyusutan"
              value={formatMoney(asset.accumulatedDepreciation)}
              tone="amber"
            />
            <Metric
              label="Penurunan Nilai"
              value={formatMoney(asset.accumulatedImpairment)}
              tone="rose"
            />
            <Metric label="Nilai Buku" value={formatMoney(summary.bookValue)} tone="emerald" />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
              <span>
                Progres penyusutan · {summary.progressPct.toFixed(0)}% · sisa{' '}
                {summary.remainingMonths} bulan
              </span>
              <span className="font-mono">
                {formatMoney(asset.accumulatedDepreciation)} /{' '}
                {formatMoney(Math.max(0, asset.acquisitionCost - asset.salvageValue))}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, summary.progressPct))}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs sm:grid-cols-2 lg:grid-cols-3">
            <Info icon={CalendarDays} label="Tanggal Perolehan" value={formatDate(asset.acquisitionDate)} />
            <Info
              icon={Gauge}
              label="Masa Manfaat"
              value={asset.isDepreciable ? yearsFromMonths(asset.usefulLifeMonths) : 'Tidak disusutkan'}
            />
            <Info label="Nilai Sisa" value={formatMoney(asset.salvageValue)} />
            <Info
              icon={MapPin}
              label="Lokasi"
              value={asset.location || '-'}
            />
            <Info
              icon={UserRound}
              label="Penanggung Jawab"
              value={asset.custodian?.fullName || '-'}
            />
            <Info label="Divisi" value={asset.department || '-'} />
            <Info label="Merek / Model" value={[asset.brand, asset.model].filter(Boolean).join(' ') || '-'} />
            <Info label="Nomor Seri" value={asset.serialNumber || '-'} />
            <Info
              label="Mulai Disusutkan"
              value={asset.isDepreciable ? formatDate(asset.depreciationStartDate ?? asset.acquisitionDate) : '-'}
            />
          </div>

          {asset.description && (
            <p className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
              {asset.description}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 border-b border-slate-200 pb-2">
            <TabButton active={tab === 'schedule'} onClick={() => setTab('schedule')} icon={BarChart3}>
              Jadwal Penyusutan
            </TabButton>
            <TabButton active={tab === 'entries'} onClick={() => setTab('entries')} icon={ClipboardList}>
              Riwayat Penyusutan ({entries.length})
            </TabButton>
            <TabButton
              active={tab === 'maintenance'}
              onClick={() => setTab('maintenance')}
              icon={Wrench}
            >
              Pemeliharaan ({asset.maintenanceRecords?.length ?? 0})
            </TabButton>
            <TabButton
              active={tab === 'transfers'}
              onClick={() => setTab('transfers')}
              icon={ArrowRightLeft}
            >
              Mutasi ({asset.transferHistory?.length ?? 0})
            </TabButton>
            <TabButton
              active={tab === 'impairments'}
              onClick={() => setTab('impairments')}
              icon={ShieldAlert}
            >
              Turun Nilai ({asset.impairmentRecords?.length ?? 0})
            </TabButton>
          </div>

          {tab === 'schedule' && (
            <div>
              {schedule.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="Belum ada jadwal penyusutan"
                  description="Aset ini tidak disusutkan atau masa manfaatnya belum diisi."
                />
              ) : (
                <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[640px] text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Periode</th>
                        <th className="px-3 py-2 text-right">Beban</th>
                        <th className="px-3 py-2 text-right">Akumulasi</th>
                        <th className="px-3 py-2 text-right">Nilai Buku</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scheduleRows.map((row) => (
                        <tr key={`${row.year}-${row.month}`} className="hover:bg-slate-50/70">
                          <td className="px-3 py-1.5 font-medium text-slate-700">
                            {monthLabel(row.year, row.month)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">{formatMoney(row.amount)}</td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                            {formatMoney(row.accumulated)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-800">
                            {formatMoney(row.bookValue)}
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            {row.posted ? (
                              <Badge
                                className={
                                  row.posted.isPosted
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-amber-200 bg-amber-50 text-amber-700'
                                }
                              >
                                {row.posted.isPosted ? 'Terjurnal' : 'Tercatat'}
                              </Badge>
                            ) : (
                              <span className="text-[10px] text-slate-400">Rencana</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'entries' && (
            <div>
              {entries.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Belum ada penyusutan yang dicatat"
                  description="Jalankan penyusutan bulanan dari tab Penyusutan."
                />
              ) : (
                <div className="max-h-80 overflow-auto rounded-lg border border-slate-200">
                  <table className="w-full min-w-[620px] text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Periode</th>
                        <th className="px-3 py-2 text-right">Beban</th>
                        <th className="px-3 py-2 text-right">Akumulasi</th>
                        <th className="px-3 py-2 text-right">Nilai Buku</th>
                        <th className="px-3 py-2 text-center">Jurnal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {entries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="px-3 py-1.5 font-medium text-slate-700">
                            {monthLabel(entry.periodYear, entry.periodMonth)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {formatMoney(entry.depreciationAmount)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                            {formatMoney(entry.accumulatedDepreciation)}
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono">
                            {formatMoney(entry.bookValue)}
                          </td>
                          <td className="px-3 py-1.5 text-center">
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
          )}

          {tab === 'maintenance' && (
            <div>
              {(asset.maintenanceRecords?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={Wrench}
                  title="Belum ada riwayat pemeliharaan"
                  description="Catat servis, perbaikan, atau inspeksi agar biaya aset terdokumentasi."
                />
              ) : (
                <div className="space-y-2">
                  {asset.maintenanceRecords!.map((record: AssetMaintenance) => (
                    <div key={record.id} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-800">
                          {formatDate(record.maintenanceDate)} · {record.description}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {formatMoney(record.cost)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {record.vendor || record.performedBy || 'Internal'}
                        {record.nextMaintenanceDate
                          ? ` · berikutnya ${formatDate(record.nextMaintenanceDate)}`
                          : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'transfers' && (
            <div>
              {(asset.transferHistory?.length ?? 0) === 0 ? (
                <EmptyState icon={ArrowRightLeft} title="Belum ada mutasi" description="Aset belum pernah dipindahkan." />
              ) : (
                <div className="space-y-2">
                  {asset.transferHistory!.map((transfer: AssetTransfer) => (
                    <div key={transfer.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">{formatDate(transfer.transferDate)}</span>
                        <span className="text-slate-500">
                          {transfer.fromLocation || '-'} → <strong>{transfer.toLocation || '-'}</strong>
                        </span>
                      </div>
                      {transfer.reason && <p className="mt-1 text-[11px] text-slate-500">{transfer.reason}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'impairments' && (
            <div>
              {(asset.impairmentRecords?.length ?? 0) === 0 ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="Belum ada penurunan nilai"
                  description="Nilai aset masih di atas atau sama dengan nilai yang dapat dipulihkan."
                />
              ) : (
                <div className="space-y-2">
                  {asset.impairmentRecords!.map((record: AssetImpairment) => (
                    <div key={record.id} className="rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800">
                          {formatDate(record.impairmentDate)} · kerugian{' '}
                          <span className="font-mono text-rose-700">{formatMoney(record.impairmentLoss)}</span>
                        </span>
                        <Badge
                          className={
                            record.isPosted
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }
                        >
                          {record.isPosted ? 'Terjurnal' : 'Belum'}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Nilai buku {formatMoney(record.carryingAmount)} → dapat dipulihkan{' '}
                        {formatMoney(record.recoverableAmount)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{record.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            Terakhir diperbarui {formatDate(asset.updatedAt)} · Dibuat {formatDate(asset.createdAt)}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Metric({
  label,
  value,
  tone = 'slate',
}: {
  label: string;
  value: string;
  tone?: 'slate' | 'emerald' | 'amber' | 'rose';
}) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${tones[tone]}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider opacity-70">{label}</span>
      <span className="mt-0.5 block font-mono text-sm font-bold">{value}</span>
    </div>
  );
}

function Info({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-2">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />}
      <div>
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <span className="text-xs font-medium text-slate-700">{value}</span>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
        active ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}
