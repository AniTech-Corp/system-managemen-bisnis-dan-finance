import {
  AccountType,
  JournalSource,
  JournalStatus,
  Prisma,
  StockMovementType,
} from '@prisma/client';
import { prisma } from '../prisma';
import { statementAmount } from './reports';
import {
  DIVISIONS,
  NO_DIVISION,
  divisionLabel,
} from './budget-divisions';
import {
  comparativeRange,
  getJakartaParts,
  jakartaStartOfMonth,
  monthRange,
  shiftMonth,
  type DateRange,
  type ReportRange,
} from './period';

/**
 * Mesin laporan Profitabilitas per Divisi, Proyek, dan Produk.
 *
 * PRINSIP: semua angka divisi & proyek berasal dari `journal_lines` POSTED yang
 * sama dengan Laba Rugi. Karena itu:
 *
 *   total semua divisi + "Tanpa Divisi" = Laba Rugi tanpa filter
 *
 * Laporan TIDAK mengalokasikan overhead bersama. Laba proyek adalah laba
 * LANGSUNG dari baris yang memang ditandai ke proyek tersebut. Biaya bersama
 * tetap muncul di kelompok "Tanpa Divisi/Proyek" dan ditampilkan sebagai
 * peringatan, bukan ditebak.
 */

const ZERO = new Prisma.Decimal(0);
export const NO_PROJECT = 'TANPA_PROYEK';
export const UNTAGGED_DIVISION_LABEL = 'Tanpa Divisi';
export const UNTAGGED_PROJECT_LABEL = 'Tanpa Proyek';

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

/* ─────────────────────────── tipe data ─────────────────────────── */

export interface ProfitLineRow {
  costCenter: string | null;
  projectId: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  account: {
    code: string;
    type: AccountType;
  };
  entry: {
    entryDate: Date;
  };
}

export interface ProfitabilityTotals {
  revenue: Prisma.Decimal;
  cogs: Prisma.Decimal;
  operatingExpenses: Prisma.Decimal;
  taxExpenses: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  profit: Prisma.Decimal;
  marginPct: number | null;
}

export interface ProfitabilityRow extends ProfitabilityTotals {
  key: string;
  label: string;
  revenueSharePct: number | null;
  costSharePct: number | null;
  profitSharePct: number | null;
  costRank: number | null;
  profitRank: number | null;
  isHighestCost: boolean;
  isMostProfitable: boolean;
}

export interface ProjectProfitabilityRow extends ProfitabilityRow {
  code: string | null;
  clientName: string | null;
  division: string | null;
  divisionLabel: string;
  status: string | null;
  startDate: Date | null;
  endDate: Date | null;
}

export interface ProductProfitabilityRow {
  productId: string;
  sku: string | null;
  name: string;
  unit: string;
  pricedQty: number;
  unpricedQty: number;
  revenue: number;
  cogs: number;
  grossProfit: number;
  marginPct: number | null;
  revenueSharePct: number | null;
}

export interface ProductProfitability {
  items: ProductProfitabilityRow[];
  totals: {
    pricedQty: number;
    unpricedQty: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    marginPct: number | null;
  };
  warnings: string[];
}

export interface ProfitabilitySnapshot {
  period: DateRange;
  totals: ProfitabilityTotals;
  divisions: ProfitabilityRow[];
  projects: ProjectProfitabilityRow[];
  warnings: string[];
}

export interface ProfitabilityTrendPoint extends ProfitabilityTotals {
  period: string;
  label: string;
}

export interface ProfitabilityTrendDivision {
  key: string;
  label: string;
  months: ProfitabilityTrendPoint[];
}

export interface ProfitabilityTrend {
  months: ProfitabilityTrendPoint[];
  divisions: ProfitabilityTrendDivision[];
}

export interface ProfitabilityReport {
  period: ReportRange;
  comparativeMode: 'none' | 'prev_month' | 'prev_year' | 'ytd';
  comparisonPeriod: DateRange | null;
  trendMonths: number;
  current: ProfitabilitySnapshot;
  comparison: ProfitabilitySnapshot | null;
  trend: ProfitabilityTrend;
  products: ProductProfitability;
}

export interface ProjectMeta {
  id: string;
  code: string | null;
  name: string;
  clientName: string | null;
  division: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
}

/* ─────────────────────────── agregasi murni ─────────────────────────── */

interface MutableBucket {
  revenue: Prisma.Decimal;
  cogs: Prisma.Decimal;
  operatingExpenses: Prisma.Decimal;
  taxExpenses: Prisma.Decimal;
  totalCost: Prisma.Decimal;
}

