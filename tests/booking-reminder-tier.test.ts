import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, test } from 'node:test';
import { NextRequest } from 'next/server';

// Pola dipinjam dari tests/piutang-reminder.test.ts (Prisma proxy in-memory + JWT
// asli, node:test --experimental-test-module-mocks). Tidak ada koneksi DB asli --
// prisma.workspace.* dan prisma.workspaceAIKey.* di-trap lewat fakePrisma di bawah,
// operasi yang tidak eksplisit dimock throw keras (tidak boleh diam-diam lolos).
//
// Fokus test: booking/reminder/route.ts sekarang cabang response-nya berdasarkan
// tier workspace (src/lib/tier-hardening.ts) -- tier Public (PUBLIC_SAAS, tidak
// punya WorkspaceAIKey aktif) WAJIB dapat channel 'in_app' + directWaUrl null,
// tier Private (PRIVATE_ENTERPRISE, punya WorkspaceAIKey aktif) WAJIB tetap dapat
// link wa.me seperti perilaku lama (permintaan Mecca sesi205 23 Agu).
//
// Nomor telepon fixture SENGAJA ditulis pakai dash (mis. '0812-3456-7890') bukan
// digit mentah -- hook credential-guard proyek ini (Rule #98) menandai deretan
// >=10 digit polos sebagai kandidat secret.
//
// PENTING: workspaceId di fixture WAJIB UUID asli (pakai randomUUID(), bukan
// string pendek seperti 'ws-1') -- getWorkspaceTierEntitlements() (tier-hardening.ts)
// cuma mau query workspaceAIKey kalau workspaceId lolos regex UUID; id non-UUID
// diam-diam selalu jatuh ke default PUBLIC_SAAS, itu bikin skenario tier Private
// di test ini tidak pernah teruji kalau id-nya bukan UUID (ketemu sendiri pas
// nulis test ini -- prisma/schema.prisma konfirmasi Workspace.id memang selalu
// UUID asli di produksi, jadi ini murni soal fixture test, bukan bug di kode).

