import test from 'node:test';
import assert from 'node:assert/strict';

import {
  detectInventoryIntent,
  buildRestockRecommendations,
  buildLowStockAlerts,
  detectReturnAnomalies,
  buildProfitContributors,
  buildDeadStock,
  buildStockTurnover,
  buildConsignmentSummary,
  buildInventoryReply,
  buildRestockByCustomer,
  buildExpiryAlerts,
  buildReorderPoints,
  formatQtyWithPack,
  type InventoryProductLite,
  type InventoryMovementLite,
  type InventoryReturnLite,
  type InventoryCustomerLite,
  type InventoryBatchLite,
} from '../src/lib/ai-brain/inventory-intelligence-engine';

const NOW = new Date('2026-09-10T00:00:00.000Z');

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function product(overrides: Partial<InventoryProductLite> = {}): InventoryProductLite {
  return {
    id: 'p1',
    name: 'Produk A',
    sku: 'SKU-A',
    unit: 'pcs',
    currentStock: 10,
    minStock: 5,
    costPrice: 1000,
    sellPrice: 1500,
    ownershipType: 'OWNED',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectInventoryIntent
// ---------------------------------------------------------------------------

test('detects inventory intent for stok/restock/persediaan keywords', () => {
  assert.equal(detectInventoryIntent('Stok barang A berapa sekarang?'), true);
  assert.equal(detectInventoryIntent('Perlu restock apa saja minggu ini?'), true);
  assert.equal(detectInventoryIntent('Cek persediaan gudang dong'), true);
  assert.equal(detectInventoryIntent('Barang habis yang mana aja?'), true);
  assert.equal(detectInventoryIntent('Supplier mana yang paling bagus?'), true);
  assert.equal(detectInventoryIntent('Ada retur dari pelanggan gak?'), true);
  assert.equal(detectInventoryIntent('Produk paling laku bulan ini apa?'), true);
});

test('does NOT trigger inventory intent for sales target prompts (no collision with sales-target-engine)', () => {
  assert.equal(detectInventoryIntent('target penjualan 100 juta'), false);
  assert.equal(detectInventoryIntent('Tolong prediksi target penjualan sampai Desember'), false);
  assert.equal(detectInventoryIntent('target tahunan Rp 100 juta; Q1 Rp 15 juta'), false);
});

test('does NOT trigger inventory intent for unrelated messages', () => {
  // Catatan 10 Sep 2026 (agent inventory-engine): assertion untuk kalimat "pelanggan"
  // di bawah ini SENGAJA diubah dari false ke true. Kontrak eksekusi F3b/F4 eksplisit
  // meminta kata kunci "pelanggan" ditambahkan (untuk fitur restock per toko/pelanggan
  // Distributor) -- efek sampingnya, kalimat tak terkait stok yang menyebut "pelanggan"
  // sekarang ikut ke-detect. Ini trade-off yang disadari dan dicatat, bukan bug yang
  // lolos tanpa sadar -- lihat komentar di detectInventoryIntent dan
  // peringatan_untuk_tim di laporan agent ini.
  assert.equal(detectInventoryIntent('Buatkan invoice untuk pelanggan baru'), true);
  assert.equal(detectInventoryIntent('Hitung HPP produk kue kering'), false);
  assert.equal(detectInventoryIntent(''), false);
});

// ---------------------------------------------------------------------------
// buildRestockRecommendations
// ---------------------------------------------------------------------------

test('flags product as kritis when days of cover is under 7 days', () => {
  const products = [product({ id: 'p1', currentStock: 15, minStock: 5 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -15, createdAt: daysAgo(5) },
  ];
  const [rec] = buildRestockRecommendations({ products, movements, now: NOW });

  assert.equal(rec.status, 'kritis');
  assert.equal(rec.avgDailyOut, 3);
  assert.equal(rec.daysOfCover, 5);
  assert.equal(rec.suggestedQty, Math.max(0, Math.ceil(3 * 30 - 15)));
});

test('flags product as kritis when stock is at or below minStock even if cover looks ok', () => {
  const products = [product({ id: 'p1', currentStock: 5, minStock: 5 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -1, createdAt: daysAgo(20) },
  ];
  const [rec] = buildRestockRecommendations({ products, movements, now: NOW });

  assert.equal(rec.status, 'kritis');
});

test('flags product as waspada when days of cover is between 7 and 14 days', () => {
  const products = [product({ id: 'p1', currentStock: 100, minStock: 5 })];
  // 1 unit/hari keluar selama 20 hari -> avgDailyOut = 20/20 = 1/hari, cover = 100 hari... jadi
  // atur currentStock kecil supaya cover jatuh di rentang 7-14 hari.
  const products2 = [product({ id: 'p1', currentStock: 10, minStock: 2 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -20, createdAt: daysAgo(20) },
  ];
  const [rec] = buildRestockRecommendations({ products: products2, movements, now: NOW });

  // avgDailyOut = 20/20 = 1/hari, daysOfCover = 10/1 = 10 hari -> waspada (7 <= x < 14)
  assert.equal(rec.avgDailyOut, 1);
  assert.equal(rec.daysOfCover, 10);
  assert.equal(rec.status, 'waspada');
});

test('flags product as aman when days of cover is 14 days or more and above minStock', () => {
  const products = [product({ id: 'p1', currentStock: 100, minStock: 5 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -10, createdAt: daysAgo(10) },
  ];
  const [rec] = buildRestockRecommendations({ products, movements, now: NOW });

  // avgDailyOut = 10/10 = 1/hari, daysOfCover = 100 hari -> aman
  assert.equal(rec.status, 'aman');
});

test('marks product as "belum ada histori" instead of inventing a trend when there is no movement data', () => {
  const products = [product({ id: 'p1', currentStock: 10, minStock: 5 })];
  const [rec] = buildRestockRecommendations({ products, movements: [], now: NOW });

  assert.equal(rec.status, 'belum ada histori');
  assert.equal(rec.avgDailyOut, null);
  assert.equal(rec.daysOfCover, null);
  assert.equal(rec.suggestedQty, null);
});

test('ignores movements outside the 90 day lookback window and movements for other products', () => {
  const products = [product({ id: 'p1', currentStock: 10, minStock: 5 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -50, createdAt: daysAgo(200) }, // too old
    { productId: 'other', type: 'SALE_OUT', qtyChange: -50, createdAt: daysAgo(5) }, // other product
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 20, createdAt: daysAgo(5) }, // not an OUT type
  ];
  const [rec] = buildRestockRecommendations({ products, movements, now: NOW });

  assert.equal(rec.status, 'belum ada histori');
});

// ---------------------------------------------------------------------------
// buildLowStockAlerts
// ---------------------------------------------------------------------------

test('buildLowStockAlerts only returns products at or below a positive minStock', () => {
  const products = [
    product({ id: 'p1', name: 'Di bawah minimum', currentStock: 2, minStock: 5 }),
    product({ id: 'p2', name: 'Aman', currentStock: 20, minStock: 5 }),
    product({ id: 'p3', name: 'Tidak dipantau minimum', currentStock: 0, minStock: 0 }),
  ];

  const alerts = buildLowStockAlerts(products);

  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].id, 'p1');
});

// ---------------------------------------------------------------------------
// detectReturnAnomalies
// ---------------------------------------------------------------------------

test('flags a product whose returns exceed 20% of qty sold within 90 days', () => {
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -100, createdAt: daysAgo(10) },
  ];
  const returns: InventoryReturnLite[] = [{ productId: 'p1', qty: 25, createdAt: daysAgo(5) }];

  const anomalies = detectReturnAnomalies({ movements, returns, now: NOW });

  assert.equal(anomalies.length, 1);
  assert.equal(anomalies[0].productId, 'p1');
  assert.equal(anomalies[0].returnRate, 0.25);
});

test('does not flag a product whose return rate is 20% or under', () => {
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -100, createdAt: daysAgo(10) },
  ];
  const returns: InventoryReturnLite[] = [{ productId: 'p1', qty: 20, createdAt: daysAgo(5) }];

  const anomalies = detectReturnAnomalies({ movements, returns, now: NOW });

  assert.equal(anomalies.length, 0);
});

