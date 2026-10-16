# Untuk Fatur: Apa yang Kami Ubah, Kenapa, dan Cara Membatalkannya

Tanggal: 7 September 2026, dini hari + siang (ada 2 putaran kerja hari yang sama).
Ditulis oleh tim AI (Claude) atas permintaan Mecca.
Dasar cabang: `claude/ai-brain-upgrade-1sep`, sudah digabung penuh dengan `origin/main`
milikmu. Putaran pertama berhenti di `ba1a2fe` (sudah live sebelum putaran kedua ini).
Putaran KEDUA (dijelaskan di Bagian 3C, MENYUSUL setelah Bagian 3B) menambah commit
`9c6990e` di atasnya -- sudah di-push ke `main` DAN sudah di-deploy ke VPS, live di
klir.laserstory1.id per waktu dokumen ini ditulis.

Dokumen ini panjang karena kamu berhak tahu persis apa yang terjadi di kodemu.
Kalau kamu cuma punya 3 menit, baca Bagian 1, Bagian 3C, dan Bagian 8.
Kalau kamu mau tahu peta lengkap fitur (sudah jadi/setengah jalan/belum ada sama
sekali) plus jawaban soal tempat upload data dan bisa-tidaknya ditarik lagi, itu ada
di Bagian 9 -- ditulis 7 September siang atas permintaan Mecca, semua klaim dicek
ulang langsung ke kode hari yang sama (termasuk mengoreksi 2 klaim di roadmap 6
September yang ternyata sudah basi).

---

## Bagian 1 - Ringkasan Satu Halaman

```
SELURUH KODE KAMU DI src/           121 berkas    39.048 baris
  tidak kami sentuh sama sekali      93 berkas    76,9%
  tersentuh                          28 berkas    23,1%

DARI 28 BERKAS YANG TERSENTUH
  total baris kamu di dalamnya               21.349 baris
  baris kamu yang benar-benar dihapus/diubah  1.046 baris   4,9%
  baris kamu yang utuh                       20.303 baris  95,1%

1.046 baris itu = 2,68% dari seluruh kodemu.

BERKAS BARU MILIK TIM AI (tidak menyentuh punyamu)   89 berkas

SUDAH DI-PUSH DAN DI-DEPLOY: main = ba1a2fe, VPS sudah menjalankannya,
PM2 klir-os online, log galat kosong, klir.laserstory1.id hidup normal.
```

Bentuk kerjanya menambah, bukan merombak. Contoh paling jelas ada di
`documents/analyze/route.ts`: kami menambah 196 baris dan menghapus 2 baris, dan dua
baris itu komentar.

Tiga hal yang paling perlu kamu tahu:

1. `documents/extract-text/route.ts` milikmu kehilangan `withTenantGuard` waktu kamu
   menulis ulang berkas itu untuk dukungan Excel. Kami kembalikan pakai pola dan
   `minRole` versi kamu sendiri. Logika ekstraksi Excel/PDF/OCR buatanmu nol tersentuh.
2. Ada 7 endpoint yang bisa dibaca tanpa login di situs produksi. Kami buktikan
   langsung dari peramban yang belum login. Sekarang tertutup. Bukti di Bagian 4.
3. Semua yang kami ubah punya cara membatalkannya, tertulis per berkas di Bagian 3.
   Kalau ada yang kamu tidak setuju, tinggal batalkan bagian itu saja.

---

## Bagian 1B - SATU HAL YANG PALING PERLU KAMU PUTUSKAN (tidak kami sentuh)

Ini temuan terberat malam ini, dan kami sengaja TIDAK memperbaikinya karena berkasnya
ada di zona merah kami DAN karena ini kelihatannya memang kamu buat untuk memudahkan
demo. Keputusannya ada di kamu.

Berkas: `src/app/api/v1/auth/login/route.ts`. Tidak dibatasi mode pengembangan.

```
baris 48-72   AUTO-PROVISION
  email apa pun yang mengandung "ceo", "finance", "marketing", "admin",
  "anitech", atau "klir" dan belum ada di DB -> AKUN LANGSUNG DIBUAT,
  dan kalau perannya CEO, dibuat dengan isSuperAdmin: true

baris 86      EMPAT KATA SANDI BAWAAN
  kalau kata sandi asli tidak cocok, empat ini tetap diterima:
  123456, Password123!, password, admin123
```

Efeknya di produksi: siapa pun yang tahu alamat situs bisa masuk sebagai CEO
super-admin tanpa kredensial apa pun, cukup memakai email yang mengandung kata "ceo".
Ini bukan kebocoran baca seperti 7 endpoint yang kami tutup, ini pengambilalihan akun
penuh.

Kami paham ini kemungkinan besar disengaja supaya demo gampang. Karena itu usulan kami
tidak menghapus fiturnya, cuma memagarinya, dan pengalaman demo kamu tidak berubah sama
sekali selama `NODE_ENV` bukan production di mesin lokalmu:

```
Bungkus KEDUA blok itu dengan salah satu dari ini:
  if (process.env.NODE_ENV !== 'production') { ...blok demo... }
atau pakai bendera sendiri supaya bisa dinyalakan saat demo dan dimatikan setelahnya:
  if (process.env.KLIR_DEMO_LOGIN === 'true') { ...blok demo... }
```

Pola yang pertama sudah ada contohnya di `src/lib/auth.ts` milikmu sendiri, yang menolak
jalan kalau kunci masih bawaan sementara environment-nya produksi. Jadi ini meniru
kebiasaanmu, bukan memaksakan gaya kami.

Kalau kamu memang ingin membiarkannya sampai demo berikutnya selesai, itu keputusan yang
sah. Yang penting kamu tahu risikonya sebelum klien sungguhan menaruh data di sini.

---

## Bagian 2 - Peta Zona: Mana yang Kami Jauhi

Sebelum bekerja, kami memetakan berkasmu jadi empat zona dan menegakkannya secara
mekanis di setiap tahap. Verifikator menjalankan `git diff --numstat origin/main` untuk
tiap berkas zona merah, dan satu baris pun yang keluar membatalkan hasil kerja.

```
+==========================================================================+
| ZONA MERAH - TIDAK KAMI SENTUH SAMA SEKALI. Semua NOL-DIFF.              |
+==========================================================================+
| src/lib/auth.ts                    token, verifikasi, kata sandi          |
| src/lib/session.ts                 sesi dan cookie                        |
| src/lib/rate-limiter.ts            dipakai login/daftar/Google            |
| src/lib/prisma.ts                  koneksi basis data                     |
| src/app/api/v1/auth/ (6 route)     google, login, register, refresh,      |
|                                    logout, me                             |
| src/app/components/KlirAuthModal   modal login dan tombol Google          |
| src/app/page.tsx                   satu-satunya halaman aplikasi          |
| src/app/layout.tsx                                                        |
| src/app/components/KlirLandingV4   landing dan tombol Masuk               |
| src/app/components/klirV4Markup    markup tombol Masuk                    |
| prisma/schema.prisma               NOL model baru, NOL kolom, NOL migrasi |
| ecosystem.config.js                punyamu untuk PM2                      |
| scripts/deploy-vps.sh              punyamu untuk deploy                   |
+==========================================================================+
```

Alasan zona merah dipilih begitu: itu rantai login Google dan gerbang masuk aplikasi.
Kami buktikan dulu bahwa perbaikan `tenant-guard` tidak bisa merusaknya, lewat arah
ketergantungan:

```
lib/auth.ts  <-- diimpor oleh --  tenant-guard.ts     (satu arah)
lib/auth.ts  <-- diimpor oleh --  6 route auth
tenant-guard.ts  TIDAK diimpor satu pun berkas di rantai auth
```

Jadi `tenant-guard` membaca dari `auth`, bukan sebaliknya. Cara token dibuat, cara
Google memverifikasi, dan cara sesi disimpan tidak tersentuh.

```
ZONA ORANYE - boleh disentuh, tapi ADITIF MURNI (menambah, bukan membongkar)
  brain/chat/route.ts, documents/extract-text/route.ts,
  documents/analyze/route.ts, security/approvals/route.ts,
  workspaces/[workspaceId]/profile/route.ts, brain/weekly-analysis/route.ts,
  9 route brain lainnya, ai-brain/context-engine.ts,
  MarketingAIAssistantView, ExecutiveAIAssistantView,
  FinanceModuleView, MarketingModuleView

ZONA KUNING - boleh, tapi wajib lulus gerbang terukur
  src/lib/tenant-guard.ts   diimpor 52 berkas lain. Gerbangnya: 5 uji di
  tests/brain-readonly-guard.test.ts yang tadinya GAGAL harus jadi LULUS,
  dan nol uji lain boleh rusak. Sekarang lulus semua.

ZONA HIJAU - bebas: 84 berkas baru milik tim AI
```

