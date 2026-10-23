import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serializeJournal, serverError } from '@/lib/accounting/api';
import { postJournal, JournalValidationError } from '@/lib/accounting/journal-service';
import { PeriodClosedError } from '@/lib/accounting/period';
import { journalSnapshot, recordAudit } from '@/lib/audit/audit-trail';

export const POST = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'post');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const before = await prisma.journalEntry.findFirst({
        where: { id, workspaceId: auth.workspace.id },
        include: { lines: true },
      });
      const entry = await postJournal(auth.workspace.id, id, auth.user.id);

      if (before) {
        const totalDebit = before.lines.reduce((acc, line) => acc.plus(line.debit), new Prisma.Decimal(0));
        await recordAudit({
          workspaceId: auth.workspace.id,
          userId: auth.user.id,
          action: 'UPDATE',
          entityType: 'JOURNAL_ENTRY',
          entityId: entry.id,
          before: journalSnapshot({
            ...before,
            lineCount: before.lines.length,
            totalDebit,
          }),
          after: journalSnapshot({
            ...entry,
            lineCount: entry.lines.length,
            totalDebit,
          }),
          metadata: { transition: 'POST' },
        });
      }

      return NextResponse.json({ success: true, data: serializeJournal(entry) });
    } catch (err) {
      if (err instanceof JournalValidationError) return badRequest(err.message);
      if (err instanceof PeriodClosedError) return badRequest(err.message);
      return serverError('journal:post', err, 'Gagal posting jurnal.');
    }
  },
  { minRole: 'VIEWER' }
);
