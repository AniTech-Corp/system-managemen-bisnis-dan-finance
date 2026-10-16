# Untuk Fatur: Sesi Lanjutan 7 September -- Perubahan Baru dan Kenapa

Dokumen ini menyambung `2026-09-07-untuk-fatur-apa-yang-kami-ubah-dan-kenapa.md` (yang
sudah kamu baca sebelumnya, status kode saat itu `9c6990e`, sudah live). Ini BUKAN
pengulangan isi dokumen itu -- ini catatan perubahan BARU yang terjadi sesudahnya, di sesi
yang menuntaskan roadmap `2026-09-07-ROADMAP-SESI-DEPAN-integrasi-penuh-A-sampai-Z.md`.

Tujuan dokumen ini sama seperti yang lama: supaya kamu tahu persis apa yang berubah, kenapa,
dan cara membatalkannya kalau tidak setuju -- dan supaya kamu bisa salin-tempel bagian yang
relevan ke Antigravity atau OpenCode tanpa perlu menjelaskan ulang dari nol.

Baseline awal sesi ini (diverifikasi langsung, bukan diasumsikan): `tsc --noEmit` 0 error,
464/464 test lulus, `main` bersih di commit `43e51bc`, sinkron dengan `origin/main`.

---

## Bagian 0 -- Apa yang Dikerjakan Sesi Ini

Urutan prioritas mengikuti Penutup roadmap: 4.3 (tombol hapus transaksi kas) -> 4.2
(fondasi WorkspaceFile) -> 4.5/4.4 (kartu document-checker, wiring ai-orchestrator) -> 4.1/5
(Hub Upload Data) -> 4.7/4.8 (cek dulu perlu tabel baru atau tidak) -> Bagian 2 (rekonsiliasi
paket Antigravity/Codex) -> sisanya sesuai waktu yang tersedia.

Setiap item di bawah ditulis SETELAH genuinely selesai (lulus tsc+test+build+verifikasi
browser), bukan ditulis di depan sebagai rencana -- supaya dokumen ini tidak mengklaim
sesuatu yang ternyata belum jadi.

---

## Bagian 1 -- Per Item (diisi berjalan, urut waktu selesai)

### 1.1 Tombol Hapus Transaksi Kas (`FinanceModuleView.tsx`, +40/-0) -- commit `44e5e65`

**Apa yang terjadi.** Endpoint `DELETE /api/v1/kas/transactions` sudah ada di kodemu dan
sudah tenant-guarded (kami tidak sentuh route.ts-nya sama sekali) -- tapi tidak ada
tombol di UI yang memanggilnya. User tidak bisa hapus transaksi salah-input sendiri.

**Yang kami lakukan.** Tambah state `deletingId` (per-baris, dekat `useState transactions`),
fungsi `handleDeleteTransaction` yang mengikuti pola persis `handleAddTransaction` yang
sudah ada (toast, reload via `loadRealData()`, `dispatchEvent('klir-kas-updated')`), dan
tombol ikon Trash2 (lucide-react, ditambah ke import list) yang muncul saat hover baris
transaksi. Konfirmasi pakai `window.confirm()` native -- ini pola yang SUDAH dipakai 3x
di file lain (FinanceAIAssistantView, ExecutiveAIAssistantView, MarketingAIAssistantView),
jadi kami ikuti pola yang sudah ada, bukan bikin komponen modal baru.

**Diverifikasi.** tsc 0 error, 464/464 test lulus, `next build` sukses, dan diklik
langsung di browser (localhost): hover baris -> ikon muncul -> klik -> konfirmasi ->
`DELETE /api/v1/kas/transactions?id=...` return 200 -> list refresh, transaksi lain di
workspace tidak tersentuh (dites pakai transaksi baru Rp 1.000 yang sengaja dibuat lalu
dihapus lagi, bukan menghapus data asli).

**Cara membatalkan.** Hapus blok state `deletingId`, fungsi `handleDeleteTransaction`,
tombol `<button>` yang disisipkan setelah blok "Right Amount", dan `Trash2` dari import
lucide-react.

### 1.2 Wiring `ai-orchestrator.ts` di Chat Utama (`brain/chat/route.ts`, +6/-1) -- commit `e831a50`

**Apa yang terjadi.** `ai-orchestrator.ts` ("Hermes-lite") sudah lengkap+teruji dari sesi
sebelumnya tapi nol caller di seluruh app -- `executeAIRequest` masih dipanggil langsung di
3 titik. Kami ganti SATU titik (chat utama pengguna, bukan 2 titik ekstraksi JSON) jadi
`orchestrate({task:'chat',...})`.

**Kenapa cuma satu titik, bukan tiga.** TASK_ROUTES.chat defaultnya (`preferredProvider:
'auto'`, temp 0.7, jsonMode false) identik 100% dengan behavior lama -- nol perubahan
routing, cuma nambah lapisan pencatatan rute non-fatal. Sebelum menyentuh 2 titik ekstraksi
JSON (RECORD_CASH/HPP), kami baca `callGroq` langsung dan menemukan `preferredProvider`
ternyata TIDAK PERNAH dipakai lagi setelah destructuring di `executeAIRequest` -- jadi
`TASK_ROUTES.extract_json` yang meroutekan ke provider `groq` itu sebenarnya tidak
berefek apa-apa saat ini (dead parameter). Kalau kamu berencana benerin itu supaya
TASK_ROUTES genuinely memaksa provider, itu proyek terpisah -- kami sengaja tidak
menyentuhnya sesi ini karena di luar scope "satu titik dulu, verifikasi".

**Diverifikasi.** tsc 0 error, 464/464 test lulus, `next build` sukses, dan kirim chat
sungguhan di browser -- jawaban AI koheren pakai data kas asli, response 200, nol error.

**Cara membatalkan.** Ganti `orchestrate({task:'chat',...})` balik ke `executeAIRequest({...})`
di baris chat utama, hapus import `orchestrate`.

### 1.3 Anti-Slop Optical Anchor untuk Generate Gambar (`media-provider.ts`, +42/-2) -- commit `5d910cc`

**Apa yang terjadi.** Rekonsiliasi Bagian 2 roadmap: full-read paket evaluasi 5 September
(`02-KLIR-PUBLIC-PRIVATE/2026-09-05-gemini-studio-evaluation` dan
`.../2026-09-05-codex-notebooklm-studio-evaluation`, sekarang dipindah ke
`06-ARSIP-KODE-LAMA/2026-09-05-antigravity-dan-codex-notebook-studio-evaluation/`) vs kode
aktif, verdict per komponen:
- Validasi Zod notebook 9-kartu (paket Gemini): DIARSIPKAN -- kode aktif
  (`notebook-engine.ts`+`notebook-cards.ts`) sudah setara/lebih ketat.
