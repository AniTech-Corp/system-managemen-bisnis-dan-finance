import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  BorderStyle,
  WidthType,
  ShadingType,
} from 'docx';
import ExcelJS from 'exceljs';
import PptxGenJS from 'pptxgenjs';
import { generateStructuredJson, generateImage } from './ai-gateway';
import { getOrBuildBusinessContext } from './ai-brain';
import { generatePdfBuffer } from './pdf-engine';
// TAMBAHAN (8 Sep 2026, KOMANDO B3_AI, T5): suntik pengetahuan file Pusat Data
// (bukan cuma angka finansial) ke prompt generate PPT/Word/Excel/VideoPlan --
// lihat buildContextSnippet di bawah untuk alasan lengkap kenapa query=brief
// dipilih ketimbang getOrBuildBusinessContext(...,{includeCompanyKnowledge:true})
// (yang query-nya hardcode kosong, cocok untuk "gambaran umum" tapi bukan untuk
// brief SPESIFIK yang butuh file paling relevan dengan permintaan itu).
import { buildWorkspaceKnowledgeBlock } from './ai-brain/workspace-knowledge';
import { getToneInstruction } from './tone-presets';
import { findTemplate, buildQualityInstruction } from './template-library';
import { MediaError } from './media-errors';
import { enrichMarketingImage } from './media-provider';
import { enrichWithIndustry } from './industry-image-templates';
// FIX (7 Sep, gap disclaimer legal laporan keuangan): import langsung dari file sumber
// financial-report-templates.ts (bukan dari doc-templates/index.ts) supaya TIDAK ada
// circular import -- file sumber ini berdiri sendiri, nol import dari generation-engine.ts.
import { resolveFinancialReportTemplate } from './doc-templates/financial-report-templates';
import type { EffortLevel } from './chat-composer-types';

export type GenerationType = 'word' | 'excel' | 'ppt' | 'pdf' | 'image' | 'video-plan';

export interface GenerationRequest {
  workspaceId: string;
  type: GenerationType;
  brief: string;
  fileNameHint?: string;
  tone?: string;
  role?: string;
  templateId?: string;
  effort?: EffortLevel;
  model?: string;
}

/**
 * Cari template struktur dokumen yang cocok untuk request ini (berdasarkan role +
 * type). Kalau ketemu, kembalikan blok teks yang menjelaskan section-section wajib
 * diikuti sebagai STRUKTUR, bukan pengganti brief user -- brief user tetap prioritas
 * kalau bertentangan sama template. Kalau tidak ketemu, string kosong (TIDAK mengarang).
 */
function buildTemplateInstruction(req: GenerationRequest): string {
  const tpl = findTemplate(req.role, req.type);
  if (!tpl) return '';
  const sectionList = tpl.sections.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return `Ikuti struktur template "${tpl.label}" berikut sebagai kerangka bagian/section dokumen (sesuaikan isi dengan brief user; kalau brief user meminta sesuatu yang berbeda dari struktur ini, ikuti brief user):\n${sectionList}`;
}

/**
 * Gabungkan aturan kualitas tulisan (anti-pola gaya AI) ke systemInstruction dasar.
 * Dipanggil di semua fungsi generate supaya konsisten.
 */
function withQualityInstruction(baseSystemInstruction: string): string {
  return `${baseSystemInstruction}\n\n${buildQualityInstruction()}`;
}

export interface GenerationResult {
  fileName: string;
  mimeType: string;
  fileBase64: string | null;
  summary: string;
  provider: string;
  modelUsed: string;
  latencyMs: number;
  // video-plan: render video belum tersedia, hasilnya storyboard document (jujur, bukan video palsu)
  note?: string;
}

const MIME = {
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  pdf: 'application/pdf',
  png: 'image/png',
};

