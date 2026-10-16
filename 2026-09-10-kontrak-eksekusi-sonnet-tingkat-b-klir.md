# KONTRAK EKSEKUSI -- Tingkat B KLIR, untuk Claude Code Sonnet 5 (ditulis Fable 5.1, 10 Sep 2026)

Ini kelanjutan langsung dari 2026-09-10-fable-roadmap-master-klir.md (peta induk). Peta induk
bilang APA dan KENAPA; dokumen ini bilang URUTAN, LANGKAH, GATE, dan LARANGAN sampai level
perintah persis, supaya Sonnet bisa jalan tanpa nebak dan tanpa nanya hal yang sudah dijawab.
Mecca sudah menjawab semua keputusan Tingkat B pada 10 Sep siang (verbatim ada di ELIPS
Claude-Code-Memory/daily/2026-09-10-klir-fable-roadmap-matang-inventory-fase0-2-menyala-ELIPS.md
bagian akhir dan di seksi <context> di bawah). Jangan tanya ulang.

<role>
Kamu Claude Code Sonnet 5, komando untuk project KLIR (business-OS SaaS UMKM, repo Next.js 16 +
Prisma/Neon). Disposisi: execute-first untuk semua yang sudah dijawab di <context>;
finish-before-report per fase (lapor sekali per fase dengan tier bukti, jangan lapor setengah
jalan); no-solo untuk fase berat (F3, F4 wajib lewat Workflow komando-tuntas-gate dengan agent
Sonnet); no-push dan no-deploy sampai F6 lolos gate dan Mecca dikasih 1 baris konfirmasi di
momen itu. Kamu ikut 7 kebiasaan di KB-METODE-KOMANDO-FABLE-KLIR-8SEP.md: akar dari bukti,
tier bukti tiap klaim, satu workflow satu putaran, jangan nanya yang bisa diputuskan, tidak
merusak kerja Fatur, jujur yang belum, tulis untuk sesi berikutnya. Setiap koreksi Mecca =
pengingat, bukan frustrasi.
</role>

<objective>
Menyelesaikan seluruh Tingkat B dalam SATU batch: SKU duplikat jadi validasi nyata, peringatan
stok otomatis dengan wadah reusable, fitur stok lanjutan yang bisa dibangun sekarang plus riset
kebutuhan lanjutan, pematangan dashboard + AI Assistant untuk CEO/Finance/Marketing lintas 7
modul, dokumen untuk Fatur, integrasi origin/main mengikuti cleanup Fatur tanpa kehilangan
arsip, lalu push GitHub dan deploy VPS satu kali dengan bukti aman -- semua dengan tsc 0, suite
0 fail, dan alur inti diklik di localhost login asli sebelum push.
</objective>

<context>
BACA DULU, urutan ini, sebelum baris kode pertama (semua path Windows, repo =
C:\Users\mausx\OneDrive\Nime\OneDrive\Documents\Claude Code Asistent\KLIR\02-KLIR-PUBLIC-PRIVATE\2026-09-01-github-push-workspace\klir-repo-clone):
1) AGENTS.md repo, lalu KLIR\00-PETA-STRUKTUR-PROJECT.md (aturan lintas-AI, Iron Rule).
2) 2026-09-10-fable-roadmap-master-klir.md (peta induk, Bagian 1, 3, 4, 5 wajib hafal).
3) 2026-09-10-status-matrix-semua-roadmap-vs-kode.md (status tiap item vs kode).
4) 2026-09-10-usulan-matriks-role-feature-7-modul.md (inventaris fitur nyata per portal).
5) 2026-09-10-panduan-tes-untuk-gpt-luna-terra-dan-mecca.md (alur yang sudah [LOKAL]).
6) 2026-09-10-untuk-fatur-stok-pembelian-dan-page-tsx.md (apa yang sudah ditambah).
7) Claude-Code-Memory\knowledge-base\KB-METODE-KOMANDO-FABLE-KLIR-8SEP.md.
8) Claude-Code-Memory\daily\2026-09-10-klir-fable-sesi-STATE-LANJUTAN.md (checkpoint).
9) .claude\skills\release-protocol\SKILL.md (push/deploy) -- PROTOKOL-PUSH-DEPLOY-KLIR.md di
   root repo isinya sama untuk manusia.

KONDISI TERVERIFIKASI 10 Sep dini hari (Fable, tier [LOKAL]):
- git main HEAD f9c5239. Worktree DIRTY: 29 file modified (port manual Codex dari 2 commit
  Fatur de2d83d + 3d2249e, plus kerja 9 Sep) + file baru sesi Fable (2 route inventory,
  KlirInventoryView.tsx, inventory-intelligence-engine.ts, 4 test, 6 dokumen 2026-09-10-*).
  origin/main ahead 36 behind 4. BELUM ADA commit dan push dari sesi Fable.
- tsc --noEmit exit 0. Suite 1219/1219 pass. Dev server jalan di localhost:3000.
- Chrome Mecca sudah login localhost:3000. Pindah portal tanpa password: di console
  localStorage.setItem('klir_active_portal','CEO'|'FINANCE'|'MARKETING') lalu location.reload().
  Sub-tab: klir_ceo_nav / klir_finance_nav / klir_marketing_nav.
- Laptop Mecca devicePixelRatio 0.667, viewport 2520x1393. Klik koordinat screenshot ter-scale
  MELESET. Klik lewat ref (find) atau getBoundingClientRect. Ini akar "P0 Codex" yang ternyata
  bukan bug.
- Stok & Pembelian: CEO dan Finance alur penuh PASS di browser, 4 tab zero-state jujur, chat
  "stok mana yang harus restock" jawab jujur tanpa LLM (200, 1.1 s).
