import {
  ComplianceSource,
  ComplianceStatus,
  InvoiceStatus,
  JournalStatus,
  Prisma,
  TaxDocType,
  TaxPeriodStatus,
  TaxProfile,
  TaxType,
  TransactionType,
} from '@prisma/client';
import { prisma } from '../prisma';
import { round2, parsePeriodMonth, toNum, computePphFinalMonthly, computePpn } from './calc';
import {
  dateAtWibMidnight,
  dateKey,
  daysUntil,
  monthKey,
  monthRange,
  nextBusinessDay,
  wibParts,
  yearRange,
} from './dates';
import {
  ACTIVE_TAX_TYPES,
  DEFAULT_TAX_PARAMS,
  TAX_TYPE_LABEL,
  TAX_DOC_LABEL,
} from './constants';
import { generateDeadlinesForYear, getMonthlyDueDates } from './templates';

/* ────────────────────────────── Setting ────────────────────────────── */

export interface TaxSettingView {
  taxProfile: TaxProfile;
  entityType: string;
  enablePpn: boolean;
  ppnRate: number;
  pphFinalRate: number;
  umkmThreshold: number;
  pph23Rate: number;
  pph42Rate: number;
  pph21Method: string;
  npwp: string | null;
  nik: string | null;
  kppName: string | null;
  pkpEffectiveDate: Date | null;
  taxReminderDays: number[];
  taxReminderChannel: string;
}

function resolveSetting(setting: {
  taxProfile: TaxProfile;
  entityType: string;
  enablePpn: boolean;
  ppnRate: Prisma.Decimal;
  pphFinalRate: Prisma.Decimal;
  umkmThreshold: Prisma.Decimal;
  pph23Rate: Prisma.Decimal;
  pph42Rate: Prisma.Decimal;
  pph21Method: string;
  npwp: string | null;
  nik: string | null;
  kppName: string | null;
  pkpEffectiveDate: Date | null;
  taxReminderDays: number[];
  taxReminderChannel: string;
} | null): TaxSettingView {
  if (!setting) {
    return { ...DEFAULT_TAX_PARAMS, taxProfile: TaxProfile.UMKM_NON_PKP };
  }
  return {
    taxProfile: setting.taxProfile,
    entityType: setting.entityType,
    enablePpn: setting.enablePpn,
    ppnRate: toNum(setting.ppnRate),
    pphFinalRate: toNum(setting.pphFinalRate),
    umkmThreshold: toNum(setting.umkmThreshold),
    pph23Rate: toNum(setting.pph23Rate),
    pph42Rate: toNum(setting.pph42Rate),
    pph21Method: setting.pph21Method,
    npwp: setting.npwp,
    nik: setting.nik,
    kppName: setting.kppName,
    pkpEffectiveDate: setting.pkpEffectiveDate,
    taxReminderDays: setting.taxReminderDays,
    taxReminderChannel: setting.taxReminderChannel,
  };
}

export async function getTaxSetting(workspaceId: string): Promise<{
  setting: TaxSettingView;
  hasAccountingSetting: boolean;
  accountMaps: Array<{ taxType: TaxType; component: string; accountId: string; code: string; name: string }>;
}> {
  const [setting, accountMaps] = await Promise.all([
    prisma.accountingSetting.findUnique({ where: { workspaceId } }),
    prisma.taxAccountMap.findMany({
      where: { workspaceId },
      include: { account: { select: { code: true, name: true } } },
    }),
  ]);

  return {
    setting: resolveSetting(setting),
    hasAccountingSetting: Boolean(setting),
    accountMaps: accountMaps.map((m) => ({
      taxType: m.taxType,
      component: m.component,
      accountId: m.accountId,
      code: m.account.code,
      name: m.account.name,
    })),
  };
}

/* ───────────────────────────── Tahun buku ───────────────────────────── */

function emptyMonths(): number[] {
  return Array.from({ length: 13 }, () => 0);
}

export interface YearFigures {
  year: number;
  incomeByMonth: number[];
  incomeCountByMonth: number[];
  ppnOutputByMonth: number[];
  ppnOutputDppByMonth: number[];
  ppnOutputCountByMonth: number[];
  ppnInputByMonth: number[];
  ppnInputDppByMonth: number[];
  ppnInputCountByMonth: number[];
  payrollGrossByMonth: number[];
  pph21ByMonth: number[];
  bpjsByMonth: number[];
  payrollCountByMonth: number[];
  withholdingByType: Partial<Record<TaxType, number[]>>;
  withholdingDppByType: Partial<Record<TaxType, number[]>>;
  withholdingCountByType: Partial<Record<TaxType, number[]>>;
  ledgerPpnOutputByMonth: number[];
  ledgerPpnInputByMonth: number[];
}

