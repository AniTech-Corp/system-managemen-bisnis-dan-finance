# Panduan Tes -- localhost:3000, hasil sesi Fable 10 September 2026

Untuk: Mecca (tes manual) dan Codex GPT 5.6 Luna/Terra (tes otomatis/semi-otomatis).
Kode: worktree lokal `klir-repo-clone`, HEAD f9c5239 + perubahan belum di-commit (belum di-push).
Database localhost = Neon = database PRODUKSI. Langkah yang MENULIS data ditandai [TULIS DB].

Tier bukti yang sudah kami capai per item:
```
[LOKAL]     tsc 0 error + 1218/1218 test + DIKLIK di localhost dengan login asli (Chrome Mecca)
[TEST]      lolos test otomatis saja, belum diklik manusia
[HIPOTESIS] kode ada, belum ada bukti lapangan -- ini yang paling perlu kalian coba
```

Cara masuk tanpa ketik password (buat Codex): Chrome Mecca sudah login. Pindah portal cukup
di console: `localStorage.setItem('klir_active_portal','CEO')` (atau 'FINANCE'/'MARKETING'),
lalu `location.reload()`. Sub-tab: `klir_ceo_nav` / `klir_finance_nav` = 'dashboard' |
'ai-assistant'.

PERINGATAN buat alat klik otomatis: laptop Mecca devicePixelRatio 0.667 (viewport 2520x1393).
Klik pakai koordinat screenshot ter-scale AKAN MELESET. Klik lewat ref elemen / selector,
atau hitung dari getBoundingClientRect. Kalau "Enter jalan tapi mouse gagal", cek dulu
`document.elementFromPoint(x,y)` di tengah tombol sebelum menyebut bug.

--------------------------------------------------------------------------------------------
## A. STOK & PEMBELIAN (baru sesi ini)
--------------------------------------------------------------------------------------------

A1. Kartu ringkas di dashboard CEO  [LOKAL]
    Portal CEO -> Dashboard Perusahaan -> scroll ke bawah kartu "Target & prediksi AI".
    HARAPAN: kartu "Stok & Pembelian" berisi Jumlah produk / Nilai stok / Di bawah minimum.
    Workspace tanpa produk: angka 0, Rp 0, 0 dan teks "Belum ada produk tercatat" (bukan
    angka contoh). Tombol "Buka di AI" pindah ke AI Asisten Perusahaan.

A2. Pintasan kerja CEO  [LOKAL]
    AI Asisten Perusahaan -> sidebar kiri "Pintasan kerja" -> "Buka stok & pembelian".
    HARAPAN: layar judul "Stok & Pembelian", 4 tab: Produk & stok / Riwayat keluar-masuk /
    Pesanan pembelian / Skor pemasok. Tombol "Kembali ke AI Assistant" balik ke chat.
    Tombol header "Dashboard Perusahaan" juga menutup layar ini.

A3. Pintasan kerja Finance  [LOKAL]
    Portal Finance -> AI Asisten Keuangan -> sidebar "Pintasan kerja" -> "Buka stok & pembelian".
    HARAPAN: layar yang sama. "Kembali ke AI Assistant" -> chat. Header "Dashboard Keuangan &
    Kas" -> dashboard Finance (feature view tertutup).
    Marketing SENGAJA tidak punya pintasan ini (butuh keputusan Mecca, lihat dokumen usulan
    matriks role-feature).

A4. Zero-state 4 tab  [LOKAL]
    Tanpa data: tiap tab menampilkan kalimat jujur ("Belum ada pergerakan stok tercatat...",
    "Belum ada pesanan pembelian tercatat...", "Belum ada skor pemasok..."). Tidak ada angka
    atau grafik contoh.

A5. Tambah produk  [TEST] [TULIS DB] -> minta kalian buktikan
    Tab "Produk & stok" -> form kiri: nama (wajib), SKU, satuan (default pcs), kategori,
    harga beli, harga jual, stok minimum, stok awal -> "Tambah produk".
    HARAPAN: produk muncul di tabel kanan; kalau stok awal > 0, tab "Riwayat keluar-masuk"
    menampilkan 1 baris "Saldo awal" (OPENING_BALANCE); kartu dashboard CEO ikut berubah
    (jumlah produk 1, nilai stok = stok x harga beli) tanpa reload (event
    'klir-inventory-updated'). Kalau stok awal <= stok minimum dan minimum > 0: badge merah
    "Di bawah minimum" + kartu dashboard "Di bawah minimum" = 1.
    SKU sama dua kali dalam satu workspace: HARAPAN ditolak 409 dengan pesan jelas (unique
    [workspaceId, sku]) -- ini [HIPOTESIS], belum dibuktikan ke Postgres asli.
    Nama kosong: ditolak 400 [TEST].

