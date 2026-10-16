# KLIR Marketing Media — integrasi Codex, 4–5 September 2026

Baseline: `181c587`, branch `claude/ai-brain-upgrade-1sep`.
Lane: shared media + Marketing. Executive/Finance UI tetap Claude Code.

## Arsitektur

```text
Marketing composer / studio
  ├─ media/models → catalog capability OpenRouter (cache 5 menit)
  ├─ media/generate
  │   ├─ image → dedicated OpenRouter /images → Gemini fallback
  │   ├─ audio → OpenRouter /audio/speech → PCM bila diperlukan → MP3
  │   └─ video → planned (tanpa request video)
  ├─ media/transcribe → Groq bila key bukan placeholder → OpenRouter STT
  └─ brain/notebook → existing AI gateway → strict Zod → quiz / flashcard
Legacy ai-gateway.generateImage + brain/chat image → provider yang sama
```

## Kontrak untuk Claude

- Types client-safe: `src/lib/media-types.ts`, `src/lib/notebook-types.ts`.
- Provider server-only: `src/lib/media-provider.ts`. Jangan di-import sebagai runtime dari komponen client.
- Intent pure bersama: `src/lib/media-intent.ts`. Naskah/ide tentang gambar bukan perintah menghasilkan gambar.
- Semua endpoint baru memakai cookie HttpOnly `klir_token` / `auth_token` atau bearer JWT existing. Frontend memakai credentials same-origin.
- Target workspace dari header `x-workspace-id`, query `workspaceId`, claim sesi, atau workspace milik/member user. Tetap diverifikasi ke membership existing. Body role/workspaceId bukan otorisasi.
- Minimal MEMBER. VIEWER ditolak. Tidak ada pembuatan user/workspace, media, atau hasil belajar ke database.
- `POST /api/v1/media/generate`: request/response sesuai PRD. Image `prompt` wajib, audio `script` ATAU `prompt`. Audio brief diproses menjadi script oleh gateway terlebih dahulu; hasil menambahkan `scriptDrafted`. Script eksplisit tidak dipoles.
- Jika draft naskah berhasil tetapi TTS gagal: HTTP error tetap dikembalikan dengan `success:false`, normalized `error`, dan `data:{kind:'audio',status:'script-ready',script,scriptDrafted:true}`. Simpan naskah untuk retry; jangan render audio ready.
- Image ratio v1: `1:1`, `4:5`, `9:16`, `16:9`. Kirim hanya capability yang ada pada model. Quality/resolution/output format tidak dikirim jika tidak didukung.
- Image output actual PNG/JPEG/WebP; validasi header DAN decode raster. Jangan hardcode ekstensi PNG.
- `GET /api/v1/media/models?kind=image|audio|transcription`: `{success,data:MediaModelOption[],capabilities:{image,audio,transcription,notebook,video:false},note?}`.
- Catalog audio sengaja hanya menampilkan model configured. Tidak ada picker audio bebas; voice dan speed mengikuti descriptor lokal yang sudah dibatasi.
- `verified:true` pada catalog berarti model ditemukan dalam discovery, BUKAN jaminan kuota atau generation berhasil.
- Jika catalog gagal, image menampilkan configured default berlabel belum terverifikasi. Generate tetap memvalidasi lagi atau mencoba fallback Gemini.
- `POST /api/v1/media/transcribe`: multipart field `audio`, optional `language=id`, optional `model`. Browser mengubah rekaman menjadi WAV mono agar metadata durasi bisa diverifikasi; server tidak mempercayai field durasi browser.
- Batas audio25MiB dan120 detik (toleransi metadata0,5detik). Script TTS6000 karakter; prompt image14000; sumber notebook16000; JSON request80KB.
- `POST /api/v1/brain/notebook`: quiz2–10 (default5), flashcard2–20 (default8), source minimal10 karakter, difficulty easy/medium/hard. Output harus tepat jumlahnya. Quiz4 opsi, correctIndex0–3. ID unik, text nonempty.
- Error `{success:false,error:{code,message,retryable}}`; kode PRD ditambah AUTH_REQUIRED/ACCESS_DENIED/WORKSPACE_NOT_FOUND untuk guard. Jangan menampilkan raw error provider.
- Result media/notebook hanya state chat. Refresh tidak menjanjikan penyimpanan.
- Video `status:planned` selalu; flag live tidak dapat mengaktifkannya. Storyboard tetap memakai `video-plan` existing, bukan MP4.
- Legacy `/brain/generate` image juga mendapat guard sesi yang sama. Endpoint non-image existing tidak direfaktor.

