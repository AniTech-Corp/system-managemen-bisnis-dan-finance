import { JournalSource, JournalStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getAgingReport } from './aux-reports';
import { getBalanceSheet, getIncomeStatement, type IncomeStatement } from './reports';
import {
  getJakartaParts,
  jakartaEndOfMonth,
  jakartaStartOfMonth,
  shiftMonth,
  type DateRange,
} from './period';

/**
 * Financial Health Score berbasis data akuntansi aktual.
 *
 * Semua angka berasal dari jurnal POSTED dan dokumen sumber (faktur/kewajiban)
 * yang memang sudah ada. Tidak ada angka contoh atau fallback demo. Bila data
 * belum cukup, komponen diberi skor null dan UI menampilkan "Belum ada data".
 */

export type FinancialHealthGrade =
  | 'SANGAT_SEHAT'
  | 'SEHAT'
  | 'CUKUP'
  | 'BERISIKO'
  | 'KRITIS'
  | 'BELUM_ADA_DATA';

export type FinancialHealthComponentKey =
  | 'LIQUIDITY'
  | 'PROFITABILITY'
  | 'DEBT_BURDEN'
  | 'RECEIVABLE_TURNOVER'
  | 'CASH_STABILITY';

export type FinancialHealthComponentStatus =
  | 'SEHAT'
  | 'CUKUP'
  | 'BERISIKO'
  | 'KRITIS'
  | 'TIDAK_ADA_DATA';

export interface FinancialHealthComponent {
  key: FinancialHealthComponentKey;
  label: string;
  weight: number;
  score: number | null;
  status: FinancialHealthComponentStatus;
  summary: string;
  metrics: Record<string, number | null>;
}

export interface FinancialHealthRecommendation {
  component: FinancialHealthComponentKey;
  priority: 'TINGGI' | 'SEDANG' | 'RENDAH';
  title: string;
  detail: string;
}

export interface MonthlyCashFlowPoint {
  key: string;
  label: string;
  net: number;
}

export interface FinancialHealthInput {
  asOf: Date;
  period: DateRange;
  cash: number;
  receivables: number;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  revenue: number;
  netIncome: number;
  previousRevenue: number;
  previousNetIncome: number;
  operatingExpenses: number;
  obligationsDue30: number;
  overdueReceivableAmount: number;
  monthlyCashFlows: MonthlyCashFlowPoint[];
  warnings?: string[];
}

export interface FinancialHealthScore {
  asOf: Date;
  period: DateRange;
  totalScore: number | null;
  grade: FinancialHealthGrade;
  gradeLabel: string;
  summary: string;
  dataQuality: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT';
  components: FinancialHealthComponent[];
  strengths: string[];
  risks: string[];
  recommendations: FinancialHealthRecommendation[];
  metrics: {
    cash: number;
    receivables: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    revenue: number;
    netIncome: number;
    netMarginPct: number | null;
    previousNetMarginPct: number | null;
    monthlyRevenue: number;
    monthlyOperatingExpenses: number;
    obligationsDue30: number;
    overdueReceivableAmount: number;
    dsoDays: number | null;
    overdueReceivableRatio: number | null;
    debtRatio: number | null;
    liquidityRatio: number | null;
    cashRunwayMonths: number | null;
  };
  monthlyCashFlows: MonthlyCashFlowPoint[];
  warnings: string[];
}

const WEIGHTS: Record<FinancialHealthComponentKey, number> = {
  LIQUIDITY: 25,
  PROFITABILITY: 25,
  DEBT_BURDEN: 15,
  RECEIVABLE_TURNOVER: 20,
  CASH_STABILITY: 15,
};

