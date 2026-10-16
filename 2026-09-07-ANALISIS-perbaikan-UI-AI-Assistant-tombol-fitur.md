# Analisis Perbaikan UI AI Assistant, Tombol, dan Fitur -- Sebelum Eksekusi

Dokumen ini hasil Workflow analisis read-only (9 agent: 5 scan + 2 kritik + 2 verifikasi
anti-halu, 1.686.887 token, 275 pembacaan kode, 0 baris kode diubah). Tujuannya: jadi
dasar keputusan sebelum satu baris kode pun ditulis, sesuai permintaan Mecca ("analisis
dulu, workflow jadi dulu, baru gas").

Semua klaim di bawah sudah lewat verifikasi silang independen (2 agent terpisah baca ulang
tiap file:line yang diklaim, bukan percaya laporan mentah). 4 kesalahan kecil ditemukan
(offset baris meleset <15 baris, jumlah item di 2 array salah hitung) -- SEMUA sudah
dikoreksi di dokumen ini. 55 klaim dicek di kelompok pertama (hasil: ADA_KOREKSI, sudah
ditambal), 22 klaim di kelompok kedua (hasil: BERSIH, nol kesalahan).

---

## Bagian 0 -- Ringkasan untuk Yang Buru-Buru

Tiga hal paling penting, urut prioritas:

1. **Ada 3 kasus "kelihatan jalan padahal rusak"** -- ini yang paling perlu Mecca tahu
   duluan, karena berpotensi jadi akar insiden demo yang gagal sebelumnya (lihat Bagian 1).
2. **2 keputusan produk tidak bisa diambil sepihak** -- posisi "Pengaturan admin" dan nasib
   hardcode role di MediaStudio. Keduanya bentrok 2 aturan project sekaligus, wajib Mecca
   jawab (lihat Bagian 4).
3. **Kemampuan AI diiklankan sampai 4x di layar yang sama** (sidebar, grid besar, kartu
   galeri, chip composer) -- bukan bug, tapi bikin maintenance jadi berlipat dan berpotensi
   membingungkan user (lihat Bagian 3).

---

## Bagian 1 -- KELIHATAN JALAN, PADAHAL RUSAK (temuan paling penting)

### 1.1 Finance: panel "File hasil AI" tidak akan PERNAH bertambah isi

`FinanceAIAssistantView.tsx:688` -- `const [generatedFiles] = useState([...4 file
contoh...])`. Perhatikan: TIDAK ADA setter (`useState` tanpa `[x, setX]`). Artinya array
itu literally tidak mungkin bertambah isi seumur hidup komponen, walau staf Finance sudah
generate 50 laporan lewat chat. Badge angka di folder icon sidebar akan SELAMANYA
menunjukkan angka 4. File yang benar-benar dibuat AI ada, tapi nyangkut di `msg.realFile`
per-pesan chat -- jalur terpisah total dari panel ini. Developer sendiri sudah menulis
komentar jujur di baris 736-738: "mockup, session-only".

**Dampak:** staf Finance yang buka panel ini dan cuma lihat 4 contoh yang sama tiap hari
akan menyimpulkan "AI-nya gak pernah nyimpen file gue" -- padahal filenya ada, cuma taruhnya
salah tempat.

### 1.2 Executive: klik "Unduh" pada 4 kartu contoh = FILE RUSAK

`ExecutiveAIAssistantView.tsx:919-943` -- 4 entri seed (misal
`Proposal-Kerjasama-Contoh-Klien.docx`) cuma punya field `content` (teks polos), TANPA
`fileBase64`. Fungsi `downloadFile()` (baris 1170) kalau `fileBase64` ada -> decode jadi
file biner sungguhan (benar). Kalau tidak ada -> `new Blob([f.content], {type:
'text/plain'})` tapi tetap dikasih nama `.docx`.

Komentar developer di baris 1198-1201 bahkan MENGAKU bug class ini sudah pernah diperbaiki
untuk file baru -- tapi 4 seed lama yang sudah ada dari awal tidak ikut ditambal. Kartu
contoh ini TIDAK ada penanda "contoh" apapun -- kelihatan identik dengan hasil generate
asli.

**Dampak:** CEO klik "Unduh" di salah satu dari 4 kartu itu, dapat file `.docx` yang gagal
dibuka di Word ("format tidak dikenal/file rusak"). Kalau ini terjadi pas demo ke
klien/investor, itu persis kelas kejadian yang pernah dicatat sebelumnya soal demo gagal.

### 1.3 Generate dokumen: kalau AI gagal total, sistem BOHONG bilang sukses

Ini yang paling berbahaya karena tidak terlihat dari UI sama sekali. Kalau SEMUA provider
AI teks gagal/kuota habis (Groq, OpenRouter, OpenCode, OpenAI, Gemini -- 5 lapis fallback),
`ai-gateway.ts` baris 703-716 jatuh ke `deterministic_fallback` yang balikin JSON generik
(`{status, summary, insights}`) -- BUKAN bentuk yang diharapkan `WordContentSchema`
(`{fileName, title, sections}`). Di `generateWordDoc()`, `data.sections` jadi `undefined`
-> dipaksa jadi array kosong -> dokumen Word yang dihasilkan CUMA berisi judul, NOL isi.

Response API tetap `success: true`, pesan chat tetap bilang "Dokumen Word berhasil dibuat"
(`brain/chat/route.ts:686-691`). Ada kata "0 bagian" terselip di summary panjang yang
kemungkinan besar tidak terbaca user.

**Dampak:** user download, buka, cuma nemu 1 judul kosong -- kelihatan seperti bug UI biasa,
padahal akar masalahnya semua provider AI gagal secara diam-diam. Codebase yang SAMA sudah
punya pola benar untuk kasus ini di `notebook-engine.ts:100-102` (lempar error jujur kalau
`provider === 'deterministic_fallback'`) -- cuma belum diterapkan konsisten ke jalur
dokumen.

**Fix untuk ketiganya sudah dipetakan** (lihat Bagian 5, gelombang 3) -- semuanya di luar
zona merah, aman dikerjakan.

---

## Bagian 2 -- Tombol "Tanya AI soal File Ini" -- Terkonfirmasi, Fix Kecil

Menjawab pertanyaan Mecca: "kalau taruh filenya lewat AI, biar AI integrasiin ke database
gimana?"

- **(a) Tersimpan permanen** -- YA, beneran jalan. `WorkspaceFile` (Postgres, field
  `storageBlob` Bytes) diisi nyata di `workspace-files/route.ts`.
- **(b) Diekstrak isinya** -- YA, beneran jalan. `extractTextFromBuffer()` (pipeline yang
  sama dipakai attachment chat) mengisi `extractedSummary`.
- **(c) Bisa dipakai AI saat menjawab** -- **TIDAK**, dan ini persis yang paling Mecca
  ragukan. `grep prisma.workspaceFile` di seluruh `src/`: cuma 1 file (endpoint hub-nya
  sendiri). `brain/chat/route.ts` tidak pernah menyentuhnya sama sekali.

Fakta yang bikin ini konkret: codebase SUDAH PUNYA jalur kerja identik untuk kasus lain.
Kalau file di-drag LANGSUNG ke composer chat (bukan lewat Pusat Data), ada panggilan ke
`/documents/analyze` yang MEMANG menulis ke `MemoryItem[COMPANY_KNOWLEDGE]`, dan itu
BENERAN dibaca otomatis tiap chat lewat `getAccumulatedCompanyKnowledge()`. Jadi AI Brain
BISA baca dokumen -- cuma untuk 1 dari 2 jalur upload yang ada (chat-attachment jalan,
Pusat-Data-Hub buntu).

Ada juga jembatan MANUAL yang sudah ditulis lengkap di kode (tombol "Tanya AI soal file
ini") tapi propnya (`onAskAI`) tidak pernah dioper dari 3 view pemanggil -- tombolnya secara
harfiah tidak pernah dirender ke DOM.

**Fix (2 bagian, keduanya kecil, aman, di luar zona merah):**
1. `workspace-files/route.ts` -- tambah panggilan `recordCompanyKnowledge(...)` persis
   meniru pola `documents/analyze/route.ts:276` (1 baris impor + 1 baris panggilan).
2. 3 file view -- tambah prop `onAskAI={(prompt) => handleSendMessage(prompt)}` ke
   pemanggilan `<WorkspaceDataHub />`. Komponennya sudah siap, tidak perlu diubah.

---

## Bagian 3 -- Kemampuan AI Diiklankan Sampai 4x di Layar yang Sama

Ada 3 "sumber kebenaran" katalog kemampuan yang TIDAK saling sinkron:

```
1. src/lib/ai-tools-registry.ts (KLIR_AI_TOOLS)
   -> diklaim komentar sendiri "SATU sumber kebenaran"
   -> KENYATAAN: 0 dipakai render grid/pluginItems manapun.
      Cuma dipakai backend /api/v1/brain/tools + jadi baris tabel
      di 1 modal admin.

2. capabilities[]/CAP_GROUPS (grid "Semua kemampuan AI")
   -> 32 item Executive, 22 item Finance, 17 item Marketing
   -> di-copy-paste terpisah ke 3 file, NOL shared import

3. tools[] sidebar / gallery[] "Mulai dari tugas nyata" / pills[]
   quick-prompt / chip composer
   -> prompt TEKS-nya sering VERBATIM SAMA dengan capabilities[]
      di atas, cuma dikemas beda bentuk
```

Satu kemampuan bisnis (misal "analisis arus kas 30 hari") bisa muncul sampai 4x di layar
yang sama: stat card, item grid kemampuan, kartu galeri template, DAN pill composer.
Maintenance-nya berlipat: 1 kemampuan bisa butuh diedit di sampai 12 titik terpisah kalau
mau konsisten di 3 portal.

**Bukan bug yang harus buru-buru ditambal** -- tapi worth diketahui sebagai akar kenapa
layar kelihatan padat/redundan. Menyatukan jadi 1 sumber kebenaran itu REFACTOR ARSITEKTUR
besar (nyentuh backend consumption juga) -- di luar scope perbaikan cepat, dicatat sebagai
proyek terpisah kalau Mecca mau ke arah situ.

Temuan kecil tapi konkret di kluster ini: kategori "Materi promosi" di grid Finance cuma
berisi 1 kartu generik ("Presentasi & slide") -- sisa 5 item aslinya sudah benar dibuang
(role-fit terjaga di level ITEM), tapi JUDUL kategorinya kelupaan diganti. Padahal file yang
sama SUDAH benar membetulkan masalah identik di galeri sebelahnya (diganti jadi "Pajak &
kepatuhan"). Juga caption "...yang paling sering diminta pimpinan" (istilah khas CEO)
ke-copy-paste apa adanya ke Finance & Marketing.

---

## Bagian 4 -- 2 Keputusan yang HARAM Diputuskan Sepihak

### 4.1 "Pengaturan admin -- akses per-divisi" -- toggle dekoratif, tapi bentrok 2 aturan

Verifikasi: state `adminOverrides` (Executive:867) SATU-SATUNYA pembacanya adalah render
toggle-nya sendiri (baris 3963) -- tidak pernah dibaca `pluginCatalog`/`capabilities`/`tools`
manapun. Toggle-nya beneran cuma dekorasi.

Tapi ada komentar developer eksplisit (`FinanceAIAssistantView.tsx:1929-1932`) yang bilang
panel ini SENGAJA "role-invariant di mockup v6" -- port 1:1 dari desain yang sudah Mecca
setujui di Claude Design. Jadi ada 2 aturan project yang tarik-menarik: "Claude Design final
wajib 1:1" (jangan ubah dari yang sudah disetujui) lawan prinsip Mecca sendiri sesi ini
("Finance gak perlu urusan divisi lain").

Marketing punya pola BEDA yang lebih sesuai prinsip Mecca: tombolnya cuma toast "Pengaturan
admin dikelola di panel Setting perusahaan" -- tidak buka modal lintas-divisi sama sekali.

**Pertanyaan buat Mecca:** (a) toggle ini mau dibikin BENERAN fungsional (butuh nambah field
role ke registry + wiring backend -- scope besar), atau (b) tombolnya dipindah exec-only
ngikut pola Marketing (toast doang)?

### 4.2 Hardcode `role: 'marketing'` di MediaStudio -- kelihatan simpel, sebenarnya jebakan

`MediaStudio.tsx` baris 94/98/101 -- SEMUA request generate (gambar/audio/video/
storyboard/kuis/flashcard) dari SEMUA portal (CEO, Finance, Marketing) kirim `role:
'marketing'` yang di-hardcode. Field ini dipakai backend beneran
(`generation-engine.ts:35 findTemplate(req.role, req.type)`).

Dampaknya HARI INI nihil untuk video-plan (karena `template-library.ts` belum punya
template role-tagged untuk itu). TAPI kalau field ini "dibetulin" jadi kirim role asli
portal, CEO yang generate storyboard/video BISA KEHILANGAN hasil yang sebelumnya
(kebetulan) jalan pakai template marketing -- karena template pengganti untuk role CEO/
Finance belum ada.

**Ini bukan bug 1-baris** -- butuh spek template dulu dari Mecca/Fatur soal struktur apa
yang seharusnya dipakai tiap role, sebelum baris role ini diubah.

---

## Bagian 5 -- Rencana Kerja Bertahap (risiko rendah dulu)

Ini urutan yang disarankan tim kritik, sudah lewat verifikasi. Setiap gelombang independen
-- bisa berhenti kapan saja tanpa merusak gelombang sebelumnya.

```
GELOMBANG 0 -- PRASYARAT (wajib sebelum apapun nyentuh array kemampuan)
  Hitung ulang manual jumlah item tiap array langsung dari kode (bukan warisi
  angka dari laporan agent -- 2 dari 5 agent sempat salah hitung, sudah dikoreksi
  di dokumen ini, tapi validasi ulang tetap wajib sebelum ada yang di-hapus/reorder).

GELOMBANG 1 -- FIX TEKS MURNI (risiko nyaris nol)
  - Kategori "Materi promosi" -> "Pajak & kepatuhan" di grid Finance (Bagian 3)
  - Caption "...diminta pimpinan" disesuaikan per role di Finance & Marketing

GELOMBANG 2 -- WIRING KECIL, ADDITIVE MURNI (risiko rendah)
  - "Tanya AI soal file ini" -- 2 titik sisip, komponen sudah siap (Bagian 2)
  - Filter "Template Dokumen" per role -- field role SUDAH ADA & sudah dipakai
    backend, tinggal tambah 1 prop + filter client-side
  - "File hasil AI" Marketing -- sambungkan ke modal sungguhan (cek dulu apakah
    state generatedFiles Marketing sudah terisi dari flow generate)

GELOMBANG 3 -- FIX KEBENARAN DATA (Bagian 1, paling penting secara dampak)
  - Finance "File hasil AI": scan pesan chat (persis pola filesCreatedCount yang
    SUDAH ADA di baris 1751), bukan array hardcode
  - Executive "File hasil AI": hapus 4 seed tanpa fileBase64, atau kasih badge
    "Contoh" + disable tombol Unduh, atau isi fileBase64 valid
  - generation-engine.ts: lempar error jujur kalau provider jatuh ke
    deterministic_fallback -- tiru pola notebook-engine.ts:100-102 yang sudah benar

GELOMBANG 4 -- BUTUH JAWABAN MECCA DULU (Bagian 4, HARAM jalan sebelum dijawab)
  - Nasib "Pengaturan admin" (exec-only / beneran fungsional / dibiarkan dekoratif
    tapi jujur dilabeli ulang)
  - Posisi chip composer (atas/bawah/samping) DAN apakah berlaku ke Exec+Finance
    juga atau Marketing doang
  - Posisi blok data perusahaan (tetap area utama vs sidebar)

DITAHAN, JANGAN DIKERJAKAN SESI INI
  - Fix hardcode role MediaStudio -- butuh spek template dulu (Bagian 4.2)
  - S2/S3 (chip pindah ke atas/sidebar) untuk Executive+Finance -- ini BIKIN
    KOMPONEN BARU (mereka belum punya chip row sama sekali), bukan reposisi.
    Kalau Mecca mau seragam ke 3 portal, itu perlu SESI CLAUDE DESIGN dulu,
    baru diimplementasi 1:1 -- bukan langsung improvisasi coding
  - Menyatukan 3 sumber katalog kemampuan jadi 1 -- refactor arsitektur besar
```

---

## Bagian 6 -- Cara Uji "Beneran Works" per Kelas Fitur (bukan cuma 200 OK)

Checklist ini bisa langsung dijalankan di localhost, disusun dari rantai panggilan sampai
endpoint/handler akhir -- supaya "sukses" dibuktikan dari yang user LIHAT, bukan dari status
kode HTTP.

```
GRATIS -- jalankan semua, tanpa khawatir biaya:
  Pusat Data: upload .txt kecil -> status "Diproses" jadi hijau -> "Lihat isi"
    HARUS sama persis dgn file asli -> hapus -> REFRESH BROWSER (bukan cuma
    state React) -> file harus TETAP hilang (membuktikan DELETE nyampe Postgres)

GRATIS-MURAH -- Groq teks, biaya nyaris nol:
  Kuis/Flashcard: generate dari materi tempel -> baca 2-3 soal -> harus PERSIS
    4 opsi, correctIndex masuk akal, bukan placeholder generik

MURAH -- teks LLM, sekali cukup:
  Dokumen Word: minta lewat chat -> WAJIB download -> BUKA di Word/LibreOffice
    sungguhan -> harus TIDAK error format, harus ADA isi (bukan cuma judul) --
    ini langsung menguji Bagian 1.3. Ulangi sekali untuk Excel, sekali untuk PPT.
  Transkripsi suara: rekam 5-10 detik -> teks hasil harus masuk akal

BERBIAYA UANG NYATA -- jadwalkan hati-hati, 1x saja per fitur:
  Voiceover: generate -> audio harus BENERAN BISA DIPUTAR, durasi > 0,
    unduhan harus file .mp3/.wav valid (buka di player lain, bukan cuma browser)
  Gambar: generate -> harus RENDER (bukan broken-image icon), unduhan valid

PALING BERBIAYA -- SATU KALI SAJA, jangan diulang sebelum ada fix:
  Video: generate -> TUNGGU (polling bisa sampai 150 detik, jangan asumsikan
    gagal kalau lama) -> harus BENERAN render video, BUKAN jatuh ke fallback
    storyboard-teks (kalau yang muncul cuma teks + catatan "render gagal",
    itu artinya video generation GAGAL diam-diam)
```

Klasifikasi biaya per fitur (dari kode nyata, bukan asumsi): upload txt/csv/json di Pusat
Data = 0 biaya (parsing lokal, nol panggilan AI). Upload gambar/foto nota untuk OCR = ada
biaya kecil (Gemini Vision). Voiceover & gambar = OpenRouter berbayar tiap panggilan. Video
= paling mahal + polling sampai 150 detik per percobaan.

---

## Bagian 7 -- Yang Sudah Dicoret dari Rencana (jangan diusulkan lagi)

```
- Login/logout/landing page -- wilayah Fatur, HARAM disentuh (perintah eksplisit Mecca)
- S3 (chip jadi section sidebar) untuk Exec+Finance langsung dari brief ini --
  fitur baru menyamar jadi reposisi, harus lewat Claude Design dulu
- Auto-fix role MediaStudio tanpa spek template -- bisa bikin generate CEO/Finance
  error yang sebelumnya (kebetulan) jalan
- Memutuskan sendiri nasib "Pengaturan admin" -- bentrok 2 aturan, wajib tanya Mecca
- Rencana kerja yang nyebut "ubah kartu ke-N" dari angka laporan mentah -- sudah
  terbukti bisa salah (28 vs 32, 18 vs 17), wajib hitung ulang manual dulu
- Menyatukan 3 sumber katalog kemampuan jadi 1 -- refactor besar, proyek terpisah
- Uji ulang generate video lebih dari 1x per sesi kerja -- paling mahal + paling
  lama, 1 bukti kerja/gagal sudah cukup untuk keputusan
```

---

## Bagian 8 -- Status Kesetaraan dengan Gemini/NotebookLM (susulan, diminta Mecca 7 Sep sore)

Mecca eksplisit minta KLIR dibandingkan ke Gemini (all-in-one: chatbot + generate video/
gambar + workflow + NotebookLM-style analisis sumber). Bagian ini status jujur per
kapabilitas, dicek langsung ke kode (bukan asumsi) -- BUKAN Workflow 9-agent baru, ini scan
langsung (grep + baca file) supaya hemat waktu/kredit.

```
SUDAH ADA & (setelah Gelombang 1-3 selesai) LIVE-VALID:
  Generate Word/Excel/PPT           generation-engine.ts -- backend nyata, TAPI baru
                                     aman setelah fix Bagian 1.3 (sebelumnya bisa diam-
                                     diam kosong kalau AI gagal)
  Generate gambar/poster/banner     media-provider.ts -> OpenRouter, sudah live-verified
  Generate video                    media-provider.ts -> OpenRouter /v1/videos, sudah
                                     live-verified 1x render sungguhan
  Notebook kuis/flashcard/mindmap/  notebook-engine.ts + StudioResult.tsx -- 9 jenis
    infografis render per-jenis     kartu CONFIRMED wired (bukan fallback teks generik)
  Analisis dokumen upload (PDF/     documents/analyze -- document-checker.ts +
    Excel/gambar-OCR)               tabular-checker.ts, deterministik, sudah dites
  Auto-catat transaksi dari         Conversational ERP (punya Fatur) -- CONFIRMED live
    bahasa natural di chat          (dites sesi ini: "modal awal 20000, beli laptop 7500")

BELUM ADA SAMA SEKALI (dicek grep langsung, nol hasil):
  Input link YouTube untuk dianalisis AI      0 endpoint, 0 UI. Satu-satunya hit "YouTube"
                                               di codebase itu setting Google Ads campaign,
                                               bukan fitur ingest konten.
  Input link website untuk dianalisis AI      0 endpoint, 0 UI, 0 library scraping
                                               (cheerio/jsdom/dst) di package.json
  Auto-analisis file/folder/zip baru yang     0 -- endpoint upload cuma terima 1 file per
    "masuk" ke database (tanpa diklik manual)  panggilan (`multipart/form-data`, field
                                               tunggal "file"), nol mekanisme watch-folder/
                                               batch-zip/auto-trigger

ADA BACKEND, TAPI BUKAN "workflow builder" ala Gemini:
  Prisma model Workflow (trigger->action,     Ini automation rule sederhana ("kalau X
    endpoint POST/trigger/templates ada)       terjadi, lakukan Y"), BUKAN AI yang bantu
                                               user menyusun rangkaian tugas multi-langkah
                                               kayak Gemini/NotebookLM. 0 UI caller sama
                                               sekali (match temuan audit 6 Sep sebelumnya)
                                               -- ini item roadmap terpisah kalau mau
                                               dibangun jadi UI beneran.

PUTUS (backend jalan, tapi AI belum bisa "pakai" hasilnya -- lihat Bagian 2):
  File di Pusat Data belum ikut jadi          Fix sudah dipetakan, masuk Gelombang 2
    pengetahuan AI saat chat                  (workspace-files-backend task)
```

**Kesimpulan jujur:** KLIR sudah setara Gemini untuk kapabilitas GENERATE (dokumen/gambar/
video/notebook) begitu Gelombang 1-3 selesai dan terverifikasi -- itu porsi terbesar dari
"AI helper serba-bisa" yang diminta. Yang BELUM ada sama sekali dan butuh dibangun dari nol
(bukan wiring, genuinely fitur baru): (1) ingest link YouTube/website eksternal, (2)
auto-trigger analisis saat file/folder baru masuk (tanpa klik manual), (3) UI workflow-
builder di atas model `Workflow` yang sudah ada backend-nya. Ketiganya di luar scope
"perbaikan tombol yang sudah ada" -- ini roadmap fitur baru, perlu masuk gelombang
perencanaan terpisah dengan estimasi effort sendiri (bukan quick-fix seperti Gelombang 1-3).

