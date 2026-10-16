/**
 * Template presentasi (outputType 'ppt') - struktur deck deterministik per kebutuhan bisnis.
 *
 * Lahir dari keluhan demo ke calon klien pertama (5 September 2026): presentasi yang
 * dihasilkan terasa polos, minta "dipercantik" tapi tetap berisi. Modul ini TIDAK menjawab
 * "dipercantik" lewat styling visual (itu urusan renderer pptxgenjs di fase integrate),
 * melainkan lewat STRUKTUR - urutan slide yang punya tujuan jelas, batas jumlah poin per
 * slide supaya tidak padat, dan aturan anti-slop khusus format deck (beda dari dokumen Word
 * atau Excel: di deck, satu slide padat teks itu sendiri sudah pelanggaran, terlepas dari
 * kualitas kalimatnya).
 *
 * Prinsip deterministik (Aturan Keras context pack poin 4): struktur slide, urutan, dan
 * batas jumlah bullet DITENTUKAN DI SINI sebagai data TypeScript, bukan ditebak LLM. Kalau
 * modul ini nanti dipakai fase integrate untuk menyusun instruksi ke LLM, LLM hanya boleh
 * mengisi NARASI di dalam kerangka yang sudah dipatok (judul slide, tujuan, batas bullet) -
 * sama seperti pola buildTemplateInstruction milik Fatur di generation-engine.ts, yang tetap
 * memberi ruang brief user menang kalau brief secara eksplisit minta struktur berbeda. Beda
 * dengan template laporan keuangan (pos akun terikat SAK EMKM secara hukum), struktur deck
 * di sini adalah konvensi bisnis yang wajar fleksibel mengikuti brief - makanya override
 * brief tetap diizinkan di sini, tidak seperti template akuntansi.
 *
 * NOL panggilan LLM di modul ini sendiri - murni data + fungsi deterministik (resolve +
 * builder instruksi teks). Tidak ada import dari generation-engine.ts, template-library.ts,
 * atau file Fatur manapun - modul ini berdiri sendiri di src/lib/doc-templates/.
 */

/** Spesifikasi satu slide di dalam sebuah template deck. */
export interface DeckSlideSpec {
  /** Judul slide - dipakai apa adanya sebagai judul, LLM/penyusun tidak boleh mengubah maksudnya. */
  title: string;
  /** Tujuan slide ini di dalam alur cerita deck - apa yang harus tersampaikan atau tercapai. */
  purpose: string;
  /** Batas maksimal jumlah bullet point di slide ini. 0 berarti slide ini BUKAN slide bullet
   *  (contoh: sampul, slide tabel harga, slide timeline visual) - lihat contentHint untuk itu. */
  maxBullets: number;
  /** Catatan gaya penulisan bullet khusus slide ini, di atas aturan anti-slop umum deck. */
  bulletGuidance?: string;
  /** Petunjuk bentuk konten kalau bukan bullet biasa (tabel, garis waktu, gambar/demo, dsb). */
  contentHint?: string;
}

/** Satu template struktur deck lengkap. */
export interface DeckTemplate {
  id: string;
  label: string;
  /** Untuk siapa deck ini disusun - menentukan nada dan tingkat detail yang wajar. */
  audience: string;
  /** Tujuan keseluruhan deck - apa yang ingin dicapai setelah audiens selesai membaca/menonton. */
  goal: string;
  slides: DeckSlideSpec[];
  /** Aturan anti-slop tambahan yang spesifik untuk template ini, di luar DECK_ANTI_SLOP_RULES umum. */
  extraAntiSlopRules?: string[];
}

/**
 * Aturan anti-slop yang berlaku untuk SEMUA template deck di modul ini. Ini pelengkap
 * QUALITY_RULES umum milik Fatur (template-library.ts) untuk hal yang spesifik ke format
 * presentasi - QUALITY_RULES tidak membedakan Word/Excel/PPT, sedangkan slide punya masalah
 * khasnya sendiri (padat teks, klaim tanpa bukti, judul generik).
 */
