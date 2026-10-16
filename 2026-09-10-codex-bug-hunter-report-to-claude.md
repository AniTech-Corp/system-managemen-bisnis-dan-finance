# KLIR — Codex Bug Hunter Report → Claude

**Tanggal:** 10 September 2026 (WIB)  
**Repository:** `klir-repo-clone`  
**HEAD saat scan:** `67ca575 docs: tambah pointer kredensial demo QA ke handoff #3`  
**Status:** Diagnostic/report-only. Tidak ada source code yang diubah, tidak ada commit, push, deploy, upload, import, transaksi, campaign, pengiriman WhatsApp, atau aksi destruktif di environment live.

---

## 0. Ringkasan eksekutif

Scan menemukan beberapa isu yang lebih serius daripada sekadar tampilan dashboard kosong. Empat temuan pertama berada di jalur keamanan tenant/otorisasi dan perlu diprioritaskan sebelum sistem dianggap aman untuk multi-tenant:

| Prioritas | ID | Area | Kesimpulan |
|---|---|---|---|
| **P0/P1 conditional** | BH-001 | Credits/top-up | Endpoint dapat menambah saldo berdasarkan input client tanpa verifikasi payment settlement dan tanpa workspace authorization yang terlihat. Jika route ini reachable di production, ini berpotensi menjadi free-credit/payment-bypass. |
| **P1** | BH-002 | CorPlan | `corPlanProjectId` dibaca tanpa ownership check; berpotensi cross-tenant read/leak. |
| **P1** | BH-003 | AniVirtual | `sessionId` dibaca/ditulis tanpa workspace ownership check; berpotensi cross-tenant conversation read/write. |
| **P1** | BH-004 | Kerja/task | `PUT` task memakai ID global tanpa filter workspace; berpotensi cross-tenant mutation. |
| **P1/P2** | BH-005 | CEO dashboard | Kartu/chart utama marketing dan team masih memakai default/hardcoded data; summary real hanya ditambahkan sebagai blok sekunder. |
| **P2** | BH-006–BH-009 | Aggregation/date scope | Invoice, cash transaction, queue, dan attendance memiliki semantics total/hari yang salah atau terpotong limit. |
| **P2** | BH-010 | Health endpoint | Endpoint publik membocorkan environment, jumlah workspace aktif, provider, dan raw DB error. |
| **P1/P2 product gap** | BH-011 | Access admin UI | Toggle akses divisi hanya mengubah React state; tidak punya efek backend. Ini tidak boleh dianggap RBAC sungguhan. |

**Kesimpulan gate:** TypeScript dan targeted tests hijau, tetapi coverage sekarang belum melindungi endpoint-object di atas. Jadi `tests pass` belum sama dengan `tenant isolation pass`.

---

## 1. Scope dan aturan kerja

### Yang discan

1. Route API yang menyentuh tenant, workspace, object ID, billing, data agregat, dan status “today”.
2. Koneksi data domain ke CEO/Finance/Marketing dashboard.
3. Guard tenant dan pola pembanding yang sudah benar di endpoint lain.
4. UI yang terlihat “functional” tetapi sebenarnya hanya local state atau placeholder.
5. Regression coverage yang ada untuk route-route tersebut.
6. Read-only snapshot pada production yang sudah login sebagai CEO/Owner.

### Yang sengaja tidak dilakukan

- Tidak mencoba eksploitasi lintas-tenant terhadap production.
- Tidak menambah kredit, membuat transaksi, import file, mengirim pesan, membuat campaign, mengubah status data, atau menghapus data.
- Tidak menyentuh login, auth/session, membership, Prisma/schema, infra, maupun wilayah Fatur.
- Tidak memperbaiki source dalam report ini. Report ini adalah handoff diagnosis untuk Claude.

### Skill/protokol yang dipakai

- `raphael-codex:smart-debug`: OBSERVE → HYPOTHESIZE → TEST; tidak melakukan fix sebelum root cause cukup kuat.
- `raphael-codex:ui-audit`: scan wiring, data honesty, UI state, dan acceptance criteria.
- `raphael-codex:security-sweep`: tenant boundary, IDOR, authorization, sensitive disclosure, dan fail-safe review.

---

## 2. Bukti dan hasil verifikasi

### Evidence tier