// ---------------------------------------------------------------------------
// buildProfitContributors
// ---------------------------------------------------------------------------

test('computes margin contributors sorted by total margin descending, skipping products with no sales', () => {
  const products = [
    product({ id: 'p1', name: 'Untung tinggi', costPrice: 1000, sellPrice: 2000 }),
    product({ id: 'p2', name: 'Untung rendah', costPrice: 1000, sellPrice: 1100 }),
    product({ id: 'p3', name: 'Belum pernah terjual', costPrice: 1000, sellPrice: 5000 }),
  ];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -10, createdAt: daysAgo(5) },
    { productId: 'p2', type: 'SALE_OUT', qtyChange: -10, createdAt: daysAgo(5) },
  ];

  const contributors = buildProfitContributors({ products, movements, now: NOW });

  assert.equal(contributors.length, 2);
  assert.equal(contributors[0].productId, 'p1');
  assert.equal(contributors[0].marginTotal, 10_000);
  assert.equal(contributors[1].productId, 'p2');
  assert.equal(contributors.some((c) => c.productId === 'p3'), false);
});

// ---------------------------------------------------------------------------
// buildInventoryReply
// ---------------------------------------------------------------------------

test('buildInventoryReply is honest when there are no products yet (zero-data honesty)', () => {
  const reply = buildInventoryReply({ message: 'stok saya gimana', products: [], movements: [], returns: [], now: NOW });

  assert.match(reply, /belum ada produk/i);
  assert.match(reply, /AI Assistant/);
  assert.match(reply, /pratinjau/i);
});