function emptyBucket(): MutableBucket {
  return {
    revenue: ZERO,
    cogs: ZERO,
    operatingExpenses: ZERO,
    taxExpenses: ZERO,
    totalCost: ZERO,
  };
}

function add(bucket: MutableBucket, field: keyof MutableBucket, amount: Prisma.Decimal): void {
  bucket[field] = bucket[field].plus(amount);
}

function isCogs(code: string): boolean {
  return code.startsWith('5-');
}

function isTaxExpense(code: string): boolean {
  return code.startsWith('7-');
}

/**
 * Tambahkan satu baris jurnal ke bucket. Ekspor fungsi ini supaya test bisa
 * memverifikasi rekonsiliasi tanpa database.
 */
export function addProfitLine(bucket: MutableBucket, line: ProfitLineRow): void {
  if (line.account.type === AccountType.REVENUE) {
    add(bucket, 'revenue', statementAmount(line, AccountType.REVENUE));
    return;
  }
  if (line.account.type !== AccountType.EXPENSE) return;

  const amount = statementAmount(line, AccountType.EXPENSE);
  add(bucket, 'totalCost', amount);
  if (isCogs(line.account.code)) add(bucket, 'cogs', amount);
  else if (isTaxExpense(line.account.code)) add(bucket, 'taxExpenses', amount);
  else add(bucket, 'operatingExpenses', amount);
}

export function summarizeLines(lines: ProfitLineRow[]): ProfitabilityTotals {
  const bucket = emptyBucket();
  for (const line of lines) addProfitLine(bucket, line);
  return finalizeTotals(bucket);
}

function finalizeTotals(bucket: MutableBucket): ProfitabilityTotals {
  const profit = bucket.revenue.minus(bucket.totalCost);
  return {
    revenue: bucket.revenue,
    cogs: bucket.cogs,
    operatingExpenses: bucket.operatingExpenses,
    taxExpenses: bucket.taxExpenses,
    totalCost: bucket.totalCost,
    profit,
    marginPct: percent(profit, bucket.revenue),
  };
}

