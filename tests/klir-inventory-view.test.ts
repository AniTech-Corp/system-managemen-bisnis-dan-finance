import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  formatRupiahStok,
  formatQtyStok,
  movementTypeLabel,
  isMovementIn,
  isLowStock,
  summarizeProducts,
  validateProductForm,
  supplierScoreColor,
  mapProductSubmitError,
  MOVEMENT_TYPE_LABELS,
  consignmentStatusLabel,
  validateSaleForm,
  buildSaleTotal,
  validateAdjustmentForm,
  validatePurchaseOrderForm,
  buildPurchaseOrderTotal,
  returnDirectionLabel,
  validateReturnForm,
  daysUntilExpiry,
  expiryBadge,
  formatPackLabel,
  validateProductEditForm,
  customerTypeLabel,
  validateCustomerForm,
  validateBatchForm,
  type InventoryProductRow,
} from '../src/app/components/KlirInventoryView';

describe('mapProductSubmitError (F1 10 Sep -- SKU duplikat tampil di field SKU)', () => {
  test('409 -> field sku, pakai pesan server kalau ada', () => {
    const r = mapProductSubmitError(409, 'SKU "KS-001" sudah dipakai produk "Kopi Susu" di workspace ini.');
    assert.equal(r.field, 'sku');
    assert.match(r.text, /KS-001/);
  });
  test('409 tanpa pesan -> field sku dengan pesan default', () => {
    const r = mapProductSubmitError(409, '');
    assert.equal(r.field, 'sku');
    assert.match(r.text, /SKU/);
  });
  test('400/500 -> field form (daftar error umum)', () => {
    assert.equal(mapProductSubmitError(400, 'Nama produk wajib diisi.').field, 'form');
    assert.equal(mapProductSubmitError(500, null).field, 'form');
    assert.equal(mapProductSubmitError(500, null).text, 'Gagal menambah produk.');
  });
});

// Test untuk logic UI MURNI di KlirInventoryView.tsx ("Stok & Pembelian" -- tab
// produk/riwayat/pembelian/pemasok). Sama pola dengan tests/klir-schedule-view.test.ts:
// cuma import named export fungsi murni, TIDAK ADA render React (tidak ada
// jsdom/testing-library terpasang di project ini). Endpoint backend inventory/*
// (products, stock-movements, purchase-orders, supplier-score) punya test sendiri
// di lane masing-masing agent (tidak diduplikasi di sini).

function makeProduct(overrides: Partial<InventoryProductRow> = {}): InventoryProductRow {
  return {
    id: 'p1',
    sku: 'SKU-1',
    name: 'Produk Contoh',
    category: 'Umum',
    unit: 'pcs',
    ownershipType: 'OWNED',
    costPrice: 10000,
    sellPrice: 15000,
    currentStock: 20,
    minStock: 5,
    isActive: true,
    ...overrides,
  };
}

describe('formatRupiahStok', () => {
  test('bulatkan & format ribuan gaya id-ID', () => {
    assert.equal(formatRupiahStok(150000), 'Rp 150.000');
    assert.equal(formatRupiahStok(1500000.6), 'Rp 1.500.001');
  });
  test('NaN/Infinity -> Rp 0 (bukan "Rp NaN")', () => {
    assert.equal(formatRupiahStok(NaN), 'Rp 0');
    assert.equal(formatRupiahStok(Infinity), 'Rp 0');
  });
});

describe('formatQtyStok', () => {
  test('angka bulat tampil tanpa desimal', () => {
    assert.equal(formatQtyStok(20), '20');
  });
  test('angka pecahan tampil maksimal 2 desimal, koma id-ID', () => {
    assert.equal(formatQtyStok(1.5), '1,5');
  });
  test('NaN -> 0', () => {
    assert.equal(formatQtyStok(NaN), '0');
  });
});

