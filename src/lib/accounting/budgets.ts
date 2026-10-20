import { AccountType, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { getIncomeStatement } from './reports';
import {
  jakartaStartOfMonth,
  monthRange,
  shiftMonth,
  type DateRange,
  type ReportRange,
} from './period';

/**
 * Anggaran (budget) tahunan per akun pendapatan/beban.
 *
 * Anggaran adalah RENCANA: tidak pernah membuat jurnal dan tidak dipakai oleh
 * laporan utama. Realisasi dihitung dari `getIncomeStatement()` — mesin yang
 * sama dengan Laba Rugi — supaya angka "vs anggaran" tidak pernah berbeda dari
 * laporan resmi.
 *
 * Tahun buku: `fiscalYear` = tahun kalender saat tahun buku dimulai. 12 slot
 * `monthly` selalu berurutan dari bulan pertama tahun buku, jadi tahun buku
 * yang mulai April tetap punya 12 slot (April..Maret).
 */

const ZERO = new Prisma.Decimal(0);
const MAX_AMOUNT = 1_000_000_000_000_000; // 1 kuadriliun, sekadar pagar input salah ketik

export interface BudgetItem {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  monthly: Prisma.Decimal[]; // 12 slot, mulai bulan pertama tahun buku
  total: Prisma.Decimal;
  note: string | null;
}

export interface BudgetAccountOption {
  id: string;
  code: string;
  name: string;
  type: AccountType;
}

export interface BudgetListResult {
  fiscalYear: number;
  fiscalStartMonth: number;
  /** Akun yang bisa dianggarkan (pendapatan & beban, postable, aktif). */
  accounts: BudgetAccountOption[];
  items: BudgetItem[];
}

/** Tahun kalender saat tahun buku dimulai, untuk sebuah bulan. */
export function fiscalStartYear(year: number, month: number, fiscalStartMonth: number): number {
  return month >= fiscalStartMonth ? year : year - 1;
}

/** Posisi bulan (0–11) di dalam tahun buku. */
export function monthIndexInFiscalYear(
  year: number,
  month: number,
  fiscalStartMonth: number
): number {
  const startYear = fiscalStartYear(year, month, fiscalStartMonth);
  return (year - startYear) * 12 + (month - fiscalStartMonth);
}

/** Rentang 12 bulan penuh untuk satu tahun buku. */
export function fiscalYearMonths(fiscalYear: number, fiscalStartMonth: number): DateRange[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = shiftMonth(fiscalYear, fiscalStartMonth, i);
    return monthRange(m.year, m.month);
  });
}

/**
 * Normalisasi input 12 angka menjadi Decimal. Melempar Error dengan pesan yang
 * bisa langsung ditampilkan kalau bentuknya salah.
 */
export function parseMonthly(raw: unknown): Prisma.Decimal[] {
  if (!Array.isArray(raw) || raw.length !== 12) {
    throw new Error('Anggaran bulanan harus berisi tepat 12 angka.');
  }
  return raw.map((value, index) => {
    const n = typeof value === 'string' && value.trim() === '' ? 0 : Number(value);
    if (!Number.isFinite(n)) {
      throw new Error(`Angka bulan ke-${index + 1} tidak valid.`);
    }
    if (n < 0) {
      throw new Error(`Angka bulan ke-${index + 1} tidak boleh negatif.`);
    }
    if (n > MAX_AMOUNT) {
      throw new Error(`Angka bulan ke-${index + 1} terlalu besar.`);
    }
    return new Prisma.Decimal(n).toDecimalPlaces(2);
  });
}

function readMonthly(raw: Prisma.JsonValue): Prisma.Decimal[] {
  if (!Array.isArray(raw)) return Array.from({ length: 12 }, () => ZERO);
  return Array.from({ length: 12 }, (_, i) => {
    const n = Number(raw[i] ?? 0);
    return new Prisma.Decimal(Number.isFinite(n) ? n : 0).toDecimalPlaces(2);
  });
}

function sumSlots(monthly: Prisma.Decimal[], upTo: number): Prisma.Decimal {
  return monthly.slice(0, Math.max(0, upTo + 1)).reduce((acc, v) => acc.plus(v), ZERO);
}

