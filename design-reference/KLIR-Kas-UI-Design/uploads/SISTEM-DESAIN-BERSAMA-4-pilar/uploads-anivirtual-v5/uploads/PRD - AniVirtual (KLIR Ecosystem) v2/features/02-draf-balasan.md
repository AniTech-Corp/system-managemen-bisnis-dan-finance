# Draf Balasan

Membuat minimal dua draf balasan dengan gaya berbeda yang bisa disalin atau diedit.

## Spesifikasi

### Tujuan
Membuat minimal dua draf balasan dengan gaya berbeda yang bisa disalin atau diedit.

### Selesai bila
- Pengguna dapat memicu pembuatan draf dari hasil analisis pesan atau dari input manual, dan sistem menampilkan minimal dua draf balasan dengan susunan kalimat berbeda dalam satu layar.
- Setiap draf diberi label gaya yang jelas (misalnya "Formal", "Santai") dan dapat dibedakan secara nyata, bukan sekadar ganti sinonim.
- Draf dapat disalin ke clipboard dengan satu klik, dan dapat diedit langsung di area teks sebelum disalin.
- Pengguna dapat meminta variasi draf baru tanpa mengulang input pesan.

## Sub-fitur: Pilih Gaya Bahasa

Memilih gaya formal, santai, permohonan maaf, atau diplomatis untuk draf.

### Tujuan
Memilih gaya formal, santai, permohonan maaf, atau diplomatis untuk draf.

### Selesai bila
- Pengguna dapat memilih salah satu dari empat gaya (formal, santai, permohonan maaf, diplomatis) melalui kontrol yang jelas (misal tombol/pilihan) sebelum atau saat meminta draf.
- Gaya yang dipilih terlihat jelas (misal ada tanda terpilih) dan menjadi acuan saat draf dibuat, termasuk jika gaya tidak dipilih maka sistem menggunakan gaya netral/standar.

## Sub-fitur: Hasilkan Draf

Membuat beberapa draf balasan dengan gaya yang benar-benar berbeda.

### Tujuan
Membuat beberapa draf balasan dengan gaya yang benar-benar berbeda.

### Selesai bila
- Saat tombol "Buat Draf" diklik, sistem menampilkan minimal dua draf dalam waktu kurang dari 8 detik dengan gaya yang berbeda nyata (struktur kalimat dan pilihan kata tidak sekadar sinonim).
- Draf yang muncul menggunakan konteks pesan asli dan, jika kontak dipilih, nama/jabatan serta gaya komunikasi kontak tersebut.

## Sub-fitur: Salin & Edit

Menyalin draf ke clipboard atau mengubahnya sebelum dipakai.

### Tujuan
Menyalin draf ke clipboard atau mengubahnya sebelum dipakai.

### Selesai bila
- Setiap draf memiliki tombol salin yang menyalin seluruh teks draf ke clipboard dan menampilkan umpan balik (misal "Tersalin").
- Pengguna dapat mengedit teks draf langsung di area teks (textarea) dan tombol salin menyalin hasil edit tersebut.

## Sub-fitur: Minta Draf Baru

Meminta ulang draf balasan dengan variasi lain.

### Tujuan
Meminta ulang draf balasan dengan variasi lain.

### Selesai bila
- Tersedia tombol "Minta Draf Baru" atau sejenisnya yang menghasilkan set draf baru dengan variasi berbeda dari sebelumnya tanpa menghapus pesan input.
- Setelah diminta, sistem mengganti draf yang lama dengan draf baru dan tetap mempertahankan pilihan gaya yang sedang aktif.

## Sub-fitur: Penyimpanan Draf

Menyimpan draf balasan di sesi agar tetap ada saat berpindah menu.

### Tujuan
Menyimpan draf balasan yang dihasilkan dalam sesi pengguna agar tetap tersedia saat pengguna berpindah menu di AniVirtual, tanpa harus membuat ulang.

### Selesai bila
- Setelah draf balasan berhasil dibuat, draf tersimpan dalam sesi aktif dan tetap tampil saat pengguna kembali ke menu tersebut.
- Pengguna dapat berpindah ke menu AniVirtual lain lalu kembali tanpa kehilangan draf yang belum disalin.
- Draf yang tersimpan dapat disalin, diedit, atau dipakai untuk meminta draf baru tanpa mengganggu alur kerja.

## Task

### 1. Buat halaman draf balasan dengan data tiruan

### 2. Buat pemilih gaya bahasa yang mengubah draf

### 3. Tampilkan draf berlabel gaya dalam area edit

### 4. Buat tombol salin draf dengan umpan balik

### 5. Buat tombol minta draf baru

### 6. Buat service generator draf dengan gaya berbeda

### 7. Buat endpoint POST untuk menghasilkan draf

### 8. Buat DTO dan validasi request pembuatan draf

### 9. Buat service ambil konteks kontak dari database

### 10. Buat variasi draf baru pada setiap permintaan

### 11. Tulis unit test endpoint generate draf
