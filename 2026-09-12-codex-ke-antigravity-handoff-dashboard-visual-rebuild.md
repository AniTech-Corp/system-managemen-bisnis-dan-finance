<!-- Dibuat oleh: Codex, 12 September 2026 -->

# KLIR — Codex → Antigravity Handoff: Dashboard Visual Rebuild

Tanggal: 12 September 2026 (WIB)  
Pengirim: Codex  
Penerima: Antigravity  
Proyek: `KLIR/02-KLIR-PUBLIC-PRIVATE/2026-09-01-github-push-workspace/klir-repo-clone`  
Status: READY FOR VISUAL IMPLEMENTATION — belum push, belum deploy

## 1. Tujuan handoff

Tiga dashboard role baru (Sekretaris, Manager, Manager Operasional) perlu dibangun ulang pada **body dashboard** agar benar-benar satu keluarga visual dengan dashboard CEO, Finance, dan Marketing.

Keluhan visual yang sudah diverifikasi langsung di localhost:

- body role baru terlihat seperti kumpulan card generik dan terlalu banyak empty state;
- hierarchy, density, chart, tabel, dan insight belum menyamai dashboard utama;
- tombol `Jelaskan` membuka drawer dari sisi kanan sehingga terasa seperti fitur terpisah;
- isi desain ZIP belum diterjemahkan satu per satu ke layout runtime;
- console bersih dan TSC lulus tidak boleh dianggap sebagai bukti visual sudah selesai.

**Batas utama:** header/top shell, logo, tab Dashboard/AI Assistant, profile dropdown, dan navigasi existing harus tetap mengikuti tiga role utama. Hanya body dashboard dan perilaku expansion yang boleh direbuild dalam handoff ini.

## 2. Sumber referensi wajib

### ZIP desain

Jangan menempelkan HTML ZIP sebagai runtime. Gunakan ZIP sebagai referensi struktur, visual, vocabulary, spacing, dan hierarchy.

```text
C:\Users\mausx\Downloads\Dashboard Sekretaris KLIR.zip
C:\Users\mausx\Downloads\Dashboard Manager KLIR.zip
C:\Users\mausx\Downloads\Desain dashboard manager operasional.zip
```

### Sumber project

```text
KLIR/05-DOKUMEN/aktif/2026-09-11-rancangan-3-role-baru-sekretaris-manager-manager-operasional/PEMATANGAN-FINAL-DASHBOARD-DAN-AI-ASSISTANT.md
src/app/components/RoleDashboardView.tsx
src/app/components/DashboardVisuals.tsx
src/app/api/v1/dashboard/role/route.ts
src/lib/role-dashboard-contract.ts
src/app/components/CompanyDataDashboard.tsx
src/app/components/FinanceModuleView.tsx
src/app/components/MarketingModuleView.tsx
```

Dashboard CEO/Finance/Marketing adalah referensi source visual utama. Jangan membuat design language baru yang berdiri sendiri.

### Protokol lintas-AI

```text
../../../../PROTOKOL-TAMU-LINTAS-AI.md
../../../../AKSES-DAN-DEPLOY-LINTAS-AI.md
../../../../AI-GUEST-ACTIVITY-LOG.md
```

File `.claude`, `Claude-Code-Memory`, `AGENTS.md`, `CLAUDE.md`, `FRAMEWORK-KERJA-AI-KOMANDO.md`, dan tiga dokumen protokol lintas-AI adalah immutable untuk AI tamu. Boleh dibaca, tidak boleh diedit.

## 3. Temuan live yang menjadi baseline

### Manager — localhost

Yang sudah ada:

- header shell sesuai role;
- empat snapshot KPI;
- kartu Wawasan & Prediksi AI;
- lima kelompok detail role-fit;
- mode Ringkasan, Grafik, dan Mind map.

Yang belum sesuai:

- card masih terlalu seragam;
- struktur belum sedetail ZIP;
- data kosong mengambil ruang visual terlalu besar;
- expansion `Jelaskan KPI tim` muncul sebagai panel kanan;
- visual belum memiliki tabel/ranking/trend yang membuat dashboard terasa seperti produk matang.

### Manager Operasional — ZIP

Target visual yang wajib dipertahankan:

1. empat angka ringkasan di atas;
2. `Peta Stok Semua Cabang` full-width dengan status per baris: Aman, Perlu restock, Kritis/Habis;
3. `Purchase Order Lifecycle`;
4. `Biaya Operasional / COGS` dengan mini trend line empat minggu;
5. `Kepatuhan SOP Gudang / Dapur` sebagai tabel per cabang;
6. `Jadwal Staf Operasional`;
7. `Kinerja Supplier` sebagai ranking supplier;
8. `Wawasan & Prediksi AI` full-width di bagian bawah.

Angka pada ZIP adalah contoh. Runtime wajib memakai data backend yang tersedia atau state jujur `Belum tersedia`; jangan menyalin angka dummy.

## 4. Pekerjaan yang diminta

### A. Rebuild body tiga role

Bangun ulang body dengan pola visual existing:

```text
Page shell existing
  └── role dashboard body
      ├── page title + subtitle
      ├── toolbar periode / print
      ├── snapshot KPI yang kuat secara visual
      ├── role-specific visual sections
      ├── chart/table/mind-map bila source tersedia
      ├── AI insight dan recommendation full-width
      └── honest empty/unsupported state
```

Jangan memakai satu bentuk card generik untuk semua section. Setiap section harus punya bentuk sesuai jenis informasinya:

- tabel untuk ranking/status per cabang;
- mini chart untuk tren;
- progress/status untuk kepatuhan;
- lifecycle untuk PO;
- timeline untuk agenda;
- queue untuk keputusan;
- mind map hanya sebagai mode tambahan bila relevan.

### B. Spesifikasi Sekretaris

Body wajib menonjolkan:

- agenda dan tugas pending;
- dokumen workspace;
- inbox administratif;
- kontrak/perizinan;
- koordinasi/notulen;
- kehadiran agregat;
- pengingat kedaluwarsa;
- Wawasan & Rekomendasi AI.

Tidak boleh muncul: kas, laba/rugi, invoice, pajak, HPP, payroll, gaji individual, runway, atau company-wide financial dashboard.

### C. Spesifikasi Manager Umum

Body wajib menonjolkan:

- KPI tim;
- workload tim;
- SOP dan kepatuhan;
- decision queue;
- budget operasional own-team jika scope authoritative tersedia;
- aktivitas marketing lokal.

Manager adalah role berbasis **tim**, bukan branch/location. Jika assignment tim belum ada, tampilkan status unsupported dengan hierarchy tetap elegan. Jangan memakai company cash atau data branch sebagai fallback.

### D. Spesifikasi Manager Operasional

Body wajib menonjolkan:

- stock map lintas cabang;
- PO lifecycle;
- reorder/restock;
- COGS operasional;
- SOP gudang/kitchen;
- shift operasional;
- supplier ranking/performance;
- expiry/dead-stock bila source tersedia;
- Wawasan & Prediksi AI.

Tidak boleh muncul: kas perusahaan, laba/rugi, pajak, invoice, payroll, detail pelanggan, atau detail marketing.

### E. Perubahan expansion

Hapus pola drawer kanan untuk penjelasan dashboard role baru. Terapkan expansion inline:

```text
Metric/card
  ↓ klik “Jelaskan”
Panel inline tepat di bawah metric/card
  ├── Artinya
  ├── Mengapa penting
  ├── Sumber data
  ├── Cara membaca
  ├── Dampak praktis
  ├── Rekomendasi
  └── Tanyakan ke AI Assistant
```

Panel tidak boleh menutupi dashboard, tidak boleh menjadi side drawer, dan tidak boleh membuat pengguna merasa masuk ke aplikasi kedua.

### F. Integrasi AI Assistant

`Tanyakan ke AI Assistant` harus membuka assistant utama dengan konteks/prompt terisi, bukan membuat mini-feature baru di dalam dashboard atau nested assistant.

AI Assistant sendiri tetap memakai shell existing CEO/Finance/Marketing. Perbedaannya hanya pada tools dan vocabulary role.

## 5. Kontrak data dan honesty

Pertahankan kontrak:

```ts
available | empty | unsupported | forbidden | error
```

Setiap metric/visual wajib punya:

```text
value
status
source
scope
updatedAt
explanation
```

Aturan:

- angka ZIP = dummy sampai terbukti berasal dari API;
- tidak boleh fallback ke CEO/Finance;
- tidak boleh mengarang AI recommendation dari angka kosong;
- jika data historis belum cukup, jelaskan mengapa insight belum tersedia;
- empty state harus terlihat sebagai state produk yang sengaja dirancang, bukan error;
- backend authorization tidak boleh diklaim selesai hanya karena UI menyembunyikan CTA.

## 6. File yang boleh disentuh

Prioritas utama:

```text
src/app/components/RoleDashboardView.tsx
src/app/components/DashboardVisuals.tsx
src/lib/role-dashboard-contract.ts
```

File pendukung boleh disentuh hanya bila diperlukan untuk body/visual:

```text
src/app/components/CompanyDataDashboard.tsx
src/app/components/FinanceModuleView.tsx
src/app/components/MarketingModuleView.tsx
src/app/components/glossary-data.ts
src/app/components/JargonGlossary.tsx
```

Jangan menyentuh untuk handoff ini:

```text
auth/login/session/membership
password
Prisma/schema/migration
database authorization
payment/top-up
invoice write flow
landing page
production infra
page.tsx kecuali integrasi navigasi yang benar-benar diperlukan dan disepakati
```

Perubahan existing Claude/Codex/Fatur di working tree harus diperlakukan sebagai milik pemiliknya. Jangan reset, checkout, clean, atau staging massal.

## 7. Acceptance criteria visual

Antigravity tidak boleh menyerahkan pekerjaan hanya dengan “TSC hijau”. Wajib memenuhi:

- header/top shell pixel-consistent dengan role utama;
- body tidak kosong secara visual;
- struktur ZIP terlihat jelas pada runtime;
- Manager Operasional memiliki empat KPI + enam kelompok utama + AI card;
- Manager memiliki KPI/workload/SOP/decision/budget/team marketing lokal;
- Sekretaris memiliki agenda/dokumen/koordinasi/kehadiran/kontrak;
- chart/tabel/timeline/status dipakai sesuai jenis data;
- explanation inline, bukan drawer kanan;
- AI recommendation memiliki alasan, sumber, confidence/status;
- istilah profesional punya arti manusia;
- tidak ada Finance leakage pada tiga role baru;
- tidak ada dummy number;
- responsive desktop dan 375px tidak overflow/clipping;
- console tidak menghasilkan error baru;
- existing CEO/Finance/Marketing tidak mengalami regresi.

## 8. Validation wajib sebelum mengembalikan pekerjaan

```text
npx tsc --noEmit -p tsconfig.json
npm run test:all
git diff --check
```

Browser localhost:

- login Sekretaris, Manager, Manager Operasional;
- cek header/profile/tab tetap sama;
- cek body seluruh section;
- cek expansion inline;
- cek tombol Tanyakan ke AI Assistant;
- cek Grafik/Mind map jika tersedia;
- cek ManagerOps Inventory read-only;
- cek console/network;
- cek viewport desktop dan 375px.

Jangan melakukan transaksi, invoice creation, import, payment, schema migration, push, atau deploy.

## 9. Handoff balik ke Codex

Setelah selesai, buat dokumen:

```text
2026-09-12-antigravity-ke-codex-handoff-dashboard-visual-rebuild.md
```

Dokumen balik wajib mencantumkan:

- file yang diubah;
- bagian ZIP yang berhasil dipetakan;
- screenshot/browser evidence;
- TSC/test/diff result;
- temuan yang belum selesai;
- file Fatur yang tidak disentuh;
- konfirmasi tidak ada push/deploy.

Tambahkan satu entri append-only ke `AI-GUEST-ACTIVITY-LOG.md`.

## 10. Status saat handoff dibuat

```text
Codex sudah mengaudit localhost secara langsung: LIVE
ZIP sudah dibaca dan dibandingkan: LOKAL/SOURCE
Dashboard role baru sudah memiliki struktur awal: SOURCE + LIVE
Visual parity dengan ZIP: BELUM LULUS
Expansion inline: BELUM DIIMPLEMENTASI
Handoff Antigravity: DOKUMEN INI
Push/deploy: DILARANG
```

Antigravity diminta mengerjakan visual body sesuai dokumen ini, lalu mengembalikan bukti melalui dokumen handoff balik. Jangan memperluas scope ke auth, database, schema, Fatur lane, push, atau deploy.
