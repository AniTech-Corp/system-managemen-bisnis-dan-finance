import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { getCashCrisisAssessment, normalizeCashCrisisHorizon } from '@/lib/accounting/cash-crisis';

/**
 * GET /api/v1/accounting/cash-crisis?horizon=30
 * Horizon yang didukung: 7, 14, 30, 60, 90 hari.
 */
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const rawHorizon = req.nextUrl.searchParams.get('horizon');
      const horizon = normalizeCashCrisisHorizon(rawHorizon);
      if (rawHorizon && String(horizon) !== rawHorizon) {
        return badRequest('Horizon harus salah satu dari 7, 14, 30, 60, atau 90 hari.');
      }

      const asOfParam = req.nextUrl.searchParams.get('asOf');
      const asOf = asOfParam ? new Date(asOfParam) : new Date();
      if (Number.isNaN(asOf.getTime())) return badRequest('Tanggal asOf tidak valid.');

      const data = await getCashCrisisAssessment(auth.workspace.id, horizon, asOf);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return serverError('cash-crisis:get', err, 'Gagal menghitung proyeksi peringatan dini kas.');
    }
  },
  { minRole: 'VIEWER' }
);
