# Peta Jalan Modul Laporan Keuangan

Dokumen ini adalah rencana kerja sampai fase akhir. Isinya: apa yang **sudah
selesai**, apa yang **berikutnya**, urutan pengerjaan, kriteria diterima, dan
risiko yang harus diputuskan sebelum mulai. Dokumen modul yang sudah berjalan
ada di `docs/11_MODUL_LAPORAN_KEUANGAN.md`.

Status terakhir: **Fase 0–2.5 selesai**, termasuk laporan pendukung (umur
piutang/utang dan ringkasan PPN). 166 pemeriksaan smoke + 59 unit test hijau.

---

## 0. Aturan main (berlaku di semua fase)

Tidak boleh dilanggar, karena inilah yang membuat angka bisa dipercaya:

1. **Satu sumber kebenaran.** Laporan utama hanya membaca `journal_lines` dengan
   `journal_entries.status = POSTED`. Tidak boleh membaca `cash_transactions`,
   `invoices`, atau `scheduled_obligations` untuk menghasilkan angka laporan.
   Laporan pendukung (aging) boleh membaca dokumen, tetapi wajib menampilkan
   saldo buku besar sebagai pembanding.
2. **Pintu tunggal kas.** Setiap modul yang menyentuh uang memakai
   `recordCashTransaction()` (`src/lib/accounting/posting.ts`). Menambah
   `cashTransaction.create` di tempat lain = bug.
3. **Jurnal posted tidak pernah diubah.** Koreksi hanya lewat jurnal pembalik.
4. **Periode tertutup tidak bisa disentuh.** `createJournalInTx` menolak tanggal
   di periode `CLOSED`/`LOCKED`, kecuali jurnal penutup tahun.
5. **Uang selalu `Prisma.Decimal`.** Konversi dari `Float` hanya di batas modul
   lama, lewat `toMoney()`.
6. **Setiap perubahan pada `reports.ts`, `posting.ts`, `journal-service.ts`,
   `period-actions.ts`, `account-tree.ts`, atau `aux-reports.ts` wajib menjaga
   `npm test` (59) dan `node scripts/accounting-smoke.mjs` (166) tetap hijau.

---

## 1. Sudah selesai

| Fase | Isi | Bukti |
| --- | --- | --- |
| 0 | Skema akuntansi (8 enum, 9 model), CoA 58 akun, pengaturan, periode | `prisma/schema.prisma`, `coa-seed.ts` |
| 1 | 7 laporan utama, jurnal manual, buku besar, saldo awal, ekspor Excel, cetak | `reports.ts`, UI tab `laporan` |
| 2 | Integrasi piutang (AR), utang (AP Opsi A), tutup tahun, hierarki CoA | `posting.ts`, `period-actions.ts` |
| 2.5 | Pintu tunggal kas: payroll, inventori, booking, workflow, AI, impor rekening koran | `recordCashTransaction()` |
| 2.5 | Laporan umur piutang/utang + ringkasan PPN | `aux-reports.ts`, tab Umur & PPN |

Yang **belum** dari cita-cita "lengkap": anggaran, HPP persediaan, pembayaran
sebagian, pajak payroll rinci, multi-mata uang, PDF server-side, rekonsiliasi
bank, dan pengerasan produksi. Itu isi fase berikutnya.

---

## 2. Fase 2.6 — Anggaran & realisasi

**Tujuan.** Owner bisa menetapkan target bulanan per akun dan melihat realisasi
vs anggaran tanpa berpindah aplikasi.

**Skema.**

```prisma
model Budget {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  fiscalYear  Int      @map("fiscal_year")
  accountId   String   @map("account_id") @db.Uuid
  // 12 angka bulanan; lebih mudah dibanding 12 baris dan cukup untuk laporan.
  monthly     Json     @db.JsonB
  note        String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  account   Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, fiscalYear, accountId])
  @@map("budgets")
}
```

**API.**

- `GET /api/v1/accounting/budgets?year=2026` → anggaran + realisasi YTD per akun.
- `PUT /api/v1/accounting/budgets` → simpan satu akun (12 bulan) atau impor massal.
- `GET /api/v1/accounting/reports/budget?period=YYYY-MM` → realisasi vs anggaran
  (bulan ini, YTD, selisih, % serapan).

