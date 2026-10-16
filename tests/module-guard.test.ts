import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';

// Bukti untuk src/lib/module-guard.ts (gating role-vs-modul KLIR, subagent
// gating-module-guard-page). Pola prisma mock sama dengan tests/activity-log.test.ts:
// globalThis.prisma HARUS diset SEBELUM src/lib/prisma.ts pertama kali di-import,
// jadi module-guard.ts (yang meng-import prisma.ts) di-import secara dinamis di sini.
describe('module-guard: isModuleEnabled + getEnabledModules', { concurrency: false }, () => {
  const globalPrisma = globalThis as typeof globalThis & { prisma?: unknown };
  let previousPrisma: PropertyDescriptor | undefined;
  let originalWarn: typeof console.warn;
  let warnCalls: unknown[][];
  let findUniqueResult: { enabledModules: string[] | null } | null;
  let shouldThrow: boolean;

  let isModuleEnabled: typeof import('../src/lib/module-guard')['isModuleEnabled'];
  let getEnabledModules: typeof import('../src/lib/module-guard')['getEnabledModules'];
  let KLIR_MODULE_KEYS: typeof import('../src/lib/module-guard')['KLIR_MODULE_KEYS'];
  let DEFAULT_ENABLED_MODULES: typeof import('../src/lib/module-guard')['DEFAULT_ENABLED_MODULES'];

  const fakePrisma = {
    workspace: {
      findUnique: async (_args: { where: { id: string }; select?: unknown }) => {
        if (shouldThrow) throw new Error('simulated DB failure');
        return findUniqueResult;
      },
    },
  };

  before(async () => {
    previousPrisma = Object.getOwnPropertyDescriptor(globalPrisma, 'prisma');
    Object.defineProperty(globalPrisma, 'prisma', { value: fakePrisma, writable: true, configurable: true });
    originalWarn = console.warn;
    ({ isModuleEnabled, getEnabledModules, KLIR_MODULE_KEYS, DEFAULT_ENABLED_MODULES } = await import('../src/lib/module-guard'));
  });

  beforeEach(() => {
    warnCalls = [];
    shouldThrow = false;
    findUniqueResult = null;
    console.warn = (...args: unknown[]) => { warnCalls.push(args); };
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  after(() => {
    if (previousPrisma) Object.defineProperty(globalPrisma, 'prisma', previousPrisma);
    else delete globalPrisma.prisma;
  });

  test('KLIR_MODULE_KEYS berisi 7 kunci sesuai default schema.prisma Workspace.enabledModules', () => {
    assert.deepEqual(
      [...KLIR_MODULE_KEYS],
      ['corplan', 'personal', 'finance', 'advertising', 'workspace', 'schedule', 'inventory']
    );
    assert.deepEqual([...DEFAULT_ENABLED_MODULES], [...KLIR_MODULE_KEYS]);
  });

  test('isModuleEnabled: fail-open kalau array null', () => {
    assert.equal(isModuleEnabled(null, 'finance'), true);
  });

  test('isModuleEnabled: fail-open kalau array undefined', () => {
    assert.equal(isModuleEnabled(undefined, 'inventory'), true);
  });

  test('isModuleEnabled: fail-open kalau array kosong', () => {
    assert.equal(isModuleEnabled([], 'corplan'), true);
  });

  test('isModuleEnabled: blokir kalau array tidak include key', () => {
    assert.equal(isModuleEnabled(['corplan', 'finance'], 'advertising'), false);
  });

  test('isModuleEnabled: izinkan kalau array include key', () => {
    assert.equal(isModuleEnabled(['corplan', 'finance'], 'finance'), true);
  });

  test('getEnabledModules: kembalikan enabledModules asli dari DB', async () => {
    findUniqueResult = { enabledModules: ['corplan', 'finance'] };
    const result = await getEnabledModules('ws-1');
    assert.deepEqual(result, ['corplan', 'finance']);
  });

  test('getEnabledModules: fallback DEFAULT_ENABLED_MODULES kalau workspace tidak ditemukan', async () => {
    findUniqueResult = null;
    const result = await getEnabledModules('ws-missing');
    assert.deepEqual(result, [...DEFAULT_ENABLED_MODULES]);
  });

  test('getEnabledModules: fallback DEFAULT_ENABLED_MODULES kalau enabledModules kosong di DB', async () => {
    findUniqueResult = { enabledModules: [] };
    const result = await getEnabledModules('ws-empty');
    assert.deepEqual(result, [...DEFAULT_ENABLED_MODULES]);
  });

  test('getEnabledModules: fallback DEFAULT_ENABLED_MODULES + console.warn kalau query Prisma gagal (disimulasikan, bukan DB asli)', async () => {
    shouldThrow = true;
    const result = await getEnabledModules('ws-error');
    assert.deepEqual(result, [...DEFAULT_ENABLED_MODULES]);
    assert.equal(warnCalls.length, 1);
    assert.match(String(warnCalls[0][0]), /Gagal membaca enabledModules/);
  });
});
