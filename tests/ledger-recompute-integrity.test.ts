import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as XLSX from 'xlsx';
import { parseLedgerWorkbook } from '../src/lib/ai-brain/ledger-parser';
import { validateLedger } from '../src/lib/ai-brain/ledger-validator';

// 3 regression test WAJIB dari review lanjutan Codex 2026-09-06 (checkpoint
// 2026-09-06-codex-handoff.md, bagian "Review lanjutan Codex -- masukan untuk Claude").
// Codex mereproduksi 2 bug nyata di ledger-validator.ts/ledger-parser.ts pakai workbook
// sintetis (bukan file klien asli): (1) computed.totalBiaya/labaOperasional diam-diam
// ikut angka sheet laba-rugi yang SEDANG DIAUDIT, bukan hasil hitung ulang mandiri;
// (2) transaksi bertanggal mustahil dibuang parser sebelum sempat dideteksi sebagai
// anomali. Ketiga test di bawah adalah persis yang diminta Codex sebagai syarat
// sebelum modul ini boleh disebut layak produksi.

function buildWorkbookWrongLabaRugi(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['1.', 'Pendapatan', null, null, null, null, null, '2.', 'Biaya'],
      [null, 25, 'Penjualan Barang Umum', null, null, null, null, null, 60, 'Sewa Kantor'],
    ]),
    'kode posting',
  );
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
      [2, d(2024, 1, 2), 'Penjualan Barang Umum', 25, 1000, null, 1000],
      [3, d(2024, 1, 3), 'Bayar Sewa Kantor', 60, null, 100, 900],
    ]),
    'buku kas',
  );
  // Angka biaya di laba-rugi SENGAJA ditulis 900, padahal buku kas cuma mencatat 100
  // kredit untuk kode 60 -- persis skenario reproduksi Codex (pendapatan 1000, biaya
  // asli 100, laba seharusnya 900; laporan salah tulis biaya jadi 900).
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      [null, 'URAIAN', null, 'KODE', 'JUMLAH (Rp.)'],
      ['PENDAPATAN'],
      [null, '-', 'Penjualan Barang Umum', 25, 1000],
      [null, null, null, 'Jumlah', 1000],
      [],
      ['BIAYA-BIAYA'],
      [null, '-', 'Sewa Kantor', 60, 900],
      [null, null, null, 'Jumlah', 900],
    ]),
    'laba-rugi',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('regression #1 (Codex 2026-09-06): laporan biaya salah TIDAK boleh mengubah computed total biaya/laba', () => {
  const report = validateLedger(parseLedgerWorkbook(buildWorkbookWrongLabaRugi()));

  test('discrepancy kode-total-mismatch tetap terdeteksi (expected 100, actual 900)', () => {
    const mismatch = report.discrepancies.find((d) => d.kind === 'kode-total-mismatch' && d.where.includes('kode 60'));
    assert.ok(mismatch, 'discrepancy untuk kode 60 harus terdeteksi');
    assert.equal(mismatch!.expected, 100);
    assert.equal(mismatch!.actual, 900);
  });

  test('computed.totalBiaya memakai hasil hitung ulang (100), BUKAN angka laba-rugi yang salah (900)', () => {
    assert.equal(report.computed.totalBiaya, 100);
  });

  test('computed.totalPendapatan = 1000 (cocok, tidak ada yang salah di sisi ini)', () => {
    assert.equal(report.computed.totalPendapatan, 1000);
  });

  test('computed.labaOperasional = 900 (recomputed), BUKAN 100 (yang akan didapat kalau ikut angka salah)', () => {
    assert.equal(report.computed.labaOperasional, 900);
  });
});

