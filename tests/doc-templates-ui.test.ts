import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CATEGORY_OPTIONS,
  filterTemplates,
  validateGenerateInput,
  buildGenerateRequestBody,
  createDownloadDataUrl,
  formatLatency,
} from '../src/app/components/doc-templates/doc-template-client';
import type { DocTemplate } from '../src/app/components/doc-templates/types';
import { listDocTemplates } from '../src/lib/doc-templates';

// Escape unicode em dash untuk memastikan aturan anti-em dash
const EM_DASH = '\u2014';

describe('doc-templates-ui: penyaring daftar template (filterTemplates)', () => {
  const dummyTemplates: DocTemplate[] = [
    {
      id: 'laba-rugi',
      sourceId: 'laba-rugi',
      source: 'financial-report',
      label: 'Laba Rugi',
      outputType: 'excel',
      description: 'Format laporan laba rugi',
    },
    {
      id: 'invoice-standar',
      sourceId: 'invoice-standar',
      source: 'invoice',
      label: 'Invoice Standar',
      outputType: 'word',
      description: 'Format invoice tagihan',
    },
    {
      id: 'pitch-deck',
      sourceId: 'pitch-deck',
      source: 'deck',
      label: 'Pitch Deck',
      outputType: 'ppt',
      description: 'Format presentasi penawaran',
    },
    {
      id: 'video-promo',
      sourceId: 'video-promo',
      source: 'video-brief',
      label: 'Video Promo',
      outputType: 'video-plan',
      description: 'Format brief naskah video',
    },
  ];

  test('kategori "all" mengembalikan semua template', () => {
    const res = filterTemplates(dummyTemplates, 'all');
    assert.equal(res.length, 4);
    assert.deepEqual(res, dummyTemplates);
  });

  test('kategori "excel" hanya mengembalikan template bertipe excel', () => {
    const res = filterTemplates(dummyTemplates, 'excel');
    assert.equal(res.length, 1);
    assert.equal(res[0].id, 'laba-rugi');
    assert.equal(res[0].outputType, 'excel');
  });

  test('kategori "word" hanya mengembalikan template bertipe word', () => {
    const res = filterTemplates(dummyTemplates, 'word');
    assert.equal(res.length, 1);
    assert.equal(res[0].id, 'invoice-standar');
    assert.equal(res[0].outputType, 'word');
  });

  test('kategori "ppt" hanya mengembalikan template bertipe ppt', () => {
    const res = filterTemplates(dummyTemplates, 'ppt');
    assert.equal(res.length, 1);
    assert.equal(res[0].id, 'pitch-deck');
    assert.equal(res[0].outputType, 'ppt');
  });

  test('kategori "video-plan" hanya mengembalikan template bertipe video-plan', () => {
    const res = filterTemplates(dummyTemplates, 'video-plan');
    assert.equal(res.length, 1);
    assert.equal(res[0].id, 'video-promo');
    assert.equal(res[0].outputType, 'video-plan');
  });

  test('menangani array kosong atau input non-array secara aman tanpa melempar error', () => {
    assert.deepEqual(filterTemplates([], 'all'), []);
    assert.deepEqual(filterTemplates(null as any, 'all'), []);
    assert.deepEqual(filterTemplates(undefined as any, 'all'), []);
  });
});

describe('doc-templates-ui: validasi input (validateGenerateInput)', () => {
  test('templateId dan brief lengkap -> valid', () => {
    const res = validateGenerateInput({
      templateId: 'laba-rugi-lengkap-umkm',
      brief: 'Buatkan laporan bulan Agustus',
    });
    assert.equal(res.valid, true);
    assert.equal(res.error, undefined);
  });

  test('templateId kosong atau spasi -> tidak valid dengan pesan informatif', () => {
    const res1 = validateGenerateInput({ templateId: '', brief: 'Buatkan laporan' });
    assert.equal(res1.valid, false);
    assert.ok(res1.error && res1.error.length > 0);

    const res2 = validateGenerateInput({ templateId: '   ', brief: 'Buatkan laporan' });
    assert.equal(res2.valid, false);
  });

  test('brief kosong atau spasi -> tidak valid dengan pesan informatif', () => {
    const res1 = validateGenerateInput({ templateId: 'laba-rugi', brief: '' });
    assert.equal(res1.valid, false);
    assert.ok(res1.error && res1.error.length > 0);

    const res2 = validateGenerateInput({ templateId: 'laba-rugi', brief: '   ' });
    assert.equal(res2.valid, false);
  });
});

