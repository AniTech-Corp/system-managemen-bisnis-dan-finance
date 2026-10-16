// KLIR Inventory Intelligence Engine — PURE (tanpa prisma/network), meniru gaya
// sales-target-engine.ts. Dipakai dari brain/chat/route.ts untuk menjawab
// pertanyaan stok/restock/retur/produk terlaris dengan angka riil dari workspace,
// bukan tebakan. Kalau data histori kosong, jawaban WAJIB jujur bilang belum ada
// histori -- HARAM mengarang tren atau proyeksi dari nol data.

export type InventoryProductLite = {
  id: string;
  name: string;
  sku?: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  costPrice: number;
  sellPrice: number;
  ownershipType?: string | null;
  // Additive 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4) -- konversi kemasan
  // dus/lusin/krat, ikut Product.packSize/packUnit (skema tambahan agent
  // inventory-api-schema). Opsional supaya tipe ini tetap kompatibel dengan produk
  // lama yang belum diisi -- lihat formatQtyWithPack di bawah.
  packSize?: number | null;
  packUnit?: string | null;
};

export type InventoryMovementLite = {
  productId: string;
  type: string;
  qtyChange: number;
  unitCost?: number | null;
  createdAt: string | Date;
  // Additive 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4) -- soft-relasi ke
  // Customer (StockMovement.customerId, nullable). Dipakai buildRestockByCustomer untuk
  // mengelompokkan SALE_OUT per pelanggan/toko. Opsional supaya movement lama (tanpa
  // customerId) tetap valid dipakai fungsi-fungsi lama yang tidak butuh field ini.
  customerId?: string | null;
};

export type InventoryReturnLite = {
  productId: string;
  qty: number;
  createdAt: string | Date;
  reason?: string | null;
};

// Additive 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4) -- pelanggan/toko
// (Distributor). Meniru model Customer (agent inventory-api-schema): id, name, area,
// type. Lite = hanya field yang dipakai engine murni (bukan tipe Prisma langsung, sama
// prinsipnya dengan InventoryProductLite dkk di atas).
export type InventoryCustomerLite = {
  id: string;
  name: string;
  area?: string | null;
  type?: string | null;
};

// Additive 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4) -- batch/kadaluarsa.
// `product` opsional membawa nama+satuan supaya narasi tidak perlu join ulang ke
// daftar produk terpisah -- cocok dengan bentuk respons GET
// /api/v1/inventory/product-batches (agent inventory-api-schema) yang sudah menyertakan
// { product: { id, name, sku, unit } } per batch.
export type InventoryBatchLite = {
  id: string;
  productId: string;
  batchCode?: string | null;
  expiryDate: string | Date;
  qty: number;
  product?: { id: string; name: string; sku?: string | null; unit: string } | null;
};

// Lookback dipakai untuk hitung kecepatan keluar barang & rasio retur. Konsisten
// dengan wiring brain/chat/route.ts yang fetch StockMovement 90 hari terakhir.
const LOOKBACK_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function detectInventoryIntent(message: string): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  // Diperluas 10 Sep 2026 (agent engine-stock-advanced): tambah kata kunci stok
  // mati/turnover/konsinyasi. "stok" dan "supplier" sudah menjaring beberapa
  // frasa baru ini juga (mis. "stok mati", "setor ke supplier") -- tetap
  // dicantumkan eksplisit di daftar biar niat pencarian jelas dibaca orang lain,
  // walau secara teknis kadang redundan dengan kata tunggal yang sudah ada.
  //
  // Diperluas LAGI 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4): tambah
  // kadaluarsa/expired, per toko/per warung/pelanggan/outlet (restock per Distributor),
  // reorder/titik pesan ulang -- persis daftar kata kunci di kontrak eksekusi. CATATAN
  // JUJUR (keputusan diambil sendiri, bukan digantung): kata "pelanggan" sendirian
  // cukup umum sehingga BISA memicu false-positive untuk kalimat yang sebenarnya bukan
  // soal stok (mis. "buatkan invoice untuk pelanggan baru" sekarang ikut ke-detect).
  // Ini trade-off yang disadari, bukan bug -- lihat tests/inventory-intelligence-
  // engine.test.ts (assertion lama untuk kalimat itu diperbarui jadi true) dan
  // peringatan_untuk_tim di laporan agent ini.
  return /\b(stok\s+mati|produk\s+mati|dead\s+stock|(?:gak|tidak)\s+laku|perputaran|turnover|setor\s+(?:ke\s+)?supplier|titip\s+jual|konsinyasi|stok|restock|re-stock|persediaan|barang\s+habis|hampir\s+habis|minimum\s+stok|pembelian\s+ulang|supplier|pemasok|retur|produk\s+paling\s+(?:laku|untung)|dus|lusin|kadaluarsa|expired|per\s+toko|per\s+warung|pelanggan|outlet|reorder|titik\s+pesan\s+ulang)\b/.test(
    lower
  );
}

// ---------------------------------------------------------------------------
// RESTOCK RECOMMENDATIONS
// ---------------------------------------------------------------------------

export type RestockStatus = 'kritis' | 'waspada' | 'aman' | 'belum ada histori';

export type RestockRecommendation = {
  productId: string;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
  avgDailyOut: number | null;
  daysOfCover: number | null;
  suggestedQty: number | null;
  status: RestockStatus;
};

