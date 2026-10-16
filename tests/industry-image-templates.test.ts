import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveIndustryTemplate, enrichWithIndustry } from '../src/lib/industry-image-templates';
import { enrichMarketingImage } from '../src/lib/media-provider';

test('resolveIndustryTemplate: alias Indonesia dikenali', () => {
  assert.equal(resolveIndustryTemplate('resto padang')?.id, 'fnb');
  assert.equal(resolveIndustryTemplate('bengkel motor')?.id, 'otomotif');
  assert.equal(resolveIndustryTemplate('Klinik Sehat')?.id, 'kesehatan');
  assert.equal(resolveIndustryTemplate('fashion')?.id, 'fashion');
});

test('resolveIndustryTemplate: input kosong/tidak dikenal -> null', () => {
  assert.equal(resolveIndustryTemplate(''), null);
  assert.equal(resolveIndustryTemplate(undefined), null);
  assert.equal(resolveIndustryTemplate('industri antah berantah xyz'), null);
});

test('enrichWithIndustry: backward-compat identik kalau industry kosong/tidak dikenal', () => {
  assert.equal(enrichWithIndustry('Poster kopi', undefined), 'Poster kopi');
  assert.equal(enrichWithIndustry('Poster kopi', 'tidak-dikenal-xyz'), 'Poster kopi');
});

test('enrichWithIndustry: industri dikenal menambah larangan spesifik fnb, prefix tetap sama', () => {
  const result = enrichWithIndustry('Poster kopi', 'kuliner');
  assert.match(result, /^Poster kopi/);
  assert.match(result, /plastik atau lilin/);
  assert.match(result, /label kemasan palsu/);
});

test('rangkaian enrichMarketingImage + enrichWithIndustry seperti route.ts mengandung instruksi lama dan blok industri baru', () => {
  const enriched = enrichMarketingImage('Poster promo', { workspaceName: 'Warung Bu Sari' });
  const full = enrichWithIndustry(enriched, 'warung');
  assert.match(full, /Warung Bu Sari/);
  assert.match(full, /Create a polished Indonesian marketing visual/);
  assert.match(full, /Vertikal industri: Kuliner & F&B/);
});
