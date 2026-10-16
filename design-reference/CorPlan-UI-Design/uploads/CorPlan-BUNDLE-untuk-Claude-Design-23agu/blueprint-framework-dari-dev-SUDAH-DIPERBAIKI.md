# 🎨 PANDUAN CETAK BIRU UI/UX & SPESIFIKASI KOMPONEN (KLIR OS)

**Dokumen Desain Antarmuka Resmi (UI/UX Blueprint) -- Versi 2 Gabungan, khusus PUBLIC**
**Versi**: 2.0 (22 Agustus 2026) -- gabungan struktur dari blueprint dev (v1.0) + token visual dari desain Claude Design yang sudah disetujui (Landing v6, CorPlan v5, AniVirtual v5)
**Slogan Resmi**: *"Udah Clear ya"*
**Tema Desain**: token warna dan gaya visual asli KLIR (biru-emas-hijau di atas navy nyaris hitam), BUKAN palet Obsidian/Glassmorphism di draft v1.0 -- lihat Bagian 2 untuk alasan penggantian.
**Penerbit**: Tim Produk & Desain Rekayasa Antarmuka AniTech
**Cakupan dokumen ini**: KHUSUS PUBLIC. Skema Private/Enterprise dan hal yang berstatus diarsipkan TIDAK dibahas di sini.

---

## PRINSIP PEMBAGIAN KERJA (WAJIB DIPAHAMI SEBELUM BACA LEBIH LANJUT)

Dokumen ini gabungan dua sumber dengan peran yang beda dan TIDAK BOLEH TERTUKAR:

- **Kerangka/framework** (peta file, struktur dashboard, susunan sub-tab, spesifikasi form per fitur) -- ikut BLUEPRINT DARI DEV (Fatcur), dipertahankan apa adanya kecuali ada isi yang bentrok sama keputusan final 21-22 Agustus.
- **Elemen visual, gaya desain, dan filosofi tagline** -- ikut yang SUDAH DIBUAT lewat Claude Design milik Mecca (Landing Page, CorPlan v5, AniVirtual v5, dan elemen-elemen dari generasi lama sebelumnya termasuk versi 7/8). Ini berlaku untuk SEMUA pilar, bukan cuma landing page -- CorPlan dan AniVirtual pun frameworknya ikut dev, tapi visual/UI design-nya tetap dari Claude Design milik Mecca.

Prinsip visual yang wajib dipegang (dari sesi bedah kompetitor Linear/Cicle, 21 Agustus): setiap efek visual (termasuk animasi/elemen 3D) HARUS mendukung dan nyambung ke tagline/makna di sebelahnya -- bukan dekorasi lepas. Kalau satu visual gak ada hubungannya sama tagline yang menemaninya, itu tandanya visualnya salah, bukan taglinenya yang harus diubah untuk menyesuaikan.

**Elemen visual lama yang WAJIB dibawa dan dimatengin (bukan dibuang) ke generasi Claude Design berikutnya:**
- Motif "orbit/nexus" -- titik-titik (node) yang berputar mengorbit dan saling terhubung garis, kesan antariksa/konstelasi. Ditemukan konkret di `klir-nexus.js` (generasi landing sebelum v9/v10/v14). Ini elemen visual paling awal yang menangkap rasa "satu ekosistem saling terhubung" -- filosofi inti KLIR -- jadi harus tetap dimaturkan, bukan hilang begitu versi landing berganti.
- Filosofi tagline per-bagian yang sudah dikuatkan sebelumnya (contoh: bagian "01/RENCANA" nomor urut per-pilar dengan tagline pendek yang tegas), bukan diganti generik.
- Token warna dan elemen dekoratif dari CorPlan v5/AniVirtual v5 (lihat Bagian 2 di bawah).

