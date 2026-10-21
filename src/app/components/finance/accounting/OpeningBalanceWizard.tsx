'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Info, Loader2, Plus, X } from 'lucide-react';
import { apiSend, formatMoney } from './client';
import { useApi } from './ReportViews';

interface AccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  isPostable: boolean;
}

interface CashAccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  accountId: string;
  isActive: boolean;
}

interface OpeningResponse {
  booksStartDate: string | null;
  retainedEarningsAccountId: string | null;
  hasOldBooks: boolean;
  opening: {
    entryNumber: string;
    entryDate: string;
    totalDebit: string;
    lines: Array<{ id: string; debit: string; credit: string; account: { code: string; name: string } }>;
  } | null;
}

interface DraftRow {
  accountId: string;
  cashAccountId: string;
  debit: string;
  credit: string;
  description: string;
}

const emptyRow = (): DraftRow => ({ accountId: '', cashAccountId: '', debit: '', credit: '', description: '' });

export function OpeningBalanceView() {
  const { data, loading, error, reload } = useApi<OpeningResponse>('/api/v1/accounting/opening-balance');
  const { data: accounts } = useApi<AccountDto[]>('/api/v1/accounting/accounts');
  const { data: cashAccounts } = useApi<CashAccountDto[]>('/api/v1/accounting/cash-accounts');

  const [date, setDate] = useState('');
  const [rows, setRows] = useState<DraftRow[]>([emptyRow(), emptyRow()]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [initialised, setInitialised] = useState(false);

  const postableAccounts = useMemo(() => (accounts ?? []).filter((a) => a.isPostable), [accounts]);
  const cashByAccountId = useMemo(() => {
    const map = new Map<string, CashAccountDto>();
    (cashAccounts ?? []).filter((c) => c.isActive).forEach((c) => map.set(c.accountId, c));
    return map;
  }, [cashAccounts]);

  useEffect(() => {
    if (initialised || !data) return;
    setDate((data.booksStartDate ?? new Date().toISOString()).slice(0, 10));
    setInitialised(true);
  }, [data, initialised]);

  useEffect(() => {
    if (!initialised || rows.some((r) => r.accountId)) return;
    const firstCash = (cashAccounts ?? []).find((c) => c.isActive);
    if (!firstCash) return;
    setRows((prev) => prev.map((r, i) => (i === 0 ? { ...r, accountId: firstCash.accountId, cashAccountId: firstCash.id } : r)));
  }, [cashAccounts, initialised, rows]);

  const totalDebit = rows.reduce((acc, r) => acc + (Number(r.debit) || 0), 0);
  const totalCredit = rows.reduce((acc, r) => acc + (Number(r.credit) || 0), 0);
  const difference = totalDebit - totalCredit;

  function updateRow(index: number, patch: Partial<DraftRow>) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== index) return r;
        const next = { ...r, ...patch };
        if (patch.accountId !== undefined) {
          const cash = cashByAccountId.get(patch.accountId);
          next.cashAccountId = cash?.id ?? '';
        }
        return next;
      })
    );
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const lines = rows
        .filter((r) => r.accountId && (Number(r.debit) > 0 || Number(r.credit) > 0))
        .map((r) => ({
          accountId: r.accountId,
          debit: Number(r.debit) || 0,
          credit: Number(r.credit) || 0,
          description: r.description || 'Saldo awal',
          cashAccountId: r.cashAccountId || null,
        }));

      await apiSend('/api/v1/accounting/opening-balance', 'POST', { date, lines });
      setMessage({
        type: 'ok',
        text:
          Math.abs(difference) < 0.005
            ? 'Saldo awal tersimpan dan sudah balance.'
            : 'Saldo awal tersimpan. Selisih otomatis dimasukkan ke akun Saldo Laba.',
      });
      reload();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat saldo awal…
      </div>
    );
  }

  if (error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">{error}</p>;
  }

  if (data?.opening) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Saldo Awal Pembukuan</h3>
          <p className="text-[11px] text-slate-500">
            Jurnal {data.opening.entryNumber} • {data.opening.entryDate.slice(0, 10)}
          </p>
        </div>
        <div className="border-b border-blue-100 bg-blue-50 px-4 py-2.5 text-[11px] text-blue-800">
          Saldo awal sudah dicatat dan tidak bisa diubah langsung. Bila ada kesalahan, buat jurnal pembalik di menu Jurnal, lalu isi
          ulang saldo awal.
        </div>
        <table className="w-full border-collapse">
          <tbody>
            {data.opening.lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-50">
                <td className="py-1.5 pl-3 text-xs text-slate-700">
                  <span className="mr-2 font-mono text-[10px] text-slate-400">{l.account.code}</span>
                  {l.account.name}
                </td>
                <td className="w-32 py-1.5 text-right text-xs tabular-nums text-slate-700">
                  {Number(l.debit) !== 0 ? formatMoney(l.debit) : ''}
                </td>
                <td className="w-32 py-1.5 pr-3 text-right text-xs tabular-nums text-slate-700">
                  {Number(l.credit) !== 0 ? formatMoney(l.credit) : ''}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300">
              <td className="py-2 pl-3 text-sm font-bold text-slate-900">Total</td>
              <td className="py-2 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(data.opening.totalDebit)}</td>
              <td className="py-2 pr-3 text-right text-sm font-bold tabular-nums text-slate-900">{formatMoney(data.opening.totalDebit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-bold text-slate-900">Isi Saldo Awal Pembukuan</h3>
        <p className="mt-1 text-[11px] text-slate-500">
          Masukkan saldo per tanggal mulai pembukuan: kas/bank, piutang, aset tetap, utang, dan modal. Bila total debit dan kredit belum
          sama, selisihnya otomatis masuk ke akun <strong>Saldo Laba</strong>.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-slate-600">
            Tanggal mulai pembukuan
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800"
            />
          </label>
          {data?.hasOldBooks && (
            <span className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
              <Info className="h-3.5 w-3.5" />
              Sudah ada jurnal posted. Pastikan tanggal saldo awal berada sebelum seluruh jurnal tersebut.
            </span>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto p-4">
          <div className="grid min-w-[720px] grid-cols-12 gap-2 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <span className="col-span-5">Akun</span>
            <span className="col-span-3 text-right">Debit</span>
            <span className="col-span-3 text-right">Kredit</span>
            <span className="col-span-1" />
          </div>

          {rows.map((row, index) => (
            <div key={index} className="grid min-w-[720px] grid-cols-12 items-center gap-2 pb-2">
              <select
                value={row.accountId}
                onChange={(e) => updateRow(index, { accountId: e.target.value })}
                className="col-span-5 rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-800"
              >
                <option value="">Pilih akun…</option>
                {postableAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              <input
                value={row.debit}
                onChange={(e) => updateRow(index, { debit: e.target.value, credit: '' })}
                inputMode="numeric"
                placeholder="0"
                className="col-span-3 rounded-lg border border-slate-300 px-2 py-2 text-right text-xs tabular-nums text-slate-800"
              />
              <input
                value={row.credit}
                onChange={(e) => updateRow(index, { credit: e.target.value, debit: '' })}
                inputMode="numeric"
                placeholder="0"
                className="col-span-3 rounded-lg border border-slate-300 px-2 py-2 text-right text-xs tabular-nums text-slate-800"
              />
              <button
                onClick={() => setRows((prev) => prev.filter((_, i) => i !== index))}
                disabled={rows.length <= 2}
                className="col-span-1 rounded-lg border border-slate-200 py-2 text-slate-400 hover:bg-slate-50 disabled:opacity-30"
              >
                <X className="mx-auto h-3.5 w-3.5" />
              </button>
              {row.cashAccountId && (
                <p className="col-span-12 -mt-1 pl-1 text-[10px] font-medium text-emerald-700">
                  Terhubung ke rekening kas/bank: {cashAccounts?.find((c) => c.id === row.cashAccountId)?.name}
                </p>
              )}
            </div>
          ))}

          <button
            onClick={() => setRows((prev) => [...prev, emptyRow()])}
            className="mt-1 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah baris
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
          <div className="text-xs text-slate-600">
            Total debit <strong className="tabular-nums text-slate-900">{formatMoney(totalDebit)}</strong> • total kredit{' '}
            <strong className="tabular-nums text-slate-900">{formatMoney(totalCredit)}</strong>
            <span className={`ml-3 font-semibold ${Math.abs(difference) < 0.005 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {Math.abs(difference) < 0.005 ? 'Balance' : `Selisih ${formatMoney(difference)} → Saldo Laba`}
            </span>
          </div>
          <button
            onClick={submit}
            disabled={busy || totalDebit + totalCredit === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? 'Menyimpan…' : 'Simpan Saldo Awal'}
          </button>
        </div>
      </div>

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-xs font-medium ${
            message.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
