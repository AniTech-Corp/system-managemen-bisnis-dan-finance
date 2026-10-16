# Usulan Matriks Role vs Feature - 7 Modul KLIR

Tanggal: 10 September 2026
Penulis: agent doc-role-feature-matrix (Sonnet, tim Claude Code)
Status: USULAN. Belum diimplementasi ke RBAC. Ini cuma peta + rekomendasi, bukan kode.
Cara baca: setiap baris fitur ditandai [ADA DI KODE] (dicek langsung dari file, ada sitasi file:line)
atau [USULAN] (belum ada, ini saran perluasan).

Prinsip dari keputusan owner 9 September (ROLE vs MODULE vs FEATURE):
- ROLE = jabatan login. CEO/Owner superset (dapat semua). Finance dan Marketing dapat fitur
  yang relevan ke fungsi mereka, bisa lintas modul.
- MODULE (corplan, personal, finance, advertising, workspace, schedule, inventory - lihat
  src/lib/module-guard.ts baris 7-15) = pengelompokan internal buat kode dan izin nyala/mati
  per workspace. HARAM tampil sebagai label ke user.
- FEATURE = yang benar-benar dilihat dan dipakai user. Nama harus bahasa kerja biasa
  ("Stok & Pembelian", bukan "Modul Inventory").

Kode saat ini cuma punya 3 portal login: CEO, FINANCE, MARKETING (src/app/page.tsx baris 93,
type activePortal). Tidak ada portal keempat untuk HR/Personal terpisah - fitur SDM/HR
ditumpangkan di dalam portal CEO (lihat bagian modul corplan/personal di bawah, keduanya
didefinisikan tapi TIDAK PERNAH dipakai untuk gating apapun).


## 1. Modul internal -> siapa yang bisa buka (dicek dari kode)

| Modul (internal)  | CEO | Finance | Marketing | Fitur yang muncul ke user             | Status gating              |
|--------------------|-----|---------|-----------|----------------------------------------|-----------------------------|
| workspace          | ADA | -       | -         | "Operasional tim" (Kanban/Presensi/KPI/SOP) | [ADA DI KODE] gate isModuleEnabled 'workspace', page.tsx:1273-1276 |
| schedule           | ADA | -       | -         | "Reservasi & antrean" (Reservasi/Antrean/Loyalitas/Reminder) | [ADA DI KODE] gate isModuleEnabled 'schedule', page.tsx:1278-1281 |
| inventory          | ADA | ADA     | -         | "Stok & Pembelian" (Produk/Riwayat/Pembelian/Pemasok) | [ADA DI KODE] gate isModuleEnabled 'inventory', page.tsx:1306-1309 (CEO) dan area onOpenInventory FinanceAIAssistantView (Finance) |
| finance            | sebagian (ringkasan) | ADA (penuh) | -   | Dashboard Keuangan (FinanceModuleView), portal-access-gate Finance | [ADA DI KODE] PORTAL_MODULE_KEY FINANCE:'finance', page.tsx:82-85; gate isModuleEnabled di CompanyDataDashboard.tsx:1163 utk kartu ringkasan CEO |
| advertising        | sebagian (ringkasan) | -   | ADA (penuh) | Dashboard Marketing (MarketingModuleView), portal-access-gate Marketing | [ADA DI KODE] PORTAL_MODULE_KEY MARKETING:'advertising', page.tsx:82-85; gate isModuleEnabled di CompanyDataDashboard.tsx:1240 utk kartu ringkasan CEO |
| corplan            | tidak ada gating | tidak ada gating | tidak ada gating | tidak ada fitur bernama ini | [BELUM ADA DI KODE] key ada di KLIR_MODULE_KEYS (module-guard.ts:8), tapi isModuleEnabled(..., 'corplan') NOL pemanggilan di seluruh src/app dan src/lib (dicek grep) |
| personal           | tidak ada gating | tidak ada gating | tidak ada gating | tidak ada fitur bernama ini | [BELUM ADA DI KODE] key ada di KLIR_MODULE_KEYS (module-guard.ts:9), tapi isModuleEnabled(..., 'personal') NOL pemanggilan di seluruh src/app dan src/lib (dicek grep) |

