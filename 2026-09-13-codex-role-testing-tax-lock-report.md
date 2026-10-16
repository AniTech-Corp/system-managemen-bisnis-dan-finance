# Codex ↔ AntiGravity — Role Browser QA & Tax Lock Report

Tanggal: 13 September 2026 (WIB)  
Branch Codex: `codex/klir-bughunt-2026-09-13`  
Base/HEAD saat mulai: `7fea61c`  
Scope: KLIR Public/Private — dashboard + AI Assistant, enam role.  
Status repository: belum commit dan belum push.

## 1. Tujuan sesi

Memeriksa KLIR dari tiga sudut sekaligus:

```text
Browser visual + interaksi
        │
        ├── localhost:3000  = baseline AntiGravity, read-only
        ├── localhost:3101  = branch Codex, kandidat patch
        └── API/backend       = bukti payload, status, dan policy guard
```

Kebijakan produk yang dipakai:

| Environment | Angka demo | Fitur belum lulus uji | Perpajakan |
|---|---:|---|---|
| localhost loopback | tampil untuk enam role agar demo klien terlihat nyata | boleh terlihat sebagai demo, tetapi harus diberi notice simulasi | **tetap dikunci**, pengecualian eksplisit; Belum tersedia |
| GitHub/Hostinger production | hanya data database yang sah | wajib locked/unsupported sampai lulus uji | **tetap dikunci**; user-facing copy tetap Belum tersedia |

## 2. Konteks AntiGravity yang diverifikasi

AntiGravity mengerjakan dan mendorong rangkaian perubahan berikut:

- `22216a7` — rich localhost demo benchmark.
- `34b5f12` — handoff bug hunting dan histori.
- `7fea61c` — simulasi histori bisnis sembilan tahun; posisi HEAD/base branch.
- Rebuild visual Sekretaris, Manager Umum, Manager Operasional, CEO, Finance, dan Marketing; single-screen dashboard, in-card drilldown, proactive alerts, dan rich local fallback.
- Cross-role benchmark yang dimaksudkan konsisten: CEO revenue `Rp 612,5jt` ↔ Finance income `Rp 612,5jt`, CEO expense `Rp 478jt` ↔ Finance expense `Rp 478jt`, cash `Rp 348,5jt`.
- Strict production gating untuk dashboard/integrations serta generator histori 5–10 tahun.

## 3. Baseline browser AntiGravity — temuan nyata

Tab Chrome user pada `http://localhost:3000/` dibaca langsung; tidak diedit.

### Finance Dashboard

Terlihat langsung di UI:

- section **Kas & kalkulator** dengan tombol Kas masuk, Kas keluar, Hitung HPP, Harga jual, form nominal, dan tombol Catat Transaksi;
- section **Pajak & Kepatuhan** berlabel 2 widget;
- saat dibuka, muncul kalkulasi PPh/PPN dan pengingat jatuh tempo, termasuk angka `Rp 270`, `58 hari`, dan jadwal PPh;
- pada waktu render yang berbeda, dashboard juga menampilkan fallback benchmark `Rp 348.500.000`, `Rp 612.500.000`, dan `Rp 478.000.000`, sementara AI health membaca transaksi aktual kecil (`Rp 20.000`, `Rp 54.000`, `Rp 34.000`) serta runway `99 bulan`. Ini adalah mismatch UI/backend yang perlu diselesaikan oleh konsistensi data source.

### Finance AI Assistant

Terlihat langsung di UI:

- tombol sidebar **Integrasi Akuntansi & Pajak** aktif;
- tool **Estimasi Setoran Pajak PPh/PPN** aktif;
- quick action **Estimasi Setoran Pajak PPh** aktif;
- gallery **Pajak & kepatuhan** punya kartu kalkulasi pajak yang dapat dijalankan;
- composer masih menyebut pajak pada placeholder.

### Backend baseline

GET `/api/v1/dashboard/role?role=FINANCE` dari tab Chrome mengembalikan HTTP 200 dengan:

- `pph-final` status `available`, value `270`, source `Tax engine`;
- `ppn-collected` status `available`, value `5940`, source `Tax invoices`;
- `sp2dk-risk` status `available`, value `92`, source `Tax compliance check`;
- insight masih menyebut fokus Finance sebagai kepatuhan pajak dan source `Tax Engine`.

Kesimpulan baseline: masalah bukan sekadar cosmetic. Fitur pajak benar-benar reachable dari browser dan payload backend.

## 4. Perubahan Codex pada branch

### 4.1 Lock perpajakan terpusat

