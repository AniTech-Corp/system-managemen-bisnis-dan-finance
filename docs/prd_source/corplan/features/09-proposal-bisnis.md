# Proposal Bisnis

Buat proposal usaha enam bab dengan panduan langkah demi langkah, siap dipakai untuk mengajukan KUR atau meyakinkan investor.

## Spesifikasi

### Tujuan
Membantu pemilik UMKM menyusun proposal usaha enam bab yang rapi, lengkap, dan konsisten agar siap diajukan untuk KUR atau meyakinkan investor, tanpa harus mengetik ulang data yang sudah ada.
### Selesai bila
- Pengguna dapat membuat dan mengelola proposal yang berisi enam bab berurutan: Ringkasan Eksekutif, Gambaran Usaha, Rencana Pemasaran, Rencana Operasional, Rencana Manajemen, dan Rencana Keuangan, dengan kemudahan berpindah antarbab.
- Data yang sudah diisi sebelumnya (seperti profil usaha, perhitungan keuangan, dan analisis pasar) tampil otomatis pada bab yang sesuai, dan pengguna tetap dapat mengubah narasinya secara manual.
- Pengguna dapat melihat status kelengkapan tiap bab (misalnya lengkap atau belum) dan menyelesaikan proposal beserta ekspornya dalam format PDF atau Word.
- Seluruh isi proposal selalu konsisten dengan data terbaru; jika data sumber diubah, pengguna dapat memperbarui proposal dan melihat tanggal pembaruannya.

## Sub-fitur: Enam bab panduan

Ikuti alur enam bab mulai ringkasan usaha sampai lampiran, jadi proposal tidak ada yang terlewat.

### Tujuan
Memandu pengguna mengisi proposal secara bertahap melalui enam bab agar tidak ada bagian yang terlewat.
### Selesai bila
- Tampil panduan langkah demi langkah enam bab dengan urutan yang jelas, dan pengguna dapat berpindah antar-bab dengan mudah melalui tombol 'Sebelumnya' dan 'Berikutnya'.
- Setiap bab menampilkan indikator status (misalnya 'Kosong', 'Sebagian', atau 'Lengkap') dan penanda bab yang sudah atau belum dikerjakan sehingga progres terlihat jelas.

## Sub-fitur: Isi data sekali

Masukkan data usaha dan angka keuangan sekali, langsung tersusun di proposal.

### Tujuan
Memasukkan data usaha dan angka keuangan cukup sekali agar otomatis tersusun sebagai sebuah proposal yang terisi penuh dan konsisten.
### Selesai bila
- Seluruh data yang diinput sebelumnya (misalnya profil usaha, HPP, BEP, hasil riset pasar, atau legalitas) muncul otomatis pada bab-bab yang sesuai tanpa harus diketik ulang.
- Ketika data sumber diperbarui, muncul tombol atau tautan yang memungkinkan pengguna memperbarui isi proposal dan menampilkan tanggal pembaruan terakhir, sehingga pengguna selalu sadar saat datanya diperbarui.

## Sub-fitur: Cetak PDF

Unduh atau cetak proposal sebagai PDF rapi siap dikirim ke bank.

### Tujuan
Mengunduh atau mencetak proposal sebagai berkas PDF yang rapi dan siap dikirim ke bank atau pemangku kepentingan.
### Selesai bila
- Terdapat tombol 'Unduh' atau 'Cetak' di halaman proposal yang menghasilkan berkas PDF berisi seluruh isi enam bab dengan format yang terbaca baik.
- Hasil PDF tertata rapi tanpa terpotong, urutannya sama dengan isi proposal, serta menampilkan nomor halaman, nama usaha, dan tanggal pembuatan.

## Sub-fitur: Contoh kalimat

Lihat contoh kalimat untuk tiap bab lalu ganti dengan data sendiri.

### Tujuan
Membantu pengguna menulis tiap bab dengan menyediakan contoh kalimat yang relevan dan mudah disesuaikan dengan data usahanya.
### Selesai bila
- Pada tiap bab tersedia contoh kalimat yang dapat disalin atau dimasukkan ke dalam kolom isian untuk mempercepat proses penyusunan.
- Setelah contoh disisipkan, pengguna dapat langsung menyunting bagian tertentu yang ingin disesuaikan melalui editor teks sederhana, lalu perubahannya tersimpan otomatis di bab yang sama.

## Task

### 1. Bangun halaman utama Proposal Bisnis

### 2. Buat navigasi antar-bab dan indikator status

### 3. Implementasikan editor bab dengan contoh kalimat

### 4. Tampilkan integrasi data otomatis dari modul lain

### 5. Buat tombol unduh/cetak PDF (UI saja)

### 6. Buat skema Prisma untuk Proposal dan migrasi

### 7. Buat API CRUD untuk proposal dan isi bab

### 8. Buat endpoint perbarui data dari sumber

### 9. Buat endpoint generate PDF dari isi proposal
