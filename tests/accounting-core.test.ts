import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Prisma, TransactionType } from '@prisma/client';
import { formatIDR, moneyToString, sumMoney, toMoney } from '../src/lib/accounting/money';
import {
  comparativeRange,
  getJakartaParts,
  jakartaEndOfMonth,
  jakartaStartOfDay,
  jakartaStartOfMonth,
  monthRange,
  parsePeriodParam,
  resolveReportRange,
  shiftMonth,
} from '../src/lib/accounting/period';
import { aggregateBalances, assertJournalBalanced, statementAmount, type JournalLineRow } from '../src/lib/accounting/reports';
import { canAccounting } from '../src/lib/accounting/rbac';
import {
  ancestorIds,
  buildAccountTree,
  descendantIds,
  flattenAccountTree,
  wouldCreateCycle,
} from '../src/lib/accounting/account-tree';

/* ── money ─────────────────────────────────────────────────────────────── */

describe('accounting: money', () => {
  test('toMoney membulatkan Float legacy ke 2 desimal tanpa artefak biner', () => {
    assert.equal(toMoney(0.1 + 0.2).toFixed(2), '0.30');
    assert.equal(toMoney(1234.567).toFixed(2), '1234.57');
    assert.equal(toMoney('1000,5').toFixed(2), '1000.50');
    assert.equal(toMoney(null).toFixed(2), '0.00');
  });

  test('toMoney menolak nilai tidak valid', () => {
    assert.throws(() => toMoney(Number.NaN, 'nominal'), /nominal tidak valid/);
    assert.throws(() => toMoney(Number.POSITIVE_INFINITY), /tidak valid/);
  });

  test('sumMoney menjumlahkan Decimal dengan tepat', () => {
    const total = sumMoney([0.1, 0.2, '0.3']);
    assert.equal(total.toFixed(2), '0.60');
    assert.equal(total.equals(new Prisma.Decimal('0.60')), true);
  });

  test('formatIDR memberi pemisah ribuan dan tanda negatif', () => {
    assert.equal(formatIDR(1500000), 'Rp 1.500.000');
    assert.equal(formatIDR(-2500), '-Rp 2.500');
  });

  test('moneyToString selalu 2 desimal', () => {
    assert.equal(moneyToString(1000), '1000.00');
  });
});

/* ── period ────────────────────────────────────────────────────────────── */

describe('accounting: period', () => {
  test('jakartaStartOfDay memakai offset WIB (UTC+7)', () => {
    const start = jakartaStartOfDay(2026, 11, 1);
    assert.equal(start.toISOString(), '2026-10-31T17:00:00.000Z');
  });

  test('jakartaEndOfMonth menghormati jumlah hari bulan', () => {
    assert.equal(jakartaEndOfMonth(2026, 2).toISOString(), '2026-02-28T16:59:59.999Z');
    assert.equal(jakartaEndOfMonth(2026, 12).toISOString(), '2026-12-31T16:59:59.999Z');
  });

  test('monthRange mencakup tepat satu bulan WIB', () => {
    const range = monthRange(2026, 11);
    assert.equal(range.startDate.toISOString(), '2026-10-31T17:00:00.000Z');
    assert.equal(range.endDate.toISOString(), '2026-11-30T16:59:59.999Z');
  });

  test('getJakartaParts menggeser tanggal UTC ke tanggal WIB', () => {
    // 2026-10-31T18:00Z == 1 Nov 2026 01:00 WIB
    const parts = getJakartaParts(new Date('2026-10-31T18:00:00.000Z'));
    assert.deepEqual(parts, { year: 2026, month: 11, day: 1 });
  });

  test('parsePeriodParam menolak format salah', () => {
    assert.deepEqual(parsePeriodParam('2026-11'), { year: 2026, month: 11 });
    assert.throws(() => parsePeriodParam('2026/11'), /YYYY-MM/);
    assert.throws(() => parsePeriodParam('2026-13'), /tidak valid/);
  });

  test('shiftMonth melewati batas tahun', () => {
    assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
    assert.deepEqual(shiftMonth(2026, 12, 1), { year: 2027, month: 1 });
    assert.deepEqual(shiftMonth(2026, 3, -7), { year: 2025, month: 8 });
  });

  test('resolveReportRange default ke bulan berjalan (WIB)', () => {
    const range = resolveReportRange({ now: new Date('2026-10-19T03:00:00.000Z') });
    assert.equal(range.periodKey, '2026-10');
    assert.equal(range.startDate.toISOString(), '2026-09-30T17:00:00.000Z');
  });

  test('resolveReportRange menolak rentang terbalik', () => {
    assert.throws(
      () => resolveReportRange({ startDate: '2026-11-30', endDate: '2026-11-01' }),
      /tidak boleh setelah/
    );
  });

  test('comparativeRange prev_month dan prev_year', () => {
    const range = resolveReportRange({ period: '2026-01' });
    const prevMonth = comparativeRange('prev_month', range)!;
    assert.equal(prevMonth.startDate.toISOString(), '2025-11-30T17:00:00.000Z');
    const prevYear = comparativeRange('prev_year', range)!;
    assert.equal(prevYear.startDate.toISOString(), '2024-12-31T17:00:00.000Z');
  });

  test('comparativeRange ytd dimulai dari awal bulan fiskal', () => {
    const range = resolveReportRange({ period: '2026-11' });
    const ytd = comparativeRange('ytd', range, 1)!;
    assert.equal(ytd.startDate.toISOString(), '2025-12-31T17:00:00.000Z');
    assert.equal(ytd.endDate.toISOString(), range.endDate.toISOString());
  });
});

/* ── agregasi saldo ───────────────────────────────────────────────────── */