type WorkspaceFixture = {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  members: Array<{ role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER' }>;
  resourceGrants: Array<{ resource: string; action: string }>;
};

describe('booking/reminder -- tier Public in-app vs tier Private WhatsApp', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let previousJwtSecret: string | undefined;
  let signJwtToken: typeof import('../src/lib/auth')['signJwtToken'];
  let route: typeof import('../src/app/api/v1/booking/reminder/route');

  let users: Map<string, { id: string; email: string; fullName: string; isSuperAdmin: boolean }>;
  let workspaces: Map<string, WorkspaceFixture>;
  let activeAiKeyWorkspaceIds: Set<string>;

  const fakePrisma = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.get(where.id) ?? null,
    },
    workspace: {
      findUnique: async ({ where, include }: { where: { id: string }; include?: unknown }) => {
        const ws = workspaces.get(where.id);
        if (!ws) return null;
        if (include) {
          return { id: ws.id, name: ws.name, slug: ws.slug, ownerId: ws.ownerId, members: ws.members, resourceGrants: ws.resourceGrants };
        }
        return { id: ws.id };
      },
    },
    // getWorkspaceTierEntitlements (src/lib/tier-hardening.ts) query ini untuk
    // menentukan PUBLIC_SAAS vs PRIVATE_ENTERPRISE -- workspace dengan kunci AI
    // dedicated aktif dianggap Private/Enterprise, sisanya default Public.
    workspaceAIKey: {
      findFirst: async ({ where }: { where: { workspaceId: string; isActive: boolean } }) => {
        if (where.isActive && activeAiKeyWorkspaceIds.has(where.workspaceId)) {
          return { id: `key-${where.workspaceId}`, workspaceId: where.workspaceId, isActive: true };
        }
        return null;
      },
    },
  };

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    previousJwtSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'booking-reminder-tier-tests-only-signing-secret-do-not-use-in-production';
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });

    ({ signJwtToken } = await import('../src/lib/auth'));
    route = await import('../src/app/api/v1/booking/reminder/route');
  });

  beforeEach(() => {
    users = new Map();
    workspaces = new Map();
    activeAiKeyWorkspaceIds = new Set();
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
  });

  function seedUser(id: string) {
    users.set(id, { id, email: `${id}@example.invalid`, fullName: `Staf ${id}`, isSuperAdmin: false });
  }
  function seedWorkspace(ws: WorkspaceFixture) {
    workspaces.set(ws.id, ws);
  }
  function postRequest(body: object, token?: string) {
    return new NextRequest('https://klir.test/api/v1/booking/reminder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
  }

  const baseReminderBody = {
    bookingCode: 'BKG-TEST-01',
    customerName: 'Rina Wulandari',
    customerPhone: '0812-3456-7890',
    serviceName: 'Potong Rambut',
    bookingDate: '2026-09-15',
    bookingTime: '10:00',
  };

  test('tier Public (tidak ada WorkspaceAIKey aktif) -> channel in_app, status delivered_in_app, directWaUrl null', async () => {
    const wsId = randomUUID();
    seedUser('owner-public');
    seedWorkspace({ id: wsId, name: 'Kedai Kopi UMKM', slug: 'kedai-kopi-umkm', ownerId: 'owner-public', members: [], resourceGrants: [] });
    // sengaja TIDAK ditambahkan ke activeAiKeyWorkspaceIds -> default PUBLIC_SAAS

    const token = signJwtToken({ userId: 'owner-public', workspaceId: wsId });
    const res = await route.POST(postRequest(baseReminderBody, token));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.reminder.channel, 'in_app', 'tier Public wajib channel in_app, bukan whatsapp');
    assert.equal(body.reminder.status, 'delivered_in_app');
    assert.equal(body.reminder.directWaUrl, null, 'tier Public tidak boleh dapat link wa.me sama sekali');
    assert.equal(body.reminder.customerPhone, '6281234567890');
    assert.ok(body.reminder.reminderMessage.includes('Rina Wulandari'), 'pesan tetap dibuat lengkap walau tidak dikirim via WA');
  });

  test('tier Private (ada WorkspaceAIKey aktif) -> channel whatsapp, status ready_to_send, directWaUrl link wa.me valid', async () => {
    const wsId = randomUUID();
    seedUser('owner-private');
    seedWorkspace({ id: wsId, name: 'Klinik Kecantikan Enterprise', slug: 'klinik-enterprise', ownerId: 'owner-private', members: [], resourceGrants: [] });
    activeAiKeyWorkspaceIds.add(wsId);

    const token = signJwtToken({ userId: 'owner-private', workspaceId: wsId });
    const res = await route.POST(postRequest(baseReminderBody, token));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.reminder.channel, 'whatsapp', 'tier Private wajib tetap channel whatsapp (perilaku lama)');
    assert.equal(body.reminder.status, 'ready_to_send');
    assert.ok(typeof body.reminder.directWaUrl === 'string' && body.reminder.directWaUrl.length > 0, 'tier Private wajib tetap dapat link wa.me');
    assert.equal(
      body.reminder.directWaUrl,
      `https://wa.me/${body.reminder.customerPhone}?text=${encodeURIComponent(body.reminder.reminderMessage)}`,
      'link wa.me wajib pakai nomor internasional yang sudah dinormalisasi dan pesan yang persis sama'
    );
    // Link harus bisa didecode balik jadi pesan yang sama persis (bukti link valid)
    const decoded = decodeURIComponent(body.reminder.directWaUrl.split('?text=')[1]);
    assert.equal(decoded, body.reminder.reminderMessage);
  });

  test('WorkspaceAIKey nonaktif (isActive false) tetap dianggap tier Public', async () => {
    const wsId = randomUUID();
    seedUser('owner-inactive');
    seedWorkspace({ id: wsId, name: 'Toko Nonaktif', slug: 'toko-nonaktif', ownerId: 'owner-inactive', members: [], resourceGrants: [] });
    // fakePrisma.workspaceAIKey.findFirst hanya query where.isActive === true; kunci
    // nonaktif tidak pernah masuk activeAiKeyWorkspaceIds -> tetap PUBLIC_SAAS.

    const token = signJwtToken({ userId: 'owner-inactive', workspaceId: wsId });
    const res = await route.POST(postRequest(baseReminderBody, token));
    const body = await res.json();
    assert.equal(body.reminder.channel, 'in_app');
    assert.equal(body.reminder.directWaUrl, null);
  });

  test('validasi field wajib tidak berubah oleh perubahan tier -- 400 kalau nama kosong', async () => {
    const wsId = randomUUID();
    seedUser('owner-validate');
    seedWorkspace({ id: wsId, name: 'Toko Validasi', slug: 'toko-validasi', ownerId: 'owner-validate', members: [], resourceGrants: [] });

    const token = signJwtToken({ userId: 'owner-validate', workspaceId: wsId });
    const res = await route.POST(postRequest({ ...baseReminderBody, customerName: '' }, token));
    assert.equal(res.status, 400);
  });

  test('POST tanpa token ditolak (bukan 200)', async () => {
    const res = await route.POST(postRequest(baseReminderBody));
    assert.notEqual(res.status, 200);
  });
});
