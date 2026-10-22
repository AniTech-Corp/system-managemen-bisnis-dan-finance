/**
 * Utilitas tanggal Modul Pajak.
 *
 * Semua tanggal bisnis mengikuti kalender WIB (UTC+7). Representasi internal
 * tetap `Date` pada tengah malam WIB (yaitu 17:00 UTC hari sebelumnya) supaya
 * perbandingan `gte/lte` di Prisma konsisten dengan tanggal yang dilihat
 * pengguna -- pola yang sama dipakai `time-series-engine.ts`.
 */

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface YearMonth {
  year: number;
  month: number; // 1-12
}

export interface WibParts {
  year: number;
  month: number;
  day: number;
}

export function wibParts(date: Date = new Date()): WibParts {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

export function wibToday(date: Date = new Date()): YearMonth {
  const p = wibParts(date);
  return { year: p.year, month: p.month };
}

/** Tanggal 00:00 WIB untuk sebuah tanggal kalender. */
export function dateAtWibMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day) - WIB_OFFSET_MS);
}

export function lastDayOfMonth(year: number, month: number): number {
  // Date.UTC dengan day=0 menghasilkan hari terakhir bulan sebelumnya.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Rentang satu bulan penuh (00:00 WIB hari pertama s.d. 23:59:59.999 WIB terakhir). */
export function monthRange(year: number, month: number): { startDate: Date; endDate: Date } {
  const startDate = dateAtWibMidnight(year, month, 1);
  const next = addMonths(year, month, 1);
  const endDate = new Date(dateAtWibMidnight(next.year, next.month, 1).getTime() - 1);
  return { startDate, endDate };
}

/** Rentang satu tahun penuh menurut kalender WIB. */
export function yearRange(year: number): { startDate: Date; endDate: Date } {
  return {
    startDate: dateAtWibMidnight(year, 1, 1),
    endDate: new Date(dateAtWibMidnight(year + 1, 1, 1).getTime() - 1),
  };
}

export function addMonths(year: number, month: number, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function parseMonthKey(value: string | null | undefined): YearMonth | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{1,2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

/** Selisih hari kalender WIB antara `from` dan `to` (positif = to di masa depan). */
export function daysBetween(from: Date, to: Date): number {
  const a = wibParts(from);
  const b = wibParts(to);
  const aUtc = Date.UTC(a.year, a.month - 1, a.day);
  const bUtc = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((bUtc - aUtc) / DAY_MS);
}

export function daysUntil(target: Date, now: Date = new Date()): number {
  return daysBetween(now, target);
}

export function isWeekend(date: Date): boolean {
  const p = wibParts(date);
  const dow = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  return dow === 0 || dow === 6;
}

export function dateKey(date: Date): string {
  const p = wibParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/**
 * Rekomendasi hari kerja terdekat. Tanggal resmi TIDAK diubah: fungsi ini hanya
 * dipakai untuk menampilkan "disarankan dibayar/dilaporkan pada ..." ketika
 * tenggat resmi jatuh di Sabtu/Minggu/libur.
 */
export function nextBusinessDay(date: Date, holidays: string[] = []): Date {
  const holidaySet = new Set(holidays);
  let candidate = new Date(date.getTime());
  // Maksimal 14 hari agar tidak pernah infinite loop.
  for (let i = 0; i < 14; i += 1) {
    if (!isWeekend(candidate) && !holidaySet.has(dateKey(candidate))) return candidate;
    candidate = new Date(candidate.getTime() + DAY_MS);
  }
  return candidate;
}

export function isBusinessDay(date: Date, holidays: string[] = []): boolean {
  return !isWeekend(date) && !holidays.includes(dateKey(date));
}

export function formatDateId(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '-';
  const p = wibParts(d);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  return `${p.day} ${months[p.month - 1]} ${p.year}`;
}

export function formatMonthId(year: number, month: number): string {
  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ];
  return `${months[month - 1] ?? month} ${year}`;
}
