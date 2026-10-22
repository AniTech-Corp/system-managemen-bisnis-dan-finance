# Modul Pajak & Kalender Kepatuhan

Modul ini menambahkan administrasi pajak ke dalam Finance Dashboard (nav `tax`),
bukan modul terpisah. Tujuannya: rekap transaksi relevan, tenggat setor/lapor,
arsip bukti, dan berkas ekspor untuk akuntan dalam satu tempat.

## Cakupan

| Jenis | Sumber angka | Catatan |
| --- | --- | --- |
| PPN | `Invoice` (keluaran) + `CashTransaction` bertanda PPN (masukan) | Hanya dibuat bila `enablePpn` aktif (PKP). |
| PPh Final UMKM | `CashTransaction` masuk | Tarif 0,5%; ambang Rp 500 juta kumulatif khusus Orang Pribadi. |
| PPh 21 | `EmployeePayroll.pph21` | Input manual payroll; `monthYear` teks bebas (`Agustus 2026`). |
| PPh 23 / 4(2) / 26 | `TaxWithholding` | Input manual atau impor CSV/e-Bupot sederhana. |
| BPJS | `EmployeePayroll.bpjs*` | Iuran karyawan + perusahaan. |
| OTHER | Manual / bukti potong | Tidak dibuatkan masa pajak otomatis. |

Template tenggat nasional ada di `src/lib/tax/templates.ts` (kode, bukan tabel),
lalu disalin ke `ComplianceDeadline` per tahun saat halaman dibuka. Tenggat
khusus workspace disimpan sebagai `source = CUSTOM`.

## Data

- `TaxPeriod` — satu baris per jenis pajak × tahun × bulan. Nominal **dihitung
  saat dibaca** dari dokumen sumber; snapshot disimpan saat status menjadi
  `FILED`/`PAID`.
- `ComplianceDeadline` — kalender tenggat. Tenggat `TEMPLATE` yang dihapus akan
  dinonaktifkan (`isActive = false`), bukan dihapus, agar tidak dibuat ulang.
- `TaxDocument` — arsip bukti. `fileId` adalah referensi lunak ke
  `WorkspaceFile.id` (tidak ada relasi Prisma), jadi file tetap hidup di Pusat
  Data walau tautan pajaknya dihapus.
- `TaxWithholding` — bukti potong PPh 21/23/4(2)/26.
- `TaxAccountMap` — pemetaan akun COA untuk rekonsiliasi PPN vs jurnal.
- Kolom aditif di `AccountingSetting` (NPWP, NIK, KPP, tarif, pengingat),
  `Invoice` (PPN/faktur pajak), dan `CashTransaction` (PPN masukan).

Semua perubahan skema bersifat aditif. Jalankan `prisma db push`/migrasi hanya
dengan persetujuan owner sesuai konvensi repo.

## Alur status masa pajak

```
OPEN → READY → FILED → PAID → CLOSED
  ↘     ↘       ↘
        OPEN ← READY ← FILED
PAID → FILED / CLOSED, CLOSED → OPEN
```

Saat menandai `FILED` atau `PAID`, server memeriksa checklist dokumen:

- `PAYMENT_PROOF` bersifat **kritikal** untuk `PAID`.
- `FILING_RECEIPT` bersifat **kritikal** untuk `FILED`/`PAID`.
- Dokumen lain hanya peringatan.

Bila dokumen kritikal belum ada, PATCH mengembalikan `409` dengan
`code = DOCS_INCOMPLETE`. UI menampilkan daftar yang kurang dan meminta alasan
override; kirim ulang dengan `override: true` + `overrideReason`. Status tetap
bisa disimpan, tetapi tercatat di snapshot dan activity log.

## API

| Method | Path | Izin |
| --- | --- | --- |
| GET/PATCH | `/api/v1/tax/settings` | `view` / `manage_settings` |
| GET | `/api/v1/tax/overview?year=&month=` | `view` |
| GET/POST | `/api/v1/tax/periods` | `view` / `draft` |
| GET/PATCH | `/api/v1/tax/periods/[id]` | `view` / `post` |
| GET | `/api/v1/tax/recap?taxType=&year=&month=&groupBy=` | `view` |
| GET/POST | `/api/v1/tax/withholdings` | `view` / `draft` |
| PATCH/DELETE | `/api/v1/tax/withholdings/[id]` | `draft` |
| GET/POST | `/api/v1/tax/deadlines` | `view` / `draft` |
| PATCH/DELETE | `/api/v1/tax/deadlines/[id]` | `draft` |
| GET/POST | `/api/v1/tax/documents` | `view` / `draft` |
| PATCH/DELETE | `/api/v1/tax/documents/[id]` | `draft` |
| GET | `/api/v1/tax/compliance-check?periodId=` | `view` |
| GET | `/api/v1/tax/export?format=xlsx\|csv\|pdf` | `view` |
| POST | `/api/v1/tax/reminders/run` | `draft` |

RBAC memakai modul akuntansi yang sudah ada (`src/lib/accounting/rbac.ts`).
UI mengambil cermin izin dari `GET /api/v1/accounting/permissions`.

## Ekspor

- **XLSX** — ringkasan, rincian per jenis pajak, dokumen, kalender.
- **CSV ZIP** — satu CSV per jenis pajak + README.
- **PDF** — ringkasan siap cetak.

Semua memakai dependensi yang sudah ada (`exceljs`, `jszip`, `src/lib/pdf-engine.ts`).

## Pengingat

Fase ini sengaja **in-app saja**. `POST /api/v1/tax/reminders/run` menghitung
tenggat terlambat/segera dan mencatat satu `ActivityEvent` `tax.reminder` per
hari (idempoten kecuali `force: true`). Belum ada pengiriman WhatsApp/email agar
tidak terjadi pesan ganda.

## Batasan

- Rekap adalah alat bantu administrasi; verifikasi akhir tetap tanggung jawab
  wajib pajak.
- PPh 21/BPJS mengikuti slip gaji, bukan input ganda di modul pajak.
- Tarif dan tenggat dapat berubah; pengguna dapat menyesuaikan di Pengaturan
  Pajak dan menambah tenggat custom.
- Belum ada endpoint unduh file di Pusat Data; daftar dokumen menampilkan nama
  file dan status verifikasi, bukan tautan unduhan langsung.
