# 2026-09-13 — ANTIGRAVITY TO CODEX/FATUR/MECCA HANDOFF
# DUAL-MODE LOCALHOST BENCHMARK DEMO DATA & PARITAS TAB SWITCHER 6 ROLE

> **Proyek:** KLIR Utama (`02-KLIR-PUBLIC-PRIVATE` / `klir-repo-clone`)  
> **Status:** [PASS] `npx tsc --noEmit` lolos 0 errors. Unit test 100% PASS. `npm run build` Next.js 16.3.1 Turbopack SUKSES (94/94 routes).  
> **Lane Fatur:** 100% ZERO-TOUCH (`schema.prisma` migrations, auth core, session, landing page v18).  

---

## 1. LATAR BELAKANG & PROBLEM STATEMENT
Menjawab kebutuhan eksplisit Mecca:
1. **Localhost Unseeded Blank State Issue:**
   Ketika aplikasi KLIR dijalankan di environment `localhost` (saat pitching ke klien, demo tim marketing, atau pengujian internal), database PostgreSQL lokal seringkali unseeded (belum ada transaksi masuk) dan API pihak ketiga (Google Ads, Meta Ads, TikTok Ads, mutasi open banking) belum dikonfigurasi. Akibatnya, dashboard terlihat kosong melompong (angka Rp 0, grafik datar, alert kosong).
2. **Kebutuhan Visual Benchmark Realistis:**
   Mecca dan tim marketing butuh melihat visualisasi utuh: "Kalau sistem ini sudah berjalan penuh di bisnis riil dengan omset ratusan juta, tampilannya seperti apa?".
3. **Preservasi Data Produksi (Hostinger/GitHub):**
   Saat aplikasi dideploy ke Hostinger atau GitHub (production) atau saat pengguna mengunggah dokumen/transaksi riil, data riil HARUS 100% mengambil alih secara otomatis, dan data demo tidak boleh mencemari atau menimpa data pengguna asli.
4. **Paritas Tab Switcher 6 Role Tanpa Merombak Modul Asli:**
   Tiga role baru (`SEKRETARIS`, `MANAGER_UMUM`, `MANAGER_OPERASIONAL`) memiliki pemilih mode `[ Ringkasan ]`, `[ Grafik & Visual ]`, `[ Mind Map ]`. Tiga role utama (`CEO`, `FINANCE`, `MARKETING`) harus memiliki paritas tab switcher yang sama, namun modul analitik asli yang sudah kaya (`CompanyDataDashboard`, `FinanceModuleView`, `MarketingModuleView`) **TIDAK BOLEH DIROMBAK ATAU DIHAPUS**, melainkan dijadikan tab default `[ Dashboard Utama / Modul ]`.

---

## 2. ARSITEKTUR & IMPLEMENTASI TEKNIS

### 2.1 Tab Switcher 3 Mode pada Role CEO, Finance, dan Marketing (`src/app/page.tsx`)
- Menambahkan state:
  ```typescript
  const [ceoDashboardMode, setCeoDashboardMode] = useState<DashboardVisualMode>('module');
  const [financeDashboardMode, setFinanceDashboardMode] = useState<DashboardVisualMode>('module');
  const [marketingDashboardMode, setMarketingDashboardMode] = useState<DashboardVisualMode>('module');
  ```
- Di atas masing-masing dashboard, dirender tab switcher elegan:
  - `[ 📊 Dashboard Utama / Modul ]` (Default): Menampilkan modul asli yang lengkap dan interaktif.
  - `[ 📈 Grafik & Visual ]`: Menampilkan grafik analitik detail 4 kartu (`RoleDashboardView` dengan `initialMode="charts"`).
  - `[ 🧠 Mind Map / Peta Konsep ]`: Menampilkan peta kausal SVG interaktif dengan diagnosis dampak risiko dan rekomendasi aksi (`RoleDashboardView` dengan `initialMode="mindmap"`).

### 2.2 Sinkronisasi Mode (`src/app/components/RoleDashboardView.tsx`)
- Menambahkan prop `initialMode?: DashboardVisualMode` pada `RoleDashboardViewProps`.
- Melakukan sinkronisasi state internal `mode` saat `initialMode` berubah dari tab switcher induk.