describe('movementTypeLabel', () => {
  test('semua 7 tipe StockMovementType terpetakan ke label Indonesia', () => {
    assert.equal(movementTypeLabel('PURCHASE_IN'), 'Pembelian masuk');
    assert.equal(movementTypeLabel('SALE_OUT'), 'Penjualan keluar');
    assert.equal(movementTypeLabel('ADJUSTMENT_IN'), 'Penyesuaian masuk');
    assert.equal(movementTypeLabel('ADJUSTMENT_OUT'), 'Penyesuaian keluar');
    assert.equal(movementTypeLabel('RETURN_IN'), 'Retur masuk');
    assert.equal(movementTypeLabel('RETURN_OUT'), 'Retur keluar');
    assert.equal(movementTypeLabel('OPENING_BALANCE'), 'Saldo awal');
  });
  test('tipe tak dikenal fallback ke string mentah, bukan "undefined"', () => {
    assert.equal(movementTypeLabel('UNKNOWN_TYPE_XYZ'), 'UNKNOWN_TYPE_XYZ');
  });
  test('MOVEMENT_TYPE_LABELS punya persis 7 kunci sesuai enum Prisma', () => {
    assert.equal(Object.keys(MOVEMENT_TYPE_LABELS).length, 7);
  });
});

describe('isMovementIn', () => {
  test('PURCHASE_IN/ADJUSTMENT_IN/RETURN_IN/OPENING_BALANCE = IN', () => {
    assert.equal(isMovementIn('PURCHASE_IN'), true);
    assert.equal(isMovementIn('ADJUSTMENT_IN'), true);
    assert.equal(isMovementIn('RETURN_IN'), true);
    assert.equal(isMovementIn('OPENING_BALANCE'), true);
  });
  test('SALE_OUT/ADJUSTMENT_OUT/RETURN_OUT = OUT', () => {
    assert.equal(isMovementIn('SALE_OUT'), false);
    assert.equal(isMovementIn('ADJUSTMENT_OUT'), false);
    assert.equal(isMovementIn('RETURN_OUT'), false);
  });
});

describe('isLowStock (mirror kontrak API products/route.ts)', () => {
  test('aktif, minStock>0, currentStock<=minStock -> true', () => {
    assert.equal(isLowStock(makeProduct({ currentStock: 5, minStock: 5, isActive: true })), true);
    assert.equal(isLowStock(makeProduct({ currentStock: 3, minStock: 5, isActive: true })), true);
  });
  test('currentStock di atas minStock -> false', () => {
    assert.equal(isLowStock(makeProduct({ currentStock: 20, minStock: 5 })), false);
  });
  test('minStock 0 (belum diset) -> false meski currentStock 0', () => {
    assert.equal(isLowStock(makeProduct({ currentStock: 0, minStock: 0 })), false);
  });
  test('produk non-aktif -> false meski di bawah minimum (produk nonaktif diabaikan)', () => {
    assert.equal(isLowStock(makeProduct({ currentStock: 1, minStock: 5, isActive: false })), false);
  });
});

describe('summarizeProducts', () => {
  test('array kosong -> semua nol, lowStock array kosong (zero-state jujur)', () => {
    const s = summarizeProducts([]);
    assert.equal(s.productCount, 0);
    assert.equal(s.activeCount, 0);
    assert.equal(s.stockValue, 0);
    assert.equal(s.lowStockCount, 0);
    assert.deepEqual(s.lowStock, []);
  });
  test('stockValue = sum currentStock*costPrice untuk produk aktif saja', () => {
    const s = summarizeProducts([
      makeProduct({ id: 'a', currentStock: 10, costPrice: 1000, isActive: true }),
      makeProduct({ id: 'b', currentStock: 5, costPrice: 2000, isActive: true }),
      makeProduct({ id: 'c', currentStock: 999, costPrice: 999999, isActive: false }),
    ]);
    assert.equal(s.stockValue, 10 * 1000 + 5 * 2000);
    assert.equal(s.productCount, 3);
    assert.equal(s.activeCount, 2);
  });
  test('lowStockCount menghitung produk aktif di bawah minimum saja', () => {
    const s = summarizeProducts([
      makeProduct({ id: 'a', currentStock: 2, minStock: 5, isActive: true }),
      makeProduct({ id: 'b', currentStock: 100, minStock: 5, isActive: true }),
      makeProduct({ id: 'c', currentStock: 0, minStock: 5, isActive: false }),
    ]);
    assert.equal(s.lowStockCount, 1);
    assert.equal(s.lowStock[0].id, 'a');
  });
  test('lowStock dipotong maksimal 20 entri', () => {
    const many: InventoryProductRow[] = Array.from({ length: 30 }, (_, i) =>
      makeProduct({ id: `p${i}`, currentStock: 1, minStock: 5, isActive: true })
    );
    const s = summarizeProducts(many);
    assert.equal(s.lowStockCount, 30);
    assert.equal(s.lowStock.length, 20);
  });
});

