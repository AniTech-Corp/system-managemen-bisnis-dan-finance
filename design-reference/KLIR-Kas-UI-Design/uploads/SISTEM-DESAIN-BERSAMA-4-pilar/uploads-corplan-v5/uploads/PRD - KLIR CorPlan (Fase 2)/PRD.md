# PRD — Project Requirements Document

## 1. Overview

**CorPlan** adalah modul perencanaan bisnis di dalam ekosistem **KLIR** yang membantu pemilik usaha kecil di Indonesia menyusun proposal usaha, menganalisis pasar, dan menghitung kelayakan finansial secara cepat, mudah, dan terintegrasi dalam satu basis data.

Masalah utama yang ingin diselesaikan:
- Pemilik usaha kecil sering kesulitan menyusun proposal bisnis yang rapi dan profesional.
- Proses manual di Word atau meminta bantuan orang lain memakan waktu lama.
- Pemilik usaha tidak yakin apakah perhitungan HPP, BEP, dan proyeksi keuangan yang dibuat sendiri sudah benar.
- Data kompetitor dan tren pasar sulit ditemukan, sehingga proposal kurang meyakinkan saat diajukan ke bank atau calon mitra.
- **Masalah Konsistensi:** Penggunaan alat yang terpisah (AI generik, spreadsheet, template statis) membuat data antar dokumen sering tidak sinkron.

Tujuan utama CorPlan:
- Membuat draft proposal bisnis 6 bab secara otomatis dengan bantuan AI.
- Menyediakan analisis pasar yang transparan, termasuk peringatan jika data terbatas.
- Membantu pengguna menghitung HPP, BEP, dan membandingkan simulasi cicilan KUR.
- **Integrasi Data:** Memastikan profil usaha, analisis pasar, dan angka finansial saling terhubung otomatis ke dalam dokumen proposal.
- Memungkinkan proposal diekspor ke PDF dan Word untuk keperluan pengajuan modal atau presentasi.

**Perbandingan dengan Kompetitor:**
| Fitur | Template Statis / AI Generik | CorPlan (Terintegrasi) |
|---|---|---|
| **Alur Kerja** | Manual & terputus-putus | Otomatis & berkesinambungan |
| **Konsistensi Data** | Rendah (Input ulang berkali-kali) | Tinggi (Satu basis data untuk semua fitur) |
| **Akurasi Finansial** | Seringkali hanya berupa teks karangan AI | Berbasis kalkulasi matematis nyata yang disisipkan ke teks |
| **Riset Pasar** | Pengguna cari sendiri | Otomatis dengan sumber tervalidasi |

---

## 2. Requirements

### 2.1 Persyaratan Fungsional dan Non-Fungsional per Fitur

#### Fase 1: Generate Plan

**Fungsional:**
- **Form Profil Usaha Pusat:** Pengguna memasukkan data inti (Nama, Kategori, Target Pasar, Modal, Deskripsi) yang akan menjadi referensi tunggal bagi fitur lainnya.
- **Generator Proposal 6 Bab:** Sistem menghasilkan draf otomatis berbasis profil.
- **Editor Per Bab:** Kemampuan edit manual dan tombol "Tulis Ulang AI" khusus untuk bab tertentu tanpa merusak bab lain.
- **Riwayat Versi:** Penyimpanan versi tiap bab untuk membandingkan perubahan.
- **Ekspor Dokumen:** Mendukung format PDF dan Word dengan *layouting* profesional.

**Non-Fungsional:**
- Proses generate menggunakan **BullMQ** agar berjalan asinkron; pengguna menerima notifikasi/status saat selesai.
- Konten bab harus konsisten dengan data profil pusat.

#### Fase 2: Market Analysis

**Fungsional:**
- **Analisis Kompetitor Otomatis:** Tabel perbandingan kekuatan/kelemahan berdasarkan kategori dan lokasi dari profil usaha.
- **Riset Tren Pasar:** Poin tren wajib disertai sumber URL valid yang dapat diklik.
- **SWOT & Risiko:** Generator matriks SWOT dan daftar mitigasi risiko.
- **Peringatan Niche:** Indikator eksplisit jika data kompetitor tidak ditemukan (mencegah halusinasi AI).

**Non-Fungsional:**
- Data tren harus diambil secara *real-time* atau melalui *cache* terbaru.
- Sumber URL harus divalidasi formatnya.

