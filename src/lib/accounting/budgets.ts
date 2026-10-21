import { AccountType, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { getIncomeStatement, type JournalLineFilter } from './reports';
import {
  BUDGET_DIVISIONS,
  COMPANY_DIVISION,
  divisionLabel,
  normalizeBudgetDivision,
} from './budget-divisions';
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

/**
 * Penyaringan jurnal untuk realisasi sebuah nilai `Budget.division`.
 *
 * `PERUSAHAAN` sengaja TIDAK disaring: ia berarti anggaran umum seluruh
 * perusahaan, jadi realisasinya adalah SELURUH pengeluaran. Ini yang membuat
 * laporan anggaran lama (yang seluruh barisnya berlabel PERUSAHAAN) tetap
 * tampil persis seperti sebelum ada dimensi divisi.
 *
 * Divisi nyata menyaring `costCenter`, sehingga realisasi hanya memuat baris
 * jurnal milik divisi itu.
 */
export function budgetDivisionFilter(division: string): JournalLineFilter | undefined {
  return division === COMPANY_DIVISION ? undefined : { costCenter: division };
}

export interface BudgetItem {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  /** Pemilik anggaran. `PERUSAHAAN` untuk anggaran umum / baris lama. */
  division: string;
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
  /** Divisi yang bisa dipilih saat mengisi anggaran, label sudah siap tampil. */
  divisions: Array<{ value: string; label: string }>;
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

/**
 * Jumlah slot bulanan sebuah anggaran hingga posisi `upTo` dalam tahun buku
 * (YTD). Dipakai mesin peringatan supaya cara menjumlahkan anggaran tetap satu
 * di seluruh codebase.
 */
export function sumMonthlySlots(raw: Prisma.JsonValue, upTo: number): Prisma.Decimal {
  return sumSlots(readMonthly(raw), upTo);
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
      division: b.division || COMPANY_DIVISION,
      monthly,
      total: monthly.reduce((acc, v) => acc.plus(v), ZERO),
      note: b.note,
    };
  });

  return {
    fiscalYear,
    fiscalStartMonth,
    divisions: BUDGET_DIVISIONS.map((value) => ({ value, label: divisionLabel(value) })),
    accounts,
    items,
  };
}

export interface BudgetSaveItem {
  accountId: string;
  /** Pemilik anggaran. Kosong dianggap `PERUSAHAAN` (kompatibilitas input lama). */
  division?: string | null;
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

    // Satu payload boleh memuat beberapa akun, tapi tidak boleh memuat baris
    // (akun, divisi) yang sama dua kali -- hasilnya ambigu karena upsert akan
    // menimpa salah satunya tanpa error.
    const seen = new Set<string>();

