import { prisma } from '@/lib/prisma';
import { AccountType, Prisma } from '@prisma/client';
import { monthRange, jakartaEndOfMonth, shiftMonth, formatPeriodKey } from './period';
import { getAgingReport } from './aux-reports';

const ZERO = new Prisma.Decimal(0);
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Laju konvergensi piutang menuju target tiap bulan (1/3 = satu siklus
 * penagihan per bulan). Konsisten dengan logika aging yang dipakai modul
 * akuntansi: piutang yang menumpuk butuh beberapa bulan untuk tertagih.
 */
const AR_CONVERGENCE = 1 / 3;

/**
 * Monthly baseline data derived from posted journal lines
 */
export interface MonthlyBaseline {
  month: string;           // "2026-01"
  monthLabel: string;      // "Jan 26"
  revenue: number;         // Total revenue from REVENUE accounts
  expense: number;         // Total expense from EXPENSE accounts
  netIncome: number;
  cashBalance: number;     // Saldo kas+bank kumulatif
  dso: number;             // Days Sales Outstanding
  arBalance: number;       // Total piutang usaha
}

/**
 * Parameters for a single scenario
 */
export interface ScenarioParams {
  id: string;              // "optimistic" | "normal" | "pessimistic" | custom
  label: string;           // Display label
  salesDeltaPct: number;   // e.g. +10, 0, -20
  opexDeltaPct: number;    // e.g. +2, 0, +5
  delayDays: number;       // Additional days customers pay late
}

/**
 * Projected month for a single scenario
 */
export interface MonthProjection {
  month: number;
  monthLabel: string;
  revenue: number;
  expense: number;
  netIncome: number;
  cashInflow: number;      // Revenue adjusted for payment delay
  cashOutflow: number;     // = expense
  netCashFlow: number;
  cashBalance: number;
  runwayMonths: number | null;
  dso: number;
  arBalance: number;
}

/**
 * Full projection for one scenario across all months
 */
export interface ScenarioProjection {
  id: string;
  label: string;
  months: MonthProjection[];
  summary: {
    finalCashBalance: number;
    avgRunwayMonths: number | null;
    cashOutMonth: number | null;  // 1-based month when cash hits 0
    totalRevenue: number;
    totalExpense: number;
    totalNetIncome: number;
  };
}

/**
 * Complete result returned to UI
 */
export interface ProjectionResult {
  baseline: MonthlyBaseline[];
  scenarios: ScenarioProjection[];
  kpis: {
    currentCash: number;
    currentRunway: number | null;
    currentDso: number;
    projectionHorizon: number;
  };
}

/**
 * Akun kas & bank yang dipakai untuk menghitung saldo kas.
 *
 * SUMBER KEBENARAN: tabel `cash_accounts` (CashAccount), BUKAN pola kode
 * akun. Pola kode seperti "1-1*" SALAH karena ikut men馅 Piutang Usaha
 * (1-1300), Persediaan (1-1400), dan PPN Masukan (1-1600) -- semuanya
 * berawalan "1-1" tapi BUKAN uang tunai. CashAccount sudah dipetakan ke
 * Account lewat `accountId`, jadi ikut persis dengan logika arus kas resmi
 * di `getCashFlowStatement` (reports.ts).
 */
async function resolveCashAccountIds(workspaceId: string): Promise<Set<string>> {
  const cashAccounts = await prisma.cashAccount.findMany({
    where: { workspaceId },
    select: { accountId: true },
  });
  return new Set(cashAccounts.map((c) => c.accountId));
}

/**
 * Akun piutang usaha untuk DSO.
 * Piutang usaha = 1-1300, Piutang lain-lain = 1-1310.
 */
const AR_ACCOUNT_CODES = ['1-1300', '1-1310'];