/** Daftar anggaran + akun yang bisa dianggarkan untuk satu tahun buku. */
export async function listBudgets(
  workspaceId: string,
  fiscalYear: number,
  fiscalStartMonth: number
): Promise<BudgetListResult> {
  const [accounts, budgets] = await Promise.all([
    prisma.account.findMany({
      where: {
        workspaceId,
        isPostable: true,
        isActive: true,
        type: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
      },
      select: { id: true, code: true, name: true, type: true },
      orderBy: { code: 'asc' },
    }),
    prisma.budget.findMany({
      where: { workspaceId, fiscalYear },
      include: { account: { select: { id: true, code: true, name: true, type: true, isActive: true } } },
      orderBy: { account: { code: 'asc' } },
    }),
  ]);

  const items: BudgetItem[] = budgets.map((b) => {
    const monthly = readMonthly(b.monthly);
    return {
      accountId: b.accountId,
      code: b.account.code,
      name: b.account.name,
      type: b.account.type,
      monthly,
      total: monthly.reduce((acc, v) => acc.plus(v), ZERO),
      note: b.note,
    };
  });

  return { fiscalYear, fiscalStartMonth, accounts, items };
}

export interface BudgetSaveItem {
  accountId: string;
  monthly: unknown;
  note?: string | null;
}

/**
 * Simpan (upsert) anggaran sekaligus. Baris yang seluruhnya nol dihapus supaya
 * tabel anggaran tidak penuh baris kosong.
 */
export async function saveBudgets(
  workspaceId: string,
  fiscalYear: number,
  items: BudgetSaveItem[]
): Promise<{ saved: number; deleted: number }> {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
    throw new Error('Tahun anggaran tidak valid.');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Tidak ada anggaran yang dikirim.');
  }

  const accountIds = [...new Set(items.map((i) => i.accountId))];
  const accounts = await prisma.account.findMany({
    where: { id: { in: accountIds }, workspaceId },
    select: { id: true, type: true, isPostable: true },
  });
  if (accounts.length !== accountIds.length) {
    throw new Error('Salah satu akun tidak ditemukan atau bukan milik workspace ini.');
  }
  const byId = new Map(accounts.map((a) => [a.id, a]));
  for (const item of items) {
    const account = byId.get(item.accountId)!;
    if (!account.isPostable) {
      throw new Error('Akun header tidak bisa dianggarkan; pilih akun yang bisa diposting.');
    }
    if (account.type !== AccountType.REVENUE && account.type !== AccountType.EXPENSE) {
      throw new Error('Hanya akun pendapatan dan beban yang bisa dianggarkan.');
    }
  }

  return prisma.$transaction(async (tx) => {
    let saved = 0;
    let deleted = 0;

    for (const item of items) {
      const monthly = parseMonthly(item.monthly);
      const allZero = monthly.every((v) => v.isZero());

      if (allZero) {
        const removed = await tx.budget.deleteMany({
          where: { workspaceId, fiscalYear, accountId: item.accountId },
        });
        deleted += removed.count;
        continue;
      }

      await tx.budget.upsert({
        where: {
          workspaceId_fiscalYear_accountId: {
            workspaceId,
            fiscalYear,
            accountId: item.accountId,
          },
        },
        create: {
          workspaceId,
          fiscalYear,
          accountId: item.accountId,
          monthly: monthly.map((v) => v.toNumber()),
          note: item.note?.trim() || null,
        },
        update: {
          monthly: monthly.map((v) => v.toNumber()),
          note: item.note?.trim() || null,
        },
      });
      saved += 1;
    }

    return { saved, deleted };
  });
}

/* ─────────────────────── REALISASI VS ANGGARAN ─────────────────────── */

export interface BudgetReportRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  budgetMonth: Prisma.Decimal;
  actualMonth: Prisma.Decimal;
  budgetYtd: Prisma.Decimal;
  actualYtd: Prisma.Decimal;
  varianceYtd: Prisma.Decimal; // actual - budget (bertanda)
  variancePctYtd: number | null;
  /** true bila realisasi masih di sisi yang menguntungkan. */
  favorableYtd: boolean;
}

export interface BudgetReport {
  fiscalYear: number;
  fiscalStartMonth: number;
  monthIndex: number;
  period: DateRange;
  rows: BudgetReportRow[];
  totals: {
    revenue: { budgetYtd: Prisma.Decimal; actualYtd: Prisma.Decimal };
    expense: { budgetYtd: Prisma.Decimal; actualYtd: Prisma.Decimal };
    profit: { budgetYtd: Prisma.Decimal; actualYtd: Prisma.Decimal };
  };
  warnings: string[];
}

function toMap(
  groups: Array<{ accountId: string; amount: Prisma.Decimal }[]>
): Map<string, Prisma.Decimal> {
  const map = new Map<string, Prisma.Decimal>();
  for (const group of groups) {
    for (const line of group) {
      map.set(line.accountId, (map.get(line.accountId) ?? ZERO).plus(line.amount));
    }
  }
  return map;
}

