import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ASSISTANT_MODES,
  ASSISTANT_MODE_LABEL,
  resolveAssistantMode,
  getAssistantModeInstruction,
  assistantModeDefaults,
} from '../src/lib/ai-brain/assistant-modes';

// ---------------------------------------------------------------------------
// B3_AI TESTS (11 Sep 2026) -- src/lib/ai-brain/assistant-modes.ts (kontrak
// modul 3). Modul ini PURE (nol import node/Prisma/LLM) -- test ini TIDAK
// butuh mock.module apapun, murni import fungsi & assert output, mengikuti
// pola tests/company-dashboard-helpers.test.ts dkk (helper murni).
// ---------------------------------------------------------------------------

describe('assistant-modes: resolveAssistantMode', () => {
  test('4 mode valid dikembalikan apa adanya', () => {
    for (const mode of ASSISTANT_MODES) {
      assert.equal(resolveAssistantMode(mode), mode);
    }
  });

  test('nilai tidak dikenal/typo -> fallback "tanya"', () => {
    assert.equal(resolveAssistantMode('analisis'), 'tanya');
    assert.equal(resolveAssistantMode('RISET'), 'tanya', 'case-sensitive -- huruf besar bukan salah satu dari 4 literal yang dikenal');
    assert.equal(resolveAssistantMode(''), 'tanya');
  });

  test('undefined/null/tipe salah -> fallback "tanya", TIDAK throw', () => {
    assert.equal(resolveAssistantMode(undefined), 'tanya');
    assert.equal(resolveAssistantMode(null), 'tanya');
    assert.equal(resolveAssistantMode(123), 'tanya');
    assert.equal(resolveAssistantMode({}), 'tanya');
    assert.equal(resolveAssistantMode(['riset']), 'tanya');
  });
});

describe('assistant-modes: ASSISTANT_MODE_LABEL', () => {
  test('semua 4 mode punya label & desc non-kosong', () => {
    for (const mode of ASSISTANT_MODES) {
      const entry = ASSISTANT_MODE_LABEL[mode];
      assert.ok(entry, `mode ${mode} harus punya entry label`);
      assert.ok(entry.label.trim().length > 0);
      assert.ok(entry.desc.trim().length > 0);
    }
  });
});

describe('assistant-modes: getAssistantModeInstruction', () => {
  test('mode belajar -> instruksi menyebut analogi + latihan/cek pemahaman', () => {
    const instr = getAssistantModeInstruction('belajar', 'Toko Kopi Sintetis');
    assert.match(instr, /analogi/i);
    assert.match(instr, /latihan|cek pemahaman/i);
    assert.match(instr, /Toko Kopi Sintetis/);
  });

  test('mode analis -> instruksi menyebut angka, tabel, asumsi, rekomendasi berperingkat, risiko', () => {
    const instr = getAssistantModeInstruction('analis');
    assert.match(instr, /angka/i);
    assert.match(instr, /tabel/i);
    assert.match(instr, /asumsi/i);
    assert.match(instr, /rekomendasi/i);
    assert.match(instr, /risiko/i);
  });

  test('mode riset -> instruksi WAJIB sumber + ketidakpastian', () => {
    const instr = getAssistantModeInstruction('riset');
    assert.match(instr, /sumber/i);
    assert.match(instr, /ketidakpastian/i);
  });

  test('mode tanya -> instruksi ringkas', () => {
    const instr = getAssistantModeInstruction('tanya');
    assert.match(instr, /ringkas/i);
  });

  test('workspaceName kosong/null -> instruksi tetap valid (fallback "workspace ini"), TIDAK throw', () => {
    assert.doesNotThrow(() => getAssistantModeInstruction('belajar', null));
    assert.doesNotThrow(() => getAssistantModeInstruction('belajar', ''));
    assert.doesNotThrow(() => getAssistantModeInstruction('belajar', undefined));
    const instr = getAssistantModeInstruction('belajar', '   ');
    assert.match(instr, /workspace ini/);
  });
});

describe('assistant-modes: assistantModeDefaults', () => {
  test('riset -> effortFloor serius + forceResearch web', () => {
    const d = assistantModeDefaults('riset');
    assert.equal(d.effortFloor, 'serius');
    assert.equal(d.forceResearch, 'web');
  });

  test('analis -> effortFloor serius, TANPA forceResearch', () => {
    const d = assistantModeDefaults('analis');
    assert.equal(d.effortFloor, 'serius');
    assert.equal(d.forceResearch, undefined);
  });

  test('belajar -> effortFloor normal, TANPA forceResearch', () => {
    const d = assistantModeDefaults('belajar');
    assert.equal(d.effortFloor, 'normal');
    assert.equal(d.forceResearch, undefined);
  });

  test('tanya -> effortFloor santai, TANPA forceResearch', () => {
    const d = assistantModeDefaults('tanya');
    assert.equal(d.effortFloor, 'santai');
    assert.equal(d.forceResearch, undefined);
  });
});
