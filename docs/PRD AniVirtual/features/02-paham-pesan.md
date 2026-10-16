# Paham Pesan

Menerjemahkan pesan kerja yang tidak jelas menjadi informasi lengkap sebelum diproses.

## Spesifikasi

### Tujuan
Mengubah pesan kerja yang tidak jelas atau informasinya belum lengkap menjadi pemahaman yang utuh dan bisa dikonfirmasi sebelum diteruskan ke proses lain.

### Selesai bila
- Pengguna mengirim pesan kerja yang ambigu atau kurang lengkap, sistem menandainya dan tidak langsung memprosesnya sebagai instruksi final.
- Sistem menyajikan 2–3 kemungkinan tafsiran beserta informasi yang hilang, dan pengguna dapat memilih salah satu.
- Sistem menampilkan ringkasan pemahaman hasil pilihan pengguna dalam bahasa yang mudah dibaca.
- Setelah dikonfirmasi, pemahaman akhir tersimpan dan dapat dipakai sebagai input proses berikutnya, misalnya balasan, rencana kerja, atau ajuan.
- Tidak ada pesan yang diproses dengan makna tunggal yang dipaksakan bila sistem tidak yakin.

## Sub-fitur: Deteksi Pesan Kurang Jelas

Secara otomatis tahu pesan yang informasinya belum lengkap.

### Tujuan
Secara otomatis mengetahui bahwa sebuah pesan kerja informasinya belum lengkap.

### Selesai bila
- Sistem menandai pesan sebagai "kurang jelas" jika ada informasi penting yang hilang, seperti pelaku, barang/jasa, nominal, waktu, atau tempat.
- Penanda ini muncul sebagai status pada pesan di antarmuka percakapan, tanpa menghentikan percakapan.
- Daftar alasan atau informasi yang hilang bisa ditampilkan secara singkat kepada pengguna.

## Sub-fitur: Pilihan Multi-Tafsiran

Menyajikan 2-3 opsi tafsiran untuk pesan yang kurang jelas agar pengguna bisa memilih makna yang tepat.

### Tujuan
Menyediakan 2–3 opsi tafsiran yang berbeda untuk pesan yang kurang jelas, sesuai konteks percakapan dan data usaha.

### Selesai bila
- Untuk satu pesan ambigu, sistem menghasilkan 2–3 opsi tafsiran; tiap opsi mencantumkan makna dan asumsi yang digunakan.
- Opsi yang muncul berbeda secara bermakna, tidak hanya perulangan kosmetik; jika hanya ada satu tafsir yang masuk akal, sistem tetap bisa menampilkan satu opsi dengan konfirmasi.
- Pilihan salah satu opsi menentukan pemahaman akhir yang dibawa ke tahap ringkasan.

## Sub-fitur: Ringkas Pemahaman

Menampilkan ringkasan maksud pesan agar mudah dikonfirmasi.

### Tujuan
Menampilkan ringkasan maksud pesan yang sudah dipilih pengguna agar mudah dikonfirmasi sebelum diproses.

### Selesai bila
- Setelah pengguna memilih tafsiran, muncul ringkasan berisi siapa, melakukan apa, objek/bahan apa, nominal, waktu/tenggat, dan keterangan lain yang relevan.
- Ringkasan memakai bahasa sehari-hari dan bisa dibaca dalam sekali pandang; jika ada data kosong, ditampilkan sebagai "(belum ada)".
- Pengguna bisa menyetujui atau mengubah ringkasan sebelum pemahaman dianggap final.

## Sub-fitur: Tampilkan Opsi Tafsiran

Menyajikan 2-3 kemungkinan maksud pesan agar pengguna memilih tafsiran yang tepat.

### Tujuan
Menampilkan pilihan tafsiran dengan cara yang mudah dipahami dan dipilih pengguna di layar percakapan.

### Selesai bila
- Opsi tafsiran ditampilkan sebagai kartu atau tombol yang bisa diklik, masing-masing dengan label singkat dan contoh makna.
- Setiap opsi dapat dipilih dengan satu ketukan, lalu layar langsung memperlihatkan ringkasan pemahaman dari opsi itu.
- Jika pengguna ragu, ada tombol untuk melihat ulang pesan asli atau meminta sistem menafsirkan ulang, tanpa menghilangkan riwayat pilihan.

## Task

### 1. Buat halaman utama tafsiran pesan

### 2. Buat layout halaman percakapan dengan data tiruan

### 3. Buat komponen opsi tafsiran

### 4. Buat komponen kartu opsi tafsiran yang bisa dipilih

### 5. Rangkai alur klarifikasi dan tampilkan pesan final

### 6. Buat tampilan ringkasan pemahaman dengan tombol setuju

### 7. Tambahkan aksi lihat pesan asli dan minta tafsir ulang

### 8. Buat skema database pesan ambigu dan opsi

### 9. Buat endpoint deteksi ambiguitas dan opsi tafsiran

### 10. Buat skema Prisma untuk pesan, tafsiran, dan konfirmasi

### 11. Implementasi deteksi pesan kurang jelas berbasis aturan

### 12. Buat endpoint simpan pilihan klarifikasi

### 13. Implementasi generator opsi multi-tafsiran

### 14. Implementasi peringkas pemahaman

### 15. Buat API endpoint untuk submit, deteksi, opsi, dan konfirmasi
