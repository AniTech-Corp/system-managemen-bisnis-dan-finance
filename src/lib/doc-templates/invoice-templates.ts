/**
 * Template dokumen transaksi (invoice, surat penawaran harga, surat tagihan pengingat)
 * untuk KLIR. Dasar: riset multi-sumber standar dokumen niaga Indonesia (elemen invoice,
 * mekanisme PPN/status PKP, format surat penawaran) yang dijalankan terpisah dari sesi ini
 * -- bukan hasil tebakan model. Modul ini murni DATA STRUKTUR dan ATURAN, deterministik,
 * tidak ada satupun panggilan LLM di file ini.
 *
 * Kenapa ini perlu: demo ke calon klien pertama menemukan generator
 * dokumen niaga KLIR keluarnya dokumen polos tanpa struktur baku -- tidak ada nomor invoice
 * yang konsisten, jatuh tempo sering hilang, dan PPN/status pajak dicampur adukkan padahal
 * dua hal itu perlu perlakuan berbeda. Template di sini mengunci bagian/field wajib supaya
 * LLM (dipanggil di luar file ini, oleh route yang memakai templateId) cuma mengisi narasi
 * -- bukan menentukan sendiri pos apa yang wajib ada di sebuah invoice atau kapan PPN boleh
 * dicantumkan.
 *
 * Batasan disengaja (jangan "diperbaiki" tanpa sepengetahuan pemilik lane masing-masing):
 * - Tidak ada perhitungan pajak/total di sini. Modul ini cuma mendeskripsikan field apa yang
 *   wajib ada dan aturan apa yang berlaku -- perhitungan aktual dan rendering dokumen adalah
 *   tanggung jawab pemanggil (di luar file ini).
 * - Tarif PPN TIDAK di-hardcode. Aturan pajak Indonesia terbukti berubah tiap pergantian
 *   tahun (11 persen ke 12 persen persis di 1 Januari 2025), jadi tarif wajib jadi input
 *   yang bisa dikonfirmasi/diedit pengguna, bukan angka tetap di kode.
 * - Nomor Seri Faktur Pajak (NSFP) tidak pernah dibuat di sini. NSFP cuma sah kalau
 *   diterbitkan resmi lewat sistem DJP (e-Faktur/Coretax) -- KLIR bukan sistem itu.
 */

export type InvoiceTemplateOutputType = 'word' | 'excel';

export interface InvoiceDocTemplate {
  /** Identifier stabil, dipakai sebagai nilai templateId. Jangan diganti setelah dipakai user. */
  id: string;
  label: string;
  outputType: InvoiceTemplateOutputType;
  /** Kegunaan singkat template ini, untuk ditampilkan di UI pemilihan template. */
  description: string;
  /**
   * Bagian/field yang wajib ada di dokumen jenis ini. Tiap entri bertipe "Label - detail
   * kolom/isi yang wajib" -- ikuti gaya penulisan yang sama dengan sections di
   * template-library.ts supaya konsisten kalau nanti dibaca campuran oleh pemanggil.
   */
  requiredSections: string[];
  /**
   * Panduan format penomoran yang LAZIM dipakai pelaku usaha -- bukan format resmi yang
   * diwajibkan pemerintah. Ditulis eksplisit di tiap template supaya LLM/pemanggil tidak
   * mengarang klaim "sesuai standar pemerintah" untuk sesuatu yang sebenarnya konvensi bisnis.
   */
  numberingGuidance: string;
  /**
   * Catatan soal pajak untuk template ini. Untuk template yang tidak menyangkut pajak,
   * diisi penegasan bahwa dokumen ini bukan objek pajak -- supaya tidak ada ambiguitas.
   */
  taxNote: string;
  /** Larangan spesifik yang wajib dipatuhi saat mengisi narasi dokumen jenis ini. */
  prohibitions: string[];
}

