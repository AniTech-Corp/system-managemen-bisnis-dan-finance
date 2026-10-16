import {
  BusinessContextSnapshot,
  SimulationScenarioInput,
  SimulationResult,
  SimulationMonthProjection,
} from './types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * High-Fidelity Executive "What-If" Scenario Simulator
 * Evaluates tactical/strategic scenarios (e.g. hiring, marketing expansion, asset purchases) against real company financials.
 */
export function runWhatIfSimulation(
  context: BusinessContextSnapshot,
  input: SimulationScenarioInput
): SimulationResult {
  const currentCash = context.financials.liquidCash;
  const currentIncome = context.financials.totalIncome30d;
  const currentExpense = context.financials.totalExpense30d;
  const baselineRunway = context.financials.runwayMonths;

  // Extract or parse parameters
  const duration = input.adjustments?.durationMonths || 6;
  const addMonthlyExp = input.adjustments?.additionalMonthlyExpense || 0;
  const oneTimeCapex = input.adjustments?.oneTimeCapex || 0;
  const mktDeltaPercent = input.adjustments?.marketingBudgetDeltaPercent || 0;
  const revDeltaPercent = input.adjustments?.expectedRevenueDeltaPercent || 0;

  // Derive adjusted values
  const marketingDeltaAmt = (context.marketing.estimatedMarketingSpend30d || (currentExpense * 0.15)) * (mktDeltaPercent / 100);
  const totalAdditionalMonthlyBurn = addMonthlyExp + marketingDeltaAmt;
  const expectedMonthlyRevBoost = currentIncome * (revDeltaPercent / 100);

  const monthlyProjections: SimulationMonthProjection[] = [];
  let projectedCash = Math.max(0, currentCash - oneTimeCapex);
  let breakEvenMonth: number | null = null;
  let cashExhaustionMonth: number | null = null;

  const now = new Date();

  for (let m = 1; m <= duration; m++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const monthName = `${MONTH_NAMES[futureDate.getMonth()]} ${futureDate.getFullYear().toString().slice(-2)}`;

    // Monthly dynamics
    // In month 1-2, revenue boost might lag; from month 3 onwards, full boost applies
    const revenueRampFactor = m <= 2 ? 0.5 : 1.0;
    const effectiveRev = currentIncome + (expectedMonthlyRevBoost * revenueRampFactor);
    const effectiveExp = currentExpense + totalAdditionalMonthlyBurn;
    const monthlyNet = effectiveRev - effectiveExp;

    projectedCash = projectedCash + monthlyNet;

    if (projectedCash <= 0 && cashExhaustionMonth === null) {
      cashExhaustionMonth = m;
      projectedCash = 0;
    }

    if (monthlyNet >= 0 && breakEvenMonth === null && m > 1) {
      breakEvenMonth = m;
    }

    monthlyProjections.push({
      month: m,
      monthName,
      baselineCash: currentCash,
      projectedCash: Math.round(projectedCash),
      burnRate: Math.round(effectiveExp),
      netRevenue: Math.round(effectiveRev),
    });
  }

  // Calculate Simulated Runway from the ACTUAL month-by-month trajectory above,
  // not a separate steady-state formula -- that older formula ignored the
  // revenue ramp-up (month 1-2 at 50%) and could report a healthy runway
  // (e.g. 99 bulan) in the same result where the monthly projection already
  // shows cash hitting zero in month 1-2, which read as self-contradictory.
  let simulatedRunway: number;
  if (cashExhaustionMonth !== null) {
    // Cash actually runs out within the simulated window -- runway IS that month,
    // refined to the fraction of the month where it crossed zero.
    const exhaustionProjection = monthlyProjections[cashExhaustionMonth - 1];
    const priorCash = cashExhaustionMonth === 1 ? Math.max(0, currentCash - oneTimeCapex) : monthlyProjections[cashExhaustionMonth - 2].projectedCash;
    const monthNet = exhaustionProjection.netRevenue - exhaustionProjection.burnRate;
    const fraction = monthNet < 0 ? Math.min(1, Math.max(0, priorCash / Math.abs(monthNet))) : 1;
    simulatedRunway = Number((cashExhaustionMonth - 1 + fraction).toFixed(1));
  } else {
    // Cash survives the whole simulated window -- extrapolate from the LAST
    // month's steady-state burn (ramp is fully applied by then), not the
    // formula's original average, so short simulated windows don't hide a
    // burn that only kicks in after the ramp finishes.
    const lastProjection = monthlyProjections[monthlyProjections.length - 1];
    const steadyStateNet = lastProjection.netRevenue - lastProjection.burnRate;
    if (steadyStateNet >= 0) {
      simulatedRunway = 99.0;
    } else {
      simulatedRunway = Number((duration + lastProjection.projectedCash / Math.abs(steadyStateNet)).toFixed(1));
    }
  }

  const runwayDelta = Number((simulatedRunway - baselineRunway).toFixed(1));

  // Determine Risk Level
  let riskLevel: SimulationResult['riskLevel'] = 'LOW';
  if (simulatedRunway < 2.0 || cashExhaustionMonth !== null) {
    riskLevel = 'CRITICAL';
  } else if (simulatedRunway < 4.0 || runwayDelta < -3.0) {
    riskLevel = 'HIGH';
  } else if (simulatedRunway < 6.0 || runwayDelta < -1.0) {
    riskLevel = 'MODERATE';
  }

  // Generate Strategic Narrative & Actionable Steps
  const scenarioTitle = input.scenarioTitle || input.promptDescription.slice(0, 60);
  
  let strategicVerdict = '';
  const actionableSteps: string[] = [];

  if (riskLevel === 'CRITICAL') {
    strategicVerdict = `⚠️ RISIKO TINGGI: Skenario ini mempercepat habisnya cadangan kas secara signifikan. Runway terpangkas dari ${baselineRunway} bulan menjadi ${simulatedRunway} bulan. Tidak disarankan untuk dieksekusi tanpa suntikan modal atau kepastian pendapatan di muka.`;
    actionableSteps.push('Tunda pengeluaran modal (CapEx) atau batasi jumlah penambahan beban tetap.');
    actionableSteps.push('Tetapkan syarat target pendapatan kuartal berjalan sebelum memulai ekspansi tim/budget.');
    actionableSteps.push('Siapkan opsi skema kontrak berbasis komisi/performa alih-alih gaji tetap penuh.');
  } else if (riskLevel === 'HIGH' || riskLevel === 'MODERATE') {
    strategicVerdict = `⚖️ TERUKUR DENGAN CATATAN: Skenario ini memperpendek runway sebesar ${Math.abs(runwayDelta)} bulan. Namun jika target peningkatan pendapatan tercapai, titik impas diproyeksikan terjadi pada bulan ke-${breakEvenMonth || duration}.`;
    actionableSteps.push('Lakukan uji coba bertahap (milestone-based roll-out) selama 60 hari pertama.');
    actionableSteps.push('Pantau metrik ROAS dan konversi setiap minggu untuk memastikan target revenue boost tercapai.');
    actionableSteps.push('Siapkan "kill-switch" untuk memotong biaya jika performa bulan ke-2 di bawah 70% ekspektasi.');
  } else {
    strategicVerdict = `✅ EKSPANSI AMAN: Cadangan kas perusahaan sangat kuat dan mendukung skenario ini dengan proyeksi runway tetap berada di atas batas aman (${simulatedRunway} bulan).`;
    actionableSteps.push('Lanjutkan eksekusi rencana ekspansi sesuai timeline.');
    actionableSteps.push('Alokasikan KPI yang terukur untuk setiap tambahan budget atau personil baru.');
    actionableSteps.push('Lakukan review kinerja finansial di akhir siklus 90 hari.');
  }

  let cashOutDateProjected: string | null = null;
  if (cashExhaustionMonth !== null) {
    const exhaustionDate = new Date(now.getFullYear(), now.getMonth() + cashExhaustionMonth, 1);
    cashOutDateProjected = `${MONTH_NAMES[exhaustionDate.getMonth()]} ${exhaustionDate.getFullYear()}`;
  }

  const summary = `Simulasi skenario "${scenarioTitle}" memproyeksikan perubahan runway dari ${baselineRunway} bulan menjadi ${simulatedRunway} bulan (${runwayDelta >= 0 ? '+' : ''}${runwayDelta} bulan).`;

  return {
    scenarioTitle,
    summary,
    riskLevel,
    baselineRunwayMonths: baselineRunway,
    simulatedRunwayMonths: simulatedRunway,
    runwayDeltaMonths: runwayDelta,
    breakEvenMonthEstimated: breakEvenMonth,
    cashOutDateProjected,
    monthlyProjections,
    strategicVerdict,
    actionableSteps,
  };
}
