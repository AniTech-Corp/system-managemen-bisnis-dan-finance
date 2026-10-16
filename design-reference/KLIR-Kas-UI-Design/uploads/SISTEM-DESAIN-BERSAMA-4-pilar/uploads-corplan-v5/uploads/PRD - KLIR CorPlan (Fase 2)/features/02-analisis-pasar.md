# Analisis Pasar

Lihat kondisi pasar lewat perbandingan kompetitor, tren, SWOT, dan risiko untuk memperkuat proposalmu.

## Spesifikasi

### Tujuan
Membantu pengguna memahami kondisi pasar melalui perbandingan kompetitor, tren, SWOT, dan risiko agar proposal bisnis lebih meyakinkan.

### Selesai bila
- Pengguna membuka halaman Analisis Pasar dan sistem langsung memakai profil usaha (kategori, lokasi, target pasar) tanpa mengisi ulang.
- Halaman menampilkan empat bagian yang jelas: Perbandingan Kompetitor, Riset Tren Pasar, SWOT & Mitigasi Risiko, dan Info Data Terbatas.
- Setiap bagian menampilkan status pemuatan/peringatan jika data belum tersedia, dan hasilnya dapat dipakai untuk memperbarui bab Analisis Pasar di proposal.

## Sub-fitur: Perbandingan Kompetitor

Lihat tabel kekuatan dan kelemahan pesaing dalam satu tampilan.

### Tujuan
Menampilkan kekuatan dan kelemahan pesaing dalam tabel agar pengguna bisa membandingkan posisi usahanya.

### Selesai bila
- Muncul tabel dengan kolom "Nama Kompetitor", "Kekuatan", "Kelemahan" (atau padanan yang jelas).
- Isi tabel dihasilkan dari kategori dan lokasi usaha pada profil, bukan dari input manual pengguna.
- Jika data kompetitor kosong, tabel tidak mengarang nama; area ini menampilkan Info Data Terbatas.

## Sub-fitur: Riset Tren Pasar

Baca tren pasar yang sedang berlangsung, lengkap dengan sumber yang bisa diklik.

### Tujuan
Menampilkan tren pasar yang sedang terjadi lengkap dengan sumber yang bisa diklik agar pengguna yakin datanya nyata.

### Selesai bila
- Minimal ada satu kartu/poin tren berisi judul/ringkasan tren dan tautan sumber yang bisa diklik.
- Setiap tren wajib menyertakan URL yang valid; tidak ada tren tanpa sumber atau dengan sumber palsu.
- Saat proses riset berjalan, muncul indikator "Mencari tren..." dan hasilnya muncul setelah selesai.

## Sub-fitur: SWOT & Mitigasi Risiko

Lihat matriks SWOT dan daftar risiko beserta langkah mengatasinya.

### Tujuan
Menyusun matriks SWOT dan daftar risiko beserta mitigasi agar pengguna bisa melihat peluang dan ancaman secara terstruktur.

### Selesai bila
- Menampilkan matriks 2×2 berlabel Kekuatan, Kelemahan, Peluang, dan Ancaman.
- Menampilkan daftar risiko dengan dua kolom: "Risiko" dan "Mitigasi" (langkah mengatasinya).
- Isi SWOT dan mitigasi konsisten dengan tren dan kompetitor yang ditampilkan di halaman yang sama.

## Sub-fitur: Info Data Terbatas

Dapat peringatan jelas saat data kompetitor di kategori niche tidak tersedia agar tidak menyesatkan.

### Tujuan
Memberi peringatan yang jelas dan mencolok saat data kompetitor di kategori niche tidak tersedia agar pengguna tidak terkecoh oleh hasil karangan.

### Selesai bila
- Muncul banner/label peringatan "Data Terbatas" dengan warna kontras dan ikon saat data kompetitor tidak ditemukan.
- Bagian Perbandingan Kompetitor tidak menampilkan nama kompetitor yang tidak ada di data; diganti keterangan "Belum ada data kompetitor yang cukup".
- Peringatan tetap terlihat setelah halaman dimuat ulang atau berpindah tab, sampai data benar-benar tersedia.

## Task

### 1. Buat tata letak halaman Analisis Pasar

### 2. Buat tabel perbandingan kompetitor

### 3. Buat kartu riset tren pasar

### 4. Buat matriks SWOT dan daftar risiko

### 5. Buat banner peringatan data terbatas

### 6. Buat skema DB dan migrasi data pasar

### 7. Buat API perbandingan kompetitor

### 8. Implement API Riset Pasar Paralel (Trends, Competitors, SWOT)

**Prompt:**

```
Implement parallel market analysis jobs using BullMQ:
1. Create a parent endpoint that triggers 3 parallel jobs: fetch-competitors, fetch-market-trends, and generate-swot-analysis.
2. The trends job must fetch data from external sources (Google Trends/Search API) and store source URLs.
3. Implement fallback logic: if external data is empty (niche category), set 'dataLimitation' flag to true in the database instead of failing.
4. Use Prisma to store results in 'MarketAnalysis' table linked to 'BusinessProfile'.
```

### 9. Buat API SWOT dan mitigasi risiko

### 10. Sediakan status data terbatas di API
