/**
 * Divisi sebagai dimensi anggaran.
 *
 * SATU-SATUNYA tempat validasi nilai divisi berada. Route, layanan, dan
 * antarmuka semuanya memakai konstan di sini supaya tidak ada validasi inline
 * yang menyebar dan lama-lama berbeda-beda.
 *
 * Daftar nilainya mengikuti enum `DivisionRole` di skema. Sengaja DIDEKLARASIKAN
 * sendiri, bukan diimpor dari `@prisma/client`, supaya modul ini aman dipakai
 * dari komponen klien tanpa menarik runtime Prisma ke bundel browser. Kecocokan
 * dengan enum dijaga oleh test `division list must match DivisionRole enum` --
 * jadi tetap ada satu sumber kebenaran, tinggal diverifikasi mesin, bukan
 * diandalkan pada ingatan orang.
 *
 * Nilai `PERUSAHAAN` khusus untuk anggaran: baris `Budget` lama (sebelum ada
 * dimensi divisi) terisi otomatis dengan nilai ini, dan dipakai anggaran yang
 * memang sifatnya umum. Nilai ini TIDAK pernah dipakai sebagai `division`
 * transaksi kas -- di sana, ketiadaan divisi ditandai oleh kolom nullable yang
 * kosong ("Tanpa Divisi").
 */

/** Nilai khusus anggaran: anggaran umum / baris sebelum ada dimensi divisi. */
export const COMPANY_DIVISION = 'PERUSAHAAN';

/** Nilai untuk transaksi kas yang tidak terkait divisi mana pun. */
export const NO_DIVISION = 'TANPA_DIVISI';

/** Harus selalu sama dengan `Object.values(DivisionRole)` di skema Prisma. */
export const DIVISIONS: readonly string[] = [
  'CEO',
  'FINANCE',
  'MARKETING',
  'SEKRETARIS',
  'MANAGER_UMUM',
  'MANAGER_OPERASIONAL',
];

/** Nilai yang sah untuk kolom `Budget.division`. */
export const BUDGET_DIVISIONS: readonly string[] = [COMPANY_DIVISION, ...DIVISIONS];

/** Tampilan label yang bisa langsung dipakai UI. */
export const DIVISION_LABELS: Record<string, string> = {
  [COMPANY_DIVISION]: 'Perusahaan',
  CEO: 'CEO',
  FINANCE: 'Finance',
  MARKETING: 'Marketing',
  SEKRETARIS: 'Sekretaris',
  MANAGER_UMUM: 'Manager Umum',
  MANAGER_OPERASIONAL: 'Manager Operasional',
};

export function divisionLabel(value: string): string {
  return DIVISION_LABELS[value] ?? value;
}

/** Kembalikan label yang layak tampil, termasuk untuk nilai yang belum dikenal. */
export function cashDivisionLabel(value: string | null | undefined): string {
  const normalized = (value ?? '').trim();
  if (!normalized) return 'Tanpa Divisi';
  return divisionLabel(normalized);
}

function isAllowed(value: string, allowed: readonly string[]): boolean {
  return allowed.includes(value);
}

/**
 * Normalisasi nilai `Budget.division`.
 *
 * Kosong/undefined menjadi `PERUSAHAAN` supaya baris lama dan input lama tetap
 * sah. Melempar Error dengan pesan yang bisa langsung ditampilkan ke user
 * kalau nilainya di luar daftar -- konsisten dengan gaya `parseMonthly`.
 */
export function normalizeBudgetDivision(raw: unknown): string {
  if (raw === null || raw === undefined) return COMPANY_DIVISION;
  const value = String(raw).trim().toUpperCase();
  if (!value) return COMPANY_DIVISION;
  if (!isAllowed(value, BUDGET_DIVISIONS)) {
    throw new Error(`Divisi "${String(raw).trim()}" tidak dikenal. Pilih divisi dari daftar.`);
  }
  return value;
}

/**
 * Normalisasi nilai `CashTransaction.division`.
 *
 * Berbeda dari `normalizeBudgetDivision`: di sini kolomnya NULLABLE, jadi
 * kosong berarti "Tanpa Divisi" dan TIDAK diisi `PERUSAHAAN`. `PERUSAHAAN`
 * ditolak di sini karena transaksi kas selalu milik satu divisi atau tidak
 * punya divisi -- bukan milik "perusahaan" secara abstrak.
 *
 * Mengembalikan null untuk "Tanpa Divisi".
 */
export function normalizeCashDivision(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim().toUpperCase();
  if (!value || value === NO_DIVISION) return null;
  if (!isAllowed(value, DIVISIONS)) {
    throw new Error(`Divisi "${String(raw).trim()}" tidak dikenal. Pilih divisi dari daftar.`);
  }
  return value;
}

/**
 * Nilai `costCenter` untuk baris jurnal yang memuat beban/pendapatan sebuah
 * divisi, atau null bila tidak ada divisi.
 *
 * Hanya baris beban/pendapatan yang diberi cost center, bukan baris kas atau
 * liabilitas. Baris kas adalah aset; memberinya cost center akan membuat
 * laporan arus kas per divisi salah hitung di kemudian hari.
 */
export function journalCostCenter(division: string | null | undefined): string | null {
  const normalized = (division ?? '').trim();
  return normalized || null;
}
