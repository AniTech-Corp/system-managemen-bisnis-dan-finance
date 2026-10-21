import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import {
  calculateStockValueBreakdown,
  isValidOwnershipType,
  OWNERSHIP_TYPE_CONSIGNED,
} from '@/lib/ai-brain/consignment-engine';

// KLIR Inventory -- Konsinyasi (9 Sep 2026, BUILD_PLAN item konsinyasi-retur).
// GET: list produk konsinyasi (ownershipType CONSIGNED) milik workspace + ringkasan
// nilai stok (ownedValue vs consignedValue, dihitung consignment-engine.ts -- barang
// konsinyasi TIDAK ikut nilai stok pemilik sampai laku).
// PATCH: toggle ownershipType satu produk (OWNED <-> CONSIGNED). Ini HANYA menandai
// status kepemilikan -- tidak mengubah currentStock/nilai apapun, dan TIDAK menulis
// StockMovement/CashTransaction (bukan event stok masuk/keluar, murni reklasifikasi).

// GET: List produk berstatus konsinyasi + ringkasan valuasi stok workspace
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));

      // Ringkasan valuasi dihitung dari SEMUA produk aktif workspace (bukan cuma
      // yang konsinyasi) -- calculateStockValueBreakdown butuh keduanya untuk
      // memisahkan ownedValue vs consignedValue dengan benar.
      const allProducts = await prisma.product.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, ownershipType: true, currentStock: true, costPrice: true },
      });
      const summary = calculateStockValueBreakdown(allProducts);

      const [total, consignedProducts] = await Promise.all([
        prisma.product.count({
          where: { workspaceId, isActive: true, ownershipType: OWNERSHIP_TYPE_CONSIGNED },
        }),
        prisma.product.findMany({
          where: { workspaceId, isActive: true, ownershipType: OWNERSHIP_TYPE_CONSIGNED },
          orderBy: { name: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      return NextResponse.json({
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        consignedProducts,
        summary,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat data konsinyasi.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// PATCH: Toggle ownershipType satu produk (reklasifikasi OWNED <-> CONSIGNED)
export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const body = await req.json();
      const productId: string | undefined = body?.productId;
      const ownershipType: unknown = body?.ownershipType;

      if (!productId || typeof productId !== 'string') {
        return NextResponse.json({ message: 'productId wajib diisi.' }, { status: 400 });
      }
      if (!isValidOwnershipType(ownershipType)) {
        return NextResponse.json(
          { message: 'ownershipType wajib "OWNED" atau "CONSIGNED".' },
          { status: 400 }
        );
      }

      // Isolasi tenant: pastikan produk ini milik workspace pemanggil SEBELUM update --
      // tanpa cek ini, attacker bisa reklasifikasi produk workspace lain.
      const existing = await prisma.product.findFirst({
        where: { id: productId, workspaceId },
        select: { id: true, currentStock: true, costPrice: true },
      });
      if (!existing) {
        return NextResponse.json(
          { message: 'Produk tidak ditemukan atau bukan milik workspace ini.' },
          { status: 404 }
        );
      }

      // Barang titip jual bukan milik toko -> nilai bukunya 0. Kalau dikembalikan
      // ke OWNED, nilai buku disetel ulang ke stok x harga pokok (selisih dengan
      // akun 1-1400 akan muncul di laporan, jadi tidak ada angka yang hilang diam-diam).
      const inventoryValue =
        ownershipType === OWNERSHIP_TYPE_CONSIGNED
          ? 0
          : Number(existing.currentStock ?? 0) * Number(existing.costPrice ?? 0);

      const updateResult = await prisma.product.updateMany({
        where: { id: productId, workspaceId },
        data: { ownershipType, inventoryValue },
      });
      if (updateResult.count !== 1) {
        return NextResponse.json(
          { message: 'Produk tidak ditemukan atau bukan milik workspace ini.' },
          { status: 404 }
        );
      }
      const updated = await prisma.product.findFirst({ where: { id: productId, workspaceId } });
      if (!updated) {
        return NextResponse.json(
          { message: 'Produk tidak ditemukan atau bukan milik workspace ini.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: `Produk "${updated.name}" sekarang berstatus ${ownershipType === OWNERSHIP_TYPE_CONSIGNED ? 'konsinyasi (titip-jual)' : 'milik toko (beli putus)'}.`,
        product: updated,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Data konsinyasi gagal diperbarui.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