export async function getYearFigures(workspaceId: string, year: number): Promise<YearFigures> {
  const range = yearRange(year);

  const [invoices, cashTx, payrolls, withholdings, ledgerLines] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        workspaceId,
        issueDate: { gte: range.startDate, lte: range.endDate },
        status: { not: InvoiceStatus.CANCELLED },
      },
      select: {
        id: true,
        issueDate: true,
        subtotal: true,
        taxAmount: true,
        taxRate: true,
        taxType: true,
        dpp: true,
        totalAmount: true,
        clientName: true,
      },
    }),
    prisma.cashTransaction.findMany({
      where: { workspaceId, transactionDate: { gte: range.startDate, lte: range.endDate } },
      select: {
        id: true,
        transactionDate: true,
        type: true,
        amount: true,
        category: true,
        description: true,
        taxType: true,
        dpp: true,
        taxRate: true,
        taxAmount: true,
      },
    }),
    prisma.employeePayroll.findMany({
      where: { workspaceId },
      select: {
        id: true,
        employeeName: true,
        monthYear: true,
        basicSalary: true,
        allowance: true,
        overtime: true,
        pph21: true,
        bpjsEmployee: true,
        bpjsEmployer: true,
        netSalary: true,
      },
    }),
    prisma.taxWithholding.findMany({
      where: { workspaceId, periodYear: year },
      select: {
        id: true,
        taxType: true,
        dpp: true,
        taxAmount: true,
        periodMonth: true,
      },
    }),
    prisma.journalLine.findMany({
      where: {
        workspaceId,
        account: { code: { in: ['2-1310', '1-1600'] } },
        entry: { status: JournalStatus.POSTED, entryDate: { gte: range.startDate, lte: range.endDate } },
      },
      select: {
        debit: true,
        credit: true,
        account: { select: { code: true } },
        entry: { select: { entryDate: true } },
      },
    }),
  ]);

  const figures: YearFigures = {
    year,
    incomeByMonth: emptyMonths(),
    incomeCountByMonth: emptyMonths(),
    ppnOutputByMonth: emptyMonths(),
    ppnOutputDppByMonth: emptyMonths(),
    ppnOutputCountByMonth: emptyMonths(),
    ppnInputByMonth: emptyMonths(),
    ppnInputDppByMonth: emptyMonths(),
    ppnInputCountByMonth: emptyMonths(),
    payrollGrossByMonth: emptyMonths(),
    pph21ByMonth: emptyMonths(),
    bpjsByMonth: emptyMonths(),
    payrollCountByMonth: emptyMonths(),
    withholdingByType: {},
    withholdingDppByType: {},
    withholdingCountByType: {},
    ledgerPpnOutputByMonth: emptyMonths(),
    ledgerPpnInputByMonth: emptyMonths(),
  };

  for (const inv of invoices) {
    const m = wibParts(inv.issueDate).month;
    const isPpn = !inv.taxType || inv.taxType === TaxType.PPN;
    if (!isPpn) continue;
    const tax = toNum(inv.taxAmount);
    if (tax <= 0) continue;
    figures.ppnOutputByMonth[m] += tax;
    figures.ppnOutputDppByMonth[m] += toNum(inv.dpp ?? inv.subtotal);
    figures.ppnOutputCountByMonth[m] += 1;
  }

  for (const tx of cashTx) {
    const m = wibParts(tx.transactionDate).month;
    const amount = toNum(tx.amount);
    if (tx.type === TransactionType.INCOME) {
      figures.incomeByMonth[m] += amount;
      figures.incomeCountByMonth[m] += 1;
      continue;
    }
    if (tx.taxType === TaxType.PPN && toNum(tx.taxAmount) > 0) {
      figures.ppnInputByMonth[m] += toNum(tx.taxAmount);
      figures.ppnInputDppByMonth[m] += toNum(tx.dpp ?? amount);
      figures.ppnInputCountByMonth[m] += 1;
    }
  }

  for (const payroll of payrolls) {
    const period = parsePeriodMonth(payroll.monthYear);
    if (!period || period.year !== year) continue;
    const m = period.month;
    figures.payrollGrossByMonth[m] +=
      toNum(payroll.basicSalary) + toNum(payroll.allowance) + toNum(payroll.overtime);
    figures.pph21ByMonth[m] += toNum(payroll.pph21);
    figures.bpjsByMonth[m] += toNum(payroll.bpjsEmployee) + toNum(payroll.bpjsEmployer);
    figures.payrollCountByMonth[m] += 1;
  }

  for (const row of withholdings) {
    const m = row.periodMonth;
    if (m < 1 || m > 12) continue;
    const byType = (figures.withholdingByType[row.taxType] ??= emptyMonths());
    const dppByType = (figures.withholdingDppByType[row.taxType] ??= emptyMonths());
    const countByType = (figures.withholdingCountByType[row.taxType] ??= emptyMonths());
    byType[m] += toNum(row.taxAmount);
    dppByType[m] += toNum(row.dpp);
    countByType[m] += 1;
  }

  for (const line of ledgerLines) {
    const m = wibParts(line.entry.entryDate).month;
    if (line.account.code === '2-1310') {
      figures.ledgerPpnOutputByMonth[m] += toNum(line.credit) - toNum(line.debit);
    } else if (line.account.code === '1-1600') {
      figures.ledgerPpnInputByMonth[m] += toNum(line.debit) - toNum(line.credit);
    }
  }

  return figures;
}

/* ─────────────────────────── Masa pajak ─────────────────────────── */

export interface PeriodAmount {
  amount: number;
  dpp: number;
  outputTax: number;
  inputTax: number;
  overpayment: number;
  transactionCount: number;
  note: string;
  ledgerAmount: number | null;
  ledgerDifference: number | null;
}

export function computePeriodAmount(
  taxType: TaxType,
  year: number,
  month: number,
  figures: YearFigures,
  setting: TaxSettingView
): PeriodAmount {
  switch (taxType) {
    case TaxType.PPN: {
      const ppn = computePpn(figures.ppnOutputByMonth[month], figures.ppnInputByMonth[month]);
      const ledgerAmount = round2(
        figures.ledgerPpnOutputByMonth[month] - figures.ledgerPpnInputByMonth[month]
      );
      return {
        amount: ppn.netPayable,
        dpp: round2(figures.ppnOutputDppByMonth[month]),
        outputTax: ppn.outputTax,
        inputTax: ppn.inputTax,
        overpayment: ppn.overpayment,
        transactionCount:
          figures.ppnOutputCountByMonth[month] + figures.ppnInputCountByMonth[month],
        note:
          ppn.overpayment > 0
            ? 'Lebih bayar — dapat dikompensasikan ke masa berikutnya.'
            : 'Kurang bayar PPN (Keluaran − Masukan).',
        ledgerAmount,
        ledgerDifference: round2(ppn.netPayable - ledgerAmount),
      };
    }

    case TaxType.PPH_FINAL_UMKM: {
      let ytdBefore = 0;
      for (let m = 1; m < month; m += 1) ytdBefore += figures.incomeByMonth[m];
      const result = computePphFinalMonthly({
        monthlyRevenue: figures.incomeByMonth[month],
        ytdRevenueBefore: ytdBefore,
        threshold: setting.umkmThreshold,
        ratePct: setting.pphFinalRate,
        isOrangPribadi: setting.entityType === 'ORANG_PRIBADI',
      });
      return {
        amount: result.taxAmount,
        dpp: round2(figures.incomeByMonth[month]),
        outputTax: 0,
        inputTax: 0,
        overpayment: 0,
        transactionCount: figures.incomeCountByMonth[month],
        note: result.note,
        ledgerAmount: null,
        ledgerDifference: null,
      };
    }

    case TaxType.PPH_21:
      return {
        amount: round2(figures.pph21ByMonth[month]),
        dpp: round2(figures.payrollGrossByMonth[month]),
        outputTax: 0,
        inputTax: 0,
        overpayment: 0,
        transactionCount: figures.payrollCountByMonth[month],
        note: 'Diambil dari kolom PPh 21 pada slip gaji (input manual payroll).',
        ledgerAmount: null,
        ledgerDifference: null,
      };

    case TaxType.BPJS:
      return {
        amount: round2(figures.bpjsByMonth[month]),
        dpp: round2(figures.payrollGrossByMonth[month]),
        outputTax: 0,
        inputTax: 0,
        overpayment: 0,
        transactionCount: figures.payrollCountByMonth[month],
        note: 'Iuran BPJS karyawan + perusahaan dari slip gaji.',
        ledgerAmount: null,
        ledgerDifference: null,
      };

    case TaxType.PPH_23:
    case TaxType.PPH_4_2:
    case TaxType.PPH_26:
    case TaxType.OTHER: {
      const amount = figures.withholdingByType[taxType]?.[month] ?? 0;
      return {
        amount: round2(amount),
        dpp: round2(figures.withholdingDppByType[taxType]?.[month] ?? 0),
        outputTax: 0,
        inputTax: 0,
        overpayment: 0,
        transactionCount: figures.withholdingCountByType[taxType]?.[month] ?? 0,
        note:
          amount > 0
            ? 'Dari daftar bukti potong yang diinput pada modul ini.'
            : 'Belum ada bukti potong pada masa ini.',
        ledgerAmount: null,
        ledgerDifference: null,
      };
    }

    default:
      return {
        amount: 0,
        dpp: 0,
        outputTax: 0,
        inputTax: 0,
        overpayment: 0,
        transactionCount: 0,
        note: '',
        ledgerAmount: null,
        ledgerDifference: null,
      };
  }
}

