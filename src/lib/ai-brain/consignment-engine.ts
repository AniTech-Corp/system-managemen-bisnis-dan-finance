/**
 * Engine konsinyasi (barang titip-jual).
 *
 * Field Product.ownershipType SUDAH ADA di schema.prisma (fase Fondasi Schema 2,
 * "OWNED" default / "CONSIGNED"). Aturan bisnis dasarnya:
 *
 *   1. Barang CONSIGNED tidak menambah "nilai stok milik toko" selama belum laku --
 *      toko cuma nitip, bukan beli putus, jadi nilainya TIDAK boleh ikut kehitung
 *      di valuasi stok pemilik (beda sumber kebenaran dari CompanyHealthScore --
 *      breakdown 35/30/20/15 di sana TIDAK disentuh sama sekali oleh modul ini).
 *   2. Begitu barang CONSIGNED laku (StockMovement SALE_OUT), toko baru berutang
 *      ke supplier sebesar qty x costPrice -- itu dicatat sebagai CashTransaction
 *      kategori "Kewajiban Konsinyasi" (EXPENSE, karena dari sudut pandang toko itu
 *      kewajiban/utang yang harus dibayar ke supplier, bukan pendapatan toko).
 *
 * SENGAJA Prisma-free (murni fungsi transformasi), sama filosofi dengan
 * bank-reconciliation.ts dan hpp-calculator.ts di folder ini -- supaya bisa dites
 * tanpa koneksi DB (lihat tests/consignment.test.ts) dan supaya modul ini bisa
 * dipakai ulang oleh SIAPAPUN yang nanti menulis StockMovement SALE_OUT (mis. fitur
 * kasir/POS -- BELUM ADA di codebase ini per 9 Sep 2026, dicek via grep "SALE_OUT"
 * nol hasil). `planConsignmentSaleLiability()` di bawah menghasilkan bentuk data
 * siap-pakai untuk 3 tulisan yang perlu terjadi atomik dalam SATU $transaction,
 * meniru pola yang sudah terbukti di src/app/api/v1/inventory/purchase-orders/route.ts
 * (PurchaseOrder + StockMovement + Product.currentStock + CashTransaction sekaligus):
 *   - StockMovement (type SALE_OUT, qtyChange negatif)
 *   - Product.currentStock (atomic decrement)
 *   - CashTransaction (EXPENSE, kategori Kewajiban Konsinyasi)
 * Pemanggil (route.ts masa depan) yang bertanggung jawab membungkus 3 hasil ini
 * dalam prisma.$transaction(async (tx) => {...}) persis pola purchase-orders,
 * modul ini TIDAK menyentuh prisma sama sekali.
 */

export const OWNERSHIP_TYPE_OWNED = 'OWNED' as const;
export const OWNERSHIP_TYPE_CONSIGNED = 'CONSIGNED' as const;

export type OwnershipType = typeof OWNERSHIP_TYPE_OWNED | typeof OWNERSHIP_TYPE_CONSIGNED;

/** Kategori CashTransaction baku untuk kewajiban konsinyasi -- dipakai SATU tempat
 *  ini sebagai sumber kebenaran (route.ts & test WAJIB import konstanta ini, bukan
 *  ketik ulang string-nya, supaya tidak ada 2 ejaan berbeda yang divergen diam-diam). */
export const CONSIGNMENT_LIABILITY_CATEGORY = 'Kewajiban Konsinyasi';

/** Cek apakah sebuah nilai ownershipType valid ("OWNED" atau "CONSIGNED" persis --
 *  string bebas bukan enum Prisma, konsisten pola "unit" di schema, jadi validasi
 *  input WAJIB dilakukan manual di layer aplikasi). */
export function isValidOwnershipType(value: unknown): value is OwnershipType {
  return value === OWNERSHIP_TYPE_OWNED || value === OWNERSHIP_TYPE_CONSIGNED;
}

/** true kalau produk berstatus konsinyasi (titip-jual, belum dibayar ke supplier). */
export function isConsignedProduct(ownershipType: string | null | undefined): boolean {
  return ownershipType === OWNERSHIP_TYPE_CONSIGNED;
}

// ---------------------------------------------------------------------------
// (1) Valuasi stok: konsinyasi TIDAK menambah nilai stok pemilik
// ---------------------------------------------------------------------------

export interface StockValueProductInput {
  id: string;
  ownershipType: string;
  currentStock: number;
  costPrice: number;
}

export interface StockValueBreakdown {
  /** Nilai stok yang BENERAN milik toko (ownershipType OWNED) -- ini yang boleh
   *  dipakai sebagai "nilai stok pemilik" di laporan mana pun. */
  ownedValue: number;
  /** Nilai stok konsinyasi -- referensi/informasi SAJA, TIDAK boleh dijumlah ke
   *  ownedValue atau ke aset toko manapun (barangnya bukan milik toko sampai laku). */
  consignedValue: number;
  ownedQty: number;
  consignedQty: number;
}

