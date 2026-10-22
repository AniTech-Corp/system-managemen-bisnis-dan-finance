import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TaxProfile, TaxType } from '@prisma/client';
import { computePeriodAmount, type YearFigures, type TaxSettingView } from '../src/lib/tax/service';

/** Tahun dengan 12 bulan; indeks 0 tidak dipakai agar cocok dengan kode produksi. */
function monthArray(): number[] {
  return new Array(13).fill(0);
}

function emptyFigures(): YearFigures {
  return {
    year: 2026,
    incomeByMonth: monthArray(),
    incomeCountByMonth: monthArray(),
    ppnOutputByMonth: monthArray(),
    ppnOutputDppByMonth: monthArray(),
    ppnOutputCountByMonth: monthArray(),
    ppnInputByMonth: monthArray(),
    ppnInputDppByMonth: monthArray(),
    ppnInputCountByMonth: monthArray(),
    payrollGrossByMonth: monthArray(),
    pph21ByMonth: monthArray(),
    bpjsByMonth: monthArray(),
    payrollCountByMonth: monthArray(),
    withholdingByType: {},
    withholdingDppByType: {},
    withholdingCountByType: {},
    ledgerPpnOutputByMonth: monthArray(),
    ledgerPpnInputByMonth: monthArray(),
  };
}

function setting(overrides: Partial<TaxSettingView> = {}): TaxSettingView {
  return {
    taxProfile: TaxProfile.UMKM_NON_PKP,
    entityType: 'BADAN_USAHA',
    enablePpn: false,
    ppnRate: 11,
    pphFinalRate: 0.5,
    umkmThreshold: 500_000_000,
    pph23Rate: 2,
    pph42Rate: 10,
    pph21Method: 'MANUAL',
    npwp: null,
    nik: null,
    kppName: null,
    pkpEffectiveDate: null,
    taxReminderDays: [7, 3, 1],
    taxReminderChannel: 'IN_APP',
    ...overrides,
  };
}

describe('pajak: nominal masa pajak dari dokumen sumber', () => {
  test('PPN memakai keluaran dikurangi masukan dan membandingkan dengan jurnal', () => {
    const figures = emptyFigures();
    figures.ppnOutputByMonth[10] = 1_110_000;
    figures.ppnOutputDppByMonth[10] = 10_000_000;
    figures.ppnOutputCountByMonth[10] = 2;
    figures.ppnInputByMonth[10] = 555_000;
    figures.ppnInputDppByMonth[10] = 5_000_000;
    figures.ppnInputCountByMonth[10] = 1;
    figures.ledgerPpnOutputByMonth[10] = 1_110_000;
    figures.ledgerPpnInputByMonth[10] = 500_000;

    const amount = computePeriodAmount(TaxType.PPN, 2026, 10, figures, setting({ enablePpn: true }));

    assert.equal(amount.amount, 555_000);
    assert.equal(amount.dpp, 10_000_000);
    assert.equal(amount.outputTax, 1_110_000);
    assert.equal(amount.inputTax, 555_000);
    assert.equal(amount.overpayment, 0);
    assert.equal(amount.transactionCount, 3);
    assert.equal(amount.ledgerAmount, 610_000);
    // PPN dokumen 555.000 vs jurnal 610.000 -> selisih -55.000.
    assert.equal(amount.ledgerDifference, -55_000);
    assert.match(amount.note, /Kurang bayar/i);
  });

  test('PPN lebih bayar dilaporkan sebagai overpayment, bukan angka negatif', () => {
    const figures = emptyFigures();
    figures.ppnOutputByMonth[3] = 200_000;
    figures.ppnInputByMonth[3] = 350_000;

    const amount = computePeriodAmount(TaxType.PPN, 2026, 3, figures, setting());
    assert.equal(amount.amount, 0);
    assert.equal(amount.overpayment, 150_000);
    assert.match(amount.note, /Lebih bayar/i);
  });

  test('PPh Final orang pribadi memakai ambang kumulatif tahunan', () => {
    const figures = emptyFigures();
    for (let month = 1; month <= 9; month += 1) {
      figures.incomeByMonth[month] = 50_000_000;
    }
    figures.incomeByMonth[10] = 100_000_000;
    figures.incomeCountByMonth[10] = 3;

    const amount = computePeriodAmount(
      TaxType.PPH_FINAL_UMKM,
      2026,
      10,
      figures,
      setting({ entityType: 'ORANG_PRIBADI' })
    );

    // 450 juta + 100 juta = 550 juta; 50 juta di atas ambang x 0,5%.
    assert.equal(amount.dpp, 100_000_000);
    assert.equal(amount.amount, 250_000);
    assert.equal(amount.transactionCount, 3);
    assert.match(amount.note, /ambang/i);
  });

  test('PPh Final badan usaha tidak memakai ambang', () => {
    const figures = emptyFigures();
    figures.incomeByMonth[10] = 100_000_000;

    const amount = computePeriodAmount(
      TaxType.PPH_FINAL_UMKM,
      2026,
      10,
      figures,
      setting({ entityType: 'BADAN_USAHA' })
    );

    assert.equal(amount.amount, 500_000);
    assert.match(amount.note, /Badan usaha/i);
  });

  test('PPh 21 dan BPJS dibaca dari slip gaji', () => {
    const figures = emptyFigures();
    figures.pph21ByMonth[10] = 1_500_000;
    figures.bpjsByMonth[10] = 2_400_000;
    figures.payrollGrossByMonth[10] = 20_000_000;
    figures.payrollCountByMonth[10] = 4;

    const pph21 = computePeriodAmount(TaxType.PPH_21, 2026, 10, figures, setting());
    assert.equal(pph21.amount, 1_500_000);
    assert.equal(pph21.dpp, 20_000_000);
    assert.equal(pph21.transactionCount, 4);

    const bpjs = computePeriodAmount(TaxType.BPJS, 2026, 10, figures, setting());
    assert.equal(bpjs.amount, 2_400_000);
    assert.equal(bpjs.dpp, 20_000_000);
  });

  test('PPh 23 dibaca dari daftar bukti potong', () => {
    const figures = emptyFigures();
    figures.withholdingByType = { [TaxType.PPH_23]: monthArray() };
    figures.withholdingDppByType = { [TaxType.PPH_23]: monthArray() };
    figures.withholdingCountByType = { [TaxType.PPH_23]: monthArray() };
    figures.withholdingByType[TaxType.PPH_23]![10] = 300_000;
    figures.withholdingDppByType[TaxType.PPH_23]![10] = 15_000_000;
    figures.withholdingCountByType[TaxType.PPH_23]![10] = 2;

    const amount = computePeriodAmount(TaxType.PPH_23, 2026, 10, figures, setting());
    assert.equal(amount.amount, 300_000);
    assert.equal(amount.dpp, 15_000_000);
    assert.equal(amount.transactionCount, 2);
    assert.match(amount.note, /bukti potong/i);
  });

  test('jenis tanpa data menghasilkan nominal nol dengan catatan jelas', () => {
    const amount = computePeriodAmount(TaxType.PPH_4_2, 2026, 10, emptyFigures(), setting());
    assert.equal(amount.amount, 0);
    assert.equal(amount.dpp, 0);
    assert.match(amount.note, /Belum ada bukti potong/i);
  });
});
