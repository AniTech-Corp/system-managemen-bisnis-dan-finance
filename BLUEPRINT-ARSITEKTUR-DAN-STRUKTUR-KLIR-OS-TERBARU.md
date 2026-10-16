# BLUEPRINT ARSITEKTUR & STRUKTUR SISTEM KLIR OS (EDISI LENGKAP UNTUK FATUR)
**Tanggal Rilis Dokumen**: 21 September 2026  
**Otoritas Proyek**: Mecca (Owner AniTech & KLIR)  
**Tujuan Dokumen**: Master Blueprint & Single Source of Truth (SSOT) Arsitektur KLIR OS untuk Fatur. Mencakup seluruh pembaruan sistem database, mekanisme autentikasi/login, struktur 7 modul bisnis, 6 role dashboard (termasuk 3 role manajerial baru), AI Brain Assistant, serta alur integrasi data hulu-ke-hilir.

---

## 1. PETA STRUKTUR ARSITEKTUR GLOBAL (HIGH-LEVEL OVERVIEW)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                ARSITEKTUR UTAMA KLIR OS v1.0                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   [CLIENT TIER] ──► Next.js 14 App Router (React 18 + TailwindCSS + Lucide Icons)                │
│     ├── Public Web: Landing Page (www.klir.id), Login/Register, Pricing, Demo                    │
│     ├── Core App Shell (/): Workspace Switcher, Global Header, Multi-Role Switcher               │
│     ├── 7 Modul Bisnis: WorkspaceView, Finance, Marketing, Inventory, Schedule, CorPlan, AniVirt │
│     └── 6 Role Dashboard: CEO, Finance, Marketing, Sekretaris, Manager Umum, Manager Ops         │
│                                                                                                  │
│   [MIDDLEWARE & SECURITY]                                                                        │
│     ├── Session Guard: JWT Bearer Token validation, Refresh Token rotation                       │
│     ├── Multi-Tenancy Guard: Workspace context resolution via x-workspace-id header              │
│     └── Role-Based Access Control (RBAC): Gatekeeper visibilitas data & dokumen lintas divisi    │
│                                                                                                  │
│   [BACKEND API TIER] ──► 50+ Endpoint (/api/v1/*)                                                │
│     ├── /auth/* ───────► Otentikasi pengguna, session, me, Google OAuth                          │
│     ├── /kas/* ────────► Transaksi kasir, mutasi bank, piutang invoice                           │
│     ├── /inventory/* ──► SKU produk, pergerakan stok, purchase order, retur supplier             │
│     ├── /workspace-files/* ► Unggah file, ekstraksi teks, auto-ingest, reset cascade purge       │
│     ├── /dashboard/role ► Agregator metrik 6 role dashboard (analitis & honest zero-state)       │
│     ├── /brain/* ──────► AI chat, dynamic file lookup, proaktif alert, periodic insight memo     │
│     └── /corplan/* ────► Evaluasi bisnis, SWOT, valuasi startup, PPTX pitchdeck generator        │
│                                                                                                  │
│   [AI COGNITIVE ENGINE] ──► /src/lib/ai-brain/*                                                  │
│     ├── context-engine.ts ────► Snapshot finansial & operasional (RAM cache TTL 60 detik)        │
│     ├── auto-ingest.ts ───────► USB Intelligence (deteksi otomatis kas, stok, tugas, payroll)    │
│     ├── workspace-knowledge.ts► Multi-file context injection (TOP_K = 12 berkas)                │
│     ├── quick-data-router.ts ─► Klasifikasi intent cepat vs deep analytical thinking             │
│     └── generation-engine.ts ─► Generator dokumen eksekutif (PPTX kartu modern, DOCX korporat)   │
│                                                                                                  │
│   [DATABASE TIER] ──► PostgreSQL (via Prisma ORM)                                                │
│     ├── 30+ Model Entitas Terelasi (Multi-Tenant berdasar workspaceId)                           │
│     ├── Composite Indexes: @@index([workspaceId, sourceFileId]) pada tabel transaksional         │
│     └── Atomic Cascading Deletion: Pembersihan referensial 16 domain models tanpa FK Restrict    │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. STRUKTUR SISTEM DATABASE (PRISMA ORM & POSTGRESQL)

Database KLIR OS dirancang dengan paradigma **Strict Multi-Tenancy**. Setiap baris data transaksional, operasional, dan analitis terikat pada `workspaceId`.

### A. Hirarki & Model Entitas Inti
1. **Identitas & Kepemilikan Workspace**:
   - `User`: Akun pengguna utama (`email`, `name`, `passwordHash`, `role`).
   - `Workspace`: Entitas bisnis tenant (`name`, `slug`, `businessType`, `subscriptionTier`).
   - `WorkspaceMember`: Pivot relasi User & Workspace dengan penetapan `role` (`OWNER`, `ADMIN`, `MEMBER`, `VIEWER`).
   - `Subscription` & `CreditAccount`: Manajemen kuota kredit AI dan tagihan berlangganan.

2. **Pusat Berkas & Silsilah Data (Data Provenance)**:
   - `WorkspaceFile`: Berkas yang diunggah (`name`, `fileUrl`, `fileType`, `category`, `status`, `summary`, `extractedContent`).
   - `IngestLog`: Catatan histori pemrosesan USB Intelligence (`actionType`, `targetModel`, `recordCount`, `status`).
   - **Kunci Silsilah (`sourceFileId`)**:
     Kolom `sourceFileId` (Foreign Key opsional ke `WorkspaceFile.id`) disematkan pada model transaksional:
     - `CashTransaction.sourceFileId`
     - `Product.sourceFileId`
     - `WorkTask.sourceFileId`
     Setiap mutasi kas atau data inventori yang lahir dari impor file terikat 1:1 ke berkas asalnya.

3. **Modul Finansial & Kasir**:
   - `CashTransaction`: Pemasukan/pengeluaran (`type`: `INCOME`/`EXPENSE`, `amount`, `category`, `paymentMethod`, `sourceFileId`).
   - `Invoice`: Tagihan piutang pelanggan / hutang vendor (`invoiceNumber`, `dueDate`, `totalAmount`, `status`).
   - `ScheduledObligation`: Kewajiban berkala (sewa outlet, gaji, tagihan vendor).

4. **Modul Stok & Inventori F&B / Ritel**:
   - `Product`: Master SKU produk (`name`, `sku`, `category`, `price`, `cogs` [HPP], `stock`, `minStock`).
   - `ProductBatch`: Pelacakan batch kadaluarsa makanan/minuman (`batchNumber`, `expiryDate`, `quantity`).
   - `StockMovement`: Log keluar-masuk stok (`type`: `IN`/`OUT`/`ADJUST`, `quantity`, `referenceId`).
   - `PurchaseOrder` & `PurchaseOrderItem`: Pembelian bahan baku ke supplier.
   - `StockReturn`: Retur bahan cacat/rusak ke supplier.
   - `SupplierScore`: Evaluasi performa vendor (`deliverySpeed`, `quality`, `pricing`).

5. **Modul SDM & Operasional Kerja**:
   - `WorkTask`: Manajemen tugas tim (`title`, `assigneeId`, `status`, `priority`, `dueDate`).
   - `AttendanceRecord`: Log absensi karyawan (`clockIn`, `clockOut`, `status`).
   - `EmployeePayroll`: Slip dan ringkasan gaji bulanan.

6. **Memori Kognitif & Log Aktivitas**:
   - `MemoryItem`: Penyimpanan fakta bisnis hasil ekstraksi AI dan memo insight role dashboard (`key`, `content`, `category`, `roleTarget`, `expiresAt`).
   - `ActivityEvent`: Audit trail aktivitas workspace secara append-only.

### B. Indeks Performa (Composite Indexing)
Untuk mencegah *Full Table Scan* pada tenant dengan jutaan baris data, indeks komposit non-destruktif telah diterapkan di `prisma/schema.prisma`:
```prisma
model CashTransaction {
  ...
  @@index([workspaceId, date])
  @@index([workspaceId, sourceFileId]) // Baru: Optimasi query silsilah berkas
}

model Product {
  ...
  @@index([workspaceId, category])
  @@index([workspaceId, sourceFileId]) // Baru: Optimasi query silsilah inventori
}

model WorkTask {
  ...
  @@index([workspaceId, status])
  @@index([workspaceId, sourceFileId]) // Baru: Optimasi query silsilah task
}
```

### C. Invarian Cascade Purge Atomik
Pembersihan data saat berkas dihapus atau saat reset Pusat Data dilakukan (`DELETE /api/v1/workspace-files?all=true`) dieksekusi dalam satu transaksi atomik `prisma.$transaction` dengan urutan dependensi ketat:
```
stockReturn ──► stockMovement ──► purchaseOrderItem ──► purchaseOrder
     └──► productBatch ──► product ──► customer ──► supplierScore
     └──► cashTransaction ──► employeePayroll ──► attendanceRecord
     └──► workTask ──► campaign ──► ingestLog ──► memoryItem ──► workspaceFile
```
*Hasil*: 100% bebas dari error *Foreign Key Restrict* dan nol record orphan.

---

## 3. STRUKTUR AUTENTIKASI, LOGIN & SESI PENGGUNA

### A. Alur Login & Penyimpanan Kredensial
- **Login Email/Password**: `POST /api/v1/auth/login` memvalidasi kredensial pengguna terhadap `passwordHash` menggunakan `bcryptjs`.
- **Google OAuth**: Handshake OAuth terintegrasi langsung ke endpoint `/api/v1/auth/google`.
- **Token Dual-Layer**:
  - **Access Token (JWT)**: Masa aktif 15 menit, dikirim via header `Authorization: Bearer <token>`.
  - **Refresh Token**: Masa aktif 30 hari, disimpan di cookie `HttpOnly; Secure; SameSite=Strict` untuk rotasi otomatis.

### B. Header Resolusi Workspace (`x-workspace-id`)
Setiap request ke endpoint internal (`/api/v1/*`) mewajibkan adanya header:
```http
Authorization: Bearer <access_token>
x-workspace-id: <workspace_uuid>
```
Helper `getWorkspaceContext(req)` di backend akan:
1. Memvalidasi apakah user memiliki membership aktif di workspace tersebut (`WorkspaceMember`).
2. Mengembalikan entitas `workspaceId`, `role` member, dan kuota kredit pengguna.
3. Mencegah kebocoran data antar-tenant (*Zero Cross-Tenant Leakage*).

---

## 4. STRUKTUR 7 MODUL BISNIS UTAMA

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               7 MODUL BISNIS UTAMA KLIR OS                                       │
├──────┬──────────────────────┬─────────────────────────┬──────────────────────────────────────────┤
│ No   │ Nama Modul           │ Komponen Frontend       │ Fungsi & Endpoint Terhubung              │
├──────┼──────────────────────┼─────────────────────────┼──────────────────────────────────────────┤
│ [M1] │ Pusat Data           │ KlirWorkspaceView.tsx   │ Unggah dokumen, OCR/ekstraksi teks,      │
│      │ (Workspace Files)    │ WorkspaceDataHub.tsx    │ USB auto-ingest, status pemrosesan.      │
│ [M2] │ Buku Kas             │ FinanceModuleView.tsx   │ Mutasi pemasukan/pengeluaran kasir, POS, │
│      │ (Buku Besar Kasir)   │                         │ buku besar, P&L, arus kas, invoice.      │
│ [M3] │ Promo & Kupon        │ MarketingModuleView.tsx │ Kalender konten, promo WhatsApp/IG/Meta, │
│      │ (Pemasaran Digital)  │                         │ kupon diskon, campaign performance.      │
│ [M4] │ Stok & Bahan Baku    │ KlirInventoryView.tsx   │ Katalog SKU, stok minimum, PO vendor,    │
│      │ (Manajemen Inventori)│                         │ retur bahan, peringatan kadaluarsa F&B.  │
│ [M5] │ Jadwal & Kerja       │ KlirScheduleView.tsx    │ Kanban board tugas, absensi tim harian,  │
│      │ (SDM & Operasional)  │                         │ slip payroll gaji, SOP operasional.      │
│ [M6] │ CorPlan              │ src/app/corplan/*       │ Valuasi bisnis UMKM, analisis SWOT,      │
│      │ (Corporate Planning) │ CorPlanQuickTools.tsx   │ ekspor pitchdeck investor (PPTX/PDF).    │
│ [M7] │ AniVirtual           │ src/app/anivirtual/*    │ Voice AI conversational partner & live   │
│      │ (Virtual Assistant)  │                         │ executive simulation assistant.          │
└──────┴──────────────────────┴─────────────────────────┴──────────────────────────────────────────┘
```

---

## 5. STRUKTUR 6 PORTAL ROLE DASHBOARD & 3 ROLE BARU

KLIR OS menyediakan 6 sudut pandang eksekutif dan operasional yang disesuaikan secara dinamis pada `src/app/components/RoleDashboardView.tsx` dan `src/app/components/DashboardVisuals.tsx`.

```
                    ┌──────────────────────────────┐
                    │      PORTAL ROLE KLIR        │
                    └──────────────┬───────────────┘
           ┌───────────────────────┼───────────────────────┐
           │                       │                       │
     [TIER EKSEKUTIF]        [TIER FUNGSIONAL]      [TIER MANAJERIAL BARU]
     ├── 1. CEO / Owner      ├── 2. Finance         ├── 4. Sekretaris
     │                       └── 3. Marketing       ├── 5. Manager Umum
     │                                              └── 6. Manager Operasional
```

### Penjelasan Lengkap 3 Role Baru (Kebutuhan Khusus Fatur)

#### 1. Role Sekretaris (`SEKRETARIS`)
* **Tujuan**: Mengelola tata kelola dokumen bisnis, kepatuhan legalitas, perpanjangan sewa aset/outlet, dan penjadwalan meeting direksi.
* **4 Kartu Metrik Utama**:
  1. *Dokumen Butuh Tinjauan*: Jumlah dokumen di Pusat Data yang belum diproses.
  2. *Sewa & Kontrak Aktif*: Pelacakan jatuh tempo sewa ruko/outlet dan vendor.
  3. *Tugas Administrasi Open*: Tugas berstatus PENDING di modul kerja.
  4. *Kepatuhan Legalitas*: Status kelengkapan NIB, sertifikasi halal, dan BPOM.
* **Penjelasan Kognitif (Inline Panel)**:
  Dilengkapi panel 6 dimensi (Artinya, Mengapa penting, Sumber data, Cara membaca, Dampak praktis, Rekomendasi).
* **AI Assistant Persona**: Fokus pada administrasi, penyusunan notulensi meeting, draf surat resmi, dan peringatan jatuh tempo legalitas.

#### 2. Role Manager Umum (`MANAGER_UMUM`)
* **Tujuan**: Mengawal efisiensi organisasi harian, pengawasan lintas divisi (keuangan + SDM + operasional), dan produktivitas tim.
* **4 Kartu Metrik Utama**:
  1. *Tingkat Penyelesaian Tugas*: Persentase tugas tim yang selesai tepat waktu.
  2. *Kehadiran Tim Hari Ini*: Rasio kehadiran karyawan dari `AttendanceRecord`.
  3. *Realisasi Anggaran Divisi*: Rasio pengeluaran aktual terhadap batas anggaran.
  4. *Isu Operasional Terbuka*: Rekap eskalasi kendala yang dilaporkan bawahan.
* **Honest Zero-State Rule**:
  Di lingkungan produksi, target omset atau angka simulasi (misal *"Rp 612jt"* atau *"Budget sisa Rp 47jt"*) dipagari di bawah `Boolean(isDemo)`. Jika data kosong, sistem secara jujur menampilkan `Rp 0` dan mengajak pengisian data riil.
* **AI Assistant Persona**: Berperan sebagai konsultan operasional umum, penyeimbang beban kerja tim, dan penilai efisiensi biaya.

#### 3. Role Manager Operasional (`MANAGER_OPERASIONAL`)
* **Tujuan**: Mengontrol rantai pasok dapur/gudang F&B, perputaran stok bahan baku, koordinasi supplier, dan penjadwalan shift kerja.
* **4 Kartu Metrik Utama**:
  1. *Stok Menipis & Kadaluarsa*: Peringatan SKU di bawah safety stock atau mendekati exp date.
  2. *Pesanan Pembelian (PO) Aktif*: Tracking PO yang sedang diproses vendor.
  3. *Karyawan Shift Hari Ini*: Jumlah staf operasional yang aktif bertugas.
  4. *Skor Keandalan Supplier*: Rata-rata skor pengiriman dan mutu vendor.
* **Routing Proaktif**:
  Alert kadaluarsa bahan baku dan stok habis dialirkan secara eksklusif ke portal ini (tidak membocori Sekretaris).
* **AI Assistant Persona**: Spesialis manajemen inventori FIFO, peringatan buffer stock, dan negosiasi jadwal pengiriman supplier.

---

## 6. ARSITEKTUR AI BRAIN ASSISTANT & INTEGRASI DATA

Sistem kecerdasan buatan KLIR OS ditenagai oleh mesin modular di `/src/lib/ai-brain/` yang mengedepankan **akurasi finansial deterministik** (anti-halusinasi).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   ALUR INTEGRASI DATA KE AI BRAIN                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                  │
│   [Dokumen Diunggah] ──► [ekstrak teks via pdf-parse/xlsx] ──► [Simpan ke WorkspaceFile]        │
│                                                                        │                         │
│   ┌────────────────────────────────────────────────────────────────────┴─────────────────────┐   │
│   ▼                                                                                          ▼   │
│ [USB Intelligence / auto-ingest.ts]                                         [RAG Memory Engine]  │
│   ├── Klasifikasi POS Semantik:                                              │                   │
│   │   "GoFood", "GrabFood", "POS Kasir" ──► INCOME (Pendapatan Usaha)       │                   │
│   ├── Parse Mutasi Kas ──► CashTransaction (sourceFileId tagged)            │                   │
│   ├── Parse SKU Bahan  ──► Product & ProductBatch                           │                   │
│   └── Parse Tugas/Gaji ──► WorkTask & EmployeePayroll                       │                   │
│                                                                              │                   │
│   [AI Chat Endpoint (/api/v1/brain/chat)] ◄──────────────────────────────────┘                   │
│     ├── 1. Dynamic File Lookup (baca isi berkas via workspaceFileId)                             │
│     ├── 2. Top-K Knowledge Injection (hingga 12 berkas, batas 14.000 karakter)                   │
│     ├── 3. Context Engine Snapshot (neraca kas, omset, stok kritis, tugas PENDING)               │
│     ├── 4. RBAC Data Visibility (Filter data sensitif sesuai role pengguna)                      │
│     └── 5. Inferensi LLM ──► Jawaban Strategis + Rekomendasi Aksi Nyata                          │
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Prinsip Utama AI Engine KLIR:
1. **Financial Integrity First (Invarian 1)**: LLM dilarang keras mengarang angka saldo atau omset. Angka finansial wajib diambil langsung dari data kueri database yang deterministik.
2. **Dynamic File Lookup**: Pengguna dapat menanyakan dokumen spesifik melalui pintasan *"Tanya AI"* tanpa perlu menyalin isi dokumen.
3. **Multi-File Context Window**: Kapasitas pembacaan dokumen simultan dinaikkan ke 12 berkas untuk mendukung analisis bisnis komprehensif.

---

## 7. MATRIKS RBAC (DATA VISIBILITY & ISOLASI DATA)

Untuk menjaga kerahasiaan bisnis antar-karyawan, hak akses data diatur secara ketat melalui `src/lib/ai-brain/data-visibility.ts`:

| Domain Data / Dokumen | CEO / Owner | Finance | Marketing | Sekretaris | Manager Umum | Manager Ops |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Buku Kas & Saldo Bank** | ✅ Full | ✅ Full | ❌ Blokir | ⚠️ Agregat | ⚠️ Agregat | ❌ Blokir |
| **Kompensasi & Payroll SDM** | ✅ Full | ✅ Full | ❌ Blokir | ✅ Dokumen | ⚠️ Agregat | ❌ Blokir |
| **Katalog Inventori & HPP** | ✅ Full | ✅ Rekap | ⚠️ Non-HPP | ❌ Blokir | ✅ Rekap | ✅ Full |
| **Stok Kedaluwarsa & PO** | ✅ Full | ⚠️ PO Saja | ❌ Blokir | ❌ Blokir | ✅ Full | ✅ Full |
| **Strategi Promo & Kupon** | ✅ Full | ❌ Blokir | ✅ Full | ❌ Blokir | ✅ Rekap | ❌ Blokir |
| **Legalitas, Sewa & Kontrak** | ✅ Full | ⚠️ Biaya Sewa| ❌ Blokir | ✅ Full | ✅ Full | ⚠️ Operasional |

---

## 8. PANDUAN REKOMENDASI UNTUK FATUR (NEXT MILESTONES)

1. **Sinkronisasi Database**:
   Indeks komposit `sourceFileId` telah aktif di PostgreSQL live. Skema saat ini berada dalam kondisi sinkron dan siap dipakai.
2. **Model Tambahan di Masa Depan**:
   Jika Fatur ingin membuat fitur KPI Karyawan dan Budgeting Divisi sepenuhnya dinamis dari database (bukan sekadar input manual), kami merekomendasikan penambahan model `DivisionBudget` dan `TeamKpi` pada iterasi skema berikutnya.
3. **Pembersihan Rutin Log**:
   Tabel `ActivityEvent` dan `IngestLog` bertumbuh secara append-only. Disarankan menyiapkan *retention policy* (misal pembersihan log > 90 hari) via cron job berkala.

---
*Blueprint ini disusun sebagai acuan tunggal pengembangan KLIR OS. Selamat melanjutkan karya brilian ini, Fatur!* 🚀
