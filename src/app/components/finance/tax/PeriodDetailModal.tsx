'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  ShieldAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { apiSend, formatMoney } from '../accounting/client';
import {
  Badge,
  Field,
  InlineError,
  LoadingState,
  Modal,
  buttonCls,
  inputCls,
} from './ui';
import {
  PERIOD_STATUS_BADGE,
  PERIOD_STATUS_LABEL,
  TAX_DOC_LABEL,
  TAX_DOC_ORDER,
  TAX_TYPE_BADGE,
  taxTypeLabel,
} from '@/lib/tax/constants';
import { formatMonthId } from '@/lib/tax/dates';
import type {
  ComplianceItemView,
  DocTypeKey,
  PeriodDetailResponse,
  PeriodStatusKey,
} from './types';

const STATUS_ACTION_LABEL: Record<string, string> = {
  OPEN: 'Buka kembali',
  READY: 'Tandai siap lapor',
  FILED: 'Tandai sudah lapor',
  PAID: 'Tandai sudah setor',
  CLOSED: 'Tutup masa',
};

const NEXT_ACTIONS: Record<PeriodStatusKey, PeriodStatusKey[]> = {
  OPEN: ['READY', 'FILED', 'PAID'],
  READY: ['FILED', 'PAID', 'OPEN'],
  FILED: ['PAID', 'READY'],
  PAID: ['FILED', 'CLOSED'],
  CLOSED: ['OPEN'],
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

interface OverrideState {
  status: PeriodStatusKey;
  message: string;
  missing: ComplianceItemView[];
}

export function PeriodDetailModal({
  workspaceId,
  periodId,
  canManage,
  canPost,
  onClose,
  onChanged,
}: {
  workspaceId: string;
  periodId: string;
  canManage: boolean;
  canPost: boolean;
  onClose: () => void;
  onChanged: (message?: string) => void;
}) {
  const [detail, setDetail] = useState<PeriodDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<PeriodStatusKey | null>(null);
  const [override, setOverride] = useState<OverrideState | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [savingRefs, setSavingRefs] = useState(false);
  const [refs, setRefs] = useState({ paymentRef: '', filingRef: '', notes: '' });
  const [uploadDocType, setUploadDocType] = useState<DocTypeKey>('PAYMENT_PROOF');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocNumber, setUploadDocNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/tax/periods/${periodId}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Gagal memuat detail masa pajak.');
      }
      const data = payload as PeriodDetailResponse & { success: boolean };
      setDetail(data);
      setRefs({
        paymentRef: data.period.paymentRef ?? '',
        filingRef: data.period.filingRef ?? '',
        notes: data.period.notes ?? '',
      });
      const missing = data.compliance.missing ?? [];
      setUploadDocType(missing[0]?.docType ?? 'PAYMENT_PROOF');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat detail masa pajak.');
    } finally {
      setLoading(false);
    }
  }, [periodId]);

  useEffect(() => {
    void load();
  }, [load, workspaceId]);

  const period = detail?.period ?? null;
  const compliance = detail?.compliance ?? null;

  const criticalMissing = useMemo(
    () => (compliance?.missing ?? []).filter((item) => item.critical),
    [compliance]
  );

  const changeStatus = async (
    status: PeriodStatusKey,
    options?: { override?: boolean; reason?: string }
  ) => {
    setSavingStatus(status);
    setError(null);
    if (!options?.override) setOverride(null);
    try {
      const response = await fetch(`/api/v1/tax/periods/${periodId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...(options?.override
            ? { override: true, overrideReason: options.reason ?? overrideReason }
            : {}),
        }),
      });
      const payload = await response.json().catch(() => null);

      if (response.status === 409 && payload?.code === 'DOCS_INCOMPLETE') {
        setOverride({
          status,
          message: payload.message ?? 'Dokumen kritikal belum lengkap.',
          missing: payload.missing ?? [],
        });
        setOverrideReason('');
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.message || 'Gagal mengubah status masa pajak.');
      }

      setOverride(null);
      setOverrideReason('');
      await load();
      onChanged(
        options?.override
          ? `Status ${PERIOD_STATUS_LABEL[status]} disimpan dengan override.`
          : `Status diubah menjadi ${PERIOD_STATUS_LABEL[status]}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah status masa pajak.');
    } finally {
      setSavingStatus(null);
    }
  };

  const saveRefs = async () => {
    setSavingRefs(true);
    setError(null);
    try {
      await apiSend(`/api/v1/tax/periods/${periodId}`, 'PATCH', {
        paymentRef: refs.paymentRef || null,
        filingRef: refs.filingRef || null,
        notes: refs.notes || null,
      });
      await load();
      onChanged('Referensi masa pajak disimpan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan referensi.');
    } finally {
      setSavingRefs(false);
    }
  };

  const prefillUpload = (item: ComplianceItemView) => {
    setUploadDocType(item.docType);
    setUploadDocNumber('');
    setError(null);
    fileRef.current?.click();
  };

  const uploadDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploadFile) {
      setError('Pilih file terlebih dahulu.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('file', uploadFile);
      const uploadResponse = await fetch('/api/v1/workspace-files', {
        method: 'POST',
        credentials: 'include',
        body,
      });
      const uploadPayload = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok) {
        throw new Error(uploadPayload?.message || 'Gagal mengunggah file ke Pusat Data.');
      }
      const fileId = uploadPayload?.file?.id ?? null;
      if (!fileId) throw new Error('File tersimpan tetapi ID tidak diterima.');

      await apiSend('/api/v1/tax/documents', 'POST', {
        docType: uploadDocType,
        taxPeriodId: periodId,
        fileId,
        fileName: uploadPayload?.file?.fileName ?? uploadFile.name,
        docNumber: uploadDocNumber || null,
      });

      setUploadFile(null);
      setUploadDocNumber('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
      onChanged('Dokumen berhasil diunggah.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah dokumen.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      title={period ? `${taxTypeLabel(period.taxType)} — ${formatMonthId(period.year, period.month)}` : 'Detail Masa Pajak'}
      subtitle={period ? `Jatuh tempo setor ${fmtDate(period.dueDatePayment)} • lapor ${fmtDate(period.dueDateFiling)}` : undefined}
      onClose={onClose}
      wide
    >
      {loading && !detail ? (
        <LoadingState label="Memuat masa pajak..." />
      ) : !detail || !period ? (
        <InlineError message={error ?? 'Masa pajak tidak ditemukan.'} onRetry={() => void load()} />
      ) : (
        <div className="space-y-3">
          {error ? <InlineError message={error} onRetry={() => void load()} /> : null}

          <div className="flex flex-wrap items-center gap-2">
            <Badge className={TAX_TYPE_BADGE[period.taxType] ?? ''}>{taxTypeLabel(period.taxType)}</Badge>
            <Badge className={PERIOD_STATUS_BADGE[period.status] ?? ''}>
              {PERIOD_STATUS_LABEL[period.status] ?? period.status}
            </Badge>
            {compliance ? (
              <span className="text-[10px] text-slate-500">
                Kelengkapan dokumen{' '}
                <strong className="text-slate-700">{compliance.completenessPct.toFixed(0)}%</strong>
              </span>
            ) : null}
            {period.filedAt ? (
              <span className="text-[10px] text-slate-400">Dilaporkan {fmtDate(period.filedAt)}</span>
            ) : null}
            {period.paidAt ? (
              <span className="text-[10px] text-slate-400">Disetor {fmtDate(period.paidAt)}</span>
            ) : null}
          </div>

          {/* Nominal */}
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:grid-cols-4">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Pajak terutang</p>
              <p className="mt-0.5 font-mono text-sm font-bold text-slate-900">
                {formatMoney(period.amount.amount)}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">DPP</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">
                {formatMoney(period.amount.dpp)}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Transaksi</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">
                {period.amount.transactionCount}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">Lebih bayar</p>
              <p className="mt-0.5 font-mono text-xs font-semibold text-slate-700">
                {formatMoney(period.amount.overpayment)}
              </p>
            </div>
          </div>
          {period.amount.note ? (
            <p className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[10px] leading-relaxed text-blue-800">
              {period.amount.note}
            </p>
          ) : null}

          {/* Checklist */}
          {compliance ? (
            <div className="rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                <p className="text-[11px] font-bold text-slate-800">Checklist Dokumen</p>
                <span className="text-[10px] text-slate-500">
                  {compliance.presentCount}/{compliance.requiredCount} wajib •{' '}
                  <span className={criticalMissing.length > 0 ? 'font-semibold text-red-600' : 'text-emerald-600'}>
                    {criticalMissing.length} kritikal kurang
                  </span>
                </span>
              </div>
              <div className="max-h-52 overflow-y-auto">
                {compliance.items.length === 0 ? (
                  <p className="px-3 py-3 text-[11px] text-slate-500">
                    Tidak ada dokumen wajib untuk jenis pajak ini. Anda masih bisa menambahkan dokumen pendukung.
                  </p>
                ) : (
                  compliance.items.map((item) => (
                    <div
                      key={item.key}
                      className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 px-3 py-2 last:border-0"
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        {item.present ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        ) : (
                          <XCircle
                            className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                              item.critical ? 'text-red-500' : 'text-amber-500'
                            }`}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-slate-800">
                            {item.label} — {item.reference}
                          </p>
                          <p className="text-[9px] text-slate-500">
                            {item.critical ? 'Kritikal • ' : ''}
                            {item.present ? 'Sudah tersedia' : item.note ?? 'Belum diunggah'}
                          </p>
                        </div>
                      </div>
                      {!item.present && canManage ? (
                        <button type="button" onClick={() => prefillUpload(item)} className={buttonCls.secondary}>
                          <Upload className="h-3 w-3" /> Unggah
                        </button>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {/* Upload cepat */}
          {canManage ? (
            <form onSubmit={uploadDocument} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                <Upload className="h-3.5 w-3.5 text-emerald-600" /> Unggah dokumen untuk masa ini
              </p>
              <div className="grid gap-2 sm:grid-cols-[160px_1fr_160px_auto]">
                <Field label="Tipe">
                  <select
                    value={uploadDocType}
                    onChange={(event) => setUploadDocType(event.target.value as DocTypeKey)}
                    className={inputCls}
                  >
                    {TAX_DOC_ORDER.map((docType) => (
                      <option key={docType} value={docType}>
                        {TAX_DOC_LABEL[docType]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Nomor (opsional)">
                  <input
                    value={uploadDocNumber}
                    onChange={(event) => setUploadDocNumber(event.target.value)}
                    className={inputCls}
                    placeholder="NTPN / nomor bukti"
                  />
                </Field>
                <Field label="File">
                  <input
                    ref={fileRef}
                    type="file"
                    onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.xlsx,.xls,.csv,.doc,.docx"
                    className="block w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-600 file:mr-1.5 file:rounded file:border-0 file:bg-slate-100 file:px-1.5 file:py-1 file:text-[9px] file:font-semibold file:text-slate-700"
                  />
                </Field>
                <div className="flex items-end">
                  <button type="submit" disabled={uploading} className={buttonCls.primary}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploading ? 'Mengunggah' : 'Simpan'}
                  </button>
                </div>
              </div>
            </form>
          ) : null}

          {/* Referensi */}
          <div className="rounded-xl border border-slate-200 p-3">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
              <FileText className="h-3.5 w-3.5 text-emerald-600" /> Referensi setor & lapor
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Referensi setor (NTPN)">
                <input
                  value={refs.paymentRef}
                  onChange={(event) => setRefs({ ...refs, paymentRef: event.target.value })}
                  disabled={!canPost}
                  className={inputCls}
                  placeholder="mis. NTPN 1234ABCD"
                />
              </Field>
              <Field label="Nomor bukti lapor">
                <input
                  value={refs.filingRef}
                  onChange={(event) => setRefs({ ...refs, filingRef: event.target.value })}
                  disabled={!canPost}
                  className={inputCls}
                  placeholder="mis. BPE-2026-..."
                />
              </Field>
            </div>
            <Field label="Catatan" className="mt-2">
              <textarea
                value={refs.notes}
                onChange={(event) => setRefs({ ...refs, notes: event.target.value })}
                disabled={!canPost}
                rows={2}
                className={inputCls}
              />
            </Field>
            {canPost ? (
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={() => void saveRefs()} disabled={savingRefs} className={buttonCls.secondary}>
                  {savingRefs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {savingRefs ? 'Menyimpan...' : 'Simpan referensi'}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-[10px] text-slate-400">
                Peran Anda tidak dapat mengubah referensi/status (butuh izin posting).
              </p>
            )}
          </div>

          {/* Override */}
          {override ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="flex items-start gap-1.5 text-[11px] font-bold text-red-800">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {override.message}
              </p>
              <ul className="mt-1.5 space-y-0.5 pl-5 text-[10px] text-red-700">
                {override.missing
                  .filter((item) => item.critical)
                  .slice(0, 5)
                  .map((item) => (
                    <li key={item.key} className="list-disc">
                      {item.label} — {item.reference}
                    </li>
                  ))}
              </ul>
              <Field label="Alasan override (wajib)" className="mt-2">
                <textarea
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  rows={2}
                  className={inputCls}
                  placeholder="mis. Bukti setor menyusul dari bagian keuangan, status ditandai agar tidak terlewat."
                />
              </Field>
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setOverride(null)} className={buttonCls.secondary}>
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!overrideReason.trim() || savingStatus !== null}
                  onClick={() => void changeStatus(override.status, { override: true, reason: overrideReason })}
                  className={buttonCls.danger}
                >
                  {savingStatus === override.status ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  Tetap tandai {PERIOD_STATUS_LABEL[override.status]}
                </button>
              </div>
            </div>
          ) : null}

          {/* Aksi status */}
          {canPost ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <span className="mr-auto text-[10px] text-slate-400">
                Status saat ini: <strong className="text-slate-600">{PERIOD_STATUS_LABEL[period.status]}</strong>
              </span>
              {(NEXT_ACTIONS[period.status] ?? []).map((status) => {
                const primary = status === 'FILED' || status === 'PAID';
                return (
                  <button
                    key={status}
                    type="button"
                    disabled={savingStatus !== null}
                    onClick={() => void changeStatus(status)}
                    className={primary ? buttonCls.primary : buttonCls.secondary}
                  >
                    {savingStatus === status ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    {STATUS_ACTION_LABEL[status] ?? status}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}
