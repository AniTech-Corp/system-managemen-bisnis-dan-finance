# Periksa Legalitas

Panduan ceklis izin usaha seperti PIRT dengan syarat dan langkah daftar yang jelas.

## Spesifikasi

### Tujuan

Memberi panduan legalitas berlangkah yang mudah dijalankan sehingga pemilik UMKM tahu izin mana yang wajib dimiliki sesuai jenis usahanya dan bagaimana cara mengurusnya, dari syarat dokumen sampai cara pengajuan, tanpa perlu bantuan konsultan.

### Selesai bila
- Sistem menampilkan daftar izin yang disesuaikan dengan jenis usaha yang dipilih (misalnya kategori makanan menampilkan NIB, PIRT, Halal, BPOM), diurutkan dari yang paling prioritas.
- Setiap izin memiliki panduan langkah pengurusan yang jelas dan lengkap, meliputi syarat dokumen, urutan proses, dan cara mengajukan, sehingga pengguna bisa menuntaskannya langkah demi langkah.
- Pengguna dapat memperbarui status izin, mencatat nomor serta tanggal berlaku, dan menyimpan catatan dokumen penting di tempat yang sama, dengan data pribadi tidak ikut dibagikan ke modul lain.

## Sub-fitur: Daftar izin

Lihat izin yang wajib dimiliki sesuai jenis usaha, misalnya PIRT untuk makanan.

### Tujuan

Menampilkan daftar izin yang wajib dimiliki berdasarkan jenis usaha yang dipilih, misalnya PIRT untuk makanan, sehingga pengguna tahu persis dokumen legalitas apa yang harus dikuruskan.

### Selesai bila
- Setelah pengguna memilih jenis usaha, sistem menampilkan daftar izin yang relevan (contoh untuk makanan: NIB, PIRT, Halal, BPOM) dengan urutan prioritas yang disarankan.
- Setiap item izin menampilkan nama, keterangan singkat tentang fungsinya, dan status default 'belum dimulai'.
- Daftar izin dapat diklik untuk membuka detail izin yang memuat panduan pengurusan.

## Sub-fitur: Langkah pengurusan

Ikuti urutan cara mengurus setiap izin dari syarat sampai pengajuan.

### Tujuan

Memberikan petunjuk langkah demi langkah untuk mengurus setiap izin, mulai dari pengecekan syarat, menyiapkan dokumen, hingga cara pengajuan, agar pengguna tidak salah urutan atau tidak melimpahkan kebutuhan berkas penting.

### Selesai bila
- Pada halaman detail setiap izin muncul daftar langkah berurutan yang mencakup syarat dokumen, proses pengurusan (misal pendaftaran ke instansi terkait, pembayaran, verifikasi), serta cara pengajuan lanjut.
- Pengguna dapat mencentang setiap langkah yang sudah selesai, dan progres tersebut tetap tersimpan saat pengguna meninggalkan halaman.
- Setelah semua langkah selesai, tersedia tombol penanda status yang membawa pengguna masuk ke pengisian nomor dan tanggal izin.

## Sub-fitur: Status izin

Tandai izin yang sudah selesai dan catat nomor serta tanggalnya.

### Tujuan

Memberi pengguna kemampuan menandai status dari setiap izin sebagai belum gunakan, sedang diperoses, atau sudah selesai, dan ketika selesai mencatat nomor serta tanggal berlaku agar daftar legalitas bisa terpatau secara rapih.

### Selesai bila
- Setiap izin memiliki status yang dapat diubah di antara tiga opsi 'belum dimulai', 'sedang diprores', dan 'selesai from kegiatan'. Apabila status berubah menjadi selesai, muncul kolom wajib isi untuk nomor izin dan tanggal berlaku.
- Nomor izin dan tanggal berlaku yang telah dimasukkan tampil pada kartu daftar izin, memudahkan pembacaannya.
- Daftar menampilkan warna status yang konsisten (misal merah = belum dimulai, kuning = dalam proses, hijau = selesai) sehingga pengguna tahu tingkap kelengkapan usaha.

## Sub-fitur: Catatan dokumen

Simpan catatan dokumen penting agar mudah ditemukan saat dibutuhkan.

### Tujuan

Menyediakan tempat catatan per izin untuk menyimpan dokumen penting maupun catatan proses, sehingga penguna tidak harus memburu berkas di banyak tempat saat dibutuhkan, dan ia mudah kembali mencari catatan itu.

### Selesai bila
- Setiap izin dilengkapi area catatan berupa teks bebas yang dapat ditambah, disunting, dan dihapus; catatan disimpan per izin dan tidak hilang saat berpindah ke izin lain.
- Secara default catatan diberi sifat 'pribadi' yang menolak jika data ini adalah rahasia dan tidak boleh diturunkan lewat mekanins Bagikan Konteks Usaha ataupun ke modul lain.
- Pada kartu daftar izin terdapat penanda/ikon yang menunjukkan bahwa izin tersebut memiliki catatan tersimpan, sehingga pengguna tahu mana yang sudah pernah didokumentasikan.

## Task

### 1. Buat halaman daftar izin utama

### 2. Buat detail izin dengan langkah-langkah

### 3. Terapkan perubahan status izin

### 4. Tambah catatan pribadi per izin

### 5. Buat badge warna status izin

### 6. Rancang skema tabel data izin

### 7. Buat API daftar izin usaha

### 8. Buat API pembaruan status izin

### 9. Buat API kelola catatan izin

### 10. Integrasi manual data Repository Hukum