## Konfigurasi (tidak mengubah .env)

| Nama | Default/perilaku |
|---|---|
| OPENROUTER_API_KEY | Existing server key; wajib untuk TTS |
| OPENROUTER_IMAGE_MODEL | google/gemini-3.1-flash-image |
| GEMINI_API_KEY | Cadangan image; tidak dipakai TTS/STT |
| GEMINI_IMAGE_MODEL | gemini-3.1-flash-image |
| OPENROUTER_TTS_MODEL | google/gemini-3.1-flash-tts-preview |
| OPENROUTER_TTS_VOICE | Optional voice configured; default Kore, pilihan Puck/Charon |
| GROQ_API_KEY | Placeholder tidak dianggap tersedia |
| GROQ_STT_MODEL | whisper-large-v3-turbo |
| OPENROUTER_STT_MODEL | openai/whisper-large-v3-turbo |
| MARKETING_MEDIA_IMAGE_ENABLED | false mematikan image |
| MARKETING_MEDIA_TTS_ENABLED | false mematikan TTS |
| MARKETING_MEDIA_STT_ENABLED | false mematikan STT |
| MARKETING_NOTEBOOK_ENABLED | false mematikan notebook |
| MARKETING_MEDIA_VIDEO_LIVE_ENABLED | Tidak digunakan; video selalu planned |

Flag true atau key non-placeholder berarti konfigurasi tersedia, bukan klaim provider lolos runtime.
Gemini TTS yang tersedia hanya menerima PCM; server meminta PCM24kHz16-bit mono dan meng-encode MP3 nyata. Provider tetap OpenRouter; konversi lokal bukan fallback provider.
Dependency server: music-metadata (validasi audio), sharp (decode gambar), @breezystack/lamejs (MP3 encoder, LGPL-3.0; license tetap disertakan oleh paket).

## Evidence final implementasi — 5 September 2026

- Baseline dan final TypeScript PASS; optimized production build final PASS (66 static pages).
- Unit provider23 + notebook13 + HTTP/authorization20 + intent2 + client11 =69 PASS.
- Targeted ESLint file baru/media PASS. Bukan klaim seluruh legacy source bebas lint.
- Browser suite12/12 PASS dengan seluruh API dimock: chat normal, satu image call, fallback badge, TTS recovery/player/download, recorder errors, rekaman sintetis MediaRecorder nyata, upload/transcript/edit/manual-send, video/storyboard, quiz, flashcard, perpindahan chat saat generate, mobile overflow. Ini bukan E2E authenticated production.
- Live image OpenRouter terakhir: JPEG512x512, 141923bytes, google/gemini-3.1-flash-image, 11232ms, reported cost USD0.046084. Raster decode dan visual inspection PASS.
- Live speech OpenRouter terakhir: MP3 valid110208bytes, google/gemini-3.1-flash-tts-preview, 7599ms. PCM dikonversi lokal menjadi MP3.
- Live STT OpenRouter terakhir: whisper-large-v3-turbo, audio6.888detik, 2249ms; reported cost USD0.00002293704. Naskah uji Indonesia terbaca; nama KLIR terbaca sebagai “clear”, sehingga edit transcript tetap penting.
- Live Gemini fallback: HTTP429; kuota belum tersedia. Branch fallback tetap unit-tested menggunakan mock.
- Groq live tidak dilakukan karena key placeholder. Groq primary/fallback divalidasi dengan mock.
- Keempat endpoint baru real HTTP401 tanpa token; legacy brain/chat image juga menolak anonymous. Unit HTTP memeriksa JWT/membership/workspace/Origin, body limits, dan video tanpa outbound request.
- RECHECK production5September: konfigurasi existing sekarang menunjuk Neon remote5432, TCP terbuka. Codex tidak mengubah .env. Sesi browser existing “Marketing Lead” / “Anitech CEO's Workspace” membuka panel image dan menerima “Akses workspace ditolak.” Guard sudah menemukan user dan workspace, tetapi bukan owner/member yang berhak. Hambatan terbaru adalah membership/session workspace, BUKAN lagi klaim PostgreSQL lokal mati. Tidak ada bypass auth atau perubahan DB.
- Fixture dan report lokal: ignored `build/media-smoke/`, bukan `.next/` yang dibersihkan build. Provider fixture sintetis; browser QA memakai identitas fiktif terisolasi, tanpa key.
- Smoke dibatasi panggilan pendek, tanpa bulk/retryloop. Budget ceilingUSD3; reported image+STT kumulatif dua run USD0.09210243152. TTS raw audio tidak mengembalikan biaya; angka ini BUKAN total tagihan. Runner kini menyimpan reservasi konservatif USD1/run dan berhenti sebelum reservasi mencapaiUSD3; reservasi bukan meter billing aktual. Tidak ada paid call lanjutan.

