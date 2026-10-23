import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { ExpenseRequestStatus } from '@prisma/client';

interface FinanceReviewBody {
  decision: 'APPROVE_TO_NEXT' | 'REJECT' | 'REQUEST_REVISION';
  notes?: string;
}

export const POST = withTenantGuard(
  async (req: NextRequest, { auth, params }: { auth: any; params?: Promise<{ id: string }> }) => {
    try {
      const workspaceId = auth.workspace.id;
      const userId = auth.user.id;
      const userRole = auth.membership.role;
      const userName = auth.user.fullName || auth.user.email;
      const { id } = await params!;

      const body = await req.json().catch(() => ({})) as FinanceReviewBody;
      const { decision, notes } = body;

      if (!decision || !['APPROVE_TO_NEXT', 'REJECT', 'REQUEST_REVISION'].includes(decision)) {
        return NextResponse.json({ success: false, message: 'Keputusan finance review tidak valid.' }, { status: 400 });
      }

      // Check if user has finance role
      const financeRoles = ['FINANCE', 'ADMIN', 'OWNER'];
      if (!financeRoles.includes(userRole)) {
        return NextResponse.json({ success: false, message: 'Hanya tim Finance yang bisa melakukan review.' }, { status: 403 });
      }

      const expenseRequest = await prisma.expenseRequest.findFirst({
        where: { id, workspaceId },
        include: { approvals: { orderBy: { level: 'asc' } } },
      });

      if (!expenseRequest) {
        return NextResponse.json({ success: false, message: 'Pengajuan tidak ditemukan.' }, { status: 404 });
      }

      if (expenseRequest.status !== 'FINANCE_REVIEW') {
        return NextResponse.json({ success: false, message: 'Pengajuan tidak dalam tahap finance review.' }, { status: 400 });
      }

      let newStatus: ExpenseRequestStatus;
      let newCurrentLevel = 0;

      if (decision === 'REJECT') {
        newStatus = 'REJECTED';
      } else if (decision === 'REQUEST_REVISION') {
        newStatus = 'DRAFT';
        newCurrentLevel = 0;
      } else { // APPROVE_TO_NEXT
        // Check if approval chain exists
        if (expenseRequest.approvals.length > 0) {
          newStatus = 'PENDING_APPROVAL';
          newCurrentLevel = 1;
        } else {
          newStatus = 'APPROVED';
          newCurrentLevel = 0;
        }
      }

      const updated = await prisma.$transaction(async (tx) => {
        const request = await tx.expenseRequest.update({
          where: { id },
          data: {
            status: newStatus,
            currentLevel: newCurrentLevel,
            financeReviewerId: userId,
            financeReviewedAt: new Date(),
            financeNotes: notes?.trim() || null,
            rejectedAt: newStatus === 'REJECTED' ? new Date() : null,
            approvedAt: newStatus === 'APPROVED' ? new Date() : null,
          },
          include: {
            approvals: { orderBy: { level: 'asc' }, include: { approver: { select: { id: true, fullName: true, email: true } } } },
            items: true,
            requester: { select: { id: true, fullName: true, email: true } },
          },
        });

        // If rejected, mark all approvals as SKIPPED
        if (newStatus === 'REJECTED') {
          await tx.expenseApproval.updateMany({
            where: { expenseRequestId: id },
            data: { status: 'SKIPPED' },
          });
        }

        // If going back to draft, clear approvals
        if (newStatus === 'DRAFT') {
          await tx.expenseApproval.deleteMany({ where: { expenseRequestId: id } });
        }

        return request;
      });

      return NextResponse.json({
        success: true,
        message: decision === 'REJECT' ? 'Pengajuan ditolak oleh Finance.' :
                 decision === 'REQUEST_REVISION' ? 'Pengajuan dikembalikan untuk revisi.' :
                 'Finance review selesai, lanjut ke persetujuan.',
        expenseRequest: updated,
      });
    } catch (err: any) {
      console.error('[FinanceReview API] POST Error:', err);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal memproses finance review.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'ADMIN' }
);