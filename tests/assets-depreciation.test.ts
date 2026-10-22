import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  bookValueAt,
  buildDepreciationSchedule,
  depreciationThrough,
  findPeriod,
  periodKey,
  shiftYearMonth,
  validateAssetInput,
} from '../src/lib/assets/depreciation';

const startDate = new Date('2026-01-15T00:00:00.000Z');

const sum = (values: number[]) =>
  Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;

describe('asset depreciation: straight line', () => {
  test('membagi nilai tersusutkan rata per bulan', () => {
    const schedule = buildDepreciationSchedule({
      acquisitionCost: 12_000_000,
      salvageValue: 2_000_000,
      usefulLifeMonths: 10,
      method: 'STRAIGHT_LINE',
      startDate,
    });

    assert.equal(schedule.length, 10);
    assert.equal(schedule[0].amount, 1_000_000);
    assert.equal(schedule[9].accumulated, 10_000_000);
    assert.equal(schedule[9].bookValue, 2_000_000);
    assert.equal(sum(schedule.map((period) => period.amount)), 10_000_000);
  });

  test('menyerap selisih pembulatan pada periode terakhir', () => {
    const schedule = buildDepreciationSchedule({
      acquisitionCost: 1000,
      salvageValue: 0,
      usefulLifeMonths: 3,
      method: 'STRAIGHT_LINE',
      startDate,
    });

    assert.deepEqual(
      schedule.map((period) => period.amount),
      [333.33, 333.33, 333.34]
    );
    assert.equal(schedule[2].accumulated, 1000);
    assert.equal(schedule[2].bookValue, 0);
  });

  test('menghormati batas `until` untuk laporan per tanggal', () => {
    const schedule = buildDepreciationSchedule(
      {
        acquisitionCost: 12_000_000,
        salvageValue: 0,
        usefulLifeMonths: 12,
        method: 'STRAIGHT_LINE',
        startDate,
      },
      { until: { year: 2026, month: 3 } }
    );

    assert.equal(schedule.length, 3);
    assert.equal(schedule[2].accumulated, 3_000_000);
  });
});

describe('asset depreciation: declining balance', () => {
  test('beban menurun dan nilai buku tidak turun di bawah nilai sisa', () => {
    const schedule = buildDepreciationSchedule({
      acquisitionCost: 10_000_000,
      salvageValue: 1_000_000,
      usefulLifeMonths: 60,
      method: 'DECLINING_BALANCE',
      startDate,
    });

    assert.ok(schedule.length > 0);
    // Tarif saldo menurun ganda untuk 5 tahun = 40%/tahun.
    assert.equal(schedule[0].amount, 333_333.33);

    for (let index = 1; index < schedule.length; index += 1) {
      assert.ok(
        schedule[index].amount <= schedule[index - 1].amount,
        'beban saldo menurun harus tidak naik'
      );
      assert.ok(
        schedule[index].bookValue >= 1_000_000 - 0.01,
        'nilai buku tidak boleh di bawah nilai sisa'
      );
    }
  });
});

describe('asset depreciation: sum of years digits', () => {
  test('membagi beban mengikuti bobot tahun', () => {
    const schedule = buildDepreciationSchedule({
      acquisitionCost: 10_000_000,
      salvageValue: 1_000_000,
      usefulLifeMonths: 36,
      method: 'SUM_OF_YEARS_DIGITS',
      startDate,
    });

    const year1 = schedule.slice(0, 12);
    const year2 = schedule.slice(12, 24);
    const year3 = schedule.slice(24, 36);

    // nilai tersusutkan 9.000.000; jumlah angka tahun 1+2+3 = 6
    assert.equal(sum(year1.map((period) => period.amount)), 4_500_000);
    assert.equal(sum(year2.map((period) => period.amount)), 3_000_000);
    assert.equal(sum(year3.map((period) => period.amount)), 1_500_000);
    assert.equal(schedule[35].accumulated, 9_000_000);
    assert.equal(schedule[35].bookValue, 1_000_000);
  });
});

