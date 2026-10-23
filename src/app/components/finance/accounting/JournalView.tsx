'use client';

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Loader2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { apiSend, formatMoney, periodLabel } from './client';
import { ReportToolbar, useApi } from './ReportViews';
import { DIVISIONS, divisionLabel } from '@/lib/accounting/budget-divisions';

interface AccountDto {
  id: string;
  code: string;
  name: string;
  type: string;
  isPostable: boolean;
}

interface JournalLineDto {
  id: string;
  accountId: string;
  debit: string;
  credit: string;
  description: string | null;
  account: { code: string; name: string };
}

interface JournalDto {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  source: string;
  status: string;
  totalDebit: string;
  totalCredit: string;
  lines: JournalLineDto[];
}

interface DraftLine {
  accountId: string;
  debit: string;
  credit: string;
  description: string;
  costCenter: string;
  projectId: string;
}

interface ProjectOption {
  id: string;
  name: string;
  code: string | null;
  division: string | null;
  status: string;
}

const SOURCE_LABELS: Record<string, string> = {
  MANUAL: 'Manual',
  CASH_TX: 'Transaksi Kas',
  INVOICE: 'Faktur',
  INVOICE_PAYMENT: 'Pembayaran Faktur',
  OBLIGATION: 'Kewajiban',
  OBLIGATION_PAYMENT: 'Pembayaran Kewajiban',
  PAYROLL: 'Payroll',
  OPENING: 'Saldo Awal',
  ADJUSTMENT: 'Penyesuaian',
  CLOSING: 'Tutup Buku',
  REVERSAL: 'Pembalik',
  INVENTORY: 'Persediaan',
  ASSET_DEPRECIATION: 'Penyusutan Aset',
  ASSET_DISPOSAL: 'Pelepasan Aset',
  ASSET_IMPAIRMENT: 'Penurunan Nilai Aset',
};

const emptyLine = (): DraftLine => ({
  accountId: '',
  debit: '',
  credit: '',
  description: '',
  costCenter: '',
  projectId: '',
});

