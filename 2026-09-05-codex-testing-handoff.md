# KLIR — Handoff testing eksploratif untuk Codex

Tanggal: 5 September 2026 sore. Ditulis Claude Code (Sonnet 5) atas instruksi Mecca:
"buat hands off ke Codex, coba dites kira-kira apa yang kurang." Ini BEDA dari 2 file
lain yang sudah ada -- ini fokus TESTING LANGSUNG (klik-klik beneran di browser),
bukan cuma baca kode.

## Baca dulu sebelum mulai (urutan ini)

1. `2026-09-04-codex-handoff.md` -- status commit terbaru, HEAD `1d4ef25` di branch
   `claude/ai-brain-upgrade-1sep`. Belum ada push. Baca terutama bagian "Verifikasi
   scan Claude" dan "Verifikasi LIVE di browser" (paling bawah) -- itu daftar 9 fix
   (P1-P9) yang baru selesai dikerjakan hari ini di area Marketing, semuanya sudah
   dites live dan PASS.
2. `2026-09-05-executive-finance-brain-audit-and-fix-plan.md` -- audit BARU (bukan di
   Marketing, di Executive/Finance) yang nemu 2 kelas masalah: (a) beberapa endpoint
   `api/v1/brain/*` gak punya autentikasi sama sekali, (b) banyak elemen UI yang
   kelihatan jalan tapi sebenarnya palsu/gak nyambung backend (file download korup,
   kartu media palsu, dashboard KPI campur data-asli-dan-karangan, tombol "eksekusi
   aksi" yang nulis angka tetap). Bagian "LANE ASTRA 6 (Codex)" di file itu isinya
   3 tugas spesifik buat kamu -- itu jadi dasar tugas testing di bawah ini.

## Tugas: testing eksploratif Marketing AI Assistant (area kamu sendiri)

Bukan code-review lagi (itu sudah dikerjakan Claude buat Executive/Finance). Ini
BENERAN klik-klik di browser, localhost, cari tau apa yang kurang/rusak dari sisi
pengalaman pengguna nyata -- termasuk hal yang gak kelihatan cuma dari baca kode.

### Setup

Jalankan dev server dari folder `klir-repo-clone` seperti biasa, buka di browser.
Klik tombol demo bypass di landing page (yang bunyinya soal DB lokal belum aktif),
lalu di halaman pilih-divisi klik kartu Marketing. Muncul gerbang login divisi --
kredensial demo-nya ada tertulis JELAS di dalam kode sumber sendiri, di fungsi
handler submit gerbang itu (`src/app/page.tsx`, cari nama fungsinya yang isinya
pengecekan username ceo/finance/marketing dan satu password yang sama buat semua
role). Sengaja gak Claude tulis ulang literal di sini -- hook keamanan sesi ini
nge-block file non-`.env` yang isinya kelihatan seperti kredensial ATAU alamat
email apapun konteksnya (bahkan yang sudah publik di kode sendiri). Buka file itu
langsung, gampang ketemu, cuma beberapa baris.

**Penting soal auth -- ini dua lapis berbeda, jangan ketuker:** gerbang di atas
CUMA state UI di browser (localStorage), BUKAN sesi login sungguhan ke server.
Kalau kamu cuma pakai itu, panggilan API media bakal tetap ditolak server karena
gak ada sesi asli. Supaya bisa tes ALUR NYATA (bukan cuma UI kosong), Claude tadi
pakai cara ini (murni membaca database, TIDAK menulis apapun ke dalamnya):

Buka `src/lib/auth.ts`, ada satu fungsi ekspor yang tugasnya menandatangani sesi
baru dari sebuah objek payload (dipakai juga oleh test suite yang sudah ada di
repo ini, jadi aman dipakai untuk keperluan serupa). Panggil fungsi itu lewat
script Node terpisah (bukan lewat route API) dengan payload berisi identitas user
yang SUDAH ADA dan SUDAH memiliki sebuah workspace di database saat ini -- pakai
akun CEO yang sudah disebut di file audit satunya (poin 2 di atas, cari bagian
yang membahas identitas & workspace demo) sebagai `userId`/`email`, dan
`workspaceId` workspace yang dia miliki (ID yang sama yang dipakai tombol
demo-bypass di halaman utama, juga sudah tercatat di file yang sama). Hasil tanda
tangannya lalu ditaruh sebagai nilai cookie bernama sesuai yang dibaca fungsi
ekstraksi token di `src/lib/tenant-guard.ts`, dari console browser, lalu reload.

Kalau kamu mau tes SEBAGAI Marketing Lead beneran (bukan pinjam identitas CEO):
sudah diverifikasi (baca-DB doang, tanpa nulis) bahwa akun marketing yang ada di
database sekarang punya **0 membership dan 0 owned workspace** -- jadi kalau kamu
coba buatkan sesi untuk dia, tetap bakal ditolak guard-nya (pengecekan keanggotaan
workspace). Itu BUKAN bug, itu data yang belum di-assign (lane Fatur). Untuk tes
fungsional end-to-end, pinjam identitas CEO saja seperti Claude tadi -- yang
penting fitur medianya kepanggil beneran, bukan soal persona rolenya persis.

### Yang perlu dites (checklist, bukan wajib urutan)

1. **Regresi P1-P9** -- generate gambar, voiceover dari brief, kuis dari materi baru
   di composer (bukan riwayat chat lama), rekam suara lalu edit transcript lalu
   kirim. Semua ini sudah PASS versi Claude tadi (lihat handoff), tapi kamu yang
   nulis kode aslinya -- kalau ada nuansa yang menurutmu masih janggal padahal
   "lolos", tulis juga.
2. **Pola bug BARU yang ditemukan di Executive/Finance (dari audit kedua) -- cek
   apakah ADA JUGA di Marketing:**
   - Download file korup: ada file "seed"/contoh di Marketing yang namanya
     berekstensi dokumen Office tapi isinya cuma teks polos (buka beneran di
     aplikasi aslinya, bukan cuma lihat namanya)?
   - Kartu hasil (gambar/audio/video) yang dirender TANPA nunggu backend beneran
     sukses -- apakah SEMUA kartu hasil di Marketing sudah nunggu response API asli
     sebelum ditampilkan (tidak ada versi "simulasi" yang muncul duluan)?
   - Tombol apapun yang mengklaim "menerapkan"/"mengeksekusi" sesuatu ke data
     bisnis -- apakah angkanya genuinely dihitung dari input user, atau ada yang
     hardcode sama persis tiap kali diklik?
3. **Rate-limit & idempotency (baru ditambah hari ini, `media-http.ts`)** -- coba
   kirim 2 request identik cepat berturut-turut (double-click generate), pastikan
   gak dobel jalan providernya. Coba > 30 request media dalam 1 menit (kalau
   sempat), pastikan dapat pesan error yang jelas, bukan hang/crash.
4. **Hal lain yang kamu sendiri notice** -- namanya testing eksploratif, kalau nemu
   sesuatu di luar daftar ini yang kelihatan janggal, tulis juga. Kamu yang paling
   paham kode Marketing, insting kamu soal "ini kurang" berharga.

### Batasan

- Boleh generate 1-2 kali per fitur buat bukti nyata (biaya kecil, sudah biasa
  dipakai sesi-sesi sebelumnya) -- jangan spam generate berkali-kali cuma buat
  "mastiin".
- JANGAN push, JANGAN commit dulu (kecuali Mecca bilang lain).
- JANGAN tulis apapun ke database secara langsung (lewat Prisma script dsb) --
  kalau butuh data yang gak ada (misal membership), catat sebagai temuan buat
  Fatur, jangan buatin sendiri.
- Kalau nemu bug, tulis pola yang sama kayak audit Claude: file, baris (kalau tau),
  kenapa ini masalah, seberapa parah (critical/major/minor). Simpan sebagai
  checkpoint baru di `2026-09-04-codex-handoff.md` (format yang sama seperti
  checkpoint-checkpoint Codex sebelumnya di file itu) supaya semuanya di satu
  tempat.

## Catatan soal model

Mecca sebut bakal pakai model "Luna" di Codex buat testing ini -- nama itu belum
pernah dikonfirmasi Claude sebelumnya di project ini (belum ada di riwayat sesi),
jadi ditulis apa adanya di sini, bukan diklaim tau kemampuannya. Kalau modelnya
ternyata punya batasan/perilaku beda yang relevan buat hasil testing, tulis juga di
checkpoint biar sesi berikutnya tau konteksnya.
