import { Prisma } from '@prisma/client';
import { toMoney, type MoneyInput } from './money';

/**
 * Logika inti Pengelolaan Utang & Piutang (AR/AP) -- MURNI, tanpa DB.
 *
 * Semua konsep yang dipakai bersama oleh laporan umur, jadwal pembayaran,
 * riwayat penagihan, dan pemantauan jatuh tempo tinggal di sini supaya hanya ada
 * satu sumber kebenaran: definisi bucket umur, perhitungan hari terlambat,
 * penurunan tanggal jatuh tempo dari termin, tingkat penagihan (dunning), dan
 * proyeksi arus kas dari tanggal jatuh tempo dokumen.
 *
 * Aturan uang: penjumlahan selalu lewat Prisma.Decimal (lihat money.ts).
 */

export type ArApKind = 'AR' | 'AP';

export type AgingBucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export interface AgingBucketDef {
  key: AgingBucketKey;
  label: string;
  min: number;
  max: number;
}

/** Bucket umur standar (selaras praktik aging schedule). */
export const AGING_BUCKETS: readonly AgingBucketDef[] = [
  { key: 'current', label: 'Belum jatuh tempo', min: -Infinity, max: 0 },
  { key: 'd1_30', label: '1–30 hari', min: 1, max: 30 },
  { key: 'd31_60', label: '31–60 hari', min: 31, max: 60 },
  { key: 'd61_90', label: '61–90 hari', min: 61, max: 90 },
  { key: 'd90_plus', label: '> 90 hari', min: 91, max: Infinity },
] as const;

export const AGING_BUCKET_KEYS: readonly AgingBucketKey[] = AGING_BUCKETS.map((b) => b.key);

export function bucketForDaysOverdue(days: number): AgingBucketKey {
  const d = Number.isFinite(days) ? days : 0;
  const found = AGING_BUCKETS.find((b) => d >= b.min && d <= b.max);
  return found?.key ?? 'd90_plus';
}

export function agingBucketLabel(key: AgingBucketKey): string {
  return AGING_BUCKETS.find((b) => b.key === key)?.label ?? key;
}

/* ─────────────────────────── Tanggal & termin ─────────────────────────── */

const MS_PER_DAY = 86_400_000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + Math.trunc(days) * MS_PER_DAY);
}

/** Hari terlambat (>= 0). Sebelum jatuh tempo dihitung 0 (masuk bucket current). */
export function daysOverdue(dueDate: Date, asOf: Date): number {
  return Math.max(0, Math.floor((asOf.getTime() - dueDate.getTime()) / MS_PER_DAY));
}

/** Hari bersisa sebelum jatuh tempo; negatif berarti sudah lewat. */
export function daysUntilDue(dueDate: Date, asOf: Date): number {
  return Math.ceil((dueDate.getTime() - asOf.getTime()) / MS_PER_DAY);
}

/**
 * Tanggal jatuh tempo diturunkan dari tanggal terbit + termin kredit.
 * `termDays` negatif/aneh diperlakukan 0 supaya tidak ada dueDate mundur.
 */
export function resolveDueDate(issueDate: Date, termDays: number): Date {
  const term = Number.isFinite(termDays) ? Math.max(0, Math.trunc(termDays)) : 0;
  return addDays(issueDate, term);
}

/* ─────────────────────────── Tingkat penagihan (dunning) ─────────────────────────── */

export interface DunningConfig {
  /** Berapa hari sebelum jatuh tempo pengingat awal boleh dikirim (H-n). */
  softDays: number;
  /** Mulai hari ke berapa setelah jatuh tempo penagihan dipertegas. */
  firmDays: number;
  /** Mulai hari ke berapa penagihan naik ke surat resmi / eskalasi. */
  legalDays: number;
}

export const DEFAULT_DUNNING: DunningConfig = { softDays: 3, firmDays: 7, legalDays: 30 };

export type DunningTone = 'soft' | 'normal' | 'firm' | 'legal';

