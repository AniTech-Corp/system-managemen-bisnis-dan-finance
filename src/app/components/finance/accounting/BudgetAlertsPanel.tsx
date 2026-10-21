'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bell, Check, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { apiSend, formatMoney } from './client';
import { useApi } from './ReportViews';

/**
 * Panel peringatan anggaran per divisi.
 *
 * Ini jalur BACA utama peringatan: datang dari `/api/v1/accounting/budget-alerts`
 * yang diisi otomatis oleh `evaluateBudgetAlerts` setiap kali transaksi kas
 * disimpan/dihapus atau anggaran diubah. Bukan dari `ActivityEvent` -- tabel itu
 * hanya jejak audit dan belum punya pembaca notifikasi di codebase ini.
 *
 * Peringatan hanya MENUNJUKKAN, tidak pernah memblokir transaksi. Pemblokiran
 * dengan persetujuan owner sudah domain `spending-approval-guardrail.ts` dan
 * sengaja tidak dicampur di sini supaya aturan ambangnya tidak jadi ambigu.
 */

interface AlertDto {
  id: string;
  division: string;
  divisionLabel: string;
  level: 'WARNING' | 'EXCEEDED';
  budget: number;
  actual: number;
  acknowledgedAt: string | null;
  triggeredAt: string;
  account: { code: string; name: string };
  message: string;
}

interface AlertsDto {
  fiscalYear: number;
  monthIndex: number;
  isCurrentMonth: boolean;
  thresholds: { warningPct: number; exceededPct: number };
  alerts: AlertDto[];
  counts: { total: number; unacknowledged: number; warning: number; exceeded: number };
}

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function BudgetAlertsPanel({
  onUnacknowledgedChange,
}: {
  /**
   * Dipakai header tab untuk menampilkan badge jumlah peringatan. Dikirim dari
   * sini supaya hanya ADA SATU permintaan ke endpoint peringatan -- kalau tab
   * ikut mengambil sendiri, dua angka bisa berbeda saat salah satunya basi.
   */
  onUnacknowledgedChange?: (count: number) => void;
}) {
  const url = '/api/v1/accounting/budget-alerts';
  const { data, loading, error, reload } = useApi<AlertsDto>(url);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const unacknowledged = (data?.alerts ?? []).filter((a) => !a.acknowledgedAt);
  const unacknowledgedCount = unacknowledged.length;

  // Harus dipanggil SEBELUM early-return di bawah agar urutan hook tetap stabil,
  // dan tetap terkirim 0 saat semua peringatan sudah dibaca.
  useEffect(() => {
    onUnacknowledgedChange?.(unacknowledgedCount);
  }, [unacknowledgedCount, onUnacknowledgedChange]);

  /** Tandai semua peringatan yang belum dibaca. */
  const acknowledgeAll = async () => {
    const ids = unacknowledged.map((a) => a.id);
    if (ids.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiSend<{ message?: string }>(url, 'PATCH', { alertIds: ids });
      setNotice(res.message ?? 'Peringatan ditandai sudah dibaca.');
      reload();
    } catch (err: any) {
      setNotice(err?.message || 'Gagal menandai peringatan.');
    } finally {
      setBusy(false);
    }
  };

  /** Nilai ulang manual -- berguna setelah koreksi data besar. */
  const reevaluate = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const res = await apiSend<{ message?: string }>(url, 'POST', {});
      setNotice(res.message ?? 'Peringatan dinilai ulang.');
      reload();
    } catch (err: any) {
      setNotice(err?.message || 'Gagal menilai ulang peringatan.');
    } finally {
      setBusy(false);
    }
  };

  // Tanpa peringatan dan tidak sedang dibuka, panel tidak perlu mengambil
  // ruang -- anggaran yang sehat tidak perlu diberi perhatian.
  if (unacknowledged.length === 0 && !open) return null;

  const monthLabel = data ? MONTH_NAMES[data.monthIndex] ?? '' : '';

  return (
    <div className="klir-no-print rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 text-left"
          aria-expanded={open}
        >
          {/* Jumlah peringatan tampil sebagai badge di header tab Anggaran,
              bukan di sini, supaya terlihat dari tab mana pun. */}
          <Bell className="h-4 w-4 text-slate-500" />
          <span className="text-sm font-bold text-slate-900">Peringatan Anggaran</span>
        </button>

        <span className="text-[11px] text-slate-400">
          {data ? `${monthLabel} ${data.fiscalYear}` : ''}
        </span>

        <span className="ml-auto flex items-center gap-1.5">
          {notice && <span className="text-[11px] font-medium text-emerald-700">{notice}</span>}
          <button
            onClick={reevaluate}
            disabled={busy}
            title="Nilai ulang peringatan anggaran"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Nilai ulang
          </button>
          {unacknowledged.length > 0 && (
            <button
              onClick={acknowledgeAll}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 text-[11px] font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
            >
              <Check className="h-3 w-3" />
              Tandai sudah dibaca
            </button>
          )}
        </span>
      </div>

      {error && <p className="px-4 pb-3 text-[11px] text-red-600">{error}</p>}

      {open && (
        <div className="border-t border-slate-100">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Memuat peringatan…
            </div>
          )}

          {!loading && (data?.alerts.length ?? 0) === 0 && (
            <p className="px-4 py-6 text-center text-xs text-slate-500">
              Tidak ada peringatan. Seluruh pengeluaran masih di bawah ambang{' '}
              {data?.thresholds.warningPct ?? 80}%.
            </p>
          )}

          {!loading &&
            (data?.alerts ?? []).map((alert) => {
              const exceeded = alert.level === 'EXCEEDED';
              const acknowledged = Boolean(alert.acknowledgedAt);
              return (
                <div
                  key={alert.id}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-50 px-4 py-2.5 last:border-b-0 ${
                    acknowledged ? 'opacity-50' : ''
                  }`}
                >
                  {exceeded ? (
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  )}
                  <div className="min-w-[200px] flex-1">
                    <p className="text-xs font-semibold text-slate-800">
                      <span className="mr-1.5 font-mono text-[10px] text-slate-400">{alert.account.code}</span>
                      {alert.account.name}
                      <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        {alert.divisionLabel}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Realisasi {formatMoney(alert.actual)} dari anggaran {formatMoney(alert.budget)}
                    </p>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                      exceeded ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {exceeded ? 'Melewati batas' : 'Mendekati batas'}
                  </span>
                  {acknowledged && (
                    <span className="text-[10px] text-slate-400">Sudah dibaca</span>
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
