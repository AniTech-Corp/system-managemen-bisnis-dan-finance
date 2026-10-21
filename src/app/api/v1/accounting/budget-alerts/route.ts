import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import {
  evaluateBudgetAlerts,
  EXCEEDED_THRESHOLD_PCT,
  WARNING_THRESHOLD_PCT,
} from '@/lib/accounting/budget-alerts';
import { divisionLabel } from '@/lib/accounting/budget-divisions';
import {
  fiscalStartYear,
  monthIndexInFiscalYear,
} from '@/lib/accounting/budgets';
import { getJakartaParts } from '@/lib/accounting/period';

/**
 * Peringatan anggaran per divisi.
 *
 * GET    ?fiscalYear=&monthIndex=  → peringatan yang belum diakui + penghitung
 * POST   { fiscalYear?, monthIndex?, userId? }  → nilai ulang sekarang (manual)
 * PATCH  { alertIds: string[] }     → tandai sudah dibaca
 *
 * Ini jalur BACA utama peringatan (bukan ActivityEvent). Peringatan dibuat
 * otomatis oleh `evaluateBudgetAlerts` setiap kali transaksi kas disimpan,
 * dihapus, atau anggaran diubah; endpoint ini hanya membacanya.
 */

const ALERT_SELECT = {
  id: true,
  fiscalYear: true,
  monthIndex: true,
  division: true,
  accountId: true,
  level: true,
  budget: true,
  actual: true,
  triggeredAt: true,
  acknowledgedAt: true,
  account: { select: { code: true, name: true } },
} satisfies Prisma.BudgetAlertSelect;

/** Angka bulan berjalan dalam tahun buku, dipakai sebagai default parameter. */
function currentFiscalPosition(fiscalStartMonth: number) {
  const parts = getJakartaParts();
  return {
    fiscalYear: fiscalStartYear(parts.year, parts.month, fiscalStartMonth),
    monthIndex: monthIndexInFiscalYear(parts.year, parts.month, fiscalStartMonth),
  };
}

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const workspaceId = auth.workspace.id;
      const setting = await prisma.accountingSetting.findUnique({
        where: { workspaceId },
        select: { fiscalYearStartMonth: true },
      });
      const fiscalStartMonth = setting?.fiscalYearStartMonth ?? 1;
      const current = currentFiscalPosition(fiscalStartMonth);

      // Hati-hati: `Number(null)` bernilai 0, dan 0 adalah bulan yang SAH.
      // Tanpa membedakan "tidak dikirim" dari "0", permintaan tanpa parameter
      // akan dianggap meminta Januari -- panel peringatan jadi selalu kosong
      // padahal ada alert di bulan berjalan.
      const rawYearParam = req.nextUrl.searchParams.get('fiscalYear');
      const rawYear = rawYearParam === null ? Number.NaN : Number(rawYearParam);
      const fiscalYear =
        Number.isInteger(rawYear) && rawYear >= 2000 && rawYear <= 2100 ? rawYear : current.fiscalYear;

      const rawMonthParam = req.nextUrl.searchParams.get('monthIndex');
      const rawMonth = rawMonthParam === null ? Number.NaN : Number(rawMonthParam);
      const monthIndex =
        Number.isInteger(rawMonth) && rawMonth >= 0 && rawMonth <= 11 ? rawMonth : current.monthIndex;

      const alerts = await prisma.budgetAlert.findMany({
        where: { workspaceId, fiscalYear, monthIndex },
        select: ALERT_SELECT,
        orderBy: [{ acknowledgedAt: 'asc' }, { level: 'desc' }, { actual: 'desc' }],
      });

      const unacknowledged = alerts.filter((a) => !a.acknowledgedAt);

      return NextResponse.json({
        success: true,
        data: {
          fiscalYear,
          monthIndex,
          isCurrentMonth: fiscalYear === current.fiscalYear && monthIndex === current.monthIndex,
          thresholds: { warningPct: WARNING_THRESHOLD_PCT, exceededPct: EXCEEDED_THRESHOLD_PCT },
          alerts: alerts.map((a) => ({
            ...a,
            budget: Number(a.budget),
            actual: Number(a.actual),
            divisionLabel: divisionLabel(a.division),
            message:
              a.level === 'EXCEEDED'
                ? `Anggaran ${a.account.name} (${divisionLabel(a.division)}) sudah terpakai seluruhnya.`
                : `Anggaran ${a.account.name} (${divisionLabel(a.division)}) mendekati batas.`,
          })),
          counts: {
            total: alerts.length,
            unacknowledged: unacknowledged.length,
            warning: unacknowledged.filter((a) => a.level === 'WARNING').length,
            exceeded: unacknowledged.filter((a) => a.level === 'EXCEEDED').length,
          },
        },
      });
    } catch (err) {
      return serverError('budget-alerts:get', err, 'Gagal memuat peringatan anggaran.');
    }
  },
  { minRole: 'VIEWER' }
);

/**
 * Nilai ulang peringatan secara manual.
 *
 * Seharusnya tidak perlu dipanggil secara normal -- evaluasi sudah berjalan
 * otomatis -- tapi berguna setelah koreksi data besar atau saat memastikan
 * angka segar tanpa menunggu transaksi berikutnya.
 */
export const POST = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const result = await evaluateBudgetAlerts(auth.workspace.id, { userId: auth.user.id });
      return NextResponse.json({
        success: !result.failed,
        message: result.failed
          ? 'Peringatan gagal dinilai ulang. Anggaran tetap tersimpan.'
          : `${result.created.length} peringatan baru, ${result.cleared} sudah tidak berlaku.`,
        data: {
          fiscalYear: result.fiscalYear,
          monthIndex: result.monthIndex,
          created: result.created.length,
          cleared: result.cleared,
          failed: result.failed,
        },
      });
    } catch (err) {
      return serverError('budget-alerts:post', err, 'Gagal menilai ulang peringatan.');
    }
  },
  { minRole: 'VIEWER' }
);

/**
 * Tandai peringatan sudah dibaca.
 *
 * Sengaja bukan `manage_settings`: mengakui peringatan hanya menyembunyikan
 * badge, tidak mengubah anggaran mana pun, jadi staf biasa boleh melakukannya.
 */
export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const body = await req.json();
      const alertIds = Array.isArray(body?.alertIds) ? body.alertIds.filter((v: unknown) => typeof v === 'string') : [];
      if (alertIds.length === 0) {
        return badRequest('Tidak ada peringatan yang ditandai.');
      }

      // `updateMany` dengan filter workspaceId: caller tidak bisa mengakui
      // peringatan milik workspace lain lewat menebak UUID.
      const result = await prisma.budgetAlert.updateMany({
        where: {
          id: { in: alertIds },
          workspaceId: auth.workspace.id,
          acknowledgedAt: null,
        },
        data: { acknowledgedAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: `${result.count} peringatan ditandai sudah dibaca.`,
        data: { updated: result.count },
      });
    } catch (err) {
      return serverError('budget-alerts:patch', err, 'Gagal menandai peringatan.');
    }
  },
  { minRole: 'MEMBER' }
);
