# 🏛️ Fondasi Platform Ekosistem KLIR

Fondasi bersama ini adalah kontrak arsitektur yang mengikat seluruh portal divisi perusahaan (CEO, Finance, Marketing, Sekretaris, Manager Umum, Manager Operasional) agar data dan akses berjalan aman, konsisten, dan terisolasi secara multi-tenant.

---

## 1. Alur Fondasi 8 Langkah

Sebelum suatu fitur atau instruksi AI divisi dieksekusi, sistem selalu melewati 8 tahapan terpusat:

```
[1. Login Akun] ➔ [2. Tentukan Workspace] ➔ [3. Cek Langganan] ➔ [4. Cek Akses Divisi]
                                                                        │
[8. Catatan Audit] ⬅ [7. Eksekusi Fitur] ⬅ [6. Potong Kredit] ⬅ [5. Cek Peran (RBAC)]
```

1. **Masuk (Login)**: Sistem login SSO & Kredensial terpusat untuk seluruh divisi perusahaan.
2. **Ruang Kerja (Workspace)**: Menentukan tenant bisnis aktif yang diakses pengguna.
3. **Paket Langganan**: Memvalidasi paket aktif (Free, Started, Business).
4. **Hak Akses Divisi (Division Portal)**: Memastikan pengguna mengakses portal divisi yang sesuai (`DivisionRole`).
5. **Peran Pengguna (RBAC)**: Memeriksa otorisasi peran fungsional (`Role`) dan pembagian divisi (`DivisionRole`).
6. **Kredit**: Mengurangi kredit dari kantong workspace secara transaksi SQL atomis.
7. **Fitur & AI Berjalan**: Menjalankan logika bisnis atau gateway model AI (dengan division system prompt & guardrail).
8. **Catatan Aktivitas**: Menyimpan audit log transaksi untuk keamanan, guardrail, dan pelaporan.

---

## 2. Kontrol Akses Dua Lapis (Two-Layer RBAC & Division Roles)

* **Lapis 1 (Peran Fungsional & Keanggotaan)**:
  * `OWNER` (Pemilik Usaha): Hak penuh atas workspace, billing, dan manajemen anggota.
  * `ADMIN / MANAGER` (Penyetuju): Mengelola akses sumber daya dan menyetujui anggaran/tugas.
  * `MEMBER / VIEWER` (Anggota): Menjalankan fitur sesuai izin yang didelegasikan.
* **Lapis 2 (Divisi Perusahaan / Division Roles)**:
  * `CEO`: Executive Cockpit, akses lintas modul, persetujuan risiko tinggi (CEO Guardrail).
  * `FINANCE`: Pengelolaan Buku Kas masuk/keluar, invoice QRIS, pajak UMKM (PP 55), simulasi HPP & KUR.
  * `MARKETING`: AI Copywriting, kalender konten, kampanye, dan kupon promo.
  * `SEKRETARIS`: Pembuatan surat formal, draf notulen, dan arsip dokumen bisnis.
  * `MANAGER_UMUM`: Pengawasan tugas tim (Kanban), presensi kehadiran karyawan, dan payroll.
  * `MANAGER_OPERASIONAL`: Stok gudang, surat Purchase Order (PO), mutasi stok, retur, dan scoring supplier.

---

## 3. Sistem Ekonomi Kredit Atomis

| Paket | Kuota Kredit | Reset / Kebijakan | Catatan |
|---|---|---|---|
| **Free** | 100 kredit/minggu | Mingguan | Eksplorasi fitur dasar gratis |
| **Started** | 2.000 kredit/minggu | Mingguan + Reserve | Cocok untuk tim kecil (1–5 orang) |
| **Business** | 8.000 kredit/minggu | Mingguan + Reserve | Mendukung BYOK (Bring Your Own Key) & multi-member |

* **Alur Fallback Kredit**: Saldo Mingguan (`weeklyCredit`) ➔ Saldo Cadangan (`reserveCredit`) ➔ Blokir jika saldo habis ➔ Catat ke `CreditLedger`.

---

## 4. Struktur Basis Data Multi-Tenant Inti

Semua tabel wajib menyertakan `workspace_id` untuk mencegah kebocoran data antar-perusahaan:

* `users` & `workspaces`: Identitas akun dan tenant usaha.
* `workspace_members` & `roles`: Pemetaan keanggotaan, peran (`Role`), dan divisi (`DivisionRole`).
* `subscriptions`: Status paket aktif dan tipe akses (`AccessType.KLIR_ALL`).
* `credit_accounts` & `credit_ledgers`: Saldo kredit atomis dan audit trail pemakaian.
* `activity_events`: Catatan aktivitas pengguna untuk keamanan, audit, dan guardrail persetujuan.

