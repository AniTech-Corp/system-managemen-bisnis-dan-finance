import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import {
  buildSupplierScores,
  resolveReturnsToSupplier,
  resolveReturnsByLatestPurchase,
  type PurchaseOrderItemForScoring,
  type PurchaseOrderItemLookupEntry,
  type ProductSupplierHistoryEntry,
  type RawStockReturnRow,
  type StockReturnForScoring,
} from '@/lib/ai-brain/supplier-reliability-engine';

// KLIR Inventory -- Skor Keandalan Supplier (9 Sep 2026, BUILD_PLAN item
// supplier-score, gelombang 2). Skor BERDIRI SENDIRI -- TIDAK terhubung ke
// CompanyHealthScore (breakdown 35/30/20/15 di types.ts, HARAM diubah).
//
// Perhitungan MURNI dari data yang sudah ada (PurchaseOrder + PurchaseOrderItem +
// StockReturn) -- nol tabel baru selain SupplierScore yang sudah dibikin di fase
// Fondasi Schema 2. Logika skor sendiri (deterministik, NOL LLM) ada di
// src/lib/ai-brain/supplier-reliability-engine.ts -- file ini cuma query Prisma +
// pemetaan + upsert cache.
//
// GET: list skor semua supplier workspace. Default pakai cache (SupplierScore table)
// kalau sudah ada baris tersimpan; kalau kosong (belum pernah dihitung) ATAU query
// param ?recalculate=1 dikirim eksplisit, hitung ulang dari sumber data + upsert cache
// lalu balikin hasil segar. (Keputusan desain: tidak ada spek eksplisit dari Mecca soal
// mekanisme trigger recalc, jadi dipilih pola paling umum -- auto-populate saat kosong,
// manual refresh via query param -- dicatat jujur di laporan, bukan diklaim final.)

