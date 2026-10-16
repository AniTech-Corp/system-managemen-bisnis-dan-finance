# Panduan Tes Pagi -- localhost:3000 (8 September 2026)

Buat Mecca. Semua yang ada di sini SUDAH jalan di localhost dengan kode commit lokal
`1efa20f` (belum di-push, belum di-deploy -- nunggu kabar Fatur). Tiap item punya tier bukti:

- `[LOKAL]`  = tsc 0 error + lolos test otomatis (554/554) + gue cek sendiri di localhost
- `[TEST]`   = lolos test otomatis, belum pernah diklik manusia di layar
- `[HIPOTESIS]` = kode ada, belum ada bukti lapangan -- justru ini yang perlu lo coba

Cara mulai: buka `http://localhost:3000`, login pakai akun lo (workspace PT Makan Mania
Mantap yang sudah ada 12 file dummy). CATATAN PENTING: database localhost = database
produksi (Neon yang sama), jadi apa pun yang lo simpan di localhost = data asli workspace lo.

Item yang bertanda `[BAYAR]` memanggil AI/OpenRouter sungguhan dan memotong kredit -- tes
satu kali saja kalau mau jadi bukti.

---------------------------------------------------------------------------------------------
## A. INTEGRASI DATA (yang paling lo keluhkan: "upload tapi gak terintegrasi")
---------------------------------------------------------------------------------------------

A1. AI tahu SEMUA file, bukan cuma 2 terakhir  `[TEST]` -> minta lo buktikan
    Portal mana saja -> AI Assistant -> ketik: "data apa saja yang sudah ada di perusahaan ini?"
    HARAPAN: AI menyebut daftar file Makan Mania (nama + jenis), bukan cuma 1-2 file.
    Lanjut: "berapa total penjualan di laporan penjualan bulanan?" -> AI menjawab dari isi
    file itu (angka dari sheet), bukan "saya tidak punya data".

A2. Upload .zip  `[TEST]`
    Pusat Data (tombol di sidebar) -> upload satu .zip berisi Excel + Word (maks 50 file, 40MB)
    -> status "Diproses" -> klik "Lihat isi": tiap entri muncul dengan header "=== [n/N] nama ===".
    Zip di dalam zip ditolak jujur; gambar di dalam zip cuma didaftar namanya.

A3. Excel format bebas dirangkum  `[TEST]`
    Upload data-inventori-stok.xlsx -> "Lihat isi" -> harus ada ringkasan per sheet:
    header, jumlah baris, total/min/max kolom angka, 25 baris pertama. Isi penuh dimuat
    otomatis saat dibuka (dulu terpotong 1.200 karakter).

A4. Impor Excel/CSV format bebas ke Buku Kas  `[TEST]` (diuji ke file dummy lo sebagai fixture)
    Pusat Data -> laporan-penjualan-bulanan.xlsx ATAU daftar-transaksi-mentah.csv ->
    tombol "Impor ke Buku Kas (deteksi otomatis)" -> panel muncul: kolom terdeteksi
    (tanggal/jumlah/keterangan), confidence, 5 baris sampel, total pemasukan/pengeluaran
    -> centang "saya sudah cek" -> Impor -> buka Finance: angka kas/riwayat transaksi berubah.
    Klik impor kedua kali pada file yang sama -> ditolak "sudah pernah diimpor" (anti-dobel).
    Upload data-inventori-stok.xlsx / data-karyawan-payroll.xlsx / laporan-laba-rugi.xlsx
    -> tombol impor TIDAK muncul atau panel bilang "bukan tabel transaksi kas" + alasan.

A5. Angka lintas divisi  `[LOKAL]` (kode) / `[HIPOTESIS]` (dengan data lo)
    Setelah A4: Dashboard Perusahaan (portal CEO) -> kartu "Perlu Tindakan" menampilkan
    piutang dari invoice ASLI (bukan "PT Contoh Klien Sejahtera"). Kalau tidak ada invoice
    jatuh tempo -> kartu kosong dengan teks jujur, BUKAN alert karangan.