test('buildInventoryReply is honest when products exist but there is no movement history at all', () => {
  const products = [product({ id: 'p1', currentStock: 10, minStock: 5 })];
  const reply = buildInventoryReply({ message: 'restock apa ya', products, movements: [], returns: [], now: NOW });

  assert.match(reply, /belum ada histori transaksi keluar/i);
  assert.doesNotMatch(reply, /rata-rata/i);
});

test('buildInventoryReply includes concrete restock recommendation, return anomaly, and profit numbers, plus the honesty caveat', () => {
  const products = [
    product({ id: 'p1', name: 'Beras 5kg', currentStock: 15, minStock: 5, costPrice: 60_000, sellPrice: 75_000 }),
  ];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -15, createdAt: daysAgo(5) },
  ];
  const returns: InventoryReturnLite[] = [{ productId: 'p1', qty: 5, createdAt: daysAgo(3) }];

  const reply = buildInventoryReply({ message: 'stok beras gimana', products, movements, returns, now: NOW });

  assert.match(reply, /Beras 5kg/);
  assert.match(reply, /kritis/);
  assert.match(reply, /sinyal potensi rugi\/salah catat/);
  assert.match(reply, /margin/i);
  assert.match(reply, /keputusan akhir tetap di tangan Anda/i);
});

// ---------------------------------------------------------------------------
// detectInventoryIntent -- kata kunci baru 10 Sep (stok mati/turnover/konsinyasi)
// ---------------------------------------------------------------------------

test('detects inventory intent for the new dead-stock / turnover / consignment keywords', () => {
  assert.equal(detectInventoryIntent('Ada stok mati gak bulan ini?'), true);
  assert.equal(detectInventoryIntent('produk mati apa yang perlu diprioritaskan?'), true);
  assert.equal(detectInventoryIntent('cek dead stock gudang'), true);
  assert.equal(detectInventoryIntent('produk mana yang gak laku'), true);
  assert.equal(detectInventoryIntent('barang ini tidak laku dari dulu'), true);
  assert.equal(detectInventoryIntent('berapa perputaran stok bulan ini'), true);
  assert.equal(detectInventoryIntent('turnover produk gimana'), true);
  assert.equal(detectInventoryIntent('berapa yang harus setor ke supplier'), true);
  assert.equal(detectInventoryIntent('produk titip jual yang mana aja'), true);
  assert.equal(detectInventoryIntent('rekap konsinyasi bulan ini'), true);
});

test('still does NOT collide with sales target prompts after the new keywords are added', () => {
  assert.equal(detectInventoryIntent('target penjualan 100 juta'), false);
  assert.equal(detectInventoryIntent('Tolong prediksi target penjualan sampai Desember'), false);
  assert.equal(detectInventoryIntent('target tahunan Rp 100 juta; Q1 Rp 15 juta'), false);
});

// ---------------------------------------------------------------------------
// buildDeadStock
// ---------------------------------------------------------------------------

