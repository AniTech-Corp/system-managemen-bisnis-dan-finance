# 🌐 EKOSISTEM KLIR PUBLIC (SaaS & Credit-Based Business OS)

**Dokumen Spesifikasi Produk Resmi (Living PRD)**  
**Versi**: 2.0 (Pembaruan Agustus 2026)  
**Slogan Resmi**: *"Udah Clear ya"*  
**Penerbit**: Tim Produk & Teknologi AniTech  

---

## 🎯 1. Visi, Filosofi, & Target Pasar

### 1.1 Visi Produk
KLIR Public adalah platform sistem operasi bisnis (All-in-One Business OS) berbasis kecerdasan buatan (AI) yang dirancang khusus untuk **pelaku UMKM, perintis usaha, kreator, dan tim kecil (1–10 orang)** di Indonesia. 

Tujuan utama KLIR Public adalah menyederhanakan pengelolaan bisnis harian (perencanaan, promosi, pembukuan kas, tugas tim, dan jadwal reservasi) dalam **satu aplikasi terpadu yang ringan dan mudah digunakan**, menggantikan kebutuhan berlangganan banyak aplikasi terpisah yang mahal dan rumit.

### 1.2 Filosofi Penggunaan: Bebas Pakai Berbasis Dompet Kredit (*Credit Wallet*)
Pengguna tidak dipusingkan dengan aturan teknis yang kaku per fitur. Sistem bekerja seperti **kartu saldo pulsa / dompet kredit**:
1. Pengguna memilih paket langganan dan mendapatkan sejumlah saldo kredit AI (misal: **2.000 Kredit**).
2. Pengguna **bebas menggunakan fitur apa saja** sesuai kebutuhan usaha mereka (mau buat proposal, bikin caption medsos, catat kas, buat invoice QRIS, atau buat slip gaji).
3. Setiap kali fitur AI digunakan, saldo kredit berkurang secara otomatis di latar belakang.
4. **Saat Kredit Habis**: Sistem AI otomatis berhenti dengan aman tanpa ada biaya tersembunyi. Layar akan memunculkan penawaran ramah: **"Beli Tambahan Kredit (Top-Up)"** atau **"Upgrade ke Paket yang Lebih Tinggi"**.

---

## 💳 2. Paket Langganan & Model Ekonomi Kredit

| Paket Langganan | Kuota Kredit AI | Biaya Langganan | Target Pengguna & Keterangan |
| :--- | :--- | :--- | :--- |
| **Free (Gratis / Uji Coba)** | 100 Kredit / hari | **Rp 0** (Selamanya) | Untuk mencoba fitur dasar & teks AI (Proposal, Copywriting, Kas, Invoice, Booking). **Dibatasi: Tidak dapat generate Gambar & Video AI**. |
| **Starter Plan** | 2.000 Kredit / minggu | **Rp 30.000 / minggu**<br>*(atau Rp 100.000 / bulan)* | Cocok untuk pemilik usaha mandiri, olshop, freelancer, dan kedai kecil. Termasuk prompt visual & banner promosi. |
| **Business Plan** | 8.000 Kredit / minggu | **Rp 100.000 / minggu**<br>*(atau Rp 350.000 / bulan)* | Cocok untuk bisnis yang sudah memiliki tim staf (kedai kopi, salon, klinik, studio). Termasuk akses penuh seluruh fitur AI. |

### 2.1 Batasan Khusus Paket Free (Anti-Boncos API)
* **Paket Free (Gratis)** sengaja **TIDAK DAPAT** membuat/menghasilkan gambar (*Image Generation*) dan video AI (*Video Generation*) karena biaya API-nya yang mahal. Paket Free hanya fokus pada pemrosesan teks, copywriting, strategi bisnis, dan kalkulasi angka.
* Fitur pembuatan media visual/banner AI hanya terbuka untuk pelanggan berbayar (**Starter & Business Plan**).

### 2.2 Mekanisme Tambahan Kredit (Top-Up Add-On)
Jika kuota kredit habis sebelum masa langganan mingguan/bulanan berakhir:
* Pengguna **TIDAK DIPAKSA** naik ke paket yang lebih mahal.
* Pengguna dapat membeli paket saldo kredit tambahan instan (misal: Top-Up 1.000 Kredit = Rp 15.000).

---

## 🛠️ 3. Rincian Fitur Ringan per Pilar (KLIR Public)

Semua pilar di versi Public dirancang dengan prinsip **"Input Minimal (2–3 Kolom) ➔ Hasil Visual Instan Siap Pakai"**:

### 📄 3.1 CorPlan Lite (Perencanaan Bisnis & Modal Cepat)
* **Proposal Usaha Kilat**: Cukup masukkan nama usaha dan modal ➔ AI menghasilkan ringkasan rencana bisnis 1 halaman untuk kebutuhan pengajuan dana atau partner.
* **Kalkulator HPP & Balik Modal (BEP)**: Hitung harga pokok produksi dan perkiraan berapa bulan modal usaha akan kembali.
* **Simulator Angsuran KUR 6%**: Menghitung simulasi cicilan bulanan pinjaman modal usaha bersubsidi perbankan.

### 🤖 3.2 AniVirtual Lite (Asisten Konsultasi Bisnis)
* **Obrolan Asisten Usaha**: Konsultasi strategi bisnis dengan pilihan gaya bahasa santai atau profesional.
* **Pengecek Anggaran Belanja (*Budget Checker*)**: Memeriksa apakah rencana belanja modal operasional wajar atau berisiko boncos.

