# HANDOFF ANTIGRAVITY KE CODEX: BUG HUNTING, INTEGRATION AUDIT & HISTORICAL 5-10 YEARS DATA PLAN
**Tanggal**: 13 September 2026  
**Dari**: Antigravity Prime  
**Kepada**: Codex (Lead AI Engineer & Bug Hunter)  
**Tembusan**: Mecca (Owner AniTech / KLIR)  
**Status**: [LOKAL & GITHUB SYNCED] Build `npx tsc --noEmit` clean 0 error, test suite 1.738/1.738 PASS, Commit `22216a7` synced to `AniTech-Dev/KLIR:main`.

---

## 1. REKAP SELURUH PEKERJAAN ANTIGRAVITY (SESI INI & SEBELUMNYA)

Berikut adalah kompilasi jejak kerja nyata yang telah diselesaikan Antigravity di dalam repo `klir-repo-clone`:

### A. Sesi Rebuild Visual Body 3 Role Baru (Sekretaris, Manager Umum, Manager Ops)
1. **Adopsi Desain ZIP Claude**: Mengekstrak 3 ZIP desain dari folder `Downloads/` dan merekonstruksi body dashboard 3 role baru di `src/app/components/DashboardVisuals.tsx` dan `src/app/components/RoleDashboardView.tsx`.
2. **Eliminasi Right Drawer**: Menghapus ketergantungan `DashboardExplanationDrawer` (drawer kanan yang menutupi layar) dan menggantikannya dengan `InlineExplanationPanel` (accordion 6 bagian terstruktur: *Artinya, Mengapa Penting, Sumber Data, Cara Membaca, Dampak Praktis, Rekomendasi*).
3. **Deep Link Prompt ke AI Assistant**: Integrasi tombol *"Tanyakan ke AI Assistant"* via `sessionStorage.getItem('klir_initial_prompt')` yang langsung mengisi input chat saat berpindah ke tab AI Assistant masing-masing role.
4. **Proactive Alerts Routing**: Memperluas union role di `proactive-alerts.ts` menjadi 6 role dan me-mount `<ProactiveAlertsPanel />` di AI Assistant Sekretaris, Manager Umum, dan Manager Ops.

### B. Sesi Single Screen & In-Card Visual Drilldown 3 Role Fundamental (CEO, Finance, Marketing)
1. **Penyatuan Layar (Single Screen)**: Menghapus tab switcher horizontal `[ Dashboard Utama ] | [ Grafik & Visual ] | [ Mind Map ]` di level atas pada `src/app/page.tsx` untuk CEO, Finance, dan Marketing agar tidak memecah workflow operasional.
2. **In-Card Visual Drilldown Accordion (`InCardVisualDrilldown.tsx`)**: Menambahkan tombol toggle show/hide di bawah kartu-kartu metrik utama (Kondisi Kas & Runway, Performa Iklan, Kategori Pengeluaran, Alur Uang) yang membuka panel drilldown 5 mode:
   - `[ 📊 Batang ]`
   - `[ 📈 Garis ]`
   - `[ 🧠 Mind Map ]`
   - `[ 📋 Tabel ]`
   - `[ 💡 Infografis ]`
   disertai 6 pilar penjelasan kognitif.
3. **Wide Canvas & Deep Causal Graph**: Memperlebar kanvas visual grafik di role baru menjadi single wide panel, dan mengembangkan Mind Map dari diagram linear sederhana menjadi Deep Causal Graph multi-level (Pemicu -> Deteksi -> Dampak Finansial -> Solusi Cepat) dengan kurva Bezier dinamis (`M x1 y1 C ...`) di kanvas SVG lebar.

