# Buat Proposal

Bikin proposal bisnis lengkap dengan memasukkan data usaha dan membuat drafnya otomatis lewat AI.

## Spesifikasi

### Tujuan
Memudahkan pengguna membuat proposal bisnis lengkap enam bab secara otomatis dari data usaha yang dimasukkan, sehingga draf profesional siap diedit dan diekspor.

### Selesai bila
- Pengguna dapat mengisi data usaha (nama, kategori, target pasar, modal awal, deskripsi usaha) dan sistem menyimpannya sebagai bahan dasar proposal.
- Sistem menghasilkan draf proposal enam bab: ringkasan eksekutif, deskripsi usaha, analisis pasar, strategi pemasaran, rencana operasional, dan proyeksi keuangan.
- Setiap bab dapat diedit manual atau ditulis ulang oleh AI secara terpisah.
- Proposal dapat diunduh dalam format PDF dan Word.

## Sub-fitur: Isi Data Usaha

Masukkan nama usaha, kategori, target pasar, modal awal, dan deskripsi usaha sebagai bahan dasar proposal.

### Tujuan
Mengumpulkan data usaha inti pengguna sebagai bahan dasar pembuatan proposal.

### Selesai bila
- Tersedia formulir berisi kolom nama usaha, kategori, target pasar, modal awal, dan deskripsi usaha dengan validasi input yang jelas.
- Data yang dimasukkan tersimpan dan tampil kembali saat pengguna membuka halaman, serta menjadi acuan konten proposal.

## Sub-fitur: Hasilkan Proposal AI

AI menyusun proposal enam bab mulai dari ringkasan eksekutif sampai proyeksi keuangan.

### Tujuan
Menyusun otomatis draf proposal bisnis enam bab yang konsisten dengan data usaha yang sudah dimasukkan.

### Selesai bila
- Setelah data usaha dikirim, sistem menampilkan enam bab lengkap dengan judul masing-masing.
- Isi setiap bab menggunakan data usaha pengguna dengan benar, misalnya nama usaha dan modal awal muncul sesuai input.

## Sub-fitur: Edit Tiap Bab

Ubah isi bab secara manual atau minta AI menulis ulang bagian tertentu.

### Tujuan
Memberi pengguna kendali untuk mengubah isi setiap bab, baik dengan menulis manual maupun meminta AI menulis ulang bagian tersebut.

### Selesai bila
- Setiap bab memiliki mode edit manual dan tombol untuk meminta AI menulis ulang.
- Ketika tombol AI diklik, isi bab diperbarui dan pengguna dapat melihat hasil barunya di tempat yang sama.

## Sub-fitur: Ekspor Proposal

Unduh hasil proposal sebagai file PDF atau Word untuk dibagikan atau diajukan.

### Tujuan
Mengunduh proposal sebagai file PDF atau Word agar mudah dibagikan atau diajukan.

### Selesai bila
- Tersedia tombol ekspor PDF dan tombol ekspor Word pada halaman proposal.
- File yang diunduh memuat seluruh bab proposal dengan format rapi dan dapat dibuka dengan benar.

## Sub-fitur: Riwayat Versi Bab

Lihat dan bandingkan perubahan tiap bab dari waktu ke waktu, lalu kembali ke versi sebelumnya jika diperlukan.

### Tujuan
Memungkinkan pengguna melihat riwayat perubahan tiap bab proposal, membandingkan antar versi, dan memulihkan versi lama jika diperlukan.

### Selesai bila
- Setiap bab proposal memiliki daftar versi yang menampilkan tanggal/jam perubahan dan sumber perubahan (misal editan manual atau tulis ulang AI).
- Pengguna dapat memilih dua versi dan melihat perbedaan teks (tambahan dan hapusan) secara jelas.
- Pengguna dapat memulihkan versi lama menjadi versi aktif; setelah dipulihkan, riwayat tetap tersimpan dan versi baru tercatat.
- Editor bab menampilkan penanda versi yang sedang aktif.

## Task

### 1. Buat halaman utama proposal dengan data tiruan

### 2. Buat halaman utama riwayat versi bab dengan data tiruan

### 3. Buat formulir data usaha dengan validasi

### 4. Buat tampilan perbandingan dua versi bab

### 5. Buat alur pemulihan versi bab dengan konfirmasi

### 6. Tampilkan enam bab proposal dari data tiruan

### 7. Buat mode edit manual per bab

### 8. Buat penanda versi aktif di editor bab

### 9. Tambahkan tombol tulis ulang AI per bab

### 10. Buat skema database dan migrasi riwayat versi bab

### 11. Buat tombol ekspor PDF dan Word

### 12. Buat API endpoint daftar versi per bab

### 13. Buat API endpoint detail satu versi bab

### 14. Buat migrasi tabel data usaha dan proposal

### 15. Buat API simpan dan ambil data usaha

### 16. Buat API endpoint pemulihan versi bab

### 17. Implement API Generate Proposal Asinkron (BullMQ)

**Prompt:**

```
Implement endpoint POST /proposals using NestJS and Prisma. 
1. Save business profile to 'BusinessProfile' table.
2. Push a job 'generate-full-proposal' to BullMQ (Redis Upstash).
3. Ensure the controller returns 202 Accepted with proposal ID immediately.
4. Implement a background worker to call AI API, parse 6 sections, and save to 'ProposalSection'.
5. Set proposal status to 'completed' once done.
Infrastructure: NestJS, Prisma, BullMQ.
```

### 18. Buat service pencatatan versi baru saat bab diubah

### 19. Buat API tulis ulang bab dengan AI

### 20. Buat endpoint ekspor PDF dan Word proposal
