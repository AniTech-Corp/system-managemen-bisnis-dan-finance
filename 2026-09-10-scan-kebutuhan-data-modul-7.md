Scan Kebutuhan Data - Modul 7 (Stok/Purchasing/Kasir/Distributor)
==================================================================
Ditulis 10 September 2026 oleh agent scan-data-riil-modul7 (Sonnet, tim Claude Code KLIR).
Tugas C dari batch SCAN gabungan (komando Fable 5.1). NOL edit kode - baca-saja terhadap
prisma/schema.prisma, src/app/api/v1/inventory/*, src/lib/ai-brain/inventory-intelligence-engine.ts,
src/lib/ai-brain/consignment-engine.ts. Setiap klaim ditandai [KODE] (dicek langsung dari file,
ada file:line) atau [SUMBER] (kutipan dokumen/memori, ada nama file).

0. RINGKASAN (10 baris)
-----------------------
1. Fondasi data Modul 7 (Product/StockMovement/PurchaseOrder/PurchaseOrderItem/StockReturn/
   SupplierScore, prisma/schema.prisma:808-965) SUDAH CUKUP untuk hampir semua fitur yang
   sudah live per 10 Sep: stok dasar, riwayat keluar-masuk, purchase order, retur, skor
   pemasok, penjualan manual, penyesuaian stok, laporan konsinyasi dasar.
2. GAP NYATA #1 (dikonfirmasi baca kode langsung, bukan tebakan): data pembeli di penjualan
   manual (`customerName`) cuma teks bebas yang ditempel ke `CashTransaction.description`
   (src/app/api/v1/inventory/sales/route.ts:54,103-105) - TIDAK ADA field terstruktur,
   TIDAK BISA di-query per toko/wilayah. Ini langsung menghalangi fitur "rekomendasi restock
   per toko/wilayah" yang diminta transkrip 8 Sep (Pak Wisnu/tim online).
3. GAP NYATA #2: `Product` tidak punya field faktor konversi satuan (schema.prisma:814,
   `unit` cuma `String @default("pcs")` bebas teks) - dus/pcs untuk Distributor tidak bisa
   dihitung otomatis, harus diketik manual tiap kali, rawan salah hitung.
4. GAP NYATA #3: tidak ada tabel batch/kadaluarsa sama sekali - `Product.currentStock` cuma
   1 angka tunggal per produk (schema.prisma:820), tidak bisa merepresentasikan "500 pcs
   kadaluarsa besok + 300 pcs kadaluarsa bulan depan". FEFO mustahil tanpa tabel baru.
5. GAP NYATA #4: `Product` tidak punya field pemasok (grep "supplier" di schema.prisma cuma
   nongol di `PurchaseOrder.supplierName`/`SupplierScore.supplierName`, tidak ada di
   `Product`) - laporan konsinyasi (consignment/report/route.ts) tidak bisa bilang "produk
   ini titipan supplier siapa", cuma bisa hitung qty/rupiah per produk tanpa tahu ke siapa
   harus disetor.
6. GAP NYATA #5 (temuan sendiri, bukan dari sumber manapun): laporan settlement konsinyasi
   (`buildConsignmentReportRows`, consignment-engine.ts:281) MURNI DIHITUNG ULANG tiap kali
   dari StockMovement+StockReturn (stateless) - tidak ada tempat menyimpan "sudah disetor
   tanggal berapa, sudah dibayar berapa". Kalau user klik "sudah setor", tidak ada tempat
   nyimpennya.
7. Semua gap di atas ADDITIVE-SAFE kalau dikerjakan sebagai kolom nullable/model baru -
   NOL risiko ke data existing (verifikasi per-usulan ada di bagian 3).
8. 2 usulan TIDAK saya sertakan sebagai skema wajib karena sumber sendiri (riset fitur
   stok lanjutan) bilang itu "murni logika, bukan skema baru": reorder point berbasis
   lead-time dan dead-stock/turnover. Saya cuma catat 1 usulan OPSIONAL (PurchaseOrder
   split tanggal order/terima) di bagian 3.6 kalau nanti presisi mau dinaikkan.
9. E-Faktur/invoice ke outlet dan manajemen rute sales sengaja saya taruh paling belakang
   (bagian 3.7) - nilainya nyata untuk Distributor tapi effort besar (entitas baru penuh)
   dan tidak ada sinyal prioritas dekat dari sumber manapun yang saya baca.
10. Diputuskan sementara (bukan digantung): semua usulan skema di bagian 3 saya tulis
    presisi (nama model/kolom/tipe/nullable/index) supaya kalau Mecca setuju, batch bangun
    berikutnya tinggal `prisma db push`, bukan didesain ulang dari nol.

1. METODOLOGI - APA YANG DIBACA
--------------------------------
[KODE] prisma/schema.prisma baris 1-966 penuh (bukan cuma baris yang disebut context pack) -
semua 39 model dicek, fokus mendalam di CashTransaction (429), Invoice (458), PromoCoupon (493),
ScheduledObligation (558), WorkspaceFile (588), Product s/d SupplierScore (808-965).
[KODE] src/app/api/v1/inventory/sales/route.ts (221 baris, penuh).
[KODE] src/app/api/v1/inventory/stock-adjustments/route.ts (118 baris, penuh).
[KODE] src/app/api/v1/inventory/consignment/report/route.ts (114 baris, penuh).
[KODE] src/lib/ai-brain/inventory-intelligence-engine.ts baris 1-120 (fungsi
detectInventoryIntent, computeAvgDailyOut, buildRestockRecommendations) + daftar semua
export function (grep) untuk memastikan tidak ada fungsi yang butuh field yang belum ada
tapi terlewat.
[KODE] src/lib/ai-brain/consignment-engine.ts (daftar export function via grep).
[SUMBER] 2026-09-10-roadmap-inventory-ai-distributor.md (root repo, penuh, 119 baris).
[SUMBER] 2026-09-10-riset-fitur-stok-lanjutan-inventory.md (root repo, penuh, 174 baris).
[SUMBER] 2026-09-10-usulan-matriks-role-feature-7-modul.md (root repo, penuh, 257 baris).
[SUMBER] memory: project_klir_segmen_distributor_baru_8sep.md (penuh).
[SUMBER] memory: project_klir_inventory_modul_baru_dan_megaco_presentasi_8sep.md (penuh).
[SUMBER] memory: project_klir_meet_fundamental_umkm_stok_kasir_3sep.md (penuh).
[SUMBER] Claude-Code-Memory\project_klir_inventory_umkm_rancangan_tim_online_9sep.md (ringkasan
docx tim online, penuh - dokumen docx aslinya TIDAK saya buka ulang lewat python-docx, saya
percaya ringkasan yang sudah ada karena sudah ditandai "dibaca penuh via python-docx, 190 blok"
oleh sesi 9 Sep; kalau ada detail docx yang tidak masuk ringkasan itu, saya TIDAK melihatnya -
dicatat di catatan_jujur).
[KODE] git log --oneline -5 dan git status --short dijalankan lebih dulu (lihat bawah) sesuai
kewajiban kerangka kerja poin 1 - worktree bersih, HEAD 6b88464, konsisten dengan context pack.

2. MATRIKS FITUR x DATA
-------------------------
Format: Fitur | Data yang dibutuhkan | Cukup dari skema sekarang? | Bukti

### 2a. Fitur yang SUDAH LIVE (skema sudah cukup, verifikasi ulang)

| Fitur | Data dibutuhkan | Cukup? | Bukti |
|---|---|---|---|
| Stok dasar (produk, currentStock, minStock) | Product.currentStock, Product.minStock | CUKUP | [KODE] schema.prisma:820-821 |
| Riwayat keluar-masuk | StockMovement.qtyChange signed + type enum | CUKUP | [KODE] schema.prisma:846-877 |
| Purchase order + kas keluar | PurchaseOrder + PurchaseOrderItem + soft-link cashTransactionId | CUKUP | [KODE] schema.prisma:879-916 |
| Retur (ke supplier / dari customer) | StockReturn.direction (string bebas) + soft-link | CUKUP | [KODE] schema.prisma:922-947 |
| Skor pemasok | SupplierScore berdiri sendiri per supplierName | CUKUP untuk skor itu sendiri, TIDAK CUKUP untuk menyambungkan skor ke Product tertentu (lihat 3.4) | [KODE] schema.prisma:950-965 |
| Penjualan manual (SALE_OUT + kas masuk) | items[], paymentMethod, kas INCOME otomatis | CUKUP untuk transaksi itu sendiri, TIDAK CUKUP untuk analisa per-pembeli (lihat 3.3) | [KODE] sales/route.ts:1-221 |
| Penyesuaian stok manual | qtyChange + reason wajib (validasi >=3 huruf) | CUKUP | [KODE] stock-adjustments/route.ts:24,36-40 |
| Konsinyasi - valuasi stok + rencana liability saat laku | Product.ownershipType + costPrice, dihitung di consignment-engine.ts | CUKUP | [KODE] consignment-engine.ts:84,163 |
| Konsinyasi - laporan settlement per produk (qty masuk/laku/retur) | StockMovement + StockReturn + Product (agregasi murni) | CUKUP untuk ANGKA, TIDAK CUKUP untuk tahu ke SIAPA disetor dan status SUDAH/BELUM disetor (lihat 3.4 dan 3.5) | [KODE] consignment/report/route.ts:58-101, buildConsignmentReportRows |
| Restock recommendation per produk (bukan per toko) | Product + StockMovement 90 hari (LOOKBACK_DAYS) | CUKUP untuk per-produk, TIDAK CUKUP untuk per-toko/wilayah (lihat 3.3) | [KODE] inventory-intelligence-engine.ts:31,75-172 |
| Deteksi anomali retur | StockMovement + StockReturn dibandingkan | CUKUP | [KODE] inventory-intelligence-engine.ts:199-258 |
| Kontributor profit per produk | Product.costPrice/sellPrice + StockMovement | CUKUP | [KODE] inventory-intelligence-engine.ts:259-317 |
| Dead-stock (produk tidak laku N hari) | currentStock + StockMovement.createdAt terakhir SALE_OUT | CUKUP - murni logika baru, bukan skema baru (dikonfirmasi 2026-09-10-riset-fitur-stok-lanjutan-inventory.md baris 62,130) | [SUMBER] riset-fitur-stok-lanjutan-inventory.md baris 62 |
| Stock turnover | qtySold / avgStock dari StockMovement | CUKUP - murni logika, sama seperti dead-stock | [SUMBER] riset-fitur-stok-lanjutan-inventory.md baris 63,130 |
| Reorder point berbasis lead-time (versi proxy) | selisih createdAt antar StockMovement type PURCHASE_IN berurutan sebagai proxy lead-time | CUKUP untuk versi proxy/estimasi kasar, harus dinarasikan sebagai estimasi bukan angka presisi - versi presisi butuh field tambahan (lihat 3.6, opsional) | [SUMBER] riset-fitur-stok-lanjutan-inventory.md baris 84-91,129 |

### 2b. Fitur yang BELUM ADA di kode, dan skema BELUM CUKUP untuk membangunnya

| Fitur | Data dibutuhkan yang belum ada | Sumber permintaan |
|---|---|---|
| Konversi satuan dus/pcs (Distributor) | Faktor konversi per produk (1 dus = N pcs) + satuan dasar | [SUMBER] roadmap-inventory-ai-distributor.md bagian 6; riset-fitur-stok-lanjutan-inventory.md baris 64,133 |
| FEFO / expiry batch tracking | Tanggal kadaluarsa per BATCH (bukan per produk, karena 1 produk bisa punya banyak batch beda tanggal) | [SUMBER] riset-fitur-stok-lanjutan-inventory.md baris 67,100-105,134-136 |
| Rekomendasi restock per toko/wilayah (Distributor) | Identitas pembeli (nama toko/warung, wilayah/area) terstruktur, bisa dikaitkan ke StockMovement SALE_OUT | [SUMBER] project_klir_segmen_distributor_baru_8sep.md baris 24-26 (contoh: "toko di Depok butuh lebih banyak rokok G bulan depan") |
| CRM sederhana / broadcast ke pelanggan | Entitas pelanggan dengan nomor HP, riwayat beli, untuk segmentasi/follow-up | [SUMBER] project_klir_inventory_umkm_rancangan_tim_online_9sep.md bagian A dan C (CRM AI) |
| Konsinyasi - tahu produk ini titipan supplier SIAPA | Field pemasok di Product (bukan cuma di PurchaseOrder per-transaksi) | Temuan sendiri, lihat 0.5 dan 3.4 |
| Konsinyasi - status settlement (sudah/belum disetor) | Catatan pembayaran/settlement per periode per supplier | Temuan sendiri, lihat 0.6 dan 3.5 |
| E-Faktur/invoice digital ke outlet | Entitas outlet/customer + kemungkinan entitas invoice terpisah dari PurchaseOrder | [SUMBER] riset-fitur-stok-lanjutan-inventory.md baris 66,138 - eksplisit ditandai prioritas rendah |
| Manajemen rute sales harian (kanvas/motoris) | Entitas rute/kunjungan, di luar inti Stok | [SUMBER] riset-fitur-stok-lanjutan-inventory.md baris 65,137 - eksplisit ditandai far-future |

3. USULAN SKEMA ADDITIVE (persis, siap eksekusi kalau disetujui)
------------------------------------------------------------------
Prinsip semua usulan di bawah: NOL mengubah kolom/tabel yang sudah ada (kecuali menambah
kolom baru yang nullable atau punya default), NOL migrasi data, NOL risiko ke baris yang
sudah ada. Pola penamaan/komentar meniru konvensi yang sudah dipakai di schema.prisma
(lihat komentar StockMovement/StockReturn soal "soft-reference" dan "String bebas bukan enum").

### 3.1 Konversi satuan dus/pcs

Tambah 2 kolom nullable di model Product (schema.prisma:808-833):

```
model Product {
  ...
  packSize    Int?     @default(1) @map("pack_size")
  packUnit    String?  @db.VarChar(50) @map("pack_unit")
  ...
}
```

- packSize: berapa pcs dalam 1 satuan besar (contoh: 1 dus = 200 pcs -> packSize=200).
  Default 1 supaya SEMUA produk lama otomatis "1 pack = 1 unit" (tidak ada perubahan
  perilaku untuk produk yang tidak pakai konversi).
- packUnit: nama satuan besar itu sendiri (contoh "dus", "lusin", "krat"). Nullable, kalau
  kosong berarti produk ini tidak pakai konsep pack (dijual satuan langsung, cocok UMKM kecil).
- unit (kolom lama, schema.prisma:814) tetap jadi satuan JUAL/tampil (pcs, kg, dst) - tidak
  diubah maknanya sama sekali.
- Risiko ke data lama: NOL. packSize default 1 berarti "1 dus = 1 pcs" secara matematis kalau
  tidak diisi ulang - artinya kalau kode baru nanti salah baca packSize sebelum diisi manual,
  hasil kalinya tetap sama dengan angka currentStock asli (aman, bukan mengalikan dengan 0
  atau angka acak).
- Index: tidak perlu index baru, packSize/packUnit bukan kolom yang di-filter/di-sort.

### 3.2 FEFO / batch kadaluarsa

Model baru (bukan kolom di Product, karena 1 produk bisa punya banyak batch beda tanggal -
alasan ini sudah dikonfirmasi di riset-fitur-stok-lanjutan-inventory.md baris 134-136):

```
model ProductBatch {
  id          String    @id @default(uuid()) @db.Uuid
  workspaceId String    @map("workspace_id") @db.Uuid
  productId   String    @map("product_id") @db.Uuid
  batchCode   String?   @db.VarChar(100) @map("batch_code")
  expiryDate  DateTime  @map("expiry_date")
  qty         Float
  // Soft-link (bukan relasi Prisma) ke sumber batch ini masuk -- meniru pola
  // StockMovement.sourceType/sourceId. Mis. sourceType="purchase_order".
  sourceType  String?   @db.VarChar(50) @map("source_type")
  sourceId    String?   @db.Uuid @map("source_id")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  product     Product   @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([workspaceId, productId, expiryDate])
  @@index([workspaceId, expiryDate])
  @@map("product_batches")
}
```

- workspaceId disertakan langsung (walau bisa didapat lewat productId->Product.workspaceId)
  supaya konsisten pola tenant-first semua model lain di file ini (StockMovement, StockReturn
  semua begitu) dan supaya query "produk apa saja yang mau kadaluarsa minggu ini di workspace
  X" tidak perlu join lewat Product dulu.
- Tambah 1 baris relasi balik di model Workspace (schema.prisma:54-93, pola persis baris
  `products Product[]` dst): `productBatches ProductBatch[]`. Tambah juga di model Product:
  `batches ProductBatch[]`.
- Risiko ke data lama: NOL - tabel baru, kosong sampai ada yang mengisi. Produk yang tidak
  butuh FEFO (mayoritas UMKM kecil) cukup tidak pernah punya baris di tabel ini.
- CATATAN DESAIN (bukan risiko ke data lama, tapi risiko ke integritas data BARU kalau dipakai
  serampangan, WAJIB didiskusikan Fatur sebelum dipakai produksi): begitu sebuah Product mulai
  punya baris ProductBatch, ada 2 kemungkinan sumber kebenaran stok - Product.currentStock
  (angka tunggal, cara lama) vs SUM(ProductBatch.qty) WHERE productId=X (cara baru per-batch).
  Diputuskan sementara (paling sederhana, tinggal dikoreksi kalau Fatur mau lain): Product.
  currentStock TETAP jadi sumber kebenaran utama untuk semua fitur lama (restock, dead-stock,
  turnover, dsb, semua sudah baca currentStock) - ProductBatch HANYA dipakai fitur BARU (alert
  kadaluarsa, urutan FEFO saat StockMovement SALE_OUT dibuat). qty di ProductBatch harus
  dikurangi manual oleh endpoint baru bersamaan dengan Product.currentStock dikurangi (dalam
  $transaction yang sama), supaya 2 angka itu tidak pernah lepas sinkron - tapi ini kewajiban
  kode baru nanti, bukan sesuatu yang dijamin otomatis oleh skema ini sendiri.

### 3.3 Customer/Outlet (Distributor: pelanggan/toko + wilayah)

Model baru:

```
model Customer {
  id          String    @id @default(uuid()) @db.Uuid
  workspaceId String    @map("workspace_id") @db.Uuid
  name        String    @db.VarChar(150)
  phone       String?   @db.VarChar(50)
  address     String?
  // Bebas teks, bukan enum -- konsisten pola "unit"/"ownershipType"/"direction" di file ini.
  // Contoh isi: "Depok", "Bekasi Timur", nama wilayah bebas sesuai input user.
  area        String?   @db.VarChar(100)
  // Bebas teks juga, contoh "WARUNG", "TOKO", "LAINNYA" -- bukan enum supaya tidak kaku
  // kalau nanti ada istilah baru dari survei Distributor vs UMKM yang belum selesai
  // (roadmap Fase 5, masih menunggu hasil survei tim online).
  type        String    @default("LAINNYA") @db.VarChar(20)
  notes       String?
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, area])
  @@index([workspaceId, name])
  @@map("customers")
}
```

Plus 1 kolom nullable baru di StockMovement (schema.prisma:846-877), supaya penjualan yang
sudah dicatat via StockMovement SALE_OUT bisa dikaitkan ke pembeli terstruktur:

```
model StockMovement {
  ...
  customerId  String?   @map("customer_id") @db.Uuid
  ...
  customer    Customer? @relation(fields: [customerId], references: [id], onDelete: SetNull)
  ...
  @@index([workspaceId, customerId, createdAt])
}
```

- Kenapa taruh customerId di StockMovement (bukan di CashTransaction): restock recommendation
  per-toko/wilayah butuh GROUP BY customerId dari baris SALE_OUT (data barang keluar), bukan
  dari sisi kas. Ini juga menghindari menyentuh CashTransaction (model yang sudah dipakai lane
  Finance/Fatur di banyak tempat lain) - additive paling minimal ada di StockMovement yang
  memang sudah milik Modul 7.
- onDelete: SetNull (bukan Cascade) - kalau Customer dihapus, histori StockMovement lama TETAP
  ada (cuma customerId-nya jadi null), tidak ikut hilang. Konsisten pola User?/uploader di
  WorkspaceFile (schema.prisma:588-627) yang juga SetNull.
- Risiko ke data lama: NOL - customerId nullable, semua StockMovement lama otomatis null
  (artinya "pembeli tidak dicatat terstruktur", yang memang kondisi saat ini apa adanya, bukan
  data yang salah).
- Field `customerName` yang sekarang cuma ditempel ke CashTransaction.description (sales/
  route.ts:54,103-105) TIDAK perlu dihapus/diubah - biarkan tetap ada sebagai catatan teks
  bebas untuk kasus pembeli yang belum terdaftar sebagai Customer (mis. pembeli lewat/jalan,
  bukan toko langganan). customerId di StockMovement OPSIONAL, dipakai hanya kalau endpoint
  baru nanti memang mau mengaitkan ke Customer yang sudah terdaftar.
- Tambah 1 baris relasi balik di Workspace: `customers Customer[]`.

### 3.4 Product - link ke pemasok (supplierName)

Tambah 1 kolom nullable di Product:

```
model Product {
  ...
  supplierName String? @db.VarChar(150) @map("supplier_name")
  ...
}
```

- Soft-reference (bukan foreign key Prisma) ke SupplierScore.supplierName (schema.prisma:953)
  dan/atau PurchaseOrder.supplierName (schema.prisma:884) - meniru PERSIS pola
  sourceType/sourceId yang sudah dipakai di StockMovement dan StockReturn (match by string,
  bukan relasi formal), karena SupplierScore memang sengaja "berdiri sendiri" (komentar
  schema.prisma:948-949: "TIDAK terhubung ke CompanyHealthScore").
- Kenapa perlu: sekarang laporan settlement konsinyasi (consignment/report/route.ts) bisa
  bilang "produk X, qty terjual Y, kewajiban Rp Z" TAPI TIDAK BISA bilang "ke supplier siapa
  Rp Z ini harus disetor" - satu-satunya cara tahu supplier sekarang adalah tebak dari
  PurchaseOrder terakhir produk itu (tidak reliable, PurchaseOrder per-transaksi bukan
  per-produk-default, dan produk konsinyasi belum tentu pernah punya PurchaseOrder sama
  sekali kalau titipannya bukan lewat alur beli-putus).
- Risiko ke data lama: NOL - nullable, semua produk lama otomatis null (artinya "pemasok
  belum dicatat", bukan data salah).
- Berlaku untuk SEMUA produk (bukan cuma yang CONSIGNED) - juga berguna untuk fitur masa
  depan "vendor split-order"/"spend analytics" yang disebut dokumen rancangan tim online
  (Claude-Code-Memory\project_klir_inventory_umkm_rancangan_tim_online_9sep.md bagian C,
  "rekomendasi alokasi vendor").

### 3.5 Konsinyasi - status settlement (opsional, prioritas sedang)

Model baru, HANYA kalau Mecca mau fitur "tandai sudah disetor ke supplier" (belum ada di
sumber manapun secara eksplisit sebagai permintaan - ini temuan saya sendiri lewat audit
consignment/report/route.ts yang murni stateless):

```
model ConsignmentSettlement {
  id            String    @id @default(uuid()) @db.Uuid
  workspaceId   String    @map("workspace_id") @db.Uuid
  supplierName  String    @db.VarChar(150) @map("supplier_name")
  periodFrom    DateTime  @map("period_from")
  periodTo      DateTime  @map("period_to")
  amountPaid    Float     @map("amount_paid")
  paidAt        DateTime? @map("paid_at")
  userId        String?   @map("user_id") @db.Uuid
  note          String?
  createdAt     DateTime  @default(now()) @map("created_at")

  workspace     Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user          User?     @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([workspaceId, supplierName, periodFrom])
  @@map("consignment_settlements")
}
```

- Ini murni CATATAN "sudah dibayar", bukan pengganti perhitungan (buildConsignmentReportRows
  tetap jadi sumber kebenaran ANGKA yang harus dibayar - tabel ini cuma menjawab "apakah sudah
  dibayar", dicocokkan manual oleh user berdasar periode yang sama dengan yang dia lihat di
  laporan).
- Risiko ke data lama: NOL - tabel baru kosong, tidak menyentuh apapun yang sudah ada.
- Kalau Mecca menilai ini belum perlu sekarang (laporan angka saja sudah cukup untuk MVP),
  diputuskan sementara: TUNDA usulan 3.5 ini, cukup catat di sini supaya tidak hilang kalau
  nanti ditanyakan lagi. Prioritas saya taruh di bawah 3.1-3.4 karena tidak ada sumber
  permintaan eksplisit, murni temuan audit sendiri.

### 3.6 PurchaseOrder - pisah tanggal order vs tanggal terima (OPSIONAL, prioritas rendah)

TIDAK saya jadikan usulan wajib - sumber sendiri (riset-fitur-stok-lanjutan-inventory.md
baris 84-91) eksplisit bilang versi v1 reorder-point cukup pakai proxy dari selisih
`StockMovement.createdAt` antar PURCHASE_IN berurutan, TANPA butuh skema baru. Saya catat di
sini murni supaya kalau nanti presisi mau dinaikkan, opsinya sudah tertulis:

```
model PurchaseOrder {
  ...
  orderedAt   DateTime? @map("ordered_at")
  ...
}
```

- purchaseDate (kolom lama, schema.prisma:889, required) tetap dimaknai "tanggal transaksi
  dicatat/barang diterima" seperti sekarang - TIDAK diubah.
- orderedAt baru, nullable, kalau diisi berarti "tanggal PO dibuat/dipesan ke supplier" -
  selisih (purchaseDate - orderedAt) = lead-time aktual per PO, jauh lebih akurat dari proxy
  StockMovement.
- Risiko ke data lama: NOL - nullable, PO lama otomatis null (lead-time PO lama tetap pakai
  proxy lama, tidak ada yang berubah).
- Status: TUNDA, bukan prioritas dekat. Cukup dicatat di sini.

### 3.7 Fitur far-future yang sengaja TIDAK saya detailkan skemanya

- E-Faktur/invoice digital ke outlet: butuh keputusan desain lebih besar (entitas Invoice
  terpisah dari PurchaseOrder atau extend Invoice yang sudah ada dengan customerId opsional
  ke model Customer di 3.3) - riset-fitur-stok-lanjutan-inventory.md baris 66,138 sendiri
  menandai ini prioritas rendah dan "kemungkinan YA butuh entitas baru", belum presisi. Saya
  tidak mau menebak desain detailnya sekarang karena effort-nya besar dan sinyal prioritas
  dari sumber manapun masih lemah - lebih baik didiskusikan terpisah saat memang mau dikerjakan.
- Manajemen rute sales harian (kanvas/motoris): eksplisit "di luar inti Stok" dan "far-future"
  di riset-fitur-stok-lanjutan-inventory.md baris 65,112-113,137. Tidak saya detailkan sama
  sekali sesuai arahan sumber sendiri.

4. RINGKASAN PRIORITAS USULAN SKEMA (urutan, bukan wajib berurutan - keputusan Mecca)
----------------------------------------------------------------------------------------
```
1. 3.1 Konversi satuan (Product.packSize, Product.packUnit)   - 2 kolom, risiko nol, dipakai
   langsung Fase 4 roadmap + prioritas 5 riset fitur.
2. 3.3 Customer/Outlet + StockMovement.customerId             - 1 model + 1 kolom, dipakai
   langsung untuk klaim "restock per toko/wilayah" yang sudah dijanjikan ke MegaCo/proposal
   Distributor 15 Sept - RISIKO KALAU DITUNDA: proposal jalan tanpa bukti data per-toko.
3. 3.4 Product.supplierName                                   - 1 kolom, kecil, menutup gap
   konsinyasi "ke siapa disetor" yang sudah ditemukan sesi ini.
4. 3.2 ProductBatch (FEFO)                                     - 1 model, tapi butuh diskusi
   Fatur soal desain sinkronisasi qty (catatan desain di 3.2), jangan dikerjakan buru-buru.
5. 3.5 ConsignmentSettlement (opsional)                        - tunda sampai ditanyakan.
6. 3.6 PurchaseOrder.orderedAt (opsional)                      - tunda, v1 cukup proxy.
7. 3.7 E-Faktur, Route Plan                                    - far-future, belum didetailkan.
```

5. BUTUH_DARI_TIM
------------------
- scan-kode-modul7 (agent B): tolong konfirmasi ulang apakah ada endpoint/fungsi lain di
  KlirInventoryView.tsx yang membaca field yang BELUM saya cek (saya fokus schema+API+engine,
  tidak baca penuh KlirInventoryView.tsx baris per baris) - kalau ada asumsi field yang beda
  dari yang saya tulis di sini, tolong ditandai supaya sinkron sebelum komando menyusun
  kontrak bangun.
- scan-permintaan-modul7 (agent A): kalau ada baris permintaan dari transkrip 8 Sep
  (pakwisnu1.txt, pakwisnukames2.txt, sep8-update-distribute-umkm.txt, voice-260908.txt) yang
  saya LEWATKAN soal kebutuhan data spesifik (saya tidak membaca ulang 4 file transkrip
  mentah itu langsung, saya sandarkan ke ringkasan project_klir_segmen_distributor_baru_8sep.md
  yang sudah membaca 4 file itu) - tolong flag kalau ada detail data yang beda dari ringkasan
  itu.

6. PERINGATAN_UNTUK_TIM
-------------------------
- Ke scan-portal-ceo/finance/marketing (agent D/E/F): kalau kalian mengusulkan kartu dashboard
  "restock per toko/wilayah" atau sejenisnya di dokumen kalian, WAJIB sebut bahwa data
  pendukungnya BELUM ADA (butuh Customer/Outlet, lihat 3.3 dokumen ini) - jangan sampai
  kartu itu diusulkan seolah tinggal tampilkan, padahal datanya belum terstruktur.
- Ke komando/batch bangun berikutnya: field `customerName` di sales/route.ts:54 SEKARANG
  cuma teks bebas ditempel ke deskripsi CashTransaction - kalau nanti endpoint sales diubah
  untuk menerima customerId (memakai model Customer usulan 3.3), JANGAN hapus dukungan
  customerName teks bebas sekaligus, karena tidak semua transaksi (pembeli lewat/jalan) akan
  punya Customer terdaftar.

7. CATATAN_JUJUR
------------------
- Saya TIDAK membuka ulang file docx asli "KLIR Inventory dan UMKM rancangan.docx" lewat
  python-docx - saya sandarkan sepenuhnya ke ringkasan
  Claude-Code-Memory\project_klir_inventory_umkm_rancangan_tim_online_9sep.md yang sudah
  ditulis sesi 9 Sep (disebut di situ "dibaca penuh via python-docx, 190 blok"). Kalau ada
  detail kebutuhan data yang ada di docx asli tapi tidak masuk ringkasan itu, saya TIDAK
  melihatnya sama sekali.
- Saya TIDAK membaca ulang 4 transkrip mentah _transkrip-8sep/ (pakwisnu1.txt, dst) satu per
  satu - saya sandarkan ke ringkasan project_klir_segmen_distributor_baru_8sep.md. Kutipan
  "toko di Depok butuh lebih banyak rokok G" saya ambil dari ringkasan itu, bukan dari
  transkrip asli langsung.
- Saya TIDAK membaca KlirInventoryView.tsx (UI tab) satu per satu baris - fokus saya schema +
  API + engine sesuai tugas C. Kalau ada field yang dipakai UI tapi tidak ada di API/schema
  yang saya baca, saya tidak akan menangkapnya - itu wilayah agent B (scan-kode-modul7).
  Sudah saya tulis di butuh_dari_tim di atas.
- Semua usulan skema di bagian 3 adalah DESAIN SAYA SENDIRI berdasar pola yang sudah ada di
  schema.prisma (saya tiru konvensi penamaan/komentar/soft-reference yang sudah dipakai) -
  BUKAN skema yang sudah disetujui Fatur/Mecca. Nama kolom/model bisa berubah kalau Fatur
  punya preferensi lain saat implementasi nyata. Yang saya jamin: setiap usulan additive
  (nullable atau model baru), nol migrasi data, nol perubahan makna kolom lama.
- Saya tidak menjalankan `prisma validate` atau `prisma format` terhadap skema usulan di atas
  (karena ini baca-saja, tidak boleh edit prisma/schema.prisma) - sintaks Prisma di atas saya
  tulis manual mengikuti pola file asli, ada kemungkinan kecil typo sintaks yang baru ketahuan
  saat benar-benar dijalankan `prisma db push`. Tim bangun WAJIB validasi ulang sebelum push.
- git log --oneline -5 dan git status --short sudah saya jalankan di awal (HEAD 6b88464,
  worktree bersih) - konsisten dengan context pack, tidak ada kejutan commit baru saat saya
  mulai kerja.