describe('validateProductForm (mirror kontrak POST products/route.ts)', () => {
  test('nama kosong -> error', () => {
    const errors = validateProductForm({ name: '', costPrice: '', sellPrice: '', minStock: '', openingStock: '' });
    assert.ok(errors.some((e) => e.includes('Nama produk')));
  });
  test('nama whitespace saja -> error', () => {
    const errors = validateProductForm({ name: '   ', costPrice: '', sellPrice: '', minStock: '', openingStock: '' });
    assert.ok(errors.some((e) => e.includes('Nama produk')));
  });
  test('semua field kosong kecuali nama -> valid (angka >=0 opsional, default 0 di submit)', () => {
    const errors = validateProductForm({ name: 'Produk A', costPrice: '', sellPrice: '', minStock: '', openingStock: '' });
    assert.deepEqual(errors, []);
  });
  test('costPrice/sellPrice/minStock/openingStock minus -> error masing-masing', () => {
    const errors = validateProductForm({ name: 'Produk A', costPrice: -1, sellPrice: -1, minStock: -1, openingStock: -1 });
    assert.equal(errors.length, 4);
  });
  test('nilai 0 valid (bukan dianggap minus)', () => {
    const errors = validateProductForm({ name: 'Produk A', costPrice: 0, sellPrice: 0, minStock: 0, openingStock: 0 });
    assert.deepEqual(errors, []);
  });
});

describe('supplierScoreColor', () => {
  test('>=80 hijau, 60-79 kuning, <60 merah', () => {
    assert.equal(supplierScoreColor(95), '#3FBF8F');
    assert.equal(supplierScoreColor(80), '#3FBF8F');
    assert.equal(supplierScoreColor(70), '#D8A33C');
    assert.equal(supplierScoreColor(60), '#D8A33C');
    assert.equal(supplierScoreColor(30), '#EF4444');
    assert.equal(supplierScoreColor(0), '#EF4444');
  });
});

// ---------------------------------------------------------------------------
// Test tambahan 10 Sep 2026 (kontrak Tingkat B, agent ui-stock-ops) -- helper
// murni untuk tab Konsinyasi + form Catat penjualan/Penyesuaian stok/Catat
// pembelian. Pola sama: cuma import + assert, tidak ada render React.
// ---------------------------------------------------------------------------

describe('consignmentStatusLabel', () => {
  test('CONSIGNED -> label titip jual', () => {
    assert.equal(consignmentStatusLabel('CONSIGNED'), 'Konsinyasi (titip jual)');
  });
  test('OWNED -> label milik toko', () => {
    assert.equal(consignmentStatusLabel('OWNED'), 'Milik toko');
  });
  test('undefined/null -> Tidak diketahui (bukan "undefined" mentah)', () => {
    assert.equal(consignmentStatusLabel(undefined), 'Tidak diketahui');
    assert.equal(consignmentStatusLabel(null), 'Tidak diketahui');
  });
  test('nilai tak dikenal -> fallback ke string mentahnya sendiri', () => {
    assert.equal(consignmentStatusLabel('ANEH'), 'ANEH');
  });
});

describe('validateSaleForm (mirror kontrak POST /api/v1/inventory/sales)', () => {
  test('array kosong -> error minimal 1 item', () => {
    const errors = validateSaleForm([]);
    assert.ok(errors.some((e) => e.includes('Minimal 1 item')));
  });
  test('productId kosong -> error "pilih produk" untuk baris itu', () => {
    const errors = validateSaleForm([{ productId: '', qty: 2, unitPrice: 1000 }]);
    assert.ok(errors.some((e) => e.includes('Baris 1') && e.includes('pilih produk')));
  });
  test('qty <=0 atau kosong -> error', () => {
    assert.ok(validateSaleForm([{ productId: 'p1', qty: 0, unitPrice: 1000 }]).some((e) => e.includes('qty')));
    assert.ok(validateSaleForm([{ productId: 'p1', qty: '', unitPrice: 1000 }]).some((e) => e.includes('qty')));
  });
  test('unitPrice minus -> error, unitPrice 0 valid', () => {
    assert.ok(validateSaleForm([{ productId: 'p1', qty: 1, unitPrice: -100 }]).some((e) => e.includes('minus')));
    assert.deepEqual(validateSaleForm([{ productId: 'p1', qty: 1, unitPrice: 0 }]), []);
  });
  test('2 item semua valid -> tidak ada error', () => {
    const errors = validateSaleForm([
      { productId: 'p1', qty: 2, unitPrice: 5000 },
      { productId: 'p2', qty: 1, unitPrice: 12000 },
    ]);
    assert.deepEqual(errors, []);
  });
  test('multi-baris -> error menyebut nomor baris yang benar (baris 2)', () => {
    const errors = validateSaleForm([
      { productId: 'p1', qty: 2, unitPrice: 5000 },
      { productId: '', qty: 1, unitPrice: 1000 },
    ]);
    assert.ok(errors.some((e) => e.startsWith('Baris 2')));
    assert.ok(!errors.some((e) => e.startsWith('Baris 1')));
  });
});

