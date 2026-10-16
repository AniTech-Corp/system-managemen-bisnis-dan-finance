/**
 * Skor keandalan supplier -- DETERMINISTIK, murni fungsi transformasi (sibling
 * bank-reconciliation.ts / ledger-parser.ts: NOL panggilan LLM untuk menghitung angka).
 *
 * Modul ini TIDAK menyentuh Prisma sama sekali -- route.ts yang query data lalu petakan
 * ke bentuk minimal di sini (pola sama dengan CashTransactionInput di
 * bank-reconciliation.ts), supaya bisa dites dengan data sintetis tanpa koneksi DB
 * (lihat tests/supplier-reliability-engine.test.ts).
 *
 * SKOR INI BERDIRI SENDIRI -- TIDAK terhubung ke CompanyHealthScore (breakdown 35/30/20/15
 * di types.ts). Model penyimpanan: prisma.SupplierScore (sudah ada di schema.prisma dari
 * fase Fondasi Schema 2, field: score, onTimeRate, priceStability, defectRate).
 *
 * Konvensi 3 komponen (WAJIB dibaca sebelum ubah bobot):
 *   - onTimeRate    : % pengiriman tepat waktu (0-100, makin tinggi makin bagus).
 *                      SAAT INI SELALU null -- schema.prisma model PurchaseOrder cuma
 *                      punya `purchaseDate` (tanggal dicatat), TIDAK ADA kolom tanggal
 *                      janji-kirim vs tanggal-aktual-diterima. Tanpa 2 titik waktu itu,
 *                      "tepat waktu" tidak bisa dihitung -- BUKAN diasumsikan 100 (itu
 *                      klaim palsu), BUKAN dihitung dari purchaseDate doang (itu salah
 *                      secara metodologis). Kalau field itu ditambah ke schema suatu
 *                      hari, isi computeOnTimeRate() -- signature-nya sudah disiapkan.
 *   - priceStability: skor 0-100 (makin tinggi makin stabil), DITURUNKAN dari koefisien
 *                      variasi (CV = stdev/mean) unitCost PER PRODUK per supplier lalu
 *                      dirata-ratakan berbobot-jumlah-observasi lintas produk. Per-produk
 *                      (bukan lintas semua produk supplier) supaya supplier yang jual
 *                      10 barang beda harga tidak kelihatan "tidak stabil" gara-gara
 *                      barang A Rp5rb dan barang B Rp500rb ada di kolam data yang sama.
 *   - defectRate    : % qty yang diretur ke supplier (StockReturn direction=TO_SUPPLIER)
 *                      dibagi total qty yang dibeli dari supplier itu. Ini betulan RATE
 *                      (0-100, makin TINGGI makin BURUK) -- beda dari 2 field di atas yang
 *                      "makin tinggi makin bagus". Saat digabung ke `score` akhir,
 *                      di-invert dulu (100 - defectRate) supaya arah konsisten. ATRIBUSI
 *                      retur ke supplier BUKAN hal sepele -- StockReturn TIDAK punya kolom
 *                      supplierName langsung, dan endpoint returns/route.ts yang live HARI
 *                      INI (diverifikasi 9 Sep 2026, punya agent lain) tidak mengisi
 *                      sourceType/sourceId StockReturn ke PurchaseOrderItem manapun. Karena
 *                      itu modul ini punya 2 lapis resolusi -- resolveReturnsToSupplier()
 *                      (via sourceId eksplisit, andal tapi SAAT INI selalu kosong) lalu
 *                      resolveReturnsByLatestPurchase() (fallback heuristik "supplier
 *                      terakhir yang jual produk itu", HIPOTESIS-tier). Lihat komentar di
 *                      masing-masing fungsi untuk detail lengkap.
 *
 * Skor akhir (`score`, 0-100, makin tinggi makin bagus) = rata-rata berbobot dari
 * komponen yang datanya ADA saja -- bobot komponen yang null di-redistribusi ke sisanya
 * (renormalisasi), BUKAN diperlakukan sebagai 0. Bobot dasar (saat semua 3 ada, untuk
 * masa depan kalau onTimeRate sudah bisa dihitung): onTime 0.4, priceStability 0.3,
 * defectRate(inverted) 0.3. Saat ini (onTimeRate selalu null) otomatis jadi 0.5/0.5.
 * Supplier tanpa data pembelian sama sekali TIDAK muncul di hasil buildSupplierScores()
 * -- dicek lewat hasSufficientData di pemanggil kalau perlu tampilkan "belum ada data".
 */

