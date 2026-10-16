# KLIR — Deep Bug-Hunt Diagnosis Report

**Status akhir:** `AUDIT PARTIAL — COVERAGE GAP REMAINS`

**Mode:** diagnosis-only, no-fix

**Tanggal:** 10 September 2026

**Auditor:** Codex

**Target handoff:** Claude Code untuk remediation + rescan independen

---

## 0. Batasan eksekusi yang benar-benar diberlakukan

Audit ini sengaja berhenti di observasi, pembuktian source, test yang sudah ada, dan eksperimen yang tidak memutasi production. Tidak ada source code yang diubah.

Tidak dilakukan:

- perubahan source, schema, migration, formatter, atau test file baru;
- commit, push, deploy, upload production, import production;
- transaksi, delete, approval, credit top-up, atau AI action yang menulis database;
- perubahan login, session, membership, auth, landing page, atau lane Fatur;
- klaim exploit live terhadap production.

Yang dilakukan:

- rebaseline Git dan source diff;
- inventory seluruh route API;
- static scan tenant boundary, object ID, mutation, AI side-effect, approval, aggregation, error, dan UI wiring;
- deep-read lane AI/finance/inventory/booking/approval/data-import berisiko tinggi;
- menjalankan typecheck dan seluruh test yang sudah ada;
- memeriksa dokumen Claude/Codex sebelumnya sebagai histori dan cross-check;
- mencoba read-only browser evidence tanpa melakukan klik mutation.

Catatan penting: report ini merupakan delta diagnosis terhadap report lama. Dokumen lama tidak ditimpa:

- `2026-09-10-bug-hunt-gabungan-claude-codex.md`
- `2026-09-10-codex-bug-hunter-report-to-claude.md`
- `2026-09-10-codex-to-claude-handoff-4-data-integration.md`

---

## 1. Baseline dan kontrol scope

| Item | Hasil |
|---|---|
| HEAD | `90c2631` — `docs: bug hunt gabungan Claude+Codex (23+11 temuan) + handoff-4 data integration` |
| Branch | `main` |
| Worktree sebelum report | clean |
| Source diff `67ca575..HEAD` | tidak ada perubahan pada `src`, `prisma`, atau `tests` |
| Perubahan setelah audit ini | hanya file report diagnosis ini; bukan source |
| API route inventory | 95 file `src/app/api/v1/**/route.ts` |
| Existing combined findings | 23 Claude + 11 Codex = 34 finding/historical registry |
| Typecheck | PASS — `npx tsc --noEmit` |
| Existing test suite | PASS — 1.472/1.472 test, 250 suite |
| Production mutation | 0 |
| Production destructive action | 0 |
| Browser live proof | incomplete; read-only page capture timeout |

Karena source tidak berubah sejak baseline bug hunt `67ca575`, line reference lama masih dapat direvalidasi terhadap HEAD `90c2631`. Namun dokumen lama tetap tidak boleh diperlakukan sebagai bukti runtime baru. Finding lama harus dibedakan antara source-confirmed dan runtime-confirmed.

---

## 2. Model bukti

### 2.1 Severity

| Label | Arti |
|---|---|
| P0 | system-wide failure, tenant breach luas, financial abuse besar, atau kehilangan data besar |
| P1 | security, tenant isolation, destructive action, atau data integrity yang harus ditutup sebelum readiness |
| P2 | bug nyata dengan dampak terbatas/workaround, tetapi tetap merusak correctness |
| P3 | polish, consistency, atau incomplete feature tanpa kerusakan data langsung |

### 2.2 Confidence

| Label | Arti |
|---|---|
| C3 Confirmed | direproduksi di runtime/local harness/live read-only |
| C2 Strong | source path jelas dan diperkuat test/mock/kontrak/data-flow |
| C1 Candidate | static red flag, belum cukup bukti runtime |
| C0 Rejected | diuji dan terbukti bukan bug |

Severity dan confidence tidak boleh dicampur. Contoh: `P1/C2` berarti konsekuensinya serius dan source evidence kuat, tetapi belum dieksploitasi live. Tidak ada finding dalam report ini yang dinaikkan ke C3 hanya karena source terlihat mengerikan.

---

## 3. Coverage map

| Area | Coverage | Status dan catatan |
|---|---:|---|
| API route inventory | 95/95 | semua route sudah masuk surface map |
| High-risk API deep-read | core finance, AI, approval, inventory, booking, data-import | deep-read signifikan; belum berarti 95/95 full-read |
| Low-risk route source scan | 95/95 | static pattern scan; sebagian belum line-by-line |
| Tenant/object ownership | core suspicious patterns + existing safe lanes | finding lama direvalidasi; remaining broad matrix masih perlu regression harness |
| `brain/chat` | sebagian besar high-risk action path | **belum full-read** seluruh 2.333 line |
| `src/lib/ai-brain` | risk-heavy engines dibaca; tidak semua file | sekitar 24 dari 38 library masih perlu audit detail penuh |
| Booking | queue, reservations, reminder, loyalty dibaca | semua endpoint yang ditemukan pada inventory ini sudah disentuh; perlu cross-check tambahan bila route baru muncul |
| `FinanceModuleView` | data-loading dan dashboard wiring dibaca | belum 100% visual/render path |
| Existing tests | 1.472/1.472 pass | test hijau tidak membuktikan coverage invariant baru |
| Typecheck | PASS | tidak ada type error |
| Browser production | incomplete | CUA read-only capture timeout; tidak ada mutation |
| Mobile viewport 320–375 px | belum complete | static candidates sudah dicatat, runtime proof belum ada |

### Status coverage yang jujur

```text
95/95 route sudah diinventarisasi
high-risk lane sudah deep-read
semua existing test dan typecheck pass
full-read seluruh 95 route belum tercapai
full-read brain/chat dan seluruh ai-brain belum tercapai
live role smoke CEO/Finance/Marketing belum tercapai
```

