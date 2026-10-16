# Audit Portal Finance -- 7 Modul x 2 Permukaan (Dashboard + AI Assistant)

Agent: scan-portal-finance (batch SCAN gabungan, 10 Sep 2026)
Baca-saja. Nol edit kode. File yang dibaca penuh:
- src/app/components/FinanceModuleView.tsx (3522 baris)
- src/app/components/FinanceAIAssistantView.tsx (3853 baris)
- Pendukung yang dibaca sebagian untuk verifikasi silang: src/lib/ai-brain/proactive-alerts.ts,
  src/app/components/chat/ProactiveAlertsPanel.tsx, src/app/api/v1/brain/{alerts,forecast,simulate,
  recommendations}/route.ts, src/app/api/v1/kas/{runway-forecast,bank-reconciliation,piutang-reminder}/
  route.ts, src/lib/ai-brain/sales-target-engine.ts, prisma/schema.prisma (baris model saja).

HEAD repo saat audit: 6b88464 (worktree bersih, dicek `git log --oneline -5` + `git status --short`
sebelum baca apa pun -- lihat perintah_dijalankan di JSON hasil).

Catatan gaya: file Finance ini termasuk yang PALING rapi di codebase soal disiplin
"jangan karang data" -- hampir tiap keputusan disain zero-state punya komentar tertulis
kenapa. Temuan di bawah bukan berarti file ini buruk; ini exhaustive per instruksi tugas,
termasuk hal kecil.

---

## 1. MATRIKS 7 MODUL x 2 PERMUKAAN

Catatan: hanya 1 dari 7 modul (finance) yang relevan langsung untuk portal ini sebagai
"fitur bernama" -- FinanceModuleView.tsx dan FinanceAIAssistantView.tsx TIDAK me-render
modul lain (corplan/personal/advertising/workspace/schedule/inventory) sebagai section
sendiri. Jadi matriksnya berbentuk: 1 baris finance (detail penuh) + 6 baris modul lain
(TIDAK ADA, sesuai arsitektur -- modul lain hidup di halaman/komponen lain, bukan bocor
ke sini).