- Endpoint products POST: SKU duplikat baru ditangani lewat catch Prisma P2002 -> status 400
  (src/app/api/v1/inventory/products/route.ts baris 156-160). Belum ada pre-check, belum ada
  pesan inline di form (KlirInventoryView.tsx submitProduct baris ~460-500 cuma throw
  data.message ke catch generik).
- Mekanisme "kartu perhatian" yang sudah ada: GET /api/v1/brain/alerts (AlertPriorityEngine,
  src/app/api/v1/brain/alerts/route.ts) dipakai dashboard; Finance AI punya checkArPending()
  (FinanceAIAssistantView.tsx baris 709-723) yang membaca localStorage klir_live_company_state
  dan mendengarkan event klir-ai-state-updated. Belum ada panel proaktif generik di AI view.
- Endpoint inventory yang ADA: consignment (GET/PATCH), photo-to-stock (POST/PUT),
  purchase-orders (GET/POST, auto CashTransaction EXPENSE + StockMovement PURCHASE_IN),
  returns (GET/POST), supplier-score (GET/POST), products (GET/POST), stock-movements (GET).
  Yang TIDAK ADA: endpoint penyesuaian stok manual (ADJUSTMENT_IN/OUT), endpoint penjualan
  keluar manual (SALE_OUT + kas masuk), laporan settlement konsinyasi. UI form untuk PO/retur
  juga belum ada (Fase 0 baru menampilkan).
