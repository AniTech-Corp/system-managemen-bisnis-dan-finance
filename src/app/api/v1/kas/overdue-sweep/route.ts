import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serializeReportValue, serverError } from '@/lib/accounting/api';
import { sweepOverdue } from '@/lib/accounting/ar-ap-service';

// Job penuaan (overdue sweep): menghitung ulang snapshot `agingBucket`,
// `overdueSince`, dan status OVERDUE faktur untuk workspace ini. Idempoten.
// Dapat dipicu manual oleh staf (peran MEMBER+) maupun dari scheduler internal.
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'manage_ar_ap');
    if (forbidden) return forbidden;

    try {
      let asOf = new Date();
      let body: Record<string, unknown> = {};
      try {
        body = (await req.json()) as Record<string, unknown>;
      } catch {
        body = {};
      }
      const asOfRaw = typeof body.asOf === 'string' ? body.asOf : req.nextUrl.searchParams.get('asOf');
      if (asOfRaw) {
        asOf = new Date(`${asOfRaw}T23:59:59+07:00`);
        if (Number.isNaN(asOf.getTime())) return badRequest('Tanggal potong (asOf) tidak valid. Format: YYYY-MM-DD.');
      }

      const result = await sweepOverdue(auth.workspace.id, asOf);
      return NextResponse.json({ success: true, data: serializeReportValue(result) });
    } catch (err) {
      return serverError('overdue-sweep', err, 'Gagal menjalankan job penuaan tagihan.');
    }
  },
  { minRole: 'MEMBER' }
);
