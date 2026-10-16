import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseInlineSegments, parseMarkdownBlocks } from '../src/lib/chat-markdown';

// ---------------------------------------------------------------------------
// B4 TESTS -- V1 RENDER KAYA: src/lib/chat-markdown.ts (8 Sep 2026)
//
// Modul ini PURE (nol import React/JSX), jadi bisa dites langsung tanpa jsdom.
// Fokus: (a) kompatibilitas mundur -- pesan lama yang cuma pakai **bold**/list
// harus tetap terurai sama seperti sebelumnya (regresi nol); (b) cabang BARU
// blok fenced ``` (mind-map/ASCII bar chart) yang dulu TIDAK ADA di 3 view;
// (c) heuristik numericCols per-KOLOM (bukan per-sel) untuk tabel markdown.
//
// Dibaca ULANG dari disk (src/lib/chat-markdown.ts, 8 Sep 2026) sebelum menulis
// test ini -- nama fungsi/tipe FINAL: parseInlineSegments, parseMarkdownBlocks,
// InlineSegment (union type|bold|italic|code|br|source), ParsedBlock (union
// code|table|heading|blockquote|bullet|numbered|hr|blank|paragraph). Union
// ParsedBlock 'numbered' punya field `num` (bukan cuma `text`) -- beda dari
// draft kontrak awal yang tidak menyebut field ini secara eksplisit; dicatat
// di laporan akhir, test di bawah mengikuti bentuk final ini.
// ---------------------------------------------------------------------------

describe('chat-markdown.ts -- parseInlineSegments (V1)', () => {
  test('teks polos tanpa marker apapun -> 1 segmen text utuh', () => {
    const segs = parseInlineSegments('Halo, ini teks biasa.');
    assert.deepEqual(segs, [{ type: 'text', value: 'Halo, ini teks biasa.' }]);
  });

  test('**bold** -> segmen bold, isi tanpa tanda bintang', () => {
    const segs = parseInlineSegments('Angka **penting** ini.');
    assert.deepEqual(segs, [
      { type: 'text', value: 'Angka ' },
      { type: 'bold', value: 'penting' },
      { type: 'text', value: ' ini.' },
    ]);
  });

  test('*italic* -> segmen italic', () => {
    const segs = parseInlineSegments('*catatan kecil*');
    assert.deepEqual(segs, [{ type: 'italic', value: 'catatan kecil' }]);
  });

  test('`code` -> segmen code', () => {
    const segs = parseInlineSegments('pakai `npm install` dulu');
    assert.deepEqual(segs, [
      { type: 'text', value: 'pakai ' },
      { type: 'code', value: 'npm install' },
      { type: 'text', value: ' dulu' },
    ]);
  });

  test('<b>..</b> dan <i>..</i> tetap dikenali (kompat mundur, LLM lama kadang pakai tag ini)', () => {
    const segs = parseInlineSegments('<b>tebal</b> dan <i>miring</i>');
    assert.deepEqual(segs, [
      { type: 'bold', value: 'tebal' },
      { type: 'text', value: ' dan ' },
      { type: 'italic', value: 'miring' },
    ]);
  });

  test('<br> memecah jadi segmen br terpisah di antara dua bagian teks', () => {
    const segs = parseInlineSegments('baris satu<br>baris dua');
    assert.deepEqual(segs, [
      { type: 'text', value: 'baris satu' },
      { type: 'br', value: '' },
      { type: 'text', value: 'baris dua' },
    ]);
  });

  test('teks kosong -> array kosong (tidak crash)', () => {
    assert.deepEqual(parseInlineSegments(''), []);
  });
});

