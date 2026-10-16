import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  detectTemplateIntent,
  buildTemplateListReply,
  resolveTemplateChoice,
  matchTemplateByText,
} from '../src/lib/ai-brain/template-picker';
import { listDocTemplates } from '../src/lib/doc-templates';

// ---------------------------------------------------------------------------
// B6 TESTS -- src/lib/ai-brain/template-picker.ts (11 Sep 2026, Context Pack
// integrasi-ai-data-model-hemat, kontrak modul 7). PURE FUNCTION murni: nol
// mock diperlukan (langsung import registry asli doc-templates + industry-
// image-templates, sama pola dengan tests/next-actions-8sep.test.ts).
// ---------------------------------------------------------------------------

describe('template-picker.ts -- detectTemplateIntent', () => {
  test('pesan netral tanpa kata kunci apapun -> null', () => {
    assert.equal(detectTemplateIntent('halo, apa kabar?'), null);
  });

  test('pesan kosong / hanya whitespace -> null', () => {
    assert.equal(detectTemplateIntent(''), null);
    assert.equal(detectTemplateIntent('   '), null);
  });

  test('pesan "laporan keuangan" biasa (TANPA kata template/format) -> null (tidak boleh nyasar ke template)', () => {
    // Kontrak Penyesuaian #6: kata "laporan" polos TIDAK boleh dianggap intent
    // template -- kalau iya, akan tabrakan sama next-actions.ts REPORT_SIGNAL.
    assert.equal(detectTemplateIntent('jelaskan laporan keuangan bulan ini'), null);
  });

  test('"template apa saja yang tersedia" (teks yang dikirim slash /template) -> kind list tanpa outputType', () => {
    assert.deepEqual(detectTemplateIntent('template apa saja yang tersedia'), { kind: 'list' });
  });

  test('"mau lihat template dokumen" -> kind list tanpa outputType spesifik (kata "dokumen" -> word)', () => {
    const result = detectTemplateIntent('mau lihat template dokumen apa saja');
    assert.deepEqual(result, { kind: 'list', outputType: 'word' });
  });

  test('"contoh format presentasi dong" -> kind list outputType ppt', () => {
    assert.deepEqual(detectTemplateIntent('contoh format presentasi dong'), { kind: 'list', outputType: 'ppt' });
  });

  test('"format laporan keuangan seperti apa" -> kind list TANPA outputType ("laporan" tidak dipetakan ke tipe manapun)', () => {
    assert.deepEqual(detectTemplateIntent('format laporan keuangan seperti apa'), { kind: 'list' });
  });

  test('"minta template excel buat rekap" -> kind list outputType excel', () => {
    assert.deepEqual(detectTemplateIntent('minta template excel buat rekap'), { kind: 'list', outputType: 'excel' });
  });

  test('"template video untuk promosi" -> kind list outputType video-plan', () => {
    assert.deepEqual(detectTemplateIntent('template video untuk promosi'), { kind: 'list', outputType: 'video-plan' });
  });

  test('"template gambar buat toko saya" -> kind list outputType image', () => {
    assert.deepEqual(detectTemplateIntent('template gambar buat toko saya'), { kind: 'list', outputType: 'image' });
  });

  test('"pakai template invoice-standar" -> kind choose templateId invoice-standar (exact id)', () => {
    assert.deepEqual(detectTemplateIntent('pakai template invoice-standar'), {
      kind: 'choose',
      templateId: 'invoice-standar',
    });
  });

  test('"gunakan template neraca ya" -> kind choose templateId neraca-posisi-keuangan (fuzzy label)', () => {
    assert.deepEqual(detectTemplateIntent('gunakan template neraca ya'), {
      kind: 'choose',
      templateId: 'neraca-posisi-keuangan',
    });
  });

  test('"pilih template pitch investor untuk ke bank besok" -> kind choose templateId pitch-investor-ringkas (fuzzy sebagian label)', () => {
    assert.deepEqual(detectTemplateIntent('pilih template pitch investor untuk ke bank besok'), {
      kind: 'choose',
      templateId: 'pitch-investor-ringkas',
    });
  });

  test('"pakai template abc-tidak-ada-di-registry" -> nama tidak ketemu -> fallback kind list (bukan error/mengarang)', () => {
    assert.deepEqual(detectTemplateIntent('pakai template abc-tidak-ada-di-registry'), { kind: 'list' });
  });

  test('"pakai template" tanpa nama sama sekali -> fallback kind list', () => {
    assert.deepEqual(detectTemplateIntent('saya mau pakai template'), { kind: 'list' });
  });
});

describe('template-picker.ts -- matchTemplateByText', () => {
  test('exact id -> ketemu', () => {
    const found = matchTemplateByText('rekap-invoice-excel');
    assert.ok(found);
    assert.equal(found!.id, 'rekap-invoice-excel');
  });

  test('exact label (case-insensitive) -> ketemu', () => {
    const found = matchTemplateByText('LAPORAN ARUS KAS (METODE TIDAK LANGSUNG)');
    assert.ok(found);
    assert.equal(found!.id, 'laporan-arus-kas');
  });

  test('id sebagai kata utuh di tengah kalimat -> ketemu', () => {
    const found = matchTemplateByText('tolong pakai id surat-tagihan-pengingat ya');
    assert.ok(found);
    assert.equal(found!.id, 'surat-tagihan-pengingat');
  });

  test('kata tidak nyambung ke template manapun -> null (skor 0 bukan menang default)', () => {
    assert.equal(matchTemplateByText('halo apa kabar dunia'), null);
  });

  test('string kosong / whitespace -> null', () => {
    assert.equal(matchTemplateByText(''), null);
    assert.equal(matchTemplateByText('   '), null);
  });

  test('label lebih spesifik menang saat >1 template mengandung kata yang sama ("laporan")', () => {
    // "laporan" sendirian ada di banyak label tapi difilter (<4 huruf? "laporan"
    // 7 huruf, ikut kena banyak label) -- test ini pastikan fungsi tetap
    // deterministik (hasil sama tiap dipanggil), bukan menuntut 1 jawaban benar
    // tunggal secara bisnis.
    const a = matchTemplateByText('laporan kinerja bulanan');
    const b = matchTemplateByText('laporan kinerja bulanan');
    assert.ok(a);
    assert.equal(a!.id, b!.id);
    assert.equal(a!.id, 'laporan-kinerja-bulanan');
  });
});