/**
 * Bangun baseline bulanan dari `journal_lines` (hanya entry POSTED).
 *
 * PRINSIP: satu query untuk SELURUH periode (epoch -> akhir lookback), lalu
 * dikelompokkan per bulan di memori. Mengambil satu bulan per query akan
 * mengulang pekerjaan yang sama 6-12 kali dan tetap salah untuk saldo kas
 * kumulatif, karena saldo kas bulan lalu harus membawa saldo bulan lalu.
 */
export async function buildMonthlyBaseline(
  workspaceId: string,
  lookbackMonths: number = 6
): Promise<MonthlyBaseline[]> {
  const now = new Date();
  const endMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
  const startMonth = shiftMonth(endMonth.year, endMonth.month, -lookbackMonths + 1);
  const windowStart = monthRange(startMonth.year, startMonth.month).startDate;
  const windowEnd = jakartaEndOfMonth(endMonth.year, endMonth.month);

  const [cashAccountIds, arAccountIds, allLines, aging] = await Promise.all([
    resolveCashAccountIds(workspaceId),
    prisma.account.findMany({
      where: { workspaceId, code: { in: AR_ACCOUNT_CODES } },
      select: { id: true },
    }),
    prisma.journalLine.findMany({
      where: {
        workspaceId,
        entry: {
          status: 'POSTED',
          entryDate: { gte: new Date(0), lte: windowEnd },
        },
      },
      select: {
        debit: true,
        credit: true,
        accountId: true,
        account: { select: { code: true, type: true } },
        entry: { select: { entryDate: true } },
      },
      orderBy: [{ entry: { entryDate: 'asc' } }, { lineNo: 'asc' }],
    }),
    getAgingReport(workspaceId, 'AR', windowEnd),
  ]);

  const arIds = new Set(arAccountIds.map((a) => a.id));

  // Agregasi per bulan (key "YYYY-MM" dalam zona WIB).
  type Bucket = {
    revenue: Prisma.Decimal;
    expense: Prisma.Decimal;
    cashDelta: Prisma.Decimal;
    arDelta: Prisma.Decimal;
    cashBalance: Prisma.Decimal;  // kumulatif
    arBalance: Prisma.Decimal;    // kumulatif
  };
  const buckets = new Map<string, Bucket>();
  const ensure = (key: string): Bucket => {
    let b = buckets.get(key);
    if (!b) {
      b = {
        revenue: ZERO,
        expense: ZERO,
        cashDelta: ZERO,
        arDelta: ZERO,
        cashBalance: ZERO,
        arBalance: ZERO,
      };
      buckets.set(key, b);
    }
    return b;
  };

  // Kelompokkan baris per bulan lebih dulu supaya running balance bisa
  // diproses kronologis.
  const linesByMonth = new Map<string, typeof allLines>();
  for (const line of allLines) {
    const key = monthKeyOf(line.entry.entryDate);
    let arr = linesByMonth.get(key);
    if (!arr) {
      arr = [];
      linesByMonth.set(key, arr);
    }
    arr.push(line);
  }
  const monthKeys = [...linesByMonth.keys()].sort();

  // Saldo kas & piutang carried-forward: mulai dari epoch, hitung running
  // balance per bulan. Bulan-bulan SEBELUM lookback tetap dihitung (untuk
  // opening cash), tapi hanya jendela lookback yang dikembalikan.
  let runningCash = ZERO;
  let runningAr = ZERO;

  for (const key of monthKeys) {
    const bucket = ensure(key);
    for (const line of linesByMonth.get(key)!) {
      const debit = line.debit;
      const credit = line.credit;

      switch (line.account.type) {
        case AccountType.REVENUE:
          // Pendapatan bertanda positif di sisi kredit. Akun kontra
          // (mis. Diskon & Retur 4-2000) bertipe REVENUE tapi normalnya
          // DEBIT, sehingga ia otomatis mengurangi lewat rumus yang sama.
          bucket.revenue = bucket.revenue.plus(credit).minus(debit);
          break;
        case AccountType.EXPENSE:
          bucket.expense = bucket.expense.plus(debit).minus(credit);
          break;
        default:
          break;
      }

      if (cashAccountIds.has(line.accountId)) {
        bucket.cashDelta = bucket.cashDelta.plus(debit).minus(credit);
      }
      if (arIds.has(line.accountId)) {
        bucket.arDelta = bucket.arDelta.plus(debit).minus(credit);
      }
    }

    runningCash = runningCash.plus(bucket.cashDelta);
    runningAr = runningAr.plus(bucket.arDelta);
    bucket.cashBalance = runningCash;
    bucket.arBalance = runningAr;
  }

  // DSO dari laporan umur piutang (bucket = tenor jatuh tempo).
  const agingByBucket = new Map(aging.buckets.map((b) => [b.key, b]));
  let agingTotal = 0;
  let weightedDays = 0;
  for (const [key, midpoint] of [
    ['current', 0],
    ['d1_30', 15],
    ['d31_60', 45],
    ['d61_90', 75],
    ['d90_plus', 105],
  ] as const) {
    const bucket = agingByBucket.get(key);
    const amount = bucket ? Number(bucket.amount) : 0;
    agingTotal += amount;
    weightedDays += amount * midpoint;
  }
  const currentDso = agingTotal > 0 ? weightedDays / agingTotal : 0;

  // Isi bucket untuk bulan-bulan lookback yang TIDAK punya jurnal sama
  // sekali (mis. bulan berjalan sebelum ada posting). Saldo kas & piutang
  // bulan itu harus carry-forward dari bulan sebelumnya, BUKAN nol --
  // kalau nol, proyeksi akan salah_MEMBERI kesan bangkrut.
  const lookbackKeys: string[] = [];
  for (let i = 0; i < lookbackMonths; i++) {
    const m = shiftMonth(startMonth.year, startMonth.month, i);
    lookbackKeys.push(formatPeriodKey(m.year, m.month));
  }

  let lastCash = ZERO;
  let lastAr = ZERO;
  let cursor = 0;
  for (const key of monthKeys) {
    if (key > lookbackKeys[lookbackKeys.length - 1]) break;
    const bucket = buckets.get(key)!;
    // Bulan lookback yang dilewati (tidak ada baris) terima carry-forward.
    while (cursor < lookbackKeys.length && lookbackKeys[cursor] < key) {
      const empty = ensure(lookbackKeys[cursor]);
      empty.cashBalance = lastCash;
      empty.arBalance = lastAr;
      cursor++;
    }
    lastCash = bucket.cashBalance;
    lastAr = bucket.arBalance;
  }
  while (cursor < lookbackKeys.length) {
    const empty = ensure(lookbackKeys[cursor]);
    empty.cashBalance = lastCash;
    empty.arBalance = lastAr;
    cursor++;
  }

  const baselines: MonthlyBaseline[] = [];
  for (let i = 0; i < lookbackMonths; i++) {
    const m = shiftMonth(startMonth.year, startMonth.month, i);
    const key = formatPeriodKey(m.year, m.month);
    const bucket = buckets.get(key);

    const revenue = bucket?.revenue ?? ZERO;
    const expense = bucket?.expense ?? ZERO;
    const cashBalance = bucket?.cashBalance ?? ZERO;
    const arBalance = bucket?.arBalance ?? ZERO;

    // DSO per bulan: piutang / pendapatan * 30 hari. Kalau tidak ada
    // penjualan di bulan itu, pakai DSO agregat dari laporan umur piutang
    // supaya kolomnya tidak kosong tanpa alasan.
    const monthRevenue = Number(revenue);
    const monthAr = Number(arBalance);
    const dso =
      monthRevenue > 0 && monthAr > 0
        ? (monthAr / monthRevenue) * 30
        : currentDso;

    baselines.push({
      month: key,
      monthLabel: `${MONTH_SHORT[m.month - 1]} ${String(m.year).slice(-2)}`,
      revenue: round2(revenue),
      expense: round2(expense),
      netIncome: round2(revenue.minus(expense)),
      cashBalance: round2(cashBalance),
      dso: Math.round(dso * 10) / 10,
      arBalance: round2(arBalance),
    });
  }

  return baselines;
}