#### Fase 3: Financial Simulation

**Fungsional:**
- **Kalkulator HPP & BEP:** Perhitungan otomatis dari input biaya produksi, modal, operasional, dan harga jual.
- **Visualisasi BEP:** Grafik titik impas terhadap volume penjualan.
- **Simulator KUR:** Perbandingan minimal 5 tenor pinjaman sekaligus.
- **Multi-Skenario:** Penyimpanan beberapa simulasi untuk dibandingkan oleh pengguna.

**Non-Fungsional:**
- Perhitungan bersifat deterministik (matematika murni).
- Validasi input untuk mencegah nilai negatif atau pembagian dengan nol.

---

## 3. Core Features & Integration

CorPlan didesain sebagai ekosistem tertutup di mana setiap fitur saling memberi makan data:

### 3.1 Integrasi Data Pusat
- **Profil ke Market Analysis:** Data `category` dan `target_market` dari profil usaha secara otomatis menjadi parameter input untuk riset pasar tanpa input ulang.
- **Financial ke Proposal:** Angka HPP dan BEP dari *Financial Simulation* otomatis ditarik masuk ke dalam Bab 6 (Proyeksi Keuangan). Hal ini memastikan angka di proposal adalah hasil hitungan nyata, bukan teks karangan AI.
- **Market Analysis ke Proposal:** Hasil SWOT dan Tren Pasar otomatis disisipkan ke Bab 3 (Analisis Pasar) untuk memperkuat argumen bisnis.

### 3.2 Rincian Sub-Fitur per Fase

#### Fase 1 — Generate Plan
- **Profil Usaha Pusat:** Entitas data utama pemilik user.
- **AI Draft Generator:** Pembuatan 6 bab secara sekuensial melalui antrian asinkron.
- **Modular Editor:** Kemampuan memanipulasi tiap bab secara independen.
- **Version Control:** Log perubahan teks tiap bab.
- **Document Exporter:** Engine konversi HTML ke PDF/Docx.

#### Fase 2 — Market Analysis
- **Competitor Matcher:** Pencarian pesaing sejenis berdasarkan kategori profil.
- **Verified Trend Finder:** Pencarian tren industri dengan atribusi sumber.
- **Risk & Mitigation Engine:** Pemetaan risiko spesifik industri.
- **Data Integrity Label:** Penanda tingkat kepercayaan data (Data Terbatas vs Data Lengkap).

#### Fase 3 — Financial Simulation
- **HPP/BEP Calculator:** Engine kalkulasi margin dan titik impas.
- **Break-Even Chart:** Visualisasi grafis pertemuan biaya dan pendapatan.
- **KUR Comparison Tool:** Tabel perbandingan bunga dan cicilan bank.
- **Scenario Manager:** Fitur simpan dan muat ulang berbagai skema modal/harga.

---

## 4. User Flow

### Alur Terintegrasi
1. Pengguna mengisi **Profil Usaha**.
2. Pengguna menjalankan **Generate Plan**; sistem membuat draf awal.
3. Pengguna menuju **Market Analysis**; sistem mengambil data profil untuk mencari tren & kompetitor. Hasil analisis otomatis memperbarui Bab 3 di proposal.
4. Pengguna masuk ke **Financial Simulation**; memasukkan angka biaya. Sistem menghitung BEP, lalu otomatis memperbarui Bab 6 di proposal.
5. Pengguna meninjau proposal final yang kini sudah berisi narasi AI, data pasar nyata, dan angka finansial akurat.
6. **Ekspor** ke PDF/Word.

---

## 5. Architecture & Tech Stack

CorPlan menggunakan arsitektur modern untuk menangani beban komputasi AI secara efisien.

### Tech Stack
- **Frontend:** **Next.js** (Deployed di **Vercel**).
- **Backend:** **NestJS** (Deployed di **Railway** atau **Render**).
- **Database:** **PostgreSQL** melalui layanan **Neon** (Serverless Postgres).
- **ORM:** **Prisma** untuk manajemen skema dan *query*.
- **Async Processing:** **Redis (Upstash)** & **BullMQ** untuk mengelola antrian tugas AI (Generate Proposal & Riset Pasar) di background.
- **AI Gateway:** **OpenRouter** (Akses ke GPT-4/Claude/Gemini).
- **Visualisasi:** **Recharts** untuk grafik BEP.
- **Dokumen:** **Puppeteer** (PDF) & **docx** library.

