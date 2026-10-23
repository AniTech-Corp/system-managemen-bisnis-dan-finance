import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { AccountType, StockMovementType, TransactionType } from '@prisma/client';
import { invalidateContextCache } from '@/lib/ai-brain';
import { isConsignedProduct, planConsignmentSaleLiability } from '@/lib/ai-brain/consignment-engine';
import {
  ensureCategoryMappingInTx,
  postInventoryJournalInTx,
  postObligationIssuedInTx,
  recordCashTransaction,
  resolveProjectDimensionInTx,
} from '@/lib/accounting/posting';
import { applyOutgoingStock, isInventoryValued } from '@/lib/accounting/inventory';

// KLIR Inventory -- Penjualan keluar manual / kasir (10 Sep 2026, agent
// api-stock-ops, F3 kontrak Tingkat B). Beda dari purchase-orders (barang MASUK +
// kas keluar): di sini barang KELUAR + kas MASUK. Urutan tulisan dalam satu
// $transaction: (1) CashTransaction INCOME dibuat LEBIH DULU supaya StockMovement
// per item bisa soft-link sourceId ke id-nya (sourceType 'SALE'), (2) per item
// StockMovement SALE_OUT (qtyChange negatif, unitCost = costPrice produk SAAT itu
// -- bukan sellPrice, itu harga jual ke pembeli beda urusan dari harga pokok),
// (3) Product.currentStock atomic decrement. Pola $transaction + isolasi tenant +
// cek stok cukup meniru persis purchase-orders/route.ts & returns/route.ts.

interface SaleItemInput {
  productId: string;
  qty: number;
  unitPrice: number;
}

function validateItems(raw: unknown): { items: SaleItemInput[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Minimal 1 item barang wajib diisi.' };
  }
  const items: SaleItemInput[] = [];
  for (const entry of raw) {
    const productId = (entry as any)?.productId;
    const qty = Number((entry as any)?.qty);
    const unitPrice = Number((entry as any)?.unitPrice);
    if (typeof productId !== 'string' || !productId) {
      return { error: 'productId setiap item wajib diisi.' };
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      return { error: `Qty untuk produk ${productId} harus angka lebih dari 0.` };
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: `Harga jual (unitPrice) untuk produk ${productId} tidak valid.` };
    }
    items.push({ productId, qty, unitPrice });
  }
  return { items };
}

