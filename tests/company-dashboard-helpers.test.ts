// Test untuk helper MURNI baru di CompanyDataDashboard.tsx (audit portal CEO,
// batch BANGUN F3b+F4, 10 Sep 2026, agent ceo-build). Sengaja HANYA mengimpor
// named export fungsi murni (aggregateCampaignsSummary, aggregateTasksSummary,
// pickTopFinanceStrategyRecommendation) -- TIDAK ADA render React sama sekali
// di file ini (pola sama seperti tests/chat-cards-b5.test.ts, tidak butuh
// jsdom/testing-library yang memang tidak terpasang di project ini).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  aggregateCampaignsSummary,
  aggregateTasksSummary,
  pickTopFinanceStrategyRecommendation,
  buildDashboardInsightChips,
  hasUsableFinanceData,
} from '../src/app/components/CompanyDataDashboard';

describe('aggregateCampaignsSummary', () => {
  test('daftar kosong -> semua nol/null, tidak throw', () => {
    const out = aggregateCampaignsSummary([], 10);
    assert.deepEqual(out, { totalCount: 0, activeCount: 0, spendEstimate: 0, leadsTotal: 0, roasAvg: null });
  });

  test('spendEstimate cuma dihitung dari kampanye ACTIVE, dikali hari berjalan', () => {
    const out = aggregateCampaignsSummary(
      [
        { dailyBudget: 100000, roas: 2, leads: 5, status: 'ACTIVE' },
        { dailyBudget: 500000, roas: null, leads: 3, status: 'PAUSED' },
      ],
      10
    );
    // Hanya kampanye ACTIVE (100000) x 10 hari -- kampanye PAUSED (500000) TIDAK ikut dihitung.
    assert.equal(out.spendEstimate, 1000000);
    assert.equal(out.totalCount, 2);
    assert.equal(out.activeCount, 1);
  });

  test('leadsTotal menjumlah SEMUA kampanye (aktif maupun paused)', () => {
    const out = aggregateCampaignsSummary(
      [
        { dailyBudget: 100000, roas: 2, leads: 5, status: 'ACTIVE' },
        { dailyBudget: 500000, roas: 4, leads: 3, status: 'PAUSED' },
      ],
      5
    );
    assert.equal(out.leadsTotal, 8);
  });

  test('roasAvg = rata-rata dari kampanye yang punya roas terisi, kampanye roas null diabaikan', () => {
    const out = aggregateCampaignsSummary(
      [
        { dailyBudget: 100000, roas: 2, leads: 1, status: 'ACTIVE' },
        { dailyBudget: 100000, roas: 4, leads: 1, status: 'ACTIVE' },
        { dailyBudget: 100000, roas: null, leads: 1, status: 'ACTIVE' },
      ],
      1
    );
    assert.equal(out.roasAvg, 3);
  });

  test('roasAvg null kalau tidak ada satu pun kampanye yang punya roas terisi', () => {
    const out = aggregateCampaignsSummary([{ dailyBudget: 100000, roas: null, leads: 1, status: 'ACTIVE' }], 1);
    assert.equal(out.roasAvg, null);
  });

  test('daysElapsedThisMonth 0 atau negatif tidak membuat spendEstimate negatif/nol paksa (dibulatkan minimal 1 hari)', () => {
    const out = aggregateCampaignsSummary([{ dailyBudget: 100000, roas: 1, leads: 0, status: 'ACTIVE' }], 0);
    assert.equal(out.spendEstimate, 100000);
  });
});

describe('aggregateTasksSummary', () => {
  const now = new Date('2026-09-10T00:00:00.000Z');

  test('daftar kosong -> semua nol, tidak throw', () => {
    const out = aggregateTasksSummary([], now);
    assert.deepEqual(out, { total: 0, done: 0, overdue: 0 });
  });

  test('done dihitung dari status DONE saja', () => {
    const out = aggregateTasksSummary(
      [
        { status: 'DONE', dueDate: null },
        { status: 'TODO', dueDate: null },
        { status: 'IN_PROGRESS', dueDate: null },
      ],
      now
    );
    assert.equal(out.total, 3);
    assert.equal(out.done, 1);
  });

  test('overdue = status bukan DONE DAN dueDate sudah lewat', () => {
    const out = aggregateTasksSummary(
      [
        { status: 'TODO', dueDate: '2026-09-01T00:00:00.000Z' }, // lewat tempo
        { status: 'IN_PROGRESS', dueDate: '2026-09-20T00:00:00.000Z' }, // belum jatuh tempo
        { status: 'DONE', dueDate: '2026-08-01T00:00:00.000Z' }, // sudah DONE, tidak dihitung overdue walau tanggal lewat
        { status: 'TODO', dueDate: null }, // tanpa dueDate, tidak overdue
      ],
      now
    );
    assert.equal(out.overdue, 1);
  });
});

