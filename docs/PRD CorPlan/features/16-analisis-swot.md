# Analisis SWOT

Lihat kekuatan, kelemahan, peluang, dan ancaman usaha dalam satu peta yang terisi otomatis dari data analisis.

## Spesifikasi

### Tujuan
Menampilkan kekuatan, kelemahan, peluang, dan ancaman usaha dalam satu peta SWOT yang mudah dipahami, dengan isian otomatis dari data analisis kompetitor dan riset pasar, serta panduan menyusun langkah mitigasi risiko.

### Selesai bila
- Halaman Analisis SWOT menampilkan empat bagian berlabel Kekuatan, Kelemahan, Peluang, dan Ancaman.
- Bagian Peluang dan Ancaman terisi otomatis dari data riset tren dan analisis kompetitor yang sudah tersimpan; jika belum ada data, muncul panduan singkat.
- Setiap poin SWOT dapat ditambah, diubah, dan dihapus secara manual, lalu tersimpan di Ruang Kerja.
- Tersedia bagian Manajemen Risiko yang berisi daftar kelemahan/ancaman dan langkah mitigasi yang dapat dilengkapi pengguna.
- Hasil SWOT dan risiko dapat dipakai ulang oleh fitur lain seperti proposal bisnis dan pitch deck.

## Sub-fitur: Peta SWOT

Lihat kekuatan, kelemahan, peluang, dan ancaman dalam empat bagian yang mudah dipahami.

### Tujuan
Menampilkan kekuatan, kelemahan, peluang, dan ancaman usaha dalam empat bagian yang mudah dipahami dan tidak membingungkan.

### Selesai bila
- Layar menampilkan empat kuadran/kartu berlabel Kekuatan, Kelemahan, Peluang, dan Ancaman.
- Setiap kuadran memuat poin yang sudah ada; kuadran kosong menampilkan pesan jelas seperti "Belum ada data" beserta contoh singkat.
- Jumlah poin di tiap kuadran terlihat jelas, misalnya badge "3 poin".

## Sub-fitur: Isi otomatis

Poin SWOT terisi dari data kompetitor dan riset pasar, jadi tidak mulai dari nol.

### Tujuan
Mengisi poin SWOT secara otomatis dari data kompetitor dan riset pasar agar pengguna tidak perlu mulai dari nol.

### Selesai bila
- Saat halaman dibuka, sistem menampilkan poin Peluang dari riset tren dan poin Ancaman dari analisis kompetitor secara otomatis.
- Setiap poin hasil otomatis diberi label sumber, misalnya "dari Analisis Kompetitor" atau "dari Riset Tren".
- Ada cara untuk memperbarui poin otomatis ketika data kompetitor atau tren berubah, tanpa menghilangkan hasil edit manual pengguna.

## Sub-fitur: Edit manual

Tambah atau ubah sendiri poin SWOT sesuai kondisi sebenarnya.

### Tujuan
Memberi pengguna kendali penuh untuk menambah, mengubah, atau menghapus poin SWOT sesuai kondisi usaha yang sebenarnya.

### Selesai bila
- Tiap kuadran memiliki tombol "Tambah poin" untuk membuat poin baru.
- Setiap poin yang sudah ada dapat diedit teksnya dan dihapus; perubahan langsung tersimpan.
- Poin yang berasal dari isi otomatis tetap bisa diedit atau dihapus oleh pengguna.

## Sub-fitur: Manajemen Risiko

Susun langkah tindakan dan strategi mitigasi praktis untuk menghadapi kelemahan serta ancaman usaha.

### Tujuan
Membantu pengguna menyusun langkah tindakan dan strategi mitigasi yang praktis untuk menghadapi kelemahan serta ancaman usaha.

### Selesai bila
- Bagian Manajemen Risiko menampilkan daftar kelemahan dan ancaman dari peta SWOT sebagai dasar penyusunan risiko.
- Pengguna dapat menambahkan langkah mitigasi untuk setiap risiko, lengkap dengan prioritas dan status penyelesaian.
- Ketika poin kelemahan atau ancaman berubah, daftar risiko ikut menyesuaikan tanpa menghapus langkah mitigasi yang sudah ditulis.

## Task

### 1. Buat halaman utama daftar risiko dengan data tiruan

### 2. Buat halaman utama Analisis SWOT empat kuadran

### 3. Mock data poin otomatis berlabel sumber

### 4. Buat panel detail risiko berisi form strategi mitigasi dan status

### 5. Tambahkan modal tambah risiko manual pada halaman risiko

### 6. Buat form tambah poin per kuadran

### 7. Buat alur pilih item SWOT untuk membuat risiko baru

### 8. Implementasi edit dan hapus poin

### 9. Buat model Prisma untuk risiko, relasi SWOT, dan flag shareable

### 10. Buat UI Manajemen Risiko & input mitigasi

### 11. Implementasikan CRUD API risiko dengan middleware fondasi

### 12. Skema Prisma & migrasi SWOT dan risiko

### 13. Implementasikan API CRUD poin SWOT

### 14. Buat API untuk membuat risiko dari item SWOT secara otomatis

### 15. Implementasikan API manajemen risiko dan mitigasi

### 16. Tambahkan validasi status risiko dan audit trail pada API

### 17. Service isi otomatis dari kompetitor dan tren

### 18. Sinkronisasi auto-fill tanpa menimpa edit manual