export const DECK_ANTI_SLOP_RULES: string[] = [
  'Satu gagasan utama per slide - kalau ada dua gagasan besar yang sama pentingnya, pecah jadi dua slide, jangan digabung supaya "hemat slide".',
  'Bullet wajib berupa frasa singkat (target sekitar 10-15 kata), dilarang bullet berupa kalimat panjang atau anak kalimat bertingkat yang sebenarnya adalah paragraf yang dipotong-potong.',
  'Setiap angka atau klaim kuantitatif wajib menyebut periode/pembanding atau sumbernya (contoh: "naik 20 persen dibanding bulan lalu"), dilarang klaim kuantitatif kosong seperti "meningkat signifikan" tanpa angka.',
  'Dilarang klaim superlatif tanpa bukti pada slide yang sama (contoh: "terbaik", "nomor satu", "paling dipercaya") kecuali disertai data pembanding konkret di slide itu juga.',
  'Judul slide wajib spesifik untuk isi slide itu - dilarang judul generik yang bisa dipakai di deck manapun tanpa perubahan (contoh: "Overview" polos tanpa konteks topik).',
  'Kalau sebuah slide di template tidak relevan dengan brief user (misal tidak ada risiko berarti untuk dilaporkan), boleh dilewati - dilarang memaksa isi slide dengan kalimat basa-basi hanya supaya jumlah slide sesuai template.',
  'Catatan pembicara (speaker notes) boleh memuat detail tambahan, tapi bullet di slide itu sendiri tetap wajib ringkas - dilarang mengosongkan makna bullet dengan alasan "detailnya ada di notes".',
];

/**
 * Katalog template deck. Key = id template = nilai templateId yang dikirim lewat request.
 * Lima template awal menjawab kebutuhan konkret dari demo ke calon klien pertama (penawaran ke klien
 * dan presentasi yang perlu dipercantik) plus kebutuhan bisnis umum yang lazim dibutuhkan
 * UMKM/perusahaan sejenis (laporan kinerja, pitch investor, proposal proyek, update tim).
 */