test('buildDeadStock flags a product with stock but no SALE_OUT within the window, with idleDays from the last real sale', () => {
  const products = [product({ id: 'p1', name: 'Sirup Lama', currentStock: 20, costPrice: 10_000 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -5, createdAt: daysAgo(90) }, // di luar window 60 hari
  ];

  const [dead] = buildDeadStock({ products, movements, now: NOW, days: 60 });

  assert.equal(dead.productId, 'p1');
  assert.equal(dead.idleDays, 90);
  assert.equal(dead.deadValue, 20 * 10_000);
});

test('buildDeadStock uses idleDays = null (not a made-up number) when the product has never had a SALE_OUT at all', () => {
  const products = [product({ id: 'p1', name: 'Belum Pernah Laku', currentStock: 5 })];

  const [dead] = buildDeadStock({ products, movements: [], now: NOW });

  assert.equal(dead.idleDays, null);
});

test('buildDeadStock excludes a product that was sold within the lookback window', () => {
  const products = [product({ id: 'p1', currentStock: 10 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -2, createdAt: daysAgo(10) },
  ];

  const dead = buildDeadStock({ products, movements, now: NOW, days: 60 });

  assert.equal(dead.length, 0);
});

test('buildDeadStock excludes a product whose current stock is already 0 (that is "habis", not "mati")', () => {
  const products = [product({ id: 'p1', currentStock: 0 })];

  const dead = buildDeadStock({ products, movements: [], now: NOW });

  assert.equal(dead.length, 0);
});

// ---------------------------------------------------------------------------
// buildStockTurnover
// ---------------------------------------------------------------------------

test('buildStockTurnover computes qtySold / avgStock (avgStock = currentStock proxy)', () => {
  const products = [product({ id: 'p1', currentStock: 10 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -20, createdAt: daysAgo(5) },
  ];

  const [t] = buildStockTurnover({ products, movements, now: NOW });

  assert.equal(t.qtySold, 20);
  assert.equal(t.avgStock, 10);
  assert.equal(t.turnover, 2);
});

test('buildStockTurnover returns turnover = null when avgStock (current stock) is 0, instead of Infinity', () => {
  const products = [product({ id: 'p1', currentStock: 0 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -20, createdAt: daysAgo(5) },
  ];

  const [t] = buildStockTurnover({ products, movements, now: NOW });

  assert.equal(t.qtySold, 20);
  assert.equal(t.turnover, null);
});

test('buildStockTurnover ignores sales outside the days window', () => {
  const products = [product({ id: 'p1', currentStock: 10 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -20, createdAt: daysAgo(200) },
  ];

  const [t] = buildStockTurnover({ products, movements, now: NOW, days: 90 });

  assert.equal(t.qtySold, 0);
  assert.equal(t.turnover, 0);
});

// ---------------------------------------------------------------------------
// buildConsignmentSummary
// ---------------------------------------------------------------------------

test('buildConsignmentSummary computes amountDueToSupplier = qtySold * costPrice for CONSIGNED products only', () => {
  const products = [
    product({ id: 'p1', name: 'Titip Jual A', ownershipType: 'CONSIGNED', costPrice: 8_000 }),
    product({ id: 'p2', name: 'Punya Sendiri', ownershipType: 'OWNED', costPrice: 8_000 }),
  ];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -10, createdAt: daysAgo(5) },
    { productId: 'p2', type: 'SALE_OUT', qtyChange: -10, createdAt: daysAgo(5) },
  ];

  const summary = buildConsignmentSummary({ products, movements, now: NOW });

  assert.equal(summary.length, 1);
  assert.equal(summary[0].productId, 'p1');
  assert.equal(summary[0].qtySold, 10);
  assert.equal(summary[0].amountDueToSupplier, 80_000);
});

test('buildConsignmentSummary returns qtySold 0 (not omitted) for a CONSIGNED product with no sales in the window', () => {
  const products = [product({ id: 'p1', ownershipType: 'CONSIGNED', costPrice: 8_000 })];

  const [summary] = buildConsignmentSummary({ products, movements: [], now: NOW });

  assert.equal(summary.qtySold, 0);
  assert.equal(summary.amountDueToSupplier, 0);
});

// ---------------------------------------------------------------------------
// buildInventoryReply -- topik baru: stok mati, perputaran, konsinyasi
// ---------------------------------------------------------------------------

test('buildInventoryReply is honest about dead stock when the only product has stock but has never been sold (idleDays null, not a made-up number)', () => {
  const products = [product({ id: 'p1', currentStock: 10 })];
  const reply = buildInventoryReply({ message: 'ada stok mati gak', products, movements: [], returns: [], now: NOW });

  assert.match(reply, /Stok mati/);
  assert.match(reply, /belum pernah tercatat terjual sama sekali/i);
});

test('buildInventoryReply is honest about dead stock at the section level when no product currently has stock to evaluate at all', () => {
  const products = [product({ id: 'p1', currentStock: 0 })];
  const reply = buildInventoryReply({ message: 'ada stok mati gak', products, movements: [], returns: [], now: NOW });

  assert.match(reply, /belum ada penjualan tercatat dalam 60 hari, jadi stok mati belum bisa dinilai/i);
});

test('buildInventoryReply lists a dead stock product with its idle days and dead value', () => {
  const products = [product({ id: 'p1', name: 'Kopi Lama', currentStock: 15, costPrice: 5_000 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -3, createdAt: daysAgo(90) },
  ];
  const reply = buildInventoryReply({ message: 'stok mati apa aja', products, movements, returns: [], now: NOW });

  assert.match(reply, /Stok mati/);
  assert.match(reply, /Kopi Lama/);
  assert.match(reply, /idle 90 hari/);
});

test('buildInventoryReply reports stock turnover with a number when sales exist', () => {
  const products = [product({ id: 'p1', name: 'Teh Botol', currentStock: 10 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -20, createdAt: daysAgo(5) },
  ];
  const reply = buildInventoryReply({ message: 'perputaran stok gimana', products, movements, returns: [], now: NOW });

  assert.match(reply, /Perputaran stok/);
  assert.match(reply, /Teh Botol/);
  assert.match(reply, /2\.00x/);
});

test('buildInventoryReply shows the consignment section (with total due) when a CONSIGNED product has sales', () => {
  const products = [product({ id: 'p1', name: 'Rokok Titipan', ownershipType: 'CONSIGNED', costPrice: 15_000 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -4, createdAt: daysAgo(5) },
  ];
  const reply = buildInventoryReply({ message: 'setor ke supplier berapa', products, movements, returns: [], now: NOW });

  assert.match(reply, /Konsinyasi \/ titip jual/);
  assert.match(reply, /Rokok Titipan/);
  assert.match(reply, /Total harus disetor/);
});

test('buildInventoryReply is honest when a CONSIGNED product exists but has not sold in the window', () => {
  const products = [product({ id: 'p1', name: 'Rokok Titipan', ownershipType: 'CONSIGNED' })];
  const reply = buildInventoryReply({ message: 'ada titip jual gak', products, movements: [], returns: [], now: NOW });

  assert.match(reply, /belum ada penjualan produk titip jual/i);
});

test('buildInventoryReply omits the consignment section entirely when the workspace has no CONSIGNED products', () => {
  const products = [product({ id: 'p1', ownershipType: 'OWNED' })];
  const reply = buildInventoryReply({ message: 'stok gimana', products, movements: [], returns: [], now: NOW });

  assert.doesNotMatch(reply, /Konsinyasi/);
});

// ---------------------------------------------------------------------------
// detectInventoryIntent -- kata kunci baru 10 Sep (Distributor: kadaluarsa, per toko/
// per warung/pelanggan/outlet, reorder/titik pesan ulang)
// ---------------------------------------------------------------------------

test('detects inventory intent for expiry/customer/reorder keywords added for the Distributor segment', () => {
  assert.equal(detectInventoryIntent('Produk apa yang mau kadaluarsa minggu ini?'), true);
  assert.equal(detectInventoryIntent('cek barang expired dong'), true);
  // "restock" sudah jadi keyword lama -- dites tanpa itu supaya kata "per toko" yang
  // baru ditambahkan benar-benar yang menjaring, bukan kebetulan lolos dari kata lain.
  assert.equal(detectInventoryIntent('kebutuhan barang per toko dong minggu ini'), true);
  assert.equal(detectInventoryIntent('kebutuhan per warung apa aja'), true);
  assert.equal(detectInventoryIntent('rekap penjualan ke outlet mana yang paling laris'), true);
  assert.equal(detectInventoryIntent('kapan harus reorder barang ini'), true);
  assert.equal(detectInventoryIntent('titik pesan ulang produk kopi berapa'), true);
});

test('still does NOT collide with sales target prompts after the Distributor keywords are added', () => {
  assert.equal(detectInventoryIntent('target penjualan 100 juta'), false);
  assert.equal(detectInventoryIntent('Tolong prediksi target penjualan sampai Desember'), false);
});

// ---------------------------------------------------------------------------
// formatQtyWithPack
// ---------------------------------------------------------------------------

test('formatQtyWithPack shows the pack conversion when qty divides evenly into packSize', () => {
  assert.equal(formatQtyWithPack(90, 'pcs', 30, 'dus'), '90 pcs (3 dus)');
});

test('formatQtyWithPack shows a remainder when qty does not divide evenly', () => {
  assert.equal(formatQtyWithPack(95, 'pcs', 30, 'dus'), '95 pcs (3 dus + 5 pcs)');
});

test('formatQtyWithPack falls back to plain unit formatting when packUnit/packSize is missing or 1', () => {
  assert.equal(formatQtyWithPack(90, 'pcs', null, null), '90 pcs');
  assert.equal(formatQtyWithPack(90, 'pcs', 1, 'dus'), '90 pcs');
  assert.equal(formatQtyWithPack(90, 'pcs', undefined, undefined), '90 pcs');
});

test('formatQtyWithPack falls back to plain unit formatting when qty is smaller than one full pack', () => {
  assert.equal(formatQtyWithPack(5, 'pcs', 30, 'dus'), '5 pcs');
});

// ---------------------------------------------------------------------------
// buildReorderPoints (titik pesan ulang, lead-time proxy dari jarak antar PURCHASE_IN)
// ---------------------------------------------------------------------------

test('buildReorderPoints returns leadTimeDays and reorderPoint = null when a product has fewer than 2 PURCHASE_IN records ("lead time belum bisa diperkirakan")', () => {
  const products = [product({ id: 'p1', currentStock: 10 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -10, createdAt: daysAgo(10) },
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 20, createdAt: daysAgo(5) }, // hanya 1 PO
  ];
  const [rp] = buildReorderPoints({ products, movements, now: NOW });

  assert.equal(rp.avgDailyOut, 1);
  assert.equal(rp.leadTimeDays, null);
  assert.equal(rp.reorderPoint, null);
  assert.equal(rp.belowReorderPoint, false);
});

test('buildReorderPoints computes reorderPoint = avgDailyOut * leadTimeDays + avgDailyOut * safetyStockDays from 2+ PURCHASE_IN gaps', () => {
  const products = [product({ id: 'p1', currentStock: 5 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -20, createdAt: daysAgo(10) }, // avgDailyOut = 20/10 = 2/hari
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 50, createdAt: daysAgo(20) },
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 50, createdAt: daysAgo(10) }, // gap 10 hari
  ];
  const [rp] = buildReorderPoints({ products, movements, now: NOW, safetyStockDays: 3 });

  assert.equal(rp.avgDailyOut, 2);
  assert.equal(rp.leadTimeDays, 10);
  assert.equal(rp.reorderPoint, 2 * 10 + 2 * 3);
  assert.equal(rp.belowReorderPoint, true); // currentStock 5 <= reorderPoint 26
});

test('buildReorderPoints averages the gap across 3+ PURCHASE_IN records instead of only using the last gap', () => {
  const products = [product({ id: 'p1', currentStock: 100 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -10, createdAt: daysAgo(10) },
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 10, createdAt: daysAgo(40) },
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 10, createdAt: daysAgo(30) }, // gap 10
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 10, createdAt: daysAgo(10) }, // gap 20
  ];
  const [rp] = buildReorderPoints({ products, movements, now: NOW });

  assert.equal(rp.leadTimeDays, 15); // rata-rata (10 + 20) / 2
});

test('buildReorderPoints returns reorderPoint = null (not a guessed number) when there is no sales history at all, even with 2+ PURCHASE_IN', () => {
  const products = [product({ id: 'p1', currentStock: 10 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 10, createdAt: daysAgo(40) },
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 10, createdAt: daysAgo(10) },
  ];
  const [rp] = buildReorderPoints({ products, movements, now: NOW });

  assert.equal(rp.avgDailyOut, null);
  assert.equal(rp.leadTimeDays, 30);
  assert.equal(rp.reorderPoint, null);
});

// ---------------------------------------------------------------------------
// buildExpiryAlerts (kadaluarsa / FEFO)
// ---------------------------------------------------------------------------

function batch(overrides: Partial<InventoryBatchLite> = {}): InventoryBatchLite {
  return {
    id: 'b1',
    productId: 'p1',
    batchCode: 'BC-1',
    expiryDate: daysAgo(-10),
    qty: 20,
    product: { id: 'p1', name: 'Produk A', sku: 'SKU-A', unit: 'pcs' },
    ...overrides,
  };
}

test('buildExpiryAlerts marks a batch expiring in under 7 days as kritis', () => {
  const batches = [batch({ id: 'b1', expiryDate: daysAgo(-5) })]; // 5 hari lagi
  const [alert] = buildExpiryAlerts({ batches, now: NOW, days: 30 });

  assert.equal(alert.severity, 'kritis');
  assert.equal(alert.daysUntilExpiry, 5);
});

test('buildExpiryAlerts marks a batch expiring between 7 and 30 days as waspada', () => {
  const batches = [batch({ id: 'b1', expiryDate: daysAgo(-20) })]; // 20 hari lagi
  const [alert] = buildExpiryAlerts({ batches, now: NOW, days: 30 });

  assert.equal(alert.severity, 'waspada');
  assert.equal(alert.daysUntilExpiry, 20);
});

test('buildExpiryAlerts includes an already-expired batch as kritis instead of hiding it', () => {
  const batches = [batch({ id: 'b1', expiryDate: daysAgo(3) })]; // sudah lewat 3 hari
  const [alert] = buildExpiryAlerts({ batches, now: NOW, days: 30 });

  assert.equal(alert.severity, 'kritis');
  assert.equal(alert.daysUntilExpiry, -3);
});

test('buildExpiryAlerts excludes a batch that expires beyond the window (e.g. 90 days when window is 30)', () => {
  const batches = [batch({ id: 'b1', expiryDate: daysAgo(-90) })];
  const alerts = buildExpiryAlerts({ batches, now: NOW, days: 30 });

  assert.equal(alerts.length, 0);
});

test('buildExpiryAlerts sorts by soonest expiry first and falls back to productId when product join is missing', () => {
  const batches = [
    batch({ id: 'b1', expiryDate: daysAgo(-20), product: null, productId: 'p9' }),
    batch({ id: 'b2', expiryDate: daysAgo(-5) }),
  ];
  const alerts = buildExpiryAlerts({ batches, now: NOW, days: 30 });

  assert.deepEqual(alerts.map((a) => a.batchId), ['b2', 'b1']);
  assert.equal(alerts[1].productName, 'p9');
});

// ---------------------------------------------------------------------------
// buildRestockByCustomer (restock per pelanggan/toko -- Distributor)
// ---------------------------------------------------------------------------

function customer(overrides: Partial<InventoryCustomerLite> = {}): InventoryCustomerLite {
  return { id: 'c1', name: 'Toko Sumber Rejeki', area: 'Depok', type: 'WARUNG', ...overrides };
}

test('buildRestockByCustomer is honest (hasLinkedSales = false) when no SALE_OUT movement has a customerId', () => {
  const products = [product({ id: 'p1' })];
  const movements: InventoryMovementLite[] = [{ productId: 'p1', type: 'SALE_OUT', qtyChange: -10, createdAt: daysAgo(5) }];
  const result = buildRestockByCustomer({ products, movements, customers: [customer()], now: NOW });

  assert.equal(result.hasLinkedSales, false);
  assert.deepEqual(result.summaries, []);
});

test('buildRestockByCustomer groups qty per product per customer and computes qtyPerWeek + suggestedQtyNextVisit', () => {
  const products = [product({ id: 'p1', name: 'Rokok G', unit: 'bungkus' })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -14, createdAt: daysAgo(5), customerId: 'c1' },
  ];
  const result = buildRestockByCustomer({ products, movements, customers: [customer()], days: 14, now: NOW });

  assert.equal(result.hasLinkedSales, true);
  assert.equal(result.summaries.length, 1);
  const [summary] = result.summaries;
  assert.equal(summary.customerName, 'Toko Sumber Rejeki');
  assert.equal(summary.area, 'Depok');
  assert.equal(summary.lines[0].qtyTotal, 14);
  assert.equal(summary.lines[0].qtyPerWeek, 7); // 14 hari = 2 minggu, 14/2 = 7/minggu
  assert.equal(summary.lines[0].suggestedQtyNextVisit, 7);
});

test('buildRestockByCustomer ignores SALE_OUT movements without a customerId while still counting the ones that have one', () => {
  const products = [product({ id: 'p1' })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -100, createdAt: daysAgo(5) }, // tanpa customerId
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -10, createdAt: daysAgo(5), customerId: 'c1' },
  ];
  const result = buildRestockByCustomer({ products, movements, customers: [customer()], now: NOW });

  assert.equal(result.hasLinkedSales, true);
  assert.equal(result.summaries[0].lines[0].qtyTotal, 10);
});

