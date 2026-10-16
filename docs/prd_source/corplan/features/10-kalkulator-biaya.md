# Kalkulator Biaya

Hitung modal pokok, modal awal, biaya operasional, dan titik impas dengan urutan yang gampang.

## Spesifikasi

### Tujuan
Fitur Kalkulator Biaya membantu pemilik usaha menghitung modal pokok, modal awal, biaya bulanan, dan titik impas secara berurutan sehingga mereka tahu berapa modal yang perlu disiapkan dan berapa produk yang harus terjual agar tidak rugi.

### Selesai bila
- Pengguna bisa mengikuti alur perhitungan dari modal pokok ke modal awal, lalu biaya bulanan, dan terakhir titik impas, dengan hasil tiap tahap tersimpan dan dipakai di tahap berikutnya.
- Setiap hasil perhitungan ditampilkan dalam format Rupiah (dan mata uang utama Ruang Kerja) yang mudah dibaca, misalnya "Rp1.500.000" atau "Rp12.500".
- Pengguna bisa melihat ringkasan modal awal, total biaya bulanan, dan titik impas dalam satu halaman, dan hasilnya bisa dipakai ulang oleh fitur lain seperti Proposal Bisnis, Pitch Deck, dan Simulator KUR.

## Sub-fitur: Hitung modal pokok

Masukkan bahan baku dan biaya produksi untuk tahu modal pokok setiap produk.

### Tujuan
Pengguna memasukkan bahan baku dan biaya produksi untuk mengetahui modal pokok (HPP) setiap produk atau porsi, sehingga bisa menentukan harga jual yang tepat.

### Selesai bila
- Pengguna dapat menambahkan daftar bahan baku (nama, jumlah, harga satuan) dan biaya produksi (tenaga kerja langsung, biaya overhead langsung) untuk satu produk.
- Sistem menghitung dan menampilkan modal pokok per produk dalam Rupiah, misalnya "Modal pokok per porsi: Rp8.000".
- Hasil modal pokok tersimpan dan otomatis menjadi masukan untuk perhitungan titik impas di sub-fitur 4.

## Sub-fitur: Modal awal

Catat kebutuhan alat, renovasi, dan barang lain untuk tahu modal awal yang perlu disiapkan.

### Tujuan
Pengguna mencatat kebutuhan alat, renovasi, dan barang lain untuk mengetahui total modal awal yang harus disiapkan sebelum usaha berjalan.

### Selesai bila
- Pengguna dapat menambahkan daftar aset atau pengeluaran modal (nama barang, jumlah, harga) seperti kompor, oven, kulkas, renovasi, dan kendaraan.
- Sistem menampilkan total modal awal dalam Rupiah, misalnya "Total modal awal: Rp25.000.000".
- Total modal awal tersimpan dan digunakan sebagai bagian ringkasan kebutuhan modal di sub-fitur lain.

## Sub-fitur: Biaya bulanan

Masukkan pengeluaran rutin seperti gaji, listrik, dan gas supaya untung tidak tipis.

### Tujuan
Pengguna memasukkan pengeluaran rutin bulanan seperti gaji, listrik, dan gas supaya mengetahui total biaya operasional dan memastikan keuntungan tidak habis oleh biaya tersembunyi.

### Selesai bila
- Pengguna dapat menambahkan daftar biaya bulanan (nama biaya, jumlah) seperti sewa, gaji, listrik, air, internet, dan pemasaran.
- Sistem menampilkan total biaya bulanan dalam Rupiah, misalnya "Total biaya bulanan: Rp5.000.000".
- Total biaya bulanan tersimpan dan otomatis digunakan untuk menghitung titik impas di sub-fitur 4.

## Sub-fitur: Titik impas

Lihat berapa produk harus terjual agar pendapatan sama dengan biaya.

### Tujuan
Pengguna melihat berapa produk yang harus terjual per bulan agar pendapatan sama dengan total biaya, sehingga tahu kapan usaha mulai untung.

### Selesai bila
- Sistem menghitung titik impas berdasarkan modal pokok per produk (dari sub-fitur 1), total biaya bulanan (dari sub-fitur 3), dan harga jual yang dimasukkan pengguna.
- Sistem menampilkan titik impas dalam unit dan nilai Rupiah, misalnya "Anda perlu menjual 500 porsi/bulan (Rp5.000.000) untuk balik modal".
- Hasil titik impas dan rincian perhitungannya tersimpan dan bisa dipakai ulang di fitur lain seperti Proposal Bisnis dan Simulator KUR.

## Task

### 1. Buat halaman utama Kalkulator Biaya bertahap

### 2. Buat komponen input modal pokok

### 3. Buat komponen input modal awal

### 4. Buat komponen input biaya bulanan

### 5. Buat komponen hitung titik impas

### 6. Buat halaman ringkasan hasil perhitungan

### 7. Buat skema Prisma data kalkulator biaya

### 8. Buat API simpan dan ambil modal pokok

### 9. Buat API simpan dan ambil modal awal

### 10. Buat API simpan dan ambil biaya bulanan

### 11. Buat API simpan dan ambil titik impas

### 12. Buat service perhitungan titik impas
