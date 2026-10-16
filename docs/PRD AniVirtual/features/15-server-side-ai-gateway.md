# Server-side AI Gateway

Mengelola semua permintaan AI melalui server, menyimpan kunci API dengan aman, dan mencatat pemakaian serta kuota.

## Spesifikasi

### Tujuan
Memusatkan semua permintaan kecerdasan buatan melalui server agar kunci API aman dan tidak pernah ada di sisi pengguna, sekaligus mencatat pemakaian serta membatasi kuota.

### Selesai bila
- Seluruh permintaan dari layar ke kecerdasan buatan lewat satu pintu di server; kunci API hanya ada di sisi server dan tidak pernah tampil atau dikirim ke peramban.
- Setiap permintaan yang masuk menjalani pengecekan berurutan: pengguna sudah masuk, ruang kerja aktif, langganan valid, hak akses modul ada, peran diizinkan, dan kredit cukup.
- Setiap pemakaian kecerdasan buatan tercatat otomatis (jumlah token, perkiraan biaya, pengguna, ruang kerja, waktu), dan catatan itu bisa dilihat riwayatnya oleh pemilik.
- Setiap permohonan kecerdasan buatan diperiksa dulu sisa kuota; jika tidak cukup, permintaan ditolak di depan dengan pesan yang jelas, sebelum diproses lebih lanjut.

## Task

### 1. Buat halaman utama AI Gateway dengan data tiruan

### 2. Buat tampilan log pemakaian AI dengan data tiruan

### 3. Buat ringkasan pemakaian per pengguna dan ruang kerja dengan data tiruan

### 4. Buat tampilan status dan sisa kuota AI dengan data tiruan

### 5. Buat halaman uji kirim pesan AI dengan mock lokal

### 6. Buat skema Prisma dan migrasi untuk log pemakaian dan kuota

### 7. Buat service AI gateway aman untuk memanggil penyedia AI

### 8. Buat service pencatatan log pemakaian AI

### 9. Buat service pengecekan dan pengurangan kuota atau kredit

### 10. Buat endpoint API kirim pesan AI melalui server

### 11. Buat endpoint API log dan ringkasan pemakaian untuk pemilik usaha

### 12. Tambahkan pesan error jelas saat kuota tidak mencukupi
