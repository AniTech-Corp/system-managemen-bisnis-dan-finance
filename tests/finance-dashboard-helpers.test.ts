import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildTrendBars,
  describeMissingTrendMonths,
  describeCash30dAnalysis,
  priorityRank,
  filterTopRecommendations,
  computeCashOutDateLabel,
  mapPiutangReminderError,
  resolvePeriodParams,
  shouldFallbackToAllPeriod,
  type TrendMonthDatum,
  type FinanceRecommendationLite,
} from '../src/app/components/FinanceModuleView';

describe('buildTrendBars (LENGKAPI #2 audit Finance 10 Sep -- label bulan dinamis)', () => {
  test('bulan tanpa data (raw null) tetap hasData:false meski income/expense 0', () => {
    const months: TrendMonthDatum[] = [
      { key: '2026-04', shortLabel: 'Apr', income: 0, expense: 0, hasData: false },
      { key: '2026-09', shortLabel: 'Sep', income: 10000000, expense: 4000000, hasData: true },
    ];
    const bars = buildTrendBars(months);
    assert.equal(bars[0].hasData, false);
    assert.equal(bars[1].hasData, true);
    assert.equal(bars[0].name, 'Apr');
    assert.equal(bars[1].name, 'Sep');
  });

  test('bar pct dihitung relatif terhadap bulan omset tertinggi', () => {
    const months: TrendMonthDatum[] = [
      { key: '2026-08', shortLabel: 'Agu', income: 5000000, expense: 2000000, hasData: true },
      { key: '2026-09', shortLabel: 'Sep', income: 10000000, expense: 4000000, hasData: true },
    ];
    const bars = buildTrendBars(months);
    assert.equal(bars[1].omsetPct, 100);
    assert.equal(bars[0].omsetPct, 50);
  });

  test('semua bulan 0 (workspace baru) tidak membagi dengan nol', () => {
    const months: TrendMonthDatum[] = [
      { key: '2026-09', shortLabel: 'Sep', income: 0, expense: 0, hasData: false },
    ];
    const bars = buildTrendBars(months);
    assert.equal(bars[0].omsetPct, 0);
    assert.equal(bars[0].bebanPct, 0);
  });
});

describe('describeMissingTrendMonths (jujur, bukan diam-diam 0)', () => {
  test('null kalau semua bulan ada data', () => {
    const months: TrendMonthDatum[] = [
      { key: '2026-09', shortLabel: 'Sep', income: 1, expense: 1, hasData: true },
    ];
    assert.equal(describeMissingTrendMonths(months), null);
  });

  test('sebagian bulan kosong -> sebutkan nama bulannya', () => {
    const months: TrendMonthDatum[] = [
      { key: '2026-04', shortLabel: 'Apr', income: 0, expense: 0, hasData: false },
      { key: '2026-05', shortLabel: 'Mei', income: 0, expense: 0, hasData: false },
      { key: '2026-09', shortLabel: 'Sep', income: 1, expense: 1, hasData: true },
    ];
    const note = describeMissingTrendMonths(months);
    assert.match(note as string, /Apr/);
    assert.match(note as string, /Mei/);
  });

  test('semua bulan kosong -> pesan generik "belum tersedia"', () => {
    const months: TrendMonthDatum[] = [
      { key: '2026-04', shortLabel: 'Apr', income: 0, expense: 0, hasData: false },
    ];
    assert.match(describeMissingTrendMonths(months) as string, /belum tersedia/);
  });
});

describe('describeCash30dAnalysis (blok AI analisa & prediksi kas)', () => {
  test('belum ada transaksi -> zero-state jujur', () => {
    assert.match(describeCash30dAnalysis(0, 0), /Belum ada transaksi/);
  });

  test('surplus -> kalimat menyebut surplus + margin', () => {
    const text = describeCash30dAnalysis(10000000, 4000000);
    assert.match(text, /surplus/);
    assert.match(text, /margin/);
  });

  test('defisit (pengeluaran > pemasukan) -> kalimat menyebut defisit', () => {
    const text = describeCash30dAnalysis(3000000, 5000000);
    assert.match(text, /defisit/);
  });
});

describe('priorityRank + filterTopRecommendations (2 rekomendasi FINANCE/STRATEGY)', () => {
  test('CRITICAL < HIGH < MEDIUM < LOW', () => {
    assert.ok(priorityRank('CRITICAL') < priorityRank('HIGH'));
    assert.ok(priorityRank('HIGH') < priorityRank('MEDIUM'));
    assert.ok(priorityRank('MEDIUM') < priorityRank('LOW'));
  });

  test('priority tak dikenal jatuh ke belakang, bukan error', () => {
    assert.ok(priorityRank('UNKNOWN_XYZ') > priorityRank('LOW'));
  });

  test('saring kategori FINANCE/STRATEGY, buang MARKETING/OPERATIONS, urut prioritas, ambil 2', () => {
    const recs: FinanceRecommendationLite[] = [
      { id: '1', category: 'MARKETING', priority: 'CRITICAL', title: 'A', prescription: 'a' },
      { id: '2', category: 'FINANCE', priority: 'MEDIUM', title: 'B', prescription: 'b' },
      { id: '3', category: 'STRATEGY', priority: 'CRITICAL', title: 'C', prescription: 'c' },
      { id: '4', category: 'FINANCE', priority: 'HIGH', title: 'D', prescription: 'd' },
      { id: '5', category: 'OPERATIONS', priority: 'CRITICAL', title: 'E', prescription: 'e' },
    ];
    const top = filterTopRecommendations(recs, ['FINANCE', 'STRATEGY'], 2);
    assert.equal(top.length, 2);
    assert.equal(top[0].id, '3'); // STRATEGY CRITICAL
    assert.equal(top[1].id, '4'); // FINANCE HIGH (lebih tinggi dari MEDIUM)
  });

  test('kategori relevan kosong -> array kosong, tidak error', () => {
    const recs: FinanceRecommendationLite[] = [
      { id: '1', category: 'MARKETING', priority: 'CRITICAL', title: 'A', prescription: 'a' },
    ];
    assert.deepEqual(filterTopRecommendations(recs, ['FINANCE', 'STRATEGY'], 2), []);
  });
});

