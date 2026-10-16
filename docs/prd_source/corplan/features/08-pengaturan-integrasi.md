# Pengaturan & Integrasi

Kelola login, ruang kerja, langganan, mata uang, dan izin berbagi data ke modul KLIR lain.

## Spesifikasi

### Tujuan
Membantu pemilik usaha mengelola akses, preferensi mata uang, dan kontrol berbagi data CorPlan ke modul KLIR lain secara aman dan mudah.

### Selesai bila
- Pengguna dapat masuk dengan akun KLIR, memilih ruang kerja yang aktif, dan melihat status langganan serta hak akses CorPlan.
- Pengguna dapat mengatur mata uang utama yang dipakai untuk semua angka di aplikasi.
- Pengguna dapat menandai data mana yang boleh dibagikan dan mengirim ringkasan konteks ke modul tujuan (AniVirtual, KLIR Kas, KLIR Promo) sebagai snapshot bertanggal.
- Semua aktivitas masuk, pilihan ruang kerja, pembagian data, dan pemakaian kredit AI tercatat dan dapat dilihat di Riwayat Aktivitas.

## Sub-fitur: Masuk & Ruang Kerja

Login ke akun KLIR dan pilih ruang kerja usaha yang sedang dikelola.

### Tujuan
Memungkinkan pengguna masuk ke akun KLIR dan memilih ruang kerja usaha yang ingin dikelola di CorPlan.

### Selesai bila
- Pengguna dapat login dengan kredensial KLIR dan melihat daftar ruang kerja yang dimilikinya.
- Setelah memilih ruang kerja, CorPlan menampilkan data sesuai ruang kerja tersebut dan semua aksi selanjutnya terikat ke ruang kerja itu.
- Pengguna dapat berpindah ruang kerja tanpa harus login ulang.

## Sub-fitur: Cek Langganan & Hak Akses

Pastikan langganan aktif dan kamu punya izin membuka modul CorPlan.

### Tujuan
Memastikan pengguna hanya bisa membuka CorPlan jika langganan ekosistem aktif dan perannya diizinkan.

### Selesai bila
- Setelah login, sistem memeriksa status langganan ekosistem; jika tidak aktif, CorPlan menampilkan pesan untuk memperbarui langganan dan tidak membuka fitur.
- Jika langganan aktif tetapi peran pengguna tidak punya akses CorPlan, muncul pemberitahuan bahwa modul belum diaktifkan untuk ruang kerja tersebut.
- Jika langganan dan hak akses valid, CorPlan terbuka dan semua fitur dapat digunakan.

## Sub-fitur: Multi Mata Uang

Atur mata uang utama agar semua angka di aplikasi tampil sesuai.

### Tujuan
Memberi pengguna kemampuan menetapkan mata uang utama agar semua angka di aplikasi ditampilkan dalam mata uang yang diinginkan.

### Selesai bila
- Pengguna dapat memilih satu mata uang utama dari daftar (misalnya IDR, USD, SGD, MYR) di pengaturan.
- Semua angka di CorPlan (termasuk hasil kalkulator, proposal, pitch deck) menggunakan mata uang utama tersebut dengan format yang jelas.
- Pengguna dapat menambahkan mata uang transaksi lain, namun semua laporan dan dokumen menampilkan konversi ke mata uang utama dengan nilai tukar yang konsisten.

## Sub-fitur: Bagikan Konteks

Tentukan data yang boleh dibagikan dan kirim ringkasan ke AniVirtual, KLIR Kas, atau KLIR Promo.

### Tujuan
Mengontrol data mana yang boleh dibagikan ke modul KLIR lain dan mengirim ringkasan bertanggal sebagai snapshot.

### Selesai bila
- Pengguna dapat menandai setiap data usaha (misal profil, produk, anggaran) sebagai boleh dibagikan atau pribadi.
- Tombol "Bagikan Konteks Usaha" mengirim paket data yang berisi hanya data bertanda boleh dibagikan, lengkap dengan tanggal pembuatan, ke AniVirtual, KLIR Kas, atau KLIR Promo sesuai pilihan.
- Setiap kali anggaran diperbarui, snapshot anggaran otomatis dikirim ke modul yang berlangganan (AniVirtual, KLIR Kas), dan katalog produk selalu dibaca langsung oleh KLIR Promo tanpa perlu kirim manual.

## Sub-fitur: Riwayat Aktivitas

Lihat catatan perubahan, pembagian data, dan pemakaian kredit.

### Tujuan
Menyediakan catatan transparan atas perubahan data, pembagian data, dan pemakaian kredit AI di CorPlan.

### Selesai bila
- Pengguna dapat membuka halaman Riwayat Aktivitas yang menampilkan daftar kejadian terurut waktu, misalnya perubahan data, pengiriman snapshot, dan panggilan AI.
- Setiap kejadian menampilkan tanggal, jenis aksi, dan ringkasan (misal modul tujuan untuk pembagian data, jumlah kredit untuk panggilan AI).
- Riwayat dapat difilter berdasarkan jenis aktivitas (perubahan, berbagi, pemakaian kredit) dan hanya menampilkan data dari ruang kerja yang sedang dipilih.

## Task

### 1. Buat halaman utama Pengaturan & Integrasi dengan data tiruan

### 2. Buat halaman Masuk & Ruang Kerja dengan data tiruan

### 3. Buat halaman Cek Langganan & Hak Akses dengan data tiruan

### 4. Buat halaman Multi Mata Uang dengan data tiruan

### 5. Buat halaman Bagikan Konteks dengan data tiruan

### 6. Buat halaman Riwayat Aktivitas dengan data tiruan

### 7. Buat skema database untuk pengaturan, langganan, mata uang, berbagi, dan riwayat

### 8. Buat endpoint login dan pemilihan ruang kerja

### 9. Buat endpoint cek langganan dan hak akses modul

### 10. Buat endpoint kelola mata uang utama dan transaksi

### 11. Buat endpoint bagikan konteks ke modul lain

### 12. Buat endpoint riwayat aktivitas dengan filter