Catatan penting: array KLIR_MODULE_KEYS punya 7 nama (module-guard.ts:7-15), tapi cuma 5 yang
benar-benar dipakai buat menyalakan/mematikan sesuatu di UI (workspace, schedule, inventory,
finance, advertising). 'corplan' dan 'personal' cuma nama kosong di array itu - kalau nanti
Mecca toggle modul itu OFF di suatu workspace, TIDAK ADA EFEK APAPUN karena tidak ada kode yang
mengeceknya. Ini bukan bug yang bikin sesuatu rusak (karena memang belum dipakai), tapi berarti
2 dari 7 "pilar" yang disebut di CLAUDE.md project belum punya wujud kode sama sekali.


## 2. Siapa lihat apa - Dashboard vs AI Assistant per role

Prinsip dari konteks: Dashboard = overview pasif (angka/grafik/status). AI Assistant = tempat
kerja utama (chat + tools + aksi).

| Role      | Dashboard (komponen)              | AI Assistant (komponen)          | Fitur kerja tambahan yang bisa dibuka dari AI Assistant |
|-----------|-------------------------------------|-------------------------------------|----------------------------------------------------------|
| CEO       | CompanyDataDashboard.tsx (ringkasan semua area, page.tsx:1275) | ExecutiveAIAssistantView.tsx (page.tsx:1291) | Operasional tim, Reservasi & antrean, Stok & Pembelian (3 tombol "Pintasan kerja", ExecutiveAIAssistantView.tsx:2868-2901) |
| Finance   | FinanceModuleView.tsx (detail penuh, page.tsx:1341) | FinanceAIAssistantView.tsx (page.tsx:1347) | Stok & Pembelian (1 tombol "Pintasan kerja", FinanceAIAssistantView.tsx:2491-2502) |
| Marketing | MarketingModuleView.tsx (detail penuh, page.tsx:1372) | MarketingAIAssistantView.tsx | Tidak ada. Marketing tidak punya pintasan ke Operasional tim, Reservasi, atau Stok & Pembelian sama sekali (dicek: tidak ada prop onOpenWorkspace/onOpenSchedule/onOpenInventory di MarketingAIAssistantView.tsx maupun pemanggilannya di page.tsx) |

Temuan yang perlu dicatat (bukan salah, tapi beda level detail): CEO TIDAK melihat tabel detail
yang sama seperti Finance/Marketing. CEO cuma dapat ringkasan per area di dalam
CompanyDataDashboard.tsx:
- Section "Keuangan & Arus Kas Bisnis" (CompanyDataDashboard.tsx:2678) - ringkasan, bukan
  tabel piutang-per-rentang-umur atau daftar invoice terbaru seperti yang Finance lihat
  (FinanceModuleView.tsx:2535, 2592).
- Section "Marketing & Pertumbuhan Pelanggan" (CompanyDataDashboard.tsx:2921) - ringkasan,
  bukan daftar kampanye berjalan atau funnel iklan-sampai-closing seperti yang Marketing lihat
  (MarketingModuleView.tsx:880, 1028).

Jadi "CEO superset" itu benar untuk AKSES (CEO bisa buka portalnya sendiri tanpa modul
tunggal jadi gerbang, PORTAL_MODULE_KEY page.tsx:82-89), tapi belum tentu benar untuk
KEDALAMAN TAMPILAN (CEO lihat versi ringkas, bukan versi detail Finance/Marketing). Ini
soal desain, bukan bug - tapi kalau maksud "superset" itu CEO harus bisa lihat SEGALANYA
sedetail Finance/Marketing, ini gap yang perlu keputusan (lihat bagian 8).


## 3. Tabel fitur AI Assistant per role (isi tombol/tools yang benar-benar ada di kode)

### 3a. CEO - ExecutiveAIAssistantView.tsx

