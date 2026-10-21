import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Prisma } from '@prisma/client';
import {
  AGING_BUCKET_KEYS,
  bucketForDaysOverdue,
  daysOverdue,
  daysUntilDue,
  dunningLevelFor,
  forecastCashFlow,
  resolveDueDate,
  summarizeAgingByPartner,
} from '../src/lib/accounting/ar-ap';

const d = (s: string) => new Prisma.Decimal(s);

describe('ar-ap: bucket umur', () => {
  test('memetakan hari terlambat ke bucket yang benar di batas-batasnya', () => {
    assert.equal(bucketForDaysOverdue(0), 'current');
    assert.equal(bucketForDaysOverdue(-5), 'current');
    assert.equal(bucketForDaysOverdue(1), 'd1_30');
    assert.equal(bucketForDaysOverdue(30), 'd1_30');
    assert.equal(bucketForDaysOverdue(31), 'd31_60');
    assert.equal(bucketForDaysOverdue(60), 'd31_60');
    assert.equal(bucketForDaysOverdue(61), 'd61_90');
    assert.equal(bucketForDaysOverdue(90), 'd61_90');
    assert.equal(bucketForDaysOverdue(91), 'd90_plus');
    assert.equal(bucketForDaysOverdue(1000), 'd90_plus');
  });

  test('selalu mengembalikan salah satu bucket yang terdaftar', () => {
    for (const days of [-1, 0, 7, 45, 200, Number.NaN]) {
      assert.ok(AGING_BUCKET_KEYS.includes(bucketForDaysOverdue(days)));
    }
  });
});

describe('ar-ap: tanggal & termin', () => {
  test('daysOverdue tidak pernah negatif dan daysUntilDue boleh negatif', () => {
    const asOf = new Date('2026-03-31T00:00:00.000Z');
    assert.equal(daysOverdue(new Date('2026-03-01T00:00:00.000Z'), asOf), 30);
    assert.equal(daysOverdue(new Date('2026-04-10T00:00:00.000Z'), asOf), 0);
    assert.equal(daysUntilDue(new Date('2026-04-10T00:00:00.000Z'), asOf), 10);
    assert.equal(daysUntilDue(new Date('2026-03-21T00:00:00.000Z'), asOf), -10);
  });

  test('resolveDueDate menurunkan jatuh tempo dari termin, termin aneh jadi 0', () => {
    const issue = new Date('2026-01-01T00:00:00.000Z');
    assert.equal(resolveDueDate(issue, 30).toISOString().slice(0, 10), '2026-01-31');
    assert.equal(resolveDueDate(issue, -5).toISOString().slice(0, 10), '2026-01-01');
    assert.equal(resolveDueDate(issue, 0).toISOString().slice(0, 10), '2026-01-01');
  });
});

describe('ar-ap: tingkat penagihan (dunning)', () => {
  test('level naik sesuai umur keterlambatan', () => {
    assert.equal(dunningLevelFor(-10).tone, 'soft'); // jauh sebelum jatuh tempo
    assert.equal(dunningLevelFor(-1).tone, 'soft'); // mendekati jatuh tempo (H-3 window)
    assert.equal(dunningLevelFor(0).tone, 'normal');
    assert.equal(dunningLevelFor(6).tone, 'normal');
    assert.equal(dunningLevelFor(7).tone, 'firm');
    assert.equal(dunningLevelFor(29).tone, 'firm');
    assert.equal(dunningLevelFor(30).tone, 'legal');
    assert.equal(dunningLevelFor(90).level, 4);
  });

  test('konfigurasi kustom menggeser ambang batas', () => {
    const cfg = { softDays: 5, firmDays: 3, legalDays: 10 };
    assert.equal(dunningLevelFor(3, cfg).tone, 'firm');
    assert.equal(dunningLevelFor(9, cfg).tone, 'firm');
    assert.equal(dunningLevelFor(10, cfg).tone, 'legal');
  });
});

