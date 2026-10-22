import { NextRequest, NextResponse } from 'next/server';
import { TaxPeriodStatus, TaxType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import {
  computePeriodAmount,
  ensureDeadlinesForYear,
  ensurePeriodsForYear,
  getTaxSetting,
  getYearFigures,
} from '@/lib/tax/service';
import { parseIntSafe, parseTaxType } from '@/lib/tax/api';
import { wibToday } from '@/lib/tax/dates';

const VALID_STATUS = new Set<string>(Object.values(TaxPeriodStatus));

/**
 * GET /api/v1/tax/periods?year=2026&taxType=PPN&status=OPEN
 * Daftar masa pajak setahun beserta nominal terutang yang dihitung dari
 * dokumen sumber (bukan angka tersimpan).
 */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const sp = req.nextUrl.searchParams;
    const year = parseIntSafe(sp.get('year'), wibToday().year);
    if (year < 2000 || year > 2100) return badRequest('Tahun tidak valid.');

    const taxType = parseTaxType(sp.get('taxType'));
    const statusRaw = sp.get('status')?.toUpperCase();
    const status = statusRaw && VALID_STATUS.has(statusRaw) ? (statusRaw as TaxPeriodStatus) : null;

    const { setting } = await getTaxSetting(auth.workspace.id);
    const [figures] = await Promise.all([
      getYearFigures(auth.workspace.id, year),
      ensurePeriodsForYear(auth.workspace.id, year, setting),
      ensureDeadlinesForYear(auth.workspace.id, year, setting),
    ]);

    const periods = await prisma.taxPeriod.findMany({
      where: {
        workspaceId: auth.workspace.id,
        year,
        ...(taxType ? { taxType: taxType as TaxType } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ month: 'asc' }, { taxType: 'asc' }],
    });

    return NextResponse.json({
      success: true,
      year,
      setting,
      periods: periods.map((p) => ({
        id: p.id,
        taxType: p.taxType,
        year: p.year,
        month: p.month,
        status: p.status,
        dueDatePayment: p.dueDatePayment?.toISOString() ?? null,
        dueDateFiling: p.dueDateFiling?.toISOString() ?? null,
        paymentRef: p.paymentRef,
        filingRef: p.filingRef,
        filedAt: p.filedAt?.toISOString() ?? null,
        paidAt: p.paidAt?.toISOString() ?? null,
        notes: p.notes,
        amount: computePeriodAmount(p.taxType, p.year, p.month, figures, setting),
      })),
    });
  } catch (err) {
    return serverError('tax-periods-get', err, 'Gagal memuat masa pajak.');
  }
});

/**
 * POST /api/v1/tax/periods  { year: 2026 }
 * Membuat/menyegarkan masa pajak + tenggat template. Idempoten.
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const body = await req.json().catch(() => ({}));
    const year = parseIntSafe(body?.year, wibToday().year);
    if (year < 2000 || year > 2100) return badRequest('Tahun tidak valid.');

    const { setting } = await getTaxSetting(auth.workspace.id);
    const periodsCreated = await ensurePeriodsForYear(auth.workspace.id, year, setting);
    const deadlinesCreated = await ensureDeadlinesForYear(auth.workspace.id, year, setting);

    return NextResponse.json({ success: true, year, periodsCreated, deadlinesCreated });
  } catch (err) {
    return serverError('tax-periods-post', err, 'Gagal menyiapkan masa pajak.');
  }
});
