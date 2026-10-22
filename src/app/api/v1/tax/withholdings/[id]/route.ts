import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, notFound, serverError } from '@/lib/accounting/api';
import { asNumber, asString, parseTaxType } from '@/lib/tax/api';
import { round2 } from '@/lib/tax/calc';
import { WITHHOLDING_TYPES } from '@/lib/tax/service';

const WITHHOLDING_SET = new Set(WITHHOLDING_TYPES);

export const PATCH = withTenantGuard(async (req: NextRequest, { auth, params }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const { id } = (await params) as { id: string };
    const existing = await prisma.taxWithholding.findFirst({
      where: { id, workspaceId: auth.workspace.id },
    });
    if (!existing) return notFound('Bukti potong tidak ditemukan.');

    const body = await req.json().catch(() => ({}));
    const data: Prisma.TaxWithholdingUpdateInput = {};
    let effectiveTaxType = existing.taxType;

    if (body.taxType !== undefined) {
      const taxType = parseTaxType(body.taxType);
      if (!taxType || !WITHHOLDING_SET.has(taxType)) {
        return badRequest('Jenis pajak tidak valid untuk bukti potong.');
      }
      effectiveTaxType = taxType;
      data.taxType = taxType;
    }

    const dpp = body.dpp !== undefined ? asNumber(body.dpp) : existing.dpp.toNumber();
    if (dpp === null || dpp < 0) return badRequest('DPP tidak valid.');
    const rate = body.rate !== undefined ? asNumber(body.rate) : existing.rate;
    if (rate === null || rate < 0 || rate > 100) return badRequest('Tarif harus 0-100.');

    if (body.dpp !== undefined) data.dpp = new Prisma.Decimal(dpp);
    if (body.rate !== undefined) data.rate = rate;

    if (body.taxAmount !== undefined) {
      const taxAmount = asNumber(body.taxAmount);
      if (taxAmount === null || taxAmount < 0) return badRequest('Nilai potongan tidak valid.');
      data.taxAmount = new Prisma.Decimal(taxAmount);
    } else if (body.dpp !== undefined || body.rate !== undefined) {
      data.taxAmount = new Prisma.Decimal(round2((dpp * rate) / 100));
    }

    if (
      body.periodYear !== undefined ||
      body.periodMonth !== undefined ||
      body.taxType !== undefined
    ) {
      const year = body.periodYear !== undefined ? asNumber(body.periodYear) : existing.periodYear;
      const month = body.periodMonth !== undefined ? asNumber(body.periodMonth) : existing.periodMonth;
      if (year === null || year < 2000 || year > 2100) return badRequest('Tahun periode tidak valid.');
      if (month === null || month < 1 || month > 12) return badRequest('Bulan periode tidak valid.');
      data.periodYear = Math.round(year);
      data.periodMonth = Math.round(month);

      const period = await prisma.taxPeriod.findUnique({
        where: {
          workspaceId_taxType_year_month: {
            workspaceId: auth.workspace.id,
            taxType: effectiveTaxType,
            year: Math.round(year),
            month: Math.round(month),
          },
        },
        select: { id: true },
      });
      data.taxPeriodId = period?.id ?? null;
    }

    if (body.partnerName !== undefined) data.partnerName = asString(body.partnerName, 150);
    if (body.partnerNpwp !== undefined) data.partnerNpwp = asString(body.partnerNpwp, 30);
    if (body.docNumber !== undefined) data.docNumber = asString(body.docNumber, 120);
    if (body.notes !== undefined) data.notes = asString(body.notes, 500);

    const updated = await prisma.taxWithholding.update({ where: { id: existing.id }, data });
    return NextResponse.json({
      success: true,
      row: {
        ...updated,
        dpp: updated.dpp.toNumber(),
        taxAmount: updated.taxAmount.toNumber(),
      },
    });
  } catch (err) {
    return serverError('tax-withholding-patch', err, 'Gagal memperbarui bukti potong.');
  }
});

export const DELETE = withTenantGuard(async (_req: NextRequest, { auth, params }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const { id } = (await params) as { id: string };
    const existing = await prisma.taxWithholding.findFirst({
      where: { id, workspaceId: auth.workspace.id },
      select: { id: true },
    });
    if (!existing) return notFound('Bukti potong tidak ditemukan.');

    await prisma.taxWithholding.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('tax-withholding-delete', err, 'Gagal menghapus bukti potong.');
  }
});
