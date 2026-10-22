import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  computePphFinalMonthly,
  computePpn,
  computeWithholding,
  parsePeriodMonth,
  round0,
  round2,
  toNum,
} from '../src/lib/tax/calc';

describe('pajak: perhitungan PPh Final UMKM', () => {
  test('badan usaha dikenakan tarif final atas seluruh omzet bulan ini', () => {
    const result = computePphFinalMonthly({
      monthlyRevenue: 10_000_000,
      ytdRevenueBefore: 900_000_000,
      threshold: 500_000_000,
      ratePct: 0.5,
      isOrangPribadi: false,
    });

    assert.equal(result.taxableRevenue, 10_000_000);
    assert.equal(result.taxAmount, 50_000);
    assert.equal(result.ytdRevenueAfter, 910_000_000);
  });

  test('orang pribadi di bawah ambang Rp 500 juta belum terutang', () => {
    const result = computePphFinalMonthly({
      monthlyRevenue: 40_000_000,
      ytdRevenueBefore: 400_000_000,
      threshold: 500_000_000,
      ratePct: 0.5,
      isOrangPribadi: true,
    });

    assert.equal(result.taxableRevenue, 0);
    assert.equal(result.taxAmount, 0);
    assert.equal(result.ytdRevenueAfter, 440_000_000);
  });

  test('ambang bersifat kumulatif: hanya bagian yang melewati ambang dikenakan', () => {
    const result = computePphFinalMonthly({
      monthlyRevenue: 40_000_000,
      ytdRevenueBefore: 480_000_000,
      threshold: 500_000_000,
      ratePct: 0.5,
      isOrangPribadi: true,
    });

    assert.equal(result.taxableRevenue, 20_000_000);
    assert.equal(result.taxAmount, 100_000);
  });

  test('setelah ambang terlampaui, seluruh omzet bulan berikutnya kena pajak', () => {
    const result = computePphFinalMonthly({
      monthlyRevenue: 10_000_000,
      ytdRevenueBefore: 600_000_000,
      threshold: 500_000_000,
      ratePct: 0.5,
      isOrangPribadi: true,
    });

    assert.equal(result.taxableRevenue, 10_000_000);
    assert.equal(result.taxAmount, 50_000);
  });

  test('nilai negatif dijepit ke nol', () => {
    const result = computePphFinalMonthly({
      monthlyRevenue: -5_000_000,
      ytdRevenueBefore: -10_000_000,
      threshold: 500_000_000,
      ratePct: 0.5,
      isOrangPribadi: false,
    });

    assert.equal(result.taxableRevenue, 0);
    assert.equal(result.taxAmount, 0);
    assert.equal(result.ytdRevenueAfter, 0);
  });
});

describe('pajak: PPN dan potongan', () => {
  test('PPN kurang bayar dihitung dari keluaran dikurangi masukan', () => {
    const result = computePpn(1_110_000, 555_000);
    assert.equal(result.signed, 555_000);
    assert.equal(result.netPayable, 555_000);
    assert.equal(result.overpayment, 0);
  });

  test('PPN lebih bayar tidak menghasilkan angka negatif pada netPayable', () => {
    const result = computePpn(500_000, 800_000);
    assert.equal(result.signed, -300_000);
    assert.equal(result.netPayable, 0);
    assert.equal(result.overpayment, 300_000);
  });

  test('menolak input negatif dan membulatkan dua desimal', () => {
    const result = computePpn(-100, 100.005);
    assert.equal(result.outputTax, 0);
    assert.equal(result.inputTax, 100.01);
    assert.equal(result.overpayment, 100.01);
  });

  test('potongan PPh 23 = DPP x tarif', () => {
    assert.equal(computeWithholding(5_000_000, 2), 100_000);
    assert.equal(computeWithholding(12_345_678, 2), 246_913.56);
    assert.equal(computeWithholding(-1, 2), 0);
  });
});

describe('pajak: pembacaan periode payroll', () => {
  test('mendukung format ISO, slash, dan nama bulan Indonesia/Inggris', () => {
    assert.deepEqual(parsePeriodMonth('2026-10'), { year: 2026, month: 10 });
    assert.deepEqual(parsePeriodMonth('10/2026'), { year: 2026, month: 10 });
    assert.deepEqual(parsePeriodMonth('Agustus 2026'), { year: 2026, month: 8 });
    assert.deepEqual(parsePeriodMonth('August 2026'), { year: 2026, month: 8 });
    assert.deepEqual(parsePeriodMonth('Des 2025'), { year: 2025, month: 12 });
  });

  test('mengembalikan null untuk teks yang tidak dikenali', () => {
    assert.equal(parsePeriodMonth(''), null);
    assert.equal(parsePeriodMonth(null), null);
    assert.equal(parsePeriodMonth('13/2026'), null);
    assert.equal(parsePeriodMonth('periode gaji'), null);
  });
});

describe('pajak: utilitas angka', () => {
  test('toNum aman terhadap null/NaN', () => {
    assert.equal(toNum(null), 0);
    assert.equal(toNum(undefined), 0);
    assert.equal(toNum('12.5'), 12.5);
    assert.equal(toNum('bukan angka'), 0);
  });

  test('pembulatan dua desimal dan nol desimal', () => {
    assert.equal(round2(1.005), 1.01);
    assert.equal(round2(1.004), 1);
    assert.equal(round0(1.5), 2);
    assert.equal(round0(1.49), 1);
  });
});
