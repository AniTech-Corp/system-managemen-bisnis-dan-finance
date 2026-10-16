# ROADMAP MASTER KLIR -- versi Fable 5.1, 10 September 2026

Ditulis oleh Claude Code (Fable 5.1) atas permintaan Mecca: "matengin lagi roadmap-nya,
goals-nya mau ke mana... yang kurang apa, yang butuh apa... jadi rujukan untuk Sonnet ke
depan". Dokumen ini MENGGANTIKAN peran 3 roadmap sebelumnya sebagai peta induk:
- 2026-09-07-ROADMAP-SESI-DEPAN-integrasi-penuh-A-sampai-Z.md (Sonnet, 7 Sep)
- 2026-09-10-roadmap-inventory-ai-distributor.md (Sonnet, 10 Sep)
- 2026-09-10-codex-to-claude-handoff.md bagian "Roadmap yang disarankan" (Codex)
Ketiganya TETAP dipertahankan sebagai riwayat (jangan dihapus). Status per item dari
ketiganya direkonsiliasi ke kode di 2026-09-10-status-matrix-semua-roadmap-vs-kode.md.

Pembaca: Claude Sonnet/Opus, Codex (GPT 5.6 Luna/Terra), Fatur, Mecca. Kalau kamu AI: baca
AGENTS.md repo dulu, lalu dokumen ini, lalu status matrix, baru file lain sesuai kebutuhan.

--------------------------------------------------------------------------------------------
## 0. Cara pakai dokumen ini (30 detik)
--------------------------------------------------------------------------------------------

1. Bagian 1 = arah produk yang SUDAH dikunci Mecca. Jangan diperdebatkan ulang tiap sesi.
2. Bagian 2 = urutan kerja bertingkat. Kerjakan Tingkat A sampai habis sebelum B.
3. Bagian 3 = definisi "selesai" dan tier bukti. Klaim tanpa tier = klaim kosong.
4. Bagian 4 = pagar (lane Fatur, push, data produksi). Melanggar = kerja diulang.
5. Bagian 5 = jebakan yang sudah pernah menggigit (anti-halusinasi spesifik KLIR).
6. Bagian 6 = keputusan yang genuinely butuh Mecca. Selain itu, putuskan sendiri dan catat.

--------------------------------------------------------------------------------------------
## 1. Arah produk yang sudah dikunci (JANGAN ditanya ulang)
--------------------------------------------------------------------------------------------

```
KLIR = business-OS SaaS untuk UMKM/SME Indonesia. Tiga tier:
  Public / Private-Custom  -> KLIR utama, AI WAJIB terintegrasi (repo ini)
  KLIR UMKM                -> pecahan fitur KLIR utama TANPA AI (stok/pembukuan/kasir),
                              AI = add-on opsional. Fatur fokus ke sini (lane pastinya
                              perlu dikonfirmasi, lihat Bagian 6)
  KLIR Inventory           -> fondasi UMKM yang hidup di dalam KLIR utama, karena itu
                              WAJIB ber-AI. Modul ke-7.

ROLE    = jabatan login -> menentukan CAKUPAN. CEO/Owner = superset semua feature aktif.
          Finance = feature relevan kerja keuangan (boleh lintas modul).
          Marketing = feature relevan kerja pemasaran (boleh lintas modul).
MODULE  = 7 kelompok internal (corplan, personal, finance, advertising, workspace,
          schedule, inventory -- src/lib/module-guard.ts). HANYA untuk gating backend.
          HARAM tampil sebagai label ke user ("Modul Inventory", "KLIR Management").
FEATURE = yang user lihat dan pakai: "Stok & Pembelian", "Operasional tim",
          "Reservasi & Antrean", "Kalkulator HPP", dst.

DASHBOARD    = overview PASIF: angka, grafik, status, insight ringkas. Bukan tempat kerja.
AI ASSISTANT = tempat KERJA utama. Semua feature ber-AI dijalankan di sini.

STANDAR AI (arahan ayah Mecca, 9 Sep):
  (1) bandingkan target vs realisasi historis, (2) proyeksi ke depan, (3) rekomendasi
  konkret, (4) TIDAK mengarang sebab bisnis kalau data kanal/produk/biaya/transaksi belum
  ada -- minta datanya, (5) keputusan tetap di manusia.
  Contoh yang sudah jadi kode: src/lib/ai-brain/sales-target-engine.ts (Codex, 9-10 Sep).

DATA JUJUR: nol data = tampilkan "belum ada data" + apa yang dibutuhkan. HARAM angka
  contoh yang kelihatan plausible, HARAM chart histori palsu, HARAM "Rp" untuk rasio (ROAS).

SEGMEN BARU (8 Sep, dari rekaman tim, BELUM resmi): Distributor pabrik->warung
  (skala dus/lusin). Proposal tim online (Adnan/Medi) ditarget ~15 Sep. Kebutuhan demo:
  "AI saranin restock per toko/wilayah dari pola penjualan". Belum ada skema harga.
```

