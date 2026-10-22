import { NextRequest, NextResponse } from 'next/server';
import {
  ComplianceCategory,
  ComplianceStatus,
  Prisma,
  Recurrence,
  TaxType,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, notFound, serverError } from '@/lib/accounting/api';
import { asString, asNumber, parseTaxType } from '@/lib/tax/api';
import { toDeadlineView } from '@/lib/tax/service';
import { recordActivity } from '@/lib/activity-log';

const VALID_CATEGORY = new Set<string>(Object.values(ComplianceCategory));
const VALID_RECURRENCE = new Set<string>(Object.values(Recurrence));
const PERSISTABLE_STATUS = new Set<string>([
  ComplianceStatus.UPCOMING,
  ComplianceStatus.DONE,
  ComplianceStatus.SKIPPED,
]);

/** PATCH /api/v1/tax/deadlines/[id] */
export const PATCH = withTenantGuard(async (req: NextRequest, { auth, params }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const { id } = (await params) as { id: string };
    const existing = await prisma.complianceDeadline.findFirst({
      where: { id, workspaceId: auth.workspace.id },
    });
    if (!existing) return notFound('Tenggat tidak ditemukan.');

    const body = await req.json().catch(() => ({}));
    const data: Prisma.ComplianceDeadlineUpdateInput = {};

    if (body.title !== undefined) {
      const title = asString(body.title, 200);
      if (!title) return badRequest('Judul tidak boleh kosong.');
      data.title = title;
    }

    if (body.description !== undefined) {
      data.description = asString(body.description, 2000);
    }

    if (body.dueDate !== undefined) {
      const parsed = new Date(body.dueDate);
      if (Number.isNaN(parsed.getTime())) return badRequest('Tanggal jatuh tempo tidak valid.');
      data.dueDate = parsed;
    }

    if (body.category !== undefined) {
      const category = String(body.category).toUpperCase();
      if (!VALID_CATEGORY.has(category)) return badRequest('Kategori tidak dikenal.');
      data.category = category as ComplianceCategory;
    }

    if (body.taxType !== undefined) {
      if (body.taxType === null || body.taxType === '') {
        data.taxType = null;
      } else {
        const taxType = parseTaxType(body.taxType);
        if (!taxType) return badRequest('Jenis pajak tidak valid.');
        data.taxType = taxType as TaxType;
      }
    }

    if (body.recurrence !== undefined) {
      const recurrence = String(body.recurrence).toUpperCase();
      if (!VALID_RECURRENCE.has(recurrence)) return badRequest('Pengulangan tidak dikenal.');
      data.recurrence = recurrence as Recurrence;
    }

    if (body.reminderDays !== undefined) {
      if (!Array.isArray(body.reminderDays)) return badRequest('reminderDays harus array.');
      const days: number[] = body.reminderDays
        .map((n: unknown) => asNumber(n))
        .filter((n: number | null): n is number => n !== null && n >= 0 && n <= 365)
        .map((n: number) => Math.round(n));
      data.reminderDays = Array.from(new Set(days)).sort((a, b) => b - a);
    }

    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.evidenceFileId !== undefined) {
      data.evidenceFileId = body.evidenceFileId ? asString(body.evidenceFileId, 64) : null;
    }
    if (body.assignedTo !== undefined) data.assignedTo = asString(body.assignedTo, 64);

    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      if (!PERSISTABLE_STATUS.has(status)) {
        return badRequest('Status hanya boleh UPCOMING, DONE, atau SKIPPED.');
      }
      data.status = status as ComplianceStatus;

      if (status === ComplianceStatus.DONE) {
        data.completedAt = new Date();
        data.completedBy = auth.user.id;
      } else if (status === ComplianceStatus.SKIPPED) {
        data.completedAt = new Date();
        data.completedBy = auth.user.id;
      } else {
        data.completedAt = null;
        data.completedBy = null;
      }
    }

    const updated = await prisma.complianceDeadline.update({ where: { id: existing.id }, data });

    await recordActivity(auth.workspace.id, auth.user.id, 'tax.deadline.updated', {
      deadlineId: existing.id,
      status: updated.status,
      title: updated.title,
    });

    return NextResponse.json({ success: true, deadline: toDeadlineView(updated) });
  } catch (err) {
    return serverError('tax-deadline-patch', err, 'Gagal memperbarui tenggat.');
  }
});

/**
 * DELETE /api/v1/tax/deadlines/[id]
 * Tenggat template tidak dihapus (akan dibuat ulang saat generate), melainkan
 * dinonaktifkan. Tenggat custom dihapus permanen.
 */
export const DELETE = withTenantGuard(async (_req: NextRequest, { auth, params }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const { id } = (await params) as { id: string };
    const existing = await prisma.complianceDeadline.findFirst({
      where: { id, workspaceId: auth.workspace.id },
    });
    if (!existing) return notFound('Tenggat tidak ditemukan.');

    if (existing.source === 'TEMPLATE') {
      await prisma.complianceDeadline.update({
        where: { id: existing.id },
        data: { isActive: false },
      });
      return NextResponse.json({ success: true, deactivated: true });
    }

    await prisma.complianceDeadline.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true, deleted: true });
  } catch (err) {
    return serverError('tax-deadline-delete', err, 'Gagal menghapus tenggat.');
  }
});