### Antrian BullMQ (Worker Jobs)
- `proposal-gen-job`: Memproses pembuatan 6 bab (Asinkron).
- `market-research-job`: Menjalankan API eksternal untuk tren dan kompetitor.
- `doc-export-job`: Mengelola konversi dokumen besar.

### Rekomendasi Endpoint API

```typescript
// Proposal
POST   /proposals                    // Membuat profil usaha & memicu generate proposal
GET    /proposals/:id                // Mengambil status & konten proposal
PATCH  /proposals/:id/sections/:type // Update manual / tulis ulang satu bab

// Market Analysis
POST   /market-analysis/:profileId   // Memicu 3 job riset pasar paralel
GET    /market-analysis/:profileId   // Mengambil hasil analisis pasar

// Financial Simulation
POST   /simulations/calculate        // Menghitung HPP/BEP secara sinkron
GET    /simulations/:profileId       // Mengambil riwayat skenario simulasi
```

### Daftar Job BullMQ

- `generate-full-proposal`: Membuat draft 6 bab proposal secara asinkron.
- `fetch-competitors`: Mencari dan membandingkan kompetitor berdasarkan kategori/lokasi.
- `fetch-market-trends`: Mengambil tren pasar dari API eksternal dengan validasi sumber.
- `generate-swot-analysis`: Menyusun matriks SWOT dan daftar mitigasi risiko.

---

## 6. Database Schema (Prisma)

```prisma
model User {
  id           String     @id @default(uuid())
  proposals    Proposal[]
  profiles     BusinessProfile[]
  simulations  FinancialSimulation[]
}

model BusinessProfile {
  id             String               @id @default(uuid())
  userId         String
  businessName   String
  category       String
  targetMarket   String
  initialCapital Decimal
  description    String
  user           User                 @relation(fields: [userId], references: [id])
  proposals      Proposal[]
  marketAnalyses MarketAnalysis[]
  simulations    FinancialSimulation[]
}

model Proposal {
  id              String            @id @default(uuid())
  userId          String
  profileId       String?
  businessName    String
  category        String
  targetMarket    String
  initialCapital  Decimal
  description     String
  status          String            // generating, completed, error
  sections        ProposalSection[]
  marketAnalysis  MarketAnalysis?
  user            User              @relation(fields: [userId], references: [id])
  profile         BusinessProfile?  @relation(fields: [profileId], references: [id])
}

model ProposalSection {
  id           String   @id @default(uuid())
  proposalId   String
  sectionType  String   // executive_summary, market_analysis, financial_projection, dll
  content      String   @db.Text
  version      Int      @default(1)
  proposal     Proposal @relation(fields: [proposalId], references: [id])
}

model MarketAnalysis {
  id              String          @id @default(uuid())
  proposalId      String          @unique
  profileId       String?
  competitors     Json
  trends          Json
  swot            Json
  dataLimitation  String?
  proposal        Proposal        @relation(fields: [proposalId], references: [id])
  profile         BusinessProfile? @relation(fields: [profileId], references: [id])
}

model FinancialSimulation {
  id               String          @id @default(uuid())
  userId           String
  proposalId       String?
  profileId        String?
  productionCost   Decimal
  sellingPrice     Decimal
  monthlyOpEx      Decimal
  hpp              Decimal
  bepUnits         Decimal
  bepRupiah        Decimal
  user             User            @relation(fields: [userId], references: [id])
  profile          BusinessProfile? @relation(fields: [profileId], references: [id])
}
```

---

## 7. Skenario Kegagalan dan Penanganannya

| Skenario | Penanganan |
|---|---|
| Timeout AI pada BullMQ | Worker melakukan *retry* otomatis hingga 3 kali sebelum menandai status `error`. |
| Data Niche Kosong | AI dilarang berhalusinasi; sistem menampilkan teks "Data kompetitor tidak ditemukan untuk kategori ini". |
| Inkonsistensi Angka | Jika simulasi finansial diubah, sistem memicu *update* otomatis pada `ProposalSection` tipe `financial_projection`. |
| Kegagalan Redis | Sistem beralih ke mode sinkron terbatas dengan *timeout* singkat dan memberi peringatan pada user. |

---

