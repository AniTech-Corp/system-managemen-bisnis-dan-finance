// tests/auto-effort.test.ts
// BARU 11 Sep 2026 (wave B1-backend-routing). PURE unit test -- classifyEffort() tidak
// menyentuh Prisma/network sama sekali, langsung import fungsi murni.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { classifyEffort } from '../src/lib/ai-brain/auto-effort';

describe('auto-effort classifyEffort', () => {
  test('sapaan pendek (<=12 kata) tanpa kata analitis -> santai', () => {
    const result = classifyEffort({ message: 'Halo, selamat pagi semuanya!' });
    assert.equal(result.effort, 'santai');
  });

  // REVISI KOMANDO 11 Sep 2026 siang (Council SPEED pagar #1): pertanyaan pendek yang
  // menyebut entitas data bisnis bukan sapaan -> minimal normal (bukan santai 500 token).
  test('pertanyaan data pendek (kas/gaji/tugas/bisnis) -> normal, bukan santai', () => {
    assert.equal(classifyEffort({ message: 'kondisi kas gimana?' }).effort, 'normal');
    assert.equal(classifyEffort({ message: 'gaji saya bulan ini berapa?' }).effort, 'normal');
    assert.equal(classifyEffort({ message: 'tugas minggu depan ada apa saja?' }).effort, 'normal');
    assert.equal(classifyEffort({ message: 'Halo, gimana kondisi bisnis bulan ini?' }).effort, 'normal');
  });

  test('konfirmasi/sapaan pendek tetap santai', () => {
    assert.equal(classifyEffort({ message: 'oke lanjut' }).effort, 'santai');
    assert.equal(classifyEffort({ message: 'terima kasih ya' }).effort, 'santai');
  });

  test('pesan kosong -> santai (0 kata dianggap <= 12)', () => {
    const result = classifyEffort({ message: '' });
    assert.equal(result.effort, 'santai');
  });

  test('kata analitis memicu serius walau pesan pendek', () => {
    for (const kw of ['analisis', 'strategi', 'evaluasi', 'bandingkan', 'prediksi', 'proyeksi', 'rencana', 'kenapa', 'dampak', 'risiko', 'rekomendasi', 'laporan', 'hitung', 'simulasi', 'profit', 'rugi', 'untung', 'kelayakan']) {
      const result = classifyEffort({ message: `Tolong ${kw} dong` });
      assert.equal(result.effort, 'serius', `kata kunci "${kw}" harus memicu serius`);
      assert.ok(result.signals.some((s) => s.includes(kw)), `signal harus menyebut kata "${kw}"`);
    }
  });

  test('lampiran memicu serius walau pesan pendek tanpa kata analitis', () => {
    const result = classifyEffort({ message: 'Cek ini ya', hasAttachment: true });
    assert.equal(result.effort, 'serius');
    assert.ok(result.signals.includes('ada lampiran'));
  });

  test('pesan > 60 kata memicu serius walau tanpa kata analitis/lampiran', () => {
    const longMessage = Array.from({ length: 61 }, (_, i) => `kata${i}`).join(' ');
    const result = classifyEffort({ message: longMessage });
    assert.equal(result.effort, 'serius');
    assert.ok(result.signals.some((s) => s.includes('panjang')));
  });

  test('pesan persis 60 kata (tidak > 60) tanpa sinyal lain -> normal, bukan serius', () => {
    const message = Array.from({ length: 60 }, (_, i) => `kata${i}`).join(' ');
    const result = classifyEffort({ message });
    assert.equal(result.effort, 'normal');
  });

  test('assistantMode analis/riset memicu serius walau pesan pendek', () => {
    assert.equal(classifyEffort({ message: 'oke lanjut', assistantMode: 'analis' }).effort, 'serius');
    assert.equal(classifyEffort({ message: 'oke lanjut', assistantMode: 'riset' }).effort, 'serius');
  });

  test('assistantMode tanya/belajar TIDAK memicu serius dengan sendirinya', () => {
    assert.equal(classifyEffort({ message: 'oke lanjut', assistantMode: 'tanya' }).effort, 'santai');
    assert.equal(classifyEffort({ message: 'oke lanjut', assistantMode: 'belajar' }).effort, 'santai');
  });

  test('pesan sedang (>12 kata, <=60 kata) tanpa sinyal khusus -> normal', () => {
    const message = Array.from({ length: 20 }, (_, i) => `kata${i}`).join(' ');
    const result = classifyEffort({ message });
    assert.equal(result.effort, 'normal');
  });

  test('classifyEffort TIDAK PERNAH mengembalikan "maksimal"', () => {
    const cases = [
      { message: 'analisis laporan keuangan bulan ini secara mendalam dengan proyeksi risiko' },
      { message: 'x', hasAttachment: true },
      { message: Array.from({ length: 100 }, () => 'kata').join(' ') },
      { message: 'halo' },
      { message: 'apa kabar', assistantMode: 'riset' },
    ];
    for (const c of cases) {
      const result = classifyEffort(c as any);
      assert.notEqual(result.effort, 'maksimal');
    }
  });

  test('reason dan signals selalu berupa string/array (kontrak AutoEffortResult)', () => {
    const result = classifyEffort({ message: 'Analisis dong data ini' });
    assert.equal(typeof result.reason, 'string');
    assert.ok(Array.isArray(result.signals));
  });
});
