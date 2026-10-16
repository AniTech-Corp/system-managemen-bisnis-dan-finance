# Audit Portal CEO -- 7 Modul x 2 Permukaan (Dashboard + AI Assistant)

Tanggal: 10 September 2026
Agent: scan-portal-ceo (batch SCAN gabungan, baca-saja)
File yang dibaca penuh: src/app/components/CompanyDataDashboard.tsx (3688 baris),
src/app/components/ExecutiveAIAssistantView.tsx (4385 baris), src/app/page.tsx (1439 baris,
bagian CEO), src/app/components/KlirWorkspaceView.tsx, src/app/components/KlirScheduleView.tsx,
src/app/components/KlirInventoryView.tsx, src/app/components/CorPlanQuickTools.tsx,
src/app/components/HRAdvisorPanel.tsx, src/lib/module-guard.ts, src/lib/ai-brain/sales-target-engine.ts,
src/lib/ai-brain/prediction-engine.ts, src/lib/ai-brain/context-engine.ts,
src/app/api/v1/brain/context/route.ts, src/app/api/v1/brain/forecast/route.ts,
src/lib/ai-brain/next-actions.ts.

Semua klaim tier [KODE] (dibaca langsung dari kode, file:line disertakan). Tidak ada
[LIVE] di laporan ini -- agent tidak punya sesi login (sesuai otorisasi), jadi tidak ada
klaim "terlihat di browser".

=================================================================================
BAGIAN 0 -- PETA 7 MODUL UNTUK PORTAL CEO (siapa mewakili siapa)
=================================================================================

```
module-guard.ts KLIR_MODULE_KEYS (src/lib/module-guard.ts:7-14):
  corplan      -> CorPlanQuickTools.tsx, tab HPP + KUR, DITANAM di CompanyDataDashboard
                  Section 4 (line 3006), BUKAN feature view terpisah
  personal     -> HRAdvisorPanel.tsx, tab Payroll/Promosi/Disiplin, DITANAM di
                  CompanyDataDashboard Section 6 (line 3353), BUKAN feature view terpisah
  finance      -> Section 4 "Keuangan & Arus Kas Bisnis" (dashboard) + snapshot card
                  "Kondisi Kas" (dashboard) -- tidak ada feature-view finance khusus utk CEO
  advertising  -> Section 5 "Marketing & Pertumbuhan Pelanggan" (dashboard) + snapshot
                  card "Performa Kampanye" (dashboard)
  workspace    -> KlirWorkspaceView.tsx, dibuka sbg ceoFeatureView dari tombol
                  "Buka operasional tim" di AI Assistant (label: Operasional tim)
  schedule     -> KlirScheduleView.tsx, ceoFeatureView, tombol "Buka reservasi & antrean"
  inventory    -> KlirInventoryView.tsx, ceoFeatureView, tombol "Buka stok & pembelian"
```

Catatan penting: hanya finance dan advertising yang punya kartu ringkas bergerbang di
dashboard (CompanyDataDashboard.tsx:1205, :1282). corplan dan personal TIDAK PERNAH
dicek isModuleEnabled() di file dashboard manapun -- confirmed via grep penuh file,
nol hasil untuk kedua key ini di CompanyDataDashboard.tsx maupun ExecutiveAIAssistantView.tsx.

=================================================================================
BAGIAN 1 -- MATRIKS 7 MODUL x 2 PERMUKAAN (CEO)
=================================================================================

Kolom "Gerbang" = apakah isModuleEnabled() dicek untuk modul itu di permukaan itu.

