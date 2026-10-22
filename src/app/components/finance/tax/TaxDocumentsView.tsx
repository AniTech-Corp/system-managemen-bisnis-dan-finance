'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  FileCheck2,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { apiGet, apiSend } from '../accounting/client';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  InlineError,
  LoadingState,
  Money,
  buttonCls,
  inputCls,
} from './ui';
import {
  PERIOD_STATUS_BADGE,
  PERIOD_STATUS_LABEL,
  TAX_DOC_LABEL,
  TAX_DOC_ORDER,
  TAX_TYPE_BADGE,
  taxTypeShort,
} from '@/lib/tax/constants';
import { formatMonthId, wibToday } from '@/lib/tax/dates';
import type {
  ComplianceReportView,
  DocTypeKey,
  DocumentView,
  PeriodView,
  PeriodsResponse,
} from './types';

const DOC_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  VERIFIED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const DOC_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu',
  VERIFIED: 'Terverifikasi',
  REJECTED: 'Ditolak',
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
}

export function TaxDocumentsView({
  workspaceId,
  year,
  canManage,
  onOpenPeriod,
  onChanged,
}: {
  workspaceId: string;
  year: number;
  canManage: boolean;
  onOpenPeriod: (periodId: string) => void;
  onChanged: (message?: string) => void;
}) {
  const [periods, setPeriods] = useState<PeriodView[]>([]);
  const [periodId, setPeriodId] = useState<string>('');
  const [documents, setDocuments] = useState<DocumentView[]>([]);
  const [compliance, setCompliance] = useState<ComplianceReportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    docType: 'PAYMENT_PROOF' as DocTypeKey,
    docNumber: '',
    amount: '',
    notes: '',
    sourceType: '',
    sourceId: '',
  });

  const loadPeriods = useCallback(async () => {
    setError(null);
    try {
      const result = await apiGet<PeriodsResponse>(`/api/v1/tax/periods?year=${year}`);
      setPeriods(result.periods);
      setPeriodId((current) => {
        if (current && result.periods.some((period) => period.id === current)) return current;
        const currentMonth = wibToday().month;
        return (
          result.periods.find((period) => period.month === currentMonth)?.id ??
          result.periods[0]?.id ??
          ''
        );
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat masa pajak.');
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods, workspaceId]);

  const loadDetail = useCallback(async () => {
    if (!periodId) {
      setDocuments([]);
      setCompliance(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [docs, check] = await Promise.all([
        apiGet<{ success: boolean; documents: DocumentView[] }>(
          `/api/v1/tax/documents?taxPeriodId=${periodId}`
        ),
        apiGet<ComplianceReportView & { success: boolean }>(
          `/api/v1/tax/compliance-check?periodId=${periodId}`
        ),
      ]);
      setDocuments(docs.documents);
      setCompliance(check);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat dokumen.');
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === periodId) ?? null,
    [periods, periodId]
  );

  const refresh = useCallback(async () => {
    await loadPeriods();
    await loadDetail();
  }, [loadPeriods, loadDetail]);

  const upload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!periodId) {
      setError('Pilih masa pajak terlebih dahulu.');
      return;
    }
    if (!file && !form.docNumber.trim()) {
      setError('Pilih file atau isi nomor dokumen.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      let fileId: string | null = null;
      let fileName: string | null = null;

      if (file) {
        const body = new FormData();
        body.append('file', file);
        const uploaded = await fetch('/api/v1/workspace-files', {
          method: 'POST',
          credentials: 'include',
          body,
        });
        const payload = await uploaded.json().catch(() => null);
        if (!uploaded.ok) {
          throw new Error(payload?.message || 'Gagal mengunggah file ke Pusat Data.');
        }
        fileId = payload?.file?.id ?? null;
        fileName = payload?.file?.fileName ?? file.name;
        if (!fileId) throw new Error('File tersimpan tetapi ID tidak diterima.');
      }

      await apiSend('/api/v1/tax/documents', 'POST', {
        docType: form.docType,
        taxPeriodId: periodId,
        fileId,
        fileName,
        docNumber: form.docNumber || null,
        amount: form.amount === '' ? null : Number(form.amount),
        notes: form.notes || null,
        sourceType: form.sourceType || null,
        sourceId: form.sourceId || null,
      });

      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      setForm({
        docType: 'PAYMENT_PROOF',
        docNumber: '',
        amount: '',
        notes: '',
        sourceType: '',
        sourceId: '',
      });
      await refresh();
      onChanged('Dokumen berhasil disimpan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan dokumen.');
    } finally {
      setUploading(false);
    }
  };

  const patchDocument = async (id: string, status: 'VERIFIED' | 'REJECTED') => {
    try {
      await apiSend(`/api/v1/tax/documents/${id}`, 'PATCH', { status });
      await loadDetail();
      onChanged(status === 'VERIFIED' ? 'Dokumen diverifikasi.' : 'Dokumen ditolak.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui dokumen.');
    }
  };

  const deleteDocument = async (doc: DocumentView) => {
    if (!window.confirm(`Hapus tautan dokumen "${doc.fileName ?? doc.docNumber ?? doc.docType}"?`)) return;
    try {
      await apiSend(`/api/v1/tax/documents/${doc.id}`, 'DELETE');
      await loadDetail();
      onChanged('Dokumen dihapus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus dokumen.');
    }
  };

  const prefill = (item: ComplianceReportView['missing'][number]) => {
    setForm((current) => ({
      ...current,
      docType: item.docType,
      sourceType: item.sourceType ?? '',
      sourceId: item.sourceId ?? '',
      amount: item.amount > 0 ? String(item.amount) : current.amount,
      notes: item.note ?? '',
    }));
    fileRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    fileRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Dokumen & Bukti Pajak"
          subtitle="Unggah faktur, bukti potong, bukti setor (NTPN), dan bukti lapor SPT. File tersimpan di Pusat Data."
          icon={<FolderOpen className="h-4 w-4" />}
          action={
            <button type="button" onClick={() => void refresh()} className={buttonCls.secondary}>
              <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
            </button>
          }
        />

        <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-4 py-3">
          <Field label="Masa pajak" className="min-w-[240px] flex-1">
            <select
              value={periodId}
              onChange={(event) => setPeriodId(event.target.value)}
              className={inputCls}
            >
              {periods.length === 0 ? <option value="">Belum ada masa pajak</option> : null}
              {periods.map((period) => (
                <option key={period.id} value={period.id}>
                  {formatMonthId(period.year, period.month)} — {taxTypeShort(period.taxType)} (
                  {PERIOD_STATUS_LABEL[period.status] ?? period.status})
                </option>
              ))}
            </select>
          </Field>
          {selectedPeriod ? (
            <>
              <div className="flex items-center gap-2 pb-1">
                <Badge className={TAX_TYPE_BADGE[selectedPeriod.taxType] ?? ''}>
                  {taxTypeShort(selectedPeriod.taxType)}
                </Badge>
                <Badge className={PERIOD_STATUS_BADGE[selectedPeriod.status] ?? ''}>
                  {PERIOD_STATUS_LABEL[selectedPeriod.status] ?? selectedPeriod.status}
                </Badge>
                <span className="text-[11px] text-slate-500">
                  Terutang <Money value={selectedPeriod.amount.amount} className="font-semibold text-slate-800" />
                </span>
              </div>
              <button type="button" onClick={() => onOpenPeriod(selectedPeriod.id)} className={buttonCls.ghost}>
                Buka detail masa
              </button>
            </>
          ) : null}
        </div>

        {error ? <div className="px-4 pt-3"><InlineError message={error} onRetry={() => void refresh()} /></div> : null}

        {loading ? (
          <LoadingState label="Memuat dokumen..." />
        ) : !selectedPeriod ? (
          <EmptyState
            title="Belum ada masa pajak"
            message="Masa pajak dibuat otomatis saat halaman ringkasan dibuka. Muat ulang atau kembali ke Ringkasan."
          />
        ) : (
          <>
            {/* Kelengkapan */}
            {compliance ? (
              <div className="border-b border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold text-slate-800">Kelengkapan dokumen</p>
                    <p className="text-[10px] text-slate-500">
                      {compliance.presentCount}/{compliance.requiredCount} dokumen wajib tersedia
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${
                          compliance.completenessPct >= 100
                            ? 'bg-emerald-500'
                            : compliance.completenessPct >= 50
                              ? 'bg-amber-500'
                              : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.max(2, compliance.completenessPct)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-800">
                      {compliance.completenessPct.toFixed(0)}%
                    </span>
                  </div>
                </div>

                {compliance.missing.length > 0 ? (
                  <div className="mt-2 space-y-1.5">
                    {compliance.missing.slice(0, 8).map((item) => (
                      <div
                        key={item.key}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                          item.critical ? 'border-red-200 bg-red-50/60' : 'border-amber-200 bg-amber-50/60'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-semibold text-slate-800">
                            {TAX_DOC_LABEL[item.docType]} — {item.reference}
                          </p>
                          <p className="text-[9px] text-slate-500">
                            {item.critical ? 'Kritikal • ' : ''}
                            {item.note ?? 'Dokumen belum diunggah.'}
                          </p>
                        </div>
                        {canManage ? (
                          <button type="button" onClick={() => prefill(item)} className={buttonCls.secondary}>
                            <Upload className="h-3 w-3" /> Lengkapi
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {compliance.missing.length > 8 ? (
                      <p className="text-[10px] text-slate-400">
                        +{compliance.missing.length - 8} dokumen lain belum lengkap.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-medium text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Semua dokumen wajib untuk masa ini sudah tersedia.
                  </p>
                )}
              </div>
            ) : null}

            {/* Upload */}
            {canManage ? (
              <form onSubmit={upload} className="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                  <Upload className="h-3.5 w-3.5 text-emerald-600" /> Tambah dokumen
                </p>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Tipe dokumen">
                    <select
                      value={form.docType}
                      onChange={(event) => setForm({ ...form, docType: event.target.value as DocTypeKey })}
                      className={inputCls}
                    >
                      {TAX_DOC_ORDER.map((docType) => (
                        <option key={docType} value={docType}>
                          {TAX_DOC_LABEL[docType]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Nomor dokumen (opsional)">
                    <input
                      value={form.docNumber}
                      onChange={(event) => setForm({ ...form, docNumber: event.target.value })}
                      className={inputCls}
                      placeholder="NTPN / nomor bukti"
                    />
                  </Field>
                  <Field label="Nilai (opsional)">
                    <input
                      type="number"
                      value={form.amount}
                      onChange={(event) => setForm({ ...form, amount: event.target.value })}
                      className={inputCls}
                      placeholder="0"
                    />
                  </Field>
                  <Field label="File" hint="PDF/gambar/Excel, maks 100 MB.">
                    <input
                      ref={fileRef}
                      type="file"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.doc,.docx"
                      className="block w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[10px] text-slate-600 file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-slate-700"
                    />
                  </Field>
                </div>
                <div className="mt-2.5 grid gap-2.5 sm:grid-cols-[1fr_auto]">
                  <Field label="Catatan (opsional)">
                    <input
                      value={form.notes}
                      onChange={(event) => setForm({ ...form, notes: event.target.value })}
                      className={inputCls}
                      placeholder="mis. NTPN setoran PPN masa September"
                    />
                  </Field>
                  <div className="flex items-end gap-2">
                    {form.sourceId ? (
                      <Badge className="mb-2 border-blue-200 bg-blue-50 text-blue-700">
                        Tertaut ke {form.sourceType}
                      </Badge>
                    ) : null}
                    <button type="submit" disabled={uploading} className={`${buttonCls.primary} mb-0.5`}>
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {uploading ? 'Menyimpan...' : 'Simpan dokumen'}
                    </button>
                  </div>
                </div>
              </form>
            ) : null}

            {/* Daftar */}
            {documents.length === 0 ? (
              <EmptyState
                title="Belum ada dokumen"
                message="Unggah bukti setor/lapor, faktur pajak, atau bukti potong untuk masa ini."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left">
                  <thead>
                    <tr className="bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2 font-semibold">Tipe</th>
                      <th className="px-3 py-2 font-semibold">Nomor</th>
                      <th className="px-3 py-2 font-semibold">File</th>
                      <th className="px-3 py-2 text-right font-semibold">Nilai</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                      <th className="px-3 py-2 font-semibold">Dibuat</th>
                      <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60">
                        <td className="px-3 py-2">
                          <Badge>{TAX_DOC_LABEL[doc.docType] ?? doc.docType}</Badge>
                          {doc.sourceType ? (
                            <p className="mt-0.5 text-[9px] text-slate-400">{doc.sourceType}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-[10px] text-slate-600">{doc.docNumber ?? '—'}</td>
                        <td className="max-w-[220px] px-3 py-2">
                          {doc.fileId ? (
                            <span className="inline-flex items-center gap-1 truncate text-[10px] font-medium text-slate-700">
                              <FileText className="h-3 w-3 shrink-0 text-emerald-600" />
                              {doc.fileName ?? 'File di Pusat Data'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">{doc.fileName ?? '—'}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {doc.amount !== null ? <Money value={doc.amount} className="text-[10px]" /> : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={DOC_STATUS_BADGE[doc.status] ?? ''}>
                            {DOC_STATUS_LABEL[doc.status] ?? doc.status}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-[10px] text-slate-500">
                          {fmtDate(doc.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-end gap-1">
                            {canManage && doc.status !== 'VERIFIED' ? (
                              <button
                                type="button"
                                onClick={() => void patchDocument(doc.id, 'VERIFIED')}
                                className={buttonCls.ghost}
                                title="Verifikasi"
                              >
                                <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                              </button>
                            ) : null}
                            {canManage && doc.status !== 'REJECTED' ? (
                              <button
                                type="button"
                                onClick={() => void patchDocument(doc.id, 'REJECTED')}
                                className={buttonCls.ghost}
                                title="Tolak"
                              >
                                <XCircle className="h-3.5 w-3.5 text-amber-600" />
                              </button>
                            ) : null}
                            {canManage ? (
                              <button
                                type="button"
                                onClick={() => void deleteDocument(doc)}
                                className={buttonCls.ghost}
                                title="Hapus tautan"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <ShieldAlert className="h-3.5 w-3.5" /> Penting
        </span>{' '}
        Dokumen yang dihapus dari daftar ini tetap tersimpan di Pusat Data. Kelengkapan dokumen bersifat peringatan;
        status masa pajak tetap dapat diubah dengan alasan override.
      </div>
    </div>
  );
}
