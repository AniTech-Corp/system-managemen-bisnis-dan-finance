export type QuarterlySalesRealization = {
  quarter: 1 | 2 | 3 | 4;
  amount: number;
};

export type QuarterlyRecoveryTarget = {
  quarter: 1 | 2 | 3 | 4;
  amount: number;
};

export type SalesTargetAnalysis = {
  annualTarget: number;
  quarterlyTarget: number;
  realizations: QuarterlySalesRealization[];
  realizedToDate: number;
  remainingTarget: number;
  remainingQuarters: number[];
  suggestedPerRemainingQuarter: number | null;
  stagedRecoveryPlan: QuarterlyRecoveryTarget[];
  projectedAnnualRevenue: number;
  projectedGap: number;
  lastRecordedQuarter: 1 | 2 | 3 | 4;
};

const AMOUNT_PATTERN = String.raw`(?:Rp\.?\s*)?(\d[\d.,]*)\s*(ribu|rb|juta|jt|miliar| milyar|triliun|t)`;

function parseAmount(value: string, unit: string): number {
  const normalized = value.replace(/\./g, '').replace(',', '.');
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return 0;

  const multiplier = unit.trim().toLowerCase() === 'ribu' || unit.trim().toLowerCase() === 'rb'
    ? 1_000
    : unit.trim().toLowerCase() === 'juta' || unit.trim().toLowerCase() === 'jt'
      ? 1_000_000
      : unit.trim().toLowerCase() === 'miliar' || unit.trim().toLowerCase() === 'milyar'
        ? 1_000_000_000
        : 1_000_000_000_000;

  return Math.round(numeric * multiplier);
}

function findAmount(text: string, fromIndex = 0): number | null {
  const match = text.slice(fromIndex).match(new RegExp(AMOUNT_PATTERN, 'i'));
  return match ? parseAmount(match[1], match[2]) : null;
}

export function detectSalesTargetIntent(message: string): boolean {
  const lower = message.toLowerCase();
  return /(target\s+(?:penjualan|sales)|target\s+tahunan|realisasi\s+(?:penjualan|sales)|prediksi\s+(?:penjualan|sales)|per\s+kuartal|q[1-4])/.test(lower);
}

export function parseSalesTargetInput(message: string): { annualTarget: number | null; realizations: QuarterlySalesRealization[] } {
  const text = message.replace(/\s+/g, ' ');
  const annualMatch = text.match(/(?:target\s+(?:penjualan|sales)?|sales\s+target)[^\n.;]{0,90}?\b(?:tahunan|1\s*tahun|setahun|annual)?[^\n.;]{0,40}?/i);
  const annualTarget = annualMatch ? findAmount(text, annualMatch.index || 0) : null;
  const realizations: QuarterlySalesRealization[] = [];

  // Tempered capture: berhenti SEBELUM token kuartal berikutnya, supaya "Q1 15 juta, Q2 20 juta"
  // (dipisah koma/spasi, bukan titik-koma) tidak menelan Q2 ke dalam sisa teks Q1.
  // Bukti bug (10 Sep 2026, tes localhost): kalimat koma cuma menghasilkan realisasi Q1.
  for (const match of text.matchAll(/\b(?:q|kuartal)\s*([1-4])\b((?:(?!\b(?:q|kuartal)\s*[1-4]\b)[^\n.;]){0,80})/gi)) {
    const quarter = Number(match[1]) as 1 | 2 | 3 | 4;
    const amount = findAmount(match[2]);
    if (amount && amount > 0) realizations.push({ quarter, amount });
  }

  const unique = new Map<number, QuarterlySalesRealization>();
  for (const realization of realizations) unique.set(realization.quarter, realization);
  return { annualTarget, realizations: [...unique.values()].sort((a, b) => a.quarter - b.quarter) };
}

export function analyzeSalesTarget(message: string): SalesTargetAnalysis | null {
  const parsed = parseSalesTargetInput(message);
  const annualTarget = parsed.annualTarget;
  if (!annualTarget || parsed.realizations.length === 0) return null;

  const lastRecordedQuarter = parsed.realizations[parsed.realizations.length - 1].quarter;
  const realizedToDate = parsed.realizations.reduce((sum, item) => sum + item.amount, 0);
  const remainingQuarters = Array.from({ length: 4 - lastRecordedQuarter }, (_, index) => lastRecordedQuarter + index + 1);
  const remainingTarget = Math.max(0, annualTarget - realizedToDate);
  const suggestedPerRemainingQuarter = remainingQuarters.length > 0 ? remainingTarget / remainingQuarters.length : null;
  const baselineForRemainingQuarters = (annualTarget / 4) * remainingQuarters.length;
  const backlogToRecover = Math.max(0, remainingTarget - baselineForRemainingQuarters);
  const recoveryWeightTotal = (remainingQuarters.length * (remainingQuarters.length + 1)) / 2;
  let recoveryAllocated = 0;
  const stagedRecoveryPlan = remainingQuarters.map((quarter, index) => {
    // When the business is behind plan, spread the backlog gradually rather than
    // placing all of it in the final quarter. For Q1 Rp15 jt / Q2 Rp20 jt against
    // a Rp100 jt annual target, this deliberately yields Q3 Rp30 jt + Q4 Rp35 jt.
    const base = backlogToRecover > 0 ? annualTarget / 4 : suggestedPerRemainingQuarter || 0;
    const isLast = index === remainingQuarters.length - 1;
    const amount = isLast
      ? remainingTarget - recoveryAllocated
      : Math.round(base + (backlogToRecover * (index + 1)) / recoveryWeightTotal);
    recoveryAllocated += amount;
    return { quarter: quarter as 1 | 2 | 3 | 4, amount };
  });
  const averageRecordedQuarter = realizedToDate / parsed.realizations.length;
  const projectedAnnualRevenue = Math.round(realizedToDate + averageRecordedQuarter * remainingQuarters.length);

  return {
    annualTarget,
    quarterlyTarget: annualTarget / 4,
    realizations: parsed.realizations,
    realizedToDate,
    remainingTarget,
    remainingQuarters,
    suggestedPerRemainingQuarter,
    stagedRecoveryPlan,
    projectedAnnualRevenue,
    projectedGap: annualTarget - projectedAnnualRevenue,
    lastRecordedQuarter,
  };
}

