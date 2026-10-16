# Untuk Fatur -- apa yang tim AI ubah 11 Sep 2026 dan kenapa

> Ditulis Claude (Fable 5.1) untuk dev manusia. Satu batch, satu commit, satu push, satu deploy.
> Lane kamu (auth/session/membership/landing/page.tsx/schema.prisma/infra) NOL diff --
> diverifikasi `git diff --numstat HEAD` oleh 2 agent verifikasi independen + komando.
> Tidak ada migrasi Prisma. Tidak ada dependency npm baru. Tidak ada perubahan package.json.

## 1. Ringkasan 30 detik

Mecca komplain: file sudah diupload ke Pusat Data tapi dashboard tetap Rp 0; AI tidak
"kenal" perusahaannya; default model mahal; UI asisten penuh grid. Akar yang kami temukan
dan tutup hari ini:

| Akar (kode lama) | Perubahan |
|---|---|
| Cascade AI mencoba Groq dulu, default OpenRouter gemini-3.5-flash ($1.5/$9 per juta token) | OpenRouter dulu, tier model: santai qwen3.7-flash / hemat deepseek-v4-flash (default) / standar deepseek-v4-pro / maksimal gemini-3.5-flash (pilihan user). Groq -> Gemini -> OpenAI -> OpenCode tetap cadangan |
| Kartu "Ringkasan AI" dashboard = teks statis dari omset transaksi, tidak baca file | Endpoint baru `GET /api/v1/brain/dashboard-insight?role=ceo|finance|marketing` (LLM hemat + fallback deterministik, cache 30 menit, invalidasi saat data berubah) dipakai 3 dashboard |
| File upload hanya jadi teks untuk chat; angka masuk Buku Kas cuma kalau klik "Impor" | Auto-ingest: tabel yang bisa di-parse deterministik LANGSUNG masuk tabel domain (kas/produk/payroll) + tugas usulan dari notulen; bisa dibatalkan per file |
| Pertanyaan ringan ("gaji saya bulan ini") tetap lewat LLM | Router data-cepat NOL LLM (payroll/tugas/agenda/tagihan/kas) |
| Effort tidak pernah otomatis (tanpa batas token) | Effort otomatis santai/normal/serius dari isi pesan; maksimal hanya pilihan user |
| AI bilang "belum ada render video" padahal Studio video jalan | Registry + prompt dibenerin |
| Panel data default tampil, grid 28 kemampuan di area utama | Panel default tersembunyi (toggle tetap), grid pindah ke sidebar per role |

## 2. Endpoint baru / berubah (semua di lane AI, guard tenant sama seperti route Pusat Data)

| Endpoint | Method | Guard | Catatan |
|---|---|---|---|
| /api/v1/brain/dashboard-insight?role=ceo|finance|marketing[&refresh=1] | GET | authenticateTenantRequest | cache MemoryItem [DASHBOARD_INSIGHT role=..], refresh maks 1x/2 menit |
| /api/v1/workspace-files/[id]/undo-ingest | POST | withTenantGuard MEMBER | hapus record turunan hasil impor otomatis file itu saja |
| /api/v1/workspace-files (POST) | POST | tidak berubah | respons tambah `ingest: {kind, created, skipped, warnings, label}`; zip: `zipSummary.ingest[]` |
| /api/v1/workspace-files (GET) | GET | tidak berubah | tiap file tambah `ingestKind`, `ingestCount` |
| /api/v1/brain/chat | POST | tidak berubah | body tambah `assistantMode` (tanya/riset/belajar/analis); respons tambah `effortAuto`, `effortReason`, `assistantModeUsed`, `modelTierUsed`, `creditHint`, `quickData` |

## 3. Env baru (opsional, semua ada default di kode -- TIDAK wajib diisi di VPS)

```
OPENROUTER_MODEL_SANTAI    default qwen/qwen3.7-flash
OPENROUTER_MODEL_HEMAT     default deepseek/deepseek-v4-flash-0731   (OPENROUTER_TEXT_MODEL lama tetap dihormati)
OPENROUTER_MODEL_STANDAR   default deepseek/deepseek-v4-pro
OPENROUTER_MODEL_MAKSIMAL  default google/gemini-3.5-flash
```
Tidak ada key baru. OPENROUTER_API_KEY sekarang jadi provider PERTAMA untuk teks.

## 4. Tag MemoryItem baru (tanpa kolom/tabel baru)

`[COMPANY_BRIEF]` (ringkasan perusahaan dari dokumen), `[CHAT_TURN ...]` (memori percakapan
lintas divisi, 8 terakhir masuk prompt), `[DASHBOARD_INSIGHT role=..]` (cache insight),
`[INGEST_LOG] {...}` (jejak impor otomatis per file, dipakai undo). Semua scope WORKSPACE.

## 5. Auto-ingest -- aturan yang kami kunci (biar kamu tahu batasnya)

- Angka finansial HANYA dari parser deterministik (ledger-parser / generic-table-ledger /
  detektor kolom). LLM tidak pernah menulis angka ke tabel.
- Ledger klasik: auto. Tabel transaksi generik: auto kalau confidence >= 0.70
  (contoh: daftar-transaksi-mentah.csv 0.80). Rekap harian per kategori (laporan-penjualan-
  bulanan.xlsx, ~0.35, risiko dobel-hitung) TIDAK auto -> tombol "Impor ke Buku Kas" (lama).
