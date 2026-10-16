# Konsultan AI

Tanya jawab dengan asisten AI yang memakai data usaha untuk memberi saran dan menjawab istilah.

## Spesifikasi

### Tujuan
Memberikan asisten AI yang dapat diajak tanya-jawab seputar usaha, dengan jawaban yang memanfaatkan data CorPlan yang diizinkan pengguna, sehingga pengguna mendapat saran yang relevan dan mudah dipahami seperti layaknya konsultan bisnis pribadi.

### Selesai bila
- Pengguna dapat mengajukan pertanyaan bebas dan menerima jawaban yang merujuk pada data usahanya (misalnya profil, keuangan, analisis pasar).
- Pengguna dapat memilih data mana yang boleh dibagikan sebagai konteks AI, dan jawaban yang dihasilkan akan menyesuaikan pilihan tersebut.
- Pengguna dapat melihat riwayat konsultasi sebelumnya dan sisa kredit AI setiap kali menggunakan fitur.

## Sub-fitur: Tanya Jawab

Tanyakan apa pun tentang bisnis, dari arti istilah sampai keputusan besar.

### Tujuan
Memungkinkan pengguna bertanya apa pun tentang bisnisnya—dari arti istilah hingga keputusan besar—dan menerima jawaban yang jelas serta relevan.

### Selesai bila
- Pengguna dapat menulis pertanyaan dan mengirimkannya, lalu melihat jawaban yang muncul dalam alur percakapan.
- Jawaban yang diberikan mencakup penjelasan istilah sederhana (misalnya BEP, CapEx, OpEx) jika diminta.
- Pertanyaan yang berhubungan dengan data usaha (misalnya harga jual, biaya, kompetitor) mendapat jawaban yang memakai data tersebut.

## Sub-fitur: Konteks Usaha

AI membaca data CorPlan yang kamu izinkan supaya jawabannya relevan dengan usaha.

### Tujuan
Memastikan AI membaca data CorPlan yang diizinkan pengguna agar jawabannya personal dan kontekstual, sesuai dengan pilihan privasi pengguna.

### Selesai bila
- Pengguna dapat memilih kategori data yang boleh dijadikan konteks AI (misalnya profil usaha, hasil kalkulator, analisis kompetitor, dan lainnya).
- AI menggunakan data yang diizinkan tersebut saat menjawab pertanyaan, dan pengguna dapat melihat indikator data apa saja yang sedang digunakan.
- Data yang tidak diizinkan tidak pernah muncul atau dipakai dalam jawaban AI.

## Sub-fitur: Riwayat & Kredit

Cek kembali konsultasi terdahulu dan sisa kredit kecerdasan buatan.

### Tujuan
Memberi pengguna akses untuk melihat kembali konsultasi yang sudah dilakukan dan memantau sisa kredit AI agar penggunaan tetap terkendali.

### Selesai bila
- Pengguna dapat membuka daftar percakapan sebelumnya, lengkap dengan tanggal dan ringkasan topik.
- Pengguna dapat membuka salah satu percakapan lama dan membaca kembali seluruh pertanyaan dan jawaban.
- Saat menggunakan fitur AI, pengguna selalu dapat melihat sisa kredit yang tersisa dan riwayat pemakaian kredit.

## Task

### 1. Buat halaman utama chat dengan data tiruan

### 2. Buat panel pilih konteks data diizinkan

### 3. Buat alur tanya jawab dengan data tiruan

### 4. Buat panel riwayat dan sisa kredit

### 5. Buat halaman detail percakapan lampau

### 6. Buat indikator konteks yang dipakai jawaban

### 7. Buat skema konsultasi dan migrasi

### 8. Terapkan guard fondasi akses modul

### 9. Buat service ambil konteks data diizinkan

### 10. Buat service potong dan catat kredit

### 11. Buat endpoint jawab AI dengan konteks diizinkan

### 12. Buat endpoint simpan dan daftar percakapan

### 13. Buat endpoint detail riwayat percakapan

### 14. Buat endpoint simpan preferensi konteks data

### 15. Buat endpoint sisa dan pemakaian kredit
