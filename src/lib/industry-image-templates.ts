/** Deterministic per-industry visual templates for marketing image generation.
 *  Pure functions, no network/DB. Unknown industry input is ignored silently (never throws). */

export interface IndustryImageTemplate {
  id: string;
  label: string;
  visualStyle: string;
  composition: string;
  prohibitions: string[];
  paletteLighting: string;
}

export const INDUSTRY_IMAGE_TEMPLATES: Record<string, IndustryImageTemplate> = {
  fnb: {
    id: 'fnb',
    label: 'Kuliner & F&B',
    visualStyle: 'Fotografi makanan realistis, tekstur asli terlihat jelas (uap, minyak, remah), bukan food-styling plastik atau lilin.',
    composition: 'Hidangan sebagai focal point tunggal, sudut 45 derajat atau top-down, ruang kosong secukupnya untuk teks promosi.',
    prohibitions: [
      'Jangan gunakan properti makanan palsu (plastik, lilin, cat) yang terlihat seperti makanan asli',
      'Jangan tulis teks harga atau label kemasan palsu pada produk',
    ],
    paletteLighting: 'Warna hangat (kuning-oranye-cokelat), pencahayaan alami lembut dari samping.',
  },
  retail: {
    id: 'retail',
    label: 'Retail & Toko',
    visualStyle: 'Produk tersusun rapi dengan pencahayaan studio bersih, fokus pada detail dan kualitas barang.',
    composition: 'Produk di tengah frame dengan latar belakang polos atau rak toko yang rapi, ruang kosong untuk badge promosi.',
    prohibitions: [
      'Jangan tulis nominal harga atau persentase diskon fiktif pada gambar',
      'Jangan tampilkan merek kompetitor pihak ketiga',
    ],
    paletteLighting: 'Palet netral cerah, pencahayaan studio merata tanpa bayangan keras.',
  },
  jasa: {
    id: 'jasa',
    label: 'Jasa & Layanan',
    visualStyle: 'Suasana profesional dan personal, menunjukkan interaksi layanan yang meyakinkan tanpa terkesan dibuat-buat.',
    composition: 'Subjek manusia atau proses layanan sebagai focal point, latar konteks tempat kerja yang relevan.',
    prohibitions: [
      'Jangan tampilkan testimoni tertulis atau rating bintang fiktif pada gambar',
      'Jangan tampilkan sertifikasi atau penghargaan fiktif',
    ],
    paletteLighting: 'Palet biru-abu profesional, pencahayaan natural terang.',
  },
  fashion: {
    id: 'fashion',
    label: 'Fashion & Pakaian',
    visualStyle: 'Editorial fashion bersih, kain dan jahitan terlihat detail dan realistis.',
    composition: 'Model atau produk pakaian sebagai focal point, pose natural, ruang kosong untuk teks koleksi.',
    prohibitions: [
      'Jangan distorsi proporsi tubuh atau jari manusia',
      'Jangan tulis harga atau ukuran fiktif pada label pakaian',
    ],
    paletteLighting: 'Palet sesuai musim koleksi, pencahayaan studio fashion terarah.',
  },
  kesehatan: {
    id: 'kesehatan',
    label: 'Kesehatan & Medis',
    visualStyle: 'Suasana bersih dan tepercaya, alat/lingkungan medis digambarkan akurat tanpa berlebihan.',
    composition: 'Subjek utama (tenaga medis, fasilitas, atau produk) di tengah frame dengan latar bersih.',
    prohibitions: [
      'Jangan tulis klaim medis apapun pada gambar (menyembuhkan, terbukti ampuh, dsb)',
      'Jangan tampilkan logo sertifikasi atau BPOM fiktif',
    ],
    paletteLighting: 'Palet putih-biru muda-hijau, pencahayaan terang dan bersih.',
  },
  pendidikan: {
    id: 'pendidikan',
    label: 'Pendidikan',
    visualStyle: 'Suasana belajar positif dan inklusif, menunjukkan aktivitas edukasi yang natural.',
    composition: 'Aktivitas belajar-mengajar sebagai focal point, latar ruang kelas atau digital learning.',
    prohibitions: [
      'Jangan tampilkan logo institusi atau akreditasi fiktif',
      'Jangan tulis klaim kelulusan atau jaminan hasil yang tidak dapat diverifikasi',
    ],
    paletteLighting: 'Palet cerah dan hangat, pencahayaan siang hari alami.',
  },
  properti: {
    id: 'properti',
    label: 'Properti & Real Estate',
    visualStyle: 'Fotografi arsitektur realistis, menonjolkan ruang dan pencahayaan alami properti.',
    composition: 'Bangunan atau interior sebagai focal point, sudut lebar dengan garis perspektif jelas.',
    prohibitions: [
      'Jangan tulis nominal harga atau status legalitas fiktif pada gambar',
      'Jangan tampilkan denah atau sertifikat yang menyerupai dokumen resmi',
    ],
    paletteLighting: 'Palet natural earth-tone, pencahayaan golden hour atau siang terang.',
  },
  otomotif: {
    id: 'otomotif',
    label: 'Otomotif',
    visualStyle: 'Fotografi kendaraan dinamis dan tajam, detail bodi dan lekukan kendaraan realistis.',
    composition: 'Kendaraan sebagai focal point dengan sudut tiga perempat, latar studio atau jalan yang relevan.',
    prohibitions: [
      'Plat nomor kendaraan wajib kosong atau diblur',
      'Jangan tampilkan merek atau logo kompetitor pihak ketiga',
    ],
    paletteLighting: 'Palet metalik kontras tinggi, pencahayaan studio otomotif dramatis.',
  },
};

