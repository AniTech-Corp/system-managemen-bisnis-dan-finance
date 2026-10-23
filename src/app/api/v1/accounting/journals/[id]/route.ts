import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { guardAccounting, notFound, serializeJournal, serverError } from '@/lib/accounting/api';
import { deleteDraftJournal, JournalValidationError } from '@/lib/accounting/journal-service';
import { journalSnapshot, recordAudit } from '@/lib/audit/audit-trail';

export const GET = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };

      const entry = await prisma.journalEntry.findFirst({
        where: { id, workspaceId: auth.workspace.id },
        include: {
          lines: {
            orderBy: { lineNo: 'asc' },
            include: {
              account: { select: { id: true, code: true, name: true, type: true } },
              cashAccount: { select: { id: true, code: true, name: true } },
              partner: { select: { id: true, name: true } },
            },
          },
          period: { select: { id: true, year: true, month: true, status: true } },
        },
      });

      if (!entry) return notFound('Jurnal tidak ditemukan.');
      return NextResponse.json({ success: true, data: serializeJournal(entry) });
    } catch (err) {
      return serverError('journal:get', err, 'Gagal memuat detail jurnal.');
    }
  },
  { minRole: 'VIEWER' }
);

export const DELETE = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'draft');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const existing = await prisma.journalEntry.findFirst({
        where: { id, workspaceId: auth.workspace.id },
        include: { lines: true },
      });
      if (!existing) {
        return NextResponse.json({ success: false, message: 'Jurnal tidak ditemukan.' }, { status: 404 });
      }

      await deleteDraftJournal(auth.workspace.id, id);

      const totalDebit = existing.lines.reduce((acc, line) => acc.plus(line.debit), new Prisma.Decimal(0));
      await recordAudit({
        workspaceId: auth.workspace.id,
        userId: auth.user.id,
        action: 'DELETE',
        entityType: 'JOURNAL_ENTRY',
        entityId: existing.id,
        before: journalSnapshot({
          ...existing,
          lineCount: existing.lines.length,
          totalDebit,
        }),
        reason: 'Jurnal draft dihapus',
      });

      return NextResponse.json({ success: true, message: 'Jurnal draft berhasil dihapus.' });
    } catch (err) {
      if (err instanceof JournalValidationError) {
        return NextResponse.json({ success: false, message: err.message }, { status: 400 });
      }
      return serverError('journal:delete', err, 'Gagal menghapus jurnal.');
    }
  },
  { minRole: 'VIEWER' }
);
