# CONTEXT PACK -- Sesi Fable 11 Sep 2026: integrasi AI-data, model hemat, UI asisten, dashboard rekomendasi

> Untuk SEMUA agent workflow sesi ini. Kamu pendatang baru tanpa memori. Baca 5 seksi ini penuh.
> Ditulis oleh komando (Claude Fable 5.1) setelah full-read backend inti sendiri. Fakta yang
> ditandai [VERIFIED] sudah dicek komando langsung (file:line / output perintah). Yang tidak
> ditandai = arah kerja, bukan klaim fakta.

## 1. SIAPA

- Produk: KLIR, aplikasi "OS bisnis" untuk UMKM Indonesia. Next.js 15 App Router + Prisma +
  Neon Postgres (SATU database dipakai lokal DAN produksi -- JANGAN jalankan `prisma db push`
  / migrasi / seed / hapus data apa pun). Repo: AniTech-Dev/KLIR, branch main.
- Pemilik produk: Mecca (CEO AniTech). Dev manusia: Fatur (lane merah: auth/session/membership/
  landing page/page.tsx/schema.prisma/infra). Kita (tim AI): semua lapisan AI Brain, Pusat Data,
  AI Assistant view, dashboard AI, media.
- Repo lokal (CWD semua agent):
  C:\Users\mausx\OneDrive\Nime\OneDrive\Documents\Claude Code Asistent\KLIR\02-KLIR-PUBLIC-PRIVATE\2026-09-01-github-push-workspace\klir-repo-clone
  Pakai path Windows. HARAM /mnt/c. HARAM git push / git commit / deploy / ssh dari agent.
- Baseline [VERIFIED 11 Sep pagi]: HEAD ddc2c40 = commit LIVE di VPS; `npx tsc --noEmit` 0
  error; `npm run test:all` 1484/1484 lolos (250 suite, ~30 detik). origin/main tidak punya
  commit baru di atas HEAD (Fatur belum push sejak ddc2c40).

## 2. PERJALANAN (ringkas, cukup untuk tidak mengulang kesalahan)

- 7-10 Sep: AI Brain 4-lapis, Pusat Data (upload -> ekstraksi -> WorkspaceFile.extractedSummary
  -> workspace-knowledge manifest+top-K ke prompt), composer Setelan Jawaban (effort/model
  picker/riset), media Studio (gambar/video/voiceover via OpenRouter), 46 temuan bug-hunt
  ditambal, deploy ddc2c40.
- Insiden yang membentuk aturan keras: (a) 5 Sep angka 37 juta vs 3 M karena LLM menebak angka
  dari teks dokumen -> semua angka finansial WAJIB deterministik (ledger-parser) atau jujur
  "tidak ada"; (b) 8 Sep komponen client mengimpor modul node-only -> seluruh halaman 500 walau
  tsc 0 -> file server-only (text-model-catalog.ts, dll) HARAM diimpor dari komponen client;
  (c) 8 Sep Groq tier gratis 413 pada prompt >8k token -> histori dipangkas 6 pesan x 1500 char.
- 10 Sep: Mecca minta push+deploy SATU KALI per batch (Fatur komplain push berkali-kali).

## 3. POSISI (keluhan Mecca 11 Sep + akar yang sudah diverifikasi komando)

Keluhan Mecca (verbatim-inti, dari STT):
1. Pusat Data sudah berisi 12 file (proposal, presentasi, notulen, laporan-penjualan xlsx,
   dst) tapi Dashboard Perusahaan masih Rp 0 / "Belum ada data". Data ada, dashboard nol.
2. AI harus "belajar" dari file yang diupload (Word/Excel/PPT/gambar/zip, data berantakan
   lintas bulan/tahun): tahu perusahaan ini tentang apa, riwayatnya, angka-angkanya.
3. Generate gambar & video harus terintegrasi data perusahaan (bukan cuma nama workspace).
4. API key: OpenRouter = UTAMA. Groq + Gemini = cadangan. Default WAJIB model murah; user
   yang mau serius pilih sendiri mode/model canggih.
5. Jawaban adaptif: AI tahu kapan perlu jawaban kompleks vs singkat.
6. Template Word/Excel/PDF/PPT/gambar/video: user bisa minta "template seperti ini" dan dikasih.
7. Mode riset/belajar/analis: framework matang, "agent di balik layar" di VPS.
8. UI AI Assistant (semua role): blok "Ringkasan perusahaan Anda" (panel data di atas) JANGAN
   ditampilkan dulu (default tersembunyi); grid "Semua kemampuan AI" DIHAPUS dari area utama,
   isinya pindah ke sidebar kiri "Kemampuan & tools AI", disesuaikan per role.
9. Dashboard CEO/Finance/Marketing WAJIB selalu menampilkan rekomendasi, analisis, saran
   lanjutan, prediksi AI (termasuk pertanyaan seperti "project ini profit gak?", peringatan).
10. Riwayat chat jadi memori; semua role tahu apa yang sedang dikerjakan (lintas divisi).
11. Jangan boros agent (kemarin 170 agent). Sesi ini: 12 agent total, semua Sonnet.

Akar yang SUDAH diverifikasi komando [VERIFIED, file:line HEAD ddc2c40]:

A. ROUTING MODEL (keluhan 4, 5)
- src/lib/ai-gateway.ts:688 `defaultOrder = ['groq','openrouter','opencode','openai','gemini']`
  -> Groq dicoba PERTAMA di cascade 'auto'. Groq = tier gratis, limit 8k token/menit.
