import assert from 'node:assert/strict';
import { after, afterEach, before, describe, test } from 'node:test';
import { DEFAULT_COMPOSER_PREFS, type ComposerPrefs } from '../src/lib/chat-composer-types';

// chat-composer-prefs.ts: baca/tulis ComposerPrefs di localStorage per-workspace.
// Dibuat 8 Sep 2026 (agent B1-lib-katalog-prefs). Test ini memverifikasi 3 sifat
// yang diminta eksplisit di spesifikasi: (1) aman SSR (window undefined tidak
// throw), (2) tahan corrupt (JSON rusak -> fallback default, tidak throw), dan
// (3) isolasi per-workspace (prefs workspace A tidak bocor ke workspace B).
describe('chat-composer-prefs: localStorage read/write aman SSR + corrupt-proof + per-workspace', { concurrency: false }, () => {
  let prefsModule: typeof import('../src/lib/chat-composer-prefs');
  let hadWindow: boolean;
  let originalWindow: unknown;

  before(async () => {
    hadWindow = 'window' in globalThis;
    originalWindow = (globalThis as Record<string, unknown>).window;
    prefsModule = await import('../src/lib/chat-composer-prefs');
  });

  afterEach(() => {
    if (hadWindow) (globalThis as Record<string, unknown>).window = originalWindow;
    else delete (globalThis as Record<string, unknown>).window;
  });

  after(() => {
    if (hadWindow) (globalThis as Record<string, unknown>).window = originalWindow;
    else delete (globalThis as Record<string, unknown>).window;
  });

  function fakeWindow() {
    const store = new Map<string, string>();
    return {
      localStorage: {
        getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
        setItem: (k: string, v: string) => { store.set(k, v); },
        removeItem: (k: string) => { store.delete(k); },
      },
    };
  }

  test('SSR (window undefined) -> readComposerPrefs balikin DEFAULT_COMPOSER_PREFS tanpa throw', () => {
    delete (globalThis as Record<string, unknown>).window;
    const result = prefsModule.readComposerPrefs('ws-ssr');
    assert.deepEqual(result, DEFAULT_COMPOSER_PREFS);
  });

  test('SSR (window undefined) -> writeComposerPrefs no-op, tidak throw', () => {
    delete (globalThis as Record<string, unknown>).window;
    assert.doesNotThrow(() => prefsModule.writeComposerPrefs('ws-ssr', DEFAULT_COMPOSER_PREFS));
  });

  test('localStorage kosong (belum pernah ditulis) -> fallback DEFAULT_COMPOSER_PREFS', () => {
    (globalThis as Record<string, unknown>).window = fakeWindow();
    const result = prefsModule.readComposerPrefs('ws-belum-ada');
    assert.deepEqual(result, DEFAULT_COMPOSER_PREFS);
  });

  test('write lalu read -> nilai persis balik (round-trip)', () => {
    (globalThis as Record<string, unknown>).window = fakeWindow();
    const custom: ComposerPrefs = {
      mode: 'image',
      researchMode: 'competitor', // 8 Sep malam: field tombol Riset
      textModel: 'google/gemini-3.5-flash',
      effort: 'serius',
      image: { model: 'auto', aspectRatio: '1:1' },
      video: { model: 'auto' },
      sttModel: 'openai/whisper-large-v3-turbo', // 9 Sep: field baru audio-catalog-search
      assistantMode: 'analis', // 11 Sep 2026: field baru kontrak modul 3+4
    };
    prefsModule.writeComposerPrefs('ws-a', custom);
    const readBack = prefsModule.readComposerPrefs('ws-a');
    assert.deepEqual(readBack, custom);
  });

  test('prefs workspace A tidak bocor ke workspace B (kunci per-workspace benar-benar terpisah)', () => {
    (globalThis as Record<string, unknown>).window = fakeWindow();
    const custom: ComposerPrefs = { ...DEFAULT_COMPOSER_PREFS, mode: 'video', textModel: 'z-ai/glm-5.2' };
    prefsModule.writeComposerPrefs('ws-a', custom);
    const otherWorkspace = prefsModule.readComposerPrefs('ws-b');
    assert.deepEqual(otherWorkspace, DEFAULT_COMPOSER_PREFS, 'workspace lain wajib tetap default, tidak ikut kebawa prefs ws-a');
  });

  test('JSON corrupt di localStorage -> fallback DEFAULT_COMPOSER_PREFS, tidak throw', () => {
    const win = fakeWindow();
    win.localStorage.setItem('klir_composer_prefs_ws-corrupt', '{ini bukan json valid');
    (globalThis as Record<string, unknown>).window = win;
    assert.doesNotThrow(() => prefsModule.readComposerPrefs('ws-corrupt'));
    const result = prefsModule.readComposerPrefs('ws-corrupt');
    assert.deepEqual(result, DEFAULT_COMPOSER_PREFS);
  });

  test('localStorage berisi objek partial (field baru dari versi lama belum ada) -> di-merge dengan default, tidak crash', () => {
    const win = fakeWindow();
    win.localStorage.setItem('klir_composer_prefs_ws-partial', JSON.stringify({ mode: 'video' }));
    (globalThis as Record<string, unknown>).window = win;
    const result = prefsModule.readComposerPrefs('ws-partial');
    assert.equal(result.mode, 'video');
    assert.equal(result.textModel, DEFAULT_COMPOSER_PREFS.textModel);
    assert.deepEqual(result.image, DEFAULT_COMPOSER_PREFS.image);
    assert.deepEqual(result.video, DEFAULT_COMPOSER_PREFS.video);
    assert.equal(result.sttModel, DEFAULT_COMPOSER_PREFS.sttModel, 'data lama sebelum field sttModel ada -> backfill ke auto, bukan undefined');
  });

  test('localStorage image/video partial (sub-field baru belum ada) -> tetap di-merge dalam objek nested', () => {
    const win = fakeWindow();
    win.localStorage.setItem('klir_composer_prefs_ws-nested', JSON.stringify({ image: { model: 'openai/gpt-image-1' } }));
    (globalThis as Record<string, unknown>).window = win;
    const result = prefsModule.readComposerPrefs('ws-nested');
    assert.equal(result.image.model, 'openai/gpt-image-1');
    assert.equal(result.image.aspectRatio, undefined);
    assert.deepEqual(result.video, DEFAULT_COMPOSER_PREFS.video);
  });

  // FIX 8 Sep 2026 malam (audit Finance): parameter `role` opsional ditambah supaya
  // ComposerPrefs bisa diisolasi per-portal (CEO/Finance/Marketing), bukan cuma
  // per-workspace. Test di bawah memverifikasi 3 sifat: (1) role param benar-benar
  // memisahkan kunci localStorage antar portal untuk workspace yang SAMA, (2) call-site
  // TANPA role (Executive/Marketing yang belum dipatch di putaran ini) tetap dapat
  // perilaku LAMA (backward compatible, tidak ada regresi), (3) role kosong-string vs
  // role undefined sama-sama jatuh ke kunci lama (tidak nyasar bikin kunci ganda tak
  // sengaja lewat falsy check `role ? ... : ''`).
  test('role param mengisolasi prefs antar portal untuk workspace yang sama (fix bug composer-prefs role-bleed)', () => {
    (globalThis as Record<string, unknown>).window = fakeWindow();
    const finPrefs: ComposerPrefs = { ...DEFAULT_COMPOSER_PREFS, mode: 'video', textModel: 'z-ai/glm-5.2' };
    prefsModule.writeComposerPrefs('ws-shared', finPrefs, 'fin');
    const execRead = prefsModule.readComposerPrefs('ws-shared', 'exec');
    const mktRead = prefsModule.readComposerPrefs('ws-shared', 'mkt');
    assert.deepEqual(execRead, DEFAULT_COMPOSER_PREFS, 'Executive wajib TIDAK ikut kebawa prefs video milik Finance');
    assert.deepEqual(mktRead, DEFAULT_COMPOSER_PREFS, 'Marketing wajib TIDAK ikut kebawa prefs video milik Finance');
    const finRead = prefsModule.readComposerPrefs('ws-shared', 'fin');
    assert.deepEqual(finRead, finPrefs, 'Finance sendiri wajib baca balik prefs miliknya sendiri persis sama');
  });

  // 11 Sep 2026 (kontrak modul 3+4, field assistantMode baru): 2 kasus baru dengan pola
  // IDENTIK test sttModel/researchMode di atas -- data lama tanpa field ini backfill ke
  // 'tanya' (default), dan nilai corrupt/tidak dikenal juga jatuh ke 'tanya' (bukan lolos
  // apa adanya ke UI).
  test('localStorage lama tanpa field assistantMode -> backfill ke tanya (default), bukan undefined', () => {
    const win = fakeWindow();
    win.localStorage.setItem('klir_composer_prefs_ws-no-assistant-mode', JSON.stringify({ mode: 'chat' }));
    (globalThis as Record<string, unknown>).window = win;
    const result = prefsModule.readComposerPrefs('ws-no-assistant-mode');
    assert.equal(result.assistantMode, 'tanya');
  });

  test('localStorage berisi assistantMode tidak dikenal (corrupt/union lama) -> fallback tanya, bukan lolos apa adanya', () => {
    const win = fakeWindow();
    win.localStorage.setItem('klir_composer_prefs_ws-bad-assistant-mode', JSON.stringify({ assistantMode: 'mode-yang-tidak-ada' }));
    (globalThis as Record<string, unknown>).window = win;
    const result = prefsModule.readComposerPrefs('ws-bad-assistant-mode');
    assert.equal(result.assistantMode, 'tanya');
  });

  test('write lalu read assistantMode valid (belajar/analis/riset) -> round-trip persis, tidak ikut di-normalize', () => {
    (globalThis as Record<string, unknown>).window = fakeWindow();
    for (const mode of ['belajar', 'analis', 'riset'] as const) {
      const prefs: ComposerPrefs = { ...DEFAULT_COMPOSER_PREFS, assistantMode: mode };
      prefsModule.writeComposerPrefs(`ws-assistant-${mode}`, prefs);
      const readBack = prefsModule.readComposerPrefs(`ws-assistant-${mode}`);
      assert.equal(readBack.assistantMode, mode);
    }
  });

  test('call-site TANPA role (belum dipatch) tetap pakai kunci lama, tidak bentrok dengan call-site BER-role (backward compatible)', () => {
    (globalThis as Record<string, unknown>).window = fakeWindow();
    const legacyPrefs: ComposerPrefs = { ...DEFAULT_COMPOSER_PREFS, mode: 'image', effort: 'santai' };
    prefsModule.writeComposerPrefs('ws-mixed', legacyPrefs);
    const roledRead = prefsModule.readComposerPrefs('ws-mixed', 'fin');
    assert.deepEqual(roledRead, DEFAULT_COMPOSER_PREFS, 'kunci ber-role wajib terpisah dari kunci lama tanpa role');
    const legacyRead = prefsModule.readComposerPrefs('ws-mixed');
    assert.deepEqual(legacyRead, legacyPrefs, 'call-site lama (tanpa role) tetap baca balik nilainya sendiri, tidak regresi');
  });
});
