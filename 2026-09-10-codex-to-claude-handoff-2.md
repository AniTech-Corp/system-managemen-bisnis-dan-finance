# Codex → Claude Handoff 2 — KLIR Lane Kamu

Tanggal: 10 September 2026 WIB
Status: **IMPLEMENTED LOCALLY — LIVE/BROWSER PROOF PARTIAL**

Dokumen ini mencatat implementasi di lane dashboard, AI Assistant, tujuh modul, import/data lineage, dan integrasi data. Lane Fatur tidak diubah.

## Baseline dan kontrol scope

```text
HEAD saat verifikasi: 3c3a7040e46f5cb2e225e184a34c56b4ae1ef1e9
Branch: main
Worktree: sudah dirty sebelum batch ini; perubahan existing dipertahankan
Push/deploy production: 0
Production mutation/import/delete/approval/top-up: 0
Fatur lane modification oleh batch ini: 0
```

Fatur lane yang sengaja tidak disentuh: login, landing page, auth/session/membership, subscription/payment, top-up kredit, package/lock/deploy, dan infra yang bukan bagian integrasi aplikasi.

## Implementasi yang sudah masuk

### 1. Dashboard dan angka operasional

```text
[TEST + BUILD]
- CompanyDataDashboard tidak lagi menampilkan DEFAULT_MKT/DEFAULT_TEAM sebagai angka aktual.
- ROAS, conversion, CAC, channel, time-series marketing, workload, headcount, SLA,
  dan payroll yang belum punya sumber data ditampilkan sebagai “Belum ada data”.
- Grafik finance memakai label bulan dinamis dari periode terpilih; label hardcode Mar–Agu
  dan proyeksi bulan tetap dihapus.
- Closing cash bulanan berasal dari opening balance + cumulative ledger, bukan rasio.
- Financial trend dan filter tanggal memakai batas kalender WIB.
```

Bukti: `src/app/components/CompanyDataDashboard.tsx:939`, `src/lib/time-series-engine.ts:84`, `src/app/api/v1/analytics/financial-trends/route.ts:53`.

### 2. Pusat Data → Buku Kas → Dashboard/AI

```text
[TEST + BUILD]
- import ledger klasik dan generic mapping memakai preview + confirm + mappingHash.
- claim import dan CashTransaction sekarang berada di interactive transaction yang sama.
- duplicate import ditolak; claim conflict menjadi 409.
- kegagalan di tengah proses tidak meninggalkan marker “sudah diimpor” tanpa transaksi.
- provenance linkedRecordIds tetap diperbarui dalam boundary yang sama.
```

Bukti: `src/app/api/v1/workspace-files/[id]/import-ledger/route.ts:61`, `:298`, `:327`.

Catatan produk: upload file memang belum otomatis membuat CashTransaction. User tetap harus menekan **Impor ke Buku Kas** setelah preview. Ini bukan silent failure; status upload dan status import adalah dua state berbeda.

### 3. AI Assistant dan kejujuran data

```text
[TEST + BUILD]
- brain/chat tidak lagi memakai angka financial/marketing/team dari liveState browser
  sebagai sumber kebenaran ketika server context gagal.
- server context gagal → AI mengatakan data belum tersedia, bukan mengulang angka UI.
- attachment diperlakukan sebagai data tidak tepercaya, bukan instruksi/role/permission.
- mutation natural-language tetap melewati preview/confirmation.
- execution engine memakai idempotency key dan advisory lock transaction-scoped.
```

Bukti: `src/app/api/v1/brain/chat/route.ts:197`, `:430`, `:903`, `src/lib/ai-brain/execution-engine.ts:22`.

### 4. Approval, destructive action, dan race condition

```text
[TEST + BUILD]
- purchase order nominal tinggi ditahan dan memakai spending approval.
- resolver spending approval memakai lock PostgreSQL transaction-scoped.
- resolver security/destructive approval memakai lock yang sama dan hanya memproses tiket PENDING.
- bulk delete kas membutuhkan approval; tidak lagi menjadi jalur bebas MEMBER.
- approval replay lintas worker dipagari advisory lock, bukan hanya Map in-memory.
```

Bukti: `src/app/api/v1/inventory/purchase-orders/route.ts:125`, `src/lib/ai-brain/spending-approval-guardrail.ts:336`, `src/lib/security-guardrail.ts:339`.

### 5. Routing provider sesuai kontrak produk

```text
[TEST + BUILD]
- pertanyaan/chat singkat: preferred route Groq.
- transkripsi audio/video otomatis: Gemini Direct lebih dahulu, lalu Groq, lalu OpenRouter.
- request model OpenRouter eksplisit tetap dihormati.
- katalog media menampilkan Gemini transcription bila kredensial tersedia.
- istilah provider yang benar: Groq, bukan Grok.
```