---

## Bagian 3 - Apa yang Berubah di Berkasmu, Per Berkas

Urutan dari yang paling perlu kamu perhatikan.

### 3.1 `src/app/api/v1/documents/extract-text/route.ts` (+208 / -5)

**Apa yang terjadi.** Di titik pisah cabang kami (`57bcf65`), berkas ini dibungkus
`withTenantGuard` di baris 2 dan 92. Di push finalmu, pembungkus itu tidak ada lagi,
`export async function POST` polos di baris 164. Kemungkinan besar terlewat waktu kamu
menulis ulang berkas ini untuk dukungan Excel dan OCR. Jejak kami di berkas ini nol
sebelum malam ini, jadi ini bukan kami yang menghapusnya.

Cek sendiri:
```
git show 57bcf65:src/app/api/v1/documents/extract-text/route.ts | grep -n withTenantGuard
git show origin/main:src/app/api/v1/documents/extract-text/route.ts | grep -n withTenantGuard
```

**Yang kami lakukan.** Mengembalikan pembungkusnya dengan `minRole: 'MEMBER'`, persis
seperti versi lamamu, tidak dinaikkan. Nol baris logika ekstraksi Excel/PDF/OCR/Word
buatanmu yang disentuh, hanya dibungkus.

**Tambahan aditif.** Kalau berkas yang diunggah dikenali sebagai buku besar (xlsx/xls
dengan struktur transaksi), respons mendapat field TAMBAHAN berisi angka terverifikasi
dan daftar selisih. Field lama tidak berubah bentuknya, jadi pemanggil lama aman. Kalau
parser gagal atau berkas bukan buku besar, jalur lamamu berjalan persis seperti
sebelumnya. Kegagalan parser tidak pernah menggagalkan permintaan.

**Kenapa ini penting.** Ini yang membuat parser keuangan deterministik kami akhirnya
menyentuh pengguna. Sebelumnya parser itu menempel di `/documents/analyze`, padahal
ketiga tampilan asistenmu memanggil `/documents/extract-text`. Jadi fitur anti-halusinasi
yang lahir dari kegagalan demo tidak pernah sekalipun dipakai.

**Cara membatalkan.** Hapus baris import `withTenantGuard`, ganti
`export const POST = withTenantGuard(async (req, { auth }) => {` kembali ke
`export async function POST(req: NextRequest) {`, dan hapus `}, { minRole: 'MEMBER' });`
di penutup. Untuk cabang parser, hapus blok yang ditandai komentar wiring parser.

### 3.2 `src/lib/tenant-guard.ts` (+49 / -3) - ZONA KUNING

**Apa yang kami temukan.** Baris 176 versimu:
```
const isOwner = workspace.ownerId === user.id || user.isSuperAdmin || !token;
```
Klausa `|| !token` membuat permintaan TANPA token diperlakukan sebagai pemilik
workspace. Ditambah blok di baris 86-104 yang mengambil user pertama di basis data
kalau token tidak ada atau gagal diverifikasi. Gabungan keduanya adalah alasan kenapa
endpoint brain bisa dibaca tanpa login di produksi.

**Yang kami lakukan.** Meniru pola yang sudah ada di `src/lib/auth.ts` milikmu sendiri,
yang menolak jalan kalau kunci masih bawaan sementara `NODE_ENV` produksi. Kami pasang
gerbang yang sama: jalan pintas tanpa token hanya hidup di mode pengembangan, mati di
produksi. `ecosystem.config.js` milikmu sudah menyetel `NODE_ENV=production` di VPS,
jadi gerbang ini aktif beneran di sana.

Klausa `|| !token` di baris isOwner juga dihapus. Alur dev yang sah tetap lewat
`ownerId === user.id`. Yang hilang cuma satu skenario: memukul workspace yang bukan
milikmu tanpa token, dan itu memang skenario serangan.

**Gerbang penerimaan.** 5 uji di `tests/brain-readonly-guard.test.ts` yang tadinya
gagal (mengharapkan 401/403, mendapat 200) sekarang lulus penuh, dan nol uji lain rusak.

**Cara membatalkan.** Hapus dua blok yang ditandai komentar GERBANG PRODUKSI, dan
kembalikan `|| !token` di baris isOwner.

### 3.3 `src/app/api/v1/security/approvals/route.ts` (+35 / -29)

GET, POST, dan PATCH ketiganya tanpa pemeriksa autentikasi. Yang paling berat: POST dan
PATCH bisa dirangkai tanpa login untuk membuat lalu menyetujui tiket sendiri, sementara
jalur persetujuannya memanggil penghapusan sungguhan lewat `resolveApprovalRequest`.

Yang kami lakukan: memasang penjaga di ketiganya (GET VIEWER, POST MEMBER, PATCH OWNER),
meniru pola dari `documents/analyze/route.ts` dan `subscription/upgrade/route.ts`.
`workspaceId` dan `resolvedBy` sekarang diambil dari hasil autentikasi, bukan dari badan
permintaan. Fallback lama yang mengambil workspace terbaru di seluruh basis data dihapus.

Catatan untuk kamu: `minRole: 'OWNER'` di PATCH dipilih karena deskripsi tiketmu sendiri
menyebut memerlukan persetujuan Owner/CEO, dan modal pemicunya hanya terbuka dari portal
CEO. Kalau menurutmu terlalu ketat, turunkan ke ADMIN, itu satu kata.

### 3.4 `src/app/api/v1/workspaces/[workspaceId]/profile/route.ts` (+55 / -38)

Tanpa penjaga, bisa baca DAN tulis profil usaha tenant lain. Ada fallback yang mengambil
workspace terbaru di seluruh basis data kalau id tidak ketemu. Blok catch juga mengirim
pesan galat Prisma mentah ke pemanggil.

Yang kami lakukan: memasang penjaga meniru pola `grants/route.ts` dan `members/route.ts`
di folder yang sama, menghapus fallback lintas-tenant, dan mengganti pesan galat mentah
dengan pesan umum. `console.error` lengkap tetap di sisi server supaya kamu tidak
kehilangan kemampuan menelusuri.

### 3.5 `src/app/api/v1/brain/chat/route.ts` (+268 / -80)

Dari 1.182 baris milikmu, sekitar 80 baris berubah. Isinya guard tenant, jalur angka
terverifikasi dari parser, dan otak asisten yang disusun ulang.

Dua kemampuanmu yang sempat hilang saat merge dan sudah kami kembalikan:
- `generateSedanceImage` (fungsi gambarmu, sekitar 50 baris) dikembalikan PERSIS
  byte-identik, dipasang sebagai jaring pengaman kalau jalur gambar kami gagal.
- Pemilih workspace lewat `body.workspaceId` yang dikirim tampilanmu, dikembalikan
  lewat opsi `requiredWorkspaceId` yang sudah ada di `tenant-guard` milikmu, jadi
  keanggotaannya tetap diverifikasi.

Alur persetujuan CEO milikmu (`PURGE_INVOICES`, `DELETE_PROFILE`) utuh, sudah kami cek
per kata kunci.

### 3.6 Sembilan route `brain/*` (masing-masing sekitar +7 / -8)

`alerts`, `context`, `data-trust`, `decision-memory`, `execute`, `generate`, `nudges`,
`recommendations`, `simulate`. Perubahannya kecil dan seragam: memasang pemeriksa
autentikasi. Pola lama jatuh ke UUID workspace yang ditulis tetap di kode, dan itu
berarti data tenant bisa tertukar.

### 3.7 `src/lib/ai-gateway.ts` (+160 / -99)

Dari 804 baris, sekitar 99 berubah. Ini dari fase pengerjaan media bersama Codex, dan
isinya eksekusi langsung dari audit di `2026-09-04-codex-handoff.md` poin P1 sampai P4:
rute provider OpenRouter, perbaikan parse JSON di jalur retry, penerusan
`maxOutputTokens`, dan rekonsiliasi `generateImage`. Struktur cascade provider milikmu
tidak dibongkar, hanya ditambah satu rute di antara yang sudah ada.

