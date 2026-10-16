// src/lib/forecast-blend.ts
// Gabungkan proyeksi kas internal (prediction-engine.ts milik Fatur, DIBACA
// SAJA -- tipe ForwardForecastResult diimpor read-only, file itu TIDAK
// disentuh) dengan sinyal riset publik (ExternalSignal, dari B1 web-research)
// dan input tambahan pengguna (ForecastExtraData). Dibangun 8 Sep 2026 (wave
// B2-forecast-blend), permintaan Mecca 8 Sep sore: "prediksi masa depan bukan
// hanya dari data bisnis, AI juga research data real life ... dengan data,
// angka, fakta bisnis + fakta lapangan".
//
// SSOT tipe: '@/lib/research-types' (murni, milik B1) + tipe ForwardForecastResult
// dari '@/lib/ai-brain' (READ-ONLY, tipe saja -- JANGAN pernah import runtime
// dari prediction-engine.ts selain lewat barrel '@/lib/ai-brain', dan JANGAN
// pernah edit file itu).
//
// Modul ini MURNI: nol fetch, nol Prisma, nol efek samping -- semua input lewat
// parameter fungsi, semua output lewat return value. Aman dites tanpa mock apapun
// selain data fixture biasa.

import type { ForwardForecastResult } from '@/lib/ai-brain';
import type {
  BlendedForecastMonth,
  BlendedForecastResult,
  DataSufficiency,
  ExternalSignal,
  ForecastExtraData,
  HorizonMonths,
} from './research-types';

// ===== INPUT =====

export interface BlendForecastInput {
  base: ForwardForecastResult;
  horizonMonths: HorizonMonths;
  externalSignals: ExternalSignal[];
  extraData?: ForecastExtraData;
  /**
   * KOREKSI (kritik "terlewat" TINGGI #1, 8 Sep 2026, diverifikasi LOKAL langsung
   * di context-engine.ts baris 167 & 189-195): field ini OPSIONAL, TAPI SANGAT
   * DISARANKAN diisi pemanggil (brain/forecast/route.ts sudah punya nilainya dari
   * context.financials, nol biaya tambahan). Alasan: base.currentLiquidCash===0
   * DAN base.monthlyBurnRate===0 BUKAN penanda "tidak ada data historis" yang
   * akurat -- monthlyBurnRate SELALU 0 untuk bisnis apapun yang breakeven/untung
   * di 30 hari terakhir (definisinya: hanya terisi kalau netCashflow30d negatif),
   * jadi proxy lama bisa salah bilang "data kurang" untuk bisnis yang justru
   * punya banyak transaksi tercatat. Kalau field ini diisi, dataSufficiency
   * memakai kombinasi yang benar (nol pemasukan DAN nol pengeluaran DAN nol kas
   * = benar-benar tidak ada aktivitas). Kalau tidak diisi (pemanggil lama
   * hipotetis), jatuh ke heuristik lama dengan catatan jujur bahwa itu kurang
   * akurat -- BUKAN diam-diam dianggap benar.
   */
  financials30d?: { totalIncome30d: number; totalExpense30d: number };
}

// ===== HELPER: pembobotan confidence =====
// "confidence 'low'/'medium' tidak pernah dianggap pasti" (spesifikasi) --
// diterjemahkan jadi bobot < 1 saat menjumlahkan effectPct ke baseline, supaya
// riset publik TIDAK PERNAH punya daya ubah penuh setara data internal
// terverifikasi. Angka bobot ini heuristik yang disengaja (bukan hasil model
// statistik), didokumentasikan di assumptions[] hasil supaya jujur ke pengguna.
const CONFIDENCE_WEIGHT: Record<ExternalSignal['confidence'], number> = {
  low: 0.35,
  medium: 0.6,
};

function clampPct(pct: number, max = 50): number {
  if (!Number.isFinite(pct)) return 0;
  return Math.max(-max, Math.min(max, pct));
}

function round(n: number): number {
  return Math.round(Number.isFinite(n) ? n : 0);
}

/**
 * Total pengaruh gabungan seluruh externalSignals terhadap baseline (dalam
 * PECAHAN, bukan persen -- misal 0.05 = +5%), setelah dibobot confidence dan
 * dibatasi (clamp) supaya 1-2 sinyal ekstrem tidak membanjiri seluruh proyeksi.
 */
function netExternalEffect(signals: ExternalSignal[]): number {
  const totalPct = signals.reduce((sum, s) => {
    const weight = CONFIDENCE_WEIGHT[s.confidence] ?? 0.35;
    return sum + clampPct(s.effectPct) * weight;
  }, 0);
  return clampPct(totalPct, 40) / 100;
}

