import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { buildComplianceReport } from '@/lib/tax/service';

/**
 * GET /api/v1/tax/compliance-check?periodId=<uuid>
 * Checklist dokumen + persentase kelengkapan untuk satu masa pajak.
 */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const periodId = req.nextUrl.searchParams.get('periodId');
    if (!periodId) return badRequest('periodId wajib diisi.');

    const report = await buildComplianceReport(auth.workspace.id, periodId);
    if (!report.period) {
      return NextResponse.json(
        { success: false, message: 'Masa pajak tidak ditemukan.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ...report });
  } catch (err) {
    return serverError('tax-compliance-check', err, 'Gagal memeriksa kelengkapan dokumen.');
  }
});