function activeTypes(enablePpn: boolean): TaxType[] {
  return ACTIVE_TAX_TYPES.filter((t) => (t === TaxType.PPN ? enablePpn : true));
}

/**
 * Buat baris masa pajak untuk satu tahun. Idempoten: baris yang sudah ada tidak
 * diubah (kecuali tenggat yang masih kosong). Aman dipanggil setiap kali
 * halaman dibuka.
 */
export async function ensurePeriodsForYear(
  workspaceId: string,
  year: number,
  setting: TaxSettingView
): Promise<number> {
  const types = activeTypes(setting.enablePpn);
  const rows: Prisma.TaxPeriodCreateManyInput[] = [];

  for (const taxType of types) {
    for (let month = 1; month <= 12; month += 1) {
      const range = monthRange(year, month);
      const due = getMonthlyDueDates(taxType, year, month);
      rows.push({
        workspaceId,
        taxType,
        year,
        month,
        startDate: range.startDate,
        endDate: range.endDate,
        dueDatePayment: due.payment ?? null,
        dueDateFiling: due.filing ?? null,
        status: TaxPeriodStatus.OPEN,
      });
    }
  }

  if (rows.length === 0) return 0;
  const result = await prisma.taxPeriod.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

/* ─────────────────────────── Kalender ─────────────────────────── */

export function computeDeadlineStatus(
  dueDate: Date,
  stored: ComplianceStatus,
  now: Date = new Date()
): ComplianceStatus {
  if (stored === ComplianceStatus.DONE || stored === ComplianceStatus.SKIPPED) return stored;
  const days = daysUntil(dueDate, now);
  if (days < 0) return ComplianceStatus.OVERDUE;
  if (days <= 7) return ComplianceStatus.DUE_SOON;
  return ComplianceStatus.UPCOMING;
}

export interface DeadlineView {
  id: string;
  title: string;
  description: string | null;
  category: string;
  taxType: TaxType | null;
  dueDate: string;
  dueDateKey: string;
  recommendedDate: string;
  daysUntil: number;
  status: ComplianceStatus;
  storedStatus: ComplianceStatus;
  source: ComplianceSource;
  templateKey: string | null;
  kind: 'PAYMENT' | 'FILING' | 'OTHER';
  legalBasis: string | null;
  reminderDays: number[];
  isActive: boolean;
  taxPeriodId: string | null;
  completedAt: string | null;
  notes: string | null;
}

export function toDeadlineView(
  row: {
    id: string;
    title: string;
    description: string | null;
    category: string;
    taxType: TaxType | null;
    dueDate: Date;
    recurrence: string;
    source: ComplianceSource;
    status: ComplianceStatus;
    templateKey: string | null;
    taxPeriodId: string | null;
    reminderDays: number[];
    completedAt: Date | null;
    isActive: boolean;
  },
  now: Date = new Date()
): DeadlineView {
  const status = computeDeadlineStatus(row.dueDate, row.status, now);
  const kind = row.templateKey?.endsWith(':pay')
    ? 'PAYMENT'
    : row.templateKey?.endsWith(':file')
      ? 'FILING'
      : 'OTHER';
  const recommended = nextBusinessDay(row.dueDate);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    taxType: row.taxType,
    dueDate: row.dueDate.toISOString(),
    dueDateKey: dateKey(row.dueDate),
    recommendedDate: recommended.toISOString(),
    daysUntil: daysUntil(row.dueDate, now),
    status,
    storedStatus: row.status,
    source: row.source,
    templateKey: row.templateKey,
    kind,
    legalBasis: null,
    reminderDays: row.reminderDays,
    isActive: row.isActive,
    taxPeriodId: row.taxPeriodId,
    completedAt: row.completedAt?.toISOString() ?? null,
    notes: row.description,
  };
}

/** Generate tenggat template untuk satu tahun. Idempoten per (templateKey, dueDate). */
export async function ensureDeadlinesForYear(
  workspaceId: string,
  year: number,
  setting: TaxSettingView
): Promise<number> {
  const generated = generateDeadlinesForYear(year, { enablePpn: setting.enablePpn });
  if (generated.length === 0) return 0;

  const range = yearRange(year);
  const existing = await prisma.complianceDeadline.findMany({
    where: {
      workspaceId,
      source: ComplianceSource.TEMPLATE,
      dueDate: { gte: range.startDate, lte: range.endDate },
    },
    select: { templateKey: true, dueDate: true },
  });
  const existingKeys = new Set(existing.map((e) => `${e.templateKey}|${dateKey(e.dueDate)}`));

  const missing = generated.filter((g) => !existingKeys.has(`${g.templateKey}|${dateKey(g.dueDate)}`));
  if (missing.length === 0) return 0;

  // Tautkan ke masa pajak yang sesuai (kalau sudah dibuat).
  const periods = await prisma.taxPeriod.findMany({
    where: { workspaceId, year: { in: [year - 1, year] } },
    select: { id: true, taxType: true, year: true, month: true },
  });
  const periodMap = new Map(periods.map((p) => [`${p.taxType}|${p.year}|${p.month}`, p.id]));

  const rows: Prisma.ComplianceDeadlineCreateManyInput[] = missing.map((g) => ({
    workspaceId,
    title: g.title,
    description: `${g.description} Dasar: ${g.legalBasis}.`,
    category: g.category,
    taxType: g.taxType ?? null,
    dueDate: g.dueDate,
    recurrence: g.recurrence,
    source: ComplianceSource.TEMPLATE,
    status: ComplianceStatus.UPCOMING,
    templateKey: g.templateKey,
    taxPeriodId: g.taxType
      ? periodMap.get(`${g.taxType}|${g.periodYear}|${g.periodMonth}`) ?? null
      : null,
    reminderDays: g.reminderDays,
    isActive: true,
  }));

  const result = await prisma.complianceDeadline.createMany({ data: rows });
  return result.count;
}

/* ─────────────────────────── Overview ─────────────────────────── */