```
+-------------+---------------------------------+---------------------------------+
| Modul       | DASHBOARD (CompanyDataDashboard) | AI ASSISTANT (ExecutiveAI...)    |
+-------------+---------------------------------+---------------------------------+
| corplan     | Fitur: Kalkulator HPP + KUR      | Tidak ada pintasan langsung ke   |
|             | (CorPlanQuickTools.tsx)          | corplan; HPP/KUR cuma reachable  |
|             | Lokasi: line 3006, DI DALAM      | via chat umum kalau user tanya   |
|             | Section 4 Keuangan (salah        | manual. Tidak ada tombol         |
|             | tempat -- HPP itu produksi/COGS, | "Pintasan kerja" utk corplan.    |
|             | bukan arus kas)                  | [KODE] grep "corplan" +          |
|             | Gerbang: TIDAK ADA (selalu       | "CorPlan" di ExecutiveAI...tsx:  |
|             | render, isModuleEnabled tidak    | nol hasil.                       |
|             | pernah dipanggil untuk 'corplan')|                                   |
|             | Sumber data: form input manual   |                                   |
|             | (kalkulator), bukan endpoint DB. |                                   |
+-------------+---------------------------------+---------------------------------+
| personal    | Fitur: HR Advisor (Payroll/      | Sama -- tidak ada pintasan       |
|             | Promosi/Disiplin), HRAdvisor     | langsung. Data personal (payroll)|
|             | Panel.tsx line 3353, Section 6.  | tidak muncul di "tools"/"actions"|
|             | Sumber data: fetch nyata         | list (2043-2141) sebagai entri   |
|             | /api/v1/kerja/tasks +            | bernama.                         |
|             | /api/v1/kerja/attendance         |                                   |
|             | (HRAdvisorPanel.tsx:110-111,165) |                                   |
|             | Gerbang: TIDAK ADA (sama seperti |                                   |
|             | corplan, isModuleEnabled('personal')|                                |
|             | nol hasil di seluruh file)       |                                   |
+-------------+---------------------------------+---------------------------------+
| finance     | Kartu "Kondisi Kas" (snapshot,   | Tidak ada feature-view finance   |
|             | line 1205) -- BERGERBANG,        | terpisah utk CEO (by design;     |
|             | zero-state jujur "Fitur keuangan | finance = portal sendiri).       |
|             | belum aktif untuk workspace ini" | "Tinjau Piutang Jatuh Tempo" jadi|
|             | (line ~1267).                    | salah satu dari 4 tombol         |
|             | TAPI Section 4 penuh "Keuangan & | "Aksi dashboard perusahaan"      |
|             | Arus Kas Bisnis" (line 2769-3011,| (line 2043-2141) -- ini cuma     |
|             | grafik rev/exp/margin + cost     | kirim pesan chat, BUKAN aksi     |
|             | breakdown) TIDAK BERGERBANG --   | otomatis (lihat Bagian 3).       |
|             | render penuh walau finance       |                                   |
|             | dimatikan di enabledModules.     |                                   |
|             | [KODE] grep isModuleEnabled di   |                                   |
|             | file: cuma muncul line 1205 &    |                                   |
|             | 1282, TIDAK ADA di 2769.         |                                   |
|             | Sumber data rev/exp/margin: real |                                   |
|             | (fetch /api/v1/kas/transactions +|                                   |
|             | /api/v1/analytics/financial-trends,|                                 |
|             | line 468-470). TAPI cost         |                                   |
|             | breakdown (HPP/ads/payroll) SELALU|                                  |
|             | 0 -- lihat Bagian 2.             |                                   |
+-------------+---------------------------------+---------------------------------+
| advertising | Kartu "Performa Kampanye"        | Tombol "Scale Budget Iklan (+20%)"|
|             | (snapshot, line 1282) --         | ada di "Aksi dashboard perusahaan"|
|             | BERGERBANG, zero-state jujur     | (line 2114-2118) -- label janji  |
|             | (pola sama Kondisi Kas).         | "update ke dashboard" tapi        |
|             | Section 5 penuh "Marketing &     | mekanismenya cuma kirim teks ke   |
|             | Pertumbuhan Pelanggan" (line     | chat (lihat Bagian 3).            |
|             | 3012-3206) TIDAK BERGERBANG --   |                                   |
|             | sama seperti finance, render     |                                   |
|             | penuh walau advertising          |                                   |
|             | dimatikan.                       |                                   |
|             | Sumber data SELURUH section ini: |                                   |
|             | 100% DEFAULT_MKT (hardcode 0     |                                   |
|             | semua field, line 83-92) --      |                                   |
|             | TIDAK ADA fetch API apapun utk   |                                   |
|             | data marketing di file ini.      |                                   |
|             | Grep "fetch(" penuh file: nol    |                                   |
|             | hasil endpoint marketing/ads.    |                                   |
+-------------+---------------------------------+---------------------------------+
| workspace   | Tidak ada di dashboard langsung  | Tombol "Buka operasional tim"    |
|             | (dashboard cuma overview pasif,  | (Pintasan kerja, line 2876-2883),|
|             | sesuai doktrin).                 | onClick = onOpenWorkspace prop.  |
|             |                                  | Tombol SELALU tampil (kondisi    |
|             |                                  | render cuma cek prop-nya truthy, |
|             |                                  | line 2869 -- prop selalu ada,    |
|             |                                  | bukan enabledModules), tapi      |
|             |                                  | handler-nya (page.tsx:1300) diam-|
|             |                                  | diam no-op kalau modul workspace |
|             |                                  | dimatikan -- klik = tidak terjadi|
|             |                                  | apa-apa, nol feedback ke user.   |
|             |                                  | Isi (KlirWorkspaceView.tsx): tab |
|             |                                  | kanban/attendance/kpi/sop, semua |
|             |                                  | fetch endpoint /api/v1/kerja/*   |
|             |                                  | real (line 187-361).             |
+-------------+---------------------------------+---------------------------------+
| schedule    | Tidak ada di dashboard langsung. | Tombol "Buka reservasi & antrean"|
|             |                                  | (line 2884-2892), sama pola      |
|             |                                  | dead-click no-op seperti         |
|             |                                  | workspace di atas (page.tsx:1305).|
|             |                                  | Isi (KlirScheduleView.tsx): tab  |
|             |                                  | reservasi/antrean/loyalty/       |
|             |                                  | reminder, semua fetch            |
|             |                                  | /api/v1/booking/* real           |
|             |                                  | (line 392-633).                  |
+-------------+---------------------------------+---------------------------------+
| inventory   | Kartu ringkas "Stok & Pembelian" | Tombol "Buka stok & pembelian"   |
|             | (dashboard, line 1564 dst,       | (line 2894-2901), sama pola      |
|             | disebut di komentar line 264,616)| dead-click no-op (page.tsx:1310).|
|             | -- limit=1 fetch                 | ProactiveAlertsPanel role="CEO"  |
|             | /api/v1/inventory/products       | (line 3059) sudah wired, baca    |
|             | (line 624).                      | data restock/low-stock/retur     |
|             |                                  | real (lihat inventory-           |
|             |                                  | intelligence-engine.ts, dicek    |
|             |                                  | agent B).                        |
|             |                                  | Isi (KlirInventoryView.tsx): 5   |
|             |                                  | tab produk/riwayat/PO/skor       |
|             |                                  | pemasok/konsinyasi, sudah        |
|             |                                  | LIVE-tested per ELIPS 10 Sep.    |
|             |                                  | Prop role?:'CEO'|'FINANCE' DIDEKLARASI |
|             |                                  | tapi TIDAK PERNAH dipakai di     |
|             |                                  | badan komponen (destructuring    |
|             |                                  | pakai _props, KlirInventoryView.tsx:493)|
|             |                                  | -- CEO dan FINANCE lihat view    |
|             |                                  | yang 100% identik, gating peran  |
|             |                                  | (kalau ada) terjadi di server    |
|             |                                  | (minRole per endpoint), bukan di |
|             |                                  | client. Bukan bug, tapi worth    |
|             |                                  | dicatat karena prop role terlihat|
|             |                                  | seperti dipakai padahal tidak.   |
+-------------+---------------------------------+---------------------------------+
```

=================================================================================
BAGIAN 2 -- BLOK AI ANALISA + PREDIKSI + REKOMENDASI (DOKTRIN AYAH MECCA, 10 Sep)
=================================================================================

(i) Apakah dashboard CEO punya blok ini? YA, ada -- kartu "Target & Prediksi AI"
(CompanyDataDashboard.tsx:1514-1567). Tapi mekanisme datanya BUKAN yang dibayangkan
doktrin ("AI menganalisa yang sudah terjadi dari data transaksi").

[KODE] Rantai sebab-akibat kartu ini, dibaca sampai sumbernya:
1. CompanyDataDashboard.tsx:666-667 -- `salesTarget = liveState?.salesTarget`, dibaca dari
   localStorage key `klir_live_company_state`.
