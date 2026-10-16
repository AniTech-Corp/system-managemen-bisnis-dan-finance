# Protokol Push dan Deploy KLIR (berlaku untuk Mecca, Fatur, dan AI mana pun)

Ditulis 8 September 2026 dari insiden nyata dua hari terakhir. Tujuan: push ke GitHub dan
deploy ke VPS Hostinger tidak lagi bikin tabrakan, spam commit, atau "semua fitur mati".
Dokumen ini pendek dan bisa diikuti siapa pun. Versi mesin untuk Claude ada di skill
`klir-release` (folder `.claude/skills/klir-release/`) dan gate otomatis `push-final-gate`.

## 0. Tiga insiden yang melahirkan protokol ini

| Tanggal | Kejadian | Akar | Pelajaran |
|---|---|---|---|
| 7 Sep siang | Deploy gagal, SSH ditolak | Key deploy dihapus dari authorized_keys tanpa kabar | Perubahan akses server = kabar dulu di grup |
| 7 Sep sore-malam | 5 push + 4 deploy dalam sehari | Loop fix->push per bug | Push hanya batch final, satu kali |
| 7-8 Sep | VPS git pull nolak; localhost "mati semua" | package-lock ditulis ulang di server; akun user dibuat ulang tapi sesi lama masih dipakai | `npm ci` di server; reseed user = wajib logout semua |

## 1. Aturan dasar (5 baris)

1. Satu orang push dalam satu waktu. Yang lain rebase di atasnya SEBELUM push.
2. Push hanya batch final: tsc 0 error, test hijau, smoke di localhost dengan LOGIN ASLI.
3. Deploy hanya setelah push, dan hanya oleh orang yang sedang pegang VPS. Kabar di grup sebelum dan sesudah.
4. Jangan pernah edit file langsung di server. Semua lewat git.
5. Schema database: hanya Fatur (atau izin eksplisit Mecca), selalu additive, selalu `prisma db push` dari satu tempat, lalu kabar.

## 2. Sebelum push (checklist, urut)

```
[ ] git fetch origin  ->  ada commit orang lain? kalau ya: git rebase origin/main
[ ] konflik? selesaikan dengan versi orang lain sebagai dasar, tambahan kita di atasnya
[ ] node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json   -> 0 error
[ ] node --experimental-test-module-mocks --import tsx --test tests/*.test.ts -> 0 fail
[ ] localhost: Keluar Akun -> masuk lagi (sesi segar) -> klik alur inti:
      upload 1 file di Pusat Data, tanya AI 1 kali, buka 3 portal, generate 1 dokumen
[ ] zona merah (auth/session/page.tsx/schema) tidak berubah kecuali disepakati
[ ] commit message menyebut APA + KENAPA; dokumen untuk rekan diperbarui
[ ] kabar 1 baris di grup: "push batch X, isi: ..., butuh deploy: ya/tidak"
```

## 3. Deploy ke VPS (Hostinger, PM2)

```
ssh root@72.61.142.156
cd /var/www/KLIR
git status --short          # HARUS kosong. Kalau ada perubahan lokal = ada yang edit di server, tanya dulu
git pull --ff-only          # kalau ditolak: JANGAN paksa, kabar di grup
npm ci                      # bukan npm install: lock tidak ditulis ulang, package-lock tidak "berubah sendiri"
npx prisma generate
npm run build               # gagal build = app lama tetap jalan, TIDAK reload pm2
pm2 reload klir-os
curl -s -o /dev/null -w "%{http_code}\n" https://klir.laserstory1.id/          # harap 200
curl -s -o /dev/null -w "%{http_code}\n" https://klir.laserstory1.id/api/v1/media/models  # harap 401 (butuh login)
```

Kalau schema berubah (model/kolom baru): `npx prisma db push` dijalankan SATU kali dari mesin
yang punya perubahan itu, SEBELUM deploy kode yang memakainya. DB dev dan produksi sama
(Neon), jadi push schema = langsung ke produksi. Additive saja.

## 4. Setelah deploy

- Kabar di grup: commit hash + jam + apa yang harus dicek.
- Kalau user/akun di-reseed atau tabel user diubah: umumkan "semua harus logout-login",
  karena cookie lama membawa userId yang sudah tidak ada -> 401/500 di mana-mana.
- Rollback: `git checkout <hash sebelumnya> && npm ci && npm run build && pm2 reload klir-os`.

## 5. Akses server

- Key SSH deploy Claude/Mecca: ed25519, ditambahkan via konsol web Hostinger 7 Sep.
  Mengubah `~/.ssh/authorized_keys` = kabar di grup dulu (7 Sep sempat hilang tanpa kabar).
- Jangan taruh kata sandi/kunci di chat, dokumen, atau commit.

## 6. Pembagian jalur (siapa pegang apa)

| Area | Pemilik | Yang lain boleh? |
|---|---|---|
| login/auth/session/page.tsx/layout/landing | Fatur | baca saja; usulan lewat dokumen |
| prisma/schema.prisma | Fatur | additive dengan izin Mecca, wajib dicatat |
| dashboard, AI Assistant, komponen UI, route non-auth, lib AI | Claude/Codex/Mecca | ya |
| VPS/PM2/Traefik/nginx/deploy script | Fatur | deploy boleh kalau Fatur tidak sedang di VPS |
