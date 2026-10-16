# KLIR — Codex → Claude Handoff

Tanggal: 10 September 2026 (WIB)  
Branch saat audit: `main`  
Status remote saat checkpoint: `main...origin/main [ahead 36, behind 4]`  
GitHub: **tidak ada `git push` oleh Codex**

## Cara membaca handoff ini

1. Baca `AGENTS.md` repo dan `2026-09-09-claude-to-codex-handoff.md` terlebih dahulu.
2. Jangan menghapus atau mengganti file handoff/history lama.
3. Worktree saat ini sudah dirty dan berisi kontribusi beberapa sesi/agent. Jangan mengasumsikan seluruh diff adalah milik Codex atau Claude; audit diff per file sebelum mengubahnya.
4. Login, autentikasi, session/membership, Prisma/database, `.env`, dan infrastruktur inti adalah lane Fatur. Jangan ubah tanpa handoff eksplisit dari Fatur/Mecca.

## Kontrak produk yang dipertegas Mecca

```text
Role / jabatan    = menentukan feature yang relevan untuk user.
Module internal   = CorPlan, Personal, Advertise, Management, Finance,
                    Schedule, Inventory; hanya pengelompokan feature.
Feature           = pekerjaan nyata yang user jalankan.

Dashboard         = visual status, data, analisis, prediksi, rekomendasi.
AI Assistant      = tempat kerja utama untuk menjalankan feature terintegrasi AI.

CEO / Owner       = superset feature aktif lintas tujuh module.
Finance           = feature lintas module yang relevan untuk Finance.
Marketing         = feature lintas module yang relevan untuk Marketing.
```

Nama module bukan label produk yang harus mendominasi dashboard/AI. Jangan menempelkan label seperti “KLIR Management” hanya untuk menjelaskan asal feature.

Standar AI insight CEO dari arahan ayah Mecca:

- AI membandingkan target terhadap realisasi historis.
- AI menghasilkan proyeksi sampai Desember dan rekomendasi recovery.
- AI tidak mengarang sebab bisnis: diagnosis akar penyebab membutuhkan data kanal, produk, biaya, dan transaksi.
- Keputusan tetap pada CEO; AI memberi analisis/prediksi/saran, bukan pura-pura pasti benar.

## Pekerjaan Codex yang sudah ada di worktree

### 1. Analisis target penjualan CEO

File baru: `src/lib/ai-brain/sales-target-engine.ts`  
Test baru: `tests/sales-target-engine.test.ts`

Engine deterministic membaca target tahunan dan realisasi kuartal. Skenario acceptance yang diuji di localhost:

```text
Target tahunan  Rp100 juta
Q1              Rp15 juta
Q2              Rp20 juta
Realisasi       Rp35 juta
Sisa            Rp65 juta
Recovery Q3     Rp30 juta
Recovery Q4     Rp35 juta
Proyeksi rata-rata sederhana sampai Desember  Rp70 juta
```

Perbaikan terakhir mengubah pembagian sisa dari rata Rp32,5 juta/Q3-Q4 menjadi recovery bertahap Rp30 juta/Q3 + Rp35 juta/Q4. Respons AI menyebut batas diagnosis dengan jelas.

Integrasi terkait ada pada `src/app/components/ExecutiveAIAssistantView.tsx` dan `src/app/components/CompanyDataDashboard.tsx`. Dashboard hanya menampilkan status hasil; perhitungan/detail kerja tetap dilakukan di AI Assistant.

### 2. Kejujuran visual zero state

- `src/app/components/FinanceModuleView.tsx`: chart kas/pemasukan/pengeluaran mingguan yang tadinya statis di zero state diganti dengan status “histori belum tersedia”. Tidak ada lagi visual sejarah palsu.
- `src/app/components/MarketingModuleView.tsx`: zero-state ROAS memakai satuan rasio `0,00x`, bukan nominal palsu `Rp 0,00`.
- `src/app/components/CompanyDataDashboard.tsx`: copy kartu target menegaskan dashboard untuk hasil/status; AI meminta data sumber sebelum menyimpulkan penyebab selisih.

### 3. Role-fit UI

- `src/app/components/FinanceAIAssistantView.tsx`: pintasan UI `Pengaturan admin` dihapus dari Finance.
- `src/app/components/MarketingAIAssistantView.tsx`: pintasan UI `Pengaturan admin` dihapus dari Marketing.