- **[SOURCE]**: perilaku terlihat langsung dari source route/component saat ini.
- **[TEST]**: hasil command test/typecheck yang dijalankan pada checkout ini.
- **[LIVE]**: read-only observation dari production/browser; tidak berarti exploit live telah dilakukan.
- **[HYPOTHESIS]**: perlu konfirmasi runtime/product policy sebelum severity final.

### Pemeriksaan teknis

| Pemeriksaan | Hasil |
|---|---:|
| `npx tsc --noEmit` | **PASS** |
| Tenant isolation + dashboard/UI helper targeted suites | **129 pass, 0 fail** |
| Scope targeted tests | **40 suites** |
| Source changes oleh Codex pada scan ini | **0** |
| Commit/push/deploy | **0** |

Targeted command:

~~~
node --experimental-test-module-mocks --import tsx --test
tests/tenant-isolation.test.ts
tests/company-dashboard-helpers.test.ts
tests/finance-dashboard-helpers.test.ts
tests/marketing-dashboard-helpers.test.ts
tests/kerja-workspace-ui-helpers.test.ts
tests/klir-schedule-view.test.ts
~~~

**Catatan penting:** suite tenant isolation saat ini meng-cover media/generate, media/transcribe, brain/notebook, dan documents/from-template. Suite tersebut belum mencakup topup, CorPlan share-context, AniVirtual understand, kerja task update, invoice aggregation, cash count, queue date scope, attendance date scope, dan health endpoint.

### Live read-only evidence

Production yang sudah login sebagai CEO/Owner dapat dibuka dan UI menampilkan:

- tombol Dashboard Perusahaan, AI Asisten Perusahaan, Pusat Otorisasi, dan Pusat Data;
- label `Pengaturan akses per divisi belum tersedia`;
- `33 kemampuan aktif`;
- pada Pusat Data sebelumnya ada 11 file, seluruhnya `belum ada data turunan tercatat`, dengan 5 kandidat `Impor ke Buku Kas`.

Observation ini mendukung BH-005 dan BH-011 sebagai product/data-wiring gap. Tidak ada aksi mutasi dilakukan untuk membuktikannya melalui exploit.

---

## 3. Temuan baru — security dan tenant isolation

## BH-001 — Top-up dapat memodifikasi saldo dari input client tanpa payment settlement

**Severity:** P0 jika route reachable di production; P1 jika benar-benar sandbox/demo-only  
**Confidence:** High — [SOURCE], belum dieksploitasi di live  
**Status:** NEW / CONFIRMED-SOURCE / NOT LIVE-EXPLOITED

### Lokasi

`src/app/api/v1/credits/topup/route.ts`

- `16–23`: hanya memanggil `getUserFromRequest(req)` untuk authentication.
- `25–34`: menerima `workspaceId` dari body request.
- `43–80`: langsung membuat atau menambah `CreditAccount` dan `CreditLedger` untuk workspace tersebut.
- `85–96`: mengembalikan `status: 'SUCCESS'`, `settledAt`, dan QRIS/VA response.

Validator:

`src/lib/validators.ts:15–19` hanya memastikan `workspaceId` berbentuk UUID serta package/payment method valid. UUID valid bukan bukti caller memiliki workspace itu.

### Root cause

Route billing menerima target workspace dari client dan langsung menambah saldo. Pada jalur tersebut tidak terlihat:

1. `withTenantGuard` atau membership/role check untuk target workspace;
2. permission billing/OWNER/ADMIN;
3. payment order yang statusnya `PENDING` sebelum settlement;
4. webhook/provider signature verification;
5. idempotency key atau pencegah replay;
6. pemisahan antara “membuat order top-up” dan “mengakui payment sukses”.

### Impact

- User authenticated dapat mencoba memasukkan workspace ID lain yang diketahui/tertebak.
- User dapat memanggil endpoint berulang untuk menambah saldo tanpa bukti settlement yang terlihat di route.
- Credit balance dan ledger menjadi sumber data yang tidak trustworthy.
- Jika credit dipakai untuk AI/media generation, masalah ini dapat berubah menjadi financial abuse dan resource abuse.

### Remediation wajib

1. Ganti target workspace dari body dengan workspace yang telah di-resolve dari authenticated tenant context, atau lakukan explicit membership/role check.
2. Pisahkan:
   - `POST /topup/order` → membuat order `PENDING`;
   - webhook/provider-confirmed handler → satu-satunya jalur yang boleh menambah balance.
