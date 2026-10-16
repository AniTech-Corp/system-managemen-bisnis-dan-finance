SCAN KODE MODUL-7 (STOK & PEMBELIAN) -- 10 SEPTEMBER 2026
Agent: scan-kode-modul7 (Sonnet, tim Claude Code, komando Fable 5.1)
Sifat: BACA-SAJA. Tidak ada file kode yang diedit untuk tugas ini.
HEAD saat scan: 6b88464 (worktree bersih, dicek git log/git status sebelum mulai).

RINGKASAN 1 LAYAR (baca ini dulu)
----------------------------------
- 9 endpoint API inventory sudah ada dan hidup: products, stock-movements, purchase-orders,
  returns, stock-adjustments, sales, supplier-score, consignment, consignment/report.
  Tambah 1 endpoint ke-10: photo-to-stock (2 method: POST draft, PUT commit).
- Dari 10 endpoint itu, HANYA 7 yang benar-benar dipanggil dari UI (KlirInventoryView.tsx):
  products, stock-movements, purchase-orders, supplier-score, consignment/report,
  consignment (PATCH), sales, stock-adjustments (8 fetch call, lihat detail di bawah).
- 2 endpoint TIDAK PUNYA JALUR UI SAMA SEKALI di seluruh repo: returns/route.ts dan
  photo-to-stock/route.ts. Ini bukan dugaan -- sudah digrep di seluruh src/app dan tidak ada
  satu pun fetch/import yang memanggilnya di luar file test dan dokumen roadmap. [KODE]