- `src/lib/tax-feature.ts` — single source of truth `TAX_FEATURE_LOCKED`, pesan, pattern detector, dan response lock.
- `src/app/components/TaxFeatureLock.tsx` — UI `Perpajakan — Belum tersedia`, tanpa kalkulasi/reminder/aksi.
- `src/app/api/v1/brain/chat/route.ts` — prompt pajak berhenti sebelum LLM/database action; respons menyatakan `featureLocked: true`.
- `FinanceModuleView.tsx` — kalkulator/reminder pajak diganti panel lock; effect tax calculator tidak melakukan request saat lock aktif.
- `FinanceAIAssistantView.tsx` — tool, quick action, gallery, settings link, dan placeholder pajak dikunci atau diubah menjadi `Belum tersedia`.
- `FinanceSettingsModal.tsx` — tab Pajak disabled secara perilaku dan body hanya lock panel.
- `DashboardVisuals.tsx` — legacy tax snapshots/charts tidak lagi menampilkan angka pajak; glossary menjelaskan policy lock.
- `dashboard/role/route.ts` — payload Finance production tidak lagi mengirim tiga tax cards aktif; insight tidak lagi mengklaim tax engine aktif.

### 4.2 Demo localhost enam role

- `src/lib/local-role-dashboard-demo.ts` — angka dummy eksplisit untuk CEO, Finance, Marketing, Manager Umum, Manager Operasional, Sekretaris; semua diberi source `Demo Localhost` dan notice simulasi.
- `src/app/api/v1/dashboard/role/route.ts` — loopback + non-production + role valid memakai helper demo sebelum auth/database. Host production tetap melewati auth/database.
- Finance demo tetap punya kartu `tax-compliance` status `unsupported`, value `null`, detail `Fitur perpajakan belum tersedia saat ini.`.

### 4.3 Kontrak dan QA

- `tests/local-role-dashboard-demo.test.ts` — semua enam role harus lolos parser, punya angka available, dan notice demo.
- `tests/tax-feature.test.ts` — policy tetap locked, pattern prompt, owner, dan tidak ada angka kalkulasi di response.
- `AI-GUEST-ACTIVITY-LOG.md` — ledger sinkronisasi Codex/AntiGravity dibuat karena sebelumnya belum ada.

## 5. Area yang sengaja tidak disentuh

```text
Fatur lane / deferred:
  - prisma/schema.prisma
  - prisma/migrations/*
  - src/app/api/v1/auth/*
  - login/session core
  - landing page login flow
  - database seed/migration/auth deployment
```

Perubahan `src/app/page.tsx` yang sudah ada sebelum sesi ini hanya terkait routing UI inventory ke AI-first; bukan perubahan login.

## 6. Status verifikasi

| Gate | Status final sesi | Bukti |
|---|---|---|
| Source audit AntiGravity port 3000 | ✅ | Browser Chrome + backend GET langsung |
| TypeScript branch setelah tax patch | ✅ | `npx tsc --noEmit --incremental false` |
| Unit contract tests baru | ✅ | termasuk dalam suite resmi |
| Full test suite | ✅ | `npm run test:all`: 1.754/1.754 pass, 298 suite |
| Production build | ✅ | `npm run build` dengan `JWT_SECRET` ephemeral proses: exit 0 |
| Browser six-role branch port 3101 | ✅ | gateway re-entry + dashboard/AI walkthrough enam role |
| Real DB write/integration | ⚠️ | belum boleh diklaim; environment sebelumnya tidak memiliki `DATABASE_URL` yang usable |
| Lint clean | ⚠️ | baseline sebelumnya memiliki 214 findings; bukan blocker patch ini tetapi belum clean |
| Commit/push GitHub | ⏸️ | sengaja belum dilakukan |

## 7. Protokol testing branch

Untuk setiap role, Codex harus membuktikan:

1. dashboard bisa dibuka dari gateway/role entry;
2. angka dummy muncul di localhost;
3. tidak ada raw inventory/calculator unknown di dashboard overview;
4. AI Assistant bisa dibuka dan prompt inventory diarahkan lewat AI;
5. tidak ada error UI/console yang memblokir;
6. Finance tax surface tetap lock dan prompt pajak ditolak backend;
7. payload role sesuai role yang diminta dan memiliki numeric marker.

Role matrix: CEO, Finance, Marketing, Manager Umum, Manager Operasional, Sekretaris.

## 7A. Bukti browser branch final

Pengujian langsung dilakukan pada `http://localhost:3101/` melalui gateway
dengan fixture auth lokal sementara (bukan bypass yang dibawa ke production).