3. Jangan return `SUCCESS` sebelum provider settlement terverifikasi.
4. Tambahkan idempotency berdasarkan provider transaction ID/order ID.
5. Jika ini demo-only, enforce server-side sandbox flag yang jelas dan blok route tersebut di production; jangan mengandalkan UI.
6. Audit semua credit mutation route untuk pola yang sama.

### Acceptance criteria

- Request dengan workspace milik tenant lain menghasilkan `403` atau `404` tanpa perubahan ledger.
- Request dengan payment method saja tidak menambah saldo.
- Replay webhook yang sama tidak menggandakan balance.
- Saldo hanya berubah dari settlement yang terverifikasi.
- Ada regression test unauthorized workspace, unpaid order, replay, dan successful settlement.

---

## BH-002 — `corplan/share-context` dapat membaca project ID tanpa ownership check

**Severity:** P1  
**Confidence:** High — [SOURCE], belum dieksploitasi di live  
**Status:** NEW / CONFIRMED-SOURCE / NOT LIVE-EXPLOITED

### Lokasi

`src/app/api/v1/corplan/share-context/route.ts`

- `6–7`: route dibungkus `withTenantGuard`, jadi caller punya active workspace auth.
- `12–16`: jika `corPlanProjectId` diberikan, query `corPlanProject.findUnique({ where: { id }, include: outputs })` tidak memfilter `workspaceId`.
- `25–42`: output project dipakai untuk membangun `contextSummary` response.
- `44–51`: hasilnya disimpan sebagai memory pada workspace caller.

Pola pembanding yang benar ada di:

`src/app/api/v1/corplan/sync/route.ts:14–27`, yang memeriksa `existing.workspaceId !== auth.workspace.id`.

### Root cause

Authentication/active-tenant guard ada, tetapi object-level authorization hilang. `withTenantGuard` membuktikan siapa caller dan active workspace-nya; itu tidak otomatis membuktikan `corPlanProjectId` milik workspace tersebut.

### Impact

- Caller yang memperoleh/menebak project ID dapat membaca isi project dan outputs tenant lain.
- Foreign content dapat disalin ke memory workspace caller.
- Ini adalah cross-tenant confidentiality breach walaupun route-nya sudah memakai tenant guard.

### Remediation

Query dengan compound ownership condition:

~~~
where: {
  id: corPlanProjectId,
  workspaceId: auth.workspace.id,
}
~~~

Jika model tidak punya composite unique yang cocok, load lalu explicit reject sebelum membaca `outputs` atau menyimpan memory.

### Acceptance criteria

- Project tenant A tidak dapat di-share oleh tenant B walaupun ID valid.
- Response untuk foreign ID tidak membocorkan title, output, summary, atau error detail yang membedakan object existence.
- Regression test cross-tenant read dan same-tenant success ditambahkan.

---

## BH-003 — `anivirtual/understand` mempercayai `sessionId` tanpa ownership check

**Severity:** P1  
**Confidence:** High — [SOURCE], belum dieksploitasi di live  
**Status:** NEW / CONFIRMED-SOURCE / NOT LIVE-EXPLOITED

### Lokasi

`src/app/api/v1/anivirtual/understand/route.ts`

- `8–9`: route memakai `withTenantGuard`.
- `17–31`: memories sudah di-load dengan scope yang benar.
- `111–115`: bila `sessionId` diberikan, `aniVirtualSession.findUnique({ where: { id: sessionId } })` tidak menyertakan `workspaceId` atau owner check.
- `128–137`: message ditambahkan ke session tersebut dan session dikembalikan.

Pola pembanding yang benar:

`src/app/api/v1/anivirtual/chat/stream/route.ts:53–56` memakai `findFirst` dengan `id` dan `workspaceId`.

### Root cause

Guard tenant berhenti pada request context; session object yang dipakai setelahnya tidak diverifikasi terhadap workspace caller.

### Impact

- Cross-tenant conversation dapat terbaca dari response.
- Message baru dapat ditulis ke session tenant lain.
- Memory/context AI dapat tercampur antar perusahaan.

### Remediation

Gunakan query yang selalu menyertakan tenant boundary, misalnya `id + workspaceId`, dan bila ada user-level ownership, tambahkan `userId`/participant check. Jika session tidak ditemukan dalam tenant aktif, reject atau buat session baru; jangan fallback ke object global.

### Acceptance criteria

- Foreign `sessionId` menghasilkan `404/403` tanpa append message.
- Same-tenant session tetap berjalan.
- Test membuktikan database tidak berubah pada foreign ID.

