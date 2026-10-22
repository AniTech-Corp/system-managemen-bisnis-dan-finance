import { NextRequest, NextResponse } from 'next/server';
import { ComplianceStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { guardAccounting, serverError } from '@/lib/accounting/api';
import { ensureDeadlinesForYear, getTaxSetting, toDeadlineView } from '@/lib/tax/service';
import { dateAtWibMidnight, wibParts, wibToday } from '@/lib/tax/dates';
import { recordActivity } from '@/lib/activity-log';

/**
 * POST /api/v1/tax/reminders/run
 *
 * Menghitung tenggat yang terlambat/segera dan mencatat SATU activity event
 * ringkasan per hari (idempoten kecuali `force: true`). Fase ini sengaja hanya
 * in-app: belum mengirim WhatsApp/email, agar tidak ada pesan ganda.
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId = auth.workspace.id;
    const now = new Date();
    const today = wibToday(now);

    const { setting } = await getTaxSetting(workspaceId);
    await Promise.all([
      ensureDeadlinesForYear(workspaceId, today.year, setting),
      ensureDeadlinesForYear(workspaceId, today.year + 1, setting),
    ]);

    const rows = await prisma.complianceDeadline.findMany({
      where: { workspaceId, isActive: true },
      orderBy: { dueDate: 'asc' },
      take: 500,
    });

    const views = rows.map((row) => toDeadlineView(row, now));
    const actionable = views.filter(
      (d) =>
        d.status === ComplianceStatus.OVERDUE || d.status === ComplianceStatus.DUE_SOON
    );

    const dayStart = dateAtWibMidnight(
      wibParts(now).year,
      wibParts(now).month,
      wibParts(now).day
    );

    const existing = await prisma.activityEvent.findFirst({
      where: {
        workspaceId,
        type: 'tax.reminder',
        createdAt: { gte: dayStart },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, payload: true },
    });

    if (existing && body.force !== true) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Pengingat hari ini sudah dicatat.',
        existing: { id: existing.id, createdAt: existing.createdAt, payload: existing.payload },
        actionable: actionable.length,
        reminders: actionable.slice(0, 20),
      });
    }

    const overdue = actionable.filter((d) => d.status === ComplianceStatus.OVERDUE);
    const dueSoon = actionable.filter((d) => d.status === ComplianceStatus.DUE_SOON);

    await recordActivity(workspaceId, auth.user.id, 'tax.reminder', {
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      items: actionable.slice(0, 12).map((d) => ({
        title: d.title,
        dueDate: d.dueDateKey,
        status: d.status,
        daysUntil: d.daysUntil,
      })),
      channel: setting.taxReminderChannel,
    });

    return NextResponse.json({
      success: true,
      skipped: false,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      actionable: actionable.length,
      reminders: actionable.slice(0, 20),
    });
  } catch (err) {
    return serverError('tax-reminders-run', err, 'Gagal menjalankan pengingat pajak.');
  }
});
