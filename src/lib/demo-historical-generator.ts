/**
 * GENERATOR DATA HISTORIS 5-10 TAHUN UNTUK DEMO LOCALHOST
 * ============================================================================
 * Menyediakan dataset simulasi perusahaan mapan (PT Kuliner Rasa Nusantara / KLIR Partner)
 * yang beroperasi sejak 2017 (9 tahun perjalanan bisnis nyata).
 *
 * Dataset ini mencakup 4 fase perjalanan bisnis:
 * 1. 2017-2019: Fase Rintisan (Startup Single Outlet)
 * 2. 2020-2021: Fase Krisis & Bertahan (Pandemi & Adaptasi Online Delivery)
 * 3. 2022-2024: Fase Rebound & Ekspansi Multi-Cabang (Bekasi, Bandung, Serpong)
 * 4. 2025-2026: Fase Kejayaan Enterprise & Omnichannel Scale (Margin Sehat, Kas Stabil)
 *
 * HANYA DIGUNAKAN DI LOCALHOST (isDevLocalhost === true).
 * ZERO-TOUCH PRODUCTION / POSTGRESQL DATABASE.
 */

export interface HistoricalYearSnapshot {
  year: number;
  periodLabel: string;
  periodKind: 'annual-benchmark' | 'current-year-projection';
  throughMonth: number;
  annualBasis: 'declared' | 'projection';
  phase: 'startup' | 'crisis' | 'expansion' | 'scale';
  phaseName: string;
  annualRevenue: number;
  annualExpense: number;
  netProfit: number;
  netMarginPct: number;
  cashReserve: number;
  activeOutlets: number;
  employeeCount: number;
  monthlyAverageRev: number;
  keyChallenge: string;
  aiPrescription: string;
  strategicAction: string;
  monthlyData: Record<string, HistoricalMonthlyFinancial>;
}

export interface HistoricalMonthlyFinancial {
  n: string;
  rev: number;
  exp: number;
  gp: number;
  np: number;
  nm: number;
  mom: string;
  hpp: number;
  ops: number;
  ads: number;
  pay: number;
  ar: number;
}

type HistoricalYearSnapshotSeed = Omit<HistoricalYearSnapshot, 'periodKind' | 'throughMonth' | 'annualBasis'>;

