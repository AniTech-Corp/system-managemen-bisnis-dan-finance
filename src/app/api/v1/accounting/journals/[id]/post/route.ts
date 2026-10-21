import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serializeJournal, serverError } from '@/lib/accounting/api';
import { postJournal, JournalValidationError } from '@/lib/accounting/journal-service';
import { PeriodClosedError } from '@/lib/accounting/period';

export const POST = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'post');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const entry = await postJournal(auth.workspace.id, id, auth.user.id);
      return NextResponse.json({ success: true, data: serializeJournal(entry) });
    } catch (err) {
      if (err instanceof JournalValidationError) return badRequest(err.message);
      if (err instanceof PeriodClosedError) return badRequest(err.message);
      return serverError('journal:post', err, 'Gagal posting jurnal.');
    }
  },
  { minRole: 'VIEWER' }
);
