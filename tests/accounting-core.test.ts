import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Prisma } from '@prisma/client';
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
  accountId = code
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
