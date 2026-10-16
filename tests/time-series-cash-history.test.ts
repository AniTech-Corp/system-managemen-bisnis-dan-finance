import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCumulativeCashToMonthlySeries,
  generateDayBuckets,
  generateMonthBuckets,
  getWibDayRange,
  resolveDateRange,
} from '../src/lib/time-series-engine';

test('monthly closing cash is cumulative from the real opening balance', () => {
  const series = addCumulativeCashToMonthlySeries(
    [{ netCash: 100 }, { netCash: -40 }, { netCash: 0 }],
    500
  );

  assert.deepEqual(
    series.map((point) => ({ openingCash: point.openingCash, closingCash: point.closingCash })),
    [
      { openingCash: 500, closingCash: 600 },
      { openingCash: 600, closingCash: 560 },
      { openingCash: 560, closingCash: 560 },
    ]
  );
});

test('invalid opening or monthly net cash is fail-soft and never produces NaN', () => {
  const series = addCumulativeCashToMonthlySeries(
    [{ netCash: Number.NaN }, { netCash: Number.POSITIVE_INFINITY }],
    Number.NaN
  );

  assert.deepEqual(
    series.map((point) => ({ openingCash: point.openingCash, closingCash: point.closingCash })),
    [
      { openingCash: 0, closingCash: 0 },
      { openingCash: 0, closingCash: 0 },
    ]
  );
});

test('WIB day range uses the Indonesian calendar day around the UTC boundary', () => {
  const range = getWibDayRange(new Date('2026-09-09T18:00:00.000Z'));

  assert.equal(range.startDate.toISOString(), '2026-09-09T17:00:00.000Z');
  assert.equal(range.endDate.toISOString(), '2026-09-10T16:59:59.999Z');
});

test('WIB day range still belongs to the previous date before midnight WIB', () => {
  const range = getWibDayRange(new Date('2026-09-09T16:59:59.999Z'));

  assert.equal(range.startDate.toISOString(), '2026-09-08T17:00:00.000Z');
  assert.equal(range.endDate.toISOString(), '2026-09-09T16:59:59.999Z');
});

test('financial month range uses WIB boundaries, not UTC month boundaries', () => {
  const range = resolveDateRange({
    month: '2026-09',
    nowDate: new Date('2026-09-10T18:00:00.000Z'),
  });

  assert.equal(range.startDate.toISOString(), '2026-08-31T17:00:00.000Z');
  assert.equal(range.endDate.toISOString(), '2026-09-30T16:59:59.999Z');
  assert.equal(range.periodLabel, 'September 2026');
});

test('monthly and daily buckets keep an Indonesian date at the correct boundary', () => {
  const monthly = generateMonthBuckets(1, new Date('2026-09-30T16:00:00.000Z'));
  assert.equal(monthly[0].key, '2026-09');
  assert.equal(monthly[0].startDate.toISOString(), '2026-08-31T17:00:00.000Z');

  const daily = generateDayBuckets(
    new Date('2026-09-09T17:00:00.000Z'),
    new Date('2026-09-10T16:59:59.999Z')
  );
  assert.equal(daily.length, 1);
  assert.equal(daily[0].key, '2026-09-10');
  assert.equal(daily[0].startDate.toISOString(), '2026-09-09T17:00:00.000Z');
  assert.equal(daily[0].endDate.toISOString(), '2026-09-10T16:59:59.999Z');
});
