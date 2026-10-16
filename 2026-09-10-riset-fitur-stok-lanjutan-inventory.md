Riset Fitur Stok Lanjutan - Inventory KLIR
============================================
Ditulis 10 September 2026 oleh agent riset (Sonnet, tim Claude Code KLIR).
NOL edit kode - ini murni riset, dasar keputusan Fatur/komando/Mecca.

1. RINGKASAN (10 baris)
-----------------------
1. Fondasi Stok/Purchasing/Kasir sudah ada di schema Prisma (Product, StockMovement,
   PurchaseOrder, PurchaseOrderItem, StockReturn, SupplierScore) dan 7 endpoint API sudah
   jalan (consignment, photo-to-stock, products, purchase-orders, returns, stock-movements,
   supplier-score) - fondasi ini SUDAH SETARA fitur inti kompetitor kelas UMKM (Kasir Pintar,
   Majoo, Cliffbiz) dan sudah mulai mendekati fitur distributor (SimpliDOTS).
2. Belum ada di KLIR: penjualan keluar manual lewat form (baru wired via sales endpoint yang
   sedang dibangun paralel oleh agent lain sesi ini), penyesuaian stok manual, laporan
   settlement konsinyasi terformat, engine dead-stock/turnover, dan konversi satuan dus/pcs.
3. Kompetitor UMKM (SantaiScale, Cliffbiz, Kasir Pintar, Majoo) rata-rata masih AI PASIF
   (hitung/rekap doang) - KLIR sudah punya arah AI proaktif (inventory-intelligence-engine.ts)
   yang lebih maju dari semua kompetitor yang ditemukan di riset ini.
4. Kompetitor distributor (SimpliDOTS) sudah lebih dulu punya fitur yang KLIR belum:
   konversi karton-ke-pieces tanpa hitung manual, manajemen rute sales harian, e-Faktur.
   Ini gap nyata kalau KLIR mau serius masuk segmen Distributor (proposal Adnan/Medi target
   15 September).
5. FEFO (First Expired First Out) untuk produk kadaluarsa adalah fitur umum di software
   inventory modern (Mekari Desty, PaYou, Jubelio) tapi TIDAK ADA sama sekali di schema KLIR
   sekarang - Product tidak punya field tanggal kadaluarsa/batch. Ini gap nyata tapi butuh
   skema baru, jadi HARUS nunggu Fatur.
6. Dead-stock analysis (produk gak laku >60-90 hari) adalah standar industri retail/F&B
   cepat-putar - angka 60 hari yang sudah diusulkan di roadmap Fase-1 (inventory-
   intelligence-engine) SESUAI dengan benchmark industri yang ditemukan di riset ini.
7. Reorder point/safety stock formula standar (rata-rata pemakaian harian x lead time +
   buffer) belum diimplementasi di KLIR - yang ada baru bandingkan currentStock vs minStock
   statis (belum baca histori kecepatan jual). Ini upgrade masuk akal untuk versi
   buildRestockRecommendations yang lebih matang, TAPI additive (nambah logika, bukan skema).
8. Semua kompetitor yang diriset (baik UMKM maupun distributor) TIDAK ADA yang punya AI
   proaktif model "tombol solusi instan" seperti yang sudah didesain di dokumen roadmap
   tim online (Adnan/Medi, 9 Sept) - artinya KLIR punya celah diferensiasi kalau engine
   yang sudah ada (inventory-intelligence-engine.ts, consignment-engine.ts) dituntaskan dan
   di-mount ke UI, bukan cuma perlu fitur baru.
9. Prioritas 5 item di bagian 3 berfokus pada: (a) tuntaskan yang ADDITIVE-SAFE dan sudah
   ada infra pendukung, (b) baru masuk ke fitur yang butuh skema baru setelah didiskusikan
   ke Fatur.
10. Tidak ditemukan sumber independen yang membahas spesifik "istilah stok vs storage untuk
    distributor Indonesia" (poin yang masih disurvei tim online) - klaim soal istilah ini
    di dokumen lain HARUS tetap ditandai belum ada sumber pasar, bukan diasumsikan.

2. TABEL FITUR
---------------
Format kolom: Nama | Ada di KLIR? | Nilai UMKM | Nilai Distributor | Butuh skema baru? |
Risiko salah hitung | Sumber

