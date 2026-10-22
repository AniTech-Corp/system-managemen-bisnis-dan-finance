/**
 * Mesin perhitungan penyusutan aset tetap.
 *
 * Murni (tanpa akses database) supaya bisa dites langsung. Semua rumus mengikuti
 * praktik umum PSAK/akuntansi pajak Indonesia:
 *
 *   Garis lurus (STRAIGHT_LINE)
 *     penyusutan bulanan = (harga perolehan - nilai sisa) / masa manfaat (bulan)
 *
 *   Saldo menurun (DECLINING_BALANCE) -- saldo menurun ganda
 *     tarif tahunan = 2 / masa manfaat (tahun)
 *     penyusutan bulanan = nilai buku awal bulan x tarif tahunan / 12
 *     berhenti saat nilai buku menyentuh nilai sisa
 *
 *   Unit produksi (UNITS_OF_PRODUCTION)
 *     tarif per unit = (harga perolehan - nilai sisa) / total estimasi unit
 *     penyusutan periode = unit diproduksi x tarif per unit
 *
 *   Jumlah angka tahun (SUM_OF_YEARS_DIGITS)
 *     jumlah angka tahun = n(n+1)/2
 *     penyusutan tahun ke-k = (n-k+1)/jumlah angka tahun x (harga perolehan - nilai sisa)
 *
 * Semua nominal dibulatkan ke 2 desimal. Selisih pembulatan diserap periode
 * terakhir supaya total penyusutan tepat sama dengan nilai yang dapat disusutkan.
 */

export type DepreciationMethodKey =
  | 'STRAIGHT_LINE'
  | 'DECLINING_BALANCE'
  | 'UNITS_OF_PRODUCTION'
  | 'SUM_OF_YEARS_DIGITS';

export const DEPRECIATION_METHOD_LABELS: Record<DepreciationMethodKey, string> = {
  STRAIGHT_LINE: 'Garis Lurus',
  DECLINING_BALANCE: 'Saldo Menurun',
  UNITS_OF_PRODUCTION: 'Unit Produksi',
  SUM_OF_YEARS_DIGITS: 'Jumlah Angka Tahun',
};

export interface DepreciationAssetInput {
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  method: DepreciationMethodKey;
  /** Awal penyusutan (tanggal perolehan bila kosong). */
  startDate: Date;
  totalEstimatedUnits?: number | null;
}

export interface DepreciationPeriod {
  /** Indeks bulan ke-1, ke-2, ... sejak awal penyusutan. */
  index: number;
  year: number;
  month: number; // 1-12
  amount: number;
  accumulated: number;
  bookValue: number;
  unitsProduced?: number;
}

export interface BuildScheduleOptions {
  /**
   * Jumlah unit yang diproduksi per periode (kunci `YYYY-MM`). Hanya dipakai
   * metode unit produksi. Periode tanpa angka dianggap 0 unit.
   */
  unitsByPeriod?: Record<string, number>;
  /** Batas akhir jadwal (inklusif). Default: seluruh masa manfaat. */
  until?: { year: number; month: number };
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

/** Geser (year, month) sebanyak `delta` bulan. `month` 1-12. */
export function shiftYearMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Kunci periode `YYYY-MM` dari komponen tahun/bulan. */
export function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Ambil komponen tahun/bulan pada zona Asia/Jakarta (UTC+7) supaya tanggal bisnis
 * tidak bergeser satu hari ketika server berjalan di UTC.
 */
export function jakartaYearMonth(date: Date): { year: number; month: number } {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

/** Tanggal akhir bulan (WIB) untuk komponen tahun/bulan. */
export function endOfMonthDate(year: number, month: number): Date {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1, daysInMonth, 23, 59, 59, 999) - 7 * 60 * 60 * 1000);
}

/**
 * Hitung seluruh jadwal penyusutan aset sampai masa manfaatnya habis.
 *
 * Jadwal selalu dimulai pada bulan `startDate`. Aset yang belum mulai disusutkan
 * (startDate di masa depan) menghasilkan jadwal kosong.
 */