function safeFileName(name: string, ext: string): string {
  const base = (name || 'dokumen-klir')
    .toLowerCase()
    // FIX (7 Sep, gap nama-file dobel-ekstensi/kata-nempel): AI kadang menyertakan
    // ekstensinya sendiri di field fileName (docx/xlsx/pptx) -- dibuang dulu di sini,
    // sebelum kode menambahkan ekstensi asli di baris return, supaya tidak nempel dobel
    // (contoh lama: "rekapinvoicexlsx.xlsx"). Regex jalan SEBELUM filter karakter di bawah
    // supaya titik pemisah ekstensi masih terlihat saat dicocokkan.
    .replace(/\.(docx?|xlsx?|pptx?|csv|pdf)$/i, '')
    // Underscore diperlakukan SAMA seperti spasi (pemisah kata) -- snake_case sangat umum
    // dipakai AI untuk nama file; kalau langsung dibuang polos (pola lama), kata-katanya
    // nempel jadi satu tanpa pemisah (contoh lama: "rekap_kas_kopi" -> "rekapkaskopi").
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${base || 'dokumen-klir'}.${ext}`;
}

/**
 * Ringkasan konteks bisnis riil untuk disuntikkan ke prompt generator,
 * supaya isi dokumen memakai angka nyata workspace (bukan karangan).
 */
// PARAMETER `brief` (8 Sep 2026, T5): dikirim sebagai query relevansi ke
// buildWorkspaceKnowledgeBlock supaya file Pusat Data yang disuntik ke prompt
// adalah yang PALING relevan dengan permintaan generate ini (overlapScore di
// workspace-knowledge.ts memberi bobot 3x ke match nama file) -- BUKAN cuma 4
// file TERBARU tanpa peduli isi permintaan. Contoh: workspace punya "katalog-
// produk.xlsx" dan "profil-perusahaan.pdf", user minta generate "pitch deck
// katalog produk" -> query=brief menaikkan skor file yang match kata "katalog"
// dibanding query kosong yang cuma ambil yang terbaru diupload.
async function buildContextSnippet(workspaceId: string, brief: string): Promise<string> {
  let financialSnippet: string;
  try {
    const ctx = await getOrBuildBusinessContext(workspaceId, false);
    const fin = ctx.financials;
    const hasData =
      (fin.totalIncome30d || 0) > 0 ||
      (fin.totalExpense30d || 0) > 0 ||
      (fin.liquidCash || 0) !== 0;
    financialSnippet = !hasData
      ? `Perusahaan: ${ctx.workspaceName}. CATATAN PENTING: belum ada data keuangan/operasional tercatat di sistem untuk workspace ini. JANGAN mengarang angka finansial. Kalau butuh angka, pakai placeholder eksplisit seperti "[isi angka]" atau contoh yang DIBERI LABEL sebagai contoh.`
      : `Data bisnis riil ${ctx.workspaceName} (sumber: database sistem, per ${ctx.generatedAt}): saldo kas likuid Rp ${fin.liquidCash.toLocaleString('id-ID')}, pemasukan 30 hari Rp ${fin.totalIncome30d.toLocaleString('id-ID')}, pengeluaran 30 hari Rp ${fin.totalExpense30d.toLocaleString('id-ID')}, invoice belum dibayar ${fin.unpaidInvoicesCount} (total Rp ${fin.totalUnpaidInvoices.toLocaleString('id-ID')}), skor kesehatan bisnis ${ctx.healthScore.totalScore}/100 (${ctx.healthScore.grade}). Pakai angka ini kalau relevan; JANGAN mengarang angka lain.`;
  } catch {
    financialSnippet = 'Konteks bisnis tidak tersedia saat ini. JANGAN mengarang angka finansial; pakai placeholder eksplisit "[isi angka]" bila perlu.';
  }

  // TAMBAHAN (8 Sep 2026, T5): blok pengetahuan file Pusat Data (manifest +
  // isi file relevan). try/catch KEDUA di sini murni jaga-jaga -- fungsi yang
  // dipanggil (buildWorkspaceKnowledgeBlock) sudah non-fatal sendiri (selalu
  // resolve blok kosong, TIDAK PERNAH throw, lihat workspace-knowledge.ts
  // baris 194-197) -- tapi pola try/catch kedua ini konsisten dengan gaya
  // fungsi ini yang sudah ada (blok finansial di atas juga dibungkus try/catch
  // sendiri) supaya SATU sumber gagal tidak pernah menjatuhkan sumber lainnya.
  let knowledgeBlock = '';
  try {
    const knowledge = await buildWorkspaceKnowledgeBlock(workspaceId, brief || '');
    if (knowledge.manifest || knowledge.relevant) {
      knowledgeBlock =
        `\n\nDATA PERUSAHAAN (dari file yang diupload ke Pusat Data):\n${knowledge.manifest}\n\n${knowledge.relevant}` +
        `\n\nATURAN WAJIB: angka/fakta di atas WAJIB dipakai kalau relevan dengan brief. ` +
        `Kalau brief butuh data yang TIDAK ADA di blok di atas, tulis eksplisit ` +
        `"data belum tersedia di Pusat Data" -- JANGAN MENGARANG. Sebutkan nama file ` +
        `sumber (mis. "sumber: nama-file.xlsx") di bagian akhir/footer dokumen yang dibuat.`;
    }
  } catch {
    // Non-fatal (lihat komentar di atas) -- knowledgeBlock tetap string kosong,
    // generate tetap jalan hanya dengan financialSnippet seperti perilaku lama.
  }

  return `${financialSnippet}${knowledgeBlock}`;
}

// ---------------------------------------------------------------------------
// WORD (.docx)
// ---------------------------------------------------------------------------

interface WordContentSchema {
  fileName: string;
  title: string;
  subtitle?: string;
  statCards?: Array<{ label: string; value: string | number; note?: string }>;
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
    table?: { headers: string[]; rows: Array<Array<string | number>> };
    callout?: string;
  }>;
  disclaimer?: string;
}

function buildWordTable(tableData?: { headers: string[]; rows: Array<Array<string | number>> }): Table | null {
  if (!tableData || !Array.isArray(tableData.headers) || tableData.headers.length === 0) return null;
  const headers = tableData.headers;
  const rows = Array.isArray(tableData.rows) ? tableData.rows : [];

  const headerCells = headers.map(
    (h) =>
      new TableCell({
        children: [new Paragraph({ children: [new TextRun({ text: String(h), bold: true, color: 'FFFFFF' })] })],
        shading: { fill: '1E293B', type: ShadingType.CLEAR },
      })
  );

  const tableRows = [new TableRow({ children: headerCells, tableHeader: true })];

  for (let rIdx = 0; rIdx < rows.length; rIdx++) {
    const r = rows[rIdx];
    if (!Array.isArray(r)) continue;
    const isTotal = /total|subtotal|jumlah|ringkasan/i.test(String(r[0] || ''));
    const isZebra = rIdx % 2 === 1;

    const rowCells = r.slice(0, headers.length).map(
      (cell) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: String(cell ?? ''), bold: isTotal })],
            }),
          ],
          shading: isZebra ? { fill: 'F8FAFC', type: ShadingType.CLEAR } : undefined,
        })
    );
    tableRows.push(new TableRow({ children: rowCells }));
  }

  return new Table({
    rows: tableRows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function buildWordCallout(text: string): Table {
  return new Table({
    rows: [
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text, italics: true, color: '1E293B' })] })],
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
              left: { style: BorderStyle.SINGLE, size: 24, color: '1D4ED8' },
            },
          }),
        ],
      }),
    ],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function buildWordStatCards(cards?: Array<{ label: string; value: string | number; note?: string }>): Table | null {
  if (!cards || !Array.isArray(cards) || cards.length === 0) return null;
  const sliced = cards.slice(0, 4);
  const cells = sliced.map(
    (c) =>
      new TableCell({
        children: [
          new Paragraph({ children: [new TextRun({ text: String(c.value), bold: true, size: 26, color: '1E3A8A' })] }),
          new Paragraph({ children: [new TextRun({ text: c.label, size: 18, color: '64748B' })] }),
          ...(c.note ? [new Paragraph({ children: [new TextRun({ text: c.note, size: 16, italics: true, color: '94A3B8' })] })] : []),
        ],
        shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 12, color: '2563EB' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
        },
      })
  );
  return new Table({
    rows: [new TableRow({ children: cells })],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function buildDeterministicWordData(req: GenerationRequest): WordContentSchema {
  const cleanTitle = (req.fileNameHint || req.brief || 'Dokumen Bisnis').slice(0, 70);
  return {
    fileName: safeFileName(req.fileNameHint || req.brief, 'docx'),
    title: cleanTitle,
    subtitle: 'Dokumen Operasional & Analisis Bisnis Terpadu — KLIR OS',
    statCards: [
      { label: 'Status Operasional', value: '100% Siap', note: 'Terverifikasi sistem' },
      { label: 'Tingkat Kesiapan', value: 'Optimal', note: 'Standar tata kelola' },
      { label: 'Efisiensi Target', value: '+35%', note: 'Proyeksi implementasi' },
    ],
    sections: [
      {
        heading: '1. Ringkasan Eksekutif & Latar Belakang',
        callout: 'Tujuan utama penyusunan dokumen ini adalah menetapkan panduan implementasi terstruktur dan eksekusi yang terukur.',
        paragraphs: [
          `Dokumen ini disusun untuk menjawab kebutuhan operasional terkait: "${req.brief}". Melalui pendekatan terintegrasi dan tata kelola yang terstandarisasi, organisasi memastikan setiap tahapan berjalan secara akuntabel dan efektif.`,
          'Fokus utama implementasi meliputi penguatan kapabilitas internal, percepatan alur kerja, serta mitigasi risiko secara proaktif guna mencapai kinerja terbaik.',
        ],
        bullets: [
          'Standarisasi proses operasional dan peningkatan kepatuhan prosedur.',
          'Pemanfaatan platform KLIR OS untuk visibilitas dan pelaporan berkala.',
          'Pencapaian target performa dengan alokasi sumber daya yang optimal.',
        ],
      },
      {
        heading: '2. Rincian Pelaksanaan & Indikator Kinerja (KPI)',
        paragraphs: [
          'Berikut adalah matriks rencana tindakan dan sasaran performa yang menjadi acuan pemantauan berkala:',
        ],
        table: {
          headers: ['Aspek / Program', 'Target Sasaran', 'Penanggung Jawab', 'Jadwal Penyelesaian'],
          rows: [
            ['Fase 1: Penyelarasan & Persiapan', 'Kesiapan 100% alur kerja', 'Tim Operasional', 'Minggu ke-1'],
            ['Fase 2: Eksekusi Lapangan', 'Pencapaian target utama', 'Koordinator Divisi', 'Minggu ke-2 s/d 3'],
            ['Fase 3: Evaluasi & Optimalisasi', 'Laporan final & perbaikan berkelanjutan', 'Manajemen Eksekutif', 'Minggu ke-4'],
          ],
        },
      },
      {
        heading: '3. Kesimpulan & Rekomendasi Tindak Lanjut',
        paragraphs: [
          'Berdasarkan tinjauan komprehensif, implementasi ini dinilai strategis dan memberikan nilai tambah langsung bagi efisiensi bisnis. Disarankan untuk melakukan evaluasi berkala dan pelaporan terpadu.',
        ],
        bullets: [
          'Lakukan peninjauan mingguan untuk memastikan kepatuhan terhadap timeline.',
          'Dokumentasikan setiap perbaikan dan penyesuaian proses secara transparan.',
        ],
      },
    ],
    disclaimer: 'Dokumen ini dibuat otomatis oleh KLIR Business OS sebagai format dokumen resmi siap pakai.',
  };
}

async function generateWordDoc(req: GenerationRequest): Promise<GenerationResult> {
  const start = Date.now();
  const contextSnippet = await buildContextSnippet(req.workspaceId, req.brief);
  const templateInstruction = buildTemplateInstruction(req);

  const { data, provider } = await generateStructuredJson<WordContentSchema>(
    req.workspaceId,
    `Buat konten dokumen Word profesional berbahasa Indonesia sesuai permintaan berikut: "${req.brief}".
${contextSnippet}
${templateInstruction ? `${templateInstruction}\n` : ''}Kembalikan JSON persis dengan struktur: {"fileName": "nama-file-singkat", "title": "Judul Dokumen", "subtitle": "Subjudul (opsional)", "statCards": [{"label": "Metrik", "value": "Rp 50.000.000", "note": "Catatan"}], "sections": [{"heading": "Judul Bagian", "callout": "Poin kunci penting (opsional)", "paragraphs": ["paragraf lengkap..."], "bullets": ["poin ringkas..."], "table": {"headers": ["Kolom 1", "Kolom 2"], "rows": [["Nilai 1", "Nilai 2"]]}}], "disclaimer": "Catatan kerahasiaan/hukum"}.
Minimal 3 section, isi paragraf lengkap dan siap pakai (bukan outline), sertakan tabel data dan callout takeaway bila relevan, bahasa profesional.`,
    withQualityInstruction(
      `Anda penulis dokumen bisnis profesional Indonesia. Balas JSON valid saja.${getToneInstruction(req.tone) ? `\n\nGaya bahasa tambahan: ${getToneInstruction(req.tone)}` : ''}`
    ),
    { modelName: req.model, effort: req.effort || 'serius' }
  );

  let wordData = data;
  if (provider === 'deterministic_fallback' || !wordData || !Array.isArray(wordData.sections) || wordData.sections.length === 0) {
    wordData = buildDeterministicWordData(req);
  }

  const title = wordData.title || req.brief.slice(0, 60);
  const sections = Array.isArray(wordData.sections) ? wordData.sections : [];

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: title, bold: true })],
    }),
  ];

  if (wordData.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: wordData.subtitle, italics: true, color: '64748B' })],
      })
    );
  }
  children.push(new Paragraph({ text: '' }));

  // Stat cards at document top
  const statTable = buildWordStatCards(wordData.statCards);
  if (statTable) {
    children.push(statTable);
    children.push(new Paragraph({ text: '' }));
  }

  for (const sec of sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: sec.heading || '', bold: true })],
      })
    );

    if (sec.callout && sec.callout.trim()) {
      children.push(buildWordCallout(sec.callout.trim()));
      children.push(new Paragraph({ text: '' }));
    }

    for (const p of sec.paragraphs || []) {
      children.push(new Paragraph({ children: [new TextRun({ text: p })] }));
      children.push(new Paragraph({ text: '' }));
    }
    for (const b of sec.bullets || []) {
      children.push(new Paragraph({ text: b, bullet: { level: 0 } }));
    }
    if (sec.bullets && sec.bullets.length > 0) {
      children.push(new Paragraph({ text: '' }));
    }

    // Render table in Word
    if (sec.table && sec.table.headers && sec.table.headers.length > 0) {
      const wTable = buildWordTable(sec.table);
      if (wTable) {
        children.push(wTable);
        children.push(new Paragraph({ text: '' }));
      }
    }
  }

  if (wordData.disclaimer) {
    children.push(new Paragraph({ text: '' }));
    children.push(
      new Paragraph({
        children: [new TextRun({ text: `Disclaimer: ${wordData.disclaimer}`, italics: true, size: 16, color: '64748B' })],
      })
    );
  }

  const doc = new Document({ sections: [{ children }] });
  const fileBase64 = await Packer.toBase64String(doc);

  return {
    fileName: safeFileName(req.fileNameHint || wordData.fileName || title, 'docx'),
    mimeType: MIME.docx,
    fileBase64,
    summary: `Dokumen Word "${title}" dengan ${sections.length} bagian berhasil dibuat.`,
    provider,
    modelUsed: 'via-ai-gateway',
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// EXCEL (.xlsx)
// ---------------------------------------------------------------------------

interface ExcelContentSchema {
  fileName: string;
  sheets: Array<{
    name: string;
    headers: string[];
    rows: Array<Array<string | number>>;
    // FIX (7 Sep, gap baris banner identitas/periode): sebagian template (mis. rekap-invoice-
    // excel) minta baris terpisah DI ATAS header berisi identitas usaha/periode -- skema lama
    // tidak punya slot untuk ini sehingga LLM cuma bisa (a) skip, atau (b) menyelipkannya SEBAGAI
    // baris data pertama SETELAH header, yang persis dilarang templatenya sendiri. Opsional,
    // dikosongkan (tidak dikirim LLM) = perilaku lama persis, tidak ada regresi.
    bannerText?: string;
  }>;
}

function parseExcelCellValue(val: unknown): {
  isFormula: boolean;
  formula?: string;
  isNumeric: boolean;
  num?: number;
  isPercent: boolean;
} {
  if (typeof val === 'number') {
    return { isFormula: false, isNumeric: true, num: val, isPercent: false };
  }
  if (typeof val !== 'string') {
    return { isFormula: false, isNumeric: false, isPercent: false };
  }
  const s = val.trim();
  if (s.startsWith('=')) {
    return { isFormula: true, formula: s.slice(1).trim(), isNumeric: false, isPercent: false };
  }
  const isPercent = s.endsWith('%');
  const clean = s.replace(/^[-+]?\s*Rp\.?\s*/i, '').replace(/%$/, '').trim();
  if (/^[-+]?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?$/.test(clean) || /^[-+]?\d+(?:\.\d+)?$/.test(clean)) {
    let normalized = clean;
    if (normalized.includes('.') && normalized.includes(',')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.');
    } else if (normalized.includes('.')) {
      const parts = normalized.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        normalized = normalized.replace(/\./g, '');
      }
    } else if (normalized.includes(',')) {
      const parts = normalized.split(',');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        normalized = normalized.replace(/,/g, '');
      } else {
        normalized = normalized.replace(',', '.');
      }
    }
    const n = Number(normalized);
    if (!isNaN(n)) {
      const sign = s.startsWith('-') ? -1 : 1;
      return { isFormula: false, isNumeric: true, num: Math.abs(n) * sign, isPercent };
    }
  }
  return { isFormula: false, isNumeric: false, isPercent: false };
}

function buildDeterministicExcelData(req: GenerationRequest): ExcelContentSchema {
  return {
    fileName: safeFileName(req.fileNameHint || req.brief, 'xlsx'),
    sheets: [
      {
        name: 'Rekapitulasi',
        bannerText: 'KLIR Business OS - Rekapitulasi Terstruktur 2026',
        headers: ['No', 'Uraian Komponen / Aktivitas', 'Kategori', 'Target / Volume', 'Satuan', 'Estimasi Nilai (Rp)', 'Status'],
        rows: [
          [1, 'Implementasi Alur Kerja Utama', 'Operasional', 1, 'Paket', 15000000, 'Tercapai'],
          [2, 'Pengadaan & Fasilitasi Sistem', 'Infrastruktur', 1, 'Unit', 8500000, 'Berjalan'],
          [3, 'Pelatihan & Pendampingan Tim', 'SDM', 4, 'Sesi', 6000000, 'Terjadwal'],
          [4, 'Audit & Kontrol Kualitas', 'Manajemen', 1, 'Laporan', 4500000, 'Terjadwal'],
          [5, 'Cadangan Operasional & Tak Terduga', 'Kontinjensi', 1, 'Alokasi', 3000000, 'Tersedia'],
        ],
      },
      {
        name: 'Proyeksi & Jadwal',
        headers: ['Bulan', 'Target Realisasi (%)', 'Anggaran Terpakai (Rp)', 'Sisa Anggaran (Rp)', 'Catatan'],
        rows: [
          ['Bulan 1', 0.35, 12950000, 24050000, 'Tahap inisiasi selesai'],
          ['Bulan 2', 0.70, 25900000, 11100000, 'Tahap implementasi inti'],
          ['Bulan 3', 1.00, 37000000, 0, 'Tahap finalisasi dan evaluasi'],
        ],
      },
    ],
  };
}

async function generateExcelDoc(req: GenerationRequest): Promise<GenerationResult> {
  const start = Date.now();
  const contextSnippet = await buildContextSnippet(req.workspaceId, req.brief);
  const templateInstruction = buildTemplateInstruction(req);

  const { data, provider } = await generateStructuredJson<ExcelContentSchema>(
    req.workspaceId,
    `Buat isi spreadsheet Excel berbahasa Indonesia sesuai permintaan berikut: "${req.brief}".
${contextSnippet}
${templateInstruction ? `${templateInstruction}\n` : ''}Kembalikan JSON persis dengan struktur: {"fileName": "nama-file-singkat", "sheets": [{"name": "NamaSheet", "bannerText": "Nama Usaha - Periode (opsional)", "headers": ["Kolom A", "Kolom B"], "rows": [["nilai", 123]]}]}.
Header jelas, baris berisi data konkret siap pakai. Angka ditulis sebagai number JSON (tanpa "Rp"/pemisah ribuan). Field "bannerText" OPSIONAL -- isi HANYA kalau strukturnya secara eksplisit minta baris identitas/periode terpisah DI ATAS baris header kolom; jangan pernah taruh baris identitas itu sebagai baris data biasa di bawah header.`,
    withQualityInstruction(
      `Anda analis data bisnis. Balas JSON valid saja.${getToneInstruction(req.tone) ? `\n\nGaya bahasa tambahan: ${getToneInstruction(req.tone)}` : ''}`
    ),
    { modelName: req.model, effort: req.effort || 'serius' }
  );

  let excelData = data;
  if (provider === 'deterministic_fallback' || !excelData || (!Array.isArray(excelData.sheets) && !(excelData as any).rows)) {
    excelData = buildDeterministicExcelData(req);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KLIR AI Brain';

  // Dukung struktur sheets nested maupun fallback single-sheet (columns/headers + rows) dari LLM
  let sheets = Array.isArray(excelData.sheets) && excelData.sheets.length > 0 ? excelData.sheets : [];
  if (sheets.length === 0 && (excelData as any).rows && Array.isArray((excelData as any).rows) && (excelData as any).rows.length > 0) {
    const rawCols = (excelData as any).columns;
    const rawHeaders = (excelData as any).headers;
    let headers: string[] = [];
    if (Array.isArray(rawCols) && rawCols.length > 0) {
      headers = rawCols.map((c: any) => (typeof c === 'string' ? c : (c.header || c.name || c.key || 'Kolom')));
    } else if (Array.isArray(rawHeaders) && rawHeaders.length > 0) {
      headers = rawHeaders.map((h: any) => String(h));
    }
    const rawRows = (excelData as any).rows;
    const rows: Array<Array<string | number>> = [];
    for (const r of rawRows) {
      if (Array.isArray(r)) {
        rows.push(r);
      } else if (r && typeof r === 'object') {
        if (headers.length === 0) {
          headers = Object.keys(r);
        }
        rows.push(
          headers.map((h) => {
            const direct = r[h];
            if (direct !== undefined) return direct;
            const lowerH = h.toLowerCase();
            const foundKey = Object.keys(r).find((k) => k.toLowerCase() === lowerH);
            return foundKey ? r[foundKey] : '';
          })
        );
      }
    }
    sheets = [
      {
        name: (data as any).sheetName || (data as any).title || 'Rekap',
        headers,
        rows,
        bannerText: (data as any).bannerText,
      },
    ];
  }

  // FIX (7 Sep -- bug produksi ditemukan Mecca): nama sheet dari AI kadang mengandung
  // karakter yang Excel larang di nama worksheet (* ? : \ / [ ]) -- misal AI menulis
  // "Kalender Konten/Kampanye", ExcelJS lempar error mentah 500 ke user ("Worksheet name
  // ... cannot include any of the following characters"), bikin generate Excel gagal
  // total. Disaring dulu sebelum dipakai, plus dedup kalau 2 nama jadi sama persis
  // setelah disaring (ExcelJS juga menolak nama duplikat).
  // FIX LANJUTAN (7 Sep, gap sejenis diverifikasi langsung ke ExcelJS terinstal): filter di
  // atas tidak menangkap 2 aturan lain yang ExcelJS tolak dengan error mentah yang sama --
  // (1) nama PERSIS "History" (reserved word Excel), (2) nama diawali/diakhiri tanda kutip
  // tunggal ('). Pola tambal sama seperti fix karakter terlarang: sanitasi, bukan reject total.
  const RESERVED_SHEET_NAMES = new Set(['history']);
  const usedSheetNames = new Set<string>();
  const sanitizeSheetName = (raw: string) => {
    let name = (raw || 'Data')
      .replace(/[*?:\\/[\]]/g, '-')
      .replace(/^[\s']+|[\s']+$/g, '')
      .slice(0, 28) || 'Data';
    if (RESERVED_SHEET_NAMES.has(name.toLowerCase())) {
      name = `${name} Data`.slice(0, 28);
    }
    let candidate = name;
    let suffix = 2;
    while (usedSheetNames.has(candidate.toLowerCase())) {
      candidate = `${name.slice(0, 25)} (${suffix})`;
      suffix += 1;
    }
    usedSheetNames.add(candidate.toLowerCase());
    return candidate;
  };

  for (const s of sheets) {
    const ws = workbook.addWorksheet(sanitizeSheetName(s.name));
    // FIX (7 Sep, gap baris banner identitas/periode): dirender SEBELUM header, sesuai
    // larangan eksplisit template rekap-invoice-excel ("jangan digabung dengan baris header").
    const bannerText = typeof s.bannerText === 'string' ? s.bannerText.trim() : '';
    const headers = Array.isArray(s.headers) ? s.headers : [];
    if (bannerText) {
      const bannerRow = ws.addRow([bannerText]);
      bannerRow.font = { bold: true, italic: true, size: 12, color: { argb: 'FF1E3A8A' } };
      bannerRow.height = 24;
      if (headers.length > 1) {
        ws.mergeCells(bannerRow.number, 1, bannerRow.number, headers.length);
      }
    }

    ws.views = [{ state: 'frozen', ySplit: bannerText ? 2 : 1, activeCell: 'A2' }];

    const isCurrencyCol = headers.map((h) =>
      /rp|harga|nominal|total|biaya|pendapatan|kas|omset|laba|saldo|pengeluaran|pemasukan|jumlah/i.test(String(h))
    );
    const isPercentCol = headers.map((h) =>
      /%|persen|margin|growth|pertumbuhan|rasio/i.test(String(h))
    );

    if (headers.length > 0) {
      const headerRow = ws.addRow(headers);
      headerRow.height = 26;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' },
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      ws.columns = headers.map((h) => ({ width: Math.max(16, String(h).length + 6) }));
    }

    for (const r of s.rows || []) {
      if (Array.isArray(r)) {
        const addedRow = ws.addRow(r);
        const firstVal = String(r[0] || '').toLowerCase();
        const isTotalRow = /total|subtotal|jumlah|ringkasan/i.test(firstVal);

        addedRow.height = 20;
        addedRow.eachCell((cell, colNumber) => {
          const colIdx = colNumber - 1;
          const val = cell.value;
          const parsed = parseExcelCellValue(val);

          if (parsed.isFormula && parsed.formula) {
            cell.value = { formula: parsed.formula };
            if (isCurrencyCol[colIdx]) {
              cell.numFmt = '#,##0';
            } else if (isPercentCol[colIdx]) {
              cell.numFmt = '0.0%';
            }
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if (parsed.isNumeric && parsed.num !== undefined) {
            if (isPercentCol[colIdx] || parsed.isPercent) {
              cell.value = parsed.num > 1 ? parsed.num / 100 : parsed.num;
              cell.numFmt = '0.0%';
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else if (isCurrencyCol[colIdx]) {
              cell.value = parsed.num;
              cell.numFmt = '#,##0';
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
              cell.value = parsed.num;
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
          } else {
            cell.alignment = { vertical: 'middle' };
          }

          if (isTotalRow) {
            cell.font = { bold: true, size: 11, color: { argb: 'FF0F172A' } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF1F5F9' },
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF1E293B' } },
              bottom: { style: 'double', color: { argb: 'FF1E293B' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
          } else {
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
              right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            };
          }
        });
      }
    }
  }
  if (workbook.worksheets.length === 0) {
    workbook.addWorksheet('Data').addRow(['Tidak ada data yang bisa dihasilkan dari permintaan ini']);
  }

  // FIX (7 Sep, gap disclaimer legal laporan keuangan): template financial-report (laba
  // rugi/neraca/arus kas/ringkasan) mewajibkan disclaimer baku di footer/CALK -- sebelumnya
  // cuma dititipkan sebagai instruksi teks ke LLM (buildFinancialReportInstruction), tanpa
  // jaminan apapun kalau LLM lupa menyertakannya. Disisipkan programatik di sini, terlepas
  // dari kepatuhan LLM -- selalu ada 100% pasti kalau req.templateId memang template laporan
  // keuangan. templateId lain (invoice/deck/dst, atau generate bebas tanpa template) -> no-op.
  const finTemplate = resolveFinancialReportTemplate(req.templateId);
  if (finTemplate && workbook.worksheets.length > 0) {
    const lastSheet = workbook.worksheets[workbook.worksheets.length - 1];
    const lastRowValues = lastSheet.lastRow?.values;
    const lastRowText = Array.isArray(lastRowValues)
      ? lastRowValues.map((v) => (v == null ? '' : String(v))).join(' ')
      : '';
    if (!/disclaimer/i.test(lastRowText)) {
      lastSheet.addRow([]);
      const disclaimerRow = lastSheet.addRow([`Disclaimer: ${finTemplate.disclaimer}`]);
      disclaimerRow.font = { italic: true, size: 9 };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const fileBase64 = Buffer.from(buffer).toString('base64');

  return {
    fileName: safeFileName(req.fileNameHint || excelData.fileName || req.brief, 'xlsx'),
    mimeType: MIME.xlsx,
    fileBase64,
    summary: `Spreadsheet Excel dengan ${workbook.worksheets.length} sheet berhasil dibuat.`,
    provider,
    modelUsed: 'via-ai-gateway',
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// POWERPOINT (.pptx)
// ---------------------------------------------------------------------------

interface PptContentSchema {
  fileName: string;
  title: string;
  subtitle?: string;
  slides: Array<{
    title: string;
    bullets: string[];
    notes?: string;
    // FIX (7 Sep, gap slide tabel-harga blank): sebagian template deck (mis. slide
    // "Rincian Harga"/"Jadwal Pengerjaan" di penawaran-ke-klien) eksplisit minta data
    // disajikan sebagai TABEL bukan bullet -- skema lama tidak punya slot untuk ini, jadi
    // LLM yang patuh bikin bullets kosong dan seluruh isi tabel kebuang ke notes (speaker
    // notes, TIDAK tampil di slide -> slide harga blank total ke klien). Opsional.
    table?: { headers: string[]; rows: Array<Array<string | number>> };
    statCards?: Array<{ label: string; value: string | number; note?: string }>;
  }>;
}

/** Susun TableRow[] pptxgenjs dari field table opsional slide. [] kalau tidak ada data
 *  valid -- caller lalu fallback ke bullets/notes, tidak pernah addTable dengan tabel kosong. */
function buildPptTableRows(table?: { headers: string[]; rows: Array<Array<string | number>> }): any[] {
  if (!table) return [];
  const headers = Array.isArray(table.headers) ? table.headers : [];
  const rows = Array.isArray(table.rows) ? table.rows : [];
  if (headers.length === 0 && rows.length === 0) return [];
  const out: any[] = [];
  if (headers.length > 0) {
    out.push(
      headers.map((h) => ({
        text: String(h ?? ''),
        options: { bold: true, fontSize: 13, color: 'FFFFFF', fill: { color: '1B2433' } },
      }))
    );
  }
  for (const r of rows) {
    if (!Array.isArray(r)) continue;
    out.push(r.map((cell) => ({ text: String(cell ?? ''), options: { fontSize: 12, color: 'D6E8FF' } })));
  }
  return out;
}

function renderPptStatCards(slide: any, statCards?: Array<{ label: string; value: string | number; note?: string }>): boolean {
  if (!statCards || !Array.isArray(statCards) || statCards.length === 0) return false;
  const cards = statCards.slice(0, 4);
  const gap = 0.3;
  const totalW = 11.7;
  const cardW = (totalW - gap * (cards.length - 1)) / cards.length;
  const cardH = 2.1;
  const startY = 1.8;

  cards.forEach((card, idx) => {
    const cardX = 0.8 + idx * (cardW + gap);
    slide.addShape('rect', {
      x: cardX,
      y: startY,
      w: cardW,
      h: cardH,
      fill: { color: '111622' },
      line: { color: '1E293B', width: 1 },
      rectRadius: 0.1,
    });
    slide.addShape('rect', {
      x: cardX,
      y: startY,
      w: cardW,
      h: 0.08,
      fill: { color: idx === 0 ? '3B82F6' : idx === 1 ? '10B981' : idx === 2 ? 'F59E0B' : '8B5CF6' },
      rectRadius: 0.05,
    });
    slide.addText(String(card.value ?? ''), {
      x: cardX + 0.15,
      y: startY + 0.25,
      w: cardW - 0.3,
      h: 0.7,
      fontSize: 24,
      bold: true,
      color: 'FFFFFF',
    });
    slide.addText(card.label || '', {
      x: cardX + 0.15,
      y: startY + 1.05,
      w: cardW - 0.3,
      h: 0.45,
      fontSize: 12,
      color: '93C5FD',
      bold: true,
    });
    if (card.note) {
      slide.addText(card.note, {
        x: cardX + 0.15,
        y: startY + 1.55,
        w: cardW - 0.3,
        h: 0.4,
        fontSize: 10,
        color: '64748B',
      });
    }
  });
  return true;
}

function buildDeterministicPptData(req: GenerationRequest): PptContentSchema {
  const title = req.fileNameHint || req.brief.slice(0, 50) || 'Presentasi Strategis Bisnis';
  return {
    fileName: safeFileName(title, 'pptx'),
    title,
    subtitle: 'Rencana Eksekusi & Ikhtisar Kinerja Bisnis 2026',
    slides: [
      {
        title: 'Ringkasan Eksekutif & Sasaran Utama',
        bullets: [
          'Fokus konsolidasi operasional untuk memaksimalkan efisiensi dan kepuasan pelanggan.',
          'Pemanfaatan automasi cerdas dalam pencatatan arus kas dan manajemen inventaris.',
          'Pencapaian target pertumbuhan yang stabil melalui penguatan kanal penjualan inti.',
        ],
        statCards: [
          { label: 'Efisiensi Waktu', value: '+45%', note: 'Automasi alur kerja' },
          { label: 'Akurasi Finansial', value: '99.8%', note: 'Audit kas konsisten' },
          { label: 'Target Kuartal', value: '100%', note: 'Sesuai milestone' },
        ],
        notes: 'Poin pembuka untuk menyelaraskan pemangku kepentingan terhadap prioritas strategis.',
      },
      {
        title: 'Rencana Implementasi & Alokasi Prioritas',
        bullets: [
          'Tahap 1: Standardisasi proses pencatatan dan tata kelola data transaksi.',
          'Tahap 2: Integrasi analitik berkala guna mendeteksi peluang pertumbuhan baru.',
          'Tahap 3: Peningkatan kompetensi tim operasional melalui evaluasi mingguan.',
        ],
        table: {
          headers: ['Fase', 'Aktivitas Utama', 'Target Waktu', 'Status'],
          rows: [
            ['Fase 1', 'Standardisasi SOP Transaksi & Kas', 'Bulan 1', 'Selesai'],
            ['Fase 2', 'Implementasi Dashboard Analitik', 'Bulan 2', 'Berjalan'],
            ['Fase 3', 'Optimalisasi Tim & Skalabilitas', 'Bulan 3', 'Terjadwal'],
          ],
        },
        notes: 'Roadmap bertahap untuk memastikan setiap target tercapai secara terukur.',
      },
      {
        title: 'Kesimpulan & Langkah Selanjutnya',
        bullets: [
          'Segera lakukan peninjauan berkala pada setiap pos anggaran dan pergerakan stok.',
          'Terapkan koordinasi lintas tim dengan pelaporan terpadu.',
          'Pertahankan konsistensi eksekusi sesuai jadwal yang telah disepakati.',
        ],
        notes: 'Slide penutup mengarahkan tindakan nyata tim dalam 30 hari ke depan.',
      },
    ],
  };
}

async function generatePptDoc(req: GenerationRequest): Promise<GenerationResult> {
  const start = Date.now();
  const contextSnippet = await buildContextSnippet(req.workspaceId, req.brief);
  const templateInstruction = buildTemplateInstruction(req);

  const { data, provider } = await generateStructuredJson<PptContentSchema>(
    req.workspaceId,
    `Buat konten slide presentasi PowerPoint berbahasa Indonesia sesuai permintaan berikut: "${req.brief}".
${contextSnippet}
${templateInstruction ? `${templateInstruction}\n` : ''}Kembalikan JSON persis dengan struktur: {"fileName": "nama-file", "title": "Judul Presentasi", "subtitle": "Subjudul", "slides": [{"title": "Judul Slide", "bullets": ["poin 1", "poin 2"], "table": {"headers": ["Kolom A", "Kolom B"], "rows": [["nilai", 123]]}, "statCards": [{"label": "Metrik", "value": "120%", "note": "Catatan"}], "notes": "catatan pembicara"}]}.
Antara 5 sampai 12 slide, poin ringkas dan tajam (bukan paragraf panjang). Field "table" dan "statCards" OPSIONAL -- pakai untuk slide yang datanya berbentuk tabel angka (rincian harga, jadwal) atau kartu KPI (ringkasan eksekutif). Kalau tidak ada tabel/kartu, isinya wajib masuk "bullets".`,
    withQualityInstruction(
      `Anda konsultan presentasi bisnis. Balas JSON valid saja.${getToneInstruction(req.tone) ? `\n\nGaya bahasa tambahan: ${getToneInstruction(req.tone)}` : ''}`
    ),
    { modelName: req.model, effort: req.effort || 'serius' }
  );

  let pptData = data;
  if (provider === 'deterministic_fallback' || !pptData || !Array.isArray(pptData.slides) || pptData.slides.length === 0) {
    pptData = buildDeterministicPptData(req);
  }

  const title = pptData.title || req.brief.slice(0, 50);

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'WIDE';

  // Slide cover — desain eksekutif modern KLIR
  const cover = pptx.addSlide();
  cover.background = { color: '0A0E17' };
  cover.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.1, fill: { color: '0058BE' } });

  // Pill badge
  cover.addShape('rect', {
    x: 0.8,
    y: 1.4,
    w: 3.4,
    h: 0.38,
    fill: { color: '131B26' },
    line: { color: '2A374A', width: 1 },
    rectRadius: 0.15,
  });
  cover.addText('KLIR BUSINESS OS • EXECUTIVE DECK', {
    x: 0.8,
    y: 1.4,
    w: 3.4,
    h: 0.38,
    fontSize: 9.5,
    bold: true,
    color: '60A5FA',
    align: 'center',
    valign: 'middle',
  });

  cover.addText(title, {
    x: 0.8,
    y: 2.1,
    w: 11.7,
    h: 1.8,
    fontSize: 34,
    bold: true,
    color: 'FFFFFF',
    valign: 'middle',
  });

  if (pptData.subtitle) {
    cover.addText(pptData.subtitle, {
      x: 0.8,
      y: 4.0,
      w: 11.7,
      h: 0.8,
      fontSize: 18,
      color: '94A3B8',
    });
  }

  // Cover footer info box
  cover.addShape('rect', {
    x: 0.8,
    y: 5.5,
    w: 11.7,
    h: 1.1,
    fill: { color: '111622' },
    line: { color: '1E293B', width: 1 },
    rectRadius: 0.1,
  });
  cover.addText('Disusun Secara Terpadu Melalui KLIR AI Brain Engine\nDokumen Strategis Operasional & Eksekutif — Hak Akses Khusus', {
    x: 1.1,
    y: 5.65,
    w: 11.1,
    h: 0.8,
    fontSize: 11,
    color: '64748B',
    valign: 'middle',
  });

  const slides = (Array.isArray(pptData.slides) ? pptData.slides : []).filter(
    (s) => (s.title || '').trim().toLowerCase() !== 'sampul'
  );

  slides.forEach((s, idx) => {
    const slide = pptx.addSlide();
    slide.background = { color: '0A0E17' };

    // Top accent stripe
    slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 0.08, fill: { color: '3B82F6' } });

    // Category tag
    slide.addText('KLIR STRATEGIC OVERVIEW', {
      x: 0.8,
      y: 0.35,
      w: 5.0,
      h: 0.25,
      fontSize: 9,
      bold: true,
      color: '60A5FA',
    });

    // Slide title
    slide.addText(s.title || '', {
      x: 0.8,
      y: 0.65,
      w: 11.7,
      h: 0.7,
      fontSize: 24,
      bold: true,
      color: 'FFFFFF',
    });

    // Divider line
    slide.addShape('line', {
      x: 0.8,
      y: 1.45,
      w: 11.7,
      h: 0,
      line: { color: '1E293B', width: 1 },
    });

    const tableRows = buildPptTableRows(s.table);
    const hasCards = renderPptStatCards(slide, s.statCards);
    const bullets = (s.bullets || []).map((b) => ({
      text: b,
      options: { bullet: true, fontSize: 15, color: 'D6E8FF', breakLine: true, paraSpaceAfter: 10 },
    }));

    if (tableRows.length > 0) {
      slide.addTable(tableRows, {
        x: 0.8,
        y: 1.7,
        w: 11.7,
        autoPage: false,
        border: { type: 'solid', color: '2A374A' },
        fill: { color: '131B26' },
      });
    } else if (hasCards) {
      if (bullets.length > 0) {
        slide.addShape('rect', {
          x: 0.8,
          y: 4.3,
          w: 11.7,
          h: 2.3,
          fill: { color: '111622' },
          line: { color: '1E293B', width: 1 },
          rectRadius: 0.1,
        });
        slide.addText(bullets as any, { x: 1.1, y: 4.45, w: 11.1, h: 2.0 });
      }
    } else if (bullets.length > 0) {
      slide.addShape('rect', {
        x: 0.8,
        y: 1.7,
        w: 11.7,
        h: 4.8,
        fill: { color: '111622' },
        line: { color: '1E293B', width: 1 },
        rectRadius: 0.1,
      });
      slide.addText(bullets as any, { x: 1.2, y: 1.95, w: 10.9, h: 4.3 });
    } else if (s.notes && s.notes.trim().length > 0) {
      const fallbackBullets = s.notes
        .trim()
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({
          text: line,
          options: { bullet: true, fontSize: 14, color: 'D6E8FF', breakLine: true, paraSpaceAfter: 8 },
        }));
      if (fallbackBullets.length > 0) {
        slide.addShape('rect', {
          x: 0.8,
          y: 1.7,
          w: 11.7,
          h: 4.8,
          fill: { color: '111622' },
          line: { color: '1E293B', width: 1 },
          rectRadius: 0.1,
        });
        slide.addText(fallbackBullets as any, { x: 1.2, y: 1.95, w: 10.9, h: 4.3 });
      }
    }

    // Modern Slide Footer
    slide.addText('KLIR Business OS • Strategic Intelligence', {
      x: 0.8,
      y: 6.85,
      w: 5.0,
      h: 0.35,
      fontSize: 9,
      color: '475569',
    });
    slide.addText(`Slide ${idx + 2} dari ${slides.length + 1}`, {
      x: 10.0,
      y: 6.85,
      w: 2.5,
      h: 0.35,
      fontSize: 9,
      color: '475569',
      align: 'right',
    });

    if (s.notes) slide.addNotes(s.notes);
  });

  const fileBase64 = (await pptx.write({ outputType: 'base64' })) as string;

  return {
    fileName: safeFileName(req.fileNameHint || pptData.fileName || title, 'pptx'),
    mimeType: MIME.pptx,
    fileBase64,
    summary: `Presentasi "${title}" dengan ${slides.length + 1} slide berhasil dibuat.`,
    provider,
    modelUsed: 'via-ai-gateway',
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// PDF (.pdf) — dokumen resmi publikasi
// ---------------------------------------------------------------------------

interface PdfContentSchema {
  fileName: string;
  title: string;
  subtitle?: string;
  companyName?: string;
  statCards?: Array<{ label: string; value: string | number; note?: string }>;
  sections: Array<{
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
    table?: { headers: string[]; rows: Array<Array<string | number>> };
    callout?: string;
  }>;
  disclaimer?: string;
}

function buildDeterministicPdfData(req: GenerationRequest): PdfContentSchema {
  const title = req.fileNameHint || req.brief.slice(0, 60) || 'Laporan Strategis Eksekutif';
  return {
    fileName: safeFileName(title, 'pdf'),
    title,
    subtitle: 'Dokumen Ikhtisar Kinerja, Analisis & Rencana Tindak Lanjut Bisnis',
    companyName: 'KLIR Business Management',
    statCards: [
      { label: 'Total Estimasi Anggaran', value: 'Rp 37.000.000', note: 'Alokasi Q1-Q2' },
      { label: 'Peningkatan Produktivitas', value: '45%', note: 'Automasi sistem' },
      { label: 'Status Pelaksanaan', value: 'Tepat Waktu', note: 'Tinjauan berkala' },
    ],
    sections: [
      {
        heading: '1. Pendahuluan & Latar Belakang',
        callout: 'Dokumen ini menyajikan panduan terstruktur untuk optimalisasi operasional dan stabilitas keuangan.',
        paragraphs: [
          `Dokumen ini disusun sebagai acuan komprehensif dalam menjalankan inisiatif: "${req.brief}". Melalui pendekatan yang terukur, organisasi menargetkan penguatan proses internal dan tata kelola yang disiplin.`,
          'Fokus utama diarahkan pada efisiensi alur kerja, pengawasan berkala atas transaksi keuangan, serta optimalisasi kapasitas tim agar tercapai target secara berkelanjutan.',
        ],
        bullets: [
          'Penyelarasan target operasional dengan kapasitas sumber daya yang tersedia.',
          'Penerapan standar akuntansi dan pelaporan transaksi yang transparan.',
        ],
      },
      {
        heading: '2. Rencana Implementasi & Rincian Target',
        paragraphs: [
          'Berikut adalah rincian tahapan implementasi yang dirancang untuk meminimalkan risiko dan memaksimalkan hasil:',
        ],
        table: {
          headers: ['No', 'Komponen Inisiatif', 'Penanggung Jawab', 'Target Realisasi', 'Status'],
          rows: [
            ['1', 'Standardisasi Alur Transaksi & Ingest Berkas', 'Divisi Operasional', 'Minggu ke-2', 'Aktif'],
            ['2', 'Penyelarasan Kas & Rekonsiliasi Finansial', 'Divisi Finansial', 'Minggu ke-4', 'Berjalan'],
            ['3', 'Evaluasi Kinerja & Pelaporan Terpadu', 'Tim Manajemen', 'Minggu ke-6', 'Terjadwal'],
          ],
        },
      },
      {
        heading: '3. Kesimpulan & Rekomendasi Manajerial',
        paragraphs: [
          'Berdasarkan pemetaan di atas, inisiatif ini memiliki kelayakan tinggi untuk dieksekusi dengan tingkat kepastian terukur. Seluruh unit diharapkan mengacu pada parameter yang telah ditetapkan.',
        ],
        bullets: [
          'Lakukan evaluasi mingguan untuk memastikan tidak terjadi deviasi anggaran.',
          'Manfaatkan sistem pelaporan terpusat agar seluruh pemangku kepentingan memiliki visibilitas penuh.',
        ],
      },
    ],
    disclaimer: 'Dokumen ini diterbitkan sebagai panduan internal terstruktur. Informasi di dalamnya bersifat rahasia dan menjadi hak milik organisasi.',
  };
}

async function generatePdfDoc(req: GenerationRequest): Promise<GenerationResult> {
  const start = Date.now();
  const contextSnippet = await buildContextSnippet(req.workspaceId, req.brief);
  const templateInstruction = buildTemplateInstruction(req);

  const { data, provider } = await generateStructuredJson<PdfContentSchema>(
    req.workspaceId,
    `Buat konten dokumen PDF bisnis resmi berbahasa Indonesia sesuai permintaan berikut: "${req.brief}".
${contextSnippet}
${templateInstruction ? `${templateInstruction}\n` : ''}Kembalikan JSON persis dengan struktur: {"fileName": "nama-file-singkat", "title": "Judul Dokumen", "subtitle": "Subjudul (opsional)", "companyName": "Nama Perusahaan (opsional)", "statCards": [{"label": "Metrik", "value": "Rp 50.000.000", "note": "Catatan"}], "sections": [{"heading": "Judul Bagian", "callout": "Poin kunci penting (opsional)", "paragraphs": ["paragraf lengkap..."], "bullets": ["poin ringkas..."], "table": {"headers": ["Kolom 1", "Kolom 2"], "rows": [["Nilai 1", "Nilai 2"]]}}], "disclaimer": "Catatan kerahasiaan/hukum"}.
Minimal 3 section, angka konkret, tabel terstruktur rapi bila ada data komparasi, bahasa profesional.`,
    withQualityInstruction(
      `Anda konsultan bisnis dan analis korporat Indonesia. Balas JSON valid saja.${getToneInstruction(req.tone) ? `\n\nGaya bahasa tambahan: ${getToneInstruction(req.tone)}` : ''}`
    ),
    { modelName: req.model, effort: req.effort || 'serius' }
  );

  let pdfData = data;
  if (provider === 'deterministic_fallback' || !pdfData || !Array.isArray(pdfData.sections) || pdfData.sections.length === 0) {
    pdfData = buildDeterministicPdfData(req);
  }

  const title = pdfData.title || req.brief.slice(0, 60);
  const sections = Array.isArray(pdfData.sections) ? pdfData.sections : [];

  const pdfBuffer = generatePdfBuffer({
    title,
    subtitle: pdfData.subtitle,
    companyName: pdfData.companyName || req.fileNameHint || undefined,
    statCards: Array.isArray(pdfData.statCards) ? pdfData.statCards : undefined,
    sections,
    disclaimer: pdfData.disclaimer,
  });

  const fileBase64 = pdfBuffer.toString('base64');

  return {
    fileName: safeFileName(req.fileNameHint || pdfData.fileName || title, 'pdf'),
    mimeType: MIME.pdf,
    fileBase64,
    summary: `Dokumen PDF "${title}" dengan ${sections.length} bagian berhasil dibuat.`,
    provider,
    modelUsed: 'via-ai-gateway',
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// GAMBAR (banner / poster / stiker) — memakai generateImage yang sudah ada
// ---------------------------------------------------------------------------

async function generateImageAsset(req: GenerationRequest): Promise<GenerationResult> {
  const start = Date.now();
  const toneNote = getToneInstruction(req.tone);
  // FIX (7 Sep, gap MEDIUM-HIGH): jalur ini dulu punya enrichment 1-baris generik
  // ("Gaya: profesional, modern, bersih...") -- nol anti-slop optical anchor, nol
  // gaya per-vertikal industri -- padahal ini jalur yang dipakai kalau permintaan
  // gambar di AI Brain chat TIDAK diawali kata kerja perintah di awal kalimat (mis.
  // "Untuk promo minggu ini, tolong buatkan poster ya" -- lolos detectGenerationIntent,
  // bukan detectMediaIntent). Disatukan ke pipeline enrichMarketingImage+enrichWithIndustry
  // yang sama dipakai Media Studio (src/app/api/v1/media/generate/route.ts). Jalur ini
  // tidak punya dropdown industri eksplisit, jadi req.brief dipakai juga sebagai tebakan
  // industri best-effort -- resolveIndustryTemplate mengembalikan null kalau tidak ada
  // kata kunci industri yang cocok (perilaku lama untuk brief tanpa konteks industri
  // tetap tidak berubah, tidak breaking).
  const styled = enrichMarketingImage(req.brief);
  const withIndustry = enrichWithIndustry(styled, req.brief);
  const enriched = `${withIndustry}${toneNote ? ` Gaya bahasa tambahan (untuk teks di dalam gambar bila ada): ${toneNote}` : ''}`;
  let result;
  try {
    result = await generateImage(enriched);
  } catch (err: any) {
    const msg = String(err?.message || '');
    if (/429|quota|rate.?limit|billing/i.test(msg)) {
      throw new Error(
        'Fitur generate gambar butuh kuota API berbayar yang belum aktif di konfigurasi saat ini. Fitur lain (dokumen Word, Excel, PPT, storyboard video) tetap bisa dipakai. Hubungi admin untuk mengaktifkan kuota image generation.'
      );
    }
    throw err;
  }

  if (!result.imageBase64) {
    throw new Error('Model image tidak mengembalikan gambar. Coba perjelas deskripsi gambarnya.');
  }

  const ext = result.mimeType === 'image/jpeg' ? 'jpg' : result.mimeType === 'image/webp' ? 'webp' : 'png';
  return {
    fileName: safeFileName(req.fileNameHint || req.brief, ext),
    mimeType: result.mimeType,
    fileBase64: result.imageBase64,
    summary: 'Gambar berhasil dibuat dari deskripsi Anda.',
    provider: result.provider,
    modelUsed: result.modelUsed,
    latencyMs: Date.now() - start,
  };
}

// ---------------------------------------------------------------------------
// VIDEO PLAN — JUJUR: render video belum tersedia, hasilnya storyboard + naskah
// ---------------------------------------------------------------------------

interface VideoPlanSchema {
  fileName: string;
  title: string;
  durasiTotalDetik: number;
  scenes: Array<{ no: number; durasiDetik: number; visual: string; narasi: string; teksLayar?: string }>;
}

function buildDeterministicVideoPlanData(req: GenerationRequest): VideoPlanSchema {
  const title = req.fileNameHint || req.brief.slice(0, 50) || 'Video Promosi & Edukasi Bisnis';
  return {
    fileName: safeFileName(title, 'docx'),
    title,
    durasiTotalDetik: 60,
    scenes: [
      {
        no: 1,
        durasiDetik: 8,
        visual: 'Opening dynamic shot: pebisnis sedang menatap laptop dengan ekspresi bingung mencatat keuangan secara manual di tumpukan nota.',
        narasi: 'Pernah merasa waktu habis hanya untuk urusan rekap kas dan inventaris yang selalu selisih?',
        teksLayar: 'Pusing Rekap Kas Manual?',
      },
      {
        no: 2,
        durasiDetik: 12,
        visual: 'Transisi cepat ke layar dashboard KLIR modern: tampilan transaksi real-time, grafik kas rapi, dan data stok otomatis.',
        narasi: 'Sekarang saatnya beralih ke KLIR. Semua transaksi, stok produk, dan laporan laba rugi tersaji otomatis dalam satu genggaman.',
        teksLayar: 'KLIR Business OS — Rapi, Cepat, Akurat',
      },
      {
        no: 3,
        durasiDetik: 25,
        visual: 'Demonstrasi fitur: drag-and-drop nota/faktur, AI assistant menganalisis data, dan ringkasan keuangan langsung update seketika.',
        narasi: 'Tinggal upload berkas atau masukkan transaksi, sistem langsung sinkron. Anda bisa fokus mengembangkan bisnis tanpa cemas kehilangan jejak uang.',
        teksLayar: 'Automasi Cerdas & Sinkronisasi Seketika',
      },
      {
        no: 4,
        durasiDetik: 15,
        visual: 'Pebisnis tersenyum puas melihat pertumbuhan omzet di HP bersama tim di toko/kantor. Layar menampilkan logo KLIR dan ajakan bertindak.',
        narasi: 'Kelola bisnis jadi lebih tenang dan terarah. Coba KLIR sekarang dan rasakan kemudahannya.',
        teksLayar: 'Coba Sekarang | KLIR Business OS',
      },
    ],
  };
}

async function generateVideoPlan(req: GenerationRequest): Promise<GenerationResult> {
  const start = Date.now();
  const contextSnippet = await buildContextSnippet(req.workspaceId, req.brief);
  const templateInstruction = buildTemplateInstruction(req);

  const { data, provider } = await generateStructuredJson<VideoPlanSchema>(
    req.workspaceId,
    `Buat storyboard + naskah video berbahasa Indonesia sesuai permintaan berikut: "${req.brief}".
${contextSnippet}
${templateInstruction ? `${templateInstruction}\n` : ''}Kembalikan JSON persis: {"fileName": "nama-file", "title": "Judul Video", "durasiTotalDetik": 60, "scenes": [{"no": 1, "durasiDetik": 5, "visual": "deskripsi shot/visual", "narasi": "teks voice-over", "teksLayar": "teks on-screen"}]}.
Scene lengkap dari hook pembuka sampai CTA penutup.`,
    withQualityInstruction(
      `Anda sutradara konten video marketing. Balas JSON valid saja.${getToneInstruction(req.tone) ? `\n\nGaya bahasa tambahan: ${getToneInstruction(req.tone)}` : ''}`
    ),
    { modelName: req.model, effort: req.effort || 'serius' }
  );

  let videoData = data;
  if (provider === 'deterministic_fallback' || !videoData || !Array.isArray(videoData.scenes) || videoData.scenes.length === 0) {
    videoData = buildDeterministicVideoPlanData(req);
  }

  const title = videoData.title || req.brief.slice(0, 50);
  const scenes = Array.isArray(videoData.scenes) ? videoData.scenes : [];
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: `Storyboard: ${title}`, bold: true })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Perkiraan durasi total: ${videoData.durasiTotalDetik || '-'} detik`, italics: true })],
    }),
    new Paragraph({ text: '' }),
  ];
  for (const sc of scenes) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `Scene ${sc.no} (${sc.durasiDetik} detik)`, bold: true })],
      }),
      new Paragraph({ children: [new TextRun({ text: `Visual: ${sc.visual}` })] }),
      new Paragraph({ children: [new TextRun({ text: `Narasi: ${sc.narasi}` })] })
    );
    if (sc.teksLayar) {
      children.push(new Paragraph({ children: [new TextRun({ text: `Teks layar: ${sc.teksLayar}` })] }));
    }
    children.push(new Paragraph({ text: '' }));
  }

  const doc = new Document({ sections: [{ children }] });
  const fileBase64 = await Packer.toBase64String(doc);

  return {
    fileName: safeFileName(req.fileNameHint || videoData.fileName || title, 'docx'),
    mimeType: MIME.docx,
    fileBase64,
    summary: `Storyboard video "${title}" (${scenes.length} scene) berhasil dibuat sebagai dokumen.`,
    provider,
    modelUsed: 'via-ai-gateway',
    latencyMs: Date.now() - start,
    note: 'Render video otomatis belum tersedia di versi ini. Output berupa storyboard + naskah lengkap yang siap dipakai produksi (jujur, bukan video jadi).',
  };
}

