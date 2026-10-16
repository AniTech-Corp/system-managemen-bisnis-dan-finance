# 🗺️ Integrasi Data Lintas-Pilar & Roadmap Ekosistem KLIR

Dokumen ini merangkum alur transmisi data antar-pilar, strategi Public vs Private tier, serta prioritas pengerjaan.

---

## 🔄 1. Matriks Alur Transmisi Data Antar-Pilar

```
┌────────────────┐      (Bagikan Konteks Usaha)     ┌────────────────┐
│    CorPlan     ├─────────────────────────────────►│   AniVirtual   │
└───────┬────────┘                                  └───────┬────────┘
        │ (Snapshot Anggaran)                               │ (Approval Pengeluaran)
        ▼                                                   ▼
┌────────────────┐          (Katalog Produk)        ┌────────────────┐
│    KLIR Kas    ├─────────────────────────────────►│   KLIR Promo   │
└────────────────┘                                  └────────────────┘
```

| Dari ➔ Ke | Pemicu (Trigger) | Data yang Ditransmisikan | Catatan Keamanan / Validasi |
|---|---|---|---|
| **CorPlan ➔ AniVirtual** | Tombol "Bagikan Konteks" | Nama usaha, jenis industri, target pasar | Hanya ringkasan, bukan strategi rahasia / proyeksi omset |
| **CorPlan ➔ KLIR Kas** | Paket Data Usaha | Snapshot alokasi anggaran per kategori | Berupa data *snapshot* (statis), bukan live binding |
| **CorPlan ➔ KLIR Promo** | Buka Modul Promo | Katalog produk (nama, deskripsi, harga) | Salinan disimpan terpisah agar aman jika master CorPlan diedit |
| **AniVirtual ➔ KLIR Kerja** | Tugas disepakati di chat | Judul tugas, assignee, deadline, link chat | Berupa saran konfirmasi (tidak langsung auto-create) |
| **AniVirtual ➔ KLIR Kas** | Pengajuan dana disetujui | Nominal, kategori, penanggung jawab, tanggal | Jika offline, masuk antrean retry otomatis |
| **KLIR Kas ➔ KLIR Promo** | Buka Katalog Publik | Nama produk, status stok, harga | Wajib tampil "Stok Habis" jika sisa stok = 0 |

---

## 🏢 2. Strategi Dual-Tier: Public (SaaS) vs Private (Enterprise)

| Fitur | Versi Public (SaaS / UMKM) | Versi Private (Korporat / On-Premise) |
|---|---|---|
| **Komunikasi / Pesan** | In-App Web Chat & Email Notification | WhatsApp Business API Resmi (Dedicated Account) |
| **Rekonsiliasi Bank** | Upload mutasi manual (CSV / PDF) + AI Matcher | Integrasi Live Direct Open Banking API |
| **Payment Gateway** | Akun Sub-Merchant Bersama AniTech | Akun Merchant Mandiri (Xendit / Midtrans Klien) |
| **AI Video Promo** | Durasi pendek dengan kuota kredit standar | Durasi panjang + Dedicated Rendering Pipeline |
| **Meta Auto-Publish** | Generate konten + Manual Post Reminder | Direct Auto-Posting via Approved Meta App ID |
| **Audio-to-SOP / Notulen** | Durasi rekaman dibatasi per sesi | Pemrosesan audio durasi panjang tanpa batas |

---

## 🚀 3. Status Realisasi Pembangunan Teknis (Live Implementation)

1. ✅ **Fondasi Platform Bersama**: Multi-tenant Workspace, DB Schema Neon Postgres, RBAC, dan Atomic Credit Ledger. *(Live & Verified)*
2. ✅ **CorPlan Core Module (Pilar 1)**: AI Proposal 6 Bab, Slide Deck, HPP Calculator, Simulator KUR, Valuasi & SWOT. *(Live & Verified)*
3. ✅ **AniVirtual Core Module (Pilar 2)**: 4 Multi-Tone Agent, Budget Checker, 4-Week Roadmap, Memory Scope. *(Live & Verified)*
4. ⏸️ **Repository Hukum (Pilar 3)**: *ON-HOLD / Deactivated per request pengguna*.
5. ✅ **KLIR Kas (Pilar 4)**: Buku Kas Digital, Digital Invoicing QRIS/VA, PPh Final UMKM 0.5%, Runway Forecast, Financial Health Score. *(Live & Verified)*
6. ✅ **KLIR Promo (Pilar 5)**: AI Copywriting 4 Nada Lokal, Kalender Konten 7 Hari, Kupon Diskon, BioLink Digital & WA Direct. *(Live & Verified)*
7. ✅ **KLIR Kerja (Pilar 6)**: Papan Tugas Kanban, Presensi GPS Mobile, Penggajian Slip Gaji (Auto Kas), Penilaian KPI, Voice/Text-to-SOP Onboarding. *(Live & Verified)*
8. ✅ **KLIR Booking (Pilar 7)**: Kalender Reservasi Jadwal, Antrean Tiket Digital Walk-In, Pengingat WhatsApp Resmi, Ulasan & Poin Loyalitas. *(Live & Verified)*
9. ✅ **Workflows Engine & Integrasi Lintas-Pilar (Pilar 8)**: Event Dispatcher Cascading Actions, 5 Preset Template Otomasi, Audit Trail Logs `workflow_logs`. *(Live & Verified)*