| Fitur                                          | Lokasi kode                                  | Status |
|-------------------------------------------------|-----------------------------------------------|--------|
| Aksi dashboard perusahaan (Scale Budget Iklan, Rekrut Staf, Tinjau Piutang Jatuh Tempo, Laporan Analisis Mingguan) | ExecutiveAIAssistantView.tsx:2107-2131 (array actions) | [ADA DI KODE] |
| Pills prompt cepat (Laporan kinerja bulanan, Presentasi rapat direksi, Ringkas arus kas, Target & prediksi penjualan, Beban tim & tugas, Simulasi skenario bisnis, Riset & analisis data) | ExecutiveAIAssistantView.tsx:2135-2143 (array pills) | [ADA DI KODE] |
| Studio: Analisis PDF, Analisis Excel, Analisis Word, Buat Gambar, Buat Audio/Voiceover, Rekam Suara (transkripsi), Buat Video, Kalkulator Pajak Bisnis, Generator Invoice Formal, Kuis, Flashcard, Template Dokumen (19 template) | ExecutiveAIAssistantView.tsx:2148-2177 (array pluginCatalog) | [ADA DI KODE] |
| Pintasan kerja: Buka operasional tim | ExecutiveAIAssistantView.tsx:2872-2879 | [ADA DI KODE] |
| Pintasan kerja: Buka reservasi & antrean | ExecutiveAIAssistantView.tsx:2881-2889 | [ADA DI KODE] |
| Pintasan kerja: Buka stok & pembelian | ExecutiveAIAssistantView.tsx:2893-2901 | [ADA DI KODE] |
| AI otomatis jawab pertanyaan target penjualan (sales-target-engine) | src/lib/ai-brain/sales-target-engine.ts, diwire brain/chat/route.ts:972 | [ADA DI KODE] |
| AI otomatis jawab pertanyaan stok/restock/supplier/retur (inventory-intelligence-engine) | src/lib/ai-brain/inventory-intelligence-engine.ts, diwire brain/chat/route.ts:986 | [ADA DI KODE] |

### 3b. Finance - FinanceAIAssistantView.tsx

| Fitur                                          | Lokasi kode                                  | Status |
|-------------------------------------------------|-----------------------------------------------|--------|
| tools[] konsolidasi (18 kemampuan): Draf Surat Penagihan Invoice, Audit Beban & Arus Kas, Estimasi Setoran Pajak PPh/PPN, Spreadsheet & Rekonsiliasi Kas, Analisis Margin & Unit Economics, Unggah & Analisis Rekening Koran, Ringkasan & Tanya Jawab Dokumen, Draf Kontrak Perjanjian Finansial, Grafik & Tren Keuangan, SOP Kas & Reimbursement, Laporan keuangan bulanan, Laporan PDF siap kirim, Presentasi laporan, Spreadsheet Excel, Simulasi skenario bisnis, Generator Invoice Formal (mini-form wajib nama klien+nominal), Kuis, Flashcard, Template Dokumen | FinanceAIAssistantView.tsx:1608-1750 (array tools, dikonsolidasi 7 Sep dari 3 lokasi lama) | [ADA DI KODE] |
| Aksi cepat dashboard keuangan (Tagih Invoice Klien Menunggak, Audit Beban Operasional, Estimasi Setoran Pajak PPh, Rekap Arus Kas & Runway) | FinanceAIAssistantView.tsx:1753-1779 (array actions) | [ADA DI KODE] |
| Pintasan kerja: Buka stok & pembelian | FinanceAIAssistantView.tsx:2491-2502 | [ADA DI KODE] |

### 3c. Marketing - MarketingAIAssistantView.tsx

