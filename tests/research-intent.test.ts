import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { detectResearchIntent, extractHorizonMonths, extractLocation } from '../src/lib/research-intent';

// research-intent.ts: fungsi murni, nol mock dibutuhkan. Dibuat 8 Sep 2026
// (wave B1-web-research).

describe('detectResearchIntent', () => {
  test('forecast: prediksi/proyeksi/masa depan', () => {
    assert.equal(detectResearchIntent('Tolong buatkan prediksi omzet 3 bulan ke depan'), 'forecast');
    assert.equal(detectResearchIntent('Mau lihat proyeksi kas bulan depan'), 'forecast');
    assert.equal(detectResearchIntent('Gimana masa depan bisnis saya kalau begini terus?'), 'forecast');
  });

  test('location: cabang baru / lokasi usaha / alamat kantor', () => {
    assert.equal(detectResearchIntent('Saya lagi mikir mau buka cabang baru di Bekasi'), 'location');
    assert.equal(detectResearchIntent('Analisis lokasi usaha saya cocok gak buat cabang baru'), 'location');
    assert.equal(detectResearchIntent('Alamat kantor saya di mana ya enaknya pindah'), 'location');
  });

  test('competitor: kompetitor/pesaing/riset pasar/bisnis di sekitar', () => {
    assert.equal(detectResearchIntent('Siapa aja kompetitor kedai kopi saya?'), 'competitor');
    assert.equal(detectResearchIntent('Tolong riset pasar untuk produk baru saya'), 'competitor');
    assert.equal(detectResearchIntent('Ada usaha sejenis di sekitar toko saya gak ya'), 'competitor');
  });

  test('trend: tren/trending/sedang terjadi', () => {
    assert.equal(detectResearchIntent('Kopi apa yang lagi tren tahun ini?'), 'trend');
    assert.equal(detectResearchIntent('Menu apa yang lagi hits di kalangan anak muda'), 'trend');
    assert.equal(detectResearchIntent('Apa yang sedang terjadi di industri F&B sekarang'), 'trend');
  });

  test('null untuk pesan bisnis biasa tanpa sinyal riset', () => {
    assert.equal(detectResearchIntent('Berapa total pengeluaran bulan ini?'), null);
    assert.equal(detectResearchIntent('Tolong buatkan invoice untuk pelanggan baru'), null);
    assert.equal(detectResearchIntent(''), null);
    assert.equal(detectResearchIntent('   '), null);
  });

  test('prioritas: forecast menang kalau kata kunci forecast dan competitor sama-sama muncul', () => {
    assert.equal(detectResearchIntent('Buatkan prediksi 3 bulan ke depan dengan riset pasar kompetitor'), 'forecast');
  });
});

describe('extractHorizonMonths', () => {
  test('1 bulan / sebulan / bulan depan -> 1', () => {
    assert.equal(extractHorizonMonths('proyeksi 1 bulan ke depan'), 1);
    assert.equal(extractHorizonMonths('perkiraan sebulan dari sekarang'), 1);
    assert.equal(extractHorizonMonths('gimana bulan depan'), 1);
  });

  test('3 bulan / kuartal / triwulan -> 3', () => {
    assert.equal(extractHorizonMonths('prediksi 3 bulan ke depan'), 3);
    assert.equal(extractHorizonMonths('proyeksi 1 kuartal berikutnya'), 3);
    assert.equal(extractHorizonMonths('laporan triwulan depan'), 3);
  });

  test('6 bulan / semester -> 6', () => {
    assert.equal(extractHorizonMonths('mau lihat 6 bulan ke depan'), 6);
    assert.equal(extractHorizonMonths('proyeksi semester depan'), 6);
  });

  test('1 tahun / tahun depan / setahun -> 12', () => {
    assert.equal(extractHorizonMonths('prediksi 1 tahun ke depan'), 12);
    assert.equal(extractHorizonMonths('gimana tahun depan'), 12);
    assert.equal(extractHorizonMonths('proyeksi setahun dari sekarang'), 12);
  });

  test('null kalau tidak ada pola horizon', () => {
    assert.equal(extractHorizonMonths('coba prediksi dong'), null);
    assert.equal(extractHorizonMonths(''), null);
  });
});

describe('extractLocation', () => {
  test('pola "di sekitar <lokasi>"', () => {
    assert.equal(extractLocation('ada kompetitor di sekitar Jalan Sudirman Jakarta gak ya'), 'Jalan Sudirman Jakarta gak ya');
  });

  test('pola "lokasi ... di <lokasi>"', () => {
    assert.equal(extractLocation('lokasi usaha saya di Bandung dekat alun-alun'), 'Bandung dekat alun-alun');
  });

  test('pola "alamat ... di <lokasi>"', () => {
    assert.equal(extractLocation('alamat kantor saya di Surabaya Barat'), 'Surabaya Barat');
  });

  test('null kalau tidak ada frasa lokasi yang cocok', () => {
    assert.equal(extractLocation('saya pengen belajar masak nasi goreng'), null);
    assert.equal(extractLocation(''), null);
  });

  test('null kalau kata "lokasi" muncul tanpa keterangan tempat setelahnya', () => {
    assert.equal(extractLocation('saya belum kasih tau lokasi'), null);
  });
});
