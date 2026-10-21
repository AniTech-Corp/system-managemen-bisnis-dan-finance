import { Prisma, PeriodStatus, type FiscalPeriod } from '@prisma/client';

/**
 * Semua batas periode akuntansi dihitung pada zona Asia/Jakarta (UTC+7, tanpa DST).
 * Jangan memakai `new Date(y, m, d)` di server karena perilakunya bergantung pada
 * timezone proses (VPS bisa UTC, lokal bisa WIB) -- persis jenis bug yang membuat
 * laporan bulanan bergeser satu hari.
 */
export const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface JakartaParts {
  year: number;
  month: number; // 1-12
  day: number;
}

export function getJakartaParts(date: Date = new Date()): JakartaParts {
  const shifted = new Date(date.getTime() + JAKARTA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** Awal hari (00:00:00.000 WIB) sebagai Date UTC. */
export function jakartaStartOfDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - JAKARTA_OFFSET_MS);
}

/** Akhir hari (23:59:59.999 WIB) sebagai Date UTC. */
export function jakartaEndOfDay(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - JAKARTA_OFFSET_MS);
}

export function jakartaStartOfMonth(year: number, month: number): Date {
  return jakartaStartOfDay(year, month, 1);
}

export function jakartaEndOfMonth(year: number, month: number): Date {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return jakartaEndOfDay(year, month, daysInMonth);
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export function monthRange(year: number, month: number): DateRange {
  return {
    startDate: jakartaStartOfMonth(year, month),
    endDate: jakartaEndOfMonth(year, month),
  };
}

/** Rentang tahun fiskal yang berakhir pada bulan `endMonth` di tahun `endYear`. */
export function fiscalYearRange(endYear: number, endMonth: number, fiscalYearStartMonth = 1): DateRange {
  const startYear = endMonth >= fiscalYearStartMonth ? endYear : endYear - 1;
  return {
    startDate: jakartaStartOfMonth(startYear, fiscalYearStartMonth),
    endDate: jakartaEndOfMonth(endYear, endMonth),
  };
}

export function parsePeriodParam(period: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(period.trim());
  if (!match) throw new Error('Format periode harus YYYY-MM.');
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Bulan periode tidak valid.');
  return { year, month };
}

export function formatPeriodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export interface ReportRange extends DateRange {
  periodKey: string | null;
  label: string;
  year: number;
  month: number | null;
}

/**
 * Resolusi rentang laporan dari query string.
 * Prioritas: startDate+endDate > period > bulan berjalan.
 */
export function resolveReportRange(params: {
  period?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  now?: Date;
}): ReportRange {
  const nowParts = getJakartaParts(params.now);

  if (params.startDate && params.endDate) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error('Tanggal mulai/selesai tidak valid.');
    }
    if (start.getTime() > end.getTime()) throw new Error('Tanggal mulai tidak boleh setelah tanggal selesai.');
    return {
      startDate: start,
      endDate: end,
      periodKey: null,
      label: `${params.startDate} s.d. ${params.endDate}`,
      year: getJakartaParts(end).year,
      month: null,
    };
  }

  const { year, month } = params.period
    ? parsePeriodParam(params.period)
    : { year: nowParts.year, month: nowParts.month };

  const range = monthRange(year, month);
  return {
    ...range,
    periodKey: formatPeriodKey(year, month),
    label: new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(year, month - 1, 1))
    ),
    year,
    month,
  };
}

/** Rentang pembanding: bulan sebelumnya, tahun sebelumnya, atau awal tahun fiskal s.d. akhir periode. */
export function comparativeRange(
  mode: 'prev_month' | 'prev_year' | 'ytd' | 'none',
  range: ReportRange,
  fiscalYearStartMonth = 1
): DateRange | null {
  if (mode === 'none') return null;

  if (mode === 'prev_month') {
    if (!range.month) throw new Error('Pembanding bulan sebelumnya hanya berlaku untuk periode bulanan.');
    const prev = shiftMonth(range.year, range.month, -1);
    return monthRange(prev.year, prev.month);
  }

  if (mode === 'prev_year') {
    if (!range.month) return null;
    return monthRange(range.year - 1, range.month);
  }

  // ytd: dari awal tahun fiskal sampai akhir periode terpilih
  const startYear = range.month && range.month >= fiscalYearStartMonth ? range.year : range.year - 1;
  return {
    startDate: jakartaStartOfMonth(startYear, fiscalYearStartMonth),
    endDate: range.endDate,
  };
}

export function isPeriodWritable(status: PeriodStatus): boolean {
  return status === PeriodStatus.OPEN || status === PeriodStatus.CLOSING;
}

export class PeriodClosedError extends Error {
  constructor(status: PeriodStatus) {
    super(`Periode sudah ${status.toLowerCase()} dan tidak menerima jurnal baru.`);
    this.name = 'PeriodClosedError';
  }
}

/**
 * Ambil atau buat periode fiskal untuk tanggal tertentu.
 * Wajib dipanggil dengan transaction client agar tidak balapan antar request.
 */
export async function getOrCreatePeriod(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  date: Date
): Promise<FiscalPeriod> {
  const { year, month } = getJakartaParts(date);
  const { startDate, endDate } = monthRange(year, month);

  return tx.fiscalPeriod.upsert({
    where: { workspaceId_year_month: { workspaceId, year, month } },
    create: { workspaceId, year, month, startDate, endDate, status: PeriodStatus.OPEN },
    update: {},
  });
}
