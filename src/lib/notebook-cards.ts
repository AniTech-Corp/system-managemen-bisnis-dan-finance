import { z } from 'zod';

/**
 * Skema + shape untuk 7 jenis kartu notebook di luar quiz/flashcard (yang tetap hidup di
 * notebook-engine.ts tanpa perubahan). File ini berdiri sendiri supaya notebook-engine.ts
 * cukup import + extend union (diff minimal), bukan diedit ulang tiap nambah jenis kartu.
 *
 * Primitif (content/identifier/uniqueIds/sourceFields) sengaja diduplikasi dari
 * notebook-engine.ts, bukan diimpor balik, supaya tidak ada dependensi silang dua arah
 * antara notebook-engine.ts dan file ini.
 */

const sourceFields = {
  sourceText: z.string().trim().min(10).max(16_000),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  role: z.enum(['marketing', 'executive', 'finance']).optional(),
};

const content = z.string().trim().min(1).max(4_000);
const identifier = z.string().trim().min(1).max(100);
const uniqueIds = (items: Array<{ id: string }>) => new Set(items.map(item => item.id)).size === items.length;

export type ExtraNotebookKind =
  | 'summary-report'
  | 'mindmap'
  | 'table'
  | 'infographic'
  | 'deck'
  | 'audio-overview-script'
  | 'video-storyboard';

/** Range count per kind (dipakai request schema di bawah dan dikutip di pesan error engine). */
export const extraNotebookCountRanges: Record<ExtraNotebookKind, { min: number; max: number; default: number }> = {
  'summary-report': { min: 2, max: 8, default: 4 },
  mindmap: { min: 2, max: 10, default: 5 },
  table: { min: 2, max: 20, default: 8 },
  infographic: { min: 3, max: 12, default: 6 },
  deck: { min: 3, max: 15, default: 8 },
  'audio-overview-script': { min: 4, max: 40, default: 12 },
  'video-storyboard': { min: 3, max: 20, default: 10 },
};

/** Entri union request per kind baru; di-spread ke notebookRequestSchema di notebook-engine.ts. */
export const extraNotebookRequestSchemas = (Object.keys(extraNotebookCountRanges) as ExtraNotebookKind[]).map(kind => {
  const range = extraNotebookCountRanges[kind];
  return z.object({
    ...sourceFields,
    kind: z.literal(kind),
    count: z.number().int().min(range.min).max(range.max).default(range.default),
  });
});

function summaryReportSchema(count: number) {
  return z.object({
    title: content,
    summary: content,
    sections: z.array(z.object({
      id: identifier,
      heading: content,
      body: content,
    }).strict()).length(count).refine(uniqueIds, 'Section IDs must be unique'),
  }).strict();
}

const mindmapLeaf = z.object({ id: identifier, label: content }).strict();

function mindmapSchema(count: number) {
  return z.object({
    title: content,
    root: z.object({ id: identifier, label: content }).strict(),
    children: z.array(z.object({
      id: identifier,
      label: content,
      children: z.array(mindmapLeaf).max(6).optional(),
    }).strict()).length(count).refine(uniqueIds, 'Mindmap node IDs must be unique'),
  }).strict();
}

function tableSchema(count: number) {
  return z.object({
    title: content,
    columns: z.array(content).min(2).max(6),
    rows: z.array(z.array(content)).length(count),
  }).strict().refine(
    data => data.rows.every(row => row.length === data.columns.length),
    'Setiap baris harus punya jumlah sel sama dengan jumlah kolom',
  );
}

function infographicSchema(count: number) {
  return z.object({
    title: content,
    caption: content,
    stats: z.array(z.object({
      id: identifier,
      label: content,
      value: content,
      note: content.optional(),
    }).strict()).length(count).refine(uniqueIds, 'Stat IDs must be unique'),
  }).strict();
}

function deckSchema(count: number) {
  return z.object({
    title: content,
    slides: z.array(z.object({
      id: identifier,
      heading: content,
      bullets: z.array(content).min(1).max(5),
    }).strict()).length(count).refine(uniqueIds, 'Slide IDs must be unique'),
  }).strict();
}

