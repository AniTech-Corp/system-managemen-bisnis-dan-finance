import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { fromLegacyFloat } from './money';
import {
  bucketForDaysOverdue,
  daysOverdue as computeDaysOverdue,
  daysUntilDue,
  dunningLevelFor,
  forecastCashFlow,
  type AgingBucketKey,
  type CashFlowForecast,
  type DunningConfig,
  type DunningLevel,
} from './ar-ap';

/**
 * Layanan AR/AP berbasis DB: jadwal pembayaran vendor, riwayat penagihan,
 * penyeliaan jatuh tempo, dan job penuaan (overdue sweep).
 *
 * Semua perhitungan murni (bucket, dunning, proyeksi) memakai ar-ap.ts; file ini
 * hanya menyambungkannya ke dokumen Invoice (piutang) & ScheduledObligation (utang).
 */

const OUTSTANDING_EPSILON = 0.005;

/** Dokumen AR/AP outstanding + status pembayaran alokasi sampai `asOf`. */
async function paidAllocationsByDoc(
  workspaceId: string,
  asOf: Date
): Promise<{ byInvoice: Map<string, Prisma.Decimal>; byObligation: Map<string, Prisma.Decimal> }> {
  const rows = await prisma.paymentAllocation.groupBy({
    by: ['invoiceId', 'obligationId'],
    where: { workspaceId, transactionDate: { lte: asOf } },
    _sum: { amount: true },
  });
  const byInvoice = new Map<string, Prisma.Decimal>();
  const byObligation = new Map<string, Prisma.Decimal>();
  for (const row of rows) {
    if (row.invoiceId) byInvoice.set(row.invoiceId, new Prisma.Decimal(row._sum.amount ?? 0));
    if (row.obligationId) byObligation.set(row.obligationId, new Prisma.Decimal(row._sum.amount ?? 0));
  }
  return { byInvoice, byObligation };
}

/* ─────────────────────────── Jadwal pembayaran vendor (AP) ─────────────────────────── */

export interface VendorBillRow {
  id: string;
  reference: string;
  name: string;
  billNumber: string | null;
  refNumber: string | null;
  partnerId: string | null;
  partner: string;
  dueDate: Date;
  daysUntilDue: number;
  daysOverdue: number;
  outstanding: Prisma.Decimal;
  bucket: AgingBucketKey;
  dunning: DunningLevel;
}

export interface PaymentSchedule {
  asOf: Date;
  horizonDays: number;
  bills: VendorBillRow[];
  totalPayable: Prisma.Decimal;
  overduePayable: Prisma.Decimal;
  dueWithinHorizon: Prisma.Decimal;
  forecast: CashFlowForecast;
}

/**
 * Jadwal pembayaran vendor: semua tagihan utang yang belum lunas, diurutkan
 * menurut jatuh tempo, dilengkapi proyeksi arus kas (masuk dari piutang, keluar
 * dari utang) sepanjang horizon hari.
 */
