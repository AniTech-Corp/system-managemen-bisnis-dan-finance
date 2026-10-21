import { NextRequest, NextResponse } from 'next/server';
import { AccountType, JournalStatus, TaxProfile } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { formatPeriodKey } from '@/lib/accounting/period';

const VALID_TAX_PROFILES = new Set(Object.values(TaxProfile));

export const GET = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const [setting, accounts, cashAccounts, postedCount, latestPeriod] = await Promise.all([
        prisma.accountingSetting.findUnique({ where: { workspaceId: auth.workspace.id } }),
        prisma.account.count({ where: { workspaceId: auth.workspace.id } }),
        prisma.cashAccount.findMany({
          where: { workspaceId: auth.workspace.id },
          orderBy: { code: 'asc' },
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            bankName: true,
            accountNumber: true,
            isActive: true,
            account: { select: { id: true, code: true, name: true } },
          },
        }),
        prisma.journalEntry.count({
          where: { workspaceId: auth.workspace.id, status: JournalStatus.POSTED },
        }),
        // Periode terakhir yang benar-benar punya jurnal. Dipakai UI sebagai
        // periode awal supaya owner langsung melihat angka, bukan bulan berjalan
        // yang mungkin masih kosong.
        prisma.fiscalPeriod.findFirst({
          where: { workspaceId: auth.workspace.id, entries: { some: {} } },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
          select: { year: true, month: true },
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          setting,
          accountCount: accounts,
          cashAccounts,
          hasPostedJournals: postedCount > 0,
          postedJournalCount: postedCount,
          latestPeriodKey: latestPeriod
            ? formatPeriodKey(latestPeriod.year, latestPeriod.month)
            : null,
        },
      });
    } catch (err) {
      return serverError('settings:get', err, 'Gagal memuat pengaturan akuntansi.');
    }
  },
  { minRole: 'VIEWER' }
);

export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'manage_settings');
    if (forbidden) return forbidden;

    try {
      const body = await req.json().catch(() => ({}));
      const workspaceId = auth.workspace.id;

      const existing = await prisma.accountingSetting.findUnique({ where: { workspaceId } });
      if (!existing) {
        return badRequest('Modul akuntansi belum disiapkan. Jalankan inisialisasi bagan akun terlebih dahulu.');
      }

      const postedCount = await prisma.journalEntry.count({
        where: { workspaceId, status: JournalStatus.POSTED },
      });

      const data: Record<string, unknown> = {};

      if (body.taxProfile !== undefined) {
        if (!VALID_TAX_PROFILES.has(body.taxProfile)) return badRequest('Profil pajak tidak dikenal.');
        if (postedCount > 0 && body.taxProfile !== existing.taxProfile) {
          return badRequest(
            'Profil pajak tidak bisa diubah setelah ada jurnal diposting. Lakukan di batas periode dengan jurnal penyesuaian.'
          );
        }
        data.taxProfile = body.taxProfile;
        data.enablePpn = body.taxProfile !== TaxProfile.UMKM_NON_PKP;
      }

      if (body.entityType !== undefined) {
        if (postedCount > 0 && body.entityType !== existing.entityType) {
          return badRequest('Bentuk badan usaha tidak bisa diubah setelah ada jurnal diposting.');
        }
        data.entityType = String(body.entityType);
      }

      if (body.booksStartDate !== undefined) {
        const parsed = new Date(body.booksStartDate);
        if (Number.isNaN(parsed.getTime())) return badRequest('Tanggal mulai pembukuan tidak valid.');
        if (postedCount > 0 && parsed.getTime() !== existing.booksStartDate?.getTime()) {
          return badRequest(
            'Tanggal mulai pembukuan tidak bisa diubah setelah ada jurnal diposting. Gunakan jurnal penyesuaian saldo awal.'
          );
        }
        data.booksStartDate = parsed;
      }

      if (typeof body.isEnabled === 'boolean') data.isEnabled = body.isEnabled;
      if (typeof body.enableInventory === 'boolean') data.enableInventory = body.enableInventory;

      if (typeof body.fiscalYearStartMonth === 'number') {
        if (body.fiscalYearStartMonth < 1 || body.fiscalYearStartMonth > 12) {
          return badRequest('Bulan awal tahun fiskal harus 1-12.');
        }
        data.fiscalYearStartMonth = body.fiscalYearStartMonth;
      }

      if (typeof body.defaultCashAccountId === 'string') {
        const cash = await prisma.cashAccount.findFirst({
          where: { id: body.defaultCashAccountId, workspaceId },
          select: { id: true },
        });
        if (!cash) return badRequest('Rekening kas/bank default tidak ditemukan.');
        data.defaultCashAccountId = cash.id;
      }

      // Akun pendapatan untuk faktur. Boleh diubah kapan saja -- hanya berpengaruh
      // pada faktur yang diterbitkan SETELAH perubahan ini.
      if (body.defaultRevenueAccountId !== undefined) {
        if (body.defaultRevenueAccountId === null || body.defaultRevenueAccountId === '') {
          data.defaultRevenueAccountId = null;
        } else {
          const revenue = await prisma.account.findFirst({
            where: { id: String(body.defaultRevenueAccountId), workspaceId, type: AccountType.REVENUE, isPostable: true },
            select: { id: true },
          });
          if (!revenue) return badRequest('Akun pendapatan untuk faktur tidak valid.');
          data.defaultRevenueAccountId = revenue.id;
        }
      }

      const updated = await prisma.accountingSetting.update({ where: { workspaceId }, data });

      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      return serverError('settings:patch', err, 'Gagal menyimpan pengaturan akuntansi.');
    }
  },
  { minRole: 'VIEWER' }
);