| Fitur                                          | Lokasi kode                                  | Status |
|-------------------------------------------------|-----------------------------------------------|--------|
| tools[] (9 kemampuan): Ide Konten & Copywriting Video, Ringkasan & Tanya Jawab Dokumen, Terjemahan Bahasa, Jadwal Konten Sosial Sepekan, Riset Kompetitor, Generator Naskah Video AI, Studio Visual Iklan AI, Kalkulator ROAS & CAC, Generator Kupon & Promo | MarketingAIAssistantView.tsx:1816-1866 | [ADA DI KODE] |
| actions[] (Scale Budget Iklan, Luncurkan Kampanye TikTok Baru, Buat Kode Promo Flash, Laporan Performa Mingguan) | MarketingAIAssistantView.tsx:1876-1900 | [ADA DI KODE] |
| pills[] (Laporan performa iklan, Presentasi hasil campaign, Naskah copywriting) | MarketingAIAssistantView.tsx:1914-1918 | [ADA DI KODE] |
| Studio media Marketing (Gambar/Voiceover/Rekam/Video/Kuis/Flashcard) | MarketingAIAssistantView.tsx:2454 (wrapper aria-label) | [ADA DI KODE] |
| Integrasi Meta Ads & TikTok Pixel | MarketingAIAssistantView.tsx:2384 | [ADA DI KODE] |
| Katalog produk (baca nama/harga produk asli dari Stok & Pembelian saat bikin copywriting) | tidak ada - copyForm.productName di MarketingAIAssistantView.tsx:809 cuma text-input manual, tidak connect ke Product API | [USULAN] |
| Buka Stok & Pembelian (lihat stok sebelum janji promo "stok terbatas") | tidak ada onOpenInventory di MarketingAIAssistantView.tsx maupun pemanggilan di page.tsx | [USULAN] |


## 4. Tabel fitur Dashboard per role

### 4a. CEO - CompanyDataDashboard.tsx (overview, page.tsx:1275)

| Section                                    | Lokasi kode                        | Status |
|---------------------------------------------|--------------------------------------|--------|
| Snapshot Perusahaan                          | CompanyDataDashboard.tsx:1152        | [ADA DI KODE] |
| Target & prediksi AI                         | CompanyDataDashboard.tsx:1483        | [ADA DI KODE] |
| Rekomendasi Strategis AI                     | CompanyDataDashboard.tsx:2261        | [ADA DI KODE] |
| Proyeksi 3 Bulan ke Depan                    | CompanyDataDashboard.tsx:2345        | [ADA DI KODE] |
| Simulator Skenario Bisnis (What-If)          | CompanyDataDashboard.tsx:2515        | [ADA DI KODE] |
| Keuangan & Arus Kas Bisnis (ringkasan) + Kalkulator HPP/KUR (CorPlanQuickTools) | CompanyDataDashboard.tsx:2678, CorPlanQuickTools dipanggil di :2910 | [ADA DI KODE] |
| Marketing & Pertumbuhan Pelanggan (ringkasan) | CompanyDataDashboard.tsx:2921        | [ADA DI KODE] |
| Karyawan, SDM & Beban Tim (ringkasan) + Panel Payroll/Promosi/Disiplin (HRAdvisorPanel) | CompanyDataDashboard.tsx:3116, HRAdvisorPanel dipanggil di :3257 | [ADA DI KODE] |
| Profil Perusahaan & Legalitas                | CompanyDataDashboard.tsx:3265        | [ADA DI KODE] |
| Log Instruksi AI Asisten                     | CompanyDataDashboard.tsx:3346        | [ADA DI KODE] |
| Kartu ringkas "Stok & Pembelian" (jumlah produk, nilai stok, produk di bawah minimum) | CompanyDataDashboard.tsx:1569 (landed pas dokumen ini sedang ditulis - dicek ulang sebelum dokumen selesai, lihat catatan bagian 7 poin 3) | [ADA DI KODE] |

### 4b. Finance - FinanceModuleView.tsx (detail, page.tsx:1341)

