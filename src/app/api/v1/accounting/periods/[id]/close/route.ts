import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { JournalValidationError } from '@/lib/accounting/journal-service';
import { closePeriod } from '@/lib/accounting/period-actions';

export const POST = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'close_period');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const result = await closePeriod(auth.workspace.id, id, auth.user.id);
      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof JournalValidationError) return badRequest(err.message);
      return serverError('period:close', err, 'Gagal menutup periode.');
    }
  },
  { minRole: 'VIEWER' }
);