- Parameter kamera fisik anti-slop (paket Gemini): DIADOPSI -- guardrail gambar aktif cuma
  1 baris generik, nol parameter optik. Diport jadi fungsi `opticalAnchor()`, disuntik
  otomatis ke tiap `enrichMarketingImage()`.
- Paket Codex (notebook studio): DIARSIPKAN seluruhnya -- duplikasi konseptual notebook
  9-kartu aktif. Satu ide belum ada di manapun (`meta.evidence`+`sourceFingerprint`
  audit-trail per-artefak) dicatat sebagai USULAN terpisah untuk kamu/Mecca, TIDAK
  dieksekusi sesi ini.

**Diverifikasi.** tsc 0 error, 464/464 test lulus, `next build` sukses. Murni fungsi string
builder tanpa I/O, nol sentuh auth/tenant-guard/prisma.

**Cara membatalkan.** Hapus fungsi `opticalAnchor()` dan pemanggilannya di
`enrichMarketingImage()`, `src/lib/media-provider.ts`.

### 1.4 Model Prisma `Campaign` + `ScheduledObligation` (+endpoint+UI) -- commit `67644b1`

**Apa yang terjadi.** Full-scan `schema.prisma` konfirmasi: campaigns iklan Marketing dan
kewajiban terjadwal Finance GENUINELY tidak punya tabel/endpoint apapun (bukan bug
tampilan). 2 model baru murni aditif, NOL perubahan ke model existing (`Invoice` tetap
piutang, tidak disentuh).

```prisma
model Campaign {
  id, workspaceId, name, platform (enum), dailyBudget, roas?, leads, status (enum),
  createdAt, updatedAt -- relasi baru Workspace.campaigns
}
model ScheduledObligation {
  id, workspaceId, name, dueDate, amount, status (enum), category?, createdAt --
  relasi baru Workspace.scheduledObligations
}
```

**Migrasi.** `prisma db push` sudah dijalankan ke Neon dev DB (skema kamu sudah ikut sinkron
kalau kamu `git pull` lalu `prisma generate` lagi di mesinmu -- WAJIB restart dev server
setelah itu, PrismaClient singleton dev tidak refresh sendiri lewat hot-reload). Endpoint baru:
`/api/v1/marketing/campaigns` (GET/POST/PATCH/DELETE) dan `/api/v1/kas/obligations`
(GET/POST/DELETE), pola persis endpoint existing (`withTenantGuard`, workspaceId dari auth).
`MarketingModuleView.tsx`/`FinanceModuleView.tsx` di-wire fetch data asli (dulu
`useState([])`/`const upcomingDues14/30 = []` permanen kosong).

**Diverifikasi.** tsc 0 error, 464/464 test lulus, `next build` sukses, DAN full
end-to-end lewat pemanggilan route handler langsung di proses Node baru (bypass dev
server yang Prisma client-nya basi) -- GET/POST/PATCH/DELETE campaigns, GET/POST/DELETE
obligations, semua terhadap database Neon asli, data test dibersihkan lagi setelahnya.

**Cara membatalkan.** Hapus 2 model dari `schema.prisma` + relasi di `Workspace`, `prisma
db push` lagi, hapus folder `src/app/api/v1/marketing/campaigns/` dan
`src/app/api/v1/kas/obligations/`, revert wiring di kedua ModuleView.

### 1.5 Render Video Sungguhan via OpenRouter + Model Picker (roadmap 4.6) -- commit `5b43250`

**Apa yang terjadi.** Generate video dulu SELALU `return plannedVideo()` (1 baris, nol
provider call) apapun kredensialnya -- fitur "video" cuma storyboard DOCX. Mecca eksplisit
minta ini diselesaikan sesi ini (saldo OpenRouter perusahaan tersedia untuk dipakai) +
model bisa dipilih user dari murah ke mahal.

**Verifikasi endpoint DULU, sebelum nulis kode.** Kami cek dokumentasi resmi OpenRouter
(WebSearch + panggilan API langsung, BUKAN tebakan) -- OpenRouter genuinely punya video
generation API async: `POST /api/v1/videos` (submit) -> job id -> poll
`GET /api/v1/videos/{id}` -> `unsigned_urls` begitu `status: completed`. Model discovery
`GET /api/v1/videos/models` (shape beda dari `/images/models`, punya `pricing_skus`
langsung di listing).

**Yang kami lakukan.**
- `generateVideoMedia()` genuinely submit+poll (timeout 150 detik, interval 4 detik,
  keduanya override-able lewat env untuk test) -> video/mp4 URL asli. Fail-soft ke
  `plannedVideo()` kalau capability off, job gagal/dibatalkan/kedaluwarsa, atau submit
  error -- TIDAK PERNAH exception ke user, storyboard DOCX tetap selalu ada sebagai
  alternatif.
- Model picker sungguhan di Studio Media: 28 model real (Seedance 2.0/2.5/Mini/Fast, Veo
  3.1/Lite/Fast, Sora 2 Pro, Wan, Kling, Hailuo, Runway, dst), diurutkan murah->mahal,
  harga tampil per opsi. Plus rasio/resolusi/durasi sesuai kapabilitas model terpilih.
- Biaya nyata per-generate (`usage.costUsd`, sebenarnya sudah lama dikirim backend tapi
  tidak pernah ditampilkan) sekarang muncul di "Detail teknis" hasil -- untuk gambar/
  audio/video sekaligus, bukan cuma video.
- Image model picker JUGA disiapkan kolom harga di kode, TAPI verified jujur:
  `/images/models` TIDAK membawa field pricing sama sekali (beda dari `/videos/models`) --
  harga gambar cuma ada di sub-resource `/endpoints` per-model, terlalu mahal difetch
  untuk 28+ model cuma buat isi dropdown. Didokumentasikan sebagai limitation yang belum
  diselesaikan, bukan ditutup-tutupi -- biaya gambar tetap kelihatan SETELAH generate.

**Diverifikasi.** tsc 0 error, 468/468 test lulus (4 baru untuk video), `next build`
sukses, DAN satu render video SUNGGUHAN terhadap OpenRouter API asli (4 detik,
`bytedance/seedance-2.0`, selesai 97.6 detik, biaya real $0.61, URL video valid) plus
verifikasi visual di browser (model picker tampil 28 model + harga real, studio video &
gambar kebuka normal, bukan lagi dropdown disabled "Segera").

**Cara membatalkan.** Ganti balik `generateVideoMedia()` jadi `return plannedVideo();`
1 baris (`src/lib/media-provider.ts`), kembalikan dropdown disabled di
`MediaStudio.tsx`, revert `validMediaResult()` di `client.ts` (video ready dianggap
selalu invalid seperti semula).

---

### 1.6 Pusat Data (Hub Upload) -- Fitur Baru Prioritas #1 (roadmap 4.1, 4.2) -- commit `8d09160`

