import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serializeReportValue, serverError } from '@/lib/accounting/api';
import { getPaymentSchedule } from '@/lib/accounting/ar-ap-service';

// Jadwal pembayaran vendor (AP): daftar tagihan utang yang belum lunas + proyeksi
// arus kas (piutang masuk vs utang keluar) sepanjang horizon hari.
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const sp = req.nextUrl.searchParams;
      const asOf = parseAsOf(sp.get('asOf'));
      if (!asOf) return badRequest('Tanggal potong (asOf) tidak valid. Format: YYYY-MM-DD.');

      const horizonRaw = Number(sp.get('horizon') ?? '30');
      const horizon = Number.isFinite(horizonRaw) ? Math.min(Math.max(Math.trunc(horizonRaw), 1), 365) : 30;

      const schedule = await getPaymentSchedule(auth.workspace.id, asOf, horizon);
      return NextResponse.json({ success: true, data: serializeReportValue(schedule) });
    } catch (err) {
      return serverError('payment-schedule', err, 'Gagal menyusun jadwal pembayaran.');
    }
  },
  { minRole: 'VIEWER' }
);

function parseAsOf(raw: string | null): Date | null {
  if (!raw) return new Date();
  const date = new Date(`${raw}T23:59:59+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}