// ---------------------------------------------------------------------------
// Tipe publik -- input (dipetakan dari Prisma oleh route.ts)
// ---------------------------------------------------------------------------

/** Satu baris PurchaseOrderItem yang sudah digabung dengan nama supplier PO induknya. */
export interface PurchaseOrderItemForScoring {
  purchaseOrderId: string;
  supplierName: string;
  productId: string;
  qty: number;
  unitCost: number;
}

/** Satu baris StockReturn (arah TO_SUPPLIER) yang sudah berhasil diresolusi ke nama
 *  supplier lewat sourceType/sourceId -> PurchaseOrderItem -> PurchaseOrder.supplierName. */
export interface StockReturnForScoring {
  supplierName: string | null;
  productId: string;
  qty: number;
}

/** Bentuk minimal StockReturn mentah (apa adanya dari `prisma.stockReturn.findMany()`),
 *  dipetakan route.ts ke ini -- modul ini TIDAK bergantung pada @prisma/client. */
export interface RawStockReturnRow {
  direction: string;
  sourceType: string | null;
  sourceId: string | null;
  productId: string;
  qty: number;
}

/** Entry lookup: PurchaseOrderItem.id -> {supplierName, productId} milik item itu,
 *  dipakai resolveReturnsToSupplier() untuk menelusuri StockReturn.sourceId (yang
 *  isinya PurchaseOrderItem.id ketika sourceType='PURCHASE_ORDER_ITEM', pola yang sama
 *  dipakai StockMovement -- lihat purchase-orders/route.ts baris ~154) balik ke supplier
 *  mana yang jual barang itu. */
export interface PurchaseOrderItemLookupEntry {
  supplierName: string;
  productId: string;
}

/** Satu titik histori "produk X dibeli dari supplier Y pada tanggal Z", dipakai
 *  resolveReturnsByLatestPurchase() sebagai fallback kedua. */
export interface ProductSupplierHistoryEntry {
  productId: string;
  supplierName: string;
  purchaseDate: Date | string;
}

/** StockReturn mentah yang butuh diresolusi lewat fallback (sourceId gagal/kosong) --
 *  perlu productId + qty + createdAt (BUKAN sourceType/sourceId, itu sudah dicoba
 *  duluan lewat resolveReturnsToSupplier). */
export interface ReturnForFallbackResolution {
  productId: string;
  qty: number;
  createdAt: Date | string;
}

// ---------------------------------------------------------------------------
// Tipe publik -- output
// ---------------------------------------------------------------------------

export interface SupplierScoreResult {
  supplierName: string;
  /** 0-100, makin tinggi makin bagus. */
  score: number;
  /** 0-100 (% tepat waktu) -- SELALU null saat ini, lihat catatan header modul. */
  onTimeRate: number | null;
  /** 0-100 (skor stabilitas harga) -- null kalau tidak ada produk dengan >=2 titik harga. */
  priceStability: number | null;
  /** 0-100 (% qty diretur ke supplier ini) -- null kalau tidak ada data pembelian sama sekali. */
  defectRate: number | null;
  dataPoints: {
    /** Jumlah PurchaseOrder unik (bukan jumlah item) sebagai proxy sample size. */
    totalPurchaseOrders: number;
    totalPurchasedQty: number;
    totalReturnedQty: number;
    /** Jumlah produk berbeda yang punya >=2 observasi harga -- dipakai hitung priceStability. */
    productsWithPriceHistory: number;
  };
  /** false kalau baru 1 PurchaseOrder -- skor secara teknis bisa dihitung tapi
   *  sample-size-nya kurang meyakinkan, UI sebaiknya tampilkan badge "data masih sedikit". */
  hasSufficientData: boolean;
}

export interface BuildSupplierScoresResult {
  scores: SupplierScoreResult[];
  /** Jumlah baris StockReturn TO_SUPPLIER yang GAGAL diresolusi ke supplier manapun
   *  (sourceType/sourceId kosong atau tidak ketemu di lookup) -- return ini TIDAK ikut
   *  menghitung defectRate siapapun. Ditampilkan apa adanya, bukan disembunyikan. */
  unresolvedReturnCount: number;
}