export const DECK_TEMPLATES: Record<string, DeckTemplate> = {
  'penawaran-ke-klien': {
    id: 'penawaran-ke-klien',
    label: 'Penawaran/Proposal ke Klien',
    audience: 'Calon klien eksternal - pengambil keputusan bisnis yang mengevaluasi apakah akan membeli/melanjutkan kerja sama.',
    goal: 'Meyakinkan klien bahwa tim memahami masalah spesifik mereka dan punya solusi konkret dengan harga serta jadwal yang jelas, sampai klien siap lanjut ke keputusan beli.',
    slides: [
      {
        title: 'Sampul',
        purpose: 'Perkenalan singkat - identitas jelas kedua pihak sebelum masuk isi.',
        maxBullets: 0,
        bulletGuidance: 'Bukan slide bullet. Hanya judul penawaran, nama pihak pengaju, nama klien penerima, dan tanggal.',
      },
      {
        title: 'Masalah yang Dihadapi Klien',
        purpose: 'Tunjukkan tim memahami masalah spesifik klien - bukan template generik yang bisa dipakai ke klien manapun.',
        maxBullets: 3,
        bulletGuidance: 'Maksimal 3 poin masalah utama, satu baris singkat per poin. Sertakan dampak konkret (waktu/biaya/risiko yang hilang) kalau datanya ada, supaya bukan sekadar klaim masalah.',
      },
      {
        title: 'Solusi yang Ditawarkan',
        purpose: 'Jawab langsung tiap masalah di slide sebelumnya - hubungan sebab-akibat harus terlihat jelas ke audiens.',
        maxBullets: 4,
        bulletGuidance: 'Idealnya satu solusi per masalah yang sudah disebut sebelumnya. Jangan tambahkan fitur yang tidak menjawab masalah manapun yang sudah dipaparkan.',
      },
      {
        title: 'Ruang Lingkup Pekerjaan',
        purpose: 'Batasi ekspektasi klien secara eksplisit soal apa yang termasuk dan tidak termasuk dalam penawaran ini.',
        maxBullets: 5,
        bulletGuidance: 'Pisahkan jelas "termasuk" dan "tidak termasuk" kalau ada batasan pekerjaan - ini mencegah perselisihan di kemudian hari.',
      },
      {
        title: 'Rincian Harga',
        purpose: 'Transparansi biaya - inilah bagian yang paling sering hilang di dokumen polos dan jadi keluhan konkret klien sebelumnya.',
        maxBullets: 0,
        contentHint: 'Sajikan sebagai tabel: item/pos pekerjaan x kuantitas x harga satuan x subtotal x total. WAJIB cantumkan mata uang eksplisit (Rp), status pajak (apakah harga sudah termasuk PPN atau belum - default anggap belum termasuk kecuali status PKP penjual sudah dikonfirmasi), dan masa berlaku harga penawaran (tanggal kedaluwarsa eksplisit).',
        bulletGuidance: 'Bukan daftar bullet - tabel angka. Kalau ada skema DP/termin, tampilkan sebagai baris/tabel tambahan di slide yang sama.',
      },
      {
        title: 'Jadwal Pengerjaan',
        purpose: 'Tunjukkan urutan kerja dan estimasi waktu yang realistis untuk membangun kepercayaan pada kemampuan eksekusi tim.',
        maxBullets: 0,
        contentHint: 'Sajikan sebagai tabel atau garis waktu: tahap x aktivitas x estimasi durasi x output yang dihasilkan di tiap tahap.',
        bulletGuidance: 'Kalau proyek punya ketidakpastian durasi, pakai rentang waktu (contoh: 2-3 minggu) daripada angka pasti tunggal yang berisiko meleset.',
      },
      {
        title: 'Alasan Memilih Kami',
        purpose: 'Diferensiasi - kenapa klien sebaiknya pilih tim ini dibanding alternatif lain.',
        maxBullets: 4,
        bulletGuidance: 'Setiap klaim keunggulan wajib dipasangkan bukti konkret (portofolio, angka, sertifikasi, testimoni nyata) di slide yang sama. Dilarang klaim superlatif kosong seperti "terbaik" atau "nomor satu" tanpa bukti pembanding.',
      },
      {
        title: 'Langkah Selanjutnya',
        purpose: 'Ajakan bertindak yang jelas - apa yang perlu dilakukan klien setelah membaca penawaran ini, dan sampai kapan.',
        maxBullets: 3,
        bulletGuidance: 'Sebutkan langkah konkret (contoh: tanda tangan kontrak, transfer DP, jadwal pertemuan lanjutan) beserta kontak person yang bisa dihubungi.',
      },
    ],
    extraAntiSlopRules: [
      'Nominal harga di slide Rincian Harga wajib eksplisit mata uang Rp dan status pajak - dilarang angka telanjang tanpa satuan atau tanpa keterangan sudah/belum termasuk pajak.',
      'Masa berlaku harga wajib berupa tanggal eksplisit, dilarang kalimat samar seperti "harga dapat berubah sewaktu-waktu" sebagai pengganti tanggal kedaluwarsa.',
    ],
  },

  'laporan-kinerja-bulanan': {
    id: 'laporan-kinerja-bulanan',
    label: 'Laporan Kinerja Bulanan',
    audience: 'Pemilik bisnis atau eksekutif yang butuh ringkasan kinerja periodik untuk pengambilan keputusan.',
    goal: 'Menyampaikan kondisi bisnis bulan berjalan secara jujur dan bisa ditindaklanjuti - bukan sekadar kumpulan angka tanpa konteks.',
    slides: [
      {
        title: 'Sampul',
        purpose: 'Identitas laporan sebelum masuk isi.',
        maxBullets: 0,
        bulletGuidance: 'Bukan slide bullet. Nama perusahaan/tenant, periode laporan (bulan-tahun), tanggal penyusunan.',
      },
      {
        title: 'Ringkasan Eksekutif',
        purpose: 'Angka kunci (KPI utama) dalam satu pandangan sebelum audiens masuk ke detail per area.',
        maxBullets: 5,
        bulletGuidance: 'Satu KPI per bullet, dengan angka aktual dibandingkan target atau periode sebelumnya - bukan angka berdiri sendiri tanpa pembanding.',
        contentHint: 'Idealnya kombinasi angka besar (big number) plus indikator naik/turun, bukan paragraf naratif.',
      },
      {
        title: 'Kinerja per Area/Modul Bisnis',
        purpose: 'Rangkai data lintas area (contoh: penjualan, stok, keuangan, operasional) jadi satu cerita yang saling terhubung.',
        maxBullets: 4,
        bulletGuidance: 'Maksimal 4 poin per area yang dibahas. Kalau ada lebih dari satu area penting, pecah ke beberapa slide - jangan padatkan semua area ke satu slide.',
      },
      {
        title: 'Temuan dan Insight Utama',
        purpose: 'Insight yang bisa ditindaklanjuti, diurutkan dari yang paling penting/mendesak.',
        maxBullets: 4,
        bulletGuidance: 'Tiap insight wajib menjawab "jadi apa dampaknya" - dilarang sekadar mengulang angka yang sudah muncul di slide sebelumnya tanpa interpretasi baru.',
      },
      {
        title: 'Risiko dan Perhatian Khusus',
        purpose: 'Status jujur - tandai eksplisit mana yang sudah final dan mana yang masih berjalan atau berisiko.',
        maxBullets: 4,
        bulletGuidance: 'Dilarang menyembunyikan risiko demi terlihat baik. Tandai level urgensi tiap risiko (tinggi/sedang/rendah) secara eksplisit.',
      },
      {
        title: 'Rekomendasi dan Langkah Berikutnya',
        purpose: 'Tindak lanjut konkret lengkap dengan penanggung jawab dan target waktu, bukan saran umum.',
        maxBullets: 4,
        bulletGuidance: 'Idealnya tiap rekomendasi punya penanggung jawab dan tenggat - dilarang rekomendasi kosong seperti "akan ditingkatkan" tanpa siapa dan kapan.',
      },
      {
        title: 'Penutup',
        purpose: 'Menutup laporan dan membuka ruang pertanyaan lanjutan.',
        maxBullets: 2,
        bulletGuidance: 'Ringkasan satu-dua kalimat plus kontak untuk pertanyaan lanjutan.',
      },
    ],
  },

  'pitch-investor-ringkas': {
    id: 'pitch-investor-ringkas',
    label: 'Pitch Investor Ringkas',
    audience: 'Calon investor (angel/VC) yang mengevaluasi banyak pitch dengan waktu perhatian terbatas.',
    goal: 'Meyakinkan investor untuk lanjut ke pertemuan/due diligence berikutnya dalam waktu presentasi singkat - bukan dokumen bisnis lengkap 40 halaman.',
    slides: [
      {
        title: 'Sampul',
        purpose: 'Identitas dan kesan pertama.',
        maxBullets: 0,
        bulletGuidance: 'Bukan slide bullet. Nama perusahaan, tagline satu kalimat, nama presenter.',
      },
      {
        title: 'Masalah',
        purpose: 'Masalah nyata yang dialami target pengguna, didukung data atau observasi lapangan - bukan asumsi tanpa dasar.',
        maxBullets: 3,
      },
      {
        title: 'Solusi',
        purpose: 'Bagaimana produk menjawab masalah tadi secara langsung.',
        maxBullets: 3,
        bulletGuidance: 'Fokus pada mekanisme cara kerja, bukan daftar nama fitur tanpa penjelasan kenapa fitur itu relevan ke masalah.',
      },
      {
        title: 'Produk/Demo',
        purpose: 'Bukti visual produk yang benar-benar berjalan, bukan sekadar mockup konsep.',
        maxBullets: 0,
        contentHint: 'Screenshot atau alur produk nyata. Kalau masih prototipe, tandai eksplisit sebagai "prototipe" - dilarang menyamarkan prototipe sebagai produk jadi.',
      },
      {
        title: 'Traksi dan Metrik',
        purpose: 'Bukti progres nyata (pengguna, revenue, growth rate, retensi) sebagai dasar kepercayaan investor.',
        maxBullets: 4,
        bulletGuidance: 'Dilarang angka tanpa konteks periode (contoh: "1000 pengguna" tanpa menyebut sejak kapan). Angka proyeksi masa depan wajib dipisah jelas dari angka aktual yang sudah terjadi.',
      },
      {
        title: 'Model Bisnis',
        purpose: 'Bagaimana perusahaan menghasilkan uang - sumber revenue dan struktur harga.',
        maxBullets: 3,
      },
      {
        title: 'Pasar dan Kompetisi',
        purpose: 'Ukuran pasar dengan sumber data yang jelas, plus posisi diferensiasi dibanding pemain lain di pasar yang sama.',
        maxBullets: 4,
        bulletGuidance: 'Angka ukuran pasar wajib menyebut sumbernya. Kompetitor wajib disebut secara spesifik (nama), dilarang klaim "tidak ada kompetitor" tanpa penjelasan kenapa.',
      },
      {
        title: 'Tim',
        purpose: 'Kredibilitas pendiri/tim inti - relevansi pengalaman dengan masalah yang sedang diselesaikan.',
        maxBullets: 3,
        bulletGuidance: 'Maksimal 3 baris kredensial relevan per orang (foto, peran, satu-dua kalimat pengalaman yang relevan) - bukan riwayat karier lengkap.',
      },
      {
        title: 'Kebutuhan Dana dan Proyeksi',
        purpose: 'Berapa dana yang dicari, dipakai untuk apa, dan proyeksi dampaknya terhadap bisnis.',
        maxBullets: 4,
        bulletGuidance: 'Breakdown penggunaan dana wajib punya persentase atau nominal yang jelas per pos - dilarang pos generik seperti "untuk operasional" tanpa rincian lebih lanjut.',
      },
      {
        title: 'Penutup dan Ajakan',
        purpose: 'Ajakan eksplisit untuk lanjut diskusi/due diligence.',
        maxBullets: 2,
        bulletGuidance: 'Sebutkan langkah lanjutan yang diharapkan dan kontak yang bisa dihubungi.',
      },
    ],
    extraAntiSlopRules: [
      'Setiap angka traksi/metrik wajib mencantumkan periode pengukuran secara eksplisit (contoh: "per Agustus 2026"), dilarang angka tanpa tanggal acuan.',
      'Proyeksi keuangan masa depan wajib ditandai jelas sebagai proyeksi (bukan aktual) di slide yang sama tempat angka itu muncul.',
    ],
  },

  'proposal-proyek': {
    id: 'proposal-proyek',
    label: 'Proposal Proyek',
    audience: 'Pemangku kepentingan internal atau eksternal yang perlu menyetujui atau mendanai sebuah proyek.',
    goal: 'Mendapatkan persetujuan menjalankan proyek dengan pemahaman jelas soal ruang lingkup, jadwal, sumber daya, dan risikonya - fokus perencanaan eksekusi, beda dari penawaran-ke-klien yang fokus jualan.',
    slides: [
      {
        title: 'Sampul',
        purpose: 'Identitas proyek sebelum masuk isi.',
        maxBullets: 0,
        bulletGuidance: 'Bukan slide bullet. Nama proyek, nama pengaju, tanggal, dan ditujukan kepada siapa.',
      },
      {
        title: 'Latar Belakang dan Tujuan Proyek',
        purpose: 'Kenapa proyek ini perlu dijalankan sekarang - masalah atau peluang yang mendasarinya - dan tujuan terukur yang ingin dicapai.',
        maxBullets: 4,
        bulletGuidance: 'Tujuan wajib terukur (ada angka atau kriteria keberhasilan yang jelas), dilarang tujuan samar seperti "meningkatkan efisiensi" tanpa definisi seberapa besar.',
      },
      {
        title: 'Ruang Lingkup dan Deliverable',
        purpose: 'Batasan eksplisit apa yang dikerjakan dan output konkret yang diserahkan di akhir proyek.',
        maxBullets: 5,
      },
      {
        title: 'Metodologi/Pendekatan',
        purpose: 'Bagaimana proyek akan dikerjakan - tahapan kerja secara garis besar.',
        maxBullets: 4,
      },
      {
        title: 'Timeline dan Milestone',
        purpose: 'Membuat progres bisa diverifikasi secara objektif, bukan klaim "sedang dikerjakan" tanpa tolok ukur.',
        maxBullets: 0,
        contentHint: 'Sajikan sebagai tabel atau garis waktu: nama milestone x tanggal target x kriteria selesai yang bisa dicek.',
      },
      {
        title: 'Struktur Tim dan Peran',
        purpose: 'Siapa mengerjakan apa - kejelasan akuntabilitas sejak awal proyek.',
        maxBullets: 5,
        bulletGuidance: 'Satu baris per peran (nama/posisi dan tanggung jawab utamanya), bukan deskripsi tugas panjang.',
      },
      {
        title: 'Anggaran dan Sumber Daya',
        purpose: 'Transparansi biaya proyek sebagai dasar persetujuan pendanaan.',
        maxBullets: 0,
        contentHint: 'Sajikan sebagai tabel: pos anggaran x jumlah x mata uang eksplisit (Rp).',
      },
      {
        title: 'Risiko dan Mitigasi',
        purpose: 'Risiko realistis yang mungkin terjadi, dengan rencana mitigasi konkret per risiko.',
        maxBullets: 4,
        bulletGuidance: 'Tiap risiko wajib dipasangkan mitigasinya di baris/poin yang sama - dilarang daftar risiko tanpa mitigasi yang jelas terhubung.',
      },
      {
        title: 'Kriteria Keberhasilan',
        purpose: 'Definisi "selesai" dan "berhasil" yang disepakati di awal - mencegah perselisihan penilaian di akhir proyek.',
        maxBullets: 4,
      },
      {
        title: 'Penutup dan Langkah Selanjutnya',
        purpose: 'Ajakan persetujuan dan langkah konkret setelah proposal ini dibaca.',
        maxBullets: 3,
        bulletGuidance: 'Sebutkan siapa yang perlu menyetujui, format persetujuan seperti apa, dan kontak yang bisa dihubungi.',
      },
    ],
    extraAntiSlopRules: [
      'Setiap pos anggaran wajib mencantumkan mata uang eksplisit (Rp), dilarang angka anggaran tanpa satuan.',
      'Tiap milestone di Timeline dan Milestone wajib punya kriteria selesai yang bisa dicek objektif, dilarang milestone berupa kalimat proses tanpa hasil terukur (contoh: dilarang "riset berjalan" tanpa output riset yang diharapkan).',
    ],
  },

  'update-internal-tim': {
    id: 'update-internal-tim',
    label: 'Update Internal Tim',
    audience: 'Tim internal pada rapat rutin mingguan/bulanan - bukan pihak eksternal, jadi nada boleh lebih santai tapi tetap terstruktur.',
    goal: 'Menyamakan pemahaman tim soal progres, kendala, dan rencana berikutnya dalam waktu singkat, sekaligus meminta keputusan atau bantuan spesifik kalau ada yang menghambat.',
    slides: [
      {
        title: 'Sampul',
        purpose: 'Identitas update sebelum masuk isi.',
        maxBullets: 0,
        bulletGuidance: 'Bukan slide bullet. Nama tim/proyek, periode update (minggu/bulan ke berapa), tanggal.',
      },
      {
        title: 'Ringkasan Progres Periode Ini',
        purpose: 'Gambaran cepat status keseluruhan sebelum masuk detail per topik.',
        maxBullets: 4,
        bulletGuidance: 'Bandingkan dengan rencana/target periode ini - dilarang sekadar daftar aktivitas yang sudah dikerjakan tanpa dibandingkan ke rencana.',
      },
      {
        title: 'Highlight dan Pencapaian',
        purpose: 'Hal yang berjalan baik atau selesai di periode ini - beri kredit ke kontributor kalau relevan.',
        maxBullets: 4,
      },
      {
        title: 'Kendala dan Blocker',
        purpose: 'Masalah yang menghambat progres - kejujuran di slide ini lebih penting daripada terlihat bagus.',
        maxBullets: 4,
        bulletGuidance: 'Tiap blocker sebutkan sejak kapan macet dan siapa yang perlu mengambil tindakan berikutnya.',
      },
      {
        title: 'Rencana Periode Berikutnya',
        purpose: 'Prioritas kerja berikutnya, bukan daftar wishlist panjang tanpa urutan.',
        maxBullets: 5,
        bulletGuidance: 'Urutkan berdasar prioritas, tandai mana yang bergantung pada keputusan/bantuan yang diminta di slide berikutnya.',
      },
      {
        title: 'Kebutuhan Bantuan atau Keputusan',
        purpose: 'Permintaan eksplisit ke audiens rapat - keputusan apa yang dibutuhkan dari siapa dan sampai kapan.',
        maxBullets: 3,
        bulletGuidance: 'Kalau memang tidak ada kebutuhan bantuan/keputusan di periode ini, slide ini boleh dilewati sepenuhnya - dilarang dipaksakan isi basa-basi.',
      },
      {
        title: 'Penutup',
        purpose: 'Menutup update dan membuka sesi tanya jawab.',
        maxBullets: 1,
        bulletGuidance: 'Satu kalimat penutup plus ajakan diskusi/tanya jawab.',
      },
    ],
  },
};

