# Simulator KUR

Coba simulasi pinjaman KUR dengan bunga dan tenor berbeda sebelum mengajukan ke bank.

## Spesifikasi

### Tujuan
Membantu pengguna memperkirakan cicilan Kredit Usaha Rakyat (KUR) sebelum mengajukan ke bank, dengan mencoba berbagai skenario jumlah pinjaman, tenor, dan suku bunga, sehingga pengguna bisa merencanakan keuangan dan memilih opsi yang paling sesuai kemampuan bayar usahanya.

### Selesai bila
- Pengguna dapat memasukkan jumlah pinjaman (plafon), memilih tenor 12–60 bulan, dan memasukkan perkiraan suku bunga tahunan.
- Sistem menampilkan rincian cicilan bulanan (pokok + bunga), total bunga yang dibayar, dan total pembayaran keseluruhan, dengan format Rupiah yang jelas.
- Pengguna dapat membandingkan beberapa skenario tenor dan melihat rekomendasi tenor yang paling realistis berdasarkan kemampuan bayar (dari data laba/arus kas yang sudah ada).
- Hasil simulasi yang dipilih dapat disimpan dan otomatis tersedia untuk digunakan pada bagian Rencana Keuangan di proposal bisnis.
- Semua perhitungan berjalan secara transparan dan dapat dijelaskan menggunakan angka yang dimasukkan, tanpa melibatkan kecerdasan buatan.

## Sub-fitur: Hitung cicilan

Masukkan jumlah pinjaman dan tenor untuk melihat cicilan bulanan.

### Tujuan
Memungkinkan pengguna memasukkan jumlah pinjaman, tenor, dan suku bunga untuk langsung melihat perkiraan cicilan bulanan yang harus dibayar.

### Selesai bila
- Pengguna dapat mengisi jumlah pinjaman (contoh: Rp 50.000.000), memilih tenor antara 12 hingga 60 bulan, dan memasukkan suku bunga tahunan.
- Sistem menampilkan angka cicilan pokok per bulan, bunga per bulan, total cicilan per bulan, total bunga selama masa pinjaman, dan total pembayaran keseluruhan.
- Angka ditampilkan dalam format Rupiah dan mudah dibaca (contoh: Rp 1.234.567).
- Hasil perhitungan muncul segera setelah input diubah, tanpa perlu menekan tombol tambahan (atau melalui tombol "Hitung" yang jelas).

## Sub-fitur: Bandingkan Tenor

Bandingkan total bayar antara tenor pinjaman dan dapat rekomendasi tenor yang paling sesuai kemampuan bayar usaha.

### Tujuan
Membantu pengguna membandingkan beberapa pilihan tenor sekaligus untuk melihat total biaya dan cicilan bulanan yang berbeda, serta mendapatkan rekomendasi tenor yang paling sesuai dengan kemampuan bayar usaha.

### Selesai bila
- Pengguna dapat memilih beberapa tenor sekaligus (contoh: 12, 24, 36, 48, 60 bulan) untuk dibandingkan.
- Sistem menampilkan tabel perbandingan yang berisi: tenor, cicilan per bulan, total bunga, total pembayaran, dan perbedaan antar tenor.
- Sistem menampilkan rekomendasi tenor yang paling realistis berdasarkan kemampuan bayar yang diambil dari data laba/arus kas (dari kalkulator finansial atau input manual).
- Rekomendasi diberi label jelas, misalnya "Paling sesuai kemampuan bayar", beserta alasan singkat (misalnya: cicilan tidak melebihi 30% laba bersih).

## Sub-fitur: Pakai di proposal

Simpan hasil simulasi untuk dipakai mengisi angka di proposal bisnis.

### Tujuan
Menyimpan hasil simulasi KUR yang telah dipilih agar angkanya bisa dipakai langsung saat menyusun proposal bisnis, tanpa perlu memasukkan ulang.

### Selesai bila
- Terdapat tombol "Simpan Hasil" atau sejenisnya pada halaman hasil simulasi yang telah dipilih.
- Setelah disimpan, hasil simulasi (jumlah pinjaman, tenor, bunga, cicilan bulanan, total bunga, total pembayaran) tersimpan di CorPlan dan terkait dengan Ruang Kerja.
- Simulasi yang tersimpan muncul di daftar riwayat simulasi yang dapat diakses kembali dan dipilih kembali.
- Pada bagian Rencana Keuangan di Proposal Bisnis, pengguna dapat memilih simulasi yang tersimpan untuk mengisi angka kebutuhan dana dan proyeksi cicilan, tanpa harus menulis manual.

## Task

### 1. Buat halaman Simulator KUR dengan mock

### 2. Implementasikan perhitungan cicilan dinamis

### 3. Tampilkan perbandingan tenor dan rekomendasi

### 4. Tambahkan simpan hasil dan riwayat simulasi

### 5. Integrasikan pilihan simulasi ke Rencana Keuangan

### 6. Buat model Prisma SimulasiKUR

### 7. Buat API CRUD simulasi KUR

### 8. Buat API rekomendasi tenor berdasarkan kemampuan bayar

### 9. Hubungkan simulasi tersimpan ke Proposal