function percent(numerator: Prisma.Decimal, denominator: Prisma.Decimal): number | null {
  if (denominator.isZero()) return null;
  return round2(numerator.div(denominator).times(100).toNumber());
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function share(value: Prisma.Decimal, total: Prisma.Decimal): number | null {
  if (total.lte(0)) return null;
  return percent(value, total);
}

function applySharesAndRanks<T extends ProfitabilityRow>(
  rows: T[],
  totals: ProfitabilityTotals,
  options: { untaggedKey: string }
): T[] {
  const withShares = rows.map((row) => ({
    ...row,
    revenueSharePct: share(row.revenue, totals.revenue),
    costSharePct: share(row.totalCost, totals.totalCost),
    profitSharePct: share(row.profit, totals.profit),
  }));

  const businessUnits = withShares.filter(
    (row) =>
      row.key !== options.untaggedKey &&
      !row.key.startsWith('TANPA_') &&
      (!row.revenue.isZero() || !row.totalCost.isZero())
  );

  const byCost = [...businessUnits].sort((a, b) => b.totalCost.comparedTo(a.totalCost));
  const byProfit = [...businessUnits].sort((a, b) => b.profit.comparedTo(a.profit));
  const costRanks = new Map(byCost.map((row, index) => [row.key, index + 1]));
  const profitRanks = new Map(byProfit.map((row, index) => [row.key, index + 1]));

  return withShares.map((row) => {
    const costRank = costRanks.get(row.key) ?? null;
    const profitRank = profitRanks.get(row.key) ?? null;
    return {
      ...row,
      costRank,
      profitRank,
      isHighestCost: costRank === 1 && row.totalCost.gt(0),
      isMostProfitable: profitRank === 1 && row.profit.gt(0),
    };
  });
}

export function groupByDivision(lines: ProfitLineRow[]): ProfitabilityRow[] {
  const buckets = new Map<string, MutableBucket>();
  for (const key of DIVISIONS) buckets.set(key, emptyBucket());

  for (const line of lines) {
    const key = line.costCenter?.trim() || NO_DIVISION;
    if (!buckets.has(key)) buckets.set(key, emptyBucket());
    addProfitLine(buckets.get(key)!, line);
  }

  const totals = summarizeLines(lines);
  const rows: ProfitabilityRow[] = Array.from(buckets.entries()).map(([key, bucket]) => ({
    key,
    label: key === NO_DIVISION ? UNTAGGED_DIVISION_LABEL : divisionLabel(key),
    ...finalizeTotals(bucket),
    revenueSharePct: null,
    costSharePct: null,
    profitSharePct: null,
    costRank: null,
    profitRank: null,
    isHighestCost: false,
    isMostProfitable: false,
  }));

  const ranked = applySharesAndRanks(rows, totals, { untaggedKey: NO_DIVISION });
  return ranked.sort((a, b) => b.profit.comparedTo(a.profit));
}

export function groupByProject(
  lines: ProfitLineRow[],
  projects: Map<string, ProjectMeta>
): ProjectProfitabilityRow[] {
  const buckets = new Map<string, MutableBucket>();
  for (const line of lines) {
    const key = line.projectId?.trim() || NO_PROJECT;
    if (!buckets.has(key)) buckets.set(key, emptyBucket());
    addProfitLine(buckets.get(key)!, line);
  }

  const totals = summarizeLines(lines);
  const rows: ProjectProfitabilityRow[] = Array.from(buckets.entries()).map(([key, bucket]) => {
    const meta = projects.get(key);
    return {
      key,
      label: meta?.name || (key === NO_PROJECT ? UNTAGGED_PROJECT_LABEL : 'Proyek tidak ditemukan'),
      code: meta?.code ?? null,
      clientName: meta?.clientName ?? null,
      division: meta?.division ?? null,
      divisionLabel: meta?.division ? divisionLabel(meta.division) : UNTAGGED_DIVISION_LABEL,
      status: meta?.status ?? null,
      startDate: meta?.startDate ?? null,
      endDate: meta?.endDate ?? null,
      ...finalizeTotals(bucket),
      revenueSharePct: null,
      costSharePct: null,
      profitSharePct: null,
      costRank: null,
      profitRank: null,
      isHighestCost: false,
      isMostProfitable: false,
    };
  });

  const ranked = applySharesAndRanks(rows, totals, { untaggedKey: NO_PROJECT });
  return ranked.sort((a, b) => {
    if (a.key === NO_PROJECT) return 1;
    if (b.key === NO_PROJECT) return -1;
    return b.profit.comparedTo(a.profit);
  });
}

/* ─────────────────────────── pengambilan data ─────────────────────────── */

const PROFIT_LINE_SELECT = {
  costCenter: true,
  projectId: true,
  debit: true,
  credit: true,
  account: { select: { code: true, type: true } },
  entry: { select: { entryDate: true } },
} satisfies Prisma.JournalLineSelect;

export async function fetchProfitLines(
  workspaceId: string,
  range: DateRange
): Promise<ProfitLineRow[]> {
  return prisma.journalLine.findMany({
    where: {
      workspaceId,
      account: { type: { in: [AccountType.REVENUE, AccountType.EXPENSE] } },
      entry: {
        status: JournalStatus.POSTED,
        entryDate: { gte: range.startDate, lte: range.endDate },
        source: { notIn: [JournalSource.OPENING, JournalSource.CLOSING] },
      },
    },
    select: PROFIT_LINE_SELECT,
    orderBy: [{ entry: { entryDate: 'asc' } }, { lineNo: 'asc' }],
  }) as Promise<ProfitLineRow[]>;
}

export async function loadProjectMap(workspaceId: string): Promise<Map<string, ProjectMeta>> {
  const rows = await prisma.project.findMany({
    where: { workspaceId },
    select: {
      id: true,
      code: true,
      name: true,
      clientName: true,
      division: true,
      status: true,
      startDate: true,
      endDate: true,
    },
  });
  return new Map(rows.map((row) => [row.id, row]));
}

export function buildSnapshot(
  period: DateRange,
  lines: ProfitLineRow[],
  projects: Map<string, ProjectMeta>
): ProfitabilitySnapshot {
  const totals = summarizeLines(lines);
  const divisions = groupByDivision(lines);
  const projectRows = groupByProject(lines, projects);

  const untaggedDivision = divisions.find((row) => row.key === NO_DIVISION);
  const untaggedProject = projectRows.find((row) => row.key === NO_PROJECT);
  const warnings: string[] = [];

  if (lines.length === 0) {
    warnings.push('Belum ada jurnal pendapatan/beban yang diposting pada periode ini.');
  }
  if (untaggedDivision && (untaggedDivision.revenue.gt(0) || untaggedDivision.totalCost.gt(0))) {
    warnings.push(
      'Sebagian pendapatan/biaya belum ditandai divisi. Angka itu masuk kelompok "Tanpa Divisi" dan tidak dialokasikan ke unit bisnis mana pun.'
    );
  }
  if (untaggedProject && (untaggedProject.revenue.gt(0) || untaggedProject.totalCost.gt(0))) {
    warnings.push(
      'Sebagian pendapatan/biaya belum ditandai proyek. Laba proyek di bawah hanya memuat biaya langsung yang sudah ditandai.'
    );
  }

  return { period, totals, divisions, projects: projectRows, warnings };
}

/* ─────────────────────────── produk ─────────────────────────── */

interface ProductAccumulator {
  productId: string;
  sku: string | null;
  name: string;
  unit: string;
  pricedQty: number;
  unpricedQty: number;
  revenue: number;
  cogs: number;
}

export async function getProductProfitability(
  workspaceId: string,
  range: DateRange
): Promise<ProductProfitability> {
  const rows = await prisma.stockMovement.findMany({
    where: {
      workspaceId,
      type: StockMovementType.SALE_OUT,
      OR: [
        { occurredAt: { gte: range.startDate, lte: range.endDate } },
        { occurredAt: null, createdAt: { gte: range.startDate, lte: range.endDate } },
      ],
    },
    select: {
      productId: true,
      qtyChange: true,
      unitCost: true,
      unitPrice: true,
      product: { select: { sku: true, name: true, unit: true } },
    },
  });

  const map = new Map<string, ProductAccumulator>();
  for (const row of rows) {
    const qty = Math.abs(Number(row.qtyChange ?? 0));
    if (qty === 0) continue;

    const existing =
      map.get(row.productId) ??
      ({
        productId: row.productId,
        sku: row.product.sku ?? null,
        name: row.product.name,
        unit: row.product.unit,
        pricedQty: 0,
        unpricedQty: 0,
        revenue: 0,
        cogs: 0,
      } satisfies ProductAccumulator);

    if (row.unitPrice === null || row.unitPrice === undefined) {
      existing.unpricedQty += qty;
    } else {
      existing.pricedQty += qty;
      existing.revenue += qty * Number(row.unitPrice);
      existing.cogs += qty * Number(row.unitCost ?? 0);
    }
    map.set(row.productId, existing);
  }

  const items: ProductProfitabilityRow[] = Array.from(map.values()).map((item) => {
    const revenue = round2(item.revenue);
    const cogs = round2(item.cogs);
    const grossProfit = round2(revenue - cogs);
    return {
      productId: item.productId,
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      pricedQty: round2(item.pricedQty),
      unpricedQty: round2(item.unpricedQty),
      revenue,
      cogs,
      grossProfit,
      marginPct: revenue > 0 ? round2((grossProfit / revenue) * 100) : null,
      revenueSharePct: null,
    };
  });

  const totalRevenue = round2(items.reduce((acc, item) => acc + item.revenue, 0));
  const totalCogs = round2(items.reduce((acc, item) => acc + item.cogs, 0));
  const totalProfit = round2(totalRevenue - totalCogs);
  const enriched = items
    .map((item) => ({
      ...item,
      revenueSharePct: totalRevenue > 0 ? round2((item.revenue / totalRevenue) * 100) : null,
    }))
    .sort((a, b) => b.grossProfit - a.grossProfit);

  const unpricedQty = round2(items.reduce((acc, item) => acc + item.unpricedQty, 0));
  const warnings: string[] = [];
  if (items.length === 0) {
    warnings.push('Belum ada penjualan stok pada periode ini.');
  } else if (unpricedQty > 0) {
    warnings.push(
      `${unpricedQty} unit terjual belum menyimpan harga jual (penjualan lama). Unit itu tidak dihitung sebagai pendapatan agar laba tidak menyesatkan.`
    );
  }

  return {
    items: enriched,
    totals: {
      pricedQty: round2(items.reduce((acc, item) => acc + item.pricedQty, 0)),
      unpricedQty,
      revenue: totalRevenue,
      cogs: totalCogs,
      grossProfit: totalProfit,
      marginPct: totalRevenue > 0 ? round2((totalProfit / totalRevenue) * 100) : null,
    },
    warnings,
  };
}

/* ─────────────────────────── tren ─────────────────────────── */

export function buildTrend(
  lines: ProfitLineRow[],
  endYear: number,
  endMonth: number,
  months: number
): ProfitabilityTrend {
  const periods: Array<{ period: string; label: string; year: number; month: number }> = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const shifted = shiftMonth(endYear, endMonth, -i);
    periods.push({
      period: `${shifted.year}-${String(shifted.month).padStart(2, '0')}`,
      label: `${MONTH_SHORT[shifted.month - 1]} ${String(shifted.year).slice(2)}`,
      year: shifted.year,
      month: shifted.month,
    });
  }

  const indexByPeriod = new Map(periods.map((item, index) => [item.period, index]));
  const totalBuckets = periods.map(() => emptyBucket());
  const divisionBuckets = new Map<string, MutableBucket[]>();
  for (const key of [...DIVISIONS, NO_DIVISION]) {
    divisionBuckets.set(key, periods.map(() => emptyBucket()));
  }

  for (const line of lines) {
    const parts = getJakartaParts(line.entry.entryDate);
    const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    const index = indexByPeriod.get(key);
    if (index === undefined) continue;

    addProfitLine(totalBuckets[index], line);

    const division = line.costCenter?.trim() || NO_DIVISION;
    const buckets = divisionBuckets.get(division);
    if (buckets) addProfitLine(buckets[index], line);
  }

  const monthRows: ProfitabilityTrendPoint[] = periods.map((item, index) => ({
    period: item.period,
    label: item.label,
    ...finalizeTotals(totalBuckets[index]),
  }));

  const divisions: ProfitabilityTrendDivision[] = Array.from(divisionBuckets.entries())
    .map(([key, buckets]) => ({
      key,
      label: key === NO_DIVISION ? UNTAGGED_DIVISION_LABEL : divisionLabel(key),
      months: periods.map((item, index) => ({
        period: item.period,
        label: item.label,
        ...finalizeTotals(buckets[index]),
      })),
    }))
    .filter((division) =>
      division.months.some(
        (month) => !month.revenue.isZero() || !month.totalCost.isZero()
      )
    );

  return { months: monthRows, divisions };
}

