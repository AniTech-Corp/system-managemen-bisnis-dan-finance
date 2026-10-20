'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarCheck2, CheckCircle2, ChevronDown, ChevronRight, Loader2, Lock, Plus, RefreshCw, Unlock } from 'lucide-react';
import { apiGet, apiSend } from './client';
import { ancestorIds, buildAccountTree, descendantIds, flattenAccountTree } from '@/lib/accounting/account-tree';

/* ── tipe data ─────────────────────────────────────────────────────────── */

interface SettingDto {
  isEnabled: boolean;
  booksStartDate: string | null;
  taxProfile: string;
  entityType: string;
  fiscalYearStartMonth: number;
  defaultCashAccountId: string | null;
  defaultRevenueAccountId: string | null;
  enablePpn: boolean;
  enableInventory: boolean;
}

interface CashAccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  bankName: string | null;
  accountNumber: string | null;
  isActive: boolean;
  account: { id: string; code: string; name: string };
}

interface SettingsResponse {
  setting: SettingDto | null;
  accountCount: number;
  cashAccounts: CashAccountDto[];
  hasPostedJournals: boolean;
}

interface AccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  normalBalance: string;
  parentId: string | null;
  isPostable: boolean;
  isSystem: boolean;
  isActive: boolean;
  description: string | null;
}

interface PeriodDto {
  id: string;
  year: number;
  month: number;
  status: string;
  entryCount: number;
  draftCount: number;
  fiscalYearEndMonth: number;
  fiscalYearClosed: boolean;
  closingEntryNumber: string | null;
}

const TAX_PROFILE_LABELS: Record<string, string> = {
  UMKM_NON_PKP: 'UMKM Non-PKP (PPh final 0,5%)',
  UMKM_PKP: 'UMKM PKP (PPN + PPh final)',
  BADAN_NORMAL: 'Badan Normal (PPh badan)',
};

const ENTITY_LABELS: Record<string, string> = {
  BADAN_USAHA: 'Badan Usaha (PT / CV)',
  PERORANGAN: 'Usaha Perorangan',
  YAYASAN: 'Yayasan / Organisasi',
};

/* ── Setup wizard ──────────────────────────────────────────────────────── */

