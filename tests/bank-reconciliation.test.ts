import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  parseBankMutations,
  matchBankMutations,
  reconcileBankStatement,
  type BankMutationInput,
  type CashTransactionInput,
} from '../src/lib/ai-brain/bank-reconciliation';

// Data SINTETIS murni (bukan file/data klien nyata) -- tidak ada panggilan LLM di
// manapun di file ini, pencocokan 100% deterministik lewat kode di bank-reconciliation.ts.

function cashTx(partial: Partial<CashTransactionInput> & { id: string }): CashTransactionInput {
  return {
    transactionDate: '2026-09-01',
    type: 'INCOME',
    amount: 0,
    description: '',
    category: 'lain-lain',
    ...partial,
  };
}

describe('parseBankMutations', () => {
  test('memisahkan mutasi valid dari yang tanggalnya gagal diparse', () => {
    const rows: BankMutationInput[] = [
      { rowNo: 1, dateRaw: '2026-09-01', description: 'Transfer masuk', amount: 500000 },
      { rowNo: 2, dateRaw: '31/02/2026', description: 'Tanggal mustahil', amount: 100000 },
    ];
    const { valid, invalid } = parseBankMutations(rows);
    assert.equal(valid.length, 1);
    assert.equal(valid[0].dateIso, '2026-09-01');
    assert.equal(valid[0].direction, 'MASUK');
    assert.equal(valid[0].amount, 500000);
    assert.equal(invalid.length, 1);
    assert.equal(invalid[0].rowNo, 2);
  });

  test('menolak nominal nol/NaN sebagai baris invalid, bukan mutasi nyata', () => {
    const rows: BankMutationInput[] = [
      { rowNo: 1, dateRaw: '2026-09-01', description: 'Baris kosong/separator', amount: 0 },
      { rowNo: 2, dateRaw: '2026-09-01', description: 'Nominal bukan angka', amount: NaN },
    ];
    const { valid, invalid } = parseBankMutations(rows);
    assert.equal(valid.length, 0);
    assert.equal(invalid.length, 2);
  });

  test('amount negatif diklasifikasi KELUAR, nilai amount hasil selalu positif', () => {
    const rows: BankMutationInput[] = [{ rowNo: 1, dateRaw: '2026-09-05', description: 'Bayar sewa', amount: -150000 }];
    const { valid } = parseBankMutations(rows);
    assert.equal(valid[0].direction, 'KELUAR');
    assert.equal(valid[0].amount, 150000);
  });
});

describe('matchBankMutations', () => {
  test('cocok: tanggal + nominal + arah sama persis', () => {
    const bank = parseBankMutations([{ rowNo: 1, dateRaw: '2026-09-01', description: 'Transfer masuk', amount: 500000 }]).valid;
    const cash = [cashTx({ id: 'tx-1', transactionDate: '2026-09-01', type: 'INCOME', amount: 500000, description: 'Penjualan' })];
    const { matched, unmatchedBank, unmatchedCash } = matchBankMutations(bank, cash);
    assert.equal(matched.length, 1);
    assert.equal(matched[0].cashTransaction.id, 'tx-1');
    assert.equal(matched[0].dateDiffDays, 0);
    assert.equal(matched[0].amountDiff, 0);
    assert.equal(unmatchedBank.length, 0);
    assert.equal(unmatchedCash.length, 0);
  });

  test('tidak cocok: arah beda (INCOME vs KELUAR) walau tanggal+nominal sama tidak boleh matched', () => {
    const bank = parseBankMutations([{ rowNo: 1, dateRaw: '2026-09-01', description: 'Bayar sewa', amount: -200000 }]).valid;
    const cash = [cashTx({ id: 'tx-1', transactionDate: '2026-09-01', type: 'INCOME', amount: 200000 })];
    const { matched, unmatchedBank, unmatchedCash } = matchBankMutations(bank, cash);
    assert.equal(matched.length, 0);
    assert.equal(unmatchedBank.length, 1);
    assert.equal(unmatchedCash.length, 1);
  });

  test('ADA_DI_BANK_TIDAK_DI_CATATAN: mutasi bank tanpa pasangan CashTransaction', () => {
    const bank = parseBankMutations([{ rowNo: 1, dateRaw: '2026-09-10', description: 'Transfer misterius', amount: 750000 }]).valid;
    const { matched, unmatchedBank, unmatchedCash } = matchBankMutations(bank, []);
    assert.equal(matched.length, 0);
    assert.equal(unmatchedBank.length, 1);
    assert.equal(unmatchedBank[0].bankMutation.description, 'Transfer misterius');
    assert.equal(unmatchedCash.length, 0);
  });

  test('ADA_DI_CATATAN_TIDAK_DI_BANK: CashTransaction tanpa pasangan mutasi bank', () => {
    const cash = [cashTx({ id: 'tx-1', transactionDate: '2026-09-10', type: 'EXPENSE', amount: 300000, description: 'Kemungkinan duplikat' })];
    const { matched, unmatchedBank, unmatchedCash } = matchBankMutations([], cash);
    assert.equal(matched.length, 0);
    assert.equal(unmatchedBank.length, 0);
    assert.equal(unmatchedCash.length, 1);
    assert.equal(unmatchedCash[0].cashTransaction.id, 'tx-1');
  });

  test('toleransi tanggal: beda 1 hari cocok kalau dateToleranceDays >= 1, gagal kalau 0', () => {
    const bank = parseBankMutations([{ rowNo: 1, dateRaw: '2026-09-02', description: 'Posting H+1', amount: 400000 }]).valid;
    const cash = [cashTx({ id: 'tx-1', transactionDate: '2026-09-01', type: 'INCOME', amount: 400000 })];

    const strict = matchBankMutations(bank, cash, { dateToleranceDays: 0 });
    assert.equal(strict.matched.length, 0);

    const lenient = matchBankMutations(bank, cash, { dateToleranceDays: 1 });
    assert.equal(lenient.matched.length, 1);
    assert.equal(lenient.matched[0].dateDiffDays, 1);
  });

  test('toleransi nominal: selisih pembulatan kecil cocok kalau amountTolerance mencukupi', () => {
    const bank = parseBankMutations([{ rowNo: 1, dateRaw: '2026-09-01', description: 'Selisih pembulatan', amount: 149999 }]).valid;
    const cash = [cashTx({ id: 'tx-1', transactionDate: '2026-09-01', type: 'INCOME', amount: 150000 })];

    const strict = matchBankMutations(bank, cash, { amountTolerance: 0 });
    assert.equal(strict.matched.length, 0);

    const lenient = matchBankMutations(bank, cash, { amountTolerance: 5 });
    assert.equal(lenient.matched.length, 1);
    assert.equal(lenient.matched[0].amountDiff, 1);
  });

  test('greedy matching tidak memakai CashTransaction yang sama dua kali (dua mutasi bank identik, satu cash tx)', () => {
    const bank = parseBankMutations([
      { rowNo: 1, dateRaw: '2026-09-01', description: 'Transfer A', amount: 100000 },
      { rowNo: 2, dateRaw: '2026-09-01', description: 'Transfer B (nominal sama)', amount: 100000 },
    ]).valid;
    const cash = [cashTx({ id: 'tx-1', transactionDate: '2026-09-01', type: 'INCOME', amount: 100000 })];

    const { matched, unmatchedBank } = matchBankMutations(bank, cash);
    assert.equal(matched.length, 1);
    assert.equal(unmatchedBank.length, 1);
  });

  test('kandidat terbaik dipilih berdasar selisih nominal terkecil, bukan urutan array', () => {
    const bank = parseBankMutations([{ rowNo: 1, dateRaw: '2026-09-01', description: 'Transfer', amount: 100000 }]).valid;
    const cash = [
      cashTx({ id: 'tx-far', transactionDate: '2026-09-01', type: 'INCOME', amount: 100010 }),
      cashTx({ id: 'tx-close', transactionDate: '2026-09-01', type: 'INCOME', amount: 100002 }),
    ];
    const { matched } = matchBankMutations(bank, cash, { amountTolerance: 20 });
    assert.equal(matched.length, 1);
    assert.equal(matched[0].cashTransaction.id, 'tx-close');
  });
});

