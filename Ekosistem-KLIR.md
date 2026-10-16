**EKOSISTEM KLIR**

Dokumen Konsolidasi Terkini: 7 Pilar, Fondasi Platform, dan 65 Fitur

_Dokumen Internal Produk AniTech_

20 Agustus 2026

**CATATAN PENTING: Ini DOKUMEN HIDUP, bukan versi final beku. Struktur, fitur, dan urutan di bawah bisa berubah seiring pengembangan, lihat bagian "Tentang Dokumen Ini" untuk penjelasan.**

# Tentang Dokumen Ini

Dokumen ini merangkum status dan rencana ekosistem KLIR per 20 Agustus 2026, digabung dari seluruh sumber yang ada sampai hari ini: Blueprint 7 Pilar dan Panduan Realisasi Teknis (16 Agustus 2026, dokumen internal AniTech untuk tim developer), audit teknis dev (dibuat 15 Agustus 2026), brief lisan Mecca ke tim dev (20 Agustus 2026), serta klarifikasi dan keputusan yang diambil dalam sesi kerja 20 Agustus 2026.

SIFAT DOKUMEN INI: hidup, bukan final. Rencana pembangunan PRD ekosistem KLIR akan dibuat lewat platform "ngoding pake ai", yang memungkinkan tiap bagian, fondasi sistem, per-pilar/ekosistem, sampai per-fitur, diubah, ditambah, atau disusun ulang secara modular, layaknya memasang dan menukar potongan LEGO. Karena itu dokumen ini disusun berlapis: fondasi platform yang dipakai bersama, lalu tiap pilar sebagai modul terpisah, lalu tiap fitur di dalam pilar, supaya perubahan di satu lapis tidak memaksa menulis ulang semuanya.

Format tiap pilar mengikuti 4 bagian tetap: Latar Belakang (masalah yang diselesaikan), Visi dan Proposisi Nilai, Spesifikasi Fitur (cara kerja, contoh nyata, dan manfaat, bukan cuma nama fitur), dan Keunggulan Dibandingkan Produk Lain.

# Bagian 1: Filosofi dan Visi Ekosistem

KLIR bukan aplikasi tunggal, melainkan platform OS bisnis berbasis AI. Analoginya adalah ekosistem Google, satu sistem database yang dipakai lintas semua produk, sehingga pengguna tidak perlu menjelaskan ulang konteks usahanya tiap berpindah fitur. Inspirasi spesifiknya adalah fitur "Google Personal" di Gemini: AI yang mengenali konteks personal secara utuh.

Untuk konteks bisnis, cakupannya diperluas melampaui data transaksi/operasional, idealnya AI juga memahami struktur organisasi penggunanya: siapa menjabat apa, bagaimana budaya komunikasi tiap divisi, dan konteks perusahaan secara umum. Analoginya persis sistem memory asisten AI yang dipakai untuk mengelola pekerjaan sehari-hari pemilik AniTech sendiri, tahu identitas penggunanya, riwayat pekerjaannya, dan siapa saja pemangku kepentingan di sekitarnya. Lapisan "pengetahuan organisasi" ini masih berstatus rencana masa depan, belum ada model datanya di sistem manapun, lihat Bagian 7.

Motivasi bisnis: mengurangi beban komunikasi berulang antar-divisi dan mempercepat pengambilan keputusan berbasis data historis perusahaan. Posisi resmi soal dampak ketenagakerjaan: tujuannya memberdayakan manusia dengan AI, bukan menggantikannya secara prinsip, namun diakui secara terbuka bahwa posisi kerja dengan keterampilan rendah berisiko realistis tergantikan seiring adopsi sistem ini.

# Bagian 2: Arsitektur Fondasi Platform

Ketujuh pilar KLIR bukan tujuh aplikasi terpisah yang kebetulan berdekatan, melainkan tujuh bagian dari satu platform yang sama. Delapan langkah berikut WAJIB selesai dan matang sebelum satu fitur pilar pun mulai dikerjakan secara serius, karena kalau dilewat, risikonya nyata: pengguna paket gratis bisa mengakses fitur berbayar tanpa terdeteksi, atau data satu perusahaan bisa tercampur dengan data perusahaan lain.

## 2.1 Alur Fondasi 8 Langkah

**1\. Masuk (Login):** Satu sistem login dipakai oleh ketujuh pilar, bukan tujuh sistem login berbeda-beda.

**2\. Ruang Kerja (Workspace):** Sistem menentukan usaha/perusahaan mana yang sedang diakses. Satu orang bisa punya beberapa Ruang Kerja kalau terlibat di lebih dari satu usaha.

**3\. Paket Langganan:** Sistem mengecek paket apa yang dibeli Ruang Kerja ini, gratis, atau salah satu paket berbayar.

**4\. Hak Akses Pilar (Entitlement):** Sistem mengecek pilar mana saja yang boleh dipakai Ruang Kerja ini. Kalau yang dibeli cuma "KLIR Kas", akses ke KLIR Promo ditolak walaupun secara teknis datanya ada di database yang sama.

**5\. Peran Pengguna (RBAC):** Sistem mengecek peran orang ini di Ruang Kerja, lihat detail model RBAC dua lapis di 2.2. Satu daftar peran dipakai di semua pilar, bukan tiap pilar punya aturan peran sendiri-sendiri.

**6\. Kredit:** Setiap kali ada aksi yang memanggil kecerdasan buatan atau layanan berbayar lain, sistem mengurangi kredit dari satu kantong kredit milik Ruang Kerja itu.

**7\. Fitur Berjalan:** Baru di titik ini fitur pilar yang sebenarnya (membuat invoice, membuat video promosi, dst) benar-benar dijalankan.

**8\. Catatan Aktivitas:** Sistem mencatat semua yang terjadi, untuk keperluan audit, dan sebagai dasar hitungan biaya bulanan.

## 2.2 Kontrol Akses Dua Lapis (RBAC)

Kontrol akses KLIR terdiri dari dua lapis yang berbeda dan berjalan bersamaan, bukan satu daftar peran tetap yang otomatis menentukan semua akses sekaligus.

**Lapis 1 (Peran Fungsional):** menentukan siapa yang berwenang memberi akses. Tiga peran dasar: Pemilik, Anggota Biasa, dan Penyetuju. Penyetuju berperan seperti admin pada server Discord, dialah yang menentukan siapa dibukakan akses ke sumber daya/dokumen tertentu, bukan sekadar menyembunyikan tombol di layar.

**Lapis 2 (Hibah Akses per Sumber Daya):** menentukan siapa benar-benar boleh melihat data/dokumen spesifik apa. Contoh: seorang karyawan finance bisa diberi akses tambahan untuk mengelola data marketing kalau disetujui Penyetuju/Pemilik, tanpa harus naik jabatan. Sebaliknya, karyawan marketing biasa tidak otomatis bisa melihat dokumen finance yang bersifat rahasia hanya karena berada dalam satu Ruang Kerja yang sama. Implikasi desain data: perlu tabel tersendiri (semacam "resource_grants") yang mencatat siapa diberi akses ke sumber daya/departemen apa, dan oleh siapa akses itu diberikan, terpisah dari tabel peran dasar.

_Prinsip penamaan: label peran dan hak akses WAJIB tersedia dalam dua gaya bahasa, versi formal/bisnis dan versi sederhana/santai, idealnya sebagai preferensi yang bisa dipilih pengguna, bukan satu gaya bahasa yang dipaksakan ke semua orang._

## 2.3 Sistem Kredit

Pengguna tidak membayar per fitur, melainkan memakai model ekonomi kredit. Angka berikut adalah angka kredit teknis mentah dari audit dev 15 Agustus 2026, belum diputuskan apakah akan ditampilkan langsung ke pengguna, atau dibungkus dalam "satuan bisnis" yang lebih mudah dipahami (misalnya "20 laporan per bulan") untuk menghindari efek psikologis "takut mengklik" karena merasa tiap pertanyaan berarti mengeluarkan uang.

| **Paket**     | **Kuota Mingguan**  | **Batas Bulanan**                   | **Catatan**                                                                                                                             |
| ------------- | ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Free (Gratis) | 100 kredit/hari     | Reset harian                        | Sesuai keputusan fase ini (lihat 2.4), Free tetap dapat akses ke semua pilar. Pembatasannya lewat jumlah kredit, bukan penguncian modul |
| Started       | 2.000 kredit/minggu | Maks 10.000/bulan (dengan cadangan) |                                                                                                                                         |
| Business      | 8.000 kredit/minggu | Maks 46.000/bulan                   |                                                                                                                                         |

Alur pemakaian kredit (urutan wajib, bagian dari fondasi 8 langkah di atas):

- Masuk -> Tentukan Ruang Kerja -> Cek Langganan -> Cek Hak Akses Pilar -> Cek Peran (RBAC)
- Hitung biaya fitur -> Potong kredit dari kantong Ruang Kerja
- Kalau kredit habis: buka kuota cadangan (reserve)
- Kalau tetap habis setelah cadangan: BLOKIR aksi
- Simpan ke buku besar kredit (ledger) -> baru eksekusi aksi

Jalur Private (KLIR dipasang langsung di server milik klien korporat) sengaja TIDAK dijabarkan dalam dokumen ini karena ini urusan komersial langsung antara AniTech dan klien, di luar cakupan sistem kredit publik. Fokus pembangunan saat ini murni pada satu ekosistem KLIR yang utuh; skema langganan per-pilar/kombinasi dan mekanisme kredit Private ditunda dan tidak dirinci sampai keputusan lebih lanjut.

## 2.4 Hak Akses per Paket (Entitlement)

_KEPUTUSAN 20 Agustus 2026: fase pengembangan sekarang fokus membangun satu ekosistem yang utuh. Semua paket berbayar mendapat akses ke ketujuh pilar sekaligus. Tidak ada penguncian per-pilar. Perbedaan antar-paket hanya pada kuota kredit (lihat 2.3), bukan pilar mana yang bisa diakses. Skema langganan per-pilar atau per-kombinasi pilar (misalnya beli CorPlan saja, atau CorPlan plus KLIR Kas saja) ditunda ke fase berikutnya, belum dikerjakan sekarang._