// ===== HELPER: dampak extraData eksplisit =====
// Heuristik SENGAJA sederhana (bukan model elastisitas harga akademis) --
// extraData adalah input MANUAL pengguna (lebih "pasti" daripada riset web),
// jadi dampaknya TIDAK dibobot confidence seperti externalSignals, tapi tetap
// diarahkan asimetris ke optimis/pesimis (bukan ke baseline) supaya baseline
// tetap murni proyeksi data internal + riset -- extraData hanya melebarkan
// atau mempersempit rentang skenario, bukan mengubah "yang paling mungkin".
function extraDataEffect(extraData: ForecastExtraData | undefined): { optimisticPctDelta: number; pessimisticPctDelta: number; notes: string[] } {
  const notes: string[] = [];
  let optimisticPctDelta = 0;
  let pessimisticPctDelta = 0;

  if (!extraData) {
    return { optimisticPctDelta, pessimisticPctDelta, notes };
  }

  if (typeof extraData.priceChangePct === 'number' && extraData.priceChangePct !== 0) {
    const p = extraData.priceChangePct;
    // Kenaikan harga: skenario optimis anggap separuh kenaikan langsung jadi
    // margin tambahan (pelanggan tetap bertahan); skenario pesimis anggap ada
    // risiko kehilangan sebagian pelanggan (efek negatif, terlepas dari arah p).
    optimisticPctDelta += p * 0.5;
    pessimisticPctDelta -= Math.abs(p) * 0.25;
    notes.push(`Perubahan harga ${p > 0 ? '+' : ''}${p}% dari input Anda -- optimis anggap separuh kenaikan jadi margin, pesimis anggap ada risiko kehilangan sebagian pelanggan.`);
  }

  if (typeof extraData.costChangePct === 'number' && extraData.costChangePct !== 0) {
    const c = extraData.costChangePct;
    // Kenaikan biaya menekan kedua skenario, pesimis lebih terasa.
    optimisticPctDelta -= c * 0.3;
    pessimisticPctDelta -= c * 0.6;
    notes.push(`Perubahan biaya ${c > 0 ? '+' : ''}${c}% dari input Anda ikut menekan proyeksi kas (lebih terasa di skenario pesimis).`);
  }

  if (extraData.newBranch) {
    // Cabang baru: potensi upside jangka menengah, tapi risiko ramp-up/kanibalisasi
    // di awal -- heuristik flat, didokumentasikan sebagai ASUMSI eksplisit.
    optimisticPctDelta += 15;
    pessimisticPctDelta -= 20;
    notes.push('Rencana buka cabang baru dari input Anda -- optimis anggap ada tambahan omset bertahap, pesimis anggap ada biaya ramp-up/kanibalisasi omset cabang lama di awal.');
  }

  if (typeof extraData.targetRevenue === 'number' && extraData.targetRevenue > 0) {
    // Target revenue TIDAK dipaksakan masuk ke angka tabel (supaya proyeksi
    // tetap deterministik dari data, bukan "menyesuaikan diri" ke target) --
    // cukup dicatat sebagai referensi pembanding di assumptions/summary.
    notes.push(`Target pendapatan Rp ${extraData.targetRevenue.toLocaleString('id-ID')}/bulan dari input Anda dijadikan pembanding di ringkasan, bukan pengubah angka tabel.`);
  }

  if (extraData.notes && extraData.notes.trim()) {
    // "notes masuk ke assumptions[] apa adanya" (spesifikasi) -- teks bebas dari
    // pengguna, TIDAK diproses/diinterpretasi, cuma diteruskan.
    notes.push(`Catatan Anda: ${extraData.notes.trim()}`);
  }

  return { optimisticPctDelta, pessimisticPctDelta, notes };
}

// ===== dataSufficiency =====

