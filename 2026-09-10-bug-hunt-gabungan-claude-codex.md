# Bug Hunt Gabungan -- Claude (Sonnet 5, Workflow 6+23 agent) + Codex

Tanggal: 10 September 2026 sore-malam (WIB). HEAD saat scan kedua tim: 67ca575. READ-ONLY
total -- nol file diubah oleh Claude maupun Codex selama proses ini.

Metodologi Claude: Workflow "klir-bug-hunt", 6 agent scan (area disjoint, full-read) -> 23
temuan mentah -> 23 diverifikasi 3-skeptic independen (WAJIB buka file sendiri, default
refuted=true kalau ragu) -> 23/23 LOLOS (0 dibantah). 75 agent total, 11.1 juta token.
Metodologi Codex: smart-debug + ui-audit + security-sweep, live read-only di produksi
(login CEO/Owner), tsc+129 test target hijau.

## SIAPA YANG FIX (keputusan Mecca, 10 Sep malam)

Claude (Sonnet) + Codex tugasnya CARI dan VERIFIKASI bug, BUKAN mengeksekusi fix untuk
seluruh daftar ini. Mecca eksplisit: eksekusi fix seluruh item di bawah dipegang **Codex,
jalan di atas model Astra 6** (model ChatGPT terbaru, dipakai Codex kayak Claude pakai
Fable 5.1). Lihat `2026-09-10-claude-to-codex-handoff-6-implementasi.md` (versi final,
menggantikan handoff-5) untuk paket kerja lengkap + urutan prioritas. Claude tetap available
buat verifikasi hasil fix (independent check, bukan nulis kode paralel di file yang sama --
biar gak tabrakan).

**Total temuan per 10 Sep malam: 46** -- 23 Claude (batch 1) + 11 Codex (batch 1) + 2 Claude
(cross-verify Pusat Data: BH-013/BH-014) + 10 Codex (deep rescan: DEEP-001..010, VERIFIED
10/10 oleh Claude, lihat Bagian 7).

## 0. YANG PALING URGENT -- baca ini duluan

**BH-001 (Codex) -- Top-up kredit bisa dimanipulasi dari client, TANPA verifikasi pembayaran.**
`src/app/api/v1/credits/topup/route.ts` baris 43-80: endpoint langsung nambah CreditAccount +
CreditLedger berdasarkan `workspaceId` yang dikirim client sendiri, TANPA cek dia pemilik
workspace itu, TANPA cek status pembayaran `PENDING->settled`, TANPA webhook/signature
verification, TANPA idempotency. Kalau endpoint ini reachable di produksi -- ini P0
(free-credit / payment-bypass, bisa jadi financial abuse kalau kredit dipakai buat AI/media
generation). Codex BELUM eksploitasi live (cuma baca source), tapi confidence tinggi.
**Ini yang paling butuh keputusan/perhatian Mecca duluan, sebelum item lain.**

## 1. Bug keamanan tenant-isolation (SEMUA dikonfirmasi 2 tim independen atau 1 tim + evidence kuat)

| ID | Severity | File:baris | Masalah | Sumber |
|---|---|---|---|---|
| BH-001 | **P0/kondisional** | credits/topup/route.ts:43-80 | Top-up saldo tanpa verifikasi pembayaran/kepemilikan workspace | Codex |
| BH-002 | P1 | corplan/share-context/route.ts:12-16 | Baca project ID tenant lain tanpa cek workspaceId (cross-tenant read) | Codex |
| BH-003 | P1 | anivirtual/understand/route.ts:111-115 | Baca/tulis sessionId tenant lain tanpa cek workspaceId | Codex |
| BH-004 / #1 Claude | **critical/P1** | kerja/tasks/route.ts:86-89 | PUT ubah status task WORKSPACE LAIN tanpa filter workspaceId | **Claude DAN Codex, independen, sama persis** |
| #2 Claude | high | brain/chat/route.ts:756-1414 | AI chat bisa dipakai role VIEWER buat nulis CashTransaction/Invoice/Workspace (RBAC bypass lewat bahasa natural) | Claude |

