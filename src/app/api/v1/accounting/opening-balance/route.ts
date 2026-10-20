import { NextRequest, NextResponse } from 'next/server';
import { JournalSource, JournalStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serializeJournal, serverError } from '@/lib/accounting/api';
import { createJournal, JournalValidationError } from '@/lib/accounting/journal-service';
import { PeriodClosedError } from '@/lib/accounting/period';
import { toMoney } from '@/lib/accounting/money';

export const GET = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const [setting, opening] = await Promise.all([
        prisma.accountingSetting.findUnique({ where: { workspaceId: auth.workspace.id } }),
        prisma.journalEntry.findFirst({
          where: { workspaceId: auth.workspace.id, source: JournalSource.OPENING },
          orderBy: { createdAt: 'desc' },
          include: { lines: { orderBy: { lineNo: 'asc' }, include: { account: { select: { code: true, name: true } } } } },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          booksStartDate: setting?.booksStartDate ?? null,
          retainedEarningsAccountId: setting?.retainedEarningsAccountId ?? null,
          hasOldBooks: await prisma.journalEntry.count({
            where: { workspaceId: auth.workspace.id, status: JournalStatus.POSTED },
          }) > 0,
          opening: opening ? serializeJournal(opening) : null,
        },
      });
    } catch (err) {
      return serverError('opening-balance:get', err, 'Gagal memuat saldo awal.');
    }
  },
  { minRole: 'VIEWER' }
);

/**
 * POST /api/v1/accounting/opening-balance
 *
 * Body:
 * {
 *   date: "2026-11-01",
 *   lines: [{ accountId, debit, credit, description?, partnerId?, cashAccountId? }],
 *   balancingAccountId?: string   // default: akun Saldo Laba dari pengaturan
 * }
 *
 * Selisih TIDAK disimpan diam-diam: kalau tidak balance, sistem memakai
 * `balancingAccountId` sebagai penyeimbang dan mencatatnya di deskripsi.
 */
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'opening_balance');
    if (forbidden) return forbidden;

    try {
      const body = await req.json().catch(() => ({}));

      if (!body.date) return badRequest('Tanggal mulai pembukuan wajib diisi.');
      const entryDate = new Date(body.date);
      if (Number.isNaN(entryDate.getTime())) return badRequest('Tanggal mulai pembukuan tidak valid.');
      if (!Array.isArray(body.lines) || body.lines.length < 2) {
        return badRequest('Saldo awal minimal terdiri dari dua baris.');
      }

      const workspaceId = auth.workspace.id;

      const existingOpening = await prisma.journalEntry.findFirst({
        where: { workspaceId, source: JournalSource.OPENING, status: JournalStatus.POSTED },
        select: { entryNumber: true },
      });
      if (existingOpening) {
        return badRequest(
          `Saldo awal sudah pernah dicatat (${existingOpening.entryNumber}). Balik jurnal tersebut bila ingin mengisi ulang.`
        );
      }

      const setting = await prisma.accountingSetting.findUnique({ where: { workspaceId } });
      const balancingAccountId = body.balancingAccountId || setting?.retainedEarningsAccountId;
      if (!balancingAccountId) {
        return badRequest('Akun penyeimbang (Saldo Laba) belum diatur. Jalankan setup atau pilih akun penyeimbang.');
      }

      const lines = body.lines.map((line: any) => ({
        accountId: line.accountId,
        debit: line.debit ?? 0,
        credit: line.credit ?? 0,
        description: line.description,
        partnerId: line.partnerId ?? null,
        cashAccountId: line.cashAccountId ?? null,
      }));

      const totalDebit = lines.reduce((acc: Prisma.Decimal, l: any) => acc.plus(toMoney(l.debit)), new Prisma.Decimal(0));
      const totalCredit = lines.reduce((acc: Prisma.Decimal, l: any) => acc.plus(toMoney(l.credit)), new Prisma.Decimal(0));
      const difference = totalDebit.minus(totalCredit);

      if (!difference.isZero()) {
        if (difference.isNegative()) {
          lines.push({
            accountId: balancingAccountId,
            debit: difference.abs(),
            credit: 0,
            description: 'Penyeimbang saldo awal',
            partnerId: null,
            cashAccountId: null,
          });
        } else {
          lines.push({
            accountId: balancingAccountId,
            debit: 0,
            credit: difference,
            description: 'Penyeimbang saldo awal',
            partnerId: null,
            cashAccountId: null,
          });
        }
      }

      const entry = await createJournal({
        workspaceId,
        userId: auth.user.id,
        entryDate,
        description: 'Saldo awal pembukuan',
        source: JournalSource.OPENING,
        lines,
        status: JournalStatus.POSTED,
      });

      await prisma.accountingSetting.update({
        where: { workspaceId },
        data: { isEnabled: true, booksStartDate: entryDate },
      });

      return NextResponse.json({ success: true, data: serializeJournal(entry) }, { status: 201 });
    } catch (err) {
      if (err instanceof JournalValidationError) return badRequest(err.message);
      if (err instanceof PeriodClosedError) return badRequest(err.message);
      return serverError('opening-balance:post', err, 'Gagal menyimpan saldo awal.');
    }
  },
  { minRole: 'VIEWER' }
);
