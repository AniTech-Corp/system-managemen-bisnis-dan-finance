# PERHATIAN -- BACA DULU SEBELUM PAKAI ISI ZIP INI (KLIR Booking)

## RINGKASAN SATU KALIMAT
Sebagian field dan satu model penuh di dalam zip referensi kode ini ADA di database asli,
TAPI SUDAH DIPUTUSKAN OWNER PRODUK untuk TIDAK MASUK ke desain paket Publik. Jangan tiru
field/model ini ke desain manapun untuk paket Publik.

## APA YANG DILARANG DIACU UNTUK PAKET PUBLIK

### 1. Deposit di muka (uang muka pemesanan)
Di file `KLIR-Booking-schema-prisma-excerpt.prisma`, model `BookingReservation` punya kolom:
- `depositAmount` (jumlah uang muka)
- `isDepositPaid` (status apakah uang muka sudah dibayar)
- Enum `BookingStatus` juga punya status `PENDING_DEPOSIT` (menunggu uang muka)

Ketiga hal ini adalah fitur PEMBAYARAN UANG MUKA DI MUKA. Fitur ini DIPINDAHKAN ke paket
Private/Enterprise, DI LUAR CAKUPAN pekerjaan desain paket Publik ini. JANGAN desain form
input "jumlah deposit", status "menunggu DP", tombol bayar DP, atau apapun yang menyiratkan
pembayaran di muka untuk paket Publik.

### 2. Sistem antrean nomor tiket (QueueTicket)
Model `QueueTicket` (nomor antrean, status WAITING/SERVING/COMPLETED/SKIPPED, estimasi
waktu tunggu) adalah SELURUH SISTEM antrean walk-in. Fitur ini JUGA dipindahkan ke paket
Private/Enterprise. JANGAN desain layar nomor antrean, papan status "sedang dilayani",
atau tombol "ambil nomor antrean" untuk paket Publik.

## KENAPA POTONGAN KODE INI TETAP DISERTAKAN?
Field dan model di atas SENGAJA tetap disertakan dalam file `.prisma` di zip ini sebagai
BUKTI bahwa fitur tersebut memang ada di database asli -- supaya siapapun yang menulis
prompt desain dari zip ini paham konteks lengkapnya. TAPI keberadaannya di kode BUKAN
berarti boleh langsung ditiru ke desain Publik. Anggap field-field ini "ada untuk
dipahami, bukan untuk didesain."

## YANG BOLEH DIACU UNTUK PAKET PUBLIK
Cakupan KLIR Booking paket Publik HANYA:
- Kalender penanda jadwal usaha sederhana
- Nama pelanggan
- Jam booking
- Jenis layanan

TANPA pembayaran di muka, TANPA nomor antrean. Kalau ragu apakah sebuah field/fitur di
`KLIR-Booking-page-tsx-excerpt.tsx` boleh dipakai, cek dulu apakah field itu berkaitan
dengan deposit/DP atau antrean -- kalau ya, JANGAN dipakai untuk desain Publik.

## TEMUAN TAMBAHAN -- WHATSAPP (di luar cakupan larangan utama, tapi tetap perlu diwaspadai)
Di `KLIR-Booking-page-tsx-excerpt.tsx` ada subtab "Pengingat WhatsApp" yang men-generate
pesan pengingat booking + tombol "Buka WhatsApp & Kirim Pesan" (deep-link `wa.me`, BUKAN
integrasi WhatsApp Business API resmi -- tidak ada koneksi API/webhook di kode ini, cuma
generate teks + link yang dibuka manual oleh user). Sesuai aturan desain (lihat
`SISTEM-DESAIN-BERSAMA.md` bagian 5), WhatsApp dalam bentuk apapun TIDAK BOLEH muncul di
desain paket Publik -- termasuk pola wa.me sederhana ini. Ganti dengan konsep "chat dalam
aplikasi" (in-app chat) di desain Publik.

## HAL LAIN YANG DICEK DAN AMAN (tidak ditemukan masalah)
- Tidak ditemukan referensi ke Repository Hukum/legalitas di potongan kode KLIR Booking ini.
- Tidak ditemukan opsi BYOK (user memasukkan kunci API AI miliknya sendiri) di potongan
  kode KLIR Booking ini.