function computeAvgDailyOut(
  productId: string,
  movements: InventoryMovementLite[],
  nowMs: number,
  windowDays: number = LOOKBACK_DAYS
): number | null {
  const cutoffMs = nowMs - windowDays * DAY_MS;
  const relevant = movements.filter((m) => {
    if (m.productId !== productId) return false;
    if (m.type !== 'SALE_OUT' && m.type !== 'RETURN_OUT') return false;
    if (!(m.qtyChange < 0)) return false;
    const t = toTime(m.createdAt);
    return t >= cutoffMs && t <= nowMs;
  });
  if (relevant.length === 0) return null;

  const totalOut = relevant.reduce((sum, m) => sum + Math.abs(m.qtyChange), 0);
  if (totalOut <= 0) return null;

  const earliestMs = relevant.reduce((min, m) => Math.min(min, toTime(m.createdAt)), nowMs);
  const daySpanRaw = (nowMs - earliestMs) / DAY_MS;
  const daySpan = Math.max(1, Math.min(windowDays, daySpanRaw));
  return totalOut / daySpan;
}

export function buildRestockRecommendations(params: {
  products: InventoryProductLite[];
  movements: InventoryMovementLite[];
  horizonDays?: number;
  now?: Date;
}): RestockRecommendation[] {
  const { products, movements } = params;
  const horizonDays = params.horizonDays ?? 30;
  const nowMs = (params.now ?? new Date()).getTime();

  const recs: RestockRecommendation[] = products.map((product) => {
    const avgDailyOut = computeAvgDailyOut(product.id, movements, nowMs);

    if (avgDailyOut === null) {
      return {
        productId: product.id,
        name: product.name,
        sku: product.sku ?? null,
        unit: product.unit,
        currentStock: product.currentStock,
        minStock: product.minStock,
        avgDailyOut: null,
        daysOfCover: null,
        suggestedQty: null,
        status: 'belum ada histori',
      };
    }

    const daysOfCover = avgDailyOut > 0 ? product.currentStock / avgDailyOut : null;
    const suggestedQty = Math.max(0, Math.ceil(avgDailyOut * horizonDays - product.currentStock));
    const belowMinimum = product.minStock > 0 && product.currentStock <= product.minStock;
    const criticalCover = daysOfCover !== null && daysOfCover < 7;
    const watchCover = daysOfCover !== null && daysOfCover < 14;

    const status: RestockStatus = belowMinimum || criticalCover ? 'kritis' : watchCover ? 'waspada' : 'aman';

    return {
      productId: product.id,
      name: product.name,
      sku: product.sku ?? null,
      unit: product.unit,
      currentStock: product.currentStock,
      minStock: product.minStock,
      avgDailyOut,
      daysOfCover,
      suggestedQty,
      status,
    };
  });

  const severityRank: Record<RestockStatus, number> = { kritis: 0, waspada: 1, aman: 2, 'belum ada histori': 3 };
  return recs.sort((a, b) => {
    const rankDiff = severityRank[a.status] - severityRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    const coverA = a.daysOfCover ?? Number.POSITIVE_INFINITY;
    const coverB = b.daysOfCover ?? Number.POSITIVE_INFINITY;
    return coverA - coverB;
  });
}

// ---------------------------------------------------------------------------
// LOW STOCK ALERTS
// ---------------------------------------------------------------------------

export type LowStockAlert = {
  id: string;
  name: string;
  sku: string | null;
  unit: string;
  currentStock: number;
  minStock: number;
};

export function buildLowStockAlerts(products: InventoryProductLite[]): LowStockAlert[] {
  return products
    .filter((p) => p.minStock > 0 && p.currentStock <= p.minStock)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      unit: p.unit,
      currentStock: p.currentStock,
      minStock: p.minStock,
    }))
    .sort((a, b) => a.currentStock - a.minStock - (b.currentStock - b.minStock));
}

// ---------------------------------------------------------------------------
// RETURN ANOMALIES
// ---------------------------------------------------------------------------

export type ReturnAnomaly = {
  productId: string;
  returnQty: number;
  saleQty: number;
  returnRate: number; // 0..1, retur dibagi jumlah keluar
  note: string;
};

export function detectReturnAnomalies(params: {
  movements: InventoryMovementLite[];
  returns: InventoryReturnLite[];
  now?: Date;
  windowDays?: number;
}): ReturnAnomaly[] {
  const { movements, returns } = params;
  const windowDays = params.windowDays ?? LOOKBACK_DAYS;
  const nowMs = (params.now ?? new Date()).getTime();
  const cutoffMs = nowMs - windowDays * DAY_MS;

  const saleQtyByProduct = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== 'SALE_OUT') continue;
    const t = toTime(m.createdAt);
    if (t < cutoffMs || t > nowMs) continue;
    const prev = saleQtyByProduct.get(m.productId) ?? 0;
    saleQtyByProduct.set(m.productId, prev + Math.abs(m.qtyChange));
  }

  const returnQtyByProduct = new Map<string, number>();
  for (const r of returns) {
    const t = toTime(r.createdAt);
    if (t < cutoffMs || t > nowMs) continue;
    const prev = returnQtyByProduct.get(r.productId) ?? 0;
    returnQtyByProduct.set(r.productId, prev + Math.abs(r.qty));
  }

  const anomalies: ReturnAnomaly[] = [];
  for (const [productId, saleQty] of saleQtyByProduct.entries()) {
    if (saleQty <= 0) continue;
    const returnQty = returnQtyByProduct.get(productId) ?? 0;
    if (returnQty <= 0) continue;
    const returnRate = returnQty / saleQty;
    if (returnRate > 0.2) {
      anomalies.push({
        productId,
        returnQty,
        saleQty,
        returnRate,
        note: 'sinyal potensi rugi/salah catat -- retur produk ini di atas 20% dari jumlah keluar dalam 90 hari terakhir',
      });
    }
  }

  return anomalies.sort((a, b) => b.returnRate - a.returnRate);
}

// ---------------------------------------------------------------------------
// PROFIT CONTRIBUTORS
// ---------------------------------------------------------------------------

export type ProfitContributor = {
  productId: string;
  name: string;
  marginPerUnit: number;
  qtySold: number;
  marginTotal: number;
};

