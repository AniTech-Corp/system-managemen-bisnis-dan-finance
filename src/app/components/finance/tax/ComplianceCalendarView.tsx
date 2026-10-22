'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronRight,
  CircleSlash,
  Filter,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
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
  Modal,
  buttonCls,
  inputCls,
} from './ui';
import {
  COMPLIANCE_CATEGORY_LABEL,
  COMPLIANCE_CATEGORY_ORDER,
  DEADLINE_STATUS_BADGE,
  DEADLINE_STATUS_LABEL,
  TAX_TYPE_BADGE,
  TAX_TYPE_LABEL,
  taxTypeShort,
} from '@/lib/tax/constants';
import { dateKey } from '@/lib/tax/dates';
import type { DeadlineStatusKey, DeadlineView, DeadlinesResponse } from './types';

function dateParts(iso: string): { day: string; month: string; year: string; key: string; label: string } {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    const fallbackKey = iso.slice(0, 10);
    return { day: '—', month: '—', year: '—', key: fallbackKey.slice(0, 7), label: fallbackKey };
  }
  const wibKey = dateKey(date);
  return {
    day: date.toLocaleDateString('id-ID', { day: '2-digit', timeZone: 'Asia/Jakarta' }),
    month: date.toLocaleDateString('id-ID', { month: 'short', timeZone: 'Asia/Jakarta' }),
    year: date.toLocaleDateString('id-ID', { year: 'numeric', timeZone: 'Asia/Jakarta' }),
    key: wibKey.slice(0, 7),
    label: date.toLocaleDateString('id-ID', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }),
  };
}

const STATUS_FILTERS: Array<{ value: 'ALL' | DeadlineStatusKey; label: string }> = [
  { value: 'ALL', label: 'Semua status' },
  { value: 'OVERDUE', label: 'Terlambat' },
  { value: 'DUE_SOON', label: 'Segera' },
  { value: 'UPCOMING', label: 'Akan datang' },
  { value: 'DONE', label: 'Selesai' },
  { value: 'SKIPPED', label: 'Dilewati' },
];

const EMPTY_FORM = {
  title: '',
  dueDate: new Date().toISOString().slice(0, 10),
  category: 'TAX',
  taxType: '',
  description: '',
  reminderDays: '7,3,1',
};