--------------------------------------------------------------------------------------------
## 2. Roadmap bertingkat
--------------------------------------------------------------------------------------------

Prinsip urutan: (a) yang sudah dibangun harus MENYALA dulu sebelum bikin baru, (b) additive
dan lane Claude duluan, (c) yang butuh keputusan Mecca/Fatur dikumpulkan jadi satu
gelombang tanya, bukan diselipkan satu-satu.

```
TINGKAT A -- SESI INI (Fable, 10 Sep). Additive, lane Claude, nol skema baru.
  A1  Tutup P0 Codex "Finance nav mouse"   -> TIDAK reproduce 4 skenario browser asli.
                                              Akar dugaan kuat: koordinat automation
                                              meleset (dpr 0.667). Lihat Bagian 5 #1.
  A2  Inventory Fase 0: "Stok & Pembelian"  -> endpoint GET/POST products + GET
      menyala di CEO + Finance                 stock-movements (baru, additive) +
                                              KlirInventoryView.tsx + kartu dashboard CEO
                                              + pintasan di Executive & Finance AI.
  A3  Inventory Fase 1: otak analisa        -> inventory-intelligence-engine.ts (restock,
                                              low-stock, anomali retur, kontributor
                                              profit) + wiring intent di brain/chat.
  A4  Inventory Fase 2: low-stock alert     -> dari Product.minStock, tampil di view +
                                              summary dashboard (sensor sudah ada,
                                              tinggal dibaca).
  A5  Dokumen: usulan matriks role->feature (dari fitur nyata di kode), status matrix
      semua roadmap vs kode, panduan tes untuk GPT Luna/Terra + Mecca, catatan untuk
      Fatur (diff page.tsx).
  Gate: tsc 0, suite penuh 0 fail, diklik di browser login asli, zona merah nol diff.

TINGKAT B -- BUTUH KEPUTUSAN MECCA (satu gelombang tanya, lihat Bagian 6)
  B1  Matriks role->feature final -> baru boleh jadi RBAC/registry di kode.
  B2  Persistensi target penjualan (sekarang state browser) -> entity + periodisasi +
      sumber ledger = lane Fatur (skema). Claude siapkan kontrak acceptance.
  B3  Push batch ke GitHub (36 commit lokal + worktree dirty) -> hanya saat Mecca bilang
      di momen itu. Setelah push: Codex/Luna-Terra tes dari kode terbaru.
  B4  Slip Gaji menulis kas asli; auto-fix data oleh AI; kebijakan token hangus;
      definisi Enterprise Tier -- semua masih terbuka sejak Agustus.

TINGKAT C -- BUTUH FATUR (skema/infra). Claude tulis proposal, tunggu "gas".
  C1  Fase 4 Inventory: faktor konversi satuan (1 dus = N pcs) -> tambah kolom Product.
  C2  ChatMessage/ChatSession persisten (riwayat chat sekarang localStorage, Fatur 60db0a5).
  C3  Entity Employee tunggal untuk 4 modul Enterprise (PRD 6 Sep) -- prioritas paling
      rendah, hanya kalau Enterprise Tier diputuskan ada.
  C4  Reconcile 4 commit origin/main: de2d83d + 3d2249e SUDAH diport manual Codex;
      ea619b1 + 6f1aaf3 (hapus riwayat/PRD) sengaja TIDAK -- perlu kesepakatan sebelum
      merge supaya file handoff/verbatim tidak ikut terhapus.

TINGKAT D -- SETELAH PROPOSAL DISTRIBUTOR (~15 Sep) + survei istilah tim online
  D1  Fase 5: diferensiasi Distributor vs UMKM (istilah "Storage"/"Stok", logika skala).
  D2  Rekomendasi restock per TOKO/WILAYAH (butuh entitas pelanggan/outlet -- belum ada
      di skema; Fase 1 baru per produk workspace).
  D3  Fitur lanjutan roadmap tim online (visual search, CRM AI, QRIS+AI, broadcast+AI,
      vendor split-order, fraud PO, dead-stock, prediksi harga komoditas) -- urutan
      belum diputuskan Mecca.
```