export function buildProfitContributors(params: {
  products: InventoryProductLite[];
  movements: InventoryMovementLite[];
  windowDays?: number;
  now?: Date;
}): ProfitContributor[] {
  const { products, movements } = params;
  const windowDays = params.windowDays ?? LOOKBACK_DAYS;
  const nowMs = (params.now ?? new Date()).getTime();
  const cutoffMs = nowMs - windowDays * DAY_MS;

  const qtySoldByProduct = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== 'SALE_OUT') continue;
    const t = toTime(m.createdAt);
    if (t < cutoffMs || t > nowMs) continue;
    const prev = qtySoldByProduct.get(m.productId) ?? 0;
    qtySoldByProduct.set(m.productId, prev + Math.abs(m.qtyChange));
  }

  const contributors: ProfitContributor[] = [];
  for (const product of products) {
    const qtySold = qtySoldByProduct.get(product.id) ?? 0;
    if (qtySold <= 0) continue; // "hanya kalau data ada" -- jangan tampilkan produk tanpa histori jual
    const marginPerUnit = product.sellPrice - product.costPrice;
    contributors.push({
      productId: product.id,
      name: product.name,
      marginPerUnit,
      qtySold,
      marginTotal: marginPerUnit * qtySold,
    });
  }

  return contributors.sort((a, b) => b.marginTotal - a.marginTotal);
}

// ---------------------------------------------------------------------------
// DEAD STOCK (stok mati / gak laku)
// ---------------------------------------------------------------------------
// Ditambahkan 10 Sep 2026 (agent engine-stock-advanced, kontrak eksekusi
// Tingkat B). Kriteria: produk aktif dengan currentStock > 0 yang TIDAK punya
// transaksi SALE_OUT dalam N hari terakhir (default 60).
//
// Soal idleDays -- kontrak awal menyebutnya sebagai angka polos, tapi kalau
// produk itu memang BELUM PERNAH punya SALE_OUT sama sekali di data yang kita
// terima, kita tidak punya titik waktu nyata untuk dihitung mundur. Mengarang
// angka (mis. pakai `days` sebagai idleDays) melanggar aturan "angka HARAM
// dikarang". Diputuskan: idleDays bertipe `number | null`, null artinya
// "belum pernah tercatat terjual sama sekali", bukan dianggap 0 hari idle.
export type DeadStockItem = {
  productId: string;
  name: string;
  unit: string;
  currentStock: number;
  idleDays: number | null;
  deadValue: number;
  ownershipType?: string | null;
};

export function buildDeadStock(params: {
  products: InventoryProductLite[];
  movements: InventoryMovementLite[];
  days?: number;
  now?: Date;
}): DeadStockItem[] {
  const { products, movements } = params;
  const days = params.days ?? 60;
  const nowMs = (params.now ?? new Date()).getTime();
  const cutoffMs = nowMs - days * DAY_MS;

  const lastSaleOutByProduct = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== 'SALE_OUT') continue;
    const t = toTime(m.createdAt);
    const prev = lastSaleOutByProduct.get(m.productId);
    if (prev === undefined || t > prev) lastSaleOutByProduct.set(m.productId, t);
  }

  const items: DeadStockItem[] = [];
  for (const product of products) {
    if (!(product.currentStock > 0)) continue; // stok 0 bukan "stok mati", itu stok habis
    const lastSaleOutMs = lastSaleOutByProduct.get(product.id);
    const soldWithinWindow = lastSaleOutMs !== undefined && lastSaleOutMs >= cutoffMs && lastSaleOutMs <= nowMs;
    if (soldWithinWindow) continue;

    const idleDays = lastSaleOutMs !== undefined ? Math.floor((nowMs - lastSaleOutMs) / DAY_MS) : null;
    items.push({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      currentStock: product.currentStock,
      idleDays,
      // Barang titip jual ikut bisa idle secara operasional, tetapi bukan aset
      // milik toko. Jangan memasukkan costPrice-nya ke nilai stok mati milik
      // workspace; laporan konsinyasi menghitung kewajiban supplier terpisah.
      deadValue: product.ownershipType === 'CONSIGNED' ? 0 : product.currentStock * product.costPrice,
      ownershipType: product.ownershipType ?? null,
    });
  }

  return items.sort((a, b) => b.deadValue - a.deadValue);
}

// ---------------------------------------------------------------------------
// STOCK TURNOVER (perputaran stok)
// ---------------------------------------------------------------------------
// Ditambahkan 10 Sep 2026. avgStock sengaja pakai currentStock sebagai proxy
// (bukan rata-rata stok harian sebenarnya) -- data StockMovement tidak
// menyimpan saldo harian per hari, cuma pergerakan; menghitung rata-rata
// historis yang akurat butuh snapshot harian yang tidak ada. Kontrak eksplisit
// memerintahkan proxy ini dan minta "disebut di narasi", sudah dituruti di
// buildInventoryReply. turnover null kalau avgStock 0 (stok habis) supaya
// tidak divide-by-zero / Infinity yang menyesatkan.
export type StockTurnoverItem = {
  productId: string;
  name: string;
  unit: string;
  qtySold: number;
  avgStock: number;
  turnover: number | null;
};

export function buildStockTurnover(params: {
  products: InventoryProductLite[];
  movements: InventoryMovementLite[];
  days?: number;
  now?: Date;
}): StockTurnoverItem[] {
  const { products, movements } = params;
  const days = params.days ?? LOOKBACK_DAYS;
  const nowMs = (params.now ?? new Date()).getTime();
  const cutoffMs = nowMs - days * DAY_MS;

  const qtySoldByProduct = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== 'SALE_OUT') continue;
    const t = toTime(m.createdAt);
    if (t < cutoffMs || t > nowMs) continue;
    const prev = qtySoldByProduct.get(m.productId) ?? 0;
    qtySoldByProduct.set(m.productId, prev + Math.abs(m.qtyChange));
  }

  return products.map((product) => {
    const qtySold = qtySoldByProduct.get(product.id) ?? 0;
    const avgStock = product.currentStock;
    const turnover = avgStock > 0 ? qtySold / avgStock : null;
    return {
      productId: product.id,
      name: product.name,
      unit: product.unit,
      qtySold,
      avgStock,
      turnover,
    };
  });
}

