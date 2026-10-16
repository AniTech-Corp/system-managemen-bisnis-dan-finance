# Roadmap Teknis -- Integrasi AI KLIR Inventory + Segmen Distributor

Ditulis 10 September 2026 oleh Claude (Sonnet), atas permintaan Mecca. Dasar: audit kode
langsung (schema Prisma + endpoint yang ada), riset kompetitor (3 sumber web independen), dan
transkrip riset tim online (Adnan, 8 September). Bukan spek final -- ini urutan kerja yang
diusulkan, siap dipakai Codex/Fatur atau didiskusikan lebih dulu sama Mecca.

## 0. Status Sekarang (Verified dari Kode, 10 September)

- Backend Inventory SUDAH ADA: model Prisma `Product`, `StockMovement`, `PurchaseOrder`,
  `PurchaseOrderItem`, `StockReturn`, `SupplierScore`. 5 endpoint API: `consignment`,
  `photo-to-stock`, `purchase-orders`, `returns`, `supplier-score`.
- `Product.unit` bebas teks (default `pcs`), `Product.minStock` sudah ada tapi belum ada yang
  membacanya untuk alert. `Product.ownershipType` mendukung `OWNED` / `CONSIGNED`.
- Module key `inventory` sudah terdaftar di `src/lib/module-guard.ts` (7 modul resmi).
- **TIDAK ADA tampilan UI untuk Inventory** -- bukan di dashboard, bukan di AI Assistant manapun.
  Backend menganggur. Ini gap paling kritis, ditemukan lewat audit langsung, bukan asumsi.
- Tidak ada AI-brain engine khusus Inventory (beda dengan Finance/Marketing/Sales yang sudah
  punya `why-engine.ts`, `decision-engine.ts`, `prediction-engine.ts`, dan `sales-target-engine.ts`
  yang baru dibangun Codex 9-10 September).

## 1. Prinsip yang Mengikat Semua Fase Berikut

- **Modul bukan label.** Kata "Inventory" TIDAK boleh muncul sebagai judul section yang dibaca
  user di dashboard atau AI Assistant. Yang tampil adalah nama fitur (contoh: "Stok & Pembelian",
  bukan "Modul Inventory"). Rujuk keputusan owner 9 September soal ROLE vs MODULE vs FEATURE.
- **Dashboard = overview pasif** (angka, grafik, status). **AI Assistant = tempat kerja**, semua
  analisa dan rekomendasi hidup di sini, terintegrasi ke AI Assistant yang sudah ada (Executive
  untuk CEO, Finance untuk yang butuh lihat dampak keuangan) -- BUKAN AI Assistant baru khusus
  Inventory.
- **StockMovement WAJIB nyambung ke Finance**, bukan laporan keuangan yang berdiri sendiri:
  `SALE_OUT` dari Kasir = kas masuk, `PURCHASE_IN` dari Purchasing = kas keluar. Ini yang membuat
  "Laporan Keuangan" versi UMKM (ringan) tetap konsisten dengan Finance versi lengkap.
- **UMKM dan KLIR utama pakai fondasi data yang SAMA** (Product/StockMovement/PurchaseOrder).
  Bedanya cuma satu: ada atau tidaknya lapisan AI di atasnya (analisa + rekomendasi).

## 2. Fase 0 -- Sambungkan yang Sudah Ada (paling prioritas, bukan fitur baru)

Tujuan: backend yang sudah dibangun jangan menganggur.

- Mount tampilan Stok & Pembelian ke dashboard CEO (perluas `CompanyDataDashboard.tsx` yang
  sudah punya referensi parsial ke inventory) dan ke Finance AI Assistant (karena dampaknya ke
  kas). Pola yang sama seperti dulu KlirScheduleView dipasang ke `page.tsx`.
- Render sederhana dulu: daftar produk, stok saat ini, riwayat keluar-masuk, status purchase
  order. Belum perlu AI di tahap ini -- ini "menyalakan lampu", bukan "menambah kamar".
- Gating akses: CEO lihat semua, Finance lihat karena kaitan kas, Marketing tidak perlu
  (kecuali nanti terhubung ke data campaign/produk yang dipromosikan).

## 3. Fase 1 -- Otak Analisa: `inventory-intelligence-engine.ts`

Pola yang sama seperti `sales-target-engine.ts` (parse niat dari chat, hitung, kembalikan
narasi analisa + rekomendasi, bukan cuma angka).

- `detectInventoryIntent(message)` -- deteksi pertanyaan soal stok/restock/supplier, didaftarkan
  di `brain/chat/route.ts` sejajar `detectSalesTargetIntent`/`detectHPPIntent`.
