# KLIR — Codex → Claude Handoff #4: Pusat Data → Dashboard Integration

Tanggal: 10 September 2026 (WIB)  
Pengirim: Codex  
Penerima: Claude Code  
Scope: audit + perbaikan integrasi data upload ke CEO, Finance, Marketing, Inventory, dan AI context.

## Instruksi utama

Claude diminta mengambil alih pekerjaan ini sampai benar-benar terverifikasi:

1. Perbaiki gap integrasi `Pusat Data -> domain records -> dashboard`.
2. Jangan merusak perubahan Claude sebelumnya atau lane Fatur.
3. Lakukan full rescan source, test, dan browser QA setelah implementasi.
4. Jangan mengklaim selesai hanya karena upload berhasil; buktikan angka yang berasal dari file benar-benar muncul pada dashboard domain yang sesuai.

Tidak ada kredensial login yang ditulis di dokumen ini.

## Temuan yang sudah terbukti

Live workspace: `PT Makan Mania Mantap` di `https://klir.laserstory1.id/`.

| Pemeriksaan live read-only | Hasil |
|---|---:|
| File di Pusat Data | 11 |
| Status `Diproses` | 11/11 |
| `belum ada data turunan tercatat` | 11/11 |
| Badge kandidat `Impor ke Buku Kas` | 5 |
| CEO dashboard | kas/transaksi/produk masih zero-state |
| Finance dashboard | saldo dan transaksi Rp0 |
| Marketing dashboard | belum ada kampanye dan spend |

Tidak ada file yang dihapus, transaksi yang dibuat, import yang dikonfirmasi, atau data live yang diubah selama audit Codex.

## Root cause

Saat ini alurnya terbelah:

```text
Upload Pusat Data
  -> WorkspaceFile
  -> extractedSummary
  -> COMPANY_KNOWLEDGE / AI context
  -> selesai

Dashboard
  -> CashTransaction / Invoice / Product / StockMovement / Campaign / Coupon
  -> KPI dashboard

Yang belum ada:
  WorkspaceFile -> classifier domain -> preview mapping -> confirm -> domain records
```

Dengan kata lain, upload berhasil tidak berarti `CashTransaction`, `Product`, `StockMovement`, `Campaign`, atau `Payroll/Task` otomatis dibuat.

### Bukti source

- Upload membuat dan memperbarui `WorkspaceFile`, lalu menyimpan company knowledge; tidak membuat record domain: `src/app/api/v1/workspace-files/route.ts` sekitar baris 173–360.
- Upload batch hanya reload daftar file dan dispatch `klir-ai-state-updated`: `src/app/components/WorkspaceDataHub.tsx` sekitar baris 190–221.
- Dashboard CEO mengambil workspace files hanya untuk data-quality alert, bukan untuk mengisi KPI: `src/app/components/CompanyDataDashboard.tsx` sekitar baris 618–658.
- Finance membaca endpoint kas/invoice/financial health: `src/app/components/FinanceModuleView.tsx` sekitar baris 709, 801, dan 947.
- Marketing membaca `/api/v1/promo/coupons` dan `/api/v1/marketing/campaigns`: `src/app/components/MarketingModuleView.tsx` sekitar baris 303–335.
- Importer yang benar-benar menulis domain saat ini hanya `/api/v1/workspace-files/[id]/import-ledger`, dan hanya menulis `CashTransaction`: file route sekitar baris 190–333.
- AI context memang membaca semua file sebagai manifest dan top-K relevant knowledge: `src/lib/ai-brain/workspace-knowledge.ts` sekitar baris 115–169. Ini bukan pipeline dashboard.

## Temuan safety penting pada importer saat ini

Badge `5 file bisa diimpor` dihitung dengan ekstensi + status + `linkedRecordIds` kosong, bukan dengan validasi semantik parser. Lihat `WorkspaceDataHub.tsx` sekitar baris 353–360.

Akibatnya `laporan-penjualan-bulanan.xlsx`, `data-karyawan-payroll.xlsx`, dan `data-inventori-stok.xlsx` bisa ditawari tombol yang sama, walaupun bukan berarti semuanya cocok menjadi transaksi kas.