Tombol tersebut hanya menampilkan toast dan belum terhubung RBAC nyata. CEO tetap memilikinya. Ini bukan perubahan login/auth atau implementasi RBAC backend; hanya menghindari tampilan kemampuan admin yang salah untuk role Finance/Marketing.

## Bukti validasi yang sudah dijalankan

### Gate kode

| Gate | Hasil |
|---|---|
| `npx tsc --noEmit` | PASS, exit 0 |
| `node --experimental-test-module-mocks --import tsx --test "tests/**/*.test.ts"` | PASS — 1.166 pass, 0 fail, 0 skipped |
| `git diff --check` | PASS; hanya warning normalisasi LF/CRLF |

### Browser localhost `http://localhost:3000/`

| Role/surface | Bukti nyata |
|---|---|
| CEO Dashboard | kartu target menampilkan Rp100 jt target, Rp35 jt realisasi, sisa Rp65 jt, proyeksi Rp70 jt |
| CEO AI | prompt target diuji; respons final Q3 Rp30 jt + Q4 Rp35 jt |
| CEO Operasional Tim | view dibuka; Kanban, Presensi, Evaluasi KPI, SOP-AI berpindah tab |
| CEO Reservasi & Antrean | view dibuka; Reservasi, Antrean, Loyalitas, Pengingat berpindah tab |
| Finance Dashboard | zero-state jujur; HPP Rp15.000 + Rp5.000 + Rp5.000 untuk 10 unit = Rp25.000 total / Rp2.500 per unit |
| Finance AI | 19 kemampuan AI tampil, tanpa pintasan admin |
| Marketing Dashboard | ROAS `0,00x`, data campaign/channel kosong dinyatakan jujur |
| Marketing AI | 17 kemampuan aktif + preset khusus Marketing, tanpa pintasan admin |
| Browser console | kosong setelah retest role |

QA tidak membuat transaksi kas, booking, campaign, atau integrasi berbayar baru. Ada dokumen Finance yang sudah ada dari uji sebelumnya (`surat-penagihan-invoice-pt-anitech-digital-solusi.docx`); jangan hapus sebagai “artefak sampah” tanpa keputusan Mecca.

## Temuan terbuka yang harus diambil Claude

### P0 — Finance header dashboard mouse navigation

Reproduksi:

1. Masuk Finance → buka `AI Asisten Keuangan`.
2. Klik mouse tombol header `Dashboard Keuangan & Kas`.
3. UI tetap berada pada Finance AI Assistant.
4. Fokus/aktivasi keyboard `Enter` pada tombol yang sama berhasil membuka dashboard.
5. Arah sebaliknya Dashboard → AI berhasil lewat mouse click.
6. Marketing Dashboard navigation berhasil lewat mouse click.

Source handler di `src/app/page.tsx` sudah tampak benar:

```ts
setFinanceActiveNav('dashboard');
localStorage.setItem('klir_finance_nav', 'dashboard');
```

Jangan menambah fallback acak sebelum menemukan penyebab pointer-specific. Audit stacking context, overlay/pointer interception, event propagation, dan perbedaan header Finance vs Marketing. Tambahkan regression test yang membuktikan **mouse click**, bukan hanya keyboard activation.

### P0 — Reconcile perubahan Fatur/remote tanpa menghancurkan worktree

`main` masih ahead 36 dan behind 4 pada checkpoint. Sebelum merge/rebase/pull:

1. `git fetch` read-only.
2. Bandingkan empat commit remote terhadap local/main per file.
3. Pisahkan commit source Fatur dari cleanup/history deletion.
4. Jangan `reset --hard`, `checkout --`, atau force action pada worktree dirty.
5. Setelah integrasi yang disetujui: ulang TypeScript, suite penuh, dan QA CEO/Finance/Marketing.

### P1 — Matriks role → feature final untuk tujuh module

Konsep role sudah jelas, tetapi matriks permission granular belum diputuskan. Jangan menebak array permission/RBAC database.

Claude dapat menyiapkan tabel usulan berikut untuk Mecca, lalu implementasikan hanya sesudah keputusan eksplisit:

| Feature | Module internal | CEO | Finance | Marketing | Alasan bisnis | Mode dashboard/AI |
|---|---|---|---|---|---|---|