- src/lib/ai-gateway.ts:147 default OpenRouter text model = 'google/gemini-3.5-flash'
  (harga live 11 Sep: $1.50 in / $9.00 out per juta token -- MAHAL untuk default).
- src/app/api/v1/brain/chat/route.ts:702 `const model = body.model || 'opencode'`; :2164-2177
  chat utama: modelName 'deepseek/deepseek-chat' (default) / 'deepseek/deepseek-r1' (model
  'deep'), preferredProvider 'openrouter'. Screenshot Mecca 11 Sep: jawaban chat tercatat
  "deepseek/deepseek-r1" ($0.70/$2.50, ctx 64k) untuk permintaan video sederhana.
- src/lib/ai-orchestrator.ts:709-752 TASK_ROUTES: chat/extract_json/summarize -> 'groq'
  dulu; analyze/creative -> 'openrouter'; research -> 'gemini'.
- src/lib/chat-composer-types.ts EFFORT_MAP: santai 500 tok / normal 1200 / serius 2200 /
  maksimal 4000. route.ts:744-747: kalau body.effort TIDAK dikirim -> effort undefined ->
  maxOutputTokens undefined (tanpa batas) dan temperature 0.7. Tidak ada klasifikasi
  kompleksitas otomatis; hanya answer-mode.ts (JAWABAN vs PEMAHAMAN, regex kata bingung).
- Katalog OpenRouter live 11 Sep (GET /api/v1/models, 437 model), harga USD per juta token
  (prompt/completion), semua mendukung response_format JSON:
    google/gemini-3.1-flash-lite   0.250 / 1.500  ctx 1M   reasoning ya
    deepseek/deepseek-v4-flash-0731 0.065 / 0.180 ctx 1.3M reasoning ya
    openai/gpt-5-nano              0.050 / 0.400  ctx 400k reasoning ya
    qwen/qwen3.7-flash             0.030 / 0.130  ctx 1M   reasoning ya
    google/gemma-4-26b-a4b-it      0.042 / 0.220  ctx 1M   reasoning ya
    openai/gpt-oss-120b            0.037 / 0.170  ctx 131k reasoning ya
    deepseek/deepseek-chat         0.257 / 1.029  ctx 164k reasoning tidak
    deepseek/deepseek-v4-pro       0.955 / 1.911  ctx 1M   reasoning ya
    z-ai/glm-5.2                   0.966 / 3.036  ctx 1M   reasoning ya
    google/gemini-3.5-flash        1.500 / 9.000  ctx 1M   reasoning ya
    deepseek/deepseek-r1           0.700 / 2.500  ctx 64k  reasoning ya
    openai/gpt-5.4-mini            0.750 / 4.500  ctx 400k reasoning ya
    google/gemini-3.1-flash-image  0.500 / 3.000  (image out) -- default gambar sekarang, OK
  Video default 'bytedance/seedance-2.0' ada di /videos/models (spend OpenRouter 7 & 11 Sep
  membuktikan render video jalan), JANGAN diubah.
- Env VPS [VERIFIED nama key saja]: OPENROUTER_API_KEY (75 char), GROQ_API_KEY, GEMINI_API_KEY,
  OPENAI_API_KEY, OPENCODE_API_KEY. Tidak ada EMERGENT_LLM_KEY di VPS. Env lokal punya key
  yang sama + EMERGENT + ANTHROPIC. Nilai key HARAM dicetak/di-log.

B. PUSAT DATA -> DASHBOARD (keluhan 1, 2, 9, 10)
- Upload sudah matang: src/app/api/v1/workspace-files/route.ts (ekstraksi, zip per-entri,
  ledger deterministik, pemeriksaan data, recordCompanyKnowledge, invalidateContextCache,
  scheduleAutoCompanyProfileSync). extractedSummary disimpan sampai 24000 char/file.
- AI chat SUDAH membaca file: src/lib/ai-brain/workspace-knowledge.ts (manifest semua file +
  isi 4 file paling relevan, budget 14000 char) -> route.ts resolveBusinessData dataBlock.
- Dashboard TIDAK membaca file. CompanyDataDashboard.tsx:636-644 fetch kas/transactions,
  financial-trends, financial-health, brain/context, workspace-files (hanya hitung jumlah).
  Kartu "Ringkasan AI" (:1306-1345) adalah teks DETERMINISTIK dari f.rev (omset transaksi):
  rev 0 -> "Selamat datang di KLIR! ..." (persis screenshot Mecca). Tidak ada LLM, tidak ada
  isi file, tidak ada rekomendasi nyata. Kartu "Prediksi kas AI" & "Target & prediksi" baca
  GET /api/v1/brain/recommendations (deterministik dari context-engine, tanpa file).
- Angka transaksi hanya lahir dari CashTransaction. File xlsx penjualan masuk ke Buku Kas
  HANYA lewat tombol "Impor ke Buku Kas" (workspace-files/[id]/import-ledger, GET preview
  + POST confirm, jalur generik butuh mappingHash). Ini DISENGAJA (integritas finansial,
  insiden 37jt vs 3M). KEPUTUSAN KOMANDO: TIDAK auto-impor transaksi dari dokumen. Yang
  dibangun: (1) AI membaca file untuk narasi/rekomendasi dashboard dengan sumber jelas,
  (2) dashboard menunjukkan jujur "angka dari transaksi tercatat" vs "fakta dari dokumen",
  (3) nudge jelas "N file terdeteksi laporan penjualan -> Impor ke Buku Kas".