**Aturan.**

- Hanya akun `REVENUE`/`EXPENSE` yang bisa dianggarkan (bukan akun neraca).
- Realisasi memakai mesin laporan yang sama (`getIncomeStatement`), bukan query
  baru, supaya angkanya identik dengan Laba Rugi.
- Anggaran tidak memengaruhi jurnal sama sekali (murni rencana).
- Akun nonaktif tetap ditampilkan bila sudah punya anggaran, dengan penanda.

**UI.** Tab baru "Anggaran": tabel akun × 12 bulan (input), ringkasan serapan
per kelompok, dan peringatan bila realisasi > 100% sebelum tahun berjalan.

**Kriteria diterima.**

- Mengisi anggaran tidak membuat jurnal apa pun.
- Laporan realisasi = angka Laba Rugi untuk akun yang sama (diuji smoke).
- Total anggaran per kelompok = jumlah baris akun.
- Ekspor Excel memuat sheet "Anggaran vs Realisasi".

**Estimasi.** 2–3 hari. Risiko rendah.

---

## 3. Fase 3.1 — Persediaan & HPP

Ini fase terbesar dan paling berisiko. Sekarang pembelian stok langsung menjadi
beban (`5-1100`), sehingga laba bisa turun di bulan pembelian walau barang belum
terjual.

**Keputusan yang harus diambil lebih dulu.**

1. **Metode penilaian:** rata-rata bergerak (disarankan, sederhana & tahan
   audit) atau FIFO. FIFO butuh layer per pembelian dan lebih rawan salah.
2. **Sumber HPP:** `Product.costPrice` (sekarang) atau biaya rata-rata per
   gudang setelah pembelian.
3. **Konsinyasi:** sudah dipisah menjadi utang usaha (selesai).

**Skema.**

```prisma
model InventoryLayer {          // hanya bila memilih FIFO
  id           String   @id @default(uuid()) @db.Uuid
  workspaceId  String   @map("workspace_id") @db.Uuid
  productId    String   @map("product_id") @db.Uuid
  receivedAt   DateTime @map("received_at")
  qtyRemaining Decimal  @db.Decimal(18,3) @map("qty_remaining")
  unitCost     Decimal  @db.Decimal(18,2) @map("unit_cost")
  sourceType   String   @map("source_type")
  sourceId     String?  @map("source_id") @db.Uuid
  @@index([workspaceId, productId, receivedAt])
  @@map("inventory_layers")
}

model ProductCost {             // rata-rata bergerak
  productId  String  @id @db.Uuid
  workspaceId String @map("workspace_id") @db.Uuid
  avgCost    Decimal @db.Decimal(18,2) @map("avg_cost")
  qtyOnHand  Decimal @db.Decimal(18,3) @map("qty_on_hand")
  @@unique([workspaceId, productId])
  @@map("product_costs")
}
```

**Alur jurnal.**

```
Pembelian stok      Dr 1-1400 Persediaan        / Cr Kas atau 2-1100 Utang
Penjualan barang    Dr Kas/Piutang              / Cr 4-1200 Pendapatan
                    Dr 5-1100 HPP               / Cr 1-1400 Persediaan
Retur penjualan     Dr 4-2000 Retur Penjualan   / Cr Kas/Piutang
                    Dr 1-1400 Persediaan        / Cr 5-1100 HPP
Stok opname kurang  Dr 6-9100 Selisih Persediaan/ Cr 1-1400
```

**API & UI.**

- `POST /inventory/purchase-orders` → ganti pemetaan kategori ke akun
  `1-1400`, bukan `5-1100`.
- `POST /inventory/sales` → tambah jurnal HPP otomatis per item (satu jurnal
  `CASH_TX` + satu jurnal `COGS` dengan `source = ADJUSTMENT` atau sumber baru
  `INVENTORY`).
- Laporan "Kartu Stok" (mutasi per produk) dan "Nilai Persediaan" (neraca
  pendukung) dengan kontrol saldo `1-1400`.
- Peringatan bila qty minus atau biaya rata-rata nol.