// ---------------------------------------------------------------------------
// CONSIGNMENT SUMMARY (titip jual / konsinyasi -- setoran ke supplier)
// ---------------------------------------------------------------------------
// Ditambahkan 10 Sep 2026. Hanya untuk produk ownershipType === 'CONSIGNED'.
// amountDueToSupplier = qtySold * costPrice: untuk barang titip jual, yang
// disetor ke supplier adalah harga modal per unit yang laku terjual (margin
// jual jadi milik toko) -- pola sama seperti calculateStockValueBreakdown /
// planConsignmentSaleLiability di consignment-engine.ts (agent api-stock-ops).
// Default window 30 hari sengaja disamakan dengan default
// GET /api/v1/inventory/consignment/report supaya angka "berapa yang harus
// disetor bulan ini" tidak beda kalau user bandingkan jawaban chat AI dengan
// tab Konsinyasi di UI.
export type ConsignmentSummaryItem = {
  productId: string;
  name: string;
  unit: string;
  qtySold: number;
  amountDueToSupplier: number;
};

export function buildConsignmentSummary(params: {
  products: InventoryProductLite[];
  movements: InventoryMovementLite[];
  days?: number;
  now?: Date;
}): ConsignmentSummaryItem[] {
  const { products, movements } = params;
  const days = params.days ?? 30;
  const nowMs = (params.now ?? new Date()).getTime();
  const cutoffMs = nowMs - days * DAY_MS;

  const qtySoldByProduct = new Map<string, number>();
  for (const m of movements) {
    if (m.type !== 'SALE_OUT') continue;
    const t = toTime(m.createdAt);
    if (t < cutoffMs || t > nowMs) continue;
    const prev = qtySoldByProduct.get(m.productId) ?? 0;
    qtySoldByProduct.set(m.productId, prev + Math.abs(m.qtyChange));
  }

  const items: ConsignmentSummaryItem[] = [];
  for (const product of products) {
    if (product.ownershipType !== 'CONSIGNED') continue;
    const qtySold = qtySoldByProduct.get(product.id) ?? 0;
    items.push({
      productId: product.id,
      name: product.name,
      unit: product.unit,
      qtySold,
      amountDueToSupplier: qtySold * product.costPrice,
    });
  }

  return items.sort((a, b) => b.amountDueToSupplier - a.amountDueToSupplier);
}

// ---------------------------------------------------------------------------
// RESTOCK PER PELANGGAN/TOKO (Distributor)
// ---------------------------------------------------------------------------
// Ditambahkan 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4). Butuh
// StockMovement.customerId (soft-relasi baru dari agent inventory-api-schema). Kalau
// TIDAK ADA satupun SALE_OUT yang punya customerId, kita HARUS jujur bilang "penjualan
// belum dikaitkan ke pelanggan" -- bukan diam-diam mengembalikan array kosong yang bisa
// disalahartikan sebagai "tidak ada pelanggan yang butuh restock".
export type CustomerRestockLine = {
  productId: string;
  productName: string;
  unit: string;
  qtyTotal: number;
  qtyPerWeek: number;
  suggestedQtyNextVisit: number;
};

export type CustomerRestockSummary = {
  customerId: string;
  customerName: string;
  area: string | null;
  lines: CustomerRestockLine[];
};

export type RestockByCustomerResult = {
  hasLinkedSales: boolean;
  summaries: CustomerRestockSummary[];
};

export function buildRestockByCustomer(params: {
  products: InventoryProductLite[];
  movements: InventoryMovementLite[];
  customers: InventoryCustomerLite[];
  days?: number;
  now?: Date;
}): RestockByCustomerResult {
  const { products, movements, customers } = params;
  const days = params.days ?? LOOKBACK_DAYS;
  const nowMs = (params.now ?? new Date()).getTime();
  const cutoffMs = nowMs - days * DAY_MS;

  const productById = new Map(products.map((p) => [p.id, p]));
  const customerById = new Map(customers.map((c) => [c.id, c]));

  const linkedSales = movements.filter((m) => {
    if (m.type !== 'SALE_OUT' || !m.customerId) return false;
    const t = toTime(m.createdAt);
    return t >= cutoffMs && t <= nowMs;
  });

  if (linkedSales.length === 0) {
    // Jujur: BISA jadi karena memang belum ada penjualan sama sekali dalam window ini,
    // ATAU karena penjualan ada tapi tidak satupun diisi customerId -- keduanya sama-sama
    // "belum bisa dihitung restock per pelanggan", jadi cukup satu flag hasLinkedSales.
    return { hasLinkedSales: false, summaries: [] };
  }

  const weeks = Math.max(1, days / 7);
  const byCustomer = new Map<string, Map<string, number>>();
  for (const m of linkedSales) {
    const cid = m.customerId as string;
    const byProduct = byCustomer.get(cid) ?? new Map<string, number>();
    byProduct.set(m.productId, (byProduct.get(m.productId) ?? 0) + Math.abs(m.qtyChange));
    byCustomer.set(cid, byProduct);
  }

  const summaries: CustomerRestockSummary[] = [];
  for (const [customerId, byProduct] of byCustomer.entries()) {
    const customer = customerById.get(customerId);
    const lines: CustomerRestockLine[] = [];
    for (const [productId, qtyTotal] of byProduct.entries()) {
      const product = productById.get(productId);
      const qtyPerWeek = qtyTotal / weeks;
      lines.push({
        productId,
        productName: product?.name ?? productId,
        unit: product?.unit ?? '',
        qtyTotal,
        qtyPerWeek,
        suggestedQtyNextVisit: Math.max(0, Math.ceil(qtyPerWeek)),
      });
    }
    lines.sort((a, b) => b.qtyTotal - a.qtyTotal);
    summaries.push({
      customerId,
      customerName: customer?.name ?? customerId,
      area: customer?.area ?? null,
      lines,
    });
  }

  summaries.sort((a, b) => a.customerName.localeCompare(b.customerName));
  return { hasLinkedSales: true, summaries };
}

