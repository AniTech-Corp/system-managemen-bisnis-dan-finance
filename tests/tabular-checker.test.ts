import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { checkTabularText } from '../src/lib/ai-brain/tabular-checker';

// Unit test murni untuk checkTabularText() -- generalisasi document-check untuk
// tabel non-ledger (roadmap 2026-09-06 Bagian 3.4). Data sintetis "tabel
// karyawan" dibangun inline sebagai CSV, meniru bentuk output
// XLSX.utils.sheet_to_csv() yang jadi sumber input fungsi ini di route.ts.

describe('checkTabularText', () => {
  test('header + rowCount terbaca benar dari CSV sederhana', () => {
    const csv = ['Nama,NIK,Tanggal Masuk', 'Budi Santoso,3201012345678901,01/01/2020', 'Siti Aminah,3201019876543210,15/03/2021'].join(
      '\n'
    );
    const report = checkTabularText(csv, { fileName: 'karyawan.csv' });
    assert.deepEqual(report.headers, ['Nama', 'NIK', 'Tanggal Masuk']);
    assert.equal(report.rowCount, 2);
  });

  test('kolom tanggal berisi nilai tak-terparse -> anomaly impossible-date', () => {
    const csv = ['Nama,Tanggal Masuk', 'Budi Santoso,31/02/2020', 'Siti Aminah,15/03/2021'].join('\n');
    const report = checkTabularText(csv, { fileName: 'karyawan.csv' });
    const anomaly = report.anomalies.find((a) => a.kind === 'impossible-date');
    assert.ok(anomaly, 'tanggal 31 Februari di kolom bertipe tanggal harus ditandai');
    assert.equal(anomaly!.evidence.row, 2);
  });

  test('kolom tanggal valid semua -> tidak ada anomaly impossible-date', () => {
    const csv = ['Nama,Tanggal Masuk', 'Budi Santoso,01/01/2020', 'Siti Aminah,15/03/2021'].join('\n');
    const report = checkTabularText(csv, { fileName: 'karyawan.csv' });
    const anomaly = report.anomalies.find((a) => a.kind === 'impossible-date');
    assert.equal(anomaly, undefined);
  });

  test('baris data duplikat persis -> anomaly duplicate-row', () => {
    const csv = ['Nama,NIK', 'Budi Santoso,3201012345678901', 'Siti Aminah,3201019876543210', 'Budi Santoso,3201012345678901'].join(
      '\n'
    );
    const report = checkTabularText(csv, { fileName: 'karyawan.csv' });
    const anomaly = report.anomalies.find((a) => a.kind === 'duplicate-row');
    assert.ok(anomaly, 'baris identik yang berulang di tabel harus ditandai duplicate-row');
    assert.equal(anomaly!.evidence.row, 4);
    assert.equal(anomaly!.evidence.duplicateOfRow, 2);
  });

  test('sel wajib kosong (kolom terisi di baris lain, kosong di 1 baris) -> anomaly missing-required-cell', () => {
    const csv = [
      'Nama,Jabatan',
      'Budi Santoso,Staff',
      'Siti Aminah,',
      'Andi Wijaya,Supervisor',
      'Dewi Lestari,Staff',
      'Rudi Hartono,Manager',
    ].join('\n');
    const report = checkTabularText(csv, { fileName: 'karyawan.csv' });
    const anomaly = report.anomalies.find((a) => a.kind === 'missing-required-cell');
    assert.ok(anomaly, 'sel kosong pada kolom yang mayoritas terisi harus ditandai');
    assert.equal(anomaly!.evidence.row, 3);
  });

  test('kolom yang memang jarang terisi (bukan wajib) tidak menghasilkan noise berlebihan', () => {
    const csv = [
      'Nama,Catatan Khusus',
      'Budi Santoso,',
      'Siti Aminah,',
      'Andi Wijaya,Cuti melahirkan',
      'Dewi Lestari,',
    ].join('\n');
    const report = checkTabularText(csv, { fileName: 'karyawan.csv' });
    const anomaly = report.anomalies.find((a) => a.kind === 'missing-required-cell');
    assert.equal(anomaly, undefined, 'kolom yang mayoritas kosong (fill ratio rendah) bukan anomali per-baris');
  });

  test('kolom nominal berisi teks tak-terparse -> anomaly nominal-mismatch (info)', () => {
    const csv = ['Nama,Gaji', 'Budi Santoso,5000000', 'Siti Aminah,tidak diketahui'].join('\n');
    const report = checkTabularText(csv, { fileName: 'gaji.csv' });
    const anomaly = report.anomalies.find((a) => a.kind === 'nominal-mismatch');
    assert.ok(anomaly, 'sel gaji yang tidak bisa diparse sebagai angka harus ditandai');
    assert.equal(anomaly!.severity, 'info');
  });

  test('input kosong -> report kosong tanpa error', () => {
    const report = checkTabularText('', { fileName: 'kosong.csv' });
    assert.deepEqual(report.headers, []);
    assert.equal(report.rowCount, 0);
    assert.equal(report.anomalies.length, 0);
  });

  test('sel berkutip mengandung koma diparse benar (CSV escaping)', () => {
    const csv = ['Nama,Alamat', '"Budi Santoso","Jl. Merdeka No. 1, Jakarta"'].join('\n');
    const report = checkTabularText(csv, { fileName: 'alamat.csv' });
    assert.equal(report.rowCount, 1);
    // Tidak boleh error/salah split walau ada koma di dalam sel berkutip.
  });

  test('NOL panggilan LLM -- checkTabularText adalah fungsi sinkron murni', () => {
    const result = checkTabularText('a,b\n1,2', { fileName: 'x.csv' });
    assert.equal(result instanceof Promise, false, 'checkTabularText harus sinkron (nol LLM/network call)');
  });
});