function formatRp(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

export function buildSalesTargetReply(message: string): string {
  const parsed = parseSalesTargetInput(message);
  if (!parsed.annualTarget || parsed.realizations.length === 0) {
    const missing = [
      !parsed.annualTarget ? '- Target penjualan tahunan (contoh: Rp 100 juta)' : '',
      parsed.realizations.length === 0 ? '- Realisasi per kuartal yang sudah terjadi (contoh: Q1 Rp 15 juta, Q2 Rp 20 juta)' : '',
    ].filter(Boolean).join('\n');
    return `Siap menganalisis target dan prediksi penjualan, tapi saya masih perlu angka riil berikut agar tidak menebak:\n\n${missing}\n\nFormat yang bisa langsung dikirim: “target tahunan Rp 100 juta; Q1 Rp 15 juta; Q2 Rp 20 juta”. Setelah itu saya hitung target per kuartal, gap, kebutuhan Q3–Q4, diagnosis periode tertinggal, dan proyeksi sampai Desember.`;
  }

  const analysis = analyzeSalesTarget(message);
  if (!analysis) return 'Data target penjualan belum cukup untuk dihitung. Kirim target tahunan dan realisasi minimal satu kuartal.';

  const diagnosis = analysis.realizations.map((item) => {
    const variance = item.amount - analysis.quarterlyTarget;
    const status = variance >= 0 ? 'di atas/tepat target' : 'tertinggal';
    return `- Q${item.quarter}: ${formatRp(item.amount)} — ${status} ${formatRp(Math.abs(variance))} dari patokan kuartal`;
  }).join('\n');
  const futurePlan = analysis.stagedRecoveryPlan.length > 0
    ? analysis.stagedRecoveryPlan.map((item) => `- Q${item.quarter}: target kerja ${formatRp(item.amount)}`).join('\n')
    : '- Semua kuartal sudah memiliki realisasi; gunakan data tambahan untuk revisi forecast.';
  const recoveryRationale = analysis.remainingQuarters.length > 0
    ? analysis.remainingTarget > (analysis.quarterlyTarget * analysis.remainingQuarters.length)
      ? `Target dasar tiap kuartal adalah ${formatRp(analysis.quarterlyTarget)}. Backlog dibagi makin besar ke kuartal berikutnya agar tidak seluruhnya dibebankan ke periode terakhir.`
      : `Sisa target dibagi rata karena realisasi sampai periode ini tidak membentuk backlog di atas target dasar kuartalan.`
    : '';
  const projectionVerdict = analysis.projectedGap >= 0
    ? `Dengan asumsi rata-rata realisasi kuartal yang tercatat berlanjut, proyeksi tahunan ${formatRp(analysis.projectedAnnualRevenue)} masih kurang ${formatRp(analysis.projectedGap)} dari target.`
    : `Dengan asumsi rata-rata realisasi kuartal yang tercatat berlanjut, proyeksi tahunan melampaui target sekitar ${formatRp(Math.abs(analysis.projectedGap))}.`;

  return `**Analisis target penjualan**

- Target tahunan: **${formatRp(analysis.annualTarget)}**
- Patokan target per kuartal: **${formatRp(analysis.quarterlyTarget)}**
- Realisasi tercatat sampai Q${analysis.lastRecordedQuarter}: **${formatRp(analysis.realizedToDate)}**
- Sisa yang perlu dicapai: **${formatRp(analysis.remainingTarget)}**

**Diagnosis periode**
${diagnosis}

**Rencana recovery kuartal berikutnya**
${futurePlan}
${recoveryRationale ? `\n${recoveryRationale}` : ''}

**Prediksi berbasis data yang dikirim**
${projectionVerdict}

Ini proyeksi sederhana dari realisasi yang Anda masukkan, bukan kepastian. Untuk diagnosis penyebab Q1/Q2 yang lebih tajam, kirim juga data kanal, produk, biaya iklan, dan jumlah transaksi per kuartal.`;
}
