import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

import {
  INDUSTRY_OPTIONS,
  NOTEBOOK_COUNT_LABELS,
  NOTEBOOK_COUNT_RANGES,
  NOTEBOOK_KIND_OPTIONS,
} from '../src/app/components/marketing-media/client';
import { extraNotebookCountRanges, extraNotebookCards } from '../src/lib/notebook-cards';
import { INDUSTRY_IMAGE_TEMPLATES, resolveIndustryTemplate } from '../src/lib/industry-image-templates';
import type { NotebookKind } from '../src/lib/notebook-types';

/**
 * Guard kontrak client-server untuk Marketing Studio.
 *
 * Latar belakang: audit 6 Sep menemukan dua fitur yang sudah dibangun penuh di
 * server tapi tidak pernah bisa dipakai user karena lapisan client kurang satu
 * field / satu union-case: (a) template industri gambar selalu no-op karena
 * brandContext tidak punya field industry, (b) 7 dari 9 jenis kartu notebook
 * tidak bisa diminta karena tipe request client cuma mengenal quiz|flashcard.
 *
 * Test ini mengunci supaya kelas kegagalan itu tidak terulang diam-diam: daftar
 * di client WAJIB tetap cocok dengan sumber kebenaran di server.
 */

const ALL_KINDS: NotebookKind[] = [
  'quiz', 'flashcard', 'summary-report', 'mindmap', 'table',
  'infographic', 'deck', 'audio-overview-script', 'video-storyboard',
];

describe('kontrak studio: vertikal industri', () => {
  test('setiap nilai dropdown industri benar-benar dikenali template server', () => {
    const serverKeys = Object.keys(INDUSTRY_IMAGE_TEMPLATES).sort();
    const clientValues = INDUSTRY_OPTIONS.map(option => option.value).sort();
    assert.deepEqual(
      clientValues,
      serverKeys,
      'Nilai dropdown industri di client.ts harus sama persis dengan kunci INDUSTRY_IMAGE_TEMPLATES. Kalau meleset, enrichWithIndustry() jadi no-op diam-diam.'
    );
  });

  test('tiap nilai dropdown benar-benar resolve ke template (bukan cuma cocok nama kunci)', () => {
    for (const option of INDUSTRY_OPTIONS) {
      assert.ok(
        resolveIndustryTemplate(option.value),
        `resolveIndustryTemplate("${option.value}") mengembalikan null -- dropdown ini akan jadi no-op diam-diam di produksi.`
      );
    }
  });

  test('label dropdown industri tidak ada yang kosong', () => {
    for (const option of INDUSTRY_OPTIONS) {
      assert.ok(option.label.trim().length > 0, `Label kosong untuk vertikal "${option.value}"`);
    }
  });
});

describe('kontrak studio: jenis kartu notebook', () => {
  test('dropdown jenis kartu memuat seluruh 9 kind yang didukung server', () => {
    const clientKinds = NOTEBOOK_KIND_OPTIONS.map(option => option.value).sort();
    assert.deepEqual(clientKinds, [...ALL_KINDS].sort(), 'NOTEBOOK_KIND_OPTIONS harus memuat 9 kind, tidak boleh ada yang hilang.');
  });

  test('tiap kind punya batas jumlah dan label satuan', () => {
    for (const kind of ALL_KINDS) {
      assert.ok(NOTEBOOK_COUNT_RANGES[kind], `Batas jumlah hilang untuk kind "${kind}"`);
      assert.ok(NOTEBOOK_COUNT_LABELS[kind]?.trim().length, `Label satuan hilang untuk kind "${kind}"`);
    }
  });

  test('batas jumlah 7 kind tambahan sama persis dengan schema server', () => {
    for (const kind of Object.keys(extraNotebookCountRanges) as Array<keyof typeof extraNotebookCountRanges>) {
      assert.deepEqual(
        NOTEBOOK_COUNT_RANGES[kind],
        extraNotebookCountRanges[kind],
        `Batas jumlah untuk "${kind}" di client tidak cocok dengan extraNotebookCountRanges server.`
      );
    }
  });

  test('default tiap kind berada di dalam rentang min-max', () => {
    for (const kind of ALL_KINDS) {
      const range = NOTEBOOK_COUNT_RANGES[kind];
      assert.ok(range.min <= range.default && range.default <= range.max, `Default di luar rentang untuk kind "${kind}"`);
    }
  });

  test('7 kind tambahan yang ditawarkan client memang punya generator di server', () => {
    const serverExtraKinds = Object.keys(extraNotebookCards).sort();
    const clientExtraKinds = NOTEBOOK_KIND_OPTIONS
      .map(option => option.value)
      .filter(kind => kind !== 'quiz' && kind !== 'flashcard')
      .sort();
    assert.deepEqual(clientExtraKinds, serverExtraKinds, 'Client menawarkan kind yang tidak punya generator di notebook-cards.ts.');
  });
});