| Modul | Dashboard (FinanceModuleView.tsx) | AI Assistant (FinanceAIAssistantView.tsx) |
|---|---|---|
| finance | ADA -- 4 accordion: Kas & Arus Kas (5 widget), Pajak & Kepatuhan (2 widget), Piutang & Invoice (5 widget), Analisis Lanjutan (3 widget). Semua baca endpoint /api/v1/kas/* nyata. [KODE] | ADA -- chat + 22 capability cards (filter role=finance) + galeri "Mulai dari tugas nyata" (9 kartu, 3 kategori) + panel proaktif + forecast + simulasi. [KODE] |
| corplan | TIDAK ADA di file ini (sesuai arsitektur -- corplan = modul terpisah, bukan bagian Finance) [KODE] | TIDAK ADA [KODE] |
| personal | TIDAK ADA [KODE] | TIDAK ADA [KODE] |
| advertising | TIDAK ADA -- tidak ada satu pun teks/komponen Marketing/iklan di 2 file ini [KODE] | TIDAK ADA [KODE] |
| workspace | TIDAK ADA komponen KlirWorkspaceView yang di-render di sini; hanya field upload dokumen composer AI (beda sistem, lihat baris 1062/1105) [KODE] | Upload dokumen (extract-text, workspace-files) ADA sebagai fitur lampiran chat, bukan tab Workspace penuh [KODE] |
| schedule | TIDAK ADA | TIDAK ADA |
| inventory | TIDAK ADA komponen inventaris penuh, TAPI dibaca sebagai SUMBER data proaktif (lihat 1.4) [KODE] | Sama -- dibaca lewat ProactiveAlertsPanel source 'stok', bukan tab sendiri [KODE] |

Kesimpulan baris ini: TIDAK ADA pelanggaran "modul jadi label" di portal Finance -- modul
lain memang sengaja tidak muncul di sini, konsisten dengan arsitektur ROLE vs MODULE vs
FEATURE yang dikunci 9 Sep. Grep label terlarang ("Modul ", "KLIR Management", "Inventory"
sebagai judul UI, "Workspace" sebagai label fitur) di kedua file = 0 hit. [KODE, verifikasi:
`grep -n "Modul \|KLIR Management" FinanceModuleView.tsx FinanceAIAssistantView.tsx` -> kosong]

### 1.1 Rincian isi accordion Dashboard Finance (fitur bernama + file:line)

| Fitur (label persis) | file:line | Sumber data | Zero-state jujur? |
|---|---|---|---|
| Saldo kas tersedia + Runway kas | FinanceModuleView.tsx:1600-1615 | /api/v1/kas/transactions (summary.cumulativeCashBalance), runway dihitung client dari netBurn30d | YA -- "Runway kas belum bisa dihitung" kalau netBurn30d <= 0 (baris 359-360), bukan dipatok 0 [KODE] |
| Pemasukan 30 hari + badge MoM | :1626-1652 | /api/v1/kas/transactions (summary.totalIncome, summary.mom.income) | YA -- badge netral "Belum ada data" kalau totalIncome=0 (baris 1573-1576) [KODE] |
| Pengeluaran 30 hari + badge MoM | :1656-1682 | sda (summary.totalExpense) | YA, sama polanya [KODE] |
| Histori kas/pemasukan/pengeluaran mingguan | :1624, :1662, :1700 | TIDAK ADA sumber -- sengaja ditampilkan sebagai empty state | YA -- "Histori ... belum tersedia" + alasan (baris 1367-1370, komentar eksplisit: KLIR belum punya histori mingguan authoritative, sengaja tidak disimulasikan) [KODE] |
| Kategori pengeluaran (donut) | :1237-1256 (logic), render ~1712-1783 | Dihitung dari transactions (expense breakdown per kategori) | Perlu breakdown asli, tidak dicek eksplisit zero-state teks tapi array kosong = donut kosong (bukan fabrikasi) [KODE] |
| Alur uang bulan ini (3 tab: Komposisi/Rincian/Tren 6 Bulan) | :1779-1975 | Komposisi & Rincian: dari transaksi kas nyata, dgn zero-state "Belum ada omset..." (baris 1826, 1874) | Komposisi/Rincian: YA. Tren 6 Bulan: TIDAK -- lihat temuan #1 di bagian HILANGKAN/LENGKAPI, bulan Apr-Agu di-hardcode 0 tanpa keterangan, bukan "data belum ada" |
| Kas & kalkulator (Kas masuk/keluar/HPP/Harga jual, 4 tab) | :1988-2231 | Form input manual -> POST /api/v1/kas/transactions (baris 461) | N/A (form input, bukan tampilan data) [KODE] |
| Riwayat transaksi terkini | :2239-2320-an | /api/v1/kas/transactions (array transactions) | Render kosong kalau array kosong (tidak dicek pesan khusus, tapi tidak fabrikasi) [KODE] |
| Estimasi pajak bulan ini | :2347-2459 | POST /api/v1/kas/tax-calculator, real-time dari omset transaksi asli (bukan hitung client flat, lihat komentar FIX FIN-05 baris 308-316) | YA -- taxCalcFailed state kalau gagal [KODE] |
| Pengingat jatuh tempo pajak | :2460-2520 | Dihitung dari tanggal asli (pphDueDate + math kalender), 3 kejadian mendatang PPh Final UMKM saja (satu-satunya jenis yang diketahui pasti berlaku bulanan) | YA -- comment eksplisit "tidak mengarang jenis lain" (baris 1385-1391) [KODE] |
| Piutang per rentang umur | :2532-2580 | invoices (status != PAID), agingBuckets dihitung dari arDaysPastDueList | YA, tapi DUPLIKAT dgn widget "Piutang klien" tab Umur (lihat #2 di bawah) [KODE] |
| Invoice terbaru (5 teratas) | :2592-2624 | invoices.slice(0,5) = recentInvoicesList | Tidak ada pesan zero-state eksplisit, tapi tidak fabrikasi [KODE] |
| Invoice & piutang berjalan (tabel penuh + form Buat Invoice Baru) | :2643-2765-an | invoices (semua status) + POST /api/v1/kas/invoices (handleCreateInvoice baris 664) | N/A [KODE] |
| Piutang klien (tab Umur/Per faktur) | :2878-3000 | Sama persis arInvoicesList/agingBuckets/arTotalAmount dgn 2 widget di atas | YA, tapi DUPLIKAT (lihat #2) [KODE] |
| Kewajiban terjadwal (14/30 hari) + form tambah | :3004-3157 | /api/v1/kas/obligations (model ScheduledObligation), POST utk tambah (baris 553), DELETE (baris 600) | YA -- "Belum ada kewajiban terjadwal tercatat..." (baris 3095), comment eksplisit genuinely fetch bukan lagi fitur belum tersambung [KODE] |
| Margin health banner | :3168-3216 | summary.grossMargin (dari data transaksi nyata) vs MARGIN_SAFE_THRESHOLD (benchmark tetap 32%, bukan data eksternal) | YA -- "Margin bersih menunggu data transaksi" kalau hasMarginData false [KODE] |
| Unit economics CAC & LTV | :3223-3320-an | TIDAK ADA sumber data ad-spend/pelanggan-baru di KLIR sama sekali | YA -- SEMUA angka "Belum tercatat"/"-", rumus & penjelasan konsep generik ditampilkan sebagai edukasi, bukan angka bisnis dikarang (baris 1407-1477, komentar eksplisit) [KODE] |
| Hasil simulasi rencana keuangan (3 skenario) | :3316-3400-an | summary.totalIncome/grossMargin REAL sebagai basis, tapi revGrowth (15%/28%/10%) dan marginTarget adalah ASUMSI HARDCODE, bukan proyeksi AI/statistik | Berlabel jujur sbg ilustrasi ("Tampilan contoh, belum terhubung data live" -- baris 1299-1303 comment), TAPI ini BUKAN blok AI prediksi (lihat bagian 2 di bawah) [KODE] |

### 1.2 Rincian AI Assistant Finance (kemampuan + wiring nyata)

| Fitur | file:line | Status wiring |
|---|---|---|
| Chat utama -> /api/v1/brain/chat | :1359 | Real, kirim attachment/mode/tone [KODE] |
| Proyeksi kas (ForecastCard) -> /api/v1/brain/forecast | :1895, render :3239 | Real, horizon 1/3/6/12 bulan, blend proyeksi internal (prediction-engine.ts milik Fatur) + sinyal riset opsional (blendForecast, lihat komentar di route.ts baris 8-13) [KODE] |
| Simulasi "gimana kalau..." -> /api/v1/brain/simulate | :1263 | Real, detectSimulation() regex trigger otomatis dari kata kunci (simulasi/skenario/seandainya/dst, baris 1246-1250), kirim liveState + adjustments.durationMonths=6 [KODE] |
| Panel "Perlu perhatian" (ProactiveAlertsPanel role=FINANCE) | :2659 | Real -- 2 sumber aktif utk role FINANCE: 'stok' (baca /api/v1/inventory/products, roles:['CEO','FINANCE']) + 'brain' (baca /api/v1/brain/alerts, tanpa filter role = semua role dapat) [KODE, verifikasi proactive-alerts.ts:203-219] |
| Rekomendasi siap dieksekusi (kartu tunggal: tinjau piutang jatuh tempo) | :2921-2960 | Real, gated `{hasAr && (...)}` dari liveFinancials.arOverdue > 0 -- SUDAH diperbaiki dari versi lama yang hardcode "PT Sentosa Abadi Rp19,4jt" (komentar baris 2917-2930 menjelaskan histori fix) [KODE] |
| Eksekusi rekomendasi (handleCardExecution) | :1219-1250 | Real -- POST /api/v1/brain/execute, sudah diperbaiki dari versi lama yg cuma nulis localStorage (komentar FIX gap kemampuan-001, baris 1201-1207) [KODE] |
| Kemampuan AI (22 kartu, 5 kategori) | :2168-2196 | Semua prompt template teks, bukan tombol eksekusi backend langsung -- pengguna kirim ke chat [KODE] |
| Galeri "Mulai dari tugas nyata" (9 kartu, 3 kategori: Dokumen&korespondensi, Analisis data, Pajak&kepatuhan) | :2222-2262 | Sama, prompt template ke chat. Kategori 3 SUDAH diganti dari "Materi promosi" (murni Marketing) ke "Pajak & kepatuhan" per audit 7 Sep (komentar baris 2246-2249) -- role-fit sudah benar [KODE] |
| Generator Invoice Formal (mini-form 2 kolom wajib) | :1198-1213, render form ~3700-3745 | Real -- compose pesan eksplisit sebut nama klien & nominal sebelum kirim ke chat, supaya lolos ekstraksi CREATE_INVOICE di brain/chat/route.ts (fix FIN-01, komentar baris 1195-1199) [KODE] |
| Sumber data yang dibaca AI (panel visual "4 sistem divisi") | :2145-2195 | Dekoratif (animasi flow SVG) menunjukkan dataSources -- perlu verifikasi apakah 4 sumber itu genuinely live, lihat 1.3 di bawah |

### 1.3 Verifikasi "Sumber data yang dibaca AI" (klaim "4 sistem divisi, tersambung langsung")

Field `dataSources` dideklarasi di baris 1992 FinanceAIAssistantView.tsx. Tidak sempat
ditelusuri baris-per-baris isi keempat entrinya (di luar kapasitas waktu batch ini,
lihat catatan_jujur) -- TAPI dari pola file yang sama (liveFinancials, liveCompanyState,
loadRealFinancials di baris 738-760 yang genuinely fetch /api/v1/kas/transactions,
/api/v1/kas/financial-health, /api/v1/brain/context), kemungkinan besar ini genuinely
live juga. **Diputuskan sementara: tandai [HIPOTESIS] bukan [KODE] untuk klaim "4 sistem
divisi tersambung langsung" sampai ada yang trace isi array dataSources baris-per-baris.**

### 1.4 Kartu Kewajiban terjadwal / Piutang / Kas & kalkulator -- baca endpoint riil? (checklist wajib tugas)

- **Kewajiban terjadwal**: YA, /api/v1/kas/obligations, model ScheduledObligation di Prisma
  (schema.prisma:558). CRUD penuh (GET di loadRealData, POST handleAddObligation:553,
  DELETE handleDeleteObligation:600). [KODE]
- **Piutang** (semua 3 widget -- Piutang per rentang umur, Invoice terbaru, Piutang klien):
  YA, /api/v1/kas/invoices, model Invoice (schema.prisma:458). [KODE]
- **Kas & kalkulator**: YA untuk tab Kas masuk/keluar (POST /api/v1/kas/transactions,
  model CashTransaction schema.prisma:429). Tab HPP & Harga jual adalah KALKULATOR
  MURNI client-side (rumus matematika dari input manual pengguna, bukan baca DB) --
  ini BENAR secara desain (kalkulator generik, bukan data historis), bukan gap. [KODE]

---

## 2. TEMUAN KONKRET (bukti + file:line)

### #1 -- "Tren 6 Bulan" (Alur uang bulan ini) hardcode 5 dari 6 bulan = 0, tanpa keterangan zero-state, dan nama bulan dipatok literal

FinanceModuleView.tsx:1037-1044:
```
const trendMonths = [
  { name: 'Apr', omset: 0, beban: 0 },
  { name: 'Mei', omset: 0, beban: 0 },
  { name: 'Jun', omset: 0, beban: 0 },
  { name: 'Jul', omset: 0, beban: 0 },
  { name: 'Agu', omset: 0, beban: 0 },
  { name: 'Sep', omset: summary.totalIncome, beban: summary.totalExpense },
];
```
Dua masalah dalam satu potong kode:
1. Nama bulan "Apr..Sep" DIPATOK literal, bukan dihitung dari tanggal berjalan. Kalau
   workspace dibuka bulan Oktober, grafik tetap menampilkan label "Sep" sebagai bulan
   terakhir/current -- salah kalender. [KODE, dibaca langsung, bukan diuji browser]
2. Blok Apr-Agu SEMUA angkanya 0 -- bukan karena data historisnya memang nol (KLIR
   memang belum punya cara query transaksi PER BULAN historis), tapi karena literal
   hardcode. Beda dengan widget lain di file yang sama (Komposisi/Rincian tab, baris
   1826/1874) yang menampilkan pesan "Belum ada omset..." saat data kosong -- tab TREN
   TIDAK punya pesan setara, jadi user melihat 5 bar kosong berdampingan dengan 1 bar
   terisi tanpa penjelasan kenapa 5 bar lainnya nol. Berisiko dibaca sebagai "omset 5
   bulan terakhir memang Rp0" padahal yang benar "kami belum menghitungnya".
   [KODE, sesuai pola honesty di bagian lain file yang sama -- ini konsisten-tidak-konsisten]

### #2 -- Duplikasi konten "aging bucket piutang" dan daftar invoice, 2-3x dalam satu accordion "Piutang & Invoice"

Accordion "Piutang & Invoice" (widgetCount=5, FinanceModuleView.tsx:2523) berisi:
1. "Piutang per rentang umur" (:2535) -- agingBuckets + arTotalAmount
2. "Invoice terbaru" (:2592) -- recentInvoicesList (5 teratas)
3. "Invoice & piutang berjalan" (:2643) -- tabel PENUH semua invoice + form create
4. "Piutang klien" tab Umur (:2878-2951) -- agingBuckets + arTotalAmount LAGI (identik
   secara data dengan widget #1, beda tata-letak saja)
4b. "Piutang klien" tab Per faktur (:2952-3000) -- arInvoicesList (invoice belum lunas)
   yang overlap sebagian dengan widget #2 dan #3
5. "Kewajiban terjadwal" (:3004)

Widget #1 dan #4(tab Umur) me-render breakdown yang SAMA PERSIS (agingBuckets, sumber
variabel identik dideklarasi sekali di baris 1085-1115) hanya beda kemasan visual (list
warna vs list warna+progress bar). Widget #2/#3/#4b (tab Faktur) bertiga menampilkan
DAFTAR INVOICE dengan filter berbeda-beda (5 teratas / semua status / hanya belum lunas)
di layar yang sama -- user melihat 3 daftar faktur berdekatan yang sebagian isinya sama.
Ini bukan bug data (semua genuinely dari `invoices` yang sama, tidak ada yang fabrikasi),
tapi BLOAT/duplikasi tata letak: 5 widget di 1 accordion padahal secara informasi cuma
perlu 2-3 (aging breakdown SATU KALI + 1 daftar invoice dengan filter tab, bukan 3
tampilan terpisah). Jejak historis: widget "Piutang klien"/"Kewajiban terjadwal" (baris
2870+) berlabel komentar "meniru form Catat Transaksi" -- terlihat seperti widget v10
mockup yang DITAMBAHKAN di atas "SECTION 3" lama (komentar baris 2645 masih berlabel
emoji di depan teks "SECTION 3 -- INVOICE & RECEIVABLES", emoji dibuang di sini krn
laporan ini wajib ASCII murni) yang tidak sempat dihapus/digabung
saat accordion baru dipasang. [KODE, dibaca langsung struktur JSX baris 2521-3157]

### #3 -- Tombol "Tagih" pada invoice overdue TIDAK mengirim apa pun (client-side flag saja), padahal endpoint WA reminder sungguhan sudah ada di backend

FinanceModuleView.tsx:2824-2843 -- tombol dengan ikon `Send` (paper airplane) dan label
"Tagih" (berubah jadi "Ditandai" + ikon Check setelah diklik), onClick memanggil
`handleSendReminder(inv.id)` (baris 623-634). Isi fungsi itu HANYA:
```
setInvoices((prev) => prev.map((inv) => inv.id === invoiceId ? { ...inv, isReminderSent: true } : inv));
// ...simpan id ke localStorage (reminderStorageKey)
```
Tidak ada fetch/POST sama sekali di dalamnya. Sementara itu backend SUDAH punya
`/api/v1/kas/piutang-reminder` (GET+POST, withTenantGuard, src/app/api/v1/kas/
piutang-reminder/route.ts:41,83) yang genuinely menyusun link wa.me (pola disalin
dari booking/reminder yang sudah dipakai fitur lain) untuk menagih invoice OVERDUE/
UNPAID-lewat-jatuh-tempo lewat WhatsApp -- endpoint ini TIDAK PERNAH dipanggil dari
FinanceModuleView.tsx maupun FinanceAIAssistantView.tsx (`grep -rln "kas/piutang-
reminder" src` hanya menemukan file route.ts itu sendiri). [KODE]
Catatan jujur: label tombol "Tagih"/"Tandai Sudah Ditagih" secara harfiah tidak
menjanjikan "terkirim via WhatsApp" (jadi bukan klaim palsu terang-terangan), tapi
ikon Send + posisinya persis di invoice overdue membuatnya terasa seperti aksi kirim
pesan -- padahal cuma checkbox lokal. Risiko: staff mengira sudah menagih klien
padahal cuma menandai status internal.

### #4 -- Backend Finance yang punya endpoint siap tapi NOL entry point UI

Tiga endpoint di src/app/api/v1/kas/ punya implementasi lengkap (withTenantGuard,
Prisma, logika nyata) tapi tidak dipanggil dari FinanceModuleView.tsx ataupun
FinanceAIAssistantView.tsx (diverifikasi `grep -rln` ke seluruh src/, hanya file
route.ts-nya sendiri yang match):
1. `/api/v1/kas/runway-forecast` (POST, route.ts:6) -- proyeksi runway dengan opsi
   input custom (customCashReserve/customMonthlyExpense/customMonthlyRevenue), sudah
   dibersihkan dari floor palsu (komentar FIN-06 baris 27-29: dulu Math.max(...,
   50jt) dihapus). Dashboard sekarang menghitung runway SENDIRI secara terpisah,
   lebih sederhana (netBurn30d, baris 359-368) -- fungsinya tumpang tindih dengan
   endpoint ini yang lebih kaya (bisa custom input untuk skenario "andai kata").
2. `/api/v1/kas/bank-reconciliation` (POST, route.ts:66) -- pencocokan mutasi bank
   vs CashTransaction, deterministik & read-only (tidak pernah menulis data).
   Menerima array `mutations` yang SUDAH diparsing -- catatan di kode sendiri bilang
   parsing upload file (.xlsx/.pdf/.csv) ada infrastruktur terpisah
   (generic-table-ledger.ts/workspace-files) yang BELUM disambungkan ke endpoint
   ini. Artinya walau UI dipasang, endpoint ini sendiri belum siap terima upload
   file langsung -- perlu jembatan tambahan.
3. `/api/v1/kas/piutang-reminder` (GET+POST) -- lihat #3 di atas.

Ketiganya kandidat kuat untuk LENGKAPI (lihat bagian 3), karena logika berat sudah
ada di backend -- pekerjaan yang tersisa murni UI wiring, bukan bikin baru dari nol.

### #5 -- Modal "Pengaturan Admin -- Hak Akses Divisi" jadi kode mati (bukan cuma toast, benar-benar unreachable)

Berbeda dari kandidat yang sudah diketahui komando (ExecutiveAIAssistantView.tsx:2745,
disebut "toast-only"), versi Finance-nya justru SUDAH DIPERBAIKI SATU LANGKAH LEBIH
JAUH: tombol yang dulu membuka modal ini SUDAH DIHAPUS (bukan diganti toast), tapi
modalnya sendiri (FinanceAIAssistantView.tsx:3758-3840-an, `{adminOpen && (...)}`,
~85 baris JSX + state `adminOpen`/`accessMode`/`adminOverrides`/`toggleAdminCap`)
DIBIARKAN di kode. `grep -n "setAdminOpen(true)"` di file ini nol hasil di luar
komentar -- artinya `adminOpen` tidak PERNAH bisa jadi true lewat interaksi user
normal. Komentar penjelas di baris 2382-2393 justru transparan soal ini: "Modal lama
DIPERTAHANKAN sebagai referensi tapi sekarang unreachable. CARA MEMBATALKAN:
kembalikan onClick jadi () => setAdminOpen(true)". [KODE]
Ini BUKAN bug pengalaman pengguna (user tidak pernah melihat modal ini, jadi tidak
menyesatkan) -- tapi murni tech-debt: ~85 baris + 4 state variable + 1 handler yang
tidak bisa dijangkau siapa pun, membebani ukuran file (3853 baris) tanpa manfaat.

### #6 -- Heuristik ambang hardcode Rp44 juta untuk menentukan status "piutang sudah ditagih"

FinanceAIAssistantView.tsx:709-718, fungsi `checkArPending()`:
```
const cash = st?.financials?.netCashBalance;
setPendingAr(!(typeof cash === 'number' && cash >= 44000000));
```
Logikanya: kartu "Rekomendasi siap dieksekusi" (lihat 1.2) dianggap "sudah diterapkan"
kalau saldo kas di localStorage >= Rp44.000.000 -- angka ini adalah nilai ambang tetap
(magic number), bukan dibaca dari status riil piutang tersebut (mis. apakah invoice-nya
sudah berstatus PAID di database). Kalau saldo kas naik karena SEBAB LAIN (bukan piutang
ini yang lunas -- mis. penjualan tunai baru), sistem tetap menyimpulkan piutang "sudah
diterapkan" padahal belum tentu. [KODE] Ini adalah hasil warisan dari kartu lama (dulu
memang benar-benar berbasis satu piutang fiktif Rp19,4jt + kas dasar Rp25,5jt = 44,9jt
literal, sudah digenerickan sebagian tapi angka ambangnya belum ikut digeneralisasi ke
"baca ulang liveFinancials.arOverdue" yang sebenarnya sudah tersedia sebagai `hasAr`/
`arDisplay` di baris 1959-1960 file yang sama).

### #7 -- Unit economics CAC/LTV dan Simulasi rencana keuangan: baik, tapi berpotensi disalahpahami sebagai "AI"

Kedua widget ini (FinanceModuleView.tsx, lihat matriks 1.1) SECARA JUJUR melabeli diri
sebagai non-data-driven (CAC/LTV: "belum tercatat"; Simulasi: catatan developer eksplisit
"BUKAN forecasting engine yang membaca data historis tren riil"). Tapi posisinya di
accordion "Analisis Lanjutan" bersebelahan dengan hal-hal yang genuinely computed dari
data asli (margin health banner) membuat keduanya BISA disalahartikan pengguna awam
sebagai "AI menghitungkan ini untuk saya" padahal skenario base/price/lean di Simulasi
adalah 3 angka pertumbuhan tetap (15%/28%/10%) yang sama untuk SEMUA tenant, bukan
personalisasi apa pun. Bukan bug, tapi risiko framing -- relevan untuk keputusan
"blok AI analisa+prediksi+rekomendasi" di bagian 3.

---

## 3. BLOK AI ANALISA + PREDIKSI + REKOMENDASI (Doktrin Ayah Mecca, 10 Sep) -- status Finance

Pertanyaan wajib tugas: apakah dashboard Finance punya blok AI analisa+prediksi+
rekomendasi setara kartu 'Target & prediksi AI' milik CEO (CompanyDataDashboard.tsx
~1483, dibaca-saja sebagai referensi, TIDAK disentuh)?

**Jawaban: TIDAK, pada permukaan DASHBOARD (FinanceModuleView.tsx). ADA SEBAGIAN pada
permukaan AI ASSISTANT, tapi berbeda bentuk dari milik CEO dan perlu diluruskan
sebelum disebut "setara".**

Rincian:
1. Dashboard Finance (FinanceModuleView.tsx) TIDAK PUNYA satu pun kartu yang
   menggabungkan analisa-apa-yang-terjadi + prediksi-sampai-Desember + rekomendasi
   konkret dalam satu tempat, persis pola yang diminta doktrin (target tahunan
   dipecah kuartal, realisasi vs target, sisa target dibagi ulang ke kuartal
   tersisa). Yang ada cuma "Hasil simulasi rencana keuangan" (ilustratif, bukan
   AI, lihat #7) dan "Margin health banner" (rule-based ambang tetap, bukan
   prediksi masa depan).
2. AI Assistant Finance PUNYA komponen prediksi yang genuinely nyata: ForecastCard
   (dari /api/v1/brain/forecast, horizon 1/3/6/12 bulan, blend proyeksi internal +
   riset) dan simulate (/api/v1/brain/simulate). TAPI keduanya HANYA muncul kalau
   pengguna memicu lewat chat (klik quick-action "Proyeksi kas 3 bulan" atau ketik
   kalimat yang match regex simulasi) -- bukan tampil otomatis/persisten begitu
   halaman dibuka, beda dari kartu CEO yang selalu tampil di dashboard.
3. `sales-target-engine.ts` (yang dipakai kartu CEO) HANYA di-import di
   ExecutiveAIAssistantView.tsx (`grep -rn "sales-target-engine" src` cuma 3 hit:
   import di sana, barrel export index.ts, dan komentar referensi di
   inventory-intelligence-engine.ts). TIDAK ADA satu pun jalur di Finance yang
   memanggilnya. [KODE]
4. Catatan penting soal cara kerja sales-target-engine.ts (relevan sebelum
   direplikasi ke Finance): engine ini BUKAN pembaca data transaksi otomatis dari
   database. `detectSalesTargetIntent(prompt)` dan `analyzeSalesTarget(prompt)`
   (ExecutiveAIAssistantView.tsx:1400-1401) bekerja dengan MEM-PARSE TEKS PROMPT
   yang diketik pengguna di chat (mis. "target 100 juta setahun, Q1 dapat 15 juta")
   lewat regex angka+satuan (AMOUNT_PATTERN, sales-target-engine.ts:24), BUKAN
   query ke tabel transaksi/invoice asli. Jadi kalau mau menghadirkan pola serupa
   di dashboard Finance sebagai kartu OTOMATIS (bukan cuma respons chat), engine
   ini TIDAK BISA dipakai apa adanya -- perlu versi baru yang membaca CashTransaction
   asli sebagai realisasi kuartal, bukan menunggu pengguna mengetik angkanya
   sendiri di prompt. [KODE, dibaca langsung sales-target-engine.ts:1-40]

**Diputuskan sementara** (paling sederhana, tinggal dikoreksi tim bangun): usulan
kartu baru "Target & prediksi AI Finance" di accordion "Analisis Lanjutan"
(menggantikan posisi "Hasil simulasi rencana keuangan" yang statis) memakai
kombinasi endpoint yang SUDAH ADA dan sudah tenant-guard: /api/v1/brain/forecast
(prediksi kas, sudah blend proyeksi+riset) + /api/v1/kas/runway-forecast (skenario
custom kas/beban/omset) untuk bagian prediksi, dan /api/v1/brain/recommendations
(route.ts sudah ada, tapi saat ini hanya dipanggil internal oleh brain/chat/route.ts
dan context-engine.ts -- BELUM pernah dipanggil langsung dari komponen Finance mana
pun) untuk bagian rekomendasi. Realisasi-vs-target butuh field baru (lihat
scan-data-riil-modul7 untuk usulan skema, di luar cakupan dokumen ini) karena KLIR
belum punya tempat menyimpan "target tahunan perusahaan" sebagai angka tersimpan --
saat ini target HANYA ada sebagai teks yang diketik user di chat (lihat poin 4).

---

## 4. HILANGKAN (alasan) -- semua ADDITIVE-SAFE (baca-saja, tidak dieksekusi batch ini)

1. **Modal "Pengaturan Admin" mati (FinanceAIAssistantView.tsx:3754-3840-an, ~90
   baris + 4 state)** -- unreachable, terbukti (#5). Hapus blok JSX + state
   adminOpen/accessMode/adminOverrides/toggleAdminCap kalau tim bangun setuju
   tidak akan diaktifkan ulang. Estimasi diff: -90 baris.
2. **Duplikasi 2x rendering agingBuckets** (widget "Piutang per rentang umur"
   vs tab "Umur" di "Piutang klien", #2) -- gabungkan jadi satu widget dengan
   1 sumber tampilan, sisakan salah satu (disarankan pertahankan gaya progress-
   bar di "Piutang klien" karena lebih informatif -- ada label risk badge).
   Estimasi diff: -60 s.d. -80 baris.
3. **Widget "Invoice terbaru" (5 teratas)** kemungkinan bisa dilebur ke tab
   "Per faktur" milik "Piutang klien" (keduanya daftar invoice, beda filter
   saja) -- ATAU dipertahankan sebagai "semua invoice apa pun status" vs
   "hanya yang belum lunas" supaya jelas beda gunanya. **Diputuskan sementara:
   PERTAHANKAN untuk sekarang** (perbedaan filter genuinely berguna: satu
   utk histori semua invoice, satu utk fokus kerja penagihan) -- HANYA
   perbaiki (2), bukan hapus (3) sekaligus, supaya tidak menghapus fungsi yang
   masih dipakai.

---

## 5. LENGKAPI (alasan + sumber data, ADDITIVE-SAFE)

1. **Wire tombol "Tagih" ke /api/v1/kas/piutang-reminder yang sungguhan** (#3) --
   ganti isi handleSendReminder supaya benar-benar POST ke endpoint itu dan
   membuka link wa.me hasil respons (bukan cuma flip state lokal). Sumber
   data: endpoint sudah lengkap di src/app/api/v1/kas/piutang-reminder/route.ts.
   Estimasi diff: +25 s.d. +40 baris (fetch + handling link wa.me + fallback
   error toast).
2. **Perbaiki "Tren 6 Bulan"** (#1) -- ganti nama bulan literal jadi dihitung
   dari `new Date()` (mis. `Array.from({length:6}, (_,i)=>...)` seperti pola
   `upcomingTaxDates` yang SUDAH dipakai di file yang sama baris 1571-1583, jadi
   tinggal tiru pola sendiri). Untuk 5 bulan tanpa data histori: tampilkan pesan
   "Histori bulanan belum tersedia" mengikuti pola exact yang sudah dipakai widget
   KPI di atasnya (baris 1624/1662/1700), BUKAN diam-diam menampilkan 0.
   Sumber data: belum ada -- KLIR memang belum punya snapshot transaksi per-bulan;
   ini murni perbaikan LABELING/HONESTY, bukan nunggu data baru. Estimasi diff:
   +10 s.d. +20 baris.
3. **Kartu "Target & prediksi AI Finance"** (bagian 3) menggunakan endpoint yang
   sudah ada (/api/v1/brain/forecast, /api/v1/kas/runway-forecast,
   /api/v1/brain/recommendations) -- perlu 1 field skema baru (target tahunan
   tersimpan, bukan cuma diketik di chat), diusulkan detail di dokumen
   scan-data-riil-modul7 (agent C), bukan diulang di sini supaya tidak
   dobel-tulis. Referensi silang: butuh_dari_tim di bawah.
4. **Sambungkan /api/v1/kas/bank-reconciliation** ke UI -- perlu form upload
   mutasi bank (CSV minimal dulu, karena endpointnya sendiri mengaku belum
   disambung ke parser upload generik) + tabel hasil pencocokan (matched/
   unmatched). Sumber data: endpoint sudah ada, logic sudah deterministik dan
   read-only (aman). Estimasi diff: +80 s.d. +120 baris (form + tabel + state).
5. **Sambungkan /api/v1/kas/runway-forecast** sebagai pelengkap "Saldo kas
   tersedia" -- saat ini dashboard menghitung runway versi sederhananya sendiri
   (netBurn30d) padahal endpoint backend sudah lebih kaya (bisa skenario custom
   kas/beban/omset utk pertanyaan "kalau begini, tahan berapa lama"). Bisa jadi
   bagian dari kartu di poin 3. Estimasi diff: +30 s.d. +50 baris (kalau berdiri
   sendiri, bukan digabung poin 3).

---

## 6. DIPUTUSKAN SEMENTARA (bukan digantung ke Mecca/Fatur)

1. Klaim "4 sistem divisi tersambung langsung" (dataSources, 1.3) -- ditandai
   [HIPOTESIS] bukan [KODE], karena tidak sempat ditelusuri isi array
   baris-per-baris dalam batch ini. Paling sederhana: verifikasi di batch
   bangun sebelum menyentuh area itu, bukan diasumsikan benar/salah.
2. Widget "Invoice terbaru" (5 teratas) DIPERTAHANKAN, tidak dihapus meski
   mirip 2 widget lain -- alasan di bagian 4 poin 3.
3. Kartu "Target & prediksi AI Finance" (bagian 3) diusulkan REPLACE posisi
   "Hasil simulasi rencana keuangan" (bukan ditambah sebagai widget ke-4 di
   accordion yang sama) supaya accordion "Analisis Lanjutan" tidak makin padat
   (sudah ada isu duplikasi widget di accordion lain, lihat #2) -- kalau tim
   bangun mau simpan keduanya berdampingan, itu keputusan desain terpisah yang
   bisa dikoreksi belakangan, bukan blocker.
4. Angka ambang Rp44 juta di checkArPending() (#6) -- diusulkan diganti baca
   `liveFinancials.arOverdue` langsung (variabel `hasAr` sudah ada di file yang
   sama, baris 1959) alih-alih membandingkan saldo kas absolut. Ini keputusan
   teknis kecil yang aman diputuskan langsung tanpa perlu konfirmasi Mecca.

---

## 7. BUTUH DARI TIM

- **scan-data-riil-modul7 (agent C)**: field skema "target tahunan perusahaan
  tersimpan" (bukan cuma diketik di chat) -- dibutuhkan supaya kartu "Target &
  prediksi AI Finance" (bagian 3) bisa membaca realisasi-vs-target otomatis
  tanpa menunggu user mengetik ulang angkanya tiap sesi chat.
- **scan-portal-ceo (agent D)**: konfirmasi apakah modal "Pengaturan akses
  per-divisi" di ExecutiveAIAssistantView.tsx (:2745, disebut context pack
  sebagai "toast-only") SEBENARNYA statusnya sama seperti Finance (sudah jadi
  kode mati unreachable, bukan cuma toast) -- supaya laporan gabungan komando
  tidak salah level keparahan antara 2 portal untuk masalah yang sama persis.

---

## 8. RINGKASAN (10 baris)

1. Portal Finance TIDAK melanggar aturan "modul jadi label" -- 0 hit grep,
   modul lain memang sengaja tidak muncul di sini.
2. Semua kartu finansial inti (Kas, Piutang, Kewajiban, Pajak) genuinely baca
   endpoint /api/v1/kas/* nyata dengan zero-state yang jujur -- kualitas
   honesty-nya di atas rata-rata dibanding bagian lain codebase yang sudah
   diaudit sebelumnya (banyak komentar FIX eksplisit menjelaskan histori
   perbaikan dari versi lama yang fabrikasi/hardcode).
3. Dashboard Finance TIDAK punya blok AI analisa+prediksi+rekomendasi setara
   kartu CEO -- yang ada cuma simulasi ilustratif (asumsi tetap, bukan AI) dan
   margin banner rule-based.
4. AI Assistant Finance PUNYA forecast & simulate yang genuinely nyata, tapi
   chat-triggered, bukan kartu persisten di layar seperti CEO.
5. sales-target-engine.ts (basis kartu CEO) bekerja dengan mem-parse teks
   prompt pengguna, BUKAN query database -- tidak bisa direplikasi apa adanya
   ke Finance sebagai kartu otomatis tanpa modifikasi.
6. Ditemukan 1 duplikasi tata letak nyata (aging bucket piutang dirender 2x,
   daftar invoice muncul 3x dengan filter berbeda dalam 1 accordion).
7. Ditemukan 1 kode mati (~90 baris modal admin unreachable) dan 3 endpoint
   backend siap pakai yang nol wiring UI (runway-forecast, bank-reconciliation,
   piutang-reminder).
8. Tombol "Tagih" pada invoice overdue tidak benar-benar mengirim reminder --
   cuma flag lokal, meski backend WA-reminder sudah tersedia.
9. Satu bug kecil kalender (label bulan "Apr..Sep" hardcode, akan salah kalau
   dibuka di bulan lain) di widget Tren 6 Bulan, plus 5 dari 6 barnya nol tanpa
   keterangan zero-state.
10. Tidak ada aksi berisiko, edit kode, atau tulis DB yang dilakukan -- laporan
    ini murni baca+analisa sesuai batasan tugas.

### Daftar perbaikan konkret, urut prioritas + estimasi diff

1. [P0, kejujuran data] Perbaiki label "Tagih" / wire ke piutang-reminder asli -- +25/+40 baris
2. [P0, kejujuran data] Perbaiki "Tren 6 Bulan" (tanggal dinamis + zero-state) -- +10/+20 baris
3. [P1, kebersihan kode] Hapus modal admin mati -- -90 baris
4. [P1, kebersihan tata letak] Gabungkan duplikasi aging-bucket -- -60/-80 baris
5. [P2, fitur baru additive] Kartu Target & prediksi AI Finance -- perlu skema baru, di luar batch ini
6. [P2, fitur baru additive] Sambungkan bank-reconciliation ke UI -- +80/+120 baris
7. [P3, penyempurnaan kecil] Ganti heuristik Rp44 juta jadi baca arOverdue asli -- +5/+10 baris
8. [P3, penyempurnaan kecil] Sambungkan runway-forecast custom-scenario -- +30/+50 baris
