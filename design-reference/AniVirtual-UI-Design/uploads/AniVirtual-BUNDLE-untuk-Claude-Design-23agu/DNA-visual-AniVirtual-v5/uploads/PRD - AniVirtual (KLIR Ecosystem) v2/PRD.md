# PRD — Project Requirements Document

## 1. Overview

AniVirtual adalah modul asisten komunikasi kerja dalam ekosistem KLIR, dibuat untuk profesional Indonesia yang sering menerima pesan kerja ambigu dari atasan, klien, atau rekan kerja. Pesan seperti ini biasanya membuat pengguna membaca berulang-ulang, menebak-nebak maksud, atau bertanya balik yang terkesan kurang paham — akhirnya membuang waktu dan berisiko salah paham.

AniVirtual menyelesaikan masalah itu lewat tiga fitur utama:

1. **Analisis Pesan (Understand Mode)** — menempel pesan kerja lalu melihat uraian permintaan inti, tenggat, nada/urgensi, dan tingkat keyakinan sistem. Jika pesan kurang jelas, sistem bertanya untuk memperjelas.
2. **Draf Balasan (Reply Generator)** — membuat minimal dua draf balasan dengan gaya bahasa yang benar-benar berbeda, untuk disalin, diedit, atau diminta ulang.
3. **Buku Alamat (Memory Basic)** — menyimpan nama, jabatan, gaya komunikasi, dan catatan tiap kontak kerja sebagai konteks agar analisis dan balasan makin sesuai dengan kebiasaan masing-masing orang secara real-time.

Tujuan utama AniVirtual: menghemat waktu, membuat komunikasi lebih rapi, mengurangi salah paham, dan tetap mudah dipahami oleh berbagai generasi.

---

## 2. Requirements

### 2.1 Persyaratan Fungsional Umum

- AniVirtual berjalan sebagai modul di dalam ekosistem KLIR dan memakai autentikasi/akun KLIR yang sama.
- Seluruh antarmuka menggunakan Bahasa Indonesia.
- Pengguna bisa menempel pesan apa pun tanpa harus memilih kontak lebih dulu.
- Ketiga fitur bisa dipakai berdiri sendiri, tetapi bisa juga dipakai berurutan: Analisis Pesan menghasilkan analisis, Draf Balasan menghasilkan balasan, dan Buku Alamat menyediakan konteks kontak.
- Setiap pengguna hanya melihat dan mengelola datanya sendiri (isolasi data berbasis `userId`).

### 2.2 Persyaratan Non-Fungsional Umum

- **Kejujuran informasi**: sistem wajib membedakan fakta yang ada di teks vs interpretasi sistem. Dilarang mengarang tenggat atau detail yang tidak disebutkan.
- **Performa**: analisis pesan target selesai dalam < 5 detik (maksimal 10 detik), pembuatan draf balasan < 8 detik, pencarian kontak < 1 detik.
- **Responsif**: nyaman digunakan di desktop, tablet, dan ponsel.
- **Keamanan**: semua akses melewati autentikasi KLIR, dan data antar-pengguna terisolasi melalui implementasi `userId` di tingkat database.

---

## 3. Core Features

### 3.1 Fase 1 — Understand Mode (Analisis Pesan)

#### 3.1.1 Subfitur
- **Input Konteks** — pengguna mengirim teks pesan dan `senderId` (opsional).
- **Hasil Analisis** — permintaan inti, tenggat waktu jika ada, nada/urgensi, dan tingkat keyakinan.
- **Pertanyaan Klarifikasi** — jika keyakinan rendah, sistem mengajukan pertanyaan untuk memperjelas pesan.

#### 3.1.2 Mekanisme Teknis
- Backend NestJS menerima payload `POST /api/messages/analyze` berisi `text` dan `senderId`.
- Jika `senderId` disertakan, sistem melakukan query ke tabel `contacts` untuk mengambil preferensi gaya komunikasi pengirim sebagai konteks tambahan bagi AI.
- Sistem memanggil AI secara sinkron untuk mengejar target response time < 10 detik.
- Hasil analisis diparsing dan dikembalikan langsung ke frontend tanpa disimpan permanen di database untuk menjaga privasi dan kecepatan.
- **Prasyarat**: Timeout API backend diset pada 15 detik untuk menangani latensi LLM.

#### 3.1.3 Kriteria Penerimaan Terukur
| Kode | Kriteria |
|---|---|
| AA-1 | Analisis tanpa `senderId` → hasil muncul < 10 detik, keyakinan rendah. |
| AA-2 | Analisis dengan `senderId` → AI mempertimbangkan gaya komunikasi kontak dalam tabel. |
| AA-3 | Validasi Tenggat → Sistem mengembalikan `null` jika tidak ada tanggal spesifik di teks asli (dilarang halusinasi). |

---

### 3.2 Fase 2 — Reply Generator (Draf Balasan)

#### 3.2.1 Subfitur
- **Pilih Gaya Bahasa** — formal, santai, permohonan maaf, atau diplomatis.
- **Hasilkan Draf** — membuat minimal dua draf balasan yang benar-benar berbeda.
- **State Management** — draf disimpan di state sesi frontend (Next.js) untuk diedit atau diminta ulang.