2. Satu-satunya penulis field `salesTarget` ke localStorage itu: ExecutiveAIAssistantView.tsx:
   1395-1416, fungsi `persistSalesTargetAnalysis(prompt)`. Fungsi ini jalan HANYA saat CEO
   mengetik pesan chat yang match regex `detectSalesTargetIntent()`
   (sales-target-engine.ts:46: `/(target\s+(?:penjualan|sales)|target\s+tahunan|realisasi...|per\s+kuartal|q[1-4])/i`).
3. Angka yang dipakai bukan dari invoice/transaksi DB -- `analyzeSalesTarget(message)`
   (sales-target-engine.ts:73) memarsing ANGKA DARI TEKS PESAN ITU SENDIRI pakai regex
   `AMOUNT_PATTERN` (line 25: `Rp 100 juta`, `Q1 15 juta`, dst). Kalau CEO tidak mengetik
   angka yang match pola ini persis, tidak ada apa pun yang tersimpan.
4. `/api/v1/brain/context` (dipanggil dashboard line 472) SAMA SEKALI TIDAK punya field
   `salesTarget` -- grep "sales" di context-engine.ts: NOL HASIL. Jadi endpoint AI Brain resmi
   yang membaca data transaksi asli TIDAK terlibat sama sekali dalam kartu ini.

Kesimpulan: kartu "Target & Prediksi AI" jujur soal zero-state (`hasSalesTarget` false ->
"Butuh target bisnis" / "Belum ada data", line 1526-1546, tidak mengarang angka) -- ini
sesuai doktrin bagian "AI tidak mengarang". TAPI mekanisme "menganalisa yang sudah
terjadi" TIDAK ADA -- yang ada cuma parser regex atas teks bebas yang diketik CEO sendiri.
Kalau CEO tidak pernah mengetik format "target penjualan X juta, Q1 Y juta..." persis,
kartu ini permanen kosong SELAMANYA walaupun transaksi kas asli sudah tercatat ratusan kali
di Buku Kas. Ini bukan analisa otomatis dari data, ini formulir tersembunyi yang menyamar
sebagai insight AI.

Sementara itu, ADA engine forecast yang genuinely membaca data transaksi asli dan
SUDAH DIBANGUN, tapi TIDAK dipakai dashboard:
- src/lib/ai-brain/prediction-engine.ts:31 `runForwardForecast()` -- input
  `BusinessContextSnapshot` (dari getOrBuildBusinessContext, data kas asli), output
  `currentLiquidCash`, `monthlyBurnRate`, `runwayMonths`, `cashOutDate`, 3 trajectory
  (conservative/expected/optimistic), plus daftar `anomalies` (RUNWAY_CRITICAL,
  UNCOLLECTED_RECEIVABLES, CAC_DEGRADATION, dst -- prediction-engine.ts:4-9).
- Endpoint: POST /api/v1/brain/forecast (src/app/api/v1/brain/forecast/route.ts:1-16),
  sudah dipanggil dari ExecutiveAIAssistantView.tsx:2301 (`handleForecastRefine`) --
  TAPI hanya jalan di dalam thread chat, dipicu lewat chip "Buat prediksi" yang cuma
  muncul kalau pesan user sendiri match `PREDICTION_SIGNAL`
  (next-actions.ts:60,128: `/prediksi|proyeksi|masa depan|1 bulan|3 bulan|.../`).
  Endpoint ini TIDAK PERNAH dipanggil dari CompanyDataDashboard.tsx (grep "brain/forecast"
  di file itu: nol hasil).

USULAN KONKRET (additive-safe, tidak mengubah endpoint yang sudah ada):
- Tambah 1 fetch baru di CompanyDataDashboard.tsx (pola sama dengan fetch brain/context
  line 472): panggil GET-equivalent atau POST /api/v1/brain/forecast dengan horizon
  default (mis. 3 bulan), tampilkan `runwayMonths`/`cashOutDate`/trajectory `expected`
  sebagai kartu "Prediksi Kas" BARU yang terpisah dari "Target Penjualan" (jangan
  gabung dua konsep beda: target-penjualan-manual vs prediksi-kas-otomatis).
  Kartu lama "Target & Prediksi AI" tetap ada (untuk siapa yang memang mau input target),
  tapi labelnya perlu jujur -- ganti jadi "Target Penjualan (dari input Anda)" supaya
  tidak diklaim sebagai "prediksi AI dari data" padahal sumbernya ketikan sendiri.
- Kartu baru bisa pakai anomalies dari forecast (RUNWAY_CRITICAL dsb) sebagai pengganti
  alert 'team' yang sudah mati (lihat Bagian 3) -- data ini genuinely nyata dan belum
  dipakai di manapun di dashboard.

=================================================================================
BAGIAN 3 -- TEMUAN DETAIL (tombol mati, data hardcode, duplikasi, label)
=================================================================================

3.1 GERBANG TIDAK KONSISTEN -- Section penuh tidak ikut toggle modul (TEMUAN UTAMA)
[KODE] CompanyDataDashboard.tsx: snapshot card "Kondisi Kas" (line 1205) dan
"Performa Kampanye" (line 1282) BERGERBANG isModuleEnabled(). Tapi Section 4 "Keuangan &
Arus Kas Bisnis" (line 2769, tidak ada isModuleEnabled sepanjang blok sampai line 3011)
dan Section 5 "Marketing & Pertumbuhan Pelanggan" (line 3012-3206, sama, tidak ada gerbang)
RENDER PENUH tanpa syarat. Kalau workspace mematikan modul finance, CEO tetap melihat
grafik rev/exp/margin lengkap 6 bulan begitu scroll ke bawah snapshot card yang sudah
sengaja disembunyikan. Defense-in-depth yang disebut di komentar line 1201-1204 JUSTRU
BOCOR di section yang lebih besar. Akar masalah: gerbang ditambahkan cuma di 2 kartu kecil
(mengikuti pola commit 9 Sep yang disebut di context pack), section besar yang dibangun
duluan tidak ikut diaudit ulang.
Perbaikan: bungkus Section 4 dengan `{isModuleEnabled(enabledModules,'finance') && (...)}`
dan Section 5 dengan `{isModuleEnabled(enabledModules,'advertising') && (...)}`.
Estimasi diff: ~6 baris tambahan per section (buka/tutup blok kondisional), TIDAK
mengubah isi section. Total ~12 baris.

