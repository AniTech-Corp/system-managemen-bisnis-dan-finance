import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  cashTransactionSnapshot,
  invoiceSnapshot,
  projectSnapshot,
  recordAuditInTx,
} from '../src/lib/audit/audit-trail';
import {
  assertCashTransactionStandalone,
  assertJournalReversible,
  assertPeriodWritableForDate,
  MutationGuardError,
} from '../src/lib/accounting/mutation-guards';

describe('audit-trail: snapshot dan penulisan audit', () => {
  test('snapshot kas menyimpan nilai aktual dan menormalkan tanggal ke ISO', () => {
    const snapshot = cashTransactionSnapshot({
      id: 'tx-1',
      userId: 'user-1',
      type: 'EXPENSE',
      category: 'Operasional',
      amount: 1250000,
      description: 'Bayar listrik',
      transactionDate: new Date('2026-10-03T04:00:00.000Z'),
      paymentMethod: 'TRANSFER_BANK',
      division: 'FINANCE',
      projectId: null,
      invoiceId: null,
      obligationId: 'obl-1',
      payrollId: null,
      settlementAccountId: null,
      sourceFileId: null,
    });

    assert.equal(snapshot.amount, 1250000);
    assert.equal(snapshot.obligationId, 'obl-1');
    assert.equal(snapshot.transactionDate, '2026-10-03T04:00:00.000Z');
    assert.equal(snapshot.description, 'Bayar listrik');
  });

  test('recordAuditInTx menyimpan before/after, daftar field berubah, dan alasan', async () => {
    const rows: any[] = [];
    const tx = {
      auditLog: {
        create: async ({ data }: any) => {
          rows.push(data);
          return data;
        },
      },
    } as any;

    await recordAuditInTx(tx, {
      workspaceId: 'ws-1',
      userId: 'user-1',
      action: 'UPDATE',
      entityType: 'CASH_TRANSACTION',
      entityId: 'tx-1',
      before: { amount: 1000, description: 'Salah input', status: 'ACTIVE' },
      after: { amount: 2000, description: 'Salah input', status: 'ACTIVE' },
      reason: '  Nominal salah input  ',
      metadata: { source: 'correction_form' },
    });

    assert.equal(rows.length, 1);
    assert.equal(rows[0].workspaceId, 'ws-1');
    assert.equal(rows[0].userId, 'user-1');
    assert.equal(rows[0].action, 'UPDATE');
    assert.equal(rows[0].entityType, 'CASH_TRANSACTION');
    assert.equal(rows[0].entityId, 'tx-1');
    assert.equal(rows[0].reason, 'Nominal salah input');
    assert.deepEqual(rows[0].changes.diff, ['amount']);
    assert.equal(rows[0].changes.before.amount, 1000);
    assert.equal(rows[0].changes.after.amount, 2000);
    assert.equal(rows[0].metadata.source, 'correction_form');
  });

  test('alasan audit dipotong 2000 karakter agar tidak membebani database', async () => {
    const rows: any[] = [];
    const tx = {
      auditLog: {
        create: async ({ data }: any) => {
          rows.push(data);
          return data;
        },
      },
    } as any;

    await recordAuditInTx(tx, {
      workspaceId: 'ws-1',
      userId: 'user-1',
      action: 'DELETE',
      entityType: 'CASH_TRANSACTION',
      entityId: 'tx-1',
      before: { amount: 1 },
      after: null,
      reason: 'x'.repeat(2500),
    });

    assert.equal(rows[0].reason.length, 2000);
  });

  test('snapshot faktur tidak membawa email/telepon pelanggan', () => {
    const snapshot = invoiceSnapshot({
      id: 'inv-1',
      invoiceNumber: 'INV-001',
      clientName: 'PT Klien',
      status: 'PAID',
      subtotal: 1000000,
      taxRate: 11,
      taxAmount: 110000,
      totalAmount: 1110000,
      paidAmount: 1110000,
      issueDate: new Date('2026-10-01T00:00:00.000Z'),
      dueDate: new Date('2026-10-31T00:00:00.000Z'),
      paidAt: new Date('2026-10-10T00:00:00.000Z'),
      partnerId: 'partner-1',
      termDays: 30,
      division: 'SALES',
      projectId: 'proj-1',
      itemCount: 2,
    });

    assert.equal(snapshot.totalAmount, 1110000);
    assert.equal(snapshot.itemCount, 2);
    assert.equal((snapshot as any).clientEmail, undefined);
    assert.equal((snapshot as any).clientPhone, undefined);
  });

  test('guard periode menolak perubahan di periode tertutup', async () => {
    const tx = {
      fiscalPeriod: {
        findUnique: async () => ({ status: 'CLOSED' }),
      },
    } as any;
    await assert.rejects(() => assertPeriodWritableForDate(tx, 'ws-1', new Date('2026-10-15')), {
      message: /Periode sudah closed/i,
    });
  });

  test('guard periode melewati bila periode belum ada', async () => {
    const tx = { fiscalPeriod: { findUnique: async () => null } } as any;
    await assertPeriodWritableForDate(tx, 'ws-1', new Date('2026-10-15'));
  });

  test('guard periode menolak periode terkunci', async () => {
    const tx = { fiscalPeriod: { findUnique: async () => ({ status: 'LOCKED' }) } } as any;
    await assert.rejects(() => assertPeriodWritableForDate(tx, 'ws-1', new Date('2026-10-15')), {
      message: /Periode sudah locked/i,
    });
  });

  test('guard transaksi kas standalone menolak transaksi terintegrasi', async () => {
    const tx = {
      fiscalPeriod: { findUnique: async () => null },
      paymentAllocation: { findFirst: async () => null },
    } as any;
    await assert.rejects(() => assertCashTransactionStandalone(tx, 'ws-1', {
      id: 'tx-1',
      invoiceId: 'inv-1',
      obligationId: null,
      payrollId: null,
      settlementAccountId: null,
    }));
  });

  test('guard transaksi kas standalone melewati untuk transaksi standalone', async () => {
    const tx = {
      fiscalPeriod: { findUnique: async () => null },
      paymentAllocation: { findFirst: async () => null },
    } as any;
    await assertCashTransactionStandalone(tx, 'ws-1', {
      id: 'tx-1',
      invoiceId: null,
      obligationId: null,
      payrollId: null,
      settlementAccountId: null,
    });
  });

  test('guard transaksi kas standalone menolak bila sudah dialokasikan', async () => {
    const tx = {
      fiscalPeriod: { findUnique: async () => null },
      paymentAllocation: { findFirst: async () => ({ id: 'alloc' }) },
    } as any;
    await assert.rejects(() => assertCashTransactionStandalone(tx, 'ws-1', {
      id: 'tx-1',
      invoiceId: null,
      obligationId: null,
      payrollId: null,
      settlementAccountId: null,
    }));
  });

  test('guard jurnal pembalikan hanya menerima jurnal POSTED yang belum dibalik', async () => {
    const tx = {
      journalEntry: {
        findFirst: async ({ where: { id, workspaceId } }: any) => {
          if (id === 'posted') return { status: 'POSTED', reversedBy: null };
          if (id === 'reversed') return { status: 'POSTED', reversedBy: 'orig' };
          if (id === 'draft') return { status: 'DRAFT', reversedBy: null };
          return null;
        },
      },
    } as any;
    await assertJournalReversible(tx, 'ws-1', 'posted');
    await assert.rejects(() => assertJournalReversible(tx, 'ws-1', 'reversed'), /sudah pernah dibalik/i);
    await assert.rejects(() => assertJournalReversible(tx, 'ws-1', 'draft'), /Hanya jurnal yang sudah diposting/);
  });
});