---

## BH-004 — `kerja/tasks` PUT memiliki IDOR untuk update status task

**Severity:** P1  
**Confidence:** High — [SOURCE], belum dieksploitasi di live  
**Status:** NEW / CONFIRMED-SOURCE / NOT LIVE-EXPLOITED

### Lokasi

`src/app/api/v1/kerja/tasks/route.ts`

- `76–100`: `PUT` memakai `withTenantGuard({ minRole: 'MEMBER' })`.
- `80–89`: menerima `taskId` lalu `prisma.workTask.update({ where: { id: taskId }, data: { status } })` tanpa `workspaceId`.
- `91–95`: mengembalikan task yang telah di-update.

Pola pembanding yang aman:

- `booking/queue/route.ts:98–109`
- `booking/reservations/route.ts:109–123`
- `payroll/route.ts:89–107`

Ketiganya explicit load/check terhadap workspace sebelum mutation.

### Root cause

Minimum role `MEMBER` mengatur level role, tetapi tidak mengikat object `taskId` ke workspace aktif. ID global bukan authorization.

### Impact

- Member tenant A berpotensi mengubah status task tenant B jika task ID diketahui.
- Workflow operasional dan dashboard task count dapat dirusak lintas tenant.

### Remediation

Gunakan `updateMany` dengan filter `{ id: taskId, workspaceId: auth.workspace.id }` dan cek `count`, atau load dengan compound ownership check lalu update object yang sudah diverifikasi. Validasi `status` dengan enum/schema, bukan cast langsung.

### Acceptance criteria

- Foreign task tidak bisa di-update dan menghasilkan `404/403`.
- Tidak ada perubahan status pada foreign task.
- Status invalid ditolak `400`.
- Regression test same-tenant success, foreign ID, invalid status, dan member role.

---

## 4. Temuan baru — dashboard dan data correctness

## BH-005 — Kartu/chart utama CEO masih memakai default marketing/team data

**Severity:** P1/P2 — P1 bila dashboard dipakai untuk keputusan operasional; P2 bila hanya preview  
**Confidence:** High — [SOURCE] + [LIVE]  
**Status:** NEW / CONFIRMED-SOURCE / NOT LIVE-EXPLOITED

### Lokasi

`src/app/components/CompanyDataDashboard.tsx`

- `83–105`: `DEFAULT_MKT` dan `DEFAULT_TEAM` berisi zero/default values; SLA team default `100`.
- `797–806`: source comment sendiri menyatakan Section 5/6 masih berasal dari default; summary fetch baru ditambahkan secara additive.
- `886–896`: `m` mulai dari `DEFAULT_MKT`; hanya `spend`, `leads`, dan `roas` yang dioverride dari `campaignsSummary`. `attr`, `cac`, `conv`, dan channel share tetap default/zero.
- `901–904`: `t` mulai dari `DEFAULT_TEAM`; hanya `tasks` yang dioverride dari `tasksSummary`. Staff/load/SLA/pay/division metrics tetap default.
- `911–912`: `prevM` selalu `DEFAULT_MKT`, sehingga perbandingan periode sebelumnya bukan data periode sebelumnya.
- `1035–1043`: chart membaca `m/t`, sehingga chart dapat tetap zero atau memakai ramp/synthetic data.
- `1267–1271`: satu blok memakai `hasTeamData` dan dapat menunjukkan “Belum ada data”, tetapi blok tersebut tidak menggantikan semua headline/chart primary.
- Sekitar `3344–3413` dan `3528+`: primary cards menampilkan field dari `m` dan `t`.

### Root cause

Dashboard sudah mengambil sebagian summary real, tetapi wiring berhenti pada blok tambahan. Primary cards/charts masih dibangun dari defaults yang sama untuk semua workspace/period.

Ini berbeda dari temuan Pusat Data → domain table pada handoff #4: BH-005 adalah masalah bahwa ketika record domain sudah ada pun primary CEO cards/charts masih belum seluruhnya memakai record tersebut.

### Impact

- CEO dapat melihat nol atau angka default walaupun campaign/task records tersedia.
- “Tidak ada data”, “belum diintegrasikan”, dan “nilai nol” tidak dapat dibedakan.
- Chart historis dapat memberi kesan performa yang tidak berasal dari database.
- `prevM` dapat menghasilkan delta/trend yang secara matematis terlihat valid tetapi tidak bermakna.

