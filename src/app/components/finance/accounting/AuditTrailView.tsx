'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Filter,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react';
import { useApiWithMeta } from './ReportViews';
import { formatMoney } from './client';

interface AuditUser {
  id: string;
  fullName: string;
  email: string;
}

interface AuditChangeSet {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  diff?: string[] | null;
}

interface AuditLogRow {
  id: string;
  workspaceId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: AuditChangeSet | null;
  metadata: Record<string, unknown> | null;
  reason: string | null;
  timestamp: string;
  user: AuditUser | null;
}

interface AuditMeta {
  total: number;
  limit: number;
  offset: number;
  scope: 'WORKSPACE' | 'SELF';
}

const ACTION_STYLE: Record<string, string> = {
  CREATE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  UPDATE: 'border-sky-200 bg-sky-50 text-sky-700',
  DELETE: 'border-red-200 bg-red-50 text-red-700',
  APPROVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  REJECT: 'border-red-200 bg-red-50 text-red-700',
  CANCEL: 'border-amber-200 bg-amber-50 text-amber-800',
  REVERSE: 'border-violet-200 bg-violet-50 text-violet-700',
  REOPEN: 'border-amber-200 bg-amber-50 text-amber-800',
  CLOSE: 'border-slate-300 bg-slate-100 text-slate-700',
  LOCK: 'border-slate-300 bg-slate-100 text-slate-700',
  ARCHIVE: 'border-slate-300 bg-slate-100 text-slate-700',
};

const ENTITY_LABEL: Record<string, string> = {
  CASH_TRANSACTION: 'Transaksi Kas',
  INVOICE: 'Faktur',
  JOURNAL_ENTRY: 'Jurnal',
  EXPENSE_REQUEST: 'Pengajuan Pengeluaran',
  PERIOD: 'Periode',
  PROJECT: 'Proyek',
  ACCOUNTING_SETTING: 'Pengaturan Akuntansi',
  SECURITY_APPROVAL: 'Approval Keamanan',
  PURCHASING_APPROVAL: 'Approval Pengadaan',
  SYSTEM: 'Sistem',
};

const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Dibuat',
  UPDATE: 'Diubah',
  DELETE: 'Dihapus',
  APPROVE: 'Disetujui',
  REJECT: 'Ditolak',
  CANCEL: 'Dibatalkan',
  REVERSE: 'Dibalik',
  REOPEN: 'Dibuka Kembali',
  CLOSE: 'Ditutup',
  LOCK: 'Dikunci',
  ARCHIVE: 'Diarsipkan',
};

function actionIcon(action: string) {
  if (action === 'CREATE' || action === 'APPROVE') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (action === 'DELETE' || action === 'REJECT') return <Trash2 className="h-3.5 w-3.5" />;
  if (action === 'CANCEL') return <XCircle className="h-3.5 w-3.5" />;
  if (action === 'REVERSE' || action === 'REOPEN') return <RotateCcw className="h-3.5 w-3.5" />;
  return <History className="h-3.5 w-3.5" />;
}

function isMoneyField(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('amount') ||
    normalized.includes('total') ||
    normalized.includes('subtotal') ||
    normalized.includes('paid') ||
    normalized.includes('revenue') ||
    normalized.includes('profit') ||
    normalized.includes('balance') ||
    normalized.includes('debit') ||
    normalized.includes('credit') ||
    normalized.includes('cash')
  );
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number' && isMoneyField(key)) return formatMoney(value);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function labelFor(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .replace(/\bId\b/g, 'ID');
}

function changedRows(log: AuditLogRow): Array<{ key: string; before: unknown; after: unknown }> {
  const before = log.changes?.before ?? {};
  const after = log.changes?.after ?? {};
  const keys = new Set<string>([
    ...(log.changes?.diff ?? []),
    ...Object.keys(before),
    ...Object.keys(after),
  ]);
  return Array.from(keys)
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: before[key], after: after[key] }));
}

