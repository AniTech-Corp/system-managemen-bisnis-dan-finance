/**
 * Enhanced AI Financial Decision Simulator
 *
 * Mesin analisis skenario keputusan finansial. Berbeda dari `simulator-engine.ts`
 * (What-If runway sederhana), engine ini memodelkan 5 jenis keputusan secara
 * eksplisit dan memakai parameter yang benar-benar dikirim pengguna:
 *
 *   1. employee_hiring  - rekrut/pangkas karyawan (gaji, onboarding, produktivitas)
 *   2. asset_purchase   - beli aset (penyusutan, ROI, metode pembiayaan)
 *   3. pricing_change   - ubah harga (elastisitas volume, margin)
 *   4. cost_change      - ubah HPP/biaya (bahan baku, tenaga kerja, efisiensi)
 *   5. custom           - delta biaya/pendapatan bebas
 *
 * Prinsip yang dijaga:
 * - DETERMINISTIK. Tidak ada Math.random(); input sama => output sama.
 * - Tidak ada NaN/Infinity. Semua pembagian lewat `safeDivide`, dan nilai
 *   non-finite dikembalikan sebagai `null` (JSON: null) supaya UI bisa
 *   menampilkan "tidak tersedia" alih-alih angka palsu.
 * - Risiko dihitung dari satu model ternormalisasi (0-100) sehingga bisa
 *   dibandingkan antar jenis skenario, bukan dari argumen yang tertukar.
 */

import { BusinessContextSnapshot } from './types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export type DecisionScenarioType = 'employee_hiring' | 'asset_purchase' | 'pricing_change' | 'cost_change' | 'custom';

export type DecisionRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type FinancingMethod = 'cash' | 'installment' | 'lease';

/**
 * Parameter skenario. Semua opsional: nilai yang tidak dikirim akan memakai
 * default yang diturunkan dari kondisi keuangan perusahaan (bukan angka mati).
 */
export interface DecisionSimulationAdjustments {
  // Legacy / umum (dipakai juga oleh what-if simulator lama)
  additionalMonthlyExpense?: number;
  oneTimeCapex?: number;
  marketingBudgetDeltaPercent?: number;
  expectedRevenueDeltaPercent?: number;
  durationMonths?: number;

  /** Tipe skenario eksplisit. Jika kosong, dideteksi dari promptDescription. */
  scenarioType?: DecisionScenarioType;

  // employee_hiring
  hiringCount?: number;
  averageSalary?: number;
  onboardingCost?: number;
  /** Kenaikan pendapatan dari produktivitas, mis. 0.15 = +15%. */
  productivityImpact?: number;

  // asset_purchase
  assetCost?: number;
  depreciationPeriodYears?: number;
  financingMethod?: FinancingMethod;
  /** Return tahunan terhadap harga aset, mis. 0.15 = 15%/tahun. */
  expectedROI?: number;

  // pricing_change
  priceChangePercent?: number;
  /** Pengali volume, mis. 0.95 = volume turun 5%. */
  volumeChangeImpact?: number;
  competitiveResponse?: boolean;

  // cost_change
  materialCostChangePercent?: number;
  laborCostChangePercent?: number;
  operationalEfficiency?: number;
}

export interface DecisionSimulationInput {
  workspaceId: string;
  scenarioTitle?: string;
  promptDescription: string;
  adjustments?: DecisionSimulationAdjustments;
}

export interface DecisionBaseline {
  monthlyRevenue: number;
  monthlyExpense: number;
  monthlyNetProfit: number;
  liquidCash: number;
  monthlyBurnRate: number;
  runwayMonths: number | null;
  grossMarginPercent: number;
  teamMemberCount: number;
}

export interface DecisionScenarioParameters {
  [key: string]: number | string | boolean | null | undefined;
}

export interface DecisionScenarioMetrics {
  /** Dampak laba kotor per bulan (bisa negatif). */
  monthlyGrossProfitImpact: number;
  /** Dampak laba bersih per bulan setelah biaya operasional tambahan. */
  monthlyNetProfitImpact: number;
  /** Dampak arus kas bulan pertama (termasuk belanja modal di muka). */
  firstMonthCashFlowImpact: number;
  /** Belanja modal / biaya di muka. */
  upfrontCashOutflow: number;
  monthlyCashOutflow: number;
  /** Perubahan margin kotor dalam poin persentase. */
  marginChangePoints: number;
  newGrossMarginPercent: number;
  /** ROI tahunan sebagai fraksi (0.15 = 15%). */
  annualROI: number | null;
  /** Bulan sampai biaya di muka kembali; null jika tidak pernah kembali. */
  paybackMonths: number | null;
  /** Proyeksi runway setelah skenario; null jika tidak bisa dihitung. */
  projectedRunwayMonths: number | null;
  /** true bila kas perusahaan habis dalam horizon durasi skenario. */
  cashOutWithinHorizon: boolean;
  /** Metrik tambahan spesifik per tipe skenario. */
  detail: Record<string, number | null>;
}

export interface DecisionStrategicFitFactor {
  factor: string;
  label: string;
  score: number;
  weight: number;
}

export interface DecisionScenarioResult {
  id: string;
  title: string;
  type: DecisionScenarioType;
  parameters: DecisionScenarioParameters;
  metrics: DecisionScenarioMetrics;
  riskLevel: DecisionRiskLevel;
  /** 0 (paling berisiko) - 100 (paling aman). */
  riskScore: number;
  riskReasons: string[];
  /** 0-100, semakin tinggi semakin baik. */
  score: number;
  rank: number;
  strategicFit: {
    score: number;
    factors: DecisionStrategicFitFactor[];
    recommendations: string[];
  };
}

export interface DecisionScenarioComparison {
  totalScenarios: number;
  rankedScenarios: DecisionScenarioResult[];
  bestROI: DecisionScenarioResult | null;
  bestCashFlow: DecisionScenarioResult | null;
  bestMargin: DecisionScenarioResult | null;
  riskDistribution: Record<DecisionRiskLevel, number>;
}