export interface PeriodWithAmount {
  id: string;
  taxType: TaxType;
  year: number;
  month: number;
  status: TaxPeriodStatus;
  dueDatePayment: string | null;
  dueDateFiling: string | null;
  paymentRef: string | null;
  filingRef: string | null;
  filedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  amount: PeriodAmount;
}

export async function buildOverview(workspaceId: string, year: number, month: number) {
  const { setting } = await getTaxSetting(workspaceId);
  const [createdPeriods, createdDeadlines] = await Promise.all([
    ensurePeriodsForYear(workspaceId, year, setting),
    ensureDeadlinesForYear(workspaceId, year, setting),
  ]);

  const [figures, periods, deadlines] = await Promise.all([
    getYearFigures(workspaceId, year),
    prisma.taxPeriod.findMany({
      where: { workspaceId, year },
      orderBy: [{ month: 'asc' }, { taxType: 'asc' }],
    }),
    prisma.complianceDeadline.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  const mapped: PeriodWithAmount[] = periods.map((p) => ({
    id: p.id,
    taxType: p.taxType,
    year: p.year,
    month: p.month,
    status: p.status,
    dueDatePayment: p.dueDatePayment?.toISOString() ?? null,
    dueDateFiling: p.dueDateFiling?.toISOString() ?? null,
    paymentRef: p.paymentRef,
    filingRef: p.filingRef,
    filedAt: p.filedAt?.toISOString() ?? null,
    paidAt: p.paidAt?.toISOString() ?? null,
    notes: p.notes,
    amount: computePeriodAmount(p.taxType, p.year, p.month, figures, setting),
  }));

  const now = new Date();
  const deadlineViews = deadlines.map((d) => toDeadlineView(d, now));
  const activeDeadlines = deadlineViews.filter(
    (d) => d.status !== ComplianceStatus.DONE && d.status !== ComplianceStatus.SKIPPED
  );

  const current = mapped.filter((p) => p.month === month);
  const totalPayable = round2(current.reduce((acc, p) => acc + p.amount.amount, 0));
  const dueSoon = activeDeadlines.filter((d) => d.status === ComplianceStatus.DUE_SOON);
  const overdue = activeDeadlines.filter((d) => d.status === ComplianceStatus.OVERDUE);
  const dueThisMonth = activeDeadlines.filter((d) => {
    const p = wibParts(new Date(d.dueDate));
    return p.year === year && p.month === month;
  });

  // Kelengkapan dokumen dihitung untuk masa pajak bulan berjalan saja agar
  // overview tetap ringan.
  const compliance = await Promise.all(
    current.map(async (p) => ({
      periodId: p.id,
      ...(await buildComplianceReport(workspaceId, p.id, { setting, figures })),
    }))
  );
  const missingDocuments = compliance.reduce((acc, c) => acc + c.missing.length, 0);
  const criticalMissing = compliance.reduce(
    (acc, c) => acc + c.missing.filter((m) => m.critical).length,
    0
  );

  const alerts: Array<{ level: 'critical' | 'warning' | 'info'; title: string; message: string }> = [];
  if (overdue.length > 0) {
    alerts.push({
      level: 'critical',
      title: `${overdue.length} tenggat sudah lewat`,
      message: overdue
        .slice(0, 3)
        .map((d) => d.title)
        .join(', '),
    });
  }
  if (dueSoon.length > 0) {
    alerts.push({
      level: 'warning',
      title: `${dueSoon.length} tenggat dalam 7 hari`,
      message: dueSoon
        .slice(0, 3)
        .map((d) => `${d.title} (${Math.max(0, d.daysUntil)} hari)`)
        .join(', '),
    });
  }
  if (criticalMissing > 0) {
    alerts.push({
      level: 'critical',
      title: `${criticalMissing} dokumen kritikal belum lengkap`,
      message: 'Lengkapi bukti setor/lapor sebelum menandai masa pajak selesai.',
    });
  }
  if (alerts.length === 0) {
    alerts.push({
      level: 'info',
      title: 'Administrasi pajak bulan ini terkendali',
      message: 'Tidak ada tenggat lewat atau dokumen kritikal yang kurang.',
    });
  }

  return {
    setting,
    year,
    month,
    createdPeriods,
    createdDeadlines,
    periods: mapped,
    currentMonthPeriods: current,
    deadlines: activeDeadlines.slice(0, 40),
    allDeadlines: deadlineViews,
    summary: {
      totalPayable,
      dueThisMonth: dueThisMonth.length,
      dueSoon: dueSoon.length,
      overdue: overdue.length,
      missingDocuments,
      criticalMissing,
      filedCount: current.filter((p) => p.status === TaxPeriodStatus.FILED || p.status === TaxPeriodStatus.PAID).length,
      paidCount: current.filter((p) => p.status === TaxPeriodStatus.PAID).length,
      periodCount: current.length,
      compliancePct: compliance.length
        ? round2(compliance.reduce((acc, c) => acc + c.completenessPct, 0) / compliance.length)
        : 100,
    },
    alerts,
  };
}

/* ─────────────────────────── Compliance ─────────────────────────── */

export interface ComplianceItem {
  key: string;
  docType: TaxDocType;
  label: string;
  required: boolean;
  critical: boolean;
  sourceType: string | null;
  sourceId: string | null;
  reference: string;
  amount: number;
  present: boolean;
  documentId: string | null;
  note: string | null;
}

export interface ComplianceReport {
  period: {
    id: string;
    taxType: TaxType;
    year: number;
    month: number;
    status: TaxPeriodStatus;
  } | null;
  items: ComplianceItem[];
  missing: ComplianceItem[];
  documents: Array<{
    id: string;
    docType: TaxDocType;
    status: string;
    docNumber: string | null;
    fileName: string | null;
    fileId: string | null;
    amount: number | null;
    sourceType: string | null;
    sourceId: string | null;
    createdAt: string;
  }>;
  completenessPct: number;
  requiredCount: number;
  presentCount: number;
}

const EMPTY_COMPLIANCE: ComplianceReport = {
  period: null,
  items: [],
  missing: [],
  documents: [],
  completenessPct: 100,
  requiredCount: 0,
  presentCount: 0,
};

function selectCoveringDocument(
  docs: ComplianceReport['documents'],
  docType: TaxDocType,
  sourceType: string | null,
  sourceId: string | null
): ComplianceReport['documents'][number] | null {
  // Dokumen tanpa source dianggap berlaku umum untuk seluruh masa pajak.
  const general = docs.find((d) => d.docType === docType && !d.sourceId);
  if (general) return general;
  if (!sourceType || !sourceId) return null;
  return (
    docs.find(
      (d) => d.docType === docType && d.sourceType === sourceType && d.sourceId === sourceId
    ) ?? null
  );
}

export async function buildComplianceReport(
  workspaceId: string,
  periodId: string,
  preloaded?: { setting?: TaxSettingView; figures?: YearFigures }
): Promise<ComplianceReport> {
  const period = await prisma.taxPeriod.findFirst({
    where: { id: periodId, workspaceId },
  });
  if (!period) return EMPTY_COMPLIANCE;

  const setting = preloaded?.setting ?? (await getTaxSetting(workspaceId)).setting;
  const figures = preloaded?.figures ?? (await getYearFigures(workspaceId, period.year));
  const amount = computePeriodAmount(period.taxType, period.year, period.month, figures, setting);
  const range = monthRange(period.year, period.month);

  const documentsRaw = await prisma.taxDocument.findMany({
    where: { workspaceId, taxPeriodId: period.id },
    orderBy: { createdAt: 'desc' },
  });
  const documents: ComplianceReport['documents'] = documentsRaw.map((d) => ({
    id: d.id,
    docType: d.docType,
    status: d.status,
    docNumber: d.docNumber,
    fileName: d.fileName,
    fileId: d.fileId,
    amount: d.amount === null ? null : toNum(d.amount),
    sourceType: d.sourceType,
    sourceId: d.sourceId,
    createdAt: d.createdAt.toISOString(),
  }));

  const items: ComplianceItem[] = [];

  if (period.taxType === TaxType.PPN) {
    const invoices = await prisma.invoice.findMany({
      where: {
        workspaceId,
        issueDate: { gte: range.startDate, lte: range.endDate },
        status: { not: InvoiceStatus.CANCELLED },
        taxAmount: { gt: 0 },
      },
      select: { id: true, invoiceNumber: true, clientName: true, taxAmount: true },
      take: 300,
      orderBy: { issueDate: 'asc' },
    });
    for (const inv of invoices) {
      items.push({
        key: `faktur:${inv.id}`,
        docType: TaxDocType.TAX_INVOICE,
        label: TAX_DOC_LABEL.TAX_INVOICE,
        required: true,
        critical: false,
        sourceType: 'INVOICE',
        sourceId: inv.id,
        reference: `${inv.invoiceNumber} — ${inv.clientName}`,
        amount: toNum(inv.taxAmount),
        present: false,
        documentId: null,
        note: 'Unggah faktur pajak/e-Faktur untuk invoice ini.',
      });
    }
  }

  if (period.taxType === TaxType.PPH_21) {
    const payrolls = await prisma.employeePayroll.findMany({
      where: { workspaceId },
      select: { id: true, employeeName: true, monthYear: true, pph21: true },
    });
    for (const p of payrolls) {
      const parsed = parsePeriodMonth(p.monthYear);
      if (!parsed || parsed.year !== period.year || parsed.month !== period.month) continue;
      if (toNum(p.pph21) <= 0) continue;
      items.push({
        key: `payroll:${p.id}`,
        docType: TaxDocType.WITHHOLDING_SLIP,
        label: TAX_DOC_LABEL.WITHHOLDING_SLIP,
        required: true,
        critical: false,
        sourceType: 'PAYROLL',
        sourceId: p.id,
        reference: `${p.employeeName} — ${p.monthYear}`,
        amount: toNum(p.pph21),
        present: false,
        documentId: null,
        note: 'Unggah bukti potong PPh 21 pegawai.',
      });
      if (items.length >= 300) break;
    }
  }

  if (
    period.taxType === TaxType.PPH_23 ||
    period.taxType === TaxType.PPH_4_2 ||
    period.taxType === TaxType.PPH_26
  ) {
    const rows = await prisma.taxWithholding.findMany({
      where: {
        workspaceId,
        taxType: period.taxType,
        periodYear: period.year,
        periodMonth: period.month,
      },
      take: 300,
    });
    for (const w of rows) {
      items.push({
        key: `withholding:${w.id}`,
        docType: TaxDocType.WITHHOLDING_SLIP,
        label: TAX_DOC_LABEL.WITHHOLDING_SLIP,
        required: true,
        critical: false,
        sourceType: 'WITHHOLDING',
        sourceId: w.id,
        reference: `${w.partnerName ?? 'Tanpa nama'} — ${w.docNumber ?? 'tanpa nomor'}`,
        amount: toNum(w.taxAmount),
        present: false,
        documentId: null,
        note: 'Unggah bukti potong yang sudah diterbitkan.',
      });
    }
  }

  // Bukti setor & bukti lapor berlaku untuk semua jenis pajak.
  if (amount.amount > 0 || period.status === TaxPeriodStatus.PAID) {
    items.push({
      key: 'payment-proof',
      docType: TaxDocType.PAYMENT_PROOF,
      label: TAX_DOC_LABEL.PAYMENT_PROOF,
      required: true,
      critical: period.status === TaxPeriodStatus.PAID,
      sourceType: null,
      sourceId: null,
      reference: `Setoran ${TAX_TYPE_LABEL[period.taxType]} ${monthKey(period.year, period.month)}`,
      amount: amount.amount,
      present: false,
      documentId: null,
      note: 'Unggah bukti setor/NTPN setelah pembayaran.',
    });
  }
  if (period.status === TaxPeriodStatus.FILED || period.status === TaxPeriodStatus.PAID) {
    items.push({
      key: 'filing-receipt',
      docType: TaxDocType.FILING_RECEIPT,
      label: TAX_DOC_LABEL.FILING_RECEIPT,
      required: true,
      critical: true,
      sourceType: null,
      sourceId: null,
      reference: `SPT ${TAX_TYPE_LABEL[period.taxType]} ${monthKey(period.year, period.month)}`,
      amount: 0,
      present: false,
      documentId: null,
      note: 'Unggah bukti lapor SPT (BPE).',
    });
  }

  for (const item of items) {
    const covering = selectCoveringDocument(documents, item.docType, item.sourceType, item.sourceId);
    if (covering) {
      item.present = true;
      item.documentId = covering.id;
    }
  }

  const requiredItems = items.filter((i) => i.required);
  const missing = requiredItems.filter((i) => !i.present);
  const presentCount = requiredItems.length - missing.length;
  const completenessPct = requiredItems.length
    ? round2((presentCount / requiredItems.length) * 100)
    : 100;

  return {
    period: {
      id: period.id,
      taxType: period.taxType,
      year: period.year,
      month: period.month,
      status: period.status,
    },
    items,
    missing,
    documents,
    completenessPct,
    requiredCount: requiredItems.length,
    presentCount,
  };
}

/* ─────────────────────────── Rekap ─────────────────────────── */

export interface RecapRow {
  date: string;
  monthKey: string;
  sourceType: string;
  sourceId: string;
  reference: string;
  partner: string;
  category: string;
  description: string;
  dpp: number;
  rate: number;
  taxAmount: number;
  direction: 'OUTPUT' | 'INPUT' | 'WITHHOLDING' | 'PAYABLE';
}

export interface RecapGroup {
  key: string;
  label: string;
  dpp: number;
  taxAmount: number;
  count: number;
}

export interface RecapResult {
  taxType: TaxType;
  label: string;
  startDate: string;
  endDate: string;
  rows: RecapRow[];
  groups: RecapGroup[];
  totals: { dpp: number; taxAmount: number; count: number };
  note: string;
}

function monthLabel(year: number, month: number): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
  ];
  return `${months[month - 1]} ${year}`;
}

