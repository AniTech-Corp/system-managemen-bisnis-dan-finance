import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { blendForecast, extractSignalsFromResearch } from '../src/lib/forecast-blend';
import type { ForwardForecastResult } from '../src/lib/ai-brain';
import type { ExternalSignal, ForecastExtraData } from '../src/lib/research-types';

// tests/forecast-blend.test.ts (wave B2-forecast-blend, 8 Sep 2026)
//
// forecast-blend.ts adalah modul MURNI (nol fetch, nol Prisma, nol efek
// samping) -- test ini TIDAK butuh mock.module apapun, murni fixture data +
// assertion atas hasil blendForecast()/extractSignalsFromResearch().
//
// Fokus utama: (1) dataSufficiency memakai proxy yang BENAR (totalIncome30d +
// totalExpense30d + currentLiquidCash, BUKAN currentLiquidCash+monthlyBurnRate
// saja -- lihat komentar forecast-blend.ts BlendForecastInput.financials30d
// untuk penjelasan bug yang diperbaiki), (2) summary WAJIB pisah label DATA
// INTERNAL/DATA PUBLIK/ASUMSI, (3) externalSignals mempengaruhi arah baseline
// sesuai tanda effectPct, (4) extractSignalsFromResearch regex heuristik.

function makeMonths(count: number, projectedCashFn: (m: number) => number, revenueFn: (m: number) => number = () => 0) {
  return Array.from({ length: count }, (_, idx) => {
    const m = idx + 1;
    return {
      month: m,
      monthName: `Bulan ${m}`,
      baselineCash: 1_000_000,
      projectedCash: Math.max(0, projectedCashFn(m)),
      burnRate: 500_000,
      netRevenue: revenueFn(m),
    };
  });
}

function makeBase(overrides: Partial<ForwardForecastResult> = {}): ForwardForecastResult {
  const horizon = 3;
  return {
    currentLiquidCash: 10_000_000,
    monthlyBurnRate: 2_000_000,
    runwayMonths: 5,
    cashOutDate: null,
    trajectories: {
      conservative: makeMonths(horizon, m => 10_000_000 - m * 1_500_000),
      expected: makeMonths(horizon, m => 10_000_000 + m * 500_000),
      optimistic: makeMonths(horizon, m => 10_000_000 + m * 2_000_000),
    },
    anomalies: [],
    ...overrides,
  } as ForwardForecastResult;
}

describe('blendForecast: dataSufficiency', () => {
  test('financials30d nol semua + currentLiquidCash nol -> ok=false (benar-benar kosong)', () => {
    const base = makeBase({ currentLiquidCash: 0 });
    const result = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [],
      financials30d: { totalIncome30d: 0, totalExpense30d: 0 },
    });
    assert.equal(result.dataSufficiency.ok, false);
    assert.match(result.dataSufficiency.reason, /Tidak ada cukup data historis/);
  });

  test('BUG FIX: currentLiquidCash=0 DAN monthlyBurnRate=0 (breakeven) TAPI ada transaksi 30 hari -> ok=true', () => {
    // Skenario persis yang diangkat kritik "terlewat" TINGGI #1: bisnis
    // breakeven/untung punya monthlyBurnRate=0 by design (context-engine.ts:
    // hanya terisi kalau netCashflow30d negatif) -- proxy LAMA
    // (currentLiquidCash===0 && monthlyBurnRate===0) akan salah bilang "kosong"
    // padahal ada banyak transaksi. Proxy BARU (financials30d) harus benar.
    const base = makeBase({ currentLiquidCash: 0, monthlyBurnRate: 0 });
    const result = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [],
      financials30d: { totalIncome30d: 15_000_000, totalExpense30d: 15_000_000 },
    });
    assert.equal(result.dataSufficiency.ok, true);
    assert.match(result.dataSufficiency.reason, /Cukup/);
  });

  test('financials30d tidak dikirim -> fallback heuristik lama, tetap jujur di reason', () => {
    const base = makeBase({ currentLiquidCash: 0, monthlyBurnRate: 0 });
    const result = blendForecast({ base, horizonMonths: 3, externalSignals: [] });
    assert.equal(result.dataSufficiency.ok, false);
    assert.match(result.dataSufficiency.reason, /fallback/i);
  });

  test('data cukup normal (kas+burn ada) -> ok=true', () => {
    const base = makeBase();
    const result = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [],
      financials30d: { totalIncome30d: 8_000_000, totalExpense30d: 6_000_000 },
    });
    assert.equal(result.dataSufficiency.ok, true);
  });
});

