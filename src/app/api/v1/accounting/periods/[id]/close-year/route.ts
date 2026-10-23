import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { JournalValidationError } from '@/lib/accounting/journal-service';
import { PeriodClosedError } from '@/lib/accounting/period';
import { closeFiscalYear } from '@/lib/accounting/period-actions';
import { recordAudit } from '@/lib/audit/audit-trail';

// Jurnal penutup tahun buku: memindahkan saldo pendapatan & beban tahun buku ke
// Saldo Laba (3-2000) dan menutup periode bulan terakhir. Sekali per tahun buku;
// kalau salah, koreksinya lewat jurnal pembalik + jurnal penyesuaian.
export const POST = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'close_period');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };
      const result = await closeFiscalYear(auth.workspace.id, id, auth.user.id);

      await recordAudit({
        workspaceId: auth.workspace.id,
        userId: auth.user.id,
        action: 'CLOSE',
        entityType: 'PERIOD',
        entityId: id,
        after: {
          status: 'CLOSED_FISCAL_YEAR',
          journalId: result.journalId,
          entryNumber: result.entryNumber,
          profit: result.profit,
        },
        metadata: { kind: 'FISCAL_YEAR_CLOSE', periodId: result.periodId },
      });

      return NextResponse.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof JournalValidationError || err instanceof PeriodClosedError) {
        return badRequest(err.message);
      }
      return serverError('period:close-year', err, 'Gagal menutup tahun buku.');
    }
  },
  { minRole: 'VIEWER' }
);
