export type GlossaryCategory = 'Keuangan & Kas' | 'Marketing & Iklan' | 'Administrasi & Tim' | 'Operasional & Rantai Pasok' | 'Umum';

export interface GlossaryTerm {
  term: string;
  category: GlossaryCategory;
  plain: string;
  /** short keywords used for auto-matching a KPI label to this term, longest/most-specific first */
  matchKeys: string[];
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    term: 'ROAS (Return on Ad Spend)',
    category: 'Marketing & Iklan',
    plain: 'Dari tiap Rp1.000 yang dipakai buat iklan, balik jadi omset berapa. ROAS 3,5x = tiap Rp1.000 belanja iklan, balik jadi Rp3.500 omset penjualan.',
    matchKeys: ['blended roas', 'roas'],
  },
  {
    term: 'CAC (Customer Acquisition Cost)',
    category: 'Marketing & Iklan',
    plain: 'Biaya rata-rata buat dapetin 1 pelanggan baru. CAC Rp50.000 artinya tiap 1 pelanggan baru "harganya" Rp50.000 dari total belanja marketing.',
    matchKeys: ['cac'],
  },
  {
    term: 'LTV (Lifetime Value)',
    category: 'Marketing & Iklan',
    plain: 'Total uang yang bakal dikasih 1 pelanggan ke bisnis selama dia jadi pelanggan, bukan cuma sekali beli. LTV harus lebih besar dari CAC — kalau enggak, rugi tiap dapet pelanggan baru.',
    matchKeys: ['ltv'],
  },
  {
    term: 'CPL (Cost per Lead)',
    category: 'Marketing & Iklan',
    plain: 'Biaya rata-rata buat dapet 1 calon pelanggan yang nunjukkin minat (isi form, chat, dll) — belum tentu beli, baru sekadar tertarik.',
    matchKeys: ['cpl', 'biaya per prospek'],
  },
  {
    term: 'Runway',
    category: 'Keuangan & Kas',
    plain: 'Berapa BULAN lagi kas bisa bertahan kalau pemasukan berhenti total dan pengeluaran jalan terus seperti biasa. Runway 3 bulan = kalau gak ada pemasukan baru, duit habis dalam 3 bulan.',
    matchKeys: ['runway'],
  },
  {
    term: 'Burn rate',
    category: 'Keuangan & Kas',
    plain: 'Seberapa cepat kas habis tiap bulan (pengeluaran dikurangi pemasukan). Burn rate tinggi = kas cepat habis, runway makin pendek.',
    matchKeys: ['burn rate', 'burnrate'],
  },
  {
    term: 'PPh (Pajak Penghasilan)',
    category: 'Keuangan & Kas',
    plain: 'Pajak dari laba/penghasilan usaha. Untuk UMKM biasanya final 0,5% dari OMSET (bukan laba), langsung dari total penjualan bulanan.',
    matchKeys: ['pph'],
  },
  {
    term: 'PPN (Pajak Pertambahan Nilai)',
    category: 'Keuangan & Kas',
    plain: 'Pajak 11% yang ditambahin ke harga jual barang/jasa. Ini pajak yang dibayar PEMBELI — bisnis cuma menyetorkannya ke negara.',
    matchKeys: ['ppn'],
  },
  {
    term: 'Likuiditas',
    category: 'Keuangan & Kas',
    plain: 'Seberapa gampang kas bisa dipakai SEKARANG JUGA buat bayar kebutuhan mendadak. "Likuiditas prima" = duit tunai gampang diambil, gak ketahan di aset yang susah dicairkan.',
    matchKeys: ['likuiditas'],
  },
  {
    term: 'Amortisasi',
    category: 'Keuangan & Kas',
    plain: 'Biaya besar (misal beli mesin/software) yang dicicil catatannya sedikit-sedikit tiap bulan, bukan langsung dicatat habis semua di bulan pembelian.',
    matchKeys: ['amortisasi'],
  },
  {
    term: 'OPEX (Operating Expense)',
    category: 'Keuangan & Kas',
    plain: 'Biaya OPERASIONAL rutin buat jalanin bisnis sehari-hari — gaji, listrik, sewa, internet. Beda dari biaya beli aset besar sekali bayar (CAPEX).',
    matchKeys: ['opex'],
  },
  {
    term: 'CAPEX (Capital Expenditure)',
    category: 'Keuangan & Kas',
    plain: 'Biaya beli aset BESAR yang dipakai lama, sekali bayar di depan — beli mesin, laptop kantor, kendaraan, renovasi toko. Beda dari OPEX yang biaya rutin bulanan.',
    matchKeys: ['capex'],
  },
  {
    term: 'Revenue (Omset/Pendapatan)',
    category: 'Keuangan & Kas',
    plain: 'Total UANG MASUK dari jualan sebelum dikurangi biaya apapun. Ini angka kotor paling awal — belum tentu untung, karena biaya belum dikurangi.',
    matchKeys: ['revenue', 'omset', 'pendapatan'],
  },
  {
    term: 'PAT (Profit After Tax / Laba Bersih Setelah Pajak)',
    category: 'Keuangan & Kas',
    plain: 'Uang yang BENERAN jadi milik bisnis di akhir — omset dikurangi SEMUA biaya operasional DAN pajak. Ini angka paling jujur soal untung-rugi sebenarnya.',
    matchKeys: ['pat', 'laba bersih setelah pajak'],
  },
  {
    term: 'BEP / Titik impas (Break-Even Point)',
    category: 'Keuangan & Kas',
    plain: 'Titik di mana omset PAS menutup semua biaya — belum untung, tapi juga sudah tidak rugi.',
    matchKeys: ['titik impas', 'bep'],
  },
  {
    term: 'Margin kotor vs margin bersih',
    category: 'Keuangan & Kas',
    plain: 'Margin kotor = omset dikurangi biaya bikin barang doang. Margin bersih = omset dikurangi SEMUA biaya (termasuk gaji, sewa, dst). Margin bersih yang nunjukkin untung beneran.',
    matchKeys: ['margin bersih', 'margin kotor', 'net margin', 'gross margin'],
  },
  {
    term: 'Piutang & aging piutang',
    category: 'Keuangan & Kas',
    plain: 'Piutang = uang yang masih jadi hak bisnis tapi belum dibayar pelanggan/klien. "Aging" = dikelompokkan berdasar berapa lama belum dibayar (1-30 hari, 30-60 hari, dst) — makin lama, makin berisiko gak kebayar.',
    matchKeys: ['piutang jatuh tempo', 'piutang', 'aging'],
  },
  {
    term: 'Alur kas (cash flow)',
    category: 'Keuangan & Kas',
    plain: 'Aliran duit MASUK dan KELUAR dari kas bisnis. Beda dari "untung" di atas kertas — bisa untung tapi kas kosong kalau duitnya masih nyangkut di piutang.',
    matchKeys: ['alur kas', 'cash flow'],
  },
  {
    term: 'MoM (Month over Month)',
    category: 'Umum',
    plain: 'Perbandingan angka bulan ini VS bulan kemarin. "+4,4% MoM" artinya naik 4,4% dibanding bulan lalu.',
    matchKeys: ['mom'],
  },
  {
    term: 'Health Score',
    category: 'Umum',
    plain: 'Nilai 1 angka (biasanya dari 100) yang merangkum kesehatan bisnis secara keseluruhan — gabungan kas, tim, dan operasional jadi satu skor yang gampang dicek sekilas.',
    matchKeys: ['health score'],
  },
  {
    term: 'KPI (Key Performance Indicator)',
    category: 'Umum',
    plain: 'Angka-angka PENTING yang dipantau buat tahu bisnis jalan bagus atau enggak — kayak dashboard mobil (kecepatan, bensin): bukan semua angka, cuma yang paling krusial.',
    matchKeys: ['kpi'],
  },
  {
    term: 'CTR (Click Through Rate)',
    category: 'Marketing & Iklan',
    plain: 'Dari 100 orang yang LIHAT iklan, berapa yang KLIK. CTR 2% = dari 100 orang lihat, 2 orang klik iklannya.',
    matchKeys: ['ctr'],
  },
  {
    term: 'Impresi (Impressions)',
    category: 'Marketing & Iklan',
    plain: 'Berapa kali iklan/postingan MUNCUL dan kelihatan orang, gak peduli diklik atau enggak. Beda dari Reach (jumlah orang UNIK yang lihat).',
    matchKeys: ['impresi', 'impressions'],
  },
  {
    term: 'Reach (Jangkauan)',
    category: 'Marketing & Iklan',
    plain: 'Berapa ORANG UNIK yang kelihatan iklan/postingan-nya (1 orang dihitung sekali, walau dia lihat berkali-kali). Beda dari Impresi yang ngitung total kemunculan.',
    matchKeys: ['reach', 'jangkauan'],
  },
  {
    term: 'Konversi (Conversion)',
    category: 'Marketing & Iklan',
    plain: 'Orang yang akhirnya benar-benar BELI/DAFTAR/ISI FORM setelah lihat iklan — bukan cuma klik doang. "Tingkat konversi" = persentase orang yang sampai beneran beraksi.',
    matchKeys: ['konversi', 'conversion'],
  },
  {
    term: 'Engagement (Interaksi)',
    category: 'Marketing & Iklan',
    plain: 'Total like, komentar, share, dan simpan di sebuah postingan — nunjukkin seberapa orang peduli/ikut berinteraksi, bukan cuma lewat doang.',
    matchKeys: ['engagement', 'interaksi'],
  },
  {
    term: 'Budget harian / daily budget',
    category: 'Marketing & Iklan',
    plain: 'Batas maksimal uang yang boleh dipakai iklan dalam SATU HARI. Platform iklan otomatis berhenti nayangin kalau budget hari itu sudah habis.',
    matchKeys: ['budget harian', 'daily budget'],
  },
  {
    term: 'A/B Testing',
    category: 'Marketing & Iklan',
    plain: 'Nyoba 2 versi materi iklan/promosi berbeda ke orang berbeda secara bersamaan, buat lihat mana yang hasilnya lebih bagus, baru dipakai yang menang.',
    matchKeys: ['a/b testing', 'ab testing', 'split test'],
  },
  {
    term: 'SOP (Standard Operating Procedure)',
    category: 'Administrasi & Tim',
    plain: 'Langkah kerja standar yang dipakai supaya pekerjaan dilakukan dengan cara yang konsisten dan bisa dicek.',
    matchKeys: ['sop', 'kepatuhan sop'],
  },
  {
    term: 'Workload (Beban Kerja)',
    category: 'Administrasi & Tim',
    plain: 'Jumlah dan beratnya pekerjaan yang sedang ditangani seseorang atau sebuah tim.',
    matchKeys: ['workload', 'beban kerja'],
  },
  {
    term: 'Approval (Persetujuan)',
    category: 'Administrasi & Tim',
    plain: 'Persetujuan resmi yang diperlukan sebelum dokumen, tugas, atau keputusan bisa dilanjutkan.',
    matchKeys: ['approval', 'persetujuan'],
  },
  {
    term: 'PO (Purchase Order)',
    category: 'Operasional & Rantai Pasok',
    plain: 'Dokumen pesanan resmi ke supplier yang mencatat barang, jumlah, dan proses pengirimannya.',
    matchKeys: ['purchase order', 'po pending', 'po'],
  },
  {
    term: 'COGS (Cost of Goods Sold)',
    category: 'Operasional & Rantai Pasok',
    plain: 'Biaya langsung untuk membuat atau mendapatkan barang yang dijual, bukan seluruh kas atau laba perusahaan.',
    matchKeys: ['cogs', 'biaya operasional / cogs'],
  },
  {
    term: 'Lead time (Waktu Tunggu Supplier)',
    category: 'Operasional & Rantai Pasok',
    plain: 'Lama waktu dari barang dipesan sampai barang benar-benar datang dan bisa dipakai.',
    matchKeys: ['lead time', 'tepat waktu'],
  },
  {
    term: 'Reorder point (Batas Mulai Pesan Ulang)',
    category: 'Operasional & Rantai Pasok',
    plain: 'Batas stok yang menjadi tanda bahwa barang harus mulai dipesan ulang agar tidak habis sebelum kiriman berikutnya datang.',
    matchKeys: ['reorder point', 'restock', 'perlu restock'],
  },
  {
    term: 'Dead stock (Stok Lama Tidak Bergerak)',
    category: 'Operasional & Rantai Pasok',
    plain: 'Barang yang sudah lama tersimpan tetapi jarang atau tidak bergerak keluar, sehingga berisiko menahan modal dan ruang.',
    matchKeys: ['dead stock'],
  },
];

/**
 * Best-effort match of a KPI label (e.g. "Blended ROAS", "Piutang jatuh tempo")
 * to a glossary term. Returns null if nothing relevant found -- callers should
 * render nothing in that case, not a broken/empty hint.
 */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchGlossaryTerm(label: string): GlossaryTerm | null {
  const lower = String(label || '').toLowerCase();
  let best: GlossaryTerm | null = null;
  let bestKeyLength = 0;
  for (const entry of GLOSSARY) {
    for (const key of entry.matchKeys) {
      // word-boundary match, not raw substring -- otherwise short keys like
      // "mom" false-positive-match inside unrelated words like "momentum"
      const re = new RegExp(`\\b${escapeRegExp(key)}\\b`, 'i');
      if (re.test(lower) && key.length > bestKeyLength) {
        best = entry;
        bestKeyLength = key.length;
      }
    }
  }
  return best;
}