Jadi status tidak boleh dinaikkan menjadi `AUDIT COMPLETE`, `AMAN`, atau `NO BUG`.

---

## 4. Temuan baru dari deep rescan

Temuan berikut adalah delta yang ditemukan atau diperjelas dalam rescan ini. Masing-masing memiliki expected behavior, actual behavior, evidence, impact, safe reproduction, false-positive check, remediation direction, dan acceptance criteria.

### DEEP-001 — AI execution menerima action caller tanpa binding ke recommendation yang sah

| Field | Nilai |
|---|---|
| Severity | **P1** |
| Confidence | **C2 Strong** |
| Category | AI authorization, business mutation, idempotency |
| Owner lane | Claude/Codex; auth/session tetap Fatur lane |
| Evidence | `src/app/api/v1/brain/execute/route.ts:30-49`; `src/lib/ai-brain/execution-engine.ts:20-168`; `src/lib/ai-brain/action-card-execution.ts:60-78` |

**Expected behavior**

```text
server-generated recommendation
  → workspace-bound
  → masih executable
  → actionType allowlisted
  → explicit confirmation/authorization
  → one-time/idempotent execution
  → mutation + audit
```

**Actual behavior**

Endpoint hanya memeriksa `recommendationId` dan `actionType` tidak kosong, lalu menerima `actionPayload` dari caller. `ExecutionEngine` menjalankan `SCALE_MARKETING`, `APPROVE_HIRING`, `AUDIT_OPEX`, atau `ADJUST_BUDGET` berdasarkan string tersebut. `recommendationId` hanya ditulis ke decision memory; tidak ada lookup untuk memastikan recommendation itu benar-benar ada, milik workspace, executable, belum dieksekusi, atau memiliki action type yang sama.

Frontend bridge bahkan membuat ID sintetis sendiri:

```text
card-${cardType}-${Date.now()}-${random}
```

**Impact**

Manager yang memiliki token valid berpotensi memanggil action write dengan recommendation ID acak. `SCALE_MARKETING` membuat `promoCoupon` nyata; `APPROVE_HIRING` membuat `workTask` nyata. Tidak ada idempotency key sehingga retry/double-click dapat membuat action duplicate. Ini bukan bypass login; ini authorization dan command-integrity gap setelah auth.

**Safe reproduction**

Hanya local/in-memory harness:

1. Seed workspace dan manager valid.
2. POST ke handler dengan `recommendationId: "random-not-issued"`.
3. Pilih `actionType: "SCALE_MARKETING"` dan payload nominal ekstrem sebagai fixture.
4. Assert apakah coupon dibuat meski recommendation tidak pernah diterbitkan.
5. Ulangi request dengan payload sama dan periksa duplicate.

Jangan jalankan POST ini terhadap production.

**Root cause**

Command endpoint mempercayai dua field command dari caller tanpa mengikat command ke recommendation server-side. Role `MANAGER` mempersempit siapa yang memanggil, tetapi tidak membuktikan apa yang sebenarnya diotorisasi.

**False-positive check**

Ini bukan sekadar “recommendation ID sintetis di UI”. Bukti kuatnya adalah server memang melakukan real DB write pada action type tertentu dan tidak melakukan lookup recommendation sebelum switch execution. Endpoint dapat dipanggil terlepas dari UI.

**Recommended fix direction — bukan eksekusi pada audit ini**

- resolve recommendation dari server-side source berdasarkan ID + workspace;
- reject missing, expired, non-executable, mismatched action type;
- server-side schema validation per action type;
- confirmation/approval token yang one-time;
- idempotency key dan unique execution record;
- audit record harus menyimpan actor dari auth, bukan body.

**Acceptance criteria**

- random recommendation ID → 404/409 tanpa mutation;
- mismatched action type → 400/403 tanpa mutation;
- same valid command replay → no duplicate side effect;
- workspace B recommendation dengan token workspace A → 404/403;
- action preview, confirmation, execution, failure memiliki state berbeda;
- test membuktikan DB side-effect count tetap satu.

---

### DEEP-002 — Purchase Order bernilai besar melewati spending approval guardrail

| Field | Nilai |
|---|---|
| Severity | **P1** |
| Confidence | **C2 Strong** |
| Category | financial authorization, approval bypass |
| Owner lane | Claude/Codex; keputusan schema/infra bila dibutuhkan dikoordinasikan, bukan diubah dalam audit |
| Evidence | `src/lib/ai-brain/spending-approval-guardrail.ts:1-11,83-130`; `src/app/api/v1/inventory/purchase-orders/route.ts:101-186` |

**Expected behavior**

```text
PO total
  → evaluateSpendingApproval()
  → MEMBER/MANAGER/ADMIN threshold
  → pending approval bila melewati threshold
  → approval resolution
  → baru PO + stock + cash mutation
```

**Actual behavior**

Spending guardrail mendokumentasikan bahwa integrasi “cek dulu sebelum `PurchaseOrder.create()`” belum terhubung. Route Purchase Order hanya membutuhkan minimum role `MEMBER`, menghitung `totalAmount`, lalu langsung membuat PurchaseOrder, StockMovement, increment product, dan CashTransaction dalam satu transaction. Atomicity transaksi memang baik untuk consistency internal, tetapi bukan pengganti approval authorization.

**Impact**

Member dapat membuat pengeluaran/PO bernilai tinggi tanpa approval manager/admin yang didefinisikan oleh guardrail. Dampaknya menyentuh stok dan kas sekaligus. Ini dapat menjadi financial control bypass.

**Safe reproduction**

Local fixture only:

1. Seed workspace dengan member dan product milik workspace.
2. Set item `qty * unitCost` di atas `OWNER_THRESHOLD`.
3. Panggil POST handler lewat test harness lokal.
4. Assert route meminta approval atau menolak sebelum PO/stock/cash dibuat.
5. Pada HEAD sekarang, observasi apakah direct transaction berjalan tanpa approval object.

