import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as XLSX from 'xlsx';
import { parseLedgerWorkbook } from '../src/lib/ai-brain/ledger-parser';
import { validateLedger } from '../src/lib/ai-brain/ledger-validator';
import { parseIndonesianDate } from '../src/lib/ai-brain/date-normalizer';

// Menutup gap yang ditemukan verifier adversarial 2026-09-06:
//   (1) detectDateAnomalies() sebelumnya TIDAK PERNAH dipanggil di jalur produksi
//       (cuma ada di unit test-nya sendiri) -- sekarang dipanggil validateLedger().
//   (2) tahun 4-digit di luar rentang wajar ("2104-01-03") lolos dengan confidence 1
//       tanpa warning -- sekarang confidence turun + warning di semua cabang 4-digit.
//   (3) singkatan "Agst" (Agustus) tidak dikenali -- sekarang dikenali.
// Workbook SINTETIS di memori (bukan data asli klien).

function buildWorkbookWithDateTypos(): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['KODE ETIK PEMBUKUAN'],
      ['1.', 'Pendapatan', null, null, null, null, null, '2.', 'Biaya'],
      [null, 25, 'Penjualan Barang Umum', null, null, null, null, null, 60, 'Sewa Kantor'],
    ]),
    'kode posting',
  );
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['BUKU KAS / BESAR'],
      ['BULAN JAN.2024'],
      ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
      [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
      [2, d(2024, 1, 2), 'Modal awal', 10, 1000000, null, 1000000],
      [3, d(2024, 1, 3), 'Penjualan', 25, 500000, null, 1500000],
      // TYPO TAHUN: 2104 padahal tetangga 2024 -- harus ketahuan (suspicious-year-jump).
      [4, '2104-01-04', 'Bayar Sewa (tahun typo)', 60, null, 100000, 1400000],
      [5, d(2024, 1, 5), 'Penjualan', 25, 200000, null, 1600000],
      // TANGGAL MUNDUR: 2024-01-02 setelah 2024-01-05 -- harus ketahuan (non-monotonic).
      [6, d(2024, 1, 2), 'Bayar Sewa (tanggal mundur)', 60, null, 100000, 1500000],
      // TANGGAL MUSTAHIL: 31 Feb -- harus ketahuan (impossible-date), baris ini tidak
      // masuk Transaction[] karena TARIKH gagal parse, jadi dicek lewat parseIndonesianDate.
    ]),
    'buku kas',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('validateLedger memanggil detectDateAnomalies (FASE 2 terpasang di jalur produksi)', () => {
  const report = validateLedger(parseLedgerWorkbook(buildWorkbookWithDateTypos()));

  test('report punya field dateAnomalies (bukan undefined)', () => {
    assert.ok(Array.isArray(report.dateAnomalies));
  });

  test('typo tahun 2104 di tengah deret 2024 terdeteksi sebagai suspicious-year-jump', () => {
    const hit = report.dateAnomalies.find((a) => a.kind === 'suspicious-year-jump');
    assert.ok(hit, 'suspicious-year-jump tidak ditemukan: ' + JSON.stringify(report.dateAnomalies));
    assert.equal(hit!.severity, 'high');
  });

  test('tanggal mundur terdeteksi sebagai non-monotonic', () => {
    assert.ok(report.dateAnomalies.some((a) => a.kind === 'non-monotonic'));
  });

  test('setiap anomali tanggal JUGA muncul di discrepancies dengan kind date-anomaly', () => {
    const dateDisc = report.discrepancies.filter((x) => x.kind === 'date-anomaly');
    assert.equal(dateDisc.length, report.dateAnomalies.length);
    assert.ok(dateDisc.every((x) => typeof x.where === 'string' && x.where.length > 0));
  });

  test('anomali TIDAK mengubah data asli (transaksi tetap ada, tidak di-overwrite)', () => {
    assert.equal(report.computed.transactionCount, 6);
  });
});

