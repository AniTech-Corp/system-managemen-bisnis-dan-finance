**CATATAN PENTING: Ini DOKUMEN HIDUP, bukan versi final beku. Struktur, fitur, dan urutan di bawah bisa berubah seiring pengembangan, lihat bagian "Tentang Dokumen Ini" untuk penjelasan.**

_Prinsip penamaan: label peran dan hak akses WAJIB tersedia dalam dua gaya bahasa, versi formal/bisnis dan versi sederhana/santai, idealnya sebagai preferensi yang bisa dipilih pengguna, bukan satu gaya bahasa yang dipaksakan ke semua orang._

| **Paket**     | **Kuota Mingguan**  | **Batas Bulanan**                   | **Catatan**                                                                                                                             |
| ------------- | ------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Free (Gratis) | 100 kredit/hari     | Reset harian                        | Sesuai keputusan fase ini (lihat 2.4), Free tetap dapat akses ke semua pilar. Pembatasannya lewat jumlah kredit, bukan penguncian modul |
| Started       | 2.000 kredit/minggu | Maks 10.000/bulan (dengan cadangan) |                                                                                                                                         |
| Business      | 8.000 kredit/minggu | Maks 46.000/bulan                   |                                                                                                                                         |

_KEPUTUSAN 20 Agustus 2026: fase pengembangan sekarang fokus membangun satu ekosistem yang utuh. Semua paket berbayar mendapat akses ke ketujuh pilar sekaligus. Tidak ada penguncian per-pilar. Perbedaan antar-paket hanya pada kuota kredit (lihat 2.3), bukan pilar mana yang bisa diakses. Skema langganan per-pilar atau per-kombinasi pilar (misalnya beli CorPlan saja, atau CorPlan plus KLIR Kas saja) ditunda ke fase berikutnya, belum dikerjakan sekarang._

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

| **Dari -> Ke**                   | **Kapan Terjadi**                                      | **Data yang Lewat**                                                       | **Yang Perlu Diwaspadai**                                                                                                                   |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| CorPlan -> AniVirtual            | Manual, tombol "Bagikan Konteks Usaha"                 | Ringkasan data usaha (nama, jenis usaha, target pasar), bukan semua data  | Kalau format data berubah, versi lama tetap harus bisa dibaca                                                                               |
| CorPlan -> AniVirtual + KLIR Kas | Bagian dari paket data yang sama                       | Data anggaran per kategori                                                | Data ini "foto" satu waktu tertentu, bukan langsung-hidup, kalau sudah lama, sistem wajib beri peringatan data mungkin tidak akurat         |
| CorPlan -> KLIR Promo            | Tiap kali KLIR Promo dibuka                            | Katalog produk (nama, deskripsi, harga, foto)                             | Kalau produk dihapus di CorPlan, materi promosi lama tetap simpan salinannya sendiri                                                        |
| Repository Hukum -> CorPlan      | Manual, tombol "simpan ke CorPlan"                     | Kode usaha, daftar izin, sumber, tanggal terakhir diperiksa               | Kalau aturan hukum berubah setelah disimpan, data TIDAK otomatis ikut update                                                                |
| AniVirtual -> KLIR Kerja         | Otomatis, begitu ada tugas disepakati dalam percakapan | Judul tugas, deskripsi, penanggung jawab, tautan balik ke percakapan asal | PALING BERISIKO, sistem harus membedakan "obrolan biasa" dari "tugas beneran"; ini soal ketepatan logika AI, bukan sekadar sambungan teknis |
| AniVirtual -> KLIR Kas           | Otomatis, begitu status pengajuan disetujui            | Nominal, kategori, penyetuju, tanggal                                     | Kalau KLIR Kas sedang bermasalah, data persetujuan wajib masuk antrean dan dicoba lagi supaya tidak hilang                                  |
| KLIR Kas -> KLIR Promo           | Tiap kali katalog KLIR Promo dibuka                    | Nama barang, sisa stok, harga                                             | Kalau stok habis saat pelanggan melihat katalog, wajib tampil "stok habis"                                                                  |

