'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Boxes, History, ShoppingCart, Star, Plus, RefreshCw, AlertTriangle, Handshake, Wallet, SlidersHorizontal, Trash2, Users, CalendarClock, Camera, Undo2, Pencil, X, Check } from 'lucide-react';

// KlirInventoryView -- sub-section "Stok & Pembelian" (modul internal "inventory",
// HARAM dipakai sebagai label ke user, lihat CLAUDE.md ROLE vs MODULE vs FEATURE).
// Dibangun 10 Sep 2026 sesuai kontrak UI (agent ui-inventory-view, paralel dengan
// api-inventory-read/engine-inventory-intelligence/wiring-page-ceo-finance). Endpoint
// GET/POST /api/v1/inventory/products dan GET /api/v1/inventory/stock-movements
// dibangun agent lain PARALEL -- komponen ini ditulis mengikuti kontrak (bentuk
// respons sudah disepakati di context pack), BUKAN menunggu file itu ada. Endpoint
// /api/v1/inventory/purchase-orders dan /api/v1/inventory/supplier-score SUDAH ADA &
// live (diverifikasi baca kode langsung sebelum menulis file ini) -- bentuk field di
// bawah mengikuti persis apa yang route.ts itu benar-benar balikin.
//
// Pola styling & fetch disamakan persis dengan KlirScheduleView.tsx: tab lokal +
// INPUT_STYLE/CARD_STYLE/TAB_BTN sendiri (project ini tidak punya modul style
// bersama, tiap panel duplikat constants-nya sendiri -- lihat catatan di
// KlirScheduleView.tsx), event bus 'klir-inventory-updated' dipicu setelah mutasi
// sukses (dipakai CompanyDataDashboard.tsx untuk refresh kartu ringkas, lihat
// kontrak wiring).
//
// Pola test: TIDAK ada jsdom/testing-library di project ini -- yang ditest cuma
// named-export fungsi murni (formatRupiahStok, movementTypeLabel, isLowStock,
// summarizeProducts, validateProductForm) via tests/klir-inventory-view.test.ts,
// sama persis pola tests/klir-schedule-view.test.ts.
//
// UPDATE 10 Sep 2026 (kontrak Tingkat B, agent ui-stock-ops): tab baru "Konsinyasi"
// + form "Catat pembelian" (tab Pesanan pembelian) + form "Catat penjualan" &
// "Penyesuaian stok" (tab Riwayat keluar-masuk). Endpoint yang dipakai --
// GET /api/v1/inventory/consignment/report, POST /api/v1/inventory/sales,
// POST /api/v1/inventory/stock-adjustments -- dibangun PARALEL oleh agent
// api-stock-ops sesuai context pack; bentuk request/response di bawah mengikuti
// kontrak yang sudah disepakati, BUKAN menunggu file route-nya ada dulu (endpoint
// PATCH /api/v1/inventory/consignment dan POST /api/v1/inventory/purchase-orders
// SUDAH ADA & live, dibaca langsung sebelum menulis kode di bawah). Agent ini
// HANYA menyentuh file ini + test-nya (lihat pembagian berkas tim di context pack).
//
// UPDATE 10 Sep 2026 (Fable) -- batch BANGUN gabungan F3b+F4, kontrak agent
// inventory-ui: (1) form "Catat retur" (tab Riwayat) -> POST /api/v1/inventory/returns
// (endpoint SUDAH ADA & live, dibaca langsung); (2) "Foto jadi stok" (tab Produk & stok)
// -> POST lalu PUT /api/v1/inventory/photo-to-stock (endpoint SUDAH ADA & live, dibaca
// langsung); (3) field packSize/packUnit/supplierName di form tambah produk + kolom
// kemasan di tabel; (4) tombol "Ubah" -> PATCH /api/v1/inventory/products/[id]; (5) tab
// baru "Pelanggan" -> GET/POST /api/v1/inventory/customers; (6) tab baru "Kadaluarsa" ->
// GET/POST /api/v1/inventory/product-batches; (7) select "Pelanggan (opsional)" di form
// Catat penjualan -> customerId ke POST sales. Endpoint customers/product-batches +
// PATCH products/[id] dibangun PARALEL oleh agent inventory-api-schema sesuai kontrak
// (bentuk request/response disepakati di context pack) -- komponen ini ditulis mengikuti
// kontrak itu, BUKAN menunggu file route-nya ada. Tipe Product baru (packSize/packUnit/
// supplierName) juga datang dari agent yang sama (additive di prisma/schema.prisma).

type InventoryTab = 'produk' | 'riwayat' | 'pembelian' | 'pemasok' | 'konsinyasi' | 'pelanggan' | 'kadaluarsa';

// ---------------------------------------------------------------------------
// Tipe data -- mengikuti kontrak API (products/stock-movements) + bentuk nyata
// route.ts yang sudah live (purchase-orders/supplier-score, dibaca langsung).
// ---------------------------------------------------------------------------

export interface InventoryProductRow {
  id: string;
  sku?: string | null;
  name: string;
  category?: string | null;
  unit: string;
  ownershipType?: string;
  costPrice: number;
  sellPrice: number;
  currentStock: number;
  minStock: number;
  isActive: boolean;
  // 10 Sep 2026 (Fable) -- additive dari agent inventory-api-schema (schema.prisma
  // Product.packSize/packUnit/supplierName). Semua opsional, produk lama tanpa nilai
  // ini tetap tampil normal (kolom kemasan disembunyikan, lihat formatPackLabel).
  packSize?: number | null;
  packUnit?: string | null;
  supplierName?: string | null;
}

export interface InventoryProductSummary {
  productCount: number;
  activeCount: number;
  stockValue: number;
  lowStockCount: number;
  lowStock: Array<{ id: string; name: string; sku?: string | null; unit: string; currentStock: number; minStock: number }>;
}

export type StockMovementTypeValue =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'OPENING_BALANCE';

export interface InventoryMovementRow {
  id: string;
  productId: string;
  type: StockMovementTypeValue;
  qtyChange: number;
  unitCost?: number | null;
  note?: string | null;
  createdAt: string;
  product: { id: string; name: string; sku?: string | null; unit: string };
}

interface PurchaseOrderItemRow {
  id: string;
  productId: string;
  qty: number;
  unitCost: number;
  subtotal: number;
}

export interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  supplierName: string;
  supplierPhone?: string | null;
  status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED';
  totalAmount: number;
  paymentMethod: string;
  purchaseDate: string;
  notes?: string | null;
  items: PurchaseOrderItemRow[];
}

export interface SupplierScoreRow {
  supplierName: string;
  score: number;
  onTimeRate: number | null;
  priceStability: number | null;
  defectRate: number | null;
  lastCalculatedAt?: string | null;
}

// ---------------------------------------------------------------------------
// Pelanggan + batch kadaluarsa -- ditambahkan 10 Sep 2026 (Fable), kontrak batch
// BANGUN F3b+F4. Bentuk tipe mengikuti PERSIS kontrak model Customer/ProductBatch
// (agent inventory-api-schema, additive di prisma/schema.prisma) yang disepakati
// di context pack -- model Prisma belum tentu sudah ada saat file ini ditulis
// (paralel), jadi tipe di bawah adalah kontrak, bukan hasil introspeksi kode nyata.
// ---------------------------------------------------------------------------

export interface CustomerRow {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  area?: string | null;
  type: string;
  notes?: string | null;
  isActive: boolean;
}

export interface ProductBatchRow {
  id: string;
  productId: string;
  batchCode?: string | null;
  expiryDate: string;
  qty: number;
  product: { id: string; name: string; sku?: string | null; unit: string };
}

// ---------------------------------------------------------------------------
// Pure helpers -- diexport supaya bisa ditest via node:test tanpa render React.
// ---------------------------------------------------------------------------

export function formatRupiahStok(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `Rp ${Math.round(v).toLocaleString('id-ID')}`;
}

/** Format angka stok/qty biasa (bukan Rupiah) -- pakai id-ID supaya pemisah ribuan
 *  konsisten dengan formatRupiahStok, tapi tanpa desimal berlebih untuk qty pecahan
 *  (mis. 1.5 kg tetap tampil "1,5", bukan dibulatkan paksa seperti Rupiah). */
export function formatQtyStok(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
}

export const MOVEMENT_TYPE_LABELS: Record<StockMovementTypeValue, string> = {
  PURCHASE_IN: 'Pembelian masuk',
  SALE_OUT: 'Penjualan keluar',
  ADJUSTMENT_IN: 'Penyesuaian masuk',
  ADJUSTMENT_OUT: 'Penyesuaian keluar',
  RETURN_IN: 'Retur masuk',
  RETURN_OUT: 'Retur keluar',
  OPENING_BALANCE: 'Saldo awal',
};

/** Label Indonesia untuk tipe pergerakan stok -- tipe tak dikenal (mis. data lama /
 *  enum baru yang belum dipetakan) fallback ke string mentahnya sendiri, bukan
 *  "undefined", supaya UI tidak pernah kosong diam-diam. */
export function movementTypeLabel(type: string): string {
  return MOVEMENT_TYPE_LABELS[type as StockMovementTypeValue] || type;
}

/** true kalau tipe pergerakan menambah stok (IN), dipakai untuk warna +/-. */
export function isMovementIn(type: string): boolean {
  return type === 'PURCHASE_IN' || type === 'ADJUSTMENT_IN' || type === 'RETURN_IN' || type === 'OPENING_BALANCE';
}

/** Mirror PERSIS logic "produk di bawah minimum" di kontrak API products/route.ts
 *  (aktif DAN minStock>0 DAN currentStock<=minStock) -- dipakai supaya badge di UI
 *  selalu sinkron dengan summary.lowStockCount dari backend, bukan hitungan sendiri
 *  yang bisa melenceng. */
export function isLowStock(product: Pick<InventoryProductRow, 'isActive' | 'currentStock' | 'minStock'>): boolean {
  return product.isActive && product.minStock > 0 && product.currentStock <= product.minStock;
}

/** Ringkasan lokal dari daftar produk -- dipakai sebagai fallback kalau summary dari
 *  backend belum sampai (mis. baru refresh, atau environment test) supaya kartu atas
 *  tidak pernah menampilkan angka yang bertentangan dengan tabel di bawahnya.
 *  HARAM dipakai untuk override summary asli dari server -- server = sumber kebenaran
 *  (bisa hitung produk non-aktif dsb yang tidak selalu dikirim penuh ke client). */
export function summarizeProducts(products: InventoryProductRow[]): InventoryProductSummary {
  const activeProducts = products.filter((p) => p.isActive);
  const stockValue = activeProducts.reduce((sum, p) => sum + p.currentStock * p.costPrice, 0);
  const lowStock = activeProducts.filter((p) => isLowStock(p));
  return {
    productCount: products.length,
    activeCount: activeProducts.length,
    stockValue,
    lowStockCount: lowStock.length,
    lowStock: lowStock.slice(0, 20).map((p) => ({ id: p.id, name: p.name, sku: p.sku, unit: p.unit, currentStock: p.currentStock, minStock: p.minStock })),
  };
}

export interface ProductFormInput {
  name: string;
  costPrice: number | '';
  sellPrice: number | '';
  minStock: number | '';
  openingStock: number | '';
}

/** Validasi client-side, WAJIB persis sinkron dengan pengecekan kontrak POST
 *  products/route.ts ("name wajib, angka >=0") -- supaya user dapat pesan error yang
 *  sama sebelum request dikirim, sama pola dengan validateReservationForm di
 *  KlirScheduleView.tsx. */
export function validateProductForm(input: ProductFormInput): string[] {
  const errors: string[] = [];
  if (!input.name || !input.name.trim()) errors.push('Nama produk wajib diisi.');
  if (input.costPrice !== '' && Number(input.costPrice) < 0) errors.push('Harga beli tidak boleh minus.');
  if (input.sellPrice !== '' && Number(input.sellPrice) < 0) errors.push('Harga jual tidak boleh minus.');
  if (input.minStock !== '' && Number(input.minStock) < 0) errors.push('Stok minimum tidak boleh minus.');
  if (input.openingStock !== '' && Number(input.openingStock) < 0) errors.push('Stok awal tidak boleh minus.');
  return errors;
}

/**
 * Petakan error hasil POST /api/v1/inventory/products ke tempat tampilnya di form
 * (F1 kontrak Tingkat B, 10 Sep 2026). 409 = SKU bentrok -> tampil tepat di bawah
 * field SKU dan form TIDAK di-reset supaya user tinggal ganti SKU. Status lain ->
 * daftar error umum di bawah form. Pure function supaya bisa dites tanpa render.
 */
export function mapProductSubmitError(status: number, message?: string | null): { field: 'sku' | 'form'; text: string } {
  const clean = (message || '').trim();
  if (status === 409) {
    return { field: 'sku', text: clean || 'SKU ini sudah dipakai produk lain di workspace ini. Ganti SKU atau kosongkan.' };
  }
  return { field: 'form', text: clean || 'Gagal menambah produk.' };
}

export const PO_STATUS_META: Record<PurchaseOrderRow['status'], { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: '#98A2B3' },
  ORDERED: { label: 'Dipesan', color: '#D8A33C' },
  RECEIVED: { label: 'Diterima', color: '#3FBF8F' },
  CANCELLED: { label: 'Dibatalkan', color: '#EF4444' },
};