Prinsip awal: CEO superset; Finance/Marketing hanya feature relevan, termasuk feature lintas module bila memang mendukung tugasnya. Internal module names jangan dijadikan copy produk di UI.

### P1 — Target sales persistence dan data diagnosis

Saat ini hasil target tersimpan sebagai state browser setelah percakapan AI. Untuk production:

- Fatur/owner backend perlu menentukan entity target tahunan, periodisasi, sumber ledger, dan tenant guard.
- Claude dapat menyiapkan kontrak UI/AI serta migration acceptance criteria, tetapi jangan menulis schema/database lane Fatur tanpa izin.
- Diagnosis sebab Q1/Q2 hanya aktif bila kanal, produk, biaya iklan, dan transaksi tersedia dari sumber tepercaya.

### P1 — Coverage E2E yang masih belum boleh diklaim

- Export Excel/PDF, Sinkronisasi Finance, dan penyimpanan transaksi nyata.
- Submit reservasi/queue/loyalty/reminder ke database.
- Campaign deployment, Ads platform integration, serta generation media yang bisa berbiaya.
- Inventory browser surface dedicated; backend punya tests (`consignment`, `photo-to-stock`, purchase orders, returns, supplier score), tetapi UI role-specific belum terbukti pada putaran ini.
- Responsive/mobile/tablet matrix dan keyboard/focus accessibility matrix.
- External integrations/payments/WhatsApp hanya dengan sandbox/credential yang diizinkan Mecca/Fatur.

## Roadmap yang disarankan

```text
Phase 0 — Stabilkan handoff / remote
  ├─ Claude: audit diff + remote Fatur, tanpa destructive Git
  ├─ Claude: reproduce & root-cause Finance pointer navigation
  └─ Gate: tsc + 1.166+ tests + three-role navigation retest

Phase 1 — Putuskan produk
  ├─ Mecca: approve matrix role-feature dan scope subscription
  ├─ Claude: translate decision menjadi UI/AI capability registry
  └─ Fatur: validate auth/RBAC/database implications

Phase 2 — Data truth
  ├─ Fatur: persistence target/ledger/membership/session
  ├─ Claude: AI diagnostic contract + dashboard read model
  └─ Gate: tenant isolation + source provenance + no fabricated trend

Phase 3 — E2E acceptance dengan sandbox
  ├─ Finance: transaction → dashboard → export
  ├─ Marketing: campaign data → ROAS → recommendation
  ├─ Operations: task/attendance/KPI/SOP
  ├─ Schedule: reservation → queue → reminder
  └─ Inventory: stock/purchase/return/supplier score UI path

Phase 4 — Release quality
  ├─ desktop, tablet, mobile visual regression
  ├─ mouse + keyboard navigation matrix
  ├─ error/loading/empty-state/accessibility review
  └─ explicit Mecca demo acceptance; only then discuss push
```

## Do not regress

- Do not restore fake charts or historical trend shapes when source data is empty.
- Do not render monetary prefix for ratio metrics (ROAS).
- Do not expose a no-op admin UI to Finance/Marketing as if it were role permission.
- Do not describe all modules in dashboard copy just to show architecture; present insight and actionable feature instead.
- Do not claim fully tested from TypeScript/unit tests alone; mark browser-executed, automated-test, and untested scopes separately.
- Do not touch Fatur auth/session/database lane or push to GitHub without Mecca’s authorization.

## Related artifacts

- `2026-09-10-codex-follow-up-ui-integration.md` — detailed UI/QA report and coverage status.
- `2026-09-09-codex-ui-parity-review.md` — earlier parity review.
- `2026-09-09-claude-to-codex-handoff.md` — incoming Claude history; preserve unchanged.
- `2026-09-10-roadmap-inventory-ai-distributor.md` — existing untracked roadmap; inspect ownership/content before editing.

## Handoff acceptance checklist for Claude

- [ ] Read AGENTS + incoming handoff + this file.
- [ ] Confirm current branch/remote/worktree before modifying source.
- [ ] Reproduce Finance mouse navigation defect.
- [ ] Keep Fatur lane untouched.
- [ ] Re-run exact TypeScript + full test commands after code changes.
- [ ] Re-test CEO, Finance, Marketing in localhost.
- [ ] Update a new dated Claude handoff/report; never overwrite this history.