| Nama fitur | Ada di KLIR? | Nilai UMKM | Nilai Distributor | Butuh skema baru? | Risiko salah hitung | Sumber |
|---|---|---|---|---|---|---|
| Stok dasar (produk, currentStock, minStock) | ADA - prisma/schema.prisma:808-843 (model Product), endpoint src/app/api/v1/inventory/products/route.ts | Tinggi - fondasi wajib | Tinggi - fondasi wajib | Tidak | Rendah (sudah ada validasi SKU 409 per f2990a6) | internal - audit kode langsung |
| Riwayat keluar-masuk (StockMovement signed qtyChange) | ADA - prisma/schema.prisma:846-877, endpoint stock-movements/route.ts | Tinggi | Tinggi | Tidak | Rendah - sudah append-only + index (workspaceId,type) | internal |
| Purchase Order + kas keluar otomatis | ADA - prisma/schema.prisma:879-916, purchase-orders/route.ts baris 82-198 ($transaction) | Tinggi | Tinggi | Tidak | Sedang - kalau lupa invalidateContextCache, dashboard kas bisa telat sinkron (sudah ditangani di kode existing) | internal |
| Retur (ke supplier / dari customer) | ADA - prisma/schema.prisma:918-949, returns/route.ts | Sedang | Tinggi (retur/tukar-guling umum di distributor - dikonfirmasi SimpliDOTS) | Tidak | Sedang - retur yang gak sepadan sama movement sebelumnya harus ditandai (sudah ada di buildInventoryReply, detectReturnAnomalies) | SimpliDOTS blog (simplidots.com/blog/fitur-aplikasi-distribusi-simplidots-membantu-bisnis-anda) |
| Skor pemasok (SupplierScore) | ADA - prisma/schema.prisma:951-968, supplier-score/route.ts | Sedang | Tinggi | Tidak | Sedang - skor butuh histori data cukup, kalau data tipis skor bisa menyesatkan (jujur di zero-state) | internal, selaras roadmap tim online "Skor Keandalan Pemasok" |
| Konsinyasi (titip jual, ownershipType CONSIGNED) | ADA sebagian - consignment-engine.ts (calculateStockValueBreakdown, planConsignmentSaleLiability), consignment/route.ts (GET+PATCH) TAPI laporan settlement (berapa laku vs balik, kapan bayar supplier) BELUM ADA | Sedang | Tinggi (umum di FMCG/rokok - pabrik titip ke distributor) | Tidak (data sudah ada di StockMovement+StockReturn, tinggal agregasi) | Sedang - kalau logika hitung "sudah laku vs belum" salah, bisa salah tagih ke supplier | internal + SantaiScale/Cliffbiz riset kompetitor (lihat memory project_klir_competitor_research) |
| Penjualan keluar manual (SALE_OUT + kas masuk) | BELUM ADA endpoint dedicated (sedang dibangun paralel oleh agent lain sesi ini, kontrak POST /api/v1/inventory/sales) | Tinggi - kasir kecil tanpa integrasi POS penuh butuh cara catat manual | Sedang | Tidak | Sedang - kalau stok jadi minus karena race condition, harus ditolak di $transaction (pola sudah ada di purchase-orders) | internal (gap ditemukan sendiri lewat audit endpoint yang ada) |
| Penyesuaian stok manual (ADJUSTMENT_IN/OUT) | BELUM ADA endpoint dedicated (sedang dibangun paralel, kontrak POST /api/v1/inventory/stock-adjustments) | Tinggi - opname stok fisik, barang rusak/hilang | Tinggi | Tidak | Sedang - HARUS wajib alasan (reason), kalau tidak jadi lubang manipulasi angka | internal |
| Reorder point / safety stock formula (bukan cuma minStock statis) | BELUM ADA - buildRestockRecommendations baru pola sederhana (histori dasar), belum pakai formula lead-time+buffer | Sedang | Tinggi (distributor butuh presisi karena skala besar) | Tidak - murni logika, currentStock/minStock/StockMovement sudah cukup data | Tinggi kalau dipaksakan tanpa data lead-time yang akurat - reorder point butuh rata-rata lead time supplier yang KLIR belum punya field-nya secara eksplisit (PurchaseOrder.purchaseDate ada, tapi tanggal "order dibuat" vs "barang diterima" belum dipisah) | inflowinventory.com/blog/reorder-point-formula-safety-stock, netstock.com/blog/reorder-point-formula, mrpeasy.com/blog/what-is-reorder-point-and-reorder-point-formula |
| Dead-stock / stok mati (produk gak laku N hari) | BELUM ADA (diusulkan di roadmap Fase-1 lanjutan, buildDeadStock, sedang dibangun paralel oleh agent lain sesi ini) | Tinggi | Tinggi | Tidak - currentStock+StockMovement cukup | Rendah-sedang - ambang 60 hari harus dijelaskan sebagai heuristik, bukan angka mutlak (industri pakai 60-90 hari untuk retail/FnB cepat-putar, 90-180 hari untuk fashion/elektronik - KLIR generik UMKM, 60 hari wajar sebagai default tapi HARUS bisa disebut jujur kalau data historinya pendek) | jubelio.com/dead-stock, foliopos.com/blog/detail/cara-menghindari-stok-mati-agar-barang-tidak-menumpuk-di-gudang |
| Stock turnover / perputaran stok | BELUM ADA (diusulkan paralel, buildStockTurnover) | Sedang | Tinggi | Tidak | Sedang - turnover = qtySold/avgStock, kalau avgStock dihitung cuma dari currentStock snapshot (bukan rata-rata periode) angkanya jadi kurang akurat secara akuntansi - HARUS dinarasikan sebagai estimasi, bukan angka presisi | internal (gap analisis sendiri) + benchmark umum inventory turnover ratio (netstock.com, mrpeasy.com) |
| Konversi satuan (1 dus = N pcs) | BELUM ADA - Product.unit cuma teks bebas, tidak ada faktor konversi (schema.prisma:815) | Rendah (UMKM kecil biasanya jual satuan) | Tinggi - distributor WAJIB (dus ke pabrik, pcs ke warung) | YA - butuh field baru di Product (mis. unitConversionFactor, baseUnit) | Tinggi kalau ditebak sendiri tanpa skema resmi - risiko salah hitung stok kalau konversi cuma di layer UI tanpa jaminan konsistensi data | SimpliDOTS ("satuan karton dapat dibandingkan dengan pieces tanpa konversi manual" - simplidots.com/blog/fitur-aplikasi-distribusi-simplidots-membantu-bisnis-anda) |
| Manajemen rute sales harian (Route Plan) | BELUM ADA, TIDAK diusulkan di roadmap manapun sejauh ini | Rendah (tidak relevan UMKM toko fisik) | Tinggi (distributor kanvas/motoris) | YA - butuh entitas baru (SalesRoute/Visit), di luar scope Stok murni | Rendah risiko hitung (ini fitur operasional, bukan finansial), tapi effort besar - kandidat far-future, bukan prioritas dekat | simplidots.com/blog/sales-motoris-kanvasing-dan-taking-order, qontak.com/blog/sales-distribution-software |
| E-Faktur / invoice digital ke outlet | BELUM ADA | Rendah | Sedang-Tinggi (distributor FMCG butuh bukti resmi ke outlet) | Kemungkinan YA (entitas Invoice terpisah dari PurchaseOrder) | Sedang - kalau digabung serampangan ke PurchaseOrder yang sudah ada, bisa mengacaukan makna field yang sudah dipakai purchasing | simplidots.com/blog/fitur-aplikasi-distribusi-simplidots-membantu-bisnis-anda |
| FEFO / kadaluarsa produk (expiry batch tracking) | BELUM ADA - tidak ada field tanggal kadaluarsa/batch di Product atau StockMovement | Sedang (makanan/minuman/obat) | Sedang | YA - butuh field expiryDate dan/atau tabel batch terpisah (satu produk bisa punya banyak batch beda tanggal) | Tinggi kalau dipaksa additive tanpa skema batch - satu Product.currentStock sekarang cuma angka tunggal, tidak bisa merepresentasikan "500 pcs batch A kadaluarsa besok + 300 pcs batch B kadaluarsa bulan depan" tanpa tabel baru | mekari.com/blog/software-inventory-terbaik-umkm (Mekari Desty), payou.asia/inventory, jubelio.com/solusi/solusi-metode-fefo-untuk-kelola-stok-barang-di-gudang |
| Visual search / smart search bahasa natural produk | BELUM ADA | Rendah-Sedang | Rendah | Tidak (fitur AI di atas Product yang sudah ada) | Rendah - murni fitur pencarian, gak sentuh angka stok/kas | roadmap tim online (project_klir_inventory_umkm_rancangan_tim_online_9sep) - belum ada sumber pasar independen ditemukan spesifik soal ini, "tidak ditemukan sumber" untuk klaim demand pasar |
| CRM/broadcast AI terhubung ke stok (mis. stok habis -> broadcast ke pelanggan lama) | BELUM ADA | Sedang | Rendah | Tidak untuk versi sederhana (pakai data Product+CashTransaction yang ada) | Sedang - kalau broadcast otomatis salah target (nomor HP salah), berpotensi ganggu pelanggan - HARUS approve manual dulu, tidak boleh auto-kirim | roadmap tim online, belum ada sumber pasar independen spesifik ditemukan |

