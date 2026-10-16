import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { listDocTemplates, resolveDocTemplate, buildTemplatedBrief } from '../src/lib/doc-templates';
import { FINANCIAL_REPORT_TEMPLATES } from '../src/lib/doc-templates/financial-report-templates';
import { INVOICE_DOC_TEMPLATES } from '../src/lib/doc-templates/invoice-templates';
import { DECK_TEMPLATE_LIST } from '../src/lib/doc-templates/deck-templates';
import { VIDEO_BRIEF_TEMPLATES } from '../src/lib/doc-templates/video-brief-templates';

// Sama seperti VALID_TYPES di src/app/api/v1/brain/generate/route.ts dan GenerationType
// di src/lib/generation-engine.ts (keduanya milik Fatur, tidak diimpor langsung di sini
// karena GenerationType hanya tipe, tidak ada nilai runtime untuk diverifikasi) -- daftar
// literal ini WAJIB tetap sinkron kalau Fatur menambah tipe baru di sana.
const VALID_OUTPUT_TYPES = ['word', 'excel', 'ppt', 'pdf', 'image', 'video-plan'];

// Ditulis sebagai escape unicode (bukan karakter literal) supaya file test ini sendiri
// tetap murni ASCII, konsisten dengan aturan anti-slop yang sedang diverifikasi.
const EM_DASH = '\u2014';

describe('doc-templates/index: registry gabungan', () => {
  test('semua id template unik lintas 4 sumber, tidak ada tabrakan pada katalog saat ini', () => {
    const all = listDocTemplates();
    const ids = all.map((t) => t.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, `ada id duplikat: ${ids.join(', ')}`);

    // Kunci jumlah sumber saat ini (5 financial + 5 invoice + 5 deck + 4 video-brief = 19).
    // Kalau angka ini berubah karena template baru ditambah, itu sinyal wajar -- tapi kalau
    // berubah karena tabrakan id membuat satu entri "hilang" secara diam-diam, test ini
    // akan gagal duluan sebelum sempat lolos ke production.
    const expectedCount =
      Object.keys(FINANCIAL_REPORT_TEMPLATES).length +
      INVOICE_DOC_TEMPLATES.length +
      DECK_TEMPLATE_LIST.length +
      Object.keys(VIDEO_BRIEF_TEMPLATES).length;
    assert.equal(all.length, expectedCount);
  });

  test('tiap entri registry punya field wajib tidak kosong dan outputType valid', () => {
    const all = listDocTemplates();
    assert.ok(all.length > 0, 'registry tidak boleh kosong');
    for (const t of all) {
      assert.ok(t.id && t.id.trim().length > 0, `id kosong pada entri: ${JSON.stringify(t)}`);
      assert.ok(t.sourceId && t.sourceId.trim().length > 0, `sourceId kosong pada id "${t.id}"`);
      assert.ok(t.label && t.label.trim().length > 0, `label kosong pada id "${t.id}"`);
      assert.ok(t.description && t.description.trim().length > 0, `description kosong pada id "${t.id}"`);
      assert.ok(
        VALID_OUTPUT_TYPES.includes(t.outputType),
        `outputType "${t.outputType}" pada id "${t.id}" tidak dikenal GenerationType`
      );
      assert.ok(
        ['financial-report', 'invoice', 'deck', 'video-brief'].includes(t.source),
        `source "${t.source}" pada id "${t.id}" tidak dikenal`
      );
    }
  });

  test('listDocTemplates: filter outputType hanya mengembalikan entri yang cocok', () => {
    const excelOnly = listDocTemplates({ outputType: 'excel' });
    assert.ok(excelOnly.length > 0);
    assert.ok(excelOnly.every((t) => t.outputType === 'excel'));

    const wordOnly = listDocTemplates({ outputType: 'word' });
    assert.ok(wordOnly.length > 0);
    assert.ok(wordOnly.every((t) => t.outputType === 'word'));

    const pptOnly = listDocTemplates({ outputType: 'ppt' });
    assert.ok(pptOnly.length > 0);
    assert.ok(pptOnly.every((t) => t.outputType === 'ppt'));

    const videoPlanOnly = listDocTemplates({ outputType: 'video-plan' });
    assert.ok(videoPlanOnly.length > 0);
    assert.ok(videoPlanOnly.every((t) => t.outputType === 'video-plan'));

    // Tidak ada satupun template di sini yang menghasilkan gambar (Aturan Keras 4 -- template
    // deterministik, bukan generate gambar bebas), jadi filter 'image' wajib kosong.
    const imageOnly = listDocTemplates({ outputType: 'image' });
    assert.equal(imageOnly.length, 0);
  });

  test('resolveDocTemplate: id yang ada dari tiap sumber ditemukan dengan outputType benar', () => {
    const financial = resolveDocTemplate('laba-rugi-lengkap-umkm');
    assert.ok(financial);
    assert.equal(financial?.source, 'financial-report');
    assert.equal(financial?.outputType, 'excel');

    const invoice = resolveDocTemplate('invoice-standar');
    assert.ok(invoice);
    assert.equal(invoice?.source, 'invoice');
    assert.equal(invoice?.outputType, 'word');

    const deck = resolveDocTemplate('penawaran-ke-klien');
    assert.ok(deck);
    assert.equal(deck?.source, 'deck');
    assert.equal(deck?.outputType, 'ppt');

    const video = resolveDocTemplate('video-penawaran-produk');
    assert.ok(video);
    assert.equal(video?.source, 'video-brief');
    assert.equal(video?.outputType, 'video-plan');

    // Case-insensitive + whitespace, konsisten dengan pola trim+lowercase di 4 resolver sumber.
    const caseInsensitive = resolveDocTemplate('  INVOICE-STANDAR  ');
    assert.equal(caseInsensitive?.id, 'invoice-standar');
  });

  test('resolveDocTemplate: id tidak dikenal atau kosong -> null, tidak pernah throw', () => {
    assert.equal(resolveDocTemplate('template-antah-berantah-xyz'), null);
    assert.equal(resolveDocTemplate(''), null);
    assert.equal(resolveDocTemplate(undefined), null);
    assert.equal(resolveDocTemplate('   '), null);
  });
});

