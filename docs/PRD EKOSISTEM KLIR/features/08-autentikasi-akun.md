# Autentikasi Akun

Mendaftar, masuk, dan keluar dari akun dengan aman sebelum membuka Ruang Kerja.

## Spesifikasi

### Tujuan
Autentikasi Akun ada agar pengguna dapat mendaftar, masuk, dan keluar dengan aman sebelum membuka Ruang Kerja, sehingga setiap data usaha hanya diakses oleh pemilik akun yang sah.

### Selesai bila
- Pengguna baru bisa membuat akun dengan email, nama, dan kata sandi, lalu langsung diarahkan ke halaman Ruang Kerja.
- Pengguna bisa masuk dengan email dan kata sandi yang benar; kata sandi salah ditolak dengan pesan yang jelas.
- Pengguna bisa keluar dari sesi kapan saja dan sesi tidak lagi dianggap aktif setelah keluar.
- Halaman masuk dan daftar menampilkan status atau kesalahan yang mudah dipahami tanpa membocorkan detail teknis.
- Setelah masuk, pengguna hanya bisa melihat Ruang Kerja miliknya, bukan data pengguna lain.

## Sub-fitur: Daftar Akun

Membuat akun baru untuk mulai menggunakan platform Ekosistem KLIR.

### Tujuan
Membuat akun baru agar pengguna bisa mulai menggunakan platform Ekosistem KLIR.

### Selesai bila
- Pengguna dapat mengisi email, nama, dan kata sandi pada halaman daftar, lalu sistem membuat akun baru.
- Setelah berhasil mendaftar, pengguna langsung diarahkan ke halaman Ruang Kerja untuk membuat usaha pertamanya.
- Jika email sudah terdaftar atau kata sandi terlalu lemah, muncul pesan kesalahan yang jelas dan pengguna tetap di halaman daftar.

## Sub-fitur: Masuk dan Keluar

Masuk ke akun dan mengakhiri sesi dengan aman.

### Tujuan
Memberi pengguna cara masuk ke akun yang sudah ada dan mengakhiri sesi dengan aman.

### Selesai bila
- Pengguna dapat masuk menggunakan email dan kata sandi yang benar; jika salah, muncul pesan kesalahan yang jelas.
- Setelah masuk, pengguna diarahkan ke daftar Ruang Kerja atau Ruang Kerja aktif dan hanya melihat data miliknya.
- Pengguna dapat keluar dari akun; setelah keluar, halaman yang memerlukan login tidak bisa diakses lagi.

## Sub-fitur: Reset Kata Sandi

Mengembalikan akses akun ketika pengguna lupa kata sandi.

### Tujuan
Mengembalikan akses akun saat pengguna lupa kata sandi.

### Selesai bila
- Pengguna dapat meminta reset kata sandi dengan memasukkan email terdaftar dan sistem mengirimkan instruksi ke email tersebut.
- Pengguna dapat membuat kata sandi baru melalui tautan atau instruksi yang dikirim, lalu masuk dengan kata sandi baru.
- Jika email tidak terdaftar, halaman tetap menampilkan pesan yang tidak membocorkan apakah email tersebut benar-benar ada.

## Task

### 1. Buat halaman daftar akun dengan data tiruan

### 2. Buat halaman masuk akun dengan data tiruan

### 3. Buat halaman lupa kata sandi dengan data tiruan

### 4. Buat halaman keluar dan proteksi rute dengan data tiruan

### 5. Buat skema tabel pengguna dan sesi

### 6. Buat endpoint daftar akun

### 7. Buat endpoint masuk akun

### 8. Buat endpoint keluar akun

### 9. Buat endpoint reset kata sandi

### 10. Buat middleware autentikasi dan proteksi rute