**Kriteria diterima.**

- Saldo `1-1400` = total nilai stok dari kartu stok (selisih 0).
- Menjual 1 item: pendapatan naik, HPP naik, persediaan turun sebesar biaya.
- Laba kotor tidak berubah bila harga jual & biaya tetap.
- Neraca tetap balance setelah pembelian, penjualan, retur, dan opname.
- Smoke menambah minimal 15 pemeriksaan baru.

**Estimasi.** 5–8 hari. Risiko tinggi (butuh keputusan metode).

---

## 4. Fase 3.2 — Pembayaran sebagian & alokasi dokumen

Sekarang pelunasan harus penuh; satu faktur = satu pembayaran.

**Skema.**

```prisma
model PaymentAllocation {
  id             String   @id @default(uuid()) @db.Uuid
  workspaceId    String   @map("workspace_id") @db.Uuid
  cashTxId       String   @map("cash_tx_id") @db.Uuid
  invoiceId      String?  @map("invoice_id") @db.Uuid
  obligationId   String?  @map("obligation_id") @db.Uuid
  amount         Decimal  @db.Decimal(18,2)
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([workspaceId, invoiceId])
  @@index([workspaceId, obligationId])
  @@map("payment_allocations")
}
```

**Aturan.**

- `Invoice.paidAmount` (atau jumlah alokasi) menentukan status: `UNPAID` →
  `PARTIAL` (status baru) → `PAID`.
- Satu transfer bisa dialokasikan ke beberapa faktur (split payment).
- Pembatalan alokasi membuat jurnal pembalik, bukan menghapus jurnal.
- Aging memakai sisa tagihan, bukan nilai penuh.
- Uang muka (deposit) yang belum dialokasikan masuk akun `2-1500 Uang Muka
  Pelanggan`; perlu tambah akun di CoA (dan pemetaan).

**Kriteria diterima.**

- Faktur 10 jt dibayar 4 jt → status `PARTIAL`, piutang tersisa 6 jt.
- Dua pembayaran 3 jt + 3 jt → `PAID` tepat saat total 10 jt.
- Lebih bayar ditolak atau masuk uang muka (pilih salah satu, dokumentasikan).
- Aging menampilkan sisa, bukan nilai penuh.
- Neraca & Laba Rugi tidak berubah karena pembayaran (hanya kas vs piutang).

**Estimasi.** 4–6 hari. Risiko sedang.

---

## 5. Fase 3.3 — Pajak payroll (PPh 21 & BPJS)

Sekarang `deductions` masih satu angka gabungan; belum ada PPh 21, BPJS
karyawan/pemberi kerja, atau bukti potong.

**Skema tambahan pada `EmployeePayroll`.**

```prisma
grossSalary      Decimal @db.Decimal(18,2) @map("gross_salary")
pph21            Decimal @default(0) @db.Decimal(18,2)
bpjsEmployee     Decimal @default(0) @map("bpjs_employee") @db.Decimal(18,2)
bpjsEmployer     Decimal @default(0) @map("bpjs_employer") @db.Decimal(18,2)
otherDeductions  Decimal @default(0) @map("other_deductions") @db.Decimal(18,2)
netSalary        Decimal @db.Decimal(18,2) @map("net_salary")
```

**Jurnal saat slip.**

```
Dr 6-1100 Beban Gaji            (gross + bpjsEmployer)
    Cr 2-1200 Utang Gaji        (net)
    Cr 2-1320 PPh 21            (pph21)
    Cr 2-1330 Utang BPJS        (bpjsEmployee + bpjsEmployer)
```

**Jurnal saat bayar & setor.**

```
Bayar gaji   Dr 2-1200 / Cr Kas
Setor PPh    Dr 2-1320 / Cr Kas
Setor BPJS   Dr 2-1330 / Cr Kas
```

**Perhitungan.** Jangan menulis mesin pajak sendiri di v1. Dua pilihan:

1. **Input manual** (disarankan untuk v1): staf mengisi PPh 21 & BPJS dari
   aplikasi payroll resmi; sistem hanya menjurnal dan menyimpan bukti.