export interface DecisionRecommendation {
  title: string;
  scenarioId: string;
  reason: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  implementationMonths: number;
}

export interface DecisionSimulationResult {
  scenarioType: DecisionScenarioType;
  scenarioTitle: string;
  summary: string;
  baseline: DecisionBaseline;
  scenarioResults: DecisionScenarioResult[];
  comparison: DecisionScenarioComparison;
  recommendations: DecisionRecommendation[];
  overallRiskLevel: DecisionRiskLevel;
  horizonMonths: number;
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Util                                                                */
/* ------------------------------------------------------------------ */

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Pembagian aman. Mengembalikan null bila hasilnya tidak terdefinisi. */
function safeDivide(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

function round(value: number | null, digits = 2): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

/**
 * Margin kotor yang dipakai engine. Data `grossMarginPercent` dari context bisa
 * 0 (belum diisi). Bila begitu, diturunkan dari income/expense lalu dijepit ke
 * rentang wajar supaya tidak menghasilkan pembagi nol atau margin 100%.
 */
function resolveGrossMarginPercent(context: BusinessContextSnapshot): number {
  const declared = num(context.financials?.grossMarginPercent, 0);
  if (declared > 0 && declared < 100) return declared;

  const income = num(context.financials?.totalIncome30d, 0);
  const expense = num(context.financials?.totalExpense30d, 0);
  if (income > 0) {
    const derived = ((income - expense) / income) * 100;
    return clamp(derived, 1, 95);
  }
  return 30; // fallback konservatif bila belum ada data sama sekali
}

function buildBaseline(context: BusinessContextSnapshot): DecisionBaseline {
  const revenue = num(context.financials?.totalIncome30d, 0);
  const expense = num(context.financials?.totalExpense30d, 0);
  const cash = num(context.financials?.liquidCash, 0);
  const burn = num(context.financials?.monthlyBurnRate, Math.max(0, expense - revenue));
  const margin = resolveGrossMarginPercent(context);
  const teamMemberCount = Math.max(1, num((context as any)?.teamMemberCount, 1));

  const runway = num(context.financials?.runwayMonths, 0);
  const runwayMonths = safeDivide(cash, burn) ?? (runway > 0 ? runway : null);

  return {
    monthlyRevenue: revenue,
    monthlyExpense: expense,
    monthlyNetProfit: revenue - expense,
    liquidCash: cash,
    monthlyBurnRate: burn,
    runwayMonths: round(runwayMonths, 1),
    grossMarginPercent: round(margin, 1) ?? 0,
    teamMemberCount,
  };
}

/** COGS bulanan diturunkan dari pendapatan dan margin kotor. */
function baselineCogs(baseline: DecisionBaseline): number {
  return Math.max(0, baseline.monthlyRevenue * (1 - baseline.grossMarginPercent / 100));
}

function detectScenarioType(prompt: string): DecisionScenarioType {
  const text = String(prompt || '').toLowerCase();
  const has = (re: RegExp) => re.test(text);

  if (has(/rekrut|hiring|hire\b|karyawan|pegawai|staff|staf|phk|pangkas\s+karyawan/)) return 'employee_hiring';
  if (has(/beli\s+aset|pembelian\s+aset|asset|mesin|peralatan|kendaraan|gedung|investasi\s+modal/)) return 'asset_purchase';
  if (has(/harga\s+jual|price|pricing|naikkan\s+harga|turunkan\s+harga|diskon/)) return 'pricing_change';
  if (has(/hpp|cogs|biaya\s+produksi|bahan\s+baku|efisiensi|cost/)) return 'cost_change';
  return 'custom';
}

/* ------------------------------------------------------------------ */
/* Pembuat skenario (memakai parameter pengguna)                       */
/* ------------------------------------------------------------------ */

interface InternalScenario {
  id: string;
  title: string;
  type: DecisionScenarioType;
  parameters: DecisionScenarioParameters;
}

function buildScenarios(
  baseline: DecisionBaseline,
  type: DecisionScenarioType,
  a: DecisionSimulationAdjustments
): InternalScenario[] {
  switch (type) {
    case 'employee_hiring': {
      const count = Math.max(0, Math.round(num(a.hiringCount, 1)));
      const salary = Math.max(0, num(a.averageSalary, defaultSalaryFor(baseline)));
      const onboarding = Math.max(0, num(a.onboardingCost, salary * 0.1));
      const productivity = num(a.productivityImpact, 0.1);

      const halfCount = Math.max(0, Math.floor(count / 2));
      const stretchCount = Math.max(count + 1, Math.round(count * 1.5));

      return [
        {
          id: 'hiring_status_quo',
          title: 'Tanpa Rekrutmen (Status Quo)',
          type,
          parameters: { hiringCount: 0, averageSalary: salary, productivityImpact: 0, onboardingCost: 0 },
        },
        {
          id: 'hiring_plan',
          title: `Rekrut ${count} Orang (Sesuai Rencana)`,
          type,
          parameters: {
            hiringCount: count,
            averageSalary: salary,
            productivityImpact: productivity,
            onboardingCost: onboarding,
          },
        },
        {
          id: 'hiring_conservative',
          title: `Rekrut ${halfCount} Orang (Konservatif)`,
          type,
          parameters: {
            hiringCount: halfCount,
            averageSalary: salary,
            productivityImpact: productivity * 0.6,
            onboardingCost: onboarding,
          },
        },
        {
          id: 'hiring_stretch',
          title: `Rekrut ${stretchCount} Orang (Ekspansif)`,
          type,
          parameters: {
            hiringCount: stretchCount,
            averageSalary: salary,
            productivityImpact: productivity * 1.25,
            onboardingCost: onboarding,
          },
        },
      ];
    }

    case 'asset_purchase': {
      const cost = Math.max(0, num(a.assetCost, Math.max(1_000_000, baseline.liquidCash * 0.15)));
      const years = clamp(Math.round(num(a.depreciationPeriodYears, 5)), 1, 20);
      const roi = clamp(num(a.expectedROI, 0.15), 0, 2);
      const method = (a.financingMethod ?? 'cash') as FinancingMethod;
      const altMethod: FinancingMethod = method === 'cash' ? 'installment' : 'cash';

      return [
        {
          id: 'asset_none',
          title: 'Tunda Pembelian (Status Quo)',
          type,
          parameters: { assetCost: 0, depreciationPeriodYears: years, financingMethod: 'cash', expectedROI: 0 },
        },
        {
          id: 'asset_plan',
          title: `Beli Aset Rp ${Math.round(cost).toLocaleString('id-ID')} (${methodLabel(method)})`,
          type,
          parameters: {
            assetCost: cost,
            depreciationPeriodYears: years,
            financingMethod: method,
            expectedROI: roi,
          },
        },
        {
          id: 'asset_alt_financing',
          title: `Beli Aset (${methodLabel(altMethod)})`,
          type,
          parameters: {
            assetCost: cost,
            depreciationPeriodYears: years,
            financingMethod: altMethod,
            expectedROI: roi,
          },
        },
      ];
    }

    case 'pricing_change': {
      const change = clamp(num(a.priceChangePercent, 5), -90, 200);
      const volume = clamp(
        num(a.volumeChangeImpact, defaultVolumeImpact(change)),
        0.05,
        5
      );
      const competitive = a.competitiveResponse ?? change > 0;

      return [
        {
          id: 'pricing_status_quo',
          title: 'Harga Saat Ini (Status Quo)',
          type,
          parameters: { priceChangePercent: 0, volumeChangeImpact: 1, competitiveResponse: false },
        },
        {
          id: 'pricing_plan',
          title: `Ubah Harga ${change > 0 ? '+' : ''}${round(change, 1)}%`,
          type,
          parameters: {
            priceChangePercent: change,
            volumeChangeImpact: volume,
            competitiveResponse: competitive,
          },
        },
        {
          id: 'pricing_opposite',
          title: `Arah Sebaliknya (${change > 0 ? 'Turun' : 'Naik'} ${Math.round(Math.abs(change) * 5) / 10}%)`,
          type,
          parameters: {
            priceChangePercent: -change * 0.5,
            volumeChangeImpact: defaultVolumeImpact(-change * 0.5),
            competitiveResponse: false,
          },
        },
      ];
    }

    case 'cost_change': {
      const material = clamp(num(a.materialCostChangePercent, -3), -60, 100);
      const labor = clamp(num(a.laborCostChangePercent, -2), -60, 100);
      const efficiency = clamp(num(a.operationalEfficiency, 1.05), 0.4, 3);

      return [
        {
          id: 'cost_status_quo',
          title: 'Biaya Saat Ini (Status Quo)',
          type,
          parameters: {
            materialCostChangePercent: 0,
            laborCostChangePercent: 0,
            operationalEfficiency: 1,
          },
        },
        {
          id: 'cost_plan',
          title: `Paket Efisiensi (bahan ${material > 0 ? '+' : ''}${round(material, 1)}%, tenaga ${labor > 0 ? '+' : ''}${round(labor, 1)}%)`,
          type,
          parameters: {
            materialCostChangePercent: material,
            laborCostChangePercent: labor,
            operationalEfficiency: efficiency,
          },
        },
        {
          id: 'cost_adverse',
          title: 'Tekanan Biaya (Skenario Buruk)',
          type,
          parameters: {
            materialCostChangePercent: Math.max(2, Math.abs(material)),
            laborCostChangePercent: Math.max(2, Math.abs(labor)),
            operationalEfficiency: clamp(efficiency - 0.05, 0.4, 3),
          },
        },
      ];
    }

    default: {
      const monthlyExpense = num(a.additionalMonthlyExpense, 0);
      const capex = Math.max(0, num(a.oneTimeCapex, 0));
      const revenueDelta = num(a.expectedRevenueDeltaPercent, 0) + num(a.marketingBudgetDeltaPercent, 0);

      return [
        {
          id: 'custom_status_quo',
          title: 'Status Quo',
          type: 'custom',
          parameters: { additionalMonthlyExpense: 0, oneTimeCapex: 0, expectedRevenueDeltaPercent: 0 },
        },
        {
          id: 'custom_plan',
          title: 'Skenario Sesuai Input',
          type: 'custom',
          parameters: {
            additionalMonthlyExpense: monthlyExpense,
            oneTimeCapex: capex,
            expectedRevenueDeltaPercent: revenueDelta,
          },
        },
        {
          id: 'custom_aggressive',
          title: 'Skenario Ekspansif (+50%)',
          type: 'custom',
          parameters: {
            additionalMonthlyExpense: monthlyExpense * 1.5,
            oneTimeCapex: capex * 1.25,
            expectedRevenueDeltaPercent: revenueDelta * 1.5,
          },
        },
      ];
    }
  }
}

function defaultSalaryFor(baseline: DecisionBaseline): number {
  // 18% dari biaya operasional bulanan dibagi jumlah tim aktif, dijepit ke
  // rentang gaji wajar agar tidak absurd ketika data belum lengkap.
  const perHead = safeDivide(baseline.monthlyExpense * 0.18, Math.max(1, baseline.teamMemberCount)) ?? 0;
  return clamp(perHead, 3_000_000, 25_000_000);
}

function methodLabel(method: FinancingMethod): string {
  if (method === 'installment') return 'angsuran';
  if (method === 'lease') return 'leasing';
  return 'tunai';
}

/** Elastisitas harga sederhana: -1.2 (permintaan elastis). */
function defaultVolumeImpact(priceChangePercent: number): number {
  return clamp(1 + (priceChangePercent / 100) * -1.2, 0.05, 5);
}

/* ------------------------------------------------------------------ */
/* Simulasi per tipe                                                   */
/* ------------------------------------------------------------------ */

interface RawSimulation {
  monthlyGrossProfitImpact: number;
  monthlyNetProfitImpact: number;
  upfrontCashOutflow: number;
  monthlyCashOutflow: number;
  newGrossMarginPercent: number;
  annualROI: number | null;
  paybackMonths: number | null;
  detail: Record<string, number | null>;
  extraRiskReasons?: string[];
}

function simulateHiring(baseline: DecisionBaseline, params: DecisionScenarioParameters): RawSimulation {
  const count = Math.max(0, num(params.hiringCount, 0));
  const salary = Math.max(0, num(params.averageSalary, 0));
  const onboarding = Math.max(0, num(params.onboardingCost, 0));
  const productivity = Math.max(0, num(params.productivityImpact, 0));

  const additionalRevenue = baseline.monthlyRevenue * productivity;
  const additionalGrossProfit = additionalRevenue * (baseline.grossMarginPercent / 100);
  const monthlySalaryCost = count * salary;
  const monthlyOnboardingAmortized = safeDivide(count * onboarding, 12) ?? 0;

  const monthlyNetProfitImpact = additionalGrossProfit - monthlySalaryCost - monthlyOnboardingAmortized;
  const upfrontCashOutflow = count * onboarding;
  const annualCost = monthlySalaryCost * 12;
  const annualROI = annualCost > 0 ? safeDivide((additionalGrossProfit - monthlySalaryCost) * 12, annualCost) : null;

  const netCashPerMonth = additionalGrossProfit - monthlySalaryCost;
  const paybackMonths = upfrontCashOutflow <= 0
    ? (netCashPerMonth >= 0 ? 0 : null)
    : (netCashPerMonth > 0 ? Math.ceil(upfrontCashOutflow / netCashPerMonth) : null);

  return {
    // Ini dampak INKREMENTAL: status quo = 0, bukan -COGS.
    monthlyGrossProfitImpact: additionalGrossProfit,
    monthlyNetProfitImpact,
    upfrontCashOutflow,
    monthlyCashOutflow: monthlySalaryCost,
    newGrossMarginPercent: baseline.grossMarginPercent,
    annualROI: round(annualROI, 4),
    paybackMonths,
    detail: {
      additionalRevenue: Math.round(additionalRevenue),
      monthlySalaryCost: Math.round(monthlySalaryCost),
      annualSalaryCost: Math.round(annualCost),
      revenuePerAddedEmployee: count > 0 ? Math.round(safeDivide(additionalRevenue, count) ?? 0) : 0,
      totalHeadcount: baseline.teamMemberCount + count,
    },
  };
}

function simulateAsset(baseline: DecisionBaseline, params: DecisionScenarioParameters): RawSimulation {
  const cost = Math.max(0, num(params.assetCost, 0));
  const years = clamp(Math.round(num(params.depreciationPeriodYears, 5)), 1, 20);
  const roi = clamp(num(params.expectedROI, 0), 0, 2);
  const method = (String(params.financingMethod || 'cash') as FinancingMethod);

  const months = years * 12;
  const annualReturn = cost * roi;
  const monthlyReturn = annualReturn / 12;
  const monthlyDepreciation = safeDivide(cost, months) ?? 0;

  // Bunga flat tahunan: tunai 0%, angsuran 6%, leasing 8%.
  const annualRate = method === 'installment' ? 0.06 : method === 'lease' ? 0.08 : 0;
  const totalFinanced = cost * (1 + annualRate * years);
  const monthlyPayment = method === 'cash' ? 0 : (safeDivide(totalFinanced, months) ?? 0);
  const upfrontCashOutflow = method === 'cash' ? cost : 0;
  const financingCost = totalFinanced - cost;

  // Laba: return - penyusutan - bunga (bunga = pembayaran - pokok).
  const monthlyPrincipal = safeDivide(cost, months) ?? 0;
  const monthlyInterest = Math.max(0, monthlyPayment - monthlyPrincipal);
  const monthlyNetProfitImpact = monthlyReturn - monthlyDepreciation - monthlyInterest;

  const netCashPerMonth = monthlyReturn - monthlyPayment;
  const paybackMonths = upfrontCashOutflow > 0
    ? (netCashPerMonth > 0 ? Math.ceil(upfrontCashOutflow / netCashPerMonth) : null)
    : (netCashPerMonth >= 0 ? 0 : null);

  const npv = annualReturn * years - totalFinanced;

  return {
    monthlyGrossProfitImpact: monthlyReturn,
    monthlyNetProfitImpact,
    upfrontCashOutflow,
    monthlyCashOutflow: monthlyPayment,
    newGrossMarginPercent: baseline.grossMarginPercent,
    annualROI: round(safeDivide(annualReturn, cost), 4),
    paybackMonths,
    detail: {
      assetCost: Math.round(cost),
      annualDepreciation: Math.round(cost / years),
      monthlyDepreciation: Math.round(monthlyDepreciation),
      monthlyReturn: Math.round(monthlyReturn),
      monthlyPayment: Math.round(monthlyPayment),
      financingCost: Math.round(financingCost),
      npv: Math.round(npv),
      npvMarginPercent: round(safeDivide(npv, cost) !== null ? (safeDivide(npv, cost) as number) * 100 : null, 1),
    },
    extraRiskReasons: method !== 'cash' && monthlyPayment > 0
      ? [`Komitmen angsuran Rp ${Math.round(monthlyPayment).toLocaleString('id-ID')}/bulan selama ${months} bulan.`]
      : [],
  };
}

function simulatePricing(baseline: DecisionBaseline, params: DecisionScenarioParameters): RawSimulation {
  const changePercent = clamp(num(params.priceChangePercent, 0), -90, 500);
  const volume = clamp(num(params.volumeChangeImpact, 1), 0.05, 5);
  const competitive = Boolean(params.competitiveResponse);

  const priceMultiplier = 1 + changePercent / 100;
  const cogsBase = baselineCogs(baseline);

  const newRevenue = baseline.monthlyRevenue * priceMultiplier * volume;
  const newCogs = cogsBase * volume; // biaya variabel ikut volume
  const newGrossProfit = newRevenue - newCogs;
  const baseGrossProfit = baseline.monthlyRevenue - cogsBase;

  // Anggaran pemasaran tambahan bila kompetitor bereaksi.
  const marketingCost = competitive ? baseline.monthlyRevenue * 0.02 : 0;

  const monthlyGrossProfitImpact = newGrossProfit - baseGrossProfit;
  const monthlyNetProfitImpact = monthlyGrossProfitImpact - marketingCost;
  const newGrossMarginPercent = newRevenue > 0 ? (newGrossProfit / newRevenue) * 100 : 0;

  const marginChangePoints = newGrossMarginPercent - baseline.grossMarginPercent;
  const breakEvenAdditionalRevenue = newGrossMarginPercent > 0
    ? safeDivide(marketingCost, newGrossMarginPercent / 100)
    : null;

  const annualROI = safeDivide(monthlyNetProfitImpact * 12, Math.max(1, marketingCost * 12));

  return {
    monthlyGrossProfitImpact,
    monthlyNetProfitImpact,
    upfrontCashOutflow: 0,
    monthlyCashOutflow: marketingCost,
    newGrossMarginPercent,
    annualROI: marketingCost > 0 ? round(annualROI, 4) : null,
    paybackMonths: monthlyNetProfitImpact >= 0 ? 0 : null,
    detail: {
      newRevenue: Math.round(newRevenue),
      revenueChange: Math.round(newRevenue - baseline.monthlyRevenue),
      revenueChangePercent: round(safeDivide(newRevenue - baseline.monthlyRevenue, baseline.monthlyRevenue) !== null
        ? (safeDivide(newRevenue - baseline.monthlyRevenue, baseline.monthlyRevenue) as number) * 100
        : null, 1),
      marketingCost: Math.round(marketingCost),
      breakEvenAdditionalRevenue: breakEvenAdditionalRevenue === null ? null : Math.round(breakEvenAdditionalRevenue),
      impliedPriceElasticity: changePercent !== 0 ? round(safeDivide(volume - 1, changePercent / 100), 2) : null,
      marginChangePoints: round(marginChangePoints, 1),
    },
    extraRiskReasons: marketingCost > 0
      ? [`Respons kompetitor mengasumsikan tambahan biaya pemasaran Rp ${Math.round(marketingCost).toLocaleString('id-ID')}/bulan.`]
      : [],
  };
}

function simulateCost(baseline: DecisionBaseline, params: DecisionScenarioParameters): RawSimulation {
  const materialChange = clamp(num(params.materialCostChangePercent, 0), -100, 200);
  const laborChange = clamp(num(params.laborCostChangePercent, 0), -100, 200);
  const efficiency = clamp(num(params.operationalEfficiency, 1), 0.1, 10);

  const cogsBase = baselineCogs(baseline);
  // Struktur biaya tipikal: bahan 60%, tenaga kerja 30%, overhead 10%.
  const materialBase = cogsBase * 0.6;
  const laborBase = cogsBase * 0.3;
  const overheadBase = cogsBase * 0.1;

  const newMaterial = materialBase * (1 + materialChange / 100);
  const newLabor = laborBase * (1 + laborChange / 100);
  // Efisiensi > 1 menurunkan overhead, < 1 menaikkannya.
  const newOverhead = overheadBase / Math.max(0.1, efficiency);
  const newCogs = newMaterial + newLabor + newOverhead;

  const savings = cogsBase - newCogs;
  const newGrossMarginPercent = baseline.monthlyRevenue > 0
    ? ((baseline.monthlyRevenue - newCogs) / baseline.monthlyRevenue) * 100
    : 0;

  return {
    monthlyGrossProfitImpact: savings,
    monthlyNetProfitImpact: savings,
    upfrontCashOutflow: 0,
    monthlyCashOutflow: 0,
    newGrossMarginPercent,
    annualROI: safeDivide(savings * 12, Math.max(1, cogsBase)) !== null
      ? round((safeDivide(savings * 12, Math.max(1, cogsBase)) as number), 4)
      : null,
    paybackMonths: savings >= 0 ? 0 : null,
    detail: {
      oldCogs: Math.round(cogsBase),
      newCogs: Math.round(newCogs),
      monthlySavings: Math.round(savings),
      savingsPercent: round(safeDivide(savings, cogsBase) !== null ? (safeDivide(savings, cogsBase) as number) * 100 : null, 1),
      materialCost: Math.round(newMaterial),
      laborCost: Math.round(newLabor),
      overheadCost: Math.round(newOverhead),
      marginChangePoints: round(newGrossMarginPercent - baseline.grossMarginPercent, 1),
    },
  };
}

function simulateCustom(baseline: DecisionBaseline, params: DecisionScenarioParameters): RawSimulation {
  const extraExpense = num(params.additionalMonthlyExpense, 0);
  const capex = Math.max(0, num(params.oneTimeCapex, 0));
  const revenueDeltaPercent = num(params.expectedRevenueDeltaPercent, 0);

  const newRevenue = baseline.monthlyRevenue * (1 + revenueDeltaPercent / 100);
  const grossProfitDelta = (newRevenue - baseline.monthlyRevenue) * (baseline.grossMarginPercent / 100);
  const monthlyNetProfitImpact = grossProfitDelta - extraExpense;
  const netCashPerMonth = monthlyNetProfitImpact;
  const paybackMonths = capex > 0
    ? (netCashPerMonth > 0 ? Math.ceil(capex / netCashPerMonth) : null)
    : (netCashPerMonth >= 0 ? 0 : null);

  return {
    monthlyGrossProfitImpact: grossProfitDelta,
    monthlyNetProfitImpact,
    upfrontCashOutflow: capex,
    monthlyCashOutflow: Math.max(0, extraExpense),
    newGrossMarginPercent: baseline.grossMarginPercent,
    annualROI: safeDivide(monthlyNetProfitImpact * 12, Math.max(1, capex + Math.max(0, extraExpense) * 12)) !== null
      ? round((safeDivide(monthlyNetProfitImpact * 12, Math.max(1, capex + Math.max(0, extraExpense) * 12)) as number), 4)
      : null,
    paybackMonths,
    detail: {
      revenueChange: Math.round(newRevenue - baseline.monthlyRevenue),
      additionalMonthlyExpense: Math.round(extraExpense),
      oneTimeCapex: Math.round(capex),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Risiko, skor, strategic fit                                         */
/* ------------------------------------------------------------------ */

interface RiskAssessment {
  level: DecisionRiskLevel;
  score: number; // 0 = paling berisiko, 100 = paling aman
  reasons: string[];
}

/**
 * Model risiko ternormalisasi. Semua komponen dihitung relatif terhadap
 * kondisi perusahaan (kas, laba, margin) sehingga setara antar tipe skenario.
 */
function assessRisk(baseline: DecisionBaseline, sim: RawSimulation): RiskAssessment {
  const reasons: string[] = [];
  let riskPoints = 0; // 0 (aman) .. 100 (kritis)

  // 1. Dampak laba bulanan relatif terhadap laba bersih saat ini.
  const profitBase = Math.max(1, Math.abs(baseline.monthlyNetProfit) || baseline.monthlyRevenue * 0.1);
  const profitRatio = sim.monthlyNetProfitImpact / profitBase;

  if (sim.monthlyNetProfitImpact < 0) {
    // Rugi bulanan selalu menambah risiko dasar, lalu diskalakan terhadap
    // besarnya kerugian relatif terhadap laba perusahaan.
    const severity = 18 + clamp(-profitRatio * 120, 0, 45);
    riskPoints += clamp(severity, 0, 60);
    reasons.push(`Laba bulanan turun Rp ${Math.abs(Math.round(sim.monthlyNetProfitImpact)).toLocaleString('id-ID')} (${Math.round((profitRatio) * 100)}% dari laba dasar).`);
  } else if (sim.monthlyNetProfitImpact > 0) {
    riskPoints -= clamp(profitRatio * 40, 0, 30);
  }

  // 2. Kas di muka relatif terhadap kas likuid.
  if (sim.upfrontCashOutflow > 0 && baseline.liquidCash > 0) {
    const cashUse = sim.upfrontCashOutflow / baseline.liquidCash;
    riskPoints += clamp(cashUse * 80, 0, 60);
    reasons.push(`Memakai ${Math.round(cashUse * 100)}% kas likuid di muka.`);
  } else if (sim.upfrontCashOutflow > 0 && baseline.liquidCash <= 0) {
    riskPoints += 60;
    reasons.push('Kas likuid tidak tersedia, belanja modal harus dibiayai dari luar.');
  }

  // 3. Payback period.
  if (sim.upfrontCashOutflow > 0) {
    if (sim.paybackMonths === null) {
      riskPoints += 40;
      reasons.push('Biaya di muka tidak kembali dalam horizon mana pun (payback tak tercapai).');
    } else if (sim.paybackMonths > 24) {
      riskPoints += 30;
      reasons.push(`Payback ${sim.paybackMonths} bulan (> 24 bulan).`);
    } else if (sim.paybackMonths > 12) {
      riskPoints += 15;
      reasons.push(`Payback ${sim.paybackMonths} bulan (> 12 bulan).`);
    }
  }

  // 4. Margin kotor setelah skenario.
  if (sim.newGrossMarginPercent < 15) {
    riskPoints += clamp((15 - sim.newGrossMarginPercent) * 2, 0, 30);
    reasons.push(`Margin kotor turun ke ${round(sim.newGrossMarginPercent, 1)}%.`);
  }

  // 5. Komitmen bulanan terhadap laba.
  if (sim.monthlyCashOutflow > 0) {
    const commitment = sim.monthlyCashOutflow / Math.max(1, baseline.monthlyRevenue);
    if (commitment > 0.25) {
      riskPoints += clamp((commitment - 0.25) * 100, 0, 25);
      reasons.push(`Komitmen bulanan Rp ${Math.round(sim.monthlyCashOutflow).toLocaleString('id-ID')} (${Math.round(commitment * 100)}% pendapatan).`);
    }
  }

  // 6. Runway setelah skenario.
  const netBurn = baseline.monthlyBurnRate - sim.monthlyNetProfitImpact;
  if (netBurn > 0 && baseline.liquidCash > 0) {
    const runwayAfter = baseline.liquidCash / netBurn;
    if (runwayAfter < 3) {
      riskPoints += clamp((3 - runwayAfter) * 10, 0, 30);
      reasons.push(`Runway setelah skenario hanya ${round(runwayAfter, 1)} bulan.`);
    }
  }

  if (sim.extraRiskReasons) reasons.push(...sim.extraRiskReasons);

  const riskPointsClamped = clamp(riskPoints, 0, 100);
  const safetyScore = 100 - riskPointsClamped;

  let level: DecisionRiskLevel;
  if (safetyScore >= 75) level = 'LOW';
  else if (safetyScore >= 50) level = 'MODERATE';
  else if (safetyScore >= 25) level = 'HIGH';
  else level = 'CRITICAL';

  if (reasons.length === 0) reasons.push('Tidak ada tekanan berarti pada laba, kas, atau margin.');

  return { level, score: Math.round(safetyScore), reasons };
}

/** Skor kelayakan 0-100. Bobot mengikuti prioritas bisnis: laba & kas dulu. */
function computeScenarioScore(baseline: DecisionBaseline, sim: RawSimulation, risk: RiskAssessment): number {
  const profitBase = Math.max(1, Math.abs(baseline.monthlyNetProfit) || baseline.monthlyRevenue * 0.1);
  const profitComponent = clamp(50 + (sim.monthlyNetProfitImpact / profitBase) * 50, 0, 100);

  const cashComponent = clamp(100 - (safeDivide(sim.upfrontCashOutflow, Math.max(1, baseline.liquidCash)) ?? 0) * 100, 0, 100);

  const paybackComponent = sim.upfrontCashOutflow <= 0
    ? (sim.monthlyNetProfitImpact >= 0 ? 100 : 40)
    : sim.paybackMonths === null
      ? 0
      : clamp(100 - (sim.paybackMonths / 36) * 100, 0, 100);

  const marginComponent = clamp(sim.newGrossMarginPercent, 0, 100);

  const score =
    profitComponent * 0.35 +
    cashComponent * 0.2 +
    paybackComponent * 0.2 +
    risk.score * 0.15 +
    marginComponent * 0.1;

  return Math.round(clamp(score, 0, 100) * 10) / 10;
}

function buildStrategicFit(
  type: DecisionScenarioType,
  baseline: DecisionBaseline,
  sim: RawSimulation,
  risk: RiskAssessment
): DecisionScenarioResult['strategicFit'] {
  const factors: DecisionStrategicFitFactor[] = [];

  const profitBase = Math.max(1, Math.abs(baseline.monthlyNetProfit) || baseline.monthlyRevenue * 0.1);
  factors.push({
    factor: 'profitability',
    label: 'Dampak laba',
    score: Math.round(clamp(50 + (sim.monthlyNetProfitImpact / profitBase) * 50, 0, 100)),
    weight: 0.35,
  });

  factors.push({
    factor: 'cash_safety',
    label: 'Keamanan kas',
    score: Math.round(clamp(100 - (safeDivide(sim.upfrontCashOutflow, Math.max(1, baseline.liquidCash)) ?? 0) * 100, 0, 100)),
    weight: 0.25,
  });

  factors.push({
    factor: 'margin',
    label: 'Margin kotor',
    score: Math.round(clamp(sim.newGrossMarginPercent * 2, 0, 100)),
    weight: 0.2,
  });

  factors.push({
    factor: 'risk',
    label: 'Profil risiko',
    score: risk.score,
    weight: 0.2,
  });

  const score = Math.round(factors.reduce((sum, f) => sum + f.score * f.weight, 0));

  return {
    score,
    factors,
    recommendations: scenarioRecommendations(type),
  };
}

function scenarioRecommendations(type: DecisionScenarioType): string[] {
  switch (type) {
    case 'employee_hiring':
      return [
        'Rekrut bertahap (fase 1 lalu evaluasi 3 bulan) untuk menjaga kas.',
        'Tetapkan target produktivitas terukur sebelum menambah headcount berikutnya.',
        'Siapkan biaya onboarding dan peralatan kerja di anggaran kas bulan pertama.',
      ];
    case 'asset_purchase':
      return [
        'Bandingkan opsi tunai vs angsuran: tunai menghemat bunga, angsuran menjaga kas.',
        'Minta minimal 2 penawaran harga dan pastikan biaya pemeliharaan masuk perhitungan.',
        'Validasi asumsi ROI dengan data historis, bukan proyeksi optimistis.',
      ];
    case 'pricing_change':
      return [
        'Uji perubahan harga pada segmen pelanggan kecil sebelum rollout penuh.',
        'Siapkan skenario respons kompetitor dan batas diskon maksimum.',
        'Pantau volume dan margin mingguan selama 4-8 minggu pertama.',
      ];
    case 'cost_change':
      return [
        'Negosiasi ulang kontrak pemasok sebelum menargetkan penurunan biaya bahan.',
        'Hindari pemangkasan biaya yang menurunkan kualitas layanan pelanggan.',
        'Ukur realisasi penghematan setiap bulan terhadap target.',
      ];
    default:
      return [
        'Pastikan asumsi pendapatan memiliki dasar data, bukan target aspiratif.',
        'Pisahkan belanja modal dari biaya operasional dalam proyeksi kas.',
        'Tinjau ulang skenario setiap bulan seiring realisasi aktual.',
      ];
  }
}

const IMPLEMENTATION_MONTHS: Record<DecisionScenarioType, number> = {
  employee_hiring: 2,
  asset_purchase: 3,
  pricing_change: 1,
  cost_change: 2,
  custom: 2,
};

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function runEnhancedFinancialDecisionSimulation(
  context: BusinessContextSnapshot,
  input: DecisionSimulationInput,
  overrideScenarios?: InternalScenario[]
): DecisionSimulationResult {
  const baseline = buildBaseline(context);
  const scenarioType: DecisionScenarioType =
    input.adjustments?.scenarioType ?? detectScenarioType(input.promptDescription || '');
  const adjustments = input.adjustments ?? {};
  const horizonMonths = clamp(Math.round(num(adjustments.durationMonths, 12)), 1, 60);

  const scenarios = overrideScenarios ?? buildScenarios(baseline, scenarioType, adjustments);

  const results: DecisionScenarioResult[] = scenarios.map((scenario) => {
    let sim: RawSimulation;
    switch (scenario.type) {
      case 'employee_hiring':
        sim = simulateHiring(baseline, scenario.parameters);
        break;
      case 'asset_purchase':
        sim = simulateAsset(baseline, scenario.parameters);
        break;
      case 'pricing_change':
        sim = simulatePricing(baseline, scenario.parameters);
        break;
      case 'cost_change':
        sim = simulateCost(baseline, scenario.parameters);
        break;
      default:
        sim = simulateCustom(baseline, scenario.parameters);
    }

    const risk = assessRisk(baseline, sim);
    const netBurnAfter = baseline.monthlyBurnRate - sim.monthlyNetProfitImpact;
    const projectedRunwayMonths = netBurnAfter > 0
      ? round(baseline.liquidCash / netBurnAfter, 1)
      : null;

    return {
      id: scenario.id,
      title: scenario.title,
      type: scenario.type,
      parameters: scenario.parameters,
      metrics: {
        monthlyGrossProfitImpact: Math.round(sim.monthlyGrossProfitImpact),
        monthlyNetProfitImpact: Math.round(sim.monthlyNetProfitImpact),
        firstMonthCashFlowImpact: Math.round(sim.monthlyNetProfitImpact - sim.upfrontCashOutflow),
        upfrontCashOutflow: Math.round(sim.upfrontCashOutflow),
        monthlyCashOutflow: Math.round(sim.monthlyCashOutflow),
        marginChangePoints: round(sim.newGrossMarginPercent - baseline.grossMarginPercent, 1) ?? 0,
        newGrossMarginPercent: round(sim.newGrossMarginPercent, 1) ?? 0,
        annualROI: sim.annualROI,
        paybackMonths: sim.paybackMonths,
        projectedRunwayMonths,
        cashOutWithinHorizon: projectedRunwayMonths !== null && projectedRunwayMonths < horizonMonths,
        detail: sim.detail,
      },
      riskLevel: risk.level,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      score: computeScenarioScore(baseline, sim, risk),
      rank: 0,
      strategicFit: buildStrategicFit(scenario.type, baseline, sim, risk),
    };
  });

  const ranked = [...results].sort((a, b) => b.score - a.score).map((r, i) => ({ ...r, rank: i + 1 }));

  const riskDistribution: Record<DecisionRiskLevel, number> = { LOW: 0, MODERATE: 0, HIGH: 0, CRITICAL: 0 };
  results.forEach((r) => { riskDistribution[r.riskLevel] += 1; });

  // Ambil dari `ranked` supaya objek yang dikembalikan sudah membawa `rank`.
  const byROI = [...ranked].sort(
    (a, b) => (b.metrics.annualROI ?? Number.NEGATIVE_INFINITY) - (a.metrics.annualROI ?? Number.NEGATIVE_INFINITY)
  );
  const byFirstMonthCash = [...ranked].sort((a, b) => b.metrics.firstMonthCashFlowImpact - a.metrics.firstMonthCashFlowImpact);
  const byMargin = [...ranked].sort((a, b) => b.metrics.marginChangePoints - a.metrics.marginChangePoints);

  const comparison: DecisionScenarioComparison = {
    totalScenarios: results.length,
    rankedScenarios: ranked,
    bestROI: byROI[0] ?? null,
    bestCashFlow: byFirstMonthCash[0] ?? null,
    bestMargin: byMargin[0] ?? null,
    riskDistribution,
  };

  const recommendations = buildRecommendations(ranked, scenarioType);

  const top = ranked[0] ?? null;
  const summary = top
    ? `${results.length} skenario dianalisis untuk ${context.workspaceName || 'workspace ini'}. ` +
      `Peringkat 1: "${top.title}" dengan skor ${top.score}/100, risiko ${riskLabelId(top.riskLevel)}, ` +
      `dampak laba ${formatSigned(top.metrics.monthlyNetProfitImpact)} per bulan.`
    : `Tidak ada skenario yang dapat dianalisis untuk ${context.workspaceName || 'workspace ini'}.`;

  return {
    scenarioType,
    scenarioTitle: input.scenarioTitle || top?.title || 'Analisis Keputusan Finansial',
    summary,
    baseline,
    scenarioResults: ranked,
    comparison,
    recommendations,
    overallRiskLevel: top?.riskLevel ?? 'MODERATE',
    horizonMonths,
    generatedAt: new Date().toISOString(),
  };
}

function buildRecommendations(
  ranked: DecisionScenarioResult[],
  type: DecisionScenarioType
): DecisionRecommendation[] {
  const out: DecisionRecommendation[] = [];
  const top = ranked[0];

  if (top) {
    out.push({
      title: 'Jalankan skenario peringkat 1',
      scenarioId: top.id,
      reason: `Skor ${top.score}/100 dengan risiko ${riskLabelId(top.riskLevel)}. ${top.riskReasons[0] || ''}`.trim(),
      priority: top.riskLevel === 'CRITICAL' ? 'MEDIUM' : 'HIGH',
      implementationMonths: IMPLEMENTATION_MONTHS[type],
    });
  }

  const safe = ranked
    .filter((r) => r.riskLevel === 'LOW' || r.riskLevel === 'MODERATE')
    .filter((r) => r.metrics.monthlyNetProfitImpact > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (safe && safe.id !== top?.id) {
    out.push({
      title: 'Opsi aman sebagai pembanding',
      scenarioId: safe.id,
      reason: `Risiko ${riskLabelId(safe.riskLevel)} dengan dampak laba ${formatSigned(safe.metrics.monthlyNetProfitImpact)} per bulan.`,
      priority: 'MEDIUM',
      implementationMonths: IMPLEMENTATION_MONTHS[type],
    });
  }

  ranked.forEach((r) => {
    if (r.metrics.paybackMonths !== null && r.metrics.paybackMonths > 12) {
      out.push({
        title: 'Perhatikan periode pengembalian modal',
        scenarioId: r.id,
        reason: `"${r.title}" butuh ${r.metrics.paybackMonths} bulan untuk kembali modal. Siapkan buffer kas untuk periode tersebut.`,
        priority: 'MEDIUM',
        implementationMonths: IMPLEMENTATION_MONTHS[type],
      });
    }
  });

  // Runway adalah kondisi baseline yang sama untuk semua skenario, jadi cukup
  // satu peringatan (skenario dengan runway terpendek) agar tidak berulang.
  const tightestRunway = ranked
    .filter((r) => r.metrics.projectedRunwayMonths !== null)
    .sort((a, b) => (a.metrics.projectedRunwayMonths as number) - (b.metrics.projectedRunwayMonths as number))[0];

  if (tightestRunway && (tightestRunway.metrics.projectedRunwayMonths as number) < 6) {
    out.push({
      title: 'Peringatan runway kas',
      scenarioId: tightestRunway.id,
      reason: `Setelah skenario "${tightestRunway.title}", runway kas tersisa ${tightestRunway.metrics.projectedRunwayMonths} bulan. Siapkan rencana pendanaan atau tunda belanja modal.`,
      priority: 'HIGH',
      implementationMonths: IMPLEMENTATION_MONTHS[type],
    });
  }

  return out;
}

function riskLabelId(level: DecisionRiskLevel): string {
  switch (level) {
    case 'LOW': return 'rendah';
    case 'MODERATE': return 'sedang';
    case 'HIGH': return 'tinggi';
    default: return 'kritis';
  }
}

function formatSigned(value: number): string {
  const sign = value >= 0 ? '+' : '-';
  return `${sign}Rp ${Math.abs(Math.round(value)).toLocaleString('id-ID')}`;
}

export { MONTH_NAMES };