- Profil otomatis: src/lib/ai-brain/auto-company-profile.ts hanya 7 field (nama/industri/
  target/deskripsi/produk/model bisnis/NIB), debounce 5 detik, tidak menimpa MANUAL. Tidak
  ada "brief perusahaan" naratif yang bisa dipakai gambar/video/dashboard.
- Memori: model MemoryItem (scope WORKSPACE, content teks bertag). Tag yang ada:
  [COMPANY_PROFILE], [COMPANY_KNOWLEDGE], [BRAIN_MISTAKE], [ORCH_ROUTE_STATS]. Riwayat chat
  hanya di client (localStorage). Tidak ada memori percakapan lintas role di server.
- BH-013 (handoff 10 Sep): FinanceModuleView.tsx:607-612 fetch kas/transactions TANPA
  param bulan/range -> API default "bulan berjalan" (resolveDateRange, time-series-engine.ts:116).
  API kas/transactions mendukung ?month=YYYY-MM | ?range=this_month|last_month|last_30_days|...
  | ?startDate&endDate [VERIFIED kas/transactions/route.ts:37-50]. CompanyDataDashboard versi
  CEO membaca kumulatif (aman).

C. GAMBAR & VIDEO (keluhan 3)
- Gambar via chat: route.ts:531-534 enrichImagePromptAntiSlop(message, workspaceName) --
  hanya NAMA workspace. media/generate route: brandContext {workspaceName, palette, hasLogo,
  industry} dari client. Tidak ada profil/produk/target/dokumen perusahaan di prompt.
- Video: client 3 view `if (mode === 'video')` (Executive :1206, Marketing :1211, Finance :942)
  -> POST /api/v1/media/generate kind video -> pollVideoJob (marketing-media/client.ts).
  Render nyata jalan. TAPI kalau user mengetik "generate videonya" sebagai chat biasa,
  LLM menjawab "KLIR belum punya fitur render video" karena src/lib/ai-tools-registry.ts:96-103
  masih `render-video status:'planned'` dan system prompt route.ts:2112 cuma menyebut
  "storyboard video". Registry + prompt harus jujur: render video ADA lewat mode Video.

D. UI ASISTEN (keluhan 8) [VERIFIED]
- Panel data default TAMPIL: ExecutiveAIAssistantView.tsx:797 showData useState(true) (+ :803
  localStorage 'klir_ai_show_data'); MarketingAIAssistantView.tsx:909 dataExpanded
  useState(true) (tanpa localStorage); FinanceAIAssistantView.tsx:604 showData useState(true)
  (+ :686 'klir_finance_ai_show_data'). Tombol toggle: Exec :3219-3223, Mkt :2904, Fin :2806.
- Grid "Semua kemampuan AI": Exec :3448-3502 (capabilities, :2446 katalog 28 item), Mkt
  :3132-3229 (5 kategori khusus marketing, def :253), Fin :3042-3112 (:2172 capabilities 28
  item). Sidebar "Kemampuan & tools AI": Exec `tools` :2073 + pluginItems :2216/:2831; Mkt
  `tools` :1902; Fin `tools` :1622. Galeri "Mulai dari tugas nyata" TETAP (tidak diminta hapus).

E. TEMPLATE (keluhan 6)
- Registry sudah ada: src/lib/doc-templates/index.ts (19 template: laporan keuangan SAK EMKM,
  invoice, deck, brief video) + src/lib/template-library.ts (struktur per role) +
  src/lib/industry-image-templates.ts (8 gaya visual). Endpoint GET/POST
  /api/v1/documents/from-template (list + generate dengan templateId). UI: DocTemplateStudio.tsx.
  Chat: capability-catalog.ts menyuntik daftar ke prompt, tapi TIDAK ada intent "pilih
  template" deterministik dan templateId tidak diteruskan dari chat ke runGeneration.
- PDF: tidak ada renderer PDF di server (deps: docx, exceljs, pptxgenjs, pdf-parse baca saja).
  KEPUTUSAN: PDF TIDAK dibangun batch ini -- jujur di UI/prompt ("PDF: ekspor dari Word").

F. MODE (keluhan 7)
- Sudah ada: composer chip Tanya/Gambar/Video/Riset (researchMode web/competitor/location/
  forecast), effort 4 tingkat, answer-mode JAWABAN/PEMAHAMAN, persona-skin per role.
  Belum ada SSOT "mode asisten" (tanya/riset/belajar/analis) yang memetakan ke effort +
  tier model + instruksi + riset. "Agent di balik layar" = proses server yang sudah ada
  (debounce auto-profile, VideoJob polling); PM2 1 instance -> Map in-memory aman.

## 4. TUGAS (per agent, file DISJOINT, kontrak eksplisit)

Prinsip: tambahan aditif, diff surgical, komentar kode bertanggal (11 Sep 2026) menjelaskan
KENAPA (bukan cuma apa). JANGAN sentuh file agent lain -- error tsc di file orang lain
dilaporkan, bukan diperbaiki. Setiap agent build WAJIB: jalankan `npx tsc --noEmit` dan
test yang relevan (`node --experimental-test-module-mocks --import tsx --test tests/<file>`)
sebelum melapor; laporkan hasil apa adanya dengan tier [LOKAL-TEST] / [HIPOTESIS].

### KONTRAK MODUL BARU (nama, signature, lokasi -- WAJIB persis, dipakai lintas agent)

