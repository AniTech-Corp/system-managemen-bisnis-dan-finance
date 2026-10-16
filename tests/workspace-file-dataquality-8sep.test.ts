import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  tryCheckWorkspaceFileDataQuality,
  worstSeverity,
  buildDataQualityBlock,
  parseDataQualityHeader,
  extractDqBlockText,
} from '../src/lib/workspace-file-dataquality';
import type { DocumentAnomaly, DocumentCheckReport } from '../src/lib/ai-brain/document-checker';
import type { TabularCheckReport } from '../src/lib/ai-brain/tabular-checker';

// ---------------------------------------------------------------------------
// B4 TESTS -- V4a/b/c: src/lib/workspace-file-dataquality.ts (8 Sep 2026)
//
// PENYIMPANGAN JUJUR dari draft kontrak asli (dicatat eksplisit, sesuai
// instruksi "kalau nama fungsi/field berbeda dari draft, ikuti yang ADA DI
// DISK, catat perbedaannya"): draft kontrak awal menyebut skenario test
// "teks CSV dengan NIK 10 digit -> anomalies berisi kind nik-invalid-length
// (lewat checkTabularText, ext .csv)". Dibaca ULANG src/lib/ai-brain/
// tabular-checker.ts (8 Sep 2026, fungsi checkTabularText) -- checker itu
// TIDAK PERNAH menghasilkan kind 'nik-invalid-length' sama sekali (cek NIK
// via RE_LABEL_NIK hanya ada di document-checker.ts/checkDocumentText, jalur
// TEKS BEBAS, bukan tabular). Modul workspace-file-dataquality.ts sendiri
// cuma MENYAMBUNGKAN dua checker yang sudah ada apa adanya (tidak menambah
// deteksi NIK ke jalur tabular) -- jadi skenario itu diganti di sini dengan
// skenario yang BENERAN dihasilkan checkTabularText (duplicate-row), dan
// skenario NIK dipindah ke test .txt (jalur checkDocumentText) yang memang
// mendukungnya.
// ---------------------------------------------------------------------------

describe('workspace-file-dataquality.ts -- tryCheckWorkspaceFileDataQuality (V4a)', () => {
  test('konten < 20 karakter -> null (caption/OCR super pendek tidak dipaksa dicek)', () => {
    assert.equal(tryCheckWorkspaceFileDataQuality('data.txt', 'pendek'), null);
    assert.equal(tryCheckWorkspaceFileDataQuality('data.txt', ''), null);
  });

  test('ekstensi .csv -> lewat checkTabularText (report shape headers/rowCount, BUKAN entities)', () => {
    // 2 baris data identik -> checkTabularText mendeteksi duplicate-row (info).
    const csv = 'Nama,Departemen\nBudi Santoso,Marketing\nBudi Santoso,Marketing\nSiti Aminah,Finance';
    const report = tryCheckWorkspaceFileDataQuality('daftar-karyawan.csv', csv);
    assert.ok(report, 'report tidak boleh null untuk CSV valid');
    assert.ok('headers' in (report as TabularCheckReport), 'report CSV harus TabularCheckReport (punya field headers)');
    assert.ok(!('entities' in (report as any)), 'report CSV TIDAK boleh punya field entities (itu ciri DocumentCheckReport)');
    const anomalyKinds = (report as TabularCheckReport).anomalies.map((a) => a.kind);
    assert.ok(anomalyKinds.includes('duplicate-row'), `expected duplicate-row, got: ${anomalyKinds.join(',')}`);
  });

  test('ekstensi .txt (dokumen bebas) -> lewat checkDocumentText (report shape entities, mendeteksi NIK salah panjang)', () => {
    const text = 'Data pegawai baru.\nNama: Budi Santoso\nNIK: 1234567890\nAlamat: Jakarta Selatan.';
    const report = tryCheckWorkspaceFileDataQuality('data-pegawai.txt', text);
    assert.ok(report, 'report tidak boleh null untuk teks valid');
    assert.ok('entities' in (report as DocumentCheckReport), 'report .txt harus DocumentCheckReport (punya field entities)');
    const anomalyKinds = (report as DocumentCheckReport).anomalies.map((a) => a.kind);
    assert.ok(anomalyKinds.includes('nik-invalid-length'), `expected nik-invalid-length, got: ${anomalyKinds.join(',')}`);
    const nikAnomaly = (report as DocumentCheckReport).anomalies.find((a) => a.kind === 'nik-invalid-length')!;
    assert.equal(nikAnomaly.severity, 'critical');
  });

  test('file bersih (tanpa anomali apapun) -> tetap mengembalikan report (bukan null), tapi anomalies kosong', () => {
    const text = 'Ini adalah catatan rapat mingguan yang cukup panjang dan tidak mengandung data sensitif apapun.';
    const report = tryCheckWorkspaceFileDataQuality('notulen.txt', text);
    assert.ok(report);
    assert.deepEqual(report!.anomalies, []);
  });

  test('checker gagal (mis. exception internal) -> non-fatal, TIDAK melempar error ke pemanggil', () => {
    // Guard try/catch harus menangkap kegagalan apapun -- pastikan pemanggilan
    // dengan input aneh (bukan string, dipaksa lewat any) tidak melempar.
    assert.doesNotThrow(() => tryCheckWorkspaceFileDataQuality('x.txt', null as unknown as string));
  });
});

describe('workspace-file-dataquality.ts -- worstSeverity', () => {
  test('ada critical -> critical (menang atas warning/info)', () => {
    assert.equal(
      worstSeverity([{ severity: 'info' }, { severity: 'warning' }, { severity: 'critical' }]),
      'critical'
    );
  });
  test('ada warning tanpa critical -> warning', () => {
    assert.equal(worstSeverity([{ severity: 'info' }, { severity: 'warning' }]), 'warning');
  });
  test('cuma info -> info', () => {
    assert.equal(worstSeverity([{ severity: 'info' }]), 'info');
  });
});

