import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as XLSX from 'xlsx';
import {
  buildFinanceLedgerWorkbook,
  financeExportFileName,
  type FinanceExportInput,
} from '../src/lib/finance-export';

// Regresi untuk bug tombol Ekspor Excel di FinanceModuleView.tsx: sebelumnya berkas yang
// diunduh berekstensi .xls + mime application/vnd.ms-excel TAPI isinya HTML mentah (bukan
// format binary/OOXML Excel beneran). Excel masih mau membukanya (dengan peringatan),
// tapi Google Sheets dan tool lain menolaknya -- masalah yang baru ketahuan di depan
// calon klien. Test ini membuktikan output baru genuinely xlsx (ZIP/OOXML), bukan HTML
// yang menyamar, DAN membuktikan angka yang keluar identik dengan angka yang dimasukkan
// (tidak ada langkah AI/LLM di tengah yang bisa mengubah/mengarang nilai).

function sampleInput(overrides: Partial<FinanceExportInput> = {}): FinanceExportInput {
  return {
    workspaceName: 'Warung Sinergi Jaya',
    generatedAt: new Date('2026-09-07T10:00:00Z'),
    summary: {
      cashBalance: 15250000,
      totalIncome: 42000000,
      totalExpense: 26750000,
      netCashflow: 15250000,
      grossMargin: 0,
      runwayMonths: 0,
    },
    transactions: [
      {
        createdAt: '01/09/2026',
        type: 'INCOME',
        category: 'Penjualan Produk / Jasa',
        description: 'Penjualan batch September',
        amount: 12500000,
      },
      {
        createdAt: '03/09/2026',
        type: 'EXPENSE',
        category: 'Iklan & Marketing',
        description: 'Ads Instagram minggu 1',
        amount: 1800000,
      },
    ],
    invoices: [
      {
        invoiceNumber: 'INV-2026-0091',
        clientName: 'PT Contoh Mitra Sejahtera',
        dueDate: '15/09/2026',
        status: 'UNPAID',
        amount: 8500000,
      },
      {
        invoiceNumber: 'INV-2026-0084',
        clientName: 'CV Berkah Selalu',
        dueDate: '20/08/2026',
        status: 'OVERDUE',
        amount: 3200000,
      },
    ],
    ...overrides,
  };
}

