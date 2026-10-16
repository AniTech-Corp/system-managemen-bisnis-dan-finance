# Penilaian Usaha

Lihat perkiraan nilai usaha sekarang, jadi tahu wajar tidaknya kalau mau cari investor atau menjual usaha.

## Spesifikasi

### Tujuan
Fitur ini membantu pengguna menghitung perkiraan nilai usaha mereka berdasarkan data keuangan yang sudah ada, sehingga pengguna bisa memahami posisi tawar usahanya saat bernegosiasi dengan calon investor atau saat mengajukan pinjaman.

### Selesai bila
- Pengguna dapat melihat perkiraan nilai usaha dalam bentuk kisaran angka (misalnya Rp 500 juta – Rp 700 juta) yang dihitung dari data laba, aset, dan proyeksi yang dimasukkan.
- Pengguna dapat melihat dasar perhitungan yang menjelaskan mengapa nilai usaha berada dalam kisaran tersebut, termasuk data apa saja yang digunakan.
- Pengguna dapat memasukkan atau mengubah data laba bersih tahunan, total aset, dan proyeksi pertumbuhan untuk menghitung ulang nilai usaha.
- Hasil perkiraan nilai usaha otomatis tersimpan dan bisa ditampilkan kembali di dokumen lain (seperti proposal atau pitch deck) tanpa perlu memasukkan ulang data.
- Ada catatan jelas bahwa hasil ini adalah perkiraan dan bukan penilaian resmi dari lembaga penilai profesional.

## Sub-fitur: Input keuangan

Masukkan data laba, aset, dan utang sebagai dasar penilaian.

### Tujuan
Memasukkan data keuangan dasar (laba, aset, utang) sebagai bahan perhitungan nilai usaha.

### Selesai bila
- Pengguna dapat mengisi atau mengubah tiga kelompok data: laba bersih tahunan, total aset, dan total utang usaha.
- Setiap angka memiliki label dan satuan yang jelas (misalnya Rupiah per tahun, Rupiah).
- Ada validasi bahwa angka yang dimasukkan harus berupa nominal positif, dan sistem menampilkan pesan jika ada angka yang tidak masuk akal (misalnya laba negatif).
- Data tersimpan otomatis setiap kali pengguna selesai mengisi, dan pengguna bisa kembali mengubahnya kapan saja.

## Sub-fitur: Hasil nilai usaha

Dapatkan perkiraan nilai usaha lengkap dengan penjelasan singkat.

subSpecs

## Sub-fitur: Riwayat penilaian

Simpan hasil dari waktu ke waktu untuk memantau perkembangan nilai usaha.

## Task

### 1. Bangun halaman utama fitur Penilaian Usaha dengan data tiruan

### 2. Buat form input data keuangan lengkap dengan validasi lokal

### 3. Tampilkan hasil kisaran nilai usaha dengan komponen penjelasan

### 4. Bangun riwayat penilaian dengan daftar hasil tersimpan tiruan

### 5. Rancang skema database untuk input keuangan, hasil & riwayat

### 6. Buat API untuk menyimpan dan mengambil data penilaian usaha

### 7. Integrasikan perhitungan nilai usaha & catatan disclaimer di backend
