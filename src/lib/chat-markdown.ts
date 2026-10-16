/**
 * V1 RENDER KAYA -- parser markdown subset untuk gelembung chat AI KLIR (8 Sep 2026).
 *
 * Modul ini PURE (NOL import React/JSX) supaya bisa dites langsung lewat Node
 * test runner tanpa jsdom/DOM shim -- lihat tests/chat-markdown-parser-8sep.test.ts.
 * Dipakai oleh src/app/components/chat/RichMessage.tsx (satu-satunya konsumen React),
 * pengganti 3x fungsi lokal `FormattedMessage`/`parseInline` yang dulu diduplikasi
 * PERSIS di MarketingAIAssistantView.tsx / FinanceAIAssistantView.tsx /
 * ExecutiveAIAssistantView.tsx (byte-identik kecuali warna aksen).
 *
 * KOMPATIBILITAS MUNDUR (WAJIB, regresi nol -- lihat kriteria_selesai wave ini):
 * replikasi PERSIS urutan cabang & regex dari 3 fungsi lama itu (blank-line / hr /
 * tabel markdown / heading / blockquote / bullet / numbered / paragraf), PLUS 1 cabang
 * BARU di urutan PALING ATAS untuk blok fenced ``` (dulu TIDAK ditangani sama sekali
 * di ketiga view -- ASCII bar chart/mind map dari LLM jatuh ke paragraf biasa, rawan
 * kepotong bold/tabel palsu kalau berisi karakter | atau *).
 *
 * CATATAN DESAIN (extension dari draft kontrak asli, didokumentasikan di laporan akhir
 * B1 untuk B4 -- draft awal cuma menyebut union 'text'|'bold'|'italic'|'code'):
 * - InlineSegment ditambah 2 tipe: 'br' (payload kosong, penanda <br> literal di tengah
 *   satu baris/sel -- ketiga FormattedMessage lama split teks per-baris dulu dengan
 *   `.split(/<br\s*\/?>/gi)` SEBELUM parse inline, RichMessage.tsx mereplikasi lewat
 *   segmen 'br' supaya satu fungsi ini cukup untuk semua kasus) dan 'source' (payload
 *   = key registry, mis. "finance") untuk pola `[[src:xxx]]` yang HANYA dipakai
 *   ExecutiveAIAssistantView.tsx (badge sumber data, lihat SOURCE_REGISTRY di file itu).
 *   Marketing/Finance TIDAK pernah menghasilkan pola ini dari LLM -- tapi function ini
 *   accent-agnostic (satu parser untuk 3 view), jadi tetap dideteksi di sini; RichMessage
 *   yang memutuskan mau dirender sebagai badge (accent executive) atau teks literal apa
 *   adanya (accent lain, byte-identik dengan perilaku lama yang tidak mengenali pola ini
 *   sama sekali sehingga jatuh ke cabang teks polos).
 * - ParsedBlock 'heading' punya field `level` (1 kalau 1 tanda '#', 2 kalau '##' dst) --
 *   ketiga FormattedMessage lama TIDAK pernah membedakan level heading secara visual
 *   (satu gaya untuk semua `#`), RichMessage.tsx mempertahankan itu (regresi nol); field
 *   `level` murni metadata tambahan untuk kebutuhan test/masa depan.
 */

export type InlineSegment =
  | { type: 'text'; value: string }
  | { type: 'bold'; value: string }
  | { type: 'italic'; value: string }
  | { type: 'code'; value: string }
  | { type: 'br'; value: '' }
  | { type: 'source'; value: string };

export type ParsedBlock =
  | { type: 'code'; lines: string[] }
  | { type: 'table'; headers: string[]; rows: string[][]; numericCols: boolean[] }
  | { type: 'heading'; level: 1 | 2; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'numbered'; num: string; text: string }
  | { type: 'hr' }
  | { type: 'blank' }
  | { type: 'paragraph'; text: string };

// Regex gabungan -- urutan alternatif PENTING (source-tag dicek duluan supaya tidak
// pernah salah kena tangkap sub-pattern bold/italic di dalamnya, walau secara struktur
// pola [[src:xxx]] tidak mungkin bentrok dengan **/*/`).
const INLINE_SPLIT_RE = /(\[\[src:[a-zA-Z]+\]\]|\*\*.*?\*\*|\*.*?\*|`.*?`|<b>.*?<\/b>|<i>.*?<\/i>)/g;
const SOURCE_TAG_RE = /^\[\[src:([a-zA-Z]+)\]\]$/;

/**
 * Pecah satu baris/sel teks jadi segmen inline terstruktur (bold/italic/code/dst).
 * Replikasi PERSIS logic split ganda (br dulu, baru bold/italic/code) yang ada di
 * ketiga `parseInline()` lama -- lihat catatan desain di header file ini.
 */
