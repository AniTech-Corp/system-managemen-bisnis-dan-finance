import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// KLIR -- Persetujuan pengeluaran berjenjang (9 Sep 2026, approval-berjenjang)
// src/lib/ai-brain/spending-approval-guardrail.ts
// src/app/api/v1/purchasing/approvals/route.ts
//
// Fokus test: (1) evaluasi ambang murni (evaluateSpendingApproval), (2) tiket
// tersimpan sebagai ActivityEvent PURCHASING_APPROVAL_REQUESTED, (3) role check
// DUA LAPIS -- guard endpoint (minRole MANAGER) + per-tiket (requiredMinRole
// tiket, bisa ADMIN kalau nominal >=Rp20jt), (4) isolasi tenant saat resolve,
// (5) tiket yang gagal di-resolve (role kurang / not found) TETAP PENDING.
//
// Pola: in-memory fake Prisma proxy, sama filosofi dengan
// tests/purchase-orders.test.ts (proxy $transaction bentuk-callback + delegate
// method per model). ActivityEvent di sini disimpan di array (bukan Map)
// supaya urutan createdAt gampang dikontrol untuk sorting desc.
// Jalankan: node --experimental-test-module-mocks --import tsx --test
// ---------------------------------------------------------------------------

function jsonRequest(url: string, token: string, method: 'GET' | 'POST', body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

type RoleName = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

describe('approval-berjenjang: spending-approval-guardrail + purchasing/approvals', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;

  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let guardrail: typeof import('../src/lib/ai-brain/spending-approval-guardrail');
  let approvalsGET: typeof import('../src/app/api/v1/purchasing/approvals/route')['GET'];
  let approvalsPOST: typeof import('../src/app/api/v1/purchasing/approvals/route')['POST'];

  type WorkspaceFixture = {
    id: string; name: string; slug: string; ownerId: string;
    members: Array<{ role: RoleName }>;
    resourceGrants: Array<{ resource: string; action: string }>;
  };

  type ActivityEventRow = {
    id: string; workspaceId: string; userId: string | null; type: string; payload: any; createdAt: string;
  };

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let activityEvents: ActivityEventRow[];
  let seq: number;

  const fakePrisma = new Proxy({}, {
    get(_target, prop: string) {
      if (prop === 'then') return undefined;
      if (prop === '$transaction') {
        return async (arg: any) => {
          if (Array.isArray(arg)) return Promise.all(arg);
          if (typeof arg === 'function') return arg(fakePrisma);
          throw new Error('Unsupported $transaction arg shape in test fixture');
        };
      }
      if (prop === '$executeRaw') return async () => 0;
      if (prop.startsWith('$')) return async () => { throw new Error(`Forbidden Prisma operation: ${prop}`); };
      return new Proxy({}, {
        get(_delegate, operation: string) {
          if (operation === 'then') return undefined;
          return async (query: any) => {
            const method = `${prop}.${operation}`;
            if (method === 'user.findUnique') return users.get(query.where?.id ?? '') ?? null;
            if (method === 'workspace.findUnique') {
              const found = workspaces.get(query.where?.id ?? '');
              return found
                ? { id: found.id, name: found.name, slug: found.slug, ownerId: found.ownerId, members: found.members, resourceGrants: found.resourceGrants }
                : null;
            }
            if (method === 'activityEvent.create') {
              seq += 1;
              const id = `ae-${seq}`;
              // createdAt monoton naik per create (bukan Date.now() asli) supaya
              // orderBy desc di getPendingSpendingApprovals() deterministik walau
              // beberapa create terjadi dalam milidetik yang sama.
              const record: ActivityEventRow = {
                id,
                workspaceId: query.data.workspaceId,
                userId: query.data.userId ?? null,
                type: query.data.type,
                payload: query.data.payload,
                createdAt: new Date(2026, 8, 9, 0, 0, seq).toISOString(),
              };
              activityEvents.push(record);
              return record;
            }
            if (method === 'activityEvent.findMany') {
              let rows = activityEvents.filter((e) => e.workspaceId === query.where?.workspaceId);
              if (query.where?.type) rows = rows.filter((e) => e.type === query.where.type);
              rows = rows.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
              const take = query.take ?? rows.length;
              return rows.slice(0, take);
            }
            throw new Error(`Forbidden Prisma operation in test fixture: ${method}`);
          };
        },
      });
    },
  });

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'spending-approval-tests-only-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    guardrail = await import('../src/lib/ai-brain/spending-approval-guardrail');
    ({ GET: approvalsGET, POST: approvalsPOST } = await import('../src/app/api/v1/purchasing/approvals/route'));
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    activityEvents = [];
    seq = 0;
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  // Satu workspace, satu user dengan role tertentu (owner = ownerId === userId,
  // non-owner = 1 entri di members[]). Pola ditiru dari tests/purchase-orders.test.ts.
  function seedTenant(idSuffix: string, role: RoleName) {
    const ownerId = `owner-${idSuffix}`;
    const userId = role === 'OWNER' ? ownerId : `user-${idSuffix}`;
    const wsId = `ws-${idSuffix}`;
    users.set(ownerId, { id: ownerId, email: `${ownerId}@example.invalid`, fullName: `Owner ${idSuffix}`, isSuperAdmin: false });
    if (userId !== ownerId) {
      users.set(userId, { id: userId, email: `${userId}@example.invalid`, fullName: `Test ${role} ${idSuffix}`, isSuperAdmin: false });
    }
    workspaces.set(wsId, {
      id: wsId, name: `Toko ${idSuffix}`, slug: `toko-${idSuffix}`, ownerId,
      members: userId === ownerId ? [] : [{ role }],
      resourceGrants: [],
    });
    const token = signJwtToken({ userId, workspaceId: wsId });
    return { token, wsId, userId };
  }

  // -------------------------------------------------------------------------
  // 1. evaluateSpendingApproval -- fungsi murni, tidak butuh DB
  // -------------------------------------------------------------------------
  test('evaluateSpendingApproval: di bawah Rp5jt -> tidak butuh approval', () => {
    const r = guardrail.evaluateSpendingApproval(4_999_999);
    assert.equal(r.requiresApproval, false);
    assert.equal(r.requiredMinRole, null);
  });

  test('evaluateSpendingApproval: Rp5jt s.d. <Rp20jt -> butuh minimal MANAGER', () => {
    const r1 = guardrail.evaluateSpendingApproval(5_000_000);
    assert.equal(r1.requiresApproval, true);
    assert.equal(r1.requiredMinRole, 'MANAGER');
    const r2 = guardrail.evaluateSpendingApproval(19_999_999);
    assert.equal(r2.requiredMinRole, 'MANAGER');
  });

  test('evaluateSpendingApproval: >=Rp20jt -> butuh minimal ADMIN', () => {
    const r = guardrail.evaluateSpendingApproval(20_000_000);
    assert.equal(r.requiresApproval, true);
    assert.equal(r.requiredMinRole, 'ADMIN');
    const r2 = guardrail.evaluateSpendingApproval(50_000_000);
    assert.equal(r2.requiredMinRole, 'ADMIN');
  });

  // -------------------------------------------------------------------------
  // 2. createSpendingApprovalRequest
  // -------------------------------------------------------------------------
  test('createSpendingApprovalRequest: nominal di bawah ambang -> Error, tidak menulis ActivityEvent', async () => {
    await assert.rejects(
      () => guardrail.createSpendingApprovalRequest({
        workspaceId: 'ws-x', requesterId: 'u1', requesterName: 'Budi', requesterRole: 'MEMBER',
        amount: 1_000_000, category: 'Pembelian Stok', description: 'Beli ATK',
      }),
      /di bawah ambang approval/
    );
    assert.equal(activityEvents.length, 0);
  });

  test('createSpendingApprovalRequest: nominal Rp10jt -> tiket PENDING requiredMinRole MANAGER, tersimpan sebagai ActivityEvent', async () => {
    const req = await guardrail.createSpendingApprovalRequest({
      workspaceId: 'ws-x', requesterId: 'u1', requesterName: 'Budi', requesterRole: 'MEMBER',
      amount: 10_000_000, category: 'Pembelian Stok', description: 'Beli bahan baku bulanan',
    });
    assert.equal(req.status, 'PENDING');
    assert.equal(req.requiredMinRole, 'MANAGER');
    assert.equal(req.amount, 10_000_000);
    assert.equal(activityEvents.length, 1);
    assert.equal(activityEvents[0].type, 'PURCHASING_APPROVAL_REQUESTED');
    assert.equal(activityEvents[0].workspaceId, 'ws-x');
  });

  // -------------------------------------------------------------------------
  // 3. getPendingSpendingApprovals + resolveSpendingApprovalRequest (lib-level)
  // -------------------------------------------------------------------------
  test('resolveSpendingApprovalRequest: role tidak cukup -> ROLE_INSUFFICIENT, tiket TETAP pending', async () => {
    const req = await guardrail.createSpendingApprovalRequest({
      workspaceId: 'ws-y', requesterId: 'u2', requesterName: 'Sari', requesterRole: 'MEMBER',
      amount: 25_000_000, category: 'Pembelian Stok', description: 'Beli mesin baru',
    });
    assert.equal(req.requiredMinRole, 'ADMIN');

    const result = await guardrail.resolveSpendingApprovalRequest({
      requestId: req.id, workspaceId: 'ws-y', decision: 'APPROVED',
      resolverId: 'mgr-1', resolverName: 'Manager Toni', resolverRole: 'MANAGER',
    });
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.code, 'ROLE_INSUFFICIENT');

    const stillPending = await guardrail.getPendingSpendingApprovals('ws-y');
    assert.equal(stillPending.length, 1, 'tiket harus tetap PENDING karena approval ditolak sistem (role kurang)');
    assert.equal(stillPending[0].id, req.id);
  });

  test('resolveSpendingApprovalRequest: role cukup (ADMIN approve tiket >=Rp20jt) -> APPROVED, hilang dari daftar pending', async () => {
    const req = await guardrail.createSpendingApprovalRequest({
      workspaceId: 'ws-z', requesterId: 'u3', requesterName: 'Dedi', requesterRole: 'MEMBER',
      amount: 30_000_000, category: 'Pembelian Stok', description: 'Beli kendaraan operasional',
    });

    const result = await guardrail.resolveSpendingApprovalRequest({
      requestId: req.id, workspaceId: 'ws-z', decision: 'APPROVED',
      resolverId: 'admin-1', resolverName: 'Admin Wati', resolverRole: 'ADMIN',
    });
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.request.status, 'APPROVED');
      assert.equal(result.request.resolvedBy, 'Admin Wati');
    }

    const pendingAfter = await guardrail.getPendingSpendingApprovals('ws-z');
    assert.equal(pendingAfter.length, 0, 'tiket sudah resolved, tidak lagi muncul di daftar pending');
  });

  test('resolveSpendingApprovalRequest: requestId tidak ada -> NOT_FOUND', async () => {
    const result = await guardrail.resolveSpendingApprovalRequest({
      requestId: 'spa-tidak-ada', workspaceId: 'ws-manapun', decision: 'APPROVED',
      resolverId: 'admin-1', resolverName: 'Admin Wati', resolverRole: 'ADMIN',
    });
    assert.equal(result.success, false);
    if (!result.success) assert.equal(result.code, 'NOT_FOUND');
  });

  // -------------------------------------------------------------------------
  // 4. Route: GET /api/v1/purchasing/approvals
  // -------------------------------------------------------------------------
  test('GET: VIEWER bisa lihat daftar tiket pending workspace sendiri', async () => {
    const { token, wsId } = seedTenant('viewer-list', 'VIEWER');
    await guardrail.createSpendingApprovalRequest({
      workspaceId: wsId, requesterId: 'u-req', requesterName: 'Staff A', requesterRole: 'MEMBER',
      amount: 8_000_000, category: 'Pembelian Stok', description: 'Restock gudang',
    });

    const req = jsonRequest(`https://klir.test/api/v1/purchasing/approvals?workspaceId=${wsId}`, token, 'GET');
    const res = await approvalsGET(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].amount, 8_000_000);
  });

  // -------------------------------------------------------------------------
  // 5. Route: POST /api/v1/purchasing/approvals -- resolve
  // -------------------------------------------------------------------------
  test('POST: MEMBER coba resolve -> 403 dari tenant guard (minRole MANAGER), tiket tidak tersentuh', async () => {
    const { token, wsId } = seedTenant('member-blocked', 'MEMBER');
    const ticket = await guardrail.createSpendingApprovalRequest({
      workspaceId: wsId, requesterId: 'u-req', requesterName: 'Staff A', requesterRole: 'MEMBER',
      amount: 8_000_000, category: 'Pembelian Stok', description: 'Restock gudang',
    });

    const req = jsonRequest(`https://klir.test/api/v1/purchasing/approvals?workspaceId=${wsId}`, token, 'POST', {
      requestId: ticket.id, decision: 'APPROVED',
    });
    const res = await approvalsPOST(req, {} as any);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, 'INSUFFICIENT_ROLE');

    const stillPending = await guardrail.getPendingSpendingApprovals(wsId);
    assert.equal(stillPending.length, 1, 'tiket tidak boleh ke-resolve sama sekali oleh MEMBER');
  });

  test('POST: MANAGER approve tiket MANAGER-tier (Rp10jt) -> 200 APPROVED', async () => {
    const { token, wsId } = seedTenant('manager-ok', 'MANAGER');
    const ticket = await guardrail.createSpendingApprovalRequest({
      workspaceId: wsId, requesterId: 'u-req', requesterName: 'Staff A', requesterRole: 'MEMBER',
      amount: 10_000_000, category: 'Pembelian Stok', description: 'Beli bahan baku',
    });

    const req = jsonRequest(`https://klir.test/api/v1/purchasing/approvals?workspaceId=${wsId}`, token, 'POST', {
      requestId: ticket.id, decision: 'APPROVED',
    });
    const res = await approvalsPOST(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.status, 'APPROVED');
  });

  test('POST: MANAGER coba approve tiket ADMIN-tier (Rp25jt) -> 403 ROLE_INSUFFICIENT dari lapis kedua', async () => {
    const { token, wsId } = seedTenant('manager-blocked-admin-tier', 'MANAGER');
    const ticket = await guardrail.createSpendingApprovalRequest({
      workspaceId: wsId, requesterId: 'u-req', requesterName: 'Staff A', requesterRole: 'MEMBER',
      amount: 25_000_000, category: 'Pembelian Stok', description: 'Beli mesin baru',
    });

    const req = jsonRequest(`https://klir.test/api/v1/purchasing/approvals?workspaceId=${wsId}`, token, 'POST', {
      requestId: ticket.id, decision: 'APPROVED',
    });
    const res = await approvalsPOST(req, {} as any);
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.match(body.message, /ADMIN/);

    const stillPending = await guardrail.getPendingSpendingApprovals(wsId);
    assert.equal(stillPending.length, 1, 'tiket ADMIN-tier tidak boleh ke-approve oleh MANAGER');
  });

  test('POST: OWNER approve tiket ADMIN-tier (Rp25jt) -> 200 APPROVED (OWNER > ADMIN di hierarki)', async () => {
    const { token, wsId } = seedTenant('owner-ok', 'OWNER');
    const ticket = await guardrail.createSpendingApprovalRequest({
      workspaceId: wsId, requesterId: 'u-req', requesterName: 'Staff A', requesterRole: 'MEMBER',
      amount: 25_000_000, category: 'Pembelian Stok', description: 'Beli mesin baru',
    });

    const req = jsonRequest(`https://klir.test/api/v1/purchasing/approvals?workspaceId=${wsId}`, token, 'POST', {
      requestId: ticket.id, decision: 'APPROVED',
    });
    const res = await approvalsPOST(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'APPROVED');
  });

  test('POST: decision REJECTED oleh MANAGER pada tiket MANAGER-tier -> 200 REJECTED', async () => {
    const { token, wsId } = seedTenant('manager-reject', 'MANAGER');
    const ticket = await guardrail.createSpendingApprovalRequest({
      workspaceId: wsId, requesterId: 'u-req', requesterName: 'Staff A', requesterRole: 'MEMBER',
      amount: 6_000_000, category: 'Pembelian Stok', description: 'Beli barang mencurigakan',
    });

    const req = jsonRequest(`https://klir.test/api/v1/purchasing/approvals?workspaceId=${wsId}`, token, 'POST', {
      requestId: ticket.id, decision: 'REJECTED',
    });
    const res = await approvalsPOST(req, {} as any);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.data.status, 'REJECTED');
  });

  test('POST: requestId kosong -> 400', async () => {
    const { token, wsId } = seedTenant('bad-request-missing-id', 'MANAGER');
    const req = jsonRequest(`https://klir.test/api/v1/purchasing/approvals?workspaceId=${wsId}`, token, 'POST', {
      decision: 'APPROVED',
    });
    const res = await approvalsPOST(req, {} as any);
    assert.equal(res.status, 400);
  });

  test('POST: decision bukan APPROVED/REJECTED -> 400', async () => {
    const { token, wsId } = seedTenant('bad-request-bad-decision', 'MANAGER');
    const ticket = await guardrail.createSpendingApprovalRequest({
      workspaceId: wsId, requesterId: 'u-req', requesterName: 'Staff A', requesterRole: 'MEMBER',
      amount: 10_000_000, category: 'Pembelian Stok', description: 'Beli bahan baku',
    });
    const req = jsonRequest(`https://klir.test/api/v1/purchasing/approvals?workspaceId=${wsId}`, token, 'POST', {
      requestId: ticket.id, decision: 'MUNGKIN',
    });
    const res = await approvalsPOST(req, {} as any);
    assert.equal(res.status, 400);
  });

  test('POST: requestId milik workspace lain -> 404 (isolasi tenant), tiket korban tetap pending', async () => {
    const { wsId: wsVictim } = seedTenant('victim-tenant', 'MANAGER');
    const { token: attackerToken } = seedTenant('attacker-tenant', 'OWNER');
    const victimTicket = await guardrail.createSpendingApprovalRequest({
      workspaceId: wsVictim, requesterId: 'u-req', requesterName: 'Staff Victim', requesterRole: 'MEMBER',
      amount: 10_000_000, category: 'Pembelian Stok', description: 'Punya tenant lain',
    });

    const req = jsonRequest('https://klir.test/api/v1/purchasing/approvals', attackerToken, 'POST', {
      requestId: victimTicket.id, decision: 'APPROVED',
    });
    const res = await approvalsPOST(req, {} as any);
    assert.equal(res.status, 404);

    const stillPendingVictim = await guardrail.getPendingSpendingApprovals(wsVictim);
    assert.equal(stillPendingVictim.length, 1, 'tiket tenant korban tidak boleh ke-resolve oleh tenant lain');
  });
});
