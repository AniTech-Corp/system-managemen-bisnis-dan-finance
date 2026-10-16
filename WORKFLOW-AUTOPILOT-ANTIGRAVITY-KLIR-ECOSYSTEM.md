# MASTER WORKFLOW: KLIR 3-ROLE ECOSYSTEM & AI ASSISTANT REFINEMENT
> Auto-generated & executed by Antigravity Prime | Owner: Mecca (AniTech & KLIR)  
> Tanggal: 12 September 2026 | Mode: AUTOPILOT (Stand-alone execution during Mecca prayer & dinner)  
> Standar Arsitektur: `feedback_workflow_standard_sesi121.md` (10+ Fase, Akar Bercabang, Triple Gate, Full System Involvement)

---

## DAFTAR FASE MASTER WORKFLOW

```
[FASE 1]  Baseline Audit & Discovery State
   │
[FASE 2]  Proactive Alerts Engine Expansion (ProactiveRole 6-Member Union)
   │
[FASE 3]  Assistant Views Wiring: ProactiveAlertsPanel Integration
   │
[FASE 4]  Data Visibility Policy & Granular Financial Permissions Audit
   │
[FASE 5]  Dashboard Visuals Unsupported/Empty State Polish & Data Honesty
   │
[FASE 6]  SessionStorage Prompt Injection & Lifecycle Guard
   │
[FASE 7]  Responsive Layout & Dropdown Viewport Clipping Audit
   │
[FASE 8]  Full TypeScript Compilation Gate (Zero Error Strict)
   │
[FASE 9]  Multi-Suite Automated Testing & Regression Shield
   │
[FASE 10] Localhost Live Runtime & SSR Hydration Inspection
   │
[FASE 11] /learn Codification: Reusable Antigravity Rules & Patterns
   │
[FASE 12] Cross-AI Logging & Final Comprehensive Handoff Generation
```

---

## DETAIL AKAR BERCABANG PER FASE

### FASE 1: Baseline Audit & Discovery State
- **Root Cause / Problem Tree**: Memastikan working directory bersih dari modifikasi tak terduga, server dev aktif, dan tidak ada file di luar scope yang terkontaminasi.
- **Cabang Solusi**:
  - A1: Cek `git status` dan pastikan file Fatur (schema, migrasi, auth core) tetap terlindungi.
  - A2: Cek status HTTP localhost:3000.
- **Skills/Protocols**: `source-command-audit`, `PROT-50-COMPLETION-GATE`.
- **Gate Criteria**: Git tree terkontrol, dev server responsif 200 OK.

### FASE 2: Proactive Alerts Engine Expansion
- **Root Cause / Problem Tree**: `ProactiveRole` di `src/lib/ai-brain/proactive-alerts.ts` sebelumnya terbatas pada `'CEO' | 'FINANCE' | 'MARKETING'`. Hal ini menyebabkan 3 role baru (`SEKRETARIS`, `MANAGER_UMUM`, `MANAGER_OPERASIONAL`) tidak dapat menerima kartu peringatan proaktif (seperti stok kritis untuk Manager Operasional atau peringatan kesehatan bisnis).
- **Cabang Solusi**:
  - B1: Perluas `ProactiveRole` menjadi 6 role lengkap.
  - B2: Perbarui `PROACTIVE_SOURCES` agar `stok` dan `kadaluarsa` menyertakan `MANAGER_OPERASIONAL`.
  - B3: Kalibrasi `alertsFromInventorySummary` agar peringatan stok kritis tidak membanjiri `SEKRETARIS` dan `MANAGER_UMUM`.
- **Gate Criteria**: Unit test `tests/proactive-alerts.test.ts` dan compilation pass.

### FASE 3: Assistant Views Wiring: ProactiveAlertsPanel Integration
- **Root Cause / Problem Tree**: Komentar TODO di `SekretarisAIAssistantView.tsx`, `ManagerAIAssistantView.tsx`, dan `ManagerOperasionalAIAssistantView.tsx` menahan render `<ProactiveAlertsPanel />` karena menunggu union diperluas.
- **Cabang Solusi**:
  - C1: Aktifkan `<ProactiveAlertsPanel role="SEKRETARIS" ... />` di Sekretaris View.
  - C2: Aktifkan `<ProactiveAlertsPanel role="MANAGER_UMUM" ... />` di Manager View.
  - C3: Aktifkan `<ProactiveAlertsPanel role="MANAGER_OPERASIONAL" ... />` di Manager Operasional View lengkap dengan tombol navigasi `onOpenInventory`.