- Konsekuensi berantai: karena returns/route.ts tidak reachable, tabel StockReturn di database
  TIDAK PERNAH bisa terisi lewat jalur normal produk ini. Itu artinya 3 fitur lain yang
  membaca StockReturn (detectReturnAnomalies di AI chat, qtyReturnedToSupplier di laporan
  konsinyasi, defectRate di skor pemasok) secara PRAKTIS akan selalu melihat data kosong,
  bukan karena logikanya salah, tapi karena sumber datanya tidak pernah terisi. [KODE, rantai
  sebab-akibat, lihat detail poin 6.
- Tab "Riwayat keluar-masuk" di UI MENAMPILKAN label "Retur masuk"/"Retur keluar" (karena tipe
  RETURN_IN/RETURN_OUT ada di StockMovementType enum, dipetakan movementTypeLabel), tapi user
  tidak punya cara mencatat retur baru dari UI. Baris retur di riwayat itu hanya akan muncul
  kalau ada yang menulis StockReturn langsung ke database (mis. lewat API tool eksternal),
  bukan lewat produk KLIR sendiri.
- Kas (CashTransaction) sudah tersambung otomatis di 2 endpoint: purchase-orders (EXPENSE) dan
  sales (INCOME + EXPENSE tambahan kalau produk konsinyasi). stock-adjustments dan photo-to-stock
  SENGAJA tidak menyentuh kas (dijelaskan di komentar kode sendiri, bukan kelalaian).
- AI chat (brain/chat/route.ts) sudah punya blok inventory sendiri yang meng-intercept pesan
  bertema stok SEBELUM masuk ke LLM umum, murni deterministik dari data Prisma (nol LLM,
  nol karangan angka).


BAGIAN 1 -- ENDPOINT API (path, method, minRole, tulis-ke-DB, file:line)
--------------------------------------------------------------------
1.1 GET/POST /api/v1/inventory/products
    File: src/app/api/v1/inventory/products/route.ts
    GET  (baris 21-88, minRole VIEWER): list produk milik workspace + ringkasan
         (productCount, activeCount, stockValue, lowStockCount, lowStock top-20).
         Ringkasan dihitung dari SEMUA produk aktif workspace, bukan cuma halaman
         yang sedang tampil (baris 51-63, sengaja -- komentar kode bilang alasan:
         "summary harus mencerminkan populasi penuh, bukan sampel halaman").
    POST (baris 93-191, minRole MEMBER): tambah produk baru. Kalau openingStock>0,
         dalam SATU $transaction (baris 135-166) sekaligus tulis StockMovement
         type OPENING_BALANCE. Validasi SKU duplikat pre-check (baris 119-133,
         balas 409 + nama produk pemakai SKU) plus catch P2002 untuk race
         condition (baris 178-186). invalidateContextCache dipanggil best-effort
         setelah sukses (baris 171-175).

1.2 GET /api/v1/inventory/stock-movements
    File: src/app/api/v1/inventory/stock-movements/route.ts (66 baris, GET saja,
    tidak ada POST -- append-only, komentar baris 6-10 menjelaskan ini sengaja:
    StockMovement ditulis lewat route lain).
    GET (baris 18-66, minRole VIEWER): list StockMovement milik workspace,
        paginated, filter opsional productId dan type (validasi type terhadap
        enum StockMovementType asli, baris 12-15 dan 32-38). Include nama/SKU/
        unit produk (baris 49-53).

1.3 GET/POST /api/v1/inventory/purchase-orders
    File: src/app/api/v1/inventory/purchase-orders/route.ts
    GET  (baris 51-79, minRole VIEWER): list PO + items, paginated.
    POST (baris 82-199, minRole MEMBER): catat pembelian baru. Satu $transaction
         (baris 105-187) yang: (a) validasi semua productId milik workspace ini
         (baris 109-116, cegah lintas-tenant), (b) buat PurchaseOrder +
         PurchaseOrderItem per item, (c) StockMovement PURCHASE_IN per item
         (baris 146-158), (d) Product.currentStock atomic increment (baris
         160-165, pakai {increment: n} bukan read-then-write -- aman dari race
         condition), (e) CashTransaction type EXPENSE kategori "Pembelian
         Stok/Purchasing" (baris 168-178), (f) PurchaseOrder.cashTransactionId
         di-update jadi soft-link ke transaksi kas itu (baris 180-184).
         INI ENDPOINT PERTAMA YANG MENGHUBUNGKAN STOK KE KAS SECARA OTOMATIS.

1.4 GET/POST /api/v1/inventory/returns
    File: src/app/api/v1/inventory/returns/route.ts
    GET  (baris 31-65, minRole VIEWER): list StockReturn, filter opsional
         direction (TO_SUPPLIER/FROM_CUSTOMER).
    POST (baris 68-167, minRole MEMBER): catat retur baru. TO_SUPPLIER = barang
         keluar dari toko (currentStock decrement, StockMovement RETURN_OUT,
         ditolak kalau stok tidak cukup -- baris 109-113). FROM_CUSTOMER = barang
         masuk lagi (currentStock increment, StockMovement RETURN_IN). SENGAJA
         TIDAK membuat CashTransaction (komentar baris 18-21 menjelaskan: retur
         barang != otomatis ada uang pindah, itu keputusan manual kasir/finance
         di kasus lain).
    STATUS REACHABILITY: TIDAK ADA satupun fetch('/api/v1/inventory/returns')
         di seluruh folder src/app (sudah digrep, hasil kosong). Endpoint ini
         hidup dan lulus test unit-nya sendiri (tests/stock-returns.test.ts) tapi
         user KLIR TIDAK PUNYA CARA memicunya lewat produk jadi. [KODE, verified
         via grep -rln di src]

1.5 POST /api/v1/inventory/stock-adjustments
    File: src/app/api/v1/inventory/stock-adjustments/route.ts (118 baris,
    POST saja, tidak ada GET terpisah -- baris yang tercatat tetap muncul lewat
    GET stock-movements karena StockMovementType ADJUSTMENT_IN/OUT masuk feed
    umum yang sama, jadi TIDAK dianggap gap).
    POST (baris 18-117, minRole MEMBER): penyesuaian stok manual satu produk.
         qtyChange signed (positif=ADJUSTMENT_IN, negatif=ADJUSTMENT_OUT,
         ditentukan dari tanda angka, baris 44 dan 73). Alasan wajib diisi
         minimal 3 huruf (baris 36-41). Ditolak kalau hasil currentStock<0
         (baris 61-66). TIDAK menyentuh CashTransaction (murni koreksi angka,
         dijelaskan di komentar baris 7-15). invalidateContextCache best-effort
         (baris 96-100).

1.6 POST /api/v1/inventory/sales
    File: src/app/api/v1/inventory/sales/route.ts (221 baris, POST saja).
    POST (baris 48-220, minRole MEMBER): catat penjualan manual/kasir. Satu
         $transaction (baris 66-189): (a) validasi productId milik workspace
         DAN isActive (baris 73-81), (b) cek stok cukup untuk SEMUA item
         SEBELUM menulis apapun, dijumlah per produk kalau 1 produk muncul di
         >1 baris item (baris 88-99), (c) CashTransaction INCOME dibuat LEBIH
         DULU (baris 106-116) supaya StockMovement per item bisa soft-link
         sourceId ke situ, (d) StockMovement SALE_OUT per item, unitCost pakai
         costPrice produk SAAT ITU bukan sellPrice (baris 124-138), (e) Product.
         currentStock atomic decrement (baris 143-146), (f) KHUSUS produk
         ownershipType CONSIGNED: panggil planConsignmentSaleLiability lalu tulis
         CashTransaction EXPENSE tambahan "Kewajiban Konsinyasi" (baris 166-186,
         lihat detail engine di bagian 3). INI ENDPOINT KEDUA YANG MENGHUBUNGKAN
         STOK KE KAS OTOMATIS (arah sebaliknya dari purchase-orders: barang
         keluar + kas masuk). invalidateContextCache best-effort (baris 194-198).

1.7 GET/POST /api/v1/inventory/supplier-score
    File: src/app/api/v1/inventory/supplier-score/route.ts
    GET  (baris 138-162, minRole VIEWER): baca cache SupplierScore table kalau
         ada isinya; kalau kosong ATAU ?recalculate=1 dikirim, hitung ulang dari
         PurchaseOrder+PurchaseOrderItem+StockReturn lalu upsert cache
         (fungsi recalculateSupplierScores, baris 32-136).
    POST (baris 166-182, minRole MEMBER): trigger recalculate eksplisit (tombol
         "Hitung Ulang" di UI -- dipisah dari GET supaya jelas maknanya sebagai
         aksi, komentar baris 164-165).
    CATATAN JUJUR YANG SUDAH DITULIS DEVELOPER SENDIRI DI KODE (baris 130-133,
         dikutip apa adanya): "onTimeRate selalu null untuk semua supplier --
         schema.prisma PurchaseOrder belum punya kolom tanggal-janji-kirim vs
         tanggal-aktual-diterima" dan "defectRate diatribusikan ke supplier via
         fallback heuristik ... HIPOTESIS-tier, bukan ground-truth 1:1" karena
         endpoint returns/route.ts belum mengisi link eksplisit StockReturn ->
         PurchaseOrderItem. Ditambah temuan poin 1.4 di atas (returns tidak
         reachable dari UI sama sekali), praktiknya StockReturn akan selalu 0
         baris di produksi normal -- jadi seluruh mekanisme fallback attribusi
         defectRate ini kemungkinan besar TIDAK PERNAH punya data untuk diproses.

1.8 GET/PATCH /api/v1/inventory/consignment
    File: src/app/api/v1/inventory/consignment/route.ts
    GET   (baris 19-58, minRole VIEWER): list produk ownershipType CONSIGNED +
          ringkasan valuasi stok (ownedValue vs consignedValue, dari
          calculateStockValueBreakdown, lihat bagian 3).
    PATCH (baris 61-107, minRole MEMBER): toggle ownershipType satu produk
          (OWNED<->CONSIGNED). HANYA reklasifikasi label -- tidak mengubah
          currentStock/nilai apapun, tidak menulis StockMovement/CashTransaction
          (komentar baris 14-16 menegaskan ini bukan event stok).

1.9 GET /api/v1/inventory/consignment/report
    File: src/app/api/v1/inventory/consignment/report/route.ts (113 baris,
    GET saja, minRole VIEWER, baris 26-113). Laporan settlement per produk
    CONSIGNED aktif dalam rentang tanggal (default 30 hari terakhir, baris
    15-33): qtyIn (PURCHASE_IN+RETURN_IN), qtySold (SALE_OUT), qtyReturnedToSupplier
    (StockReturn direction TO_SUPPLIER), amountDueToSupplier (qtySold x
    costPrice). Transformasi murni ada di buildConsignmentReportRows
    (consignment-engine.ts), route ini cuma query + lempar. Karena
    qtyReturnedToSupplier bergantung tabel StockReturn (lihat 1.4), kolom ini
    di laporan settlement kemungkinan besar SELALU 0 di produksi normal.

1.10 POST/PUT /api/v1/inventory/photo-to-stock
    File: src/app/api/v1/inventory/photo-to-stock/route.ts (383 baris, endpoint
    paling besar di modul ini).
    POST (baris 176-276, minRole MEMBER): terima 1 foto (multipart/form-data,
         field "file", maks 15MB, format png/jpg/jpeg/webp -- baris 176-210),
         kirim ke analyzeImageWithGemini (reuse pipeline vision yang sama dipakai
         /api/v1/documents/extract-text, dijelaskan di komentar baris 14-19,
         BUKAN infrastruktur baru), parse balasan jadi array kandidat item
         (nama+qty+satuan+catatan), cocokkan tiap kandidat ke Product existing
         via matchProduct (exact match dulu baris 156-158, lalu fuzzy substring
         dua arah baris 160-165, ambigu kalau >1 cocok -- baris 165, TIDAK
         menebak). TIDAK menulis apapun ke DB (draft saja, ditegaskan di
         komentar baris 21-30: AI vision bisa salah baca tulisan tangan, commit
         wajib lewat konfirmasi manusia).
    PUT  (baris 323-383, minRole MEMBER): terima item yang sudah dikonfirmasi
         user (productId+qtyChange final), baru di sini StockMovement
         ADJUSTMENT_IN/OUT ditulis + Product.currentStock diperbarui (satu
         $transaction, pola identik purchase-orders). sourceType 'PHOTO_TO_STOCK'
         (baris 357). TIDAK menyentuh CashTransaction (baris 32-35: ini koreksi
         stok, bukan transaksi berharga).
    STATUS REACHABILITY: TIDAK ADA satupun pemanggilan endpoint ini dari
         komponen React manapun di src/app (sudah digrep -rln "photo-to-stock"
         ke seluruh src, satu-satunya hit selain file route.ts sendiri adalah
         tests/photo-to-stock.test.ts). Fitur "foto jadi input stok" yang jadi
         motivasi utama endpoint ini (temuan riset lapangan 3 September, UMKM
         masih pakai buku catatan manual -- lihat komentar baris 8-12) SECARA
         PRAKTIS belum bisa dipakai user manapun karena tidak ada tombol/form
         upload foto di KlirInventoryView.tsx atau file UI lain mana pun.
         Endpoint ini juga sudah disebut di 3 dokumen handoff/roadmap root repo
         (2026-09-10-codex-to-claude-handoff.md baris 159, 2026-09-10-roadmap-
         inventory-ai-distributor.md baris 11-12) sebagai bagian dari backend
         yang "belum terbukti UI role-specific" -- scan ini MENGONFIRMASI klaim
         itu dengan bukti grep konkret, bukan sekadar mengulang dugaan lama.


BAGIAN 2 -- TAB/FORM DI KlirInventoryView.tsx (file src/app/components/
           KlirInventoryView.tsx, 1445 baris)
--------------------------------------------------------------------
Komponen ini render 5 tab lokal (enum InventoryTab baris 40:
'produk'|'riwayat'|'pembelian'|'pemasok'|'konsinyasi'), tombol tab di baris
908-922, dengan judul section "Stok & Pembelian" (baris 902-905).

2.1 Tab "Produk & stok" (label baris 909, ikon Boxes, render kondisional baris
    943-1063)
    - Form "Tambah produk" (baris 945-998): nama, SKU (opsional, error 409
      ditampilkan tepat di bawah field via prodSkuError -- baris 953-964,
      mapProductSubmitError baris 212-218), satuan, kategori, harga beli,
      harga jual, stok minimum, stok awal. Submit -> fetch POST
      /api/v1/inventory/products (baris 703, function submitProduct).
    - Tabel daftar produk (baris 1026-1059): nama/SKU/satuan/stok/min/harga
      beli/harga jual + badge "Di bawah minimum" (StatusBadge merah, baris
      1053, dari isLowStock baris 162-164 -- MIRROR PERSIS logic backend
      products/route.ts, dikomentari sendiri di baris 158-161 supaya badge
      selalu sinkron dengan summary server).
    - Search box nama/SKU (baris 1002-1013) -> fetch GET
      /api/v1/inventory/products?q=... (baris 585, function fetchProducts).

2.2 Tab "Riwayat keluar-masuk" (label baris 912, ikon History, render baris
    1066-1202)
    - Tabel riwayat (baris 1078-1105): tanggal, produk, tipe (movementTypeLabel
      baris 149-151, MEMETAKAN SEMUA 7 StockMovementType termasuk RETURN_IN/
      RETURN_OUT -- baris 136-144 -- walau tidak ada jalur UI untuk
      MENGHASILKAN baris bertipe itu, lihat Bagian 1.4), perubahan qty
      (warna hijau/merah dari isMovementIn baris 154-156), catatan. Data dari
      fetch GET /api/v1/inventory/stock-movements (baris 601, function
      fetchMovements).
    - Form "Catat penjualan" (baris 1109-1167, ikon Wallet): multi-baris item
      (select produk + qty + harga jual, tambah/hapus baris -- baris 1113-1150),
      metode bayar, nama pembeli opsional, total preview (buildSaleTotal baris
      302-309). Submit -> fetch POST /api/v1/inventory/sales (baris 830,
      function submitSale).
    - Form "Penyesuaian stok" (baris 1169-1199, ikon SlidersHorizontal): pilih
      produk (dropdown menampilkan stok saat ini di label opsi -- baris
      1177-1179), jumlah penyesuaian (+/-), alasan wajib, catatan opsional.
      Submit -> fetch POST /api/v1/inventory/stock-adjustments (baris 867,
      function submitAdjustment).
    - TIDAK ADA form "Catat retur" di tab ini maupun tab lain manapun di file
      ini (sudah dibaca 1445 baris penuh, tidak ada input field/tombol yang
      menyebut kata "retur" untuk MEMBUAT baris baru -- kata "retur" hanya
      muncul di label tampilan MOVEMENT_TYPE_LABELS baris 141-142 dan di
      kolom "Retur ke supplier" tabel konsinyasi baris 1401/1413 yang MEMBACA
      data, bukan menulis).

2.3 Tab "Pesanan pembelian" (label baris 915, ikon ShoppingCart, render baris
    1205-1290)
    - Form "Catat pembelian" (baris 1207-1254): nama supplier, no HP opsional,
      metode bayar, multi-baris item (produk+qty+harga beli, tambah/hapus
      baris -- baris 1225-1242), catatan, total preview (buildPurchaseOrderTotal
      baris 368-375). Submit -> fetch POST /api/v1/inventory/purchase-orders
      (baris 786, function submitPurchaseOrder).
    - Daftar PO (baris 1267-1288): nomor PO, supplier, tanggal, jumlah item,
      metode bayar, badge status (PO_STATUS_META baris 220-225: Draft/Dipesan/
      Diterima/Dibatalkan), total rupiah. Data dari fetch GET
      /api/v1/inventory/purchase-orders (baris 617, function
      fetchPurchaseOrders).

2.4 Tab "Skor pemasok" (label baris 918, ikon Star, render baris 1293-1323)
    - Kartu per supplier (baris 1306-1320): nama, skor bulat berwarna
      (supplierScoreColor baris 230-234: >=80 hijau/>=60 kuning/lainnya merah),
      stabilitas harga %, tingkat retur/cacat %, ketepatan waktu % (semua
      fallback "Belum ada data" kalau null -- baris 1314-1316, BUKAN
      ditampilkan sebagai 0%, konsisten dengan kejujuran onTimeRate=null yang
      dijelaskan di 1.7). Data dari fetch GET /api/v1/inventory/supplier-score
      (baris 633, function fetchSupplierScores). TIDAK ADA tombol "Hitung
      Ulang" eksplisit di UI ini walau endpoint POST-nya sudah ada (baris
      166-182 di route.ts) -- kemungkinan gap kecil, dicatat di Bagian 4.