Karena itu, tahap "Hak Akses Pilar" di alur fondasi 8 langkah (2.1) untuk fase ini cukup selalu meloloskan setiap Ruang Kerja yang punya langganan aktif, tanpa mengecek pilar spesifik. Struktur datanya tetap disiapkan (tabel Hak Akses Pilar tetap ada), supaya nanti kalau skema per-pilar diaktifkan kembali, tidak perlu membangun ulang dari nol. Tinggal mengaktifkan pengecekannya.

## 2.5 Struktur Data Inti

| **Tabel**           | **Isinya**                                                         |
| ------------------- | ------------------------------------------------------------------ |
| Pengguna            | Satu baris untuk setiap orang yang punya akun                      |
| Ruang Kerja         | Satu baris untuk setiap usaha/perusahaan                           |
| Anggota Ruang Kerja | Menghubungkan orang dengan Ruang Kerja, plus perannya              |
| Langganan           | Ruang Kerja mana memakai paket apa                                 |
| Hak Akses Pilar     | Ruang Kerja mana boleh mengakses pilar mana                        |
| Kantong Kredit      | Sisa kredit tiap Ruang Kerja                                       |
| Riwayat Kredit      | Catatan tiap pemakaian kredit, siapa, pilar apa, fitur apa, berapa |
| Catatan Aktivitas   | Log semua aksi pengguna, untuk audit                               |

Aturan kritis: setiap tabel data milik pilar manapun (data transaksi KLIR Kas, data booking KLIR Booking, dst) WAJIB selalu menyertakan penanda "milik Ruang Kerja mana" di setiap barisnya. Tanpa penanda ini, data satu perusahaan berisiko tercampur dengan perusahaan lain. Memory/konteks juga wajib dipisah tegas antara data PERSONAL dan data RUANG KERJA.

# Bagian 3: Alur Data Antar-Pilar

Sebagian pilar tidak berdiri sendiri, data yang dihasilkan satu pilar dipakai pilar lain. KLIR Booking sengaja dirancang berdiri sendiri penuh, tidak mengirim atau menerima data dari pilar manapun, sehingga paling mudah dibangun terpisah.

| **Dari -> Ke**                   | **Kapan Terjadi**                                      | **Data yang Lewat**                                                       | **Yang Perlu Diwaspadai**                                                                                                                   |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| CorPlan -> AniVirtual            | Manual, tombol "Bagikan Konteks Usaha"                 | Ringkasan data usaha (nama, jenis usaha, target pasar), bukan semua data  | Kalau format data berubah, versi lama tetap harus bisa dibaca                                                                               |
| CorPlan -> AniVirtual + KLIR Kas | Bagian dari paket data yang sama                       | Data anggaran per kategori                                                | Data ini "foto" satu waktu tertentu, bukan langsung-hidup, kalau sudah lama, sistem wajib beri peringatan data mungkin tidak akurat         |
| CorPlan -> KLIR Promo            | Tiap kali KLIR Promo dibuka                            | Katalog produk (nama, deskripsi, harga, foto)                             | Kalau produk dihapus di CorPlan, materi promosi lama tetap simpan salinannya sendiri                                                        |
| Repository Hukum -> CorPlan      | Manual, tombol "simpan ke CorPlan"                     | Kode usaha, daftar izin, sumber, tanggal terakhir diperiksa               | Kalau aturan hukum berubah setelah disimpan, data TIDAK otomatis ikut update                                                                |
| AniVirtual -> KLIR Kerja         | Otomatis, begitu ada tugas disepakati dalam percakapan | Judul tugas, deskripsi, penanggung jawab, tautan balik ke percakapan asal | PALING BERISIKO, sistem harus membedakan "obrolan biasa" dari "tugas beneran"; ini soal ketepatan logika AI, bukan sekadar sambungan teknis |
| AniVirtual -> KLIR Kas           | Otomatis, begitu status pengajuan disetujui            | Nominal, kategori, penyetuju, tanggal                                     | Kalau KLIR Kas sedang bermasalah, data persetujuan wajib masuk antrean dan dicoba lagi supaya tidak hilang                                  |
| KLIR Kas -> KLIR Promo           | Tiap kali katalog KLIR Promo dibuka                    | Nama barang, sisa stok, harga                                             | Kalau stok habis saat pelanggan melihat katalog, wajib tampil "stok habis"                                                                  |

# Bagian 4: Tujuh Pilar Ekosistem

_Total 65 fitur aktif di seluruh ekosistem per 16 Agustus 2026. CorPlan dan AniVirtual sudah berjalan sebagian dan TIDAK dibangun ulang dari nol, keduanya dilanjutkan menambah fitur yang masih rencana, sekaligus disambungkan ke Fondasi Platform di Bagian 2 yang belum ada saat fitur-fitur itu pertama kali dibangun sebagai produk berdiri sendiri. Lima pilar lain belum memiliki satu baris kode pun._

## 4.1 CorPlan

_Status saat ini: sudah matang dan digunakan (live), local-first, AI Gemini dengan kunci di server._

### Latar Belakang

Banyak pelaku UMKM dan perintis usaha di Indonesia kesulitan menyusun dokumen bisnis formal seperti proposal KUR, studi kelayakan, atau materi presentasi investor. Menyewa konsultan bisnis bisa menghabiskan biaya jutaan rupiah, jauh dari jangkauan kebanyakan UMKM.

### Visi dan Proposisi Nilai

CorPlan membuat kemampuan menyusun rencana bisnis setara konsultan profesional bisa diakses siapa saja. Data pengguna tersimpan local-first di perangkat mereka sendiri, bukan keterbatasan teknis melainkan nilai jual privasi yang sengaja dipertahankan.

### Spesifikasi Fitur (14 fitur, 13 sudah berjalan, 1 rencana)

| **Nama Fitur**                       | **Kegunaan**                                                                     | **Status**                                           |
| ------------------------------------ | -------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Proposal Bisnis AI (6 Bab)           | Menyusun dokumen proposal bisnis lengkap format lazim diminta bank/dinas terkait | Sudah berjalan                                       |
| Pitch Deck Investor (12 Slide)       | Menyusun materi presentasi investor lengkap dengan narasi tiap slide             | Sudah berjalan                                       |
| Kalkulator HPP, CapEx, OpEx, BEP     | Menghitung harga pokok produksi, belanja modal, biaya operasional, titik impas   | Sudah berjalan, murni matematis                      |
| Simulator KUR dan Cicilan            | Mensimulasikan cicilan pinjaman KUR 12-60 bulan                                  | Sudah berjalan, murni matematis                      |
| Penilaian Nilai Usaha untuk Investor | Memperkirakan nilai usaha berdasarkan pendapatan dan keuntungan                  | Sudah berjalan                                       |
| Analisis Kompetitor                  | Memetakan pesaing di pasar yang sama                                             | Sudah berjalan                                       |
| Riset Tren Pasar dari Google         | Menampilkan tren pencarian produk/jasa pengguna                                  | Sudah berjalan, perlu transparansi sumber lebih baik |
| Kalender Konten Pemasaran 30 Hari    | Rencana konten pemasaran siap pakai untuk bulan pertama                          | Sudah berjalan                                       |
| Analisis SWOT dan Manajemen Risiko   | Analisis kekuatan/kelemahan/peluang/ancaman otomatis                             | Sudah berjalan                                       |
| Daftar Periksa Legalitas Usaha       | Daftar izin dasar sesuai jenis usaha                                             | Sudah berjalan, ada kendala tampilan kecil           |
| Konsultan Bisnis AI (Tanya Jawab)    | Menjawab pertanyaan bebas seputar usaha pengguna                                 | Sudah berjalan                                       |
| Dukungan Multi Mata Uang             | Perhitungan dalam mata uang asing                                                | Sudah berjalan                                       |
| Panduan untuk Pemula                 | Menjelaskan istilah bisnis dengan bahasa sehari-hari                             | Sudah berjalan di seluruh aplikasi                   |

**Tombol Bagikan Konteks Usaha (rencana)**

Cara kerja: Saat tombol ditekan, sistem menyusun ringkasan terstruktur dari data usaha di CorPlan, dibatasi pada daftar informasi tertentu (bukan omzet atau strategi rahasia), diberi tanggal pembuatan, dan dibatasi ukurannya. Pengguna mengunduh atau menyalin ringkasan itu untuk ditempel manual ke AniVirtual.

Contoh nyata: Ibu Sari, pemilik usaha katering, menekan tombol ini sebelum minta tolong AniVirtual membuatkan pesan ke pemasok, AniVirtual langsung paham konteks usahanya tanpa Ibu Sari menjelaskan ulang dari nol.

Manfaat bagi pengguna: Tidak perlu menjelaskan usaha dari nol setiap pindah aplikasi, sambil tetap memegang kendali penuh atas data yang dibagikan.

### Keunggulan Dibandingkan Produk Lain

- Memahami konteks Indonesia (format KUR bank nasional, aturan lokal) yang tidak dimiliki produk asing seperti LivePlan atau Bizplan.
- Tetap bisa dipakai walau kecerdasan buatan bermasalah, setiap fitur punya cara kerja cadangan matematis.
- Bisa berdiri sendiri maupun tersambung ke ekosistem yang lebih luas.

### Realisasi ke Ekosistem

Fitur yang sudah berjalan TETAP butuh kerjaan nyata: dipindahkan agar panggilan kecerdasan buatannya lewat proxy kredit terpusat (Bagian 2), karena saat ini kemungkinan belum lewat sistem itu sebab dibangun sebelum fondasi ekosistem ada. Dari sisi pengguna, fitur tidak berubah sama sekali, yang berubah cuma jalur panggilannya di belakang layar. Fitur murni matematis (HPP/BEP, Simulator KUR, Multi Mata Uang) cuma perlu ditandai "milik Ruang Kerja mana", tanpa perubahan cara kerja. Tidak bergantung pilar lain, bisa dikerjakan kapan saja.

## 4.2 AniVirtual

_Status saat ini: prototipe/demo-grade, single-user, migrasi model biaya AI ke platform sedang berjalan._

