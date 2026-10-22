'use client';

/**
 * Tipe & helper klien modul Manajemen Aset.
 * Memakai ulang `apiGet`/`apiSend`/`formatMoney` dari modul akuntansi supaya
 * perilaku fetch, error, dan format Rupiah konsisten di seluruh Finance.
 */

export { apiGet, apiSend, formatMoney, formatNumber, MONTH_LABELS } from '../accounting/client';

export type DepreciationMethodKey =
  | 'STRAIGHT_LINE'
  | 'DECLINING_BALANCE'
  | 'UNITS_OF_PRODUCTION'
  | 'SUM_OF_YEARS_DIGITS';

export type AssetStatusKey =
  | 'ACTIVE'
  | 'UNDER_MAINTENANCE'
  | 'DISPOSED'
  | 'SOLD'
  | 'TRANSFERRED'
  | 'IMPAIRED';

export type MaintenanceTypeKey =
  | 'PREVENTIVE'
  | 'CORRECTIVE'
  | 'INSPECTION'
  | 'UPGRADE'
  | 'OTHER';

export type DisposalMethodKey = 'SALE' | 'SCRAP' | 'DONATION' | 'TRANSFER' | 'LOSS' | 'WRITE_OFF';

export const DEPRECIATION_METHODS: Array<{ value: DepreciationMethodKey; label: string; hint: string }> = [
  {
    value: 'STRAIGHT_LINE',
    label: 'Garis Lurus',
    hint: 'Beban sama setiap bulan sepanjang masa manfaat.',
  },
  {
    value: 'DECLINING_BALANCE',
    label: 'Saldo Menurun',
    hint: 'Beban lebih besar di awal, mengecil mengikuti nilai buku.',
  },
  {
    value: 'SUM_OF_YEARS_DIGITS',
    label: 'Jumlah Angka Tahun',
    hint: 'Beban menurun teratur berdasarkan jumlah angka tahun.',
  },
  {
    value: 'UNITS_OF_PRODUCTION',
    label: 'Unit Produksi',
    hint: 'Beban mengikuti jumlah unit yang benar-benar diproduksi.',
  },
];

export const METHOD_LABELS: Record<string, string> = {
  STRAIGHT_LINE: 'Garis Lurus',
  DECLINING_BALANCE: 'Saldo Menurun',
  SUM_OF_YEARS_DIGITS: 'Jumlah Angka Tahun',
  UNITS_OF_PRODUCTION: 'Unit Produksi',
};

export const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Aktif',
  UNDER_MAINTENANCE: 'Dalam Perawatan',
  DISPOSED: 'Dilepas',
  SOLD: 'Dijual',
  TRANSFERRED: 'Dimutasi',
  IMPAIRED: 'Turun Nilai',
};

export const STATUS_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  UNDER_MAINTENANCE: 'bg-amber-50 text-amber-700 border-amber-200',
  DISPOSED: 'bg-slate-100 text-slate-600 border-slate-200',
  SOLD: 'bg-blue-50 text-blue-700 border-blue-200',
  TRANSFERRED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  IMPAIRED: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const MAINTENANCE_TYPES: Array<{ value: MaintenanceTypeKey; label: string }> = [
  { value: 'PREVENTIVE', label: 'Preventif' },
  { value: 'CORRECTIVE', label: 'Korektif' },
  { value: 'INSPECTION', label: 'Inspeksi' },
  { value: 'UPGRADE', label: 'Peningkatan' },
  { value: 'OTHER', label: 'Lainnya' },
];

export const MAINTENANCE_LABELS: Record<string, string> = Object.fromEntries(
  MAINTENANCE_TYPES.map((item) => [item.value, item.label])
);

export const DISPOSAL_METHODS: Array<{ value: DisposalMethodKey; label: string }> = [
  { value: 'SALE', label: 'Dijual' },
  { value: 'SCRAP', label: 'Scrap / Besi Tua' },
  { value: 'DONATION', label: 'Disumbangkan' },
  { value: 'TRANSFER', label: 'Dialihkan ke Pihak Lain' },
  { value: 'LOSS', label: 'Hilang' },
  { value: 'WRITE_OFF', label: 'Dihapusbukukan' },
];

