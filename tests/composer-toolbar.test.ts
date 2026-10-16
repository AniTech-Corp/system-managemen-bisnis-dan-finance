// Test untuk logika MURNI di src/app/components/chat/ComposerToolbar.tsx (B2-toolbar,
// 8 Sep 2026). Sengaja HANYA mengimpor named export fungsi murni (buildBrainModelsUrl,
// filterModelsByQuery, shouldShowImageQualityControl, wrapIndex, withImagePrefs,
// withVideoPrefs, effortEtaLabel, VISIBLE_MODE_CHIPS, EFFORT_LEVELS) -- TIDAK ADA
// render React sama sekali di file ini (tidak butuh jsdom/testing-library, yang
// tidak terpasang di project ini). Mengimpor module ComposerToolbar.tsx tetap AMAN
// untuk node:test polos karena VoiceRecorder (satu-satunya dependency yang menyeret
// CSS module) di-lazy-load lewat React.lazy(() => import(...)) di dalam komponen --
// import dynamic itu TIDAK dieksekusi hanya karena modul di-import, hanya saat
// komponen benar-benar dirender dan popover mic dibuka. Dibuktikan dulu lewat probe
// import manual sebelum menulis test ini (lihat laporan B2).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildBrainModelsUrl,
  EFFORT_LEVELS,
  effortEtaLabel,
  filterModelsByQuery,
  filterSlashCommands,
  getVisibleModeChips,
  resolveSttModelParam,
  shouldShowImageQualityControl,
  toggleAssistantMode,
  VISIBLE_MODE_CHIPS,
  withImagePrefs,
  withVideoPrefs,
  wrapIndex,
} from '../src/app/components/chat/ComposerToolbar';
import { DEFAULT_COMPOSER_PREFS, EFFORT_MAP } from '../src/lib/chat-composer-types';
import { SLASH_COMMANDS } from '../src/lib/slash-commands';

describe('VISIBLE_MODE_CHIPS & getVisibleModeChips (Jalur A Role Video Gating)', () => {
  test('cuma 3 chip: chat, image, video -- TIDAK ADA audio (keputusan D-5)', () => {
    const modes = VISIBLE_MODE_CHIPS.map((c) => c.mode);
    assert.deepEqual(modes, ['chat', 'image', 'video']);
    assert.ok(!modes.includes('audio' as never));
  });

  test('label manusiawi Bahasa Indonesia sesuai brief Mecca', () => {
    assert.equal(VISIBLE_MODE_CHIPS.find((c) => c.mode === 'chat')?.label, 'Tanya');
    assert.equal(VISIBLE_MODE_CHIPS.find((c) => c.mode === 'image')?.label, 'Gambar');
    assert.equal(VISIBLE_MODE_CHIPS.find((c) => c.mode === 'video')?.label, 'Video');
  });

  test('getVisibleModeChips(true) menyertakan video', () => {
    const chips = getVisibleModeChips(true).map((c) => c.mode);
    assert.deepEqual(chips, ['chat', 'image', 'video']);
  });

  test('getVisibleModeChips(false) memblokir video dari UI chip', () => {
    const chips = getVisibleModeChips(false).map((c) => c.mode);
    assert.deepEqual(chips, ['chat', 'image']);
    assert.ok(!chips.includes('video'));
  });

  test('filterSlashCommands(commands, false) menyaring keluar command /video', () => {
    const filtered = filterSlashCommands(SLASH_COMMANDS, false);
    assert.ok(filtered.some((c) => c.id === 'gambar'));
    assert.ok(!filtered.some((c) => c.id === 'video'));
    assert.ok(!filtered.some((c) => c.kind === 'mode' && (c.payload as { mode?: string })?.mode === 'video'));
  });

  test('filterSlashCommands(commands, true) mempertahankan /video untuk CEO dan Marketing', () => {
    const kept = filterSlashCommands(SLASH_COMMANDS, true);
    assert.ok(kept.some((c) => c.id === 'video'));
  });
});

describe('EFFORT_LEVELS + effortEtaLabel', () => {
  test('urutan santai -> maksimal, cocok union EffortLevel penuh', () => {
    assert.deepEqual(EFFORT_LEVELS, ['santai', 'normal', 'serius', 'maksimal']);
  });

  test('effortEtaLabel delegasi ke EFFORT_MAP milik B1 (SSOT), tidak hardcode ulang', () => {
    for (const level of EFFORT_LEVELS) {
      assert.equal(effortEtaLabel(level), EFFORT_MAP[level].etaLabel);
    }
  });

  test('effortEtaLabel maksimal persis string yang diminta spesifikasi', () => {
    assert.equal(effortEtaLabel('maksimal'), 'Berpikir keras, bisa sampai 1 menit');
  });
});