Landing page yang ada sekarang (versi 10 dan 14 dari zip terbaru) KEMUNGKINAN BESAR tidak dipakai sebagai final -- tapi elemen-elemennya (termasuk motif orbit/nexus di atas) tetap jadi bahan yang dibawa maju, bukan berarti seluruh landing page dirombak dari nol tanpa jejak sebelumnya.

---

## CATATAN PERUBAHAN DARI VERSI 1.0 (dev)

Dokumen ini mempertahankan HAMPIR SEMUA framework/struktur dari blueprint v1.0 (peta file, layout dashboard, susunan sub-tab per pilar, spesifikasi form) -- itu bagian yang sudah bagus dan tidak perlu dibongkar. Yang diganti/ditambal cuma:

1. **Token warna & gaya visual (Bagian 2)** -- diganti total dari palet Obsidian/Glassmorphism buatan sendiri, ke token warna KLIR yang SUDAH disetujui dan sudah dipakai di Landing Page v6, CorPlan v5, dan AniVirtual v5. Alasan: dua sumber ini sebelumnya berjalan di jalur desain berbeda, digabung sekarang biar satu bahasa visual.
2. **WhatsApp dihapus dari semua tombol Public** (Bagian 5.3 KLIR Kas, 5.4 KLIR Promo, 5.6 KLIR Booking) -- diganti kirim/pesan lewat chat dalam aplikasi. WhatsApp tetap ada, tapi cuma di jalur Private (di luar cakupan dokumen ini).
3. **KLIR Booking dipersempit** (Bagian 5.6) -- kolom DP/Deposit dan antrean walk-in dihapus dari Public, cukup kalender jadwal + pencatatan transaksi manual ke KLIR Kas begitu servis selesai.
4. **Program loyalitas dipindah jadi fitur lintas-pilar** (Bagian 5.4 + 5.6), bukan milik satu pilar sendiri.
5. **Status "Workflows Engine" ditandai belum final** (Bagian 5.7) -- statusnya masih perlu dikonfirmasi apakah ini pilar ke-8 resmi atau bagian dari fondasi, jadi ditandai eksplisit di dokumen ini, bukan ditampilkan seolah sudah pasti.
6. **Opsi harga bulanan ditambahkan** (Bagian 3) -- draft v1.0 cuma nunjukkin harga mingguan.

**Catatan verifikasi:** draft v1.0 dari dev sudah dicek ulang secara literal (bukan dari ingatan) untuk "Repository Hukum" dan "bawa kunci API sendiri" -- dua-duanya TIDAK muncul di teks aslinya. Repository Hukum memang sudah tidak dicantumkan dev sejak awal (konsisten sama keputusan arsip), dan BYOK juga tidak dibahas sama sekali (bukan diizinkan, bukan dilarang). Jadi tidak ada yang perlu "dihapus" untuk dua hal itu di dokumen ini -- 6 poin di atas itulah yang benar-benar jadi perubahan.

---

## 🧭 1. Peta File & Arsitektur Kode Antarmuka (Frontend)

*(dipertahankan dari v1.0, tidak berubah)*

```
src/
├── app/
│   ├── components/
│   │   └── KlirLandingV4.tsx     ➔ [LAPISAN LUAR] Landing Page Publik & Section Pricing
│   ├── globals.css               ➔ [DESAIN TOKENS] lihat Bagian 2 versi baru di bawah
│   ├── layout.tsx                ➔ [ROOT SHELL] Font, Body Config
│   └── page.tsx                  ➔ [LAPISAN DALAM] Master Dashboard 7 Pilar + State Manager
```

---

## 🎨 2. Standar Desain Sistem (Visual Design Tokens) -- DIGANTI, ini yang sudah disetujui