async function recalculateSupplierScores(workspaceId: string) {
  // Purchase order NON-CANCELLED saja -- PO yang dibatalkan tidak mencerminkan
  // performa nyata supplier (barang/harga itu tidak pernah benar-benar terjadi).
  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { workspaceId, status: { not: 'CANCELLED' } },
    select: {
      id: true,
      supplierName: true,
      purchaseDate: true,
      items: { select: { id: true, productId: true, qty: true, unitCost: true } },
    },
  });

  const items: PurchaseOrderItemForScoring[] = [];
  const itemLookup = new Map<string, PurchaseOrderItemLookupEntry>();
  const productSupplierHistory: ProductSupplierHistoryEntry[] = [];
  for (const po of purchaseOrders) {
    for (const item of po.items) {
      items.push({
        purchaseOrderId: po.id,
        supplierName: po.supplierName,
        productId: item.productId,
        qty: item.qty,
        unitCost: item.unitCost,
      });
      itemLookup.set(item.id, { supplierName: po.supplierName, productId: item.productId });
      productSupplierHistory.push({
        productId: item.productId,
        supplierName: po.supplierName,
        purchaseDate: po.purchaseDate,
      });
    }
  }

  const stockReturns = await prisma.stockReturn.findMany({
    where: { workspaceId, direction: 'TO_SUPPLIER' },
    select: { sourceType: true, sourceId: true, productId: true, qty: true, createdAt: true },
  });
  const rawReturns: RawStockReturnRow[] = stockReturns.map((r) => ({
    direction: 'TO_SUPPLIER',
    sourceType: r.sourceType,
    sourceId: r.sourceId,
    productId: r.productId,
    qty: r.qty,
  }));

  // Lapis 1: resolusi via sourceType='PURCHASE_ORDER_ITEM' + sourceId eksplisit.
  // Lapis 2 (fallback, HIPOTESIS-tier): untuk baris yang gagal lapis 1 -- endpoint
  // returns/route.ts yang live SAAT INI tidak pernah mengisi sourceType/sourceId
  // (diverifikasi baca kode langsung, lihat komentar resolveReturnsByLatestPurchase()
  // di supplier-reliability-engine.ts) -- pakai heuristik "supplier terakhir yang jual
  // produk itu sebelum tanggal retur". Array `rawReturns`/`stockReturns` index-aligned
  // 1:1 (query sudah difilter direction=TO_SUPPLIER, resolveReturnsToSupplier tidak
  // membuang baris apapun kalau semua sudah TO_SUPPLIER) -- aman dipadankan by-index.
  const passA = resolveReturnsToSupplier(rawReturns, itemLookup);
  const fallbackInput = passA.resolved
    .map((r, i) => ({ productId: r.productId, qty: r.qty, createdAt: stockReturns[i].createdAt }))
    .filter((_, i) => passA.resolved[i].supplierName === null);
  const passB = resolveReturnsByLatestPurchase(fallbackInput, productSupplierHistory);

  let fallbackIdx = 0;
  const resolved: StockReturnForScoring[] = passA.resolved.map((r) =>
    r.supplierName !== null ? r : passB.resolved[fallbackIdx++]
  );
  const unresolvedCount = passB.unresolvedCount;

  const { scores } = buildSupplierScores(items, resolved);

  const now = new Date();
  // Upsert per supplier -- sequential (bukan Promise.all) supaya kalau ada error di
  // tengah, jelas supplier mana yang gagal (jumlah supplier per workspace UMKM kecil,
  // tidak perlu dioptimasi jadi batch/transaction).
  for (const s of scores) {
    await prisma.supplierScore.upsert({
      where: { workspaceId_supplierName: { workspaceId, supplierName: s.supplierName } },
      create: {
        workspaceId,
        supplierName: s.supplierName,
        score: s.score,
        onTimeRate: s.onTimeRate,
        priceStability: s.priceStability,
        defectRate: s.defectRate,
        lastCalculatedAt: now,
      },
      update: {
        score: s.score,
        onTimeRate: s.onTimeRate,
        priceStability: s.priceStability,
        defectRate: s.defectRate,
        lastCalculatedAt: now,
      },
    });
  }

  return {
    scores,
    meta: {
      unresolvedReturnCount: unresolvedCount,
      notes: [
        'onTimeRate selalu null untuk semua supplier -- schema.prisma PurchaseOrder belum punya kolom tanggal-janji-kirim vs tanggal-aktual-diterima, jadi komponen ini tidak bisa dihitung (bukan diasumsikan 100%). Skor akhir dihitung dari priceStability + defectRate saja (bobot direnormalisasi).',
        'defectRate diatribusikan ke supplier via fallback heuristik "supplier terakhir yang jual produk itu sebelum tanggal retur" -- endpoint inventory/returns/route.ts (punya agent lain) belum mengisi link eksplisit StockReturn->PurchaseOrderItem, jadi atribusi ini HIPOTESIS-tier, bukan ground-truth 1:1.',
      ],
    },
  };
}

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const forceRecalculate = searchParams.get('recalculate') === '1' || searchParams.get('recalculate') === 'true';

      if (!forceRecalculate) {
        const cached = await prisma.supplierScore.findMany({
          where: { workspaceId },
          orderBy: { score: 'desc' },
        });
        if (cached.length > 0) {
          return NextResponse.json({ supplierScores: cached, recalculated: false });
        }
      }

      const { scores, meta } = await recalculateSupplierScores(workspaceId);
      return NextResponse.json({ supplierScores: scores, recalculated: true, meta });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal menghitung skor supplier.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: trigger recalculate eksplisit (dipisah dari GET supaya tombol "Hitung Ulang" di
// UI bisa jelas maknanya sebagai aksi, bukan cuma query param yang gampang kelewat).
export const POST = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { scores, meta } = await recalculateSupplierScores(workspaceId);
      return NextResponse.json({
        success: true,
        message: `Skor keandalan ${scores.length} supplier berhasil dihitung ulang.`,
        supplierScores: scores,
        meta,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat skor supplier.') }, { status: 500 });
    }
  },
  { minRole: 'MEMBER' }
);
