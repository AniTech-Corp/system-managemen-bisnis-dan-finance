import { NextRequest, NextResponse } from 'next/server';
import { JournalSource, JournalStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serializeJournal, serverError } from '@/lib/accounting/api';
import { createJournal, JournalValidationError } from '@/lib/accounting/journal-service';
import { PeriodClosedError, monthRange, parsePeriodParam } from '@/lib/accounting/period';
import { journalSnapshot, recordAudit } from '@/lib/audit/audit-trail';

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const { searchParams } = req.nextUrl;
      const statusParam = searchParams.get('status');
      const sourceParam = searchParams.get('source');
      const periodParam = searchParams.get('period');
      const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
      const offset = Math.max(Number(searchParams.get('offset') || 0), 0);

      const where: Record<string, unknown> = { workspaceId: auth.workspace.id };

      if (statusParam && Object.values(JournalStatus).includes(statusParam as JournalStatus)) {
        where.status = statusParam;
      }
      if (sourceParam && Object.values(JournalSource).includes(sourceParam as JournalSource)) {
        where.source = sourceParam;
      }
      if (periodParam) {
        const { year, month } = parsePeriodParam(periodParam);
        const range = monthRange(year, month);
        where.entryDate = { gte: range.startDate, lte: range.endDate };
      }

      const [entries, total] = await Promise.all([
        prisma.journalEntry.findMany({
          where,
          orderBy: [{ entryDate: 'desc' }, { entryNumber: 'desc' }],
          take: limit,
          skip: offset,
          include: {
            lines: {
              orderBy: { lineNo: 'asc' },
              include: { account: { select: { code: true, name: true } } },
            },
          },
        }),
        prisma.journalEntry.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: entries.map(serializeJournal),
        meta: { total, limit, offset },
      });
    } catch (err) {
      return serverError('journals:get', err, 'Gagal memuat daftar jurnal.');
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'draft');
    if (forbidden) return forbidden;

    try {
      const body = await req.json().catch(() => ({}));

      if (!body.entryDate) return badRequest('Tanggal jurnal wajib diisi.');
      const entryDate = new Date(body.entryDate);
      if (Number.isNaN(entryDate.getTime())) return badRequest('Tanggal jurnal tidak valid.');
      if (!Array.isArray(body.lines) || body.lines.length < 2) {
        return badRequest('Jurnal minimal terdiri dari dua baris (debit dan kredit).');
      }

      const entry = await createJournal({
        workspaceId: auth.workspace.id,
        userId: auth.user.id,
        entryDate,
        description: typeof body.description === 'string' ? body.description : 'Jurnal manual',
        source: JournalSource.MANUAL,
        lines: body.lines,
        status: JournalStatus.DRAFT,
      });

      const totalDebit = entry.lines.reduce((acc, line) => acc.plus(line.debit), new Prisma.Decimal(0));

      await recordAudit({
        workspaceId: auth.workspace.id,
        userId: auth.user.id,
        action: 'CREATE',
        entityType: 'JOURNAL_ENTRY',
        entityId: entry.id,
        after: journalSnapshot({
          ...entry,
          lineCount: entry.lines.length,
          totalDebit,
        }),
        metadata: { source: 'manual_journal_form' },
      });

      return NextResponse.json({ success: true, data: serializeJournal(entry) }, { status: 201 });
    } catch (err) {
      if (err instanceof JournalValidationError) return badRequest(err.message);
      if (err instanceof PeriodClosedError) return badRequest(err.message);
      return serverError('journals:post', err, 'Gagal menyimpan jurnal.');
    }
  },
  { minRole: 'VIEWER' }
);
