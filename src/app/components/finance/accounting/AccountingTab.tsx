'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Banknote,
  BarChart3,
  BookOpen,
  Clock,
  Coins,
  FileSpreadsheet,
  Layers,
  ListTree,
  Package,
  Loader2,
  PieChart,
  Receipt,
  Scale,
  Settings,
  Target,
  TrendingUp,
  Wallet,
  Wand2,
} from 'lucide-react';
import { apiGet, currentPeriodKey } from './client';
import {
  AgingView,
  BalanceSheetView,
  CashFlowView,
  EquityView,
  IncomeStatementView,
  SummaryView,
  TaxView,
  TrialBalanceView,
} from './ReportViews';
import { LedgerView } from './LedgerView';
import { BudgetView } from './BudgetView';
import { BudgetAlertsPanel } from './BudgetAlertsPanel';
import { JournalView } from './JournalView';
import { OpeningBalanceView } from './OpeningBalanceWizard';
import { AccountingSettingsView } from './AccountingSettings';
import { PayrollView } from './PayrollView';
import { InventoryReportView } from './InventoryReportView';
import SimpleBackupRecovery from './SimpleBackupRecovery';
import ArApView from './ArApView';
import ScenarioProjectionView from './ScenarioProjectionView';
import { BankReconciliationView } from './bank-reconciliation';

interface PermissionsResponse {
  role: string;
  isOwner: boolean;
  permissions: Record<string, boolean>;
}

interface SettingsProbeResponse {
  setting: { isEnabled: boolean; fiscalYearStartMonth?: number } | null;
  accountCount: number;
  latestPeriodKey: string | null;
}

type ViewId =
  | 'summary'
  | 'income'
  | 'balance'
  | 'cashflow'
  | 'equity'
  | 'trial'
  | 'aging'
  | 'arap'
  | 'tax'
  | 'budget'
  | 'proyeksi'
  | 'payroll'
  | 'inventory'
  | 'ledger'
  | 'journals'
  | 'opening'
  | 'backup'
  | 'settings'
  | 'bank-reconciliation';

const NAV: Array<{ id: ViewId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'summary', label: 'Ringkasan', icon: BarChart3 },
  { id: 'income', label: 'Laba Rugi', icon: TrendingUp },
  { id: 'balance', label: 'Neraca', icon: Scale },
  { id: 'cashflow', label: 'Arus Kas', icon: Coins },
  { id: 'equity', label: 'Perubahan Ekuitas', icon: PieChart },
  { id: 'trial', label: 'Neraca Saldo', icon: ListTree },
  { id: 'aging', label: 'Umur Piutang/Utang', icon: Clock },
  { id: 'arap', label: 'Utang & Piutang', icon: Wallet },
  { id: 'bank-reconciliation', label: 'Rekonsiliasi Bank', icon: Wallet },
  { id: 'tax', label: 'Ringkasan PPN', icon: Receipt },
  { id: 'budget', label: 'Anggaran', icon: Target },
  { id: 'proyeksi', label: 'Proyeksi Skenario', icon: TrendingUp },
  { id: 'inventory', label: 'Persediaan', icon: Package },
  { id: 'payroll', label: 'Gaji & Pajak', icon: Banknote },
  { id: 'ledger', label: 'Buku Besar', icon: BookOpen },
  { id: 'journals', label: 'Jurnal Umum', icon: FileSpreadsheet },
  { id: 'opening', label: 'Saldo Awal', icon: Wand2 },
  { id: 'backup', label: 'Backup System', icon: BookOpen },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