describe('doc-templates-ui: pembentukan badan permintaan (buildGenerateRequestBody)', () => {
  test('membersihkan whitespace pada templateId dan brief', () => {
    const body = buildGenerateRequestBody({
      templateId: '  laba-rugi  ',
      brief: '  Buatkan laporan untuk UMKM kopi  ',
    });
    assert.equal(body.templateId, 'laba-rugi');
    assert.equal(body.brief, 'Buatkan laporan untuk UMKM kopi');
    assert.equal(body.fileNameHint, undefined);
    assert.equal(body.tone, undefined);
    assert.equal(body.role, undefined);
  });

  test('menyertakan parameter opsional fileNameHint, tone, dan role jika diisi', () => {
    const body = buildGenerateRequestBody({
      templateId: 'invoice-standar',
      brief: 'Tagihan jasa desain',
      fileNameHint: '  Invoice_Desain_Budi  ',
      tone: '  formal  ',
      role: '  marketing  ',
    });
    assert.equal(body.fileNameHint, 'Invoice_Desain_Budi');
    assert.equal(body.tone, 'formal');
    assert.equal(body.role, 'marketing');
  });

  test('mengabaikan parameter opsional yang hanya berisi spasi kosong', () => {
    const body = buildGenerateRequestBody({
      templateId: 'invoice-standar',
      brief: 'Tagihan',
      fileNameHint: '   ',
      tone: '   ',
      role: '   ',
    });
    assert.equal(body.fileNameHint, undefined);
    assert.equal(body.tone, undefined);
    assert.equal(body.role, undefined);
  });
});

describe('doc-templates-ui: utilitas data url dan latensi', () => {
  test('createDownloadDataUrl menghasilkan format data URL yang benar jika base64 ada', () => {
    const url = createDownloadDataUrl(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'UEsDBBQAAAAIA...'
    );
    assert.equal(
      url,
      'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBBQAAAAIA...'
    );
  });

  test('createDownloadDataUrl menghasilkan string kosong jika base64 kosong (pencegahan tombol rusak)', () => {
    assert.equal(createDownloadDataUrl('application/pdf', ''), '');
    assert.equal(createDownloadDataUrl('application/pdf', '   '), '');
    assert.equal(createDownloadDataUrl('application/pdf', null as any), '');
  });

  test('formatLatency memformat angka milidetik menjadi detik yang mudah dibaca', () => {
    assert.equal(formatLatency(1500), '1.5 detik');
    assert.equal(formatLatency(200), '0.2 detik');
    assert.equal(formatLatency(0), '0.0 detik');
  });

  test('formatLatency mengembalikan string kosong untuk input tidak valid', () => {
    assert.equal(formatLatency(undefined), '');
    assert.equal(formatLatency(-100), '');
    assert.equal(formatLatency(NaN), '');
  });
});

describe('doc-templates-ui: kepatuhan kontrak dan gaya teks', () => {
  test('seluruh 19 template server dapat ditampung oleh filter kategori UI', () => {
    const serverTemplates = listDocTemplates();
    assert.equal(serverTemplates.length, 19);

    const excelList = filterTemplates(serverTemplates, 'excel');
    const wordList = filterTemplates(serverTemplates, 'word');
    const pptList = filterTemplates(serverTemplates, 'ppt');
    const videoPlanList = filterTemplates(serverTemplates, 'video-plan');

    assert.equal(excelList.length, 6, 'Excel harus ada 6 template');
    assert.equal(wordList.length, 4, 'Word harus ada 4 template');
    assert.equal(pptList.length, 5, 'PPT harus ada 5 template');
    assert.equal(videoPlanList.length, 4, 'Rencana video harus ada 4 template');

    assert.equal(excelList.length + wordList.length + pptList.length + videoPlanList.length, 19);
  });

  test('label kategori di CATEGORY_OPTIONS tidak ada yang kosong, tanpa emoji, dan tanpa em dash', () => {
    assert.ok(CATEGORY_OPTIONS.length >= 5);
    for (const opt of CATEGORY_OPTIONS) {
      assert.ok(opt.label.trim().length > 0, `Label kosong untuk kategori "${opt.value}"`);
      assert.ok(!opt.label.includes(EM_DASH), `Label "${opt.label}" mengandung em dash`);
      // Memastikan tidak ada karakter emoji (rentang umum emoji)
      assert.ok(
        !/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(opt.label),
        `Label "${opt.label}" mengandung emoji`
      );
    }
  });
});