// Regresi dari bukti ke file asli 2026-09-06: 334 false-positive "duplicate" karena
// detektor tanggal mencap dua transaksi di hari yang sama sebagai duplikat.
function buildSameDayAndRealDupWorkbook(): Buffer {
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
      [1, d(2024, 1, 2), 'Saldo Awal', 0, 0, null, 0],
      // 3 transaksi BERBEDA di hari yang sama -- NORMAL, tidak boleh dicap apapun.
      [2, d(2024, 1, 2), 'Modal awal', 10, 1000000, null, 1000000],
      [3, d(2024, 1, 2), 'Penjualan pagi', 25, 500000, null, 1500000],
      [4, d(2024, 1, 2), 'Bayar Sewa Kantor', 60, null, 100000, 1400000],
      // Duplikat SUNGGUHAN: baris 6 identik persis dengan baris 5.
      [5, d(2024, 1, 3), 'Penjualan sore', 25, 250000, null, 1650000],
      [6, d(2024, 1, 3), 'Penjualan sore', 25, 250000, null, 1900000],
    ]),
    'buku kas',
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('duplikat dicek di level transaksi, BUKAN tanggal doang', () => {
  const report = validateLedger(parseLedgerWorkbook(buildSameDayAndRealDupWorkbook()));

  test('transaksi berbeda di hari yang sama TIDAK menghasilkan anomali tanggal apapun', () => {
    assert.equal(report.dateAnomalies.length, 0, JSON.stringify(report.dateAnomalies));
    assert.equal(report.discrepancies.filter((x) => x.kind === 'date-anomaly').length, 0);
  });

  test('baris yang identik persis (tanggal+uraian+kode+nominal) ditandai duplicate-transaction', () => {
    const dups = report.discrepancies.filter((x) => x.kind === 'duplicate-transaction');
    assert.equal(dups.length, 1, JSON.stringify(report.discrepancies));
    assert.match(dups[0].where, /baris 7$/); // Excel row 7 = entri NO.6
    assert.equal(dups[0].severity, 'warning');
  });

  test('catatan reconciled "urutan & validitas tanggal" muncul kalau tidak ada anomali', () => {
    assert.ok(report.reconciled.some((n) => /tanggal/i.test(n.description)));
  });
});

describe('parseIndonesianDate: cek tahun wajar di semua cabang 4-digit', () => {
  test('"2104-01-03" (ISO) tetap ke-parse tapi confidence turun + warning', () => {
    const r = parseIndonesianDate('2104-01-03');
    assert.equal(r.iso, '2104-01-03');
    assert.ok(r.confidence <= 0.5);
    assert.ok(r.warnings.some((w) => /rentang wajar/.test(w)));
  });

  test('"15/10/2104" (dd/mm/yyyy) dapat warning tahun', () => {
    const r = parseIndonesianDate('15/10/2104');
    assert.ok(r.warnings.some((w) => /rentang wajar/.test(w)));
  });

  test('"15 Oktober 2104" (dd-namabulan-yyyy) dapat warning tahun', () => {
    const r = parseIndonesianDate('15 Oktober 2104');
    assert.ok(r.warnings.some((w) => /rentang wajar/.test(w)));
  });

  test('"JAN.2104" (bulan-tahun 4 digit) dapat warning tahun', () => {
    const r = parseIndonesianDate('JAN.2104');
    assert.ok(r.warnings.some((w) => /rentang wajar/.test(w)));
  });

  test('"2014-01-03" (tahun wajar) TIDAK kena warning tahun -- tidak ada regresi', () => {
    const r = parseIndonesianDate('2014-01-03');
    assert.equal(r.confidence, 1);
    assert.equal(r.warnings.length, 0);
  });

  test('"Agst 2014" sekarang dikenali sebagai Agustus', () => {
    const r = parseIndonesianDate('Agst 2014');
    assert.equal(r.iso, '2014-08-01');
  });

  test('"31/02/2015" tetap ditolak jujur (iso null), bukan ditebak', () => {
    const r = parseIndonesianDate('31/02/2015');
    assert.equal(r.iso, null);
  });
});
