'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Save, Sparkles } from 'lucide-react';
import {
  apiSend,
  DEPRECIATION_METHODS,
  formatMoney,
  toDateInput,
  yearsFromMonths,
  type Asset,
  type AssetCategory,
  type DepreciationMethodKey,
} from './client';
import { Alert, Field, Modal, PrimaryButton, SecondaryButton, SelectInput, TextArea, TextInput } from './ui';

interface MemberOption {
  id: string;
  fullName: string;
  email?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: (asset: Asset) => void;
  categories: AssetCategory[];
  members: MemberOption[];
  asset?: Asset | null;
  hasPostedDepreciation?: boolean;
}

interface FormState {
  name: string;
  assetCode: string;
  categoryId: string;
  acquisitionDate: string;
  acquisitionCost: string;
  salvageValue: string;
  isDepreciable: boolean;
  usefulLifeYears: string;
  usefulLifeMonths: string;
  depreciationMethod: DepreciationMethodKey;
  depreciationStartDate: string;
  totalEstimatedUnits: string;
  brand: string;
  model: string;
  serialNumber: string;
  location: string;
  department: string;
  custodianId: string;
  description: string;
}

const emptyForm = (): FormState => ({
  name: '',
  assetCode: '',
  categoryId: '',
  acquisitionDate: toDateInput(new Date()),
  acquisitionCost: '',
  salvageValue: '0',
  isDepreciable: true,
  usefulLifeYears: '8',
  usefulLifeMonths: '96',
  depreciationMethod: 'STRAIGHT_LINE',
  depreciationStartDate: '',
  totalEstimatedUnits: '',
  brand: '',
  model: '',
  serialNumber: '',
  location: '',
  department: '',
  custodianId: '',
  description: '',
});

function fromAsset(asset: Asset): FormState {
  const months = asset.usefulLifeMonths || 0;
  return {
    name: asset.name,
    assetCode: asset.assetCode,
    categoryId: asset.categoryId,
    acquisitionDate: toDateInput(asset.acquisitionDate),
    acquisitionCost: String(asset.acquisitionCost),
    salvageValue: String(asset.salvageValue),
    isDepreciable: asset.isDepreciable,
    usefulLifeYears: months ? String(months / 12) : '',
    usefulLifeMonths: String(months || ''),
    depreciationMethod: asset.depreciationMethod,
    depreciationStartDate: toDateInput(asset.depreciationStartDate),
    totalEstimatedUnits: asset.totalEstimatedUnits === null ? '' : String(asset.totalEstimatedUnits),
    brand: asset.brand ?? '',
    model: asset.model ?? '',
    serialNumber: asset.serialNumber ?? '',
    location: asset.location ?? '',
    department: asset.department ?? '',
    custodianId: asset.custodianId ?? '',
    description: asset.description ?? '',
  };
}