_Total 65 fitur aktif di seluruh ekosistem per 16 Agustus 2026. CorPlan dan AniVirtual sudah berjalan sebagian dan TIDAK dibangun ulang dari nol, keduanya dilanjutkan menambah fitur yang masih rencana, sekaligus disambungkan ke Fondasi Platform di Bagian 2 yang belum ada saat fitur-fitur itu pertama kali dibangun sebagai produk berdiri sendiri. Lima pilar lain belum memiliki satu baris kode pun._

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

| **Nama Fitur**                   | **Kegunaan**                                                           | **Status**                           |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------ |
| Pahami Pesan (Penerjemah)        | Menerjemahkan pesan kerja kurang jelas jadi maksud yang mudah dipahami | Sudah berjalan                       |
| Balas Pesan dengan Skenario      | Memberi draf balasan siap pakai untuk permintaan kurang jelas          | Sudah ada versi awal                 |
| Ajuan Kebutuhan (Formulir)       | Menyusun pengajuan pengadaan barang/dana secara terstruktur            | Formulir sudah berjalan              |
| Buat Rencana Kerja atau Roadmap  | Menyusun rencana kerja mingguan/bulanan                                | Sudah berjalan                       |
| Kartu Kenalan dan Memori Pribadi | Menyimpan konteks pribadi (atasan/klien, istilah khusus)               | Sudah berjalan, ditinjau manual dulu |

_Syarat operasional wajib: kerja sama dengan konsultan hukum atau paralegal, ini gerbang, bukan fitur produk. Tanpa tenaga hukum aktif meninjau data secara berkala, jangan rilis hasil terkait hukum ke pengguna._

_Bagian ini adalah hasil review lanjutan atas rencana di Bagian 1 sampai 7, dilakukan setelah draf pertama dokumen ini selesai. Tujuannya menajamkan rencana sebelum dibawa ke tim untuk masukan, bukan menggantikan bagian sebelumnya. Sumbernya tiga tinjauan independen yang difokuskan ke fondasi teknis, integrasi antar-pilar, dan kelayakan fitur untuk pasar UMKM Indonesia, lalu disaring dan diverifikasi silang sebelum dituliskan di sini._

_Prioritas kerja saat ini: menyiapkan demo untuk presentasi ke MegaCo. Fitur-fitur lain tetap akan direalisasikan semua, tapi bertahap seperti pembaruan berkala, bukan sekaligus._

EKOSISTEM KLIR

Skema Private dan Enterprise: Prinsip, Cakupan, dan Model Komersial

Dokumen Internal Produk AniTech

21 Agustus 2026

# Tentang Dokumen Ini

Dokumen ini merangkum skema Private dan Enterprise ekosistem KLIR per 21 Agustus 2026, disusun terpisah dari dokumen konsolidasi versi Publik karena kedua jalur ini berbeda jauh secara komersial maupun teknis. Sumbernya adalah dua rapat internal tim kantor pada malam 21 Agustus 2026, ditambah rujukan silang ke dokumen konsolidasi Publik untuk hal hal yang berlaku sama di kedua jalur.

Sifat dokumen ini: rancangan awal, bukan final. Berbeda dari dokumen Publik yang berisi spesifikasi fitur yang detail dan siap dijadikan dasar penulisan PRD, dokumen ini lebih berupa kerangka prinsip. Alasannya, cakupan Private ditentukan oleh kesepakatan dengan tiap klien secara langsung, jadi tidak ada satu daftar fitur tetap yang berlaku untuk semua klien Private. Dokumen ini disusun sebagai kerangka yang siap diisi rincian begitu ada klien nyata yang bernegosiasi, bukan daftar fitur yang harus segera dibangun semuanya sekaligus.

# Bagian 1: Perbedaan Mendasar Private dari Publik

Paket Publik adalah langganan mandiri yang bisa diakses siapa saja lewat situs atau aplikasi KLIR, dengan harga tetap dan fitur yang sama untuk semua pelanggan pada tingkatan paket yang sama. Paket Private adalah kebalikannya di hampir semua sisi: harga dan cakupan fitur dinegosiasikan langsung dengan tiap klien korporat, bukan angka tetap yang dipublikasikan. Dalam rapat internal disebut secara eksplisit bahwa Private akan berbeda seratus delapan puluh derajat dari Publik, bukan sekadar versi Publik dengan tambahan sedikit fitur.