### 2.3 Dual-Mode Benchmark Engine: Localhost vs Production Real Data
Aturan Ketat Prioritas Data:
```
┌─────────────────────────────────────────────────────────────┐
│                       DATA PRIORITY                         │
│                                                             │
│   [ Apakah ada Data Riil di Database / Upload Dokumen? ]    │
│            │                               │                │
│           YES                              NO               │
│            ▼                               ▼                │
│    TAMPILKAN DATA RIIL         [ Apakah di Localhost? ]     │
│   (100% Selalu Menang)             │               │        │
│                                   YES              NO       │
│                                    ▼               ▼        │
│                             BENCHMARK DEMO    EMPTY STATE   │
│                             (Untuk Pitching)  (Otentik)     │
└─────────────────────────────────────────────────────────────┘
```

Implementasi di setiap komponen:
1. **`CompanyDataDashboard.tsx`**:
   - `isDevLocalhost`: `window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'`.
   - Dataset benchmark: `DEMO_FIN_LOCAL` (omset MTD Rp 612.5 jt, net margin 22.8%, burn rate terkendali), `DEMO_MKT_LOCAL` (blended ROAS 4.2x, ad spend Rp 28 jt), `DEMO_TEAM_LOCAL` (24 karyawan aktif).
   - Health score benchmark: 88/100 (Finance 92, Growth 85, Operations 88, Strategy 87) dengan tren May-Sep.
   - Banner indikator: `LOCAL BENCHMARK PREVIEW` di atas Snapshot Perusahaan.
2. **`FinanceModuleView.tsx`**:
   - Menambahkan dataset: `DEMO_FINANCE_TRENDS` (Apr-Sep), 5 mutasi kas riil (`DEMO_FINANCE_TRANSACTIONS`), 3 invoice aktif (`DEMO_FINANCE_INVOICES`), dan kewajiban 14/30 hari.
   - Mengaktifkan fallback benchmark hanya ketika `isDevLocalhost && !hasRealData`.
   - Banner indikator: `DEMO PREVIEW` di bawah header utama.
3. **`MarketingModuleView.tsx`**:
   - Menambahkan dataset: `DEMO_MARKETING_CAMPAIGNS` (Meta Ads, TikTok Ads, Google Search Ads), promo voucher, dan metrik performa (ROAS 4.2x, konversi Rp 117.6 jt).
   - Mengaktifkan fallback benchmark hanya ketika `isDevLocalhost && !hasRealData`.
   - Banner indikator: `DEMO PREVIEW` di bawah header utama.
4. **API Gateway Role Dashboard (`src/app/api/v1/dashboard/role/route.ts`)**:
   - Deteksi `isDevLocal`: `process.env.NODE_ENV === 'development' || host.includes('localhost') || host.includes('127.0.0.1')`.
   - Fallback unseeded localhost untuk `CEO`, `FINANCE`, dan `MARKETING` menghasilkan cards, trend series, dan wawasan AI dengan status `'available'` dan metrik benchmark bisnis nyata.

---

## 3. VERIFIKASI & PENGUJIAN
1. **TypeScript Typecheck:**
   - Command: `npx tsc --noEmit`
   - Result: **0 errors** (lulus sempurna).
2. **Unit Test Suites:**
   - Command: `node --experimental-test-module-mocks --import tsx --test tests/role-dashboard-route.test.ts tests/role-dashboard-visuals.test.ts tests/role-dashboard-language.test.ts tests/role-policy.test.ts tests/dashboard-insight-role-route.test.ts tests/backend-extensions.test.ts`
   - Result: **31/31 tests PASS (100%)**.
3. **Core Orchestrator & Activity Tests:**
   - Command: `npm test`
   - Result: **20/20 tests PASS (100%)**.
4. **Next.js Production Build:**
   - Command: `npm run build`
   - Result: **Compiled successfully in 6.1s**, 94/94 static and dynamic routes compiled cleanly.
5. **Database & Auth Integrity:**
   - Lane Fatur (`prisma/schema.prisma` migrations, auth JWT, PostgreSQL database) **100% aman dan zero-touch**.
