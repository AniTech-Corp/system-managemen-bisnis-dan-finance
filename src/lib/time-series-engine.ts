/**
 * KLIR Time-Series & Dynamic Date-Filtering Engine
 * 
 * Modul deterministik untuk mengolah rentang waktu kalender nyata,
 * pembagian bucket bulanan/harian, penanganan celah data (zero-filling),
 * dan kalkulasi perbandingan pertumbuhan MoM (Month-over-Month).
 */

export interface DateRangeResolution {
  startDate: Date;
  endDate: Date;
  periodKey: string; // e.g. "2026-09" atau "2026-09-01_2026-09-30"
  periodLabel: string; // e.g. "September 2026"
  isCurrentMonth: boolean;
  previousRange: {
    startDate: Date;
    endDate: Date;
    periodKey: string;
    periodLabel: string;
  };
}

export interface MonthBucket {
  key: string; // "YYYY-MM"
  year: number;
  month: number; // 1-12
  label: string; // "September 2026"
  shortLabel: string; // "Sep"
  startDate: Date;
  endDate: Date;
}

export interface DayBucket {
  key: string; // "YYYY-MM-DD"
  label: string; // "05 Sep"
  dayOfWeek: string; // "Sabtu"
  startDate: Date;
  endDate: Date;
}

export interface GrowthMetric {
  current: number;
  previous: number;
  diff: number;
  percentage: number;
  direction: 'UP' | 'DOWN' | 'STABLE';
  formattedText: string;
}

