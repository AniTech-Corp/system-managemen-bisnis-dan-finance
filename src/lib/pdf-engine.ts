/**
 * KLIR PDF Engine — Pure TypeScript PDF 1.4 Document Generator.
 * 
 * Generates publication-grade business PDFs for KLIR without requiring external npm packages
 * (such as pdfkit, puppeteer, or native canvas binaries). Fully portable across Windows,
 * Linux, macOS, and container environments.
 */

export interface PdfStatCard {
  label: string;
  value: string | number;
  note?: string;
  change?: string;
}

export interface PdfTable {
  headers: string[];
  rows: Array<Array<string | number>>;
}

export interface PdfSection {
  heading: string;
  content?: string;
  paragraphs?: string[];
  bullets?: string[];
  table?: PdfTable;
  callout?: string;
  statCards?: PdfStatCard[];
}

export interface PdfDocumentInput {
  title: string;
  subtitle?: string;
  companyName?: string;
  dateStr?: string;
  statCards?: PdfStatCard[];
  sections: PdfSection[];
  disclaimer?: string;
}

// A4 dimensions in PDF points (72 points per inch)
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 50;
const MARGIN_RIGHT = 50;
const MARGIN_TOP = 54;
const MARGIN_BOTTOM = 54;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 495.28 pt

function escapePdfText(text: string): string {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' '); // Strip non-standard characters to avoid encoding corruption
}