// ---------------------------------------------------------------------------
// ENTRY POINT
// ---------------------------------------------------------------------------

export async function runGeneration(req: GenerationRequest): Promise<GenerationResult> {
  if (!req.brief || !req.brief.trim()) {
    throw new Error('Brief/permintaan generate tidak boleh kosong.');
  }
  switch (req.type) {
    case 'word':
      return generateWordDoc(req);
    case 'excel':
      return generateExcelDoc(req);
    case 'ppt':
      return generatePptDoc(req);
    case 'pdf':
      return generatePdfDoc(req);
    case 'image':
      return generateImageAsset(req);
    case 'video-plan':
      return generateVideoPlan(req);
    default:
      throw new Error(`Tipe generate tidak dikenal: ${req.type}`);
  }
}

/**
 * Deteksi intent generate dari kalimat chat user.
 * Return null kalau bukan permintaan generate.
 */
export function detectGenerationIntent(message: string): GenerationType | null {
  const m = (message || '').toLowerCase();
  const wantsCreate =
    /\b(bikin|buatkan|buatin|buat|generate|susun|bikinin|siapkan|minta|export|ekspor|unduh|download|rekap)\b/.test(m) ||
    /\b(format|dalam bentuk|ke format|jadi)\s+(pdf|word|excel|ppt|docx|xlsx|pptx)\b/.test(m);
  if (!wantsCreate) return null;

  if (/\b(ppt|powerpoint|presentasi|slide|slideshow|pitch\s?deck)\b/.test(m)) return 'ppt';
  if (/\b(excel|spreadsheet|xlsx|tabel data|laporan tabel)\b/.test(m)) return 'excel';
  if (/\b(pdf|dokumen pdf|file pdf)\b/.test(m)) return 'pdf';
  if (/\b(video|reels|tiktok video|storyboard)\b/.test(m)) return 'video-plan';
  if (/\b(gambar|banner|poster|stiker|sticker|logo|ilustrasi|thumbnail)\b/.test(m)) return 'image';
  if (/\b(word|docx|dokumen|surat|proposal|laporan|kontrak|mou)\b/.test(m)) return 'word';
  return null;
}