2. **Kalkulasi TER** (PP 58/2023) untuk PPh 21: tarif efektif bulanan berdasarkan
   PTKP + kategori TER. Butuh tabel resmi dan pengujian per kategori.

**Kriteria diterima.**

- Gross = net + PPh 21 + BPJS karyawan + potongan lain.
- Beban gaji di Laba Rugi = gross + BPJS pemberi kerja (sekali per slip).
- Utang PPh/BPJS nol setelah disetor.
- Slip yang sudah dibayar tidak bisa dibayar ulang.
- Ringkasan PPN/PPh menampilkan saldo utang pajak per akun.

**Estimasi.** 3–5 hari (input manual) atau 7–10 hari (kalkulasi TER).

---

## 6. Fase 3.4 — Multi-mata uang

Kolom `currency` dan `exchange_rate` sudah ada, tetapi belum dikelola.

**Keputusan.** Mata uang fungsional per workspace (IDR) + mata uang transaksi.
Laporan selalu dalam mata uang fungsional.

**Skema.**

```prisma
model ExchangeRate {
  id          String   @id @default(uuid()) @db.Uuid
  workspaceId String   @map("workspace_id") @db.Uuid
  currency    String   @db.VarChar(3)
  rateDate    DateTime @map("rate_date")
  rate        Decimal  @db.Decimal(18,6)
  @@unique([workspaceId, currency, rateDate])
  @@map("exchange_rates")
}
```

**Aturan.**

- Jurnal menyimpan `currency`, `exchangeRate`, dan `amountForeign`; nilai rupiah
  tetap di `debit`/`credit`.
- Selisih kurs saat pelunasan → akun `7-2000 Laba/Rugi Selisih Kurs` (tambah CoA).
- Revaluasi akhir periode opsional (jarang untuk UMKM; tunda bila tidak perlu).
- Faktur & kewajiban menyimpan mata uang dan kurs saat terbit.

**Kriteria diterima.**

- Faktur USD 1.000 kurs 16.000 → piutang Rp16.000.000.
- Dibayar saat kurs 16.200 → selisih Rp200.000 masuk laba selisih kurs.
- Neraca tetap balance; total aset memakai kurs terakhir yang dipakai.
- Laporan tetap satu angka (rupiah), dengan catatan kurs.

**Estimasi.** 5–7 hari. Risiko sedang-tinggi.

---

## 7. Fase 3.5 — Penyajian laporan

| Item | Rencana | Estimasi |
| --- | --- | --- |
| PDF server-side | Render HTML laporan → PDF (Playwright/Chromium di server, bukan library berat di bundle Next). Simpan ke `workspace_files` dan beri tautan unduh. | 3 hari |
| Laporan terjadwal | Tabel `report_schedules` + cron (Vercel Cron / `node-cron` di VPS) → kirim PDF + ringkasan ke email owner tiap awal bulan. | 3 hari |
| Perbandingan YTD & tahun lalu | Sudah ada `comparative`; lengkapi untuk Arus Kas & Neraca Saldo, plus grafik tren 12 bulan. | 2 hari |
| Tampilan cetak | Rapikan header/footer cetak (nama workspace, periode, "Dicetak oleh", nomor halaman). | 1 hari |

**Kriteria diterima.** PDF identik dengan tampilan cetak, bisa diunduh ulang,
dan laporan terjadwal tercatat di `activity_events` (berhasil/gagal).

---

## 8. Fase 3.6 — Rekonsiliasi bank

Impor rekening koran sudah ada, tetapi belum ada pencocokan.

**Alur.**

1. Impor mutasi bank (sudah).
2. Sistem menyarankan pasangan: nominal sama + tanggal ±3 hari + arah sama.
3. Staf menandai "cocok" / "buat transaksi baru" / "abaikan".
4. Laporan rekonsiliasi: saldo bank menurut statement vs saldo buku besar,
   item belum cocok, dan selisih.

**Skema.** `BankStatementLine` (sudah ada di impor?) + `matchStatus`,
`matchedCashTxId`. Bila belum ada tabel permanen, tambahkan.

**Kriteria diterima.** Selisih rekonsiliasi = 0 setelah semua item dicocokkan,
dan item yang diabaikan punya alasan.