--------------------------------------------------------------------------------------------
## 3. Definisi "selesai" + tier bukti (berlaku semua model, semua AI)
--------------------------------------------------------------------------------------------

```
[LIVE]      dilihat di produksi klir.laserstory1.id (belum relevan: belum push/deploy)
[LOKAL]     tsc 0 + suite penuh 0 fail + DIKLIK di localhost dengan login asli
[TEST]      cuma test otomatis, belum diklik manusia/browser
[HIPOTESIS] kode ada, belum ada bukti
[BELUM]     tidak dikerjakan

"Selesai" untuk fitur user-facing = minimal [LOKAL] + data jujur + panduan tes tertulis
(klik apa, di mana, harapannya apa) supaya Mecca/Codex bisa mengulang tanpa baca kode.
Laporan WAJIB punya bagian "yang belum / sengaja tidak" -- laporan tanpa itu dianggap
menyembunyikan sesuatu.
```

--------------------------------------------------------------------------------------------
## 4. Pagar yang tidak bisa dinego
--------------------------------------------------------------------------------------------

```
LANE FATUR (baca saja, usulan lewat dokumen): auth/login/register/session, rate-limiter,
  prisma.ts, prisma/schema.prisma, .env, layout.tsx, KlirAuthModal.tsx, KlirLandingV4.tsx,
  ecosystem.config.js, deploy script, VPS/PM2. page.tsx = zona SENSITIF: boleh disentuh
  untuk mount feature view (preseden efa4f96 Schedule, dan sesi ini Inventory) dengan
  diff minimal + dicatat di dokumen "untuk Fatur".
GIT: commit lokal boleh kalau Mecca minta; push/deploy HANYA saat Mecca bilang di momen
  itu (hook push-final-gate). Jangan reset --hard / checkout -- / stash pada worktree
  dirty. Jangan hapus/timpa file handoff/history; tulis file baru bertanggal.
DATA: localhost = Neon = database PRODUKSI. Tes jangan bikin transaksi/booking/campaign
  sungguhan tanpa keputusan Mecca. Artefak uji lama (docx invoice) jangan dihapus sepihak.
UANG: generate video/model berbayar = declare biaya dulu.
KREDENSIAL: AI tidak mengetik kata sandi. Tes memakai sesi Chrome Mecca yang sudah login;
  pindah portal cukup localStorage klir_active_portal + klir_<role>_nav lalu reload.
```

--------------------------------------------------------------------------------------------
## 5. Jebakan yang sudah pernah menggigit (anti-halusinasi spesifik KLIR)
--------------------------------------------------------------------------------------------

```
1  Klik koordinat dari screenshot ter-scale MELESET (dpr 0.667, viewport 2520x1393).
   Sidik jari: "mouse gagal, Enter jalan". Klik via ref/getBoundingClientRect, cek
   document.elementFromPoint + listener click di window sebelum menyebut bug.
2  Status fitur dari dokumen/memori basi dalam 1 hari (2 klaim roadmap 6 Sep salah pada
   7 Sep). Cek kode (grep/file:line) sebelum lapor status.
3  "Dibangun" != "menyala": KlirScheduleView pernah 1028 baris tanpa pernah di-mount.
   Setiap komponen baru wajib dibuktikan reachable dari UI.
4  Endpoint Fatur baru bisa tanpa guard (profile route 6 Sep). Setiap route baru:
   withTenantGuard + workspaceId dari auth, bukan body/query.
5  Klaim "sudah 1:1 / sudah fix" tanpa bukti lapangan (M-901). Tier bukti wajib.
6  Loop fix->push per bug bikin Fatur kelabakan (7 Sep, 5 push sehari). Batch final saja.
7  Merge origin/main tanpa sisir baris "-" bisa menghapus fitur pihak lain diam-diam.
8  Konteks izin di context pack bocor ke agent lain (M-895). Izin push/deploy tidak
   pernah diwariskan lewat dokumen; hanya dari Mecca di chat saat itu.
9  Dev server bisa serve versi basi kalau file tidak tersalin / overlay stale. Reload +
   cek teks di DOM, bukan cuma "tombolnya ada".
10 Tool markdown->docx tidak bikin tabel Word asli. Dokumen Word untuk manusia: python-docx.
```

