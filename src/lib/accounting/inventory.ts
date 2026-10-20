/**
 * Penilaian persediaan — rata-rata bergerak (moving average), tanpa DB.
 *
 * Aturan yang dipakai seluruh modul inventori:
 *
 * - **Masuk** (pembelian, retur dari pelanggan, stok opname lebih): nilai buku
 *   bertambah, harga rata-rata dihitung ulang sebagai `nilai / qty`.
 * - **Keluar** (penjualan, retur ke supplier, stok opname kurang): harga pokok
 *   diambil dari rata-rata SAAT ITU, dan nilai buku berkurang sebesar HPP itu.
 *
 * Yang disimpan adalah **nilai buku** (bukan hanya rata-rata), lalu HPP dihitung
 * `nilai * qty / qtyOnHand` dan dibulatkan ke 2 desimal. Dengan begitu sisa nilai
 * buku selalu = nilai sebelumnya - HPP, sehingga saldo akun 1-1400 bisa dicocokkan
 * dengan kartu stok tanpa selisih akibat pembulatan.
 *
 * Barang titip jual (ownershipType CONSIGNED) TIDAK masuk penilaian ini karena
 * belum dibeli — lihat `consignment-engine.ts`.
 */

export interface InventoryCostState {
  /** Qty di tangan menurut buku (boleh 0, tidak pernah negatif). */
  qtyOnHand: number;
  /** Nilai buku (Rp) dari qty tersebut. */
  value: number;
}

export interface InventoryIssue {
  /** Qty yang benar-benar dikeluarkan (dipotong ke qty tersedia). */
  qty: number;
  /** Harga pokok per unit hasil rata-rata, dibulatkan 2 desimal. */
  unitCost: number;
  /** Nilai HPP yang harus dijurnal, dibulatkan 2 desimal. */
  amount: number;
  /** Sisa nilai buku setelah pengeluaran. */
  remainingValue: number;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function safeNumber(value: number | null | undefined): number {
  return Number.isFinite(value ?? NaN) ? (value as number) : 0;
}

/**
 * Masuknya barang: hitung rata-rata baru.
 *
 * Bila stok lama kosong/negatif, seluruh nilai mengikuti harga beli baru
 * (rata-rata lama tidak bisa dipertahankan karena nilainya nol).
 */
export function applyIncomingStock(
  state: InventoryCostState,
  qtyIn: number,
  unitCost: number
): InventoryCostState {
  const inQty = Math.max(0, safeNumber(qtyIn));
  const inCost = Math.max(0, safeNumber(unitCost));
  if (inQty === 0) {
    return { qtyOnHand: Math.max(0, safeNumber(state.qtyOnHand)), value: round2(safeNumber(state.value)) };
  }

  const oldQty = Math.max(0, safeNumber(state.qtyOnHand));
  const oldValue = Math.max(0, safeNumber(state.value));
  const newQty = oldQty + inQty;
  const newValue = oldValue + inQty * inCost;

  return { qtyOnHand: newQty, value: round2(newValue) };
}

/**
 * Keluarnya barang: HPP memakai rata-rata saat ini.
 *
 * `qty` dipotong ke `qtyOnHand` supaya nilai buku tidak pernah negatif walau
 * data stok lama terlanjur tidak sinkron.
 */
export function applyOutgoingStock(state: InventoryCostState, qtyOut: number): InventoryIssue {
  const qtyOnHand = Math.max(0, safeNumber(state.qtyOnHand));
  const value = Math.max(0, safeNumber(state.value));
  const requested = Math.max(0, safeNumber(qtyOut));

  if (requested === 0 || qtyOnHand === 0) {
    return { qty: 0, unitCost: 0, amount: 0, remainingValue: round2(value) };
  }

  const qty = Math.min(requested, qtyOnHand);
  // Pembulatan hanya di nilai HPP; sisa nilai = nilai - HPP (dijamin konsisten).
  const amount = Math.min(value, round2((value * qty) / qtyOnHand));
  const remainingValue = round2(value - amount);
  const unitCost = qty > 0 ? round2(amount / qty) : 0;

  return { qty, unitCost, amount, remainingValue };
}

/** Rata-rata berjalan per unit (untuk kolom "harga rata-rata" & StockMovement.unitCost). */
export function averageUnitCost(state: InventoryCostState): number {
  const qty = Math.max(0, safeNumber(state.qtyOnHand));
  if (qty === 0) return 0;
  return round2(Math.max(0, safeNumber(state.value)) / qty);
}

/** Barang titip jual tidak dihitung sebagai persediaan milik sendiri. */
export function isInventoryValued(ownershipType?: string | null): boolean {
  return (ownershipType ?? 'OWNED') !== 'CONSIGNED';
}