**Estimasi.** 4–6 hari.

---

## 9. Fase 3.7 — Pengerasan produksi

Wajib sebelum dipakai bisnis nyata.

| Item | Kondisi sekarang | Target |
| --- | --- | --- |
| Migrasi database | `prisma db push` (tidak ada riwayat) | Baseline `prisma/migrations` + prosedur deploy |
| Backup & restore | Belum didefinisikan | Backup harian + uji restore bulanan |
| Audit trail | `activity_events` ada, tanpa UI | Layar audit (siapa, kapan, apa) + filter |
| Retensi | Belum ada | Kebijakan retensi jurnal & berkas |
| Monitoring | Log server saja | Alert error rate, job gagal, selisih neraca |
| Kinerja | Laporan muat semua baris | Index + pagination + uji 100 ribu baris |
| Keamanan | RBAC dasar | Review izin per peran + uji lintas workspace |

**Kriteria diterima.**

- Deploy dari nol memakai migrasi (bukan `db push`).
- Restore backup menghasilkan angka laporan identik.
- Semua aksi sensitif (tutup buku, hapus jurnal, ubah CoA) terlihat di audit.
- Uji beban: laporan 12 bulan < 3 detik untuk 100 ribu baris.

**Estimasi.** 5–7 hari.

---

## 10. Urutan pengerjaan yang disarankan

| Urutan | Fase | Alasan |
| --- | --- | --- |
| 1 | 2.6 Anggaran | Cepat, langsung berguna untuk analisis owner |
| 2 | 3.3 Payroll (input manual) | Menutup celah pajak tanpa mesin pajak yang rawan |
| 3 | 3.1 Persediaan & HPP | Dampak terbesar ke akurasi laba; butuh keputusan metode |
| 4 | 3.2 Pembayaran sebagian | Dibutuhkan setelah volume transaksi naik |
| 5 | 3.7 Pengerasan produksi | Sebelum go-live serius |
| 6 | 3.6 Rekonsiliasi bank | Mengurangi kerja manual staf keuangan |
| 7 | 3.5 PDF & laporan terjadwal | Kenyamanan, bukan kebenaran angka |
| 8 | 3.4 Multi-mata uang | Hanya bila benar-benar ada transaksi valas |

Fase 3.7 bisa dimajukan bila sistem langsung dipakai untuk pembukuan nyata.

---

## 11. Risiko & keputusan yang harus diambil

1. **Metode persediaan** (rata-rata vs FIFO) — menentukan skema dan laporan.
   Tanpa keputusan ini Fase 3.1 tidak bisa dimulai.
2. **PPh 21 dihitung sistem atau diinput** — menentukan apakah perlu tabel TER
   resmi dan pengujian pajak.
3. ~~**Konsinyasi** — baris kas mengurangi kas padahal uang belum keluar.~~
   **Sudah diputuskan & dikerjakan:** konsinyasi kini menjadi utang usaha
   (`ScheduledObligation`) dengan jurnal `Dr HPP / Cr Utang Usaha`; kas baru
   keluar saat utang dibayar.
4. **Kebijakan lebih bayar** — ditolak atau menjadi uang muka pelanggan.
5. **Multi-mata uang** — hanya kerjakan bila ada kebutuhan nyata; biayanya besar.
6. **Migrasi produksi** — jangan menunda; `db push` tidak punya rollback.

---

## 12. Checklist memulai fase berikutnya

1. Tentukan fase + keputusan di atas.
2. Tambah skema → `npx prisma db push` (dev) dan siapkan migrasi bila sudah
   masuk Fase 3.7.
3. Tulis mesin/laporan lebih dulu, UI belakangan.
4. Tambah unit test untuk fungsi murni, smoke untuk alur end-to-end.
5. Jalankan `npx tsc --noEmit`, `npm test`, `npm run build`, lalu
   `node scripts/accounting-smoke.mjs` pada DB kosong.
6. Perbarui `docs/11_MODUL_LAPORAN_KEUANGAN.md` dan dokumen ini.
7. Satu commit atomik per fase, dengan pesan `feat(akuntansi): ...`.
