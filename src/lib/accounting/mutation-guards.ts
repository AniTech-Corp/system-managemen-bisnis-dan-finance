import type { Prisma } from '@prisma/client';
import { getJakartaParts, isPeriodWritable, PeriodClosedError } from './period';

/**
 * Guard mutasi dokumen keuangan.
 *
 * Semua penolakan memakai `JournalValidationError`-compatible message supaya
 * route bisa mengembalikan 400 tanpa membocorkan detail internal.
 */
export class MutationGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MutationGuardError';
  }
}

/**
 * Tolak perubahan bila periode fiskal untuk tanggal tersebut sudah CLOSED atau
 * LOCKED. Periode yang belum ada tidak dibuat di sini; posting jurnal akan
 * membuatnya setelah guard lolos.
 */
export async function assertPeriodWritableForDate(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  date: Date,
  label = 'Tanggal transaksi'
): Promise<void> {
  if (Number.isNaN(date.getTime())) {
    throw new MutationGuardError(`${label} tidak valid.`);
  }

  const { year, month } = getJakartaParts(date);
  const period = await tx.fiscalPeriod.findUnique({
    where: { workspaceId_year_month: { workspaceId, year, month } },
    select: { status: true, year: true, month: true },
  });

  if (period && !isPeriodWritable(period.status)) {
    throw new PeriodClosedError(period.status);
  }
}

export interface CashTransactionLinks {
  invoiceId?: string | null;
  obligationId?: string | null;
  payrollId?: string | null;
  settlementAccountId?: string | null;
}

/**
 * Koreksi in-place hanya untuk transaksi kas standalone.
 *
 * Transaksi yang terhubung ke faktur/kewajiban/payroll/akun settlement tidak
 * boleh diubah nominalnya karena akan membuat alokasi pembayaran dan status
 * dokumen sumber tidak konsisten. Untuk transaksi terhubung, koreksi harus
 * lewat pembatalan dokumen induk atau hapus + catat ulang.
 */
export async function assertCashTransactionStandalone(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  transaction: CashTransactionLinks & { id: string }
): Promise<void> {
  if (
    transaction.invoiceId ||
    transaction.obligationId ||
    transaction.payrollId ||
    transaction.settlementAccountId
  ) {
    throw new MutationGuardError(
      'Transaksi ini terhubung ke faktur, kewajiban, payroll, atau akun settlement. ' +
        'Koreksi langsung tidak diizinkan; batalkan dokumen induknya lebih dulu atau catat transaksi baru.'
    );
  }

  const allocation = await tx.paymentAllocation.findFirst({
    where: { workspaceId, cashTxId: transaction.id },
    select: { id: true },
  });
  if (allocation) {
    throw new MutationGuardError(
      'Transaksi ini memiliki alokasi pembayaran. Koreksi langsung tidak diizinkan; tarik alokasinya lebih dulu.'
    );
  }
}

/**
 * Jurnal POSTED yang sudah dibalik tidak boleh dibalik lagi. Dipakai sebelum
 * reversal agar tidak membuat dua jurnal pembalik untuk sumber yang sama.
 */
export async function assertJournalReversible(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  journalId: string
): Promise<void> {
  const journal = await tx.journalEntry.findFirst({
    where: { id: journalId, workspaceId },
    select: { status: true, reversedBy: true },
  });
  if (!journal) throw new MutationGuardError('Jurnal tidak ditemukan.');
  if (journal.status !== 'POSTED') {
    throw new MutationGuardError('Hanya jurnal yang sudah diposting yang bisa dibalik.');
  }
  if (journal.reversedBy) {
    throw new MutationGuardError('Jurnal ini sudah pernah dibalik.');
  }
}
