import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  parseBankStatement,
  parseIndonesianDate,
  parseIndonesianNumber,
  detectBankFromCSV,
} from '../src/lib/bank-parsers';

describe('parseIndonesianDate', () => {
  test('parses YYYY-MM-DD', () => {
    const date = parseIndonesianDate('2026-09-15');
    assert.ok(date instanceof Date);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 8); // 0-based
    assert.equal(date.getDate(), 15);
  });

  test('parses DD/MM/YYYY', () => {
    const date = parseIndonesianDate('15/09/2026');
    assert.ok(date instanceof Date);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 8);
    assert.equal(date.getDate(), 15);
  });

  test('parses DD-MM-YYYY', () => {
    const date = parseIndonesianDate('15-09-2026');
    assert.ok(date instanceof Date);
    assert.equal(date.getDate(), 15);
  });

  test('parses DD MMM YYYY (Indonesian)', () => {
    const date = parseIndonesianDate('15 Sep 2026');
    assert.ok(date instanceof Date);
    assert.equal(date.getMonth(), 8);
    assert.equal(date.getDate(), 15);
  });

  test('parses DD MMMM YYYY (Indonesian full)', () => {
    const date = parseIndonesianDate('15 September 2026');
    assert.ok(date instanceof Date);
    assert.equal(date.getMonth(), 8);
  });

  test('returns null for invalid date', () => {
    const date = parseIndonesianDate('31/02/2026');
    assert.equal(date, null);
  });

  test('handles Excel serial date', () => {
    // 45000 = 2023-03-15 (approx)
    const date = parseIndonesianDate(45000);
    assert.ok(date instanceof Date);
  });
});

describe('parseIndonesianNumber', () => {
  test('parses plain number', () => {
    assert.equal(parseIndonesianNumber('1000000'), 1000000);
  });

  test('parses Indonesian format with dots', () => {
    assert.equal(parseIndonesianNumber('1.000.000'), 1000000);
  });

  test('parses Indonesian format with comma decimals', () => {
    assert.equal(parseIndonesianNumber('1.000.000,50'), 1000000.5);
  });

  test('parses negative with parentheses', () => {
    assert.equal(parseIndonesianNumber('(1.000.000)'), -1000000);
  });

  test('parses US format', () => {
    assert.equal(parseIndonesianNumber('1,000,000.50'), 1000000.5);
  });

  test('returns 0 for zero/dash', () => {
    assert.equal(parseIndonesianNumber('0'), 0);
    assert.equal(parseIndonesianNumber('-'), 0);
    assert.equal(parseIndonesianNumber(''), 0);
  });

  test('returns null for invalid', () => {
    assert.equal(parseIndonesianNumber('abc'), null);
  });

  test('handles number input', () => {
    assert.equal(parseIndonesianNumber(500000), 500000);
  });
});

describe('detectBankFromCSV', () => {
  test('detects BCA', () => {
    const header = ['Tanggal', 'Keterangan', 'Debet', 'Kredit', 'Saldo'];
    assert.equal(detectBankFromCSV(header), 'BCA');
  });

  test('detects Mandiri', () => {
    const header = ['Tanggal', 'Keterangan', 'Mutasi Debet', 'Mutasi Kredit', 'Saldo'];
    assert.equal(detectBankFromCSV(header), 'MANDIRI');
  });

  test('detects BRI', () => {
    const header = ['Tgl Transaksi', 'Keterangan', 'Debet', 'Kredit', 'Saldo'];
    assert.equal(detectBankFromCSV(header), 'BRI');
  });

  test('detects BNI', () => {
    const header = ['Tanggal', 'Uraian', 'Debet', 'Kredit', 'Saldo'];
    assert.equal(detectBankFromCSV(header), 'BNI');
  });

  test('falls back to GENERIC_CSV', () => {
    const header = ['Date', 'Description', 'Debit', 'Credit', 'Balance'];
    assert.equal(detectBankFromCSV(header), 'GENERIC_CSV');
  });
});

