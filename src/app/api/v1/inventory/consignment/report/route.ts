import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { buildConsignmentReportRows, OWNERSHIP_TYPE_CONSIGNED } from '@/lib/ai-brain/consignment-engine';

// KLIR Inventory -- Laporan settlement konsinyasi (10 Sep 2026, agent api-stock-ops,
// F3 kontrak Tingkat B). Beda dari GET /inventory/consignment (daftar produk +
// valuasi stok) -- endpoint ini meringkas APA YANG HARUS DISETOR ke supplier per
// produk konsinyasi dalam suatu periode: barang masuk, barang laku, barang
// diretur ke supplier, dan jumlah rupiah kewajiban (qtySold x costPrice). Query
// StockMovement + StockReturn + Product di sini, transformasi murni di
// consignment-engine.ts (buildConsignmentReportRows) supaya logikanya bisa
// dites tanpa DB.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RANGE_DAYS = 30;

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// GET: Laporan settlement konsinyasi -- rows per produk CONSIGNED aktif + totals
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;

      const now = new Date();
      const defaultFrom = new Date(now.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);

      const fromParam = parseDateParam(searchParams.get('from'));
      const toParam = parseDateParam(searchParams.get('to'));

      if (searchParams.get('from') && !fromParam) {
        return NextResponse.json({ message: 'Parameter "from" bukan tanggal valid.' }, { status: 400 });
      }
      if (searchParams.get('to') && !toParam) {
        return NextResponse.json({ message: 'Parameter "to" bukan tanggal valid.' }, { status: 400 });
      }

      const from = fromParam ?? defaultFrom;
      // "to" inklusif sampai akhir hari itu -- kalau user kirim ?to=2026-09-10,
      // pergerakan yang terjadi tanggal 10 tetap ikut kehitung.
      const to = toParam
        ? new Date(toParam.getTime() + DAY_MS - 1)
        : now;

      if (from.getTime() > to.getTime()) {
        return NextResponse.json({ message: '"from" tidak boleh lebih besar dari "to".' }, { status: 400 });
      }

      // Hanya produk konsinyasi AKTIF -- produk yang sudah dinonaktifkan tidak
      // perlu muncul di laporan setoran (sudah tidak dijual lagi).
      const products = await prisma.product.findMany({
        where: { workspaceId, isActive: true, ownershipType: OWNERSHIP_TYPE_CONSIGNED },
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          costPrice: true,
          currentStock: true,
          ownershipType: true,
          isActive: true,
        },
      });

      if (products.length === 0) {
        return NextResponse.json({
          period: { from: from.toISOString(), to: to.toISOString() },
          rows: [],
          totals: { products: 0, qtySold: 0, amountDueToSupplier: 0 },
        });
      }

      const productIds = products.map((p) => p.id);

      const [movements, stockReturns] = await Promise.all([
        prisma.stockMovement.findMany({
          where: {
            workspaceId,
            productId: { in: productIds },
            createdAt: { gte: from, lte: to },
          },
          select: { productId: true, type: true, qtyChange: true, createdAt: true },
        }),
        prisma.stockReturn.findMany({
          where: {
            workspaceId,
            productId: { in: productIds },
            createdAt: { gte: from, lte: to },
          },
          select: { productId: true, direction: true, qty: true, createdAt: true },
        }),
      ]);

      const { rows, totals } = buildConsignmentReportRows(products, movements, stockReturns, { from, to });

      return NextResponse.json({
        period: { from: from.toISOString(), to: to.toISOString() },
        rows,
        totals,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal membuat laporan konsinyasi.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
