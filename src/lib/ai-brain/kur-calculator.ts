import { KURSimulationInput, KURSimulationResult } from './types';

const KUR_KEYWORDS = [
  'kur',
  'kredit usaha rakyat',
  'simulasi kur',
  'cicilan kur',
  'pinjaman kur',
];

// Sinyal bahwa pengguna genuinely mau MENGHITUNG, bukan cuma nanya definisi/konsep
// ("apa itu KUR?" tidak boleh ke-intercept jadi permintaan kalkulasi). Sama pola
// dengan detectHPPIntent() di hpp-calculator.ts.
const CALC_INTENT_SIGNALS = ['hitung', 'kalkulasi', 'kalkulator', 'simulasi', 'simulasikan', 'berapa', 'itung', 'cicilan'];

/**
 * Detects whether a chat message is asking for a KUR (Kredit Usaha Rakyat) loan
 * simulation, so the chat router can hand off to the deterministic calculateKUR()
 * below instead of letting the LLM guess the arithmetic. Requires BOTH a KUR-related
 * keyword AND a calculation-intent signal (verb, or a digit already in the message)
 * so a plain "apa itu KUR?" question still goes to the normal chat LLM.
 */
export function detectKURIntent(message: string): boolean {
  const lower = message.toLowerCase();
  const hasKURKeyword = KUR_KEYWORDS.some((kw) => lower.includes(kw));
  if (!hasKURKeyword) return false;
  const hasCalcSignal = CALC_INTENT_SIGNALS.some((kw) => lower.includes(kw)) || /\d/.test(lower);
  return hasCalcSignal;
}

/**
 * Pure KUR (Kredit Usaha Rakyat) simulation -- Bunga Flat Subsidi Pemerintah.
 * Mirrors the formula in src/app/api/v1/corplan/simulate-kur/route.ts EXACTLY --
 * kept as a separate pure function here so the AI chat brain can call it directly
 * without an internal HTTP round-trip, without touching that existing endpoint.
 * Default annualInterestRate 6% mengikuti default endpoint (subsidi bunga KUR
 * pemerintah per skema umum, bukan angka yang dikarang di sini).
 */
export function calculateKUR(input: KURSimulationInput): KURSimulationResult {
  const loanAmount = Number(input.loanAmount) || 0;
  const tenorMonths = Number(input.tenorMonths) || 1;
  const annualInterestRate = input.annualInterestRate != null ? Number(input.annualInterestRate) : 6;

  const totalInterest = loanAmount * (annualInterestRate / 100) * (tenorMonths / 12);
  const totalRepayment = loanAmount + totalInterest;
  const monthlyInstallment = Math.round(totalRepayment / tenorMonths);
  const monthlyPrincipal = Math.round(loanAmount / tenorMonths);
  const monthlyInterest = Math.round(totalInterest / tenorMonths);

  return {
    loanAmount,
    tenorMonths,
    annualInterestRate,
    monthlyInstallment,
    monthlyPrincipal,
    monthlyInterest,
    totalInterest,
    totalRepayment,
  };
}

/**
 * Strict extraction-only instruction for a separate, low-temperature LLM call whose
 * ONLY job is pulling the loan numbers out of the user's message/history -- the
 * actual arithmetic always happens in calculateKUR() above, never inside the LLM,
 * so the result can never be hallucinated math. Sama pola dengan
 * HPP_EXTRACTION_SYSTEM_INSTRUCTION di hpp-calculator.ts.
 */
export const KUR_EXTRACTION_SYSTEM_INSTRUCTION = `Kamu adalah pengekstrak data terstruktur. Tugasmu HANYA membaca pesan pengguna dan riwayat obrolan, lalu mengeluarkan angka-angka berikut dalam JSON, TANPA teks lain apapun di luar JSON, TANPA markdown code fence:
{"loanAmount": angka atau null, "tenorMonths": angka atau null, "annualInterestRate": angka atau null}

Arti tiap field: loanAmount = jumlah pinjaman KUR yang diminta (dalam Rupiah), tenorMonths = jangka waktu cicilan dalam bulan, annualInterestRate = suku bunga per tahun dalam persen (kalau pengguna tidak menyebutkan, isi null -- default 6% subsidi pemerintah akan dipakai otomatis di luar ekstraksi ini, JANGAN kamu yang menebak angka 6 di sini kecuali pengguna benar-benar menyebutkannya).

JANGAN MENGARANG angka yang tidak disebutkan di teks -- kalau loanAmount atau tenorMonths tidak disebutkan sama sekali (baik di pesan terbaru maupun riwayat sebelumnya), isi null untuk field itu, JANGAN ditebak atau diasumsikan dari angka lain.`;

export const KUR_REQUIRED_FIELD_LABELS: Record<'loanAmount' | 'tenorMonths', string> = {
  loanAmount: 'jumlah pinjaman KUR yang diinginkan (Rp)',
  tenorMonths: 'jangka waktu cicilan (bulan)',
};
