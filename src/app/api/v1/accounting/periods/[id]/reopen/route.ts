import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { JournalValidationError } from '@/lib/accounting/journal-service';
import { reopenPeriod } from '@/lib/accounting/period-actions';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'lock_period');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const body = await req.json().catch(() => ({}));
      const reason = typeof body.reason === 'string' ? body.reason : '';
      if (!reason.trim()) return badRequest('Alasan membuka kembali periode wajib diisi.');

      const result = await reopenPeriod(auth.workspace.id, id, auth.user.id, reason);
      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof JournalValidationError) return badRequest(err.message);
      return serverError('period:reopen', err, 'Gagal membuka kembali periode.');
    }
  },
  { minRole: 'VIEWER' }
);
