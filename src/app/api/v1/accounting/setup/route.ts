import { NextRequest, NextResponse } from 'next/server';
import { Prisma, TaxProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { seedChartOfAccounts } from '@/lib/accounting/coa-seed';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';

const VALID_TAX_PROFILES = new Set(Object.values(TaxProfile));

/**
 * POST /api/v1/accounting/setup
 * Inisialisasi bagan akun standar + pengaturan + rekening kas default.
 * Idempoten: aman dipanggil ulang; akun yang sudah ada tidak ditimpa.
 */
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'manage_settings');
    if (forbidden) return forbidden;

    try {
      const body = await req.json().catch(() => ({}));

      let booksStartDate: Date | undefined;
      if (body.booksStartDate) {
        const parsed = new Date(body.booksStartDate);
        if (Number.isNaN(parsed.getTime())) return badRequest('Tanggal mulai pembukuan tidak valid.');
        booksStartDate = parsed;
      }

      if (body.taxProfile && !VALID_TAX_PROFILES.has(body.taxProfile)) {
        return badRequest('Profil pajak tidak dikenal.');
      }

      const result = await prisma.$transaction(async (tx) => {
        const seeded = await seedChartOfAccounts(tx, auth.workspace.id, {
          booksStartDate,
          taxProfile: body.taxProfile,
          entityType: typeof body.entityType === 'string' ? body.entityType : undefined,
          createDefaultCashAccounts: body.createDefaultCashAccounts !== false,
        });

        const setting = await tx.accountingSetting.update({
          where: { workspaceId: auth.workspace.id },
          data: {
            isEnabled: true,
            enablePpn: (body.taxProfile ?? seeded.setting.taxProfile) !== TaxProfile.UMKM_NON_PKP,
          },
        });

        return { seeded, setting };
      });

      return NextResponse.json({
        success: true,
        message: 'Bagan akun dan pengaturan akuntansi berhasil disiapkan.',
        data: {
          accountsCreated: result.seeded.accountsCreated,
          accountsExisting: result.seeded.accountsExisting,
          cashAccountsCreated: result.seeded.cashAccountsCreated,
          setting: {
            isEnabled: result.setting.isEnabled,
            booksStartDate: result.setting.booksStartDate,
            taxProfile: result.setting.taxProfile,
            entityType: result.setting.entityType,
          },
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return badRequest('Gagal menyiapkan bagan akun. Periksa data lalu coba lagi.');
      }
      return serverError('setup', err, 'Gagal menyiapkan modul akuntansi.');
    }
  },
  { minRole: 'VIEWER' }
);
