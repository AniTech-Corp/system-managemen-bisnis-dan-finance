# Cek Anggaran

Memastikan ajuan kebutuhan masih sesuai anggaran dari CorPlan sebelum disetujui.

## Spesifikasi

### Tujuan
Memastikan setiap ajuan kebutuhan yang diajukan masih berada dalam batas anggaran yang tersedia dari CorPlan sebelum disetujui.

### Selesai bila
- Saat approver meninjau sebuah ajuan, ia langsung melihat status anggaran ajuan tersebut, misalnya "Anggaran tersedia" atau "Melebihi anggaran", beserta ringkasan singkatnya.
- Sistem secara otomatis membandingkan nominal ajuan dengan anggaran terkini dari CorPlan tanpa perlu approver membuka aplikasi lain.
- Ajuan yang melebihi anggaran tetap bisa diproses, tetapi muncul peringatan yang jelas agar approver tidak secara tidak sengaja menyetujui melebihi pagu.

## Sub-fitur: Lihat Ringkasan Anggaran

Menampilkan saldo dan ringkasan anggaran dari CorPlan.

### Tujuan
Membantu pengguna membaca kondisi anggaran terbaru dari CorPlan sebelum membuat atau menyetujui ajuan.

### Selesai bila
- Di halaman ajuan atau saat peninjauan, muncul panel ringkasan yang menampilkan jumlah pagu, sisa anggaran, dan jumlah ajuan yang masih menunggu.
- Angka yang ditampilkan memakai format Rupiah yang mudah dibaca, misalnya "Rp 10.000.000".
- Ringkasan anggaran selalu menunjukkan data yang paling terakhir diterima dari CorPlan, sehingga meminimalkan informasi yang kedaluwarsa.

## Sub-fitur: Cek Otomatis

Menandai ajuan yang melebihi anggaran secara otomatis.

### Tujuan
Menandai secara otomatis ajuan yang nominalnya melebihi anggaran yang tersedia, agar keputusan persetujuan menjadi lebih hati-hati.

### Selesai bila
- Setiap ajuan baru atau yang diperbarui langsung diperiksa: jika nominalnya lebih besar dari sisa anggaran, muncul tanda jelas seperti label "Melebihi anggaran" berwarna merah.
- Ajuan yang masih aman diberi label "Anggaran tersedia" dengan warna hijau, sehingga kelihatan aman sekilas.
- Approver tetap dapat mengusulkan ajuan yang melebihi anggaran, tetapi aplikasi meminta konfirmasi tertulis sebelum persetujuan diproses lebih jauh.

## Sub-fitur: Simpan Salinan Anggaran

Menyimpan salinan anggaran bertanggal untuk keperluan audit.

### Tujuan
Menyimpan salinan data anggaran pada tanggal tertentu untuk kebutuhan audit dan transparansi peninjauan.

### Selesai bila
- Saat sebuah ajuan diperiksa, sistem mengambil dan menyimpan salinan anggaran (pagu, terpakai, tersisa) pada tanggal saat itu sebagai arsip.
- Salinan tersebut tidak bisa diubah oleh siapa pun di dalam aplikasi, hanya boleh dibuka untuk melihat riwayat.
- Ketika sebuah ajuan sudah disetujui atau ditolak, salinan anggran yang berkaitan tetap melekat pada riwayat ajuan sehingga bisa ditelusuri kapan saja.

## Task

### 1. Buat halaman peninjauan ajuan dengan panel ringkasan anggaran tiruan

### 2. Tambahkan label status anggaran pada daftar ajuan (data tiruan)

### 3. Buat alur konfirmasi tertulis saat menyetujui ajuan melebihi anggaran

### 4. Tampilkan riwayat salinan anggaran read-only pada detail ajuan (data tiruan)

### 5. Tampilkan riwayat salinan anggaran pada detail ajuan (data tiruan)

### 6. Buat skema Prisma untuk ajuan dan salinan anggaran

### 7. Implementasikan service pengambilan & penyimpanan salinan anggaran dari CorPlan

### 8. Implementasikan logika cek otomatis status anggaran

### 9. Buat endpoint API ringkasan anggaran dan status ajuan

### 10. Simpan salinan anggaran immutable saat peninjauan

### 11. Buat endpoint API ringkasan anggaran dan status ajuan

### 12. Hubungkan salinan anggaran ke riwayat ajuan
