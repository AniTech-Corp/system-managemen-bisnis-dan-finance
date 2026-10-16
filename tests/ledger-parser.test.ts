import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as XLSX from 'xlsx';
import { parseLedgerWorkbook } from '../src/lib/ai-brain/ledger-parser';
import { validateLedger } from '../src/lib/ai-brain/ledger-validator';

// Workbook SINTETIS kecil dibangun di memori (bukan file di disk -- tidak menyentuh data
// asli calon klien), meniru struktur inti fixture asli milik calon klien TANPA menyalin
// data aslinya: basmalah di baris 1, header ledger di baris 7 (1-based), 11 baris
// transaksi (opening + 10), kode posting 2 blok kolom, 1 sheet laba-rugi turunan dengan
// SATU angka sengaja salah (kode 61 "Konsumsi" ditulis 999999, padahal buku kas hanya
// mencatat total kredit 150000 untuk kode itu) -- parser+validator harus menangkapnya.
function buildSyntheticWorkbook(): Buffer {
  const wb = XLSX.utils.book_new();

  // --- sheet "kode posting" -- 2 blok kolom (kiri: kode/nama pendapatan, kanan: kode/nama biaya) ---
  const kodePostingRows: unknown[][] = [
    ['بسم الله الرحمن الرحيم'],
    [' Contoh Usaha Sintetis'],
    [],
    ['KODE ETIK PEMBUKUAN'],
    [],
    ['1.', 'Pendapatan', null, null, null, null, null, '2.', 'Biaya'],
    [null, 25, 'Penjualan Barang Umum', null, null, null, null, null, 60, 'Sewa Kantor'],
    [null, 26, 'Penjualan Jasa', null, null, null, null, null, 61, 'Konsumsi'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(kodePostingRows), 'kode posting');

  // --- sheet "buku kas" -- ledger kronologis, header di baris index 6 (Excel row 7) ---
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);
  const bukuKasRows: unknown[][] = [
    ['بسم الله الرحمن الرحيم'],
    [],
    [],
    ['BUKU KAS / BESAR'],
    ['BULAN JAN.2024'],
    [],
    ['NO.', 'TARIKH', 'URAIAN', 'KODE', 'DEBET', 'KREDIT', 'SALDO'],
    [1, d(2024, 1, 1), 'Saldo Awal', 0, 0, null, 0],
    [2, d(2024, 1, 1), 'Modal awal', 10, 1000000, null, 1000000],
    [3, d(2024, 1, 2), 'Penjualan Barang Umum', 25, 500000, null, 1500000],
    [4, d(2024, 1, 3), 'Bayar Sewa Kantor', 60, null, 100000, 1400000],
    [5, d(2024, 1, 4), 'Bayar Konsumsi', 61, null, 50000, 1350000],
    [6, d(2024, 1, 5), 'Penjualan Jasa', 26, 300000, null, 1650000],
    [7, d(2024, 1, 6), 'Bayar Sewa Kantor', 60, null, 100000, 1550000],
    [8, d(2024, 1, 7), 'Bayar Konsumsi', 61, null, 50000, 1500000],
    [9, d(2024, 1, 8), 'Penjualan Barang Umum', 25, 200000, null, 1700000],
    [10, d(2024, 1, 9), 'Bayar Sewa Kantor', 60, null, 100000, 1600000],
    [11, d(2024, 1, 10), 'Bayar Konsumsi', 61, null, 50000, 1550000],
    // baris footer JUMLAH -- TIDAK punya TARIKH, harus dilewati parser (bukan transaksi).
    [null, null, null, null, 2000000, 450000, null],
    [null, null, null, null, null, null, 'Kota Sintetis, 1 Februari 2024'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bukuKasRows), 'buku kas');

  // --- sheet "laba-rugi" turunan, dengan 1 angka SENGAJA SALAH (kode 61 = 999999) ---
  const labaRugiRows: unknown[][] = [
    ['بسم الله الرحمن الرحيم'],
    ['LABA / RUGI'],
    [],
    [null, 'URAIAN', null, 'KODE', 'JUMLAH (Rp.)'],
    ['PENDAPATAN'],
    [null, '-', 'Penjualan Barang Umum', 25, 700000],
    [null, '-', 'Penjualan Jasa', 26, 300000],
    [null, null, null, 'Jumlah', 1000000],
    [],
    ['BIAYA-BIAYA'],
    [null, '-', 'Sewa Kantor', 60, 300000],
    [null, '-', 'Konsumsi', 61, 999999], // <-- ANGKA SALAH (seharusnya 150000, lihat buku kas)
    [null, null, null, 'Jumlah', 450000],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(labaRugiRows), 'laba-rugi');

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return out as Buffer;
}

