# Beranda CorPlan

Pusat kendali yang menampilkan ringkasan usaha dan akses cepat ke semua alat perencanaan.

## Spesifikasi

### Tujuan
Menjadi halaman pertama CorPlan yang merangkum kondisi usaha dan memberikan pintu masuk ke semua alat perencanaan, sehingga pengguna langsung tahu posisi dan langkah berikutnya.

### Selesai bila
- Saat CorPlan dibuka, muncul Beranda berisi identitas usaha, target pasar, produk utama, dan status langkah perencanaan tanpa perlu membuka fitur lain.
- Beranda menampilkan akses cepat ke semua fitur perencanaan dengan label yang mudah dikenali; setiap klik membuka fitur yang benar.
- Data yang tampil diambil dari data usaha yang tersimpan di Ruang Kerja dan tidak bisa diedit langsung dari Beranda; jika ada data yang keliru, pengguna diarahkan ke pengaturan atau fitur terkait.
- Untuk pengguna pertama kali, muncul panduan singkat dan penjelasan istilah agar tidak bingung.

## Sub-fitur: Ringkasan Usaha

Lihat nama usaha, target pasar, dan produk sekilas dalam satu tampilan.

### Tujuan
Menampilkan identitas dan gambaran dasar usaha (nama usaha, target pasar, dan produk) dalam satu tampilan agar pengguna langsung mengenali Ruang Kerja yang sedang dibuka.

### Selesai bila
- Beranda menampilkan nama usaha, jenis usaha, target pasar, dan daftar produk utama yang tersimpan di data usaha.
- Jika data usaha belum lengkap, muncul ajakan singkat untuk melengkapi profil yang mengarah ke pengisian data usaha.
- Jika menampilkan harga produk, format angka mengikuti mata uang utama Ruang Kerja.

## Sub-fitur: Progres Perencanaan

Pantau langkah yang sudah selesai, dari proposal hingga legalitas.

### Tujuan
Menunjukkan langkah-langkah perencanaan mana yang sudah selesai dan mana yang belum, supaya pengguna tahu apa yang harus dikerjakan berikutnya.

### Selesai bila
- Beranda menampilkan daftar tahap kunci (misalnya Profil Usaha, Kalkulator Finansial, Proposal, dan Legalitas) dengan status "Belum", "Sedang", atau "Selesai" sesuai data yang sudah diisi.
- Status berubah otomatis saat pengguna melengkapi data di fitur terkait, tanpa perlu diatur manual dari Beranda.
- Tahap yang sudah selesai diberi indikator jelas seperti ceklis, dan tahap yang belum selesai bisa diklik untuk melanjutkan.

## Sub-fitur: Akses Cepat

Buka fitur perencanaan apa pun hanya dengan sekali klik.

### Tujuan
Menyediakan pintu langsung ke semua fitur perencanaan sehingga pengguna tidak perlu mencari-cari menu.

### Selesai bila
- Beranda menampilkan kartu atau ikon untuk setiap fitur utama CorPlan dengan nama yang mudah dipahami, seperti Proposal Bisnis, Kalkulator Finansial, Pitch Deck, dan Legalitas.
- Sekali klik pada kartu membuka fitur perencanaan yang dimaksud.
- Fitur yang belum tersedia tetap terlihat tetapi dinonaktifkan dengan jelas, tanpa menghalangi akses ke fitur lain.

## Sub-fitur: Panduan Pemula

Tur singkat dan penjelasan istilah untuk pengguna baru.

### Tujuan
Membantu pengguna baru memahami CorPlan dengan tur singkat dan penjelasan istilah dalam bahasa sederhana.

### Selesai bila
- Saat pertama kali membuka Beranda, muncul tur singkat yang mengenalkan bagian ringkasan usaha, progres perencanaan, dan akses cepat, dan tur tersebut bisa dilewati.
- Istilah bisnis seperti HPP, BEP, CapEx, dan OpEx yang muncul di Beranda memiliki penjelasan singkat dengan bahasa awam, misalnya lewat tooltip atau ikon "Apa ini?".
- Pengguna dapat membuka kembali panduan pemula kapan saja dari Beranda.

## Task

### 1. Bangun layout halaman Beranda dengan data tiruan

### 2. Buat komponen Ringkasan Usaha dengan data tiruan

### 3. Buat komponen Progres Perencanaan dengan data tiruan

### 4. Buat komponen Akses Cepat ke fitur perencanaan

### 5. Buat komponen Panduan Pemula untuk pengguna baru

### 6. Buat skema Prisma untuk data usaha dan progres

### 7. Buat API Beranda untuk ringkasan dan progres