export interface CalendarDayRange {
  startDate: Date;
  endDate: Date;
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function getWibCalendarParts(date: Date): { year: number; month: number; day: number } {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function getWibMonthRange(year: number, month: number): CalendarDayRange {
  const startUtcMs = Date.UTC(year, month, 1) - WIB_OFFSET_MS;
  const nextMonthStartUtcMs = Date.UTC(year, month + 1, 1) - WIB_OFFSET_MS;
  return {
    startDate: new Date(startUtcMs),
    endDate: new Date(nextMonthStartUtcMs - 1),
  };
}

/**
 * Resolve the current business day in the product's canonical timezone.
 *
 * Prisma stores timestamps as instants. A naive Date.UTC(now.getUTCDate())
 * query therefore defines "today" as UTC, which is already tomorrow or still
 * yesterday for users in WIB around the 00:00 boundary. KLIR's business UI is
 * Indonesian, so operational day buckets must use Asia/Jakarta (UTC+07:00).
 * The returned range is inclusive and safe to use with Prisma gte/lte.
 */
export function getWibDayRange(nowDate: Date = new Date()): CalendarDayRange {
  const shifted = new Date(nowDate.getTime() + WIB_OFFSET_MS);
  const startUtcMs = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    0,
    0,
    0,
    0
  ) - WIB_OFFSET_MS;
  const startDate = new Date(startUtcMs);
  const endDate = new Date(startUtcMs + 24 * 60 * 60 * 1000 - 1);
  return { startDate, endDate };
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const MONTH_SHORT_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

const DAY_NAMES_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

/**
 * Mengurai parameter request (month, startDate/endDate, range) menjadi rentang tanggal absolut
 * beserta rentang periode sebelumnya untuk kalkulasi MoM.
 */
export function resolveDateRange(params: {
  month?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  range?: string | null;
  nowDate?: Date;
}): DateRangeResolution {
  const now = params.nowDate || new Date();
  const current = getWibCalendarParts(now);
  const currentYear = current.year;
  const currentMonth = current.month; // 0-indexed

  // Kasus 1: Parameter spesifik bulan "YYYY-MM" (misal: "2026-07")
  if (params.month && /^\d{4}-\d{2}$/.test(params.month.trim())) {
    const [yStr, mStr] = params.month.trim().split('-');
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10) - 1; // 0-indexed

    const { startDate, endDate } = getWibMonthRange(year, month);

    const isCurrentMonth = year === currentYear && month === currentMonth;

    // Periode sebelumnya (bulan lalu)
    const prevYear = month === 0 ? year - 1 : year;
    const prevMonth = month === 0 ? 11 : month - 1;
    const previous = getWibMonthRange(prevYear, prevMonth);

    return {
      startDate,
      endDate,
      periodKey: `${year}-${String(month + 1).padStart(2, '0')}`,
      periodLabel: `${MONTH_NAMES_ID[month]} ${year}`,
      isCurrentMonth,
      previousRange: {
        startDate: previous.startDate,
        endDate: previous.endDate,
        periodKey: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`,
        periodLabel: `${MONTH_NAMES_ID[prevMonth]} ${prevYear}`,
      },
    };
  }

  // Kasus 2: Parameter eksplisit startDate & endDate kustom
  if (params.startDate && params.endDate) {
    const parseDateBoundary = (raw: string, endOfDay: boolean): Date => {
      const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const year = Number(match[1]);
        const month = Number(match[2]) - 1;
        const day = Number(match[3]);
        const utcMs = Date.UTC(year, month, day + (endOfDay ? 1 : 0)) - WIB_OFFSET_MS;
        return new Date(endOfDay ? utcMs - 1 : utcMs);
      }
      return new Date(raw);
    };
    const startDate = parseDateBoundary(params.startDate, false);
    const endDate = parseDateBoundary(params.endDate, true);

    if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
      // Pastikan rentang waktu valid (start <= end)
      const validStart = startDate <= endDate ? startDate : endDate;
      const validEnd = startDate <= endDate ? endDate : startDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(params.endDate.trim())) {
        validEnd.setUTCHours(23, 59, 59, 999);
      }

      const durationMs = validEnd.getTime() - validStart.getTime();
      const prevEnd = new Date(validStart.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - durationMs);

      return {
        startDate: validStart,
        endDate: validEnd,
        periodKey: `${validStart.toISOString().slice(0, 10)}_${validEnd.toISOString().slice(0, 10)}`,
        periodLabel: `${validStart.toLocaleDateString('id-ID')} - ${validEnd.toLocaleDateString('id-ID')}`,
        isCurrentMonth: false,
        previousRange: {
          startDate: prevStart,
          endDate: prevEnd,
          periodKey: `${prevStart.toISOString().slice(0, 10)}_${prevEnd.toISOString().slice(0, 10)}`,
          periodLabel: `${prevStart.toLocaleDateString('id-ID')} - ${prevEnd.toLocaleDateString('id-ID')}`,
        },
      };
    }
  }

  // Kasus 3: Preset Range (last_month, last_30_days, last_3_months, last_6_months, this_year)
  const range = (params.range || 'this_month').toLowerCase();

  if (range === 'last_month') {
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const { startDate, endDate } = getWibMonthRange(prevYear, prevMonth);

    const pprevYear = prevMonth === 0 ? prevYear - 1 : prevYear;
    const pprevMonth = prevMonth === 0 ? 11 : prevMonth - 1;
    const previous = getWibMonthRange(pprevYear, pprevMonth);

    return {
      startDate,
      endDate,
      periodKey: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`,
      periodLabel: `${MONTH_NAMES_ID[prevMonth]} ${prevYear}`,
      isCurrentMonth: false,
      previousRange: {
        startDate: previous.startDate,
        endDate: previous.endDate,
        periodKey: `${pprevYear}-${String(pprevMonth + 1).padStart(2, '0')}`,
        periodLabel: `${MONTH_NAMES_ID[pprevMonth]} ${pprevYear}`,
      },
    };
  }

  if (range === 'last_30_days') {
    const endDate = getWibDayRange(now).endDate;
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000 + 1);
    const prevEndDate = new Date(startDate.getTime() - 1);
    const prevStartDate = new Date(prevEndDate.getTime() - 30 * 24 * 60 * 60 * 1000 + 1);

    return {
      startDate,
      endDate,
      periodKey: 'last_30_days',
      periodLabel: '30 Hari Terakhir',
      isCurrentMonth: false,
      previousRange: {
        startDate: prevStartDate,
        endDate: prevEndDate,
        periodKey: 'prev_30_days',
        periodLabel: '30 Hari Sebelumnya',
      },
    };
  }

  // Kasus Default: Bulan Berjalan saat ini ("this_month")
  const { startDate, endDate } = getWibMonthRange(currentYear, currentMonth);

  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const previous = getWibMonthRange(prevYear, prevMonth);

  return {
    startDate,
    endDate,
    periodKey: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
    periodLabel: `${MONTH_NAMES_ID[currentMonth]} ${currentYear}`,
    isCurrentMonth: true,
    previousRange: {
      startDate: previous.startDate,
      endDate: previous.endDate,
      periodKey: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}`,
      periodLabel: `${MONTH_NAMES_ID[prevMonth]} ${prevYear}`,
    },
  };
}

/**
 * Menghasilkan deret bucket bulanan berurutan (misal: 6 atau 12 bulan terakhir)
 * untuk dijadikan kerangka grafik atau tabel tren.
 */
export function generateMonthBuckets(count: number = 6, referenceDate?: Date): MonthBucket[] {
  const ref = referenceDate || new Date();
  const refParts = getWibCalendarParts(ref);
  const buckets: MonthBucket[] = [];

  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(refParts.year, refParts.month - i, 1));
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth(); // 0-indexed
    const { startDate, endDate } = getWibMonthRange(year, month);

    buckets.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      year,
      month: month + 1,
      label: `${MONTH_NAMES_ID[month]} ${year}`,
      shortLabel: MONTH_SHORT_ID[month],
      startDate,
      endDate,
    });
  }

  return buckets;
}

/**
 * Menghasilkan deret bucket harian untuk rentang tertentu (misal: seluruh hari dalam 1 bulan)
 */
export function generateDayBuckets(startDate: Date, endDate: Date): DayBucket[] {
  const buckets: DayBucket[] = [];
  const startParts = getWibCalendarParts(startDate);
  const endParts = getWibCalendarParts(endDate);
  const current = new Date(Date.UTC(startParts.year, startParts.month, startParts.day));
  const end = new Date(Date.UTC(endParts.year, endParts.month, endParts.day));

  while (current <= end) {
    const year = current.getUTCFullYear();
    const month = current.getUTCMonth();
    const date = current.getUTCDate();
    const dayOfWeek = current.getUTCDay();

    const bucketStart = new Date(Date.UTC(year, month, date) - WIB_OFFSET_MS);
    const bucketEnd = new Date(Date.UTC(year, month, date + 1) - WIB_OFFSET_MS - 1);

    buckets.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}`,
      label: `${String(date).padStart(2, '0')} ${MONTH_SHORT_ID[month]}`,
      dayOfWeek: DAY_NAMES_ID[dayOfWeek],
      startDate: bucketStart,
      endDate: bucketEnd,
    });

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return buckets;
}