| Role | Dashboard | Angka terlihat | AI Assistant | Error runtime | Catatan |
|---|---|---:|---|---|---|
| CEO | ✅ `Dashboard Perusahaan` | ✅ | ✅ | ✅ | snapshot kas, marketing, dan histori 2017–2026; inventory hanya ringkasan/pengarah ke AI |
| Finance | ✅ `Finance & Cashflow` | ✅ | ✅ | ✅ | angka kas/arus kas, demo notice, aksi kas via AI; pajak unavailable |
| Marketing | ✅ `Dashboard Marketing` | ✅ | ✅ | ✅ | ROAS, spend, conversion, dan insight tampil |
| Manager Umum | ✅ `Dashboard Manager Tim` | ✅ | ✅ | ✅ | KPI, budget, SOP, workload, dan keputusan tampil |
| Manager Operasional | ✅ `Dashboard Operasional` | ✅ | ✅ | ✅ | stok, PO, supplier, dan alert operasional tampil |
| Sekretaris | ✅ `Dashboard Sekretariat` | ✅ | ✅ | ✅ | agenda, dokumen, tugas, dan kehadiran tampil |

Temuan selama walkthrough: pemeriksaan awal CEO sempat menandai kata `Tambah
produk` karena ada kalimat penjelasan bahwa pengelolaan stok dipindahkan ke AI;
setelah snapshot dan screenshot diverifikasi, tidak ada form CRUD/raw calculator
yang dirender di dashboard CEO. Ini dicatat sebagai false-positive pengujian,
bukan bug UI.

Fresh-session tax check juga dilakukan setelah riwayat chat QA di branch
dihapus: Finance dan CEO hanya menampilkan `Belum tersedia`, kontrol disabled,
tanpa nama internal atau `Coming Soon`. POST prompt pajak ke
`/api/v1/brain/chat` mengembalikan HTTP 200 dengan `featureLocked: true` dan teks
`Fitur perpajakan belum tersedia saat ini.`; payload Finance role memberi card
`tax-compliance` dengan `status: unsupported` dan `value: null`.

## 8. Handoff untuk AntiGravity

AntiGravity perlu membaca file ini dan `AI-GUEST-ACTIVITY-LOG.md` sebelum melanjutkan:

- jangan menghidupkan kembali `pph-final`, `ppn-collected`, `sp2dk-risk`, tax calculator, tax reminder, atau tax quick-action sebelum CMO Adnan memberikan rancangan/validasi;
- pertahankan angka localhost sebagai demo-only dengan notice yang terlihat;
- jangan membawa bypass loopback demo ke Hostinger/GitHub production;
- jika mengubah role dashboard, update contract test dan lakukan browser test enam role;
- jangan menggabungkan perubahan Codex ke lane Fatur (auth/Prisma/migration) tanpa handoff eksplisit.

## 9. Open issues yang harus tetap jujur

- Demo numbers dan database numbers belum satu sumber pada baseline port 3000; browser evidence menunjukkan mismatch nyata. Branch Codex membuat jalur demo eksplisit, tetapi real DB integration tetap memerlukan environment database valid.
- Build/test browser branch harus menjadi bukti berikutnya sebelum menyatakan batch aman.
- Fitur perpajakan bukan “diubah jadi dummy”; sengaja tidak menyediakan angka sama sekali dan ditampilkan `Belum tersedia`.

## 10. Feedback copy produk — aturan permanen

Nama owner, CMO, developer, atau konteks koordinasi internal tidak boleh muncul
di dashboard, AI Assistant, toast, quick action, gallery, settings, maupun
respons API yang dibaca user. Jika fitur belum tersedia, gunakan copy sederhana
dan konsisten: **“Fitur ini belum tersedia saat ini.”** Untuk perpajakan, konteks
internal tetap dicatat di dokumen handoff saja; user cukup menerima status fitur
belum tersedia tanpa penjelasan struktur tim.

## 11. Model kerja kolaborasi KLIR

KLIR adalah satu project bersama. Claude, Codex, dan AntiGravity bekerja pada
satu alur berkelanjutan: konteks, temuan, patch, hasil tes, dan feedback
diteruskan bolak-balik sampai fitur benar-benar terverifikasi. Branch Codex atau
folder kerja sementara hanya alat keselamatan teknis agar perubahan tidak
menimpa checkout agent lain; itu bukan pemisahan project atau pemisahan tujuan.

Setiap kontribusi wajib masuk ke timeline bersama dengan format:

```text
[tanggal] | [agent] | [perubahan] | [alasan] | [bukti/status] | [handoff berikutnya]
```

AntiGravity wajib membaca `AI-GUEST-ACTIVITY-LOG.md` dan laporan ini sebagai
konteks project yang sama sebelum melanjutkan, lalu menambahkan kontribusinya
ke ledger yang sama. Codex melakukan hal yang sama terhadap handoff Claude dan
AntiGravity; tidak ada agent yang boleh menganggap KLIR sebagai project miliknya
sendiri.