Tidak boleh memakai endpoint production.

**Root cause**

Policy/guardrail berada sebagai library terpisah, tetapi route financial mutation tidak memanggilnya. Ada policy yang tidak menjadi enforcement point.

**False-positive check**

Purchase Order memang atomik dan semua `productId` sudah dicek terhadap workspace. Temuan ini bukan IDOR atau transaction partial failure; inti temuan adalah tidak adanya approval threshold enforcement.

**Recommended fix direction**

- jadikan approval evaluation bagian dari command boundary sebelum mutation;
- pending PO harus tidak menambah stok dan tidak mengurangi kas;
- approval harus workspace-bound, role-bound, dan idempotent;
- owner/admin bypass harus policy eksplisit dan audit-able.

**Acceptance criteria**

- PO di bawah threshold mengikuti policy normal;
- PO di atas threshold menghasilkan `PENDING_APPROVAL` tanpa stock/cash side-effect;
- approval unauthorized → 403 dan zero mutation;
- approval kedua/replay → no-op;
- approved PO hanya execute satu kali dan menyimpan actor/approval ID.

---

### DEEP-003 — REST delete seluruh kas dapat dipanggil role MEMBER tanpa approval boundary

| Field | Nilai |
|---|---|
| Severity | **P1** |
| Confidence | **C2 Strong** |
| Category | destructive action, financial data loss |
| Owner lane | Claude/Codex; bukan auth/login lane |
| Evidence | `src/app/api/v1/kas/transactions/route.ts:251-268` |

**Expected behavior**

Destructive bulk delete harus melewati role yang sesuai, explicit confirmation, approval bila policy mengharuskan, one-time action token, transaction/audit, dan idempotent replay protection.

**Actual behavior**

DELETE route memakai `withTenantGuard(..., { minRole: 'MEMBER' })`. Jika query `all=true` atau `clear=true`, route langsung menjalankan:

```text
cashTransaction.deleteMany({ where: { workspaceId } })
```

Tidak ada approval request, re-authentication, one-time token, atau server-side confirmation selain query flag.

**Impact**

Member valid dapat menghapus seluruh transaksi kas workspace. Ini berbeda dari delete satu object scoped: blast radius-nya seluruh ledger kas tenant.

**Safe reproduction**

Jalankan hanya pada local fixture dengan tiga transaksi dummy. Panggil handler dengan member token dan `all=true`, lalu assert expected policy. Audit saat ini menunjukkan route masuk ke `deleteMany`; tidak ada live deletion dilakukan.

**Root cause**

Direct REST mutation tidak memakai approval guardrail yang sudah tersedia untuk destructive AI purge. Enforcement hanya berada di UI/pattern lain, bukan di command server.

**False-positive check**

Ownership workspace pada `deleteMany` memang ada, sehingga ini bukan cross-tenant delete. Temuan tetap valid karena role dan approval boundary terlalu lemah untuk aksi irreversible.

**Recommended fix direction**

- hapus bulk delete dari direct member route atau ubah menjadi approval workflow;
- gunakan endpoint command dengan action token one-time;
- audit actor, reason, scope, count, dan result;
- tambahkan replay/concurrency protection.

**Acceptance criteria**

- MEMBER bulk delete → 403/approval pending, zero deletion;
- authorized destructive flow butuh explicit confirmation server-side;
- request replay tidak menghapus ulang atau menghasilkan ambiguous success;
- audit event selalu punya actor dari auth dan scope workspace.

---

### DEEP-004 — Security approval destructive action dapat di-resolve ulang dari memory state

| Field | Nilai |
|---|---|
| Severity | **P1** |
| Confidence | **C2 Strong** |
| Category | approval replay, destructive action, concurrency |
| Owner lane | Claude/Codex |
| Evidence | `src/lib/security-guardrail.ts:220-279` |

**Expected behavior**

```text
PENDING approval
  → atomically claim/resolve
  → execute one time
  → persist terminal state
  → second approve/replay = no-op atau 409
```

**Actual behavior**

`resolveApprovalRequest()` mencari `MEMORY_APPROVALS` berdasarkan ID dan workspace, tetapi lookup awal tidak mensyaratkan `status === 'PENDING'`. Setelah request diubah menjadi `APPROVED`, request tetap berada di array memory. Pemanggilan kedua dapat menemukan object yang sama, mengubah timestamp/resolver, dan masuk lagi ke branch `PURGE_FINANCE`, `PURGE_INVOICES`, atau action destructive lainnya.

**Impact**

Pada action purge, replay dapat menjalankan delete operation lagi. Walaupun delete kedua mungkin hanya menghasilkan count zero, execution semantics sudah tidak one-time dan audit menjadi ambigu. Concurrency dua approval juga berisiko menjalankan side-effect ganda sebelum state terminal tersimpan konsisten.

**Safe reproduction**

Gunakan memory fallback/local mock:

1. Buat approval `PURGE_FINANCE` dummy pada workspace fixture.
2. Resolve APPROVED sekali.
3. Resolve request ID sama kedua kali.
4. Assert second call menghasilkan 409/no-op dan tidak masuk branch execution.

Tidak ada purge production dilakukan.

**Root cause**

State machine approval tidak enforced pada resolver lookup dan execution tidak memakai atomic conditional claim. Persistence ActivityEvent saja tidak membuat in-memory request one-time.

**False-positive check**

`getPendingApprovals()` memang memfilter status PENDING, tetapi resolver lebih dulu membaca direct memory tanpa filter status. Jadi filter list tidak cukup melindungi PATCH resolver.

**Recommended fix direction**

- resolver hanya boleh claim status PENDING;
- gunakan atomic compare-and-set atau persistent row lock/conditional update;
- simpan execution receipt unik per approval ID;
- second resolution harus deterministic 409/no-op;
- audit result membedakan approved, executed, replayed, failed.

**Acceptance criteria**

