import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { hasMinRole } from '@/lib/expense-approval-engine';
import { Role } from '@prisma/client';

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const userId = auth.user.id;
      const userRole = auth.membership.role;
      const { searchParams } = req.nextUrl;

      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
      const tab = searchParams.get('tab') || 'pending'; // pending | history

      // Find expense requests where user is the current approver
      const pendingApprovals = await prisma.expenseApproval.findMany({
        where: {
          expenseRequest: { workspaceId },
          status: 'PENDING',
          requiredRole: { in: getAuthorizedRoles(userRole) },
        },
        include: {
          expenseRequest: {
            include: {
              requester: { select: { id: true, fullName: true, email: true } },
              items: true,
              approvals: {
                include: {
                  approver: { select: { id: true, fullName: true, email: true } },
                },
                orderBy: { level: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Also get history (already decided by this user)
      const historyApprovals = await prisma.expenseApproval.findMany({
        where: {
          expenseRequest: { workspaceId },
          approverId: userId,
          status: 'DECIDED',
        },
        include: {
          expenseRequest: {
            include: {
              requester: { select: { id: true, fullName: true, email: true } },
              items: true,
              approvals: {
                include: {
                  approver: { select: { id: true, fullName: true, email: true } },
                },
                orderBy: { level: 'asc' },
              },
            },
          },
        },
        orderBy: { decidedAt: 'desc' },
        take: 50,
      });

      // Group by request for pending
      const pendingByRequest = new Map();
      for (const approval of pendingApprovals) {
        if (approval.expenseRequest) {
          const reqId = approval.expenseRequest.id;
          if (!pendingByRequest.has(reqId)) {
            pendingByRequest.set(reqId, {
              expenseRequest: approval.expenseRequest,
              currentApproval: approval,
            });
          }
        }
      }

      // Group by request for history
      const historyByRequest = new Map();
      for (const approval of historyApprovals) {
        if (approval.expenseRequest) {
          const reqId = approval.expenseRequest.id;
          if (!historyByRequest.has(reqId)) {
            historyByRequest.set(reqId, {
              expenseRequest: approval.expenseRequest,
              userApprovals: [],
            });
          }
          historyByRequest.get(reqId).userApprovals.push(approval);
        }
      }

      const pendingList = Array.from(pendingByRequest.values());
      const historyList = Array.from(historyByRequest.values());

      // Paginate
      const data = tab === 'history' ? historyList : pendingList;
      const total = data.length;
      const start = (page - 1) * limit;
      const paginatedData = data.slice(start, start + limit);

      return NextResponse.json({
        success: true,
        data: {
          pending: tab === 'pending' ? paginatedData : [],
          history: tab === 'history' ? paginatedData : [],
        },
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        currentTab: tab,
      });
    } catch (err: any) {
      console.error('[Pending Approvals API] GET Error:', err);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal memuat persetujuan menunggu.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'MANAGER' }
);

function getAuthorizedRoles(userRole: Role): Role[] {
  const hierarchy: Record<Role, number> = {
    OWNER: 5,
    ADMIN: 4,
    MANAGER: 3,
    MEMBER: 2,
    VIEWER: 1,
  };
  const userLevel = hierarchy[userRole] ?? 0;
  const allRoles: Role[] = ['OWNER', 'ADMIN', 'MANAGER', 'MEMBER', 'VIEWER'];
  return allRoles.filter(r => hierarchy[r] <= userLevel);
}