# Kenalan & Memori

Menyimpan data pelanggan dan kenalan lengkap dengan catatan pribadi yang aman.

## Spesifikasi

### Tujuan
Menyediakan satu tempat aman untuk menyimpan dan melihat data pelanggan, kenalan, serta catatan pribadi, agar usaha tidak perlu bertanya ulang dan privasi pemilik tetap terjaga dari anggota lain.

### Selesai bila
- Pengguna dapat membuat dan mengelola profil pelanggan yang memuat kontak, kendaraan, dan riwayat servis.
- Interaksi dan kebiasaan kenalan dapat dicatat dan dilihat kembali saat dibutuhkan.
- Catatan pribadi dapat ditambahkan dan hanya terlihat oleh pemiliknya.
- Data pribadi tersimpan di tempat terpisah dari data ruang kerja dan tidak bocor ke anggota lain.

## Sub-fitur: Profil Pelanggan

Simpan data pelanggan langganan seperti kontak, kendaraan, dan riwayat servis.

### Tujuan
Menyimpan data pelanggan langganan secara lengkap agar mudah ditemukan dan digunakan kembali.

### Selesai bila
- Profil pelanggan dapat dibuat dan diedit, mencakup kontak, kendaraan, dan riwayat servis.
- Daftar pelanggan dapat dicari dan dibuka dari ruang kerja.
- Data yang tersimpan tetap muncul setelah halaman dimuat ulang.

## Sub-fitur: Riwayat Kenalan

Catat interaksi dan kebiasaan kenalan agar tidak perlu bertanya ulang.

### Tujuan
Mencatat interaksi dan kebiasaan kenalan agar tidak perlu bertanya ulang.

### Selesai bila
- Pengguna dapat menambahkan catatan interaksi (tanggal, topik, hasil) pada profil kenalan.
- Kebiasaan atau preferensi kenalan tampil di profil saat dibutuhkan.
- Riwayat interaksi tersusun berurutan dan mudah dibaca.

## Sub-fitur: Memori Pribadi

Tambahkan catatan khusus milik sendiri yang hanya bisa dilihat oleh pemiliknya.

### Tujuan
Memberikan catatan khusus milik sendiri yang hanya bisa dilihat oleh pemiliknya.

### Selesai bila
- Pengguna dapat menambah, mengubah, dan menghapus catatan pribadi pada profil pelanggan/kenalan.
- Catatan pribadi hanya tampil untuk pengguna yang membuatnya.
- Catatan pribadi tidak ikut terbawa saat data profil dibagikan ke anggota lain.

## Sub-fitur: Privasi Terpisah

Data pribadi disimpan terpisah dari data ruang kerja supaya tidak bocor ke anggota lain.

### Tujuan
Memisahkan data pribadi dari data ruang kerja agar tidak mungkin bocor ke anggota lain.

### Selesai bila
- Data pribadi (catatan milik sendiri) tidak muncul di tampilan ruang kerja untuk anggota lain.
- Data ruang kerja dan data pribadi pengguna tersimpan terpisah sehingga tidak tercampur.
- Anggota lain tidak dapat membuka catatan pribadi meskipun mengetahui tautannya.

## Task

### 1. Buat halaman daftar kenalan dengan data tiruan

### 2. Buat halaman profil kenalan dengan tab info

### 3. Buat form tambah/edit profil pelanggan

### 4. Buat daftar dan form riwayat interaksi

### 5. Buat panel memori pribadi dengan CRUD lokal

### 6. Tambahkan pencarian dan filter daftar kenalan

### 7. Buat skema Prisma dan migrasi data kenalan

### 8. Buat API CRUD profil pelanggan dan kendaraan

### 9. Buat API riwayat interaksi dan preferensi

### 10. Buat API CRUD memori pribadi dengan proteksi pemilik

### 11. Pastikan pemisahan data pribadi di semua query
