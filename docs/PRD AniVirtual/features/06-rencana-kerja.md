# Rencana Kerja

Membuat rencana kerja harian dan menangkap tugas dari percakapan untuk dikerjakan.

## Spesifikasi

### Tujuan
Memungkinkan pengguna menyusun rencana kerja harian/tim dan secara otomatis menangkap tugas dari percakapan untuk dikerjakan di KLIR Kerja.

### Selesai bila
- Pengguna dapat membuat rencana kerja harian atau mingguan berisi daftar kegiatan dan jadwal.
- Sistem mendeteksi tugas potensial dari percakapan dan menawarkannya sebagai saran.
- Tugas yang dikonfirmasi dapat dikirim ke KLIR Kerja.
- Tampilan menunjukkan rencana kerja dan tugas yang tertangkap dalam satu antarmuka.

## Sub-fitur: Buat Rencana

Menyusun daftar kegiatan dan jadwal kerja tim.

### Tujuan
Menyediakan cara bagi pengguna untuk menyusun daftar kegiatan dan jadwal kerja tim secara terstruktur.

### Selesai bila
- Pengguna dapat menambahkan kegiatan dengan detail seperti nama, waktu, penanggung jawab, dan status.
- Rencana dapat ditampilkan dalam bentuk daftar atau kalender mingguan.
- Perubahan pada rencana tersimpan dan dapat diedit kapan saja.

## Sub-fitur: Tawarkan Tugas

Mendeteksi tugas dari percakapan lalu menawarkan sebagai saran ke KLIR Kerja.

### Tujuan
Mendeteksi kalimat yang berpotensi menjadi tugas dari percakapan dan menawarkannya sebagai saran yang bisa dikonfirmasi pengguna.

### Selesai bila
- Sistem menganalisis pesan percakapan dan mendeteksi potensi tugas (misal: "tolong kirim laporan", "cek stok").
- Saran tugas muncul di UI terpisah dengan tombol konfirmasi atau tolak.
- Saran hanya dikirim ke KLIR Kerja setelah dikonfirmasi pengguna.

## Sub-fitur: Hubungkan ke KLIR Kerja

Mengirim tugas yang sudah dikonfirmasi ke KLIR Kerja untuk dikerjakan.

### Tujuan
Mengirimkan tugas yang telah dikonfirmasi dari AniVirtual ke modul KLIR Kerja agar dapat dikerjakan dan dilacak di sana.

### Selesai bila
- Setelah konfirmasi, tugas dikirim ke KLIR Kerja dengan detail lengkap.
- Pengguna mendapat status berhasil/gagal pengiriman (misal: notifikasi).
- Tugas yang sudah dikirim ditandai dan tidak dapat dikirim ulang secara tidak sengaja.

## Task

### 1. Bangun halaman utama Rencana Kerja dengan mock

### 2. Buat daftar kegiatan dengan status

### 3. Buat kalender mingguan kegiatan

### 4. Buat form tambah dan edit kegiatan rencana

### 5. Buat panel saran tugas dengan aksi konfirmasi

### 6. Hubungkan konfirmasi saran ke kegiatan rencana

### 7. Tandai tugas terkirim dan beri notifikasi status

### 8. Buat skema dan migrasi kegiatan rencana

### 9. Buat API CRUD kegiatan rencana

### 10. Buat skema dan migrasi saran tugas

### 11. Buat layanan deteksi tugas dari percakapan

### 12. Buat endpoint saran tugas konfirmasi dan tolak

### 13. Buat layanan kirim tugas ke KLIR Kerja