3.2 CORPLAN & PERSONAL -- NOL GERBANG SAMA SEKALI
[KODE] grep `isModuleEnabled(enabledModules, 'corplan')` dan `'personal'` di
CompanyDataDashboard.tsx: NOL HASIL. CorPlanQuickTools (line 3006) dan HRAdvisorPanel
(line 3353) selalu render apa pun status enabledModules workspace. Beda dari finance/
advertising yang sudah punya gerbang (meski section besarnya bocor per 3.1), corplan dan
personal belum pernah disentuh gerbang sama sekali sejak modul ini didaftarkan di
module-guard.ts.
Perbaikan: bungkus `<CorPlanQuickTools />` dengan cek 'corplan', `<HRAdvisorPanel />`
dengan cek 'personal'. Estimasi diff: ~4 baris per komponen, ~8 baris total.

3.3 ALERT "BEBAN TIM" -- MATI PERMANEN (dead code, dikonfirmasi 2 lapis)
[KODE] CompanyDataDashboard.tsx:865 `if (t.mkt > 75)` -- syarat alert 'team' muncul di
Section 2 "Perlu Tindakan". `t` diinisialisasi dari DEFAULT_TEAM (line 648, SEMUA field
0 termasuk `mkt: 0`, line 95-104) -- TIDAK ADA fetch API apa pun yang mengisi data tim
nyata (grep "fetch(" penuh file: nol endpoint tim/task-load). Satu-satunya cara t.mkt
bisa > 75 adalah override manual line 650-652: `if (tasksShifted && month === 'Agu')
t.mkt = 82`. `tasksShifted` (useState line 405, default false) HANYA bisa jadi true lewat
tombol "Seimbangkan beban divisi" (line 1749) -- TAPI tombol itu ada DI DALAM panel detail
yang HANYA render kalau alert 'team' SUDAH ADA (`isOpen && a.id === 'team'`, line 1688).
Ini circular: alert butuh t.mkt>75 untuk muncul, tapi satu-satunya cara menaikkan t.mkt
adalah lewat tombol yang cuma ada SETELAH alert muncul. Dari kondisi awal (tasksShifted
false, bulan apa pun termasuk Agu), t.mkt SELALU 0 -- alert 'team' TIDAK PERNAH bisa
muncul untuk siapa pun, di skenario apa pun, sejak kode ini ditulis.
Lapis kedua: seandainya alert ini somehow muncul, `mktMembers` (line 1028) adalah array
KOSONG HARDCODE (`= []`, tidak pernah diisi) -- jadi tabel "Rincian Beban Divisi" akan
SELALU jatuh ke cabang zero-state "Pelacakan beban kerja per individu belum dikonfigurasi"
(line 1696-1701) walau alert-nya somehow aktif. Tombol "Seimbangkan beban divisi" ada di
dalam cabang yang beririsan dengan cabang yang juga tidak pernah tercapai.
Diputuskan sementara: HILANGKAN blok alert 'team' (line 864-872) + panel detail terkait
(line 1688-1762, drill-down 'team') + variabel `mktMembers`/`tasksShifted` yang jadi tidak
terpakai lagi setelahnya -- opsi paling sederhana karena tidak ada sumber data tim nyata
di schema Prisma saat ini (butuh model task-assignment per anggota yang belum ada).
Alternatif kalau nanti mau LENGKAPI beneran: sumber data taskload sudah ADA lewat
/api/v1/kerja/tasks (dipakai KlirWorkspaceView.tsx & HRAdvisorPanel.tsx) -- agregasi
per-assignee dari situ bisa jadi t.mkt yang genuinely nyata, tapi ini pekerjaan baru
(bukan quick-fix), estimasi ~80-120 baris (agregasi + wiring ulang alert).
Estimasi diff HILANGKAN: -95 baris kira-kira (alert push 9 baris + detail panel drill-down
~75 baris + 2 variabel declaration).

3.4 COST BREAKDOWN (HPP / Ads / Payroll) -- SELALU NOL WALAU REVENUE ASLI ADA
[KODE] CompanyDataDashboard.tsx:797-799 `costRows` = [HPP, Beban operasional, Budget
iklan marketing, Gaji staf]. Nilai `f.hpp`, `f.ads`, `f.pay` HARDCODE 0 di TITIK
PENGISIAN `realFinMap` (line 536-538: `hpp: 0, ads: 0, pay: 0` di dalam
`series.forEach` yang mengisi dari /api/v1/analytics/financial-trends) -- endpoint itu
sendiri TIDAK mengembalikan breakdown per kategori biaya, jadi 3 dari 4 baris cost
breakdown SELALU tampil Rp 0 / 0% untuk SEMUA tenant, bahkan tenant dengan f.exp
(total beban) yang genuinely besar. Hanya "Beban operasional" (f.ops = pt.expense,
line 534) yang riil. Risiko: CEO bisa salah baca "Rp 0" sebagai "kita memang tidak ada
biaya HPP/iklan/gaji" padahal sebenarnya artinya "sistem belum bisa memecah kategori
biaya ini".
Diputuskan sementara: ganti 3 baris itu (HPP/Ads/Payroll) jadi HILANGKAN dari costRows
untuk sekarang, sisakan cuma "Beban operasional" (yang riil) + baris baru "Kategori
lain belum bisa dipecah" sebagai catatan jujur, DAKAMA tidak ada sumber pemisahan
kategori biaya di schema (CashTransaction saat ini tidak punya field kategori HPP vs
ads vs payroll terpisah -- perlu dicek oleh agent C, scan-kebutuhan-data). Estimasi
diff: -3 baris entri constant + tambahan 1 baris caption jujur.