/** Warna badge skor supplier -- ambang sederhana >=80 hijau / >=60 kuning / lainnya
 *  merah, murni presentasi (skor sendiri sudah dihitung deterministik di backend,
 *  file ini tidak menghitung ulang apapun). */
export function supplierScoreColor(score: number): string {
  if (score >= 80) return '#3FBF8F';
  if (score >= 60) return '#D8A33C';
  return '#EF4444';
}

// ---------------------------------------------------------------------------
// Konsinyasi, penjualan, penyesuaian stok -- ditambahkan 10 Sep 2026, kontrak
// Tingkat B. Tipe di bawah mengikuti PERSIS bentuk respons GET
// /api/v1/inventory/consignment/report yang disepakati di context pack.
// ---------------------------------------------------------------------------

export interface ConsignmentReportRow {
  productId: string;
  name: string;
  sku?: string | null;
  unit: string;
  costPrice: number;
  qtyIn: number;
  qtySold: number;
  qtyReturnedToSupplier: number;
  currentStock: number;
  amountDueToSupplier: number;
}

export interface ConsignmentReportTotals {
  products: number;
  qtySold: number;
  amountDueToSupplier: number;
}

/** Label status kepemilikan produk (Product.ownershipType) dalam Bahasa
 *  Indonesia -- nilai tak dikenal fallback ke string mentahnya sendiri, sama
 *  filosofi dengan movementTypeLabel di atas (HARAM tampil "undefined"). */
export function consignmentStatusLabel(ownershipType?: string | null): string {
  if (ownershipType === 'CONSIGNED') return 'Konsinyasi (titip jual)';
  if (ownershipType === 'OWNED') return 'Milik toko';
  return ownershipType || 'Tidak diketahui';
}

export interface SaleItemFormInput {
  productId: string;
  qty: number | '';
  unitPrice: number | '';
}

/** Validasi client-side form "Catat penjualan", mirror kontrak POST
 *  /api/v1/inventory/sales (setiap item: productId wajib, qty>0, unitPrice
 *  tidak boleh minus) -- supaya pesan error di layar sama dengan yang bakal
 *  ditolak server, sebelum request dikirim. */
export function validateSaleForm(items: SaleItemFormInput[]): string[] {
  const errors: string[] = [];
  if (items.length === 0) {
    errors.push('Minimal 1 item barang wajib diisi.');
    return errors;
  }
  items.forEach((item, idx) => {
    const n = idx + 1;
    if (!item.productId) errors.push(`Baris ${n}: pilih produk.`);
    if (item.qty === '' || !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0) {
      errors.push(`Baris ${n}: qty harus lebih dari 0.`);
    }
    if (item.unitPrice !== '' && Number(item.unitPrice) < 0) {
      errors.push(`Baris ${n}: harga jual tidak boleh minus.`);
    }
  });
  return errors;
}

/** Total transaksi penjualan = sum(qty * unitPrice) -- preview di form sebelum
 *  submit; angka final yang dicatat tetap dihitung ulang oleh server. Entri
 *  kosong/tidak valid dihitung sebagai 0, bukan bikin NaN menular ke total. */
export function buildSaleTotal(items: SaleItemFormInput[]): number {
  return items.reduce((sum, item) => {
    const qty = item.qty === '' ? 0 : Number(item.qty);
    const price = item.unitPrice === '' ? 0 : Number(item.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return sum;
    return sum + qty * price;
  }, 0);
}

export interface AdjustmentFormInput {
  productId: string;
  qtyChange: number | '';
  reason: string;
}

/** Validasi client-side form "Penyesuaian stok", mirror kontrak POST
 *  /api/v1/inventory/stock-adjustments (productId wajib, qtyChange angka bukan
 *  nol, alasan wajib minimal 3 huruf). */
export function validateAdjustmentForm(input: AdjustmentFormInput): string[] {
  const errors: string[] = [];
  if (!input.productId) errors.push('Pilih produk yang mau disesuaikan.');
  if (input.qtyChange === '' || !Number.isFinite(Number(input.qtyChange)) || Number(input.qtyChange) === 0) {
    errors.push('Jumlah penyesuaian wajib diisi dan tidak boleh nol.');
  }
  if (!input.reason || input.reason.trim().length < 3) {
    errors.push('Alasan penyesuaian wajib diisi, minimal 3 huruf.');
  }
  return errors;
}

export interface PurchaseItemFormInput {
  productId: string;
  qty: number | '';
  unitCost: number | '';
}

export interface PurchaseOrderFormInput {
  supplierName: string;
  items: PurchaseItemFormInput[];
}

/** Validasi client-side form "Catat pembelian", mirror kontrak POST
 *  /api/v1/inventory/purchase-orders yang sudah live (route.ts baris 20-41):
 *  supplierName wajib, minimal 1 item, tiap item productId+qty>0+unitCost>=0. */
export function validatePurchaseOrderForm(input: PurchaseOrderFormInput): string[] {
  const errors: string[] = [];
  if (!input.supplierName || !input.supplierName.trim()) errors.push('Nama supplier wajib diisi.');
  if (input.items.length === 0) {
    errors.push('Minimal 1 item barang wajib diisi.');
    return errors;
  }
  input.items.forEach((item, idx) => {
    const n = idx + 1;
    if (!item.productId) errors.push(`Baris ${n}: pilih produk.`);
    if (item.qty === '' || !Number.isFinite(Number(item.qty)) || Number(item.qty) <= 0) {
      errors.push(`Baris ${n}: qty harus lebih dari 0.`);
    }
    if (item.unitCost === '' || !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0) {
      errors.push(`Baris ${n}: harga beli tidak valid.`);
    }
  });
  return errors;
}

/** Total pembelian = sum(qty * unitCost) -- preview di form, angka final tetap
 *  dihitung ulang server (POST purchase-orders/route.ts baris 102). */
export function buildPurchaseOrderTotal(items: PurchaseItemFormInput[]): number {
  return items.reduce((sum, item) => {
    const qty = item.qty === '' ? 0 : Number(item.qty);
    const cost = item.unitCost === '' ? 0 : Number(item.unitCost);
    if (!Number.isFinite(qty) || !Number.isFinite(cost)) return sum;
    return sum + qty * cost;
  }, 0);
}

// ---------------------------------------------------------------------------
// Retur stok, foto jadi stok, kemasan, edit produk, pelanggan, batch kadaluarsa
// -- ditambahkan 10 Sep 2026 (Fable), kontrak batch BANGUN F3b+F4.
// ---------------------------------------------------------------------------

export type ReturnDirectionValue = 'TO_SUPPLIER' | 'FROM_CUSTOMER';

/** Label Indonesia arah retur, mirror kontrak POST /api/v1/inventory/returns
 *  (direction wajib salah satu dari 2 nilai ini) -- nilai tak dikenal fallback
 *  ke string mentahnya sendiri, sama filosofi movementTypeLabel di atas. */
export function returnDirectionLabel(direction: string): string {
  if (direction === 'TO_SUPPLIER') return 'Retur ke supplier';
  if (direction === 'FROM_CUSTOMER') return 'Retur dari pelanggan';
  return direction;
}

export interface ReturnFormInput {
  productId: string;
  direction: ReturnDirectionValue | '';
  qty: number | '';
  reason: string;
}

/** Validasi client-side form "Catat retur", mirror kontrak POST
 *  /api/v1/inventory/returns (returns/route.ts baris 77-88): productId wajib,
 *  direction wajib TO_SUPPLIER/FROM_CUSTOMER, qty > 0. reason OPSIONAL di
 *  server (route.ts baris 75 -- `|| undefined`, tidak divalidasi wajib). */
export function validateReturnForm(input: ReturnFormInput): string[] {
  const errors: string[] = [];
  if (!input.productId) errors.push('Pilih produk yang mau diretur.');
  if (input.direction !== 'TO_SUPPLIER' && input.direction !== 'FROM_CUSTOMER') {
    errors.push('Pilih arah retur: ke supplier atau dari pelanggan.');
  }
  if (input.qty === '' || !Number.isFinite(Number(input.qty)) || Number(input.qty) <= 0) {
    errors.push('Qty retur harus lebih dari 0.');
  }
  return errors;
}

/** Selisih hari kalender antara tanggal kadaluarsa dan "sekarang" -- dibulatkan
 *  ke bawah, jadi produk yang kadaluarsa HARI INI (sisa jam < 24) tetap terhitung
 *  0 (bukan -1 yang menyesatkan seolah sudah lewat kemarin). Negatif berarti
 *  sudah lewat tanggal kadaluarsa. `now` bisa dioverride untuk keperluan test --
 *  default `new Date()` supaya perilaku produksi tetap "hari ini yang sebenarnya". */
export function daysUntilExpiry(expiryDate: string, now: Date = new Date()): number {
  const expiry = new Date(expiryDate);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfExpiry = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfExpiry.getTime() - startOfToday.getTime()) / msPerDay);
}

export interface ExpiryBadge {
  label: string;
  color: string;
}

/** Badge kadaluarsa dari selisih hari (kontrak: kritis <7 hari merah, waspada
 *  <30 hari amber) -- produk yang SUDAH lewat tanggal kadaluarsa (negatif) dapat
 *  label terpisah "Sudah kadaluarsa" (tetap merah, sama ambang) supaya user
 *  tidak salah baca seolah "masih 7 hari lagi" padahal justru sudah lewat.
 *  null = aman, tidak perlu badge (>=30 hari lagi). */
export function expiryBadge(daysLeft: number): ExpiryBadge | null {
  if (daysLeft < 0) return { label: 'Sudah kadaluarsa', color: '#EF4444' };
  if (daysLeft < 7) return { label: 'Kadaluarsa < 7 hari', color: '#EF4444' };
  if (daysLeft < 30) return { label: 'Kadaluarsa < 30 hari', color: '#D8A33C' };
  return null;
}

/** Format info kemasan untuk tabel produk, mis. formatPackLabel(30, 'dus', 'pcs')
 *  -> "30 pcs/dus" (1 dus = 30 pcs). null kalau packUnit tidak diisi (produk lama/
 *  tidak pakai kemasan besar) -- UI menyembunyikan kolom kemasan pada kasus ini,
 *  bukan menampilkan "null pcs/undefined". packSize falsy (0/null/undefined)
 *  di-fallback ke 1, konsisten default Product.packSize di schema. */
export function formatPackLabel(packSize: number | null | undefined, packUnit: string | null | undefined, baseUnit: string): string | null {
  if (!packUnit || !packUnit.trim()) return null;
  const size = packSize && packSize > 0 ? packSize : 1;
  return `${formatQtyStok(size)} ${baseUnit}/${packUnit.trim()}`;
}

export interface ProductEditFormInput {
  name: string;
  costPrice: number | '';
  sellPrice: number | '';
  minStock: number | '';
}

/** Validasi client-side form "Ubah produk" (PATCH /api/v1/inventory/products/[id]),
 *  subset dari validateProductForm -- PATCH tidak menerima openingStock (stok
 *  cuma bisa berubah lewat pembelian/penjualan/penyesuaian/retur, bukan diedit
 *  langsung, mencegah angka stok berubah diam-diam tanpa jejak StockMovement). */
export function validateProductEditForm(input: ProductEditFormInput): string[] {
  const errors: string[] = [];
  if (!input.name || !input.name.trim()) errors.push('Nama produk wajib diisi.');
  if (input.costPrice !== '' && Number(input.costPrice) < 0) errors.push('Harga beli tidak boleh minus.');
  if (input.sellPrice !== '' && Number(input.sellPrice) < 0) errors.push('Harga jual tidak boleh minus.');
  if (input.minStock !== '' && Number(input.minStock) < 0) errors.push('Stok minimum tidak boleh minus.');
  return errors;
}

export const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  WARUNG: 'Warung',
  TOKO: 'Toko',
  LAINNYA: 'Lainnya',
};

/** Label Indonesia jenis pelanggan (Customer.type, bebas teks di server -- lihat
 *  komentar scan-kebutuhan-data-modul-7.md 3.3, BUKAN enum) -- nilai tak dikenal
 *  fallback ke string mentahnya sendiri, kosong/null fallback ke "Lainnya" (sama
 *  dengan default server `type String @default("LAINNYA")`). */
export function customerTypeLabel(type?: string | null): string {
  if (!type) return 'Lainnya';
  return CUSTOMER_TYPE_LABELS[type] || type;
}

export interface CustomerFormInput {
  name: string;
  phone: string;
  address: string;
  area: string;
  type: string;
  notes: string;
}

/** Validasi client-side form tambah pelanggan, mirror kontrak POST
 *  /api/v1/inventory/customers (name wajib, sisanya opsional). */
export function validateCustomerForm(input: CustomerFormInput): string[] {
  const errors: string[] = [];
  if (!input.name || !input.name.trim()) errors.push('Nama pelanggan wajib diisi.');
  return errors;
}

export interface BatchFormInput {
  productId: string;
  expiryDate: string;
  qty: number | '';
  batchCode: string;
}

/** Validasi client-side form tambah batch kadaluarsa, mirror kontrak POST
 *  /api/v1/inventory/product-batches (productId wajib, expiryDate wajib format
 *  YYYY-MM-DD, qty > 0; batchCode opsional). */