### Remediation

1. Tetapkan canonical aggregation contract per metric: source table, date range, timezone, filters, null behavior.
2. Wire primary cards dan charts langsung dari aggregate domain yang sama dengan Finance/Marketing.
3. Implementasikan previous-period query yang benar; jangan memakai default object sebagai pembanding.
4. Bila data belum tersedia, tampilkan state `Belum tersedia`/`Belum ada record`, bukan angka `0` atau ramp sintetis.
5. Pisahkan “summary data tersedia” dari “AI-derived/forecast data” agar tidak tercampur.

### Acceptance criteria

- Campaign/task fixture yang ditulis pada tenant aktif muncul di primary CEO cards dan chart, bukan hanya blok sekunder.
- Tenant tanpa data menampilkan empty state eksplisit, tanpa synthetic trend.
- Previous period memakai rentang waktu yang berbeda dan fixture terverifikasi.
- CEO, Finance, dan Marketing membaca definisi metric yang konsisten.

---

## BH-006 — Invoice summary hanya menghitung maksimal 50 invoice

**Severity:** P2  
**Confidence:** High — [SOURCE]  
**Status:** NEW / CONFIRMED-SOURCE

### Lokasi

`src/app/api/v1/kas/invoices/route.ts`

- `35–39`: `findMany(... take: 50)`.
- `41–56`: `totalPaid`, `totalUnpaid`, dan `totalInvoices` dihitung dari array hasil query yang sudah dibatasi 50.

### Impact

Workspace dengan lebih dari 50 invoice akan mendapat total yang undercount tanpa warning. `totalInvoices` bermakna “jumlah row yang dikembalikan”, bukan jumlah invoice tenant.

### Remediation

Pisahkan query list/pagination dari aggregate:

- `count()`/`aggregate()` atas full tenant-filtered set;
- `findMany(take/skip)` hanya untuk tabel/list;
- response menyebutkan `total`, `page`, `pageSize`, dan `items` secara terpisah.

### Acceptance criteria

- 51+ invoice menghasilkan `totalInvoices: 51` walaupun list page tetap 50.
- Nilai paid/unpaid tidak berubah ketika page size berubah.
- Semua aggregate tetap tenant-scoped.

---

## BH-007 — Cash `transactionCount` adalah page count, bukan period total

**Severity:** P2  
**Confidence:** High — [SOURCE]  
**Status:** NEW / CONFIRMED-SOURCE

### Lokasi

`src/app/api/v1/kas/transactions/route.ts`

- `46–80`: `limit` dibatasi sampai 500 dan dipakai sebagai `take`.
- `83–94`: aggregate sudah mulai dihitung, tetapi tidak menyediakan total count penuh.
- `179–185`: response mengisi `transactionCount: periodTransactions.length`.

### Root cause dan impact

`transactionCount` berubah ketika pagination/limit berubah. Di atas 500 transaksi periode, count akan capped. Dashboard Finance/CEO bisa menampilkan jumlah aktivitas yang terlihat di page, bukan jumlah transaksi periode.

### Remediation

Gunakan `count()` dengan filter period/type/category yang sama untuk summary, dan expose `items.length` sebagai page count terpisah. Pastikan aggregate dan count memakai semua filter yang memang dijanjikan oleh API.

### Acceptance criteria

- 501 transaction tetap memberi period total 501.
- Mengubah `limit` tidak mengubah summary count.
- `pageItemCount` dan `periodTransactionCount` memiliki nama berbeda dan diuji.

---

## BH-008 — Queue “today” sebenarnya all-time

**Severity:** P2  
**Confidence:** High — [SOURCE]  
**Status:** NEW / CONFIRMED-SOURCE

### Lokasi

`src/app/api/v1/booking/queue/route.ts`

- GET `12–20`: query hanya `{ workspaceId }`, tetapi response dinamai `totalTicketsToday`.
- POST `52–57`: `todayCount` juga count seluruh workspace tanpa range tanggal.
- Nomor queue berikutnya dihitung dari ticket historis, bukan hari bisnis aktif.

### Impact

- Counter hari ini tercampur dengan hari-hari sebelumnya.
- Nomor queue hari baru melanjutkan nomor lama.
- Waiting/completed summary tidak merepresentasikan hari yang sedang berjalan.
- Concurrent POST juga berpotensi duplicate number bila sequence tidak atomic.

