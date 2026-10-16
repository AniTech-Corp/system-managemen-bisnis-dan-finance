# 2026-09-13 — MASTER BLUEPRINT & HANDOFF SESI BARU (KLIR UTAMA)
# ENSIKLOPEDI ARSITEKTUR, PANDUAN LIVE DEMO, DAN ROADMAP PENYEMPURNAAN LANJUTAN

> **Target Codebase:** `KLIR/02-KLIR-PUBLIC-PRIVATE/2026-09-01-github-push-workspace/klir-repo-clone`  
> **Status Verifikasi:** [PASS] `npx tsc --noEmit` 0 errors | 51/51 Unit Tests PASS (100%) | Next.js 16.3.1 Turbopack 94/94 Routes Build Berhasil.  
> **Lane Fatur:** 100% ZERO-TOUCH & Pristine (Database migrations, PostgreSQL schema, auth core JWT, session).  
> **Baseline Eksekusi:** Pagi Hari 13 September 2026 (WIB).  
> **Penulis:** Antigravity Prime (Pair Programmer Mecca / AniTech)  

---

## 1. EXECUTIVE RECAPITULATION (WHAT HAS BEEN SOLIDIFIED & VERIFIED)

Sesi maraton sebelumnya telah menyelesaikan fondasi arsitektur terlengkap sepanjang sejarah repositori KLIR:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                STATUS CAPAIAN UTAMA                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. 6-Role Parity Complete      : CEO, Finance, Marketing, Sekretaris, Mgr Umum, Mgr Op │
│ 2. 3-Mode Tab Switcher         : [ Modul Utama ] | [ Grafik & Visual ] | [ Mind Map ]  │
│ 3. Preservation of Legacy Core : CompanyDataDashboard, FinanceModule, MarketingModule  │
│                                  100% UTUH sebagai default view [ Modul Utama ].        │
│ 4. Dual-Mode Benchmark Engine  : Localhost Unseeded Preview vs Production Real Data.   │
│ 5. Inline Cognitive Panels     : 6 Pilar "Ini Maksudnya Apa?" di seluruh metrik.       │
│ 6. Interactive Visual Hooks    : What-If Slider, Cash Drawer POS, Conversion Funnel,   │
│                                  Expiry Tracker, Anti-Fraud Receiving Audit.           │
│ 7. Workspace Data Hub Modal    : Terintegrasi langsung di header/footer dashboard.     │
│ 8. Deterministic Weekly Brain  : Interceptor analisis 7-hari di /api/v1/brain/chat.    │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Matriks Pengujian & Verifikasi Mutu:
- **TypeScript Strict Mode:** `npx tsc --noEmit` lulus dengan **0 errors**.
- **Unit Test Coverage:** 51 tests lulus 100% pada 6 suite:
  1. `tests/role-dashboard-visuals.test.ts` (7/7 tests) — Verifikasi 6 body view & kamus kognitif 6-pilar.
  2. `tests/role-dashboard-route.test.ts` (8/8 tests) — Verifikasi otorisasi endpoint `/api/v1/dashboard/role` & kelengkapan kartu.
  3. `tests/role-dashboard-language.test.ts` (3/3 tests) — Verifikasi kamus jargon istilah operasional bahasa manusia.
  4. `tests/role-policy.test.ts` (4/4 tests) — Verifikasi fail-closed policy role baru & proteksi capability.
  5. `tests/dashboard-insight-role-route.test.ts` (2/2 tests) — Verifikasi penolakan akses lintas role pada insight engine.
  6. `tests/backend-extensions.test.ts` (7/7 tests) — Verifikasi DELETE workspace file, kalkulator pajak, & analisis mingguan.
- **Production Build Check:** `npm run build` Next.js 16.3.1 (Turbopack) sukses mengompilasi 94 routes statis dan dinamis dalam 6,1 detik.

---

## 2. PANDUAN LIVE AUDIT & DEMO SHOWROOM (PAGI HARI 13 SEPT 2026)

Ketika Mas Mecca atau tim membuka browser di `http://localhost:3000` pada pagi hari, ikuti langkah-langkah audit interaktif berikut:

### 2.1 Akun Login Pengujian (Semua Password: `123456`)
- **CEO / Owner:** `ceo@anitech.dev` (atau username `ceo`)
- **Finance Lead:** `finance@anitech.dev` (atau username `finance`)
- **Marketing Lead:** `marketing@anitech.dev` (atau username `marketing`)
- **Sekretaris Eksekutif:** `sekretaris@anitech.dev` (atau username `sekretaris`)
- **Manager Umum (Cabang/Tim):** `manager@anitech.dev` (atau username `manager`)
- **Manager Operasional (Gudang/Supply):** `operasional@anitech.dev` (atau username `operasional`)

