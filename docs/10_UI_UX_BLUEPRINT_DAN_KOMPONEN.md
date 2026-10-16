# 🎨 PANDUAN CETAK BIRU UI/UX & SPESIFIKASI KOMPONEN (KLIR OS)

**Dokumen Desain Antarmuka Resmi (UI/UX Blueprint)**  
**Versi**: 1.0 (Agustus 2026)  
**Slogan Resmi**: *"Udah Clear ya"*  
**Tema Desain**: *Obsidian Dark Theme & Linear Glassmorphism*  
**Penerbit**: Tim Produk & Desain Rekayasa Antarmuka AniTech  

---

## 🧭 1. Peta File & Arsitektur Kode Antarmuka (Frontend)

```
src/
├── app/
│   ├── components/
│   │   └── KlirLandingV4.tsx     ➔ [LAPISAN LUAR] Landing Page Publik & Section Pricing
│   ├── globals.css               ➔ [DESAIN TOKENS] Warna Obsidian, Glassmorphism, Glow Border
│   ├── layout.tsx                ➔ [ROOT SHELL] Font Inter / Plus Jakarta Sans, Body Config
│   └── page.tsx                  ➔ [LAPISAN DALAM] Master Dashboard 7 Pilar + State Manager
```

---

## 🎨 2. Standar Desain Sistem (Visual Design Tokens)