describe('buildSaleTotal', () => {
  test('sum qty * unitPrice antar item', () => {
    assert.equal(
      buildSaleTotal([
        { productId: 'p1', qty: 2, unitPrice: 5000 },
        { productId: 'p2', qty: 3, unitPrice: 1000 },
      ]),
      2 * 5000 + 3 * 1000
    );
  });
  test('item kosong (qty/unitPrice "") dihitung 0, tidak bikin NaN', () => {
    assert.equal(buildSaleTotal([{ productId: 'p1', qty: '', unitPrice: '' }]), 0);
  });
  test('array kosong -> 0', () => {
    assert.equal(buildSaleTotal([]), 0);
  });
});

describe('validateAdjustmentForm (mirror kontrak POST /api/v1/inventory/stock-adjustments)', () => {
  test('productId kosong -> error', () => {
    const errors = validateAdjustmentForm({ productId: '', qtyChange: 5, reason: 'Rusak' });
    assert.ok(errors.some((e) => e.includes('Pilih produk')));
  });
  test('qtyChange nol atau kosong -> error', () => {
    assert.ok(validateAdjustmentForm({ productId: 'p1', qtyChange: 0, reason: 'Rusak' }).some((e) => e.includes('tidak boleh nol')));
    assert.ok(validateAdjustmentForm({ productId: 'p1', qtyChange: '', reason: 'Rusak' }).some((e) => e.includes('tidak boleh nol')));
  });
  test('qtyChange negatif valid (penyesuaian keluar)', () => {
    assert.deepEqual(validateAdjustmentForm({ productId: 'p1', qtyChange: -3, reason: 'Barang hilang' }), []);
  });
  test('reason kosong / kurang dari 3 huruf -> error', () => {
    assert.ok(validateAdjustmentForm({ productId: 'p1', qtyChange: 2, reason: '' }).some((e) => e.includes('Alasan')));
    assert.ok(validateAdjustmentForm({ productId: 'p1', qtyChange: 2, reason: 'ab' }).some((e) => e.includes('Alasan')));
  });
  test('semua field valid -> tidak ada error', () => {
    assert.deepEqual(validateAdjustmentForm({ productId: 'p1', qtyChange: 5, reason: 'Koreksi hitung ulang' }), []);
  });
});

describe('validatePurchaseOrderForm (mirror kontrak POST purchase-orders/route.ts baris 20-41)', () => {
  test('supplierName kosong -> error', () => {
    const errors = validatePurchaseOrderForm({ supplierName: '', items: [{ productId: 'p1', qty: 1, unitCost: 1000 }] });
    assert.ok(errors.some((e) => e.includes('supplier')));
  });
  test('items kosong -> error minimal 1 item, tidak lanjut cek per-baris', () => {
    const errors = validatePurchaseOrderForm({ supplierName: 'Toko A', items: [] });
    assert.deepEqual(errors, ['Minimal 1 item barang wajib diisi.']);
  });
  test('unitCost minus -> error, unitCost 0 valid', () => {
    assert.ok(validatePurchaseOrderForm({ supplierName: 'Toko A', items: [{ productId: 'p1', qty: 1, unitCost: -1 }] }).length > 0);
    assert.deepEqual(validatePurchaseOrderForm({ supplierName: 'Toko A', items: [{ productId: 'p1', qty: 1, unitCost: 0 }] }), []);
  });
  test('semua valid -> tidak ada error', () => {
    assert.deepEqual(
      validatePurchaseOrderForm({ supplierName: 'Toko Grosir', items: [{ productId: 'p1', qty: 10, unitCost: 2000 }] }),
      []
    );
  });
});

