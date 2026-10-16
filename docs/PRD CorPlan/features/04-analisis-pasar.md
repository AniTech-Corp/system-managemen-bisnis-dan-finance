# Analisis Pasar

Petakan kompetitor, tren, dan SWOT agar strategi usaha tidak hanya mengandalkan tebakan.

## Spesifikasi

### Tujuan
Memberi pengguna peta pasar yang jelas — siapa pesaing, bagaimana harga, tren apa yang naik, dan posisi usaha — agar strategi tidak disusun berdasarkan tebakan.

### Selesai bila
- Pengguna dapat mengelola daftar kompetitor beserta produk dan kisaran harganya, dan daftar itu tersimpan di Ruang Kerja.
- Sistem menampilkan tabel perbandingan harga produk/menu usaha sendiri dengan kompetitor yang mudah dibaca.
- Sistem menampilkan tren pasar yang relevan dengan kategori usaha serta pengaruhnya bagi usaha pengguna.
- Sistem menyusun matriks SWOT otomatis: kekuatan/kelemahan dari data usaha, peluang dari tren, ancaman dari kompetitor; pengguna tetap bisa menyunting.
- Hasil analisis pasar ini dipakai ulang oleh fitur lain seperti proposal, pitch deck, dan konsultan AI tanpa memasukkan ulang data.

## Sub-fitur: Daftar Kompetitor

Simpan data pesaing sekitar beserta produk dan harga yang mereka tawarkan.

### Tujuan
Menyediakan catatan terstruktur tentang pesaing di sekitar — nama usaha, produk/jasa, dan kisaran harga — agar pengguna tahu siapa yang harus dihadapi.

### Selesai bila
- Pengguna dapat menambah, mengubah, dan menghapus kompetitor; setiap kompetitor memiliki nama, produk/layanan, kisaran harga, dan catatan singkat.
- Sistem menampilkan daftar kompetitor yang tersimpan, dan jika kategori usaha mendukung, menyarankan kompetitor awal yang relevan.
- Data kompetitor otomatis tersedia untuk fitur Perbandingan Harga dan SWOT Otomatis.

## Sub-fitur: Perbandingan Harga

Bandingkan harga dan menu kita vs kompetitor dalam tabel mudah dibaca.

### Tujuan
Menampilkan perbandingan harga dan menu milik pengguna vs kompetitor dalam tabel yang mudah dibaca, sehingga posisi harga usaha terlihat jelas.

### Selesai bila
- Sistem menampilkan tabel yang membandingkan produk/menu pengguna dengan produk/menu sejenis dari kompetitor, termasuk harga masing-masing dan selisihnya.
- Tabel menggunakan data produk dari katalog pengguna dan data harga dari daftar kompetitor, tanpa perlu memasukkan ulang.
- Pengguna dapat melihat produk mana yang harganya lebih tinggi, lebih rendah, atau sebanding dengan kompetitor lewat label atau penanda yang jelas.

## Sub-fitur: Riset Tren

Catat tren pasar yang sedang naik dan pengaruhnya terhadap usaha.

### Tujuan
Mencatat dan menampilkan tren pasar yang sedang naik beserta relevansinya terhadap usaha, agar pengguna bisa menangkap peluang lebih dini.

### Selesai bila
- Sistem menampilkan daftar tren pencarian/kata kunci yang relevan dengan kategori usaha pengguna, lengkap dengan arah perkembangannya (misal naik/turun).
- Setiap tren memiliki label tingkat relevansi atau pengaruh bagi usaha pengguna.
- Pengguna dapat menandai tren yang ingin dimanfaatkan, dan tren tersebut ikut mengisi peluang di SWOT Otomatis.

## Sub-fitur: SWOT Otomatis

Analisis kekuatan, kelemahan, peluang, dan ancaman terisi dari data perbandingan dan tren.

### Tujuan
Menyusun matriks SWOT (kekuatan, kelemahan, peluang, ancaman) secara otomatis dari data perbandingan dan tren, agar analisis usaha berbasis data dan siap dipakai di dokumen lain.

### Selesai bila
- Sistem menampilkan matriks SWOT dengan empat kuadran yang terisi: kekuatan dan kelemahan dari data usaha, peluang dari tren, ancaman dari kompetitor.
- Jika ada kompetitor dengan harga lebih murah atau posisi lebih kuat, sistem memunculkannya sebagai ancaman secara otomatis.
- Pengguna dapat menyunting seluruh isi SWOT, dan hasilnya tersimpan untuk dipakai proposal, pitch deck, dan konsultan AI.

## Task

### 1. Bangun layout utama halaman Analisis Pasar

### 2. Buat komponen daftar kompetitor dengan data tiruan

### 3. Buat komponen tabel perbandingan harga dengan mock

### 4. Buat komponen daftar tren pasar dengan mock

### 5. Buat komponen matriks SWOT dengan data tiruan

### 6. Rancang skema database untuk analisis pasar

### 7. Buat API CRUD untuk daftar kompetitor

### 8. Buat API perbandingan harga dan tren pasar

### 9. Buat API untuk menghasilkan SWOT otomatis

### 10. Implementasi berbagi data dengan modul lain