function groupRecap(rows: RecapRow[], groupBy: 'category' | 'source' | 'month'): RecapGroup[] {
  const map = new Map<string, RecapGroup>();
  for (const row of rows) {
    const key =
      groupBy === 'category' ? row.category : groupBy === 'source' ? row.sourceType : row.monthKey;
    const label =
      groupBy === 'source'
        ? row.sourceType === 'INVOICE'
          ? 'Faktur penjualan'
          : row.sourceType === 'CASH_TX'
            ? 'Transaksi kas'
            : row.sourceType === 'PAYROLL'
              ? 'Payroll'
              : row.sourceType === 'WITHHOLDING'
                ? 'Bukti potong'
                : row.sourceType
        : key;
    const group = map.get(key) ?? { key, label, dpp: 0, taxAmount: 0, count: 0 };
    group.dpp = round2(group.dpp + row.dpp);
    group.taxAmount = round2(group.taxAmount + row.taxAmount);
    group.count += 1;
    map.set(key, group);
  }
  return Array.from(map.values()).sort((a, b) => b.taxAmount - a.taxAmount);
}

export async function buildRecap(params: {
  workspaceId: string;
  taxType: TaxType;
  startDate: Date;
  endDate: Date;
  groupBy?: 'category' | 'source' | 'month';
}): Promise<RecapResult> {
  const { workspaceId, taxType, startDate, endDate, groupBy = 'category' } = params;
  const { setting } = await getTaxSetting(workspaceId);
  const rows: RecapRow[] = [];
  let note = '';

  if (taxType === TaxType.PPN) {
    const [invoices, expenses] = await Promise.all([
      prisma.invoice.findMany({
        where: {
          workspaceId,
          issueDate: { gte: startDate, lte: endDate },
          status: { not: InvoiceStatus.CANCELLED },
          taxAmount: { gt: 0 },
        },
        orderBy: { issueDate: 'asc' },
        take: 2000,
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          issueDate: true,
          subtotal: true,
          dpp: true,
          taxRate: true,
          taxAmount: true,
          taxType: true,
        },
      }),
      prisma.cashTransaction.findMany({
        where: {
          workspaceId,
          type: TransactionType.EXPENSE,
          transactionDate: { gte: startDate, lte: endDate },
          taxType: TaxType.PPN,
          taxAmount: { gt: 0 },
        },
        orderBy: { transactionDate: 'asc' },
        take: 2000,
        select: {
          id: true,
          description: true,
          category: true,
          transactionDate: true,
          amount: true,
          dpp: true,
          taxRate: true,
          taxAmount: true,
        },
      }),
    ]);

    for (const inv of invoices) {
      if (inv.taxType && inv.taxType !== TaxType.PPN) continue;
      const p = wibParts(inv.issueDate);
      rows.push({
        date: inv.issueDate.toISOString(),
        monthKey: monthKey(p.year, p.month),
        sourceType: 'INVOICE',
        sourceId: inv.id,
        reference: inv.invoiceNumber,
        partner: inv.clientName,
        category: 'Penjualan',
        description: `Faktur ${inv.invoiceNumber}`,
        dpp: toNum(inv.dpp ?? inv.subtotal),
        rate: toNum(inv.taxRate),
        taxAmount: toNum(inv.taxAmount),
        direction: 'OUTPUT',
      });
    }
    for (const tx of expenses) {
      const p = wibParts(tx.transactionDate);
      rows.push({
        date: tx.transactionDate.toISOString(),
        monthKey: monthKey(p.year, p.month),
        sourceType: 'CASH_TX',
        sourceId: tx.id,
        reference: tx.description.slice(0, 60),
        partner: '—',
        category: tx.category,
        description: tx.description,
        dpp: toNum(tx.dpp ?? tx.amount),
        rate: toNum(tx.taxRate),
        taxAmount: toNum(tx.taxAmount),
        direction: 'INPUT',
      });
    }
    note = 'PPN Keluaran dari faktur penjualan; PPN Masukan dari transaksi beban yang diberi tanda PPN.';
  } else if (taxType === TaxType.PPH_FINAL_UMKM) {
    const incomes = await prisma.cashTransaction.findMany({
      where: {
        workspaceId,
        type: TransactionType.INCOME,
        transactionDate: { gte: startDate, lte: endDate },
      },
      orderBy: { transactionDate: 'asc' },
      take: 5000,
      select: { id: true, transactionDate: true, amount: true, category: true, description: true },
    });

    const byMonth = new Map<string, { dpp: number; count: number; year: number; month: number }>();
    for (const tx of incomes) {
      const p = wibParts(tx.transactionDate);
      const key = monthKey(p.year, p.month);
      const entry = byMonth.get(key) ?? { dpp: 0, count: 0, year: p.year, month: p.month };
      entry.dpp = round2(entry.dpp + toNum(tx.amount));
      entry.count += 1;
      byMonth.set(key, entry);
    }

    // Hitung PPh Final per bulan dengan ambang tahunan yang benar.
    const sorted = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b));
    let runningYtd = 0;
    let runningYear = 0;
    for (const [key, entry] of sorted) {
      if (entry.year !== runningYear) {
        runningYtd = 0;
        runningYear = entry.year;
      }
      const calc = computePphFinalMonthly({
        monthlyRevenue: entry.dpp,
        ytdRevenueBefore: runningYtd,
        threshold: setting.umkmThreshold,
        ratePct: setting.pphFinalRate,
        isOrangPribadi: setting.entityType === 'ORANG_PRIBADI',
      });
      runningYtd = calc.ytdRevenueAfter;
      rows.push({
        date: dateAtWibMidnight(entry.year, entry.month, 1).toISOString(),
        monthKey: key,
        sourceType: 'CASH_TX',
        sourceId: '',
        reference: `Masa ${monthLabel(entry.year, entry.month)}`,
        partner: '—',
        category: 'Peredaran bruto',
        description: `${entry.count} transaksi pemasukan`,
        dpp: entry.dpp,
        rate: setting.pphFinalRate,
        taxAmount: calc.taxAmount,
        direction: 'PAYABLE',
      });
    }
    note = 'Dihitung dari transaksi kas masuk per bulan; ambang Rp 500 juta diterapkan kumulatif per tahun.';
  } else if (taxType === TaxType.PPH_21 || taxType === TaxType.BPJS) {
    const payrolls = await prisma.employeePayroll.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
      take: 5000,
      select: {
        id: true,
        employeeName: true,
        role: true,
        monthYear: true,
        basicSalary: true,
        allowance: true,
        overtime: true,
        pph21: true,
        bpjsEmployee: true,
        bpjsEmployer: true,
      },
    });
    for (const p of payrolls) {
      const parsed = parsePeriodMonth(p.monthYear);
      if (!parsed) continue;
      const start = dateAtWibMidnight(parsed.year, parsed.month, 1);
      if (start < startDate || start > endDate) continue;
      const gross = toNum(p.basicSalary) + toNum(p.allowance) + toNum(p.overtime);
      const amount =
        taxType === TaxType.PPH_21
          ? toNum(p.pph21)
          : toNum(p.bpjsEmployee) + toNum(p.bpjsEmployer);
      if (amount <= 0) continue;
      rows.push({
        date: start.toISOString(),
        monthKey: monthKey(parsed.year, parsed.month),
        sourceType: 'PAYROLL',
        sourceId: p.id,
        reference: p.employeeName,
        partner: p.role,
        category: taxType === TaxType.PPH_21 ? 'PPh 21 pegawai' : 'Iuran BPJS',
        description: `Payroll ${p.monthYear}`,
        dpp: gross,
        rate: 0,
        taxAmount: amount,
        direction: 'WITHHOLDING',
      });
    }
    note =
      taxType === TaxType.PPH_21
        ? 'Diambil dari kolom PPh 21 slip gaji (input manual, bukan hitung otomatis).'
        : 'Iuran BPJS karyawan + perusahaan dari slip gaji.';
  } else {
    const rowsRaw = await prisma.taxWithholding.findMany({
      where: {
        workspaceId,
        taxType,
        periodYear: { gte: startDate.getUTCFullYear() - 1 },
        periodMonth: { gte: 1 },
      },
      orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }],
      take: 5000,
    });
    for (const w of rowsRaw) {
      const start = dateAtWibMidnight(w.periodYear, w.periodMonth, 1);
      if (start < startDate || start > endDate) continue;
      rows.push({
        date: start.toISOString(),
        monthKey: monthKey(w.periodYear, w.periodMonth),
        sourceType: 'WITHHOLDING',
        sourceId: w.id,
        reference: w.docNumber ?? w.partnerName ?? 'Bukti potong',
        partner: w.partnerName ?? '—',
        category: w.partnerName ? 'Pihak dipotong' : 'Potongan manual',
        description: w.notes ?? `Bukti potong ${TAX_TYPE_LABEL[taxType]}`,
        dpp: toNum(w.dpp),
        rate: toNum(w.rate),
        taxAmount: toNum(w.taxAmount),
        direction: 'WITHHOLDING',
      });
    }
    note = 'Berasal dari daftar bukti potong yang diinput manual atau diimpor.';
  }

  const groups = groupRecap(rows, groupBy);
  const totals = rows.reduce(
    (acc, row) => ({
      dpp: round2(acc.dpp + row.dpp),
      taxAmount: round2(acc.taxAmount + row.taxAmount),
      count: acc.count + 1,
    }),
    { dpp: 0, taxAmount: 0, count: 0 }
  );

  return {
    taxType,
    label: TAX_TYPE_LABEL[taxType],
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    rows,
    groups,
    totals,
    note,
  };
}

