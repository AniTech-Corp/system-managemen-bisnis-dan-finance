<role>
Claude Code, model Fable 5.1 (pilihan Mecca), lanjut kerja di project KLIR. Disposisi:
execute-first untuk hal yang sudah jelas jawabannya di memori/histori di bawah, finish-before-
report untuk tiap fase, no-solo untuk keputusan produk/arsitektur (harus dikonfirmasi Mecca
dulu), no-push tanpa izin eksplisit Mecca di momen itu juga (bukan izin dari histori chat lama).
Sesi sebelumnya (Sonnet, ID 2bf1e19e dan beberapa sesi sebelumnya di hari yang sama) sudah jadi
kepanjangan, makanya di-handoff ke sesi baru supaya tidak ada drift konteks.
</role>

<objective>
Lanjutkan kerja KLIR dari titik ini tanpa perlu bertanya ulang hal yang sudah dijawab di bawah,
tanpa berhalusinasi soal status yang sudah diverifikasi, dan tanpa mengulang riset yang sudah
dilakukan. Prioritas langsung: audit dan tuntaskan item yang sudah diserahkan Codex, sambil
tetap menjaga lane Fatur dan menahan push sampai Mecca bilang eksplisit.
</objective>

<context>
Baca dulu, urutan ini, sebelum eksekusi apapun:

1. `AGENTS.md` (root KLIR/) dan `00-PETA-STRUKTUR-PROJECT.md` -- aturan lintas-AI dan Iron Rule.
2. `2026-09-09-claude-to-codex-handoff.md` (root repo ini) -- konteks yang dikirim ke Codex.
3. `2026-09-09-codex-ui-parity-review.md` -- audit parity + data-honesty pertama Codex.
4. `2026-09-10-codex-to-claude-handoff.md` -- handoff resmi Codex ke Claude, isinya P0/P1 yang
   masih terbuka. Ini dokumen paling penting untuk dibaca detail, jangan dilewat.
5. `2026-09-10-codex-follow-up-ui-integration.md` -- laporan QA lanjutan Codex, termasuk bukti
   localhost per role dan temuan bug navigasi Finance.
6. `2026-09-10-roadmap-inventory-ai-distributor.md` -- roadmap teknis yang ditulis sesi ini
   untuk integrasi AI ke modul Inventory dan segmen Distributor yang baru ditemukan.
7. Empat transkrip verbatim mentah di `Claude-Code-Memory/daily/verbatim/` tanggal 9 September
   (sesi 1039dac9, 33825b6e, 5843d301, 5b376eae) -- kalau butuh kata-kata asli Mecca soal
   keputusan ROLE/MODULE/FEATURE atau histori sebelum sesi ini.
8. Memory pointer yang ditulis sesi ini (auto-memory, bukan Claude-Code-Memory): baca
   `MEMORY.md` lalu buka satu per satu -- `reference_klir_role_modul_fitur_arsitektur_final_9sep`,
   `project_klir_segmen_distributor_baru_8sep`, `project_klir_dokumen_update_31agustus_ke_9sep`,
   `project_klir_inventory_modul_baru_dan_megaco_presentasi_8sep`.

KONDISI YANG SUDAH PASTI, jangan ditanya ulang ke Mecca dan jangan di-scan ulang dari nol:

Arsitektur ROLE vs MODULE vs FEATURE sudah dikunci Mecca (dikonfirmasi dua kali, sekali ke
Codex sekali ke sesi Claude sebelumnya, isinya identik jadi bukan konflik). Role itu jabatan
login yang menentukan cakupan akses -- CEO/Owner selalu superset dari tujuh modul yang aktif,
Finance dan Marketing hanya melihat feature yang relevan dengan kerjaannya meski feature itu
lintas modul. Modul (CorPlan, Personal, Finance, Advertising, Management, Schedule, Inventory)
itu cuma pengelompokan internal untuk gating di backend, namanya HARAM muncul sebagai label yang
dibaca user di dashboard atau AI Assistant -- yang tampil ke user adalah nama feature-nya
langsung. Dashboard fungsinya overview pasif berisi data, grafik, status, dan insight ringkas;
AI Assistant adalah tempat kerja utama tempat semua feature yang terintegrasi AI benar-benar
dijalankan. Standar kualitas AI-nya sendiri datang dari arahan ayah Mecca: AI wajib membandingkan
target terhadap realisasi historis, memberi proyeksi ke depan, dan memberi rekomendasi konkret --
tapi tidak boleh mengarang sebab bisnis kalau data sumbernya (kanal, produk, biaya, transaksi)
belum tersedia. Contoh yang sudah jadi kode nyata untuk pola ini: `sales-target-engine.ts`.