    for (const item of items) {
      const division = normalizeBudgetDivision(item.division);
      const key = `${item.accountId}::${division}`;
      if (seen.has(key)) {
        throw new Error(
          `Baris anggaran ganda: ${item.accountId} untuk divisi ${division}. Gabungkan jadi satu baris.`
        );
      }
      seen.add(key);

      const monthly = parseMonthly(item.monthly);
      const allZero = monthly.every((v) => v.isZero());

      if (allZero) {
        const removed = await tx.budget.deleteMany({
          where: { workspaceId, fiscalYear, accountId: item.accountId, division },
        });
        deleted += removed.count;
        continue;
      }

      await tx.budget.upsert({
        where: {
          workspaceId_fiscalYear_accountId_division: {
            workspaceId,
            fiscalYear,
            accountId: item.accountId,
            division,
          },
        },
        create: {
          workspaceId,
          fiscalYear,
          accountId: item.accountId,
          division,
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
  /** Pemilik baris ini. `PERUSAHAAN` = anggaran umum, realisasinya seluruh pengeluaran. */
  division: string;
  budgetMonth: Prisma.Decimal;
  actualMonth: Prisma.Decimal;
  budgetYtd: Prisma.Decimal;
  actualYtd: Prisma.Decimal;
  varianceYtd: Prisma.Decimal; // actual - budget (bertanda)
  variancePctYtd: number | null;
  /** true bila realisasi masih di sisi yang menguntungkan. */
  favorableYtd: boolean;
  /** Persentase anggaran YTD yang sudah terpakai, untuk progress bar. */
  usedPctYtd: number | null;
}

/** Rekap satu divisi: total anggaran vs realisasi YTD semua barisnya. */
export interface BudgetDivisionSummary {
  division: string;
  budgetYtd: Prisma.Decimal;
  actualYtd: Prisma.Decimal;
  /** `budgetYtd - actualYtd`; negatif berarti melebihi anggaran. */
  remainingYtd: Prisma.Decimal;
  usedPctYtd: number | null;
}

export interface BudgetReport {
  fiscalYear: number;
  fiscalStartMonth: number;
  monthIndex: number;
  period: DateRange;
  /** null bila laporan mencakup semua divisi. */
  division: string | null;
  rows: BudgetReportRow[];
  /** Rekap per divisi, selalu dihitung walau laporan menyaring satu divisi. */
  divisions: BudgetDivisionSummary[];
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
 *
 * `division` menyaring laporan ke satu divisi; biarkan kosong untuk semua.
 * Realisasi tiap divisi dihitung lewat `getIncomeStatement` yang sama, hanya
 * dengan penyaringan `costCenter` berbeda, sehingga angka per divisi tidak
 * mungkin menyimpang dari Laba Rugi.
 */
export async function getBudgetReport(
  workspaceId: string,
  range: ReportRange,
  fiscalStartMonth: number,
  divisionFilter?: string | null
): Promise<BudgetReport> {
  const year = range.year;
  const month = range.month ?? 1;
  const fyStartYear = fiscalStartYear(year, month, fiscalStartMonth);
  const index = monthIndexInFiscalYear(year, month, fiscalStartMonth);
  const requestedDivision = divisionFilter ? normalizeBudgetDivision(divisionFilter) : null;

  // SEMUA anggaran tahun buku diambil, bukan hanya yang akan ditampilkan:
  // rekap per divisi harus tetap lengkap walau laporan sedang disaring ke satu
  // divisi. Tanpa ini, pemilih divisi di UI menyusut jadi satu pilihan dan user
  // tidak bisa berpindah kembali.
  const allBudgets = await prisma.budget.findMany({
    where: { workspaceId, fiscalYear: fyStartYear },
    include: { account: { select: { id: true, code: true, name: true, type: true } } },
    orderBy: [{ division: 'asc' }, { account: { code: 'asc' } }],
  });

  const budgets = requestedDivision
    ? allBudgets.filter((b) => (b.division || COMPANY_DIVISION) === requestedDivision)
    : allBudgets;

  const warnings: string[] = [];
  if (allBudgets.length === 0) {
    warnings.push(
      `Belum ada anggaran untuk tahun buku ${fyStartYear}. Isi di tab Anggaran supaya laporan ini bisa membandingkan.`
    );
  } else if (budgets.length === 0 && requestedDivision) {
    warnings.push(
      `Belum ada anggaran untuk divisi ${divisionLabel(requestedDivision)} pada tahun buku ${fyStartYear}. Isi di tab Anggaran supaya laporan ini bisa membandingkan.`
    );
  }

  if (allBudgets.length === 0) {
    return {
      fiscalYear: fyStartYear,
      fiscalStartMonth,
      monthIndex: index,
      period: range,
      division: requestedDivision,
      rows: [],
      divisions: [],
      totals: {
        revenue: { budgetYtd: ZERO, actualYtd: ZERO },
        expense: { budgetYtd: ZERO, actualYtd: ZERO },
        profit: { budgetYtd: ZERO, actualYtd: ZERO },
      },
      warnings,
    };
  }

  // Satu panggilan `getIncomeStatement` per divisi yang benar-benar punya
  // anggaran. Ini lebih mahal daripada satu query, tapi sengaja: cara ini
  // memakai mesin laba rugi yang PERSIS sama, sehingga angka per divisi tidak
  // mungkin berbeda dari laporan resmi.
  const divisions = [...new Set(allBudgets.map((b) => b.division || COMPANY_DIVISION))];
  const ytdStart = jakartaStartOfMonth(fyStartYear, fiscalStartMonth);

  const actuals = new Map<string, Map<string, { month: Prisma.Decimal; ytd: Prisma.Decimal }>>();
  await Promise.all(
    divisions.map(async (div) => {
      const filter = budgetDivisionFilter(div);
      const [monthIncome, ytdIncome] = await Promise.all([
        getIncomeStatement(workspaceId, { startDate: range.startDate, endDate: range.endDate }, filter),
        getIncomeStatement(workspaceId, { startDate: ytdStart, endDate: range.endDate }, filter),
      ]);
      const monthMap = toMap([
        monthIncome.revenue,
        monthIncome.cogs,
        monthIncome.operatingExpenses,
        monthIncome.taxExpenses,
      ]);
      const ytdMap = toMap([
        ytdIncome.revenue,
        ytdIncome.cogs,
        ytdIncome.operatingExpenses,
        ytdIncome.taxExpenses,
      ]);

      const merged = new Map<string, { month: Prisma.Decimal; ytd: Prisma.Decimal }>();
      for (const [accountId, amount] of ytdMap) {
        merged.set(accountId, { month: monthMap.get(accountId) ?? ZERO, ytd: amount });
      }
      // Baris yang bulan ini bergerak tapi YTD-nya netral (jarang, tapi mungkin
      // saat ada koreksi) tetap harus tampil.
      for (const [accountId, amount] of monthMap) {
        if (!merged.has(accountId)) merged.set(accountId, { month: amount, ytd: ZERO });
      }
      actuals.set(div, merged);
    })
  );

  const rows: BudgetReportRow[] = budgets.map((b) => {
    const div = b.division || COMPANY_DIVISION;
    const monthly = readMonthly(b.monthly);
    const budgetMonth = monthly[index] ?? ZERO;
    const budgetYtd = sumSlots(monthly, index);
    const found = actuals.get(div)?.get(b.accountId);
    const actualMonth = found?.month ?? ZERO;
    const actualYtd = found?.ytd ?? ZERO;
    const varianceYtd = actualYtd.minus(budgetYtd);
    const variancePctYtd = budgetYtd.isZero()
      ? null
      : varianceYtd.dividedBy(budgetYtd).times(100).toDecimalPlaces(1).toNumber();
    const favorableYtd = b.account.type === AccountType.REVENUE ? varianceYtd.gte(0) : varianceYtd.lte(0);
    const usedPctYtd = budgetYtd.isZero()
      ? null
      : actualYtd.dividedBy(budgetYtd).times(100).toDecimalPlaces(1).toNumber();

    return {
      accountId: b.accountId,
      code: b.account.code,
      name: b.account.name,
      type: b.account.type,
      division: div,
      budgetMonth,
      actualMonth,
      budgetYtd,
      actualYtd,
      varianceYtd,
      variancePctYtd,
      favorableYtd,
      usedPctYtd,
    };
  });

  // Rekap per divisi. Selalu dihitung, bahkan saat laporan menyaring satu
  // divisi, supaya UI bisa menampilkan ringkasan tanpa permintaan tambahan.
  const byDivision = new Map<string, BudgetDivisionSummary>();
  // Dihitung dari SEMUA anggaran, bukan dari `rows`: saat laporan disaring ke
  // satu divisi, rekap divisi lain tetap harus tersedia agar UI bisa menampilkan
  // pemilih divisi dan kartu sisa anggaran secara lengkap.
  for (const budget of allBudgets) {
    const division = budget.division || COMPANY_DIVISION;
    const budgetYtd = sumSlots(readMonthly(budget.monthly), index);
    const actualYtd = actuals.get(division)?.get(budget.accountId)?.ytd ?? ZERO;

    let summary = byDivision.get(division);
    if (!summary) {
      summary = {
        division,
        budgetYtd: ZERO,
        actualYtd: ZERO,
        remainingYtd: ZERO,
        usedPctYtd: null,
      };
      byDivision.set(division, summary);
    }
    summary.budgetYtd = summary.budgetYtd.plus(budgetYtd);
    summary.actualYtd = summary.actualYtd.plus(actualYtd);
  }
  for (const summary of byDivision.values()) {
    summary.remainingYtd = summary.budgetYtd.minus(summary.actualYtd);
    summary.usedPctYtd = summary.budgetYtd.isZero()
      ? null
      : summary.actualYtd.dividedBy(summary.budgetYtd).times(100).toDecimalPlaces(1).toNumber();
  }

  // Anggaran "Perusahaan" menangkap SELURUH pengeluaran, termasuk yang sudah
  // tercatat di divisi tertentu. Bercampur dengan anggaran per divisi berarti
  // angkanya saling menimpa -- peringatkan, jangan diamkan.
  if (!requestedDivision && divisions.length > 1) {
    warnings.push(
      'Anggaran "Perusahaan" bercampur dengan anggaran per divisi. Realisasi Perusahaan mencakup seluruh pengeluaran sehingga menimpa angka per divisi — jangan dijumlahkan.'
    );
  }

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
    division: requestedDivision,
    rows,
    divisions: [...byDivision.values()],
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
