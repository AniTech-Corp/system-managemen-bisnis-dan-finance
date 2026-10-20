/**
 * Pembayaran sebagian & alokasi dokumen — operasi dalam transaksi DB.
 *
 * Dipakai oleh pintu kas (`/kas/transactions`) dan pelunasan kewajiban
 * (`/kas/obligations`) supaya aturan `paidAmount` + status + alokasi hanya ada
 * di satu tempat. Jurnalnya sendiri tetap dibuat oleh `postCashTransaction`:
 * alokasi hanya menentukan dokumen mana yang berkurang, bukan akunnya.
 */

import { InvoiceStatus, ObligationStatus, Prisma } from '@prisma/client';
import { JournalValidationError } from './journal-service';
import {
  computeRemaining,
  planDocumentSettlement,
  round2,
  SETTLEMENT_EPSILON,
  type SettlementPlan,
} from './settlement';

interface InvoiceRef {
  id: string;
  invoiceNumber: string;
  totalAmount: number | Prisma.Decimal;
  paidAmount: number | Prisma.Decimal;
}

interface ObligationRef {
  id: string;
  name: string;
  amount: number | Prisma.Decimal;
  paidAmount: number | Prisma.Decimal;
}

/** Status faktur setelah pembayaran: PAID / PARTIAL / UNPAID. */
function invoiceStatusFor(total: number, paid: number): InvoiceStatus {
  const remaining = computeRemaining(total, paid);
  if (remaining <= SETTLEMENT_EPSILON) return InvoiceStatus.PAID;
  return paid > SETTLEMENT_EPSILON ? InvoiceStatus.PARTIAL : InvoiceStatus.UNPAID;
}

/** Status kewajiban setelah pembayaran: PAID / PARTIAL / PENDING. */
function obligationStatusFor(total: number, paid: number): ObligationStatus {
  const remaining = computeRemaining(total, paid);
  if (remaining <= SETTLEMENT_EPSILON) return ObligationStatus.PAID;
  return paid > SETTLEMENT_EPSILON ? ObligationStatus.PARTIAL : ObligationStatus.PENDING;
}

/**
 * Alokasikan sebagian/seluruh baris kas ke satu faktur.
 * Melempar `JournalValidationError` bila melebihi sisa atau faktur sudah lunas.
 */
export async function allocateInvoiceInTx(
  tx: Prisma.TransactionClient,
  args: {
    workspaceId: string;
    cashTxId: string;
    invoice: InvoiceRef;
    amount: number;
    transactionDate: Date;
  }
): Promise<SettlementPlan> {
  const plan = planDocumentSettlement({
    total: Number(args.invoice.totalAmount),
    paidAmount: Number(args.invoice.paidAmount),
    amount: args.amount,
    label: `Faktur ${args.invoice.invoiceNumber}`,
  });
  if (!plan.ok) throw new JournalValidationError(plan.error);

  await tx.paymentAllocation.create({
    data: {
      workspaceId: args.workspaceId,
      cashTxId: args.cashTxId,
      invoiceId: args.invoice.id,
      amount: plan.amount,
      transactionDate: args.transactionDate,
    },
  });

  await tx.invoice.update({
    where: { id: args.invoice.id },
    data: {
      paidAmount: plan.newPaid,
      status: plan.newStatus === 'PAID' ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL,
      // Tanggal lunas hanya diisi saat benar-benar lunas.
      paidAt: plan.newStatus === 'PAID' ? args.transactionDate : null,
    },
  });

  return plan;
}

/** Alokasikan sebagian/seluruh baris kas ke satu kewajiban. */
export async function allocateObligationInTx(
  tx: Prisma.TransactionClient,
  args: {
    workspaceId: string;
    cashTxId: string;
    obligation: ObligationRef;
    amount: number;
    transactionDate: Date;
    paymentMethod: string;
  }
): Promise<SettlementPlan> {
  const plan = planDocumentSettlement({
    total: Number(args.obligation.amount),
    paidAmount: Number(args.obligation.paidAmount),
    amount: args.amount,
    label: `Kewajiban ${args.obligation.name}`,
  });
  if (!plan.ok) throw new JournalValidationError(plan.error);

  await tx.paymentAllocation.create({
    data: {
      workspaceId: args.workspaceId,
      cashTxId: args.cashTxId,
      obligationId: args.obligation.id,
      amount: plan.amount,
      transactionDate: args.transactionDate,
    },
  });

  await tx.scheduledObligation.update({
    where: { id: args.obligation.id },
    data: {
      paidAmount: plan.newPaid,
      status: plan.newStatus === 'PAID' ? ObligationStatus.PAID : ObligationStatus.PARTIAL,
      paidAt: args.transactionDate,
      paymentMethod: args.paymentMethod,
    },
  });

  return plan;
}

/**
 * Tarik semua alokasi satu baris kas, lalu kembalikan `paidAmount` & status
 * dokumen. Dipanggil SEBELUM baris kas dihapus (alokasi ikut terhapus lewat
 * cascade), supaya sisa tagihan tidak "hilang" tanpa jejak.
 */
export async function revertAllocationsInTx(
  tx: Prisma.TransactionClient,
  args: { workspaceId: string; cashTxId: string }
): Promise<void> {
  const allocations = await tx.paymentAllocation.findMany({
    where: { workspaceId: args.workspaceId, cashTxId: args.cashTxId },
    select: { invoiceId: true, obligationId: true, amount: true },
  });
  if (allocations.length === 0) return;

  const perInvoice = new Map<string, number>();
  const perObligation = new Map<string, number>();
  for (const allocation of allocations) {
    const amount = Number(allocation.amount);
    if (allocation.invoiceId) {
      perInvoice.set(allocation.invoiceId, round2((perInvoice.get(allocation.invoiceId) ?? 0) + amount));
    }
    if (allocation.obligationId) {
      perObligation.set(
        allocation.obligationId,
        round2((perObligation.get(allocation.obligationId) ?? 0) + amount)
      );
    }
  }

  for (const [invoiceId, sum] of perInvoice) {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, workspaceId: args.workspaceId },
      select: { id: true, totalAmount: true, paidAmount: true },
    });
    if (!invoice) continue;
    const newPaid = round2(Math.max(0, Number(invoice.paidAmount) - sum));
    const status = invoiceStatusFor(Number(invoice.totalAmount), newPaid);
    await tx.invoice.update({
      where: { id: invoiceId },
      data: { paidAmount: newPaid, status, paidAt: status === InvoiceStatus.PAID ? undefined : null },
    });
  }

  for (const [obligationId, sum] of perObligation) {
    const obligation = await tx.scheduledObligation.findFirst({
      where: { id: obligationId, workspaceId: args.workspaceId },
      select: { id: true, amount: true, paidAmount: true },
    });
    if (!obligation) continue;
    const newPaid = round2(Math.max(0, Number(obligation.paidAmount) - sum));
    const status = obligationStatusFor(Number(obligation.amount), newPaid);
    await tx.scheduledObligation.update({
      where: { id: obligationId },
      data: {
        paidAmount: newPaid,
        status,
        paidAt: newPaid > SETTLEMENT_EPSILON ? undefined : null,
        paymentMethod: newPaid > SETTLEMENT_EPSILON ? undefined : null,
      },
    });
  }

  await tx.paymentAllocation.deleteMany({
    where: { workspaceId: args.workspaceId, cashTxId: args.cashTxId },
  });
}
