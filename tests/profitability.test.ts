import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { AccountType, Prisma } from '@prisma/client';
import {
  NO_PROJECT,
  buildSnapshot,
  buildTrend,
  groupByDivision,
  groupByProject,
  summarizeLines,
  type ProfitLineRow,
  type ProjectMeta,
} from '../src/lib/accounting/profitability';
import { NO_DIVISION } from '../src/lib/accounting/budget-divisions';
import { resolveProjectDimensionInTx } from '../src/lib/accounting/posting';
import { JournalValidationError } from '../src/lib/accounting/journal-service';

function pl(
  code: string,
  type: AccountType,
  debit: string,
  credit: string,
  options: {
    costCenter?: string | null;
    projectId?: string | null;
    date?: Date;
  } = {}
): ProfitLineRow {
  return {
    costCenter: options.costCenter ?? null,
    projectId: options.projectId ?? null,
    debit: new Prisma.Decimal(debit),
    credit: new Prisma.Decimal(credit),
    account: { code, type },
    entry: { entryDate: options.date ?? new Date('2026-11-05T03:00:00.000Z') },
  };
}

const PROJECTS = new Map<string, ProjectMeta>([
  [
    'p-a',
    {
      id: 'p-a',
      code: 'PRJ-A',
      name: 'Proyek Alpha',
      clientName: 'PT Alpha',
      division: 'FINANCE',
      status: 'ACTIVE',
      startDate: null,
      endDate: null,
    },
  ],
  [
    'p-b',
    {
      id: 'p-b',
      code: 'PRJ-B',
      name: 'Proyek Beta',
      clientName: null,
      division: 'MARKETING',
      status: 'ACTIVE',
      startDate: null,
      endDate: null,
    },
  ],
]);

function revenue(amount: string, options: Parameters<typeof pl>[4] = {}): ProfitLineRow {
  return pl('4-1100', AccountType.REVENUE, '0.00', amount, options);
}

function expense(code: string, amount: string, options: Parameters<typeof pl>[4] = {}): ProfitLineRow {
  return pl(code, AccountType.EXPENSE, amount, '0.00', options);
}

