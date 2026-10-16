# ADENDUM FASE 2 -- 11 Sep 2026 siang (arahan susulan Mecca, dikerjakan KOMANDO tanpa workflow agent)

> Lampiran dari 2026-09-11-CONTEXT-PACK-integrasi-ai-data-model-hemat.md. Tiga arahan susulan
> Mecca setelah workflow pertama jalan: (A) model yang LITERAL lebih murah + AI mendeteksi
> "butuh kredit besar atau seadanya"; (B) pertanyaan data ringan ("gaji saya bulan ini",
> "tugas minggu depan") harus efektif; (C) "USB ditancap": file yang diupload langsung dibaca
> semua, meski berantakan, dan langsung terintegrasi ke seluruh sistem.
> Aturan kredit dari Mecca: TIDAK ada workflow agent baru tanpa izin. Fase 2 = komando.

## A. Tier model revisi (menggantikan tabel di kontrak modul 1)

Sumber: docs/2026-09-11-openrouter-catalog-screening.md (live 11 Sep, 437 model teks, 52 model
gambar, 29 model video). Harga USD per juta token prompt/completion.

```
tier       dipakai untuk                          primary                          fallbacks (urut)
---------  -------------------------------------  -------------------------------  ------------------------------------------------
santai     sapaan, konfirmasi, tanya ringan       qwen/qwen3.7-flash 0.030/0.130   deepseek/deepseek-v4-flash-0731, google/gemma-4-26b-a4b-it
hemat      chat normal (DEFAULT), ekstraksi JSON, deepseek/deepseek-v4-flash-0731  google/gemma-4-26b-a4b-it, openai/gpt-5-nano,
           brief perusahaan, insight dashboard    0.065/0.180                      google/gemini-3.1-flash-lite
standar    serius / analis / riset                deepseek/deepseek-v4-pro         moonshotai/kimi-k2.5, z-ai/glm-5.2
                                                  0.955/1.911 (reasoning)
maksimal   pilihan user saja                      google/gemini-3.5-flash          deepseek/deepseek-v4-pro, z-ai/glm-5.2
                                                  1.500/9.000 reasoning high
video      default Studio                         bytedance/seedance-2.0-mini      bytedance/seedance-2.0 (env OPENROUTER_VIDEO_MODEL)
gambar     default (tidak diubah)                 google/gemini-3.1-flash-image
```
Env override per tier: OPENROUTER_MODEL_SANTAI / _HEMAT / _STANDAR / _MAKSIMAL.
Alasan tidak memakai :free (rate-limit, bisa hilang) dan :batch (asinkron, bukan chat).
Perubahan mekanis: MODEL_TIERS bertambah tier 'santai'; resolveTierForEffort: santai->santai,
normal/undefined->hemat, serius->standar, maksimal->maksimal. JSON_EXTRACTION_MODEL =
deepseek/deepseek-v4-flash-0731. Response chat membawa `creditHint` (lihat B).

## B. Quick-data router (NOL LLM) + creditHint

File baru: src/lib/ai-brain/quick-data-router.ts (+ tests/quick-data-router.test.ts).
Pola sama dengan HPP/KUR/inventory di chat route (deterministik dulu, LLM belakangan).
Intent -> sumber -> jawaban ringkas (markdown, angka dari DB, sebut periode):
- gaji/payroll saya bulan ini/lalu       -> EmployeePayroll (match employeeName ~ nama user)
- tugas saya / tim minggu ini/depan      -> WorkTask (dueDate dalam jendela, status != DONE)
- rencana/agenda/jadwal minggu depan     -> WorkTask + ScheduledObligation + BookingReservation
- tagihan/kewajiban jatuh tempo          -> ScheduledObligation + Invoice UNPAID/OVERDUE
- saldo kas sekarang / kas bulan ini     -> CashTransaction agregat (reuse resolveDateRange)
- stok menipis                           -> sudah ada (inventory intent), tidak diduplikasi
Kalau data kosong: jawab jujur "belum ada catatan X" + arahkan modul. Tidak pernah LLM.
Deteksi = regex ketat (harus ada kata kunci entitas + tidak ada kata analitis); kalau ada
kata analitis (kenapa/analisis/strategi/prediksi/bandingkan) -> lewati, biar LLM.
creditHint di response chat: { tier: 'nol'|'santai'|'hemat'|'standar'|'maksimal',
label: 'Tanpa kredit AI (dibaca dari data)' | 'Model hemat' | ... , estimatedTokens }.

