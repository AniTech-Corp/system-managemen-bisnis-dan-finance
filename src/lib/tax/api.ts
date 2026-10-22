import { TaxType } from '@prisma/client';
import { dateAtWibMidnight, monthRange, wibToday, yearRange } from './dates';
import { TAX_TYPE_ORDER } from './constants';

const TAX_TYPE_SET = new Set<string>(Object.values(TaxType));

export function parseTaxType(value: unknown): TaxType | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase().replace(/[\s.-]/g, '_');
  if (TAX_TYPE_SET.has(normalized)) return normalized as TaxType;
  // Alias singkat yang sering dikirim UI.
  if (normalized === 'PPH_4_2' || normalized === 'PPH42') return TaxType.PPH_4_2;
  if (normalized === 'PPH_FINAL' || normalized === 'UMKM') return TaxType.PPH_FINAL_UMKM;
  if (normalized === 'PPH21') return TaxType.PPH_21;
  if (normalized === 'PPH23') return TaxType.PPH_23;
  if (normalized === 'PPH26') return TaxType.PPH_26;
  return null;
}

export function parseTaxTypeList(value: string | null | undefined): TaxType[] {
  if (!value) return [];
  const seen = new Set<TaxType>();
  for (const part of value.split(',')) {
    const parsed = parseTaxType(part);
    if (parsed) seen.add(parsed);
  }
  return TAX_TYPE_ORDER.filter((t) => seen.has(t));
}

export function parseIntSafe(value: string | null | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function parseDate(value: string | null | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export interface ResolvedRange {
  startDate: Date;
  endDate: Date;
  year: number;
  month: number | null;
}

/**
 * Menentukan rentang laporan dari query string. Prioritas:
 *   startDate & endDate > year & month > year > bulan berjalan.
 *
 * `endDate` yang hanya berisi tanggal (tanpa jam) diperlakukan sebagai akhir
 * hari WIB, supaya transaksi pada tanggal tersebut tetap ikut.
 */
export function resolveRange(searchParams: URLSearchParams): ResolvedRange {
  const now = wibToday();
  const startRaw = searchParams.get('startDate');
  const endRaw = searchParams.get('endDate');

  if (startRaw && endRaw) {
    const start = parseDate(startRaw, dateAtWibMidnight(now.year, now.month, 1));
    const endParsed = parseDate(endRaw, new Date());
    const end = /^\d{4}-\d{2}-\d{2}$/.test(endRaw)
      ? new Date(dateAtWibMidnight(
          Number(endRaw.slice(0, 4)),
          Number(endRaw.slice(5, 7)),
          Number(endRaw.slice(8, 10))
        ).getTime() + 24 * 60 * 60 * 1000 - 1)
      : endParsed;
    return {
      startDate: start,
      endDate: end,
      year: start.getUTCFullYear(),
      month: null,
    };
  }

  const year = parseIntSafe(searchParams.get('year'), now.year);
  const monthRaw = searchParams.get('month');
  if (monthRaw) {
    const month = Math.min(12, Math.max(1, parseIntSafe(monthRaw, now.month)));
    const range = monthRange(year, month);
    return { ...range, year, month };
  }

  if (searchParams.get('year')) {
    return { ...yearRange(year), year, month: null };
  }

  const range = monthRange(now.year, now.month);
  return { ...range, year: now.year, month: now.month };
}

export function monthParam(searchParams: URLSearchParams): { year: number; month: number } {
  const now = wibToday();
  const year = parseIntSafe(searchParams.get('year'), now.year);
  const month = Math.min(12, Math.max(1, parseIntSafe(searchParams.get('month'), now.month)));
  return { year, month };
}

export function asString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
