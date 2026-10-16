# Simulasi Keuangan

Hitung HPP, BEP, dan simulasi cicilan KUR untuk memastikan angka bisnismu sehat.

## Spesifikasi

### Tujuan
Membantu pemilik usaha kecil memastikan kesehatan angka bisnisnya dengan menghitung HPP, BEP, dan membandingkan simulasi cicilan KUR.

### Selesai bila
- Pengguna bisa memasukkan biaya produksi per unit, modal awal, biaya operasional bulanan, dan harga jual per unit pada satu layar.
- Sistem otomatis menampilkan HPP, BEP dalam unit dan rupiah, serta grafik titik impas.
- Pengguna bisa membandingkan cicilan KUR untuk beberapa tenor sekaligus.
- Setiap hasil perhitungan menggunakan validasi input untuk mencegah angka negatif atau pembagian nol.

## Sub-fitur: Hitung HPP & Biaya

Masukkan biaya produksi, modal awal, biaya operasional, dan harga jual untuk mendapat HPP.

### Tujuan
Menghitung Harga Pokok Produksi (HPP) berdasarkan input biaya produksi per unit, modal awal, biaya operasional bulanan, dan harga jual per unit.

### Selesai bila
- Tersedia empat kolom input untuk biaya produksi per unit, modal awal, biaya operasional bulanan, dan harga jual per unit.
- Sistem menampilkan nilai HPP per unit yang dihitung otomatis dari input tersebut.
- Input divalidasi: angka negatif atau nol pada biaya produksi memicu pesan kesalahan.

## Sub-fitur: Hitung BEP

Dapatkan titik impas dalam unit dan rupiah berdasarkan biaya dan harga yang dimasukkan.

### Tujuan
Menghitung titik impas (BEP) dalam unit dan rupiah agar pengguna tahu kapan usaha mulai balik modal.

### Selesai bila
- Sistem menampilkan BEP dalam unit dan rupiah secara otomatis setelah input biaya dan harga tersedia.
- Angka BEP ditampilkan dengan format mudah dibaca, misal "1.250 unit" dan "Rp 12.500.000".
- Hasil BEP ikut berubah saat pengguna mengubah biaya atau harga jual.

## Sub-fitur: Grafik Titik Impas

Lihat visualisasi kapan usaha mulai balik modal lewat grafik yang mudah dipahami.

### Tujuan
Menampilkan grafik titik impas yang memvisualisasikan perpotongan total biaya dan pendapatan agar pengguna mudah memahami kapan usaha balik modal.

### Selesai bila
- Grafik menampilkan dua garis: total biaya dan pendapatan, dengan titik impas ditandai jelas.
- Grafik diperbarui secara langsung saat input biaya atau harga jual diubah.
- Sumbu X berlabel volume penjualan (unit) dan sumbu Y berlabel nilai rupiah.

## Sub-fitur: Simulasi Cicilan KUR

Bandingkan cicilan pinjaman KUR dari beberapa tenor sekaligus.

### Tujuan
Membandingkan simulasi cicilan KUR untuk beberapa tenor sekaligus agar pengguna bisa memilih tenor pinjaman yang paling sesuai.

### Selesai bila
- Pengguna bisa memasukkan jumlah pinjaman dan melihat hasil untuk tenor 12, 24, 36, 48, dan 60 bulan dalam satu tampilan berdampingan.
- Setiap kartu/kolom menampilkan cicilan per bulan, total bunga, dan total bayar.
- Ada label tenor yang jelas di tiap hasil simulasi agar mudah dibandingkan.

## Sub-fitur: Kelola Skenario

Simpan beberapa skenario modal, harga, atau biaya, lalu muat ulang untuk membandingkan hasil simulasi.

### Tujuan
Memungkinkan pengguna menyimpan beberapa skenario modal, harga, atau biaya dari simulasi finansial lalu memuat ulangnya untuk membandingkan hasil HPP, BEP unit, dan BEP rupiah.

### Selesai bila
- Pengguna dapat menyimpan skenario aktif dari kalkulator dengan nama yang unik dan mudah dikenali.
- Pengguna dapat melihat daftar semua skenario tersimpan miliknya dan memuat ulang salah satunya dengan satu klik.
- Setelah dimuat ulang, input modal, harga jual, biaya produksi, dan biaya operasional beserta hasil HPP, BEP unit, BEP rupiah, dan grafik BEP langsung diperbarui sesuai skenario tersebut.
- Pengguna dapat menghapus skenario yang tidak dibutuhkan; penghapusan hanya menghapus skenario terpilih, bukan data proposal lainnya.
- Jika pengguna belum menyimpan skenario, sistem menampilkan pesan jelas bahwa belum ada skenario tersimpan.

## Task

### 1. Buat halaman kelola skenario dengan data tiruan

### 2. Buat halaman Simulasi Keuangan dengan layout empat seksi

### 3. Buat form input biaya produksi, modal, operasional, dan harga jual

### 4. Buat formulir simpan skenario dengan nama unik

### 5. Buat aksi muat skenario ke kalkulator

### 6. Tampilkan hasil HPP dan BEP dengan format Rupiah

### 7. Buat aksi hapus skenario dengan konfirmasi

### 8. Buat grafik titik impas dengan data tiruan

### 9. Tampilkan pesan kosong saat belum ada skenario

### 10. Buat kartu simulasi cicilan KUR untuk lima tenor

### 11. Integrasikan state dan perhitungan real-time di halaman Simulasi Keuangan

### 12. Buat tabel skenario dan migrasi database

### 13. Buat API simpan dan daftar skenario pengguna

### 14. Buat service perhitungan HPP dan BEP dengan validasi

### 15. Implement API Simulasi Keuangan & Auto-Sync Proposal

**Prompt:**

```
Implement synchronous calculation for HPP and BEP:
1. Backend NestJS must accept 4 inputs (production cost, initial capital, operational cost, selling price).
2. Calculate HPP and BEP using pure math formulas (no AI).
3. Validate inputs to prevent negative numbers or division by zero.
4. Save results to 'FinancialSimulation' table.
5. PENTING: Implement an internal trigger to auto-update Bab 6 (financial_projection) in the corresponding 'ProposalSection' using these real numbers after saving.
```

### 16. Buat API muat dan hapus skenario

### 17. Buat service dan endpoint simulasi cicilan KUR