- sequential double-approve → satu execution;
- concurrent double-approve → satu execution;
- approve after reject → no execution;
- same ticket across process restart → terminal state tetap dihormati;
- ActivityEvent dan execution receipt konsisten.

---

### DEEP-005 — Import ledger memisahkan cash transaction commit dan final file linkage

| Field | Nilai |
|---|---|
| Severity | **P1/P2** |
| Confidence | **C2 Strong** |
| Category | data lineage, idempotency, partial failure |
| Owner lane | Claude/Codex; schema/infra bila remediation memerlukan perubahan persistence harus eskalasi |
| Evidence | `src/app/api/v1/workspace-files/[id]/import-ledger/route.ts:276-327` |

**Expected behavior**

```text
claim file
  → create all domain records
  → persist exact linked IDs/provenance
  → invalidate cache
  → success
```

Jika tahap akhir gagal, sistem harus bisa menentukan dengan pasti apakah import berhasil, gagal, atau dapat dilanjutkan tanpa duplicate.

**Actual behavior**

Route memakai atomic claim marker, lalu membuat semua `CashTransaction` lewat `$transaction`. Setelah transaction sukses, route melakukan `workspaceFile.update({ linkedRecordIds: createdIds })` sebagai write terpisah. Jika update linkage gagal setelah cash commit, domain records sudah ada tetapi file masih marker/kosong/stale. Retry dapat menjadi stuck atau memerlukan keputusan manual tentang duplicate.

**Impact**

- Pusat Data dapat menampilkan status yang tidak sama dengan Buku Kas;
- provenance `linkedRecordIds` tidak menjamin record yang sudah dibuat;
- retry dapat menghasilkan duplicate atau file terkunci marker;
- dashboard/AI context dapat berbeda karena cache invalidation berada setelah linkage.

**Safe reproduction**

Local Prisma mock/harness:

1. Seed WorkspaceFile dengan empty `linkedRecordIds` dan drafts valid.
2. Mock cash `$transaction` sukses.
3. Mock final WorkspaceFile update throw.
4. Assert state response/error dan status file/domain records.
5. Uji retry policy tanpa memakai real database production.

**Root cause**

Claim, domain write, provenance finalization, dan cache invalidation belum membentuk state machine yang recoverable. Transaction array hanya melindungi cash rows, bukan final linkage.

**False-positive check**

Anti-double-click claim atomik adalah improvement nyata dan harus dipertahankan. Temuan ini tidak menuduh claim tersebut gagal; temuan ini berada setelah claim, pada failure boundary finalization.

**Recommended fix direction**

- gunakan import job/state yang punya `PENDING/PROCESSING/COMMITTED/FAILED`;
- simpan import batch/provenance dalam boundary yang atomic atau recoverable;
- bila linkage gagal, gunakan deterministic reconciliation sebelum retry;
- response harus membedakan committed-but-finalization-failed dari total failure.

**Acceptance criteria**

- injected final-link failure tidak membuat retry duplicate;
- file status dapat direkonsiliasi ke exact created IDs;
- partial/failed import terlihat di UI;
- import success hanya dikembalikan setelah provenance final tersimpan.

---

### DEEP-006 — Filter list kas tidak diterapkan ke aggregate dan MoM summary

| Field | Nilai |
|---|---|
| Severity | **P2** |
| Confidence | **C2 Strong** |
| Category | aggregation correctness |
| Owner lane | Claude/Codex |
| Evidence | `src/app/api/v1/kas/transactions/route.ts:57-119` |

**Expected behavior**

Jika request memakai `type=INCOME` atau `category=X`, list, period aggregate, previous-period aggregate, dan cumulative summary harus memiliki filter semantics yang sama atau response harus secara eksplisit menyebut summary global.

**Actual behavior**

`whereCondition` untuk list memasukkan `type` dan `category`. Tiga `groupBy` untuk `periodAggregates`, `prevAggregates`, dan `allTimeAggregates` hanya memfilter `workspaceId` dan tanggal. Akibatnya row list dapat terlihat hanya income/category tertentu, sementara total/summary tetap menghitung seluruh tipe/category.

**Impact**

Finance/CEO dapat melihat angka list dan angka summary yang tampak saling bertentangan. Jika consumer memakai `totalIncome`, `totalExpense`, atau `cumulativeCashBalance` sebagai KPI terfilter, keputusan bisnis menjadi salah.

**Safe reproduction**

Local fixture:

1. Seed satu income dan satu expense pada periode sama.
2. GET `?type=INCOME`.
3. Assert list hanya income.
4. Assert summary seharusnya juga income-only atau response mendeklarasikan global scope.

**Root cause**

Query predicates diduplikasi untuk list dan aggregate, tetapi filter client hanya ditempel ke salah satu predicate.

**False-positive check**

Jika contract memang bermaksud list terfilter tetapi summary selalu global, response harus memiliki nama/field yang jujur seperti `workspaceTotals`. Source/UI saat ini memakai field summary sebagai metrik periode sehingga ambiguity tetap menjadi bug contract.

**Acceptance criteria**

- filter contract didokumentasikan;
- list dan summary konsisten terhadap filter atau field global dinamai jelas;
- test kombinasi type/category/date boundary;
- frontend tidak lagi menampilkan angka global seolah-olah hasil filter.

---

### DEEP-007 — Invoice, payroll, dan booking memecah business state dan cash ledger menjadi dua write

| Field | Nilai |
|---|---|
| Severity | **P1/P2** |
| Confidence | **C2 Strong** |
| Category | financial consistency, partial failure, replay |
| Owner lane | Claude/Codex |
| Evidence | `src/app/api/v1/kas/invoices/route.ts:170-199`; `src/app/api/v1/kerja/payroll/route.ts:89-120`; `src/app/api/v1/booking/reservations/route.ts:53-85,109-141` |

**Expected behavior**

