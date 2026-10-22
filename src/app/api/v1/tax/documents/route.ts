import { NextRequest, NextResponse } from 'next/server';
import { Prisma, TaxDocStatus, TaxDocType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { asNumber, asString } from '@/lib/tax/api';
import { recordActivity } from '@/lib/activity-log';

const VALID_DOC_TYPES = new Set<string>(Object.values(TaxDocType));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(value: unknown): string | null {
  return typeof value === 'string' && UUID_RE.test(value) ? value : null;
}

/** GET /api/v1/tax/documents?taxPeriodId=...&deadlineId=...&docType=... */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const sp = req.nextUrl.searchParams;
    const taxPeriodId = uuidOrNull(sp.get('taxPeriodId'));
    const deadlineId = uuidOrNull(sp.get('deadlineId'));
    const docTypeRaw = sp.get('docType')?.toUpperCase();
    const docType = docTypeRaw && VALID_DOC_TYPES.has(docTypeRaw) ? (docTypeRaw as TaxDocType) : null;

    const rows = await prisma.taxDocument.findMany({
      where: {
        workspaceId: auth.workspace.id,
        ...(taxPeriodId ? { taxPeriodId } : {}),
        ...(deadlineId ? { deadlineId } : {}),
        ...(docType ? { docType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    return NextResponse.json({
      success: true,
      documents: rows.map((d) => ({
        ...d,
        amount: d.amount === null ? null : d.amount.toNumber(),
      })),
    });
  } catch (err) {
    return serverError('tax-documents-get', err, 'Gagal memuat dokumen pajak.');
  }
});

/**
 * POST /api/v1/tax/documents
 * Body: { docType, fileId?, fileName?, taxPeriodId?, deadlineId?, docNumber?,
 *         issueDate?, amount?, sourceType?, sourceId?, notes? }
 *
 * File diunggah lebih dulu ke /api/v1/workspace-files, lalu id-nya ditautkan
 * di sini. `sourceType`/`sourceId` menghubungkan dokumen ke transaksi asal
 * (mis. INVOICE/<invoiceId>) agar checklist otomatis tahu apa yang kurang.
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId = auth.workspace.id;

    const docTypeRaw = String(body.docType ?? '').toUpperCase();
    if (!VALID_DOC_TYPES.has(docTypeRaw)) return badRequest('Tipe dokumen tidak valid.');
    const docType = docTypeRaw as TaxDocType;

    const fileId = uuidOrNull(body.fileId);
    let fileName = asString(body.fileName, 255);

    if (fileId) {
      const file = await prisma.workspaceFile.findFirst({
        where: { id: fileId, workspaceId },
        select: { id: true, fileName: true },
      });
      if (!file) return badRequest('File tidak ditemukan di Pusat Data workspace ini.');
      fileName = fileName ?? file.fileName;
    }

    if (!fileId && !fileName) {
      return badRequest('Lampirkan file atau isi nama dokumen.');
    }

    let taxPeriodId = uuidOrNull(body.taxPeriodId);
    const deadlineId = uuidOrNull(body.deadlineId);

    if (deadlineId) {
      const deadline = await prisma.complianceDeadline.findFirst({
        where: { id: deadlineId, workspaceId },
        select: { id: true, taxPeriodId: true },
      });
      if (!deadline) return badRequest('Tenggat tidak ditemukan.');
      if (!taxPeriodId) taxPeriodId = deadline.taxPeriodId;
    }

    if (taxPeriodId) {
      const period = await prisma.taxPeriod.findFirst({
        where: { id: taxPeriodId, workspaceId },
        select: { id: true },
      });
      if (!period) return badRequest('Masa pajak tidak ditemukan.');
    }

    const sourceType = asString(body.sourceType, 40)?.toUpperCase() ?? null;
    const sourceId = uuidOrNull(body.sourceId);

    let issueDate: Date | null = null;
    if (body.issueDate) {
      const parsed = new Date(body.issueDate);
      if (Number.isNaN(parsed.getTime())) return badRequest('Tanggal dokumen tidak valid.');
      issueDate = parsed;
    }

    const amountRaw = asNumber(body.amount);
    if (amountRaw !== null && amountRaw < 0) return badRequest('Nilai dokumen tidak valid.');

    const row = await prisma.taxDocument.create({
      data: {
        workspaceId,
        taxPeriodId,
        deadlineId,
        fileId,
        docType,
        status: TaxDocStatus.PENDING,
        docNumber: asString(body.docNumber, 120),
        issueDate,
        amount: amountRaw === null ? null : new Prisma.Decimal(amountRaw),
        sourceType,
        sourceId,
        fileName,
        notes: asString(body.notes, 1000),
        uploadedBy: auth.user.id,
      },
    });

    await recordActivity(workspaceId, auth.user.id, 'tax.document.uploaded', {
      documentId: row.id,
      docType: row.docType,
      taxPeriodId: row.taxPeriodId,
      hasFile: Boolean(row.fileId),
    });

    return NextResponse.json(
      {
        success: true,
        document: { ...row, amount: row.amount === null ? null : row.amount.toNumber() },
      },
      { status: 201 }
    );
  } catch (err) {
    return serverError('tax-documents-post', err, 'Gagal menyimpan dokumen pajak.');
  }
});