describe('buildBrainModelsUrl', () => {
  test('query kosong -> tidak ada param q, cuma limit', () => {
    assert.equal(buildBrainModelsUrl(''), '/api/v1/brain/models?limit=20');
  });

  test('query whitespace-only diperlakukan sama seperti kosong', () => {
    assert.equal(buildBrainModelsUrl('   '), '/api/v1/brain/models?limit=20');
  });

  test('query terisi -> param q ter-trim dan ter-encode', () => {
    assert.equal(buildBrainModelsUrl('  gemini flash  '), '/api/v1/brain/models?q=gemini+flash&limit=20');
  });

  test('limit custom dipakai apa adanya kalau dalam rentang 1..50', () => {
    assert.equal(buildBrainModelsUrl('x', 5), '/api/v1/brain/models?q=x&limit=5');
  });

  test('limit di atas 50 di-clamp ke 50 (selaras cap server B1)', () => {
    assert.equal(buildBrainModelsUrl('x', 999), '/api/v1/brain/models?q=x&limit=50');
  });

  test('limit 0/NaN falsy -> fallback ke default 20 (Math.floor(x) || 20)', () => {
    assert.equal(buildBrainModelsUrl('x', 0), '/api/v1/brain/models?q=x&limit=20');
    assert.equal(buildBrainModelsUrl('x', Number.NaN), '/api/v1/brain/models?q=x&limit=20');
  });

  test('limit negatif (truthy, bukan 0) di-clamp naik ke minimum 1 -- BUKAN fallback ke 20', () => {
    // Math.floor(-5) = -5 -- nilai truthy, jadi `|| 20` TIDAK terpicu (beda dari kasus
    // 0/NaN di atas yang falsy). -5 lanjut ke Math.min(50, -5) = -5, lalu Math.max(1, -5)
    // = 1. Perilaku ini didokumentasikan di sini SUPAYA tidak ada yang mengira negatif
    // otomatis jatuh ke 20 (itu ekspektasi keliru yang sempat ada di draf test ini sendiri).
    assert.equal(buildBrainModelsUrl('x', -5), '/api/v1/brain/models?q=x&limit=1');
  });
});

describe('filterModelsByQuery', () => {
  const models = [
    { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
    { id: 'openai/gpt-5.3-codex', name: 'GPT-5.3 Codex' },
  ];

  test('query kosong mengembalikan seluruh daftar apa adanya', () => {
    assert.deepEqual(filterModelsByQuery(models, ''), models);
  });

  test('cocok substring di id (case-insensitive)', () => {
    const result = filterModelsByQuery(models, 'DEEPSEEK');
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'deepseek/deepseek-r1');
  });

  test('cocok substring di name juga, bukan cuma id', () => {
    const result = filterModelsByQuery(models, 'codex');
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'GPT-5.3 Codex');
  });

  test('tidak ada yang cocok -> array kosong', () => {
    assert.deepEqual(filterModelsByQuery(models, 'zzz-tidak-ada'), []);
  });

  test('tidak memutasi array asli', () => {
    const before = [...models];
    filterModelsByQuery(models, 'gemini');
    assert.deepEqual(models, before);
  });
});

// resolveSttModelParam: dibuat 9 Sep 2026 (agent audio-catalog-search, gap-fix panel
// mic yang dulu cuma toggle boolean capabilities.transcription). Fungsi ini yang
// memutuskan field `model` apa (kalau ada) dikirim ke POST /api/v1/media/transcribe.
describe('resolveSttModelParam (panel mic: pilih model transkripsi)', () => {
  const catalog = [
    { id: 'openai/whisper-large-v3-turbo', provider: 'openrouter' },
    { id: 'deepgram/nova-3', provider: 'openrouter' },
    { id: 'whisper-large-v3-turbo', provider: 'groq' }, // entri sintetis dari GET /media/models?kind=transcription
  ];

  test("'auto' -> undefined (TIDAK mengirim field model sama sekali, pertahankan Groq fast-path lama)", () => {
    assert.equal(resolveSttModelParam('auto', catalog), undefined);
  });

  test('string kosong -> undefined (sama seperti auto, belum ada pilihan)', () => {
    assert.equal(resolveSttModelParam('', catalog), undefined);
  });

  test('id OpenRouter yang genuinely ada di katalog -> dikirim apa adanya', () => {
    assert.equal(resolveSttModelParam('deepgram/nova-3', catalog), 'deepgram/nova-3');
  });

  test('entri Groq (provider !== openrouter) -> undefined, BUKAN id-nya -- kirim id Groq akan gagal validateMediaModel (katalog OpenRouter tidak punya id itu) dan MEMATIKAN Groq fast-path secara tidak sengaja', () => {
    assert.equal(resolveSttModelParam('whisper-large-v3-turbo', catalog), undefined);
  });

  test('id yang sudah tidak ada lagi di katalog (localStorage basi/model di-deprecate provider) -> undefined, bukan dikirim buta', () => {
    assert.equal(resolveSttModelParam('openai/model-sudah-dihapus', catalog), undefined);
  });

  test('katalog kosong (belum ter-fetch / gagal fetch) -> selalu undefined apapun id yang diminta', () => {
    assert.equal(resolveSttModelParam('openai/whisper-large-v3-turbo', []), undefined);
  });
});