2.5 Tab "Konsinyasi" (label baris 921, ikon Handshake, render baris 1326-1435)
    - Filter tanggal dari/sampai (baris 1329-1341) -> fetch GET
      /api/v1/inventory/consignment/report (baris 653, function
      fetchConsignmentReport).
    - 3 kartu ringkasan (baris 1353-1366): produk titip jual, qty terjual
      periode, wajib disetor ke supplier (merah).
    - Form tambah produk jadi konsinyasi (baris 1368-1386): dropdown produk
      MILIK TOKO saja (nonConsignedActiveProducts, difilter di luar potongan
      yang dibaca -- variabel dipakai baris 1373) -> tombol "Jadikan
      konsinyasi" -> toggleOwnership(id,'CONSIGNED') (baris 742-780) -> fetch
      PATCH /api/v1/inventory/consignment (baris 751).
    - Tabel baris konsinyasi (baris 1394-1430): produk, masuk, terjual, retur
      ke supplier (KOLOM INI SELALU 0 di praktik normal, lihat Bagian 1.4/1.9),
      stok sekarang, wajib disetor, tombol "Jadikan milik toko" per baris ->
      toggleOwnership(id,'OWNED') -> PATCH yang sama.

2.6 Event bus lintas-komponen 'klir-inventory-updated'
    - Dipicu (window.dispatchEvent) di 5 titik setelah mutasi sukses: submitProduct
      (baris 734), toggleOwnership (baris 763), submitPurchaseOrder (baris 806),
      submitSale (baris 848), submitAdjustment (baris 885).
    - Didengar oleh KlirInventoryView SENDIRI (baris 681-690, refresh
      produk+riwayat+PO+konsinyasi kalau tab itu sudah pernah di-fetch -- pola
      "kalau ada perubahan dari tempat lain, tidak menunggu user pindah tab").
    - Didengar juga oleh CompanyDataDashboard.tsx (baris 640, function
      loadInventorySummary) untuk refresh kartu ringkas stok di dashboard CEO.
      Ini SATU-SATUNYA konsumen event ini di luar file sendiri (sudah digrep
      ke seluruh src/app/components).