describe('profitability: rekonsiliasi divisi', () => {
  test('total semua divisi + Tanpa Divisi sama dengan total Laba Rugi', () => {
    const lines = [
      revenue('1000.00', { costCenter: 'FINANCE' }),
      expense('5-1100', '400.00', { costCenter: 'FINANCE' }),
      revenue('500.00', { costCenter: 'MARKETING' }),
      expense('6-1100', '200.00', { costCenter: 'MARKETING' }),
      expense('6-9000', '150.00'),
    ];

    const totals = summarizeLines(lines);
    const divisions = groupByDivision(lines);
    const sumRevenue = divisions.reduce((acc, row) => acc.plus(row.revenue), new Prisma.Decimal(0));
    const sumCost = divisions.reduce((acc, row) => acc.plus(row.totalCost), new Prisma.Decimal(0));

    assert.equal(sumRevenue.toFixed(2), totals.revenue.toFixed(2));
    assert.equal(sumCost.toFixed(2), totals.totalCost.toFixed(2));
    assert.equal(totals.profit.toFixed(2), '750.00');
  });

  test('baris tanpa divisi tetap tampil sebagai Tanpa Divisi, bukan ditebak', () => {
    const lines = [revenue('900.00'), expense('6-1100', '100.00')];
    const divisions = groupByDivision(lines);
    const untagged = divisions.find((row) => row.key === NO_DIVISION);

    assert.ok(untagged);
    assert.equal(untagged.revenue.toFixed(2), '900.00');
    assert.equal(untagged.totalCost.toFixed(2), '100.00');
    assert.equal(untagged.label, 'Tanpa Divisi');
  });

  test('overhead bersama tidak dianggap biaya divisi dan tidak merusak peringkat', () => {
    const lines = [
      revenue('1000.00', { costCenter: 'FINANCE' }),
      expense('5-1100', '200.00', { costCenter: 'FINANCE' }),
      revenue('500.00', { costCenter: 'MARKETING' }),
      expense('6-1100', '700.00', { costCenter: 'MARKETING' }),
      expense('6-9000', '900.00'),
    ];

    const divisions = groupByDivision(lines);
    const finance = divisions.find((row) => row.key === 'FINANCE')!;
    const marketing = divisions.find((row) => row.key === 'MARKETING')!;
    const untagged = divisions.find((row) => row.key === NO_DIVISION)!;

    assert.equal(finance.profit.toFixed(2), '800.00');
    assert.equal(marketing.profit.toFixed(2), '-200.00');
    assert.equal(untagged.profit.toFixed(2), '-900.00');

    assert.equal(finance.isMostProfitable, true);
    assert.equal(marketing.isHighestCost, true);
    assert.equal(untagged.isHighestCost, false);
    assert.equal(untagged.isMostProfitable, false);
    assert.equal(finance.costRank, 2);
    assert.equal(marketing.costRank, 1);
  });

  test('laba negatif tidak pernah dilabeli Paling Untung', () => {
    const lines = [
      revenue('100.00', { costCenter: 'FINANCE' }),
      expense('6-1100', '300.00', { costCenter: 'FINANCE' }),
    ];
    const finance = groupByDivision(lines).find((row) => row.key === 'FINANCE')!;
    assert.equal(finance.profit.toFixed(2), '-200.00');
    assert.equal(finance.isMostProfitable, false);
  });

  test('snapshot memberi peringatan saat pendapatan/biaya belum ditandai', () => {
    const lines = [revenue('1000.00'), expense('6-9000', '250.00')];
    const snapshot = buildSnapshot(
      {
        startDate: new Date('2026-11-01T00:00:00.000Z'),
        endDate: new Date('2026-11-30T23:59:59.999Z'),
      },
      lines,
      PROJECTS
    );

    assert.equal(snapshot.totals.profit.toFixed(2), '750.00');
    assert.ok(snapshot.warnings.some((warning) => warning.includes('belum ditandai divisi')));
    assert.ok(snapshot.warnings.some((warning) => warning.includes('belum ditandai proyek')));
  });
});

describe('profitability: laba langsung per proyek', () => {
  test('laba proyek hanya memuat biaya yang ditandai ke proyek itu', () => {
    const lines = [
      revenue('1000.00', { projectId: 'p-a', costCenter: 'FINANCE' }),
      expense('5-1100', '400.00', { projectId: 'p-a', costCenter: 'FINANCE' }),
      revenue('500.00', { projectId: 'p-b', costCenter: 'MARKETING' }),
      expense('5-1100', '700.00', { projectId: 'p-b', costCenter: 'MARKETING' }),
      expense('6-9000', '300.00'),
    ];

    const projects = groupByProject(lines, PROJECTS);
    const alpha = projects.find((row) => row.key === 'p-a')!;
    const beta = projects.find((row) => row.key === 'p-b')!;
    const untagged = projects.find((row) => row.key === NO_PROJECT)!;

    assert.equal(alpha.label, 'Proyek Alpha');
    assert.equal(alpha.code, 'PRJ-A');
    assert.equal(alpha.profit.toFixed(2), '600.00');
    assert.equal(beta.profit.toFixed(2), '-200.00');
    assert.equal(untagged.profit.toFixed(2), '-300.00');

    // Overhead 300 TIDAK dialokasikan ke Alpha maupun Beta.
    assert.equal(alpha.totalCost.toFixed(2), '400.00');
    assert.equal(beta.totalCost.toFixed(2), '700.00');
  });

  test('baris tanpa proyek menjadi Tanpa Proyek dan tidak ikut peringkat', () => {
    const lines = [revenue('500.00'), expense('6-9000', '100.00')];
    const projects = groupByProject(lines, PROJECTS);
    const untagged = projects.find((row) => row.key === NO_PROJECT);

    assert.ok(untagged);
    assert.equal(untagged.label, 'Tanpa Proyek');
    assert.equal(untagged.profitRank, null);
    assert.equal(untagged.costRank, null);
  });
});

