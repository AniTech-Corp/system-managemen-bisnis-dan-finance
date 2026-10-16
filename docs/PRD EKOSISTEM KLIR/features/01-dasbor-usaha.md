# Dasbor Usaha

Halaman utama untuk melihat dan mulai bekerja dari satu Ruang Kerja aktif, lengkap dengan status, modul, kredit, dan aktivitas terbaru.

## Spesifikasi

### Tujuan
Halaman utama untuk melihat dan mulai bekerja dari satu Ruang Kerja aktif, dengan ringkasan usaha, pintu modul, sisa kredit, dan aktivitas terbaru dalam satu tampilan.
### Selesai bila
- Dasbor muncul setelah pengguna memilih Ruang Kerja aktif, dan menampilkan nama usaha, jenis usaha, paket, sisa kredit, daftar modul, serta aktivitas terbaru.
- Dasbor menjadi pusat navigasi: setiap bagian (status ruang, pintu modul, sisa kredit, aktivitas) menampilkan informasi dari Ruang Kerja aktif saat ini.
- Ada penanda jelas Ruang Kerja yang sedang aktif, misalnya label `Ruang Aktif` di bagian Status Ruang.
- Saat pengguna berpindah Ruang Kerja, seluruh isi dasbor ikut berganti sesuai Ruang Kerja baru.
- Dasbor tetap tampil rapi ketika data kosong, misalnya belum ada aktivitas atau kredit masih nol.

## Sub-fitur: Status Ruang

Menampilkan ringkasan usaha, paket, dan Ruang Kerja yang sedang dipilih.

### Tujuan
Menampilkan ringkasan usaha, paket, dan Ruang Kerja yang sedang dipilih agar pengguna langsung tahu sedang bekerja di mana.
### Selesai bila
- Kartu Status Ruang menampilkan nama usaha, jenis usaha, nama paket, dan penanda Ruang Kerja aktif.
- Dari Status Ruang, pengguna bisa melihat Ruang Kerja lain tanpa kehilangan konteks usaha saat ini.
- Nama paket ditampilkan dengan jelas (Free, Starter, atau Business) beserta status langganan aktif.

## Sub-fitur: Pintu Modul

Langsung membuka modul-modul di dalam Ruang Kerja dari satu halaman utama.

### Tujuan
Memberikan jalan masuk langsung ke semua modul KLIR dari dasbor Ruang Kerja aktif.
### Selesai bila
- Dasbor menampilkan pintu untuk ketujuh modul: CorPlan, AniVirtual, Repository Hukum, KLIR Kas, KLIR Promo, KLIR Kerja, dan KLIR Booking.
- Setiap pintu menampilkan nama modul dan deskripsi singkat; modul yang tersedia bisa diklik dan membuka modul di Ruang Kerja aktif.
- Modul yang belum tersedia tetap terlihat tetapi diberi status non-aktif, misalnya label `Segera`, agar pengguna tidak bingung.

## Sub-fitur: Sisa Kredit

Melihat sisa kredit dan batas paket tanpa harus pindah halaman.

### Tujuan
Menampilkan sisa kredit dan batas paket Ruang Kerja aktif langsung di dasbor tanpa harus membuka halaman lain.
### Selesai bila
- Bagian Sisa Kredit menampilkan angka kredit tersisa dengan format ribuan, contoh `1.250`, beserta label `Kredit`.
- Batas paket ditampilkan sesuai paket aktif, contoh `100/hari`, `2.000/minggu`, atau `8.000/minggu`, lengkap dengan batas bulanan bila ada.
- Ada peringatan visual yang mudah dikenali saat sisa kredit tinggal sedikit atau habis.

## Sub-fitur: Aktivitas Terbaru

Menampilkan beberapa aktivitas terakhir yang terjadi di Ruang Kerja aktif.

### Tujuan
Menampilkan beberapa aktivitas terakhir di Ruang Kerja aktif agar pengguna bisa melihat perkembangan dan jejak kerja terbaru.
### Selesai bila
- Dasbor menampilkan 5 aktivitas terakhir dengan urutan terbaru di paling atas.
- Setiap baris aktivitas menampilkan nama pengguna, aksi yang dilakukan, modul terkait, status berhasil/gagal, dan waktu kejadian.
- Jika belum ada aktivitas, muncul pesan ramah seperti `Belum ada aktivitas di Ruang Kerja ini.`

## Task

### 1. Bangun halaman Dasbor Usaha dengan data tiruan

### 2. Tambah dropdown pemilihan Ruang Kerja aktif

### 3. Buat skema database Ruang Kerja dan terkait

### 4. Buat endpoint GET /dashboard untuk data dasbor

### 5. Hitung sisa kredit dan batas paket dari riwayat

### 6. Ambil daftar modul dengan status akses

### 7. Implementasi query 5 aktivitas terakhir

### 8. Seed data contoh untuk pengembangan dasbor
