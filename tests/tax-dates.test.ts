import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  addMonths,
  dateAtWibMidnight,
  dateKey,
  daysBetween,
  daysUntil,
  isWeekend,
  lastDayOfMonth,
  monthKey,
  monthRange,
  nextBusinessDay,
  parseMonthKey,
  wibParts,
  wibToday,
  yearRange,
} from '../src/lib/tax/dates';

describe('pajak: tanggal WIB', () => {
  test('tengah malam WIB adalah 17:00 UTC hari sebelumnya', () => {
    const date = dateAtWibMidnight(2026, 10, 22);
    assert.equal(date.toISOString(), '2026-10-21T17:00:00.000Z');
    assert.equal(dateKey(date), '2026-10-22');
  });

  test('wibParts menggeser UTC ke kalender WIB', () => {
    // 21 Okt 2026 18:00 UTC = 22 Okt 2026 01:00 WIB.
    const parts = wibParts(new Date('2026-10-21T18:00:00.000Z'));
    assert.deepEqual(parts, { year: 2026, month: 10, day: 22 });
    assert.deepEqual(wibToday(new Date('2026-10-21T18:00:00.000Z')), { year: 2026, month: 10 });
  });

  test('hari terakhir bulan termasuk tahun kabisat', () => {
    assert.equal(lastDayOfMonth(2026, 1), 31);
    assert.equal(lastDayOfMonth(2026, 2), 28);
    assert.equal(lastDayOfMonth(2024, 2), 29);
    assert.equal(lastDayOfMonth(2026, 4), 30);
    assert.equal(lastDayOfMonth(2026, 12), 31);
  });

  test('rentang bulan penuh berakhir 23:59:59.999 WIB', () => {
    const range = monthRange(2026, 10);
    assert.equal(dateKey(range.startDate), '2026-10-01');
    assert.equal(dateKey(range.endDate), '2026-10-31');
    assert.equal(range.startDate.toISOString(), '2026-09-30T17:00:00.000Z');
    assert.equal(range.endDate.toISOString(), '2026-10-31T16:59:59.999Z');
  });

  test('rentang tahun penuh konsisten', () => {
    const range = yearRange(2026);
    assert.equal(dateKey(range.startDate), '2026-01-01');
    assert.equal(dateKey(range.endDate), '2026-12-31');
  });

  test('addMonths melewati batas tahun ke depan dan belakang', () => {
    assert.deepEqual(addMonths(2026, 12, 1), { year: 2027, month: 1 });
    assert.deepEqual(addMonths(2026, 1, -1), { year: 2025, month: 12 });
    assert.deepEqual(addMonths(2026, 10, 14), { year: 2027, month: 12 });
    assert.deepEqual(addMonths(2026, 10, -21), { year: 2025, month: 1 });
  });

  test('monthKey dan parseMonthKey', () => {
    assert.equal(monthKey(2026, 3), '2026-03');
    assert.deepEqual(parseMonthKey('2026-3'), { year: 2026, month: 3 });
    assert.equal(parseMonthKey('2026-13'), null);
    assert.equal(parseMonthKey('bukan bulan'), null);
  });

  test('selisih hari dihitung pada kalender WIB', () => {
    const from = dateAtWibMidnight(2026, 10, 1);
    const to = dateAtWibMidnight(2026, 10, 31);
    assert.equal(daysBetween(from, to), 30);
    assert.equal(daysUntil(to, from), 30);
    assert.equal(daysUntil(from, to), -30);
  });

  test('akhir pekan dan hari kerja berikutnya', () => {
    // 24 Okt 2026 = Sabtu, 25 Okt = Minggu, 26 Okt = Senin.
    assert.equal(isWeekend(dateAtWibMidnight(2026, 10, 24)), true);
    assert.equal(isWeekend(dateAtWibMidnight(2026, 10, 25)), true);
    assert.equal(isWeekend(dateAtWibMidnight(2026, 10, 26)), false);
    assert.equal(dateKey(nextBusinessDay(dateAtWibMidnight(2026, 10, 24))), '2026-10-26');
  });

  test('hari libur ikut dilewati saat mencari hari kerja', () => {
    const holiday = '2026-10-26';
    assert.equal(
      dateKey(nextBusinessDay(dateAtWibMidnight(2026, 10, 24), [holiday])),
      '2026-10-27'
    );
  });
});