Pola yang berulang di 4 dari 5 bug ini: `withTenantGuard` cuma buktiin siapa pemanggil +
workspace aktifnya, TAPI query `findUnique`/`update` ke object lain (task/project/session)
gak ikut difilter `workspaceId`. Kemungkinan besar ada pola serupa di endpoint lain yang
belum ke-scan -- Codex eksplisit saranin audit menyeluruh pola ini.

## 2. Data salah/nyasar tapi BUKAN soal keamanan tenant

| # | Severity | File:baris | Masalah |
|---|---|---|---|
| Claude #3 | high | CompanyDataDashboard.tsx:1029-1043 | Grafik "harian" (kas/iklan/tim) FIKSI matematis (ramp hardcode x angka bulanan), bukan data per-tanggal asli |
| Codex BH-005 | P1/P2 | CompanyDataDashboard.tsx:83-105, 886-912 | Kartu utama CEO (marketing/tim) masih dari DEFAULT_MKT/DEFAULT_TEAM, cuma sebagian field di-override data asli -- beda sudut dari temuan Claude di atas, sama-sama valid |
| Codex BH-006 | P2 | kas/invoices/route.ts:35-56 | Total invoice cuma dihitung dari 50 row pertama (undercount kalau >50 invoice) |
| Codex BH-007 | P2 | kas/transactions/route.ts:46-185 | transactionCount = jumlah row di halaman (capped 500), bukan total periode |
| Codex BH-008 | P2 | booking/queue/route.ts | "Hari ini" sebenarnya ALL-TIME (nomor antrean gak reset per hari) |
| Codex BH-009 | P2 | kerja/attendance/route.ts | "Hari ini" ALL-TIME + cuma 30 row pertama (beda bug dari temuan Claude di file sama) |
| Claude #8 | medium | kerja/attendance/route.ts:43 | Default location "GPS Verified" HARDCODE -- gak ada verifikasi GPS beneran, UI gak pernah kirim location |
| Claude #7 | medium | kas/runway-forecast/route.ts:16-38 | Kalkulasi "bulanan" sebenarnya total sepanjang umur workspace (dormant, 0 caller UI) |
| Claude #9 | medium | inventory-intelligence-engine.ts:364-402 | Nilai "stok mati" ikut hitung produk KONSINYASI (bukan milik toko sendiri) |
| Claude #10 | medium | CompanyDataDashboard.tsx:961, 2579-2586 | Label bulan di grafik tren geser 1 bulan (Sep kebaca "Agu") |
| Claude #11 | medium | CompanyDataDashboard.tsx:914, 3097-3108 | "Saldo kas bulan lalu" hasil ekstrapolasi rasio laba, bukan angka historis asli |
| Claude #12 | high | MarketingModuleView.tsx (5 lokasi) | Teks target ROAS hardcode "3,0x" padahal logic sudah dinamis -- kontradiksi begitu user ganti target |
| Claude #13 | medium | MarketingModuleView.tsx:412, 739-752 | Alert "Voucher hampir habis" cek kondisi SALAH (status, bukan % kuota terpakai) |
| Claude #14 | low | CompanyDataDashboard.tsx:995-1020 | "Proyeksi 3 bulan" pakai data bulan yang lagi di-browse (bisa bulan lampau), bukan bulan aktif |
| Codex BH-010 | P2 | system/health/route.ts | Endpoint publik bocorin environment/provider/jumlah workspace/raw DB error |
| Codex BH-011 | P1/P2 | FinanceAIAssistantView.tsx:532-3793 | Toggle "akses per divisi" cuma React state lokal, NOL efek backend -- kesan RBAC padahal bukan |

## 3. Bug fungsional (data hilang/salah tapi bukan data-palsu-ditampilkan-asli)

