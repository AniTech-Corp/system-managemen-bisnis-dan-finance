# Hak Akses & Akun

Mengatur masuk, ruang kerja, langganan, dan batasan peran agar data tetap aman.

## Spesifikasi

### Tujuan
Mengatur akses masuk pengguna dan memastikan setiap orang hanya bisa melihat data serta memakai fitur sesuai haknya di ruang kerja dan langganan yang sesuai, sehingga data usaha tetap aman.

### Selesai bila
- Pengguna harus masuk (login) terlebih dahulu sebelum bisa membuka modul AniVirtual, dan bisa keluar (logout) dengan aman; sesi yang sudah berakhir tidak bisa dipakai lagi.
- Setiap pengguna harus memilih satu ruang kerja aktif; semua data yang ditampilkan hanya dari ruang kerja tersebut, tidak ada data dari ruang kerja lain yang bocor.
- Peran pengguna (pemilik, penyetuju, anggota biasa) tersimpan dan divalidasi di server; pengguna hanya bisa melakukan tindakan yang diizinkan oleh perannya.
- Batasan akses berbasis peran diterapkan secara konsisten di seluruh fitur AniVirtual; pengguna yang tidak berhak melihat tombol atau menu tertentu, dan permintaan yang melanggar batasan ditolak.
- Status langganan ekosistem tampil jelas; fitur lanjutan hanya aktif jika langganan memenuhi syarat.

## Sub-fitur: Masuk & Keluar

Login dan logout dengan aman sebelum memakai modul AniVirtual.

### Tujuan
Memungkinkan pengguna masuk dan keluar dari modul AniVirtual dengan aman sebelum menggunakan fitur apa pun, sehingga data hanya diakses oleh orang yang berwenang.

### Selesai bila
- Pengguna yang belum login diarahkan ke halaman masuk AniVirtual; setelah berhasil login, mereka bisa mengakses modul.
- Tombol keluar tersedia di area profil; saat diklik, sesi berakhir dan pengguna kembali ke halaman masuk, dan akses ke data modul langsung tertutup.
- Setiap permintaan ke server tanpa sesi yang valid ditolak dengan pesan yang jelas, tanpa membocorkan data apa pun.

## Sub-fitur: Pilih Ruang Kerja

Pilih ruang kerja yang sedang aktif agar data yang dilihat sesuai.

### Tujuan
Memungkinkan pengguna memilih ruang kerja yang sedang aktif agar data yang dilihat dan diubah selalu berasal dari ruang kerja yang benar, mencegah tercampurnya data antar usaha.

### Selesai bila
- Setelah masuk, pengguna melihat daftar ruang kerja yang menjadi haknya dan dapat memilih salah satu sebagai ruang kerja aktif.
- Semua tampilan AniVirtual menampilkan nama ruang kerja aktif di bagian atas; data yang muncul (misalnya ajuan, rencana kerja, memori) hanya dari ruang kerja itu.
- Saat pengguna berpindah ruang kerja, tampilan diperbarui dan server hanya mengizinkan akses ke data ruang kerja yang dipilih; ruang kerja yang tidak berhak tidak muncul dalam daftar.

## Sub-fitur: Kelola Peran

Menetapkan peran anggota sebagai pemilik, penyetuju, atau anggota biasa.

### Tujuan
Memungkinkan pemilik ruang kerja menetapkan dan mengubah peran setiap anggota (pemilik, penyetuju, atau anggota biasa) agar alur kerja dan tanggung jawab sesuai kebutuhan usaha.

### Selesai bila
- Pemilik dapat melihat daftar anggota ruang kerja beserta perannya saat ini, dan dapat mengubah peran salah satu anggota melalui menu kelola peran.
- Perubahan peran hanya bisa dilakukan oleh pemilik; penyetuju dan anggota biasa tidak melihat menu ini atau ditolak saat mencoba mengubah peran.
- Setelah peran diubah, hak akses anggota langsung menyesuaikan (misalnya anggota yang dijadikan penyetuju bisa menyetujui ajuan), dan perubahan tercatat di riwayat/log audit.

## Sub-fitur: Atur Batasan

Tentukan fitur dan data yang boleh diakses oleh masing-masing peran.

### Tujuan
Menentukan fitur dan data yang boleh diakses oleh masing-masing peran (pemilik, penyetuju, anggota biasa) supaya tindakan yang dilakukan sesuai kewenangan dan data sensitif tidak terbuka.

### Selesai bila
- Tersedia daftar batasan baku per peran, misalnya: pemilik bisa mengelola peran dan melihat semua data; penyetuju bisa menyetujui ajuan sesuai anggaran; anggota biasa hanya bisa membuat dan melihat ajuan miliknya sendiri.
- Pada setiap halaman AniVirtual, tombol atau menu yang tidak sesuai peran disembunyikan atau dinonaktifkan; jika pengguna memaksa mengakses lewat tautan, server menolak dengan pesan "tidak punya hak akses".
- Data pribadi seperti kartu kenalan dan memori pribadi tidak pernah ditampilkan kepada anggota lain, terlepas dari peran; hanya pemiliknya yang bisa melihat dan mengelolanya.

## Sub-fitur: Status Langganan

Lihat status langganan ekosistem agar fitur lanjutan bisa digunakan.

### Tujuan
Menampilkan status langganan ekosistem KLIR kepada pengguna, sehingga fitur lanjutan AniVirtual hanya bisa dipakai jika langganan aktif dan memenuhi syarat.

### Selesai bila
- Halaman atau panel status langganan menampilkan informasi: jenis langganan, tanggal aktif/berakhir, dan status aktif/nonaktif, dengan jelas dan mudah dibaca.
- Jika langganan tidak aktif atau kedaluwarsa, fitur lanjutan AniVirtual (misalnya integrasi dengan CorPlan, KLIR Kerja, atau KLIR Kas) tidak bisa diakses dan muncul pemberitahuan untuk memperbarui langganan.
- Status langganan diperbarui secara otomatis dari server; perubahan status langsung tercermin di tampilan tanpa perlu masuk kembali.

## Task

### 1. Buat halaman utama modul AniVirtual dengan data tiruan

### 2. Buat halaman login dan tombol logout dengan simulasi sesi

### 3. Buat komponen pemilih ruang kerja aktif dengan daftar mock

### 4. Buat halaman kelola peran anggota dengan data mock

### 5. Buat komponen batasan akses berbasis peran untuk menu/tombol

### 6. Buat panel status langganan dengan data mock

### 7. Buat skema database untuk user, sesi, ruang kerja, peran, langganan

### 8. Buat endpoint login dan logout dengan autentikasi sesi

### 9. Buat endpoint daftar ruang kerja pengguna dan set ruang kerja aktif

### 10. Buat endpoint kelola peran anggota dengan otorisasi pemilik

### 11. Buat middleware otorisasi peran untuk batasan akses server

### 12. Buat endpoint status langganan dan integrasi sistem langganan
