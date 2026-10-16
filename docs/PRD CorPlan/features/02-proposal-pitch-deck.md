# Proposal & Pitch Deck

Susun proposal bisnis enam bab dan ubah jadi presentasi investor dua belas slide dengan data sinkron.

## Spesifikasi

### Tujuan

Memungkinkan pengguna menyusun proposal bisnis enam bab standar bank dan mengubahnya menjadi presentasi investor dua belas slide dari satu sumber data yang sama, tanpa perlu mengetik ulang angka atau penjelasan yang sudah ada.

### Selesai bila

- Pengguna dapat menyusun proposal enam bab dengan panduan langkah demi langkah dan contoh kalimat, dengan urutan bab tetap: Ringkasan Eksekutif, Gambaran Usaha, Rencana Pemasaran, Rencana Operasional, Rencana Manajemen, dan Rencana Keuangan.
- Angka dari kalkulator finansial dan data dari analisis pasar/kompetitor masuk otomatis ke bab-bab proposal yang relevan, konsisten dengan sumbernya.
- Dari data proposal yang sama, sistem dapat menghasilkan 12 slide presentasi investor lengkap dengan narasi tiap slide.
- Proposal dan pitch deck tetap bisa disunting manual, dan hasil suntingan tersimpan.
- Proposal dapat diunduh sebagai PDF/Word dan pitch deck dapat diekspor sebagai file presentasi siap dibagikan.

## Sub-fitur: Susun Proposal

Isi enam bab standar bank dengan panduan langkah demi langkah dan contoh kalimat.

### Tujuan

Memandu pengguna mengisi enam bab proposal bisnis standar bank secara bertahap, lengkap dengan contoh kalimat, sehingga dokumen siap diajukan tanpa bantuan konsultan.

### Selesai bila

- Enam bab proposal tampil berurutan dan setiap bab memiliki panduan langkah demi langkah serta contoh kalimat yang bisa langsung dipakai atau disalin.
- Pengguna dapat menyunting isi tiap bab; perubahannya tersimpan dan tidak hilang saat berpindah bab.
- Status kelengkapan tiap bab terlihat jelas (misalnya belum lengkap atau sudah diisi) sehingga pengguna tahu bagian mana yang masih perlu dilengkapi.

## Sub-fitur: Data Otomatis

Angka dari kalkulator masuk ke proposal tanpa perlu diketik ulang.

### Tujuan

Mengisi bagian-bagian proposal secara otomatis dari data usaha yang sudah tersimpan, terutama angka kalkulator finansial, agar tidak perlu diketik ulang dan selalu sinkron.

### Selesai bila

- Bab Rencana Keuangan menampilkan HPP, belanja modal, biaya operasional, titik impas, simulasi KUR, dan perkiraan nilai usaha yang sama dengan hasil kalkulator dan fitur terkait.
- Bab Gambaran Usaha, Rencana Pemasaran, dan bagian lain terisi otomatis dari profil usaha, produk, target pasar, kompetitor, dan tren yang sudah disimpan.
- Bagian yang terisi otomatis dapat diperbarui jika data sumber berubah, namun tetap bisa dibedakan dari bagian yang sudah disunting manual.

## Sub-fitur: Jadi Pitch Deck

Ubah data proposal yang sama menjadi 12 slide siap presentasi.

### Tujuan

Mengubah isi proposal yang sama menjadi presentasi investor 12 slide dengan narasi tiap slide, sehingga siap dipresentasikan tanpa menyusun ulang data.

### Selesai bila

- Pitch deck berisi 12 slide dengan struktur umum investor: judul/visi, masalah, solusi, produk, pasar, kompetisi, model bisnis, pemasaran, tim/operasional, keuangan/valuasi, penggunaan dana, serta roadmap/kontak.
- Isi tiap slide memakai data proposal yang sama, termasuk angka keuangan, sehingga tidak ada data yang bertentangan antara proposal dan deck.
- Setiap slide memiliki catatan pembicara/narasi, dan pengguna dapat menyunting isi slide sesuai kebutuhan.

## Sub-fitur: Ekspor & Cetak

Unduh proposal sebagai PDF atau Word, dan ekspor pitch deck ke file presentasi siap dibagikan.

### Tujuan

Menyediakan hasil akhir yang bisa diunduh, dicetak, dan dibagikan: proposal dalam PDF/Word dan pitch deck dalam file presentasi.

### Selesai bila

- Tombol unduh tersedia untuk proposal dalam format PDF dan Word; hasilnya memuat seluruh bab beserta suntingan pengguna dengan format rapi.
- Pitch deck dapat diekspor ke file presentasi siap dibagikan (misalnya format PDF/PPT) yang memuat seluruh slide dan tetap terbaca.
- File yang dihasilkan menggunakan data terbaru yang tersimpan, bukan versi lama.

## Task

### 1. Buat layout proposal enam bab dengan mock

### 2. Buat editor bab dengan contoh kalimat

### 3. Tampilkan data kalkulator dan profil di proposal

### 4. Buat penanda bagian otomatis versus manual

### 5. Buat halaman pitch deck dari mock proposal

### 6. Tambahkan penyunting slide dan catatan pembicara

### 7. Buat menu unduh proposal dan pitch deck

### 8. Buat migrasi Prisma proposal, bab, dan deck

### 9. Buat API baca tulis proposal dan deck

### 10. Buat service sinkronisasi data kalkulator ke proposal

### 11. Buat API generate dua belas slide deck

### 12. Buat endpoint ekspor PDF Word dan presentasi

### 13. Terapkan guard ruang kerja serta log aksi
