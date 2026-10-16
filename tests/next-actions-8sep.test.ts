import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildNextActions, type NextAction } from '../src/lib/ai-brain/next-actions';

// ---------------------------------------------------------------------------
// B4 TESTS -- V3 TOMBOL LANJUTAN: src/lib/ai-brain/next-actions.ts (8 Sep 2026)
//
// buildNextActions() adalah PURE FUNCTION deterministik (regex atas pesan yang
// SUDAH lowercase + nama lampiran opsional) -- larangan keras context pack:
// "HARAM LLM call tambahan per pesan untuk nextActions". Test ini memverifikasi
// (a) tiap kategori kata kunci memicu kind yang benar, (b) hasil tidak pernah
// >4 item walau semua kategori kepicu sekaligus, (c) fungsi SINKRON murni
// (return value bukan Promise).
//
// Dibaca ULANG dari disk (src/lib/ai-brain/next-actions.ts, 8 Sep 2026) sebelum
// menulis test -- signature FINAL persis draft kontrak:
// buildNextActions(lowerMessage: string, attachment?: { name?: string } | null): NextAction[]
// ---------------------------------------------------------------------------

function kinds(actions: NextAction[]): string[] {
  return actions.map((a) => a.kind);
}

describe('next-actions.ts -- buildNextActions (V3)', () => {
  test('pesan laporan keuangan -> berisi ppt, excel, word', () => {
    const actions = buildNextActions('jelaskan laporan keuangan bulan ini');
    assert.deepEqual(kinds(actions), ['ppt', 'excel', 'word']);
    for (const a of actions) {
      assert.equal(typeof a.id, 'string');
      assert.equal(typeof a.label, 'string');
      assert.equal(typeof a.brief, 'string');
      assert.ok(a.label.length > 0);
      assert.ok(a.brief.length > 0);
    }
  });

  test('pesan konten/promosi -> berisi image, video', () => {
    // Sengaja HINDARI kata "materi" -- itu juga match LEARNING_SIGNAL
    // (/belajar|materi|pelajari|.../), beda dari "materi pemasaran" (frasa
    // utuh) yang cuma dicek PROMO_SIGNAL. Verified langsung ke source 8 Sep.
    const actions = buildNextActions('bikin konten promosi banner untuk kampanye baru');
    assert.deepEqual(kinds(actions), ['image', 'video']);
  });

  test('pesan belajar/kuis -> berisi quiz, flashcard', () => {
    const actions = buildNextActions('buatkan kuis dari materi ini biar tim gampang belajar');
    assert.deepEqual(kinds(actions), ['quiz', 'flashcard']);
  });

  test('lampiran .xlsx tanpa kata kunci lain -> berisi import-ledger', () => {
    const actions = buildNextActions('tolong lihat file ini', { name: 'data.xlsx' });
    assert.deepEqual(kinds(actions), ['import-ledger']);
    assert.match(actions[0].brief, /data\.xlsx/);
  });

  test('lampiran .csv dan .xls juga memicu import-ledger (bukan cuma xlsx)', () => {
    assert.deepEqual(kinds(buildNextActions('cek dong', { name: 'rekap.csv' })), ['import-ledger']);
    assert.deepEqual(kinds(buildNextActions('cek dong', { name: 'rekap.xls' })), ['import-ledger']);
  });

  test('lampiran .pdf TIDAK memicu import-ledger', () => {
    assert.deepEqual(buildNextActions('cek dong', { name: 'kontrak.pdf' }), []);
  });

  test('pesan tanpa kata kunci apapun & attachment null -> array kosong', () => {
    assert.deepEqual(buildNextActions('halo, apa kabar?', null), []);
  });

  test('pesan tanpa kata kunci apapun & attachment tidak diisi (undefined) -> array kosong', () => {
    assert.deepEqual(buildNextActions('halo, apa kabar?'), []);
  });

  test('attachment tanpa name (name undefined) -> tidak crash, tidak menambah import-ledger', () => {
    assert.deepEqual(buildNextActions('halo', { name: undefined }), []);
  });

  test('hasil TIDAK PERNAH lebih dari 4 item, walau SEMUA kategori kepicu sekaligus', () => {
    const actions = buildNextActions(
      'laporan keuangan bulan ini, sekalian bikin promo iklan dan kuis belajar',
      { name: 'data.xlsx' }
    );
    assert.ok(actions.length <= 4, `expected <=4, got ${actions.length}`);
    // Urutan prioritas terkunci: kategori laporan/keuangan dipush duluan, jadi
    // dengan slot maks 4 dan 3 kind di kategori ini, slot ke-4 harus terisi
    // oleh kind pertama kategori berikutnya yang push (image, promo/konten).
    assert.deepEqual(kinds(actions), ['ppt', 'excel', 'word', 'image']);
  });

  test('fungsi SINKRON murni -- return value array biasa, bukan Promise', () => {
    const result = buildNextActions('laporan keuangan');
    assert.equal(result instanceof Promise, false);
    assert.ok(Array.isArray(result));
  });

  test('setiap action.id unik dalam satu hasil (dipakai sebagai React key)', () => {
    const actions = buildNextActions('laporan keuangan kas omset');
    const ids = actions.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  // 8 Sep malam (feedback Mecca, diulang 2x -- "generate PPT dari riset, sumbernya
  // ikut"): sources opsional param ke-3, ditempel ke brief ppt/word/excel supaya
  // dokumen hasil generate ikut membawa rujukan, bukan cuma prosa jawaban.
  describe('buildNextActions -- sources (8 Sep malam)', () => {
    const SOURCES = [
      { title: 'accurate.id', url: 'https://accurate.id/artikel' },
      { title: 'firstpage.id', url: 'https://firstpage.id/blog' },
    ];

    test('tanpa sources -> brief ppt/word/excel PERSIS sama seperti sebelum field ini ada (klien lama aman)', () => {
      const actions = buildNextActions('laporan keuangan');
      const ppt = actions.find((a) => a.kind === 'ppt')!;
      assert.equal(ppt.brief, 'Buatkan PPT ringkasan dari jawaban di atas, format profesional 5-7 slide.');
      assert.ok(!ppt.brief.includes('Sumber:'));
    });

    test('sources kosong ([]) -> perlakuan sama seperti tanpa sources (bukan blok "Sumber:" kosong)', () => {
      const actions = buildNextActions('laporan keuangan', null, []);
      const ppt = actions.find((a) => a.kind === 'ppt')!;
      assert.ok(!ppt.brief.includes('Sumber:'));
    });

    test('sources terisi -> ppt/word/excel SEMUA dapat blok "Sumber:" berisi judul+url', () => {
      const actions = buildNextActions('laporan keuangan', null, SOURCES);
      for (const kind of ['ppt', 'word', 'excel'] as const) {
        const a = actions.find((x) => x.kind === kind)!;
        assert.ok(a.brief.includes('Sumber:'), `${kind} brief harus punya blok Sumber`);
        assert.ok(a.brief.includes('accurate.id: https://accurate.id/artikel'));
        assert.ok(a.brief.includes('firstpage.id: https://firstpage.id/blog'));
      }
    });

    test('sources dipotong maksimal 6 (dokumen tidak dibanjiri rujukan)', () => {
      const many = Array.from({ length: 9 }, (_, i) => ({ title: `src${i}.id`, url: `https://src${i}.id` }));
      const actions = buildNextActions('laporan keuangan', null, many);
      const ppt = actions.find((a) => a.kind === 'ppt')!;
      const lines = ppt.brief.split('\n').filter((l) => l.startsWith('- '));
      assert.equal(lines.length, 6);
    });

    test('kind non-dokumen (mis. riset/prediksi) TIDAK ikut ditempeli Sumber (bukan tujuannya)', () => {
      const actions = buildNextActions('kompetitor di sekitar toko saya', null, SOURCES);
      const riset = actions.find((a) => a.kind === 'riset');
      assert.ok(riset && !riset.brief.includes('Sumber:'));
    });
  });
});