--------------------------------------------------------------------------------------------
## 6. Keputusan yang genuinely butuh Mecca (triage: hanya yang mengubah arah kerja)
--------------------------------------------------------------------------------------------

```
Q1  Matriks role->feature (dokumen usulan sesi ini): setujui / coret / ubah -> setelah itu
    baru jadi registry di kode. Tanpa ini, Finance/Marketing tetap proxy 1-modul.
Q2  Push batch: kapan? (36 commit + worktree dirty sudah lolos gate lokal). Ini juga
    prasyarat Codex/Luna-Terra tes dari kode terbaru.
Q3  Lane Fatur pasca "pindah fokus ke KLIR-UMKM" (8 Sep) padahal masih push ke repo
    utama (9 Sep): siapa pegang skema Inventory (konversi satuan Fase 4) dan target
    persistence?
Q4  Urutan D3 (fitur lanjutan Inventory) -- atau tunggu proposal Distributor 15 Sep dulu.
Q5  Nasib 2 commit cleanup Fatur (ea619b1, 6f1aaf3) yang menghapus riwayat/PRD: merge
    dengan pengecualian file handoff, atau tolak?
Keputusan lain (21 item, project_klir_audit_menyeluruh_16agu_sampai_9sep_pending.md) tetap
tercatat tapi TIDAK memblokir Tingkat A.
```

--------------------------------------------------------------------------------------------
## 7. Hasil eksekusi sesi ini
--------------------------------------------------------------------------------------------

Cara kerja: 1 Workflow komando-tuntas-gate (6 agent Bangun paralel Sonnet -> Verify -> Anti-Halu
-> Gate PROT-50), lalu temuan Gate ditambal komando (Fable) dengan tangan, bukan rerun.
Gate awal: 4/7 DONE, 3 PARTIAL. Setelah tambalan komando: semua tertutup, rincian di bawah.

```
ITEM                                   STATUS   TIER     BUKTI
A1 P0 Finance nav mouse                TUTUP    [LOKAL]  5x klik mouse asli Chrome login: semua
                                                          pindah. elementFromPoint = span tombol.
                                                          Akar dugaan kuat: koordinat automation
                                                          meleset (dpr 0.667). Nol perubahan kode.
A2 Stok & Pembelian menyala            SELESAI  [LOKAL]  2 route baru (products GET/POST,
                                                          stock-movements GET) + KlirInventoryView
                                                          + kartu dashboard CEO + pintasan CEO dan
                                                          Finance. Diklik di browser: CEO alur
                                                          penuh PASS, Finance alur penuh PASS,
                                                          4 tab zero-state jujur, console 0 error.
A3 inventory-intelligence-engine       SELESAI  [LOKAL]  16 test; chat "stok mana yang harus
                                                          restock" -> jawaban jujur minta tambah
                                                          produk (200, 1.1 s, tanpa LLM).
                                                          Dengan data riil: [TEST] saja.
A4 Low-stock                           SEBAGIAN [LOKAL]  summary lowStock + badge + kartu
                                                          dashboard + jawaban chat. Kartu
                                                          peringatan proaktif otomatis saat AI
                                                          dibuka: BELUM (Tingkat B/C berikutnya).
A5 Dokumen                             SELESAI  [LOKAL]  status matrix 485 baris, usulan matriks
                                                          role-feature 257 baris (keduanya dibaca
                                                          ulang komando, ASCII 0 non-ascii),
                                                          panduan tes Luna/Terra, catatan Fatur.
BONUS sales-target parser              FIX      [LOKAL]  "Q1 15 juta, Q2 20 juta" (koma/spasi)
                                                          cuma membaca Q1. Regex tempered + 1
                                                          test regresi. Suite 1219/1219.
GATE akhir                             HIJAU    [LOKAL]  tsc exit 0; 1219 pass 0 fail; HEAD
                                                          f9c5239 (tidak commit, tidak push);
                                                          zona merah Fatur nol diff.
```

