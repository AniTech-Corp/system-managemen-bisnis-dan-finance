# Roadmap Sesi Depan: Integrasi Penuh A-Z KLIR

Ditulis: 7 September 2026, sore, di akhir sesi maraton (dini hari-siang-sore, 3
putaran kerja: keamanan+otak-AI, kesesuaian peran, peta status fitur). Sesi ini
DITUTUP setelah dokumen ini selesai, atas instruksi eksplisit Mecca. Dokumen ini
adalah kontrak eksekusi untuk SESI BARU (fresh context) yang akan membereskan
semuanya sampai tuntas.

**Instruksi Mecca verbatim yang membentuk dokumen ini (jangan disimpangi):**
- "full scan semuanya yang di sesi ini yang belum, bahkan yang dari sesi-sesi
  kemarin juga" -- lintas SEMUA AI (Fable 5.1, GPT-5/Astra 6/Codex, Gemini 3.8
  Flash/Antigravity), bukan cuma kerjaan Claude Code.
- "bukan cuma harus works doang... beneran jalan, beneran bisa, beneran bisa
  dipakai... bukan hanya sekedar memberikan jawaban, tapi memberikan
  pemahaman, pengetahuan sesuai apa yang user butuhkan" -- standar "selesai"
  dinaikkan, lihat Bagian 3.
- "yang penting saya mau semuanya tuh sudah terintegrasi, sudah lengkap...
  meskipun belum sempurna yang penting lengkap dulu" -- prioritas: SEMUA hadir
  dulu (bukan sempurna), supaya sesi berikutnya bisa bedah satu-satu.
- "paling wajib itu adalah tempat upload data" -- prioritas tertinggi, item
  BARU (bukan dari roadmap lama), lihat Bagian 5.
- "di sesi depan wajib juga untuk tes, kemudian fix, kemudian push... GitHub
  dulu baru finalnya adalah ke Hostinger" -- lihat Bagian 6.
- "pakai Sonnet Ultra code" -- model Sonnet, mode Ultracode (workflow
  multi-agent), lihat Bagian 0.
- "ingat feedback yang saya berikan di sesi ini, sesi-sesi yang lalu, wajib
  semuanya dicerna" -- lihat Bagian 1.
- "nanti itu harus... bisa saya tes secara langsung mau nanti pakai kodeks
  untuk tesnya atau tes manual sendiri" -- lihat Bagian 7.
- "di sesi depan enggak ada lagi nih, oh kenapa belum" -- HARAM ada item di
  Bagian 4 yang masih "belum" di akhir sesi depan tanpa alasan yang SUDAH
  dikomunikasikan DI DEPAN (bukan ditemukan mendadak di tengah/akhir sesi).

---

## Bagian 0 -- Cara Pakai Dokumen Ini

1. Sesi baru WAJIB baca dokumen ini PENUH dulu sebelum baris kode pertama.
2. Model komando: Sonnet. Mode: **Ultracode** -- semua pekerjaan berat di
   dokumen ini dieksekusi lewat Workflow multi-agent (bukan solo), sesuai
   instruksi eksplisit Mecca malam ini. Ikuti aturan yang sudah mapan sesi
   ini: SATU workflow per fase kerja (bukan dipecah-pecah), fase Verify +
   Anti-halu WAJIB, agent di dalam Workflow eksplisit `model: 'sonnet'`.
3. `git fetch origin` + `git log --oneline -5` DULU sebelum mulai apapun --
   cek apakah Fatur sudah push lagi sejak dokumen ini ditulis (commit
   terakhir yang diketahui: `5441b3f` di `main` DAN `claude/ai-brain-upgrade-
   1sep`, sama persis, sudah termasuk 2 handoff doc Fatur).
4. Baca dulu `2026-09-07-untuk-fatur-apa-yang-kami-ubah-dan-kenapa.md` (root
   repo `klir-repo-clone`) Bagian 9 -- itu SUMBER data status fitur paling
   baru per 7 September siang, dokumen ini menyusun ULANG isinya jadi daftar
   tugas, bukan mengulang riset dari nol.
