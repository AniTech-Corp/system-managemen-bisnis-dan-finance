# Riset Tren Pasar

Pantau tren dan peluang pasar biar usaha mengikuti permintaan, bukan asal tebak.

## Spesifikasi

### Tujuan
Membantu pemilik usaha memantau tren dan peluang pasar sesuai kategori usahanya agar keputusan produk dan pemasaran mengikuti permintaan, bukan asal tebak.

### Selesai bila
- Pengguna dapat membuka fitur Riset Tren Pasar dan melihat daftar tren yang relevan dengan kategori usaha, lengkap dengan kata kunci, periode, dan arah pergerakan (naik/turun).
- Setiap tren dilengkapi tingkat relevansi terhadap usaha dan ringkasan peluang pasar dalam bahasa sederhana.
- Pengguna dapat menyimpan tren sebagai bahan riset, dan data yang tersimpan otomatis dapat dipakai ulang oleh fitur lain seperti SWOT, proposal, dan pitch deck.
- Data tren diperbarui secara berkala dari sumber yang disiapkan ekosistem, dan halaman menampilkan waktu pembaruan agar pengguna tahu data tidak basi.

## Sub-fitur: Ringkasan tren

Lihat tren yang sedang naik di pasaran sesuai kategori usaha.

### Tujuan
Menampilkan ringkasan tren yang sedang naik sesuai kategori usaha agar pengguna cepat melihat peluang pasar tanpa harus riset manual.

### Selesai bila
- Halaman menampilkan daftar atau grafik tren dengan label kata kunci, periode, arah pergerakan, dan ukuran popularitas yang mudah dipahami.
- Pengguna dapat menyaring tren berdasarkan kategori usaha dan target pasar atau lokasi, dan hasilnya langsung berubah sesuai pilihan.
- Setiap tren memiliki penjelasan singkat 'Apa artinya untuk usaha saya' serta tombol untuk menyimpan tren ke riset.

## Sub-fitur: Simpan riset

Catat hasil pengamatan dan sumber berita agar mudah dibaca ulang.

### Tujuan
Membantu pengguna mencatat hasil pengamatan pasar dan sumber berita agar mudah dibaca ulang dan dipakai dalam perencanaan usaha.

### Selesai bila
- Pengguna dapat menyimpan sebuah tren dengan catatan pribadi, tautan sumber, dan tanggal pengamatan.
- Daftar riset tersimpan tampil terurut, dapat dicari, dibuka kembali, diedit, dan dihapus.
- Setiap catatan riset otomatis tersedia di fitur lain yang memakai data pasar, misalnya SWOT dan proposal bisnis.

## Sub-fitur: Saran peluang

Dapatkan rekomendasi produk atau layanan baru yang sesuai tren.

### Tujuan
Memberikan rekomendasi produk atau layanan baru yang sesuai dengan tren pasar agar pengguna dapat memanfaatkan peluang sebelum kelewatan.

### Selesai bila
- Berdasarkan tren tersimpan dan profil usaha, sistem menampilkan 2–3 saran peluang produk atau layanan dengan alasan singkat yang mudah dipahami.
- Setiap saran menunjukkan tren terkait, permintaan pasar, dan tingkat kesesuaian dengan usaha saat ini.
- Pengguna dapat menerima, menolak, atau menyimpan saran sebagai catatan riset, dan pilihan itu tercatat untuk digunakan di SWOT, proposal, atau pitch deck.

## Task

### 1. Buat halaman utama Riset Tren Pasar dengan data tiruan

### 2. Implementasikan filter kategori dan lokasi pada ringkasan tren

### 3. Tampilkan penjelasan 'Apa artinya untuk usaha saya' dan tombol simpan

### 4. Buat modal simpan riset dengan catatan pribadi dan sumber

### 5. Buat daftar riset tersimpan dengan pencarian dan edit

### 6. Buat halaman saran peluang dengan aksi terima/tolak/simpan

### 7. Buat tabel market_trends dan user_research dengan migrasi Prisma

### 8. Buat endpoint API untuk mengambil daftar tren

### 9. Buat endpoint API untuk menyimpan, mengedit, dan menghapus riset

### 10. Buat endpoint API untuk menghasilkan saran peluang

### 11. Integrasikan fondasi: login, ruang kerja, langganan, dan log aksi
