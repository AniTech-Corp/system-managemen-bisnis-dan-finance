# Untuk Fatur -- batch 7-10 September: apa yang berubah, apa yang TIDAK disentuh, dan cara pegangnya

Ditulis 10 September 2026 oleh Claude (Fable 5.1) atas arahan Mecca. Dokumen ini menemani
push `main` yang membawa 46 commit di atas versi kamu `3d2249e` (9 Sep). Tujuannya satu:
kamu bisa baca 10 menit, tahu persis apa yang masuk, dan yakin tidak ada pekerjaanmu yang
rusak. Kalau ada yang kamu rasa salah, bilang saja -- kami perbaiki, bukan kamu.

Dokumen pendamping yang sudah ada di root repo (tidak diulang di sini):
- `2026-09-10-untuk-fatur-stok-pembelian-dan-page-tsx.md` -- detail Stok & Pembelian tahap awal + P0 "klik mouse" Codex (tidak reproduce).
- `2026-09-10-analisis-commit-fatur-9sep-dan-cara-kami-menyatu.md` -- bagaimana 4 commit kamu 9 Sep kami merge (versi kamu jadi dasar).
- `2026-09-10-usulan-matriks-role-feature-7-modul.md` -- usulan siapa lihat apa per role, dicek dari kode. Ini USULAN, kamu yang putuskan.
- `2026-09-10-panduan-tes-untuk-gpt-luna-terra-dan-mecca.md` -- skenario tes manual.
- `PROTOKOL-PUSH-DEPLOY-KLIR.md` -- urutan push/deploy supaya kita tidak saling timpa.

## 1. Ringkasan 60 detik

```
DASAR       : origin/main = 3d2249e (commit kamu 9 Sep). merge-base = sama. Kami 46 ahead, 0 behind.
LANE KAMU   : nol diff. auth/login/session/rate-limiter/prisma.ts/api/v1/auth/KlirAuthModal/
              layout/landing/ecosystem/package.json/package-lock.json = identik dengan 3d2249e.
              (Label KlirAuthModal yang sempat diubah 9 Sep sudah dikembalikan ke "KLIR Workspace" milikmu.)
SKEMA       : ADDITIVE saja. `git diff -w origin/main -- prisma/schema.prisma` = 309 baris tambah, 0 hapus.
              Tanpa -w kelihatan 125 "hapus" -- itu cuma perataan spasi oleh `prisma format`, bukan kolom hilang.
              `npx prisma db push` SUDAH dijalankan ke Neon 10 Sep ("already in sync"). Kalau kamu jalankan
              lagi, hasilnya no-op. Tidak ada migration file; kita masih pola db push seperti biasa.
ROUTE BARU  : 21 file route baru (semua di folder baru atau path baru, tidak menimpa route kamu).
ROUTE LAMA  : 22 route kamu diubah, semuanya additive: tambah guard tenant / validasi input / zero-state jujur.
              Tabel lengkap + commit penyebab di Bagian 4.
UI          : Stok & Pembelian jadi 7 tab; dashboard CEO/Finance/Marketing dirapikan sesuai doktrin
              "AI analisa masa lalu -> prediksi sampai Desember -> rekomendasi", zero-state jujur ("Belum ada data",
              bukan angka pajangan). page.tsx: +212/-11 baris (mount view baru + gating modul), logika login tidak disentuh.
BUKTI       : tsc 0 error. Test 1472/1472 lulus (250 suite). Smoke di Chrome sesi login asli: dashboard + AI
              CEO/Finance/Marketing, Stok & Pembelian 7 tab, konsol 0 error, GET products/customers/product-batches/
              workspace-files = 200.
```

## 2. Apa yang TIDAK kami sentuh (dan kenapa)

- Login, register, session, cookie, rate limiter, `src/lib/prisma.ts`, `api/v1/auth/*`, `KlirAuthModal.tsx`,
  `layout.tsx`, landing page, ecosystem, deploy script, konfigurasi VPS. Mecca menegaskan ini ranah kamu.