function audioOverviewScriptSchema(count: number) {
  return z.object({
    title: content,
    speakers: z.tuple([content, content]),
    lines: z.array(z.object({
      id: identifier,
      speaker: z.enum(['A', 'B']),
      text: content,
    }).strict()).length(count).refine(uniqueIds, 'Line IDs must be unique'),
  }).strict();
}

function videoStoryboardSchema(count: number) {
  return z.object({
    title: content,
    scenes: z.array(z.object({
      id: identifier,
      sceneNumber: z.number().int().min(1),
      description: content,
      onScreenText: content.optional(),
    }).strict()).length(count).refine(uniqueIds, 'Scene IDs must be unique'),
  }).strict();
}

interface ExtraCardDefinition {
  /** Zod strict schema untuk output AI, dibentuk per count seperti quizSchema/flashcardSchema. */
  schema: (count: number) => z.ZodTypeAny;
  /** Template JSON yang disisipkan ke prompt (pola shape di notebook-engine.ts). */
  shape: string;
  /** Baris instruksi tambahan khusus kind ini, disambung ke systemInstruction. */
  instructions: string[];
}

export const extraNotebookCards: Record<ExtraNotebookKind, ExtraCardDefinition> = {
  'summary-report': {
    schema: summaryReportSchema,
    shape: '{"title":"...","summary":"...","sections":[{"id":"s1","heading":"...","body":"..."}]}',
    instructions: [
      'Setiap sections punya heading singkat dan body yang merangkum fakta relevan dari referensi. summary adalah ringkasan keseluruhan 2-3 kalimat.',
    ],
  },
  mindmap: {
    schema: mindmapSchema,
    shape: '{"title":"...","root":{"id":"root","label":"..."},"children":[{"id":"n1","label":"...","children":[{"id":"n1a","label":"..."}]}]}',
    instructions: [
      'root adalah topik utama. children adalah cabang utama (maksimal satu level sub-cabang lewat children di tiap node, opsional, maksimal 6 sub-cabang).',
    ],
  },
  table: {
    schema: tableSchema,
    shape: '{"title":"...","columns":["...","..."],"rows":[["...","..."]]}',
    instructions: [
      'columns adalah judul kolom (2-6 kolom). Setiap array di rows wajib punya jumlah sel persis sama dengan jumlah columns, urut sesuai columns.',
    ],
  },
  infographic: {
    schema: infographicSchema,
    shape: '{"title":"...","caption":"...","stats":[{"id":"st1","label":"...","value":"...","note":"optional"}]}',
    instructions: [
      'Setiap stats punya value singkat (angka atau fakta kunci dari referensi) dan label yang menjelaskannya. Tidak ada rendering gambar, murni teks data.',
    ],
  },
  deck: {
    schema: deckSchema,
    shape: '{"title":"...","slides":[{"id":"sl1","heading":"...","bullets":["...","..."]}]}',
    instructions: [
      'Setiap slides punya heading singkat dan 1-5 bullets berbasis referensi, satu ide per bullet.',
    ],
  },
  'audio-overview-script': {
    schema: audioOverviewScriptSchema,
    shape: '{"title":"...","speakers":["...","..."],"lines":[{"id":"l1","speaker":"A","text":"..."}]}',
    instructions: [
      'speakers adalah nama dua pembicara. lines berselang-seling dialog dua pembicara membahas referensi, field speaker bernilai A atau B saja. Ini naskah teks, bukan audio.',
    ],
  },
  'video-storyboard': {
    schema: videoStoryboardSchema,
    shape: '{"title":"...","scenes":[{"id":"sc1","sceneNumber":1,"description":"...","onScreenText":"optional"}]}',
    instructions: [
      'Setiap scenes punya sceneNumber urut mulai 1, description aksi/visual berbasis referensi, dan onScreenText opsional untuk teks di layar. Ini daftar scene teks, bukan render video.',
    ],
  },
};
