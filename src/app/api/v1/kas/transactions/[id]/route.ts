import { NextRequest, NextResponse } from 'next/server';
import { JournalSource, JournalStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { getAccountingSetting, postCashTransaction, resolveProjectDimensionInTx } from '@/lib/accounting/posting';
import { JournalValidationError, reverseJournalInTx } from '@/lib/accounting/journal-service';
import { PeriodClosedError } from '@/lib/accounting/period';
import {
  assertCashTransactionStandalone,
  assertPeriodWritableForDate,
  MutationGuardError,
} from '@/lib/accounting/mutation-guards';
import { cashTransactionSnapshot, recordAuditInTx } from '@/lib/audit/audit-trail';

const EDITABLE_FIELDS = [
  'amount',
  'category',
  'description',
  'transactionDate',
  'paymentMethod',
  'division',
  'projectId',
] as const;

function parseDate(raw: unknown, label: string): Date {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new MutationGuardError(`${label} tidak valid.`);
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new MutationGuardError(`${label} tidak valid.`);
  if (date.getFullYear() < 2000) throw new MutationGuardError(`${label} tidak boleh sebelum tahun 2000.`);
  return date;
}

/**
 * PATCH /api/v1/kas/transactions/[id]
 *
 * Koreksi transaksi kas standalone. Alasan wajib diisi; jurnal lama dibalik
 * lalu jurnal baru dibuat dengan nilai hasil koreksi. Transaksi yang terhubung
 * ke dokumen lain ditolak agar alokasi dan status dokumen tidak pecah.
 */
export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    try {
      const { id } = (await params) as { id: string };
      const body = await req.json().catch(() => ({}));
      const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
      if (!reason) {
        return NextResponse.json({ message: 'Alasan koreksi wajib diisi.' }, { status: 400 });
      }

      if (body?.type !== undefined) {
        return NextResponse.json(
          { message: 'Tipe INCOME/EXPENSE tidak boleh diubah. Hapus transaksi lalu catat ulang bila tipe salah.' },
          { status: 400 }
        );
      }

      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.cashTransaction.findFirst({
          where: { id, workspaceId: auth.workspace.id },
        });
        if (!existing) return null;

        await assertCashTransactionStandalone(tx, auth.workspace.id, existing);
        await assertPeriodWritableForDate(tx, auth.workspace.id, existing.transactionDate);

        const nextAmount = body?.amount !== undefined ? Number(body.amount) : existing.amount;
        if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
          throw new MutationGuardError('Nominal koreksi harus lebih besar dari 0.');
        }

        const nextCategory =
          body?.category !== undefined ? String(body.category).trim() : existing.category;
        if (!nextCategory) throw new MutationGuardError('Kategori transaksi wajib diisi.');

        const nextDescription =
          body?.description !== undefined ? String(body.description).trim() : existing.description;
        if (!nextDescription) throw new MutationGuardError('Deskripsi transaksi wajib diisi.');

        const nextDate =
          body?.transactionDate !== undefined
            ? parseDate(body.transactionDate, 'Tanggal transaksi')
            : existing.transactionDate;
        await assertPeriodWritableForDate(tx, auth.workspace.id, nextDate);

        const nextPaymentMethod =
          body?.paymentMethod !== undefined ? String(body.paymentMethod) : existing.paymentMethod;

        const dimension = await resolveProjectDimensionInTx(
          tx,
          auth.workspace.id,
          body?.projectId !== undefined ? body.projectId : existing.projectId,
          body?.division !== undefined ? body.division : existing.division
        );

        const journal = await tx.journalEntry.findFirst({
          where: {
            workspaceId: auth.workspace.id,
            source: JournalSource.CASH_TX,
            sourceId: existing.id,
            status: JournalStatus.POSTED,
            reversedBy: null,
          },
          select: { id: true },
        });

        if (journal) {
          await reverseJournalInTx(
            tx,
            auth.workspace.id,
            journal.id,
            auth.user.id,
            `Koreksi transaksi kas: ${reason}`
          );
        }

        const updated = await tx.cashTransaction.update({
          where: { id: existing.id },
          data: {
            amount: nextAmount,
            category: nextCategory,
            description: nextDescription,
            transactionDate: nextDate,
            paymentMethod: nextPaymentMethod,
            division: dimension.division,
            projectId: dimension.projectId,
          },
        });

        // Posting ulang hanya bila transaksi memang sudah punya jurnal, atau
        // modul akuntansi aktif. Ini mencegah transaksi lama pra-akuntansi
        // tiba-tiba mendapat jurnal tanpa diminta.
        const setting = await getAccountingSetting(tx, auth.workspace.id);
        if (journal || setting?.isEnabled) {
          await postCashTransaction(tx, {
            workspaceId: auth.workspace.id,
            userId: auth.user.id,
            transaction: updated,
          });
        }

        await recordAuditInTx(tx, {
          workspaceId: auth.workspace.id,
          userId: auth.user.id,
          action: 'UPDATE',
          entityType: 'CASH_TRANSACTION',
          entityId: updated.id,
          before: cashTransactionSnapshot(existing),
          after: cashTransactionSnapshot(updated),
          reason,
          metadata: {
            journalReversedId: journal?.id ?? null,
            journalReposted: Boolean(journal || setting?.isEnabled),
            editedFields: EDITABLE_FIELDS.filter((field) => body?.[field] !== undefined),
          },
        });

        return updated;
      });

      if (!result) {
        return NextResponse.json({ message: 'Transaksi kas tidak ditemukan.' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: 'Transaksi kas berhasil dikoreksi dan riwayat perubahannya tercatat.',
        transaction: result,
      });
    } catch (err: any) {
      if (
        err instanceof JournalValidationError ||
        err instanceof PeriodClosedError ||
        err instanceof MutationGuardError
      ) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return NextResponse.json({ message: 'Transaksi kas tidak ditemukan.' }, { status: 404 });
      }
      return NextResponse.json(
        { message: publicApiError('Koreksi transaksi kas gagal disimpan. Periksa data dan coba lagi.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);