1. src/lib/model-tiers.ts (B1) -- server-only, boleh diimpor client HANYA type-nya? TIDAK:
   file ini tanpa import node-only dan tanpa process.env di top-level; fungsi resolve boleh
   baca process.env di dalam fungsi. Aman diimpor dari server routes dan lib.
   export type ModelTier = 'hemat' | 'standar' | 'maksimal';
   export interface TierSpec { tier: ModelTier; primary: string; fallbacks: string[];
     reasoningEffort?: 'low'|'medium'|'high'; note: string; }
   export const MODEL_TIERS: Record<ModelTier, TierSpec>  (default:
     hemat:    primary 'google/gemini-3.1-flash-lite', fallbacks ['deepseek/deepseek-v4-flash-0731','openai/gpt-5-nano']
     standar:  primary 'deepseek/deepseek-v4-pro',     fallbacks ['z-ai/glm-5.2','google/gemini-3.1-flash-lite']
     maksimal: primary 'google/gemini-3.5-flash', reasoningEffort 'high', fallbacks ['deepseek/deepseek-v4-pro','z-ai/glm-5.2'] )
   export const JSON_EXTRACTION_MODEL = 'google/gemini-3.1-flash-lite'; (fallback Groq openai/gpt-oss-120b)
   export function resolveTierForEffort(effort: 'santai'|'normal'|'serius'|'maksimal'|undefined): ModelTier
     (santai/normal/undefined -> hemat; serius -> standar; maksimal -> maksimal)
   export function resolveTierSpec(tier: ModelTier): TierSpec  -- env override per tier:
     OPENROUTER_MODEL_HEMAT / OPENROUTER_MODEL_STANDAR / OPENROUTER_MODEL_MAKSIMAL (primary),
     OPENROUTER_TEXT_MODEL lama tetap dihormati sebagai override 'hemat' (kompatibilitas).
   export function modelIdsForTier(tier): string[]  (primary + fallbacks, unik).

2. src/lib/ai-brain/auto-effort.ts (B1) -- PURE, nol import selain type.
   export interface AutoEffortResult { effort: 'santai'|'normal'|'serius'; reason: string; signals: string[] }
   export function classifyEffort(input: { message: string; hasAttachment?: boolean;
     historyLength?: number; researchMode?: string; assistantMode?: string }): AutoEffortResult
   Aturan (deterministik, bisa diuji): sapaan/pertanyaan <= 12 kata tanpa kata analitis ->
   santai; kata analitis (analisis, strategi, evaluasi, bandingkan, prediksi, proyeksi,
   rencana, kenapa, dampak, risiko, rekomendasi, laporan, hitung, simulasi, profit, rugi,
   untung, kelayakan) ATAU lampiran ATAU pesan > 60 kata ATAU assistantMode 'analis'/'riset'
   -> serius; selain itu normal. TIDAK PERNAH 'maksimal' otomatis (maksimal = pilihan user).

3. src/lib/ai-brain/assistant-modes.ts (B3) -- PURE, boleh diimpor client (nol import node).
   export type AssistantMode = 'tanya' | 'riset' | 'belajar' | 'analis';
   export const ASSISTANT_MODES: ReadonlyArray<AssistantMode>;
   export const ASSISTANT_MODE_LABEL: Record<AssistantMode, { label: string; desc: string }>;
   export function resolveAssistantMode(raw: unknown): AssistantMode  ('tanya' kalau tak dikenal)
   export function getAssistantModeInstruction(mode: AssistantMode, workspaceName?: string|null): string
     (belajar = jelaskan bertahap + analogi + 1 latihan/pertanyaan cek pemahaman; analis =
      angka dulu, tabel, asumsi eksplisit, rekomendasi berperingkat, risiko; riset = wajib
      sebut sumber/ketidakpastian; tanya = ringkas)
   export function assistantModeDefaults(mode): { effortFloor: 'santai'|'normal'|'serius';
     forceResearch?: 'web'|undefined }  (riset -> forceResearch 'web', effortFloor serius;
     analis -> effortFloor serius; belajar -> normal; tanya -> santai)

4. src/lib/ai-brain/company-brief.ts (B3) -- server-only.
   Tag MemoryItem baru: '[COMPANY_BRIEF]' content = teks brief <= 1800 char, format tetap:
     [COMPANY_BRIEF] v1 | generatedAt=<ISO> | sources=<n file>
     IDENTITAS: ...
     PRODUK/LAYANAN: ...
     PERIODE DATA YANG ADA: ... (dari nama file + isi, mis. "penjualan Jul-Sep 2026")
     ANGKA KUNCI TERTULIS DI DOKUMEN (sumber per angka, bukan hasil hitung LLM): ...
     CATATAN KUALITAS DATA: ...
   export async function getCompanyBrief(workspaceId: string): Promise<{ text: string; generatedAt: string|null; sources: number } | null>
   export async function refreshCompanyBrief(workspaceId: string, reason: string): Promise<void>
     (never-throw; bahan = buildWorkspaceKnowledgeBlock(workspaceId,'') manifest+relevant +
      MemoryItem [COMPANY_PROFILE] terbaru; LLM via orchestrate task 'summarize' dengan
      modelName JSON_EXTRACTION_MODEL dari model-tiers (import '@/lib/model-tiers');
      instruksi: JANGAN mengarang, angka hanya yang tersurat + sebut nama file sumbernya;
      no-op kalau manifest kosong; tulis MemoryItem baru append-only, terbaru menang)
   export function scheduleCompanyBriefRefresh(workspaceId: string, reason: string): void
     (debounce 8 detik, pola timers Map seperti auto-company-profile.ts)
   export async function buildBrandBrief(workspaceId: string): Promise<string>
     (<= 500 char, DETERMINISTIK dari [COMPANY_PROFILE] + baris IDENTITAS/PRODUK brief,
      tanpa LLM; string kosong kalau tidak ada apa-apa; dipakai prompt gambar/video)
   Wiring yang B3 lakukan sendiri: panggil scheduleCompanyBriefRefresh di
   src/app/api/v1/workspace-files/route.ts tepat setelah tiap scheduleAutoCompanyProfileSync
   (2 titik) dan setelah invalidateContextCache di DELETE; serta di akhir
   runAutoCompanyProfileSync (auto-company-profile.ts) setelah invalidateContextCache.