### 2.2 Koreografi Showroom Fitur per Role (Detik-per-Detik)

#### A. Role CEO (`ceo@anitech.dev`)
1. **Tab 1: `[ 📊 Dashboard Utama / Modul ]` (Default):**
   - Muncul `CompanyDataDashboard` asli dengan banner `LOCAL BENCHMARK PREVIEW`.
   - Perhatikan 4 Snapshot: Revenue Rp 612.5 jt, Margin 22.8%, Cash Runway 14.2 bulan, Health Grade A+ (Skor 88).
   - Klik tombol **"Jelaskan"** pada Runway -> Muncul panel 6-pilar ("Ini Maksudnya Apa?").
   - Geser slider **CorPlan What-If Simulation** ke $-25\%$ -> Perhatikan angka estimasi Runway turun dari 14.2 bulan menjadi 9.4 bulan secara instan.
2. **Tab 2: `[ 📈 Grafik & Visual ]`:**
   - Muncul 4 kartu grafik granular: Monte Carlo Confidence Interval, Breakdown Struktur Biaya (COGS/OPEX/Mkt), Alokasi Modal Kerja, dan Radar Ekspansi Cabang Baru.
3. **Tab 3: `[ 🧠 Mind Map / Peta Konsep ]`:**
   - Muncul kanvas SVG interaktif alur kausal: *Revenue $\rightarrow$ Margin $\rightarrow$ Cash Runway $\rightarrow$ Alokasi Modal*.
   - Klik node **"Cash Runway (14.2 Bulan)"** -> Panel diagnosis bawah mengembang, klik tombol **"Tanyakan Penanganan ke AI Assistant"** -> Otomatis beralih ke layar Executive AI Assistant dengan prompt terisi.

#### B. Role FINANCE (`finance@anitech.dev`)
1. **Tab 1: `[ 📊 Dashboard Utama / Modul ]` (Default):**
   - Muncul `FinanceModuleView` asli dengan banner `DEMO PREVIEW`.
   - Tampil 5 mutasi kas riil (pendapatan kasir, supplier kopi, bayar sewa, invoice B2B) dan 3 invoice aktif.
   - Buka bagian **Interactive Cash Drawer Reconciliation** -> Lihat perbandingan uang fisik laci kasir vs sistem POS (selisih -Rp 15.000).
   - Di tabel Umur Piutang Kasbon, klik tombol **"Tagih WA"** -> Muncul generator pesan WhatsApp 3 nada (Sopan, Formal, Tegas).
2. **Tab 2: `[ 📈 Grafik & Visual ]`:**
   - Visual Waterfall Arus Kas (Operating vs Investing vs Financing) & aging schedule piutang 30-60-90 hari.
3. **Tab 3: `[ 🧠 Mind Map / Peta Konsep ]`:**
   - Alur kausal: *Laci Kasir $\rightarrow$ Kas & Bank $\rightarrow$ SP2DK KPP Pajak $\rightarrow$ Runway Kas*.

#### C. Role MARKETING (`marketing@anitech.dev`)
1. **Tab 1: `[ 📊 Dashboard Utama / Modul ]` (Default):**
   - Muncul `MarketingModuleView` asli dengan banner `DEMO PREVIEW`.
   - Tampil 3 kampanye aktif: Meta Ads Retargeting (ROAS 4.6x), TikTok Ads Video (ROAS 3.8x), Google Search Ads (ROAS 4.1x). Total spend Rp 28 jt menghasilkan omset Rp 117.6 jt (Blended ROAS 4.2x).
   - Buka bagian **Multi-Stage Conversion Funnel** -> Impresi (145k) $\rightarrow$ Klik (8.7k) $\rightarrow$ Chat WA (1.42k) $\rightarrow$ Beli (580). AI menyorot bottleneck konversi di tahap klik-ke-chat WhatsApp.
2. **Tab 2: `[ 📈 Grafik & Visual ]`:**
   - Grafik perbandingan efisiensi CAC multi-channel dan tren klaim voucher repeat order.
3. **Tab 3: `[ 🧠 Mind Map / Peta Konsep ]`:**
   - Alur kausal: *Belanja Iklan $\rightarrow$ Impresi $\rightarrow$ WA Leads $\rightarrow$ Repeat Order Struk Digital*.