- Produk: upsert by SKU (atau nama). Payroll: skip kalau nama+periode sudah ada.
- Notulen: LLM hemat mengekstrak tindak lanjut -> WorkTask TODO dengan description
  "[usulan AI dari <file>]" (maks 10, judul duplikat dilewati). Bukan uang.
- Transaksi hasil auto-ingest punya deskripsi berakhiran `(impor otomatis dari "<file>")`.
- Semua bisa dibatalkan per file (tombol di Pusat Data).
- Dedup: sha256 isi file disimpan di [INGEST_LOG]; upload ulang file dengan isi identik -> kind
  `sudah-diimpor`, tidak ada transaksi baru (temuan verify-2 KRITIS, ditutup).
- Detektor produk menolak tabel yang punya penanda transaksi (No Invoice/Faktur/Pelanggan/
  Subtotal) dan tidak lagi membaca kolom `Qty` polos sebagai stok (temuan verify-2 TINGGI).
- Router data-cepat "gaji saya": cocok HANYA nama lengkap persis; jendela minggu/bulan dihitung
  di WIB eksplisit (pola time-series-engine), bukan TZ server.

## 6. Yang SENGAJA tidak disentuh

- BH-001 (credits/topup/route.ts) -- masih menunggu keputusan Mecca (0 diff).
- Dependabot 24 kerentanan dependency -- belum ditangani (lane package.json).
- PDF generation -- tidak ada renderer di server; UI/prompt jujur "buat Word lalu ekspor".
- `git remote -v` di VPS menampilkan token GitHub di URL remote. Ini lane infra kamu:
  sebaiknya pindah ke credential helper / deploy key. Kami tidak mengubah apa pun di server
  selain `git pull --ff-only && npm ci && npx prisma generate && npm run build && pm2 reload`.

## 6b. Keputusan produk Mecca (11 Sep sore) -- SUDAH DIPUTUSKAN dan dibangun

Mecca memutuskan sore ini: **CEO lihat semua; Finance dan Marketing disaring.** Marketing tidak
perlu tahu keuangan perusahaan. Ini dasar untuk role-role berikutnya nanti.

Yang dibangun (commit sore, lane AI/Pusat Data, nol migrasi):

- Modul baru `src/lib/ai-brain/data-visibility.ts` = satu-satunya sumber "siapa boleh lihat apa".
  File Pusat Data diklasifikasi otomatis ke KEUANGAN / SDM / MARKETING / UMUM (kata kunci nama
  file + kepadatan kata kunci isi; hasil impor otomatis payroll/ledger menang mutlak). Matriks:
  CEO semua; FINANCE keuangan+SDM+umum; MARKETING marketing+umum; file yang diupload sendiri
  selalu terlihat.
- Diterapkan di: `GET /workspace-files` (daftar; balasan tambah `visibility`, tiap file tambah
  `divisi`), `GET /workspace-files/[id]` (file di luar divisi = 404), konteks AI chat (file,
  blok keuangan, memori chat divisi lain hanya judul pertanyaannya), `dashboard-insight`
  (marketing tidak menerima blok keuangan/brief; akun finance@/marketing@ tidak bisa minta
  role lain lewat query), quick-data (saldo kas/tagihan/gaji tim hanya CEO+Finance; "gaji
  saya" tetap semua).
- Divisi pembaca diturunkan **server-side**: membership OWNER/ADMIN = CEO; email `ceo@` /
  `finance@` / `marketing@` (akun demo yang kamu buat di gateway) = divisi masing-masing;
  `body.userRole` / `?portal=` dari client cuma cadangan terakhir.

**Yang jadi bagian kamu (lane auth), kalau mau pagar keamanan penuh:** sekarang divisi
bergantung pada awalan email akun demo. Untuk akun nyata klien, butuh kolom divisi di
`WorkspaceMember` (atau di User) + diisi saat undang anggota. Begitu ada, `resolveDivisionRole()`
tinggal membaca kolom itu (satu fungsi, satu tempat). Sampai saat itu, akun non-demo yang
bukan OWNER/ADMIN memakai deklarasi client (bisa dipalsukan oleh client yang jahat -- ini pagar
produk, bukan pagar keamanan).

Keputusan Mecca lain sore ini: **fitur top-up/kredit (BH-001) = wilayah kamu**, tim AI tidak
menyentuh apa pun di situ.

## 7. Cara membalikkan (kalau ada masalah serius)

`git revert <commit ini>` lalu deploy ulang; atau rollback ke ddc2c40 (commit live sebelumnya).
Semua tag MemoryItem baru aman dibiarkan (kode lama tidak membacanya).

## 8. Dokumen pendukung

- 2026-09-11-CONTEXT-PACK-integrasi-ai-data-model-hemat.md -- akar masalah + kontrak modul.
- 2026-09-11-ADENDUM-fase2-tier-hemat-quickdata-autoingest.md -- tier revisi + fase 2.
- docs/2026-09-11-openrouter-catalog-screening.md -- harga live 437 model (dasar tier).
- scripts/screen-openrouter-catalog.mjs -- skrip screening ulang (key dari env).
- 2026-09-11-PANDUAN-TES-MECCA.md -- apa yang harus dicek per keluhan.