Bukti: `src/lib/ai-orchestrator.ts:94`, `src/lib/media-provider.ts:355`, `:390`, `src/app/api/v1/media/models/route.ts`.

## Verifikasi yang sudah dijalankan

```text
Focused regression suite: 71 pass / 0 fail
Full suite:             1484 pass / 0 fail, 250 suite
TypeScript:              npx tsc --noEmit PASS
Production build lokal:  npm run build PASS
Next static pages:       92/92 generated
git diff --check:        tidak menemukan whitespace error
```

Warning yang muncul di full suite adalah log simulasi dari fixture fail-soft/unmocked Prisma, bukan test failure. Lint global masih tercampur arsip/design-reference dan baseline lama; tidak dijadikan alasan untuk mengubah file Fatur atau memborong unrelated cleanup.

## Status coverage yang belum boleh diklaim selesai

```text
[BELUM / BROWSER]
- V1–V12 manual browser dengan sesi login Mecca.
- Smoke AI Marketing melalui tombol nav.
- Responsive 375px untuk tujuh tab Stok & Pembelian.
- Seed data nyata via UI lalu cross-check jawaban AI dengan angka tab.
- Screenshot/live evidence untuk setiap role CEO, Finance, Marketing.

[BELUM / FAILURE-INJECTION]
- Bukti runtime database/provider timeout pada invoice-payroll-booking split-write.
- Bukti multi-worker nyata di environment production.
- Rekonsiliasi terhadap seluruh 46 finding satu per satu dengan evidence tier final.
```

Karena browser QA belum dijalankan pada batch ini, status yang benar adalah:

```text
AUDIT PARTIAL — SOURCE, TEST, TYPECHECK, DAN BUILD SUDAH DIVERIFIKASI;
BROWSER/LIVE EVIDENCE MASIH TERBUKA.
```

## Finding yang tetap di luar lane Codex

```text
BH-001 credits/topup: Fatur/keputusan bisnis, tidak disentuh.
Login, landing, auth/session/membership, subscription/payment, package/lock/deploy:
Fatur.
```

Tidak ada push atau deploy dari batch ini. Claude dapat memakai dokumen ini untuk cross-verify per-GATE tanpa mengulang klaim browser yang belum terbukti.

## Koreksi jalur repository dan instruksi release

Hasil pengecekan read-only terhadap remote GitHub pada 10 September 2026:

```text
AniTech-Corp/KLIR      → 404 Repository not found
AniTech-Dev/KLIR       → aktif; main = 3c3a7040e46f5cb2e225e184a34c56b4ae1ef1e9
AniTech-Dev/KLIR-UMKM  → aktif; main = b59f17f3fc6d17456346dd3a8ae48865734c667d
```

Remote `origin` clone Public/Private sudah benar:

```text
https://github.com/AniTech-Dev/KLIR.git
```

Clone UMKM juga sudah disinkronkan fast-forward tanpa merge manual:

```text
Folder: KLIR/04-KLIR-UMKM/klir-umkm-repo-clone/
HEAD: b59f17f
origin: https://github.com/AniTech-Dev/KLIR-UMKM.git
Worktree: clean
```

### Yang Claude wajib lakukan sebelum push KLIR Public/Private

```text
1. Pastikan `git remote -v` menunjuk ke AniTech-Dev/KLIR.git.
2. Jalankan `git fetch --prune origin`.
3. Baca `git status --short` dan simpan semua perubahan existing.
4. Verifikasi HEAD/rebase/merge terhadap origin/main; jangan memakai URL AniTech-Corp.
5. Jalankan tsc, full test, build, dan diff --check.
6. Audit zona merah Fatur sebelum commit: auth/login/session/membership,
   landing, package/lock/deploy, top-up/payment.
7. Commit hanya perubahan KLIR Public/Private yang sudah diverifikasi.
8. Push ke `origin main` AniTech-Dev/KLIR hanya setelah izin Mecca eksplisit.
9. Jangan mencampur commit atau file KLIR-UMKM ke repository Public/Private.
```

### Yang berlaku untuk KLIR UMKM

KLIR UMKM adalah repository dan codebase terpisah, bukan subset yang boleh dicopy-paste ke Public/Private. Jika Claude mengerjakan UMKM, masuk ke clone `KLIR/04-KLIR-UMKM/klir-umkm-repo-clone/`, baca README/AGENTS setempat, verifikasi remote `AniTech-Dev/KLIR-UMKM.git`, dan lakukan test/build di sana. Tidak ada merge lintas-repository tanpa keputusan produk eksplisit.

### Catatan insiden Fatur

Histori lokal dan project map mencatat insiden salah-target push yang sudah dikoreksi. Guardrail permanennya adalah validasi remote exact sebelum setiap push. URL lama `AniTech-Corp/KLIR` tidak boleh dipakai sebagai fallback karena saat diverifikasi memang 404, bukan sekadar redirect yang belum terbaca.