BAGIAN 3 -- ENGINE (nama fungsi, input, output, file:line)
--------------------------------------------------------------------
3.1 src/lib/ai-brain/inventory-intelligence-engine.ts (654 baris, PURE --
    tanpa import prisma/network, ditegaskan di komentar baris 1-5)

    - detectInventoryIntent(message: string): boolean (baris 43-52). Regex
      kata kunci stok/restock/retur/supplier/konsinyasi/dus/lusin dst.
      Dipakai brain/chat/route.ts baris 986 untuk memutuskan apakah pesan
      user perlu dijawab jalur deterministik ini SEBELUM ke LLM umum.

    - buildRestockRecommendations({products, movements, horizonDays?, now?}):
      RestockRecommendation[] (baris 100-153). Untuk tiap produk, hitung
      avgDailyOut dari SALE_OUT+RETURN_OUT 90 hari terakhir (computeAvgDailyOut,
      baris 76-95), lalu daysOfCover=currentStock/avgDailyOut dan
      suggestedQty=ceil(avgDailyOut*horizonDays-currentStock). Status
      'kritis'/'waspada'/'aman'/'belum ada histori' (baris 133-136), disortir
      severity dulu baru daysOfCover (baris 148-153). Kalau produk belum
      pernah ada SALE_OUT/RETURN_OUT sama sekali, avgDailyOut=null dan status
      'belum ada histori' (baris 107-119) -- TIDAK dipaksa jadi 0.

    - buildLowStockAlerts(products): LowStockAlert[] (baris 173-184). Filter
      minStock>0 DAN currentStock<=minStock, sort dari yang paling defisit.

    - detectReturnAnomalies({movements, returns, now?, windowDays?}):
      ReturnAnomaly[] (baris 199-238). Bandingkan qty retur vs qty terjual per
      produk 90 hari terakhir, flag kalau returnRate>20%. INPUT `returns`
      berasal dari tabel StockReturn (lihat wiring 3.3 di bawah) -- karena
      StockReturn tidak pernah terisi lewat UI (Bagian 1.4), array ini akan
      SELALU kosong di praktik normal, jadi fungsi ini akan SELALU
      mengembalikan array kosong walau logikanya sendiri benar dan sudah diuji.

    - buildProfitContributors({products, movements, windowDays?, now?}):
      ProfitContributor[] (baris 259-291). marginPerUnit=sellPrice-costPrice,
      hanya produk dengan qtySold>0 dalam window yang ditampilkan (baris 280,
      komentar: "jangan tampilkan produk tanpa histori jual").

    - buildDeadStock({products, movements, days?, now?}): DeadStockItem[]
      (baris 318-350, ditambahkan 10 Sep). Produk aktif currentStock>0 yang
      TIDAK punya SALE_OUT dalam N hari (default 60). idleDays bertipe
      `number|null` -- null berarti belum pernah tercatat terjual sama sekali,
      BUKAN dianggap 0 hari idle (komentar baris 294-304 menjelaskan alasan
      eksplisit: "mengarang angka melanggar aturan angka HARAM dikarang").

    - buildStockTurnover({products, movements, days?, now?}):
      StockTurnoverItem[] (baris 377-410, ditambahkan 10 Sep). turnover=
      qtySold/avgStock, avgStock SENGAJA proxy pakai currentStock (bukan
      rata-rata harian sebenarnya) karena StockMovement tidak simpan snapshot
      harian -- keterbatasan ini DISEBUTKAN JUJUR di narasi jawaban (lihat
      buildInventoryReply bagian 6 di bawah, "avgStock pakai stok saat ini
      sebagai perkiraan, bukan rata-rata harian sebenarnya").

    - buildConsignmentSummary({products, movements, days?, now?}):
      ConsignmentSummaryItem[] (baris 432-467, ditambahkan 10 Sep). Hanya
      produk ownershipType CONSIGNED, amountDueToSupplier=qtySold*costPrice
      dalam 30 hari (default disamakan sengaja dengan default GET
      /consignment/report -- komentar baris 419-422 -- supaya angka chat AI
      dan tab UI tidak beda kalau user bandingkan).

    - buildInventoryReply({message, products, movements, returns,
      purchaseOrders?, now?}): string (baris 481-654). Menyusun jawaban chat
      narasi 8 bagian: (1) kondisi stok saat ini, (2) rekomendasi restock,
      (3) retur anomali (kalau ada), (4) produk margin terbesar (kalau ada),
      (5) stok mati (SELALU ditampilkan, dengan 3 cabang jujur: ada data / belum
      pernah SALE_OUT / semua aman), (6) perputaran stok (dengan disclaimer
      avgStock proxy disebut eksplisit di teks jawaban -- baris 601), (7)
      konsinyasi (HANYA muncul kalau workspace punya produk CONSIGNED), (8)
      penutup jujur soal batas kemampuan ("belum bisa menyimpulkan penyebab
      bisnis ... tanpa data kanal penjualan atau harga pasar" -- baris 651-652).
      Kalau products.length===0, balas 1 kalimat suruh tambah produk dulu
      (baris 492-494) -- tidak lanjut hitung apapun.

3.2 src/lib/ai-brain/consignment-engine.ts (332 baris)

    - isValidOwnershipType(value): boolean (baris 46-48) dan
      isConsignedProduct(ownershipType): boolean (baris 51-53). Guard tipe
      sederhana dipakai di banyak tempat (route.ts consignment, sales, engine
      sendiri).

    - calculateStockValueBreakdown(products): StockValueBreakdown (baris
      84-102). Pisahkan ownedValue vs consignedValue dari daftar produk
      mentah -- komentar baris 76-82 menegaskan: kode lain yang butuh "nilai
      stok pemilik" WAJIB pakai ownedValue, bukan sum semua produk (barang
      konsinyasi bukan aset toko sampai laku).

    - planConsignmentSaleLiability(input: ConsignmentSaleInput):
      ConsignmentSalePlan | {error} (baris 163-216). Susun RENCANA 3 tulisan
      (stockMovement SALE_OUT, productDecrement, cashTransaction EXPENSE
      "Kewajiban Konsinyasi" = qty*costPrice) untuk SATU penjualan produk
      konsinyasi. CATATAN PENTING dari pembacaan silang ke sales/route.ts
      (baris 183 file itu): pemanggil HANYA memakai field `cashTransaction`
      dari hasil plan ini (`tx.cashTransaction.create({ data: plan.cashTransaction
      })`). Field `plan.stockMovement` dan `plan.productDecrement` yang
      dihasilkan fungsi ini TIDAK PERNAH dipakai/ditulis oleh pemanggil --
      karena sales/route.ts SUDAH menulis StockMovement SALE_OUT + Product
      decrement-nya sendiri lebih dulu di loop yang sama (baris 124-146 file
      itu, generik untuk semua produk terlepas status konsinyasi). Jadi
      fungsi ini bekerja benar untuk bagian kas, tapi separuh nilai baliknya
      (stockMovement, productDecrement) adalah kode/data yang dihitung tapi
      dibuang diam-diam -- bukan bug yang menghasilkan angka salah (StockMovement
      tetap tertulis lewat jalur lain), tapi tanda desain fungsi ini lebih
      besar dari yang benar-benar dipakai. Layak diringkas jadi fungsi yang
      cuma mengembalikan cashTransaction saja pada kesempatan refactor
      berikutnya -- BUKAN untuk batch ini (baca-saja).

    - buildConsignmentReportRows(products, movements, returns, period):
      {rows, totals} (baris 281-332). Transformasi murni dipakai
      GET /consignment/report -- lihat detail di Bagian 1.9. qtyReturnedToSupplier
      (baris 300-302) bergantung parameter `returns` yang datang dari tabel
      StockReturn -- akan selalu 0 di praktik normal (lihat Bagian 1.4/1.9).

3.3 src/lib/ai-brain/proactive-alerts.ts (238 baris) -- "Perlu perhatian" panel

    - PROACTIVE_SOURCES (baris 217-234): registry 2 sumber. Sumber 'stok'
      (baris 218-225): roles ['CEO','FINANCE'] SAJA (Marketing sengaja
      dikecualikan, dikonfirmasi juga di alertsFromInventorySummary baris 137
      "if (role==='MARKETING') return out"), fetch dari
      GET /api/v1/inventory/products?page=1&limit=1 lalu ambil field
      `summary` saja (baris 220-224). Sumber 'brain' (baris 227-233): dari
      GET /api/v1/brain/alerts, filter CRITICAL/WARNING saja.
    - alertsFromInventorySummary(summary, role): ProactiveAlert[] (baris
      113-146). Kartu "Belum ada produk tercatat" HANYA untuk CEO (baris
      121-130). Kartu low-stock untuk CEO+Finance, severity 'kritis' kalau
      currentStock<=0 else 'waspada' (baris 141-147), tiap kartu punya CTA
      "Tanya AI rencana restock" yang mengisi composer chat dengan prompt
      siap pakai (baris 145, TIDAK auto-kirim).
    - Dipakai oleh ProactiveAlertsPanel.tsx yang di-render di
      ExecutiveAIAssistantView.tsx (baris 3059, role="CEO") dan
      FinanceAIAssistantView.tsx (baris 2659, role="FINANCE"). TIDAK ADA
      pemanggilan ProactiveAlertsPanel di MarketingAIAssistantView.tsx (sudah
      digrep, hasil kosong) -- KONSISTEN dengan roles:['CEO','FINANCE'] di
      registry, bukan gap/kelupaan, tapi berarti Marketing tidak lihat
      panel ini SAMA SEKALI (bukan cuma sumber 'stok'-nya yang dilewati).

3.4 src/lib/ai-brain/supplier-reliability-engine.ts (425 baris) -- dipakai
    supplier-score/route.ts (lihat Bagian 1.7 untuk pemakaian + keterbatasan
    onTimeRate/defectRate yang sudah didokumentasikan developer sendiri).


BAGIAN 4 -- INTEGRASI KE KAS (CashTransaction) DAN KE AI CHAT
--------------------------------------------------------------------
4.1 Integrasi kas (2 jalur konfirmasi, 1 jalur sengaja tidak ada):
    - purchase-orders POST -> CashTransaction EXPENSE, kategori "Pembelian
      Stok/Purchasing" (route.ts baris 168-178).
    - sales POST -> CashTransaction INCOME, kategori "Penjualan Stok/Kasir"
      (route.ts baris 106-116) + CashTransaction EXPENSE tambahan "Kewajiban
      Konsinyasi" KHUSUS produk CONSIGNED (route.ts baris 166-186, lewat
      consignment-engine.ts).
    - stock-adjustments POST dan photo-to-stock PUT: SENGAJA TIDAK menyentuh
      CashTransaction, dijelaskan eksplisit di komentar kode masing-masing
      (murni koreksi angka stok, bukan transaksi berharga).
    - returns POST: SENGAJA TIDAK menyentuh CashTransaction (retur barang !=
      otomatis uang pindah tangan), tapi field cashTransactionId sudah
      disediakan di skema sebagai soft-link opsional untuk fitur susulan
      (schema.prisma baris 943-945) -- BELUM dipakai endpoint manapun saat ini.