export function buildDepreciationSchedule(
  input: DepreciationAssetInput,
  options: BuildScheduleOptions = {}
): DepreciationPeriod[] {
  const cost = round2(Math.max(0, input.acquisitionCost));
  const salvage = round2(clamp(input.salvageValue, 0, cost));
  const depreciable = round2(cost - salvage);
  const lifeMonths = Math.max(0, Math.floor(input.usefulLifeMonths));

  if (lifeMonths <= 0 || depreciable <= 0) return [];

  const start = jakartaYearMonth(input.startDate);
  const periods: DepreciationPeriod[] = [];

  let accumulated = 0;
  let bookValue = cost;

  const push = (year: number, month: number, amount: number, unitsProduced?: number) => {
    const safeAmount = round2(clamp(amount, 0, depreciable - accumulated));
    accumulated = round2(accumulated + safeAmount);
    bookValue = round2(cost - accumulated);
    periods.push({
      index: periods.length + 1,
      year,
      month,
      amount: safeAmount,
      accumulated,
      bookValue,
      ...(unitsProduced !== undefined ? { unitsProduced } : {}),
    });
  };

  if (input.method === 'DECLINING_BALANCE') {
    const usefulLifeYears = Math.max(1, Math.ceil(lifeMonths / 12));
    const annualRate = 2 / usefulLifeYears;

    for (let i = 0; i < lifeMonths; i += 1) {
      if (bookValue <= salvage) break;
      const { year, month } = shiftYearMonth(start.year, start.month, i);
      if (options.until && isAfterPeriod(year, month, options.until)) break;

      // Pembulatan ke bawah ke 2 desimal supaya nilai buku tidak pernah turun
      // melewati nilai sisa karena pembulatan ke atas.
      const monthly = Math.floor(((bookValue * annualRate) / 12) * 100) / 100;
      const capped = Math.min(monthly, round2(bookValue - salvage));
      if (capped <= 0) break;
      push(year, month, capped);
    }
    return periods;
  }

  if (input.method === 'SUM_OF_YEARS_DIGITS') {
    const years = Math.ceil(lifeMonths / 12);
    const sumOfYears = (years * (years + 1)) / 2;

    for (let i = 0; i < lifeMonths; i += 1) {
      const { year, month } = shiftYearMonth(start.year, start.month, i);
      if (options.until && isAfterPeriod(year, month, options.until)) break;

      const yearIndex = Math.floor(i / 12) + 1;
      const yearWeight = Math.max(years - yearIndex + 1, 0);
      const monthsInThisYear = Math.min(12, lifeMonths - (yearIndex - 1) * 12);
      const annual = round2((yearWeight / sumOfYears) * depreciable);
      const monthly = round2(annual / monthsInThisYear);

      // Bulan terakhir tiap tahun menyerap selisih pembulatan tahunan.
      const isLastMonthOfYear = (i + 1) % 12 === 0 || i === lifeMonths - 1;
      const alreadyThisYear = periods
        .filter((period) => period.index > (yearIndex - 1) * 12)
        .reduce((total, period) => total + period.amount, 0);

      const amount = isLastMonthOfYear
        ? round2(annual - alreadyThisYear)
        : monthly;
      push(year, month, amount);
    }
    return periods;
  }

  if (input.method === 'UNITS_OF_PRODUCTION') {
    const totalUnits = input.totalEstimatedUnits ?? 0;
    if (totalUnits <= 0) return [];
    const ratePerUnit = depreciable / totalUnits;

    for (let i = 0; i < lifeMonths; i += 1) {
      if (accumulated >= depreciable) break;
      const { year, month } = shiftYearMonth(start.year, start.month, i);
      if (options.until && isAfterPeriod(year, month, options.until)) break;

      const units = Math.max(0, options.unitsByPeriod?.[periodKey(year, month)] ?? 0);
      push(year, month, round2(units * ratePerUnit), units);
    }
    return periods;
  }

  // STRAIGHT_LINE (default)
  const monthlyBase = round2(depreciable / lifeMonths);
  for (let i = 0; i < lifeMonths; i += 1) {
    const { year, month } = shiftYearMonth(start.year, start.month, i);
    if (options.until && isAfterPeriod(year, month, options.until)) break;

    const isLast = i === lifeMonths - 1;
    const amount = isLast ? round2(depreciable - accumulated) : monthlyBase;
    push(year, month, amount);
  }
  return periods;
}

function isAfterPeriod(
  year: number,
  month: number,
  limit: { year: number; month: number }
): boolean {
  return year * 12 + month > limit.year * 12 + limit.month;
}

/** Ambil entri jadwal untuk periode tertentu (null bila di luar jadwal). */
export function findPeriod(
  schedule: DepreciationPeriod[],
  year: number,
  month: number
): DepreciationPeriod | null {
  return schedule.find((p) => p.year === year && p.month === month) ?? null;
}

/**
 * Akumulasi penyusutan & nilai buku sampai akhir periode tertentu.
 * Dipakai untuk laporan nilai buku per tanggal tanpa harus membaca seluruh entri.
 */
export function bookValueAt(
  schedule: DepreciationPeriod[],
  year: number,
  month: number
): { accumulated: number; bookValue: number } | null {
  let last: DepreciationPeriod | null = null;
  for (const period of schedule) {
    if (period.year * 12 + period.month <= year * 12 + month) last = period;
    else break;
  }
  if (!last) return null;
  return { accumulated: last.accumulated, bookValue: last.bookValue };
}

/** Total penyusutan yang sudah dijadwalkan sampai periode tertentu. */
export function depreciationThrough(
  schedule: DepreciationPeriod[],
  year: number,
  month: number
): number {
  return bookValueAt(schedule, year, month)?.accumulated ?? 0;
}

/**
 * Validasi konfigurasi aset sebelum disimpan. Mengembalikan pesan error
 * (bahasa Indonesia) atau null bila valid.
 */
export function validateAssetInput(input: {
  acquisitionCost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  method: DepreciationMethodKey;
  totalEstimatedUnits?: number | null;
  isDepreciable?: boolean;
}): string | null {
  if (!Number.isFinite(input.acquisitionCost) || input.acquisitionCost <= 0) {
    return 'Nilai perolehan harus lebih besar dari 0.';
  }
  if (!Number.isFinite(input.salvageValue) || input.salvageValue < 0) {
    return 'Nilai sisa tidak boleh negatif.';
  }
  if (input.salvageValue > input.acquisitionCost) {
    return 'Nilai sisa tidak boleh melebihi nilai perolehan.';
  }
  if (input.isDepreciable === false) {
    return null;
  }
  if (!Number.isInteger(input.usefulLifeMonths) || input.usefulLifeMonths <= 0) {
    return 'Masa manfaat harus bilangan bulat bulan dan lebih besar dari 0.';
  }
  if (input.usefulLifeMonths > 1200) {
    return 'Masa manfaat tidak wajar (maksimal 100 tahun).';
  }
  if (
    input.method === 'UNITS_OF_PRODUCTION' &&
    (!input.totalEstimatedUnits || input.totalEstimatedUnits <= 0)
  ) {
    return 'Metode unit produksi memerlukan total estimasi unit yang lebih besar dari 0.';
  }
  return null;
}
