# KLIR -- Claude ke Codex Handoff #6: Paket Implementasi Final (menggantikan handoff-5)

Tanggal: 10 September 2026 malam (WIB). Pengirim: Claude Code (Sonnet 5). Penerima: Codex
(jalan di model Astra 6). Status: SIAP DIEKSEKUSI -- semua temuan di bawah sudah melalui
verifikasi silang, gak ada lagi yang nunggu.

Dokumen ini menggantikan `2026-09-10-claude-to-codex-handoff-5-fix-assignment.md` (biarkan
file lama tetap ada sebagai histori, jangan dihapus) karena sejak handoff-5 ditulis, Codex
mengirim 10 temuan baru (DEEP-001..010, `2026-09-10-codex-deep-bug-hunt-diagnosis.md`) yang
Claude sudah verifikasi (20 agent Sonnet, 2 skeptic independen/temuan, **10/10 lolos, 0
dibantah**) dan digabung ke registry. Total sekarang **46 temuan**.

## Sumber kebenaran

`2026-09-10-bug-hunt-gabungan-claude-codex.md` Bagian 1-4 (36 temuan batch 1) + Bagian 7
(10 temuan DEEP, verified). Dokumen INI cuma urutan eksekusi + guardrail -- baca dokumen
sumber untuk detail teknis/evidence lengkap tiap item.

## SATU keputusan yang masih butuh Mecca -- BUKAN teknis, ini keputusan bisnis

```
BH-001 -- credits/topup/route.ts:43-80
Top-up saldo kredit langsung nambah CreditAccount dari workspaceId yang dikirim
client sendiri, TANPA verifikasi pembayaran/webhook/idempotency.

Ini SATU-SATUNYA item di 46 temuan yang Claude sengaja TIDAK kasih ke Codex buat
dieksekusi langsung -- karena fix-nya punya 2 opsi dengan trade-off bisnis nyata:
  (a) matikan/return-403 endpoint ini SEMENTARA sampai ditambal (aman, tapi kalau
      endpoint ini genuinely dipakai user buat top-up asli sekarang, fitur itu mati
      total selama proses fix)
  (b) tambal di tempat sambil endpoint tetap hidup (user gak kerasa apa-apa, tapi
      window kerentanan tetap terbuka selama proses fix berjalan)
Codex JANGAN mulai kerjain BH-001 sebelum Mecca pilih (a) atau (b). Semua 45 item
lain di bawah TIDAK butuh keputusan ini -- itu murni perbaikan teknis, silakan gas.
```

## Urutan eksekusi (GATE 1-5, kerangka dari Codex + penyesuaian Claude)