A6. Pesanan pembelian nyambung ke stok + kas  [TEST] [TULIS DB]
    Endpoint lama 9 Sep. POST /api/v1/inventory/purchase-orders {supplierName, items:[{productId,
    qty, unitCost}]} -> stok produk bertambah, riwayat "Pembelian masuk", kas keluar tercatat
    (CashTransaction EXPENSE), tab "Pesanan pembelian" menampilkan PO. UI form PO belum ada
    (belum dibangun -- Fase 0 hanya menampilkan), jadi tes lewat curl/fetch dengan cookie login.

A7. Skor pemasok  [TEST]
    Setelah ada >= 1 PO: tab "Skor pemasok" -> GET supplier-score menghitung otomatis. Catatan
    jujur di endpoint: onTimeRate selalu null (schema belum punya tanggal janji kirim), skor
    dari stabilitas harga + tingkat retur saja.

--------------------------------------------------------------------------------------------
## B. AI ASSISTANT -- otak stok (deterministik, tidak memanggil LLM, tidak memotong kredit AI)
--------------------------------------------------------------------------------------------

B1. Tanpa produk  [LOKAL]
    AI Asisten Perusahaan atau Keuangan -> ketik: "stok mana yang harus restock bulan ini?"
    HARAPAN (diuji 10 Sep, 1,1 detik): "Belum ada produk yang tercatat. Tambahkan produk dulu
    lewat menu Stok & Pembelian ..." -- bukan jawaban karangan.

B2. Dengan produk + riwayat  [TEST] -> minta kalian buktikan setelah A5/A6
    Ketik: "produk mana yang stoknya menipis?", "rekomendasi restock 30 hari", "produk paling
    untung", "ada retur yang mencurigakan?"
    HARAPAN: narasi Indonesia berisi angka riil (stok saat ini, rata-rata keluar per hari,
    hari ketahanan, saran qty), status kritis/waspada/aman/"belum ada histori" per produk,
    dan kalimat batas: penyebab tidak disimpulkan tanpa data kanal/harga pasar. Produk tanpa
    pergerakan keluar = "belum ada histori", bukan angka tebakan.

B3. Anti-tabrakan intent  [LOKAL]
    Ketik: "target penjualan tahun ini 100 juta, Q1 15 juta, Q2 20 juta"
    HARAPAN: jawaban analisis TARGET PENJUALAN (bukan stok), realisasi Q1 DAN Q2 terbaca
    (Rp 35 juta), sisa Rp 65 juta, recovery Q3 Rp 30 juta + Q4 Rp 35 juta. Sebelum patch sesi
    ini, kalimat berpisah KOMA hanya membaca Q1 (Q2 tertelan) -- sudah diperbaiki + test.

--------------------------------------------------------------------------------------------
## C. P0 LAMA CODEX -- klik mouse "Dashboard Keuangan & Kas"
--------------------------------------------------------------------------------------------

C1. Portal Finance -> AI Asisten Keuangan -> klik MOUSE tombol header "Dashboard Keuangan & Kas".
    HARAPAN: pindah ke dashboard Finance. Diuji 5x di Chrome login asli (langsung, setelah
    composer difokus, bolak-balik 3x, setelah reload, setelah dari feature view) -> semua PASS.
    Kalau kalian dapat GAGAL: catat cara klik (koordinat vs ref), devicePixelRatio, dan hasil
    `document.elementFromPoint(cx,cy)` di tengah tombol, lalu kirim ke kami.

--------------------------------------------------------------------------------------------
## D. REGRESI CEPAT (pastikan tidak ada yang rusak)
--------------------------------------------------------------------------------------------

D1. Tiga portal terbuka, console browser tanpa error baru  [LOKAL untuk CEO+Finance, Marketing
    dites Codex 10 Sep pagi]
D2. Operasional tim dan Reservasi & antrean masih terbuka dari pintasan CEO  [HIPOTESIS
    sesi ini -- terakhir [LIVE] oleh Codex 10 Sep pagi, kode blok tidak diubah]
D3. Perintah otomatis:
```
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json            -> exit 0
node --experimental-test-module-mocks --import tsx --test "tests/**/*.test.ts"  -> 0 fail
```

--------------------------------------------------------------------------------------------
## E. Yang SENGAJA belum dites / belum dibangun
--------------------------------------------------------------------------------------------