export function JournalView({
  period,
  onPeriodChange,
  comparative,
  onComparativeChange,
  canPost,
  canDraft,
}: {
  period: string;
  onPeriodChange: (v: string) => void;
  comparative: string;
  onComparativeChange: (v: string) => void;
  canPost: boolean;
  canDraft: boolean;
}) {
  const [statusFilter, setStatusFilter] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<JournalDto | null>(null);
  const [reverseReason, setReverseReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const query = `/api/v1/accounting/journals?period=${period}&limit=100${statusFilter ? `&status=${statusFilter}` : ''}`;
  const { data: journals, loading, error, reload } = useApi<JournalDto[]>(query);
  const { data: accounts } = useApi<AccountDto[]>('/api/v1/accounting/accounts');
  const { data: projects } = useApi<ProjectOption[]>('/api/v1/accounting/projects');

  const postableAccounts = useMemo(() => (accounts ?? []).filter((a) => a.isPostable), [accounts]);
  const activeProjects = useMemo(
    () => (projects ?? []).filter((project) => project.status !== 'ARCHIVED'),
    [projects]
  );

  async function handlePost(id: string) {
    setBusy(true);
    setMessage(null);
    try {
      await apiSend(`/api/v1/accounting/journals/${id}/post`, 'POST');
      setMessage({ type: 'ok', text: 'Jurnal berhasil diposting.' });
      reload();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Hapus jurnal draft ini?')) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiSend(`/api/v1/accounting/journals/${id}`, 'DELETE');
      setMessage({ type: 'ok', text: 'Jurnal draft dihapus.' });
      reload();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function submitReverse() {
    if (!reverseTarget) return;
    setBusy(true);
    setMessage(null);
    try {
      await apiSend(`/api/v1/accounting/journals/${reverseTarget.id}/reverse`, 'POST', { reason: reverseReason });
      setMessage({ type: 'ok', text: 'Jurnal pembalik berhasil dibuat.' });
      setReverseTarget(null);
      setReverseReason('');
      reload();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <ReportToolbar
        period={period}
        onPeriodChange={onPeriodChange}
        comparative={comparative}
        onComparativeChange={onComparativeChange}
        onRefresh={reload}
        loading={loading}
      />

      <div className="klir-no-print flex flex-wrap items-center gap-2">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700"
        >
          <option value="">Semua status</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
        </select>

        {canDraft && (
          <button
            onClick={() => setShowEditor(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-3.5 w-3.5" /> Jurnal Baru
          </button>
        )}
      </div>

      {message && (
        <div className={`rounded-lg px-3 py-2 text-xs font-medium ${message.type === 'ok' ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="klir-print-area rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Jurnal Umum — {periodLabel(period)}</h3>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat jurnal…
          </div>
        )}
        {!loading && error && <p className="px-4 py-10 text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">No Jurnal</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Tanggal</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Keterangan</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Sumber</th>
                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Debit</th>
                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-slate-500">Status</th>
                  <th className="klir-no-print px-3 py-2 text-right text-[10px] font-semibold uppercase text-slate-500">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {(journals ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                      Belum ada jurnal pada periode ini.
                    </td>
                  </tr>
                )}
                {(journals ?? []).map((j) => (
                  <React.Fragment key={j.id}>
                    <tr
                      className="cursor-pointer border-b border-slate-50 hover:bg-slate-50/60"
                      onClick={() => setExpanded(expanded === j.id ? null : j.id)}
                    >
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{j.entryNumber}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{j.entryDate.slice(0, 10)}</td>
                      <td className="px-3 py-2 text-xs text-slate-800">{j.description}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{SOURCE_LABELS[j.source] ?? j.source}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-800">{formatMoney(j.totalDebit)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            j.status === 'POSTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {j.status === 'POSTED' ? 'Posted' : 'Draft'}
                        </span>
                      </td>
                      <td className="klir-no-print px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {canPost && j.status === 'DRAFT' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePost(j.id);
                              }}
                              disabled={busy}
                              className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-100"
                            >
                              <CheckCircle2 className="mr-1 inline h-3 w-3" />
                              Posting
                            </button>
                          )}
                          {canPost && j.status === 'POSTED' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setReverseTarget(j);
                              }}
                              className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                            >
                              <RotateCcw className="mr-1 inline h-3 w-3" />
                              Balik
                            </button>
                          )}
                          {canDraft && j.status === 'DRAFT' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(j.id);
                              }}
                              className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expanded === j.id && (
                      <tr className="bg-slate-50/40">
                        <td colSpan={7} className="px-4 py-3">
                          <table className="w-full border-collapse">
                            <tbody>
                              {j.lines.map((l) => (
                                <tr key={l.id}>
                                  <td className="py-1 text-xs text-slate-600">
                                    <span className="mr-2 font-mono text-[10px] text-slate-400">{l.account.code}</span>
                                    {l.account.name}
                                    {l.description ? <span className="ml-2 text-slate-400">• {l.description}</span> : null}
                                  </td>
                                  <td className="w-32 py-1 text-right text-xs tabular-nums text-slate-700">
                                    {Number(l.debit) !== 0 ? formatMoney(l.debit) : ''}
                                  </td>
                                  <td className="w-32 py-1 text-right text-xs tabular-nums text-slate-700">
                                    {Number(l.credit) !== 0 ? formatMoney(l.credit) : ''}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEditor && (
        <JournalEditor
          accounts={postableAccounts}
          projects={activeProjects}
          onClose={() => setShowEditor(false)}
          onSaved={() => {
            setShowEditor(false);
            setMessage({ type: 'ok', text: 'Jurnal draft tersimpan. Posting bila sudah benar.' });
            reload();
          }}
        />
      )}

      {reverseTarget && (
        <Modal title="Balik Jurnal" onClose={() => setReverseTarget(null)}>
          <p className="text-xs text-slate-600">
            Jurnal <span className="font-mono">{reverseTarget.entryNumber}</span> akan dibalik. Jurnal asli tetap tersimpan sebagai
            jejak.
          </p>
          <textarea
            value={reverseReason}
            onChange={(e) => setReverseReason(e.target.value)}
            rows={3}
            placeholder="Alasan pembalikan (wajib)"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setReverseTarget(null)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
              Batal
            </button>
            <button
              onClick={submitReverse}
              disabled={busy || !reverseReason.trim()}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Memproses…' : 'Balik Jurnal'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="klir-no-print fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

function JournalEditor({
  accounts,
  projects,
  onClose,
  onSaved,
}: {
  accounts: AccountDto[];
  projects: ProjectOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const today = new Date();
  const [entryDate, setEntryDate] = useState(
    new Date(today.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDebit = lines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        entryDate,
        description: description || 'Jurnal manual',
        lines: lines
          .filter((l) => l.accountId && (Number(l.debit) > 0 || Number(l.credit) > 0))
          .map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.description || undefined,
            costCenter: l.costCenter || null,
            projectId: l.projectId || null,
          })),
      };
      await apiSend('/api/v1/accounting/journals', 'POST', payload);
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Jurnal Manual Baru" onClose={onClose}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-slate-600">
          Tanggal
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800"
          />
        </label>
        <label className="text-xs font-medium text-slate-600 sm:col-span-2">
          Keterangan
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="mis. Penyesuaian penyusutan November"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-800"
          />
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {lines.map((line, index) => (
          <div key={index} className="rounded-lg border border-slate-200 bg-slate-50/40 p-2">
            <div className="grid grid-cols-12 items-center gap-2">
              <select
                value={line.accountId}
                onChange={(e) => updateLine(index, { accountId: e.target.value })}
                className="col-span-5 rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-800"
              >
                <option value="">Pilih akun…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </select>
              <input
                value={line.debit}
                onChange={(e) => updateLine(index, { debit: e.target.value, credit: '' })}
                placeholder="Debit"
                inputMode="numeric"
                className="col-span-3 rounded-lg border border-slate-300 px-2 py-2 text-right text-xs tabular-nums text-slate-800"
              />
              <input
                value={line.credit}
                onChange={(e) => updateLine(index, { credit: e.target.value, debit: '' })}
                placeholder="Kredit"
                inputMode="numeric"
                className="col-span-3 rounded-lg border border-slate-300 px-2 py-2 text-right text-xs tabular-nums text-slate-800"
              />
              <button
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                disabled={lines.length <= 2}
                className="col-span-1 rounded-lg border border-slate-200 py-2 text-slate-400 hover:bg-slate-50 disabled:opacity-30"
              >
                <X className="mx-auto h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-12 gap-2">
              <input
                value={line.description}
                onChange={(e) => updateLine(index, { description: e.target.value })}
                placeholder="Keterangan baris (opsional)"
                className="col-span-12 rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-800 sm:col-span-4"
              />
              <select
                value={line.costCenter}
                onChange={(e) => updateLine(index, { costCenter: e.target.value })}
                title="Divisi pemilik baris ini. Kosong = Tanpa Divisi."
                className="col-span-6 rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-800 sm:col-span-3"
              >
                <option value="">Tanpa Divisi</option>
                {DIVISIONS.map((value) => (
                  <option key={value} value={value}>{divisionLabel(value)}</option>
                ))}
              </select>
              <select
                value={line.projectId}
                onChange={(e) => {
                  const id = e.target.value;
                  const project = projects.find((item) => item.id === id);
                  updateLine(index, {
                    projectId: id,
                    ...(project?.division ? { costCenter: project.division } : {}),
                  });
                }}
                title="Proyek pemilik baris ini. Kosong = Tanpa Proyek."
                className="col-span-6 rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-800 sm:col-span-3"
              >
                <option value="">Tanpa Proyek</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code ? `${project.code} · ` : ''}{project.name}
                  </option>
                ))}
              </select>
              <span className="col-span-12 self-center text-[10px] text-slate-400 sm:col-span-2">
                Laba per unit bisnis
              </span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setLines((prev) => [...prev, emptyLine()])}
        className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
      >
        <Plus className="h-3.5 w-3.5" /> Tambah baris
      </button>

      <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
        <span className="text-slate-600">Debit {formatMoney(totalDebit)} • Kredit {formatMoney(totalCredit)}</span>
        <span className={balanced ? 'font-semibold text-emerald-700' : 'font-semibold text-red-600'}>
          {balanced ? 'Balance' : `Selisih ${formatMoney(totalDebit - totalCredit)}`}
        </span>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700">
          Batal
        </button>
        <button
          onClick={save}
          disabled={busy || !balanced}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Menyimpan…' : 'Simpan sebagai Draft'}
        </button>
      </div>
    </Modal>
  );
}
