# Buku Alamat

Menyimpan nama, jabatan, gaya komunikasi, dan catatan untuk tiap kontak kerja sebagai konteks.

## Spesifikasi

### Tujuan
Buku Alamat menyimpan nama, jabatan, gaya komunikasi, dan catatan tiap kontak kerja sebagai konteks, sehingga analisis pesan dan draf balasan di AniVirtual bisa lebih sesuai dengan kebiasaan masing-masing kontak.

### Selesai bila
- Pengguna dapat menambah, melihat, mengubah, dan menghapus kontak kerja; data setiap kontak (nama, jabatan, gaya komunikasi, catatan) tersimpan dengan benar.
- Daftar kontak menampilkan semua kolom penting, dan setiap kontak hanya bisa dilihat oleh pemiliknya.
- Pencarian kontak berdasarkan nama atau jabatan berjalan cepat dan hasilnya akurat.
- Data kontak yang tersimpan langsung dipakai sebagai konteks oleh fitur Analisis Pesan dan Draf Balasan saat kontak dipilih.

## Sub-fitur: Tambah Kontak

Menambahkan kontak kerja baru lengkap dengan informasi pentingnya.

### Tujuan
Memungkinkan pengguna menyimpan kontak kerja baru dengan informasi penting (nama, jabatan, gaya komunikasi, catatan) sebagai konteks.

### Selesai bila
- Formulir tambah kontak menampilkan kolom nama (wajib) serta kolom jabatan, gaya komunikasi, dan catatan (opsional).
- Setelah menekan 'Simpan', kontak baru muncul di daftar Buku Alamat tanpa perlu memuat ulang halaman.
- Jika kolom nama kosong, muncul pesan kesalahan dan data tidak tersimpan.

## Sub-fitur: Edit & Hapus Kontak

Mengubah data kontak atau menghapus kontak yang tidak diperlukan.

### Tujuan
Memungkinkan pengguna memperbarui atau menghapus data kontak yang sudah ada agar Buku Alamat tetap relevan.

### Selesai bila
- Setiap kontak memiliki tombol 'Edit' dan 'Hapus' yang mudah ditemukan.
- Saat 'Edit' diklik, formulir terisi data kontak saat ini; perubahan tersimpan saat menekan 'Simpan' dan langsung terlihat di daftar.
- Saat 'Hapus' diklik, muncul dialog konfirmasi; setelah disetujui, kontak hilang dari daftar.

## Sub-fitur: Cari Kontak

Mencari kontak dengan cepat berdasarkan nama atau jabatan.

### Tujuan
Memungkinkan pengguna menemukan kontak dengan cepat berdasarkan nama atau jabatan.

### Selesai bila
- Kolom pencarian tersedia di halaman Buku Alamat; daftar kontak langsung menyaring hasil sesuai kata yang diketik.
- Pencarian mencocokkan sebagian kata pada nama atau jabatan dan hasil muncul dalam waktu kurang dari 1 detik.
- Hasil pencarian hanya menampilkan kontak milik pengguna sendiri.

## Sub-fitur: Catatan Kontak

Menulis catatan bebas untuk mengingat preferensi atau hal penting dari kontak.

### Tujuan
Memungkinkan pengguna menulis catatan bebas untuk mengingat preferensi gaya komunikasi atau hal penting lain dari kontak.

### Selesai bila
- Setiap kontak memiliki area 'Catatan' yang bisa diisi teks bebas.
- Catatan tersimpan bersamaan dengan data kontak dan tetap tampil saat kontak dibuka kembali.
- Isi catatan ikut digunakan sebagai konteks ketika kontak dipilih di fitur Analisis Pesan atau Draf Balasan.

## Sub-fitur: Personalisasi Real-time

Memakai data kontak secara langsung sebagai konteks untuk analisis pesan dan draf balasan.

### Tujuan
Memanfaatkan data kontak yang tersimpan (nama, jabatan, gaya komunikasi, dan catatan) agar analisis pesan dan draf balasan langsung menyesuaikan diri dengan kebiasaan orang tersebut, tanpa perlu pengaturan tambahan dari pengguna.

### Selesai bila
- Saat pengguna memilih kontak pada Analisis Pesan, hasil analisis ikut mempertimbangkan data kontak itu—misalnya gaya komunikasi yang tersimpan memengaruhi penilaian nada/urgensi pesan—dan menyebut nama/jabatan kontak bila relevan.
- Saat meminta draf balasan untuk pesan dari kontak terpilih, kedua draf yang dihasilkan menunjukkan penyesuaian gaya sesuai preferensi komunikasi kontak (misalnya to-the-point, formal, santai) dan menggunakan nama/posisi kontak secara wajar.
- Setiap perubahan pada data kontak (nama, jabatan, gaya komunikasi, atau catatan) langsung berdampak pada hasil Analisis Pesan dan draf balasan berikutnya, tanpa pengguna perlu mengisi ulang pesan atau memulai sesi baru.
- Jika tidak ada kontak yang dipilih atau data kontak kosong, sistem tetap berfungsi normal dengan konteks seadanya dan tidak menampilkan informasi kontak yang sebenarnya tidak tersedia.
- Indikator keyakinan pada Analisis Pesan mencerminkan ada/tidaknya konteks kontak: pesan dengan kontak terpilih cenderung mendapat keyakinan lebih tinggi daripada pesan tanpa kontak, selama teksnya sama-sama jelas.

## Task

### 1. Buat halaman buku alamat dengan data tiruan

### 2. Buat form tambah kontak dengan data tiruan

### 3. Buat edit dan hapus kontak

### 4. Buat pencarian kontak berdasarkan nama atau jabatan

### 5. Buat catatan kontak dengan data tiruan

### 6. Buat skema dan migrasi tabel kontak

### 7. Buat API CRUD untuk kontak

### 8. Buat API pencarian kontak

### 9. Buat API CRUD catatan kontak

### 10. Buat halaman utama daftar kontak dengan data tiruan

### 11. Buat formulir tambah kontak dengan validasi nama wajib

### 12. Buat formulir edit dan tombol hapus dengan konfirmasi

### 13. Tambahkan pencarian kontak berdasarkan nama dan jabatan

### 14. Buat migrasi tabel kontak dengan kolom kepemilikan pengguna

### 15. Buat API CRUD kontak NestJS dengan autentikasi pemilik

### 16. Tambahkan pencarian kontak pada API dengan indeks
