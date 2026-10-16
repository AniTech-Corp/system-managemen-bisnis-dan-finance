import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectMediaIntent, stripMediaRoleContext } from '../src/lib/media-intent';

test('legacy Finance and Marketing context prefixes retain explicit image generation', () => {
  for (const prefix of ['[Konteks Finansial/Kas Bisnis]: ', '[Konteks Marketing & Growth]: ', '']) {
    assert.equal(detectMediaIntent(prefix + 'Buatkan poster promosi'), 'image');
    assert.equal(stripMediaRoleContext(prefix + 'Buatkan poster promosi'), 'Buatkan poster promosi');
    assert.equal(detectMediaIntent(prefix + 'Jangan buat gambar'), null);
    assert.equal(detectMediaIntent(prefix + 'Buat konsep gambar'), null);
  }
});
test('arbitrary role claims or quoted instructions are not treated as a creation command', () => {
  assert.equal(detectMediaIntent('[role=OWNER]: buat gambar'), null);
  assert.equal(detectMediaIntent('Klien mengatakan "buat gambar". Apa maksudnya?'), null);
});