- **Gate Criteria**: Komponen terpasang rapi di atas hero chat, passing compile & tests.

### FASE 4: Data Visibility Policy & Granular Financial Permissions Audit
- **Root Cause / Problem Tree**: Memastikan prinsip "per-tim" untuk Manager Umum dan isolasi data sekretariat/operasional tidak bocor ke data rahasia CEO/Finance.
- **Cabang Solusi**:
  - D1: Verifikasi `canRoleSeeCategoryFinancials` di `data-visibility.ts`.
  - D2: Tulis unit test eksplisit untuk 3 role baru dalam skenario akses file dan batasan finansial.
- **Gate Criteria**: Tests mencakup skenario fail-closed untuk semua role baru.

### FASE 5: Dashboard Visuals Unsupported/Empty State Polish
- **Root Cause / Problem Tree**: Ketika model database belum dimigrasikan oleh Fatur (misal tabel Supplier atau PurchaseOrder resmi), UI tidak boleh menampilkan "undefined" atau crash, melainkan state edukatif yang elegan dan jujur.
- **Cabang Solusi**:
  - E1: Periksa seluruh fallback status di `DashboardVisuals.tsx`.
  - E2: Pastikan banner/badge status `Belum tersedia` dan `Belum ada data` memiliki warna dan deskripsi yang menenangkan pengguna.
- **Gate Criteria**: Render tanpa crash pada payload parsial/kosong.

### FASE 6: SessionStorage Prompt Injection & Lifecycle Guard
- **Root Cause / Problem Tree**: Tombol "Tanyakan ke AI Assistant" pada inline panel harus bersih membersihkan storage setelah dibaca agar tidak terjadi persistensi prompt berulang saat refresh halaman.
- **Cabang Solusi**:
  - F1: Verifikasi `sessionStorage.removeItem('klir_initial_prompt')` langsung setelah `setInputMessage`.
- **Gate Criteria**: Chat input hanya terisi 1x per klik aksi dari dashboard.

### FASE 7: Responsive Layout & Dropdown Viewport Clipping Audit
- **Root Cause / Problem Tree**: Sesuai temuan Bug 2 di handoff Claude, dropdown composer yang membuka ke atas rentan terpotong tepi layar pada layar laptop/tablet.
- **Cabang Solusi**:
  - G1: Verifikasi margin bawah hero (168px) tetap terjaga di semua 6 view.
  - G2: Pastikan inline accordion panel pada dashboard dapat di-scroll vertikal dengan nyaman di layar kecil.
- **Gate Criteria**: Tidak ada overflow horizontal atau klip visual.

### FASE 8: Full TypeScript Compilation Gate
- **Perintah**: `npx tsc --noEmit -p tsconfig.json`
- **Toleransi**: 0 error (STRICT).

### FASE 9: Multi-Suite Automated Testing
- **Perintah**: Menjalankan seluruh test suite terkait role, kebijakan data, proaktif alerts, dan core orchestrator.
- **Toleransi**: 100% PASS.

### FASE 10: Localhost Live Runtime & SSR Hydration Inspection
- **Pemeriksaan**: Curl/fetch `http://localhost:3000`, cek log dev server apakah ada error runtime atau hydration warning.

### FASE 11: /learn Codification: Reusable Antigravity Rules & Patterns
- **Tindakan**: Merumuskan rules & lessons learned dari pembangunan dashboard dan integrasi lintas-AI ke dalam sistem memori Antigravity.

### FASE 12: Cross-AI Logging & Final Comprehensive Handoff Generation
- **Tindakan**:
  - Perbarui `AI-GUEST-ACTIVITY-LOG.md`.
  - Tulis laporan akhir komprehensif untuk diaudit Mecca saat kembali.
