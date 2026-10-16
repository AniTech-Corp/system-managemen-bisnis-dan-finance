# PERHATIAN -- BACA DULU SEBELUM PAKAI ISI ZIP INI (KLIR Kas)

## HASIL PENGECEKAN 3 RISIKO (WhatsApp / Repository Hukum / BYOK)

Potongan kode `KLIR-Kas-page-tsx-excerpt.tsx` sudah dicek untuk 3 hal yang dilarang di
paket Publik: integrasi WhatsApp, ketergantungan ke Repository Hukum, dan opsi BYOK
(user memasukkan kunci API AI miliknya sendiri).

- **WhatsApp**: tidak ditemukan.
- **BYOK**: tidak ditemukan.
- **Repository Hukum**: TIDAK ditemukan ketergantungan fungsional. Ada satu kemunculan kata
  "Hukum" -- yaitu label **"Dasar Hukum"** di kalkulator Pajak UMKM, yang menampilkan
  rujukan aturan pajak (contoh: dasar hukum PPh Final UMKM) sebagai teks informatif hasil
  kalkulasi. Ini SEKADAR label teks statis pada hasil hitung pajak, BUKAN link/integrasi ke
  modul Repository Hukum yang sudah nonaktif/diarsipkan. Aman dijadikan referensi -- boleh
  didesain sebagai teks kecil "dasar hukum: [nama regulasi]" di kartu hasil kalkulasi pajak.

## CATATAN UMUM
Potongan kode di zip ini adalah kode ASLI dari aplikasi fungsional yang sudah dibangun Tim
Pengembang -- disertakan sebagai referensi fitur/copy/struktur data, BUKAN untuk ditiru 1:1
sebagai layout visual. Bahasa visual WAJIB ikut `SISTEM-DESAIN-BERSAMA.md` + rujukan
CorPlan v5 / AniVirtual v5 (ada di zip terpisah `SISTEM-DESAIN-BERSAMA-4-pilar.zip`).

Cakupan modul: buku kas single-ledger, invoice digital QRIS/VA, kalkulator pajak UMKM
0.5%, dan proyeksi runway. Model Prisma yang disertakan: `CashTransaction`, `Invoice`,
plus `CreditLedger` dan `FeatureCost` (dua model terakhir ini bersifat UMUM/lintas-pilar,
relevan untuk indikator biaya kredit di UI -- lihat `SISTEM-DESAIN-BERSAMA.md` bagian 4).
