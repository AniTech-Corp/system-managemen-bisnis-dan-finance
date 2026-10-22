import type { TaxComponent, TaxDocType, TaxType } from '@prisma/client';

/**
 * Konstanta Modul Pajak & Kalender Kepatuhan.
 *
 * File ini sengaja hanya memakai `import type` dari Prisma supaya AMAN
 * diimpor komponen client (tidak menarik runtime @prisma/client ke browser).
 * Semua label ditulis dalam bahasa Indonesia karena dipakai langsung di UI dan
 * berkas ekspor untuk akuntan.
 */

export const TAX_TYPE_ORDER: TaxType[] = [
  'PPN',
  'PPH_FINAL_UMKM',
  'PPH_21',
  'PPH_23',
  'PPH_4_2',
  'PPH_26',
  'BPJS',
  'OTHER',
];

/** Jenis yang otomatis dibuatkan masa pajak + tenggat setiap tahun. */
export const ACTIVE_TAX_TYPES: TaxType[] = [
  'PPN',
  'PPH_FINAL_UMKM',
  'PPH_21',
  'PPH_23',
  'PPH_4_2',
  'BPJS',
];

export const TAX_TYPE_LABEL: Record<TaxType, string> = {
  PPH_FINAL_UMKM: 'PPh Final UMKM (PP 55/2022)',
  PPN: 'PPN',
  PPH_21: 'PPh 21',
  PPH_23: 'PPh 23',
  PPH_4_2: 'PPh 4 ayat (2)',
  PPH_26: 'PPh 26',
  BPJS: 'BPJS',
  OTHER: 'Pajak Lainnya',
};

export const TAX_TYPE_SHORT: Record<TaxType, string> = {
  PPH_FINAL_UMKM: 'PPh Final',
  PPN: 'PPN',
  PPH_21: 'PPh 21',
  PPH_23: 'PPh 23',
  PPH_4_2: 'PPh 4(2)',
  PPH_26: 'PPh 26',
  BPJS: 'BPJS',
  OTHER: 'Lainnya',
};

export const TAX_TYPE_DESCRIPTION: Record<TaxType, string> = {
  PPH_FINAL_UMKM: 'Pajak final 0,5% dari peredaran bruto UMKM.',
  PPN: 'Pajak pertambahan nilai atas penjualan dan pembelian.',
  PPH_21: 'Pajak penghasilan atas gaji dan tunjangan pegawai.',
  PPH_23: 'Potongan atas jasa, sewa, royalti, dan hadiah.',
  PPH_4_2: 'Pajak final atas sewa tanah/bangunan dan konstruksi.',
  PPH_26: 'Potongan untuk penerima penghasilan luar negeri.',
  BPJS: 'Iuran jaminan sosial karyawan dan perusahaan.',
  OTHER: 'Kewajiban pajak lain yang dicatat manual.',
};

export const TAX_TYPE_LEGAL_BASIS: Record<TaxType, string> = {
  PPH_FINAL_UMKM: 'PP No. 55 Tahun 2022',
  PPN: 'UU PPN & PMK terkait',
  PPH_21: 'UU PPh & PMK 168/2023',
  PPH_23: 'UU PPh Pasal 23',
  PPH_4_2: 'UU PPh Pasal 4 ayat (2) & PP 34/2017',
  PPH_26: 'UU PPh Pasal 26',
  BPJS: 'Perpres Jaminan Sosial',
  OTHER: 'Ketentuan perpajakan terkait',
};

export const MONTHLY_OBLIGATION_TYPES: TaxType[] = [
  'PPN',
  'PPH_FINAL_UMKM',
  'PPH_21',
  'PPH_23',
  'PPH_4_2',
  'BPJS',
];

export const TAX_COMPONENT_LABEL: Record<TaxComponent, string> = {
  OUTPUT: 'Keluaran',
  INPUT: 'Masukan',
  WITHHOLDING: 'Potongan',
  PAYABLE: 'Utang Pajak',
};

export const TAX_DOC_LABEL: Record<TaxDocType, string> = {
  TAX_INVOICE: 'Faktur Pajak',
  WITHHOLDING_SLIP: 'Bukti Potong',
  PAYMENT_PROOF: 'Bukti Setor (NTPN)',
  FILING_RECEIPT: 'Bukti Lapor SPT',
  SUPPORTING: 'Dokumen Pendukung',
};