| # | Severity | File:baris | Masalah |
|---|---|---|---|
| Claude #5 | high | ExecutiveAIAssistantView.tsx:713-2928 | Lampiran file chat GLOBAL bukan per-percakapan -- isi dokumen bisa nyasar ke chat lain |
| Claude #6 | high | FinanceAIAssistantView.tsx (sama) | Bug identik di portal Finance (Marketing sudah dibenerin, 2 ini belum) |
| Claude #4 | medium | payroll/route.ts:101-120 | Tandai gaji lunas + catat pengeluaran kas = 2 write TERPISAH (bisa partial-fail, gaji "lunas" tanpa jejak kas) |
| Claude #16 | high | KlirInventoryView.tsx:1331-1363 | Commit foto-jadi-stok diam-diam buang baris yang gagal parse qty, user cuma liat "sukses" generik |
| Claude #15 | medium | inventory/photo-to-stock/route.ts:333-370 | Bisa dorong stok jadi NEGATIF (endpoint kembarnya sengaja mencegah ini) |
| Claude #17 | medium | KlirInventoryView.tsx:1013-1025 | Tab "Skor pemasok" basi permanen setelah mutasi di tab lain, gak ada refresh manual |
| Claude #18 | medium | kerja/payroll (seluruh endpoint) | Fitur SELESAI di backend (buat slip gaji+auto-catat kas) tapi NOL pintu masuk UI -- gak kepake sama sekali |
| Claude #19-22 | low | berbagai | onRoleChange mati (Executive+Finance, sudah dibenerin di Marketing), overwrite harga manual saat ganti produk di form jual, invoice amount dari AI gak divalidasi >0 |
| Codex BH-012 | P2/P3 | FinanceAIAssistantView.tsx:606-693 | Chat history/preference di localStorage (bukan cross-tenant leak, tapi hilang kalau ganti device) |

## 4. Soal Pusat Data (pertanyaan Mecca) -- SUDAH DIJAWAB Codex, lengkap

Baca `2026-09-10-codex-to-claude-handoff-4-data-integration.md` (ditulis Codex, sudah ada di
repo). Ringkasan akar masalah: upload ke Pusat Data cuma bikin `WorkspaceFile` +
`extractedSummary` + masuk AI knowledge -- TIDAK otomatis bikin `CashTransaction`/`Product`/
`Campaign` dst. Satu-satunya jalur yang benar-benar nulis ke tabel domain adalah tombol manual
"Impor ke Buku Kas" (cuma buat CashTransaction, per-file, per-klik). 11 file Mecca "belum ada
data turunan tercatat" karena belum ada yang diklik importnya -- BUKAN bug pengiriman gagal
diam-diam, itu memang belum pernah di-trigger. Codex juga nemuin bug tambahan di importer:
badge "5 file bisa diimpor" dihitung dari ekstensi+status doang, BUKAN validasi semantik --
`laporan-penjualan-bulanan.xlsx` preview live cuma confidence 35% dan SEMUA baris didefault
'INCOME' (berisiko double-count), `laporan-keuangan-laba-rugi.xlsx` malah DITOLAK importer.
Codex kasih spec lengkap (klasifikasi domain, preview-sebelum-write, provenance/idempotency,
event-refresh per role) -- BUKAN cuma diagnosis, sudah level implementation-ready.

Workflow investigasi Claude sendiri (klir-pusat-data-integration-trace) SUDAH SELESAI (95
agent, 13.7 juta token, 47 klaim mentah -> 30 diverifikasi [LOKAL]) -- dipakai buat
CROSS-VERIFY klaim Codex di atas (bukan nulis ulang dari nol). Hasil: **CONFIRM PENUH**
diagnosis Codex, nol kontradiksi. Ditemukan 2 hal TAMBAHAN di luar cakupan handoff-4 Codex:

**BH-013 (Claude, baru) -- transaksi hasil impor bisa "sukses" tapi tetap GAIB di dashboard
kalau tanggalnya bulan lampau.** `import-ledger` route nulis `transactionDate` dari tanggal
ASLI baris sumber (`src/lib/workspace-file-ledger.ts:242`), sementara dashboard Finance+CEO
fetch `kas/transactions` TANPA kirim param month/range (`CompanyDataDashboard.tsx:613,619`,
`FinanceModuleView.tsx:607,609`) -> backend default ke "bulan berjalan"
(`src/lib/time-series-engine.ts:142,191-212`). Akibat: file historis (kayak
laporan-keuangan-laba-rugi.xlsx yang isinya transaksi bulan lalu) BISA sukses diimpor
(linkedRecordIds keisi, saldo kumulatif berubah) tapi TETAP TIDAK MUNCUL di dashboard karena
kefilter bulan-berjalan. Beda akar dari temuan Codex (Codex: gaib karena belum diklik; ini:
gaib WALAU sudah diklik+sukses, kalau tanggal sumbernya bukan bulan ini). [LOKAL]