3. PRIORITAS USULAN - 5 ITEM BERIKUTNYA
-----------------------------------------
Urutan di bawah ini MELANJUTKAN (bukan menggantikan) urutan Fase 0-5 yang sudah ditulis di
2026-09-10-roadmap-inventory-ai-distributor.md - fokus riset ini adalah memperkuat alasan
kenapa urutan itu masuk akal dibanding kompetitor, dan menambah 2 kandidat baru yang belum
tercantum di roadmap itu (reorder point berbasis lead-time, dan FEFO).

1. Tuntaskan Fase 0-3 yang sudah dirintis sesi ini (mount UI Stok & Pembelian, engine
   inventory-intelligence, low-stock alert, laporan konsinyasi) - SEMUA kompetitor yang
   diriset (SantaiScale, Cliffbiz, Kasir Pintar) belum ada yang menggabungkan keempatnya
   dalam satu AI Assistant yang sama. Ini murni menuntaskan yang sudah dibangun, risiko
   paling rendah, dan langsung jadi bukti konkret untuk proposal Distributor 15 September.

2. Reorder point berbasis kecepatan jual + lead time (upgrade buildRestockRecommendations).
   Alasan: kompetitor distributor sekelas SimpliDOTS sudah standar di titik ini, dan formula
   reorder-point (rata-rata pemakaian harian x lead time + buffer) adalah baku industri
   (inflowinventory.com, netstock.com, mrpeasy.com) - bukan cuma bandingkan currentStock vs
   minStock statis. Ini ADDITIVE (logika baru di atas data StockMovement yang sudah ada),
   tapi HARUS jujur soal keterbatasan: KLIR belum punya field lead-time eksplisit per
   supplier, jadi estimasi awal harus pakai selisih createdAt StockMovement PURCHASE_IN
   berurutan sebagai proxy, dan dinarasikan sebagai estimasi kasar, bukan angka presisi.