/* ─────────────────────────── Status masa pajak ─────────────────────────── */

const STATUS_FLOW: Record<TaxPeriodStatus, TaxPeriodStatus[]> = {
  OPEN: [TaxPeriodStatus.READY, TaxPeriodStatus.FILED, TaxPeriodStatus.PAID, TaxPeriodStatus.CLOSED],
  READY: [TaxPeriodStatus.FILED, TaxPeriodStatus.PAID, TaxPeriodStatus.OPEN],
  FILED: [TaxPeriodStatus.PAID, TaxPeriodStatus.READY],
  PAID: [TaxPeriodStatus.FILED, TaxPeriodStatus.CLOSED],
  CLOSED: [TaxPeriodStatus.OPEN],
};

export function canTransition(from: TaxPeriodStatus, to: TaxPeriodStatus): boolean {
  if (from === to) return true;
  return STATUS_FLOW[from]?.includes(to) ?? false;
}

export async function updatePeriodStatus(params: {
  workspaceId: string;
  periodId: string;
  userId: string;
  status?: TaxPeriodStatus;
  paymentRef?: string | null;
  filingRef?: string | null;
  notes?: string | null;
  paidAt?: Date | null;
  filedAt?: Date | null;
  snapshot?: Prisma.InputJsonValue;
}): Promise<{ ok: true; period: unknown } | { ok: false; error: string }> {
  const period = await prisma.taxPeriod.findFirst({
    where: { id: params.periodId, workspaceId: params.workspaceId },
  });
  if (!period) return { ok: false, error: 'Masa pajak tidak ditemukan.' };

  const data: Prisma.TaxPeriodUpdateInput = {};

  if (params.status && params.status !== period.status) {
    if (!canTransition(period.status, params.status)) {
      return {
        ok: false,
        error: `Status tidak bisa diubah dari ${period.status} ke ${params.status}.`,
      };
    }
    data.status = params.status;
    if (params.status === TaxPeriodStatus.PAID && !period.paidAt) {
      data.paidAt = params.paidAt ?? new Date();
      data.paidBy = params.userId;
    }
    if (params.status === TaxPeriodStatus.FILED && !period.filedAt) {
      data.filedAt = params.filedAt ?? new Date();
      data.filedBy = params.userId;
    }
  }

  if (params.paymentRef !== undefined) data.paymentRef = params.paymentRef;
  if (params.filingRef !== undefined) data.filingRef = params.filingRef;
  if (params.notes !== undefined) data.notes = params.notes;
  if (params.paidAt !== undefined) data.paidAt = params.paidAt;
  if (params.filedAt !== undefined) data.filedAt = params.filedAt;
  if (params.snapshot !== undefined) data.snapshot = params.snapshot;

  const updated = await prisma.taxPeriod.update({ where: { id: period.id }, data });
  return { ok: true, period: updated };
}

