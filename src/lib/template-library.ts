/**
 * Template library — struktur dokumen per role/outputType + aturan kualitas tulisan,
 * dipakai AI Brain (generation-engine) untuk menyusun dokumen yang konsisten.
 *
 * Sumber: hasil scan template dokumen dari knowledge base internal (sudah difilter
 * generik lintas-perusahaan — KLIR dipakai banyak perusahaan berbeda, jadi template
 * di sini TIDAK menyebut entitas perusahaan tertentu secara spesifik) digabung dengan
 * hasil scan aturan kualitas tulisan (anti-pola gaya AI). Dipakai sebagai instruksi
 * tambahan yang disisipkan ke prompt/systemInstruction AI — TIDAK menggantikan brief
 * user; kalau brief user bertentangan dengan struktur template, brief user menang.
 */

export interface DocumentTemplate {
  id: string;
  role: string;
  outputType: string;
  label: string;
  sections: string[];
}

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  // -------------------------------------------------------------------------
  // 1. EXECUTIVE / CEO / OWNER (4 template: PPT, Word, Excel, PDF)
  // -------------------------------------------------------------------------
  {
    id: 'tpl-ceo-ppt-01',
    role: 'executive',
    outputType: 'ppt',
    label: 'Laporan Kinerja Eksekutif Bulanan',
    sections: [
      'Sampul - judul laporan, periode, nama tenant/perusahaan',
      'Ringkasan Eksekutif - angka kunci dalam satu tabel/grafik',
      'Kinerja per Modul Bisnis - data lintas modul dirangkai jadi satu cerita',
      'Temuan dan Insight Utama - diurutkan dari paling penting',
      'Risiko dan Perhatian Khusus - status jujur, tandai yang belum final',
      'Rekomendasi dan Langkah Berikutnya',
      'Penutup dan Kontak',
    ],
  },
  {
    id: 'tpl-ceo-word-01',
    role: 'executive',
    outputType: 'word',
    label: 'Dokumen Strategis Pilar Bisnis & Rencana Korporat',
    sections: [
      'Latar Belakang & Situasi Bisnis Terkini',
      'Visi, Proposisi Nilai & Arah Pertumbuhan',
      'Spesifikasi Inisiatif Strategis & Alokasi Sumber Daya',
      'Keunggulan Kompetitif & Pertahanan Posisi Pasar',
      'Mitigasi Risiko Utama & Rencana Kontinjensi',
      'Penutup, Target Milestone & Rencana Evaluasi',
    ],
  },
  {
    id: 'tpl-ceo-excel-01',
    role: 'executive',
    outputType: 'excel',
    label: 'Model Finansial Eksekutif, Valuasi & Proyeksi Runway',
    sections: [
      'Dashboard Metrik Utama - Laba Bersih, Kas Likuid, Runway & Skor Kesehatan',
      'Struktur Pendapatan & Beban 12 Bulan',
      'Sensitivitas Runway & Proyeksi Skenario (Optimis, Moderat, Konservatif)',
      'Alokasi Belanja Modal (CapEx) & Efisiensi OpEx',
      'Catatan Strategis & Asumsi Makro',
    ],
  },
  {
    id: 'tpl-ceo-pdf-01',
    role: 'executive',
    outputType: 'pdf',
    label: 'Executive Briefing & Laporan Komprehensif Direksi',
    sections: [
      'Ringkasan Eksekutif & Sorotan Kinerja Bisnis Utama',
      'Kesehatan Finansial, Posisi Kas & Likuiditas Berjalan',
      'Pencapaian Milestone & Efisiensi Operasional Tim',
      'Analisis Risiko Pasar & Mitigasi Ketidakpastian',
      'Keputusan Strategis & Rencana Aksi Kuartal Depan',
    ],
  },

  // -------------------------------------------------------------------------
  // 2. MARKETING (4 template: PPT, Word, Excel, PDF)
  // -------------------------------------------------------------------------
  {
    id: 'tpl-marketing-ppt-01',
    role: 'marketing',
    outputType: 'ppt',
    label: 'Laporan Kampanye dan Funnel Marketing',
    sections: [
      'Sampul - nama kampanye, periode, channel',
      'Ringkasan Kampanye - objective, budget, target audiens',
      'Data Performa Funnel - reach ke engagement ke konversi',
      'Insight per Channel/Segmen',
      'Highlight Konten/Studi Kasus Terbaik',
      'Rekomendasi Optimasi dan Anggaran Berikutnya',
      'Penutup dan Kontak',
    ],
  },
  {
    id: 'tpl-marketing-excel-01',
    role: 'marketing',
    outputType: 'excel',
    label: 'Rencana dan Tracking Anggaran Kampanye & ROAS',
    sections: [
      'Dashboard Ringkasan - total anggaran, realisasi, sisa',
      'Rencana Anggaran per Channel',
      'Realisasi Belanja per Periode',
      'Tracking Funnel, ROAS dan Konversi',
      'Kalender Konten/Kampanye',
      'Catatan dan Asumsi',
    ],
  },
  {
    id: 'tpl-marketing-word-01',
    role: 'marketing',
    outputType: 'word',
    label: 'Strategi Pemasaran Terpadu, Brand Positioning & Rencana Media',
    sections: [
      'Latar Belakang Pasar & Riset Pelanggan Sasaran',
      'Pilar Strategi Brand, Tone of Voice & Value Proposition',
      'Rencana Kampanye Multi-Channel (Meta, Google, TikTok, Organik)',
      'KPI Pemasaran, Target Konversi & Alokasi Anggaran',
      'Jadwal Eksekusi Konten & Mitigasi Risiko Reputasi',
    ],
  },
  {
    id: 'tpl-marketing-pdf-01',
    role: 'marketing',
    outputType: 'pdf',
    label: 'Laporan Riset Pasar, Tren Konsumen & Evaluasi Saluran',
    sections: [
      'Executive Summary: Kinerja Akusisi & Pertumbuhan Pelanggan',
      'Dekomposisi Metrik Funnel: Reach, Klik, Prospek, dan Pembelian',
      'Evaluasi Return on Ad Spend (ROAS) & Efisiensi CAC per Channel',
      'Temuan Perilaku Konsumen & Preferensi Produk',
      'Rekomendasi Skala Anggaran & Arah Konten Berikutnya',
    ],
  },

  // -------------------------------------------------------------------------
  // 3. FINANCE (4 template: Word, Excel, PPT, PDF)
  // -------------------------------------------------------------------------
  {
    id: 'tpl-finance-word-01',
    role: 'finance',
    outputType: 'word',
    label: 'Laporan Arus Kas dan Kesehatan Keuangan',
    sections: [
      'Ringkasan Eksekutif Keuangan',
      'Arus Kas Masuk - pendapatan per sumber',
      'Arus Kas Keluar - pengeluaran per kategori',
      'Analisis Saldo dan Proyeksi',
      'Catatan Risiko dan Asumsi',
      'Rekomendasi dan Penutup',
    ],
  },
  {
    id: 'tpl-finance-excel-01',
    role: 'finance',
    outputType: 'excel',
    label: 'Rekap Transaksi, Buku Kas & Anggaran Berjalan',
    sections: [
      'Dashboard Ringkasan',
      'Rekap Transaksi - tanggal, kategori, masuk/keluar, saldo berjalan',
      'Anggaran vs Realisasi per Kategori',
      'Proyeksi Arus Kas & Analisis Runway',
      'Catatan dan Asumsi',
    ],
  },
  {
    id: 'tpl-finance-ppt-01',
    role: 'finance',
    outputType: 'ppt',
    label: 'Presentasi Analisis Finansial, Likuiditas & Health Score',
    sections: [
      'Sampul - Laporan Keuangan & Likuiditas Usaha',
      'Sorotan Angka Kunci: Pendapatan, Pengeluaran & Kas Bersih',
      'Analisis Piutang Usaha & Aging Schedule (Jatuh Tempo)',
      'Struktur Biaya Pokok Penjualan (HPP) & Margin Kotor',
      'Evaluasi Skor Kesehatan Bisnis & Rekomendasi Efisiensi',
      'Tanya Jawab & Kontak Tim Finansial',
    ],
  },
  {
    id: 'tpl-finance-pdf-01',
    role: 'finance',
    outputType: 'pdf',
    label: 'Laporan Resmi Arus Kas, Posisi Likuiditas & Rekonsiliasi Bank',
    sections: [
      'Ringkasan Posisi Keuangan & Saldo Kas Tersedia',
      'Laporan Arus Kas Operasional, Investasi & Pendanaan',
      'Status Piutang Belum Tertagih & Cadangan Kerugian Piutang',
      'Kewajiban Pajak Berjalan (PPN & PPh) & Estimasi Pembayaran',
      'Catatan Atas Laporan Keuangan (CALK) & Pernyataan Kepatuhan',
    ],
  },

  // -------------------------------------------------------------------------
  // 4. MANAGER / BISNIS & TIM (4 template: Word, Excel, PPT, PDF)
  // -------------------------------------------------------------------------
  {
    id: 'tpl-manager-word-01',
    role: 'manager',
    outputType: 'word',
    label: 'Evaluasi Kinerja Tim, Pencapaian KPI & Rencana Pengembangan',
    sections: [
      'Konteks Periode Kerja & Sasaran Prioritas Divisi',
      'Pencapaian KPI per Anggota Tim & Skor Kinerja',
      'Identifikasi Bottleneck Kerja & Tantangan Kolaborasi',
      'Program Peningkatan Keterampilan & Pelatihan Terarah',
      'Rencana Kerja & Pembagian Tugas Periode Berikutnya',
    ],
  },
  {
    id: 'tpl-manager-excel-01',
    role: 'manager',
    outputType: 'excel',
    label: 'Matriks KPI Mingguan, Beban Kerja & Tracking Milestone',
    sections: [
      'Ringkasan Tingkat Penyelesaian Milestone Tim',
      'Tabel KPI per Anggota: Target, Realisasi & Persentase Capaian',
      'Log Jam Kerja, Beban Proyek & Alokasi Kapasitas',
      'Daftar Kendala Proyek & Status Resolusi',
    ],
  },
  {
    id: 'tpl-manager-ppt-01',
    role: 'manager',
    outputType: 'ppt',
    label: 'Review Produktivitas Tim, Capaian Sprint & Rencana Operasional',
    sections: [
      'Sampul - Review Kinerja Tim & Perkembangan Proyek',
      'Ringkasan Pencapaian Utama & Milestone Tuntas',
      'Metrik Produktivitas Tim: Target vs Realisasi',
      'Hambatan Utama & Upaya Pemecahan Masalah',
      'Roadmap Prioritas Kerja untuk Sprint Mendatang',
      'Penutup & Sesi Tindak Lanjut',
    ],
  },
  {
    id: 'tpl-manager-pdf-01',
    role: 'manager',
    outputType: 'pdf',
    label: 'Laporan Akuntabilitas Kinerja & Penilaian Pencapaian Tim',
    sections: [
      'Ringkasan Eksekutif Kinerja & Output Tim',
      'Evaluasi Kuantitatif Capaian Target Kerja Bulanan',
      'Analisis Beban Kerja & Distribusi Sumber Daya',
      'Rekomendasi Penghargaan & Intervensi Kinerja',
      'Lembar Komitmen Target untuk Periode Baru',
    ],
  },

  // -------------------------------------------------------------------------
  // 5. MANAGER OPS / OPERASIONAL & LOGISTIK (4 template: Word, Excel, PPT, PDF)
  // -------------------------------------------------------------------------
  {
    id: 'tpl-ops-word-01',
    role: 'manager-ops',
    outputType: 'word',
    label: 'Standar Operasional Prosedur (SOP) Lapangan & Laporan Insiden',
    sections: [
      'Tujuan SOP, Ruang Lingkup & Pihak yang Bertanggung Jawab',
      'Prosedur Kerja Langkah Demi Langkah & Diagram Alir',
      'Protokol Keselamatan Kerja & Penanganan Kondisi Darurat',
      'Laporan Insiden Operasional & Analisis Akar Masalah (RCA)',
      'Tindakan Korektif & Rencana Audit Kepatuhan',
    ],
  },
  {
    id: 'tpl-ops-excel-01',
    role: 'manager-ops',
    outputType: 'excel',
    label: 'Audit Stok Gudang, Perputaran FIFO & Rekap Biaya Logistik',
    sections: [
      'Ringkasan Nilai Persediaan & Tingkat Perputaran Stok',
      'Buku Besar Stok: Masuk, Keluar, Rusak & Saldo Akhir',
      'Analisis Usia Barang (Aging Inventory) & Peringatan Kadaluwarsa',
      'Tracking Biaya Pengiriman, Armada & Efisiensi Rute',
    ],
  },
  {
    id: 'tpl-ops-ppt-01',
    role: 'manager-ops',
    outputType: 'ppt',
    label: 'Evaluasi Efisiensi Rantai Pasok, Utilisasi Gudang & Logistik',
    sections: [
      'Sampul - Review Operasional Lapangan & Supply Chain',
      'Indikator Utama: Kecepatan Pemenuhan (Fulfillment Rate)',
      'Status Ketersediaan Stok & Utilisasi Kapasitas Gudang',
      'Kinerja Armada & Rekap Biaya Operasional per Unit',
      'Inisiatif Perbaikan Proses (Lean Operations) & Efisiensi',
      'Langkah Lanjutan & Alokasi Shift Tim',
    ],
  },
  {
    id: 'tpl-ops-pdf-01',
    role: 'manager-ops',
    outputType: 'pdf',
    label: 'Laporan Resmi Audit Lapangan, Kepatuhan SOP & Pemeliharaan Aset',
    sections: [
      'Executive Summary: Tingkat Keandalan Operasi & Logistik',
      'Hasil Pemeriksaan Kepatuhan Prosedur & Keselamatan',
      'Status Perawatan Aset, Mesin & Peralatan Kerja',
      'Temuan Ketidaksesuaian Lapangan & Tindakan Perbaikan Langsung',
      'Tanda Tangan Pengawas Lapangan & Rekomendasi Manajemen',
    ],
  },

  // -------------------------------------------------------------------------
  // 6. SEKRETARIS / TATA KELOLA DIREKSI (4 template: Word, Excel, PPT, PDF)
  // -------------------------------------------------------------------------
  {
    id: 'tpl-sekretaris-word-01',
    role: 'sekretaris',
    outputType: 'word',
    label: 'Notulensi Rapat Direksi Resmi & Matriks Tindak Lanjut',
    sections: [
      'Informasi Rapat: Tanggal, Waktu, Tempat & Daftar Hadir',
      'Agenda Pembahasan Utama & Poin Paparan Pembicara',
      'Hasil Keputusan Rapat, Konsensus & Dasar Pertimbangan',
      'Matriks Tindak Lanjut (Action Items, PIC & Tenggat Waktu)',
      'Rencana Rapat Lanjutan & Lembar Pengesahan',
    ],
  },
  {
    id: 'tpl-sekretaris-excel-01',
    role: 'sekretaris',
    outputType: 'excel',
    label: 'Log Korespondensi Resmi, Registrasi Surat & Arsip Dokumen',
    sections: [
      'Ringkasan Volume Surat Masuk, Keluar & Status Disposisi',
      'Buku Agenda Surat Masuk: No Surat, Asal, Perihal, Tanggal',
      'Buku Agenda Surat Keluar: No Surat, Tujuan, Perihal, Tanggal',
      'Daftar Perjanjian Kerjasama (MoU), Kontrak & Tanggal Kadaluwarsa',
    ],
  },
  {
    id: 'tpl-sekretaris-ppt-01',
    role: 'sekretaris',
    outputType: 'ppt',
    label: 'Briefing Agenda Rapat Pemegang Saham & Status Keputusan',
    sections: [
      'Sampul - Briefing Agenda & Tata Tertib Rapat Resmi',
      'Susunan Acara, Jadwal & Mekanisme Pengambilan Keputusan',
      'Laporan Pelaksanaan Keputusan Rapat Sebelumnya',
      'Ikhtisar Masalah yang Memerlukan Persetujuan Direksi',
      'Jadwal Agenda Mendatang & Kontak Sekretariat',
    ],
  },
  {
    id: 'tpl-sekretaris-pdf-01',
    role: 'sekretaris',
    outputType: 'pdf',
    label: 'Surat Keputusan Direksi, Edaran Resmi & Risalah Pengesahan',
    sections: [
      'Header Resmi Sekretariat Perusahaan & Nomor Registrasi',
      'Menimbang, Mengingat & Memutuskan: Diktum Keputusan',
      'Uraian Petunjuk Teknis & Ketentuan Pelaksanaan Keputusan',
      'Masa Berlaku Ketetapan & Pihak yang Menerima Tembusan',
      'Kolom Pengesahan, Tanggal Berlaku & Catatan Arsip Resmi',
    ],
  },
];