export function ComplianceCalendarView({
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
  const [data, setData] = useState<DeadlinesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeadlineStatusKey>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiGet<DeadlinesResponse>(`/api/v1/tax/deadlines?year=${year}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat kalender kepatuhan.');
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    void load();
  }, [load, workspaceId]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.deadlines.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      return true;
    });
  }, [data, statusFilter, categoryFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: DeadlineView[] }>();
    for (const item of filtered) {
      const parts = dateParts(item.dueDate);
      const entry = map.get(parts.key) ?? { key: parts.key, label: parts.label, items: [] };
      entry.items.push(item);
      map.set(parts.key, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filtered]);

  const counts = useMemo(() => {
    const base = { total: filtered.length, OVERDUE: 0, DUE_SOON: 0, DONE: 0 };
    for (const item of filtered) {
      if (item.status === 'OVERDUE') base.OVERDUE += 1;
      if (item.status === 'DUE_SOON') base.DUE_SOON += 1;
      if (item.status === 'DONE') base.DONE += 1;
    }
    return base;
  }, [filtered]);

  const patch = async (id: string, body: Record<string, unknown>, message: string) => {
    setBusyId(id);
    try {
      await apiSend(`/api/v1/tax/deadlines/${id}`, 'PATCH', body);
      await load();
      onChanged(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memperbarui tenggat.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: DeadlineView) => {
    if (!window.confirm(`Hapus/nonaktifkan tenggat "${item.title}"?`)) return;
    setBusyId(item.id);
    try {
      await apiSend(`/api/v1/tax/deadlines/${item.id}`, 'DELETE');
      await load();
      onChanged('Tenggat dihapus.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menghapus tenggat.');
    } finally {
      setBusyId(null);
    }
  };

  const syncTemplates = async () => {
    setSyncing(true);
    try {
      await apiSend('/api/v1/tax/deadlines', 'POST', { generateYear: year });
      await load();
      onChanged('Tenggat template disinkronkan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyinkronkan template.');
    } finally {
      setSyncing(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    if (!form.title.trim()) {
      setFormError('Judul wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      await apiSend('/api/v1/tax/deadlines', 'POST', {
        title: form.title.trim(),
        dueDate: form.dueDate,
        category: form.category,
        taxType: form.taxType || null,
        description: form.description || null,
        reminderDays: form.reminderDays
          .split(',')
          .map((part) => Number(part.trim()))
          .filter((n) => Number.isFinite(n) && n >= 0 && n <= 365),
      });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      await load();
      onChanged('Tenggat baru ditambahkan.');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan tenggat.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={`Kalender Kepatuhan ${year}`}
          subtitle="Tenggat nasional dibuat otomatis; tambahkan tenggat khusus workspace bila perlu."
          icon={<CalendarDays className="h-4 w-4" />}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => void load()} className={buttonCls.secondary}>
                <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
              </button>
              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={() => void syncTemplates()}
                    disabled={syncing}
                    className={buttonCls.secondary}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" /> {syncing ? 'Menyinkronkan...' : 'Sinkron template'}
                  </button>
                  <button type="button" onClick={() => setShowAdd(true)} className={buttonCls.primary}>
                    <Plus className="h-3.5 w-3.5" /> Tenggat baru
                  </button>
                </>
              ) : null}
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | DeadlineStatusKey)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-emerald-500"
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-[11px] text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="ALL">Semua kategori</option>
            {COMPLIANCE_CATEGORY_ORDER.map((value) => (
              <option key={value} value={value}>
                {COMPLIANCE_CATEGORY_LABEL[value]}
              </option>
            ))}
          </select>
          <span className="ml-auto text-[10px] text-slate-500">
            {counts.total} tenggat • <span className="font-semibold text-red-600">{counts.OVERDUE} terlambat</span> •{' '}
            <span className="font-semibold text-amber-600">{counts.DUE_SOON} segera</span>
          </span>
        </div>

        {error ? <div className="px-4 pt-3"><InlineError message={error} onRetry={() => void load()} /></div> : null}

        {loading && !data ? (
          <LoadingState label="Memuat kalender..." />
        ) : grouped.length === 0 ? (
          <EmptyState
            title="Tidak ada tenggat pada filter ini"
            message="Ubah filter status/kategori atau sinkronkan template tahun berjalan."
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {grouped.map((group) => (
              <div key={group.key}>
                <div className="flex items-center justify-between bg-slate-50/70 px-4 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{group.label}</p>
                  <span className="text-[10px] text-slate-400">{group.items.length} item</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {group.items.map((item) => {
                    const parts = dateParts(item.dueDate);
                    const isDone = item.status === 'DONE' || item.status === 'SKIPPED';
                    return (
                      <div key={item.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                        <div
                          className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg border text-center ${
                            item.status === 'OVERDUE'
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : item.status === 'DUE_SOON'
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-slate-200 bg-slate-50 text-slate-600'
                          }`}
                        >
                          <span className="font-mono text-sm font-bold leading-none">{parts.day}</span>
                          <span className="text-[9px] font-semibold uppercase leading-none">{parts.month}</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p
                              className={`text-xs font-semibold ${
                                isDone ? 'text-slate-400 line-through' : 'text-slate-800'
                              }`}
                            >
                              {item.title}
                            </p>
                            <Badge className={DEADLINE_STATUS_BADGE[item.status] ?? ''}>
                              {DEADLINE_STATUS_LABEL[item.status] ?? item.status}
                            </Badge>
                            {item.taxType ? (
                              <Badge className={TAX_TYPE_BADGE[item.taxType] ?? ''}>{taxTypeShort(item.taxType)}</Badge>
                            ) : null}
                            <Badge>{COMPLIANCE_CATEGORY_LABEL[item.category] ?? item.category}</Badge>
                            {item.source === 'CUSTOM' ? <Badge>Custom</Badge> : null}
                          </div>
                          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                            Jatuh tempo {parts.day} {parts.month} {parts.year}
                            {item.kind === 'PAYMENT' ? ' • setor' : item.kind === 'FILING' ? ' • lapor' : ''}
                            {!isDone
                              ? item.daysUntil < 0
                                ? ` • terlambat ${Math.abs(item.daysUntil)} hari`
                                : item.daysUntil === 0
                                  ? ' • hari ini'
                                  : ` • ${item.daysUntil} hari lagi`
                              : ''}
                          </p>
                          {item.description ? (
                            <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-400">{item.description}</p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                          {item.taxPeriodId ? (
                            <button type="button" onClick={() => onOpenPeriod(item.taxPeriodId!)} className={buttonCls.ghost}>
                              Buka masa <ChevronRight className="h-3 w-3" />
                            </button>
                          ) : null}
                          {canManage && !isDone ? (
                            <>
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => void patch(item.id, { status: 'DONE' }, 'Tenggat ditandai selesai.')}
                                className={buttonCls.primary}
                              >
                                <Check className="h-3 w-3" /> Selesai
                              </button>
                              <button
                                type="button"
                                disabled={busyId === item.id}
                                onClick={() => void patch(item.id, { status: 'SKIPPED' }, 'Tenggat dilewati.')}
                                className={buttonCls.ghost}
                              >
                                <CircleSlash className="h-3 w-3" /> Lewati
                              </button>
                            </>
                          ) : null}
                          {canManage && isDone ? (
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => void patch(item.id, { status: 'UPCOMING' }, 'Tenggat dibuka kembali.')}
                              className={buttonCls.ghost}
                            >
                              <RotateCcw className="h-3 w-3" /> Buka
                            </button>
                          ) : null}
                          {canManage ? (
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => void remove(item)}
                              className={buttonCls.danger}
                              aria-label="Hapus tenggat"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAdd ? (
        <Modal
          title="Tambah Tenggat Kepatuhan"
          subtitle="Tenggat custom tidak akan dibuat ulang otomatis."
          onClose={() => setShowAdd(false)}
          footer={
            <>
              <button type="button" onClick={() => setShowAdd(false)} className={buttonCls.secondary}>
                Batal
              </button>
              <button type="submit" form="tax-deadline-form" disabled={saving} className={buttonCls.primary}>
                {saving ? 'Menyimpan...' : 'Simpan tenggat'}
              </button>
            </>
          }
        >
          <form id="tax-deadline-form" onSubmit={submit} className="space-y-3">
            {formError ? <InlineError message={formError} /> : null}
            <Field label="Judul">
              <input
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className={inputCls}
                placeholder="mis. Lapor SPT Tahunan Badan"
                maxLength={200}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Jatuh tempo">
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Kategori">
                <select
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  className={inputCls}
                >
                  {COMPLIANCE_CATEGORY_ORDER.map((value) => (
                    <option key={value} value={value}>
                      {COMPLIANCE_CATEGORY_LABEL[value]}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Jenis pajak (opsional)">
              <select
                value={form.taxType}
                onChange={(event) => setForm({ ...form, taxType: event.target.value })}
                className={inputCls}
              >
                <option value="">Tidak terkait jenis pajak</option>
                {Object.entries(TAX_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pengingat (hari sebelum tenggat)" hint="Pisahkan dengan koma, mis. 14,7,3,1.">
              <input
                value={form.reminderDays}
                onChange={(event) => setForm({ ...form, reminderDays: event.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Catatan (opsional)">
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                rows={3}
                className={inputCls}
                maxLength={2000}
              />
            </Field>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
