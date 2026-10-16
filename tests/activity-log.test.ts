import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

// recordActivity harus non-fatal (pola sama dengan recordCompanyKnowledge di
// src/lib/ai-brain/company-memory.ts): gagal cukup console.warn, TIDAK PERNAH
// throw ke caller, dan tidak pernah menambah model/kolom baru di luar
// ActivityEvent yang sudah ada di prisma/schema.prisma.
describe('activity-log: recordActivity', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let originalWarn: typeof console.warn;
  let creates: Array<{ data: unknown }>;
  let warnCalls: unknown[][];
  let shouldThrow: boolean;
  let recordActivity: typeof import('../src/lib/activity-log')['recordActivity'];

  const fakePrisma = {
    activityEvent: {
      create: async (args: { data: unknown }) => {
        if (shouldThrow) throw new Error('simulated DB failure');
        creates.push(args);
        return { id: `evt-${creates.length}`, ...(args.data as object) };
      },
    },
  };

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    // globalThis.prisma HARUS diset SEBELUM src/lib/prisma.ts pertama kali di-import --
    // modul itu meng-eksekusi `globalForPrisma.prisma ?? new PrismaClient()` di top level
    // saat import pertama, jadi activity-log.ts (yang meng-import prisma.ts) WAJIB
    // di-import secara dinamis di sini, BUKAN static import di atas file test ini.
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    originalWarn = console.warn;
    ({ recordActivity } = await import('../src/lib/activity-log'));
  });

  beforeEach(() => {
    creates = [];
    warnCalls = [];
    shouldThrow = false;
    console.warn = (...args: unknown[]) => { warnCalls.push(args); };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
  });

  test('mencatat activity event dengan workspaceId, userId, type dan payload yang diberikan', async () => {
    await recordActivity('ws-1', 'user-1', 'media.generate', { kind: 'image' });
    assert.equal(creates.length, 1);
    assert.deepEqual(creates[0].data, { workspaceId: 'ws-1', userId: 'user-1', type: 'media.generate', payload: { kind: 'image' } });
  });

  test('userId null diterima (kolom optional di schema)', async () => {
    await recordActivity('ws-1', null, 'brain.notebook_generate', { kind: 'quiz' });
    assert.equal(creates.length, 1);
    assert.equal((creates[0].data as { userId: unknown }).userId, null);
  });

  test('payload default kosong kalau tidak diberikan', async () => {
    await recordActivity('ws-1', 'user-1', 'documents.from_template_generate');
    assert.deepEqual((creates[0].data as { payload: unknown }).payload, {});
  });

  test('workspaceId kosong/whitespace: tidak menulis apapun, tidak throw, cukup warn', async () => {
    await assert.doesNotReject(recordActivity('   ', 'user-1', 'media.generate'));
    assert.equal(creates.length, 0);
    assert.equal(warnCalls.length, 1);
  });

  test('type kosong/whitespace: tidak menulis apapun, tidak throw, cukup warn', async () => {
    await assert.doesNotReject(recordActivity('ws-1', 'user-1', '  '));
    assert.equal(creates.length, 0);
    assert.equal(warnCalls.length, 1);
  });

  test('kegagalan Prisma non-fatal: tidak throw ke caller, cukup console.warn', async () => {
    shouldThrow = true;
    await assert.doesNotReject(recordActivity('ws-1', 'user-1', 'media.generate', { kind: 'image' }));
    assert.equal(creates.length, 0);
    assert.equal(warnCalls.length, 1);
    assert.match(String(warnCalls[0][0]), /gagal mencatat activity event/);
  });
});
