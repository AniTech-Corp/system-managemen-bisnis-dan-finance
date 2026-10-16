/**
 * Template picker -- KLIR AI Brain (11 Sep 2026, kontrak modul 7 Context Pack
 * integrasi-ai-data-model-hemat; ditulis ulang KOMANDO setelah verifikasi V1/V2/V3
 * menemukan file hasil agent B6 tidak ada di disk -- tests/template-picker.test.ts
 * (35 kasus) dipakai sebagai spesifikasi eksak).
 *
 * Tujuan (arahan Mecca 11 Sep): pengguna bisa bilang "saya butuh template seperti ini"
 * lalu dikasih daftar template yang SUDAH ADA di sistem (19 template dokumen di
 * src/lib/doc-templates + 8 gaya visual gambar per-industri), dan bisa memilih satu
 * dengan "pakai template <id atau label>" -- lalu route chat meneruskan templateId ke
 * runGeneration(). Semua deterministik: NOL LLM, NOL network, NOL DB. Hanya membaca
 * registry yang sudah ada (pola sama dengan capability-catalog.ts).
 *
 * Kejujuran yang dikunci: PDF TIDAK bisa digenerate langsung (tidak ada renderer PDF di
 * server) -- daftar selalu menyebut "buat Word lalu ekspor ke PDF".
 */

import { listDocTemplates, type DocTemplate } from '@/lib/doc-templates';
import { INDUSTRY_IMAGE_TEMPLATES } from '@/lib/industry-image-templates';

export type TemplateOutputType = 'word' | 'excel' | 'ppt' | 'video-plan' | 'image' | 'all';

export type TemplateIntent =
  | { kind: 'list'; outputType?: TemplateOutputType }
  | { kind: 'choose'; templateId: string }
  | null;

/** Kata pemicu "mau lihat/pakai template". Kata "laporan" polos SENGAJA tidak masuk --
 * "jelaskan laporan keuangan bulan ini" bukan permintaan template (Kontrak Penyesuaian #6,
 * tabrakan dengan REPORT_SIGNAL di next-actions.ts). */
const TEMPLATE_SIGNAL = /\btemplate\b|\bcontoh format\b|\bformat (laporan|dokumen|slide|presentasi|invoice|surat|proposal|excel|word|ppt|video)\b/i;

/** Kata kerja pemilihan eksplisit. */
const CHOOSE_SIGNAL = /\b(pakai|gunakan|pilih)\s+template\b/i;

/** Pemetaan kata tipe -> outputType. "laporan" SENGAJA tidak dipetakan (ambigu excel/ppt). */
const TYPE_WORDS: Array<{ re: RegExp; type: TemplateOutputType }> = [
  { re: /\b(ppt|pptx|powerpoint|slide|slides|presentasi|deck|pitch)\b/i, type: 'ppt' },
  { re: /\b(excel|xlsx|spreadsheet|sheet|rekap)\b/i, type: 'excel' },
  { re: /\b(video|storyboard|reels|tiktok)\b/i, type: 'video-plan' },
  { re: /\b(gambar|image|poster|banner|visual|foto|ilustrasi)\b/i, type: 'image' },
  { re: /\b(word|docx|dokumen|surat|invoice|proposal|kontrak|mou)\b/i, type: 'word' },
];

const OUTPUT_LABEL: Record<Exclude<TemplateOutputType, 'all'>, string> = {
  word: 'Dokumen Word',
  excel: 'Spreadsheet Excel',
  ppt: 'Presentasi (PPT)',
  'video-plan': 'Storyboard & naskah video',
  image: 'Gambar',
};