describe('pickTopFinanceStrategyRecommendation', () => {
  test('daftar kosong -> null', () => {
    assert.equal(pickTopFinanceStrategyRecommendation([]), null);
  });

  test('kategori di luar FINANCE/STRATEGY diabaikan', () => {
    const out = pickTopFinanceStrategyRecommendation([
      { category: 'MARKETING', priority: 'CRITICAL' },
      { category: 'OPERATIONS', priority: 'CRITICAL' },
    ]);
    assert.equal(out, null);
  });

  test('prioritas CRITICAL menang dari HIGH/MEDIUM/LOW', () => {
    const out = pickTopFinanceStrategyRecommendation([
      { category: 'FINANCE', priority: 'LOW', title: 'low' },
      { category: 'STRATEGY', priority: 'CRITICAL', title: 'critical' },
      { category: 'FINANCE', priority: 'HIGH', title: 'high' },
    ]);
    assert.equal(out?.title, 'critical');
  });

  test('FINANCE dan STRATEGY sama-sama dipertimbangkan (bukan cuma salah satu)', () => {
    const out = pickTopFinanceStrategyRecommendation([{ category: 'STRATEGY', priority: 'HIGH', title: 'strategy-high' }]);
    assert.equal(out?.title, 'strategy-high');
  });
});

// KONTRAK MODUL 6 (11 Sep 2026, Fable) -- helper murni format sumberData
// dashboard-insight jadi chip siap-render. Tidak fetch apa pun.
describe('buildDashboardInsightChips', () => {
  test('sumberData null/undefined -> array kosong, tidak throw', () => {
    assert.deepEqual(buildDashboardInsightChips(null), []);
    assert.deepEqual(buildDashboardInsightChips(undefined), []);
  });

  test('workspace kosong -> tetap render chip Transaksi/Dokumen dengan angka 0, TANPA chip opsional', () => {
    const out = buildDashboardInsightChips({
      transaksiTercatat: false,
      jumlahTransaksi: 0,
      dokumen: 0,
      dokumenLedgerTerdeteksi: 0,
      kampanye: 0,
      tugas: 0,
      produk: 0,
    });
    assert.deepEqual(out, ['Transaksi: 0 tercatat', 'Dokumen: 0']);
  });

  test('dokumenLedgerTerdeteksi > 0 -> chip nudge "Impor ke Buku Kas" muncul (akar keluhan Mecca #1)', () => {
    const out = buildDashboardInsightChips({
      transaksiTercatat: false,
      jumlahTransaksi: 0,
      dokumen: 12,
      dokumenLedgerTerdeteksi: 1,
      kampanye: 0,
      tugas: 0,
      produk: 0,
    });
    assert.deepEqual(out, ['Transaksi: 0 tercatat', 'Dokumen: 12', 'Ledger terdeteksi: 1 -> Impor ke Buku Kas']);
  });

  test('kampanye/tugas/produk > 0 semua muncul sebagai chip tambahan, urutan tetap', () => {
    const out = buildDashboardInsightChips({
      transaksiTercatat: true,
      jumlahTransaksi: 5,
      dokumen: 3,
      dokumenLedgerTerdeteksi: 0,
      kampanye: 2,
      tugas: 4,
      produk: 1,
    });
    assert.deepEqual(out, ['Transaksi: 5 tercatat', 'Dokumen: 3', 'Kampanye: 2', 'Tugas: 4', 'Produk: 1']);
  });
});

describe('hasUsableFinanceData', () => {
  test('localhost tidak menganggap tren benchmark sebagai transaksi riil ketika transaksi kosong', () => {
    assert.equal(hasUsableFinanceData({
      transactionCount: 0,
      totalRevenue: 612_500_000,
      totalExpense: 478_000_000,
      cashBalance: 0,
      isDevLocalhost: true,
    }), false);
  });

  test('transaksi lokal yang substantial menang atas tren dan saldo', () => {
    assert.equal(hasUsableFinanceData({
      transactionCount: 6,
      totalRevenue: 0,
      totalExpense: 0,
      cashBalance: 0,
      isDevLocalhost: true,
    }), true);
  });

  test('produksi tetap memakai agregat backend tanpa benchmark lokal', () => {
    assert.equal(hasUsableFinanceData({
      transactionCount: 0,
      totalRevenue: 1_000_000,
      totalExpense: 0,
      cashBalance: 0,
      isDevLocalhost: false,
    }), true);
  });
});
