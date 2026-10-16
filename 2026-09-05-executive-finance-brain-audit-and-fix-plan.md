# KLIR — Audit AI Brain (Executive/Finance) + Rencana Perbaikan

Tanggal: 5 September 2026 (siang-sore). Ditulis Claude Code (Sonnet 5), atas instruksi
Mecca: "cek sekali lagi dari bikin dokumen video dll" -> ternyata cakupannya jauh lebih
luas dari dugaan awal. Status: MURNI AUDIT, TIDAK ADA FILE SOURCE YANG DIUBAH sesi ini.
Metodologi: 1 Workflow smart-dispatch (4 pembaca paralel + 4 verifier adversarial, semua
Sonnet eksplisit sesuai aturan baru) + verifikasi manual langsung (baca kode + 1 live
HTTP test read-only) oleh Claude sendiri. Total 163 tool call, 1.35M token audit,
2 klaim scan awal berhasil di-REFUTE verifier (dibuang, bukan diteruskan sebagai fakta).

## RINGKASAN EKSEKUTIF

Fitur "AI Brain" (Word/Excel/PPT/video-storyboard generation + dashboard Executive/
Finance) dibangun 1 September 2026, SEBELUM Codex mulai kerja di Marketing (4-5
September). Belum pernah diaudit sejak itu. Hasilnya: sebagian arsitekturnya BAGUS
(generation-engine.ts genuinely generate file asli, ada guardrail anti-mengarang-angka)
-- tapi ada 2 kelas masalah besar yang jauh lebih serius dari sekadar "dokumen belum
sempurna": **(A) lubang keamanan nyata** dan **(B) banyak elemen UI yang KELIHATAN
jalan tapi sebenarnya palsu/terputus dari backend**, tanpa disclaimer di kebanyakan
kasus.

---

## A. KEAMANAN — PRIORITAS TERTINGGI, LINTAS SEMUA ROLE

Pola akar yang sama di 5 dari ~13 route `api/v1/brain/*`: `workspaceId` diambil dari
BODY REQUEST / header / query (dikontrol penuh pemanggil), dan kalau kosong FALLBACK ke
`prisma.workspace.findFirst()` -- workspace PERTAMA di SELURUH DATABASE, tanpa `where`
apapun. **Nol pengecekan JWT/session/membership.** Ini beda total dari `media-http.ts`
(dipakai Marketing, sudah benar sejak awal + baru diperkuat P8 sesi ini).

| Route | Severity | Bukti |
|---|---|---|
| `brain/generate` (type word/excel/ppt/video-plan; type=image SUDAH aman via withMediaGuard) | **CRITICAL** | Diverifikasi 2x (scan+verify) + 1 live test read-only: `curl` tanpa cookie/token apapun -> HTTP 200, dokumen Word ASLI ke-generate pakai data finansial workspace demo. |
| `brain/chat` (semua intent SELAIN gambar: chat biasa, HPP, nudges, forecast, data-trust) | **CRITICAL** | Root cause SAMA, tapi file BEDA -- perbaiki `brain/generate` TIDAK otomatis memperbaiki ini. |
| `brain/context` | **CRITICAL** | Return FULL business context snapshot (kas, income, expense, health score) ke siapapun. **Import `authenticateTenantRequest` TAPI GAK PERNAH DIPANGGIL** -- kelihatan aman padahal enggak, ini pola paling berbahaya karena menyamar. |
| `brain/simulate` | MAJOR | What-if simulation jalan pakai data finansial REAL workspace manapun, tanpa auth. |
| `brain/execute` (ditemukan Claude sendiri, di luar cakupan 4 kelompok Workflow) | **CRITICAL, PALING PARAH** | `actionType: 'SCALE_MARKETING'` beneran `prisma.promoCoupon.create()` -- **siapapun yang gak login bisa BIKIN KUPON DISKON BENERAN (15%, kuota 150, berlaku 30 hari) buat workspace siapapun**, `approvedBy` default `'CEO / Business Owner'` kalau gak diisi (aksi orang asing tercatat seolah disetujui CEO). TIDAK dites live sesi ini (itu DB write sungguhan, bukan hak Claude ambil tanpa izin) -- tapi kodenya sendiri sudah cukup jelas, tidak perlu dites buat yakin. |
| `brain/execute`, `brain/nudges`, `brain/alerts`, `brain/recommendations`, `brain/decision-memory`, `brain/weekly-analysis`, `brain/data-trust` | belum diverifikasi detail satu-satu (di luar 4 kelompok Workflow) tapi grep konfirmasi ZERO referensi guard apapun di semuanya -- kemungkinan besar pola sama. | Grep: `withMediaGuard\|authenticateTenantRequest\|verifyJwtToken\|extractTokenFromRequest` = 0 match di ke-8 file ini. |