3. Dead-stock + stock turnover (buildDeadStock, buildStockTurnover) - sudah diusulkan
   paralel di sesi ini, riset ini MENGKONFIRMASI ambang 60 hari yang diusulkan roadmap
   sesuai benchmark industri retail/F&B cepat-putar (60-90 hari, foliopos.com). Prioritas
   tinggi karena dead-stock adalah salah satu masalah paling konkret yang dikeluhkan di
   riset kompetitor (modal terkunci, gudang penuh) dan datanya sudah tersedia (currentStock
   + StockMovement), murni ADDITIVE.

4. Diskusi Fatur soal skema FEFO/expiry batch. Alasan naik prioritas dibanding Fase 4
   (konversi satuan) di roadmap lama: FEFO punya nilai UMKM (makanan/minuman) DAN Distributor
   (rokok, obat, consumer goods dengan tanggal produksi) sekaligus, sementara konversi satuan
   dus/pcs nilainya lebih spesifik ke Distributor saja. Tapi INI TETAP BUTUH SKEMA BARU
   (field expiryDate atau tabel batch terpisah) - jadi statusnya sama seperti Fase 4:
   proposal ke Fatur, bukan dikerjakan sepihak.

5. Konversi satuan dus/pcs (Fase 4 di roadmap lama, tetap relevan, cuma turun satu posisi
   dari usulan riset ini). Distributor (SimpliDOTS) sudah punya ini sebagai fitur standar,
   proposal Distributor 15 September kemungkinan akan ditanya soal ini oleh calon klien.
   Tetap harus menunggu Fatur karena butuh field skema baru di Product.

Yang SENGAJA tidak masuk 5 besar (dicatat supaya tidak hilang, bukan diabaikan permanen):
Route Plan/manajemen kunjungan sales harian dan E-Faktur - keduanya valid untuk segmen
Distributor murni, tapi effort besar (entitas baru, di luar inti Stok) dan belum ada sinyal
kuat dari MegaCo/proposal Adnan-Medi bahwa ini yang paling dibutuhkan duluan. Visual
search dan CRM broadcast juga ditunda - nilainya nyata tapi levelnya "nice to have" versus
5 item di atas yang langsung menjawab keluhan konkret UMKM/Distributor (modal terkunci di
stok mati, salah hitung reorder, titip-jual yang gak jelas kapan settle).