Catatan jujur sesi ini:
- Tambah produk sungguhan tidak dijalankan (menulis ke Neon produksi). Alur A5 di panduan
  tes = [TEST] sampai Mecca/Luna-Terra mencoba.
- Constraint unique SKU di Postgres asli belum dibuktikan (route menangani P2002 -> 409).
- Viewport sempit/mobile belum diuji.
- Dua agent dokumen mengembalikan laporan JSON stub ("test") walau file hasilnya substantif;
  komando membaca kedua file penuh sebagai pengganti laporan. Bug pelaporan agent, dicatat
  ke system-upgrades.
- Diff page.tsx 112 baris gabungan = ~55 baris inventory (sisa diff Codex 9 Sep); kontrak
  "< 60" diterima dengan pengecualian komando karena pola identik blok schedule yang sudah ada.
- Dokumen keluaran sesi ini (semua di root repo, untracked, jangan ditimpa):
  2026-09-10-fable-roadmap-master-klir.md (ini), 2026-09-10-status-matrix-semua-roadmap-vs-kode.md,
  2026-09-10-usulan-matriks-role-feature-7-modul.md, 2026-09-10-panduan-tes-untuk-gpt-luna-terra-
  dan-mecca.md, 2026-09-10-untuk-fatur-stok-pembelian-dan-page-tsx.md.

Langkah berikutnya yang disarankan (urut): Mecca jawab Q1-Q5 Bagian 6 -> Luna/Terra + Mecca tes
panduan A5/A6/B2 -> push batch (saat Mecca bilang) -> Tingkat B/C.

--------------------------------------------------------------------------------------------
## 8. Keputusan Mecca 10 Sep siang -> Tingkat B dikunci, eksekusi oleh Sonnet
--------------------------------------------------------------------------------------------

Mecca sudah menjawab semua pertanyaan Bagian 6 dan item "belum" Bagian 7. Ringkasnya: SKU
duplikat dijadikan validasi nyata; peringatan stok otomatis dibangun dengan wadah reusable;
tampilan HP ditunda (desktop dulu); tambah produk sungguhan dites bareng Codex nanti; matriks
role->feature diserahkan ke Fatur; fitur stok lanjutan dibangun sekarang plus riset kebutuhan;
2 commit cleanup Fatur diikuti (dengan arsip dulu); push GitHub dan deploy VPS diizinkan
setelah semua selesai dan aman; wajib ada dokumen untuk Fatur; fase fitur berikutnya =
matangkan dashboard + AI Assistant CEO/Finance/Marketing lintas 7 modul.

Eksekusi Tingkat B dipegang Claude Code Sonnet 5 (pilihan Mecca, hemat kredit) mengikuti
kontrak langkah-per-langkah: 2026-09-10-kontrak-eksekusi-sonnet-tingkat-b-klir.md (F0-F8:
persiapan, SKU, peringatan otomatis, stok lanjutan + riset, audit 3 portal x 7 modul, dokumen
Fatur, merge origin/main + arsip, push + deploy, lapor). Q1-Q5 Bagian 6 dianggap TERJAWAB;
yang tersisa untuk Mecca hanya 1 baris konfirmasi di momen push (F7).

Koreksi penamaan dari Mecca (berlaku untuk laporan berikutnya): hasil audit yang bersih ditulis
sebagai "temuan: bersih", bukan "belum dikerjakan"; kode yang ada tapi belum dibuktikan ditulis
"[HIPOTESIS] belum dites ke X", bukan "belum dikerjakan"; pertanyaan yang jawabannya cepat
ditulis "cek cepat", istilah "butuh keputusan" disimpan untuk hal yang genuinely berat.