function computeDataSufficiency(
  base: ForwardForecastResult,
  financials30d?: { totalIncome30d: number; totalExpense30d: number }
): DataSufficiency {
  const noCash = base.currentLiquidCash === 0;

  if (financials30d) {
    const noActivity = financials30d.totalIncome30d === 0 && financials30d.totalExpense30d === 0 && noCash;
    if (noActivity) {
      return {
        ok: false,
        reason: 'Tidak ada cukup data historis untuk memproyeksikan -- belum ada pemasukan, pengeluaran, maupun sisa kas tercatat di 30 hari terakhir.',
      };
    }
    return {
      ok: true,
      reason: `Cukup -- tercatat pemasukan Rp ${financials30d.totalIncome30d.toLocaleString('id-ID')} dan pengeluaran Rp ${financials30d.totalExpense30d.toLocaleString('id-ID')} di 30 hari terakhir.`,
    };
  }

  // Fallback heuristik LAMA (kurang akurat -- lihat komentar BlendForecastInput.financials30d
  // di atas) -- dipakai HANYA kalau pemanggil tidak mengirim financials30d sama sekali.
  if (noCash && base.monthlyBurnRate === 0) {
    return {
      ok: false,
      reason: 'Tidak ada cukup data historis untuk memproyeksikan (heuristik fallback -- financials30d tidak dikirim pemanggil, hasil ini kurang akurat untuk bisnis breakeven/untung).',
    };
  }
  return { ok: true, reason: 'Cukup, kas dan/atau laju bakar tercatat.' };
}

// ===== deteksi konflik arah tren (menjawab kritik "terlewat" TINGGI #2) =====
// CATATAN JUJUR: field `conflictNotes` terstruktur TIDAK ditambahkan ke
// research-types.ts (SSOT milik B1, bukan berkas saya -- lihat kepemilikan_berkas)
// karena keputusan itu masih menunggu konfirmasi Mecca/Komando (lihat
// butuh_dari_tim laporan kritik). Sebagai gantinya, deteksi konflik SEDERHANA ini
// dituliskan sebagai kalimat eksplisit di summary/assumptions -- substansi
// permintaan Mecca ("kadang data publik enggak sesuai data privat") tetap
// tersampaikan tanpa perlu mengubah tipe SSOT bersama secara sepihak.
function detectTrendConflict(base: ForwardForecastResult, externalSignals: ExternalSignal[]): string | null {
  const expected = base.trajectories.expected;
  if (expected.length < 2 || externalSignals.length === 0) return null;

  const internalDelta = expected[expected.length - 1].projectedCash - expected[0].projectedCash;
  const internalTrend = internalDelta > 0 ? 1 : internalDelta < 0 ? -1 : 0;

  const netPct = netExternalEffect(externalSignals);
  const externalTrend = netPct > 0.005 ? 1 : netPct < -0.005 ? -1 : 0;

  if (internalTrend !== 0 && externalTrend !== 0 && internalTrend !== externalTrend) {
    const internalWord = internalTrend > 0 ? 'naik' : 'turun';
    const externalWord = externalTrend > 0 ? 'naik' : 'turun';
    return `PERHATIAN: data internal bisnis Anda menunjukkan tren ${internalWord}, tapi riset pasar publik menunjukkan tren berlawanan (${externalWord}) -- pertimbangkan kedua sisi sebelum ambil keputusan, jangan hanya percaya salah satu.`;
  }
  return null;
}

// ===== ENTRYPOINT UTAMA =====

export function blendForecast(input: BlendForecastInput): BlendedForecastResult {
  const { base, horizonMonths, externalSignals, extraData, financials30d } = input;

  const dataSufficiency = computeDataSufficiency(base, financials30d);
  const netPct = netExternalEffect(externalSignals);
  const { optimisticPctDelta, pessimisticPctDelta, notes: extraNotes } = extraDataEffect(extraData);

  const monthCount = Math.min(
    horizonMonths,
    base.trajectories.expected.length,
    base.trajectories.conservative.length,
    base.trajectories.optimistic.length
  );

  const table: BlendedForecastMonth[] = [];
  for (let i = 0; i < monthCount; i++) {
    const exp = base.trajectories.expected[i];
    const cons = base.trajectories.conservative[i];
    const opt = base.trajectories.optimistic[i];

    const baseline = round(exp.projectedCash * (1 + netPct));
    const optimistic = round(opt.projectedCash * (1 + Math.max(0, netPct) + optimisticPctDelta / 100));
    const pessimistic = round(cons.projectedCash * (1 + Math.min(0, netPct) + pessimisticPctDelta / 100));

    table.push({
      month: exp.monthName,
      baseline,
      pessimistic,
      optimistic,
    });
  }

  const assumptions: string[] = [
    'Model dasar: skenario konservatif (pendapatan -20%, biaya +5%), ekspektasi (laju berjalan tetap), optimis (pendapatan +10%/bulan, biaya +2%/bulan) -- dari prediction-engine.ts (data internal).',
  ];
  if (externalSignals.length > 0) {
    assumptions.push(
      `Sinyal riset publik dibobot berdasarkan keyakinan (low x0.35, medium x0.6) sebelum ikut memengaruhi baseline -- TIDAK PERNAH dianggap sepasti data transaksi internal.`
    );
  }
  assumptions.push(...extraNotes);

  const conflictNote = detectTrendConflict(base, externalSignals);
  if (conflictNote) {
    assumptions.unshift(conflictNote);
  }

  const summary = buildSummary({
    horizonMonths: monthCount,
    base,
    dataSufficiency,
    externalSignals,
    extraData,
    conflictNote,
  });

  return {
    horizonMonths,
    table,
    assumptions,
    externalSignalsUsed: externalSignals,
    dataSufficiency,
    summary,
  };
}

