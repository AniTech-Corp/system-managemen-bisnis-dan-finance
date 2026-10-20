import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { StockMovementType } from '@prisma/client';
import { postInventoryJournalInTx } from '@/lib/accounting/posting';
import { applyIncomingStock, applyOutgoingStock, averageUnitCost, isInventoryValued } from '@/lib/accounting/inventory';

// KLIR Inventory -- Retur stok (9 Sep 2026, BUILD_PLAN item konsinyasi-retur).
// POST: catat StockReturn (arah TO_SUPPLIER = balik ke supplier, mis. rusak/salah
// kirim; FROM_CUSTOMER = balik dari pelanggan, mis. komplain/tukar) + StockMovement
// audit-trail (RETURN_OUT/RETURN_IN, pola sama StockMovementType di schema) +
// Product.currentStock atomic increment/decrement, satu $transaction (callback)
// meniru pola auto-post di src/app/api/v1/inventory/purchase-orders/route.ts.
//
// TO_SUPPLIER: barang KELUAR dari toko -> currentStock DECREMENT, StockMovement
//   RETURN_OUT (qtyChange negatif).
// FROM_CUSTOMER: barang MASUK lagi ke toko -> currentStock INCREMENT, StockMovement
//   RETURN_IN (qtyChange positif).
//
// TIDAK auto-post CashTransaction di sini -- retur barang != otomatis ada uang
// pindah tangan (refund/kredit-nota beda kasus per transaksi, keputusan manual
// kasir/finance), StockReturn.cashTransactionId sudah disediakan skema sebagai
// soft-link OPSIONAL untuk fitur susulan, bukan diisi otomatis di endpoint ini.

const VALID_DIRECTIONS = ['TO_SUPPLIER', 'FROM_CUSTOMER'] as const;
type ReturnDirection = (typeof VALID_DIRECTIONS)[number];

function isValidDirection(value: unknown): value is ReturnDirection {
  return typeof value === 'string' && (VALID_DIRECTIONS as readonly string[]).includes(value);
}

