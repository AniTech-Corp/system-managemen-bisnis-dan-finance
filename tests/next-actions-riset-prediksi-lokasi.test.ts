import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildNextActions, type NextAction } from '../src/lib/ai-brain/next-actions';

// ---------------------------------------------------------------------------
// B4 TESTS -- 3 NextActionKind BARU (riset/prediksi/lokasi), 8 Sep 2026 wave
// B4-chat-wiring-backend. Sama pola dengan tests/next-actions-8sep.test.ts
// (pure function murni, nol mock diperlukan). File TERPISAH (bukan extend
// next-actions-8sep.test.ts) karena spesifikasi tugas B4 eksplisit mengizinkan
// keduanya ("baru, atau extend next-actions-8sep.test.ts kalau lebih pas") --
// dipilih terpisah supaya laporan B1's next-actions-8sep.test.ts (kalau ada
// wave lain menyentuhnya paralel) tidak konflik file dengan punya saya.
//
// CATATAN DESAIN (lihat komentar di next-actions.ts): COMPETITOR_SIGNAL TIDAK
// memuat "cabang baru" (dipindah ke LOCATION_SIGNAL sendiri) -- beda dari draf
// literal di spesifikasi, keputusan sepihak B4, diverifikasi test di bawah.
// ---------------------------------------------------------------------------

function kinds(actions: NextAction[]): string[] {
  return actions.map((a) => a.kind);
}

describe('next-actions.ts -- 3 kind baru (riset/prediksi/lokasi)', () => {
  test('pesan kompetitor -> berisi kind riset', () => {
    const actions = buildNextActions('siapa kompetitor saya di sekitar toko?');
    assert.ok(kinds(actions).includes('riset'));
    const riset = actions.find((a) => a.kind === 'riset')!;
    assert.equal(typeof riset.label, 'string');
    assert.ok(riset.label.length > 0);
    assert.ok(riset.brief.length > 0);
  });

  test('pesan "trending" -> berisi kind riset', () => {
    const actions = buildNextActions('kopi apa yang lagi trending sekarang?');
    assert.ok(kinds(actions).includes('riset'));
  });

  test('pesan "di sekitar" -> berisi kind riset', () => {
    const actions = buildNextActions('bisnis apa aja yang ada di sekitar sini?');
    assert.ok(kinds(actions).includes('riset'));
  });

  test('pesan "cabang baru" -> berisi kind lokasi, BUKAN riset', () => {
    const actions = buildNextActions('saya mau buka cabang baru, cocok gak di sini?');
    assert.ok(kinds(actions).includes('lokasi'));
    assert.ok(!kinds(actions).includes('riset'), 'cabang baru seharusnya masuk lokasi, bukan riset (keputusan desain B4)');
  });

  test('pesan "alamat kantor" -> berisi kind lokasi', () => {
    const actions = buildNextActions('analisis alamat kantor saya dong');
    assert.ok(kinds(actions).includes('lokasi'));
  });

  test('pesan "lokasi usaha" -> berisi kind lokasi', () => {
    const actions = buildNextActions('lokasi usaha saya strategis gak ya');
    assert.ok(kinds(actions).includes('lokasi'));
  });

  test('pesan prediksi -> berisi kind prediksi', () => {
    const actions = buildNextActions('buatkan prediksi bisnis saya dong');
    assert.ok(kinds(actions).includes('prediksi'));
  });

  test('pesan "proyeksi 3 bulan" -> berisi kind prediksi', () => {
    const actions = buildNextActions('minta proyeksi 3 bulan ke depan');
    assert.ok(kinds(actions).includes('prediksi'));
  });

  test('pesan "masa depan" -> berisi kind prediksi', () => {
    const actions = buildNextActions('gimana masa depan bisnis saya kalau begini terus?');
    assert.ok(kinds(actions).includes('prediksi'));
  });

  test('pesan "1 tahun" -> berisi kind prediksi', () => {
    const actions = buildNextActions('proyeksikan 1 tahun ke depan');
    assert.ok(kinds(actions).includes('prediksi'));
  });

  test('pesan tidak relevan (laporan keuangan biasa) -> TIDAK berisi riset/prediksi/lokasi', () => {
    const actions = buildNextActions('jelaskan laporan keuangan bulan ini');
    const k = kinds(actions);
    assert.ok(!k.includes('riset'));
    assert.ok(!k.includes('prediksi'));
    assert.ok(!k.includes('lokasi'));
  });

  test('pesan netral tanpa kata kunci apapun -> array kosong', () => {
    const actions = buildNextActions('halo, apa kabar?');
    assert.deepEqual(actions, []);
  });

  test('gabungan kompetitor + prediksi + lokasi sekaligus -> maks 4 slot tetap dihormati', () => {
    // "kompetitor di sekitar cabang baru saya, prediksi 3 bulan ke depan" cocok
    // COMPETITOR_SIGNAL ('di sekitar'), LOCATION_SIGNAL ('cabang baru'), DAN
    // PREDICTION_SIGNAL ('3 bulan') sekaligus -- pastikan tetap <=4 total (push()
    // sudah punya guard out.length<4 bawaan, test ini verifikasi TIDAK regresi).
    const actions = buildNextActions('riset kompetitor di sekitar rencana cabang baru saya, sekalian prediksi 3 bulan ke depan');
    assert.ok(actions.length <= 4);
    const k = kinds(actions);
    assert.ok(k.includes('riset'));
    assert.ok(k.includes('lokasi'));
    assert.ok(k.includes('prediksi'));
  });

  test('brief tombol riset/lokasi/prediksi lolos deteksi ulang oleh regex sendiri (konsistensi klik-tombol)', () => {
    // Kontrak lintas-file: brief yang dikirim tombol ini nantinya diteruskan B5
    // sebagai pesan chat biasa ke brain/chat/route.ts, yang lalu memanggil
    // detectResearchIntent() (research-intent.ts, milik B1) atas teks itu.
    // Test ini HANYA memverifikasi brief-nya sendiri cocok regex LOKAL di file
    // next-actions.ts (bukan research-intent.ts -- itu di luar kepemilikan_berkas
    // B4 untuk file itu, sudah ditest B1 sendiri) -- cukup untuk memastikan tombol
    // tidak mengirim teks kosmetik yang tidak match apapun.
    const risetActions = buildNextActions('kompetitor di sekitar saya');
    const riset = risetActions.find((a) => a.kind === 'riset')!;
    assert.ok(/kompetitor|pesaing|trending|di sekitar/.test(riset.brief.toLowerCase()));

    const lokasiActions = buildNextActions('mau buka cabang baru');
    const lokasi = lokasiActions.find((a) => a.kind === 'lokasi')!;
    assert.ok(/lokasi|cabang|bisnis|di sekitarnya/.test(lokasi.brief.toLowerCase()));

    const prediksiActions = buildNextActions('minta prediksi dong');
    const prediksi = prediksiActions.find((a) => a.kind === 'prediksi')!;
    assert.ok(/prediksi|proyeksi|3 bulan/.test(prediksi.brief.toLowerCase()));
  });

  test('NextActionKind union baru tidak merusak kind lama (regresi 8 kind existing tetap jalan)', () => {
    const actions = buildNextActions('jelaskan laporan keuangan bulan ini');
    assert.deepEqual(kinds(actions), ['ppt', 'excel', 'word']);
  });
});
