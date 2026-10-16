import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  inferFromHistory,
  mergeExplicitFeedback,
  buildReaderInstruction,
  DEFAULT_READER_PREFERENCES,
  type ReaderPreferences,
  type ReaderHistoryMessage,
} from '../src/lib/reader-preferences';

// ---------------------------------------------------------------------------
// B4-jawaban-mudah, dibuat 8 Sep 2026. Murni logic, tanpa mock -- reader-preferences.ts
// nol import, jadi tidak butuh node --experimental-test-module-mocks sama sekali,
// tapi tetap dijalankan lewat command standar (node --experimental-test-module-mocks
// --import tsx --test) sesuai kriteria_selesai yang sama untuk semua agent.
// ---------------------------------------------------------------------------

describe('inferFromHistory', () => {
  test('history kosong -> normal', () => {
    assert.equal(inferFromHistory([]), 'normal');
  });

  test('null/undefined -> normal (guard, tidak melempar)', () => {
    assert.equal(inferFromHistory(null), 'normal');
    assert.equal(inferFromHistory(undefined), 'normal');
  });

  test('cuma pesan assistant (tidak ada user) -> normal', () => {
    const history: ReaderHistoryMessage[] = [
      { role: 'assistant', content: 'ringkas banget nih jawabannya' },
      { role: 'assistant', content: 'detail lengkap ya' },
    ];
    assert.equal(inferFromHistory(history), 'normal');
  });

  test('kata kunci "ringkas" dari user -> lebih_sederhana', () => {
    const history: ReaderHistoryMessage[] = [{ role: 'user', content: 'tolong ringkas aja jawabannya' }];
    assert.equal(inferFromHistory(history), 'lebih_sederhana');
  });

  test('kata kunci "simpel" dari user -> lebih_sederhana', () => {
    const history: ReaderHistoryMessage[] = [{ role: 'user', content: 'yang simpel dong penjelasannya' }];
    assert.equal(inferFromHistory(history), 'lebih_sederhana');
  });

  test('kata kunci "detail" dari user -> lebih_detail', () => {
    const history: ReaderHistoryMessage[] = [{ role: 'user', content: 'kasih detail lengkap dong soal ini' }];
    assert.equal(inferFromHistory(history), 'lebih_detail');
  });

  test('kata kunci "lengkap" dari user -> lebih_detail', () => {
    const history: ReaderHistoryMessage[] = [{ role: 'user', content: 'jelasin yang lengkap ya' }];
    assert.equal(inferFromHistory(history), 'lebih_detail');
  });

  test('role dicek case-insensitive ("User" dihitung sama seperti "user")', () => {
    const history: ReaderHistoryMessage[] = [{ role: 'User', content: 'ringkas aja' }];
    assert.equal(inferFromHistory(history), 'lebih_sederhana');
  });

  test('pesan pendek tanpa kata kunci -> heuristik panjang, lebih_sederhana', () => {
    const history: ReaderHistoryMessage[] = [
      { role: 'user', content: 'ok' },
      { role: 'user', content: 'sip' },
      { role: 'user', content: 'y' },
    ];
    assert.equal(inferFromHistory(history), 'lebih_sederhana');
  });

  test('pesan panjang tanpa kata kunci -> tidak ada sinyal, normal', () => {
    const history: ReaderHistoryMessage[] = [
      {
        role: 'user',
        content: 'coba jelasin kenapa arus kas bulan ini turun dibanding bulan lalu, apa penyebab utamanya',
      },
    ];
    assert.equal(inferFromHistory(history), 'normal');
  });

  test('vote seimbang (1 sinyal sederhana, 1 sinyal detail) -> normal (tie)', () => {
    const history: ReaderHistoryMessage[] = [
      { role: 'user', content: 'ringkas aja ya' },
      { role: 'user', content: 'eh tapi kasih detail lengkap juga boleh' },
    ];
    assert.equal(inferFromHistory(history), 'normal');
  });

  test('hanya melihat HISTORY_WINDOW (5) pesan user terakhir -- pesan lama di luar jendela diabaikan', () => {
    const history: ReaderHistoryMessage[] = [
      { role: 'user', content: 'kasih detail lengkap dong dari awal' }, // di luar window
      { role: 'user', content: 'ringkas 1' },
      { role: 'user', content: 'ringkas 2' },
      { role: 'user', content: 'ringkas 3' },
      { role: 'user', content: 'ringkas 4' },
      { role: 'user', content: 'ringkas 5' },
    ];
    // window 5 pesan terakhir semuanya "ringkas", pesan detail di posisi paling awal terpotong.
    assert.equal(inferFromHistory(history), 'lebih_sederhana');
  });

  test('pesan pendek YANG membawa kata kunci detail tidak double-count sebagai sederhana', () => {
    // "detail dong" panjangnya <= 20 char, TAPI mengandung kata kunci "detail" -- heuristik
    // panjang tidak boleh menimpa sinyal kata kunci eksplisit yang berlawanan arah.
    const history: ReaderHistoryMessage[] = [{ role: 'user', content: 'detail dong' }];
    assert.equal(inferFromHistory(history), 'lebih_detail');
  });
});

