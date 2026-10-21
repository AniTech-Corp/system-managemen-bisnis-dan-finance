import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { evaluateBudgetAlerts } from '@/lib/accounting/budget-alerts';
import { getJakartaParts } from '@/lib/accounting/period';
import {
  fiscalStartYear,
  listBudgets,
  saveBudgets,
  type BudgetSaveItem,
} from '@/lib/accounting/budgets';

/**
 * Anggaran tahunan per akun pendapatan/beban, per divisi.
 *
 * GET  ?year=2026  → daftar anggaran + akun yang bisa dianggarkan
 * PUT  { year, items: [{ accountId, division?, monthly: number[12], note? }] }
 *
 * `division` per baris. Kosong dianggap "Perusahaan" (kompatibilitas input lama).
 * Anggaran tidak membuat jurnal. Realisasi ada di `/reports/budget`.
 */
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const workspaceId = auth.workspace.id;
      const setting = await prisma.accountingSetting.findUnique({ where: { workspaceId } });
      const fiscalStartMonth = setting?.fiscalYearStartMonth ?? 1;

      const rawYear = req.nextUrl.searchParams.get('year');
      let fiscalYear: number;
      if (rawYear) {
        fiscalYear = Number(rawYear);
        if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
          return badRequest('Tahun anggaran tidak valid.');
        }
      } else {
        const now = getJakartaParts();
        fiscalYear = fiscalStartYear(now.year, now.month, fiscalStartMonth);
      }

      const data = await listBudgets(workspaceId, fiscalYear, fiscalStartMonth);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      return serverError('budgets:get', err, 'Gagal memuat anggaran.');
    }
  },
  { minRole: 'VIEWER' }
);

export const PUT = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'manage_settings');
    if (forbidden) return forbidden;

    try {
      const body = await req.json();
      const year = Number(body?.year);
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return badRequest('Tahun anggaran tidak valid.');
      }
      const items = body?.items;
      if (!Array.isArray(items) || items.length === 0) {
        return badRequest('Tidak ada anggaran yang dikirim.');
      }

      const normalized: BudgetSaveItem[] = items.map((item: any) => {
        if (typeof item?.accountId !== 'string' || !item.accountId) {
          throw new Error('accountId setiap baris wajib diisi.');
        }
        return {
          accountId: item.accountId,
          // Dinormalisasi di `saveBudgets` supaya hanya ada SATU aturan validasi
          // divisi di seluruh codebase (lihat budget-divisions.ts).
          division: item?.division ?? null,
          monthly: item.monthly,
          note: typeof item.note === 'string' ? item.note : null,
        };
      });

      const result = await saveBudgets(auth.workspace.id, year, normalized);

      // Anggaran berubah, jadi peringatan perlu dinilai ulang -- misal realisasi
      // yang tadinya di bawah 80% tiba-tiba melewati batas karena ambangnya
      // diturunkan. Gagal di sini tidak menggagalkan penyimpanan anggaran.
      void evaluateBudgetAlerts(auth.workspace.id, { userId: auth.user.id });

      return NextResponse.json({
        success: true,
        message: `Anggaran tersimpan (${result.saved} baris${result.deleted ? `, ${result.deleted} baris kosong dihapus` : ''}).`,
        data: result,
      });
    } catch (err) {
      if (err instanceof Error && /divisi|anggota|akun|angka|tahun|bulan|Anggaran/i.test(err.message)) {
        return badRequest(err.message);
      }
      return serverError('budgets:put', err, 'Gagal menyimpan anggaran.');
    }
  },
  { minRole: 'ADMIN' }
);