export async function getPaymentSchedule(
  workspaceId: string,
  asOf: Date,
  horizonDays = 30,
  dunning?: DunningConfig
): Promise<PaymentSchedule> {
  const [{ byObligation, byInvoice }, obligations, invoices] = await Promise.all([
    paidAllocationsByDoc(workspaceId, asOf),
    prisma.scheduledObligation.findMany({
      where: { workspaceId, status: { in: ['PENDING', 'PARTIAL'] } },
      select: {
        id: true,
        name: true,
        billNumber: true,
        refNumber: true,
        partnerId: true,
        partner: { select: { name: true } },
        dueDate: true,
        amount: true,
      },
      orderBy: { dueDate: 'asc' },
    }),
    prisma.invoice.findMany({
      where: { workspaceId, status: { in: ['UNPAID', 'OVERDUE', 'PARTIAL'] } },
      select: {
        id: true,
        clientName: true,
        partnerId: true,
        dueDate: true,
        totalAmount: true,
      },
      orderBy: { dueDate: 'asc' },
    }),
  ]);

  const bills: VendorBillRow[] = obligations
    .map((ob) => {
      const total = fromLegacyFloat(ob.amount);
      const paid = byObligation.get(ob.id) ?? new Prisma.Decimal(0);
      const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), total.minus(paid)).toDecimalPlaces(2);
      const overdueDays = computeDaysOverdue(ob.dueDate, asOf);
      const signedDays = daysUntilDue(ob.dueDate, asOf);
      return {
        id: ob.id,
        reference: ob.billNumber || ob.name,
        name: ob.name,
        billNumber: ob.billNumber ?? null,
        refNumber: ob.refNumber ?? null,
        partnerId: ob.partnerId ?? null,
        partner: ob.partner?.name ?? ob.name,
        dueDate: ob.dueDate,
        daysUntilDue: signedDays,
        daysOverdue: overdueDays,
        outstanding,
        bucket: bucketForDaysOverdue(overdueDays),
        dunning: dunningLevelFor(signedDays, dunning),
      };
    })
    .filter((b) => b.outstanding.greaterThan(OUTSTANDING_EPSILON));

  const totalPayable = bills.reduce((acc, b) => acc.plus(b.outstanding), new Prisma.Decimal(0));
  const overduePayable = bills
    .filter((b) => b.daysOverdue > 0)
    .reduce((acc, b) => acc.plus(b.outstanding), new Prisma.Decimal(0));
  const dueWithinHorizon = bills
    .filter((b) => b.daysUntilDue >= 0 && b.daysUntilDue <= horizonDays)
    .reduce((acc, b) => acc.plus(b.outstanding), new Prisma.Decimal(0));

  const forecast = forecastCashFlow(
    {
      ar: invoices
        .map((inv) => {
          const total = fromLegacyFloat(inv.totalAmount);
          const paid = byInvoice.get(inv.id) ?? new Prisma.Decimal(0);
          return {
            partner: inv.clientName,
            dueDate: inv.dueDate,
            outstanding: Prisma.Decimal.max(new Prisma.Decimal(0), total.minus(paid)),
          };
        })
        .filter((d) => d.outstanding.greaterThan(OUTSTANDING_EPSILON)),
      ap: bills.map((b) => ({ partner: b.partner, dueDate: b.dueDate, outstanding: b.outstanding })),
    },
    asOf,
    horizonDays
  );

  return { asOf, horizonDays, bills, totalPayable, overduePayable, dueWithinHorizon, forecast };
}

/* ─────────────────────────── Penyeliaan jatuh tempo ─────────────────────────── */

export interface OverdueItem {
  kind: 'AR' | 'AP';
  id: string;
  reference: string;
  partnerId: string | null;
  partner: string;
  dueDate: Date;
  daysOverdue: number;
  outstanding: Prisma.Decimal;
  bucket: AgingBucketKey;
  dunning: DunningLevel;
  lastReminderAt: Date | null;
}

export interface OverdueWatchlist {
  asOf: Date;
  items: OverdueItem[];
  totalReceivableOverdue: Prisma.Decimal;
  totalPayableOverdue: Prisma.Decimal;
  count: number;
}