describe('ledger-parser + ledger-validator vs workbook sintetis', () => {
  const buffer = buildSyntheticWorkbook();
  const parsed = parseLedgerWorkbook(buffer);
  const report = validateLedger(parsed);

  test('parseLedgerWorkbook mengklasifikasi ketiga sheet dengan benar', () => {
    assert.deepEqual(parsed.sheetNames, ['kode posting', 'buku kas', 'laba-rugi']);
    assert.ok(parsed.transactionsBySheet['buku kas']);
    assert.ok(parsed.statementSheets['laba-rugi']);
  });

  test('kode posting ke-parse jadi chart of accounts dari KEDUA blok kolom', () => {
    assert.equal(parsed.chartOfAccounts.get(25), 'Penjualan Barang Umum');
    assert.equal(parsed.chartOfAccounts.get(26), 'Penjualan Jasa');
    assert.equal(parsed.chartOfAccounts.get(60), 'Sewa Kantor');
    assert.equal(parsed.chartOfAccounts.get(61), 'Konsumsi');
  });

  test('baris footer JUMLAH (tanpa TARIKH) TIDAK ikut dihitung sebagai transaksi', () => {
    // 11 baris transaksi asli (Saldo Awal + 10) -- baris footer JUMLAH & tanda-tangan
    // (2 baris terakhir di rows, keduanya tanpa TARIKH valid) harus dilewati.
    const txs = parsed.transactionsBySheet['buku kas'];
    assert.equal(txs.length, 11);
    assert.ok(txs.every((t) => t.dateIso !== null));
  });

  test('saldo berjalan tiap baris konsisten (tidak ada running-balance-mismatch)', () => {
    const balanceMismatches = report.discrepancies.filter((d) => d.kind === 'running-balance-mismatch');
    assert.equal(balanceMismatches.length, 0);
    assert.equal(report.computed.saldoAkhir, 1550000);
  });

  test('parser+validator MENANGKAP angka salah yang sengaja disisipkan (kode 61 di laba-rugi)', () => {
    const mismatch = report.discrepancies.find((d) => d.kind === 'kode-total-mismatch' && d.where.includes('kode 61'));
    assert.ok(mismatch, 'discrepancy untuk kode 61 (Konsumsi) harus terdeteksi');
    assert.equal(mismatch!.actual, 999999);
    // Hasil hitung ulang dari buku kas: 2x kredit 50000 = 100000... tunggu, sebenarnya
    // ada 3 transaksi Konsumsi @50000 = 150000 (baris 5, 8, 11 di buku kas sintetis).
    assert.equal(mismatch!.expected, 150000);
  });

  test('kode 60 (Sewa Kantor) yang BENAR tidak ikut ke-flag sebagai discrepancy', () => {
    const falsePositive = report.discrepancies.find((d) => d.kind === 'kode-total-mismatch' && d.where.includes('kode 60'));
    assert.equal(falsePositive, undefined);
    const reconciledSewa = report.reconciled.find((r) => r.description.includes('60'));
    assert.ok(reconciledSewa, 'kode 60 seharusnya masuk daftar reconciled (cocok)');
  });

  test('agregasi per-kode dari buku kas benar', () => {
    assert.deepEqual(report.computed.kodeAggregates[25], { debit: 700000, credit: 0 });
    assert.deepEqual(report.computed.kodeAggregates[26], { debit: 300000, credit: 0 });
    assert.deepEqual(report.computed.kodeAggregates[60], { debit: 0, credit: 300000 });
    assert.deepEqual(report.computed.kodeAggregates[61], { debit: 0, credit: 150000 });
  });
});
