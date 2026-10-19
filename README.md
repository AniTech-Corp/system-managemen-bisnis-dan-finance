# system-managemen-bisnis-dan-finance

> **KLIR OS — Sistem Manajemen Bisnis & Finance Monitoring**
Inteligensi finansial perusahaan, monitoring likuiditas & arus kas, operasional tim, dan otomatisasi alur kerja (workflows).

![KLIR OS Architecture](https://img.shields.io/badge/Stack-Next.js%2016%20%7C%20Neon%20Postgres%20%7C%20Prisma%206.3.1%20%7C%20Gemini%20AI-5e6ad2?style=for-the-badge)

---

## ⚡ Teknologi & Arsitektur Utama

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript
- **Styling System**: TailwindCSS + Linear.app Obsidian Dark Theme (`#08090a`) + Multi-Layered Glassmorphic Components
- **Database & ORM**: Neon Serverless Postgres DB + Prisma ORM 6.3.1 (21 Database Tables)
- **AI Execution Gateway**: Google Gemini AI API (`@google/generative-ai`)
- **Tenant Isolation**: Strict Multi-Tenant Isolation via `WHERE workspace_id = X` & RBAC Roles (`OWNER`, `ADMIN`, `MANAGER`, `MEMBER`, `VIEWER`)
- **Ekonomi Kredit Atomis**: SQL Atomic Transactions (`weeklyCredit` ➔ `reserveCredit` fallback ➔ `credit_ledger` audit trail)

---

## 💼 Modul Utama Ekosistem

### 1. 📄 CorPlan Proposal AI
- **AI Proposal Generator (6 Bab)**: Menghasilkan dokumen proposal bisnis 6 bab terstruktur lengkap via Google Gemini AI & Neon DB.
- **Kalkulator HPP & Profit Margin** (`POST /api/v1/corplan/calculate-hpp`): Menghitung total HPP per unit, laba kotor, margin %, dan omset bulanan secara presisi.
- **Simulator Angsuran KUR** (`POST /api/v1/corplan/simulate-kur`): Menghitung simulasi cicilan bulanan KUR (bunga subsider 6%, tenor 12–60 bulan).
- **Hybrid Last-Write-Wins (LWW) Sync**: Menyingkronkan versi revisi dokumen (`revisionSeq`) antara client dan server.

### 2. 🤖 AniVirtual Assistant
- **Multi-Scenario Tone Generator**: Menghasilkan 3 draf balasan pesan otomatis (*Formal Eksekutif*, *Semi-Formal*, *Gen Z Startup*) beserta analisis sentimen.
- **CapEx/OpEx Budget Checker**: Memverifikasi pengajuan anggaran ke kredit proyek CorPlan dan menerbitkan Purchase Order otomatis (`PO-ANIVIRTUAL-...`).
- **Memory Isolation Scope**: Menyimpan dan mengisolasi memori instruksi tim (`PERSONAL` vs `WORKSPACE`).

### 3. ⚡ Workflows Engine
- **Trigger ➔ Action Automation**: Menghubungkan kejadian lintas modul (misal: `corplan.generate.success` ➔ `anivirtual.generate_email_draft`).
- **Audit Logs Live**: Menyorot riwayat eksekusi otomatisasi di tabel `workflow_logs`.

---

## 🚀 Panduan Memulai (Quick Start)

### 1. Install Dependensi
```bash
npm install
```

### 2. Konfigurasi Environment Variables (`.env`)
```env
DATABASE_URL="postgresql://neondb_owner:...@ep-twilight-sea-a1b2c3d4-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:...@ep-[#direct-host]/neondb?sslmode=require"
GEMINI_API_KEY="AIzaSy..."
JWT_SECRET="super-secret-key"
```

### 3. Jalankan Server Dev
```bash
npm run dev
```
Aplikasi berjalan di **`http://localhost:3000`**.

---

## 📜 Lisensi & Hak Cipta
Copyright © 2026 AniTech Dev. All Rights Reserved.
