# 2026-09-12 — ANTIGRAVITY TO CODEX/FATUR/MECCA HANDOFF
# PARITAS PENUH DASHBOARD 6 ROLE & DOKTRIN PENJELASAN DATA KOGNITIF ("INI MAKSUDNYA APA?")

> **Proyek:** KLIR Utama (`02-KLIR-PUBLIC-PRIVATE` / `klir-repo-clone`)  
> **Status:** [PASS] `npx tsc --noEmit` lolos 0 errors. Seluruh tests unit PASS 100%.  
> **Lane Fatur:** 100% ZERO-TOUCH (`schema.prisma`, migrasi Postgres, query DB, auth/session, landing page v18).  

---

## 1. LATAR BELAKANG & TUJUAN
Menindaklanjuti evaluasi rapat tim office Mecca:
1. **Pentingnya Penjelasan Data Kognitif ("Ini Maksudnya Apa?"):**
   Semua pengguna — baik staf kasir/admin operasional yang awam hingga C-Level profesional — harus langsung mengerti arti setiap metrik, mengapa angka itu penting, sumber datanya, cara membaca status aman/bahaya, dampak lapangan nyata, dan apa yang bisa ditindaklanjuti oleh AI Assistant.
2. **Paritas Fitur & Arsitektur 6 Role:**
   Sebelumnya, 3 role baru (`SEKRETARIS`, `MANAGER_UMUM`, `MANAGER_OPERASIONAL`) telah memiliki dedicated body view modern dengan 4 HUD Top Snapshots, Top AI Intelligence Card, dan Inline Explanation Panels. Namun, 3 role utama (`CEO`, `FINANCE`, `MARKETING`) sebelumnya masih dirender dengan fallback `SectionCard` lama. Pekerjaan ini menaikkan arsitektur 3 role utama ke standar 3 role baru dengan komponen interaktif khusus.

---

## 2. RINGKASAN PERUBAHAN ARSITEKTUR

### 2.1 Perluasan Kamus Kognitif `getStructuredExplanation` (`DashboardVisuals.tsx`)
Ditambahkan pemetaan istilah baru dengan formula 6-pilar wajib:
- `runway`, `cash runway`: Ketahanan kas perusahaan jika omset berhenti (ForwardForecast).
- `margin`, `net-margin`, `profit`: Persentase laba bersih setelah HPP, OPEX, dan pajak.
- `cash-drawer`, `kas laci`, `laci kasir`: Audit fisik uang tunai laci vs catatan POS kasir.
- `kasbon`, `piutang`: Saldo piutang pelanggan/staf tertahan + penagihan WA 3 nada.
- `pajak`, `pph`, `sp2dk`: Pajak Final UMKM PP 23 0,5% + kesiapan pembelaan SP2DK.
- `roas`, `blended roas`: Efisiensi belanja iklan terhadap omset nyata.
- `cac`, `akuisisi`: Biaya perolehan 1 pembeli baru.
- `struk`, `voucher`, `repeat`: Retensi repeat order struk digital WhatsApp tanpa kertas thermal.

### 2.2 Tiga Dedicated Body Views Baru (`DashboardVisuals.tsx`)
1. **`CeoBodyView` (Aksen Ungu `#8D55E8`):**
   - 4 HUD Snapshots: Revenue MTD, Net Profit Margin, Cash Runway, Business Health Grade.
   - Top AI Card: Wawasan CorPlan makro & proyeksi kuartal IV + tombol direct AI.
   - Hero Hook: **CorPlan What-If Simulation Slider** (simulasi penurunan omset 0-50% secara dinamis terhadap runway dan margin).
   - Seksi 2 Kolom: Struktur Biaya & Efisiensi (COGS/OPEX/Marketing) + Ketahanan Kas & Runway.
   - Seksi 3: Radar Kelayakan Ekspansi Cabang Baru (Capex, Payback, ROI).
2. **`FinanceBodyView` (Aksen Hijau `#00E676`):**
   - 4 HUD Snapshots: Kas & Bank Aktif, Piutang Kasbon, Kas Laci Kasir, Estimasi PPh Final PP 23.
   - Top AI Card: Alarm arus kas & selisih kasir berulang + tombol direct AI.
   - Hero Hook: **Interactive Cash Drawer Reconciliation** (visual laci uang fisik vs POS + alarm selisih).
   - Seksi 2 Kolom: Tabel Umur Piutang Kasbon dengan tombol kirim WhatsApp 3-nada + Arus Kas Masuk & Keluar MTD.
   - Seksi 3: Kepatuhan Pajak & Audit Defense SP2DK.
3. **`MarketingBodyView` (Aksen Rose `#FF3366`):**
   - 4 HUD Snapshots: Belanja Iklan MTD, Blended ROAS, Biaya Akuisisi (CAC), Struk Digital WA.
   - Top AI Card: Analisis efisiensi saluran iklan & optimasi budget + tombol direct AI.
   - Hero Hook: **Multi-Stage Conversion Funnel** (Impresi -> Klik -> Chat WA -> Beli dengan deteksi drop-off).
   - Seksi 2 Kolom: Efisiensi Saluran Iklan Multi-Channel (Meta, TikTok, Google) + Struk Digital WA & Retensi Repeat Order.
   - Seksi 3: AI Content Studio Live Preview.

### 2.3 Router Update (`RoleDashboardView.tsx`)
- Definisi `isDedicatedRole` diperluas mencakup 6 role:
  `role === 'SEKRETARIS' || role === 'MANAGER_UMUM' || role === 'MANAGER_OPERASIONAL' || role === 'CEO' || role === 'FINANCE' || role === 'MARKETING'`.
- Mode `overview` langsung merutekan ke dedicated view masing-masing.

---

## 3. HASIL PENGUJIAN & VERIFIKASI
- **Typecheck:** `npx tsc --noEmit` -> 0 errors.
- **Unit Tests:** `node --experimental-test-module-mocks --import tsx --test tests/role-dashboard-visuals.test.ts` -> 7/7 tests pass.
- **All Core Tests:** `npm test` -> 20/20 tests pass.
- **Role Policy & Route Tests:** 14/14 tests pass.
- **Port:** Dev server `http://localhost:3000` status 200 OK.