### 3.8 `src/lib/ai-brain/context-engine.ts` (+43 / -3)

`context-engine` milikmu hanya membaca memoryItem berawalan `[COMPANY_PROFILE]`.
Modul ingatan dokumen milik kami menulis dengan awalan `[COMPANY_KNOWLEDGE]`. Akibatnya
setiap dokumen yang diunggah pengguna memang dicatat, tapi otak AI tidak pernah
membacanya.

Yang kami lakukan: menambah query terpisah untuk `[COMPANY_KNOWLEDGE]`, hasilnya masuk
sebagai field baru yang opsional. Cara kamu membaca `[COMPANY_PROFILE]` tidak berubah
sedikit pun, tidak digabung, tidak dirapikan. Perhitungan skor kesehatan dan TTL cache
tidak tersentuh.

### 3.9 `FinanceModuleView.tsx` (+233 / -201) dan `MarketingModuleView.tsx` (+166 / -47)

Ini soal angka yang keluar ke tangan klien. Kami membuka berkas hasil ekspor dari situs
produksi. Semua angkanya Rp 0 karena workspace-nya memang kosong, tapi narasi di
sebelahnya percaya diri dan salah:

```
Total Pendapatan  Rp 0       "Pertumbuhan pendapatan meningkat +28.5% Month-over-Month"
Laba Bersih       Rp 0       "Margin laba bersih prima di level 0%"
Ketahanan Kas     0+ Bulan   "Tingkat likuiditas sangat aman dengan risiko nol"
```

Angka +28.5 persen itu ditulis tetap di kode, jadi muncul sama persis untuk usaha mana
pun. Kaki dokumen juga mengklaim "Terverifikasi secara digital" dan "Disetujui oleh
Management", padahal tidak ada verifikasi dan tidak ada persetujuan.

Yang kami lakukan: mengganti kalimat tetap itu dengan kalimat yang dihitung dari angka
yang sudah tersedia di berkas yang sama. Kalau datanya tidak cukup, ditulis apa adanya,
bukan dikarang jadi kesimpulan positif. `arAvgDays` tidak lagi dipatok 18, dan kelompok
umur piutang 31-60 hari yang dulu selalu nol sekarang terisi benar. Di Modul Pemasaran,
angka funnel dan demografi yang belum punya sumber data ditandai jelas sebagai contoh
tampilan. Tata letak, warna, dan susunan kartu tidak diubah.

### 3.10 `ExecutiveAIAssistantView.tsx` (+101 / -7)

Fungsi `getDemoReply` dipakai sebagai cadangan saat panggilan ke `/api/v1/brain/chat`
gagal, dan formatnya sama persis dengan jawaban asli termasuk penanda sumber. Pengguna
tidak bisa membedakan. Ini kandidat penjelas paling kuat untuk insiden demo di mana
asisten menyebut angka salah dengan percaya diri.

Yang kami lakukan: saat server gagal, tampilkan keadaan gagal yang jujur. Dan tombol
"Setujui & Terapkan ke Dashboard" sekarang meminta konfirmasi jujur sebelum menimpa
angka dashboard dengan nilai simulasi.

### 3.11 Sisanya yang kecil

`ai-brain/index.ts` (+10, murni ekspor modul baru), `ai-brain/types.ts` (+12, satu field
opsional), `generation-engine.ts` (+1/-1, dukungan ekstensi webp), `package.json` (+3,
tiga dependensi untuk media), `brain/weekly-analysis/route.ts` (+30/-1, penjaga plus
penanda bahwa isinya masih contoh).

Satu koreksi jujur: `src/lib/media-provider.ts` (+185/-166) selama ini kami masukkan ke
daftar "berkas Fatur yang diubah". Itu keliru. Berkas itu dibuat tim AI tanggal 3
September dan kamu tidak pernah menyentuhnya (`git diff 57bcf65 origin/main` untuk
berkas itu kosong). Sudah kami keluarkan dari hitungan.

---

## Bagian 3B - Gelombang Terakhir: Otak Asisten dan Parser

Tiga hal ini dikerjakan setelah bagian di atas, dan sebagian besar hidup di berkas
BARU milik tim AI supaya jejak di kodemu tetap kecil.

### 3B.1 Otak asisten disusun ulang jadi 4 lapis (berkas baru)

Sebelumnya ada satu `dynamicSystemInstruction` bernama "KLIR Executive AI Brain" di
`brain/chat/route.ts` sekitar baris 1398, dipakai untuk ketiga portal. Tidak ada pembeda
gaya per peran, tidak ada pembeda kedalaman per pengguna. Pemilik warung dan direktur
perusahaan mendapat kalimat yang sama persis.

Yang kami buat, semuanya di berkas baru:
```
src/lib/ai-brain/persona-skin.ts    instruksi disusun jadi 4 lapis:
                                    Persona Skin, Utility Brain,
                                    Boundary Engine, Output Integrity
src/lib/ai-brain/answer-mode.ts     mode dikenali dari CARA pengguna bertanya
```
Isi instruksi lamamu tidak dibuang, cuma ditata ke lapis yang sesuai.

Mode-nya dua: pertanyaan pendek dan langsung mendapat jawaban ringkas dengan angka di
depan. Kalimat dengan tanda bingung ("kenapa", "gimana caranya", "belum paham")
mendapat penjelasan bertahap dengan analogi dari dunia usaha si pengguna. Yang
menentukan bukan tombol pengaturan, tapi cara dia mengetik.

Boundary Engine memuat tiga larangan yang lahir dari luka nyata produk ini: dilarang
menyebut angka yang tidak berasal dari data terverifikasi, kalau data tidak ada harus
bilang tidak ada, dan dilarang mengklaim sesuatu sudah dikerjakan kalau sistem cuma
mengubah status di layar.

### 3B.2 Parser dikeraskan terhadap data berantakan (berkas milik tim AI)

`ledger-parser.ts`, `date-normalizer.ts`, dan `document-checker.ts` dikeraskan terhadap
enam pola kekacauan data yang ditemukan di database HR sebuah perusahaan besar sungguhan
(riset terpisah, dokumennya ada di folder yang sama):

```
1. penanda kosong ganda: satu spasi dan NULL dipakai campur
2. presisi tanggal tidak konsisten dalam satu berkas
3. konsep sama, tipe data beda antar sheet
4. sheet berheader lengkap tapi nol baris data
5. duplikasi kembar (Sheet1 dan Sheet1 (2))
6. pergeseran penamaan kolom antar berkas untuk konsep yang sama
```

Perilaku untuk berkas yang sudah berhasil diproses tidak berubah, dibuktikan lewat uji
lama yang tetap lulus. Prinsipnya tetap: kalau data ambigu, parser MELAPORKAN keraguan,
bukan menebak diam-diam.

### 3B.3 Gerbang persetujuan CEO (`brain/chat/route.ts`, aditif)

Gerbang persetujuan CEO milikmu menentukan siapa CEO dari `body.userRole` yang dikirim
klien. Karena jalur persetujuannya memanggil penghapusan sungguhan, kami tambahkan
syarat: peran juga harus cocok dengan hasil autentikasi server. Mekanisme tiket dan
challenge buatanmu tidak dibongkar, cuma ditambah satu syarat.

**Cara membatalkan.** Hapus syarat tambahan yang ditandai komentar di sekitar gerbang
itu, dan `isCeoOrOwner` kembali bekerja seperti semula.

### 3B.4 `CompanyDataDashboard.tsx` (aditif)

Kartu "Perlu Tindakan", "Rekomendasi Aksi AI", dan "Beban Kerja Divisi" tetap
menampilkan data contoh fiktif untuk akun baru yang belum punya transaksi. Pagar
akun-baru yang sudah kamu punya (`f.rev === 0`) cuma menutup sebagian kartu keuangan.
Kami perluas pagarnya ke tiga kartu itu. Untuk akun yang sudah punya data transaksi
asli, tampilannya tidak berubah sama sekali.

---

## Bagian 3C - Putaran Kedua: Kesesuaian Peran (CEO/Finance/Marketing) + Sisa Data Contoh

Ini kerjaan setelah Bagian 1-3B sudah live. Mecca minta audit ulang dengan aturan
sederhana: **CEO harus bisa lihat/pakai SEMUA yang bisa dipakai Finance dan Marketing
(dia atasan tertinggi), sementara AI Assistant Finance cuma boleh menawarkan hal
finansial, dan AI Assistant Marketing cuma hal marketing** -- jangan sampai AI Assistant
Finance nawarin "bikin naskah video promosi", atau AI Assistant Marketing nawarin
"evaluasi laporan keuangan perusahaan".