/**
 * Key bulan "YYYY-MM" dalam zona waktu Jakarta (WIB) dari sebuah Date.
 * Entry date disimpan sebagai UTC; konversi ke WIB supaya transaksi
 * tanggal 1 pukul 00:00 WIB (= 1 Okt 17:00 UTC) tidak masuk ke bulan
 * sebelumnya.
 */
function monthKeyOf(date: Date): string {
  const wib = new Date(date.getTime() + 7 * 3600 * 1000);
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, '0')}`;
}

function round2(value: Prisma.Decimal): number {
  return Number(value.toDecimalPlaces(2).toString());
}

/**
 * Project scenarios forward from baseline
 */
export function projectScenarios(
  baseline: MonthlyBaseline[],
  scenarios: ScenarioParams[],
  horizonMonths: number = 6
): ScenarioProjection[] {
  if (baseline.length === 0) {
    return scenarios.map(s => ({
      id: s.id,
      label: s.label,
      months: [],
      summary: { finalCashBalance: 0, avgRunwayMonths: null, cashOutMonth: null, totalRevenue: 0, totalExpense: 0, totalNetIncome: 0 },
    }));
  }

  // Baseline untuk proyeksi: rata-rata dari bulan-bulan yang PUNYA data
  // transaksi. Kalau lookback 6 bulan tapi hanya 2 bulan berisi jurnal
  // (mis. bisnis baru mulai mencatat), membagi dengan 6 akan membuat
  // run-rate terlihat 3x lebih kecil dari kenyataan -- dan itu membuat
  // proyeksi runway terlalu konservatif.
  const activeMonths = baseline.filter((b) => b.revenue > 0 || b.expense > 0);
  const basis = activeMonths.length > 0 ? activeMonths : baseline;
  const avgRevenue = basis.reduce((s, b) => s + b.revenue, 0) / basis.length;
  const avgExpense = basis.reduce((s, b) => s + b.expense, 0) / basis.length;
  const avgDso = basis.reduce((s, b) => s + b.dso, 0) / basis.length;
  const lastBaseline = baseline[baseline.length - 1];
  const startCash = lastBaseline.cashBalance;
  const startAr = lastBaseline.arBalance;

  const results: ScenarioProjection[] = [];

  for (const scenario of scenarios) {
    const months: MonthProjection[] = [];
    let cashBalance = startCash;
    let arBalance = startAr;
    let cashOutMonth: number | null = null;
    let totalRevenue = 0;
    let totalExpense = 0;
    let totalNetIncome = 0;
    const runways: number[] = [];

    const salesMultiplier = 1 + scenario.salesDeltaPct / 100;
    const opexMultiplier = 1 + scenario.opexDeltaPct / 100;

    // DSO skenario = DSO baseline + keterlambatan tambahan. Piutang usaha
    // dianggap SEBAGAI STOCK: Ar_m ≈ Pendapatan_m * DSO / 30.
    const projectedDso = avgDso + scenario.delayDays;

    const baseYear = parseInt(lastBaseline.month.slice(0, 4));
    const baseMonth = parseInt(lastBaseline.month.slice(5, 7));

    for (let m = 1; m <= horizonMonths; m++) {
      const futureMonth = shiftMonth(baseYear, baseMonth, m);
      const monthLabel = `${MONTH_SHORT[futureMonth.month - 1]} ${String(futureMonth.year).slice(-2)}`;

      const projectedRevenue = avgRevenue * salesMultiplier;
      const projectedExpense = avgExpense * opexMultiplier;

      // Piutang converges ke target dengan laju 1/3 per bulan (satu siklus
      // penagihan). Konvergensi bertahap mencegah lompatan kas bulan-1 yang
      // terjadi kalau piutang langsung di-set ke target seketika.
      //
      // Cash from customers = Pendapatan - Kenaikan Piutang (delta AR).
      // Ini relasi arus kas standar: kalau piutang naik, uang belum masuk.
      const targetAr = (projectedRevenue * projectedDso) / 30;
      const nextAr = arBalance + (targetAr - arBalance) * AR_CONVERGENCE;
      const deltaAr = nextAr - arBalance;
      arBalance = nextAr;

      const cashInflow = projectedRevenue - deltaAr;
      const cashOutflow = projectedExpense;
      const netCashFlow = cashInflow - cashOutflow;

      cashBalance = Math.max(0, cashBalance + netCashFlow);

      const netIncome = projectedRevenue - projectedExpense;
      const runway = projectedExpense > 0 ? cashBalance / projectedExpense : null;

      if (cashBalance <= 0 && cashOutMonth === null) {
        cashOutMonth = m;
      }

      if (runway !== null) runways.push(runway);

      months.push({
        month: m,
        monthLabel,
        revenue: round2Decimal(projectedRevenue),
        expense: round2Decimal(projectedExpense),
        netIncome: round2Decimal(netIncome),
        cashInflow: round2Decimal(cashInflow),
        cashOutflow: round2Decimal(cashOutflow),
        netCashFlow: round2Decimal(netCashFlow),
        cashBalance: round2Decimal(cashBalance),
        runwayMonths: runway ? Math.round(runway * 10) / 10 : null,
        dso: Math.round(projectedDso * 10) / 10,
        arBalance: round2Decimal(arBalance),
      });

      totalRevenue += projectedRevenue;
      totalExpense += projectedExpense;
      totalNetIncome += netIncome;
    }

    const avgRunway = runways.length > 0
      ? Math.round((runways.reduce((a, b) => a + b, 0) / runways.length) * 10) / 10
      : null;

    results.push({
      id: scenario.id,
      label: scenario.label,
      months,
      summary: {
        finalCashBalance: round2Decimal(cashBalance),
        avgRunwayMonths: avgRunway,
        cashOutMonth,
        totalRevenue: round2Decimal(totalRevenue),
        totalExpense: round2Decimal(totalExpense),
        totalNetIncome: round2Decimal(totalNetIncome),
      },
    });
  }

  return results;
}

function round2Decimal(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Get default scenario configurations
 */
export function getDefaultScenarios(): ScenarioParams[] {
  return [
    { id: 'optimistic', label: 'Optimistis', salesDeltaPct: 10, opexDeltaPct: 2, delayDays: 0 },
    { id: 'normal', label: 'Normal', salesDeltaPct: 0, opexDeltaPct: 0, delayDays: 0 },
    { id: 'pessimistic', label: 'Pesimistis', salesDeltaPct: -20, opexDeltaPct: 5, delayDays: 15 },
  ];
}

/**
 * Full projection pipeline: baseline + scenarios
 */
export async function runProjection(
  workspaceId: string,
  lookbackMonths: number = 6,
  horizonMonths: number = 6,
  customScenarios?: ScenarioParams[]
): Promise<ProjectionResult> {
  const baseline = await buildMonthlyBaseline(workspaceId, lookbackMonths);
  const scenarios = customScenarios ?? getDefaultScenarios();
  const projections = projectScenarios(baseline, scenarios, horizonMonths);

  const lastBaseline = baseline[baseline.length - 1];
  const currentRunway = lastBaseline.expense > 0 ? lastBaseline.cashBalance / lastBaseline.expense : null;

  return {
    baseline,
    scenarios: projections,
    kpis: {
      currentCash: lastBaseline.cashBalance,
      currentRunway: currentRunway ? Math.round(currentRunway * 10) / 10 : null,
      currentDso: lastBaseline.dso,
      projectionHorizon: horizonMonths,
    },
  };
}