3.5 MARKETING & TEAM CHART -- SELURUH SECTION 100% HARDCODE 0, BUKAN SEKADAR TIDAK
BERGERBANG
[KODE] `m` (CompanyDataDashboard.tsx:648) = `DEFAULT_MKT[month]` SELALU (tidak pernah
`realFinMap`-equivalent untuk marketing -- tidak ada `realMktMap` di file ini sama
sekali). `t` (line 649) = `DEFAULT_TEAM[month]` SELALU (kecuali override tasksShifted
yang sudah terbukti mati permanen di 3.3). DEFAULT_MKT (line 83-92) dan DEFAULT_TEAM
(line 95-104) semuanya berisi 0 untuk tiap bulan -- ini beda dari masalah 3.1 (gerbang
modul): bahkan kalau modul advertising DINYALAKAN dan section-nya benar-benar
digerbang dengan benar, section ini TETAP akan menampilkan grafik/breakdown yang semuanya
nol permanen, karena tidak ada satu pun endpoint API yang dipanggil untuk mengisi data
marketing/tim di file dashboard ini. channelRows (Meta/TikTok/Google, line 809-818) dan
teamMktPath/teamAvgPath (line 790-791) sama-sama turunan dari `m`/`t` yang nol permanen.
Ini section yang secara struktural TIDAK BISA PERNAH menampilkan data marketing/tim nyata
sampai ada fetch API baru ditambahkan -- bukan bug kecil, ini gap arsitektur.
Diputuskan sementara: sampai ada endpoint marketing/tim nyata (di luar scope batch
baca-saja ini, catat sebagai kebutuhan skema/endpoint ke agent C & komando), Section 5
dan bagian tim di Section 6 sebaiknya tampil sebagai empty-state jujur ("Data marketing/
tim belum tersambung") bukan chart dengan angka 0 yang terlihat seperti data asli.
Estimasi diff kalau mau LENGKAPI beneran (bukan cuma empty-state): butuh model Campaign/
ad-spend + agregasi per channel (Meta/TikTok/Google) yang menurut context pack MEMANG
sudah ada di area Marketing Fatur (Campaign model) -- kemungkinan cross-wiring dari
Finance/Marketing portal ke CEO dashboard, bukan bikin dari nol. Estimasi kerja besar
(100+ baris, lintas modul) -- flag untuk komando, bukan quick-patch batch build biasa.

3.6 "PENGATURAN ADMIN" -- TOAST JUJUR (SUDAH DIPERBAIKI, BUKAN TEMUAN BARU)
[KODE] ExecutiveAIAssistantView.tsx:2744 tombol "Pengaturan admin" (dulu "Pengaturan
akses per-divisi") onClick -> `showToast('Pengaturan akses per-divisi belum tersambung
ke sistem RBAC sungguhan...')`. Komentar di kode (line 2723-2738) menjelaskan modal lama
DISENGAJA dimatikan karena toggle-nya struktural tidak bisa membatasi apa pun (state
tidak dibagi lintas portal React). Ini SUDAH diperbaiki jadi jujur (toast, bukan modal
palsu) -- dicatat di sini sebagai konfirmasi status, BUKAN temuan baru yang perlu
ditambal lagi. Tidak perlu aksi lanjutan kecuali komando mau benar-benar membangun RBAC
granular (proyek besar terpisah).

3.7 "MODUL ..." SEBAGAI LABEL -- SUDAH DIPERBAIKI (BUKAN TEMUAN BARU)
[KODE] page.tsx:422 komentar menyebutkan kata "Modul" dulu pernah tampil ke user, tapi
kode SAAT INI (line 423: `Akses ${gatewayRolePresets[targetRole].name} sedang dimatikan
untuk workspace ini...`) sudah pakai nama portal ("Akses CEO/Finance/Marketing"), bukan
kata "Modul". Grep "Modul " (dengan spasi, bukan variabel/import) di CompanyDataDashboard.tsx,
ExecutiveAIAssistantView.tsx, page.tsx: NOL HASIL teks JSX yang dibaca user. Sudah bersih,
dicatat sebagai KONFIRMASI, bukan temuan baru.

3.8 "PINTASAN KERJA" -- TOMBOL SELALU TAMPIL, TAPI DIAM KALAU MODUL MATI
[KODE] ExecutiveAIAssistantView.tsx:2869 kondisi render blok "Pintasan kerja" cuma cek
`(onOpenWorkspace || onOpenSchedule || onOpenInventory)` -- prop ini SELALU truthy karena
page.tsx SELALU mengirim fungsi (line 1298-1313), bukan `undefined` yang bergantung
enabledModules. Isi cek isModuleEnabled ada DI DALAM fungsi handler
(page.tsx:1300,1305,1310: `if (!isModuleEnabled(...)) return;`), bukan di kondisi
render tombol. Efeknya: kalau workspace mematikan modul inventory, tombol "Buka stok &
pembelian" TETAP tampil normal (tidak abu-abu, tidak disabled), tapi begitu diklik --
TIDAK TERJADI APA-APA. Tidak ada toast, tidak ada pesan error, murni diam. Ini beda kelas
dari temuan 3.6 (yang sudah jujur pakai toast) -- di sini user benar-benar tidak tahu
kenapa tombolnya "tidak jalan".
Perbaikan: page.tsx perlu mengoper `enabledModules` juga ke ExecutiveAIAssistantView
(saat ini TIDAK dioper sama sekali -- lihat page.tsx:1284-1304, prop enabledModules
cuma dikirim ke CompanyDataDashboard di line 1283, tidak ada di panggilan
ExecutiveAIAssistantView) supaya tombol bisa: (a) disembunyikan kalau modul mati, ATAU
(b) tetap tampil tapi tampilkan toast jujur seperti pola 3.6 kalau diklik saat mati.
Opsi (b) lebih konsisten dengan pola yang sudah ada di file yang sama.
Diputuskan sementara: opsi (b) -- lebih kecil diff-nya dan mengikuti pola toast yang
sudah dipakai untuk "Pengaturan admin". Estimasi diff: +1 prop di 2 file (page.tsx
pass enabledModules, ExecutiveAIAssistantView.tsx terima prop) + ganti onClick jadi
cek isModuleEnabled dulu baru showToast kalau mati -- total ~20 baris.

3.9 "AKSI DASHBOARD PERUSAHAAN" -- LABEL MENJANJIKAN AKSI NYATA, MEKANISME CUMA CHAT
[KODE] ExecutiveAIAssistantView.tsx:2107-2138 array `actions` (4 tombol: "Scale Budget
Iklan (+20%)", "Rekrut 1 Staf Video Editor", "Tinjau Piutang Jatuh Tempo", "Laporan
Analisis Mingguan"). Semua onClick (line 2854) HANYA memanggil
`handleSendMessage(act.prompt)` -- yaitu mengirim teks itu sebagai PESAN CHAT biasa,
persis seperti kalau user mengetik sendiri. Grep string spesifik ("Scale budget",
"scaleBudget", "Rekrut") di src/app/api/v1/brain/chat/route.ts: TIDAK ADA handler
deterministik yang benar-benar mengubah data budget/staf di database untuk 2 tombol
pertama -- baik dilempar ke LLM umum (yang tidak bisa menulis ke Prisma) atau butuh
verifikasi lanjut apakah ada execution-engine.ts yang terpicu dari respons LLM (belum
sempat ditelusuri detail dalam batch baca-saja ini, catat sebagai catatan_jujur).
Untuk tombol ke-3 ("Tinjau Piutang Jatuh Tempo") labelnya sudah jujur (cuma "tinjau",
bukan janji aksi). Tombol ke-4 ("Laporan Analisis Mingguan") ada endpoint
/api/v1/brain/weekly-analysis yang genuinely ada (grep folder di atas), kemungkinan
match -- tapi label tombol 1 & 2 ("Scale Budget Iklan +20%", "Rekrut 1 Staf") memakai
kata kerja aktif yang menyiratkan sistem BENERAN mengeksekusi perubahan, padahal secara
struktural cuma kirim kalimat ke AI chat.
Diputuskan sementara: perlemah label 2 tombol pertama supaya tidak menjanjikan eksekusi
nyata -- misal "Scale Budget Iklan (+20%)" -> "Diskusikan scale budget iklan +20%",
"Rekrut 1 Staf Video Editor" -> "Diskusikan rekrutmen staf video editor" -- sampai ada
kepastian execution-engine.ts benar-benar menulis perubahan ke DB untuk 2 aksi ini
(perlu verifikasi terpisah, di luar waktu batch baca-saja ini). Estimasi diff: 2 baris
string label.

3.10 DUPLIKASI ANTAR-PORTAL (kandidat, bukan bug pasti)
[KODE] HRAdvisorPanel.tsx (dashboard CEO, embedded) fetch /api/v1/kerja/tasks +
/api/v1/kerja/attendance (line 110-111) -- endpoint YANG SAMA dipakai KlirWorkspaceView.tsx
(feature-view penuh "Operasional tim", line 187,268) yang dibuka dari tombol terpisah di
AI Assistant. Ini KEMUNGKINAN disengaja (dashboard = ringkasan HR, feature-view = kelola
penuh) -- tapi karena datanya identik dari endpoint yang sama, ada risiko dua tempat
menampilkan angka yang berbeda kalau salah satu diupdate polling-nya lebih jarang dari
yang lain. Tidak cukup bukti untuk menyebut ini "bug" -- dicatat sebagai observasi untuk
komando, bukan item prioritas.

=================================================================================
BAGIAN 4 -- 60 BARIS TERAKHIR CompanyDataDashboard.tsx (keluhan Mecca 9 Sep
"aneh di paling bawah dashboard CEO saat scroll")
=================================================================================

[KODE] Dibaca penuh line 3628-3688 (60 baris terakhir file) DAN dirontgen struktur JSX
sebelumnya untuk tahu mana yang render tanpa syarat vs bergerbang:

- Baris paling akhir (3628-3688) = form input modal "Edit Profil Perusahaan"
  (nama field: Produk, Target Pasar, Deskripsi Usaha, tombol Batal/Simpan). Ini bagian
  DALAM modal yang dimulai line 3511 `{editProfileOpen && (...)}` -- BERGERBANG penuh
  di belakang state `editProfileOpen` (default false, line 303). Modal ini `position:
  fixed, inset:0, zIndex:9999` (line 3512-3514) -- kalau `editProfileOpen` false (kondisi
  awal & mayoritas waktu), blok ini TIDAK RENDER SAMA SEKALI, jadi bukan penyebab
  "sesuatu aneh keliatan pas scroll" karena secara structural tidak ada di DOM flow
  normal (modal fixed-position, bukan bagian scroll layout).
- Elemen TERAKHIR yang render di ALUR SCROLL NORMAL (bukan modal) adalah Section 7
  "Log Instruksi AI Asisten" (line 3438-3437 s/d ~3480) -- collapsed by default
  (`showLog` useState false, line 260), expand cuma kalau diklik. Isi kalau expand:
  kalau `directives.length === 0` (line 3477, dan `directives = liveState?.directives
  || []` line 833, 100% data-driven tanpa dummy) -> zero-state jujur "Belum ada
  instruksi aktif dari CEO / AI Assistant." (line 3480-3483). Tidak ada elemen yang
  render tanpa syarat / rusak / setengah-jadi di titik ini per pembacaan kode.
- Kesimpulan [KODE]: TIDAK DITEMUKAN elemen yang "tampak tidak selesai" di 60 baris
  terakhir maupun di elemen terakhir alur-scroll-normal file ini per audit kode hari
  ini -- sejalan dengan catatan komando "audit Fable: bersih, cek ulang" di context
  pack. TAPI ini murni [KODE], BUKAN [LIVE] -- agent tidak bisa memverifikasi
  bagaimana tampilannya benar-benar di browser (misal: animasi CSS yang aneh,
  overflow visual, scrollbar ganda) karena tidak ada sesi login yang diizinkan.
  Kalau keluhan Mecca soal "aneh di bawah" masih berulang, kemungkinan penyebabnya
  BUKAN di JSX/logic (yang sudah bersih), tapi di lapisan CSS/animasi/rendering
  browser yang tidak kelihatan dari pembacaan kode statis -- perlu [LIVE] check oleh
  agent/sesi yang punya akses browser+login.

=================================================================================
BAGIAN 5 -- DAFTAR HILANGKAN (alasan) DAN LENGKAPI (alasan + sumber data), ADDITIVE-SAFE
=================================================================================

HILANGKAN:
1. Alert 'team' (Beban tim > 75%) + panel detail drill-down + mktMembers/tasksShifted --
   alasan: dead code terbukti 2 lapis (3.3), tidak ada jalan bagi user mana pun untuk
   memicunya, membingungkan pembaca kode & berpotensi menyesatkan future-dev yang
   mengira ini fitur aktif.
2. 3 baris cost breakdown HPP/Ads/Payroll di Section 4 -- alasan: selalu Rp 0/0% untuk
   SEMUA tenant tanpa kecuali (3.4), berisiko dibaca CEO sebagai "memang nol" padahal
   artinya "belum bisa dipecah". Sisakan cuma "Beban operasional" yang riil.

LENGKAPI (additive-safe, tidak mengubah endpoint existing):
1. Gerbang isModuleEnabled untuk Section 4 (finance) & Section 5 (advertising) --
   alasan: konsistensi dengan snapshot card yang sudah bergerbang (3.1). Sumber data:
   sudah ada, `enabledModules` prop sudah dioper ke CompanyDataDashboard.
2. Gerbang isModuleEnabled untuk CorPlanQuickTools (corplan) & HRAdvisorPanel
   (personal) -- alasan: konsisten dengan modul lain yang sudah punya toggle di
   module-guard.ts tapi belum pernah dipakai untuk 2 modul ini (3.2). Sumber data:
   sudah ada, `enabledModules` sudah tersedia sebagai prop di CompanyDataDashboard.
3. Kartu "Prediksi Kas" baru di dashboard berbasis /api/v1/brain/forecast (real data,
   bukan regex chat) -- alasan: doktrin ayah Mecca minta AI "menganalisa yang sudah
   terjadi + memprediksi", engine & endpoint SUDAH ADA (Bagian 2) tapi belum
   disambungkan ke dashboard. Sumber data: prediction-engine.ts + brain/forecast/route.ts,
   sudah dipakai di AI Assistant, tinggal ditarik ke dashboard.
4. Oper `enabledModules` sebagai prop ke ExecutiveAIAssistantView + ganti onClick 3
   "Pintasan kerja" jadi toast jujur kalau modul mati (3.8) -- alasan: konsistensi
   dengan pola toast yang sudah ada di "Pengaturan admin", menghindari dead-click
   tanpa feedback.
5. Perlemah label 2 tombol "Aksi dashboard perusahaan" yang menjanjikan eksekusi
   nyata padahal cuma kirim chat (3.9) -- alasan: kejujuran label, cegah CEO mengira
   sistem sudah otomatis scale budget/rekrut padahal cuma memulai percakapan.

=================================================================================
BAGIAN 6 -- DIPUTUSKAN SEMENTARA OLEH KOMANDO (bukan digantung)
=================================================================================

1. Section 4 & 5 dashboard: diputuskan sementara PALING SEDERHANA -- tambah gerbang
   isModuleEnabled yang konsisten dengan snapshot card, TANPA mengubah isi/desain
   section itu sendiri. (lihat 3.1)
2. Cost breakdown HPP/Ads/Payroll: diputuskan sementara HILANGKAN 3 baris yang
   permanen nol, sisakan "Beban operasional" + 1 baris catatan jujur "kategori biaya
   lain belum bisa dipecah otomatis". (lihat 3.4)
3. Alert 'team' + panel drill-down: diputuskan sementara HILANGKAN total (opsi paling
   sederhana), BUKAN dibangun ulang dengan data /api/v1/kerja/tasks -- karena itu
   pekerjaan baru yang lebih besar dan di luar scope batch additive kecil. (lihat 3.3)
4. Section 5 Marketing & bagian tim Section 6: diputuskan sementara TIDAK diubah jadi
   empty-state dulu di batch build ini (perubahan visual besar), CUKUP digerbang
   (item Bagian 5 LENGKAPI #1) supaya minimal tidak bocor melewati toggle modul --
   perbaikan "isinya jujur kosong" ditunda ke roadmap wiring Campaign/marketing data
   yang lebih besar. (lihat 3.5)
5. Pintasan kerja dead-click: diputuskan sementara pakai pola toast (opsi lebih kecil
   diff-nya), bukan menyembunyikan tombol sepenuhnya. (lihat 3.8)
6. Label "Aksi dashboard perusahaan" (Scale Budget/Rekrut Staf): diputuskan sementara
   perlemah kata kerja di label saja (2 baris), TANPA membangun execution-engine
   sungguhan untuk aksi ini -- itu proyek terpisah yang butuh keputusan skema/scope
   lebih besar (apakah CEO memang boleh AI-execute perubahan budget/HR otomatis).
7. Prop `role` KlirInventoryView.tsx yang tidak dipakai: diputuskan sementara BUKAN
   masalah yang perlu ditambal (arsitektur "gating di server, bukan di client" itu
   valid & konsisten dengan pola keamanan multi-tenant yang dipakai di seluruh
   endpoint lain) -- cukup dicatat sebagai observasi, tidak masuk daftar perbaikan.

=================================================================================
RINGKASAN 10 BARIS
=================================================================================

1. CEO Dashboard punya 7 blok modul tapi cuma 2 (finance, advertising) yang punya
   gerbang isModuleEnabled -- dan bahkan itu pun bocor karena section besarnya
   tidak ikut bergerbang, hanya kartu ringkas kecil di atasnya.
2. corplan & personal (HPP/KUR, HR Advisor) nol gerbang sejak awal, meski keduanya
   fitur real dengan data backend nyata.
3. Kartu "Target & Prediksi AI" di dashboard cuma parser regex atas teks chat CEO
   sendiri, BUKAN analisa data transaksi asli -- sementara engine forecast yang
   genuinely baca data asli (prediction-engine.ts + brain/forecast) sudah ada dan
   sudah dipakai di AI Assistant, tapi belum ditarik ke dashboard.
4. Alert "Beban tim > 75%" adalah dead code terverifikasi 2 lapis -- tidak mungkin
   muncul untuk siapa pun, kapan pun, karena syarat munculnya circular dengan tombol
   yang cuma ada setelah dia muncul.
5. Section Marketing & Pertumbuhan Pelanggan + bagian tim di Section SDM 100%
   hardcode nol permanen -- bukan cuma tidak bergerbang, tapi structurally tidak
   ada fetch API apa pun yang bisa mengisinya sampai hari ini.
6. Cost breakdown (HPP/Ads/Payroll) di section Keuangan selalu Rp 0 meski revenue/
   expense di section yang sama sudah data asli -- berisiko dibaca sebagai "memang
   nol" bukan "belum bisa dipecah".
7. Tombol "Pintasan kerja" (Operasional tim/Reservasi/Stok) selalu tampil aktif
   walau modulnya dimatikan workspace -- klik jadi diam tanpa feedback (beda dari
   pola toast jujur yang sudah dipakai di tombol lain di file yang sama).
8. Label 2 dari 4 tombol "Aksi dashboard perusahaan" (Scale Budget, Rekrut Staf)
   menjanjikan eksekusi otomatis padahal mekanismenya cuma kirim pesan chat biasa.
9. 60 baris terakhir file + elemen terakhir alur scroll normal (Log Instruksi AI
   Asisten) BERSIH per pembacaan kode -- tidak ditemukan elemen setengah-jadi;
   keluhan "aneh di bawah" kemungkinan di lapisan visual/CSS yang butuh cek [LIVE],
   bukan di logic JSX.
10. Semua feature-view penuh yang dibuka dari AI Assistant (Operasional tim,
    Reservasi & Antrean, Stok & Pembelian) sudah wired ke endpoint API nyata dan
    berfungsi -- masalah utama CEO portal ada di layer DASHBOARD OVERVIEW (data
    hardcode + gerbang bocor), bukan di feature-view itu sendiri.

Daftar perbaikan konkret berurutan prioritas + estimasi baris diff:
1. [P0, ~95 baris DIHAPUS] Hilangkan alert 'team' dead code + panel drill-down
   (3.3) -- prioritas tertinggi karena ini kode mati yang membingungkan, murni
   pembersihan tanpa risiko regresi (tidak ada jalur yang bisa mencapainya).
2. [P0, ~12 baris] Gerbang Section 4 (finance) & Section 5 (advertising) supaya
   konsisten dengan snapshot card (3.1) -- risiko keamanan/kepercayaan data kalau
   dibiarkan (modul dimatikan tapi data tetap terlihat).
3. [P1, ~8 baris] Gerbang CorPlanQuickTools (corplan) & HRAdvisorPanel (personal)
   (3.2) -- konsistensi toggle modul.
4. [P1, ~3 baris] Hilangkan 3 baris cost breakdown hardcode-nol, sisakan 1 baris
   catatan jujur (3.4).
5. [P1, ~20 baris] Oper enabledModules ke ExecutiveAIAssistantView + toast jujur
   utk 3 tombol Pintasan kerja (3.8).
6. [P2, ~2 baris] Perlemah label 2 tombol "Aksi dashboard perusahaan" (3.9).
7. [P2, ~40-60 baris, butuh keputusan desain kartu baru] Tarik /api/v1/brain/forecast
   ke dashboard sebagai kartu "Prediksi Kas" terpisah (Bagian 2 usulan) -- prioritas
   lebih rendah karena ini FITUR BARU (bukan perbaikan bug), tapi paling bernilai
   untuk memenuhi doktrin ayah Mecca secara genuine.
8. [P3, roadmap besar lintas modul, 100+ baris] Wiring data marketing/tim nyata
   (Campaign spend, task-load per anggota) untuk Section 5 & bagian tim Section 6
   (3.5) -- butuh keputusan skema data dari agent C + komando, bukan quick patch.

=================================================================================
CATATAN JUJUR
=================================================================================

- Semua temuan di laporan ini tier [KODE] (dibaca langsung dari source, file:line
  disertakan) -- TIDAK ADA verifikasi [LIVE] karena agent ini baca-saja tanpa sesi
  login (sesuai otorisasi batch). Klaim soal "keluhan Mecca 9 Sep di bagian bawah
  dashboard" hanya bisa dijawab dari sisi kode (bersih), bukan dari sisi visual
  render sungguhan di browser.
- Temuan 3.9 (Aksi dashboard perusahaan / Scale Budget / Rekrut Staf) BELUM
  ditelusuri sampai tuntas apakah ada execution-engine.ts yang benar-benar dipanggil
  dari respons LLM untuk mengeksekusi 2 aksi itu secara nyata -- saya cuma sempat
  cek brain/chat/route.ts (tidak ada handler deterministik bernama eksplisit) dan
  melihat class ExecutionEngine ada di execution-engine.ts (169 baris, belum dibaca
  isinya penuh karena keterbatasan waktu batch). Kalau ternyata ADA jalur eksekusi
  nyata yang saya lewatkan, sebagian temuan 3.9 perlu direvisi -- flag ini untuk
  komando verifikasi ulang sebelum eksekusi perbaikan #6 di atas.
- Saya TIDAK membaca isi penuh KlirWorkspaceView.tsx, KlirScheduleView.tsx,
  KlirInventoryView.tsx baris-per-baris (hanya grep endpoint/tab/prop) karena
  konteks pack sudah menandai ketiganya "LIVE-tested 10 Sep" oleh komando/sesi
  lain, dan fokus tugas D eksplisit adalah dashboard+AI Assistant CEO. Kalau
  komando butuh audit dalam untuk ketiga file itu juga, perlu batch terpisah.
- Section 6 "Karyawan, SDM & Beban Tim" (line 3207-3358) tidak saya bedah
  selengkap Section 4/5 karena HRAdvisorPanel (yang jadi isi utamanya) sudah
  terverifikasi pakai data real (kerja/tasks, kerja/attendance) -- saya cuma
  konfirmasi bagian chart t.mkt (grafik atas Section 6, BUKAN HRAdvisorPanel)
  yang memang share masalah sama dengan 3.5 (DEFAULT_TEAM hardcode). Kalau ada
  bagian lain di Section 6 yang butuh audit lebih detail, belum tercakup penuh
  di sini.
- Estimasi baris diff di Bagian 5/6/Ringkasan adalah PERKIRAAN dari membaca
  struktur kode (bukan dari benar-benar menulis patch-nya) -- bisa meleset
  +/- beberapa baris saat implementasi nyata, terutama untuk item yang butuh
  penyesuaian kondisional bersarang (nested ternary/JSX).
