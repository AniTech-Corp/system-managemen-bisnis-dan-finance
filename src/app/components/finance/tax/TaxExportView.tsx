'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Loader2,
  Table2,
} from 'lucide-react';
import { ACTIVE_TAX_TYPES, TAX_TYPE_LABEL } from '@/lib/tax/constants';
import { Card, CardHeader, Field, InlineError, buttonCls, inputCls } from './ui';

type Format = 'xlsx' | 'csv' | 'pdf';

const FORMATS: Array<{
  id: Format;
  title: string;
  description: string;
  icon: React.ElementType;
  accent: string;
}> = [
  {
    id: 'xlsx',
    title: 'Excel (multi-sheet)',
    description: 'Ringkasan, rincian per jenis pajak, dokumen, dan kalender.',
    icon: FileSpreadsheet,
    accent: 'emerald',
  },
  {
    id: 'csv',
    title: 'CSV (ZIP)',
    description: 'Satu CSV per jenis pajak + README. Cocok untuk impor ke aplikasi akuntansi.',
    icon: Table2,
    accent: 'blue',
  },
  {
    id: 'pdf',
    title: 'PDF siap cetak',
    description: 'Ringkasan rapi untuk diserahkan ke akuntan atau arsip.',
    icon: FileText,
    accent: 'violet',
  },
];

function lastDay(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function TaxExportView({ year, month }: { year: number; month: number }) {
  const monthPadded = String(month).padStart(2, '0');
  const [format, setFormat] = useState<Format>('xlsx');
  const [startDate, setStartDate] = useState(`${year}-${monthPadded}-01`);
  const [endDate, setEndDate] = useState(`${year}-${monthPadded}-${String(lastDay(year, month)).padStart(2, '0')}`);
  const [taxTypes, setTaxTypes] = useState<string[]>([...ACTIVE_TAX_TYPES]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const padded = String(month).padStart(2, '0');
    setStartDate(`${year}-${padded}-01`);
    setEndDate(`${year}-${padded}-${String(lastDay(year, month)).padStart(2, '0')}`);
  }, [year, month]);

  const selectedLabel = useMemo(
    () =>
      taxTypes.length === ACTIVE_TAX_TYPES.length
        ? 'Semua jenis pajak aktif'
        : `${taxTypes.length} jenis pajak dipilih`,
    [taxTypes]
  );

  const toggleType = (taxType: string) => {
    setTaxTypes((current) =>
      current.includes(taxType) ? current.filter((item) => item !== taxType) : [...current, taxType]
    );
  };

  const download = async () => {
    setError(null);
    if (taxTypes.length === 0) {
      setError('Pilih minimal satu jenis pajak.');
      return;
    }
    if (!startDate || !endDate) {
      setError('Tanggal mulai dan akhir wajib diisi.');
      return;
    }
    if (startDate > endDate) {
      setError('Tanggal mulai tidak boleh melebihi tanggal akhir.');
      return;
    }

    setDownloading(true);
    try {
      const params = new URLSearchParams({
        format,
        startDate,
        endDate,
        taxTypes: taxTypes.join(','),
      });
      const response = await fetch(`/api/v1/tax/export?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Ekspor gagal (${response.status}).`);
      }

      const disposition = response.headers.get('content-disposition') ?? '';
      const match = /filename="?([^"]+)"?/i.exec(disposition);
      const fileName = match?.[1] ?? `Rekap-Pajak.${format}`;

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat berkas ekspor.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Ekspor Berkas Pajak"
          subtitle="Paket data siap diserahkan ke akuntan: rekap, rincian transaksi, dokumen, dan kalender."
          icon={<Download className="h-4 w-4" />}
        />

        <div className="grid gap-2.5 px-4 py-3 md:grid-cols-3">
          {FORMATS.map((item) => {
            const Icon = item.icon;
            const active = format === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFormat(item.id)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                  active
                    ? 'border-emerald-500 bg-emerald-50/60 ring-1 ring-emerald-200'
                    : 'border-slate-200 bg-white hover:border-emerald-300'
                }`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    active ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-slate-800">{item.title}</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{item.description}</p>
                </div>
                {active ? <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-600" /> : null}
              </button>
            );
          })}
        </div>

        <div className="grid gap-3 border-t border-slate-100 px-4 py-3 sm:grid-cols-2">
          <Field label="Tanggal mulai">
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Tanggal akhir">
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="border-t border-slate-100 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-bold text-slate-800">Jenis pajak</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTaxTypes([...ACTIVE_TAX_TYPES])}
                className={buttonCls.ghost}
              >
                Pilih semua
              </button>
              <button type="button" onClick={() => setTaxTypes([])} className={buttonCls.ghost}>
                Kosongkan
              </button>
            </div>
          </div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVE_TAX_TYPES.map((value) => (
              <label
                key={value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] transition ${
                  taxTypes.includes(value)
                    ? 'border-emerald-300 bg-emerald-50/50 text-emerald-900'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <input
                  type="checkbox"
                  checked={taxTypes.includes(value)}
                  onChange={() => toggleType(value)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                {TAX_TYPE_LABEL[value]}
              </label>
            ))}
          </div>
        </div>

        {error ? <div className="px-4 pb-3"><InlineError message={error} /></div> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="text-[10px] leading-relaxed text-slate-500">
            <p>
              Akan mengekspor <strong className="text-slate-700">{selectedLabel}</strong> untuk {startDate} –{' '}
              {endDate}.
            </p>
            <p>Termasuk daftar dokumen dan kalender tenggat pada rentang tersebut.</p>
          </div>
          <button type="button" onClick={() => void download()} disabled={downloading} className={buttonCls.primary}>
            {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {downloading ? 'Menyiapkan...' : 'Unduh berkas'}
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Isi paket ekspor" subtitle="Transparansi data yang akan diterima akuntan." />
        <div className="space-y-1.5 px-4 py-3 text-[10px] leading-relaxed text-slate-600">
          <p className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
            <span><strong>Ringkasan</strong> — total DPP dan pajak per jenis, jumlah baris, status masa.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
            <span><strong>Rincian transaksi</strong> — faktur, transaksi kas, payroll, dan bukti potong.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
            <span><strong>Daftar dokumen</strong> — tipe, nomor, status verifikasi, dan nama file.</span>
          </p>
          <p className="flex items-start gap-1.5">
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
            <span><strong>Kalender kepatuhan</strong> — tenggat setor/lapor dan statusnya.</span>
          </p>
        </div>
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] leading-relaxed text-blue-800">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Ekspor tidak mengirim data ke pihak ketiga. Berkas dibuat di server KLIR dan langsung diunduh ke perangkat
          Anda. Angka dapat berubah bila masih ada transaksi yang belum dicatat pada periode tersebut.
        </div>
      </Card>
    </div>
  );
}