### Remediation

Tentukan start/end hari bisnis dengan timezone WIB secara konsisten, gunakan filter `createdAt` pada GET dan POST, serta pertimbangkan atomic sequence/transaction untuk nomor queue.

### Acceptance criteria

- Fixture kemarin tidak memengaruhi count atau nomor queue hari ini.
- Boundary midnight/WIB diuji.
- Dua POST concurrent tidak menghasilkan nomor yang sama.

---

## BH-009 — Attendance “today” mengambil data all-time dan hanya 30 row

**Severity:** P2  
**Confidence:** High — [SOURCE]  
**Status:** NEW / CONFIRMED-SOURCE

### Lokasi

`src/app/api/v1/kerja/attendance/route.ts`

- `6–16`: comment/GET menyebut “today”, tetapi query hanya `{ workspaceId }` dan `take: 30`.
- `18–29`: summary dihitung dari 30 record hasil query tersebut.

### Impact

- Attendance historis mencemari counter hari ini.
- Jika record hari ini lebih dari 30, summary undercount.
- Punctuality/default dapat misleading karena sample bukan seluruh hari aktif.

### Remediation

Filter full day WIB untuk aggregate; query list boleh paginated secara terpisah. Jangan menghitung summary dari page list.

### Acceptance criteria

- Record kemarin tidak muncul dalam summary hari ini.
- 31+ attendance hari ini tetap dihitung penuh.
- List pagination tidak mengubah summary.

---

## 5. Temuan baru — disclosure dan product safety

## BH-010 — Public health endpoint membocorkan informasi internal

**Severity:** P2  
**Confidence:** High — [SOURCE]; intentional-public policy belum dikonfirmasi  
**Status:** NEW / CONFIRMED-SOURCE / POLICY-REVIEW NEEDED

### Lokasi

`src/app/api/v1/system/health/route.ts`

- `5–18`: tidak ada auth/tenant guard; query `workspace.count()`.
- Saat error, status database mengembalikan raw error message.
- `23–34`: response mengembalikan `environment`, version, provider, dan active workspace count.
- `64–66`: endpoint dapat diakses publik dengan 200/503.

### Impact

Unauthenticated caller dapat melakukan reconnaissance terhadap:

- environment/runtime;
- provider dan versi aplikasi;
- jumlah workspace aktif;
- detail error database/internal provider.

Health endpoint publik bisa valid untuk liveness, tetapi detail diagnostik tidak seharusnya ikut keluar.

### Remediation

- Buat public `/healthz` minimal: generic `ok`, timestamp/request ID, tanpa tenant count dan raw error.
- Pindahkan detail ke authenticated/internal readiness endpoint.
- Log raw error server-side dengan correlation ID; response client selalu generic.
- Bila endpoint memang wajib publik untuk monitoring, dokumentasikan alasan dan fields yang diizinkan.

### Acceptance criteria

- Public response tidak mengandung raw DB message, workspace count, provider, atau environment detail.
- Monitoring tetap dapat membedakan healthy/unhealthy.
- Internal diagnostic hanya bisa diakses role/service yang disetujui.

---

## BH-011 — Access admin UI hanya local React state, bukan permission enforcement

**Severity:** P1/P2 product safety gap  
**Confidence:** High — [SOURCE] + [LIVE]  
**Status:** NEW / CONFIRMED-SOURCE / NOT AN AUTH-LANE FIX

### Lokasi

`src/app/components/FinanceAIAssistantView.tsx`

- `532–540`: `accessMode`/`adminOverrides` didefinisikan sebagai React state; comment menyebut client-side saja dan belum terhubung backend granular access.
- Sekitar `2383–2390`: comment menjelaskan modal sebelumnya terlihat fully functional padahal efeknya 0%.
- `3793+`: toggle hanya memodifikasi `adminOverrides` lokal.

### Live evidence

Pada CEO/Owner production snapshot, UI menampilkan `Pengaturan akses per divisi belum tersedia`. Ini konsisten dengan source bahwa feature belum menjadi backend-enforced RBAC.

### Impact

- Admin dapat mengira akses Finance/Marketing sudah dimatikan.
- Refresh, browser lain, atau portal divisi lain tidak mengikuti toggle.
- Ini bukan wilayah login Fatur, tetapi bisa menjadi false sense of control pada product layer.

### Remediation options

**Opsi aman sementara:**

