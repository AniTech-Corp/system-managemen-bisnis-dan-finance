# Analisis Kompetitor

Bandingkan harga, produk, dan strategi pesaing secara sistematis, bukan cuma menebak dari Instagram.

## Spesifikasi

### Tujuan
Membandingkan pesaing secara sistematis (nama, produk, harga, strategi) sehingga pengguna tidak hanya menebak dari Instagram.

### Selesai bila
- Pengguna dapat menambah, mengubah, dan menghapus data kompetitor (nama usaha, produk, kisaran harga, positioning, kekuatan, kelemahan).
- Sistem menampilkan daftar kompetitor yang relevan untuk kategori usaha pengguna, dan pengguna dapat melengkapinya.
- Sistem otomatis merangkum kekuatan, kelemahan, dan celah pasar kompetitor dengan AI.
- Pengguna dapat mengirim hasil analisis kompetitor untuk mengisi SWOT secara otomatis.

## Sub-fitur: Daftar pesaing

Simpan data kompetitor seperti nama, produk, dan harga di satu tempat.

### Tujuan
Menyediakan satu tempat untuk menyimpan data pesaing yang lengkap dan terstruktur.

### Selesai bila
- Pengguna dapat menambahkan pesaing baru dengan mengisi nama usaha, produk, kisaran harga, positioning, serta kekuatan dan kelemahan.
- Daftar pesaing tampil sebagai daftar yang rapi dan dapat diubah atau dihapus.

## Sub-fitur: Bandingkan harga

Lihat perbandingan harga produk sendiri dan pesaing dalam satu tabel.

### Tujuan
Memudahkan melihat posisi harga produk sendiri dibandingkan pesaing dalam satu tabel.

### Selesai bila
- Muncul tabel perbandingan harga dengan kolom nama produk, harga sendiri, harga setiap pesaing, dan status harga (lebih murah, sama, atau lebih mahal).
- Tabel hanya menampilkan produk yang sudah memiliki data harga baik dari produk sendiri maupun pesaing.

## Sub-fitur: Ringkasan Otomatis

AI merangkum kekuatan, kelemahan pesaing, dan celah pasar; kamu tetap bisa menambahkan catatan sendiri.

### Tujuan
Memberikan ringkasan otomatis tentang kekuatan, kelemahan, dan celah pasar berdasarkan data pesaing, sambil tetap mengizinkan catatan pengguna.

### Selesai bila
- Tersedia tombol untuk menghasilkan ringkasan otomatis, lalu sistem membuat ringkasan kekuatan, kelemahan, dan celah pasar yang mudah dibaca.
- Pengguna dapat menambahkan atau mengedit catatan pribadi pada ringkasan tersebut.

## Sub-fitur: Kirim ke SWOT

Hasil analisis pesaing dipakai untuk mengisi tabel SWOT secara otomatis.

### Tujuan
Mengalirkan hasil analisis pesaing ke matriks SWOT agar kolom ancaman dan peluang tidak diisi asal-asalan.

### Selesai bila
- Tersedia tombol "Kirim ke SWOT" di halaman Analisis Kompetitor.
- Setelah dikirim, data kompetitor otomatis mengisi bagian yang relevan di SWOT, misalnya ancaman dari pesaing yang lebih kuat atau peluang dari celah pasar.
- Pengguna mendapat notifikasi bahwa data berhasil dikirim ke SWOT.

## Task

### 1. Buat halaman utama Analisis Kompetitor dengan data dummy

### 2. Bangun daftar pesaing dan formulir tambah/edit lokal

### 3. Bangun tabel perbandingan harga antar produk dengan status harga

### 4. Buat panel ringkasan AI dan catatan pribadi

### 5. Buat tombol Kirim ke SWOT beserta notifikasi

### 6. Buat model dan migrasi Prisma untuk data kompetitor

### 7. Buat endpoint CRUD kompetitor

### 8. Buat endpoint perbandingan harga kompetitor

### 9. Buat endpoint ringkasan AI kompetitor

### 10. Buat endpoint kirim hasil analisis ke SWOT