describe('profitability: validasi dimensi proyek', () => {
  function txWithProject(project: { id: string; name: string; division: string | null; status: string } | null) {
    return {
      project: {
        findFirst: async () => project,
      },
    } as unknown as Prisma.TransactionClient;
  }

  test('tanpa proyek hanya menormalisasi divisi, tidak menebak proyek', async () => {
    const tx = txWithProject(null);
    const result = await resolveProjectDimensionInTx(tx, 'ws-1', null, ' finance ');
    assert.deepEqual(result, { projectId: null, division: 'FINANCE' });
  });

  test('divisi mengikuti proyek bila transaksi tidak memilih divisi', async () => {
    const tx = txWithProject({ id: 'p-a', name: 'Proyek Alpha', division: 'MARKETING', status: 'ACTIVE' });
    const result = await resolveProjectDimensionInTx(tx, 'ws-1', 'p-a', null);
    assert.deepEqual(result, { projectId: 'p-a', division: 'MARKETING' });
  });

  test('divisi yang bertentangan dengan proyek ditolak', async () => {
    const tx = txWithProject({ id: 'p-a', name: 'Proyek Alpha', division: 'MARKETING', status: 'ACTIVE' });
    await assert.rejects(
      () => resolveProjectDimensionInTx(tx, 'ws-1', 'p-a', 'FINANCE'),
      (error: unknown) =>
        error instanceof JournalValidationError && error.message.includes('berbeda dengan divisi proyek')
    );
  });

  test('proyek yang diarsipkan tidak bisa dipakai transaksi baru', async () => {
    const tx = txWithProject({ id: 'p-a', name: 'Proyek Alpha', division: null, status: 'ARCHIVED' });
    await assert.rejects(
      () => resolveProjectDimensionInTx(tx, 'ws-1', 'p-a', null),
      (error: unknown) =>
        error instanceof JournalValidationError && error.message.includes('sudah diarsipkan')
    );
  });

  test('proyek dari workspace lain dianggap tidak ditemukan', async () => {
    const tx = txWithProject(null);
    await assert.rejects(
      () => resolveProjectDimensionInTx(tx, 'ws-1', 'p-lain', null),
      (error: unknown) =>
        error instanceof JournalValidationError && error.message.includes('tidak ditemukan')
    );
  });
});

describe('profitability: tren bulanan', () => {
  test('membagi laba ke bulan WIB yang benar dan mengisi bulan kosong', () => {
    const lines = [
      revenue('1000.00', { date: new Date('2026-11-05T03:00:00.000Z') }),
      expense('6-1100', '200.00', { date: new Date('2026-10-05T03:00:00.000Z') }),
    ];

    const trend = buildTrend(lines, 2026, 11, 3);
    assert.deepEqual(
      trend.months.map((month) => month.period),
      ['2026-09', '2026-10', '2026-11']
    );

    assert.equal(trend.months[0].profit.toFixed(2), '0.00');
    assert.equal(trend.months[1].profit.toFixed(2), '-200.00');
    assert.equal(trend.months[2].profit.toFixed(2), '1000.00');
  });

  test('trend per divisi memakai label divisi dan tidak mencampur unit lain', () => {
    const lines = [
      revenue('1000.00', { costCenter: 'FINANCE', date: new Date('2026-11-05T03:00:00.000Z') }),
      expense('6-1100', '250.00', { costCenter: 'MARKETING', date: new Date('2026-11-06T03:00:00.000Z') }),
    ];

    const trend = buildTrend(lines, 2026, 11, 1);
    const finance = trend.divisions.find((division) => division.key === 'FINANCE');
    const marketing = trend.divisions.find((division) => division.key === 'MARKETING');

    assert.ok(finance);
    assert.equal(finance.label, 'Finance');
    assert.equal(finance.months[0].profit.toFixed(2), '1000.00');
    assert.ok(marketing);
    assert.equal(marketing.months[0].profit.toFixed(2), '-250.00');
  });
});