- ubah copy menjadi `Preview — belum tersimpan ke backend`;
- disable/hide toggle yang belum punya effect;
- jangan mengklaim granular authorization sudah tersedia.

**Opsi implementasi penuh, hanya setelah kontrak produk disetujui:**

- server-persisted permission matrix;
- route permission check pada setiap feature endpoint;
- cache invalidation/session behavior yang jelas;
- audit log perubahan permission;
- test UI bukan pengganti server authorization.

Jangan mengubah auth/login/membership/schema tanpa koordinasi wilayah Fatur.

### Acceptance criteria

- UI state dan backend state punya sumber kebenaran yang sama; atau UI secara eksplisit diberi label preview.
- Endpoint sensitif menolak akses walaupun client mengubah local state.
- Refresh dan browser kedua tidak mengembalikan state palsu.

---

## 6. Risiko tambahan yang perlu dicatat, tetapi bukan blocker utama

### BH-012 — AI chat/preferences tersimpan di localStorage

`FinanceAIAssistantView.tsx` sekitar `606–645` menyimpan chat history per workspace di localStorage. Sekitar `677–693` beberapa navigation/plugin preference memakai key browser-global, tidak workspace-scoped. Ini dapat menyebabkan kehilangan history saat ganti device/browser dan preference terbawa ke context yang salah.

**Status:** P2/P3 product limitation, bukan bukti cross-tenant server leak. Pastikan ini memang keputusan privacy/offline UX. Jangan menaikkan severity sebelum requirement persistence server ditetapkan.

### Marketing reports belum diimplementasikan

`MarketingModuleView.tsx` sekitar line `509` memiliki `const reports: any[] = []`, tetapi UI di sekitar `1436–1440` secara jujur menampilkan `Segera hadir`. Ini tetap backlog/incomplete feature, bukan deceptive fake-data bug. Jangan memperlakukan placeholder yang sudah diberi label sebagai data corruption.

---

## 7. Carry-over dari handoff sebelumnya — jangan dihitung sebagai bug baru

Temuan berikut sudah ada di handoff Claude/Codex sebelumnya. Tetap perlu ditutup, tetapi jangan dianggap hasil scan baru atau diperbaiki dengan cara yang merusak kerja sebelumnya.

### Carry-over A — Pusat Data → domain table → dashboard

Handoff:

`2026-09-10-codex-to-claude-handoff-4-data-integration.md`

Pusat Data menyimpan `WorkspaceFile` dan AI knowledge, sedangkan dashboard membaca tabel domain seperti campaign, task, cash, invoice, attendance, dan lain-lain. Upload file belum otomatis menghasilkan record domain. Karena itu 11 file dapat berstatus `belum ada data turunan tercatat` dan dashboard tetap zero-state.

**Jangan menghapus handoff ini.** BH-005 adalah temuan berbeda: ketika record domain sudah ada, primary CEO cards/charts masih belum seluruhnya memakai record tersebut.

### Carry-over B — Finance header mouse navigation

Handoff sebelumnya masih meminta pengecekan navigasi header Finance. Itu tetap open sampai ada live read-only proof pada clean session. Jangan menyatakan fixed hanya karena route atau DOM terlihat benar.

### Carry-over C — role matrix, target persistence, E2E coverage

Handoff Claude sebelumnya masih memiliki open item role matrix, target persistence, dan E2E coverage. BH-011 menambah bukti bahwa access UI belum backend-enforced; ini memperkuat kebutuhan role-matrix follow-up, tetapi bukan izin untuk masuk ke login lane Fatur.

### Carry-over D — mobile 375px/static UI candidates

Static candidates dari handoff live-smoke tetap perlu QA visual bila Claude melanjutkan UI audit. Tidak ada perubahan CSS dilakukan dalam scan ini.

---

## 8. False-positive guardrails

Supaya perbaikan tidak overfit atau merusak fitur yang sudah dikerjakan:

1. `withTenantGuard` bukan bukti otomatis bahwa semua child object aman. Audit harus dilanjutkan sampai `where`/mutation juga mengikat workspace.
2. `MarketingModuleView` reports empty array tidak dihitung sebagai fake data karena UI menandainya sebagai `Segera hadir`.
3. `system/health` mungkin sengaja publik; severity BH-010 perlu policy decision, tetapi raw DB error tetap tidak layak dipublish.
4. localStorage AI history bisa menjadi desain privacy/offline; jangan migrasi ke database tanpa keputusan persistence dan retention.
5. Jangan mengganti semua angka `0` secara global. Bedakan zero yang benar-benar tercatat dari no-record dan not-integrated.
6. Jangan memperbaiki BH-001 dengan sekadar menyembunyikan tombol top-up. Server route tetap harus aman bila dipanggil langsung.
7. Jangan memperbaiki BH-011 dengan menambahkan check client-side. Permission enforcement harus terjadi di server endpoint.

