# Hak Akses & Peran

Memberikan peran kepada anggota Ruang Kerja dan mengatur hak akses khusus per departemen atau dokumen.

## Spesifikasi

### Tujuan
Memberikan peran dan hak akses kepada anggota Ruang Kerja agar setiap orang hanya bisa memakai modul dan melihat data yang sesuai tugasnya.

### Selesai bila
- Anggota Ruang Kerja dapat dilihat daftarnya beserta peran masing-masing (pemilik, anggota, atau pemberi persetujuan) dari satu halaman Hak Akses & Peran.
- Pemilik dapat mengubah peran anggota; perubahan langsung berlaku dan tercatat di Log Aktivitas.
- Pemberi persetujuan dapat memberikan atau mencabut hak akses khusus ke departemen/dokumen, dan akses tersebut langsung memengaruhi apa yang bisa dilihat/diubah orang itu.
- Sistem menolak pemberian akses khusus jika penyetuju menunjuk dirinya sendiri, dengan pesan yang jelas.
- Tidak ada anggota yang bisa mengubah peran atau hak miliknya sendiri tanpa izin pemilik.

## Sub-fitur: Peran Anggota

Menetapkan setiap orang sebagai pemilik, anggota, atau pemberi persetujuan.

### Tujuan
Menampilkan dan mengelola peran fungsional setiap anggota Ruang Kerja (pemilik, anggota biasa, pemberi persetujuan) agar hak dasar tiap orang jelas.

### Selesai bila
- Halaman Hak Akses & Peran menampilkan daftar semua anggota Ruang Kerja beserta perannya saat ini (Pemilik, Anggota, Penyetuju).
- Pemilik dapat mengubah peran anggota lain melalui pilihan peran, dan perubahan langsung tersimpan serta muncul di Log Aktivitas.
- Pemilik tidak dapat mengubah perannya sendiri dari halaman ini, dan anggota biasa tidak dapat mengubah peran siapa pun.

## Sub-fitur: Hak Modul

Mengatur modul apa saja yang boleh dipakai oleh tiap orang dalam Ruang Kerja.

### Tujuan
Mengatur modul mana saja yang boleh dipakai oleh setiap anggota Ruang Kerja, sehingga orang hanya mengakses fitur yang sesuai perannya.

### Selesai bila
- Untuk tiap anggota, pemilik atau penyetuju dapat melihat daftar modul (CorPlan, AniVirtual, Repository Hukum, KLIR Kas, KLIR Promo, KLIR Kerja, KLIR Booking) dan mengaktifkan atau menonaktifkan aksesnya.
- Perubahan hak modul langsung berlaku: orang yang dinonaktifkan tidak bisa membuka modul tersebut dan melihat pesan bahwa akses ditolak.
- Setiap perubahan hak modul tercatat di Log Aktivitas.

## Sub-fitur: Akses Khusus

Pemberi persetujuan dapat memberikan hak akses ke dokumen atau departemen tertentu.

### Tujuan
Memberi akses khusus ke departemen atau dokumen tertentu kepada anggota, sehingga data yang sensitif hanya bisa diakses orang yang diberi izin oleh penyetuju.

### Selesai bila
- Penyetuju dapat memilih anggota lain, memilih target akses (departemen atau dokumen), dan menentukan tingkat akses (lihat atau ubah).
- Akses yang diberikan langsung berlaku: anggota bisa membuka departemen/dokumen itu sesuai izin, dan tidak bisa mengakses yang tidak diberikan.
- Penyetuju dapat mencabut akses khusus, dan pencabutan langsung berlaku serta tercatat di Log Aktivitas.

## Sub-fitur: Tolak Akses Diri

Mencegah pemberi persetujuan memberikan akses kepada diri sendiri.

### Tujuan
Mencegah penyetuju memberikan akses khusus kepada dirinya sendiri, agar aturan pemisahan wewenang tetap terjaga.

### Selesai bila
- Saat penyetuju mencoba memilih dirinya sendiri sebagai penerima akses khusus, sistem menolak dan menampilkan pesan jelas seperti "Anda tidak dapat memberikan akses kepada diri sendiri".
- Penolakan tersebut tidak menyimpan perubahan apa pun dan tidak mencatat aksi berhasil; bila perlu, kegagalan dicatat di Log Aktivitas.
- Penerima akses hanya bisa orang lain selain penyetuju.

## Task

### 1. Buat halaman utama Hak Akses & Peran dengan daftar anggota

### 2. Implementasi ubah peran anggota dengan konfirmasi

### 3. Buat panel akses modul per anggota

### 4. Buat form kelola akses khusus departemen/dokumen

### 5. Tambahkan validasi larangan akses ke diri sendiri

### 6. Buat skema database peran, akses modul, dan akses khusus

### 7. Buat endpoint daftar anggota beserta peran dan akses

### 8. Buat endpoint ubah peran anggota

### 9. Buat endpoint kelola akses modul anggota

### 10. Buat endpoint beri/cabut akses khusus
