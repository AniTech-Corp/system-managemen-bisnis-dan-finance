# Paket & Upgrade

Memilih dan menaikkan paket Free, Starter, atau Business lengkap dengan alur pembayaran.

## Spesifikasi

### Tujuan
Memungkinkan pengguna memilih dan menaikkan paket Ruang Kerja (Free, Starter, atau Business) dengan alur pembayaran yang jelas sehingga jatah kredit dan layanan sesuai kebutuhan usaha.

### Selesai bila
- Dari halaman Paket & Upgrade, pengguna bisa melihat perbandingan paket Free, Starter, dan Business beserta harga serta jatah kredit harian, mingguan, dan bulanan.
- Pengguna yang memilih paket lebih tinggi dapat menyelesaikan pembayaran, dan Ruang Kerja langsung berpindah ke paket baru dengan jatah kredit yang sesuai.
- Pengguna dapat melihat status tagihan berjalan, status pembayaran, dan riwayat langganan di satu tempat yang mudah dijangkau.
- Paket yang sedang dipakai ditandai dengan jelas, dan aktivitas perubahan paket tercatat dalam log aktivitas Ruang Kerja.

## Sub-fitur: Lihat Paket

Menampilkan perbandingan paket beserta jatah kredit harian, mingguan, dan bulanan.

### Tujuan
Menampilkan perbandingan paket Free, Starter, dan Business lengkap dengan jatah kredit harian, mingguan, bulanan, dan harga yang harus dibayar.

### Selesai bila
- Tampilan Lihat Paket menunjukkan tiga kartu paket: Free, Starter, dan Business.
- Setiap paket menampilkan jatah yang benar: Free 100 kredit per hari; Starter 2.000 kredit per minggu dengan batas 10.000 per bulan; Business 8.000 kredit per minggu dengan batas 46.000 per bulan.
- Paket yang sedang berjalan diberi penanda yang jelas sehingga pengguna langsung tahu paket dia sekarang.

## Sub-fitur: Naik Paket

Mengubah langganan ke paket yang lebih tinggi dan menyelesaikan pembayaran.

### Tujuan
Mengubah langganan Ruang Kerja ke paket yang lebih tinggi dan menyelesaikan pembayaran sampai langganan aktif dipakai.
### Selesai bila
- Pengguna dapat memilih paket yang lebih tinggi dan melihat ringkasan sebelum membayar: nama paket, harga, dan jatah kredit yang didapat.
- Setelah pembayaran berhasil, status langganan Ruang Kerja berubah ke paket baru dan jatah kredit masuk ke kantong kredit Ruang Kerja.
- Jika pembayaran gagal atau dibatalkan, paket lama tetap berlaku dan pengguna melihat pesan yang mudah dipahami untuk mengulang pembayaran.

## Sub-fitur: Status Tagihan

Melihat tagihan berjalan, status pembayaran, dan riwayat langganan.

### Tujuan
Menampilkan tagihan berjalan, status pembayaran, dan riwayat langganan agar pengguna mudah memantau semua biaya dan perubahan paket.
### Selesai bila
- Halaman Status Tagihan menampilkan langganan yang aktif sekarang beserta periode berjalannya, misalnya tanggal mulai dan tanggal akhir siklus.
- Riwayat tagihan dan langganan tersusun urut waktu dengan informasi periode, jumlah tagihan, dan status seperti Sudah Bayar, Menunggu Pembayaran, atau Gagal.
- Status pembayaran setiap tagihan ditulis dengan label yang mudah dimengerti pengguna awam tanpa perlu melihat kode sistem.

## Task

### 1. Buat layout halaman Paket & Upgrade

### 2. Tampilkan kartu paket dengan jatah kredit

### 3. Buat modal konfirmasi upgrade paket

### 4. Simulasikan hasil pembayaran sukses dan gagal

### 5. Buat halaman Status Tagihan dengan data tiruan

### 6. Tampilkan riwayat tagihan dengan label status

### 7. Buat migrasi tabel paket dan seed

### 8. Buat endpoint daftar paket dan langganan

### 9. Buat tabel langganan dan invoice pembayaran

### 10. Buat endpoint upgrade paket dengan invoice

### 11. Buat handler pembayaran sukses dan gagal

### 12. Buat API riwayat tagihan dan status

### 13. Buat API detail langganan aktif