describe('doc-templates/index: buildTemplatedBrief', () => {
  test('templateId tak dikenal/kosong -> brief dikembalikan apa adanya (backward-compat)', () => {
    assert.equal(buildTemplatedBrief(undefined, 'Bikin laporan bulan ini'), 'Bikin laporan bulan ini');
    assert.equal(buildTemplatedBrief('', 'Bikin laporan bulan ini'), 'Bikin laporan bulan ini');
    assert.equal(buildTemplatedBrief('id-antah-berantah', 'Bikin laporan bulan ini'), 'Bikin laporan bulan ini');
  });

  test('template financial-report: hasil memuat brief pengguna dan struktur section template', () => {
    const brief = 'Buatkan laporan laba rugi PT Contoh Sejahtera bulan Agustus 2026';
    const result = buildTemplatedBrief('laba-rugi-lengkap-umkm', brief);
    assert.match(result, /Buatkan laporan laba rugi PT Contoh Sejahtera bulan Agustus 2026/);
    assert.match(result, /Laba Rugi \(Lengkap, Standar Praktik UMKM\)/);
    assert.match(result, /Pendapatan Usaha/);
    assert.match(result, /Laba Kotor/);
  });

  test('template invoice: hasil memuat brief pengguna dan struktur field wajib invoice', () => {
    const brief = 'Buat invoice untuk pelanggan Budi, jasa desain logo Rp 1.500.000';
    const result = buildTemplatedBrief('invoice-standar', brief);
    assert.match(result, /Buat invoice untuk pelanggan Budi, jasa desain logo Rp 1\.500\.000/);
    assert.match(result, /Invoice Standar \(Tanpa PPN\)/);
    assert.match(result, /Nomor Invoice/);
  });

  test('template deck: hasil memuat brief pengguna dan struktur slide template', () => {
    const brief = 'Bikin penawaran jasa katering untuk PT Contoh Sejahtera';
    const result = buildTemplatedBrief('penawaran-ke-klien', brief);
    assert.match(result, /Bikin penawaran jasa katering untuk PT Contoh Sejahtera/);
    assert.match(result, /Penawaran\/Proposal ke Klien/);
    assert.match(result, /Rincian Harga/);
  });

  test('template video-brief: hasil memuat brief pengguna (disisipkan di dalam instruksi) dan struktur scene', () => {
    const brief = 'Video promo diskon 20 persen untuk produk kopi kemasan';
    const result = buildTemplatedBrief('video-penawaran-produk', brief);
    assert.match(result, /Video promo diskon 20 persen untuk produk kopi kemasan/);
    assert.match(result, /Video Penawaran Produk\/Jasa/);
    assert.match(result, /Scene 1/);
    // Disclaimer status produk wajib ikut, supaya user tidak salah kira ini video jadi.
    assert.match(result, /Render video otomatis belum tersedia di KLIR/);
  });

  test('brief pengguna selalu tampil sebelum blok instruksi struktur (prioritas visual ke brief)', () => {
    const brief = 'PENANDA_BRIEF_UNIK_12345';
    const result = buildTemplatedBrief('invoice-standar', brief);
    const briefIndex = result.indexOf(brief);
    const structureMarkerIndex = result.indexOf('Struktur template wajib diikuti');
    assert.ok(briefIndex >= 0, 'brief harus ada di hasil');
    assert.ok(structureMarkerIndex > briefIndex, 'brief wajib muncul sebelum blok struktur template');
  });
});