---------------------------------------------------------------------------------------------
## B. VIDEO (yang "sukses di OpenRouter tapi gak muncul")
---------------------------------------------------------------------------------------------

B1. Generate video  `[HIPOTESIS]` `[BAYAR ~$0.76]` -- satu-satunya yang belum pernah dites asli
    Marketing -> Studio Media -> Video -> brief singkat -> Generate.
    HARAPAN: gelembung "sedang dirender... N detik" (bukan diam), lalu 1-3 menit kemudian
    video MUNCUL di gelembung yang sama dan bisa diputar + "Buka / unduh video" jalan.
    Kalau lo tutup panel/tab lalu balik: status tetap ketemu (job tersimpan di tabel VideoJob).
    Kalau gagal: catat jam + brief -> gue cek baris VideoJob + log.

B2. Video orang lain tidak bisa diintip  `[LOKAL]` -- sudah gue buktikan: job asing -> 404.

---------------------------------------------------------------------------------------------
## C. PORTAL EXECUTIVE / CEO
---------------------------------------------------------------------------------------------

C1. Kartu media palsu tidak nempel sembarangan  `[TEST]`
    Chat: "Bagaimana strategi voucher promo bulan lalu?" -> TIDAK muncul kartu voucher CSS palsu.
    Chat: "Buatkan poster promosi produk kita" `[BAYAR gambar]` -> HANYA 1 kartu gambar
    (asli dari server), bukan dua kartu tumpang tindih.
    Kartu "Video promosi 9:16" di grid "Semua kemampuan AI" -> membuka Studio Media video
    asli, bukan kartu video CSS.
    Tombol unduh di kartu simulasi (kalau ada) berlabel "Unduh spesifikasi (.txt)" -- jujur.

C2. Pengaturan CEO  `[TEST]`
    Tab Profil Usaha: isi NIB + Model Bisnis -> Simpan -> F5 -> buka lagi: masih terisi
    (tersimpan server, bukan localStorage).
    Tab AI Brain: pilih model "Gemini 2.5 Flash" + gaya "Diskusi Santai" -> Simpan -> kirim
    1 chat -> (DevTools Network) body brain/chat membawa model:"fast" + tone:"gen-z-casual".
    Berlaku di 3 portal (Finance & Marketing juga, baru diperbaiki komando).
    Opsi "Groq Llama" sudah diganti "Model Ringan (default)" -- jujur, server memang tidak
    punya jalur Groq.
    Tab Ambang Batas / Privasi: ada kotak kuning "preferensi tampilan saja, belum
    mempengaruhi sistem" + toast jujur saat Simpan (bukan "berhasil disimpan!" palsu).

C3. File hasil AI + Skill kustom tidak hilang saat F5  `[TEST]`

C4. Pusat Otorisasi CEO  `[TEST]` (opsional, butuh AI)
    Setujui tiket "hapus profil usaha" -> angka Kas/Omset dashboard TIDAK ikut nol
    (dulu ikut nol untuk semua jenis tiket). Hanya "hapus semua data keuangan" yang menol-kan.

---------------------------------------------------------------------------------------------
## D. PORTAL FINANCE
---------------------------------------------------------------------------------------------

D1. "Generator Invoice Formal" (sidebar Kemampuan AI)  `[TEST]` `[BAYAR chat]`
    Muncul form kecil: nama klien + nominal -> Terbitkan -> chat terkirim eksplisit ->
    kalau AI mengenali, invoice baru muncul di modul Finance > Piutang & Invoice. 1x saja.