describe('finance-export: buildFinanceLedgerWorkbook menghasilkan xlsx ASLI', () => {
  test('output diawali magic bytes ZIP (PK), bukan markup HTML "<html"', () => {
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(sampleInput()));

    // Semua format Office modern (.xlsx/.docx/.pptx) adalah container ZIP -- 2 byte
    // pertamanya SELALU 0x50 0x4B ("PK"). Kalau ini gagal, berarti kita balik lagi
    // menghasilkan teks/HTML biasa yang cuma diberi nama .xlsx, persis bug lama.
    assert.equal(bytes[0], 0x50, 'byte pertama bukan 0x50 (P) -- bukan ZIP/OOXML');
    assert.equal(bytes[1], 0x4b, 'byte kedua bukan 0x4B (K) -- bukan ZIP/OOXML');

    const asText = Buffer.from(bytes.slice(0, 200)).toString('utf8').toLowerCase();
    assert.ok(!asText.includes('<html'), 'output masih mengandung tag <html -- berarti masih HTML menyamar');
    assert.ok(!asText.includes('<!doctype'), 'output masih mengandung doctype HTML');
  });

  test('bisa dibaca ulang oleh parser xlsx standar (bukti format valid, bukan cuma nama file)', () => {
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(sampleInput()));
    // Kalau file ini bukan xlsx valid, XLSX.read akan throw -- itulah sinyal test gagal
    // yang paling jujur (bukan asumsi berdasarkan ekstensi/mime saja).
    const wb = XLSX.read(bytes, { type: 'array' });
    assert.deepEqual(wb.SheetNames, ['Ringkasan', 'Transaksi Kas', 'Invoice & Piutang']);
  });

  test('angka di sheet Ringkasan identik dengan input, tidak berubah/dikarang', () => {
    const input = sampleInput();
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(input));
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets['Ringkasan'];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });

    const findRow = (label: string) => rows.find((r) => r[0] === label);

    assert.equal(findRow('Saldo Kas Tersedia')?.[1], input.summary.cashBalance);
    assert.equal(findRow('Total Pemasukan')?.[1], input.summary.totalIncome);
    assert.equal(findRow('Total Pengeluaran')?.[1], input.summary.totalExpense);
    assert.equal(findRow('Arus Kas Bersih')?.[1], input.summary.netCashflow);
  });

  test('runway ditulis "belum bisa dihitung" saat runwayAvailable=false, bukan angka 0 palsu', () => {
    // Selaras dengan wiring runway asli di FinanceModuleView.tsx (loadRealData): kalau
    // net-burn 30 hari tidak positif, runwayMonths cuma placeholder 0 -- ekspor WAJIB jujur,
    // bukan menampilkan "0 bulan" seolah itu hasil perhitungan nyata.
    const input = sampleInput({
      summary: {
        cashBalance: 5000000,
        totalIncome: 0,
        totalExpense: 0,
        netCashflow: 0,
        grossMargin: 0,
        runwayMonths: 0,
        runwayAvailable: false,
      },
    });
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(input));
    const wb = XLSX.read(bytes, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Ringkasan'], { header: 1 });
    const runwayRow = rows.find((r) => r[0] === 'Ketahanan Kas / Runway (bulan)');
    assert.equal(typeof runwayRow?.[1], 'string');
    assert.match(String(runwayRow?.[1]), /belum bisa dihitung/i);
  });

  test('runway ditulis sebagai angka nyata saat runwayAvailable=true', () => {
    const input = sampleInput({
      summary: {
        cashBalance: 5000000,
        totalIncome: 10000000,
        totalExpense: 4000000,
        netCashflow: 6000000,
        grossMargin: 60,
        runwayMonths: 8.3,
        runwayAvailable: true,
      },
    });
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(input));
    const wb = XLSX.read(bytes, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Ringkasan'], { header: 1 });
    const runwayRow = rows.find((r) => r[0] === 'Ketahanan Kas / Runway (bulan)');
    assert.equal(runwayRow?.[1], 8.3);
  });

  test('runwayAvailable tidak dikirim (pemanggil lama) -- default tetap tampilkan angka, tidak pecah', () => {
    const input = sampleInput();
    delete (input.summary as any).runwayAvailable;
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(input));
    const wb = XLSX.read(bytes, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets['Ringkasan'], { header: 1 });
    const runwayRow = rows.find((r) => r[0] === 'Ketahanan Kas / Runway (bulan)');
    assert.equal(runwayRow?.[1], input.summary.runwayMonths);
  });

  test('sheet Ringkasan TIDAK mengandung narasi/klaim yang dikarang dari versi lama', () => {
    // Regresi eksplisit untuk kalimat pujian palsu yang dulu ditempel di excelContent
    // versi HTML (tidak berasal dari perhitungan apapun, termasuk klaim "risiko nol"
    // yang berbahaya kalau ditunjukkan ke calon klien apa adanya).
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(sampleInput()));
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets['Ringkasan'];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
    const flatText = rows.flat().join(' | ').toLowerCase();

    assert.ok(!flatText.includes('28.5%'), 'masih ada klaim pertumbuhan +28.5% MoM yang dikarang');
    assert.ok(!flatText.includes('prima'), 'masih ada kata "prima" (klaim kualitatif tanpa dasar)');
    assert.ok(!flatText.includes('risiko nol'), 'masih ada klaim "risiko nol" yang berbahaya/tidak berdasar');
    assert.ok(!flatText.includes('efisien'), 'masih ada klaim "efisien" tanpa perhitungan pendukung');
  });

  test('buku besar transaksi memuat semua baris transaksi apa adanya (tidak berkurang)', () => {
    const input = sampleInput();
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(input));
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets['Transaksi Kas'];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });

    // header + N transaksi + 1 baris total
    assert.equal(rows.length, 1 + input.transactions.length + 1);

    const incomeRow = rows.find((r) => r[3] === 'Penjualan batch September');
    assert.equal(incomeRow?.[4], 12500000);
    assert.equal(incomeRow?.[5], '');

    const expenseRow = rows.find((r) => r[3] === 'Ads Instagram minggu 1');
    assert.equal(expenseRow?.[4], '');
    assert.equal(expenseRow?.[5], 1800000);
  });

  test('daftar invoice memuat semua invoice apa adanya (tidak berkurang)', () => {
    const input = sampleInput();
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(input));
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets['Invoice & Piutang'];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });

    assert.equal(rows.length, 1 + input.invoices.length);
    const overdue = rows.find((r) => r[0] === 'INV-2026-0084');
    assert.equal(overdue?.[3], 'OVERDUE');
    assert.equal(overdue?.[4], 3200000);
  });

  test('deterministik: input sama menghasilkan struktur data sama persis', () => {
    const input = sampleInput();
    const bytesA = new Uint8Array(buildFinanceLedgerWorkbook(input));
    const bytesB = new Uint8Array(buildFinanceLedgerWorkbook(input));
    const wbA = XLSX.read(bytesA, { type: 'array' });
    const wbB = XLSX.read(bytesB, { type: 'array' });
    assert.deepEqual(
      XLSX.utils.sheet_to_json(wbA.Sheets['Transaksi Kas'], { header: 1 }),
      XLSX.utils.sheet_to_json(wbB.Sheets['Transaksi Kas'], { header: 1 })
    );
  });

  test('workspace kosong/tidak diisi tidak membuat fungsi gagal (fallback nama wajar)', () => {
    const bytes = new Uint8Array(buildFinanceLedgerWorkbook(sampleInput({ workspaceName: '' })));
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets['Ringkasan'];
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1 });
    assert.ok(String(rows[0]?.[0] || '').includes('Perusahaan'));
  });
});

describe('finance-export: financeExportFileName', () => {
  test('berekstensi .xlsx (bukan .xls lagi) dan memuat tanggal ISO', () => {
    const name = financeExportFileName('Toko Sinergi', new Date('2026-09-07T00:00:00Z'));
    assert.match(name, /\.xlsx$/);
    assert.match(name, /2026-09-07/);
    assert.ok(!name.includes(' '));
  });

  test('fallback nama saat workspaceName undefined', () => {
    const name = financeExportFileName(undefined, new Date('2026-09-07T00:00:00Z'));
    assert.match(name, /^Laporan_Keuangan_Perusahaan_2026-09-07\.xlsx$/);
  });
});