---

## 9. Urutan remediasi yang direkomendasikan

~~~
P0/P1 security freeze
    │
    ├─ 1. BH-001: stop direct credit minting / payment bypass
    ├─ 2. BH-002: CorPlan object ownership
    ├─ 3. BH-003: AniVirtual session ownership
    └─ 4. BH-004: WorkTask mutation ownership
          │
          ▼
Data correctness
    ├─ 5. BH-006: invoice full aggregate
    ├─ 6. BH-007: cash period count
    ├─ 7. BH-008: queue WIB day scope + atomic sequence
    └─ 8. BH-009: attendance WIB day scope
          │
          ▼
Dashboard truthfulness
    └─ 9. BH-005: wire primary CEO cards/charts to canonical aggregates
          │
          ▼
Product safety + disclosure
    ├─ 10. BH-010: minimal public health response
    └─ 11. BH-011: label preview or implement approved backend permission contract
          │
          ▼
Verification
    ├─ route-level tenant regression suite
    ├─ aggregate/date-boundary fixture suite
    ├─ typecheck + full test/build
    ├─ read-only live smoke per CEO/Finance/Marketing
    └─ new handoff with every BH ID mapped to evidence
~~~

### Detail gate per fix

Untuk setiap BH ID, Claude sebaiknya mengisi:

| Field | Wajib diisi |
|---|---|
| Root cause | File, line, dan query/mutation yang salah |
| Changed files | Hanya file yang diperlukan; auth/Fatur lane dipisahkan |
| Regression test | Same-tenant success + foreign/edge case |
| Data invariant | Apa yang tidak boleh berubah ketika request ditolak |
| Browser evidence | Hanya read-only, tanpa production mutation |
| Rollback | Commit/file scope yang bisa direvert secara terisolasi |
| Status | `FIXED`, `PARTIAL`, atau `BLOCKED`; bukan “done” bila masih ada ❌ |

---

## 10. Handoff eksplisit untuk Claude

1. Mulai dari BH-001 sampai BH-004 sebagai security gate. Jangan mulai dari kosmetik dashboard.
2. Tambahkan regression tests sebelum atau bersamaan dengan patch, bukan setelah klaim selesai.
3. Audit endpoint-object lain dengan pola yang sama: route sudah `withTenantGuard` tetapi `findUnique/update/delete` hanya memakai `id`.
4. Pertahankan seluruh pekerjaan Fatur di login/auth/session/membership/Prisma/schema/infra. Jika patch membutuhkan perubahan di area itu, stop dan buat handoff terpisah untuk Fatur.
5. Pertahankan handoff Pusat Data→dashboard dan QA fixtures `QA-CODEX-*`; jangan menghapus evidence hanya karena test lokal hijau.
6. Jangan commit, push, atau deploy tanpa instruksi eksplisit Mecca.
7. Setelah patch, buat rescan report yang memetakan setiap ID:

~~~
BH-001  fixed/partial/blocked | file(s) | test(s) | live evidence
BH-002  fixed/partial/blocked | file(s) | test(s) | live evidence
...
BH-011  fixed/partial/blocked | file(s) | test(s) | live evidence
~~~

8. Klaim `done` hanya boleh dibuat jika security, data correctness, dashboard wiring, dan regression gate tidak menyisakan item ❌.

---

## 11. Kesimpulan

Checkout saat ini tidak gagal di TypeScript atau targeted helper tests. Masalah utamanya adalah **coverage dan boundary correctness**: beberapa endpoint terlihat memakai tenant guard, tetapi object yang dibaca/diubah belum selalu diikat ke tenant; beberapa dashboard sudah fetch summary, tetapi primary UI masih membaca default; beberapa “today/total” dihitung dari page atau seluruh history.

Prioritas Claude adalah membuat sistem benar-benar aman dan data-driven di server, lalu membuktikannya dengan regression tests dan read-only browser QA. Report ini tidak mengubah source code dan tidak mengklaim exploit production telah dilakukan.