5. Jangan percaya status "sudah/belum terintegrasi" dari memory/dokumen
   manapun (termasuk dokumen ini) tanpa verifikasi ulang ke kode langsung --
   pelajaran keras sesi ini: 2 klaim di roadmap 6 September ternyata sudah
   basi cuma dalam 1 hari (lihat Bagian 9 dokumen Fatur, bagian "KOREKSI").

---

## Bagian 1 -- Feedback yang WAJIB Dicerna Sebelum Mulai

Baca file-file ini dulu (bukan opsional), semuanya di
`Claude-Code-Memory/` kecuali disebutkan lain:

```
feedback_workflow_satu_putaran_temuan_diperbaiki_komando_bukan_rerun.md
  -- SATU kali jalan Workflow per fase kerja berat. Temuan Verify/Anti-halu
  ditambal KOMANDO dengan tangan, BUKAN rerun seluruh gelombang agent.

feedback_ceklis_fitur_bernama_bikin_yang_tak_terdaftar_hilang_diam_diam.md
  -- Kalau bikin ceklis fitur bernama, WAJIB sisir tiap baris `git diff
  origin/main | grep "^-"` biar gak ada fitur pihak lain yang hilang diam-
  diam saat merge.

feedback_klir_backend_minimal_surgical_diff_dont_disrupt_fatur_integration.md
  -- Lane Fatur (auth/session/database/infrastruktur inti) JANGAN disentuh
  tanpa handoff eksplisit. Endpoint baru WAJIB withTenantGuard, ambil
  workspaceId dari auth, BUKAN dari body/query.

feedback_klir_ui_follows_fatur_baseline_additive_ok_no_slop.md
  -- UI ikut baseline Fatur, nambah elemen kecil OK asal gak jadi "AI slop"
  (kualitas visual tetap dijaga meski nambah cepat).

feedback_second_independent_reverify_pass_caught_real_bug.md
  -- Verifikasi ulang pakai "mata" independen (model/agent beda dari yang
  membangun) sebelum declare selesai -- pola ini yang menemukan 30 dari 36
  temuan role-fit sesi ini genuinely benar, bukan asumsi.

feedback_pii_redaction_wrapped_in_example_framing_fails.md
  -- Redaksi data contoh (nama/kontak fiktif) WAJIB dicek nilai literalnya,
  bukan percaya klaim "sudah di-generic-kan" dari laporan sebelumnya --
  temuan wa.me/mailto AKTIF ke identitas lama sesi ini lolos 1 putaran audit
  sebelum ketemu di putaran kedua.

feedback_cek_kepemilikan_file_via_git_sebelum_label_milik_fatur.md
  -- Cek `git log -- file` + `git cat-file -e origin/main:file` SEBELUM
  label berkas manapun "punya Fatur, jangan disentuh" -- 3x insiden salah
  label di sesi-sesi lalu.

feedback_dokumen_formal_haram_gaya_bahasa_ai.md
  -- Dokumen formal (termasuk roadmap dan handoff ke Fatur) HARAM gaya
  bahasa AI (em-dash berlebihan, "furthermore", dst) -- tulis ulang kalau
  ketahuan, bukan regex replace.

Plus WAJIB baca ulang Bagian 3C dan Bagian 9 di
`2026-09-07-untuk-fatur-apa-yang-kami-ubah-dan-kenapa.md` (root repo) --
itu bukan cuma referensi, itu SUMBER PRIMER untuk daftar tugas Bagian 4 di
bawah.
```

---

## Bagian 2 -- Full-Scan Lintas Semua AI: Paket Berdiri Sendiri yang Belum Direkonsiliasi

Selain yang sudah tercatat di roadmap 6 September (fitur NotebookLM 3-versi,
sudah SELESAI direkonsiliasi -- lihat Bagian 4.1), full-scan sore ini
menemukan 2 paket TAMBAHAN yang masih berdiri sendiri, belum pernah
diputuskan statusnya:

```
PAKET                                LOKASI                          STATUS
============================================================================
Antigravity -- Gemini Multimodal      02-KLIR-PUBLIC-PRIVATE/          BERDIRI
Studio & 9-Kartu NotebookLM           2026-09-05-gemini-studio-        SENDIRI,
(5 Sep, Google DeepMind)              evaluation/                     BELUM
  Isi: 9 Zod schema validasi runtime,                                DIPUTUSKAN
  anti-slop visual guardrail (parameter
  optik kamera fisik: focal length,
  aperture, no artificial bloom),
  adapter Gemini REST langsung.
  61/61 test PASS, terisolasi penuh,
  nol sentuh klir-repo-clone.

Codex -- NotebookLM Studio            02-KLIR-PUBLIC-PRIVATE/          BERDIRI
Evaluation (5 Sep, OpenAI)            2026-09-05-codex-notebooklm-     SENDIRI,
                                       studio-evaluation/               BELUM
                                                                        DIPUTUSKAN
```

**Kenapa ini penting:** notebook 9-jenis-kartu di `klir-repo-clone` SENDIRI
sudah live dan lengkap (dikonfirmasi sore ini, lihat Bagian 9 dokumen Fatur)
-- jadi fungsi UTAMA kedua paket ini kemungkinan besar SUDAH TIDAK
DIBUTUHKAN LAGI. Tapi ada 2 komponen di paket Antigravity yang BELUM tentu
ada padanannya di kode aktif dan layak dicek satu-satu sebelum diarsipkan:

```
[ADDITIVE-SAFE, cek dulu baru putuskan]
1. Validasi Zod runtime untuk 9 jenis kartu -- cek apakah notebook-types.ts
   di klir-repo-clone sudah punya validasi runtime (bukan cuma TypeScript
   compile-time interface) sekuat ini. Kalau belum, ini genuinely nilai
   tambah yang layak diadopsi (skema sudah jadi, tinggal port).
2. Anti-slop visual guardrail dengan parameter optik kamera fisik -- cek
   apakah media-intent.ts / prompt builder gambar aktif sudah punya
   instruksi setara (focal length, aperture, larangan bloom artifisial).
   Kalau belum, ini juga nilai tambah konkret untuk kualitas gambar AI.
```

**Tugas sesi depan:** SATU fase Scan (agent baca kedua paket + baca kode
aktif notebook/media prompt yang setara) -> keputusan eksplisit per
komponen (adopsi/arsipkan) -> kalau diadopsi, port sebagai penambahan
murni (pola Pola A/D di `reference_klir_extend_pattern_fatur_backend_4_
pola.md`) -> kalau tidak, pindahkan kedua folder paket ke rak arsip yang
sesuai (bukan dihapus -- catat di CHANGELOG `00-PETA-STRUKTUR-PROJECT.md`)
supaya tidak terus-terusan jadi "paket tercerai-berai" yang membingungkan
sesi berikutnya lagi.

---

## Bagian 3 -- Standar "Selesai" yang Dipertegas (WAJIB dipatuhi tiap item Bagian 4)