export function validateBatchForm(input: BatchFormInput): string[] {
  const errors: string[] = [];
  if (!input.productId) errors.push('Pilih produk yang mau dicatat batch-nya.');
  if (!input.expiryDate) errors.push('Tanggal kadaluarsa wajib diisi.');
  if (input.qty === '' || !Number.isFinite(Number(input.qty)) || Number(input.qty) <= 0) {
    errors.push('Qty batch harus lebih dari 0.');
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Styling constants (duplikat sengaja, konsisten pola KlirScheduleView.tsx)
// ---------------------------------------------------------------------------

const TAB_BTN = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '7px',
  padding: '8px 13px',
  borderRadius: '9px',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  border: 0,
  background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
  color: active ? '#F5F7FA' : '#98A2B3',
});

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: '36px',
  padding: '0 12px',
  background: '#10141C',
  border: 0,
  boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)',
  borderRadius: '9px',
  color: '#F5F7FA',
  fontSize: '12.5px',
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: '#98A2B3',
  marginBottom: '5px',
};

const CARD_STYLE: React.CSSProperties = {
  padding: '14px 16px',
  borderRadius: '12px',
  background: '#10141C',
  border: 0,
  boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
  display: 'flex',
  flexDirection: 'column',
  gap: '9px',
};

const SUBMIT_BTN = (bg: string): React.CSSProperties => ({
  marginTop: '2px',
  height: '36px',
  borderRadius: '9px',
  background: bg,
  border: 0,
  color: '#06080C',
  fontFamily: 'inherit',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
});

const TABLE_TH: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: '10.5px',
  fontWeight: 600,
  color: '#7C8698',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};

const TABLE_TD: React.CSSProperties = {
  padding: '9px 10px',
  fontSize: '12px',
  color: '#F5F7FA',
  borderTop: 0,
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
};

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ display: 'inline-flex', padding: '3px 9px', borderRadius: '999px', fontSize: '10.5px', fontWeight: 600, background: `${color}1F`, color }}>
      {label}
    </span>
  );
}

function ErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div style={{ padding: '9px 12px', borderRadius: '9px', background: 'rgba(239,68,68,0.12)', border: 0, boxShadow: '0 4px 18px -2px rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {errors.map((e, i) => (
        <span key={i} style={{ fontSize: '11px', color: '#F5B8B8' }}>{e}</span>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.015)' }}>
      <span style={{ fontSize: '11.5px', color: '#7C8698', textAlign: 'center' }}>{text}</span>
    </div>
  );
}

// Bentuk 1 baris draft hasil POST /api/v1/inventory/photo-to-stock (candidates[])
// PLUS 2 field state lokal UI (selectedProductId/qtyChange) yang user edit sebelum
// commit via PUT -- lihat komentar besar photo-to-stock/route.ts baris 92-104 untuk
// bentuk asli 'candidates[]' dari server (matchStatus/matchedProductId/dst).
interface PhotoStockDraftRow {
  name: string;
  qty: number | null;
  unit: string | null;
  note: string | null;
  matchStatus: 'exact' | 'fuzzy' | 'ambiguous' | 'unmatched';
  matchedProductId: string | null;
  matchedProductName: string | null;
  ambiguousCandidates?: Array<{ id: string; name: string }>;
  // State lokal yang diedit user sebelum commit -- default selectedProductId dari
  // matchedProductId (kalau exact/fuzzy), qtyChange default dari qty hasil OCR.
  selectedProductId: string;
  qtyChange: number | '';
  included: boolean;
}

export interface KlirInventoryViewProps {
  workspaceId: string;
  workspaceName: string;
  role?: 'CEO' | 'FINANCE' | 'MANAGER_OPERASIONAL';
}