function normalize(text: string): string {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Kata sambung/umum yang tidak boleh jadi dasar kecocokan ("tidak" di "Metode Tidak
 * Langsung" jangan bikin "abc-tidak-ada" cocok ke Laporan Arus Kas). */
const STOPWORDS = new Set(['tidak', 'dengan', 'untuk', 'dari', 'yang', 'metode', 'satu', 'halaman', 'tanpa', 'standar', 'praktik', 'literal', 'lengkap', 'ringkas', 'versi', 'sesuai', 'tempo', 'template', 'pakai', 'gunakan', 'pilih', 'buat', 'buatkan']);

function tokens(text: string): string[] {
  return normalize(text)
    .split(/[\s-]+/)
    .filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

function detectOutputType(message: string): TemplateOutputType | undefined {
  for (const { re, type } of TYPE_WORDS) {
    if (re.test(message)) return type;
  }
  return undefined;
}

/**
 * Cari template dari teks bebas: (1) id persis sebagai kata utuh, (2) label persis
 * (case-insensitive), (3) skor overlap token label/id -- skor 0 -> null (tidak pernah
 * "menang default"). Deterministik: seri diputus oleh urutan registry (stabil).
 */
export function matchTemplateByText(text: string): DocTemplate | null {
  const norm = normalize(text);
  if (!norm) return null;
  const templates = listDocTemplates();

  const words = new Set(norm.split(' '));
  for (const t of templates) {
    if (words.has(t.id) || norm === t.id) return t;
  }
  for (const t of templates) {
    if (normalize(t.label) === norm) return t;
  }

  const queryTokens = new Set(tokens(norm));
  if (queryTokens.size === 0) return null;
  let best: { t: DocTemplate; score: number } | null = null;
  for (const t of templates) {
    const labelTokens = new Set([...tokens(t.label), ...t.id.split('-').filter((s) => s.length >= 4)]);
    let score = 0;
    for (const tok of queryTokens) if (labelTokens.has(tok)) score += 1;
    // Bobot tambahan kalau SEMUA token label ketemu (label pendek yang cocok utuh menang
    // atas label panjang yang cuma cocok sebagian).
    if (score > 0 && [...labelTokens].every((lt) => queryTokens.has(lt))) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { t, score };
  }
  return best ? best.t : null;
}

/**
 * Deteksi niat template dari pesan pengguna.
 * - "pakai/gunakan/pilih template X" -> choose (kalau X ketemu), kalau tidak -> list.
 * - kata template/contoh format/format <tipe> -> list (+ outputType kalau tersirat).
 * - selain itu -> null.
 */
export function detectTemplateIntent(message: string): TemplateIntent {
  const text = (message || '').trim();
  if (!text) return null;

  const chooseMatch = text.match(CHOOSE_SIGNAL);
  if (chooseMatch) {
    const after = text.slice((chooseMatch.index || 0) + chooseMatch[0].length).trim();
    const found = after ? matchTemplateByText(after) : null;
    if (found) return { kind: 'choose', templateId: found.id };
    return { kind: 'list' };
  }

  if (!TEMPLATE_SIGNAL.test(text)) return null;
  const outputType = detectOutputType(text);
  return outputType ? { kind: 'list', outputType } : { kind: 'list' };
}

/**
 * Pilihan template + brief siap dikirim ke runGeneration(). null kalau tidak ada kata
 * kerja pemilihan atau template tidak ketemu (jangan mengarang).
 */
export function resolveTemplateChoice(message: string): { templateId: string; label: string; outputType: string; brief: string } | null {
  const text = (message || '').trim();
  const chooseMatch = text.match(CHOOSE_SIGNAL);
  if (!chooseMatch) return null;
  const after = text.slice((chooseMatch.index || 0) + chooseMatch[0].length).trim();
  const found = after ? matchTemplateByText(after) : null;
  if (!found) return null;
  // Konteks tambahan setelah nama template tetap dibawa ke brief (mis. "untuk bulan Agustus").
  const brief = `Buat ${found.label} (template ${found.id}). Konteks dari pengguna: ${after || text}`.trim();
  return { templateId: found.id, label: found.label, outputType: found.outputType, brief };
}

const VALID_TYPES: TemplateOutputType[] = ['word', 'excel', 'ppt', 'video-plan', 'image', 'all'];

/**
 * Daftar template dalam markdown. Tanpa outputType / 'all' / tipe tidak dikenal ->
 * semua template + gaya visual gambar. Tipe spesifik -> hanya tipe itu; 'image' -> nol
 * template dokumen tapi gaya visual gambar tetap ditampilkan.
 */
export function buildTemplateListReply(outputType?: string): string {
  const type: TemplateOutputType = outputType && VALID_TYPES.includes(outputType as TemplateOutputType) ? (outputType as TemplateOutputType) : 'all';
  const all = listDocTemplates();
  const lines: string[] = [];
  const showIndustries = type === 'all' || type === 'image';

  const groups: Array<Exclude<TemplateOutputType, 'all'>> = type === 'all' ? ['excel', 'word', 'ppt', 'video-plan'] : type === 'image' ? [] : [type];
  let anyDoc = false;
  for (const g of groups) {
    const items = all.filter((t) => t.outputType === g);
    if (items.length === 0) continue;
    anyDoc = true;
    lines.push(`**${OUTPUT_LABEL[g]}**`);
    lines.push('');
    lines.push('| Template | Untuk apa | Cara pakai |');
    lines.push('|---|---|---|');
    for (const t of items) {
      lines.push(`| ${t.label} | ${t.description.slice(0, 90)} | ketik: pakai template ${t.id} untuk <kebutuhan Anda> |`);
    }
    lines.push('');
  }
  if (!anyDoc && type !== 'all') {
    lines.push(`Belum ada template dokumen untuk tipe "${type}".`);
    lines.push('');
  }

  if (showIndustries) {
    lines.push('**Gaya visual gambar per-industri** (dipakai otomatis saat generate gambar/poster/banner):');
    lines.push('');
    for (const ind of Object.values(INDUSTRY_IMAGE_TEMPLATES)) {
      lines.push(`- ${ind.label}`);
    }
    lines.push('');
  }

  lines.push('Catatan jujur: PDF belum bisa dibuat langsung -- buat dokumen Word dari template lalu ekspor ke PDF dari Word/Google Docs.');
  return lines.join('\n');
}