/** Daftar seluruh template deck, untuk enumerasi (contoh: dropdown pilihan template di UI). */
export const DECK_TEMPLATE_LIST: DeckTemplate[] = Object.values(DECK_TEMPLATES);

/**
 * Resolve deterministik templateId -> DeckTemplate. Exact-match saja (setelah trim+lowercase),
 * TIDAK ada alias/fuzzy match seperti industry-image-templates.ts karena templateId untuk deck
 * dikirim eksplisit oleh pemanggil (bukan input bebas pengguna) - alias hanya menambah ambiguitas
 * tanpa manfaat di kasus ini. Input kosong/tidak dikenal -> null, tidak pernah throw.
 */
export function resolveDeckTemplate(templateId?: string): DeckTemplate | null {
  if (!templateId) return null;
  const normalized = templateId.trim().toLowerCase();
  if (!normalized) return null;
  return DECK_TEMPLATES[normalized] ?? null;
}

/**
 * Susun instruksi teks terstruktur dari satu DeckTemplate - siap disisipkan ke prompt LLM
 * penyusun narasi slide (fase integrate), meniru pola buildTemplateInstruction milik Fatur
 * di generation-engine.ts. LLM yang menerima instruksi ini HANYA mengisi narasi di dalam
 * kerangka (judul, tujuan, batas bullet) - tidak pernah menentukan ulang urutan atau jumlah
 * slide sendiri, kecuali brief user secara eksplisit minta struktur lain.
 */