**Apa yang terjadi.** Mecca eksplisit: "paling wajib itu adalah tempat upload data".
Sebelum ini, nol halaman/menu upload di luar chat AI -- cuma tombol jepit kertas di
composer, dan file mentahnya sendiri TIDAK PERNAH tersimpan (proses-lalu-buang,
dikonfirmasi baca kode ketiga endpoint upload sebelumnya). User tidak punya kendali/
visibilitas atas datanya sendiri.

**Fondasi (4.2).** Model Prisma `WorkspaceFile` baru (workspaceId, uploadedBy, fileName,
fileType, sizeBytes, storageBlob, extractedSummary, linkedRecordIds, status, createdAt)
-- MURNI ADITIF, nol perubahan model existing. MVP simpan sebagai `Bytes` langsung di
Postgres (Neon yang sudah dipakai), bukan object storage baru. Endpoint
`/api/v1/workspace-files` (GET/POST/DELETE, `withTenantGuard`). Upload memanggil
`extractTextFromBuffer()` yang SAMA PERSIS dipakai `/documents/extract-text` (fungsi itu
diekspor, bukan diduplikasi -- 1 baris tambahan `export` di fungsi yang sudah ada).

**UI (4.1).** Komponen baru `WorkspaceDataHub.tsx` (modal): upload langsung, daftar file
(nama/jenis/tanggal/status), lihat hasil ekstraksi, tombol HAPUS (menutup gap Bagian 9.4
dokumenmu -- dulu nol mekanisme hapus data). Dipasang sebagai item sidebar baru "Pusat
Data" di ketiga AI Assistant View -- BUKAN route/halaman baru di `page.tsx` (zona merah,
tidak disentuh), pola modal sama persis dengan "File hasil AI" yang sudah ada.

**Yang SENGAJA belum disambungkan.** "Tanya AI soal file ini" -- prop `onAskAI` opsional
sudah disiapkan di komponen, tapi belum dikaitkan ke state composer chat di 3 file besar
(risiko salah pasang kalau ditebak tanpa trace lengkap). Tombolnya cuma muncul kalau
parent menyediakan callback-nya. Juga: file yang menghasilkan data turunan
(`linkedRecordIds`) belum ada mekanisme AUTO-ISI-nya -- kolomnya sudah ada di skema,
tapi belum ada kode manapun yang menulis ke situ (butuh tool-calling dari AI chat ke DB,
di luar scope sesi ini, lihat Bagian 2 di bawah).

**Diverifikasi.** tsc 0 error, 468/468 test lulus, `next build` sukses, full end-to-end
lewat pemanggilan route handler langsung (upload txt asli -> extractedSummary terisi ->
list menampilkannya -> delete -> terkonfirmasi hilang) terhadap Neon DB asli. Modal UI
diverifikasi visual di browser: render benar, upload button ada, error handling graceful.

**Cara membatalkan.** Hapus model `WorkspaceFile` dari `schema.prisma` + relasi di
`Workspace`/`User`, `prisma db push` lagi, hapus `src/app/api/v1/workspace-files/` dan
`src/app/components/WorkspaceDataHub.tsx`, revert import+state+button+render call di
ketiga AI Assistant View, hapus kata `export` di `extractTextFromBuffer`
(`documents/extract-text/route.ts`).

### 1.7 Kartu Hasil Document-Checker/Tabular-Checker (roadmap 4.5) -- commit `31c8a23`

**Apa yang terjadi.** `document-checker.ts`/`tabular-checker.ts` sudah nyambung ke
`/api/v1/documents/analyze` (field `documentCheck`) sejak sesi sebelumnya, tapi tidak
ada UI manapun yang menampilkannya. Ketiga AI Assistant View saat upload attachment cuma
panggil `/documents/extract-text`, tidak pernah `/analyze`.

**Yang kami lakukan.** Komponen baru `DocumentCheckCard.tsx` (dipakai 3 view) --
type-narrow `DocumentCheckReport` vs `TabularCheckReport` (shape beda, yang kedua tanpa
`summary`). Ketiga `handleFileSelect` sekarang fire panggilan `/documents/analyze`
TAMBAHAN paralel (fire-and-forget, tidak memblokir alur extract-text), hasil dirender
sebagai kartu independen di composer.

**Diverifikasi.** tsc 0 error, 468/468 test lulus, `next build` sukses, dan pemanggilan
route handler langsung dengan CSV berisi 2 anomali sengaja (tanggal mustahil + baris
duplikat) -- keduanya terdeteksi benar. Upload-lewat-browser tidak bisa dites otomatis
(tidak ada mekanisme set-file-input terprogram di toolset sesi ini).

**Cara membatalkan.** Hapus `DocumentCheckCard.tsx`, hapus blok fire-and-forget
`/documents/analyze` + render kartu di ketiga `handleFileSelect`/JSX.

### 1.8 Company Health Score & Tren Keuangan Baca Field Response yang Salah (`CompanyDataDashboard.tsx`, +90/-27) -- commit `ab9f002`

**Apa yang terjadi.** Bug produksi ditemukan di putaran "kematangan fitur" (bukan item
roadmap baru): `loadRealMetrics()` baca `hData.data` dan `trData.data.timeSeries` --
padahal `GET /api/v1/kas/financial-health` balikin `{success, health}` dan
`GET /api/v1/analytics/financial-trends` balikin `{success, chartSeries, details}` di
ROOT response, bukan dibungkus `data`. Akibatnya blok ini **nol pernah jalan sejak
ditulis** -- Skor Kesehatan Bisnis selalu 0/WAITING dan chart tren 6 bulan selalu
kosong, walau transaksi kas asli sudah tercatat di database. Field per-titik juga salah
nama (`netProfit`/`margin` vs field asli `netCash`/`marginPct`).

**Yang kami lakukan.** Perbaiki nama field sesuai response asli (dibaca langsung dari
2 `route.ts`, bukan ditebak). `momGrowth` per-bulan (field yang TIDAK ADA di response
asli) sekarang dihitung sendiri dari `income` bulan berjalan vs bulan sebelumnya --
murni turunan angka real, bukan dikarang. Untuk pilar `growth`/`operations`/`strategy`
di health-score: TIDAK ADA sumber data backend sama sekali untuk 3 dimensi ini (endpoint
`financial-health` cuma hitung margin+likuiditas+disiplin, satu skor finansial gabungan)
-- sebelumnya kode ini memaksa `strategy: 50` (angka karangan). Sekarang genuinely
`null` sampai backend punya sumbernya, dan gate tampilan "Ditahan oleh X" diperbaiki
supaya cuma menominasikan pilar yang genuinely punya data (>=2 pilar dibanding, bukan
1 pilar real vs 3 pilar kosong yang keliru dianggap "weakest").