#### D. Tiga Role Baru (Sekretaris, Mgr Umum, Mgr Operasional)
- **Sekretaris (`sekretaris@anitech.dev`):** Tab 1 (Agenda, Inbox, Legalitas & SOP), Tab 2 (Heatmap Jadwal Eksekutif, SLA Dokumen), Tab 3 (Mind Map Alur Disiplin SOP & Legal).
- **Manager Umum (`manager@anitech.dev`):** Tab 1 (KPI Tim, SOP Cabang, Tiket Masalah), Tab 2 (Burndown Capaian Tim, Radar SOP 6 Pilar), Tab 3 (Mind Map Beban Kerja Staf $\rightarrow$ Kepuasan Pelanggan).
- **Manager Operasional (`operasional@anitech.dev`):** Tab 1 (Master Peta Stok Multi-Cabang, PO Lifecycle, Mutu), Tab 2 (Kurva Kadaluarsa Bahan Basi/Perishable, Audit Timbang Gudang Anti-Fraud, SLA Pengiriman Vendor), Tab 3 (Mind Map Safety Stock $\rightarrow$ HPP $\rightarrow$ Margin).

---

## 3. DEEP TECHNICAL SPECIFICATION ROADMAP (5 FASE LANJUTAN)

Berikut adalah cetak biru teknis mendalam untuk diselesaikan pada sesi-sesi mendatang:

```
+========================================================================================+
|                        ROADMAP SESI BARU (KLIR UTAMA 2026)                             |
+========================================================================================+
|                                                                                        |
|  FASE 1: KONEKTOR API LIVE & REAL-TIME WEBHOOKS                                        |
|  ├── [x] 1.1 Meta Ads & Google Ads Lead Sync Scaffold Webhook (Selesai 13 Sep)         |
|  ├── [x] 1.2 WhatsApp Gateway Multi-Provider Scaffold (Fonnte / Meta Cloud / Stub)    |
|  ├── [x] 1.3 WhatsApp Message Templates (Struk Digital & Kasbon 3-Nada Sopan/Formal)   |
|  └── [—] 1.4 Bank Aggregator (Dilewati - Khusus Enterprise, Arahan Mecca 13 Sep)       |
|                                                                                        |
|  FASE 2: MULTIMODAL AUDIO EXECUTIVE BRIEFING [DICATAT / PARKED UNTUK NANTI]            |
|  ├── [ ] 2.1 Audio Synthesizer Hook (Web Audio API / ElevenLabs / Gemini Direct TTS)   |
|  ├── [ ] 2.2 Dynamic Briefing Script Generator (CEO, Finance, dan Ops Morning Brief)   |
|  └── [ ] 2.3 Visualizer Ambient Glow & Playback Controls di Top Bar Dashboard          |
|                                                                                        |
|  FASE 3: SINKRONISASI SCHEMA POSTGRESQL & SEEDING SCRIPT (SELESAI 13 SEP)              |
|  ├── [x] 3.1 Review enum DivisionRole (Sudah ada di schema Fatur, Zero Touch DB)       |
|  ├── [x] 3.2 Pembuatan scripts/seed-benchmark.ts 1-klik (6 user, 50 tx, 12 PO, 10 prod)|
|  └── [x] 3.3 Shortcut "npm run seed" di package.json & guard production abort          |
|                                                                                        |
|  FASE 4: RESPONSIF MOBILE & PWA UNTUK STAF LAPANGAN [DITUNDA / PARKED UNTUK NANTI]    |
|  ├── [ ] 4.1 Audit visual 6 role pada resolusi smartphone (iOS Safari / Android)       |
|  ├── [ ] 4.2 Optimasi Bottom Sheet untuk panel "Ini Maksudnya Apa?" di layar kecil     |
|  └── [ ] 4.3 PWA Service Worker offline-ready caching untuk kasir POS & gudang         |
|                                                                                        |
|  FASE 5: SECURITY & SMART FILE DATA HUB (SELESAI 13 SEP)                               |
|  ├── [x] 5.1 File Intelligence Engine (Auto-deteksi 6 domain kategori + tag + summary) |
|  ├── [x] 5.2 Pencabutan batas ukuran MAX_FILE_BYTES (No size limit per arahan Mecca)   |
|  └── [x] 5.3 Unit test 20/20 PASS + Upload Rate Limiter 40 req/min tetap aktif         |
+========================================================================================+
```

---

### FASE 1: KONEKTOR API LIVE & WEBHOOKS (SPESIFIKASI TEKNIS)