Cara kerja: dispatch 6 agent baca-saja (satu per komponen: 3 AI Assistant + 3 dashboard),
tiap agent full-read filenya sendiri dan cuma boleh lapor masalah dengan bukti file:line
+ kutipan kode persis. Hasilnya digabung jadi satu rencana tambal per-file, lalu SETIAP
item di rencana itu diverifikasi ulang oleh agent lain yang skeptis (baca ulang sendiri,
boleh menolak kalau buktinya tidak cocok). Hasil: 36 temuan mentah, 0 ditolak total, 9
dikoreksi (rentang baris meleset, ada yang kelewat, ada yang bentrok gaya kode), 30
lolos langsung. Semua tambalan lalu diterapkan satu per satu oleh kami sendiri (bukan
banyak agent nulis bareng) supaya tidak ada yang saling timpa.

### Yang ditemukan dan diperbaiki

**ExecutiveAIAssistantView.tsx (CEO) -- CEO ternyata BUKAN superset, kebalikan dari
aturan yang seharusnya:**
- Nol kemampuan pajak/akuntansi apapun -- Finance punya "Estimasi Setoran Pajak
  PPh/PPN", "Rekonsiliasi rekening koran", "Kalkulator Pajak Bisnis", "Generator Invoice
  Formal", "SOP Kas & Reimbursement", CEO tidak punya satupun padanannya. Sekarang
  ditambahkan, teksnya disalin verbatim dari Finance supaya perilakunya identik.
- Tombol "Buat Gambar"/"Buat Audio" CEO ternyata SIMULASI CSS lama (generate teks +
  gambar tiruan), BUKAN generate sungguhan lewat Media Studio seperti tombol berlabel
  SAMA PERSIS di Marketing. Sekarang disamakan -- CEO klik "Buat Gambar" dapat generate
  asli, bukan tiruan. Ditambah juga "Rekam Suara" dan "Buat Video (Segera)" yang
  sebelumnya nol.
- Statistik "File dibuat" di beranda CEO permanen +4 dari 4 file contoh bawaan,
  padahal komentar kodenya sendiri mengklaim "angka nyata, bukan karangan". Sekarang
  dihitung dari riwayat chat sungguhan, sama seperti Finance dan Marketing.
- Tombol "Kelola plugin" dihapus -- badge-nya (mis. "5/5") tidak pernah bisa berubah
  karena fungsi togglenya tidak pernah dipanggil dari UI manapun, dan tombolnya
  duplikat fungsi "Pengaturan CEO" di atasnya.

**FinanceAIAssistantView.tsx (Finance) -- galeri "Mulai dari tugas nyata" ternyata
menu yang SAMA PERSIS untuk ketiga peran (by design lama mockup), jadi Finance
menawarkan tugas Marketing murni:**
- Kategori "Materi promosi" (naskah video promosi, banner, konten sosial) diganti
  "Pajak & kepatuhan" (estimasi pajak, rekonsiliasi bank, SOP kas).
- Kartu "Evaluasi performa iklan bulan ini" (metrik Marketing) diganti "Deteksi
  anomali biaya operasional".
- 2 dari 4 file contoh di panel "File hasil AI" Finance (storyboard video promosi,
  slide "performa iklan per kanal") diganti dokumen finansial.
- Link "Integrasi Akuntansi & Pajak" dulu selalu buka tab "Buku Kas" (bukan tab
  Pajak seperti namanya) -- sekarang benar-benar buka tab Pajak.
- "Kelola plugin" dihapus (duplikat "Pengaturan Finance").

**MarketingAIAssistantView.tsx (Marketing) -- galeri yang sama juga menawarkan tugas
Finance:**
- Kartu "Ringkas arus kas 30 hari terakhir" (tugas Finance) diganti "Laporan
  performa marketing bulan ini".
- Prop `onRoleChange` diterima dari `page.tsx` tapi tidak pernah dipasang ke tombol
  apapun -- ditambahkan tombol "Ganti Divisi" di sidebar.
- Item "Tulis & Jelaskan Kode Program" di sidebar (tidak relevan marketing, dan
  memang tidak ada di grid "Semua kemampuan AI" yang sudah dikurasi) diganti
  "Jadwal Konten Sosial Sepekan".
- Tiga angka fiktif lain yang ketemu di jalan (bukan bagian dari audit role-fit,
  tapi kelas bug sama dengan yang dibereskan Bagian 3.9): fallback "Runway kas 99
  bulan", org-chart "5/5/3/2 orang per divisi", dan grafik "Output 6 pekan
  terakhir" yang 5 dari 6 batangnya karangan tetap. Ketiganya sekarang honest-empty
  kalau datanya memang belum ada, mengikuti pola `hasCash`/`hasRoas` yang sudah ada
  di file yang sama.

**CompanyDataDashboard.tsx -- yang paling serius, tautan AKTIF:**
- `sendInvoiceReminder()` masih memanggil `window.open()` sungguhan ke nomor
  WhatsApp dan alamat email milik identitas contoh lama ("Sentosa Abadi") yang
  namanya sudah kami generic-kan di tempat lain sesi sebelumnya -- titik ini
  kelewat karena identitasnya "bersembunyi" di dalam field email/nomor telepon,
  bukan di teks tampilan. Ini satu-satunya titik yang benar-benar MENGIRIM aksi ke
  identitas lama (bukan cuma tampilan), jadi kami tandai paling berisiko. Sudah
  di-redact ke placeholder generik.
- Caption tren skor kesehatan bisnis ("Puncaknya 90 di Juli...") kontradiksi
  langsung dengan grafiknya sendiri yang menunjukkan Juli = 0 untuk semua tenant.
  Diganti kalimat yang jujur sesuai data yang benar-benar ada.
- Tombol "Audit AI" bisa diklik tanpa efek apapun untuk tenant baru (alertsnya
  kosong) -- sekarang disembunyikan kalau memang tidak ada isinya.
- 2 blok kode mati dihapus (cabang narasi yang secara matematis tidak pernah bisa
  aktif, dan satu variabel yang dihitung tapi tidak pernah dirender).

**FinanceModuleView.tsx:**
- Label "terlambat N hari" pada invoice jatuh tempo TIDAK PERNAH muncul sejak awal
  -- regex-nya mencari pola yang mustahil ada di string tanggal terformat. Sekarang
  dihitung dari tanggal ISO asli yang sudah ada di data invoice.
- Tombol "Tagih"/"Kirim Tagihan Sekarang" mengklaim "berhasil dikirim ke klien"
  padahal cuma mengubah status di layar, nol email/WA sungguhan terkirim (belum ada
  endpoint untuk itu). Label diganti jujur ("ditandai ditagih manual").
- Widget "Kewajiban terjadwal" strukturnya SELALU kosong (bukan state, tidak
  pernah di-fetch) -- terlihat seperti hasil pengecekan nyata padahal fiturnya
  memang belum tersambung ke data apapun. Sekarang menampilkan status jujur.
- Tombol "Sinkronisasi" dulu cuma baca ulang cache lokal, sekarang juga menarik
  ulang dari server.

**MarketingModuleView.tsx:**
- Label bulan di grafik hardcode berakhir "Agu" -- sekarang salah label sejak
  lewat Agustus, dan akan terus salah setiap bulan bukan Agustus selama-lamanya.
  Diganti hitungan dinamis dari tanggal asli.
- Teks "buat strategi promosi baru melalui AI Studio" di layar kosong kampanye
  dulu cuma teks statis tanpa tombol, padahal `page.tsx` SUDAH mengirim handler
  yang berfungsi (`onOpenAIStudio`) -- cuma lupa dipasang di sini. Sekarang jadi
  tombol sungguhan.
- Header "Laporan marketing" mengklaim "Dibuat otomatis tiap akhir bulan" padahal
  tidak ada satupun generator/cron/endpoint terkait di manapun -- diganti "Segera
  hadir".

### Yang KAMI TIDAK putuskan sendiri (perlu kamu/Mecca)

