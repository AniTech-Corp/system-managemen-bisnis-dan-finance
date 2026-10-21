'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CheckCircle2, Loader2, Plus, ReceiptText, Save, Users } from 'lucide-react';
import { apiGet, apiSend, formatMoney } from './client';
import { computePayroll } from '@/lib/accounting/payroll';

/**
 * Gaji & Pajak: slip gaji (akrual), pembayaran gaji, dan setoran PPh 21/BPJS.
 *
 * PPh 21 & BPJS TIDAK dihitung otomatis — diisi manual dari aplikasi payroll
 * resmi. Sistem hanya memastikan jurnalnya benar:
 *
 *   Saat slip:  Dr Beban Gaji (bruto + BPJS pemberi kerja)
 *               Cr Utang Gaji (bersih), Cr PPh 21, Cr Utang BPJS, Cr Potongan lain
 *   Saat bayar: Dr Utang Gaji / Cr Kas
 *   Saat setor: Dr PPh 21 atau Utang BPJS / Cr Kas
 */

interface PayrollRow {
  id: string;
  employeeName: string;
  role: string;
  basicSalary: number;
  allowance: number;
  overtime: number;
  deductions: number;
  pph21: number;
  bpjsEmployee: number;
  bpjsEmployer: number;
  otherDeductions: number;
  netSalary: number;
  monthYear: string;
  isPaid: boolean;
  paidAt: string | null;
}

interface PayrollListResponse {
  summary: {
    totalPayrolls: number;
    totalPayrollAmount: number;
    paidCount: number;
    unpaidCount: number;
    totalPph21: number;
    totalBpjsEmployee: number;
    totalBpjsEmployer: number;
  };
  payrolls: PayrollRow[];
}

interface TaxResponse {
  data: {
    pph21: { accountCode: string; outstanding: string };
    bpjs: { accountCode: string; outstanding: string };
    other: { accountCode: string; outstanding: string };
    total: string;
  };
}

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY_FORM = {
  employeeName: '',
  role: 'Staf Operasional',
  monthYear: new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
  basicSalary: '',
  allowance: '',
  overtime: '',
  pph21: '',
  bpjsEmployee: '',
  bpjsEmployer: '',
  otherDeductions: '',
  accrualDate: today(),
};