describe('reconcileBankStatement (entry point gabungan)', () => {
  test('skenario campuran: cocok + kelewat catat + duplikat/salah catat + baris tanggal invalid', () => {
    const rawMutations: BankMutationInput[] = [
      { rowNo: 1, dateRaw: '2026-09-01', description: 'Penjualan tunai transfer', amount: 500000 },
      { rowNo: 2, dateRaw: '2026-09-03', description: 'Bayar sewa kantor', amount: -300000 },
      { rowNo: 3, dateRaw: '2026-09-05', description: 'Transfer masuk tak dicatat', amount: 250000 },
      { rowNo: 4, dateRaw: '31/02/2026', description: 'Baris rusak', amount: 999 },
    ];
    const cashTransactions: CashTransactionInput[] = [
      cashTx({ id: 'tx-1', transactionDate: '2026-09-01', type: 'INCOME', amount: 500000, description: 'Penjualan' }),
      cashTx({ id: 'tx-2', transactionDate: '2026-09-03', type: 'EXPENSE', amount: 300000, description: 'Sewa kantor' }),
      cashTx({ id: 'tx-3', transactionDate: '2026-09-06', type: 'EXPENSE', amount: 120000, description: 'Dicatat tapi ga ada di bank' }),
    ];

    const result = reconcileBankStatement(rawMutations, cashTransactions);

    assert.equal(result.cocok.length, 2);
    assert.deepEqual(
      result.cocok.map((m) => m.cashTransaction.id).sort(),
      ['tx-1', 'tx-2'],
    );

    assert.equal(result.adaDiBankTidakDiCatatan.length, 1);
    assert.equal(result.adaDiBankTidakDiCatatan[0].bankMutation.description, 'Transfer masuk tak dicatat');

    assert.equal(result.adaDiCatatanTidakDiBank.length, 1);
    assert.equal(result.adaDiCatatanTidakDiBank[0].cashTransaction.id, 'tx-3');

    assert.equal(result.invalidBankRows.length, 1);
    assert.equal(result.invalidBankRows[0].rowNo, 4);

    // Summary WAJIB konsisten dengan panjang array aktual -- bukan angka independen.
    assert.equal(result.summary.totalBankMutations, 4);
    assert.equal(result.summary.totalCashTransactions, 3);
    assert.equal(result.summary.matchedCount, result.cocok.length);
    assert.equal(result.summary.unmatchedBankCount, result.adaDiBankTidakDiCatatan.length);
    assert.equal(result.summary.unmatchedCashCount, result.adaDiCatatanTidakDiBank.length);
    assert.equal(result.summary.invalidBankRowCount, result.invalidBankRows.length);
  });

  test('workspace kosong (nol mutasi valid, nol cash transaction) menghasilkan semua array kosong tanpa error', () => {
    const result = reconcileBankStatement([], []);
    assert.equal(result.cocok.length, 0);
    assert.equal(result.adaDiBankTidakDiCatatan.length, 0);
    assert.equal(result.adaDiCatatanTidakDiBank.length, 0);
    assert.equal(result.invalidBankRows.length, 0);
  });
});