describe('asset depreciation: units of production', () => {
  test('menghitung beban dari unit aktual dan berhenti di nilai tersusutkan', () => {
    const schedule = buildDepreciationSchedule(
      {
        acquisitionCost: 10_000_000,
        salvageValue: 1_000_000,
        usefulLifeMonths: 12,
        method: 'UNITS_OF_PRODUCTION',
        totalEstimatedUnits: 9_000,
        startDate,
      },
      {
        unitsByPeriod: {
          '2026-01': 1_000,
          '2026-02': 2_000,
          '2026-03': 6_500, // melebihi sisa kapasitas 6.000 unit
        },
      }
    );

    assert.equal(schedule[0].amount, 1_000_000);
    assert.equal(schedule[0].unitsProduced, 1_000);
    assert.equal(schedule[1].amount, 2_000_000);
    assert.equal(schedule[1].accumulated, 3_000_000);
    // Periode ketiga dibatasi agar total tidak melebihi 9.000.000.
    assert.equal(schedule[2].amount, 6_000_000);
    assert.equal(schedule[2].bookValue, 1_000_000);
  });

  test('periode tanpa unit menghasilkan beban nol', () => {
    const schedule = buildDepreciationSchedule(
      {
        acquisitionCost: 1_000_000,
        salvageValue: 0,
        usefulLifeMonths: 3,
        method: 'UNITS_OF_PRODUCTION',
        totalEstimatedUnits: 1_000,
        startDate,
      },
      { unitsByPeriod: { '2026-02': 500 } }
    );

    assert.equal(schedule[0].amount, 0);
    assert.equal(schedule[1].amount, 500_000);
  });
});

describe('asset depreciation: helper & validasi', () => {
  test('shiftYearMonth melewati batas tahun dengan benar', () => {
    assert.deepEqual(shiftYearMonth(2026, 11, 3), { year: 2027, month: 2 });
    assert.deepEqual(shiftYearMonth(2026, 1, -1), { year: 2025, month: 12 });
    assert.equal(periodKey(2026, 3), '2026-03');
  });

  test('bookValueAt dan depreciationThrough membaca posisi periode', () => {
    const schedule = buildDepreciationSchedule({
      acquisitionCost: 6_000_000,
      salvageValue: 0,
      usefulLifeMonths: 6,
      method: 'STRAIGHT_LINE',
      startDate,
    });

    const position = bookValueAt(schedule, 2026, 3);
    assert.equal(position?.accumulated, 3_000_000);
    assert.equal(position?.bookValue, 3_000_000);
    assert.equal(depreciationThrough(schedule, 2026, 6), 6_000_000);
    assert.equal(findPeriod(schedule, 2026, 4)?.amount, 1_000_000);
    assert.equal(findPeriod(schedule, 2026, 12), null);
  });

  test('validasi menolak input tidak wajar dan mengizinkan aset non-penyusutan', () => {
    assert.match(
      validateAssetInput({
        acquisitionCost: 0,
        salvageValue: 0,
        usefulLifeMonths: 12,
        method: 'STRAIGHT_LINE',
      }) ?? '',
      /Nilai perolehan/
    );

    assert.match(
      validateAssetInput({
        acquisitionCost: 1_000_000,
        salvageValue: 2_000_000,
        usefulLifeMonths: 12,
        method: 'STRAIGHT_LINE',
      }) ?? '',
      /Nilai sisa/
    );

    assert.match(
      validateAssetInput({
        acquisitionCost: 1_000_000,
        salvageValue: 0,
        usefulLifeMonths: 0,
        method: 'STRAIGHT_LINE',
      }) ?? '',
      /Masa manfaat/
    );

    assert.match(
      validateAssetInput({
        acquisitionCost: 1_000_000,
        salvageValue: 0,
        usefulLifeMonths: 12,
        method: 'UNITS_OF_PRODUCTION',
      }) ?? '',
      /unit produksi/
    );

    assert.equal(
      validateAssetInput({
        acquisitionCost: 1_000_000,
        salvageValue: 0,
        usefulLifeMonths: 0,
        method: 'STRAIGHT_LINE',
        isDepreciable: false,
      }),
      null
    );
  });
});
