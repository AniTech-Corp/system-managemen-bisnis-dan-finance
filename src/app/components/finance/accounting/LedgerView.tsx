'use client';

import React, { useEffect, useState } from 'react';
import { formatMoney, periodLabel } from './client';
import { ReportShell, ReportToolbar, useApi } from './ReportViews';

interface AccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  isPostable: boolean;
}

interface LedgerEntry {
  entryId: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  source: string;
  debit: string;
  credit: string;
  balance: string;
}

interface LedgerData {
  account: { id: string; code: string; name: string; type: string };
  openingBalance: string;
  entries: LedgerEntry[];
  closingBalance: string;
}

interface LedgerResponse {
  current: LedgerData;
}

export function LedgerView({
  period,
  onPeriodChange,
  comparative,
  onComparativeChange,
}: {
  period: string;
  onPeriodChange: (v: string) => void;
  comparative: string;
  onComparativeChange: (v: string) => void;
}) {
  const [accountId, setAccountId] = useState('');
  const { data: accounts } = useApi<AccountDto[]>('/api/v1/accounting/accounts?includeInactive=true');

  useEffect(() => {
    if (!accountId && accounts && accounts.length > 0) {
      const cashLike = accounts.find((a) => a.code === '1-1110' && a.isPostable);
      setAccountId(cashLike?.id ?? accounts.find((a) => a.isPostable)?.id ?? '');
    }
  }, [accounts, accountId]);

  const { data, loading, error, reload } = useApi<LedgerResponse>(
    accountId ? `/api/v1/accounting/reports/ledger?period=${period}&accountId=${accountId}` : null
  );
  const ledger = data?.current;

  const selectable = (accounts ?? []).filter((a) => a.isPostable);

  return (
    <div className="space-y-3">
      <ReportToolbar
        period={period}
        onPeriodChange={onPeriodChange}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
      />

      <div className="klir-no-print">
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="h-9 w-full max-w-md rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700"
        >
          <option value="">Pilih akun…</option>
          {selectable.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </div>

      <ReportShell
        title={ledger ? `Buku Besar — ${ledger.account.code} ${ledger.account.name}` : 'Buku Besar'}
        subtitle={`Periode ${periodLabel(period)}`}
        loading={loading}
        error={error}
        onRetry={reload}
      >
        {ledger && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pl-3 pb-1.5 text-left text-[10px] font-semibold uppercase text-slate-500">Tanggal</th>
                <th className="pb-1.5 text-left text-[10px] font-semibold uppercase text-slate-500">No Jurnal</th>
                <th className="pb-1.5 text-left text-[10px] font-semibold uppercase text-slate-500">Keterangan</th>
                <th className="pb-1.5 pr-3 text-right text-[10px] font-semibold uppercase text-slate-500">Debit</th>
                <th className="pb-1.5 pr-3 text-right text-[10px] font-semibold uppercase text-slate-500">Kredit</th>
                <th className="pb-1.5 pr-3 text-right text-[10px] font-semibold uppercase text-slate-500">Saldo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <td colSpan={5} className="py-1.5 pl-3 text-xs font-semibold text-slate-700">
                  Saldo Awal
                </td>
                <td className="py-1.5 pr-3 text-right text-xs font-semibold tabular-nums text-slate-900">
                  {formatMoney(ledger.openingBalance)}
                </td>
              </tr>
              {ledger.entries.map((e, index) => (
                <tr key={`${e.entryId}-${index}`} className="border-b border-slate-50">
                  <td className="py-1.5 pl-3 text-xs text-slate-600">{e.entryDate.slice(0, 10)}</td>
                  <td className="py-1.5 font-mono text-[11px] text-slate-500">{e.entryNumber}</td>
                  <td className="py-1.5 text-xs text-slate-800">{e.description}</td>
                  <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-slate-700">
                    {Number(e.debit) !== 0 ? formatMoney(e.debit) : '-'}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-slate-700">
                    {Number(e.credit) !== 0 ? formatMoney(e.credit) : '-'}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-xs tabular-nums text-slate-900">{formatMoney(e.balance)}</td>
                </tr>
              ))}
              {ledger.entries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-xs text-slate-500">
                    Tidak ada mutasi pada periode ini.
                  </td>
                </tr>
              )}
              <tr className="border-t-2 border-slate-300">
                <td colSpan={5} className="py-2 pl-3 text-sm font-bold text-slate-900">
                  Saldo Akhir
                </td>
                <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">
                  {formatMoney(ledger.closingBalance)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </ReportShell>
    </div>
  );
}
