'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save, Settings, ShieldCheck } from 'lucide-react';
import { apiGet, apiSend } from '../accounting/client';
import {
  Card,
  CardHeader,
  Field,
  InlineError,
  LoadingState,
  buttonCls,
  inputCls,
} from './ui';
import {
  TAX_COMPONENT_LABEL,
  taxTypeShort,
} from '@/lib/tax/constants';
import type { AccountMap, AccountOption, TaxSettingsResponse } from './types';

const PROFILES = [
  { value: 'UMKM_NON_PKP', label: 'UMKM Non-PKP' },
  { value: 'UMKM_PKP', label: 'UMKM PKP' },
  { value: 'BADAN_NORMAL', label: 'Badan Normal' },
];

const ENTITY_TYPES = [
  { value: 'BADAN_USAHA', label: 'Badan Usaha (PT)' },
  { value: 'ORANG_PRIBADI', label: 'Orang Pribadi' },
  { value: 'CV', label: 'CV' },
  { value: 'FIRMA', label: 'Firma' },
  { value: 'KOPERASI', label: 'Koperasi' },
  { value: 'YAYASAN', label: 'Yayasan' },
];

const REMINDER_CHANNELS = [
  { value: 'IN_APP', label: 'Dalam aplikasi (default)' },
  { value: 'EMAIL', label: 'Email (belum aktif)' },
  { value: 'WHATSAPP', label: 'WhatsApp (belum aktif)' },
  { value: 'NONE', label: 'Nonaktif' },
];

const PPH21_METHODS = [
  { value: 'MANUAL', label: 'Manual dari slip gaji' },
  { value: 'TER', label: 'TER (tarif efektif)' },
  { value: 'GROSS_UP', label: 'Gross up' },
];

const MAP_ROWS: Array<{ taxType: string; component: string }> = [
  { taxType: 'PPN', component: 'OUTPUT' },
  { taxType: 'PPN', component: 'INPUT' },
  { taxType: 'PPH_21', component: 'WITHHOLDING' },
  { taxType: 'PPH_23', component: 'WITHHOLDING' },
  { taxType: 'PPH_4_2', component: 'WITHHOLDING' },
  { taxType: 'PPH_FINAL_UMKM', component: 'PAYABLE' },
  { taxType: 'BPJS', component: 'PAYABLE' },
];

interface FormState {
  taxProfile: string;
  entityType: string;
  enablePpn: boolean;
  npwp: string;
  nik: string;
  kppName: string;
  pkpEffectiveDate: string;
  ppnRate: string;
  pphFinalRate: string;
  pph23Rate: string;
  pph42Rate: string;
  umkmThreshold: string;
  pph21Method: string;
  taxReminderDays: string;
  taxReminderChannel: string;
}

function toForm(data: TaxSettingsResponse): FormState {
  const setting = data.setting;
  const pkp = setting.pkpEffectiveDate ? new Date(setting.pkpEffectiveDate) : null;
  return {
    taxProfile: setting.taxProfile,
    entityType: setting.entityType,
    enablePpn: setting.enablePpn,
    npwp: setting.npwp ?? '',
    nik: setting.nik ?? '',
    kppName: setting.kppName ?? '',
    pkpEffectiveDate: pkp && !Number.isNaN(pkp.getTime()) ? pkp.toISOString().slice(0, 10) : '',
    ppnRate: String(setting.ppnRate),
    pphFinalRate: String(setting.pphFinalRate),
    pph23Rate: String(setting.pph23Rate),
    pph42Rate: String(setting.pph42Rate),
    umkmThreshold: String(setting.umkmThreshold),
    pph21Method: setting.pph21Method,
    taxReminderDays: (setting.taxReminderDays ?? []).join(', '),
    taxReminderChannel: setting.taxReminderChannel,
  };
}

