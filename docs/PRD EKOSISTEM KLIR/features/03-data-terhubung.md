# Data Terhubung

Semua modul memakai satu sumber data yang sama, dengan salinan tetap untuk data penting dan data langsung yang selalu terbaru.

## Spesifikasi

### Tujuan
Memastikan semua modul KLIR menggunakan sumber data yang sama agar pengguna tidak perlu memasukkan data berulang, dengan aturan yang jelas untuk data yang dibaca langsung secara real-time maupun yang disalin sebagai arsip tetap.

### Selesai bila
- Satu data yang sama (misal: data usaha, data pelanggan, data dokumen) hanya perlu dimasukkan satu kali dan langsung dipakai oleh semua modul yang membutuhkan, tanpa penyalinan manual.
- Modul dapat membedakan dua jenis data: data yang selalu diambil dari sumber aslinya agar selalu terbaru, dan data yang disalin sebagai arsip final yang tidak bisa diubah lagi.
- Aktivitas modul yang membaca, mengarsipkan, atau berbagi data tercatat di Log Aktivitas sehingga bisa ditelusuri asal dan tujuannya.
- Modul yang dikembangkan oleh tim berbeda bisa saling bertukar data lewat aturan bersama, tanpa bergantung pada aplikasi luar atau langkah ekspor-impor file manual.
- Visibilitas data dibatasi oleh Ruang Kerja dan Hak Akses yang sudah ada; aturan ini tidak bisa dilewati lewat Jembatan Modul, Salinan Tetap, maupun Baca Langsung.

## Sub-fitur: Satu Sumber

Modul yang berbeda memakai sumber data yang sama, jadi tidak perlu memasukkan data berulang.

### Tujuan
Memastikan satu data yang sama tidak perlu dimasukkan atau disimpan ulang oleh modul lain, karena semua modul mengacu pada sumber data yang sama.

### Selesai bila
- Setiap fakta penting (saat ini: data Ruang Kerja, keanggotaan, dan langganan) disimpan di satu sumber; modul yang menampilkan atau mengubah data tersebut membaca dari sumber yang sama, bukan dari isian ulang pengguna.
- Saat data utama berubah (misal nama atau jenis usaha), modul mana pun yang menampilkan data tersebut akan menunjukkan nilai terbaru tanpa konfirmasi tambahan dari pengguna.
- Pengguna tidak akan diminta memasukkan data yang sama lebih dari satu kali saat berpindah-pindah modul; modul cukup mengambil data dari data yang sudah ada tersebut.

## Sub-fitur: Salinan Tetap

Data yang sudah jadi disalin sekali dan tidak lagi berubah, misalnya untuk laporan dan dokumen selesai.

## Sub-fitur: Baca Langsung

Data yang sering berubah dibaca langsung oleh modul lain agar selalu terbaru.

## Sub-fitur: Jembatan Modul

Modul dari ekosistem KLIR saling tertukar data tanpa mengandalkan alat yang terpisah.

## Task

### 1. Bangun halaman utama Data Terhubung dengan mock data

### 2. Buat komponen Satu Sumber dengan data tiruan

### 3. Buat komponen Salinan Tetap dengan data tiruan

### 4. Buat komponen Baca Langsung dengan data tiruan

### 5. Buat panel Jembatan Modul dengan data tiruan

### 6. Tambahkan daftar Log Aktivitas dengan data tiruan

### 7. Buat skema database pengguna Ruang Kerja langganan

### 8. Buat migrasi tabel keanggotaan dan peran akses

### 9. Buat skema log aktivitas append-only

### 10. Buat skema kantong kredit dan riwayat append-only

### 11. Buat skema salinan tetap immutable

### 12. Buat skema referensi baca langsung

### 13. Buat alur potong kredit dan pengembalian

### 14. Buat middleware urutan akses dan log aktivitas

### 15. Terapkan visibilitas Ruang Kerja dan izin

### 16. Buat service sumber data tunggal untuk modul

### 17. Buat service baca langsung data terkini

### 18. Buat API pembuatan snapshot salinan tetap

### 19. Buat kontrak jembatan modul antar modul

### 20. Buat API jembatan modul dengan isolasi workspace
