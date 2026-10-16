# Kalender Konten

Rencanakan jadwal konten pemasaran dan tautkan dengan katalog produk agar promosi konsisten.

## Spesifikasi

### Tujuan
Memberi pengguna cara merencanakan dan mengelola konten pemasaran 30 hari yang terhubung dengan katalog produk, agar promosi usaha konsisten dan siap digunakan modul lain.

### Selesai bila
- Pengguna dapat membuat jadwal posting di kalender untuk platform seperti Instagram atau WhatsApp, lengkap dengan tanggal, jam, dan status.
- Pengguna dapat melihat dan mengubah jadwal dalam tampilan kalender 30 hari.
- Pengguna bisa mendapatkan ide konten 30 hari berisi contoh caption, hashtag, dan ajakan bertindak, lalu menyuntingnya sebelum dipakai.
- Setiap konten dapat dihubungkan ke satu produk di katalog; nama, foto, atau harga produk itu terlihat di kartu konten.
- Pengguna mendapat pengingat sebelum jadwal konten terbit sesuai waktu yang dipilih.

## Sub-fitur: Jadwal Konten

Buat dan atur jadwal posting di kalender, misalnya untuk Instagram atau WhatsApp.

### Tujuan
Membuat dan mengatur jadwal posting konten di kalender sesuai pilihan platform dan waktu pengguna.

### Selesai bila
- Pengguna dapat menambahkan konten baru dengan tanggal, jam, platform (misalnya Instagram atau WhatsApp), dan status draf/terjadwal/terbit.
- Jadwal konten tampil dalam tampilan kalender 30 hari dan daftar; pengguna dapat mengubah tanggal, jam, atau platform tanpa membuat ulang konten.
- Perubahan jadwal langsung tersimpan dan tidak hilang saat pindah halaman.

## Sub-fitur: Ide, Caption & CTA

Dapatkan ide konten pemasaran 30 hari beserta contoh caption, hashtag, dan ajakan bertindak yang bisa disunting.

### Tujuan
Memberikan ide konten pemasaran 30 hari lengkap dengan contoh caption, hashtag, dan ajakan bertindak yang bisa disunting.

### Selesai bila
- Pengguna dapat melihat ide konten harian selama 30 hari; setiap ide memuat topik, contoh caption, hashtag, dan ajakan bertindak (CTA).
- Semua teks ide dapat disunting langsung di kartu konten sebelum konten dianggap siap.
- Ide yang muncul berdasarkan data usaha yang sudah tersimpan, seperti produk, target pasar, dan hasil analisis pasar, sehingga tidak perlu diketik ulang dari nol.

## Sub-fitur: Tautkan Produk

Hubungkan konten ke produk di katalog agar mudah dipakai modul promosi.

### Tujuan
Menghubungkan konten ke produk di katalog agar promosi selalu memakai produk yang relevan dan siap dipakai modul promosi lain.

### Selesai bila
- Saat menyusun atau mengedit konten, pengguna dapat memilih satu produk dari katalog yang sudah ada, dan produk itu tampil sebagai bagian dari kartu konten.
- Kartu konten yang sudah ditautkan memperlihatkan nama, foto, dan harga produk terkait.
- Jika data produk di katalog berubah, konten yang menautkannya ikut memakai data terbaru tersebut saat dilihat atau diterbitkan.

## Sub-fitur: Pengingat

Dapatkan notifikasi sebelum jadwal konten terbit.

### Tujuan
Mengingatkan pengguna sebelum jadwal konten terbit agar materi bisa disiapkan tepat waktu.

### Selesai bila
- Pengguna dapat mengaktifkan pengingat untuk setiap konten terjadwal dan memilih waktu pengingat, misalnya 1 jam atau 1 hari sebelum terbit.
- Notifikasi pengingat muncul sesuai waktu yang dipilih untuk konten berstatus terjadwal; konten draf atau sudah terbit tidak memicu pengingat.
- Ada tampilan yang memperlihatkan pengingat yang akan datang atau riwayat pengingat.

## Task

### 1. Buat halaman utama Kalender Konten dengan mock data

### 2. Buat komponen kalender 30 hari dengan tampilan daftar

### 3. Buat modal tambah jadwal konten (tanggal, jam, platform, status) dengan state lokal

### 4. Buat kartu konten yang menampilkan detail dan bisa disunting

### 5. Buat panel Ide Konten 30 hari berisi caption, hashtag, dan CTA yang dapat diedit

### 6. Buat tampilan tautkan produk pada kartu konten dengan mock katalog dan tampilkan info produk

### 7. Buat tampilan pengingat dan pengaturan notifikasi dengan mock data

### 8. Buat UI filter/sortir jadwal berdasarkan platform dan status

### 9. Buat skema Prisma untuk ContentSchedule dan migration

### 10. Buat skema Prisma untuk ContentIdea dan relasi produk dengan migration

### 11. Buat API CRUD untuk jadwal konten (tambah, ubah, hapus, daftar)

### 12. Buat API untuk ide konten 30 hari dengan data produk dan target pasar

### 13. Buat API tautkan produk ke konten dan ambil info produk dari katalog

### 14. Buat service pengingat dengan BullMQ untuk notifikasi sebelum jadwal terbit

### 15. Buat endpoint pengaturan pengingat per pengguna dan daftar notifikasi

### 16. Integrasi auth, workspace, dan role check untuk semua endpoint kalender
