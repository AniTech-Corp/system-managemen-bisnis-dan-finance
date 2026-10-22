import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { evaluateExpenseApproval, generateRequestNumber } from '@/lib/expense-approval-engine';
import { ExpenseCategory, ExpenseRequestStatus, Role } from '@prisma/client';

interface ExpenseRequestItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  accountCode?: string;
}

function validateItems(raw: unknown): { items: ExpenseRequestItemInput[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Minimal 1 item pengeluaran wajib diisi.' };
  }
  if (raw.length > 50) {
    return { error: 'Maksimal 50 item per pengajuan.' };
  }
  const items: ExpenseRequestItemInput[] = [];
  for (const entry of raw) {
    const description = (entry as any)?.description?.trim?.();
    const quantity = Number((entry as any)?.quantity);
    const unitPrice = Number((entry as any)?.unitPrice);
    const accountCode = (entry as any)?.accountCode?.trim?.();

    if (!description) {
      return { error: 'Deskripsi setiap item wajib diisi.' };
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000) {
      return { error: `Qty untuk item "${description}" harus angka antara 0 dan 1.000.000.` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 1_000_000_000_000) {
      return { error: `Harga satuan untuk item "${description}" tidak valid (maks Rp1 triliun).` };
    }
    items.push({ description, quantity, unitPrice, accountCode });
  }
  return { items };
}

function validateCategory(category: string): category is ExpenseCategory {
  return Object.values(ExpenseCategory).includes(category as ExpenseCategory);
}

export const GET = withTenantGuard(
  async (req: NextRequest, { auth, params }: { auth: any; params?: Promise<{ id: string }> }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { id } = await params!;

      const expenseRequest = await prisma.expenseRequest.findFirst({
        where: { id, workspaceId },
        include: {
          requester: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          financeReviewer: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
          items: true,
          approvals: {
            include: {
              approver: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
            },
            orderBy: { level: 'asc' },
          },
        },
      });

      if (!expenseRequest) {
        return NextResponse.json(
          { success: false, message: 'Pengajuan tidak ditemukan.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        expenseRequest,
      });
    } catch (err: any) {
      console.error('[ExpenseRequest Detail API] GET Error:', err);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal memuat detail pengajuan.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'VIEWER' }
);

export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth, params }: { auth: any; params?: Promise<{ id: string }> }) => {
    try {
      const workspaceId = auth.workspace.id;
      const userId = auth.user.id;
      const userRole = auth.membership.role;
      const userName = auth.user.fullName || auth.user.email;
      const { id } = await params!;

      const body = await req.json().catch(() => ({}));
      const action = body?.action; // SUBMIT | CANCEL | UPDATE_DRAFT | FINANCE_REVIEW

      const expenseRequest = await prisma.expenseRequest.findFirst({
        where: { id, workspaceId },
        include: { items: true, approvals: true },
      });

      if (!expenseRequest) {
        return NextResponse.json(
          { success: false, message: 'Pengajuan tidak ditemukan.' },
          { status: 404 }
        );
      }

      // Authorization checks
      const isRequester = expenseRequest.requesterId === userId;
      const isFinance = ['FINANCE', 'ADMIN', 'OWNER'].includes(userRole);
      const isAdmin = ['ADMIN', 'OWNER'].includes(userRole);

      // Handle different actions
      switch (action) {
        case 'UPDATE_DRAFT': {
          if (!isRequester) {
            return NextResponse.json({ success: false, message: 'Hanya pengaju yang bisa mengedit draft.' }, { status: 403 });
          }
          if (expenseRequest.status !== 'DRAFT') {
            return NextResponse.json({ success: false, message: 'Hanya draft yang bisa diedit.' }, { status: 400 });
          }

          const title = body?.title?.trim?.();
          const description = body?.description?.trim?.();
          const category = body?.category?.trim?.();
          const receiptUrls = Array.isArray(body?.receiptUrls) ? body.receiptUrls.filter((u: any) => typeof u === 'string') : [];
          const itemsRaw = body?.items;

          if (!title || !description || !category || !validateCategory(category)) {
            return NextResponse.json({ success: false, message: 'Data pengajuan tidak lengkap.' }, { status: 400 });
          }

          const parsedItems = validateItems(itemsRaw);
          if ('error' in parsedItems) {
            return NextResponse.json({ success: false, message: parsedItems.error }, { status: 400 });
          }
          const items = parsedItems.items;
          const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

          const evaluation = evaluateExpenseApproval(totalAmount);

          const updated = await prisma.$transaction(async (tx) => {
            // Delete old items
            await tx.expenseRequestItem.deleteMany({ where: { expenseRequestId: id } });
            // Delete old approvals
            await tx.expenseApproval.deleteMany({ where: { expenseRequestId: id } });

            const request = await tx.expenseRequest.update({
              where: { id },
              data: {
                title,
                description,
                category,
                totalAmount,
                receiptUrls,
                requiredLevels: evaluation.levels,
                items: {
                  create: items.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.quantity * item.unitPrice,
                    accountCode: item.accountCode,
                  })),
                },
              },
              include: { items: true, approvals: true },
            });

            return request;
          });

          return NextResponse.json({
            success: true,
            message: 'Draft berhasil diperbarui.',
            expenseRequest: updated,
          });
        }

        case 'SUBMIT': {
          if (!isRequester) {
            return NextResponse.json({ success: false, message: 'Hanya pengaju yang bisa mengajukan.' }, { status: 403 });
          }
          if (expenseRequest.status !== 'DRAFT') {
            return NextResponse.json({ success: false, message: 'Hanya draft yang bisa diajukan.' }, { status: 400 });
          }

          const evaluation = evaluateExpenseApproval(expenseRequest.totalAmount);
          let newStatus: ExpenseRequestStatus = evaluation.requiresFinanceReview ? 'FINANCE_REVIEW' :
                                                (evaluation.requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED');

          const updated = await prisma.$transaction(async (tx) => {
            // Create approval chain
            if (evaluation.requiresApproval) {
              for (const step of evaluation.approvalChain) {
                await tx.expenseApproval.create({
                  data: {
                    expenseRequestId: id,
                    level: step.level,
                    requiredRole: step.role,
                    status: 'PENDING',
                  },
                });
              }
            }

            const request = await tx.expenseRequest.update({
              where: { id },
              data: {
                status: newStatus,
                currentLevel: newStatus === 'PENDING_APPROVAL' ? 1 : 0,
                submittedAt: new Date(),
                approvedAt: newStatus === 'APPROVED' ? new Date() : null,
              },
              include: { items: true, approvals: { orderBy: { level: 'asc' } } },
            });

            return request;
          });

          return NextResponse.json({
            success: true,
            message: newStatus === 'APPROVED' ? 'Pengajuan otomatis disetujui (di bawah ambang).' : 'Pengajuan berhasil dikirim untuk review.',
            expenseRequest: updated,
          });
        }

        case 'CANCEL': {
          if (!isRequester && !isAdmin) {
            return NextResponse.json({ success: false, message: 'Tidak berhak membatalkan pengajuan ini.' }, { status: 403 });
          }
          if (['APPROVED', 'REJECTED', 'CANCELLED'].includes(expenseRequest.status)) {
            return NextResponse.json({ success: false, message: 'Pengajuan sudah final, tidak bisa dibatalkan.' }, { status: 400 });
          }

          const updated = await prisma.expenseRequest.update({
            where: { id },
            data: { status: 'CANCELLED' },
            include: { items: true, approvals: true },
          });

          return NextResponse.json({
            success: true,
            message: 'Pengajuan dibatalkan.',
            expenseRequest: updated,
          });
        }

        case 'FINANCE_REVIEW': {
          if (!isFinance) {
            return NextResponse.json({ success: false, message: 'Hanya tim Finance yang bisa melakukan review.' }, { status: 403 });
          }
          if (expenseRequest.status !== 'FINANCE_REVIEW') {
            return NextResponse.json({ success: false, message: 'Pengajuan tidak dalam tahap finance review.' }, { status: 400 });
          }

          const financeDecision = body?.decision; // APPROVE_TO_NEXT | REJECT | REQUEST_REVISION
          const financeNotes = body?.notes?.trim?.();

          if (!financeDecision) {
            return NextResponse.json({ success: false, message: 'Keputusan finance review wajib diisi.' }, { status: 400 });
          }

          let newStatus: ExpenseRequestStatus;
          let currentLevel = 0;

          if (financeDecision === 'REJECT') {
            newStatus = 'REJECTED';
          } else if (financeDecision === 'REQUEST_REVISION') {
            newStatus = 'DRAFT';
            currentLevel = 0;
          } else { // APPROVE_TO_NEXT
            const evaluation = evaluateExpenseApproval(expenseRequest.totalAmount);
            if (evaluation.requiresApproval) {
              newStatus = 'PENDING_APPROVAL';
              currentLevel = 1;
            } else {
              newStatus = 'APPROVED';
              currentLevel = 0;
            }
          }

          const updated = await prisma.$transaction(async (tx) => {
            const request = await tx.expenseRequest.update({
              where: { id },
              data: {
                status: newStatus,
                currentLevel,
                financeReviewerId: userId,
                financeReviewedAt: new Date(),
                financeNotes,
                rejectedAt: newStatus === 'REJECTED' ? new Date() : null,
                approvedAt: newStatus === 'APPROVED' ? new Date() : null,
              },
              include: { items: true, approvals: { orderBy: { level: 'asc' } } },
            });

            // If rejected, mark all approvals as SKIPPED
            if (newStatus === 'REJECTED') {
              await tx.expenseApproval.updateMany({
                where: { expenseRequestId: id },
                data: { status: 'SKIPPED' },
              });
            }

            return request;
          });

          return NextResponse.json({
            success: true,
            message: financeDecision === 'REJECT' ? 'Pengajuan ditolak oleh Finance.' :
                     financeDecision === 'REQUEST_REVISION' ? 'Pengajuan dikembalikan untuk revisi.' :
                     'Finance review selesai, lanjut ke persetujuan.',
            expenseRequest: updated,
          });
        }

        default:
          return NextResponse.json({ success: false, message: 'Aksi tidak valid.' }, { status: 400 });
      }
    } catch (err: any) {
      console.error('[ExpenseRequest Detail API] PATCH Error:', err);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal memperbarui pengajuan.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);