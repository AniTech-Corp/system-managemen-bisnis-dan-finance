# Mata Uang

Pakai rupiah atau mata uang lain di semua perhitungan sesuai kebutuhan usaha.

## Spesifikasi

### Tujuan
Pengguna bisa menjalankan seluruh perencanaan bisnis dalam mata uang yang sesuai usahanya, baik Rupiah maupun mata uang lain, sehingga angka yang dipakai di semua fitur tidak membingungkan.

### Selesai bila
- Ada pengaturan untuk memilih mata uang utama usaha (misalnya Rupiah, Dolar AS, Dolar Singapura) dan pilihan tersimpan untuk Ruang Kerja.
- Saat mata uang utama diganti, semua angka yang tampil di kalkulator, proposal, dan pitch deck otomatis mengikuti mata uang tersebut.
- Mata uang asing yang didukung bisa dilihat nilai kursnya dan perhitungan tetap bisa dijelaskan dengan angka.

## Sub-fitur: Pilih mata uang

Atur mata uang utama, misalnya Rupiah atau Dolar, lewat pengaturan.

### Tujuan
Pengguna dapat mengatur mata uang utama usahanya lewat pengaturan agar semua fitur memakai mata uang yang sama.

### Selesai bila
- Ada halaman/bagian pengaturan untuk memilih mata uang utama dari daftar yang tersedia, misalnya Rupiah, Dolar AS, Dolar Singapura, Ringgit, dan lainnya.
- Pilihan tersimpan dan langsung dipakai saat pengguna kembali ke fitur lain; ada konfirmasi saat mengganti mata uang karena angka akan ditampilkan ulang.
- Mata uang yang dipilih tampil sebagai simbol/label di tempat angka ditampilkan, misalnya Rp, $, atau S$.

## Sub-fitur: Lihat kurs

Lihat kurs terbaru supaya perhitungan tetap sesuai kondisi.

### Tujuan
Pengguna bisa melihat kurs mata uang asing yang disediakan sistem agar tahu nilai konversi yang dipakai dalam perhitungan.

### Selesai bila
- Ada tampilan daftar kurs mata uang asing ke mata uang utama, lengkap dengan tanggal pembaruan kurs.
- Kurs yang ditampilkan adalah kurs referensi dari ekosistem, bukan diambil langsung dari internet, dan ada indikator kapan terakhir diperbarui.
- Saat transaksi dicatat dalam mata uang asing, nilai konversi ke mata uang utama memakai kurs terbaru dari daftar ini dan hasilnya bisa dilihat.

## Sub-fitur: Angka konsisten

Semua angka di proposal dan kalkulator otomatis memakai mata uang yang dipilih.

### Tujuan
Semua angka di proposal, kalkulator, dan dokumen lain otomatis memakai mata uang yang dipilih sehingga tidak ada angka campuran yang membingungkan.

### Selesai bila
- Setiap angka yang muncul di kalkulator finansial, simulasi KUR, penilaian usaha, proposal, dan pitch deck memakai simbol/label mata uang utama yang dipilih.
- Angka di dokumen yang diekspor (PDF/Word) ikut memakai mata uang utama.
- Data transaksi mata uang asing selalu menampilkan nilai asli dan nilai konversi ke mata uang utama secara berdampingan.

## Task

### 1. Buat halaman pengaturan mata uang dengan konfirmasi

### 2. Terapkan simbol mata uang terpilih pada angka

### 3. Buat daftar kurs asing dengan waktu pembaruan

### 4. Tampilkan nilai asli dan konversi transaksi asing

### 5. Terapkan pilihan mata uang pada dokumen ekspor

### 6. Buat tabel pengaturan mata uang ruang kerja

### 7. Buat API simpan ambil mata uang utama

### 8. Buat tabel kurs referensi dan API daftar

### 9. Sinkronkan kurs referensi dari ekosistem

### 10. Buat layanan konversi kurs untuk transaksi asing