Dua dokumen bisnis (Penjelasan Produk dan Roadmap KLIR, versi 9 September) sudah selesai
dibangun ulang pakai python-docx langsung (bukan lewat konverter markdown yang gagal mengubah
tabel jadi tabel Word asli), sudah diverifikasi render-nya, dan sudah dikirim ke Mecca. Lokasinya
di `KLIR/05-DOKUMEN/aktif/2026-09-09-update-dokumen-31agustus/`. Roadmap-nya sudah diperbarui
dengan temuan dari empat transkrip rekaman yang dikirim Adnan tanggal 8 September: ada segmen
pitch baru bernama Distributor (perantara pabrik ke warung, skala dus/lusin, beda dari UMKM yang
skala satuan), muncul sebagai perluasan dari pitch MegaCo, ditarget siap sekitar minggu 15
September tapi masih tahap penyusunan. Ini BUKAN laporan resmi hasil meeting MegaCo -- sumbernya
rekaman diskusi/demo internal, jadi kalau ditanya hasil pasti presentasi MegaCo 8 September,
jawabannya tetap belum tercatat resmi, bukan sudah confirmed.

KLIR Inventory (modul ketujuh) backend-nya sudah lengkap: model Prisma `Product`,
`StockMovement`, `PurchaseOrder`, `PurchaseOrderItem`, `StockReturn`, `SupplierScore`, plus lima
endpoint API (`consignment`, `photo-to-stock`, `purchase-orders`, `returns`, `supplier-score`).
Yang belum ada sama sekali adalah tampilan UI-nya di dashboard maupun AI Assistant manapun --
ini gap paling kritis yang ditemukan lewat audit kode langsung, bukan asumsi, dan jadi Fase 0 di
roadmap yang sudah ditulis.

Riset kompetitor (tiga pencarian web independen) mengonfirmasi bahwa segmen distributor kecil-
menengah yang jalan pakai sales agent keliling ke warung itu genuinely kurang terlayani di
pasar -- software distribusi enterprise (HashMicro, ScaleOcean, Ukirama) menyasar distributor
besar berskala gudang formal, sementara POS UMKM (Moka, Majoo, Qasir, Pawoon) menyasar toko satu
lokasi. Riset global juga menemukan bahwa kegagalan AI forecasting di industri distribusi itu
mayoritas soal data kotor, bukan soal algoritmanya -- ini jadi keunggulan struktural KLIR karena
schema Product/StockMovement-nya sudah rapi dari awal.

Codex sudah menyelesaikan putaran kerjanya (belum ada `git push`, belum ada commit baru --
worktree masih dirty dengan 37 file, semuanya sudah lolos `tsc --noEmit` exit 0 dan 1166 test
pass 0 fail). Statusnya BUKAN "semua beres", Codex sendiri secara jujur memisahkan mana yang
sudah divalidasi di localhost dan mana yang masih terbuka -- detail lengkapnya ada di
`2026-09-10-codex-to-claude-handoff.md`, jangan disimpulkan sendiri dari ringkasan ini saja.

Remote origin/main sekarang ahead 36 dan behind 4 dari local main. Empat commit Fatur yang
mendahului itu sudah diperiksa Codex satu per satu: dua commit (`de2d83d` perbaikan guard AI
ROAS/runway fiktif, `3d2249e` perbaikan kalkulasi budget Marketing) sudah diporting manual ke
worktree, dua commit lain (`ea619b1`, `6f1aaf3`) sengaja tidak digabung karena isinya menghapus
banyak riwayat sesi dan log yang justru harus dijaga.

Smart-dispatch Workflow (tool multi-agent) masih dalam status DITAHAN sejak Mecca minta begitu
tanggal 9 September karena kredit sesi sempat mepet 89 persen -- belum ada konfirmasi eksplisit
dari Mecca bahwa kreditnya sudah reset. Kalau sesi ini genuinely butuh Workflow, tanya dulu,
jangan langsung jalankan sendiri.

Stack Prisma/database/auth/login/session/`.env` tetap lane Fatur sepenuhnya, jangan disentuh
tanpa handoff eksplisit darinya lewat Mecca.
</context>

<workflow>
Fase pertama, audit ulang klaim sebelum eksekusi apapun. Bukan basa-basi -- ini supaya tidak
mewarisi kesalahan siapa pun secara diam-diam. Jalankan `git status --short` dan `git log -5
--oneline` di `klir-repo-clone`, bandingkan hasilnya dengan yang tertulis di context di atas.
Kalau sudah berubah (misalnya Codex ternyata sempat commit setelah handoff ini ditulis), jangan
langsung percaya dokumen ini -- dokumen ini benar per waktu penulisannya, bukan kebenaran abadi.
Baca juga isi lengkap `2026-09-10-codex-to-claude-handoff.md` kalau belum, karena ringkasan di
context di atas sengaja dipadatkan dan tidak menggantikan detail reproduksi bug di sana.

