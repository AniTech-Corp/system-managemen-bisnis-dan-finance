import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import {
  consumeInitialPrompt,
  INITIAL_PROMPT_STORAGE_KEY,
  INITIAL_PROMPT_TTL_MS,
  writeInitialPrompt,
} from '../src/lib/initial-prompt-storage';

const store = new Map<string, string>();
const windowStub = {
  sessionStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
  },
};

describe('initial prompt storage: typed one-time cross-role handoff', () => {
  before(() => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: windowStub });
  });

  after(() => {
    store.clear();
    Reflect.deleteProperty(globalThis, 'window');
  });

  test('menulis envelope role-aware dan consume hanya sekali', () => {
    const now = 1_000_000;
    assert.equal(writeInitialPrompt('FINANCE', '  Cek invoice jatuh tempo  ', now), true);
    const envelope = JSON.parse(store.get(INITIAL_PROMPT_STORAGE_KEY) || '{}');
    assert.equal(envelope.targetRole, 'FINANCE');
    assert.equal(envelope.prompt, 'Cek invoice jatuh tempo');
    assert.equal(envelope.createdAt, now);
    assert.ok(envelope.nonce);

    assert.equal(consumeInitialPrompt('FINANCE', now + 100), 'Cek invoice jatuh tempo');
    assert.equal(consumeInitialPrompt('FINANCE', now + 200), null);
  });

  test('role lain tidak mengambil prompt yang bukan miliknya', () => {
    const now = 2_000_000;
    writeInitialPrompt('MANAGER_OPERASIONAL', 'Buka stok kritis', now);
    assert.equal(consumeInitialPrompt('MARKETING', now + 100), null);
    assert.ok(store.has(INITIAL_PROMPT_STORAGE_KEY));
    assert.equal(consumeInitialPrompt('MANAGER_OPERASIONAL', now + 100), 'Buka stok kritis');
  });

  test('prompt expired dan payload malformed dibuang, bukan dipakai', () => {
    const now = 3_000_000;
    writeInitialPrompt('CEO', 'Analisis runway', now);
    assert.equal(consumeInitialPrompt('CEO', now + INITIAL_PROMPT_TTL_MS + 1), null);
    assert.equal(store.has(INITIAL_PROMPT_STORAGE_KEY), false);

    store.set(INITIAL_PROMPT_STORAGE_KEY, '{broken json');
    assert.equal(consumeInitialPrompt('CEO', now), null);
    assert.equal(store.has(INITIAL_PROMPT_STORAGE_KEY), false);
  });
});