/**
 * Hitung ulang breakdown nilai stok dari daftar produk mentah. Sengaja dipisah
 * jadi 2 angka (ownedValue vs consignedValue) bukan 1 angka gabungan -- kalau
 * suatu saat ada kode lain yang butuh "nilai stok pemilik" (mis. laporan neraca),
 * WAJIB pakai `ownedValue`, bukan sum semua produk (itu akan salah, ikut
 * menghitung barang yang bukan milik toko).
 */
export function calculateStockValueBreakdown(products: StockValueProductInput[]): StockValueBreakdown {
  let ownedValue = 0;
  let consignedValue = 0;
  let ownedQty = 0;
  let consignedQty = 0;

  for (const p of products) {
    const stock = Number.isFinite(p.currentStock) ? p.currentStock : 0;
    const cost = Number.isFinite(p.costPrice) ? p.costPrice : 0;
    const value = stock * cost;

    if (isConsignedProduct(p.ownershipType)) {
      consignedValue += value;
      consignedQty += stock;
    } else {
      ownedValue += value;
      ownedQty += stock;
    }
  }

  return { ownedValue, consignedValue, ownedQty, consignedQty };
}

// ---------------------------------------------------------------------------
// (2) Auto-post kewajiban konsinyasi saat produk konsinyasi laku (SALE_OUT)
// ---------------------------------------------------------------------------

export interface ConsignmentSaleInput {
  workspaceId: string;
  userId?: string | null;
  productId: string;
  productName: string;
  /** Wajib > 0 -- qty barang yang laku. */
  qty: number;
  /** costPrice Product saat ini -- itu yang jadi utang ke supplier, BUKAN sellPrice
   *  (sellPrice adalah harga jual ke pembeli akhir, bukan urusan kewajiban ke supplier). */
  costPrice: number;
  paymentMethod?: string;
  /** Soft-reference opsional ke record pemicu (mis. sale/POS line item), meniru
   *  pola StockMovement.sourceType/sourceId yang sudah ada di schema. */
  sourceType?: string | null;
  sourceId?: string | null;
}

export interface ConsignmentSalePlan {
  stockMovement: {
    workspaceId: string;
    productId: string;
    userId: string | null;
    type: 'SALE_OUT';
    qtyChange: number;
    unitCost: number;
    sourceType: string | null;
    sourceId: string | null;
    note: string;
  };
  productDecrement: { productId: string; qty: number };
  cashTransaction: {
    workspaceId: string;
    userId: string | null;
    type: 'EXPENSE';
    category: string;
    amount: number;
    description: string;
    paymentMethod: string;
  };
}

/**
 * Susun "rencana" 3 tulisan atomik (StockMovement SALE_OUT + Product decrement +
 * CashTransaction Kewajiban Konsinyasi) untuk satu penjualan produk konsinyasi.
 * Pemanggil WAJIB cek `isConsignedProduct()` dulu SEBELUM manggil fungsi ini --
 * fungsi ini sendiri tidak menolak produk OWNED (bukan tanggung jawabnya menebak
 * status produk, cuma menyusun angka dari qty+costPrice yang dikasih).
 *
 * Return `{ error }` (bukan throw) kalau input tidak valid -- pola yang sama
 * dengan validateItems() di purchase-orders/route.ts, supaya pemanggil (route.ts)
 * bisa langsung map ke NextResponse 400 tanpa try/catch tambahan.
 */
export function planConsignmentSaleLiability(
  input: ConsignmentSaleInput
): ConsignmentSalePlan | { error: string } {
  if (!Number.isFinite(input.qty) || input.qty <= 0) {
    return { error: 'Qty penjualan harus angka lebih dari 0.' };
  }
  if (!Number.isFinite(input.costPrice) || input.costPrice < 0) {
    return { error: 'costPrice produk tidak valid (harus >= 0).' };
  }
  if (!input.productId) {
    return { error: 'productId wajib diisi.' };
  }

  const amount = input.qty * input.costPrice;
  const userId = input.userId ?? null;
  const paymentMethod = input.paymentMethod ?? 'TRANSFER_BANK';

  return {
    stockMovement: {
      workspaceId: input.workspaceId,
      productId: input.productId,
      userId,
      type: 'SALE_OUT',
      qtyChange: -input.qty,
      unitCost: input.costPrice,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      note: `Penjualan konsinyasi: ${input.productName} x${input.qty}`,
    },
    productDecrement: { productId: input.productId, qty: input.qty },
    cashTransaction: {
      workspaceId: input.workspaceId,
      userId,
      type: 'EXPENSE',
      category: CONSIGNMENT_LIABILITY_CATEGORY,
      amount,
      description: `Kewajiban konsinyasi ke supplier: ${input.productName} x${input.qty} terjual (belum dibayar)`,
      paymentMethod,
    },
  };
}