- Auto-provision superadmin + sandi bawaan di alur login (temuan 7 Sep) -- tetap kami biarkan, hanya dicatat
  di dokumen lama. Keputusan pagar `NODE_ENV` ada di tanganmu.
- Tidak ada kolom/tabel/enum yang dihapus atau diubah tipenya. Tidak ada `DROP`, tidak ada rename.
- Tidak ada dependency baru di `package.json`.

## 3. Skema Prisma -- daftar tambahan persis

Semua kolom baru nullable atau punya default, jadi baris lama tidak butuh backfill.

```
Workspace
  + enabledModules String[] @default([...7 modul])        -- gating modul per workspace (server-side)
  + relasi: videoJobs, products, stockMovements, purchaseOrders, stockReturns, supplierScores,
            productBatches, customers
User
  + relasi: stockMovements, purchaseOrders

model VideoJob            -- video async (7 Sep), provider job id unik, status PENDING/...
model Product             -- sku?, name, category?, unit, ownershipType OWNED|CONSIGNED, costPrice, sellPrice,
                             currentStock, minStock, imageUrl?, isActive,
                             packSize Int? @default(1), packUnit?, supplierName?   <- 10 Sep additive
model StockMovement       -- type enum (PURCHASE_IN, SALE_OUT, ADJUSTMENT, RETURN_IN/OUT ...), qtyChange,
                             unitCost?, sourceType/sourceId (soft link), customerId? <- 10 Sep additive
model PurchaseOrder / PurchaseOrderItem
model StockReturn
model SupplierScore
model ProductBatch        -- batch/kadaluarsa (FEFO), qty per batch            <- 10 Sep baru
model Customer            -- pelanggan terstruktur per workspace                 <- 10 Sep baru
```

Cara cek sendiri: `git diff -w 3d2249e -- prisma/schema.prisma | grep '^-'` harus kosong.

## 4. Route API -- baru dan yang diubah

### 4a. Route baru (21)

```
inventory/products              GET/POST  (POST: cek SKU duplikat per workspace -> 409 + conflictProductId)
inventory/products/[id]         PATCH     (ubah produk, termasuk packSize/packUnit/supplierName)
inventory/stock-movements       GET
inventory/purchase-orders       GET/POST  (barang masuk + kas keluar dalam 1 $transaction)
inventory/sales                 POST      (barang keluar + kas masuk; produk CONSIGNED otomatis catat
                                           kewajiban konsinyasi EXPENSE; customerId opsional, divalidasi per workspace)
inventory/stock-adjustments     POST      (penyesuaian stok: opname/rusak/hilang)
inventory/returns               GET/POST  (retur)
inventory/consignment           GET/PATCH
inventory/consignment/report    GET       (laporan titip jual, dihitung dari StockMovement)
inventory/supplier-score        GET/POST
inventory/customers             GET/POST
inventory/product-batches       GET/POST  (batch + tanggal kadaluarsa)
inventory/photo-to-stock        POST/PUT  (foto nota -> draft produk/PO; PUT = konfirmasi draft jadi data)
kas/piutang-reminder            GET/POST  (tombol "Tagih" -> link wa.me, catat isReminderSent)
kas/bank-reconciliation         POST
purchasing/approvals            GET/POST
brain/forecast                  POST      (prediksi kas ke depan, dipakai kartu "Prediksi kas AI" di dashboard CEO)
brain/location                  POST      (analisis lokasi/kompetitor, wadah Google Maps)
brain/models                    GET       (katalog model untuk composer)
media/video-status              GET       (poll VideoJob)
workspace-files/[id]            GET
```

Guard: 17 route inventory/kas/purchasing/workspace-files memakai `withTenantGuard` milikmu; brain/forecast dan
brain/location memakai `authenticateTenantRequest` dari file tenant-guard yang sama (pola recommendations/simulate);
brain/models dan media/video-status memakai `withMediaGuard` (pembungkus withTenantGuard untuk fitur media).
Tidak ada jalur tanpa autentikasi; workspaceId selalu dari sesi, tidak pernah dari body/query.