describe('shouldShowImageQualityControl (keputusan D-9)', () => {
  test('model undefined/belum dipilih -> false (jangan render kontrol tanpa model konkret)', () => {
    assert.equal(shouldShowImageQualityControl(undefined), false);
    assert.equal(shouldShowImageQualityControl(null), false);
  });

  test('model dengan capabilities.qualities kosong -> false', () => {
    assert.equal(shouldShowImageQualityControl({ capabilities: { qualities: [] } }), false);
  });

  test('model tanpa field qualities sama sekali -> false', () => {
    assert.equal(shouldShowImageQualityControl({ capabilities: {} }), false);
  });

  test('model dengan qualities terisi -> true', () => {
    assert.equal(shouldShowImageQualityControl({ capabilities: { qualities: ['standard', 'hd'] } }), true);
  });
});

describe('wrapIndex (navigasi panah menu slash)', () => {
  test('panah bawah dari index terakhir -> wrap ke 0', () => {
    assert.equal(wrapIndex(2, 1, 3), 0);
  });

  test('panah atas dari index 0 -> wrap ke item terakhir', () => {
    assert.equal(wrapIndex(0, -1, 3), 2);
  });

  test('gerak normal di tengah daftar', () => {
    assert.equal(wrapIndex(1, 1, 3), 2);
    assert.equal(wrapIndex(1, -1, 3), 0);
  });

  test('daftar kosong -> -1 (tidak ada yang bisa di-highlight)', () => {
    assert.equal(wrapIndex(0, 1, 0), -1);
  });
});

// toggleAssistantMode: dibuat 11 Sep 2026 (kontrak modul 3+4, chip composer Belajar/Analis).
describe('toggleAssistantMode (chip Belajar/Analis, 11 Sep 2026)', () => {
  test('dari tanya -> klik belajar -> belajar', () => {
    assert.equal(toggleAssistantMode('tanya', 'belajar'), 'belajar');
  });

  test('dari belajar -> klik belajar lagi -> kembali ke tanya (toggle-off)', () => {
    assert.equal(toggleAssistantMode('belajar', 'belajar'), 'tanya');
  });

  test('dari belajar -> klik analis -> pindah ke analis (bukan tetap belajar)', () => {
    assert.equal(toggleAssistantMode('belajar', 'analis'), 'analis');
  });

  test('dari riset (disinkronkan tombol Riset) -> klik analis -> pindah ke analis, bukan toggle-off', () => {
    assert.equal(toggleAssistantMode('riset', 'analis'), 'analis');
  });
});

describe('withImagePrefs / withVideoPrefs (merge murni, tanpa mutasi)', () => {
  test('withImagePrefs mengubah field image saja, tidak menyentuh field lain', () => {
    const next = withImagePrefs(DEFAULT_COMPOSER_PREFS, { model: 'flux-pro', aspectRatio: '16:9' });
    assert.equal(next.image.model, 'flux-pro');
    assert.equal(next.image.aspectRatio, '16:9');
    assert.equal(next.video, DEFAULT_COMPOSER_PREFS.video);
    assert.equal(next.mode, DEFAULT_COMPOSER_PREFS.mode);
  });

  test('withImagePrefs tidak memutasi objek prefs asli', () => {
    const before = JSON.stringify(DEFAULT_COMPOSER_PREFS);
    withImagePrefs(DEFAULT_COMPOSER_PREFS, { model: 'lain' });
    assert.equal(JSON.stringify(DEFAULT_COMPOSER_PREFS), before);
  });

  test('withVideoPrefs mengubah field video saja, TIDAK PERNAH menambah field quality (D-9)', () => {
    const next = withVideoPrefs(DEFAULT_COMPOSER_PREFS, { resolution: '1080p', durationSeconds: 8 });
    assert.equal(next.video.resolution, '1080p');
    assert.equal(next.video.durationSeconds, 8);
    assert.equal(next.image, DEFAULT_COMPOSER_PREFS.image);
    assert.ok(!('quality' in next.video));
  });

  test('withVideoPrefs tidak memutasi objek prefs asli', () => {
    const before = JSON.stringify(DEFAULT_COMPOSER_PREFS);
    withVideoPrefs(DEFAULT_COMPOSER_PREFS, { resolution: '4k' });
    assert.equal(JSON.stringify(DEFAULT_COMPOSER_PREFS), before);
  });
});