const LABELS: Record<FinancialHealthComponentKey, string> = {
  LIQUIDITY: 'Likuiditas',
  PROFITABILITY: 'Profitabilitas',
  DEBT_BURDEN: 'Beban Utang',
  RECEIVABLE_TURNOVER: 'Perputaran Piutang',
  CASH_STABILITY: 'Stabilitas Arus Kas',
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function ratio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function scoreHigher(value: number, bands: Array<[number, number]>): number {
  for (const [minimum, score] of bands) {
    if (value >= minimum) return score;
  }
  return 0;
}

function scoreLower(value: number, bands: Array<[number, number]>): number {
  for (const [maximum, score] of bands) {
    if (value <= maximum) return score;
  }
  return 0;
}

export function componentStatus(score: number | null): FinancialHealthComponentStatus {
  if (score === null) return 'TIDAK_ADA_DATA';
  if (score >= 80) return 'SEHAT';
  if (score >= 60) return 'CUKUP';
  if (score >= 40) return 'BERISIKO';
  return 'KRITIS';
}

export function gradeForScore(score: number | null): { grade: FinancialHealthGrade; label: string } {
  if (score === null) return { grade: 'BELUM_ADA_DATA', label: 'Belum Ada Data' };
  if (score >= 85) return { grade: 'SANGAT_SEHAT', label: 'Sangat Sehat' };
  if (score >= 70) return { grade: 'SEHAT', label: 'Sehat' };
  if (score >= 55) return { grade: 'CUKUP', label: 'Cukup' };
  if (score >= 40) return { grade: 'BERISIKO', label: 'Berisiko' };
  return { grade: 'KRITIS', label: 'Kritis' };
}

function liquidityComponent(input: FinancialHealthInput): FinancialHealthComponent {
  const monthlyOperatingExpenses = input.operatingExpenses / 3;
  const hasCashData = input.cash !== 0 || input.receivables !== 0;
  const hasBalanceData = input.totalLiabilities !== 0 || input.totalAssets !== 0;
  const liquidityRatio = ratio(input.cash + input.receivables, input.totalLiabilities);
  const runwayMonths = monthlyOperatingExpenses > 0 ? ratio(input.cash, monthlyOperatingExpenses) : null;

  const ratioScore = !hasCashData && !hasBalanceData
    ? null
    : liquidityRatio === null
      ? input.totalLiabilities === 0 && hasCashData
        ? 100
        : null
      : scoreHigher(liquidityRatio, [
          [2, 100],
          [1.5, 85],
          [1.2, 70],
          [1, 55],
          [0.7, 35],
          [0, 15],
        ]);
  const runwayScore =
    runwayMonths === null
      ? null
      : scoreHigher(runwayMonths, [
          [6, 100],
          [3, 85],
          [2, 70],
          [1, 50],
          [0.5, 30],
          [0, 15],
        ]);

  const parts = [ratioScore, runwayScore].filter((v): v is number => v !== null);
  const score = parts.length
    ? Math.round(parts.reduce((acc, v) => acc + v, 0) / parts.length)
    : null;

  return {
    key: 'LIQUIDITY',
    label: LABELS.LIQUIDITY,
    weight: WEIGHTS.LIQUIDITY,
    score,
    status: componentStatus(score),
    summary:
      score === null
        ? 'Data kas, piutang, atau liabilitas belum cukup untuk menilai likuiditas.'
        : `Kas + piutang ${liquidityRatio === null ? 'belum dapat dibandingkan' : `${round2(liquidityRatio)}x liabilitas`}; runway kas ${runwayMonths === null ? 'belum tersedia' : `${round2(runwayMonths)} bulan`}.`,
    metrics: {
      liquidityRatio: liquidityRatio === null ? null : round2(liquidityRatio),
      cashRunwayMonths: runwayMonths === null ? null : round2(runwayMonths),
    },
  };
}

function profitabilityComponent(input: FinancialHealthInput): FinancialHealthComponent {
  const netMargin = ratio(input.netIncome, input.revenue);
  const previousMargin = ratio(input.previousNetIncome, input.previousRevenue);
  if (netMargin === null) {
    return {
      key: 'PROFITABILITY',
      label: LABELS.PROFITABILITY,
      weight: WEIGHTS.PROFITABILITY,
      score: null,
      status: 'TIDAK_ADA_DATA',
      summary: 'Pendapatan belum tercatat pada periode analisis, margin laba belum dapat dihitung.',
      metrics: { netMarginPct: null, previousNetMarginPct: previousMargin === null ? null : round2(previousMargin * 100) },
    };
  }

  const base = scoreHigher(netMargin, [
    [0.2, 100],
    [0.15, 90],
    [0.1, 80],
    [0.05, 65],
    [0, 50],
    [-0.05, 30],
    [-1, 10],
  ]);
  const trend = previousMargin === null ? 0 : netMargin - previousMargin;
  const trendAdjustment = trend > 0.03 ? 10 : trend < -0.03 ? -10 : 0;
  const score = Math.max(0, Math.min(100, base + trendAdjustment));

  return {
    key: 'PROFITABILITY',
    label: LABELS.PROFITABILITY,
    weight: WEIGHTS.PROFITABILITY,
    score,
    status: componentStatus(score),
    summary: `Margin laba ${round2(netMargin * 100)}%${previousMargin === null ? '' : `; periode sebelumnya ${round2(previousMargin * 100)}%`}.`,
    metrics: {
      netMarginPct: round2(netMargin * 100),
      previousNetMarginPct: previousMargin === null ? null : round2(previousMargin * 100),
    },
  };
}

function debtComponent(input: FinancialHealthInput): FinancialHealthComponent {
  const monthlyRevenue = input.revenue / 3;
  const hasBalanceData = input.totalAssets !== 0 || input.totalLiabilities !== 0;
  const hasObligationData = input.obligationsDue30 > 0 || monthlyRevenue > 0;
  const debtRatio = ratio(input.totalLiabilities, input.totalAssets);
  const coverage = input.obligationsDue30 <= 0 ? null : ratio(monthlyRevenue, input.obligationsDue30);

  const debtScore =
    !hasBalanceData
      ? null
      : debtRatio === null
        ? input.totalLiabilities > 0
          ? 0
          : 100
        : scoreLower(debtRatio, [
            [0.3, 100],
            [0.5, 85],
            [0.7, 65],
            [0.9, 40],
            [1, 15],
          ]);
  const coverageScore = !hasObligationData
    ? null
    : coverage === null
      ? input.obligationsDue30 <= 0
        ? 100
        : null
      : scoreHigher(coverage, [
          [3, 100],
          [2, 85],
          [1, 65],
          [0.5, 40],
          [0, 15],
        ]);

  const parts = [debtScore, coverageScore].filter((v): v is number => v !== null);
  const score = parts.length ? Math.round(parts.reduce((acc, v) => acc + v, 0) / parts.length) : null;

  return {
    key: 'DEBT_BURDEN',
    label: LABELS.DEBT_BURDEN,
    weight: WEIGHTS.DEBT_BURDEN,
    score,
    status: componentStatus(score),
    summary:
      score === null
        ? 'Neraca atau kewajiban jatuh tempo belum tersedia.'
        : `Rasio utang ${debtRatio === null ? 'tidak tersedia' : `${round2(debtRatio * 100)}% aset`}; kewajiban 30 hari ${coverage === null ? 'tidak tersedia' : `${round2(coverage)}x pendapatan bulanan`}.`,
    metrics: {
      debtRatio: debtRatio === null ? null : round2(debtRatio),
      obligationCoverage: coverage === null ? null : round2(coverage),
      obligationsDue30: round2(input.obligationsDue30),
    },
  };
}

function receivableComponent(input: FinancialHealthInput): FinancialHealthComponent {
  const monthlyRevenue = input.revenue / 3;
  const hasData = input.receivables !== 0 || monthlyRevenue > 0;
  const dsoDays = monthlyRevenue > 0 ? (input.receivables / monthlyRevenue) * 30 : null;
  const overdueRatio = ratio(input.overdueReceivableAmount, input.receivables);

  const dsoScore =
    dsoDays === null
      ? null
      : scoreLower(dsoDays, [
          [30, 100],
          [45, 85],
          [60, 70],
          [90, 50],
          [120, 30],
          [Number.POSITIVE_INFINITY, 10],
        ]);
  const overdueScore = !hasData
    ? null
    : overdueRatio === null
      ? input.receivables === 0 && monthlyRevenue > 0
        ? 100
        : null
      : scoreLower(overdueRatio, [
          [0.1, 100],
          [0.25, 85],
          [0.5, 65],
          [0.75, 40],
          [1, 15],
        ]);

  const parts = [dsoScore, overdueScore].filter((v): v is number => v !== null);
  const score = parts.length ? Math.round(parts.reduce((acc, v) => acc + v, 0) / parts.length) : null;

  return {
    key: 'RECEIVABLE_TURNOVER',
    label: LABELS.RECEIVABLE_TURNOVER,
    weight: WEIGHTS.RECEIVABLE_TURNOVER,
    score,
    status: componentStatus(score),
    summary:
      score === null
        ? 'Pendapatan atau saldo piutang belum cukup untuk menghitung perputaran piutang.'
        : `DSO ${dsoDays === null ? 'tidak tersedia' : `${round2(dsoDays)} hari`}; piutang jatuh tempo ${overdueRatio === null ? 'tidak tersedia' : `${round2(overdueRatio * 100)}%`}.`,
    metrics: {
      dsoDays: dsoDays === null ? null : round2(dsoDays),
      overdueReceivableRatio: overdueRatio === null ? null : round2(overdueRatio),
      receivables: round2(input.receivables),
    },
  };
}

function cashStabilityComponent(input: FinancialHealthInput): FinancialHealthComponent {
  const values = input.monthlyCashFlows.map((p) => p.net);
  if (values.length < 2 || values.every((value) => value === 0)) {
    return {
      key: 'CASH_STABILITY',
      label: LABELS.CASH_STABILITY,
      weight: WEIGHTS.CASH_STABILITY,
      score: null,
      status: 'TIDAK_ADA_DATA',
      summary:
        values.length < 2
          ? 'Riwayat arus kas belum cukup (minimal dua bulan) untuk menilai stabilitas.'
          : 'Belum ada mutasi kas pada enam bulan terakhir; stabilitas arus kas belum dapat dinilai.',
      metrics: { positiveMonthsRatio: null, cashFlowCv: null },
    };
  }

  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = mean === 0 ? (standardDeviation === 0 ? 0 : 2) : standardDeviation / Math.abs(mean);
  const positiveRatio = values.filter((v) => v > 0).length / values.length;

  const stabilityScore = scoreLower(coefficientOfVariation, [
    [0.25, 100],
    [0.5, 85],
    [0.8, 65],
    [1.2, 40],
    [Number.POSITIVE_INFINITY, 15],
  ]);
  const positiveScore = scoreHigher(positiveRatio, [
    [0.8, 100],
    [0.6, 85],
    [0.5, 70],
    [0.3, 40],
    [0, 15],
  ]);
  const score = mean < 0 ? Math.min(40, Math.round((stabilityScore + positiveScore) / 2)) : Math.round((stabilityScore + positiveScore) / 2);

  return {
    key: 'CASH_STABILITY',
    label: LABELS.CASH_STABILITY,
    weight: WEIGHTS.CASH_STABILITY,
    score,
    status: componentStatus(score),
    summary: `Rata-rata arus kas bulanan ${mean >= 0 ? 'positif' : 'negatif'}; ${Math.round(positiveRatio * 100)}% bulan menghasilkan arus kas positif.`,
    metrics: {
      positiveMonthsRatio: round2(positiveRatio),
      cashFlowCv: round2(coefficientOfVariation),
      averageMonthlyCashFlow: round2(mean),
    },
  };
}

function buildRecommendations(components: FinancialHealthComponent[]): FinancialHealthRecommendation[] {
  const byKey = new Map(components.map((c) => [c.key, c]));
  const recommendations: FinancialHealthRecommendation[] = [];
  const add = (
    key: FinancialHealthComponentKey,
    priority: FinancialHealthRecommendation['priority'],
    title: string,
    detail: string
  ) => recommendations.push({ component: key, priority, title, detail });

  const liquidity = byKey.get('LIQUIDITY');
  if (liquidity && (liquidity.score === null || liquidity.score < 70)) {
    add(
      'LIQUIDITY',
      'TINGGI',
      'Perkuat bantalan kas',
      'Percepat penagihan piutang dan tahan pengeluaran yang belum mendesak sampai kas setara minimal 3 bulan beban operasional.'
    );
  }

  const profit = byKey.get('PROFITABILITY');
  if (profit && (profit.score === null || profit.score < 65)) {
    add(
      'PROFITABILITY',
      'SEDANG',
      'Tinjau struktur biaya dan margin',
      'Bandingkan HPP dan beban operasional dengan pendapatan; fokuskan sumber daya pada produk/divisi dengan margin terbaik.'
    );
  }

  const debt = byKey.get('DEBT_BURDEN');
  if (debt && (debt.score === null || debt.score < 65)) {
    add(
      'DEBT_BURDEN',
      'TINGGI',
      'Jadwalkan kewajiban jatuh tempo',
      'Sisihkan kas untuk kewajiban 30 hari ke depan dan hindari komitmen utang baru sebelum rasio utang membaik.'
    );
  }

  const receivable = byKey.get('RECEIVABLE_TURNOVER');
  if (receivable && (receivable.score === null || receivable.score < 70)) {
    add(
      'RECEIVABLE_TURNOVER',
      'TINGGI',
      'Percepat perputaran piutang',
      'Kirim pengingat untuk faktur yang jatuh tempo, prioritaskan pelanggan dengan tunggakan terbesar, dan pertimbangkan termin yang lebih pendek.'
    );
  }

  const cash = byKey.get('CASH_STABILITY');
  if (cash && (cash.score === null || cash.score < 65)) {
    add(
      'CASH_STABILITY',
      'SEDANG',
      'Stabilkan arus kas bulanan',
      'Susun anggaran kas bulanan dan jaga buffer untuk bulan dengan pengeluaran besar agar arus kas tidak berayun tajam.'
    );
  }

  if (recommendations.length === 0) {
    add(
      'LIQUIDITY',
      'RENDAH',
      'Pertahankan disiplin kas',
      'Skor komponen sudah baik. Lanjutkan pemantauan bulanan dan jaga kualitas piutang serta kewajiban.'
    );
  }

  return recommendations.slice(0, 5);
}

export function calculateFinancialHealthScore(input: FinancialHealthInput): FinancialHealthScore {
  const components = [
    liquidityComponent(input),
    profitabilityComponent(input),
    debtComponent(input),
    receivableComponent(input),
    cashStabilityComponent(input),
  ];

  const available = components.filter((c): c is FinancialHealthComponent & { score: number } => c.score !== null);
  const totalWeight = available.reduce((acc, c) => acc + c.weight, 0);
  const weighted = available.reduce((acc, c) => acc + c.score * c.weight, 0);
  const totalScore = totalWeight > 0 ? Math.round(weighted / totalWeight) : null;
  const grade = gradeForScore(totalScore);

  const strengths = components
    .filter((c) => c.score !== null && c.score >= 80)
    .map((c) => `${c.label}: ${c.summary}`);
  const risks = components
    .filter((c) => c.score === null || c.score < 60)
    .map((c) => `${c.label}: ${c.summary}`);

  const warnings = [...(input.warnings ?? [])];
  if (available.length < components.length) {
    warnings.push('Sebagian komponen belum memiliki data aktual; skor dihitung dari komponen yang tersedia.');
  }
  if (input.cash === 0 && input.revenue === 0 && input.totalAssets === 0) {
    warnings.push('Belum ada jurnal keuangan yang diposting untuk workspace ini.');
  }

  const dataQuality =
    available.length === components.length
      ? 'COMPLETE'
      : available.length >= 2
        ? 'PARTIAL'
        : 'INSUFFICIENT';

  const netMargin = ratio(input.netIncome, input.revenue);
  const previousNetMargin = ratio(input.previousNetIncome, input.previousRevenue);
  const monthlyRevenue = input.revenue / 3;
  const monthlyOperatingExpenses = input.operatingExpenses / 3;
  const dsoDays = monthlyRevenue > 0 ? (input.receivables / monthlyRevenue) * 30 : null;
  const overdueRatio = ratio(input.overdueReceivableAmount, input.receivables);

  return {
    asOf: input.asOf,
    period: input.period,
    totalScore,
    grade: grade.grade,
    gradeLabel: grade.label,
    summary:
      totalScore === null
        ? 'Data keuangan belum cukup untuk menghitung skor kesehatan.'
        : `Skor kesehatan keuangan ${totalScore}/100 (${grade.label}). ${available.length} dari ${components.length} komponen memiliki data.`,
    dataQuality,
    components,
    strengths,
    risks,
    recommendations: buildRecommendations(components),
    metrics: {
      cash: round2(input.cash),
      receivables: round2(input.receivables),
      totalAssets: round2(input.totalAssets),
      totalLiabilities: round2(input.totalLiabilities),
      totalEquity: round2(input.totalEquity),
      revenue: round2(input.revenue),
      netIncome: round2(input.netIncome),
      netMarginPct: netMargin === null ? null : round2(netMargin * 100),
      previousNetMarginPct: previousNetMargin === null ? null : round2(previousNetMargin * 100),
      monthlyRevenue: round2(monthlyRevenue),
      monthlyOperatingExpenses: round2(monthlyOperatingExpenses),
      obligationsDue30: round2(input.obligationsDue30),
      overdueReceivableAmount: round2(input.overdueReceivableAmount),
      dsoDays: dsoDays === null ? null : round2(dsoDays),
      overdueReceivableRatio: overdueRatio === null ? null : round2(overdueRatio),
      debtRatio: ratio(input.totalLiabilities, input.totalAssets),
      liquidityRatio: ratio(input.cash + input.receivables, input.totalLiabilities),
      cashRunwayMonths: ratio(input.cash, monthlyOperatingExpenses),
    },
    monthlyCashFlows: input.monthlyCashFlows,
    warnings,
  };
}

/* ───────────────────────── loader database ───────────────────────── */

function addMonthsToRange(year: number, month: number, delta: number): DateRange {
  const shifted = shiftMonth(year, month, delta);
  return {
    startDate: jakartaStartOfMonth(shifted.year, shifted.month),
    endDate: jakartaEndOfMonth(shifted.year, shifted.month),
  };
}

function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'number' ? value : Number(value);
}