describe('parseBankStatement - CSV', () => {
  test('parses BCA CSV format', async () => {
    const csvContent = `Tanggal,Keterangan,Debet,Kredit,Saldo
15/09/2026,Transfer Masuk,,5.000.000,15.000.000
16/09/2026,Bayar Sewa,2.000.000,,13.000.000
17/09/2026,Gaji Karyawan,5.000.000,,8.000.000`;

    const file = Buffer.from(csvContent, 'utf-8');
    const result = await parseBankStatement(file, 'statement.csv');

    assert.equal(result.errors.length, 0);
    assert.equal(result.lines.length, 3);
    assert.equal(result.lines[0].direction, 'MASUK');
    assert.equal(result.lines[0].creditAmount, 5000000);
    assert.equal(result.lines[1].direction, 'KELUAR');
    assert.equal(result.lines[1].debitAmount, 2000000);
    assert.equal(result.lines[2].direction, 'KELUAR');
    assert.equal(result.lines[2].debitAmount, 5000000);
    assert.equal(result.metadata.bankName, 'BCA');
  });

  test('parses Mandiri CSV format', async () => {
    const csvContent = `Tanggal,Keterangan,Mutasi Debet,Mutasi Kredit,Saldo
15/09/2026,Transfer Masuk,,5.000.000,15.000.000
16/09/2026,Bayar Sewa,2.000.000,,13.000.000`;

    const file = Buffer.from(csvContent, 'utf-8');
    const result = await parseBankStatement(file, 'mandiri.csv');

    assert.equal(result.errors.length, 0);
    assert.equal(result.lines.length, 2);
    assert.equal(result.metadata.bankName, 'Mandiri');
  });

  test('parses semicolon-delimited CSV', async () => {
    const csvContent = `Tanggal;Keterangan;Debet;Kredit;Saldo
15/09/2026;Transfer Masuk;;5.000.000;15.000.000
16/09/2026;Bayar Sewa;2.000.000;;13.000.000`;

    const file = Buffer.from(csvContent, 'utf-8');
    const result = await parseBankStatement(file, 'statement.csv');

    assert.equal(result.errors.length, 0);
    assert.equal(result.lines.length, 2);
  });

  test('handles header not in first row', async () => {
    const csvContent = `Laporan Mutasi Rekening
Periode: September 2026
No Rekening: 1234567890
Tanggal,Keterangan,Debet,Kredit,Saldo
15/09/2026,Transfer Masuk,,5.000.000,15.000.000
16/09/2026,Bayar Sewa,2.000.000,,13.000.000`;

    const file = Buffer.from(csvContent, 'utf-8');
    const result = await parseBankStatement(file, 'statement.csv');

    assert.equal(result.errors.length, 0);
    assert.equal(result.lines.length, 2);
  });

  test('returns error for unsupported format', async () => {
    const file = Buffer.from('not a csv', 'utf-8');
    const result = await parseBankStatement(file, 'statement.txt');

    assert.equal(result.errors.length, 1);
    assert.ok(result.errors[0].message.includes('tidak didukung'));
  });
});

describe('parseBankStatement - Excel', () => {
  test('parses Excel file', async () => {
    // Create a simple Excel buffer using xlsx
    const XLSX = await import('xlsx');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Tanggal', 'Keterangan', 'Debet', 'Kredit', 'Saldo'],
      ['15/09/2026', 'Transfer Masuk', '', '5.000.000', '15.000.000'],
      ['16/09/2026', 'Bayar Sewa', '2.000.000', '', '13.000.000'],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const result = await parseBankStatement(buffer, 'statement.xlsx');

    assert.equal(result.errors.length, 0);
    assert.equal(result.lines.length, 2);
    assert.equal(result.lines[0].direction, 'MASUK');
    assert.equal(result.lines[1].direction, 'KELUAR');
  });
});