### Latar Belakang

Karyawan sering kesulitan menjelaskan kebutuhan ke atasan dengan format tepat, dan instruksi dari atasan yang kurang jelas sering disalahpahami bawahan, AniVirtual menjembatani dua arah komunikasi ini.

### Visi dan Proposisi Nilai

AniVirtual berkembang dari asisten pribadi menjadi Internal Workflow and Context Agent, alat kerja tim yang membantu memahami dan menyusun komunikasi lintas divisi, bukan menggantikan penilaian manusia.

### Spesifikasi Fitur (sudah berjalan)

| **Nama Fitur**                   | **Kegunaan**                                                           | **Status**                           |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Pahami Pesan (Penerjemah)        | Menerjemahkan pesan kerja kurang jelas jadi maksud yang mudah dipahami | Sudah berjalan                       |
| Balas Pesan dengan Skenario      | Memberi draf balasan siap pakai untuk permintaan kurang jelas          | Sudah ada versi awal                 |
| Ajuan Kebutuhan (Formulir)       | Menyusun pengajuan pengadaan barang/dana secara terstruktur            | Formulir sudah berjalan              |
| Buat Rencana Kerja atau Roadmap  | Menyusun rencana kerja mingguan/bulanan                                | Sudah berjalan                       |
| Kartu Kenalan dan Memori Pribadi | Menyimpan konteks pribadi (atasan/klien, istilah khusus)               | Sudah berjalan, ditinjau manual dulu |

**Fitur rencana (urutan prioritas WAJIB dipatuhi, jangan diacak):**

**1\. Pemindahan Kunci Kecerdasan Buatan ke Server (Prioritas 1)**

Cara kerja: Seluruh permintaan ke kecerdasan buatan dialihkan lewat perantara di sisi server AniTech, kunci API tidak pernah muncul di peramban pengguna. Dipadukan sistem kuota, pembatasan jumlah permintaan, pencatatan biaya, dan tombol darurat.

Contoh nyata: Pak Made mendaftarkan AniVirtual untuk timnya dan langsung bisa pakai tanpa mengurus kunci API sendiri, berbeda dari sistem lama yang mengharuskan pendaftaran akun terpisah.

Manfaat bagi pengguna: Pengguna korporat tidak perlu mengurus kunci API sendiri saat memasang AniVirtual.

_Tingkat kesulitan: Tinggi, fondasi keamanan wajib matang sebelum fitur lain menambah biaya AI._

**2\. Tingkat Akses Berjenjang 3 Peran (Prioritas 2)**

Cara kerja: Setiap permintaan diperiksa di server terhadap peran pengguna (pemilik/anggota/penyetuju) sebelum diizinkan berjalan, bukan sekadar menyembunyikan tombol di layar.

Contoh nyata: Bu Rini sebagai manajer bisa melihat data seluruh anggota tim, sementara karyawan biasa hanya bisa melihat data miliknya sendiri.

Manfaat bagi pengguna: Data satu perusahaan tidak bisa bocor terlihat oleh perusahaan lain.

**3\. Ajuan Kebutuhan, Pemeriksaan Anggaran Otomatis (Prioritas 3)**

Cara kerja: Sistem membandingkan nominal pengajuan dengan snapshot anggaran terakhir dari CorPlan, menampilkan status sesuai/melebihi anggaran tanpa auto-approve.

Contoh nyata: Andi mengajukan pembelian laptop Rp15 juta dan langsung diberi tahu bahwa ini melebihi sisa anggaran divisi bulan ini.

Manfaat bagi pengguna: Proses persetujuan lebih cepat karena masalah anggaran ketahuan sejak awal.

**4\. Balas Pesan dengan Banyak Skenario, Diperkuat (Prioritas 4)**

Cara kerja: Tombol opsional "Buat Alternatif" menghasilkan 1-2 draf tambahan dengan gaya berbeda, tidak otomatis membuat banyak draf sekaligus.

Contoh nyata: Nina menekan "Buat Alternatif" saat draf pertama terasa terlalu formal untuk klien yang sedang kesal, dan mendapat draf kedua yang lebih hangat.

Manfaat bagi pengguna: Fleksibilitas memilih gaya balasan tanpa menulis ulang dari nol.

**5\. Penyesuaian Gaya Bahasa Fleksibel (Prioritas 5)**

Cara kerja: Kolom catatan gaya (maksimal 300 huruf) ditambahkan di atas tiga preset yang sudah ada.

Contoh nyata: Rina menulis "gaya santai seperti ngobrol sama teman, boleh emoji" di kolom catatan gaya untuk toko onlinenya.

Manfaat bagi pengguna: Sedikit lebih personal tanpa membangun mesin gaya bahasa yang rumit.

_Ekstensi Peramban WhatsApp dan Gmail: DIBATALKAN permanen, tampilan WhatsApp Web sering berubah tanpa pemberitahuan sehingga perawatannya tidak akan pernah selesai untuk tim kecil. Jalur resmi WhatsApp Business API bisa dipertimbangkan di masa depan sebagai proyek terpisah._

### Keunggulan Dibandingkan Produk Lain

- Terhubung dengan konteks bisnis yang spesifik (Kartu Kenalan, data anggaran dari CorPlan), pembeda utama dari ChatGPT, Copilot, atau asisten kecerdasan buatan umum.
- Tidak pernah berhenti bekerja hanya karena permintaan kurang jelas, selalu memberi alternatif, bukan berpura-pura yakin ("halu percaya diri") seperti pola umum chatbot lain.
- Pemisahan tegas data pribadi dan data perusahaan sejak awal perancangan.

### Realisasi ke Ekosistem

AniVirtual dibangun untuk SATU PENGGUNA, konsep Ruang Kerja dan peran belum ada sama sekali di kodenya. Semua fitur yang sudah berjalan perlu disambungkan ke tabel Ruang Kerja/Peran yang baru, plus proxy kredit terpusat. Kartu Kenalan dan Memori Pribadi perlu penegasan ulang batas privasi, data ini harus tetap PRIBADI per orang, bukan ikut terlihat semua anggota Ruang Kerja.

## 4.3 Repository Hukum

_Status saat ini: belum ada satu baris kode pun, pilar paling baru, cakupan sengaja dipersempit._

### Latar Belakang

Aturan hukum di Indonesia sering berubah dan sulit diikuti pelaku usaha awam. Model kecerdasan buatan pada umumnya bisa mengarang pasal hukum yang tidak ada, risiko yang bisa berakibat mahal secara hukum.

### Visi dan Proposisi Nilai

Repository Hukum menjadi benteng kepatuhan yang mengurangi risiko kesalahan hukum di titik-titik yang dipakai CorPlan dan AniVirtual, dengan cakupan sengaja dibuat sempit namun akurat. Mesinnya memakai pendekatan Temporal Graph plus RAG, menyimpan status tiap aturan (BERLAKU/DICABUT/DIUBAH) dan hanya memakai aturan yang masih aktif sebagai sumber jawaban, sehingga jawaban terverifikasi deterministik, bukan hasil karangan model bahasa.

### Spesifikasi Fitur (4 fitur, semua rencana)

**Label Kejujuran pada Setiap Hasil Terkait Hukum**

Cara kerja: Setiap jawaban hukum otomatis dibungkus kalimat baku yang sudah ditinjau pengacara, menyatakan ini informasi awal bukan nasihat hukum final, dengan tanggal data terakhir diperiksa.

Contoh nyata: Pak Joko bertanya soal izin usaha laundry dan mendapat jawaban disertai catatan "terakhir diperiksa 1 Agustus 2026, silakan konfirmasi ke instansi terkait".

Manfaat bagi pengguna: Pengguna tidak salah mengira info awal sebagai kepastian hukum.

_Tingkat kesulitan: Rendah secara teknis, tapi wajib ditinjau pengacara. Dibangun paling dulu, wajib ada sejak hari pertama._

**Kumpulan Regulasi Prioritas yang Dikurasi Manual**

Cara kerja: Data hukum penting dimasukkan manual oleh tim dibantu tenaga hukum, dimulai dari satu sektor usaha, dengan sumber resmi dan tanggal cek tercatat.

Contoh nyata: Tim hukum AniTech memulai dari aturan seputar usaha kuliner (izin PIRT, sertifikasi halal) sebagai sektor pertama.

Manfaat bagi pengguna: Data yang ditampilkan sudah benar-benar diperiksa manusia, bukan tebakan AI.

**Pencarian Kode Usaha dan Panduan Perizinan**

Cara kerja: Pengguna mengetik jenis usaha dalam bahasa sehari-hari, sistem mencari di data yang sudah dikurasi, menampilkan kode usaha dan izin yang perlu diurus.

Contoh nyata: Mbak Fitri mengetik "mau buka warung kopi jual kue basah" dan mendapat kode usaha serta izin PIRT yang relevan lengkap dengan sumbernya.

Manfaat bagi pengguna: Jawaban cepat dan bisa dipercaya, terhubung ke Daftar Periksa Legalitas di CorPlan.

_Baru bisa jalan setelah data regulasi siap._

**Pemeriksa Draf Kontrak Kerja (Diblokir Sementara)**

Cara kerja: Rencana: pengguna unggah draf kontrak, AI membandingkan dengan daftar klausul bermasalah yang sudah dikunci pengacara, menandai bagian yang perlu dicek, bukan memvonis legal/ilegal.

Contoh nyata: Kalau nanti dibangun dengan aman, ini bisa jadi fitur paling bernilai bagi klien korporat yang khawatir risiko tuntutan ketenagakerjaan.

Manfaat bagi pengguna: Ditahan dulu, dokumen berisi data pribadi karyawan dan risiko kecerdasan buatan mengarang jawaban terlalu tinggi untuk kapasitas tim saat ini.

_Syarat operasional wajib: kerja sama dengan konsultan hukum atau paralegal, ini gerbang, bukan fitur produk. Tanpa tenaga hukum aktif meninjau data secara berkala, jangan rilis hasil terkait hukum ke pengguna._

### Keunggulan Dibandingkan Produk Lain

