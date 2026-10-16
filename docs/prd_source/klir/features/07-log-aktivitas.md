# Log Aktivitas

Mencatat semua tindakan dalam Ruang Kerja dan membantu pengguna menelusuri apa yang terjadi.

## Spesifikasi

### Tujuan
Mencatat semua tindakan penting dalam Ruang Kerja secara otomatis dan aman, sehingga pengguna bisa menelusuri aktivitas yang terjadi di usahanya sendiri.

### Selesai bila
- Setiap aksi penting dalam Ruang Kerja (seperti membuka modul, menjalankan layanan berbayar, mengubah pengaturan) tersimpan sebagai catatan log.
- Log menampilkan daftar aktivitas berurutan dari yang terbaru ke terlama dalam antarmuka pengguna.
- Pengguna dapat membuka halaman Log Aktivitas dari dalam Ruang Kerja dan melihat log yang relevan dengan usahanya.

## Sub-fitur: Riwayat Aktivitas

Melihat semua aksi yang pernah terjadi di dalam Ruang Kerja berdasarkan urutan waktu.

### Tujuan
Menampilkan semua aksi yang pernah terjadi di dalam Ruang Kerja secara berurutan, agar pengguna dapat memantau aktivitas usahanya.

### Selesai bila
- Halaman Riwayat Aktivitas menampilkan daftar log dengan kolom: waktu, orang, modul, aksi, dan status (berhasil/gagal).
- Daftar log diurutkan dari yang terbaru ke yang terlama.
- Pengguna dapat menggulir atau memuat lebih banyak log untuk melihat catatan lama (paginasi).

## Sub-fitur: Cari Log

Mencari catatan berdasarkan orang, modul, tanggal, atau status berhasil dan gagal.

### Tujuan
Memudahkan pengguna menemukan log tertentu dengan menyaring daftar aktivitas berdasarkan orang, modul, tanggal, atau status.

### Selesai bila
- Pengguna dapat mencari log menggunakan kata kunci (misalnya nama orang atau jenis aksi).
- Pengguna dapat memfilter log berdasarkan orang (nama atau email), modul (misalnya CorPlan), tanggal (rentang tanggal), dan status (berhasil/gagal).
- Hasil pencarian dan filter ditampilkan langsung dalam daftar, dan pengguna dapat menghapus filter untuk kembali ke daftar lengkap.

## Sub-fitur: Ekspor Log

Mengunduh log aktivitas untuk keperluan audit dan pencatatan.

### Tujuan
Memungkinkan pengguna mengunduh log aktivitas dalam format file (misalnya CSV) untuk keperluan audit dan pencatatan.

### Selesai bila
- Tersedia tombol 'Ekspor Log' di halaman Log Aktivitas yang dapat diklik untuk mengunduh file.
- File unduhan berisi semua log Ruang Kerja sesuai filter yang sedang aktif (jika ada).
- File unduhan terbuka dengan benar di aplikasi spreadsheet (misalnya Excel) dan menampilkan kolom yang sama seperti daftar log.

## Task

### 1. Buat halaman Log Aktivitas dengan tabel tiruan

### 2. Tambahkan pencarian dan filter pada daftar log

### 3. Implementasikan pagination tombol muat lebih banyak

### 4. Tambahkan tombol ekspor CSV dari data tiruan

### 5. Buat migrasi tabel activity_logs di PostgreSQL

### 6. Buat modul NestJS untuk layanan log aktivitas

### 7. Buat interceptor otomatis untuk mencatat aksi

### 8. Buat endpoint ekspor CSV log aktivitas