| Section                                    | Lokasi kode                        | Status |
|---------------------------------------------|--------------------------------------|--------|
| Ringkasan Finansial Eksekutif (versi print/export) | FinanceModuleView.tsx:876        | [ADA DI KODE] |
| Buku Besar Transaksi Terkini                 | FinanceModuleView.tsx:899            | [ADA DI KODE] |
| Status Piutang & Invoice Klien               | FinanceModuleView.tsx:923            | [ADA DI KODE] |
| Kategori pengeluaran                         | FinanceModuleView.tsx:1714           | [ADA DI KODE] |
| Alur uang bulan ini                          | FinanceModuleView.tsx:1784           | [ADA DI KODE] |
| Kas & kalkulator                             | FinanceModuleView.tsx:1991           | [ADA DI KODE] |
| Estimasi pajak bulan ini + Pengingat jatuh tempo pajak | FinanceModuleView.tsx:2347, 2460 | [ADA DI KODE] |
| Piutang per rentang umur + Invoice terbaru   | FinanceModuleView.tsx:2535, 2592     | [ADA DI KODE] |
| Invoice & piutang berjalan                   | FinanceModuleView.tsx:2643           | [ADA DI KODE] |
| Piutang klien                                | FinanceModuleView.tsx:2878           | [ADA DI KODE] |
| Kewajiban terjadwal                          | FinanceModuleView.tsx:3004           | [ADA DI KODE] |
| Unit economics CAC dan LTV                   | FinanceModuleView.tsx:3231           | [ADA DI KODE] |
| Hasil simulasi rencana keuangan              | FinanceModuleView.tsx:3320           | [ADA DI KODE] |

### 4c. Marketing - MarketingModuleView.tsx (detail, page.tsx:1372)

| Section                                    | Lokasi kode                        | Status |
|---------------------------------------------|--------------------------------------|--------|
| Perlu tindakan                               | MarketingModuleView.tsx:532          | [ADA DI KODE] |
| Kode promo & voucher                         | MarketingModuleView.tsx:782          | [ADA DI KODE] |
| Ringkasan audiens                            | MarketingModuleView.tsx:823          | [ADA DI KODE] |
| Perjalanan dari iklan sampai closing (funnel)| MarketingModuleView.tsx:880          | [ADA DI KODE] |
| Daftar kampanye iklan berjalan               | MarketingModuleView.tsx:1028         | [ADA DI KODE] |
| Laporan marketing                            | MarketingModuleView.tsx:1156         | [ADA DI KODE] |


## 5. Feature view (dibuka lewat "Pintasan kerja", bukan menu dashboard biasa)

| Feature view          | Isi (tab)                                    | CEO | Finance | Marketing | Lokasi kode                          |
|--------------------------|-------------------------------------------------|-----|---------|-----------|-----------------------------------------|
| Operasional tim          | Kanban, Presensi, KPI, SOP                       | ADA | -       | -         | KlirWorkspaceView.tsx:46, page.tsx:1234 |
| Reservasi & antrean      | Reservasi, Antrean, Loyalitas, Reminder          | ADA | -       | -         | KlirScheduleView.tsx:21, page.tsx:1252  |
| Stok & Pembelian         | Produk & stok, Riwayat keluar-masuk, Pesanan pembelian, Skor pemasok | ADA | ADA | - | KlirInventoryView.tsx:29, page.tsx:1270 (CEO), page.tsx:1336 (Finance) |

Fitur "Stok & Pembelian" ini baru selesai disambungkan sesi ini (9-10 September 2026):
model Prisma (Product/StockMovement/PurchaseOrder/PurchaseOrderItem/StockReturn/SupplierScore,
prisma/schema.prisma baris 808-980), 5 endpoint lama (consignment/photo-to-stock/purchase-orders/
returns/supplier-score) dari 9 Sep, ditambah 2 endpoint baru (products, stock-movements) dan UI
KlirInventoryView.tsx dari sesi ini. Backend, UI, dan wiring page.tsx sudah nyambung penuh untuk
CEO dan Finance (dicek langsung dari kode, bukan dari dokumen roadmap). Marketing belum dapat
akses ke fitur ini sama sekali - lihat bagian 3c soal "Katalog produk (baca)" yang masih usulan.


## 6. Ringkasan matriks feature x role (versi padat)

