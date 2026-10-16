# Rencana Kerja

Membuat dan mengatur rencana kerja agar semua orang tahu tugas masing-masing.

## Spesifikasi

### Tujuan
Membuat serta mengelola rencana kerja secara terstruktur agar setiap anggota tim memahami tugas, tenggat, dan penanggung jawabnya.

### Selesai bila
- Pengguna dapat membuat rencana kerja berisi judul, periode waktu, dan penanggung jawab, lalu semua rencana tersimpan dan ditampilkan dalam satu tampilan agenda.
- Setiap rencana memiliki status yang dapat diperbarui sesuai perkembangannya (misalnya: belum mulai, berjalan, selesai), dan perubahannya terlihat oleh pengguna yang berhak.
- Fitur saran rencana dari chat tersedia, tetapi tetap mengedepankan konfirmasi manual sebelum tercatat sebagai rencana sungguhan.

## Sub-fitur: Buat Rencana

Tambah rencana kerja baru dengan judul, waktu, dan penanggung jawab.

### Tujuan
Memungkinkan pengguna menambahkan rencana kerja baru dengan informasi judul, waktu, dan penanggung jawab melalui formulir sederhana.

### Selesai bila
- Tersedia formulir untuk mengisi judul, rentang waktu, dan memilih penanggung jawab dari anggota tim yang tersedia.
- Setelah disimpan, rencana langsung muncul di daftar/di agenda dengan status awal yang jelas serta menampilkan nama penanggung jawabnya.

## Sub-fitur: Daftar Rencana

Lihat semua rencana dan statusnya dalam satu tampilan agenda.

### Tujuan
Membantu setiap orang melihat seluruh rencana kerja dan statusnya dalam satu tampilan agenda yang runtut.

### Selesai bila
- Semua rencana kerja yang sudah dibuat tampil dalam urutan waktu dan diberi penanda status yang mudah dipahami.
- Setiap rencana dapat diklik untuk melihat detail serta memperbarui status, dan perubahan tersebut langsung diperbarui di agenda.

## Sub-fitur: Tugas dari Chat

AI mendeteksi tugas dari percakapan lalu menawarkannya sebagai saran rencana yang perlu dikonfirmasi.

### Tujuan
Mengubah potensi tugas dari percakapan menjadi saran rencana kerja yang menunggu persetujuan pengguna.

### Selesai bila
- AI menampilkan notifikasi berisi usulan rencana kerja ketika menemukan potensi tugas dari chat, misalnya dengan menampilkan saran yang mencolok dan jelas beserta aksinya.
- Pengguna dapat menyetujui, mengubah, atau menolak setiap saran; saran yang disetujui akan tersimpan sebagai rencana kerja baru dan siap ditinjau di agenda.

## Task

### 1. Buat agenda rencana kerja dengan data tiruan

### 2. Buat formulir tambah rencana kerja

### 3. Buat detail dan ubah status rencana

### 4. Buat notifikasi saran rencana dari chat

### 5. Buat skema rencana kerja dan migrasi Prisma

### 6. Buat API CRUD rencana kerja

### 7. Buat skema saran rencana dan migrasi

### 8. Buat deteksi tugas dari chat via AI

### 9. Buat API konfirmasi, ubah, tolak saran rencana