export const INVOICE_DOC_TEMPLATES: InvoiceDocTemplate[] = [
  {
    id: 'invoice-standar',
    label: 'Invoice Standar (Tanpa PPN)',
    outputType: 'word',
    description:
      'Invoice komersial untuk usaha yang belum berstatus Pengusaha Kena Pajak (PKP) atau tidak mencantumkan PPN pada transaksi ini.',
    requiredSections: [
      'Identitas Penerbit - nama usaha, alamat, kontak (telepon/email); NPWP dicantumkan hanya kalau pengguna memberikannya',
      'Identitas Pelanggan - nama, alamat, dan kontak pihak penerima tagihan',
      'Nomor Invoice - nomor unik dan berurutan, lihat catatan penomoran',
      'Tanggal Terbit dan Tanggal Jatuh Tempo - dua tanggal terpisah, jatuh tempo wajib eksplisit dan tidak boleh dikosongkan',
      'Rincian Barang/Jasa - tabel per baris berisi deskripsi item, kuantitas, harga satuan, dan jumlah (kuantitas dikali harga satuan)',
      'Subtotal - jumlah seluruh baris sebelum diskon',
      'Diskon (jika ada) - nominal atau persentase, sebutkan dasarnya kalau pengguna menjelaskan',
      'Pajak - kosongkan/tidak ditampilkan pada template ini; kalau penerbit berstatus PKP dan transaksi kena PPN, pakai template invoice-dengan-ppn, bukan template ini',
      'Total Tagihan - subtotal dikurangi diskon',
      'Syarat Pembayaran - metode pembayaran dan tempo (contoh: transfer bank, Net 30, atau skema DP/termin), dituliskan eksplisit, tidak boleh kosong',
      'Rekening Tujuan Pembayaran - nama bank, nomor rekening, nama pemilik rekening, sesuai data yang diberikan pengguna',
      'Catatan - informasi tambahan yang relevan, opsional',
    ],
    numberingGuidance:
      'Format umum yang lazim dipakai pelaku usaha: [KODE-JENIS]/[YYYYMM]/[nomor-urut], contoh INV/202609/001. Ini konvensi bisnis internal yang bisa disesuaikan tenant, bukan format resmi yang diwajibkan pemerintah -- syarat pentingnya cuma unik dan berurutan untuk keperluan audit internal.',
    taxNote:
      'Template ini untuk transaksi tanpa PPN. Kalau brief pengguna menyebut PPN, faktur pajak, atau status PKP, jangan dipaksakan ke template ini -- gunakan template invoice-dengan-ppn.',
    prohibitions: [
      'Jangan tulis kata "lunas", "sudah dibayar", atau status pembayaran apapun kalau tidak ada bukti pembayaran yang dikonfirmasi pengguna',
      'Jangan mencantumkan PPN, tarif pajak, atau nomor faktur pajak apapun pada template ini',
      'Jangan mengosongkan tanggal jatuh tempo atau syarat pembayaran',
      'Jangan mengarang nomor rekening, nama bank, atau nama pemilik rekening -- field ini wajib berasal dari data yang diberikan pengguna, bukan ditebak',
    ],
  },
  {
    id: 'invoice-dengan-ppn',
    label: 'Invoice dengan PPN',
    outputType: 'word',
    description:
      'Invoice komersial untuk penerbit yang sudah berstatus Pengusaha Kena Pajak (PKP) dan perlu mencantumkan PPN pada transaksi ini. Bukan Faktur Pajak resmi.',
    requiredSections: [
      'Identitas Penerbit - nama usaha, alamat, kontak, dan NPWP (wajib untuk template ini karena berkaitan status PKP)',
      'Identitas Pelanggan - nama, alamat, dan kontak pihak penerima tagihan',
      'Nomor Invoice - nomor unik dan berurutan, terpisah dari nomor seri faktur pajak (lihat catatan pajak)',
      'Tanggal Terbit dan Tanggal Jatuh Tempo - dua tanggal terpisah, jatuh tempo wajib eksplisit',
      'Rincian Barang/Jasa - tabel per baris berisi deskripsi item, kuantitas, harga satuan, dan jumlah',
      'Subtotal - jumlah seluruh baris sebelum diskon dan pajak',
      'Diskon (jika ada)',
      'Status PKP Penerbit - dinyatakan eksplisit sebagai field ("Ya, berstatus PKP"), harus berasal dari pernyataan pengguna, tidak diasumsikan dari data lain',
      'Tarif PPN - field yang diisi/dikonfirmasi pengguna untuk transaksi ini; lihat catatan pajak soal kenapa ini tidak boleh angka tetap',
      'Nilai PPN - dihitung dari dasar pengenaan pajak dan tarif yang dikonfirmasi pengguna, bukan diasumsikan sendiri oleh penulis narasi',
      'Total Tagihan - subtotal dikurangi diskon ditambah nilai PPN',
      'Syarat Pembayaran - metode dan tempo pembayaran, eksplisit',
      'Rekening Tujuan Pembayaran - sesuai data yang diberikan pengguna',
      'Catatan - wajib memuat penegasan bahwa dokumen ini adalah invoice komersial yang mencantumkan PPN, bukan Faktur Pajak resmi',
    ],
    numberingGuidance:
      'Nomor invoice memakai format bebas seperti template invoice-standar (contoh INV/202609/001) dan itu TERPISAH dari Nomor Seri Faktur Pajak (NSFP). NSFP berformat 16 digit dan hanya diterbitkan resmi oleh sistem DJP (e-Faktur/Coretax) saat Faktur Pajak dibuat -- KLIR tidak membuat dan tidak boleh mengarang NSFP dalam bentuk apapun.',
    taxNote:
      'PPN hanya relevan kalau penerbit berstatus Pengusaha Kena Pajak (PKP). Ambang wajib PKP adalah omzet bruto di atas Rp 4.800.000.000 per tahun buku; di bawah itu PKP bersifat sukarela, bukan wajib. Tarif PPN berubah dari waktu ke waktu (tercatat berubah dari 11 persen ke 12 persen persis di 1 Januari 2025, dengan mekanisme dasar pengenaan pajak yang berbeda untuk barang non-mewah) -- karena itu tarif WAJIB jadi input yang dikonfirmasi pengguna untuk tiap transaksi, tidak boleh diasumsikan tetap oleh penulis narasi. Faktur Pajak resmi (dengan NSFP dari DJP) adalah dokumen hukum terpisah dari invoice komersial ini; kalau pengguna butuh Faktur Pajak, itu perlu diterbitkan lewat sistem resmi DJP, bukan dokumen ini. Sarankan konfirmasi ke akuntan atau konsultan pajak terdaftar sebelum dokumen ini dipakai untuk keperluan pelaporan pajak resmi.',
    prohibitions: [
      'Jangan mencantumkan atau mengarang Nomor Seri Faktur Pajak (NSFP) dalam bentuk apapun; NSFP hanya sah kalau diterbitkan resmi lewat sistem DJP',
      'Jangan klaim dokumen ini sah sebagai Faktur Pajak -- ini invoice komersial yang mencantumkan PPN, secara hukum berbeda dari Faktur Pajak',
      'Jangan menetapkan sendiri tarif PPN (11 persen, 12 persen, atau angka lain) tanpa konfirmasi eksplisit dari pengguna untuk transaksi ini',
      'Jangan asumsikan status PKP penerbit; kalau pengguna tidak menyatakan status PKP secara eksplisit, jangan pakai template ini -- arahkan ke invoice-standar',
      'Jangan tulis kata "lunas" atau status pembayaran apapun tanpa bukti pembayaran yang dikonfirmasi pengguna',
    ],
  },
  {
    id: 'surat-penawaran-harga',
    label: 'Surat Penawaran Harga (Quotation)',
    outputType: 'word',
    description:
      'Surat penawaran harga/jasa ke calon klien sebelum negosiasi lanjut ke invoice atau kontrak kerja sama. Murni konvensi bisnis, bukan objek standar akuntansi atau pajak.',
    requiredSections: [
      'Kop Surat - nama usaha, alamat, kontak, logo (kalau pengguna menyediakan)',
      'Nomor Surat dan Tanggal Penerbitan',
      'Ditujukan Kepada - nama perusahaan dan contact person calon klien',
      'Perihal',
      'Spesifikasi Produk/Jasa - deskripsi tiap item, kuantitas, harga satuan, dan subtotal per baris',
      'Syarat Pembayaran - skema DP/termin/lunas di muka, dituliskan eksplisit',
      'Cara Pengiriman atau Pengerjaan - relevan kalau brief pengguna menyebutkannya',
      'Masa Berlaku Harga Penawaran - tanggal kedaluwarsa penawaran sebagai field terstruktur, bukan kalimat bebas tanpa tanggal pasti',
      'Diskon/Promo (jika ada)',
      'Penutup - ajakan tindak lanjut, ucapan terima kasih, ditutup tanda tangan, nama jelas, dan jabatan penawar',
    ],
    numberingGuidance:
      'Format umum: SPH/[YYYYMM]/[nomor-urut] atau QUO-[nomor-urut], contoh SPH/202609/001. Murni konvensi internal usaha, tidak ada format resmi pemerintah untuk surat penawaran.',
    taxNote:
      'Surat penawaran harga bukan objek pajak dan bukan dokumen yang diatur standar akuntansi apapun -- jangan klaim dokumen ini "sesuai standar akuntansi" atau semacamnya. Kalau harga di penawaran nanti termasuk PPN, sebutkan itu sebagai catatan estimasi saja; angka pajak final tetap ditentukan saat invoice diterbitkan.',
    prohibitions: [
      'Jangan klaim surat penawaran ini "resmi sesuai standar akuntansi" -- quotation adalah dokumen pra-negosiasi, bukan laporan keuangan atau dokumen pajak',
      'Jangan biarkan masa berlaku harga kosong atau implisit; kalau pengguna tidak memberi tanggal, tulis penanda eksplisit "menunggu konfirmasi tanggal dari pengguna", jangan mengarang tanggal',
      'Jangan mengarang harga, kuantitas, atau spesifikasi produk/jasa yang tidak disebutkan di brief pengguna',
    ],
  },
  {
    id: 'surat-tagihan-pengingat',
    label: 'Surat Tagihan Pengingat (Payment Reminder)',
    outputType: 'word',
    description:
      'Surat pengingat pembayaran untuk invoice yang sudah melewati tanggal jatuh tempo. Merujuk ke invoice asli, tidak menggantikan atau mengubah nilai tagihannya.',
    requiredSections: [
      'Kop Surat/Identitas Penerbit',
      'Referensi Invoice Asli - nomor invoice, tanggal terbit, dan tanggal jatuh tempo yang dirujuk, harus sama persis dengan invoice asli',
      'Jumlah Tertunggak - nominal yang belum dibayar dan jumlah hari keterlambatan dihitung dari tanggal jatuh tempo invoice asli',
      'Isi Pengingat - nada profesional dan tegas tanpa nada mengancam, mengingatkan kewajiban pembayaran yang sudah jatuh tempo',
      'Instruksi Pembayaran - rekening tujuan yang sama seperti invoice asli (jangan diubah), dan batas waktu baru yang diminta',
      'Penutup - ajakan konfirmasi/klarifikasi kalau pembayaran sudah dilakukan tapi belum tercatat, plus kontak yang bisa dihubungi',
    ],
    numberingGuidance:
      'Surat pengingat biasanya tidak butuh nomor seri baru -- cukup merujuk nomor invoice asli yang ditagih. Kalau tenant ingin nomor surat pengingat sendiri, format yang bisa dipakai: REM/[nomor-invoice-asli]/[urutan-pengingat-ke], contoh REM/INV-202609-001/1. Ini konvensi internal, bebas disesuaikan tenant.',
    taxNote:
      'Surat pengingat pembayaran bukan dokumen pajak dan tidak mengubah PPN/status PKP yang sudah ditetapkan di invoice asli yang dirujuk -- nilai tagihan (termasuk pajak jika ada) wajib sama persis dengan invoice asli, tidak dihitung ulang.',
    prohibitions: [
      'Jangan gunakan bahasa ancaman hukum (somasi, tuntutan, melibatkan pengacara) kecuali pengguna secara eksplisit menyatakan itu memang langkah yang akan diambil',
      'Jangan mengarang denda keterlambatan atau bunga kalau tidak disepakati di invoice atau kontrak asli; kalau tidak ada info soal denda dari pengguna, jangan sebut nominal denda apapun',
      'Jangan mengubah nominal tagihan dari invoice asli; kalau ada koreksi nominal, itu wajib berasal dari pernyataan eksplisit pengguna, bukan hasil hitung ulang otomatis',
      'Jangan klaim sudah menghubungi berkali-kali atau menyebut riwayat komunikasi tertentu kalau tidak ada data itu dari pengguna',
    ],
  },
  {
    id: 'rekap-invoice-excel',
    label: 'Rekap Invoice (Excel)',
    outputType: 'excel',
    description:
      'Rekap multi-invoice dalam satu workbook untuk kebutuhan pemantauan piutang -- daftar invoice yang diterbitkan dalam satu periode beserta status pembayarannya.',
    requiredSections: [
      'Baris Identitas/Periode - baris banner terpisah di atas tabel, berisi nama usaha dan periode rekap (bukan digabung dengan baris header kolom)',
      'Header Kolom Tabel - nomor invoice, nama pelanggan, tanggal terbit, tanggal jatuh tempo, subtotal, diskon, pajak (jika ada), total, status pembayaran (Belum Dibayar/Sebagian/Lunas)',
      'Baris Data per Invoice - satu baris per invoice, urut berdasarkan tanggal terbit',
      'Baris Total - subtotal, total pajak, dan total tagihan seluruh invoice pada periode ini di baris paling bawah tabel',
      'Catatan - ringkasan singkat kalau ada invoice yang sudah lewat jatuh tempo dan belum dibayar',
    ],
    numberingGuidance:
      'Rekap ini bukan dokumen bernomor sendiri -- dia merujuk nomor-nomor invoice yang sudah ada. Nama file/judul rekap cukup memuat periode, contoh "Rekap Invoice September 2026".',
    taxNote:
      'Kolom pajak pada rekap ini hanya menampilkan nilai yang sudah ditetapkan di masing-masing invoice sumber -- rekap tidak menghitung ulang atau menetapkan tarif pajak baru.',
    prohibitions: [
      'Jangan gabungkan baris banner identitas/periode dengan baris header kolom tabel',
      'Jangan tampilkan status "Lunas" pada invoice manapun tanpa bukti pembayaran yang dikonfirmasi pengguna',
      'Jangan mengarang data invoice yang tidak ada di input pengguna hanya untuk mengisi baris rekap',
    ],
  },
];

