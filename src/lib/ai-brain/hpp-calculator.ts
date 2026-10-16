import { HPPCalculationInput, HPPCalculationResult } from './types';

const HPP_KEYWORDS = [
  'hpp',
  'harga pokok penjualan',
  'harga pokok produksi',
  'kalkulator hpp',
  'hitung hpp',
  'cogs',
  'cost of goods sold',
];

// Sinyal bahwa pengguna genuinely mau MENGHITUNG, bukan cuma nanya definisi/konsep
// ("apa itu HPP?" tidak boleh ke-intercept jadi permintaan kalkulasi).
const CALC_INTENT_SIGNALS = ['hitung', 'kalkulasi', 'kalkulator', 'berapa', 'itung'];

/**
 * Detects whether a chat message is asking for an HPP (Harga Pokok Penjualan / Cost of
 * Goods Sold) calculation, so the chat router can hand off to the deterministic
 * calculateHPP() below instead of letting the LLM guess the arithmetic. Requires BOTH
 * an HPP-related keyword AND a calculation-intent signal (verb, or a digit already in
 * the message) so a plain "apa itu HPP?" question still goes to the normal chat LLM.
 */
export function detectHPPIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const hasHPPKeyword = HPP_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasHPPKeyword) return false;
  const hasCalcSignal = CALC_INTENT_SIGNALS.some((kw) => lower.includes(kw)) || /\d/.test(lower);
  return hasCalcSignal;
}

/**
 * Pure HPP (Harga Pokok Penjualan / Cost of Goods Sold) calculation.
 * Mirrors the formula in src/app/api/v1/corplan/calculate-hpp/route.ts exactly --
 * kept as a separate pure function here so the AI chat brain can call it directly
 * without an internal HTTP round-trip, without touching that existing endpoint.
 */
export function calculateHPP(input: HPPCalculationInput): HPPCalculationResult {
  const rawMaterialCost = Number(input.rawMaterialCost) || 0;
  const laborCost = Number(input.laborCost) || 0;
  const overheadCost = Number(input.overheadCost) || 0;
  const sellingPrice = Number(input.sellingPrice) || 0;
  const monthlyVolume = Number(input.monthlyVolume) || 1;

  const totalHPPPerUnit = rawMaterialCost + laborCost + overheadCost;
  const grossProfitPerUnit = sellingPrice - totalHPPPerUnit;
  const marginPercentage = sellingPrice > 0 ? (grossProfitPerUnit / sellingPrice) * 100 : 0;
  const totalMonthlyRevenue = sellingPrice * monthlyVolume;
  const totalMonthlyCost = totalHPPPerUnit * monthlyVolume;
  const totalMonthlyGrossProfit = grossProfitPerUnit * monthlyVolume;

  return {
    rawMaterialCost,
    laborCost,
    overheadCost,
    totalHPPPerUnit,
    sellingPrice,
    grossProfitPerUnit,
    marginPercentage,
    monthlyVolume,
    totalMonthlyRevenue,
    totalMonthlyCost,
    totalMonthlyGrossProfit,
  };
}

/**
 * Strict extraction-only instruction for a separate, low-temperature LLM call whose
 * ONLY job is pulling the 5 numbers out of the user's message/history -- the actual
 * arithmetic always happens in calculateHPP() above, never inside the LLM, so the
 * result can never be hallucinated math.
 */
export const HPP_EXTRACTION_SYSTEM_INSTRUCTION = `Kamu adalah pengekstrak data terstruktur. Tugasmu HANYA membaca pesan pengguna dan riwayat obrolan, lalu mengeluarkan angka-angka berikut dalam JSON, TANPA teks lain apapun di luar JSON, TANPA markdown code fence:
{"rawMaterialCost": angka atau null, "laborCost": angka atau null, "overheadCost": angka atau null, "sellingPrice": angka atau null, "monthlyVolume": angka atau null}

Arti tiap field: rawMaterialCost = biaya bahan baku per unit, laborCost = biaya tenaga kerja per unit, overheadCost = biaya overhead/operasional per unit, sellingPrice = harga jual per unit, monthlyVolume = perkiraan jumlah unit terjual per bulan.

JANGAN MENGARANG angka yang tidak disebutkan di teks -- kalau salah satu dari kelima angka itu tidak disebutkan sama sekali (baik di pesan terbaru maupun riwayat sebelumnya), isi null untuk field itu, JANGAN ditebak atau diasumsikan dari angka lain.`;

export const HPP_REQUIRED_FIELD_LABELS: Record<'rawMaterialCost' | 'laborCost' | 'overheadCost' | 'sellingPrice', string> = {
  rawMaterialCost: 'biaya bahan baku per unit',
  laborCost: 'biaya tenaga kerja per unit',
  overheadCost: 'biaya overhead/operasional per unit',
  sellingPrice: 'harga jual per unit',
};
