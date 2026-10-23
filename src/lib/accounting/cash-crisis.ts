import { AccountType, JournalSource, JournalStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getJakartaParts,
  jakartaStartOfMonth,
  shiftMonth,
} from './period';

/**
 * Cash Crisis Early Warning.
 *
 * Proyeksi memakai data aktual: saldo kas dari jurnal, kewajiban terjadwal,
 * piutang yang belum dibayar, dan rata-rata beban operasional. Piutang diberi
 * probabilitas tertagih berdasarkan umur; tidak ada angka pemasukan yang
 * dianggap pasti.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HORIZONS = [7, 14, 30, 60, 90] as const;

export type CashCrisisHorizon = (typeof HORIZONS)[number];
export type CashCrisisStatus = 'SAFE' | 'WATCH' | 'WARNING' | 'CRITICAL';
export type CashCrisisRiskLevel = 'RENDAH' | 'SEDANG' | 'TINGGI' | 'TIDAK_DAPAT_DIHITUNG';

export interface CashCrisisObligationInput {
  id: string;
  name: string;
  dueDate: Date;
  amount: number;
}

export interface CashCrisisReceivableInput {
  id: string;
  reference: string;
  client: string;
  dueDate: Date;
  amount: number;
  daysOverdue: number;
}

export interface CashCrisisCollectionHistory {
  paidInvoiceCount: number;
  averageDaysLate: number | null;
  medianDaysLate: number | null;
  sampleDaysLate: number[];
}

export interface CashCrisisInput {
  asOf: Date;
  horizonDays: CashCrisisHorizon;
  currentCash: number;
  monthlyOperatingExpense: number;
  obligations: CashCrisisObligationInput[];
  receivables: CashCrisisReceivableInput[];
  collectionHistory: CashCrisisCollectionHistory;
  warnings?: string[];
}

export interface CashCrisisObligation {
  id: string;
  name: string;
  dueDate: Date;
  amount: number;
  daysUntilDue: number;
  overdue: boolean;
}

export interface CashCrisisReceivable {
  id: string;
  reference: string;
  client: string;
  dueDate: Date;
  amount: number;
  daysOverdue: number;
  collectionProbability: number;
  expectedCollectionDate: Date;
  expectedAmount: number;
}

export interface CashCrisisPoint {
  date: Date;
  day: number;
  projectedBalance: number;
  expectedCollection: number;
  obligation: number;
  operatingExpense: number;
}

export interface CashCrisisRecommendation {
  priority: 'TINGGI' | 'SEDANG' | 'RENDAH';
  title: string;
  detail: string;
}

export interface CashCrisisAssessment {
  asOf: Date;
  horizonDays: CashCrisisHorizon;
  status: CashCrisisStatus;
  statusLabel: string;
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT';
  currentCash: number;
  monthlyOperatingExpense: number;
  dailyOperatingExpense: number;
  projectedBalance: number;
  minimumProjectedBalance: number;
  minimumProjectedDate: Date;
  firstShortfallDate: Date | null;
  firstShortfallDay: number | null;
  runwayDays: number;
  totalExpectedCollections: number;
  totalObligations: number;
  totalOverdueReceivables: number;
  collectionRisk: {
    level: CashCrisisRiskLevel;
    overdueCount: number;
    overdueAmount: number;
    overdueRatio: number | null;
    averageDaysOverdue: number | null;
    historicalAverageDaysLate: number | null;
    historicalPaidInvoiceCount: number;
    hasHistory: boolean;
  };
  obligations: CashCrisisObligation[];
  receivables: CashCrisisReceivable[];
  points: CashCrisisPoint[];
  recommendations: CashCrisisRecommendation[];
  warnings: string[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function normalizeCashCrisisHorizon(raw: unknown): CashCrisisHorizon {
  const value = Number(raw);
  return HORIZONS.includes(value as CashCrisisHorizon) ? (value as CashCrisisHorizon) : 30;
}

/** Probabilitas penagihan berdasarkan umur piutang. */
export function collectionProbability(daysOverdue: number): number {
  if (daysOverdue <= 0) return 0.9;
  if (daysOverdue <= 30) return 0.75;
  if (daysOverdue <= 60) return 0.55;
  return 0.3;
}