export interface DunningLevel {
  level: 1 | 2 | 3 | 4;
  tone: DunningTone;
  label: string;
}

/**
 * Tingkat penagihan dari selisih hari ke jatuh tempo.
 *
 * Level 1 (soft)   : belum jatuh tempo, masuk jendela pengingat awal (H-softDays).
 * Level 2 (normal) : sudah jatuh tempo, belum lewat firmDays.
 * Level 3 (firm)   : terlambat, perlu penagihan tegas.
 * Level 4 (legal)  : terlambat parah, perlu eskalasi/surat resmi.
 */
export function dunningLevelFor(
  daysPastDue: number,
  config: DunningConfig = DEFAULT_DUNNING
): DunningLevel {
  const cfg = {
    softDays: Math.max(0, config.softDays),
    firmDays: Math.max(1, config.firmDays),
    legalDays: Math.max(2, config.legalDays),
  };
  const d = Number.isFinite(daysPastDue) ? daysPastDue : 0;

  if (d < 0) {
    return d >= -cfg.softDays
      ? { level: 1, tone: 'soft', label: 'Pengingat awal (menjelang jatuh tempo)' }
      : { level: 1, tone: 'soft', label: 'Belum jatuh tempo' };
  }
  if (d < cfg.firmDays) {
    return { level: 2, tone: 'normal', label: 'Jatuh tempo' };
  }
  if (d < cfg.legalDays) {
    return { level: 3, tone: 'firm', label: `Terlambat ${d} hari` };
  }
  return { level: 4, tone: 'legal', label: `Terlambat ${d} hari — perlu eskalasi` };
}

/* ─────────────────────────── Ringkasan per pihak lawan ─────────────────────────── */

export interface AgingInputRow {
  partnerId: string | null;
  partner: string;
  amount: MoneyInput;
  bucket: AgingBucketKey;
  daysOverdue: number;
}

export interface PartnerAgingRow {
  partnerId: string | null;
  partner: string;
  total: Prisma.Decimal;
  buckets: Record<AgingBucketKey, Prisma.Decimal>;
  count: number;
  maxDaysOverdue: number;
  /** Porsi terhadap total keseluruhan (0..1). */
  share: number;
}

export interface PartnerAgingSummary {
  partners: PartnerAgingRow[];
  total: Prisma.Decimal;
}

function emptyBuckets(): Record<AgingBucketKey, Prisma.Decimal> {
  return AGING_BUCKET_KEYS.reduce(
    (acc, key) => {
      acc[key] = new Prisma.Decimal(0);
      return acc;
    },
    {} as Record<AgingBucketKey, Prisma.Decimal>
  );
}

/**
 * Kelompokkan baris umur per pihak lawan (pelanggan/vendor). Kunci grup memakai
 * `partnerId` bila ada, kalau tidak jatuh ke nama (data lama).
 */
