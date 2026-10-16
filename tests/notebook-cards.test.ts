import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { generateNotebook, type NotebookExecutor } from '../src/lib/notebook-engine';
import { extraNotebookCountRanges, type ExtraNotebookKind } from '../src/lib/notebook-cards';
import { MediaError } from '../src/lib/media-errors';
import type { AIGenerateResult } from '../src/lib/ai-gateway';
import type {
  SummaryReportPayload, MindmapPayload, TablePayload, InfographicPayload,
  DeckPayload, AudioOverviewScriptPayload, VideoStoryboardPayload,
} from '../src/lib/notebook-types';

const sourceText = 'Produk kopi tersedia dalam kemasan 250 gram. Harga satu kemasan Rp40.000. Simpan di tempat kering.';
const originalFlag = process.env.MARKETING_NOTEBOOK_ENABLED;
before(() => { delete process.env.MARKETING_NOTEBOOK_ENABLED; });
after(() => {
  if (originalFlag === undefined) delete process.env.MARKETING_NOTEBOOK_ENABLED;
  else process.env.MARKETING_NOTEBOOK_ENABLED = originalFlag;
});

function response(json: unknown, overrides: Partial<AIGenerateResult> = {}): AIGenerateResult {
  return { text: JSON.stringify(json), json, provider: 'groq', modelUsed: 'test-model', latencyMs: 12, ...overrides };
}

function isMediaError(code: string) {
  return (error: unknown) => error instanceof MediaError && error.code === code;
}

function summaryReport(count: number): SummaryReportPayload {
  return {
    title: 'Ringkasan produk', summary: 'Kopi 250 gram, harga Rp40.000, simpan kering.',
    sections: Array.from({ length: count }, (_, i) => ({ id: `s${i + 1}`, heading: `Bagian ${i + 1}`, body: 'Kemasan 250 gram seharga Rp40.000.' })),
  };
}

function mindmap(count: number): MindmapPayload {
  return {
    title: 'Peta produk', root: { id: 'root', label: 'Produk kopi' },
    children: Array.from({ length: count }, (_, i) => ({ id: `n${i + 1}`, label: `Cabang ${i + 1}` })),
  };
}

function table(count: number): TablePayload {
  return {
    title: 'Tabel produk', columns: ['Item', 'Harga'],
    rows: Array.from({ length: count }, (_, i) => [`Kemasan ${i + 1}`, 'Rp40.000']),
  };
}

function infographic(count: number): InfographicPayload {
  return {
    title: 'Infografis produk', caption: 'Ringkasan angka kunci.',
    stats: Array.from({ length: count }, (_, i) => ({ id: `st${i + 1}`, label: `Fakta ${i + 1}`, value: '250 gram' })),
  };
}

function deck(count: number): DeckPayload {
  return {
    title: 'Deck produk',
    slides: Array.from({ length: count }, (_, i) => ({ id: `sl${i + 1}`, heading: `Slide ${i + 1}`, bullets: ['250 gram', 'Rp40.000'] })),
  };
}

function audioOverviewScript(count: number): AudioOverviewScriptPayload {
  return {
    title: 'Naskah audio', speakers: ['Host A', 'Host B'],
    lines: Array.from({ length: count }, (_, i) => ({ id: `l${i + 1}`, speaker: i % 2 === 0 ? 'A' : 'B', text: 'Kemasan 250 gram harga Rp40.000.' })),
  };
}

function videoStoryboard(count: number): VideoStoryboardPayload {
  return {
    title: 'Storyboard produk',
    scenes: Array.from({ length: count }, (_, i) => ({ id: `sc${i + 1}`, sceneNumber: i + 1, description: 'Tampilkan kemasan kopi 250 gram.' })),
  };
}

const factories: Record<ExtraNotebookKind, (count: number) => unknown> = {
  'summary-report': summaryReport,
  mindmap,
  table,
  infographic,
  deck,
  'audio-overview-script': audioOverviewScript,
  'video-storyboard': videoStoryboard,
};

const kinds = Object.keys(factories) as ExtraNotebookKind[];