| Feature                          | Modul internal | CEO       | Finance   | Marketing | Alasan bisnis                                                  | Dashboard/AI  |
|-------------------------------------|------------------|-----------|-----------|-----------|--------------------------------------------------------------------|----------------|
| Chat AI + aksi otomatis (masing2 role beda tools) | (semua)   | ADA       | ADA       | ADA       | Setiap role kerja lewat AI Assistant sendiri-sendiri, isi tools beda sesuai fungsi | AI |
| Dashboard ringkasan/overview      | (semua)          | ADA (semua area, ringkas) | ADA (finance detail) | ADA (marketing detail) | CEO butuh gambaran umum semua lini, Finance/Marketing butuh detail area sendiri | Dashboard |
| Operasional tim (Kanban/Presensi/KPI/SOP) | workspace | ADA       | -         | -         | Ini kerja manajerial lintas divisi, wajar CEO yang pegang, bukan tugas harian Finance/Marketing | AI (feature view) |
| Reservasi & antrean                 | schedule         | ADA       | -         | -         | Fitur booking pelanggan, biasanya tim ops/front-office, sementara masih nempel ke CEO | AI (feature view) |
| Stok & Pembelian (baca+tulis)       | inventory        | ADA       | ADA       | -         | Beli/stok berdampak kas (perlu Finance), CEO perlu pantau operasional harian juga | AI (feature view) |
| Katalog produk (baca saja)          | inventory        | ADA       | ADA       | [USULAN]  | Marketing bikin promo/copywriting sering perlu tahu nama/harga produk asli, bukan input manual | AI |
| Kalkulator HPP & KUR                | finance (nempel di dashboard CEO) | ADA (CorPlanQuickTools di dashboard) | ADA (lewat tools 'unitEcon' dkk) | - | Alat hitung biaya modal, relevan buat pemilik dan finance | Dashboard+AI |
| Panel HR: Payroll/Promosi/Disiplin  | (belum ada key khusus, ditumpuk di dashboard CEO) | ADA (HRAdvisorPanel) | -   | -   | Data SDM sensitif, wajar dikunci ke CEO saja | Dashboard |
| Invoice, piutang, pajak, kas detail | finance          | ringkasan saja | ADA (penuh) | -    | Finance yang eksekusi harian, CEO cukup tahu angka besar | Dashboard+AI |
| Kampanye, promo, funnel, ROAS detail| advertising      | ringkasan saja | -    | ADA (penuh) | Marketing yang eksekusi harian, CEO cukup tahu angka besar | Dashboard+AI |
| Studio media (gambar/audio/video/kuis/flashcard/template dokumen) | (semua) | ADA | ADA | ADA | Kebutuhan konten lintas divisi, sudah dibuat setara di 3 portal sejak audit 7-8 Sep | AI |


## 7. Temuan tambahan selama audit (di luar tabel di atas)

1. [LOKAL] Modul 'corplan' dan 'personal' cuma nama di array KLIR_MODULE_KEYS
   (module-guard.ts:7-15), NOL pemanggilan isModuleEnabled ke salah satu dari 2 nama itu di
   seluruh src/app dan src/lib (dicek dengan grep -rn menyeluruh). Kalau salah satu fitur yang
   akan datang memang dimaksudkan masuk "modul corplan" atau "modul personal", belum ada
   tempatnya di kode saat ini.

2. [LOKAL] CEO tidak punya tampilan sedetail Finance/Marketing untuk area finance dan
   advertising - CompanyDataDashboard.tsx cuma kasih ringkasan (section 2678 dan 2921), bukan
   tabel/daftar granular seperti FinanceModuleView.tsx dan MarketingModuleView.tsx. Ini
   bukan salah kode, tapi keputusan desain yang perlu dikonfirmasi apakah memang begitu
   maksudnya "CEO superset".

