# Peta Jalan Modul Laporan Keuangan

Dokumen ini adalah rencana kerja sampai fase akhir. Isinya: apa yang **sudah
selesai**, apa yang **berikutnya**, urutan pengerjaan, kriteria diterima, dan
risiko yang harus diputuskan sebelum mulai. Dokumen modul yang sudah berjalan
ada di `docs/11_MODUL_LAPORAN_KEUANGAN.md`.

Status terakhir: **Fase 0–3.3, 3.1, dan 3.2 selesai**, termasuk laporan pendukung
(umur piutang/utang, ringkasan PPN), anggaran, pajak payroll (PPh 21 & BPJS input
manual), persediaan & HPP rata-rata bergerak, serta pembayaran sebagian & alokasi
dokumen (split payment). Konsinyasi sudah menjadi utang usaha. 237 pemeriksaan
smoke + 81 unit test hijau.

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
   `npm test` (81) dan `node scripts/accounting-smoke.mjs` (237) tetap hijau.

---

## 1. Sudah selesai

| Fase | Isi | Bukti |
| --- | --- | --- |
| 0 | Skema akuntansi (8 enum, 9 model), CoA 61 akun, pengaturan, periode | `prisma/schema.prisma`, `coa-seed.ts` |
| 1 | 7 laporan utama, jurnal manual, buku besar, saldo awal, ekspor Excel, cetak | `reports.ts`, UI tab `laporan` |
| 2 | Integrasi piutang (AR), utang (AP Opsi A), tutup tahun, hierarki CoA | `posting.ts`, `period-actions.ts` |
| 2.5 | Pintu tunggal kas: payroll, inventori, booking, workflow, AI, impor rekening koran | `recordCashTransaction()` |
| 2.5 | Laporan umur piutang/utang + ringkasan PPN | `aux-reports.ts`, tab Umur & PPN |
| 2.5 | Konsinyasi menjadi utang usaha (bukan pengurangan kas) | `consignment-engine.ts` |
| 2.6 | Anggaran tahunan + realisasi vs anggaran | `budgets.ts`, tab Anggaran |
| 3.3 | PPh 21 & BPJS pada slip gaji + setoran kewajiban | `payroll.ts`, tab Gaji & Pajak |
| 3.1 | Persediaan & HPP rata-rata bergerak + kartu stok & kontrol akun 1-1400 | `inventory.ts`, `inventory-report.ts`, tab Persediaan |
| 3.2 | Pembayaran sebagian & alokasi dokumen (split payment, status PARTIAL) | `settlement.ts`, `settlement-service.ts`, `PaymentAllocation` |

Yang **belum** dari cita-cita "lengkap": uang muka pelanggan (lebih bayar),
multi-mata uang, PDF server-side, rekonsiliasi bank, dan pengerasan produksi.
Itu isi fase berikutnya.

---

## 2. Fase 2.6 — Anggaran & realisasi ✅ SELESAI

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

## 3. Fase 3.1 — Persediaan & HPP ✅ SELESAI

Sebelum fase ini, pembelian stok langsung menjadi beban sehingga laba turun di
bulan pembelian walau barang belum terjual.

**Keputusan yang diambil.**

1. **Metode penilaian: rata-rata bergerak** (bukan FIFO). Tidak perlu tabel layer.
2. **Sumber HPP:** nilai buku produk (`products.inventory_value`), bukan
   `costPrice` saja. Harga rata-rata diturunkan dari nilai/qty.
3. **Konsinyasi** tetap terpisah (utang usaha, selesai di fase sebelumnya).

**Skema.** Tidak ada tabel baru. `Product` hanya menambah satu kolom:

```prisma
inventoryValue Float @default(0) @map("inventory_value")
```

Alasan tidak memakai `ProductCost` terpisah: `currentStock` dan `costPrice` sudah
ada di `Product`, dan nilai buku harus diperbarui dalam transaksi yang sama agar
tidak pernah berbeda dari kartu stok. Yang disimpan adalah **nilai**, bukan hanya
rata-rata, sehingga `nilai sisa = nilai sebelumnya − HPP` selalu tepat (bebas
selisih pembulatan).