export const DISPOSAL_LABELS: Record<string, string> = Object.fromEntries(
  DISPOSAL_METHODS.map((item) => [item.value, item.label])
);

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  description: string | null;
  defaultUsefulLifeMonths: number | null;
  defaultDepreciationMethod: DepreciationMethodKey | null;
  defaultSalvageValueRate: number | null;
  isSystem: boolean;
  assetCount?: number;
  activeCount?: number;
  totalAcquisitionCost?: number;
  totalBookValue?: number;
}

export interface CustodianRef {
  id: string;
  fullName: string;
  email?: string;
}

export interface Asset {
  id: string;
  assetCode: string;
  name: string;
  description: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  categoryId: string;
  category?: { id: string; code: string; name: string };
  acquisitionDate: string;
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  isDepreciable: boolean;
  depreciationMethod: DepreciationMethodKey;
  depreciationStartDate: string | null;
  lastDepreciationDate: string | null;
  accumulatedDepreciation: number;
  accumulatedImpairment: number;
  bookValue: number;
  totalEstimatedUnits: number | null;
  unitsProducedToDate: number;
  location: string | null;
  custodianId: string | null;
  custodian?: CustodianRef | null;
  department: string | null;
  status: AssetStatusKey;
  disposalDate: string | null;
  disposalMethod: DisposalMethodKey | null;
  disposalProceeds: number | null;
  disposalGainLoss: number | null;
  disposalNotes: string | null;
  assetAccountId: string | null;
  depreciationExpenseAccountId: string | null;
  accumulatedDepreciationAccountId: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { maintenanceRecords: number; depreciationEntries: number };
  depreciationEntries?: DepreciationEntry[];
  maintenanceRecords?: AssetMaintenance[];
  transferHistory?: AssetTransfer[];
  impairmentRecords?: AssetImpairment[];
}

export interface DepreciationPeriodItem {
  index: number;
  year: number;
  month: number;
  amount: number;
  accumulated: number;
  bookValue: number;
  unitsProduced?: number;
}

export interface DepreciationEntry {
  id: string;
  assetId: string;
  periodYear: number;
  periodMonth: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  bookValue: number;
  unitsProduced: number | null;
  journalEntryId: string | null;
  isPosted: boolean;
  postedAt: string | null;
  isAdjustment: boolean;
  asset?: { id: string; assetCode: string; name: string; category?: { name: string } };
}

export interface AssetMaintenance {
  id: string;
  assetId: string;
  maintenanceDate: string;
  type: MaintenanceTypeKey;
  description: string;
  cost: number;
  vendor: string | null;
  performedBy: string | null;
  nextMaintenanceDate: string | null;
  notes: string | null;
  receiptUrl: string | null;
  asset?: { id: string; assetCode: string; name: string; location?: string | null };
}

export interface AssetTransfer {
  id: string;
  assetId: string;
  transferDate: string;
  fromLocation: string | null;
  toLocation: string | null;
  fromDepartment: string | null;
  toDepartment: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AssetImpairment {
  id: string;
  assetId: string;
  impairmentDate: string;
  recoverableAmount: number;
  carryingAmount: number;
  impairmentLoss: number;
  description: string;
  isPosted: boolean;
}

export interface AssetSummary {
  totalAssets: number;
  activeAssets: number;
  disposedAssets: number;
  totalAcquisitionCost: number;
  totalAccumulatedDepreciation: number;
  totalAccumulatedImpairment: number;
  totalBookValue: number;
  maintenanceThisYear: { count: number; cost: number };
  disposals: { count: number; proceeds: number; netGainLoss: number };
  impairments: { count: number; totalLoss: number };
  byCategory: Array<{
    id: string;
    code: string;
    name: string;
    count: number;
    acquisitionCost: number;
    bookValue: number;
  }>;
  recentDepreciation: Array<{
    id: string;
    period: string;
    assetCode: string;
    assetName: string;
    amount: number;
    isPosted: boolean;
  }>;
}

/** Format tanggal Indonesia tanpa bergantung pada timezone perangkat. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '-';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

/** `YYYY-MM-DD` untuk input date. */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

export function yearsFromMonths(months: number): string {
  if (!months) return '-';
  const years = months / 12;
  return Number.isInteger(years) ? `${years} tahun` : `${months} bulan`;
}

export function monthLabel(year: number, month: number): string {
  const names = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  return `${names[(month || 1) - 1]} ${year}`;
}

export function currentJakartaPeriod(): { year: number; month: number } {
  const shifted = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const escape = (value: string | number | null) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const content = [headers, ...rows].map((row) => row.map(escape).join(';')).join('\r\n');
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