describe('mergeExplicitFeedback', () => {
  test('tambah 1 signal ke base kosong', () => {
    const result = mergeExplicitFeedback(DEFAULT_READER_PREFERENCES, 'Pas');
    assert.deepEqual(result.signals, ['Pas']);
    // base TIDAK dimutasi (pure function)
    assert.deepEqual(DEFAULT_READER_PREFERENCES.signals, []);
  });

  test('field lain (simplicity/visual) tetap dipertahankan, tidak disentuh', () => {
    const base: ReaderPreferences = { simplicity: 'lebih_detail', visual: 'tabel', signals: [] };
    const result = mergeExplicitFeedback(base, 'Kurang detail');
    assert.equal(result.simplicity, 'lebih_detail');
    assert.equal(result.visual, 'tabel');
    assert.deepEqual(result.signals, ['Kurang detail']);
  });

  test('FIFO cap 5 -- signal ke-6 membuang signal PALING LAMA (index 0)', () => {
    let prefs: ReaderPreferences = { ...DEFAULT_READER_PREFERENCES, signals: [] };
    const inputs = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const s of inputs) {
      prefs = mergeExplicitFeedback(prefs, s);
    }
    assert.deepEqual(prefs.signals, ['B', 'C', 'D', 'E', 'F']);
    assert.equal(prefs.signals.length, 5);
  });

  test('signal lebih dari 80 karakter di-truncate ke 80', () => {
    const longSignal = 'x'.repeat(120);
    const result = mergeExplicitFeedback(DEFAULT_READER_PREFERENCES, longSignal);
    assert.equal(result.signals[0].length, 80);
    assert.equal(result.signals[0], 'x'.repeat(80));
  });

  test('signal kosong/whitespace-only diabaikan, base dikembalikan apa adanya', () => {
    const base: ReaderPreferences = { simplicity: 'normal', visual: 'auto', signals: ['ada satu'] };
    const result = mergeExplicitFeedback(base, '   ');
    assert.deepEqual(result.signals, ['ada satu']);
  });

  test('signal di-trim sebelum disimpan (whitespace pinggir dibuang)', () => {
    const result = mergeExplicitFeedback(DEFAULT_READER_PREFERENCES, '  Lebih visual  ');
    assert.deepEqual(result.signals, ['Lebih visual']);
  });

  test('base dengan signals bukan array (corrupt) -> fallback ke default, tidak melempar', () => {
    const corruptBase = { simplicity: 'normal', visual: 'auto', signals: undefined } as unknown as ReaderPreferences;
    const result = mergeExplicitFeedback(corruptBase, 'Pas');
    assert.deepEqual(result.signals, ['Pas']);
  });
});

describe('buildReaderInstruction', () => {
  test('prefs null/undefined -> string kosong', () => {
    assert.equal(buildReaderInstruction(null), '');
    assert.equal(buildReaderInstruction(undefined), '');
  });

  test('prefs default persis (normal/auto/signals kosong) -> string kosong', () => {
    assert.equal(buildReaderInstruction(DEFAULT_READER_PREFERENCES), '');
  });

  test('simplicity lebih_sederhana -> instruksi menyebut SEDERHANA', () => {
    const prefs: ReaderPreferences = { simplicity: 'lebih_sederhana', visual: 'auto', signals: [] };
    const out = buildReaderInstruction(prefs);
    assert.ok(out.includes('SEDERHANA'));
    assert.ok(out.length > 0);
  });

  test('simplicity lebih_detail -> instruksi menyebut DETAIL', () => {
    const prefs: ReaderPreferences = { simplicity: 'lebih_detail', visual: 'auto', signals: [] };
    const out = buildReaderInstruction(prefs);
    assert.ok(out.includes('DETAIL'));
  });

  test('visual tabel -> instruksi menyebut TABEL', () => {
    const prefs: ReaderPreferences = { simplicity: 'normal', visual: 'tabel', signals: [] };
    const out = buildReaderInstruction(prefs);
    assert.ok(out.includes('TABEL'));
  });

  test('visual prosa -> instruksi menyebut PROSA', () => {
    const prefs: ReaderPreferences = { simplicity: 'normal', visual: 'prosa', signals: [] };
    const out = buildReaderInstruction(prefs);
    assert.ok(out.includes('PROSA'));
  });

  test('signals terisi (meski simplicity/visual default) -> tetap menghasilkan instruksi berisi signal', () => {
    const prefs: ReaderPreferences = { simplicity: 'normal', visual: 'auto', signals: ['Terlalu rumit'] };
    const out = buildReaderInstruction(prefs);
    assert.ok(out.includes('Terlalu rumit'));
  });

  test('signals digabung dengan separator " | " sesuai urutan lama->baru', () => {
    const prefs: ReaderPreferences = { simplicity: 'normal', visual: 'auto', signals: ['A', 'B', 'C'] };
    const out = buildReaderInstruction(prefs);
    assert.ok(out.includes('A | B | C'));
  });

  test('kombinasi simplicity+visual+signals semua terisi -> semua muncul di output', () => {
    const prefs: ReaderPreferences = {
      simplicity: 'lebih_sederhana',
      visual: 'tabel',
      signals: ['Pas', 'Kurang detail'],
    };
    const out = buildReaderInstruction(prefs);
    assert.ok(out.includes('SEDERHANA'));
    assert.ok(out.includes('TABEL'));
    assert.ok(out.includes('Pas | Kurang detail'));
  });
});