#### 3.2.2 Mekanisme Teknis
- Dipicu secara sinkron oleh backend NestJS. 
- **Payload Request** wajib menyertakan konteks gabungan: Pesan asli + Hasil Analisis (dari Understand Mode) + Konteks Kontak (dari Memory Basic).
- Sistem menghasilkan minimal dua draf dengan susunan kalimat yang berbeda.
- Draf tidak disimpan ke database permanen agar pengguna bebas melakukan iterasi tanpa membebani storage.

#### 3.2.3 Kriteria Penerimaan Terukur
| Kode | Kriteria |
|---|---|
| RG-1 | Klik "Buat Draf" → muncul 2 draf dengan gaya berbeda dalam < 8 detik. |
| RG-2 | Integrasi Konteks → Draf menggunakan nama/posisi dari `senderId` yang aktif. |
| RG-3 | State Frontend → Draf tetap ada di layar selama sesi aktif meski user berpindah tab menu AniVirtual lainnya. |

---

### 3.3 Fase 3 — Memory Basic (Buku Alamat)

#### 3.3.1 Subfitur
- **Manajemen Kontak** — CRUD lengkap (Create, Read, Update, Delete).
- **Pencarian Cepat** — Filter berdasarkan nama atau jabatan via DB query.
- **Personalisasi Real-time** — Data kontak langsung mempengaruhi Understand Mode & Reply Generator via `senderId`.

#### 3.3.2 Mekanisme Teknis
- Menggunakan NestJS dengan Prisma ORM yang terhubung ke PostgreSQL Neon.
- Setiap record memiliki kolom `userId` untuk memastikan keamanan data (Row Level Security).
- Pencarian dijalankan melalui query database terindeks (`Prisma.findMany`) tanpa melalui AI untuk efisiensi.
- **Integrasi Keunggulan**: `senderId` berfungsi sebagai foreign key virtual. Perubahan pada catatan gaya komunikasi kontak akan langsung berdampak pada hasil analisis pesan berikutnya secara real-time.

#### 3.3.3 Kriteria Penerimaan Terukur
| Kode | Kriteria |
|---|---|
| BA-1 | Simpan kontak → Data masuk ke PostgreSQL Neon dalam < 2 detik. |
| BA-2 | Cari kontak → Hasil muncul < 1 detik (Query langsung ke DB). |
| BA-3 | Keamanan → User A tidak bisa melihat atau mencari kontak milik User B. |

---

## 4. User Flow

1. **Memory Basic**: Pengguna menyimpan data klien/atasan ke Buku Alamat dengan catatan "Suka bicara to-the-point".
2. **Understand Mode**: Pengguna menerima pesan ambigu, menempelnya ke AniVirtual, dan memilih kontak tersebut. Sistem melakukan query ke DB, mengambil konteks "to-the-point", dan AI memberikan analisis permintaan inti yang lebih tajam.
3. **Reply Generator**: Pengguna meminta draf balasan. Frontend mengirimkan payload lengkap (pesan + analisis + data kontak). AI memberikan draf yang sopan namun singkat sesuai preferensi kontak. Pengguna menyalin draf dari state frontend.

---

## 5. Architecture

AniVirtual menggunakan arsitektur client-server modern:

- **Frontend**: Next.js (Vercel) untuk UI responsif dan state management.
- **Backend**: NestJS (Railway/Render) sebagai REST API gateway.
- **Database**: PostgreSQL Neon dengan Prisma ORM.
- **Infrastructure**: Redis Upstash & BullMQ digunakan untuk logging pemanggilan AI dan mekanisme retry jika API LLM mengalami kegagalan.

### 5.1 Struktur API NestJS (Rekomendasi)
- `GET /api/contacts` - List & Search kontak (Query DB).
- `POST /api/contacts` - Create kontak baru.
- `POST /api/messages/analyze` - Sinkron AI Analysis (Understand Mode).
- `POST /api/replies/generate` - Sinkron AI Reply Generation (Reply Generator).

---

## 6. Database Schema (Prisma)

### 6.1 Skema Tabel `contacts` (Memory Basic)

```prisma
model Contact {
  id                 String   @id @default(uuid())
  userId             String   // ID Pengguna dari Auth KLIR
  name               String
  position           String?
  communicationStyle String?  // Konteks untuk AI
  notes              String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@index([userId])
  @@index([name])
}
```

### 6.2 Tabel Pendukung (Audit & Logging)
Untuk kebutuhan retry dan logging pemanggilan AI (via BullMQ & Redis), sistem mencatat metadata request tanpa menyimpan isi pesan sensitif secara permanen jika tidak diperlukan.

---

## 7. Tech Stack

| Lapisan | Teknologi | Alasan |
|---|---|---|
| **Frontend** | Next.js (Vercel) | Kecepatan rendering dan kemudahan deployment. |
| **Backend** | NestJS (Railway/Render) | Struktur modular dan robust untuk integrasi AI. |
| **Database** | PostgreSQL Neon | Serverless Postgres yang cepat dan skalabel. |
| **ORM** | Prisma | Type-safe database access dan kemudahan migrasi. |
| **Queue/Logging** | Redis Upstash + BullMQ | Menangani retry pemanggilan AI dan logging performa. |
| **AI Gateway** | OpenRouter / OpenAI API | Pemrosesan bahasa alami secara sinkron. |

---