```
GATE 1 -- destructive + financial authorization (PALING URGENT setelah BH-001 diputuskan)
  DEEP-003  bulk cash delete oleh MEMBER -- naikkan minRole + tambah confirmation
            token, ini SATU-nya di GATE 1 yang gak nunggu Mecca (murni hardening,
            gak ada legitimate use-case MEMBER hapus semua kas)
  DEEP-004  approval replay -- resolver wajib cek status===PENDING sebelum proses
  DEEP-002 + DEEP-009 -- WAJIB SATU PAKET, BUKAN DUA ITEM TERPISAH:
            sambungkan spending-approval-guardrail.ts ke PO endpoint (DEEP-002)
            SEKALIGUS kasih atomic compare-and-set ke resolver-nya (DEEP-009).
            Kalau cuma DEEP-002 yang disambung tanpa DEEP-009, race condition-nya
            langsung naik dari P2 (audit-trail ganda) ke P1/P0 (duplicate approval
            beneran buat pengeluaran nyata) -- itu bikin situasi LEBIH BURUK dari
            sebelum di-fix, bukan lebih baik.
  DEEP-001  brain/execute -- resolve recommendation dari server-side source +
            idempotency key + allowlist actionType

GATE 2 -- tenant isolation (batch 1, existing)
  BH-002  corplan/share-context cross-tenant read
  BH-003  anivirtual/understand cross-tenant read/write
  BH-004 / Claude#1  kerja/tasks PUT cross-tenant write (dikonfirmasi 2 tim independen)
  Claude#2 + BH-014  AI Brain RBAC-bypass (nulis) + AI Brain baca lintas-role tanpa
            filter -- root cause SAMA (workspace-knowledge.ts gak filter role),
            cek dulu apa 1 fix nutup dua-duanya sebelum bikin fix terpisah
  BH-011  toggle "akses per divisi" nol efek backend
  -> SETELAH 4 item tenant-isolation di atas selesai: audit pola withTenantGuard
     di SEMUA endpoint yang query object by-ID (bukan cuma yang di-scan) -- baik
     Claude maupun Codex 2x bilang pola ini kemungkinan berulang di tempat lain.

GATE 3 -- financial consistency
  DEEP-005  import-ledger linkage write terpisah -- state machine PENDING/
            PROCESSING/COMMITTED/FAILED, reconciliation sebelum retry
  DEEP-006  aggregate kas gak ikut filter type/category
  DEEP-007  invoice/payroll/booking split-write status-vs-ledger -- transaction
            boundary yang sama, atau sourceType/sourceId idempotency key
  BH-013    transaksi historis sukses-tapi-gaib (default date-range bulan-berjalan
            di dashboard) -- terhubung ke DEEP-005/007, kerjain bareng biar gak
            nyisa 1 lubang lagi soal tanggal
  BH-006, BH-007, BH-008, BH-009  angka "total"/"hari ini" kena cap row atau gak
            direset per hari (4 endpoint beda, root cause beda-beda, jangan disamain)

GATE 4 -- data truth / UI
  Claude#3, BH-005  grafik harian fiksi + kartu default belum full di-override
  Claude#10, #11, #12, #13, #14  label bulan geser, ekstrapolasi saldo, ROAS
            hardcode, alert voucher salah kondisi, proyeksi pakai bulan browse
  BH-010    tutup raw DB error di system/health (endpoint publiknya SENDIRI
            boleh tetap ada, cuma raw error-nya yang ditutup)
  DEEP-010  sanitized error contract -- pola sistemik (80+ lokasi kata skeptic),
            bikin 1 error-response helper reusable, jangan tambal manual per file

GATE 5 -- fungsional + sisa coverage
  Claude#5, #6  lampiran chat nyasar antar-percakapan (Executive+Finance -- pola
            fix Marketing udah ada, tinggal diterapin)
  Claude#16, #15  foto-jadi-stok buang baris diam-diam, stok bisa negatif
  Claude#4  payroll 2-write-terpisah (ini instance SPESIFIK dari pola umum
            DEEP-007, kerjain bareng GATE 3 kalau memungkinkan)
  Claude#17, #18  tab skor pemasok basi, payroll backend tanpa pintu UI
            (#18 mungkin keputusan produk, bukan bug -- tanya Mecca cuma kalau
            mau expose ke UI, bukan buat "fix"-nya sendiri)
  Claude#19-22, BH-012  low-severity, kerjain kalau ada waktu sisa
  DEEP-008  metadata approval dari client -- derive dari auth di titik create,
            bukan cuma di titik resolve
  Handoff-4 Codex (Pusat Data classification+preview-before-write) -- fitur
            implementation-ready, bukan bug, tapi relevan ke BH-013/DEEP-005 di
            atas kalau lagi bangun provenance/idempotency sekalian
  Coverage gap yang Codex sendiri akui belum disentuh (full-read brain/chat 2333
            baris, 24/38 ai-brain lib, browser live smoke, mobile viewport) --
            BUKAN "aman", cuma belum sempat -- kalau ada kapasitas, prioritaskan
            brain/chat full-read duluan (paling banyak side-effect finansial)
```

## Guardrail wajib (sama seperti handoff-5, tidak berubah)

- Evidence-tier ([LIVE]/[LOKAL]/[TEST]/[HIPOTESIS]/[BELUM]), tsc+test+build hijau SEBELUM
  commit -- standar yang sama kayak fix handoff-2.
- Lane Fatur (login/auth/session/membership/schema/landing page) TETAP HARAM disentuh tanpa
  handoff eksplisit -- termasuk kalau fix DEEP-001..010 ternyata butuh nyentuh schema Prisma
  (mis. tambah field idempotency-key/state-machine), tanya dulu, jangan asumsi additive aman.
- Push/deploy TETAP butuh izin eksplisit Mecca per batch -- release-protocol skill,
  push-final-gate hook. Mengingat 46 item ini besar, Codex boleh (disarankan) push per-GATE
  selesai (bukan nunggu 46 item semua kelar baru push sekali) -- tapi tiap batch push tetap
  minta izin Mecca dulu, jangan otomatis lanjut dari izin batch sebelumnya.
- Kalau nemu bug BARU pas fix (bukan yang di 46 daftar ini) -- catat, JANGAN diam-diam expand
  scope tanpa bilang balik ke Claude/Mecca.
- DEEP-002+DEEP-009 WAJIB satu PR/batch yang sama (lihat GATE 1) -- jangan dipisah.

## Apa yang Claude lakukan setelah ini

Standby. Available buat cross-verify hasil fix per-GATE begitu Codex selesai satu gate
(bukan nunggu semua 46 kelar) -- biar temuan yang salah-tambal ketauan cepat, bukan numpuk
di akhir. Gak ikut nulis kode paralel di file yang sama biar gak tabrakan (lihat
`KLIR/AGENTS.md` soal lane).
