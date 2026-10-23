import { NextRequest, NextResponse } from 'next/server';
import { Prisma, Role } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { serverError } from '@/lib/accounting/api';
import { jakartaEndOfDay, jakartaStartOfDay } from '@/lib/accounting/period';

const FULL_AUDIT_ROLES: Role[] = [Role.OWNER, Role.ADMIN];

function parseAuditDate(value: string, endOfDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return endOfDay ? jakartaEndOfDay(year, month, day) : jakartaStartOfDay(year, month, day);
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * GET /api/v1/accounting/audit-trail
 *
 * OWNER/ADMIN melihat seluruh audit workspace. Peran lain hanya melihat entri
 * yang dibuat oleh dirinya sendiri. Filter tanggal memakai hari kalender WIB
 * agar konsisten dengan laporan keuangan.
 */
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { searchParams } = req.nextUrl;
      const action = searchParams.get('action')?.trim();
      const entityType = searchParams.get('entityType')?.trim();
      const entityId = searchParams.get('entityId')?.trim();
      const userId = searchParams.get('userId')?.trim();
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      const rawLimit = Number(searchParams.get('limit') ?? 50);
      const rawOffset = Number(searchParams.get('offset') ?? 0);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 200) : 50;
      const offset = Number.isFinite(rawOffset) ? Math.max(Math.trunc(rawOffset), 0) : 0;

      const canSeeAll =
        auth.membership.isOwner || FULL_AUDIT_ROLES.includes(auth.membership.role);

      const where: Prisma.AuditLogWhereInput = {
        workspaceId: auth.workspace.id,
        ...(canSeeAll ? {} : { userId: auth.user.id }),
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(entityId ? { entityId } : {}),
        ...(canSeeAll && userId ? { userId } : {}),
      };

      const timestamp: Prisma.DateTimeFilter = {};
      if (startDate) {
        const parsed = parseAuditDate(startDate, false);
        if (parsed) timestamp.gte = parsed;
      }
      if (endDate) {
        const parsed = parseAuditDate(endDate, true);
        if (parsed) timestamp.lte = parsed;
      }
      if (Object.keys(timestamp).length > 0) where.timestamp = timestamp;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        data: logs,
        meta: {
          total,
          limit,
          offset,
          scope: canSeeAll ? 'WORKSPACE' : 'SELF',
        },
      });
    } catch (err) {
      return serverError('audit-trail:get', err, 'Gagal memuat audit trail.');
    }
  },
  { minRole: 'VIEWER' }
);