Perubahan status yang mengklaim otomatis mencatat kas harus atomic terhadap ledger, atau memiliki durable outbox/reconciliation yang membuat state intermediate jujur.

**Actual behavior**

- Invoice di-update ke `PAID`, baru setelah itu membuat CashTransaction.
- Payroll di-update `isPaid=true`, baru setelah itu membuat CashTransaction.
- Booking dibuat/di-update, baru setelah itu deposit/pelunasan membuat CashTransaction.

Jika write kedua gagal, business object sudah mengklaim selesai sementara ledger tidak mencatat uang. Pada concurrency/retry, guard hanya membaca state sebelum update dan tidak menjamin idempotency receipt, sehingga duplicate cash perlu diuji.

**Impact**

Data financial dapat divergen: invoice lunas tanpa income, payroll paid tanpa expense, booking confirmed/completed tanpa deposit/pelunasan. Ini langsung menjelaskan mengapa dashboard dapat terlihat kosong atau salah walau UI mengklaim sukses.

**Safe reproduction**

Local mock transaction:

1. Mock object update sukses.
2. Mock CashTransaction create throw atau timeout.
3. Assert apakah object rollback/retry state jelas.
4. Jalankan dua request concurrent pada fixture yang sama dan periksa jumlah cash rows.

Tidak ada pembayaran/booking/payroll production yang dijalankan.

**Root cause**

Business mutation dan side-effect ledger berada di luar transaction boundary yang sama dan tidak memiliki unique source reference/idempotency key yang ditegakkan.

**False-positive check**

Invoice/payroll/booking masing-masing punya ownership check workspace sebelum update. Temuan ini bukan IDOR; ini consistency/duplicate-risk setelah authorization berhasil.

**Recommended fix direction**

- transaction yang mencakup status + ledger row bila provider tidak terlibat;
- sourceType/sourceId atau unique idempotency key untuk ledger;
- explicit `PAYMENT_PENDING`/`LEDGER_RECONCILIATION_REQUIRED` state bila side-effect eksternal;
- concurrent transition conditional update.

**Acceptance criteria**

- injected second-write failure menghasilkan rollback atau state failed yang terlihat;
- repeat request tidak membuat duplicate cash;
- exactly-one ledger row per source event;
- dashboard dan object detail sepakat tentang status.

---

### DEEP-008 — Metadata approval menerima identitas dan action metadata dari client

| Field | Nilai |
|---|---|
| Severity | **P2** |
| Confidence | **C2 Strong** |
| Category | audit integrity, approval contract |
| Owner lane | Claude/Codex |
| Evidence | `src/app/api/v1/security/approvals/route.ts` POST path; `src/lib/security-guardrail.ts` approval creation types |

**Expected behavior**

Requester identity, workspace, role, allowed action type, dan object scope harus berasal dari auth/server state. Client hanya boleh mengirim intent/data yang divalidasi schema.

**Actual behavior**

Approval POST menerima metadata seperti `requesterRole`, `requesterName`, `actionType`, title/description/originalPrompt dari body. PATCH resolver memang mengambil actor resolver dari tenant guard, tetapi metadata request awal dapat dipalsukan atau memakai action type yang tidak allowlisted.

**Impact**

Audit trail dapat menyatakan request dibuat oleh role/nama yang tidak benar. Jika future executor mempercayai `actionType` mentah, spoofed action dapat menjadi execution path. Saat ini dampak terbesar yang terbukti adalah audit integrity; execution impact perlu test contract tambahan.

**Safe reproduction**

Local handler dengan MEMBER valid namun body `requesterRole: OWNER`, nama palsu, dan action type tidak dikenal. Assert server menolak metadata mismatch atau menyimpan actor asli.

**Root cause**

Approval DTO mencampur user-provided narrative dengan authorization facts dan tidak melakukan allowlist/identity binding di boundary.

**False-positive check**

PATCH approval tetap memiliki minRole OWNER dan resolver `resolvedBy` diambil dari auth. Jadi report ini tidak mengklaim requester metadata langsung memberi hak approve; masalahnya adalah trust boundary dan audit correctness.

**Acceptance criteria**

- requester role/name selalu server-derived;
- `actionType` allowlisted;
- unsupported action rejected;
- original prompt diperlakukan sebagai untrusted text, bukan instruction;
- audit record membedakan requestedBy, resolvedBy, dan execution actor.

---

### DEEP-009 — Spending approval resolver memiliki race window dan belum memiliki exactly-once resolution

| Field | Nilai |
|---|---|
| Severity | **P2** |
| Confidence | **C2 Strong** |
| Category | approval concurrency |
| Owner lane | Claude/Codex |
| Evidence | `src/lib/ai-brain/spending-approval-guardrail.ts:170-270` |

**Expected behavior**

Dua approval request konkuren untuk ticket yang sama harus menghasilkan satu terminal resolution dan satu side-effect.

**Actual behavior**

Guardrail membaca pending request, mengecek role, lalu menulis resolution event. Tidak tampak atomic compare-and-set/unique resolution claim pada command boundary. Dua caller yang masuk bersamaan berpotensi sama-sama melihat pending sebelum event caller lain terlihat.

**Impact**

Jika approval kemudian dihubungkan ke PO/payment execution, duplicate approval atau duplicate execution dapat terjadi. Saat ini execution integration PO belum terhubung (DEEP-002), sehingga finding ini terutama preparatory race risk pada guardrail.

**Safe reproduction**

Local mock dua `resolveSpendingApproval()` concurrent dengan same approval ID. Assert hanya satu resolution accepted.

**False-positive check**

Tidak mengklaim telah membuat duplicate production side-effect. Confidence C2 karena source flow tanpa atomic claim jelas; runtime concurrency proof masih gap.

**Acceptance criteria**

- concurrent resolve menghasilkan satu winner;
- loser menerima deterministic 409/no-op;
- unique constraint atau equivalent persistent claim;
- execution receipt terhubung ke approval ID.

---

