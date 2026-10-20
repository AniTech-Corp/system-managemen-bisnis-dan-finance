import {
  AccountType,
  JournalSource,
  JournalStatus,
  NormalBalance,
  Prisma,
} from '@prisma/client';
import { prisma } from '../prisma';
import { fiscalYearRange, jakartaStartOfDay, type DateRange } from './period';

/**
 * Mesin laporan keuangan.
 *
 * PRINSIP MUTLAK: semua angka berasal dari `journal_lines` yang terhubung ke
 * `journal_entries.status = POSTED`. Tidak ada fungsi di sini yang membaca
 * `cash_transactions`. Kalau prinsip ini dilanggar, akan ada dua versi
 * kebenaran dan selisihnya tidak bisa dijelaskan ke owner.
 */

const ZERO = new Prisma.Decimal(0);

export interface JournalLineRow {
  id: string;
  entryId: string;
  accountId: string;
  cashAccountId: string | null;
  partnerId: string | null;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  description: string | null;
  account: {
    id: string;
    code: string;
    name: string;
    type: AccountType;
    normalBalance: NormalBalance;
  };
  entry: {
    id: string;
    entryNumber: string;
    entryDate: Date;
    description: string;
    source: JournalSource;
  };
}

const LINE_SELECT = {
  id: true,
  entryId: true,
  accountId: true,
  cashAccountId: true,
  partnerId: true,
  debit: true,
  credit: true,
  description: true,
  account: {
    select: { id: true, code: true, name: true, type: true, normalBalance: true },
  },
  entry: {
    select: { id: true, entryNumber: true, entryDate: true, description: true, source: true },
  },
} satisfies Prisma.JournalLineSelect;

async function fetchPostedLines(
  workspaceId: string,
  range: DateRange,
  options: { excludeSources?: JournalSource[] } = {}
): Promise<JournalLineRow[]> {
  const rows = await prisma.journalLine.findMany({
    where: {
      workspaceId,
      entry: {
        status: JournalStatus.POSTED,
        entryDate: { gte: range.startDate, lte: range.endDate },
        ...(options.excludeSources?.length ? { source: { notIn: options.excludeSources } } : {}),
      },
    },
    select: LINE_SELECT,
    orderBy: [{ entry: { entryDate: 'asc' } }, { lineNo: 'asc' }],
  });

  return rows as JournalLineRow[];
}

/**
 * Baris "posisi awal" untuk sebuah tanggal: transaksi bertanggal lebih awal,
 * DITAMBAH jurnal saldo awal (source OPENING).
 *
 * Jurnal saldo awal sengaja diperlakukan sebagai posisi awal meskipun tanggalnya
 * jatuh di dalam periode, supaya laporan arus kas dan perubahan ekuitas
 * menampilkan "Kas Awal"/"Ekuitas Awal" sesuai yang diisi user -- bukan
 * melaporkannya sebagai setoran modal di periode berjalan.
 */
async function fetchOpeningPositionLines(
  workspaceId: string,
  startDate: Date,
  options: { accountType?: AccountType } = {}
): Promise<JournalLineRow[]> {
  const rows = await prisma.journalLine.findMany({
    where: {
      workspaceId,
      ...(options.accountType ? { account: { type: options.accountType } } : {}),
      entry: {
        status: JournalStatus.POSTED,
        OR: [{ entryDate: { lt: startDate } }, { source: JournalSource.OPENING }],
      },
    },
    select: LINE_SELECT,
    orderBy: [{ entry: { entryDate: 'asc' } }, { lineNo: 'asc' }],
  });

  return rows as JournalLineRow[];
}

function naturalBalance(row: { debit: Prisma.Decimal; credit: Prisma.Decimal }, normalBalance: NormalBalance) {
  return normalBalance === NormalBalance.DEBIT ? row.debit.minus(row.credit) : row.credit.minus(row.debit);
}

/**
 * Angka sebuah akun SEBAGAI BAGIAN DARI LAPORAN (bukan saldo akunnya sendiri).
 *
 * Tandanya mengikuti TIPE akun, bukan `normal_balance` akun tersebut:
 * aset & beban bertanda positif saat bersaldo debit, liabilitas/ekuitas/pendapatan
 * bertanda positif saat bersaldo kredit.
 *
 * Bedanya terasa pada akun kontra. Akumulasi Penyusutan bertipe ASSET tetapi
 * bersaldo normal KREDIT -- ia harus MENGURANGI total aset. Prive bertipe EQUITY
 * tetapi bersaldo normal DEBIT -- ia harus MENGURANGI ekuitas. Kalau memakai
 * `normal_balance` per akun, keduanya justru menambah dan Neraca tidak balance.
 */