Klien Private umumnya adalah perusahaan yang ingin sistem KLIR dipasang khusus untuk kebutuhan mereka, dengan kemungkinan penyesuaian tampilan, penambahan fitur khusus, dan integrasi langsung ke sistem internal mereka sendiri. Contoh yang dibahas dalam rapat, sebuah perusahaan telekomunikasi besar bisa meminta tampilan antarmuka diubah sesuai identitas mereka, dan meminta fitur tambahan spesifik di pilar CorPlan, AniVirtual, atau pilar lain, selama ada anggaran yang disediakan untuk itu.

# Bagian 2: Kemampuan yang Hanya Tersedia di Jalur Private

Beberapa kemampuan teknis secara sengaja dibatasi hanya untuk jalur Private karena kompleksitas, biaya, atau risiko yang terlalu tinggi untuk ditawarkan ke seluruh pengguna Publik sekaligus.

Sambungan langsung ke basis data milik klien. Klien Private bisa meminta sistem KLIR dicolokkan langsung ke basis data internal mereka, sehingga tidak perlu mengunggah data secara manual seperti pengguna Publik. Ini memerlukan pekerjaan integrasi khusus per klien dan menjadi salah satu nilai jual utama paket ini.

Integrasi resmi dengan layanan pesan WhatsApp Business. Sudah diputuskan bahwa pengguna Publik wajib berkomunikasi lewat aplikasi atau situs KLIR sendiri, tidak bisa lewat WhatsApp sama sekali, supaya tidak ada kesalahpahaman soal jalur komunikasi mana yang berlaku. Klien Private bebas menyepakati pemasangan WhatsApp Business API sesuai kebutuhan dan anggaran mereka, karena negosiasinya langsung satu lawan satu dengan tim AniTech.

Publikasi otomatis ke media sosial. Fitur mengunggah konten secara otomatis ke Instagram dan TikTok tanpa campur tangan admin manusia, hanya tersedia untuk jalur Private, mengingat keterbatasan izin resmi dari platform media sosial yang bersangkutan untuk otomatisasi penuh di paket Publik.

Fitur pemesanan transaksional penuh. Reservasi kamar, reservasi tiket, dan sistem pemesanan sejenis yang memproses transaksi secara langsung, dipindahkan sepenuhnya ke jalur Private. Paket Publik hanya mendapat fitur kalender sebagai penanda jadwal usaha. Termasuk dalam kemungkinan ini adalah mekanisme uang muka atau deposit lewat gerbang pembayaran, sebagaimana diusulkan dalam evaluasi tim online untuk versi awal, tapi lebih cocok ditempatkan di jalur Private karena fitur pemesanan transaksionalnya sendiri sudah berada di jalur ini.

Kemungkinan membawa kunci akses layanan kecerdasan buatan milik sendiri. Larangan membawa kunci akses sendiri berlaku ketat untuk paket Publik demi keamanan. Untuk klien Private, ini bisa dinegosiasikan secara khusus tergantung kesepakatan dan tingkat kepercayaan yang dibangun dalam kontrak.

Penyesuaian tampilan antarmuka. Klien Private bisa meminta identitas visual sistem disesuaikan dengan merek mereka sendiri, sesuatu yang tidak ditawarkan di paket Publik yang tampilannya seragam untuk semua pengguna.

# Bagian 3: Model Kombinasi Pilar

Paket Private tidak mengharuskan klien mengambil seluruh tujuh pilar ekosistem sekaligus. Klien bisa memilih kombinasi pilar sesuai kebutuhan operasional mereka sendiri, misalnya hanya mengambil dua dari tujuh pilar yang tersedia, atau mengambil seluruhnya kalau memang dibutuhkan. Ini berbeda dari paket Publik yang begitu berlangganan langsung mendapat akses ke seluruh ekosistem sekaligus.