**Belum di-push ke GitHub** jadi belum ada yang kena live -- tapi ini WAJIB jadi item
nomor 1 sebelum push manapun ke depan.

### A-tambahan (ditemukan pas mulai kerjain P0, SEBELUM fix apapun dieksekusi) -- GUARD RESMI-NYA SENDIRI BOCOR

Rencana awal P0 adalah "panggil `authenticateTenantRequest`/`withTenantGuard` dari
`src/lib/tenant-guard.ts` di 10 route yang belum pakai." Pas dicek isi fungsinya
sebelum dipakai (baca penuh, bukan asumsi dari nama) -- **fungsi ini SENDIRI punya
celah yang sama jenisnya**, di `tenant-guard.ts:176`:

```
const isOwner = workspace.ownerId === user.id || user.isSuperAdmin || !token;
```

`|| !token` di ujung situ artinya: **kalau request TIDAK BAWA token sama sekali,
`isOwner` otomatis TRUE.** Baris berikutnya (`if (!isOwner && !membership)`) jadi
SELALU lolos buat pemanggil anonim, apapun workspace yang dia minta. Ditambah baris
96-104: kalau gak ada token, fungsi ini fallback ke `prisma.user.findFirst()` (user
PERTAMA di DB, seringkali superadmin) alih-alih menolak. `credits/route.ts` (satu
dari cuma 2 pemakai fungsi ini di seluruh codebase) SUDAH memanggil fungsi ini
dengan cara yang "benar" (`authenticateTenantRequest(req, {requiredWorkspaceId})`)
-- **dan TETAP kena celah yang sama**, karena masalahnya di dalam fungsi, bukan di
cara manggilnya.