function wrapText(text: string, maxChars: number): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    if (`${currentLine} ${word}`.length <= maxChars) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export class KlirPdfBuilder {
  private pages: string[][] = [];
  private currentPageOps: string[] = [];
  private yCursor: number = PAGE_HEIGHT - MARGIN_TOP;
  private docTitle: string = '';
  private companyName: string = '';

  constructor() {
    this.newPage();
  }

  private newPage(): void {
    if (this.currentPageOps.length > 0) {
      this.pages.push(this.currentPageOps);
    }
    this.currentPageOps = [];
    this.yCursor = PAGE_HEIGHT - MARGIN_TOP;

    // Running header pada halaman kedua dan seterusnya
    if (this.pages.length > 0 && this.docTitle) {
      this.currentPageOps.push(
        `BT`,
        `/F1 8 Tf`,
        `0.45 0.50 0.58 rg`,
        `${MARGIN_LEFT} ${this.yCursor} Td`,
        `(${escapePdfText(this.docTitle.slice(0, 50))}  |  ${escapePdfText(this.companyName.slice(0, 30))}) Tj`,
        `ET`,
        `0.85 0.88 0.92 RG`,
        `0.5 w`,
        `${MARGIN_LEFT} ${this.yCursor - 4} m ${PAGE_WIDTH - MARGIN_RIGHT} ${this.yCursor - 4} l S`
      );
      this.yCursor -= 18;
    }
  }

  private ensureSpace(neededPoints: number): void {
    if (this.yCursor - neededPoints < MARGIN_BOTTOM) {
      this.newPage();
    }
  }

  public buildDocument(input: PdfDocumentInput): Buffer {
    this.docTitle = input.title || '';
    this.companyName = input.companyName || 'KLIR Business OS';
    const companyName = this.companyName;
    const dateStr = input.dateStr || new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // 1. Header Banner / Cover Header
    this.renderHeader(companyName, input.title, input.subtitle, dateStr);

    // 2. Stat / KPI Cards (if present)
    if (input.statCards && input.statCards.length > 0) {
      this.renderStatCards(input.statCards);
    }

    // 3. Sections (paragraphs, bullets, callout, tables)
    for (const section of input.sections) {
      this.renderSection(section);
    }

    // 4. Disclaimer
    if (input.disclaimer) {
      this.renderDisclaimer(input.disclaimer);
    }

    // Push final page
    if (this.currentPageOps.length > 0) {
      this.pages.push(this.currentPageOps);
    }

    // 5. Assemble PDF 1.4 Binary
    return this.assemblePdf();
  }

  private renderHeader(company: string, title: string, subtitle?: string, dateStr?: string): void {
    // Brand header line
    const yTop = this.yCursor;
    
    // Top colored brand badge
    this.currentPageOps.push(
      `0.12 0.16 0.23 rg`, // Dark navy background
      `${MARGIN_LEFT} ${yTop - 6} ${CONTENT_WIDTH} 4 re f`,
      `0 0 0 rg`
    );
    this.yCursor -= 18;

    // Company & Document Type Badges
    this.currentPageOps.push(
      `BT`,
      `/F2 9 Tf`, // Bold
      `0.25 0.45 0.75 rg`, // Slate blue
      `${MARGIN_LEFT} ${this.yCursor} Td`,
      `(${escapePdfText(company.toUpperCase())}  |  DOKUMEN RESMI BISNIS) Tj`,
      `ET`
    );

    if (dateStr) {
      this.currentPageOps.push(
        `BT`,
        `/F1 9 Tf`,
        `0.45 0.50 0.58 rg`, // Muted gray
        `${PAGE_WIDTH - MARGIN_RIGHT - 120} ${this.yCursor} Td`,
        `(${escapePdfText(dateStr)}) Tj`,
        `ET`
      );
    }
    this.yCursor -= 22;

    // Document Title (wrapped if needed)
    const titleLines = wrapText(title, 42);
    for (const line of titleLines) {
      this.currentPageOps.push(
        `BT`,
        `/F2 20 Tf`, // Bold 20pt
        `0.08 0.11 0.18 rg`, // Near black
        `${MARGIN_LEFT} ${this.yCursor} Td`,
        `(${escapePdfText(line)}) Tj`,
        `ET`
      );
      this.yCursor -= 24;
    }

    // Subtitle
    if (subtitle) {
      const subLines = wrapText(subtitle, 65);
      for (const sline of subLines) {
        this.currentPageOps.push(
          `BT`,
          `/F1 11 Tf`,
          `0.40 0.45 0.55 rg`,
          `${MARGIN_LEFT} ${this.yCursor} Td`,
          `(${escapePdfText(sline)}) Tj`,
          `ET`
        );
        this.yCursor -= 15;
      }
    }

    // Divider rule
    this.yCursor -= 8;
    this.currentPageOps.push(
      `0.85 0.88 0.92 RG`, // Light border
      `0.8 w`,
      `${MARGIN_LEFT} ${this.yCursor} m ${PAGE_WIDTH - MARGIN_RIGHT} ${this.yCursor} l S`,
      `0 0 0 rg`
    );
    this.yCursor -= 20;
  }

  private renderStatCards(cards: PdfStatCard[]): void {
    const numCards = Math.min(cards.length, 4);
    const cardGap = 10;
    const cardWidth = (CONTENT_WIDTH - (cardGap * (numCards - 1))) / numCards;
    const cardHeight = 56;

    this.ensureSpace(cardHeight + 25);

    cards.slice(0, 4).forEach((card, idx) => {
      const x = MARGIN_LEFT + idx * (cardWidth + cardGap);
      const y = this.yCursor - cardHeight;

      // Card background and border
      this.currentPageOps.push(
        `0.96 0.98 1.0 rg`, // Soft blue-gray fill
        `0.82 0.88 0.95 RG`, // Soft border
        `0.75 w`,
        `${x} ${y} ${cardWidth} ${cardHeight} re B`, // Fill and stroke
        // Card top accent line
        `0.20 0.45 0.85 rg`,
        `${x} ${y + cardHeight - 2} ${cardWidth} 2 re f`,
        // Card value
        `BT`,
        `/F2 14 Tf`,
        `0.10 0.15 0.25 rg`,
        `${x + 8} ${y + cardHeight - 20} Td`,
        `(${escapePdfText(String(card.value))}) Tj`,
        `ET`,
        // Card label
        `BT`,
        `/F1 8 Tf`,
        `0.40 0.45 0.55 rg`,
        `${x + 8} ${y + cardHeight - 34} Td`,
        `(${escapePdfText(card.label.slice(0, 24))}) Tj`,
        `ET`
      );

      const footnote = card.change || card.note;
      if (footnote) {
        this.currentPageOps.push(
          `BT`,
          `/F1 7 Tf`,
          `0.50 0.55 0.65 rg`,
          `${x + 8} ${y + 8} Td`,
          `(${escapePdfText(footnote.slice(0, 28))}) Tj`,
          `ET`
        );
      }
    });

    this.yCursor -= (cardHeight + 22);
  }

  private renderSection(section: PdfSection): void {
    // Section Heading
    this.ensureSpace(45);
    this.currentPageOps.push(
      `BT`,
      `/F2 13 Tf`,
      `0.12 0.18 0.28 rg`,
      `${MARGIN_LEFT} ${this.yCursor} Td`,
      `(${escapePdfText(section.heading)}) Tj`,
      `ET`
    );
    this.yCursor -= 6;
    // Section small bottom line
    this.currentPageOps.push(
      `0.20 0.45 0.85 RG`,
      `1.5 w`,
      `${MARGIN_LEFT} ${this.yCursor} m ${MARGIN_LEFT + 32} ${this.yCursor} l S`
    );
    this.yCursor -= 14;

    // Callout box (if any)
    if (section.callout) {
      const calloutLines = wrapText(section.callout, 72);
      const boxH = (calloutLines.length * 13) + 16;
      this.ensureSpace(boxH + 15);
      const boxY = this.yCursor - boxH;

      this.currentPageOps.push(
        `0.96 0.97 0.98 rg`,
        `0.82 0.85 0.90 RG`,
        `0.5 w`,
        `${MARGIN_LEFT} ${boxY} ${CONTENT_WIDTH} ${boxH} re B`,
        // Left accent bar
        `0.15 0.40 0.85 rg`,
        `${MARGIN_LEFT} ${boxY} 3.5 ${boxH} re f`
      );

      let textY = boxY + boxH - 14;
      for (const line of calloutLines) {
        this.currentPageOps.push(
          `BT`,
          `/F1 9 Tf`,
          `0.22 0.28 0.38 rg`,
          `${MARGIN_LEFT + 12} ${textY} Td`,
          `(${escapePdfText(line)}) Tj`,
          `ET`
        );
        textY -= 13;
      }
      this.yCursor = boxY - 14;
    }

    // Section Stat Cards (if defined at section level)
    if (section.statCards && section.statCards.length > 0) {
      this.renderStatCards(section.statCards);
    }

    // Paragraphs & content
    const allParas = [...(section.paragraphs || [])];
    if (section.content && !allParas.includes(section.content)) {
      allParas.unshift(section.content);
    }
    for (const para of allParas) {
      const pLines = wrapText(para, 78);
      this.ensureSpace(pLines.length * 14 + 10);
      for (const pl of pLines) {
        this.currentPageOps.push(
          `BT`,
          `/F1 10 Tf`,
          `0.18 0.22 0.30 rg`,
          `${MARGIN_LEFT} ${this.yCursor} Td`,
          `(${escapePdfText(pl)}) Tj`,
          `ET`
        );
        this.yCursor -= 14;
      }
      this.yCursor -= 6;
    }

    // Bullets
    for (const b of section.bullets || []) {
      const bLines = wrapText(b, 72);
      this.ensureSpace(bLines.length * 13 + 6);
      
      // First line with bullet dot
      this.currentPageOps.push(
        `0.25 0.45 0.85 rg`,
        `${MARGIN_LEFT + 4} ${this.yCursor + 3} 2.5 2.5 re f`, // Small bullet square
        `BT`,
        `/F1 9.5 Tf`,
        `0.20 0.25 0.32 rg`,
        `${MARGIN_LEFT + 14} ${this.yCursor} Td`,
        `(${escapePdfText(bLines[0] || '')}) Tj`,
        `ET`
      );
      this.yCursor -= 13;

      for (let i = 1; i < bLines.length; i++) {
        this.currentPageOps.push(
          `BT`,
          `/F1 9.5 Tf`,
          `0.20 0.25 0.32 rg`,
          `${MARGIN_LEFT + 14} ${this.yCursor} Td`,
          `(${escapePdfText(bLines[i])}) Tj`,
          `ET`
        );
        this.yCursor -= 13;
      }
      this.yCursor -= 3;
    }

    // Table
    if (section.table && section.table.headers && section.table.headers.length > 0) {
      this.renderTable(section.table);
    }

    this.yCursor -= 10;
  }

  private renderTable(table: PdfTable): void {
    const headers = table.headers || [];
    const rows = table.rows || [];
    if (headers.length === 0) return;

    const colCount = headers.length;
    const headerHeight = 22;
    const rowHeight = 19;

    // Hitung bobot tiap kolom berdasar panjang teks maksimum (header + nilai data)
    const rawWeights = headers.map((h, colIdx) => {
      let maxL = String(h || '').length;
      for (const r of rows) {
        if (Array.isArray(r) && r[colIdx] != null) {
          maxL = Math.max(maxL, String(r[colIdx]).length);
        }
      }
      return Math.max(6, maxL);
    });

    const sumWeights = rawWeights.reduce((a, b) => a + b, 0);
    const minColWidth = Math.max(48, Math.floor(CONTENT_WIDTH / (colCount * 2)));
    const unscaledWidths = rawWeights.map((w) => {
      const prop = sumWeights > 0 ? w / sumWeights : 1 / colCount;
      return Math.max(minColWidth, prop * CONTENT_WIDTH);
    });

    const totalUnscaled = unscaledWidths.reduce((a, b) => a + b, 0);
    const scale = CONTENT_WIDTH / totalUnscaled;
    const finalColWidths = unscaledWidths.map((w) => w * scale);

    const colXPositions: number[] = [];
    let curX = MARGIN_LEFT;
    for (const w of finalColWidths) {
      colXPositions.push(curX);
      curX += w;
    }

    // Check space for at least header + 2 rows
    this.ensureSpace(headerHeight + rowHeight * 2 + 10);

    // 1. Table Header Row
    const headerY = this.yCursor - headerHeight;
    this.currentPageOps.push(
      `0.12 0.16 0.23 rg`, // Dark navy
      `${MARGIN_LEFT} ${headerY} ${CONTENT_WIDTH} ${headerHeight} re f`,
      `0.85 0.88 0.92 RG`,
      `0.5 w`,
      `${MARGIN_LEFT} ${headerY} ${CONTENT_WIDTH} ${headerHeight} re S`
    );

    headers.forEach((h, i) => {
      const cellX = colXPositions[i] + 6;
      const colW = finalColWidths[i];
      const maxHeaderChars = Math.max(6, Math.floor((colW - 8) / 4.5));
      this.currentPageOps.push(
        `BT`,
        `/F2 8.5 Tf`,
        `1.0 1.0 1.0 rg`, // White bold text
        `${cellX} ${headerY + 6} Td`,
        `(${escapePdfText(String(h).slice(0, maxHeaderChars))}) Tj`,
        `ET`
      );
    });
    this.yCursor = headerY;

    // 2. Table Data Rows
    rows.forEach((row, rowIdx) => {
      this.ensureSpace(rowHeight + 8);
      const rowY = this.yCursor - rowHeight;
      const isZebra = rowIdx % 2 === 1;

      // Row fill
      if (isZebra) {
        this.currentPageOps.push(
          `0.96 0.97 0.98 rg`,
          `${MARGIN_LEFT} ${rowY} ${CONTENT_WIDTH} ${rowHeight} re f`
        );
      }

      // Bottom cell border
      this.currentPageOps.push(
        `0.88 0.91 0.94 RG`,
        `0.5 w`,
        `${MARGIN_LEFT} ${rowY} ${CONTENT_WIDTH} ${rowHeight} re S`
      );

      // Check if row is a total row
      const firstVal = String(row[0] || '').toLowerCase();
      const isTotal = /total|jumlah|subtotal|ringkasan/i.test(firstVal);

      (Array.isArray(row) ? row : []).forEach((cell, cellIdx) => {
        if (cellIdx >= colCount) return;
        const cellX = colXPositions[cellIdx] + 6;
        const colW = finalColWidths[cellIdx];
        const maxCellChars = Math.max(8, Math.floor((colW - 8) / 4.5));
        const text = String(cell ?? '');

        // Text formatting
        this.currentPageOps.push(
          `BT`,
          isTotal ? `/F2 8.5 Tf` : `/F1 8.5 Tf`,
          isTotal ? `0.08 0.12 0.20 rg` : `0.18 0.22 0.30 rg`,
          `${cellX} ${rowY + 5} Td`,
          `(${escapePdfText(text.slice(0, maxCellChars))}) Tj`,
          `ET`
        );
      });

      this.yCursor = rowY;
    });

    this.yCursor -= 10;
  }

  private renderDisclaimer(disclaimerText: string): void {
    const lines = wrapText(`Disclaimer: ${disclaimerText}`, 85);
    const boxH = lines.length * 11 + 12;
    this.ensureSpace(boxH + 20);
    const boxY = this.yCursor - boxH;

    this.currentPageOps.push(
      `0.97 0.98 0.99 rg`,
      `0.85 0.88 0.92 RG`,
      `0.5 w`,
      `${MARGIN_LEFT} ${boxY} ${CONTENT_WIDTH} ${boxH} re B`
    );

    let textY = boxY + boxH - 10;
    for (const line of lines) {
      this.currentPageOps.push(
        `BT`,
        `/F1 7.5 Tf`,
        `0.45 0.50 0.58 rg`,
        `${MARGIN_LEFT + 8} ${textY} Td`,
        `(${escapePdfText(line)}) Tj`,
        `ET`
      );
      textY -= 11;
    }
    this.yCursor = boxY - 10;
  }

  private assemblePdf(): Buffer {
    const totalPages = this.pages.length;

    // Add running header & footer to each page
    this.pages.forEach((pageOps, idx) => {
      const pageNum = idx + 1;
      const footerY = MARGIN_BOTTOM - 20;

      // Footer divider line
      pageOps.push(
        `0.85 0.88 0.92 RG`,
        `0.5 w`,
        `${MARGIN_LEFT} ${footerY + 12} m ${PAGE_WIDTH - MARGIN_RIGHT} ${footerY + 12} l S`,
        // Footer left branding
        `BT`,
        `/F1 8 Tf`,
        `0.50 0.55 0.65 rg`,
        `${MARGIN_LEFT} ${footerY} Td`,
        `(KLIR Business OS  |  Generated by AI Brain) Tj`,
        `ET`,
        // Footer right page number
        `BT`,
        `/F1 8 Tf`,
        `0.50 0.55 0.65 rg`,
        `${PAGE_WIDTH - MARGIN_RIGHT - 75} ${footerY} Td`,
        `(Halaman ${pageNum} dari ${totalPages}) Tj`,
        `ET`
      );
    });

    // Object offset tracking
    const objects: string[] = [];
    const offsets: number[] = [];

    // Header
    let pdfStr = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;

    const pageObjIds: number[] = [];
    let nextObjId = 5;
    for (let i = 0; i < totalPages; i++) {
      pageObjIds.push(nextObjId);
      nextObjId += 2; // page obj + content stream obj
    }

    // Obj 1: Catalog
    objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;

    // Obj 2: Pages
    const kidsStr = pageObjIds.map((id) => `${id} 0 R`).join(' ');
    objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>\nendobj\n`;

    // Obj 3: Font F1 (Helvetica Regular)
    objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`;

    // Obj 4: Font F2 (Helvetica-Bold)
    objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`;

    // For each page
    this.pages.forEach((pageOps, idx) => {
      const pageId = pageObjIds[idx];
      const streamId = pageId + 1;
      const contentStr = pageOps.join('\n') + '\n';
      const streamLen = Buffer.byteLength(contentStr, 'latin1');

      objects[pageId] = `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${streamId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>\nendobj\n`;
      objects[streamId] = `${streamId} 0 obj\n<< /Length ${streamLen} >>\nstream\n${contentStr}endstream\nendobj\n`;
    });

    // Write all objects and collect offsets
    for (let i = 1; i < objects.length; i++) {
      offsets[i] = Buffer.byteLength(pdfStr, 'latin1');
      pdfStr += objects[i];
    }

    // xref table
    const startXref = Buffer.byteLength(pdfStr, 'latin1');
    pdfStr += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i++) {
      const offStr = String(offsets[i]).padStart(10, '0');
      pdfStr += `${offStr} 00000 n \n`;
    }

    pdfStr += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

    return Buffer.from(pdfStr, 'latin1');
  }
}

/**
 * Convenience function to generate a PDF buffer from structured input.
 */
export function generatePdfBuffer(input: PdfDocumentInput): Buffer {
  const builder = new KlirPdfBuilder();
  return builder.buildDocument(input);
}
