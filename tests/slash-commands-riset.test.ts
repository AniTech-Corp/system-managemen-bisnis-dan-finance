import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SLASH_COMMANDS, matchSlash } from '../src/lib/slash-commands';

// ---------------------------------------------------------------------------
// B4 TESTS -- 4 entri slash-command baru (/riset /kompetitor /lokasi /prediksi),
// 8 Sep 2026 wave B4-chat-wiring-backend. File TERPISAH dari tests/slash-
// commands.test.ts (yang punya sebelumnya) sesuai izin eksplisit di spesifikasi
// tugas ("baru, atau extend slash-commands.test.ts kalau lebih pas").
// ---------------------------------------------------------------------------

describe('slash-commands.ts -- /riset /kompetitor /lokasi /prediksi', () => {
  test('/riset terdaftar dengan payload nextActionKind:riset', () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === 'riset');
    assert.ok(cmd, '/riset harus terdaftar');
    assert.equal(cmd!.label, '/riset');
    assert.equal(cmd!.kind, 'nextAction');
    assert.equal(cmd!.payload.nextActionKind, 'riset');
  });

  test('/kompetitor terdaftar sebagai alias ke nextActionKind:riset (brief beda, kind sama)', () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === 'kompetitor');
    assert.ok(cmd, '/kompetitor harus terdaftar');
    assert.equal(cmd!.label, '/kompetitor');
    assert.equal(cmd!.kind, 'nextAction');
    assert.equal(cmd!.payload.nextActionKind, 'riset');
  });

  test('/lokasi terdaftar dengan payload nextActionKind:lokasi', () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === 'lokasi');
    assert.ok(cmd, '/lokasi harus terdaftar');
    assert.equal(cmd!.label, '/lokasi');
    assert.equal(cmd!.kind, 'nextAction');
    assert.equal(cmd!.payload.nextActionKind, 'lokasi');
  });

  test('/prediksi terdaftar dengan payload nextActionKind:prediksi', () => {
    const cmd = SLASH_COMMANDS.find((c) => c.id === 'prediksi');
    assert.ok(cmd, '/prediksi harus terdaftar');
    assert.equal(cmd!.label, '/prediksi');
    assert.equal(cmd!.kind, 'nextAction');
    assert.equal(cmd!.payload.nextActionKind, 'prediksi');
  });

  test('matchSlash("/riset") mengembalikan entry /riset (bukan /kompetitor)', () => {
    const results = matchSlash('/riset');
    assert.ok(results.some((c) => c.id === 'riset'));
    assert.ok(!results.some((c) => c.id === 'kompetitor'), 'prefix "/riset" tidak boleh cocok "/kompetitor"');
  });

  test('matchSlash("/kompetitor") mengembalikan entry /kompetitor', () => {
    const results = matchSlash('/kompetitor');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'kompetitor');
  });

  test('matchSlash("/lokasi") mengembalikan entry /lokasi', () => {
    const results = matchSlash('/lokasi');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'lokasi');
  });

  test('matchSlash("/prediksi") mengembalikan entry /prediksi', () => {
    const results = matchSlash('/prediksi');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'prediksi');
  });

  test('matchSlash("/") (prefix kosong) tetap menyertakan 4 command baru dalam daftar penuh', () => {
    const results = matchSlash('/');
    const ids = results.map((c) => c.id);
    for (const id of ['riset', 'kompetitor', 'lokasi', 'prediksi']) {
      assert.ok(ids.includes(id), `matchSlash("/") harus menyertakan "${id}"`);
    }
  });

  test('4 id baru unik, tidak duplikat dengan id existing manapun', () => {
    const ids = SLASH_COMMANDS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, 'ada id duplikat di SLASH_COMMANDS setelah 4 entri baru ditambah');
  });

  test('semua 4 command baru label diawali garis miring (konsisten format existing)', () => {
    for (const id of ['riset', 'kompetitor', 'lokasi', 'prediksi']) {
      const cmd = SLASH_COMMANDS.find((c) => c.id === id)!;
      assert.match(cmd.label, /^\//);
    }
  });
});