describe('ar-ap: ringkasan per pihak lawan', () => {
  test('mengelompokkan per partnerId, fallback ke nama, dan menghitung porsi', () => {
    const summary = summarizeAgingByPartner([
      { partnerId: 'p1', partner: 'PT A', amount: d('100.00'), bucket: 'current', daysOverdue: 0 },
      { partnerId: 'p1', partner: 'PT A', amount: d('50.00'), bucket: 'd1_30', daysOverdue: 5 },
      { partnerId: null, partner: 'Warung B', amount: d('50.00'), bucket: 'd31_60', daysOverdue: 40 },
    ]);

    assert.equal(summary.partners.length, 2);
    assert.equal(summary.total.toFixed(2), '200.00');

    const a = summary.partners[0];
    assert.equal(a.partnerId, 'p1');
    assert.equal(a.total.toFixed(2), '150.00');
    assert.equal(a.buckets.current.toFixed(2), '100.00');
    assert.equal(a.buckets.d1_30.toFixed(2), '50.00');
    assert.equal(a.count, 2);
    assert.equal(a.maxDaysOverdue, 5);
    assert.equal(a.share, 0.75);

    const b = summary.partners[1];
    assert.equal(b.partnerId, null);
    assert.equal(b.total.toFixed(2), '50.00');
    assert.equal(b.buckets.d31_60.toFixed(2), '50.00');
  });

  test('dua dokumen nama sama tanpa partnerId digabung (case-insensitive)', () => {
    const summary = summarizeAgingByPartner([
      { partnerId: null, partner: 'Toko Sinar', amount: d('10.00'), bucket: 'current', daysOverdue: 0 },
      { partnerId: null, partner: 'toko sinar', amount: d('20.00'), bucket: 'current', daysOverdue: 0 },
    ]);
    assert.equal(summary.partners.length, 1);
    assert.equal(summary.partners[0].total.toFixed(2), '30.00');
  });
});

describe('ar-ap: proyeksi arus kas', () => {
  test('membagi dokumen ke bucket terlambat, mingguan, dan selebihnya', () => {
    const asOf = new Date('2026-04-01T00:00:00.000Z');
    const day = (n: number) => new Date(asOf.getTime() + n * 86_400_000);

    const forecast = forecastCashFlow(
      {
        ar: [
          { partner: 'A', dueDate: day(-3), outstanding: '100.00' }, // terlambat
          { partner: 'B', dueDate: day(2), outstanding: '200.00' }, // minggu 1
          { partner: 'C', dueDate: day(10), outstanding: '300.00' }, // minggu 2
          { partner: 'D', dueDate: day(60), outstanding: '50.00' }, // selebihnya
        ],
        ap: [
          { partner: 'V1', dueDate: day(1), outstanding: '120.00' }, // minggu 1
          { partner: 'V2', dueDate: day(40), outstanding: '80.00' }, // selebihnya
        ],
      },
      asOf,
      14
    );

    const get = (key: string) => forecast.buckets.find((b) => b.key === key)!;
    assert.equal(get('overdue').inflow.toFixed(2), '100.00');
    assert.equal(get('overdue').outflow.toFixed(2), '0.00');
    assert.equal(get('w1').inflow.toFixed(2), '200.00');
    assert.equal(get('w1').outflow.toFixed(2), '120.00');
    assert.equal(get('w1').net.toFixed(2), '80.00');
    assert.equal(get('w2').inflow.toFixed(2), '300.00');
    assert.equal(get('beyond').inflow.toFixed(2), '50.00');
    assert.equal(get('beyond').outflow.toFixed(2), '80.00');

    assert.equal(forecast.inflowTotal.toFixed(2), '650.00');
    assert.equal(forecast.outflowTotal.toFixed(2), '200.00');
    assert.equal(forecast.netTotal.toFixed(2), '450.00');
  });

  test('nominal nol/negatif diabaikan', () => {
    const asOf = new Date('2026-04-01T00:00:00.000Z');
    const forecast = forecastCashFlow(
      { ar: [{ partner: 'A', dueDate: asOf, outstanding: '0.00' }], ap: [] },
      asOf,
      7
    );
    assert.equal(forecast.inflowTotal.toFixed(2), '0.00');
    assert.equal(forecast.buckets.length, 3); // overdue + w1 + beyond
  });
});
