import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, notFound, serializeReportValue, serverError } from '@/lib/accounting/api';
import { getOverdueWatchlist } from '@/lib/accounting/ar-ap-service';

// Penyeliaan tagihan lewat jatuh tempo: AR (piutang) & AP (utang), diurut risiko
// (nominal x umur keterlambatan) dan dilengkapi tingkat penagihan (dunning).
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const asOfRaw = req.nextUrl.searchParams.get('asOf');
      let asOf = new Date();
      if (asOfRaw) {
        asOf = new Date(`${asOfRaw}T23:59:59+07:00`);
        if (Number.isNaN(asOf.getTime())) return badRequest('Tanggal potong (asOf) tidak valid. Format: YYYY-MM-DD.');
      }

      const watchlist = await getOverdueWatchlist(auth.workspace.id, asOf);
      if (!watchlist) return notFound();
      return NextResponse.json({ success: true, data: serializeReportValue(watchlist) });
    } catch (err) {
      return serverError('overdue-watchlist', err, 'Gagal memuat daftar tagihan jatuh tempo.');
    }
  },
  { minRole: 'VIEWER' }
);