### 4b. Route kamu yang diubah (22) -- commit penyebab, supaya kamu bisa `git show`

```
booking/loyalty, booking/queue, corplan/generate-plan, corplan/pitchdeck, corplan/share-context,
corplan/valuation-swot, kas/runway-forecast, promo/copywriting, promo/coupons
    -> bcbe510  tutup IDOR: semua query dipagari workspaceId dari auth, bukan dari body/query string.
booking/reminder
    -> d701253  WA reminder tier Public (tanpa kredensial), label modul lama diganti.
brain/chat
    -> 6df0cd6  blok intent inventory (stok menipis, stok mati, perputaran, konsinyasi, kadaluarsa, restock per
                pelanggan). Alur chat umum kamu tidak diubah, hanya cabang tambahan sebelum jatuh ke LLM.
documents/analyze, documents/extract-text, workspace-files/[id]/import-ledger
    -> 7f8e3ca  upload multi-file + zip per entri + verdict relevansi. Guard kamu di extract-text tetap utuh.
kas/invoices, kas/transactions, workspace-files
    -> bb13d9e  validasi tanggal bisnis (format valid, tidak >1 tahun ke depan, tidak sebelum 2000) +
                deteksi kesalahan data, respons 400 dengan pesan jelas. workspace-files: +306 baris untuk
                multi-file/zip/lampiran chat, GET/POST lama tetap.
kas/tax-calculator, workspaces/[workspaceId]/profile
    -> 4b5ae6d  tax: omset otomatis dihitung dari INCOME bulan berjalan (dulu sepanjang masa x12, estimasi
                pajak berkali lipat). profile: baca Model Bisnis + NIB dari memori profil (guard kamu tidak diubah).
kerja/sop
    -> af40d8d  port manual perubahan kamu 9 Sep + zero-state jujur.
media/generate, media/video-content
    -> cdaf015  video async lewat VideoJob (tidak lagi blocking request), gambar tetap sinkron.
```

Tidak ada route kamu yang dihapus atau dipindah.

## 5. UI -- apa yang berubah per portal

```
STOK & PEMBELIAN (CEO + Finance, dibuka lewat "Pintasan kerja")
  7 tab: Produk & stok | Riwayat keluar-masuk (+Catat penjualan, +Penyesuaian, +Catat retur) |
         Pesanan pembelian (+Catat pembelian) | Skor pemasok | Konsinyasi | Pelanggan | Kadaluarsa
  Foto nota -> draft stok (masih harus dikonfirmasi), tombol Ubah produk, satuan kemasan (dus/pcs).
  Error SKU duplikat tampil inline di field SKU (409 dari server, bukan tebakan client).

DASHBOARD CEO (CompanyDataDashboard.tsx)
  Section digating per modul aktif workspace. Alert "tim" yang datanya tidak pernah ada dihapus.
  Kartu "Prediksi kas AI" (dari brain/forecast + recommendations). Marketing & Tim ambil dari
  campaigns/tasks riil, kalau kosong tulis "Belum ada data" (bukan "0 orang"/angka default).
  Subtitle target: "Dihitung dari target yang Anda berikan ke AI Assistant".

DASHBOARD FINANCE (FinanceModuleView.tsx)
  Tren 6 bulan dari analytics/financial-trends milikmu (label bulan dinamis, bukan dipatok).
  2 widget piutang duplikat dihapus (data persis sama dengan "Piutang klien").
  Tombol "Tagih" sekarang benar-benar POST kas/piutang-reminder -> link WhatsApp.
  Blok "AI analisa & prediksi kas" di atas; kalau belum ada transaksi tulis jujur "AI butuh transaksi kas".

DASHBOARD MARKETING (MarketingModuleView.tsx)
  id elemen duplikat diperbaiki, field creativeType yang tidak dibaca dihapus, target ROAS dari setting,
  blok "AI analisa kampanye", katalog produk baca-saja di copywriting/kalender.

AI ASSISTANT (3 portal)
  Panel "Perlu perhatian" (proaktif): sumber stok menipis/habis, alert brain, kadaluarsa. Tidak render
  kalau 0 kartu. Dismiss disimpan localStorage per role+workspace, TTL 24 jam.
  Composer: pilih model/upaya, tombol Riset (web/kompetitor/lokasi/prediksi), slash-command.
```