export function parseInlineSegments(text: string): InlineSegment[] {
  if (!text) return [];
  const segments: InlineSegment[] = [];
  const brParts = String(text).split(/<br\s*\/?>/gi);

  brParts.forEach((sub, bi) => {
    if (bi > 0) segments.push({ type: 'br', value: '' });
    const parts = sub.split(INLINE_SPLIT_RE);
    for (const part of parts) {
      if (!part) continue;
      const srcMatch = part.match(SOURCE_TAG_RE);
      if (srcMatch) {
        segments.push({ type: 'source', value: srcMatch[1] });
        continue;
      }
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        segments.push({ type: 'bold', value: part.slice(2, -2) });
        continue;
      }
      if (part.startsWith('<b>') && part.endsWith('</b>') && part.length >= 7) {
        segments.push({ type: 'bold', value: part.slice(3, -4) });
        continue;
      }
      if (part.startsWith('<i>') && part.endsWith('</i>') && part.length >= 7) {
        segments.push({ type: 'italic', value: part.slice(3, -4) });
        continue;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
        segments.push({ type: 'italic', value: part.slice(1, -1) });
        continue;
      }
      if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
        segments.push({ type: 'code', value: part.slice(1, -1) });
        continue;
      }
      segments.push({ type: 'text', value: part });
    }
  });

  return segments;
}

const NUMERIC_CELL_RE = /^-?\(?\s*(rp\.?\s*)?[\d.,]+\s*%?\)?$/i;

function isNumericLikeCell(s: string): boolean {
  const trimmed = s.trim();
  if (!trimmed) return true; // sel kosong tidak menggagalkan kolom dianggap numerik
  return /\d/.test(trimmed) && NUMERIC_CELL_RE.test(trimmed);
}

function parseTableCells(row: string): string[] {
  return row.split('|').slice(1, -1).map((c) => c.trim());
}

/**
 * Pecah konten pesan (multi-baris) jadi daftar blok terstruktur. Urutan cabang
 * PERSIS sama dengan 3 FormattedMessage lama (blank/hr/tabel/heading/blockquote/
 * bullet/numbered/paragraf), ditambah 1 cabang BARU paling atas untuk fenced ```.
 */
export function parseMarkdownBlocks(content: string): ParsedBlock[] {
  if (!content) return [];
  const rawLines = String(content).split('\n');
  const blocks: ParsedBlock[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];
    const trimmed = line.trim();

    // Fenced code block -- BARU (dulu tidak ditangani sama sekali di ketiga view).
    // Baris disimpan RAW (bukan trimmed) supaya indentasi mind-map/ASCII bar chart
    // tetap utuh. Kalau LLM lupa menutup blok (EOF sebelum ``` penutup), tetap
    // kumpulkan apa yang ada -- JANGAN crash, JANGAN buang teks yang sudah terbaca.
    const fenceMatch = trimmed.match(/^```(\w*)\s*$/);
    if (fenceMatch) {
      i++;
      const codeLines: string[] = [];
      while (i < rawLines.length && rawLines[i].trim() !== '```') {
        codeLines.push(rawLines[i]);
        i++;
      }
      if (i < rawLines.length) i++; // lewati baris ``` penutup kalau ada
      blocks.push({ type: 'code', lines: codeLines });
      continue;
    }

    if (!trimmed) {
      blocks.push({ type: 'blank' });
      i++;
      continue;
    }

    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Markdown Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      const tableRows: string[] = [];
      while (
        i < rawLines.length &&
        rawLines[i].trim().startsWith('|') &&
        rawLines[i].trim().endsWith('|')
      ) {
        const rowTrimmed = rawLines[i].trim();
        if (!/^\|(\s*[-:]+\s*\|)+$/.test(rowTrimmed)) {
          tableRows.push(rowTrimmed);
        }
        i++;
      }

      if (tableRows.length) {
        const headers = parseTableCells(tableRows[0]);
        const bodyRows = tableRows.slice(1).map(parseTableCells);
        const numericCols = headers.map((_, ci) =>
          bodyRows.length > 0 && bodyRows.every((row) => isNumericLikeCell(row[ci] ?? ''))
        );
        blocks.push({ type: 'table', headers, rows: bodyRows, numericCols });
        continue;
      }
    }

    // Headings
    if (trimmed.startsWith('#')) {
      const hashMatch = trimmed.match(/^(#+)\s*(.*)$/);
      const level: 1 | 2 = hashMatch && hashMatch[1].length === 1 ? 1 : 2;
      const headingText = hashMatch ? hashMatch[2] : trimmed.replace(/^#+\s*/, '');
      blocks.push({ type: 'heading', level, text: headingText });
      i++;
      continue;
    }

    // Blockquotes
    if (trimmed.startsWith('>')) {
      blocks.push({ type: 'blockquote', text: trimmed.replace(/^>\s*/, '') });
      i++;
      continue;
    }

    // Bullet Lists
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
      blocks.push({ type: 'bullet', text: trimmed.replace(/^[-*•]\s*/, '') });
      i++;
      continue;
    }

    // Numbered Lists
    const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push({ type: 'numbered', num: numMatch[1], text: numMatch[2] });
      i++;
      continue;
    }

    // Standard Paragraph -- pakai `line` (bukan `trimmed`) persis seperti lama,
    // supaya indentasi minor di dalam paragraf biasa tidak berubah perilaku.
    blocks.push({ type: 'paragraph', text: line });
    i++;
  }

  return blocks;
}
