# Konvensi Ngoding KLIR -- Cara Tim AI Ikut Gaya Fatur

Dokumen ini dibuat supaya kode yang ditulis tim AI (Claude Code) nyambung dengan kode yang
sudah ada, dan supaya Fatur tidak kelabakan saat melanjutkan ngoding pakai Antigravity /
OpenCode. Isinya BUKAN teori umum: semua diambil dari kode yang Fatur sendiri tulis di repo
ini, lengkap dengan lokasi barisnya supaya bisa dicek ulang.

Cara pakai: Bagian 1-6 untuk dibaca manusia. Bagian 7 adalah blok siap salin untuk ditempel
ke AI coding (Antigravity/OpenCode) sebagai aturan main proyek.

Kepemilikan file diverifikasi lewat `git log --diff-filter=A` (siapa yang pertama membuat
file): `ExecutiveAIAssistantView.tsx`, `FinanceModuleView.tsx`, `MarketingModuleView.tsx`,
`src/lib/tenant-guard.ts`, `src/lib/ai-gateway.ts` -- semuanya penulis pertamanya Fatur
(nama commit: Fatcur, 103 commit). Jadi konvensi di bawah memang gaya dia, bukan gaya kami
yang dibalikkan ke dia.

---

## Bagian 1 -- Stack Resmi (jangan pilih library di luar ini tanpa bilang dulu)

Diambil dari `package.json`, bukan tebakan:

```
Framework   : Next.js 16.3.1 (App Router) + React 19.2.8 + TypeScript
Database    : Prisma 6.3.1 (PostgreSQL / Neon)
Validasi    : zod 4.4.3
Auth        : jsonwebtoken 9.0.3 + argon2 0.45.1
Ikon        : lucide-react 1.31.0
Grafik      : apexcharts 7.1.0 + react-apexcharts 2.1.1
Dokumen     : docx 9.7.1 | exceljs 4.4.0 | pptxgenjs 4.0.1 | pdf-parse 2.4.5 | mammoth 1.12.1
Media       : sharp 0.35.4 | music-metadata | @breezystack/lamejs (encoder MP3)
AI          : @google/generative-ai + gateway internal src/lib/ai-gateway.ts
3D          : three 0.149.0
Spreadsheet : xlsx 0.18.5
```

Perintah standar:

```
npm run dev          -> next dev
npm run build        -> next build
npm run lint         -> eslint
npm run deploy:vps   -> ssh ke VPS, git pull, npm install, npx prisma generate,
                        npm run build, pm2 reload klir-os
```

Catatan: `deploy:vps` baru ditambahkan Fatur sendiri (commit `566ec58`). Itu jalur deploy
resmi -- jangan bikin skrip deploy tandingan.

---

## Bagian 2 -- Konvensi Endpoint API (lapisan yang paling sering disentuh)

File acuan: `src/app/api/v1/promo/coupons/route.ts` (tulisan Fatur).

Bentuk bakunya:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { DiscountType } from '@prisma/client';   // enum Prisma kalau perlu