1. `CompanyDataDashboard.tsx`: kartu rekomendasi AI Marketing menampilkan 4 nama
   karyawan spesifik (Rina Prameswari, Dimas Aryo, dst) dengan jumlah tugas/overdue
   per orang -- 100% contoh karena belum ada backend struktur-tim sama sekali. Ini
   sudah mengikuti pola gating yang sama dengan kartu rekomendasi AI lain yang
   sudah diterima sesi sebelumnya (margin drop 0,6 poin, PO Rp 3.200.000, dst).
   Apakah nama-karyawan-spesifik ini termasuk kelas yang harus digenerik juga, atau
   termasuk konten ilustratif yang sudah oke seperti rekomendasi lain? Kami tidak
   memaksakan jawaban.
2. Tag "(Aktif)" di dropdown bulan dashboard CEO kami pindah dari Agustus ke
   September (sesuai default sebenarnya). Kalau maksudnya tag itu HARUS selalu
   ikut bulan kalender asli (bukan default tetap yang nanti basi lagi), itu
   perubahan lebih besar -- belum kami kerjakan.
3. Widget "Alur uang bulan ini" di FinanceModuleView memakai 5 rasio biaya yang
   dipatok tetap (24% HPP, 9% Marketing, dst), padahal breakdown NYATA per kategori
   sudah ada di widget "Kategori pengeluaran" di sebelahnya. Kami cuma menambah
   disclaimer, belum menghitung ulang dari kategori asli karena butuh keputusan
   bisnis (kategori transaksi mana masuk bucket mana) yang bukan wewenang kami.
4. `MarketingModuleView.tsx`: `campaigns` (daftar kampanye iklan) SELAMANYA kosong
   -- bukan bug frontend, memang belum ada endpoint API kampanye iklan di backend
   sama sekali. Ini item backend terpisah, bukan sesuatu yang bisa ditambal di
   tampilan saja.
5. Prop `workspaceId` di `MarketingModuleView.tsx` diterima tapi tidak pernah
   dipakai di `fetch('/api/v1/promo/coupons')` (cuma andalkan cookie sesi). Kami
   tidak berani asumsikan itu aman tanpa baca `route.ts` backend-nya -- mohon
   diverifikasi apakah endpoint itu sudah scoping tenant dengan benar.

**Verifikasi putaran kedua ini:** `tsc` 0 galat, 464/464 uji tetap lulus,
`next build` EXIT 0, dan dicek langsung di peramban (bukan cuma baca kode) --
screenshot tiap portal (CEO/Finance/Marketing) dicocokkan satu-satu ke kode yang
diubah, termasuk klik tombol "Buat Gambar" CEO untuk memastikan Media Studio
sungguhan yang terbuka, bukan simulasi lama.

---

## Bagian 4 - Bukti Keamanan, Diuji Bukan Diklaim

Sebelum perbaikan, kami memukul situs produksi dari peramban yang belum login:

```
/api/v1/brain/weekly-analysis          200   ringkasan kinerja + skor kesehatan usaha
/api/v1/brain/alerts                   200   bocorkan workspaceId + isi peringatan
/api/v1/brain/tools                    200
/api/v1/security/approvals             200
/api/v1/workspaces/<ngawur>/profile    500   galat Prisma mentah ikut terkirim
```

Sesudah perbaikan, dijalankan lokal dengan `NODE_ENV=production` supaya setara VPS:

```
/api/v1/brain/alerts                   401
/api/v1/brain/nudges                   401
/api/v1/brain/recommendations          401
/api/v1/brain/data-trust               401
/api/v1/brain/decision-memory          401
/api/v1/security/approvals             401
/api/v1/brain/weekly-analysis          401
/api/v1/workspaces/<ngawur>/profile    401   dan galat Prisma tidak lagi bocor
/api/v1/documents/extract-text POST    401
/api/v1/documents/analyze POST         401
/api/v1/brain/tools                    200   SENGAJA dibiarkan publik
halaman utama                          200   landing tetap hidup
```

`brain/tools` sengaja tidak kami tutup karena isinya cuma daftar kemampuan tanpa data
tenant, dan menutup sesuatu yang sengaja dibuka juga bentuk merusak kerjaan orang.
Kalau menurutmu itu keliru, tinggal bilang.

---

## Bagian 5 - Fitur Baru dari Tim AI (84 berkas, tidak menyentuh punyamu)

```
ENDPOINT BARU
  /api/v1/documents/from-template   buat dokumen dari 19 template siap pakai
  /api/v1/brain/notebook            9 jenis kartu pemahaman dokumen
  /api/v1/media/generate            gambar dan suara
  /api/v1/media/models              katalog model yang tersedia
  /api/v1/media/transcribe          rekam suara jadi teks

MODUL PARSER KEUANGAN DETERMINISTIK
  ai-brain/ledger-parser.ts         baca buku besar dari Excel
  ai-brain/ledger-validator.ts      cek silang laba-rugi dan neraca
  ai-brain/date-normalizer.ts       tanggal beragam format
  ai-brain/document-checker.ts      pemeriksa anomali dokumen umum
  ai-brain/tabular-checker.ts
  Prinsipnya: ANGKA DIHITUNG KODE, AI cuma menceritakan. Sudah diuji ke
  berkas asli calon klien berisi 583 transaksi.

TEMPLATE DOKUMEN (19)
  doc-templates/financial-report-templates.ts   5 laporan keuangan
  doc-templates/invoice-templates.ts            5 invoice dan penawaran
  doc-templates/deck-templates.ts               5 deck presentasi
  doc-templates/video-brief-templates.ts        4 brief video

KOMPONEN UI BARU
  doc-templates/          studio template dokumen
  marketing-media/        studio media, hasil, perekam suara
```

---

## Bagian 6 - Cara Menjalankan dan Menguji

Semua perintah di bawah ini benar-benar kami jalankan, bukan disalin dari ingatan.

```
node node_modules/typescript/bin/tsc --noEmit
  -> 0 error

node --experimental-test-module-mocks --import tsx --test tests/*.test.ts
  -> tests 464 | pass 464 | fail 0 | todo 0
  (sebelum kerjaan malam ini: 380 total, 375 lulus, 5 todo yang sebenarnya GAGAL)

node node_modules/next/dist/bin/next build
  -> Compiled successfully, seluruh route terkompilasi
  (ini perintah yang sama dipakai scripts/deploy-vps.sh milikmu)
```

Variabel lingkungan: fitur baru kami memakai `GEMINI_API_KEY` dan `GROQ_API_KEY` yang
sudah ada di `.env` VPS. Dua variabel opsional `GEMINI_IMAGE_MODEL` dan `GROQ_STT_MODEL`
punya nilai bawaan di kode. Jadi kamu **tidak perlu menambah satu pun variabel baru**.

Basis data: kami tidak menambah model, kolom, atau migrasi apa pun. Verifikasi:
`git diff origin/main -- prisma/` hasilnya kosong.

---

## Bagian 7 - Yang Menunggu Keputusanmu

1. `minRole: 'OWNER'` di PATCH `security/approvals`. Kalau CEO di instalasi nyata bukan
   pemilik workspace, dia akan tertolak 403. Turunkan ke ADMIN kalau perlu.
2. Empat modul Enterprise (Employee Master, Offboarding, Payroll-GL, SOP-KPI) sudah
   punya spek lengkap di `KLIR/05-DOKUMEN/aktif/2026-09-06-spek-fitur-*.md`, tapi
   butuh tabel baru. Kami tidak mengerjakannya karena skema adalah wilayahmu.
3. Gerbang portal di `page.tsx` memakai kata sandi `123456` yang ditulis di sisi klien,
   jadi terbaca di berkas JavaScript yang dikirim ke peramban, dan satu kata sandi
   dipakai untuk ketiga portal. Kami tidak menyentuhnya. Kalau itu memang untuk
   memudahkan demo, wajar.
4. Jebakan di `scripts/deploy-vps.sh` baris `git pull origin main || true`. Kalau tarik
   gagal, skrip tetap lanjut dan tetap membangun, lalu mencetak berhasil, padahal yang
   dibangun kode lama. Saran: ganti jadi tanpa `|| true`, atau verifikasi commit
   berubah sesudah tarik.
5. (Baru, putaran kedua) 5 item di akhir Bagian 3C -- nama karyawan contoh di kartu
   rekomendasi AI, tag "(Aktif)" bulan, mapping kategori biaya di FinanceModuleView,
   endpoint kampanye iklan Marketing yang belum ada, dan verifikasi guard tenant di
   `promo/coupons/route.ts`.

---

## Bagian 8 - Briefing Siap Salin untuk AI Coding Kamu

