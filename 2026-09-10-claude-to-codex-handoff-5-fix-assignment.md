# KLIR -- Claude ke Codex Handoff #5: Penugasan Fix (Codex/Astra 6 pegang eksekusi)

Tanggal: 10 September 2026 malam (WIB). Pengirim: Claude Code (Sonnet 5). Penerima: Codex
(jalan di model Astra 6). Keputusan Mecca, verbatim disederhanakan: Claude+Codex tugasnya
cari+verifikasi bug, EKSEKUSI FIX untuk daftar ini dipegang Codex/Astra 6, bukan Claude.

Status saat ditulis: Codex sedang mengerjakan lanjutan bug-hunt (belum di-commit/push ke
repo per pengecekan Claude pukul ini) -- dokumen ini SIAP DIPAKAI begitu lanjutan itu selesai
dan digabung. Claude akan menggabung temuan baru Codex ke
`2026-09-10-bug-hunt-gabungan-claude-codex.md` begitu file itu muncul, lalu update daftar
prioritas di sini kalau ada item baru yang mengubah urutan.

## Sumber kebenaran

Daftar bug lengkap (36 item saat ini: 23 Claude + 11 Codex + 2 Claude cross-verify baru) ada
di `2026-09-10-bug-hunt-gabungan-claude-codex.md`. Dokumen INI cuma nambahin: siapa fix,
urutan mana duluan, dan guardrail yang wajib dipatuhi selama fix -- bukan mengulang detail
teknis tiap bug (baca dokumen sumber untuk file:line lengkap).

## Urutan prioritas yang disarankan Claude (Mecca belum konfirmasi urutan final -- ini usulan)

```
TIER 0 -- BUTUH KEPUTUSAN MECCA DULU, JANGAN LANGSUNG FIX SENDIRI:
  BH-001  credits/topup -- kalau ini reachable produksi, ini duit asli.
          Sebelum nulis fix, konfirmasi dulu ke Mecca: mau endpoint ini
          DIMATIKAN SEMENTARA (feature-flag/return 403) sambil ditambal,
          atau langsung ditambal di tempat sambil endpoint tetap hidup?
          Beda risk profile, Mecca yang mutusin.

TIER 1 -- keamanan tenant-isolation, pola sama berulang, fix bareng:
  BH-002  corplan/share-context -- cross-tenant read
  BH-003  anivirtual/understand -- cross-tenant read/write
  BH-004 / Claude#1  kerja/tasks PUT -- cross-tenant write (dikonfirmasi 2 tim)
  -> SARAN: audit pola withTenantGuard di SEMUA endpoint yang query object
     by-ID (bukan cuma yang 4 ini) sebelum declare tenant-isolation aman --
     baik Claude maupun Codex eksplisit bilang pola ini KEMUNGKINAN berulang
     di endpoint lain yang belum ke-scan (lihat Bagian 6 dokumen sumber).
  Claude#2  brain/chat RBAC-bypass (VIEWER bisa nulis transaksi lewat AI chat)
  BH-014  (baru) AI Brain baca lintas-role tanpa filter -- root cause SAMA
          sama Claude#2 (workspace-knowledge.ts gak filter role), kemungkinan
          1 fix menyelesaikan dua-duanya sekaligus -- cek dulu sebelum fix
          terpisah.
  BH-011  toggle "akses per divisi" di Finance AI Assistant nol efek backend

TIER 2 -- data salah/nyasar (nampak asli padahal bukan) -- prioritas menurut
          dampak ke keputusan bisnis Mecca/user:
  Claude#3, BH-005  grafik harian fiksi + kartu default belum full di-override
  BH-013  (baru) transaksi historis sukses diimpor tapi gaib di dashboard
          (root cause beda dari "belum pernah diklik" -- baca detail di
          dokumen sumber sebelum nge-fix, jangan disamain sama fix BH lain)
  Claude#10  label bulan geser 1 bulan di grafik tren
  Claude#11  "saldo bulan lalu" hasil ekstrapolasi bukan angka asli
  Claude#12  target ROAS hardcode kontradiksi sama logic dinamis
  Claude#13  alert voucher salah kondisi cek
  BH-006, BH-007, BH-008, BH-009  angka "total"/"hari ini" kena cap row atau
          gak direset per hari (4 endpoint beda, root cause beda-beda per
          endpoint, jangan disamain 1 fix)
  BH-010  system/health bocor info -- cukup tutup raw DB error, endpoint
          publik boleh tetap ada (lihat Bagian 5 dokumen sumber, ini bukan
          disarankan dihapus)

TIER 3 -- fungsional (bug nyata tapi bukan data-palsu-ditampilkan-asli):
  Claude#5, Claude#6  lampiran chat nyasar antar-percakapan (Executive+Finance;
          Marketing SUDAH dibenerin sebelumnya -- pola fixnya udah ada,
          tinggal diterapin ke 2 view yang belum)
  Claude#16  foto-jadi-stok buang baris gagal diam-diam
  Claude#15  photo-to-stock bisa dorong stok negatif
  Claude#4  payroll 2-write-terpisah (partial-fail risk)
  Claude#17  tab skor pemasok basi, gak ada refresh manual
  Claude#18  payroll backend selesai tapi nol pintu masuk UI (mungkin ini
          bukan "fix", tapi keputusan produk -- tanya Mecca mau di-expose
          ke UI atau memang sengaja belum)
  Claude#19-22, BH-012  low-severity, kerjain kalau ada waktu sisa

TIER 4 -- spec implementation-ready dari Codex sendiri (bukan "bug" tapi
          fitur yang perlu dibangun):
  Handoff-4 Codex -- domain classification + preview-before-write buat Pusat
          Data (BH-013 di atas relevan ke sini juga -- kalau lagi bangun
          provenance/idempotency, sekalian pastikan default date-range
          dashboard juga dibenerin, biar gak nyisain gaib-jika-historis).
```

## Guardrail wajib (SAMA kayak sepanjang sesi ini, bukan hal baru)

- Tenant isolation, evidence-tier ([LIVE]/[LOKAL]/[TEST]/[HIPOTESIS]/[BELUM]), tsc+test+build
  hijau SEBELUM commit -- standar yang sama kayak fix handoff-2 kemarin.
- Lane Fatur (login/auth/session/membership/schema/landing page) TETAP HARAM disentuh tanpa
  handoff eksplisit dari Fatur/Mecca -- termasuk BH-001 kalau fix-nya ternyata butuh nyentuh
  schema Prisma (tanya dulu, jangan asumsi additive aman).
- Push/deploy TETAP butuh izin eksplisit Mecca per batch (bukan otomatis lanjut dari izin sesi
  sebelumnya yang sudah lewat) -- release-protocol skill, push-final-gate hook.
- Fix yang menyentuh file yang lagi/baru diubah Fatur -- cek `git log`/`git diff` dulu, jangan
  asumsi dari nama folder (pola M-lama yang sudah pernah salah).
- Kalau nemu bug BARU pas lagi fix (bukan yang di daftar ini) -- catat, JANGAN diam-diam expand
  scope tanpa bilang balik ke Claude/Mecca.

## Apa yang Claude lakukan setelah ini

Standby nunggu lanjutan bug-hunt Codex selesai+dikirim. Begitu diterima: gabung ke dokumen
sumber, update urutan prioritas kalau perlu, dan available untuk cross-verify hasil fix Codex
(bukan ikut nulis kode paralel di file yang sama, biar gak tabrakan -- lihat
`KLIR/AGENTS.md` dan `00-PETA-STRUKTUR-PROJECT.md` soal lane).