// ---------------------------------------------------------------------------
// (3) Laporan settlement konsinyasi -- ringkasan per produk apa yang harus
// disetor ke supplier (10 Sep 2026, agent api-stock-ops, F3 kontrak Tingkat B,
// endpoint GET /api/v1/inventory/consignment/report). SENGAJA fungsi murni
// terpisah (bukan menimpa planConsignmentSaleLiability di atas) -- fungsi lama
// itu menyusun RENCANA TULISAN untuk satu transaksi penjualan tunggal, sementara
// fungsi ini MERINGKAS data yang SUDAH tertulis (StockMovement + StockReturn)
// dalam suatu periode untuk ditampilkan sebagai laporan. Prisma-free, sama
// filosofi dengan fungsi lain di file ini -- pemanggil (route.ts) yang query
// StockMovement/StockReturn/Product lalu lempar hasilnya ke sini.
// ---------------------------------------------------------------------------

export interface ConsignmentReportProductInput {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  costPrice: number;
  currentStock: number;
  ownershipType: string;
  isActive: boolean;
}

export interface ConsignmentReportMovementInput {
  productId: string;
  type: string;
  qtyChange: number;
  createdAt: Date | string;
}

export interface ConsignmentReportReturnInput {
  productId: string;
  direction: string;
  qty: number;
  createdAt: Date | string;
}

export interface ConsignmentReportPeriod {
  from: Date;
  to: Date;
}

export interface ConsignmentReportRow {
  productId: string;
  name: string;
  sku: string | null;
  unit: string;
  costPrice: number;
  /** PURCHASE_IN + RETURN_IN dalam periode (barang titip masuk dari supplier). */
  qtyIn: number;
  /** |SALE_OUT| dalam periode (barang laku, jadi utang ke supplier). */
  qtySold: number;
  /** StockReturn direction TO_SUPPLIER dalam periode (barang dikembalikan, tidak jadi utang). */
  qtyReturnedToSupplier: number;
  currentStock: number;
  /** qtySold x costPrice -- jumlah yang harus disetor ke supplier untuk produk ini. */
  amountDueToSupplier: number;
}

export interface ConsignmentReportTotals {
  products: number;
  qtySold: number;
  amountDueToSupplier: number;
}

function isWithinPeriod(value: Date | string, period: ConsignmentReportPeriod): boolean {
  const t = new Date(value).getTime();
  return t >= period.from.getTime() && t <= period.to.getTime();
}

/**
 * Susun baris laporan settlement konsinyasi per produk CONSIGNED aktif, dari
 * daftar produk + StockMovement + StockReturn mentah (pemanggil yang query,
 * fungsi ini murni transformasi -- gampang dites tanpa DB, sama pola dengan
 * calculateStockValueBreakdown di atas).
 */
export function buildConsignmentReportRows(
  products: ConsignmentReportProductInput[],
  movements: ConsignmentReportMovementInput[],
  returns: ConsignmentReportReturnInput[],
  period: ConsignmentReportPeriod
): { rows: ConsignmentReportRow[]; totals: ConsignmentReportTotals } {
  const consignedProducts = products.filter((p) => p.isActive && isConsignedProduct(p.ownershipType));

  const rows: ConsignmentReportRow[] = consignedProducts.map((product) => {
    const productMovements = movements.filter(
      (m) => m.productId === product.id && isWithinPeriod(m.createdAt, period)
    );
    const productReturns = returns.filter(
      (r) => r.productId === product.id && isWithinPeriod(r.createdAt, period)
    );

    const qtyIn = productMovements
      .filter((m) => m.type === 'PURCHASE_IN' || m.type === 'RETURN_IN')
      .reduce((sum, m) => sum + Math.abs(m.qtyChange), 0);

    const qtySold = productMovements
      .filter((m) => m.type === 'SALE_OUT')
      .reduce((sum, m) => sum + Math.abs(m.qtyChange), 0);

    const qtyReturnedToSupplier = productReturns
      .filter((r) => r.direction === 'TO_SUPPLIER')
      .reduce((sum, r) => sum + r.qty, 0);

    const costPrice = Number.isFinite(product.costPrice) ? product.costPrice : 0;

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      costPrice,
      qtyIn,
      qtySold,
      qtyReturnedToSupplier,
      currentStock: product.currentStock,
      amountDueToSupplier: qtySold * costPrice,
    };
  });

  const totals: ConsignmentReportTotals = {
    products: rows.length,
    qtySold: rows.reduce((sum, r) => sum + r.qtySold, 0),
    amountDueToSupplier: rows.reduce((sum, r) => sum + r.amountDueToSupplier, 0),
  };

  return { rows, totals };
}
