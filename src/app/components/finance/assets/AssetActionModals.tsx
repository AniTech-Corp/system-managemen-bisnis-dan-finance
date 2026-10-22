'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, ShieldAlert, Wrench } from 'lucide-react';
import {
  apiSend,
  DISPOSAL_METHODS,
  formatMoney,
  MAINTENANCE_TYPES,
  toDateInput,
  type Asset,
  type DisposalMethodKey,
  type MaintenanceTypeKey,
} from './client';
import {
  Alert,
  DangerButton,
  Field,
  Modal,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextArea,
  TextInput,
} from './ui';

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

/* ───────────────────────── Pelepasan aset ───────────────────────── */

export function DisposeAssetModal({
  open,
  onClose,
  asset,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  asset: Asset | null;
  onDone: () => void;
}) {
  const [method, setMethod] = useState<DisposalMethodKey>('SALE');
  const [date, setDate] = useState(toDateInput(new Date()));
  const [proceeds, setProceeds] = useState('0');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMethod('SALE');
    setDate(toDateInput(new Date()));
    setProceeds('0');
    setNotes('');
    setError(null);
  }, [open, asset?.id]);

  const carrying = useMemo(() => {
    if (!asset) return 0;
    return round2(
      Math.max(0, asset.acquisitionCost - asset.accumulatedDepreciation - asset.accumulatedImpairment)
    );
  }, [asset]);

  const gainLoss = round2((Number(proceeds) || 0) - carrying);

  const submit = async () => {
    if (!asset) return;
    setError(null);
    setSaving(true);
    try {
      await apiSend(`/api/v1/assets/${asset.id}/dispose`, 'POST', {
        disposalMethod: method,
        disposalDate: date,
        disposalProceeds: Number(proceeds) || 0,
        notes: notes.trim() || null,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pelepasan gagal diproses.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pelepasan Aset ${asset?.assetCode ?? ''}`}
      description="Aset yang dilepas tidak bisa dimutasi lagi. Jurnal pelepasan dibuat otomatis bila akuntansi aktif."
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={saving}>
            Batal
          </SecondaryButton>
          <DangerButton type="button" onClick={submit} disabled={saving}>
            <AlertTriangle className="h-3.5 w-3.5" />
            {saving ? 'Memproses...' : 'Proses Pelepasan'}
          </DangerButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Harga perolehan</span>
            <span className="font-mono font-semibold text-slate-800">
              {formatMoney(asset?.acquisitionCost ?? 0)}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-slate-500">Akumulasi penyusutan</span>
            <span className="font-mono font-semibold text-slate-800">
              {formatMoney(asset?.accumulatedDepreciation ?? 0)}
            </span>
          </div>
          {(asset?.accumulatedImpairment ?? 0) > 0 && (
            <div className="mt-1 flex items-center justify-between">
              <span className="text-slate-500">Akumulasi penurunan nilai</span>
              <span className="font-mono font-semibold text-slate-800">
                {formatMoney(asset?.accumulatedImpairment ?? 0)}
              </span>
            </div>
          )}
          <div className="mt-1.5 flex items-center justify-between border-t border-slate-200 pt-1.5">
            <span className="font-semibold text-slate-700">Nilai buku saat ini</span>
            <span className="font-mono font-bold text-slate-900">{formatMoney(carrying)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Metode Pelepasan">
            <SelectInput value={method} onChange={(event) => setMethod(event.target.value as DisposalMethodKey)}>
              {DISPOSAL_METHODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Tanggal Pelepasan">
            <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field
            label="Hasil Pelepasan (Rp)"
            hint="Isi 0 untuk aset yang dihapuskan atau disumbangkan."
            className="sm:col-span-2"
          >
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={proceeds}
              onChange={(event) => setProceeds(event.target.value)}
            />
          </Field>
        </div>

        <div
          className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
            gainLoss >= 0
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          {gainLoss >= 0 ? 'Perkiraan keuntungan pelepasan: ' : 'Perkiraan kerugian pelepasan: '}
          <span className="font-mono">{formatMoney(Math.abs(gainLoss))}</span>
        </div>

        <Field label="Catatan">
          <TextArea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Alasan pelepasan, pembeli, atau nomor dokumen."
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ───────────────────────── Mutasi aset ───────────────────────── */

export function TransferAssetModal({
  open,
  onClose,
  asset,
  members,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  asset: Asset | null;
  members: Array<{ id: string; fullName: string; email?: string }>;
  onDone: () => void;
}) {
  const [date, setDate] = useState(toDateInput(new Date()));
  const [toLocation, setToLocation] = useState('');
  const [toCustodianId, setToCustodianId] = useState('');
  const [toDepartment, setToDepartment] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(toDateInput(new Date()));
    setToLocation(asset?.location ?? '');
    setToCustodianId('');
    setToDepartment(asset?.department ?? '');
    setReason('');
    setError(null);
  }, [open, asset?.id, asset?.location, asset?.department]);

  const submit = async () => {
    if (!asset) return;
    setError(null);
    if (!toLocation.trim() && !toCustodianId && !toDepartment.trim()) {
      return setError('Isi minimal satu tujuan mutasi.');
    }
    setSaving(true);
    try {
      await apiSend(`/api/v1/assets/${asset.id}/transfer`, 'POST', {
        transferDate: date,
        toLocation: toLocation.trim() || null,
        toCustodianId: toCustodianId || null,
        toDepartment: toDepartment.trim() || null,
        reason: reason.trim() || null,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mutasi gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mutasi Aset ${asset?.assetCode ?? ''}`}
      description="Riwayat mutasi tersimpan permanen; data aset diperbarui ke tujuan terakhir."
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={saving}>
            Batal
          </SecondaryButton>
          <PrimaryButton type="button" onClick={submit} disabled={saving}>
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {saving ? 'Menyimpan...' : 'Catat Mutasi'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tanggal Mutasi" required>
            <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Lokasi Saat Ini">
            <TextInput value={asset?.location ?? '-'} disabled />
          </Field>
          <Field label="Lokasi Tujuan">
            <TextInput
              value={toLocation}
              onChange={(event) => setToLocation(event.target.value)}
              placeholder="Contoh: Gudang Cikarang"
            />
          </Field>
          <Field label="Penanggung Jawab Baru">
            <SelectInput value={toCustodianId} onChange={(event) => setToCustodianId(event.target.value)}>
              <option value="">Tetap: {asset?.custodian?.fullName ?? 'belum ditentukan'}</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Divisi Tujuan">
            <TextInput
              value={toDepartment}
              onChange={(event) => setToDepartment(event.target.value)}
              placeholder="Contoh: Produksi"
            />
          </Field>
          <Field label="Alasan Mutasi">
            <TextInput
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: Kebutuhan proyek cabang"
            />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* ───────────────────── Penurunan nilai aset ───────────────────── */

export function ImpairAssetModal({
  open,
  onClose,
  asset,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  asset: Asset | null;
  onDone: () => void;
}) {
  const [date, setDate] = useState(toDateInput(new Date()));
  const [recoverable, setRecoverable] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDate(toDateInput(new Date()));
    setRecoverable('');
    setDescription('');
    setError(null);
  }, [open, asset?.id]);

  const carrying = useMemo(() => {
    if (!asset) return 0;
    return round2(
      Math.max(0, asset.acquisitionCost - asset.accumulatedDepreciation - asset.accumulatedImpairment)
    );
  }, [asset]);

  const loss = round2(carrying - (Number(recoverable) || 0));

  const submit = async () => {
    if (!asset) return;
    setError(null);
    if (!(Number(recoverable) >= 0)) return setError('Nilai yang dapat dipulihkan wajib diisi.');
    if (loss <= 0) return setError('Nilai yang dapat dipulihkan tidak lebih kecil dari nilai buku.');
    setSaving(true);
    try {
      await apiSend(`/api/v1/assets/${asset.id}/impair`, 'POST', {
        impairmentDate: date,
        recoverableAmount: Number(recoverable),
        description: description.trim() || null,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Penurunan nilai gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Penurunan Nilai ${asset?.assetCode ?? ''}`}
      description="Catat bila nilai yang dapat dipulihkan lebih rendah dari nilai buku aset."
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={saving}>
            Batal
          </SecondaryButton>
          <DangerButton type="button" onClick={submit} disabled={saving}>
            <ShieldAlert className="h-3.5 w-3.5" />
            {saving ? 'Menyimpan...' : 'Akui Penurunan Nilai'}
          </DangerButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tanggal Penurunan Nilai" required>
            <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Nilai Buku Saat Ini">
            <TextInput value={formatMoney(carrying)} disabled />
          </Field>
          <Field label="Nilai yang Dapat Dipulihkan (Rp)" required className="sm:col-span-2">
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={recoverable}
              onChange={(event) => setRecoverable(event.target.value)}
              placeholder="Harga pasar wajar atau nilai pakai"
            />
          </Field>
        </div>

        {Number(recoverable) > 0 && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs font-semibold ${
              loss > 0
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {loss > 0
              ? `Kerugian penurunan nilai yang diakui: Rp ${Math.abs(loss).toLocaleString('id-ID')}`
              : 'Tidak ada penurunan nilai: nilai pulih ≥ nilai buku.'}
          </div>
        )}

        <Field label="Alasan / Dasar Penilaian">
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Contoh: Kerusakan permanen, penurunan harga pasar, atau perubahan pemakaian."
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ───────────────────── Pemeliharaan aset ───────────────────── */

export function MaintenanceFormModal({
  open,
  onClose,
  assets,
  defaultAssetId,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  assets: Asset[];
  defaultAssetId?: string | null;
  onDone: () => void;
}) {
  const [assetId, setAssetId] = useState(defaultAssetId ?? '');
  const [date, setDate] = useState(toDateInput(new Date()));
  const [type, setType] = useState<MaintenanceTypeKey>('PREVENTIVE');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('0');
  const [vendor, setVendor] = useState('');
  const [performedBy, setPerformedBy] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setAssetId(defaultAssetId ?? '');
    setDate(toDateInput(new Date()));
    setType('PREVENTIVE');
    setDescription('');
    setCost('0');
    setVendor('');
    setPerformedBy('');
    setNextDate('');
    setNotes('');
    setError(null);
  }, [open, defaultAssetId]);

  const submit = async () => {
    setError(null);
    if (!assetId) return setError('Pilih aset terlebih dahulu.');
    if (!description.trim()) return setError('Deskripsi pemeliharaan wajib diisi.');
    setSaving(true);
    try {
      await apiSend('/api/v1/assets/maintenance', 'POST', {
        assetId,
        maintenanceDate: date,
        type,
        description: description.trim(),
        cost: Number(cost) || 0,
        vendor: vendor.trim() || null,
        performedBy: performedBy.trim() || null,
        nextMaintenanceDate: nextDate || null,
        notes: notes.trim() || null,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pemeliharaan gagal disimpan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Catat Pemeliharaan Aset"
      description="Riwayat biaya pemeliharaan membantu menilai apakah aset masih layak dipertahankan."
      footer={
        <>
          <SecondaryButton type="button" onClick={onClose} disabled={saving}>
            Batal
          </SecondaryButton>
          <PrimaryButton type="button" onClick={submit} disabled={saving}>
            <Wrench className="h-3.5 w-3.5" />
            {saving ? 'Menyimpan...' : 'Simpan Pemeliharaan'}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-3">
        {error && <Alert tone="error">{error}</Alert>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Aset" required className="sm:col-span-2">
            <SelectInput value={assetId} onChange={(event) => setAssetId(event.target.value)}>
              <option value="">Pilih aset</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.assetCode} — {asset.name}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Tanggal" required>
            <TextInput type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Jenis Pemeliharaan">
            <SelectInput
              value={type}
              onChange={(event) => setType(event.target.value as MaintenanceTypeKey)}
            >
              {MAINTENANCE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </SelectInput>
          </Field>
          <Field label="Biaya (Rp)">
            <TextInput
              type="number"
              min={0}
              step="0.01"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
          </Field>
          <Field label="Vendor / Bengkel">
            <TextInput value={vendor} onChange={(event) => setVendor(event.target.value)} />
          </Field>
          <Field label="Dikerjakan Oleh">
            <TextInput value={performedBy} onChange={(event) => setPerformedBy(event.target.value)} />
          </Field>
          <Field label="Jadwal Berikutnya">
            <TextInput type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Deskripsi Pekerjaan" required>
          <TextArea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Contoh: Servis rutin 10.000 km, ganti oli dan filter."
          />
        </Field>
        <Field label="Catatan Tambahan">
          <TextArea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
