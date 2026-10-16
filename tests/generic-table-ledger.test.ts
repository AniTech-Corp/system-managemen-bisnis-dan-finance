import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import * as XLSX from 'xlsx';
import { detectGenericLedger } from '../src/lib/ai-brain/generic-table-ledger';

// ---------------------------------------------------------------------------
// FASE B4 build 7 Sep 2026 -- generic-table-ledger.ts (deteksi ledger generik lewat
// heuristik kolom, JALUR KEDUA setelah parseLedgerWorkbook klasik gagal).
//
// Fixture: SALINAN 5 file dummy Mecca "PT Makan Mania Mantap" (BUKAN path asli
// 05-DOKUMEN, BUKAN nulis ke DB Neon -- murni baca buffer file lokal, deterministik,
// NOL koneksi jaringan/DB). Klasifikasi yang diuji di bawah SUDAH diverifikasi
// empiris (dijalankan langsung sebelum test ini ditulis) sebelum jadi assertion:
//  - daftar-transaksi-mentah.csv        -> recognized TRUE, confidence TINGGI (~0.80)
//  - laporan-keuangan-laba-rugi.xlsx    -> recognized FALSE (reject total, tidak ada
//                                           kolom tanggal per-baris -- cuma kolom
//                                           periode bulanan "April 2026" dst)
//  - data-inventori-stok.xlsx            -> recognized FALSE (snapshot stok, bukan
//                                           arus kas -- tidak ada kolom tanggal)
//  - data-karyawan-payroll.xlsx          -> recognized FALSE ("Tgl Bergabung" SENGAJA
//                                           tidak match sinonim TANGGAL -- exact-match
//                                           saja, lihat JSDoc generic-table-ledger.ts
//                                           poin 3 kenapa ini keputusan sadar bukan bug)
//  - laporan-penjualan-bulanan.xlsx      -> recognized TRUE via sheet "Data Harian",
//                                           confidence DIPOTONG TAJAM (~0.35) + warning
//                                           risiko dobel-hitung (kolom "(Rp)" lain di
//                                           sheet yang sama -- Makanan Utama/Minuman/dst)
// ---------------------------------------------------------------------------

const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'pt-makan-mania-mantap');

function loadFixture(fileName: string): Buffer {
  return readFileSync(path.join(FIXTURE_DIR, fileName));
}