- Riset inventory yang SUDAH ada (Rule #57, baca dulu sebelum riset baru):
  ~/.claude/projects/<slug>/memory/project_klir_competitor_research_ramoo_santaiscale_medi_3sep.md,
  project_klir_inventory_umkm_rancangan_tim_online_9sep.md (ada di Claude-Code-Memory),
  project_klir_meet_fundamental_umkm_stok_kasir_3sep.md, project_klir_segmen_distributor_baru_8sep.md,
  plus riset 3 WebSearch 9 Sep (dikutip di 2026-09-10-roadmap-inventory-ai-distributor.md).
- Cleanup Fatur di origin/main: ea619b1 menghapus 12 dokumen bertanggal di root + 1 di docs/
  (rename KONVENSI ke docs/KONVENSI_NGODING_KLIR.md); 6f1aaf3 menghapus 96 file docs/PRD*/ dan
  docs/prd_source/ (+ M docs/README.md). Preview merge-tree (terhadap HEAD, sebelum commit
  batch dirty): konflik di MarketingModuleView.tsx, alert-priority-engine.ts,
  context-engine.ts, why-engine.ts, dan modify/delete 2026-09-07-untuk-fatur-sesi-lanjutan-
  perubahan-baru.md. Setelah batch dirty di-commit, daftar konflik bisa berubah -- preview ulang.
- Script package.json "deploy:vps" memakai git checkout package-lock + npm install. JANGAN
  dipakai. Deploy manual sesuai release-protocol (npm ci, pull --ff-only).
- Kunci SSH deploy: C:\Users\mausx\.ssh\id_ed25519 (ada). Remote:
  https://github.com/AniTech-Corp/KLIR.git, branch main (+ mirror claude/ai-brain-upgrade-1sep).

KEPUTUSAN MECCA 10 SEP SIANG (final, jangan tanya ulang):
- Tambah produk sungguhan ke Neon: DITUNDA, dites bareng Codex nanti. Kamu tidak menulis data
  produk sungguhan; pakai fake Prisma + smoke read-only.
- SKU duplikat: jadikan validasi NYATA yang terintegrasi (bukan cuma catch), plus pesan jelas di
  form.
- Tampilan HP/tablet: DITUNDA. Desktop dulu sampai matang.
- "Aneh di bawah dashboard CEO": DITUTUP, hasil audit bersih.
- Peringatan stok otomatis: BANGUN, dan bikin WADAH yang bisa dipakai ulang untuk fitur
  sejenis (ini jadi pola standar Mecca).
- Login/auth/session/schema: tetap lane Fatur. Tidak disentuh.
- Fitur berikutnya: matangkan Dashboard + AI Assistant untuk CEO, Finance, Marketing lintas 7
  modul (corplan, personal, finance, advertising, workspace, schedule, inventory).
- Usulan matriks role->feature: DILEMPAR KE FATUR (masuk dokumen untuk Fatur), bukan diputuskan
  Mecca, bukan diimplementasi ke RBAC sekarang.
- Push GitHub: BOLEH. Deploy VPS: BOLEH. Keduanya HANYA setelah semua fase selesai, aman, dan
  kamu kasih 1 baris konfirmasi di momen push (hook push-final-gate mencatat izin 3 jam; kalau
  lewat, minta ulang 1 baris).
- Database: dipegang Mecca + Fatur. Prinsip: jangan rusak yang Fatur buat, sempurnakan saja.
  Wajib ada dokumen (MD; Word opsional) untuk Fatur berisi apa saja yang dikerjakan.
- Fitur stok lanjutan: BANGUN SEKARANG yang bisa dengan data yang ada; riset kebutuhan tambahan
  (kalau ada masukan dari proposal Distributor ~15 Sep, ditambah belakangan).
- 2 commit cleanup Fatur: IKUT FATUR (merge), boleh disempurnakan, TIDAK merusak. Arsip dulu
  apa yang dia hapus supaya sejarah tidak hilang di luar repo.
</context>

<workflow>
Loop universal tiap fase: diagnosa (baca kode/log) -> rencana 3-5 baris -> eksekusi -> evaluasi
(tsc + test + smoke) -> ulang kalau gagal (maks 3x per masalah, lalu lapor). Fase berurutan
F0 -> F1 -> F2 -> F3 -> F4 -> F5 -> F6 -> F7 -> F8. F1-F2 boleh solo (kecil). F3 dan F4 WAJIB
Workflow komando-tuntas-gate. Setelah tiap fase: tulis checkpoint ke state-file (F8 poin 1).

F0 PERSIAPAN
  APA: pastikan posisi awal sama dengan yang tertulis di <context>.
  DI MANA: repo root; Claude-Code-Memory\daily\.
  NYALAKAN: skill boot (memori + rules), skill council mode SPEED sekali (3 persona, sanity
  check urutan F1-F7) -- ini juga membuka gate council untuk >= 5 edit kode produk.
  LANGKAH: (1) git status --short | wc -l, git rev-parse --short HEAD (harus f9c5239),
  git fetch origin lalu git rev-list --left-right --count main...origin/main (harus 36 4;
  kalau Fatur push lagi, catat hash barunya dan baca diff-nya dulu). (2) node
  node_modules\typescript\bin\tsc --noEmit -p tsconfig.json -> exit 0. (3) node
  --experimental-test-module-mocks --import tsx --test "tests/**/*.test.ts" -> 0 fail
  (1219 pass). (4) cek dev server: netstat -ano | findstr :3000. Kalau mati: jalankan
  lewat tool preview (launch.json), bukan Bash. (5) tulis state-file baru
  Claude-Code-Memory\daily\2026-09-XX-klir-sonnet-tingkat-b-STATE.md berisi posisi awal.
  AGAR: tidak mewarisi drift diam-diam; state-file jadi brankas kalau context compact.
  HASIL: angka baseline tercatat di state-file.
  DONE: 4 angka (status count, HEAD, ahead/behind, tsc/test) cocok atau selisihnya dijelaskan.

F1 SKU DUPLIKAT JADI VALIDASI NYATA (kecil, solo)
  APA: pre-check SKU per workspace sebelum create, kode status 409, pesan inline di form.
  DI MANA: src\app\api\v1\inventory\products\route.ts (POST, baris ~95-165);
  src\app\components\KlirInventoryView.tsx (submitProduct + tampilan error form);
  tests\inventory-products-route.test.ts; tests\klir-inventory-view.test.ts.
  NYALAKAN: skill coding-engine; smart-debug mode TDD (test merah dulu, baru hijau).
  LANGKAH: (1) tulis test baru: POST dengan sku yang sudah ada di workspace yang sama ->
  409 dengan message mengandung "SKU"; sku sama di workspace BEDA -> 201 (isolasi tenant);
  sku beda huruf besar-kecil ("ABC" vs "abc") -> putuskan sendiri dan catat: samakan
  dengan cara Postgres unique bekerja (case-sensitive) tapi tampilkan peringatan lunak?
  Pilih yang paling sederhana: case-sensitive persis seperti constraint, tanpa magic.
  (2) di route: sebelum $transaction, kalau sku ada -> prisma.product.findFirst({ where:
  { workspaceId, sku }, select: { id: true, name: true } }); kalau ketemu -> return 409
  { message: 'SKU "<sku>" sudah dipakai produk "<name>" di workspace ini.', conflictProductId }.
  Ubah catch P2002 dari 400 jadi 409 dengan pesan sama (tetap ada, untuk race). (3) di
  KlirInventoryView: kalau res.status === 409 -> set error khusus di bawah field SKU
  (state prodSkuError), fokuskan input SKU, jangan reset form. Tambahkan helper murni
  export mapProductSubmitError(status, message) -> { field: 'sku'|'form', text } dan test-nya.
  (4) tsc + test file terkait + suite penuh. (5) smoke read-only di browser: buka form, isi
  nama + SKU kosong -> tidak ada error SKU; JANGAN submit produk sungguhan.
  AGAR: user dapat pesan yang jelas di tempat yang salah, bukan alert generik; 409 = semantik
  konflik yang benar untuk klien lain (Codex/Luna) yang nanti tes.
  HASIL: 2 file kode + 2 file test berubah; tidak ada file lain.
  DONE: test baru hijau, suite penuh 0 fail, tsc 0, git diff --numstat hanya 4 file itu.

F2 PERINGATAN STOK OTOMATIS + WADAH REUSABLE (kecil-menengah, solo)
  APA: panel "Perlu perhatian" yang muncul sendiri di atas area chat AI Assistant CEO dan
  Finance, berisi kartu dari sumber-sumber terdaftar; sumber pertama = stok di bawah minimum
  dan produk tanpa histori; sumber kedua = alerts yang sudah ada dari /api/v1/brain/alerts.
  DI MANA: file BARU src\lib\ai-brain\proactive-alerts.ts (pure), file BARU
  src\app\components\chat\ProactiveAlertsPanel.tsx, mount 1 baris di
  ExecutiveAIAssistantView.tsx dan FinanceAIAssistantView.tsx (di atas daftar pesan chat,
  cari lokasi render welcome message pertama), tests\proactive-alerts.test.ts.
  NYALAKAN: coding-engine; ikuti Pola E Fatur (state localStorage ter-namespace per role +
  workspaceId) untuk "tutup kartu ini"; ikuti gaya kartu CompanyDataDashboard 1472-1522.
  LANGKAH: (1) proactive-alerts.ts: type ProactiveAlert { id, sourceKey, severity
  'kritis'|'waspada'|'info', title, body, cta?: { label, action: 'open-inventory'|'ask-ai'|
  'open-dashboard', prompt?: string } }; registry PROACTIVE_SOURCES: Array<{ key, label,
  fetch: (ctx) => Promise<ProactiveAlert[]> }> -- sumber "stok": GET
  /api/v1/inventory/products?limit=1 -> summary.lowStock (maks 5 kartu, sisanya 1 kartu
  ringkas "N produk lain di bawah minimum"), plus 1 kartu "belum ada produk" HANYA kalau
  productCount 0 dan role CEO (Finance jangan dibanjiri); sumber "brain": GET
  /api/v1/brain/alerts -> severity CRITICAL/WARNING saja. Fungsi murni mergeAndRank(alerts,
  dismissedIds, now) -> urut kritis > waspada > info, buang yang di-dismiss < 24 jam.
  (2) ProactiveAlertsPanel.tsx props { role: 'CEO'|'FINANCE'|'MARKETING', workspaceId,
  onOpenInventory?, onAskAI?(prompt) }: fetch semua sumber paralel dengan Promise.allSettled
  (satu sumber gagal tidak merobohkan panel), refresh saat event 'klir-inventory-updated' dan
  'klir-ai-state-updated', tombol tutup per kartu (dismiss ke localStorage key
  klir_proactive_dismissed_<role>_<workspaceId>), TIDAK render apa pun kalau 0 kartu (tanpa
  kotak kosong). Kartu "kritis" pakai aksen merah lembut, "waspada" amber, borderless gaya
  Fatur. CTA "Buka stok & pembelian" -> onOpenInventory; CTA "Tanya AI" -> onAskAI(prompt)
  yang mengisi composer dengan prompt siap kirim (jangan auto-kirim).
  (3) mount: Executive dan Finance AI: <ProactiveAlertsPanel role=... workspaceId=...
  onOpenInventory={onOpenInventory} onAskAI={(p) => setInputMessage(p)} /> -- 1 baris +
  1 import per file, jangan ubah yang lain. (4) test murni: mergeAndRank urutan, dismiss
  24 jam, cap 5 kartu, role gating kartu "belum ada produk". (5) tsc + suite. (6) smoke
  browser CEO dan Finance: dengan 0 produk, CEO lihat 1 kartu "Belum ada produk tercatat"
  dengan CTA; Finance tidak lihat kartu stok; tutup kartu -> hilang -> reload -> tetap hilang
  (24 jam). Console 0 error.
  AGAR: ini "wadah" yang Mecca minta -- sumber baru ke depan cuma nambah 1 entry di registry,
  bukan bikin panel baru; AI Assistant jadi proaktif tanpa ditanya, sesuai standar AI KLIR.
  HASIL: 1 lib + 1 komponen + 1 test baru, 2 file AI view berubah masing-masing <= 5 baris.
  DONE: smoke 2 portal lolos, suite 0 fail, tsc 0, git diff --numstat sesuai daftar file.

F3 FITUR STOK LANJUTAN + RISET KEBUTUHAN (berat, WAJIB Workflow)
  APA: bangun yang bisa dengan data yang ada sekarang, dan riset apa yang masih kurang.
  DI MANA: lihat kontrak per agent di bawah. Semua additive, nol perubahan schema.prisma.
  NYALAKAN: Workflow scriptPath C:\Users\mausx\OneDrive\Nime\OneDrive\Documents\Claude Code
  Asistent\.claude\workflows\komando-tuntas-gate.js (args.tasks di bawah, agentModel
  'sonnet'), skill research-engine untuk agent riset, skill smart-dispatch doktrin 1 putaran.
  Context pack 5 seksi WAJIB (salin fakta dari <context> ini, tambah file:line yang kamu
  cek sendiri sebelum dispatch). Otorisasi aksi berisiko: TIDAK ADA untuk agent manapun
  (tulis eksplisit di seksi TUGAS tiap agent).
  LANGKAH (tasks Bangun paralel, file DISJOINT):
  (a) api-stock-ops: file BARU src\app\api\v1\inventory\stock-adjustments\route.ts (POST:
      productId, qtyChange +/-, reason wajib; tulis StockMovement ADJUSTMENT_IN/OUT +
      update Product.currentStock dalam 1 $transaction; tolak kalau hasil stok < 0) dan
      src\app\api\v1\inventory\sales\route.ts (POST: items[{productId, qty, unitPrice}],
      paymentMethod; tulis StockMovement SALE_OUT per item (qtyChange negatif), kurangi
      currentStock, tolak kalau stok kurang, buat CashTransaction INCOME total -- tiru
      persis pola purchase-orders/route.ts baris 82-198 untuk $transaction dan kas; sertakan
      soft-link seperti PurchaseOrder.cashTransactionId lewat StockMovement.sourceType 'sale'
      + sourceId = CashTransaction.id). Test fake-Prisma pola tests/purchase-orders.test.ts,
      minimal 10 test (isolasi tenant, stok tidak boleh negatif, kas INCOME benar).
      GET /api/v1/inventory/consignment/report (file BARU
      src\app\api\v1\inventory\consignment\report\route.ts): per produk CONSIGNED ->
      qty masuk, qty terjual (SALE_OUT), qty retur, nilai yang harus disetor ke supplier
      (terjual x costPrice), periode dari query ?from&to. Pure helper di
      consignment-engine.ts boleh ditambah fungsi baru, jangan ubah yang ada.
  (b) ui-stock-ops: KlirInventoryView.tsx tambah 3 form kecil di tab yang relevan: "Catat
      pembelian" (POST purchase-orders, pilih produk dari daftar, qty, harga beli, supplier),
      "Catat penjualan" (POST sales), "Penyesuaian stok" (POST stock-adjustments, alasan
      wajib), dan tab baru "Konsinyasi" (GET consignment/report + tombol toggle status yang
      sudah ada PATCH consignment). Setiap sukses -> refresh + dispatch 'klir-inventory-updated'
      + 'klir-kas-updated' (supaya Finance dashboard ikut refresh). Helper murni + test.
      Agent ini TIDAK menyentuh route (kontrak respons ditulis di context pack oleh komando).
  (c) engine-stock-advanced: inventory-intelligence-engine.ts tambah buildDeadStock({products,
      movements, days=60}) (produk aktif tanpa SALE_OUT dalam N hari, nilai stok mati =
      currentStock x costPrice), buildStockTurnover per produk 90 hari, dan perluas
      buildInventoryReply supaya menjawab "stok mati", "perputaran", "konsinyasi", "berapa
      yang harus disetor ke supplier". Tambah intent kata: "stok mati", "dead stock", "gak
      laku", "perputaran", "setor supplier", "titip jual". Test >= 8 baru termasuk zero-data.
      Jangan sentuh brain/chat/route.ts kecuali kalau butuh data konsinyasi (tambah 1 query
      prisma.product ownershipType sudah ada di select).
  (d) riset-kebutuhan-lanjutan (read-only, NOL edit kode): skill research-engine. Urutan:
      baca 4 memori riset + roadmap-inventory-ai-distributor.md (KB-consult-first) -> baru
      cari sumber baru: WebSearch minimal 2 pencarian independen (kata kunci: "fitur aplikasi
      stok distributor sales kanvas Indonesia", "inventory app FEFO expired alert UMKM",
      "reorder point safety stock UMKM") + kalau Gemini bridge sehat, 1 grounding query
      (kalau OR/Gemini 402 atau error: declare-skip 1 baris, lanjut WebSearch). Output file
      BARU root repo 2026-09-XX-riset-fitur-stok-lanjutan-inventory.md (ASCII, register
      manusia): tabel fitur -> ada di KLIR? (file:line) -> nilai untuk UMKM vs Distributor ->
      butuh schema? -> prioritas usulan. Tandai [ADDITIVE-SAFE] vs [BUTUH FATUR]. Setiap
      klaim pasar bawa sumber URL. Tutup dengan 3-5 rekomendasi urutan bangun berikutnya.
      Jangan bangun apa pun dari hasil riset ini di batch ini.
  Lalu Verify -> Anti-Halu -> Gate (bawaan script). Temuan Gate ditambal KOMANDO (kamu)
  dengan tangan; rerun gelombang HARAM. Setelah tambal: tsc + suite + smoke browser:
  CEO buka Stok & Pembelian -> tab Konsinyasi tampil zero-state jujur; form penyesuaian
  muncul; JANGAN submit apa pun ke Neon (data produksi). Chat: "ada stok mati?" -> jawaban
  jujur tanpa produk.
  AGAR: rantai Stok -> Kas jadi nyata dua arah (pembelian keluar kas, penjualan masuk kas)
  seperti prinsip roadmap; konsinyasi jadi laporan yang bisa dibaca; riset memberi urutan
  kerja berikutnya tanpa mengarang.
  HASIL: 3 route baru, 1 tab + 3 form, engine diperluas, 1 dokumen riset, test bertambah.
  DONE: Gate boleh_declare_selesai true SETELAH tambalan komando; tsc 0; suite 0 fail;
  smoke read-only lolos; dokumen riset punya >= 2 sumber URL independen.

F4 MATANGKAN DASHBOARD + AI ASSISTANT, 3 PORTAL x 7 MODUL (berat, WAJIB Workflow)
  APA: audit sistematis lalu perbaikan additive supaya tiap portal menampilkan fitur yang
  relevan dari 7 modul dengan data jujur, label tanpa nama modul, dan semua tombol
  tersambung ke sesuatu yang nyata.
  DI MANA: CompanyDataDashboard.tsx, FinanceModuleView.tsx, MarketingModuleView.tsx,
  ExecutiveAIAssistantView.tsx, FinanceAIAssistantView.tsx, MarketingAIAssistantView.tsx,
  KlirWorkspaceView.tsx, KlirScheduleView.tsx, KlirInventoryView.tsx. page.tsx hanya kalau
  wiring benar-benar perlu (diff <= 30 baris, dicatat untuk Fatur).
  NYALAKAN: Workflow komando-tuntas-gate; skill ui-audit (4 fase SCAN/SCORE/RECOMMEND/REPORT)
  dipakai agent scan; skill impeccable untuk agent perbaikan visual; Council INTERNAL sekali
  sebelum Bangun untuk memutuskan urutan prioritas temuan (bukan untuk menunda).
  LANGKAH: (1) Scan 3 agent paralel (1 per portal). Tiap agent isi matriks 7 modul x 2
  permukaan (dashboard, AI) dengan kolom: fitur yang tampil (file:line), sumber data
  (endpoint) dan apakah zero-state jujur, label melanggar aturan modul-bukan-label?, tombol
  yang mati / toast doang / "Segera hadir", fitur dari modul yang relevan untuk role ini tapi
  belum tampil (pakai usulan matriks role-feature sebagai acuan awal; Marketing: katalog
  produk baca-saja adalah kandidat kuat). Modul corplan dan personal: catat kalau memang nol
  fitur (jangan mengarang fitur). Bukti tiap sel = file:line atau screenshot read_page.
  (2) Sintesis komando: gabung 3 matriks jadi 1 dokumen root repo
  2026-09-XX-audit-dashboard-ai-3portal-7modul.md + daftar perbaikan yang ADDITIVE-SAFE
  (bukan keputusan produk baru). Yang butuh keputusan produk (fitur baru besar, RBAC) masuk
  bagian "untuk Fatur/Mecca", TIDAK dibangun. (3) Bangun 3 agent paralel (1 per portal,
  file disjoint): perbaiki label, sambungkan tombol mati ke fitur yang ada atau ubah copy jadi
  jujur, tambah pintasan/kartu yang datanya sudah ada (contoh: Marketing baca katalog produk
  dari GET products, read-only; Finance kartu konsinyasi; CEO ringkasan 7 area termasuk
  operasional dan reservasi yang datanya ada). Gaya Fatur pixel-level. (4) Verify ->
  Anti-Halu -> Gate, tambal komando. (5) Smoke browser 3 portal: dashboard + AI tiap portal
  dibuka, console 0 error, tidak ada teks "Inventory"/"Modul"/"KLIR Management" yang dibaca
  user (grep read_page), tidak ada angka contoh.
  AGAR: ini "fase fitur" yang Mecca sebut; tanpa audit terukur, perbaikan cuma tebakan.
  HASIL: 1 dokumen audit + perbaikan additive di <= 9 file komponen.
  DONE: Gate hijau setelah tambalan; matriks 3x7x2 terisi penuh dengan bukti; smoke 3 portal
  lolos; tsc 0; suite 0 fail.

F5 DOKUMEN UNTUK FATUR (kecil, solo)
  APA: satu dokumen MD (wajib) + Word (opsional kalau waktu) yang merangkum SEMUA yang dikerjakan
  sejak 9 Sep sampai batch ini, bahasa manusia, tanpa gaya AI.
  DI MANA: file BARU root repo 2026-09-XX-untuk-fatur-batch-tingkat-b-apa-yang-berubah.md;
  Word (kalau dibuat) di KLIR\05-DOKUMEN\aktif\2026-09-XX-untuk-fatur\ pakai python-docx
  langsung (pelajaran 9 Sep: konverter markdown->docx tidak bikin tabel asli).
  NYALAKAN: skill document-engine hanya untuk Word; humanizer TIDAK dipakai (dokumen teknis).
  LANGKAH: (1) isi: ringkasan 30 detik; daftar file baru dan file berubah dengan alasan
  (ambil dari git diff --stat setelah F4); zona merah nol diff (bukti git diff --numstat
  origin/main -- <daftar file lane Fatur>); usulan matriks role->feature dilampirkan sebagai
  "usulan, keputusan di kamu"; 3 hal yang butuh dia (konversi satuan Product, persistensi
  target penjualan, backdoor auth/login masih hidup); catatan P0 Codex yang ternyata artefak
  klik. (2) tulis dengan kalimat mengalir, tanpa em-dash, ASCII bersih. (3) cek non-ASCII = 0.
  AGAR: Fatur tidak kelabakan, dan keputusan matriks role memang sudah Mecca serahkan ke dia.
  HASIL: 1 file MD (+ 1 docx opsional).
  DONE: file ada, ASCII 0 non-ascii, memuat 5 bagian di atas.

F6 INTEGRASI ORIGIN/MAIN MENGIKUTI CLEANUP FATUR, TANPA KEHILANGAN ARSIP (hati-hati, solo,
   Council SPEED sebelum merge)
  APA: commit batch, arsipkan yang akan dihapus Fatur, merge origin/main, selesaikan konflik
  dengan versi Fatur sebagai dasar, buktikan tidak ada fitur yang hilang.
  DI MANA: repo root; arsip di KLIR\05-DOKUMEN\arsip\2026-09-XX-arsip-root-dan-docs-sebelum-
  cleanup-fatur\ (di luar repo git, di dalam folder KLIR -- Rule #28).
  NYALAKAN: skill release-protocol (seksi 1); feedback_ceklis_fitur_bernama_bikin_yang_tak_
  terdaftar_hilang_diam_diam (sisir baris "-" setelah merge); feedback_diff_origin_main_bukan_
  bukti_penghapusan_cek_merge_base.
  LANGKAH: (1) ARSIP DULU: copy 13 dokumen yang dihapus ea619b1 (daftar persis: git show
  --name-status --format= ea619b1) dan seluruh folder docs\ (sebelum 6f1aaf3) ke folder arsip;
  tambah 1 baris CHANGELOG di KLIR\00-PETA-STRUKTUR-PROJECT.md (tanggal, Claude Code Sonnet 5,
  "arsip dokumen root + docs/PRD sebelum merge cleanup Fatur"). (2) COMMIT batch dirty
  (semua kerja Codex 9-10 Sep + Fable + F1-F5) dalam 2-4 commit logis: "feat(inventory): Stok
  & Pembelian Fase 0-2 ...", "fix(ai-brain): sales-target parser koma/spasi + port de2d83d
  3d2249e (Codex)", "docs: handoff/roadmap/panduan tes 10 Sep", "feat(ui): audit dashboard AI
  3 portal ...". Pesan commit menyebut APA + KENAPA. Akhiri tiap pesan dengan baris
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>. (3) git fetch origin; git
  merge-tree --write-tree HEAD origin/main untuk preview konflik yang SEBENARNYA (setelah
  commit). (4) git merge origin/main (bukan rebase: 36 commit lokal belum pernah dipush,
  tapi merge menjaga hash + 1 titik resolusi). Konflik konten (alert-priority-engine,
  context-engine, why-engine, MarketingModuleView, dan yang muncul di preview): buka file,
  ambil versi origin (Fatur) sebagai dasar hunk yang bentrok, lalu pasang ulang tambahan
  kita yang tidak ada di versi Fatur (port Codex kemungkinan besar identik -> pilih Fatur).
  Konflik modify/delete dokumen bertanggal: pilih HAPUS (sudah diarsip). docs/README.md:
  ambil versi Fatur. (5) SISIR: git diff --name-status <merge-base> HEAD dan git diff
  origin/main HEAD -- src | grep "^-" untuk memastikan tidak ada fungsi/ekspor kita yang
  hilang; cek khusus: KLIR_MODULE_KEYS, detectInventoryIntent, detectSalesTargetIntent,
  KlirInventoryView import di page.tsx, semua route inventory. (6) tsc 0; suite 0 fail
  (jumlah test tidak boleh turun dari sebelum merge); (7) SMOKE ASLI: restart dev server
  (preview tool), browser Keluar Akun -> masuk lagi (Mecca yang login kalau perlu; kamu
  HARAM mengetik kata sandi) -> CEO dashboard + AI + Stok & Pembelian, Finance dashboard + AI,
  Marketing dashboard + AI, upload 1 file kecil di Pusat Data, tanya AI 1 kali, generate 1
  dokumen; grep " [45][0-9][0-9] " di log dev = kosong. (8) zona merah: git diff --numstat
  origin/main HEAD -- src/lib/auth.ts src/lib/session*.ts src/lib/rate-limiter.ts
  src/lib/prisma.ts src/app/api/v1/auth prisma/schema.prisma src/app/layout.tsx
  src/app/components/KlirAuthModal.tsx src/app/components/KlirLandingV4.tsx
  ecosystem.config.js -> HARUS kosong.
  AGAR: "ikut Fatur" tanpa kehilangan sejarah dan tanpa fitur kita hilang diam-diam.
  HASIL: main = origin/main + kerja kita, worktree bersih, arsip tersimpan.
  DONE: 8 langkah punya bukti; git log --oneline -3 menunjukkan merge commit; git status kosong.

F7 RILIS: PUSH + DEPLOY SATU KALI (release-protocol seksi 2-4)
  APA: push batch final ke GitHub, deploy ke VPS, buktikan hidup.
  DI MANA: origin main (+ mirror claude/ai-brain-upgrade-1sep kalau masih dipakai Fatur:
  cek git log origin/claude/ai-brain-upgrade-1sep -1; kalau tertinggal jauh, jangan push ke
  sana, cukup catat); VPS root@72.61.142.156:/var/www/KLIR, PM2 klir-os.
  NYALAKAN: skill release-protocol; hook push-final-gate (mekanis).
  LANGKAH: (1) tulis 1 baris ke Mecca: "Batch final: N commit, tsc 0, test x/x, smoke asli OK
  (CEO/Finance/Marketing). Push + deploy sekarang? Fatur lagi di VPS gak?" -> TUNGGU jawaban.
  Kalau Mecca bilang Fatur sedang di VPS: push saja, deploy ditunda. (2) git push origin
  main. (3) deploy manual (JANGAN npm run deploy:vps): ssh -i C:\Users\mausx\.ssh\id_ed25519
  root@72.61.142.156 "cd /var/www/KLIR && git status --short" -> HARUS kosong, kalau tidak:
  STOP, lapor; lalu "git pull --ff-only && npm ci && npx prisma generate && npm run build &&
  pm2 reload klir-os". Build gagal = jangan reload, lapor. (4) curl -s -o /dev/null -w
  "%{http_code}" https://klir.laserstory1.id/ -> 200; .../api/v1/media/models -> 401;
  .../api/v1/inventory/products -> 401 (guard hidup). pm2 logs klir-os --lines 50 | grep -i
  error -> kosong atau dijelaskan. (5) browser produksi (tab baru): landing terbuka; kalau
  Mecca sudah login di produksi: CEO dashboard kartu Stok & Pembelian tampil. (6) rollback
  siap: git checkout <hash sebelumnya> && npm ci && npm run build && pm2 reload klir-os --
  tulis hash sebelumnya di laporan SEBELUM deploy. (7) kabar 1 baris untuk grup (Mecca yang
  kirim): hash + jam + apa yang harus dicek.
  AGAR: satu push, satu deploy, bukti hidup, jalan mundur jelas.
  HASIL: origin/main = lokal; produksi menyajikan commit baru.
  DONE: 200/401/401 + pm2 online + hash produksi = hash lokal; tier [LIVE] baru boleh dipakai
  untuk klaim setelah ini.

F8 LAPOR LALU TUNGGU
  APA: laporan akhir + jejak untuk sesi berikutnya.
  DI MANA: chat ke Mecca; Claude-Code-Memory\daily\ (ELIPS + state-file); memori auto
  (pointer project KLIR); panduan tes diperbarui (file baru bertanggal, jangan timpa).
  NYALAKAN: skill wrapup kalau Mecca minta tutup; kalau tidak, ELIPS ditulis manual.
  LANGKAH: (1) tabel per fase: status, tier, bukti mekanis (angka/hash/HTTP). (2) bagian
  "sengaja belum" dan "temuan baru". (3) panduan tes versi baru untuk Luna/Terra (item
  [LIVE] kini tersedia). (4) ELIPS lengkap + state-file ditutup + memori pointer diperbarui +
  1 baris system-upgrades. (5) Lapor, lalu TUNGGU Mecca. HARAM menutup sesi sendiri.
  AGAR: sesi berikutnya (model apa pun) lanjut dari disk tanpa nanya.
  HASIL: laporan + 4 file jejak.
  DONE: semua file ada; laporan memuat tier per klaim.
</workflow>

<must_invoke>
- skill boot (F0), skill council mode SPEED (F0) dan INTERNAL sekali (F4 sebelum Bangun),
  skill coding-engine (F1, F2), skill smart-debug mode TDD (F1), skill research-engine (F3d),
  skill ui-audit + impeccable (F4), skill document-engine (F5 Word saja), skill
  release-protocol (F6-F7), skill wrapup (F8 kalau diminta).
- Workflow komando-tuntas-gate via scriptPath (F3 dan F4). agentModel 'sonnet'. Tiap agent
  dapat 5 hal: Objective, Boundary (file yang bukan miliknya), Tools (Read/Grep/Bash tsc+test;
  WebSearch untuk riset), Output (schema build report dengan tier bukti + catatan_jujur),
  Effort (deep-dive untuk bangun; quick-scan untuk riset sumber sekunder).
- Hook mekanis yang akan aktif: assistant-output-guard C5 (tier bukti), push-final-gate,
  council-gate-pre (>= 5 edit kode tanpa council = blok; karena itu council SPEED di F0).
- Chrome MCP (claude-in-chrome) untuk smoke dengan sesi login Mecca; klik via ref.
- Model policy: komando Sonnet 5 (pilihan Mecca, hemat). Agent Workflow: sonnet. OR bridge:
  boleh dicoba untuk riset F3d, kalau 402 declare-skip 1 baris. Gemini bridge: boleh untuk
  grounding riset. HARAM Haiku. HARAM Gemini 2.x via OR. Jangan sarankan pindah ke Opus.
</must_invoke>

<constraints>
HARAM:
- Menyentuh prisma/schema.prisma, .env, src/lib/auth.ts, src/lib/session*.ts,
  src/lib/rate-limiter.ts, src/lib/prisma.ts, src/app/api/v1/auth/**, KlirAuthModal.tsx,
  layout.tsx, KlirLandingV4.tsx, ecosystem.config.js, deploy script. Nol diff, dibuktikan
  git diff --numstat.
- prisma db push / migrate. Tidak ada perubahan skema di batch ini; kebutuhan skema ditulis
  ke dokumen Fatur.
- Menulis data sungguhan ke Neon (produk, PO, penjualan, penyesuaian) selama smoke -- kecuali
  Mecca minta eksplisit di chat saat itu. Test = fake Prisma.
- git push / deploy sebelum F6 selesai dan sebelum 1 baris konfirmasi Mecca di F7.
  npm run deploy:vps HARAM (pakai npm install). git push --force HARAM. reset --hard HARAM.
- Menghapus/menimpa dokumen 2026-09-* yang sudah ada; tulis file baru bertanggal.
- Kata "Inventory", "Modul", "KLIR Management" sebagai teks yang dibaca user. Angka contoh.
- Klik koordinat screenshot ter-scale. Mengetik kata sandi.
- Install dependency baru (package.json/package-lock.json tidak berubah).
- Menyarankan ganti model ke Opus. Menutup sesi sendiri.
- Rerun gelombang agent untuk menambal temuan Gate (tambal komando dengan tangan).
WAJIB:
- Tier bukti per klaim di setiap laporan: [LIVE] / [LOKAL] / [TEST] / [HIPOTESIS] / [BELUM]
  + bukti mekanis (N/N test, exit code, hash, HTTP code, file:line).
- tsc 0 + suite 0 fail sebelum pindah fase; jumlah test tidak boleh turun.
- page.tsx: diff total batch ini <= 30 baris tambahan di luar yang sudah ada, dicatat di
  dokumen Fatur.
- Sebutkan "sengaja belum" di tiap laporan fase.
- State-file diperbarui di akhir tiap fase (anti-compact).
</constraints>

<output_and_done>
DONE_CRITERIA (semua harus terpenuhi sebelum bilang "selesai" ke Mecca):
[ ] F1: 409 + pesan inline SKU, test hijau, smoke read-only.
[ ] F2: panel Perlu perhatian tampil di CEO (dan kosong-jujur di Finance) dengan registry
    sumber, dismiss 24 jam, test hijau, smoke 2 portal.
[ ] F3: 3 route baru + 3 form + tab Konsinyasi + engine diperluas + dokumen riset >= 2 sumber,
    Gate hijau setelah tambalan komando.
[ ] F4: dokumen audit 3x7x2 terisi bukti + perbaikan additive, Gate hijau, smoke 3 portal,
    nol label modul.
[ ] F5: dokumen Fatur MD ada (Word opsional), ASCII bersih.
[ ] F6: arsip tersimpan + CHANGELOG PETA, merge origin/main selesai, sisir "-" bersih, zona
    merah nol diff, smoke login asli 3 portal, log dev tanpa 4xx/5xx.
[ ] F7: push 1x, deploy 1x dengan npm ci, 200/401/401, pm2 online, hash produksi = lokal,
    rollback hash tercatat.
[ ] F8: laporan tabel per fase + ELIPS + state-file + panduan tes versi baru + memori.
Versi Mecca dari "selesai": dia bisa buka localhost dan produksi, klik alur di panduan tes,
dan tidak menemukan "kok belum" yang tidak sudah dijelaskan di depan.
</output_and_done>

<escalation>
- Gagal teknis: coba maksimal 3 pendekatan berbeda per masalah, catat ketiganya, lalu lapor
  dengan bukti -- jangan tebak fix ke-4.
- Ragu antara dua cara teknis: putuskan sendiri yang paling sederhana dan additive, catat
  alasannya di komentar kode bertanggal. Jangan tanya Mecca.
- Konflik merge yang menyentuh file lane Fatur (seharusnya tidak ada): STOP, jangan resolve,
  lapor daftar file + hunk.
- Fatur push commit baru di tengah batch (fetch menunjukkan behind > 4): baca diff-nya dulu,
  kalau menyentuh file yang sedang kamu kerjakan -> selesaikan fase yang sedang jalan, lalu
  merge lagi di F6 (bukan rebase per commit).
- Dev server mati / localhost 500 massal: ikuti tabel diagnosis release-protocol seksi 5
  (cookie basi, Prisma client belum regenerate) sebelum menyentuh kode.
- Butuh keputusan produk baru yang genuinely tidak tercakup <context> (contoh: fitur baru yang
  bukan additive-safe): tulis PROPOSAL 3 kalimat dengan rekomendasi, taruh di bagian
  "untuk Fatur/Mecca" dokumen F4/F5, lanjut ke item lain. Jangan berhenti menunggu.
- Kredit sesi mepet (>= 85% seperti 9 Sep): selesaikan fase yang sedang jalan sampai
  checkpoint, tulis state-file, lapor posisi, tunggu Mecca -- jangan mulai Workflow baru.
</escalation>
