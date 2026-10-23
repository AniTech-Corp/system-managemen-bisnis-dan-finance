import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  runEnhancedFinancialDecisionSimulation,
  type DecisionSimulationInput,
  type DecisionSimulationResult,
  type DecisionScenarioType,
} from '../src/lib/ai-brain/simulator-engine-enhanced';
import type { BusinessContextSnapshot } from '../src/lib/ai-brain/types';

/**
 * Fixture minimal. Field yang tidak dipakai engine tetap diisi bentuk yang
 * benar supaya tes tidak bergantung pada `any`.
 */
function makeContext(overrides: Partial<BusinessContextSnapshot['financials']> = {}): BusinessContextSnapshot {
  return {
    workspaceId: 'ws-test',
    workspaceName: 'PT Uji Coba',
    generatedAt: new Date('2026-10-01T00:00:00.000Z').toISOString(),
    cacheTtlSeconds: 300,
    teamMemberCount: 10,
    financials: {
      liquidCash: 500_000_000,
      totalIncome30d: 300_000_000,
      totalExpense30d: 240_000_000,
      netCashflow30d: 60_000_000,
      monthlyBurnRate: 240_000_000,
      runwayMonths: 2.08,
      totalUnpaidInvoices: 0,
      unpaidInvoicesCount: 0,
      overdueInvoicesCount: 0,
      opEx30d: 200_000_000,
      capEx30d: 40_000_000,
      grossMarginPercent: 40,
      ...overrides,
    },
    marketing: {
      activeCampaignsCount: 0,
      activeCouponsCount: 0,
      couponRedemptions30d: 0,
      estimatedMarketingSpend30d: 0,
      attributedRevenue30d: 0,
      estimatedROAS: 0,
      estimatedCAC: 0,
    },
    operations: {
      totalTasks: 0,
      completedTasks: 0,
      inProgressTasks: 0,
      todoTasks: 0,
      completionRatePercent: 0,
      overdueTasksCount: 0,
    },
    strategy: {
      corplanProjectsCount: 0,
      strategicPillarsDefined: false,
      primaryIndustry: 'retail',
      targetMarket: 'B2B',
      hasActiveOKRs: false,
    },
    healthScore: {
      totalScore: 60,
      grade: 'HEALTHY',
      breakdown: {
        financeScore: 60,
        growthScore: 60,
        opsScore: 60,
        strategyScore: 60,
      },
      keyRisks: [],
      keyStrengths: [],
    },
  } as unknown as BusinessContextSnapshot;
}

function run(
  type: DecisionScenarioType,
  adjustments: DecisionSimulationInput['adjustments'] = {},
  context = makeContext()
): DecisionSimulationResult {
  return runEnhancedFinancialDecisionSimulation(context, {
    workspaceId: 'ws-test',
    promptDescription: `simulasi ${type}`,
    scenarioTitle: `Uji ${type}`,
    adjustments: { scenarioType: type, durationMonths: 12, ...adjustments },
  });
}

const ALL_TYPES: DecisionScenarioType[] = [
  'employee_hiring',
  'asset_purchase',
  'pricing_change',
  'cost_change',
  'custom',
];

function assertNoInvalidNumbers(result: DecisionSimulationResult) {
  for (const scenario of result.scenarioResults) {
    const m = scenario.metrics;
    const numericFields = [
      m.monthlyGrossProfitImpact,
      m.monthlyNetProfitImpact,
      m.firstMonthCashFlowImpact,
      m.upfrontCashOutflow,
      m.monthlyCashOutflow,
      m.marginChangePoints,
      m.newGrossMarginPercent,
    ];
    for (const value of numericFields) {
      assert.ok(Number.isFinite(value), `metrik ${scenario.id} harus finite, dapat ${value}`);
    }
    for (const [key, value] of Object.entries(m.detail)) {
      assert.ok(
        value === null || Number.isFinite(value),
        `detail ${scenario.id}.${key} tidak boleh NaN/Infinity, dapat ${value}`
      );
    }
    assert.ok(scenario.riskScore >= 0 && scenario.riskScore <= 100, 'riskScore harus 0-100');
    assert.ok(scenario.score >= 0 && scenario.score <= 100, 'score harus 0-100');
  }
}

