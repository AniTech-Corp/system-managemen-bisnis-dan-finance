# Pengaturan & Keamanan

Mengelola peran, modul, dan keamanan akun di AniVirtual.

## Spesifikasi

### Tujuan
Mengelola peran, modul, dan keamanan akun di AniVirtual sehingga setiap pengguna hanya bisa mengakses sesuai haknya, modul dapat dipasang atau dilepas tanpa mengubah kode fondasi, serta seluruh aktivitas masuk/keluar dan pemakaian AI tercatat aman sesuai kebijakan ekosistem KLIR.

### Selesai bila
- Admin/pemilik dapat menetapkan peran (pemilik, penyetuju, anggota biasa) dan setiap pengguna hanya melihat/melakukan aksi sesuai perannya.
- Modul AniVirtual dapat diaktifkan atau dilepas dari ekosistem melalui halaman pengaturan modul, tidak mengganggu modul lain.
- Pengguna dapat masuk dan keluar akun dengan aman menggunakan akun ekosistem; sesi tidak sah ditolak.
- Penanggung jawab usaha dapat melihat sisa kredit AI dan riwayat pemakaian AI; permintaan AI tanpa cukup kredit ditolak.

## Sub-fitur: Kelola Peran

Menetapkan peran pemilik, penyetuju, dan anggota biasa beserta batas hak aksesnya.

### Tujuan
Menetapkan peran pemilik, penyetuju, dan anggota biasa beserta batas hak aksesnya di workspace AniVirtual.

### Selesai bila
- Pemilik dapat melihat daftar anggota dan mengubah peran tiap anggota menjadi salah satu dari tiga peran (pemilik, penyetuju, anggota biasa).
- Perbedaan hak terlihat jelas dan ditegakkan: misalnya hanya pemilik yang dapat mengubah peran, penyetuju dapat menyetujui ajuan, anggota biasa hanya dapat membuat ajuan.
- Jika peran diubah, hak akses langsung berlaku tanpa perlu masuk ulang.

## Sub-fitur: Kelola Modul

Mengaktifkan atau melepas modul AniVirtual dari ekosistem.

### Tujuan
Mengaktifkan atau melepas modul AniVirtual dari ekosistem KLIR melalui pengaturan modul, sehingga bisa dipasang/dilepas tanpa mengubah kode fondasi.

### Selesai bila
- Pengelola workspace dapat melihat status modul AniVirtual (aktif/nonaktif) dan mengubahnya dari halaman pengaturan modul.
- Saat modul dilepas, akses ke fitur AniVirtual berhenti tetapi data usaha tidak terhapus; saat diaktifkan kembali, data tetap tersedia.
- Perubahan status modul tercatat di log dan tidak mengganggu modul lain yang sedang berjalan.

## Sub-fitur: Masuk & Keluar Akun

Proses login dan logout yang aman menggunakan akun ekosistem.

### Tujuan
Memberikan proses masuk dan keluar akun yang aman menggunakan akun ekosistem KLIR.

### Selesai bila
- Pengguna dapat masuk dengan akun ekosistem dan sesi baru hanya berlaku untuk workspace yang berhak diaksesnya.
- Pengguna dapat keluar dengan aman; sesi menjadi tidak berlaku dan halaman yang membutuhkan login dialihkan ke halaman masuk.
- Tidak ada kunci API atau kredensial yang terlihat di sisi pengguna selama proses masuk/keluar.

## Sub-fitur: Pantau Pemakaian AI

Melihat sisa kredit dan riwayat pemakaian kecerdasan buatan.

### Tujuan
Melihat sisa kredit dan riwayat pemakaian kecerdasan buatan di workspace agar penggunaan AI terkendali dan sesuai kuota.

### Selesai bila
- Halaman pemakaian AI menampilkan sisa kredit saat ini dan riwayat pemakaian (tanggal, fitur, jumlah token/biaya) dengan format angka yang mudah dibaca.
- Riwayat hanya menampilkan data workspace sendiri, bukan data workspace lain.
- Jika kredit tidak cukup, permintaan AI ditolak dan pengguna diberi tahu sisa kredit yang tersedia.

## Task

### 1. Buat halaman utama pengaturan dengan navigasi tab

### 2. Buat daftar anggota dengan data peran tiruan

### 3. Tambah aksi ubah peran dengan dropdown

### 4. Buat antarmuka status modul AniVirtual

### 5. Tambahkan toggle aktif nonaktif modul dengan log

### 6. Buat halaman masuk dengan akun ekosistem tiruan

### 7. Buat alur keluar dan proteksi halaman login

### 8. Buat tampilan sisa kredit dan riwayat AI

### 9. Tambahkan indikator peringatan kredit tidak cukup

### 10. Buat skema peran anggota dan migrasi

### 11. Buat endpoint daftar anggota dan ubah peran

### 12. Terapkan penegakan peran pada aksi

### 13. Buat skema modul dan migrasinya

### 14. Buat endpoint daftar dan ubah status modul

### 15. Terapkan cek status modul pada akses

### 16. Buat endpoint login dan logout aman

### 17. Tolak sesi tidak sah di setiap rute

### 18. Buat skema kredit dan riwayat pemakaian AI

### 19. Buat endpoint sisa kredit dan riwayat AI

### 20. Terapkan cek dan catat pemakaian kredit AI