describe('template-picker.ts -- resolveTemplateChoice', () => {
  test('tanpa kata kunci pemilihan sama sekali -> null', () => {
    assert.equal(resolveTemplateChoice('buatkan laporan laba rugi dong'), null);
  });

  test('kata kunci ada tapi nama template tidak ketemu -> null', () => {
    assert.equal(resolveTemplateChoice('pakai template zzz-tidak-pernah-ada'), null);
  });

  test('ketemu -> field lengkap (templateId/label/outputType/brief non-kosong)', () => {
    const result = resolveTemplateChoice('pakai template invoice-dengan-ppn untuk klien PT Maju Jaya');
    assert.ok(result);
    assert.equal(result!.templateId, 'invoice-dengan-ppn');
    assert.equal(result!.label, 'Invoice dengan PPN');
    assert.equal(result!.outputType, 'word');
    assert.ok(result!.brief.includes('Invoice dengan PPN'));
    assert.ok(result!.brief.length > 0);
  });

  test('brief membawa konteks tambahan setelah nama template (tidak dibuang)', () => {
    const result = resolveTemplateChoice('gunakan template neraca untuk bulan Agustus kemarin');
    assert.ok(result);
    assert.ok(result!.brief.toLowerCase().includes('agustus'));
  });

  test('mendukung ketiga kata kerja: pakai/gunakan/pilih', () => {
    const a = resolveTemplateChoice('pakai template invoice-standar');
    const b = resolveTemplateChoice('gunakan template invoice-standar');
    const c = resolveTemplateChoice('pilih template invoice-standar');
    assert.ok(a && b && c);
    assert.equal(a!.templateId, 'invoice-standar');
    assert.equal(b!.templateId, 'invoice-standar');
    assert.equal(c!.templateId, 'invoice-standar');
  });
});

describe('template-picker.ts -- buildTemplateListReply', () => {
  test('tanpa outputType -> berisi SEMUA 19 template dokumen registry', () => {
    const reply = buildTemplateListReply();
    for (const t of listDocTemplates()) {
      assert.ok(reply.includes(t.label), `reply harus menyebut label "${t.label}"`);
    }
  });

  test('tanpa outputType -> menyertakan gaya visual gambar (industri)', () => {
    const reply = buildTemplateListReply();
    assert.ok(reply.includes('Gaya visual gambar per-industri'));
    assert.ok(reply.includes('Kuliner & F&B'));
  });

  test('selalu jujur soal PDF (tidak bisa digenerate langsung)', () => {
    const reply = buildTemplateListReply();
    assert.ok(/pdf/i.test(reply));
    assert.ok(/word/i.test(reply));
  });

  test('outputType "ppt" -> hanya 5 template deck, TIDAK menyebut gaya visual gambar', () => {
    const reply = buildTemplateListReply('ppt');
    const pptTemplates = listDocTemplates({ outputType: 'ppt' });
    assert.equal(pptTemplates.length, 5);
    for (const t of pptTemplates) {
      assert.ok(reply.includes(t.label));
    }
    // Template non-ppt (mis. invoice) tidak boleh nyasar masuk daftar ini.
    assert.ok(!reply.includes('Invoice Standar'));
    assert.ok(!reply.includes('Gaya visual gambar per-industri'));
  });

  test('outputType "excel" -> 6 template (5 laporan keuangan + rekap invoice excel)', () => {
    const reply = buildTemplateListReply('excel');
    const excelTemplates = listDocTemplates({ outputType: 'excel' });
    assert.equal(excelTemplates.length, 6);
    for (const t of excelTemplates) {
      assert.ok(reply.includes(t.label));
    }
  });

  test('outputType "image" -> nol template dokumen, TAPI tetap menyertakan gaya visual gambar', () => {
    const reply = buildTemplateListReply('image');
    assert.ok(/belum ada template dokumen untuk tipe "image"/i.test(reply));
    assert.ok(reply.includes('Gaya visual gambar per-industri'));
  });

  test('outputType tidak dikenal (typo/asal) -> diperlakukan sama seperti tanpa filter (semua tampil + gaya visual)', () => {
    const reply = buildTemplateListReply('bukan-tipe-yang-valid');
    for (const t of listDocTemplates()) {
      assert.ok(reply.includes(t.label));
    }
    assert.ok(reply.includes('Gaya visual gambar per-industri'));
  });

  test("outputType 'all' -> sama seperti tanpa outputType (semua + gaya visual)", () => {
    const reply = buildTemplateListReply('all');
    assert.ok(reply.includes('Gaya visual gambar per-industri'));
    for (const t of listDocTemplates()) {
      assert.ok(reply.includes(t.label));
    }
  });

  test('setiap baris template menyertakan instruksi "ketik: pakai template <id>"', () => {
    const reply = buildTemplateListReply('ppt');
    assert.ok(reply.includes('ketik: pakai template pitch-investor-ringkas'));
  });
});
