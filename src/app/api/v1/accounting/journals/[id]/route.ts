import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { guardAccounting, notFound, serializeJournal, serverError } from '@/lib/accounting/api';
import { deleteDraftJournal, JournalValidationError } from '@/lib/accounting/journal-service';

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
      await deleteDraftJournal(auth.workspace.id, id);
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