const MIN_ORDERS_FOR_CONFIDENT_SCORE = 2;

/** Bobot dasar saat SEMUA 3 komponen ada data (masa depan). Renormalisasi otomatis
 *  terjadi di aggregateComponents() kalau ada komponen yang null. */
const BASE_WEIGHTS = {
  onTimeRate: 0.4,
  priceStability: 0.3,
  defectRateInverted: 0.3,
} as const;

// ---------------------------------------------------------------------------
// Komponen 1: onTimeRate -- stub, selalu null saat ini (lihat catatan header modul)
// ---------------------------------------------------------------------------

/**
 * Signature disiapkan untuk masa depan kalau schema.prisma PurchaseOrder ditambah kolom
 * tanggal-janji-kirim + tanggal-aktual-diterima. `deliveries` kosong/undefined -> null
 * (bukan 0, bukan 100 -- null = "tidak bisa dinilai", beda makna dari "dinilai jelek").
 */
export function computeOnTimeRate(
  deliveries?: Array<{ promisedDate: Date | string; actualDate: Date | string }>,
): number | null {
  if (!deliveries || deliveries.length === 0) return null;
  let onTimeCount = 0;
  for (const d of deliveries) {
    const promised = new Date(d.promisedDate).getTime();
    const actual = new Date(d.actualDate).getTime();
    if (Number.isFinite(promised) && Number.isFinite(actual) && actual <= promised) onTimeCount += 1;
  }
  return (onTimeCount / deliveries.length) * 100;
}

// ---------------------------------------------------------------------------
// Komponen 2: priceStability
// ---------------------------------------------------------------------------

/** Koefisien variasi (stdev/mean) -- null kalau titik data < 2 atau mean = 0 (tidak
 *  bermakna dibagi nol / satu titik data tidak punya "variasi"). */
function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stdev = Math.sqrt(variance);
  return stdev / mean;
}

/** CV=0 (harga selalu identik) -> skor 100. CV>=1 (stdev sama besar dgn mean, variasi
 *  ekstrem) -> skor 0, di-clamp supaya tidak negatif untuk CV lebih besar lagi. */
function priceStabilityScoreFromCV(cv: number): number {
  return 100 * Math.min(1, Math.max(0, 1 - cv));
}

/**
 * Hitung priceStability satu supplier dari semua PurchaseOrderItem miliknya. Dikelompokkan
 * PER PRODUK dulu (alasan: lihat catatan header modul), lalu dirata-ratakan berbobot
 * jumlah observasi per produk. Return null kalau tidak ada satupun produk dengan >=2
 * observasi harga (mis. supplier baru order sekali, atau tiap produk cuma dibeli sekali).
 */
export function computePriceStability(items: Array<{ productId: string; unitCost: number }>): {
  priceStability: number | null;
  productsWithPriceHistory: number;
} {
  const byProduct = new Map<string, number[]>();
  for (const it of items) {
    if (!byProduct.has(it.productId)) byProduct.set(it.productId, []);
    byProduct.get(it.productId)!.push(it.unitCost);
  }

  let weightedSum = 0;
  let weightTotal = 0;
  let productsWithPriceHistory = 0;

  for (const costs of byProduct.values()) {
    const cv = coefficientOfVariation(costs);
    if (cv === null) continue;
    productsWithPriceHistory += 1;
    weightedSum += priceStabilityScoreFromCV(cv) * costs.length;
    weightTotal += costs.length;
  }

  return {
    priceStability: weightTotal > 0 ? weightedSum / weightTotal : null,
    productsWithPriceHistory,
  };
}

// ---------------------------------------------------------------------------
// Komponen 3: defectRate
// ---------------------------------------------------------------------------

/** returnedQty/purchasedQty * 100, di-clamp [0,100] (kalau data retur "lebih besar" dari
 *  pembelian karena anomali data histori, jangan sampai defectRate > 100% yang tidak masuk
 *  akal -- di-cap, bukan dibiarkan meledak). Null kalau purchasedQty = 0 (tidak ada
 *  pembelian tercatat dari supplier ini sama sekali -- bukan tanggung jawab modul ini,
 *  buildSupplierScores() tidak akan memanggil ini untuk supplier tanpa item). */
export function computeDefectRate(purchasedQty: number, returnedQty: number): number | null {
  if (purchasedQty <= 0) return null;
  return Math.min(100, (returnedQty / purchasedQty) * 100);
}