// GET: List retur stok milik workspace, paginated sederhana (pola sama purchase-orders GET)
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
      const directionFilter = searchParams.get('direction');

      const where: Record<string, unknown> = { workspaceId };
      if (isValidDirection(directionFilter)) {
        where.direction = directionFilter;
      }

      const [total, stockReturns] = await Promise.all([
        prisma.stockReturn.count({ where }),
        prisma.stockReturn.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { product: { select: { id: true, name: true, sku: true } } },
        }),
      ]);

      return NextResponse.json({
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        stockReturns,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat retur barang.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Catat retur stok baru -- otomatis update stok + StockMovement audit-trail
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const productId: string | undefined = body?.productId;
      const direction: unknown = body?.direction;
      const qty = Number(body?.qty);
      const reason: string | undefined = body?.reason?.trim?.() || undefined;

      if (!productId || typeof productId !== 'string') {
        return NextResponse.json({ message: 'productId wajib diisi.' }, { status: 400 });
      }
      if (!isValidDirection(direction)) {
        return NextResponse.json(
          { message: 'direction wajib "TO_SUPPLIER" atau "FROM_CUSTOMER".' },
          { status: 400 }
        );
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        return NextResponse.json({ message: 'qty harus angka lebih dari 0.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      const result = await prisma.$transaction(async (tx) => {
        // Isolasi tenant: productId wajib milik workspace ini -- tanpa cek ini
        // attacker bisa kirim productId workspace lain lalu stok workspace lain
        // ikut ke-ubah padahal yang mencatat retur workspace ini.
        const product = await tx.product.findFirst({
          where: { id: productId, workspaceId },
          select: {
            id: true,
            currentStock: true,
            name: true,
            costPrice: true,
            inventoryValue: true,
            ownershipType: true,
          },
        });
        if (!product) {
          throw new Error('Produk tidak ditemukan atau bukan milik workspace ini.');
        }

        const isToSupplier = direction === 'TO_SUPPLIER';

        // Retur ke supplier = barang keluar dari toko -- tolak kalau stok tidak
        // cukup (mencegah currentStock jatuh negatif). Retur dari pelanggan tidak
        // butuh cek ini (barang MASUK, selalu aman).
        if (isToSupplier && product.currentStock < qty) {
          throw new Error(
            `Stok "${product.name}" tidak cukup untuk retur ke supplier (stok saat ini: ${product.currentStock}, diminta: ${qty}).`
          );
        }

        const stockReturn = await tx.stockReturn.create({
          data: {
            workspaceId,
            productId,
            direction,
            qty,
            reason: reason || null,
          },
        });

        // Nilai buku ikut disesuaikan dengan rata-rata bergerak:
        //   retur dari pelanggan -> barang masuk lagi, HPP dikembalikan (Cr 5-1100)
        //   retur ke supplier    -> barang keluar, dicatat sebagai selisih persediaan
        //                           (penggantian/refund supplier dicatat manual)
        const valued = isInventoryValued(product.ownershipType);
        const state = { qtyOnHand: product.currentStock, value: product.inventoryValue };
        let nextValue = product.inventoryValue;
        let journalAmount = 0;
        let unitCost: number | null = null;
        if (valued) {
          if (isToSupplier) {
            const issue = applyOutgoingStock(state, qty);
            nextValue = issue.remainingValue;
            journalAmount = issue.amount;
            unitCost = issue.unitCost;
          } else {
            const avg = averageUnitCost(state);
            const next = applyIncomingStock(state, qty, avg);
            nextValue = next.value;
            journalAmount = Math.round((next.value - state.value + Number.EPSILON) * 100) / 100;
            unitCost = avg;
          }
        }

        const movement = await tx.stockMovement.create({
          data: {
            workspaceId,
            productId,
            userId: auth.user.id,
            type: isToSupplier ? StockMovementType.RETURN_OUT : StockMovementType.RETURN_IN,
            qtyChange: isToSupplier ? -qty : qty,
            unitCost,
            sourceType: 'STOCK_RETURN',
            sourceId: stockReturn.id,
            note: isToSupplier
              ? `Retur ke supplier: ${product.name} x${qty}${reason ? ` (${reason})` : ''}`
              : `Retur dari pelanggan: ${product.name} x${qty}${reason ? ` (${reason})` : ''}`,
          },
        });

        // Atomic increment/decrement -- aman dari race condition, Postgres mengunci
        // baris saat UPDATE ... SET current_stock = current_stock +/- n (bukan
        // read-then-write), sama pola dengan purchase-orders/route.ts.
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: {
            currentStock: isToSupplier ? { decrement: qty } : { increment: qty },
            inventoryValue: nextValue,
          },
        });

        if (valued && journalAmount > 0) {
          await postInventoryJournalInTx(tx, {
            workspaceId,
            userId: auth.user.id,
            sourceId: stockReturn.id,
            amount: journalAmount,
            description: isToSupplier
              ? `Retur ke supplier: ${product.name} x${qty}`
              : `Retur dari pelanggan: ${product.name} x${qty}`,
            direction: isToSupplier ? 'SHRINKAGE' : 'RETURN_IN',
            entryDate: new Date(),
          });
        }

        return { stockReturn, product: updatedProduct, movementId: movement.id, journalAmount };
      });

      return NextResponse.json({
        success: true,
        message:
          direction === 'TO_SUPPLIER'
            ? `Retur ${qty} unit "${result.product.name}" ke supplier tercatat, stok otomatis berkurang.`
            : `Retur ${qty} unit "${result.product.name}" dari pelanggan tercatat, stok otomatis bertambah.`,
        stockReturn: result.stockReturn,
        product: result.product,
      });
    } catch (err: any) {
      // Pesan validasi bisnis (produk tidak ditemukan / stok gak cukup buat retur)
      // MEMANG dirancang buat ditunjukkan ke user -- jangan ikut kesensor sweep DEEP-010.
      const knownBusinessError =
        err instanceof Error &&
        /^(Produk tidak ditemukan|Stok \".+\" tidak cukup untuk retur)/.test(err.message)
          ? err.message
          : publicApiError('Retur barang gagal diproses.');
      return NextResponse.json({ message: knownBusinessError }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