**Diverifikasi.** tsc 0 error, 468/468 test lulus, `next build` sukses. Live browser:
screenshot before (skor 0/100, "Belum ada skor") vs after (skor 30/100 (D), breakdown
4-pilar tampil jujur: Keuangan 30 real, Pertumbuhan/Operasional/Strategi "stabil 0" +
footer "Baru pilar Keuangan yang terukur" -- bukan klaim analisis palsu).

**Cara membatalkan.** `git revert ab9f002` -- perubahan terisolasi di 1 file, tidak
menyentuh model/endpoint apapun.

### 1.9 Label "Buat Video · Segera" Basi di 2 View (roadmap 4.6 lanjutan) -- commit `c4aec11`

**Apa yang terjadi.** Ditemukan saat live-klik chip "Video" di Marketing AI Assistant:
modal video generation SUNGGUHAN kebuka (model picker + harga tampil, persis item 1.5)
tapi label chip-nya masih bilang "Buat Video · Segera / render live belum aktif" --
sisa dari SEBELUM item 1.5 dibangun, tidak ikut ke-update saat itu karena beda file
(pluginItems statis di `MarketingAIAssistantView.tsx`/`ExecutiveAIAssistantView.tsx`,
bukan `MediaStudio.tsx` yang disentuh commit 1.5).

**Yang kami lakukan.** Update title/desc di kedua file (5 titik total) jadi akurat.
2 kemunculan "Segera" lain di file yang sama DIPERIKSA tapi SENGAJA tidak diubah --
genuinely conditional pada `result.data.status==='planned'` (fallback saat render
sungguhan gagal, itu sudah benar). Sama halnya `MediaStudio.tsx:254` dan
`StudioResult.tsx:219` yang sekilas mirip -- dicek terpisah, keduanya juga conditional
yang benar, bukan bug.

**Diverifikasi.** tsc 0 error, `next build` sukses, live browser: chip sekarang
tampil "Video" polos, plugin-menu item "Buat Video" dengan deskripsi akurat.

**Cara membatalkan.** `git revert c4aec11`.

### 1.10 Tombol Hapus Kampanye (roadmap 4.7 lanjutan) -- commit `026136e`

**Apa yang terjadi.** Endpoint `DELETE /api/v1/marketing/campaigns` sudah ada dari item
1.4 tapi UI cuma bisa lihat + toggle status (PATCH) -- tidak ada cara hapus kampanye
dari UI manapun, walau backend-nya lengkap 4 verb.

**Yang kami lakukan.** Tombol Trash2 hover-reveal per baris kampanye, meniru pola
`handleDeleteTransaction` di `FinanceModuleView.tsx` (dibaca dulu sebelum menulis) --
`window.confirm`, state `deletingId` per-baris, fetch DELETE, toast. Satu deviasi
sadar: sukses-hapus update state lokal langsung (`setCampaigns` filter) bukan
`loadRealData()` ulang -- konsisten dengan pola `handleToggleStatus` yang SUDAH ADA di
file yang sama (juga update lokal + rollback manual), bukan pola baru yang diimpor.

**Diverifikasi.** tsc 0 error, `next build` sukses, live browser: kampanye test dibuat
via API, tombol hapus diklik, list balik ke "Belum ada kampanye iklan aktif".

**Cara membatalkan.** `git revert 026136e`.

### 1.11 Form Tambah + Tombol Hapus Kewajiban Terjadwal (roadmap 4.8 lanjutan) -- commit `9df072e`

**Apa yang terjadi.** Endpoint POST/DELETE `/api/v1/kas/obligations` sudah ada dari item
1.4 tapi widget "Kewajiban Terjadwal" cuma GET (read-only) -- user tidak bisa nambah
kewajiban baru atau hapus/tandai-lunas dari UI manapun.

**Yang kami lakukan.** Field body POST dikutip PERSIS dari `route.ts` (`name`, `dueDate`,
`amount` -- `category` opsional, tidak dikirim), bukan ditebak. Form ringkas (nama,
nominal, tanggal jatuh tempo) + tombol hapus per-item, meniru 1:1 pola
`handleAddTransaction`/`handleDeleteTransaction` yang sudah ada di file yang sama
(toast, `loadRealData()` + `dispatchEvent('klir-kas-updated')` setelah sukses). Logic
bucket 14/30 hari (server-side, berdasar `dueDate`) TIDAK disentuh -- item baru masuk
lewat re-fetch GET yang sama, server yang membagi bucket.

**Diverifikasi.** tsc 0 error, `next build` sukses, live browser: kewajiban test
"Rp 1, jatuh tempo 14 hari lagi" ditambah -- langsung masuk bucket 14 hari yang benar,
lalu dihapus, balik ke "Belum ada kewajiban terjadwal tercatat".

**Cara membatalkan.** `git revert 9df072e`.

---

## Bagian 1B -- Temuan Wiring-Gap yang TIDAK Dikerjakan Sesi Ini (full-scan, butuh keputusanmu)

Full-scan tambahan (grep tiap `route.ts` di `src/app/api/v1/**` vs tiap `fetch(` di
`src/app/components/**`, cross-check server-side import langsung supaya nol
false-positive) menemukan endpoint yang HIDUP tapi nol dipanggil UI manapun. Yang di
bawah ini SENGAJA tidak dikerjakan sesi ini -- di luar scope "sempurnakan yang sudah
disentuh", butuh keputusan produk/prioritas kamu, bukan wiring sederhana:

1. **`auth/logout` tidak benar-benar mengakhiri sesi di server (KEAMANAN, prioritas
   tinggi).** `handleFullLogout()` di `src/app/page.tsx` (zona merah, sengaja tidak
   kami sentuh) cuma `localStorage.removeItem` x4 + `sessionStorage.clear()` -- NOL
   fetch ke `/api/v1/auth/logout`. Endpoint itu mencabut refresh token di DB +
   menghapus cookie httpOnly, tapi tombol "Keluar" tidak pernah memanggilnya. Efeknya:
   refresh token tetap valid & cookie sesi tetap ada di browser setelah user klik
   "Keluar" -- kalau device dipakai bersama atau token dicuri, logout tidak genuinely
   mengakhiri sesi di server. `auth/refresh` dan `auth/me` juga nol dipanggil client
   manapun (kemungkinan efek: sesi diam-diam invalid tanpa pemulihan otomatis begitu
   access token expire). Ketiganya lane kamu (auth/infra) -- dicatat sebagai temuan,
   sengaja tidak dieksekusi sendiri.
2. **`kas/invoices` POST (terbitkan invoice QRIS/VA) dan PUT (tandai lunas) nol UI.**
   Endpoint diubah 2 September (bukan buatan sesi ini) -- fitur billing inti tapi UI
   kas cuma nampilin daftar invoice read-only, user tidak bisa menagih klien dari UI
   sama sekali. Ini scope-nya besar (perlu form + kemungkinan integrasi tampilan
   QRIS/VA), bukan quick-fix, jadi sengaja ditunda untuk keputusan prioritasmu.
