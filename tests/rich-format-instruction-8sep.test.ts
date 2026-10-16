import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { RICH_FORMAT_INSTRUCTION } from '../src/lib/ai-brain/rich-format-instruction';

// ---------------------------------------------------------------------------
// B4 TESTS -- V2 JAWABAN VISUAL: src/lib/ai-brain/rich-format-instruction.ts
// (8 Sep 2026). File ini murni string instruksi statis (tidak ada logic
// render/deteksi di sini -- itu tugas RichMessage.tsx di sisi klien), jadi
// test cukup memverifikasi bentuk & isi kunci string-nya, bukan behavior.
//
// Dibaca ULANG dari disk sebelum menulis test -- nama ekspor FINAL persis
// draft kontrak: RICH_FORMAT_INSTRUCTION (string tunggal, sudah di-.trim()).
// ---------------------------------------------------------------------------

describe('rich-format-instruction.ts -- RICH_FORMAT_INSTRUCTION (V2)', () => {
  test('adalah string non-kosong', () => {
    assert.equal(typeof RICH_FORMAT_INSTRUCTION, 'string');
    assert.ok(RICH_FORMAT_INSTRUCTION.length > 0);
  });

  test('mengandung instruksi tabel markdown', () => {
    assert.match(RICH_FORMAT_INSTRUCTION, /[Tt]abel markdown/);
  });

  test('mengandung contoh blok kode (tiga backtick) untuk ASCII bar chart', () => {
    assert.ok(RICH_FORMAT_INSTRUCTION.includes('```'), 'harus memuat contoh blok ``` literal');
    assert.match(RICH_FORMAT_INSTRUCTION, /ASCII/);
  });

  test('mengandung poin "Artinya buat kamu"', () => {
    assert.match(RICH_FORMAT_INSTRUCTION, /Artinya buat kamu/);
  });

  test('mengandung larangan basa-basi ala AI ("Tentu!")', () => {
    assert.match(RICH_FORMAT_INSTRUCTION, /Tentu!/);
  });

  test('mengandung syarat angka WAJIB dari data (anti-karangan/anti-halusinasi finansial)', () => {
    assert.match(RICH_FORMAT_INSTRUCTION, /data belum tersedia|karangan|WAJIB berasal dari/);
  });

  test('mengandung dukungan mind-map indentasi untuk pertanyaan konsep/struktur', () => {
    assert.match(RICH_FORMAT_INSTRUCTION, /mind-map/i);
  });

  test('tidak diawali/diakhiri whitespace (sudah di-trim sebelum diekspor)', () => {
    assert.equal(RICH_FORMAT_INSTRUCTION, RICH_FORMAT_INSTRUCTION.trim());
  });
});