describe('computeCashOutDateLabel (fallback, rumus sama seperti prediction-engine.ts)', () => {
  test('runway null/undefined -> null', () => {
    assert.equal(computeCashOutDateLabel(null), null);
    assert.equal(computeCashOutDateLabel(undefined), null);
  });

  test('runway <= 0 -> null (tidak ada dasar proyeksi)', () => {
    assert.equal(computeCashOutDateLabel(0), null);
    assert.equal(computeCashOutDateLabel(-2), null);
  });

  test('runway >= 90 bulan -> null (terlalu jauh utk diproyeksikan sebagai tanggal)', () => {
    assert.equal(computeCashOutDateLabel(90), null);
  });

  test('runway 2 bulan dari 10 Sep 2026 -> proyeksi ~pertengahan Nov 2026', () => {
    const label = computeCashOutDateLabel(2, new Date('2026-09-10T00:00:00Z'));
    assert.equal(label, 'Nov 2026');
  });
});

describe('mapPiutangReminderError (tombol Tagih -> piutang-reminder)', () => {
  test('400 dengan pesan server -> pakai pesan server apa adanya', () => {
    assert.equal(
      mapPiutangReminderError(400, 'Invoice ini tidak punya nomor WhatsApp pelanggan.'),
      'Invoice ini tidak punya nomor WhatsApp pelanggan.'
    );
  });

  test('404 -> pesan invoice tidak ditemukan', () => {
    assert.match(mapPiutangReminderError(404, null), /tidak ditemukan/);
  });

  test('500 tanpa pesan -> pesan generik jujur', () => {
    assert.match(mapPiutangReminderError(500, null), /Gagal menyiapkan/);
  });
});

// BH-013 (11 Sep 2026, Fable) -- pemilih periode Kas & Arus Kas. DEVIASI DARI
// KONTRAK AWAL dicatat di komentar resolvePeriodParams di komponen: preset
// range 'last_3_months'/'this_year'/'all' TIDAK diimplementasikan backend
// (time-series-engine.ts resolveDateRange dibaca penuh, cuma 3 cabang) --
// jadi 3 dari 4 opsi WAJIB pakai startDate/endDate eksplisit.
describe('resolvePeriodParams (BH-013)', () => {
  const now = new Date('2026-09-11T10:00:00.000Z');

  test("'bulan_ini' -> range=this_month (preset yang GENUINELY didukung backend)", () => {
    assert.deepEqual(resolvePeriodParams('bulan_ini', now), { range: 'this_month' });
  });

  test("'tiga_bulan' -> startDate awal bulan 2 bulan sebelumnya, endDate hari ini (BUKAN range='last_3_months' yang tidak ada di backend)", () => {
    const out = resolvePeriodParams('tiga_bulan', now);
    assert.deepEqual(out, { startDate: '2026-07-01', endDate: '2026-09-11' });
  });

  test("'tahun_ini' -> startDate 1 Januari tahun berjalan, endDate hari ini", () => {
    const out = resolvePeriodParams('tahun_ini', now);
    assert.deepEqual(out, { startDate: '2026-01-01', endDate: '2026-09-11' });
  });

  test("'semua' -> startDate 2000-01-01 (API tidak punya opsi 'tanpa filter tanggal')", () => {
    const out = resolvePeriodParams('semua', now);
    assert.deepEqual(out, { startDate: '2000-01-01', endDate: '2026-09-11' });
  });

  test("'tiga_bulan' pas pergantian tahun (Jan/Feb) tidak salah mundur ke tahun sebelumnya secara keliru", () => {
    const janNow = new Date('2026-01-15T00:00:00.000Z');
    const out = resolvePeriodParams('tiga_bulan', janNow);
    // 2 bulan sebelum Januari 2026 = November 2025.
    assert.deepEqual(out, { startDate: '2025-11-01', endDate: '2026-01-15' });
  });
});

describe('shouldFallbackToAllPeriod (BH-013 auto-fallback ke "Semua")', () => {
  test('periode 0 transaksi TAPI ada saldo kumulatif -> true (pindah ke Semua)', () => {
    assert.equal(shouldFallbackToAllPeriod(0, 1500000), true);
  });

  test('periode 0 transaksi DAN saldo kumulatif juga 0 (workspace genuinely kosong) -> false', () => {
    assert.equal(shouldFallbackToAllPeriod(0, 0), false);
  });

  test('periode sudah ada transaksi -> false, tidak perlu fallback walau saldo kumulatif besar', () => {
    assert.equal(shouldFallbackToAllPeriod(5, 1500000), false);
  });
});
