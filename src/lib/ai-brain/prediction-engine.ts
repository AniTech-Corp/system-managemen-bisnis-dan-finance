import { BusinessContextSnapshot, SimulationMonthProjection } from './types';

export interface AnomalyReportItem {
  id: string;
  type: 'OPEX_SPIKE' | 'RUNWAY_CRITICAL' | 'UNCOLLECTED_RECEIVABLES' | 'TASK_BOTTLENECK' | 'CAC_DEGRADATION';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  suggestedAction: string;
}

export interface ForwardForecastResult {
  currentLiquidCash: number;
  monthlyBurnRate: number;
  runwayMonths: number;
  cashOutDate: string | null;
  trajectories: {
    conservative: SimulationMonthProjection[];
    expected: SimulationMonthProjection[];
    optimistic: SimulationMonthProjection[];
  };
  anomalies: AnomalyReportItem[];
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * Deterministic Prediction Engine
 * Computes forward cashflow forecasts, runway exhaustion dates, and anomaly alerts.
 */
export function runForwardForecast(
  context: BusinessContextSnapshot,
  horizonMonths: number = 6
): ForwardForecastResult {
  const currentCash = context.financials.liquidCash;
  const currentBurn = context.financials.monthlyBurnRate;
  const currentIncome = context.financials.totalIncome30d;
  const currentExpense = context.financials.totalExpense30d;
  const runwayMonths = context.financials.runwayMonths;

  const now = new Date();
  let cashOutDate: string | null = null;

  if (runwayMonths > 0 && runwayMonths < 90) {
    const cashOutTime = new Date(now.getTime() + runwayMonths * 30 * 24 * 60 * 60 * 1000);
    cashOutDate = `${MONTH_NAMES[cashOutTime.getMonth()]} ${cashOutTime.getFullYear()}`;
  }

  // Build Trajectories
  const conservative: SimulationMonthProjection[] = [];
  const expected: SimulationMonthProjection[] = [];
  const optimistic: SimulationMonthProjection[] = [];

  let consCash = currentCash;
  let expCash = currentCash;
  let optCash = currentCash;

  for (let m = 1; m <= horizonMonths; m++) {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const monthName = `${MONTH_NAMES[futureDate.getMonth()]} ${futureDate.getFullYear().toString().slice(-2)}`;

    // 1. Conservative (Revenue drops 20%, Expenses rise 5%)
    const consRev = currentIncome * 0.8;
    const consExp = currentExpense * 1.05;
    consCash = Math.max(0, consCash + (consRev - consExp));
    conservative.push({
      month: m,
      monthName,
      baselineCash: currentCash,
      projectedCash: Math.round(consCash),
      burnRate: Math.round(consExp),
      netRevenue: Math.round(consRev),
    });

    // 2. Expected (Current run rate remains stable)
    const expRev = currentIncome;
    const expExp = currentExpense;
    expCash = Math.max(0, expCash + (expRev - expExp));
    expected.push({
      month: m,
      monthName,
      baselineCash: currentCash,
      projectedCash: Math.round(expCash),
      burnRate: Math.round(expExp),
      netRevenue: Math.round(expRev),
    });

    // 3. Optimistic (Revenue grows 10% MoM, Expense controlled +2%)
    const optRev = currentIncome * Math.pow(1.10, m);
    const optExp = currentExpense * Math.pow(1.02, m);
    optCash = Math.max(0, optCash + (optRev - optExp));
    optimistic.push({
      month: m,
      monthName,
      baselineCash: currentCash,
      projectedCash: Math.round(optCash),
      burnRate: Math.round(optExp),
      netRevenue: Math.round(optRev),
    });
  }

  // 4. Anomaly Detection
  const anomalies: AnomalyReportItem[] = [];

  // Runway Critical
  if (runwayMonths < 3.0 && currentBurn > 0) {
    anomalies.push({
      id: 'anom-runway-crit',
      type: 'RUNWAY_CRITICAL',
      severity: 'CRITICAL',
      title: 'Cadangan Kas di Bawah Ambang Kritis (< 3 Bulan)',
      message: `Cadangan kas diproyeksikan habis pada ${cashOutDate || 'kurang dari 90 hari'} dengan laju bakar saat ini Rp ${currentBurn.toLocaleString('id-ID')}/bulan.`,
      suggestedAction: 'Pangkas pengeluaran non-esensial dan percepat penagihan piutang faktur tertunda.',
    });
  }

  // Uncollected Receivables
  if (context.financials.overdueInvoicesCount > 0) {
    anomalies.push({
      id: 'anom-invoice-overdue',
      type: 'UNCOLLECTED_RECEIVABLES',
      severity: 'WARNING',
      title: `${context.financials.overdueInvoicesCount} Faktur Piutang Melewati Jatuh Tempo`,
      message: `Terdapat piutang tertunggak senilai Rp ${context.financials.totalUnpaidInvoices.toLocaleString('id-ID')} yang belum tertagih.`,
      suggestedAction: 'Kirimkan pesan pengingat pembayaran otomatis via WhatsApp / Email kepada klien terkait.',
    });
  }

  // Task Bottleneck
  if (context.operations.overdueTasksCount > 3) {
    anomalies.push({
      id: 'anom-ops-bottleneck',
      type: 'TASK_BOTTLENECK',
      severity: 'WARNING',
      title: 'Bottleneck Operasional: Tugas Overdue Menumpuk',
      message: `${context.operations.overdueTasksCount} tugas operasional tertunda dan belum terselesaikan.`,
      suggestedAction: 'Realokasikan penanggung jawab tugas atau pangkas prioritas pekerjaan di ruang kerja operasional.',
    });
  }

  return {
    currentLiquidCash: currentCash,
    monthlyBurnRate: currentBurn,
    runwayMonths,
    cashOutDate,
    trajectories: {
      conservative,
      expected,
      optimistic,
    },
    anomalies,
  };
}
