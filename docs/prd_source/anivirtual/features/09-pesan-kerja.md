# Pesan Kerja

Halaman utama untuk menerima, memahami, dan membalas pesan kerja dengan bantuan AI.

## Spesifikasi

### Tujuan
Halaman utama Pesan Kerja menjadi tempat menerima, memahami, dan membalas pesan kerja rekan satu ruang kerja dengan bantuan AI agar komunikasi internal lebih cepat dan tidak salah paham.

### Selesai bila
- Pengguna dapat melihat daftar semua percakapan kerja yang masuk beserta pengirim, waktu, dan statusnya dari satu halaman.
- Pengguna dapat membuka satu percakapan, membaca riwayat pesan, dan mengirim pesan baru ke rekan satu ruang kerja.
- Untuk pesan yang kurang jelas, pengguna dapat meminta AI menjelaskan maksudnya dan memilih tafsiran yang paling sesuai.
- Pengguna dapat meminta AI menyusun balasan, memilih salah satu draf, lalu mengirim atau menyuntingnya sebelum dikirim.
- Pengguna dapat mengubah gaya bahasa draf balasan dengan catatan singkat tanpa mengubah pesan asli.

## Sub-fitur: Kotak Masuk

Daftar semua percakapan kerja yang masuk, lengkap dengan pengirim dan statusnya.

### Tujuan
Menampilkan semua percakapan kerja yang masuk dalam satu daftar agar pengguna tahu pesan mana yang perlu dibalas dan statusnya.

### Selesai bila
- Daftar percakapan menampilkan nama pengirim, cuplikan pesan terakhir, waktu, dan status (mis. Belum dibaca atau Dibalas).
- Percakapan yang belum dibaca memiliki penanda visual yang jelas dan jumlahnya terlihat di halaman.
- Pengguna dapat mengklik satu percakapan untuk membuka isi pesan; daftar tetap sinkron setelah ada pesan masuk atau terbalas.

## Sub-fitur: Kirim Pesan

Tulis dan kirim pesan kerja baru ke rekan satu ruang kerja.

### Tujuan
Memungkinkan pengguna menulis dan mengirim pesan kerja baru ke rekan satu ruang kerja dengan mudah.

### Selesai bila
- Ada kolom tulis pesan dan tombol kirim yang jelas di halaman percakapan; pesan muncul di riwayat setelah terkirim.
- Pengirim dapat memilih penerima dari daftar rekan satu ruang kerja, lalu memulai percakapan baru bila belum ada.
- Pesan yang gagal terkirim menampilkan peringatan dan tidak hilang dari kolom tulis.

## Sub-fitur: Pahami Maksud

AI merapikan pesan yang kurang jelas menjadi ringkasan maksud yang mudah dipahami.

### Tujuan
Membantu pengguna memahami pesan kerja yang kurang jelas dengan meringkas maksudnya dan menyajikan beberapa tafsiran pilihan, bukan satu jawaban memaksa.

### Selesai bila
- Pada pesan yang dipilih, pengguna dapat memicu Pahami Maksud dan melihat ringkasan maksud dalam bahasa sehari-hari yang mudah dipahami.
- Bila pesan ambigu, muncul minimal dua pilihan tafsiran; pengguna dapat memilih salah satu untuk dipakai sebagai acuan balasan.
- Hasil pemahaman ditampilkan terpisah dari pesan asli sehingga pengguna tetap bisa membaca teks aslinya.

## Sub-fitur: Balasan Otomatis

AI menyusun beberapa pilihan balasan sesuai konteks pesan dan peran pengguna.

### Tujuan
Menyusun beberapa pilihan draf balasan yang sesuai konteks pesan dan peran pengguna agar membalas pesan kerja lebih cepat.

### Selesai bila
- Pengguna dapat meminta Balasan Otomatis pada satu pesan dan melihat minimal dua draf balasan yang berbeda.
- Setiap draf bisa disalin, disunting, atau langsung dipilih untuk dikirim; setelah dipilih, draf terisi di kolom balasan.
- Draf yang dihasilkan mempertimbangkan konteks pesan dan peran pengguna (mis. pemilik, penyetuju, atau anggota).

## Sub-fitur: Gaya Bicara

Menyesuaikan bahasa balasan dengan catatan singkat gaya pemilik usaha.

### Tujuan
Memberi pengguna cara cepat mengubah gaya bahasa draf balasan AI dengan catatan singkat agar sesuai dengan gaya bicara pemilik usaha.

### Selesai bila
- Ada kolom catatan singkat (mis. santai, formal, atau singkat) yang bisa diisi sebelum meminta balasan.
- Saat catatan diisi, draf balasan yang dihasilkan mengikuti gaya yang diminta tanpa mengubah maksud isi pesan.
- Pengguna dapat mengganti catatan dan meminta ulang balasan untuk melihat versi gaya lain tanpa memulai percakapan baru.

## Task

### 1. Bangun halaman utama daftar percakapan

### 2. Buat halaman detail percakapan dan kirim pesan

### 3. Buat panel Pahami Maksud di percakapan

### 4. Buat panel Balasan Otomatis dengan opsi gaya

### 5. Buat skema database percakapan dan pesan

### 6. Buat endpoint daftar percakapan

### 7. Buat endpoint kirim pesan

### 8. Buat endpoint Pahami Maksud

### 9. Buat endpoint Balasan Otomatis dan gaya

### 10. Integrasikan pemotongan kredit dan log AI
