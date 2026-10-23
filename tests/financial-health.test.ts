import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  calculateFinancialHealthScore,
  gradeForScore,
  type FinancialHealthInput,
} from '../src/lib/accounting/financial-health';

const AS_OF = new Date('2026-10-22T03:00:00.000Z');
const PERIOD = {
  startDate: new Date('2026-08-01T00:00:00.000Z'),
  endDate: AS_OF,
};

function baseInput(overrides: Partial<FinancialHealthInput> = {}): FinancialHealthInput {
  return {
    asOf: AS_OF,
    period: PERIOD,
    cash: 600_000_000,
    receivables: 200_000_000,
    totalAssets: 2_000_000_000,
    totalLiabilities: 400_000_000,
    totalEquity: 1_600_000_000,
    revenue: 900_000_000,
    netIncome: 180_000_000,
    previousRevenue: 700_000_000,
    previousNetIncome: 100_000_000,
    operatingExpenses: 600_000_000,
    obligationsDue30: 50_000_000,
    overdueReceivableAmount: 20_000_000,
    monthlyCashFlows: [
      { key: '2026-05', label: 'Mei 2026', net: 100_000_000 },
      { key: '2026-06', label: 'Jun 2026', net: 100_000_000 },
      { key: '2026-07', label: 'Jul 2026', net: 100_000_000 },
      { key: '2026-08', label: 'Agu 2026', net: 100_000_000 },
      { key: '2026-09', label: 'Sep 2026', net: 100_000_000 },
      { key: '2026-10', label: 'Okt 2026', net: 100_000_000 },
    ],
    warnings: [],
    ...overrides,
  };
}

describe('financial-health: skor dan komponen', () => {
  test('semua bobot komponen berjumlah 100', () => {
    const result = calculateFinancialHealthScore(baseInput());
    const totalWeight = result.components.reduce((acc, component) => acc + component.weight, 0);
    assert.equal(totalWeight, 100);
    assert.equal(result.components.length, 5);
  });

  test('perusahaan dengan kas kuat, margin sehat, dan arus kas stabil mendapat Sangat Sehat', () => {
    const result = calculateFinancialHealthScore(baseInput());

    assert.equal(result.grade, 'SANGAT_SEHAT');
    assert.equal(result.gradeLabel, 'Sangat Sehat');
    assert.equal(result.dataQuality, 'COMPLETE');
    assert.ok(result.totalScore !== null && result.totalScore >= 95);
    assert.ok(result.components.every((component) => component.score !== null));
    assert.ok(result.strengths.length >= 3);
    assert.equal(result.risks.length, 0);
    assert.ok(result.recommendations.length >= 1);
  });

  test('tanpa data aktual skor null dan grade Belum Ada Data, bukan angka karangan', () => {
    const result = calculateFinancialHealthScore(
      baseInput({
        cash: 0,
        receivables: 0,
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        revenue: 0,
        netIncome: 0,
        previousRevenue: 0,
        previousNetIncome: 0,
        operatingExpenses: 0,
        obligationsDue30: 0,
        overdueReceivableAmount: 0,
        monthlyCashFlows: PERIOD
          ? [
              { key: '2026-05', label: 'Mei 2026', net: 0 },
              { key: '2026-06', label: 'Jun 2026', net: 0 },
              { key: '2026-07', label: 'Jul 2026', net: 0 },
              { key: '2026-08', label: 'Agu 2026', net: 0 },
              { key: '2026-09', label: 'Sep 2026', net: 0 },
              { key: '2026-10', label: 'Okt 2026', net: 0 },
            ]
          : [],
      })
    );

    assert.equal(result.totalScore, null);
    assert.equal(result.grade, 'BELUM_ADA_DATA');
    assert.equal(result.gradeLabel, 'Belum Ada Data');
    assert.equal(result.dataQuality, 'INSUFFICIENT');
    assert.ok(result.components.every((component) => component.score === null));
  });

  test('margin negatif, utang tinggi, dan piutang telat menghasilkan skor rendah + rekomendasi', () => {
    const result = calculateFinancialHealthScore(
      baseInput({
        cash: 15_000_000,
        receivables: 250_000_000,
        totalAssets: 1_000_000_000,
        totalLiabilities: 900_000_000,
        totalEquity: 100_000_000,
        revenue: 100_000_000,
        netIncome: -50_000_000,
        previousRevenue: 150_000_000,
        previousNetIncome: -10_000_000,
        operatingExpenses: 150_000_000,
        obligationsDue30: 300_000_000,
        overdueReceivableAmount: 200_000_000,
        monthlyCashFlows: [
          { key: '2026-05', label: 'Mei 2026', net: -20_000_000 },
          { key: '2026-06', label: 'Jun 2026', net: 30_000_000 },
          { key: '2026-07', label: 'Jul 2026', net: -40_000_000 },
          { key: '2026-08', label: 'Agu 2026', net: 10_000_000 },
          { key: '2026-09', label: 'Sep 2026', net: -30_000_000 },
          { key: '2026-10', label: 'Okt 2026', net: -10_000_000 },
        ],
      })
    );

    assert.ok(result.totalScore !== null && result.totalScore < 55);
    assert.ok(['BERISIKO', 'KRITIS'].includes(result.grade));
    assert.ok(result.risks.length >= 3);
    assert.ok(result.recommendations.some((rec) => rec.priority === 'TINGGI'));
    assert.ok(result.recommendations.length <= 5);
  });

  test('data parsial tetap dihitung dan ditandai PARTIAL', () => {
    const result = calculateFinancialHealthScore(
      baseInput({
        revenue: 0,
        netIncome: 0,
        previousRevenue: 0,
        previousNetIncome: 0,
        operatingExpenses: 0,
        obligationsDue30: 0,
        monthlyCashFlows: [],
      })
    );

    assert.equal(result.dataQuality, 'PARTIAL');
    assert.notEqual(result.totalScore, null);
    assert.ok(result.warnings.some((warning) => warning.includes('Sebagian komponen')));
  });

  test('ambang grade mengikuti kontrak 85/70/55/40', () => {
    assert.equal(gradeForScore(85).grade, 'SANGAT_SEHAT');
    assert.equal(gradeForScore(84).grade, 'SEHAT');
    assert.equal(gradeForScore(70).grade, 'SEHAT');
    assert.equal(gradeForScore(69).grade, 'CUKUP');
    assert.equal(gradeForScore(55).grade, 'CUKUP');
    assert.equal(gradeForScore(54).grade, 'BERISIKO');
    assert.equal(gradeForScore(40).grade, 'BERISIKO');
    assert.equal(gradeForScore(39).grade, 'KRITIS');
    assert.equal(gradeForScore(null).grade, 'BELUM_ADA_DATA');
  });
});
