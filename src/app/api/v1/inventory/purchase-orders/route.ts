import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { PurchaseOrderStatus, StockMovementType, TransactionType } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { recordCashTransaction } from '@/lib/accounting/posting';
import {
  createSpendingApprovalRequest,
  evaluateSpendingApproval,
  getSpendingApprovalRequest,
} from '@/lib/ai-brain/spending-approval-guardrail';

// KLIR Inventory -- Purchase Order + auto-post Kas (9 Sep 2026, BUILD_PLAN item
// purchase-order-backend). Satu $transaction (callback, bukan array) untuk:
// PurchaseOrder + PurchaseOrderItem[] + StockMovement PURCHASE_IN per item +
// Product.currentStock increment (atomic, aman dari race condition -- Postgres
// mengunci baris saat UPDATE ... SET x = x + n) + CashTransaction EXPENSE +
// PurchaseOrder.cashTransactionId. Pola CashTransaction ditiru dari
// src/app/api/v1/booking/reservations/route.ts baris 72-85 (file itu TIDAK diedit).

interface PurchaseOrderItemInput {
  productId: string;
  qty: number;
  unitCost: number;
}

const MAX_PURCHASE_ORDER_ITEMS = 100;
// Batas atas per item -- qty*unitCost max realistis di bawah ini masih jauh dari
// Number.MAX_SAFE_INTEGER, mencegah overflow ke Infinity (root cause DEEP-002 bypass:
// evaluateSpendingApproval() dulu menganggap Infinity "di bawah ambang approval").
const MAX_ITEM_QTY = 1_000_000;
const MAX_ITEM_UNIT_COST = 1_000_000_000_000; // Rp1 triliun/unit, sudah sangat generous

function validateItems(raw: unknown): { items: PurchaseOrderItemInput[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Minimal 1 item barang wajib diisi.' };
  }
  if (raw.length > MAX_PURCHASE_ORDER_ITEMS) {
    return { error: `Maksimal ${MAX_PURCHASE_ORDER_ITEMS} item per purchase order.` };
  }
  const items: PurchaseOrderItemInput[] = [];
  for (const entry of raw) {
    const productId = (entry as any)?.productId;
    const qty = Number((entry as any)?.qty);
    const unitCost = Number((entry as any)?.unitCost);
    if (typeof productId !== 'string' || !productId) {
      return { error: 'productId setiap item wajib diisi.' };
    }
    if (!Number.isFinite(qty) || qty <= 0 || qty > MAX_ITEM_QTY) {
      return { error: `Qty untuk produk ${productId} harus angka antara 0 dan ${MAX_ITEM_QTY.toLocaleString('id-ID')}.` };
    }
    if (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > MAX_ITEM_UNIT_COST) {
      return { error: `Harga beli (unitCost) untuk produk ${productId} tidak valid (maks Rp${MAX_ITEM_UNIT_COST.toLocaleString('id-ID')}).` };
    }
    items.push({ productId, qty, unitCost });
  }
  return { items };
}

function generatePoNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${dateStr}-${randomSuffix}`;
}

// GET: List Purchase Order milik workspace, paginated sederhana
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

      const [total, purchaseOrders] = await Promise.all([
        prisma.purchaseOrder.count({ where: { workspaceId } }),
        prisma.purchaseOrder.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { items: true },
        }),
      ]);

      return NextResponse.json({
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        purchaseOrders,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat purchase order. Coba lagi beberapa saat.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Catat pembelian stok baru -- otomatis update stok + posting Kas
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      let supplierName: string | undefined = body?.supplierName?.trim?.();
      let supplierPhone: string | undefined = body?.supplierPhone?.trim?.();
      let paymentMethod: string = body?.paymentMethod?.trim?.() || 'TUNAI';
      let notes: string | undefined = body?.notes?.trim?.();
      const approvalRequestId = typeof body?.approvalRequestId === 'string' && body.approvalRequestId.trim()
        ? body.approvalRequestId.trim()
        : undefined;

      if (!supplierName && !approvalRequestId) {
        return NextResponse.json({ message: 'Nama supplier wajib diisi.' }, { status: 400 });
      }

      let items: PurchaseOrderItemInput[] = [];
      if (body?.items !== undefined) {
        const parsedItems = validateItems(body.items);
        if ('error' in parsedItems) {
          if (!approvalRequestId) {
            return NextResponse.json({ message: parsedItems.error }, { status: 400 });
          }
        } else {
          items = parsedItems.items;
        }
      } else if (!approvalRequestId) {
        return NextResponse.json({ message: 'Minimal 1 item barang wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;
      let totalAmount = items.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
      const approvalEvaluation = approvalRequestId
        ? { requiresApproval: true }
        : evaluateSpendingApproval(totalAmount);
      let approvedRequest: Awaited<ReturnType<typeof getSpendingApprovalRequest>> = null;

      if (approvalEvaluation.requiresApproval) {
        if (!approvalRequestId) {
          const approvalRequest = await createSpendingApprovalRequest({
            workspaceId,
            requesterId: auth.user.id,
            requesterName: auth.user.fullName || auth.user.email,
            requesterRole: auth.membership.role,
            amount: totalAmount,
            category: 'Pembelian Stok/Purchasing',
            description: `Purchase order ${supplierName} (${items.length} item)`,
            sourceType: 'PURCHASE_ORDER_DRAFT',
            draftPayload: { supplierName: supplierName!, supplierPhone, paymentMethod, notes, items },
          });
          return NextResponse.json(
            {
              success: false,
              requiresApproval: true,
              approvalRequest,
              message: `Purchase order senilai Rp${totalAmount.toLocaleString('id-ID')} ditahan sampai disetujui role ${approvalRequest.requiredMinRole}.`,
            },
            { status: 202 }
          );
        }

        approvedRequest = await getSpendingApprovalRequest(workspaceId, approvalRequestId);
        if (!approvedRequest || approvedRequest.status !== 'APPROVED') {
          return NextResponse.json(
            { success: false, requiresApproval: true, message: 'Approval purchase order belum disetujui atau tidak ditemukan.' },
            { status: 409 }
          );
        }
        if (!approvedRequest.draftPayload) {
          return NextResponse.json(
            { success: false, message: 'Draft approval tidak memiliki payload purchase order yang dapat dieksekusi.' },
            { status: 409 }
          );
        }

        // The approved server-side draft is authoritative. Never let the retry
        // replace supplier/items/amount after an approver reviewed the ticket.
        supplierName = approvedRequest.draftPayload.supplierName;
        supplierPhone = approvedRequest.draftPayload.supplierPhone;
        paymentMethod = approvedRequest.draftPayload.paymentMethod;
        notes = approvedRequest.draftPayload.notes;
        items = approvedRequest.draftPayload.items;
        totalAmount = items.reduce((sum, item) => sum + item.qty * item.unitCost, 0);
      }

      if (!supplierName || items.length === 0) {
        return NextResponse.json({ message: 'Draft purchase order tidak lengkap.' }, { status: 400 });
      }

      const poNumber = approvedRequest ? `PO-${approvedRequest.ticketNumber}` : generatePoNumber();

      if (approvedRequest) {
        const alreadyExecuted = await prisma.purchaseOrder.findFirst({
          where: { workspaceId, poNumber },
          include: { items: true },
        });
        if (alreadyExecuted) {
          return NextResponse.json({
            success: true,
            alreadyProcessed: true,
            message: `Approval #${approvedRequest.ticketNumber} sudah dieksekusi sebelumnya.`,
            purchaseOrder: alreadyExecuted,
          });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        // Isolasi tenant: SEMUA productId yang dikirim wajib milik workspace ini --
        // tanpa cek ini, attacker bisa kirim productId workspace lain lalu stok
        // workspace lain ikut ke-increment padahal yang bayar workspace ini.
        const productIds = [...new Set(items.map((i) => i.productId))];
        const ownedProducts = await tx.product.findMany({
          where: { id: { in: productIds }, workspaceId },
          select: { id: true },
        });
        if (ownedProducts.length !== productIds.length) {
          throw new Error('Salah satu produk tidak ditemukan atau bukan milik workspace ini.');
        }

        const purchaseOrder = await tx.purchaseOrder.create({
          data: {
            workspaceId,
            userId: auth.user.id,
            poNumber,
            supplierName,
            supplierPhone: supplierPhone || null,
            status: PurchaseOrderStatus.RECEIVED,
            totalAmount,
            paymentMethod,
            purchaseDate: new Date(),
            notes: notes || null,
          },
        });

        for (const item of items) {
          const subtotal = item.qty * item.unitCost;

          const poItem = await tx.purchaseOrderItem.create({
            data: {
              purchaseOrderId: purchaseOrder.id,
              productId: item.productId,
              qty: item.qty,
              unitCost: item.unitCost,
              subtotal,
            },
          });

          await tx.stockMovement.create({
            data: {
              workspaceId,
              productId: item.productId,
              userId: auth.user.id,
              type: StockMovementType.PURCHASE_IN,
              qtyChange: item.qty,
              unitCost: item.unitCost,
              sourceType: 'PURCHASE_ORDER_ITEM',
              sourceId: poItem.id,
              note: `Pembelian dari ${supplierName} (PO #${poNumber})`,
            },
          });

          // Atomic increment -- aman dari race condition, Postgres mengunci baris
          // saat UPDATE ... SET current_stock = current_stock + n (bukan read-then-write).
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.qty } },
          });
        }

        const { transaction: cashTransaction } = await recordCashTransaction(tx, {
          workspaceId,
          userId: auth.user.id,
          type: TransactionType.EXPENSE,
          category: 'Pembelian Stok/Purchasing',
          amount: totalAmount,
          description: `Pembelian Stok PO #${poNumber} (${supplierName})`,
          paymentMethod,
          autoMapFallback: true,
        });

        const updatedPurchaseOrder = await tx.purchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: { cashTransactionId: cashTransaction.id },
          include: { items: true },
        });

        return { purchaseOrder: updatedPurchaseOrder, cashTransaction };
      });

      return NextResponse.json({
        success: true,
        message: `PO #${poNumber} untuk ${supplierName} berhasil dicatat, stok & kas otomatis diperbarui.`,
        purchaseOrder: result.purchaseOrder,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Purchase order gagal disimpan. Periksa data produk dan coba lagi.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
