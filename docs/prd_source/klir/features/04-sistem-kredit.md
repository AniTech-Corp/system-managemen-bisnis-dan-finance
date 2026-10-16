# Sistem Kredit

Mengelola kantong kredit Ruang Kerja yang dipakai bersama oleh semua modul, lengkap dengan riwayat dan pengembalian.

## Spesifikasi

### Tujuan
Mengelola kantong kredit bersama setiap Ruang Kerja yang dipakai semua modul, termasuk melihat saldo, riwayat, pemotongan otomatis, dan pengembalian saat layanan gagal.

### Selesai bila
- Pengguna bisa melihat sisa kredit dan batas paket aktif dari Dasbor maupun halaman kredit.
- Setiap pemakaian fitur AI/layanan berbayar otomatis memotong kredit dan langsung tercatat.
- Riwayat kredit hanya bertambah; tidak ada tombol ubah/hapus transaksi.
- Bila layanan gagal setelah kredit terpotong, kredit dikembalikan dan tercatat sebagai transaksi baru.

## Sub-fitur: Saldo Klien

Melihat jumlah kredit yang masih tersisa dan batas paket saat ini.

### Tujuan
Menampilkan jumlah kredit yang masih tersisa dan batas paket yang sedang berlaku agar pengguna tahu sisa pemakaian tanpa pindah halaman.

### Selesai bila
- Di Dasbor dan halaman Kredit muncul sisa kredit dengan angka yang jelas, misalnya "Sisa kredit: 1.240".
- Muncul nama paket aktif beserta batasnya, misalnya "Free: 100 kredit/hari" atau "Starter: 2.000 kredit/minggu".
- Saat kredit bertambah atau berkurang, angka saldo langsung memperbarui tampilan.

## Sub-fitur: Riwayat Kredit

Melihat semua pemotongan dan penambahan kredit yang tidak bisa diubah atau dihapus.

### Tujuan
Menampilkan semua pemotongan dan penambahan kredit dalam satu daftar yang tidak bisa diubah atau dihapus, sehingga pengguna bisa menelusuri pemakaian kredit.

### Selesai bila
- Halaman Riwayat Kredit menampilkan daftar transaksi terbaru ke terlama, dengan tanggal, keterangan, jenis transaksi, dan jumlah kredit (minus untuk pemotongan, plus untuk penambahan/pengembalian).
- Tidak ada aksi ubah atau hapus transaksi; riwayat hanya bisa dilihat.
- Setiap transaksi menampilkan referensi aksi atau modul yang memakainya, misalnya "CorPlan – buat proposal".

## Sub-fitur: Potongan Kredit

Memotong kredit otomatis bila pengguna memakai fitur kecerdasan buatan atau layanan berbayar.

### Tujuan
Memotong kredit secara otomatis dari kantong Ruang Kerja setiap kali pengguna memakai fitur kecerdasan buatan atau layanan berbayar.

### Selesai bila
- Saat pengguna menjalankan aksi berbayar, sistem memeriksa saldo lalu memotong kredit otomatis sebelum aksi dijalankan.
- Setiap pemotongan langsung muncul di Riwayat Kredit sebagai transaksi debit dengan referensi aksi.
- Jika saldo tidak cukup, aksi tidak dijalankan dan pengguna melihat pesan bahwa kredit tidak cukup beserta sisa saldo.

## Sub-fitur: Pengembalian Kredit

Mengembalikan kredit ke kantong Ruang Kerja ketika layanan yang diminta gagal.

### Tujuan
Mengembalikan kredit ke kantong Ruang Kerja ketika layanan yang sudah dipotong kreditnya gagal, agar pengguna tidak dirugikan.

### Selesai bila
- Bila sebuah aksi berbayar gagal setelah kredit terpotong, kredit otomatis dikembalikan ke saldo Ruang Kerja.
- Pengembalian tercatat sebagai baris baru berjenis "Pengembalian" di Riwayat Kredit, dengan referensi ke aksi yang gagal.
- Saldo yang ditampilkan kembali bertambah sesuai jumlah yang dikembalikan, dan transaksi potongan asli tetap utuh.

## Task

### 1. Buat halaman utama kredit dengan layout & data dummy

### 2. Buat komponen kartu saldo kredit reusable

### 3. Buat halaman riwayat transaksi kredit

### 4. Buat komponen notifikasi saldo tidak cukup

### 5. Buat skema database kredit & migrasi

### 6. Buat endpoint ambil saldo dan paket aktif

### 7. Buat endpoint daftar riwayat kredit terbaru

### 8. Buat service potong kredit dengan cek saldo

### 9. Buat service pengembalian kredit saat layanan gagal