/**
 * Realisasi vs anggaran untuk periode berjalan (bulan) dan YTD tahun buku.
 * Hanya akun yang punya anggaran yang ditampilkan — akun tanpa anggaran tidak
 * bisa dibandingkan.
 */
export async function getBudgetReport(
  workspaceId: string,
  range: ReportRange,
  fiscalStartMonth: number
): Promise<BudgetReport> {
  const year = range.year;
  const month = range.month ?? 1;
  const fyStartYear = fiscalStartYear(year, month, fiscalStartMonth);
  const index = monthIndexInFiscalYear(year, month, fiscalStartMonth);

  const budgets = await prisma.budget.findMany({
    where: { workspaceId, fiscalYear: fyStartYear },
    include: { account: { select: { id: true, code: true, name: true, type: true } } },
    orderBy: { account: { code: 'asc' } },
  });

  const warnings: string[] = [];
  if (budgets.length === 0) {
    warnings.push(
      `Belum ada anggaran untuk tahun buku ${fyStartYear}. Isi di tab Anggaran supaya laporan ini bisa membandingkan.`
    );
  }

  if (budgets.length === 0) {
    return {
      fiscalYear: fyStartYear,
      fiscalStartMonth,
      monthIndex: index,
      period: range,
      rows: [],
      totals: {
        revenue: { budgetYtd: ZERO, actualYtd: ZERO },
        expense: { budgetYtd: ZERO, actualYtd: ZERO },
        profit: { budgetYtd: ZERO, actualYtd: ZERO },
      },
      warnings,
    };
  }

  const ytdStart = jakartaStartOfMonth(fyStartYear, fiscalStartMonth);
  const [monthIncome, ytdIncome] = await Promise.all([
    getIncomeStatement(workspaceId, { startDate: range.startDate, endDate: range.endDate }),
    getIncomeStatement(workspaceId, { startDate: ytdStart, endDate: range.endDate }),
  ]);

  const monthActual = toMap([
    monthIncome.revenue,
    monthIncome.cogs,
    monthIncome.operatingExpenses,
    monthIncome.taxExpenses,
  ]);
  const ytdActual = toMap([
    ytdIncome.revenue,
    ytdIncome.cogs,
    ytdIncome.operatingExpenses,
    ytdIncome.taxExpenses,
  ]);

  const rows: BudgetReportRow[] = budgets.map((b) => {
    const monthly = readMonthly(b.monthly);
    const budgetMonth = monthly[index] ?? ZERO;
    const budgetYtd = sumSlots(monthly, index);
    const actualMonth = monthActual.get(b.accountId) ?? ZERO;
    const actualYtd = ytdActual.get(b.accountId) ?? ZERO;
    const varianceYtd = actualYtd.minus(budgetYtd);
    const variancePctYtd = budgetYtd.isZero()
      ? null
      : varianceYtd.dividedBy(budgetYtd).times(100).toDecimalPlaces(1).toNumber();
    const favorableYtd = b.account.type === AccountType.REVENUE ? varianceYtd.gte(0) : varianceYtd.lte(0);

    return {
      accountId: b.accountId,
      code: b.account.code,
      name: b.account.name,
      type: b.account.type,
      budgetMonth,
      actualMonth,
      budgetYtd,
      actualYtd,
      varianceYtd,
      variancePctYtd,
      favorableYtd,
    };
  });

  const sumBy = (type: AccountType, field: 'budgetYtd' | 'actualYtd') =>
    rows.filter((r) => r.type === type).reduce((acc, r) => acc.plus(r[field]), ZERO);

  const revenueBudget = sumBy(AccountType.REVENUE, 'budgetYtd');
  const revenueActual = sumBy(AccountType.REVENUE, 'actualYtd');
  const expenseBudget = sumBy(AccountType.EXPENSE, 'budgetYtd');
  const expenseActual = sumBy(AccountType.EXPENSE, 'actualYtd');

  return {
    fiscalYear: fyStartYear,
    fiscalStartMonth,
    monthIndex: index,
    period: range,
    rows,
    totals: {
      revenue: { budgetYtd: revenueBudget, actualYtd: revenueActual },
      expense: { budgetYtd: expenseBudget, actualYtd: expenseActual },
      profit: {
        budgetYtd: revenueBudget.minus(expenseBudget),
        actualYtd: revenueActual.minus(expenseActual),
      },
    },
    warnings,
  };
}
