import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { guardAccounting, serverError } from '@/lib/accounting/api';
import { buildOverview } from '@/lib/tax/service';
import { monthParam } from '@/lib/tax/api';

/**
 * GET /api/v1/tax/overview?year=2026&month=10
 * Ringkasan masa pajak bulan berjalan + tenggat terdekat + peringatan.
 * Idempoten: masa pajak dan tenggat template dibuat otomatis bila belum ada.
 */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const { year, month } = monthParam(req.nextUrl.searchParams);
    if (year < 2000 || year > 2100) {
      return NextResponse.json(
        { success: false, message: 'Tahun tidak valid.' },
        { status: 400 }
      );
    }

    const overview = await buildOverview(auth.workspace.id, year, month);
    return NextResponse.json({ success: true, ...overview });
  } catch (err) {
    return serverError('tax-overview', err, 'Gagal memuat ringkasan pajak.');
  }
});
