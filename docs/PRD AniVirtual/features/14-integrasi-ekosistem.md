# Integrasi Ekosistem

Menghubungkan AniVirtual dengan modul KLIR lain agar data mengalir otomatis.

## Spesifikasi

### Tujuan
Menghubungkan AniVirtual dengan modul KLIR lain (CorPlan, KLIR Kas, KLIR Kerja) agar data usaha mengalir otomatis dan aman tanpa kunci API di sisi klien.

### Selesai bila
- Pengguna dapat melihat ringkasan usaha dan anggaran terbaru dari CorPlan yang tersimpan sebagai salinan bertanggal di AniVirtual.
- Ajuan kebutuhan yang disetujui otomatis tercatat di KLIR Kas melalui antrean dengan kunci unik sehingga tidak ada duplikasi.
- Status koneksi ke setiap modul (CorPlan, KLIR Kas, KLIR Kerja) terlihat jelas: apakah aktif, bermasalah, atau terputus.
- Semua pertukaran data dilakukan dari server AniVirtual; tidak ada kunci API yang terekspos di sisi klien.

## Sub-fitur: Ringkasan Usaha

Terima ringkasan usaha dan anggaran dari CorPlan sebagai salinan tetap bertanggal.

### Tujuan
Menyediakan salinan ringkasan usaha dan anggaran dari CorPlan yang tersimpan bertanggal di AniVirtual, sehingga pengguna selalu punya referensi data terkini.

### Selesai bila
- Ringkasan usaha dan anggaran berhasil ditarik dari CorPlan dan tersimpan sebagai catatan baru dengan tanggal pengambilan.
- Data yang tersimpan dapat dilihat di halaman ringkasan dengan jelas label tanggalnya.
- Jika CorPlan gagal diakses, sistem menampilkan pemberitahuan bahwa data gagal diperbarui dan menggunakan data terakhir yang tersimpan.

## Sub-fitur: Catat ke KLIR Kas

Kirim ajuan yang disetujui ke KLIR Kas lewat antrean agar tidak tercatat dua kali.

### Tujuan
Mengirim ajuan kebutuhan yang telah disetujui ke KLIR Kas secara otomatis melalui antrean dengan kunci unik agar tidak terjadi pencatatan ganda.

### Selesai bila
- Setiap ajuan yang berstatus disetujui segera masuk ke antrean pengiriman dengan idempotency key unik.
- Pengiriman ke KLIR Kas berhasil tanpa duplikasi; jika gagal, antrean melakukan percobaan ulang otomatis.
- Pengguna dapat melihat status pengiriman (terkirim / gagal) dari halaman detail ajuan.

## Sub-fitur: Status Koneksi

Lihat status hubungan dengan modul lain apakah aktif atau sedang bermasalah.

### Tujuan
Memberikan informasi yang jelas tentang status koneksi AniVirtual dengan modul eksternal (CorPlan, KLIR Kas, KLIR Kerja) agar pengguna tahu apakah integrasi berfungsi normal.

### Selesai bila
- Halaman status koneksi menampilkan setiap modul dengan label (mis. 'Terhubung', 'Bermasalah') dan ikon yang mudah dipahami.
- Status diperbarui secara berkala dan menampilkan waktu pembaruan terakhir.
- Jika koneksi gagal, muncul pesan kesalahan yang menjelaskan langkah perbaikan yang disarankan.

## Task

### 1. Buat halaman utama ringkasan usaha dan anggaran

### 2. Buat halaman status koneksi antar modul

### 3. Tampilkan status pengiriman di halaman detail ajuan

### 4. Buat skema dan migrasi database integrasi ekosistem

### 5. Buat API untuk membaca ringkasan dan riwayatnya

### 6. Buat layanan sinkronisasi ringkasan dari CorPlan

### 7. Buat antrean pengiriman ajuan ke KLIR Kas

### 8. Buat API status koneksi dan pengiriman ajuan

### 9. Buat penjadwalan pembaruan status koneksi modul

### 10. Simpan kredensial integrasi di sisi server
