import { BudgetAlertLevel, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { getIncomeStatement } from './reports';
import {
  budgetDivisionFilter,
  fiscalStartYear,
  monthIndexInFiscalYear,
  sumMonthlySlots,
} from './budgets';
import { COMPANY_DIVISION, divisionLabel } from './budget-divisions';
import { getJakartaParts, jakartaStartOfMonth, monthRange } from './period';

/**
 * Peringatan anggaran: realisasi sebuah baris anggaran (divisi + akun) sudah
 * mendekati atau melewati batas pada bulan berjalan tahun buku.
 *
 * Diniatkan untuk DIPANGGIL SETELAH transaksi commit, di luar transaksi database
 * yang membuat transaksi kas. Kegagalan menilai anggaran tidak boleh membatalkan
 * pencatatan pengeluaran -- itu akan menghentikan alur kas harian staf hanya
 * karena tabel anggaran bermasalah. Karena itu `evaluateBudgetAlerts` tidak
 * pernah melempar; kegagalannya dicatat ke console dan ditelan.
 */

/**
 * Ambang peringatan, dalam persentase anggaran YTD yang sudah terpakai.
 *
 * `WARNING` = mendekati batas, `EXCEEDED` = sudah melewati. Keduanya konstan
 * di sini supaya aturannya bisa ditemukan dan diuji di satu tempat.
 */
export const WARNING_THRESHOLD_PCT = 80;
export const EXCEEDED_THRESHOLD_PCT = 100;

const ALL_LEVELS: readonly BudgetAlertLevel[] = [BudgetAlertLevel.WARNING, BudgetAlertLevel.EXCEEDED];

function toDecimal(value: Prisma.Decimal | number): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * Tentukan level peringatan untuk satu baris anggaran.
 *
 * Perbandingan `EXCEEDED` memakai `actual >= budget` (bukan persentase) supaya
 * tepat 100% tidak pernah terpeleset karena pembulatan floating point.
 * Anggaran nol atau negatif tidak bisa dinilai dan tidak pernah memicu apa pun.
 */
export function resolveAlertLevel(
  budgetYtd: Prisma.Decimal | number,
  actualYtd: Prisma.Decimal | number
): BudgetAlertLevel | null {
  const budget = toDecimal(budgetYtd);
  const actual = toDecimal(actualYtd);
  if (budget.lte(0)) return null;
  if (actual.gte(budget)) return BudgetAlertLevel.EXCEEDED;
  if (actual.dividedBy(budget).times(100).gte(WARNING_THRESHOLD_PCT)) {
    return BudgetAlertLevel.WARNING;
  }
  return null;
}

export interface EvaluateBudgetAlertsResult {
  fiscalYear: number;
  monthIndex: number;
  /** Alert yang baru dibuat pada evaluasi ini. */
  created: Prisma.BudgetAlertGetPayload<object>[];
  /** Alert yang dihapus karena sudah tidak berlaku (realisasi turun / baris hilang). */
  cleared: number;
  /** true bila evaluasi gagal dan hasilnya tidak bisa dipercaya. */
  failed: boolean;
}

export interface EvaluateBudgetAlertsOptions {
  /** Pencatat transaksi, untuk jejak `ActivityEvent`. Boleh null. */
  userId?: string | null;
  /** Awal tahun buku. Default: dari `AccountingSetting`. */
  fiscalStartMonth?: number;
}

/**
 * Nilai awal tahun buku. Sengaja meniru ambil-temukan-abaikan dari
 * `getAccountingSetting`: bila modul akuntansi belum siap, anggaran memang
 * belum relevan.
 */
async function resolveFiscalStartMonth(
  workspaceId: string,
  override?: number
): Promise<number> {
  if (override && override >= 1 && override <= 12) return override;
  const setting = await prisma.accountingSetting.findUnique({
    where: { workspaceId },
    select: { fiscalYearStartMonth: true },
  });
  return setting?.fiscalYearStartMonth ?? 1;
}

/**
 * Nilai `realisasi YTD` per (divisi, akun) untuk tahun buku berjalan.
 *
 * Satu panggilan `getIncomeStatement` per divisi -- bukan satu query gabungan --
 * supaya mesinnya persis sama dengan Laba Rugi. Angka yang keluar karena itu
 * tidak mungkin menyimpang dari laporan resmi.
 */
async function fetchActualsByDivision(
  workspaceId: string,
  divisions: string[],
  ytdStart: Date,
  endDate: Date
): Promise<Map<string, Map<string, Prisma.Decimal>>> {
  const result = new Map<string, Map<string, Prisma.Decimal>>();
  await Promise.all(
    divisions.map(async (div) => {
      const income = await getIncomeStatement(
        workspaceId,
        { startDate: ytdStart, endDate },
        budgetDivisionFilter(div)
      );
      const map = new Map<string, Prisma.Decimal>();
      for (const group of [
        income.revenue,
        income.cogs,
        income.operatingExpenses,
        income.taxExpenses,
      ]) {
        for (const line of group) {
          map.set(line.accountId, (map.get(line.accountId) ?? new Prisma.Decimal(0)).plus(line.amount));
        }
      }
      result.set(div, map);
    })
  );
  return result;
}

/**
 * Nilai ulang semua peringatan anggaran tahun buku berjalan.
 *
 * Idempoten: evaluasi berulang tidak pernah menghasilkan notifikasi ganda
 * karena unique constraint pada `BudgetAlert` berperan sebagai dedup. Alert
 * yang sudah tidak berlaku (realisasi turun kembali di bawah ambang, atau baris
 * anggarannya dihapus) ikut dibersihkan supaya badge tidak menampilkan
 * peringatan basi.
 *
 * Tidak pernah melempar. Lihat catatan di atas file ini.
 */
export async function evaluateBudgetAlerts(
  workspaceId: string,
  options: EvaluateBudgetAlertsOptions = {}
): Promise<EvaluateBudgetAlertsResult> {
  const fiscalStartMonth = await resolveFiscalStartMonth(workspaceId, options.fiscalStartMonth);
  const parts = getJakartaParts();
  const fiscalYear = fiscalStartYear(parts.year, parts.month, fiscalStartMonth);
  const monthIndex = monthIndexInFiscalYear(parts.year, parts.month, fiscalStartMonth);

  const empty: EvaluateBudgetAlertsResult = {
    fiscalYear,
    monthIndex,
    created: [],
    cleared: 0,
    failed: false,
  };

  try {
    const [budgets, existing] = await Promise.all([
      prisma.budget.findMany({
        where: { workspaceId, fiscalYear },
        select: { accountId: true, division: true, monthly: true },
      }),
      prisma.budgetAlert.findMany({ where: { workspaceId, fiscalYear, monthIndex } }),
    ]);

    if (budgets.length === 0) {
      // Anggaran dihapus seluruhnya: peringatannya juga harus hilang, kalau
      // tidak badge akan menunjuk ke baris yang sudah tidak ada.
      const removed = await prisma.budgetAlert.deleteMany({ where: { workspaceId, fiscalYear, monthIndex } });
      return { ...empty, cleared: removed.count };
    }

    const divisions = [...new Set(budgets.map((b) => b.division || COMPANY_DIVISION))];
    const monthEnd = monthRange(parts.year, parts.month).endDate;
    const actuals = await fetchActualsByDivision(
      workspaceId,
      divisions,
      jakartaStartOfMonth(fiscalYear, fiscalStartMonth),
      monthEnd
    );

    const existingByKey = new Map<string, { id: string }>();
    for (const alert of existing) {
      existingByKey.set(`${alert.accountId}::${alert.division}::${alert.level}`, { id: alert.id });
    }

    const toDeleteIds: string[] = [];
    // (accountId, division, level) yang layak ada setelah evaluasi ini.
    const toEnsure: Array<{
      accountId: string;
      division: string;
      level: BudgetAlertLevel;
      budget: Prisma.Decimal;
      actual: Prisma.Decimal;
    }> = [];
    const activeRows = new Set<string>();

    for (const budget of budgets) {
      const division = budget.division || COMPANY_DIVISION;
      const rowKey = `${budget.accountId}::${division}`;
      activeRows.add(rowKey);

      const budgetYtd = sumMonthlySlots(budget.monthly, monthIndex);
      const actualYtd = actuals.get(division)?.get(budget.accountId) ?? new Prisma.Decimal(0);
      const level = resolveAlertLevel(budgetYtd, actualYtd);

      for (const candidate of ALL_LEVELS) {
        const found = existingByKey.get(`${budget.accountId}::${division}::${candidate}`);
        if (!found) continue;
        // EXCEEDED menggantikan WARNING, jadi WARNING yang sudah terlampaui
        // harus hilang -- hanya level tertinggi yang layak tampil.
        if (level !== candidate) toDeleteIds.push(found.id);
      }

      if (level) {
        toEnsure.push({ accountId: budget.accountId, division, level, budget: budgetYtd, actual: actualYtd });
      }
    }

    // Alert untuk baris anggaran yang sudah tidak ada (divisi diganti / akun
    // dihapus dari anggaran) ikut dibersihkan.
    for (const alert of existing) {
      if (!activeRows.has(`${alert.accountId}::${alert.division}`)) toDeleteIds.push(alert.id);
    }

    const uniqueDeleteIds = [...new Set(toDeleteIds)];
    if (uniqueDeleteIds.length) {
      await prisma.budgetAlert.deleteMany({ where: { id: { in: uniqueDeleteIds } } });
    }

    // `upsert` (bukan `createMany`) supaya alert yang sudah ada tidak digandakan
    // DAN kita mendapat record persis beserta id-nya untuk ActivityEvent.
    const created: Prisma.BudgetAlertGetPayload<{
      include: { account: { select: { code: true; name: true } } };
    }>[] = [];
    for (const item of toEnsure) {
      const alreadyExists = existingByKey.has(
        `${item.accountId}::${item.division}::${item.level}`
      );
      const alert = await prisma.budgetAlert.upsert({
        where: {
          workspaceId_fiscalYear_monthIndex_division_accountId_level: {
            workspaceId,
            fiscalYear,
            monthIndex,
            division: item.division,
            accountId: item.accountId,
            level: item.level,
          },
        },
        create: {
          workspaceId,
          fiscalYear,
          monthIndex,
          division: item.division,
          accountId: item.accountId,
          level: item.level,
          budget: item.budget,
          actual: item.actual,
        },
        // Realisasi ikut diperbarui supaya angka di panel selalu segar walau
        // peringatannya sudah pernah dibuat dan di-acknowledge.
        update: { budget: item.budget, actual: item.actual },
        include: { account: { select: { code: true, name: true } } },
      });
      if (!alreadyExists) created.push(alert);
    }

    // Jejak audit. Bukan jalur baca utama panel -- itu lewat endpoint
    // budget-alerts -- tapi berguna untuk AI brain dan riwayat aktivitas.
    if (created.length > 0) {
      await prisma.activityEvent.createMany({
        data: created.map((alert) => ({
          workspaceId,
          userId: options.userId ?? null,
          type: 'BUDGET_ALERT_TRIGGERED',
          payload: {
            alertId: alert.id,
            fiscalYear,
            monthIndex,
            division: alert.division,
            divisionLabel: divisionLabel(alert.division),
            accountId: alert.accountId,
            accountCode: alert.account.code,
            accountName: alert.account.name,
            level: alert.level,
            budget: Number(alert.budget),
            actual: Number(alert.actual),
            message:
              alert.level === BudgetAlertLevel.EXCEEDED
                ? `Anggaran ${alert.account.name} (${divisionLabel(alert.division)}) sudah terpakai seluruhnya.`
                : `Anggaran ${alert.account.name} (${divisionLabel(alert.division)}) mendekati batas.`,
          },
        })),
      });
    }

    return { fiscalYear, monthIndex, created, cleared: uniqueDeleteIds.length, failed: false };
  } catch (err) {
    console.error('[budget-alerts] gagal menilai anggaran:', err);
    return { ...empty, failed: true };
  }
}