test('buildRestockByCustomer falls back to raw id when a customer or product record is missing from the lookup lists', () => {
  const products: InventoryProductLite[] = [];
  const movements: InventoryMovementLite[] = [
    { productId: 'p-unknown', type: 'SALE_OUT', qtyChange: -5, createdAt: daysAgo(5), customerId: 'c-unknown' },
  ];
  const result = buildRestockByCustomer({ products, movements, customers: [], now: NOW });

  assert.equal(result.summaries[0].customerName, 'c-unknown');
  assert.equal(result.summaries[0].lines[0].productName, 'p-unknown');
});

// ---------------------------------------------------------------------------
// buildInventoryReply -- 4 topik baru Distributor (kadaluarsa, restock per pelanggan,
// reorder point, konversi kemasan)
// ---------------------------------------------------------------------------

test('buildInventoryReply omits the batches/customers sections entirely when those params are not passed (backward compatible)', () => {
  const products = [product({ id: 'p1' })];
  const reply = buildInventoryReply({ message: 'stok gimana', products, movements: [], returns: [], now: NOW });

  assert.doesNotMatch(reply, /Kadaluarsa/);
  assert.doesNotMatch(reply, /Restock per pelanggan/);
});

test('buildInventoryReply shows the expiry section honestly when batches is an empty array', () => {
  const products = [product({ id: 'p1' })];
  const reply = buildInventoryReply({ message: 'ada kadaluarsa gak', products, movements: [], returns: [], batches: [], now: NOW });

  assert.match(reply, /Tidak ada batch yang mendekati kadaluarsa/);
});

