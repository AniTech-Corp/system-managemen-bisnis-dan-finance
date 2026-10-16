// Test untuk logika MURNI di 3 kartu baru wave B5-chat-wiring-ui (8 Sep 2026):
// ResearchSourcesCard.tsx, ForecastCard.tsx, LocationForm.tsx. Sengaja HANYA
// mengimpor named export fungsi murni (formatFetchedAt, dedupeSources,
// formatRupiah, buildForecastExtraData, isLocationInputValid, buildLocationInput)
// -- TIDAK ADA render React sama sekali di file ini (tidak butuh jsdom/testing-
// library, tidak terpasang di project ini). Pola persis sama seperti
// tests/composer-toolbar.test.ts (probe import manual sudah dibuktikan aman lewat
// tsc + tests lain yang sudah mengimpor .tsx serupa, lihat komentar file itu).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatFetchedAt, dedupeSources } from '../src/app/components/chat/ResearchSourcesCard';
import { formatRupiah, buildForecastExtraData } from '../src/app/components/chat/ForecastCard';
import { isLocationInputValid, buildLocationInput } from '../src/app/components/chat/LocationForm';

describe('ResearchSourcesCard: formatFetchedAt', () => {
  test('ISO 8601 valid -> string tanggal Indonesia (bukan ISO mentah)', () => {
    const out = formatFetchedAt('2026-09-08T07:32:00.000Z');
    assert.ok(out.length > 0);
    assert.notEqual(out, '2026-09-08T07:32:00.000Z');
    assert.match(out, /2026/);
  });

  test('string bukan tanggal valid -> fallback return apa adanya (tidak throw)', () => {
    assert.equal(formatFetchedAt('bukan-tanggal'), 'bukan-tanggal');
  });
});

describe('ResearchSourcesCard: dedupeSources', () => {
  test('URL duplikat dibuang, urutan pertama menang', () => {
    const out = dedupeSources([
      { title: 'A', url: 'https://x.test/a' },
      { title: 'B duplikat', url: 'https://x.test/a' },
      { title: 'C', url: 'https://x.test/c' },
    ]);
    assert.equal(out.length, 2);
    assert.equal(out[0].title, 'A');
    assert.equal(out[1].title, 'C');
  });

  test('entry tanpa url dibuang', () => {
    const out = dedupeSources([
      { title: 'Tanpa URL', url: '' },
      { title: 'Valid', url: 'https://x.test/valid' },
    ]);
    assert.equal(out.length, 1);
    assert.equal(out[0].title, 'Valid');
  });

  test('array kosong -> array kosong (tidak throw)', () => {
    assert.deepEqual(dedupeSources([]), []);
  });
});

describe('ForecastCard: formatRupiah', () => {
  test('angka positif -> "Rp " + pemisah ribuan gaya Indonesia', () => {
    assert.equal(formatRupiah(12345678), 'Rp 12.345.678');
  });

  test('angka negatif -> tanda minus di depan "Rp"', () => {
    assert.equal(formatRupiah(-500000), '-Rp 500.000');
  });

  test('nol -> "Rp 0"', () => {
    assert.equal(formatRupiah(0), 'Rp 0');
  });
});

describe('ForecastCard: buildForecastExtraData', () => {
  test('semua field kosong -> objek kosong (tidak error)', () => {
    const out = buildForecastExtraData({ targetRevenue: '', priceChangePct: '', newBranch: false, costChangePct: '', notes: '' });
    assert.deepEqual(out, {});
  });

  test('targetRevenue <=0 atau bukan angka -> diabaikan (server tolak <=0 via zod positive())', () => {
    const out1 = buildForecastExtraData({ targetRevenue: '0', priceChangePct: '', newBranch: false, costChangePct: '', notes: '' });
    assert.equal(out1.targetRevenue, undefined);
    const out2 = buildForecastExtraData({ targetRevenue: 'bukan-angka', priceChangePct: '', newBranch: false, costChangePct: '', notes: '' });
    assert.equal(out2.targetRevenue, undefined);
  });

  test('field valid semua terisi -> masuk objek hasil', () => {
    const out = buildForecastExtraData({
      targetRevenue: '50000000',
      priceChangePct: '10',
      newBranch: true,
      costChangePct: '-5',
      notes: 'Rencana promo akhir bulan',
    });
    assert.equal(out.targetRevenue, 50000000);
    assert.equal(out.priceChangePct, 10);
    assert.equal(out.newBranch, true);
    assert.equal(out.costChangePct, -5);
    assert.equal(out.notes, 'Rencana promo akhir bulan');
  });

  test('newBranch false -> field TIDAK dimasukkan sama sekali (bukan false eksplisit)', () => {
    const out = buildForecastExtraData({ targetRevenue: '', priceChangePct: '', newBranch: false, costChangePct: '', notes: '' });
    assert.equal('newBranch' in out, false);
  });

  test('notes dipotong 500 karakter -- cermin batas zod brain/forecast/route.ts', () => {
    const long = 'x'.repeat(600);
    const out = buildForecastExtraData({ targetRevenue: '', priceChangePct: '', newBranch: false, costChangePct: '', notes: long });
    assert.equal(out.notes?.length, 500);
  });
});

describe('LocationForm: isLocationInputValid', () => {
  test('3 field wajib terisi -> true', () => {
    assert.equal(isLocationInputValid({ businessName: 'Kedai A', category: 'Kopi', area: 'Bekasi' }), true);
  });

  test('salah satu field kosong -> false', () => {
    assert.equal(isLocationInputValid({ businessName: '', category: 'Kopi', area: 'Bekasi' }), false);
    assert.equal(isLocationInputValid({ businessName: 'Kedai A', category: '', area: 'Bekasi' }), false);
    assert.equal(isLocationInputValid({ businessName: 'Kedai A', category: 'Kopi', area: '' }), false);
  });

  test('field cuma whitespace -> dianggap kosong (trim dulu)', () => {
    assert.equal(isLocationInputValid({ businessName: '   ', category: 'Kopi', area: 'Bekasi' }), false);
  });
});

describe('LocationForm: buildLocationInput', () => {
  test('field wajib belum lengkap -> null (pemanggil TIDAK boleh kirim ke server)', () => {
    const out = buildLocationInput({ businessName: '', category: 'Kopi', area: 'Bekasi', radiusKm: '2', purpose: 'sekitar_kantor' });
    assert.equal(out, null);
  });

  test('field lengkap + radius valid -> LocationAnalysisInput siap kirim, trim di setiap field', () => {
    const out = buildLocationInput({
      businessName: '  Kedai Kopi Senja  ',
      category: ' Kopi ',
      area: ' Jl. Merdeka, Bekasi ',
      radiusKm: '3.5',
      purpose: 'cabang_baru',
    });
    assert.deepEqual(out, {
      businessName: 'Kedai Kopi Senja',
      category: 'Kopi',
      area: 'Jl. Merdeka, Bekasi',
      radiusKm: 3.5,
      purpose: 'cabang_baru',
    });
  });

  test('radiusKm kosong/nol/negatif/bukan-angka -> undefined (server pakai default 2)', () => {
    for (const r of ['', '0', '-1', 'abc']) {
      const out = buildLocationInput({ businessName: 'A', category: 'B', area: 'C', radiusKm: r, purpose: 'sekitar_kantor' });
      assert.equal(out?.radiusKm, undefined);
    }
  });
});
