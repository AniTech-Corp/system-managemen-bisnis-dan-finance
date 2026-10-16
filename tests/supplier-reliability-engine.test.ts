import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  computeOnTimeRate,
  computePriceStability,
  computeDefectRate,
  resolveReturnsToSupplier,
  resolveReturnsByLatestPurchase,
  buildSupplierScores,
  type PurchaseOrderItemForScoring,
  type StockReturnForScoring,
  type RawStockReturnRow,
  type PurchaseOrderItemLookupEntry,
  type ProductSupplierHistoryEntry,
} from '../src/lib/ai-brain/supplier-reliability-engine';

// Data SINTETIS murni -- modul supplier-reliability-engine.ts TIDAK menyentuh Prisma
// sama sekali (pola sama persis dgn tests/bank-reconciliation.test.ts), jadi semua tes
// di sini murni fungsi -> input -> output, nol koneksi DB.

describe('computeOnTimeRate', () => {
  test('tidak ada data pengiriman -> null (BUKAN 0, BUKAN 100)', () => {
    assert.equal(computeOnTimeRate(), null);
    assert.equal(computeOnTimeRate([]), null);
  });

  test('signature future-proof: kalau data promised/actual ADA, hitung % tepat waktu dengan benar', () => {
    const rate = computeOnTimeRate([
      { promisedDate: '2026-09-01', actualDate: '2026-09-01' }, // tepat waktu
      { promisedDate: '2026-09-05', actualDate: '2026-09-03' }, // lebih cepat = tepat waktu
      { promisedDate: '2026-09-10', actualDate: '2026-09-12' }, // telat
    ]);
    assert.equal(rate, (2 / 3) * 100);
  });
});

describe('computePriceStability', () => {
  test('harga selalu identik (CV=0) -> skor 100', () => {
    const { priceStability, productsWithPriceHistory } = computePriceStability([
      { productId: 'p1', unitCost: 5000 },
      { productId: 'p1', unitCost: 5000 },
      { productId: 'p1', unitCost: 5000 },
    ]);
    assert.equal(priceStability, 100);
    assert.equal(productsWithPriceHistory, 1);
  });

  test('cuma 1 observasi harga per produk -> null (tidak ada dasar variasi)', () => {
    const { priceStability, productsWithPriceHistory } = computePriceStability([
      { productId: 'p1', unitCost: 5000 },
      { productId: 'p2', unitCost: 12000 },
    ]);
    assert.equal(priceStability, null);
    assert.equal(productsWithPriceHistory, 0);
  });

  test('harga naik-turun ekstrem (CV tinggi) -> skor rendah, TIDAK negatif', () => {
    const { priceStability } = computePriceStability([
      { productId: 'p1', unitCost: 1000 },
      { productId: 'p1', unitCost: 100000 }, // lonjakan 100x
    ]);
    assert.ok(priceStability !== null);
    assert.ok(priceStability! >= 0 && priceStability! < 30, `expected low score, got ${priceStability}`);
  });

  test('per-produk terpisah -- supplier jual barang murah+mahal stabil TIDAK dihukum krn beda harga produk', () => {
    // p1 selalu 5000, p2 selalu 500000 -- masing2 stabil, tapi kalau digabung mentah
    // (bukan per-produk) CV lintas-produk akan tinggi padahal keduanya stabil.
    const { priceStability, productsWithPriceHistory } = computePriceStability([
      { productId: 'p1', unitCost: 5000 },
      { productId: 'p1', unitCost: 5000 },
      { productId: 'p2', unitCost: 500000 },
      { productId: 'p2', unitCost: 500000 },
    ]);
    assert.equal(priceStability, 100, 'kedua produk CV=0, hasil gabungan harus tetap 100');
    assert.equal(productsWithPriceHistory, 2);
  });
});

describe('computeDefectRate', () => {
  test('tidak ada retur sama sekali -> 0', () => {
    assert.equal(computeDefectRate(100, 0), 0);
  });

  test('rasio retur normal', () => {
    assert.equal(computeDefectRate(100, 10), 10);
  });

  test('purchasedQty = 0 -> null (tidak ada dasar pembelian)', () => {
    assert.equal(computeDefectRate(0, 5), null);
  });

  test('retur "lebih besar" dari pembelian (anomali data) -> di-clamp maksimal 100, bukan meledak', () => {
    assert.equal(computeDefectRate(10, 50), 100);
  });
});

