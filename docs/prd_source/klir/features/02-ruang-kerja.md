# Ruang Kerja

Membuat dan mengelola beberapa Ruang Kerja yang terpisah, sehingga satu pengguna bisa menjalankan lebih dari satu usaha dengan data aman.

## Spesifikasi

### Tujuan
Membuat dan mengelola beberapa Ruang Kerja terpisah, sehingga satu pengguna bisa menjalankan lebih dari satu usaha dengan data aman.

### Selesai bila
- Pengguna dapat melihat daftar semua Ruang Kerja miliknya beserta status dan paket dari satu halaman.
- Pengguna dapat membuat Ruang Kerja baru yang langsung siap dipakai.
- Pengguna dapat berpindah antar Ruang Kerja tanpa memasukkan ulang data.
- Data setiap Ruang Kerja tidak tertukar atau terbaca oleh Ruang Kerja lain.

## Sub-fitur: Daftar Ruang

Melihat semua Ruang Kerja yang dimiliki beserta status dan paketnya.

### Tujuan
Menampilkan semua Ruang Kerja milik pengguna beserta status dan paketnya, agar pengguna mudah mengenali dan memilih usaha yang sedang atau akan dikerjakan.

### Selesai bila
- Pengguna dapat melihat daftar semua Ruang Kerja yang dimiliki dari satu halaman.
- Setiap Ruang Kerja di daftar menampilkan nama usaha, status langganan, dan nama paket.
- Jika pengguna belum memiliki Ruang Kerja, muncul ajakan untuk membuat Ruang Kerja pertama.

## Sub-fitur: Buat Ruang

Membuat Ruang Kerja baru untuk usaha yang berbeda.

### Tujuan
Memungkinkan pengguna membuat Ruang Kerja baru untuk usaha yang berbeda, lengkap dengan paket Free dan siap langsung dipakai.

### Selesai bila
- Pengguna dapat membuat Ruang Kerja baru dengan mengisi nama usaha dan menyimpannya.
- Setelah tersimpan, Ruang Kerja baru muncul di daftar Ruang dan bisa langsung dipilih.
- Ruang Kerja baru langsung berstatus aktif dengan paket Free.

## Sub-fitur: Pindah Ruang

Berpindah antar Ruang Kerja tanpa memasukkan data ulang.

### Tujuan
Memungkinkan pengguna berpindah antar Ruang Kerja tanpa memasukkan data ulang.

### Selesai bila
- Dari daftar Ruang, pengguna dapat memilih Ruang Kerja lain dan langsung diarahkan ke dasbor Ruang Kerja tersebut.
- Tampilan dan data yang sedang dikerjakan berubah mengikuti Ruang Kerja yang dipilih, tanpa perlu mengisi data ulang.
- Pengguna tidak diminta masuk atau memasukkan identitas ulang saat berpindah.

## Sub-fitur: Pemisahan Data

Menjaga data satu usaha tidak tertukar atau terbaca oleh usaha lain.

### Tujuan
Menjamin data setiap Ruang Kerja hanya bisa diakses di dalam Ruang Kerja yang bersangkutan, sehingga satu usaha tidak tercampur atau terbaca oleh usaha lain.

### Selesai bila
- Saat berada di dalam satu Ruang Kerja, yang terlihat hanya data milik Ruang Kerja itu, seperti modul, dokumen, kredit, dan log.
- Dari dalam Ruang Kerja aktif, pengguna tidak bisa membuka atau melihat isi data Ruang Kerja lain.
- Data Ruang Kerja lain tetap utuh dan tidak berubah ketika pengguna berpindah-pindah Ruang Kerja.

## Task

### 1. Buat halaman daftar ruang kerja

### 2. Buat form pembuatan ruang kerja

### 3. Buat alur pindah ruang kerja

### 4. Buat indikator ruang aktif di header

### 5. Buat skema & migrasi tabel ruang kerja

### 6. Buat tabel keanggotaan & peran ruang

### 7. Buat endpoint daftar ruang kerja pengguna

### 8. Buat endpoint buat ruang kerja baru

### 9. Buat endpoint pilih ruang kerja aktif

### 10. Buat middleware isolasi data antar ruang