function normalizeRole(role: string): string {
  const r = role.trim().toLowerCase().replace(/[-\s]+/g, '_');
  if (r === 'ceo' || r === 'owner') return 'executive';
  if (r === 'manager_operasional' || r === 'manager_ops' || r === 'ops' || r === 'operasional') return 'manager-ops';
  if (r === 'manager_umum') return 'manager';
  if (r === 'secretary') return 'sekretaris';
  return r;
}

/**
 * Cari template yang cocok berdasarkan role dan outputType. Mendukung variasi role
 * (ceo -> executive, manager_operasional -> manager-ops). Kalau tidak ketemu
 * kombinasi persis, return null — TIDAK mengarang template baru.
 */
export function findTemplate(role?: string, outputType?: string): DocumentTemplate | null {
  if (!role || !outputType) return null;
  const r = normalizeRole(role);
  const o = outputType.trim().toLowerCase();
  const found = DOCUMENT_TEMPLATES.find(
    (t) => normalizeRole(t.role) === r && t.outputType.toLowerCase() === o
  );
  return found || null;
}

// ---------------------------------------------------------------------------
// QUALITY RULES — anti-pola gaya tulisan AI
// ---------------------------------------------------------------------------

export interface QualityRule {
  rule: string;
  why: string;
}

export const QUALITY_RULES: QualityRule[] = [
  {
    rule:
      "Jangan pakai tanda pisah panjang (em-dash unicode maupun ASCII ' -- ') untuk menyambung dua klausa. Tulis ulang jadi kalimat baru, pakai kata sambung yang gramatikal (karena/jadi/sehingga/melainkan), atau titik dua untuk label -- jangan search-replace mekanis satu karakter ke karakter lain karena bisa menghasilkan comma splice.",
    why:
      'Ini pola AI-writing paling gampang dikenali pembaca manusia, dan project ini punya riwayat ditegur keras oleh pemilik produk untuk pelanggaran yang sama di dokumen formal maupun chat biasa.',
  },
  {
    rule:
      'Hindari kosakata khas AI (delve, foster, garner, intricate, tapestry, underscore, showcase, testament, pivotal, evolving landscape) dan bahasa promosi berlebihan (nestled, breathtaking, stunning, must-visit, boasts). Pakai kata kerja sederhana: is/are/has, bukan "serves as"/"stands as"/"boasts".',
    why:
      'Kosakata ini adalah tell paling langsung dari teks yang digenerate model, dan langsung menurunkan kredibilitas dokumen di mata pembaca eksternal seperti klien atau tim dev.',
  },
  {
    rule:
      'Jangan buka kalimat dengan pola "bukan X, tapi/melainkan Y" sebagai refleks di hampir tiap baris (negative parallelism). Pakai pola ini hanya sesekali, saat memang ada miskonsepsi spesifik yang perlu diluruskan.',
    why:
      'Kalau pola ini jadi struktur baku berulang, teks kedengaran seperti template yang digenerate mesin meski tiap kalimatnya sendiri secara bahasa sudah benar.',
  },
  {
    rule:
      'Hindari rule-of-three retoris paksa (pengelompokan tiga item demi kesan komprehensif palsu), sinonim-cycling (memutar berbagai sebutan untuk entitas yang sama demi variasi artifisial), dan false range ("dari X sampai Y" yang X dan Y-nya sebenarnya tidak berada di skala yang sama).',
    why:
      'Ketiganya adalah pola kompensasi gaya AI untuk terlihat kaya kosakata atau menyeluruh, padahal isinya kosong dan gampang dikenali pembaca yang jeli.',
  },
  {
    rule:
      'Hindari filler phrase ("dalam rangka untuk" -> "untuk", "dikarenakan oleh fakta bahwa" -> "karena") dan hedging berlapis ("bisa jadi berpotensi mungkin dibilang"), serta kesimpulan generik yang tidak spesifik ("masa depan terlihat cerah", "ini adalah era yang menarik").',
    why:
      'Filler dan hedging berlebih membuat kalimat bertele-tele tanpa menambah informasi, sementara kesimpulan generik tidak memberi nilai apapun ke pembaca yang sudah membaca isi dokumennya.',
  },
  {
    rule:
      'Hindari chat-artifact dan signposting klise ("Mari kita mulai", "Berikut yang perlu Anda ketahui", "Semoga ini membantu!") serta authority trope ("Pertanyaan sebenarnya adalah...", "Yang sebenarnya penting di sini adalah..."). Langsung masuk ke isi tanpa basa-basi pembuka yang seragam.',
    why:
      'Frasa-frasa ini adalah template pembuka/penutup yang dipakai model bahasa secara refleks, dan langsung mengkhianati sumber teks sebagai buatan AI ke pembaca yang familiar dengan polanya.',
  },
  {
    rule:
      'Jangan pakai kalimat pembuka dan penutup yang identik/template berulang-ulang antar output berturut-turut dalam satu sesi generation, meski tiap kalimatnya sendiri secara bahasa sudah natural. Variasikan strukturnya tiap kali.',
    why:
      'Manusia yang benar-benar menulis instruksi ke rekan kerja tidak memakai kalimat pembuka-penutup yang persis sama tiap kali mengirim pesan -- repetisi struktur ini terbaca sebagai pola robot meski kosakatanya sudah bebas istilah AI.',
  },
  {
    rule:
      'Jangan paksa narasi kronologis atau heuristik sederhana (dua kondisi ke bawah) masuk ke tabel key-value atau diagram pseudocode IF/YA/TIDAK. Tulis sebagai kalimat mengalir dengan kata sambung (karena, jadi, tapi, sambil) kecuali datanya genuinely tabular (angka sejajar, perbandingan multi-kolom) atau logikanya genuinely bercabang tiga arah lebih.',
    why:
      'Struktur mekanis yang dipaksakan ke data yang sebetulnya cerita membuat teks kedengaran seperti output sistem, bukan penjelasan manusia yang punya alur.',
  },
  {
    rule:
      'Kalimat penutup dokumen atau komunikasi ke pengguna harus bersifat personal-aktif dan memberi jalan keluar konkret (misalnya arahan kontak yang jelas), bukan kalimat pasif-menyerah yang hanya menyiratkan "kemungkinan belum final, jangan salah paham" tanpa solusi.',
    why:
      'Kalimat penutup pasif membuat pembaca merasa tidak ada tempat bertanya, sementara tujuan dokumen adalah memandu pembaca ke langkah berikutnya, bukan sekadar menghindari kesalahpahaman.',
  },
];

/**
 * Gabungkan semua QUALITY_RULES jadi satu blok instruksi teks siap disisipkan
 * ke systemInstruction generator AI.
 */
export function buildQualityInstruction(): string {
  const lines = QUALITY_RULES.map((r, i) => `${i + 1}. ${r.rule}`);
  return `Aturan kualitas tulisan (wajib dipatuhi, tulisan harus terbaca natural seperti ditulis manusia, bukan hasil generate mentah):\n${lines.join('\n')}`;
}
