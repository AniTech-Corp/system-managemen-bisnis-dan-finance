import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { StockMovementType } from '@prisma/client';

// KLIR Inventory -- Riwayat keluar-masuk stok (10 Sep 2026, agent api-inventory-read,
// KONTRAK API dari context pack "Stok & Pembelian"). GET saja (append-only, tidak ada
// POST langsung di sini -- StockMovement ditulis lewat route lain: purchase-orders,
// products (opening balance), returns, dst). Dipakai KlirInventoryView tab
// "Riwayat keluar-masuk".

function isValidStockMovementType(value: string | null): value is StockMovementType {
  if (!value) return false;
  return (Object.values(StockMovementType) as string[]).includes(value);
}

// GET: List StockMovement milik workspace, paginated, filter opsional productId/type
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
      const productId = searchParams.get('productId') || undefined;
      const typeParam = searchParams.get('type');

      const where: any = { workspaceId };
      if (productId) {
        where.productId = productId;
      }
      if (typeParam) {
        if (!isValidStockMovementType(typeParam)) {
          return NextResponse.json(
            { message: `Tipe pergerakan stok tidak valid: ${typeParam}` },
            { status: 400 }
          );
        }
        where.type = typeParam;
      }

      const [total, movements] = await Promise.all([
        prisma.stockMovement.count({ where }),
        prisma.stockMovement.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            product: {
              select: { id: true, name: true, sku: true, unit: true },
            },
          },
        }),
      ]);

      return NextResponse.json({
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        movements,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat pergerakan stok.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