test('buildInventoryReply lists an expiring batch with FEFO wording when batches has a critical item', () => {
  const products = [product({ id: 'p1', name: 'Susu Kotak' })];
  const batches = [batch({ id: 'b1', productId: 'p1', expiryDate: daysAgo(-3), product: { id: 'p1', name: 'Susu Kotak', unit: 'pcs' } })];
  const reply = buildInventoryReply({ message: 'produk apa yang mau kadaluarsa', products, movements: [], returns: [], batches, now: NOW });

  assert.match(reply, /Susu Kotak/);
  assert.match(reply, /kadaluarsa < 7 hari/);
  assert.match(reply, /prioritaskan jual segera/);
});

test('buildInventoryReply is honest about restock per customer when customers is passed but no sale is linked', () => {
  const products = [product({ id: 'p1' })];
  const reply = buildInventoryReply({
    message: 'restock per toko gimana',
    products,
    movements: [],
    returns: [],
    customers: [customer()],
    now: NOW,
  });

  assert.match(reply, /belum dikaitkan ke pelanggan/i);
});

test('buildInventoryReply shows a concrete restock-per-customer line when a SALE_OUT is linked to a customer', () => {
  const products = [product({ id: 'p1', name: 'Rokok G', unit: 'bungkus' })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -14, createdAt: daysAgo(5), customerId: 'c1' },
  ];
  const reply = buildInventoryReply({
    message: 'restock per toko gimana',
    products,
    movements,
    returns: [],
    customers: [customer()],
    now: NOW,
  });

  assert.match(reply, /Restock per pelanggan\/toko/);
  assert.match(reply, /Toko Sumber Rejeki \(Depok\)/);
  assert.match(reply, /Rokok G/);
});

