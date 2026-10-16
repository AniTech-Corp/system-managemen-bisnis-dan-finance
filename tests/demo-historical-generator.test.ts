import assert from 'node:assert/strict';
import test from 'node:test';
import { HISTORICAL_YEARS_DATA } from '../src/lib/demo-historical-generator';

test('historical demo punya kontrak metadata dan label bulan lengkap', () => {
  const years = Object.keys(HISTORICAL_YEARS_DATA).map(Number).sort((a, b) => a - b);
  assert.deepEqual(years, [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);

  for (const year of years) {
    const snapshot = HISTORICAL_YEARS_DATA[year];
    assert.equal(snapshot.year, year);
    assert.equal(snapshot.periodKind, year === 2026 ? 'current-year-projection' : 'annual-benchmark');
    assert.equal(snapshot.annualBasis, year === 2026 ? 'projection' : 'declared');
    assert.equal(snapshot.throughMonth, year === 2026 ? 9 : 12);
    assert.equal(Object.keys(snapshot.monthlyData).length, 12);
    for (const month of Object.values(snapshot.monthlyData)) {
      assert.equal(typeof month.n, 'string');
      assert.ok(month.n.length > 0);
      assert.ok(Number.isFinite(month.rev));
      assert.ok(Number.isFinite(month.exp));
    }
  }
});

test('2026 membedakan bulan belum dimodelkan dari data aktual yang sudah ada', () => {
  const snapshot = HISTORICAL_YEARS_DATA[2026];
  assert.equal(snapshot.monthlyData.Sep.rev, 612500000);
  assert.equal(snapshot.monthlyData.Okt.rev, 0);
  assert.equal(snapshot.throughMonth, 9);
  assert.equal(snapshot.cashReserve, 348500000);
});