function buildWorkbookImpossibleDate(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['1.', 'Pendapatan', null, null, null, null, null, '2.', 'Biaya'],
      [null, 25, 'Penjualan Barang Umum', null, null, null, null, null, 60, 'Sewa Kantor'],
    ]),
    'kode posting',
  );
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
      [2, d(2024, 1, 2), 'Penjualan', 25, 500, null, 500],
      // Tanggal MUSTAHIL (31 Februari tidak ada) -- string, bukan Date object, supaya
      // benar-benar mensimulasikan sel Excel yang gagal parse sebagai tanggal.
      [3, '31/02/2024', 'Penjualan tanggal mustahil', 25, 500, null, null],
      [4, d(2024, 1, 4), 'Penjualan', 25, 300, null, 800],
    ]),
    'buku kas',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('regression #2 (Codex 2026-09-06): transaksi tanggal mustahil (31/02/2024) TIDAK dibuang diam-diam', () => {
  const parsed = parseLedgerWorkbook(buildWorkbookImpossibleDate());
  const report = validateLedger(parsed);

  test('baris tanggal mustahil TIDAK masuk Transaction[] (tidak dihitung sebagai transaksi valid)', () => {
    const txs = parsed.transactionsBySheet['buku kas'];
    assert.equal(txs.length, 3); // Saldo Awal + 2 penjualan valid (row 2 dan row 4), BUKAN 4
    assert.ok(txs.every((t) => t.dateIso !== null));
  });

  test('baris itu dipertahankan di parsed.invalidRows (bukan lenyap tanpa jejak)', () => {
    const invalid = parsed.invalidRows['buku kas'];
    assert.ok(invalid, 'invalidRows["buku kas"] harus ada');
    assert.equal(invalid!.length, 1);
    assert.equal(invalid![0].dateRaw, '31/02/2024');
    assert.equal(invalid![0].description, 'Penjualan tanggal mustahil');
  });

  test('detectDateAnomalies melaporkannya sebagai impossible-date (bukan diam-diam hilang)', () => {
    const anomaly = report.dateAnomalies.find((a) => a.kind === 'impossible-date');
    assert.ok(anomaly, 'anomali impossible-date harus terdeteksi untuk baris tanggal mustahil');
    assert.equal(anomaly!.raw, '31/02/2024');
  });

  test('anomali JUGA tercermin di discrepancies (kind date-anomaly)', () => {
    const disc = report.discrepancies.find((d) => d.kind === 'date-anomaly' && String(d.actual).includes('31/02/2024'));
    assert.ok(disc, 'discrepancy date-anomaly untuk baris ini harus ada');
  });

  test('nominal 500 dari baris invalid TIDAK ikut agregasi finansial (kodeAggregates kode 25 cuma 800, bukan 1300)', () => {
    // Kalau baris invalid ikut ke Transaction[], debit kode 25 akan jadi 500+500+300=1300.
    // Yang benar: hanya 2 transaksi valid (500 dari row2 + 300 dari row4) = 800.
    assert.deepEqual(report.computed.kodeAggregates[25], { debit: 800, credit: 0 });
  });

  test('saldo berjalan baris valid tetap konsisten (baris invalid dilewati, bukan mengganggu saldo)', () => {
    const balanceMismatches = report.discrepancies.filter((d) => d.kind === 'running-balance-mismatch');
    assert.equal(balanceMismatches.length, 0);
    assert.equal(report.computed.saldoAkhir, 800);
  });
});

function buildWorkbookNoLabaRugi(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['1.', 'Pendapatan', null, null, null, null, null, '2.', 'Biaya'],
      [null, 25, 'Penjualan Barang Umum', null, null, null, null, null, 60, 'Sewa Kantor'],
    ]),
    'kode posting',
  );
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
      [2, d(2024, 1, 2), 'Penjualan', 25, 500, null, 500],
      [3, d(2024, 1, 3), 'Bayar Sewa', 60, null, 100, 400],
    ]),
    'buku kas',
  );
  // SENGAJA tidak ada sheet laba-rugi/statement sama sekali -- buku kas tetap berisi
  // transaksi (bukan workbook kosong).
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('regression #3 (Codex 2026-09-06): sheet laba-rugi hilang -> unknown (null), BUKAN laba=0 yang tampak sah', () => {
  const parsed = parseLedgerWorkbook(buildWorkbookNoLabaRugi());
  const report = validateLedger(parsed);

  test('buku kas TETAP berisi transaksi (bukan workbook kosong)', () => {
    assert.equal(report.computed.transactionCount, 3);
    assert.equal(report.computed.saldoAkhir, 400);
    assert.deepEqual(report.computed.kodeAggregates[25], { debit: 500, credit: 0 });
  });

  test('totalPendapatan/totalBiaya/labaOperasional/zakat/labaBersih semuanya null (BUKAN 0)', () => {
    assert.equal(report.computed.totalPendapatan, null);
    assert.equal(report.computed.totalBiaya, null);
    assert.equal(report.computed.labaOperasional, null);
    assert.equal(report.computed.zakat, null);
    assert.equal(report.computed.labaBersih, null);
  });

  test('warning eksplisit menyebut "tidak ditemukan sheet laba-rugi" dan "TIDAK BISA dihitung"', () => {
    const w = report.warnings.find((x) => x.includes('Tidak ditemukan sheet laba-rugi'));
    assert.ok(w, 'warning tidak ditemukan sheet laba-rugi harus ada');
    assert.match(w!, /TIDAK BISA dihitung/);
    assert.match(w!, /null, BUKAN nol/);
  });
});
