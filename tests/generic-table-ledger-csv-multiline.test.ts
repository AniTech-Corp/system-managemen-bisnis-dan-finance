import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { detectGenericLedger, parseCsvText } from '../src/lib/ai-brain/generic-table-ledger';

/**
 * 7 Sep 2026 malam -- temuan refuter keamanan (SEDANG): parser CSV lama memecah baris
 * SEBELUM parsing tanda kutip, jadi sel "Keterangan" yang berisi newline di dalam kutip
 * (umum di ekspor Excel/POS) pecah jadi 2 baris dan menggeser kolom jumlah/jenis baris
 * berikutnya -- dan hasil geseran itu yang ditulis ke CashTransaction saat user
 * konfirmasi. Test ini membuktikan parser baru (state machine satu lintasan) benar.
 */
describe('generic-table-ledger: CSV dengan sel multi-baris di dalam tanda kutip', () => {
  test('parseCsvText: newline di dalam kutip = bagian sel, bukan pemisah baris', () => {
    const csv = 'Tanggal,Keterangan,Jumlah\r\n2026-08-01,"Catering kantor\nlantai 2, gedung A",500000\r\n2026-08-02,Penjualan B,300000\r\n';
    const rows = parseCsvText(csv);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], ['Tanggal', 'Keterangan', 'Jumlah']);
    assert.deepEqual(rows[1], ['2026-08-01', 'Catering kantor\nlantai 2, gedung A', '500000']);
    assert.deepEqual(rows[2], ['2026-08-02', 'Penjualan B', '300000']);
  });

  test('parseCsvText: kutip ganda escaped ("") dan BOM ditangani, baris kosong jadi []', () => {
    const csv = '﻿a,b\n"x ""y""",2\n\n3,4';
    const rows = parseCsvText(csv);
    assert.deepEqual(rows, [['a', 'b'], ['x "y"', '2'], [], ['3', '4']]);
  });

  test('detectGenericLedger: jumlah baris berikutnya TIDAK bergeser setelah sel multi-baris', () => {
    const csv = 'Tanggal,Keterangan,Jumlah\n2026-08-01,"Catering kantor\nlantai 2",500000\n2026-08-02,Penjualan B,300000\n2026-08-03,Penjualan C,250000\n';
    const result = detectGenericLedger(Buffer.from(csv, 'utf8'), 'transaksi.csv');
    assert.equal(result.recognized, true, result.rejectReason);
    const amounts = result.drafts.map((d) => d.amount).sort((a, b) => a - b);
    assert.deepEqual(amounts, [250000, 300000, 500000]);
    assert.equal(result.drafts.length, 3);
  });
});
