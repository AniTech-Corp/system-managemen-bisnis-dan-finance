import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  canRoleUseCapability,
  canRoleUseScopedCapability,
  filterNextActionsForRole,
  isFinancialActionType,
  mediaBackendRoleForDivision,
} from '../src/lib/ai-brain/role-policy';

describe('role-policy: role baru fail-closed', () => {
  test('capability riset/forecast tidak terbuka untuk Sekretaris dan Manager Operasional', () => {
    assert.equal(canRoleUseCapability('SEKRETARIS', 'research'), false);
    assert.equal(canRoleUseCapability('MANAGER_OPERASIONAL', 'research'), false);
    assert.equal(canRoleUseCapability('MANAGER_OPERASIONAL', 'inventory'), true);
  });

  test('Manager hanya boleh memakai scope lokal jika scope authoritative terbukti', () => {
    assert.equal(canRoleUseScopedCapability('MANAGER_UMUM', 'local_research'), false);
    assert.equal(canRoleUseScopedCapability('MANAGER_UMUM', 'local_research', { hasAuthoritativeTeamScope: true }), true);
    assert.equal(canRoleUseScopedCapability('MANAGER_UMUM', 'forecast', { hasAuthoritativeTeamScope: true }), false);
  });

  test('financial action dikenali dan mapping media tetap memakai kontrak backend lama', () => {
    assert.equal(isFinancialActionType('create_invoice'), true);
    assert.equal(isFinancialActionType('video'), false);
    assert.equal(mediaBackendRoleForDivision('SEKRETARIS'), 'executive');
    assert.equal(mediaBackendRoleForDivision('MANAGER_UMUM'), 'executive');
    assert.equal(mediaBackendRoleForDivision('MANAGER_OPERASIONAL'), 'executive');
  });

  test('next action domain Finance/riset dibuang untuk role baru tetapi media/dokumen tetap ada', () => {
    const actions = [
      { kind: 'import-ledger', id: 'ledger' },
      { kind: 'riset', id: 'research' },
      { kind: 'prediksi', id: 'forecast' },
      { kind: 'lokasi', id: 'location' },
      { kind: 'image', id: 'image' },
      { kind: 'video', id: 'video' },
      { kind: 'word', id: 'word' },
    ];
    assert.deepEqual(
      filterNextActionsForRole(actions, 'SEKRETARIS').map((action) => action.kind),
      ['image', 'video', 'word'],
    );
    assert.equal(filterNextActionsForRole(actions, 'FINANCE').length, actions.length);
  });
});