D2. "Buat Invoice Baru" di modul Finance (bukan AI)  `[TEST]` -- GRATIS
    Section "Invoice & piutang berjalan" -> tombol biru -> isi klien + item + harga ->
    Terbitkan -> langsung muncul di daftar tanpa refresh. Lalu "Tandai Lunas" pada invoice
    belum lunas -> status PAID + transaksi "Pelunasan Invoice Digital" muncul di riwayat kas.

D3. Tombol "Tagih" invoice OVERDUE -> jadi "Ditandai" dan tetap setelah F5  `[TEST]`

D4. Estimasi pajak bulan ini  `[TEST]` -- GRATIS
    Section "Pajak & Kepatuhan" -> toggle Badan Usaha / Orang Pribadi -> angka PPh Final
    berubah (Orang Pribadi kemungkinan Rp0 kalau omset < Rp500 juta/tahun).
    Komando memperbaiki: omset yang dihitung = BULAN BERJALAN saja (dulu seluruh riwayat
    dikali 12 -> angka pajak bisa berkali lipat).

D5. Pengaturan Keuangan: banner kuning di tiap tab + toast jujur "tersimpan lokal saja".

---------------------------------------------------------------------------------------------
## E. PORTAL MARKETING
---------------------------------------------------------------------------------------------

E1. Pengaturan Marketing -> tab Kanal Iklan: Meta/TikTok Ads tulisan ABU-ABU "Belum
    terhubung" (dulu hijau "Terhubung" padahal tidak ada integrasi). Toast simpan jujur.

E2. Dashboard Marketing -> "Terapkan pemindahan budget" -> F5 -> budget kampanye TETAP
    berubah (tersimpan DB; dulu cuma state lokal).  `[TEST]`

E3. "Tambah kuota" voucher hampir habis -> +50 -> F5 -> tetap +50 (endpoint PATCH baru). `[TEST]`

