# SISTEM DESAIN BERSAMA -- KLIR Publik (4 Pilar Baru)

Dokumen ini adalah ringkasan bahasa visual (DNA) yang WAJIB dipakai konsisten untuk
mendesain 4 pilar KLIR yang belum pernah digenerate secara visual: KLIR Kas, KLIR Promo,
KLIR Kerja, KLIR Booking. Sumber kebenaran detail ada di file
`10_UI_UX_BLUEPRINT_DAN_KOMPONEN-v2-gabungan-PUBLIC.md` dan di folder desain CorPlan v5 /
AniVirtual v5 yang disertakan dalam paket ini -- dokumen ini HANYA ringkasan cepat, bukan
pengganti dua rujukan tersebut.

---

## 1. TOKEN WARNA RESMI

| Token | Hex | Peran |
|---|---|---|
| Latar (background) | #06080C | Warna dasar seluruh kanvas, hampir hitam |
| Aksen biru primer | #0058BE | Aksi utama, elemen interaktif primer |
| Aksen biru terang | #4E9BFF | Highlight, state hover/active, glow biru |
| Hijau | #3FBF8F | Status positif/sukses (contoh: transaksi masuk, task selesai) |
| Emas/kuning tua | #D8A33C | DUA PERAN SEKALIGUS: (1) warna peringatan/warning, (2) warna bracket sudut dekoratif |
| Teks utama | #F5F7FA | Judul, isi konten prioritas tinggi |
| Teks sekunder | #8A93A3 | Label, keterangan, teks pendukung |
| Teks tersier | #5C6474 | Placeholder, teks non-aktif, metadata minor |

Catatan: token ini SELALU dipakai bersamaan dengan referensi visual CorPlan v5 dan
AniVirtual v5 yang disertakan dalam paket -- dua folder itu adalah bukti hidup bagaimana
token-token ini sudah diterapkan dan harus jadi acuan "rasa" akhir, bukan cuma tabel warna
di atas kertas.

## 2. TIPOGRAFI

- Font judul (heading): **Outfit**
- Font isi/body: **Plus Jakarta Sans**
- Font kode/angka (monospace): dipakai khusus untuk angka nominal, kode booking, ID
  transaksi, dan elemen sejenis yang butuh keterbacaan angka presisi

## 3. EFEK VISUAL

- Efek glow (cahaya di sekitar elemen aksen/CTA) tetap dipakai TAPI intensitasnya WAJIB
  diredam -- jangan bikin glow yang terlalu terang/menyilaukan seperti draft-draft awal
  yang pernah direvisi turun sebelumnya (lihat catatan opacity di riwayat CorPlan v5).
- Elemen tiga dimensi (3D) dan animasi: maksimal SEPULUH (10) objek animasi per halaman.
  Setiap elemen animasi WAJIB bermakna sesuai fungsi fitur yang direpresentasikan --
  BUKAN dekorasi lepas yang ditempel tanpa hubungan ke fitur. Contoh: animasi grafik naik
  untuk fitur proyeksi keuangan itu bermakna; partikel mengambang generik tanpa kaitan
  fitur itu tidak bermakna dan HARUS dihindari.

## 4. SISTEM KREDIT (BERLAKU DI SEMUA PILAR)

Setiap aksi kecerdasan buatan (AI) di KLIR memotong kredit dari kantong **Ruang Kerja**
(Workspace), BUKAN kantong individu user. Ini berlaku sama di keempat pilar baru ini
seperti di CorPlan dan AniVirtual. Konsekuensi untuk desain:

- WAJIB ada indikator biaya kredit yang terlihat di UI setiap kali user akan memicu aksi
  AI (contoh: "Generate Copywriting -- 5 kredit", "Hitung Proyeksi Pajak -- 3 kredit").
  Jangan biarkan user memicu aksi AI tanpa tahu berapa kredit yang akan terpotong.
- Indikator sisa kredit Ruang Kerja (mingguan + cadangan) sebaiknya terlihat di area yang
  konsisten dengan pola yang sudah dipakai di CorPlan v5 / AniVirtual v5.

## 5. WHATSAPP -- ATURAN KETAT UNTUK PAKET PUBLIK

WhatsApp Business API (integrasi API resmi WhatsApp untuk bisnis) **HANYA** tersedia untuk
paket Private/Enterprise. WhatsApp Business API **TIDAK BOLEH** muncul di desain manapun
untuk paket Publik ini -- baik sebagai fitur, copy, ikon, maupun mockup layar chat WhatsApp.

Ganti SELALU dengan konsep **"chat dalam aplikasi"** (in-app chat) sebagai gantinya --
artinya komunikasi dengan pelanggan/klien digambarkan terjadi di dalam UI KLIR sendiri,
bukan lewat WhatsApp eksternal.

Catatan penting: dalam kode asli yang disertakan di zip per-pilar (KLIR Promo dan KLIR
Booking), DITEMUKAN fitur yang men-generate link "wa.me" / tombol "Buka WhatsApp & Kirim
Pesan" -- ini BUKAN integrasi WhatsApp Business API (tidak ada koneksi API/webhook), tapi
tetap sebuah bentuk keterlibatan WhatsApp yang TIDAK BOLEH ditiru ke desain Publik sesuai
aturan di atas. Detail lengkap ada di file PERHATIAN-BACA-DULU.md pada masing-masing zip
KLIR Promo dan KLIR Booking.

## 6. BAHASA

Semua teks UI (label, tombol, pesan error, onboarding, tooltip) WAJIB pakai bahasa yang
SEDERHANA, ditujukan untuk pemilik usaha kecil yang AWAM teknologi -- bukan bahasa teknis,
bukan jargon developer, bukan istilah finansial/hukum yang berat tanpa penjelasan. Kalau
ada istilah yang tidak terhindarkan (contoh: "QRIS", "invoice"), pastikan konteksnya jelas
dari tata letak sekitarnya.

## 7. ISI PAKET INI

- `10_UI_UX_BLUEPRINT_DAN_KOMPONEN-v2-gabungan-PUBLIC.md` -- blueprint UI/UX lengkap,
  rujukan detail komponen (lebih otoritatif dari ringkasan di file ini kalau ada beda).
- `uploads-corplan-v5/` -- desain final CorPlan v5 lengkap (rujukan DNA visual hidup).
- `uploads-anivirtual-v5/` -- desain final AniVirtual v5 lengkap (rujukan DNA visual hidup).

Paket ini dipakai BERSAMA oleh keempat pilar baru (KLIR Kas, KLIR Promo, KLIR Kerja, KLIR
Booking) -- tidak perlu diduplikasi, cukup dibuka satu kali sebagai basis DNA visual
sebelum membuka zip referensi kode per-pilar masing-masing.