/**
 * Menghitung persentase pertumbuhan MoM / PoP secara aman
 */
export function calculateMoM(current: number, previous: number): GrowthMetric {
  const diff = current - previous;

  if (previous === 0) {
    if (current === 0) {
      return {
        current,
        previous,
        diff: 0,
        percentage: 0,
        direction: 'STABLE',
        formattedText: 'Stabil (0%)',
      };
    }
    return {
      current,
      previous,
      diff,
      percentage: 100,
      direction: current > 0 ? 'UP' : 'DOWN',
      formattedText: current > 0 ? '+100% (Aktivitas Baru)' : '-100%',
    };
  }

  const percentage = (diff / Math.abs(previous)) * 100;
  const roundedPct = Math.round(percentage * 10) / 10;
  const direction: GrowthMetric['direction'] =
    roundedPct > 0 ? 'UP' : roundedPct < 0 ? 'DOWN' : 'STABLE';

  const sign = roundedPct > 0 ? '+' : '';
  return {
    current,
    previous,
    diff,
    percentage: roundedPct,
    direction,
    formattedText: `${sign}${roundedPct}%`,
  };
}

/**
 * Menggabungkan bucket bulanan dengan data agregat riil dari database.
 * Menjamin semua bulan terisi angka (0 jika tidak ada transaksi), tidak pernah kosong atau bolong.
 */
export function zeroFillMonthlySeries<T extends { income?: number; expense?: number }>(
  buckets: MonthBucket[],
  dataMap: Map<string, T>
): Array<MonthBucket & { income: number; expense: number; netCash: number; marginPct: number; raw: T | null }> {
  return buckets.map((b) => {
    const found = dataMap.get(b.key) || null;
    const income = found?.income || 0;
    const expense = found?.expense || 0;
    const netCash = income - expense;
    const marginPct = income > 0 ? Math.round(((income - expense) / income) * 1000) / 10 : 0;

    return {
      ...b,
      income,
      expense,
      netCash,
      marginPct,
      raw: found,
    };
  });
}

/**
 * Add real opening/closing cash to an already aggregated monthly series.
 * A current balance multiplied by a profit ratio is not a historical balance;
 * this helper keeps that distinction explicit for dashboard comparisons.
 */
export function addCumulativeCashToMonthlySeries<T extends { netCash: number }>(
  series: T[],
  openingCash = 0
): Array<T & { openingCash: number; closingCash: number }> {
  let closingCash = Number.isFinite(openingCash) ? openingCash : 0;
  return series.map((point) => {
    const pointOpeningCash = closingCash;
    const netCash = Number.isFinite(point.netCash) ? point.netCash : 0;
    closingCash += netCash;
    return { ...point, openingCash: pointOpeningCash, closingCash };
  });
}
