# Kartu Kenalan

Menyimpan kartu pelanggan dan catatan pribadi agar tidak perlu bertanya ulang.

## Spesifikasi

### Tujuan
Menyimpan kartu pelanggan dan catatan pribadi agar pengguna tidak perlu bertanya ulang saat berinteraksi dengan pelanggan yang sama.

### Selesai bila
- Pengguna dapat membuat, mengedit, dan menghapus kartu pelanggan (berisi nama, kontak, dan info kendaraan) serta catatan pribadi, yang tersimpan permanen dan hanya bisa diakses oleh pemiliknya.
- Pengguna dapat melihat daftar kartu pelanggan dan membuka detailnya untuk melihat informasi lengkap beserta catatan pribadi, dengan tampilan yang rapi dan mudah dipahami.
- Tidak ada data kartu atau memori yang bocor ke anggota lain dalam ruang kerja yang sama — setiap data pribadi hanya muncul untuk pemiliknya.

## Sub-fitur: Lihat Kartu Pelanggan

Melihat data pelanggan, kendaraan, dan riwayat servis.

### Tujuan
Menampilkan data pelanggan, kendaraan, dan riwayat servis dalam satu tampilan agar pengguna mudah mengenali pelanggan tanpa bertanya ulang.

### Selesai bila
- Pengguna dapat membuka halaman detail kartu pelanggan yang menampilkan nama, nomor telepon, alamat, data kendaraan (jenis, tahun, nomor polisi), dan riwayat servis (tanggal, jenis servis, catatan) dalam format yang terstruktur.
- Kartu pelanggan menampilkan label jelas (mis. 'Kendaraan', 'Riwayat Servis') dan data kosong ditampilkan sebagai 'Belum ada data' agar pengguna tahu informasi belum tersedia.
- Pengguna dapat kembali ke daftar kartu pelanggan melalui tombol navigasi yang jelas.

## Sub-fitur: Persetujuan Memori Pribadi

Meninjau dan menyetujui usulan catatan memori dari AI secara manual sebelum disimpan permanen.

### Tujuan
Memberi pengguna kendali penuh atas usulan catatan memori dari AI — ia harus menyetujui secara manual sebelum catatan disimpan permanen.

### Selesai bila
- Saat AI mendeteksi informasi baru (mis. preferensi pelanggan, istilah khusus), pengguna melihat notifikasi berisi teks usulan catatan dan tombol 'Setujui' dan 'Tolak'.
- Jika pengguna menekan 'Setujui', catatan langsung tersimpan permanen dan muncul di daftar memori pribadi; jika 'Tolak', usulan dihapus dan tidak tersimpan.
- Tampilan notifikasi memperlihatkan sumber usulan (mis. dari percakapan mana) agar pengguna bisa memutuskan dengan konteks.

## Sub-fitur: Jaga Privasi Data

Menyimpan kartu dan memori sebagai data pribadi yang tidak terlihat anggota lain.

### Tujuan
Memastikan kartu pelanggan dan memori pribadi disimpan secara terpisah dari data ruang kerja sehingga tidak mungkin terlihat oleh anggota lain.

### Selesai bila
- Setiap kartu dan catatan memori terkait langsung ke pemilik (user) dan tidak memiliki keterkaitan dengan ruang kerja; pengguna lain di ruang kerja yang sama tidak dapat melihat atau mengaksesnya melalui fitur apa pun.
- Pengguna hanya melihat kartu dan memori miliknya sendiri saat masuk; tidak ada opsi berbagi atau menampilkan konten ke anggota lain.
- Sistem menolak akses dari user lain ke data pribadi (mis. saat mencoba membuka kartu milik orang lain) dengan pesan 'Tidak ditemukan' atau sejenisnya, tanpa membocorkan keberadaan data.

## Task

### 1. Bangun halaman daftar kartu pelanggan dengan data tiruan

### 2. Bangun halaman detail kartu pelanggan

### 3. Buat form tambah & edit kartu pelanggan

### 4. Buat modal persetujuan memori pribadi

### 5. Buat panel daftar memori pribadi pada detail kartu

### 6. Hubungkan UI ke API kartu (CRUD & detail)

### 7. Hubungkan UI ke API memori & persetujuan

### 8. Atur skema Prisma kartu & memori privat

### 9. Buat endpoint CRUD kartu pelanggan

### 10. Buat endpoint riwayat servis pada kartu

### 11. Buat endpoint daftar & persetujuan memori

### 12. Pasang proteksi akses data per pemilik

### 13. Terapkan proteksi akses data privat per user di backend