/** Daftar tagihan yang sudah lewat jatuh tempo (AR & AP), diurut risiko. */
export async function getOverdueWatchlist(
  workspaceId: string,
  asOf: Date,
  dunning?: DunningConfig
): Promise<OverdueWatchlist> {
  const [{ byInvoice, byObligation }, invoices, obligations] = await Promise.all([
    paidAllocationsByDoc(workspaceId, asOf),
    prisma.invoice.findMany({
      where: { workspaceId, status: { in: ['UNPAID', 'OVERDUE', 'PARTIAL'] }, dueDate: { lt: asOf } },
      select: {
        id: true,
        invoiceNumber: true,
        clientName: true,
        partnerId: true,
        partner: { select: { name: true } },
        dueDate: true,
        totalAmount: true,
        lastReminderAt: true,
      },
    }),
    prisma.scheduledObligation.findMany({
      where: { workspaceId, status: { in: ['PENDING', 'PARTIAL'] }, dueDate: { lt: asOf } },
      select: {
        id: true,
        name: true,
        billNumber: true,
        partnerId: true,
        partner: { select: { name: true } },
        dueDate: true,
        amount: true,
        lastReminderAt: true,
      },
    }),
  ]);

  const items: OverdueItem[] = [];

  for (const inv of invoices) {
    const total = fromLegacyFloat(inv.totalAmount);
    const paid = byInvoice.get(inv.id) ?? new Prisma.Decimal(0);
    const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), total.minus(paid)).toDecimalPlaces(2);
    if (outstanding.lessThanOrEqualTo(OUTSTANDING_EPSILON)) continue;
    const overdueDays = computeDaysOverdue(inv.dueDate, asOf);
    items.push({
      kind: 'AR',
      id: inv.id,
      reference: inv.invoiceNumber,
      partnerId: inv.partnerId ?? null,
      partner: inv.partner?.name ?? inv.clientName,
      dueDate: inv.dueDate,
      daysOverdue: overdueDays,
      outstanding,
      bucket: bucketForDaysOverdue(overdueDays),
      dunning: dunningLevelFor(overdueDays, dunning),
      lastReminderAt: inv.lastReminderAt ?? null,
    });
  }

  for (const ob of obligations) {
    const total = fromLegacyFloat(ob.amount);
    const paid = byObligation.get(ob.id) ?? new Prisma.Decimal(0);
    const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), total.minus(paid)).toDecimalPlaces(2);
    if (outstanding.lessThanOrEqualTo(OUTSTANDING_EPSILON)) continue;
    const overdueDays = computeDaysOverdue(ob.dueDate, asOf);
    items.push({
      kind: 'AP',
      id: ob.id,
      reference: ob.billNumber || ob.name,
      partnerId: ob.partnerId ?? null,
      partner: ob.partner?.name ?? ob.name,
      dueDate: ob.dueDate,
      daysOverdue: overdueDays,
      outstanding,
      bucket: bucketForDaysOverdue(overdueDays),
      dunning: dunningLevelFor(overdueDays, dunning),
      lastReminderAt: ob.lastReminderAt ?? null,
    });
  }

  // Urutan risiko: nominal x umur (yang paling besar & paling lama didahulukan).
  items.sort((a, b) => {
    const riskA = Number(a.outstanding) * (a.daysOverdue + 1);
    const riskB = Number(b.outstanding) * (b.daysOverdue + 1);
    return riskB - riskA;
  });

  const totalReceivableOverdue = items
    .filter((i) => i.kind === 'AR')
    .reduce((acc, i) => acc.plus(i.outstanding), new Prisma.Decimal(0));
  const totalPayableOverdue = items
    .filter((i) => i.kind === 'AP')
    .reduce((acc, i) => acc.plus(i.outstanding), new Prisma.Decimal(0));

  return { asOf, items, totalReceivableOverdue, totalPayableOverdue, count: items.length };
}

/* ─────────────────────────── Job penuaan (overdue sweep) ─────────────────────────── */

export interface SweepResult {
  asOf: Date;
  invoicesUpdated: number;
  obligationsUpdated: number;
  markedOverdue: number;
}

/**
 * Hitung ulang snapshot penuaan dokumen: `agingBucket`, `overdueSince`, dan status
 * OVERDUE untuk faktur yang lewat jatuh tempo. Idempoten -- aman dijalankan
 * berkala. Faktur yang tadinya OVERDUE lalu jatuh tempo bergeser mundur (mis.
 * dokumen diedit) dikembalikan ke UNPAID.
 */
