# Balasan Cerdas

Menyediakan draf balasan dan pilihan gaya bahasa agar membalas pesan lebih cepat.

## Spesifikasi

### Tujuan
Membantu pengguna UMKM membalas pesan kerja dengan cepat dan sesuai konteks — baik konteks percakapan, peran pengguna, maupun kebiasaan bisnis — sehingga tidak perlu menulis dari nol.

### Selesai bila
- Dari satu pesan masuk yang ambigu, pengguna dapat memilih beberapa opsi draf balasan yang masuk akal secara kontekstual dan dapat langsung dipakai.
- Opsi draf yang ditampilkan mempertimbangkan konteks percakapan (misal: nada formal/ santai, urusan pengadaan, keluhan pelanggan) dan riwayat singkat dengan lawan bicara.
- Pengguna dapat memilih salah satu draf, mengeditnya bila perlu, lalu mengirim atau menyalinnya tanpa keluar dari alur chat.

### subSpecs

### Sub-fitur 1: Menyajikan opsi draf balasan
#### Tujuan
Memberi pengguna 2–3 pilihan draf balasan yang siap pakai dari satu pesan masuk, sehingga tidak perlu menulis dari nol.

#### Selesai bila
- Setiap pesan masuk yang dipilih pengguna menghasilkan 2–3 opsi draf dengan urutan dan label yang jelas (mis. “Singkat”, “Formal”, “Santai”).
- Opsi draf ditampilkan dalam satu panel yang bisa digulir, dan pengguna dapat melihatnya tanpa membuka halaman lain.
- Setiap opsi dapat disalin atau dipilih dalam satu kali klik/tap.

### Sub-fitur 2: Penyesuaian gaya dan nada
#### Tujuan
Membiarkan pengguna mengubah gaya balasan (misal formal, santai, tegas, ramah) agar sesuai dengan hubungan dan situasi kerja.

#### Selesai bila
- Pengguna dapat memilih gaya/nada dari pilihan yang tersedia sebelum draf dibuat, dan pilihan tersebut mengubah isi draf yang dihasilkan.
- Draf yang dihasilkan mencerminkan nada yang dipilih secara konsisten (tidak tercampur gaya tidak relevan).
- Pilihan gaya terakhir pengguna diingat untuk sesi berikutnya dalam percakapan yang sama.

### Sub-fitur 3: Dukungan konteks percakapan
#### Tujuan
Memastikan draf balasan memahami isi percakapan sebelumnya, bukan hanya pesan terakhir.

#### Selesai bila
- Draf yang dihasilkan mempertimbangkan 3–5 pesan sebelumnya dalam percakapan (misal: topik, nama lawan bicara, dan status pembicaraan).
- Jika konteks tidak cukup (misal pesan pertama), sistem memberi draf netral yang tetap relevan dengan topik umum pesan.
- Pengguna dapat melihat ringkasan singkat alasan pemilihan draf (misal label: “Konteks: penawaran harga”) di samping opsi draf.

### Sub-fitur 4: Kendali format dan panjang balasan
#### Tujuan
Memberi pengguna kendali atas panjang dan format draf, agar sesuai dengan saluran (WhatsApp, email, catatan kerja).

#### Selesai bila
- Pengguna dapat memilih panjang draf (misal: singkat, sedang, panjang) dan format (misal: teks biasa, daftar poin, paragraf) sebelum draf dibuat.
- Pilihan ini mengubah hasil draf secara terlihat — misalnya draf “ingkat” berupa 1–2 kalimat, “daftar” memakai bullet points.
- Draf yang dihasilkan tetap menjaga kelengkapan informasi penting (nama, angka, dan tindak lanjut) tanpa menghilangkan isi inti.

## Sub-fitur: Saran Draf Balasan

Memberikan beberapa pilihan kalimat yang bisa langsung dipakai.

## Sub-fitur: Alternatif Skenario

Menyajikan draf balasan berbeda sesuai konteks yang mungkin terjadi.

## Sub-fitur: Instruksi Gaya Fleksibel

Menambahkan instruksi singkat untuk mengubah gaya bahasa balasan secara langsung pada sesi percakapan.

## Sub-fitur: Preset Nada Lanjutan

Menyediakan preset nada untuk situasi khusus seperti krisis, komplain, negosiasi, asertif, dan santai.

### Tujuan
Menyediakan preset nada untuk situasi khusus (krisis, komplain, negosiasi, asertif, santai) sehingga pengguna dapat menghasilkan draf balasan yang sesuai konteks dengan cepat, tanpa harus merangkai instruksi rumit.

### Selesai bila
- Pengguna dapat memilih setidaknya 5 preset nada yang tersedia saat membuat draf balasan.
- Untuk setiap preset, sistem menghasilkan draf balasan yang sesuai dengan situasi yang diwakili (misalnya preset komplain menghasilkan draf yang menenangkan).
- Draf yang dihasilkan ditampilkan dengan label yang jelas menunjukkan preset yang digunakan.

### Catatan
Fitur ini terkait dengan sub-fitur 'Variasi Gaya' pada fitur Balasan Cerdas Multi-Skenario, tetapi berfokus pada preset untuk situasi khusus.

## Sub-fitur: Instruksi Gaya Singkat

Menerima instruksi singkat untuk mengubah gaya balasan secara instan tanpa mengubah pengaturan permanen.

### Tujuan
Memberikan pengguna kemampuan untuk mengubah gaya balasan secara instan melalui instruksi singkat, tanpa mengubah pengaturan permanen.

### Selesai bila
- Di antarmuka pembuatan balasan, tersedia kolom input untuk instruksi gaya singkat.
- Saat pengguna mengetik instruksi (misalnya "lebih sopan" atau "lebih santai") dan mengirimkannya, sistem menampilkan draf balasan baru yang sesuai dengan instruksi tersebut.
- Penggunaan instruksi singkat tidak mengubah preferensi gaya permanen yang mungkin sudah disimpan pengguna.
- Draf balasan yang dihasilkan dapat diedit dan digunakan seperti draf biasa.

## Task

### 1. Buat halaman pembuatan draf dengan pemilih preset nada

### 2. Buat halaman panel balasan cerdas dengan layout

### 3. Bangun halaman antarmuka pembuatan balasan

### 4. Tampilkan draf sesuai preset dengan data tiruan

### 5. Tambahkan kolom instruksi gaya singkat

### 6. Tampilkan opsi draf balasan dengan label gaya

### 7. Ganti daftar preset tiruan dengan API

### 8. Tambahkan kontrol preset nada dan panjang/format

### 9. Simulasikan pembuatan draf dari instruksi

### 10. Kirim permintaan generate draf ke API

### 11. Buat editor draf yang dapat diedit

### 12. Implementasikan kolom instruksi gaya singkat

### 13. Buat endpoint pembuatan draf

### 14. Tampilkan alasan konteks di samping opsi draf

### 15. Buat tabel preset dan migrasi Prisma

### 16. Buat endpoint GET daftar preset

### 17. Implementasi layanan instruksi gaya singkat

### 18. Buat skema Prisma untuk percakapan dan preferensi

### 19. Buat endpoint POST generate draf berdasarkan preset

### 20. Implementasikan service AI pembuat draf balasan

### 21. Buat endpoint POST untuk generate draf

### 22. Buat endpoint GET untuk daftar preset nada

### 23. Simpan preferensi gaya pengguna per percakapan