// ---------------------------------------------------------------------------
// Resolusi StockReturn -> supplier
// ---------------------------------------------------------------------------

/**
 * Telusuri tiap baris StockReturn (arah TO_SUPPLIER) balik ke nama supplier lewat
 * sourceType='PURCHASE_ORDER_ITEM' + sourceId (= PurchaseOrderItem.id) -> lookup map.
 * Baris yang arahnya bukan TO_SUPPLIER DIABAIKAN (bukan tanggung jawab fungsi ini --
 * caller/route.ts seharusnya sudah filter di query, ini jaga-jaga kedua). Baris yang
 * gagal diresolusi (sourceType lain, sourceId kosong, atau id tidak ketemu di lookup --
 * mis. retur manual tanpa link ke PO) TETAP dihitung di unresolvedReturnCount, TIDAK
 * diam-diam dibuang.
 */
export function resolveReturnsToSupplier(
  returns: RawStockReturnRow[],
  itemLookup: Map<string, PurchaseOrderItemLookupEntry>,
): { resolved: StockReturnForScoring[]; unresolvedCount: number } {
  const resolved: StockReturnForScoring[] = [];
  let unresolvedCount = 0;

  for (const r of returns) {
    if (r.direction !== 'TO_SUPPLIER') continue;

    if (r.sourceType === 'PURCHASE_ORDER_ITEM' && r.sourceId) {
      const entry = itemLookup.get(r.sourceId);
      if (entry) {
        resolved.push({ supplierName: entry.supplierName, productId: entry.productId, qty: r.qty });
        continue;
      }
    }

    unresolvedCount += 1;
    resolved.push({ supplierName: null, productId: r.productId, qty: r.qty });
  }

  return { resolved, unresolvedCount };
}

/**
 * FALLBACK resolusi kedua (HIPOTESIS-tier, BUKAN ground-truth) -- dipakai untuk baris
 * StockReturn yang gagal diresolusi resolveReturnsToSupplier() di atas.
 *
 * PENTING (verifikasi live-code 9 Sep 2026): endpoint `inventory/returns/route.ts` yang
 * SEKARANG BERJALAN (agent konsinyasi-retur, dibaca langsung sebelum modul ini ditulis)
 * TIDAK PERNAH mengisi StockReturn.sourceType/sourceId sama sekali -- field itu dipakai
 * arah SEBALIKNYA di sana (StockMovement menunjuk BALIK ke StockReturn lewat
 * sourceType='STOCK_RETURN'). Komentar di schema.prisma yang bilang StockReturn.sourceType
 * "mis. sourceType='purchase_order'" cuma CONTOH DESAIN, bukan jaminan implementasi --
 * di kode nyata field itu SELALU null untuk retur yang lewat endpoint ini. Akibatnya
 * resolveReturnsToSupplier() di atas akan SELALU unresolved untuk semua retur yang ada
 * hari ini, sampai endpoint returns/route.ts (bukan file punya agent ini, lihat
 * butuh_dari_tim di laporan) ditambah field supplierName/PO-link.
 *
 * Heuristik: retur produk X diatribusikan ke supplier yang PALING TERAKHIR menjual
 * produk X SEBELUM tanggal retur dibuat ("barang yang diretur kemungkinan besar dari
 * batch pembelian terakhir sebelum tanggal retur"). Asumsi ini BISA SALAH kalau 2+
 * supplier jual produk yang sama berdekatan waktu -- makanya hasil lewat jalur ini
 * secara semantik lebih lemah daripada resolusi lewat sourceId eksplisit (yang mana
 * saat ini tidak pernah terjadi, tapi signature-nya dipertahankan untuk masa depan).
 */
export function resolveReturnsByLatestPurchase(
  returns: ReturnForFallbackResolution[],
  history: ProductSupplierHistoryEntry[],
): { resolved: StockReturnForScoring[]; unresolvedCount: number } {
  const byProduct = new Map<string, ProductSupplierHistoryEntry[]>();
  for (const h of history) {
    if (!byProduct.has(h.productId)) byProduct.set(h.productId, []);
    byProduct.get(h.productId)!.push(h);
  }
  for (const list of byProduct.values()) {
    list.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }

  const resolved: StockReturnForScoring[] = [];
  let unresolvedCount = 0;

  for (const r of returns) {
    const candidates = byProduct.get(r.productId) ?? [];
    const returnTime = new Date(r.createdAt).getTime();
    const match = candidates.find((c) => new Date(c.purchaseDate).getTime() <= returnTime);
    if (match) {
      resolved.push({ supplierName: match.supplierName, productId: r.productId, qty: r.qty });
    } else {
      unresolvedCount += 1;
      resolved.push({ supplierName: null, productId: r.productId, qty: r.qty });
    }
  }

  return { resolved, unresolvedCount };
}