function expectedCollectionDay(daysOverdue: number): number {
  if (daysOverdue <= 0) return 0;
  if (daysOverdue <= 30) return 7;
  if (daysOverdue <= 60) return 14;
  return 30;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((acc, v) => acc + v, 0) / values.length;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function assessCashCrisis(input: CashCrisisInput): CashCrisisAssessment {
  const asOf = new Date(input.asOf);
  const dailyOperatingExpense = input.monthlyOperatingExpense / 30;

  const obligations: CashCrisisObligation[] = input.obligations
    .map((row) => {
      const daysUntilDue = Math.floor((row.dueDate.getTime() - asOf.getTime()) / DAY_MS);
      return {
        ...row,
        amount: round2(row.amount),
        dueDate: new Date(row.dueDate),
        daysUntilDue,
        overdue: daysUntilDue < 0,
      };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  const receivables: CashCrisisReceivable[] = input.receivables
    .map((row) => {
      const daysOverdue = Math.max(0, Math.floor((asOf.getTime() - row.dueDate.getTime()) / DAY_MS));
      const probability = collectionProbability(daysOverdue);
      const expectedDay =
        daysOverdue > 0
          ? expectedCollectionDay(daysOverdue)
          : Math.max(0, Math.floor((row.dueDate.getTime() - asOf.getTime()) / DAY_MS));
      return {
        ...row,
        amount: round2(row.amount),
        dueDate: new Date(row.dueDate),
        daysOverdue,
        collectionProbability: probability,
        expectedCollectionDate: addDays(asOf, expectedDay),
        expectedAmount: round2(row.amount * probability),
      };
    })
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue || b.amount - a.amount);

  const dueObligations = obligations.filter((row) => row.daysUntilDue <= input.horizonDays);
  const relevantReceivables = receivables.filter(
    (row) =>
      row.daysOverdue > 0 ||
      row.dueDate.getTime() <= addDays(asOf, input.horizonDays).getTime()
  );

  const obligationByDay = new Map<number, number>();
  for (const row of dueObligations) {
    const day = Math.max(0, row.daysUntilDue);
    if (day > input.horizonDays) continue;
    obligationByDay.set(day, (obligationByDay.get(day) ?? 0) + row.amount);
  }

  const collectionByDay = new Map<number, number>();
  const projectedReceivables: CashCrisisReceivable[] = [];
  for (const row of relevantReceivables) {
    const day = Math.max(
      0,
      Math.floor((row.expectedCollectionDate.getTime() - asOf.getTime()) / DAY_MS)
    );
    if (day > input.horizonDays) continue;
    projectedReceivables.push(row);
    collectionByDay.set(day, (collectionByDay.get(day) ?? 0) + row.expectedAmount);
  }

  const points: CashCrisisPoint[] = [];
  let cumulativeCollections = 0;
  let cumulativeObligations = 0;
  let firstShortfall: CashCrisisPoint | null = null;
  let minimum: CashCrisisPoint | null = null;

  for (let day = 0; day <= input.horizonDays; day += 1) {
    const expectedCollection = collectionByDay.get(day) ?? 0;
    const obligation = obligationByDay.get(day) ?? 0;
    cumulativeCollections += expectedCollection;
    cumulativeObligations += obligation;
    const operatingExpense = dailyOperatingExpense * day;
    const projectedBalance = round2(
      input.currentCash + cumulativeCollections - cumulativeObligations - operatingExpense
    );

    const point: CashCrisisPoint = {
      date: addDays(asOf, day),
      day,
      projectedBalance,
      expectedCollection: round2(expectedCollection),
      obligation: round2(obligation),
      operatingExpense: round2(operatingExpense),
    };
    points.push(point);

    if (projectedBalance < 0 && firstShortfall === null) firstShortfall = point;
    if (minimum === null || projectedBalance < minimum.projectedBalance) minimum = point;
  }

  const finalPoint = points[points.length - 1];
  const overdue = receivables.filter((row) => row.daysOverdue > 0);
  const totalOverdue = overdue.reduce((acc, row) => acc + row.amount, 0);
  const totalReceivables = receivables.reduce((acc, row) => acc + row.amount, 0);
  const overdueRatio = totalReceivables > 0 ? totalOverdue / totalReceivables : null;
  const averageDaysOverdue = average(overdue.map((row) => row.daysOverdue));
  const history = input.collectionHistory;
  const hasHistory = history.paidInvoiceCount > 0 && history.averageDaysLate !== null;

  const collectionRisk: CashCrisisAssessment['collectionRisk'] = {
    level:
      overdueRatio === null && !hasHistory
        ? 'TIDAK_DAPAT_DIHITUNG'
        : (overdueRatio ?? 0) > 0.5 || (averageDaysOverdue ?? 0) > 30
          ? 'TINGGI'
          : (overdueRatio ?? 0) > 0.25 || (averageDaysOverdue ?? 0) > 14
            ? 'SEDANG'
            : 'RENDAH',
    overdueCount: overdue.length,
    overdueAmount: round2(totalOverdue),
    overdueRatio: overdueRatio === null ? null : round2(overdueRatio),
    averageDaysOverdue: averageDaysOverdue === null ? null : round2(averageDaysOverdue),
    historicalAverageDaysLate:
      history.averageDaysLate === null ? null : round2(history.averageDaysLate),
    historicalPaidInvoiceCount: history.paidInvoiceCount,
    hasHistory,
  };

  const warnings = [...(input.warnings ?? [])];
  if (!hasHistory) {
    warnings.push(
      'Riwayat pelunasan pelanggan belum cukup. Proyeksi piutang memakai asumsi konservatif berdasarkan umur tagihan.'
    );
  }
  if (input.monthlyOperatingExpense <= 0) {
    warnings.push('Rata-rata beban operasional belum tersedia; proyeksi belum memasukkan beban berjalan.');
  }
  if (overdue.length > 0) {
    warnings.push(`${overdue.length} faktur sudah melewati jatuh tempo dan berisiko terlambat dibayar.`);
  }
  if (
    input.currentCash === 0 &&
    dueObligations.length === 0 &&
    relevantReceivables.length === 0 &&
    input.monthlyOperatingExpense <= 0
  ) {
    warnings.push('Belum ada saldo kas, kewajiban, piutang, atau beban operasional; status belum dapat dinilai secara utuh.');
  }

  const firstShortfallDay = firstShortfall ? (firstShortfall as CashCrisisPoint).day : null;
  const status: CashCrisisStatus =
    input.currentCash < 0 || (firstShortfallDay !== null && firstShortfallDay <= 7)
      ? 'CRITICAL'
      : firstShortfallDay !== null && firstShortfallDay <= 30
        ? 'WARNING'
        : (input.monthlyOperatingExpense > 0 && input.currentCash < input.monthlyOperatingExpense) ||
            (firstShortfallDay !== null && firstShortfallDay <= input.horizonDays) ||
            (overdueRatio !== null && overdueRatio > 0.3)
          ? 'WATCH'
          : input.currentCash !== 0 ||
              dueObligations.length > 0 ||
              relevantReceivables.length > 0 ||
              input.monthlyOperatingExpense > 0
            ? 'SAFE'
            : 'WATCH';

  const statusLabel: Record<CashCrisisStatus, string> = {
    SAFE: 'Aman',
    WATCH: 'Perlu Dipantau',
    WARNING: 'Peringatan',
    CRITICAL: 'Kritis',
  };

  const recommendations: CashCrisisRecommendation[] = [];
  if (firstShortfallDay !== null) {
    const gap = Math.abs(minimum?.projectedBalance ?? 0);
    const topOverdue = overdue.slice(0, 3);
    recommendations.push({
      priority: 'TINGGI',
      title: 'Percepat penagihan piutang',
      detail:
        topOverdue.length > 0
          ? `Prioritaskan ${topOverdue.map((r) => `${r.reference} (${r.client})`).join(', ')}. Total piutang jatuh tempo Rp ${Math.round(totalOverdue).toLocaleString('id-ID')}.`
          : 'Hubungi pelanggan dengan tagihan terdekat dan tetapkan tanggal pembayaran yang jelas.',
    });
    const obligationsBeforeShortfall = dueObligations.filter(
      (row) => row.daysUntilDue <= firstShortfallDay
    );
    if (obligationsBeforeShortfall.length > 0) {
      recommendations.push({
        priority: 'TINGGI',
        title: 'Jadwalkan ulang kewajiban',
        detail: `Kewajiban terdekat: ${obligationsBeforeShortfall
          .slice(0, 4)
          .map((row) => `${row.name} (Rp ${Math.round(row.amount).toLocaleString('id-ID')})`)
          .join(', ')}. Negoisasikan termin bila memungkinkan.`,
      });
    }
    recommendations.push({
      priority: 'TINGGI',
      title: 'Siapkan dana penutup kekurangan',
      detail: `Proyeksi kekurangan sekitar Rp ${Math.round(gap).toLocaleString('id-ID')} pada ${minimum?.date.toISOString().slice(0, 10)}. Siapkan buffer, percepat pencairan, atau tunda belanja non-esensial.`,
    });
  } else if (overdue.length > 0) {
    recommendations.push({
      priority: 'SEDANG',
      title: 'Tagih piutang jatuh tempo',
      detail: `${overdue.length} faktur senilai Rp ${Math.round(totalOverdue).toLocaleString('id-ID')} sudah lewat jatuh tempo. Kirim pengingat dan catat komitmen pembayaran.`,
    });
  }

  if (status === 'CRITICAL' || status === 'WARNING') {
    recommendations.push({
      priority: 'TINGGI',
      title: 'Tahan pengeluaran non-esensial',
      detail:
        'Tunda pembelian/perjalanan yang belum mendesak sampai posisi kas kembali di atas satu bulan beban operasional.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'RENDAH',
      title: 'Pantau kas secara berkala',
      detail: 'Tidak ada shortfall dalam horizon ini. Tetap tinjau proyeksi setiap minggu dan jaga kualitas piutang.',
    });
  }

  const dataQuality: CashCrisisAssessment['dataQuality'] =
    input.currentCash !== 0 && (dueObligations.length > 0 || relevantReceivables.length > 0)
      ? 'COMPLETE'
      : input.currentCash !== 0 || dueObligations.length > 0 || relevantReceivables.length > 0
        ? 'PARTIAL'
        : 'INSUFFICIENT';

  return {
    asOf,
    horizonDays: input.horizonDays,
    status,
    statusLabel: statusLabel[status],
    dataQuality,
    currentCash: round2(input.currentCash),
    monthlyOperatingExpense: round2(input.monthlyOperatingExpense),
    dailyOperatingExpense: round2(dailyOperatingExpense),
    projectedBalance: finalPoint?.projectedBalance ?? round2(input.currentCash),
    minimumProjectedBalance: minimum?.projectedBalance ?? round2(input.currentCash),
    minimumProjectedDate: minimum?.date ?? asOf,
    firstShortfallDate: firstShortfall?.date ?? null,
    firstShortfallDay,
    runwayDays: firstShortfallDay ?? input.horizonDays,
    totalExpectedCollections: round2(
      projectedReceivables.reduce((acc, row) => acc + row.expectedAmount, 0)
    ),
    totalObligations: round2(dueObligations.reduce((acc, row) => acc + row.amount, 0)),
    totalOverdueReceivables: round2(totalOverdue),
    collectionRisk,
    obligations,
    receivables,
    points,
    recommendations: recommendations.slice(0, 5),
    warnings,
  };
}

/* ───────────────────────── loader database ───────────────────────── */

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

export async function getCashCrisisAssessment(
  workspaceId: string,
  horizonRaw: unknown = 30,
  asOf: Date = new Date()
): Promise<CashCrisisAssessment> {
  const horizonDays = normalizeCashCrisisHorizon(horizonRaw);
  const parts = getJakartaParts(asOf);
  const expenseStart = jakartaStartOfMonth(
    shiftMonth(parts.year, parts.month, -2).year,
    shiftMonth(parts.year, parts.month, -2).month
  );
  const end = new Date(asOf.getTime() + horizonDays * DAY_MS);

  const [cashAggregate, cashRowCount, expenseAggregate, obligationRows, invoiceRows, paidInvoices] =
    await Promise.all([
      prisma.journalLine.aggregate({
        where: {
          workspaceId,
          cashAccountId: { not: null },
          entry: { status: JournalStatus.POSTED, entryDate: { lte: asOf } },
        },
        _sum: { debit: true, credit: true },
        _count: { id: true },
      }),
      prisma.journalLine.count({
        where: {
          workspaceId,
          cashAccountId: { not: null },
          entry: { status: JournalStatus.POSTED },
        },
      }),
      prisma.journalLine.aggregate({
        where: {
          workspaceId,
          account: { type: AccountType.EXPENSE },
          entry: {
            status: JournalStatus.POSTED,
            entryDate: { gte: expenseStart, lte: asOf },
            source: { notIn: [JournalSource.OPENING, JournalSource.CLOSING] },
          },
        },
        _sum: { debit: true, credit: true },
      }),
      prisma.scheduledObligation.findMany({
        where: {
          workspaceId,
          status: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { lte: end },
        },
        select: { id: true, name: true, dueDate: true, amount: true, paidAmount: true },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.invoice.findMany({
        where: {
          workspaceId,
          status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] },
          issueDate: { lte: asOf },
        },
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          dueDate: true,
          totalAmount: true,
          paidAmount: true,
        },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.invoice.findMany({
        where: {
          workspaceId,
          status: 'PAID',
          paidAt: { not: null },
        },
        select: { dueDate: true, paidAt: true },
        orderBy: { paidAt: 'desc' },
        take: 100,
      }),
    ]);

  const warnings: string[] = [];
  let currentCash = num(cashAggregate._sum.debit) - num(cashAggregate._sum.credit);

  // Fallback untuk workspace yang belum punya jurnal kas (mis. modul akuntansi
  // baru diaktifkan). Angka tetap berasal dari Buku Kas, bukan demo.
  if (cashRowCount === 0) {
    const fallback = await prisma.cashTransaction.groupBy({
      by: ['type'],
      where: { workspaceId, transactionDate: { lte: asOf } },
      _sum: { amount: true },
    });
    currentCash = fallback.reduce(
      (acc, row) => acc + (row.type === 'INCOME' ? num(row._sum.amount) : -num(row._sum.amount)),
      0
    );
    warnings.push('Belum ada jurnal kas; saldo kas diambil dari Buku Kas sebagai fallback.');
  }

  const monthlyOperatingExpense = Math.max(
    0,
    (num(expenseAggregate._sum.debit) - num(expenseAggregate._sum.credit)) / 3
  );

  const sampleDaysLate = paidInvoices
    .map((row) => {
      if (!row.paidAt) return null;
      return Math.max(0, Math.floor((row.paidAt.getTime() - row.dueDate.getTime()) / DAY_MS));
    })
    .filter((v): v is number => v !== null);

  const collectionHistory: CashCrisisCollectionHistory = {
    paidInvoiceCount: sampleDaysLate.length,
    averageDaysLate: average(sampleDaysLate),
    medianDaysLate: median(sampleDaysLate),
    sampleDaysLate,
  };

  const obligations: CashCrisisObligationInput[] = obligationRows
    .map((row) => ({
      id: row.id,
      name: row.name,
      dueDate: row.dueDate,
      amount: Math.max(0, num(row.amount) - num(row.paidAmount)),
    }))
    .filter((row) => row.amount > 0);

  const receivables: CashCrisisReceivableInput[] = invoiceRows
    .map((row) => ({
      id: row.id,
      reference: row.invoiceNumber,
      client: row.clientName,
      dueDate: row.dueDate,
      amount: Math.max(0, num(row.totalAmount) - num(row.paidAmount)),
      daysOverdue: Math.max(
        0,
        Math.floor((asOf.getTime() - row.dueDate.getTime()) / DAY_MS)
      ),
    }))
    .filter((row) => row.amount > 0);

  return assessCashCrisis({
    asOf,
    horizonDays,
    currentCash,
    monthlyOperatingExpense,
    obligations,
    receivables,
    collectionHistory,
    warnings,
  });
}
