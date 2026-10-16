import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLocalRoleDashboardDemo } from '../src/lib/local-role-dashboard-demo';
import { parseRoleDashboardPayload, type RoleDashboardRole } from '../src/lib/role-dashboard-contract';

const roles: RoleDashboardRole[] = [
  'CEO',
  'FINANCE',
  'MARKETING',
  'MANAGER_UMUM',
  'MANAGER_OPERASIONAL',
  'SEKRETARIS',
];

test('demo localhost menyediakan angka valid untuk seluruh enam role', () => {
  for (const role of roles) {
    const payload = buildLocalRoleDashboardDemo(role, '2026-09-13T00:00:00.000Z');
    const parsed = parseRoleDashboardPayload(payload, role);
    assert.equal(parsed.ok, true, `payload ${role} harus lolos kontrak dashboard`);
    assert.ok(payload.cards.some((card) => card.status === 'available' && card.value !== null), `${role} harus punya angka demo`);
    assert.match(payload.notice || '', /sistem KLIR|Demo Localhost/);
  }
});

test('demo Finance tidak mengaktifkan perpajakan', () => {
  const payload = buildLocalRoleDashboardDemo('FINANCE');
  const tax = payload.cards.find((card) => card.id === 'tax-compliance');
  assert.equal(tax?.status, 'unsupported');
  assert.equal(tax?.value, null);
  assert.match(tax?.detail || '', /belum tersedia/i);
  assert.ok(!payload.cards.some((card) => ['pph-final', 'ppn-collected', 'sp2dk-risk'].includes(card.id)));
});

test('demo Finance memakai jumlah invoice yang sama dengan fixture FinanceModuleView', () => {
  const payload = buildLocalRoleDashboardDemo('FINANCE');
  const receivable = payload.cards.find((card) => card.id === 'kasbon-active');
  assert.equal(receivable?.value, 8_450_000);
  assert.match(receivable?.detail || '', /8 pelanggan memiliki saldo piutang/);
  assert.match(payload.insight?.recommendations[0]?.reason || '', /piutang/);
});
