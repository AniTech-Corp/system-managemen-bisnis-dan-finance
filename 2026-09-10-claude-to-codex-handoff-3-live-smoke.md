# Handoff Claude (Sonnet 5) -> Codex -- 10 September 2026 sore, live-smoke P1-P3

Konteks: batch dari handoff-2 kamu (intent "produk mati" + invoice-reminder data real) sudah
diverifikasi ulang oleh Claude (tsc 0, suite 1472/1472, build PASS, zona merah nol diff),
di-commit `5390f54`, di-push, dan DI-DEPLOY ke produksi. Status sekarang:

```
GitHub main        5390f54 (di atas d1038ba)                              [LIVE]
VPS 72.61.142.156   /var/www/KLIR @ 5390f54, pm2 klir-os online, pid baru   [LIVE]
                    curl / 200, media/models 401, inventory/products 401,
                    kas/piutang-reminder 401 (guard hidup), pm2 error log kosong
rollback            git checkout d1038ba && npm ci && npm run build && pm2 reload klir-os
```

## Update (sama hari, setelah handoff ini dikirim): kredensial demo

Mecca sudah kasih 3 akun demo (CEO/Finance/Marketing, password sama semua) langsung di chat,
persis yang dulu pernah dia kirim ke Fatur. Ditaruh di file LOKAL terpisah, SENGAJA tidak
di-track git (lihat `.gitignore` pola `*-LOCAL-ONLY.md`) supaya kredensial gak masuk history:
`2026-09-10-codex-qa-login-credentials-LOCAL-ONLY.md` (folder yang sama dengan file ini).
Kalau file itu gak ada di worktree kamu (beda clone dari Claude), minta Mecca kirim ulang --
JANGAN nebak/scrape kredensial dari sumber lain.

## Kenapa dilempar balik ke kamu

Claude (sesi ini) secara fisik/aturan **HARAM mengetik password** di browser manapun (Cloud
Browser preview pane atau Chrome MCP) -- ini aturan keras yang tidak bisa di-override
meskipun Mecca eksplisit bilang boleh. Jadi 3 item live-smoke di bawah, yang butuh sesi
login KLIR, tidak bisa Claude lanjutkan sendiri. Kamu di handoff-2 sudah kelihatan punya
akses ke sesi terautentikasi (dipakai buat QA fixture `QA-CODEX-*-20260910-0730`), jadi ini
balik ke kamu.

## Yang perlu kamu kerjakan (urut prioritas)

### P1. Repro "Maximum update depth exceeded" di composer AI CEO
Sudah dilihat 2x oleh Fable (tab lama, sering ganti portal via localStorage), repro di tab
bersih = 0/4. Kalau ketemu lagi: tangkap component stack persis dari console.error SEBELUM
nambal apapun. Kalau tetap 0 repro setelah beberapa percobaan wajar, tulis "tidak
direproduksi, kemungkinan artefak tab-lama" -- jangan dipaksa nyari fix untuk bug yang belum
jelas akarnya.

### P2. Smoke AI Marketing lewat tombol nav asli
Buka portal Marketing -> klik tombol "AI Asisten Marketing" (BUKAN localStorage
klir_marketing_nav) -> ketik 1 pertanyaan -> cek konsol 0 error, panel proaktif render wajar
(boleh 0 kartu), katalog produk (kalau ada) baca-saja di copywriting/kalender.

### P3. Mobile 375px -- sekarang ada kandidat konkret dari static audit
Claude sudah grep `KlirInventoryView.tsx` dan nemuin banyak `gridTemplateColumns` 2-3 kolom
TANPA media query. **TIDAK ditambal blind** (belum ada konfirmasi visual). 4 yang paling
berisiko (kemungkinan besar layout form+detail sisi-bersisian yang kepepet di 375px):
- baris 1561, 2053, 2286, 2369: `gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.6fr)'`

Daftar lengkap grid tanpa breakpoint (severity lebih rendah, kebanyakan kartu stat 2-3 kolom
yang mungkin masih oke di 375px tapi layak dicek): baris 1568, 1591, 1601, 1612, 1754, 1764,
1778, 1901, 1909, 1944, 2013, 2032, 2060, 2073, 2153, 2200, 2216, 2293, 2381.

Langkah: pasang/restore runner devtools/Playwright yang benar (jangan anggap static inspection
sebagai mobile E2E, seperti sudah kamu catat sendiri di handoff-2), cek satu-satu baris di
atas pada viewport 375px sesi login asli. Yang beneran patah -> perbaikan CSS aditif
(breakpoint/flex-wrap/stack-vertical di bawah 400px), tetap di file `KlirInventoryView.tsx`
saja. Yang ternyata masih oke -> catat "diperiksa, aman" biar gak dicek ulang orang lain.

### P5 (opsional/rendah prioritas). Refresh nomor baris `2026-09-10-usulan-matriks-role-feature-7-modul.md`
Semua sitasi baris ke `CompanyDataDashboard.tsx` di dokumen itu BASI -- ditulis SEBELUM commit
`6df0cd6` (build wave F3b+F4) nambah ratusan baris. Contoh: "Snapshot Perusahaan" tercatat
baris 1152, aktual sekarang 1442 (geser +290). Klaim FUNGSIONAL (fitur ada/tidak) kemungkinan
besar masih benar (6df0cd6 sifatnya additive) tapi belum di-spot-check satu-satu. Kalau ada
waktu: refresh nomor baris via grep ulang tiap section header, ATAU cukup tambah 1 baris
disclaimer di bagian 9 "cek ulang ke kode langsung, nomor baris per 10 Sep sore sudah basi
sebagian besar pasca 6df0cd6".

## Aturan yang TIDAK boleh dilanggar (sama seperti handoff sebelumnya, ditegaskan ulang)

Mecca baru saja menegaskan ulang lane (dicatat di `KLIR/00-PETA-STRUKTUR-PROJECT.md` bagian
IRON RULE, baca itu sebagai sumber utama): **lane Fatur = login/auth/session DAN landing
page SAJA.** Di luar itu boleh dipegang dan disempurnakan -- termasuk fitur yang SUDAH Fatur
push sebelumnya, bukan cuma kode baru. Yang tetap berlaku:
- Skema Prisma: hanya ADDITIVE. Tidak ada rename/drop.
- Push GitHub / deploy VPS: untuk BATCH INI (P1/P2/P3/P5 di atas) tetap HARAM tanpa izin
  eksplisit Mecca per batch -- izin 3 jam yang dipakai Claude buat deploy `5390f54` sudah
  dipakai/selesai, bukan izin berkelanjutan. Commit lokal boleh.
- Klaim "selesai/fix" WAJIB tier bukti [LIVE]/[LOKAL]/[TEST]/[HIPOTESIS]/[BELUM].
- Data QA `QA-CODEX-*-20260910-0730` di Neon: JANGAN dihapus tanpa izin eksplisit Mecca
  (sudah dicatat di handoff-2 kamu sendiri).
- Klik otomasi: pakai ref elemen, bukan koordinat screenshot ter-scale.

## Tulis balik

Buat `2026-09-10-codex-to-claude-handoff-3.md` di root repo: status P1/P2/P3/P5 per item,
tier bukti, temuan (file:baris), dan CSS fix P3 kalau ada (diff kecil, additive).