#### 1.1 WhatsApp Gateway Integration (Struk Digital & Kasbon WA)
- **Target Endpoint:** `POST /api/v1/communication/whatsapp/send`
- **Abstraksi Adapter Pattern:**
  ```typescript
  export interface WhatsAppProvider {
    sendMessage(to: string, message: string): Promise<{ success: boolean; messageId: string }>;
    sendMedia(to: string, mediaUrl: string, caption: string): Promise<{ success: boolean; messageId: string }>;
  }
  ```
- **3 Template Nada Penagihan Kasbon (Formulasi Variabel Dinamis):**
  1. *Nada Sopan (H-3 s/d H+0):*  
     `"Halo Kak {nama_pelanggan}, salam hangat dari {nama_bisnis}. Sekadar mengingatkan bahwa tagihan #{nomor_invoice} sebesar {nominal} akan jatuh tempo pada {tanggal_tempo}. Detail invoice: {link_invoice}. Terima kasih atas kerjasamanya! 🙏"`
  2. *Nada Formal (H+1 s/d H+7):*  
     `"Yth. Bapak/Ibu {nama_pelanggan}, kami mengonfirmasi bahwa tagihan #{nomor_invoice} sebesar {nominal} telah melewati tanggal jatuh tempo ({tanggal_tempo}). Mohon dapat segera melakukan transfer ke rekening {nama_bank} {nomor_rekening} a.n. {nama_bisnis} dan mengirimkan bukti transfer. Terima kasih."`
  3. *Nada Tegas (H+8 ke atas):*  
     `"[PEMBERITAHUAN TERTUNDA] Kepada {nama_pelanggan}, catatan keuangan kami menunjukkan tagihan #{nomor_invoice} senilai {nominal} telah tertunda selama {hari_tertahan} hari. Untuk menjaga kelancaran operasional dan pemesanan berikutnya, mohon penyelesaian tagihan dilakukan dalam 1x24 jam ke rekening {nama_bank} {nomor_rekening}. Hubungi Finance kami di {nomor_finance} untuk konfirmasi."`

#### 1.2 Meta & Google Ads Lead Sync Endpoint
- **Target Endpoint:** `POST /api/v1/webhooks/leads-inbound`
- **Mekanisme Ingest:**
  - Menerima payload webhook lead generation dari Meta Ads (Graph API webhook `leadgen`) dan Google Ads.
  - Memetakan field `full_name`, `phone_number`, `campaign_id`, `ad_id`, `created_time`.
  - Menyimpan langsung ke tabel lead pool lokal dan memicu notifikasi real-time ke Dashboard Marketing & AI Assistant.

---

### FASE 2: MULTIMODAL AUDIO EXECUTIVE BRIEFING (COGNITIVE UX TAHAP 2)

#### 2.1 Arsitektur Audio Engine
- **Komponen UI:** `<MorningBriefingAudioBar />` terpasang di top shell dashboard tepat di bawah header tenant.
- **Visualizer Ambient Pulse:** Canvas 2D atau SVG polyline 16-bar dengan animasi wave saat audio status `playing`.
- **Generator Naskah Briefing (Dynamic Aggregator):**
  - Mengambil data metrik MTD, alert jatuh tempo hari ini, dan anomali kasir/gudang.
  - Merangkum dalam naskah audio 45-60 detik berstruktur:
    1. *Greeting & Health Status:* "Selamat pagi Mas Mecca. Bisnis berada di Grade A+, omset mencapai 612 juta rupiah."
    2. *Critical Alerts:* "Perhatian pada laci kasir outlet Melawai dengan selisih 15 ribu rupiah, dan 2 PO bahan kopi yang harus dikonfirmasi hari ini."
    3. *Priority Action:* "Rekomendasi AI: Kirimkan 3 penagihan piutang via WhatsApp dan jalankan flash promo untuk 12 item yang mendekati tanggal kadaluarsa."

---

### FASE 3: POSTGRESQL SCHEMA & SEEDING ENGINE (FATUR SYNC)

