'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Boxes,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  apiGet,
  apiSend,
  DEPRECIATION_METHODS,
  formatMoney,
  yearsFromMonths,
  type AssetCategory,
} from './client';
import {
  Alert,
  Field,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  Spinner,
  TextArea,
  TextInput,
} from './ui';

interface FormState {
  code: string;
  name: string;
  description: string;
  usefulLifeYears: string;
  method: string;
  salvageRate: string;
}

const empty = (): FormState => ({
  code: '',
  name: '',
  description: '',
  usefulLifeYears: '',
  method: '',
  salvageRate: '0',
});

export default function CategoryView({
  refreshKey,
  onChanged,
}: {
  refreshKey: number;
  onChanged: () => void;
}) {
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AssetCategory | null>(null);
  const [form, setForm] = useState<FormState>(empty());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiGet<{ data: AssetCategory[] }>('/api/v1/assets/categories');
      setCategories(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat kategori.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const seed = async () => {
    setSeeding(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiSend<{ message: string }>('/api/v1/assets/categories/seed', 'POST');
      setNotice(response.message);
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyiapkan kategori bawaan.');
    } finally {
      setSeeding(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(empty());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (category: AssetCategory) => {
    setEditing(category);
    setForm({
      code: category.code,
      name: category.name,
      description: category.description ?? '',
      usefulLifeYears: category.defaultUsefulLifeMonths
        ? String(category.defaultUsefulLifeMonths / 12)
        : '',
      method: category.defaultDepreciationMethod ?? '',
      salvageRate: String(category.defaultSalvageValueRate ?? 0),
    });
    setFormError(null);
    setModalOpen(true);
  };

  const submit = async () => {
    setFormError(null);
    if (!form.name.trim()) return setFormError('Nama kategori wajib diisi.');
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim() || form.name.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        defaultUsefulLifeMonths: form.usefulLifeYears
          ? Math.round(Number(form.usefulLifeYears) * 12)
          : null,
        defaultDepreciationMethod: form.method || null,
        defaultSalvageValueRate: Number(form.salvageRate) || 0,
      };
      if (editing) {
        await apiSend(`/api/v1/assets/categories/${editing.id}`, 'PATCH', payload);
      } else {
        await apiSend('/api/v1/assets/categories', 'POST', payload);
      }
      setModalOpen(false);
      setNotice(editing ? 'Kategori diperbarui.' : 'Kategori ditambahkan.');
      onChanged();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Kategori gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: AssetCategory) => {
    if (!window.confirm(`Hapus kategori "${category.name}"?`)) return;
    setError(null);
    try {
      await apiSend(`/api/v1/assets/categories/${category.id}`, 'DELETE');
      setNotice('Kategori dihapus.');
      onChanged();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kategori gagal dihapus.');
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold tracking-tight text-slate-900">Kategori Aset</h2>
          <p className="text-xs text-slate-500">
            Kategori menentukan masa manfaat, metode penyusutan, dan nilai sisa bawaan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton type="button" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </SecondaryButton>
          <SecondaryButton type="button" onClick={seed} disabled={seeding}>
            <Sparkles className="h-3.5 w-3.5" />
            {seeding ? 'Menyiapkan...' : 'Kategori Bawaan'}
          </SecondaryButton>
          <PrimaryButton type="button" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Tambah Kategori
          </PrimaryButton>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {loading && categories.length === 0 ? (
        <Spinner label="Memuat kategori..." />
      ) : categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
          <Boxes className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Belum ada kategori aset</p>
          <p className="mt-1 text-xs text-slate-500">
            Klik “Kategori Bawaan” untuk menyiapkan 8 kategori standar Indonesia.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                      {category.code}
                    </span>
                    {category.isSystem && (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Bawaan
                      </span>
                    )}
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-slate-900">{category.name}</h3>
                  {category.description && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-500">
                      {category.description}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(category)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    title="Ubah"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {!category.isSystem && (
                    <button
                      type="button"
                      onClick={() => void remove(category)}
                      className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      title="Hapus"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-2 text-[11px]">
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400">Masa manfaat</span>
                  <span className="font-medium text-slate-700">
                    {category.defaultUsefulLifeMonths
                      ? yearsFromMonths(category.defaultUsefulLifeMonths)
                      : 'Tidak disusutkan'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400">Metode</span>
                  <span className="font-medium text-slate-700">
                    {DEPRECIATION_METHODS.find(
                      (method) => method.value === category.defaultDepreciationMethod
                    )?.label ?? '-'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400">Nilai sisa</span>
                  <span className="font-medium text-slate-700">
                    {category.defaultSalvageValueRate ?? 0}%
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] uppercase tracking-wider text-slate-400">Aset</span>
                  <span className="font-medium text-slate-700">
                    {category.assetCount ?? 0} unit
                  </span>
                </div>
              </div>

              {(category.assetCount ?? 0) > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px]">
                  <span className="text-emerald-700">Nilai buku</span>
                  <span className="font-mono font-bold text-emerald-900">
                    {formatMoney(category.totalBookValue ?? 0)}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="md"
        title={editing ? `Ubah Kategori ${editing.name}` : 'Tambah Kategori Aset'}
        description="Nilai ini menjadi default saat mencatat aset baru; masih bisa diubah per aset."
        footer={
          <>
            <SecondaryButton type="button" onClick={() => setModalOpen(false)} disabled={saving}>
              Batal
            </SecondaryButton>
            <PrimaryButton type="button" onClick={submit} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Kategori'}
            </PrimaryButton>
          </>
        }
      >
        <div className="space-y-3">
          {formError && <Alert tone="error">{formError}</Alert>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Kode" hint="Huruf besar, tanpa spasi. Contoh: KENDARAAN">
              <TextInput
                value={form.code}
                onChange={(event) => set('code', event.target.value.toUpperCase())}
                placeholder="Otomatis dari nama"
              />
            </Field>
            <Field label="Nama Kategori" required>
              <TextInput value={form.name} onChange={(event) => set('name', event.target.value)} />
            </Field>
            <Field label="Masa Manfaat (tahun)">
              <TextInput
                type="number"
                min={0}
                step="0.5"
                value={form.usefulLifeYears}
                onChange={(event) => set('usefulLifeYears', event.target.value)}
                placeholder="Kosong = tidak disusutkan"
              />
            </Field>
            <Field label="Metode Default">
              <SelectInput value={form.method} onChange={(event) => set('method', event.target.value)}>
                <option value="">Tidak disusutkan</option>
                {DEPRECIATION_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
            <Field label="Nilai Sisa Default (%)">
              <TextInput
                type="number"
                min={0}
                max={100}
                step="0.5"
                value={form.salvageRate}
                onChange={(event) => set('salvageRate', event.target.value)}
              />
            </Field>
          </div>
          <Field label="Deskripsi">
            <TextArea
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