export function buildDeckTemplateInstruction(template: DeckTemplate): string {
  const slideLines = template.slides.map((slide, index) => {
    const parts: string[] = [];
    parts.push(`${index + 1}. ${slide.title} - Tujuan: ${slide.purpose}`);
    parts.push(
      slide.maxBullets > 0
        ? `Maksimal ${slide.maxBullets} poin bullet.`
        : 'Bukan slide bullet - lihat catatan bentuk konten.'
    );
    if (slide.bulletGuidance) parts.push(slide.bulletGuidance);
    if (slide.contentHint) parts.push(`Bentuk konten: ${slide.contentHint}`);
    return parts.join(' ');
  });

  const antiSlopLines = [...DECK_ANTI_SLOP_RULES, ...(template.extraAntiSlopRules ?? [])].map(
    (rule) => `- ${rule}`
  );

  return [
    `Ikuti struktur deck "${template.label}" berikut sebagai kerangka urutan slide (sesuaikan isi dengan brief user; kalau brief user meminta struktur yang berbeda, ikuti brief user):`,
    `Audiens: ${template.audience}`,
    `Tujuan deck: ${template.goal}`,
    slideLines.join('\n'),
    'Aturan anti-slop khusus format presentasi (wajib dipatuhi di setiap slide yang dihasilkan):',
    antiSlopLines.join('\n'),
  ].join('\n');
}

// CATATAN (temuan gap-fix 7 Sep): enrichPromptWithDeckTemplate() yang dulu ada di sini dihapus
// -- diekspor tapi nol pemanggil di seluruh src/ (registry index.ts punya jalur instruksinya
// sendiri lewat buildDeckTemplateInstruction() dipanggil langsung, tidak lewat wrapper ini).
// Dead code trivial, tidak berdampak fungsi apapun. Untuk membatalkan: lihat histori git commit
// sesi ini.