export function statementAmount(
  row: { debit: Prisma.Decimal; credit: Prisma.Decimal },
  type: AccountType
) {
  const debitSide = type === AccountType.ASSET || type === AccountType.EXPENSE;
  return debitSide ? row.debit.minus(row.credit) : row.credit.minus(row.debit);
}

export interface AccountBalance {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  /** Saldo menurut sifat normal akun itu sendiri (aset/beban positif saat debit). */
  balance: Prisma.Decimal;
  /** Nilai untuk laporan: bertanda sesuai sisi laporan tipe akun (lihat statementAmount). */
  amount: Prisma.Decimal;
}

export function aggregateBalances(lines: JournalLineRow[]): AccountBalance[] {
  const map = new Map<string, AccountBalance>();

  for (const line of lines) {
    const existing = map.get(line.accountId) ?? {
      accountId: line.accountId,
      code: line.account.code,
      name: line.account.name,
      type: line.account.type,
      normalBalance: line.account.normalBalance,
      debit: ZERO,
      credit: ZERO,
      balance: ZERO,
      amount: ZERO,
    };
    existing.debit = existing.debit.plus(line.debit);
    existing.credit = existing.credit.plus(line.credit);
    existing.balance = naturalBalance(existing, existing.normalBalance);
    existing.amount = statementAmount(existing, existing.type);
    map.set(line.accountId, existing);
  }

  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

export interface ReportLine {
  accountId: string;
  code: string;
  name: string;
  amount: Prisma.Decimal;
}

function toReportLine(balance: AccountBalance): ReportLine {
  return {
    accountId: balance.accountId,
    code: balance.code,
    name: balance.name,
    amount: balance.amount,
  };
}

function sumAmount(lines: ReportLine[]): Prisma.Decimal {
  return lines.reduce((acc, l) => acc.plus(l.amount), ZERO);
}

function isCogs(account: { code: string }) {
  return account.code.startsWith('5-');
}

function isTaxExpense(account: { code: string }) {
  return account.code.startsWith('7-');
}

/* ───────────────────────────── LABA RUGI ───────────────────────────── */

export interface IncomeStatement {
  period: DateRange;
  revenue: ReportLine[];
  cogs: ReportLine[];
  operatingExpenses: ReportLine[];
  taxExpenses: ReportLine[];
  totals: {
    revenue: Prisma.Decimal;
    cogs: Prisma.Decimal;
    grossProfit: Prisma.Decimal;
    operatingExpenses: Prisma.Decimal;
    operatingProfit: Prisma.Decimal;
    taxExpenses: Prisma.Decimal;
    netIncome: Prisma.Decimal;
  };
}

export async function getIncomeStatement(workspaceId: string, range: DateRange): Promise<IncomeStatement> {
  const lines = await fetchPostedLines(workspaceId, range, {
    excludeSources: [JournalSource.CLOSING, JournalSource.OPENING],
  });
  const balances = aggregateBalances(lines);

  const revenue = balances.filter((b) => b.type === AccountType.REVENUE).map(toReportLine).filter((l) => !l.amount.isZero());
  const expenses = balances.filter((b) => b.type === AccountType.EXPENSE).map(toReportLine).filter((l) => !l.amount.isZero());

  const cogs = expenses.filter((l) => isCogs(l));
  const taxExpenses = expenses.filter((l) => isTaxExpense(l));
  const operatingExpenses = expenses.filter((l) => !isCogs(l) && !isTaxExpense(l));

  const totalRevenue = sumAmount(revenue);
  const totalCogs = sumAmount(cogs);
  const totalOperating = sumAmount(operatingExpenses);
  const totalTax = sumAmount(taxExpenses);
  const grossProfit = totalRevenue.minus(totalCogs);
  const operatingProfit = grossProfit.minus(totalOperating);
  const netIncome = operatingProfit.minus(totalTax);

  return {
    period: range,
    revenue,
    cogs,
    operatingExpenses,
    taxExpenses,
    totals: {
      revenue: totalRevenue,
      cogs: totalCogs,
      grossProfit,
      operatingExpenses: totalOperating,
      operatingProfit,
      taxExpenses: totalTax,
      netIncome,
    },
  };
}

/* ───────────────────────────── NERACA ───────────────────────────── */

export interface BalanceSheet {
  asOf: Date;
  assets: ReportLine[];
  liabilities: ReportLine[];
  equityAccounts: ReportLine[];
  totals: {
    assets: Prisma.Decimal;
    liabilities: Prisma.Decimal;
    equityAccounts: Prisma.Decimal;
    currentYearProfit: Prisma.Decimal;
    equity: Prisma.Decimal;
    liabilitiesAndEquity: Prisma.Decimal;
    difference: Prisma.Decimal;
  };
  warnings: string[];
}

export async function getBalanceSheet(
  workspaceId: string,
  asOf: Date,
  fiscalYearStartMonth = 1
): Promise<BalanceSheet> {
  const start = new Date(0);
  const allLines = await fetchPostedLines(workspaceId, { startDate: start, endDate: asOf });
  const balances = aggregateBalances(allLines);

  const assets = balances.filter((b) => b.type === AccountType.ASSET).map(toReportLine).filter((l) => !l.amount.isZero());
  const liabilities = balances
    .filter((b) => b.type === AccountType.LIABILITY)
    .map(toReportLine)
    .filter((l) => !l.amount.isZero());
  const equityAccounts = balances
    .filter((b) => b.type === AccountType.EQUITY)
    .map(toReportLine)
    .filter((l) => !l.amount.isZero());

  // Laba tahun berjalan dihitung dari awal tahun fiskal s.d. tanggal neraca,
  // TERMASUK jurnal closing. Setelah tutup tahun, angka ini menjadi nol karena
  // saldo pendapatan/beban sudah dipindahkan ke ekuitas.
  const fy = fiscalYearRange(asOf.getUTCFullYear(), asOf.getUTCMonth() + 1, fiscalYearStartMonth);
  const fyLines = allLines.filter(
    (l) => l.entry.entryDate >= fy.startDate && l.entry.entryDate <= asOf
  );
  const profitBalances = aggregateBalances(fyLines);

  // PENTING: pendapatan DIKURANGI beban. Keduanya bernilai positif menurut
  // saldo normalnya, jadi menjumlahkan keduanya langsung akan melebihkan laba.
  const revenueYtd = profitBalances
    .filter((b) => b.type === AccountType.REVENUE)
    .reduce((acc, b) => acc.plus(b.amount), ZERO);
  const expenseYtd = profitBalances
    .filter((b) => b.type === AccountType.EXPENSE)
    .reduce((acc, b) => acc.plus(b.amount), ZERO);
  const currentYearProfit = revenueYtd.minus(expenseYtd);

  const totalAssets = sumAmount(assets);
  const totalLiabilities = sumAmount(liabilities);
  const totalEquityAccounts = sumAmount(equityAccounts);
  const totalEquity = totalEquityAccounts.plus(currentYearProfit);
  const liabilitiesAndEquity = totalLiabilities.plus(totalEquity);
  const difference = totalAssets.minus(liabilitiesAndEquity);

  const warnings: string[] = [];
  if (!difference.isZero()) {
    warnings.push(
      `Neraca tidak balance: selisih ${difference.toFixed(2)}. Periksa saldo awal dan jurnal yang belum diposting.`
    );
  }

  return {
    asOf,
    assets,
    liabilities,
    equityAccounts,
    totals: {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equityAccounts: totalEquityAccounts,
      currentYearProfit,
      equity: totalEquity,
      liabilitiesAndEquity,
      difference,
    },
    warnings,
  };
}

/* ───────────────────────────── ARUS KAS ───────────────────────────── */

export type CashFlowSection = 'OPERATING' | 'INVESTING' | 'FINANCING';

export interface CashFlowItem {
  section: CashFlowSection;
  code: string;
  name: string;
  amount: Prisma.Decimal;
}

export interface CashFlowStatement {
  period: DateRange;
  openingCash: Prisma.Decimal;
  items: CashFlowItem[];
  totals: {
    operating: Prisma.Decimal;
    investing: Prisma.Decimal;
    financing: Prisma.Decimal;
    netChange: Prisma.Decimal;
    closingCash: Prisma.Decimal;
    actualCashBalance: Prisma.Decimal;
    difference: Prisma.Decimal;
  };
  warnings: string[];
}

function classifySection(code: string, type: AccountType): CashFlowSection {
  // Aset tetap / aset jangka panjang -> investasi
  if (type === AccountType.ASSET && (code.startsWith('1-2') || code.startsWith('1-3'))) return 'INVESTING';
  // Ekuitas dan pinjaman jangka panjang -> pendanaan
  if (type === AccountType.EQUITY) return 'FINANCING';
  if (type === AccountType.LIABILITY && code.startsWith('2-2')) return 'FINANCING';
  return 'OPERATING';
}

export async function getCashFlowStatement(workspaceId: string, range: DateRange): Promise<CashFlowStatement> {
  // Saldo kas awal = mutasi sebelum periode + jurnal saldo awal (OPENING).
  const openingLines = await fetchOpeningPositionLines(workspaceId, range.startDate);
  const openingCash = openingLines
    .filter((l) => l.cashAccountId)
    .reduce((acc, l) => acc.plus(l.debit).minus(l.credit), ZERO);

  // Semua baris dalam periode (termasuk yang non-kas) untuk mencari akun lawan.
  // Jurnal saldo awal DIKECUALIKAN karena sudah dihitung sebagai kas awal.
  const lines = await fetchPostedLines(workspaceId, range, { excludeSources: [JournalSource.OPENING] });
  const byEntry = new Map<string, JournalLineRow[]>();
  for (const line of lines) {
    const list = byEntry.get(line.entryId) ?? [];
    list.push(line);
    byEntry.set(line.entryId, list);
  }

  const items: CashFlowItem[] = [];

  for (const entryLines of byEntry.values()) {
    const cashLines = entryLines.filter((l) => l.cashAccountId);
    if (cashLines.length === 0) continue;

    const nonCashLines = entryLines.filter((l) => !l.cashAccountId);
    if (nonCashLines.length === 0) continue;

    const cashDelta = cashLines
      .reduce((acc, l) => acc.plus(l.debit).minus(l.credit), ZERO)
      .minus(
        // baris kas yang ada di sisi kredit sudah mengurangi; rumus di atas
        // sudah menghitung debit - credit, jadi tidak perlu koreksi tambahan.
        ZERO
      );

    if (cashDelta.isZero()) continue;

    const weights = nonCashLines.map((l) => l.debit.plus(l.credit));
    const totalWeight = weights.reduce((acc, v) => acc.plus(v), ZERO);

    nonCashLines.forEach((line, index) => {
      const share = totalWeight.isZero()
        ? cashDelta.dividedBy(nonCashLines.length)
        : cashDelta.times(weights[index]).dividedBy(totalWeight);

      const section = classifySection(line.account.code, line.account.type);
      items.push({
        section,
        code: line.account.code,
        name: line.account.name,
        amount: share,
      });
    });
  }

  // Gabungkan item dengan akun yang sama per seksi.
  const merged = new Map<string, CashFlowItem>();
  for (const item of items) {
    const key = `${item.section}|${item.code}`;
    const existing = merged.get(key);
    if (existing) existing.amount = existing.amount.plus(item.amount);
    else merged.set(key, { ...item });
  }

  const finalItems = Array.from(merged.values())
    .filter((i) => !i.amount.isZero())
    .sort((a, b) => a.section.localeCompare(b.section) || a.code.localeCompare(b.code));

  const totalFor = (section: CashFlowSection) =>
    finalItems.filter((i) => i.section === section).reduce((acc, i) => acc.plus(i.amount), ZERO);

  const operating = totalFor('OPERATING');
  const investing = totalFor('INVESTING');
  const financing = totalFor('FINANCING');
  const netChange = operating.plus(investing).plus(financing);
  const closingCash = openingCash.plus(netChange);

  // Validasi silang terhadap saldo rekening kas/bank pada tanggal akhir.
  const cashAccountLines = await prisma.journalLine.findMany({
    where: {
      workspaceId,
      cashAccountId: { not: null },
      entry: { status: JournalStatus.POSTED, entryDate: { lte: range.endDate } },
    },
    select: { debit: true, credit: true },
  });
  const actualCashBalance = cashAccountLines.reduce((acc, l) => acc.plus(l.debit).minus(l.credit), ZERO);
  const difference = closingCash.minus(actualCashBalance);

  const warnings: string[] = [];
  if (!difference.isZero()) {
    warnings.push(
      `Arus kas tidak cocok dengan saldo rekening: selisih ${difference.toFixed(2)}. Periksa jurnal yang menyentuh akun kas tanpa cashAccountId.`
    );
  }

  return {
    period: range,
    openingCash,
    items: finalItems,
    totals: {
      operating,
      investing,
      financing,
      netChange,
      closingCash,
      actualCashBalance,
      difference,
    },
    warnings,
  };
}

/* ─────────────────────── PERUBAHAN EKUITAS ─────────────────────── */

export interface EquityStatement {
  period: DateRange;
  openingEquity: Prisma.Decimal;
  netIncome: Prisma.Decimal;
  contributions: Array<{ code: string; name: string; amount: Prisma.Decimal }>;
  withdrawals: Array<{ code: string; name: string; amount: Prisma.Decimal }>;
  totals: {
    contributions: Prisma.Decimal;
    withdrawals: Prisma.Decimal;
    closingEquity: Prisma.Decimal;
  };
}

export async function getEquityStatement(
  workspaceId: string,
  range: DateRange,
  profitAccountId?: string | null
): Promise<EquityStatement> {
  // Ekuitas awal = saldo sebelum periode + jurnal saldo awal (OPENING), supaya
  // modal yang disetor pada saat mulai pembukuan tidak dilaporkan sebagai
  // setoran modal baru di periode pertama.
  const beforeLines = await fetchOpeningPositionLines(workspaceId, range.startDate, {
    accountType: AccountType.EQUITY,
  });
  const openingEquity = beforeLines.reduce(
    (acc, line) => acc.plus(statementAmount(line, line.account.type)),
    ZERO
  );

  // Pergerakan ekuitas di periode, MENGECUALIKAN jurnal closing dan saldo awal
  // supaya laba tidak dihitung dua kali.
  const periodLines = await fetchPostedLines(workspaceId, range, {
    excludeSources: [JournalSource.CLOSING, JournalSource.OPENING],
  });
  const equityLines = periodLines.filter((l) => l.account.type === AccountType.EQUITY);

  const isProfitAccount = (line: JournalLineRow) =>
    (profitAccountId && line.accountId === profitAccountId) || line.account.code === '3-3000';

  const contributionsMap = new Map<string, { code: string; name: string; amount: Prisma.Decimal }>();
  const withdrawalsMap = new Map<string, { code: string; name: string; amount: Prisma.Decimal }>();

  for (const line of equityLines) {
    if (isProfitAccount(line)) continue; // saldo laba berjalan diwakili netIncome
    const credit = line.credit.minus(line.debit);
    const target = credit.isNegative() ? withdrawalsMap : contributionsMap;
    const amount = credit.abs();
    if (amount.isZero()) continue;
    const existing = target.get(line.accountId);
    if (existing) existing.amount = existing.amount.plus(amount);
    else target.set(line.accountId, { code: line.account.code, name: line.account.name, amount });
  }

  const contributions = Array.from(contributionsMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  const withdrawals = Array.from(withdrawalsMap.values()).sort((a, b) => a.code.localeCompare(b.code));

  const totalContributions = contributions.reduce((acc, c) => acc.plus(c.amount), ZERO);
  const totalWithdrawals = withdrawals.reduce((acc, w) => acc.plus(w.amount), ZERO);

  const income = await getIncomeStatement(workspaceId, range);
  const netIncome = income.totals.netIncome;

  const closingEquity = openingEquity.plus(netIncome).plus(totalContributions).minus(totalWithdrawals);

  return {
    period: range,
    openingEquity,
    netIncome,
    contributions,
    withdrawals,
    totals: {
      contributions: totalContributions,
      withdrawals: totalWithdrawals,
      closingEquity,
    },
  };
}

/* ─────────────────────── NERACA SALDO ─────────────────────── */

export interface TrialBalance {
  period: DateRange;
  rows: Array<AccountBalance & { debitSide: Prisma.Decimal; creditSide: Prisma.Decimal }>;
  totals: { debit: Prisma.Decimal; credit: Prisma.Decimal; difference: Prisma.Decimal };
}

export async function getTrialBalance(workspaceId: string, range: DateRange): Promise<TrialBalance> {
  const lines = await fetchPostedLines(workspaceId, range);
  const balances = aggregateBalances(lines);

  // Neraca saldo memakai selisih MENTAH (debit - kredit), bukan saldo normal:
  // akun kontra seperti Akumulasi Penyusutan (aset bersaldo kredit) dan Diskon
  // Penjualan (pendapatan bersaldo debit) harus muncul di sisi yang benar.
  const rows = balances
    .filter((b) => !b.debit.isZero() || !b.credit.isZero())
    .map((b) => {
      const raw = b.debit.minus(b.credit);
      return {
        ...b,
        debitSide: raw.greaterThan(0) ? raw : ZERO,
        creditSide: raw.lessThan(0) ? raw.abs() : ZERO,
      };
    });

  const debit = rows.reduce((acc, r) => acc.plus(r.debitSide), ZERO);
  const credit = rows.reduce((acc, r) => acc.plus(r.creditSide), ZERO);

  return {
    period: range,
    rows,
    totals: { debit, credit, difference: debit.minus(credit) },
  };
}

/* ─────────────────────── BUKU BESAR ─────────────────────── */

export interface LedgerEntry {
  entryId: string;
  entryNumber: string;
  entryDate: Date;
  description: string;
  source: JournalSource;
  debit: Prisma.Decimal;
  credit: Prisma.Decimal;
  balance: Prisma.Decimal;
}

export interface Ledger {
  account: { id: string; code: string; name: string; type: AccountType; normalBalance: NormalBalance };
  period: DateRange;
  openingBalance: Prisma.Decimal;
  entries: LedgerEntry[];
  closingBalance: Prisma.Decimal;
}

export async function getLedger(
  workspaceId: string,
  accountId: string,
  range: DateRange
): Promise<Ledger> {
  const account = await prisma.account.findFirst({
    where: { id: accountId, workspaceId },
    select: { id: true, code: true, name: true, type: true, normalBalance: true },
  });
  if (!account) throw new Error('Akun tidak ditemukan.');

  // Saldo awal buku besar memakai aturan "posisi awal" yang sama dengan laporan
  // arus kas & perubahan ekuitas: mutasi sebelum periode DITAMBAH jurnal saldo
  // awal (OPENING). Tanpa ini, saldo awal pada buku besar berbeda dengan
  // "Kas Awal" di laporan arus kas untuk periode pertama pembukuan.
  const before = await prisma.journalLine.findMany({
    where: {
      workspaceId,
      accountId,
      entry: {
        status: JournalStatus.POSTED,
        OR: [{ entryDate: { lt: range.startDate } }, { source: JournalSource.OPENING }],
      },
    },
    select: { debit: true, credit: true },
  });
  const openingRaw = before.reduce((acc, l) => acc.plus(l.debit).minus(l.credit), ZERO);
  const openingBalance =
    account.normalBalance === NormalBalance.DEBIT ? openingRaw : openingRaw.negated();

  // Mutasi periode tidak menampilkan lagi jurnal saldo awal, karena sudah
  // diwakili oleh baris "Saldo Awal" di atas.
  const rows = await prisma.journalLine.findMany({
    where: {
      workspaceId,
      accountId,
      entry: {
        status: JournalStatus.POSTED,
        entryDate: { gte: range.startDate, lte: range.endDate },
        source: { not: JournalSource.OPENING },
      },
    },
    select: {
      debit: true,
      credit: true,
      entry: { select: { id: true, entryNumber: true, entryDate: true, description: true, source: true } },
    },
    orderBy: [{ entry: { entryDate: 'asc' } }, { lineNo: 'asc' }],
  });

  let running = openingBalance;
  const entries: LedgerEntry[] = rows.map((row) => {
    const delta =
      account.normalBalance === NormalBalance.DEBIT
        ? row.debit.minus(row.credit)
        : row.credit.minus(row.debit);
    running = running.plus(delta);
    return {
      entryId: row.entry.id,
      entryNumber: row.entry.entryNumber,
      entryDate: row.entry.entryDate,
      description: row.entry.description,
      source: row.entry.source,
      debit: row.debit,
      credit: row.credit,
      balance: running,
    };
  });

  return {
    account,
    period: range,
    openingBalance,
    entries,
    closingBalance: running,
  };
}

/* ─────────────────────── PEMBANTU ─────────────────────── */

/** Dipakai test invarian: total debit harus sama dengan total kredit. */
export function assertJournalBalanced(lines: Array<{ debit: Prisma.Decimal; credit: Prisma.Decimal }>) {
  const debit = lines.reduce((acc, l) => acc.plus(l.debit), ZERO);
  const credit = lines.reduce((acc, l) => acc.plus(l.credit), ZERO);
  if (!debit.equals(credit)) {
    throw new Error(`Jurnal tidak balance: debit ${debit.toFixed(2)} vs kredit ${credit.toFixed(2)}.`);
  }
}

export { jakartaStartOfDay };