export default function AccountingTab({ workspaceId }: { workspaceId: string }) {
  const [view, setView] = useState<ViewId>('summary');
  const [period, setPeriod] = useState('');
  const [comparative, setComparative] = useState('none');
  const [permissions, setPermissions] = useState<PermissionsResponse | null>(null);
  const [permissionsError, setPermissionsError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [fiscalStartMonth, setFiscalStartMonth] = useState(1);
  const [alertCount, setAlertCount] = useState(0);
  const periodTouched = useRef(false);
  const demoUserId = 'demo-user-123';

  useEffect(() => {
    let alive = true;
    periodTouched.current = false;
    setPermissions(null);
    setPermissionsError(null);
    setSettingsError(null);
    setEnabled(null);
    setAlertCount(0);
    setPeriod('');

    apiGet<{ data: PermissionsResponse }>('/api/v1/accounting/permissions')
      .then(({ data }) => {
        if (alive) setPermissions(data);
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setPermissionsError(error instanceof Error ? error.message : 'Gagal memeriksa izin laporan.');
      });

    apiGet<{ data: SettingsProbeResponse }>('/api/v1/accounting/settings')
      .then(({ data }) => {
        if (!alive) return;
        const ready = Boolean(data?.setting?.isEnabled) && data.accountCount > 0;
        setEnabled(ready);
        setFiscalStartMonth(data?.setting?.fiscalYearStartMonth ?? 1);
        setPeriod((previous) =>
          periodTouched.current ? previous : data?.latestPeriodKey || currentPeriodKey()
        );
      })
      .catch((error: unknown) => {
        if (!alive) return;
        setSettingsError(error instanceof Error ? error.message : 'Gagal memuat pengaturan akuntansi.');
        setPeriod((previous) => previous || currentPeriodKey());
      });

    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const can = useMemo(() => {
    const p = permissions?.permissions ?? {};
    return {
      view: p.view !== false,
      draft: Boolean(p.draft),
      post: Boolean(p.post),
      manageSettings: Boolean(p.manage_settings),
      manageAccounts: Boolean(p.manage_accounts),
      lock: Boolean(p.lock_period),
      manageArAp: Boolean(p.manage_ar_ap),
    };
  }, [permissions]);

  const reportProps = {
    period,
    onPeriodChange: (value: string) => {
      periodTouched.current = true;
      setPeriod(value);
    },
    comparative,
    onComparativeChange: setComparative,
  };

  return (
    <div className="space-y-4" data-workspace={workspaceId}>
      <div className="klir-no-print flex gap-1.5 overflow-x-auto pb-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          const badge = item.id === 'budget' ? alertCount : 0;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              {item.label}
              {badge > 0 && (
                <span
                  title={`${badge} peringatan anggaran belum dibaca`}
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {settingsError && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          Pengaturan akuntansi tidak dapat dimuat: {settingsError}
        </p>
      )}

      {/* Peringatan anggaran tampil di atas isi tab apa pun: tujuannya memang
          memberi tahu, bukan menunggu user membuka tab Anggaran. */}
      {enabled !== false && can.view && (
        <BudgetAlertsPanel onUnacknowledgedChange={setAlertCount} />
      )}

      {enabled === false && view !== 'settings' && (
        <div className="klir-no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-900">
            Modul laporan keuangan belum disiapkan. Jalankan inisialisasi bagan akun untuk mulai mencatat jurnal dan menghasilkan laporan.
          </p>
          <button
            onClick={() => setView('settings')}
            className="min-h-10 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Buka Pengaturan
          </button>
        </div>
      )}

      {permissionsError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Gagal memeriksa hak akses: {permissionsError}
        </p>
      )}

      {permissions === null && !permissionsError && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Memeriksa hak akses…
        </p>
      )}

      {permissions !== null && !can.view && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat laporan keuangan workspace ini.
        </p>
      )}

      {permissions !== null && can.view && (
        <>
          {!period && view !== 'settings' && view !== 'backup' && view !== 'proyeksi' && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Memuat periode laporan…
            </p>
          )}
          {period && view === 'summary' && <SummaryView {...reportProps} />}
          {period && view === 'income' && <IncomeStatementView {...reportProps} />}
          {period && view === 'balance' && <BalanceSheetView {...reportProps} />}
          {period && view === 'cashflow' && <CashFlowView {...reportProps} />}
          {period && view === 'equity' && <EquityView {...reportProps} />}
          {period && view === 'trial' && <TrialBalanceView {...reportProps} />}
          {period && view === 'aging' && <AgingView {...reportProps} />}
          {period && view === 'arap' && <ArApView canManage={can.manageArAp} />}
          {view === 'bank-reconciliation' && <BankReconciliationView workspaceId={workspaceId} />}
          {period && view === 'tax' && <TaxView {...reportProps} />}
          {period && view === 'budget' && (
            <BudgetView {...reportProps} canEdit={can.manageSettings} fiscalStartMonth={fiscalStartMonth} />
          )}
          {view === 'proyeksi' && <ScenarioProjectionView />}
          {period && view === 'inventory' && (
            <InventoryReportView period={period} onPeriodChange={reportProps.onPeriodChange} />
          )}
          {view === 'payroll' && (
            <PayrollView canManage={['OWNER', 'ADMIN', 'MANAGER'].includes(permissions.role)} />
          )}
          {period && view === 'ledger' && <LedgerView {...reportProps} />}
          {period && view === 'journals' && (
            <JournalView {...reportProps} canPost={can.post} canDraft={can.draft} />
          )}
          {view === 'opening' && <OpeningBalanceView />}
          {view === 'backup' && <SimpleBackupRecovery workspaceId={workspaceId} userId={demoUserId} />}
          {view === 'settings' && (
            <div className="mx-auto max-w-3xl">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-400" aria-hidden="true" />
                <p className="text-[11px] text-slate-500">
                  Peran Anda: <strong className="text-slate-700">{permissions.role}</strong>
                </p>
              </div>
              <AccountingSettingsView
                canManageSettings={can.manageSettings}
                canManageAccounts={can.manageAccounts}
                canLock={can.lock}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