5. src/lib/ai-brain/conversation-memory.ts (B3) -- server-only, NOL LLM.
   Tag '[CHAT_TURN]' content: `[CHAT_TURN] role=<CEO|FINANCE|MARKETING|LAIN> user=<nama<=40>
   at=<ISO> | tanya: <<=180 char> | inti: <<=220 char> | artefak: <none|word|excel|ppt|image|video|storyboard>`
   export async function recordConversationTurn(input: { workspaceId: string; role: string;
     userName: string; question: string; answer: string; artifact?: string }): Promise<void>  (never-throw)
   export async function buildConversationMemoryBlock(workspaceId: string, currentRole: string): Promise<string>
     (8 turn terakhir lintas role, urut terbaru; judul "AKTIVITAS TERBARU LINTAS DIVISI
      (memori percakapan, 8 terakhir)"; baris untuk role lain diberi awalan "[divisi X]";
      string kosong kalau tidak ada; batas total 2000 char)
   Fungsi answer-inti: ambil kalimat pertama yang mengandung angka/kesimpulan, atau 220 char
   pertama setelah strip markdown (deterministik, ada test).

6. src/lib/ai-brain/dashboard-insight.ts + src/app/api/v1/brain/dashboard-insight/route.ts (B3)
   GET /api/v1/brain/dashboard-insight?role=ceo|finance|marketing[&refresh=1]
   Guard: sama persis pola brain/recommendations/route.ts (authenticateTenantRequest).
   Respons { success:true, data: DashboardInsight } dengan
   export interface DashboardInsight {
     role: 'ceo'|'finance'|'marketing'; generatedAt: string; cached: boolean;
     ringkasan: string;                      // 2-4 kalimat, jujur kalau data tipis
     sorotan: string[];                      // <=4
     rekomendasi: Array<{ judul: string; alasan: string; langkah: string; dampak: string; prioritas: 'tinggi'|'sedang'|'rendah' }>; // <=4
     prediksi: { teks: string; horizonBulan: number; keyakinan: 'rendah'|'sedang'|'tinggi' };
     peringatan: string[];                   // <=4, boleh kosong
     pertanyaanLanjutan: string[];           // <=3 prompt siap klik ke AI Assistant
     sumberData: { transaksiTercatat: boolean; jumlahTransaksi: number; dokumen: number;
       dokumenLedgerTerdeteksi: number; kampanye: number; tugas: number; produk: number };
     catatanJujur: string[];                 // mis. "angka omset dari dokumen belum diimpor"
   }
   Bahan: getOrBuildBusinessContext(ws,false,null,{includeCompanyKnowledge:true,
   includeMarketingMetrics:true}) + generateStrategicRecommendations + runForwardForecast(6)
   + getCompanyBrief + jumlah WorkspaceFile (dan berapa yang extractedSummary-nya mengandung
   'ANGKA TERVERIFIKASI' atau nama file cocok /penjualan|kas|transaksi|laba/i) + Product count.
   LLM: orchestrate task 'analyze', modelName = MODEL_TIERS.hemat.primary, jsonMode true,
   temperature 0.2, maxOutputTokens 1400, instruksi ketat anti-karang angka (angka HANYA
   dari blok bahan; sebut sumber "transaksi" atau "dokumen <nama>"). Kalau LLM gagal /
   deterministic_fallback / JSON invalid -> insight DETERMINISTIK dari rekomendasi+forecast
   (tetap valid, catatanJujur berisi "AI naratif tidak tersedia, ini ringkasan mekanis").
   Cache: MemoryItem '[DASHBOARD_INSIGHT role=<role>]' + JSON; TTL 30 menit; refresh=1
   melewati cache; invalidasi implisit via generatedAt (cukup TTL). Rate: refresh=1 maksimal
   1x/2 menit per workspace+role (Map in-memory) -> kalau kena, balas cached.
   Per role: ceo = lintas divisi; finance = kas/piutang/runway/pajak; marketing = kampanye/
   ROAS/konten. Prompt harus menyertakan fokus role.