export default function AssetFormModal({
  open,
  onClose,
  onSaved,
  categories,
  members,
  asset,
  hasPostedDepreciation = false,
}: Props) {
  const [form, setForm] = useState<FormState>(() => (asset ? fromAsset(asset) : emptyForm()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setForm(asset ? fromAsset(asset) : emptyForm());
    setError(null);
  }, [open, asset]);

  const isEdit = Boolean(asset);
  const locked = isEdit && hasPostedDepreciation;

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === form.categoryId) ?? null,
    [categories, form.categoryId]
  );

  const applyCategoryDefaults = (categoryId: string) => {
    const category = categories.find((item) => item.id === categoryId);
    setForm((current) => {
      if (!category) return { ...current, categoryId };
      const months = category.defaultUsefulLifeMonths ?? 0;
      return {
        ...current,
        categoryId,
        isDepreciable: months > 0,
        usefulLifeMonths: months ? String(months) : current.usefulLifeMonths,
        usefulLifeYears: months ? String(months / 12) : current.usefulLifeYears,
        depreciationMethod: category.defaultDepreciationMethod ?? current.depreciationMethod,
        salvageValue: current.acquisitionCost
          ? String(
              Math.round(
                Number(current.acquisitionCost) *
                  ((category.defaultSalvageValueRate ?? 0) / 100) *
                  100
              ) / 100
            )
          : current.salvageValue,
      };
    });
  };

  const preview = useMemo(() => {
    const cost = Number(form.acquisitionCost) || 0;
    const salvage = Number(form.salvageValue) || 0;
    const months = Number(form.usefulLifeMonths) || 0;
    const depreciable = Math.max(0, cost - salvage);
    if (!form.isDepreciable || months <= 0 || depreciable <= 0) {
      return { depreciable, monthly: 0, annual: 0, note: 'Aset ini tidak disusutkan.' };
    }
    if (form.depreciationMethod === 'DECLINING_BALANCE') {
      const years = Math.max(1, Math.ceil(months / 12));
      const rate = (2 / years) * 100;
      return {
        depreciable,
        monthly: (cost * (rate / 100)) / 12,
        annual: cost * (rate / 100),
        note: `Tarif saldo menurun ${rate.toFixed(1)}% per tahun dari nilai buku.`,
      };
    }
    if (form.depreciationMethod === 'SUM_OF_YEARS_DIGITS') {
      const years = Math.max(1, Math.ceil(months / 12));
      const sum = (years * (years + 1)) / 2;
      return {
        depreciable,
        monthly: (depreciable / sum) / 12,
        annual: (depreciable * years) / sum,
        note: `Tahun pertama disusutkan ${((years / sum) * 100).toFixed(1)}% dari nilai tersusutkan.`,
      };
    }
    if (form.depreciationMethod === 'UNITS_OF_PRODUCTION') {
      const units = Number(form.totalEstimatedUnits) || 0;
      return {
        depreciable,
        monthly: 0,
        annual: 0,
        note:
          units > 0
            ? `Tarif Rp ${(depreciable / units).toLocaleString('id-ID')} per unit (estimasi ${units.toLocaleString('id-ID')} unit).`
            : 'Isi total estimasi unit untuk metode unit produksi.',
      };
    }
    return {
      depreciable,
      monthly: depreciable / months,
      annual: (depreciable / months) * 12,
      note: 'Beban sama setiap bulan.',
    };
  }, [form]);

  const submit = async () => {
    setError(null);
    if (!form.name.trim()) return setError('Nama aset wajib diisi.');
    if (!form.categoryId) return setError('Kategori aset wajib dipilih.');
    if (!form.acquisitionDate) return setError('Tanggal perolehan wajib diisi.');
    if (!(Number(form.acquisitionCost) > 0)) return setError('Nilai perolehan harus lebih besar dari 0.');
    if (Number(form.salvageValue) > Number(form.acquisitionCost)) {
      return setError('Nilai sisa tidak boleh melebihi nilai perolehan.');
    }
    if (form.isDepreciable && !(Number(form.usefulLifeMonths) > 0)) {
      return setError('Masa manfaat harus lebih besar dari 0.');
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        assetCode: form.assetCode.trim() || undefined,
        categoryId: form.categoryId,
        acquisitionDate: form.acquisitionDate,
        acquisitionCost: Number(form.acquisitionCost),
        salvageValue: Number(form.salvageValue) || 0,
        isDepreciable: form.isDepreciable,
        usefulLifeMonths: form.isDepreciable ? Math.max(1, Math.round(Number(form.usefulLifeMonths))) : 0,
        depreciationMethod: form.depreciationMethod,
        depreciationStartDate: form.depreciationStartDate || form.acquisitionDate,
        totalEstimatedUnits: form.totalEstimatedUnits ? Number(form.totalEstimatedUnits) : null,
        brand: form.brand.trim() || null,
        model: form.model.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        location: form.location.trim() || null,
        department: form.department.trim() || null,
        custodianId: form.custodianId || null,
        description: form.description.trim() || null,
      };

      const response = isEdit
        ? await apiSend<{ data: Asset; message?: string }>(`/api/v1/assets/${asset!.id}`, 'PATCH', payload)
        : await apiSend<{ data: Asset; message?: string }>('/api/v1/assets', 'POST', payload);

      onSaved(response.data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aset gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={isEdit ? `Ubah Aset ${asset?.assetCode ?? ''}` : 'Catat Aset Baru'}
      description={
        isEdit
          ? 'Perubahan pada nilai perolehan, masa manfaat, atau metode dikunci setelah ada jurnal penyusutan.'
          : 'Isi data perolehan dan kebijakan penyusutan. Kode aset dibuat otomatis bila dikosongkan.'
      }
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={saving}>
            Batal
          </SecondaryButton>
          <PrimaryButton type="button" onClick={submit} disabled={saving}>
            <Save className={`h-3.5 w-3.5 ${saving ? 'animate-pulse' : ''}`} />
            {saving ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Simpan Aset'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        {locked && (
          <Alert tone="warning">
            Aset ini sudah memiliki jurnal penyusutan yang diposting. Nilai perolehan, nilai sisa, masa
            manfaat, dan metode tidak dapat diubah. Gunakan jurnal penyesuaian untuk koreksi.
          </Alert>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nama Aset" required className="sm:col-span-2">
            <TextInput
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="Contoh: Laptop Lenovo ThinkPad T14"
            />
          </Field>

          <Field label="Kategori" required>
            <SelectInput
              value={form.categoryId}
              onChange={(event) => applyCategoryDefaults(event.target.value)}
              disabled={locked}
            >
              <option value="">Pilih kategori</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </SelectInput>
            {selectedCategory && (
              <span className="mt-1 block text-[11px] text-slate-400">
                Bawaan: {yearsFromMonths(selectedCategory.defaultUsefulLifeMonths ?? 0)} ·{' '}
                {selectedCategory.defaultDepreciationMethod
                  ? DEPRECIATION_METHODS.find(
                      (method) => method.value === selectedCategory.defaultDepreciationMethod
                    )?.label
                  : 'Tidak disusutkan'}
              </span>
            )}
          </Field>

          <Field label="Kode Aset" hint="Kosongkan untuk dibuat otomatis: AST-KATEGORI-0001">
            <TextInput
              value={form.assetCode}
              onChange={(event) => set('assetCode', event.target.value.toUpperCase())}
              placeholder="Otomatis"
              disabled={isEdit}
            />
          </Field>

          <Field label="Tanggal Perolehan" required>
            <TextInput
              type="date"
              value={form.acquisitionDate}
              onChange={(event) => set('acquisitionDate', event.target.value)}
            />
          </Field>

          <Field label="Nilai Perolehan (Rp)" required>
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={form.acquisitionCost}
              onChange={(event) => set('acquisitionCost', event.target.value)}
              disabled={locked}
              placeholder="0"
            />
          </Field>

          <Field label="Nilai Sisa (Rp)" hint="Estimasi nilai jual di akhir masa manfaat.">
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={form.salvageValue}
              onChange={(event) => set('salvageValue', event.target.value)}
              disabled={locked}
            />
          </Field>

          <Field label="Lokasi">
            <TextInput
              value={form.location}
              onChange={(event) => set('location', event.target.value)}
              placeholder="Contoh: Kantor Pusat - Lantai 2"
            />
          </Field>

          <Field label="Divisi / Departemen">
            <TextInput
              value={form.department}
              onChange={(event) => set('department', event.target.value)}
              placeholder="Contoh: Operasional"
            />
          </Field>

          <Field label="Penanggung Jawab">
            <SelectInput
              value={form.custodianId}
              onChange={(event) => set('custodianId', event.target.value)}
            >
              <option value="">Belum ditentukan</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field label="Merek">
            <TextInput value={form.brand} onChange={(event) => set('brand', event.target.value)} />
          </Field>

          <Field label="Model / Tipe">
            <TextInput value={form.model} onChange={(event) => set('model', event.target.value)} />
          </Field>

          <Field label="Nomor Seri">
            <TextInput
              value={form.serialNumber}
              onChange={(event) => set('serialNumber', event.target.value)}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-bold text-slate-800">Kebijakan Penyusutan</span>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={form.isDepreciable}
                onChange={(event) => set('isDepreciable', event.target.checked)}
                disabled={locked}
                className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Disusutkan
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Metode Penyusutan">
              <SelectInput
                value={form.depreciationMethod}
                onChange={(event) => set('depreciationMethod', event.target.value as DepreciationMethodKey)}
                disabled={locked || !form.isDepreciable}
              >
                {DEPRECIATION_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field label="Masa Manfaat">
              <div className="flex items-center gap-2">
                <TextInput
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.usefulLifeYears}
                  onChange={(event) => {
                    const years = event.target.value;
                    set('usefulLifeYears', years);
                    set('usefulLifeMonths', years ? String(Math.round(Number(years) * 12)) : '');
                  }}
                  disabled={locked || !form.isDepreciable}
                />
                <span className="shrink-0 text-xs text-slate-500">tahun</span>
              </div>
              <span className="mt-1 block text-[11px] text-slate-400">
                {form.usefulLifeMonths ? `${form.usefulLifeMonths} bulan` : 'Belum diisi'}
              </span>
            </Field>

            <Field label="Mulai Disusutkan" hint="Kosongkan untuk mengikuti tanggal perolehan.">
              <TextInput
                type="date"
                value={form.depreciationStartDate}
                onChange={(event) => set('depreciationStartDate', event.target.value)}
                disabled={locked || !form.isDepreciable}
              />
            </Field>

            {form.depreciationMethod === 'UNITS_OF_PRODUCTION' && (
              <Field label="Total Estimasi Unit">
                <TextInput
                  type="number"
                  min={0}
                  value={form.totalEstimatedUnits}
                  onChange={(event) => set('totalEstimatedUnits', event.target.value)}
                  disabled={locked || !form.isDepreciable}
                />
              </Field>
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2.5 text-[11px] sm:grid-cols-3">
            <div>
              <span className="block uppercase tracking-wider text-slate-400">Nilai tersusutkan</span>
              <span className="font-mono font-bold text-slate-800">{formatMoney(preview.depreciable)}</span>
            </div>
            <div>
              <span className="block uppercase tracking-wider text-slate-400">Beban bulan pertama</span>
              <span className="font-mono font-bold text-emerald-700">{formatMoney(preview.monthly)}</span>
            </div>
            <div className="sm:col-span-1">
              <span className="block uppercase tracking-wider text-slate-400">Catatan</span>
              <span className="text-slate-600">{preview.note}</span>
            </div>
          </div>

          {form.depreciationMethod !== 'STRAIGHT_LINE' && form.isDepreciable && (
            <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
              Angka di atas hanya perkiraan awal. Jadwal pasti dihitung otomatis saat penyusutan dijalankan.
            </p>
          )}
        </div>

        <Field label="Catatan / Deskripsi">
          <TextArea
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="Spesifikasi, kondisi awal, atau keterangan lain."
          />
        </Field>
      </div>
    </Modal>
  );
}
