import assert from 'node:assert/strict';
import test from 'node:test';
import { TAX_FEATURE_LOCKED, TAX_FEATURE_LOCK_MESSAGE, buildTaxFeatureLockResponse, isTaxFeatureRequest } from '../src/lib/tax-feature';

test('kebijakan pajak tetap terkunci dan mengenali variasi prompt', () => {
  assert.equal(TAX_FEATURE_LOCKED, true);
  assert.equal(isTaxFeatureRequest('Tolong hitung estimasi PPh dan PPN bulan ini'), true);
  assert.equal(isTaxFeatureRequest('Buat rekonsiliasi kas bulan ini'), false);
  assert.equal(isTaxFeatureRequest('Jelaskan tax advisor untuk bisnis'), true);
  assert.equal(isTaxFeatureRequest('Bagaimana cara lapor SPT tahunan?'), true);
  assert.equal(isTaxFeatureRequest('Apakah ada integrasi CoreTax DJP?'), true);
  assert.equal(isTaxFeatureRequest('Berapa tarif pajak UMKM saat ini?'), true);
});

test('respons lock hanya menyatakan fitur belum tersedia dan tidak mengandung kalkulasi', () => {
  const response = buildTaxFeatureLockResponse();
  assert.equal(response.featureLocked, true);
  assert.equal(response.lockedFeature, 'tax');
  assert.equal(response.text, TAX_FEATURE_LOCK_MESSAGE);
  assert.match(response.text, /belum tersedia/i);
  assert.doesNotMatch(response.text, /CMO Adnan/i);
  assert.doesNotMatch(response.text, /Rp\s?\d/);
});