export async function sweepOverdue(
  workspaceId: string,
  asOf: Date,
  dunning?: DunningConfig
): Promise<SweepResult> {
  // `dunning` dipertahankan di signature agar job dan endpoint berbagi bentuk
  // konfigurasi penagihan (dipakai watchlist; sweep hanya menulis snapshot umur).
  void dunning;
  const { byInvoice, byObligation } = await paidAllocationsByDoc(workspaceId, asOf);

  const [invoices, obligations] = await Promise.all([
    prisma.invoice.findMany({
      where: { workspaceId, status: { in: ['UNPAID', 'OVERDUE', 'PARTIAL'] } },
      select: { id: true, dueDate: true, totalAmount: true, status: true, overdueSince: true },
    }),
    prisma.scheduledObligation.findMany({
      where: { workspaceId, status: { in: ['PENDING', 'PARTIAL'] } },
      select: { id: true, dueDate: true, amount: true },
    }),
  ]);

  let invoicesUpdated = 0;
  let markedOverdue = 0;

  await prisma.$transaction(async (tx) => {
    for (const inv of invoices) {
      const total = fromLegacyFloat(inv.totalAmount);
      const paid = byInvoice.get(inv.id) ?? new Prisma.Decimal(0);
      const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), total.minus(paid));
      if (outstanding.lessThanOrEqualTo(OUTSTANDING_EPSILON)) continue;

      const overdueDays = computeDaysOverdue(inv.dueDate, asOf);
      const bucket = bucketForDaysOverdue(overdueDays);
      const isOverdue = overdueDays > 0;

      let nextStatus: InvoiceStatus;
      if (inv.status === 'PARTIAL') nextStatus = InvoiceStatus.PARTIAL;
      else nextStatus = isOverdue ? InvoiceStatus.OVERDUE : InvoiceStatus.UNPAID;

      const nextOverdueSince = isOverdue ? inv.overdueSince ?? inv.dueDate : null;

      if (nextStatus === InvoiceStatus.OVERDUE && inv.status !== 'OVERDUE') markedOverdue += 1;

      await tx.invoice.update({
        where: { id: inv.id },
        data: { agingBucket: bucket, overdueSince: nextOverdueSince, status: nextStatus },
      });
      invoicesUpdated += 1;
    }

    for (const ob of obligations) {
      const total = fromLegacyFloat(ob.amount);
      const paid = byObligation.get(ob.id) ?? new Prisma.Decimal(0);
      const outstanding = Prisma.Decimal.max(new Prisma.Decimal(0), total.minus(paid));
      if (outstanding.lessThanOrEqualTo(OUTSTANDING_EPSILON)) continue;

      const overdueDays = computeDaysOverdue(ob.dueDate, asOf);
      await tx.scheduledObligation.update({
        where: { id: ob.id },
        data: {
          agingBucket: bucketForDaysOverdue(overdueDays),
          overdueSince: overdueDays > 0 ? ob.dueDate : null,
        },
      });
    }
  });

  return { asOf, invoicesUpdated, obligationsUpdated: obligations.length, markedOverdue };
}

/* ─────────────────────────── Riwayat penagihan ─────────────────────────── */

export interface CollectionActivityRow {
  id: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  partnerId: string | null;
  partner: string;
  channel: string;
  outcome: string;
  tone: string | null;
  note: string | null;
  amountAtRisk: Prisma.Decimal | null;
  promisedAt: Date | null;
  activityDate: Date;
  createdByUserId: string | null;
}

export async function listCollectionActivities(
  workspaceId: string,
  opts: { partnerId?: string; invoiceId?: string; limit?: number } = {}
): Promise<CollectionActivityRow[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const rows = await prisma.collectionActivity.findMany({
    where: {
      workspaceId,
      ...(opts.partnerId ? { partnerId: opts.partnerId } : {}),
      ...(opts.invoiceId ? { invoiceId: opts.invoiceId } : {}),
    },
    orderBy: { activityDate: 'desc' },
    take: limit,
    select: {
      id: true,
      invoiceId: true,
      partnerId: true,
      channel: true,
      outcome: true,
      tone: true,
      note: true,
      amountAtRisk: true,
      promisedAt: true,
      activityDate: true,
      createdByUserId: true,
      invoice: { select: { invoiceNumber: true, clientName: true } },
      partner: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    invoiceId: row.invoiceId ?? null,
    invoiceNumber: row.invoice?.invoiceNumber ?? null,
    partnerId: row.partnerId ?? null,
    partner: row.partner?.name ?? row.invoice?.clientName ?? '-',
    channel: row.channel,
    outcome: row.outcome,
    tone: row.tone ?? null,
    note: row.note ?? null,
    amountAtRisk: row.amountAtRisk ?? null,
    promisedAt: row.promisedAt ?? null,
    activityDate: row.activityDate,
    createdByUserId: row.createdByUserId ?? null,
  }));
}
