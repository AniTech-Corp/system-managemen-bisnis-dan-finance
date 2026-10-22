'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { apiGet, apiSend, formatMoney, MONTH_LABELS } from '../accounting/client';
import {
  Card,
  CardHeader,
  EmptyState,
  Field,
  InlineError,
  LoadingState,
  Modal,
  Money,
  buttonCls,
  inputCls,
} from './ui';
import { TAX_TYPE_LABEL, taxTypeShort } from '@/lib/tax/constants';
import type { WithholdingRow } from './types';

const WITHHOLDING_TABS = ['PPH_23', 'PPH_4_2', 'PPH_26'] as const;
const DEFAULT_RATE: Record<string, number> = { PPH_23: 2, PPH_4_2: 10, PPH_26: 20 };

const CSV_TEMPLATE = [
  'jenis;nama;npwp;dpp;tarif;pph;tahun;bulan;nomor bukti;keterangan',
  'PPh 23;CV Mitra Jasa;01.234.567.8-901.000;5000000;2;100000;2026;10;BP-001;Jasa konsultasi',
  'PPh 4(2);PT Sewa Properti;02.345.678.9-012.000;12000000;10;1200000;2026;10;BP-002;Sewa gudang',
].join('\r\n');

export function WithholdingView({
  workspaceId,
  year,
  month,
  canManage,
  onChanged,
}: {
  workspaceId: string;
  year: number;
  month: number;
  canManage: boolean;
  onChanged: (message?: string) => void;
}) {
  const [taxType, setTaxType] = useState<string>('PPH_23');
  const [rows, setRows] = useState<WithholdingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [csv, setCsv] = useState('');
  const [importErrors, setImportErrors] = useState<Array<{ line: number; message: string }>>([]);
  const [form, setForm] = useState({
    taxType: 'PPH_23',
    partnerName: '',
    partnerNpwp: '',
    dpp: '',
    rate: String(DEFAULT_RATE.PPH_23),
    taxAmount: '',
    periodYear: String(year),
    periodMonth: String(month),
    docNumber: '',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<{ success: boolean; rows: WithholdingRow[] }>(
        `/api/v1/tax/withholdings?year=${year}&taxType=${taxType}`
      );
      setRows(result.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat bukti potong.');
    } finally {
      setLoading(false);
    }
  }, [year, taxType]);

  useEffect(() => {
    void load();
  }, [load, workspaceId]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({ dpp: acc.dpp + row.dpp, taxAmount: acc.taxAmount + row.taxAmount }),
        { dpp: 0, taxAmount: 0 }
      ),
    [rows]
  );

  const previewTax = useMemo(() => {
    const dpp = Number(form.dpp) || 0;
    const rate = Number(form.rate) || 0;
    return (dpp * rate) / 100;
  }, [form.dpp, form.rate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const dpp = Number(form.dpp);
    if (!Number.isFinite(dpp) || dpp <= 0) {
      setFormError('DPP wajib diisi dan lebih dari nol.');
      return;
    }
    setSaving(true);
    try {
      await apiSend('/api/v1/tax/withholdings', 'POST', {
        taxType: form.taxType,
        partnerName: form.partnerName || null,
        partnerNpwp: form.partnerNpwp || null,
        dpp,
        rate: Number(form.rate) || 0,
        taxAmount: form.taxAmount === '' ? undefined : Number(form.taxAmount),
        periodYear: Number(form.periodYear),
        periodMonth: Number(form.periodMonth),
        docNumber: form.docNumber || null,
        notes: form.notes || null,
      });
      setShowAdd(false);
      setForm((current) => ({
        ...current,
        partnerName: '',
        partnerNpwp: '',
        dpp: '',
        taxAmount: '',
        docNumber: '',
        notes: '',
      }));
      await load();
      onChanged('Bukti potong disimpan.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan bukti potong.');
    } finally {
      setSaving(false);
    }
  };

  const importCsv = async () => {
    setImporting(true);
    setImportErrors([]);
    try {
      const result = await apiSend<{
        success: boolean;
        created: number;
        errors: Array<{ line: number; message: string }>;
      }>('/api/v1/tax/withholdings', 'POST', { csv });
      setImportErrors(result.errors ?? []);
      if (result.created > 0) {
        setCsv('');
        setShowImport(false);
        await load();
        onChanged(`${result.created} bukti potong diimpor.`);
      }
    } catch (err) {
      setImportErrors([{ line: 0, message: err instanceof Error ? err.message : 'Gagal mengimpor CSV.' }]);
    } finally {
      setImporting(false);
    }
  };

  const remove = async (row: WithholdingRow) => {
    if (!window.confirm(`Hapus bukti potong ${row.docNumber ?? row.partnerName ?? ''}?`)) return;
    try {
      await apiSend(`/api/v1/tax/withholdings/${row.id}`, 'DELETE');
      await load();
      onChanged('Bukti potong dihapus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus bukti potong.');
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([`\uFEFF${CSV_TEMPLATE}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template-bukti-potong.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Bukti Potong PPh 23 / 4(2) / 26"
          subtitle="Input manual atau impor CSV (format e-Bupot yang disederhanakan). PPh 21 & BPJS tetap dari payroll."
          icon={<FileSpreadsheet className="h-4 w-4" />}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void load()} className={buttonCls.secondary}>
                <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
              </button>
              {canManage ? (
                <>
                  <button type="button" onClick={downloadTemplate} className={buttonCls.secondary}>
                    <Download className="h-3.5 w-3.5" /> Template
                  </button>
                  <button type="button" onClick={() => setShowImport(true)} className={buttonCls.secondary}>
                    <Upload className="h-3.5 w-3.5" /> Impor CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        taxType,
                        rate: String(DEFAULT_RATE[taxType] ?? 0),
                        periodYear: String(year),
                        periodMonth: String(month),
                      }));
                      setShowAdd(true);
                    }}
                    className={buttonCls.primary}
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah
                  </button>
                </>
              ) : null}
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
          {WITHHOLDING_TABS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTaxType(value)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition ${
                taxType === value
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              {taxTypeShort(value)}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3 text-[10px] text-slate-500">
            <span>
              DPP <Money value={totals.dpp} className="font-semibold text-slate-800" />
            </span>
            <span>
              Potongan <Money value={totals.taxAmount} className="font-semibold text-emerald-700" />
            </span>
            <span>{rows.length} bukti</span>
          </div>
        </div>

        {error ? <div className="px-4 pt-3"><InlineError message={error} onRetry={() => void load()} /></div> : null}

        {loading ? (
          <LoadingState label="Memuat bukti potong..." />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Belum ada bukti potong"
            message={`Tambahkan bukti potong ${TAX_TYPE_LABEL[taxType as keyof typeof TAX_TYPE_LABEL] ?? taxType} atau impor CSV dari e-Bupot.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2 font-semibold">Masa</th>
                  <th className="px-3 py-2 font-semibold">Pihak dipotong</th>
                  <th className="px-3 py-2 font-semibold">NPWP</th>
                  <th className="px-3 py-2 text-right font-semibold">DPP</th>
                  <th className="px-3 py-2 text-right font-semibold">Tarif</th>
                  <th className="px-3 py-2 text-right font-semibold">Potongan</th>
                  <th className="px-3 py-2 font-semibold">Nomor</th>
                  <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-3 py-2 text-[10px] text-slate-600">
                      {MONTH_LABELS[row.periodMonth - 1]} {row.periodYear}
                    </td>
                    <td className="max-w-[200px] px-3 py-2">
                      <p className="truncate text-[11px] font-medium text-slate-800">{row.partnerName ?? '—'}</p>
                      <p className="truncate text-[9px] text-slate-400">{row.notes ?? row.sourceType}</p>
                    </td>
                    <td className="px-3 py-2 text-[10px] text-slate-500">{row.partnerNpwp ?? '—'}</td>
                    <td className="px-3 py-2 text-right"><Money value={row.dpp} className="text-[10px]" /></td>
                    <td className="px-3 py-2 text-right text-[10px] text-slate-500">{row.rate}%</td>
                    <td className="px-3 py-2 text-right"><Money value={row.taxAmount} className="text-[11px] font-semibold" /></td>
                    <td className="px-3 py-2 text-[10px] text-slate-500">{row.docNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {canManage ? (
                        <button type="button" onClick={() => void remove(row)} className={buttonCls.ghost} title="Hapus">
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd ? (
        <Modal
          title="Tambah Bukti Potong"
          subtitle="Nilai potongan otomatis dihitung dari DPP × tarif bila dikosongkan."
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowAdd(false)} className={buttonCls.secondary}>
                Batal
              </button>
              <button type="submit" form="tax-withholding-form" disabled={saving} className={buttonCls.primary}>
                {saving ? 'Menyimpan...' : 'Simpan'}
              </button>
            </>
          }
        >
          <form id="tax-withholding-form" onSubmit={submit} className="space-y-3">
            {formError ? <InlineError message={formError} /> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Jenis pajak">
                <select
                  value={form.taxType}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm({ ...form, taxType: value, rate: String(DEFAULT_RATE[value] ?? 0) });
                  }}
                  className={inputCls}
                >
                  {WITHHOLDING_TABS.map((value) => (
                    <option key={value} value={value}>
                      {TAX_TYPE_LABEL[value]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nomor bukti potong">
                <input
                  value={form.docNumber}
                  onChange={(event) => setForm({ ...form, docNumber: event.target.value })}
                  className={inputCls}
                  placeholder="mis. BP-001"
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nama pihak dipotong">
                <input
                  value={form.partnerName}
                  onChange={(event) => setForm({ ...form, partnerName: event.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="NPWP (opsional)">
                <input
                  value={form.partnerNpwp}
                  onChange={(event) => setForm({ ...form, partnerNpwp: event.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="DPP">
                <input
                  type="number"
                  value={form.dpp}
                  onChange={(event) => setForm({ ...form, dpp: event.target.value })}
                  className={inputCls}
                  placeholder="0"
                />
              </Field>
              <Field label="Tarif (%)">
                <input
                  type="number"
                  step="0.01"
                  value={form.rate}
                  onChange={(event) => setForm({ ...form, rate: event.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Nilai potongan" hint={form.taxAmount === '' ? `Otomatis: ${formatMoney(previewTax)}` : undefined}>
                <input
                  type="number"
                  value={form.taxAmount}
                  onChange={(event) => setForm({ ...form, taxAmount: event.target.value })}
                  className={inputCls}
                  placeholder={String(Math.round(previewTax))}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Bulan masa">
                <select
                  value={form.periodMonth}
                  onChange={(event) => setForm({ ...form, periodMonth: event.target.value })}
                  className={inputCls}
                >
                  {MONTH_LABELS.map((label, index) => (
                    <option key={label} value={index + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tahun masa">
                <input
                  type="number"
                  value={form.periodYear}
                  onChange={(event) => setForm({ ...form, periodYear: event.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Keterangan (opsional)">
              <textarea
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                rows={2}
                className={inputCls}
              />
            </Field>
          </form>
        </Modal>
      ) : null}

      {showImport ? (
        <Modal
          title="Impor Bukti Potong (CSV)"
          subtitle="Pemisah koma atau titik koma. Header fleksibel; wajib ada kolom DPP dan nilai potongan."
          onClose={() => setShowImport(false)}
          wide
          footer={
            <>
              <button type="button" onClick={() => setShowImport(false)} className={buttonCls.secondary}>
                Batal
              </button>
              <button
                type="button"
                onClick={() => void importCsv()}
                disabled={importing || csv.trim().length === 0}
                className={buttonCls.primary}
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {importing ? 'Mengimpor...' : 'Impor'}
              </button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Tempel isi CSV" hint={`Contoh header: ${CSV_TEMPLATE.split('\r\n')[0]}`}>
              <textarea
                value={csv}
                onChange={(event) => setCsv(event.target.value)}
                rows={10}
                className={`${inputCls} font-mono text-[10px]`}
                placeholder={CSV_TEMPLATE}
              />
            </Field>
            {importErrors.length > 0 ? (
              <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                {importErrors.slice(0, 12).map((item, index) => (
                  <p key={`${item.line}-${index}`} className="text-[10px] text-amber-800">
                    Baris {item.line}: {item.message}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] leading-relaxed text-slate-500">
        PPh 21 dan BPJS sengaja tidak diinput di sini agar angka gaji tetap satu sumber: slip gaji pada modul payroll.
        Untuk PPh 23/4(2), unggah bukti potong di tab <strong className="text-slate-700">Dokumen &amp; Bukti</strong>{' '}
        agar checklist masa pajak ikut terpenuhi.
      </div>
    </div>
  );
}
