import { NextRequest, NextResponse } from 'next/server';
import { Prisma, TaxPeriodStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, notFound, serverError } from '@/lib/accounting/api';
import {
  buildComplianceReport,
  computePeriodAmount,
  getTaxSetting,
  getYearFigures,
  updatePeriodStatus,
} from '@/lib/tax/service';
import { asString } from '@/lib/tax/api';
import { recordActivity } from '@/lib/activity-log';

const VALID_STATUS = new Set<string>(Object.values(TaxPeriodStatus));

/** GET /api/v1/tax/periods/[id] — detail masa pajak + checklist dokumen. */
export const GET = withTenantGuard(async (_req: NextRequest, { auth, params }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const { id } = (await params) as { id: string };
    const period = await prisma.taxPeriod.findFirst({
      where: { id, workspaceId: auth.workspace.id },
    });
    if (!period) return notFound('Masa pajak tidak ditemukan.');

    const [{ setting }, figures, compliance] = await Promise.all([
      getTaxSetting(auth.workspace.id),
      getYearFigures(auth.workspace.id, period.year),
      buildComplianceReport(auth.workspace.id, period.id),
    ]);

    return NextResponse.json({
      success: true,
      period: {
        id: period.id,
        taxType: period.taxType,
        year: period.year,
        month: period.month,
        status: period.status,
        dueDatePayment: period.dueDatePayment?.toISOString() ?? null,
        dueDateFiling: period.dueDateFiling?.toISOString() ?? null,
        paymentRef: period.paymentRef,
        filingRef: period.filingRef,
        filedAt: period.filedAt?.toISOString() ?? null,
        paidAt: period.paidAt?.toISOString() ?? null,
        notes: period.notes,
        amount: computePeriodAmount(period.taxType, period.year, period.month, figures, setting),
      },
      compliance,
    });
  } catch (err) {
    return serverError('tax-period-get', err, 'Gagal memuat detail masa pajak.');
  }
});

/**
 * PATCH /api/v1/tax/periods/[id]
 * Body: { status?, paymentRef?, filingRef?, notes?, override?, paidAt?, filedAt? }
 *
 * Menandai FILED/PAID akan dicek terhadap checklist dokumen. Bila dokumen
 * kritikal belum ada, perubahan ditolak kecuali `override: true` -- supaya
 * status tidak pernah "bersih" padahal arsipnya kosong.
 */
export const PATCH = withTenantGuard(async (req: NextRequest, { auth, params }) => {
  const forbidden = guardAccounting(auth, 'post');
  if (forbidden) return forbidden;

  try {
    const { id } = (await params) as { id: string };
    const body = await req.json().catch(() => ({}));

    const period = await prisma.taxPeriod.findFirst({
      where: { id, workspaceId: auth.workspace.id },
    });
    if (!period) return notFound('Masa pajak tidak ditemukan.');

    let status: TaxPeriodStatus | undefined;
    if (body.status !== undefined) {
      const raw = String(body.status).toUpperCase();
      if (!VALID_STATUS.has(raw)) return badRequest('Status masa pajak tidak dikenal.');
      status = raw as TaxPeriodStatus;
    }

    const compliance = await buildComplianceReport(auth.workspace.id, period.id);
    const criticalMissing = compliance.missing.filter((m) => m.critical);

    if (
      status &&
      (status === TaxPeriodStatus.FILED || status === TaxPeriodStatus.PAID) &&
      criticalMissing.length > 0 &&
      body.override !== true
    ) {
      return NextResponse.json(
        {
          success: false,
          code: 'DOCS_INCOMPLETE',
          message:
            'Dokumen kritikal belum lengkap. Unggah dokumennya, atau kirim ulang dengan override=true beserta alasan.',
          completenessPct: compliance.completenessPct,
          missing: compliance.missing,
        },
        { status: 409 }
      );
    }

    if (body.override === true && status && !asString(body.overrideReason, 300)) {
      return badRequest('Alasan override wajib diisi bila melewati checklist dokumen.');
    }

    const [{ setting }, figures] = await Promise.all([
      getTaxSetting(auth.workspace.id),
      getYearFigures(auth.workspace.id, period.year),
    ]);
    const amount = computePeriodAmount(period.taxType, period.year, period.month, figures, setting);

    const snapshot: Prisma.InputJsonValue | undefined =
      status === TaxPeriodStatus.FILED || status === TaxPeriodStatus.PAID
        ? {
            capturedAt: new Date().toISOString(),
            amount: amount.amount,
            dpp: amount.dpp,
            outputTax: amount.outputTax,
            inputTax: amount.inputTax,
            overpayment: amount.overpayment,
            transactionCount: amount.transactionCount,
            completenessPct: compliance.completenessPct,
            override: body.override === true,
            overrideReason: asString(body.overrideReason, 300),
          }
        : undefined;

    const result = await updatePeriodStatus({
      workspaceId: auth.workspace.id,
      periodId: period.id,
      userId: auth.user.id,
      status,
      paymentRef: body.paymentRef !== undefined ? asString(body.paymentRef, 120) : undefined,
      filingRef: body.filingRef !== undefined ? asString(body.filingRef, 120) : undefined,
      notes: body.notes !== undefined ? asString(body.notes, 1000) : undefined,
      paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
      filedAt: body.filedAt ? new Date(body.filedAt) : undefined,
      snapshot,
    });

    if (!result.ok) return badRequest(result.error);

    await recordActivity(auth.workspace.id, auth.user.id, 'tax.period.updated', {
      periodId: period.id,
      taxType: period.taxType,
      year: period.year,
      month: period.month,
      status: status ?? period.status,
      override: body.override === true,
      completenessPct: compliance.completenessPct,
    });

    return NextResponse.json({
      success: true,
      period: result.period,
      amount,
      compliance,
      warning:
        criticalMissing.length > 0 && body.override === true
          ? 'Status disimpan dengan override. Lengkapi dokumen agar arsip pajak siap diperiksa.'
          : null,
    });
  } catch (err) {
    return serverError('tax-period-patch', err, 'Gagal memperbarui masa pajak.');
  }
});