function line(
  code: string,
  type: JournalLineRow['account']['type'],
  normalBalance: JournalLineRow['account']['normalBalance'],
  debit: string,
  credit: string,
  accountId = code,
  costCenter: string | null = null
): JournalLineRow {
  return {
    id: `${accountId}-${debit}-${credit}`,
    entryId: 'entry-1',
    accountId,
    cashAccountId: null,
    partnerId: null,
    debit: new Prisma.Decimal(debit),
    credit: new Prisma.Decimal(credit),
    description: null,
    costCenter,
    account: { id: accountId, code, name: code, type, normalBalance },
    entry: {
      id: 'entry-1',
      entryNumber: 'JE-2026-11-0001',
      entryDate: new Date('2026-11-05T00:00:00.000Z'),
      description: 'test',
      source: 'MANUAL' as JournalLineRow['entry']['source'],
    },
  };
}

describe('accounting: agregasi saldo', () => {
  test('akun aset (debit normal) bertambah saat debit', () => {
    const balances = aggregateBalances([line('1-1110', 'ASSET', 'DEBIT', '500.00', '0.00')]);
    assert.equal(balances[0].balance.toFixed(2), '500.00');
  });

  test('akun pendapatan (kredit normal) bertambah saat kredit', () => {
    const balances = aggregateBalances([line('4-1100', 'REVENUE', 'CREDIT', '0.00', '750.00')]);
    assert.equal(balances[0].balance.toFixed(2), '750.00');
  });

  test('akun kontra (diskon) menghasilkan saldo negatif pada pendapatan', () => {
    const balances = aggregateBalances([
      line('4-1100', 'REVENUE', 'CREDIT', '0.00', '1000.00'),
      line('4-2000', 'REVENUE', 'DEBIT', '150.00', '0.00'),
    ]);
    const revenue = balances.find((b) => b.code === '4-1100')!;
    const discount = balances.find((b) => b.code === '4-2000')!;
    assert.equal(revenue.balance.toFixed(2), '1000.00');
    assert.equal(discount.balance.toFixed(2), '150.00');
    const net = revenue.balance.minus(discount.balance);
    assert.equal(net.toFixed(2), '850.00');
  });

  test('baris dengan akun sama digabung', () => {
    const balances = aggregateBalances([
      line('1-1110', 'ASSET', 'DEBIT', '100.00', '0.00'),
      line('1-1110', 'ASSET', 'DEBIT', '25.50', '0.00'),
      line('1-1110', 'ASSET', 'DEBIT', '0.00', '10.00'),
    ]);
    assert.equal(balances.length, 1);
    assert.equal(balances[0].balance.toFixed(2), '115.50');
  });

  test('assertJournalBalanced melempar bila debit != kredit', () => {
    assert.doesNotThrow(() => assertJournalBalanced([
      { debit: new Prisma.Decimal(10), credit: new Prisma.Decimal(0) },
      { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(10) },
    ]));
    assert.throws(
      () => assertJournalBalanced([
        { debit: new Prisma.Decimal(10), credit: new Prisma.Decimal(0) },
        { debit: new Prisma.Decimal(0), credit: new Prisma.Decimal(9) },
      ]),
      /tidak balance/
    );
  });
});

/* ── tanda angka di laporan (akun kontra) ──────────────────────────────── */