- Langsung terhubung ke tindakan nyata (kode usaha masuk CorPlan, klausul bermasalah masuk draf balasan AniVirtual), Hukumonline berhenti di tahap menampilkan informasi saja.
- Kejujuran mengenai cakupan terbatas justru jadi nilai jual, bukan kelemahan.

## 4.4 KLIR Kas

_Keuangan Bisnis End-to-End. Belum ada kode, pilar baru, fitur terbanyak dan paling saling terhubung._

### Latar Belakang

Pelaku UMKM Indonesia menghadapi rangkaian masalah keuangan yang saling terkait namun selama ini ditangani terpisah-pisah: malas mencatat transaksi harian sehingga uang pribadi dan usaha tercampur dan piutang lupa ditagih tepat waktu; invoice manual terlihat tidak profesional dan klien bisnis-ke-bisnis kerap telat membayar; pemilik usaha tidak tahu kapan kas akan habis; regulasi pajak Indonesia membingungkan non-akuntan; dan tiap pengeluaran operasional harus menunggu persetujuan pemilik usaha yang sering di luar kantor, memaksa staf menombok uang pribadi. Semua ini sebenarnya satu rangkaian siklus keuangan yang sama, tapi alat yang tersedia di pasar menanganinya sebagai produk-produk terpisah yang tidak saling terhubung.

### Visi dan Proposisi Nilai

KLIR Kas menyatukan seluruh siklus itu dalam satu buku besar tunggal, pembukuan otomatis terisi dari invoice yang diterbitkan, proyeksi kas menarik data historis otomatis, kalkulator pajak yang datanya ditarik otomatis dari pembukuan, dan persetujuan pengeluaran yang begitu disetujui langsung tercatat sebagai pengeluaran. Diposisikan sebagai "prediksi kapan kas habis, versi UMKM", bukan alat proyeksi setara perusahaan besar, mengisi kekosongan pasar nyata karena pemain yang ada (termasuk HashMicro) menyasar skala perusahaan besar, bukan UMKM.

### Spesifikasi Fitur (12 fitur, semua rencana)

**Pembukuan Otomatis dan Pembacaan Struk**

Cara kerja: Pengguna mencatat transaksi manual atau mengunggah foto struk. Sistem membaca teks dari foto secara otomatis, hasil bacaan selalu ditampilkan dulu ke pengguna untuk dikoreksi sebelum tersimpan.

Contoh nyata: Ibu Sari, pemilik warung sembako, memfoto struk belanja bahan baku; sistem membaca "Beras 10kg, Rp150.000" otomatis, Ibu Sari tinggal konfirmasi.

Manfaat bagi pengguna: Pencatatan jauh lebih cepat dibanding menulis manual, tanpa kehilangan kontrol karena tetap ada langkah konfirmasi.

_Dibangun PALING DULU, fondasi tempat sebelas fitur lain menyimpan dan membaca data._

**Invoice dan Pembayaran Digital**

Cara kerja: Sistem menghasilkan tautan pembayaran resmi lewat penyedia pembayaran (Xendit/Midtrans). Begitu klien membayar, status invoice berubah otomatis jadi lunas.

Contoh nyata: Bengkel motor milik Pak Dedi mengirim invoice lewat KLIR Kas; begitu pelanggan transfer, sistem otomatis menandai lunas.

Manfaat bagi pengguna: Tidak perlu mengecek mutasi rekening manual untuk tahu invoice sudah dibayar.

**Proyeksi Arus Kas**

Cara kerja: Sistem membaca histori transaksi tiga bulan terakhir, menghitung rata-rata uang masuk-keluar, lalu memproyeksikan bulan ke berapa kas diperkirakan menipis.

Contoh nyata: Usaha katering Bu Wati dapat peringatan "kas diperkirakan menipis dalam 45 hari" jauh sebelum uang benar-benar habis.

Manfaat bagi pengguna: Tahu kapan harus berhemat atau mencari modal, bukan baru sadar setelah kas kosong.

**Kalkulator Pajak UMKM**

Cara kerja: Sistem mengambil total pendapatan bulan berjalan, mengalikan persentase PPh Final UMKM, menampilkan draf perkiraan pajak dengan penjelasan bahasa sederhana.

Contoh nyata: Toko kue Rina otomatis melihat "perkiraan pajak bulan ini: Rp450.000" lengkap penjelasan asal angkanya.

Manfaat bagi pengguna: Tidak perlu menghitung pajak manual, risiko salah hitung yang berakibat denda berkurang jauh.

**Persetujuan Pengeluaran Berjenjang**

Cara kerja: Karyawan mengajukan permintaan dana lewat formulir, atasan sebagai penyetuju menerima notifikasi dan bisa menyetujui/menolak. Begitu disetujui, otomatis masuk buku besar.

Contoh nyata: Staf gudang Pak Hendra mengajukan pembelian alat Rp2 juta; atasan menyetujui dari HP, langsung tercatat tanpa staf menombok uang pribadi.

Manfaat bagi pengguna: Karyawan tidak perlu menalangi uang pribadi, pengeluaran perusahaan tetap terkontrol.

**Skor Keandalan Pemasok**

Cara kerja: Sistem membandingkan tanggal jatuh tempo dengan tanggal pembayaran aktual, dan konsistensi harga barang dari waktu ke waktu, menghasilkan skor 1-5 per pemasok.

Contoh nyata: Usaha percetakan Andi melihat pemasok kertas dapat skor 4/5 karena selalu tepat waktu, pemasok tinta baru cuma skor 2 karena harga naik-turun.

Manfaat bagi pengguna: Punya data objektif untuk bernegosiasi ulang dengan pemasok.

**Stok Barang dan Pengingat Pesan Ulang**

Cara kerja: Sistem menghitung rata-rata penjualan harian dikali lama pengiriman pemasok untuk menentukan kapan harus pesan ulang, lalu memberi notifikasi.

Contoh nyata: Toko sembako Bu Ani dapat notifikasi "waktunya pesan ulang minyak goreng" persis sebelum stok habis.

Manfaat bagi pengguna: Tidak lagi kehabisan barang laris atau menimbun barang jarang laku.

**Dokumen Bisnis Lengkap**

Cara kerja: Pengguna memilih jenis dokumen (penawaran, PO, surat jalan, BAST, kwitansi), mengisi data singkat, sistem menyusun teks resmi format Indonesia siap diekspor PDF.

Contoh nyata: Kontraktor Pak Rudi membuat surat penawaran renovasi, klien setuju, tinggal tekan "lanjut jadi invoice" tanpa mengetik ulang.

Manfaat bagi pengguna: Satu rangkaian dokumen bisnis resmi tanpa mencari template terpisah-pisah.

**Rekonsiliasi Bank Otomatis**

Cara kerja: Sistem terhubung ke rekening bank lewat layanan resmi (Open Banking), otomatis mencocokkan mutasi dengan catatan transaksi yang ada.

Contoh nyata: Pak Anto biasanya habiskan setengah hari mencocokkan mutasi manual; sekarang sistem langsung memberi tahu "ada 3 transaksi belum tercatat".

Manfaat bagi pengguna: Menghemat waktu rekonsiliasi drastis, selisih ketahuan sejak dini.

**Pengingat Utang Piutang Lewat WhatsApp**

Cara kerja: Begitu ada transaksi piutang tercatat, sistem otomatis mengirim pesan pengingat sopan lewat jalur resmi WhatsApp Business mendekati/melewati jatuh tempo.

Contoh nyata: Toko material Bu Wati sungkan menagih; sekarang sistem otomatis kirim "pengingat tagihan Rp500.000 sudah jatuh tempo".

Manfaat bagi pengguna: Tidak perlu menagih langsung yang terasa tidak enak, piutang lebih cepat cair.

**Skor Kesehatan Keuangan**

Cara kerja: Sistem menghitung rasio kas terhadap kewajiban, margin keuntungan bersih, kecepatan piutang cair, digabung jadi satu skor sederhana.

Contoh nyata: Usaha konveksi Rudi dapat skor 72/100 dengan catatan "margin sehat, piutang cair terlalu lambat".

Manfaat bagi pengguna: Tahu posisi kesehatan bisnis tanpa istilah akuntansi rumit, siap jadi bahan pengajuan modal.

**Simulasi dan Pengajuan Pinjaman Modal**

Cara kerja: Berdasarkan data keuangan yang sudah rapi di KLIR Kas, sistem mensimulasikan besaran pinjaman realistis; kalau setuju, diteruskan ke mitra pembiayaan resmi (P2P lending berizin).

Contoh nyata: Usaha laundry Sari butuh modal mesin baru; sistem tunjukkan "pinjaman realistis sekitar Rp15 juta, cicilan Rp1,3 juta/bulan".

Manfaat bagi pengguna: Tidak perlu menyusun ulang laporan keuangan dari nol untuk mengajukan pinjaman.

### Keunggulan Dibandingkan Produk Lain

- Satu-satunya yang menyatukan seluruh siklus keuangan bisnis dalam satu buku besar tunggal, data usaha bisa ditarik langsung untuk proposal/pitch deck di CorPlan, bukan silo terpisah seperti BukuWarung, CrediBook, atau Mekari Jurnal.
- Satu sumber data menyambungkan invoice, pembukuan, dan proyeksi keuangan sekaligus, Paper.id dan sejenisnya berdiri sendiri tanpa penyambungan ini.
- Satu-satunya yang menarik data historis otomatis untuk proyeksi kas, bukan input manual seperti kompetitor global (Runway.com, Jirav, Pry Financials) yang juga tidak menyasar UMKM Indonesia.
- Terintegrasi langsung ke pembukuan untuk perhitungan pajak, bebas input ulang, berbeda dari OnlinePajak atau KlikPajak yang berdiri sendiri.
- Persetujuan pengeluaran terhubung langsung ke pembukuan, sesuatu yang tidak dimiliki Lark Approval atau Mekari Expense.

_Kompetitor/referensi: BukuWarung, CrediBook, Mekari Jurnal, Paper.id, Aspire, HashMicro, AwanTunai, KoinWorks._

## 4.5 KLIR Promo

_Materi Promosi dan Pemasaran dari Data Bisnis. Belum ada kode, pilar baru._