// GET: Ambil daftar voucher promo
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const rows = await prisma.promoCoupon.findMany({
        where: { workspaceId: auth.workspace.id },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json({ coupons: rows });
    } catch (err: any) {
      console.error('[promo/coupons] GET error:', err);
      return NextResponse.json({ message: 'Gagal mengambil daftar kupon.' }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
```

Aturan yang wajib diikuti:

1. Semua handler dibungkus `withTenantGuard(handler, { minRole })` dari `@/lib/tenant-guard`.
   Ini bukan opsional -- Fatur pakai ini konsisten di seluruh API v1.
2. `workspaceId` diambil dari `auth.workspace.id` saja.
3. Hirarki peran (`src/lib/tenant-guard.ts` baris 8-15):
   `OWNER (5) > ADMIN (4) > MANAGER (3) > MEMBER (2) > VIEWER (1)`.
   Konvensi: operasi baca pakai `minRole: 'VIEWER'`, operasi tulis/ubah/hapus pakai
   `minRole: 'MEMBER'`.
4. Komentar penanda per verb, Bahasa Indonesia, satu baris:
   `// POST: Buat Kode Voucher Promo Baru`
5. Validasi input di awal, langsung return 400 dengan pesan Bahasa Indonesia:
   `return NextResponse.json({ message: 'Kode kupon dan nilai diskon wajib diisi.' }, { status: 400 });`
6. Destructuring body dengan nilai bawaan:
   `const { code, discountType = 'PERCENTAGE', quota = 100 } = await req.json();`
7. Normalisasi input eksplisit: `Number(x)`, `.trim().toUpperCase()`, dan sejenisnya.
8. Bentuk respons sukses: `{ success: true, message: '...berhasil dibuat!', <entitas> }`
   -- pesan untuk pengguna ditulis Bahasa Indonesia.
9. Nama file selalu `route.ts` di dalam folder path-nya (konvensi App Router).

---

## Bagian 3 -- Konvensi Komponen Frontend

Diambil dari `FinanceModuleView.tsx`, `MarketingModuleView.tsx`, dan 3 file AI Assistant
View (semuanya awalnya tulisan Fatur):

1. Komponen interaktif diawali `'use client';`
2. Pengambilan data lewat satu fungsi `loadRealData()` yang isinya
   `Promise.all([...])` berisi beberapa `fetch(url, { credentials: 'include' })` sekaligus
   -- bukan fetch berantai satu per satu.
3. Ikon selalu dari `lucide-react`. Ukuran konsisten: `size={14}` untuk chip kecil,
   `size={16}` sampai `size={17}` untuk kartu.
4. Gaya visual: campuran `className` Tailwind untuk tata letak, dan `style={{ }}` inline
   untuk warna/tipografi spesifik. Ikuti pola tetangganya di file yang sama -- jangan
   memaksa semua jadi satu gaya.
5. Palet warna yang dipakai (jangan membuat warna baru):

```
Biru aksen   #4E9BFF      Hijau        #3FBF8F
Emas         #C9A66B      Kuning       #D8A33C
Biru muda    #8CBEFF      Merah        #EF4444
Teks utama   #F5F7FA      Teks redup   #8A93A3     Teks paling redup  #5C6474
Panel        #0E131B      Latar        #06080C
Garis        rgba(255,255,255,0.07) sampai 0.09
```

6. Tipografi: heading pakai `font-family: 'Outfit', sans-serif`. Ukuran kecil dan spesifik
   (11px / 11.5px / 12.5px / 15px), bukan skala Tailwind bebas.
7. Angka uang atau tabular pakai `font-heading tabular-nums`, atau helper `idMoney(...)`.
8. Notifikasi ke pengguna pakai pola toast lokal:
   `setToastMsg('...')` lalu `setTimeout(() => setToastMsg(null), 4000)`.
9. Konfirmasi tindakan merusak pakai `window.confirm()` bawaan. Ini satu-satunya pola
   konfirmasi di repo -- jangan membuat komponen modal konfirmasi baru.
10. State "sedang diproses" dibuat PER BARIS (contoh `deletingId`), bukan satu state global,
    supaya baris lain tetap bisa dipakai saat satu baris sedang diproses.

---

## Bagian 4 -- Lima Pola Menambah Fitur Tanpa Mengganggu Kode yang Sudah Ada

Ini pola yang Fatur sendiri pakai berulang (hasil audit commit `57bcf65` dan `60db0a5`).
Pakai pola ini setiap kali menambah fitur, supaya tidak perlu mengubah kode dia.

**Pola A -- Endpoint analitik baru, query tabel yang sama, tanpa migrasi.**
Contoh nyata: `analytics/financial-trends/route.ts` (file baru) hanya SELECT dari
`cash_transactions` -- tabel yang sama yang dipakai `kas/transactions` -- lalu diproses
in-memory. Route lama tidak disentuh, skema tidak disentuh.

**Pola B -- Kolom/index opsional, dan `withTenantGuard` wajib.**
Kalau butuh kolom baru: tambah yang nullable/opsional, atau cukup index saja. Jangan
mengubah atau menghapus kolom yang sudah ada.

**Pola C -- Router aksi percakapan: tambah blok `if` BARU di akhir.**
Struktur `brain/chat/route.ts`: deteksi regex lalu
`if (isXAction) { try { ... } catch { lanjut ke LLM biasa } }`.
Menambah aksi baru berarti menambah satu blok `if` baru SETELAH blok yang sudah ada
(`isCashAction` dan kawan-kawan tetap utuh). Setelah aksi berhasil, panggil
`invalidateContextCache(workspaceId)` dan kirim `systemEvent` dengan NAMA BARU. Sisi
frontend sudah generic (`window.dispatchEvent(new Event(json.data.systemEvent))`), jadi
cukup menambah `window.addEventListener` di komponen sendiri.

**Pola D -- `MemoryItem` sebagai tabel bebas-skema untuk data yang belum layak migrasi.**
Konvensi Fatur: tag di awal isi `content`, contoh `[COMPANY_PROFILE] Key: Value | ...`,
dibaca balik pakai regex. Tulis dengan tag BARU milik sendiri, dan baca lewat query sendiri
-- jangan menambah logika baca ke fungsi Fatur yang sudah ada.

**Pola E -- Cache sesi di sisi klien (frontend murni).**
Dari commit `60db0a5`: state React di-lazy-init dari `localStorage`, dengan key ter-namespace
per peran dan per workspaceId (contoh `klir_ai_chats_exec_<workspaceId>`), lalu dua
`useEffect`: satu menyimpan otomatis tiap state berubah, satu memuat ulang saat key berganti.
Semua dibungkus try/catch silent-fail. Backend tidak tahu-menahu, nol migrasi, nol API baru.
Catatan penting: jangan menyimpan payload besar (base64 gambar) lewat pola ini -- bisa kena
batas kuota localStorage tanpa pesan error.

---

## Bagian 5 -- Anti-Pola: Ada di Kode, Tapi Jangan Ditiru

Bagian ini penting supaya AI coding tidak "meniru gaya" sampai ikut menyalin celah yang
sudah pernah ditambal. Ini bukan penilaian terhadap orangnya -- ini supaya bug yang sudah
selesai tidak dihidupkan lagi.

1. **Jangan kembalikan `err.message` mentah ke pemanggil.**
   Sebagian route lama menulis `catch (err: any) { return NextResponse.json({ message:
   err.message }, { status: 500 }) }`. Itu bisa membocorkan detail internal (termasuk pesan
   error Prisma) ke pengguna. Yang benar: pesan umum Bahasa Indonesia ke pengguna, detail
   lengkap ke `console.error('[nama-route] VERB error:', err)` di server.

2. **Jangan menentukan tenant dari input mentah.**
   Pola lama: `req.headers.get('x-workspace-id') || searchParams.get('workspaceId') ||
   auth?.workspace?.id`, lalu kalau tetap kosong "ambil workspace pertama di database".
   Fallback seperti itu artinya jatuh ke DATA TENANT LAIN. Sudah pernah ditambal dua kali di
   repo ini (`brain/chat` commit `055eeb4`, lalu `workspaces/[workspaceId]/profile`).
   Yang benar: `auth.workspace.id` saja.

3. **Jangan menampilkan angka karangan saat data belum ada.**
   Kalau data belum ada, tampilkan keadaan jujur ("Menunggu data ...") -- bukan angka
   pengganti. Sudah pernah terjadi: skor pilar dipatok `strategy: 50`, dan narasi
   "+28.5% Month-over-Month" muncul untuk usaha yang pendapatannya nol.

4. **Jangan membiarkan label fitur tidak sesuai kenyataan.**
   Contoh nyata: chip masih tertulis "Buat Video - Segera" padahal render video sudah live.
   Kalau fitur sudah jalan, labelnya wajib ikut diperbarui.

---

## Bagian 6 -- Wajib Dijalankan Sebelum Push

```
node node_modules/typescript/bin/tsc --noEmit
node --experimental-test-module-mocks --import tsx --test tests/*.test.ts
node node_modules/next/dist/bin/next build
```

Ketiganya harus bersih. Yang ketiga wajib, karena itu yang dijalankan saat deploy.
Per 7 September 2026: 468 test, semuanya lulus.

Catatan tambahan: ada gerbang uji berbasis browser di `tests/marketing-browser.cjs` yang
mencari `[aria-label="Studio media Marketing"]` (baris 119) dan
`[data-testid="studio-result"]` (baris 170). Kalau memindahkan atau merombak tombol Studio,
atribut itu wajib ikut dibawa -- kalau tidak, gerbang uji itu patah tanpa terlihat.

---

## Bagian 7 -- Blok Siap Salin untuk AI Coding (Antigravity / OpenCode)

Salin blok di bawah ini apa adanya ke AI coding sebagai aturan main proyek:

```
Proyek: KLIR (Next.js 16 App Router + React 19 + TypeScript + Prisma 6 + PostgreSQL/Neon).

ATURAN ENDPOINT API:
- Semua handler dibungkus withTenantGuard(handler, { minRole }) dari @/lib/tenant-guard.
- workspaceId HANYA dari auth.workspace.id. Jangan dari header, query, atau body.
- Jangan ada fallback "ambil workspace pertama di database".
- Peran: OWNER > ADMIN > MANAGER > MEMBER > VIEWER. Baca = VIEWER, tulis = MEMBER.
- Validasi di awal, return 400 dengan pesan Bahasa Indonesia.
- Respons sukses: { success: true, message: '...', <entitas> }.
- Respons error: pesan umum Bahasa Indonesia ke pengguna, detail ke console.error.
  Jangan kirim err.message mentah ke pemanggil.
- Komentar penanda per verb Bahasa Indonesia. Contoh: // GET: Ambil daftar transaksi

ATURAN KOMPONEN:
- 'use client' untuk komponen interaktif.
- Ambil data lewat satu loadRealData() berisi Promise.all([...fetch(credentials:'include')]).
- Ikon lucide-react. Grafik apexcharts.
- Palet tetap: #4E9BFF #3FBF8F #C9A66B #D8A33C #8CBEFF #EF4444,
  teks #F5F7FA / #8A93A3 / #5C6474, panel #0E131B, latar #06080C,
  garis rgba(255,255,255,0.07). Heading pakai font 'Outfit'.
  Jangan membuat warna, radius, atau skala tipografi baru.
- Tombol baru: tiru anatomi tombol terdekat yang sudah ada di file yang sama.
- Konfirmasi hapus pakai window.confirm(). Jangan membuat komponen modal konfirmasi baru.
- State proses per baris (contoh deletingId), bukan satu state global.
- Toast: setToastMsg('...') lalu setTimeout(() => setToastMsg(null), 4000).

CARA MENAMBAH FITUR TANPA MENGGANGGU KODE YANG ADA:
- Endpoint analitik baru: query tabel yang sudah ada dengan agregasi berbeda. Jangan ubah
  route lama.
- Skema: tambah kolom nullable atau index saja. Jangan ubah atau hapus kolom yang ada.
- Aksi percakapan baru di brain/chat: tambah blok if BARU di akhir, jangan disisipkan di
  tengah blok yang sudah ada.
- Data ringan yang belum layak tabel: simpan di MemoryItem dengan tag sendiri
  ([TAG_BARU] Key: Value), dibaca lewat query sendiri.
- State UI persisten: localStorage dengan key ter-namespace per peran dan workspaceId,
  dibungkus try/catch. Jangan menyimpan base64 besar.

JANGAN DISENTUH TANPA BICARA DULU:
src/lib/auth.ts, src/lib/session.ts, src/lib/rate-limiter.ts, src/lib/prisma.ts,
src/app/api/v1/auth/** (semua), KlirAuthModal.tsx, src/app/page.tsx, src/app/layout.tsx,
ecosystem.config.js, scripts/deploy-vps.sh, dan halaman landing.

SEBELUM PUSH, ketiganya harus bersih:
node node_modules/typescript/bin/tsc --noEmit
node --experimental-test-module-mocks --import tsx --test tests/*.test.ts
node node_modules/next/dist/bin/next build

Jangan menghapus atribut [aria-label="Studio media Marketing"] dan
[data-testid="studio-result"] -- keduanya dipakai gerbang uji browser.
```