4. BUTUH FATUR (skema) vs ADDITIVE-SAFE
------------------------------------------
ADDITIVE-SAFE (aman dikerjakan tanpa nunggu Fatur, nol perubahan skema):
- Mount UI Stok & Pembelian ke dashboard (Fase 0 roadmap)
- inventory-intelligence-engine.ts: restock recommendation, low-stock alert, return anomaly,
  profit contributor (Fase 1-2 roadmap, sudah sebagian jalan)
- Laporan konsinyasi (agregasi dari data yang sudah ada, Fase 3 roadmap)
- Endpoint penjualan manual (SALE_OUT) dan penyesuaian stok manual (ADJUSTMENT_IN/OUT) -
  keduanya pakai enum StockMovementType yang SUDAH ADA di schema, tinggal endpoint+UI
- Reorder point berbasis lead-time proxy (item 2 prioritas) - murni logika baru
- Dead-stock + stock turnover (item 3 prioritas) - murni logika baru dari data yang ada

HARUS MENUNGGU FATUR (perubahan skema Prisma):
- Konversi satuan dus/pcs (field baru di Product, mis. unitConversionFactor/baseUnit)
- FEFO/expiry batch tracking (field expiryDate di Product ATAU tabel ProductBatch baru -
  ini keputusan desain skema yang lebih besar, currentStock sekarang cuma angka tunggal per
  produk, tidak bisa pecah per batch tanpa tabel baru)
- Route Plan/manajemen kunjungan sales (entitas baru sepenuhnya, di luar prioritas dekat)
- E-Faktur/invoice digital (kemungkinan entitas baru terpisah dari PurchaseOrder)
- Diferensiasi istilah Distributor vs UMKM (Fase 5 roadmap) - ini bukan skema tapi
  keputusan produk yang menunggu hasil survei tim online, dicatat di sini supaya tidak
  ditebak sepihak juga

5. DAFTAR SUMBER
------------------
Internal (dibaca penuh sebelum riset web, per kontrak):
- memory: project_klir_competitor_research_ramoo_santaiscale_medi_3sep.md
- memory: project_klir_segmen_distributor_baru_8sep.md
- memory: project_klir_meet_fundamental_umkm_stok_kasir_3sep.md
- Claude-Code-Memory: project_klir_inventory_umkm_rancangan_tim_online_9sep.md
- repo root: 2026-09-10-roadmap-inventory-ai-distributor.md
- Audit kode langsung: prisma/schema.prisma (baris 808-968), src/app/api/v1/inventory/*,
  src/lib/ai-brain/inventory-intelligence-engine.ts, src/lib/ai-brain/consignment-engine.ts,
  src/app/components/KlirInventoryView.tsx, src/lib/ai-brain/proactive-alerts.ts

Web (WebSearch, 10 September 2026, 5 pencarian independen):
- https://www.simplidots.com/blog/aplikasi-distributor-terbaik/
- https://www.simplidots.com/blog/sales-motoris-kanvasing-dan-taking-order/
- https://www.simplidots.com/blog/fitur-aplikasi-distribusi-simplidots-membantu-bisnis-anda/
- https://qontak.com/blog/sales-distribution-software/
- https://mekari.com/blog/software-inventory-terbaik-umkm/
- https://jubelio.com/solusi/solusi-metode-fefo-untuk-kelola-stok-barang-di-gudang/
- https://payou.asia/inventory
- https://kartustok.com/2026/02/aplikasi-inventory-panduan-memilih-untuk-umkm-yang-skalabel/
- https://www.inflowinventory.com/blog/reorder-point-formula-safety-stock/
- https://www.netstock.com/blog/reorder-point-formula/
- https://www.mrpeasy.com/blog/what-is-reorder-point-and-reorder-point-formula/
- https://www.fishbowlinventory.com/blog/calculating-the-safety-stock-formula-6-variations-key-use-cases
- https://jubelio.com/dead-stock/
- https://www.foliopos.com/blog/detail/cara-menghindari-stok-mati-agar-barang-tidak-menumpuk-di-gudang
- https://kasirpintar.co.id/solusi/detail/software-stok-barang-retail-umkm

Catatan jujur soal sumber: klaim demand pasar untuk "visual search produk" dan "CRM broadcast
terhubung stok" TIDAK ditemukan sumber independen spesifik di riset ini - dicatat sebagai
"tidak ditemukan sumber", bukan diasumsikan benar dari dokumen roadmap tim online saja.