## 8. Alur Kerja Teknis & Prasyarat

### 8.1 Generate Plan

**Trigger:** Pengguna submit form profil usaha di Frontend (Next.js).

**Alur teknis:**
1. Backend NestJS menerima request, memvalidasi data, lalu menyimpan profil usaha ke tabel `BusinessProfile` melalui Prisma ke PostgreSQL Neon.
2. Backend mendorong job `generate-full-proposal` ke BullMQ di Redis Upstash.
3. Worker BullMQ mengambil job dan memanggil model AI dengan prompt terstruktur untuk menghasilkan 6 bab proposal sekaligus.
4. Hasil AI diparsing dan disimpan per bab ke tabel `proposal_sections` yang terhubung ke proposal induk.
5. Status proposal diperbarui menjadi `completed`.
6. Frontend yang melakukan polling atau menerima update status menampilkan proposal lengkap.

**Prasyarat:**
- Koneksi ke AI provider sudah dikonfigurasi di backend.
- Worker BullMQ aktif berjalan terpisah dari server API utama agar proses generate tidak memblokir request lain.

### 8.2 Market Analysis

**Trigger:** Pengguna membuka halaman Market Analysis.

**Alur teknis:**
1. Backend membaca `category` dan `targetMarket` dari `BusinessProfile` milik pengguna yang sama, sehingga tidak perlu input ulang.
2. Tiga job BullMQ dijalankan secara paralel:
   - `fetch-competitors`
   - `fetch-market-trends`
   - `generate-swot-analysis`
3. Job `fetch-market-trends` memanggil sumber data eksternal seperti Google Trends API atau Search API.
4. Jika data kompetitor/tren tidak ditemukan untuk kategori niche, sistem mengaktifkan fallback dan menandai `dataLimitation`, bukan membuat data palsu.
5. Hasil ketiga job disimpan di tabel `market_analyses` yang terhubung ke `BusinessProfile` dan `Proposal`.
6. Hasil analisis otomatis dapat disisipkan ke Bab 3 (Analisis Pasar) pada proposal terkait.

**Prasyarat:**
- Akses ke API tren eksternal tersedia dan tervalidasi.
- Logika fallback untuk data niche tersedia agar job tidak gagal total saat sumber data kosong.

### 8.3 Financial Simulation

**Trigger:** Pengguna memasukkan input angka (biaya produksi, harga jual, biaya operasional, dan modal) di Frontend.

**Alur teknis:**
1. Backend NestJS menerima input melalui endpoint `POST /simulations/calculate`.
2. Perhitungan HPP dan BEP dilakukan secara sinkron menggunakan rumus matematika murni, tanpa AI dan tanpa antrian.
3. Hasil disimpan ke tabel `financial_simulations` yang terhubung ke `BusinessProfile`.
4. Backend mengembalikan hasil dalam hitungan milidetik untuk ditampilkan di frontend beserta grafik BEP.

**Prasyarat:**
- Validasi DTO di backend untuk mencegah nilai negatif dan pembagian dengan nol.

### 8.4 Integrasi Single Source of Truth (BusinessProfile)

`BusinessProfile` adalah entitas pusat yang direferensikan melalui foreign key oleh `Proposal`, `MarketAnalysis`, dan `FinancialSimulation`. Dengan demikian:

- Market Analysis membaca konteks dari `BusinessProfile` yang sama dengan proposal, sehingga pengguna tidak perlu mengisi ulang kategori dan target pasar.
- Financial Simulation disimpan di bawah `BusinessProfile` yang sama dan menjadi sumber angka finansial yang akurat.
- Begitu Financial Simulation selesai dan menghasilkan nilai HPP/BEP baru, backend otomatis memicu pembaruan narasi bab `financial_projection` pada proposal terkait. Proses ini memanfaatkan mekanisme tulis ulang bab tunggal yang sama seperti fitur "Tulis Ulang AI", tetapi dipicu oleh sistem secara otomatis, bukan oleh klik pengguna.
- Pola yang sama berlaku untuk hasil Market Analysis yang otomatis disisipkan ke bab `market_analysis` pada proposal yang sama.

Dengan satu basis data usaha yang dipakai bersama oleh ketiga fitur, proposal, analisis pasar, dan simulasi keuangan selalu konsisten satu sama lain dan diperbarui otomatis jika salah satu bagian diubah.