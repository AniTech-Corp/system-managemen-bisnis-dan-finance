import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { evaluateExpenseApproval, generateRequestNumber, EXPENSE_APPROVAL_CONFIG } from '@/lib/expense-approval-engine';
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
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
      const status = searchParams.get('status');
      const category = searchParams.get('category');
      const requesterId = searchParams.get('requesterId');
      const dateFrom = searchParams.get('dateFrom');
      const dateTo = searchParams.get('dateTo');
      const sortBy = searchParams.get('sortBy') || 'createdAt';
      const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

      const where: any = { workspaceId };
      if (status && Object.values(ExpenseRequestStatus).includes(status as ExpenseRequestStatus)) {
        where.status = status;
      }
      if (category && validateCategory(category)) {
        where.category = category;
      }
      if (requesterId) {
        where.requesterId = requesterId;
      }
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) where.createdAt.gte = new Date(dateFrom);
        if (dateTo) where.createdAt.lte = new Date(dateTo);
      }

      const [total, expenseRequests] = await Promise.all([
        prisma.expenseRequest.count({ where }),
        prisma.expenseRequest.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            requester: { select: { id: true, fullName: true, email: true } },
            financeReviewer: { select: { id: true, fullName: true, email: true } },
            items: true,
            approvals: {
              include: {
                approver: { select: { id: true, fullName: true, email: true } },
              },
              orderBy: { level: 'asc' },
            },
          },
        }),
      ]);

      return NextResponse.json({
        success: true,
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        expenseRequests,
      });
    } catch (err: any) {
      console.error('[ExpenseRequests API] GET Error:', err);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal memuat pengajuan pengeluaran.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const workspaceId = auth.workspace.id;
      const requesterId = auth.user.id;
      const requesterName = auth.user.fullName || auth.user.email;
      const requesterRole = auth.membership.role;

      const title = body?.title?.trim?.();
      const description = body?.description?.trim?.();
      const category = body?.category?.trim?.();
      const receiptUrls = Array.isArray(body?.receiptUrls) ? body.receiptUrls.filter((u: any) => typeof u === 'string') : [];
      const itemsRaw = body?.items;
      const action = body?.action || 'DRAFT'; // DRAFT | SUBMIT

      if (!title) {
        return NextResponse.json({ success: false, message: 'Judul pengajuan wajib diisi.' }, { status: 400 });
      }
      if (!description) {
        return NextResponse.json({ success: false, message: 'Deskripsi pengajuan wajib diisi.' }, { status: 400 });
      }
      if (!category || !validateCategory(category)) {
        return NextResponse.json({ success: false, message: 'Kategori pengeluaran tidak valid.' }, { status: 400 });
      }

      const parsedItems = validateItems(itemsRaw);
      if ('error' in parsedItems) {
        return NextResponse.json({ success: false, message: parsedItems.error }, { status: 400 });
      }
      const items = parsedItems.items;
      const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

      const evaluation = evaluateExpenseApproval(totalAmount);
      const requestNumber = generateRequestNumber();

      // Determine initial status
      let initialStatus: ExpenseRequestStatus = 'DRAFT';
      if (action === 'SUBMIT') {
        initialStatus = evaluation.requiresFinanceReview ? 'FINANCE_REVIEW' : 
                       (evaluation.requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED');
      }

      const expenseRequest = await prisma.$transaction(async (tx) => {
        const request = await tx.expenseRequest.create({
          data: {
            workspaceId,
            requesterId,
            requesterRole,
            requestNumber,
            title,
            description,
            category,
            totalAmount,
            status: initialStatus,
            currentLevel: 0,
            requiredLevels: evaluation.levels,
            receiptUrls,
            submittedAt: action === 'SUBMIT' ? new Date() : null,
            approvedAt: initialStatus === 'APPROVED' ? new Date() : null,
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
          include: {
            requester: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
            items: true,
            approvals: true,
          },
        });

        // Create approval chain if needed
        if (evaluation.requiresApproval && action === 'SUBMIT') {
          for (const step of evaluation.approvalChain) {
            await tx.expenseApproval.create({
              data: {
                expenseRequestId: request.id,
                level: step.level,
                requiredRole: step.role,
                status: step.level === 1 ? 'PENDING' : 'PENDING',
              },
            });
          }
        }

        return request;
      });

      // If auto-approved (no approval needed), create cash transaction
      if (initialStatus === 'APPROVED') {
        // This will be handled by a background job or separate endpoint
        // For now, just return the approved request
      }

      return NextResponse.json({
        success: true,
        message: action === 'SUBMIT' ? 'Pengajuan berhasil dikirim untuk review.' : 'Draft pengajuan berhasil disimpan.',
        expenseRequest,
      });
    } catch (err: any) {
      console.error('[ExpenseRequests API] POST Error:', err);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal membuat pengajuan pengeluaran.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);