describe('resolveReturnsToSupplier', () => {
  test('resolusi berhasil lewat sourceType=PURCHASE_ORDER_ITEM + sourceId ketemu di lookup', () => {
    const lookup = new Map<string, PurchaseOrderItemLookupEntry>([
      ['poi-1', { supplierName: 'CV Sumber Makmur', productId: 'p1' }],
    ]);
    const raw: RawStockReturnRow[] = [
      { direction: 'TO_SUPPLIER', sourceType: 'PURCHASE_ORDER_ITEM', sourceId: 'poi-1', productId: 'p1', qty: 3 },
    ];
    const { resolved, unresolvedCount } = resolveReturnsToSupplier(raw, lookup);
    assert.equal(unresolvedCount, 0);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].supplierName, 'CV Sumber Makmur');
  });

  test('sourceId tidak ketemu di lookup -> unresolved, TIDAK dibuang diam-diam', () => {
    const lookup = new Map<string, PurchaseOrderItemLookupEntry>();
    const raw: RawStockReturnRow[] = [
      { direction: 'TO_SUPPLIER', sourceType: 'PURCHASE_ORDER_ITEM', sourceId: 'poi-ghost', productId: 'p1', qty: 2 },
    ];
    const { resolved, unresolvedCount } = resolveReturnsToSupplier(raw, lookup);
    assert.equal(unresolvedCount, 1);
    assert.equal(resolved.length, 1);
    assert.equal(resolved[0].supplierName, null);
  });

  test('sourceType/sourceId kosong (retur manual tanpa link PO) -> unresolved', () => {
    const raw: RawStockReturnRow[] = [
      { direction: 'TO_SUPPLIER', sourceType: null, sourceId: null, productId: 'p1', qty: 1 },
    ];
    const { unresolvedCount } = resolveReturnsToSupplier(raw, new Map());
    assert.equal(unresolvedCount, 1);
  });

  test('direction bukan TO_SUPPLIER -> diabaikan sepenuhnya (bukan resolved, bukan unresolved)', () => {
    const raw: RawStockReturnRow[] = [
      { direction: 'FROM_CUSTOMER', sourceType: null, sourceId: null, productId: 'p1', qty: 1 },
    ];
    const { resolved, unresolvedCount } = resolveReturnsToSupplier(raw, new Map());
    assert.equal(resolved.length, 0);
    assert.equal(unresolvedCount, 0);
  });
});

describe('resolveReturnsByLatestPurchase (fallback heuristik)', () => {
  test('retur diatribusikan ke supplier PALING TERAKHIR jual produk itu sebelum tanggal retur', () => {
    const history: ProductSupplierHistoryEntry[] = [
      { productId: 'p1', supplierName: 'Supplier Lama', purchaseDate: '2026-08-01' },
      { productId: 'p1', supplierName: 'Supplier Baru', purchaseDate: '2026-08-20' },
    ];
    const { resolved, unresolvedCount } = resolveReturnsByLatestPurchase(
      [{ productId: 'p1', qty: 2, createdAt: '2026-09-01' }],
      history,
    );
    assert.equal(unresolvedCount, 0);
    assert.equal(resolved[0].supplierName, 'Supplier Baru', 'harus pilih pembelian PALING BARU sebelum retur');
  });

  test('pembelian SETELAH tanggal retur tidak dihitung (retur tidak bisa dari masa depan)', () => {
    const history: ProductSupplierHistoryEntry[] = [
      { productId: 'p1', supplierName: 'Supplier Sebelum', purchaseDate: '2026-08-01' },
      { productId: 'p1', supplierName: 'Supplier Setelah', purchaseDate: '2026-09-15' },
    ];
    const { resolved } = resolveReturnsByLatestPurchase(
      [{ productId: 'p1', qty: 1, createdAt: '2026-09-01' }],
      history,
    );
    assert.equal(resolved[0].supplierName, 'Supplier Sebelum');
  });

  test('produk tidak punya histori pembelian sama sekali -> unresolved', () => {
    const { resolved, unresolvedCount } = resolveReturnsByLatestPurchase(
      [{ productId: 'p-tanpa-histori', qty: 1, createdAt: '2026-09-01' }],
      [],
    );
    assert.equal(unresolvedCount, 1);
    assert.equal(resolved[0].supplierName, null);
  });
});

