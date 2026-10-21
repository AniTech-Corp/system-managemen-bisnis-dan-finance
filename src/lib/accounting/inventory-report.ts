import { JournalStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { round2 } from './inventory';
import type { DateRange } from './period';

/**
 * Laporan Nilai Persediaan & Kartu Stok.
 *
 * Nilai stok diambil dari `Product.inventoryValue` — angka buku yang diperbarui
 * di alur yang sama dengan stok (pembelian, penjualan, retur, penyesuaian).
 * Angka itu dicocokkan dengan saldo akun `1-1400 Persediaan`:
 *
 *   selisih = saldo akun 1-1400 − total nilai buku produk
 *
 * Selisih TIDAK dihilangkan: kalau ada, artinya ada stok lama yang belum
 * dimasukkan ke saldo awal atau harga pokok produk diubah manual tanpa jurnal.
 *
 * Barang titip jual (CONSIGNED) tidak dihitung sebagai persediaan sendiri.
 */

export const INVENTORY_ACCOUNT_CODE = '1-1400';

export interface InventoryValuationRow {
  productId: string;
  sku: string | null;
  name: string;
  unit: string;
  qty: number;
  avgCost: number;
  value: number;
  ownershipType: string;
  warnings: string[];
}

export interface InventoryReport {
  accountCode: string;
  asOf: Date;
  totals: {
    productCount: number;
    quantity: number;
    value: number;
    ledgerValue: Prisma.Decimal;
    difference: Prisma.Decimal;
    warningCount: number;
  };
  items: InventoryValuationRow[];
  warnings: string[];
}

export interface StockCardMovement {
  id: string;
  createdAt: Date;
  type: string;
  qtyChange: number;
  unitCost: number | null;
  note: string | null;
  balanceQty: number;
}

export interface StockCardReport {
  accountCode: string;
  period: DateRange;
  product: {
    id: string;
    sku: string | null;
    name: string;
    unit: string;
    qty: number;
    avgCost: number;
    value: number;
  };
  openingQty: number;
  movements: StockCardMovement[];
  closingQty: number;
}

/** Saldo akun persediaan per akhir periode (hanya jurnal POSTED). */
export async function inventoryLedgerBalance(
  workspaceId: string,
  asOf: Date
): Promise<Prisma.Decimal> {
  const lines = await prisma.journalLine.findMany({
    where: {
      workspaceId,
      account: { code: INVENTORY_ACCOUNT_CODE },
      entry: { status: JournalStatus.POSTED, entryDate: { lte: asOf } },
    },
    select: { debit: true, credit: true },
  });

  return lines.reduce((acc, line) => acc.plus(line.debit).minus(line.credit), new Prisma.Decimal(0));
}

export async function getInventoryReport(
  workspaceId: string,
  range: DateRange
): Promise<InventoryReport> {
  const [products, ledgerValue] = await Promise.all([
    prisma.product.findMany({
      where: { workspaceId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        sku: true,
        name: true,
        unit: true,
        currentStock: true,
        costPrice: true,
        inventoryValue: true,
        ownershipType: true,
        isActive: true,
      },
    }),
    inventoryLedgerBalance(workspaceId, range.endDate),
  ]);

  const items: InventoryValuationRow[] = [];
  const warnings: string[] = [];
  let totalQty = 0;
  let totalValue = 0;
  let warningCount = 0;

  for (const product of products) {
    // Barang titip jual bukan milik toko -- tidak dinilai di sini.
    if (product.ownershipType === 'CONSIGNED') continue;

    const qty = Number(product.currentStock ?? 0);
    const value = round2(Number(product.inventoryValue ?? 0));
    const rowWarnings: string[] = [];

    if (qty < 0) {
      rowWarnings.push('Qty stok minus — periksa penjualan/penyesuaian terakhir.');
    }
    if (qty > 0 && value === 0) {
      rowWarnings.push('Stok ada tapi nilai buku 0 — kemungkinan saldo awal belum dimasukkan.');
    }
    if (!product.isActive && (qty !== 0 || value !== 0)) {
      rowWarnings.push('Produk nonaktif masih punya stok/nilai.');
    }

    if (rowWarnings.length === 0 && qty === 0 && value === 0) continue;

    totalQty += qty;
    totalValue += value;
    warningCount += rowWarnings.length;
    warnings.push(...rowWarnings.map((w) => `${product.name}: ${w}`));

    items.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      qty,
      avgCost: qty > 0 ? round2(value / qty) : Number(product.costPrice ?? 0),
      value,
      ownershipType: product.ownershipType,
      warnings: rowWarnings,
    });
  }

  const difference = ledgerValue.minus(new Prisma.Decimal(totalValue.toFixed(2)));
  if (!difference.isZero()) {
    warnings.push(
      `Selisih dengan saldo akun ${INVENTORY_ACCOUNT_CODE}: Rp ${difference.toFixed(2)}. ` +
        'Biasanya karena stok lama belum dimasukkan ke saldo awal, atau harga pokok diubah manual tanpa jurnal.'
    );
  }

  return {
    accountCode: INVENTORY_ACCOUNT_CODE,
    asOf: range.endDate,
    totals: {
      productCount: items.length,
      quantity: totalQty,
      value: round2(totalValue),
      ledgerValue,
      difference,
      warningCount,
    },
    items,
    warnings,
  };
}

/** Kartu stok: mutasi satu produk dalam periode + saldo berjalan. */
export async function getStockCard(
  workspaceId: string,
  productId: string,
  range: DateRange
): Promise<StockCardReport | null> {
  const product = await prisma.product.findFirst({
    where: { id: productId, workspaceId },
    select: {
      id: true,
      sku: true,
      name: true,
      unit: true,
      currentStock: true,
      costPrice: true,
      inventoryValue: true,
    },
  });
  if (!product) return null;

  const [openingAgg, movements] = await Promise.all([
    prisma.stockMovement.aggregate({
      where: { workspaceId, productId, createdAt: { lt: range.startDate } },
      _sum: { qtyChange: true },
    }),
    prisma.stockMovement.findMany({
      where: {
        workspaceId,
        productId,
        createdAt: {
          gte: range.startDate,
          lte: range.endDate,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true, type: true, qtyChange: true, unitCost: true, note: true },
    }),
  ]);

  const openingQty = Number(openingAgg._sum.qtyChange ?? 0);
  let running = openingQty;

  return {
    accountCode: INVENTORY_ACCOUNT_CODE,
    period: range,
    product: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      unit: product.unit,
      qty: Number(product.currentStock ?? 0),
      avgCost: Number(product.costPrice ?? 0),
      value: round2(Number(product.inventoryValue ?? 0)),
    },
    openingQty,
    movements: movements.map((movement) => {
      running += Number(movement.qtyChange);
      return {
        id: movement.id,
        createdAt: movement.createdAt,
        type: movement.type,
        qtyChange: Number(movement.qtyChange),
        unitCost: movement.unitCost === null ? null : Number(movement.unitCost),
        note: movement.note,
        balanceQty: running,
      };
    }),
    closingQty: running,
  };
}
