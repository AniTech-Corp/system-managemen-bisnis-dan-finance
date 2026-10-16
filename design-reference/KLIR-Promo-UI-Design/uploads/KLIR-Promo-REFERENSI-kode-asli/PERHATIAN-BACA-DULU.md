# PERHATIAN -- BACA DULU SEBELUM PAKAI ISI ZIP INI (KLIR Promo)

## TEMUAN -- WHATSAPP (perlu diwaspadai, bukan larangan model data seperti Booking)

Di `KLIR-Promo-page-tsx-excerpt.tsx` ditemukan fitur "Bio Link & WA Order" yang meliputi:
- Input field "Nomor WhatsApp Bisnis"
- Tombol generate "WhatsApp Broadcast / Chat Klien" yang menyusun pesan promosi
- Link `wa.me` yang bisa disalin/dibuka untuk mengirim pesan WhatsApp ke klien

Ini BUKAN integrasi resmi WhatsApp Business API (tidak ada panggilan API/webhook di kode
ini -- cuma menyusun teks pesan + link `wa.me` yang dibuka manual lewat aplikasi WhatsApp
milik user sendiri). TAPI sesuai aturan desain (lihat `SISTEM-DESAIN-BERSAMA.md` bagian 5),
WhatsApp Business API HANYA untuk paket Private/Enterprise dan TIDAK BOLEH muncul di desain
paket Publik dalam bentuk apapun -- termasuk pola wa.me sederhana seperti ini.

**Untuk desain Publik: JANGAN gambarkan fitur "Nomor WhatsApp Bisnis" atau tombol
"buka WhatsApp". Ganti dengan konsep "chat dalam aplikasi" (in-app chat) -- pesan promosi
tetap bisa disusun AI, tapi pengirimannya digambarkan terjadi di dalam UI KLIR sendiri.**

## HAL LAIN YANG DICEK DAN AMAN (tidak ditemukan masalah)
- Tidak ditemukan referensi ke Repository Hukum/legalitas di potongan kode KLIR Promo ini.
- Tidak ditemukan opsi BYOK (user memasukkan kunci API AI miliknya sendiri) di potongan
  kode KLIR Promo ini.

## CATATAN UMUM
Potongan kode di zip ini adalah kode ASLI dari aplikasi fungsional yang sudah dibangun Tim
Pengembang -- disertakan sebagai referensi fitur/copy/struktur data, BUKAN untuk ditiru 1:1
sebagai layout visual. Bahasa visual WAJIB ikut `SISTEM-DESAIN-BERSAMA.md` + rujukan
CorPlan v5 / AniVirtual v5 (ada di zip terpisah `SISTEM-DESAIN-BERSAMA-4-pilar.zip`).
