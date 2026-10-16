/**
 * Definisi template laporan keuangan UMKM Indonesia.
 *
 * Kenapa file ini ada: demo ke calon klien pertama gagal karena laporan keuangan
 * yang keluar cuma dokumen Word polos tanpa pos-pos akuntansi yang jelas. File ini menutup
 * gap itu dengan struktur yang DIRUJUK dari standar (SAK EMKM - Ikatan Akuntan Indonesia)
 * plus konvensi praktik UMKM yang lazim dipakai, bukan hasil tebakan LLM.
 *
 * Prinsip desain (wajib dijaga di setiap perubahan file ini):
 * - Template = data TypeScript statis. Section, pos akun, kolom, dan aturan penyajian
 *   SEMUA ditentukan di sini secara deterministik. LLM di hilir (generation-engine.ts,
 *   milik Fatur, tidak disentuh dari file ini) hanya mengisi narasi dan nominal dari
 *   brief pengguna, tidak pernah menentukan struktur laporan.
 * - Tidak ada panggilan LLM/network/DB apapun di file ini. Semua fungsi murni (pure).
 * - File ini berdiri sendiri: tidak mengimpor apapun dari generation-engine.ts atau
 *   template-library.ts (keduanya milik Fatur) karena skema template generik mereka
 *   (daftar section bebas) tidak bisa menampung pos akuntansi baku dengan rumus subtotal
 *   tetap yang dibutuhkan laporan keuangan.
 * - Angka tarif pajak SENGAJA TIDAK dimasukkan ke file ini. Laporan keuangan (Laba Rugi/
 *   Neraca/Arus Kas) hanya butuh "Beban Pajak" sebagai satu pos, bukan mekanisme
 *   perhitungan PPN/PPh yang berubah tiap tahun - itu domain template invoice, bukan
 *   template laporan keuangan.
 *
 * Sumber acuan (riset multi-sumber, lihat context pack SCAN 2 untuk detail lengkap):
 * - SAK EMKM (Exposure Draft, IAI, efektif 1 Jan 2018): iaiglobal.or.id, par. 3.x
 *   (3 komponen laporan wajib: Laporan Posisi Keuangan, Laporan Laba Rugi, CALK),
 *   par. 4.2 (pos neraca), par. 5.2 (pos laba rugi), par. 6.2 (isi CALK).
 * - PSAK 2 / PSAK 207 (Laporan Arus Kas): metode langsung vs tidak langsung, TIDAK
 *   diwajibkan untuk skala EMKM.
 * - Konvensi praktik UMKM (jurnal.id, accountingplus.id, pnm.co.id): breakdown HPP dan
 *   beban operasional yang lazim diharapkan klien meski tidak wajib secara SAK EMKM
 *   literal - inilah kesenjangan yang bikin demo ke calon klien pertama terasa "tidak resmi".
 */

/** Satu-satunya output format yang didukung untuk laporan keuangan: tabel Excel.
 *  Word tidak cocok untuk laporan dengan banyak kolom periode dan rumus subtotal. */
export type FinancialOutputType = 'excel';

/** Satu pos/akun di dalam sebuah section laporan. */
export interface FinancialLineItem {
  /** Nama pos sesuai istilah akuntansi Indonesia, siap ditampilkan ke pengguna. */
  label: string;
  /** True kalau pos ini pengurang (retur, akumulasi penyusutan, dsb) - wajib ditulis
   *  dalam kurung sesuai aturan penyajian, bukan tanda minus. */
  pengurang?: boolean;
  /** Catatan singkat kalau pos ini butuh penjelasan tambahan (opsional, jarang dipakai). */
  catatan?: string;
}