### 💰 3.3 KLIR Kas Lite (Buku Kas & Invoice QRIS)
* **Buku Kas Harian Sederhana**: Pencatatan uang masuk (*INCOME*) dan uang keluar (*EXPENSE*) dengan kategori praktis.
* **Invoice Digital QRIS**: Membuat lembar tagihan digital otomatis dengan kode pembayaran QRIS dan nomor rekening bank yang siap dibagikan ke WhatsApp pelanggan.
* **Kalkulator Pajak UMKM 0.5%**: Menghitung estimasi kewajiban pajak final 0.5% (PP 55/2022) dengan batas bebas pajak omset Rp 500 juta/tahun.

### 📢 3.4 KLIR Promo Lite (Pemasaran & BioLink Toko)
* **Copywriting Multi-Platform**: Membuat teks promosi otomatis untuk Instagram, TikTok (skrip video 3 detik), dan pesan siaran WhatsApp dalam nada bahasa lokal (*Ramah Seller*, *Skena*, atau *Formal*).
* **Kalender Konten 7 Hari**: Ide tema postingan harian dari Senin sampai Minggu beserta jam posting terbaik.
* **BioLink Toko & Order WhatsApp**: Halaman kartu link digital profil usaha (seperti Linktree versi elegan) dengan tombol direct order langsung ke WhatsApp admin.

### 👥 3.5 KLIR Kerja Lite (Tugas Tim & Presensi Sederhana)
* **Papan Tugas Kanban 3-Kolom**: Mengatur tugas harian tim (*Belum Dikerjakan*, *Sedang Dikerjakan*, *Selesai*).
* **Presensi Mandiri Staf**: Tombol presensi jam hadir (*Clock-in*) staf dengan status hadir/terlambat.
* **Slip Gaji Ringkas**: Format slip gaji digital yang saat dibayarkan dapat langsung otomatis tercatat ke pengeluaran Buku Kas.

### 📅 3.6 KLIR Booking Lite (Jadwal Reservasi & Pengingat)
* **Kalender Jadwal Reservasi**: Formulir penjadwalan janji temu pelanggan untuk bisnis jasa (salon, barbershop, studio foto, konsultasi).
* **Generator Pengingat WhatsApp 1-Klik**: Menghasilkan pesan pengingat jadwal yang sopan dengan tombol 1-klik yang langsung membuka aplikasi WhatsApp ke nomor klien.
* **Antrean Digital Walk-In**: Sistem nomor antrean sederhana (A-001) untuk pelanggan yang datang langsung di toko.

### ⚡ 3.7 Workflows Lite (Otomatisasi Lintas Modul 1-Klik)
* **5 Template Otomasi Siap Pakai**:
  1. *Booking Selesai ➔ Otomatis Catat Kas Masuk di Buku Kas.*
  2. *Gaji Staf Dibayar ➔ Otomatis Catat Pengeluaran Beban di Buku Kas.*
  3. *Invoice Lunas ➔ Otomatis Berikan Reward Poin Pelanggan.*
  4. *Klik BioLink ➔ Otomatis Buat Tugas Follow-Up di Papan Tugas.*
  5. *Data CorPlan Update ➔ Otomatis Sinkronkan Memori Usaha ke Asisten AI.*

---

## ⚖️ 4. Matriks Perbedaan Tegas: KLIR Public vs KLIR Private

| Dimensi Fitur | 🌐 KLIR PUBLIC (SaaS UMKM) | 🏢 KLIR PRIVATE (Enterprise Dedicated) |
| :--- | :--- | :--- |
| **Model Bisnis** | Langganan Mandiri / Beli Kuota Kredit (SaaS) | Kontrak B2B / Pasang Langsung ke Perusahaan |
| **Beban Penggunaan** | Ringan, praktis, to-the-point, minim konfigurasi | Sangat detail, multi-cabang, hierarki korporat |
| **Kunci AI (API Keys)** | Menggunakan Server AI Pool bersama dari AniTech | Klien bisa memakai API Key sendiri (**BYOK**) |
| **Jalur WhatsApp** | 1-Click WhatsApp Direct URL (`wa.me/...`) | Integrasi WhatsApp Business Cloud API Resmi |
| **Database & Server** | Cloud Serverless Multi-Tenant Bersama | Dedicated Server / Database Khusus Perusahaan |
| **Kustomisasi Merek** | Tampilan seragam standar KLIR OS | White-Label (Logo, Domain, & Warna Klien) |

---

## 🛡️ 5. Catatan Regulasi & Keputusan Produk

1. **Repository Hukum Resmi Dihapus**: Seluruh fitur kurasi pasal hukum dan template kontrak legalitas dihilangkan dari ekosistem untuk menghindari risiko hukum dan menjaga fokus produk pada operasional bisnis praktis.
2. **Keamanan Saldo Kredit**: Sistem menggunakan penguncian kredit di depan (*Atomic Pre-Execution Lock*), sehingga tidak ada celah bagi pengguna untuk melebihi kuota kredit yang dimiliki.

---

*Dokumen ini merupakan acuan resmi pengembangan produk dan tampilan antarmuka (UI/UX) untuk seluruh tim produk, desain, dan engineering AniTech.*