### DEEP-010 — Banyak API response memantulkan raw internal error ke client

| Field | Nilai |
|---|---|
| Severity | **P2** |
| Confidence | **C2 Strong** |
| Category | error disclosure, observability |
| Owner lane | Claude/Codex; public health/auth policy tetap koordinasi Fatur bila menyentuh shared guard |
| Evidence examples | `kas/invoices/route.ts:61,154,207`; `kas/transactions/route.ts:185,224,272`; `kerja/payroll/route.ts:30,73,128`; `booking/reservations/route.ts:32,93,149`; `brain/chat/route.ts:2329`; `brain/recommendations/route.ts:37`; `brain/forecast/route.ts:124` |

**Expected behavior**

Client menerima stable error code/message yang aman; detail Prisma/provider/stack hanya masuk server log dengan correlation ID.

**Actual behavior**

Banyak catch block mengembalikan `{ message: err.message }` langsung. Error itu dapat berisi constraint name, provider detail, field/database information, atau operational internals.

**Impact**

Disclosure mempermudah reconnaissance dan membuat UI bergantung pada pesan internal yang tidak stabil. BH-010 sebelumnya sudah mencatat raw DB error pada health endpoint; scan ini menunjukkan pola lebih luas.

**Safe reproduction**

Local mock throw error dengan string simulasi `PrismaClientKnownRequestError`/provider detail. Assert response memakai sanitized code, bukan raw message.

**False-positive check**

Sebagian error message memang sengaja user-facing validation. Finding fokus pada catch-all error paths, bukan semua `message` response.

**Acceptance criteria**

- error taxonomy per route;
- raw detail tidak keluar pada 4xx/5xx;
- server log memiliki correlation ID;
- existing tests mencakup Prisma/provider exception.

---

## 5. Pusat Data → domain table → dashboard: root cause lengkap

### 5.1 Jalur yang benar-benar terjadi di HEAD

```text
Upload file di Pusat Data
        |
        v
WorkspaceFile + extractedSummary + company knowledge
        |
        +---- tidak otomatis membuat CashTransaction/Product/Campaign/Invoice
        |
        v
Tombol manual "Impor ke Buku Kas"
        |
        v
Preview + confirm + mappingHash
        |
        v
CashTransaction melalui import-ledger
        |
        v
kas/transactions + financial-trends
        |
        v
Finance / CEO dashboard
```

### 5.2 Bukti dari screenshot user

Screenshot yang diberikan user menunjukkan:

- Pusat Data berisi 11 file;
- beberapa file memiliki tombol `Impor ke Buku Kas`;
- status file berbunyi `belum ada data turunan tercatat`.

Ini konsisten dengan source: upload sukses tidak sama dengan domain import sukses. Dashboard membaca canonical domain records, bukan sekadar daftar `WorkspaceFile`.

### 5.3 Mengapa dashboard masih kosong

Ada dua penyebab berbeda yang harus dipisahkan:

```text
A. File baru di-upload tetapi belum diklik Import ke Buku Kas
   → belum ada CashTransaction
   → dashboard kas tidak punya record untuk ditampilkan.

B. File sudah di-import, tetapi tanggal sumber berada di bulan lampau
   → importer menyimpan transactionDate asli row sumber
   → dashboard memanggil kas/transactions tanpa range
   → backend default ke bulan berjalan
   → record berhasil ada, tetapi tidak muncul di view bulan berjalan.
```

### 5.4 Masalah tambahan pada import

- Badge “bisa diimpor” terutama berbasis extension/status, bukan semantic validation penuh.
- Confidence preview dapat rendah dan default type berisiko membuat income/expense salah.
- `laporan-keuangan-laba-rugi.xlsx` sebelumnya teridentifikasi ditolak importer, sehingga “file ada” tidak berarti “domain data tersedia”.
- Final `linkedRecordIds` ditulis setelah cash transaction transaction selesai; lihat DEEP-005.
- Context cache diinvalidasi setelah linkage, jadi failure sebelum tahap itu dapat meninggalkan stale context.

### 5.5 Acceptance contract Pusat Data

Claude tidak boleh menyatakan integrasi selesai hanya karena file muncul di modal. Minimal harus terbukti:

```text
upload
  → extraction
  → semantic classification
  → preview row/total/date/type
  → explicit confirmation
  → canonical record
  → provenance/linkage
  → dashboard range visible
  → AI context refresh
```

Test wajib mencakup file current month, previous month, mixed dates, invalid row, duplicate import, retry after failure, dan refresh tiga role.

---

## 6. AI side-effect matrix

| Flow | Current evidence | Risk status |
|---|---|---|
| Read-only financial analysis | reads scoped workspace data | perlu tetap dijaga sebagai read-only |
| `brain/chat` regular write | source path dapat membuat CashTransaction/Invoice/Workspace dari conversational action | **P1/high carry-over**, full chat read masih gap |
| `brain/execute` | manager guard ada, tetapi action/recommendation binding tidak ada | **DEEP-001 P1/C2** |
| `SCALE_MARKETING` | membuat PromoCoupon nyata; ad platform budget tidak disentuh | side-effect nyata, harus confirmation/idempotency |
| `APPROVE_HIRING` | membuat WorkTask nyata | side-effect nyata, recommendation binding wajib |
| `AUDIT_OPEX`/`ADJUST_BUDGET` | membuat WorkTask | action type allowlist wajib |
| `COLLECT_INVOICES` | hanya local read; provider message tidak dikirim | UI harus tetap menyebut “identified”, bukan “sent” |
| AI purge approval | approval flow + destructive DB delete | replay/state-machine gap DEEP-004 |
| AI workspace context | file filter workspace, tidak filter role/portal | BH-014 by design; policy harus eksplisit |
| action card frontend | recommendation ID sintetis dari browser | memperkuat DEEP-001 |

Invariant yang harus dipakai:

```text
LLM boleh mengusulkan action.
LLM tidak boleh menjadi authority permission.
LLM tidak boleh menentukan workspace.
LLM tidak boleh melewati confirmation.
LLM output tidak boleh langsung menjadi sumber kebenaran finansial.
```

---

## 7. Revalidation registry terhadap existing 23 + 11 findings

Source belum berubah dari baseline, jadi existing findings tetap relevan. Rescan ini tidak mengklaim 34 item semuanya direproduksi runtime; status di bawah adalah source/data-flow revalidation.

| Family / ID | Status HEAD | Evidence status |
|---|---|---|
| BH-001 top-up credit minting | tetap terbuka | source kuat; live exploit tidak dilakukan; Fatur/auth/payment policy boundary perlu koordinasi |
| BH-002 CorPlan project ownership | tetap terbuka | `findUnique(id)` tanpa parent workspace proof |
| BH-003 AniVirtual session ownership | tetap terbuka | `findUnique(id)` tanpa workspace predicate pada understand path |
| BH-004 / Claude #1 task IDOR | tetap terbuka | update by global task ID; read/write ownership gap |
| Claude #2 brain/chat Viewer write | tetap terbuka, diperluas | regular AI action path perlu full-read + role/confirmation matrix |
| Claude #3 synthetic daily chart | tetap terbuka | UI ramps dari aggregate, bukan per-date source rows |
| BH-005 CEO default marketing/team | tetap terbuka | `DEFAULT_MKT`/`DEFAULT_TEAM` masih menjadi fallback/main card source |
| BH-006 invoice page aggregate | tetap terbuka | list cap `take:50` mempengaruhi totals |
| BH-007 cash count page aggregate | tetap terbuka | count memakai returned page length/cap |
| BH-008 queue “today” all-time | tetap terbuka | date boundary belum sesuai label |
| BH-009 attendance all-time/take 30 | tetap terbuka | scope/limit mismatch |
| Claude #7 runway monthly semantics | tetap terbuka | lifetime totals dipakai sebagai monthly semantics |
| Claude #8 GPS Verified default | tetap terbuka | server default tidak membuktikan GPS |
| Claude #9 consignment dead stock | tetap terbuka | inventory intelligence classification |
| Claude #10 month label shift | tetap terbuka | UI date label candidate |
| Claude #11 previous cash ratio extrapolation | tetap terbuka | previous period bukan historical aggregate |
| Claude #12 hardcoded ROAS 3.0x | tetap terbuka | UI text/logic contradiction |
| Claude #13 voucher depletion condition | tetap terbuka | status check bukan quota depletion |
| Claude #14 3-month forecast browse month | tetap terbuka | forecast anchor semantics |
| BH-010 public health disclosure | tetap terbuka | env/provider/count/raw DB error |
| BH-011 access admin UI local state | tetap terbuka | visual toggle belum backend enforcement |
| Claude #5/#6 global attachment state | tetap terbuka | Executive + Finance attachment scope |
| Claude #4 payroll split write | tetap terbuka + diperluas DEEP-007 | payroll status/cash separate |
| Claude #15 negative stock photo commit | tetap terbuka | invariant inventory negative belum uniform |
| Claude #16 silent dropped rows | tetap terbuka | generic success menutup parse failures |
| Claude #17 stale supplier score | tetap terbuka | cross-tab refresh gap |
| Claude #18 payroll backend no UI | tetap terbuka | capability exists but no portal entry |
| Claude #19–22 low functional items | tetap open/triage | onRoleChange, manual price overwrite, AI invoice validation |
| BH-012 localStorage chat state | limitation, not tenant breach | persistence/device limitation; UI disclosure needed |
| BH-013 imported historical transaction invisible | tetap terbuka | importer source date vs current-month dashboard default |
| BH-014 AI knowledge cross-role | policy decision required | workspace-scoped, role-unfiltered by design |

Dokumen gabungan menyebut 23 Claude + 11 Codex. Jika Claude menemukan item #23 yang tidak terurai di tabel lama, item tersebut harus dimasukkan ke registry final, diberi ID stable, dan tidak dianggap hilang hanya karena report lama mengelompokkannya.

---

## 8. Negative findings — yang sudah diperiksa dan tidak dinaikkan menjadi bug baru

Ini bukan klaim seluruh sistem aman. Ini adalah guardrail agar audit berikutnya tidak mengulang false positive yang sama.

| Area | Observasi negatif |
|---|---|
| Marketing campaigns | PATCH/DELETE menggunakan ownership scope workspace |
| Promo coupons | PATCH/DELETE memakai workspace scope |
| Inventory sales/returns/consignment | ownership checks dan atomic paths terlihat konsisten; existing tests mendukung |
| Inventory product-batches | tenant checks ada pada path yang dibaca |
| Media routes | JWT/origin/membership/rate/idempotency guard dan tests sudah ada |
| Workspace file import claim | atomic claim marker mengurangi double-click/TOCTOU awal; finalization gap tetap DEEP-005 |
| AI context/simulate/generate | spoofed workspace tests existing pass pada path yang diuji |
| Marketing reports empty state | UI berkata “Segera hadir”; tidak diklaim sebagai data real |
| Booking reminder/loyalty | route yang dibaca bersifat read/stateless dan tidak menghasilkan finding baru |
| Purchase Order tenant scope | product IDs diverifikasi milik workspace; finding-nya approval bypass, bukan IDOR |
| Invoice/payroll/reservation ownership | object ownership comparison ada; finding-nya consistency/replay, bukan cross-tenant access |

---

## 9. Unscanned / incomplete register

Item di bawah sengaja tidak ditutup sebagai “aman”:

1. Full line-by-line `src/app/api/v1/brain/chat/route.ts` sekitar 2.333 line.
2. Sekitar 24 dari 38 `src/lib/ai-brain/**` files belum diaudit detail penuh; terutama engine yang belum masuk high-risk deep-read.
3. Full recommendation/action schema contract dan all caller matrix.
4. Full FinanceModuleView render/UI path 100%.
5. Browser read-only smoke CEO, Finance, Marketing dengan clean tab/second tab/refresh.
6. Keyboard Enter vs mouse click pada seluruh navigasi penting.
7. Viewport runtime 320, 375, 768, 1024, 1280, 1440.
8. Local concurrency harness untuk approval replay, ledger finalization, payroll/invoice/booking double-submit.
9. Provider timeout and retry behavior bila provider integrations diaktifkan.
10. Full object-access matrix untuk setiap route mutation, bukan hanya suspicious pattern hits.
11. Semantic import fixtures untuk seluruh 11 file Pusat Data user.
12. Cross-role policy decision: apakah file knowledge memang sengaja identical untuk CEO/Finance/Marketing atau harus partitioned.

---

## 10. Handoff boundary

### Claude/Codex boleh memperbaiki setelah diagnosis ini diterima

- object ownership dan tenant predicate pada CorPlan, AniVirtual, WorkTask, dan mutation sejenis;
- AI chat/action role gate dan explicit confirmation;
- `brain/execute` recommendation binding, allowlist, idempotency;
- spending approval integration ke Purchase Order;
- destructive cash-delete approval boundary;
- approval state machine/replay/concurrency;
- import provenance/finalization/reconciliation;
- invoice/payroll/booking atomic financial side-effect;
- dashboard aggregation/date semantics dan Pusat Data wiring;
- UI yang mengklaim data real tetapi memakai default/synthetic values;
- sanitized error contract;
- regression tests untuk setiap invariant.

### Fatur lane — jangan disentuh dalam remediation ini

- login, auth/session, membership bootstrap, demo auto-provision;
- landing page dan login UI;
- shared auth/tenant-guard policy bila perubahan memerlukan keputusan identity/infra;
- schema/infra migration tanpa handoff eksplisit.

Jika remediation membutuhkan perubahan Fatur lane, buat blocker/coordination item terpisah. Jangan menyamarkan perubahan itu sebagai bug fix biasa.

---

## 11. Urutan rescan/remediation yang disarankan untuk Claude

```text
GATE 1 — destructive + financial authorization
  DEEP-003 direct cash bulk delete
  DEEP-004 approval replay
  DEEP-002 PO approval bypass
  DEEP-001 AI execution binding

GATE 2 — tenant isolation
  BH-002 CorPlan
  BH-003 AniVirtual
  BH-004 task IDOR
  full object-ID matrix

GATE 3 — financial consistency
  DEEP-007 invoice/payroll/booking split writes
  DEEP-005 importer finalization
  DEEP-006 filtered aggregates
  BH-006/BH-007/BH-008/BH-009/BH-013

GATE 4 — data truth/UI
  BH-005 + Claude #3 synthetic dashboard
  Claude #10/#11/#12/#13/#14
  Pusat Data current-month/previous-month role refresh

GATE 5 — remaining AI/UI coverage
  full brain/chat
  remaining ai-brain libraries
  attachment isolation
  mobile/keyboard/browser smoke
  raw error contract
```

Setiap fix harus diikuti:

```text
source diff
  → targeted regression test
  → full existing test suite
  → typecheck
  → read-only browser proof
  → rescan finding registry
  → negative finding update
```

---

## 12. Completion gate diagnosis-only

| Gate | Status |
|---|---|
| 95 route masuk inventory | PASS |
| baseline HEAD/branch/worktree diverifikasi | PASS |
| source diff sejak 67ca575 diverifikasi | PASS — source unchanged |
| existing tests dijalankan | PASS — 1.472/1.472 |
| typecheck dijalankan | PASS |
| P0/P1 known paths dibaca | PARTIAL/PASS untuk core lanes; full route denominator belum line-read |
| brain/chat full-read | NOT COMPLETE |
| 38 ai-brain full audit | NOT COMPLETE |
| 23+11 existing registry revalidated | PARTIAL — source/data-flow revalidation, bukan runtime reproduction semua item |
| tenant object-access matrix penuh | NOT COMPLETE |
| AI side-effect matrix penuh | NOT COMPLETE — DEEP-001 dan carry-over #2 masih open |
| Pusat Data lineage traced | PASS untuk current implementation path; semantic fixture coverage belum penuh |
| all role browser smoke | NOT COMPLETE |
| mobile/keyboard QA | NOT COMPLETE |
| live production destructive action | PASS — 0 |
| live production mutation | PASS — 0 |
| source modification oleh audit | PASS — 0 |
| Fatur lane modification | PASS — 0 |
| setiap finding punya severity/confidence/evidence | PASS untuk finding dalam report ini |
| clean/no-bug claim | NOT ALLOWED |

---

## Kesimpulan

```text
AUDIT PARTIAL — COVERAGE GAP REMAINS
```

Hasil paling penting bukan hanya “dashboard kosong karena belum import”. Rangkaian yang perlu Claude prioritaskan adalah:

```text
caller/auth
   ↓
role + approval
   ↓
object tenant boundary
   ↓
AI interpretation / command binding
   ↓
financial or domain mutation
   ↓
provenance + idempotency
   ↓
aggregate/date scope
   ↓
dashboard + AI claim
```

Pada HEAD saat ini masih ada sambungan yang source-nya belum cukup aman untuk disebut selesai: action execution belum bound ke recommendation, high-value PO melewati approval, bulk cash delete terlalu lemah, approval destructive bisa direplay, import linkage bisa gagal setelah domain commit, dan beberapa financial writes tidak atomic terhadap ledger. Di sisi data visibility, upload Pusat Data memang belum sama dengan import domain; setelah import pun data historis dapat tersembunyi oleh default current-month dashboard.

Tidak ada source fix yang dilakukan dalam audit ini. Report ini siap dipakai Claude sebagai input remediation dan kemudian harus diikuti rescan dengan denominator/evidence yang sama.