Preview live `laporan-penjualan-bulanan.xlsx` menunjukkan:

- confidence 35%;
- 155 baris kandidat;
- seluruh baris didefault sebagai `INCOME`;
- kategori dan keterangan tidak ditemukan;
- total pemasukan Rp2.204.167.022 dan pengeluaran Rp0;
- ada peringatan bahwa struktur file berupa agregat dan berisiko double-count.

Preview `laporan-keuangan-laba-rugi.xlsx` menolak file karena tidak dikenali sebagai buku kas klasik maupun tabel transaksi generik.

Kesimpulan: importer generik existing harus dipertahankan sebagai preview aman, tetapi tidak boleh diperlakukan sebagai bukti bahwa semua spreadsheet siap masuk Buku Kas.

## Target implementasi

### 1. Domain classification

Tambahkan klasifikasi eksplisit minimal:

```text
FINANCE_CASH
SALES_REVENUE
INVENTORY_STOCK
PAYROLL_HR
MARKETING_CAMPAIGN
KNOWLEDGE_ONLY
UNSUPPORTED_AMBIGUOUS
```

Klasifikasi harus memakai isi/header/sheet, bukan nama file saja. Nama file boleh menjadi sinyal, bukan sumber kebenaran tunggal.

### 2. Preview sebelum write

Setiap kandidat wajib memiliki preview domain yang menyatakan:

- domain tujuan;
- jumlah record;
- field mapping;
- total angka;
- baris yang dilewati;
- confidence;
- warning agregat/double-count;
- tanggal dan timezone;
- apakah record akan menjadi income, expense, product, stock movement, campaign, atau knowledge-only.

Confidence rendah atau mapping ambigu harus berhenti di preview. Jangan auto-write.

### 3. Import ke canonical domain tables

Gunakan tabel/endpoint yang sudah ada terlebih dahulu. Jangan mengubah schema Prisma, membership, auth, atau session tanpa handoff eksplisit dari Fatur/Mecca.

Minimal target:

| Sumber | Target | Dashboard yang harus berubah |
|---|---|---|
| transaksi kas valid | `CashTransaction` | Finance + CEO |
| sales/revenue valid | Cash/invoice/sales contract yang disetujui | Finance + CEO; Marketing hanya jika ada attribution |
| inventory valid | `Product` + stock movement sesuai kontrak existing | Inventory + CEO |
| campaign/spend valid | `Campaign`/marketing records existing | Marketing + CEO |
| payroll/team valid | domain HR/task existing bila tersedia | CEO/team section |
| SOP/kontrak/notulen | WorkspaceFile + AI knowledge | AI context, bukan KPI palsu |

Jangan memasukkan inventory/payroll/SOP ke Buku Kas hanya karena file-nya `.xlsx` atau `.csv`.

### 4. Provenance dan idempotency

Jangan memperluas pemakaian `linkedRecordIds` tanpa kontrak typed. Saat memungkinkan, setiap record hasil import harus punya provenance:

```text
sourceFileId
sourceRow / sourceRange
importBatchId
mappingVersion
contentHash
```

Import ulang file yang sama harus ditolak atau menghasilkan preview “sudah pernah diimpor”, bukan double-count.

Catatan: `linkedRecordIds` saat ini overloaded—untuk parent ZIP berisi child `WorkspaceFile` IDs, sedangkan import ledger berisi `CashTransaction` IDs. Jangan menambah pemakaian ketiga tanpa disambiguasi.

### 5. Event dan refresh

Setelah write sukses, dispatch event domain yang tepat:

```text
FINANCE  -> klir-kas-updated
INVENTORY -> klir-inventory-updated
MARKETING -> klir-mkt-updated + klir-ai-state-updated
GENERAL/AI -> klir-ai-state-updated
```

Dashboard harus refetch server data setelah event. Event tidak boleh dianggap sebagai pengganti write ke database.

### 6. Backfill 11 file lama

Buat jalur reprocess/preview untuk 11 file existing. Jangan langsung mengimpor semuanya.

