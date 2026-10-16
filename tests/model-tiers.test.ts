// tests/model-tiers.test.ts
// BARU 11 Sep 2026 (wave B1-backend-routing). PURE unit test -- model-tiers.ts tidak
// menyentuh Prisma/network, jadi tidak perlu mock apapun (langsung import fungsi murni,
// pola sama seperti tests/slash-commands.test.ts / tests/media-intent.test.ts).
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import {
  MODEL_TIERS,
  JSON_EXTRACTION_MODEL,
  resolveTierForEffort,
  resolveTierSpec,
  modelIdsForTier,
} from '../src/lib/model-tiers';

const ENV_KEYS = [
  'OPENROUTER_MODEL_SANTAI',
  'OPENROUTER_MODEL_HEMAT',
  'OPENROUTER_MODEL_STANDAR',
  'OPENROUTER_MODEL_MAKSIMAL',
  'OPENROUTER_TEXT_MODEL',
] as const;

describe('model-tiers', () => {
  let previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
  });

  test('resolveTierForEffort: santai/normal/undefined -> hemat, serius -> standar, maksimal -> maksimal', () => {
    assert.equal(resolveTierForEffort('santai'), 'santai');
    assert.equal(resolveTierForEffort('normal'), 'hemat');
    assert.equal(resolveTierForEffort(undefined), 'hemat');
    assert.equal(resolveTierForEffort('serius'), 'standar');
    assert.equal(resolveTierForEffort('maksimal'), 'maksimal');
  });

  test('MODEL_TIERS: default murah untuk hemat, hanya maksimal punya reasoningEffort', () => {
    assert.equal(MODEL_TIERS.hemat.primary, 'deepseek/deepseek-v4.1-flash');
    assert.equal(MODEL_TIERS.standar.primary, 'openai/gpt-5.6-luna');
    assert.equal(MODEL_TIERS.maksimal.primary, 'openai/gpt-5.6-luna');
    assert.equal(MODEL_TIERS.hemat.reasoningEffort, undefined);
    assert.equal(MODEL_TIERS.standar.reasoningEffort, undefined);
    assert.equal(MODEL_TIERS.maksimal.reasoningEffort, 'high');
    assert.ok(MODEL_TIERS.hemat.fallbacks.length > 0);
  });

  test('JSON_EXTRACTION_MODEL sama dengan tier hemat.primary (default murah, dideklarasikan terpisah)', () => {
    assert.equal(JSON_EXTRACTION_MODEL, 'deepseek/deepseek-v4-flash-0731');
  });

  test('resolveTierSpec tanpa env override mengembalikan MODEL_TIERS apa adanya', () => {
    assert.deepEqual(resolveTierSpec('hemat'), MODEL_TIERS.hemat);
    assert.deepEqual(resolveTierSpec('standar'), MODEL_TIERS.standar);
    assert.deepEqual(resolveTierSpec('maksimal'), MODEL_TIERS.maksimal);
  });

  test('resolveTierSpec: OPENROUTER_MODEL_HEMAT/STANDAR/MAKSIMAL override primary tier masing-masing', () => {
    process.env.OPENROUTER_MODEL_HEMAT = 'vendor/hemat-override';
    process.env.OPENROUTER_MODEL_STANDAR = 'vendor/standar-override';
    process.env.OPENROUTER_MODEL_MAKSIMAL = 'vendor/maksimal-override';
    assert.equal(resolveTierSpec('hemat').primary, 'vendor/hemat-override');
    assert.equal(resolveTierSpec('standar').primary, 'vendor/standar-override');
    assert.equal(resolveTierSpec('maksimal').primary, 'vendor/maksimal-override');
    // fallbacks tidak ikut berubah oleh override -- hanya primary.
    assert.deepEqual(resolveTierSpec('hemat').fallbacks, MODEL_TIERS.hemat.fallbacks);
  });

  test('resolveTierSpec: OPENROUTER_TEXT_MODEL lama tetap dihormati sebagai override tier hemat (kompatibilitas mundur)', () => {
    process.env.OPENROUTER_TEXT_MODEL = 'vendor/legacy-override';
    assert.equal(resolveTierSpec('hemat').primary, 'vendor/legacy-override');
    // Env lama TIDAK mempengaruhi tier lain.
    assert.equal(resolveTierSpec('standar').primary, MODEL_TIERS.standar.primary);
  });

  test('resolveTierSpec: OPENROUTER_MODEL_HEMAT menang atas OPENROUTER_TEXT_MODEL lama kalau keduanya di-set', () => {
    process.env.OPENROUTER_TEXT_MODEL = 'vendor/legacy-override';
    process.env.OPENROUTER_MODEL_HEMAT = 'vendor/specific-override';
    assert.equal(resolveTierSpec('hemat').primary, 'vendor/specific-override');
  });

  test('modelIdsForTier: primary + fallbacks unik, mengikuti override env', () => {
    const ids = modelIdsForTier('hemat');
    assert.deepEqual(ids, [MODEL_TIERS.hemat.primary, ...MODEL_TIERS.hemat.fallbacks]);
    assert.equal(new Set(ids).size, ids.length, 'tidak ada duplikat');

    process.env.OPENROUTER_MODEL_HEMAT = MODEL_TIERS.hemat.fallbacks[0];
    const idsWithOverrideDup = modelIdsForTier('hemat');
    assert.equal(
      new Set(idsWithOverrideDup).size,
      idsWithOverrideDup.length,
      'override yang kebetulan sama dengan salah satu fallback tidak boleh menghasilkan entri duplikat'
    );
  });
});