describe('buildSupplierScores', () => {
  test('supplier bagus (harga stabil, nol retur) -> skor tinggi', () => {
    const items: PurchaseOrderItemForScoring[] = [
      { purchaseOrderId: 'po-1', supplierName: 'CV Bagus', productId: 'p1', qty: 10, unitCost: 5000 },
      { purchaseOrderId: 'po-2', supplierName: 'CV Bagus', productId: 'p1', qty: 10, unitCost: 5000 },
    ];
    const { scores, unresolvedReturnCount } = buildSupplierScores(items, []);
    assert.equal(scores.length, 1);
    assert.equal(scores[0].supplierName, 'CV Bagus');
    assert.equal(scores[0].priceStability, 100);
    assert.equal(scores[0].defectRate, 0);
    assert.equal(scores[0].onTimeRate, null);
    // Skor akhir = rata2 priceStability(100) + inverted-defect(100) direnormalisasi -> 100
    assert.equal(scores[0].score, 100);
    assert.equal(scores[0].dataPoints.totalPurchaseOrders, 2);
    assert.equal(scores[0].hasSufficientData, true);
    assert.equal(unresolvedReturnCount, 0);
  });

  test('supplier jelek (harga naik-turun ekstrem + retur tinggi) -> skor rendah', () => {
    const items: PurchaseOrderItemForScoring[] = [
      { purchaseOrderId: 'po-1', supplierName: 'CV Jelek', productId: 'p1', qty: 10, unitCost: 1000 },
      { purchaseOrderId: 'po-2', supplierName: 'CV Jelek', productId: 'p1', qty: 10, unitCost: 50000 },
    ];
    const returns: StockReturnForScoring[] = [
      { supplierName: 'CV Jelek', productId: 'p1', qty: 15 }, // 15/20 = 75% defect
    ];
    const { scores } = buildSupplierScores(items, returns);
    assert.equal(scores.length, 1);
    assert.ok(scores[0].score < 30, `expected low score, got ${scores[0].score}`);
    assert.equal(scores[0].defectRate, 75);
  });

  test('baru 1 PO -> hasSufficientData=false (sample size kurang), tapi skor tetap dihitung', () => {
    const items: PurchaseOrderItemForScoring[] = [
      { purchaseOrderId: 'po-1', supplierName: 'CV Baru', productId: 'p1', qty: 5, unitCost: 3000 },
    ];
    const { scores } = buildSupplierScores(items, []);
    assert.equal(scores[0].hasSufficientData, false);
    assert.equal(scores[0].dataPoints.totalPurchaseOrders, 1);
  });

  test('multi-supplier -> diurutkan score DESC, retur satu supplier tidak nyampur ke supplier lain', () => {
    const items: PurchaseOrderItemForScoring[] = [
      { purchaseOrderId: 'po-1', supplierName: 'CV Bagus', productId: 'p1', qty: 10, unitCost: 5000 },
      { purchaseOrderId: 'po-2', supplierName: 'CV Bagus', productId: 'p1', qty: 10, unitCost: 5000 },
      { purchaseOrderId: 'po-3', supplierName: 'CV Jelek', productId: 'p2', qty: 10, unitCost: 5000 },
      { purchaseOrderId: 'po-4', supplierName: 'CV Jelek', productId: 'p2', qty: 10, unitCost: 5000 },
    ];
    const returns: StockReturnForScoring[] = [
      { supplierName: 'CV Jelek', productId: 'p2', qty: 18 }, // 18/20 = 90% defect, cuma punya CV Jelek
    ];
    const { scores } = buildSupplierScores(items, returns);
    assert.equal(scores.length, 2);
    assert.equal(scores[0].supplierName, 'CV Bagus', 'CV Bagus harus rank #1 (skor lebih tinggi)');
    assert.equal(scores[0].defectRate, 0, 'CV Bagus TIDAK ikut kena retur CV Jelek');
    assert.equal(scores[1].supplierName, 'CV Jelek');
    assert.equal(scores[1].defectRate, 90);
  });

  test('supplier tanpa data pembelian sama sekali tidak muncul di hasil', () => {
    const { scores } = buildSupplierScores([], []);
    assert.equal(scores.length, 0);
  });

  test('retur ber-supplierName:null (unresolved) tidak nyangkut ke supplier manapun', () => {
    const items: PurchaseOrderItemForScoring[] = [
      { purchaseOrderId: 'po-1', supplierName: 'CV Bagus', productId: 'p1', qty: 10, unitCost: 5000 },
    ];
    const returns: StockReturnForScoring[] = [
      { supplierName: null, productId: 'p1', qty: 99 }, // retur manual, gagal diresolusi
    ];
    const { scores, unresolvedReturnCount } = buildSupplierScores(items, returns);
    assert.equal(scores[0].defectRate, 0, 'retur unresolved TIDAK dihitung sebagai defect CV Bagus');
    assert.equal(unresolvedReturnCount, 1);
  });
});