Bagian ini sengaja ditulis berdiri sendiri supaya bisa kamu salin-tempel langsung ke
Antigravity atau OpenCode tanpa perlu menjelaskan ulang.

```
KONTEKS PROYEK
Aplikasi KLIR, Next.js App Router + Prisma + TypeScript, satu halaman di src/app/page.tsx.
Tiga portal (CEO, Finance, Marketing) dirender dari halaman yang sama berdasarkan state.
Basis data Postgres (Neon). Deploy ke VPS lewat scripts/deploy-vps.sh, dijalankan PM2
dengan nama klir-os di port 3000.

PERUBAHAN YANG BARU MASUK DARI TIM AI
1. Autentikasi: withTenantGuard dipasang ulang di documents/extract-text, dan dipasang
   baru di security/approvals serta workspaces/[workspaceId]/profile.
2. src/lib/tenant-guard.ts: jalan pintas tanpa token sekarang hanya hidup saat
   NODE_ENV bukan production. Di produksi, permintaan tanpa token valid ditolak 401.
3. context-engine.ts membaca dua tanda memoryItem sekarang: [COMPANY_PROFILE] seperti
   sebelumnya, ditambah [COMPANY_KNOWLEDGE] sebagai field baru yang opsional.
4. documents/extract-text mengembalikan field tambahan berisi angka terverifikasi
   kalau berkas dikenali sebagai buku besar. Field lama tidak berubah.
5. Angka yang dulu ditulis tetap di FinanceModuleView dan MarketingModuleView kini
   dihitung dari data, atau ditandai jelas sebagai contoh kalau sumbernya belum ada.
6. (Putaran kedua, Bagian 3C) Kesesuaian peran: CEO sekarang superset asli (semua
   kemampuan Finance + Marketing juga muncul di AI Assistant-nya), sementara galeri
   "Mulai dari tugas nyata" di Finance dan Marketing tidak lagi identik satu sama
   lain -- masing-masing cuma menawarkan tugas yang relevan ke perannya.
7. (Putaran kedua) Satu tautan AKTIF (window.open ke WhatsApp/email) di
   CompanyDataDashboard.tsx yang masih menunjuk identitas contoh lama sudah
   di-redact -- lihat Bagian 3C untuk detail kenapa ini beda kelas dari sisa
   temuan lain (yang lain cuma tampilan, ini benar-benar mengirim aksi).

YANG TIDAK BOLEH KAMU UBAH TANPA BICARA DULU
- src/lib/auth.ts, src/lib/session.ts, src/lib/rate-limiter.ts, src/lib/prisma.ts
- src/app/api/v1/auth/ (semua 6 route, termasuk google)
- src/app/components/KlirAuthModal.tsx
- src/app/page.tsx, src/app/layout.tsx
- prisma/schema.prisma
- ecosystem.config.js, scripts/deploy-vps.sh
Berkas-berkas itu menyangga login Google dan gerbang masuk aplikasi.

ATURAN SAAT MENAMBAH FITUR DI SINI
- Endpoint baru WAJIB dibungkus withTenantGuard dari @/lib/tenant-guard.
  Ambil workspaceId dari auth.workspace.id, JANGAN dari badan permintaan atau query.
- Jangan mengirim err.message mentah ke pemanggil. Pakai pesan umum, log lengkap
  di server pakai console.error.
- Angka keuangan yang ditampilkan ke pengguna WAJIB berasal dari data. Kalau belum
  bisa dihitung, tampilkan keadaan jujur, jangan angka pengganti.
- Jangan menambah model atau kolom Prisma tanpa keputusan sadar, karena itu memicu
  migrasi di produksi.

CARA MEMERIKSA SEBELUM DEPLOY
  node node_modules/typescript/bin/tsc --noEmit
  node --experimental-test-module-mocks --import tsx --test tests/*.test.ts
  node node_modules/next/dist/bin/next build
Ketiganya harus bersih. Yang ketiga wajib, karena itu yang dijalankan skrip deploy.
```

---

---

## Bagian 9 - Peta Lengkap: Apa yang Sudah Terwujud, Setengah Jalan, dan Belum Ada Sama Sekali

Mecca minta ini ditulis eksplisit setelah putaran audit di Bagian 3C: bukan cuma "apa
yang kami ubah", tapi status SEMUA fitur yang pernah dibahas lintas sesi -- termasuk
yang belum jadi -- dan kenapa. Semua klaim di bawah dicek ULANG langsung ke kode hari
ini (bukan disalin mentah dari roadmap 6 September), karena beberapa hal ternyata sudah
berubah sejak roadmap itu ditulis. Dua koreksi jujur duluan supaya kamu tidak
menganggap dokumen lama masih akurat:

```
KOREKSI atas roadmap 6 Sep (2026-09-06-roadmap-status-lengkap-dan-fitur-belum-terwujud.md):
1. Notebook 9 jenis kartu -- roadmap itu bilang "cuma 2 kartu live, 7 sisanya fallback
   teks". SUDAH TIDAK BENAR. Dicek ulang hari ini: StudioResult.tsx punya renderer
   sendiri untuk SEMUA 9 kind (quiz/flashcard/summary-report/mindmap/table/
   infographic/deck/audio-overview-script/video-storyboard), dan dropdown "Jenis
   catatan" di MediaStudio.tsx sudah menawarkan semua 9. Sudah terintegrasi penuh.
2. Template industri untuk generate gambar -- roadmap itu bilang "backend siap, UI
   belum ada". SUDAH TIDAK BENAR. Dicek ulang: ada dropdown "Jenis usaha" di
   MediaStudio.tsx yang terhubung ke industry-image-templates.ts. Sudah terintegrasi.
Kesimpulannya: sebagian pekerjaan "sambung kabel" ternyata sudah kejadian di antara 6
dan 7 September (kemungkinan ikut gelombang otak-AI Bagian 3B), tapi tidak tercatat
eksplisit di memory manapun sampai audit hari ini menemukannya lewat baca kode
langsung, bukan percaya dokumen lama. Pelajaran yang kami catat untuk diri sendiri:
jangan pernah lapor status fitur dari ingatan/dokumen tanpa verifikasi ulang ke kode.
```

### 9.1 SUDAH terwujud DAN terintegrasi penuh (bisa dipakai user sekarang, bukan cuma ada kodenya)

```
FITUR                              BUKTI IA REACHABLE DARI UI
========================================================================================
Parser laporan keuangan            ledger-parser.ts, disambungkan ke documents/
deterministik (angka dihitung      extract-text (Bagian 3.1) -- reachable dari tombol
kode, bukan ditebak AI)            upload di ketiga AI Assistant. Diuji ke file Excel
                                    asli klien (583 transaksi).
Generate gambar (pilih model)      Tombol "Buat Gambar" di ketiga portal, benar-benar
                                    buka MediaStudio dan panggil media/generate.
                                    CEO baru benar tersambung malam ini (Bagian 3C).
Generate suara/voiceover +         Tombol "Buat Audio/Voiceover" dan "Rekam Suara",
transkripsi                        sama seperti di atas, ketiga portal.
Notebook 9 jenis kartu             Lihat koreksi di atas -- semua 9 reachable lewat
(kuis/flashcard/ringkasan/         dropdown "Jenis catatan" begitu buka studio Kuis
mindmap/tabel/infografis/deck/     atau Flashcard. CATATAN UX: label tombol pemicu
naskah audio/storyboard video)     cuma "Kuis"/"Flashcard", tidak memberi petunjuk 7
                                    opsi lain ada di dalamnya -- kandidat perbaikan
                                    penamaan tombol, bukan bug fungsional.
Template dokumen (19 template:     Tombol "Template Dokumen" di studio media, dipakai
5 laporan keuangan, 5 invoice,     ketiga portal.
5 deck, 4 brief video)
Template gambar per-industri       Dropdown "Jenis usaha" di studio Buat Gambar (lihat
(8 vertikal)                       koreksi di atas).
Anti-slop teks (9 aturan)          Dipakai di seluruh keluaran teks AI, tidak reachable
                                    lewat UI tersendiri karena memang bukan fitur UI --
                                    ini filter otomatis di jalur generate.
Kesehatan finansial jujur (oleh    financial-health/route.ts, dipakai dashboard ketiga
Fatur) + catat transaksi dari      portal. Conversational ERP Router di brain/chat --
chat AI (oleh Fatur)               ketik "modal awal 20jt" langsung tersimpan ke DB.
Otak asisten 4 lapis + mode        persona-skin.ts + answer-mode.ts, dipakai brain/chat
jawaban ikut cara bertanya         untuk SEMUA portal, tidak ada tombol karena ini
                                    logic di belakang layar, bukan fitur yang diklik.
Rekonsiliasi kas & rekening        Kartu galeri + kemampuan baru CEO/Finance (Bagian
koran, estimasi pajak PPh/PPN      3C malam ini) -- prompt teks ke AI, bukan kalkulator
                                    terpisah, jadi "terwujud" di level "AI bisa
                                    mengerjakan permintaan ini", bukan modul pajak resmi
                                    dengan basis data tarif yang bisa di-update sendiri.
```