- Tiga kemampuan inti (diambil dari riset tim online + gap yang ditemukan sendiri):
  1. **Rekomendasi restock per produk/toko/wilayah** berdasar pola StockMovement historis
     (dari transkrip: "toko X biasa beli 20 dus, saran 20 lagi bulan ini").
  2. **Deteksi anomali retur/selisih stok** -- StockReturn yang tidak sepadan dengan
     StockMovement sebelumnya, ditandai sebagai sinyal potensi rugi/salah catat, bukan tuduhan
     langsung.
  3. **Identifikasi kontributor profit** dari kombinasi Product + StockMovement (produk mana
     yang paling menyumbang margin, bukan cuma paling banyak terjual).
- Semua output WAJIB narasi + rekomendasi, bukan tabel angka mentah -- sesuai prinsip AI KLIR
  (analisa yang terjadi + prediksi ke depan), bukan sekadar dashboard yang "datanya nggak bunyi".

## 4. Fase 2 -- Peringatan Proaktif (Low-Stock)

- `Product.minStock` sudah ada di schema tapi belum dibaca siapa pun. Bangun job/trigger yang
  membandingkan `currentStock` vs `minStock`, munculkan sebagai kartu peringatan di AI Assistant
  (pola yang sama seperti peringatan lain yang sudah ada di ExecutiveAIAssistantView).
- Ini murni "menyalakan sensor yang sudah terpasang", bukan bikin sensor baru -- risiko rendah.

## 5. Fase 3 -- Laporan Konsinyasi (Titip-Jual)

- Data `ownershipType = CONSIGNED` sudah tercatat, tapi belum ada laporan yang menyimpulkan:
  kapan settlement ke supplier, berapa yang laku vs yang balik. Ini murni laporan baca-data,
  tidak mengubah skema.

## 6. Fase 4 -- Konversi Satuan (KHUSUS Kebutuhan Distributor)

- Gap yang ditemukan sendiri (belum ada di transkrip manapun): `Product.unit` sekarang cuma
  teks bebas, TIDAK ada faktor konversi (1 dus = berapa pcs). Distributor butuh ini supaya
  laporan bisa dibaca dalam 2 satuan (dus untuk mereka, pcs untuk laporan ke pabrik/warung).
- Ini perubahan skema (nambah field), jadi HARUS didiskusikan dulu dengan Fatur sebelum
  dieksekusi -- bukan tugas visual yang aman ditebak sendiri.

## 7. Fase 5 -- Diferensiasi Distributor vs UMKM

- Dari transkrip 8 September: tim masih bingung apakah Inventory butuh perlakuan/istilah beda
  untuk Distributor (skala besar, mungkin sebutan "Storage") vs UMKM (skala kecil, "Inventory"
  atau "Stok"). Rencana tim: survei ke calon user duluan.
- Fase ini SENGAJA ditaruh belakangan -- menunggu hasil survei istilah, bukan diputuskan
  sepihak oleh AI.

## 8. Jalur Paralel, Bukan Kode -- Proposal Bisnis Distributor

- Ini bukan tugas Claude/Codex, tapi dicatat supaya nyambung: tim online (Adnan/Medi) sedang
  menyiapkan proposal khusus segmen Distributor, ditarget siap sekitar minggu 15 September.
  Fase 0-2 di atas (tampilan dasar + rekomendasi restock) adalah bukti konkret paling murah buat
  didemokan di proposal itu -- MegaCo sebelumnya minta bukti nyata, bukan konsep doang.

## 9. Urutan Prioritas Ringkas

```
Fase 0: Mount UI yang sudah ada        -- PALING PRIORITAS, tidak ada risiko baru
Fase 1: inventory-intelligence-engine  -- inti nilai jual AI, prioritas tinggi
Fase 2: Low-stock alert                -- murah, sensor sudah ada
Fase 3: Laporan konsinyasi             -- murah, baca data saja
Fase 4: Konversi satuan (dus/pcs)      -- perlu diskusi Fatur dulu (ubah skema)
Fase 5: Diferensiasi Distributor       -- tunggu hasil survei istilah tim online
```

## 10. Keputusan yang Masih Perlu Mecca (jangan ditebak)

- Apakah Fase 0-2 boleh langsung dikerjakan begitu Codex selesai dengan batch yang sedang
  jalan sekarang, atau menunggu proposal Distributor final dulu (~15 September)?
- Apakah field konversi satuan (Fase 4) masuk prioritas sebelum atau sesudah proposal
  Distributor selesai -- ini menentukan apakah perlu buru-buru bicara ke Fatur atau bisa santai.