7. src/lib/ai-brain/template-picker.ts (B6) -- PURE kecuali import listDocTemplates dari
   '@/lib/doc-templates' dan INDUSTRY_IMAGE_TEMPLATES dari '@/lib/industry-image-templates'
   (keduanya pure, sudah dipakai capability-catalog.ts).
   export type TemplateIntent = { kind: 'list'; outputType?: 'word'|'excel'|'ppt'|'video-plan'|'image'|'all' }
     | { kind: 'choose'; templateId: string } | null;
   export function detectTemplateIntent(message: string): TemplateIntent
     (list: /template|contoh format|format (laporan|dokumen|slide|presentasi|invoice)/ +
      kata tipe; choose: "pakai template <id atau label>" -> cocokkan label/id fuzzy
      terhadap listDocTemplates(); null kalau bukan)
   export function buildTemplateListReply(outputType?: string): string
     (markdown: tabel per tipe: label, untuk apa, cara pakai "ketik: pakai template <id>
      untuk <brief>"; sertakan gaya visual gambar; baris jujur "PDF: buat Word lalu ekspor")
   export function resolveTemplateChoice(message: string): { templateId: string; label: string; outputType: string; brief: string } | null
   Juga: tambah entri '/template' di src/lib/slash-commands.ts (kind 'setting', payload
   { templatePicker: true }) dan test slash-commands tetap lolos. Tambah kind 'template' ke
   NextActionKind di src/lib/ai-brain/next-actions.ts + pemicu: kalau pesan menyebut
   laporan/proposal/presentasi/invoice -> tombol "Pilih template" (brief: "template apa saja
   yang tersedia untuk <tipe>"). Update tests/next-actions-8sep.test.ts bila perlu.

### AGENT BUILD

B1 backend-routing  (file: src/lib/model-tiers.ts [BARU], src/lib/ai-brain/auto-effort.ts
   [BARU], src/lib/ai-gateway.ts, src/lib/ai-orchestrator.ts, src/lib/text-model-catalog.ts
   [hanya kalau perlu: FALLBACK_MODELS + RECOMMENDED tambah model tier], tests/ai-gateway-
   routing.test.ts, tests/ai-orchestrator.test.ts, tests/model-tiers.test.ts [BARU],
   tests/auto-effort.test.ts [BARU], tests/text-model-catalog.test.ts bila tersentuh)
   - Cascade 'auto': ['openrouter','groq','gemini','openai','opencode'] lalu Emergent lalu
     deterministic_fallback. Di dalam percobaan 'openrouter': coba primary tier lalu tiap
     fallback tier (modelIdsForTier) sebelum lempar ke provider berikutnya; kegagalan tiap
     model di-log warn tanpa body provider.
   - Tier dipilih dari options.effort (resolveTierForEffort) KECUALI modelName sudah berisi
     '/' (passthrough) atau 'deep' (-> maksimal). 'fast' tetap Groq. 'gemini-*' tetap Gemini
     direct. Groq default model 'openai/gpt-oss-120b' (sudah). Gemini direct default
     'gemini-flash-lite-latest' (sudah).
   - reasoning.effort HANYA dikirim kalau tier punya reasoningEffort DAN katalog live bilang
     model mendukung (getModelReasoningEfforts) -- pola yang sudah ada di tryExplicitOpenRouterModel.
   - TASK_ROUTES: chat/extract_json/summarize/analyze -> preferred 'openrouter', fallback
     'groq'; research tetap 'gemini' fallback 'auto'; creative 'openrouter' fallback 'auto'.
     extract_json + summarize modelName = JSON_EXTRACTION_MODEL.
   - Test lama yang mengunci Groq-first WAJIB diperbarui + komentar bertanggal kenapa
     (arahan Mecca 11 Sep: OpenRouter utama, Groq/Gemini cadangan). Tambah test: effort
     santai -> model hemat; serius -> standar; maksimal -> gemini-3.5-flash + reasoning high
     hanya kalau didukung; OR primary gagal -> fallback tier dicoba sebelum Groq.
   - JANGAN sentuh streamChatText/analyzeImageWithGemini/callEmergent/deterministic fallback
     text (di luar scope).

B2 backend-chat-route (file: src/app/api/v1/brain/chat/route.ts, src/lib/ai-tools-registry.ts,
   tests/brain-chat-composer-extras.test.ts, tests/brain-chat-*.test.ts lain bila tersentuh)
   - Auto-effort: kalau body.effort tidak dikirim -> classifyEffort(...) -> effort otomatis;
     response tambah `effortAuto: true|false` dan `effortReason`. Kalau body.effort dikirim
     -> hormati apa adanya (effortAuto false). effortFloor dari assistantModeDefaults
     menaikkan (tidak pernah menurunkan) effort otomatis.
   - assistantMode: baca body.assistantMode via resolveAssistantMode; suntik
     getAssistantModeInstruction ke LAPIS 4 setelah modeInstruction; forceResearch 'web'
     memaksa jalur riset sama seperti body.researchMode 'web' (kalau researchMode tidak ada).
   - Model default: hapus hardcode 'deepseek/deepseek-chat'/'deepseek-r1' di :2164-2177.
     Kirim modelName = undefined (biar tier dari effort di gateway) kecuali model 'fast'
     -> 'fast' (Groq), 'gemini' -> 'gemini-2.5-flash', 'deep' -> 'deep'. preferredProvider
     tetap seperti sekarang. Ekstraksi JSON (:1275, :1532, :1625) modelName 'gemini-2.5-flash'
     DIGANTI jadi tanpa modelName + preferredProvider 'openrouter' via orchestrate task
     'extract_json' ATAU executeAIRequest dengan modelName JSON_EXTRACTION_MODEL -- pilih
     yang diff-nya paling kecil, jelaskan di komentar.
   - Video jujur: ai-tools-registry 'render-video' -> status 'ready', endpoint
     '/api/v1/media/generate', description "Render video jadi via mode Video di composer
     (OpenRouter, 1-3 menit)". Prompt :2112 diperbarui: "video jadi bisa dirender lewat mode
     Video (chip Video di composer); dari chat teks saya siapkan storyboard + naskah, lalu
     tawarkan tombol Render video". Kalau detectMediaIntent(message)==='video' di jalur chat
     (bukan Studio) -> setelah jawaban, nextActions WAJIB berisi kind 'video' (sudah ada di
     next-actions) -- pastikan tidak dikosongkan oleh actionCard.
   - Gambar terintegrasi data: enrichImagePromptAntiSlop dapat parameter brandBrief string
     (dari buildBrandBrief(workspaceId), never-throw, fail-soft '') yang ditempel sebagai
     "Business context: ..." SEBELUM enrichWithIndustry. HARAM kirim brandBrief ke
     generateSedanceImage (pollinations publik) -- pertahankan privasi yang sudah ada.
   - Memori percakapan: setelah jawaban LLM sukses (blok :2208) DAN setelah jawaban generate
     file (:935) fire-and-forget recordConversationTurn({... role: userRole || membership,
     artifact}). Di resolveBusinessData tambah buildConversationMemoryBlock(workspaceId,
     userRole) ke Promise.all dan append ke dataBlock (setelah companyMemorySuffix), plus
     satu baris instruksi LAPIS 3: "AKTIVITAS LINTAS DIVISI adalah konteks, bukan fakta
     finansial -- jangan kutip angka dari situ".
   - Template: sebelum router generation (:915), kalau detectTemplateIntent(message)
     kind 'list' -> balas buildTemplateListReply (deterministik, nol LLM); kind 'choose'
     -> runGeneration({workspaceId, type: outputType, brief, tone, templateId}) -- runGeneration
     sudah menerima templateId (generation-engine.ts GenerationRequest). body.templateId
     eksplisit juga dihormati.
   - Response tambah: `assistantModeUsed`, `modelTierUsed` (dari aiResult.modelUsed vs
     MODEL_TIERS, string 'hemat'|'standar'|'maksimal'|'eksplisit'|'lain').
   - Test "klien lama" di brain-chat-composer-extras: perilaku BERUBAH SENGAJA (effort otomatis
     saat tidak dikirim). Perbarui asersi + komentar bertanggal yang mengutip arahan Mecca
     11 Sep ("default model rendah, jawaban adaptif"). Tambah test: pesan pendek -> santai +
     maxOutputTokens 500; pesan analitis -> serius; body.effort eksplisit menang.

B3 backend-knowledge (file: src/lib/ai-brain/assistant-modes.ts [BARU], company-brief.ts
   [BARU], conversation-memory.ts [BARU], dashboard-insight.ts [BARU], src/app/api/v1/brain/
   dashboard-insight/route.ts [BARU], src/app/api/v1/workspace-files/route.ts (hanya 3 baris
   wiring), src/lib/ai-brain/auto-company-profile.ts (1 baris wiring), tests/assistant-
   modes.test.ts, tests/company-brief.test.ts, tests/conversation-memory.test.ts,
   tests/dashboard-insight.test.ts [semua BARU], tests/workspace-files-t4-hooks.test.ts bila
   wiring baru mengubah asersi jumlah panggilan)
   - Ikuti kontrak modul 3-6 persis. Pola mock Prisma/orchestrate: tiru tests/auto-company-
     profile.test.ts dan tests/brain-chat-attachment-verdict.test.ts.
   - dashboard-insight route TIDAK boleh mengubah brain/recommendations.

B4 frontend-ai-views (file: src/app/components/ExecutiveAIAssistantView.tsx,
   MarketingAIAssistantView.tsx, FinanceAIAssistantView.tsx, src/app/components/chat/
   ComposerToolbar.tsx, NextActionsBar.tsx, src/lib/chat-composer-types.ts [hanya tambah
   field assistantMode di ComposerPrefs + DEFAULT], src/lib/chat-composer-prefs.ts bila
   perlu, tests/composer-toolbar.test.ts, tests/chat-composer-prefs.test.ts, tests/chat-cards-b5.test.ts)
   - Panel "Ringkasan perusahaan Anda": default TERSEMBUNYI di 3 view. Exec/Fin: useState(false)
     lalu localStorage '1' -> tampil (balik logika). Mkt: useState(false) + tambah localStorage
     'klir_marketing_ai_show_data' dengan pola sama. Tombol toggle tetap ada.
   - Grid "Semua kemampuan AI" DIHAPUS dari area utama di 3 view. Isinya DIGABUNG ke sidebar
     "Kemampuan & tools AI" per role: grup per kategori (judul kecil), item = ikon + nama +
     desc 1 baris, klik = perilaku sama seperti grid (isi prompt / kirim). Hindari duplikat
     dengan tools yang sudah ada di sidebar (dedup by label). Jumlah kemampuan per role
     ditampilkan di header sidebar. Variabel/state yang jadi yatim dihapus (tsc bersih).
     Galeri "Mulai dari tugas nyata" TETAP.
   - Mode asisten: chip baris composer tambah "Belajar" dan "Analis" (ComposerToolbar), disimpan
     di ComposerPrefs.assistantMode ('tanya' default), dikirim di body brain/chat sebagai
     `assistantMode` dari 3 view. Riset chip tetap seperti sekarang (assistantMode 'riset'
     boleh disinkronkan: kalau researchMode != off kirim assistantMode 'riset').
   - Badge kecil di bawah gelembung jawaban: "Otomatis: <effort> - <tier>" dari
     data.effortAuto/effortUsed/modelTierUsed (RichMessage/AnswerFeedbackBar area, non-intrusif).
   - NextActionsBar: dukung kind 'template' (kirim brief-nya sebagai pesan) dan pastikan kind
     'video' memicu jalur Studio video (bukan chat teks) -- lihat cara `mode === 'video'`.
   - Slash '/template': buka daftar dengan mengirim pesan "template apa saja yang tersedia".

B5 frontend-dashboards (file: src/app/components/CompanyDataDashboard.tsx,
   FinanceModuleView.tsx, MarketingModuleView.tsx, WorkspaceDataHub.tsx, tests/company-
   dashboard-helpers.test.ts, tests/finance-dashboard-helpers.test.ts, tests/marketing-
   dashboard-helpers.test.ts)
   - CompanyDataDashboard "Ringkasan AI": fetch GET /api/v1/brain/dashboard-insight?role=ceo
     (kontrak 6) -> render ringkasan, sorotan, rekomendasi (judul/alasan/langkah/dampak/
     prioritas), prediksi (+keyakinan), peringatan, pertanyaanLanjutan (tombol -> buka AI
     Assistant dengan prompt), sumberData chips ("Transaksi: 0 tercatat", "Dokumen: 12",
     "Ledger terdeteksi: 1 -> Impor ke Buku Kas"), catatanJujur, tombol "Perbarui" (refresh=1)
     + waktu generatedAt. Kalau fetch gagal -> fallback teks deterministik yang ada sekarang.
     Mode Ringkas/Rinci tetap: ringkas = ringkasan + 3 stat; rinci = semua.
   - FinanceModuleView + MarketingModuleView: kartu "Analisis & rekomendasi AI" kompak dengan
     role=finance / role=marketing, di dekat blok "Rekomendasi AI" yang sudah ada (jangan
     dobel: blok lama boleh diganti isinya dengan insight baru, fallback ke lama).
   - BH-013: FinanceModuleView tambah pemilih periode (Bulan ini | 3 bulan terakhir | Tahun
     ini | Semua) -> param kas/transactions (`range=this_month` | `startDate/endDate` 3 bulan
     | `startDate=YYYY-01-01&endDate=hari ini` | tanpa filter?? -> cek apakah API punya opsi
     "semua"; kalau tidak, pakai startDate=2000-01-01). Default Bulan ini; kalau hasil bulan
     ini 0 transaksi tetapi summary kumulatif > 0 -> otomatis pindah "Semua" + catatan kecil
     "Bulan ini belum ada transaksi, menampilkan semua periode". Simpan pilihan di
     localStorage 'klir_finance_period'.
   - WorkspaceDataHub: setelah upload sukses tampilkan baris "AI sedang mempelajari file ini
     (profil & brief perusahaan diperbarui otomatis ~10 detik)"; tombol "Lihat ringkasan AI di
     Dashboard". Tidak ada fetch baru selain yang sudah ada.

B6 templates-module (file: src/lib/ai-brain/template-picker.ts [BARU], src/lib/slash-
   commands.ts, src/lib/ai-brain/next-actions.ts, tests/template-picker.test.ts [BARU],
   tests/slash-commands.test.ts, tests/next-actions-8sep.test.ts)
   - Ikuti kontrak modul 7 persis.

### AGENT VERIFY (setelah build)

V1 verify-backend: jalankan `npx tsc --noEmit` dan `npm run test:all` (baca angka nyata),
   review diff B1/B2/B3/B6 (git diff -- <file>) terhadap kontrak; coba BANTAH klaim
   tiap agent; cek: OpenRouter genuinely pertama, model default hemat, tidak ada key di log,
   tidak ada angka dikarang di prompt insight, never-throw dipatuhi, cache TTL benar. Perbaiki
   HANYA typo/impor kecil di file yang jelas milik build agent (catat), sisanya LAPORKAN.
V2 verify-frontend: `npx tsc --noEmit`, `npm run build` (Next build, baca output), review
   diff B4/B5; cek tidak ada impor modul server-only ke komponen client (insiden 8 Sep);
   3 view konsisten (panel data tersembunyi default, grid hilang, sidebar berisi kemampuan
   per role); dashboard insight dirender dengan fallback; BH-013 period picker jalan secara
   kode. Laporkan dengan bukti baris.
V3 anti-halu-keamanan: `git diff --numstat HEAD` -- WAJIB NOL diff pada lane Fatur
   (src/app/api/v1/auth/**, src/app/page.tsx, src/app/components/KlirAuthModal.tsx,
   KlirLandingV4.tsx, prisma/schema.prisma, ecosystem.config.js, package.json kecuali
   ada alasan, .env*); grep secret/kunci di diff; cek tiap "catatan_jujur" agent vs kode
   nyata; cek klaim [LOKAL-TEST] vs output test sebenarnya; daftar klaim yang TIDAK terbukti.

## 5. ATURAN

- Bahasa komentar kode: Indonesia, bertanggal "11 Sep 2026", jelaskan KENAPA.
- HARAM: git commit/push/stash/reset/checkout, prisma db push/migrate, ssh, curl ke
  produksi, menulis .env, mencetak nilai API key, menghapus test, mengubah file agent lain,
  mengubah lane Fatur, membuat model Prisma baru, menambah dependency npm.
- Pure module = nol import node-only + nol process.env di top-level.
- Setiap laporan akhir agent WAJIB JSON (schema diberikan) dengan: files (path + ringkas
  perubahan), tests_run (perintah + hasil angka), claims (tiap klaim + tier
  [LOKAL-TEST]/[HIPOTESIS]), honest_gaps (yang sengaja belum / gagal), contract_notes
  (kalau ada deviasi dari kontrak, sebut alasannya).
- Kalau kontrak tidak mungkin dipenuhi tanpa menyentuh file agent lain: JANGAN sentuh,
  tulis di contract_notes; komando yang menambal.
