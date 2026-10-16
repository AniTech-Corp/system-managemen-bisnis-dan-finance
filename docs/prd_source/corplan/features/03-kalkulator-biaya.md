# Kalkulator Biaya

Hitung HPP, biaya modal, operasional, titik impas, skema KUR, dan nilai usaha dalam satu alur.

## Spesifikasi

### Tujuan
Memberikan satu alur terpadu untuk menghitung HPP, biaya modal, operasional, titik impas, simulasi KUR, dan nilai usaha sehingga pengguna memahami biaya dan kelayakan usaha secara menyeluruh.

### Selesai bila
- Pengguna dapat memasukkan data bahan, ongkos produksi, aset, biaya bulanan, skema KUR, dan aset dalam satu alur berurutan.
- Sistem menampilkan hasil perhitungan HPP per unit, total CapEx, total OpEx bulanan, BEP dalam unit dan rupiah, simulasi cicilan KUR, serta estimasi nilai usaha.
- Semua hasil perhitungan tersimpan otomatis dan dapat digunakan kembali di fitur lain seperti Proposal Bisnis, Pitch Deck, dan Konsultan AI.
- Perhitungan bersifat transparan: setiap angka dapat dijelaskan dari input yang dimasukkan, tanpa melibatkan kecerdasan buatan.

## Sub-fitur: Hitung HPP

Masukkan bahan dan ongkos produksi untuk tahu modal per produk atau porsi.

### Tujuan
Menghitung modal per produk atau porsi dari bahan baku dan ongkos produksi.

### Selesai bila
- Pengguna dapat menambahkan daftar bahan baku dengan nama, harga satuan, dan jumlah yang digunakan per produk.
- Sistem menghitung total biaya bahan per produk.
- Pengguna dapat memasukkan biaya tenaga kerja langsung dan biaya overhead langsung (misal listrik, gas) yang terkait produksi.
- Sistem menampilkan HPP per unit dan, jika pengguna memasukkan harga jual, margin kotor per produk.

## Sub-fitur: CapEx & OpEx

Catat pengeluaran alat dan biaya bulanan agar tidak ada biaya tersembunyi.

### Tujuan
Membantu pengguna mencatat pengeluaran modal (aset) dan biaya operasional bulanan agar tidak ada biaya tersembunyi dalam perencanaan.

### Selesai bila
- Pengguna dapat menambahkan daftar aset (nama, harga perolehan, umur ekonomis) untuk menghitung total CapEx dan penyusutan.
- Pengguna dapat menambahkan daftar biaya rutin bulanan (sewa, gaji, listrik, internet, pemasaran, dll) untuk menghitung total OpEx.
- Sistem menampilkan total CapEx dan total OpEx bulanan secara terpisah.
- Data CapEx dan OpEx tersimpan dan otomatis digunakan dalam perhitungan titik impas dan kebutuhan modal awal.

## Sub-fitur: Titik Impas

Lihat berapa unit harus terjual supaya pendapatan menutup semua biaya.

### Tujuan
Menghitung jumlah unit yang harus terjual agar pendapatan dapat menutup seluruh biaya tetap dan variabel.

### Selesai bila
- Sistem menggunakan HPP per unit (dari sub-fitur Hitung HPP) sebagai biaya variabel.
- Sistem menggunakan total biaya tetap bulanan (OpEx + penyusutan CapEx) sebagai biaya tetap.
- Sistem menampilkan BEP dalam unit (jumlah produk per bulan) dan dalam nilai Rupiah.
- Sistem memberikan perbandingan dengan kapasitas produksi atau target penjualan yang dimasukkan pengguna untuk menilai realisme.

## Sub-fitur: Simulasi KUR

Coba berbagai nominal, tenor, dan skema KUR untuk melihat cicilan dan total bayar.

### Tujuan
Memungkinkan pengguna mencoba berbagai nominal pinjaman, tenor (12–60 bulan), dan skema bunga KUR untuk melihat cicilan dan total pembayaran.

### Selesai bila
- Pengguna dapat memasukkan jumlah plafon, tenor dalam bulan (12–60), dan suku bunga per tahun atau memilih dari skema KUR yang tersedia.
- Sistem menghitung angsuran pokok, angsuran bunga, total cicilan per bulan, total bunga selama masa pinjaman, dan total pembayaran keseluruhan.
- Sistem membandingkan cicilan bulanan dengan laba bersih atau arus kas dari kalkulator untuk menilai kemampuan bayar.
- Sistem memberikan rekomendasi tenor yang paling realistis berdasarkan kemampuan bayar.

## Sub-fitur: Nilai Usaha

Perkirakan nilai wajar usaha berdasarkan laba dan aset untuk kebutuhan pinjaman atau investor.

### Tujuan
Memberikan estimasi nilai wajar usaha berdasarkan laba dan aset untuk kebutuhan pinjaman, negosiasi investor, atau penentuan porsi saham.

### Selesai bila
- Sistem menggunakan laba bersih tahunan (dari kalkulator finansial) dan total aset usaha untuk menghitung estimasi nilai.
- Sistem menerapkan pendekatan sederhana seperti kelipatan laba (misal 2–5 kali laba tahunan) atau nilai aset, dan menampilkan kisaran nilai usaha.
- Sistem menampilkan dasar perhitungan yang jelas (metode dan angka yang digunakan).
- Hasil estimasi nilai usaha dapat diekspor atau digunakan di Proposal Bisnis dan Pitch Deck.

## Task

### 1. Bangun layout kalkulator dengan navigasi langkah

### 2. Buat form HPP dan hitung modal per produk

### 3. Buat form CapEx/OpEx dan hitung total

### 4. Tampilkan titik impas dengan perbandingan kapasitas

### 5. Buat form simulasi KUR dan tampilkan cicilan

### 6. Tampilkan estimasi nilai usaha dengan dasar perhitungan

### 7. Buat skema Prisma dan migrasi tabel Kalkulator

### 8. Buat endpoint API untuk hitung HPP

### 9. Buat endpoint API untuk CapEx/OpEx

### 10. Buat endpoint API untuk titik impas

### 11. Buat endpoint API untuk simulasi KUR

### 12. Buat endpoint API untuk nilai usaha

### 13. Simpan hasil kalkulator untuk dipakai modul lain
