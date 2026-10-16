# Analisis Pesan

Menempel pesan kerja lalu melihat uraian permintaan inti, tenggat, nada, dan tingkat keyakinannya.

## Spesifikasi

### Tujuan
Membantu pengguna memahami pesan kerja yang ambigu dengan menempel teks pesan, lalu melihat uraian permintaan inti, tenggat waktu (jika ada), nada/urgensi, dan tingkat keyakinan analisis.
### Selesai bila
- Pengguna dapat menempel pesan dan (opsional) memilih pengirim, lalu sistem menampilkan hasil analisis dalam waktu kurang dari 10 detik.
- Hasil analisis menampilkan tiga bagian: permintaan inti, tenggat waktu, dan nada/urgensi pesan.
- Jika tidak ada tenggat di teks asli, sistem menampilkan 'Tidak disebutkan' tanpa mengarang.
- Sistem menampilkan tingkat keyakinan 'Tinggi' atau 'Rendah' dan, jika rendah, mengajukan pertanyaan klarifikasi.

## Sub-fitur: Pilih Pengirim

Memilih kontak pengirim dari buku alamat agar analisis lebih sesuai.

### Tujuan
Memungkinkan pengguna memilih kontak pengirim dari buku alamat agar analisis pesan semakin sesuai dengan gaya komunikasi orang tersebut.
### Selesai bila
- Saat menganalisis pesan, pengguna bisa memilih kontak dari daftar buku alamat atau memilih 'Tanpa pengirim'.
- Nama kontak yang dipilih tampil sebagai konteks dan memengaruhi hasil analisis.
- Jika tidak ada kontak dipilih, analisis tetap berjalan tetapi tingkat keyakinan diturunkan.

## Sub-fitur: Hasil Analisis

Melihat rincian permintaan inti, tenggat waktu jika ada, dan nada/urgensi pesan.

### Tujuan
Menampilkan uraian isi pesan yang sudah diurai: permintaan inti, tenggat waktu, dan nada/urgensi, dalam bahasa yang mudah dipahami.
### Selesai bila
- Setelah analisis, muncul tiga bagian jelas berjudul 'Permintaan inti', 'Tenggat waktu', dan 'Nada/urgensi'.
- Tenggat waktu hanya diisi jika ada tanggal/waktu yang benar-benar disebutkan di teks; jika tidak, tertulis 'Tidak disebutkan'.
- Uraian menggunakan kalimat singkat dan Bahasa Indonesia sehari-hari yang mudah dimengerti.

## Sub-fitur: Indikator Keyakinan

Menunjukkan seberapa yakin sistem menilai pesan, tinggi atau rendah.

### Tujuan
Menunjukkan seberapa yakin sistem menilai pesan agar pengguna tahu kapan hasil analisis perlu diklarifikasi.
### Selesai bila
- Di bagian hasil analisis tampil label 'Tinggi' atau 'Rendah'.
- Keyakinan 'Tinggi' muncul saat pesan jelas dan pengirim dipilih; 'Rendah' muncul saat teks ambigu atau tanpa kontak pengirim.
- Saat keyakinan rendah, tersedia penjelasan singkat seperti 'Teks ambigu' atau 'Pengirim tidak dipilih'.

## Sub-fitur: Pertanyaan Klarifikasi

Jika keyakinan rendah, sistem mengajukan pertanyaan untuk memperjelas pesan.

### Tujuan
Membantu pengguna memperbaiki analisis dengan mengajukan pertanyaan spesifik saat keyakinan sistem rendah.
### Selesai bila
- Saat keyakinan rendah, sistem menampilkan 1–2 pertanyaan untuk memperjelas hal yang belum diketahui, misalnya tenggat atau maksud pesan.
- Pengguna dapat menjawab pertanyaan langsung di layar, lalu sistem menganalisis ulang dengan jawaban tersebut.
- Jika keyakinan tinggi, bagian pertanyaan klarifikasi tidak muncul.

## Sub-fitur: Input Konteks

Mengirim teks pesan yang akan dianalisis dan memilih pengirim secara opsional.

### Tujuan
Memungkinkan pengguna menempel atau mengetik teks pesan kerja yang ambigu dan secara opsional memilih kontak pengirim dari Buku Alamat, sebagai langkah awal sebelum analisis.

### Selesai bila
- Pengguna dapat menempel/mengetik teks pesan pada area input yang tersedia dan teks tersebut terlihat jelas di layar.
- Pengguna dapat memilih kontak pengirim dari daftar kontak yang tersedia, atau membiarkan pilihan kosong (opsional).
- Ada tombol/aksi bertuliskan "Analisis" atau sejenisnya yang hanya aktif jika teks sudah terisi.
- Setelah tombol diklik, teks dan kontak terpilih (jika ada) dikirim ke proses analisis dan pengguna melihat indikator proses.

## Task

### 1. Buat halaman utama analisis pesan tiruan

### 2. Buat pemilih pengirim dari kontak tiruan

### 3. Buat tampilan hasil analisis tiga bagian

### 4. Buat indikator keyakinan dan klarifikasi tiruan

### 5. Buat endpoint daftar kontak pengirim

### 6. Buat service ekstraksi permintaan tenggat dan nada

### 7. Buat logika keyakinan dan pertanyaan klarifikasi

### 8. Buat API route analisis dan analisis ulang
