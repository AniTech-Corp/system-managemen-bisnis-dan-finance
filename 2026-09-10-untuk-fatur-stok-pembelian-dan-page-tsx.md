# Untuk Fatur -- apa yang kami tambah 10 September (Stok & Pembelian) dan kenapa

Ditulis Claude Code (Fable 5.1), 10 September 2026 dini hari. Belum di-push, belum di-commit.
Semua perubahan ADDITIVE. Nol perubahan di schema.prisma, auth, session, .env, layout, landing.
Kalau ada yang tidak cocok dengan rencana kamu, bilang lewat Mecca sebelum batch ini di-push.

## 1. Ringkasan 30 detik

Backend Inventory yang dibangun 9 September (Product, StockMovement, PurchaseOrder, StockReturn,
SupplierScore + 5 endpoint) selama ini tidak punya layar sama sekali. Sekarang ada layar
"Stok & Pembelian" yang bisa dibuka CEO dan Finance dari AI Assistant, kartu ringkas di
dashboard CEO, 2 endpoint baca/tulis produk, dan otak analisa stok di chat AI (deterministik,
bukan LLM). Nama modul internal "inventory" tidak pernah tampil ke user.

## 2. File baru (tidak menyentuh file kamu)

```
src/app/api/v1/inventory/products/route.ts        GET list+summary (VIEWER), POST tambah produk
                                                   (MEMBER). openingStock > 0 -> StockMovement
                                                   OPENING_BALANCE dalam 1 $transaction.
src/app/api/v1/inventory/stock-movements/route.ts GET riwayat keluar-masuk, filter productId/type
                                                   (VIEWER). Include product {id,name,sku,unit}.
src/app/components/KlirInventoryView.tsx          Layar "Stok & Pembelian": 4 tab (Produk & stok,
                                                   Riwayat keluar-masuk, Pesanan pembelian, Skor
                                                   pemasok) + form tambah produk + zero-state jujur.
src/lib/ai-brain/inventory-intelligence-engine.ts Pure function: rekomendasi restock, low-stock,
                                                   anomali retur, kontributor margin, narasi jawaban.
tests/inventory-products-route.test.ts            6 test (fake Prisma, pola tests/purchase-orders)
tests/inventory-stock-movements-route.test.ts     6 test
tests/klir-inventory-view.test.ts                 24 test (helper murni)
tests/inventory-intelligence-engine.test.ts       16 test (termasuk anti-tabrakan sales-target)
```

Semua route baru: withTenantGuard, workspaceId dari auth.workspace.id (bukan body/query),
mengikuti persis gaya purchase-orders/route.ts.

## 3. File yang diubah (additive, diff kecil)

```
src/app/page.tsx (sekitar 55 baris murni untuk fitur ini; sisanya diff Codex 9 Sep)
  - import KlirInventoryView
  - ceoFeatureView: 'workspace' | 'schedule' | 'inventory' | null   (tambah 'inventory')
  - state baru financeFeatureView: 'inventory' | null
  - blok render feature view 'inventory' untuk CEO dan Finance, meniru persis blok schedule
    (wrapper + tombol "Kembali ke AI Assistant")
  - prop onOpenInventory ke ExecutiveAIAssistantView dan FinanceAIAssistantView,
    dijaga isModuleEnabled(enabledModules, 'inventory')
  - tombol header Finance (Dashboard / AI Asisten) ikut setFinanceFeatureView(null)
  - kondisi overflow <main> diperluas untuk feature view Finance
src/app/components/ExecutiveAIAssistantView.tsx
  - prop opsional onOpenInventory + tombol "Buka stok & pembelian" di blok "Pintasan kerja"
src/app/components/FinanceAIAssistantView.tsx
  - prop opsional onOpenInventory + blok "Pintasan kerja" (1 tombol) di sidebar
src/app/components/CompanyDataDashboard.tsx
  - kartu ringkas "Stok & Pembelian" di bawah kartu "Target & prediksi AI": jumlah produk,
    nilai stok, produk di bawah minimum; fetch GET /api/v1/inventory/products?limit=1;
    refresh saat event window 'klir-inventory-updated'; tombol "Buka di AI"
src/app/api/v1/brain/chat/route.ts
  - 1 blok if BARU setelah blok sales-target: detectInventoryIntent(message) -> query
    Product/StockMovement/StockReturn 90 hari -> jawab dari inventory-intelligence-engine.
    Dibungkus try/catch, gagal = lanjut ke LLM biasa. Blok lama tidak diubah.
src/lib/ai-brain/index.ts
  - 1 baris: export * from './inventory-intelligence-engine'
```

## 4. Bukti

```
tsc --noEmit -p tsconfig.json                                  exit 0
node --test "tests/**/*.test.ts"                               1218 pass, 0 fail (baseline 1166 + 52)
Browser localhost (login asli, Chrome Mecca):
  CEO: dashboard -> kartu "Stok & Pembelian" (0 produk, Rp 0, jujur) -> "Buka di AI" ->
       AI Assistant -> "Buka stok & pembelian" -> layar 4 tab terbuka, form tambah produk ada
  Finance: AI Asisten Keuangan -> "Buka stok & pembelian" -> layar 4 tab, semua zero-state
       jujur ("Belum ada pergerakan stok tercatat", dst) -> "Kembali ke AI Assistant" ->
       tombol header "Dashboard Keuangan & Kas" kembali normal
  Console browser: 0 error
git status: HEAD f9c5239, tidak ada file auth/session/schema/.env/layout/landing tersentuh
```

Belum dites: tambah produk sungguhan (menulis ke Neon = database produksi, sengaja tidak
dilakukan tanpa persetujuan Mecca), constraint unique [workspaceId, sku] di Postgres asli
(test pakai fake Prisma, route menangani P2002 sebagai 409 -- belum dibuktikan ke DB nyata).

## 5. Soal P0 "klik mouse tombol Dashboard Keuangan tidak jalan" (laporan Codex)

Direproduksi 5 kali di Chrome login asli dengan klik mouse sungguhan: SEMUA berhasil pindah
view. Tidak ada overlay (document.elementFromPoint di tengah tombol = teks tombol itu sendiri).
Dugaan kuat: alat klik otomatis Codex memakai koordinat screenshot yang ter-scale
(devicePixelRatio 0.667 di laptop Mecca), jadi kliknya meleset -- Enter keyboard tetap kena
elemen yang fokus, makanya "Enter jalan, mouse gagal". Tidak ada perubahan kode untuk ini.
Kalau kamu bisa reproduksi dengan mouse sungguhan, kabari, kami buka lagi.

## 6. Yang butuh kamu (tidak mendesak, jangan sampai menahan batch ini)

1. Fase 4 Inventory: faktor konversi satuan (1 dus = N pcs) butuh kolom baru di Product --
   kami tidak sentuh schema. Kalau setuju, usulan: `Product.packSize Int? @default(1)` +
   `Product.packUnit String?` (additive, nullable).
2. Persistensi target penjualan (sekarang state browser hasil chat AI) butuh entity + sumber
   ledger per kuartal -- keputusan kamu dan Mecca.
3. Backdoor auto-provision superadmin + 4 password fallback di auth/login/route.ts masih hidup
   (temuan 9 Sep, dikonfirmasi ulang hari ini oleh audit baca-kode). Kami tidak menyentuh.
