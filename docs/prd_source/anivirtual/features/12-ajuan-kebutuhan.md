# Ajuan Kebutuhan

Mengajukan permintaan barang atau kebutuhan lewat formulir yang cepat dan terpantau.

## Spesifikasi

### Tujuan
Fitur ini memungkinkan pengguna mengajukan permintaan barang atau kebutuhan melalui formulir terstruktur, lalu memantau ajuan tersebut hingga mendapat keputusan.

### Selesai bila
- Pengguna dapat membuat ajuan baru berisi nama barang/kebutuhan, jumlah, perkiraan biaya, kategori, tingkat urgensi, dan alasan, tanpa perlu bertanya ulang.
- Setiap ajuan otomatis tersimpan dengan status yang jelas dan dapat dilihat oleh pengguna serta pihak berwenang.
- Sistem menampilkan hasil pemeriksaan anggaran dari CorPlan pada setiap ajuan sebelum keputusan.
- Pihak berwenang dapat menyetujui atau menolak ajuan, dan status perubahannya langsung terlihat oleh pengaju.
- Seluruh ajuan yang pernah dibuat dapat dilihat dalam satu daftar riwayat beserta statusnya.

## Sub-fitur: Form Ajuan

Isi formulir permintaan kebutuhan dengan lengkap tanpa harus bolak-balik nanya.

### Tujuan
Memudahkan pengguna mengisi semua informasi kebutuhan yang diperlukan dalam satu formulir singkat.

### Selesai bila
- Formulir menampilkan kolom lengkap: nama barang/kebutuhan, jumlah, perkiraan biaya (Rp), kategori, urgensi, dan justifikasi/alasan; kolom wajib ditandai jelas.
- Jika ada kolom belum diisi atau tidak valid, muncul pesan kesalahan di samping kolom dan ajuan tidak dapat dikirim.
- Setelah dikirim, ajuan masuk dengan status "Menunggu Persetujuan" dan pengguna mendapat konfirmasi bahwa ajuan tercatat.

## Sub-fitur: Cek Anggaran

Sistem otomatis memeriksa apakah ajuan masih sesuai anggaran dari CorPlan.

### Tujuan
Membantu pengguna dan penilai mengetahui apakah ajuan masih sesuai dengan anggaran yang tersedia dari CorPlan.

### Selesai bila
- Setiap ajuan yang baru diajukan otomatis mendapat hasil pemeriksaan anggaran dengan salah satu label: "Sesuai Anggaran", "Melampaui Anggaran", atau "Tidak Dapat Diverifikasi".
- Hasil pemeriksaan beserta tanggal data anggaran digunakan tampil di halaman detail ajuan.
- Ajuan dengan status "Melampaui Anggaran" menampilkan peringatan visual agar penilai mempertimbangkan sebelum menyetujui.

## Sub-fitur: Alur Persetujuan

Ajuan diteruskan ke pihak berwenang untuk disetujui atau ditolak.

### Tujuan
Memastikan ajuan diputuskan oleh pihak yang berwenang dan hasil keputusannya terdokumentasi.

### Selesai bila
- Hanya pengguna dengan peran Pemilik atau Penyetuju yang dapat melihat tombol "Setujui" dan "Tolak" pada ajuan.
- Saat menolak, penilai wajib mengisi alasan; saat menyetujui, ajuan berubah status menjadi "Disetujui" dan siap diproses ke KLIR Kas.
- Pengaju melihat perubahan status beserta nama penilai dan alasan penolakan (jika ada) di detail ajuan.

## Sub-fitur: Riwayat Ajuan

Lihat status semua ajuan yang pernah diajukan dalam satu daftar.

### Tujuan
Memberikan satu daftar yang merangkum semua ajuan sehingga pengguna dapat memantau statusnya tanpa mencarinya satu per satu.

### Selesai bila
- Daftar riwayat menampilkan tanggal pengajuan, nama barang/kebutuhan, nominal, pengaju, dan status untuk setiap ajuan.
- Pengguna dapat memfilter berdasarkan status (Semua, Menunggu Persetujuan, Disetujui, Ditolak) dan mencari ajuan berdasarkan nama barang atau pengaju.
- Status ditampilkan sebagai label berwarna yang mudah dibedakan, misalnya kuning untuk menunggu, hijau untuk disetujui, merah untuk ditolak.

## Task

### 1. Buat layout utama fitur Ajuan Kebutuhan

### 2. Buat daftar riwayat ajuan dengan filter dan pencarian

### 3. Buat formulir ajuan baru dengan validasi frontend

### 4. Buat detail ajuan dengan hasil cek anggaran dan tombol setujui/tolak

### 5. Buat skema Prisma untuk model Ajuan dan migrasi

### 6. Buat endpoint POST /ajuan untuk membuat ajuan baru

### 7. Buat service cek anggaran dari CorPlan

### 8. Buat endpoint GET /ajuan untuk daftar riwayat dengan filter

### 9. Buat endpoint GET /ajuan/:id untuk detail ajuan

### 10. Buat endpoint POST /ajuan/:id/approve dan /reject