export function TaxSettingsView({
  workspaceId,
  canManage,
  onChanged,
}: {
  workspaceId: string;
  canManage: boolean;
  onChanged: (message?: string) => void;
}) {
  const [data, setData] = useState<TaxSettingsResponse | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [maps, setMaps] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<TaxSettingsResponse & { success: boolean }>('/api/v1/tax/settings')
      .then((result) => {
        if (!alive) return;
        setData(result);
        setForm(toForm(result));
        const mapState: Record<string, string> = {};
        for (const map of result.accountMaps as AccountMap[]) {
          mapState[`${map.taxType}:${map.component}`] = map.accountId;
        }
        setMaps(mapState);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat pengaturan pajak.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const accountsById = useMemo(() => {
    const map = new Map<string, AccountOption>();
    for (const account of accounts) map.set(account.id, account);
    return map;
  }, [accounts]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        taxProfile: form.taxProfile,
        entityType: form.entityType,
        enablePpn: form.enablePpn,
        npwp: form.npwp || null,
        nik: form.nik || null,
        kppName: form.kppName || null,
        pkpEffectiveDate: form.pkpEffectiveDate || null,
        ppnRate: Number(form.ppnRate),
        pphFinalRate: Number(form.pphFinalRate),
        pph23Rate: Number(form.pph23Rate),
        pph42Rate: Number(form.pph42Rate),
        umkmThreshold: Number(form.umkmThreshold),
        pph21Method: form.pph21Method,
        taxReminderDays: form.taxReminderDays
          .split(',')
          .map((part) => Number(part.trim()))
          .filter((n) => Number.isFinite(n) && n >= 0 && n <= 365),
        taxReminderChannel: form.taxReminderChannel,
        accountMaps: MAP_ROWS.filter((row) => maps[`${row.taxType}:${row.component}`]).map((row) => ({
          taxType: row.taxType,
          component: row.component,
          accountId: maps[`${row.taxType}:${row.component}`],
        })),
      };
      await apiSend('/api/v1/tax/settings', 'PATCH', payload);
      const refreshed = await apiGet<TaxSettingsResponse & { success: boolean }>('/api/v1/tax/settings');
      setData(refreshed);
      setForm(toForm(refreshed));
      const mapState: Record<string, string> = {};
      for (const map of refreshed.accountMaps) {
        mapState[`${map.taxType}:${map.component}`] = map.accountId;
      }
      setMaps(mapState);
      setSuccess('Pengaturan pajak tersimpan.');
      onChanged('Pengaturan pajak diperbarui.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan pajak.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <LoadingState label="Memuat pengaturan pajak..." />
      </Card>
    );
  }

  if (!form || !data) {
    return (
      <Card>
        <div className="p-4">
          <InlineError message={error ?? 'Pengaturan pajak tidak tersedia.'} />
        </div>
      </Card>
    );
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {data.hasAccountingSetting === false ? (
        <div className="flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-relaxed text-blue-800">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Modul akuntansi belum diinisialisasi. Pengaturan pajak tetap bisa disimpan, tetapi pemetaan akun dan
          rekonsiliasi jurnal baru aktif setelah bagan akun dibuat.
        </div>
      ) : null}

      {error ? <InlineError message={error} /> : null}
      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-800">
          {success}
        </div>
      ) : null}

      <Card>
        <CardHeader
          title="Identitas & Profil Pajak"
          subtitle="Dipakai untuk faktur, rekap, dan berkas ekspor."
          icon={<Settings className="h-4 w-4" />}
        />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Profil pajak" hint="Mengubah profil setelah ada jurnal diposting akan ditolak server.">
            <select
              value={form.taxProfile}
              onChange={(event) => {
                const value = event.target.value;
                setForm({ ...form, taxProfile: value, enablePpn: value !== 'UMKM_NON_PKP' });
              }}
              disabled={!canManage}
              className={inputCls}
            >
              {PROFILES.map((profile) => (
                <option key={profile.value} value={profile.value}>
                  {profile.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Bentuk badan usaha">
            <select
              value={form.entityType}
              onChange={(event) => setForm({ ...form, entityType: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            >
              {ENTITY_TYPES.map((entity) => (
                <option key={entity.value} value={entity.value}>
                  {entity.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Metode PPh 21" hint="PPh 21 saat ini dibaca dari slip gaji (manual).">
            <select
              value={form.pph21Method}
              onChange={(event) => setForm({ ...form, pph21Method: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            >
              {PPH21_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="NPWP">
            <input
              value={form.npwp}
              onChange={(event) => setForm({ ...form, npwp: event.target.value })}
              disabled={!canManage}
              className={inputCls}
              placeholder="00.000.000.0-000.000"
            />
          </Field>
          <Field label="NIK (jika Orang Pribadi)">
            <input
              value={form.nik}
              onChange={(event) => setForm({ ...form, nik: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            />
          </Field>
          <Field label="Nama KPP">
            <input
              value={form.kppName}
              onChange={(event) => setForm({ ...form, kppName: event.target.value })}
              disabled={!canManage}
              className={inputCls}
              placeholder="mis. KPP Pratama Jakarta Selatan"
            />
          </Field>
          <Field label="Tanggal efektif PKP">
            <input
              type="date"
              value={form.pkpEffectiveDate}
              onChange={(event) => setForm({ ...form, pkpEffectiveDate: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2">
            <input
              type="checkbox"
              checked={form.enablePpn}
              onChange={(event) => setForm({ ...form, enablePpn: event.target.checked })}
              disabled={!canManage}
              className="mb-0.5 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-[11px] font-medium text-slate-700">
              Aktifkan masa pajak PPN
              <span className="block text-[9px] font-normal text-slate-400">
                Non-PKP: biarkan tidak dicentang.
              </span>
            </span>
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Tarif & Ambang"
          subtitle="Tarif disimpan sebagai persen (11 berarti 11%)."
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Tarif PPN (%)">
            <input
              type="number"
              step="0.01"
              value={form.ppnRate}
              onChange={(event) => setForm({ ...form, ppnRate: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            />
          </Field>
          <Field label="Tarif PPh Final UMKM (%)">
            <input
              type="number"
              step="0.01"
              value={form.pphFinalRate}
              onChange={(event) => setForm({ ...form, pphFinalRate: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            />
          </Field>
          <Field label="Ambang bebas PPh Final (Rp)" hint="Rp 500 juta khusus WP Orang Pribadi.">
            <input
              type="number"
              value={form.umkmThreshold}
              onChange={(event) => setForm({ ...form, umkmThreshold: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            />
          </Field>
          <Field label="Tarif PPh 23 (%)">
            <input
              type="number"
              step="0.01"
              value={form.pph23Rate}
              onChange={(event) => setForm({ ...form, pph23Rate: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            />
          </Field>
          <Field label="Tarif PPh 4(2) (%)">
            <input
              type="number"
              step="0.01"
              value={form.pph42Rate}
              onChange={(event) => setForm({ ...form, pph42Rate: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            />
          </Field>
          <Field label="Kanal pengingat" hint="Fase ini hanya pengingat dalam aplikasi.">
            <select
              value={form.taxReminderChannel}
              onChange={(event) => setForm({ ...form, taxReminderChannel: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            >
              {REMINDER_CHANNELS.map((channel) => (
                <option key={channel.value} value={channel.value}>
                  {channel.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Pengingat (hari sebelum)" hint="Pisahkan dengan koma.">
            <input
              value={form.taxReminderDays}
              onChange={(event) => setForm({ ...form, taxReminderDays: event.target.value })}
              disabled={!canManage}
              className={inputCls}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Pemetaan Akun Pajak"
          subtitle="Dipakai untuk rekonsiliasi rekap dengan jurnal. Kosongkan bila belum ingin memetakan."
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left">
            <thead>
              <tr className="bg-slate-50/70 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2 font-semibold">Jenis</th>
                <th className="px-3 py-2 font-semibold">Komponen</th>
                <th className="px-3 py-2 font-semibold">Akun COA</th>
              </tr>
            </thead>
            <tbody>
              {MAP_ROWS.map((row) => {
                const key = `${row.taxType}:${row.component}`;
                const selected = maps[key] ?? '';
                return (
                  <tr key={key} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 text-[11px] font-medium text-slate-700">{taxTypeShort(row.taxType)}</td>
                    <td className="px-3 py-2 text-[10px] text-slate-500">
                      {TAX_COMPONENT_LABEL[row.component as keyof typeof TAX_COMPONENT_LABEL] ?? row.component}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={selected}
                        onChange={(event) => setMaps({ ...maps, [key]: event.target.value })}
                        disabled={!canManage}
                        className={inputCls}
                      >
                        <option value="">— Tidak dipetakan —</option>
                        {accounts.map((account) => (
                          <option key={account.id} value={account.id}>
                            {account.code} — {account.name}
                          </option>
                        ))}
                      </select>
                      {selected && accountsById.get(selected) ? (
                        <p className="mt-0.5 text-[9px] text-slate-400">
                          {accountsById.get(selected)?.code} · {accountsById.get(selected)?.name}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-xs">
        <p className="text-[10px] leading-relaxed text-slate-500">
          Perubahan tarif berlaku untuk perhitungan berikutnya; snapshot masa pajak yang sudah dilaporkan tidak diubah.
        </p>
        {canManage ? (
          <button type="submit" disabled={saving} className={buttonCls.primary}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saving ? 'Menyimpan...' : 'Simpan pengaturan'}
          </button>
        ) : (
          <span className="text-[10px] font-semibold text-slate-400">Hanya owner yang dapat mengubah pengaturan.</span>
        )}
      </div>
    </form>
  );
}