### C. Sesi Localhost Rich Demo Benchmark vs Zero-Fake Production Strict Gating
1. **Localhost Fallback Demo Kaya**:
   - Menambahkan data fallback berbobot di `src/app/api/v1/dashboard/role/route.ts` untuk Manager Umum (KPI 84.2%, budget Rp 148jt, SOP 87%, 20 kartu), Sekretaris (7 tugas, 4 agenda hari ini, 24 dokumen arsip, 142 absensi), dan Manager Ops (184 produk, 12 restock, 5 PO pending, 8 supplier).
   - Menghubungkan demo status gateway di `src/app/api/v1/integrations/status/route.ts` sehingga di localhost WhatsApp, Meta Ads, dan Google Ads berstatus `connected`.
2. **Sinkronisasi 1:1 Antar Role**:
   - Di `CompanyDataDashboard.tsx` dan `FinanceModuleView.tsx`, memisahkan flag demo domain dan menetapkan threshold transaksi substansial (`>= Rp 1.000.000`). Hal ini mencegah sisa transaksi QA puluhan ribu rupiah mematikan mode demo secara parsial.
   - Hasil hitungan matematis 100% konsisten:
     * CEO Omset (Rp 612.5jt) <--> Finance Pemasukan (Rp 612.5jt)
     * CEO Pengeluaran (Rp 478jt) <--> Finance Pengeluaran (Rp 478jt)
     * CEO Kas & Net Flow (Rp 348.5jt & +Rp 134.5jt) <--> Finance Kas & Net Flow (Rp 348.5jt & +Rp 134.5jt)
     * Marketing Belanja Iklan (Rp 25.98jt) <--> CEO & Finance Marketing Allocation (~Rp 26-28jt)
3. **Zero-Fake Production Strict Gating**: Seluruh mock/fallback demo hanya aktif jika `isDevLocal` / `isDevLocalhost` (berjalan di localhost/127.0.0.1). Di server VPS / domain produksi, sistem 100% murni membaca database PostgreSQL dan mengembalikan status riil tanpa manipulasi.

---

## 2. PANDUAN & METODOLOGI BUG HUNTING UNTUK CODEX

Codex diminta melakukan penelusuran bug sistem secara menyeluruh (*bug hunting*) dengan fokus pada **fungsionalitas AI Assistant, integrasi alur data antar fitur, dan edge case operasional**.

### Metodologi Pemeriksaan (Step-by-Step Hunting)

1. **AUDIT STATE & PERSISTENCE (SessionStorage, LocalStorage, React State)**:
   - Uji apakah prompt yang dikirim dari tombol "Tanyakan ke AI Assistant" di `InlineExplanationPanel` dan `InCardVisualDrilldown` selalu sukses ter-prefill di textarea chat masing-masing dari 6 role, atau ada kondisi di mana state tertimpa oleh template default saat komponen me-re-render.
2. **AUDIT API CONTRACT & RESILIENCE (Error Boundaries, Schema Validation)**:
   - Uji apa yang terjadi jika API `/api/v1/dashboard/role` mengembalikan 500 atau timeout. Apakah dashboard menampilkan fallback graceful atau crash (blank white screen)?
   - Pastikan komponen tidak memunculkan `TypeError: undefined is not an object` ketika data array kosong (`[]`) di production non-demo.
3. **AUDIT AI BRAIN CONTEXT INGESTION (Knowledge Manifest, Vector/Text Budget)**:
   - Teliti berkas `src/lib/ai-brain/workspace-knowledge.ts` dan `company-brief.ts`. Pastikan pembuatan manifest pengetahuan perusahaan tidak melebihi alokasi karakter (budget 14.000 char) dan aman dari kegagalan query Prisma saat unseeded.
4. **AUDIT CROSS-ROLE ACTION DISPATCH (Proactive Alerts -> Chat -> Action Trigger)**:
   - Jika AI Assistant memberikan rekomendasi aksi (misal: "Pangkas budget kampanye X" atau "Kirim penagihan kasbon via WA"), apakah tombol quick action / CTA pada chat bubble sudah terhubung ke API handler terkait (`/api/v1/integrations/whatsapp/send`, dsb.) atau masih sekadar teks markup visual.
   - Skenario Update Finansial ke Marketing: Jika Finance mengubah alokasi budget bulanan, apakah metrik target atau alokasi marketing ikut menyesuaikan secara dinamis?
   - Skenario Disposisi Sekretaris ke CEO: Apakah memo / agenda eksekutif yang dibuat di Sekretaris bisa memicu notifikasi proaktif ke CEO?
   - Skenario Restock Operasional ke Finansial: Ketika Manager Operasional mendeteksi 9 SKU kritis dan membuat draft PO, apakah data tersebut mengalir ke proyeksi arus kas Finance sebagai komitmen pengeluaran?