/** Satu kelompok/section dalam laporan, diakhiri subtotal kalau ada. */
export interface FinancialReportSection {
  /** Nama section, contoh: "Pendapatan Usaha", "Aset Lancar". */
  label: string;
  /** Pos-pos akun di section ini, urutan wajib diikuti persis. */
  posPos: FinancialLineItem[];
  /** Label subtotal di akhir section, kalau section ini menghasilkan subtotal
   *  (contoh: "Laba Kotor" di akhir section HPP). Kosongkan kalau section tidak
   *  punya subtotal sendiri (misal section terakhir yang cuma menambah pos). */
  subtotalLabel?: string;
  /** Penjelasan cara hitung subtotal dalam bahasa manusia, bukan rumus kode, supaya
   *  LLM di hilir tahu OPERASI apa yang harus dilakukan tanpa menebak sendiri. */
  subtotalFormula?: string;
  /** Catatan khusus section ini, misal soal fleksibilitas SAK EMKM soal urutan pos. */
  catatan?: string;
}

/** Definisi satu kolom tabel laporan. */
export interface FinancialReportColumn {
  key: string;
  label: string;
  deskripsi: string;
}

/** Satu template laporan keuangan lengkap, siap dipakai fase integrate untuk
 *  memperkaya brief sebelum diserahkan ke runGeneration milik Fatur. */
export interface FinancialReportTemplate {
  id: string;
  label: string;
  outputType: FinancialOutputType;
  /** Standar/acuan yang dipakai, ditulis eksplisit supaya jujur ke pengguna soal
   *  batas kepatuhan (compliance) template ini - lihat larangan overclaim di bawah. */
  standarAcuan: string;
  deskripsiSingkat: string;
  sections: FinancialReportSection[];
  kolom: FinancialReportColumn[];
  aturanPenyajian: string[];
  larangan: string[];
  /** Disclaimer baku yang wajib muncul di footer/CALK setiap laporan yang di-generate
   *  dari template ini. Melindungi KLIR dari klaim memberi nasihat akuntansi/pajak
   *  yang mengikat secara hukum. */
  disclaimer: string;
}

const DISCLAIMER_STANDAR =
  'Laporan ini disusun berdasarkan input pengguna dan mengacu pada kerangka SAK EMKM ' +
  '(Ikatan Akuntan Indonesia); disarankan direview oleh akuntan atau konsultan pajak ' +
  'berlisensi sebelum digunakan untuk keperluan resmi (perpajakan, perbankan, investor).';

const KOLOM_TIGA_PERIODE: FinancialReportColumn[] = [
  { key: 'keterangan', label: 'Keterangan', deskripsi: 'Nama pos/akun sesuai struktur template.' },
  {
    key: 'periode_berjalan',
    label: 'Periode Berjalan',
    deskripsi: 'Nilai pos untuk periode yang sedang dilaporkan, sesuai data dari brief pengguna.',
  },
  {
    key: 'periode_sebelumnya',
    label: 'Periode Sebelumnya',
    deskripsi:
      'Nilai pos untuk periode pembanding (bulan/tahun lalu). Kosongkan dengan keterangan ' +
      '"tidak tersedia" kalau brief pengguna tidak menyebut data pembanding - jangan diisi 0.',
  },
  {
    key: 'selisih',
    label: 'Selisih',
    deskripsi:
      'Periode Berjalan dikurangi Periode Sebelumnya. Hanya diisi kalau kedua kolom di ' +
      'kiri kolom ini terisi; kalau salah satu "tidak tersedia", kolom ini juga "tidak tersedia".',
  },
];

const ATURAN_PENYAJIAN_UMUM: string[] = [
  'Semua nominal dalam mata uang Rupiah, format ribuan pakai tanda titik (contoh: 1.500.000).',
  'Angka pengurang (retur, potongan, akumulasi penyusutan, beban) ditulis dalam tanda kurung, bukan tanda minus.',
  'Subtotal wajib ditampilkan pada setiap akhir kelompok section sesuai kolom subtotalLabel, dipisahkan garis dari pos-pos di atasnya.',
];

const LARANGAN_UMUM: string[] = [
  'Jangan mengarang nominal untuk pos yang tidak disebut datanya di brief pengguna. Tulis "tidak tersedia" pada pos itu, bukan 0 - 0 berarti nilai nol yang sungguhan terjadi, beda makna dengan data yang tidak ada.',
  'Jangan menambah atau menghilangkan pos di luar struktur section yang sudah ditentukan template ini, kecuali brief pengguna eksplisit minta pos tambahan - demi konsistensi dan kredibilitas laporan antar periode.',
  'Jangan menyimpulkan status "sehat/tidak sehat/untung besar/rugi parah" sebagai klaim tanpa ada data periode pembanding pada brief pengguna. Tanpa pembanding, laporkan angka apa adanya tanpa vonis.',
  'Jangan menghitung atau mengasumsikan tarif pajak tertentu. Beban pajak diisi HANYA dari angka yang diberikan brief pengguna; kalau tidak ada, tulis "tidak tersedia".',
];