Model kombinasi ini memungkinkan penawaran harga yang proporsional terhadap cakupan yang benar benar dipakai klien, alih alih memaksa klien membayar untuk pilar yang tidak mereka butuhkan.

# Bagian 4: Model Komersial

Harga paket Private tidak dipublikasikan sebagai angka tetap, melainkan berbentuk permintaan penawaran langsung, umum disebut hubungi kami dalam materi pemasaran. Setiap penawaran disesuaikan dengan kombinasi pilar yang dipilih, tingkat penyesuaian fitur yang diminta, dan kompleksitas integrasi ke sistem klien.

Prinsip yang dipegang: semakin banyak permintaan penyesuaian dari klien, semakin tinggi pula biaya yang wajar dibebankan, karena semakin banyak pekerjaan teknis khusus yang harus dikerjakan tim pengembang. Kalau permintaan klien sangat kompleks dan di luar kapasitas tim internal, opsi mempekerjakan tenaga bantuan dari luar untuk sementara turut dipertimbangkan, dengan biaya tambahan itu turut diperhitungkan dalam penawaran ke klien.

Paket Private menjadi salah satu sumber pendapatan tambahan bagi AniTech secara keseluruhan, bukan hanya bagi produk KLIR itu sendiri.

Mekanisme kredit untuk jalur Private belum dirinci sampai penyusunan dokumen ini. Sistem kredit mingguan yang berlaku di paket Publik dirancang khusus untuk model langganan bertarif tetap, sementara jalur Private kemungkinan memerlukan pendekatan berbeda yang menyesuaikan volume pemakaian nyata tiap klien. Ini menjadi salah satu hal yang masih menggantung dan perlu diputuskan sebelum ada klien Private pertama yang benar benar ditandatangani.

# Bagian 5: Tanggung Jawab dan Risiko

Karena jalur Private melibatkan sambungan langsung ke sistem milik klien, muncul pertanyaan tanggung jawab yang tidak muncul di paket Publik. Kalau terjadi kebocoran data pada sistem yang sudah terintegrasi, perlu ada kejelasan lebih dulu apakah penyebabnya berasal dari sisi sistem KLIR atau dari sisi sistem milik klien, sebelum menentukan pihak yang bertanggung jawab. Ini perlu dituangkan secara eksplisit dalam kontrak kerja sama dengan setiap klien Private, bukan diasumsikan begitu saja.

Standar keamanan yang dituntut klien besar untuk jalur Private kemungkinan jauh lebih ketat dibanding kebutuhan standar paket Publik. Setiap permintaan standar keamanan tambahan sebaiknya turut dihitung sebagai bagian dari negosiasi harga, karena pemenuhan standar keamanan yang lebih tinggi memerlukan biaya pengembangan dan pemeliharaan yang lebih besar pula.

# Bagian 6: Hal yang Masih Menggantung

Mekanisme kredit atau tarif pemakaian untuk jalur Private, sebagaimana disebut di Bagian 4, belum dirinci.

Belum ada kontrak baku atau templat perjanjian kerja sama yang siap dipakai untuk klien Private, termasuk klausul tanggung jawab kebocoran data yang disebut di Bagian 5.

Belum ada keputusan apakah AniTech akan membangun tim internal khusus untuk menangani klien Private, atau tetap mengandalkan kombinasi tim inti ditambah tenaga bantuan dari luar sesuai kebutuhan tiap proyek.

Belum ada satu pun klien Private yang sudah menandatangani kerja sama sampai dokumen ini disusun, sehingga seluruh kerangka di atas masih berupa rancangan yang siap diuji begitu ada klien nyata pertama.

# Penutup

Dokumen ini disusun sebagai kerangka prinsip untuk jalur Private dan Enterprise ekosistem KLIR, terpisah dari dokumen konsolidasi versi Publik karena perbedaan model komersial dan teknis yang mendasar di antara keduanya. Dokumen ini akan diisi rincian lebih lanjut begitu ada klien Private pertama yang mulai bernegosiasi, dan sifatnya tetap hidup, bisa diubah sesuai perkembangan kebutuhan bisnis.