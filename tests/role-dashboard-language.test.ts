import assert from 'node:assert/strict';
import test from 'node:test';
import { GLOSSARY, matchGlossaryTerm } from '../src/app/components/glossary-data';

test('glossary role baru menjelaskan istilah operasional dan tim dengan bahasa manusia', () => {
  const terms = ['SOP', 'Workload', 'PO', 'COGS', 'Lead time', 'Reorder point', 'Dead stock'];
  for (const label of terms) {
    const match = matchGlossaryTerm(label);
    assert.ok(match, `istilah ${label} harus punya penjelasan`);
    assert.ok(match?.plain.length > 20, `penjelasan ${label} terlalu pendek`);
  }
});

test('glossary memiliki kategori baru dan tidak menghapus kategori lama', () => {
  const categories = new Set(GLOSSARY.map((item) => item.category));
  assert.ok(categories.has('Keuangan & Kas'));
  assert.ok(categories.has('Marketing & Iklan'));
  assert.ok(categories.has('Administrasi & Tim'));
  assert.ok(categories.has('Operasional & Rantai Pasok'));
});

test('matching memakai istilah terpanjang agar label spesifik tidak jatuh ke kata pendek', () => {
  assert.equal(matchGlossaryTerm('Nilai Dead Stock')?.term, 'Dead stock (Stok Lama Tidak Bergerak)');
  assert.equal(matchGlossaryTerm('Budget harian')?.term, 'Budget harian / daily budget');
});