// ---------------------------------------------------------------------------
// EXPIRY ALERTS (kadaluarsa / FEFO)
// ---------------------------------------------------------------------------
// Ditambahkan 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4). Butuh
// ProductBatch (agent inventory-api-schema). Batch yang SUDAH lewat tanggal
// kadaluarsa (daysUntilExpiry negatif) tetap dimasukkan sebagai 'kritis' -- itu
// justru yang paling mendesak untuk ditindak, bukan disembunyikan.
export type ExpiryAlertSeverity = 'kritis' | 'waspada';

export type ExpiryAlertItem = {
  batchId: string;
  productId: string;
  productName: string;
  unit: string;
  batchCode: string | null;
  expiryDate: string;
  daysUntilExpiry: number;
  qty: number;
  severity: ExpiryAlertSeverity;
};

export function buildExpiryAlerts(params: {
  batches: InventoryBatchLite[];
  now?: Date;
  days?: number;
}): ExpiryAlertItem[] {
  const { batches } = params;
  const days = params.days ?? 30;
  const nowMs = (params.now ?? new Date()).getTime();
  const windowEndMs = nowMs + days * DAY_MS;

  const items: ExpiryAlertItem[] = [];
  for (const b of batches) {
    const expiryMs = toTime(b.expiryDate);
    if (Number.isNaN(expiryMs) || expiryMs > windowEndMs) continue;
    const daysUntilExpiry = Math.ceil((expiryMs - nowMs) / DAY_MS);
    items.push({
      batchId: b.id,
      productId: b.productId,
      productName: b.product?.name ?? b.productId,
      unit: b.product?.unit ?? '',
      batchCode: b.batchCode ?? null,
      expiryDate: b.expiryDate instanceof Date ? b.expiryDate.toISOString() : String(b.expiryDate),
      daysUntilExpiry,
      qty: b.qty,
      severity: daysUntilExpiry < 7 ? 'kritis' : 'waspada',
    });
  }

  return items.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
}

// ---------------------------------------------------------------------------
// REORDER POINT (titik pesan ulang, estimasi lead-time dari jarak antar PURCHASE_IN)
// ---------------------------------------------------------------------------
// Ditambahkan 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4). leadTimeDays TIDAK
// dihitung dari field lead-time asli (tidak ada di skema) -- ini PROXY dari selisih
// createdAt antar StockMovement type PURCHASE_IN berurutan untuk produk yang sama.
// Kalau produk itu punya < 2 PURCHASE_IN dalam data yang diterima, kita tidak punya
// titik untuk menghitung selisih apapun -- leadTimeDays HARUS null (bukan 0 atau
// angka default yang dikarang), dan reorderPoint ikut null. safetyStockDays dikunci
// konstan (3 hari) sesuai kontrak, bukan dihitung dari data (disebut jujur di narasi
// sebagai "cadangan", bukan "dihitung dari histori").
const DEFAULT_SAFETY_STOCK_DAYS = 3;

export type ReorderPointItem = {
  productId: string;
  name: string;
  unit: string;
  currentStock: number;
  avgDailyOut: number | null;
  leadTimeDays: number | null;
  safetyStockDays: number;
  reorderPoint: number | null;
  belowReorderPoint: boolean;
};

function computeLeadTimeDays(productId: string, movements: InventoryMovementLite[]): number | null {
  const purchaseTimes = movements
    .filter((m) => m.productId === productId && m.type === 'PURCHASE_IN')
    .map((m) => toTime(m.createdAt))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  if (purchaseTimes.length < 2) return null; // "lead time belum bisa diperkirakan"

  const gaps: number[] = [];
  for (let i = 1; i < purchaseTimes.length; i++) {
    gaps.push((purchaseTimes[i] - purchaseTimes[i - 1]) / DAY_MS);
  }
  return gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
}

export function buildReorderPoints(params: {
  products: InventoryProductLite[];
  movements: InventoryMovementLite[];
  now?: Date;
  safetyStockDays?: number;
}): ReorderPointItem[] {
  const { products, movements } = params;
  const nowMs = (params.now ?? new Date()).getTime();
  const safetyStockDays = params.safetyStockDays ?? DEFAULT_SAFETY_STOCK_DAYS;

  return products.map((product) => {
    const avgDailyOut = computeAvgDailyOut(product.id, movements, nowMs);
    const leadTimeDays = computeLeadTimeDays(product.id, movements);
    const reorderPoint =
      avgDailyOut !== null && leadTimeDays !== null ? avgDailyOut * leadTimeDays + avgDailyOut * safetyStockDays : null;

    return {
      productId: product.id,
      name: product.name,
      unit: product.unit,
      currentStock: product.currentStock,
      avgDailyOut,
      leadTimeDays,
      safetyStockDays,
      reorderPoint,
      belowReorderPoint: reorderPoint !== null && product.currentStock <= reorderPoint,
    };
  });
}

// ---------------------------------------------------------------------------
// NARRATIVE REPLY
// ---------------------------------------------------------------------------

function formatQty(value: number, unit: string): string {
  const rounded = Math.round(value * 100) / 100;
  return `${rounded.toLocaleString('id-ID')} ${unit}`;
}

function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