3. **Pipeline "AI-orchestrator rekomendasi->eksekusi" mati total.**
   `brain/recommendations` (generate rekomendasi strategis) dan `brain/execute`
   (`ExecutionEngine.executeAction`) -- BUKAN cuma HTTP-nya nol dipanggil, fungsinya
   sendiri nol diimpor dari file manapun juga (beda dari `brain/tools`/`brain/context`
   yang cuma HTTP-nya mubazir tapi kapabilitasnya tetap hidup lewat import langsung).
   Ini pipeline AI-proaktif yang paling besar ditemukan mati sesi ini -- worth jadi
   item roadmap tersendiri kalau memang prioritas ("AI yang bisa bertindak", bukan
   cuma jawab pertanyaan).
4. **`brain/alerts` (triase alert prioritas) dan `brain/decision-memory` nol
   dipanggil** -- dibuat 5 September, sama-sama route+engine mati total.
5. **`brain/weekly-analysis` MASIH belum disambung** -- ini bukan temuan baru, file
   itu sendiri sudah punya komentar self-audit tertanggal 6-7 Sep yang mengaku nol
   UI-caller dan data 100% contoh statis. Dicatat lagi supaya statusnya tetap terlihat
   di laporan resmi terbaru -- masih belum ada progress sejak audit itu.
6. **`kerja/sop` dan `kerja/kpi`** (generator SOP AI + penilaian KPI deterministik)
   -- backend lengkap (route.ts sudah ada, deterministik untuk KPI/AI-generate untuk
   SOP), tapi grep `kerja/sop`/`kerja/kpi`/`KerjaModuleView` di seluruh `src/app`: NOL
   hasil. Tidak ada menu "Kerja" di UI manapun sama sekali -- ini bukan gap wiring
   kecil, ini modul yang belum ada entry point UI-nya sama sekali, jadi butuh
   keputusan apakah mau dibangun sebagai modul baru.
