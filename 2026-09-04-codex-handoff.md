# KLIR — Codex Handoff Marker

Tanggal: 4 September 2026 (WIB)

## Status handoff

Pekerjaan sebelumnya dikerjakan melalui Claude Code dan terjeda karena kredit Claude
habis. Mulai marker ini, project KLIR dilanjutkan oleh Codex secara hands-off.

## Source of truth

- Folder kerja: `02-KLIR-PUBLIC-PRIVATE/2026-09-01-github-push-workspace/klir-repo-clone`
- Repository: `https://github.com/AniTech-Corp/KLIR`
- Branch aktif saat handoff: `claude/ai-brain-upgrade-1sep`
- HEAD saat handoff: `dc07b0e` (setelah sync aman dengan commit Fatur terbaru `e242d0a`)
- Remote branch sudah tersedia di GitHub.
- Setelah fetch terbaru, `origin/main` berada di `e242d0a`; commit Fatur tersebut sudah
  direview dan di-merge aman ke branch kerja.

## Konteks terakhir yang ditemukan

- Commit terakhir berisi polish landing page dan penghapusan UI slop/placeholders.
- Roadmap visual fidelity dashboard + AI Assistant bertanggal 4 September masih menjadi
  pekerjaan lanjutan utama.
- Rancangan voice, OpenRouter media picker, NotebookLM-style transforms, dan self-
  improving loop adalah roadmap; sebagian membutuhkan keputusan atau kredensial baru.
- Sistem gaya bahasa AI per-user secara eksplisit ditunda sampai ada arahan/gas ulang.
- Backend AI Brain, generator artifact, dan beberapa dashboard/assistant capability sudah
  dibangun; jangan menganggap semua item roadmap sebagai fitur yang belum ada.

## Guardrails untuk sesi lanjutan

- Fatur adalah developer utama KLIR. Pertahankan source, arsitektur, dan keputusan fitur
  Fatur; tugas Codex/Claude adalah menyempurnakan, bukan mengganti.
- Fokus hanya pada project KLIR ini.
- Jangan menghapus, mereset, atau merapikan file secara sembarangan.
- Jangan menyentuh folder arsip atau project KLIR lain sebagai target implementasi.
- Pertahankan arsitektur database Postgres/Prisma yang sudah ada.
- Verifikasi kondisi repository sebelum setiap perubahan besar.
- Bedakan pekerjaan yang sudah committed, uncommitted, roadmap, dan keputusan yang belum
  disetujui.
- Push ke GitHub hanya setelah perubahan selesai diverifikasi dan ada arahan final.
- Bedakan commit Fatur yang belum masuk branch kerja dari pekerjaan yang memang belum
  selesai. Keduanya tidak boleh disamakan.

## Checkpoint Codex — 4 September 2026

- Finance AI Assistant: role chrome Exec/Fin/Mktg, unified v6 header/hero, company-health snapshot, dan label plugin v6 ditambahkan; handler chat, upload, simulation, directive dashboard, dan artifact download dipertahankan.
- Marketing AI Assistant: aksen UI orange yang menjadi gap visual digeser ke blue system, role chrome/header/status koneksi ditambahkan; capability/data wiring dan Brand Kit dipertahankan.
- Executive AI Assistant: role chrome/header ditambahkan; simulator What-If, runway, source registry, dan data-flow existing dipertahankan.
- `npx tsc --noEmit`: ✅ lulus.
- `npm run build`: ✅ lulus (Next.js optimized build, 61 static pages, seluruh route generation).
- `http://localhost:3000/`: ✅ landing HTTP 200 dan render.
- Portal login: ❌ environment blocker karena PostgreSQL `127.0.0.1:5433` tidak aktif; tidak ada service Docker/PostgreSQL/psql lokal, dan `.env` tidak diubah.
- Source edits pada checkpoint ini akan masuk ke commit Codex terpisah; push GitHub tetap menunggu arahan final.
- Sync terakhir: `origin/main` `e242d0a` di-fetch dan di-merge aman; commit Fatur menyentuh `src/app/components/klirV4Markup.ts`, terpisah dari patch assistant/dashboard Codex.
- Recheck remote berikutnya: tidak ada commit/branch/tag Fatur baru selain `main=e242d0a`
  dan `claude/ai-brain-upgrade-1sep=0ac7b50`. Jangan mengklaim ada upload baru tanpa hash
  commit yang berubah.

## Saran untuk Claude Code setelah handoff

1. Baca marker ini dan bridge Codex sebelum mengedit source.
2. Pertahankan commit Codex `e34beb2` dan `1830819`, merge `ed2ce74`, serta marker `dc07b0e`;
   jangan reset/checkout branch ke `origin/claude/ai-brain-upgrade-1sep`.
3. Nyalakan PostgreSQL pada host/port yang sesuai dengan `.env`, lalu ulangi login portal
   dan visual smoke test tiga role; blocker database ini belum diselesaikan oleh Codex.
4. Lanjutkan audit Finance Dashboard dan CEO Dashboard sesuai roadmap, tanpa menghapus
   fitur nyata yang tidak ada di mockup.
5. Sebelum push, fetch ulang `origin/main`, jalankan completion gate, build, dan browser
   verification. Commit Codex dibuat oleh Codex ChatGPT dan belum dipush.

## Protokol kerja bersama — KLIR Public + KLIR UMKM

Mecca meminta agar pekerjaan dapat dilanjutkan lintas Claude Code, Codex ChatGPT,
Antigravity, atau AI lain yang diberi akses apabila kredit salah satu tool habis.

- Folder source aktif saat ini adalah **KLIR Public** pada Source of Truth di atas.
- **KLIR UMKM belum memiliki folder/repo resmi di checkpoint ini.** Saat tersedia,
  daftarkan path, repository, branch, dan readiness matrix-nya di marker/bridge ini.
- Jangan menyatukan tree source Public dan UMKM. Yang disatukan adalah coordination
  layer: marker, bridge, git hash, scope, test PASS/FAIL, dan blocker.
- Sebelum AI mana pun mengedit: baca marker ini + bridge Codex, fetch remote, cek git
  status, kemudian tulis checkpoint setelah selesai.
- Lane Fatur: login, auth, database, dan service PostgreSQL. Jangan diubah tanpa
  handoff eksplisit. Lane Codex/Claude: dashboard dan AI Assistant readiness.
- Status feature per 4 September 2026: TypeScript/build PASS; wiring dashboard dan AI
  Assistant PASS secara statis; visual portal/live AI runtime masih menunggu login dan
  PostgreSQL `127.0.0.1:5433` Fatur. Jangan mempromosikan blocker ini sebagai feature
  dashboard yang rusak atau menyebut end-to-end PASS sebelum re-test.

Catatan koordinasi Codex tersedia pada:
`C:\Users\mausx\OneDrive\Nime\OneDrive\Documents\Codex ChatGPT\memory\daily\2026-09-04-klir-cross-agent-continuity.md`

## Catatan Codex

Marker ini dibuat oleh Codex pada saat mengambil alih pekerjaan dari Claude Code. Audit
awal bersifat read-only selain file marker ini; tidak ada file existing yang dihapus atau
diubah.

Bridge konteks lintas tool tersedia di:
`C:\Users\mausx\OneDrive\Nime\OneDrive\Documents\Codex ChatGPT\2026-09-04-klir-codex-claude-bridge.md`

---

## TUGAS BARU UNTUK CODEX (ditugaskan Mecca, 4 September malam) — Generate Gambar/Video/Voice/Notebook

