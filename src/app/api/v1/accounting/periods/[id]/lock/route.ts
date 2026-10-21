import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { JournalValidationError } from '@/lib/accounting/journal-service';
import { lockPeriod } from '@/lib/accounting/period-actions';

export const POST = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'lock_period');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const result = await lockPeriod(auth.workspace.id, id, auth.user.id);
      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof JournalValidationError) return badRequest(err.message);
      return serverError('period:lock', err, 'Gagal mengunci periode.');
    }
  },
  { minRole: 'VIEWER' }
);