/**
 * Alias kata kunci -> id template kanonik. Dicek via exact match dan substring dua arah
 * setelah exact-id match gagal, meniru pola resolveIndustryTemplate di
 * industry-image-templates.ts supaya perilaku resolve konsisten se-codebase.
 */
export const INVOICE_TEMPLATE_ALIASES: Record<string, string> = {
  invoice: 'invoice-standar',
  'invoice-biasa': 'invoice-standar',
  tagihan: 'invoice-standar',
  bill: 'invoice-standar',
  ppn: 'invoice-dengan-ppn',
  pajak: 'invoice-dengan-ppn',
  faktur: 'invoice-dengan-ppn',
  'faktur-pajak': 'invoice-dengan-ppn',
  penawaran: 'surat-penawaran-harga',
  quotation: 'surat-penawaran-harga',
  quote: 'surat-penawaran-harga',
  proposal: 'surat-penawaran-harga',
  pengingat: 'surat-tagihan-pengingat',
  reminder: 'surat-tagihan-pengingat',
  dunning: 'surat-tagihan-pengingat',
  'jatuh-tempo': 'surat-tagihan-pengingat',
  rekap: 'rekap-invoice-excel',
  'rekap-invoice': 'rekap-invoice-excel',
  piutang: 'rekap-invoice-excel',
};