E4. Sidebar AI Assistant -> tombol baru "Alat Pertumbuhan" (ikon petir, di bawah Brand Kit)
    -> modal 3 tab:
    - Bio-Link: GRATIS, isi nama bisnis + WA -> tombol WA/Maps/IG jalan.  `[TEST]`
    - Kalender Konten (30 kredit) & Copywriting (20 kredit): `[BAYAR]` 1x saja kalau mau.
    Tiga endpoint promo/* ini dulu ADA tapi tanpa tombol sama sekali.

E5. Tombol "Integrasi Meta Ads & TikTok Pixel" -> langsung mendarat di tab Kanal Iklan.

---------------------------------------------------------------------------------------------
## F. DASHBOARD PERUSAHAAN (portal CEO)
---------------------------------------------------------------------------------------------

F1. Kartu "Perlu Tindakan": piutang dari invoice asli, tombol "Kirim pengingat penagihan"
    pakai nomor/email klien asli (disabled jujur kalau kontak kosong).  `[TEST]`
F2. "Rekomendasi Strategis AI": TIDAK ada lagi "Buat PO restock Rp3.200.000" / "Alihkan 3
    tugas" karangan. Kalau margin turun -> 1 kartu peringatan nyata; kalau tidak -> teks jujur.
F3. "Lihat riwayat" peringatan, headcount per divisi, "skor operasional 35/100": semua
    karangan dihapus -> empty-state jujur sampai ada data nyata.

---------------------------------------------------------------------------------------------
## G. YANG SENGAJA BELUM (jujur, bukan disembunyikan)
---------------------------------------------------------------------------------------------

- Layar login menjanjikan "CorPlan" dan "KLIR Schedule/Booking" -> backend ada, UI belum
  ada sama sekali. File login = zona merah Fatur -> keputusan lo + Fatur: sembunyikan kartu
  itu atau bangun UI-nya.
- HR: endpoint kerja/* (absensi, KPI, payroll, SOP, tugas) lengkap tapi belum ada layar.
- Riwayat video/gambar: data VideoJob tersimpan, belum ada galeri.
- Billing/sisa kredit: endpoint ada, belum ada halaman.
- .pptx di DALAM zip cuma didaftar; documents/analyze (Company Data) masih ekstraktor lama.
- Tes video asli (B1) dan render gambar = butuh kredit, belum dijalankan malam ini.

Kalau ada yang gak jalan: sebut NAMA TOMBOL + portal + apa yang muncul. Itu cukup.

---------------------------------------------------------------------------------------------
## TAMBAHAN 8 SEP SIANG -- yang dibangun selagi lo tidur (kode lokal 31480c6, ahead 8, nol push)
---------------------------------------------------------------------------------------------

LANGKAH 0 (WAJIB, ini akar "semua mati" tadi pagi): klik "Keluar Akun" -> masuk lagi. Cookie lama
bawa akun yang sudah dibuat ulang; sesi baru = semua fitur hidup.

H1. Upload BANYAK file sekaligus  `[LOKAL]` (sesi asli user test: 3 file -> 5 record)
    Pusat Data -> pilih 12 file sekaligus -> progres per file -> ringkasan sukses/gagal.
H2. Zip jadi file terpisah  `[LOKAL]`
    Upload .zip -> tiap isi jadi file sendiri "arsip.zip/nama.xlsx" + 1 induk daftar isi.
    Gambar di dalam zip TIDAK di-OCR otomatis (hemat kredit) -- didaftar namanya saja.
H3. Lampiran chat masuk Pusat Data + AI nilai relevan  `[TEST]` (belum diklik lewat UI)
    AI Assistant -> klip -> pilih sampai 6 file -> kirim. Kartu kecil di bawah jawaban:
    hijau "Tersimpan ke Pusat Data" atau kuning "tampaknya tidak terkait -- Hapus / Tetap simpan".
H4. AI jawab VISUAL  `[LOKAL]` (diklik lewat UI sesi asli, screenshot ada)
    Tanya "rangkum data penjualan di file X dalam tabel dan grafik" -> jawaban: peringatan data
    (kalau ada), TABEL rapi, grafik ASCII bar di kotak monospace, "Artinya buat kamu" 2-3 poin.
H5. Tombol lanjutan  `[LOKAL]`
    Di bawah jawaban muncul chip: "Buat slide ringkasan / Buat rekap Excel / Buat laporan Word"
    (atau gambar/video/flashcard sesuai topik) -> klik = buka Studio dengan brief terisi.
    Tidak muncul kalau AI sudah menawarkan satu aksi lain (anti tumpuk tombol).
H6. Deteksi kesalahan data  `[LOKAL]` (CSV dengan tanggal 2026-13-45 KETANGKEP)
    Upload file dengan typo tanggal/nominal -> Pusat Data: badge "N temuan" + panel saran.
    Dashboard CEO "Perlu Tindakan": alert "N file punya kesalahan data" (hanya level perhatian/
    kritis) + tombol "Buka Pusat Data". AI menyebut temuan itu saat menjawab.
H7. Validasi input Buku Kas/Invoice  `[TEST]`
    Buat invoice/transaksi dengan tanggal 5 tahun ke depan atau nominal 0 -> ditolak dengan
    pesan jelas + saran; tanggal bulan lalu tetap diterima.
H8. Dashboard & AI langsung ikut setelah upload/impor/hapus  `[TEST]` (cache dibersihkan + event).
H9. Generate PPT/Word/Excel pakai DATA upload  `[TEST]` -- blok data perusahaan relevan brief
    disuntik + instruksi "kalau data tidak ada bilang belum tersedia, jangan mengarang".

CATATAN JUJUR: angka "runway 99 bulan" / "skor kesehatan 87/100" masih muncul untuk workspace
KOSONG (default context-engine) -- itu bukan data nyata; masuk daftar untuk Fatur/sesi berikutnya.

## TAMBAHAN 8 SEP SORE -- kontrol AI di composer chat (commit d568e9d, merge fc48d88)

Berlaku di 3 portal (CEO, Keuangan, Marketing). Langkah 0 tetap: Keluar Akun lalu masuk lagi.

| # | Yang dites | Cara | Hasil yang benar | Tier |
|---|---|---|---|---|
| H10 | Layout composer satu baris | Buka chat AI | Kiri: klip lampiran + Tanya/Gambar/Video (satu kapsul). Kanan: mic, "Auto . Normal", tombol kirim bulat. Tidak ada baris bertumpuk | [LOKAL] dilihat di CEO |
| H11 | Enter mengirim | Ketik pertanyaan, tekan Enter | Pesan terkirim, input kosong, jawaban muncul, di bawah jawaban ada nama model kecil (mis. openai/gpt-oss-120b) | [LOKAL] |
| H12 | Setelan jawaban | Klik "Auto . Normal" | Panel buka ke atas rata kanan: kotak cari model, daftar model (Auto + katalog OpenRouter dgn kelas biaya), 4 tingkat upaya (Santai/Normal/Serius/Maksimal + perkiraan waktu). Pilih Maksimal -> tombol berubah "Auto . Maksimal"; jawaban berikutnya boleh sampai 1-3 menit | [LOKAL] panel dibuka, daftar terisi |
| H13 | Mode Gambar dari chat | Klik chip Gambar, ketik "buatkan poster promo nasi goreng", Enter | Gambar dibuat memakai model/rasio/kualitas dari Setelan jawaban (bagian Mode Gambar muncul di panel saat chip Gambar aktif) | [TEST] jalur backend diuji test otomatis; render asli belum dicoba sore ini |
| H14 | Mode Video dari chat | Klik chip Video, ketik brief, Enter | Kartu video "pending" lalu di-poll sampai selesai (sekarang termasuk portal Keuangan yang tadinya macet pending) | [TEST] video asli belum dirender (biaya) |
| H15 | Mic | Klik ikon mic | Panel "Rekam suara" (izin mikrofon diminta browser). Rekam -> berhenti -> teks masuk ke kotak ketik. Kalau browser tidak mendukung/izin ditolak, panel bilang jujur | [LOKAL] panel terbuka; rekaman asli belum dicoba (butuh mic fisik) |
| H16 | Slash-command | Ketik "/" di kotak | Menu /gambar /video /audio /ppt /word /excel /flashcard /kuis /deck /model /upaya /mic. Panah atas/bawah + Enter memilih; teks "/" hilang setelah dipilih; /ppt dst memicu pembuatan dokumen yang sudah ada | [LOKAL] /video dipilih via keyboard |
| H17 | Feedback jawaban | Klik "Terlalu rumit" atau "Lebih visual" di bawah jawaban | Toast "Terima kasih..."; jawaban BERIKUTNYA menyesuaikan (lebih sederhana / lebih tabel). Tersimpan per workspace di browser (localStorage) | [LOKAL] tombol tampil; efek ke jawaban berikutnya = [HIPOTESIS] belum diukur |
| H18 | Jawaban mudah dicerna | Tanya apa saja | Kalimat inti dulu, istilah teknis dijelaskan dalam kurung, ditutup "Artinya buat kamu:" + 1 langkah | [LOKAL] jawaban total penjualan: 2 kalimat inti, benar Rp 3.250.000 |

Catatan penting hasil smoke sore:
- Groq tier gratis punya batas 8.000 token/menit per model. Histori panjang sempat bikin 413
  dan jawaban gagal. Sekarang: histori dibatasi 6 pesan x 1.500 karakter di server, dan Groq
  dicoba ulang tanpa histori sebelum pindah provider. Kalau masih gagal, tunggu 1 menit lalu ulang.
- Waktu tunggu klien 90 detik (Maksimal 180 detik). Kalau muncul "Koneksi data terputus",
  tekan "Coba Lagi".


## TAMBAHAN 8 SEP MALAM -- riset dunia nyata, prediksi, lokasi (commit 9b358ad + ac65a13)

| # | Yang dites | Cara | Hasil yang benar | Tier |
|---|---|---|---|---|
| H19 | Riset tren | Tanya: "Kopi apa yang lagi tren di Indonesia, cocok buat warung saya?" | Jawaban memakai data web + kartu "DATA PUBLIK (riset web)" berisi daftar sumber (klik = buka), waktu ambil. Data internal (profil/produk) tetap dipisah dari data publik | [LOKAL] 5 sumber tampil |
| H20 | Prediksi | Tanya: "Bisa buat prediksi bisnis saya 3 bulan ke depan?" (atau 1 bulan / 6 bulan / 1 tahun / kuartal) | Kartu "Prediksi N bulan ke depan": tabel per bulan Pesimis / Dasar / Optimis, asumsi, catatan "data historis belum cukup, indikatif" kalau Buku Kas masih kosong; tombol "Tambah data saya" (target penjualan / perubahan harga / cabang baru) -> dihitung ulang | [LOKAL] kartu tampil di workspace test (kosong -> jujur) |
| H21 | Lokasi + kompetitor | Tanya: "Mau buka cabang baru di Semarang untuk warung nasi goreng, kompetitor di sekitar sana apa?" | Tabel kompetitor nyata dari riset web + disclaimer "harga dari riset web, bukan data internal" + kartu DATA PUBLIK. Kalau kota tidak disebut -> form kecil (nama bisnis, area, radius); hasil: cocok / hati-hati / kurang cocok / tidak cukup data. Google Maps: tanda "belum dikonfigurasi, memakai riset web" | [LOKAL] Semarang: 5 kompetitor + 8 sumber |
| H22 | Slash + tombol | Ketik "/riset", "/kompetitor", "/lokasi", "/prediksi"; atau klik chip "Riset kompetitor" / "Analisis lokasi" / "Buat prediksi" di bawah jawaban | Memicu jalur yang sama seperti mengetik | [LOKAL] chip tampil; /kompetitor dibetulkan supaya tidak nyasar ke form lokasi |

Catatan:
- Riset web maksimal 5x per 10 menit per workspace (jaga kuota Gemini); pertanyaan yang sama dalam 6 jam
  dilayani dari cache. Kalau kuota habis / lambat > 30 detik, kartu bilang jujur "riset web tidak tersedia
  sekarang (...)" dan AI menjawab dari data internal saja.
- Jawaban riset memakan 12-25 detik (Gemini harus mencari dulu). Wajar.
- Kelemahan yang masih ada: untuk workspace kosong, teks AI kadang masih menyebut "runway 99 bulan"
  (angka bawaan mesin konteks, bukan data) -- item terbuka lama, belum disentuh.


## TAMBAHAN 8 SEP MALAM (2) -- tombol Riset + sumber ringkas (commit 38097f6)

| # | Yang dites | Cara | Hasil yang benar | Tier |
|---|---|---|---|---|
| H23 | Tombol Riset (pre-search) | Klik "Riset" di composer (sebelah Video) -> pilih Riset web / Riset kompetitor / Analisis lokasi / Prediksi / Mati | Tombol berubah jadi nama mode (mis. "Riset kompetitor") dan tetap aktif sampai dimatikan. Pertanyaan APA PUN dijawab lewat jalur riset itu tanpa perlu kata kunci | [LOKAL] "Riset kompetitor" + tanya pemain kopi gula aren Jaksel -> jawaban + sumber |
| H24 | Sumber ringkas | Lihat di bawah jawaban riset | Satu baris: ikon bola dunia + "Sumber web . <waktu ambil>" + chip domain (maks 4) + "+N lagi" untuk membuka daftar lengkap. Klik chip = buka tautan. Kalau riset gagal: satu baris kecil "riset web tidak tersedia (...)" | [LOKAL] chip nibble.id terbuka saat diklik |
