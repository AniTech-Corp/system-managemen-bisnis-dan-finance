import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  canCorrectCashTransaction,
  getInvoiceDashboardActionState,
  isLinkedCashTransaction,
} from '../src/lib/finance/dashboard-actions';

describe('finance dashboard actions: koreksi kas', () => {
  test('transaksi standalone boleh dikoreksi', () => {
    const tx = { invoiceId: null, obligationId: null, payrollId: null, settlementAccountId: null };
    assert.equal(isLinkedCashTransaction(tx), false);
    assert.equal(canCorrectCashTransaction(tx), true);
  });

  test('transaksi yang terhubung dokumen induk tidak boleh dikoreksi in-place', () => {
    assert.equal(canCorrectCashTransaction({ invoiceId: 'inv-1' }), false);
    assert.equal(canCorrectCashTransaction({ obligationId: 'obl-1' }), false);
    assert.equal(canCorrectCashTransaction({ payrollId: 'pay-1' }), false);
    assert.equal(canCorrectCashTransaction({ settlementAccountId: 'acc-1' }), false);
  });
});

describe('finance dashboard actions: status faktur', () => {
  test('faktur lunas bisa dibuka kembali, bukan dibatalkan langsung', () => {
    const state = getInvoiceDashboardActionState('PAID');
    assert.equal(state.statusLabel, 'Lunas');
    assert.equal(state.canReopen, true);
    assert.equal(state.canCancel, false);
    assert.equal(state.canSendReminder, false);
  });

  test('faktur sebagian bisa ditagih, dibatalkan, atau dibuka pelunasannya', () => {
    const state = getInvoiceDashboardActionState('PARTIAL');
    assert.equal(state.statusLabel, 'Sebagian');
    assert.equal(state.canReopen, true);
    assert.equal(state.canCancel, true);
    assert.equal(state.canSendReminder, true);
  });

  test('faktur batal tidak menawarkan aksi apa pun', () => {
    const state = getInvoiceDashboardActionState('CANCELLED');
    assert.equal(state.statusLabel, 'Dibatalkan');
    assert.equal(state.statusTone, 'slate');
    assert.equal(state.canReopen, false);
    assert.equal(state.canCancel, false);
    assert.equal(state.canSendReminder, false);
  });

  test('faktur belum lunas dan jatuh tempo bisa ditagih serta dibatalkan', () => {
    for (const status of ['UNPAID', 'OVERDUE', 'DRAFT']) {
      const state = getInvoiceDashboardActionState(status);
      assert.equal(state.canCancel, true, `${status} harus bisa dibatalkan`);
      assert.equal(state.canReopen, false, `${status} bukan faktur lunas`);
    }

    const overdue = getInvoiceDashboardActionState('OVERDUE');
    assert.equal(overdue.statusLabel, 'Jatuh Tempo');
    assert.equal(overdue.canSendReminder, true);
  });
});
