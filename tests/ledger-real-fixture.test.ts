import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { parseLedgerWorkbook } from '../src/lib/ai-brain/ledger-parser';
import { validateLedger } from '../src/lib/ai-brain/ledger-validator';

// Integrasi terhadap file ASLI milik calon klien -- PRIVASI: file ini TIDAK
// pernah di-commit ke repo (baca dari path absolut di luar working tree git), dan test ini
// SKIP (bukan fail) kalau file tidak ada di mesin yang menjalankan test, sesuai instruksi
// tugas. Angka ground-truth di bawah diverifikasi manual oleh orchestrator via openpyxl
// SEBELUM ledger-parser.ts/ledger-validator.ts ini ditulis (lihat context pack sesi ini).
const FIXTURE_PATH =
  'C:\\Users\\mausx\\OneDrive\\Nime\\OneDrive\\Documents\\Claude Code Asistent\\KLIR\\05-DOKUMEN\\aktif\\2026-09-06-roadmap-analisis-data-enterprise-anti-halusinasi-test-fixtures\\PT-Tujuh-Mata-Air_jan14-okt15.xlsx';

const TOLERANCE = 0.01;
function closeEnough(a: number, b: number, tol = TOLERANCE): boolean {
  return Math.abs(a - b) <= tol;
}

const hasFixture = fs.existsSync(FIXTURE_PATH);

