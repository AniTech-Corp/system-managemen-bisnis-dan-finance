AUDIT PORTAL MARKETING -- KLIR
Tanggal: 10 September 2026
Agent: scan-portal-marketing (batch SCAN modul-7, baca-saja, NOL edit kode)
File yang diaudit:
  - src/app/components/MarketingModuleView.tsx (1403 baris, dibaca penuh)
  - src/app/components/MarketingAIAssistantView.tsx (4054 baris, dibaca menyeluruh via grep bertarget + baca blok penuh di titik kritis)
  - src/app/components/settings/MarketingSettingsModal.tsx (dibaca sebagian, tab Target Metrik)
  - Referensi silang: src/app/page.tsx (routing portal, baca-saja), src/lib/ai-brain/proactive-alerts.ts (238 baris, dibaca penuh), src/app/api/v1/marketing/campaigns/route.ts, src/app/api/v1/promo/*, prisma/schema.prisma (model Campaign), src/app/components/CompanyDataDashboard.tsx (pola kartu "Target & prediksi AI" baris 1483-1550, untuk perbandingan)
Metode: baca kode statis + grep bertarget + git log/show untuk pelacakan komit. TIDAK ada sesi login tersedia untuk agent ini -- SEMUA klaim di bawah ini bertier [KODE] (dibaca dari kode) atau [SUMBER] (dokumen), TIDAK ada klaim [LIVE].
Verifikasi repo sebelum mulai: git log --oneline -5 -> HEAD 6b88464 (bersih), git status --short -> nihil (worktree bersih). Commit Fatur 3d2249e (fix marketing-ui) dicek dengan git merge-base --is-ancestor 3d2249e HEAD -> YES, sudah termerge lewat af40d8d, TIDAK ada konflik atau override yang menghapus perbaikannya.

===============================================================================
RINGKASAN 10 BARIS
===============================================================================
1. Scope Marketing di routing (src/app/page.tsx baris 1369-1399) HANYA 2 nav: dashboard + ai-studio, keduanya modul 'advertising' saja -- sudah sesuai arsitektur terkunci 9 Sep (Finance/Marketing = feature relevan, bukan superset CEO). Ini BUKAN bug, ini desain benar.
2. Dashboard Marketing (MarketingModuleView.tsx) TIDAK punya blok AI analisa+prediksi+rekomendasi setara "Target & prediksi AI" milik CEO -- tidak ada satupun rujukan sales-target-engine/forecast/brain di file ini (grep nihil). Kartu "Langkah berikutnya dari AI" yang ada cuma rekomendasi geser-budget antar-kanal, bukan target-kuartal-ke-Desember.
3. Panel proaktif "Perlu perhatian" BELUM dipasang di MarketingAIAssistantView.tsx (grep ProactiveAlertsPanel nihil) -- padahal sumber 'brain' (kesehatan bisnis) di registry proactive-alerts.ts TIDAK dibatasi role apapun (roles kosong), jadi wiring untuk Marketing itu SIAP PAKAI hari ini tanpa kerja backend tambahan.
4. Ditemukan bug nyata: 2 elemen dengan id="daftar-kampanye-iklan" yang sama persis di file yang sama (MarketingModuleView.tsx baris 878 dan 1032) -- akibatnya tombol "Lihat kampanye aktif" (baris 1388, pakai document.getElementById) SELALU scroll ke section funnel (baris 878), bukan ke daftar kampanye (baris 1032) yang dimaksud.
5. Ditemukan field mati: c.creativeType dirender di baris 1079 tapi field ini TIDAK PERNAH diisi di loadRealData() (baris 160-172) dan TIDAK ADA di model Campaign (prisma/schema.prisma baris 530-546) -- selalu tampil kosong di bawah nama kampanye.
6. 3 slider di "Pengaturan Marketing > Target Metrik" (targetRoas, maxCac, budgetBurnAlertPercent) SUDAH jujur diberi label "belum mempengaruhi AI Assistant/kampanye manapun" (fix MKT-02, sudah ada) -- tapi targetRoas SANGAT bisa disambungkan murah ke roasTargetX yang di dashboard masih hardcode 3.0 (MarketingModuleView.tsx baris 233), sekarang dua angka target ROAS itu independen dan bisa beda tanpa disadari user.
7. Tidak ada satupun cara Marketing melihat katalog produk (read-only) dari dalam AI Assistant -- field productName di form copywriting (baris 3906-3908) murni ketik manual, tidak ada dropdown/autocomplete ke GET /api/v1/inventory/products yang sudah ada dan workspace-scoped.
8. "Alat Pertumbuhan" (3 tab: Kalender Konten, Copywriting, Bio-link, dibuka dari sidebar baris 2283) SUDAH menjadi pintasan kerja nyata untuk Marketing -- BUKAN kosong seperti dugaan awal, ini genuinely wired ke /api/v1/promo/calendar, /copywriting, /biolink.
9. TIDAK ditemukan pelanggaran modul-jadi-label ("Modul", "KLIR Management", "Inventory", "Workspace") di teks JSX kedua file utama Marketing (grep nihil) -- konsisten dengan arsitektur ROLE vs MODULE vs FEATURE yang dikunci 9 Sep.
10. Versi Fatur 3d2249e (fix budget Rp1 + zero-state kartu AI) UTUH -- tidak tertimpa oleh perubahan sesudahnya (af40d8d hanya menambah, bukan mengganti, logic yang sama masih ada di baris 232-331 MarketingModuleView.tsx saat ini).

===============================================================================
MATRIKS 7 MODUL x 2 PERMUKAAN -- ROLE MARKETING
===============================================================================
Catatan cara baca: "-" berarti modul itu memang TIDAK digate/disurfacekan untuk role Marketing sama sekali (sesuai arsitektur ROLE superset-terbatas 9 Sep, BUKAN kekurangan).

+----------------+------------------------------------------+------------------------------------------+
| MODUL          | DASHBOARD (MarketingModuleView.tsx)       | AI ASSISTANT (MarketingAIAssistantView.tsx)|
+----------------+------------------------------------------+------------------------------------------+
| corplan        | -                                          | -                                          |
| personal       | -                                          | -                                          |
| finance        | -                                          | -                                          |
| advertising    | SELURUH isi file (hero ROAS, promo/voucher,| SELURUH isi file: chat, Alat Pertumbuhan   |
|                | audiens, funnel, kanal, daftar kampanye,   | (kalender/copywriting/biolink), Pengaturan |
|                | laporan, budget+rekomendasi AI)            | Marketing (4 tab), preset media (poster/   |
|                | Sumber data: /api/v1/promo/coupons (GET),  | video/copy), CAP_GROUPS (kemampuan umum),  |
|                | /api/v1/marketing/campaigns (GET/PATCH/    | tidak ada blok analisa+prediksi kuartal    |
|                | DELETE). Zero-state jujur: SEMUA angka      | Sumber data: brain/chat route (umum),      |
|                | nol/kosong kalau campaigns=[] (baris        | /api/v1/promo/*, WorkspaceDataHub          |
|                | 52-119, 265-298 -- sudah diverifikasi 6-7   | Zero-state: "Fitur ini belum tersedia"     |
|                | Sep, komentar KENAPA jelas per titik)        | untuk command belum siap (baris 1110)       |
| workspace      | -                                           | Pusat Data (WorkspaceDataHub, baris 2345-  |
|                |                                             | 2352) -- genuinely fungsional (upload/lihat/|
|                |                                             | hapus file server-side, item roadmap 4.1)  |
| schedule       | -                                           | -                                          |
| inventory      | -                                           | TIDAK ADA akses baca sama sekali (lihat    |
|                |                                             | temuan #7 di atas) -- productName manual   |
+----------------+------------------------------------------+------------------------------------------+

Kesimpulan matriks: Marketing HANYA punya 1 modul aktif (advertising) plus 1 modul pinjaman (workspace, lewat Pusat Data). Ini SESUAI kontrak arsitektur -- tidak ada modul yang "harus ada tapi hilang" secara struktural. Masalah yang ada semuanya di DALAM modul advertising itu sendiri (kualitas eksekusi, bukan cakupan modul).

===============================================================================
TEMUAN DETAIL -- DASHBOARD (MarketingModuleView.tsx)
===============================================================================

D1. [KODE] Bug id duplikat -- MarketingModuleView.tsx baris 878 DAN baris 1032 sama-sama
    memakai `id="daftar-kampanye-iklan"` untuk div pembungkus section yang BERBEDA:
      - Baris 878: section 4 "PERJALANAN DARI IKLAN SAMPAI CLOSING (FUNNEL)"
      - Baris 1032: section 6 "DAFTAR KAMPANYE IKLAN BERJALAN"
    Tombol "Lihat kampanye aktif" di kartu AI (baris 1385-1394) memanggil
    `document.getElementById('daftar-kampanye-iklan')` lalu scrollIntoView. Karena
    getElementById mengambil elemen PERTAMA yang cocok di DOM, tombol ini SELALU
    membawa user ke section funnel (baris 878), bukan ke daftar kampanye yang
    namanya persis disebut di label tombol. Sama di kondisi "Belum ada rekomendasi"
    (kartu AI zero-state) DAN kondisi ada rekomendasi -- keduanya pakai id yang sama.
    Dampak: navigasi salah arah, kecil tapi nyata dan mudah diperbaiki (ganti salah
    satu id, mis. section 6 jadi "daftar-kampanye-iklan-tabel").

D2. [KODE] Field mati creativeType -- MarketingModuleView.tsx baris 1079 merender
    `{c.creativeType}` di bawah nama tiap baris kampanye. Field ini:
      - TIDAK ada di objek yang di-set loadRealData() (baris 160-172, hanya
        id/name/platform/dailyBudget/roas/leads/status)
      - TIDAK ada di model Campaign (prisma/schema.prisma baris 530-546: id,
        workspaceId, name, platform, dailyBudget, roas, leads, status,
        createdAt, updatedAt -- tidak ada creativeType)
    Akibat: baris itu selalu render undefined -> React mencetak string kosong,
    jadi ada baris kosong di bawah nama kampanye di tabel. Tidak crash, tapi
    sisa kode dari desain lama yang tidak pernah dituntaskan/dihapus.

D3. [KODE] roasTargetX hardcode vs setting yang sudah ada -- baris 233:
    `const roasTargetX = 3.0;` dipakai untuk semua badge "di bawah target",
    warna bar ROAS, dan garis target di chart/daftar kampanye. Sementara itu
    MarketingSettingsModal.tsx punya slider "Target Blended ROAS Minimum"
    (targetRoas, default 3.5, range 1.5-6.0) yang TERSIMPAN di
    localStorage["klir_settings_mkt_"+workspaceId] tapi TIDAK PERNAH dibaca
    balik oleh dashboard ini. User bisa mengatur target 4.0x di Pengaturan,
    tapi dashboard tetap menilai "di bawah target" pakai 3.0x -- dua sumber
    kebenaran yang diam-diam berbeda.

D4. [KODE] Audiens demografi -- audienceData (baris 471-475) memang SENGAJA
    dikosongkan total (platform/usia/perangkat semua array kosong), sehingga
    zero-state "Data demografi audiens belum tersedia" (baris 841-848) SELALU
    tampil -- ini JUJUR dan benar (sesuai catatan KENAPA baris 463-469: belum
    ada integrasi Ads Manager). TAPI audienceNote dan audienceSub (baris
    476-485) masih menyimpan teks contoh dengan angka palsu ("65% jangkauan",
    "41% dari total audiens", "61% perempuan") yang secara teknis TIDAK PERNAH
    dirender (kondisi baris 841 selalu true selama audienceData kosong).
    Ini dead code yang aman untuk SEKARANG (tidak bocor ke user), tapi berisiko:
    kalau nanti audienceData salah satu tab diisi data asli tanpa menghapus
    audienceNote/audienceSub, angka contoh ini bisa ikut tampil sebagai
    seolah-olah data nyata. Rekomendasi: hapus 3 record itu sekarang atau beri
    komentar peringatan eksplisit "JANGAN dipakai sampai audienceData terisi".

D5. [KODE] "Laporan marketing" (section 7, baris 1159-1243) -- label "Segera
    hadir" (baris 1168) SUDAH jujur (comment baris 1165-1167 menjelaskan
    `reports` adalah const [] literal, tidak ada generator/cron/endpoint).
    Tombol Lihat/Unduh per baris tidak pernah dieksekusi karena reports selalu
    kosong -- bukan bug, tapi juga bukan fitur, murni kerangka kosong yang
    jujur menyebut dirinya belum ada.

D6. [KODE] Duplikasi teks/warna platform -- CAMPAIGN_PLATFORM_LABEL (baris
    124-129) memetakan enum backend (META_ADS/TIKTOK_ADS/GOOGLE_ADS/LAINNYA)
    ke label tampilan ('Meta Ads' dkk), dan channelColors/platformBadgeStyle
    (baris 38-42, 301-305) mencocokkan STRING label itu secara harfiah. Ini
    BEKERJA sekarang, tapi rapuh: kalau CAMPAIGN_PLATFORM_LABEL diubah (typo
    atau rename), 2 tempat lain harus ikut diubah manual, tidak ada satu
    sumber kebenaran (constant map) untuk warna+label per enum. Bukan bug
    aktif, catatan tech-debt kecil.

===============================================================================
TEMUAN DETAIL -- AI ASSISTANT (MarketingAIAssistantView.tsx)
===============================================================================

A1. [KODE] Panel proaktif TIDAK dipasang -- grep "ProactiveAlertsPanel" di
    MarketingAIAssistantView.tsx: NIHIL. Bandingkan FinanceAIAssistantView.tsx
    baris 28 (import) dan baris 2659 (pemakaian):
      <ProactiveAlertsPanel role="FINANCE" workspaceId={workspaceId || ''}
        onOpenInventory={onOpenInventory} onAskAI={(p) => setInputMessage(p)} />
    Dicek registry sumbernya (src/lib/ai-brain/proactive-alerts.ts baris
    206-222, PROACTIVE_SOURCES):
      - source 'stok' (baris 207-213): roles: ['CEO','FINANCE'] -- SENGAJA
        tidak untuk Marketing (benar, stok bukan urusan marketing).
      - source 'brain' (baris 214-220, "Kesehatan bisnis"): TIDAK PUNYA
        properti `roles` sama sekali -- artinya SEMUA role termasuk MARKETING
        otomatis lolos filter collectProactiveAlerts (baris 224, cek
        `!s.roles || s.roles.includes(ctx.role)`).
    Kesimpulan: wiring untuk Marketing SIAP PAKAI, tinggal:
      import ProactiveAlertsPanel from './chat/ProactiveAlertsPanel';
      <ProactiveAlertsPanel role="MARKETING" workspaceId={workspaceId || ''}
        onAskAI={(p) => setInputMessage(p)} />
    ditaruh sebelum blok "EMPTY HERO HOME VIEW" (baris 2676-2678, cermin
    persis lokasi Finance baris 2657-2661). State `inputMessage`/`setInputMessage`
    SUDAH ada di file ini (baris 738), tidak perlu state baru. Estimasi diff:
    2 baris tambah (import + render). Ini yang paling murah dari seluruh temuan.

A2. [KODE] Tidak ada katalog produk read-only -- form Copywriting (growthTab
    'copywriting', baris 3898-3941) field productName (baris 3903-3908) murni
    <input type="text"> manual, tidak ada opsi pilih dari daftar produk yang
    sudah tercatat di modul Inventory (GET /api/v1/inventory/products, dipakai
    KlirInventoryView.tsx milik CEO/Finance). Sama untuk komponen lain yang
    butuh nama/deskripsi produk (preset MEDIA_PRESETS baris 171-222, form
    Kalender Konten mainCampaign baris 3862-3868) -- semua manual retype.
    Kalau UMKM punya 20 produk tercatat di Inventory, Marketing harus mengetik
    ulang nama+deskripsi tiap kali bikin materi promosi, padahal datanya
    sudah ada di backend yang sama (workspace yang sama).

A3. [KODE] "Semua kemampuan AI" (CAP_GROUPS, baris 246-300) -- 5 kategori,
    17 item, SEMUA punya prompt siap-kirim yang genuinely terisi (bukan
    placeholder kosong), sudah difilter untuk role marketing (comment baris
    246-247 menyebut "porting 1:1 dari CAPABILITIES()/CAP_CATS() mockup v6,
    difilter roles.includes('marketing')"). Ini SUDAH menjadi pintasan kerja
    yang layak -- bukan gap.

A4. [KODE] "Alat Pertumbuhan" (baris 3788-3990-an, 3 tab: Kalender Konten,
    Copywriting, Bio-link) -- SEMUA 3 tab genuinely memanggil endpoint nyata
    (/api/v1/promo/calendar, /copywriting, /biolink) dan tidak ada indikasi
    placeholder/toast-only. Tab Copywriting dan Kalender memotong kredit
    (20 dan 30 kredit, disclosure jujur di UI baris 3900-3901). Tab Bio-link
    gratis dan jujur disebut begitu (baris 3973-3974). Ini KONTRA dugaan awal
    "Marketing AI nol pintasan kerja" di context pack -- pintasan kerja ADA
    dan genuinely wired, temuan sebenarnya adalah A1 (panel proaktif) dan A2
    (katalog produk), bukan ketiadaan total pintasan.

A5. [KODE] Tombol "Kelola plugin" -> "Integrasi Meta Ads & TikTok Pixel"
    (baris 2373-2394-an) sudah diperbaiki sebelumnya (comment baris 2358-2379
    mendokumentasikan gap kemampuan-004 dan fix-nya: sekarang initialTab='channels'
    membawa user LANGSUNG ke tab "Kanal Iklan" di MarketingSettingsModal,
    bukan landing salah di tab pertama seperti versi lama). Diverifikasi di
    MarketingSettingsModal.tsx: prop initialTab (baris 15, 23, 25, 29-30)
    sudah ada dan dipakai konsisten. TIDAK ada gap lagi di titik ini -- fix
    lama SUDAH benar dan bertahan sampai HEAD sekarang.

A6. [KODE] "Fitur ini belum tersedia" (baris 1110) -- toast generik untuk
    slash-command yang belum diimplementasikan di command.payload.reason.
    Ini pola fallback yang jujur (bukan silent fail), tapi tidak ada daftar
    command yang trigger ini di dalam file -- perlu baca slash-commands.ts
    (di luar file tugas agent ini) untuk tahu persis command mana yang masih
    kosong. Dicatat sebagai butuh_dari_tim di bawah.

A7. [KODE] MediaStudio (poster/video/gambar, baris 5, 29) dan preset
    MARKETING_PRESETS (baris 171-222) -- 5 preset produksi (poster
    glassmorphism, video TikTok, copy UGC, audit ROAS, voucher) SEMUA
    mengarah ke prompt teks yang lengkap, bukan placeholder. Generasi
    media ASLI (realImage/realFile di interface ChatMessage baris 130-133)
    ada infrastrukturnya. TIDAK bisa diverifikasi hasil akhirnya genuinely
    memanggil provider gambar/video sungguhan tanpa sesi login -- ini
    [HIPOTESIS] berdasar baca kode (apiRequest/pollVideoJob dari
    marketing-media/client diimpor dan dipakai, baris 29), bukan [LIVE].

===============================================================================
BLOK AI ANALISA + PREDIKSI + REKOMENDASI (DOKTRIN AYAH MECCA)
===============================================================================
Status: TIDAK ADA di dashboard Marketing.

Yang ADA sekarang (kartu "Langkah berikutnya dari AI", MarketingModuleView.tsx
baris 1317-1399):
  - Analisa: ya, kanal mana underperform vs kanal terbaik (bestChannel/
    worstChannel, baris 317-318, dihitung dari chanCompare riil).
  - Rekomendasi: ya, geser budget spesifik (estimatedShiftGain, baris 327-331)
    dengan tombol Terapkan yang genuinely PATCH ke /api/v1/marketing/campaigns
    (handleApplyBudgetShift, baris 417-459, sudah persist ke DB, toast jujur
    menyebut belum mengirim ke platform iklan asli).
  - Prediksi jangka panjang (sampai Desember, ala kartu CEO "Target & prediksi
    AI"): TIDAK ADA. Tidak ada quarterlyTarget/realizedToDate/projectedGap
    untuk marketing di mana pun dalam file ini atau di sales-target-engine.ts
    (engine itu murni untuk target PENJUALAN tahunan/kuartalan, dipakai CEO,
    bukan untuk ROAS/leads/belanja-iklan).

Usulan konkret (diputuskan sementara: opsi paling sederhana, tinggal dikoreksi
komando kalau mau lebih ambisius):
  Tambah kartu "Target & prediksi ROAS" di dashboard Marketing, pola PERSIS
  sama dengan kartu CEO (CompanyDataDashboard.tsx baris 1514-1552):
    - Baca `liveState.marketingTarget` (field BARU, sejenis salesTarget tapi
      untuk ROAS/leads/belanja-iklan) dari klir_live_company_state, ditulis
      oleh AI Assistant saat user memberi target lewat chat (pola sama
      dengan detectSalesTargetIntent/parseSalesTargetInput di
      sales-target-engine.ts, baris 47-60 -- perlu fungsi paralel baru,
      misal detectMarketingTargetIntent, untuk parsing "target ROAS 4x
      kuartal ini" / "target 500 leads bulan ini").
    - Kartu menampilkan: Realisasi ROAS bulan berjalan (sudah ada:
      roasNumeric), Target yang di-set user (bukan hardcode 3.0 -- lihat
      temuan D3), Proyeksi sampai akhir kuartal/tahun berdasar tren belanja
      dailyCap saat ini, tombol "Hitung di AI" yang navigasi ke ai-studio
      (pola identik tombol CEO baris 1552-1559, `onNavChange('ai-assistant')`).
  Ini ADDITIVE (field baru di localStorage state, tidak menyentuh field lama),
  BUKAN pekerjaan batch ini (baca-saja) -- ditulis di sini supaya batch
  BANGUN tinggal eksekusi sesuai kontrak.
  Sumber data yang SUDAH ADA dan bisa dipinjam sebagai fallback kalau engine
  baru belum siap: /api/v1/brain/forecast (proyeksi kas, tidak spesifik
  marketing tapi arahnya sama) dan /api/v1/brain/recommendations (general
  business health + forecast 6 bulan) -- keduanya TIDAK di-role-gate (dicek
  authenticateTenantRequest saja, tidak ada pengecekan role di dalam route
  handler-nya), jadi teknis bisa dipanggil dari Marketing tanpa perubahan
  backend, tapi isinya business-wide bukan ROAS-spesifik.

===============================================================================
VERSI FATUR 3d2249e -- STATUS
===============================================================================
[KODE] git show --stat 3d2249e -> hanya menyentuh MarketingModuleView.tsx
(290 baris berubah: 173 tambah, 117 hapus). git merge-base --is-ancestor
3d2249e HEAD -> YES. git log --oneline --follow menunjukkan af40d8d (komit
setelahnya, judul menyebut eksplisit "port manual commit Fatur ... 3d2249e")
adalah lapisan TAMBAHAN di atasnya, bukan revert/override. Diverifikasi
langsung: logic "eliminate Rp 1 budget calculation bug" (guard `|| 1` pada
pembagian revenue/spend, baris 310) dan "zero-state jujur" (komentar KENAPA
baris 78-101, 243-298, 320-331) MASIH ada persis di kode saat ini. KESIMPULAN:
tidak tersentuh/tertimpa, aman.

===============================================================================
HILANGKAN (alasan)
===============================================================================
H1. audienceNote + audienceSub literal (MarketingModuleView.tsx baris
    476-485) -- dead code berisi angka contoh palsu yang berisiko bocor kalau
    audienceData diisi sebagian tanpa disadari penghapusannya perlu ikut.
    Alasan hilangkan: tidak pernah dirender selama audienceData kosong (baris
    841), jadi menyimpannya tidak ada gunanya, hanya risiko laten.
H2. Rendering `{c.creativeType}` (MarketingModuleView.tsx baris 1079) --
    field yang tidak pernah ada isinya (temuan D2). Alasan: baris kosong
    tanpa fungsi, sisa desain lama.

===============================================================================
LENGKAPI (alasan + sumber data, ADDITIVE-SAFE, urut prioritas + estimasi diff)
===============================================================================
L1. [PRIORITAS TERTINGGI, termurah] Pasang ProactiveAlertsPanel role=MARKETING
    di MarketingAIAssistantView.tsx (temuan A1). Sumber: proactive-alerts.ts
    source 'brain' (baris 214-220) sudah role-agnostic, TIDAK perlu ubah
    backend. Estimasi diff: +2 baris (1 import + 1 render), risiko nyaris
    nol (komponen sudah dipakai identik di 2 file lain).

L2. Sambungkan roasTargetX ke targetRoas dari localStorage settings (temuan
    D3). Sumber: localStorage["klir_settings_mkt_"+workspaceId] (sudah
    ditulis MarketingSettingsModal.tsx baris 84-101, tinggal dibaca).
    Estimasi diff: +8-12 baris (1 useEffect baca localStorage + fallback 3.0
    kalau belum pernah diset, sama pola syncWithLocalStorage yang sudah ada
    baris 72-101). Risiko rendah, HANYA baca (tidak menulis balik).

L3. Katalog produk read-only untuk form Copywriting (temuan A2). Sumber:
    GET /api/v1/inventory/products (sudah ada, workspace-scoped, dipakai
    KlirInventoryView.tsx). Usulan: dropdown/autocomplete opsional di atas
    field productName manual (baris 3903-3908) yang mengisi otomatis
    productName+productDesc dari produk terpilih, TAPI field manual tetap
    ada untuk UMKM yang belum sempat input produk ke Inventory. Estimasi
    diff: +40-60 baris (fetch daftar produk saat modal Alat Pertumbuhan
    dibuka, render <select> atau combobox sederhana, isi state copyForm
    saat dipilih). Risiko rendah (GET saja, tidak menulis ke Product).

L4. Blok "Target & prediksi ROAS" di dashboard (lihat bagian doktrin ayah
    Mecca di atas untuk detail lengkap). Estimasi diff: lebih besar,
    perkiraan +150-220 baris gabungan (fungsi parse intent baru di lib
    ai-brain, field baru di live-company-state, kartu UI di
    MarketingModuleView.tsx pola CompanyDataDashboard baris 1514-1552).
    Bukan pekerjaan batch SCAN ini -- diserahkan ke kontrak BANGUN.

L5. Perbaiki id duplikat (temuan D1) -- ganti id salah satu section, mis.
    section 6 (baris 1032) jadi id="tabel-kampanye-iklan", dan perbarui
    scrollIntoView (baris 1388) untuk menunjuk id baru itu (bukan section
    funnel). Estimasi diff: 2 baris ubah.

L6. Hapus 2 dead-code kecil (H1, H2 di atas). Estimasi diff: -12 baris
    (audienceNote+audienceSub) dan -1 baris (creativeType).

===============================================================================
DIPUTUSKAN SEMENTARA (bukan digantung ke Mecca/Fatur)
===============================================================================
- Nama field baru untuk target marketing: "marketingTarget" di
  klir_live_company_state (paralel dengan "salesTarget" yang sudah ada
  untuk CEO) -- dipilih karena konsisten pola penamaan yang sudah dipakai,
  tinggal dikoreksi kalau komando mau nama lain.
- Cakupan target marketing yang diusulkan: ROAS + jumlah leads (2 metrik
  yang sudah nyata dihitung di dashboard ini: roasNumeric, totalLeads),
  BUKAN omset/budget mentah -- karena ROAS dan leads adalah 2 angka yang
  paling sering dikutip di kartu "Langkah berikutnya dari AI" yang sudah
  ada, jadi paling gampang disambung ke pola yang sudah berjalan.
- Untuk katalog produk read-only (L3): dipilih pendekatan opsional
  (dropdown DI ATAS field manual, bukan menggantikan field manual) supaya
  UMKM yang belum pernah pakai modul Inventory sama sekali tidak terhambat
  -- pilihan paling sederhana yang tidak menambah friksi ke alur yang sudah
  jalan.

===============================================================================
BUTUH DARI TIM
===============================================================================
- Ke agent scan-kode-modul7 (B): mohon konfirmasi apakah ada fungsi paralel
  ke sales-target-engine.ts yang SUDAH ada untuk marketing/ROAS (agent ini
  hanya grep di 2 file Marketing, tidak menyisir seluruh src/lib/ai-brain/
  secara ekshaustif) -- kalau sudah ada, usulan L4 di atas cukup wiring UI
  saja, bukan bikin engine baru.
- Ke komando: file src/lib/slash-commands.ts (di luar cakupan file tugas
  agent ini) perlu dicek untuk tahu persis command apa saja yang masih
  memicu toast "Fitur ini belum tersedia" (temuan A6) -- agent ini hanya
  menemukan titik pemicunya (baris 1110), bukan daftar lengkap command-nya.

===============================================================================
CATATAN JUJUR
===============================================================================
- Agent ini TIDAK punya sesi login dan TIDAK membuka localhost:3000 --
  SEMUA klaim di atas murni [KODE] (baca statis) atau [SUMBER], NOL klaim
  [LIVE]. Kemungkinan ada perilaku runtime (race condition, error jaringan,
  state React yang tidak sinkron) yang tidak kelihatan dari baca kode saja.
- MarketingAIAssistantView.tsx (4054 baris) TIDAK dibaca baris-per-baris
  100% dari awal sampai akhir -- dibaca penuh untuk 400 baris pertama, lalu
  ditelusuri dengan grep bertarget (Modul/Segera hadir/proactive/productName/
  TODO/growthTab dkk) plus baca blok penuh di titik-titik yang relevan
  (copyForm 3850-3990, sidebar 2280-2420). Kemungkinan ada 1-2 detail kecil
  di luar 3600 baris yang tidak digrep secara eksplisit yang terlewat --
  tapi seluruh pola arsitektural besar (proactive panel, growth tools,
  capabilities, settings routing) sudah tercakup pencariannya.
- Estimasi baris diff di bagian LENGKAPI adalah PERKIRAAN dari membaca pola
  kode yang mirip di file lain (Finance/CEO), bukan hasil menulis draft
  kode sungguhan -- bisa meleset 20-30% saat benar-benar dieksekusi batch
  BANGUN.
- Tidak ada waktu untuk membaca MarketingSettingsModal.tsx secara penuh
  (hanya tab "Target Metrik" / metrics yang dibaca detail) -- 3 tab lain
  (copy, channels, promos) hanya diverifikasi lewat grep nama tab dan satu
  potongan komentar (initialTab fix), tidak dibaca isi lengkapnya.
- Asumsi yang dipakai: "pintasan kerja" dalam kontrak diartikan sebagai
  jalan pintas dari UI ke tindakan konkret (bukan chat manual) -- dengan
  definisi itu, Alat Pertumbuhan (A4) dan CAP_GROUPS (A3) SUDAH memenuhi,
  jadi laporan ini TIDAK menandai "nol pintasan kerja" seperti dugaan awal
  context pack, karena bukti kode menunjukkan sebaliknya.
- Risiko yang saya lihat kalau L1 (panel proaktif) dieksekusi tanpa
  pengecekan ulang: source 'brain' memakai AlertPriorityEngine yang sama
  untuk semua role -- perlu dipastikan pesan alert-nya (title/message) tidak
  memakai istilah yang cuma relevan buat CEO/Finance (mis. istilah kas/
  piutang) saat tampil di layar Marketing, supaya tidak membingungkan. Ini
  TIDAK saya verifikasi isi pesannya (di luar 2 file tugas), murni observasi
  dari baca kontrak fungsi alertsFromBrainAlerts (baris 160-172
  proactive-alerts.ts) yang generik untuk semua role.
