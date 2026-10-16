# 🤖 Pilar 2: AniVirtual — Internal Workflow & Context Agent

**Status**: 🟢 Live & Terintegrasi di Dashboard KLIR  
**Fokus**: Asisten AI operasional tim internal, penerjemah instruksi kerja, dan verifikator anggaran.

---

## 🎯 Visi & Proposisi Nilai
Menjadi *Internal Workflow Agent* yang menjembatani komunikasi atasan-bawahan dan lintas divisi, memastikan setiap instruksi kerja dipahami dengan tepat tanpa miskomunikasi, serta mengaitkan pengajuan anggaran langsung ke proyek CorPlan.

---

## 🛠️ Spesifikasi Fitur Utama

1. **Penerjemah & Pemaham Pesan (Context Decoder)**:
   * Menganalisis pesan kerja yang ambigu/singkat menjadi poin tindakan operasional yang jelas beserta analisis sentimen.
2. **Multi-Scenario Tone Generator**:
   * Menghasilkan 3 variasi draf balasan pesan otomatis:
     * *Formal Eksekutif* (Direksi / Klien Korporat)
     * *Semi-Formal* (Rekan Tim / Internal)
     * *Gen Z Startup* (Santai & Kasual)
3. **CapEx/OpEx Budget Checker**:
   * Memvalidasi pengajuan anggaran operasional terhadap batas sisa anggaran CorPlan.
   * Menerbitkan nomor *Purchase Order (PO)* otomatis (`PO-ANIVIRTUAL-...`) jika disetujui.
4. **Memory Isolation Scope**:
   * Memisahkan memori instruksi AI ke dalam dua tingkat privasi:
     * `PERSONAL`: Hanya relevan untuk akun pengguna tersebut (gaya bicara, kebiasaan kerja).
     * `WORKSPACE`: Berlaku untuk seluruh anggota tim di dalam perusahaan (SOP, aturan resmi).
5. **Formulir Pengajuan Kebutuhan**:
   * Standarisasi format permohonan dana/pengadaan barang sebelum masuk ke persetujuan atasan.
6. **Pembuat Roadmap Kerja Otomatis**:
   * Menyusun rencana milestone mingguan/bulanan dari instruksi tujuan proyek.
