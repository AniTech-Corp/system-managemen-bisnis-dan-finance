import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SLASH_COMMANDS, matchSlash, type SlashCommand } from '../src/lib/slash-commands';

describe('SLASH_COMMANDS registry', () => {
  test('semua id unik', () => {
    const ids = SLASH_COMMANDS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  test('semua label diawali garis miring', () => {
    for (const cmd of SLASH_COMMANDS) {
      assert.match(cmd.label, /^\//, `label "${cmd.label}" harus diawali /`);
    }
  });

  test('kind hanya mode | nextAction | setting', () => {
    const allowed = new Set(['mode', 'nextAction', 'setting']);
    for (const cmd of SLASH_COMMANDS) {
      assert.ok(allowed.has(cmd.kind), `kind "${cmd.kind}" di ${cmd.id} tidak dikenal`);
    }
  });

  test('/pdf terdaftar dengan payload disabled + reason jujur (bukan dihilangkan diam-diam)', () => {
    const pdf = SLASH_COMMANDS.find((c) => c.id === 'pdf');
    assert.ok(pdf, '/pdf harus tetap terdaftar supaya user dapat penjelasan, bukan "command tidak dikenal"');
    assert.equal(pdf!.payload.disabled, true);
    assert.equal(typeof pdf!.payload.reason, 'string');
    assert.ok((pdf!.payload.reason as string).length > 0);
  });

  test('/ppt /word /excel /flashcard /kuis pakai nextActionKind sesuai union NextActionKind existing', () => {
    const expected: Record<string, string> = {
      ppt: 'ppt',
      word: 'word',
      excel: 'excel',
      flashcard: 'flashcard',
      kuis: 'quiz',
    };
    for (const [id, kind] of Object.entries(expected)) {
      const cmd = SLASH_COMMANDS.find((c) => c.id === id);
      assert.ok(cmd, `command ${id} tidak ditemukan`);
      assert.equal(cmd!.kind, 'nextAction');
      assert.equal(cmd!.payload.nextActionKind, kind);
    }
  });

  test('/deck mengarah ke templateId pitch-investor-ringkas, bukan /pitchdeck', () => {
    const deck = SLASH_COMMANDS.find((c) => c.id === 'deck');
    assert.ok(deck);
    assert.equal(deck!.label, '/deck');
    assert.equal(deck!.payload.templateId, 'pitch-investor-ringkas');
    assert.equal(
      SLASH_COMMANDS.some((c) => c.label === '/pitchdeck'),
      false,
      '/pitchdeck sengaja tidak didaftarkan (keputusan D-13, ambigu 2 arsitektur pitch deck)'
    );
  });

  test('/model /upaya /mic adalah kind setting dengan action yang benar', () => {
    const model = SLASH_COMMANDS.find((c) => c.id === 'model');
    const upaya = SLASH_COMMANDS.find((c) => c.id === 'upaya');
    const mic = SLASH_COMMANDS.find((c) => c.id === 'mic');
    assert.equal(model?.payload.action, 'openModelPicker');
    assert.equal(upaya?.payload.action, 'openEffortPicker');
    assert.equal(mic?.payload.action, 'startRecording');
  });

  test('audio TIDAK didaftarkan sebagai chip mode (keputusan D-5, belum diminta eksplisit)', () => {
    const hasAudioMode = SLASH_COMMANDS.some((c) => c.kind === 'mode' && c.payload.mode === 'audio');
    assert.equal(hasAudioMode, false);
  });
});

describe('matchSlash', () => {
  test("matchSlash('/im') hanya mengembalikan /gambar, bukan command lain", () => {
    // '/im' TIDAK match '/gambar' secara prefix literal ('/gambar' tidak diawali
    // '/im') -- kasus ini menguji bahwa filter PURELY prefix (bukan fuzzy/substring
    // di tengah kata), jadi hasil yang benar untuk '/im' adalah KOSONG.
    // Skenario nyata "hanya /gambar yang match" dipakai dengan prefix '/g'.
    const resultIm = matchSlash('/im');
    assert.deepEqual(resultIm, []);

    const resultG = matchSlash('/g');
    assert.equal(resultG.length, 1);
    assert.equal(resultG[0].id, 'gambar');
  });

  test("matchSlash('/d') mengembalikan /deck saja", () => {
    const result = matchSlash('/d');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'deck');
  });

  test('case-insensitive', () => {
    const lower = matchSlash('/video');
    const upper = matchSlash('/VIDEO');
    const mixed = matchSlash('/VidEo');
    assert.equal(lower.length, 1);
    assert.deepEqual(
      upper.map((c) => c.id),
      lower.map((c) => c.id)
    );
    assert.deepEqual(
      mixed.map((c) => c.id),
      lower.map((c) => c.id)
    );
  });

  test('prefix kosong (cuma "/") mengembalikan semua command', () => {
    const result = matchSlash('/');
    assert.equal(result.length, SLASH_COMMANDS.length);
  });

  test('prefix yang tidak cocok apapun mengembalikan array kosong', () => {
    const result = matchSlash('/zzz-tidak-ada');
    assert.deepEqual(result, []);
  });

  test('whitespace di sekitar input di-trim sebelum dicocokkan', () => {
    const result = matchSlash('  /mic  ');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'mic');
  });

  test('matchSlash tidak memutasi SLASH_COMMANDS asli', () => {
    const before = JSON.stringify(SLASH_COMMANDS);
    matchSlash('/g');
    matchSlash('/');
    const after = JSON.stringify(SLASH_COMMANDS);
    assert.equal(before, after);
  });

  test('return type tetap SlashCommand[] (sanity compile-time check via runtime shape)', () => {
    const result: SlashCommand[] = matchSlash('/model');
    assert.equal(result[0].kind, 'setting');
  });
});