Helper murni: `src/lib/accounting/inventory.ts` (`applyIncomingStock`,
`applyOutgoingStock`, `averageUnitCost`, `isInventoryValued`).

**Alur jurnal.**

```
Pembelian stok        Dr 1-1400 Persediaan            / Cr Kas
Penjualan barang      Dr Kas/Piutang                  / Cr Pendapatan
                      Dr 5-1100 HPP                   / Cr 1-1400 Persediaan
Retur dari pelanggan  Dr 1-1400 Persediaan            / Cr 5-1100 HPP
Retur ke supplier     Dr 6-9100 Selisih Persediaan    / Cr 1-1400
Stok opname lebih     Dr 1-1400 Persediaan            / Cr 6-9100
Stok opname kurang    Dr 6-9100 Selisih Persediaan    / Cr 1-1400
```

- `recordCashTransaction` menerima `debitAccountCode` supaya pembelian mendebit
  aset, bukan akun kategori beban (tetap satu pintu kas, satu jurnal).
- Jurnal persediaan non-kas memakai `source = INVENTORY` (enum baru) dengan
  `sourceId` dokumen sumber, sehingga constraint unik tetap mencegah jurnal dobel.
- Akun baru `6-9100 Selisih Persediaan`; dibuat otomatis bila workspace lama
  belum menyiapkan ulang bagan akun.
- `sale.cogs` dikembalikan di response penjualan untuk UI & pengujian.

**API & UI.**

- `POST /inventory/purchase-orders` → `Dr 1-1400`; rata-rata & nilai buku
  diperbarui atomik bersama stok.
- `POST /inventory/sales` → tambah jurnal HPP per penjualan (barang titip jual
  dikecualikan).
- `POST /inventory/returns` & `/inventory/stock-adjustments` → menyesuaikan nilai
  buku dan menjurnal selisihnya.
- Laporan `GET /accounting/reports/inventory` (nilai persediaan + kartu stok)
  dan tab **Persediaan** (`InventoryView.tsx`).

**Kriteria diterima — terpenuhi.**

- Saldo `1-1400` = total nilai stok dari kartu stok (selisih 0 di pengujian).
- Menjual 1 item: pendapatan naik, HPP naik, persediaan turun sebesar biaya.
- Laba kotor sesuai (pendapatan − HPP); penjualan tidak menambah beban operasional.
- Neraca tetap balance setelah pembelian, penjualan, retur, dan opname.
- 21 pemeriksaan smoke baru (total 217) + 6 unit test rata-rata bergerak.

**Batasan yang diketahui.**

- `StockMovement` tidak punya tanggal bisnis, jadi Kartu Stok memakai bulan
  pencatatan (`created_at`), sementara jurnal memakai `transactionDate`.
- Perubahan `costPrice`/`inventoryValue` manual tidak membuat jurnal; laporan
  menampilkan selisih terhadap `1-1400` sebagai peringatan.
- Retur ke supplier dicatat sebagai selisih persediaan; penggantian/refund supplier
  dicatat manual.

**Estimasi awal.** 5–8 hari (risiko tinggi karena menyentuh semua alur stok).

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

## 5. Fase 3.3 — Pajak payroll (PPh 21 & BPJS) ✅ SELESAI

**Keputusan.** Input manual (opsi 1). Sistem **tidak** menghitung tarif pajak;
PPh 21 dan BPJS diisi dari aplikasi payroll resmi, lalu dijurnal dan dipantau
sampai disetor. Mesin TER (PP 58/2023) sengaja tidak dibangun di v1.

**Skema `EmployeePayroll` (Float, mengikuti modul payroll yang ada).**

```prisma
pph21            Float @default(0)
bpjsEmployee     Float @default(0) @map("bpjs_employee")
bpjsEmployer     Float @default(0) @map("bpjs_employer")
otherDeductions  Float @default(0) @map("other_deductions")
// `deductions` tetap TOTAL potongan = pph21 + bpjsEmployee + otherDeductions
```