## Completion gate dan batas readiness

| Area | Implementasi / bukti | Belum terverifikasi / dependency |
|---|---|---|
| Shared provider, catalog, guard | Unit PASS; provider/model aktual; legacy image memakai layer sama | Adopsi Executive/Finance oleh Claude |
| Image | OpenRouter live PASS; UI preview/download/regenerate mock PASS | Gemini live429; sesi workspace existing403 |
| Voiceover | TTS direct live MP3 PASS; UI player/recovery mock PASS | Brief→gateway→TTS authenticated penuh belum PASS |
| Voice input | OpenRouter STT live PASS; recorder sintetis + editable transcript PASS | Groq key placeholder; mikrofon fisik tidak diuji |
| Video | Planned + storyboard UI PASS; zero outbound video call diuji | Render live sengaja bukan scope |
| Quiz / flashcard | Strict payload validation + interactive browser cards PASS | LLM notebook melalui sesi nyata belum PASS |
| Repo | tsc/build/targeted lint/diff PASS; tanpa auth/schema/.env edits | Belum push; production acceptance belum penuh |

## Verifikasi / rollout

```powershell
npx tsc --noEmit
npm run build
node --import tsx --test tests/notebook.test.ts tests/media-provider.test.ts tests/media-http.test.ts tests/media-intent.test.ts src/app/components/marketing-media/client.test.mts
# Browser: server lokal berjalan; Playwright tersedia atau PLAYWRIGHT_MODULE menunjuk runtime existing.
node tests/marketing-browser.cjs
# Paid opt-in, jangan jalankan otomatis di CI:
node --env-file=.env --import tsx scripts/smoke-marketing-media.ts --live
```

Sebelum rilis penuh: Fatur memeriksa sesi/membership Marketing pada workspace target; setelah akses sah tersedia, jalankan login→workspace→image/TTS/STT/notebook tanpa mock. Cek kuota Gemini; Groq hanya aktif dengan key asli. Claude mengadopsi shared contract pada Executive/Finance UI. Jangan menyebut seluruh acceptance PRD selesai sebelum dependency ini lolos.
Tidak ada perubahan auth.ts, tenant-guard.ts, Prisma/schema, .env, atau UI Executive/Finance. Tidak ada push pada tahap ini.

## Referensi provider

- [OpenRouter Image API](https://openrouter.ai/docs/guides/overview/multimodal/image-generation)
- [OpenRouter TTS](https://openrouter.ai/docs/guides/overview/multimodal/tts)
- [OpenRouter STT](https://openrouter.ai/docs/guides/overview/multimodal/stt)
- [Gemini TTS model](https://openrouter.ai/google/gemini-3.1-flash-tts-preview/api)
- [Groq transcription](https://console.groq.com/docs/speech-to-text)