Fase kedua, reproduksi dan perbaiki bug navigasi Finance yang dilaporkan Codex sebagai P0. Bug-
nya spesifik: di Finance AI Assistant, klik mouse pada tombol header "Dashboard Keuangan & Kas"
tidak memindahkan tampilan, padahal aktivasi keyboard Enter pada tombol yang sama berhasil, dan
arah sebaliknya (dashboard ke AI) berhasil lewat mouse. Marketing tidak kena bug yang sama.
Codex sudah mengecek bahwa handler-nya di `src/app/page.tsx` (memanggil `setFinanceActiveNav`
dan menulis ke localStorage) sudah benar secara logika, jadi akar masalahnya kemungkinan di
lapisan lain -- stacking context CSS, elemen lain yang menangkap event klik duluan, atau
perbedaan struktur DOM header Finance dibanding Marketing. Jangan menambah fallback acak sebelum
akar penyebabnya ketemu, dan setelah diperbaiki wajib ada regression test yang benar-benar
mensimulasikan klik mouse, bukan cuma aktivasi keyboard, supaya bug yang sama tidak lolos lagi
diam-diam.

Fase ketiga, mulai Fase 0 dari roadmap Inventory kalau Mecca sudah mengonfirmasi boleh jalan
(lihat bagian keputusan terbuka di roadmap itu, jangan diasumsikan otomatis boleh). Isinya
memasang tampilan Stok & Pembelian yang sudah ada datanya ke dashboard CEO dan ke Finance AI
Assistant, memakai pola yang sama seperti dulu KlirScheduleView dipasang ke `page.tsx`. Ini
murni menyalakan yang sudah dibangun, bukan menambah fitur baru, jadi risikonya rendah.

Fase keempat, siapkan tabel usulan matriks role-ke-feature untuk tujuh modul seperti yang
diminta Codex di P1, tapi jangan diimplementasikan ke kode sebagai RBAC permanen sebelum Mecca
menyetujui secara eksplisit -- ini keputusan produk, bukan sesuatu yang aman ditebak dari pola
kode yang sudah ada.

Sepanjang keempat fase ini, jaga disiplin bukti: bedakan tegas antara yang benar-benar
dieksekusi di browser localhost, yang cuma lolos test suite otomatis, dan yang belum diuji sama
sekali. Codex sudah memberi contoh yang baik soal ini di kedua laporannya -- pertahankan standar
yang sama, jangan menurunkannya.
</workflow>

<must_invoke>
Tidak ada Workflow multi-agent yang wajib dijalankan otomatis di sesi ini -- statusnya masih
ditahan sampai Mecca konfirmasi kredit reset. Kalau butuh riset web tambahan, WebSearch boleh
dipakai langsung tanpa izin. Kalau OpenRouter Bridge sempat dicoba dan kena error 402 (kredit
habis), itu normal per hari ini, alihkan ke riset via WebSearch saja tanpa menunggu.
</must_invoke>

<constraints>
Jangan menyentuh file login, auth, register, session, membership, schema Prisma, atau `.env`
tanpa handoff eksplisit dari Fatur lewat Mecca. Jangan menjalankan `git push` tanpa Mecca bilang
eksplisit di momen itu juga -- kalimat lama di histori chat yang menyebut kata "push" dalam
konteks lain (misalnya menceritakan sesuatu ke Codex) tidak dihitung sebagai izin, ini pernah
jadi false-positive sesi sebelumnya, jangan diulang. Jangan menjalankan `reset --hard`,
`checkout --`, atau tindakan destruktif lain pada worktree yang masih dirty. Jangan menghapus
atau menimpa file handoff/history yang sudah ada -- kalau perlu update status, tulis file baru
bertanggal, seperti pola yang sudah konsisten dipakai sepanjang rangkaian handoff ini. Jangan
mengklaim "selesai" untuk area yang cuma lolos TypeScript atau unit test tapi belum dicoba di
browser -- ikuti pemisahan tiga tingkat yang sudah dipakai Codex (dieksekusi browser / lolos
test suite / belum diuji). Kalau genuinely butuh Workflow multi-agent, tanya Mecca dulu sebelum
menjalankan, jangan diam-diam dianggap sudah boleh karena sesi sebelumnya pernah memakainya.
</constraints>

<output_and_done>
Selesai satu fase, laporkan ke Mecca dengan tier bukti yang jelas per klaim, lalu tunggu arahan
sebelum lanjut ke fase berikutnya kalau fase itu menyentuh keputusan produk. Untuk fase yang
murni teknis dan sudah jelas benar (misalnya perbaikan bug navigasi setelah akar penyebabnya
ketemu), boleh lanjut sampai selesai lalu lapor sekali dengan lengkap. Jangan pernah menutup
sesi sendiri atau menganggap pekerjaan tuntas total -- akhiri tiap giliran kerja dengan lapor
lalu menunggu, bukan dengan asumsi sesi berakhir.
</output_and_done>

<escalation>
Kalau reproduksi bug navigasi Finance gagal setelah tiga kali percobaan dengan pendekatan
berbeda, hentikan, laporkan apa yang sudah dicoba dan kenapa gagal, jangan menebak-nebak fix
lebih lanjut. Kalau ketemu keputusan produk yang genuinely ambigu dan tidak terjawab di context
di atas maupun di file-file yang dirujuk, ajukan opsi konkret ke Mecca (bukan pertanyaan
terbuka tanpa arah) lalu tunggu jawabannya sebelum jalan.
</escalation>
