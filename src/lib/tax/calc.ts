/**
 * Perhitungan pajak murni (tanpa akses database) supaya mudah diuji.
 *
 * Prinsip: fungsi di sini TIDAK menyimpan angka apa pun. Pemanggil yang
 * memutuskan apakah hasilnya disimpan sebagai snapshot masa pajak.
 */

export function toNum(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function round0(value: number): number {
  return Math.round(value);
}

/* ─────────────────────────── PPh Final UMKM ─────────────────────────── */

export interface PphFinalInput {
  /** Peredaran bruto bulan ini. */
  monthlyRevenue: number;
  /** Akumulasi peredaran bruto sebelum bulan ini dalam tahun pajak yang sama. */
  ytdRevenueBefore: number;
  /** Ambang bebas pajak (Rp 500 juta untuk WP Orang Pribadi). */
  threshold: number;
  /** Tarif dalam persen, mis. 0.5 untuk 0,5%. */
  ratePct: number;
  /** WP Orang Pribadi mendapat pembebasan; badan usaha tidak. */
  isOrangPribadi: boolean;
}

export interface PphFinalResult {
  taxableRevenue: number;
  taxAmount: number;
  /** Peredaran bruto kumulatif setelah bulan ini (untuk perhitungan bulan depan). */
  ytdRevenueAfter: number;
  note: string;
}

/**
 * PPh Final UMKM dihitung bulanan, tetapi pembebasan Rp 500 juta bersifat
 * TAHUNAN. Karena itu bagian omzet yang melewati ambang dihitung secara
 * kumulatif, bukan diulang setiap bulan.
 */
export function computePphFinalMonthly(input: PphFinalInput): PphFinalResult {
  const revenue = Math.max(0, toNum(input.monthlyRevenue));
  const before = Math.max(0, toNum(input.ytdRevenueBefore));
  const threshold = Math.max(0, toNum(input.threshold));
  const ratePct = Math.max(0, toNum(input.ratePct));
  const after = before + revenue;

  if (!input.isOrangPribadi) {
    return {
      taxableRevenue: round2(revenue),
      taxAmount: round2((revenue * ratePct) / 100),
      ytdRevenueAfter: round2(after),
      note: 'Badan usaha: tarif final langsung atas peredaran bruto bulan ini.',
    };
  }

  const taxableBefore = Math.max(0, before - threshold);
  const taxableAfter = Math.max(0, after - threshold);
  const taxableRevenue = round2(Math.max(0, taxableAfter - taxableBefore));

  return {
    taxableRevenue,
    taxAmount: round2((taxableRevenue * ratePct) / 100),
    ytdRevenueAfter: round2(after),
    note:
      after <= threshold
        ? 'Masih di bawah ambang Rp 500 juta — belum ada PPh Final terutang.'
        : 'Bagian omzet di atas ambang Rp 500 juta dikenakan tarif final.',
  };
}

/* ─────────────────────────────── PPN ─────────────────────────────── */

export interface PpnResult {
  outputTax: number;
  inputTax: number;
  /** Keluaran − Masukan. Positif = kurang bayar, negatif = lebih bayar. */
  signed: number;
  netPayable: number;
  overpayment: number;
}

export function computePpn(outputTax: number, inputTax: number): PpnResult {
  const out = round2(Math.max(0, toNum(outputTax)));
  const inp = round2(Math.max(0, toNum(inputTax)));
  const signed = round2(out - inp);
  return {
    outputTax: out,
    inputTax: inp,
    signed,
    netPayable: signed > 0 ? signed : 0,
    overpayment: signed < 0 ? Math.abs(signed) : 0,
  };
}

/* ───────────────────────────── Potongan ───────────────────────────── */

export function computeWithholding(dpp: number, ratePct: number): number {
  return round2((Math.max(0, toNum(dpp)) * Math.max(0, toNum(ratePct))) / 100);
}

/* ─────────────────────── Parsing periode payroll ─────────────────────── */

const MONTH_ALIASES: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2, pebruari: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agustus: 8, august: 8, aug: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, october: 10, oct: 10,
  nov: 11, november: 11, nopember: 11,
  des: 12, desember: 12, december: 12, dec: 12,
};

/**
 * Membaca periode payroll yang disimpan sebagai teks bebas.
 * Mendukung `2026-10`, `10/2026`, `Agustus 2026`, dan `August 2026`.
 */
export function parsePeriodMonth(value: string | null | undefined): { year: number; month: number } | null {
  if (!value) return null;
  const text = String(value).trim().toLowerCase();

  const iso = /^(\d{4})[-/](\d{1,2})$/.exec(text);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }

  const slash = /^(\d{1,2})[-/](\d{4})$/.exec(text);
  if (slash) {
    const month = Number(slash[1]);
    const year = Number(slash[2]);
    if (month >= 1 && month <= 12) return { year, month };
  }

  const named = /([a-z]+)\s+(\d{4})/.exec(text);
  if (named) {
    const month = MONTH_ALIASES[named[1]];
    const year = Number(named[2]);
    if (month && Number.isFinite(year)) return { year, month };
  }

  return null;
}

/* ───────────────────────────── Format ───────────────────────────── */

export function formatRupiah(value: number, opts: { decimals?: boolean } = {}): string {
  const n = toNum(value);
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  }).format(n);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(toNum(value));
}
