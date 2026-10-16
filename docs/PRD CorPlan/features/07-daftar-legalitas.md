# Daftar Legalitas

Panduan mengurus izin usaha dengan daftar periksa, syarat, dan data dari ekosistem.

## Spesifikasi

### Tujuan
Memberi pemilik UMKM panduan mengurus izin usaha lewat daftar periksa yang sesuai jenis usaha, lengkap dengan syarat, status pengurusan, dan data dari Repository Hukum — tanpa perlu mencari tahu sendiri atau mengisi ulang data.

### Selesai bila
- Pengguna melihat daftar izin (misalnya NIB, PIRT, Halal, BPOM) yang relevan dengan jenis usaha yang tersimpan.
- Setiap item izin menampilkan syarat/cara pengurusan dan dapat ditandai statusnya (belum dimulai, baru diajukan, sedang diproses, sudah terbit).
- Perubahan status dan catatan tersimpan dan tampil saat pengguna membuka daftar lagi.
- Jika pengguna sudah punya data legalitas di Repository Hukum, data itu tampil melengkapi daftar tanpa perlu diketik ulang.

## Sub-fitur: Daftar Izin

Checklist izin yang dibutuhkan, seperti NIB dan PIRT, sesuai jenis usaha.

### Tujuan
Menampilkan daftar izin yang perlu diurus sesuai jenis usaha sehingga pengguna tahu dokumen apa saja yang wajib disiapkan.

### Selesai bila
- Daftar izin muncul berdasarkan jenis usaha yang tersimpan (misalnya NIB, PIRT, Halal untuk usaha makanan; NIB, BPOM untuk kosmetik).
- Setiap izin tampil sebagai item periksa dengan nama, penjelasan singkat, dan status awal "belum dimulai".
- Urutan daftar menunjukkan prioritas pengurusan agar pengguna tahu langkah pertama.

## Sub-fitur: Syarat & Cara

Lihat langkah-langkah dan dokumen yang harus disiapkan untuk setiap izin.

### Tujuan
Memberi tahu langkah-langkah dan dokumen yang harus disiapkan untuk mengurus tiap izin sehingga pengguna bisa menyiapkan semuanya sebelum mengajukan.

### Selesai bila
- Setiap izin di daftar dapat dibuka dan menampilkan langkah-langkah pengurusan secara berurutan.
- Halaman detail izin menampilkan dokumen yang harus disiapkan (misalnya KTP, NPWP, foto produk) dalam bahasa sederhana.
- Pengguna dapat kembali dari detail ke daftar dan melihat item yang sudah dibaca tanpa kehilangan posisi.

## Sub-fitur: Status Pengurusan

Tandai izin mana yang baru diajukan, sedang diproses, atau sudah terbit.

### Tujuan
Memungkinkan pengguna mencatat progres tiap izin sehingga ia tahu apa yang sudah selesai dan apa yang masih harus diurus.

### Selesai bila
- Setiap izin memiliki pilihan status: belum dimulai, baru diajukan, sedang diproses, atau sudah terbit.
- Pengguna dapat mengubah status lewat menu/aksi dan perubahannya tersimpan; saat membuka kembali status tetap sama.
- Izin berstatus "sudah terbit" tampil berbeda (misalnya dengan label terbit atau tanggal terbit) agar mudah dikenali.

## Sub-fitur: Data Legalitas Terhubung

Data izin dari Repository Hukum otomatis tampil sebagai pelengkap daftar periksa, tanpa perlu mengisi ulang.

### Tujuan
Menampilkan data izin yang sudah tersimpan di Repository Hukum langsung di daftar periksa CorPlan sehingga pengguna tidak perlu mengisi data yang sama dua kali.

### Selesai bila
- Izin yang datanya sudah ada di Repository Hukum otomatis muncul di daftar periksa tanpa perlu diketik ulang.
- Item hasil integrasi diberi penanda asal data (misalnya "dari Repository Hukum") agar jelas sumbernya.
- Jika data di Repository Hukum berubah, tampilan di daftar periksa mengikuti perubahan tersebut.

## Task

### 1. Buat halaman daftar legalitas dengan data tiruan

### 2. Buat halaman detail izin berisi langkah dan dokumen

### 3. Terapkan dropdown status pengurusan dengan penyimpanan state lokal

### 4. Tampilkan label status terbit pada item izin

### 5. Tambahkan lencana asal data dari Repository Hukum

### 6. Buat skema Prisma untuk data izin dan status

### 7. Isi data master izin sesuai jenis usaha

### 8. Buat endpoint API daftar izin oleh jenis usaha

### 9. Buat endpoint API ubah status pengurusan izin

### 10. Buat integrasi dan sinkronisasi Repository Hukum
