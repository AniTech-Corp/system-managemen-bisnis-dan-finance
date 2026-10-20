# Modul Laporan Keuangan (Double-Entry)

Dokumen ini menjelaskan modul akuntansi berpasangan di KLIR OS: apa yang dibangun,
aturan yang tidak boleh dilanggar, dan apa yang belum ada.

Status: **Fase 1 (versi uji)** — siap dipakai untuk pembukuan harian, laporan
bulanan, dan ekspor. Fase 2/3 ada di bagian [Belum ada](#belum-ada).

---

## 1. Prinsip yang tidak boleh dilanggar

1. **Semua laporan membaca `journal_lines`, tidak pernah `cash_transactions`.**
   `CashTransaction` hanya pintu masuk (dokumen sumber). Kalau ada laporan yang
   menghitung langsung dari transaksi kas, akan muncul dua versi kebenaran dan
   selisihnya tidak bisa dijelaskan ke owner.

2. **Uang memakai `Decimal(18,2)`, bukan `Float`.**
   `CashTransaction.amount` yang lama tetap `Float` (warisan) dan dikonversi di
   batas lewat `src/lib/accounting/money.ts`. Jangan menambah kolom uang bertipe
   `Float`.

3. **Jurnal yang sudah POSTED tidak boleh diedit atau dihapus.**
   Koreksi dilakukan dengan jurnal pembalik (`REVERSAL`). Baris asli tetap ada
   sebagai jejak audit dan ditandai lewat kolom `reversed_by`.

4. **Jurnal harus balance** (total debit = total kredit). Divalidasi di
   `journal-service.ts` sebelum menyentuh database, dan tidak ada jalan pintas
   `force` — satu-satunya pengecualian adalah saldo awal, yang selisihnya
   dimasukkan ke akun Saldo Laba secara eksplisit.

5. **Periode terkunci menolak jurnal baru.**
   `fiscal_periods.status` = `OPEN | CLOSING | CLOSED | LOCKED`.

6. **Waktu memakai zona `Asia/Jakarta` (UTC+7), bukan zona server.**
   Semua batas bulan dihitung lewat `src/lib/accounting/period.ts`.

7. **Transaksi kas dan jurnalnya dibuat dalam satu transaksi database.**
   Kalau penjurnalan gagal (mis. kategori belum dipetakan), transaksi kasnya ikut
   batal. Tidak boleh ada transaksi kas tanpa jurnal saat modul aktif.

---

## 2. Alur pemakaian (untuk admin/staf keuangan)

```
Pengaturan → Siapkan bagan akun (sekali saja)
   ↓
Pengaturan → Pemetaan kategori (sekali, bisa ditambah kapan saja)
   ↓
Saldo Awal (sekali, tanggal mulai pembukuan)
   ↓
Transaksi kas harian (otomatis terjurnal)  ⟷  Jurnal manual (draft → posting)
   ↓
Faktur penjualan & kewajiban terjadwal (otomatis terjurnal, basis akrual)
   ↓
Laporan: Laba Rugi · Neraca · Arus Kas · Perubahan Ekuitas · Neraca Saldo · Buku Besar
   ↓
Ekspor Excel / Cetak PDF
   ↓
Akhir bulan: Tutup buku → (owner) Kunci periode
   ↓
Akhir tahun buku: Tutup Tahun → laba dipindah ke Saldo Laba
```

### Hak akses

| Aksi | Minimal peran |
| --- | --- |
| Lihat laporan & buku besar | VIEWER |
| Buat/hapus jurnal draft, hapus transaksi kas | MEMBER |
| Posting jurnal, tutup buku bulanan/tahun, ubah bagan akun & pemetaan | ADMIN |
| Isi saldo awal, ubah pengaturan (profil pajak, bentuk badan, tanggal mulai), kunci/buka periode | OWNER |

Sumber kebenaran izin: `src/lib/accounting/rbac.ts`. UI hanya menyembunyikan
tombol; server selalu memeriksa ulang.

### Perbedaan "Buku Kas" dan "Laporan Keuangan"

- Tab **Buku Kas & Transaksi** = arus kas mentah (masuk/keluar), apa adanya,
  dari `cash_transactions`.
- Tab **Laporan Keuangan** = pembukuan berpasangan (accrual). Angka bisa berbeda
  dari Buku Kas karena beban yang sudah terjadi tapi belum dibayar (utang),
  pendapatan yang belum diterima (piutang), penyusutan, dan saldo awal.

Perbedaan ini **normal** dan justru alasan modul ini ada. Sumber selisih yang
paling sering ditanyakan:

1. Beban penyusutan — ada di laporan, tidak ada di buku kas (tidak ada uang keluar).
2. Saldo awal — hanya ada di laporan.
3. Jurnal penyesuaian manual — hanya ada di laporan.

### Mencatat piutang & utang

- **Piutang** — terbitkan faktur di tab **Buku Kas & Transaksi**. Pendapatannya
  langsung masuk laporan, walau uangnya belum diterima. Saat klien membayar,
  catat pemasukan di Buku Kas lalu pilih fakturnya di kolom **"Lunasi faktur"**
  (nominal terisi otomatis). Uang masuk itu mengurangi piutang, bukan menambah
  pendapatan. Nominal harus sama dengan total faktur.
- **Utang** — catat di kartu **Kewajiban Terjadwal**. Bebannya langsung diakui.
  Saat tagihan dibayar, klik ikon centang (**Tandai lunas**): kas keluar dan
  utang berkurang, tanpa menambah beban lagi. Ikon silang membatalkan kewajiban
  (jurnal bebannya dibalik).

Semua jurnal di atas dibuat otomatis — tidak perlu jurnal manual.

### Tutup tahun buku (jurnal penutup)

Tutup buku bulanan hanya mengunci periode. Untuk mengakhiri **tahun buku**,
jalankan **Tutup Tahun** pada periode bulan terakhir tahun buku (Desember bila
tahun buku mulai Januari — mengikuti `fiscalYearStartMonth`).

Yang dilakukan sistem, dalam satu transaksi database:

1. Menghitung saldo seluruh akun pendapatan & beban sepanjang tahun buku
   (jurnal `OPENING` dan `CLOSING` tidak ikut dihitung).
2. Membuat satu jurnal `CLOSING` bertanggal hari terakhir tahun buku:
   - **Dr** semua akun pendapatan → menolkan saldo kreditnya,
   - **Cr** semua akun beban → menolkan saldo debitnya,
   - selisihnya **Cr** `3-2000 Saldo Laba` bila laba, atau **Dr** bila rugi.
3. Menutup periode bulan terakhir (`CLOSED`).

Sesudah tutup tahun:

- **Neraca**: baris "Laba Tahun Berjalan" menjadi 0 dan labanya pindah ke
  "Saldo Laba". **Total ekuitas tidak berubah** — hanya berpindah baris.
- **Laba Rugi**: angka tahun tersebut **tetap utuh**, karena mesin laporan
  sengaja mengecualikan jurnal `CLOSING`.
- **Perubahan Ekuitas** tahun berikutnya otomatis memakai Saldo Laba sebagai
  ekuitas awal.
- **Neraca Saldo**: akun pendapatan/beban bersaldo nol, Saldo Laba bertambah.

Aturan dan penolakan:

- Hanya bisa dijalankan **sekali** per tahun buku; percobaan kedua ditolak
  dengan menyebut nomor jurnal penutup yang sudah ada.
- Tidak boleh ada jurnal **DRAFT** di tahun buku tersebut.
- Periode bulan terakhir tidak boleh `LOCKED` (buka dulu).
- Hanya bisa dijalankan pada **bulan terakhir** tahun buku.
- Bila ada kesalahan setelah tutup tahun: buat **jurnal pembalik** atas jurnal
  penutup, lalu jurnal penyesuaian. Jangan menghapus jurnal penutup.

---

## 3. Struktur data

Tabel baru (semua diawali penanda "Additive 19 Okt 2026" di `prisma/schema.prisma`):

| Tabel | Isi |
| --- | --- |
| `accounts` | Bagan akun (CoA). `is_postable = false` berarti akun header, tidak boleh dipakai di jurnal. `is_system = true` berarti dipakai logika otomatis, tidak boleh dihapus. |
| `cash_accounts` | Rekening kas/bank nyata (Kas Kecil, Bank Utama). Setiap rekening menunjuk satu akun CoA. |
| `partners` | Pelanggan/supplier (dipakai untuk piutang & utang, opsional). |
| `fiscal_periods` | Periode bulanan + statusnya. |
| `journal_entries` | Header jurnal: nomor, tanggal, sumber, status, total. |
| `journal_lines` | Baris debit/kredit. Menyimpan `cash_account_id` supaya arus kas bisa dipisahkan. |
| `accounting_settings` | Satu baris per workspace: profil pajak, bentuk badan, tanggal mulai, akun sistem. |
| `category_account_maps` | Pemetaan kategori transaksi kas → akun CoA. |
| `document_sequences` | Penomoran jurnal otomatis (`JE-2026-11-0001`). |

### Penomoran jurnal

Nomor dibuat dengan satu perintah SQL atomik
(`INSERT ... ON CONFLICT DO UPDATE ... RETURNING`) sehingga dua staf yang
menyimpan bersamaan tidak mungkin mendapat nomor yang sama.

### Jenis sumber jurnal (`journal_entries.source`)

`MANUAL`, `CASH_TX`, `OPENING`, `ADJUSTMENT`, `CLOSING`, `REVERSAL`,
`INVOICE`, `INVOICE_PAYMENT`, `OBLIGATION`, `OBLIGATION_PAYMENT`, `PAYROLL`,
`INVENTORY`.

Yang sudah dipakai Fase 1: `MANUAL`, `CASH_TX`, `OPENING`, `REVERSAL`.
Unik per `(workspace_id, source, source_id)` → dokumen sumber tidak bisa
dijurnal dua kali.

### Perlakuan jurnal saldo awal (OPENING)

Jurnal `OPENING` diperlakukan sebagai **posisi awal**, bukan aktivitas periode,
walau tanggalnya jatuh di hari pertama periode. Karena itu:

- Laporan Arus Kas menampilkan saldo kasnya sebagai **Kas Awal**, bukan sebagai
  setoran modal di periode berjalan.
- Laporan Perubahan Ekuitas menampilkannya sebagai **Ekuitas Awal**.
- Laba Rugi tidak terpengaruh (saldo awal tidak menyentuh akun pendapatan/beban).

---

## 4. API

Semua endpoint di bawah `/api/v1/accounting`. Semua butuh sesi login dan
dijalankan lewat `withTenantGuard` (isolasi antar-workspace).

| Endpoint | Metode | Fungsi |
| --- | --- | --- |
| `/permissions` | GET | Izin efektif user di modul ini |
| `/setup` | POST | Siapkan bagan akun + rekening kas + pengaturan (idempoten) |
| `/settings` | GET, PATCH | Baca/ubah pengaturan akuntansi |
| `/accounts` | GET, POST | Daftar / tambah akun |
| `/accounts/{id}` | PATCH, DELETE | Ubah / hapus akun |
| `/cash-accounts` | GET, POST | Daftar / tambah rekening kas-bank |
| `/partners` | GET, POST | Daftar / tambah pelanggan-supplier |
| `/journals` | GET, POST | Daftar / buat jurnal manual (draft) |
| `/journals/{id}` | GET, DELETE | Detail / hapus jurnal draft |
| `/journals/{id}/post` | POST | Posting jurnal draft |
| `/journals/{id}/reverse` | POST | Buat jurnal pembalik (wajib alasan) |
| `/periods` | GET | Daftar periode + jumlah draft + status tutup tahun |
| `/periods/{id}/close` | POST | Tutup buku (menolak bila masih ada draft) |
| `/periods/{id}/close-year` | POST | **Tutup tahun buku**: jurnal penutup laba → Saldo Laba |
| `/periods/{id}/lock` | POST | Kunci periode (owner) |
| `/periods/{id}/reopen` | POST | Buka kembali + alasan (tercatat di `activity_events`) |
| `/opening-balance` | GET, POST | Baca / isi saldo awal |
| `/category-mapping` | GET, PUT | Lihat / simpan pemetaan kategori |
| `/budgets` | GET, PUT | Lihat / simpan anggaran tahunan per akun |
| `/reports/{jenis}` | GET | `income-statement`, `balance-sheet`, `cash-flow`, `equity`, `trial-balance`, `ledger`, `aging`, `tax`, `budget` |
| `/reports/summary` | GET | KPI + rasio + peringatan |
| `/reports/export` | GET | Unduh satu berkas Excel berisi semua laporan |

Parameter laporan: `period=YYYY-MM`, atau `startDate` + `endDate`.
Pembanding: `comparative=none|prev_month|prev_year|ytd`.
Khusus aging: `type=AR|AP` dan `asOf=YYYY-MM-DD` (default akhir periode).

Contoh:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/accounting/reports/income-statement?period=2026-11&comparative=prev_month"
```

### Titik integrasi ke modul lain

**Piutang (faktur penjualan).** Menerbitkan faktur lewat `POST /api/v1/kas/invoices`
membuat jurnal:

```
Dr  Piutang Usaha (1-1300)                    total
    Cr  Pendapatan (4-1100 / pengaturan)      DPP
    Cr  PPN Keluaran (2-1310)                 PPN, hanya bila PKP
```

Uang masuknya dicatat lewat **Buku Kas** dengan memilih faktur di kolom
"Lunasi faktur" (atau mengirim `invoiceId` ke `POST /api/v1/kas/transactions`).
Jurnalnya `Dr Kas / Cr Piutang` — bukan pendapatan baru, supaya pendapatan tidak
terhitung dua kali. Nominal harus sama dengan total faktur (v1 belum mendukung
pembayaran sebagian). Menghapus transaksi kas itu mengembalikan faktur ke
`UNPAID`.

**Utang (kewajiban terjadwal).** `POST /api/v1/kas/obligations` langsung
mengakui bebannya (basis akrual):

```
Dr  Beban (sesuai kategori)   nilai kewajiban
    Cr  Utang Usaha (2-1100)
```

`PATCH` status `PAID` mencatat kas keluar sekaligus melunasi utang
(`Dr Utang Usaha / Cr Kas`), jadi beban tidak dihitung dua kali. `CANCELLED`
membalik jurnal akrual lewat jurnal pembalik. Kewajiban yang sudah `PAID` harus
dikembalikan ke `PENDING` dulu sebelum dibatalkan atau dihapus.

**Gaji (payroll).** Membuat slip gaji `POST /api/v1/kerja/payroll` mengakui
bebannya lebih dulu, lengkap dengan rincian potongan:

```
Dr  Beban Gaji & Tunjangan (6-1100)   bruto + BPJS pemberi kerja
    Cr  Utang Gaji (2-1200)           gaji bersih
    Cr  PPh 21 (2-1320)               PPh 21 karyawan
    Cr  Utang BPJS (2-1340)           BPJS karyawan + pemberi kerja
    Cr  Utang Karyawan (2-1350)       potongan lain
```

PPh 21 dan BPJS **diisi manual** dari aplikasi payroll resmi — sistem tidak
menghitung tarif pajak. `deductions` menyimpan total potongan
(`pph21 + bpjsEmployee + otherDeductions`) agar data lama tetap terbaca.
Perhitungan slip ada di `src/lib/accounting/payroll.ts`.

Membayar slip (`PUT` yang sama) mencatat kas keluar dan melunasi utang
(`Dr Utang Gaji / Cr Kas`), jadi beban tidak dihitung dua kali. Menghapus baris
kas pembayaran gaji mengembalikan slip ke status belum dibayar.

PPh/BPJS yang sudah dipotong disetor terpisah lewat
`GET/POST /api/v1/kerja/payroll/taxes`. Setoran memakai
`CashTransaction.settlementAccountId`, sehingga jurnalnya melunasi liabilitas,
bukan menambah beban:

```
Setor PPh 21   Dr 2-1320 / Cr Kas
Setor BPJS     Dr 2-1340 / Cr Kas
Potongan lain  Dr 2-1350 / Cr Kas
```

Tab **Gaji & Pajak** menyediakan form slip, pratinjau bruto/bersih/biaya
perusahaan, tombol bayar, dan kartu saldo kewajiban dengan tombol "Setor penuh".

**Kas manual & impor rekening koran.** `POST /api/v1/kas/transactions` dan
impor mutasi bank (`/workspace-files/{id}/import-ledger`) menjurnal setiap baris.
`DELETE /api/v1/kas/transactions?id=...` membuat jurnal pembalik dan
mengembalikan faktur/kewajiban/slip gaji terkait ke status belum lunas.

**Aturan pintu tunggal.** Semua modul yang menyentuh uang (payroll, inventori,
booking, workflow otomatis, AI) memakai `recordCashTransaction()` di
`src/lib/accounting/posting.ts`, sehingga **setiap baris kas pasti punya jurnal**.
Kategori yang belum dipetakan dari modul otomatis tidak menggagalkan transaksi:
sistem memetakannya sementara ke `4-1900`/`6-9000` dan pemetaan itu muncul di
layar Pemetaan Kategori untuk dibetulkan.

**Konsinyasi.** Saat barang titip-jual laku, sistem membuat kewajiban (utang
usaha) ke supplier sebesar `qty x costPrice`, dengan jurnal:

```
Dr  HPP Konsinyasi (5-1100)
    Cr  Utang Usaha (2-1100)
```

Kas **tidak** berkurang saat barang laku; kas baru keluar ketika utang itu
dibayar lewat alur "bayar kewajiban" (`Dr Utang Usaha / Cr Kas`). Kewajiban juga
muncul di laporan umur utang. Kategori `HPP Konsinyasi` dipetakan otomatis ke
`5-1100` saat setup, dan tetap bisa diubah di Pemetaan Kategori.

**Persediaan & HPP (barang milik sendiri).** Memakai **rata-rata bergerak**
(*moving average*). Yang disimpan adalah **nilai buku** (`products.inventory_value`),
bukan hanya harga rata-rata, supaya sisa nilai selalu sama dengan nilai sebelum
dikurangi HPP — pembulatan tidak menimbulkan selisih dengan akun `1-1400`.

```
Pembelian stok        Dr 1-1400 Persediaan            / Cr Kas
Penjualan barang      Dr Kas/Piutang                  / Cr 4-xxxx Pendapatan
                      Dr 5-1100 HPP                   / Cr 1-1400 Persediaan
Retur dari pelanggan  Dr 1-1400 Persediaan            / Cr 5-1100 HPP
Retur ke supplier     Dr 6-9100 Selisih Persediaan    / Cr 1-1400
Stok opname lebih     Dr 1-1400 Persediaan            / Cr 6-9100
Stok opname kurang    Dr 6-9100 Selisih Persediaan    / Cr 1-1400
```

- Pembelian (`POST /inventory/purchase-orders`) mengirim `debitAccountCode:
  '1-1400'` ke pintu kas, jadi uang keluar menambah aset — bukan beban. Beban
  baru muncul saat barang terjual.
- Penjualan (`POST /inventory/sales`) menambah satu jurnal `source = INVENTORY`
  (Dr 5-1100 / Cr 1-1400) sebesar `qty x harga rata-rata`; nilai balasannya ada
  di `sale.cogs`. Barang **titip jual** tidak masuk perhitungan ini karena HPP-nya
  sudah diakui lewat utang konsinyasi.
- Retur dan penyesuaian stok (`/inventory/returns`, `/inventory/stock-adjustments`)
  ikut menyesuaikan nilai buku dan menjurnal selisihnya. Retur ke supplier dicatat
  sebagai selisih persediaan; penggantian/refund dari supplier dicatat manual.
- **Peringatan.** `Product.costPrice`/`inventoryValue` yang diubah manual (atau
  stok lama yang belum dimasukkan ke Saldo Awal) tidak punya jurnal, sehingga
  laporan Nilai Persediaan akan menampilkan **selisih** terhadap akun 1-1400.
  Selisih itu memang ditampilkan, bukan disembunyikan.

**Catatan periode.** `StockMovement` hanya punya `created_at` (tanggal
pencatatan), tanpa tanggal bisnis. Jadi Kartu Stok memakai bulan pencatatan,
sementara jurnal kas memakai `transactionDate`. Bila keduanya berbeda bulan,
mutasi dan jurnal bisa tampil di periode yang berbeda.

Laporan **Nilai Persediaan** & **Kartu Stok** ada di tab **Persediaan**
(`GET /api/v1/accounting/reports/inventory`, tambahkan `productId` untuk kartu
stok).

### Cara sistem memilih rekening kas/bank

Nilai `paymentMethod` pada transaksi kas dicocokkan berurutan:

1. Nama atau kode rekening yang disebut langsung (mis. `"Kas Kecil"` → rekening
   `KAS-01`, `"BCA"` → rekening dengan nama bank BCA).
2. Kata kunci tipe: `TUNAI`/`KAS` → rekening tunai, `TRANSFER`/`BANK` → rekening bank.
3. Rekening default di pengaturan.
4. Rekening aktif pertama.

Rekening default ditaruh paling akhir dengan sengaja: kalau tidak, memilih
"Kas Kecil" di form akan tetap dijurnal ke rekening bank default, dan laporan
arus kas per rekening jadi salah.

---

## 5. Rumus laporan

**Nilai Persediaan** (per akhir periode). Total `products.inventory_value`
produk milik sendiri (barang titip jual dikecualikan) dibandingkan dengan saldo
akun `1-1400`:

```
selisih = saldo akun 1-1400 - total nilai buku produk
```

Selisih 0 berarti kartu stok dan buku besar sepakat. Peringatan muncul untuk qty
minus, stok bernilai 0 (saldo awal belum dimasukkan), dan selisih ≠ 0.

**Laba Rugi** (per periode, jurnal `CLOSING` dan `OPENING` dikecualikan)

```
Pendapatan        = saldo akun tipe REVENUE
HPP               = akun kode 5-xxxx
Laba Kotor        = Pendapatan - HPP
Beban Operasional = akun EXPENSE selain 5-xxxx dan 7-xxxx
Laba Operasional  = Laba Kotor - Beban Operasional
Beban Pajak       = akun 7-xxxx
Laba Bersih       = Laba Operasional - Beban Pajak
```

**Neraca** (kumulatif sampai tanggal)

```
Aset, Liabilitas, Ekuitas = saldo akun per tipe
Laba Tahun Berjalan       = Pendapatan YTD - Beban YTD   (termasuk jurnal CLOSING)
Total Ekuitas             = Ekuitas + Laba Tahun Berjalan
Selisih                   = Total Aset - (Liabilitas + Ekuitas)
```

`Selisih` harus 0. Kalau tidak, neraca menampilkan peringatan di layar —
jangan diabaikan, cari penyebabnya (biasanya saldo awal tidak lengkap atau ada
jurnal yang belum diposting).

**Arus Kas** (metode langsung, per periode)

Baris periode dikelompokkan per jurnal. Untuk setiap jurnal yang menyentuh
rekening kas/bank, selisih kas dialokasikan ke akun lawannya, lalu
diklasifikasikan:

- Investasi → akun lawan aset tetap (kode `1-2xx` / `1-3xx`)
- Pendanaan → akun lawan ekuitas atau liabilitas jangka panjang (`2-2xx`)
- Operasional → sisanya

Kas Awal = mutasi kas sebelum periode + jurnal saldo awal.
`Saldo rekening (pemeriksaan)` ditampilkan sebagai kontrol silang; angkanya harus
sama dengan Kas Akhir.

**Aturan tanda (penting untuk akun kontra)**

Angka sebuah akun di dalam laporan bertanda menurut **tipe** akunnya, bukan
menurut saldo normal akun itu:

| Tipe akun | Bertanda positif bila | Contoh akun kontra yang jadi negatif |
| --- | --- | --- |
| Aset, Beban | bersaldo debit | Akumulasi Penyusutan (1-2400) |
| Liabilitas, Ekuitas, Pendapatan | bersaldo kredit | Prive (3-1200), Diskon Penjualan (4-2000) |

Akumulasi Penyusutan bertipe aset tetapi bersaldo normal kredit, jadi ia
**mengurangi** total aset. Kalau tanda diambil dari saldo normal akun, akun kontra
justru menambah dan Neraca tidak akan balance. Aturan ini ada di fungsi
`statementAmount()` (`src/lib/accounting/reports.ts`) dan diuji di
`tests/accounting-core.test.ts` lewat persamaan akuntansi
`Aset + Beban = Liabilitas + Ekuitas + Pendapatan`.

**Neraca Saldo** memakai selisih **mentah** (debit - kredit), bukan saldo normal,
supaya akun kontra (Akumulasi Penyusutan, Diskon Penjualan) muncul di sisi yang
benar. Total debit harus sama dengan total kredit.

**Umur Piutang/Utang (aging)** — laporan pendukung, bukan pengganti laporan utama

```
Baris   = faktur UNPAID/OVERDUE (AR) atau kewajiban PENDING (AP)
          yang tanggal terbitnya <= tanggal potong
Umur    = tanggal potong - tanggal jatuh tempo (hari)
Kelompok= belum jatuh tempo, 1-30, 31-60, 61-90, >90 hari
Kontrol = total dokumen dibandingkan saldo buku besar 1-1300 / 2-1100
```

Selisih ditampilkan apa adanya. Penyebab yang wajar: saldo awal piutang/utang,
jurnal manual, atau pelunasan yang dicatat tanpa menautkan dokumen.

**Ringkasan PPN** — per periode, dari jurnal

```
PPN Keluaran   = kredit - debit akun 2-1310
PPN Masukan    = debit - kredit akun 1-1600
Kurang bayar   = PPN Keluaran - PPN Masukan
PPh dipotong   = saldo kredit 2-1320 (PPh 21) dan 2-1330 (PPh Final UMKM)
```

Untuk profil non-PKP angkanya nol; kalau tetap ada jurnal PPN, laporan memberi
peringatan agar diperiksa.

**Anggaran vs Realisasi** — rencana, bukan jurnal

```
Anggaran bulan  = slot bulan berjalan pada Budget.monthly
Anggaran YTD    = jumlah slot 0 s.d. bulan berjalan
Realisasi YTD   = angka akun yang sama dari getIncomeStatement()
Selisih         = Realisasi - Anggaran
```

12 slot anggaran selalu dimulai dari bulan pertama tahun buku (Pengaturan),
jadi tahun buku April–Maret tetap punya 12 kolom yang benar. Hanya akun
pendapatan dan beban yang bisa dianggarkan. **Menyimpan anggaran tidak pernah
membuat jurnal** — kalau ada jurnal baru setelah menyimpan, itu bug.

---

## 6. Bagan akun bawaan

61 akun, format kode `X-XXXX`:

```
1-xxxx  Aset           (1-1xx lancar, 1-2xx tetap)
2-xxxx  Liabilitas     (2-1xx pendek, 2-2xx panjang)
3-xxxx  Ekuitas        (3-1100 Modal Disetor, 3-1200 Prive, 3-2000 Saldo Laba, 3-3000 Laba Tahun Berjalan)
4-xxxx  Pendapatan     (4-2000 Diskon & Retur, saldo normal DEBIT)
5-xxxx  Harga Pokok Penjualan
6-xxxx  Beban Operasional
7-xxxx  Beban Pajak Penghasilan
```

Akun 1-1400 (Persediaan), 5-1100 (HPP Barang), dan 4-1200 (Pendapatan Barang)
sudah ada sejak awal supaya saat mulai berjualan barang tidak perlu ubah
struktur — cukup aktifkan akunnya.

Akun sistem (tidak bisa dihapus, hanya bisa dinonaktifkan):
`1-1110`, `1-1210`, `1-1300`, `1-1400`, `1-1600`, `1-2400`, `2-1100`, `2-1200`,
`2-1300`, `2-1310`, `2-1320`, `2-1330`, `2-1340`, `2-1350`, `3-1100`, `3-1200`, `3-2000`, `3-3000`,
`4-1100`, `4-1200`, `5-1100`, `6-1100`, `6-1800`, `6-9100`, `7-1000`.

### Hierarki akun

Bagan akun tersusun tiga tingkat (mis. `1-1000 Aset Lancar` → `1-1100 Kas` →
`1-1110 Kas Kecil`). Di tab **Pengaturan → Bagan Akun**:

- klik panah untuk membuka/menutup sub-akun; pencarian tetap menampilkan induk
  dari akun yang cocok supaya konteksnya tidak hilang;
- **Tambah akun** bisa langsung memilih induk; **Ubah** bisa memindahkan akun
  ke induk lain;
- akun bertanda **header** hanya pengelompokan dan tidak bisa dipakai di jurnal;
- aturan yang dijaga server: induk harus **tipe yang sama**, tidak boleh diri
  sendiri atau turunannya (anti-siklus), dan akun yang masih punya sub-akun
  tidak bisa dihapus;
- **kode, tipe, dan saldo normal tidak bisa diubah** setelah akun dibuat karena
  sudah dirujuk jurnal. Buat akun baru, lalu nonaktifkan yang lama.

Laporan (Neraca, Laba Rugi, dst.) masih menampilkan akun secara datar; hierarki
baru memengaruhi tampilan pengelolaan akun, bukan angka laporan.

### Profil pajak

| Profil | Efek |
| --- | --- |
| `UMKM_NON_PKP` | PPN tidak diaktifkan. Cocok untuk UMKM PPh final 0,5%. |
| `UMKM_PKP` | Akun PPN Masukan/Keluaran aktif (1-1600, 2-1310). |
| `BADAN_NORMAL` | Untuk badan usaha dengan PPh badan biasa. |

Profil pajak **tidak bisa diubah setelah ada jurnal diposting** (harus di batas
periode dengan jurnal penyesuaian), supaya tidak ada periode yang setengah
memakai aturan lama dan setengah aturan baru.

---

## 7. Berkas penting

```
prisma/schema.prisma                    ← bagian "MODUL LAPORAN KEUANGAN"
src/lib/accounting/money.ts             ← Decimal, anti pembulatan biner
src/lib/accounting/period.ts            ← batas bulan WIB, resolusi rentang laporan
src/lib/accounting/coa-seed.ts          ← template 61 akun + fungsi setup
src/lib/accounting/account-tree.ts      ← pembentuk pohon, anti-siklus, pencarian induk
src/lib/accounting/journal-service.ts   ← buat/posting/balik jurnal, penomoran
src/lib/accounting/posting.ts           ← auto-jurnal transaksi kas
src/lib/accounting/reports.ts           ← mesin 6 laporan utama
src/lib/accounting/aux-reports.ts       ← umur piutang/utang + ringkasan PPN
src/lib/accounting/budgets.ts           ← anggaran tahunan + realisasi vs anggaran
src/lib/accounting/payroll.ts           ← perhitungan slip gaji (PPh 21 & BPJS)
src/lib/accounting/inventory.ts         ← rata-rata bergerak (nilai buku & HPP)
src/lib/accounting/inventory-report.ts  ← nilai persediaan + kartu stok
src/lib/accounting/period-actions.ts    ← tutup/kunci/buka periode
src/lib/accounting/rbac.ts              ← izin modul
src/app/api/v1/accounting/**            ← endpoint
src/app/components/finance/accounting/** ← UI (tab "Laporan Keuangan")
src/app/components/finance/accounting/BudgetView.tsx ← tab Anggaran (input + realisasi)
tests/accounting-core.test.ts           ← 72 tes (uang, periode, agregasi, anggaran, payroll, persediaan)
scripts/accounting-smoke.mjs            ← 217 pemeriksaan end-to-end (butuh server + DB kosong)
```

UI dimuat dari `src/app/components/v0/FinanceDashboard.tsx` sebagai tab
`laporan`. Bisa dibuka langsung lewat `/finance?tab=laporan`.

---

## 8. Belum ada

| Item | Rencana |
| --- | --- |
| Bukti potong 1721-A1 & kalkulasi TER otomatis (rincian PPh/BPJS sudah ada) | Fase lanjutan |
| Laporan PDF server-side (sekarang: cetak dari browser / Ekspor Excel) | Fase 3 |
| Multi-mata uang aktif (kolom `currency` + `exchange_rate` sudah ada, kurs belum dikelola) | Fase 3 |
| Laporan terjadwal (email otomatis tiap awal bulan) | Fase 3 |
| Pembayaran sebagian faktur/kewajiban (v1: pelunasan harus penuh) | Fase 3 |

Rencana lengkap sampai fase akhir (termasuk persediaan/HPP, PDF server-side,
pembayaran sebagian, multi-mata uang, dan pengerasan produksi) ada di
`docs/12_ROADMAP_LAPORAN_KEUANGAN.md`.

Jurnal penutup tahun **sudah otomatis** (tombol "Tutup Tahun" di kartu Periode,
atau `POST /periods/{id}/close-year`). Selama tombol itu belum ditekan, laba
tahun berjalan tetap ditampilkan sebagai baris terpisah di Neraca — angkanya
benar, hanya belum dipindahkan ke Saldo Laba. Setelah ditutup, baris itu menjadi
nol dan labanya masuk `3-2000` Saldo Laba.

---

## 9. Cara mengulang dari nol (dev)

```bash
docker exec klir-db psql -U klir -d klir -c \
  "TRUNCATE journal_lines, journal_entries, fiscal_periods, document_sequences, \
   category_account_maps, partners, cash_accounts, accounts, accounting_settings, \
   cash_transactions, invoices, scheduled_obligations CASCADE;"
```

Setelah itu buka **Finance → Laporan Keuangan → Pengaturan** dan klik
"Siapkan Bagan Akun & Aktifkan".