Urutan aman:

```text
scan metadata
  -> classify
  -> preview
  -> user confirm per file/domain
  -> import atomik
  -> verify dashboard
```

File `SOP`, `proposal`, `notulen`, `kontrak`, `_INDEX.md`, dan dokumen knowledge harus tetap knowledge-only kecuali user memilih aksi domain yang valid.

## Acceptance criteria wajib

Claude belum boleh menutup task sebelum semua item berikut terbukti:

- [ ] Upload file non-finance tidak lagi menawarkan tombol “Impor ke Buku Kas” secara membabi buta.
- [ ] File finance yang valid menghasilkan preview dan hanya menulis setelah confirm.
- [ ] File finance yang diimpor muncul di Finance dan CEO setelah refresh/event.
- [ ] File inventory yang valid muncul di Inventory dan ringkasan CEO.
- [ ] File marketing yang valid muncul di Marketing dan ringkasan CEO, bila domain mapping memang didukung.
- [ ] File payroll/HR tidak masuk Buku Kas.
- [ ] File knowledge-only tetap dapat dibaca AI tetapi tidak mengarang KPI dashboard.
- [ ] Ambiguous/low-confidence mapping berhenti di preview dengan warning manusiawi.
- [ ] Import ulang tidak double-count.
- [ ] Tenant isolation tetap pass.
- [ ] Error/loading/empty state tetap jujur.
- [ ] Fatur auth/login/session/membership/schema lane tidak dirusak.
- [ ] Tidak ada perubahan live data tanpa fixture/konfirmasi yang jelas.

## Gate test dan rescan

Jalankan setelah implementasi:

```powershell
npx tsc --noEmit
node --experimental-test-module-mocks --import tsx --test "tests/**/*.test.ts"
npm run build
git diff --check
```

Tambahkan test minimal untuk:

1. classification per domain;
2. preview finance/inventory/marketing/payroll;
3. low-confidence rejection;
4. idempotency/import ulang;
5. provenance/source file;
6. event-to-dashboard refresh;
7. tenant isolation;
8. old 11-file backfill preview tanpa write otomatis.

Browser QA wajib membedakan:

```text
✅ upload tersimpan
✅ extraction selesai
✅ AI membaca file
✅ domain import berhasil
✅ dashboard membaca record domain
```

Jangan mengganti empat status berbeda itu menjadi satu toast “berhasil”.

## Status gate dari Codex

- Targeted integration tests: **85 pass, 0 fail**.
- Live audit: **read-only**, tidak ada import/delete/update.
- Local worktree: bersih pada commit `67ca575`.
- Warning test harness: auto-company-profile fire-and-forget memanggil `workspaceFile.findMany` yang belum dimock pada fixture upload; tidak menyebabkan test fail, tetapi coverage perlu dirapikan.
- Tidak ada source change Codex pada handoff ini.

## Guardrail lane

- Jangan menyentuh auth/login/session/membership milik Fatur.
- Jangan menambah migration/schema hanya untuk mengejar demo tanpa persetujuan.
- Jangan menghapus fixture QA atau file live.
- Jangan mengonfirmasi import terhadap 11 file produksi hanya untuk membuktikan angka.
- Jangan deploy, push, atau mengirim integrasi eksternal tanpa otorisasi Mecca.
- Preserve semua handoff/history lama; buat laporan baru setelah pekerjaan selesai.

## Tulis balik setelah selesai

Claude wajib membuat handoff/report baru, bukan menimpa dokumen ini, yang berisi:

1. file source yang berubah;
2. kontrak domain yang benar-benar diimplementasikan;
3. test result lengkap;
4. browser QA per role;
5. daftar hal yang masih belum didukung;
6. bukti bahwa tidak ada perubahan pada lane Fatur;
7. keputusan apakah 11 file lama hanya dipreview atau benar-benar diimpor.

**Definition of done:** angka dari file yang valid dapat ditelusuri dari source file ke canonical domain record lalu terlihat konsisten di dashboard yang relevan. Upload tersimpan saja bukan selesai.
