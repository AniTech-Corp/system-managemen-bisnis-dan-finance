'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FolderOpen,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Settings,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import { apiGet } from '../accounting/client';
import { MONTH_LABELS } from '../accounting/client';
import { TaxOverview } from './TaxOverview';
import { ComplianceCalendarView } from './ComplianceCalendarView';
import { TaxRecapView } from './TaxRecapView';
import { TaxDocumentsView } from './TaxDocumentsView';
import { WithholdingView } from './WithholdingView';
import { TaxExportView } from './TaxExportView';
import { TaxSettingsView } from './TaxSettingsView';
import { PeriodDetailModal } from './PeriodDetailModal';
import { InlineError, LoadingState } from './ui';
import type { OverviewResponse, PermissionsResponse, PeriodView } from './types';

type ViewId = 'overview' | 'calendar' | 'recap' | 'documents' | 'withholdings' | 'export' | 'settings';

const TABS: Array<{ id: ViewId; label: string; icon: React.ElementType }> = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
  { id: 'calendar', label: 'Kalender Tenggat', icon: CalendarDays },
  { id: 'recap', label: 'Rekap Transaksi', icon: Table2 },
  { id: 'documents', label: 'Dokumen & Bukti', icon: FolderOpen },
  { id: 'withholdings', label: 'Bukti Potong', icon: FileSpreadsheet },
  { id: 'export', label: 'Ekspor Akuntan', icon: Download },
  { id: 'settings', label: 'Pengaturan Pajak', icon: Settings },
];

function wibNow(): { year: number; month: number } {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export default function TaxComplianceTab({ workspaceId }: { workspaceId: string }) {
  const initial = useMemo(() => wibNow(), []);
  const [view, setView] = useState<ViewId>('overview');
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<PermissionsResponse | null>(null);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const can = useMemo(() => {
    const p = permissions?.permissions ?? {};
    return {
      view: p.view !== false,
      draft: Boolean(p.draft),
      post: Boolean(p.post),
      manageSettings: Boolean(p.manage_settings),
    };
  }, [permissions]);

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let alive = true;
    apiGet<{ data: PermissionsResponse }>('/api/v1/accounting/permissions')
      .then(({ data }) => {
        if (alive) setPermissions(data);
      })
      .catch(() => {
        if (alive) setPermissions({ role: 'VIEWER', isOwner: false, permissions: {} });
      });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<{ success: boolean } & OverviewResponse>(
        `/api/v1/tax/overview?year=${year}&month=${month}`
      );
      setOverview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan pajak.');
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, version]);

  const changed = useCallback(
    (message?: string) => {
      if (message) notify(message);
      setVersion((v) => v + 1);
    },
    [notify]
  );

  const handlePeriodUpdated = useCallback(() => {
    changed('Status masa pajak diperbarui.');
    setSelectedPeriodId(null);
  }, [changed]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight text-slate-900">Pajak &amp; Kalender Kepatuhan</h2>
            <p className="mt-0.5 max-w-2xl text-[11px] leading-relaxed text-slate-500">
              Rekap transaksi pajak, tenggat setor/lapor, bukti pendukung, dan berkas ekspor untuk akuntan —
              dalam satu tempat.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-1.5 py-1">
            <button
              type="button"
              onClick={() => setYear((y) => y - 1)}
              className="rounded px-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
              aria-label="Tahun sebelumnya"
            >
              ‹
            </button>
            <span className="min-w-10 text-center text-xs font-bold text-slate-800">{year}</span>
            <button
              type="button"
              onClick={() => setYear((y) => y + 1)}
              className="rounded px-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
              aria-label="Tahun berikutnya"
            >
              ›
            </button>
          </div>
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-emerald-500"
            aria-label="Bulan"
          >
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void loadOverview()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Muat ulang
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = view === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setView(tab.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {error ? <InlineError message={error} onRetry={() => void loadOverview()} /> : null}
      {permissions && !can.view ? (
        <InlineError message="Peran Anda tidak memiliki izin melihat modul pajak." />
      ) : null}

      {view === 'overview' ? (
        loading && !overview ? (
          <LoadingState label="Menyiapkan masa pajak dan kalender..." />
        ) : overview ? (
          <TaxOverview
            data={overview}
            canManage={can.draft}
            canPost={can.post}
            onOpenPeriod={(period: PeriodView) => setSelectedPeriodId(period.id)}
            onChanged={changed}
          />
        ) : null
      ) : null}

      {view === 'calendar' ? (
        <ComplianceCalendarView
          workspaceId={workspaceId}
          year={year}
          canManage={can.draft}
          onOpenPeriod={(id) => setSelectedPeriodId(id)}
          onChanged={changed}
        />
      ) : null}

      {view === 'recap' ? <TaxRecapView workspaceId={workspaceId} year={year} month={month} /> : null}

      {view === 'documents' ? (
        <TaxDocumentsView
          workspaceId={workspaceId}
          year={year}
          canManage={can.draft}
          onOpenPeriod={(id) => setSelectedPeriodId(id)}
          onChanged={changed}
        />
      ) : null}

      {view === 'withholdings' ? (
        <WithholdingView
          workspaceId={workspaceId}
          year={year}
          month={month}
          canManage={can.draft}
          onChanged={changed}
        />
      ) : null}

      {view === 'export' ? <TaxExportView year={year} month={month} /> : null}

      {view === 'settings' ? (
        <TaxSettingsView workspaceId={workspaceId} canManage={can.manageSettings} onChanged={changed} />
      ) : null}

      {selectedPeriodId ? (
        <PeriodDetailModal
          workspaceId={workspaceId}
          periodId={selectedPeriodId}
          canManage={can.draft}
          canPost={can.post}
          onClose={() => setSelectedPeriodId(null)}
          onChanged={handlePeriodUpdated}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-4 right-4 z-[70] max-w-sm rounded-xl border border-emerald-200 bg-white px-4 py-3 text-xs font-medium text-emerald-800 shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