Token di bawah ini BUKAN dari draft v1.0 -- ini token yang sudah dipakai dan disetujui di Landing Page v6, CorPlan v5, dan AniVirtual v5. Seluruh komponen UI KLIR wajib pakai token ini, bukan palet Obsidian/cyan/emerald/crimson/purple dari draft sebelumnya.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    KLIR DESIGN SYSTEM PALETTE (DISETUJUI)                   │
├───────────────────┬──────────────┬──────────────────────────────────────────┤
│ Token Warna       │ Kode Hex     │ Kegunaan & Penerapan di Komponen         │
├───────────────────┼──────────────┼──────────────────────────────────────────┤
│ Latar Utama       │ #06080C      │ Navy nyaris hitam, latar utama aplikasi  │
│ Aksen Biru Dasar  │ #0058BE      │ Tombol aksi utama, warna brand inti      │
│ Aksen Biru Terang │ #4E9BFF      │ Glow, highlight, hover, gradasi CTA      │
│ Hijau Status Baik │ #3FBF8F      │ Kas masuk, status lunas, presensi tepat  │
│ Emas Peringatan   │ #D8A33C      │ Status pending, evaluasi, alert, bracket │
│                   │              │ HUD sudut kartu penting                  │
│ Teks Utama        │ #F5F7FA      │ Teks nyaris putih, kontras utama         │
│ Teks Sekunder     │ #8A93A3      │ Abu kebiruan, label/keterangan           │
│ Teks Tersier      │ #5C6474      │ Lebih redup, catatan kecil               │
└───────────────────┴──────────────┴──────────────────────────────────────────┘
```

**Elemen dekoratif wajib konsisten** (dari CorPlan v5 & AniVirtual v5, dipertahankan di semua halaman baru):
- Bracket sudut HUD tipis warna emas di pojok kartu-kartu penting
- Kartu dengan border tipis putih transparan, sudut membulat
- Badge kecil berbentuk pil untuk label status
- Cahaya lembut (glow) di sekitar elemen aksen biru -- INTENSITAS DIREDAM (sesuai revisi CorPlan v5: gradient/glow diturunkan dari 106 jadi 15 elemen per halaman, jangan berlebihan)

**Font**: judul pakai Outfit, isi pakai Plus Jakarta Sans, elemen teknis (kode/angka statistik) pakai font monospace.

**Elemen 3D per-fitur** (pola dari AniVirtual v5, dipakai sebagai referensi kalau modul lain butuh elemen 3D serupa): tiap fitur AI utama boleh punya satu elemen 3D ringan yang mewakili fungsinya (bukan generik) -- maksimal 10 objek animasi per halaman biar tetap ringan terutama di HP.

---

## 🌐 3. LAPISAN LUAR: LANDING PAGE PUBLIK ([`KlirLandingV4.tsx`](file:///c:/Anitech/KLIR/src/app/components/KlirLandingV4.tsx))

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. NAVBAR : [Logo KLIR "Udah Clear ya"] | Fitur | Harga | [Quick Demo 1-Klik]│
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. HERO BANNER :                                                            │
│    • Headline : Satu OS Bisnis Terpadu untuk Seluruh Kebutuhan Usaha Anda    │
│    • Sub-text : Kelola proposal, promosi medsos, pembukuan kas, tugas tim,  │
│                 dan jadwal usaha dalam satu aplikasi ringan & praktis.       │
│    • CTA Glow : [⚡ Coba Gratis Sekarang (100 Kredit/Hari)]                  │
│    • Interactive Preview: Widget coba langsung copywriting AI tanpa login   │
│    • Latar Hero: motif orbit/nexus (titik-titik saling terhubung garis,    │
│      lihat Bagian Prinsip Pembagian Kerja di atas) sebagai visual utama    │
│      di belakang headline -- merepresentasikan "satu ekosistem yang       │
│      saling terhubung", tagline harus ditulis berdekatan dan nyambung     │
│      makna sama visual ini, bukan cuma dekorasi lepas                     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. SHOWCASE PILAR : Kartu interaktif pilar operasional bisnis (Public)      │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. PRICING SECTION (3 PAKET, MINGGUAN + BULANAN) :                          │
│    ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐     │
│    │ FREE (Rp 0)        │ │ STARTER            │ │ BUSINESS           │     │
│    │ • 100 Kredit/Hari  │ │ • Rp 30rb/minggu   │ │ • Rp 100rb/minggu  │     │
│    │ • Teks & Logika AI │ │   atau Rp 100rb/   │ │   atau Rp 300rb/   │     │
│    │ • [No Image/Video] │ │   bulan (bonus     │ │   bulan (bonus     │     │
│    │                    │ │   kredit)          │ │   kredit)          │     │
│    │                    │ │ • 2.000 Kredit/Mgg │ │ • 8.000 Kredit/Mgg │     │
│    │                    │ │ • Copywriting AI   │ │ • Akses Penuh Tim  │     │
│    │                    │ │ • Banner & Visual  │ │ • Prioritas Model  │     │
│    └────────────────────┘ └────────────────────┘ └────────────────────┘     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. MODAL AUTH : Login Email / Google OAuth / Tombol Demo CEO 1-Klik         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ 4. LAPISAN DALAM: MASTER DASHBOARD (Public) ([`page.tsx`](file:///c:/Anitech/KLIR/src/app/page.tsx))

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR : [Logo] | Workspace Switcher | ⚡ 2.000 Kredit | 🔔 Notif | 👤 Profil│
├──────────────┬──────────────────────────────────────────────────────────────┤
│ SIDEBAR      │ AREA KONTEN UTAMA MODUL                                      │
│              │                                                              │
│ • CorPlan AI │ ┌─ SUB-TAB HEADER ─────────────────────────────────────────┐ │
│ • AniVirtual │ │ [Judul Fitur]              [Tab 1]  [Tab 2]  [Tab 3]     │ │
│ • KLIR Kas   │ └──────────────────────────────────────────────────────────┘ │
│ • KLIR Promo │                                                              │
│ • KLIR Kerja │ ┌─ WORKSPACE GRID (2 Kolom) ───────────────────────────────┐ │
│ • KLIR Book  │ │ FORM INPUT RINGKAS           │ KARTU PREVIEW OUTPUT      │ │
│ • Dompet Cr  │ │ (Maksimal 2–3 Input +        │ (Visual + Tombol 1-Klik   │ │
│              │ │  Tombol Preset 1-Klik)       │  Aksi Cepat)              │ │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

Catatan: "Workflows Engine" TIDAK dicantumkan di sidebar versi ini -- lihat Bagian 5.7.

---

## 📦 5. SPESIFIKASI FORM & KOMPONEN SETIAP PILAR (PUBLIC)

---

### 📄 5.1 Pilar: CorPlan (Perencanaan Bisnis & Modal Cepat)

*(dipertahankan dari v1.0 -- sudah konsisten, fitur legalitas SUDAH TIDAK ADA di sini, sesuai keputusan arsip Repository Hukum)*

* **Filosofi UI**: Sederhana, praktis, langsung menghasilkan dokumen rencana usaha formal.
* **Sub-Tab 1: Proposal Usaha Kilat**
  * *Form Input*: Nama Usaha, Modal Awal (Rp), Target Pembeli.
  * *Output Card*: Ringkasan Rencana Bisnis 6 Bab + Tombol `Salin Teks` & `Unduh Dokumen`.
* **Sub-Tab 2: Kalkulator HPP & Balik Modal (BEP)**
  * *Form Input*: Biaya Bahan per Porsi/Item, Biaya Tenaga Kerja, Biaya Sewa/Operasional.
  * *Output Card*: HPP per unit, Rekomendasi Harga Jual, Margin %, Perkiraan Balik Modal.
* **Sub-Tab 3: Simulator KUR Bank**
  * *Form Input*: Plafon Pinjaman (Rp) & Tenor (12–60 Bulan).
  * *Output Gauge*: Angsuran Bulanan + Rasio Kelayakan Cicilan.

---

### 🤖 5.2 Pilar: AniVirtual (Asisten Konsultasi Bisnis)

*(dipertahankan dari v1.0)*

* **Filosofi UI**: Obrolan interaktif serasa ngobrol dengan konsultan bisnis pribadi.
* **Sub-Tab 1: Chat Multi-Tone Persona**
  * *Selector Gaya Bahasa*: Skena Jaksel, Santai Ramah, Formal Korporat, Mentor Bisnis.
  * *Chat Window*: Thread obrolan responsif, *streaming text*.
* **Sub-Tab 2: Pengecek Anggaran (*Budget Checker*)**
  * *Form Input*: Rencana Belanja Alat / Renovasi Toko (Rp).
  * *Output Card*: Status Verifikasi (AMAN / PERINGATAN OVERBUDGET) + Saran Alokasi Dana.

---

### 💰 5.3 Pilar: KLIR Kas (Buku Kas & Invoice QRIS) -- diperbaiki, WhatsApp dihapus

* **Filosofi UI**: Keuangan bersih tanpa ribet jurnal akuntansi rumit.
* **Sub-Tab 1: Buku Kas Harian**
  * *Form Cepat*: Tipe (Pemasukan/Pengeluaran), Kategori, Nominal (Rp), Keterangan.
  * *Tabel Real-time*: Daftar transaksi + badge hijau (+)/merah (-) & Total Saldo Kas Bersih.
* **Sub-Tab 2: Invoice Digital QRIS**
  * *Form Input*: Nama Pelanggan, Daftar Layanan/Produk, Nominal Tagihan.
  * *Output Preview*: Lembar Tagihan Digital + Render Kode QRIS Bank Indonesia + Tombol `Kirim Tagihan lewat Chat Dalam Aplikasi` (BUKAN WhatsApp -- WhatsApp cuma tersedia di paket Private, di luar cakupan dokumen ini).
* **Sub-Tab 3: Kalkulator Pajak UMKM**
  * *Output Card*: Hitungan otomatis PPh Final PP 55/2022.
* **Sub-Tab 4: Runway & Health Score (0–100)**
  * *Output Gauge*: Sisa napas kas bertahan berapa bulan + Rating kesehatan keuangan.

---

### 📢 5.4 Pilar: KLIR Promo (Pemasaran Medsos & BioLink) -- diperbaiki, WhatsApp & loyalitas disesuaikan

* **Filosofi UI**: Pabrik konten promosi instan siap posting.
* **Sub-Tab 1: Copywriting Multi-Platform**
  * *Form Input*: Nama Produk, Keunggulan, Pilihan Gaya Bahasa.
  * *Output Tabbed Card*: Instagram (caption + hashtag), TikTok (hook + skrip singkat), Template pesan siaran untuk dikirim lewat chat dalam aplikasi (bukan broadcast WhatsApp langsung -- itu jalur Private).
  * *Action*: Tombol `1-Klik Salin Teks ke Clipboard`.
* **Sub-Tab 2: Kalender Konten 7 Hari**
  * *Output Grid*: Jadwal posting Senin s/d Minggu dengan ide tema, konsep visual, jam posting terbaik.
* **Sub-Tab 3: BioLink Toko**
  * *Output*: Simulasi layar HP dengan tombol `Pesan lewat Chat Dalam Aplikasi` & `Katalog Produk` (bukan tombol WhatsApp langsung).
* **Sub-Tab 4 (BARU): Poin Loyalitas Lintas Pilar**
  * Menampilkan akumulasi poin pelanggan yang terhubung dengan transaksi di KLIR Kas dan kunjungan di KLIR Booking -- satu sistem poin, bukan poin terpisah per pilar. *(sebelumnya di draft v1.0 ini keliru diletakkan cuma di dalam KLIR Booking)*

---

### 👥 5.5 Pilar: KLIR Kerja (Manajemen Tugas, Absensi, & SOP)

*(dipertahankan dari v1.0)*

* **Filosofi UI**: Operasional tim rapi, terukur, dan bebas pusing.
* **Sub-Tab 1: Papan Tugas Kanban 3-Kolom** -- Belum Dikerjakan / Sedang Berjalan / Selesai.
* **Sub-Tab 2: Presensi Staf Mandiri** -- Clock-In + log kehadiran real-time.
* **Sub-Tab 3: Slip Gaji Digital** -- Gaji Pokok + Bonus - Potongan, termasuk perhitungan otomatis PPh 21 karyawan, tombol `Bayarkan & Catat ke Buku Kas`.
* **Sub-Tab 4: Voice/Text-to-SOP & Kuis Onboarding** -- input instruksi kerja, output SOP 4 langkah + 3 soal kuis pilihan ganda.

---

### 📅 5.6 Pilar: KLIR Booking (Penjadwalan) -- dipersempit sesuai keputusan Meeting 2

* **Filosofi UI**: Kalender penanda jadwal usaha, BUKAN sistem pemesanan transaksional penuh (itu jalur Private).
* **Sub-Tab 1: Kalender Jadwal**
  * *Form*: Nama Pelanggan, Jam Janji Temu, Jenis Layanan.
  * *Aksi*: Tombol `Selesai Servis` yang membuka form pencatatan transaksi MANUAL ke KLIR Kas (owner isi nominal sendiri saat servis selesai) -- BUKAN pembayaran DP/deposit di muka lewat payment gateway, itu fitur Private.
* **Sub-Tab 2: Pengingat Jadwal**
  * *Aksi*: Tombol `Kirim Pengingat lewat Chat Dalam Aplikasi` (bukan WhatsApp).
* **Sub-Tab 3: Ulasan Rating**
  * *Output*: Rating Bintang 1–5 + Deteksi Peringatan Dini jika ada komplain (≤ 2 bintang). Poin loyalitas TIDAK lagi di sini, lihat 5.4 Sub-Tab 4 (lintas pilar).

**Yang DIHAPUS dari draft v1.0 karena masuk cakupan Private**: kolom Nominal DP/Deposit, Antrean Digital Walk-In dengan nomor tiket (ini fitur operasional yang lebih kompleks, dipertimbangkan lagi kalau ada permintaan pasar jelas).

---

### ⚡ 5.7 "Workflows Engine" -- STATUS BELUM FINAL, jangan ditampilkan sebagai pilar resmi dulu

Item ini muncul di draft v1.0 sebagai Pilar 8 resmi. Statusnya SAAT INI belum dikonfirmasi -- apakah ini pilar terpisah, atau bagian dari lapisan fondasi yang dipecah jadi baris sendiri. Sampai ada kejelasan, item ini TIDAK dicantumkan di sidebar dashboard Public (lihat Bagian 4), dan tidak boleh ditampilkan ke pengguna sebagai modul yang bisa dipakai.

---

## 🛠️ 6. PANDUAN PRAKTIS PEROMBAKAN UI (STEP-BY-STEP DEV GUIDE)

*(dipertahankan dari v1.0)*

1. **Untuk Merombak Tampilan Luar (Landing Page)**: buka `KlirLandingV4.tsx`, modifikasi hero title, slogan, dan kartu pricing.
2. **Untuk Merombak Tampilan Dalam (Dashboard)**: buka `page.tsx`, cari bagian modul terkait.
3. **Untuk Mengubah Warna & Efek**: buka `globals.css`, pakai token di Bagian 2 versi baru dokumen ini.

---

*Dokumen ini merupakan panduan resmi desain antarmuka (UI/UX Blueprint) versi gabungan untuk seluruh tim pengembang dan perancang antarmuka KLIR OS, khusus cakupan Public. Rancangan sengaja disusun modular per pilar supaya elemen bisa dibongkar-pasang saat diintegrasikan ke repository, terutama setelah ada hasil generate baru dari Claude Design.*
