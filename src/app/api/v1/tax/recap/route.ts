import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { buildRecap } from '@/lib/tax/service';
import { parseTaxType, resolveRange } from '@/lib/tax/api';

/**
 * GET /api/v1/tax/recap?taxType=PPN&year=2026&month=10&groupBy=category
 * Rekap transaksi relevan per jenis pajak. `groupBy` = category | source | month.
 */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const sp = req.nextUrl.searchParams;
    const taxType = parseTaxType(sp.get('taxType'));
    if (!taxType) return badRequest('Jenis pajak (taxType) wajib diisi dan valid.');

    const groupRaw = sp.get('groupBy');
    const groupBy =
      groupRaw === 'source' || groupRaw === 'month' || groupRaw === 'category'
        ? groupRaw
        : 'category';

    const range = resolveRange(sp);
    const recap = await buildRecap({
      workspaceId: auth.workspace.id,
      taxType,
      startDate: range.startDate,
      endDate: range.endDate,
      groupBy,
    });

    return NextResponse.json({ success: true, ...recap, groupBy });
  } catch (err) {
    return serverError('tax-recap', err, 'Gagal menyusun rekap pajak.');
  }
});
