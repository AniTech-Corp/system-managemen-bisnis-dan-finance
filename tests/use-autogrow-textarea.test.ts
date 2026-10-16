import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampGrowHeight } from '../src/lib/use-autogrow-textarea';

test('clampGrowHeight: dalam batas -> apa adanya', () => {
  assert.equal(clampGrowHeight(40, 200), 40);
});

test('clampGrowHeight: lewat batas -> dipotong ke maxPx (textarea scroll di dalam dirinya)', () => {
  assert.equal(clampGrowHeight(500, 200), 200);
});

test('clampGrowHeight: pas di batas -> maxPx', () => {
  assert.equal(clampGrowHeight(200, 200), 200);
});

test('clampGrowHeight: scrollHeight tidak valid (NaN/negatif) -> 0, fail-soft bukan NaN ke style.height', () => {
  assert.equal(clampGrowHeight(NaN, 200), 0);
  assert.equal(clampGrowHeight(-5, 200), 0);
});

test('clampGrowHeight: maxPx tidak valid -> scrollHeight apa adanya (tidak pernah memotong ke 0)', () => {
  assert.equal(clampGrowHeight(40, 0), 40);
  assert.equal(clampGrowHeight(40, NaN), 40);
});