test('buildInventoryReply reports a reorder point recommendation once 2+ PURCHASE_IN and sales history exist', () => {
  const products = [product({ id: 'p1', name: 'Kopi Sachet', currentStock: 5 })];
  const movements: InventoryMovementLite[] = [
    { productId: 'p1', type: 'SALE_OUT', qtyChange: -20, createdAt: daysAgo(10) },
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 50, createdAt: daysAgo(20) },
    { productId: 'p1', type: 'PURCHASE_IN', qtyChange: 50, createdAt: daysAgo(10) },
  ];
  const reply = buildInventoryReply({ message: 'kapan harus reorder', products, movements, returns: [], now: NOW });

  assert.match(reply, /Titik pesan ulang/);
  assert.match(reply, /Kopi Sachet/);
  assert.match(reply, /saatnya pesan ulang ke supplier/);
});

test('buildInventoryReply is honest about the reorder point when there is not enough PURCHASE_IN history', () => {
  const products = [product({ id: 'p1', currentStock: 5 })];
  const movements: InventoryMovementLite[] = [{ productId: 'p1', type: 'SALE_OUT', qtyChange: -20, createdAt: daysAgo(10) }];
  const reply = buildInventoryReply({ message: 'kapan harus reorder', products, movements, returns: [], now: NOW });

  assert.match(reply, /Belum bisa dihitung/);
});