describe('blendForecast: summary WAJIB pisah DATA INTERNAL / DATA PUBLIK / ASUMSI', () => {
  test('externalSignals kosong -> summary tetap valid tanpa DATA PUBLIK palsu', () => {
    const base = makeBase();
    const result = blendForecast({ base, horizonMonths: 3, externalSignals: [] });
    assert.match(result.summary, /DATA INTERNAL:/);
    assert.match(result.summary, /DATA PUBLIK:/);
    assert.match(result.summary, /ASUMSI:/);
    assert.match(result.summary, /tidak ada riset eksternal/i);
    assert.equal(result.externalSignalsUsed.length, 0);
  });

  test('externalSignals terisi -> summary sebut label+confidence+source, externalSignalsUsed diteruskan apa adanya', () => {
    const base = makeBase();
    const signals: ExternalSignal[] = [
      { label: 'Tren kopi susu naik', effectPct: 10, source: 'Riset web (ringkasan)', confidence: 'low' },
    ];
    const result = blendForecast({ base, horizonMonths: 3, externalSignals: signals });
    // [\s\S]* dipakai (bukan .* dengan flag /s) -- tsconfig target ES2017,
    // flag dotAll baru tersedia di ES2018+ (TS1501 kalau dipaksa).
    assert.match(result.summary, /DATA PUBLIK:[\s\S]*Tren kopi susu naik/);
    assert.match(result.summary, /keyakinan low/);
    assert.deepEqual(result.externalSignalsUsed, signals);
  });
});

describe('blendForecast: arah pengaruh externalSignals ke tabel', () => {
  test('sinyal positif menaikkan baseline dibanding proyeksi expected murni', () => {
    const base = makeBase();
    const withoutSignal = blendForecast({ base, horizonMonths: 3, externalSignals: [] });
    const withPositive = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [{ label: 'Naik', effectPct: 20, source: 'x', confidence: 'medium' }],
    });
    for (let i = 0; i < 3; i++) {
      assert.ok(
        withPositive.table[i].baseline >= withoutSignal.table[i].baseline,
        `bulan ke-${i}: baseline dengan sinyal positif (${withPositive.table[i].baseline}) harus >= tanpa sinyal (${withoutSignal.table[i].baseline})`
      );
    }
  });

  test('sinyal negatif menurunkan baseline dibanding proyeksi expected murni', () => {
    const base = makeBase();
    const withoutSignal = blendForecast({ base, horizonMonths: 3, externalSignals: [] });
    const withNegative = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [{ label: 'Turun', effectPct: -20, source: 'x', confidence: 'medium' }],
    });
    for (let i = 0; i < 3; i++) {
      assert.ok(
        withNegative.table[i].baseline <= withoutSignal.table[i].baseline,
        `bulan ke-${i}: baseline dengan sinyal negatif (${withNegative.table[i].baseline}) harus <= tanpa sinyal (${withoutSignal.table[i].baseline})`
      );
    }
  });

  test('confidence low dibobot lebih kecil daripada medium untuk effectPct yang sama', () => {
    const base = makeBase();
    const low = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [{ label: 'a', effectPct: 20, source: 'x', confidence: 'low' }],
    });
    const medium = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [{ label: 'a', effectPct: 20, source: 'x', confidence: 'medium' }],
    });
    // Baseline bulan terakhir dengan confidence medium harus lebih tinggi
    // (bobot lebih besar untuk sinyal positif yang sama) daripada low.
    assert.ok(medium.table[2].baseline > low.table[2].baseline);
  });

  test('tabel dipotong mengikuti horizonMonths (panjang trajectories base)', () => {
    const base = makeBase();
    const result = blendForecast({ base, horizonMonths: 3, externalSignals: [] });
    assert.equal(result.table.length, 3);
    assert.equal(result.horizonMonths, 3);
  });
});

