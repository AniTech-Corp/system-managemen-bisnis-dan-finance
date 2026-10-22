import { NextRequest, NextResponse } from 'next/server';
import { Prisma, TaxType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import {
  createOrUpdateWithholding,
  parseWithholdingCsv,
  WITHHOLDING_TYPES,
  type WithholdingInput,
} from '@/lib/tax/service';
import { asNumber, asString, parseIntSafe, parseTaxType } from '@/lib/tax/api';
import { wibToday } from '@/lib/tax/dates';
import { recordActivity } from '@/lib/activity-log';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WITHHOLDING_SET = new Set<TaxType>(WITHHOLDING_TYPES);

function toUuidOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return UUID_RE.test(value) ? value : null;
}

function serialize(row: {
  dpp: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  rate: number;
  [key: string]: unknown;
}) {
  return {
    ...row,
    dpp: row.dpp.toNumber(),
    taxAmount: row.taxAmount.toNumber(),
    rate: row.rate,
  };
}

/** GET /api/v1/tax/withholdings?year=2026&month=10&taxType=PPH_23 */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const sp = req.nextUrl.searchParams;
    const now = wibToday();
    const year = parseIntSafe(sp.get('year'), now.year);
    const monthRaw = sp.get('month');
    const month = monthRaw ? Math.min(12, Math.max(1, parseIntSafe(monthRaw, now.month))) : null;
    const taxType = parseTaxType(sp.get('taxType'));

    const rows = await prisma.taxWithholding.findMany({
      where: {
        workspaceId: auth.workspace.id,
        periodYear: year,
        ...(month ? { periodMonth: month } : {}),
        ...(taxType ? { taxType } : {}),
      },
      orderBy: [{ periodMonth: 'desc' }, { createdAt: 'desc' }],
      take: 2000,
    });

    const totals = rows.reduce(
      (acc, row) => ({
        dpp: acc.dpp + row.dpp.toNumber(),
        taxAmount: acc.taxAmount + row.taxAmount.toNumber(),
      }),
      { dpp: 0, taxAmount: 0 }
    );

    return NextResponse.json({
      success: true,
      year,
      month,
      taxType,
      rows: rows.map(serialize),
      totals,
    });
  } catch (err) {
    return serverError('tax-withholdings-get', err, 'Gagal memuat bukti potong.');
  }
});

/**
 * POST /api/v1/tax/withholdings
 * Tiga bentuk body:
 *   1. Satu bukti potong: { taxType, dpp, rate, periodYear, periodMonth, ... }
 *   2. Impor massal:       { rows: [ ... ] }
 *   3. Tempel CSV:         { csv: "jenis;nama;...\n..." }
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId = auth.workspace.id;

    let inputs: WithholdingInput[] = [];
    const errors: Array<{ line: number; message: string }> = [];
    let sourceType = 'MANUAL';

    if (typeof body.csv === 'string') {
      const parsed = parseWithholdingCsv(body.csv);
      errors.push(...parsed.errors);
      inputs = parsed.rows.map((row) => ({
        taxType: row.taxType,
        sourceType: 'IMPORT',
        partnerName: row.partnerName,
        partnerNpwp: row.partnerNpwp,
        dpp: row.dpp,
        rate: row.rate,
        taxAmount: row.taxAmount,
        periodYear: row.periodYear,
        periodMonth: row.periodMonth,
        docNumber: row.docNumber,
        notes: row.notes,
      }));
      sourceType = 'IMPORT';
    } else if (Array.isArray(body.rows)) {
      for (const raw of body.rows) {
        const taxType = parseTaxType(raw?.taxType);
        if (!taxType || !WITHHOLDING_SET.has(taxType)) {
          errors.push({ line: inputs.length + 1, message: 'Jenis pajak tidak valid.' });
          continue;
        }
        const dpp = asNumber(raw?.dpp);
        const rate = asNumber(raw?.rate);
        const periodYear = asNumber(raw?.periodYear);
        const periodMonth = asNumber(raw?.periodMonth);
        if (dpp === null || dpp < 0) {
          errors.push({ line: inputs.length + 1, message: 'DPP tidak valid.' });
          continue;
        }
        if (periodYear === null || periodMonth === null || periodMonth < 1 || periodMonth > 12) {
          errors.push({ line: inputs.length + 1, message: 'Periode tidak valid.' });
          continue;
        }
        inputs.push({
          taxType,
          sourceType: 'IMPORT',
          sourceId: null,
          partnerName: asString(raw?.partnerName, 150),
          partnerNpwp: asString(raw?.partnerNpwp, 30),
          dpp,
          rate: rate ?? 0,
          taxAmount: asNumber(raw?.taxAmount) ?? undefined,
          periodYear: Math.round(periodYear),
          periodMonth: Math.round(periodMonth),
          docNumber: asString(raw?.docNumber, 120),
          notes: asString(raw?.notes, 500),
        });
      }
      sourceType = 'IMPORT';
    } else {
      const taxType = parseTaxType(body.taxType);
      if (!taxType || !WITHHOLDING_SET.has(taxType)) {
        return badRequest('Jenis pajak harus PPh 21, PPh 23, PPh 4(2), atau PPh 26.');
      }
      const dpp = asNumber(body.dpp);
      if (dpp === null || dpp < 0) return badRequest('DPP wajib diisi dan tidak boleh negatif.');
      const rate = asNumber(body.rate) ?? 0;
      if (rate < 0 || rate > 100) return badRequest('Tarif harus 0-100 (persen).');

      const now = wibToday();
      const periodYear = asNumber(body.periodYear) ?? now.year;
      const periodMonth = asNumber(body.periodMonth) ?? now.month;
      if (periodYear < 2000 || periodYear > 2100 || periodMonth < 1 || periodMonth > 12) {
        return badRequest('Periode pajak tidak valid.');
      }

      inputs = [
        {
          taxType,
          sourceType: asString(body.sourceType, 40) ?? 'MANUAL',
          sourceId: toUuidOrNull(body.sourceId),
          partnerId: toUuidOrNull(body.partnerId),
          partnerName: asString(body.partnerName, 150),
          partnerNpwp: asString(body.partnerNpwp, 30),
          dpp,
          rate,
          taxAmount: asNumber(body.taxAmount) ?? undefined,
          periodYear: Math.round(periodYear),
          periodMonth: Math.round(periodMonth),
          docNumber: asString(body.docNumber, 120),
          notes: asString(body.notes, 500),
        },
      ];
      sourceType = inputs[0].sourceType ?? 'MANUAL';
    }

    if (inputs.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Tidak ada baris valid untuk disimpan.', errors },
        { status: 400 }
      );
    }

    const created = [];
    for (const input of inputs.slice(0, 1000)) {
      created.push(await createOrUpdateWithholding(workspaceId, auth.user.id, input));
    }

    await recordActivity(workspaceId, auth.user.id, 'tax.withholding.imported', {
      count: created.length,
      sourceType,
      taxTypes: Array.from(new Set(inputs.map((i) => i.taxType))),
      errors: errors.length,
    });

    return NextResponse.json(
      {
        success: true,
        created: created.length,
        rows: created.map(serialize),
        errors,
      },
      { status: 201 }
    );
  } catch (err) {
    return serverError('tax-withholdings-post', err, 'Gagal menyimpan bukti potong.');
  }
});