describe('buildPurchaseOrderTotal', () => {
  test('sum qty * unitCost antar item', () => {
    assert.equal(
      buildPurchaseOrderTotal([
        { productId: 'p1', qty: 10, unitCost: 2000 },
        { productId: 'p2', qty: 5, unitCost: 3000 },
      ]),
      10 * 2000 + 5 * 3000
    );
  });
  test('item kosong dihitung 0', () => {
    assert.equal(buildPurchaseOrderTotal([{ productId: 'p1', qty: '', unitCost: '' }]), 0);
  });
});

// ---------------------------------------------------------------------------
// Test tambahan 10 Sep 2026 (Fable, batch BANGUN F3b+F4) -- helper murni untuk
// retur, foto jadi stok (pack label), edit produk, pelanggan, batch kadaluarsa.
// Pola sama: cuma import + assert, tidak ada render React.
// ---------------------------------------------------------------------------

describe('returnDirectionLabel (mirror kontrak POST /api/v1/inventory/returns)', () => {
  test('TO_SUPPLIER -> label ke supplier', () => {
    assert.equal(returnDirectionLabel('TO_SUPPLIER'), 'Retur ke supplier');
  });
  test('FROM_CUSTOMER -> label dari pelanggan', () => {
    assert.equal(returnDirectionLabel('FROM_CUSTOMER'), 'Retur dari pelanggan');
  });
  test('nilai tak dikenal -> fallback ke string mentahnya sendiri', () => {
    assert.equal(returnDirectionLabel('ANEH'), 'ANEH');
  });
});

describe('validateReturnForm', () => {
  test('productId kosong -> error', () => {
    const errors = validateReturnForm({ productId: '', direction: 'TO_SUPPLIER', qty: 2, reason: '' });
    assert.ok(errors.some((e) => e.includes('Pilih produk')));
  });
  test('direction kosong/tidak valid -> error', () => {
    assert.ok(validateReturnForm({ productId: 'p1', direction: '', qty: 2, reason: '' }).some((e) => e.includes('arah retur')));
  });
  test('qty <=0 atau kosong -> error', () => {
    assert.ok(validateReturnForm({ productId: 'p1', direction: 'TO_SUPPLIER', qty: 0, reason: '' }).some((e) => e.includes('Qty')));
    assert.ok(validateReturnForm({ productId: 'p1', direction: 'TO_SUPPLIER', qty: '', reason: '' }).some((e) => e.includes('Qty')));
  });
  test('reason kosong TETAP valid (opsional di server)', () => {
    assert.deepEqual(validateReturnForm({ productId: 'p1', direction: 'FROM_CUSTOMER', qty: 3, reason: '' }), []);
  });
  test('semua field valid -> tidak ada error', () => {
    assert.deepEqual(validateReturnForm({ productId: 'p1', direction: 'TO_SUPPLIER', qty: 5, reason: 'Rusak' }), []);
  });
});

describe('daysUntilExpiry', () => {
  test('tanggal 10 hari ke depan -> 10', () => {
    const now = new Date(2026, 8, 10); // 10 Sep 2026
    assert.equal(daysUntilExpiry('2026-09-20', now), 10);
  });
  test('tanggal hari ini -> 0', () => {
    const now = new Date(2026, 8, 10);
    assert.equal(daysUntilExpiry('2026-09-10', now), 0);
  });
  test('tanggal sudah lewat -> negatif', () => {
    const now = new Date(2026, 8, 10);
    assert.equal(daysUntilExpiry('2026-09-05', now), -5);
  });
});

describe('expiryBadge', () => {
  test('sudah lewat (negatif) -> merah, label "Sudah kadaluarsa"', () => {
    const b = expiryBadge(-3);
    assert.equal(b?.label, 'Sudah kadaluarsa');
    assert.equal(b?.color, '#EF4444');
  });
  test('< 7 hari -> merah', () => {
    assert.equal(expiryBadge(3)?.color, '#EF4444');
  });
  test('< 30 hari -> amber', () => {
    assert.equal(expiryBadge(20)?.color, '#D8A33C');
  });
  test('>= 30 hari -> null (aman, tidak perlu badge)', () => {
    assert.equal(expiryBadge(60), null);
  });
});

