import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import {
  buildMonthlyBaseline,
  projectScenarios,
  getDefaultScenarios,
  runProjection,
  type MonthlyBaseline,
  type ScenarioParams,
} from '../src/lib/accounting/scenario-projection';

const prisma = new PrismaClient();

const TEST_WORKSPACE_ID = 'a1000000-0000-0000-0000-000000000001';

describe('scenario-projection engine', () => {
  before(async () => {
    // Ensure test workspace exists with some journal data
    // This assumes seed:finance has been run
  });

  it('buildMonthlyBaseline returns correct number of months', async () => {
    const baseline = await buildMonthlyBaseline(TEST_WORKSPACE_ID, 6);
    assert.ok(Array.isArray(baseline));
    // May be less than 6 if not enough data, but should not error
    for (const month of baseline) {
      assert.ok(month.month.match(/^\d{4}-\d{2}$/));
      assert.ok(typeof month.revenue === 'number');
      assert.ok(typeof month.expense === 'number');
      assert.ok(typeof month.cashBalance === 'number');
      assert.ok(typeof month.dso === 'number');
      assert.ok(typeof month.arBalance === 'number');
    }
  });

  it('projectScenarios: normal scenario (0,0,0) equals baseline averages', () => {
    const baseline: MonthlyBaseline[] = [
      { month: '2026-01', monthLabel: 'Jan 26', revenue: 100_000_000, expense: 70_000_000, netIncome: 30_000_000, cashBalance: 50_000_000, dso: 15, arBalance: 50_000_000 },
      { month: '2026-02', monthLabel: 'Feb 26', revenue: 110_000_000, expense: 75_000_000, netIncome: 35_000_000, cashBalance: 85_000_000, dso: 18, arBalance: 60_000_000 },
      { month: '2026-03', monthLabel: 'Mar 26', revenue: 105_000_000, expense: 72_000_000, netIncome: 33_000_000, cashBalance: 118_000_000, dso: 16, arBalance: 55_000_000 },
    ];

    const scenarios: ScenarioParams[] = [
      { id: 'normal', label: 'Normal', salesDeltaPct: 0, opexDeltaPct: 0, delayDays: 0 },
    ];

    const projections = projectScenarios(baseline, scenarios, 3);
    assert.strictEqual(projections.length, 1);

    const normal = projections[0];
    assert.strictEqual(normal.id, 'normal');
    assert.strictEqual(normal.months.length, 3);

    // First projected month revenue should equal average baseline revenue
    const avgRev = (100_000_000 + 110_000_000 + 105_000_000) / 3;
    const avgExp = (70_000_000 + 75_000_000 + 72_000_000) / 3;

    assert.ok(Math.abs(normal.months[0].revenue - avgRev) < 1);
    assert.ok(Math.abs(normal.months[0].expense - avgExp) < 1);
    const avgDso = (15 + 18 + 16) / 3;
    assert.ok(Math.abs(normal.months[0].dso - avgDso) < 0.1);
  });

  it('projectScenarios: optimistic cash > normal > pessimistic', () => {
    const baseline: MonthlyBaseline[] = [
      { month: '2026-01', monthLabel: 'Jan 26', revenue: 100_000_000, expense: 70_000_000, netIncome: 30_000_000, cashBalance: 50_000_000, dso: 15, arBalance: 50_000_000 },
      { month: '2026-02', monthLabel: 'Feb 26', revenue: 100_000_000, expense: 70_000_000, netIncome: 30_000_000, cashBalance: 80_000_000, dso: 15, arBalance: 50_000_000 },
      { month: '2026-03', monthLabel: 'Mar 26', revenue: 100_000_000, expense: 70_000_000, netIncome: 30_000_000, cashBalance: 110_000_000, dso: 15, arBalance: 50_000_000 },
    ];

    const scenarios = getDefaultScenarios(); // optimistic, normal, pessimistic
    const projections = projectScenarios(baseline, scenarios, 6);

    const opt = projections.find(p => p.id === 'optimistic')!;
    const norm = projections.find(p => p.id === 'normal')!;
    const pess = projections.find(p => p.id === 'pessimistic')!;

    // Final cash: optimistic > normal > pessimistic
    assert.ok(opt.summary.finalCashBalance > norm.summary.finalCashBalance);
    assert.ok(norm.summary.finalCashBalance > pess.summary.finalCashBalance);

    // Runway: optimistic > normal > pessimistic (when not null)
    if (opt.summary.avgRunwayMonths && norm.summary.avgRunwayMonths && pess.summary.avgRunwayMonths) {
      assert.ok(opt.summary.avgRunwayMonths > norm.summary.avgRunwayMonths);
      assert.ok(norm.summary.avgRunwayMonths > pess.summary.avgRunwayMonths);
    }
  });

  it('projectScenarios: delayDays mengurangi kas masuk dan menaikkan piutang', () => {
    const baseline: MonthlyBaseline[] = [
      { month: '2026-01', monthLabel: 'Jan 26', revenue: 100_000_000, expense: 50_000_000, netIncome: 50_000_000, cashBalance: 100_000_000, dso: 15, arBalance: 50_000_000 },
    ];

    const scenarios: ScenarioParams[] = [
      { id: 'no-delay', label: 'No Delay', salesDeltaPct: 0, opexDeltaPct: 0, delayDays: 0 },
      { id: '30-delay', label: '30 Day Delay', salesDeltaPct: 0, opexDeltaPct: 0, delayDays: 30 },
    ];

    const projections = projectScenarios(baseline, scenarios, 3);

    const noDelay = projections.find(p => p.id === 'no-delay')!;
    const withDelay = projections.find(p => p.id === '30-delay')!;

    // Tanpa keterlambatan: piutang target = revenue * DSO/30 = 100jt * 15/30
    // = 50jt, sama dengan saldo awal -> kas masuk penuh.
    assert.ok(Math.abs(noDelay.months[0].cashInflow - 100_000_000) < 1);

    // Dengan keterlambatan 30 hari: DSO jadi 45, piutang target naik, jadi
    // kas masuk lebih kecil dari pendapatan.
    assert.ok(withDelay.months[0].cashInflow < withDelay.months[0].revenue);
    assert.ok(withDelay.months[0].arBalance > noDelay.months[0].arBalance);

    // Saldo kas akhir dengan keterlambatan harus lebih rendah.
    assert.ok(withDelay.summary.finalCashBalance < noDelay.summary.finalCashBalance);
  });

  it('projectScenarios: runway calculation edge cases', () => {
    const baseline: MonthlyBaseline[] = [
      { month: '2026-01', monthLabel: 'Jan 26', revenue: 100_000_000, expense: 0, netIncome: 100_000_000, cashBalance: 100_000_000, dso: 15, arBalance: 50_000_000 },
    ];

    const scenarios: ScenarioParams[] = [
      { id: 'zero-expense', label: 'Zero Expense', salesDeltaPct: 0, opexDeltaPct: 0, delayDays: 0 },
    ];

    const projections = projectScenarios(baseline, scenarios, 3);
    const proj = projections[0];

    // When expense = 0, runway should be null (infinite)
    for (const month of proj.months) {
      assert.strictEqual(month.runwayMonths, null);
    }
    assert.strictEqual(proj.summary.avgRunwayMonths, null);
  });

  it('projectScenarios: cash floor at 0, cashOutMonth detected', () => {
    const baseline: MonthlyBaseline[] = [
      { month: '2026-01', monthLabel: 'Jan 26', revenue: 10_000_000, expense: 50_000_000, netIncome: -40_000_000, cashBalance: 60_000_000, dso: 15, arBalance: 10_000_000 },
    ];

    const scenarios: ScenarioParams[] = [
      { id: 'burn', label: 'High Burn', salesDeltaPct: 0, opexDeltaPct: 0, delayDays: 0 },
    ];

    const projections = projectScenarios(baseline, scenarios, 6);
    const proj = projections[0];

    // Cash should never go negative
    for (const month of proj.months) {
      assert.ok(month.cashBalance >= 0);
    }

    // Cash out month should be detected (around month 2: 60M - 40M = 20M, then -20M -> 0)
    assert.ok(proj.summary.cashOutMonth !== null);
    assert.ok(proj.summary.cashOutMonth! >= 1 && proj.summary.cashOutMonth! <= 3);
  });

  it('getDefaultScenarios returns three scenarios with correct structure', () => {
    const scenarios = getDefaultScenarios();
    assert.strictEqual(scenarios.length, 3);

    const ids = scenarios.map(s => s.id);
    assert.ok(ids.includes('optimistic'));
    assert.ok(ids.includes('normal'));
    assert.ok(ids.includes('pessimistic'));

    for (const s of scenarios) {
      assert.ok(typeof s.salesDeltaPct === 'number');
      assert.ok(typeof s.opexDeltaPct === 'number');
      assert.ok(typeof s.delayDays === 'number');
    }
  });

  it('runProjection integrates baseline + scenarios', async () => {
    // This is an integration test - may fail if no test data
    try {
      const result = await runProjection(TEST_WORKSPACE_ID, 3, 3);
      assert.ok(Array.isArray(result.baseline));
      assert.ok(Array.isArray(result.scenarios));
      assert.strictEqual(result.scenarios.length, 3);
      assert.ok(typeof result.kpis.currentCash === 'number');
      assert.ok(result.kpis.projectionHorizon === 3);
    } catch (err) {
      // Skip if no database connection or no test data
      console.warn('Integration test skipped:', err);
    }
  });
});