4.2 Integrasi ke AI chat (src/app/api/v1/brain/chat/route.ts):
    - Blok inventory ada di baris 979-1030, DIPASANG SETELAH blok sales-target
      (baris 972-977) dan SEBELUM alur chat/LLM umum.
    - Trigger: !isImageRequest && !genType && message &&
      detectInventoryIntent(message) (baris 986) -- artinya kalau pesan user
      cocok kata kunci stok DAN bukan permintaan gambar/generate, jalur ini
      MENGINTERCEPT sebelum LLM biasa sempat jalan.
    - Query Prisma langsung 3 tabel paralel (baris 989-1006): Product
      (isActive saja), StockMovement (90 hari terakhir), StockReturn (90 hari
      terakhir) -- lalu lempar ke buildInventoryReply (baris 1017-1024).
    - Dibungkus try/catch (baris 987-1029): kalau query gagal, fallthrough ke
      chat LLM biasa, TIDAK bikin seluruh chat error (komentar baris 984-985
      menegaskan ini sengaja).
    - Karena blok ini INTERCEPT dan langsung return NextResponse (baris
      1017-1024) begitu berhasil, pesan yang match detectInventoryIntent TIDAK
      PERNAH sampai ke LLM umum atau ke logic AI lain di bawahnya dalam
      request yang sama -- ini konsisten dengan desain "deterministic first
      response" yang disebut di komentar baris 979-981, bukan bug, tapi perlu
      diketahui tim: pertanyaan campuran (mis. "stok kopi berapa, terus
      gimana caranya naikin omzet Q4?") akan HANYA dapat jawaban bagian stok
      dari jalur deterministik ini, bagian omzet-nya tidak terjawab dalam
      response yang sama.


BAGIAN 5 -- HAL YANG ADA DI KODE TAPI BELUM TERSAMBUNG KE UI (ringkasan tegas)
--------------------------------------------------------------------
5.1 POST/GET /api/v1/inventory/returns -- endpoint hidup, teruji unit
    (tests/stock-returns.test.ts), NOL pemanggilan dari komponen React manapun.
    Efek berantai: StockReturn table tidak pernah terisi lewat produk ini ->
    detectReturnAnomalies (3.1) selalu kosong, qtyReturnedToSupplier di
    laporan konsinyasi (1.9) selalu 0, defectRate di skor pemasok (1.7) tidak
    pernah dapat data nyata untuk fallback heuristiknya.

5.2 POST/PUT /api/v1/inventory/photo-to-stock -- endpoint hidup, teruji unit
    (tests/photo-to-stock.test.ts), NOL pemanggilan dari komponen React
    manapun. Fitur "foto buku catatan jadi input stok" yang jadi motivasi
    utamanya (riset lapangan 3 Sep) belum bisa dipakai user KLIR mana pun
    hari ini walau backend-nya sudah selesai dan sudah reuse pipeline vision
    yang terbukti jalan di fitur lain (extract-text dokumen).

5.3 Tombol "Hitung Ulang" skor pemasok -- endpoint POST
    /api/v1/inventory/supplier-score sudah ada (route.ts baris 166-182,
    khusus dipisah dari GET supaya "jelas maknanya sebagai aksi"), tapi tab
    "Skor pemasok" di KlirInventoryView.tsx (baris 1293-1323) TIDAK punya
    tombol yang memanggilnya -- user hanya bisa lihat skor cache atau pasrah
    nunggu GET auto-recalculate saat cache kosong. Gap kecil dibanding 5.1/5.2
    (endpointnya masih "setengah kepake" lewat GET, bukan nol sama sekali).

5.4 StockReturn.cashTransactionId -- kolom skema sudah ada (schema.prisma
    baris 943-945) sebagai soft-link opsional, TIDAK ADA endpoint yang mengisi
    kolom ini (returns/route.ts POST tidak menulis field ini sama sekali,
    dicek langsung di route.ts baris 115-123 -- field cashTransactionId tidak
    disebut). Konsisten dengan keputusan desain "retur != otomatis kas", tapi
    berarti kalau nanti ada fitur susulan refund/kredit-nota manual yang mau
    soft-link ke StockReturn, field ini masih kosong menunggu diisi.

5.5 planConsignmentSaleLiability() menghasilkan field stockMovement dan
    productDecrement yang tidak pernah dipakai pemanggilnya (detail di 3.2) --
    bukan bug data, tapi tanda over-return di desain fungsi.


CATATAN JUJUR (apa yang TIDAK sempat/bisa diperiksa dari sisi kode)
--------------------------------------------------------------------
- Semua temuan di atas [KODE] -- dibaca langsung dari file, bukan dijalankan
  (tugas ini baca-saja, tanpa sesi login, tanpa akses browser produksi).
  Tidak ada satu pun klaim [LIVE] di laporan ini.
- Reachability endpoint diverifikasi dengan grep tekstual ke seluruh
  src/app/**/*.tsx dan *.ts untuk nama endpoint (mis. "photo-to-stock",
  "inventory/returns") -- metode ini bisa kelewat kalau ada pemanggilan yang
  membangun URL secara dinamis dari string yang disambung runtime (mis.
  template literal aneh atau konstanta yang di-import dari file lain yang
  namanya tidak jelas). Sudah dicek juga tidak ada file konstanta terpisah
  semacam "ENDPOINTS.ts" di project ini yang bisa menyembunyikan pemanggilan
  semacam itu (project tidak punya modul shared endpoints, tiap komponen
  menuliskan path fetch-nya sendiri langsung sebagai string literal --
  dikonfirmasi dari pola yang sama persis terlihat konsisten di 8 fetch call
  KlirInventoryView.tsx), jadi keyakinan temuan 5.1/5.2 tinggi, tapi TIDAK
  100% mustahil ada satu jalur eksotis yang terlewat.
- Tidak diperiksa: apakah endpoint returns/photo-to-stock dipanggil dari luar
  repo ini (mis. skrip migrasi data, tool internal terpisah, mobile app kalau
  ada). Di luar cakupan "modul-7 di repo klir-repo-clone ini".
- Tidak menghitung baris diff untuk perbaikan apapun -- tugas agent ini murni
  inventarisasi (Bagian 5 di atas cukup untuk komando menyusun kontrak
  perbaikan di batch BANGUN, tapi estimasi baris/prioritas itu bukan bagian
  dari tugas B, dan diserahkan ke sintesis komando + dokumen scan lain
  (D/E/F) yang memang diminta menutup dengan daftar prioritas + estimasi).
- Tidak baca file tests/*.ts secara mendalam (hanya `ls` untuk konfirmasi
  keberadaan) -- isi assertion test tidak diverifikasi baris per baris,
  hanya nama file dikonfirmasi ada.

BUTUH DARI TIM
--------------------------------------------------------------------
- scan-permintaan-modul7 (A): kalau ada permintaan eksplisit dari sumber
  lapangan (Pak Wisnu/Pak Rizky/dst) soal "foto jadi input stok" atau "catat
  retur", tolong silang dengan temuan 5.1/5.2 di atas -- ini kandidat kuat
  untuk masuk kontrak BANGUN Tingkat berikutnya (wiring UI saja, backend
  sudah selesai).
- scan-data-riil-modul7 (C): kalau usulan skema baru (ProductBatch,
  Customer/Outlet) disusun, tolong cek apakah StockReturn.cashTransactionId
  yang masih kosong (5.4) relevan disambungkan sekalian saat modul distributor
  dibangun (retur dari toko/warung mungkin butuh refund tracking).

PERINGATAN UNTUK TIM
--------------------------------------------------------------------
- scan-portal-ceo/finance/marketing (D/E/F): kartu/badge yang membaca kolom
  "retur" dari StockReturn (defectRate di skor pemasok, qtyReturnedToSupplier
  di laporan konsinyasi, retur anomali di AI chat) akan TAMPIL TAPI SELALU
  NOL/BELUM ADA DATA di semua portal sampai gap 5.1 ditutup -- JANGAN
  dilaporkan sebagai "bug angka salah", ini akar-sebabnya endpoint sumbernya
  memang belum tersambung ke UI, bukan logic yang salah hitung.
- scan-portal-ceo: kartu ringkasan stok di CompanyDataDashboard.tsx dengar
  event 'klir-inventory-updated' (baris 640) -- kalau ditemukan kartu itu
  tidak update setelah mutasi stok, cek dulu apakah mutasinya lewat salah satu
  dari 5 titik dispatch (Bagian 2.6) atau lewat jalur lain yang tidak
  memicu event ini.
