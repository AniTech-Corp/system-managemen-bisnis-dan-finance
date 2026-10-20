import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { canAccounting, type AccountingAction } from '@/lib/accounting/rbac';
import { serverError } from '@/lib/accounting/api';

const ACTIONS: AccountingAction[] = [
  'view',
  'draft',
  'post',
  'manage_accounts',
  'close_period',
  'lock_period',
  'manage_settings',
  'opening_balance',
];

/**
 * GET /api/v1/accounting/permissions
 * Dipakai UI untuk menyembunyikan tombol yang tidak diizinkan. Server tetap
 * memeriksa ulang setiap aksi -- UI hanya lapisan kenyamanan, bukan pengaman.
 */
export const GET = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    try {
      const permissions = Object.fromEntries(
        ACTIONS.map((action) => [action, canAccounting(auth, action)])
      ) as Record<AccountingAction, boolean>;

      return NextResponse.json({
        success: true,
        data: {
          role: auth.membership.role,
          isOwner: auth.membership.isOwner,
          permissions,
        },
      });
    } catch (err) {
      return serverError('permissions', err, 'Gagal memuat izin modul akuntansi.');
    }
  },
  { minRole: 'VIEWER' }
);
