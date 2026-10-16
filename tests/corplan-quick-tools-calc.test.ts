import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { detectHPPIntent, calculateHPP } from '../src/lib/ai-brain/hpp-calculator';
import { detectKURIntent, calculateKUR } from '../src/lib/ai-brain/kur-calculator';

// Test logic kalkulasi murni yang dipakai CorPlanQuickTools.tsx (widget dashboard)
// DAN brain/chat/route.ts (AI Assistant chat) -- keduanya memanggil fungsi yang
// SAMA PERSIS di sini, jadi test ini juga jadi jaminan angka tidak pernah beda-beda
// antara widget dan chat. Belum ada test komponen React di project ini (belum ada
// konvensi test untuk komponen, dicek: tidak ada @testing-library/react di
// package.json) -- jadi sesuai instruksi, yang di-test adalah logic kalkulasinya,
// bukan skip testing sama sekali.

describe('calculateHPP (dipakai CorPlanQuickTools tab HPP)', () => {
  test('kalkulasi dasar -- margin positif', () => {
    const r = calculateHPP({
      rawMaterialCost: 5000,
      laborCost: 2000,
      overheadCost: 1000,
      sellingPrice: 15000,
      monthlyVolume: 100,
    });
    assert.equal(r.totalHPPPerUnit, 8000);
    assert.equal(r.grossProfitPerUnit, 7000);
    assert.equal(r.marginPercentage, (7000 / 15000) * 100);
    assert.equal(r.totalMonthlyRevenue, 1500000);
    assert.equal(r.totalMonthlyCost, 800000);
    assert.equal(r.totalMonthlyGrossProfit, 700000);
  });

  test('harga jual di bawah HPP -- margin negatif (peringatan rugi)', () => {
    const r = calculateHPP({
      rawMaterialCost: 8000,
      laborCost: 3000,
      overheadCost: 2000,
      sellingPrice: 10000,
      monthlyVolume: 50,
    });
    assert.equal(r.totalHPPPerUnit, 13000);
    assert.equal(r.grossProfitPerUnit, -3000);
    assert.ok(r.grossProfitPerUnit < 0);
    assert.equal(r.totalMonthlyGrossProfit, -150000);
  });

  test('monthlyVolume tidak diisi -> default 1', () => {
    const r = calculateHPP({ rawMaterialCost: 1000, laborCost: 500, overheadCost: 500, sellingPrice: 3000 });
    assert.equal(r.monthlyVolume, 1);
    assert.equal(r.totalMonthlyRevenue, 3000);
  });

  test('sellingPrice 0 -> marginPercentage 0 (bukan NaN/Infinity)', () => {
    const r = calculateHPP({ rawMaterialCost: 1000, laborCost: 0, overheadCost: 0, sellingPrice: 0, monthlyVolume: 10 });
    assert.equal(r.marginPercentage, 0);
    assert.ok(Number.isFinite(r.marginPercentage));
  });
});

describe('detectHPPIntent', () => {
  test('"hitung hpp bahan baku 5000" -> true', () => {
    assert.equal(detectHPPIntent('hitung hpp bahan baku 5000'), true);
  });
  test('"apa itu HPP?" (tanya definisi, bukan hitung) -> false', () => {
    assert.equal(detectHPPIntent('apa itu HPP?'), false);
  });
  test('pesan tidak menyebut HPP sama sekali -> false', () => {
    assert.equal(detectHPPIntent('halo, gimana kabar bisnis saya?'), false);
  });
});

describe('calculateKUR (dipakai CorPlanQuickTools tab KUR + endpoint simulate-kur)', () => {
  test('kalkulasi dasar -- mirror rumus route.ts persis: pinjaman 100jt, tenor 24 bulan, bunga 6%', () => {
    const r = calculateKUR({ loanAmount: 100000000, tenorMonths: 24, annualInterestRate: 6 });
    const expectedTotalInterest = 100000000 * 0.06 * (24 / 12);
    assert.equal(r.totalInterest, expectedTotalInterest);
    assert.equal(r.totalRepayment, 100000000 + expectedTotalInterest);
    assert.equal(r.monthlyInstallment, Math.round(r.totalRepayment / 24));
    assert.equal(r.monthlyPrincipal, Math.round(100000000 / 24));
    assert.equal(r.monthlyInterest, Math.round(expectedTotalInterest / 24));
  });

  test('annualInterestRate tidak diisi -> default 6% (subsidi KUR pemerintah)', () => {
    const r = calculateKUR({ loanAmount: 50000000, tenorMonths: 12 });
    assert.equal(r.annualInterestRate, 6);
  });

  test('pokok + total bunga = total pembayaran (konsistensi internal)', () => {
    const r = calculateKUR({ loanAmount: 75000000, tenorMonths: 36, annualInterestRate: 7 });
    assert.equal(r.totalRepayment, r.loanAmount + r.totalInterest);
  });

  test('tenorMonths 0/kosong tidak menghasilkan Infinity/NaN (fallback ke 1)', () => {
    const r = calculateKUR({ loanAmount: 10000000, tenorMonths: 0 as any });
    assert.ok(Number.isFinite(r.monthlyInstallment));
    assert.ok(Number.isFinite(r.monthlyPrincipal));
  });
});

describe('detectKURIntent', () => {
  test('"simulasi KUR pinjaman 100 juta tenor 24 bulan" -> true', () => {
    assert.equal(detectKURIntent('simulasi KUR pinjaman 100 juta tenor 24 bulan'), true);
  });
  test('"apa itu KUR?" (tanya definisi, bukan hitung) -> false', () => {
    assert.equal(detectKURIntent('apa itu KUR?'), false);
  });
  test('pesan tidak menyebut KUR sama sekali -> false', () => {
    assert.equal(detectKURIntent('tolong buatkan laporan keuangan bulan ini'), false);
  });
  test('"hitung cicilan kur saya" -> true (keyword + sinyal kalkulasi)', () => {
    assert.equal(detectKURIntent('hitung cicilan kur saya'), true);
  });
});
