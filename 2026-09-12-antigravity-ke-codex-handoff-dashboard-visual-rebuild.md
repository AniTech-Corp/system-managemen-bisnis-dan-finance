# Handoff: Antigravity -> Codex (Dashboard Visual Rebuild 3 Role Baru)
**Tanggal**: 12 September 2026  
**Pelaksana**: Antigravity  
**Penerima**: Codex / Mecca  
**Status**: [LOKAL-TESTED] Lolos `tsc --noEmit` (0 error), 13/13 unit tests PASS, dev server `http://localhost:3000` status 200 OK.  

---

## 1. Ringkasan Eksekutif

Menindaklanjuti handoff dari Codex (`2026-09-12-codex-ke-antigravity-handoff-dashboard-visual-rebuild.md`), Antigravity telah menyelesaikan penulisan ulang (**rebuild**) visual body dashboard untuk 3 role baru di KLIR:
1. **SEKRETARIS** (Dashboard Sekretariat / Administrasi Eksekutif)
2. **MANAGER_UMUM** (Dashboard Kinerja Tim & Operasional Cabang)
3. **MANAGER_OPERASIONAL** (Dashboard Rantai Pasok, Stok Gudang & PO Pembelian)

Rebuild ini mengadopsi 100% struktur desain dari 3 ZIP Claude Design yang diekstrak dari Downloads:
- `C:\Users\mausx\Downloads\Dashboard Sekretaris KLIR.zip`
- `C:\Users\mausx\Downloads\Dashboard Manager KLIR.zip`
- `C:\Users\mausx\Downloads\Desain dashboard manager operasional.zip`

---

## 2. Implementasi & Fitur Visual yang Selesai

### A. Penghapusan Right Drawer & Penggantian dengan Inline Expansion Panel
- **Sebelumnya**: Tombol "Jelaskan" memicu drawer geser dari sisi kanan layar (`DashboardExplanationDrawer`) yang menutupi konten kerja dan terasa terputus dari konteks metrik.
- **Sekarang**: Setiap card metrik dan tabel memiliki tombol **"Jelaskan"** yang membuka **`InlineExplanationPanel`** tepat di bawah baris/elemen yang bersangkutan (collapsible accordion inline).
- **6 Bagian Terstruktur Sesuai Spek**:
  1. *Artinya*: Penjelasan definisi bahasa manusia (didukung kamus `matchGlossaryTerm`).
  2. *Mengapa penting*: Relevansi bisnis & dampak terhadap tata kelola tim/stok.
  3. *Sumber data*: Model database autoritatif KLIR (`WorkTask`, `Product`, `Agenda`, dsb.).
  4. *Cara membaca*: Panduan visual batas toleransi (warna hijau vs kuning vs merah).
  5. *Dampak praktis*: Risiko jika angka diabaikan atau dibiarkan terlambat.
  6. *Rekomendasi tindakan*: Langkah konkret yang disarankan untuk role tersebut.
- **Tombol "Tanyakan ke AI Assistant"**:
  - Menyusun prompt terstruktur yang membawa label, status, nilai, detail, dan sumber resmi.
  - Menyimpan prompt ke `sessionStorage.setItem('klir_initial_prompt', prompt)`.
  - Mengarahkan navigasi otomatis ke view AI Assistant role yang relevan.
  - Ketiga AI Assistant View (`SekretarisAIAssistantView`, `ManagerAIAssistantView`, `ManagerOperasionalAIAssistantView`) membaca prompt tersebut pada saat mount dan langsung memasukkannya ke input chat.

---

### B. Detail Visual per Role

#### 1. SEKRETARIS (Aksen `#4E9BFF`)
- **4 Top HUD KPI Cards**:
  - Tugas Admin Pending (`WorkTask`)
  - Agenda Hari Ini (`Agenda`)
  - Dokumen Workspace (`WorkspaceFile`)
  - Kehadiran Tim Hari Ini (`AttendanceRecord`)
  - Semua kartu dilengkapi HUD corner brackets, badge status role-contract, dan toggle panel penjelasan inline.
- **Kotak Masuk Administratif (Tabel Surat & Dokumen Aktif)**:
  - Tab filter: *Semua*, *Menunggu Disposisi*, *Draf Kontrak*, *Arsip*.
  - Status pills warna-warni (`Tersedia`, `Perlu dicek`, `Belum ada data`).
  - Baris tabel responsif dengan aksi "Jelaskan" per item.
- **Agenda Rapat & Notulensi**:
  - Timeline jadwal rapat hari ini dan minggu ini lengkap dengan jam, durasi, dan indikator status.
- **Pelacak Kontrak & Perizinan**:
  - Daftar perizinan legal dan masa berlaku kontrak vendor.
- **Wawasan & Prediksi AI**:
  - Rekomendasi tindakan prioritas otomatis dari kontrak backend.

#### 2. MANAGER_UMUM (Aksen `#D8A33C`)
- **4 Top HUD KPI Cards**:
  - Target Bulanan Tercapai (dengan SVG Sparkline 7-hari dinamis)
  - Anggota Tim Aktif
  - Kepatuhan SOP Unit
  - Alert Butuh Keputusan
- **Matriks Kinerja Cabang / Tim**:
  - Tabel perbandingan performa outlet/unit dengan indikator progress bar pencapaian, tren kenaikan/penurunan (SVG arrows), dan status kepatuhan.
- **Distribusi Beban Kerja (Donut Gauge SVG `92x92`)**:
  - Gauge visual lingkaran untuk utilisasi jam kerja tim, rasio kehadiran, dan status penugasan.
- **Budget Operasional Tim & Ringkasan Marketing Lokal**:
  - Realisasi anggaran operasional unit vs pagu anggaran bulanan.
