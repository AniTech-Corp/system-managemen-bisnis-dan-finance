# Handoff Claude (Fable 5.1) -> Codex (GPT 5.6 Luna/Terra) -- 10 September 2026 siang

Konteks: kredit Claude seret, reset 5 jam. Batch Tingkat B SUDAH push + deploy. Codex lanjutkan
item di bawah. Baca dulu (urutan): `00-PETA-STRUKTUR-PROJECT.md` (folder KLIR/, IRON RULE lane),
`2026-09-10-fable-roadmap-master-klir.md`, `2026-09-10-kontrak-eksekusi-sonnet-tingkat-b-klir.md`,
`2026-09-10-untuk-fatur-batch-tingkat-b-apa-yang-berubah.md`, `2026-09-10-panduan-tes-untuk-gpt-luna-terra-dan-mecca.md`.

## 1. Status saat handoff (bukti)

```
GitHub main        d1038ba (47 commit di atas 3d2249e Fatur)             [LIVE]
VPS 72.61.142.156  /var/www/KLIR @ d1038ba, pm2 klir-os online            [LIVE]
                   curl / 200, inventory/products 401, brain/chat 401     [LIVE]
                   rollback: git checkout 3d2249e && npm run build && pm2 reload klir-os
tsc                0 error                                                [LOKAL]
test               1472/1472 (node --test), 250 suite                    [TEST]
Neon               prisma db push sudah, additive saja                    [LIVE]
lane Fatur         nol diff (auth/login/session/prisma.ts/layout/landing)
```

Catatan VPS: `npm ci` gagal ("lock file out of sync", missing @emnapi/*). package.json + lock =
lane Fatur. node_modules di VPS utuh, build jalan. JANGAN `npm install` di VPS tanpa Fatur.

## 2. Yang Codex kerjakan (urut prioritas)

### P1. Tes manual V1-V12 di panduan tes (addendum v2)
Pakai localhost ATAU klir.laserstory1.id dengan sesi login Mecca. Laporkan per item dengan
tier [LIVE]/[LOKAL] + screenshot. Item V12 paling penting: tangkap urutan persis kalau konsol
memunculkan "Maximum update depth exceeded" di composer AI CEO (kami lihat 2x, repro 4x = 0).
Kalau ketemu: catat component stack dari console.error, JANGAN tambal dulu, tulis temuan.

### P2. Smoke AI Marketing lewat tombol nav (belum dites setelah build wave)
Buka portal Marketing -> tombol "AI Asisten Marketing" (bukan localStorage) -> ketik 1
pertanyaan -> cek konsol 0 error, panel "Perlu perhatian" (boleh tidak render kalau 0 kartu),
katalog produk baca-saja di copywriting/kalender.

### P3. Tampilan sempit (mobile) untuk Stok & Pembelian 7 tab
Belum dites sama sekali (resize_window Chrome tidak mengubah innerWidth di setup Mecca).
Codex cek di devtools device mode 375px: tab bar bisa scroll, form Catat penjualan/Ubah produk
tidak terpotong. Temuan -> catat, perbaikan kecil CSS boleh (file `KlirInventoryView.tsx`).

### P4. Isi data contoh lewat UI lalu cek engine (bukan test sintetis)
Tambah 3 produk (1 CONSIGNED, 1 dengan packSize 12 "dus", 1 dengan batch kadaluarsa 5 hari),
1 pelanggan, 1 pembelian, 2 penjualan. Lalu tanya AI CEO: "stok menipis", "produk mati",
"berapa kewajiban konsinyasi", "apa yang mau kadaluarsa". Bandingkan jawaban dengan angka di
tab. Ketidaksesuaian = temuan P1-level, tulis file+baris yang dicurigai.

### P5. Kalau ada waktu: usulan matriks role (dok `2026-09-10-usulan-matriks-role-feature-7-modul.md`)
Ini keputusan Fatur/Mecca. Codex cukup verifikasi tabel vs kode masih akurat setelah batch ini.

## 3. Aturan yang TIDAK boleh dilanggar
- Lane Fatur: auth/login/session/rate-limiter/prisma.ts/api/v1/auth/KlirAuthModal/layout/
  landing/ecosystem/package.json/package-lock.json/deploy script. Baca boleh, ubah HARAM.
- Skema Prisma: hanya ADDITIVE (kolom nullable/default, tabel baru). Tidak ada rename/drop.
- Push GitHub / deploy VPS: HARAM tanpa izin eksplisit Mecca per batch. Commit lokal boleh.
- Klaim "selesai/fix" WAJIB tier bukti. Hasil audit bersih dilaporkan sebagai "temuan: bersih",
  bukan "belum dikerjakan". Kode ada tapi belum dites = "[HIPOTESIS] belum dites ke X".
- Klik otomasi: pakai ref elemen, bukan koordinat screenshot ter-scale (dpr 0.667 meleset).
- Modul (corplan/finance/inventory dst) HARAM jadi label ke user; label user = nama fitur
  ("Stok & Pembelian"). Dashboard = ikhtisar pasif + blok AI analisa/prediksi/rekomendasi;
  AI Assistant = tempat kerja.

## 4. Cara jalan lokal
```
npm run dev                                   (port 3000, DB = Neon produksi, hati-hati data)
npx tsc --noEmit -p tsconfig.json
node --experimental-test-module-mocks --import tsx --test "tests/**/*.test.ts"
```
Login: pakai sesi Chrome Mecca yang sudah login. Jangan buat akun/masukkan sandi.

## 5. Tulis balik
Buat `2026-09-10-codex-to-claude-handoff-2.md` di root repo: per item P1-P5 status + tier +
temuan (file:baris). Claude lanjut setelah kredit reset.
