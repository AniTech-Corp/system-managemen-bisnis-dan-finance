import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { parseTaxTypeList, resolveRange } from '@/lib/tax/api';
import { dateKey } from '@/lib/tax/dates';
import { buildExportData, buildTaxCsvZip, buildTaxExcel, buildTaxPdf } from '@/lib/tax/export';
import { recordActivity } from '@/lib/activity-log';

export const runtime = 'nodejs';

/**
 * GET /api/v1/tax/export?format=xlsx|csv|pdf&year=2026&month=10&taxTypes=PPN,PPH_23
 *
 * - xlsx: multi-sheet (ringkasan, per jenis pajak, dokumen, kalender)
 * - csv : ZIP berisi CSV per jenis + README
 * - pdf : ringkasan siap cetak untuk akuntan
 */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const sp = req.nextUrl.searchParams;
    const format = (sp.get('format') ?? 'xlsx').toLowerCase();
    if (!['xlsx', 'csv', 'pdf'].includes(format)) {
      return badRequest('Format harus xlsx, csv, atau pdf.');
    }

    const range = resolveRange(sp);
    if (range.startDate > range.endDate) {
      return badRequest('Tanggal mulai tidak boleh melebihi tanggal akhir.');
    }

    const taxTypes = parseTaxTypeList(sp.get('taxTypes'));
    const data = await buildExportData({
      workspaceId: auth.workspace.id,
      startDate: range.startDate,
      endDate: range.endDate,
      taxTypes,
    });

    const baseName = `Rekap-Pajak-${dateKey(range.startDate)}_${dateKey(range.endDate)}`;

    let body: Buffer;
    let contentType: string;
    let fileName: string;

    if (format === 'xlsx') {
      body = await buildTaxExcel(data);
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      fileName = `${baseName}.xlsx`;
    } else if (format === 'csv') {
      body = await buildTaxCsvZip(data);
      contentType = 'application/zip';
      fileName = `${baseName}.zip`;
    } else {
      body = await buildTaxPdf(data);
      contentType = 'application/pdf';
      fileName = `${baseName}.pdf`;
    }

    await recordActivity(auth.workspace.id, auth.user.id, 'tax.exported', {
      format,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      taxTypes: data.recaps.map((r) => r.taxType),
      documents: data.documents.length,
    });

    return new NextResponse(Buffer.from(body), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    return serverError('tax-export', err, 'Gagal membuat berkas ekspor pajak.');
  }
});