Seluruh komponen UI KLIR wajib menggunakan token warna dan aturan visual berikut:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         KLIR DESIGN SYSTEM PALETTE                          │
├───────────────────┬──────────────┬──────────────────────────────────────────┤
│ Token Warna       │ Kode Hex     │ Kegunaan & Penerapan di Komponen         │
├───────────────────┼──────────────┼──────────────────────────────────────────┤
│ Canvas Background │ #08090A      │ Obsidian Canvas (Latar utama aplikasi)   │
│ Surface Panel     │ #0D0E12      │ Sidebar, Header, Modal Popup Container   │
│ Glassmorphic Card │ #15161C/80   │ Kartu modul (Border 1px white/10 blur)   │
│ Primary Glow Blue │ #0058BE      │ Tombol aksi utama, active state, hover   │
│ Cyber Cyan Accent │ #00D2FF      │ Highlight angka, badge, ikon analitik    │
│ Emerald Success   │ #00E676      │ Kas masuk, status lunas, presensi tepat  │
│ Amber Warning     │ #FFAB00      │ Status pending, evaluasi, alert runway   │
│ Crimson Alert     │ #FF5252      │ Kas keluar, terlambat, komplain dini     │
│ Royal Purple      │ #8D55E8      │ Fitur AI, dompet kredit, reward loyalitas│
└───────────────────┴──────────────┴──────────────────────────────────────────┘
```

---

## 🌐 3. LAPISAN LUAR: LANDING PAGE PUBLIK ([`KlirLandingV4.tsx`](file:///c:/Anitech/KLIR/src/app/components/KlirLandingV4.tsx))

Halaman yang dilihat oleh calon pelanggan sebelum login.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. NAVBAR : [Logo KLIR "Udah Clear ya"] | Fitur | Harga | [Quick Demo 1-Klik]│
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. HERO BANNER :                                                            │
│    • Headline : Satu OS Bisnis Terpadu untuk Seluruh Kebutuhan Usaha Anda    │
│    • Sub-text : Kelola proposal, promosi medsos, pembukuan kas, tugas tim,  │
│                 dan booking jadwal dalam satu aplikasi ringan & praktis.     │
│    • CTA Glow : [⚡ Coba Gratis Sekarang (100 Kredit/Hari)]                  │
│    • Interactive Preview: Widget coba langsung copywriting AI tanpa login   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. SHOWCASE 7 PILAR : Kartu interaktif 7 pilar operasional bisnis           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 4. PRICING SECTION (3 PAKET KREDIT) :                                       │
│    ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐     │
│    │ FREE (Rp 0)        │ │ STARTER (Rp 30rb)  │ │ BUSINESS (Rp 100rb)│     │
│    │ • 100 Kredit/Hari  │ │ • 2.000 Kredit/Mgg │ │ • 8.000 Kredit/Mgg │     │
│    │ • Teks & Logika AI │ │ • Copywriting AI   │ │ • Akses Penuh Tim  │     │
│    │ • [No Image/Video] │ │ • Banner & Visual  │ │ • Prioritas Model  │     │
│    └────────────────────┘ └────────────────────┘ └────────────────────┘     │
├─────────────────────────────────────────────────────────────────────────────┤
│ 5. MODAL AUTH : Login Email / Google OAuth / Tombol Demo CEO 1-Klik         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ 4. LAPISAN DALAM: MASTER DASHBOARD 7 PILAR ([`page.tsx`](file:///c:/Anitech/KLIR/src/app/page.tsx))

Tata letak utama setelah pengguna masuk ke dalam aplikasi:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TOPBAR : [Logo] | Workspace Switcher | ⚡ 2.000 Kredit | 🔔 Notif | 👤 Profil│
├──────────────┬──────────────────────────────────────────────────────────────┤
│ SIDEBAR      │ AREA KONTEN UTAMA MODUL (7 PILAR)                            │
│              │                                                              │
│ • CorPlan AI │ ┌─ SUB-TAB HEADER ─────────────────────────────────────────┐ │
│ • AniVirtual │ │ [Judul Fitur]              [Tab 1]  [Tab 2]  [Tab 3]     │ │
│ • KLIR Kas   │ └──────────────────────────────────────────────────────────┘ │
│ • KLIR Promo │                                                              │
│ • KLIR Kerja │ ┌─ WORKSPACE GRID (2 Kolom) ───────────────────────────────┐ │
│ • KLIR Book  │ │ FORM INPUT RINGKAS           │ KARTU PREVIEW OUTPUT      │ │
│ • Workflows  │ │ (Maksimal 2–3 Input +        │ (Visual Glassmorphic +    │ │
│ • Dompet Cr  │ │  Tombol Preset 1-Klik)       │  Tombol 1-Klik Aksi Cepat)│ │
│              │ └──────────────────────────────┴───────────────────────────┘ │
└──────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 📦 5. SPESIFIKASI FORM & KOMPONEN SETIAP PILAR (1 s/d 8)

---

### 📄 5.1 Pilar 1: CorPlan (Perencanaan Bisnis & Modal Cepat)
* **Filosofi UI**: Sederhana, praktis, langsung menghasilkan dokumen rencana usaha formal.
* **Sub-Tab 1: Proposal Usaha Kilat**
  * *Form Input*:
    1. Nama Usaha: `[Input Teks, contoh: Kopi Susu Mantap]`
    2. Modal Awal (Rp): `[Input Angka, contoh: 15.000.000]`
    3. Target Pembeli: `[Input Teks, contoh: Pekerja kantor & mahasiswa]`
  * *Output Card*: Ringkasan Rencana Bisnis 6 Bab + Tombol `📋 Salin Teks` & `📥 Unduh Dokumen`.
* **Sub-Tab 2: Kalkulator HPP & Balik Modal (BEP)**
  * *Form Input*: Biaya Bahan per Porsi/Item, Biaya Tenaga Kerja, Biaya Sewa/Operasional.
  * *Output Card*: HPP per unit, Rekomendasi Harga Jual, Margin %, dan Perkiraan Kapan Balik Modal.
* **Sub-Tab 3: Simulator KUR Bank 6%**
  * *Form Input*: Plafon Pinjaman (Rp) & Tenor (12–60 Bulan).
  * *Output Gauge*: Angsuran Bulanan dengan Bunga Subsidi 6% + Rasio Kelayakan Cicilan.

---

### 🤖 5.2 Pilar 2: AniVirtual (Asisten Konsultasi Bisnis)
* **Filosofi UI**: Obrolan interaktif serasa ngobrol dengan konsultan bisnis pribadi.
* **Sub-Tab 1: Chat Multi-Tone Persona**
  * *Selector Gaya Bahasa*: `☕ Skena Jaksel`, `🤝 Santai Ramah`, `👔 Formal Korporat`, `📈 Mentor Bisnis`.
  * *Chat Window*: Thread obrolan responsif beraksen *streaming text*.
* **Sub-Tab 2: Pengecek Anggaran (*Budget Checker*)**
  * *Form Input*: Rencana Belanja Alat / Renovasi Toko (Rp).
  * *Output Card*: Status Verifikasi (`AMAN`, `PERINGATAN OVERBUDGET`) + Saran Alokasi Dana.

---

### 💰 5.3 Pilar 4: KLIR Kas (Buku Kas & Invoice QRIS)
* **Filosofi UI**: Keuangan bersih tanpa ribet jurnal akuntansi rumit.
* **Sub-Tab 1: Buku Kas Harian**
  * *Form Cepat*: Pilihan Tipe (`Pemasukan / Pengeluaran`), Kategori, Nominal (Rp), Keterangan.
  * *Tabel Real-time*: Daftar transaksi dengan badge hijau (+)/merah (-) & Total Saldo Kas Bersih.
* **Sub-Tab 2: Invoice Digital QRIS**
  * *Form Input*: Nama Pelanggan, Daftar Layanan/Produk, Nominal Tagihan.
  * *Output Preview*: Lembar Tagihan Digital Elegan + Render Kode QRIS Bank Indonesia + Tombol `💬 Kirim Tagihan ke WhatsApp`.
* **Sub-Tab 3: Kalkulator Pajak UMKM 0.5%**
  * *Output Card*: Hitungan otomatis PPh Final PP 55/2022 (Bebas pajak omset di bawah Rp 500jt/tahun).
* **Sub-Tab 4: Runway & Health Score (0–100)**
  * *Output Gauge*: Sisa napas kas bertahan berapa bulan + Rating kesehatan keuangan (*Grade A+, B, C, D*).

---

### 📢 5.4 Pilar 5: KLIR Promo (Pemasaran Medsos & BioLink)
* **Filosofi UI**: Pabrik konten promosi instan siap posting.
* **Sub-Tab 1: Copywriting Multi-Platform**
  * *Form Input*: Nama Produk, Keunggulan, Pilihan Gaya Bahasa.
  * *Output Tabbed Card*:
    1. *Instagram*: Caption persuasif + 10 Hashtag viral.
    2. *TikTok*: Hook pembuka 3 detik + Skrip video singkat.
    3. *WhatsApp*: Template pesan siaran broadcast ramah pelanggan.
  * *Action*: Tombol `📋 1-Klik Salin Teks ke Clipboard`.
* **Sub-Tab 2: Kalender Konten 7 Hari**
  * *Output Grid*: Jadwal posting Senin s/d Minggu dengan ide tema, konsep visual, & jam posting terbaik.
* **Sub-Tab 3: BioLink Toko & Order WhatsApp**
  * *Output*: Simulasi layar HP berlatar gelap elegan dengan tombol `📲 Pesan via WhatsApp` & `Katalog Produk`.

---

### 👥 5.5 Pilar 6: KLIR Kerja (Manajemen Tugas, Absensi, & SOP)
* **Filosofi UI**: Operasional tim rapi, terukur, dan bebas pusing.
* **Sub-Tab 1: Papan Tugas Kanban 3-Kolom**
  * *Kolom*: **Belum Dikerjakan (TODO)**, **Sedang Berjalan (IN_PROGRESS)**, **Selesai (DONE)**.
  * *Aksi*: Tombol tambah tugas cepat & geser status 1-klik.
* **Sub-Tab 2: Presensi Staf Mandiri**
  * *Aksi*: Tombol *Clock-In* jam hadir staf harian + Log jam kehadiran real-time.
* **Sub-Tab 3: Slip Gaji Digital**
  * *Form*: Gaji Pokok + Bonus - Potongan.
  * *Aksi*: Tombol `💳 Bayarkan & Catat ke Buku Kas` (otomatis mengurangi saldo di KLIR Kas).
* **Sub-Tab 4: Voice/Text-to-SOP & Kuis Onboarding**
  * *Input*: Teks/Suara instruksi kerja dari owner.
  * *Output*: SOP baku 4 langkah + **3 Soal Kuis Pilihan Ganda (A/B/C/D)** untuk melatih karyawan baru.

---

### 📅 5.6 Pilar 7: KLIR Booking (Jadwal Reservasi & Antrean)
* **Filosofi UI**: Hapus no-show pelanggan dan antrean toko yang semrawut.
* **Sub-Tab 1: Kalender Jadwal Reservasi**
  * *Form*: Nama Pelanggan, Jam Janji Temu, Jenis Layanan, Nominal DP/Deposit.
  * *Aksi*: Tombol `✓ Selesai Servis` (otomatis mencatat uang masuk ke KLIR Kas).
* **Sub-Tab 2: Antrean Digital Walk-In (A-001)**
  * *Layar Antrean*: Menampilkan nomor tiket yang sedang dilayani (*Currently Serving: A-001*).
  * *Aksi*: Tombol `📢 Panggil / Layani` & `✓ Selesai`.
* **Sub-Tab 3: Pengingat WhatsApp 1-Klik**
  * *Aksi*: Tombol `💬 Buka WhatsApp` yang otomatis mengisi pesan sopan pengingat jadwal ke nomor klien.
* **Sub-Tab 4: Ulasan Rating & Poin Loyalitas**
  * *Output*: Rating Bintang 1–5 + Akumulasi Poin Reward + Deteksi Peringatan Dini jika ada komplain (≤ 2 bintang).

---

### ⚡ 5.7 Pilar 8: Workflows Engine (Integrasi Otomatis Lintas-Pilar)
* **Filosofi UI**: Pusat kendali otomatisasi antar seluruh modul.
* **Simulator Pemicu Event**: Dropdown pilihan event (`BOOKING_COMPLETED`, `PAYROLL_APPROVED`, `LEAD_CAPTURED`, `INVOICE_PAID`).
* **Audit Trail Table**: Tabel riwayat pencatatan log otomatisasi `workflow_logs` lengkap dengan durasi milidetik (ms).

---

## 🛠️ 6. PANDUAN PRAKTIS PEROMBAKAN UI (STEP-BY-STEP DEV GUIDE)

1. **Untuk Merombak Tampilan Luar (Landing Page)**:
   * Buka file: [`src/app/components/KlirLandingV4.tsx`](file:///c:/Anitech/KLIR/src/app/components/KlirLandingV4.tsx).
   * Modifikasi hero title, slogan *"Udah Clear ya"*, dan kartu pricing 3 paket kredit.
2. **Untuk Merombak Tampilan Dalam (Dashboard 7 Pilar)**:
   * Buka file: [`src/app/page.tsx`](file:///c:/Anitech/KLIR/src/app/page.tsx).
   * Cari bagian modul terkait (misal: bagian render CorPlan, Kas, Promo, Kerja, atau Booking) untuk menyesuaikan kolom input, tombol aksi, dan tata letak kartu.
3. **Untuk Mengubah Warna & Efek Glassmorphism**:
   * Buka file: [`src/app/globals.css`](file:///c:/Anitech/KLIR/src/app/globals.css).

---

*Dokumen ini merupakan panduan resmi desain antarmuka (UI/UX Blueprint) untuk seluruh tim pengembang dan perancang antarmuka KLIR OS.*