### Latar Belakang

UMKM dituntut membuat video dan materi promosi tiap hari agar tetap terlihat algoritma media sosial, tapi kebanyakan tidak punya tim kreatif dan tidak percaya diri tampil di kamera. Pelaku usaha juga kesulitan menulis deskripsi produk yang menjual, dan teks iklan yang menghasilkan konversi tinggi, sementara alat di pasar (CapCut, Canva, ChatGPT) generik dan tidak terhubung ke data bisnis nyata mereka.

### Visi dan Proposisi Nilai

KLIR Promo menjadi pembuat video promosi instan berbasis teks berbahasa Indonesia yang menarik katalog produk langsung dari CorPlan/KLIR Kas, bukan generator generik tanpa konteks bisnis. Diferensiasi lewat lokalisasi gaya bahasa: preset tone seperti "Skena Jakarta Selatan", "Formal Korporat", atau "Ramah Seller Shopee" yang tidak dimiliki ChatGPT standar maupun pemain lokal kecil.

### Spesifikasi Fitur (10 fitur, semua rencana)

**Video Promosi Berbasis Teks**

Cara kerja: Pengguna memilih produk dari katalog, memilih gaya dan durasi dari template terbatas, sistem mengirim ke layanan pembuat video berbasis AI yang memproses beberapa menit.

Contoh nyata: Usaha kue kering Dewi memilih "Nastar Premium", pilih gaya ceria, dalam beberapa menit dapat video siap unggah ke Instagram.

Manfaat bagi pengguna: Video promosi profesional tanpa biaya videografer atau kemampuan editing.

_PALING MAHAL di seluruh ekosistem, tingkat kesulitan Tinggi._

**Copywriting dan Iklan Bergaya Lokal**

Cara kerja: Pengguna memilih gaya bahasa (santai Jakarta Selatan, formal korporat, ramah seller Shopee), sistem menghasilkan teks menarik detail produk dari katalog.

Contoh nyata: Toko baju Fitri memilih gaya "ramah seller Shopee", dapat caption yang terasa natural, bukan terjemahan kaku ChatGPT umum.

Manfaat bagi pengguna: Diferensiasi lewat gaya bahasa yang terasa lokal, bukan teks generik.

_Paling ringan, cocok dikerjakan duluan buat bukti-konsep cepat._

**Pitch Deck Otomatis dari Business Plan**

Cara kerja: Pengguna menekan tombol ekspor di business plan CorPlan, sistem meringkas jadi sepuluh bagian presentasi baku.

Contoh nyata: Usaha rintisan Bimo yang sudah punya business plan tinggal menekan tombol untuk draf presentasi sepuluh slide.

Manfaat bagi pengguna: Menghemat waktu berhari-hari menyusun presentasi manual.

**Siaran Pesan dan Balasan Otomatis WhatsApp**

Cara kerja: Pengguna mengirim promosi ke daftar pelanggan lewat jalur resmi WhatsApp Business, bisa membalas cepat memakai template jawaban.

Contoh nyata: Toko sepatu Reza mengirim info diskon ke seratus pelanggan sekaligus lewat jalur resmi, tanpa risiko nomor diblokir.

Manfaat bagi pengguna: Promosi massal dan balasan cepat tanpa risiko akun WhatsApp terblokir.

_Menunggu keputusan aktivasi WhatsApp Business resmi, lihat Bagian 6._

**Kartu Nama Digital dan Tautan Bio**

Cara kerja: Pengguna membuat satu halaman ringkas berisi semua tautan penting (toko online, WhatsApp, lokasi) untuk bio Instagram/TikTok.

Contoh nyata: Usaha kopi keliling Yoga taruh satu tautan di bio yang menampilkan menu, lokasi, tombol WhatsApp.

Manfaat bagi pengguna: Satu tautan rapi menggantikan info yang berserakan.

**Katalog Produk Interaktif**

Cara kerja: Sistem membuat halaman katalog publik dari data produk di KLIR Kas, lengkap tombol "Beli lewat WhatsApp".

Contoh nyata: Toko aksesoris Nadia cukup kirim satu tautan katalog lengkap foto dan harga.

Manfaat bagi pengguna: Tidak perlu mengirim foto produk satu-satu tiap ada yang bertanya.

**Kupon dan Program Referral**

Cara kerja: Pengguna membuat kode promo unik atau program "ajak teman dapat diskon", sistem melacak otomatis pemakaian kode.

Contoh nyata: Klinik kecantikan Vina membuat kode "AJAKTEMAN10" dan bisa lihat langsung pelanggan baru dari kode itu.

Manfaat bagi pengguna: Program loyalitas dan referral berjalan otomatis tanpa hitung manual.

**Kumpulan Ulasan Pelanggan**

Cara kerja: Sistem menarik ulasan bintang lima dari Google Maps dan media sosial otomatis, menampilkannya sebagai bukti kepercayaan.

Contoh nyata: Restoran padang Pak Ujang punya banyak ulasan bagus yang selama ini tak terlihat pelanggan baru, sekarang otomatis muncul.

Manfaat bagi pengguna: Bukti kepercayaan pelanggan lama otomatis terlihat calon pelanggan baru.

**Kalender Konten dan Jadwal Posting**

Cara kerja: Pengguna menyiapkan materi promosi sekaligus, menjadwalkan tanggal/jam tayang, sistem otomatis publikasi ke media sosial.

Contoh nyata: Usaha roti Lisa menjadwalkan dua puluh postingan sekaligus di awal bulan.

Manfaat bagi pengguna: Konsistensi posting tanpa harus ingat dan posting manual tiap hari.

_Butuh proses izin resmi Facebook/Instagram yang bisa makan waktu berminggu-minggu, tingkat kesulitan Tinggi._

**Pembuat Banner Promosi Bertema Lokal**

Cara kerja: Pengguna memilih template banner bertema momen lokal (gajian, hari raya, 17 Agustus), memasukkan foto dan harga, sistem menyusun banner siap unduh.

Contoh nyata: Toko elektronik Hendra memilih template "Promo Gajian", dalam semenit banner siap diunggah tanpa belajar aplikasi desain.

Manfaat bagi pengguna: Banner relevan momen lokal Indonesia tersedia instan.

### Keunggulan Dibandingkan Produk Lain

- Satu-satunya yang terhubung ke data produk yang sudah ada di ekosistem untuk pembuatan video, kekosongan pasar nyata karena belum ada pemain Indonesia dominan di kategori ini.
- Preset tone spesifik pasar Indonesia dipadukan konteks bisnis nyata dari CorPlan, kombinasi yang tidak dimiliki ChatGPT umum maupun pemain kecil lokal (Leksa.ai, Ketik.ai, Writeria, CopyLite).

_Kompetitor/referensi: CapCut, Leksa.ai, Ketik.ai, s.id, Desty Page, Selly Keyboard, Mekari Qontak, TADA, Moka Loyalty._

## 4.6 KLIR Kerja

_Manajemen Operasional Tim. Belum ada kode, pilar baru._

### Latar Belakang

Pemilik UMKM yang timnya mulai berkembang tidak bisa melacak siapa mengerjakan apa, dan instruksi kerja sering tenggelam di grup WhatsApp. Untuk staf lapangan, absensi manual, lembur, kasbon, dan slip gaji kerap memicu konflik internal. Ditambah tingkat pergantian karyawan UMKM yang tinggi, membuat pemilik usaha lelah melatih karyawan baru berulang kali.

### Visi dan Proposisi Nilai

KLIR Kerja menjadi papan tugas sederhana yang terhubung ke konteks pilar KLIR lain, tugas bisa langsung mengambil konteks dari percakapan AniVirtual atau data CorPlan, notifikasi di dashboard web bukan lewat WhatsApp. Dipadukan HR ringan yang terintegrasi ke KLIR Kas (biaya gaji otomatis masuk pembukuan), dan panduan kerja berbasis rekaman suara yang diubah jadi dokumen panduan rapi lengkap kuis untuk karyawan baru.

### Spesifikasi Fitur (8 fitur, semua rencana)

**Papan Tugas dan Kolaborasi Tim**

Cara kerja: Siapa pun dengan hak akses membuat tugas baru, menetapkan penanggung jawab dan tenggat, notifikasi muncul di dashboard. Status diperbarui manual.

Contoh nyata: Tim marketing usaha percetakan Toni bisa lihat langsung siapa mengerjakan desain apa dan tenggat kapan tanpa bertanya satu-satu.

Manfaat bagi pengguna: Semua orang tahu status pekerjaan tim tanpa tanya berulang.

_Jadi fondasi pilar ini, dibangun paling dulu._

**Manajemen Kehadiran dan Gaji**

Cara kerja: Karyawan absen lewat HP dengan izin lokasi, sistem membandingkan jarak ke titik kantor. Lembur dihitung otomatis, slip gaji tersusun otomatis.

Contoh nyata: Staf toko roti Mira absen lewat HP, di akhir bulan slip gajinya sudah lengkap dengan perhitungan lembur.

Manfaat bagi pengguna: Perhitungan gaji dan lembur akurat otomatis, mengurangi konflik.

_Tingkat kesulitan Sedang-Tinggi, pakai fitur lokasi bawaan peramban._

**Target Kerja Mingguan dan Bulanan**

Cara kerja: Sistem membaca visi-misi dari CorPlan, mengusulkan tiga sampai lima target praktis, tim mencentang kemajuan tiap minggu.

Contoh nyata: Usaha konveksi Anton dapat usulan target "naikkan penjualan 20 persen kuartal ini" dari business plan-nya.

Manfaat bagi pengguna: Rencana bisnis di CorPlan tidak berhenti jadi dokumen mati.

**Panduan Kerja dan Onboarding Karyawan Baru**

Cara kerja: Pemilik usaha merekam suara instruksi kerja, sistem mengubahnya jadi dokumen panduan tertulis, lalu menghasilkan tiga pertanyaan kuis wajib dijawab karyawan baru.

Contoh nyata: Pemilik kedai kopi Rangga merekam "cara menutup toko dan hitung kasir", karyawan baru langsung baca panduan plus jawab kuis singkat.