describe('blendForecast: extraData menggeser optimistic/pessimistic', () => {
  test('priceChangePct positif menaikkan optimistic dibanding tanpa extraData', () => {
    const base = makeBase();
    const withoutExtra = blendForecast({ base, horizonMonths: 3, externalSignals: [] });
    const withPrice = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [],
      extraData: { priceChangePct: 20 },
    });
    assert.ok(withPrice.table[2].optimistic >= withoutExtra.table[2].optimistic);
    assert.ok(withPrice.assumptions.some(a => /Perubahan harga/.test(a)));
  });

  test('newBranch=true menambah catatan asumsi ramp-up/kanibalisasi', () => {
    const base = makeBase();
    const result = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [],
      extraData: { newBranch: true },
    });
    assert.ok(result.assumptions.some(a => /cabang baru/i.test(a)));
  });

  test('notes masuk ke assumptions apa adanya', () => {
    const base = makeBase();
    const result = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [],
      extraData: { notes: 'Toko libur 2 minggu bulan depan' },
    });
    assert.ok(result.assumptions.some(a => a.includes('Toko libur 2 minggu bulan depan')));
  });

  test('targetRevenue dijadikan pembanding di summary, bukan pengubah tabel', () => {
    const base = makeBase();
    const withoutTarget = blendForecast({ base, horizonMonths: 3, externalSignals: [] });
    const withTarget = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [],
      extraData: { targetRevenue: 50_000_000 },
    });
    assert.match(withTarget.summary, /target pendapatan/i);
    // Tabel TIDAK berubah hanya karena targetRevenue diisi (extraDataEffect
    // tidak menambah delta apapun untuk targetRevenue sendirian).
    assert.deepEqual(withTarget.table, withoutTarget.table);
  });

  extraDataValidationCases().forEach(({ name, extraData }) => {
    test(`extraData ${name} tidak melempar error`, () => {
      const base = makeBase();
      assert.doesNotThrow(() => blendForecast({ base, horizonMonths: 3, externalSignals: [], extraData }));
    });
  });

  function extraDataValidationCases(): Array<{ name: string; extraData: ForecastExtraData }> {
    return [
      { name: 'kosong', extraData: {} },
      { name: 'costChangePct negatif (biaya turun)', extraData: { costChangePct: -30 } },
      { name: 'semua field terisi', extraData: { targetRevenue: 10_000_000, priceChangePct: 5, costChangePct: -5, newBranch: true, notes: 'ok' } },
    ];
  }
});

describe('blendForecast: deteksi konflik arah tren (internal vs riset publik)', () => {
  test('internal naik + riset publik turun kuat -> PERHATIAN muncul di assumptions', () => {
    const base = makeBase(); // expected: naik seiring bulan (500rb/bulan)
    const result = blendForecast({
      base,
      horizonMonths: 3,
      externalSignals: [{ label: 'Pasar lesu', effectPct: -40, source: 'x', confidence: 'medium' }],
    });
    assert.ok(result.assumptions.some(a => /PERHATIAN/.test(a)));
  });

  test('tidak ada externalSignals -> tidak ada PERHATIAN konflik', () => {
    const base = makeBase();
    const result = blendForecast({ base, horizonMonths: 3, externalSignals: [] });
    assert.ok(!result.assumptions.some(a => /PERHATIAN/.test(a)));
  });
});

describe('extractSignalsFromResearch', () => {
  test('string kosong -> array kosong', () => {
    assert.deepEqual(extractSignalsFromResearch(''), []);
  });

  test('pola "naik X%" -> sinyal positif confidence low', () => {
    const signals = extractSignalsFromResearch('Permintaan kopi susu di area ini naik 15% dibanding tahun lalu.');
    assert.equal(signals.length, 1);
    assert.equal(signals[0].confidence, 'low');
    assert.ok(signals[0].effectPct > 0);
  });

  test('pola "turun X%" -> sinyal negatif confidence low', () => {
    const signals = extractSignalsFromResearch('Penjualan ritel turun 8% bulan ini.');
    assert.equal(signals.length, 1);
    assert.ok(signals[0].effectPct < 0);
  });

  test('campuran naik dan turun -> dua sinyal', () => {
    const signals = extractSignalsFromResearch('Kategori A naik 10% sementara kategori B turun 5%.');
    assert.equal(signals.length, 2);
  });

  test('dibatasi maksimal 5 sinyal', () => {
    const text = Array.from({ length: 8 }, (_, i) => `Indikator ${i} naik ${i + 1}%.`).join(' ');
    const signals = extractSignalsFromResearch(text);
    assert.ok(signals.length <= 5);
  });

  test('teks tanpa pola persentase -> array kosong (tidak mengarang sinyal)', () => {
    const signals = extractSignalsFromResearch('Pasar kopi Indonesia terus berkembang dengan banyak pemain baru.');
    assert.deepEqual(signals, []);
  });
});
