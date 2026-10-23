import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { getFinancialHealthScore } from '@/lib/accounting/financial-health';

/**
 * GET /api/v1/accounting/financial-health
 * Opsional: `?asOf=YYYY-MM-DD`.
 *
 * Endpoint lama `/api/v1/kas/financial-health` tetap dipertahankan untuk
 * dashboard/AI. Endpoint ini adalah skor lengkap berbasis jurnal akuntansi.
 */
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const asOfParam = req.nextUrl.searchParams.get('asOf');
      const asOf = asOfParam ? new Date(asOfParam) : new Date();
      if (Number.isNaN(asOf.getTime())) return badRequest('Tanggal asOf tidak valid.');

      const data = await getFinancialHealthScore(auth.workspace.id, asOf);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return serverError('financial-health:get', err, 'Gagal menghitung skor kesehatan keuangan.');
    }
  },
  { minRole: 'VIEWER' }
);