function statementNetIncome(statement: IncomeStatement): number {
  return num(statement.totals.netIncome);
}

function statementRevenue(statement: IncomeStatement): number {
  return num(statement.totals.revenue);
}

function statementOperatingExpenses(statement: IncomeStatement): number {
  return (
    num(statement.totals.cogs) +
    num(statement.totals.operatingExpenses) +
    num(statement.totals.taxExpenses)
  );
}

function monthKey(date: Date): string {
  const parts = getJakartaParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export async function getFinancialHealthScore(
  workspaceId: string,
  asOf: Date = new Date()
): Promise<FinancialHealthScore> {
  const parts = getJakartaParts(asOf);
  const currentRange: DateRange = {
    startDate: jakartaStartOfMonth(shiftMonth(parts.year, parts.month, -2).year, shiftMonth(parts.year, parts.month, -2).month),
    endDate: asOf,
  };
  const previousEnd = addMonthsToRange(parts.year, parts.month, -3);
  const previousStart = addMonthsToRange(parts.year, parts.month, -5);
  const previousRange: DateRange = { startDate: previousStart.startDate, endDate: previousEnd.endDate };
  const cashFlowStart = addMonthsToRange(parts.year, parts.month, -5).startDate;

  const [setting, currentIncome, previousIncome, arAging, obligationRows, cashAggregate, cashLines] =
    await Promise.all([
      prisma.accountingSetting.findUnique({ where: { workspaceId }, select: { fiscalYearStartMonth: true } }),
      getIncomeStatement(workspaceId, currentRange),
      getIncomeStatement(workspaceId, previousRange),
      getAgingReport(workspaceId, 'AR', asOf),
      prisma.scheduledObligation.findMany({
        where: {
          workspaceId,
          status: { in: ['PENDING', 'PARTIAL'] },
          dueDate: { lte: new Date(asOf.getTime() + 30 * 24 * 60 * 60 * 1000) },
        },
        select: { amount: true, paidAmount: true },
      }),
      prisma.journalLine.aggregate({
        where: {
          workspaceId,
          cashAccountId: { not: null },
          entry: { status: JournalStatus.POSTED, entryDate: { lte: asOf } },
        },
        _sum: { debit: true, credit: true },
      }),
      prisma.journalLine.findMany({
        where: {
          workspaceId,
          cashAccountId: { not: null },
          entry: {
            status: JournalStatus.POSTED,
            entryDate: { gte: cashFlowStart, lte: asOf },
            source: { notIn: [JournalSource.OPENING, JournalSource.CLOSING] },
          },
        },
        select: { debit: true, credit: true, entry: { select: { entryDate: true } } },
      }),
    ]);

  // `fiscalYearStartMonth` memengaruhi laba tahun berjalan di neraca. Ambil
  // neraca setelah setting terbaca agar tidak perlu query ulang.
  const fiscalStartMonth = setting?.fiscalYearStartMonth ?? 1;
  const finalBalanceSheet = await getBalanceSheet(workspaceId, asOf, fiscalStartMonth);

  const cash = num(cashAggregate._sum.debit) - num(cashAggregate._sum.credit);
  const receivables = num(arAging.total);
  const overdueReceivableAmount = arAging.rows
    .filter((row) => row.daysOverdue > 0)
    .reduce((acc, row) => acc + num(row.amount), 0);

  const obligationsDue30 = obligationRows.reduce(
    (acc, row) => acc + Math.max(0, num(row.amount) - num(row.paidAmount)),
    0
  );

  const revenue = statementRevenue(currentIncome);
  const netIncome = statementNetIncome(currentIncome);
  const previousRevenue = statementRevenue(previousIncome);
  const previousNetIncome = statementNetIncome(previousIncome);
  const operatingExpenses = statementOperatingExpenses(currentIncome);

  const monthMap = new Map<string, number>();
  const monthKeys: string[] = [];
  for (let offset = -5; offset <= 0; offset += 1) {
    const shifted = shiftMonth(parts.year, parts.month, offset);
    const key = `${shifted.year}-${String(shifted.month).padStart(2, '0')}`;
    monthKeys.push(key);
    monthMap.set(key, 0);
  }
  for (const line of cashLines) {
    const key = monthKey(line.entry.entryDate);
    if (!monthMap.has(key)) continue;
    monthMap.set(key, (monthMap.get(key) ?? 0) + num(line.debit) - num(line.credit));
  }

  const monthlyCashFlows = monthKeys.map((key) => ({
    key,
    label: monthLabel(key),
    net: round2(monthMap.get(key) ?? 0),
  }));

  const warnings = [...finalBalanceSheet.warnings, ...arAging.warnings];
  if (cashLines.length === 0) {
    warnings.push('Belum ada mutasi kas yang diposting; stabilitas arus kas belum dapat dinilai.');
  }
  if (obligationsDue30 === 0) {
    warnings.push('Tidak ada kewajiban terjadwal dalam 30 hari ke depan.');
  }

  return calculateFinancialHealthScore({
    asOf,
    period: currentRange,
    cash,
    receivables,
    totalAssets: num(finalBalanceSheet.totals.assets),
    totalLiabilities: num(finalBalanceSheet.totals.liabilities),
    totalEquity: num(finalBalanceSheet.totals.equity),
    revenue,
    netIncome,
    previousRevenue,
    previousNetIncome,
    operatingExpenses,
    obligationsDue30,
    overdueReceivableAmount,
    monthlyCashFlows,
    warnings,
  });
}
