import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  detectAnswerMode,
  getAnswerModeInstruction,
} from '../src/lib/ai-brain/answer-mode';

describe('detectAnswerMode', () => {
  // --- Mode PEMAHAMAN: ada tanda bingung -------------------------------
  test('anchor literal "kenapa" -> PEMAHAMAN', () => {
    const r = detectAnswerMode('kenapa arus kas bulan ini turun?');
    assert.equal(r.mode, 'PEMAHAMAN');
    assert.equal(r.matchedSignal, 'kenapa');
  });

  test('anchor literal "gimana caranya" -> PEMAHAMAN', () => {
    const r = detectAnswerMode('gimana caranya biar piutang gak macet terus?');
    assert.equal(r.mode, 'PEMAHAMAN');
    assert.equal(r.matchedSignal, 'gimana caranya');
  });

  test('anchor literal "saya belum paham" -> PEMAHAMAN', () => {
    const r = detectAnswerMode('saya belum paham maksud dari runway itu apa');
    assert.equal(r.mode, 'PEMAHAMAN');
    // "belum paham" match muncul lebih dulu di teks lewat pola "saya belum paham"
    assert.equal(r.matchedSignal, 'saya belum paham');
  });

  test('anchor literal "maksudnya apa" -> PEMAHAMAN', () => {
    const r = detectAnswerMode('CAC itu maksudnya apa ya?');
    assert.equal(r.mode, 'PEMAHAMAN');
    assert.equal(r.matchedSignal, 'maksudnya apa');
  });

  test('variasi "bagaimana cara" (bukan literal "gimana caranya") -> tetap PEMAHAMAN', () => {
    const r = detectAnswerMode('bagaimana cara menghitung margin bersih?');
    assert.equal(r.mode, 'PEMAHAMAN');
  });

  test('variasi bahasa gaul "gue masih belum ngerti" -> PEMAHAMAN', () => {
    const r = detectAnswerMode('gue masih belum ngerti soal HPP ini');
    assert.equal(r.mode, 'PEMAHAMAN');
  });

  test('variasi "mengapa" (formal) -> PEMAHAMAN', () => {
    const r = detectAnswerMode('mengapa saldo kas bisa minus?');
    assert.equal(r.mode, 'PEMAHAMAN');
    assert.equal(r.matchedSignal, 'mengapa');
  });

  test('variasi "tolong jelaskan" -> PEMAHAMAN', () => {
    const r = detectAnswerMode('tolong jelaskan kenapa laporan ini beda dari bulan lalu');
    assert.equal(r.mode, 'PEMAHAMAN');
  });

  // --- Mode JAWABAN: pertanyaan pendek/langsung, tidak ada tanda bingung -
  test('pertanyaan angka langsung -> JAWABAN', () => {
    const r = detectAnswerMode('berapa saldo kas sekarang?');
    assert.equal(r.mode, 'JAWABAN');
    assert.equal(r.matchedSignal, null);
  });

  test('perintah langsung tanpa tanda bingung -> JAWABAN', () => {
    const r = detectAnswerMode('buatkan invoice untuk PT Sentosa Abadi');
    assert.equal(r.mode, 'JAWABAN');
  });

  test('pertanyaan status singkat -> JAWABAN', () => {
    const r = detectAnswerMode('invoice bulan ini sudah lunas semua?');
    assert.equal(r.mode, 'JAWABAN');
  });

  test('pesan kosong -> default JAWABAN, tidak error', () => {
    const r = detectAnswerMode('');
    assert.equal(r.mode, 'JAWABAN');
    assert.equal(r.matchedSignal, null);
  });

  test('input null/undefined -> default JAWABAN, tidak throw', () => {
    assert.doesNotThrow(() => detectAnswerMode(null as unknown as string));
    assert.doesNotThrow(() => detectAnswerMode(undefined));
    assert.equal(detectAnswerMode(null as unknown as string).mode, 'JAWABAN');
    assert.equal(detectAnswerMode(undefined).mode, 'JAWABAN');
  });

  test('deteksi case-insensitive ("KENAPA" huruf besar) -> PEMAHAMAN', () => {
    const r = detectAnswerMode('KENAPA BEGINI TERUS');
    assert.equal(r.mode, 'PEMAHAMAN');
  });

  test('kata "kenapa" sebagai bagian kata lain TIDAK ikut ke-match (word boundary)', () => {
    // "mengenapain" bukan kata nyata, tapi ini menguji \b tidak nyangkut ke substring acak
    const r = detectAnswerMode('menganalisiskenapaannya susah dibaca robot');
    // "kenapa" di sini nempel tanpa word boundary di kedua sisi -> TIDAK match
    assert.equal(r.mode, 'JAWABAN');
  });
});

describe('getAnswerModeInstruction', () => {
  test('mode JAWABAN -> instruksi minta ringkas, angka di depan', () => {
    const text = getAnswerModeInstruction({ mode: 'JAWABAN', matchedSignal: null });
    assert.match(text, /MODE JAWABAN/);
    assert.match(text, /RINGKAS/);
  });

  test('mode PEMAHAMAN -> instruksi minta bertahap + sebut sinyal yang match', () => {
    const text = getAnswerModeInstruction({ mode: 'PEMAHAMAN', matchedSignal: 'kenapa' });
    assert.match(text, /MODE PEMAHAMAN/);
    assert.match(text, /BERTAHAP/);
    assert.match(text, /"kenapa"/);
  });

  test('mode PEMAHAMAN dengan workspaceName -> ikut disebut di instruksi', () => {
    const text = getAnswerModeInstruction(
      { mode: 'PEMAHAMAN', matchedSignal: 'maksudnya apa' },
      'Warung Kopi Senja'
    );
    assert.match(text, /bisnis Warung Kopi Senja/);
  });

  test('mode PEMAHAMAN tanpa workspaceName -> fallback generik, tidak throw', () => {
    const text = getAnswerModeInstruction({ mode: 'PEMAHAMAN', matchedSignal: 'kenapa' });
    assert.match(text, /bisnis pengguna/);
  });
});
