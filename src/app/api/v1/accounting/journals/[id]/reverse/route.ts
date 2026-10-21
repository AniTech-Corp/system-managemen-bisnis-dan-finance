import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serializeJournal, serverError } from '@/lib/accounting/api';
import { reverseJournal, JournalValidationError } from '@/lib/accounting/journal-service';
import { PeriodClosedError } from '@/lib/accounting/period';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'post');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const body = await req.json().catch(() => ({}));
      const reason = typeof body.reason === 'string' ? body.reason : '';
      if (!reason.trim()) return badRequest('Alasan pembalikan jurnal wajib diisi.');

      const entry = await reverseJournal(auth.workspace.id, id, auth.user.id, reason);
      return NextResponse.json({ success: true, data: serializeJournal(entry) });
    } catch (err) {
      if (err instanceof JournalValidationError) return badRequest(err.message);
      if (err instanceof PeriodClosedError) return badRequest(err.message);
      return serverError('journal:reverse', err, 'Gagal membalik jurnal.');
    }
  },
  { minRole: 'VIEWER' }
);