**BH-014 (Claude, baru) -- AI Brain baca lintas-role tanpa filter, by design.**
`src/lib/ai-brain/workspace-knowledge.ts:115-159` query `WorkspaceFile` cuma filter
`workspaceId` (tenant), NOL filter role/portal -- dipakai `brain/chat/route.ts` buat SEMUA
role. CEO/Finance/Marketing di 1 tenant nerima blok "pengetahuan perusahaan" yang PERSIS
SAMA, gak peduli file itu diupload lewat portal mana. Ini jawaban langsung ke pertanyaan lama
Mecca soal "AI per role" DAN confirm-silang temuan #2 Claude (AI chat RBAC-bypass) dari sudut
BACA (bukan cuma NULIS lintas-role kayak temuan #2). [LOKAL]

## 7. DEEP-001..010 (Codex deep bug-hunt lanjutan, diagnosis-only) -- Claude verify 10/10

Codex kirim `2026-09-10-codex-deep-bug-hunt-diagnosis.md` (rescan lanjutan, delta report, bukan
timpa laporan lama). Ini 10 temuan BARU, mayoritas P1, levelnya otorisasi finansial langsung.
Claude jalanin Workflow verify (20 agent Sonnet, 2 skeptic independen/temuan, wajib buka file
sendiri, default tolak kalau ragu) -- **hasil: 10/10 lolos, 0 dibantah**. Severity di bawah
sudah disesuaikan pakai catatan skeptic (bukan cuma copy klaim awal Codex mentah-mentah).

| ID | Severity (final, pasca-verify) | File:baris | Masalah |
|---|---|---|---|
| DEEP-001 | P1 | brain/execute/route.ts:30-49, execution-engine.ts:20-168 | AI eksekusi action (SCALE_MARKETING/APPROVE_HIRING/dst) TANPA lookup server-side yang buktikan recommendation itu nyata/milik-workspace/belum-dieksekusi -- MANAGER+ bisa bikin PromoCoupon/WorkTask asli dari command karangan sendiri, gak ada idempotency |
| DEEP-002 | P1 | purchase-orders/route.ts:101-186 | Guardrail approval PO (`spending-approval-guardrail.ts`) SUDAH ADA tapi TIDAK PERNAH dipanggil dari endpoint PO -- MEMBER bisa POST PO nominal berapapun, langsung RECEIVED + stok + kas ter-mutasi, nol approval |
| DEEP-003 | P1 (skeptic: layak dipertimbangkan P0, data-loss permanen) | kas/transactions/route.ts:251-268 | Role MEMBER bisa `deleteMany` SELURUH transaksi kas 1 workspace pakai `?all=true`, tanpa approval/konfirmasi tambahan -- ireversibel |
| DEEP-004 | P1 | security-guardrail.ts:220-279 | Approval destructive (PURGE_FINANCE dst) bisa di-resolve ULANG -- resolver gak cek status sebelum proses, termasuk REJECTED bisa di-flip jadi APPROVED lalu purge jalan lagi. Butuh role OWNER, jadi bukan privilege-escalation murni, tapi tetap pelanggaran "1 approval = 1 eksekusi" |
| DEEP-005 | P2/P3 (skeptic: turun dari P1/P2 klaim awal -- window race sempit, CashTransaction yang jadi tetap benar) | import-ledger/route.ts:276-327 | CashTransaction commit atomic, tapi `linkedRecordIds` final adalah write TERPISAH -- kalau gagal di antara keduanya, file stuck permanen (409 selamanya) meski kas sudah tercatat benar |
| DEEP-006 | P2 | kas/transactions/route.ts:57-119 | List transaksi ikut filter type/category, tapi 3 aggregate (period/prev/allTime) TIDAK -- summary/total kas gak sinkron sama daftar yang ditampilkan di layar sama |
| DEEP-007 | P2 (skeptic: turun dari P1/P2 -- butuh window kegagalan spesifik antar-write, bukan exploit sengaja) | kas/invoices, kerja/payroll, booking/reservations | Invoice/payroll/booking di-update status "selesai" DULU, baru CashTransaction nyusul sebagai write terpisah -- kalau write kedua gagal, object ngaku selesai tapi kas gak kecatat |
| DEEP-008 | P2 | security/approvals/route.ts (POST) | Metadata requester (role/nama) di tiket approval dari body client, bukan auth -- approval-gate PATCH sendiri tetap aman (dari auth), tapi tiket bisa nampilin identitas palsu ke Owner yang review (vektor social-engineering) |
| DEEP-009 | P2 (skeptic: SEKARANG P2 karena belum tersambung ke aksi nyata, TAPI jadi P1/P0 begitu DEEP-002 disambung) | spending-approval-guardrail.ts:170-270 | Resolver approval PO gak atomic -- dua approval concurrent bisa dua-duanya lolos sebelum salah satu keliatan yang lain (race). Dampak sekarang cuma audit-trail ganda; begitu DEEP-002 di-fix (guardrail disambung ke PO beneran), race ini otomatis naik severity |
| DEEP-010 | P2 | 7+ file (kas/invoices, kas/transactions, payroll, booking, brain/chat/recommendations/forecast) | Banyak catch-block balikin `err.message` mentah ke client -- pola sistemik, skeptic nemuin bahkan >80 lokasi serupa di seluruh `src/app/api/v1` (bukan cuma 7 yang disebut Codex) |

**Catatan silang penting: DEEP-002 dan DEEP-009 saling mengunci urutan.** DEEP-009 (race
approval PO) severity-nya sengaja masih P2 SEKARANG karena guardrail belum tersambung ke PO
beneran (DEEP-002 belum di-fix). Begitu DEEP-002 disambung, DEEP-009 HARUS ikut dibenerin di
batch yang sama -- kalau enggak, nyambung guardrail tanpa nutup race-nya cuma mindahin bug,
bukan nutup. Codex WAJIB perlakukan DEEP-002+DEEP-009 sebagai 1 paket kerja, bukan 2 item
terpisah yang bisa dikerjain kapan-kapan.

Full detail reasoning per-temuan (evidence line-by-line dari 20 skeptic) ada di journal
workflow verify -- ringkasan di atas udah cukup buat eksekusi, gak perlu dibuka lagi kecuali
ada yang meragukan hasilnya.

## 5. Yang TIDAK dilaporkan sebagai bug (sengaja, dicek dulu)

- Marketing `reports: any[] = []` -- UI sudah jujur label "Segera hadir", bukan data palsu.
- `system/health` publik -- mungkin memang disengaja buat monitoring, cuma raw DB error-nya
  yang perlu ditutup (bukan endpoint-nya dihapus).
- Modul KPI/SOP stateless antar-tab -- didisclose jujur ke user di UI, bukan bug tersembunyi.
- UUID workspace demo yang sama muncul di 5 file (termasuk auth/login) -- kemungkinan
  berhubungan sama temuan lama "login demo auto-provision superadmin", diteruskan sebagai
  peringatan bukan fix (di luar lane Claude/Codex, sudah pernah diketahui Mecca sebelumnya).

## 6. Yang BELUM sempat di-scan (jujur, bukan diklaim bersih)

brain/chat/route.ts cuma ~700/2333 baris dibaca detail. ~24 dari 38 file di src/lib/ai-brain/
belum disentuh sama sekali (nudge-engine, simulator-engine, ledger-parser, dll). 4 endpoint
booking/* belum diaudit tenant-guard-nya. FinanceModuleView.tsx cuma ~55-60% dibaca detail
(sisanya di-grep dangkal, gak ketemu red-flag tapi bukan jaminan bersih). Kedua tim eksplisit
TIDAK menutupi gap ini sebagai "sudah dicek aman".