describe('doc-templates: struktur tiap template tidak kosong (deterministik, bukan tebakan LLM)', () => {
  test('financial-report: tiap template punya sections, kolom, dan larangan yang tidak kosong', () => {
    for (const tpl of Object.values(FINANCIAL_REPORT_TEMPLATES)) {
      assert.ok(tpl.sections.length > 0, `template "${tpl.id}" tidak punya sections`);
      assert.ok(tpl.kolom.length > 0, `template "${tpl.id}" tidak punya kolom`);
      assert.ok(tpl.larangan.length > 0, `template "${tpl.id}" tidak punya larangan`);
      assert.ok(tpl.disclaimer.trim().length > 0, `template "${tpl.id}" tidak punya disclaimer`);
    }
  });

  test('invoice: tiap template punya requiredSections dan prohibitions yang tidak kosong', () => {
    for (const tpl of INVOICE_DOC_TEMPLATES) {
      assert.ok(tpl.requiredSections.length > 0, `template "${tpl.id}" tidak punya requiredSections`);
      assert.ok(tpl.prohibitions.length > 0, `template "${tpl.id}" tidak punya prohibitions`);
      assert.ok(tpl.numberingGuidance.trim().length > 0, `template "${tpl.id}" tidak punya numberingGuidance`);
    }
  });

  test('deck: tiap template punya slides yang tidak kosong', () => {
    for (const tpl of DECK_TEMPLATE_LIST) {
      assert.ok(tpl.slides.length > 0, `template "${tpl.id}" tidak punya slides`);
    }
  });

  test('video-brief: tiap template punya scenes dan aturanKhusus yang tidak kosong', () => {
    for (const tpl of Object.values(VIDEO_BRIEF_TEMPLATES)) {
      assert.ok(tpl.scenes.length > 0, `template "${tpl.id}" tidak punya scenes`);
      assert.ok(tpl.aturanKhusus.length > 0, `template "${tpl.id}" tidak punya aturanKhusus`);
    }
  });
});

describe('doc-templates: anti-slop -- nol em-dash U+2014 di seluruh definisi template', () => {
  test('financial-report-templates.ts bebas em-dash', () => {
    const serialized = JSON.stringify(FINANCIAL_REPORT_TEMPLATES);
    assert.equal(serialized.includes(EM_DASH), false);
  });

  test('invoice-templates.ts bebas em-dash', () => {
    const serialized = JSON.stringify(INVOICE_DOC_TEMPLATES);
    assert.equal(serialized.includes(EM_DASH), false);
  });

  test('deck-templates.ts bebas em-dash', () => {
    const serialized = JSON.stringify(DECK_TEMPLATE_LIST);
    assert.equal(serialized.includes(EM_DASH), false);
  });

  test('video-brief-templates.ts bebas em-dash', () => {
    const serialized = JSON.stringify(VIDEO_BRIEF_TEMPLATES);
    assert.equal(serialized.includes(EM_DASH), false);
  });

  test('index.ts (blok instruksi gabungan dari buildTemplatedBrief) bebas em-dash', () => {
    const samples = [
      buildTemplatedBrief('laba-rugi-lengkap-umkm', 'contoh brief'),
      buildTemplatedBrief('invoice-standar', 'contoh brief'),
      buildTemplatedBrief('penawaran-ke-klien', 'contoh brief'),
      buildTemplatedBrief('video-penawaran-produk', 'contoh brief'),
    ];
    for (const s of samples) {
      assert.equal(s.includes(EM_DASH), false);
    }
  });
});
