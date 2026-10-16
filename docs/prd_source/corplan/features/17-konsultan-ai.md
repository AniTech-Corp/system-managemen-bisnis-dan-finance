# Konsultan AI

Tanya jawab langsung dengan asisten AI untuk dapat saran bisnis kapan saja.

## Spesifikasi

### Tujuan
Memberikan pendampingan bisnis personal melalui tanya jawab dengan AI yang memahami konteks usaha pengguna.

### Selesai bila
- Pengguna dapat menulis pertanyaan bebas dan menerima jawaban AI yang relevan.
- AI memanfaatkan data usaha yang tersimpan (jika diizinkan) untuk memberi saran yang lebih sesuai.
- Percakapan tersimpan otomatis dan dapat dilihat kembali.
- Tersedia daftar contoh pertanyaan untuk memulai konsultasi.

## Sub-fitur: Tanya jawab

Tulis pertanyaan seputar usaha dan dapat jawaban langsung dari AI.

### Tujuan
Memungkinkan pengguna menulis pertanyaan seputar usaha dan menerima jawaban langsung dari AI.

### Selesai bila
- Pengguna dapat mengetik pertanyaan pada kolom tersedia dan mengirimnya.
- Sistem menampilkan jawaban AI dalam waktu singkat (misal <10 detik) di area chat.
- Jawaban AI relevan dengan pertanyaan yang diajukan.

## Sub-fitur: Saran dari data

AI membaca data usaha yang sudah diisi untuk memberi saran yang lebih pas.

### Tujuan
Membuat jawaban AI lebih personal dengan membaca data usaha yang sudah tersimpan.

### Selesai bila
- AI dapat merujuk data usaha tertentu (misalnya nama produk, hasil perhitungan HPP/BEP) saat menjawab.
- Pengguna dapat melihat indikator bahwa AI menggunakan data usahanya (misalnya ada keterangan "berdasarkan data usaha Anda").
- Data yang bersifat pribadi tidak ikut dibagikan ke AI kecuali diizinkan.

## Sub-fitur: Riwayat tanya

Simpan percakapan sebelumnya agar bisa dibaca kapan saja.

### Tujuan
Menyimpan semua tanya jawab sebelumnya agar pengguna dapat membacanya kembali kapan saja.

### Selesai bila
- Setiap tanya jawab otomatis tersimpan.
- Pengguna dapat melihat daftar percakapan lampau di halaman konsultan.
- Pengguna dapat membuka percakapan lama dan melihat isi tanya jawabnya.

## Sub-fitur: Contoh pertanyaan

Lihat contoh pertanyaan untuk mulai konsultasi tanpa bingung.

### Tujuan
Menampilkan contoh-contoh pertanyaan yang umum untuk membantu pengguna mulai konsultasi.

### Selesai bila
- Halaman konsultan menampilkan minimal 5 contoh pertanyaan yang relevan dengan usaha pengguna.
- Contoh pertanyaan dapat diklik dan langsung dikirim sebagai pertanyaan ke AI.
- Contoh pertanyaan dikelompokkan berdasarkan topik (misalnya keuangan, pemasaran, legalitas).

## Task

### 1. Bangun halaman utama Konsultan dengan layout chat & panel contoh pertanyaan

### 2. Implementasi tanya jawab dengan AI tiruan

### 3. Tampilkan indikator jawaban 'berdasarkan data usaha' dengan mock data

### 4. Buat daftar riwayat percakapan dengan data tiruan

### 5. Buat daftar contoh pertanyaan terkelompok (keuangan, pemasaran, legalitas) yang bisa diklik

### 6. Buat model database Percakapan dan Pesan beserta migrasi Prisma

### 7. Buat API REST untuk percakapan & pesan konsultan

### 8. Integrasi AI dengan konteks data usaha untuk jawaban personal

### 9. Buat API untuk menyimpan dan mengambil riwayat percakapan

### 10. Buat model database untuk percakapan dan pesan konsultan

### 11. Integrasi AI dengan konteks data usaha dan kredit
