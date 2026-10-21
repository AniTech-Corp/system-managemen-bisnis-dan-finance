import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { StockMovementType } from '@prisma/client';
import { invalidateContextCache } from '@/lib/ai-brain';
import { postInventoryJournalInTx } from '@/lib/accounting/posting';
import { applyIncomingStock, applyOutgoingStock, averageUnitCost, isInventoryValued } from '@/lib/accounting/inventory';

// KLIR Inventory -- Penyesuaian stok manual (10 Sep 2026, agent api-stock-ops, F3
// kontrak Tingkat B). Beda dari purchase-orders/returns: penyesuaian TIDAK
// menyentuh CashTransaction (tidak ada uang berpindah), murni koreksi angka stok
// dengan alasan wajib tercatat (mis. barang rusak/hilang/hasil stock opname).
// qtyChange boleh positif (ADJUSTMENT_IN, mis. ketemu stok yang kelewat catat)
// atau negatif (ADJUSTMENT_OUT, mis. barang rusak/hilang) -- ditentukan dari
// tanda angka yang dikirim, bukan field arah terpisah. Pola $transaction +
// atomic increment/decrement meniru persis purchase-orders/route.ts &
// returns/route.ts (isolasi tenant, tolak stok jadi negatif).

// POST: Catat penyesuaian stok manual satu produk
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const productId: string | undefined = body?.productId;
      const qtyChange = Number(body?.qtyChange);
      const reason: string | undefined = body?.reason?.trim?.();
      const note: string | undefined = body?.note?.trim?.() || undefined;

      if (!productId || typeof productId !== 'string') {
        return NextResponse.json({ message: 'productId wajib diisi.' }, { status: 400 });
      }
      if (!Number.isFinite(qtyChange) || qtyChange === 0) {
        return NextResponse.json(
          { message: 'qtyChange wajib angka bukan nol (boleh negatif untuk stok berkurang).' },
          { status: 400 }
        );
      }
      if (!reason || reason.length < 3) {
        return NextResponse.json(
          { message: 'Alasan penyesuaian wajib diisi (minimal 3 huruf).' },
          { status: 400 }
        );
      }

      const workspaceId = auth.workspace.id;
      const isIncrease = qtyChange > 0;

      const result = await prisma.$transaction(async (tx) => {
        // Isolasi tenant: productId wajib milik workspace ini -- tanpa cek ini
        // attacker bisa kirim productId workspace lain lalu stok workspace lain
        // ikut ke-ubah padahal yang mencatat penyesuaian workspace ini.
        const product = await tx.product.findFirst({
          where: { id: productId, workspaceId },
          select: {
            id: true,
            name: true,
            currentStock: true,
            costPrice: true,
            inventoryValue: true,
            ownershipType: true,
          },
        });
        if (!product) {
          throw new Error('Produk tidak ditemukan atau bukan milik workspace ini.');
        }

        // Tolak kalau hasil currentStock < 0 -- dihitung dulu di aplikasi (bukan
        // cuma andalkan constraint DB) supaya pesan error bisa menyebut angka
        // stok saat ini + yang diminta, sama filosofi dengan returns/route.ts.
        const resultingStock = product.currentStock + qtyChange;
        if (resultingStock < 0) {
          throw new Error(
            `Penyesuaian ditolak: stok "${product.name}" akan jadi negatif (stok saat ini: ${product.currentStock}, penyesuaian: ${qtyChange}).`
          );
        }

        // Nilai buku ikut disesuaikan memakai rata-rata saat ini, lalu dijurnal
        // ke "Selisih Persediaan" supaya saldo 1-1400 tetap cocok dengan kartu stok.
        const valued = isInventoryValued(product.ownershipType);
        const state = { qtyOnHand: product.currentStock, value: product.inventoryValue };
        let nextValue = product.inventoryValue;
        let journalAmount = 0;
        let unitCost: number | null = null;
        if (valued) {
          if (isIncrease) {
            const next = applyIncomingStock(state, qtyChange, averageUnitCost(state));
            nextValue = next.value;
            journalAmount = Math.round((next.value - state.value + Number.EPSILON) * 100) / 100;
          } else {
            const issue = applyOutgoingStock(state, Math.abs(qtyChange));
            nextValue = issue.remainingValue;
            journalAmount = issue.amount;
            unitCost = issue.unitCost;
          }
        }

        const movement = await tx.stockMovement.create({
          data: {
            workspaceId,
            productId,
            userId: auth.user.id,
            type: isIncrease ? StockMovementType.ADJUSTMENT_IN : StockMovementType.ADJUSTMENT_OUT,
            qtyChange,
            unitCost,
            sourceType: 'manual_adjustment',
            note: note
              ? `Penyesuaian stok "${product.name}": ${reason} -- ${note}`
              : `Penyesuaian stok "${product.name}": ${reason}`,
          },
        });

        // Atomic increment -- qtyChange sudah signed (positif/negatif), Postgres
        // mengunci baris saat UPDATE ... SET current_stock = current_stock + n
        // (bukan read-then-write), sama pola dengan purchase-orders/returns.
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { currentStock: { increment: qtyChange }, inventoryValue: nextValue },
        });

        if (valued && journalAmount > 0) {
          await postInventoryJournalInTx(tx, {
            workspaceId,
            userId: auth.user.id,
            sourceId: movement.id,
            amount: journalAmount,
            description: isIncrease
              ? `Selisih persediaan lebih: ${product.name} x${qtyChange} (${reason})`
              : `Selisih persediaan kurang: ${product.name} x${Math.abs(qtyChange)} (${reason})`,
            direction: isIncrease ? 'GAIN' : 'SHRINKAGE',
            entryDate: new Date(),
          });
        }

        return { movement, product: updatedProduct, journalAmount };
      });

      // AI Brain cache workspace ini sekarang basi (stok berubah) -- invalidate
      // best-effort, kegagalan cache-invalidation TIDAK boleh menggagalkan
      // response sukses penyesuaian.
      try {
        invalidateContextCache(workspaceId);
      } catch {
        // sengaja diabaikan, lihat komentar di atas
      }

      return NextResponse.json(
        {
          movement: result.movement,
          product: {
            id: result.product.id,
            name: result.product.name,
            currentStock: result.product.currentStock,
          },
          inventoryValueChange: result.journalAmount,
        },
        { status: 201 }
      );
    } catch (err: any) {
      // Pesan validasi bisnis (produk tidak ditemukan / stok bakal negatif) MEMANG
      // dirancang buat ditunjukkan ke user -- jangan ikut kesensor sweep DEEP-010.
      const knownBusinessError =
        err instanceof Error &&
        /^(Produk tidak ditemukan|Penyesuaian ditolak: stok \".+\" akan jadi negatif)/.test(err.message)
          ? err.message
          : publicApiError('Penyesuaian stok gagal diproses.');
      return NextResponse.json({ message: knownBusinessError }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