describe('chat-markdown.ts -- parseMarkdownBlocks (V1)', () => {
  test('paragraf polos -> 1 blok paragraph', () => {
    const blocks = parseMarkdownBlocks('Ini kalimat biasa tanpa markup.');
    assert.deepEqual(blocks, [{ type: 'paragraph', text: 'Ini kalimat biasa tanpa markup.' }]);
  });

  test('heading # -> level 1, ## -> level 2 (regresi nol dari 3 FormattedMessage lama)', () => {
    const blocks = parseMarkdownBlocks('# Judul Besar\n## Sub Judul');
    assert.deepEqual(blocks, [
      { type: 'heading', level: 1, text: 'Judul Besar' },
      { type: 'heading', level: 2, text: 'Sub Judul' },
    ]);
  });

  test('bullet list -, *, dan • semua terdeteksi sebagai bullet', () => {
    const blocks = parseMarkdownBlocks('- item satu\n* item dua\n• item tiga');
    assert.deepEqual(blocks, [
      { type: 'bullet', text: 'item satu' },
      { type: 'bullet', text: 'item dua' },
      { type: 'bullet', text: 'item tiga' },
    ]);
  });

  test('numbered list 1. -> blok numbered dengan field num & text', () => {
    const blocks = parseMarkdownBlocks('1. Langkah pertama\n2. Langkah kedua');
    assert.deepEqual(blocks, [
      { type: 'numbered', num: '1', text: 'Langkah pertama' },
      { type: 'numbered', num: '2', text: 'Langkah kedua' },
    ]);
  });

  test('hr --- *** ___ semua terdeteksi sebagai blok hr', () => {
    const blocks = parseMarkdownBlocks('---\n***\n___');
    assert.deepEqual(blocks, [{ type: 'hr' }, { type: 'hr' }, { type: 'hr' }]);
  });

  test('blockquote > -> blok blockquote tanpa tanda >', () => {
    const blocks = parseMarkdownBlocks('> catatan penting');
    assert.deepEqual(blocks, [{ type: 'blockquote', text: 'catatan penting' }]);
  });

  test('baris kosong -> blok blank (dipertahankan supaya spacing pesan lama tidak berubah)', () => {
    const blocks = parseMarkdownBlocks('baris 1\n\nbaris 2');
    assert.deepEqual(blocks, [
      { type: 'paragraph', text: 'baris 1' },
      { type: 'blank' },
      { type: 'paragraph', text: 'baris 2' },
    ]);
  });

  // -- CABANG BARU: fenced code block (mind-map/ASCII bar chart) --------------

  test('blok ``` multi-baris berindentasi (mind-map) -> 1 blok code, indentasi RAW tidak ke-trim', () => {
    const content = '```\nEfisiensi Kas\n  - Piutang\n    - Jatuh tempo >30 hari\n- Biaya Tetap\n```';
    const blocks = parseMarkdownBlocks(content);
    assert.deepEqual(blocks, [
      {
        type: 'code',
        lines: ['Efisiensi Kas', '  - Piutang', '    - Jatuh tempo >30 hari', '- Biaya Tetap'],
      },
    ]);
  });

  test('blok ``` berisi karakter | dan * (ASCII bar chart) TIDAK ikut kena parse tabel/bold palsu', () => {
    const content = '```\nJul | ######__________ Rp42jt\nAgu | ###########______ Rp68jt\n```';
    const blocks = parseMarkdownBlocks(content);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'code');
    if (blocks[0].type === 'code') {
      assert.deepEqual(blocks[0].lines, [
        'Jul | ######__________ Rp42jt',
        'Agu | ###########______ Rp68jt',
      ]);
    }
  });

  test('blok ``` TANPA penutup sampai EOF -> tetap terkumpul, TIDAK crash, TIDAK buang teks', () => {
    const content = 'Sebelum blok\n```\nbaris a\nbaris b';
    const blocks = parseMarkdownBlocks(content);
    assert.deepEqual(blocks, [
      { type: 'paragraph', text: 'Sebelum blok' },
      { type: 'code', lines: ['baris a', 'baris b'] },
    ]);
  });

  test('blok ``` kosong (buka-tutup langsung) -> blok code dengan lines kosong, tidak crash', () => {
    const content = '```\n```';
    const blocks = parseMarkdownBlocks(content);
    assert.deepEqual(blocks, [{ type: 'code', lines: [] }]);
  });

  // -- Tabel markdown + heuristik numericCols per-KOLOM ------------------------

  test('tabel dengan 1 kolom nominal + 1 kolom nama -> numericCols benar per kolom (bukan per sel)', () => {
    const content = [
      '| Nama | Nominal |',
      '|---|---|',
      '| Budi Santoso | Rp1.000.000 |',
      '| Siti Aminah | Rp2.500.000 |',
    ].join('\n');
    const blocks = parseMarkdownBlocks(content);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].type, 'table');
    if (blocks[0].type === 'table') {
      assert.deepEqual(blocks[0].headers, ['Nama', 'Nominal']);
      assert.deepEqual(blocks[0].rows, [
        ['Budi Santoso', 'Rp1.000.000'],
        ['Siti Aminah', 'Rp2.500.000'],
      ]);
      // Kolom "Nama" (index 0) BUKAN numerik, kolom "Nominal" (index 1) numerik.
      assert.deepEqual(blocks[0].numericCols, [false, true]);
    }
  });

  test('tabel dengan kolom nominal berisi angka negatif/persen tetap dianggap numerik', () => {
    const content = ['| Pos | Growth |', '|---|---|', '| Margin | -12% |', '| ROAS | 3.5% |'].join('\n');
    const blocks = parseMarkdownBlocks(content);
    assert.equal(blocks[0].type, 'table');
    if (blocks[0].type === 'table') {
      assert.deepEqual(blocks[0].numericCols, [false, true]);
    }
  });

  test('baris separator |---|---| tidak ikut masuk sebagai baris data', () => {
    const content = ['| A | B |', '|---|---|', '| 1 | 2 |'].join('\n');
    const blocks = parseMarkdownBlocks(content);
    assert.equal(blocks[0].type, 'table');
    if (blocks[0].type === 'table') {
      assert.equal(blocks[0].rows.length, 1);
    }
  });

  test('teks lama yang kebetulan punya 1-2 karakter | di tengah kalimat TIDAK dianggap tabel (regresi nol)', () => {
    // Baris tidak startsWith('|') && endsWith('|') -> harus jatuh ke paragraph,
    // persis perilaku 3 FormattedMessage lama (bukan cabang tabel baru).
    const blocks = parseMarkdownBlocks('Harga A | Harga B kira-kira sama.');
    assert.deepEqual(blocks, [{ type: 'paragraph', text: 'Harga A | Harga B kira-kira sama.' }]);
  });

  test('kombinasi heading + paragraf + tabel + blok kode dalam 1 pesan -> urutan blok sesuai urutan input', () => {
    const content = [
      '# Ringkasan',
      'Berikut datanya.',
      '| A | B |',
      '|---|---|',
      '| x | 1 |',
      '```',
      'catatan mentah',
      '```',
    ].join('\n');
    const blocks = parseMarkdownBlocks(content);
    assert.equal(blocks.length, 4);
    assert.equal(blocks[0].type, 'heading');
    assert.equal(blocks[1].type, 'paragraph');
    assert.equal(blocks[2].type, 'table');
    assert.equal(blocks[3].type, 'code');
  });

  test('content kosong -> array kosong (tidak crash)', () => {
    assert.deepEqual(parseMarkdownBlocks(''), []);
  });
});