describe('accounting: nilai akun sebagai bagian dari laporan', () => {
  test('aset & beban bertanda positif sesuai sisi debit', () => {
    const balances = aggregateBalances([
      line('1-1110', 'ASSET', 'DEBIT', '500.00', '0.00'),
      line('6-1100', 'EXPENSE', 'DEBIT', '125.00', '0.00'),
    ]);
    assert.equal(balances.find((b) => b.code === '1-1110')!.amount.toFixed(2), '500.00');
    assert.equal(balances.find((b) => b.code === '6-1100')!.amount.toFixed(2), '125.00');
  });

  test('liabilitas, ekuitas & pendapatan bertanda positif sesuai sisi kredit', () => {
    const balances = aggregateBalances([
      line('2-1100', 'LIABILITY', 'CREDIT', '0.00', '300.00'),
      line('3-1100', 'EQUITY', 'CREDIT', '0.00', '400.00'),
      line('4-1100', 'REVENUE', 'CREDIT', '0.00', '900.00'),
    ]);
    assert.equal(balances.find((b) => b.code === '2-1100')!.amount.toFixed(2), '300.00');
    assert.equal(balances.find((b) => b.code === '3-1100')!.amount.toFixed(2), '400.00');
    assert.equal(balances.find((b) => b.code === '4-1100')!.amount.toFixed(2), '900.00');
  });

  test('akun kontra aset MENGURANGI total aset', () => {
    // Akumulasi Penyusutan: tipe ASSET, saldo normal CREDIT.
    const balances = aggregateBalances([line('1-2400', 'ASSET', 'CREDIT', '0.00', '250.00')]);
    assert.equal(balances[0].balance.toFixed(2), '250.00', 'saldo akun tetap positif menurut sifat normalnya');
    assert.equal(balances[0].amount.toFixed(2), '-250.00', 'tetapi di laporan harus mengurangi aset');
  });

  test('akun kontra ekuitas (prive) MENGURANGI total ekuitas', () => {
    const balances = aggregateBalances([line('3-1200', 'EQUITY', 'DEBIT', '80.00', '0.00')]);
    assert.equal(balances[0].amount.toFixed(2), '-80.00');
  });

  test('akun kontra pendapatan (diskon) MENGURANGI total pendapatan', () => {
    const balances = aggregateBalances([line('4-2000', 'REVENUE', 'DEBIT', '60.00', '0.00')]);
    assert.equal(balances[0].amount.toFixed(2), '-60.00');
  });

  test('persamaan akuntansi tetap berlaku, termasuk saat ada akun kontra', () => {
    // Inilah yang membuat Neraca selalu balance. Untuk SETIAP jurnal:
    //   Aset + Beban  =  Liabilitas + Ekuitas + Pendapatan
    // Karena laba tahun berjalan = Pendapatan - Beban, bentuk di atas setara
    // dengan  Aset = Liabilitas + Ekuitas + Laba  yang dipakai laporan Neraca.
    const sumBy = (balances: ReturnType<typeof aggregateBalances>, types: string[]) =>
      balances
        .filter((b) => types.includes(b.type))
        .reduce((acc, b) => acc.plus(b.amount), new Prisma.Decimal(0));

    const journalSets: Array<{ label: string; lines: JournalLineRow[] }> = [
      {
        label: 'modal disetor',
        lines: [
          line('1-1110', 'ASSET', 'DEBIT', '1000.00', '0.00'),
          line('3-1100', 'EQUITY', 'CREDIT', '0.00', '1000.00'),
        ],
      },
      {
        label: 'penyusutan (aset kontra)',
        lines: [
          line('6-1800', 'EXPENSE', 'DEBIT', '300.00', '0.00'),
          line('1-2400', 'ASSET', 'CREDIT', '0.00', '300.00'),
        ],
      },
      {
        label: 'pendapatan dengan diskon (pendapatan kontra)',
        lines: [
          line('1-1210', 'ASSET', 'DEBIT', '2000.00', '0.00'),
          line('4-1100', 'REVENUE', 'CREDIT', '0.00', '2200.00'),
          line('4-2000', 'REVENUE', 'DEBIT', '200.00', '0.00'),
        ],
      },
      {
        label: 'prive (ekuitas kontra)',
        lines: [
          line('3-1200', 'EQUITY', 'DEBIT', '150.00', '0.00'),
          line('1-1110', 'ASSET', 'CREDIT', '0.00', '150.00'),
        ],
      },
      {
        label: 'utang dibayar dengan laba',
        lines: [
          line('2-1100', 'LIABILITY', 'DEBIT', '400.00', '0.00'),
          line('1-1210', 'ASSET', 'CREDIT', '0.00', '400.00'),
        ],
      },
    ];

    for (const { label, lines } of journalSets) {
      const debits = lines.reduce((acc, l) => acc.plus(l.debit), new Prisma.Decimal(0));
      const credits = lines.reduce((acc, l) => acc.plus(l.credit), new Prisma.Decimal(0));
      assert.equal(debits.minus(credits).toFixed(2), '0.00', `${label}: prasyarat jurnal balance`);

      const balances = aggregateBalances(lines);
      const left = sumBy(balances, ['ASSET', 'EXPENSE']);
      const right = sumBy(balances, ['LIABILITY', 'EQUITY', 'REVENUE']);
      assert.equal(left.toFixed(2), right.toFixed(2), `${label}: aset + beban harus sama dengan liabilitas + ekuitas + pendapatan`);
    }
  });

  test('statementAmount setara dengan perhitungan sisi laporan tiap tipe', () => {
    const row = { debit: new Prisma.Decimal('75.00'), credit: new Prisma.Decimal('25.00') };
    assert.equal(statementAmount(row, 'ASSET').toFixed(2), '50.00');
    assert.equal(statementAmount(row, 'EXPENSE').toFixed(2), '50.00');
    assert.equal(statementAmount(row, 'LIABILITY').toFixed(2), '-50.00');
    assert.equal(statementAmount(row, 'EQUITY').toFixed(2), '-50.00');
    assert.equal(statementAmount(row, 'REVENUE').toFixed(2), '-50.00');
  });
});

/* ── rbac ─────────────────────────────────────────────────────────────── */