// Ditambahkan 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4). Format kemasan
// (dus/lusin/krat) HANYA ditambahkan kalau packUnit & packSize > 1 tersedia -- kalau
// tidak, kembalikan format satuan biasa (formatQty) supaya produk yang tidak pakai
// konsep pack tidak menampilkan "(0 dus)" atau embel-embel yang membingungkan.
// Contoh: formatQtyWithPack(90, 'pcs', 30, 'dus') -> "90 pcs (3 dus)".
// Sisa yang tidak habis dibagi packSize ditampilkan terpisah, mis.
// formatQtyWithPack(95, 'pcs', 30, 'dus') -> "95 pcs (3 dus + 5 pcs)".
export function formatQtyWithPack(qty: number, unit: string, packSize?: number | null, packUnit?: string | null): string {
  const base = formatQty(qty, unit);
  if (!packUnit || !packSize || packSize <= 1) return base;

  const packs = Math.floor(qty / packSize);
  const remainder = qty - packs * packSize;
  if (packs <= 0) return base;

  const remainderPart = remainder > 0 ? ` + ${formatQty(remainder, unit)}` : '';
  return `${base} (${packs} ${packUnit}${remainderPart})`;
}

export function buildInventoryReply(params: {
  message: string;
  products: InventoryProductLite[];
  movements: InventoryMovementLite[];
  returns: InventoryReturnLite[];
  purchaseOrders?: unknown[];
  // Additive 10 Sep 2026 (agent inventory-engine, kontrak F3b/F4). Keduanya OPSIONAL
  // dan sengaja dibedakan dari "array kosong": undefined = caller belum menyambungkan
  // sumber data ini sama sekali (section terkait TIDAK ditampilkan, supaya caller lama
  // yang belum wiring batches/customers tidak tiba-tiba dapat section baru yang isinya
  // selalu "belum ada data"); array kosong ATAU terisi = caller SUDAH menyambungkan,
  // section ditampilkan dengan jawaban jujur sesuai isinya.
  batches?: InventoryBatchLite[];
  customers?: InventoryCustomerLite[];
  now?: Date;
}): string {
  const { products, movements, returns } = params;
  const now = params.now ?? new Date();
  const productById = new Map(products.map((p) => [p.id, p]));

  if (!products || products.length === 0) {
    return 'Belum ada produk yang tercatat. Tulis "tambah produk" di AI Assistant; saya akan meminta nama, satuan, harga beli, harga jual, stok minimum, dan stok awal, lalu menampilkan pratinjau sebelum menyimpan.';
  }

  const recs = buildRestockRecommendations({ products, movements, now });
  const lowStock = buildLowStockAlerts(products);
  const anomalies = detectReturnAnomalies({ movements, returns, now });
  const contributors = buildProfitContributors({ products, movements, now });

  const kritis = recs.filter((r) => r.status === 'kritis');
  const waspada = recs.filter((r) => r.status === 'waspada');
  const noHistory = recs.filter((r) => r.status === 'belum ada histori');
  const hasAnyHistory = recs.some((r) => r.status !== 'belum ada histori');

  const sections: string[] = [];

  // 1. Kondisi stok saat ini (angka riil)
  const stockLines: string[] = [];
  stockLines.push(`**Kondisi stok saat ini** (${products.length} produk tercatat)`);
  if (lowStock.length > 0) {
    stockLines.push(
      lowStock
        .map((p) => `- ${p.name}${p.sku ? ` (${p.sku})` : ''}: sisa ${formatQty(p.currentStock, p.unit)}, di bawah minimum ${formatQty(p.minStock, p.unit)}`)
        .join('\n')
    );
  } else {
    stockLines.push('- Tidak ada produk yang di bawah stok minimum saat ini.');
  }
  sections.push(stockLines.join('\n'));

  // 2. Rekomendasi restock (konkret)
  if (hasAnyHistory) {
    const restockLines: string[] = ['**Rekomendasi restock (30 hari ke depan)**'];
    const priority = [...kritis, ...waspada].slice(0, 8);
    if (priority.length > 0) {
      for (const r of priority) {
        // Ditambahkan 10 Sep 2026 (agent inventory-engine): pakai formatQtyWithPack kalau
        // produk ini punya packUnit (mis. "90 pcs (3 dus)") supaya toko yang beli per
        // dus/lusin tidak perlu menghitung ulang manual dari angka pcs.
        const productMeta = productById.get(r.productId);
        const suggestedLabel = formatQtyWithPack(r.suggestedQty ?? 0, r.unit, productMeta?.packSize, productMeta?.packUnit);
        restockLines.push(
          `- ${r.name}: status ${r.status}, keluar rata-rata ${formatQty(r.avgDailyOut ?? 0, r.unit)}/hari, cover ${(r.daysOfCover ?? 0).toFixed(1)} hari -- sarankan beli ${suggestedLabel}`
        );
      }
    } else {
      restockLines.push('- Semua produk dengan histori penjualan masih aman, belum perlu restock mendesak.');
    }
    if (noHistory.length > 0) {
      restockLines.push(
        `- ${noHistory.length} produk belum punya histori keluar (belum pernah tercatat SALE_OUT/RETURN_OUT) sehingga belum bisa dihitung kecepatan jualnya: ${noHistory
          .slice(0, 5)
          .map((r) => r.name)
          .join(', ')}${noHistory.length > 5 ? ', dst.' : ''}.`
      );
    }
    sections.push(restockLines.join('\n'));
  } else {
    sections.push(
      '**Rekomendasi restock**\n- Belum ada histori transaksi keluar (SALE_OUT/RETURN_OUT) untuk produk manapun, jadi saya belum bisa menghitung kecepatan jual atau saran jumlah restock. Catat transaksi penjualan lewat AI Assistant atau kasir supaya datanya terisi.'
    );
  }

  // 3. Retur anomali (jujur, bahasa netral)
  if (anomalies.length > 0) {
    const productNameById = new Map(products.map((p) => [p.id, p.name]));
    const anomalyLines = [
      '**Retur di atas 20% dari penjualan (90 hari terakhir)**',
      ...anomalies.slice(0, 5).map((a) => {
        const name = productNameById.get(a.productId) ?? a.productId;
        return `- ${name}: retur ${formatQty(a.returnQty, '')} dari ${formatQty(a.saleQty, '')} terjual (${Math.round(a.returnRate * 100)}%) -- ${a.note}`;
      }),
    ];
    sections.push(anomalyLines.join('\n'));
  }

  // 4. Produk paling untung (kalau ada data)
  if (contributors.length > 0) {
    const contributorLines = [
      '**Produk penyumbang margin terbesar (90 hari terakhir, berdasarkan data yang tercatat)**',
      ...contributors.slice(0, 5).map((c) => `- ${c.name}: margin ${formatRupiah(c.marginTotal)} dari ${formatQty(c.qtySold, '')} terjual (margin/unit ${formatRupiah(c.marginPerUnit)})`),
    ];
    sections.push(contributorLines.join('\n'));
  }

  // 5. Stok mati / gak laku (60 hari) -- ditambahkan 10 Sep 2026, selalu
  // ditampilkan (relevan buat semua workspace, bukan cuma yang punya konsinyasi)
  // dengan fallback jujur kalau memang belum bisa dinilai.
  const deadStock = buildDeadStock({ products, movements, now });
  const everHadSaleOut = movements.some((m) => m.type === 'SALE_OUT');
  if (deadStock.length > 0) {
    const deadLines = [
      '**Stok mati (tidak ada penjualan 60 hari terakhir)**',
      ...deadStock
        .slice(0, 5)
        .map(
          (d) =>
            `- ${d.name}: sisa ${formatQty(d.currentStock, d.unit)}${d.ownershipType === 'CONSIGNED' ? ' (barang konsinyasi; tidak dihitung sebagai aset toko)' : ` senilai ${formatRupiah(d.deadValue)}`}${
              d.idleDays !== null ? `, idle ${d.idleDays} hari sejak terakhir terjual` : ', belum pernah tercatat terjual sama sekali'
            }`
        ),
    ];
    sections.push(deadLines.join('\n'));
  } else if (!everHadSaleOut) {
    sections.push(
      '**Stok mati**\n- Belum ada penjualan tercatat dalam 60 hari, jadi stok mati belum bisa dinilai.'
    );
  } else {
    sections.push(
      '**Stok mati**\n- Tidak ada produk yang idle -- semua produk yang stoknya masih ada pernah terjual dalam 60 hari terakhir.'
    );
  }

  // 6. Perputaran stok (90 hari, avgStock = proxy currentStock -- disebut jujur di narasi)
  const turnoverAll = buildStockTurnover({ products, movements, now });
  const turnoverWithSales = turnoverAll.filter((t) => t.qtySold > 0);
  if (turnoverWithSales.length > 0) {
    const turnoverLines = [
      '**Perputaran stok (90 hari terakhir, avgStock pakai stok saat ini sebagai perkiraan, bukan rata-rata harian sebenarnya)**',
      ...turnoverWithSales
        .slice()
        .sort((a, b) => (b.turnover ?? -1) - (a.turnover ?? -1))
        .slice(0, 5)
        .map(
          (t) =>
            `- ${t.name}: terjual ${formatQty(t.qtySold, t.unit)}, turnover ${
              t.turnover !== null ? `${t.turnover.toFixed(2)}x` : 'tidak bisa dihitung (stok saat ini 0)'
            }`
        ),
    ];
    sections.push(turnoverLines.join('\n'));
  } else {
    sections.push('**Perputaran stok**\n- Belum ada penjualan tercatat, jadi perputaran stok belum bisa dihitung.');
  }

  // 7. Konsinyasi / titip jual -- berapa yang harus disetor ke supplier.
  // Section ini HANYA muncul kalau workspace memang punya produk CONSIGNED --
  // beda dari stok mati/turnover yang relevan buat semua toko, gak semua UMKM
  // punya barang titip jual, jadi diam kalau memang tidak ada (sama seperti pola
  // retur anomali & profit contributors di atas yang diam kalau tidak relevan).
  const consignedProducts = products.filter((p) => p.ownershipType === 'CONSIGNED');
  if (consignedProducts.length > 0) {
    const consignment = buildConsignmentSummary({ products, movements, now });
    const consignedWithSales = consignment.filter((c) => c.qtySold > 0);
    if (consignedWithSales.length > 0) {
      const totalDue = consignedWithSales.reduce((sum, c) => sum + c.amountDueToSupplier, 0);
      const consignmentLines = [
        '**Konsinyasi / titip jual -- setoran ke supplier (30 hari terakhir)**',
        ...consignedWithSales
          .slice(0, 5)
          .map((c) => `- ${c.name}: terjual ${formatQty(c.qtySold, c.unit)}, harus disetor ${formatRupiah(c.amountDueToSupplier)}`),
        `- Total harus disetor ke semua supplier: ${formatRupiah(totalDue)}.`,
      ];
      sections.push(consignmentLines.join('\n'));
    } else {
      sections.push(
        '**Konsinyasi / titip jual**\n- Belum ada penjualan produk titip jual dalam 30 hari terakhir, jadi belum ada yang perlu disetor ke supplier.'
      );
    }
  }

  // 8b. Titik pesan ulang (reorder point) -- ditambahkan 10 Sep 2026 (agent
  // inventory-engine). Selalu dievaluasi (tidak butuh param opsional baru) karena cukup
  // dari products+movements yang sudah ada; tapi tetap jujur kalau datanya belum cukup
  // (butuh histori jual DAN minimal 2 PURCHASE_IN per produk).
  const reorderPoints = buildReorderPoints({ products, movements, now });
  const reorderWithData = reorderPoints.filter((r) => r.reorderPoint !== null);
  if (reorderWithData.length > 0) {
    const belowRop = reorderWithData.filter((r) => r.belowReorderPoint);
    const reorderLines = [
      '**Titik pesan ulang (reorder point) -- estimasi dari kecepatan jual + rata-rata jarak pembelian ke supplier**',
    ];
    if (belowRop.length > 0) {
      reorderLines.push(
        ...belowRop
          .slice(0, 5)
          .map(
            (r) =>
              `- ${r.name}: stok ${formatQty(r.currentStock, r.unit)} sudah di titik atau di bawah titik pesan ulang ${formatQty(
                r.reorderPoint ?? 0,
                r.unit
              )} (estimasi lead time ${(r.leadTimeDays ?? 0).toFixed(1)} hari + cadangan ${r.safetyStockDays} hari) -- saatnya pesan ulang ke supplier.`
          )
      );
    } else {
      reorderLines.push('- Semua produk yang bisa dihitung masih di atas titik pesan ulangnya.');
    }
    sections.push(reorderLines.join('\n'));
  } else {
    sections.push(
      '**Titik pesan ulang (reorder point)**\n- Belum bisa dihitung: butuh histori penjualan DAN minimal 2 transaksi pembelian (PURCHASE_IN) per produk untuk memperkirakan jarak waktu pengiriman dari supplier. Datanya belum cukup saat ini.'
    );
  }

  // 8c. Konversi kemasan (dus/lusin/krat) -- ditambahkan 10 Sep 2026. Hanya ditampilkan
  // untuk produk yang memang mengisi packSize/packUnit (opsional per produk); diam kalau
  // tidak ada, sama seperti pola section retur anomali/konsinyasi di atas yang tidak
  // relevan untuk semua workspace.
  const productsWithPack = products.filter((p) => p.packUnit && p.packSize && p.packSize > 1);
  if (productsWithPack.length > 0) {
    const packLines = [
      '**Konversi kemasan**',
      ...productsWithPack
        .slice(0, 8)
        .map((p) => `- ${p.name}: stok ${formatQtyWithPack(p.currentStock, p.unit, p.packSize, p.packUnit)}`),
    ];
    sections.push(packLines.join('\n'));
  }

  // 8d. Kadaluarsa (FEFO) -- ditambahkan 10 Sep 2026. Section ini HANYA muncul kalau
  // caller memang menyambungkan data batch (params.batches !== undefined) -- caller lama
  // yang belum wiring ProductBatch tidak tiba-tiba dapat section baru yang isinya selalu
  // "belum ada data batch tercatat".
  if (params.batches !== undefined) {
    const expiryAlerts = buildExpiryAlerts({ batches: params.batches, now, days: 30 });
    if (expiryAlerts.length > 0) {
      const expiryLines = [
        '**Kadaluarsa dalam 30 hari (FEFO -- jual/prioritaskan yang paling dekat kadaluarsa dulu)**',
        ...expiryAlerts.slice(0, 8).map((e) => {
          const label = e.severity === 'kritis' ? 'kadaluarsa < 7 hari' : 'kadaluarsa < 30 hari';
          const saran = e.severity === 'kritis' ? ' -- sarankan diskon/prioritaskan jual segera' : '';
          return `- ${e.productName}${e.batchCode ? ` (batch ${e.batchCode})` : ''}: sisa ${formatQty(e.qty, e.unit)}, ${label} (${e.daysUntilExpiry} hari lagi)${saran}`;
        }),
      ];
      sections.push(expiryLines.join('\n'));
    } else {
      sections.push('**Kadaluarsa**\n- Tidak ada batch yang mendekati kadaluarsa dalam 30 hari ke depan.');
    }
  }

  // 8e. Restock per pelanggan/toko (Distributor) -- ditambahkan 10 Sep 2026. Section ini
  // HANYA muncul kalau caller menyambungkan data pelanggan (params.customers !==
  // undefined), sama prinsipnya dengan section kadaluarsa di atas.
  if (params.customers !== undefined) {
    const restockByCustomer = buildRestockByCustomer({ products, movements, customers: params.customers, now });
    if (!restockByCustomer.hasLinkedSales) {
      sections.push(
        '**Restock per pelanggan/toko**\n- Penjualan belum dikaitkan ke pelanggan mana pun (customerId kosong pada semua transaksi SALE_OUT), jadi saya belum bisa menghitung kebutuhan restock per toko/warung. Pilih pelanggan saat mencatat penjualan supaya datanya bisa dihitung.'
      );
    } else if (restockByCustomer.summaries.length === 0) {
      sections.push('**Restock per pelanggan/toko**\n- Belum ada penjualan ke pelanggan tercatat dalam 90 hari terakhir.');
    } else {
      const custLines = ['**Restock per pelanggan/toko (90 hari terakhir, saran untuk kunjungan berikutnya)**'];
      for (const s of restockByCustomer.summaries.slice(0, 5)) {
        const topLines = s.lines
          .slice(0, 3)
          .map(
            (l) =>
              `${l.productName} ~${formatQty(l.qtyPerWeek, l.unit)}/minggu (saran ${formatQty(l.suggestedQtyNextVisit, l.unit)})`
          )
          .join('; ');
        custLines.push(`- ${s.customerName}${s.area ? ` (${s.area})` : ''}: ${topLines}`);
      }
      sections.push(custLines.join('\n'));
    }
  }

  // 8. Batas -- jujur soal apa yang belum bisa disimpulkan
  sections.push(
    'Catatan: angka di atas dihitung langsung dari data stok, transaksi, dan retur workspace Anda. Saya belum bisa menyimpulkan penyebab bisnis (kenapa suatu produk laku/tidak, atau kenapa retur naik) tanpa data kanal penjualan atau harga pasar -- keputusan akhir tetap di tangan Anda.'
  );

  return sections.join('\n\n');
}
