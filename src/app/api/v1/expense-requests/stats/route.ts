import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const dateFrom = searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')!) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const dateTo = searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')!) : new Date();

      const [
        totalDraft,
        totalSubmitted,
        totalFinanceReview,
        totalPendingApproval,
        totalApproved,
        totalRejected,
        totalCancelled,
        totalAmountApproved,
        totalAmountPending,
        recentRequests,
        myPendingCount,
      ] = await Promise.all([
        prisma.expenseRequest.count({ where: { workspaceId, status: 'DRAFT', createdAt: { gte: dateFrom, lte: dateTo } } }),
        prisma.expenseRequest.count({ where: { workspaceId, status: 'SUBMITTED', createdAt: { gte: dateFrom, lte: dateTo } } }),
        prisma.expenseRequest.count({ where: { workspaceId, status: 'FINANCE_REVIEW', createdAt: { gte: dateFrom, lte: dateTo } } }),
        prisma.expenseRequest.count({ where: { workspaceId, status: 'PENDING_APPROVAL', createdAt: { gte: dateFrom, lte: dateTo } } }),
        prisma.expenseRequest.count({ where: { workspaceId, status: 'APPROVED', createdAt: { gte: dateFrom, lte: dateTo } } }),
        prisma.expenseRequest.count({ where: { workspaceId, status: 'REJECTED', createdAt: { gte: dateFrom, lte: dateTo } } }),
        prisma.expenseRequest.count({ where: { workspaceId, status: 'CANCELLED', createdAt: { gte: dateFrom, lte: dateTo } } }),
        prisma.expenseRequest.aggregate({
          where: { workspaceId, status: 'APPROVED', createdAt: { gte: dateFrom, lte: dateTo } },
          _sum: { totalAmount: true },
        }),
        prisma.expenseRequest.aggregate({
          where: { workspaceId, status: { in: ['FINANCE_REVIEW', 'PENDING_APPROVAL'] }, createdAt: { gte: dateFrom, lte: dateTo } },
          _sum: { totalAmount: true },
        }),
        prisma.expenseRequest.findMany({
          where: { workspaceId, createdAt: { gte: dateFrom, lte: dateTo } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            requester: { select: { id: true, fullName: true } },
            approvals: { where: { status: 'PENDING' }, take: 1 },
          },
        }),
        // For current user's pending approvals count
        prisma.expenseApproval.count({
          where: {
            expenseRequest: { workspaceId },
            status: 'PENDING',
          },
        }),
      ]);

      // Get overdue count (pending > 48 hours)
      const overdueThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000);
      const overdueCount = await prisma.expenseApproval.count({
        where: {
          expenseRequest: { workspaceId },
          status: 'PENDING',
          createdAt: { lte: overdueThreshold },
        },
      });

      // Category breakdown for approved
      const categoryBreakdown = await prisma.expenseRequest.groupBy({
        by: ['category'],
        where: { workspaceId, status: 'APPROVED', createdAt: { gte: dateFrom, lte: dateTo } },
        _sum: { totalAmount: true },
        _count: { id: true },
      });

      // Monthly trend for approved
      const monthlyTrend = await prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as count,
          SUM(total_amount) as amount
        FROM "expense_requests"
        WHERE workspace_id = ${workspaceId}::uuid
          AND "status" = 'APPROVED'
          AND created_at >= ${dateFrom}
          AND created_at <= ${dateTo}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month ASC
      ` as Array<{ month: Date; count: bigint; amount: string | number }>;

      return NextResponse.json({
        success: true,
        stats: {
          byStatus: {
            DRAFT: totalDraft,
            SUBMITTED: totalSubmitted,
            FINANCE_REVIEW: totalFinanceReview,
            PENDING_APPROVAL: totalPendingApproval,
            APPROVED: totalApproved,
            REJECTED: totalRejected,
            CANCELLED: totalCancelled,
          },
          amounts: {
            approved: Number(totalAmountApproved._sum.totalAmount || 0),
            pending: Number(totalAmountPending._sum.totalAmount || 0),
          },
          overdue: overdueCount,
          myPending: myPendingCount,
          categoryBreakdown: categoryBreakdown.map(c => ({
            category: c.category,
            count: c._count.id,
            amount: Number(c._sum.totalAmount || 0),
          })),
          monthlyTrend: monthlyTrend.map(m => ({
            month: m.month.toISOString().slice(0, 7),
            count: Number(m.count),
            amount: Number(m.amount),
          })),
          recentRequests,
        },
        dateRange: { from: dateFrom.toISOString(), to: dateTo.toISOString() },
      });
    } catch (err: any) {
      console.error('[ExpenseStats API] GET Error:', err);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal memuat statistik pengajuan.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'VIEWER' }
);