/**
 * Katalog template laporan keuangan. Kunci = id template.
 *
 * 5 template disediakan (melebihi minimum 4) karena riset SAK EMKM menunjukkan
 * "laporan laba rugi standar" itu ambigu: versi literal SAK EMKM cuma 3 pos (par. 5.2),
 * jauh lebih minimalis dari ekspektasi bisnis klien yang minta breakdown HPP dan beban
 * operasional. Dua varian laba-rugi disediakan supaya keduanya sah dipakai berdampingan
 * tanpa salah satu pihak (compliance literal vs ekspektasi bisnis) dikorbankan diam-diam.
 */
export const FINANCIAL_REPORT_TEMPLATES: Record<string, FinancialReportTemplate> = {
  'laba-rugi-lengkap-umkm': {
    id: 'laba-rugi-lengkap-umkm',
    label: 'Laporan Laba Rugi (Lengkap, Standar Praktik UMKM)',
    outputType: 'excel',
    standarAcuan:
      'Kerangka SAK EMKM (IAI) dengan tambahan breakdown HPP dan beban operasional ' +
      'sesuai konvensi praktik UMKM yang lazim diminta bank/investor/pemilik usaha.',
    deskripsiSingkat:
      'Varian DEFAULT untuk laporan laba rugi yang dipakai demo ke klien. Lebih kaya dari ' +
      'versi minimalis SAK EMKM literal (lihat template laba-rugi-ringkas-sak-emkm) karena ' +
      'SAK EMKM par. 5.3 mengizinkan akun tambahan selama relevan untuk pemahaman kinerja usaha.',
    sections: [
      {
        label: 'Pendapatan Usaha',
        posPos: [
          { label: 'Penjualan / Pendapatan Jasa' },
          { label: 'Retur dan Potongan Penjualan', pengurang: true },
        ],
        subtotalLabel: 'Pendapatan Usaha Bersih',
        subtotalFormula: 'Penjualan/Pendapatan Jasa dikurangi Retur dan Potongan Penjualan.',
      },
      {
        label: 'Harga Pokok Penjualan',
        posPos: [
          { label: 'Persediaan Awal Periode' },
          { label: 'Pembelian Bersih' },
          { label: 'Persediaan Akhir Periode', pengurang: true },
        ],
        subtotalLabel: 'Laba Kotor',
        subtotalFormula:
          'Pendapatan Usaha Bersih dikurangi Harga Pokok Penjualan (Persediaan Awal ditambah ' +
          'Pembelian Bersih dikurangi Persediaan Akhir).',
        catatan:
          'Section ini dikosongkan/dilewati untuk usaha jasa murni yang tidak punya persediaan ' +
          'barang dagangan - dalam kasus itu Laba Kotor sama dengan Pendapatan Usaha Bersih.',
      },
      {
        label: 'Beban Operasional',
        posPos: [
          { label: 'Beban Gaji dan Tunjangan Karyawan' },
          { label: 'Beban Sewa Tempat Usaha' },
          { label: 'Beban Listrik, Air, dan Internet' },
          { label: 'Beban Pemasaran dan Promosi' },
          { label: 'Beban Penyusutan Aset Tetap' },
          { label: 'Beban Operasional Lainnya' },
        ],
        subtotalLabel: 'Laba Usaha',
        subtotalFormula: 'Laba Kotor dikurangi Total Beban Operasional.',
      },
      {
        label: 'Pendapatan dan Beban Lain-lain',
        posPos: [
          { label: 'Pendapatan Bunga dan Lain-lain di Luar Usaha Pokok' },
          { label: 'Beban Bunga dan Lain-lain di Luar Usaha Pokok', pengurang: true },
        ],
        subtotalLabel: 'Laba Sebelum Pajak',
        subtotalFormula: 'Laba Usaha ditambah Pendapatan Lain-lain dikurangi Beban Lain-lain.',
      },
      {
        label: 'Pajak Penghasilan',
        posPos: [{ label: 'Beban Pajak Penghasilan', pengurang: true }],
        subtotalLabel: 'Laba Bersih',
        subtotalFormula: 'Laba Sebelum Pajak dikurangi Beban Pajak Penghasilan.',
      },
    ],
    kolom: KOLOM_TIGA_PERIODE,
    aturanPenyajian: [
      ...ATURAN_PENYAJIAN_UMUM,
      'Laba Bersih adalah baris terakhir dan wajib jadi satu-satunya angka yang ditonjolkan (bold/highlight) di seluruh laporan.',
    ],
    larangan: LARANGAN_UMUM,
    disclaimer: DISCLAIMER_STANDAR,
  },

  'laba-rugi-ringkas-sak-emkm': {
    id: 'laba-rugi-ringkas-sak-emkm',
    label: 'Laporan Laba Rugi (Ringkas, Literal SAK EMKM)',
    outputType: 'excel',
    standarAcuan: 'SAK EMKM (IAI), Exposure Draft par. 5.2 - versi minimal literal, bukan interpretasi praktik.',
    deskripsiSingkat:
      'Versi PALING MINIMAL sesuai teks resmi SAK EMKM par. 5.2: hanya 3 pos wajib ' +
      '(pendapatan, beban keuangan, beban pajak). Sengaja tidak memuat HPP atau breakdown ' +
      'beban operasional secara terpisah karena SAK EMKM literal tidak mewajibkannya. Pakai ' +
      'template ini HANYA kalau pengguna secara eksplisit minta laporan "sesuai SAK EMKM murni" ' +
      'atau kepatuhan compliance ketat; untuk kebutuhan bisnis sehari-hari pakai laba-rugi-lengkap-umkm.',
    sections: [
      {
        label: 'Pendapatan',
        posPos: [{ label: 'Pendapatan Usaha' }],
      },
      {
        label: 'Beban Keuangan',
        posPos: [{ label: 'Beban Bunga Pinjaman dan Biaya Keuangan Lain', pengurang: true }],
        catatan:
          '"Beban Keuangan" dalam SAK EMKM merujuk pada biaya finansial (bunga pinjaman dsb), ' +
          'BUKAN seluruh beban operasional usaha - beban operasional tidak termasuk dalam 3 pos wajib SAK EMKM par. 5.2.',
      },
      {
        label: 'Beban Pajak',
        posPos: [{ label: 'Beban Pajak Penghasilan', pengurang: true }],
        subtotalLabel: 'Laba Bersih',
        subtotalFormula: 'Pendapatan dikurangi Beban Keuangan dikurangi Beban Pajak.',
      },
    ],
    kolom: KOLOM_TIGA_PERIODE,
    aturanPenyajian: [
      ...ATURAN_PENYAJIAN_UMUM,
      'Wajib cantumkan catatan eksplisit di CALK bahwa laporan ini memakai 3 pos minimal sesuai SAK EMKM par. 5.2, bukan laporan yang mencakup rincian beban operasional.',
    ],
    larangan: [
      ...LARANGAN_UMUM,
      'Jangan tambahkan pos HPP atau beban operasional ke template ini walau brief pengguna menyebutnya - kalau pengguna butuh rincian itu, arahkan ke template laba-rugi-lengkap-umkm, jangan dicampur di template ringkas ini supaya klaim "sesuai SAK EMKM literal" tetap valid.',
    ],
    disclaimer: DISCLAIMER_STANDAR,
  },

  'neraca-posisi-keuangan': {
    id: 'neraca-posisi-keuangan',
    label: 'Laporan Posisi Keuangan (Neraca)',
    outputType: 'excel',
    standarAcuan: 'SAK EMKM (IAI), Exposure Draft par. 4.2-4.9, dengan pemisahan aset/liabilitas jangka pendek-panjang sesuai konvensi praktik.',
    deskripsiSingkat:
      'SAK EMKM par. 4.4 secara eksplisit tidak mewajibkan urutan/format baku untuk neraca. ' +
      'Urutan di template ini (aset lancar dahulu, lalu aset tetap; liabilitas jangka pendek ' +
      'dahulu) mengikuti konvensi praktik yang paling umum dan paling mudah dibaca investor/bank.',
    sections: [
      {
        label: 'Aset Lancar',
        posPos: [
          { label: 'Kas dan Setara Kas' },
          { label: 'Bank' },
          { label: 'Piutang Usaha' },
          { label: 'Persediaan' },
          { label: 'Biaya Dibayar di Muka' },
        ],
        subtotalLabel: 'Total Aset Lancar',
        subtotalFormula: 'Jumlah seluruh pos di section Aset Lancar.',
      },
      {
        label: 'Aset Tetap',
        posPos: [
          { label: 'Tanah' },
          { label: 'Bangunan' },
          { label: 'Kendaraan' },
          { label: 'Peralatan dan Mesin' },
          { label: 'Akumulasi Penyusutan Aset Tetap', pengurang: true },
        ],
        subtotalLabel: 'Total Aset Tetap',
        subtotalFormula: 'Jumlah nilai perolehan aset tetap dikurangi Akumulasi Penyusutan.',
      },
      {
        label: 'Total Aset',
        posPos: [],
        subtotalLabel: 'Total Aset',
        subtotalFormula: 'Total Aset Lancar ditambah Total Aset Tetap.',
        catatan: 'Section penjumlah, tidak punya pos sendiri - murni menjumlahkan dua section aset di atas.',
      },
      {
        label: 'Liabilitas Jangka Pendek',
        posPos: [
          { label: 'Utang Usaha' },
          { label: 'Utang Gaji' },
          { label: 'Utang Pajak' },
          { label: 'Utang Bank Jangka Pendek' },
        ],
        subtotalLabel: 'Total Liabilitas Jangka Pendek',
        subtotalFormula: 'Jumlah seluruh pos di section Liabilitas Jangka Pendek.',
      },
      {
        label: 'Liabilitas Jangka Panjang',
        posPos: [{ label: 'Utang Bank atau Pinjaman Jangka Panjang' }],
        subtotalLabel: 'Total Liabilitas',
        subtotalFormula: 'Total Liabilitas Jangka Pendek ditambah Total Liabilitas Jangka Panjang.',
      },
      {
        label: 'Ekuitas',
        posPos: [
          { label: 'Modal Disetor Pemilik' },
          { label: 'Saldo Laba Ditahan' },
        ],
        subtotalLabel: 'Total Liabilitas dan Ekuitas',
        subtotalFormula:
          'Total Liabilitas ditambah Total Ekuitas. Hasil ini WAJIB sama dengan Total Aset ' +
          '(prinsip keseimbangan neraca) - kalau tidak sama, ikuti aturan penyajian soal selisih di bawah.',
      },
    ],
    kolom: KOLOM_TIGA_PERIODE,
    aturanPenyajian: [
      ...ATURAN_PENYAJIAN_UMUM,
      'Total Aset wajib sama dengan Total Liabilitas dan Ekuitas. Kalau brief pengguna menghasilkan angka yang tidak seimbang, tampilkan apa adanya dan tambahkan catatan peringatan eksplisit di CALK - jangan menyesuaikan angka mana pun supaya "terlihat seimbang".',
      'Klasifikasi pos ke jangka pendek/panjang mengikuti kelaziman umum kalau brief pengguna tidak menyebut jatuh tempo eksplisit (Kas/Piutang/Persediaan selalu lancar; Tanah/Bangunan/Kendaraan selalu aset tetap); asumsi ini wajib dicatat eksplisit di CALK.',
    ],
    larangan: [
      ...LARANGAN_UMUM,
      'Jangan mengarang nilai residu atau nilai wajar aset tetap yang tidak disebut di brief pengguna.',
      'Jangan menambah pos penyeimbang fiktif (misal "penyesuaian" atau "selisih pembukuan") untuk memaksa neraca terlihat seimbang.',
    ],
    disclaimer: DISCLAIMER_STANDAR,
  },

  'laporan-arus-kas': {
    id: 'laporan-arus-kas',
    label: 'Laporan Arus Kas (Metode Tidak Langsung)',
    outputType: 'excel',
    standarAcuan: 'PSAK 2 / PSAK 207 (Laporan Arus Kas). TIDAK diwajibkan SAK EMKM untuk skala usaha mikro-kecil-menengah.',
    deskripsiSingkat:
      'Laporan TAMBAHAN/opsional, bukan bagian dari 3 laporan wajib SAK EMKM (Posisi Keuangan, ' +
      'Laba Rugi, CALK). Disediakan untuk kebutuhan analisis kas internal atau permintaan pihak ' +
      'ketiga (bank/investor). Memakai metode tidak langsung (mulai dari laba bersih, disesuaikan ' +
      'pos nonkas dan perubahan modal kerja) karena paling mudah disusun dari data akuntansi akrual ' +
      'yang sudah ada di Laba Rugi dan Neraca - metode langsung (rincian kas masuk/keluar bruto per ' +
      'kategori) butuh struktur pos yang berbeda dan tidak ditampung template ini.',
    sections: [
      {
        label: 'Arus Kas dari Aktivitas Operasi',
        posPos: [
          { label: 'Laba Bersih (diambil dari Laporan Laba Rugi periode yang sama)' },
          { label: 'Penyesuaian: Beban Penyusutan (ditambahkan kembali karena bukan pengeluaran kas)' },
          { label: 'Perubahan Piutang Usaha (kenaikan = pengurang kas, penurunan = penambah kas)' },
          { label: 'Perubahan Persediaan (kenaikan = pengurang kas, penurunan = penambah kas)' },
          { label: 'Perubahan Utang Usaha (kenaikan = penambah kas, penurunan = pengurang kas)' },
        ],
        subtotalLabel: 'Kas Bersih dari Aktivitas Operasi',
        subtotalFormula: 'Laba Bersih ditambah/dikurangi seluruh pos penyesuaian di section ini sesuai arah pengaruhnya terhadap kas.',
      },
      {
        label: 'Arus Kas dari Aktivitas Investasi',
        posPos: [
          { label: 'Pembelian Aset Tetap', pengurang: true },
          { label: 'Penjualan Aset Tetap' },
        ],
        subtotalLabel: 'Kas Bersih dari Aktivitas Investasi',
        subtotalFormula: 'Penjualan Aset Tetap dikurangi Pembelian Aset Tetap.',
      },
      {
        label: 'Arus Kas dari Aktivitas Pendanaan',
        posPos: [
          { label: 'Penerimaan Pinjaman Bank' },
          { label: 'Pembayaran Cicilan Pokok Pinjaman', pengurang: true },
          { label: 'Setoran Modal Pemilik' },
          { label: 'Penarikan/Prive Pemilik', pengurang: true },
        ],
        subtotalLabel: 'Kas Bersih dari Aktivitas Pendanaan',
        subtotalFormula: 'Jumlah penerimaan dikurangi jumlah pembayaran/penarikan di section ini.',
      },
      {
        label: 'Rekonsiliasi Kas',
        posPos: [
          { label: 'Kas dan Setara Kas Awal Periode' },
        ],
        subtotalLabel: 'Kas dan Setara Kas Akhir Periode',
        subtotalFormula:
          'Kas dan Setara Kas Awal Periode ditambah Kas Bersih dari Aktivitas Operasi, ' +
          'Investasi, dan Pendanaan. Hasil ini WAJIB sama dengan saldo Kas dan Setara Kas ' +
          'di Laporan Posisi Keuangan akhir periode yang sama.',
      },
    ],
    kolom: KOLOM_TIGA_PERIODE,
    aturanPenyajian: [
      ...ATURAN_PENYAJIAN_UMUM,
      'Kas dan Setara Kas Akhir Periode wajib direkonsiliasi dengan saldo Kas dan Setara Kas di Laporan Posisi Keuangan periode yang sama; kalau berbeda, laporkan selisihnya apa adanya di CALK, jangan dipaksa sama.',
      'Wajib cantumkan catatan eksplisit bahwa laporan ini bersifat tambahan/opsional, bukan kewajiban SAK EMKM.',
    ],
    larangan: [
      ...LARANGAN_UMUM,
      'Jangan hitung penyesuaian modal kerja (perubahan piutang/persediaan/utang usaha) kalau brief pengguna tidak memberi saldo awal DAN akhir periode untuk pos itu - tulis "tidak tersedia", jangan menebak arah perubahannya.',
      'Jangan klaim laporan ini sebagai bagian dari kewajiban SAK EMKM kepada pengguna.',
    ],
    disclaimer: DISCLAIMER_STANDAR,
  },

  'ringkasan-keuangan-bulanan': {
    id: 'ringkasan-keuangan-bulanan',
    label: 'Ringkasan Keuangan Bulanan (Satu Halaman untuk Pemilik)',
    outputType: 'excel',
    standarAcuan:
      'Bukan laporan formal SAK EMKM - ringkasan turunan dari data laporan formal, ' +
      'dirancang untuk dibaca cepat oleh pemilik usaha, bukan untuk keperluan resmi.',
    deskripsiSingkat:
      'Satu halaman gabungan indikator penting untuk pemilik usaha yang tidak sempat baca ' +
      'laporan lengkap. Bahasa sengaja disederhanakan (contoh: "Untung/Rugi" bukan "Laba Bersih") ' +
      'karena target pembaca adalah pemilik usaha, bukan bank/investor/kantor pajak.',
    sections: [
      {
        label: 'Indikator Utama Bulan Ini',
        posPos: [
          { label: 'Total Pendapatan Bulan Ini' },
          { label: 'Total Beban Bulan Ini', pengurang: true },
          { label: 'Kas di Tangan dan Bank per Akhir Bulan' },
        ],
        subtotalLabel: 'Untung/Rugi Bulan Ini',
        subtotalFormula: 'Total Pendapatan Bulan Ini dikurangi Total Beban Bulan Ini.',
      },
      {
        label: 'Perbandingan Bulan Lalu',
        posPos: [
          { label: 'Pendapatan Bulan Lalu' },
          { label: 'Untung/Rugi Bulan Lalu' },
        ],
        catatan:
          'Kalau data bulan lalu tidak tersedia di brief pengguna, tampilkan hanya kolom ' +
          'Bulan Ini dan tulis "pembanding tidak tersedia" pada kolom Bulan Lalu - jangan isi 0.',
      },
      {
        label: 'Piutang dan Utang Beredar',
        posPos: [
          { label: 'Total Piutang Usaha Belum Tertagih' },
          { label: 'Total Utang Usaha Belum Dibayar' },
        ],
      },
      {
        label: 'Catatan Pemilik',
        posPos: [{ label: 'Catatan naratif singkat, maksimal 3-4 kalimat' }],
        catatan:
          'Satu-satunya bagian yang boleh diisi naratif oleh LLM, menjelaskan sebab perubahan ' +
          'angka terbesar dibanding bulan lalu. LLM DILARANG menyarankan keputusan bisnis ' +
          'definitif (contoh: "sebaiknya kurangi karyawan") - itu wilayah keputusan pemilik, bukan wilayah laporan.',
      },
    ],
    kolom: [
      { key: 'keterangan', label: 'Keterangan', deskripsi: 'Nama indikator.' },
      { key: 'bulan_ini', label: 'Bulan Ini', deskripsi: 'Nilai indikator untuk bulan yang sedang dilaporkan.' },
      {
        key: 'bulan_lalu',
        label: 'Bulan Lalu',
        deskripsi: 'Nilai indikator bulan sebelumnya. "Tidak tersedia" kalau brief pengguna tidak menyebutnya.',
      },
      {
        key: 'selisih',
        label: 'Selisih',
        deskripsi: 'Bulan Ini dikurangi Bulan Lalu. "Tidak tersedia" kalau salah satu kolom di kiri "tidak tersedia".',
      },
    ],
    aturanPenyajian: [
      ...ATURAN_PENYAJIAN_UMUM,
      'Ringkasan ini BUKAN pengganti Laporan Laba Rugi/Neraca/Arus Kas formal; kalau pengguna butuh dokumen untuk bank/investor/kantor pajak, arahkan ke template formal, bukan ringkasan ini.',
    ],
    larangan: [
      ...LARANGAN_UMUM,
      'Jangan gunakan ringkasan ini sebagai bukti resmi ke bank/kantor pajak/investor - sertakan disclaimer ini secara eksplisit di footer.',
      'Jangan buat kesimpulan "bisnis sehat/tidak sehat" tanpa data pembanding bulan lalu.',
    ],
    disclaimer: DISCLAIMER_STANDAR,
  },
};