describe('AI Financial Decision Simulator — engine', () => {
  test('deterministik: input sama menghasilkan output identik', () => {
    const adjustments = {
      scenarioType: 'employee_hiring' as const,
      hiringCount: 3,
      averageSalary: 8_000_000,
      onboardingCost: 1_500_000,
      productivityImpact: 0.2,
    };
    const first = run('employee_hiring', adjustments);
    const second = run('employee_hiring', adjustments);
    assert.deepEqual(
      first.scenarioResults.map((s) => [s.id, s.score, s.riskLevel, s.metrics.monthlyNetProfitImpact]),
      second.scenarioResults.map((s) => [s.id, s.score, s.riskLevel, s.metrics.monthlyNetProfitImpact])
    );
  });

  test('semua tipe skenario menghasilkan angka valid (tanpa NaN/Infinity)', () => {
    for (const type of ALL_TYPES) {
      assertNoInvalidNumbers(run(type));
    }
  });

  test('margin kotor 0 pada context tidak membuat pembagian nol', () => {
    const context = makeContext({ grossMarginPercent: 0 });
    for (const type of ALL_TYPES) {
      const result = run(type, {}, context);
      assertNoInvalidNumbers(result);
      assert.ok(result.baseline.grossMarginPercent > 0, 'margin fallback harus > 0');
    }
  });

  test('pendapatan 0 dan kas 0 tetap aman', () => {
    const context = makeContext({
      totalIncome30d: 0,
      totalExpense30d: 0,
      liquidCash: 0,
      monthlyBurnRate: 0,
      runwayMonths: 0,
      grossMarginPercent: 0,
    });
    for (const type of ALL_TYPES) {
      assertNoInvalidNumbers(run(type, {}, context));
    }
  });

  test('rekrutmen: gaji lebih tinggi menurunkan dampak laba', () => {
    const cheap = run('employee_hiring', {
      hiringCount: 2,
      averageSalary: 5_000_000,
      onboardingCost: 1_000_000,
      productivityImpact: 0.2,
    });
    const expensive = run('employee_hiring', {
      hiringCount: 2,
      averageSalary: 15_000_000,
      onboardingCost: 1_000_000,
      productivityImpact: 0.2,
    });
    const cheapPlan = cheap.scenarioResults.find((s) => s.id === 'hiring_plan')!;
    const expensivePlan = expensive.scenarioResults.find((s) => s.id === 'hiring_plan')!;
    assert.ok(expensivePlan.metrics.monthlyNetProfitImpact < cheapPlan.metrics.monthlyNetProfitImpact);
    assert.equal(cheapPlan.metrics.upfrontCashOutflow, 2 * 1_000_000);
  });

  test('rekrutmen: jumlah karyawan mengikuti input', () => {
    const result = run('employee_hiring', { hiringCount: 4 });
    const plan = result.scenarioResults.find((s) => s.id === 'hiring_plan')!;
    assert.equal(plan.parameters.hiringCount, 4);
    assert.equal(plan.metrics.detail.totalHeadcount, 14);
  });

  test('aset: tunai vs angsuran berbeda pada kas di muka', () => {
    const cash = run('asset_purchase', { assetCost: 200_000_000, financingMethod: 'cash', expectedROI: 0.2 });
    const installment = run('asset_purchase', { assetCost: 200_000_000, financingMethod: 'installment', expectedROI: 0.2 });

    const cashPlan = cash.scenarioResults.find((s) => s.id === 'asset_plan')!;
    const installmentPlan = installment.scenarioResults.find((s) => s.id === 'asset_plan')!;

    assert.equal(cashPlan.metrics.upfrontCashOutflow, 200_000_000);
    assert.equal(installmentPlan.metrics.upfrontCashOutflow, 0);
    assert.ok(installmentPlan.metrics.monthlyCashOutflow > 0);
    // Angsuran: tidak ada modal di muka, tetapi komitmen bulanan bisa melebihi
    // return sehingga payback tidak tercapai (null) -- bukan angka palsu.
    const cashPayback = cashPlan.metrics.paybackMonths;
    assert.ok(cashPayback === null || cashPayback >= 0);
  });

  test('harga: kenaikan harga menaikkan margin kotor', () => {
    const result = run('pricing_change', {
      priceChangePercent: 10,
      volumeChangeImpact: 0.95,
      competitiveResponse: false,
    });
    const plan = result.scenarioResults.find((s) => s.id === 'pricing_plan')!;
    assert.ok(plan.metrics.newGrossMarginPercent > result.baseline.grossMarginPercent);
    assert.ok(plan.metrics.marginChangePoints > 0);
  });

  test('biaya: penurunan HPP menaikkan laba bulanan', () => {
    const result = run('cost_change', {
      materialCostChangePercent: -10,
      laborCostChangePercent: -5,
      operationalEfficiency: 1.1,
    });
    const plan = result.scenarioResults.find((s) => s.id === 'cost_plan')!;
    const adverse = result.scenarioResults.find((s) => s.id === 'cost_adverse')!;
    assert.ok(plan.metrics.monthlyNetProfitImpact > 0);
    assert.ok(adverse.metrics.monthlyNetProfitImpact < 0);
  });

  test('custom: tambahan biaya menurunkan laba', () => {
    const result = run('custom', { additionalMonthlyExpense: 20_000_000 });
    const plan = result.scenarioResults.find((s) => s.id === 'custom_plan')!;
    assert.ok(plan.metrics.monthlyNetProfitImpact < 0);
    assert.equal(plan.metrics.monthlyNetProfitImpact, -20_000_000);
  });

  test('rekrutmen: status quo tidak melaporkan dampak laba kotor negatif', () => {
    const result = run('employee_hiring', { hiringCount: 3 });
    const statusQuo = result.scenarioResults.find((s) => s.id === 'hiring_status_quo')!;
    assert.equal(statusQuo.metrics.monthlyGrossProfitImpact, 0);
    assert.equal(statusQuo.metrics.monthlyNetProfitImpact, 0);
    assert.equal(statusQuo.metrics.firstMonthCashFlowImpact, 0);
  });

  test('perbandingan: best* berasal dari skenario berperingkat dengan ROI nyata', () => {
    const result = run('asset_purchase', { assetCost: 100_000_000, expectedROI: 0.25 });
    const rankedIds = new Set(result.scenarioResults.map((s) => s.id));
    for (const key of ['bestROI', 'bestCashFlow', 'bestMargin'] as const) {
      const best = result.comparison[key];
      assert.ok(best, `${key} tidak boleh null`);
      assert.ok(rankedIds.has(best!.id), `${key} harus berasal dari rankedScenarios`);
      assert.ok(best!.rank >= 1, `${key}.rank harus terisi`);
    }

    // bestROI = ROI tahunan tertinggi, bukan laba tertinggi.
    const bestRoi = result.comparison.bestROI!.metrics.annualROI!;
    for (const scenario of result.scenarioResults) {
      if (scenario.metrics.annualROI === null) continue;
      assert.ok(bestRoi >= scenario.metrics.annualROI, 'bestROI harus ROI tertinggi');
    }
  });

  test('perbandingan: peringkat unik dan distribusi risiko konsisten', () => {
    for (const type of ALL_TYPES) {
      const result = run(type);
      const ranks = result.scenarioResults.map((s) => s.rank).sort((a, b) => a - b);
      assert.deepEqual(ranks, result.scenarioResults.map((_, i) => i + 1));

      const distributionTotal = Object.values(result.comparison.riskDistribution).reduce((a, b) => a + b, 0);
      assert.equal(distributionTotal, result.comparison.totalScenarios);

      const scoresDesc = result.scenarioResults.map((s) => s.score);
      assert.deepEqual(scoresDesc, [...scoresDesc].sort((a, b) => b - a), 'harus urut skor menurun');
    }
  });

  test('risiko kritis saat belanja modal menghabiskan kas', () => {
    const result = run('asset_purchase', { assetCost: 1_000_000_000, financingMethod: 'cash', expectedROI: 0.02 });
    const plan = result.scenarioResults.find((s) => s.id === 'asset_plan')!;
    assert.ok(['HIGH', 'CRITICAL'].includes(plan.riskLevel), `dapat ${plan.riskLevel}`);
    assert.ok(plan.metrics.cashOutWithinHorizon || plan.metrics.paybackMonths === null);
  });

  test('tipe skenario terdeteksi dari prompt bila tidak eksplisit', () => {
    const promptToType: Array<[string, DecisionScenarioType]> = [
      ['Sebaiknya rekrut 3 karyawan baru?', 'employee_hiring'],
      ['Rencana beli aset mesin produksi', 'asset_purchase'],
      ['Naikkan harga jual 8%', 'pricing_change'],
      ['Turunkan HPP bahan baku', 'cost_change'],
    ];
    for (const [prompt, expected] of promptToType) {
      const result = runEnhancedFinancialDecisionSimulation(makeContext(), {
        workspaceId: 'ws-test',
        promptDescription: prompt,
        adjustments: {},
      });
      assert.equal(result.scenarioType, expected, `prompt "${prompt}"`);
    }
  });

  test('ringkasan dan rekomendasi tidak kosong', () => {
    for (const type of ALL_TYPES) {
      const result = run(type);
      assert.ok(result.summary.length > 0);
      assert.ok(result.recommendations.length > 0);
      assert.ok(result.scenarioResults.length >= 3);
    }
  });
});