## C. Auto-ingest "USB" (file masuk -> langsung terintegrasi)

Prinsip yang TIDAK berubah: angka finansial HANYA dari parser deterministik, tidak pernah
dari LLM. Yang berubah: tidak lagi menunggu klik "Impor" untuk tabel yang confidence tinggi.

Jalur per jenis file (dideteksi setelah ekstraksi, di workspace-files/route.ts):
1. Ledger klasik (chart-of-accounts + sheet kas)      -> AUTO impor CashTransaction (deterministik penuh),
                                                         linkedRecordIds diisi, deskripsi "(impor otomatis dari <file>)".
2. Tabel transaksi generik confidence >= 0.70         -> AUTO impor CashTransaction. Confidence 0.30-0.69
   (mis. daftar-transaksi-mentah.csv 0.80)              (mis. laporan-penjualan-bulanan.xlsx ~0.35, risiko dobel-hitung)
                                                         -> TIDAK auto; dashboard nudge "1 file butuh konfirmasi impor".
3. Data stok/produk (kolom nama+stok/harga)           -> AUTO upsert Product by (workspaceId, sku|nama) -- detektor baru
                                                         deterministik (data-inventori-stok.xlsx).
4. Data karyawan/payroll (nama+gaji)                  -> AUTO EmployeePayroll per baris, monthYear dari file/nama file
                                                         atau bulan upload -- detektor baru deterministik.
5. Laba-rugi / ringkasan bulanan (periode bulanan)     -> TIDAK jadi transaksi (agregat). Masuk brief + insight sebagai
                                                         "angka tertulis di dokumen" dengan sumber.
6. Notulen / proposal / presentasi / gambar / pdf      -> brief perusahaan (sudah, fase 1) + EKSTRAKSI TUGAS via LLM hemat
                                                         (task = bukan uang, risiko rendah): WorkTask status TODO,
                                                         description diawali "[usulan AI dari <file>]", maksimal 10 per file.
Semua auto-ingest: idempoten (hash file+baris -> dedup; file yang sama diupload 2x tidak dobel),
bisa dibatalkan per file (DELETE record turunan via linkedRecordIds -- endpoint baru
POST /api/v1/workspace-files/[id]/undo-ingest), dan dilaporkan di respons upload
(`ingest: { kind, created, skipped, warnings }`) + di WorkspaceDataHub ("Masuk ke Buku Kas: 128
baris; Produk: 24; Payroll: 8; Tugas usulan: 5; 1 file menunggu konfirmasi").
Dashboard: sumberData insight membedakan "transaksi tercatat" vs "impor otomatis dari dokumen"
(hitung dari deskripsi "(impor otomatis dari"). Belum diverifikasi -> tetap masuk angka, tapi
peringatan di insight kalau file punya blok [PEMERIKSAAN DATA] kritis.

Urutan kerja komando: A (tambal model-tiers + tests) -> B (router + wiring chat route + test)
-> C1-C2 (auto impor ledger; reuse import-ledger logic ke modul bersama) -> C3-C4 (detektor
produk/payroll) -> C6 (tugas usulan) -> undo + UI Hub + insight sumberData. Tiap langkah:
tsc + test terkait. Kalau C butuh lebih dari kemampuan komando dalam sesi ini, lapor ke Mecca
dengan estimasi sebelum memanggil agent.
