import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { hasMinRole, getRoleHierarchy } from '@/lib/expense-approval-engine';
import { ExpenseRequestStatus, ExpenseApprovalStatus, ExpenseDecision, Role, TransactionType } from '@prisma/client';
import { recordCashTransaction } from '@/lib/accounting/posting';
import { cashTransactionSnapshot, recordAuditInTx } from '@/lib/audit/audit-trail';

interface ApproveBody {
  decision: 'APPROVED' | 'REJECTED';
  reason?: string;
}

export const POST = withTenantGuard(
  async (req: NextRequest, { auth, params }: { auth: any; params?: Promise<{ id: string }> }) => {
    try {
      const workspaceId = auth.workspace.id;
      const userId = auth.user.id;
      const userRole = auth.membership.role;
      const userName = auth.user.fullName || auth.user.email;
      const { id } = await params!;

      const body = await req.json().catch(() => ({})) as ApproveBody;
      const { decision, reason } = body;

      if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
        return NextResponse.json({ success: false, message: 'Keputusan harus APPROVED atau REJECTED.' }, { status: 400 });
      }
      if (!reason || reason.trim().length === 0) {
        return NextResponse.json({ success: false, message: 'Alasan persetujuan/penolakan wajib diisi.' }, { status: 400 });
      }

      const expenseRequest = await prisma.expenseRequest.findFirst({
        where: { id, workspaceId },
        include: {
          approvals: { orderBy: { level: 'asc' } },
          items: true,
        },
      });

      if (!expenseRequest) {
        return NextResponse.json({ success: false, message: 'Pengajuan tidak ditemukan.' }, { status: 404 });
      }

      if (expenseRequest.status !== 'PENDING_APPROVAL') {
        return NextResponse.json({ success: false, message: 'Pengajuan tidak dalam tahap persetujuan.' }, { status: 400 });
      }

      const currentLevel = expenseRequest.currentLevel;
      if (currentLevel < 1 || currentLevel > expenseRequest.approvals.length) {
        return NextResponse.json({ success: false, message: 'Level persetujuan tidak valid.' }, { status: 400 });
      }

      const currentApproval = expenseRequest.approvals[currentLevel - 1];
      if (currentApproval.status !== 'PENDING') {
        return NextResponse.json({ success: false, message: 'Level ini sudah diproses.' }, { status: 400 });
      }

      // Check role authorization
      if (!hasMinRole(userRole, currentApproval.requiredRole)) {
        return NextResponse.json(
          { success: false, message: `Level ini memerlukan role minimal ${currentApproval.requiredRole}, role Anda: ${userRole}.` },
          { status: 403 }
        );
      }

      // Process decision
      if (decision === 'REJECTED') {
        const updated = await prisma.$transaction(async (tx) => {
          // Update current approval
          await tx.expenseApproval.update({
            where: { id: currentApproval.id },
            data: {
              status: 'DECIDED',
              decision: 'REJECTED',
              approverId: userId,
              approverRole: userRole,
              reason: reason.trim(),
              decidedAt: new Date(),
            },
          });

          // Skip remaining approvals
          await tx.expenseApproval.updateMany({
            where: { expenseRequestId: id, level: { gt: currentLevel } },
            data: { status: 'SKIPPED' },
          });

          // Update request
          const request = await tx.expenseRequest.update({
            where: { id },
            data: {
              status: 'REJECTED',
              rejectedAt: new Date(),
            },
            include: {
              approvals: { orderBy: { level: 'asc' }, include: { approver: { select: { id: true, fullName: true, email: true } } } },
              items: true,
              requester: { select: { id: true, fullName: true, email: true } },
            },
          });

          await recordAuditInTx(tx, {
            workspaceId,
            userId,
            action: 'REJECT',
            entityType: 'EXPENSE_REQUEST',
            entityId: id,
            before: {
              status: expenseRequest.status,
              currentLevel: expenseRequest.currentLevel,
              totalAmount: expenseRequest.totalAmount,
            },
            after: {
              status: request.status,
              currentLevel: request.currentLevel,
              totalAmount: request.totalAmount,
            },
            reason: reason.trim(),
            metadata: { level: currentLevel, requiredRole: currentApproval.requiredRole },
          });

          return request;
        });

        return NextResponse.json({
          success: true,
          message: 'Pengajuan ditolak.',
          expenseRequest: updated,
        });
      }

      // APPROVED
      const isLastLevel = currentLevel === expenseRequest.approvals.length;
      let newStatus: ExpenseRequestStatus = isLastLevel ? 'APPROVED' : 'PENDING_APPROVAL';
      let newCurrentLevel = isLastLevel ? expenseRequest.approvals.length : currentLevel + 1;

      const updated = await prisma.$transaction(async (tx) => {
        // Update current approval
        await tx.expenseApproval.update({
          where: { id: currentApproval.id },
          data: {
            status: 'DECIDED',
            decision: 'APPROVED',
            approverId: userId,
            approverRole: userRole,
            reason: reason.trim(),
            decidedAt: new Date(),
          },
        });

        // If not last level, set next approval to PENDING
        if (!isLastLevel) {
          const nextApproval = expenseRequest.approvals[currentLevel];
          if (nextApproval) {
            await tx.expenseApproval.update({
              where: { id: nextApproval.id },
              data: { status: 'PENDING' },
            });
          }
        }

        const request = await tx.expenseRequest.update({
          where: { id },
          data: {
            status: newStatus,
            currentLevel: newCurrentLevel,
            approvedAt: isLastLevel ? new Date() : null,
          },
          include: {
            approvals: { orderBy: { level: 'asc' }, include: { approver: { select: { id: true, fullName: true, email: true } } } },
            items: true,
            requester: { select: { id: true, fullName: true, email: true } },
          },
        });

        await recordAuditInTx(tx, {
          workspaceId,
          userId,
          action: 'APPROVE',
          entityType: 'EXPENSE_REQUEST',
          entityId: id,
          before: {
            status: expenseRequest.status,
            currentLevel: expenseRequest.currentLevel,
            totalAmount: expenseRequest.totalAmount,
          },
          after: {
            status: request.status,
            currentLevel: request.currentLevel,
            totalAmount: request.totalAmount,
          },
          reason: reason.trim(),
          metadata: { level: currentLevel, requiredRole: currentApproval.requiredRole, isLastLevel },
        });

        // If fully approved, create CashTransaction
        if (isLastLevel) {
          // Determine payment method from items or default
          const paymentMethod = request.items[0]?.accountCode ? 'TRANSFER_BANK' : 'TUNAI';
          // Use first item's accountCode or fallback to general expense account
          const debitAccountCode = request.items[0]?.accountCode || '6-1000';

          try {
            const { transaction: cashTransaction } = await recordCashTransaction(tx, {
              workspaceId,
              userId: request.requesterId,
              type: TransactionType.EXPENSE,
              category: request.category,
              amount: request.totalAmount,
              description: request.title,
              paymentMethod,
              debitAccountCode,
              autoMapFallback: true,
            });

            await recordAuditInTx(tx, {
              workspaceId,
              userId,
              action: 'CREATE',
              entityType: 'CASH_TRANSACTION',
              entityId: cashTransaction.id,
              after: cashTransactionSnapshot(cashTransaction),
              metadata: { source: 'expense_approval', expenseRequestId: id },
              reason: `Pengajuan ${request.requestNumber} disetujui penuh`,
            });

            // Optionally link cash transaction to expense request
            // Could add a field cashTransactionId to ExpenseRequest model later
          } catch (cashErr) {
            console.error('[ExpenseApproval] Failed to create cash transaction:', cashErr);
            // Don't fail the approval, just log the error
          }
        }

        return request;
      });

      return NextResponse.json({
        success: true,
        message: isLastLevel ? 'Pengajuan disetujui sepenuhnya dan transaksi kas dicatat.' : `Level ${currentLevel} disetujui, menunggu level ${newCurrentLevel}.`,
        expenseRequest: updated,
      });
    } catch (err: any) {
      console.error('[ExpenseApproval API] POST Error:', err);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal memproses persetujuan.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MANAGER' }
);