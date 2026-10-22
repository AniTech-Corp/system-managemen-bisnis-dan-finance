import { NextRequest, NextResponse } from 'next/server';
import {
  ComplianceCategory,
  ComplianceSource,
  ComplianceStatus,
  Recurrence,
  TaxType,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import {
  ensureDeadlinesForYear,
  getTaxSetting,
  toDeadlineView,
} from '@/lib/tax/service';
import { asString, parseIntSafe, parseTaxType, resolveRange } from '@/lib/tax/api';
import { wibToday } from '@/lib/tax/dates';

const VALID_CATEGORY = new Set<string>(Object.values(ComplianceCategory));
const VALID_RECURRENCE = new Set<string>(Object.values(Recurrence));

/** GET /api/v1/tax/deadlines?year=2026&from=...&to=...&status=OVERDUE */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'view');
  if (forbidden) return forbidden;

  try {
    const sp = req.nextUrl.searchParams;
    const now = wibToday();
    const yearParam = sp.get('year');

    const { setting } = await getTaxSetting(auth.workspace.id);
    if (yearParam) {
      const year = parseIntSafe(yearParam, now.year);
      await ensureDeadlinesForYear(auth.workspace.id, year, setting);
    } else {
      await Promise.all([
        ensureDeadlinesForYear(auth.workspace.id, now.year, setting),
        ensureDeadlinesForYear(auth.workspace.id, now.year + 1, setting),
      ]);
    }

    const range = resolveRange(sp);
    const taxType = parseTaxType(sp.get('taxType'));
    const statusFilter = sp.get('status')?.toUpperCase() ?? null;

    const rows = await prisma.complianceDeadline.findMany({
      where: {
        workspaceId: auth.workspace.id,
        isActive: true,
        dueDate: { gte: range.startDate, lte: range.endDate },
        ...(taxType ? { taxType } : {}),
      },
      orderBy: { dueDate: 'asc' },
      take: 1000,
    });

    const views = rows
      .map((row) => toDeadlineView(row))
      .filter((row) => (statusFilter ? row.status === statusFilter : true));

    const summary = views.reduce(
      (acc, row) => {
        acc.total += 1;
        acc[row.status] = (acc[row.status] ?? 0) + 1;
        return acc;
      },
      { total: 0 } as Record<string, number>
    );

    return NextResponse.json({
      success: true,
      startDate: range.startDate.toISOString(),
      endDate: range.endDate.toISOString(),
      deadlines: views,
      summary,
    });
  } catch (err) {
    return serverError('tax-deadlines-get', err, 'Gagal memuat kalender kepatuhan.');
  }
});

/**
 * POST /api/v1/tax/deadlines
 * Body: { title, dueDate, category?, taxType?, description?, recurrence?, reminderDays? }
 * atau { generateYear: 2026 } untuk menyegarkan tenggat template.
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  const forbidden = guardAccounting(auth, 'draft');
  if (forbidden) return forbidden;

  try {
    const body = await req.json().catch(() => ({}));
    const workspaceId = auth.workspace.id;

    if (body.generateYear !== undefined) {
      const year = parseIntSafe(body.generateYear, wibToday().year);
      if (year < 2000 || year > 2100) return badRequest('Tahun tidak valid.');
      const { setting } = await getTaxSetting(workspaceId);
      const created = await ensureDeadlinesForYear(workspaceId, year, setting);
      return NextResponse.json({ success: true, year, created });
    }

    const title = asString(body.title, 200);
    if (!title) return badRequest('Judul tenggat wajib diisi.');

    const dueDate = body.dueDate ? new Date(body.dueDate) : null;
    if (!dueDate || Number.isNaN(dueDate.getTime())) {
      return badRequest('Tanggal jatuh tempo tidak valid.');
    }

    const categoryRaw = String(body.category ?? 'TAX').toUpperCase();
    if (!VALID_CATEGORY.has(categoryRaw)) return badRequest('Kategori tidak dikenal.');

    const taxType = body.taxType ? parseTaxType(body.taxType) : null;
    if (body.taxType && !taxType) return badRequest('Jenis pajak tidak valid.');

    const recurrenceRaw = String(body.recurrence ?? 'ONE_OFF').toUpperCase();
    if (!VALID_RECURRENCE.has(recurrenceRaw)) return badRequest('Pengulangan tidak dikenal.');

    const reminderDays: number[] = Array.isArray(body.reminderDays)
      ? body.reminderDays
          .map((n: unknown) => Number(n))
          .filter((n: number) => Number.isFinite(n) && n >= 0 && n <= 365)
          .map((n: number) => Math.round(n))
      : [7, 3, 1];

    const row = await prisma.complianceDeadline.create({
      data: {
        workspaceId,
        title,
        description: asString(body.description, 2000),
        category: categoryRaw as ComplianceCategory,
        taxType: taxType as TaxType | null,
        dueDate,
        recurrence: recurrenceRaw as Recurrence,
        source: ComplianceSource.CUSTOM,
        status: ComplianceStatus.UPCOMING,
        reminderDays: Array.from(new Set(reminderDays)).sort((a, b) => b - a),
        assignedTo: asString(body.assignedTo, 64),
        isActive: true,
      },
    });

    return NextResponse.json(
      { success: true, deadline: toDeadlineView(row) },
      { status: 201 }
    );
  } catch (err) {
    return serverError('tax-deadlines-post', err, 'Gagal membuat tenggat.');
  }
});