export const TAX_DOC_SHORT: Record<TaxDocType, string> = {
  TAX_INVOICE: 'Faktur',
  WITHHOLDING_SLIP: 'Bukti potong',
  PAYMENT_PROOF: 'Bukti setor',
  FILING_RECEIPT: 'Bukti lapor',
  SUPPORTING: 'Pendukung',
};

export const TAX_DOC_ORDER: TaxDocType[] = [
  'TAX_INVOICE',
  'WITHHOLDING_SLIP',
  'PAYMENT_PROOF',
  'FILING_RECEIPT',
  'SUPPORTING',
];

/** Warna badge Tailwind per jenis pajak. */
export const TAX_TYPE_BADGE: Record<TaxType, string> = {
  PPH_FINAL_UMKM: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PPN: 'bg-blue-50 text-blue-700 border-blue-200',
  PPH_21: 'bg-amber-50 text-amber-700 border-amber-200',
  PPH_23: 'bg-violet-50 text-violet-700 border-violet-200',
  PPH_4_2: 'bg-pink-50 text-pink-700 border-pink-200',
  PPH_26: 'bg-red-50 text-red-700 border-red-200',
  BPJS: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  OTHER: 'bg-slate-50 text-slate-600 border-slate-200',
};

export const PERIOD_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Terbuka',
  READY: 'Siap Lapor',
  FILED: 'Sudah Lapor',
  PAID: 'Sudah Setor',
  CLOSED: 'Ditutup',
};

export const PERIOD_STATUS_BADGE: Record<string, string> = {
  OPEN: 'bg-slate-50 text-slate-600 border-slate-200',
  READY: 'bg-amber-50 text-amber-700 border-amber-200',
  FILED: 'bg-blue-50 text-blue-700 border-blue-200',
  PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const DEADLINE_STATUS_LABEL: Record<string, string> = {
  UPCOMING: 'Akan datang',
  DUE_SOON: 'Segera',
  OVERDUE: 'Terlambat',
  DONE: 'Selesai',
  SKIPPED: 'Dilewati',
};

export const DEADLINE_STATUS_BADGE: Record<string, string> = {
  UPCOMING: 'bg-slate-50 text-slate-600 border-slate-200',
  DUE_SOON: 'bg-amber-50 text-amber-700 border-amber-200',
  OVERDUE: 'bg-red-50 text-red-700 border-red-200',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SKIPPED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const COMPLIANCE_CATEGORY_LABEL: Record<string, string> = {
  TAX: 'Pajak',
  BPJS: 'BPJS',
  PERMIT: 'Perizinan',
  OTHER: 'Lainnya',
};

export const COMPLIANCE_CATEGORY_ORDER = ['TAX', 'BPJS', 'PERMIT', 'OTHER'] as const;

/** Default bila workspace belum punya AccountingSetting. */
export const DEFAULT_TAX_PARAMS = {
  taxProfile: 'UMKM_NON_PKP',
  entityType: 'BADAN_USAHA',
  enablePpn: false,
  ppnRate: 11,
  pphFinalRate: 0.5,
  umkmThreshold: 500_000_000,
  pph23Rate: 2,
  pph42Rate: 10,
  pph21Method: 'MANUAL',
  taxReminderDays: [30, 14, 7, 3, 1],
  taxReminderChannel: 'IN_APP',
  npwp: null as string | null,
  nik: null as string | null,
  kppName: null as string | null,
  pkpEffectiveDate: null as Date | null,
};

export function taxTypeLabel(value: TaxType | string | null | undefined): string {
  if (!value) return TAX_TYPE_LABEL.OTHER;
  return TAX_TYPE_LABEL[value as TaxType] ?? String(value);
}

export function taxTypeShort(value: TaxType | string | null | undefined): string {
  if (!value) return TAX_TYPE_SHORT.OTHER;
  return TAX_TYPE_SHORT[value as TaxType] ?? String(value);
}

export function taxTypeBadge(value: TaxType | string | null | undefined): string {
  if (!value) return TAX_TYPE_BADGE.OTHER;
  return TAX_TYPE_BADGE[value as TaxType] ?? TAX_TYPE_BADGE.OTHER;
}

export function docTypeLabel(value: TaxDocType | string | null | undefined): string {
  if (!value) return TAX_DOC_LABEL.SUPPORTING;
  return TAX_DOC_LABEL[value as TaxDocType] ?? String(value);
}

export function docTypeShort(value: TaxDocType | string | null | undefined): string {
  if (!value) return TAX_DOC_SHORT.SUPPORTING;
  return TAX_DOC_SHORT[value as TaxDocType] ?? String(value);
}