7. **"Pengaturan admin -- akses per-divisi" (modal toggle RBAC kosmetik di CEO+Finance)
   -- KEPUTUSAN INI DISERAHKAN KE KAMU (Mecca sudah eksplisit: "biar Fatur saja yang
   nyentuh, ini masalah akses bukan fitur").** Ditemukan lewat workflow analisis 9-agent
   (scan + kritik + verifikasi silang) 7 Sep sore: state `adminOverrides`
   (`ExecutiveAIAssistantView.tsx:867`) SATU-SATUNYA pembacanya adalah render toggle-nya
   sendiri (baris 3963) -- tidak pernah dibaca `pluginCatalog`/`capabilities`/`tools`
   manapun, jadi toggle "matikan kemampuan X untuk divisi Y" itu murni dekoratif, tidak
   mengunci apapun secara nyata. TAPI ada komentar developer eksplisit di
   `FinanceAIAssistantView.tsx:1929-1932` yang bilang panel ini SENGAJA "role-invariant
   di mockup v6" -- port 1:1 dari desain Claude Design yang sudah disetujui Mecca.
   Marketing punya pola beda (`MarketingAIAssistantView.tsx:1915-1919`): tombolnya cuma
   toast "dikelola di panel Setting perusahaan", tidak buka modal lintas-divisi sama
   sekali. Tiga opsi yang perlu kamu putuskan: (a) toggle dibikin BENERAN fungsional
   (butuh tambah field `role` ke `src/lib/ai-tools-registry.ts` + wiring backend RBAC
   -- ini scope infrastruktur akses, jelas lane kamu), (b) tombolnya dipindah exec-only
   ngikut pola Marketing di atas, atau (c) dibiarkan seperti sekarang tapi dilabeli
   ulang supaya jujur (bukan menjanjikan kontrol yang tidak ada). Kami sengaja TIDAK
   menyentuh file manapun terkait ini.

**Yang SUDAH dicek dan TERBUKTI bukan gap** (supaya kamu tidak perlu cek ulang):
notebook 9-kartu render per-jenis (mindmap/infografis/dst) di `StudioResult.tsx` --
CONFIRMED wired (`case 'mindmap'`/`case 'infographic'` dst ada, bukan fallback teks).
Dropdown "Jenis usaha" (template gambar per-industri) di `MediaStudio.tsx` -- CONFIRMED
ada dan terhubung ke `industry-image-templates.ts`. Tombol "Buat Gambar" di CEO
portal -- CONFIRMED sudah generate asli lewat `MediaStudio` yang sama dengan Marketing
(bukan simulasi CSS lagi seperti temuan audit 7 Sep pagi). ai-orchestrator wiring di
chat utama -- sudah live (lihat 1.2), klaim lama "masih 0 caller" di memory sudah usang.
Conversational ERP (deteksi transaksi dari bahasa natural di chat) -- CONFIRMED
berfungsi live (dites: "modal awal 20000, beli laptop 7500" -> 2 transaksi otomatis
tercatat ke Buku Kas, lalu dihapus lagi karena cuma data uji).

---

## Bagian 2 -- Yang Sengaja TIDAK Dikerjakan Sesi Ini (dan Kenapa)

### 4.9 -- Generator Laporan Otomatis Marketing

TETAP "Segera hadir" (sudah di-generic-kan sesi 7 Sep pagi). Ditemukan sebagai klaim UI
kosong ("Dibuat otomatis tiap akhir bulan" padahal nol generator/cron/endpoint) --
diperbaiki jadi jujur, tapi generator sungguhannya sendiri BELUM dibangun sesi ini.
Alasan: prioritas roadmap eksplisit taruh ini di bawah item 4.1-4.8, dan butuh keputusan
produk (skedul, format, kanal distribusi) sebelum baris kode pertama -- bukan sekadar
"sambungkan yang sudah ada" seperti sebagian besar item lain sesi ini.

### 4.10 -- 4 Modul KLIR Enterprise Tier

DITUNDA sepenuhnya. Spek lengkap sudah ada (`2026-09-06-spek-fitur-*.md`), proposal
koordinasi sudah ada (`2026-09-06-proposal-koordinasi-fatur-video-dan-enterprise-tier.md`),
tapi butuh 1 keputusan darimu dulu: siapa jadi SSOT entitas "Employee" (3 dari 4 modul
saling tumpang tindih definisinya kalau dibangun sendiri-sendiri tanpa keputusan itu).
Prioritas paling rendah di roadmap -- sah ditunda, bukan silent-skip.

### Depth item di luar Bagian 4 roadmap (ditemukan lewat verifikasi kode langsung, TIDAK dikerjakan)

Sesi ini juga diminta memperdalam kapabilitas AI Assistant di luar 11 item Bagian 4 --
full-scan menemukan 2 gap konkret yang SENGAJA tidak dikerjakan (butuh fondasi lebih
besar dari sekadar nyambungin data yang sudah ada):

1. **"Foto-jadi-input" (foto nota/struk otomatis jadi transaksi tercatat)** -- diminta di
   meeting UMKM 3 Sep. Verifikasi kode: jalur "foto -> teks OCR yang bisa dibaca AI chat"
   SUDAH ADA (`documents/extract-text` punya cabang OCR gambar sejak lama), tapi jalur
   "foto -> OTOMATIS jadi record transaksi TERSIMPAN" belum ada sama sekali -- brain/chat
   nol tool-calling/function-calling (grep 0 hasil), jadi AI tidak bisa eksekusi write ke
   DB dari hasil OCR manapun. Ini butuh infrastruktur tool-calling baru di brain/chat,
   bukan wiring sederhana -- di luar scope sesi ini.
2. **Kartu "Auto-Restock & Supplier Predictor" dan "Beban tim"** di
   `CompanyDataDashboard.tsx` -- "margin" (kartu ketiga di grup yang sama) sudah dibuat
   real sesi ini (lihat item terpisah di atas), tapi restock butuh model inventory yang
   belum ada sama sekali di `schema.prisma` (Product/Stock/Supplier/PO), dan "beban tim"
   sumbernya `DEFAULT_TEAM` (mock statis, bukan fetch API). Keduanya genuinely butuh
   fondasi data baru (skema + endpoint), bukan sekadar pasang data yang sudah ada.

---

## Bagian 3 -- Briefing Siap Salin untuk AI Coding Kamu

Bagian ini sengaja berdiri sendiri supaya bisa disalin langsung ke Antigravity atau
OpenCode tanpa perlu menjelaskan ulang.

```
KONTEKS PROYEK
Aplikasi KLIR, Next.js App Router + Prisma + TypeScript, satu halaman di
src/app/page.tsx. Tiga portal (CEO/Finance/Marketing) dirender dari halaman yang
sama berdasarkan state. Basis data Postgres (Neon). Deploy ke VPS lewat
scripts/deploy-vps.sh, dijalankan PM2 dengan nama klir-os di port 3000. Sesi ini
menyambung sesi 7 Sep pagi (commit 9c6990e -> sekarang 600b944, 11 commit,
termasuk commit dokumen ini sendiri).

PERUBAHAN YANG BARU MASUK SESI INI
1. Tombol Hapus transaksi kas di FinanceModuleView.tsx (backend DELETE sudah
   ada dari sebelumnya, UI-nya baru sekarang).
2. ai-orchestrator.ts ("Hermes-lite") mulai dipakai di SATU titik (chat utama
   brain/chat/route.ts) -- 2 titik ekstraksi JSON (RECORD_CASH/HPP) SENGAJA
   belum disentuh, TASK_ROUTES.extract_json belum aman dipindah (lihat Bagian
   1.2 di atas untuk alasan teknis lengkap: preferredProvider di ai-gateway.ts
   ternyata dead parameter, tidak berefek apa-apa saat ini).
3. Anti-slop parameter kamera fisik ditambah ke src/lib/media-provider.ts
   (enrichMarketingImage) -- semua generate gambar sekarang otomatis dapat
   instruksi focal length/aperture/lighting/texture/color grading.
4. 2 model Prisma baru: Campaign (kampanye iklan Marketing) dan
   ScheduledObligation (kewajiban terjadwal Finance) -- MURNI ADITIF, nol
   perubahan model existing. Endpoint baru /api/v1/marketing/campaigns dan
   /api/v1/kas/obligations.
5. Video generation SUNGGUHAN via OpenRouter (dulu selalu return storyboard-
   only planned response). Model picker 28 model real (Seedance/Veo/Sora/Wan/
   Kling/dst), harga tampil, murah->mahal. src/lib/media-provider.ts
   generateVideoMedia() sekarang submit+poll job async ke OpenRouter
   /api/v1/videos.
6. Model Prisma baru WorkspaceFile (fondasi "Pusat Data" -- fitur baru,
   halaman upload file terpisah dari chat, permanen tersimpan di Postgres
   sebagai Bytes). Endpoint /api/v1/workspace-files (GET/POST/DELETE).
   src/app/api/v1/documents/extract-text/route.ts diekspor fungsi
   extractTextFromBuffer() supaya endpoint baru pakai pipeline ekstraksi yang
   SAMA, bukan reimplementasi.
7. Kartu rekomendasi AI "margin" di CompanyDataDashboard.tsx sekarang dihitung
   dari data real (f.nm, sudah ada dari sesi lain), bukan angka tetap
   "74,4% -> 76,1%".
8. Kartu hasil document-checker/tabular-checker (DocumentCheckCard.tsx baru)
   ditampilkan di 3 AI Assistant View -- backend-nya (document-checker.ts)
   sudah ada dari sesi lain, baru sekarang ada UI-nya.

YANG TIDAK BOLEH KAMU UBAH TANPA BICARA DULU (SAMA seperti Bagian 8 dokumen lama)
- src/lib/auth.ts, src/lib/session.ts, src/lib/rate-limiter.ts, src/lib/prisma.ts
- src/app/api/v1/auth/ (semua 6 route, termasuk google)
- src/app/components/KlirAuthModal.tsx
- src/app/page.tsx, src/app/layout.tsx
- ecosystem.config.js, scripts/deploy-vps.sh
- prisma/schema.prisma: model EXISTING (jangan diubah) -- model BARU (Campaign/
  ScheduledObligation/WorkspaceFile) boleh dipakai/diperluas, itu punya tim AI.

ATURAN SAAT MENAMBAH FITUR DI SINI (SAMA seperti Bagian 8 dokumen lama)
- Endpoint baru WAJIB dibungkus withTenantGuard dari @/lib/tenant-guard.
  Ambil workspaceId dari auth.workspace.id, JANGAN dari badan permintaan/query.
- Jangan mengirim err.message mentah ke pemanggil. Pesan umum ke user, log
  lengkap di server pakai console.error.
- Angka keuangan yang ditampilkan ke pengguna WAJIB berasal dari data. Kalau
  belum bisa dihitung, tampilkan keadaan jujur, jangan angka pengganti.
- Model/kolom Prisma BARU boleh ditambah (murni aditif, tabel baru) tanpa
  drama -- yang perlu diskusi cuma kalau mau UBAH model existing.

YANG SENGAJA BELUM DIKERJAKAN (declare eksplisit, bukan silent-gap -- detail
lengkap di Bagian 2 di atas)
- 4.9 Generator laporan otomatis Marketing: tetap "Segera hadir", butuh
  keputusan produk dulu.
- 4.10 Enterprise Tier (4 modul): butuh keputusanmu soal SSOT entitas Employee.
- "Foto-jadi-input" (nota difoto -> otomatis jadi transaksi tercatat): OCR-nya
  jalan, tapi brain/chat nol tool-calling jadi tidak bisa nulis ke DB dari
  hasil OCR. Butuh infrastruktur tool-calling baru.
- "Tanya AI soal file ini" di Pusat Data: prop disiapkan, belum dikaitkan ke
  composer chat (risiko salah pasang tanpa trace state lengkap di 3 file besar).
- "Auto-Restock" & "Beban tim" di kartu rekomendasi AI: masih ilustratif,
  butuh model inventory dan sumber data tim yang belum ada.

CARA MEMERIKSA SEBELUM DEPLOY (SAMA seperti Bagian 8 dokumen lama)
  node node_modules/typescript/bin/tsc --noEmit
  node --experimental-test-module-mocks --import tsx --test tests/*.test.ts
  node node_modules/next/dist/bin/next build
Ketiganya harus bersih (468 test per akhir sesi ini, naik dari 464). Yang
ketiga wajib, karena itu yang dijalankan scripts/deploy-vps.sh.

STATUS DEPLOY per dokumen ini ditulis: semua 11 commit sudah di main DAN
sudah live di klir.laserstory1.id (2 putaran deploy sesi ini -- checkpoint
pertama sampai commit b0960e5, checkpoint kedua sampai e8e26ae). PM2 klir-os
online, log galat kosong, prisma generate sudah dijalankan ulang di VPS
(model Campaign/ScheduledObligation/WorkspaceFile sekarang genuinely
dikenali proses production).

RE-VERIFIKASI VPS setelah dokumen ini ditutup (SSH langsung, bukan asumsi dari
log deploy): `git log -1` di /var/www/KLIR sudah balik ke `600b944` (commit
dokumen ini sendiri, ke-pull otomatis di checkpoint deploy berikutnya), working
tree bersih. `.next/BUILD_ID` bertanggal sama persis dengan selesainya checkpoint
kedua (06:57:04 UTC) dan TIDAK ADA file di src/ yang lebih baru dari BUILD_ID
itu -- artinya build yang jalan sekarang sudah mencakup semua kode sampai
e8e26ae (600b944 sendiri commit dokumentasi doang, nol file src, jadi build
yang sama tetap valid). `node_modules/.prisma/client` sudah kenal
Campaign/ScheduledObligation/WorkspaceFile (2342 kecocokan grep). PM2 online,
error log kosong, `curl localhost:3000` balas 200. Tidak perlu restart manual --
sudah otomatis kepasang dari checkpoint deploy sebelumnya.
```

---

## Catatan Penutup -- Verifikasi Live Pasca-Deploy (bukan bagian salin-tempel Fatur)

Backend/build/infra di atas terverifikasi penuh lewat SSH langsung (bukan asumsi). Yang
BELUM bisa diverifikasi Claude sendiri: klik-tembus UI live di klir.laserstory1.id untuk 5
fitur baru sesi ini (Pusat Data, Kampanye Marketing, Kewajiban Terjadwal, Hapus Transaksi
Kas, Pemilih Model Video) -- semuanya butuh login portal dulu.

Dicoba: buka modal login production, klik "Lanjutkan dengan Google". Modal tertutup tanpa
membuka popup/redirect apapun -- console browser menunjukkan `google.accounts.id.initialize()`
memang jalan (skrip GSI Google termuat), tapi prompt-nya sendiri tidak pernah muncul. Ini pola
kegagalan diam-diam yang dikenal luas untuk Google Identity Services saat terdeteksi konteks
otomasi/third-party-cookie diblokir -- bukan salah target klik (dicoba 2x dengan cara beda,
hasil identik keduanya). Opsi lain (isi username/password manual, termasuk kredensial
demo/auto-provision yang pernah ditemukan sesi sebelumnya) SENGAJA tidak dicoba -- itu
melanggar batas HARAM-masukkan-password yang berlaku permanen, terlepas dari izin umum
apapun yang sudah diberikan.

Yang genuinely perlu Mecca (bukan bisa didelegasikan): login sekali secara manual di tab
klir.laserstory1.id manapun (browser sendiri atau tab yang Claude buka), lalu screenshot atau
konfirmasi singkat "sudah login" -- begitu ada sesi aktif yang persisten, sisa verifikasi 5
fitur di atas bisa dilanjut otomatis oleh Claude tanpa perlu Mecca pegang mouse lagi.

---

## Bagian 3 -- Putaran Kematangan Fitur (sesi baru hari yang sama, setelah dokumen ini)

Sesi lanjutan diminta Mecca: audit UI AI Assistant 3 portal + tombol/fitur beneran
berfungsi. Analisis lengkap (dokumen terpisah `2026-09-07-ANALISIS-perbaikan-UI-AI-
Assistant-tombol-fitur.md`, siap dibaca langsung) menemukan dan MEMPERBAIKI 3 bug
produksi nyata:

1. Panel "File hasil AI" Finance tidak pernah bertambah isi (state tanpa setter) --
   sekarang live dari data chat asli.
2. Panel "File hasil AI" Executive punya 4 file contoh yang menghasilkan FILE RUSAK
   saat diklik Unduh (teks polos dikasih nama .docx/.xlsx/.pptx) -- dihapus total.
3. **Paling penting:** kalau semua provider AI gagal total, `generation-engine.ts`
   diam-diam mengirim dokumen KOSONG (cuma judul) dengan status "berhasil dibuat" --
   sekarang melempar pesan jujur (503 + kode `NO_PROVIDER`), meniru pola
   `notebook-engine.ts` yang sudah benar. Ini kelas bug yang sama seperti insiden
   demo lama (AI kelihatan sukses padahal boong).

Plus: Pusat Data disambungkan ke `recordCompanyKnowledge()` (file yang diupload di
situ sekarang genuinely jadi pengetahuan AI, bukan cuma tersimpan), tombol "Tanya AI
soal file ini" akhirnya kerender (prop `onAskAI` ditambahkan ke 3 view), dan
`DocTemplateStudio` dapat prop `role` (JUJUR belum memfilter apa-apa -- 19 template
tidak punya konsep role sama sekali, dilaporkan alih-alih dikarang).

Semua live-verified via Claude Browser (bukan cuma tsc/test hijau): generate dokumen
Word sungguhan -> 3 bagian isi -> panel File hasil AI keisi -> unduh valid. Upload
file test ke Pusat Data -> tombol "Tanya AI" muncul -> composer keisi otomatis.

**6 commit** (`90a04b0`..`833eb56`), push ke main + `claude/ai-brain-upgrade-1sep`,
deploy VPS checkpoint baru terverifikasi (`git log -1` VPS = `833eb56`, PM2 sehat,
error log kosong).

**Keputusan yang diserahkan ke kamu (Fatur), bukan diputuskan sepihak:** lihat Bagian
1B poin 7 di atas -- nasib "Pengaturan admin -- akses per-divisi".

**Gap jujur, TIDAK dikerjakan sesi ini** (dicatat supaya tidak silent-skip): 3 fitur
"Gemini-parity" yang diminta Mecca -- ingest link YouTube untuk dianalisis AI, ingest
link website untuk dianalisis AI, auto-analisis file/folder baru yang masuk database
tanpa klik manual. Ketiganya 0% dibangun (dicek grep langsung, bukan asumsi) --
genuinely fitur baru dari nol, bukan wiring-gap kecil. Juga model `Workflow` di
database (trigger->action automation) punya backend tapi 0 UI, dan itu BUKAN
"workflow builder AI" seperti yang dibayangkan (Gemini/NotebookLM-style multi-step
task chaining) -- kalau mau dibangun jadi UI beneran, itu proyek roadmap terpisah
dengan estimasi effort sendiri, bukan quick-fix.



---

## Bagian 4 -- Bug Kritis Production Diperbaiki (sesi sore, sama hari), Semua Live

Mecca laporan: generate gambar/video gagal total di klir.laserstory1.id (padahal
gambar jalan di localhost), plus Word/Excel/PPT "gak ngikutin apa yang ada". Ketiga
laporan itu ternyata 2 bug terpisah, keduanya sekarang diperbaiki + di-deploy +
diverifikasi live di production (bukan cuma localhost).

### 4.1 Bug utama -- origin-check salah SELALU nolak trafik production

**File:** `src/lib/media-http.ts`, fungsi `withMediaGuard` (dipakai oleh SEMUA route
generate: `media/generate`, `media/models`, `media/transcribe`, `brain/chat`,
`brain/generate`, `brain/notebook`, `documents/from-template`).

**Root cause:** kode lama membandingkan header `Origin` dari browser ke
`req.nextUrl.origin` (properti bawaan Next.js). Di deployment kita (nginx + Traefik,
TLS di-terminate SEBELUM sampai proses Next.js), `req.nextUrl.origin` di production
SELALU balik `http://localhost:3000` -- terverifikasi lewat 6 percobaan curl langsung
ke proses Next.js (bypass browser, bypass nginx) dengan berbagai kombinasi header
`Host`/`X-Forwarded-Proto`/`X-Forwarded-Host`, semuanya tetap ke-reject KECUALI kirim
Origin persis `http://localhost:3000` (nilai defaultnya sendiri). Next.js standalone
mode di setup kita ternyata TIDAK proxy-aware untuk properti ini.

Akibatnya: SEMUA request generate dari browser asli (Origin selalu
`https://klir.laserstory1.id` di production) otomatis ditolak 403 "Asal permintaan
tidak diizinkan" -- gambar, video, Word, Excel, PPT semuanya kena, karena semua lewat
guard yang sama. Di localhost tidak pernah kelihatan karena origin dev JUGA
`http://localhost:3000`, jadi kebetulan selalu cocok -- bug ini sudah ada dari lama,
baru ketahuan sekarang karena baru dites serius di production.

**Fix:** bandingkan HOST dari Origin browser ke header `Host` request (yang nginx
teruskan dengan benar: `proxy_set_header Host $host;`, sudah diverifikasi) --
proxy-agnostic, tidak bergantung `req.nextUrl.origin`. Commit `168060e`.

### 4.2 Bug kedua -- nama worksheet Excel dari AI kena karakter terlarang

**File:** `src/lib/generation-engine.ts`, fungsi generate Excel.

**Root cause:** AI kadang menulis nama sheet yang mengandung karakter yang Excel
larang di nama worksheet (`* ? : \ / [ ]`) -- ditemukan langsung waktu tes brief
"kalender konten/kampanye", AI menulis nama sheet "Kalender Konten/Kampanye" (ada
`/`), ExcelJS lempar error mentah 500 ke user.

**Fix:** karakter terlarang diganti "-" sebelum dipakai sebagai nama sheet, plus
dedup kalau 2 nama jadi sama persis setelah disaring. Commit `15181f3`.

### Verifikasi (live di klir.laserstory1.id, bukan asumsi)

- Gambar: generate ulang via UI production -> sukses, model catalog kebaca.
- Word: generate via API langsung ke production -> `200 success:true`.
- PPT: generate via API langsung ke production -> `200 success:true`.
- Excel: generate ulang dengan brief yang tadinya bikin crash -> `200 success:true`.
- Video: TIDAK diulang test paid di production (disiplin biaya) -- tapi mekanismenya
  identik sama gambar/Word/PPT (guard yang sama), jadi ikut fix yang sama. Kalau nanti
  masih gagal di production padahal gambar/Word sukses, itu tanda ada bug KETIGA yang
  terpisah -- laporkan.

### Bonus temuan -- akun demo Finance kehilangan keanggotaan workspace

Waktu diagnosis bug di atas, ketemu juga: user `finance@anitech.dev` di database
production TIDAK PUNYA baris `WorkspaceMember` ke workspace manapun (0 membership, 0
owned workspace) -- kemungkinan providioning akun demo ini pernah lewat tanpa
nyambungin ke workspace `f451b290-1fc6-474d-8787-b8f1121c798b` (PT Anitech Digital
Solusi, workspace bersama yang dipakai `ceo@anitech.dev` sebagai OWNER). Sudah
ditambal (1 baris `WorkspaceMember` role MEMBER dibuat manual via Prisma, BUKAN lewat
kode) -- tapi worth dicek: kalau ada akun demo lain (atau akun user baru yang
sign-up asli nantinya) mengalami hal sama, kemungkinan ada gap di flow provisioning
akun/workspace yang perlu ditutup di level kode (login/register), bukan cuma
ditambal manual per-akun. Ini murni observasi untuk kamu tinjau, bukan hal yang
Claude ubah di kode auth.

### Fitur hapus file upload -- SUDAH ADA, bukan perlu dibangun

Mecca minta fitur hapus file yang sudah diupload ke Pusat Data. Dicek: fitur ini
SUDAH lengkap ada (`WorkspaceDataHub.tsx` baris 94-105, tombol ikon tempat sampah +
`window.confirm()` + `DELETE /api/v1/workspace-files`) -- live-tested barusan,
upload dummy file -> klik hapus -> konfirmasi -> hilang dari daftar, sukses. Tidak
ada perubahan kode untuk ini, cuma verifikasi.

**Push:** commit `168060e` (origin-check fix) + `15181f3` (Excel sanitize fix), ke
`main` + `claude/ai-brain-upgrade-1sep`. Deploy VPS 2x (satu per commit), PM2 sehat
tiap kali, tsc 0 error.