Mecca eksplisit menaikkan bar malam ini. Definisi lama ("tsc 0 error + test
lulus + build sukses") TIDAK CUKUP LAGI sebagai bukti "selesai". Definisi
baru, per item:

```
1. WORKS secara teknis (tsc/test/build hijau) -- syarat MINIMUM, bukan bukti akhir.
2. TERSAMBUNG dan REACHABLE dari UI sungguhan -- diklik, bukan dibaca kodenya doang.
3. DICOBA LANGSUNG di browser dengan skenario pemakaian nyata (bukan cuma
   "tombolnya kebuka"), dan HASILNYA genuinely berguna -- kalau fiturnya
   "AI jawab pertanyaan", jawabannya harus benar-benar menjelaskan dan
   memberi pemahaman yang dibutuhkan user saat itu, bukan jawaban kosong/
   generik yang cuma "teknisnya jalan".
4. Kalau fiturnya menghasilkan data (angka/dokumen/analisis) -- datanya
   harus JUJUR (prinsip yang sudah mapan sesi-sesi ini: kalau belum ada
   data asli, bilang belum ada, jangan karang angka plausible).
5. Screenshot/bukti verifikasi browser WAJIB ada sebelum item di Bagian 4
   ditandai selesai -- bukan klaim "sudah saya cek", tapi bukti konkret.
```

---

## Bagian 4 -- Daftar Tugas WAJIB Tuntas Sesi Depan

Setiap item: kenapa belum, apa yang harus terjadi, siapa yang perlu
dikoordinasi (kalau ada), dan urutan prioritas relatif. Sumber detail
teknis lengkap tiap item ada di Bagian 9 dokumen Fatur -- di sini fokus ke
RENCANA EKSEKUSI, bukan pengulangan diagnosis.

### 4.1 [PRIORITAS #1, per instruksi eksplisit Mecca] Pusat/Hub Upload Data

Lihat Bagian 5 -- dipisah karena ini fitur BARU yang perlu desain, bukan
cuma "sambungkan yang sudah ada".

### 4.2 Fondasi Penyimpanan File & Chat Permanen

`[BUTUH KOORDINASI FATUR -- skema database]`. Ini AKAR yang menahan
Bagian 4.1, 4.3, dan sebagian besar item lain di bawah. Rencana:

```
1. Buat draf model Prisma baru (BUKAN diterapkan langsung ke schema.prisma
   Fatur tanpa persetujuan): WorkspaceFile (id, workspaceId, uploadedBy,
   fileName, fileType, sizeBytes, storageBlob-atau-storageUrl,
   extractedSummary, linkedRecordIds, status, createdAt) dan
   ChatMessage/ChatSession kalau chat permanen juga mau dikerjakan sesi ini
   (boleh ditunda ke sesi lain kalau WorkspaceFile saja sudah banyak).
2. Rekomendasi MVP (bukan keputusan final, tetap perlu persetujuan Fatur):
   simpan file sebagai `Bytes`/base64 di kolom Postgres (Neon yang sudah
   dipakai Fatur), BUKAN object storage baru (S3/R2) -- alasan: nol
   infrastruktur baru, konsisten dengan filosofi aditif-minimal sesi ini,
   dan skala UMKM awal belum butuh object storage terpisah. Migrasi ke
   object storage bisa jadi kerjaan lanjutan kalau skala membesar.
3. Tulis proposal singkat (pola sama seperti proposal Enterprise Tier 6
   Sep) -- kirim ke Fatur lewat Mecca, TUNGGU "gas" eksplisit sebelum
   `npx prisma migrate` apapun. Ini SATU-SATUNYA blocker keras di dokumen
   ini -- semua item lain bisa jalan tanpa nunggu ini KECUALI 4.1/4.3/4.5
   (hapus file) dan generate video (4.6).
4. Begitu skema disetujui: wiring `documents/extract-text`, `documents/
   analyze`, `media/transcribe`, `media/generate` supaya (opsional per
   permintaan user, JANGAN paksa semua upload harus disimpan) menyimpan
   record WorkspaceFile, dengan endpoint DELETE yang genuinely reachable
   dari UI (bukan cuma API seperti kas/transactions sekarang).
```

### 4.3 Tombol Hapus Transaksi Kas di UI

`[ADDITIVE-SAFE]`. Endpoint `DELETE /api/v1/kas/transactions` SUDAH ADA dan
sudah dipagari tenant-guard (dikonfirmasi sore ini) -- yang belum cuma
tombol di `FinanceModuleView.tsx`. Estimasi kecil, harus jadi salah satu
item PALING CEPAT selesai sesi depan (tidak ada blocker sama sekali).
Sekalian tambahkan konfirmasi "yakin hapus?" dan (kalau Bagian 4.2 sudah
jalan) opsi hapus WorkspaceFile terkait.

### 4.4 Wiring `ai-orchestrator.ts` ("Hermes-lite")

`[ADDITIVE-SAFE, tapi HATI-HATI blast radius]`. File sudah lengkap, nol
caller (dikonfirmasi lewat grep sore ini). Ganti `executeAIRequest(...)`
jadi `orchestrate({task: 'chat', ...})` di `brain/chat/route.ts` dan route
lain yang manggil AI. **Wajib dites ekstra hati-hati** karena satu
kesalahan di sini berdampak ke SEMUA jawaban AI di seluruh app sekaligus --
jangan langsung ganti semua titik panggil bersamaan, mulai dari SATU route
dulu (`brain/chat`), verifikasi penuh (Bagian 3), baru lanjut ke route
lain.

### 4.5 UI Kartu Hasil `document-checker`/`tabular-checker`

`[ADDITIVE-SAFE]`. Backend sudah nyambung (field `documentCheck` di
response `documents/analyze`), yang belum cuma tampilan. Desain kartu
mengikuti pola kartu "buku besar diverifikasi" yang sudah ada untuk
ledger-parser (konsistensi visual, jangan desain baru dari nol).

### 4.6 Generate Video

`[BUTUH KOORDINASI -- budget + Bagian 4.2]`. Pola arsitektur provider
gambar/audio sudah terbukti (menambah provider baru = extend
`media-catalog.ts`/`media-provider.ts`, bukan desain ulang). TAPI: (1)
model video jauh lebih mahal per-generate -- WAJIB declare estimasi biaya
ke Mecca sebelum mulai, jangan diam-diam jalan; (2) hasil video butuh
tempat simpan -- nunggu Bagian 4.2 selesai dulu, atau declare eksplisit
kalau mau jalan tanpa penyimpanan permanen dulu (video cuma sekali-pakai
per sesi chat, sama seperti gambar/audio sekarang).

### 4.7 Endpoint Kampanye Iklan Marketing

`[BUTUH endpoint backend baru, lane Fatur ATAU boleh dibangun sendiri kalau
additive murni]`. `campaigns` di `MarketingModuleView.tsx` selamanya
kosong -- field yang dipakai UI (dailyBudget/roas/platform/leads/
creativeType/status) tidak match endpoint manapun yang ada. Cek dulu:
apakah ini genuinely butuh tabel Prisma baru (kalau ya, gabung ke proses
koordinasi Fatur di 4.2), atau bisa dihitung/diturunkan dari data yang
sudah ada (mis. dari PromoCoupon atau data lain yang sudah ada di skema)
tanpa tabel baru -- cek ini DULU sebelum asumsi butuh migrasi baru.

### 4.8 Widget "Kewajiban Terjadwal" Finance

`[Sama seperti 4.7]`. `upcomingDues14/30` di `FinanceModuleView.tsx`
struktural kosong. Cek dulu apakah bisa diturunkan dari `Invoice` yang
sudah ada di skema (invoice yang belum lunas = kewajiban, kemungkinan
besar TIDAK butuh tabel baru) sebelum asumsi butuh koordinasi Fatur.

### 4.9 Generator Laporan Otomatis Marketing

`[BUTUH keputusan produk dulu -- prioritas rendah dibanding di atas]`.
Ditemukan sore ini sebagai klaim UI kosong ("Dibuat otomatis tiap akhir
bulan"), sudah di-generic-kan jadi "Segera hadir". Sesi depan: putuskan
apakah ini genuinely prioritas dibanding item lain di dokumen ini -- kalau
tidak, boleh tetap "Segera hadir" dan fokus ke item lain, declare
keputusan itu ke Mecca secara eksplisit (bukan diam-diam di-skip).

### 4.10 4 Modul KLIR Enterprise Tier

`[BUTUH KOORDINASI FATUR -- keputusan entitas Employee]`. Spek lengkap
sudah ada (`2026-09-06-spek-fitur-*.md`), proposal siap-copy sudah ada
(`2026-09-06-proposal-koordinasi-fatur-video-dan-enterprise-tier.md`).
Prioritas PALING RENDAH di dokumen ini -- 4 modul besar, butuh keputusan
arsitektur fondasi (siapa SSOT `Employee`) sebelum baris kode pertama.
Kalau sesi depan sudah menuntaskan Bagian 4.1-4.9 dan masih ada waktu/
budget, baru masuk ke sini. Kalau belum sempat, itu SAH -- declare
eksplisit ke Mecca di akhir sesi, bukan silent-skip.

### 4.11 Bagian 2 -- Rekonsiliasi Paket Antigravity & Codex

Sudah dijelaskan penuh di Bagian 2 di atas.

---

## Bagian 5 -- Desain Konkret: Pusat/Hub Upload Data (Fitur Baru, Prioritas #1)

Mecca eksplisit: "tempat upload-nya selain dari AI-nya langsung ada tempat
wadahnya... nanti bisa langsung terintegrasi langsung... integrasi AI,
data, angka, fakta." Ini BUKAN sekadar UI baru -- ini titik masuk data yang
terpisah dari chat, tapi tetap terhubung ke pipeline AI yang sama.

```
KENAPA INI DIMINTA (root cause dari temuan sore ini):
Sekarang, satu-satunya cara upload data adalah lewat tombol jepit kertas
DI DALAM chat -- tidak ada tempat untuk MELIHAT semua yang pernah diupload,
tidak ada cara menghapus, tidak ada cara tahu file mana yang menghasilkan
data apa. Ini gap produk nyata: user tidak punya kendali/visibilitas atas
datanya sendiri.

DESAIN YANG DIUSULKAN (bukan final, sesi depan boleh sempurnakan):
1. Menu baru "Pusat Data" / "Dokumen Saya" di sidebar ketiga portal (CEO
   dapat semua, Finance/Marketing lihat punya sendiri -- konsisten dengan
   aturan role-fit yang baru selesai dibangun sore ini).
2. Halaman ini punya: tombol upload langsung (tidak perlu lewat chat),
   daftar file yang pernah diupload (nama, jenis, tanggal, status
   diproses/gagal), tombol lihat-hasil-ekstraksi, tombol HAPUS (menutup gap
   dari Bagian 9.4 dokumen Fatur), dan indikator "data turunan apa yang
   dihasilkan file ini" (mis. "menghasilkan 583 transaksi kas" -- linkage
   ke WorkspaceFile.linkedRecordIds di Bagian 4.2).
3. Upload dari halaman ini WAJIB memanggil endpoint pemrosesan yang SAMA
   dengan upload dari chat (`documents/extract-text`/`documents/analyze`)
   -- BUKAN membuat jalur baru yang terpisah, supaya perilaku konsisten dan
   tidak ada 2 versi logic yang bisa divergen.
4. Bergantung penuh pada Bagian 4.2 (WorkspaceFile) selesai duluan --
   urutan kerja: 4.2 dulu (fondasi + koordinasi Fatur), baru 4.1 (halaman
   UI-nya) menyusul begitu skema disetujui dan diterapkan.
5. "Integrasi AI, data, angka, fakta" (kata Mecca) berarti: halaman ini
   bukan cuma daftar file mati, tapi tiap file terhubung balik ke: (a) AI
   Assistant (tombol "tanya AI soal file ini"), (b) dashboard (kalau file
   itu menghasilkan transaksi/data yang muncul di kartu dashboard, ada
   link balik dari kartu itu ke file sumbernya) -- ini closing loop yang
   sekarang tidak ada sama sekali.
```

---

## Bagian 6 -- Loop Kerja Wajib Sesi Depan

Instruksi eksplisit Mecca, HARAM disimpangi:

```
TES -> FIX -> PUSH (GitHub) -> TES -> FIX -> PUSH -> ... berulang
sampai satu item di Bagian 4 genuinely tuntas (per standar Bagian 3),
BARU pindah ke item berikutnya atau ke deploy VPS.

Deploy ke Hostinger (VPS 72.61.142.156, PM2 klir-os) HANYA di titik-titik
checkpoint yang masuk akal (bukan tiap 1 baris kode) -- push ke GitHub
DULU selalu, VPS TERAKHIR. Urutan yang sama seperti sesi ini:
  1. tsc --noEmit
  2. node --experimental-test-module-mocks --import tsx --test tests/*.test.ts
  3. next build
  4. Verifikasi browser langsung (Bagian 3 poin 3)
  5. git commit + push ke claude/ai-brain-upgrade-1sep + fast-forward main
  6. SSH VPS -> git pull -> npm install -> prisma generate -> npm run build
     -> pm2 restart klir-os --update-env
  7. Verifikasi live (curl + pm2 logs + browser ke klir.laserstory1.id)
Ulangi 1-7 per item atau per kelompok item kecil yang saling terkait --
JANGAN menumpuk semua item Bagian 4 jadi SATU push raksasa di akhir sesi
(risiko satu item gagal menahan semua item lain yang sudah beres).
```

---

## Bagian 7 -- Standar Pengujian yang Bisa Dicek Mecca Sendiri

Mecca eksplisit ingin bisa test sendiri (manual atau lewat Codex) di akhir
sesi depan. Supaya itu mungkin:

```
1. Tiap item Bagian 4 yang ditandai selesai WAJIB punya CARA TES MANUAL
   yang ditulis eksplisit (klik apa, di mana, harapannya apa) -- bukan
   cuma "sudah saya verifikasi", tapi instruksi yang Mecca sendiri atau
   Codex bisa ikuti tanpa baca kode.
2. Kumpulkan instruksi tes manual ini jadi SATU dokumen ringkas di akhir
   sesi (mis. `2026-09-XX-panduan-tes-manual-untuk-Mecca.md`) -- daftar per
   fitur: "buka halaman X, klik Y, harusnya lihat Z."
3. Kalau ada item yang TIDAK bisa dites manual dengan mudah (mis. logic
   backend murni), jelaskan kenapa dan tunjukkan bukti otomatis (hasil
   test) sebagai gantinya -- jangan biarkan Mecca menebak cara tesnya.
```

---

## Bagian 8 -- Batasan yang Tetap Berlaku (jangan dilupakan sesi baru)

```
1. Zona merah Fatur (auth.ts, session.ts, rate-limiter.ts, prisma.ts,
   6 route auth, KlirAuthModal, page.tsx, layout.tsx, landing, schema.prisma
   TANPA persetujuan, ecosystem.config.js, deploy-vps.sh) -- lihat Bagian 2
   dokumen Fatur untuk daftar lengkap + cara verifikasi nol-diff.
2. HARAM mengetik kata sandi ke kolom apapun, di mana pun, tanpa
   pengecualian -- termasuk untuk keperluan testing. Pola password-free
   testing yang sudah terbukti sesi ini: sesi cookie + localStorage
   (`klir_active_portal`) bertahan lintas restart server, reload halaman
   cukup untuk pindah portal tanpa login ulang.
3. Kesesuaian peran CEO (superset)/Finance (finansial saja)/Marketing
   (marketing saja) yang baru selesai dibangun sore ini -- JANGAN dirusak
   lagi saat menambah fitur baru di Bagian 4. Fitur baru WAJIB dicek: kalau
   cuma relevan 1 peran, jangan otomatis muncul di ketiga portal.
4. Angka/data yang ditampilkan ke user WAJIB jujur -- kalau belum ada data
   asli, tampilkan keadaan jujur ("belum ada data"), jangan angka
   pengganti yang kelihatan plausible.
5. Verifikasi kepemilikan berkas via `git log -- file` + `git cat-file -e
   origin/main:file` SEBELUM label apapun "punya Fatur, jangan disentuh"
   atau sebaliknya.
```

---

## Penutup

Sesi ini ditutup di sini. Sesi depan mulai dari Bagian 0 dokumen ini,
dengan model Sonnet + mode Ultracode, dan tuntas sampai HARAM ada "oh belum
karena X" tersisa tanpa itu sudah dikomunikasikan eksplisit ke Mecca di
sepanjang jalan (bukan kejutan di akhir). Prioritas eksekusi yang disarankan:
Bagian 4.3 (tercepat, nol blocker) -> Bagian 4.2 (fondasi, mulai proses
koordinasi Fatur SEGERA di awal sesi karena ini yang paling lama nunggu
jawaban) -> Bagian 4.5/4.4 (additive-safe, bisa paralel sambil nunggu
Fatur) -> Bagian 4.1/5 (Hub Upload, begitu 4.2 disetujui) -> Bagian
4.7/4.8 (cek dulu butuh skema baru atau tidak) -> Bagian 2 (rekonsiliasi
paket Antigravity/Codex) -> Bagian 4.6 (video) -> Bagian 4.9 -> Bagian 4.10
(Enterprise Tier, kalau masih ada waktu).