### 9.2 SUDAH dibangun (kode ada, teruji standalone) TAPI belum tersambung ke tempat yang bisa dipakai user

Ini kelas paling penting buat kamu tahu: bukan "belum ada", tapi "wadahnya sudah jadi,
kabelnya belum ditancapkan". Push GitHub untuk kode-kode ini SUDAH TERJADI (ikut merge
`ba1a2fe`/`9c6990e`, bukan menunggu push baru) -- yang belum adalah langkah wiring
terakhir, dan kami sengaja tidak melakukannya sepihak karena masuk kategori
"keputusan produk", bukan "bug jelas" seperti audit-audit sebelumnya.

```
FITUR                    KENAPA BELUM TERSAMBUNG          YANG DIBUTUHKAN
=========================================================================================
ai-orchestrator.ts       Dibangun sebagai PEMBUNGKUS di    Ganti pemanggilan
("Hermes-lite" --        atas ai-gateway.ts (Bagian 3.7),  `executeAIRequest(...)`
pemilihan provider/      supaya pemilihan provider/model   jadi `orchestrate({task:
model per jenis tugas    per tugas jadi satu tabel         'chat', ...})` di
secara sadar, bukan      terpusat (TASK_ROUTES) yang bisa  brain/chat/route.ts dan
tiap fitur pilih         dibaca dan diubah di satu tempat  route lain yang manggil AI
sendiri-sendiri)         -- TAPI belum ada satupun route   -- estimasi kecil (rewiring
                         yang memanggil fungsi              titik panggil, bukan
                         `orchestrate()`-nya. Grep          nulis logic baru), tapi
                         `ai-orchestrator` di seluruh       kami tidak berani ganti
                         folder api/ = nol hasil. File      titik panggil AI utama
                         ini murni berdiri sendiri,         tanpa persetujuan --
                         diuji lewat tests/ai-              risikonya kalau salah,
                         orchestrator.test.ts, TAPI tidak   SEMUA jawaban AI di
                         pernah dipanggil dari jalur        seluruh app kena imbasnya
                         request sungguhan manapun.         sekaligus.
-----------------------------------------------------------------------------------------
document-checker.ts +   Sudah disambungkan ke              Sudah bisa dipakai -- yang
tabular-checker.ts       documents/analyze (field          BELUM ada cuma UI khusus
(pemeriksa anomali       response opsional                 yang menampilkan hasil
dokumen umum, di luar    `documentCheck`), TAPI belum       pengecekan itu dengan rapi
ledger-parser)           ada UI yang secara eksplisit       (sekarang cuma field JSON
                         menampilkan hasilnya ke user       tambahan di response API,
                         secara visual (beda dari ledger-   belum ada kartu/tabel di
                         parser yang sudah ada kartu        layar). Butuh desain kartu
                         "buku besar diverifikasi"          tampilan, bukan kerja
                         khusus).                           backend baru.
```

### 9.3 BELUM ada sama sekali (nol kode, bukan cuma belum disambung)

```
FITUR                    KENAPA BELUM DIBANGUN             WADAH/FONDASI SUDAH SIAP?
=========================================================================================
Generate VIDEO           media-catalog.ts eksplisit        SEBAGIAN. Pola arsitektur
                         menulis `video: false` (dicek     provider-cascade untuk
                         ulang hari ini, masih false).      gambar/audio SUDAH ada dan
                         Belum ada satupun provider         terbukti jalan -- menambah
                         video yang diintegrasikan.         provider video baru secara
                         Alasan BUKAN teknis semata:        arsitektur = pola yang
                         model video jauh lebih mahal       sama, bukan desain ulang.
                         per-generate dibanding gambar/     Yang BELUM siap: tempat
                         teks (soal budget), dan video      penyimpanan hasil video
                         yang di-generate perlu             (lihat baris di bawah --
                         disimpan di suatu tempat           nol tabel File di database
                         (balik ke masalah penyimpanan      manapun).
                         file di bawah).
-----------------------------------------------------------------------------------------
Penyimpanan file/media   TIDAK ADA model Prisma untuk       TIDAK. Ini fondasi data yang
permanen (server-side)   File/Upload/Attachment/Document/   belum ada sama sekali --
                         Media di database. Dicek           SEMUA fitur upload/generate
                         langsung: 32 model di               di atas cuma proses-lalu-
                         schema.prisma, nol yang cocok.      buang (lihat Bagian 9.4).
                         Bukan bug, memang belum pernah      Ini keputusan arsitektur
                         dibangun sejak awal.                Fatur (skema database),
                                                             bukan sesuatu yang bisa
                                                             kami tambahkan sepihak.
-----------------------------------------------------------------------------------------
Riwayat chat permanen    Sama seperti di atas -- TIDAK ADA  TIDAK. History chat cuma
(bukan cuma di layar     model ChatMessage/Conversation     hidup di localStorage
sesi berjalan)           untuk AI Assistant KLIR yang       browser, dikirim ulang ke
                         aktif sekarang.                    server tiap kali user
                                                             kirim pesan baru, tidak
                                                             pernah disimpan di server.
-----------------------------------------------------------------------------------------
4 modul "KLIR             PRD lengkap (JTBD, schema         SPEK-NYA SIAP (dokumen di
Enterprise Tier"          Prisma draf, state-machine,        05-DOKUMEN/aktif), TAPI
(Employee Master,         guardrail) sudah ditulis 6         schema Prisma-nya BELUM
Offboarding/PHK,          September, tapi belum ada          diterapkan (masih draf,
Payroll-GL, SOP/KPI)      satupun tabel/kode yang            belum migration). Perlu 1
                          diimplementasikan. Butuh            keputusan Fatur dulu:
                          keputusan Fatur soal siapa jadi     siapa SSOT entitas
                          SSOT entitas "Employee" (3 dari     "Employee" sebelum baris
                          4 modul saling tumpang tindih       kode pertama ditulis.
                          definisinya kalau dibangun          Proposal siap-copy ada di
                          sendiri-sendiri).                   2026-09-06-proposal-
                                                              koordinasi-fatur-video-
                                                              dan-enterprise-tier.md.
-----------------------------------------------------------------------------------------
Layer generator laporan   Ditemukan MALAM INI lewat audit    TIDAK. `reports` di
otomatis Marketing         Bagian 3C: `MarketingModuleView.  MarketingModuleView.tsx
(klaim "dibuat otomatis    tsx` header-nya dulu mengklaim    literal array kosong
tiap akhir bulan")         "Dibuat otomatis tiap akhir       ([]), bukan state, tidak
                           bulan" padahal TIDAK ADA           ada jalur apapun untuk
                           generator/cron/endpoint terkait    mengisinya. Sudah kami
                           di manapun. Label sudah kami       ganti jujur jadi "Segera
                           genericize jadi "Segera hadir"     hadir", tapi generator
                           malam ini (lihat Bagian 3C).        sungguhannya sendiri
                                                               belum pernah dibangun.
-----------------------------------------------------------------------------------------
Endpoint kampanye iklan    Ditemukan malam ini: `campaigns`  TIDAK. Field-field yang
Marketing (daftar          di MarketingModuleView.tsx        dipakai UI (dailyBudget/
kampanye, pause/resume,    SELAMANYA array kosong -- bukan   roas/platform/leads/
pemindahan budget)         bug frontend, memang tidak ada    creativeType/status)
                           endpoint API kampanye iklan di     tidak match endpoint
                           backend sama sekali (sudah         manapun yang ada
                           digrep, nol hasil di src/app/api). sekarang. Perlu endpoint
                                                              baru (mis. GET /api/v1/
                                                              marketing/campaigns) di
                                                              lane Fatur.
-----------------------------------------------------------------------------------------
Widget "Kewajiban          Ditemukan malam ini: array        TIDAK. Perlu keputusan +
terjadwal" Finance (14/30  sumbernya (`upcomingDues14/30`)   endpoint dulu, mirip
hari)                      literal `const []`, bukan state,  kasus campaigns di atas.
                           tidak pernah di-fetch dari mana
                           pun. Sudah kami ganti jadi status
                           jujur "sedang dikembangkan"
                           (Bagian 3C), tapi fiturnya
                           sendiri belum ada.