describe('accounting: rbac', () => {
  const auth = (role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER', isOwner = false) =>
    ({ membership: { role, isOwner } }) as never;

  test('viewer hanya boleh melihat laporan', () => {
    assert.equal(canAccounting(auth('VIEWER'), 'view'), true);
    assert.equal(canAccounting(auth('VIEWER'), 'draft'), false);
    assert.equal(canAccounting(auth('VIEWER'), 'post'), false);
  });

  test('member boleh membuat draft tetapi tidak posting', () => {
    assert.equal(canAccounting(auth('MEMBER'), 'draft'), true);
    assert.equal(canAccounting(auth('MEMBER'), 'post'), false);
  });

  test('admin boleh posting dan tutup buku, tetapi tidak kunci periode', () => {
    assert.equal(canAccounting(auth('ADMIN'), 'post'), true);
    assert.equal(canAccounting(auth('ADMIN'), 'close_period'), true);
    assert.equal(canAccounting(auth('ADMIN'), 'lock_period'), false);
    assert.equal(canAccounting(auth('ADMIN'), 'manage_settings'), false);
  });

  test('owner boleh semua aksi', () => {
    for (const action of ['view', 'draft', 'post', 'lock_period', 'manage_settings', 'opening_balance'] as const) {
      assert.equal(canAccounting(auth('OWNER', true), action), true, `owner harus boleh ${action}`);
    }
  });
});

/* ── hierarki bagan akun ───────────────────────────────────────────────── */

describe('accounting: hierarki bagan akun', () => {
  const acc = (id: string, code: string, parentId: string | null = null) => ({
    id,
    code,
    name: `Akun ${code}`,
    parentId,
  });

  const flat = [
    acc('aset', '1-1000'),
    acc('kas', '1-1100', 'aset'),
    acc('kas-kecil', '1-1110', 'kas'),
    acc('bank', '1-1200', 'aset'),
    acc('beban', '6-1000'),
    acc('internet', '6-1400', 'beban'),
    acc('lain', '6-9000', 'beban'),
  ];

  test('buildAccountTree menyusun induk–anak dan mengurutkan kode', () => {
    const tree = buildAccountTree(flat);
    assert.deepEqual(tree.map((n) => n.account.id), ['aset', 'beban']);
    assert.deepEqual(tree[0].children.map((n) => n.account.id), ['kas', 'bank']);
    assert.deepEqual(tree[0].children[0].children.map((n) => n.account.id), ['kas-kecil']);
    assert.deepEqual(tree[1].children.map((n) => n.account.id), ['internet', 'lain']);
  });

  test('akun dengan induk yang tidak dimuat tetap muncul sebagai akar', () => {
    const tree = buildAccountTree([acc('anak', '6-9500', 'induk-hilang')]);
    assert.equal(tree.length, 1);
    assert.equal(tree[0].account.id, 'anak');
  });

  test('data bersiklus tidak membuat akun hilang atau render tak berujung', () => {
    const tree = buildAccountTree([acc('a', '9-1000', 'b'), acc('b', '9-2000', 'a')]);
    const ids = tree.map((n) => n.account.id);
    assert.equal(ids.length, 2);
    assert.equal(tree.every((n) => n.children.length === 0), true);
  });

  test('flattenAccountTree menghormati status buka/tutup dan kedalaman', () => {
    const tree = buildAccountTree(flat);

    const all = flattenAccountTree(tree);
    assert.deepEqual(all.map((r) => r.account.id), ['aset', 'kas', 'kas-kecil', 'bank', 'beban', 'internet', 'lain']);
    assert.deepEqual(all.map((r) => r.depth), [0, 1, 2, 1, 0, 1, 1]);
    assert.equal(all.find((r) => r.account.id === 'aset')?.hasChildren, true);
    assert.equal(all.find((r) => r.account.id === 'bank')?.hasChildren, false);

    const collapsed = flattenAccountTree(tree, (id) => id !== 'aset');
    assert.deepEqual(collapsed.map((r) => r.account.id), ['aset', 'beban', 'internet', 'lain']);
  });

  test('ancestorIds memberi induk terdekat lebih dulu', () => {
    assert.deepEqual(ancestorIds(flat, 'kas-kecil'), ['kas', 'aset']);
    assert.deepEqual(ancestorIds(flat, 'aset'), []);
  });

  test('descendantIds mencakup anak dan cucu', () => {
    assert.deepEqual([...descendantIds(flat, 'aset')].sort(), ['bank', 'kas', 'kas-kecil']);
    assert.equal(descendantIds(flat, 'lain').size, 0);
  });

  test('wouldCreateCycle menolak diri sendiri dan turunannya', () => {
    assert.equal(wouldCreateCycle(flat, 'aset', 'aset'), true);
    assert.equal(wouldCreateCycle(flat, 'aset', 'kas-kecil'), true);
    assert.equal(wouldCreateCycle(flat, 'kas', 'kas-kecil'), true);
    assert.equal(wouldCreateCycle(flat, 'kas-kecil', 'aset'), false);
    assert.equal(wouldCreateCycle(flat, 'internet', 'beban'), false);
    assert.equal(wouldCreateCycle(flat, 'internet', null), false);
  });

  test('wouldCreateCycle tidak menggantung pada data yang sudah bersiklus', () => {
    const cyclic = [acc('a', '9-1000', 'b'), acc('b', '9-2000', 'a')];
    assert.equal(wouldCreateCycle(cyclic, 'c', 'a'), false);
  });
});

describe('anggaran (budget)', () => {
  test('tahun buku dihitung dari bulan pertama tahun buku', async () => {
    const { fiscalStartYear } = await import('../src/lib/accounting/budgets');
    assert.equal(fiscalStartYear(2026, 1, 1), 2026);
    assert.equal(fiscalStartYear(2026, 12, 1), 2026);
    assert.equal(fiscalStartYear(2026, 4, 4), 2026);
    assert.equal(fiscalStartYear(2026, 3, 4), 2025, 'Maret masih tahun buku yang mulai April 2025');
    assert.equal(fiscalStartYear(2027, 1, 4), 2026);
  });

  test('posisi bulan 0-11 mengikuti tahun buku, bukan kalender', async () => {
    const { monthIndexInFiscalYear } = await import('../src/lib/accounting/budgets');
    assert.equal(monthIndexInFiscalYear(2026, 1, 1), 0);
    assert.equal(monthIndexInFiscalYear(2026, 11, 1), 10);
    assert.equal(monthIndexInFiscalYear(2026, 12, 1), 11);
    assert.equal(monthIndexInFiscalYear(2026, 4, 4), 0, 'April = slot pertama');
    assert.equal(monthIndexInFiscalYear(2026, 12, 4), 8);
    assert.equal(monthIndexInFiscalYear(2027, 1, 4), 9);
    assert.equal(monthIndexInFiscalYear(2027, 3, 4), 11, 'Maret = slot terakhir');
  });

  test('parseMonthly menerima 12 angka dan menolak input tidak valid', async () => {
    const { parseMonthly } = await import('../src/lib/accounting/budgets');
    const parsed = parseMonthly([1_000_000, '250000', '', 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    assert.equal(parsed.length, 12);
    assert.equal(parsed[0].toFixed(2), '1000000.00');
    assert.equal(parsed[1].toFixed(2), '250000.00');
    assert.equal(parsed[2].toFixed(2), '0.00');

    assert.throws(() => parseMonthly([1, 2, 3]), /tepat 12 angka/);
    assert.throws(() => parseMonthly([-1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), /tidak boleh negatif/);
    assert.throws(() => parseMonthly([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'abc']), /tidak valid/);
  });
});

/* ── payroll (PPh 21 & BPJS) ───────────────────────────────────────────── */

describe('payroll: perhitungan slip gaji', () => {
  test('bruto, potongan, gaji bersih, dan biaya pemberi kerja', async () => {
    const { computePayroll } = await import('../src/lib/accounting/payroll');
    const result = computePayroll({
      basicSalary: 8_000_000,
      allowance: 1_000_000,
      overtime: 500_000,
      pph21: 250_000,
      bpjsEmployee: 190_000,
      bpjsEmployer: 380_000,
      otherDeductions: 60_000,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.gross, 9_500_000);
    assert.equal(result.value.deductions, 500_000);
    assert.equal(result.value.net, 9_000_000);
    assert.equal(result.value.employerCost, 9_880_000, 'BPJS pemberi kerja menambah beban');
  });

  test('BPJS pemberi kerja tidak memotong gaji bersih', async () => {
    const { computePayroll } = await import('../src/lib/accounting/payroll');
    const result = computePayroll({ basicSalary: 5_000_000, bpjsEmployer: 400_000 });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.value.net, 5_000_000);
    assert.equal(result.value.employerCost, 5_400_000);
  });

  test('potongan melebihi bruto ditolak', async () => {
    const { computePayroll } = await import('../src/lib/accounting/payroll');
    const result = computePayroll({ basicSalary: 1_000_000, pph21: 1_500_000 });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.match(result.error, /melebihi gaji bruto/);
  });

  test('angka negatif / bukan angka ditolak', async () => {
    const { computePayroll } = await import('../src/lib/accounting/payroll');
    assert.equal(computePayroll({ basicSalary: -1 }).ok, false);
    assert.equal(computePayroll({ basicSalary: 1_000_000, bpjsEmployee: Number.NaN }).ok, false);
  });
});

/* ── persediaan: rata-rata bergerak ────────────────────────────────────── */

describe('persediaan: rata-rata bergerak', () => {
  test('harga rata-rata setelah dua pembelian berbobot', async () => {
    const { applyIncomingStock, averageUnitCost } = await import('../src/lib/accounting/inventory');
    const first = applyIncomingStock({ qtyOnHand: 0, value: 0 }, 10, 10_000);
    assert.equal(first.qtyOnHand, 10);
    assert.equal(first.value, 100_000);
    assert.equal(averageUnitCost(first), 10_000);

    const second = applyIncomingStock(first, 10, 14_000);
    assert.equal(second.qtyOnHand, 20);
    assert.equal(second.value, 240_000);
    assert.equal(averageUnitCost(second), 12_000);
  });

  test('HPP keluar memakai rata-rata dan menyisakan nilai buku yang konsisten', async () => {
    const { applyOutgoingStock } = await import('../src/lib/accounting/inventory');
    const issue = applyOutgoingStock({ qtyOnHand: 7, value: 7_500 }, 1);
    assert.equal(issue.qty, 1);
    assert.equal(issue.amount, 1_071.43);
    assert.equal(issue.remainingValue, 6_428.57);
    assert.equal(issue.unitCost, 1_071.43);
  });

  test('pengeluaran tidak pernah membuat nilai buku negatif', async () => {
    const { applyOutgoingStock } = await import('../src/lib/accounting/inventory');
    const issue = applyOutgoingStock({ qtyOnHand: 2, value: 20_000 }, 5);
    assert.equal(issue.qty, 2, 'qty dipotong ke stok tersedia');
    assert.equal(issue.amount, 20_000);
    assert.equal(issue.remainingValue, 0);
  });

  test('stok kosong / nol tidak menghasilkan HPP', async () => {
    const { applyOutgoingStock } = await import('../src/lib/accounting/inventory');
    const issue = applyOutgoingStock({ qtyOnHand: 0, value: 0 }, 3);
    assert.equal(issue.qty, 0);
    assert.equal(issue.amount, 0);
    assert.equal(issue.remainingValue, 0);
  });

  test('barang titip jual tidak dinilai sebagai persediaan sendiri', async () => {
    const { isInventoryValued } = await import('../src/lib/accounting/inventory');
    assert.equal(isInventoryValued('OWNED'), true);
    assert.equal(isInventoryValued(null), true);
    assert.equal(isInventoryValued(undefined), true);
    assert.equal(isInventoryValued('CONSIGNED'), false);
  });

  test('nilai buku bertahan saat barang masuk memakai rata-rata berjalan', async () => {
    const { applyIncomingStock, averageUnitCost } = await import('../src/lib/accounting/inventory');
    // Retur dari pelanggan dinilai pada rata-rata saat ini -> rata-rata tidak berubah.
    const state = { qtyOnHand: 16, value: 192_000 };
    const next = applyIncomingStock(state, 1, averageUnitCost(state));
    assert.equal(next.qtyOnHand, 17);
    assert.equal(next.value, 204_000);
    assert.equal(averageUnitCost(next), 12_000);
  });
});

/* ── pembayaran sebagian & alokasi dokumen ─────────────────────────────── */

describe('pembayaran sebagian: rencana settlement', () => {
  const load = () => import('../src/lib/accounting/settlement');

  test('pembayaran kurang dari total -> PARTIAL dengan sisa benar', async () => {
    const { planDocumentSettlement } = await load();
    const plan = planDocumentSettlement({ total: 10_000_000, paidAmount: 0, amount: 4_000_000, label: 'Faktur X' });
    assert.ok(plan.ok);
    if (!plan.ok) return;
    assert.equal(plan.newStatus, 'PARTIAL');
    assert.equal(plan.newPaid, 4_000_000);
    assert.equal(plan.remaining, 6_000_000);
  });

  test('dua angsuran menutup sisa -> PAID hanya saat tepat habis', async () => {
    const { planDocumentSettlement } = await load();
    const first = planDocumentSettlement({ total: 10_000_000, paidAmount: 0, amount: 3_000_000, label: 'Faktur X' });
    assert.ok(first.ok);
    if (!first.ok) return;
    const second = planDocumentSettlement({ total: 10_000_000, paidAmount: first.newPaid, amount: 7_000_000, label: 'Faktur X' });
    assert.ok(second.ok);
    if (!second.ok) return;
    assert.equal(second.newStatus, 'PAID');
    assert.equal(second.remaining, 0);
  });

  test('pembayaran melebihi sisa ditolak', async () => {
    const { planDocumentSettlement } = await load();
    const plan = planDocumentSettlement({ total: 10_000_000, paidAmount: 4_000_000, amount: 7_000_000, label: 'Faktur X' });
    assert.equal(plan.ok, false);
  });

  test('dokumen yang sudah lunas ditolak', async () => {
    const { planDocumentSettlement } = await load();
    const plan = planDocumentSettlement({ total: 10_000_000, paidAmount: 10_000_000, amount: 1_000, label: 'Faktur X' });
    assert.equal(plan.ok, false);
  });

  test('sisa tidak pernah negatif walau data lama dibayar penuh', async () => {
    const { computeRemaining, statusFor } = await load();
    assert.equal(computeRemaining(5_000_000, 6_000_000), 0);
    assert.equal(statusFor(5_000_000, 5_000_000), 'PAID');
    assert.equal(statusFor(5_000_000, 1_000_000), 'PARTIAL');
  });
});

describe('pembayaran sebagian: validasi alokasi', () => {
  const load = () => import('../src/lib/accounting/settlement');

  test('alokasi split yang jumlahnya sama dengan nominal diterima', async () => {
    const { validateAllocations } = await load();
    const result = validateAllocations(
      [
        { invoiceId: 'a', amount: 2_000_000 },
        { invoiceId: 'b', amount: 2_000_000 },
      ],
      4_000_000,
      'INCOME'
    );
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.equal(result.total, 4_000_000);
    assert.equal(result.hasInvoice, true);
    assert.equal(result.hasObligation, false);
  });

  test('jumlah alokasi tidak cocok dengan nominal kas ditolak', async () => {
    const { validateAllocations } = await load();
    const result = validateAllocations([{ invoiceId: 'a', amount: 3_000_000 }], 4_000_000, 'INCOME');
    assert.equal(result.ok, false);
  });

  test('pemasukan tidak boleh dialokasikan ke kewajiban', async () => {
    const { validateAllocations } = await load();
    const result = validateAllocations([{ obligationId: 'o', amount: 1_000_000 }], 1_000_000, 'INCOME');
    assert.equal(result.ok, false);
  });

  test('alokasi tanpa dokumen ditolak', async () => {
    const { validateAllocations } = await load();
    const result = validateAllocations([{ amount: 1_000_000 }], 1_000_000, 'EXPENSE');
    assert.equal(result.ok, false);
  });
});

/* ── anggaran per divisi ───────────────────────────────────────────────── */

describe('anggaran per divisi: daftar divisi', () => {
  test('daftar divisi harus sama dengan enum DivisionRole di skema', async () => {
    // `budget-divisions.ts` mendeklarasikan sendiri nilainya supaya aman dipakai
    // dari komponen klien tanpa menarik runtime Prisma ke bundel browser.
    // Test inilah yang menjaga supaya deklarasi itu tidak pernah menyimpang
    // dari enum di schema.prisma.
    const { DivisionRole } = await import('@prisma/client');
    const { DIVISIONS } = await import('../src/lib/accounting/budget-divisions');
    assert.deepEqual([...DIVISIONS].sort(), Object.values(DivisionRole).sort());
  });
});

describe('anggaran per divisi: normalisasi input', () => {
  const load = () => import('../src/lib/accounting/budget-divisions');

  test('anggaran tanpa divisi dianggap Perusahaan, bukan ditolak', async () => {
    const { normalizeBudgetDivision, COMPANY_DIVISION } = await load();
    assert.equal(normalizeBudgetDivision(null), COMPANY_DIVISION);
    assert.equal(normalizeBudgetDivision(undefined), COMPANY_DIVISION);
    assert.equal(normalizeBudgetDivision(''), COMPANY_DIVISION);
    assert.equal(normalizeBudgetDivision('   '), COMPANY_DIVISION);
  });

  test('anggaran menerima semua nilai divisi, huruf besar-kecil acak pun', async () => {
    const { normalizeBudgetDivision, DIVISIONS } = await load();
    for (const division of DIVISIONS) {
      assert.equal(normalizeBudgetDivision(division), division);
      assert.equal(normalizeBudgetDivision(division.toLowerCase()), division);
      assert.equal(normalizeBudgetDivision(`  ${division}  `), division);
    }
  });

  test('anggaran menolak nilai di luar daftar divisi', async () => {
    const { normalizeBudgetDivision } = await load();
    assert.throws(() => normalizeBudgetDivision('BAGIAN_UMUM'), /tidak dikenal/);
    assert.throws(() => normalizeBudgetDivision('123'), /tidak dikenal/);
  });

  test('transaksi kas tanpa divisi menjadi null, bukan Perusahaan', async () => {
    // Berbeda dari anggaran: di transaksi kas, kolomnya nullable. Mengisinya
    // "PERUSAHAAN" akan membuat realisasi anggaran Perusahaan tidak pernah
    // cocok dengan laporan lama yang menyaring `costCenter IS NULL`.
    const { normalizeCashDivision, COMPANY_DIVISION } = await load();
    assert.equal(normalizeCashDivision(null), null);
    assert.equal(normalizeCashDivision(''), null);
    assert.equal(normalizeCashDivision('TANPA_DIVISI'), null);
    assert.throws(() => normalizeCashDivision(COMPANY_DIVISION), /tidak dikenal/);
  });

  test('transaksi kas menerima divisi nyata', async () => {
    const { normalizeCashDivision, DIVISIONS } = await load();
    for (const division of DIVISIONS) {
      assert.equal(normalizeCashDivision(division), division);
    }
  });

  test('label kas menampilkan "Tanpa Divisi" untuk nilai kosong', async () => {
    const { cashDivisionLabel, divisionLabel } = await load();
    assert.equal(cashDivisionLabel(null), 'Tanpa Divisi');
    assert.equal(cashDivisionLabel('  '), 'Tanpa Divisi');
    assert.equal(cashDivisionLabel('MARKETING'), divisionLabel('MARKETING'));
  });
});

describe('anggaran per divisi: penyaringan jurnal', () => {
  const load = () => import('../src/lib/accounting/budgets');

  test('anggaran Perusahaan tidak menyaring apa pun', async () => {
    // Inilah yang membuat laporan anggaran LAMA tetap utuh: seluruh barisnya
    // berlabel PERUSAHAAN, jadi realisasinya tetap SELURUH pengeluaran.
    const { budgetDivisionFilter } = await load();
    const { COMPANY_DIVISION } = await import('../src/lib/accounting/budget-divisions');
    assert.equal(budgetDivisionFilter(COMPANY_DIVISION), undefined);
  });

  test('divisi nyata menyaring lewat costCenter', async () => {
    const { budgetDivisionFilter } = await load();
    assert.deepEqual(budgetDivisionFilter('MARKETING'), { costCenter: 'MARKETING' });
  });

  test('costCenter baris kas tidak ikut terisi', async () => {
    const { journalCostCenter, normalizeCashDivision } = await import(
      '../src/lib/accounting/budget-divisions'
    );
    assert.equal(journalCostCenter(normalizeCashDivision(null)), null);
    assert.equal(journalCostCenter(normalizeCashDivision('MARKETING')), 'MARKETING');
  });
});

/**
 * Invarian paling penting dari anggaran per divisi: divisi hanya boleh menempel
 * pada baris BEBAN/PENDAPATAN di cabang generik. Cabang pelunasan (kewajiban,
 * faktur, gaji, persediaan) memindahkan utang/aset yang beban-nya SUDAH diakui
 * di dokumen sumber -- menempelkan divisi di sana akan menghitung beban dua
 * kali dan membuat realisasi divisi menyimpang dari Laba Rugi.
 *
 * Test ini memakai transaction client palsu supaya cabang-cabang itu benar-benar
 * dijalankan, bukan sekadar diperiksa dari struktur kode.
 */
function makePostingTx(captured: { lines: Array<Record<string, any>> }) {
  const accounts = [
    { id: 'acc-cash', code: '1-1100', name: 'Kas', isActive: true, isPostable: true },
    { id: 'acc-expense', code: '6-9000', name: 'Beban Lain-lain', isActive: true, isPostable: true },
    { id: 'acc-revenue', code: '4-1900', name: 'Pendapatan Lain-lain', isActive: true, isPostable: true },
    { id: 'acc-ar', code: '1-1300', name: 'Piutang Usaha', isActive: true, isPostable: true },
    { id: 'acc-ap', code: '2-1100', name: 'Utang Usaha', isActive: true, isPostable: true },
    { id: 'acc-salary', code: '2-1200', name: 'Utang Gaji', isActive: true, isPostable: true },
    { id: 'acc-inventory', code: '1-1400', name: 'Persediaan', isActive: true, isPostable: true },
  ];

  const cashAccount = {
    id: 'cash-1',
    name: 'Kas',
    code: 'KAS',
    type: 'CASH',
    bankName: null,
    isActive: true,
    account: accounts[0],
  };

  return {
    accountingSetting: {
      findUnique: async () => ({ isEnabled: true, defaultCashAccountId: null }),
    },
    cashAccount: {
      findMany: async (args: any) =>
        args?.select ? [{ id: 'cash-1', isActive: true }] : [cashAccount],
    },
    account: {
      findMany: async (args: any) =>
        accounts.filter((account) => args.where.id.in.includes(account.id)),
      findFirst: async (args: any) => {
        const found = accounts.find((account) => account.code === args.where.code);
        return found ? { id: found.id } : null;
      },
    },
    categoryAccountMap: {
      findUnique: async (args: any) => ({
        accountId:
          args.where.workspaceId_category_type.type === 'REVENUE' ? 'acc-revenue' : 'acc-expense',
      }),
    },
    fiscalPeriod: {
      upsert: async () => ({ id: 'period-1', year: 2026, month: 10, status: 'OPEN' }),
    },
    $queryRaw: async () => [{ next_number: 1 }],
    journalEntry: {
      create: async () => ({ id: 'entry-1' }),
    },
    journalLine: {
      createMany: async (args: any) => {
        captured.lines.push(...args.data);
        return { count: args.data.length };
      },
      findMany: async () =>
        captured.lines.map((line, index) => ({ ...line, lineNo: index + 1 })),
    },
  } as any;
}

describe('anggaran per divisi: divisi tidak bocor ke cabang non-beban', () => {
  const transactionDate = new Date('2026-10-05T00:00:00Z');

  const txRow = (overrides: Record<string, unknown>) => ({
    id: 'tx-1',
    type: TransactionType.EXPENSE,
    category: 'Operasional',
    amount: 1_000_000,
    description: 'uji',
    paymentMethod: 'TUNAI',
    transactionDate,
    invoiceId: null,
    obligationId: null,
    payrollId: null,
    settlementAccountId: null,
    // Sengaja diisi: kalau cabang non-beban bocor, divisi inilah yang muncul.
    division: 'MARKETING',
    ...overrides,
  });

  async function post(
    overrides: Record<string, unknown>,
    contextExtra: Record<string, unknown> = {}
  ) {
    const { postCashTransaction } = await import('../src/lib/accounting/posting');
    const captured = { lines: [] as Array<Record<string, any>> };
    await postCashTransaction(makePostingTx(captured), {
      workspaceId: 'ws-1',
      userId: 'user-1',
      transaction: txRow(overrides) as any,
      ...contextExtra,
    });
    return captured.lines;
  }

  const hasNoCostCenter = (lines: Array<Record<string, any>>) =>
    lines.every((line) => line.costCenter === null || line.costCenter === undefined);

  test('setoran kewajiban tidak menempelkan costCenter', async () => {
    const lines = await post({ settlementAccountId: 'acc-ap' });
    assert.equal(lines.length, 2);
    assert.ok(hasNoCostCenter(lines));
  });

  test('pelunasan faktur tidak menempelkan costCenter', async () => {
    const lines = await post({ type: TransactionType.INCOME, invoiceId: 'inv-1' });
    assert.equal(lines.length, 2);
    assert.ok(hasNoCostCenter(lines));
  });

  test('pembayaran kewajiban tidak menempelkan costCenter', async () => {
    const lines = await post({ obligationId: 'obl-1' });
    assert.equal(lines.length, 2);
    assert.ok(hasNoCostCenter(lines));
  });

  test('pembayaran gaji tidak menempelkan costCenter', async () => {
    const lines = await post({ payrollId: 'pay-1' });
    assert.equal(lines.length, 2);
    assert.ok(hasNoCostCenter(lines));
  });

  test('pembelian persediaan tidak menempelkan costCenter', async () => {
    const lines = await post({}, { debitAccountCode: '1-1400' });
    assert.equal(lines.length, 2);
    assert.ok(hasNoCostCenter(lines));
  });

  test('cabang generik menempelkan costCenter HANYA di baris non-kas', async () => {
    const lines = await post({});
    const cashLine = lines.find((line) => line.cashAccountId !== null);
    const expenseLine = lines.find((line) => line.cashAccountId === null);

    assert.ok(cashLine, 'harus ada baris kas');
    assert.ok(expenseLine, 'harus ada baris beban');
    assert.equal(cashLine!.costCenter, null, 'baris kas tidak boleh punya divisi');
    assert.equal(expenseLine!.costCenter, 'MARKETING');
  });

  test('transaksi tanpa divisi tetap tanpa costCenter', async () => {
    const lines = await post({ division: null });
    assert.ok(hasNoCostCenter(lines));
  });
});

describe('anggaran per divisi: ambang peringatan', () => {
  const load = () => import('../src/lib/accounting/budget-alerts');

  test('di bawah 80% tidak memicu apa pun', async () => {
    const { resolveAlertLevel } = await load();
    assert.equal(resolveAlertLevel(1_000_000, 799_999), null);
    assert.equal(resolveAlertLevel(1_000_000, 0), null);
  });

  test('tepat 80% memicu WARNING', async () => {
    const { resolveAlertLevel } = await load();
    assert.equal(resolveAlertLevel(1_000_000, 800_000), 'WARNING');
  });

  test('mendekati tapi belum 100% tetap WARNING', async () => {
    const { resolveAlertLevel } = await load();
    assert.equal(resolveAlertLevel(1_000_000, 999_999), 'WARNING');
  });

  test('tepat 100% memicu EXCEEDED, bukan terpeleset karena pembulatan', async () => {
    const { resolveAlertLevel } = await load();
    assert.equal(resolveAlertLevel(1_000_000, 1_000_000), 'EXCEEDED');
    // Anggaran yang nilainya 3 kali tidak presisi di floating point.
    assert.equal(resolveAlertLevel(0.3, 0.3), 'EXCEEDED');
  });

  test('realisasi melebihi anggaran memicu EXCEEDED', async () => {
    const { resolveAlertLevel } = await load();
    assert.equal(resolveAlertLevel(1_000_000, 1_500_000), 'EXCEEDED');
  });

  test('anggaran nol tidak bisa dinilai', async () => {
    const { resolveAlertLevel } = await load();
    assert.equal(resolveAlertLevel(0, 100_000), null);
    assert.equal(resolveAlertLevel(-1, 100_000), null);
  });

  test('menerima Decimal maupun number', async () => {
    const { resolveAlertLevel } = await load();
    assert.equal(resolveAlertLevel(new Prisma.Decimal(1_000_000), new Prisma.Decimal(800_000)), 'WARNING');
  });
});

describe('anggaran per divisi: realisasi tidak menyimpang dari Laba Rugi', () => {
  // Invarian terpenting seluruh fitur ini. Angka per divisi berasal dari
  // penyaringan baris jurnal yang SAMA dengan Laba Rugi, jadi jika dijumlahkan
  // kembali hasilnya harus persis sama dengan laporan tanpa saringan. Kalau
  // test ini gagal, berarti ada baris yang terhitung dua kali atau justru lolos.
  test('realisasi per divisi + tanpa divisi = laba rugi tanpa saringan', () => {
    const lines: JournalLineRow[] = [
      line('6-6100', 'EXPENSE', 'DEBIT', '400.00', '0.00', 'acc-6100', 'MARKETING'),
      line('6-6200', 'EXPENSE', 'DEBIT', '250.00', '0.00', 'acc-6200', 'MARKETING'),
      line('6-6300', 'EXPENSE', 'DEBIT', '300.00', '0.00', 'acc-6300', 'MANAGER_OPERASIONAL'),
      line('6-6400', 'EXPENSE', 'DEBIT', '50.00', '0.00', 'acc-6400'),
    ];

    const expenseTotal = (rows: JournalLineRow[]) =>
      aggregateBalances(rows)
        .filter((b) => b.type === 'EXPENSE')
        .reduce((acc, b) => acc.plus(b.amount), new Prisma.Decimal(0));

    const unfiltered = expenseTotal(lines);
    assert.equal(unfiltered.toFixed(2), '1000.00');

    const buckets = ['MARKETING', 'MANAGER_OPERASIONAL', null];
    const summed = buckets
      .map((division) => expenseTotal(lines.filter((l) => l.costCenter === division)))
      .reduce((acc, v) => acc.plus(v), new Prisma.Decimal(0));

    assert.equal(summed.toFixed(2), unfiltered.toFixed(2));

    // Setiap baris persis sekali di satu keranjang -- tidak ada yang terhitung
    // dua kali dan tidak ada yang lolos.
    const counted = buckets.reduce(
      (n, division) => n + lines.filter((l) => l.costCenter === division).length,
      0
    );
    assert.equal(counted, lines.length);
  });

  test('baris dengan costCenter berbeda tidak bercampur saat disaring', () => {
    const lines: JournalLineRow[] = [
      line('6-6100', 'EXPENSE', 'DEBIT', '400.00', '0.00', 'acc-6100', 'MARKETING'),
      line('6-6300', 'EXPENSE', 'DEBIT', '300.00', '0.00', 'acc-6300', 'MANAGER_OPERASIONAL'),
    ];
    const marketingOnly = aggregateBalances(lines.filter((l) => l.costCenter === 'MARKETING'));
    assert.equal(marketingOnly.length, 1);
    assert.equal(marketingOnly[0].accountId, 'acc-6100');
    assert.equal(marketingOnly[0].amount.toFixed(2), '400.00');
  });
});