/* ─────────────────────────── Withholding ─────────────────────────── */

export const WITHHOLDING_TYPES: TaxType[] = [
  TaxType.PPH_21,
  TaxType.PPH_23,
  TaxType.PPH_4_2,
  TaxType.PPH_26,
];

export interface WithholdingInput {
  taxType: TaxType;
  sourceType?: string;
  sourceId?: string | null;
  partnerId?: string | null;
  partnerName?: string | null;
  partnerNpwp?: string | null;
  dpp: number;
  rate: number;
  taxAmount?: number;
  periodYear: number;
  periodMonth: number;
  docNumber?: string | null;
  notes?: string | null;
}

export async function createOrUpdateWithholding(
  workspaceId: string,
  userId: string,
  input: WithholdingInput
) {
  const taxAmount =
    input.taxAmount !== undefined
      ? round2(input.taxAmount)
      : round2((toNum(input.dpp) * toNum(input.rate)) / 100);

  const period = await prisma.taxPeriod.findUnique({
    where: {
      workspaceId_taxType_year_month: {
        workspaceId,
        taxType: input.taxType,
        year: input.periodYear,
        month: input.periodMonth,
      },
    },
    select: { id: true },
  });

  const data = {
    taxType: input.taxType,
    sourceType: input.sourceType ?? 'MANUAL',
    sourceId: input.sourceId ?? null,
    partnerId: input.partnerId ?? null,
    partnerName: input.partnerName ?? null,
    partnerNpwp: input.partnerNpwp ?? null,
    dpp: new Prisma.Decimal(toNum(input.dpp)),
    rate: toNum(input.rate),
    taxAmount: new Prisma.Decimal(taxAmount),
    periodYear: input.periodYear,
    periodMonth: input.periodMonth,
    docNumber: input.docNumber ?? null,
    taxPeriodId: period?.id ?? null,
    notes: input.notes ?? null,
  };

  if (input.sourceId) {
    return prisma.taxWithholding.upsert({
      where: {
        workspaceId_sourceType_sourceId_taxType: {
          workspaceId,
          sourceType: data.sourceType,
          sourceId: input.sourceId,
          taxType: data.taxType,
        },
      },
      create: { workspaceId, createdBy: userId, ...data },
      update: data,
    });
  }

  return prisma.taxWithholding.create({
    data: { workspaceId, createdBy: userId, ...data },
  });
}