/** Resolve template berdasarkan id, exact match setelah normalisasi (trim + lowercase).
 *  Id tidak dikenal atau kosong -> null (tidak pernah melempar error, mengikuti pola
 *  resolveIndustryTemplate di industry-image-templates.ts). */
export function resolveFinancialReportTemplate(id?: string): FinancialReportTemplate | null {
  if (!id) return null;
  const normalized = id.trim().toLowerCase();
  if (!normalized) return null;
  return FINANCIAL_REPORT_TEMPLATES[normalized] ?? null;
}

/** Daftar semua template yang tersedia, untuk kebutuhan menu/pemilihan di fase integrate. */
export function listFinancialReportTemplates(): FinancialReportTemplate[] {
  return Object.values(FINANCIAL_REPORT_TEMPLATES);
}

/**
 * Susun blok instruksi teks dari sebuah template, untuk memperkaya brief pengguna
 * sebelum diserahkan ke runGeneration (generation-engine.ts, milik Fatur).
 *
 * Fungsi ini murni penyusun string dari data template - tidak ada logika akuntansi
 * yang dieksekusi di sini, hanya menerjemahkan struktur data jadi instruksi teks yang
 * bisa dibaca LLM. LLM di hilir yang mengisi nominal dari brief pengguna ke pos-pos ini.
 *
 * Id tidak dikenal -> string kosong (tidak mengarang instruksi), mengikuti pola
 * enrichWithIndustry di industry-image-templates.ts.
 */