for (const kind of kinds) {
  const range = extraNotebookCountRanges[kind];
  const factory = factories[kind];

  test(`${kind}: default count and valid payload produce discriminated result`, async () => {
    let calls = 0;
    const result = await generateNotebook({ kind, sourceText }, 'trusted', async options => {
      calls++;
      assert.equal(options.workspaceId, 'trusted');
      assert.equal(options.jsonMode, true);
      assert.match(options.systemInstruction!, /untrusted reference/);
      return response(factory(range.default));
    });
    assert.equal(calls, 1);
    assert.equal(result.kind, kind);
    assert.equal(result.title, (result.payload as { title: string }).title);
    assert.equal(result.provider, 'groq');
  });

  test(`${kind}: count clamp accepts min/max, rejects out of range without invoking provider`, async () => {
    for (const count of [range.min, range.max]) {
      let calls = 0;
      const result = await generateNotebook({ kind, sourceText, count }, 'trusted', async options => {
        calls++;
        return response(factory(count));
      });
      assert.equal(calls, 1);
      assert.equal(result.kind, kind);
    }
    for (const count of [range.min - 1, range.max + 1]) {
      const rejected: NotebookExecutor = async () => { throw new Error('Provider must not run for invalid count'); };
      await assert.rejects(generateNotebook({ kind, sourceText, count }, 'trusted', rejected), isMediaError('INVALID_INPUT'));
    }
  });

  test(`${kind}: rejects malformed payload (wrong count, missing fields)`, async () => {
    const tooFew = factory(Math.max(range.min - 1, 0));
    await assert.rejects(generateNotebook({ kind, sourceText }, 'trusted', async () => response(tooFew)), isMediaError('PROVIDER_ERROR'));

    const wrongShape = { title: 'x' };
    await assert.rejects(generateNotebook({ kind, sourceText }, 'trusted', async () => response(wrongShape)), isMediaError('PROVIDER_ERROR'));
  });

  test(`${kind}: rejects INSUFFICIENT_SOURCE marker instead of fabricating a card`, async () => {
    await assert.rejects(
      generateNotebook({ kind, sourceText }, 'trusted', async () => response({ error: 'INSUFFICIENT_SOURCE' })),
      isMediaError('PROVIDER_ERROR'),
    );
  });

  test(`${kind}: rejects deterministic fallback even with a valid-looking payload`, async () => {
    await assert.rejects(
      generateNotebook({ kind, sourceText }, 'trusted', async () => response(factory(range.default), { provider: 'deterministic_fallback' })),
      isMediaError('NO_PROVIDER'),
    );
  });
}

test('table rows must match column count exactly', async () => {
  const bad: TablePayload = { title: 'Tabel', columns: ['A', 'B'], rows: [['1', '2', '3'], ['4', '5']] };
  await assert.rejects(
    generateNotebook({ kind: 'table', sourceText, count: 2 }, 'trusted', async () => response(bad)),
    isMediaError('PROVIDER_ERROR'),
  );
});

test('audio-overview-script requires exactly two speakers and A/B speaker tags', async () => {
  const badSpeakers = {
    title: 'Naskah', speakers: ['Only one'],
    lines: Array.from({ length: 4 }, (_, i) => ({ id: `l${i + 1}`, speaker: i % 2 === 0 ? 'A' : 'B', text: 'Kemasan 250 gram.' })),
  };
  await assert.rejects(
    generateNotebook({ kind: 'audio-overview-script', sourceText, count: 4 }, 'trusted', async () => response(badSpeakers)),
    isMediaError('PROVIDER_ERROR'),
  );
  const badSpeakerTag = {
    title: 'Naskah', speakers: ['A', 'B'],
    lines: Array.from({ length: 4 }, (_, i) => ({ id: `l${i + 1}`, speaker: i === 0 ? 'C' : 'A', text: 'Kemasan 250 gram.' })),
  };
  await assert.rejects(
    generateNotebook({ kind: 'audio-overview-script', sourceText, count: 4 }, 'trusted', async () => response(badSpeakerTag)),
    isMediaError('PROVIDER_ERROR'),
  );
});

test('mindmap enforces unique node IDs and max 6 sub-children', async () => {
  const duplicate: MindmapPayload = {
    title: 'Peta', root: { id: 'root', label: 'Topik' },
    children: [{ id: 'n1', label: 'A' }, { id: 'n1', label: 'B' }],
  };
  await assert.rejects(
    generateNotebook({ kind: 'mindmap', sourceText, count: 2 }, 'trusted', async () => response(duplicate)),
    isMediaError('PROVIDER_ERROR'),
  );

  const tooManySubChildren = {
    title: 'Peta', root: { id: 'root', label: 'Topik' },
    children: [
      { id: 'n1', label: 'A', children: Array.from({ length: 7 }, (_, i) => ({ id: `n1-${i}`, label: 'x' })) },
      { id: 'n2', label: 'B' },
    ],
  };
  await assert.rejects(
    generateNotebook({ kind: 'mindmap', sourceText, count: 2 }, 'trusted', async () => response(tooManySubChildren)),
    isMediaError('PROVIDER_ERROR'),
  );
});