## 6. Cara pegang setelah push

```
1. git pull --ff-only          (harus fast-forward; kami tidak rebase di atas commit kamu)
2. npm ci                      (tidak ada dep baru, tapi lockfile kamu tetap dipakai apa adanya)
3. npx prisma generate         (schema bertambah, client perlu regenerate)
4. npx prisma db push          (opsional -- sudah kami jalankan ke Neon 10 Sep, akan no-op)
5. npm run build
6. pm2 reload klir-os

Rollback kalau perlu: git checkout 3d2249e (versi kamu 9 Sep). Kolom/tabel baru di Neon tidak
mengganggu kode lama karena semuanya nullable/default dan tidak ada yang direname.
```

Kalau kamu sedang kerja di VPS saat batch ini masuk, bilang ke Mecca -- kami tidak akan deploy
sebelum kamu selesai. Aturannya ada di `PROTOKOL-PUSH-DEPLOY-KLIR.md`.

## 7. Tiga hal yang butuh kamu (tidak mendesak, jangan menahan batch)

1. **Matriks role vs feature** -- baca `2026-09-10-usulan-matriks-role-feature-7-modul.md`. Sekarang Stok &
   Pembelian dibuka untuk CEO + Finance, Marketing belum. Kalau kamu mau beda, cukup ubah daftar di
   `src/lib/module-guard.ts` + gating di `page.tsx`; tidak perlu ubah route.
2. **Pagar login demo** -- auto-provision superadmin + sandi bawaan masih aktif di produksi (temuan 7 Sep).
   Usulan: gate `NODE_ENV !== 'production'` atau env flag. Ini ranah kamu, kami tidak menyentuh.
3. **Perataan schema** -- `prisma format` merapikan spasi di seluruh file schema. Kalau kamu lebih suka
   format lama, jalankan format ulang di sisi kamu; isinya tidak berubah.

## 8. Yang kami akui belum sempurna (jujur)

- Panel proaktif + engine inventory baru diuji dengan data kosong dan data sintetis (test), belum dengan
  data toko sungguhan. Lead-time untuk reorder point bukan field asli (tidak ada di skema) -- proxy dari
  jarak antar PURCHASE_IN; kalau titik datanya kurang, leadTimeDays = null dan reorder point tidak dihitung.
- Foto nota -> draft stok bergantung model vision lewat OpenRouter. Saat saldo OpenRouter habis (402) kami
  belum sempat tes ulang jalurnya; validasi file (tipe, ukuran 15 MB) sudah balas 400 jelas, tapi respons
  saat provider gagal belum kami verifikasi live.
- Tampilan lebar sempit (mobile) belum dites untuk 7 tab Stok & Pembelian. Desktop dulu, sesuai arahan Mecca.
- Satu peringatan React "Maximum update depth exceeded" sempat muncul 2x di konsol saat mengetik di composer AI CEO
  (10 Sep, satu sesi tab yang sudah lama hidup dan sering ganti portal lewat localStorage). Pesan tetap terkirim,
  AI tetap menjawab. Kami coba reproduksi 4x di tab bersih (kirim pertanyaan stok, pertanyaan umum, ketik saat
  jawaban masih diketik AI, jalankan What-If lalu buka AI): 0 kejadian. Composer Finance tidak pernah kena.
  Belum ketemu akarnya, jadi kami catat di sini dan di panduan tes, tidak kami tambal asal-asalan.