describe('formatPackLabel (kolom kemasan tabel produk)', () => {
  test('packUnit diisi -> format "N satuan/kemasan"', () => {
    assert.equal(formatPackLabel(30, 'dus', 'pcs'), '30 pcs/dus');
  });
  test('packUnit kosong/null -> null (kolom disembunyikan)', () => {
    assert.equal(formatPackLabel(30, null, 'pcs'), null);
    assert.equal(formatPackLabel(30, '', 'pcs'), null);
  });
  test('packSize falsy (0/null/undefined) -> fallback ke 1', () => {
    assert.equal(formatPackLabel(0, 'dus', 'pcs'), '1 pcs/dus');
    assert.equal(formatPackLabel(null, 'dus', 'pcs'), '1 pcs/dus');
    assert.equal(formatPackLabel(undefined, 'dus', 'pcs'), '1 pcs/dus');
  });
});

describe('validateProductEditForm (PATCH products/[id], subset validateProductForm tanpa openingStock)', () => {
  test('nama kosong -> error', () => {
    assert.ok(validateProductEditForm({ name: '', costPrice: '', sellPrice: '', minStock: '' }).some((e) => e.includes('Nama produk')));
  });
  test('costPrice/sellPrice/minStock minus -> error masing-masing', () => {
    const errors = validateProductEditForm({ name: 'Produk A', costPrice: -1, sellPrice: -1, minStock: -1 });
    assert.equal(errors.length, 3);
  });
  test('semua field valid -> tidak ada error', () => {
    assert.deepEqual(validateProductEditForm({ name: 'Produk A', costPrice: 1000, sellPrice: 2000, minStock: 5 }), []);
  });
});

describe('customerTypeLabel', () => {
  test('WARUNG/TOKO/LAINNYA -> label Indonesia', () => {
    assert.equal(customerTypeLabel('WARUNG'), 'Warung');
    assert.equal(customerTypeLabel('TOKO'), 'Toko');
    assert.equal(customerTypeLabel('LAINNYA'), 'Lainnya');
  });
  test('undefined/null/kosong -> fallback "Lainnya"', () => {
    assert.equal(customerTypeLabel(undefined), 'Lainnya');
    assert.equal(customerTypeLabel(null), 'Lainnya');
    assert.equal(customerTypeLabel(''), 'Lainnya');
  });
  test('nilai tak dikenal -> fallback ke string mentahnya sendiri', () => {
    assert.equal(customerTypeLabel('GROSIR'), 'GROSIR');
  });
});

describe('validateCustomerForm (mirror kontrak POST /api/v1/inventory/customers)', () => {
  test('nama kosong -> error', () => {
    const errors = validateCustomerForm({ name: '', phone: '', address: '', area: '', type: 'WARUNG', notes: '' });
    assert.ok(errors.some((e) => e.includes('Nama pelanggan')));
  });
  test('nama whitespace saja -> error', () => {
    assert.ok(validateCustomerForm({ name: '   ', phone: '', address: '', area: '', type: 'WARUNG', notes: '' }).length > 0);
  });
  test('nama diisi, semua field lain kosong -> valid (opsional)', () => {
    assert.deepEqual(validateCustomerForm({ name: 'Toko Rejeki', phone: '', address: '', area: '', type: 'WARUNG', notes: '' }), []);
  });
});

describe('validateBatchForm (mirror kontrak POST /api/v1/inventory/product-batches)', () => {
  test('productId kosong -> error', () => {
    assert.ok(validateBatchForm({ productId: '', expiryDate: '2026-12-01', qty: 5, batchCode: '' }).some((e) => e.includes('Pilih produk')));
  });
  test('expiryDate kosong -> error', () => {
    assert.ok(validateBatchForm({ productId: 'p1', expiryDate: '', qty: 5, batchCode: '' }).some((e) => e.includes('Tanggal kadaluarsa')));
  });
  test('qty <=0 atau kosong -> error', () => {
    assert.ok(validateBatchForm({ productId: 'p1', expiryDate: '2026-12-01', qty: 0, batchCode: '' }).some((e) => e.includes('Qty')));
    assert.ok(validateBatchForm({ productId: 'p1', expiryDate: '2026-12-01', qty: '', batchCode: '' }).some((e) => e.includes('Qty')));
  });
  test('semua field valid, batchCode opsional -> tidak ada error', () => {
    assert.deepEqual(validateBatchForm({ productId: 'p1', expiryDate: '2026-12-01', qty: 10, batchCode: '' }), []);
  });
});