/** Alias Indonesia -> key kanonik. Dicek via substring dua arah setelah exact-key match gagal. */
export const INDUSTRY_ALIASES: Record<string, string> = {
  kuliner: 'fnb',
  resto: 'fnb',
  restoran: 'fnb',
  cafe: 'fnb',
  kafe: 'fnb',
  warung: 'fnb',
  makanan: 'fnb',
  katering: 'fnb',
  toko: 'retail',
  grosir: 'retail',
  'warung-ritel': 'retail',
  minimarket: 'retail',
  servis: 'jasa',
  layanan: 'jasa',
  konsultan: 'jasa',
  pakaian: 'fashion',
  butik: 'fashion',
  konveksi: 'fashion',
  garmen: 'fashion',
  klinik: 'kesehatan',
  apotek: 'kesehatan',
  medis: 'kesehatan',
  'rumah-sakit': 'kesehatan',
  puskesmas: 'kesehatan',
  sekolah: 'pendidikan',
  kursus: 'pendidikan',
  bimbel: 'pendidikan',
  kampus: 'pendidikan',
  perumahan: 'properti',
  apartemen: 'properti',
  kos: 'properti',
  bengkel: 'otomotif',
  showroom: 'otomotif',
  dealer: 'otomotif',
};

// FIX (7 Sep, gap LOW -- resolver fragility). Data INDUSTRY_ALIASES di atas TIDAK
// disentuh, hanya cara resolveIndustryTemplate membacanya. Dua arah match TIDAK LAGI
// digabung dalam satu loop bersama satu urutan -- itu yang jadi sumber bug kedua di
// bawah, lihat catatan (v1->v2).
//
// (1) FORWARD (normalized berisi alias, mis. seluruh kalimat/paragraf user berisi
//     kata "bengkel"): alias diurutkan PALING PANJANG (paling spesifik) dulu, bukan
//     ikut urutan penulisan objek (Object.entries insertion order) -- tanpa ini,
//     alias pendek yang kebetulan jadi PREFIX alias lain (mis. 'warung' adalah
//     prefix dari 'warung-ritel') "mencuri" match duluan, dan entry yang lebih
//     spesifik itu jadi efektif TIDAK PERNAH ke-reach. Dicek pakai batas kata (\b)
//     via RegExp, bukan substring polos -- alias pendek seperti 'kos' (properti)
//     tidak ke-match di dalam kata tak-terkait yang kebetulan mengandungnya, mis.
//     "kosmetik".
// (2) REVERSE (normalized lebih pendek dari alias, mis. value dropdown yang
//     disingkat): alias diurutkan PALING PENDEK dulu supaya alias yang PALING PAS
//     (bukan yang cuma kebetulan memuat potongan itu) yang menang.
// (v1->v2, ditemukan test 'rangkaian enrichMarketingImage + enrichWithIndustry...'):
// v1 sempat menggabung KEDUA arah dalam SATU loop dengan urutan panjang-menurun yang
// sama -- itu benar untuk arah (1), tapi salah untuk arah (2): input persis "warung"
// (yang seharusnya exact-match alias 'warung' sendiri -> fnb) malah ke-tangkap lebih
// dulu oleh 'warung-ritel'.includes('warung') (arah reverse, tapi diuji di alias
// terpanjang duluan) sebelum loop sempat mencapai alias 'warung' itu sendiri --
// salah resolve ke retail. Dipisah jadi 2 loop independen dengan urutan masing-
// masing yang benar untuk arah itu; exact-alias-match juga ditambah sebagai jalur
// cepat eksplisit di awal supaya kasus ini tidak pernah lagi bergantung ke urutan
// loop mana pun.
const ALIASES_LONGEST_FIRST = Object.entries(INDUSTRY_ALIASES).sort(([a], [b]) => b.length - a.length);
const ALIASES_SHORTEST_FIRST = [...ALIASES_LONGEST_FIRST].reverse();
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Deterministic resolve: exact key/alias first, then alias substring match (both directions). Unknown -> null. */
export function resolveIndustryTemplate(input?: string): IndustryImageTemplate | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  if (INDUSTRY_IMAGE_TEMPLATES[normalized]) return INDUSTRY_IMAGE_TEMPLATES[normalized];
  if (INDUSTRY_ALIASES[normalized]) return INDUSTRY_IMAGE_TEMPLATES[INDUSTRY_ALIASES[normalized]];
  for (const [alias, key] of ALIASES_LONGEST_FIRST) {
    if (new RegExp(`\\b${escapeRegExp(alias)}\\b`).test(normalized)) return INDUSTRY_IMAGE_TEMPLATES[key];
  }
  for (const [alias, key] of ALIASES_SHORTEST_FIRST) {
    if (alias.includes(normalized)) return INDUSTRY_IMAGE_TEMPLATES[key];
  }
  return null;
}

/** Append industry-specific guidance to a prompt. Returns prompt unchanged when industry is unset/unknown. */
export function enrichWithIndustry(prompt: string, industry?: string): string {
  const template = resolveIndustryTemplate(industry);
  if (!template) return prompt;
  return [
    prompt,
    'Vertikal industri: ' + template.label + '.',
    'Gaya visual: ' + template.visualStyle,
    'Komposisi: ' + template.composition,
    'Palet dan pencahayaan: ' + template.paletteLighting,
    'Larangan khusus vertikal ini: ' + template.prohibitions.join('; ') + '.',
  ].join('\n');
}