export function summarizeAgingByPartner(rows: AgingInputRow[]): PartnerAgingSummary {
  const groups = new Map<string, PartnerAgingRow>();

  for (const row of rows) {
    const key = row.partnerId ? `id:${row.partnerId}` : `name:${row.partner.trim().toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        partnerId: row.partnerId,
        partner: row.partner,
        total: new Prisma.Decimal(0),
        buckets: emptyBuckets(),
        count: 0,
        maxDaysOverdue: 0,
        share: 0,
      };
      groups.set(key, group);
    }
    const amount = toMoney(row.amount).toDecimalPlaces(2);
    group.total = group.total.plus(amount);
    group.buckets[row.bucket] = group.buckets[row.bucket].plus(amount);
    group.count += 1;
    group.maxDaysOverdue = Math.max(group.maxDaysOverdue, row.daysOverdue);
  }

  const total = Array.from(groups.values()).reduce(
    (acc, g) => acc.plus(g.total),
    new Prisma.Decimal(0)
  );

  const partners = Array.from(groups.values())
    .map((g) => ({
      ...g,
      share: total.isZero() ? 0 : Number(g.total.div(total).toDecimalPlaces(4)),
    }))
    .sort((a, b) => b.total.comparedTo(a.total));

  return { partners, total };
}

/* ─────────────────────────── Proyeksi arus kas ─────────────────────────── */

export interface ForecastDocument {
  partner: string;
  dueDate: Date;
  outstanding: MoneyInput;
}

export interface CashFlowForecastBucket {
  key: string;
  label: string;
  inflow: Prisma.Decimal;
  outflow: Prisma.Decimal;
  net: Prisma.Decimal;
}

export interface CashFlowForecast {
  asOf: Date;
  horizonDays: number;
  inflowTotal: Prisma.Decimal;
  outflowTotal: Prisma.Decimal;
  netTotal: Prisma.Decimal;
  buckets: CashFlowForecastBucket[];
}

interface BucketWindow {
  key: string;
  label: string;
  start: number; // offset hari relatif terhadap asOf (inklusif)
  end: number; // offset hari relatif terhadap asOf (eksklusif), Infinity untuk terakhir
}

/**
 * Proyeksi arus kas dari dokumen AR (masuk) & AP (keluar) yang belum lunas.
 *
 * Bucket: "Terlambat" (dueDate < asOf) lalu per minggu sampai horizon, lalu
 * "Selebihnya". Nilai memakai sisa tagihan (outstanding), bukan total dokumen.
 */
export function forecastCashFlow(
  args: { ar: ForecastDocument[]; ap: ForecastDocument[] },
  asOf: Date,
  horizonDays = 30
): CashFlowForecast {
  const horizon = Math.max(1, Math.trunc(horizonDays));
  const weeks = Math.ceil(horizon / 7);

  const windows: BucketWindow[] = [{ key: 'overdue', label: 'Terlambat', start: -Infinity, end: 0 }];
  for (let w = 0; w < weeks; w += 1) {
    const start = w * 7;
    const end = Math.min((w + 1) * 7, horizon);
    windows.push({ key: `w${w + 1}`, label: `Hari ${start + 1}–${end}`, start, end });
  }
  // Bucket terakhir menampung sisa setelah horizon.
  windows.push({ key: 'beyond', label: `> ${horizon} hari`, start: horizon, end: Infinity });

  const buckets: CashFlowForecastBucket[] = windows.map((w) => ({
    key: w.key,
    label: w.label,
    inflow: new Prisma.Decimal(0),
    outflow: new Prisma.Decimal(0),
    net: new Prisma.Decimal(0),
  }));

  const windowForOffset = (offset: number): BucketWindow => {
    const found = windows.find((w) => offset >= w.start && offset < w.end);
    return found ?? windows[windows.length - 1];
  };

  const apply = (docs: ForecastDocument[], side: 'inflow' | 'outflow') => {
    for (const doc of docs) {
      const amount = toMoney(doc.outstanding).toDecimalPlaces(2);
      if (amount.lessThanOrEqualTo(0)) continue;
      const offset = Math.floor((doc.dueDate.getTime() - asOf.getTime()) / MS_PER_DAY);
      const bucket = windowForOffset(offset < 0 ? -1 : offset);
      const index = buckets.findIndex((b) => b.key === bucket.key);
      buckets[index][side] = buckets[index][side].plus(amount);
    }
  };

  apply(args.ar, 'inflow');
  apply(args.ap, 'outflow');

  for (const bucket of buckets) {
    bucket.net = bucket.inflow.minus(bucket.outflow);
  }

  const inflowTotal = buckets.reduce((acc, b) => acc.plus(b.inflow), new Prisma.Decimal(0));
  const outflowTotal = buckets.reduce((acc, b) => acc.plus(b.outflow), new Prisma.Decimal(0));

  return {
    asOf,
    horizonDays: horizon,
    inflowTotal,
    outflowTotal,
    netTotal: inflowTotal.minus(outflowTotal),
    buckets,
  };
}