- Tambah produk sungguhan (A5) tidak kami jalankan: menulis ke Neon produksi. Keputusan Mecca.
- Form UI untuk membuat pesanan pembelian / retur / penyesuaian stok belum ada (backend ada).
  Fase 0 = menampilkan; form input lanjutan = tingkat berikutnya di roadmap master.
- Kartu peringatan low-stock di dalam chat AI (Fase 2 penuh) = baru lewat jawaban chat +
  summary dashboard, belum kartu proaktif otomatis saat AI dibuka.
- Viewport sempit/mobile belum diuji (resize_window tidak mengubah innerWidth di setup Mecca).
- Push GitHub / deploy VPS: DITAHAN sampai Mecca bilang.

## ADDENDUM v2 (10 Sep siang, setelah batch bangun 6df0cd6) -- yang baru untuk dites

Tier bukti kami sebelum kalian tes: [TEST] 1472/1472, tsc 0; [LOKAL] smoke Chrome sesi login asli
CEO/Finance/Marketing (dashboard + AI), konsol 0 error di 4 percobaan bersih. Belum ada yang [LIVE]
(belum push/deploy saat addendum ini ditulis).

```
NO  AREA                     LANGKAH                                                  HARAPAN
--  -----------------------  -------------------------------------------------------  ---------------------------------
V1  Stok & Pembelian 7 tab   CEO -> Pintasan kerja -> Stok & Pembelian                7 tab: Produk & stok, Riwayat,
                                                                                      Pesanan pembelian, Skor pemasok,
                                                                                      Konsinyasi, Pelanggan, Kadaluarsa
V2  Tab Pelanggan            Tambah 1 pelanggan (nama + no HP)                        muncul di daftar; GET customers 200
V3  Tab Kadaluarsa           Tambah batch untuk 1 produk, tgl kadaluarsa < 7 hari     baris batch muncul; di AI Assistant
                                                                                      panel "Perlu perhatian" ada kartu
                                                                                      kritis "<produk> kadaluarsa N hari"
V4  Catat penjualan          Riwayat -> Catat penjualan, pilih pelanggan dari V2      stok berkurang; kas INCOME tercatat;
                                                                                      kalau produk CONSIGNED: ada baris
                                                                                      EXPENSE "Kewajiban Konsinyasi"
V5  SKU duplikat             Tambah produk dengan SKU yang sudah ada                  error inline di field SKU (409),
                                                                                      bukan toast generik
V6  Kemasan dus/pcs          Ubah produk: packSize 12, packUnit "dus"                  tersimpan (PATCH 200); AI menyebut
                                                                                      "N dus + M pcs" saat ditanya stok
V7  Dashboard CEO            Buka dashboard tanpa data                                 tidak ada "0 orang"/angka default;
                                                                                      kartu Prediksi kas AI bilang jujur
                                                                                      "butuh data"; subtitle target jujur
V8  Finance: Tagih           Buat invoice belum lunas -> Piutang klien -> Tagih        POST kas/piutang-reminder 200 +
                                                                                      link wa.me terbuka; label berubah
                                                                                      "Sudah Ditagih"
V9  Finance: Tren 6 Bulan    Tab "Tren 6 Bulan" di Alur uang                          label bulan dinamis (Apr..Sep),
                                                                                      bukan bulan dipatok
V10 Marketing dashboard      Buka dashboard                                            tidak ada id elemen dobel (cek
                                                                                      devtools: id "daftar-kampanye-iklan"
                                                                                      cuma 1); blok AI kampanye jujur
V11 AI proaktif              Buka AI CEO dengan 0 produk                               1 kartu "Belum ada produk tercatat"
                                                                                      + tombol "Buka stok & pembelian";
                                                                                      klik X -> hilang 24 jam
V12 PANTAU KONSOL            Sepanjang V1-V11 buka devtools Console                    HARAPAN 0 error. KAMI PERNAH LIHAT
                                                                                      2x "Maximum update depth exceeded"
                                                                                      saat mengetik di composer AI CEO
                                                                                      (tab lama, sering ganti portal via
                                                                                      localStorage); 4x tab bersih = 0.
                                                                                      Kalau kalian dapat: catat urutan
                                                                                      persis sebelum mengetik + screenshot
                                                                                      console -- itu yang kami butuhkan.
```

Catatan jujur: klik "Buka AI Assistant" lewat tombol, jangan andalkan localStorage klir_ceo_nav
(tidak memindahkan view). Input pertama di dashboard CEO adalah simulator What-If, bukan composer AI.
