'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Info,
  Loader2,
  RefreshCw,
  Search,
  Send,
  Wallet,
} from 'lucide-react';
import { apiGet, apiSend, formatMoney } from './client';
import { ReportShell, useApi } from './ReportViews';

/**
 * Pengelolaan Utang & Piutang (AR/AP): jadwal pembayaran vendor, riwayat
 * penagihan pelanggan, dan penyeliaan tagihan jatuh tempo.
 *
 * Sumber data:
 *  - /api/v1/kas/payment-schedule     (jadwal AP + proyeksi kas)
 *  - /api/v1/kas/collection-activities (riwayat penagihan, GET/POST)
 *  - /api/v1/kas/overdue-watchlist    (pemantauan jatuh tempo)
 *  - /api/v1/kas/invoices             (pemilih faktur untuk penagihan)
 *  - /api/v1/kas/transactions         (pembayaran sebagian/pelunasan -> alokasi)
 *  - /api/v1/kas/overdue-sweep        (job penuaan manual)
 */

type Tab = 'schedule' | 'collections' | 'overdue';

const TABS: Array<{ id: Tab; label: string; hint: string }> = [
  { id: 'schedule', label: 'Jadwal Pembayaran', hint: 'Tagihan utang ke vendor & proyeksi arus kas.' },
  { id: 'collections', label: 'Riwayat Penagihan', hint: 'Jejak penagihan piutang ke pelanggan.' },
  { id: 'overdue', label: 'Jatuh Tempo', hint: 'Tagihan AR & AP yang sudah lewat jatuh tempo.' },
];

const BUCKET_LABELS: Record<string, string> = {
  current: 'Belum jatuh tempo',
  d1_30: '1–30 hari',
  d31_60: '31–60 hari',
  d61_90: '61–90 hari',
  d90_plus: '> 90 hari',
};

const today = () => new Date().toISOString().slice(0, 10);

function timingText(daysUntilDue: number, daysOverdue: number): { text: string; className: string } {
  if (daysOverdue > 0) return { text: `Telat ${daysOverdue} hari`, className: 'text-red-600 font-medium' };
  if (daysUntilDue === 0) return { text: 'Jatuh tempo hari ini', className: 'text-amber-600 font-medium' };
  if (daysUntilDue <= 7) return { text: `Jatuh dalam ${daysUntilDue} hari`, className: 'text-amber-600' };
  return { text: `Jatuh dalam ${daysUntilDue} hari`, className: 'text-slate-500' };
}