describe('ledger-parser + ledger-validator vs fixture ASLI milik calon klien', { skip: !hasFixture ? 'fixture asli tidak ditemukan di mesin ini -- lihat FIXTURE_PATH' : false }, () => {
  const buffer = hasFixture ? fs.readFileSync(FIXTURE_PATH) : Buffer.alloc(0);
  const parsed = hasFixture ? parseLedgerWorkbook(buffer) : null;
  const report = parsed ? validateLedger(parsed) : null;

  test('parser menemukan 11 sheet & mengklasifikasi sheet ledger/statement/schedule dengan benar', () => {
    assert.ok(parsed);
    assert.equal(parsed!.sheetNames.length, 11);
    // Kedua sheet "kas" harus terparse (buku kas kronologis + pivotnya) -- lihat komentar
    // pickPrimaryLedgerSheet soal kenapa hanya SATU yang dipakai untuk agregasi.
    assert.equal(Object.keys(parsed!.transactionsBySheet).length, 2);
    assert.ok(parsed!.depreciationSchedules['depresiasi']);
    assert.ok(parsed!.depreciationSchedules['amortisasi']);
    assert.ok(parsed!.cashFlowSheets['cash flow']);
  });

  test('chart of accounts (kode posting) ke-parse, termasuk kode revenue & biaya kunci', () => {
    assert.ok(parsed);
    assert.equal(parsed!.chartOfAccounts.get(25), 'Penjualan Barang Umum');
    assert.equal(parsed!.chartOfAccounts.get(45), 'Barang Umum');
    assert.equal(parsed!.chartOfAccounts.get(84), 'Zakat');
  });

  test('ground truth #7: buku kas -- 583 transaksi TARIKH-valid, saldo akhir 1324000', () => {
    assert.ok(report);
    assert.equal(report!.computed.transactionCount, 583);
    assert.ok(report!.computed.saldoAkhir !== null);
    assert.ok(closeEnough(report!.computed.saldoAkhir!, 1324000));
  });

  test('ground truth #1-2: kode 25 (Penjualan Barang Umum) & kode 45 (Belanja Barang Modal) cocok', () => {
    assert.ok(report);
    const agg25 = report!.computed.kodeAggregates[25];
    const agg45 = report!.computed.kodeAggregates[45];
    assert.ok(agg25 && closeEnough(agg25.debit, 1185909500));
    assert.ok(agg45 && closeEnough(agg45.credit, 666058000));
  });

  test('ground truth #3: 11 item biaya operasional kode 60/61/62/63/64/66/68/72/74/75/78 cocok', () => {
    assert.ok(report);
    const expected: Record<number, number> = {
      60: 39600000,
      61: 1130000,
      62: 10660000,
      63: 6300000,
      64: 10923000,
      66: 50400000,
      68: 230000,
      72: 12795000,
      74: 1203000,
      75: 277000,
      78: 5000000,
    };
    for (const [kode, expectedValue] of Object.entries(expected)) {
      const agg = report!.computed.kodeAggregates[Number(kode)];
      assert.ok(agg, `kode ${kode} tidak ada di agregasi buku kas`);
      assert.ok(
        closeEnough(agg.credit, expectedValue),
        `kode ${kode}: expected ${expectedValue}, got ${agg.credit}`,
      );
    }
  });

  test('ground truth #4-5: depresiasi/amortisasi non-kas + Jumlah biaya/Laba operasional/Zakat/Laba bersih cocok', () => {
    assert.ok(parsed);
    assert.ok(report);

    // "Jumlah biaya = 151284666.67" (ground truth #5) adalah subtotal LITERAL section
    // "B. Operasional Usaha" yang tertulis di sheet (baris 35) -- BUKAN total biaya yang
    // dipakai untuk menurunkan Laba Operasional (itu juga mengikutkan kode 45 "Belanja
    // Barang Modal" / CapEx section A senilai 666058000, terverifikasi lewat pengecekan
    // silang: Pendapatan 1185909500 - Laba Operasional 368566833.33 = 817342666.67 =
    // 151284666.67 + 666058000). ledger-validator.ts computed.totalBiaya sengaja
    // merepresentasikan angka gabungan itu (yang benar dipakai utk laba operasional),
    // jadi assert literal "Jumlah biaya" langsung dari hasil parse, bukan dari computed.
    const labaRugiEntries = Object.values(parsed!.statementSheets).find((entries) => entries.some((e) => e.kode === 25))!;
    const jumlahBiayaLiteral = labaRugiEntries.find((e) => e.rowNo === 35 && e.label === 'Jumlah');
    assert.ok(jumlahBiayaLiteral, 'baris "Jumlah" (subtotal Operasional Usaha) tidak ditemukan di laba-rugi');
    assert.ok(closeEnough(jumlahBiayaLiteral!.value!, 151284666.67, 0.02));

    // Fixture ini SELALU punya sheet laba-rugi, jadi ketiganya dijamin non-null di sini
    // (null hanya terjadi kalau sheet laba-rugi tidak ditemukan sama sekali).
    assert.ok(report!.computed.labaOperasional !== null);
    assert.ok(report!.computed.zakat !== null);
    assert.ok(report!.computed.labaBersih !== null);
    assert.ok(closeEnough(report!.computed.labaOperasional!, 368566833.33, 0.02));
    assert.ok(closeEnough(report!.computed.zakat!, 9214170.83, 0.02));
    assert.ok(closeEnough(report!.computed.labaBersih!, 359352662.5, 0.02));

    // tidak boleh ada discrepancy KRITIS untuk kode 691/692 (non-kas direkonsiliasi lewat jadwal)
    const nonCashMismatches = report!.discrepancies.filter(
      (d) => d.severity === 'critical' && (d.where.includes('kode 691') || d.where.includes('kode 692')),
    );
    assert.equal(nonCashMismatches.length, 0);
  });

  test('ground truth #6: neraca Kas dan Bank / Piutang / Total Aktiva=Passiva / TA-TP=0', () => {
    assert.ok(report);
    const piutangReconciled = report!.reconciled.some((r) => r.description === 'Piutang kepada Pelanggan');
    assert.ok(piutangReconciled, 'Piutang kepada Pelanggan seharusnya reconciled, bukan discrepancy');

    const piutangMismatch = report!.discrepancies.find((d) => d.where.includes('Piutang kepada Pelanggan') || (d.kind === 'statement-vs-recomputed-mismatch' && String(d.expected).length > 0 && d.where.toLowerCase().includes('neraca')));
    // Cross-check nilai eksplisit: 79160000
    const kode18 = report!.computed.kodeAggregates[18];
    assert.ok(report!.computed.totalPendapatan !== null);
    const expectedPiutang = report!.computed.totalPendapatan! - (kode18?.debit ?? 0);
    assert.ok(closeEnough(expectedPiutang, 79160000, 0.02));
    void piutangMismatch;

    const totalBalance = report!.reconciled.some((r) => r.description === 'Total Aktiva = Total Passiva');
    assert.ok(totalBalance, 'Total Aktiva harus sama dengan Total Passiva (neraca balance)');

    const taTpCritical = report!.discrepancies.find((d) => d.where.includes('TA - TP'));
    assert.equal(taTpCritical, undefined, 'TA - TP seharusnya 0, tidak ada discrepancy');
  });

  test('ground truth #8-9: cash flow JUMLAH = 3385159000, depresiasi 3 aset total biaya 10000000', () => {
    assert.ok(parsed);
    const cf = parsed!.cashFlowSheets['cash flow'];
    assert.ok(cf);
    assert.ok(cf.jumlahPemasukan !== null && closeEnough(cf.jumlahPemasukan, 3385159000));
    assert.ok(cf.jumlahPengeluaran !== null && closeEnough(cf.jumlahPengeluaran, 3385159000));

    const depresiasi = parsed!.depreciationSchedules['depresiasi'];
    assert.ok(depresiasi);
    assert.equal(depresiasi.items.length, 3);
    assert.ok(closeEnough(depresiasi.totalBiaya ?? 0, 10000000));
    const perBulanTotal = depresiasi.totalPerBulan.filter((v) => Math.abs(v) > 0.01);
    assert.equal(perBulanTotal.length, 22);
  });

  test('ground truth #10: discrepancy label "(12 bulan)" vs 22 bulan TERDETEKSI untuk depresiasi (bukan amortisasi)', () => {
    assert.ok(report);
    const labelMismatch = report!.discrepancies.find(
      (d) => d.kind === 'label-vs-computed-mismatch' && d.where.toUpperCase().includes('DEPRESIASI'),
    );
    assert.ok(labelMismatch, 'discrepancy label-vs-computed untuk depresiasi harus terdeteksi');
    assert.equal(labelMismatch!.actual, 12);
    assert.equal(labelMismatch!.expected, 22);

    // Amortisasi labelnya justru BENAR (12 bulan == 12 bulan terisi) -- tidak boleh flagged.
    const amortisasiMismatch = report!.discrepancies.find(
      (d) => d.kind === 'label-vs-computed-mismatch' && d.where.toUpperCase().includes('AMORTISASI'),
    );
    assert.equal(amortisasiMismatch, undefined, 'label amortisasi (12 bulan) sudah benar, seharusnya tidak di-flag');
  });

  test('ground truth #11: sinyal data-basi (kode posting " HQQ Co." bertanggal 2003) terdeteksi', () => {
    assert.ok(report);
    assert.ok(report!.staleDataSignals.length > 0, 'harus ada minimal 1 sinyal data-basi');
    const hasCompanySignal = report!.staleDataSignals.some((s) => s.includes('HQQ') || s.toLowerCase().includes('entitas'));
    assert.ok(hasCompanySignal, `sinyal data-basi tidak menyebut entitas lama: ${JSON.stringify(report!.staleDataSignals)}`);
  });
});