---

## 3. RENCANA PERANCANGAN DATA HISTORIS PERUSAHAAN 5-10 TAHUN DI LOCALHOST

Mecca meminta agar data localhost dapat menampilkan kesan bahwa perusahaan **sudah berdiri kokoh selama 5 hingga 10 tahun**. Berikut cetak biru perencanaannya:

### A. Konsep Narasi Bisnis (Business Lore)
- **Profil Entitas**: "PT Kuliner Rasa Nusantara / KLIR Brand Mitra", didirikan tahun 2017 (umur ~9 tahun).
- **Evolusi Bisnis**:
  * **Tahun 1-3 (Fase Startup, 2017-2019)**: 1 outlet fisik, omset awal Rp 20-50jt/bulan, pencatatan manual sederhana.
  * **Tahun 4-6 (Fase Ekspansi, 2020-2022)**: Membuka 3 cabang (Bekasi, Bandung, Serpong), mulai adopsi digital marketing Meta Ads & Google Ads, omset bertumbuh ke Rp 200-350jt/bulan.
  * **Tahun 7-9+ (Fase Skala Enterprise, 2023-2026)**: Omnichannel (Dine-in, WhatsApp Direct, B2B Catering Korporat), 18 staf tetap, pergudangan terpusat, omset stabil di kisaran Rp 500-700jt/bulan dengan margin bersih sehat 20-25%.

### B. Arsitektur Data Time-Series Multi-Tahun
1. **Data Historis Makro (Annual Performance)**:
   - Generator data historis per tahun (2017 - 2026) yang mencakup pertumbuhan omset YoY realistis (kenaikan rata-rata 15-25% per tahun) dan akumulasi cadangan kas (Retained Earnings bertumbuh hingga stabil di Rp 348.5jt).
2. **Arsip Dokumen & Kontrak Jangka Panjang (Sekretaris)**:
   - Dokumen perizinan: Akta Pendirian Perusahaan (2017), NIB / OSS RBA, HAKI Merk Dagang terdaftar, Sertifikasi Halal BPJPH, Perpanjangan Sewa Gedung 5 tahunan.
   - Kontrak vendor jangka panjang ("Supplier Ayam Broiler Utama - Rekanan sejak 2019, 78 transaksi selesai").
3. **Data Karyawan & Jejak Karir (Manager Umum)**:
   - Data absensi dan masa kerja karyawan: Staf senior dengan masa kerja 6-8 tahun (Head Chef, Supervisor Gudang, Finance Officer) berdampingan dengan staf magang/baru.
4. **Isolasi Lingkungan**:
   - Seluruh dataset historis 5-10 tahun ini dirancang berada dalam wrapper helper yang hanya disuntikkan saat `isDevLocalhost === true`. Di production, sistem tetap 100% membaca data riil dari PostgreSQL.

---

## 4. ATURAN KERJA & BATASAN (STRICT HANDS-OFF)

- Lane Fatur (STRICT HANDS-OFF): Folder `prisma/migrations/`, konfigurasi PostgreSQL database, dan alur login/session authentication dilarang keras disentuh tanpa izin Fatur.
- Log Aktivitas Tamu: Setiap selesai sesi pekerjaan, Codex wajib mencatat aktivitasnya di baris paling bawah `AI-GUEST-ACTIVITY-LOG.md`.
- Zero-Fake Data on Production: Data historis 5-10 tahun atau benchmark demo apapun dilarang lolos ke environment production.
