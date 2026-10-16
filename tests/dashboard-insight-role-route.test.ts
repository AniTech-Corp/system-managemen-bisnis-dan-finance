import assert from 'node:assert/strict';
import { before, describe, mock, test } from 'node:test';
import { NextRequest } from 'next/server';

/**
 * Guard regression untuk tiga role baru. Tidak ada Prisma, LLM, atau request
 * provider sungguhan: tenant guard dan getDashboardInsight diisolasi dengan
 * fixture supaya test hanya membuktikan fail-closed route contract.
 */
describe('GET /api/v1/brain/dashboard-insight: role baru tidak fallback ke CEO', { concurrency: false }, () => {
  let currentEmail = 'sekretaris@klir.id';
  let insightCalls = 0;
  let insightGET: typeof import('../src/app/api/v1/brain/dashboard-insight/route')['GET'];

  before(async () => {
    mock.module('../src/lib/tenant-guard', {
      namedExports: {
        authenticateTenantRequest: async () => ({
          auth: {
            user: { id: 'u-role', email: currentEmail, fullName: 'Role Baru', isSuperAdmin: false },
            workspace: { id: 'ws-role', name: 'Workspace Test', slug: 'workspace-test', ownerId: 'owner-1' },
            membership: { role: 'MEMBER', divisionRole: null, isOwner: false },
            grants: [],
          },
        }),
      },
    });
    mock.module('../src/lib/ai-brain/dashboard-insight', {
      namedExports: {
        getDashboardInsight: async () => {
          insightCalls += 1;
          throw new Error('getDashboardInsight tidak boleh dipanggil untuk role unsupported');
        },
      },
    });
    ({ GET: insightGET } = await import('../src/app/api/v1/brain/dashboard-insight/route'));
  });

  async function request(role: string) {
    return insightGET(new NextRequest(`https://klir.test/api/v1/brain/dashboard-insight?role=${role}`));
  }

  test('alias role baru langsung 403 dengan INSIGHT_UNSUPPORTED', async () => {
    for (const role of ['sekretaris', 'manager', 'manager_umum', 'operasional', 'manager_operasional']) {
      const response = await request(role);
      const json = await response.json();
      assert.equal(response.status, 403, `role ${role} harus ditolak`);
      assert.equal(json.success, false);
      assert.equal(json.error.code, 'INSIGHT_UNSUPPORTED');
    }
    assert.equal(insightCalls, 0, 'provider insight tidak boleh dipanggil untuk role baru');
  });

  test('akun role baru tidak dapat menyamarkan diri sebagai CEO lewat query', async () => {
    currentEmail = 'sekretaris@klir.id';
    const response = await request('ceo');
    const json = await response.json();
    assert.equal(response.status, 403);
    assert.equal(json.error.code, 'INSIGHT_UNSUPPORTED');
    assert.equal(insightCalls, 0);
  });
});