describe('generic-table-ledger: detectGenericLedger() thd 5 fixture dummy PT Makan Mania Mantap', () => {
  test('daftar-transaksi-mentah.csv -> recognized true, confidence tinggi, drafts INCOME semua (tidak ada kolom jenis)', () => {
    const buf = loadFixture('daftar-transaksi-mentah.csv');
    const result = detectGenericLedger(buf, 'daftar-transaksi-mentah.csv');

    assert.equal(result.recognized, true);
    assert.ok(result.mapping, 'mapping harus terisi kalau recognized true');
    assert.equal(result.mapping!.sheetName, null, 'CSV tidak punya konsep sheet');
    assert.ok(result.confidence >= 0.7, `confidence CSV harus tinggi (>=0.7), dapat ${result.confidence}`);
    assert.ok(result.drafts.length > 0, 'harus ada draft transaksi yang bisa diimpor');
    assert.ok(
      result.drafts.every((d) => d.type === 'INCOME'),
      'tidak ada kolom jenis eksplisit di CSV ini -- semua baris HARUS didefaultkan INCOME',
    );
    assert.ok(
      result.warnings.some((w) => /PEMASUKAN/.test(w)),
      'wajib ada peringatan eksplisit soal default jenis transaksi (bukan diam-diam)',
    );
    assert.equal(result.sample.length, 5, 'sample harus persis 5 baris (atau kurang kalau data < 5, tapi fixture ini > 5)');
    // Kolom Kategori (menu) -- sinonim KATEGORI, BUKAN indikator income/expense (lihat
    // disambiguasi di JSDoc modul: KATEGORI -> peran category, JENIS/TIPE -> peran type).
    assert.ok(result.mapping!.category !== null, 'kolom "Kategori" harus terdeteksi sebagai peran category');
    assert.equal(result.mapping!.type, null, 'tidak ada kolom jenis eksplisit di CSV ini');
  });

  test('laporan-keuangan-laba-rugi.xlsx -> recognized false (reject total, kolom periode bulanan bukan tanggal transaksi)', () => {
    const buf = loadFixture('laporan-keuangan-laba-rugi.xlsx');
    const result = detectGenericLedger(buf, 'laporan-keuangan-laba-rugi.xlsx');

    assert.equal(result.recognized, false);
    assert.equal(result.mapping, null);
    assert.equal(result.drafts.length, 0);
    assert.ok(result.rejectReason, 'harus ada rejectReason jujur');
  });

  test('data-inventori-stok.xlsx -> recognized false (snapshot stok, bukan arus kas -- tidak ada kolom tanggal)', () => {
    const buf = loadFixture('data-inventori-stok.xlsx');
    const result = detectGenericLedger(buf, 'data-inventori-stok.xlsx');

    assert.equal(result.recognized, false);
    assert.equal(result.mapping, null);
    assert.equal(result.drafts.length, 0);
    assert.ok(result.rejectReason);
  });

  test('data-karyawan-payroll.xlsx -> recognized false ("Tgl Bergabung" sengaja tidak match TANGGAL, mencegah tanggal join dipakai jadi tanggal transaksi)', () => {
    const buf = loadFixture('data-karyawan-payroll.xlsx');
    const result = detectGenericLedger(buf, 'data-karyawan-payroll.xlsx');

    assert.equal(result.recognized, false);
    assert.equal(result.mapping, null);
    assert.equal(result.drafts.length, 0);
    assert.ok(result.rejectReason);
  });

  test('laporan-penjualan-bulanan.xlsx -> recognized true via sheet "Data Harian", confidence dipotong tajam + warning risiko dobel-hitung (BUKAN reject total, BUKAN auto-approve)', () => {
    const buf = loadFixture('laporan-penjualan-bulanan.xlsx');
    const result = detectGenericLedger(buf, 'laporan-penjualan-bulanan.xlsx');

    assert.equal(result.recognized, true);
    assert.ok(result.mapping, 'mapping harus terisi kalau recognized true');
    assert.equal(result.mapping!.sheetName, 'Data Harian', 'sheet dengan confidence tertinggi yang lolos syarat minimum');
    // "confidence dipotong tajam" -- signifikan lebih rendah dari CSV yang bersih (>=0.7),
    // tapi TIDAK nol (bukan reject total) -- rentang longgar supaya test tidak rapuh
    // terhadap penyetelan halus formula confidence di masa depan.
    assert.ok(result.confidence > 0 && result.confidence < 0.6, `confidence harus dipotong tajam (0 < x < 0.6), dapat ${result.confidence}`);
    assert.ok(
      result.warnings.some((w) => /AGREGAT|dobel-hitung/i.test(w)),
      'wajib ada peringatan eksplisit soal risiko data agregat/dobel-hitung',
    );
    assert.ok(result.drafts.length > 0, 'sheet "Data Harian" tetap menghasilkan draft (tidak di-reject total)');
    // Rekap per Cabang & Rekap per Kategori (sheet lain di file yang sama) harus
    // dilewati (dicatat di warnings), bukan ikut jadi kandidat.
    assert.ok(result.warnings.some((w) => /Rekap per Cabang/.test(w)));
    assert.ok(result.warnings.some((w) => /Rekap per Kategori/.test(w)));
  });

  test('reject: ekstensi tidak didukung (mis. xlsm/docx) dibalas jujur, bukan exception', () => {
    const result = detectGenericLedger(Buffer.from('apa saja'), 'dokumen.docx');
    assert.equal(result.recognized, false);
    assert.match(result.rejectReason || '', /tidak didukung/);
  });

  test('reject: buffer korup (bukan xlsx/csv valid) dibalas non-fatal, bukan melempar exception', () => {
    assert.doesNotThrow(() => {
      const result = detectGenericLedger(Buffer.from([0x00, 0x01, 0x02, 0x03]), 'rusak.xlsx');
      assert.equal(result.recognized, false);
      assert.ok(result.rejectReason);
    });
  });

  test('sintetis: tabel dengan kolom DEBET+KREDIT terpisah (tanpa kolom JUMLAH tunggal) tetap dikenali', () => {
    const wb = XLSX.utils.book_new();
    const rows: unknown[][] = [
      ['Tanggal', 'Keterangan', 'Debet', 'Kredit'],
      ['2026-08-01', 'Modal awal', 1000000, null],
      ['2026-08-02', 'Bayar listrik', null, 250000],
      ['2026-08-03', 'Penjualan', 500000, null],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Kas Harian');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const result = detectGenericLedger(buf, 'kas-manual.xlsx');
    assert.equal(result.recognized, true);
    assert.equal(result.mapping!.amount, null, 'pola debet/kredit terpisah -- amount tunggal harus null');
    assert.ok(result.mapping!.debit !== null && result.mapping!.credit !== null);
    assert.equal(result.drafts.length, 3);
    const income = result.drafts.filter((d) => d.type === 'INCOME');
    const expense = result.drafts.filter((d) => d.type === 'EXPENSE');
    assert.equal(income.length, 2, 'Modal awal + Penjualan dari kolom Debet');
    assert.equal(expense.length, 1, 'Bayar listrik dari kolom Kredit');
  });

  test('sintetis: kolom jenis eksplisit (Pemasukan/Pengeluaran) dipakai, bukan default -- tidak ada warning "didefaultkan"', () => {
    const wb = XLSX.utils.book_new();
    const rows: unknown[][] = [
      ['Tanggal', 'Keterangan', 'Jumlah', 'Jenis'],
      ['2026-08-01', 'Modal awal', 1000000, 'Pemasukan'],
      ['2026-08-02', 'Bayar listrik', 250000, 'Pengeluaran'],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const result = detectGenericLedger(buf, 'kas-eksplisit.xlsx');
    assert.equal(result.recognized, true);
    assert.ok(result.mapping!.type !== null);
    assert.ok(!result.warnings.some((w) => /didefaultkan sebagai PEMASUKAN/.test(w)));
    const income = result.drafts.filter((d) => d.type === 'INCOME');
    const expense = result.drafts.filter((d) => d.type === 'EXPENSE');
    assert.equal(income.length, 1);
    assert.equal(expense.length, 1);
  });

  test('sintetis: tanggal tidak valid pada mayoritas baris sampel -- confidence dipotong + warning eksplisit dgn angka', () => {
    const wb = XLSX.utils.book_new();
    const rows: unknown[][] = [
      ['Tanggal', 'Keterangan', 'Jumlah'],
      ['bukan tanggal', 'Baris 1', 100000],
      ['juga bukan tanggal', 'Baris 2', 200000],
      ['masih bukan', 'Baris 3', 300000],
      ['2026-08-04', 'Baris 4 (satu-satunya valid)', 400000],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

    const result = detectGenericLedger(buf, 'tanggal-rusak.xlsx');
    assert.equal(result.recognized, true, 'kolom masih terdeteksi by name -- validasi ISI cuma memotong confidence, bukan reject total');
    assert.ok(result.confidence < 0.3, `confidence harus sangat rendah (<0.3), dapat ${result.confidence}`);
    assert.ok(result.warnings.some((w) => /1 dari 4/.test(w)), 'peringatan harus menyebut angka konkret (1 dari 4 valid)');
    assert.equal(result.drafts.length, 1, 'hanya baris dengan tanggal valid yang jadi draft -- 3 baris lain TIDAK ditebak');
  });
});