test('buildInventoryReply shows the pack-conversion section only for products that have packUnit set', () => {
  const products = [
    product({ id: 'p1', name: 'Beras Karung', currentStock: 90, packSize: 30, packUnit: 'dus' }),
    product({ id: 'p2', name: 'Sabun Batang', currentStock: 10 }), // tanpa pack
  ];
  const reply = buildInventoryReply({ message: 'stok dus berapa', products, movements: [], returns: [], now: NOW });

  assert.match(reply, /Konversi kemasan/);
  assert.match(reply, /Beras Karung: stok 90 pcs \(3 dus\)/);
  // "Sabun Batang" boleh muncul di section LAIN (mis. stok mati -- keduanya memang tidak
  // punya histori jual), tapi TIDAK boleh muncul di dalam section "Konversi kemasan" itu
  // sendiri karena produk itu tidak mengisi packUnit.
  const packSection = reply.split('**Konversi kemasan**')[1]?.split('\n\n')[0] ?? '';
  assert.doesNotMatch(packSection, /Sabun Batang/);
});

test('buildInventoryReply omits the pack-conversion section entirely when no product has packUnit set', () => {
  const products = [product({ id: 'p1' })];
  const reply = buildInventoryReply({ message: 'stok gimana', products, movements: [], returns: [], now: NOW });

  assert.doesNotMatch(reply, /Konversi kemasan/);
});
