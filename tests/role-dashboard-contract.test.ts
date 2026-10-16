import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRoleDashboardPayload } from '../src/lib/role-dashboard-contract';

const validPayload = {
  role: 'MANAGER_OPERASIONAL',
  status: 'available',
  generatedAt: '2026-09-13T00:00:00.000Z',
  cards: [
    {
      id: 'critical-stock',
      label: 'Stok kritis',
      value: 3,
      status: 'available',
      detail: '3 SKU berada di bawah minimum.',
      source: 'Product.currentStock/minStock',
    },
  ],
  snapshot: [],
  series: [],
  insight: {
    status: 'empty',
    summary: 'Belum ada insight',
    explanation: 'Data belum cukup.',
    recommendations: [],
    sources: [],
  },
};

test('parser menerima payload role dashboard yang lengkap dan array kosong', () => {
  const result = parseRoleDashboardPayload(validPayload);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.data.role, 'MANAGER_OPERASIONAL');
    assert.deepEqual(result.data.snapshot, []);
    assert.deepEqual(result.data.series, []);
  }
});

test('parser menolak nilai non-finite dan struktur invalid tanpa throw', () => {
  const result = parseRoleDashboardPayload({
    ...validPayload,
    cards: [{ ...validPayload.cards[0], value: Number.NaN }],
  });
  assert.equal(result.ok, false);

  const missingCards = parseRoleDashboardPayload({ ...validPayload, cards: undefined });
  assert.equal(missingCards.ok, false);

  const wrongRole = parseRoleDashboardPayload({ ...validPayload, role: 'OWNER' });
  assert.equal(wrongRole.ok, false);

  const mismatchedRole = parseRoleDashboardPayload(validPayload, 'FINANCE');
  assert.equal(mismatchedRole.ok, false);
});