// ---------------------------------------------------------------------------
// Agregasi skor akhir
// ---------------------------------------------------------------------------

/** Renormalisasi: komponen yang null DIBUANG dari perhitungan (bukan dianggap 0), bobot
 *  sisanya di-scale supaya total tetap 1.0. Semua null -> return 0 (tidak ada dasar sama
 *  sekali untuk menilai) -- pemanggil WAJIB cek hasSufficientData/dataPoints, bukan
 *  menelan angka 0 ini mentah-mentah sebagai "supplier ini jelek". */
function aggregateComponents(
  onTimeRate: number | null,
  priceStability: number | null,
  defectRate: number | null,
): number {
  const components: Array<{ value: number; weight: number }> = [];
  if (onTimeRate !== null) components.push({ value: onTimeRate, weight: BASE_WEIGHTS.onTimeRate });
  if (priceStability !== null) components.push({ value: priceStability, weight: BASE_WEIGHTS.priceStability });
  if (defectRate !== null) components.push({ value: 100 - defectRate, weight: BASE_WEIGHTS.defectRateInverted });

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return 0;

  return components.reduce((sum, c) => sum + c.value * (c.weight / totalWeight), 0);
}

/**
 * Entry point utama: gabungkan PurchaseOrderItem[] (semua supplier, workspace yang sama)
 * + StockReturn yang sudah diresolusi -> skor per supplier, diurutkan score DESC.
 * Supplier yang tidak punya PurchaseOrderItem sama sekali TIDAK akan muncul di hasil
 * (tidak ada dasar data apapun untuk dinilai).
 */
export function buildSupplierScores(
  items: PurchaseOrderItemForScoring[],
  resolvedReturns: StockReturnForScoring[],
): BuildSupplierScoresResult {
  const bySupplier = new Map<string, PurchaseOrderItemForScoring[]>();
  for (const it of items) {
    if (!bySupplier.has(it.supplierName)) bySupplier.set(it.supplierName, []);
    bySupplier.get(it.supplierName)!.push(it);
  }

  const returnsBySupplier = new Map<string, StockReturnForScoring[]>();
  let unresolvedReturnCount = 0;
  for (const r of resolvedReturns) {
    if (!r.supplierName) {
      unresolvedReturnCount += 1;
      continue;
    }
    if (!returnsBySupplier.has(r.supplierName)) returnsBySupplier.set(r.supplierName, []);
    returnsBySupplier.get(r.supplierName)!.push(r);
  }

  const scores: SupplierScoreResult[] = [];

  for (const [supplierName, supplierItems] of bySupplier) {
    const { priceStability, productsWithPriceHistory } = computePriceStability(
      supplierItems.map((i) => ({ productId: i.productId, unitCost: i.unitCost })),
    );

    const totalPurchasedQty = supplierItems.reduce((sum, i) => sum + i.qty, 0);
    const returns = returnsBySupplier.get(supplierName) ?? [];
    const totalReturnedQty = returns.reduce((sum, r) => sum + r.qty, 0);
    const defectRate = computeDefectRate(totalPurchasedQty, totalReturnedQty);

    const onTimeRate = computeOnTimeRate(); // selalu null saat ini, lihat catatan header

    const score = aggregateComponents(onTimeRate, priceStability, defectRate);
    const totalPurchaseOrders = new Set(supplierItems.map((i) => i.purchaseOrderId)).size;

    scores.push({
      supplierName,
      score,
      onTimeRate,
      priceStability,
      defectRate,
      dataPoints: {
        totalPurchaseOrders,
        totalPurchasedQty,
        totalReturnedQty,
        productsWithPriceHistory,
      },
      hasSufficientData: totalPurchaseOrders >= MIN_ORDERS_FOR_CONFIDENT_SCORE,
    });
  }

  scores.sort((a, b) => b.score - a.score);

  return { scores, unresolvedReturnCount };
}