`grossSalary` tidak disimpan — bruto dihitung dari
`basicSalary + allowance + overtime` agar tidak ada dua angka yang bisa
berbeda. Perhitungan murni ada di `src/lib/accounting/payroll.ts`
(`computePayroll`), dipakai server dan UI.

**Jurnal saat slip.**

```
Dr 6-1100 Beban Gaji            (bruto + BPJS pemberi kerja)
    Cr 2-1200 Utang Gaji        (gaji bersih)
    Cr 2-1320 PPh 21            (pph21)
    Cr 2-1340 Utang BPJS        (bpjsEmployee + bpjsEmployer)
    Cr 2-1350 Utang Karyawan    (potongan lain)
```

Sisa potongan dihitung sebagai selisih agar jurnal dijamin balance dengan
`netSalary` yang tersimpan, termasuk slip lama yang hanya punya `deductions`.

**Jurnal saat bayar & setor.**

```
Bayar gaji   Dr 2-1200 / Cr Kas
Setor PPh    Dr 2-1320 / Cr Kas
Setor BPJS   Dr 2-1340 / Cr Kas
Potongan lain Dr 2-1350 / Cr Kas
```

Setoran memakai `CashTransaction.settlementAccountId`: kas keluar melunasi
liabilitas, bukan menambah beban. Endpoint: `GET/POST /api/v1/kerja/payroll/taxes`.

**UI.** Tab **Gaji & Pajak** (`PayrollView.tsx`): buat slip dengan rincian
potongan, pratinjau bruto/bersih/biaya perusahaan, daftar slip, tombol bayar,
serta kartu saldo PPh 21/BPJS/potongan lain dengan tombol "Setor penuh".

**Kriteria diterima — terpenuhi.**

- Bruto = gaji bersih + PPh 21 + BPJS karyawan + potongan lain.
- Beban gaji di Laba Rugi = bruto + BPJS pemberi kerja (sekali per slip).
- BPJS pemberi kerja tidak mengurangi gaji bersih.
- Utang PPh/BPJS nol setelah disetor; setoran tidak menambah beban.
- Slip yang sudah dibayar tidak bisa dibayar ulang.
- Potongan melebihi bruto ditolak.

**Bukti.** 14 pemeriksaan smoke baru (total 196) + 4 unit test `computePayroll`.

**Sisa untuk fase lanjutan.** Bukti potong 1721-A1, rekap PPh per karyawan,
dan kalkulasi TER otomatis belum dibuat.

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
| ~~1~~ | ~~2.6 Anggaran~~ | Selesai |
| ~~1~~ | ~~3.3 Payroll (input manual)~~ | Selesai |
| ~~1~~ | ~~3.1 Persediaan & HPP~~ | Selesai |
| 4 | 3.2 Pembayaran sebagian | Dibutuhkan setelah volume transaksi naik |
| 5 | 3.7 Pengerasan produksi | Sebelum go-live serius |
| 6 | 3.6 Rekonsiliasi bank | Mengurangi kerja manual staf keuangan |
| 7 | 3.5 PDF & laporan terjadwal | Kenyamanan, bukan kebenaran angka |
| 8 | 3.4 Multi-mata uang | Hanya bila benar-benar ada transaksi valas |

Fase 3.7 bisa dimajukan bila sistem langsung dipakai untuk pembukuan nyata.

---

## 11. Risiko & keputusan yang harus diambil

1. ~~**Metode persediaan** (rata-rata vs FIFO).~~ **Sudah diputuskan &
   dikerjakan:** rata-rata bergerak dengan nilai buku di `products.inventory_value`.
2. ~~**PPh 21 dihitung sistem atau diinput.**~~ **Sudah diputuskan & dikerjakan:**
   input manual (PPh 21 & BPJS dari aplikasi payroll resmi), tanpa mesin TER.
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