/* ─────────────────────────── Import CSV ─────────────────────────── */

export interface WithholdingCsvRow {
  taxType: TaxType;
  partnerName: string;
  partnerNpwp: string;
  dpp: number;
  rate: number;
  taxAmount: number;
  periodYear: number;
  periodMonth: number;
  docNumber: string;
  notes: string;
}

export interface CsvParseResult {
  rows: WithholdingCsvRow[];
  errors: Array<{ line: number; message: string }>;
}

const CSV_ALIASES: Record<string, string> = {
  jenis: 'taxType',
  'jenis pajak': 'taxType',
  taxtype: 'taxType',
  nama: 'partnerName',
  'nama pihak': 'partnerName',
  'nama pihak dipotong': 'partnerName',
  npwp: 'partnerNpwp',
  dpp: 'dpp',
  'dasar pengenaan pajak': 'dpp',
  tarif: 'rate',
  rate: 'rate',
  pph: 'taxAmount',
  'nilai potongan': 'taxAmount',
  'jumlah potongan': 'taxAmount',
  tahun: 'periodYear',
  bulan: 'periodMonth',
  periode: 'period',
  'nomor bukti': 'docNumber',
  'no bukti': 'docNumber',
  docnumber: 'docNumber',
  keterangan: 'notes',
  notes: 'notes',
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === ',' || ch === ';') && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function normalizeTaxType(value: string): TaxType | null {
  const text = value.trim().toUpperCase().replace(/[\s.-]/g, '_');
  if (text.includes('23')) return TaxType.PPH_23;
  if (text.includes('4_2') || text.includes('4(2)') || text.includes('FINAL')) return TaxType.PPH_4_2;
  if (text.includes('26')) return TaxType.PPH_26;
  if (text.includes('21')) return TaxType.PPH_21;
  return null;
}

/**
 * Parser CSV sederhana untuk impor bukti potong (format e-Bupot yang
 * disederhanakan). Mendukung pemisah koma atau titik koma, serta header dalam
 * bahasa Indonesia maupun Inggris.
 */
export function parseWithholdingCsv(csv: string): CsvParseResult {
  const errors: Array<{ line: number; message: string }> = [];
  const lines = String(csv ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: [{ line: 1, message: 'CSV kosong atau hanya berisi header.' }] };
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const indexOf = (name: string) => header.findIndex((h) => CSV_ALIASES[h] === name);

  const idxType = indexOf('taxType');
  const idxName = indexOf('partnerName');
  const idxNpwp = indexOf('partnerNpwp');
  const idxDpp = indexOf('dpp');
  const idxRate = indexOf('rate');
  const idxTax = indexOf('taxAmount');
  const idxYear = indexOf('periodYear');
  const idxMonth = indexOf('periodMonth');
  const idxPeriod = indexOf('period');
  const idxDoc = indexOf('docNumber');
  const idxNotes = indexOf('notes');

  if (idxDpp < 0 || idxTax < 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'Kolom DPP dan nilai potongan wajib ada.' }],
    };
  }

  const rows: WithholdingCsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const lineNo = i + 1;

    let taxType = idxType >= 0 ? normalizeTaxType(cells[idxType] ?? '') : null;
    if (!taxType && idxType < 0) taxType = TaxType.PPH_23;
    if (!taxType) {
      errors.push({ line: lineNo, message: 'Jenis pajak tidak dikenali (isi PPh 23 / PPh 4(2) / PPh 26).' });
      continue;
    }

    const dpp = Number((cells[idxDpp] ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    const taxAmount = Number((cells[idxTax] ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'));
    if (!Number.isFinite(dpp) || !Number.isFinite(taxAmount)) {
      errors.push({ line: lineNo, message: 'DPP atau nilai potongan bukan angka.' });
      continue;
    }

    let year = idxYear >= 0 ? Number(cells[idxYear]) : NaN;
    let month = idxMonth >= 0 ? Number(cells[idxMonth]) : NaN;
    if ((!Number.isFinite(year) || !Number.isFinite(month)) && idxPeriod >= 0) {
      const parsed = parsePeriodMonth(cells[idxPeriod]);
      if (parsed) {
        year = parsed.year;
        month = parsed.month;
      }
    }
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      errors.push({ line: lineNo, message: 'Periode (tahun & bulan) tidak valid.' });
      continue;
    }

    const rate =
      idxRate >= 0 && cells[idxRate]
        ? Number((cells[idxRate] ?? '').replace(/[^\d,.-]/g, '').replace(',', '.'))
        : dpp > 0
          ? round2((taxAmount / dpp) * 100)
          : 0;

    rows.push({
      taxType,
      partnerName: idxName >= 0 ? (cells[idxName] ?? '').trim() : '',
      partnerNpwp: idxNpwp >= 0 ? (cells[idxNpwp] ?? '').trim() : '',
      dpp: round2(dpp),
      rate: round2(Number.isFinite(rate) ? rate : 0),
      taxAmount: round2(taxAmount),
      periodYear: year,
      periodMonth: month,
      docNumber: idxDoc >= 0 ? (cells[idxDoc] ?? '').trim() : '',
      notes: idxNotes >= 0 ? (cells[idxNotes] ?? '').trim() : '',
    });
  }

  return { rows, errors };
}