function n(value: string): number {
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PayrollView({ canManage }: { canManage: boolean }) {
  const [list, setList] = useState<PayrollListResponse | null>(null);
  const [taxes, setTaxes] = useState<TaxResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState(today());

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [payroll, tax] = await Promise.all([
        apiGet<PayrollListResponse>('/api/v1/kerja/payroll'),
        apiGet<TaxResponse>('/api/v1/kerja/payroll/taxes'),
      ]);
      setList(payroll);
      setTaxes(tax.data);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data payroll.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const preview = useMemo(
    () =>
      computePayroll({
        basicSalary: n(form.basicSalary),
        allowance: n(form.allowance),
        overtime: n(form.overtime),
        pph21: n(form.pph21),
        bpjsEmployee: n(form.bpjsEmployee),
        bpjsEmployer: n(form.bpjsEmployer),
        otherDeductions: n(form.otherDeductions),
      }),
    [form]
  );

  const setField = (key: keyof typeof EMPTY_FORM, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setNotice(null);
    setActionError(null);
  };

  const createSlip = async () => {
    if (!form.employeeName.trim() || !n(form.basicSalary)) {
      setActionError('Nama staf dan gaji pokok wajib diisi.');
      return;
    }
    if (!preview.ok) {
      setActionError(preview.error);
      return;
    }
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const res = await apiSend<{ message?: string; journalNumber?: string | null }>(
        '/api/v1/kerja/payroll',
        'POST',
        {
          employeeName: form.employeeName.trim(),
          role: form.role.trim() || 'Staf Operasional',
          monthYear: form.monthYear.trim(),
          basicSalary: n(form.basicSalary),
          allowance: n(form.allowance),
          overtime: n(form.overtime),
          pph21: n(form.pph21),
          bpjsEmployee: n(form.bpjsEmployee),
          bpjsEmployer: n(form.bpjsEmployer),
          otherDeductions: n(form.otherDeductions),
          accrualDate: form.accrualDate || undefined,
        }
      );
      setNotice(
        `${res.message ?? 'Slip gaji dibuat.'}${res.journalNumber ? ` Jurnal ${res.journalNumber}.` : ''}`
      );
      setForm({ ...EMPTY_FORM, monthYear: form.monthYear });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setActionError(err?.message || 'Slip gaji gagal dibuat.');
    } finally {
      setSaving(false);
    }
  };

  const paySlip = async (payrollId: string) => {
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const res = await apiSend<{ message?: string }>('/api/v1/kerja/payroll', 'PUT', {
        payrollId,
        paymentDate,
      });
      setNotice(res.message ?? 'Gaji dibayarkan.');
      await load();
    } catch (err: any) {
      setActionError(err?.message || 'Pembayaran gagal.');
    } finally {
      setSaving(false);
    }
  };

  const remit = async (type: 'PPH21' | 'BPJS' | 'OTHER') => {
    setSaving(true);
    setActionError(null);
    setNotice(null);
    try {
      const res = await apiSend<{ message?: string }>('/api/v1/kerja/payroll/taxes', 'POST', {
        type,
        paymentDate,
      });
      setNotice(res.message ?? 'Setoran tercatat.');
      await load();
    } catch (err: any) {
      setActionError(err?.message || 'Setoran gagal.');
    } finally {
      setSaving(false);
    }
  };

  const unpaid = list?.payrolls.filter((p) => !p.isPaid) ?? [];

  return (
    <div className="space-y-4">
      <div className="klir-no-print flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
          Tanggal bayar/setor
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700"
          />
        </label>
        {canManage && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            <Plus className="h-3.5 w-3.5" />
            {showForm ? 'Tutup form' : 'Buat slip gaji'}
          </button>
        )}
        <button
          onClick={() => void load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Muat ulang
        </button>
        {notice && <span className="text-[11px] font-medium text-emerald-700">{notice}</span>}
        {actionError && <span className="text-[11px] font-medium text-red-600">{actionError}</span>}
      </div>

      {!canManage && (
        <p className="klir-no-print rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          Anda hanya bisa melihat data gaji. Membuat slip, membayar gaji, dan menyetor pajak memerlukan peran Manager ke atas.
        </p>
      )}

      {list && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Gaji bersih (semua slip)" value={formatMoney(list.summary.totalPayrollAmount)} />
          <Kpi label="Belum dibayar" value={`${list.summary.unpaidCount} slip`} />
          <Kpi label="PPh 21 dipotong" value={formatMoney(list.summary.totalPph21)} />
          <Kpi
            label="BPJS (karyawan + perusahaan)"
            value={formatMoney(list.summary.totalBpjsEmployee + list.summary.totalBpjsEmployer)}
          />
        </div>
      )}

      {showForm && canManage && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Users className="h-4 w-4 text-slate-400" /> Slip Gaji Baru
            </h3>
            <p className="text-[11px] text-slate-500">
              PPh 21 & BPJS diisi manual dari aplikasi payroll resmi. Sistem tidak menghitung tarif pajak.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Nama staf" value={form.employeeName} onChange={(v) => setField('employeeName', v)} />
            <Field label="Jabatan" value={form.role} onChange={(v) => setField('role', v)} />
            <Field label="Periode (mis. November 2026)" value={form.monthYear} onChange={(v) => setField('monthYear', v)} />
            <Field label="Gaji pokok" value={form.basicSalary} onChange={(v) => setField('basicSalary', v)} numeric />
            <Field label="Tunjangan" value={form.allowance} onChange={(v) => setField('allowance', v)} numeric />
            <Field label="Lembur" value={form.overtime} onChange={(v) => setField('overtime', v)} numeric />
            <Field label="PPh 21 (potongan)" value={form.pph21} onChange={(v) => setField('pph21', v)} numeric />
            <Field label="BPJS karyawan" value={form.bpjsEmployee} onChange={(v) => setField('bpjsEmployee', v)} numeric />
            <Field label="BPJS pemberi kerja" value={form.bpjsEmployer} onChange={(v) => setField('bpjsEmployer', v)} numeric />
            <Field label="Potongan lain" value={form.otherDeductions} onChange={(v) => setField('otherDeductions', v)} numeric />
            <Field label="Tanggal pengakuan beban" value={form.accrualDate} onChange={(v) => setField('accrualDate', v)} type="date" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-3">
            <div className="flex flex-wrap gap-4 text-[11px] text-slate-600">
              <span>Bruto <strong className="tabular-nums text-slate-900">{preview.ok ? formatMoney(preview.value.gross) : '-'}</strong></span>
              <span>Potongan <strong className="tabular-nums text-slate-900">{preview.ok ? formatMoney(preview.value.deductions) : '-'}</strong></span>
              <span>Bersih <strong className="tabular-nums text-emerald-700">{preview.ok ? formatMoney(preview.value.net) : '-'}</strong></span>
              <span>Biaya perusahaan <strong className="tabular-nums text-slate-900">{preview.ok ? formatMoney(preview.value.employerCost) : '-'}</strong></span>
            </div>
            <button
              onClick={createSlip}
              disabled={!preview.ok || saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Banknote className="h-3.5 w-3.5" />}
              Simpan slip
            </button>
          </div>
          {!preview.ok && <p className="px-4 pb-3 text-[11px] text-red-600">{preview.error}</p>}
        </div>
      )}

      {taxes && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TaxCard
            label="Utang PPh 21"
            code={taxes.pph21.accountCode}
            amount={taxes.pph21.outstanding}
            canManage={canManage}
            busy={saving}
            onRemit={() => remit('PPH21')}
          />
          <TaxCard
            label="Utang BPJS"
            code={taxes.bpjs.accountCode}
            amount={taxes.bpjs.outstanding}
            canManage={canManage}
            busy={saving}
            onRemit={() => remit('BPJS')}
          />
          <TaxCard
            label="Potongan karyawan lain"
            code={taxes.other.accountCode}
            amount={taxes.other.outstanding}
            canManage={canManage}
            busy={saving}
            onRemit={() => remit('OTHER')}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="text-sm font-bold text-slate-900">Daftar Slip Gaji</h3>
          <p className="text-[11px] text-slate-500">
            Gaji yang dibayar mengurangi Utang Gaji; PPh/BPJS disetor lewat kartu di atas.
          </p>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat slip gaji…
          </div>
        )}
        {!loading && error && <p className="px-4 py-8 text-center text-sm text-red-600">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  {['Staf', 'Periode', 'Bruto', 'PPh 21', 'BPJS', 'Potongan lain', 'Bersih', 'Status', ''].map((h) => (
                    <th
                      key={h}
                      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${
                        ['Bruto', 'PPh 21', 'BPJS', 'Potongan lain', 'Bersih'].includes(h) ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list?.payrolls.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-10 text-center text-xs text-slate-500">
                      Belum ada slip gaji. Klik “Buat slip gaji” untuk memulai.
                    </td>
                  </tr>
                )}
                {list?.payrolls.map((p) => {
                  const gross = p.basicSalary + p.allowance + p.overtime;
                  return (
                    <tr key={p.id} className="border-b border-slate-50">
                      <td className="px-3 py-2">
                        <p className="text-xs font-medium text-slate-800">{p.employeeName}</p>
                        <p className="text-[10px] text-slate-400">{p.role}</p>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600">{p.monthYear}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">{formatMoney(gross)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">{formatMoney(p.pph21)}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">
                        {formatMoney((p.bpjsEmployee ?? 0) + (p.bpjsEmployer ?? 0))}
                      </td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-slate-700">{formatMoney(p.otherDeductions)}</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums text-slate-900">{formatMoney(p.netSalary)}</td>
                      <td className="px-3 py-2">
                        {p.isPaid ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Dibayar
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            Belum dibayar
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canManage && !p.isPaid && (
                          <button
                            onClick={() => paySlip(p.id)}
                            disabled={saving}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            Bayar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {unpaid.length > 0 && (
        <p className="klir-no-print text-[11px] text-slate-500">
          {unpaid.length} slip belum dibayar. Total kewajiban gaji bersih:{' '}
          <strong className="text-slate-800">{formatMoney(unpaid.reduce((acc, p) => acc + p.netSalary, 0))}</strong>.
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  numeric,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-slate-600">{label}</span>
      <input
        type={numeric ? 'text' : type}
        inputMode={numeric ? 'numeric' : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-slate-300 px-2.5 text-xs text-slate-800 focus:border-emerald-400 focus:outline-none"
      />
    </label>
  );
}

function TaxCard({
  label,
  code,
  amount,
  canManage,
  busy,
  onRemit,
}: {
  label: string;
  code: string;
  amount: string;
  canManage: boolean;
  busy: boolean;
  onRemit: () => void;
}) {
  const outstanding = Number(amount);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <ReceiptText className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${outstanding > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
        {formatMoney(amount)}
      </p>
      <p className="text-[10px] text-slate-400">Akun {code}</p>
      {canManage && (
        <button
          onClick={onRemit}
          disabled={busy || outstanding <= 0}
          className="mt-2 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Setor penuh
        </button>
      )}
    </div>
  );
}
