import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAIResponseText } from '../src/lib/ai-gateway';

test('sanitizeAIResponseText - cleans standard <think> tags', () => {
  const raw = '<think>I need to check the user balance first.\nThen report it.</think>Saldo kas Anda saat ini adalah Rp 50.000.000.';
  const cleaned = sanitizeAIResponseText(raw);
  assert.equal(cleaned, 'Saldo kas Anda saat ini adalah Rp 50.000.000.');
});

test('sanitizeAIResponseText - cleans unclosed dangling <think> tag if output truncated', () => {
  const raw = 'Berikut laporannya:\n<think>I am still thinking about cashflow';
  const cleaned = sanitizeAIResponseText(raw);
  assert.equal(cleaned, 'Berikut laporannya:');
});

test('sanitizeAIResponseText - extracts clean response from English reasoning monologue (screenshot case)', () => {
  const raw = `We need respond to user in Indonesian. User says "coba baca dokumen ini secara jelas dan terperinci dan jelasin ke gua". But no document attached? Need inspect conversation: only system and user. There is no attachment content. We must answer based on data? Need maybe ask for document. Need final with "Artinya buat kamu:" line. Let's craft: "Dokumennya belum terlihat di chat ini, jadi saya belum bisa baca atau jelaskan. Upload file PDF/Word/Excel/CSV/foto dokumen, atau paste teksnya. Kalau maksudnya data RetroPick saat ini, belum ada transaksi tercatat."`;
  const cleaned = sanitizeAIResponseText(raw);
  assert.ok(!cleaned.includes('We need respond'));
  assert.ok(!cleaned.includes('Let\'s craft'));
  assert.ok(cleaned.includes('Dokumennya belum terlihat di chat ini'));
});

test('sanitizeAIResponseText - clears pure scratchpad monologue if no draft extractable', () => {
  const raw = `We need respond to user in Indonesian. Need check database. Need inspect schema. Let's think about this deeply.`;
  const cleaned = sanitizeAIResponseText(raw);
  assert.equal(cleaned, '');
});

test('sanitizeAIResponseText - preserves clean Indonesian responses without modifications', () => {
  const raw = 'Halo Bapak/Ibu, posisi kas likuid aktif saat ini adalah **Rp 348.500.000** dengan runway 7 bulan.';
  const cleaned = sanitizeAIResponseText(raw);
  assert.equal(cleaned, raw);
});
