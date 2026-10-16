import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeSalesTarget,
  buildSalesTargetReply,
  detectSalesTargetIntent,
  parseSalesTargetInput,
} from '../src/lib/ai-brain/sales-target-engine';

test('detects sales target and prediction prompts', () => {
  assert.equal(detectSalesTargetIntent('Tolong prediksi target penjualan sampai Desember'), true);
  assert.equal(detectSalesTargetIntent('Buatkan invoice pelanggan'), false);
});

test('parses annual target and quarterly realizations without inventing missing quarters', () => {
  const parsed = parseSalesTargetInput('target tahunan Rp 100 juta; Q1 Rp 15 juta; Q2 Rp 20 juta');

  assert.equal(parsed.annualTarget, 100_000_000);
  assert.deepEqual(parsed.realizations, [
    { quarter: 1, amount: 15_000_000 },
    { quarter: 2, amount: 20_000_000 },
  ]);
});

test('kuartal dipisah koma atau spasi (tanpa titik-koma) tetap terbaca semua -- regresi 10 Sep 2026', () => {
  // Sebelum patch: capture group sisa teks Q1 menelan "Q2 20 juta", jadi cuma Q1 yang terbaca.
  const comma = parseSalesTargetInput('target penjualan tahun ini 100 juta, Q1 15 juta, Q2 20 juta');
  assert.equal(comma.annualTarget, 100_000_000);
  assert.deepEqual(comma.realizations, [
    { quarter: 1, amount: 15_000_000 },
    { quarter: 2, amount: 20_000_000 },
  ]);

  const spaced = parseSalesTargetInput('target penjualan 100 juta Q1 15 juta Q2 20 juta Q3 30 juta');
  assert.deepEqual(spaced.realizations, [
    { quarter: 1, amount: 15_000_000 },
    { quarter: 2, amount: 20_000_000 },
    { quarter: 3, amount: 30_000_000 },
  ]);
});

test('calculates remaining target, baseline plan, and simple projection', () => {
  const analysis = analyzeSalesTarget('target tahunan Rp 100 juta; Q1 Rp 15 juta; Q2 Rp 20 juta');

  assert.ok(analysis);
  assert.equal(analysis.annualTarget, 100_000_000);
  assert.equal(analysis.quarterlyTarget, 25_000_000);
  assert.equal(analysis.realizedToDate, 35_000_000);
  assert.equal(analysis.remainingTarget, 65_000_000);
  assert.deepEqual(analysis.remainingQuarters, [3, 4]);
  assert.equal(analysis.suggestedPerRemainingQuarter, 32_500_000);
  assert.deepEqual(analysis.stagedRecoveryPlan, [
    { quarter: 3, amount: 30_000_000 },
    { quarter: 4, amount: 35_000_000 },
  ]);
  assert.equal(analysis.projectedAnnualRevenue, 70_000_000);
  assert.equal(analysis.projectedGap, 30_000_000);
});

test('gives a staged recovery plan instead of hiding the whole backlog in the final quarter', () => {
  const reply = buildSalesTargetReply('target tahunan Rp 100 juta; Q1 Rp 15 juta; Q2 Rp 20 juta');

  assert.match(reply, /Rencana recovery kuartal berikutnya/);
  assert.match(reply, /Q3: target kerja Rp 30\.000\.000/);
  assert.match(reply, /Q4: target kerja Rp 35\.000\.000/);
  assert.match(reply, /Backlog dibagi makin besar/);
});

test('asks for real numbers instead of falling through to an unrelated answer', () => {
  const reply = buildSalesTargetReply('Analisis target penjualan saya');

  assert.match(reply, /Target penjualan tahunan/);
  assert.match(reply, /realisasi per kuartal/i);
  assert.doesNotMatch(reply, /KUR|pinjaman/i);
});