```

### 9.4 Tempat Upload Data, dan Apakah Bisa Ditarik Lagi

Mecca tanya spesifik: "tempat upload data-nya di mana, dan kalau salah upload atau
sudah gak relevan bisa ditarik lagi gak." Jawabannya, dicek langsung ke kode (bukan
tebakan), agak mengejutkan:

```
DI MANA TEMPAT UPLOAD-NYA
--------------------------------------------------------------------------------------
TIDAK ADA halaman/menu upload TERPISAH di luar chat AI Assistant. Upload cuma bisa
lewat 3 pintu, semuanya menempel di composer chat ketiga portal (bukan halaman
tersendiri):

1. Tombol jepit kertas (attach) di composer chat -> POST /api/v1/documents/
   extract-text (kalau file buku besar Excel/CSV) atau /api/v1/documents/analyze
   (kalau dokumen lain: PDF/Word/gambar) -- dipicu handleFileSelect di ketiga
   AI Assistant View.
2. Studio Media -> tombol "Analisis Dokumen PDF/Excel/Word" -- rute yang sama
   seperti di atas, cuma pintu masuknya beda (lewat modal studio, bukan attach
   langsung).
3. Studio Media -> "Rekam Suara" -> POST /api/v1/media/transcribe (rekam
   langsung atau unggah file audio).

APAKAH FILE-NYA DISIMPAN, DAN APAKAH BISA DITARIK LAGI
--------------------------------------------------------------------------------------
TIDAK -- dan ini bukan cuma soal fitur "tarik/hapus" belum dibangun, ini karena file
ASLINYA MEMANG TIDAK PERNAH DISIMPAN SAMA SEKALI. Dicek langsung ke kode ketiga
endpoint di atas (extract-text/analyze/transcribe): nol baris yang menulis file ke
disk, ke S3, atau ke kolom database manapun. Alurnya: file dikirim -> diproses di
memori server sekali lewat -> hasil ekstraksinya dikirim balik ke browser -> file
mentahnya dibuang begitu request selesai. Sama persis untuk gambar/audio hasil
generate AI (media/generate) -- nol penyimpanan, hasilnya cuma ada selama sesi
chat itu berjalan di browser (kalau di-refresh, hilang, kecuali user sendiri yang
unduh).

Konsekuensinya buat pertanyaan "salah upload, mau ditarik": TIDAK ADA yang perlu
ditarik di sisi file mentahnya, karena memang tidak tersimpan. TAPI kalau file itu
menghasilkan DATA TURUNAN yang tersimpan (misalnya buku besar yang di-parse
menciptakan baris-baris transaksi kas di database), maka:

- Transaksi kas (CashTransaction) MEMANG BISA dihapus lewat API -- ada endpoint
  `DELETE /api/v1/kas/transactions?id=<id>` (satu transaksi) atau `?all=true`
  (hapus semua transaksi workspace sekaligus), sudah dipagari tenant-guard. TAPI
  kami sudah cek: TIDAK ADA tombol "Hapus" di manapun di layar (FinanceModuleView
  atau lainnya) yang memanggil endpoint ini. Jadi API-nya SIAP, tombolnya BELUM
  ADA -- user tidak bisa menghapus transaksi salah-input sendiri lewat aplikasi
  sekarang, harus lewat developer/database langsung.
- Selain itu (chat history, hasil generate gambar/audio/notebook, ringkasan
  dokumen yang masuk company-memory): TIDAK ADA mekanisme hapus apapun,
  konsisten dengan Bagian 9.3 di atas (memang belum ada tabel penyimpanan untuk
  hal-hal itu, jadi "hapus" belum relevan secara teknis).

Kesimpulan jujur: kalau ada klien nanti tanya "kalau saya salah upload data
keuangan, gimana cara membatalkannya?" -- jawaban aplikasi hari ini adalah
"transaksi yang sudah tercatat bisa dihapus lewat database langsung (belum ada
tombolnya di layar), file asli yang diupload otomatis tidak tersimpan sama
sekali." Ini gap produk yang nyata untuk skenario produksi sungguhan, bukan cuma
soal kerapian kode.

### 9.5 Ringkasan Jujur: Sudah Selesai, Belum Selesai, dan Kenapa

```
SUDAH BENAR-BENAR SELESAI (dibangun + tersambung + teruji):
  - Parser keuangan deterministik, generate gambar/suara, template dokumen (19),
    template gambar industri (8), notebook 9 jenis kartu, otak asisten 4 lapis,
    kesehatan finansial jujur, catat transaksi dari chat, dan (malam ini) audit
    kesesuaian peran CEO/Finance/Marketing.
  - Kenapa selesai: masing-masing sudah lolos tsc+test+build+verifikasi browser
    langsung, bukan cuma "kelihatannya jalan".

SETENGAH JALAN (kode ada, belum full tersambung -- Bagian 9.2):
  - ai-orchestrator.ts (Hermes-lite): kenapa mandek -- kami sengaja tidak
    mengganti titik panggil AI utama tanpa persetujuan, karena dampaknya
    menyeluruh ke semua fitur AI kalau salah. Butuh: 1 keputusan "gas" dari
    Mecca/Fatur, baru rewiring (kecil, bukan nulis ulang).
  - document-checker/tabular-checker: kenapa mandek -- backend-nya sudah
    nyambung, yang belum cuma desain kartu tampilan hasilnya. Butuh: keputusan
    desain (bagaimana bentuknya di layar), bukan kerja backend baru.

BELUM ADA SAMA SEKALI (Bagian 9.3), dengan alasan masing-masing:
  - Generate video: BUTUH keputusan budget (model video mahal) + keputusan
    penyimpanan (baris di bawah) sebelum bisa mulai, meski pola arsitekturnya
    sudah terbukti dari fitur gambar/audio.
  - Penyimpanan file & chat permanen: BUTUH keputusan skema database dari
    Fatur -- ini fondasi yang menahan banyak fitur lain (video, hapus-file,
    hapus-chat semua nunggu ini).
  - 4 modul Enterprise Tier: BUTUH keputusan Fatur soal entitas Employee
    sebelum baris kode pertama, walau spek lengkapnya sudah siap.
  - Endpoint kampanye iklan Marketing & widget kewajiban terjadwal Finance:
    BUTUH endpoint backend baru di lane Fatur -- bukan sesuatu yang bisa
    ditambal di tampilan saja, karena datanya memang belum pernah ada.
  - Generator laporan otomatis Marketing: BUTUH keputusan produk (apakah ini
    prioritas) sebelum dibangun -- belum ada di roadmap manapun sampai
    ditemukan malam ini sebagai klaim UI yang kosong.

GAP PRODUK PALING NYATA UNTUK PRODUKSI SUNGGUHAN (Bagian 9.4):
  - Data yang diupload klien tidak pernah tersimpan, dan data yang SUDAH
    tersimpan (transaksi kas) belum bisa dihapus sendiri oleh user lewat
    aplikasi. Kalau KLIR akan dipakai klien beneran (bukan cuma demo), ini
    layak jadi prioritas pembahasan berikutnya dengan Fatur -- karena
    menyangkut ekspektasi dasar user soal kendali atas datanya sendiri.
```

---

## Penutup

Kalau ada yang menurutmu mengganggu alur kerjamu, bilang ke Mecca dan kami sesuaikan.
Setiap perubahan di atas datang dengan cara membatalkannya, jadi kamu tidak perlu
berdebat, tinggal batalkan bagian yang tidak kamu setujui.

Status per dokumen ini ditulis: kedua putaran (Bagian 1-3B dan Bagian 3C) sudah
di-push ke `main` (`9c6990e`) DAN sudah di-deploy ke VPS -- `klir.laserstory1.id`
sudah menjalankan versi terbaru, PM2 `klir-os` online, log galat kosong.

Tujuan kami menambah colokan di kabel yang sudah kamu pasang, bukan menarik kabel baru.
