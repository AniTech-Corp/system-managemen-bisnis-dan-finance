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
  Loader2,
  PieChart,
  Receipt,
  Scale,
  Settings,
  Target,
  TrendingUp,
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
import { JournalView } from './JournalView';
import { OpeningBalanceView } from './OpeningBalanceWizard';
import { AccountingSettingsView } from './AccountingSettings';
import { PayrollView } from './PayrollView';

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
  | 'tax'
  | 'budget'
  | 'payroll'
  | 'ledger'
  | 'journals'
  | 'opening'
  | 'settings';

const NAV: Array<{ id: ViewId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'summary', label: 'Ringkasan', icon: BarChart3 },
  { id: 'income', label: 'Laba Rugi', icon: TrendingUp },
  { id: 'balance', label: 'Neraca', icon: Scale },
  { id: 'cashflow', label: 'Arus Kas', icon: Coins },
  { id: 'equity', label: 'Perubahan Ekuitas', icon: PieChart },
  { id: 'trial', label: 'Neraca Saldo', icon: ListTree },
  { id: 'aging', label: 'Umur Piutang/Utang', icon: Clock },
  { id: 'tax', label: 'Ringkasan PPN', icon: Receipt },
  { id: 'budget', label: 'Anggaran', icon: Target },
  { id: 'payroll', label: 'Gaji & Pajak', icon: Banknote },
  { id: 'ledger', label: 'Buku Besar', icon: BookOpen },
  { id: 'journals', label: 'Jurnal Umum', icon: FileSpreadsheet },
  { id: 'opening', label: 'Saldo Awal', icon: Wand2 },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

export default function AccountingTab({ workspaceId }: { workspaceId: string }) {
  const [view, setView] = useState<ViewId>('summary');
  const [period, setPeriod] = useState(currentPeriodKey());
  const [comparative, setComparative] = useState('none');
  const [permissions, setPermissions] = useState<PermissionsResponse | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  // Bulan pertama tahun buku (dari Pengaturan) -- dipakai tab Anggaran supaya
  // kolomnya dimulai dari bulan yang benar.
  const [fiscalStartMonth, setFiscalStartMonth] = useState(1);
  // Menandai user sudah memilih periode sendiri; kalau sudah, jangan ditimpa
  // oleh periode otomatis dari server.
  const periodTouched = useRef(false);

  useEffect(() => {
    let alive = true;
    apiGet<{ success: boolean; data: PermissionsResponse }>('/api/v1/accounting/permissions')
      .then((res) => {
        if (alive) setPermissions(res.data);
      })
      .catch(() => undefined);

    apiGet<{ success: boolean; data: SettingsProbeResponse }>('/api/v1/accounting/settings')
      .then((res) => {
        if (!alive) return;
        const ready = Boolean(res.data?.setting?.isEnabled) && (res.data?.accountCount ?? 0) > 0;
        setEnabled(ready);
        setFiscalStartMonth(res.data?.setting?.fiscalYearStartMonth ?? 1);
        // Buka periode terakhir yang sudah ada jurnalnya (kalau ada), supaya
        // owner langsung melihat angka alih-alih bulan berjalan yang kosong.
        if (ready && res.data?.latestPeriodKey) {
          setPeriod((prev) => (periodTouched.current ? prev : res.data.latestPeriodKey!));
        }
      })
      .catch(() => {
        if (alive) setEnabled(false);
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
      {/* Navigasi laporan */}
      <div className="klir-no-print flex gap-1.5 overflow-x-auto pb-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {enabled === false && view !== 'settings' && (
        <div className="klir-no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-medium text-amber-900">
            Modul laporan keuangan belum disiapkan. Jalankan inisialisasi bagan akun untuk mulai mencatat jurnal dan menghasilkan laporan.
          </p>
          <button
            onClick={() => setView('settings')}
            className="rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Buka Pengaturan
          </button>
        </div>
      )}

      {permissions === null && (
        <p className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memeriksa hak akses…
        </p>
      )}

      {permissions !== null && !can.view && (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Anda tidak memiliki izin untuk melihat laporan keuangan workspace ini.
        </p>
      )}

      {permissions !== null && can.view && (
        <>
          {view === 'summary' && <SummaryView {...reportProps} />}
          {view === 'income' && <IncomeStatementView {...reportProps} />}
          {view === 'balance' && <BalanceSheetView {...reportProps} />}
          {view === 'cashflow' && <CashFlowView {...reportProps} />}
          {view === 'equity' && <EquityView {...reportProps} />}
          {view === 'trial' && <TrialBalanceView {...reportProps} />}
          {view === 'aging' && <AgingView {...reportProps} />}
          {view === 'tax' && <TaxView {...reportProps} />}
          {view === 'budget' && (
            <BudgetView
              {...reportProps}
              canEdit={can.manageSettings}
              fiscalStartMonth={fiscalStartMonth}
            />
          )}
          {view === 'payroll' && (
            <PayrollView canManage={['OWNER', 'ADMIN', 'MANAGER'].includes(permissions.role)} />
          )}
          {view === 'ledger' && <LedgerView {...reportProps} />}
          {view === 'journals' && (
            <JournalView {...reportProps} canPost={can.post} canDraft={can.draft} />
          )}
          {view === 'opening' && <OpeningBalanceView />}
          {view === 'settings' && (
            <div className="mx-auto max-w-3xl">
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-400" />
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
