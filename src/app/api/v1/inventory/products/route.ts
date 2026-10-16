import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { StockMovementType } from '@prisma/client';
import { invalidateContextCache } from '@/lib/ai-brain';
import { invalidateDashboardInsightCache } from '@/lib/ai-brain/dashboard-insight';

// KLIR Inventory -- Produk (10 Sep 2026, agent api-inventory-read, KONTRAK API
// dari context pack "Stok & Pembelian"). GET list produk + ringkasan (dipakai
// KlirInventoryView tab "Produk & stok" + kartu ringkas CompanyDataDashboard).
// POST tambah produk baru, opsional catat saldo awal (openingStock) sebagai
// StockMovement OPENING_BALANCE dalam 1 $transaction -- pola sama persis dengan
// purchase-orders/route.ts (atomic, konsisten dengan sumber kebenaran StockMovement).

function toNonNegativeNumber(raw: unknown, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

// GET: List produk milik workspace + ringkasan (nilai stok, produk di bawah minimum)
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
      const q = searchParams.get('q')?.trim();

      const where: any = { workspaceId };
      if (q) {
        where.OR = [
          { name: { contains: q, mode: 'insensitive' } },
          { sku: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [total, products] = await Promise.all([
        prisma.product.count({ where }),
        prisma.product.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      // Ringkasan dihitung dari SEMUA produk AKTIF workspace (bukan cuma hasil
      // halaman/pencarian saat ini) -- summary harus mencerminkan populasi penuh,
      // bukan sampel halaman yang sedang ditampilkan.
      const allActiveProducts = await prisma.product.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, sku: true, unit: true, currentStock: true, minStock: true, costPrice: true },
      });

      const activeCount = allActiveProducts.length;
      const stockValue = allActiveProducts.reduce(
        (sum, p) => sum + p.currentStock * p.costPrice,
        0
      );
      const lowStockProducts = allActiveProducts.filter(
        (p) => p.minStock > 0 && p.currentStock <= p.minStock
      );

      return NextResponse.json({
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        products,
        summary: {
          productCount: total,
          activeCount,
          stockValue,
          lowStockCount: lowStockProducts.length,
          lowStock: lowStockProducts.slice(0, 20).map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            unit: p.unit,
            currentStock: p.currentStock,
            minStock: p.minStock,
          })),
        },
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat produk.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Tambah produk baru. Kalau openingStock > 0, catat StockMovement
// OPENING_BALANCE dalam 1 transaksi atomic (produk + movement bareng, tidak
// pernah cuma salah satu yang ke-simpan).
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const name: string | undefined = body?.name?.trim?.();
      if (!name) {
        return NextResponse.json({ message: 'Nama produk wajib diisi.' }, { status: 400 });
      }

      const sku: string | undefined = body?.sku?.trim?.() || undefined;
      const category: string | undefined = body?.category?.trim?.() || undefined;
      const unit: string = body?.unit?.trim?.() || 'pcs';
      const costPrice = toNonNegativeNumber(body?.costPrice, 0);
      const sellPrice = toNonNegativeNumber(body?.sellPrice, 0);
      const minStock = toNonNegativeNumber(body?.minStock, 0);
      const openingStock = toNonNegativeNumber(body?.openingStock, 0);
      // Additive 10 Sep 2026 (Fable) -- kontrak inventory-api-schema, F3b/F4.
      // packSize/packUnit/supplierName opsional, konsisten default schema (packSize
      // default 1 kalau tidak dikirim -- via toNonNegativeNumber dengan fallback 1,
      // BUKAN 0, supaya "1 pack = 1 unit" tetap berlaku untuk produk yang tidak
      // pakai konsep pack, sama seperti default kolom di schema.prisma).
      const packSizeRaw = body?.packSize;
      let packSize = 1;
      if (packSizeRaw !== undefined && packSizeRaw !== null && packSizeRaw !== '') {
        const n = Math.trunc(Number(packSizeRaw));
        packSize = Number.isFinite(n) && n >= 1 ? n : 1;
      }
      const packUnit: string | undefined = body?.packUnit?.trim?.() || undefined;
      const supplierName: string | undefined = body?.supplierName?.trim?.() || undefined;

      const workspaceId = auth.workspace.id;

      // Validasi SKU duplikat SEBELUM transaksi (F1 kontrak Tingkat B, 10 Sep 2026).
      // Sebelumnya cuma mengandalkan catch P2002 (unique [workspaceId, sku] di
      // schema) yang dibalas 400 generik. Pre-check ini membuat pesan bisa menyebut
      // produk mana yang memakai SKU itu, dan status 409 (konflik) memberi sinyal
      // yang benar ke klien. Case-sensitive persis seperti constraint Postgres --
      // sengaja tidak ada normalisasi supaya perilaku UI = perilaku database.
      // Catch P2002 di bawah tetap dipertahankan untuk race dua request bersamaan.
      if (sku) {
        const existing = await prisma.product.findFirst({
          where: { workspaceId, sku },
          select: { id: true, name: true },
        });
        if (existing) {
          return NextResponse.json(
            {
              message: `SKU "${sku}" sudah dipakai produk "${existing.name}" di workspace ini.`,
              conflictProductId: existing.id,
            },
            { status: 409 }
          );
        }
      }

      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            workspaceId,
            name,
            sku: sku || null,
            category: category || null,
            unit,
            costPrice,
            sellPrice,
            minStock,
            currentStock: openingStock,
            packSize,
            packUnit: packUnit || null,
            supplierName: supplierName || null,
          },
        });

        if (openingStock > 0) {
          await tx.stockMovement.create({
            data: {
              workspaceId,
              productId: created.id,
              userId: auth.user.id,
              type: StockMovementType.OPENING_BALANCE,
              qtyChange: openingStock,
              unitCost: costPrice,
              sourceType: 'manual',
              note: `Saldo awal produk "${name}" saat pertama dicatat.`,
            },
          });
        }

        return created;
      });

      // AI Brain cache workspace ini sekarang basi (produk baru muncul) --
      // invalidate best-effort, kegagalan cache-invalidation TIDAK boleh
      // menggagalkan response sukses pembuatan produk.
      try {
        invalidateContextCache(workspaceId);
        void invalidateDashboardInsightCache(workspaceId);
      } catch {
        // sengaja diabaikan, lihat komentar di atas
      }

      return NextResponse.json({ product }, { status: 201 });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        // Race: dua request dengan SKU sama lolos pre-check bersamaan -- constraint
        // database yang menang, balas 409 dengan pesan yang sama polanya.
        return NextResponse.json(
          { message: 'SKU ini sudah dipakai produk lain di workspace ini.' },
          { status: 409 }
        );
      }
      return NextResponse.json({ message: publicApiError('Produk gagal disimpan.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