export function buildFinancialReportInstruction(id?: string): string {
  const template = resolveFinancialReportTemplate(id);
  if (!template) return '';

  const sectionBlock = template.sections
    .map((section, index) => {
      const posLines = section.posPos
        .map((item) => {
          const tanda = item.pengurang ? ' (pengurang, tulis dalam kurung)' : '';
          const catatanPos = item.catatan ? ` - ${item.catatan}` : '';
          return `     - ${item.label}${tanda}${catatanPos}`;
        })
        .join('\n');
      const subtotalLine = section.subtotalLabel
        ? `\n     Subtotal: ${section.subtotalLabel} = ${section.subtotalFormula ?? ''}`
        : '';
      const catatanSection = section.catatan ? `\n     Catatan: ${section.catatan}` : '';
      const posBlock = posLines ? `\n${posLines}` : '';
      return `  ${index + 1}. ${section.label}${posBlock}${subtotalLine}${catatanSection}`;
    })
    .join('\n');

  const kolomBlock = template.kolom.map((k) => `  - ${k.label}: ${k.deskripsi}`).join('\n');
  const aturanBlock = template.aturanPenyajian.map((a) => `  - ${a}`).join('\n');
  const laranganBlock = template.larangan.map((l) => `  - ${l}`).join('\n');

  return [
    `Susun dokumen sebagai "${template.label}".`,
    `Standar/acuan: ${template.standarAcuan}`,
    template.deskripsiSingkat,
    '',
    'Ikuti struktur section dan pos akun berikut secara berurutan (jangan diacak, jangan ditambah/dikurangi tanpa instruksi eksplisit dari brief pengguna):',
    sectionBlock,
    '',
    'Kolom tabel yang wajib dipakai:',
    kolomBlock,
    '',
    'Aturan penyajian wajib:',
    aturanBlock,
    '',
    'Larangan yang wajib dipatuhi:',
    laranganBlock,
    '',
    `Disclaimer wajib disertakan di footer atau CALK dokumen: "${template.disclaimer}"`,
  ].join('\n');
}