function buildSummary(args: {
  horizonMonths: number;
  base: ForwardForecastResult;
  dataSufficiency: DataSufficiency;
  externalSignals: ExternalSignal[];
  extraData?: ForecastExtraData;
  conflictNote: string | null;
}): string {
  const { horizonMonths, base, dataSufficiency, externalSignals, extraData, conflictNote } = args;

  const parts: string[] = [];

  parts.push(
    `DATA INTERNAL: proyeksi kas ${horizonMonths} bulan ke depan berdasarkan transaksi bisnis Anda sendiri (kas saat ini Rp ${base.currentLiquidCash.toLocaleString('id-ID')}, laju bakar Rp ${base.monthlyBurnRate.toLocaleString('id-ID')}/bulan). ${dataSufficiency.reason}`
  );

  if (externalSignals.length > 0) {
    const labelList = externalSignals
      .slice(0, 5)
      .map(s => `${s.label} (${s.effectPct > 0 ? '+' : ''}${s.effectPct}%, keyakinan ${s.confidence}, sumber: ${s.source})`)
      .join('; ');
    parts.push(
      `DATA PUBLIK: riset menemukan sinyal berikut yang ikut dipertimbangkan dengan bobot diperkecil (bukan fakta pasti): ${labelList}.`
    );
  } else {
    parts.push('DATA PUBLIK: tidak ada riset eksternal yang disertakan pada perhitungan ini.');
  }

  if (extraData?.targetRevenue) {
    parts.push(
      `ASUMSI: target pendapatan Rp ${extraData.targetRevenue.toLocaleString('id-ID')}/bulan dari Anda dijadikan pembanding -- bukan pengubah langsung angka proyeksi.`
    );
  } else {
    parts.push('ASUMSI: model dasar konservatif/ekspektasi/optimis dari data internal, disesuaikan bobot riset publik dan input tambahan Anda kalau ada.');
  }

  if (conflictNote) {
    parts.push(conflictNote);
  }

  return parts.join(' ');
}

// ===== extractSignalsFromResearch =====
// Heuristik regex KASAR atas TEKS BEBAS hasil sintesis LLM (bukan data
// terstruktur) -- confidence SELALU 'low' (spesifikasi eksplisit), TIDAK PERNAH
// 'medium'/'high', karena ini tebakan atas kalimat, bukan parsing angka yang
// dijamin akurat. Dibatasi maksimal 5 sinyal supaya tidak membanjiri baseline
// (lihat clampPct di netExternalEffect untuk lapis pengaman kedua).
export function extractSignalsFromResearch(summary: string): ExternalSignal[] {
  if (!summary || !summary.trim()) return [];

  const signals: ExternalSignal[] = [];
  const upRegex = /(?:naik|meningkat|tumbuh|bertambah|melonjak)\s+(?:sekitar\s+)?(\d{1,3}(?:[.,]\d+)?)\s*%/gi;
  const downRegex = /(?:turun|menurun|melemah|berkurang|anjlok)\s+(?:sekitar\s+)?(\d{1,3}(?:[.,]\d+)?)\s*%/gi;

  let match: RegExpExecArray | null;
  while ((match = upRegex.exec(summary)) !== null) {
    const pct = parseFloat(match[1].replace(',', '.'));
    if (Number.isFinite(pct) && pct > 0) {
      signals.push({
        label: `Tren naik terdeteksi dari riset ("${match[0].trim()}")`,
        effectPct: clampPct(pct, 50),
        source: 'Riset web (ringkasan)',
        confidence: 'low',
      });
    }
  }
  while ((match = downRegex.exec(summary)) !== null) {
    const pct = parseFloat(match[1].replace(',', '.'));
    if (Number.isFinite(pct) && pct > 0) {
      signals.push({
        label: `Tren turun terdeteksi dari riset ("${match[0].trim()}")`,
        effectPct: clampPct(-pct, 50),
        source: 'Riset web (ringkasan)',
        confidence: 'low',
      });
    }
  }

  return signals.slice(0, 5);
}