function anomaly(severity: DocumentAnomaly['severity'], i: number): DocumentAnomaly {
  return {
    kind: 'typo-candidate',
    severity,
    explanation: `Temuan sintetis nomor ${i} untuk uji batas panjang blok teks kualitas data.`,
    evidence: {},
    suggestion: null,
  };
}

describe('workspace-file-dataquality.ts -- buildDataQualityBlock (V4b)', () => {
  test('0 anomali -> string kosong (file bersih tidak dapat noise di extractedSummary)', () => {
    assert.equal(buildDataQualityBlock({ anomalies: [] }), '');
  });

  test('header memuat jumlah temuan + rincian severity yang benar', () => {
    const block = buildDataQualityBlock({
      anomalies: [anomaly('critical', 1), anomaly('warning', 2), anomaly('warning', 3), anomaly('info', 4)],
    });
    assert.match(block, /^\[PEMERIKSAAN DATA\] 4 temuan \(1 kritis, 2 perhatian, 1 info\)/);
  });

  test('severity yang count-nya 0 TIDAK disebut di header (bukan "0 kritis")', () => {
    const block = buildDataQualityBlock({ anomalies: [anomaly('info', 1), anomaly('info', 2)] });
    assert.match(block, /^\[PEMERIKSAAN DATA\] 2 temuan \(2 info\)/);
    assert.doesNotMatch(block, /0 kritis|0 perhatian/);
  });

  test('>5 anomali -> hanya 5 baris pertama yang tercetak di teks (field anomalies asli tetap 6+, blok teks dibatasi)', () => {
    const anomalies = [1, 2, 3, 4, 5, 6, 7].map((i) => anomaly('info', i));
    const block = buildDataQualityBlock({ anomalies });
    const lineCount = block.split('\n').length; // 1 header + maks 5 baris temuan
    assert.equal(lineCount, 6, `expected 1 header + 5 baris = 6 baris, got ${lineCount}`);
    assert.doesNotMatch(block, /nomor 6|nomor 7/);
    assert.match(block, /nomor 5/);
  });

  test('total blok SELALU <=1200 char walau anomali banyak dengan explanation panjang', () => {
    const longAnomalies = Array.from({ length: 5 }, (_, i) => ({
      kind: 'typo-candidate' as const,
      severity: 'warning' as const,
      explanation: 'X'.repeat(500),
      evidence: {},
      suggestion: 'Y'.repeat(500),
    }));
    const block = buildDataQualityBlock({ anomalies: longAnomalies });
    assert.ok(block.length <= 1200, `expected <=1200, got ${block.length}`);
  });

  test('suggestion null -> fallback teks "Periksa manual."', () => {
    const block = buildDataQualityBlock({
      anomalies: [{ kind: 'typo-candidate', severity: 'info', explanation: 'Contoh temuan.', evidence: {}, suggestion: null }],
    });
    assert.match(block, /Saran: Periksa manual\./);
  });
});

describe('workspace-file-dataquality.ts -- parseDataQualityHeader (V4c)', () => {
  test('string dengan header lengkap -> count & worst benar (critical)', () => {
    const summary = '[PEMERIKSAAN DATA] 3 temuan (1 kritis, 2 perhatian)\n- [critical] contoh\n- [warning] contoh';
    assert.deepEqual(parseDataQualityHeader(summary), { count: 3, worst: 'critical' });
  });

  test('header hanya info -> worst info', () => {
    const summary = '[PEMERIKSAAN DATA] 2 temuan (2 info)\n- [info] a\n- [info] b';
    assert.deepEqual(parseDataQualityHeader(summary), { count: 2, worst: 'info' });
  });

  test('string tanpa header -> {count:0, worst:null}', () => {
    assert.deepEqual(parseDataQualityHeader('Isi dokumen biasa tanpa blok pemeriksaan apapun.'), {
      count: 0,
      worst: null,
    });
  });

  test('summary null/undefined -> {count:0, worst:null}, tidak crash', () => {
    assert.deepEqual(parseDataQualityHeader(null), { count: 0, worst: null });
    assert.deepEqual(parseDataQualityHeader(undefined), { count: 0, worst: null });
  });
});

describe('workspace-file-dataquality.ts -- extractDqBlockText (UI, dipakai Hub & Dashboard)', () => {
  test('summary dengan blok di awal diikuti \\n\\n -> substring blok tepat (tidak ikut menyeret isi dokumen)', () => {
    const summary = '[PEMERIKSAAN DATA] 1 temuan (1 info)\n- [info] contoh temuan. Saran: cek manual.\n\nIsi dokumen asli di sini, sangat panjang dan tidak relevan untuk panel Hub.';
    const extracted = extractDqBlockText(summary);
    assert.ok(extracted);
    assert.ok(extracted!.startsWith('[PEMERIKSAAN DATA] 1 temuan'));
    assert.ok(!extracted!.includes('Isi dokumen asli'), 'blok tidak boleh ikut menyeret isi dokumen setelah \\n\\n');
  });

  test('summary tanpa blok [PEMERIKSAAN DATA] -> null', () => {
    assert.equal(extractDqBlockText('Isi dokumen biasa, tanpa temuan apapun.'), null);
  });

  test('summary null/undefined -> null, tidak crash', () => {
    assert.equal(extractDqBlockText(null), null);
    assert.equal(extractDqBlockText(undefined), null);
  });
});
