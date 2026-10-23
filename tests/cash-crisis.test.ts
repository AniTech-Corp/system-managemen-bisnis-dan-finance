import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  assessCashCrisis,
  collectionProbability,
  normalizeCashCrisisHorizon,
  type CashCrisisInput,
} from '../src/lib/accounting/cash-crisis';

const AS_OF = new Date('2026-10-22T00:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function baseInput(overrides: Partial<CashCrisisInput> = {}): CashCrisisInput {
  return {
    asOf: AS_OF,
    horizonDays: 30,
    currentCash: 100_000_000,
    monthlyOperatingExpense: 30_000_000,
    obligations: [],
    receivables: [],
    collectionHistory: {
      paidInvoiceCount: 0,
      averageDaysLate: null,
      medianDaysLate: null,
      sampleDaysLate: [],
    },
    warnings: [],
    ...overrides,
  };
}

describe('cash-crisis: probabilitas dan proyeksi', () => {
  test('probabilitas penagihan mengikuti umur piutang', () => {
    assert.equal(collectionProbability(-5), 0.9);
    assert.equal(collectionProbability(0), 0.9);
    assert.equal(collectionProbability(1), 0.75);
    assert.equal(collectionProbability(30), 0.75);
    assert.equal(collectionProbability(31), 0.55);
    assert.equal(collectionProbability(60), 0.55);
    assert.equal(collectionProbability(61), 0.3);
  });

  test('horizon hanya menerima 7/14/30/60/90, selain itu default 30', () => {
    assert.equal(normalizeCashCrisisHorizon('7'), 7);
    assert.equal(normalizeCashCrisisHorizon('90'), 90);
    assert.equal(normalizeCashCrisisHorizon('12'), 30);
    assert.equal(normalizeCashCrisisHorizon(undefined), 30);
  });

  test('proyeksi memasukkan kewajiban, piutang tertimbang, dan beban operasional harian', () => {
    const result = assessCashCrisis(
      baseInput({
        obligations: [
          { id: 'o-1', name: 'Sewa kantor', dueDate: new Date(AS_OF.getTime() + 5 * DAY), amount: 80_000_000 },
        ],
        receivables: [
          {
            id: 'r-1',
            reference: 'INV-001',
            client: 'PT Alpha',
            dueDate: new Date(AS_OF.getTime() - 10 * DAY),
            amount: 50_000_000,
            daysOverdue: 10,
          },
        ],
      })
    );

    assert.equal(result.points.length, 31);
    assert.equal(result.points[0].projectedBalance, 100_000_000);
    // Hari ke-5: kas - sewa - 5 hari beban operasional (1 juta/hari).
    assert.equal(result.points[5].projectedBalance, 15_000_000);
    // Hari ke-7: piutang telat 10 hari punya peluang 75% -> 37,5 juta.
    assert.equal(result.points[7].projectedBalance, 50_500_000);
    assert.equal(result.totalExpectedCollections, 37_500_000);
    assert.equal(result.totalObligations, 80_000_000);
    assert.equal(result.firstShortfallDate, null);
    assert.equal(result.projectedBalance, result.points[30].projectedBalance);
  });

  test('piutang yang belum jatuh tempo dijadwalkan pada tanggal jatuh tempo, bukan hari ini', () => {
    const result = assessCashCrisis(
      baseInput({
        receivables: [
          {
            id: 'r-1',
            reference: 'INV-002',
            client: 'PT Beta',
            dueDate: new Date(AS_OF.getTime() + 15 * DAY),
            amount: 100_000_000,
            daysOverdue: 0,
          },
        ],
      })
    );

    const row = result.receivables[0];
    assert.equal(row.collectionProbability, 0.9);
    assert.equal(row.expectedAmount, 90_000_000);
    assert.equal(row.expectedCollectionDate.toISOString().slice(0, 10), '2026-11-06');
    assert.equal(result.points[15].expectedCollection, 90_000_000);
  });

  test('kekurangan kas dalam 7 hari berstatus CRITICAL dan memberi rekomendasi tinggi', () => {
    const result = assessCashCrisis(
      baseInput({
        currentCash: 10_000_000,
        obligations: [
          { id: 'o-1', name: 'Gaji', dueDate: new Date(AS_OF.getTime() + 3 * DAY), amount: 50_000_000 },
        ],
      })
    );

    assert.equal(result.firstShortfallDay, 3);
    assert.equal(result.status, 'CRITICAL');
    assert.equal(result.statusLabel, 'Kritis');
    assert.ok(result.minimumProjectedBalance < 0);
    assert.ok(result.recommendations.some((rec) => rec.priority === 'TINGGI'));
  });

  test('kekurangan pada hari ke-20 berstatus WARNING', () => {
    const result = assessCashCrisis(
      baseInput({
        currentCash: 50_000_000,
        monthlyOperatingExpense: 0,
        obligations: [
          { id: 'o-1', name: 'Utang supplier', dueDate: new Date(AS_OF.getTime() + 20 * DAY), amount: 80_000_000 },
        ],
      })
    );

    assert.equal(result.firstShortfallDay, 20);
    assert.equal(result.status, 'WARNING');
  });

  test('tanpa kewajiban dan piutang, kas cukup untuk satu bulan berstatus SAFE', () => {
    const result = assessCashCrisis(baseInput({ currentCash: 100_000_000, monthlyOperatingExpense: 15_000_000 }));
    assert.equal(result.status, 'SAFE');
    assert.equal(result.firstShortfallDate, null);
    assert.equal(result.runwayDays, 30);
  });

  test('saldo kas negatif langsung CRITICAL', () => {
    const result = assessCashCrisis(baseInput({ currentCash: -1_000_000 }));
    assert.equal(result.status, 'CRITICAL');
    assert.equal(result.firstShortfallDay, 0);
  });

  test('rasio piutang telat di atas 30% memicu WATCH walau tidak ada shortfall', () => {
    const result = assessCashCrisis(
      baseInput({
        receivables: [
          {
            id: 'r-1',
            reference: 'INV-OLD',
            client: 'PT Telat',
            dueDate: new Date(AS_OF.getTime() - 20 * DAY),
            amount: 40_000_000,
            daysOverdue: 20,
          },
          {
            id: 'r-2',
            reference: 'INV-NEW',
            client: 'PT Lancar',
            dueDate: new Date(AS_OF.getTime() + 20 * DAY),
            amount: 60_000_000,
            daysOverdue: 0,
          },
        ],
      })
    );

    assert.equal(result.collectionRisk.overdueCount, 1);
    assert.equal(result.collectionRisk.overdueRatio, 0.4);
    assert.equal(result.collectionRisk.level, 'SEDANG');
    assert.equal(result.status, 'WATCH');
  });

  test('total ekspektasi piutang hanya menghitung yang masuk dalam horizon', () => {
    const result = assessCashCrisis(
      baseInput({
        horizonDays: 7,
        monthlyOperatingExpense: 0,
        receivables: [
          {
            id: 'r-old',
            reference: 'INV-LAMA',
            client: 'PT Lama',
            dueDate: new Date(AS_OF.getTime() - 90 * DAY),
            amount: 100_000_000,
            daysOverdue: 90,
          },
        ],
      })
    );

    // Piutang >60 hari baru diekspektasikan masuk H+30, di luar horizon 7 hari.
    assert.equal(result.points.length, 8);
    assert.equal(result.totalExpectedCollections, 0);
    assert.equal(result.receivables[0].expectedAmount, 30_000_000);
    assert.equal(result.status, 'WATCH');
  });

  test('riwayat pelunasan dipakai untuk menilai risiko pembayaran', () => {
    const result = assessCashCrisis(
      baseInput({
        collectionHistory: {
          paidInvoiceCount: 12,
          averageDaysLate: 18,
          medianDaysLate: 15,
          sampleDaysLate: [0, 5, 10, 18, 22, 30, 12, 15, 17, 20, 8, 25],
        },
      })
    );

    assert.equal(result.collectionRisk.hasHistory, true);
    assert.equal(result.collectionRisk.historicalAverageDaysLate, 18);
    assert.equal(result.collectionRisk.historicalPaidInvoiceCount, 12);
  });
});