- **Wawasan & Prediksi AI**:
  - Rekomendasi manajerial untuk mitigasi bottleneck tim dan alokasi sumber daya.

#### 3. MANAGER_OPERASIONAL (Aksen `#3FBF8F`)
- **4 Top HUD KPI Cards**:
  - Item Stok Kritis (`Product.minStock`)
  - PO Pembelian Berjalan (`PurchaseOrder`)
  - Kepatuhan SOP Gudang / Dapur
  - Nilai Valuasi Stok
- **Peta Stok Semua Cabang (Matriks Gudang & Outlet)**:
  - Matriks perbandingan stok bahan baku antar lokasi gudang/outlet.
  - Status pill peringatan untuk SKU yang menipis atau perlu restock segera.
- **Purchase Order Lifecycle (3-Column Kanban Board)**:
  - Kolom 1: *Draf PO* (rencana pengadaan)
  - Kolom 2: *Menunggu Disetujui* (tinjauan manajer)
  - Kolom 3: *Terkirim ke Supplier* (eksekusi logistik)
- **Kinerja Supplier**:
  - Tabel peringkat supplier berdasarkan *on-time delivery rate*, *quality score*, dan pesanan aktif.
- **SOP Checklist & Pintasan Modul**:
  - Checklist kepatuhan sanitasi, inventory audit, dan tombol langsung ke `KlirInventoryView` (read-only).

---

## 3. Berkas yang Dibuat / Dimodifikasi

1. **`src/app/components/DashboardVisuals.tsx`**:
   - Berkas komponen visual utama (2.883 baris TSX murni, bebas error).
   - Berisi `InlineExplanationPanel`, `SekretarisBodyView`, `ManagerBodyView`, `ManagerOperasionalBodyView`, `ROLE_META`, `getStructuredExplanation()`, fungsi utilitas visual SVG sparkline/donut, dan ekspor kompatibilitas mundur (`DashboardCharts`, `DashboardMindMap`, `DashboardInsightPanel`, `DashboardExplanationDrawer`).
2. **`src/app/components/RoleDashboardView.tsx`**:
   - Menghubungkan switch mode `overview` untuk merender view spesifik per role.
   - Menyediakan handler `handleOpenAI(prompt)` dengan integrasi `sessionStorage`.
   - Menjaga tab `charts` dan `mindmap` tetap berfungsi penuh.
3. **`src/app/components/SekretarisAIAssistantView.tsx`**:
   - Menambahkan `useEffect` untuk menangkap `klir_initial_prompt` dari sessionStorage saat mount.
4. **`src/app/components/ManagerAIAssistantView.tsx`**:
   - Menambahkan `useEffect` untuk menangkap `klir_initial_prompt` dari sessionStorage saat mount.
5. **`src/app/components/ManagerOperasionalAIAssistantView.tsx`**:
   - Menambahkan `useEffect` untuk menangkap `klir_initial_prompt` dari sessionStorage saat mount.
6. **`tests/role-dashboard-visuals.test.ts`**:
   - Unit test baru mencakup verifikasi metadata `ROLE_META`, kontrak 6-bagian `getStructuredExplanation`, validasi helper status data, dan definisi seksi dashboard.

---

## 4. Hasil Verifikasi Kualitas

| Gate / Pengujian | Perintah / Alat | Hasil | Catatan |
|---|---|---|---|
| **Type Checking** | `npx tsc --noEmit -p tsconfig.json` | **PASS (0 error)** | Bersih total, tidak ada type mismatch |
| **Visual Unit Test** | `tests/role-dashboard-visuals.test.ts` | **PASS (4/4)** | Kontrak 6 bagian terverifikasi |
| **Role Dashboard Tests** | `tests/role-policy.test.ts`, `tests/role-dashboard-language.test.ts`, `tests/dashboard-insight-role-route.test.ts` | **PASS (9/9)** | Fail-closed policy & glossary aman |
| **Existing Core Tests** | `npm test` (`activity-log.test.ts`, `ai-orchestrator.test.ts`) | **PASS (20/20)** | Tidak ada regresi sistem |
| **Dev Server Runtime** | `http://localhost:3000` | **PASS (HTTP 200)** | Next.js server merespons lancar |

---

## 5. Batasan & Zona Fatur (Patuhi Penuh)

- **Database / Schema**: Nol perubahan pada `prisma/schema.prisma` dan migrasi PostgreSQL.
- **Autentikasi & Sesi**: Nol perubahan pada login/session logic.
- **Landing Page & File Eksternal**: Tidak menyentuh landing page maupun folder di luar workspace yang sah.
- **Kejujuran Data (Data Honesty)**: Tidak ada angka dummy statis yang dipaksakan seolah data live. Semua metrik tetap terikat pada status kontrak backend (`available`, `empty`, `unsupported`, `forbidden`, `error`).

---

## 6. Rekomendasi Langkah Lanjutan untuk Codex / Sesi Mendatang

1. **Backend Enrichment (Jika Fatur menyetujui)**:
   - Endpoint `/api/v1/dashboard/role` saat ini telah siap menerima payload tambahan (misal: jika tabel `Supplier` atau `PurchaseOrder` sudah dimigrasikan oleh Fatur). Komponen UI di frontend sudah secara otomatis memetakan data jika statusnya `available`.
2. **Review Tampilan Langsung**:
   - Mecca dapat mencoba langsung navigasi antar role (`SEKRETARIS`, `MANAGER_UMUM`, `MANAGER_OPERASIONAL`), menguji tombol "Jelaskan" di berbagai kartu, dan mencoba tombol "Tanyakan ke AI Assistant" untuk melihat prompt terisi secara otomatis di AI chat.