const HISTORICAL_YEAR_SEEDS: Record<number, HistoricalYearSnapshotSeed> = {
  // ─── 2017: TAHUN PENDIRIAN ──────────────────────────────────────────────
  2017: {
    year: 2017,
    periodLabel: 'Tahun Buku 2017 (Pendirian)',
    phase: 'startup',
    phaseName: 'Fase Rintisan Awal',
    annualRevenue: 280000000,
    annualExpense: 245000000,
    netProfit: 35000000,
    netMarginPct: 12.5,
    cashReserve: 25000000,
    activeOutlets: 1,
    employeeCount: 4,
    monthlyAverageRev: 23300000,
    keyChallenge: 'Validasi produk, pencatatan kasbon manual sering selisih, kas sangat ketat.',
    aiPrescription: 'Fokus pada disiplin pencatatan harian kas laci dan eliminasi pemborosan bahan baku (waste reduction).',
    strategicAction: 'Mendirikan outlet perdana di Rawamangun dan standardisasi resep dasar.',
    monthlyData: generateYearMonths(2017, 18000000, 28000000, 0.12),
  },

  // ─── 2018: PROVING THE MODEL ────────────────────────────────────────────
  2018: {
    year: 2018,
    periodLabel: 'Tahun Buku 2018 (Stabilisasi)',
    phase: 'startup',
    phaseName: 'Validasi & Stabilisasi',
    annualRevenue: 480000000,
    annualExpense: 395000000,
    netProfit: 85000000,
    netMarginPct: 17.7,
    cashReserve: 60000000,
    activeOutlets: 1,
    employeeCount: 6,
    monthlyAverageRev: 40000000,
    keyChallenge: 'Kapasitas dapur terbatas pada jam sibuk, turnover staf kasir tinggi.',
    aiPrescription: 'Terapkan shift terstruktur dan SOP serah terima kasir digital.',
    strategicAction: 'Renovasi dapur dan penambahan kapasitas meja dine-in.',
    monthlyData: generateYearMonths(2018, 32000000, 48000000, 0.17),
  },

  // ─── 2019: PERTUMBUHAN SEBELUM PANDEMI ──────────────────────────────────
  2019: {
    year: 2019,
    periodLabel: 'Tahun Buku 2019 (Akselerasi)',
    phase: 'startup',
    phaseName: 'Pertumbuhan Organik',
    annualRevenue: 850000000,
    annualExpense: 680000000,
    netProfit: 170000000,
    netMarginPct: 20.0,
    cashReserve: 130000000,
    activeOutlets: 2,
    employeeCount: 10,
    monthlyAverageRev: 70800000,
    keyChallenge: 'Kontrol stok antar 2 cabang dan negosiasi harga supplier utama.',
    aiPrescription: 'Kunci kontrak pasokan tahunan ayam & bumbu untuk stabilkan HPP.',
    strategicAction: 'Pembukaan cabang ke-2 di Bekasi Timur dan kemitraan supplier rekanan.',
    monthlyData: generateYearMonths(2019, 55000000, 85000000, 0.20),
  },

  // ─── 2020: PANDEMI & CRISIS MANAGEMENT ──────────────────────────────────
  2020: {
    year: 2020,
    periodLabel: 'Tahun Buku 2020 (Krisis Pandemi)',
    phase: 'crisis',
    phaseName: 'Fase Bertahan Krisis Global',
    annualRevenue: 520000000,
    annualExpense: 495000000,
    netProfit: 25000000,
    netMarginPct: 4.8,
    cashReserve: 45000000,
    activeOutlets: 2,
    employeeCount: 8,
    monthlyAverageRev: 43300000,
    keyChallenge: 'Pembatasan dine-in (PPKM), penurunan drastis pengunjung mal, runway kas tersisa 2,1 bulan.',
    aiPrescription: 'Pangkas beban operasional non-esensial, alihkan 100% fokus ke paket frozen food dan pesan-antar online.',
    strategicAction: 'Pivot darurat: kemasan vakum beku, join GrabFood/GoFood, renegosiasi diskon sewa outlet 50%.',
    monthlyData: generateCrisisYearMonths(2020),
  },

  // ─── 2021: PEMULIHAN & EFISIENSI HYBRID ─────────────────────────────────
  2021: {
    year: 2021,
    periodLabel: 'Tahun Buku 2021 (Pemulihan)',
    phase: 'crisis',
    phaseName: 'Konsolidasi & Rebound',
    annualRevenue: 980000000,
    annualExpense: 810000000,
    netProfit: 170000000,
    netMarginPct: 17.3,
    cashReserve: 110000000,
    activeOutlets: 2,
    employeeCount: 11,
    monthlyAverageRev: 81600000,
    keyChallenge: 'Kenaikan harga minyak goreng dan bahan baku kemasan, margin tertekan.',
    aiPrescription: 'Restrukturisasi menu berbasis margin kontribusi tinggi, kurangi menu slow-moving.',
    strategicAction: 'Peluncuran bundling hemat keluarga dan standardisasi resep efisien minyak.',
    monthlyData: generateYearMonths(2021, 65000000, 98000000, 0.17),
  },

  // ─── 2022: EKSPANSI PASCA KRISIS ────────────────────────────────────────
  2022: {
    year: 2022,
    periodLabel: 'Tahun Buku 2022 (Ekspansi)',
    phase: 'expansion',
    phaseName: 'Ekspansi Pasca Pemulihan',
    annualRevenue: 1850000000,
    annualExpense: 1480000000,
    netProfit: 370000000,
    netMarginPct: 20.0,
    cashReserve: 195000000,
    activeOutlets: 3,
    employeeCount: 14,
    monthlyAverageRev: 154000000,
    keyChallenge: 'Kebutuhan standarisasi gudang dan kendali mutu lintas kota.',
    aiPrescription: 'Terapkan audit checklist SOP digital harian di setiap outlet.',
    strategicAction: 'Pembukaan cabang ke-3 di Bandung Dago dan pembangunan central kitchen kecil.',
    monthlyData: generateYearMonths(2022, 120000000, 190000000, 0.20),
  },

  // ─── 2023: SCALE & DIGITAL MARKETING ────────────────────────────────────
  2023: {
    year: 2023,
    periodLabel: 'Tahun Buku 2023 (Penskalaan)',
    phase: 'expansion',
    phaseName: 'Akselerasi Digital Ads',
    annualRevenue: 3400000000,
    annualExpense: 2680000000,
    netProfit: 720000000,
    netMarginPct: 21.2,
    cashReserve: 240000000,
    activeOutlets: 3,
    employeeCount: 16,
    monthlyAverageRev: 283000000,
    keyChallenge: 'CAC (Customer Acquisition Cost) meningkat pada iklan media sosial.',
    aiPrescription: 'Fokuskan budget iklan ke retargeting pelanggan setia via WhatsApp Blast dan program loyalitas.',
    strategicAction: 'Integrasi Meta Ads ber-ROAS tinggi dan peluncuran program langganan katering kantor.',
    monthlyData: generateYearMonths(2023, 230000000, 340000000, 0.21),
  },

  // ─── 2024: KEMATANGAN OPERASIONAL & B2B ─────────────────────────────────
  2024: {
    year: 2024,
    periodLabel: 'Tahun Buku 2024 (Kedewasaan Bisnis)',
    phase: 'scale',
    phaseName: 'Ekosistem B2B & Rantai Pasok',
    annualRevenue: 5100000000,
    annualExpense: 3980000000,
    netProfit: 1120000000,
    netMarginPct: 21.9,
    cashReserve: 290000000,
    activeOutlets: 4,
    employeeCount: 18,
    monthlyAverageRev: 425000000,
    keyChallenge: 'Dead stock bahan baku di gudang cabang dan keterlambatan piutang invoice korporat.',
    aiPrescription: 'Terapkan reorder point otomatis (ROP) dan otomatisasi pengingat piutang WhatsApp 3-tone.',
    strategicAction: 'Perluasan ke outlet BSD Serpong dan kontrak katering korporat tetap dengan 12 perusahaan.',
    monthlyData: generateYearMonths(2024, 350000000, 500000000, 0.22),
  },

  // ─── 2025: TAHUN SEBELUM BERJALAN ───────────────────────────────────────
  2025: {
    year: 2025,
    periodLabel: 'Tahun Buku 2025 (Puncak Pertumbuhan)',
    phase: 'scale',
    phaseName: 'Masa Keemasan & Konsolidasi Kas',
    annualRevenue: 6450000000,
    annualExpense: 5020000000,
    netProfit: 1430000000,
    netMarginPct: 22.1,
    cashReserve: 320000000,
    activeOutlets: 4,
    employeeCount: 18,
    monthlyAverageRev: 537500000,
    keyChallenge: 'Menjaga margin bersih tetap di atas 20% di tengah ekspansi staf.',
    aiPrescription: 'Pertahankan blended ROAS minimal 4.0x dan optimalkan rotasi shift kerja.',
    strategicAction: 'Otomatisasi penuh pembukuan kas dengan KLIR OS dan penguatan dana cadangan darurat.',
    monthlyData: generateYearMonths(2025, 450000000, 610000000, 0.22),
  },

  // ─── 2026: TAHUN BERJALAN AKTIF (BENCHMARK KONSISTEN) ───────────────────
  2026: {
    year: 2026,
    periodLabel: 'Tahun Buku 2026 (Tahun Berjalan)',
    phase: 'scale',
    phaseName: 'Enterprise Omnichannel Matang',
    annualRevenue: 7350000000, // proyeksi setahun
    annualExpense: 5736000000,
    netProfit: 1614000000,
    netMarginPct: 22.0,
    cashReserve: 348500000,
    activeOutlets: 4,
    employeeCount: 18,
    monthlyAverageRev: 612500000,
    keyChallenge: 'Efisiensi beban iklan Meta/Google dan restock 9 SKU kritis tepat waktu.',
    aiPrescription: 'Lakukan intervensi PO pending dan renegosiasi termin kasbon B2B sebelum jatuh tempo.',
    strategicAction: 'Peluncuran AI Assistant KLIR di 6 divisi operasional secara terintegrasi.',
    monthlyData: {
      Jan: { n: 'Januari 2026', rev: 410000000, exp: 335000000, gp: 75000000, np: 75000000, nm: 18.3, mom: '+4.2%', hpp: 165000000, ops: 110000000, ads: 60000000, pay: 95000000, ar: 12000000 },
      Feb: { n: 'Februari 2026', rev: 445000000, exp: 355000000, gp: 90000000, np: 90000000, nm: 20.2, mom: '+8.5%', hpp: 175000000, ops: 115000000, ads: 65000000, pay: 95000000, ar: 14000000 },
      Mar: { n: 'Maret 2026', rev: 490000000, exp: 385000000, gp: 105000000, np: 105000000, nm: 21.4, mom: '+10.1%', hpp: 190000000, ops: 125000000, ads: 70000000, pay: 100000000, ar: 16000000 },
      Apr: { n: 'April 2026', rev: 475000000, exp: 380000000, gp: 95000000, np: 95000000, nm: 20.0, mom: '-3.1%', hpp: 185000000, ops: 125000000, ads: 70000000, pay: 100000000, ar: 15000000 },
      Mei: { n: 'Mei 2026', rev: 530000000, exp: 415000000, gp: 115000000, np: 115000000, nm: 21.7, mom: '+11.6%', hpp: 205000000, ops: 135000000, ads: 75000000, pay: 105000000, ar: 18000000 },
      Jun: { n: 'Juni 2026', rev: 565000000, exp: 440000000, gp: 125000000, np: 125000000, nm: 22.1, mom: '+6.6%', hpp: 215000000, ops: 145000000, ads: 80000000, pay: 110000000, ar: 20000000 },
      Jul: { n: 'Juli 2026', rev: 550000000, exp: 435000000, gp: 115000000, np: 115000000, nm: 20.9, mom: '-2.7%', hpp: 210000000, ops: 145000000, ads: 80000000, pay: 110000000, ar: 19000000 },
      Agu: { n: 'Agustus 2026', rev: 585000000, exp: 455000000, gp: 130000000, np: 130000000, nm: 22.2, mom: '+6.4%', hpp: 220000000, ops: 150000000, ads: 85000000, pay: 115000000, ar: 22000000 },
      Sep: { n: 'September 2026', rev: 612500000, exp: 478000000, gp: 134500000, np: 134500000, nm: 22.0, mom: '+4.7%', hpp: 215000000, ops: 167000000, ads: 96000000, pay: 120000000, ar: 24500000 },
      Okt: { n: 'Oktober 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
      Nov: { n: 'November 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
      Des: { n: 'Desember 2026', rev: 0, exp: 0, gp: 0, np: 0, nm: 0, mom: '0%', hpp: 0, ops: 0, ads: 0, pay: 0, ar: 0 },
    },
  },
};

export const HISTORICAL_YEARS_DATA = Object.entries(HISTORICAL_YEAR_SEEDS).reduce<Record<number, HistoricalYearSnapshot>>(
  (result, [yearText, snapshot]) => {
    const year = Number(yearText);
    const isCurrentYearProjection = year === 2026;
    result[year] = {
      ...snapshot,
      periodKind: isCurrentYearProjection ? 'current-year-projection' : 'annual-benchmark',
      throughMonth: isCurrentYearProjection ? 9 : 12,
      annualBasis: isCurrentYearProjection ? 'projection' : 'declared',
    };
    return result;
  },
  {},
);

// Helper generator bulan normal
function generateYearMonths(year: number, baseStart: number, baseEnd: number, targetMargin: number): Record<string, HistoricalMonthlyFinancial> {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const res: Record<string, HistoricalMonthlyFinancial> = {};
  const step = (baseEnd - baseStart) / 11;

  const monthLongNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  months.forEach((m, idx) => {
    const rev = Math.round(baseStart + step * idx);
    const exp = Math.round(rev * (1 - targetMargin));
    const net = rev - exp;
    res[m] = {
      n: `${monthLongNames[idx]} ${year}`,
      rev,
      exp,
      gp: net,
      np: net,
      nm: Math.round(targetMargin * 1000) / 10,
      mom: idx === 0 ? '+2.5%' : '+3.8%',
      hpp: Math.round(rev * 0.38),
      ops: Math.round(exp * 0.42),
      ads: Math.round(exp * 0.15),
      pay: Math.round(exp * 0.25),
      ar: Math.round(rev * 0.05),
    };
  });
  return res;
}

// ─── MULTI-YEAR & HORIZON AGGREGATIONS (Arahan Mecca 13 Sep 2026) ───────────

export type HistoricalHorizon = 'monthly' | 'ytd' | '1y' | '3y' | '5y' | '10y';

export interface MultiYearSummary {
  horizon: HistoricalHorizon;
  label: string;
  badge: string;
  startYear: number;
  endYear: number;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  netMarginPct: number;
  cashReserve: number;
  monthlyAverageRev: number;
  activeOutlets: number;
  employeeCount: number;
  cagrRevenuePct?: number;
  phaseSummary: string;
  keyHighlights: string[];
  strategicDelegations: {
    finance: string;
    marketing: string;
    operations: string;
    generalManager: string;
    secretary: string;
  };
}

export function getHistoricalMultiYearSummary(horizon: HistoricalHorizon, currentYear: number = 2026): MultiYearSummary | null {
  if (horizon === 'monthly') return null;

  if (horizon === 'ytd') {
    const s2026 = HISTORICAL_YEARS_DATA[currentYear] || HISTORICAL_YEARS_DATA[2026];
    const ytdMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep'];
    let rev = 0;
    let exp = 0;
    ytdMonths.forEach((m) => {
      const d = s2026?.monthlyData?.[m];
      if (d) {
        rev += d.rev;
        exp += d.exp;
      }
    });
    const net = rev - exp;
    return {
      horizon: 'ytd',
      label: 'Year-to-Date (Jan - Sep 2026)',
      badge: 'YTD 9 BULAN',
      startYear: 2026,
      endYear: 2026,
      totalRevenue: rev,
      totalExpense: exp,
      netProfit: net,
      netMarginPct: Math.round((net / (rev || 1)) * 1000) / 10,
      cashReserve: s2026?.cashReserve ?? 348500000,
      monthlyAverageRev: Math.round(rev / 9),
      activeOutlets: s2026?.activeOutlets ?? 4,
      employeeCount: s2026?.employeeCount ?? 18,
      phaseSummary: 'Performa tahun berjalan 9 bulan pertama 2026 dengan profitabilitas konsisten di atas 21%.',
      keyHighlights: [
        'Total omset YTD 9 bulan menembus Rp 4,77 Miliar',
        'Margin bersih stabil di 21,2% dengan arus kas positif tiap bulan',
        'Cadangan kas Rp 348,5 Juta siap menopang ekspansi kuartal 4',
      ],
      strategicDelegations: {
        finance: 'Kunci rekonsiliasi kas Q3 dan pastikan pencadangan pajak akhir tahun aman.',
        marketing: 'Maksimalkan ROAS kampanye akhir tahun (Q4 festive season) minimal 4,0x.',
        operations: 'Kunci stok pengadaan bahan baku utama sebelum lonjakan harga jelang akhir tahun.',
        generalManager: 'Review KPI dan produktivitas 18 karyawan untuk bonus kinerja kuartal 3.',
        secretary: 'Lengkapi arsip kontrak vendor tahunan dan jadwalkan rapat pimpinan evaluasi Q3.',
      },
    };
  }

  const windowYears: Record<'1y' | '3y' | '5y' | '10y', number[]> = {
    '1y': [2025, 2026],
    '3y': [2024, 2025, 2026],
    '5y': [2022, 2023, 2024, 2025, 2026],
    '10y': [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026],
  };

  const years = windowYears[horizon] || [2026];
  let totRev = 0;
  let totExp = 0;
  years.forEach((yr) => {
    const s = HISTORICAL_YEARS_DATA[yr];
    if (s) {
      totRev += s.annualRevenue;
      totExp += s.annualExpense;
    }
  });
  const net = totRev - totExp;
  const latest = HISTORICAL_YEARS_DATA[years[years.length - 1]] || HISTORICAL_YEARS_DATA[2026];
  const earliest = HISTORICAL_YEARS_DATA[years[0]] || latest;

  let cagr: number | undefined;
  if (years.length > 1 && earliest.annualRevenue > 0) {
    const n = years.length - 1;
    cagr = Math.round((Math.pow(latest.annualRevenue / earliest.annualRevenue, 1 / n) - 1) * 1000) / 10;
  }

  const labelMap: Record<string, string> = {
    '1y': '1 Tahun Terakhir (2025 - 2026)',
    '3y': '3 Tahun Terakhir (2024 - 2026)',
    '5y': '5 Tahun Terakhir (2022 - 2026)',
    '10y': '10 Tahun Penuh (2017 - 2026)',
  };

  const badgeMap: Record<string, string> = {
    '1y': 'HORIZON 1 TAHUN',
    '3y': 'HORIZON 3 TAHUN',
    '5y': 'HORIZON 5 TAHUN',
    '10y': 'HORIZON 10 TAHUN',
  };

  const summaries: Record<string, string> = {
    '1y': 'Konsolidasi skala enterprise dengan pertumbuhan omset terprediksi dan diversifikasi kanal penjualan.',
    '3y': 'Fase kematangan bisnis (2024-2026) dengan laba bersih kumulatif Rp 4,16 Miliar dari 4 cabang aktif.',
    '5y': 'Transformasi pasca-krisis pandemi (2022-2026) menghasilkan lonjakan pendapatan hampir 4x lipat (CAGR +31,8%).',
    '10y': 'Rekam jejak satu dekade (2017-2026) dari warung rintisan tunggal (Rp 280jt) hingga jaringan multi-cabang omnichannel (Rp 7,35M).',
  };

  return {
    horizon,
    label: labelMap[horizon] || `Horizon ${horizon.toUpperCase()}`,
    badge: badgeMap[horizon] || 'MULTI-TAHUN',
    startYear: years[0],
    endYear: years[years.length - 1],
    totalRevenue: totRev,
    totalExpense: totExp,
    netProfit: net,
    netMarginPct: Math.round((net / (totRev || 1)) * 1000) / 10,
    cashReserve: latest.cashReserve,
    monthlyAverageRev: Math.round(totRev / (years.length * 12)),
    activeOutlets: latest.activeOutlets,
    employeeCount: latest.employeeCount,
    cagrRevenuePct: cagr,
    phaseSummary: summaries[horizon] || '',
    keyHighlights: [
      `Total perputaran omset kumulatif: Rp ${(totRev / 1000000000).toFixed(2).replace('.', ',')} Miliar`,
      `Akumulasi laba bersih: Rp ${(net / 1000000000).toFixed(2).replace('.', ',')} Miliar (Margin ${((net / (totRev || 1)) * 100).toFixed(1).replace('.', ',')}%)`,
      cagr ? `Laju pertumbuhan majemuk tahunan (CAGR): +${cagr}% per tahun` : `Ekspansi cabang bertumbuh dari ${earliest.activeOutlets} ke ${latest.activeOutlets} outlet`,
    ],
    strategicDelegations: {
      finance: 'Kaji alokasi dividen vs reinvestasi belanja modal (Capex) untuk pembukaan cabang baru tahun depan.',
      marketing: 'Audit efisiensi blended CAC historis lintas platform untuk merumuskan budget iklan jangka panjang.',
      operations: 'Standardisasi rantai pasok ke Central Kitchen utama untuk mempertahankan skala ekonomi HPP < 38%.',
      generalManager: 'Rancang program retensi talenta kunci dan jalur karir manajerial seiring perluasan cabang.',
      secretary: 'Lakukan audit berkala kepatuhan legalitas usaha, HAKI merek, dan standardisasi dokumen seluruh entitas.',
    },
  };
}


// Helper generator krisis pandemi 2020 (terjun bebas di Q2 lalu perlahan adaptasi)
function generateCrisisYearMonths(year: number): Record<string, HistoricalMonthlyFinancial> {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const monthLongNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const res: Record<string, HistoricalMonthlyFinancial> = {};
  const pattern = [
    { rev: 68000000, exp: 56000000, nm: 17.6 }, // Jan normal
    { rev: 65000000, exp: 55000000, nm: 15.3 }, // Feb mulai isu
    { rev: 45000000, exp: 48000000, nm: -6.7 }, // Mar awal lockdown / PSBB (Defisit)
    { rev: 25000000, exp: 32000000, nm: -28.0 }, // Apr PSBB ketat (Krisis puncak)
    { rev: 28000000, exp: 30000000, nm: -7.1 }, // Mei adaptasi
    { rev: 35000000, exp: 34000000, nm: 2.8 },  // Jun mulai frozen delivery
    { rev: 42000000, exp: 38000000, nm: 9.5 },  // Jul
    { rev: 48000000, exp: 42000000, nm: 12.5 }, // Agu
    { rev: 52000000, exp: 44000000, nm: 15.3 }, // Sep
    { rev: 54000000, exp: 46000000, nm: 14.8 }, // Okt
    { rev: 58000000, exp: 48000000, nm: 17.2 }, // Nov
    { rev: 62000000, exp: 50000000, nm: 19.3 }, // Des rebound
  ];

  months.forEach((m, idx) => {
    const item = pattern[idx];
    const net = item.rev - item.exp;
    res[m] = {
      n: `${monthLongNames[idx]} ${year}`,
      rev: item.rev,
      exp: item.exp,
      gp: net > 0 ? net : 0,
      np: net,
      nm: item.nm,
      mom: idx === 0 ? '-1.0%' : idx === 2 ? '-30.7%' : idx === 3 ? '-44.4%' : '+15.2%',
      hpp: Math.round(item.rev * 0.40),
      ops: Math.round(item.exp * 0.40),
      ads: Math.round(item.exp * 0.08),
      pay: Math.round(item.exp * 0.35),
      ar: Math.round(item.rev * 0.04),
    };
  });

  return res;
}