export function AuditTrailView() {
  const [entityType, setEntityType] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [limit, setLimit] = useState('100');
  const [expanded, setExpanded] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    if (action) params.set('action', action);
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    params.set('limit', limit);
    return `/api/v1/accounting/audit-trail?${params.toString()}`;
  }, [entityType, action, startDate, endDate, limit]);

  const { data, meta, loading, error, reload } = useApiWithMeta<AuditLogRow[], AuditMeta>(url);
  const logs = data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Audit Trail & Riwayat Perubahan
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Jejak append-only untuk pembuatan, koreksi, persetujuan, dan pembatalan dokumen keuangan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
              {meta?.scope === 'WORKSPACE' ? 'Semua pengguna' : 'Hanya aktivitas saya'}
            </span>
            <button
              type="button"
              onClick={reload}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Muat ulang
            </button>
          </div>
        </div>

        <div className="grid gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Entitas
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-normal normal-case text-slate-700"
            >
              <option value="">Semua entitas</option>
              {Object.entries(ENTITY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Aksi
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-normal normal-case text-slate-700"
            >
              <option value="">Semua aksi</option>
              {Object.entries(ACTION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Dari tanggal
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-normal text-slate-700"
            />
          </label>

          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Sampai tanggal
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-normal text-slate-700"
            />
          </label>

          <label className="flex flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Tampilkan
            <select
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-normal normal-case text-slate-700"
            >
              <option value="50">50 entri</option>
              <option value="100">100 entri</option>
              <option value="200">200 entri</option>
            </select>
          </label>

          <div className="flex items-end">
            <div className="inline-flex min-h-9 w-full items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] text-slate-500">
              <Filter className="h-3.5 w-3.5" /> {meta?.total ?? 0} entri
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 border-b border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {loading && logs.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat audit trail…
          </div>
        )}

        {!loading && logs.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <Search className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">Belum ada audit yang cocok</p>
            <p className="max-w-md text-xs text-slate-500">
              Audit akan muncul setelah ada transaksi, faktur, jurnal, atau keputusan persetujuan yang dicatat.
            </p>
          </div>
        )}

        <div className="divide-y divide-slate-100">
          {logs.map((log) => {
            const rows = changedRows(log);
            const open = expanded === log.id;
            const actionClass = ACTION_STYLE[log.action] ?? 'border-slate-200 bg-slate-50 text-slate-700';
            return (
              <div key={log.id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : log.id)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${actionClass}`}>
                        {actionIcon(log.action)} {ACTION_LABEL[log.action] ?? log.action}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {ENTITY_LABEL[log.entityType] ?? log.entityType}
                      </span>
                      {log.entityId && (
                        <span className="font-mono text-[10px] text-slate-400">{log.entityId.slice(0, 8)}…</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-slate-800">
                      {log.reason || (ACTION_LABEL[log.action] ?? log.action)}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3 w-3" />
                        {log.user?.fullName || log.user?.email || 'Pengguna tidak tersedia'}
                      </span>
                      <span>
                        {new Date(log.timestamp).toLocaleString('id-ID', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      {rows.length > 0 && <span>{rows.length} field berubah</span>}
                    </div>
                  </div>
                  <ArrowRight className={`mt-1 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                </button>

                {open && (
                  <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                    {rows.length === 0 ? (
                      <p className="text-[11px] text-slate-500">Tidak ada snapshot nilai sebelum/sesudah untuk entri ini.</p>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <table className="w-full text-left text-[11px]">
                          <thead className="bg-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Field</th>
                              <th className="px-3 py-2 font-semibold">Sebelum</th>
                              <th className="px-3 py-2 font-semibold">Sesudah</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {rows.map((row) => (
                              <tr key={row.key}>
                                <td className="px-3 py-2 font-medium text-slate-600">{labelFor(row.key)}</td>
                                <td className="px-3 py-2 font-mono text-slate-500">{formatValue(row.key, row.before)}</td>
                                <td className="px-3 py-2 font-mono font-semibold text-slate-800">{formatValue(row.key, row.after)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <details className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          Metadata teknis
                        </summary>
                        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all text-[10px] text-slate-600">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </details>
                    )}

                    {log.reason && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                        <strong>Alasan:</strong> {log.reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