function SetupWizard({ onDone }: { onDone: () => void }) {
  const now = new Date();
  // Awal bulan berjalan, konsisten dengan default server (coa-seed.ts).
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 7 * 3600 * 1000);
  const [booksStartDate, setBooksStartDate] = useState(defaultStart.toISOString().slice(0, 10));
  const [entityType, setEntityType] = useState('BADAN_USAHA');
  const [taxProfile, setTaxProfile] = useState('UMKM_NON_PKP');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/v1/accounting/setup', 'POST', { booksStartDate, entityType, taxProfile });
      onDone();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-bold text-slate-900">Aktifkan Modul Laporan Keuangan</h3>
      <p className="mt-1 text-xs text-slate-500">
        Sistem akan membuat bagan akun standar Indonesia (±60 akun), dua rekening kas/bank contoh, dan pengaturan awal. Semua akun bisa
        diubah setelahnya.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">
          Mulai pembukuan
          <input
            type="date"
            value={booksStartDate}
            onChange={(e) => setBooksStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Bentuk badan usaha
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800"
          >
            {Object.entries(ENTITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Profil pajak
          <select
            value={taxProfile}
            onChange={(e) => setTaxProfile(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800"
          >
            {Object.entries(TAX_PROFILE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

      <button
        onClick={run}
        disabled={busy}
        className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? 'Menyiapkan…' : 'Siapkan Bagan Akun & Aktifkan'}
      </button>
    </div>
  );
}

/* ── Kartu pengaturan umum ─────────────────────────────────────────────── */

function GeneralSettingsCard({ data, reload }: { data: SettingsResponse; reload: () => void }) {
  const setting = data.setting!;
  const { data: accounts } = useApiOnce<AccountDto[]>('/api/v1/accounting/accounts');
  const [form, setForm] = useState({
    booksStartDate: (setting.booksStartDate ?? '').slice(0, 10),
    entityType: setting.entityType,
    taxProfile: setting.taxProfile,
    fiscalYearStartMonth: String(setting.fiscalYearStartMonth),
    defaultCashAccountId: setting.defaultCashAccountId ?? '',
    defaultRevenueAccountId: setting.defaultRevenueAccountId ?? '',
    isEnabled: setting.isEnabled,
    enableInventory: setting.enableInventory,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const revenueAccounts = (accounts ?? []).filter((a) => a.isPostable && a.type === 'REVENUE');

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await apiSend('/api/v1/accounting/settings', 'PATCH', {
        ...form,
        fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
      });
      setMessage({ type: 'ok', text: 'Pengaturan tersimpan.' });
      reload();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Pengaturan Umum" subtitle={data.hasPostedJournals ? 'Ada jurnal posted — sebagian pengaturan terkunci.' : undefined}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Mulai pembukuan">
          <input
            type="date"
            value={form.booksStartDate}
            onChange={(e) => setForm({ ...form, booksStartDate: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Bentuk badan usaha">
          <select value={form.entityType} onChange={(e) => setForm({ ...form, entityType: e.target.value })} className="input">
            {Object.entries(ENTITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Profil pajak">
          <select value={form.taxProfile} onChange={(e) => setForm({ ...form, taxProfile: e.target.value })} className="input">
            {Object.entries(TAX_PROFILE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Bulan awal tahun fiskal">
          <select
            value={form.fiscalYearStartMonth}
            onChange={(e) => setForm({ ...form, fiscalYearStartMonth: e.target.value })}
            className="input"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rekening kas/bank default">
          <select
            value={form.defaultCashAccountId}
            onChange={(e) => setForm({ ...form, defaultCashAccountId: e.target.value })}
            className="input"
          >
            <option value="">— belum dipilih —</option>
            {data.cashAccounts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Akun pendapatan untuk faktur">
          <select
            value={form.defaultRevenueAccountId}
            onChange={(e) => setForm({ ...form, defaultRevenueAccountId: e.target.value })}
            className="input"
          >
            <option value="">— pakai Pendapatan Jasa —</option>
            {revenueAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <span className="mt-0.5 block text-[10px] text-slate-500">
            Dipakai saat faktur diterbitkan. Hanya memengaruhi faktur baru.
          </span>
        </Field>
        <Field label="Status modul">
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" checked={form.isEnabled} onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })} />
            Jurnal otomatis aktif untuk transaksi kas baru
          </label>
          <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={form.enableInventory}
              onChange={(e) => setForm({ ...form, enableInventory: e.target.checked })}
            />
            Aktifkan akun persediaan (untuk penjualan barang)
          </label>
        </Field>
      </div>

      {message && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={save}
        disabled={busy}
        className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? 'Menyimpan…' : 'Simpan Pengaturan'}
      </button>
    </Card>
  );
}

/* ── Kartu rekening kas/bank ───────────────────────────────────────────── */

function CashAccountsCard({ data, reload }: { data: SettingsResponse; reload: () => void }) {
  const { data: accounts } = useApiOnce<AccountDto[]>('/api/v1/accounting/accounts');
  const [form, setForm] = useState({ code: '', name: '', type: 'BANK', accountId: '', bankName: '', accountNumber: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const assetAccounts = (accounts ?? []).filter((a) => a.isPostable && a.type === 'ASSET');

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      await apiSend('/api/v1/accounting/cash-accounts', 'POST', form);
      setForm({ code: '', name: '', type: 'BANK', accountId: '', bankName: '', accountNumber: '' });
      setMessage({ type: 'ok', text: 'Rekening ditambahkan.' });
      reload();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Rekening Kas & Bank" subtitle="Nama dan nomor rekening di sini bebas diubah sesuai rekening asli perusahaan.">
      <table className="w-full border-collapse">
        <tbody>
          {data.cashAccounts.map((c) => (
            <tr key={c.id} className="border-b border-slate-50">
              <td className="py-1.5 text-xs text-slate-800">
                <span className="mr-2 font-mono text-[10px] text-slate-400">{c.code}</span>
                {c.name}
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">{c.type}</span>
                {!c.isActive && <span className="ml-2 text-[10px] font-medium text-red-600">nonaktif</span>}
              </td>
              <td className="py-1.5 text-xs text-slate-500">
                {c.bankName ?? '—'} {c.accountNumber ? `• ${c.accountNumber}` : ''}
              </td>
              <td className="py-1.5 text-right text-xs text-slate-500">
                <span className="font-mono text-[10px]">{c.account.code}</span> {c.account.name}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-3">
        <Field label="Kode">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="BANK-02" className="input" />
        </Field>
        <Field label="Nama rekening">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Bank Operasional" className="input" />
        </Field>
        <Field label="Tipe">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input">
            <option value="CASH">Kas / Tunai</option>
            <option value="BANK">Bank</option>
          </select>
        </Field>
        <Field label="Akun CoA">
          <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="input">
            <option value="">Pilih akun aset…</option>
            {assetAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nama bank">
          <input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="BCA" className="input" />
        </Field>
        <Field label="Nomor rekening">
          <input
            value={form.accountNumber}
            onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
            placeholder="1234567890"
            className="input"
          />
        </Field>
      </div>

      {message && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      <button
        onClick={add}
        disabled={busy || !form.code || !form.name || !form.accountId}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" /> Tambah rekening
      </button>
    </Card>
  );
}

/* ── Kartu pemetaan kategori ───────────────────────────────────────────── */

interface MappingItem {
  category: string;
  type: 'INCOME' | 'EXPENSE';
  transactionCount: number;
  accountId: string | null;
  suggestedAccountId: string | null;
  suggestedAccountCode: string | null;
}

function CategoryMappingCard() {
  const [rows, setRows] = useState<MappingItem[]>([]);
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ success: boolean; data: MappingItem[]; accounts: AccountDto[] }>(
        '/api/v1/accounting/category-mapping'
      );
      setRows(res.data ?? []);
      setAccounts(res.accounts ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      await apiSend('/api/v1/accounting/category-mapping', 'PUT', {
        mappings: rows.map((r) => ({ category: r.category, type: r.type, accountId: r.accountId })),
      });
      setMessage({ type: 'ok', text: 'Pemetaan kategori tersimpan.' });
      void load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  const optionsFor = (type: 'INCOME' | 'EXPENSE') =>
    accounts.filter((a) => a.isPostable && (type === 'INCOME' ? a.type === 'REVENUE' : a.type === 'EXPENSE'));

  return (
    <Card
      title="Pemetaan Kategori Transaksi Kas"
      subtitle="Setiap kategori pemasukan/pengeluaran harus punya akun agar transaksi kas otomatis terjurnal."
    >
      {loading && (
        <p className="flex items-center gap-2 py-6 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat kategori…
        </p>
      )}

      {!loading && rows.length === 0 && (
        <p className="py-4 text-xs text-slate-500">Belum ada kategori transaksi kas yang perlu dipetakan.</p>
      )}

      {!loading && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={`${row.type}-${row.category}`} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-4 text-xs text-slate-700">
                {row.category}
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                  {row.type === 'INCOME' ? 'masuk' : 'keluar'}
                </span>
              </div>
              <select
                value={row.accountId ?? ''}
                onChange={(e) =>
                  setRows((prev) => prev.map((r, i) => (i === index ? { ...r, accountId: e.target.value || null } : r)))
                }
                className="col-span-8 rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-800"
              >
                <option value="">— belum dipetakan —</option>
                {optionsFor(row.type).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              {!row.accountId && row.suggestedAccountId && (
                <p className="col-span-12 -mt-1 text-[10px] text-slate-400">
                  Saran: {row.suggestedAccountCode}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {message && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}

      {!loading && rows.length > 0 && (
        <button
          onClick={save}
          disabled={busy}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? 'Menyimpan…' : 'Simpan Pemetaan'}
        </button>
      )}
    </Card>
  );
}

/* ── Kartu periode ─────────────────────────────────────────────────────── */

function PeriodsCard({ canClose, canLock }: { canClose: boolean; canLock: boolean }) {
  const [periods, setPeriods] = useState<PeriodDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ success: boolean; data: PeriodDto[] }>('/api/v1/accounting/periods');
      setPeriods(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: 'close' | 'lock' | 'reopen' | 'close-year') {
    let body: unknown;
    if (action === 'reopen') {
      const reason = window.prompt('Alasan membuka kembali periode ini?');
      if (!reason?.trim()) return;
      body = { reason };
    }
    if (action === 'close-year') {
      const yakin = window.confirm(
        'Tutup tahun buku ini?\n\nSeluruh saldo pendapatan dan beban tahun buku akan dipindahkan ke akun Saldo Laba (3-2000), dan periode bulan terakhir akan ditutup. Laporan laba rugi tahun ini tetap menampilkan angka penuh.\n\nLanjutkan?'
      );
      if (!yakin) return;
    }
    setBusy(`${id}-${action}`);
    setMessage(null);
    try {
      const res = await apiSend<{ success: boolean; data: any }>(
        `/api/v1/accounting/periods/${id}/${action}`,
        'POST',
        body
      );
      if (action === 'close-year') {
        const profit = Number(res?.data?.profit ?? 0);
        const label = profit >= 0 ? 'Laba' : 'Rugi';
        setMessage({
          type: 'ok',
          text: `Tahun buku ditutup (${res?.data?.entryNumber}). ${label} tahun ini Rp ${Math.abs(profit).toLocaleString('id-ID')} dipindah ke Saldo Laba.`,
        });
      } else {
        setMessage({ type: 'ok', text: 'Status periode diperbarui.' });
      }
      void load();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(null);
    }
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  return (
    <Card
      title="Periode & Tutup Buku"
      subtitle="Tutup buku bila bulan sudah selesai. Di bulan terakhir tahun buku, pakai Tutup Tahun untuk memindahkan laba ke Saldo Laba. Kunci hanya untuk owner."
    >
      {loading && <p className="flex items-center gap-2 py-4 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat periode…</p>}
      {!loading && periods.length === 0 && <p className="py-3 text-xs text-slate-500">Belum ada periode. Periode dibuat otomatis saat jurnal pertama disimpan.</p>}

      {!loading && periods.length > 0 && (
        <div className="space-y-1.5">
          {periods.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
              <span className="text-xs font-medium text-slate-800">
                {MONTHS[p.month - 1]} {p.year}
              </span>
              <span className="text-[11px] text-slate-500">
                {p.entryCount} jurnal • {p.draftCount} draft
              </span>
              {p.fiscalYearClosed && (
                <span
                  className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700"
                  title={`Jurnal penutup: ${p.closingEntryNumber}`}
                >
                  Tahun buku ditutup
                </span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  p.status === 'OPEN'
                    ? 'bg-emerald-50 text-emerald-700'
                    : p.status === 'CLOSED'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {p.status}
              </span>
              <div className="flex gap-1.5">
                {canClose && p.status === 'OPEN' && (
                  <button
                    onClick={() => act(p.id, 'close')}
                    disabled={busy === `${p.id}-close`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <CheckCircle2 className="h-3 w-3" /> Tutup
                  </button>
                )}
                {canLock && p.status !== 'LOCKED' && (
                  <button
                    onClick={() => act(p.id, 'lock')}
                    disabled={busy === `${p.id}-lock`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Lock className="h-3 w-3" /> Kunci
                  </button>
                )}
                {canLock && p.status !== 'OPEN' && (
                  <button
                    onClick={() => act(p.id, 'reopen')}
                    disabled={busy === `${p.id}-reopen`}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Unlock className="h-3 w-3" /> Buka
                  </button>
                )}
                {canClose && p.month === p.fiscalYearEndMonth && !p.fiscalYearClosed && p.status !== 'LOCKED' && (
                  <button
                    onClick={() => act(p.id, 'close-year')}
                    disabled={busy === `${p.id}-close-year`}
                    title="Pindahkan saldo pendapatan & beban tahun buku ke Saldo Laba"
                    className="inline-flex items-center gap-1 rounded-md border border-indigo-300 bg-indigo-50 px-2 py-1 text-[10px] font-semibold text-indigo-700 hover:bg-indigo-100"
                  >
                    <CalendarCheck2 className="h-3 w-3" /> Tutup Tahun
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {message && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </p>
      )}
    </Card>
  );
}

/* ── Kartu bagan akun ──────────────────────────────────────────────────── */

function ChartOfAccountsCard({ canManage }: { canManage: boolean }) {
  const [accounts, setAccounts] = useState<AccountDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; account?: AccountDto } | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const load = React.useCallback(
    async (expandId?: string) => {
      setLoading(true);
      try {
        const res = await apiGet<{ success: boolean; data: AccountDto[] }>(
          `/api/v1/accounting/accounts?includeInactive=${showInactive}`
        );
        const data = res.data ?? [];
        setAccounts(data);
        setExpanded((prev) => {
          const next = new Set(prev);
          if (expandId) {
            /// Buka induk dari akun yang baru disimpan, supaya hasilnya langsung terlihat.
            const saved = data.find((a) => a.id === expandId);
            if (saved?.parentId) next.add(saved.parentId);
            next.add(expandId);
          }
          if (next.size === 0) {
            // Awal: buka akun tingkat atas saja (header/grup), sisanya bisa diklik.
            data.filter((a) => !a.parentId).forEach((a) => next.add(a.id));
          }
          return next;
        });
      } finally {
        setLoading(false);
      }
    },
    [showInactive]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [message]);

  const tree = useMemo(() => buildAccountTree(accounts), [accounts]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return flattenAccountTree(tree, (id) => expanded.has(id));
    }

    // Saat mencari, tampilkan akun yang cocok BESERTA induknya agar konteks
    // hierarki tidak hilang (mis. cari "Kas Kecil" tetap menampilkan "Kas").
    const matches = accounts.filter(
      (a) => a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
    );
    const keep = new Set(matches.map((a) => a.id));
    matches.forEach((m) => ancestorIds(accounts, m.id).forEach((id) => keep.add(id)));
    const subset = accounts.filter((a) => keep.has(a.id));
    return flattenAccountTree(buildAccountTree(subset), () => true);
  }, [tree, accounts, search, expanded]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function toggle(account: AccountDto) {
    setBusyId(account.id);
    try {
      await apiSend(`/api/v1/accounting/accounts/${account.id}`, 'PATCH', { isActive: !account.isActive });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal mengubah status akun.' });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(account: AccountDto) {
    if (!window.confirm(`Hapus akun ${account.code} ${account.name}? Akun yang sudah dipakai jurnal atau punya sub-akun tidak bisa dihapus.`)) {
      return;
    }
    setBusyId(account.id);
    try {
      await apiSend(`/api/v1/accounting/accounts/${account.id}`, 'DELETE');
      setMessage({ type: 'ok', text: `Akun ${account.code} ${account.name} dihapus.` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Gagal menghapus akun.' });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card
      title="Bagan Akun (Chart of Accounts)"
      subtitle="Klik panah untuk membuka sub-akun. Akun bertanda 'header' hanya pengelompokan dan tidak bisa dipakai di jurnal."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kode atau nama akun…"
          className="h-9 w-full max-w-xs rounded-lg border border-slate-300 px-3 text-xs text-slate-800"
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Tampilkan akun nonaktif
        </label>
        {canManage && (
          <button
            onClick={() => setEditing({ mode: 'create' })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah akun
          </button>
        )}
        <button
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
        </button>
      </div>

      {message && (
        <p
          className={`mb-3 rounded-lg px-3 py-2 text-xs font-medium ${
            message.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </p>
      )}

      {canManage && editing && (
        <AccountForm
          key={editing.account?.id ?? 'new'}
          mode={editing.mode}
          account={editing.account}
          accounts={accounts}
          onCancel={() => setEditing(null)}
          onSaved={async (text, accountId) => {
            setEditing(null);
            setMessage({ type: 'ok', text });
            await load(accountId);
          }}
        />
      )}

      {loading ? (
        <p className="flex items-center gap-2 py-4 text-xs text-slate-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat akun…
        </p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-500">Tidak ada akun yang cocok dengan pencarian.</p>
      ) : (
        <div className="max-h-[460px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-wide text-slate-400">
                <th className="py-1.5 text-left font-medium">Kode</th>
                <th className="py-1.5 text-left font-medium">Nama akun</th>
                <th className="py-1.5 text-right font-medium">Tipe</th>
                <th className="py-1.5 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ account: a, depth, hasChildren }) => {
                const isOpen = expanded.has(a.id);
                return (
                  <tr key={a.id} className={`border-b border-slate-50 hover:bg-slate-50/60 ${a.isActive ? '' : 'opacity-50'}`}>
                    <td className="py-1.5 align-middle">
                      <div className="flex items-center gap-1" style={{ paddingLeft: depth * 16 }}>
                        {hasChildren ? (
                          <button
                            onClick={() => toggleExpand(a.id)}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            aria-label={isOpen ? 'Tutup sub-akun' : 'Buka sub-akun'}
                          >
                            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          </button>
                        ) : (
                          <span className="inline-block h-4 w-4" />
                        )}
                        <span className="font-mono text-[11px] text-slate-500">{a.code}</span>
                      </div>
                    </td>
                    <td className="py-1.5 text-xs text-slate-800">
                      {a.name}
                      {!a.isPostable && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">header</span>
                      )}
                      {a.isSystem && (
                        <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">sistem</span>
                      )}
                      {!a.isActive && (
                        <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700">nonaktif</span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-[10px] uppercase text-slate-400">{a.type}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      {!canManage ? (
                        <span className="text-[10px] text-slate-400">—</span>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditing({ mode: 'edit', account: a })}
                            className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
                          >
                            Ubah
                          </button>
                          <button
                            onClick={() => void toggle(a)}
                            disabled={busyId === a.id}
                            className={`ml-1 rounded-md border px-2 py-1 text-[10px] font-medium disabled:opacity-40 ${
                              a.isActive
                                ? 'border-slate-300 text-slate-600 hover:bg-slate-50'
                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {a.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                          {!a.isSystem && (
                            <button
                              onClick={() => void remove(a)}
                              disabled={busyId === a.id}
                              className="ml-1 rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                            >
                              Hapus
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ── form tambah / ubah akun ───────────────────────────────────────────── */

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'ASSET', label: 'Aset' },
  { value: 'LIABILITY', label: 'Liabilitas' },
  { value: 'EQUITY', label: 'Ekuitas' },
  { value: 'REVENUE', label: 'Pendapatan' },
  { value: 'EXPENSE', label: 'Beban' },
];

function AccountForm({
  mode,
  account,
  accounts,
  onCancel,
  onSaved,
}: {
  mode: 'create' | 'edit';
  account?: AccountDto;
  accounts: AccountDto[];
  onCancel: () => void;
  onSaved: (message: string, accountId: string) => void | Promise<void>;
}) {
  const [code, setCode] = useState(account?.code ?? '');
  const [name, setName] = useState(account?.name ?? '');
  const [type, setType] = useState(account?.type ?? 'EXPENSE');
  const [normalBalance, setNormalBalance] = useState(account?.normalBalance ?? 'DEBIT');
  const [parentId, setParentId] = useState(account?.parentId ?? '');
  const [isPostable, setIsPostable] = useState(account ? account.isPostable : true);
  const [description, setDescription] = useState(account?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pilihan induk: hanya tipe yang sama, tanpa diri sendiri & turunannya.
  const parentOptions = useMemo(() => {
    const excluded = new Set<string>();
    if (account) {
      excluded.add(account.id);
      descendantIds(accounts, account.id).forEach((id) => excluded.add(id));
    }
    const sameType = accounts.filter((a) => a.type === type && !excluded.has(a.id));
    return flattenAccountTree(buildAccountTree(sameType), () => true);
  }, [accounts, type, account]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Nama akun wajib diisi.');
      return;
    }
    if (mode === 'create' && !code.trim()) {
      setError('Kode akun wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        parentId: parentId || null,
        isPostable,
        description,
      };
      if (mode === 'create') {
        payload.code = code.trim();
        payload.type = type;
        payload.normalBalance = normalBalance;
      }

      const res = await apiSend<{ success: boolean; data: AccountDto }>(
        mode === 'create' ? '/api/v1/accounting/accounts' : `/api/v1/accounting/accounts/${account!.id}`,
        mode === 'create' ? 'POST' : 'PATCH',
        payload
      );
      await onSaved(
        mode === 'create'
          ? `Akun ${res.data.code} ${res.data.name} dibuat.`
          : `Akun ${res.data.code} ${res.data.name} diperbarui.`,
        res.data.id
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan akun.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-700">
        {mode === 'create' ? 'Tambah akun baru' : `Ubah akun ${account?.code}`}
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-[11px] text-slate-600">
          Kode
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            disabled={mode === 'edit'}
            placeholder="6-9100"
            className="h-8 rounded-lg border border-slate-300 px-2 font-mono text-xs disabled:bg-slate-100 disabled:text-slate-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-600 sm:col-span-2">
          Nama akun
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Beban Perjalanan Dinas"
            className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
          />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-600">
          Tipe
          <select
            value={type}
            onChange={(e) => {
              const next = e.target.value;
              setType(next);
              setParentId('');
              if (mode === 'create') {
                setNormalBalance(next === 'ASSET' || next === 'EXPENSE' ? 'DEBIT' : 'CREDIT');
              }
            }}
            disabled={mode === 'edit'}
            className="h-8 rounded-lg border border-slate-300 px-2 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          >
            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-600">
          Saldo normal
          <select
            value={normalBalance}
            onChange={(e) => setNormalBalance(e.target.value)}
            disabled={mode === 'edit'}
            className="h-8 rounded-lg border border-slate-300 px-2 text-xs disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="DEBIT">Debit</option>
            <option value="CREDIT">Kredit</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-600 sm:col-span-2">
          Akun induk (opsional)
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
          >
            <option value="">— Tanpa induk (akun tingkat atas) —</option>
            {parentOptions.map(({ account: p, depth }) => (
              <option key={p.id} value={p.id}>
                {'\u00A0\u00A0'.repeat(depth)}
                {p.code} — {p.name}
                {p.isPostable ? '' : ' (header)'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-slate-600 sm:col-span-2">
          Deskripsi (opsional)
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 rounded-lg border border-slate-300 px-2 text-xs"
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
          <input type="checkbox" checked={!isPostable} onChange={(e) => setIsPostable(!e.target.checked)} />
          Akun header (hanya pengelompokan, tidak bisa dipakai di jurnal)
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-600 hover:bg-white"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>

      {mode === 'edit' && (
        <p className="mt-2 text-[10px] text-slate-500">
          Kode, tipe, dan saldo normal tidak bisa diubah karena sudah dirujuk jurnal. Buat akun baru bila perlu.
        </p>
      )}
      {error && <p className="mt-2 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-700">{error}</p>}
    </form>
  );
}

/* ── komponen kecil bersama ────────────────────────────────────────────── */

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-600">
      {label}
      <div className="mt-1 [&_.input]:w-full [&_.input]:rounded-lg [&_.input]:border [&_.input]:border-slate-300 [&_.input]:px-3 [&_.input]:py-2 [&_.input]:text-xs [&_.input]:text-slate-800">
        {children}
      </div>
    </label>
  );
}

/** Hook ringan tanpa reload nonce, untuk data referensi. */
function useApiOnce<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    if (!url) return;
    let alive = true;
    apiGet<{ success: boolean; data: T }>(url)
      .then((res) => {
        if (alive) setData(res.data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [url]);
  return { data };
}

/* ── komponen utama ───────────────────────────────────────────────────── */

export function AccountingSettingsView({
  canManageSettings,
  canManageAccounts,
  canLock,
}: {
  canManageSettings: boolean;
  canManageAccounts: boolean;
  canLock: boolean;
}) {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    apiGet<{ success: boolean; data: SettingsResponse }>('/api/v1/accounting/settings')
      .then((res) => {
        if (alive) setData(res.data);
      })
      .catch((err) => {
        if (alive) setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [nonce]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Memuat pengaturan…
      </div>
    );
  }

  if (error) {
    return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-6 text-sm text-red-700">{error}</p>;
  }

  if (!data?.setting || data.accountCount === 0) {
    return <SetupWizard onDone={reload} />;
  }

  return (
    <div className="space-y-4">
      <GeneralSettingsCard data={data} reload={reload} />
      <CashAccountsCard data={data} reload={reload} />
      <CategoryMappingCard />
      <PeriodsCard canClose={canManageSettings} canLock={canLock} />
      <ChartOfAccountsCard canManage={canManageAccounts} />
    </div>
  );
}
