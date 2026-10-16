import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';

// KLIR Inventory -- Batch/kadaluarsa produk (10 Sep 2026, agent inventory-api-schema,
// kontrak F3b/F4). Model ProductBatch baru (lihat prisma/schema.prisma, komentar di
// atas model ProductBatch) -- FEFO/expiry tracking, TERPISAH dari Product.currentStock
// (angka tunggal lama TETAP sumber kebenaran stok untuk semua fitur lama). POST di
// sini SENGAJA TIDAK mengubah Product.currentStock -- batch = pembagian/pencatatan
// dari stok yang SUDAH ADA di Product.currentStock (mis. "dari 500 pcs yang sudah
// tercatat, 200 pcs kadaluarsa besok"), bukan penambahan stok baru. Kalau nanti mau
// dipakai untuk auto-decrement FEFO saat SALE_OUT, itu desain endpoint terpisah, di
// luar kontrak ini (dicatat sebagai keputusan sementara, lihat komentar schema).

// GET: List batch (opsional filter productId + expiringWithinDays), urut expiryDate
// asc (yang paling dekat kadaluarsa duluan). expiringSoon = jumlah batch dari hasil
// (setelah filter productId/expiringWithinDays di atas) yang kadaluarsa dalam <=7
// hari dari sekarang -- angka ringkas untuk badge "kritis" tanpa UI harus loop
// sendiri (keputusan kecil 10 Sep 2026/Fable, kontrak tidak merinci definisi
// persis field ini).
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const productId = searchParams.get('productId')?.trim() || undefined;
      const expiringWithinDaysRaw = searchParams.get('expiringWithinDays');
      const expiringWithinDays =
        expiringWithinDaysRaw !== null && Number.isFinite(Number(expiringWithinDaysRaw)) && Number(expiringWithinDaysRaw) >= 0
          ? Number(expiringWithinDaysRaw)
          : undefined;

      const now = new Date();
      const where: any = { workspaceId };
      if (productId) {
        where.productId = productId;
      }
      if (expiringWithinDays !== undefined) {
        const cutoff = new Date(now.getTime() + expiringWithinDays * 24 * 60 * 60 * 1000);
        where.expiryDate = { lte: cutoff };
      }

      const batches = await prisma.productBatch.findMany({
        where,
        orderBy: { expiryDate: 'asc' },
        include: { product: { select: { id: true, name: true, sku: true, unit: true } } },
      });

      const criticalCutoff = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const expiringSoon = batches.filter((b) => b.expiryDate <= criticalCutoff).length;

      return NextResponse.json({ batches, expiringSoon });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat batch produk.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Catat batch baru untuk sebuah produk. TIDAK mengubah Product.currentStock
// (lihat komentar di atas file) -- qty di sini murni pembagian dari stok yang sudah
// tercatat di Product.currentStock.
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const productId: string | undefined = body?.productId;
      const expiryDateRaw: string | undefined = body?.expiryDate;
      const qty = Number(body?.qty);
      const batchCode: string | undefined = body?.batchCode?.trim?.() || undefined;

      if (!productId || typeof productId !== 'string') {
        return NextResponse.json({ message: 'productId wajib diisi.' }, { status: 400 });
      }
      if (!expiryDateRaw || typeof expiryDateRaw !== 'string') {
        return NextResponse.json({ message: 'expiryDate wajib diisi (format YYYY-MM-DD).' }, { status: 400 });
      }
      const expiryDate = new Date(expiryDateRaw);
      if (Number.isNaN(expiryDate.getTime())) {
        return NextResponse.json({ message: 'expiryDate tidak valid, pakai format YYYY-MM-DD.' }, { status: 400 });
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ message: 'qty harus angka lebih dari 0.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      // Isolasi tenant: productId wajib milik workspace ini -- meniru pola
      // returns/route.ts & sales/route.ts.
      const product = await prisma.product.findFirst({
        where: { id: productId, workspaceId },
        select: { id: true, name: true, sku: true, unit: true },
      });
      if (!product) {
        return NextResponse.json(
          { message: 'Produk tidak ditemukan atau bukan milik workspace ini.' },
          { status: 400 }
        );
      }

      const batch = await prisma.productBatch.create({
        data: {
          workspaceId,
          productId,
          batchCode: batchCode || null,
          expiryDate,
          qty,
        },
      });

      return NextResponse.json({ batch: { ...batch, product } }, { status: 201 });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Batch produk gagal disimpan.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
