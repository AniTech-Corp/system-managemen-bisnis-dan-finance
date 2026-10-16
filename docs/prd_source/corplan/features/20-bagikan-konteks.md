# Bagikan Konteks

Atur dan kirim data usaha yang boleh dipakai modul KLIR lain seperti Kas, Promo, dan AniVirtual.

## Spesifikasi

### Tujuan
Memungkinkan pengguna mengontrol dan mengirim data usaha yang boleh dibagikan ke modul KLIR lain (Kas, Promo, AniVirtual) secara aman dan otomatis.

### Selesai bila
- Pengguna dapat menandai setiap data usaha (misalnya nama usaha, produk, target pasar) sebagai boleh dibagikan atau pribadi; data pribadi tidak pernah dikirim ke modul lain.
- Terdapat tombol "Bagikan Konteks" yang menghasilkan snapshot bertanggal berisi data yang ditandai boleh dibagikan dan mengirimkannya ke modul tujuan.
- Setiap kali anggaran per kategori diperbarui, sistem otomatis membuat snapshot anggaran baru dan mengirimkannya ke AniVirtual dan KLIR Kas tanpa tindakan manual.
- KLIR Promo membaca langsung data katalog produk dari CorPlan saat membuat materi promosi, sehingga data yang digunakan selalu terbaru.
- Daftar periksa legalitas di CorPlan menampilkan data izin yang sudah tersimpan di Repository Hukum tanpa perlu memasukkan ulang.

## Sub-fitur: Atur pembagian

Tandai data yang boleh dibagikan seperti nama usaha dan produk; data sensitif tetap aman.

### Tujuan
Memberi kontrol kepada pengguna untuk menentukan data usaha mana yang boleh dibagikan ke modul lain, sehingga data sensitif tetap aman.

### Selesai bila
- Pengguna dapat menandai setiap data usaha (misalnya nama usaha, produk, target pasar) sebagai "boleh dibagikan" atau "pribadi" melalui antarmuka sederhana.
- Data yang ditandai "pribadi" tidak pernah dikirim ke modul lain, dan tidak muncul dalam paket konteks atau snapshot apa pun.
- Tersedia daftar atau ringkasan yang menunjukkan status pembagian tiap data (boleh dibagikan / pribadi) dan dapat diubah kapan saja.

## Sub-fitur: Kirim Ringkasan

Kirim paket konteks usaha sebagai snapshot bertanggal ke modul lain dan otomatis kirim salinan anggaran ke AniVirtual dan KLIR Kas setiap anggaran diperbarui.

### Tujuan
Mengirimkan ringkasan data usaha yang boleh dibagikan sebagai paket konteks bertanggal ke modul lain, serta mengirimkan snapshot anggaran secara otomatis saat anggaran diperbarui.

### Selesai bila
- Tombol "Bagikan Konteks" membuat paket berisi profil usaha, target pasar, proposisi nilai, dan ringkasan keuangan yang ditandai boleh dibagikan, dengan tanggal pembuatan yang jelas.
- Paket yang dibuat tersedia untuk modul tujuan (misalnya AniVirtual) dan tidak berubah meskipun data di CorPlan berubah setelahnya.
- Setiap kali anggaran per kategori diperbarui di CorPlan, sistem otomatis membuat snapshot bertanggal baru dan mengirimkannya ke AniVirtual dan KLIR Kas tanpa perlu pengguna menekan tombol.

## Sub-fitur: Hubungkan Promo

KLIR Promo membaca katalog produk langsung dari CorPlan setiap membuat materi promosi, jadi data selalu yang terbaru.

### Tujuan
Memastikan KLIR Promo selalu menggunakan data katalog produk terbaru dari CorPlan saat membuat materi promosi, tanpa perlu sinkronisasi manual.

### Selesai bila
- Saat pengguna membuka KLIR Promo untuk membuat materi promosi, sistem membaca langsung data katalog produk dari CorPlan (nama, deskripsi, harga, foto, dan status ketersediaan).
- Perubahan pada katalog produk di CorPlan (misalnya harga atau stok) langsung terlihat di KLIR Promo pada akses berikutnya tanpa perlu menyalin atau mengimpor data.
- Tidak ada salinan data katalog produk yang disimpan di KLIR Promo; data selalu diambil dari sumber CorPlan secara langsung.

## Sub-fitur: Data Legalitas Terhubung

Tampilkan data izin dari Repository Hukum di daftar legalitas tanpa perlu memasukkan manual.

### Tujuan
Menampilkan data legalitas yang sudah tersimpan di modul Repository Hukum ke dalam daftar periksa CorPlan, sehingga pengguna tidak perlu memasukkan ulang data yang sudah ada.

### Selesai bila
- Jika pengguna memiliki dokumen legalitas (misalnya NIB, PIRT, Halal) yang tersimpan di Repository Hukum, data tersebut otomatis muncul di daftar periksa legalitas CorPlan.
- Pengguna tidak perlu memasukkan manual data legalitas yang sudah tersimpan di Repository Hukum; data ditampilkan sebagai pelengkap panduan umum.
- Perubahan atau pembaruan data legalitas di Repository Hukum akan tercermin di daftar periksa CorPlan saat dibuka, tanpa perlu tindakan tambahan dari pengguna.

## Task

### 1. Buat halaman utama Bagikan Konteks dengan navigasi antar data

### 2. Buat komponen penanda data boleh dibagikan atau pribadi

### 3. Buat tombol Bagikan Konteks untuk simulasi pembuatan snapshot

### 4. Buat daftar snapshot yang telah dibuat dengan tanggal dan status

### 5. Buat panel pratinjau katalog produk untuk KLIR Promo

### 6. Buat daftar legalitas dari Repository Hukum sebagai mock

### 7. Buat model dan migrasi untuk status pembagian data usaha

### 8. Buat API CRUD untuk perubahan status pembagian data

### 9. Buat model dan migrasi snapshot konteks bisnis

### 10. Lengkapi service otomatis pembuatan snapshot saat anggaran terupdate

### 11. Buat endpoint katalog produk untuk dibaca KLIR Promo

### 12. Integrasikan penarikan data legalitas dari Repository Hukum