export default function KlirInventoryView(_props: KlirInventoryViewProps) {
  const isReadOnly = _props.role === 'MANAGER_OPERASIONAL';
  const [tab, setTab] = useState<InventoryTab>('produk');

  // --- Produk & stok ---
  const [products, setProducts] = useState<InventoryProductRow[]>([]);
  const [summary, setSummary] = useState<InventoryProductSummary | null>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productLoadError, setProductLoadError] = useState<string | null>(null);
  const [productQuery, setProductQuery] = useState('');

  const [prodName, setProdName] = useState('');
  const [prodSku, setProdSku] = useState('');
  const [prodCategory, setProdCategory] = useState('');
  const [prodUnit, setProdUnit] = useState('pcs');
  const [prodCostPrice, setProdCostPrice] = useState<number | ''>('');
  const [prodSellPrice, setProdSellPrice] = useState<number | ''>('');
  const [prodMinStock, setProdMinStock] = useState<number | ''>('');
  const [prodOpeningStock, setProdOpeningStock] = useState<number | ''>('');
  const [prodFormErrors, setProdFormErrors] = useState<string[]>([]);
  // Error khusus field SKU (409 dari server) -- dipisah dari prodFormErrors supaya
  // tampil tepat di bawah input SKU, bukan di daftar error umum.
  const [prodSkuError, setProdSkuError] = useState<string | null>(null);
  const skuInputRef = useRef<HTMLInputElement>(null);
  const [prodSubmitting, setProdSubmitting] = useState(false);
  const [prodSubmitMsg, setProdSubmitMsg] = useState<string | null>(null);

  // --- Riwayat keluar-masuk ---
  const [movements, setMovements] = useState<InventoryMovementRow[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementLoadError, setMovementLoadError] = useState<string | null>(null);
  const [movementFetched, setMovementFetched] = useState(false);

  // --- Pesanan pembelian ---
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [loadingPO, setLoadingPO] = useState(false);
  const [poLoadError, setPoLoadError] = useState<string | null>(null);
  const [poFetched, setPoFetched] = useState(false);

  // --- Skor pemasok ---
  const [supplierScores, setSupplierScores] = useState<SupplierScoreRow[]>([]);
  const [loadingScores, setLoadingScores] = useState(false);
  const [scoreLoadError, setScoreLoadError] = useState<string | null>(null);
  const [scoreFetched, setScoreFetched] = useState(false);

  // --- Konsinyasi (10 Sep, kontrak Tingkat B) ---
  const [consignmentRows, setConsignmentRows] = useState<ConsignmentReportRow[]>([]);
  const [consignmentTotals, setConsignmentTotals] = useState<ConsignmentReportTotals | null>(null);
  const [loadingConsignment, setLoadingConsignment] = useState(false);
  const [consignmentLoadError, setConsignmentLoadError] = useState<string | null>(null);
  const [consignmentFetched, setConsignmentFetched] = useState(false);
  const [consignmentFrom, setConsignmentFrom] = useState('');
  const [consignmentTo, setConsignmentTo] = useState('');
  const [consignmentActionMsg, setConsignmentActionMsg] = useState<string | null>(null);
  const [consignmentActionError, setConsignmentActionError] = useState<string | null>(null);
  const [consignmentTogglingId, setConsignmentTogglingId] = useState<string | null>(null);
  const [addConsignProductId, setAddConsignProductId] = useState('');

  // --- Form "Catat pembelian" (tab Pesanan pembelian) ---
  const [poSupplierName, setPoSupplierName] = useState('');
  const [poSupplierPhone, setPoSupplierPhone] = useState('');
  const [poPaymentMethod, setPoPaymentMethod] = useState('TUNAI');
  const [poNotes, setPoNotes] = useState('');
  const [poItems, setPoItems] = useState<PurchaseItemFormInput[]>([{ productId: '', qty: '', unitCost: '' }]);
  const [poFormErrors, setPoFormErrors] = useState<string[]>([]);
  const [poSubmitting, setPoSubmitting] = useState(false);
  const [poSubmitMsg, setPoSubmitMsg] = useState<string | null>(null);

  // --- Form "Catat penjualan" (tab Riwayat keluar-masuk) ---
  const [saleItems, setSaleItems] = useState<SaleItemFormInput[]>([{ productId: '', qty: '', unitPrice: '' }]);
  const [salePaymentMethod, setSalePaymentMethod] = useState('TUNAI');
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleFormErrors, setSaleFormErrors] = useState<string[]>([]);
  const [saleSubmitting, setSaleSubmitting] = useState(false);
  const [saleSubmitMsg, setSaleSubmitMsg] = useState<string | null>(null);

  // --- Form "Penyesuaian stok" (tab Riwayat keluar-masuk) ---
  const [adjProductId, setAdjProductId] = useState('');
  const [adjQtyChange, setAdjQtyChange] = useState<number | ''>('');
  const [adjReason, setAdjReason] = useState('');
  const [adjNote, setAdjNote] = useState('');
  const [adjFormErrors, setAdjFormErrors] = useState<string[]>([]);
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjSubmitMsg, setAdjSubmitMsg] = useState<string | null>(null);

  // --- Form "Catat retur" (tab Riwayat keluar-masuk, 10 Sep Fable) ---
  const [retProductId, setRetProductId] = useState('');
  const [retDirection, setRetDirection] = useState<ReturnDirectionValue | ''>('');
  const [retQty, setRetQty] = useState<number | ''>('');
  const [retReason, setRetReason] = useState('');
  const [retFormErrors, setRetFormErrors] = useState<string[]>([]);
  const [retSubmitting, setRetSubmitting] = useState(false);
  const [retSubmitMsg, setRetSubmitMsg] = useState<string | null>(null);

  // --- Field kemasan & pemasok di form "Tambah produk" (10 Sep Fable) ---
  const [prodPackSize, setProdPackSize] = useState<number | ''>('');
  const [prodPackUnit, setProdPackUnit] = useState('');
  const [prodSupplierName, setProdSupplierName] = useState('');

  // --- "Foto jadi stok" (tab Produk & stok, 10 Sep Fable) ---
  const [showPhotoPanel, setShowPhotoPanel] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [photoModelUsed, setPhotoModelUsed] = useState<string | null>(null);
  const [photoCandidates, setPhotoCandidates] = useState<PhotoStockDraftRow[]>([]);
  const [photoCommitting, setPhotoCommitting] = useState(false);
  const [photoCommitError, setPhotoCommitError] = useState<string | null>(null);
  const [photoCommitMsg, setPhotoCommitMsg] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // --- Tombol "Ubah" per produk (PATCH, 10 Sep Fable) ---
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCostPrice, setEditCostPrice] = useState<number | ''>('');
  const [editSellPrice, setEditSellPrice] = useState<number | ''>('');
  const [editMinStock, setEditMinStock] = useState<number | ''>('');
  const [editPackSize, setEditPackSize] = useState<number | ''>('');
  const [editPackUnit, setEditPackUnit] = useState('');
  const [editSupplierName, setEditSupplierName] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [editFormErrors, setEditFormErrors] = useState<string[]>([]);
  const [editSkuError, setEditSkuError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  // --- Tab "Pelanggan" (10 Sep Fable) ---
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [customerLoadError, setCustomerLoadError] = useState<string | null>(null);
  const [customerFetched, setCustomerFetched] = useState(false);
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custArea, setCustArea] = useState('');
  const [custType, setCustType] = useState('WARUNG');
  const [custNotes, setCustNotes] = useState('');
  const [custFormErrors, setCustFormErrors] = useState<string[]>([]);
  const [custSubmitting, setCustSubmitting] = useState(false);
  const [custSubmitMsg, setCustSubmitMsg] = useState<string | null>(null);

  // --- Select "Pelanggan (opsional)" di form Catat penjualan (10 Sep Fable) ---
  const [saleCustomerId, setSaleCustomerId] = useState('');

  // --- Tab "Kadaluarsa" (10 Sep Fable) ---
  const [batches, setBatches] = useState<ProductBatchRow[]>([]);
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [batchLoadError, setBatchLoadError] = useState<string | null>(null);
  const [batchFetched, setBatchFetched] = useState(false);
  const [batchProductId, setBatchProductId] = useState('');
  const [batchExpiryDate, setBatchExpiryDate] = useState('');
  const [batchQty, setBatchQty] = useState<number | ''>('');
  const [batchCode, setBatchCode] = useState('');
  const [batchFormErrors, setBatchFormErrors] = useState<string[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchSubmitMsg, setBatchSubmitMsg] = useState<string | null>(null);

  // --- Fetch produk & ringkasan ---
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    setProductLoadError(null);
    try {
      const params = new URLSearchParams({ page: '1', limit: '50' });
      if (productQuery.trim()) params.set('q', productQuery.trim());
      const res = await fetch(`/api/v1/inventory/products?${params.toString()}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat data produk.');
      setProducts(data.products || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      setProductLoadError(err.message || 'Gagal memuat data produk.');
    } finally {
      setLoadingProducts(false);
    }
  }, [productQuery]);

  const fetchMovements = useCallback(async () => {
    setLoadingMovements(true);
    setMovementLoadError(null);
    try {
      const res = await fetch('/api/v1/inventory/stock-movements?page=1&limit=50', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat riwayat keluar-masuk stok.');
      setMovements(data.movements || []);
    } catch (err: any) {
      setMovementLoadError(err.message || 'Gagal memuat riwayat keluar-masuk stok.');
    } finally {
      setLoadingMovements(false);
      setMovementFetched(true);
    }
  }, []);

  const fetchPurchaseOrders = useCallback(async () => {
    setLoadingPO(true);
    setPoLoadError(null);
    try {
      const res = await fetch('/api/v1/inventory/purchase-orders?page=1&limit=20', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat pesanan pembelian.');
      setPurchaseOrders(data.purchaseOrders || []);
    } catch (err: any) {
      setPoLoadError(err.message || 'Gagal memuat pesanan pembelian.');
    } finally {
      setLoadingPO(false);
      setPoFetched(true);
    }
  }, []);

  const fetchSupplierScores = useCallback(async () => {
    setLoadingScores(true);
    setScoreLoadError(null);
    try {
      const res = await fetch('/api/v1/inventory/supplier-score', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat skor pemasok.');
      setSupplierScores(data.supplierScores || []);
    } catch (err: any) {
      setScoreLoadError(err.message || 'Gagal memuat skor pemasok.');
    } finally {
      setLoadingScores(false);
      setScoreFetched(true);
    }
  }, []);

  const fetchConsignmentReport = useCallback(async () => {
    setLoadingConsignment(true);
    setConsignmentLoadError(null);
    try {
      const params = new URLSearchParams();
      if (consignmentFrom) params.set('from', consignmentFrom);
      if (consignmentTo) params.set('to', consignmentTo);
      const qs = params.toString();
      const res = await fetch(`/api/v1/inventory/consignment/report${qs ? `?${qs}` : ''}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat laporan konsinyasi.');
      setConsignmentRows(data.rows || []);
      setConsignmentTotals(data.totals || null);
    } catch (err: any) {
      setConsignmentLoadError(err.message || 'Gagal memuat laporan konsinyasi.');
    } finally {
      setLoadingConsignment(false);
      setConsignmentFetched(true);
    }
  }, [consignmentFrom, consignmentTo]);

  // --- Fetch pelanggan (tab Pelanggan + select di form Catat penjualan, 10 Sep Fable) ---
  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    setCustomerLoadError(null);
    try {
      const res = await fetch('/api/v1/inventory/customers?page=1&limit=100', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat data pelanggan.');
      setCustomers(data.customers || []);
    } catch (err: any) {
      setCustomerLoadError(err.message || 'Gagal memuat data pelanggan.');
    } finally {
      setLoadingCustomers(false);
      setCustomerFetched(true);
    }
  }, []);

  // --- Fetch batch kadaluarsa (tab Kadaluarsa, 10 Sep Fable) ---
  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    setBatchLoadError(null);
    try {
      const res = await fetch('/api/v1/inventory/product-batches?expiringWithinDays=30', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal memuat data kadaluarsa.');
      setBatches(data.batches || []);
      setExpiringSoonCount(typeof data.expiringSoon === 'number' ? data.expiringSoon : (data.batches || []).length);
    } catch (err: any) {
      setBatchLoadError(err.message || 'Gagal memuat data kadaluarsa.');
    } finally {
      setLoadingBatches(false);
      setBatchFetched(true);
    }
  }, []);

  // Muat data awal tab aktif (produk selalu dimuat duluan karena tab default) --
  // tab lain dimuat lazy saat pertama kali diklik (hindari 4 request paralel di
  // awal kalau usernya cuma mau lihat 1 tab, konsisten pola tab-lazy KlirWorkspaceView).
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (tab === 'riwayat' && !movementFetched) fetchMovements();
    if (tab === 'riwayat' && !customerFetched) fetchCustomers(); // select "Pelanggan (opsional)" butuh daftar ini
    if (tab === 'pembelian' && !poFetched) fetchPurchaseOrders();
    if (tab === 'pemasok' && !scoreFetched) fetchSupplierScores();
    if (tab === 'konsinyasi' && !consignmentFetched) fetchConsignmentReport();
    if (tab === 'pelanggan' && !customerFetched) fetchCustomers();
    if (tab === 'kadaluarsa' && !batchFetched) fetchBatches();
  }, [tab, movementFetched, poFetched, scoreFetched, consignmentFetched, customerFetched, batchFetched, fetchMovements, fetchPurchaseOrders, fetchSupplierScores, fetchConsignmentReport, fetchCustomers, fetchBatches]);

  // Refresh kalau ada perubahan data dari tempat lain (pola sama KlirScheduleView.tsx)
  useEffect(() => {
    const handler = () => {
      fetchProducts();
      if (movementFetched) fetchMovements();
      if (poFetched) fetchPurchaseOrders();
      if (consignmentFetched) fetchConsignmentReport();
      if (customerFetched) fetchCustomers();
      if (batchFetched) fetchBatches();
    };
    window.addEventListener('klir-inventory-updated', handler);
    return () => window.removeEventListener('klir-inventory-updated', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProducts, fetchMovements, fetchPurchaseOrders, fetchConsignmentReport, fetchCustomers, fetchBatches, movementFetched, poFetched, consignmentFetched, customerFetched, batchFetched]);

  // --- Submit produk baru ---
  const submitProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateProductForm({ name: prodName, costPrice: prodCostPrice, sellPrice: prodSellPrice, minStock: prodMinStock, openingStock: prodOpeningStock });
    setProdFormErrors(errors);
    setProdSubmitMsg(null);
    if (errors.length > 0) return;

    setProdSubmitting(true);
    try {
      const res = await fetch('/api/v1/inventory/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: prodName,
          sku: prodSku || undefined,
          category: prodCategory || undefined,
          unit: prodUnit || 'pcs',
          costPrice: prodCostPrice === '' ? 0 : Number(prodCostPrice),
          sellPrice: prodSellPrice === '' ? 0 : Number(prodSellPrice),
          minStock: prodMinStock === '' ? 0 : Number(prodMinStock),
          openingStock: prodOpeningStock === '' ? 0 : Number(prodOpeningStock),
          // 10 Sep 2026 (Fable) -- kemasan & pemasok, dikirim hanya kalau diisi
          // (opsional di kontrak POST products/route.ts agent inventory-api-schema).
          packSize: prodPackSize === '' ? undefined : Number(prodPackSize),
          packUnit: prodPackUnit.trim() || undefined,
          supplierName: prodSupplierName.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const mapped = mapProductSubmitError(res.status, data.message);
        if (mapped.field === 'sku') {
          setProdSkuError(mapped.text);
          skuInputRef.current?.focus();
          return;
        }
        throw new Error(mapped.text);
      }

      setProdSkuError(null);
      setProdSubmitMsg(`Produk "${prodName}" berhasil ditambahkan.`);
      setProdName(''); setProdSku(''); setProdCategory(''); setProdUnit('pcs');
      setProdCostPrice(''); setProdSellPrice(''); setProdMinStock(''); setProdOpeningStock('');
      setProdPackSize(''); setProdPackUnit(''); setProdSupplierName('');
      await fetchProducts();
      window.dispatchEvent(new Event('klir-inventory-updated'));
    } catch (err: any) {
      setProdFormErrors([err.message || 'Gagal menambah produk.']);
    } finally {
      setProdSubmitting(false);
    }
  };

  // --- Konsinyasi: toggle status kepemilikan (PATCH endpoint yang SUDAH ADA) ---
  // Ini reklasifikasi murni (OWNED <-> CONSIGNED), TIDAK ada CashTransaction yang
  // ditulis (lihat komentar consignment/route.ts baris 14-16) -- jadi HANYA
  // dispatch 'klir-inventory-updated', bukan 'klir-kas-updated'.
  const toggleOwnership = async (productId: string, ownershipType: 'OWNED' | 'CONSIGNED') => {
    setConsignmentTogglingId(productId);
    setConsignmentActionError(null);
    setConsignmentActionMsg(null);
    try {
      const res = await fetch('/api/v1/inventory/consignment', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, ownershipType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengubah status konsinyasi.');
      setConsignmentActionMsg(data.message || 'Status kepemilikan berhasil diubah.');
      setAddConsignProductId('');
      await fetchConsignmentReport();
      await fetchProducts();
      window.dispatchEvent(new Event('klir-inventory-updated'));
    } catch (err: any) {
      setConsignmentActionError(err.message || 'Gagal mengubah status konsinyasi.');
    } finally {
      setConsignmentTogglingId(null);
    }
  };

  // --- Form "Catat pembelian" ---
  const addPoItemRow = () => setPoItems((prev) => [...prev, { productId: '', qty: '', unitCost: '' }]);
  const removePoItemRow = (idx: number) => setPoItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  const updatePoItem = (idx: number, patch: Partial<PurchaseItemFormInput>) =>
    setPoItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const submitPurchaseOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validatePurchaseOrderForm({ supplierName: poSupplierName, items: poItems });
    setPoFormErrors(errors);
    setPoSubmitMsg(null);
    if (errors.length > 0) return;

    setPoSubmitting(true);
    try {
      const res = await fetch('/api/v1/inventory/purchase-orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: poSupplierName,
          supplierPhone: poSupplierPhone || undefined,
          paymentMethod: poPaymentMethod || 'TUNAI',
          notes: poNotes || undefined,
          items: poItems.map((it) => ({ productId: it.productId, qty: Number(it.qty), unitCost: Number(it.unitCost) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mencatat pembelian.');

      setPoSubmitMsg(data.message || 'Pembelian berhasil dicatat.');
      setPoSupplierName(''); setPoSupplierPhone(''); setPoPaymentMethod('TUNAI'); setPoNotes('');
      setPoItems([{ productId: '', qty: '', unitCost: '' }]);
      await fetchPurchaseOrders();
      await fetchProducts();
      window.dispatchEvent(new Event('klir-inventory-updated'));
      window.dispatchEvent(new Event('klir-kas-updated'));
    } catch (err: any) {
      setPoFormErrors([err.message || 'Gagal mencatat pembelian.']);
    } finally {
      setPoSubmitting(false);
    }
  };

  // --- Form "Catat penjualan" ---
  const addSaleItemRow = () => setSaleItems((prev) => [...prev, { productId: '', qty: '', unitPrice: '' }]);
  const removeSaleItemRow = (idx: number) => setSaleItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  const updateSaleItem = (idx: number, patch: Partial<SaleItemFormInput>) =>
    setSaleItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const submitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateSaleForm(saleItems);
    setSaleFormErrors(errors);
    setSaleSubmitMsg(null);
    if (errors.length > 0) return;

    setSaleSubmitting(true);
    try {
      const res = await fetch('/api/v1/inventory/sales', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: saleItems.map((it) => ({ productId: it.productId, qty: Number(it.qty), unitPrice: it.unitPrice === '' ? 0 : Number(it.unitPrice) })),
          paymentMethod: salePaymentMethod || 'TUNAI',
          customerName: saleCustomerName || undefined,
          // 10 Sep 2026 (Fable) -- pelanggan terstruktur (kontrak agent
          // inventory-api-schema: customerId opsional, divalidasi milik workspace
          // di server). Independen dari customerName di atas (teks bebas untuk
          // pembeli lewat/tidak terdaftar, lihat komentar scan-kebutuhan-data 3.3).
          customerId: saleCustomerId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mencatat penjualan.');

      setSaleSubmitMsg(data.message || 'Penjualan berhasil dicatat.');
      setSaleItems([{ productId: '', qty: '', unitPrice: '' }]);
      setSaleCustomerName(''); setSalePaymentMethod('TUNAI'); setSaleCustomerId('');
      await fetchMovements();
      await fetchProducts();
      window.dispatchEvent(new Event('klir-inventory-updated'));
      window.dispatchEvent(new Event('klir-kas-updated'));
    } catch (err: any) {
      setSaleFormErrors([err.message || 'Gagal mencatat penjualan.']);
    } finally {
      setSaleSubmitting(false);
    }
  };

  // --- Form "Penyesuaian stok" ---
  const submitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateAdjustmentForm({ productId: adjProductId, qtyChange: adjQtyChange, reason: adjReason });
    setAdjFormErrors(errors);
    setAdjSubmitMsg(null);
    if (errors.length > 0) return;

    setAdjSubmitting(true);
    try {
      const res = await fetch('/api/v1/inventory/stock-adjustments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjProductId,
          qtyChange: Number(adjQtyChange),
          reason: adjReason,
          note: adjNote || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mencatat penyesuaian stok.');

      setAdjSubmitMsg(`Stok "${data.product?.name || ''}" berhasil disesuaikan.`.trim());
      setAdjProductId(''); setAdjQtyChange(''); setAdjReason(''); setAdjNote('');
      await fetchMovements();
      await fetchProducts();
      window.dispatchEvent(new Event('klir-inventory-updated'));
    } catch (err: any) {
      setAdjFormErrors([err.message || 'Gagal mencatat penyesuaian stok.']);
    } finally {
      setAdjSubmitting(false);
    }
  };

  // --- Form "Catat retur" (10 Sep Fable) ---
  const submitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateReturnForm({ productId: retProductId, direction: retDirection, qty: retQty, reason: retReason });
    setRetFormErrors(errors);
    setRetSubmitMsg(null);
    if (errors.length > 0) return;

    setRetSubmitting(true);
    try {
      const res = await fetch('/api/v1/inventory/returns', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: retProductId,
          direction: retDirection,
          qty: Number(retQty),
          reason: retReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mencatat retur.');

      setRetSubmitMsg(data.message || 'Retur berhasil dicatat.');
      setRetProductId(''); setRetDirection(''); setRetQty(''); setRetReason('');
      await fetchMovements();
      await fetchProducts();
      window.dispatchEvent(new Event('klir-inventory-updated'));
    } catch (err: any) {
      setRetFormErrors([err.message || 'Gagal mencatat retur.']);
    } finally {
      setRetSubmitting(false);
    }
  };

  // --- "Foto jadi stok" (10 Sep Fable) ---
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoFile(e.target.files?.[0] || null);
    setPhotoUploadError(null);
    setPhotoCandidates([]);
    setPhotoCommitMsg(null);
    setPhotoCommitError(null);
  };

  const submitPhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) {
      setPhotoUploadError('Pilih foto buku catatan stok dulu.');
      return;
    }
    setPhotoUploading(true);
    setPhotoUploadError(null);
    setPhotoCommitMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', photoFile);
      const res = await fetch('/api/v1/inventory/photo-to-stock', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Gagal membaca foto.');

      const rows: PhotoStockDraftRow[] = (data.candidates || []).map((c: any) => ({
        name: c.name,
        qty: c.qty ?? null,
        unit: c.unit ?? null,
        note: c.note ?? null,
        matchStatus: c.matchStatus,
        matchedProductId: c.matchedProductId ?? null,
        matchedProductName: c.matchedProductName ?? null,
        ambiguousCandidates: c.ambiguousCandidates,
        selectedProductId: c.matchedProductId || '',
        qtyChange: typeof c.qty === 'number' ? c.qty : '',
        included: Boolean(c.matchedProductId),
      }));
      setPhotoCandidates(rows);
      setPhotoModelUsed(data.modelUsed || null);
      if (rows.length === 0) {
        setPhotoCommitMsg(data.message || 'Tidak ada barang terdeteksi di foto ini.');
      }
    } catch (err: any) {
      setPhotoUploadError(err.message || 'Gagal membaca foto.');
    } finally {
      setPhotoUploading(false);
    }
  };

  const updatePhotoCandidate = (idx: number, patch: Partial<PhotoStockDraftRow>) =>
    setPhotoCandidates((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));

  const submitPhotoCommit = async () => {
    const itemsToCommit = photoCandidates
      .filter((row) => row.included && row.selectedProductId && row.qtyChange !== '' && Number(row.qtyChange) !== 0)
      .map((row) => ({ productId: row.selectedProductId, qtyChange: Number(row.qtyChange) }));

    const skippedRows = photoCandidates.filter(
      (row) => row.included && (!row.selectedProductId || row.qtyChange === '' || !Number.isFinite(Number(row.qtyChange)) || Number(row.qtyChange) === 0)
    );
    const unmatchedRows = photoCandidates.filter((row) => !row.included && row.name);

    if (itemsToCommit.length === 0) {
      setPhotoCommitError(
        skippedRows.length || unmatchedRows.length
          ? `${skippedRows.length + unmatchedRows.length} baris belum dikirim karena produk belum dipilih atau qty tidak valid. Periksa setiap baris sebelum menyimpan.`
          : 'Belum ada baris yang siap disimpan -- pastikan produk dipilih dan qty tidak nol untuk minimal 1 baris.'
      );
      return;
    }
    setPhotoCommitting(true);
    setPhotoCommitError(null);
    try {
      const res = await fetch('/api/v1/inventory/photo-to-stock', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsToCommit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan hasil foto ke stok.');

      setPhotoCommitMsg(
        `${data.message || 'Stok berhasil diperbarui dari foto.'}${skippedRows.length || unmatchedRows.length ? ` ${skippedRows.length + unmatchedRows.length} baris tidak ikut disimpan dan tetap perlu ditinjau.` : ''}`
      );
      setPhotoCandidates([]);
      setPhotoFile(null);
      if (photoInputRef.current) photoInputRef.current.value = '';
      await fetchProducts();
      window.dispatchEvent(new Event('klir-inventory-updated'));
    } catch (err: any) {
      setPhotoCommitError(err.message || 'Gagal menyimpan hasil foto ke stok.');
    } finally {
      setPhotoCommitting(false);
    }
  };

  // --- Tombol "Ubah" per produk (PATCH, 10 Sep Fable) ---
  const startEditProduct = (p: InventoryProductRow) => {
    setEditingProductId(p.id);
    setEditName(p.name);
    setEditCategory(p.category || '');
    setEditUnit(p.unit || 'pcs');
    setEditCostPrice(p.costPrice);
    setEditSellPrice(p.sellPrice);
    setEditMinStock(p.minStock);
    setEditPackSize(p.packSize ?? '');
    setEditPackUnit(p.packUnit || '');
    setEditSupplierName(p.supplierName || '');
    setEditIsActive(p.isActive);
    setEditFormErrors([]);
    setEditSkuError(null);
  };

  const cancelEditProduct = () => {
    setEditingProductId(null);
    setEditFormErrors([]);
    setEditSkuError(null);
  };

  const submitProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProductId) return;
    const errors = validateProductEditForm({ name: editName, costPrice: editCostPrice, sellPrice: editSellPrice, minStock: editMinStock });
    setEditFormErrors(errors);
    if (errors.length > 0) return;

    setEditSubmitting(true);
    setEditSkuError(null);
    try {
      const res = await fetch(`/api/v1/inventory/products/${editingProductId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          category: editCategory.trim() || undefined,
          unit: editUnit.trim() || undefined,
          costPrice: editCostPrice === '' ? undefined : Number(editCostPrice),
          sellPrice: editSellPrice === '' ? undefined : Number(editSellPrice),
          minStock: editMinStock === '' ? undefined : Number(editMinStock),
          packSize: editPackSize === '' ? undefined : Number(editPackSize),
          packUnit: editPackUnit.trim() || undefined,
          supplierName: editSupplierName.trim() || undefined,
          isActive: editIsActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setEditSkuError(data.message || 'SKU ini sudah dipakai produk lain di workspace ini.');
          return;
        }
        throw new Error(data.message || 'Gagal mengubah produk.');
      }

      setEditingProductId(null);
      await fetchProducts();
      window.dispatchEvent(new Event('klir-inventory-updated'));
    } catch (err: any) {
      setEditFormErrors([err.message || 'Gagal mengubah produk.']);
    } finally {
      setEditSubmitting(false);
    }
  };

  // --- Tab "Pelanggan" (10 Sep Fable) ---
  const submitCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateCustomerForm({ name: custName, phone: custPhone, address: custAddress, area: custArea, type: custType, notes: custNotes });
    setCustFormErrors(errors);
    setCustSubmitMsg(null);
    if (errors.length > 0) return;

    setCustSubmitting(true);
    try {
      const res = await fetch('/api/v1/inventory/customers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: custName,
          phone: custPhone.trim() || undefined,
          address: custAddress.trim() || undefined,
          area: custArea.trim() || undefined,
          type: custType || undefined,
          notes: custNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal menambah pelanggan.');

      setCustSubmitMsg(`Pelanggan "${custName}" berhasil ditambahkan.`);
      setCustName(''); setCustPhone(''); setCustAddress(''); setCustArea(''); setCustType('WARUNG'); setCustNotes('');
      await fetchCustomers();
    } catch (err: any) {
      setCustFormErrors([err.message || 'Gagal menambah pelanggan.']);
    } finally {
      setCustSubmitting(false);
    }
  };

  // --- Tab "Kadaluarsa" (10 Sep Fable) ---
  const submitBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateBatchForm({ productId: batchProductId, expiryDate: batchExpiryDate, qty: batchQty, batchCode });
    setBatchFormErrors(errors);
    setBatchSubmitMsg(null);
    if (errors.length > 0) return;

    setBatchSubmitting(true);
    try {
      const res = await fetch('/api/v1/inventory/product-batches', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: batchProductId,
          expiryDate: batchExpiryDate,
          qty: Number(batchQty),
          batchCode: batchCode.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mencatat batch.');

      setBatchSubmitMsg(data.message || 'Batch berhasil dicatat.');
      setBatchProductId(''); setBatchExpiryDate(''); setBatchQty(''); setBatchCode('');
      await fetchBatches();
    } catch (err: any) {
      setBatchFormErrors([err.message || 'Gagal mencatat batch.']);
    } finally {
      setBatchSubmitting(false);
    }
  };

  const displaySummary = summary || summarizeProducts(products);
  const nonConsignedActiveProducts = products.filter((p) => p.isActive && p.ownershipType !== 'CONSIGNED');
  const saleTotalPreview = buildSaleTotal(saleItems);
  const poTotalPreview = buildPurchaseOrderTotal(poItems);

  // Manager Operasional mendapatkan surface Inventory read-only pada fase ini.
  // Form tambah/edit produk, pembelian, penjualan, retur, batch, dan konsinyasi
  // tetap dipakai CEO/Finance; role baru tidak boleh membuka write flow hanya
  // karena tombol navigasinya sudah tersambung.
  if (isReadOnly) {
    return (
      <div data-testid="inventory-read-only" style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: 600, color: '#F5F7FA' }}>Stok &amp; Pembelian</h2>
            <span style={{ fontSize: '11.5px', color: '#7C8698' }}>Mode baca saja untuk Manager Operasional. Tidak ada perubahan inventory dari surface ini.</span>
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', color: '#3FBF8F', background: 'rgba(63,191,143,0.12)', border: '1px solid rgba(63,191,143,0.28)', fontSize: '10.5px', fontWeight: 700 }}>Read-only</span>
        </div>
        {loadingProducts && <EmptyState text="Memuat ringkasan inventory..." />}
        {!loadingProducts && productLoadError && <ErrorList errors={[productLoadError]} />}
        {!loadingProducts && !productLoadError && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px' }}>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Jumlah produk</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: '#F5F7FA' }}>{displaySummary.productCount}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Nilai stok</span>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#F5F7FA', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupiahStok(displaySummary.stockValue)}</span>
              </div>
              <div style={CARD_STYLE}>
                <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Di bawah minimum</span>
                <span style={{ fontSize: '17px', fontWeight: 700, color: displaySummary.lowStockCount > 0 ? '#EF4444' : '#3FBF8F' }}>{displaySummary.lowStockCount}</span>
              </div>
            </div>
            {products.length === 0 ? <EmptyState text="Belum ada produk tercatat pada workspace ini." /> : <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(16,20,28,0.86)' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '680px' }}><thead><tr>{['Nama', 'SKU', 'Satuan', 'Stok', 'Minimum', 'Status'].map((label) => <th key={label} style={{ padding: '11px 12px', textAlign: 'left', color: '#8A93A3', fontSize: '10px', fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>{label}</th>)}</tr></thead><tbody>{products.map((product) => { const low = product.currentStock <= product.minStock; return <tr key={product.id}><td style={TABLE_TD}>{product.name}</td><td style={TABLE_TD}>{product.sku || '—'}</td><td style={TABLE_TD}>{product.unit}</td><td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatQtyStok(product.currentStock)}</td><td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatQtyStok(product.minStock)}</td><td style={TABLE_TD}><StatusBadge label={low ? 'Perlu ditinjau' : 'Aman'} color={low ? '#EF4444' : '#3FBF8F'} /></td></tr>; })}</tbody></table></div>}
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '1600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '17px', fontWeight: 600, color: '#F5F7FA' }}>
            Stok &amp; Pembelian
          </h2>
          <span style={{ fontSize: '11.5px', color: '#7C8698' }}>Kelola produk, catat pembelian, pantau stok minimum, dan lihat riwayat keluar-masuk barang</span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setTab('produk')} style={TAB_BTN(tab === 'produk')}>
            <Boxes size={13} /> Produk &amp; stok
          </button>
          <button type="button" onClick={() => setTab('riwayat')} style={TAB_BTN(tab === 'riwayat')}>
            <History size={13} /> Riwayat keluar-masuk
          </button>
          <button type="button" onClick={() => setTab('pembelian')} style={TAB_BTN(tab === 'pembelian')}>
            <ShoppingCart size={13} /> Pesanan pembelian
          </button>
          <button type="button" onClick={() => setTab('pemasok')} style={TAB_BTN(tab === 'pemasok')}>
            <Star size={13} /> Skor pemasok
          </button>
          <button type="button" onClick={() => setTab('konsinyasi')} style={TAB_BTN(tab === 'konsinyasi')}>
            <Handshake size={13} /> Konsinyasi
          </button>
          <button type="button" onClick={() => setTab('pelanggan')} style={TAB_BTN(tab === 'pelanggan')}>
            <Users size={13} /> Pelanggan
          </button>
          <button type="button" onClick={() => setTab('kadaluarsa')} style={TAB_BTN(tab === 'kadaluarsa')}>
            <CalendarClock size={13} /> Kadaluarsa
          </button>
        </div>
      </div>

      {/* ---------------- RINGKASAN ATAS ---------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px' }}>
        <div style={CARD_STYLE}>
          <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Jumlah produk</span>
          <span style={{ fontSize: '17px', fontWeight: 700, color: '#F5F7FA' }}>{displaySummary.productCount}</span>
        </div>
        <div style={CARD_STYLE}>
          <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Nilai stok</span>
          <span style={{ fontSize: '15px', fontWeight: 700, color: '#F5F7FA', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupiahStok(displaySummary.stockValue)}</span>
        </div>
        <div style={CARD_STYLE}>
          <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Produk di bawah minimum</span>
          <span style={{ fontSize: '17px', fontWeight: 700, color: displaySummary.lowStockCount > 0 ? '#EF4444' : '#3FBF8F' }}>{displaySummary.lowStockCount}</span>
        </div>
      </div>

      {/* ---------------- TAB: PRODUK & STOK ---------------- */}
      {tab === 'produk' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '16px' }}>
          <form onSubmit={submitProduct} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Tambah produk</h4>
            <div>
              <label style={LABEL_STYLE}>Nama produk</label>
              <input style={INPUT_STYLE} type="text" value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="mis. Kopi Susu Sachet 20g" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>SKU (opsional)</label>
                <input
                  ref={skuInputRef}
                  style={{ ...INPUT_STYLE, ...(prodSkuError ? { boxShadow: 'inset 0 0 0 1px rgba(239,68,68,0.7)' } : {}) }}
                  type="text"
                  value={prodSku}
                  onChange={(e) => { setProdSku(e.target.value); if (prodSkuError) setProdSkuError(null); }}
                  placeholder="KODE-001"
                  aria-invalid={prodSkuError ? true : undefined}
                />
                {prodSkuError && <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#EF4444' }}>{prodSkuError}</span>}
              </div>
              <div>
                <label style={LABEL_STYLE}>Satuan</label>
                <input style={INPUT_STYLE} type="text" value={prodUnit} onChange={(e) => setProdUnit(e.target.value)} placeholder="pcs" />
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>Kategori (opsional)</label>
              <input style={INPUT_STYLE} type="text" value={prodCategory} onChange={(e) => setProdCategory(e.target.value)} placeholder="mis. Minuman" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Harga beli (Rp)</label>
                <input style={INPUT_STYLE} type="number" min={0} value={prodCostPrice} onChange={(e) => setProdCostPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Harga jual (Rp)</label>
                <input style={INPUT_STYLE} type="number" min={0} value={prodSellPrice} onChange={(e) => setProdSellPrice(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Stok minimum</label>
                <input style={INPUT_STYLE} type="number" min={0} value={prodMinStock} onChange={(e) => setProdMinStock(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Stok awal</label>
                <input style={INPUT_STYLE} type="number" min={0} value={prodOpeningStock} onChange={(e) => setProdOpeningStock(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
            </div>
            {/* 10 Sep 2026 (Fable) -- kemasan & pemasok, semua opsional */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Isi per kemasan (mis. 1 dus = 30 pcs)</label>
                <input style={INPUT_STYLE} type="number" min={0} value={prodPackSize} onChange={(e) => setProdPackSize(e.target.value === '' ? '' : Number(e.target.value))} placeholder="30" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Nama kemasan</label>
                <input style={INPUT_STYLE} type="text" value={prodPackUnit} onChange={(e) => setProdPackUnit(e.target.value)} placeholder="mis. dus" />
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>Pemasok (opsional)</label>
              <input style={INPUT_STYLE} type="text" value={prodSupplierName} onChange={(e) => setProdSupplierName(e.target.value)} placeholder="mis. Toko Grosir Makmur" />
            </div>
            <ErrorList errors={prodFormErrors} />
            {prodSubmitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{prodSubmitMsg}</span>}
            <button type="submit" disabled={prodSubmitting} style={{ ...SUBMIT_BTN('#3FBF8F'), opacity: prodSubmitting ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={14} /> {prodSubmitting ? 'Menyimpan...' : 'Tambah produk'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                style={{ ...INPUT_STYLE, maxWidth: '260px' }}
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') fetchProducts(); }}
                placeholder="Cari nama/SKU produk..."
              />
              <button type="button" onClick={fetchProducts} style={{ ...TAB_BTN(false), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}>
                <RefreshCw size={12} /> Cari
              </button>
              <button
                type="button"
                onClick={() => setShowPhotoPanel((v) => !v)}
                style={{ ...TAB_BTN(showPhotoPanel), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', marginLeft: 'auto' }}
              >
                <Camera size={12} /> Foto jadi stok
              </button>
            </div>

            {/* ---- Panel "Foto jadi stok" (10 Sep Fable) ---- */}
            {showPhotoPanel && (
              <div style={{ ...CARD_STYLE, gap: '10px' }}>
                <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Camera size={14} /> Foto buku catatan jadi stok
                </h4>
                <span style={{ fontSize: '11px', color: '#98A2B3' }}>
                  Foto halaman buku catatan stok manual, AI membaca isinya jadi draft. Draft BELUM tersimpan -- cek/edit tiap baris dulu sebelum diterapkan ke stok.
                </span>
                <form onSubmit={submitPhotoUpload} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoFileChange} style={{ fontSize: '11.5px', color: '#98A2B3' }} />
                  <button type="submit" disabled={photoUploading || !photoFile} style={{ ...SUBMIT_BTN('#3FBF8F'), width: 'auto', padding: '0 14px', opacity: photoUploading || !photoFile ? 0.6 : 1 }}>
                    {photoUploading ? 'Membaca foto...' : 'Baca foto'}
                  </button>
                </form>
                {photoUploadError && <ErrorList errors={[photoUploadError]} />}

                {photoCandidates.length > 0 && (
                  <>
                    <span style={{ fontSize: '10.5px', color: '#7C8698' }}>
                      {photoCandidates.length} baris terdeteksi{photoModelUsed ? ` (model: ${photoModelUsed})` : ''}. Baris "Tidak cocok" atau "Ambigu" wajib pilih produk manual dulu sebelum bisa diterapkan.
                    </span>
                    <div style={{ overflowX: 'auto', borderRadius: '12px', background: '#10141C', boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={TABLE_TH}></th>
                            <th style={TABLE_TH}>Terbaca dari foto</th>
                            <th style={TABLE_TH}>Cocokkan ke produk</th>
                            <th style={TABLE_TH}>Qty ditambah/kurangi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {photoCandidates.map((row, idx) => {
                            const options = row.matchStatus === 'ambiguous' && row.ambiguousCandidates
                              ? row.ambiguousCandidates
                              : products.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name }));
                            return (
                              <tr key={idx}>
                                <td style={TABLE_TD}>
                                  <input type="checkbox" checked={row.included} onChange={(e) => updatePhotoCandidate(idx, { included: e.target.checked })} />
                                </td>
                                <td style={TABLE_TD}>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span>{row.name}{row.qty !== null ? ` -- ${formatQtyStok(row.qty)} ${row.unit || ''}` : ''}</span>
                                    {row.note && <span style={{ fontSize: '10.5px', color: '#D8A33C' }}>{row.note}</span>}
                                    {row.matchStatus === 'unmatched' && <span style={{ fontSize: '10.5px', color: '#EF4444' }}>Tidak cocok dengan produk manapun -- pilih manual</span>}
                                    {row.matchStatus === 'ambiguous' && <span style={{ fontSize: '10.5px', color: '#D8A33C' }}>Ambigu, cocok dengan beberapa produk -- pilih salah satu</span>}
                                  </div>
                                </td>
                                <td style={TABLE_TD}>
                                  <select style={INPUT_STYLE} value={row.selectedProductId} onChange={(e) => updatePhotoCandidate(idx, { selectedProductId: e.target.value })}>
                                    <option value="">Pilih produk...</option>
                                    {options.map((o) => (
                                      <option key={o.id} value={o.id}>{o.name}</option>
                                    ))}
                                  </select>
                                </td>
                                <td style={TABLE_TD}>
                                  <input style={INPUT_STYLE} type="number" value={row.qtyChange} onChange={(e) => updatePhotoCandidate(idx, { qtyChange: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="0" />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {photoCommitError && <ErrorList errors={[photoCommitError]} />}
                    <button type="button" disabled={photoCommitting} onClick={submitPhotoCommit} style={{ ...SUBMIT_BTN('#3FBF8F'), width: 'auto', padding: '0 14px', opacity: photoCommitting ? 0.6 : 1, alignSelf: 'flex-start' }}>
                      {photoCommitting ? 'Menyimpan...' : 'Terapkan ke stok'}
                    </button>
                  </>
                )}
                {photoCommitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{photoCommitMsg}</span>}
              </div>
            )}

            {loadingProducts && <EmptyState text="Memuat data produk..." />}
            {!loadingProducts && productLoadError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ErrorList errors={[productLoadError]} />
                <button type="button" onClick={fetchProducts} style={{ ...TAB_BTN(false), alignSelf: 'flex-start', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}><RefreshCw size={12} /> Coba lagi</button>
              </div>
            )}
            {!loadingProducts && !productLoadError && products.length === 0 && (
              <EmptyState text="Belum ada produk tercatat. Tambahkan produk pertama lewat form di kiri." />
            )}

            {/* ---- Form "Ubah produk" inline (10 Sep Fable, PATCH) ---- */}
            {editingProductId && (
              <form onSubmit={submitProductEdit} style={{ ...CARD_STYLE, gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Pencil size={13} /> Ubah produk
                  </h4>
                  <button type="button" onClick={cancelEditProduct} style={{ height: '28px', width: '28px', borderRadius: '9px', border: 0, background: 'rgba(255,255,255,0.06)', color: '#98A2B3', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <X size={13} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={LABEL_STYLE}>Nama produk</label>
                    <input style={INPUT_STYLE} type="text" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Kategori</label>
                    <input style={INPUT_STYLE} type="text" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={LABEL_STYLE}>Satuan</label>
                    <input style={INPUT_STYLE} type="text" value={editUnit} onChange={(e) => setEditUnit(e.target.value)} />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Harga beli</label>
                    <input style={INPUT_STYLE} type="number" min={0} value={editCostPrice} onChange={(e) => setEditCostPrice(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Harga jual</label>
                    <input style={INPUT_STYLE} type="number" min={0} value={editSellPrice} onChange={(e) => setEditSellPrice(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={LABEL_STYLE}>Stok minimum</label>
                    <input style={INPUT_STYLE} type="number" min={0} value={editMinStock} onChange={(e) => setEditMinStock(e.target.value === '' ? '' : Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Isi per kemasan</label>
                    <input style={INPUT_STYLE} type="number" min={0} value={editPackSize} onChange={(e) => setEditPackSize(e.target.value === '' ? '' : Number(e.target.value))} placeholder="30" />
                  </div>
                  <div>
                    <label style={LABEL_STYLE}>Nama kemasan</label>
                    <input style={INPUT_STYLE} type="text" value={editPackUnit} onChange={(e) => setEditPackUnit(e.target.value)} placeholder="mis. dus" />
                  </div>
                </div>
                <div>
                  <label style={LABEL_STYLE}>Pemasok (opsional)</label>
                  <input style={INPUT_STYLE} type="text" value={editSupplierName} onChange={(e) => setEditSupplierName(e.target.value)} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', color: '#98A2B3' }}>
                  <input type="checkbox" checked={editIsActive} onChange={(e) => setEditIsActive(e.target.checked)} /> Produk aktif
                </label>
                {editSkuError && <ErrorList errors={[editSkuError]} />}
                <ErrorList errors={editFormErrors} />
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="submit" disabled={editSubmitting} style={{ ...SUBMIT_BTN('#3FBF8F'), width: 'auto', padding: '0 16px', opacity: editSubmitting ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Check size={13} /> {editSubmitting ? 'Menyimpan...' : 'Simpan perubahan'}
                  </button>
                  <button type="button" onClick={cancelEditProduct} style={{ ...TAB_BTN(false), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}>Batal</button>
                </div>
              </form>
            )}

            {!loadingProducts && !productLoadError && products.length > 0 && (
              <div style={{ overflowX: 'auto', borderRadius: '12px', background: '#10141C', boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TABLE_TH}>Nama</th>
                      <th style={TABLE_TH}>SKU</th>
                      <th style={TABLE_TH}>Satuan</th>
                      <th style={TABLE_TH}>Kemasan</th>
                      <th style={TABLE_TH}>Stok</th>
                      <th style={TABLE_TH}>Min</th>
                      <th style={TABLE_TH}>Harga beli</th>
                      <th style={TABLE_TH}>Harga jual</th>
                      <th style={TABLE_TH}></th>
                      <th style={TABLE_TH}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => {
                      const low = isLowStock(p);
                      const packLabel = formatPackLabel(p.packSize, p.packUnit, p.unit);
                      return (
                        <tr key={p.id}>
                          <td style={TABLE_TD}>{p.name}</td>
                          <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{p.sku || '-'}</td>
                          <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{p.unit}</td>
                          <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{packLabel || '-'}</td>
                          <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatQtyStok(p.currentStock)}</td>
                          <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace", color: '#98A2B3' }}>{formatQtyStok(p.minStock)}</td>
                          <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupiahStok(p.costPrice)}</td>
                          <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatRupiahStok(p.sellPrice)}</td>
                          <td style={TABLE_TD}>{low && <StatusBadge label="Di bawah minimum" color="#EF4444" />}</td>
                          <td style={TABLE_TD}>
                            <button type="button" onClick={() => startEditProduct(p)} style={{ ...TAB_BTN(false), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', fontSize: '10.5px', padding: '5px 9px' }}>
                              <Pencil size={11} /> Ubah
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB: RIWAYAT KELUAR-MASUK ---------------- */}
      {tab === 'riwayat' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loadingMovements && <EmptyState text="Memuat riwayat keluar-masuk stok..." />}
          {!loadingMovements && movementLoadError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ErrorList errors={[movementLoadError]} />
              <button type="button" onClick={fetchMovements} style={{ ...TAB_BTN(false), alignSelf: 'flex-start', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}><RefreshCw size={12} /> Coba lagi</button>
            </div>
          )}
          {!loadingMovements && !movementLoadError && movements.length === 0 && (
            <EmptyState text="Belum ada pergerakan stok tercatat. Riwayat akan muncul setelah ada pembelian, penjualan, atau penyesuaian stok." />
          )}
          {!loadingMovements && !movementLoadError && movements.length > 0 && (
            <div style={{ overflowX: 'auto', borderRadius: '12px', background: '#10141C', boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={TABLE_TH}>Tanggal</th>
                    <th style={TABLE_TH}>Produk</th>
                    <th style={TABLE_TH}>Tipe</th>
                    <th style={TABLE_TH}>Perubahan qty</th>
                    <th style={TABLE_TH}>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{new Date(m.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td style={TABLE_TD}>{m.product?.name || '-'}</td>
                      <td style={TABLE_TD}>{movementTypeLabel(m.type)}</td>
                      <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace", color: isMovementIn(m.type) ? '#3FBF8F' : '#EF4444' }}>
                        {isMovementIn(m.type) ? '+' : ''}{formatQtyStok(m.qtyChange)} {m.product?.unit || ''}
                      </td>
                      <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{m.note || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ---- Form "Catat penjualan" + "Penyesuaian stok" (10 Sep, Tingkat B) ---- */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: '16px', marginTop: '4px' }}>
            <form onSubmit={submitSale} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Wallet size={14} /> Catat penjualan
              </h4>
              {saleItems.map((item, idx) => {
                const selectedProduct = products.find((p) => p.id === item.productId);
                return (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,0.7fr) minmax(0,0.9fr) auto', gap: '8px', alignItems: 'end' }}>
                    <div>
                      {idx === 0 && <label style={LABEL_STYLE}>Produk</label>}
                      <select
                        style={INPUT_STYLE}
                        value={item.productId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          const p = products.find((pp) => pp.id === pid);
                          updateSaleItem(idx, { productId: pid, unitPrice: p ? p.sellPrice : item.unitPrice });
                        }}
                      >
                        <option value="">Pilih produk...</option>
                        {products.filter((p) => p.isActive).map((p) => (
                          <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      {idx === 0 && <label style={LABEL_STYLE}>Qty</label>}
                      <input style={INPUT_STYLE} type="number" min={0} value={item.qty} onChange={(e) => updateSaleItem(idx, { qty: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="0" />
                    </div>
                    <div>
                      {idx === 0 && <label style={LABEL_STYLE}>Harga jual</label>}
                      <input style={INPUT_STYLE} type="number" min={0} value={item.unitPrice} onChange={(e) => updateSaleItem(idx, { unitPrice: e.target.value === '' ? '' : Number(e.target.value) })} placeholder={selectedProduct ? String(selectedProduct.sellPrice) : '0'} />
                    </div>
                    <button type="button" onClick={() => removeSaleItemRow(idx)} disabled={saleItems.length <= 1} style={{ height: '36px', width: '36px', borderRadius: '9px', border: 0, background: 'rgba(239,68,68,0.12)', color: '#EF4444', cursor: saleItems.length <= 1 ? 'not-allowed' : 'pointer', opacity: saleItems.length <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
              <button type="button" onClick={addSaleItemRow} style={{ ...TAB_BTN(false), alignSelf: 'flex-start', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}>
                <Plus size={12} /> Tambah baris item
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={LABEL_STYLE}>Metode bayar</label>
                  <input style={INPUT_STYLE} type="text" value={salePaymentMethod} onChange={(e) => setSalePaymentMethod(e.target.value)} placeholder="TUNAI" />
                </div>
                <div>
                  <label style={LABEL_STYLE}>Nama pembeli (opsional)</label>
                  <input style={INPUT_STYLE} type="text" value={saleCustomerName} onChange={(e) => setSaleCustomerName(e.target.value)} placeholder="mis. Bu Rina" />
                </div>
              </div>
              {/* 10 Sep 2026 (Fable) -- pelanggan terstruktur, independen dari "Nama
                  pembeli" bebas teks di atas (lihat komentar submitSale). */}
              <div>
                <label style={LABEL_STYLE}>Pelanggan (opsional)</label>
                <select style={INPUT_STYLE} value={saleCustomerId} onChange={(e) => setSaleCustomerId(e.target.value)}>
                  <option value="">
                    {customers.length === 0 ? 'Belum ada pelanggan tercatat' : 'Tidak dikaitkan ke pelanggan'}
                  </option>
                  {customers.filter((c) => c.isActive).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.area ? ` -- ${c.area}` : ''}</option>
                  ))}
                </select>
              </div>
              <span style={{ fontSize: '11px', color: '#98A2B3' }}>Total: <strong style={{ color: '#F5F7FA', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupiahStok(saleTotalPreview)}</strong></span>
              <ErrorList errors={saleFormErrors} />
              {saleSubmitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{saleSubmitMsg}</span>}
              <button type="submit" disabled={saleSubmitting} style={{ ...SUBMIT_BTN('#3FBF8F'), opacity: saleSubmitting ? 0.6 : 1 }}>
                {saleSubmitting ? 'Menyimpan...' : 'Catat penjualan'}
              </button>
            </form>

            <form onSubmit={submitAdjustment} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <SlidersHorizontal size={14} /> Penyesuaian stok
              </h4>
              <div>
                <label style={LABEL_STYLE}>Produk</label>
                <select style={INPUT_STYLE} value={adjProductId} onChange={(e) => setAdjProductId(e.target.value)}>
                  <option value="">Pilih produk...</option>
                  {products.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''} -- stok {formatQtyStok(p.currentStock)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Jumlah penyesuaian (+ masuk / - keluar)</label>
                <input style={INPUT_STYLE} type="number" value={adjQtyChange} onChange={(e) => setAdjQtyChange(e.target.value === '' ? '' : Number(e.target.value))} placeholder="mis. -2 atau 5" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Alasan (wajib)</label>
                <input style={INPUT_STYLE} type="text" value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="mis. Rusak, hilang, koreksi hitung ulang" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Catatan (opsional)</label>
                <input style={INPUT_STYLE} type="text" value={adjNote} onChange={(e) => setAdjNote(e.target.value)} placeholder="opsional" />
              </div>
              <ErrorList errors={adjFormErrors} />
              {adjSubmitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{adjSubmitMsg}</span>}
              <button type="submit" disabled={adjSubmitting} style={{ ...SUBMIT_BTN('#D8A33C'), opacity: adjSubmitting ? 0.6 : 1 }}>
                {adjSubmitting ? 'Menyimpan...' : 'Simpan penyesuaian'}
              </button>
            </form>
          </div>

          {/* ---- Form "Catat retur" (10 Sep Fable) ---- */}
          <form onSubmit={submitReturn} style={{ ...CARD_STYLE, gap: '10px', maxWidth: '620px' }}>
            <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Undo2 size={14} /> Catat retur
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Produk</label>
                <select style={INPUT_STYLE} value={retProductId} onChange={(e) => setRetProductId(e.target.value)}>
                  <option value="">Pilih produk...</option>
                  {products.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Arah retur</label>
                <select style={INPUT_STYLE} value={retDirection} onChange={(e) => setRetDirection(e.target.value as ReturnDirectionValue | '')}>
                  <option value="">Pilih arah...</option>
                  <option value="TO_SUPPLIER">Ke supplier (barang keluar dari toko)</option>
                  <option value="FROM_CUSTOMER">Dari pelanggan (barang masuk lagi)</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Qty</label>
                <input style={INPUT_STYLE} type="number" min={0} value={retQty} onChange={(e) => setRetQty(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Alasan (opsional)</label>
                <input style={INPUT_STYLE} type="text" value={retReason} onChange={(e) => setRetReason(e.target.value)} placeholder="mis. Rusak, salah kirim, komplain" />
              </div>
            </div>
            <ErrorList errors={retFormErrors} />
            {retSubmitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{retSubmitMsg}</span>}
            <button type="submit" disabled={retSubmitting} style={{ ...SUBMIT_BTN('#D8A33C'), width: 'auto', padding: '0 16px', opacity: retSubmitting ? 0.6 : 1, alignSelf: 'flex-start' }}>
              {retSubmitting ? 'Menyimpan...' : 'Catat retur'}
            </button>
          </form>
        </div>
      )}

      {/* ---------------- TAB: PESANAN PEMBELIAN ---------------- */}
      {tab === 'pembelian' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '16px' }}>
          <form onSubmit={submitPurchaseOrder} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Catat pembelian</h4>
            <div>
              <label style={LABEL_STYLE}>Nama supplier</label>
              <input style={INPUT_STYLE} type="text" value={poSupplierName} onChange={(e) => setPoSupplierName(e.target.value)} placeholder="mis. Toko Grosir Makmur" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>No. HP supplier (opsional)</label>
                <input style={INPUT_STYLE} type="text" value={poSupplierPhone} onChange={(e) => setPoSupplierPhone(e.target.value)} placeholder="08xx" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Metode bayar</label>
                <input style={INPUT_STYLE} type="text" value={poPaymentMethod} onChange={(e) => setPoPaymentMethod(e.target.value)} placeholder="TUNAI" />
              </div>
            </div>

            <span style={{ fontSize: '11px', fontWeight: 600, color: '#98A2B3' }}>Item barang</span>
            {poItems.map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,0.7fr) minmax(0,0.9fr) auto', gap: '8px' }}>
                <select style={INPUT_STYLE} value={item.productId} onChange={(e) => updatePoItem(idx, { productId: e.target.value })}>
                  <option value="">Pilih produk...</option>
                  {products.filter((p) => p.isActive).map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                  ))}
                </select>
                <input style={INPUT_STYLE} type="number" min={0} value={item.qty} onChange={(e) => updatePoItem(idx, { qty: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Qty" />
                <input style={INPUT_STYLE} type="number" min={0} value={item.unitCost} onChange={(e) => updatePoItem(idx, { unitCost: e.target.value === '' ? '' : Number(e.target.value) })} placeholder="Harga beli" />
                <button type="button" onClick={() => removePoItemRow(idx)} disabled={poItems.length <= 1} style={{ height: '36px', width: '36px', borderRadius: '9px', border: 0, background: 'rgba(239,68,68,0.12)', color: '#EF4444', cursor: poItems.length <= 1 ? 'not-allowed' : 'pointer', opacity: poItems.length <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addPoItemRow} style={{ ...TAB_BTN(false), alignSelf: 'flex-start', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}>
              <Plus size={12} /> Tambah baris item
            </button>

            <div>
              <label style={LABEL_STYLE}>Catatan (opsional)</label>
              <input style={INPUT_STYLE} type="text" value={poNotes} onChange={(e) => setPoNotes(e.target.value)} placeholder="opsional" />
            </div>
            <span style={{ fontSize: '11px', color: '#98A2B3' }}>Total: <strong style={{ color: '#F5F7FA', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupiahStok(poTotalPreview)}</strong></span>
            <ErrorList errors={poFormErrors} />
            {poSubmitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{poSubmitMsg}</span>}
            <button type="submit" disabled={poSubmitting} style={{ ...SUBMIT_BTN('#3FBF8F'), opacity: poSubmitting ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={14} /> {poSubmitting ? 'Menyimpan...' : 'Catat pembelian'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loadingPO && <EmptyState text="Memuat pesanan pembelian..." />}
            {!loadingPO && poLoadError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ErrorList errors={[poLoadError]} />
                <button type="button" onClick={fetchPurchaseOrders} style={{ ...TAB_BTN(false), alignSelf: 'flex-start', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}><RefreshCw size={12} /> Coba lagi</button>
              </div>
            )}
            {!loadingPO && !poLoadError && purchaseOrders.length === 0 && (
              <EmptyState text="Belum ada pesanan pembelian tercatat. Catat pembelian pertama lewat form di kiri." />
            )}
            {!loadingPO && !poLoadError && purchaseOrders.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {purchaseOrders.map((po) => {
                  const meta = PO_STATUS_META[po.status];
                  return (
                    <div key={po.id} style={{ padding: '12px 14px', borderRadius: '10px', background: '#10141C', border: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.28)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{po.poNumber} &middot; {po.supplierName}</span>
                          <span style={{ fontSize: '10.5px', color: '#7C8698' }}>{new Date(po.purchaseDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} &middot; {po.items.length} item &middot; {po.paymentMethod}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <StatusBadge label={meta.label} color={meta.color} />
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', fontWeight: 700, color: '#F5F7FA' }}>{formatRupiahStok(po.totalAmount)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB: SKOR PEMASOK ---------------- */}
      {tab === 'pemasok' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {loadingScores && <EmptyState text="Memuat skor pemasok..." />}
          {!loadingScores && scoreLoadError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ErrorList errors={[scoreLoadError]} />
              <button type="button" onClick={fetchSupplierScores} style={{ ...TAB_BTN(false), alignSelf: 'flex-start', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}><RefreshCw size={12} /> Coba lagi</button>
            </div>
          )}
          {!loadingScores && !scoreLoadError && supplierScores.length === 0 && (
            <EmptyState text="Belum ada skor pemasok. Skor akan terhitung otomatis setelah ada pesanan pembelian tercatat." />
          )}
          {!loadingScores && !scoreLoadError && supplierScores.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
              {supplierScores.map((s) => (
                <div key={s.supplierName} style={CARD_STYLE}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#F5F7FA' }}>{s.supplierName}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', fontWeight: 700, color: supplierScoreColor(s.score) }}>{Math.round(s.score)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '10.5px', color: '#7C8698' }}>Stabilitas harga: {s.priceStability !== null ? `${Math.round(s.priceStability)}%` : 'Belum ada data'}</span>
                    <span style={{ fontSize: '10.5px', color: '#7C8698' }}>Tingkat retur/cacat: {s.defectRate !== null ? `${Math.round(s.defectRate)}%` : 'Belum ada data'}</span>
                    <span style={{ fontSize: '10.5px', color: '#7C8698' }}>Ketepatan waktu: {s.onTimeRate !== null ? `${Math.round(s.onTimeRate)}%` : 'Belum ada data'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------------- TAB: KONSINYASI (10 Sep, Tingkat B) ---------------- */}
      {tab === 'konsinyasi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'end' }}>
            <div>
              <label style={LABEL_STYLE}>Dari tanggal</label>
              <input style={{ ...INPUT_STYLE, maxWidth: '160px' }} type="date" value={consignmentFrom} onChange={(e) => setConsignmentFrom(e.target.value)} />
            </div>
            <div>
              <label style={LABEL_STYLE}>Sampai tanggal</label>
              <input style={{ ...INPUT_STYLE, maxWidth: '160px' }} type="date" value={consignmentTo} onChange={(e) => setConsignmentTo(e.target.value)} />
            </div>
            <button type="button" onClick={fetchConsignmentReport} style={{ ...TAB_BTN(false), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', height: '36px' }}>
              <RefreshCw size={12} /> Terapkan filter
            </button>
            <span style={{ fontSize: '10.5px', color: '#7C8698' }}>Kosongkan untuk 30 hari terakhir (bawaan)</span>
          </div>

          {loadingConsignment && <EmptyState text="Memuat laporan konsinyasi..." />}
          {!loadingConsignment && consignmentLoadError && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <ErrorList errors={[consignmentLoadError]} />
              <button type="button" onClick={fetchConsignmentReport} style={{ ...TAB_BTN(false), alignSelf: 'flex-start', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}><RefreshCw size={12} /> Coba lagi</button>
            </div>
          )}

          {!loadingConsignment && !consignmentLoadError && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '10px' }}>
                <div style={CARD_STYLE}>
                  <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Produk titip jual</span>
                  <span style={{ fontSize: '17px', fontWeight: 700, color: '#F5F7FA' }}>{consignmentTotals?.products ?? 0}</span>
                </div>
                <div style={CARD_STYLE}>
                  <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Qty terjual (periode)</span>
                  <span style={{ fontSize: '17px', fontWeight: 700, color: '#F5F7FA' }}>{formatQtyStok(consignmentTotals?.qtySold ?? 0)}</span>
                </div>
                <div style={CARD_STYLE}>
                  <span style={{ fontSize: '10.5px', color: '#98A2B3' }}>Wajib disetor ke supplier</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: '#EF4444', fontFamily: "'JetBrains Mono', monospace" }}>{formatRupiahStok(consignmentTotals?.amountDueToSupplier ?? 0)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'end', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '220px' }}>
                  <label style={LABEL_STYLE}>Jadikan produk konsinyasi (titip jual)</label>
                  <select style={INPUT_STYLE} value={addConsignProductId} onChange={(e) => setAddConsignProductId(e.target.value)}>
                    <option value="">Pilih produk milik toko...</option>
                    {nonConsignedActiveProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!addConsignProductId || consignmentTogglingId === addConsignProductId}
                  onClick={() => addConsignProductId && toggleOwnership(addConsignProductId, 'CONSIGNED')}
                  style={{ ...TAB_BTN(false), height: '36px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', opacity: !addConsignProductId ? 0.5 : 1 }}
                >
                  <Handshake size={12} /> Jadikan konsinyasi
                </button>
              </div>
              {consignmentActionMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{consignmentActionMsg}</span>}
              {consignmentActionError && <ErrorList errors={[consignmentActionError]} />}

              {consignmentRows.length === 0 && (
                <EmptyState text="Belum ada produk titip jual" />
              )}
              {consignmentRows.length > 0 && (
                <div style={{ overflowX: 'auto', borderRadius: '12px', background: '#10141C', boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={TABLE_TH}>Produk</th>
                        <th style={TABLE_TH}>Masuk</th>
                        <th style={TABLE_TH}>Terjual</th>
                        <th style={TABLE_TH}>Retur ke supplier</th>
                        <th style={TABLE_TH}>Stok skrg</th>
                        <th style={TABLE_TH}>Wajib disetor</th>
                        <th style={TABLE_TH}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {consignmentRows.map((row) => (
                        <tr key={row.productId}>
                          <td style={TABLE_TD}>{row.name}{row.sku ? <span style={{ color: '#7C8698' }}> ({row.sku})</span> : null}</td>
                          <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatQtyStok(row.qtyIn)} {row.unit}</td>
                          <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatQtyStok(row.qtySold)} {row.unit}</td>
                          <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatQtyStok(row.qtyReturnedToSupplier)} {row.unit}</td>
                          <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatQtyStok(row.currentStock)} {row.unit}</td>
                          <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace", color: '#EF4444' }}>{formatRupiahStok(row.amountDueToSupplier)}</td>
                          <td style={TABLE_TD}>
                            <button
                              type="button"
                              disabled={consignmentTogglingId === row.productId}
                              onClick={() => toggleOwnership(row.productId, 'OWNED')}
                              style={{ ...TAB_BTN(false), boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)', fontSize: '10.5px', padding: '5px 9px', opacity: consignmentTogglingId === row.productId ? 0.5 : 1 }}
                            >
                              {consignmentTogglingId === row.productId ? 'Memproses...' : 'Jadikan milik toko'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ---------------- TAB: PELANGGAN (10 Sep Fable) ---------------- */}
      {tab === 'pelanggan' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '16px' }}>
          <form onSubmit={submitCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Tambah pelanggan</h4>
            <div>
              <label style={LABEL_STYLE}>Nama</label>
              <input style={INPUT_STYLE} type="text" value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="mis. Toko Sumber Rejeki" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>No. HP (opsional)</label>
                <input style={INPUT_STYLE} type="text" value={custPhone} onChange={(e) => setCustPhone(e.target.value)} placeholder="08xx" />
              </div>
              <div>
                <label style={LABEL_STYLE}>Jenis</label>
                <select style={INPUT_STYLE} value={custType} onChange={(e) => setCustType(e.target.value)}>
                  <option value="WARUNG">Warung</option>
                  <option value="TOKO">Toko</option>
                  <option value="LAINNYA">Lainnya</option>
                </select>
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>Alamat (opsional)</label>
              <input style={INPUT_STYLE} type="text" value={custAddress} onChange={(e) => setCustAddress(e.target.value)} placeholder="Alamat lengkap" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Wilayah (opsional)</label>
              <input style={INPUT_STYLE} type="text" value={custArea} onChange={(e) => setCustArea(e.target.value)} placeholder="mis. Bekasi Timur" />
            </div>
            <div>
              <label style={LABEL_STYLE}>Catatan (opsional)</label>
              <input style={INPUT_STYLE} type="text" value={custNotes} onChange={(e) => setCustNotes(e.target.value)} placeholder="opsional" />
            </div>
            <ErrorList errors={custFormErrors} />
            {custSubmitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{custSubmitMsg}</span>}
            <button type="submit" disabled={custSubmitting} style={{ ...SUBMIT_BTN('#3FBF8F'), opacity: custSubmitting ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={14} /> {custSubmitting ? 'Menyimpan...' : 'Tambah pelanggan'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loadingCustomers && <EmptyState text="Memuat data pelanggan..." />}
            {!loadingCustomers && customerLoadError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ErrorList errors={[customerLoadError]} />
                <button type="button" onClick={fetchCustomers} style={{ ...TAB_BTN(false), alignSelf: 'flex-start', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}><RefreshCw size={12} /> Coba lagi</button>
              </div>
            )}
            {!loadingCustomers && !customerLoadError && customers.length === 0 && (
              <EmptyState text="Belum ada pelanggan tercatat. Tambahkan pelanggan pertama lewat form di kiri." />
            )}
            {!loadingCustomers && !customerLoadError && customers.length > 0 && (
              <div style={{ overflowX: 'auto', borderRadius: '12px', background: '#10141C', boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TABLE_TH}>Nama</th>
                      <th style={TABLE_TH}>Jenis</th>
                      <th style={TABLE_TH}>Wilayah</th>
                      <th style={TABLE_TH}>No. HP</th>
                      <th style={TABLE_TH}>Alamat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td style={TABLE_TD}>{c.name}</td>
                        <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{customerTypeLabel(c.type)}</td>
                        <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{c.area || '-'}</td>
                        <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{c.phone || '-'}</td>
                        <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{c.address || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- TAB: KADALUARSA (10 Sep Fable) ---------------- */}
      {tab === 'kadaluarsa' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)', gap: '16px' }}>
          <form onSubmit={submitBatch} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ margin: 0, fontFamily: "'Outfit', sans-serif", fontSize: '13px', fontWeight: 600, color: '#F5F7FA' }}>Catat batch kadaluarsa</h4>
            <div>
              <label style={LABEL_STYLE}>Produk</label>
              <select style={INPUT_STYLE} value={batchProductId} onChange={(e) => setBatchProductId(e.target.value)}>
                <option value="">Pilih produk...</option>
                {products.filter((p) => p.isActive).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={LABEL_STYLE}>Tanggal kadaluarsa</label>
                <input style={INPUT_STYLE} type="date" value={batchExpiryDate} onChange={(e) => setBatchExpiryDate(e.target.value)} />
              </div>
              <div>
                <label style={LABEL_STYLE}>Qty</label>
                <input style={INPUT_STYLE} type="number" min={0} value={batchQty} onChange={(e) => setBatchQty(e.target.value === '' ? '' : Number(e.target.value))} placeholder="0" />
              </div>
            </div>
            <div>
              <label style={LABEL_STYLE}>Kode batch (opsional)</label>
              <input style={INPUT_STYLE} type="text" value={batchCode} onChange={(e) => setBatchCode(e.target.value)} placeholder="mis. B-2026-09" />
            </div>
            <ErrorList errors={batchFormErrors} />
            {batchSubmitMsg && <span style={{ fontSize: '11px', color: '#3FBF8F' }}>{batchSubmitMsg}</span>}
            <button type="submit" disabled={batchSubmitting} style={{ ...SUBMIT_BTN('#D8A33C'), opacity: batchSubmitting ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={14} /> {batchSubmitting ? 'Menyimpan...' : 'Catat batch'}
            </button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '10.5px', color: '#7C8698' }}>{expiringSoonCount} batch akan kadaluarsa dalam 30 hari ke depan</span>
            {loadingBatches && <EmptyState text="Memuat data kadaluarsa..." />}
            {!loadingBatches && batchLoadError && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <ErrorList errors={[batchLoadError]} />
                <button type="button" onClick={fetchBatches} style={{ ...TAB_BTN(false), alignSelf: 'flex-start', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}><RefreshCw size={12} /> Coba lagi</button>
              </div>
            )}
            {!loadingBatches && !batchLoadError && batches.length === 0 && (
              <EmptyState text="Tidak ada batch yang akan kadaluarsa dalam 30 hari ke depan. Catat batch baru lewat form di kiri." />
            )}
            {!loadingBatches && !batchLoadError && batches.length > 0 && (
              <div style={{ overflowX: 'auto', borderRadius: '12px', background: '#10141C', boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={TABLE_TH}>Produk</th>
                      <th style={TABLE_TH}>Kode batch</th>
                      <th style={TABLE_TH}>Qty</th>
                      <th style={TABLE_TH}>Kadaluarsa</th>
                      <th style={TABLE_TH}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches
                      .slice()
                      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
                      .map((b) => {
                        const daysLeft = daysUntilExpiry(b.expiryDate);
                        const badge = expiryBadge(daysLeft);
                        return (
                          <tr key={b.id}>
                            <td style={TABLE_TD}>{b.product?.name || '-'}{b.product?.sku ? <span style={{ color: '#7C8698' }}> ({b.product.sku})</span> : null}</td>
                            <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{b.batchCode || '-'}</td>
                            <td style={{ ...TABLE_TD, fontFamily: "'JetBrains Mono', monospace" }}>{formatQtyStok(b.qty)} {b.product?.unit || ''}</td>
                            <td style={{ ...TABLE_TD, color: '#98A2B3' }}>{new Date(b.expiryDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                            <td style={TABLE_TD}>{badge && <StatusBadge label={badge.label} color={badge.color} />}</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {displaySummary.lowStockCount > 0 && tab !== 'produk' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(239,68,68,0.1)' }}>
          <AlertTriangle size={14} color="#EF4444" />
          <span style={{ fontSize: '11.5px', color: '#F5B8B8' }}>{displaySummary.lowStockCount} produk di bawah stok minimum. Cek tab "Produk & stok".</span>
        </div>
      )}
    </div>
  );
}