**Status `main` saat ditulis:** commit `3052266` (gabungan fix visual Finance/Marketing AI
Assistant dari Claude Code + push Fatur "integrate real backend data in finance/marketing
views", sudah merge bersih, tsc PASS). `git pull` dulu sebelum mulai kerja di sini.

**Baca dulu penuh sebelum kerja:**
`KLIR/02-KLIR-PUBLIC-PRIVATE/2026-09-04-rancangan-media-generate-v2-openrouter-key-tersedia.md`
(rencana lengkap + urutan prioritas + alasan tiap keputusan, jangan cuma baca ringkasan di
bawah ini).

**Ringkasan tugas (urutan dari paling siap dikerjain):**
1. **Generate gambar** (Executive + Finance AI Assistant SAJA, JANGAN Marketing — Mecca
   sengaja mau Marketing dipegang Codex sendiri secara terpisah/lebih dalam, lihat poin 4).
   Rekonsiliasi `src/lib/media-provider.ts` (scaffold OpenRouter) dengan
   `src/lib/ai-gateway.ts` `generateImage()` (sudah jalan via Gemini) jadi satu jalur.
   `OPENROUTER_API_KEY` SUDAH ADA (di `.env` lokal repo ini dan di GitHub Repository
   Secrets — punya AniTech/perusahaan, bukan personal). Tambah UI model-picker di kategori
   generate-gambar saja.
2. **Voice recording + transcript** (Groq Whisper) — semua 3 role. PENTING: `GROQ_API_KEY`
   di `.env` repo ini MASIH `dummy-groq-key` (placeholder) — perlu diganti dengan key asli
   dulu (tanya Mecca/cek referensi canonical) sebelum fitur ini bisa jalan sungguhan.
3. **Framework video SAJA** (semua role) — UI + route stub berstatus jujur "Segera", **JANGAN
   ada panggilan API generate-video yang beneran motong kredit/biaya** sampai ada keputusan
   budget eksplisit terpisah dari Mecca.
4. **Marketing: generate gambar/video/audio** — INI KHUSUS bagian Codex, silakan
   dikembangkan/diintegrasikan sesuai judgment Codex sendiri (Mecca eksplisit bilang
   ingin Codex yang pegang bagian ini, bukan Claude Code) — koordinasikan dengan poin 1
   di atas supaya arsitekturnya konsisten (satu jalur OpenRouter/fallback, bukan jalur
   ketiga yang beda sendiri).
5. Kuis + Flashcard (gaya NotebookLM) — LLM-only, ringan, semua role — prioritas paling
   akhir dari daftar ini.

**Tulis checkpoint di file ini setelah progress**, sama seperti konvensi checkpoint Codex
sebelumnya di atas.

## Checkpoint Codex — Marketing Media PRD W1–W6 (4 September 2026)

- Baseline implementasi `181c587`, branch `claude/ai-brain-upgrade-1sep`; pull explicit origin branch fast-forward-only sudah sukses.
- Shared media catalog/provider, generate/transcribe/models routes, notebook route, dan Marketing studio/cards/recorder terimplementasi.
- Jalur gambar gateway + legacy brain/chat menggunakan shared provider; tidak ada lagi Sedance/Pollinations fallback di chat.
- Image OpenRouter JPEG live PASS; TTS OpenRouter PCM→MP3 live PASS; STT OpenRouter live PASS.
- Gemini fallback live HTTP429 (kuota); Groq key masih placeholder. Unit fallback PASS, bukan bukti provider cadangan siap live.
- 46 unit tests PASS. Build produksi PASS pada checkpoint W1–W6; browser dan final recheck sedang berlangsung.
- PostgreSQL lokal5433 tertutup saat probe; authenticated DB acceptance belum PASS. Keempat endpoint baru menolak anonymous HTTP401.
- Kontrak consumer Claude, konfigurasi, test evidence: `2026-09-04-marketing-media-integration.md`.
- Executive/Finance UI, auth.ts, tenant-guard.ts, Prisma/schema, dan .env tidak diubah. Tidak ada push.

## Checkpoint Codex — verification dan handoff final source (5 September 2026)

- Implementasi PRD Marketing + shared API selesai di source: image, TTS, recorder/STT, video planned, quiz/flashcard. Ini bukan klaim production acceptance penuh.
- Final TypeScript PASS, production build PASS66static pages, targeted ESLint PASS, unit69/69 PASS. Browser12/12 PASS dengan API mock; report di ignored `build/media-smoke/browser-report.json`.
- Provider direct live: OpenRouter image JPEG512x512 PASS, OpenRouter TTS PCM→MP3 PASS, OpenRouter STT Indonesia PASS. Nama brand dapat salah transkripsi; user tetap edit dan kirim manual.
- Gemini live429, Groq placeholder: fallback unit/mock PASS tetapi provider cadangan belum live-ready. Video tidak pernah memanggil provider.
- Koreksi blocker terdahulu: pada recheck5September, existing .env sudah menunjuk Neon remote5432 dan TCP terbuka (bukan perubahan Codex). Browser production sesi Marketing Lead / Anitech CEO's Workspace mendapat “Akses workspace ditolak” pada image catalog. Membership/session workspace perlu ditangani Fatur; Codex tidak mengubah auth, data, atau membership.
- Notebook/brief-to-script live lewat sesi aplikasi masih perlu acceptance setelah akses workspace sah. Browser dan provider direct tidak dipromosikan menjadi E2E authenticated PASS.
- Handoff consumer Claude + acceptance matrix lengkap: `2026-09-04-marketing-media-integration.md`. Draft script dipertahankan pada kegagalan tahap TTS lewat response `status:script-ready`.
- Commit source Codex terpisah dengan pesan `feat(marketing): implement Codex media and notebook PRD`; hash dapat dibaca dari git log. Jangan push tanpa arahan Mecca.
- .claude/ untracked existing tetap dipertahankan. Executive/Finance UI, auth.ts, tenant-guard.ts, Prisma/schema, dan .env tidak diedit.

## Handoff audit Codex → Claude Code — 5 September 2026

Status terakhir:

- HEAD Codex: `fcf0a90` — `feat(marketing): implement Codex media and notebook PRD`.
- Tidak ada push GitHub.
- Verifikasi: TypeScript PASS, production build PASS, unit test 69/69 PASS, browser QA 12/12 PASS dengan API mock.
- Provider live yang sudah dibuktikan: OpenRouter image JPEG, OpenRouter TTS MP3, OpenRouter STT. Gemini fallback mendapat HTTP429; GROQ_API_KEY masih placeholder.
- Sesi browser nyata Marketing Lead pada Anitech CEO's Workspace masih mendapat `Akses workspace ditolak`. Ini perlu dicek di lane Fatur; jangan bypass auth atau mengubah membership dari lane Claude/Codex.
- Worktree setelah commit source hanya menyisakan `.claude/` untracked existing. Handoff ini adalah perubahan dokumentasi baru; tidak ada source feature yang diubah pada audit.

Temuan audit yang belum diperbaiki — mohon Claude prioritaskan sebelum menyebut fitur production-ready:

1. **P1 — Gateway text tidak otomatis memakai OPENROUTER_API_KEY.** Notebook dan brief→voiceover memakai `executeAIRequest`, sedangkan gateway saat ini merutekan `EMERGENT_LLM_KEY`, Groq, `OPENCODE_API_KEY`, OpenAI, dan Gemini. Jika hanya OpenRouter yang valid, image/TTS dengan script eksplisit bisa jalan, tetapi notebook dan draft script dapat berhenti di `deterministic_fallback`/NO_PROVIDER. Tambahkan adapter/routing OpenRouter text bila memang itu provider text yang dipilih perusahaan; tambahkan integration test OpenRouter-only.

2. **P2 — JSON fallback Groq tidak diparse.** Jalur retry Groq mengembalikan `json:null` walaupun `message.content` berisi JSON valid. Notebook lalu menolak hasil valid sebagai malformed. Parse content fallback saat `jsonMode` aktif dan tambah regression test 429→200 JSON.

3. **P2 — Flag TTS false masih dapat membayar tahap draft.** `POST /api/v1/media/generate` untuk audio berbasis prompt memanggil `executeAIRequest` sebelum `generateSpeech` memeriksa `MARKETING_MEDIA_TTS_ENABLED`. Capability TTS harus dicek sebelum draft AI dipanggil.

4. **P2 — Batas output draft tidak enforced.** Route mengirim `maxOutputTokens:1800`, tetapi adapter gateway tidak meneruskannya. Draft >6000 karakter baru gagal setelah panggilan AI berbayar. Teruskan token limit atau potong/tolak output dengan error yang jujur sebelum TTS.

5. **P2 — Retry voiceover dari kartu chat mengabaikan draft script.** Jika draft berhasil tetapi TTS gagal lalu panel ditutup, tombol `Coba kembali` memakai prompt awal, bukan `draftScript`. Retry harus mengirim script tersimpan agar tidak membuat draft baru dan tidak mengubah substansi.

6. **P2 — Transcript dapat hilang saat chat masih busy.** Recorder menutup panel lalu `handleSendMessage` ditolak oleh `requestsInFlight`. Transcript hasil edit tidak tersimpan. Sediakan state pending/send queue atau jangan tutup panel sebelum request diterima.

7. **P2 — Notebook/flashcard dapat memilih source riwayat lama.** `openStudio()` memprioritaskan attachment lalu riwayat chat, baru teks composer. Saat user menulis materi baru pada chat lama, studio dapat terbuka dengan materi lama. Untuk Quiz/Flashcard, teks composer eksplisit harus diprioritaskan.

8. **P2 — Media route belum memakai credit/rate guard server-side.** `/api/v1/media/generate` dan transcribe memakai session/workspace guard, tetapi belum memakai mekanisme credit consumption/rate limiting yang dipakai endpoint image lama. Dua request audio identik sama-sama menjalankan provider dalam probe mock. Tambahkan guard sesuai keputusan Fatur/plan billing; jangan membuat persistence asset baru.

9. **Smoke report caveat.** `scripts/smoke-marketing-media.ts --audio-only` mewarisi report lama sehingga stage transcription dapat terlihat sukses dari run sebelumnya. Tandai stage yang dilewati atau simpan run ID/timestamp per stage.

Batas audit:

- Temuan di atas direproduksi dengan mock lokal/read-only; tidak ada paid provider call tambahan, DB write, auth bypass, atau perubahan source selama audit.
- Dependency audit menunjukkan 2 high dan 2 moderate yang sudah ada di baseline (`pptxgenjs/image-size/uuid/exceljs`); bukan regresi dari commit media Codex. Mohon tangani sebagai dependency/security backlog terpisah.
- Detail kontrak, acceptance matrix, dan evidence berada di `2026-09-04-marketing-media-integration.md`.

## Handoff operasional lengkap — instruksi lanjutan untuk Claude Code

Bagian ini sengaja dibuat sebagai handoff mandiri. Claude tidak boleh hanya membaca
kalimat “feature sudah dibuat”, lalu langsung mengklaim production-ready. Pisahkan tiga
lapisan berikut:

```text
SOURCE IMPLEMENTATION
  fcf0a90
      │
      ├─ static contract / TypeScript / build
      ├─ isolated unit + HTTP security tests
      ├─ browser UI tests dengan API mock
      └─ live provider smoke test terbatas

CURRENT HANDOFF DOCUMENT
  89323f9
      │
      └─ audit findings + instruksi verifikasi Claude

REAL PRODUCTION ACCEPTANCE
  BELUM LULUS
      │
      ├─ sesi Marketing nyata ditolak membership workspace
      ├─ notebook/brief-to-TTS belum authenticated end-to-end
      ├─ Gemini fallback kena quota 429
      ├─ Groq masih placeholder
      └─ credit/rate guard media masih perlu keputusan billing Fatur
```

### A. Kondisi repository saat diserahkan

- Source of truth: repo KLIR Public pada branch
  `claude/ai-brain-upgrade-1sep`.
- Baseline sebelum implementasi Codex: `181c587`.
- Commit implementasi Codex: `fcf0a90`.
- Commit dokumentasi audit/handoff: `89323f9`.
- Tidak ada push dari Codex.
- `git status` setelah commit hanya menunjukkan `.claude/` untracked existing.
  Jangan menghapus, membersihkan, atau memasukkan `.claude/` ke commit tanpa instruksi
  Mecca.
- Source yang sengaja tidak disentuh:
  `src/lib/auth.ts`, `src/lib/tenant-guard.ts`, Prisma/schema, `.env`,
  PostgreSQL data, lane Fatur, dan UI Executive/Finance milik Claude.
- Jangan melakukan `reset --hard`, `clean`, `stash`, atau checkout yang dapat membuang
  perubahan lintas lane.

Sebelum Claude mengedit:

```powershell
git status --short
git log --oneline -5
git branch --show-current
git show --stat --oneline fcf0a90
git show --stat --oneline 89323f9
```

Jika hash atau branch berbeda, catat perbedaannya di checkpoint baru. Jangan menganggap
workspace lain adalah source yang sama.

### B. Apa yang benar-benar dibuat Codex

#### 1. Shared contract dan provider layer

File utama:

- `src/lib/media-types.ts` — contract client-safe untuk media request/result,
  model catalog, dan transcription result.
- `src/lib/media-errors.ts` — normalized error codes/status/retryability.
- `src/lib/media-catalog.ts` — OpenRouter discovery, cache lima menit, configured
  default model, capability descriptor, model validation, placeholder-key detection.
- `src/lib/media-provider.ts` — satu jalur image/TTS/STT dan video planned.
- `src/lib/media-http.ts` — read-only JWT, Origin, user, workspace membership, dan
  minimum role guard; tidak memakai bootstrap anonymous legacy.
- `src/lib/media-intent.ts` — parser intent eksplisit agar diskusi tentang gambar
  tidak otomatis memanggil provider berbayar.

Provider behavior yang harus dipertahankan:

```text
IMAGE
  OpenRouter /api/v1/images
      └─ gagal non-input → Gemini fallback

TTS
  OpenRouter /api/v1/audio/speech
      └─ Google PCM → encode MP3 lokal
      └─ tidak ada fallback provider kedua

STT
  Groq Whisper bila key genuine
      └─ gagal/tidak tersedia → OpenRouter transcription

VIDEO
  return status=planned
  └─ zero provider call, zero billing, zero polling
```

Validasi media yang sudah diterapkan:

- Image harus berupa PNG/JPEG/WebP raster valid, bukan sekadar base64 atau file
  signature. `sharp` melakukan decode pixel dan membatasi input pixel.
- Audio harus binary valid dengan MIME/format aktual yang konsisten, durasi >0,
  maksimal 25 MB dan sekitar 120 detik.
- TTS tidak boleh menyebut audio `ready` jika provider mengembalikan JSON/HTML/error
  atau bytes yang tidak dapat diparse.
- STT memakai format hasil decode actual bytes, bukan mempercayai ekstensi nama file.
- API key hanya dibaca server-side; tidak dimasukkan ke data URL, response, log, atau
  bundle client.

#### 2. API routes baru

- `GET /api/v1/media/models?kind=image|audio|transcription`
  - memakai session/workspace guard.
  - client tidak menerima API key.
  - image catalog dapat mengembalikan configured default berlabel belum terverifikasi
    jika discovery gagal.
  - audio sengaja dibatasi ke configured model pada v1.
- `POST /api/v1/media/generate`
  - menerima `kind=image|audio|video`.
  - video berhenti di planned branch sebelum discovery/provider.
  - image menambahkan workspace name dari auth ke brand prompt; body workspace/role
    bukan otorisasi.
  - audio menerima script langsung atau prompt yang harus didraft lebih dulu.
  - jika draft script sukses tetapi TTS gagal, response error menyimpan
    `data.status=script-ready` dan script agar dapat di-retry.
- `POST /api/v1/media/transcribe`
  - multipart field `audio`, optional language/model.
  - body dibatasi sebelum parsing form.
  - menggunakan `id` sebagai default language.
- `POST /api/v1/brain/notebook`
  - memakai authenticated workspace dari guard.
  - quiz default lima item; flashcard default delapan.
  - tidak menyimpan asset/kartu ke database.
- Jalur legacy image pada `/api/v1/brain/chat`, `/api/v1/brain/generate`, dan
  `src/lib/ai-gateway.ts` diarahkan ke provider image bersama agar tidak ada
  Sedance/Pollinations/double-generation path.

#### 3. Marketing UI

File:

- `src/app/components/MarketingAIAssistantView.tsx`
- `src/app/components/marketing-media/MediaStudio.tsx`
- `src/app/components/marketing-media/VoiceRecorder.tsx`
- `src/app/components/marketing-media/StudioResult.tsx`
- `src/app/components/marketing-media/client.ts`
- `src/app/components/marketing-media/wav.ts`
- `src/app/components/marketing-media/studio.module.css`

Flow yang sudah dibuat:

- toolbar composer: Gambar, Voiceover, Video Segera, Kuis, Flashcard, Rekam.
- image: prompt, model picker, ratio, quality bila capability tersedia,
  brand summary, provider/model badge, preview, download, regenerate.
- voiceover: script atau brief, voice, speed bila valid, player, download, copy
  script, provider/model badge.
- recorder: permission, recording timer, stop, preview, discard, retry,
  MediaRecorder MIME fallback, WAV normalization, transcript editable, manual send.
- video: planned state dan storyboard alternative; tidak ada fake video thumbnail.
- quiz: one-by-one question, score, explanation, reset, copy.
- flashcard: flip, next/previous, known/unknown, restart, copy/export.
- async result ditautkan ke chat asal ketika user pindah chat.

### C. Bukti yang sudah berhasil

| Area | Bukti aktual | Makna yang boleh diklaim |
|---|---|---|
| TypeScript | `npx tsc --noEmit` PASS | Contract/source compile |
| Production build | `npm run build` PASS, 66 static pages | Bundle production berhasil dibuat |
| Unit/helper | 69/69 PASS | Parser, provider mock, guard, notebook validation, client helper |
| Browser UI | 12/12 PASS pada production build, semua API dimock | UI state/interaksi lulus; bukan authenticated E2E |
| Anonymous API | endpoint baru HTTP401 | Anonymous tidak boleh membuat media |
| Guard | invalid JWT, foreign Origin, cross workspace, VIEWER, body role spoofing diuji | Access control dasar bekerja pada test harness |
| Image live | OpenRouter JPEG raster valid, decode/visual check PASS | Provider utama image pernah berhasil |
| TTS live | OpenRouter raw PCM dikonversi ke MP3 valid | Provider utama TTS pernah berhasil |
| STT live | OpenRouter transcript Bahasa Indonesia berhasil | Provider utama STT pernah berhasil |
| Video | route planned diuji dengan zero mocked fetch | Tidak ada provider video/billing pada fase ini |
| Secret scan | tidak ada known key prefix pada tracked source/docs | Key tidak ikut masuk commit |

Bukti file lokal yang dapat dibaca Claude:

- `build/media-smoke/browser-report.json` — ignored, browser mock report.
- `build/media-smoke/image.jpeg` atau image fixture live — ignored, jangan commit.
- `build/media-smoke/klir-voiceover.mp3` — ignored, jangan commit.
- `build/media-smoke/report.json` — smoke evidence, perhatikan caveat report lama.
- `2026-09-04-marketing-media-integration.md` — contract dan acceptance matrix.

### D. Bukti yang sengaja BELUM dianggap berhasil

Claude wajib mempertahankan klasifikasi ini:

1. Browser 12/12 bukan production E2E karena API di-intercept dan identity-nya
   fiktif/terisolasi.
2. Direct provider smoke bukan bukti route authenticated, karena dipanggil langsung
   dari provider module dengan key server.
3. Gemini fallback belum live-ready: request nyata terkena HTTP429 quota.
4. Groq primary belum live-ready: key masih `dummy-groq-key`/placeholder dan tidak
   boleh dipalsukan menjadi valid.
5. Sesi nyata Marketing Lead pada Anitech CEO's Workspace menerima
   `Akses workspace ditolak` pada `GET /api/v1/media/models`. Ini bukti blocker
   membership/session, bukan bukti provider rusak.
6. Notebook dan brief→TTS melalui route authenticated belum PASS end-to-end.
7. Mikrofon fisik user belum diuji; yang PASS adalah browser synthetic
   MediaRecorder dan upload fixture.
8. Tidak ada bukti total billing absolut di bawah USD3. Ledger smoke hanya reservasi
   konservatif; TTS raw response tidak mengembalikan cost metadata.
9. `npm audit` saat audit menunjukkan 2 high dan 2 moderate pada dependency yang
   sudah ada di baseline: `pptxgenjs/image-size/uuid/exceljs`. Itu backlog terpisah,
   bukan regresi commit Codex.

### E. Temuan audit yang Claude harus selesaikan atau eksplisitkan

Urutan ini adalah prioritas teknis, bukan izin untuk mengubah lane Fatur:

#### P1 — text gateway dan OPENROUTER_API_KEY

`notebook-engine.ts` dan prompt-only TTS memanggil `executeAIRequest`, tetapi gateway
lama tidak otomatis merutekan `OPENROUTER_API_KEY` sebagai text provider. Jika
OpenRouter adalah satu-satunya key aktif, gambar/TTS dengan script langsung bisa
berhasil, tetapi notebook dan draft script dapat berhenti di deterministic fallback.

Claude harus:

- tentukan provider text resmi (OpenRouter, Emergent, atau provider lain yang benar-
  benar tersedia), jangan memilih berdasarkan asumsi;
- jika memakai OpenRouter, buat adapter server-side yang mengikuti existing gateway
  contract, system instruction, JSON mode, timeout, error sanitization, dan metadata;
- jangan expose key atau membuat fake JSON fallback;
- tambah integration test konfigurasi OpenRouter-only;
- buktikan outbound URL/model/provider dan response metadata tanpa menampilkan secret.

#### P2 — Groq JSON fallback

Pada jalur Groq retry, response fallback berhasil tetapi `json` bisa tetap `null`
walaupun `message.content` JSON valid. Notebook kemudian salah mengklasifikasikan
hasil sebagai malformed.

Bukti wajib:

- mock request pertama HTTP429;
- request kedua HTTP200 dengan `message.content` JSON valid;
- `jsonMode=true`;
- assert notebook menerima payload valid dan provider/model fallback benar.

#### P2 — TTS disabled masih mendraft

Pada audio request berbasis prompt, draft AI dipanggil sebelum `generateSpeech`
memeriksa `MARKETING_MEDIA_TTS_ENABLED=false`. Ini dapat menimbulkan biaya walau
feature flag mematikan TTS.

Perbaikan wajib: cek capability TTS sebelum `executeAIRequest`. Test harus assert
provider call count = 0 dan response normalized `NO_PROVIDER`.

#### P2 — draft token/character limit

Route mengirim `maxOutputTokens:1800`, tetapi adapter gateway belum meneruskannya.
Draft 6500 karakter dapat lolos tahap gateway lalu ditolak TTS sesudah biaya sudah
terjadi.

Perbaikan wajib: teruskan batas token sesuai adapter atau enforce hasil segera,
trim hanya jika substansi tidak rusak dan diberi label, atau tolak dengan error
jelas sebelum tahap TTS. Tambahkan test output >6000 karakter.

#### P2 — retry draft voiceover

Jika script berhasil didraft tetapi TTS gagal, kartu chat menyimpan `draftScript`.
Tombol retry kartu masih mengirim submission awal yang berisi prompt, bukan script
tersimpan. Akibatnya draft dapat berubah dan provider text dipanggil ulang.

Perbaikan wajib: retry audio dengan `script=draftScript`, hapus prompt atau tandai
script sebagai explicit, lalu test skenario panel ditutup → retry dari kartu chat.

#### P2 — transcript ketika chat busy

Recorder menutup panel lalu mengirim transcript ke chat asal. Jika chat masih punya
request aktif, `requestsInFlight` menolak send dan transcript hasil edit hilang.

Perbaikan wajib: jangan membuang transcript sebelum diterima, atau queue submission
per chat sampai request aktif selesai. Test harus menjalankan generate image pending,
menutup panel, merekam/edit transcript, menekan send, dan membuktikan transcript
akhirnya tersimpan/terkirim tepat sekali.

#### P2 — source notebook dari composer

`openStudio()` saat ini dapat memprioritaskan riwayat chat di atas teks baru pada
composer. Pada chat lama tentang kopi, user mengetik materi teh lalu menekan Quiz;
studio dapat terbuka dengan materi kopi.

Perbaikan wajib: untuk Quiz/Flashcard, non-empty composer text eksplisit harus
menjadi source tertinggi, lalu attachment, lalu riwayat sebagai fallback. Test
harus membedakan teks lama dan materi baru.

#### P2 — credit/rate/idempotency media

Route media baru sudah memakai auth/workspace guard, tetapi belum memakai mekanisme
credit/rate guard yang dipakai endpoint image lama. Probe mock menunjukkan dua request
audio identik dengan `Idempotency-Key` yang sama tetap menjalankan speech provider dua
kali.

Claude/Fatur harus menyepakati:

- apakah image/TTS/STT/notebook memotong credit;
- tier/plan mana yang boleh memakai media;
- rate limit per user/workspace/IP;
- apakah idempotency key perlu persistence atau cache;
- response saat credit habis dan audit metadata yang aman.

Jangan menambahkan schema/migration/persistence baru tanpa approval Fatur. Jika belum
ada keputusan billing, tandai feature sebagai guarded-but-not-billing-ready dan
jangan mengklaim unlimited production access.

#### P2 — smoke report lintas-run

`--audio-only` dapat mewarisi stage transcription dari report run sebelumnya. Perbaiki
agar setiap report memiliki `runId`, timestamp per stage, status `skipped` yang nyata,
dan tidak mewarisi success lama sebagai evidence run baru.

### F. Urutan kerja Claude yang disarankan

```text
0. Re-read marker + integration doc + git status
1. Re-run static/unit baseline tanpa paid call
2. Fix text gateway/OpenRouter contract
3. Fix Groq JSON fallback
4. Fix TTS flag ordering + draft length enforcement
5. Fix UI retry/transcript/source precedence
6. Resolve credit/rate/idempotency with Fatur
7. Fix smoke report run isolation
8. Re-run browser mock regression
9. Re-run authenticated acceptance after workspace membership fixed
10. Update this marker with evidence, commit hash, unresolved blockers
```

Untuk langkah 9, urutan manual harus:

```text
login/session valid
  → pilih workspace yang benar
  → GET media/models
  → image generate kecil / provider+model badge
  → TTS explicit script pendek / audio play+download
  → recorder fixture atau microphone / transcript edit / manual send
  → notebook quiz / flashcard dari source baru
  → video planned / assert zero video provider call
```

Jangan memakai data pribadi untuk fixture. Jangan menekan Generate ulang berkali-kali
untuk “mencari bukti”. Satu call kecil per provider cukup, dan hentikan jika biaya
aktual/proyeksi mendekati batas yang disetujui.

### G. Format bukti yang harus ditulis Claude

Untuk setiap item yang diklaim selesai, tulis:

```text
ITEM:
FILES/COMMIT:
COMMAND atau FLOW:
EXPECTED:
ACTUAL:
EVIDENCE PATH / TEST NAME:
PROVIDER + MODEL:
COST METADATA:
STATUS: PASS / FAIL / BLOCKED / NOT RUN
REMAINING RISK:
```

Definisi status:

- `PASS`: assertion spesifik lulus dengan output/artifact yang bisa dibaca.
- `FAIL`: assertion dijalankan dan hasil aktual menyimpang; sertakan error ringkas.
- `BLOCKED`: tidak dapat dijalankan karena dependency eksternal; sertakan bukti
  blocker, jangan diubah menjadi PASS.
- `NOT RUN`: sengaja tidak dijalankan, misalnya paid smoke atau microphone fisik.

Completion gate final Claude:

- semua item PRD yang diklaim live punya bukti route + UI + provider;
- semua item yang belum authenticated ditandai BLOCKED;
- tidak ada fake fallback yang diberi label ready;
- tidak ada key di client/log/commit;
- tidak ada auth/schema/database lane change tanpa owner;
- `git diff --check`, `npx tsc --noEmit`, build, unit, dan browser report terbaru
  tercatat;
- marker ini diperbarui dengan hash commit terbaru dan status push yang sebenarnya.

Handoff ini adalah instruksi kesinambungan kerja, bukan klaim bahwa semua item di atas
sudah selesai. Claude boleh memperbaiki source sesuai ownership-nya, tetapi harus
mempertahankan honesty boundary: **provider mock ≠ provider live, provider live ≠
authenticated E2E, dan build PASS ≠ billing/auth production readiness**.

## Verifikasi scan Claude (Sonnet 5) — 5 September 2026, SEBELUM perbaikan apapun

Atas instruksi Mecca: baca handoff ini + scan kodenya dulu, JANGAN fix — perbaikan
sebenarnya akan dieksekusi sesi lain memakai model Fable. Bagian ini murni hasil
verifikasi read-only ke source, tidak ada file yang diubah. Command yang dijalankan:
`git log --oneline -8`, lalu `Read`/`Grep` langsung ke tiap file yang disebut. Semua 8
temuan substantif (P1–P8) di section E TERKONFIRMASI NYATA di kode saat ini, dengan
lokasi persis berikut (siap dieksekusi langsung, tidak perlu re-derive):

- **P1 (gateway text/OPENROUTER_API_KEY)** — CONFIRMED. `grep OPENROUTER_API_KEY src/lib/ai-gateway.ts`
  = 0 match di seluruh file. Cascade provider di `executeAIRequest` (ai-gateway.ts:393-600)
  urutannya BYOK → `EMERGENT_LLM_KEY` → `GROQ_API_KEY` → `OPENCODE_API_KEY` (callOpenCode
  memang hit endpoint `openrouter.ai` tapi baca env var `OPENCODE_API_KEY`, BUKAN
  `OPENROUTER_API_KEY` — dua secret berbeda) → `OPENAI_API_KEY` → `GEMINI_API_KEY` →
  `deterministic_fallback`. Kalau cuma OpenRouter yang valid, cascade ini jatuh ke
  deterministic_fallback. Catatan tambahan (lebih baik dari yang dikira): baik
  `notebook-engine.ts:95-97` maupun `route.ts:45` (media/generate) SUDAH eksplisit cek
  `provider === 'deterministic_fallback'` dan throw `NO_PROVIDER` — jadi kegagalannya
  BERSIH (error jelas), bukan sildoes-return-fake-data. Tetap harus difix supaya
  fitur-nya jalan, tapi bukan silent-corruption seperti kedengarannya di deskripsi awal.
- **P2 (Groq JSON fallback null)** — CONFIRMED, akar persis di `ai-gateway.ts:152-159`
  fungsi `callGroq`. Jalur retry-ke-Qwen (saat request pertama !ok) return
  `{ text: fbOutput, json: null, ... }` TANPA PERNAH mencoba parse `fbOutput` sebagai
  JSON — kontras dengan jalur non-retry di baris 162-173 yang parse dengan benar. Fix:
  terapkan logic parse yang sama (strip ```json fence lalu JSON.parse) ke branch fallback.
- **P3 (TTS flag dicek terlalu telat)** — CONFIRMED. `route.ts:39-47` manggil
  `executeAIRequest` (draft AI, berpotensi bayar) SEBELUM `generateSpeech` dipanggil
  (baris 50). Cek kapabilitas TTS (`mediaCapabilities().audio`, tarik dari
  `MARKETING_MEDIA_TTS_ENABLED` di `media-catalog.ts:18`) baru terjadi DI DALAM
  `generateSpeech` (`media-provider.ts:103`) — sudah kelewat draft stage.
- **P4 (token limit draft gak diteruskan)** — CONFIRMED, akar PERSIS ketemu:
  `AIGenerateOptions` (ai-gateway.ts:39-49) mendeklarasikan field `maxOutputTokens`, tapi
  destructuring di `executeAIRequest` (baris 395-404) TIDAK PERNAH extract field itu —
  langsung didrop diam-diam. Tidak satupun dari `callGroq`/`callOpenAI`/`callOpenCode`/
  `callGemini`/`callEmergent` menerima atau meneruskan token-limit apapun ke body request
  provider. Route sudah kirim `maxOutputTokens: 1800` (route.ts:43) — parameter itu mati
  begitu masuk gateway.
- **P5 (retry voiceover pakai prompt lama, bukan draftScript)** — CONFIRMED, persis di
  `StudioResult.tsx:111`: tombol retry manggil `onRetry(message.submission!)` — objek
  submission ASLI yang tersimpan, tidak pernah merujuk `message.draftScript` (yang
  cuma ditampilkan read-only di baris 88, gak pernah dipakai ulang).
- **P6 (transcript hilang saat chat busy)** — CONFIRMED,
  `MarketingAIAssistantView.tsx:1142`: `handleSendMessage` early-return dengan toast
  kalau `requestsInFlight.current.has(targetChatId)` — teks yang mau dikirim (termasuk
  transcript hasil edit dari recorder) tidak disimpan/di-queue di manapun, langsung hilang.
- **P7 (source Quiz/Flashcard salah prioritas)** — CONFIRMED,
  `MarketingAIAssistantView.tsx:1088-1094` fungsi `openStudio`: urutan prioritas source
  persis `attachmentText || riwayat-chat-8-terakhir || text(composer)` — teks composer
  ada di posisi PALING RENDAH, kebalikan dari yang seharusnya (composer harus tertinggi
  khusus untuk kind quiz/flashcard).
- **P8 (belum ada credit/rate guard di media routes)** — CONFIRMED,
  `media-http.ts` (`withMediaGuard`, baris 12-41) cuma cek JWT/origin/workspace-membership/
  minimum-role — nol logic credit-consumption atau rate-limiting di mana pun di file ini
  atau di routes yang memakainya.
- **P9 (smoke report caveat)** — TIDAK di-deep-verify (soal artifact test/tooling,
  bukan source produk inti); diambil apa adanya dari klaim Codex, prioritas paling rendah.

**Kesimpulan scan**: 8 dari 9 temuan Codex terverifikasi akurat dan presisi (dia jujur,
bukan halu) — cuma P1 sedikit kurang-mengerikan dari deskripsi karena sudah ada guard
`deterministic_fallback` di kedua caller. Semua lokasi di atas siap langsung dieksekusi
Fable tanpa perlu scan ulang dari nol. Belum ada satupun file source yang diubah sesi ini.

## Checkpoint Claude Code (Fable 5.1) — eksekusi fix P1–P9, 5 September 2026 siang

Mekanisme: 1 Workflow smart-dispatch, 11 agent (5 build per-kelompok file DISJOINT, 5
refuter adversarial, 1 integration gate), semua kelompok lolos refuter di percobaan
pertama. Lalu diverifikasi ULANG oleh Claude utama dengan command sendiri (M-823), plus
2 panggilan live kecil ke OpenRouter (text, ~USD 0.00x) untuk membuktikan adapter P1
beneran jalan, bukan cuma lolos mock. TIDAK ada push. Lane Fatur (auth.ts, tenant-guard.ts,
prisma/, .env) TIDAK tersentuh (dicek `git status | grep` = kosong).

Format bukti mengikuti Section G:

```text
ITEM: P1 OpenRouter text adapter
FILES: src/lib/ai-gateway.ts (+192/-x), tests/ai-gateway-routing.test.ts (baru)
FLOW: branch baru setelah Groq sebelum OpenCode, key OPENROUTER_API_KEY (placeholder
      ditolak), model OPENROUTER_TEXT_MODEL || google/gemini-3.5-flash; 'deep' ->
      OPENROUTER_TEXT_MODEL_DEEP || deepseek/deepseek-r1 (keduanya dicek ADA di katalog
      OR 5 Sep, 431 model); jsonMode -> response_format json_object; timeout 120s.
EXPECTED: OpenRouter-only config -> provider 'openrouter', bukan deterministic_fallback
ACTUAL: unit PASS (mock); LIVE: provider=openrouter model=google/gemini-3.5-flash
        1987ms, maxOutputTokens 300 -> json {"ok":true,"kota":"Jakarta"} PASS
PROVIDER + MODEL: openrouter / google/gemini-3.5-flash
COST METADATA: OR tidak mengembalikan cost di chat response; 2 call pendek (< 1 sen)
STATUS: PASS
REMAINING RISK: (a) gemini-3.5-flash di OR = model reasoning: maxOutputTokens KECIL
  (uji: 60) termakan reasoning -> output terpotong ("Here is"), json null. Route draft
  pakai 1800 = aman; caller lain JANGAN pasang budget < ~200. (b) urutan cascade:
  OpenRouter hanya dicapai kalau Emergent/Groq tidak ada key valid (sesuai spek).
  (c) getWorkspacePlan (lane Fatur) melempar Prisma P2023 untuk workspaceId non-UUID
  — sudah tertangkap & cascade lanjut; bukan dari perubahan ini.

ITEM: P2 Groq retry JSON parse         FILES: ai-gateway.ts callGroq fallback branch
EXPECTED/ACTUAL: mock 429 -> 200 JSON, jsonMode -> result.json objek, modelUsed
  qwen/qwen3.8-27b. STATUS: PASS (unit, tanpa network)

ITEM: P4a maxOutputTokens diteruskan   FILES: ai-gateway.ts (semua provider)
EXPECTED/ACTUAL: body.max_tokens 1800 di Groq & OpenRouter (unit); Gemini
  generationConfig.maxOutputTokens; Emergent via withParams (diverifikasi dari tipe +
  dist library, BUKAN live). STATUS: PASS (Emergent bagian: NOT RUN live)

ITEM: P3 cek TTS sebelum draft         FILES: src/app/api/v1/media/generate/route.ts
EXPECTED/ACTUAL: MARKETING_MEDIA_TTS_ENABLED=false -> executeAIRequest 0 call (dibuktikan
  lewat side-effect: tidak ada prisma subscription.findUnique & 0 fetch provider) ->
  NO_PROVIDER 503. STATUS: PASS. Catatan perilaku: flag false kini juga memblokir
  pembuatan naskah dari brief (disengaja, sesuai spek).

ITEM: P4b draft > 6000 tidak masuk TTS FILES: route.ts
EXPECTED/ACTUAL: draft 6500 char -> generateSpeech tidak dipanggil, response 400
  INVALID_INPUT + data.status script-ready + script utuh. Boundary 6000 lolos ke TTS.
  STATUS: PASS

ITEM: P5 retry pakai draftScript       FILES: client.ts buildRetrySubmission(), StudioResult.tsx:111
STATUS: PASS (unit helper)   ITEM: P7 composer > attachment > history untuk quiz/flashcard
FILES: client.ts resolveStudioSource(), MarketingAIAssistantView.tsx openStudio   STATUS: PASS (unit)
ITEM: P6 antrian kirim saat chat busy  FILES: client.ts createSendQueue(), View.tsx
  handleSendMessage + finally handleSendMessage/submitStudio (flush tepat sekali)
STATUS: PASS (unit helper + tsc). REMAINING RISK: wiring React (setTimeout(0) + ref)
  hanya dicek tsc, BELUM dicek di browser nyata -> cek manual: kirim saat busy ->
  toast "Disimpan..." -> terkirim otomatis setelah balasan aktif selesai.

ITEM: P8 idempotency + rate limit (INTERIM) FILES: src/lib/media-http.ts, tests/media-guard.test.ts
FLOW: POST saja. Idempotency-Key (1-200 char) -> coalescing in-flight (handler 1x) +
  snapshot 2xx TTL MEDIA_IDEMPOTENCY_TTL_MS (default 5 mnt), cap entri 200 / body 8 MiB.
  Rate limit sliding window per user+workspace MEDIA_RATE_LIMIT_PER_MIN (default 30,
  0=off) -> 429 RATE_LIMITED + Retry-After. State in-memory per proses.
STATUS: PASS (11 unit). REMAINING RISK: BUKAN billing/credit — tidak lintas instance
  (Vercel/replica), reset saat cold start. Keputusan credit ledger tetap lane Fatur.

ITEM: P9 smoke report run isolation    FILES: scripts/smoke-marketing-media.ts
STATUS: PASS (tsc + review diff; --live NOT RUN, berbayar). previousRun disimpan terpisah.

INTEGRATION: npx tsc --noEmit exit 0 | unit 104/104 (69 baseline + 35 baru, 9 file) |
  npm run build PASS (66 static pages) | git diff --check PASS | secret scan: 4 match =
  fixture test (gsk_te*/sk-ope*/sk-pro*/sk-or-*), bukan key asli | lane Fatur: kosong.
BELUM (tetap BLOCKED, bukan lane ini): authenticated E2E Marketing (membership workspace
  "Akses workspace ditolak" = lane Fatur), Gemini fallback 429 kuota, GROQ_API_KEY masih
  placeholder, browser suite Playwright tidak dijalankan ulang sesi ini.
```

## Verifikasi LIVE di browser (localhost) — Claude Code (Sonnet 5), 5 September 2026 siang

Atas instruksi Mecca setelah kredit Fable reset: tes NYATA di localhost, JANGAN push,
JANGAN commit tambahan. Tidak ada file source yang diubah pada langkah ini — murni
verifikasi. Server di-restart bersih (kill proses lama port 3000 + `npm run dev` via
tracked preview) supaya yang dites benar-benar commit `1d4ef25` terbaru, bukan proses
basi dari sesi sebelumnya.

**Temuan root-cause penting (bukan bug kode, murni data):** `GET
/api/v1/media/models?kind=image` yang dilaporkan Codex gagal dengan "Akses workspace
ditolak" untuk `marketing@anitech.dev` pada "Anitech CEO's Workspace" — diverifikasi
LANGSUNG ke Neon DB (read-only, `prisma.user.count()`/`findMany`, TIDAK ada write):
user `marketing@anitech.dev` (Marketing Lead) punya **0 `memberships` dan 0
`ownedWorkspaces`** di database. Guard-nya BEKERJA BENAR (nolak user yang genuinely
bukan owner/member) — yang hilang adalah baris membership di DB, itu keputusan/kerjaan
Fatur (assign user ke workspace), BUKAN bug di `media-http.ts`.

**Metodologi verifikasi tanpa melanggar lane Fatur:** untuk membuktikan pipeline P1-P9
benar-benar jalan end-to-end (bukan cuma lolos mock), dibuat JWT test-only via
`signJwtToken()` (fungsi asli app, sudah dipakai test suite Codex sendiri) untuk user
REAL yang sudah ADA di DB dan MEMANG owner workspace (`ceo@anitech.dev`, owner
`f451b290-...` — workspace ID yang sama persis dipakai tombol demo-bypass). Token
di-set sebagai cookie browser via `document.cookie` (test-only, dihapus lagi di akhir
sesi). **Tidak ada baris DB yang ditulis/diubah** — murni membaca data yang sudah ada
dan menandatangani token dengan `JWT_SECRET` yang sudah ada di `.env`, persis proses
yang dilakukan `/api/v1/auth/login` sendiri saat user beneran login.

**Hasil LIVE, authenticated, real HTTP request ke server yang sedang berjalan (bukan
mock, bukan unit test) — dicek dua arah: response browser DAN log server:**

```text
ITEM: P1 OpenRouter text gateway -- LIVE authenticated end-to-end (dua code path)
FLOW 1 (voiceover dari brief): brief "2 kalimat promo diskon kopi akhir pekan" -> draft
  naskah (lewat executeAIRequest, text-mode) -> TTS. Server log: POST
  /api/v1/media/generate 200 15.8s. Naskah yang didapat koheren & sesuai brief ("Akhir
  pekan saatnya bersantai, yuk bikin hari kamu makin ceria dengan segelas kopi
  favoritmu!..."), audio 15 detik benar-benar termuat & bisa diputar (bukan placeholder).
FLOW 2 (notebook/kuis, jsonMode): materi "cara racik cold brew, takar 1:8, rendam 12
  jam" -> 5 soal kuis via executeAIRequest jsonMode. Server log: POST
  /api/v1/brain/notebook 200 12.9s. Opsi jawaban yang dihasilkan (1:8, 1:12, 1:5, 1:2)
  genuinely relevan ke materi, bukan template generik.
PROVIDER + MODEL: openrouter / google/gemini-3.5-flash (keduanya)
STATUS: PASS -- ini bukti paling kuat sejauh ini untuk P1: sebelumnya cuma dibuktikan
  1 live call terisolasi + unit mock; sekarang terbukti jalan lewat DUA jalur produk
  nyata (draft-untuk-TTS dan draft-untuk-JSON-terstruktur) via UI asli, auth asli.

ITEM: P7 composer > history untuk quiz -- LIVE
FLOW: chat lama isinya voiceover soal "promo diskon kopi akhir pekan"; user ketik
  materi BARU di composer soal "cara racik cold brew" lalu klik Kuis TANPA kirim
  composer-nya dulu.
EXPECTED: field "Materi sumber" studio Kuis terisi teks composer BARU, bukan riwayat
  chat lama.
ACTUAL: field "Materi sumber" persis berisi "Materi baru: cara rack cold brew 3
  langkah -- takar bubuk kopi 1:8 air, rendam 12 jam suhu ruang, saring pakai kain."
  (117 karakter, cocok persis apa yang diketik) -- riwayat chat lama TIDAK terpakai.
STATUS: PASS (screenshot diambil, bisa direproduksi)

ITEM: Image generation (bukan bagian P1-P9, existing feature) -- LIVE, 2x sukses
Server log: POST /api/v1/media/generate 200 10.0s dan 200 10.5s. Provider
openrouter/google/gemini-3.1-flash-image. Poster & banner sesuai brief, teks di
gambar terbaca jelas, tidak ada artefak/distorsi. Regresi: NOL -- masih jalan normal
setelah semua perubahan P1-P9.

ITEM: P6 antrian kirim saat busy -- INCONCLUSIVE, BUKAN FAIL
Percobaan: generate gambar (perkiraan ~10s) lalu buru-buru ketik+Enter di composer
utama sebelum selesai. Log server TIDAK menunjukkan request kedua sama sekali (bukan
di-reject, bukan di-queue-lalu-kirim -- benar-benar tidak terkirim), kemungkinan besar
klik composer meleset setelah modal ditutup (timing manual manusia vs UI, bukan bug
yang teridentifikasi). TIDAK dicoba ulang lagi (proporsionalitas biaya -- sudah 4 live
call berbayar sesi ini). STATUS TETAP: PASS di unit test (helper murni createSendQueue
sudah diverifikasi logic-nya), NOT RUN utk race-condition di browser sungguhan --
kalau butuh kepastian 100% di browser, perlu dicoba lagi dengan timing yang lebih presisi
(mis. script Playwright, bukan klik manual).

ITEM: P5 retry pakai draftScript -- NOT RUN live (unit test only, sudah PASS sebelumnya)
Alasan: perlu memaksa TTS gagal SETELAH draft sukses -- gak ada cara bersih memicu ini
live tanpa sengaja merusak sesuatu (mis. cabut network di tengah request). Dianggap
cukup terbukti oleh unit test yang sudah presisi menguji skenario ini.

BATAS SESI INI: tidak ada perubahan source/DB. Cookie JWT test-only sudah dihapus dari
browser di akhir sesi. Dev server (`klir-repo-clone-live`, port 3000) DIBIARKAN JALAN
kalau Mecca mau lihat sendiri -- bukan lupa dimatikan.
```

**Kesimpulan jujur:** P1 (jalur paling berisiko/paling banyak diubah) sekarang punya
bukti PALING KUAT di antara semua 9 temuan -- live, authenticated, dua code path
produk nyata. P7 juga confirmed live. P6/P5 masih berhenti di unit-test (bukan
kegagalan, cuma belum ada bukti browser tambahan). Membership gap Marketing Lead
dikonfirmasi sebagai murni data, bukan kode -- perlu Fatur assign user ke workspace
kalau mau dites sebagai role Marketing yang sesungguhnya (bukan lewat token test-only
milik owner seperti sesi ini).

## Audit lanjutan 5 September sore — AI Brain (Executive/Finance) + rencana perbaikan

Atas instruksi Mecca ("cek sekali lagi dari bikin dokumen video dll"): ditemukan gap
KEAMANAN sistemik di ~13 route `api/v1/brain/*` (nol auth di sebagian besar, termasuk
satu yang genuinely nulis DB tanpa login -- bikin kupon diskon) PLUS banyak elemen UI
Executive/Finance yang kelihatan jalan tapi sebenarnya palsu (file download korup,
kartu media palsu tanpa disclaimer, KPI dashboard campur data-asli-dan-karangan,
proyeksi pajak PPh/PPN 100% hardcode). Detail lengkap + rencana pembagian tugas
Fable 5.1 vs Astra 6: `2026-09-05-executive-finance-brain-audit-and-fix-plan.md`
(file terpisah, di root repo yang sama). MURNI AUDIT, tidak ada source yang diubah.

**Codex, kalau kamu baca ini buat mulai testing sekarang:** baca
`2026-09-05-codex-testing-handoff.md` (file terpisah, root repo yang sama) --
itu instruksi testing eksploratif langsung buat kamu, termasuk cara login
authenticated beneran tanpa perlu password real (localStorage demo-bypass doang
gak cukup buat lolos guard server).

## Checkpoint Codex — testing eksploratif Marketing setelah P1–P9 — 5 September 2026

Scope sesi ini: **testing/verifikasi saja**. Tidak ada perubahan source product,
tidak ada commit/push, dan tidak ada write ke database. Browser yang dipakai adalah
Chrome visible pada `http://localhost:3000/`; dev server tetap hidup.

### Setup auth dan batasan aktual

- DB dibaca read-only untuk memastikan akun owner yang sudah ada:
  `ceo@anitech.dev` → user ID terverifikasi; workspace owner
  `f451b290-1fc6-474d-8787-b8f1121c798b` = `Anitech CEO's Workspace`.
- Marketing Lead tetap terverifikasi punya 0 membership dan 0 owned workspace.
  Ini data assignment lane Fatur, bukan bug guard.
- JWT test-only dibuat memakai `signJwtToken()` asli dengan `JWT_SECRET` yang diparse
  dari `.env`; token tidak ditulis ke file atau DB.
- Cookie tidak berhasil diinjeksi ke tab Chrome melalui surface browser yang tersedia:
  `javascript:` navigation diblokir policy dan evaluasi halaman bersifat read-only.
  Akibatnya, UI browser tetap berada pada demo-local state Marketing Lead dan studio
  media menampilkan `Sesi login tidak valid`; ini blocker tool/session-injection,
  bukan bukti provider rusak.
- Untuk memisahkan blocker browser dari backend, request authenticated dilakukan
  langsung ke localhost dengan JWT yang sama. Binary tidak didump ke chat.

### Hasil browser eksploratif

```text
ITEM: Marketing AI Assistant — open studio controls
FLOW: buka AI Assistant Marketing → Gambar / Voiceover / Video / Kuis / Flashcard /
      Rekam suara
EXPECTED: state UI jujur dan control tidak berpura-pura ready tanpa sesi server.
ACTUAL: semua studio menampilkan `Sesi login tidak valid atau kedaluwarsa`.
        Gambar/Kuis/Flashcard/rekam disabled; Voiceover disabled pada generate/voice;
        recorder Start disabled. Video menampilkan `Segera` dan menjelaskan status
        check tidak memanggil provider video.
STATUS: PASS untuk fail-closed UI; authenticated browser E2E BLOCKED oleh cookie
        injection yang tidak tersedia.

ITEM: P7 composer > source untuk Quiz + Flashcard
FLOW: isi composer dengan materi baru `cold brew 1:8, rendam 12 jam, saring` lalu
      buka Kuis dan Flashcard tanpa mengirim composer.
EXPECTED: materi baru composer, bukan riwayat chat.
ACTUAL: kedua dialog mengisi field sumber persis dengan materi baru (68 karakter).
STATUS: PASS LIVE browser.

ITEM: Voiceover source inheritance
FLOW: materi baru yang sama → buka Voiceover.
EXPECTED/ACTUAL: script field mewarisi materi composer terbaru; mode default
      `Saya punya script — bacakan persis` terlihat jelas. STATUS: PASS UI source;
      provider execution BLOCKED oleh sesi browser.

ITEM: Transcript edit sebelum kirim
FLOW: buka recorder → isi manual `Transcript awal KLIR yang diedit sebelum dikirim.`
EXPECTED/ACTUAL: field mempertahankan teks hasil edit dan tombol `Kirim transcript
      ke chat asal` menjadi enabled. Tidak dikirim untuk menghindari request chat
      tambahan ketika sesi browser belum authenticated. STATUS: PARTIAL — edit UI PASS,
      transcribe + send E2E NOT RUN.

ITEM: Video planned honesty
FLOW: buka `Video · Segera`.
EXPECTED/ACTUAL: UI menyatakan render otomatis segera, storyboard DOCX tersedia,
      dan pengecekan status tidak memanggil provider video. STATUS: PASS; tombol
      storyboard tidak dijalankan karena itu jalur generation tambahan yang tidak
      dibutuhkan untuk regresi ini.

ITEM: Bug-pattern scan dari Executive/Finance pada Marketing
FLOW: dashboard Marketing + AI Assistant dibaca sebagai user nyata.
ACTUAL: dashboard secara eksplisit memberi label `Contoh tampilan`, galeri memberi
      `Thumbnail placeholder untuk kebutuhan mockup`, dan rekomendasi memberi
      `Tampilan contoh untuk kebutuhan mockup`. Ini mencegah klaim bahwa thumbnail
      seed adalah hasil AI nyata.
      Tidak ada kartu hasil media authenticated yang bisa diamati di browser karena
      session blocker. Tombol bisnis seperti `Terapkan pemindahan budget`,
      `Luncurkan kampanye sekarang`, dan `Simpan draf` tidak diklik: bisa menjadi
      aksi domain/write dan instruksi sesi melarang DB write.
STATUS: DISCLAIMER CHECK PASS untuk konten mockup yang terlihat; Office-seed
        download dan hardcoded business action NOT EXECUTED; semua kartu hasil
        authenticated NOT RUN.
```

### Hasil authenticated localhost route (JWT CEO test-only, tanpa DB write)

```text
ITEM: Anonymous media guard
FLOW: 2x POST identik `/api/v1/media/generate` + GET `/api/v1/media/models?kind=image`
      tanpa cookie.
ACTUAL: seluruhnya HTTP 401 `AUTH_REQUIRED`, pesan jelas; tidak ada provider call.
STATUS: PASS.

ITEM: Model catalog authenticated
ACTUAL: GET catalog dengan JWT CEO + workspace owner → HTTP 200, model OpenRouter
        image terdaftar. STATUS: PASS.

ITEM: Image generation authenticated
FLOW: max 2 live calls pada sesi; prompt poster cold brew, model
      `google/gemini-3.1-flash-image`.
ACTUAL: HTTP 200, `success:true`, `status:ready`, `mimeType:image/jpeg`,
        `provider:openrouter`, `modelUsed:google/gemini-3.1-flash-image`, dataUrl
        JPEG hadir. Satu response melaporkan usage `costUsd:0.06827`.
STATUS: PASS LIVE route; bukan browser UI E2E.

ITEM: Voiceover generation authenticated
FLOW: script eksplisit pendek; satu provider call berhasil.
ACTUAL: HTTP 200, `success:true`, `status:ready`, `mimeType:audio/mpeg`,
        dataUrl audio hadir, `provider:openrouter`,
        `modelUsed:google/gemini-3.1-flash-tts-preview`, `scriptDrafted:false`.
STATUS: PASS LIVE route; bukan browser UI E2E.

ITEM: Quiz generation authenticated
FLOW: materi cold brew baru, count=3, difficulty=medium.
ACTUAL: HTTP 200, provider OpenRouter / `google/gemini-3.5-flash`, payload berisi
        3 pertanyaan relevan; response contract memakai `payload.questions`.
STATUS: PASS LIVE route; bukan browser UI E2E.

ITEM: P8 idempotency
FLOW: 2 POST audio identik paralel dengan Idempotency-Key yang sama, lalu 1 replay
      setelah selesai.
ACTUAL: dua request awal sama-sama HTTP 200 ready dengan dataUrl audio identik;
        replay berikutnya HTTP 200 dalam 244 ms dengan header
        `Idempotency-Replayed: replayed`. Behavior coalescing + TTL replay PASS;
        provider-call count tidak diinstrumentasi langsung.
STATUS: PASS behaviorally.

ITEM: P8 rate limit
FLOW: tidak mengirim >30 request live.
REASON: guard menghitung eksekusi provider nyata; bulk probe akan menjadi spam/cost
        dan tidak proporsional dengan batas 1–2 generate per fitur.
STATUS: NOT RUN LIVE; unit evidence sebelumnya tetap PASS. Billing/credit guard
        lintas instance tetap belum dibuktikan.
```

### Kesimpulan checkpoint

```text
REGRESI UI/source precedence       ✅ PASS (browser)
Video planned no-provider claim    ✅ PASS (browser)
Anonymous media fail-closed        ✅ PASS (HTTP 401)
Authenticated image                ✅ PASS (live route)
Authenticated voiceover            ✅ PASS (live route)
Authenticated quiz                 ✅ PASS (live route)
Idempotency replay/coalescing       ✅ PASS (live route)
Recorder physical mic + STT send    ⚠️ BLOCKED/PARTIAL (browser cookie)
Office seed download                ⚠️ NOT RUN
Marketing business-action hardcode  ⚠️ NOT EXECUTED (write-risk)
Rate-limit >30 live                 ⚠️ NOT RUN (provider spam/cost)
Browser authenticated E2E            ⚠️ BLOCKED (cookie injection surface)
```

Tidak ada klaim bahwa seluruh P1–P9 production acceptance lulus. Jalur backend
authenticated image/audio/quiz terbukti hidup; gap tersisa adalah browser session
injection/authenticated UI acceptance, physical mic flow, Office-seed inspection,
dan rate-limit burst test.

### Worktree note setelah checkpoint

Setelah testing dimulai, muncul perubahan uncommitted pada 10 route
`src/app/api/v1/brain/*` dan tiga test guard (`tests/brain-*-guard.test.ts`).
Perubahan tersebut tidak dibuat, distage, atau diverifikasi oleh sesi testing ini;
kemungkinan berasal dari lane Claude/Fable yang berjalan concurrent. Jangan
mengatribusikan perubahan itu ke Codex exploratory QA, dan jangan reset/menimpa
worktree tersebut.

## Checkpoint Claude Code (Sonnet 5) -- P0 auth-guard fix pada 10 route brain/* (5 Sep 2026 sore)

Konfirmasi: perubahan uncommitted yang disebut Codex di atas MEMANG dari sesi ini
(Workflow `wf_9a0ea663-60b`, 13 agent, ~2.16 juta token, 316 tool call, ~34 menit).
Tugas: wire `authenticateTenantRequest`/`withTenantGuard` (`src/lib/tenant-guard.ts`)
ke 10 route `api/v1/brain/*` yang audit 5 September (lihat file
`2026-09-05-executive-finance-brain-audit-and-fix-plan.md`, Section A) temukan TANPA
autentikasi sama sekali. Pola arsitektur: 4 kelompok build paralel (file disjoint) +
refuter/verifier independen per kelompok (retry max 3x) + 1 integration-gate di akhir.
Semua sub-agent dipaksa model Sonnet (aturan standing project ini, model orchestrator
tidak relevan).

### Hasil integrasi (level kode)

```text
tsc --noEmit     : PASS (exit 0, zero error)
next build       : PASS ("Compiled successfully in 2.5s", 66/66 page gen,
                   semua 10 route brain/* muncul dynamic (f) di route table)
unit test        : 135 total -> 130 PASS / 0 FAIL / 5 TODO (didokumentasikan, lihat
                   bawah) -- PERLU flag `--experimental-test-module-mocks` karena
                   salah satu test file pakai node:test mock.module(); Node v25.2.1
                   TIDAK mengaktifkan itu secara default. Command lengkap yang benar:
                   `node --experimental-test-module-mocks --import tsx --test <file>`
diff scope check : PASS -- tenant-guard.ts, auth.ts, prisma/**, .env TIDAK muncul di
                   diff manapun (dicek git status --short + git diff --name-only,
                   dikonfirmasi 2x: oleh integration-gate agent DAN independen oleh
                   saya sendiri di luar Workflow)
git commit/push   : TIDAK dilakukan (sesuai batasan tugas)
```

### Hasil keamanan per kelompok -- INI YANG PALING PENTING, bukan cuma PASS/FAIL kode

```text
KELOMPOK A (generate, chat)     -- TERTUTUP PENUH terhadap anonymous caller
KELOMPOK D (execute)            -- TERTUTUP PENUH terhadap anonymous caller
KELOMPOK B (context, simulate)  -- TERTUTUP untuk targeted IDOR (spoof workspace
                                    spesifik via body/header/query = 403), TAPI
                                    caller TANPA token sama sekali + TANPA hint
                                    workspace apapun tetap dapat data (workspace
                                    "default" hasil fallback tenant-guard.ts,
                                    bukan pilihan attacker -- residual leak, bukan
                                    IDOR terarah)
KELOMPOK C (nudges, alerts,     -- MASIH BOLONG PENUH: caller TANPA token sama
  recommendations,                 sekali + header x-workspace-id ke ID workspace
  decision-memory, data-trust)     APAPUN yang ada di database -> HTTP 200 + data
                                    workspace itu. Dibuktikan lewat 5 test yang
                                    SENGAJA dibiarkan gagal (node:test todo() +
                                    alasan tertulis inline), bukan dipoles hijau.
```

**Akar penyebab tunggal, di luar 10 file yang diedit sesi ini** --
`src/lib/tenant-guard.ts:176`:
```ts
const isOwner = workspace.ownerId === user.id || user.isSuperAdmin || !token;
```
`!token` membuat caller TANPA token otomatis dianggap OWNER. Ini SUDAH
didokumentasikan sebagai temuan terpisah ("A-tambahan") di audit 5 September,
SEBELUM Workflow ini mulai -- setiap kelompok build/verify menemukan ulang bug yang
sama secara independen dan konsisten TIDAK menyentuhnya (di luar scope, dilarang
oleh aturan project ini menyentuh core-auth tanpa keputusan Fatur/Mecca eksplisit).

**Kenapa hasilnya gak seragam across 10 route**: kelompok A dan D melakukan
DEVIASI TERDOKUMENTASI dari instruksi literal -- mereka menambah 1 baris
`extractTokenFromRequest(req)` manual SEBELUM memanggil guard bersama, menutup
celah `!token` UNTUK ROUTE MEREKA SENDIRI tanpa mengubah tenant-guard.ts. Kelompok
B dan C mengikuti instruksi literal apa adanya ("wire ke pola yang sama seperti
`credits/route.ts`") -- dan pola itu SENDIRI masih membawa bug `!token` bawaan.
Artinya: task asli ("samakan 10 route dengan credits/route.ts") TERCAPAI 100% untuk
semua 10 route: IDOR/cross-tenant spoofing lewat body/header/query ke workspace
SPESIFIK sekarang ditolak di SEMUA 10 route (ini closure inti dari audit 5
September). Tapi task itu TIDAK PERNAH menutup akses anonim-total, karena
`credits/route.ts` sendiri (contoh pola "benar" yang jadi acuan) juga rentan.

### Keputusan yang butuh Fatur/Mecca (bukan diputuskan sepihak sesi ini)

1. Tambal `tenant-guard.ts:176` (hapus/perbaiki `|| !token`) -- ini akan menutup
   celah di SEMUA pemanggil fungsi ini sekaligus, termasuk `credits/route.ts`,
   bukan cuma 10 route brain/*. Risiko: core-auth file, butuh review lebih hati-hati.
2. Atau, sambil menunda #1: terapkan pola pre-check token manual (yang sudah
   dipakai kelompok A & D) ke 7 route sisanya (context, simulate, nudges, alerts,
   recommendations, decision-memory, data-trust) sebagai tambalan sementara yang
   tidak menyentuh tenant-guard.ts.
3. `brain/execute`'s `minRole: 'MANAGER'` (kelompok D) adalah default KONSERVATIF
   sementara untuk aksi `SCALE_MARKETING` (real write promoCoupon) -- perlu
   konfirmasi role final yang tepat (MANAGER cukup? perlu ADMIN/OWNER? perlu
   approval terpisah di luar role-check biasa?).

### File yang berubah (evidence)

```text
src/app/api/v1/brain/alerts/route.ts
src/app/api/v1/brain/chat/route.ts
src/app/api/v1/brain/context/route.ts
src/app/api/v1/brain/data-trust/route.ts
src/app/api/v1/brain/decision-memory/route.ts
src/app/api/v1/brain/execute/route.ts
src/app/api/v1/brain/generate/route.ts
src/app/api/v1/brain/nudges/route.ts
src/app/api/v1/brain/recommendations/route.ts
src/app/api/v1/brain/simulate/route.ts
tests/brain-generate-chat-guard.test.ts   (baru)
tests/brain-context-simulate-guard.test.ts (baru)
tests/brain-readonly-guard.test.ts         (baru)
tests/brain-execute-guard.test.ts          (baru)
```

Detail penuh per-kelompok (fixes, business_decisions_flagged, remaining_risk) ada di
journal Workflow: `subagents/workflows/wf_9a0ea663-60b/journal.jsonl` (bukan bagian
repo ini, di direktori sesi Claude Code lokal Mecca). Belum ada commit/push --
worktree ini masih berisi seluruh perubahan di atas sebagai uncommitted, menunggu
keputusan Fatur/Mecca soal item di atas sebelum di-commit.

## Checkpoint Codex — audit ulang branch `claude/ai-brain-upgrade-1sep` (2026-09-05)

Audit ini dijalankan ulang dari working tree lokal yang sama. Folder Antigravity tidak disentuh. Tidak ada source code yang diubah oleh audit ini; perubahan yang ditulis hanya checkpoint ini.

### 1. Typecheck dan production build

```text
npx tsc --noEmit
exit code 0
(tidak ada output)
```

Status: PASS.

```text
npx next build
Next.js 16.3.1 (Turbopack)
Compiled successfully in 4.2s
TypeScript finished in 8.2s
66/66 static pages generated
exit code 0
```

Warning yang muncul, tetapi tidak menggagalkan build:

```text
(node:8668) Warning: --localstorage-file was provided without a valid path
(node:17540) Warning: --localstorage-file was provided without a valid path
(node:39100) Warning: --localstorage-file was provided without a valid path
```

Semua route termasuk 10 route `api/v1/brain/*` ter-build. Warning localStorage tetap perlu ditelusuri karena path runtime-nya invalid.

### 2. P0 auth-guard regression test

Perintah persis:

```text
node --experimental-test-module-mocks --import tsx --test tests/brain-generate-chat-guard.test.ts tests/brain-context-simulate-guard.test.ts tests/brain-readonly-guard.test.ts tests/brain-execute-guard.test.ts
```

Ringkasan output:

```text
tests 31
suites 9
pass 26
fail 0
cancelled 0
skipped 0
todo 5
exit code 0
```

Hasil persis sesuai klaim handoff: 26 pass, 0 fail, 5 todo. Lima todo mendokumentasikan celah yang sudah diketahui pada kelompok readonly: request anonim dengan `x-workspace-id` dapat menembus sebagian route karena `tenant-guard.ts` masih memiliki kondisi `|| !token` pada penentuan owner. Ini risk yang belum selesai, walaupun test runner melaporkannya sebagai todo.

Ada warning mock Prisma non-fatal untuk operasi `memoryItem.findMany`, `cashTransaction.findMany`, dan `invoice.findFirst`. Itu noise mocking test, bukan failure produksi yang terbukti.

### 3. Live company-memory: upload → database → brain chat

Dev server yang dipakai adalah server lokal repo yang sudah berjalan di `http://127.0.0.1:3000`; percobaan start kedua tidak mengambil alih atau mematikan server tersebut.

Dokumen uji memakai fakta unik:

```text
KOPI-NEBULA-7842 adalah usaha minuman cold brew berbasis langganan di Bandung.
Produk utama: Nebula Cold Brew 250 ml dengan rasio seduh 1:8 dan target pasar
pekerja remote. Tantangan utama adalah retensi pelanggan setelah bulan pertama.
```

Upload `POST /api/v1/documents/analyze` dengan JWT tenant valid:

```text
HTTP 200
success: true
fileName: profil-kopi-nebula.txt
contentLength: 236
provider: groq
modelUsed: openai/gpt-oss-120b
latencyMs: 1762
```

Response analysis memuat `KOPI-NEBULA-7842`, `Nebula Cold Brew 250 ml`, Bandung, pekerja remote, rasio seduh 1:8, dan masalah retensi bulan pertama.

Verifikasi database read-only menemukan satu baris `MemoryItem`:

```text
id: db62ff0f-7732-4d70-bf59-6fb205ad013d
scope: WORKSPACE
source: profil-kopi-nebula.txt
content prefix: [COMPANY_KNOWLEDGE] source="profil-kopi-nebula.txt" | facts: {"analysis":{"name":"KOPI-NEBULA-7842",...}
```

Request berikutnya `POST /api/v1/brain/chat` pada workspace yang sama juga HTTP 200 dan menghasilkan:

```text
**Nama usaha:** KOPI‑NEBULA‑7842
**Produk utama:** Nebula Cold Brew 250 ml (rasio seduh 1:8)
**Target pasar:** Pekerja remote (B2B & UKM modern)
```

Kesimpulan teknis: plumbing company-memory terbukti live end-to-end—upload berhasil, row tersimpan, dan request chat berikutnya membaca fakta baru. Caveat: nama usaha memakai non-breaking hyphen sehingga perbandingan string ASCII mentah tidak match, walaupun faktanya sama; model juga menambahkan klaim `B2B & UKM modern` yang tidak ada di dokumen. Persistence/context injection terbukti, tetapi strict grounding belum sempurna.

### 4. Anonymous auth probe independen

Request tanpa header `Authorization` ke salah satu route brain:

```text
POST http://127.0.0.1:3000/api/v1/brain/generate
body: {"type":"word","brief":"anonymous auth probe"}
```

Response nyata:

```text
HTTP 401
{"success":false,"message":"Autentikasi diperlukan untuk membuat dokumen."}
```

Status: PASS untuk route `brain/generate`; guard route tersebut masih aktif setelah perubahan branch.

### Kesimpulan audit

Core build dan jalur company-memory yang diuji sudah bekerja: typecheck PASS, build PASS, guard suite PASS sesuai angka handoff, upload-to-MemoryItem-to-chat terbukti live, dan route generate anonim ditolak HTTP 401.

Paket ini belum boleh dinyatakan sepenuhnya siap untuk integrasi produksi karena:

1. Lima test todo tetap menunjukkan celah bypass saat token kosong dan `x-workspace-id` diberikan; kondisi `|| !token` di `tenant-guard.ts` perlu diperbaiki dan todo diubah menjadi assertion aktif.
2. Jawaban company-memory dapat menambahkan detail yang tidak didukung sumber (`B2B & UKM modern`); perlu kontrak grounding/citation atau validasi output sebelum klaim factual dianggap bukti kuat.

Verdict audit: **fungsi inti lulus verifikasi, tetapi security gap readonly dan kualitas grounding masih harus ditutup sebelum integrasi berikutnya dianggap production-ready.**

## Checkpoint Codex — retest perbaikan company-memory (2026-09-06)

Retest ini dijalankan pada working tree branch `claude/ai-brain-upgrade-1sep`.
Folder Antigravity tidak disentuh. Source code tidak diubah; checkpoint ini
adalah satu-satunya file yang ditulis oleh audit ini.

Catatan konteks: pada bagian paling bawah file ini tidak ada checkpoint baru dari
Claude setelah checkpoint Codex 2026-09-05. Namun source working tree memang sudah
memuat perubahan yang diklaim: `getRecentMistakeCorrections()` sudah tidak ada,
grounding note ditempatkan tepat sebelum blok company-memory, dan komentar route
menjelaskan bahwa koreksi/kesalahan sengaja tidak diappend dua kali.

### 1. Live upload → MemoryItem → chat dengan dokumen independen

Fakta unik yang dikirim ke `POST /api/v1/documents/analyze`:

```text
ORBIT-KERUPUK-5519 adalah usaha kerupuk rumput laut rumahan di Yogyakarta.
Produk tunggalnya Kerupuk Lembayung 80 gram. Dokumen hanya menyebut target
pembeli sebagai warga sekitar kampus. Tidak ada informasi tentang B2B, UKM,
segmen industri, atau klasifikasi bisnis.
```

Hasil upload live:

```text
HTTP 200
success: true
fileName: profil-orbit-5519.txt
contentLength: 267
provider: groq
modelUsed: openai/gpt-oss-120b
latencyMs: 1645
```

Analisis live mengembalikan fakta inti yang sesuai: nama `ORBIT-KERUPUK-5519`,
produk `Kerupuk Lembayung 80 gram`, Yogyakarta, dan target `Warga sekitar
kampus`.

Request berikutnya ke `POST /api/v1/brain/chat` pada workspace yang sama memakai
instruksi agar hanya mengembalikan nama, produk tunggal, dan target pembeli.
Response live:

```text
HTTP 200
**ORBIT‑KERUPUK‑5519**
Kerupuk Lembayung 80 gram
warga sekitar kampus
```

Pemeriksaan otomatis terhadap body response menghasilkan:

```text
hasUniqueName: true
hasProduct: true
hasBuyer: true
hasUnsupportedB2B: false
hasUnsupportedUKM: false
hasUnsupportedIndustry: false
hasUnsupportedClassification: false
```

Untuk sampel independen ini, grounding note yang dipindah ke posisi yang benar
berhasil mencegah pengulangan klaim seperti `B2B & UKM modern`. Berbeda dengan
retest sebelumnya, model tidak menambahkan kategori atau klasifikasi bisnis.

### 2. Verifikasi database read-only

Pembacaan read-only ke `MemoryItem` untuk workspace yang sama menemukan row
company-memory baru:

```text
id: be9180a6-937d-468e-b28f-6b329bdca181
source: profil-orbit-5519.txt
content prefix: [COMPANY_KNOWLEDGE] source="profil-orbit-5519.txt" | facts: {"analysis":{"name":"ORBIT-KERUPUK-5519",...}
```

Pembacaan read-only terpisah untuk `[BRAIN_MISTAKE]` menghasilkan:

```text
queryMode: read-only
workspaceId: f451b290-1fc6-474d-8787-b8f1121c798b
brainMistakeRowCount: 0
rows: []
```

Karena tidak ada row koreksi pada workspace ini, database tidak menyediakan dua
copy row yang bisa dibandingkan. Jadi bukti jalur tunggal berasal dari gabungan
query DB read-only dan audit static source:

```text
src/app/api/v1/brain/chat/route.ts:96
pastMistakes = await prisma.memoryItem.findMany({
  ... content: { startsWith: '[BRAIN_MISTAKE]' }
})
```

`rg` menemukan hanya satu query aktif yang membaca `[BRAIN_MISTAKE]`, yaitu query
`pastMistakes` di `brain/chat/route.ts`. `src/lib/ai-brain/company-memory.ts`
memang masih menyimpan konstanta `BRAIN_MISTAKE_TAG` dan komentar sejarah, tetapi
tidak memiliki fungsi/query kedua untuk membaca koreksi. Query `findMany` di file
itu hanya untuk `[COMPANY_KNOWLEDGE]`. Hasilnya konsisten dengan klaim bahwa jalur
duplikat sudah dibuang.

### Kesimpulan retest

**Untuk skenario live independen ini, instruksi grounding sekarang berhasil:**
nama, produk, dan target pembeli dikembalikan dari fakta sumber; tidak ada
`B2B`, `UKM`, `industri`, atau `klasifikasi` tambahan. Bug jalur baca koreksi
juga tidak lagi terlihat sebagai query kedua: hanya route `brain/chat` yang
membaca `[BRAIN_MISTAKE]`.

Namun ini belum merupakan jaminan matematis untuk semua input. Grounding masih
berbasis instruksi prompt, bukan validator output yang membandingkan klaim model
dengan fakta tersimpan. Model tetap secara teori bisa melanggar instruksi pada
prompt lain, konteks ambigu, atau output yang lebih panjang. Jika standar yang
diinginkan adalah pencegahan keras sebelum integrasi produksi, langkah berikutnya
adalah menambahkan fact/citation validator atau structured output contract.

Verdict: **perbaikan yang diuji genuinely memperbaiki kasus B2B kemarin dan lulus
retest live, tetapi masih ada celah residual karena grounding belum enforced oleh
validator programatik.**

## STATUS PENTING (ditegaskan Mecca 2x, 6 Sep pagi) -- baca SEBELUM checkpoint di bawah

Kerjaan ledger-parser di bawah ini adalah WADAH, BUKAN hasil final terintegrasi.
Fatur baru push SEBAGIAN kerjaannya tanggal 5 Sep -- sisanya masih dia kerjakan,
rencana push siang 6 Sep. Modul di bawah teruji standalone ke data asli Pak Fajrul,
tapi BELUM dicocokkan ke struktur/schema final yang Fatur pegang di sisa pushnya.
JANGAN commit apapun ini sebagai "selesai terintegrasi". JANGAN push ke GitHub
sampai Fatur push + Mecca kasih gas eksplisit. Begitu Fatur push, wadah ini perlu
dicek ulang dan mungkin disesuaikan -- bukan diasumsikan langsung nyambung.

## Checkpoint Claude Code (Fable 5.1 komando, agent Sonnet) -- eksekusi roadmap ledger-parser FASE 1-4 (6 Sep 2026 dini hari)

Roadmap: `KLIR/05-DOKUMEN/aktif/2026-09-06-roadmap-analisis-data-enterprise-anti-halusinasi.md`.
Dieksekusi lewat smart-dispatch Workflow `wf_3fdb1026-29b` (10 agent Sonnet: 3 scan
paralel, build A/B paralel + verifier adversarial per kelompok, wiring, integration
gate; A dan B lolos verify percobaan pertama) + 2 tambalan manual komando setelah
bukti ke file asli. ~2.0 juta token subagent, 53 menit. TIDAK ada commit/push saat
Workflow jalan; commit LOKAL dibuat sesudah checkpoint ini (lihat git log), BELUM push.

### Apa yang dibangun (semua deterministik, NOL panggilan LLM di modul baru)

```text
src/lib/ai-brain/ledger-parser.ts      parseLedgerWorkbook(buffer): deteksi header
                                        otomatis, kode posting 2 blok kolom, semua
                                        sheet "kas" -> Transaction[], jadwal
                                        depresiasi/amortisasi, sheet turunan, cash flow
src/lib/ai-brain/ledger-validator.ts   validateLedger(parsed): agregasi per kode,
                                        saldo berjalan baris-per-baris, hitung ulang
                                        laba-rugi/neraca vs angka tertulis, item non-kas
                                        direkonsiliasi lewat jadwal, label-vs-hitungan,
                                        sinyal template basi, anomali tanggal,
                                        duplikat transaksi
src/lib/ai-brain/date-normalizer.ts    parseIndonesianDate (Jan`14 / 15 Oktober 2015 /
                                        dd/mm/yyyy / ISO / Excel serial / nama bulan
                                        penuh+singkat), parseReportPeriod,
                                        detectDateAnomalies (6 kelas)
src/app/api/v1/documents/analyze       xlsx yang dikenali sebagai ledger -> response
  /route.ts                             tambah `structuredLedger` + `discrepancies`,
                                        ringkasan masuk company-memory (tag lama)
src/app/api/v1/brain/chat/route.ts     kalau body.attachment.structuredLedger ada ->
                                        blok "ANGKA TERVERIFIKASI (JANGAN dihitung
                                        ulang)" + blok DISKREPANSI menggantikan teks
                                        mentah; tanpa itu = perilaku lama identik
src/lib/ai-brain/index.ts              +2 baris export
tests/ (5 file baru)                    ledger-parser, ledger-real-fixture (baca file
                                        asli, skip kalau tidak ada), date-normalizer,
                                        ledger-wiring, ledger-date-anomaly
```

### Bukti ke FILE ASLI PT Tujuh Mata Air (dijalankan komando sendiri, bukan cuma test agent)

```text
transaksi terbaca        583   (saldo akhir 1.324.000)          COCOK sheet
pendapatan (kode 25)     1.185.909.500                           COCOK
laba operasional         368.566.833,33                          COCOK
zakat 2,5%               9.214.170,83                            COCOK
laba bersih              359.352.662,50                          COCOK
neraca TA = TP           668.566.833,33 / TA-TP = 0              COCOK
diskrepansi              TEPAT 1: neraca "(12 bulan)" vs 22 kolom jadwal
                         -> typo label asli di dokumen, angka rupiahnya benar
sinyal template basi     2: bagan akun " HQQ Co." + tanggal 2003 vs laporan 2015
anomali tanggal          0 (data asli memang kronologis & bersih)
reconciled               35 item (incl. 11 kode biaya, 2 non-kas, saldo berjalan,
                         piutang, tanggal)
```

### 2 masalah yang ketahuan SETELAH Workflow declare lolos (ditambal manual komando)

1. `detectDateAnomalies()` sudah ada + 71 test, tapi TIDAK PERNAH dipanggil di jalur
   produksi (0 call site) -- temuan verifier A. Ditambal: dipanggil di validateLedger,
   hasil masuk `report.dateAnomalies` dan dicerminkan ke `discrepancies` (kind
   `date-anomaly`). Plus cek tahun wajar 1950-2100 di semua cabang tanggal 4-digit
   (typo "2104-01-03" sebelumnya lolos confidence 1 tanpa warning) + singkatan "Agst".
2. Setelah #1 dipasang, bukti ke file asli nunjukin **334 false-positive "duplicate"**:
   detektor cuma lihat tanggal, jadi transaksi berbeda di hari yang sama (normal di
   buku kas) dicap duplikat -- test sintetis TIDAK menangkap ini. Ditambal: kelas
   `duplicate` dari detektor tanggal dibuang, diganti `findDuplicateTransactions()`
   level transaksi penuh (tanggal+uraian+kode+debet+kredit identik) -> kind
   `duplicate-transaction`. Pelajaran: test sintetis lolos != aman; WAJIB jalankan ke
   fixture asli sebelum declare.

### Angka verifikasi akhir

```text
npx tsc --noEmit                       0 error
test baru (5 file)                     108 pass / 0 fail
test seluruh repo (tests/*.test.ts)    220 total / 215 pass / 0 fail / 5 todo
                                       (5 todo = gap tenant-guard.ts:176, TIDAK berubah)
next build (gate agent)                66/66, exit 0
scope diff                             prisma/schema, tenant-guard.ts, auth.ts, .env:
                                       TIDAK tersentuh; file xlsx/pdf asli TIDAK masuk repo
```

### Open questions dari agent (BUKAN diputuskan sepihak -- untuk Fatur/Mecca)

1. Sub-ledger "Rek Bank" & "piutang" BELUM diparse jadi struktur sendiri -- komponen
   saldo bank di "Kas dan Bank" belum bisa diverifikasi terpisah (cuma cek dana tunai
   <= Kas dan Bank). Kandidat FASE 1.5.
2. Parser cash flow pakai offset kolom TETAP (blok kiri idx 0-2, kanan idx 5-7) karena
   layout manual di sumber (judul "Pengeluaran" tidak sejajar datanya). Layout beda ->
   perlu penyesuaian.
3. Rentang kode pendapatan 20-27 dan rumus zakat 2,5% x laba operasional HARDCODE --
   sesuai bagan akun fixture ini. Klien dengan konvensi bagan akun lain butuh
   konfigurasi. Keputusan produk.
4. UI React BELUM mengirim `body.attachment.structuredLedger` ke /brain/chat -- plumbing
   server selesai & teruji, tapi inert di browser sampai komponen upload di-wire
   (FASE 6, setelah push Fatur; komponen React TIDAK disentuh sesi ini, sesuai aturan).
5. Cek out-of-period belum aktif: header periode ("BULAN JAN.2014 - OKT.2015") belum
   ditangkap parser ke metadata. Follow-up kecil.
6. Budget company-memory (1500 char/item, 3000 char akumulasi, top-8 kode) bisa
   kurang untuk bagan akun besar. Keputusan produk.
7. Grounding LLM tetap berbasis instruksi prompt untuk bagian NARASI; angka sendiri
   sekarang deterministik. Validator output-vs-fakta (yang disarankan Codex 6 Sep)
   belum dibangun.