// POST: Catat penjualan keluar manual -- otomatis update stok + posting Kas INCOME
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const paymentMethod: string = body?.paymentMethod?.trim?.() || 'TUNAI';
      const note: string | undefined = body?.note?.trim?.() || undefined;
      const customerName: string | undefined = body?.customerName?.trim?.() || undefined;
      // Additive 10 Sep 2026 (Fable) -- kontrak inventory-api-schema, F3b/F4.
      // customerId OPSIONAL, soft-relasi ke Customer terstruktur (beda dari
      // customerName teks bebas di atas yang TETAP ada untuk pembeli lewat/jalan
      // yang belum terdaftar). Divalidasi milik workspace DI DALAM $transaction
      // di bawah (pola isolasi tenant sama seperti productId).
      const customerIdRaw: string | undefined = body?.customerId || undefined;
      const projectIdRaw: string | undefined = body?.projectId || undefined;
      const divisionRaw: string | undefined = body?.division || undefined;

      // Tanggal bisnis penjualan (opsional). Dipakai untuk baris kas DAN jurnal
      // utang konsinyasi, supaya penjualan yang dicatat mundur masuk ke periode
      // yang benar. Default: sekarang.
      let transactionDate = new Date();
      if (body?.transactionDate) {
        transactionDate = new Date(String(body.transactionDate));
        if (Number.isNaN(transactionDate.getTime())) {
          return NextResponse.json({ message: 'Tanggal penjualan tidak valid.' }, { status: 400 });
        }
      }

      const parsedItems = validateItems(body?.items);
      if ('error' in parsedItems) {
        return NextResponse.json({ message: parsedItems.error }, { status: 400 });
      }
      const { items } = parsedItems;

      const workspaceId = auth.workspace.id;
      const totalAmount = items.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
      const itemCount = items.length;

      const result = await prisma.$transaction(async (tx) => {
        // Isolasi tenant: SEMUA productId yang dikirim wajib milik workspace ini
        // DAN aktif -- tanpa cek ini, attacker bisa kirim productId workspace lain
        // lalu stok workspace lain ikut ke-decrement padahal yang jualan workspace
        // ini. Produk nonaktif juga ditolak (barang yang sudah "dihentikan" tidak
        // boleh dijual lagi lewat jalur ini).
        const productIds = [...new Set(items.map((i) => i.productId))];
        const ownedProducts = await tx.product.findMany({
          where: { id: { in: productIds }, workspaceId, isActive: true },
          select: {
            id: true,
            name: true,
            currentStock: true,
            costPrice: true,
            inventoryValue: true,
            ownershipType: true,
            supplierName: true,
          },
        });
        if (ownedProducts.length !== productIds.length) {
          throw new Error(
            'Salah satu produk tidak ditemukan, bukan milik workspace ini, atau sudah nonaktif.'
          );
        }
        const productMap = new Map(ownedProducts.map((p) => [p.id, p]));

        // Isolasi tenant untuk customerId (opsional) -- sama filosofi productId di
        // atas: kalau dikirim, wajib milik workspace ini, kalau tidak ditemukan
        // tolak SEMUA transaksi (bukan diam-diam diabaikan) supaya tidak ada
        // kesan "sudah dikaitkan ke pelanggan" padahal gagal.
        let customerRecord: { id: string; name: string } | null = null;
        if (customerIdRaw) {
          customerRecord = await tx.customer.findFirst({
            where: { id: customerIdRaw, workspaceId },
            select: { id: true, name: true },
          });
          if (!customerRecord) {
            throw new Error('Pelanggan tidak ditemukan atau bukan milik workspace ini.');
          }
        }

        // Cek stok cukup untuk SEMUA item SEBELUM menulis apapun -- tolak 400
        // sebut nama produk yang kurang, meniru filosofi returns/route.ts (tolak
        // sebelum currentStock jatuh negatif). Kalau 1 produk dipesan >1 baris
        // item, jumlahkan dulu supaya validasi benar melihat total qty diminta.
        const qtyNeededByProduct = new Map<string, number>();
        for (const item of items) {
          qtyNeededByProduct.set(item.productId, (qtyNeededByProduct.get(item.productId) ?? 0) + item.qty);
        }
        for (const [productId, qtyNeeded] of qtyNeededByProduct) {
          const product = productMap.get(productId)!;
          if (product.currentStock < qtyNeeded) {
            throw new Error(
              `Stok "${product.name}" tidak cukup (stok saat ini: ${product.currentStock}, diminta: ${qtyNeeded}).`
            );
          }
        }

        // CashTransaction INCOME dibuat LEBIH DULU supaya StockMovement per item
        // bisa soft-link sourceId ke id-nya (kontrak: sourceType 'SALE'). Nama
        // customer terstruktur (kalau ada) diutamakan dibanding customerName teks
        // bebas -- kalau dua-duanya dikirim (jarang, tapi mungkin), tetap sebut
        // satu nama saja di deskripsi supaya tidak dobel/rancu.
        const descriptionName = customerRecord?.name ?? customerName;
        const description = descriptionName
          ? `Penjualan ${itemCount} item (${descriptionName})`
          : `Penjualan ${itemCount} item`;
        const dimension = await resolveProjectDimensionInTx(
          tx,
          workspaceId,
          projectIdRaw ?? null,
          divisionRaw ?? null
        );
        const { transaction: cashTransaction } = await recordCashTransaction(tx, {
          workspaceId,
          userId: auth.user.id,
          type: TransactionType.INCOME,
          category: 'Penjualan Stok/Kasir',
          amount: totalAmount,
          description,
          paymentMethod,
          transactionDate,
          division: dimension.division,
          projectId: dimension.projectId,
          autoMapFallback: true,
        });

        const saleItems: Array<{ productId: string; name: string; qty: number; unitPrice: number; subtotal: number }> = [];

        // Nilai buku per produk dipakai berurutan supaya satu penjualan dengan
        // dua baris produk yang sama tetap memakai rata-rata yang benar.
        const inventoryState = new Map<string, { qtyOnHand: number; value: number }>();
        for (const product of ownedProducts) {
          inventoryState.set(product.id, {
            qtyOnHand: product.currentStock,
            value: product.inventoryValue,
          });
        }
        let cogsTotal = 0;
        const cogsItems: Array<{ name: string; qty: number; unitCost: number; amount: number }> = [];

        for (const item of items) {
          const product = productMap.get(item.productId)!;
          const subtotal = item.qty * item.unitPrice;

          // Harga pokok: rata-rata bergerak saat penjualan. Barang titip jual
          // tidak dinilai di sini -- HPP-nya sudah diakui lewat jurnal utang
          // konsinyasi (Dr 5-1100 / Cr 2-1100) di bawah.
          let unitCost = product.costPrice;
          let inventoryValueAfter: number | null = null;
          if (isInventoryValued(product.ownershipType)) {
            const state = inventoryState.get(item.productId) ?? {
              qtyOnHand: product.currentStock,
              value: product.inventoryValue,
            };
            const issue = applyOutgoingStock(state, item.qty);
            inventoryState.set(item.productId, {
              qtyOnHand: state.qtyOnHand - issue.qty,
              value: issue.remainingValue,
            });
            unitCost = issue.unitCost;
            inventoryValueAfter = issue.remainingValue;
            if (issue.amount > 0) {
              cogsTotal += issue.amount;
              cogsItems.push({ name: product.name, qty: issue.qty, unitCost: issue.unitCost, amount: issue.amount });
            }
          }

          await tx.stockMovement.create({
            data: {
              workspaceId,
              productId: item.productId,
              userId: auth.user.id,
              type: StockMovementType.SALE_OUT,
              qtyChange: -item.qty,
              unitCost,
              unitPrice: item.unitPrice,
              occurredAt: transactionDate,
              sourceType: 'SALE',
              sourceId: cashTransaction.id,
              customerId: customerRecord?.id ?? null,
              note: note
                ? `Penjualan: ${product.name} x${item.qty} -- ${note}`
                : `Penjualan: ${product.name} x${item.qty}`,
            },
          });

          // Atomic decrement -- aman dari race condition, Postgres mengunci baris
          // saat UPDATE ... SET current_stock = current_stock - n (bukan
          // read-then-write), sama pola dengan purchase-orders/returns/route.ts.
          await tx.product.update({
            where: { id: item.productId },
            data:
              inventoryValueAfter === null
                ? { currentStock: { decrement: item.qty } }
                : { currentStock: { decrement: item.qty }, inventoryValue: inventoryValueAfter },
          });

          saleItems.push({
            productId: item.productId,
            name: product.name,
            qty: item.qty,
            unitPrice: item.unitPrice,
            subtotal,
          });
        }

        // HPP diakui bersamaan dengan pendapatan (Dr 5-1100 / Cr 1-1400), satu
        // jurnal per penjualan supaya mudah ditelusuri dari dokumen kas.
        cogsTotal = Math.round((cogsTotal + Number.EPSILON) * 100) / 100;
        if (cogsTotal > 0) {
          await postInventoryJournalInTx(tx, {
            workspaceId,
            userId: auth.user.id,
            sourceId: cashTransaction.id,
            amount: cogsTotal,
            description: `HPP penjualan (${cogsItems.length} baris barang)`,
            direction: 'COGS',
            entryDate: transactionDate,
            costCenter: dimension.division,
            projectId: dimension.projectId,
          });
        }

        // Produk TITIP JUAL (ownershipType CONSIGNED): uang dari pembeli masuk penuh
        // ke kas (INCOME di atas), tetapi harga pokoknya (costPrice x qty) BUKAN
        // pengurang kas -- itu utang ke supplier yang baru timbul saat barang laku.
        // Karena itu yang dibuat adalah ScheduledObligation (PENDING), bukan baris
        // kas: kas baru berkurang saat utangnya dibayar lewat alur kewajiban biasa.
        // Jurnalnya Dr HPP / Cr Utang Usaha, sehingga laba sudah benar tanpa
        // mengorbankan saldo kas.
        let consignmentLiabilityAmount = 0;
        let consignmentItemCount = 0;
        const consignmentObligationIds: string[] = [];
        for (const item of items) {
          const product = productMap.get(item.productId)!;
          if (!isConsignedProduct(product.ownershipType)) continue;
          const plan = planConsignmentSaleLiability({
            workspaceId,
            userId: auth.user.id,
            productId: product.id,
            productName: product.name,
            qty: item.qty,
            costPrice: product.costPrice,
            supplierName: product.supplierName,
            dueDate: transactionDate,
            sourceType: 'SALE',
            sourceId: cashTransaction.id,
          });
          if ('error' in plan) throw new Error(plan.error);

          const obligation = await tx.scheduledObligation.create({
            data: {
              workspaceId,
              name: plan.obligation.name,
              dueDate: plan.obligation.dueDate,
              amount: plan.obligation.amount,
              category: plan.obligation.category,
              status: 'PENDING',
            },
          });

          // Modul akuntansi mungkin aktif di workspace yang dibuat sebelum
          // kategori "HPP Konsinyasi" ada. Pastikan pemetaannya (fallback ke
          // 5-1100) supaya penjualan tidak gagal hanya karena pemetaan.
          await ensureCategoryMappingInTx(tx, {
            workspaceId,
            category: plan.obligation.category,
            type: AccountType.EXPENSE,
            fallbackAccountCode: '5-1100',
          });

          await postObligationIssuedInTx(tx, {
            workspaceId,
            userId: auth.user.id,
            obligation,
            entryDate: transactionDate,
            division: dimension.division,
            projectId: dimension.projectId,
          });

          consignmentLiabilityAmount += plan.obligation.amount;
          consignmentItemCount += 1;
          consignmentObligationIds.push(obligation.id);
        }

        return {
          cashTransaction,
          saleItems,
          cogsTotal,
          cogsItems,
          consignmentLiabilityAmount,
          consignmentItemCount,
          consignmentObligationIds,
        };
      });

      // AI Brain cache workspace ini sekarang basi (stok & kas berubah) --
      // invalidate best-effort, kegagalan cache-invalidation TIDAK boleh
      // menggagalkan response sukses penjualan.
      try {
        invalidateContextCache(workspaceId);
      } catch {
        // sengaja diabaikan, lihat komentar di atas
      }

      return NextResponse.json(
        {
          sale: {
            cashTransactionId: result.cashTransaction.id,
            totalAmount,
            itemCount,
            items: result.saleItems,
            // HPP rata-rata bergerak untuk barang milik sendiri (0 untuk jasa /
            // barang titip jual). Dipakai UI & pengujian untuk mencocokkan jurnal.
            cogs: { total: result.cogsTotal, items: result.cogsItems },
            // Nol kalau tidak ada produk titip jual di penjualan ini.
            consignmentLiability: {
              amount: result.consignmentLiabilityAmount,
              itemCount: result.consignmentItemCount,
              // Id kewajiban (utang usaha) yang dibuat; dipakai UI/laporan untuk
              // menelusuri dan melunasi utang tersebut.
              obligationIds: result.consignmentObligationIds,
            },
          },
        },
        { status: 201 }
      );
    } catch (err: any) {
      const knownBusinessError =
        err instanceof Error &&
        /^(Stok \".+\" tidak cukup|Salah satu produk tidak ditemukan|Pelanggan tidak ditemukan)/.test(err.message)
          ? err.message
          : publicApiError('Penjualan gagal diproses.');
      return NextResponse.json({ message: knownBusinessError }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