**Implikasi:** Menyambungkan 10 route brain/* ke fungsi ini (rencana P0 awal) akan
menyamakan level proteksinya dengan sisa aplikasi -- itu progress nyata (dari "nol
guard sama sekali" ke "guard yang sama dipakai `credits/route.ts`") -- TAPI TIDAK
menutup total lubangnya, karena fungsinya sendiri masih bisa ditembus tanpa token.

**Kenapa TIDAK Claude perbaiki langsung sekarang:** `tenant-guard.ts` (sama seperti
`auth.ts`) sudah eksplisit ditandai "sengaja tidak disentuh" di guardrail handoff
sejak awal (bagian "Source yang sengaja tidak disentuh" di `2026-09-04-codex-
handoff.md`) -- ini file inti autentikasi lintas-aplikasi, bukan satu route/fitur.
Perbaikannya sendiri KECIL secara teknis (hapus `|| !token`, tambah pengecekan
"token wajib ada" eksplisit di awal fungsi) -- tapi KEPUTUSAN untuk mengubahnya
sebaiknya eksplisit dari Mecca/Fatur, bukan diam-diam oleh AI manapun, karena file
ini dipakai di banyak tempat dan efek sampingnya lintas-fitur.

**Rekomendasi:** P0 tetap jalan (sambungkan 10 route ke guard yang ADA, lebih baik
daripada nol), TAPI declare eksplisit ke Mecca bahwa ini "guard tahap 1" bukan "sudah
100% aman" -- perbaikan fungsi `tenant-guard.ts` sendiri jadi item terpisah yang
butuh keputusan/approval eksplisit sebelum disentuh AI manapun.

---

## B. FITUR YANG KELIHATAN JALAN TAPI SEBENARNYA PALSU/TERPUTUS

### B1. Download file korup (kelas bug yang SAMA PERSIS dengan yang sudah diperbaiki di Marketing P1-P9, tapi di sini belum)

- **Executive** (`ExecutiveAIAssistantView.tsx:873-898,1101-1126,3431-3439`): 4 file
  "seed" (Proposal.docx/Laporan.xlsx/Presentasi.pptx/+1) TIDAK punya `fileBase64` asli
  -- tombol "Unduh ulang" tetap kasih nama file `.docx`/`.xlsx`/`.pptx` tapi isinya teks
  polos. Buka di Word/Excel/PowerPoint = **file korup**. Komentar kode di sekitarnya
  bahkan sudah dokumentasiin fix yang sama untuk file BARU -- data seed lama kelewat.
- **Finance** (`FinanceAIAssistantView.tsx:373-378,409-424,2678-2686`): pola identik,
  3 dari 4 file seed bakal korup kalau dibuka.

### B2. Kartu media palsu tanpa disclaimer (Executive)

- `detectMedia()` cuma keyword-matching di teks user, dipanggil TERLEPAS dari backend
  beneran berhasil atau gagal. `styleArt()` (untuk kartu "gambar") murni CSS gradient --
  komentar kode sendiri ngaku "stylized art-direction placeholder", **TAPI pengakuan itu
  cuma ada di komentar kode, TIDAK PERNAH muncul di UI yang dilihat user**.
- Video LEBIH PARAH: `ChatMessage` interface bahkan gak punya field `realVideo` --
  artinya SETIAP prompt yang memicu kata "video" SELALU nampilin storyboard palsu
  statis, dan tombol "Unduh video" SELALU download teks storyboard yang sama, gak
  peduli apa isi prompt user.
- Kartu poster dilabeli teks "PNG" tapi tombol Unduh-nya kasih file `.txt` isinya
  spesifikasi teks, bukan gambar.

### B3. Dashboard KPI campur data-asli dan data-karangan, tanpa beda visual (Executive + Finance)

- Executive: KPI cards TIDAK PERNAH manggil `getOrBuildBusinessContext` (0 match
  di seluruh file) -- sumbernya cuma `localStorage` basi + angka hardcode fallback
  (92 / 3.1 / 25.500.000). Terputus total dari upgrade AI Brain 1 September.
- Finance: mayoritas widget (`stats`, skor kesehatan 88, `dataSources`,
  `divisionLoad`, runway 99 bulan) adalah **konstanta tetap**, ditulis di kode,
  TIDAK PERNAH di-fetch -- tapi label di sampingnya secara harfiah bilang "dari
  dashboard" dan "tersambung langsung". Padahal PERSIS di panel sebelahnya
  ("Rekomendasi siap dieksekusi") ADA data yang genuinely live dari
  `klir_live_company_state`. Satu layar, campur data asli+karangan, user gak bisa
  bedain mana yang mana.

### B4. Tombol "eksekusi aksi AI" nulis angka karangan yang SAMA setiap kali (client-side, paralel sama temuan `brain/execute` di atas)

- Executive: `handleCardExecution()` -- klik "Terapkan & Update ke Dashboard" SELALU
  nulis SATU set angka hardcode per jenis kartu (mis. `SCALE_ADS` selalu nulis
  `blendedRoas: 3.5`, `RESOLVE_INVOICE` selalu nulis `netCashBalance: 44.925.000`
  BERAPAPUN nominal invoice aslinya), lalu nge-tandain status "EXECUTED" jam "baru
  saja" -- padahal gak ada perhitungan nyata sama sekali buat kasus spesifik user.
- Finance: `TAX_PROJECTION` malah nulis field yang SALAH TOTAL -- niatnya "catat
  alokasi pajak", yang kejadian: nge-overwrite `healthScore` jadi angka tetap
  (92/EXCELLENT), gak ada hubungannya sama pajak sama sekali.

### B5. Proyeksi Pajak PPh/PPN -- FITUR YANG SEBELUMNYA MECCA MINTA DIPERTAHANKAN, TERNYATA 100% PALSU

Ini penting: sesi sebelumnya Mecca eksplisit minta fitur proyeksi pajak DIPERTAHANKAN
(bukan dihapus). Audit ini nemuin: **gak ada satupun modul kalkulasi pajak di
`src/lib/` manapun** (grep `pph|ppn|calculateTax|pajak` = 0 match). Jawaban "proyeksi
pajak" yang muncul di chat Finance adalah angka STATIS hardcode (DPP Rp 34.250.000,
0,5%, Rp 171.250, "Agustus 2026" -- SELALU sama, gak peduli tanggal/data beneran) yang
dirender lewat pipeline yang PERSIS SAMA dengan jawaban AI asli -- user TIDAK BISA
membedakan mana yang genuinely dihitung AI dan mana yang cuma teks tetap. Ini fitur
yang harus DIBANGUN dari nol, bukan "diperbaiki" -- statusnya bukan bug kecil.

### B6. Panel toggle admin RBAC -- overclaim lebih halus dari yang kelihatan

Sudah ada disclaimer di UI ("baru mengubah state di sesi ini saja, belum terhubung ke
backend") -- TAPI disclaimer itu SENDIRI berlebihan: toggle-nya bahkan gak mengubah
apapun DALAM sesi yang sama (badge kunci di sidebar dihitung dari `Set` statis yang
gak pernah baca state toggle-nya).

---

## C. BUG DETEKSI-NIAT (intent router) -- DAMPAK BIAYA & TRUST

`detectGenerationIntent()` (generation-engine.ts) dan `detectMediaIntent()`
(media-intent.ts, file yang BENERAN dipakai jalur gambar live) sama-sama regex
sederhana tanpa batas kata yang lengkap dan tanpa deteksi negasi:

- **Trigger padahal cuma pertanyaan**: "laporan ini buat siapa ya, tolong cek ulang
  datanya" -> terdeteksi 'word' -> generate dokumen ASLI + BERBAYAR padahal user cuma
  nanya.
- **Salah jenis**: "buatkan video presentasi produk untuk investor" -> jadi 'ppt',
  bukan 'video-plan' (urutan pengecekan regex ppt duluan sebelum video).
- **Gak kedetect sama sekali**: "bisa dibuatkan proposal kerjasama gak?" -> null (kata
  "dibuatkan" gak ke-cover pola kata kerja) -> user gak dapat apa-apa, gak ada
  penjelasan kenapa.
- **PALING SERIUS -- negasi diabaikan**: "jangan buatin dokumen dulu ya, aku belum
  yakin" -> TETAP terdeteksi 'word' -> **generate dokumen beneran DIBUATKAN
  meskipun user eksplisit bilang JANGAN DULU.** ini nyentuh biaya nyata (API call
  berbayar) dijalankan berlawanan sama instruksi user.
- Bug yang sama utk "dibuatkan" ada juga di `media-intent.ts` (jalur gambar LIVE,
  bukan cuma di file generation-engine yang ternyata dead-code dari sisi chat).

---

## D. MINOR / CATATAN ARSITEKTUR

- `templateId` dikirim dari client tapi gak pernah benar-benar dipakai milih template
  spesifik (`findTemplate` cuma cocokkan role+type, abaikan id).
- Jalur gambar `brain/generate` dan `media/generate` TERNYATA memang satu implementasi
  yang sama (`generateImage()` di ai-gateway.ts cuma passthrough ke
  `media-provider.ts`) -- klaim awal "dua implementasi terpisah" sudah di-REFUTE
  verifier, jangan dipakai lagi.
- `buildContextSnippet()` (dipakai document-gen) cuma baca `ctx.financials` -- gak
  pernah baca marketing/operations/strategy, padahal jawaban chat teks BIASA (di file
  yang sama) sudah pakai semua field itu. Dokumen yang di-generate bisa bilang "gak ada
  data operasional" padahal ada campaign/task aktif -- cuma gak kebaca dari sisi
  document-generator.
- Tombol quick-action "Laporan PDF siap kirim" (Finance) generate 'word' karena
  `GenerationType` gak punya varian 'pdf' -- silent mismatch, no error.

---

## RENCANA PERBAIKAN -- pembagian Fable 5.1 (Claude) + Astra 6 (Codex)

Prioritas ditentukan dari severity di atas, BUKAN urutan alfabet. Semua fix WAJIB
lewat pola yang sama dengan P1-P9 kemarin: build per-kelompok file disjoint + verify
adversarial + integration gate (tsc/unit/build) sebelum dianggap selesai, TIDAK ADA
push tanpa arahan eksplisit Mecca.

### LANE FABLE 5.1 (Claude) -- Executive/Finance sudah lane Claude dari awal

**P0 (harus sebelum apapun lain, termasuk sebelum push manapun):**
1. Pasang guard auth (pola sama `withMediaGuard`/`authenticateTenantRequest` yang
   SUDAH ada di codebase, tinggal dipanggil beneran) ke: `brain/generate` (4 tipe
   non-image), `brain/chat` (semua intent non-gambar), `brain/context`,
   `brain/simulate`, `brain/execute`, dan verifikasi 7 route brain/* lain
   (nudges/alerts/recommendations/decision-memory/weekly-analysis/data-trust) satu-
   satu -- jangan asumsikan dari pola, baca tiap file.
2. `brain/execute` case `SCALE_MARKETING`: minimal tambah guard yang sama +
   pertimbangkan apakah `promoCoupon.create` butuh approval eksplisit tambahan
   (bukan cuma auth) sebelum nulis DB -- ini keputusan bisnis, bukan cuma teknis,
   TANYA Mecca/Fatur kalau ragu approval-flow yang benar seperti apa.

**P1:**
3. Fix download-file-korup di Executive + Finance (pola fix yang SAMA yang sudah
   dipakai buat file BARU di file yang sama -- tinggal terapin juga ke data seed).
4. Buang/beri disclaimer jujur ke SEMUA kartu media palsu (image/video/poster) di
   Executive -- baik hapus fitur simulasi ini, atau kasih label eksplisit "pratinjau
   ilustratif, bukan hasil AI sungguhan" yang KELIHATAN di UI (bukan cuma komentar
   kode).
5. Rekonsiliasi KPI dashboard Executive+Finance ke `getOrBuildBusinessContext` yang
   sama dipakai teks chat -- atau at least kasih label jelas per widget mana yang
   live vs mana yang belum (jangan biarkan bercampur tanpa tanda).
6. Fix `handleCardExecution`/aksi client agar nulis angka yang genuinely dihitung dari
   skenario user, bukan angka tetap per jenis kartu.

**P2:**
7. Bangun modul kalkulasi PPh/PPN yang genuinely real (atau, kalau scope-nya besar,
   declare eksplisit ke Mecca "belum ada, butuh dibangun dari nol" dan kasih
   estimasi -- JANGAN biarkan tetap jadi angka statis yang menyamar).
8. Perbaiki `detectGenerationIntent`/`detectMediaIntent`: tambah negasi ("jangan",
   "gausah", "belum") sebagai penolak, tambah pola kata berimbuhan ("dibuatkan"),
   perbaiki urutan cek ppt-vs-video biar gak salah jenis.
9. Minor: `templateId` benerin biar genuinely dipakai, `ctx.financials`-only jadi
   full context, RBAC-toggle-overclaim disclaimer diperjelas atau tombolnya
   genuinely diwiring.

### LANE ASTRA 6 (Codex) -- verifikasi silang Marketing, BUKAN duplikat kerjaan Claude

Marketing SUDAH diperbaiki (P1-P9) sesi ini dengan pola fix berbeda dari yang di atas
(Marketing pakai `media-provider.ts`, terpisah dari `generation-engine.ts`). Tapi
kelas bug yang BARU ditemukan di sini (file-korup, kartu-palsu-tanpa-disclaimer,
angka-eksekusi-hardcode) BELUM pernah dicek khusus di Marketing dengan lensa yang
sama. Astra 6 tolong:
1. Cek `MarketingAIAssistantView.tsx` + `StudioResult.tsx`/`MediaStudio.tsx` --
   apakah ada pola download-file-korup yang sama (kemungkinan kecil karena
   arsitekturnya beda, tapi WAJIB dicek, jangan diasumsikan aman).
2. Cek apakah Marketing punya kartu "aksi AI" serupa `handleCardExecution` yang
   nulis angka hardcode -- kalau ada, pola fixnya harus konsisten sama yang
   diterapkan Fable di Executive/Finance.
3. Setelah lane Fable selesai P0 (auth guard), bantu jalankan integration-gate
   ulang (tsc+unit+build) buat pastikan fix Fable gak nabrak jalur Marketing yang
   sama-sama pakai `ai-gateway.ts`/`executeAIRequest` (P1 kemarin).

### TIDAK termasuk lane manapun sampai ada arahan Mecca

- Keputusan bisnis soal `brain/execute` (approval-flow buat aksi yang nulis DB
  seperti bikin kupon) -- itu keputusan produk/kebijakan, bukan pure-teknis.
- Keputusan scope modul pajak PPh/PPN (bangun beneran vs sementara di-disable
  dengan disclaimer jujur sampai ada waktu bangun yang benar).

---

## Evidence trail

Audit dijalankan via Workflow `klir-docgen-video-executive-finance-audit`
(8 agent: 4 scan + 4 verify, semua `model:'sonnet'` eksplisit per aturan smart-dispatch
terbaru, total 1.346.992 token, 163 tool call). 2 klaim dari fase scan berhasil
di-REFUTE fase verify (klaim rate-limit 2x gabungan yang salah mekanisme, klaim "dua
implementasi gambar independen" yang overstated) -- dibuang dari laporan ini, tidak
diteruskan sebagai fakta. Temuan `brain/execute` (SCALE_MARKETING/promoCoupon) DAN 1
live HTTP test read-only (`brain/generate` tanpa auth) dilakukan manual oleh Claude
di luar cakupan 4 kelompok Workflow, sebagai pelengkap.
