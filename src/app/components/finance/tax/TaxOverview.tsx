'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileWarning,
  Info,
  Landmark,
  Percent,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import { formatMoney } from '../accounting/client';
import { Badge, Card, CardHeader, EmptyState, Field, Money, StatCard, buttonCls, inputCls } from './ui';
import {
  DEADLINE_STATUS_BADGE,
  DEADLINE_STATUS_LABEL,
  PERIOD_STATUS_BADGE,
  PERIOD_STATUS_LABEL,
  TAX_TYPE_BADGE,
  taxTypeLabel,
  taxTypeShort,
} from '@/lib/tax/constants';
import { formatMonthId } from '@/lib/tax/dates';
import type { DeadlineView, OverviewResponse, PeriodView } from './types';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
}

function AlertRow({ alert }: { alert: OverviewResponse['alerts'][number] }) {
  const styles: Record<string, string> = {
    critical: 'border-red-200 bg-red-50 text-red-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    info: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  };
  const icons: Record<string, React.ReactNode> = {
    critical: <ShieldAlert className="h-4 w-4" />,
    warning: <AlertTriangle className="h-4 w-4" />,
    info: <CheckCircle2 className="h-4 w-4" />,
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${styles[alert.level] ?? styles.info}`}>
      <div className="mt-0.5 shrink-0">{icons[alert.level] ?? icons.info}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold">{alert.title}</p>
        <p className="text-[10px] leading-relaxed opacity-80">{alert.message}</p>
      </div>
    </div>
  );
}

function DeadlineMini({ deadline, onOpenPeriod }: { deadline: DeadlineView; onOpenPeriod: (id: string) => void }) {
  const overdue = deadline.status === 'OVERDUE';
  const soon = deadline.status === 'DUE_SOON';
  return (
    <button
      type="button"
      disabled={!deadline.taxPeriodId}
      onClick={() => deadline.taxPeriodId && onOpenPeriod(deadline.taxPeriodId)}
      className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
        deadline.taxPeriodId ? 'hover:border-emerald-300 hover:bg-emerald-50/40' : 'cursor-default'
      } ${overdue ? 'border-red-200 bg-red-50/40' : soon ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'}`}
    >
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
          overdue ? 'bg-red-100 text-red-700' : soon ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {deadline.kind === 'PAYMENT' ? 'Rp' : deadline.kind === 'FILING' ? 'SPT' : '•'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-slate-800">{deadline.title}</p>
        <p className="text-[10px] text-slate-500">
          {fmtDate(deadline.dueDate)} •{' '}
          {overdue
            ? `terlambat ${Math.abs(deadline.daysUntil)} hari`
            : deadline.daysUntil === 0
              ? 'jatuh tempo hari ini'
              : `${deadline.daysUntil} hari lagi`}
        </p>
      </div>
      <Badge className={DEADLINE_STATUS_BADGE[deadline.status] ?? ''}>
        {DEADLINE_STATUS_LABEL[deadline.status] ?? deadline.status}
      </Badge>
    </button>
  );
}

function PeriodRow({
  period,
  onOpen,
}: {
  period: PeriodView;
  onOpen: (period: PeriodView) => void;
}) {
  return (
    <tr className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
      <td className="px-3 py-2.5">
        <Badge className={TAX_TYPE_BADGE[period.taxType] ?? ''}>{taxTypeShort(period.taxType)}</Badge>
        <p className="mt-1 text-[10px] text-slate-400">{taxTypeLabel(period.taxType)}</p>
      </td>
      <td className="px-3 py-2.5 text-right">
        <Money value={period.amount.dpp} className="text-[11px] text-slate-600" />
      </td>
      <td className="px-3 py-2.5 text-right">
        <Money value={period.amount.amount} className="text-xs font-bold text-slate-900" />
        {period.amount.overpayment > 0 ? (
          <p className="text-[9px] font-semibold text-blue-600">lebih bayar {formatMoney(period.amount.overpayment)}</p>
        ) : null}
      </td>
      <td className="px-3 py-2.5">
        <p className="text-[10px] text-slate-600">
          Setor: <span className="font-semibold">{fmtDate(period.dueDatePayment)}</span>
        </p>
        <p className="text-[10px] text-slate-500">Lapor: {fmtDate(period.dueDateFiling)}</p>
      </td>
      <td className="px-3 py-2.5">
        <Badge className={PERIOD_STATUS_BADGE[period.status] ?? ''}>
          {PERIOD_STATUS_LABEL[period.status] ?? period.status}
        </Badge>
      </td>
      <td className="px-3 py-2.5 text-right">
        <button type="button" onClick={() => onOpen(period)} className={buttonCls.secondary}>
          Kelola <ChevronRight className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

export function TaxOverview({
  data,
  canManage,
  canPost,
  onOpenPeriod,
  onChanged,
}: {
  data: OverviewResponse;
  canManage: boolean;
  canPost: boolean;
  onOpenPeriod: (period: PeriodView) => void;
  onChanged: (message?: string) => void;
}) {
  const { setting, summary, currentMonthPeriods, deadlines } = data;
  const annualTurnover = useMemo(
    () =>
      data.periods
        .filter((period) => period.taxType === 'PPH_FINAL_UMKM')
        .reduce((acc, period) => acc + period.amount.dpp, 0),
    [data.periods]
  );
  const [simulatedTurnover, setSimulatedTurnover] = useState<number>(annualTurnover || 0);

  useEffect(() => {
    setSimulatedTurnover(annualTurnover);
  }, [annualTurnover]);

  const simulation = useMemo(() => {
    const turnover = Math.max(0, simulatedTurnover || 0);
    const isOp = setting.entityType === 'ORANG_PRIBADI';
    const taxable = isOp ? Math.max(0, turnover - setting.umkmThreshold) : turnover;
    const tax = (taxable * setting.pphFinalRate) / 100;
    return { turnover, taxable, tax, isOp };
  }, [simulatedTurnover, setting]);

  const ppnRow = currentMonthPeriods.find((p) => p.taxType === 'PPN');
  const reconciliationGap =
    ppnRow && ppnRow.amount.ledgerDifference !== null && Math.abs(ppnRow.amount.ledgerDifference) > 1;

  return (
    <div className="space-y-4">
      {data.alerts.length > 0 ? (
        <div className="grid gap-2 md:grid-cols-3">
          {data.alerts.map((alert, index) => (
            <AlertRow key={`${alert.title}-${index}`} alert={alert} />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard
          label={`Terutang ${MONTH_SHORT[Math.max(0, data.month - 1)]}`}
          value={formatMoney(summary.totalPayable)}
          hint={`${summary.periodCount} masa pajak • ${summary.paidCount} sudah setor`}
          tone="emerald"
          icon={<Landmark className="h-4 w-4" />}
        />
        <StatCard
          label="Tenggat ≤ 7 hari"
          value={summary.dueSoon}
          hint="Setor/lapor yang mendesak"
          tone={summary.dueSoon > 0 ? 'amber' : 'slate'}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <StatCard
          label="Terlambat"
          value={summary.overdue}
          hint="Perlu tindakan segera"
          tone={summary.overdue > 0 ? 'red' : 'slate'}
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <StatCard
          label="Kelengkapan dokumen"
          value={`${summary.compliancePct.toFixed(0)}%`}
          hint={`${summary.missingDocuments} dokumen kurang • ${summary.criticalMissing} kritikal`}
          tone={summary.criticalMissing > 0 ? 'red' : summary.missingDocuments > 0 ? 'amber' : 'blue'}
          icon={<FileWarning className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader
            title={`Masa Pajak ${formatMonthId(data.year, data.month)}`}
            subtitle="Nominal dihitung ulang dari faktur, kas, payroll, dan bukti potong — bukan angka simpanan."
            icon={<CalendarClock className="h-4 w-4" />}
            action={
              <button
                type="button"
                onClick={() => onChanged()}
                className={buttonCls.ghost}
                title="Muat ulang data"
              >
                Segarkan
              </button>
            }
          />
          {currentMonthPeriods.length === 0 ? (
            <EmptyState
              title="Belum ada masa pajak"
              message="Aktifkan profil PKP atau muat ulang untuk membuat masa pajak bulan ini."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-3 py-2 font-semibold">Jenis</th>
                    <th className="px-3 py-2 text-right font-semibold">DPP</th>
                    <th className="px-3 py-2 text-right font-semibold">Pajak</th>
                    <th className="px-3 py-2 font-semibold">Tenggat</th>
                    <th className="px-3 py-2 font-semibold">Status</th>
                    <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {currentMonthPeriods.map((period) => (
                    <PeriodRow key={period.id} period={period} onOpen={onOpenPeriod} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {reconciliationGap ? (
            <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                PPN dari dokumen berbeda {formatMoney(Math.abs(ppnRow?.amount.ledgerDifference ?? 0))} dari jurnal akun
                2-1310/1-1600. Periksa faktur yang belum dijurnal atau jurnal PPN manual.
              </span>
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader
            title="Tenggat Terdekat"
            subtitle="Urut berdasarkan tanggal jatuh tempo."
            icon={<Clock3 className="h-4 w-4" />}
          />
          <div className="space-y-2 px-3 py-3">
            {deadlines.length === 0 ? (
              <EmptyState title="Tidak ada tenggat aktif" message="Semua kewajiban sudah ditandai selesai." />
            ) : (
              deadlines.slice(0, 8).map((deadline) => (
                <DeadlineMini
                  key={deadline.id}
                  deadline={deadline}
                  onOpenPeriod={(id) => {
                    const target = data.periods.find((period) => period.id === id);
                    if (target) onOpenPeriod(target);
                  }}
                />
              ))
            )}
          </div>
          <div className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-500">
            <span className="font-semibold text-slate-700">{summary.dueThisMonth}</span> tenggat bulan ini •{' '}
            <span className="font-semibold text-slate-700">{data.allDeadlines.length}</span> total di kalender
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Simulasi Cepat PPh Final UMKM"
            subtitle={`Tarif ${setting.pphFinalRate}% • ambang ${formatMoney(setting.umkmThreshold)} (khusus Orang Pribadi)`}
            icon={<Percent className="h-4 w-4" />}
          />
          <div className="space-y-3 px-4 py-3">
            <Field label="Peredaran bruto setahun (YTD)" hint="Default diambil dari total transaksi kas masuk tahun ini.">
              <input
                type="number"
                min={0}
                value={simulatedTurnover}
                onChange={(event) => setSimulatedTurnover(Number(event.target.value) || 0)}
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Omset</p>
                <p className="mt-1 font-mono text-[11px] font-bold text-slate-800">{formatMoney(simulation.turnover)}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-700">Kena pajak</p>
                <p className="mt-1 font-mono text-[11px] font-bold text-blue-900">{formatMoney(simulation.taxable)}</p>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-700">PPh Final</p>
                <p className="mt-1 font-mono text-[11px] font-bold text-emerald-900">{formatMoney(simulation.tax)}</p>
              </div>
            </div>
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              {simulation.isOp
                ? 'WP Orang Pribadi: omzet sampai Rp 500 juta tidak dikenakan PPh Final. Perhitungan bulanan di rekap memakai ambang kumulatif.'
                : 'Badan usaha: seluruh peredaran bruto dikenakan tarif final tanpa ambang.'}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Yang perlu dilakukan"
            subtitle="Langkah singkat agar administrasi pajak bulan ini rapi."
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <div className="space-y-2 px-4 py-3">
            {[
              {
                done: summary.criticalMissing === 0,
                title: 'Lengkapi dokumen kritikal',
                detail:
                  summary.criticalMissing === 0
                    ? 'Bukti setor/lapor sudah tersedia.'
                    : `${summary.criticalMissing} dokumen kritikal belum diunggah.`,
              },
              {
                done: summary.overdue === 0,
                title: 'Tindak lanjuti tenggat terlambat',
                detail:
                  summary.overdue === 0
                    ? 'Tidak ada tenggat yang lewat.'
                    : `${summary.overdue} kewajiban sudah melewati tanggal jatuh tempo.`,
              },
              {
                done: summary.filedCount === summary.periodCount && summary.periodCount > 0,
                title: 'Tandai status lapor/setor',
                detail: `${summary.filedCount}/${summary.periodCount} masa pajak sudah ditandai lapor atau setor.`,
              },
              {
                done: false,
                title: 'Ekspor arsip untuk akuntan',
                detail: 'Unduh Excel/CSV/PDF setelah dokumen lengkap.',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
              >
                <div
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                    item.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-800">{item.title}</p>
                  <p className="text-[10px] leading-relaxed text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))}
            {canManage ? (
              <p className="pt-1 text-[10px] text-slate-400">
                Gunakan tab <strong className="text-slate-600">Dokumen &amp; Bukti</strong> untuk mengunggah bukti, lalu
                tandai status pada tabel masa pajak.
              </p>
            ) : canPost ? null : (
              <p className="pt-1 text-[10px] text-slate-400">Peran Anda hanya dapat melihat data.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];