/* ─────────────────────────── orkestrasi ─────────────────────────── */

export interface ProfitabilityOptions {
  comparativeMode?: 'none' | 'prev_month' | 'prev_year' | 'ytd';
  fiscalStartMonth?: number;
  trendMonths?: number;
}

function trendRangeFor(range: ReportRange, months: number): { range: DateRange; endYear: number; endMonth: number } {
  const parts = getJakartaParts(range.endDate);
  const start = shiftMonth(parts.year, parts.month, -(months - 1));
  const startRange = monthRange(start.year, start.month);
  return {
    range: { startDate: startRange.startDate, endDate: range.endDate },
    endYear: parts.year,
    endMonth: parts.month,
  };
}

export async function getProfitabilityReport(
  workspaceId: string,
  range: ReportRange,
  options: ProfitabilityOptions = {}
): Promise<ProfitabilityReport> {
  const comparativeMode = options.comparativeMode ?? 'none';
  const fiscalStartMonth = options.fiscalStartMonth ?? 1;
  const trendMonths = Math.min(Math.max(Math.trunc(options.trendMonths ?? 12), 3), 24);
  const compRange = comparativeRange(comparativeMode, range, fiscalStartMonth);
  const trendWindow = trendRangeFor(range, trendMonths);

  const [currentLines, comparisonLines, trendLines, projects, products] = await Promise.all([
    fetchProfitLines(workspaceId, range),
    compRange ? fetchProfitLines(workspaceId, compRange) : Promise.resolve(null),
    fetchProfitLines(workspaceId, trendWindow.range),
    loadProjectMap(workspaceId),
    getProductProfitability(workspaceId, range),
  ]);

  const current = buildSnapshot(range, currentLines, projects);
  const comparison = compRange && comparisonLines
    ? buildSnapshot(compRange, comparisonLines, projects)
    : null;

  return {
    period: range,
    comparativeMode,
    comparisonPeriod: compRange,
    trendMonths,
    current,
    comparison,
    trend: buildTrend(trendLines, trendWindow.endYear, trendWindow.endMonth, trendMonths),
    products,
  };
}

/**
 * Nilai awal bulan untuk tren, dipakai test dan pemanggil yang butuh rentang
 * yang sama tanpa menghitung ulang.
 */
export function trendStartRange(endYear: number, endMonth: number, months: number): DateRange {
  const start = shiftMonth(endYear, endMonth, -(months - 1));
  return {
    startDate: jakartaStartOfMonth(start.year, start.month),
    endDate: monthRange(endYear, endMonth).endDate,
  };
}