#### 3.1 Naskah Kolaborasi & Sync Bersama Fatur
Untuk menjaga prinsip **"Lane Fatur 100% Aman & Hands-off"**, koordinasi penambahan enum `DivisionRole` dilakukan secara transparan:
- **Tujuan Perubahan:** Membedakan hak divisional fungsional (`CEO`, `FINANCE`, `MARKETING`, `SEKRETARIS`, `MANAGER_UMUM`, `MANAGER_OPERASIONAL`) dari role administratif workspace (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`). Seorang manajer cabang tetap memiliki izin anggota (`MEMBER`) di tingkat workspace, namun memiliki tampilan dan kapabilitas divisi `MANAGER_UMUM`.
- **Draf File Seeding Otomatis (`scripts/seed-benchmark.ts`):**
  Script TypeScript mandiri yang menggunakan `prismaClient` untuk menyuntikkan tenant benchmark lengkap dalam 1 kali perintah `npx tsx scripts/seed-benchmark.ts`:
  - 1 Workspace: "AniTech Retail Group"
  - 6 User dengan division_role masing-masing
  - 50 CashTransactions riil
  - 12 Purchase Orders
  - 3 Invoices aktif
  - 3 Marketing Campaigns

---

### FASE 4: MOBILE RESPONSIVENESS & PWA STAF LAPANGAN

#### 4.1 Optimalisasi Viewport Smartphone (375px - 430px)
- Kartu 4 HUD Snapshot yang sebelumnya `grid-cols-2 md:grid-cols-4` diubah menjadi horizontal scrolling snap-carousel pada mobile agar tidak memakan ruang vertikal.
- Panel **"Ini Maksudnya Apa?"** yang di desktop bersifat inline accordion, di mobile diubah menjadi **Draggable Bottom Sheet Drawer** (menggunakan Tailwind slide-up CSS) agar pengguna fokus membaca satu pilar penjelasan tanpa harus scrolling bolak-balik.
- **PWA Service Worker:** Menyimpan cache aset statis dan API `/api/v1/dashboard/role` di IndexedDB sehingga staf kasir di lapangan tetap dapat melihat daftar harga, SOP, dan mencatat transaksi sementara saat koneksi internet terputus (offline-first).

---

### FASE 5: SECURITY & RBAC LEAST-PRIVILEGE HARDENING

#### 5.1 Matriks Otorisasi 7 Modul x 6 Role Eksekutif
```
┌────────────────────────┬───────┬─────────┬───────────┬────────────┬──────────┬─────────┐
│ Modul / Domain         │  CEO  │ FINANCE │ MARKETING │ SEKRETARIS │ MGR UMUM │ MGR OP  │
├────────────────────────┼───────┼─────────┼───────────┼────────────┼──────────┼─────────┤
│ 1. Executive CorPlan   │ FULL  │ READ    │ NO        │ READ       │ NO       │ NO      │
│ 2. Kas, Bank & Pajak   │ FULL  │ FULL    │ NO        │ READ (SOP) │ NO       │ NO      │
│ 3. Kampanye & Ads      │ FULL  │ READ    │ FULL      │ NO         │ READ     │ NO      │
│ 4. Dokumen & Legalitas │ FULL  │ READ    │ NO        │ FULL       │ READ     │ NO      │
│ 5. Tim & KPI Cabang    │ FULL  │ NO      │ NO        │ READ       │ FULL     │ READ    │
│ 6. Stok, Gudang & PO   │ FULL  │ READ    │ NO        │ NO         │ READ     │ FULL    │
│ 7. Workspace Data Hub  │ FULL  │ FULL    │ FULL      │ FULL       │ FULL     │ FULL    │
└────────────────────────┴───────┴─────────┴───────────┴────────────┴──────────┴─────────┘
```
- Setiap route API di bawah `src/app/api/v1/` akan melewati guard `tenant-guard.ts` dan `role-policy.ts` untuk memastikan tidak ada eskalasi hak istimewa (privilege escalation).

---

## 4. AGENDA DISKUSI STRATEGIS BERSAMA MECCA

Ketika sesi baru dibuka, Mas Mecca cukup meninjau 3 pertanyaan kunci ini untuk menentukan arah eksekusi:

1. **Prioritas Eksekusi Utama:**
   - *Opsi 1:* Selesaikan Konektor API Live (WhatsApp Gateway untuk Struk WA & Kasbon + Ingest Ads).
   - *Opsi 2:* Kembangkan Audio Morning Briefing (Multimodal hands-free voice UX).
   - *Opsi 3:* Database Seeding & Mobile Responsiveness PWA untuk kasir dan staf gudang.
2. **Pemilihan Vendor WhatsApp Gateway:**
   - *Fonnte/Wablas* (Cepat, murah, tanpa verifikasi Facebook) vs *Official Meta Cloud API* (Resmi korporat).
3. **Penyelarasan Database Fatur:**
   - Apakah kita jalankan script seeding lokal sekarang, atau tunggu handoff review Fatur?

---

*Status: Dokumen Master Blueprint Selesai Disusun dan Tersimpan Permanen. Siap Dieksekusi Kapan Pun Mas Mecca Memulai Sesi Baru.*
