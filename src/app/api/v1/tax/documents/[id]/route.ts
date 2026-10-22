import { NextRequest, NextResponse } from 'next/server';
import { Prisma, TaxDocStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, notFound, serverError } from '@/lib/accounting/api';
import { asNumber, asString } from '@/lib/tax/api';
import { recordActivity } from '@/lib/activity-log';

const VALID_STATUS = new Set<string>(Object.values(TaxDocStatus));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PATCH /api/v1/tax/documents/[id] — ubah metadata atau verifikasi dokumen. */
export const PATCH = withTenantGuard(async (req: NextRequest, { auth, params }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const { id } = (await params) as { id: string };
    const existing = await prisma.taxDocument.findFirst({
      where: { id, workspaceId: auth.workspace.id },
    });
    if (!existing) return notFound('Dokumen tidak ditemukan.');

    const body = await req.json().catch(() => ({}));
    const data: Prisma.TaxDocumentUpdateInput = {};

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      if (!VALID_STATUS.has(status)) return badRequest('Status dokumen tidak valid.');
      data.status = status as TaxDocStatus;
      if (status === TaxDocStatus.VERIFIED) {
        data.verifiedAt = new Date();
        data.verifiedBy = auth.user.id;
      } else {
        data.verifiedAt = null;
        data.verifiedBy = null;
      }
    }

    if (body.docNumber !== undefined) data.docNumber = asString(body.docNumber, 120);
    if (body.notes !== undefined) data.notes = asString(body.notes, 1000);

    if (body.issueDate !== undefined) {
      if (!body.issueDate) {
        data.issueDate = null;
      } else {
        const parsed = new Date(body.issueDate);
        if (Number.isNaN(parsed.getTime())) return badRequest('Tanggal dokumen tidak valid.');
        data.issueDate = parsed;
      }
    }

    if (body.amount !== undefined) {
      if (body.amount === null || body.amount === '') {
        data.amount = null;
      } else {
        const amount = asNumber(body.amount);
        if (amount === null || amount < 0) return badRequest('Nilai dokumen tidak valid.');
        data.amount = new Prisma.Decimal(amount);
      }
    }

    if (body.fileId !== undefined) {
      const fileId = typeof body.fileId === 'string' && UUID_RE.test(body.fileId) ? body.fileId : null;
      if (fileId) {
        const file = await prisma.workspaceFile.findFirst({
          where: { id: fileId, workspaceId: auth.workspace.id },
          select: { id: true, fileName: true },
        });
        if (!file) return badRequest('File tidak ditemukan di Pusat Data workspace ini.');
        data.fileId = file.id;
        data.fileName = file.fileName;
      } else {
        data.fileId = null;
      }
    }

    const updated = await prisma.taxDocument.update({ where: { id: existing.id }, data });

    await recordActivity(auth.workspace.id, auth.user.id, 'tax.document.updated', {
      documentId: updated.id,
      status: updated.status,
    });

    return NextResponse.json({
      success: true,
      document: {
        ...updated,
        amount: updated.amount === null ? null : updated.amount.toNumber(),
      },
    });
  } catch (err) {
    return serverError('tax-document-patch', err, 'Gagal memperbarui dokumen.');
  }
});

/** DELETE /api/v1/tax/documents/[id] — melepas tautan dokumen (file tetap di Pusat Data). */
export const DELETE = withTenantGuard(async (_req: NextRequest, { auth, params }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const { id } = (await params) as { id: string };
    const existing = await prisma.taxDocument.findFirst({
      where: { id, workspaceId: auth.workspace.id },
      select: { id: true },
    });
    if (!existing) return notFound('Dokumen tidak ditemukan.');

    await prisma.taxDocument.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError('tax-document-delete', err, 'Gagal menghapus dokumen.');
  }
});