/**
 * Cari template berdasarkan id persis dulu, baru fallback alias kata kunci. Tidak ketemu
 * kombinasi apapun -> return null, TIDAK mengarang template baru (selaras findTemplate di
 * template-library.ts).
 */
export function resolveInvoiceTemplate(input?: string): InvoiceDocTemplate | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  const exact = INVOICE_DOC_TEMPLATES.find((t) => t.id === normalized);
  if (exact) return exact;

  for (const [alias, id] of Object.entries(INVOICE_TEMPLATE_ALIASES)) {
    if (normalized === alias || normalized.includes(alias) || alias.includes(normalized)) {
      const found = INVOICE_DOC_TEMPLATES.find((t) => t.id === id);
      if (found) return found;
    }
  }
  return null;
}

/** Daftar semua template, untuk ditampilkan di UI pemilihan template. */
export function listInvoiceTemplates(): InvoiceDocTemplate[] {
  return INVOICE_DOC_TEMPLATES;
}

/**
 * Susun satu template jadi blok instruksi teks siap disisipkan ke prompt LLM oleh pemanggil
 * (route baru, di luar file ini). Fungsi ini TIDAK memanggil LLM apapun -- cuma merangkai
 * string dari data template. Meniru pola buildTemplateInstruction di generation-engine.ts
 * dan buildQualityInstruction di template-library.ts.
 */
export function buildInvoiceTemplateInstruction(template: InvoiceDocTemplate): string {
  const sectionLines = template.requiredSections.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const prohibitionLines = template.prohibitions.map((p) => `- ${p}`).join('\n');

  return [
    `Ikuti struktur dokumen "${template.label}" berikut sebagai kerangka bagian/field wajib (sesuaikan isi dengan brief pengguna; kalau brief pengguna meminta sesuatu yang berbeda dari struktur ini, ikuti brief pengguna):`,
    sectionLines,
    '',
    `Aturan penomoran: ${template.numberingGuidance}`,
    '',
    `Catatan pajak: ${template.taxNote}`,
    '',
    'Larangan khusus dokumen ini (wajib dipatuhi):',
    prohibitionLines,
  ].join('\n');
}