3. [LOKAL] Contoh nyata kerja paralel sesi ini: waktu saya mulai audit, kartu ringkas
   "Stok & Pembelian" di CompanyDataDashboard.tsx belum ada (grep "inventory"/"stok" kosong),
   dan tombol "Buka stok & pembelian" di FinanceAIAssistantView.tsx juga sempat belum ada
   propnya. Beberapa jam kemudian di sesi yang sama, agent wiring-page-ceo-finance sudah
   menyelesaikan keduanya (CompanyDataDashboard.tsx:1569, FinanceAIAssistantView.tsx:2491).
   Semua baris [ADA DI KODE] di dokumen ini sudah saya cek ulang sebelum dokumen selesai supaya
   sinkron dengan versi terakhir. Yang perlu dicatat buat pembaca nanti: kalau dokumen ini
   dibaca lama setelah tanggal di atas, cek ulang ke kode langsung, jangan percaya penuh.

4. [LOKAL] Marketing tidak dapat pintasan kerja apapun (tidak ke Operasional tim, Reservasi,
   atau Stok & Pembelian) - dicek tidak ada prop onOpenWorkspace/onOpenSchedule/onOpenInventory
   di MarketingAIAssistantView.tsx maupun pemanggilannya di page.tsx. Kalau ini disengaja
   (Marketing memang tidak perlu buka fitur itu), tidak masalah. Kalau bukan disengaja, ini gap.

5. [LOKAL] Field "productName" di form copywriting Marketing (MarketingAIAssistantView.tsx:809)
   murni text-input manual, tidak terhubung ke data Product asli dari Stok & Pembelian. Marketing
   bisa saja menulis nama produk yang beda dari yang tercatat di sistem, atau menyebut harga yang
   sudah tidak berlaku.


## 8. Keputusan yang butuh Mecca

1. CEO "superset" itu maksudnya cuma AKSES (bisa buka semua portal tanpa modul jadi gerbang,
   sudah begini di kode sekarang) atau juga KEDALAMAN TAMPILAN (CEO harus bisa lihat tabel
   detail yang sama persis dengan yang Finance/Marketing lihat, bukan cuma ringkasan)?
   Ini nentuin apakah section ringkasan di CompanyDataDashboard perlu diperdalam atau memang
   sengaja dibikin ringkas biar CEO tidak kebanjiran detail.

2. Modul 'corplan' dan 'personal' di module-guard.ts - masih dipakai buat rencana ke depan,
   atau boleh dihapus dari daftar 7 modul karena memang tidak akan diisi? Kalau masih dipakai,
   fitur apa yang dimaksud masuk situ?

3. Marketing perlu akses baca ke katalog produk (Stok & Pembelian, read-only) supaya
   copywriting/promo pakai data produk asli, bukan ketik manual? Ini usulan di bagian 3c/6,
   belum ada di kode.

4. Panel HR (Payroll/Promosi/Disiplin, HRAdvisorPanel) sekarang nempel di dashboard CEO tanpa
   modul/role khusus. Kalau nanti ada role HR Manager terpisah, panel ini yang jadi cikal
   bakalnya, atau tetap selamanya bagian CEO?

5. Pintasan kerja "Buka stok & pembelian" sekarang ada di CEO dan Finance. Marketing dan
   role mendatang (kalau ada) perlu ditambah pintasan yang sama, atau memang sengaja dibatasi
   2 role itu saja karena berkaitan langsung ke kas?


## 9. Penutup

Semua isi dokumen ini USULAN buat diskusi, BELUM diimplementasi ke RBAC atau kode apapun.
Saya (agent doc-role-feature-matrix) tidak menyentuh kode sama sekali - murni baca dan tulis
dokumen ini. Setiap baris [ADA DI KODE] sudah saya cek langsung via grep/baca file pada waktu
dokumen ini ditulis (10 September 2026, sore), bukan mengutip dokumen roadmap lama. Kalau ada
perubahan kode setelah dokumen ini selesai, sebagian baris [ADA DI KODE] atau [BELUM ADA] bisa
basi - cek ulang ke kode langsung, bukan percaya dokumen ini 100 persen kalau sudah berjarak
waktu jauh dari tanggal di atas.