Manfaat bagi pengguna: Owner tidak perlu melatih karyawan baru berulang-ulang dari nol.

**Manajemen Cuti, Izin, dan Lembur**

Cara kerja: Karyawan mengajukan cuti/izin lewat aplikasi, atasan menyetujui, catatan otomatis terhubung ke perhitungan gaji bulanan.

Contoh nyata: Karyawan toko fashion Winda mengajukan cuti lewat HP, potongan cutinya otomatis terhitung di slip gaji.

Manfaat bagi pengguna: Proses cuti dan izin transparan dan tercatat rapi.

**Rekrutmen Sederhana**

Cara kerja: Calon karyawan mengisi formulir lamaran lewat halaman karier, lamaran masuk ke papan status (dilamar, wawancara, ditawari, ditolak).

Contoh nyata: Usaha logistik Doni yang biasa terima lamaran berantakan lewat email sekarang punya satu papan rapi.

Manfaat bagi pengguna: Proses rekrutmen tidak lagi kacau di tumpukan email/WhatsApp.

**Notulen Rapat Otomatis**

Cara kerja: Rekaman rapat diubah jadi teks lewat pengenalan suara, AI merangkum poin penting dan daftar tindak lanjut.

Contoh nyata: Rapat mingguan event organizer Sisi biasanya tak ada yang mencatat, sekarang rekaman otomatis jadi ringkasan poin dan penanggung jawab.

Manfaat bagi pengguna: Rapat menghasilkan tindakan nyata yang tercatat.

_Tingkat kesulitan Sedang-Tinggi, butuh layanan pengenal suara plus AI._

**Bagan Organisasi dan Direktori Karyawan**

Cara kerja: Sistem menggambar struktur organisasi otomatis dari data siapa melapor ke siapa, plus pencarian cepat kontak/divisi.

Contoh nyata: Karyawan baru di usaha berkembang Farah bisa langsung lihat siapa atasannya dan divisi mana yang dihubungi.

Manfaat bagi pengguna: Karyawan baru tidak bingung struktur pelaporan saat tim membesar.

### Keunggulan Dibandingkan Produk Lain

- Keterhubungan ke konteks pilar KLIR lain jadi pembeda utama, bukan papan tugas berdiri sendiri seperti Lark, Trello, atau Monday.com yang tidak punya konteks bisnis.
- Biaya gaji otomatis tercatat ke pembukuan usaha, sesuatu yang tidak dimiliki Talenta by Mekari, Hadirr, atau Gadjian.

_Kompetitor/referensi: Lark, Trello, Monday.com, Gadjian, Talenta by Mekari, Hadirr, Mekari Talenta, KitaLulus ATS, GreatDay HR._

## 4.7 KLIR Booking

_Jadwal dan Manajemen Kunjungan Pelanggan. Belum ada kode, pilar paling ringan, berdiri sendiri penuh._

### Latar Belakang

Bisnis jasa seperti salon, klinik, bengkel, atau konsultan kesulitan mengatur jadwal kunjungan pelanggan secara manual, booking sering bentrok, pelanggan lupa jadwal sehingga tidak datang, dan tidak ada cara mudah menjaga pelanggan tetap loyal.

### Visi dan Proposisi Nilai

KLIR Booking menjadi sistem jadwal kunjungan yang lengkap, dari pemesanan slot sampai menjaga pelanggan tetap kembali lewat pengingat dan program loyalitas, berdiri sendiri tanpa bergantung data dari pilar lain, cocok untuk bisnis jasa yang mengandalkan kunjungan terjadwal.

### Spesifikasi Fitur (6 fitur, semua rencana)

**Pemesanan Jadwal Publik**

Cara kerja: Pemilik usaha mengatur jam operasional dan durasi tiap layanan, sistem otomatis membuat slot kosong. Pelanggan membuka halaman publik tanpa akun, memilih slot, mengisi data singkat.

Contoh nyata: Salon Rina mengatur jam buka dan durasi potong rambut 30 menit, pelanggan tinggal buka tautan booking dan pilih jam kosong sendiri.

Manfaat bagi pengguna: Pelanggan bisa booking kapan saja tanpa telepon, jadwal tidak pernah bentrok.

_Jadi fondasi pilar ini, dibangun paling dulu._

**Pengingat Otomatis Multi-Kanal**

Cara kerja: Sistem mengirim pengingat lewat WhatsApp/email pada hari sebelum dan tiga hari sebelum jadwal kunjungan, lewat jalur resmi WhatsApp Business.

Contoh nyata: Klinik kecantikan Dina mengirim pengingat otomatis "jadwal perawatan besok jam 2 siang", angka lupa datang turun drastis.

Manfaat bagi pengguna: Slot yang tadinya terbuang karena pelanggan tidak datang bisa terisi orang lain.

**Antrean Cadangan Otomatis**

Cara kerja: Ketika ada pembatalan mendadak, sistem otomatis menawarkan slot kosong ke pelanggan berikutnya di daftar tunggu.

Contoh nyata: Bengkel motor Yusuf yang jadwalnya penuh mendapat pembatalan mendadak, sistem langsung menawarkan ke daftar tunggu.

Manfaat bagi pengguna: Slot yang batal tidak terbuang percuma.

**Paket Langganan Sesi**

Cara kerja: Pengguna membuat paket berisi beberapa sesi, sistem otomatis mengurangi kuota tiap kali paket dipakai booking, melacak masa berlakunya.

Contoh nyata: Klinik fisioterapi Pak Wawan menjual paket lima sesi terapi; sistem otomatis mengurangi sisa kuota tanpa dicatat manual.

Manfaat bagi pengguna: Pelanggan terikat lebih lama lewat paket.

_Tingkat kesulitan Tinggi (butuh dukungan pembayaran daring)._

**Ulasan dan Penilaian Pasca-Layanan**

Cara kerja: Satu jam setelah sesi selesai, sistem otomatis mengirim formulir penilaian singkat lewat WhatsApp/email.

Contoh nyata: Studio foto Vero mendapat masukan langsung tiap sesi selesai, tahu kualitas layanan sebelum jadi ulasan buruk publik.

Manfaat bagi pengguna: Masalah layanan ketahuan lebih awal, bukan setelah jadi ulasan buruk.

**Poin Loyalitas dan Cashback**

Cara kerja: Setiap transaksi booking dikonversi jadi poin sesuai nilainya, pelanggan bisa menukar poin jadi diskon atau layanan gratis.

Contoh nyata: Pelanggan setia barbershop Rio mengumpulkan poin, setelah sepuluh kali kunjungan dapat potongan gratis otomatis.

Manfaat bagi pengguna: Pelanggan punya alasan konkret untuk kembali lagi.

### Keunggulan Dibandingkan Produk Lain

- Menggabungkan pemesanan, pengingat, paket langganan, dan loyalitas dalam satu sistem, kompetitor seperti Labamu Janji Temu atau Qontak biasanya kuat di satu sisi saja.

_Kompetitor/referensi: Labamu Janji Temu, Qontak, Kluto, Glossify, Majoo, Chope, Loket.com, Pawoon, TADA, Member.id._

# Bagian 5: Urutan Pembangunan Lintas-Pilar

Urutan makro yang disarankan (kombinasi Panduan Realisasi Teknis 16 Agustus):

1\. Fondasi bersama (Bagian 2), 8 langkah, RBAC dua lapis, Sistem Kredit, struktur data inti

2\. CorPlan, sudah berjalan, tinggal disambungkan ke fondasi baru

3\. KLIR Kas fitur Pembukuan (fondasi keuangan seluruh pilar terkait)

4\. Dua sambungan termurah sebagai uji coba pola integrasi: CorPlan -> KLIR Kas, dan CorPlan -> KLIR Promo

5\. AniVirtual fitur keamanan dasar (kunci AI ke server, lalu akses berjenjang 3 peran)

6\. Sambungan AniVirtual -> KLIR Kas

7\. KLIR Kerja fondasi Papan Tugas

8\. Sambungan AniVirtual -> KLIR Kerja, PALING RUMIT, dikerjakan PALING AKHIR

9\. Sisanya (KLIR Promo, KLIR Booking, Repository Hukum) bisa dikerjakan PARALEL karena tidak saling bergantung erat

# Bagian 6: Struktur Dokumen PRD dan Langkah Berikutnya

PRD ekosistem KLIR akan disusun dua tingkat, dibuat lewat platform "ngoding pake ai", supaya tiap bagian bisa diubah secara modular:

- 1 PRD Fondasi Ekosistem, "kontrak/colokan" bersama: fondasi 8 langkah, RBAC dua lapis, Sistem Kredit, struktur data, alur data antar-pilar (persis isi Bagian 2-3 dokumen ini).
- 7 PRD terpisah per pilar, CorPlan, AniVirtual, Repository Hukum, KLIR Kas, KLIR Promo, KLIR Kerja, KLIR Booking. Tiap dokumen detail penuh (latar belakang, visi, spesifikasi fitur, keunggulan) dan WAJIB merujuk balik ke kontrak di PRD Fondasi, bukan menulis ulang aturan akses/kredit sendiri-sendiri.

Langkah teknis berikutnya yang disepakati: menggambar ERD (Entity Relationship Diagram) ekosistem KLIR terlebih dahulu sebagai bagian dari PRD Fondasi, sebelum masuk ke detail per-pilar. CorPlan dan AniVirtual dilanjutkan dari progres yang sudah ada (bukan dibangun ulang dari nol), sementara desain visual (UI) dikerjakan konsisten per-ekosistem.

# Bagian 7: Hal yang Masih Menggantung

Daftar berikut sengaja TIDAK diisi dengan asumsi. Semuanya perlu keputusan atau klarifikasi eksplisit sebelum masuk ke spek final:

- Integrasi WhatsApp Business resmi untuk paket Private: penyedia mana, biaya per pesan, proses persetujuan template, dan verifikasi bisnis belum diputuskan detailnya (arah besarnya sudah jelas, lihat Bagian 8).
- Apakah angka kredit di Bagian 2.3 akan ditampilkan langsung ke pengguna atau dibungkus jadi "satuan bisnis".
- Kapan dan bagaimana skema langganan per-pilar (Bagian 2.4) diaktifkan setelah ekosistem penuh selesai dibangun.
- "AndalAI" (tool workflow-builder yang pernah disebut dalam rapat 12 Agustus 2026), definisinya belum lengkap.
- Nama publik yang dipakai ke klien: "CorPlan" atau "BizPlan AI".
- Lapisan "pengetahuan organisasi" (siapa menjabat apa, budaya komunikasi antar-divisi) yang disebut dalam visi di Bagian 1 masih rencana masa depan. Belum ada model data maupun kepastian masuk fase awal atau ditunda.

# Bagian 8: Pematangan Rencana, Temuan Review 20 Agustus 2026

_Bagian ini adalah hasil review lanjutan atas rencana di Bagian 1 sampai 7, dilakukan setelah draf pertama dokumen ini selesai. Tujuannya menajamkan rencana sebelum dibawa ke tim untuk masukan, bukan menggantikan bagian sebelumnya. Sumbernya tiga tinjauan independen yang difokuskan ke fondasi teknis, integrasi antar-pilar, dan kelayakan fitur untuk pasar UMKM Indonesia, lalu disaring dan diverifikasi silang sebelum dituliskan di sini._

## 8.1 Keputusan yang Perlu Diambil Segera

Enam keputusan berikut memengaruhi banyak bagian sekaligus kalau ditunda, jadi disusun dari yang paling mendesak.

**1\. Data CorPlan: tetap sepenuhnya di perangkat pengguna, atau sebagian boleh tersimpan di server.** CorPlan saat ini menyimpan semua data di perangkat pengguna sebagai nilai jual privasi, tetapi Bagian 3 menjelaskan KLIR Promo perlu membaca katalog produk CorPlan setiap kali dibuka, sesuatu yang sulit dilakukan kalau datanya tidak pernah ada di server sama sekali. Rekomendasi: pisahkan data CorPlan jadi dua kelompok. Data sensitif (proyeksi keuangan, strategi) tetap hanya di perangkat pengguna. Data yang memang untuk dibagikan (katalog produk, ringkasan usaha) boleh disimpan di server per Ruang Kerja, dengan izin eksplisit dari pengguna untuk tiap bagian data. Dengan begitu, integrasi ke AniVirtual, KLIR Kas, dan KLIR Promo bisa jalan tanpa mengorbankan janji privasi untuk data yang paling sensitif.

**2\. Kunci AI AniVirtual masih tersimpan di perangkat pengguna.** Ini bukan pekerjaan yang boleh menunggu giliran di jadwal pembangunan. Kunci yang tersimpan di sisi pengguna bisa diambil siapa saja yang tahu caranya, lalu dipakai memakai jatah biaya kecerdasan buatan milik AniTech tanpa izin. Rekomendasi: pindahkan ke server lebih dulu dari rencana semula, idealnya sebelum AniVirtual masuk demo ke MegaCo sekalipun.

**3\. WhatsApp Business API.** Sudah diputuskan Mecca: paket langganan reguler (Public) memakai obrolan langsung di dalam aplikasi/situs KLIR sendiri yang terhubung langsung ke database, bukan WhatsApp. Paket Private boleh memakai WhatsApp Business API, diatur sesuai kebutuhan dan anggaran klien. Dengan pembagian ini, keputusan detail WhatsApp (penyedia layanan, biaya per pesan, proses persetujuan template, verifikasi bisnis) tidak lagi menghalangi peluncuran paket Public pertama, karena statusnya jadi fitur tambahan berbayar di jalur Private.

_Catatan tambahan: keputusan ini menyelesaikan komunikasi internal seperti di AniVirtual (tim AniTech dengan staf UMKM, dua-duanya sama-sama pengguna KLIR). Tapi untuk KLIR Kas, KLIR Promo, dan KLIR Booking, WhatsApp dipakai UMKM untuk menghubungi PELANGGAN MEREKA SENDIRI (penagihan piutang, promosi, pengingat jadwal), yang bukan pengguna KLIR dan tidak akan membuka aplikasi/situs KLIR untuk mengecek pesan. Obrolan di dalam aplikasi sifatnya menunggu pengguna membuka sendiri, sementara pengingat/promosi perlu langsung sampai tanpa pelanggan harus ingat membuka apa pun. Karena itu tiga pilar ini tetap butuh cara mengirim pesan yang bisa sampai sendiri ke penerima (kandidat: SMS, email, atau notifikasi di halaman publik yang sudah ada seperti halaman pemesanan KLIR Booking) untuk paket Public, terpisah dari keputusan WhatsApp untuk paket Private._

**4\. Kemungkinan dua fitur yang sama tercatat dua kali.** Bagian 4.1 mencantumkan "Pitch Deck Investor (12 Slide)" di CorPlan yang sudah berjalan. Bagian 4.5 mencantumkan "Pitch Deck Otomatis dari Business Plan" di KLIR Promo yang masih rencana. Perlu ditegaskan apakah keduanya memang berbeda (misalnya satu untuk investor, satu untuk materi pemasaran) atau sebenarnya satu fitur yang perlu digabung, supaya dua tim tidak membangun hal yang sama tanpa sadar.

**5\. Batas antara Daftar Periksa Legalitas (CorPlan) dan Repository Hukum.** Usulan pembagian: CorPlan menampilkan daftar umum izin apa saja yang diperlukan, Repository Hukum menyediakan detail dan sumber tiap aturan per sektor usaha.

**6\. Makna "KLIR Booking berdiri sendiri".** Perlu ditegaskan apakah maksudnya cuma tidak bertukar data dengan pilar lain, atau juga tidak perlu ikut fondasi delapan langkah di Bagian 2 (login, langganan, kredit, dan seterusnya). Rekomendasi: tetap wajib ikut fondasi, yang berbeda cuma tidak ada pertukaran data ke pilar lain.

## 8.2 Catatan Teknis untuk Perancangan Basis Data

Sebelum diagram basis data (ERD) digambar, lima hal berikut sebaiknya sudah disepakati karena bentuk tabelnya akan berbeda tergantung keputusannya, dan sulit diubah setelah data produksi mulai terisi:

- Cara menjaga data satu Ruang Kerja tidak tercampur dengan Ruang Kerja lain: dijamin di tingkat basis data, atau hanya mengandalkan setiap query aplikasi menyertakan filter yang benar.
- Data yang "difoto" satu waktu (misalnya anggaran yang dibagikan CorPlan ke KLIR Kas) harus disimpan sebagai salinan tetap yang tidak ikut berubah kalau sumbernya direvisi. Ini berbeda dari data yang memang dibaca langsung tiap saat (misalnya katalog produk di KLIR Promo).
- Riwayat pemakaian kredit sebaiknya berupa catatan yang tidak pernah diubah, hanya ditambah baris baru (termasuk untuk pengembalian kredit kalau ada fitur gagal setelah kredit terpotong).
- Sistem hak akses granular per departemen/dokumen (Bagian 2.2 Lapis 2) perlu bentuk tabel yang jelas sejak awal, termasuk aturan bahwa seseorang tidak bisa memberi akses ke dirinya sendiri.
- Data departemen/struktur organisasi sebaiknya jadi bagian dari fondasi bersama sejak awal, bukan baru muncul belakangan di KLIR Kerja, karena sistem hak akses granular sudah membutuhkan data ini lebih dulu.

Selain itu, dua hal teknis di alur kredit patut diperhatikan: memotong kredit dari beberapa anggota Ruang Kerja yang memakai fitur bersamaan perlu dipastikan tidak membuat saldo menjadi negatif, dan kredit yang sudah terpotong tapi fiturnya gagal dijalankan perlu jalur pengembalian yang jelas.

## 8.3 Urutan Pembangunan yang Disesuaikan

Bagian 5 mengusulkan dua sambungan termurah sebagai uji coba pola integrasi, yaitu CorPlan ke KLIR Kas dan CorPlan ke KLIR Promo. Setelah ditinjau ulang, sambungan ke KLIR Promo sebenarnya yang paling rumit karena bersinggungan langsung dengan keputusan pada 8.1 poin 1 di atas (data CorPlan yang tersimpan di perangkat pengguna). Disarankan uji coba pola integrasi memakai CorPlan ke KLIR Kas dan CorPlan ke AniVirtual dulu, karena keduanya sama-sama memakai pola data "difoto" yang lebih sederhana. Sambungan ke KLIR Promo menyusul setelah keputusan penyimpanan data CorPlan final.

Untuk sambungan AniVirtual ke KLIR Kerja (mendeteksi tugas dari percakapan, ditandai paling berisiko di Bagian 3), disarankan tidak langsung membuat tugas secara otomatis. Sebagai gantinya, kecerdasan buatan menandai kandidat tugas sebagai saran di dalam percakapan yang bisa dikonfirmasi satu ketukan oleh siapa pun yang terlibat, dan saran itu masuk ke kolom "Disarankan" di papan tugas, bukan langsung ke kolom "Perlu Dikerjakan". Cara ini tetap memberi manfaat ke pengguna tanpa mengharuskan kecerdasan buatannya sempurna sejak awal, dan hasil konfirmasi/penolakan penggunanya bisa dipakai mengukur seberapa akurat fitur ini nanti.

Pembangunan Repository Hukum bergantung pada kerja sama dengan tenaga hukum, sesuatu yang butuh waktu di luar kendali tim pengembang. Disarankan proses mencari mitra hukum dan mulai kurasi data dimulai sedini mungkin dan berjalan paralel, bukan menunggu giliran pembangunan teknisnya tiba.

## 8.4 Penyesuaian Cakupan per Pilar untuk Rilis Pertama

Target pengguna KLIR sebagian besar UMKM dengan satu sampai tiga orang, mengandalkan HP, dan berkomunikasi dengan pelanggan mayoritas lewat WhatsApp. Karena itu, fitur yang mengandalkan struktur organisasi berlapis (persetujuan bertingkat, hak akses rinci antar-jabatan, target kerja OKR, notulen rapat, bagan organisasi) baru terasa relevan setelah usaha penggunanya berkembang, bukan untuk gelombang pengguna pertama. Beberapa penyesuaian per pilar:

- CorPlan: empat kalkulator (HPP, CapEx, OpEx, BEP) sebaiknya digabung jadi satu alur berurutan karena hasil satu kalkulator jadi masukan kalkulator berikutnya. Proposal bisnis dan pitch deck sebaiknya berasal dari satu data yang sama, bukan diisi dua kali. Simulator KUR sebaiknya lebih diutamakan dari pitch deck investor, karena KUR jalur pendanaan yang jauh lebih umum dipakai UMKM Indonesia dibanding mencari investor.
- AniVirtual: karena target pengguna kebanyakan satu sampai tiga orang, hak akses berjenjang tiga peran relevansinya lebih rendah dibanding memindahkan kunci kecerdasan buatan ke server, yang sebaiknya jadi syarat wajib sebelum rilis, bukan sejajar dengan fitur lain.
- Repository Hukum: pencarian kode usaha (KBLI) sebaiknya jadi fitur pertama yang dibangun, karena ini yang paling sering dicari pelaku UMKM untuk mengurus NIB, lebih dulu dari regulasi khusus sektor kuliner.
- KLIR Kas: rekonsiliasi bank otomatis dan pengajuan pinjaman langsung ke mitra pembiayaan sebaiknya ditunda dulu (untuk pengajuan pinjaman, cukup sediakan simulasinya dulu, karena penyaluran pinjaman diawasi ketat oleh OJK). Sebaliknya, pencatatan transaksi tunai cepat tanpa struk sebaiknya ditambahkan karena ini kebutuhan harian yang belum masuk daftar fitur.
- KLIR Promo: video promosi berbasis kecerdasan buatan (fitur paling mahal di seluruh ekosistem) dan publikasi otomatis ke Meta (butuh proses izin berminggu-minggu) sebaiknya menyusul belakangan. Copywriting dan banner bertema lokal, yang jauh lebih murah dan dipakai lebih sering, sebaiknya lebih diutamakan.
- KLIR Kerja: sebagai satu kesatuan, pilar ini kandidat kuat untuk menyusul di pembaruan berikutnya (bukan rilis pertama), kecuali fitur absensi dan rekap jam kerja dasar yang tetap relevan begitu pengguna mulai punya satu-dua pekerja.
- KLIR Booking: urutan fitur yang sudah direncanakan di Bagian 4.7 sudah cukup tepat. Tambahan yang perlu dipertimbangkan: kapasitas berbeda per jenis usaha (satu kursi salon berbeda dari dua bay bengkel), dan kemampuan pelanggan mengubah jadwal sendiri tanpa menghubungi pemilik usaha.

## 8.5 Kerangka untuk Demo ke MegaCo

_Prioritas kerja saat ini: menyiapkan demo untuk presentasi ke MegaCo. Fitur-fitur lain tetap akan direalisasikan semua, tapi bertahap seperti pembaruan berkala, bukan sekaligus._

Yang masuk demo (menunjukkan nilai ekosistem, tidak harus siap produksi penuh):

- CorPlan, sebagai pilar paling matang dan siap ditunjukkan.
- AniVirtual dengan lima fitur yang sudah berjalan, dengan syarat kunci kecerdasan buatannya sudah dipindah ke server terlebih dulu.
- Contoh sambungan CorPlan ke AniVirtual lewat tombol Bagikan Konteks Usaha, karena ini pola paling sederhana dan mudah ditunjukkan.
- Halaman Usaha Online dan copywriting dari KLIR Promo, karena hasilnya kelihatan secara visual.
- Gambaran tujuh pilar sebagai visi ekosistem lengkap (boleh berupa rancangan tampilan untuk pilar yang belum ada kodenya), disampaikan dengan jujur sebagai rencana ke depan.

Yang perlu dikerjakan sekarang tapi di belakang layar, sebagai syarat sebelum demo, bukan bagian tampilan demo itu sendiri:

- Keputusan penyimpanan data CorPlan (8.1 poin 1), karena ini menentukan bagaimana contoh sambungan antar-pilar dibangun untuk demo.
- Pemindahan kunci kecerdasan buatan AniVirtual ke server (8.1 poin 2).
- Mulai mencari mitra tenaga hukum untuk Repository Hukum, karena ini butuh waktu paling lama dan sebaiknya tidak menunggu.

Catatan tambahan: dokumen ini belum mencantumkan tanggal presentasi ke MegaCo. Tanggal itu akan menentukan seberapa dalam demo ini bisa disiapkan.

## 8.6 Menuju Materi Promosi: Keunggulan yang Bisa Diangkat

Mecca meminta agar ke depannya, saat mulai membuat materi promosi/iklan, ada daftar jelas fitur atau keunggulan mana yang paling layak diangkat supaya orang memilih KLIR dibanding produk lain. Bagian 4 di dokumen ini sudah memuat keunggulan tiap pilar dibanding kompetitornya masing-masing. Tugas menyusun daftar keunggulan lintas-ekosistem yang paling kuat untuk materi promosi belum dikerjakan di dokumen ini dan perlu jadi pekerjaan tersendiri berikutnya, dengan bahan mentahnya sudah tersedia di keunggulan per-pilar tersebut.

## 8.7 Pola Umum: Versi Ringan untuk Public, Versi Penuh untuk Private

Dari kasus WhatsApp di atas, muncul pola yang bisa dipakai di tempat lain: kalau sebuah integrasi atau fitur memang mahal atau berat secara teknis untuk direalisasikan penuh di paket Public, sediakan versi yang lebih ringan namun tetap memberi manfaat, sementara paket Private bisa mendapat versi penuh sesuai kebutuhan dan anggaran yang disepakati klien. Berikut enam fitur lain yang cocok dengan pola ini, dengan bentuk versi ringannya masing-masing (setiap kasus caranya berbeda, mengikuti sifat masalahnya sendiri):

**Rekonsiliasi bank otomatis (KLIR Kas).** Kenapa berat untuk Public: Butuh integrasi tingkat perbankan, dan belum semua bank Indonesia stabil di layanan Open Banking. Public: pengguna mengunggah mutasi bank secara manual (berkas CSV/PDF), sistem membantu mencocokkan dengan catatan transaksi. Private: bisa disambungkan langsung (live) kalau klien bersedia menanggung biaya integrasinya.

**Pembayaran invoice lewat Xendit/Midtrans (KLIR Kas).** Kenapa berat untuk Public: Proses verifikasi merchant (KYC) di penyedia pembayaran memakan waktu untuk tiap pengguna. Public: memakai satu akun merchant milik AniTech yang dipakai bersama semua Ruang Kerja (pola sub-merchant), pengguna tidak perlu mengurus verifikasi sendiri. Private: boleh memasang akun merchant milik klien sendiri kalau mereka sudah punya atau ingin mengurus sendiri.

**Video promosi berbasis kecerdasan buatan (KLIR Promo).** Kenapa berat untuk Public: Sudah tercatat sebagai fitur paling mahal di seluruh ekosistem. Public: durasi video dibatasi pendek dengan kuota kredit yang ketat. Private: kuota lebih longgar sesuai paket yang dibayar, tanpa perbedaan cara kerja teknis.

**Publikasi otomatis ke Facebook/Instagram (KLIR Promo).** Kenapa berat untuk Public: Proses persetujuan aplikasi dari Meta bisa berminggu-minggu dan bisa ditolak. Public: sistem hanya membuat kontennya dan mengingatkan jadwal, pengguna mengunggah sendiri secara manual. Private: AniTech bisa mengurus persetujuan aplikasi Meta khusus untuk klien yang serius membutuhkan publikasi otomatis penuh.

**Simulasi dan pengajuan pinjaman modal (KLIR Kas).** Kenapa berat untuk Public: Penyaluran pinjaman diawasi ketat oleh OJK, berisiko secara hukum kalau AniTech ikut menjadi perantara penyaluran untuk semua pengguna sekaligus. Public: hanya simulasi angka, tidak ada tombol pengajuan yang tersambung ke pemberi pinjaman mana pun. Private: AniTech bisa menjalin kerja sama resmi dengan satu penyedia P2P lending tertentu, khusus untuk klien yang bersangkutan.

**Fitur berbasis rekam suara: Notulen Rapat Otomatis, Onboarding Suara ke SOP (KLIR Kerja).** Kenapa berat untuk Public: Layanan pengenal suara berkualitas baik dan peringkasan oleh kecerdasan buatan punya biaya per menit rekaman yang cukup besar. Public: durasi rekaman per pemakaian dibatasi pendek. Private: durasi lebih panjang sesuai kuota kredit yang dibayar, sama seperti pola pada video promosi di atas.

Tiga hal berikut sengaja TIDAK dimasukkan ke pola ini karena masalahnya berbeda sifat, bukan soal mahal atau murah:

- Repository Hukum (syarat kerja sama pengacara aktif): ini gerbang kualitas dan tanggung jawab hukum, bukan soal biaya. Tanpa tinjauan pengacara, jangan dirilis ke siapa pun, baik Public maupun Private.
- Lapisan pengetahuan organisasi (AI mengenal struktur dan budaya komunikasi perusahaan): masih rencana masa depan, belum ada model datanya sama sekali. Ini menunggu keputusan cakupan terlebih dahulu, bukan soal pembagian Public-Private.
- KLIR Kerja secara umum di luar dua fitur suara di atas: ini soal urutan prioritas pembangunan (mengikuti Bagian 8.4), bukan soal terlalu mahal untuk Public.

# Penutup

Ekosistem KLIR memiliki tujuh pilar inti dengan total enam puluh lima fitur aktif per 16 Agustus 2026, ditambah pematangan rencana pada 20 Agustus 2026 di Bagian 8. Dokumen ini akan dibawa ke tim, termasuk yang bekerja dari kantor maupun jarak jauh, untuk mendapat masukan sebelum dijadikan dasar penulisan PRD. Penulisan PRD Fondasi dan PRD per-pilar di platform "ngoding pake ai" akan dimulai setelah masukan tim diterima dan Mecca memberi arahan eksplisit untuk melanjutkan, bukan otomatis begitu dokumen ini selesai.