function DunningBadge({ tone, label }: { tone: string; label: string }) {
  const palette: Record<string, string> = {
    soft: 'bg-slate-100 text-slate-600',
    normal: 'bg-amber-100 text-amber-700',
    firm: 'bg-orange-100 text-orange-700',
    legal: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${palette[tone] ?? palette.soft}`}>
      {label}
    </span>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2">
      <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-52 bg-transparent text-xs text-slate-700 outline-none"
      />
    </label>
  );
}

/* ── Overlay generik ─────────────────────────────────────────────────────── */

function Overlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <p className="mb-3 text-sm font-semibold text-slate-800">{title}</p>
        {children}
      </div>
    </div>
  );
}

/* ── Modal pembayaran (sebagian / pelunasan) ─────────────────────────────── */

function PaymentModal({
  kind,
  docId,
  reference,
  partner,
  outstanding,
  onClose,
  onDone,
}: {
  kind: 'AR' | 'AP';
  docId: string;
  reference: string;
  partner: string;
  outstanding: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(outstanding);
  const [method, setMethod] = useState('TRANSFER_BANK');
  const [date, setDate] = useState(today());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = Number(outstanding) || 0;
  const nominal = Number(String(amount).replace(/[^0-9.-]/g, '')) || 0;
  const afterPayment = Math.max(0, remaining - nominal);
  const exceeds = nominal > remaining + 0.005;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!Number.isFinite(nominal) || nominal <= 0) throw new Error('Nominal harus lebih besar dari 0.');
      if (exceeds) throw new Error(`Nominal melebihi sisa tagihan (${formatMoney(outstanding)}).`);
      await apiSend('/api/v1/kas/transactions', 'POST', {
        type: kind === 'AR' ? 'INCOME' : 'EXPENSE',
        category: kind === 'AR' ? 'Pelunasan Piutang' : 'Pembayaran Utang',
        amount: nominal,
        description: `${kind === 'AR' ? 'Pelunasan' : 'Pembayaran'} ${reference}`,
        paymentMethod: method,
        transactionDate: new Date(`${date}T12:00:00+07:00`).toISOString(),
        allocations: [
          kind === 'AR' ? { invoiceId: docId, amount: nominal } : { obligationId: docId, amount: nominal },
        ],
      });
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Pembayaran gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} title={`${kind === 'AR' ? 'Terima pembayaran' : 'Bayar'} — ${reference}`}>
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Pihak</span>
            <strong className="text-slate-700">{partner}</strong>
          </div>
          <div className="mt-1 flex justify-between">
            <span>Sisa tagihan</span>
            <strong className="text-slate-700">{formatMoney(outstanding)}</strong>
          </div>
        </div>
        <label className="block text-xs font-medium text-slate-600">
          Nominal dibayar
          <input
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`mt-1 h-9 w-full rounded-lg border px-2 text-sm text-slate-800 ${exceeds ? 'border-red-400' : 'border-slate-300'}`}
          />
        </label>
        <button
          type="button"
          onClick={() => setAmount(outstanding)}
          className="text-[11px] font-medium text-emerald-700 hover:underline"
        >
          Isi lunas (seluruh sisa)
        </button>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-600">
            Metode
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-800">
              <option value="TRANSFER_BANK">Transfer Bank</option>
              <option value="CASH">Tunai</option>
              <option value="QRIS">QRIS</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Tanggal
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm text-slate-800" />
          </label>
        </div>
        <p className={`rounded-lg px-3 py-2 text-xs ${afterPayment <= 0.005 && nominal > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-600'}`}>
          {nominal <= 0
            ? 'Masukkan nominal pembayaran.'
            : afterPayment <= 0.005
              ? 'Pembayaran ini akan melunasi tagihan (status: PAID).'
              : `Pembayaran sebagian — sisa setelah ini ${formatMoney(afterPayment)}.`}
        </p>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-600">
            Batal
          </button>
          <button
            onClick={submit}
            disabled={busy || exceeds || nominal <= 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan pembayaran
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ── Modal catat penagihan ───────────────────────────────────────────────── */

function CollectionModal({
  invoiceId,
  reference,
  partner,
  onClose,
  onDone,
}: {
  invoiceId: string;
  reference: string;
  partner: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [channel, setChannel] = useState('WHATSAPP');
  const [outcome, setOutcome] = useState('SENT');
  const [tone, setTone] = useState('normal');
  const [note, setNote] = useState('');
  const [promisedAt, setPromisedAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await apiSend('/api/v1/kas/collection-activities', 'POST', {
        invoiceId,
        channel,
        outcome,
        tone,
        note: note || undefined,
        promisedAt: outcome === 'PROMISED_PAYMENT' && promisedAt ? promisedAt : undefined,
      });
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan penagihan.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay onClose={onClose} title={`Catat penagihan — ${reference}`}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">{partner}</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-slate-600">
            Kanal
            <select value={channel} onChange={(e) => setChannel(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm">
              <option value="WHATSAPP">WhatsApp</option>
              <option value="EMAIL">Email</option>
              <option value="PHONE">Telepon</option>
              <option value="VISIT">Kunjungan</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Hasil
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm">
              <option value="SENT">Terkirim</option>
              <option value="PROMISED_PAYMENT">Janji bayar</option>
              <option value="PAID">Dibayar</option>
              <option value="DISPUTED">Disanggah</option>
              <option value="NO_RESPONSE">Tidak ada respons</option>
            </select>
          </label>
        </div>
        <label className="block text-xs font-medium text-slate-600">
          Nada penagihan
          <select value={tone} onChange={(e) => setTone(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm">
            <option value="soft">Lembut</option>
            <option value="normal">Normal</option>
            <option value="firm">Tegas</option>
            <option value="legal">Eskalasi / resmi</option>
          </select>
        </label>
        {outcome === 'PROMISED_PAYMENT' && (
          <label className="block text-xs font-medium text-slate-600">
            Tanggal janji bayar
            <input type="date" value={promisedAt} onChange={(e) => setPromisedAt(e.target.value)} className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm" />
          </label>
        )}
        <label className="block text-xs font-medium text-slate-600">
          Catatan
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
        </label>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-600">
            Batal
          </button>
          <button onClick={submit} disabled={busy} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-60">
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Simpan
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/* ── Pemilih faktur untuk penagihan ──────────────────────────────────────── */

interface OpenInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
}

function PickInvoiceModal({
  onPick,
  onClose,
}: {
  onPick: (inv: OpenInvoice) => void;
  onClose: () => void;
}) {
  const [invoices, setInvoices] = useState<OpenInvoice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    apiGet<{ invoices: OpenInvoice[] }>('/api/v1/kas/invoices')
      .then((res) => {
        if (!alive) return;
        setInvoices(
          (res.invoices || []).filter(
            (i) => i.status === 'UNPAID' || i.status === 'OVERDUE' || i.status === 'PARTIAL'
          )
        );
      })
      .catch((err) => alive && setError(err?.message || 'Gagal memuat daftar faktur.'));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!invoices) return [];
    const term = q.trim().toLowerCase();
    if (!term) return invoices;
    return invoices.filter(
      (i) => i.invoiceNumber.toLowerCase().includes(term) || i.clientName.toLowerCase().includes(term)
    );
  }, [invoices, q]);

  return (
    <Overlay onClose={onClose} title="Pilih faktur yang ditagih">
      <div className="space-y-2">
        <SearchBox value={q} onChange={setQ} placeholder="Cari no. faktur / pelanggan" />
        {!invoices && !error && (
          <p className="flex items-center gap-2 py-4 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Memuat faktur…
          </p>
        )}
        {error && <p className="py-2 text-xs text-red-600">{error}</p>}
        {invoices && filtered.length === 0 && (
          <p className="py-4 text-center text-xs text-slate-500">Tidak ada faktur terbuka.</p>
        )}
        <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
          {filtered.map((inv) => {
            const remaining = Math.max(0, (Number(inv.totalAmount) || 0) - (Number(inv.paidAmount) || 0));
            return (
              <button
                key={inv.id}
                onClick={() => onPick(inv)}
                className="flex w-full items-center justify-between gap-3 px-1 py-2 text-left hover:bg-slate-50"
              >
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-slate-800">{inv.invoiceNumber}</span>
                  <span className="block truncate text-[11px] text-slate-500">{inv.clientName}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-slate-700">{formatMoney(remaining)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Overlay>
  );
}

/* ── Tab: Jadwal Pembayaran ──────────────────────────────────────────────── */

interface ScheduleData {
  asOf: string;
  horizonDays: number;
  bills: Array<{
    id: string;
    reference: string;
    name: string;
    billNumber: string | null;
    refNumber: string | null;
    partnerId: string | null;
    partner: string;
    dueDate: string;
    daysUntilDue: number;
    daysOverdue: number;
    outstanding: string;
    bucket: string;
    dunning: { level: number; tone: string; label: string };
  }>;
  totalPayable: string;
  overduePayable: string;
  dueWithinHorizon: string;
  forecast: {
    inflowTotal: string;
    outflowTotal: string;
    netTotal: string;
    buckets: Array<{ key: string; label: string; inflow: string; outflow: string; net: string }>;
  };
}

function ScheduleTab({ canManage }: { canManage: boolean }) {
  const [asOf, setAsOf] = useState(today());
  const [horizon, setHorizon] = useState(30);
  const [q, setQ] = useState('');
  const [pay, setPay] = useState<ScheduleData['bills'][number] | null>(null);
  const { data, loading, error, reload } = useApi<ScheduleData>(
    `/api/v1/kas/payment-schedule?asOf=${asOf}&horizon=${horizon}`
  );

  const bills = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    if (!term) return data.bills;
    return data.bills.filter((b) =>
      [b.name, b.partner, b.billNumber, b.refNumber].filter(Boolean).some((v) => String(v).toLowerCase().includes(term))
    );
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="klir-no-print flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
          Per tanggal
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700" />
        </label>
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
          Horizon (hari)
          <input type="number" min={1} max={365} value={horizon} onChange={(e) => setHorizon(Number(e.target.value) || 30)} className="h-9 w-20 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700" />
        </label>
        <SearchBox value={q} onChange={setQ} placeholder="Cari vendor / tagihan" />
        <button onClick={reload} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Muat ulang
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Kpi label="Total utang terbuka" value={formatMoney(data.totalPayable)} tone="slate" />
          <Kpi label="Sudah jatuh tempo" value={formatMoney(data.overduePayable)} tone="red" />
          <Kpi label={`Jatuh dalam ${data.horizonDays} hari`} value={formatMoney(data.dueWithinHorizon)} tone="amber" />
          <Kpi label="Proyeksi kas bersih" value={formatMoney(data.forecast.netTotal)} tone={Number(data.forecast.netTotal) >= 0 ? 'emerald' : 'red'} />
        </div>
      )}

      <ReportShell
        title="Jadwal Pembayaran Vendor"
        subtitle={`Per tanggal ${asOf} · ${bills.length} tagihan`}
        loading={loading}
        error={error}
        onRetry={reload}
      >
        {data && (
          <>
            <div className="border-b border-slate-100 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Proyeksi arus kas (piutang masuk vs utang keluar)
              </p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="pb-1 text-left text-[10px] font-semibold uppercase text-slate-500">Periode</th>
                    <th className="pb-1 text-right text-[10px] font-semibold uppercase text-slate-500">Masuk (AR)</th>
                    <th className="pb-1 text-right text-[10px] font-semibold uppercase text-slate-500">Keluar (AP)</th>
                    <th className="pb-1 text-right text-[10px] font-semibold uppercase text-slate-500">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {data.forecast.buckets.map((b) => (
                    <tr key={b.key} className="border-b border-slate-50">
                      <td className="py-1 text-xs text-slate-600">{b.label}</td>
                      <td className="py-1 text-right text-xs tabular-nums text-emerald-700">{formatMoney(b.inflow)}</td>
                      <td className="py-1 text-right text-xs tabular-nums text-red-600">{formatMoney(b.outflow)}</td>
                      <td className="py-1 text-right text-xs font-medium tabular-nums text-slate-800">{formatMoney(b.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="pl-3 pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Tagihan</th>
                  <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">No. Tagihan</th>
                  <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Vendor</th>
                  <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Jatuh tempo</th>
                  <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Umur</th>
                  <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Tingkat</th>
                  <th className="pb-1.5 pt-2 text-right text-[10px] font-semibold uppercase text-slate-500">Sisa</th>
                  <th className="pr-3 pb-1.5 pt-2 text-right text-[10px] font-semibold uppercase text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-xs text-slate-500">
                      {q ? 'Tidak ada tagihan yang cocok dengan pencarian.' : 'Tidak ada tagihan utang terbuka.'}
                    </td>
                  </tr>
                )}
                {bills.map((b) => {
                  const timing = timingText(b.daysUntilDue, b.daysOverdue);
                  return (
                    <tr key={b.id} className="border-b border-slate-50">
                      <td className="py-1.5 pl-3 text-xs font-medium text-slate-800">{b.name}</td>
                      <td className="py-1.5 text-xs text-slate-600">{b.billNumber ?? b.refNumber ?? '-'}</td>
                      <td className="py-1.5 text-xs text-slate-600">{b.partner}</td>
                      <td className="py-1.5 text-xs text-slate-600">
                        <span className="block">{new Date(b.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        <span className={`block text-[10px] ${timing.className}`}>{timing.text}</span>
                      </td>
                      <td className="py-1.5 text-xs text-slate-600">{BUCKET_LABELS[b.bucket] ?? b.bucket}</td>
                      <td className="py-1.5 text-xs">
                        <DunningBadge tone={b.dunning.tone} label={b.dunning.label} />
                      </td>
                      <td className="py-1.5 text-right text-xs font-medium tabular-nums text-slate-900">{formatMoney(b.outstanding)}</td>
                      <td className="py-1.5 pr-3 text-right">
                        {canManage && (
                          <button
                            onClick={() => setPay(b)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                          >
                            <Wallet className="h-3 w-3" /> Bayar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </ReportShell>

      {pay && (
        <PaymentModal
          kind="AP"
          docId={pay.id}
          reference={pay.billNumber ?? pay.name}
          partner={pay.partner}
          outstanding={pay.outstanding}
          onClose={() => setPay(null)}
          onDone={() => {
            setPay(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ── Tab: Jatuh Tempo ────────────────────────────────────────────────────── */

interface WatchlistData {
  asOf: string;
  items: Array<{
    kind: 'AR' | 'AP';
    id: string;
    reference: string;
    partnerId: string | null;
    partner: string;
    dueDate: string;
    daysOverdue: number;
    outstanding: string;
    bucket: string;
    dunning: { level: number; tone: string; label: string };
    lastReminderAt: string | null;
  }>;
  totalReceivableOverdue: string;
  totalPayableOverdue: string;
  count: number;
}

function OverdueTab({ canManage }: { canManage: boolean }) {
  const [asOf, setAsOf] = useState(today());
  const [q, setQ] = useState('');
  const [kindFilter, setKindFilter] = useState<'ALL' | 'AR' | 'AP'>('ALL');
  const { data, loading, error, reload } = useApi<WatchlistData>(`/api/v1/kas/overdue-watchlist?asOf=${asOf}`);
  const [collect, setCollect] = useState<WatchlistData['items'][number] | null>(null);
  const [pay, setPay] = useState<WatchlistData['items'][number] | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepMsg, setSweepMsg] = useState<string | null>(null);

  async function runSweep() {
    setSweeping(true);
    setSweepMsg(null);
    try {
      const res = await apiSend<{ data: { markedOverdue: number; invoicesUpdated: number } }>(
        '/api/v1/kas/overdue-sweep',
        'POST',
        {}
      );
      setSweepMsg(`Penuaan selesai: ${res.data.invoicesUpdated} faktur diperiksa, ${res.data.markedOverdue} ditandai jatuh tempo.`);
      reload();
    } catch (err: any) {
      setSweepMsg(err?.message || 'Gagal menjalankan penuaan.');
    } finally {
      setSweeping(false);
    }
  }

  const items = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.items.filter((i) => {
      if (kindFilter !== 'ALL' && i.kind !== kindFilter) return false;
      if (!term) return true;
      return i.reference.toLowerCase().includes(term) || i.partner.toLowerCase().includes(term);
    });
  }, [data, q, kindFilter]);

  return (
    <div className="space-y-4">
      <div className="klir-no-print flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
          Per tanggal
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700" />
        </label>
        <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
          {(['ALL', 'AR', 'AP'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKindFilter(k)}
              className={`px-3 py-2 text-xs font-semibold ${kindFilter === k ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {k === 'ALL' ? 'Semua' : k === 'AR' ? 'Piutang' : 'Utang'}
            </button>
          ))}
        </div>
        <SearchBox value={q} onChange={setQ} placeholder="Cari dokumen / pihak" />
        <button onClick={reload} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Muat ulang
        </button>
        {canManage && (
          <button onClick={runSweep} disabled={sweeping} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-800 px-3 text-xs font-semibold text-white disabled:opacity-60">
            {sweeping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            Hitung ulang penuaan
          </button>
        )}
      </div>

      {sweepMsg && <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{sweepMsg}</p>}

      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kpi label="Piutang terlambat" value={formatMoney(data.totalReceivableOverdue)} tone="red" />
          <Kpi label="Utang terlambat" value={formatMoney(data.totalPayableOverdue)} tone="amber" />
          <Kpi label="Jumlah tagihan" value={`${data.count} dokumen`} tone="slate" />
        </div>
      )}

      <ReportShell
        title="Tagihan Jatuh Tempo & Terlambat"
        subtitle={`Per tanggal ${asOf} · diurut risiko (nominal × umur)`}
        loading={loading}
        error={error}
        onRetry={reload}
      >
        {data && (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="pl-3 pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Jenis</th>
                <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Dokumen</th>
                <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Pihak</th>
                <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Jatuh tempo</th>
                <th className="pb-1.5 pt-2 text-right text-[10px] font-semibold uppercase text-slate-500">Terlambat</th>
                <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Tingkat</th>
                <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Penagihan terakhir</th>
                <th className="pb-1.5 pt-2 text-right text-[10px] font-semibold uppercase text-slate-500">Nilai</th>
                <th className="pr-3 pb-1.5 pt-2 text-right text-[10px] font-semibold uppercase text-slate-500">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-xs text-slate-500">
                    {q || kindFilter !== 'ALL'
                      ? 'Tidak ada tagihan yang cocok dengan filter.'
                      : 'Bagus — tidak ada tagihan lewat jatuh tempo.'}
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={`${item.kind}-${item.id}`} className="border-b border-slate-50">
                  <td className="py-1.5 pl-3 text-xs">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.kind === 'AR' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {item.kind === 'AR' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                      {item.kind === 'AR' ? 'Piutang' : 'Utang'}
                    </span>
                  </td>
                  <td className="py-1.5 text-xs font-medium text-slate-800">{item.reference}</td>
                  <td className="py-1.5 text-xs text-slate-600">{item.partner}</td>
                  <td className="py-1.5 text-xs text-slate-600">
                    {new Date(item.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-1.5 text-right text-xs tabular-nums text-red-600">{item.daysOverdue} hari</td>
                  <td className="py-1.5 text-xs"><DunningBadge tone={item.dunning.tone} label={item.dunning.label} /></td>
                  <td className="py-1.5 text-xs text-slate-500">
                    {item.lastReminderAt
                      ? new Date(item.lastReminderAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                      : 'Belum pernah'}
                  </td>
                  <td className="py-1.5 text-right text-xs font-medium tabular-nums text-slate-900">{formatMoney(item.outstanding)}</td>
                  <td className="py-1.5 pr-3 text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        {item.kind === 'AR' && (
                          <button onClick={() => setCollect(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                            <Send className="h-3 w-3" /> Tagih
                          </button>
                        )}
                        <button onClick={() => setPay(item)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                          <Wallet className="h-3 w-3" /> {item.kind === 'AR' ? 'Terima' : 'Bayar'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ReportShell>

      {collect && (
        <CollectionModal
          invoiceId={collect.id}
          reference={collect.reference}
          partner={collect.partner}
          onClose={() => setCollect(null)}
          onDone={() => {
            setCollect(null);
            reload();
          }}
        />
      )}
      {pay && (
        <PaymentModal
          kind={pay.kind}
          docId={pay.id}
          reference={pay.reference}
          partner={pay.partner}
          outstanding={pay.outstanding}
          onClose={() => setPay(null)}
          onDone={() => {
            setPay(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ── Tab: Riwayat Penagihan ──────────────────────────────────────────────── */

interface ActivityRow {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  partner: string;
  channel: string;
  outcome: string;
  tone: string | null;
  note: string | null;
  amountAtRisk: string | null;
  promisedAt: string | null;
  activityDate: string;
}

function outcomeLabel(outcome: string): string {
  const map: Record<string, string> = {
    SENT: 'Terkirim',
    PROMISED_PAYMENT: 'Janji bayar',
    PAID: 'Dibayar',
    DISPUTED: 'Disanggah',
    NO_RESPONSE: 'Tidak ada respons',
    DRAFT: 'Draft',
  };
  return map[outcome] ?? outcome;
}

function CollectionsTab({ canManage }: { canManage: boolean }) {
  const [q, setQ] = useState('');
  const { data, loading, error, reload } = useApi<ActivityRow[]>(`/api/v1/kas/collection-activities?limit=200`);
  const [picking, setPicking] = useState(false);
  const [collect, setCollect] = useState<OpenInvoice | null>(null);

  const rows = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    const term = q.trim().toLowerCase();
    if (!term) return list;
    return list.filter(
      (r) =>
        r.partner.toLowerCase().includes(term) ||
        (r.invoiceNumber ?? '').toLowerCase().includes(term) ||
        outcomeLabel(r.outcome).toLowerCase().includes(term)
    );
  }, [data, q]);

  return (
    <div className="space-y-4">
      <div className="klir-no-print flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Cari pelanggan / faktur / hasil" />
        <button onClick={reload} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Muat ulang
        </button>
        {canManage && (
          <button onClick={() => setPicking(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white">
            <Send className="h-3.5 w-3.5" /> Catat penagihan
          </button>
        )}
      </div>

      <ReportShell title="Riwayat Penagihan Pelanggan" subtitle={`${rows.length} aktivitas · terbaru dahulu`} loading={loading} error={error} onRetry={reload}>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="pl-3 pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Tanggal</th>
              <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Pelanggan</th>
              <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Faktur</th>
              <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Kanal</th>
              <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Hasil</th>
              <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Nada</th>
              <th className="pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Janji bayar</th>
              <th className="pb-1.5 pt-2 text-right text-[10px] font-semibold uppercase text-slate-500">Nilai</th>
              <th className="pr-3 pb-1.5 pt-2 text-left text-[10px] font-semibold uppercase text-slate-500">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-xs text-slate-500">
                  {q ? 'Tidak ada aktivitas yang cocok.' : 'Belum ada aktivitas penagihan.'}
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-50">
                <td className="py-1.5 pl-3 text-xs text-slate-600">
                  {new Date(r.activityDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
                </td>
                <td className="py-1.5 text-xs font-medium text-slate-800">{r.partner}</td>
                <td className="py-1.5 text-xs text-slate-600">{r.invoiceNumber ?? '-'}</td>
                <td className="py-1.5 text-xs text-slate-600">{r.channel}</td>
                <td className="py-1.5 text-xs text-slate-600">{outcomeLabel(r.outcome)}</td>
                <td className="py-1.5 text-xs text-slate-600">{r.tone ?? '-'}</td>
                <td className="py-1.5 text-xs text-slate-600">
                  {r.promisedAt ? new Date(r.promisedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                </td>
                <td className="py-1.5 text-right text-xs tabular-nums text-slate-800">{r.amountAtRisk ? formatMoney(r.amountAtRisk) : '-'}</td>
                <td className="py-1.5 pr-3 text-xs text-slate-500">{r.note ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ReportShell>

      {picking && (
        <PickInvoiceModal
          onClose={() => setPicking(false)}
          onPick={(inv) => {
            setPicking(false);
            setCollect(inv);
          }}
        />
      )}
      {collect && (
        <CollectionModal
          invoiceId={collect.id}
          reference={collect.invoiceNumber}
          partner={collect.clientName}
          onClose={() => setCollect(null)}
          onDone={() => {
            setCollect(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

/* ── Shell utama ─────────────────────────────────────────────────────────── */

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'red' | 'amber' | 'slate' }) {
  const palette: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${palette[tone]}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular-nums">{value}</p>
    </div>
  );
}

export default function ArApView({ canManage = false }: { canManage?: boolean }) {
  const [tab, setTab] = useState<Tab>('schedule');
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div className="space-y-4">
      <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold ${tab === t.id ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <Info className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        {active.hint}
      </p>

      {tab === 'schedule' && <ScheduleTab canManage={canManage} />}
      {tab === 'collections' && <CollectionsTab canManage={canManage} />}
      {tab === 'overdue' && <OverdueTab canManage={canManage} />}
    </div>
  );
}
