/**
 * PDF Bank Statement Parser (Stub)
 * Basic implementation - can be enhanced with pdf-parse and bank-specific templates
 */

interface PDFParseResult {
  text: string;
  numpages: number;
}

let pdfParseInstance: InstanceType<typeof import('pdf-parse').PDFParse> | null = null;

async function getPdfParse(): Promise<InstanceType<typeof import('pdf-parse').PDFParse>> {
  if (!pdfParseInstance) {
    const pdfParseModule = await import('pdf-parse');
    pdfParseInstance = new pdfParseModule.PDFParse({ data: new Uint8Array() });
  }
  return pdfParseInstance;
}

async function parsePDF(file: Buffer): Promise<PDFParseResult> {
  const parser = await getPdfParse();
  // Update the parser's data
  (parser as any).options.data = new Uint8Array(file);
  const result = await parser.getText();
  return { text: result.text, numpages: result.total };
}
import {
  BankStatementParseResult,
  ParsedBankLine,
  BankStatementMetadata,
  ParseError,
  BankFormat,
  parseIndonesianDate,
  parseIndonesianNumber,
} from './types';

interface PDFLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function extractLinesFromPDF(text: string): string[] {
  // Split by newlines and filter empty lines
  return text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
}

function detectBankFromPDF(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('bca') || lower.includes('bank central asia')) return 'BCA';
  if (lower.includes('mandiri') || lower.includes('bank mandiri')) return 'Mandiri';
  if (lower.includes('bri') || lower.includes('bank rakyat indonesia')) return 'BRI';
  if (lower.includes('bni') || lower.includes('bank negara indonesia')) return 'BNI';
  return undefined;
}

function tryParsePDFLine(line: string, bankName?: string): ParsedBankLine | null {
  // This is a simplified parser - real implementation would need bank-specific templates
  // For now, try to extract date, description, and amounts using regex patterns

  // Common Indonesian bank statement patterns:
  // DD/MM/YYYY  Description                    1.000.000,00        10.000.000,00
  // DD-MM-YYYY  Description                    1.000.000,00        10.000.000,00

  const patterns = [
    // Pattern: DD/MM/YYYY  Desc  Debit  Credit  Balance
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)$/,
    // Pattern: DD/MM/YYYY  Desc  Amount  Balance (single amount column)
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(.+?)\s+([\d.,]+)\s+([\d.,]+)$/,
    // Pattern with negative amounts in parentheses
    /^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})\s+(.+?)\s+(\([\d.,]+\))\s+([\d.,]+)$/,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const date = parseIndonesianDate(match[1]);
      if (!date) continue;

      const description = match[2].trim();

      if (match[3] && match[4] && match[5]) {
        // Debit, Credit, Balance format
        const debit = parseIndonesianNumber(match[3]);
        const credit = parseIndonesianNumber(match[4]);
        const balance = parseIndonesianNumber(match[5]);

        let direction: 'MASUK' | 'KELUAR';
        let amount: number;

        if (debit !== null && debit > 0) {
          direction = 'KELUAR';
          amount = debit;
        } else if (credit !== null && credit > 0) {
          direction = 'MASUK';
          amount = credit;
        } else {
          continue;
        }

        return {
          rowNumber: 0, // Will be set by caller
          transactionDate: date,
          description,
          debitAmount: direction === 'KELUAR' ? amount : undefined,
          creditAmount: direction === 'MASUK' ? amount : undefined,
          balance: balance ?? undefined,
          direction,
          rawData: { originalLine: line },
        };
      } else if (match[3] && match[4]) {
        // Amount, Balance format
        const amountStr = match[3];
        const balance = parseIndonesianNumber(match[4]);

        // Check if amount is negative (parentheses)
        const isNegative = amountStr.startsWith('(') && amountStr.endsWith(')');
        const amount = parseIndonesianNumber(amountStr);

        if (amount === null || amount === 0) continue;

        const direction = isNegative ? 'KELUAR' : 'MASUK';

        return {
          rowNumber: 0,
          transactionDate: date,
          description,
          debitAmount: direction === 'KELUAR' ? amount : undefined,
          creditAmount: direction === 'MASUK' ? amount : undefined,
          balance: balance ?? undefined,
          direction,
          rawData: { originalLine: line },
        };
      }
    }
  }

  return null;
}

export async function parsePDFBankStatement(
  file: Buffer,
  fileName: string
): Promise<BankStatementParseResult> {
  try {
    const data = await parsePDF(file);
    const lines = extractLinesFromPDF(data.text);
    const bankName = detectBankFromPDF(data.text);

    const parsedLines: ParsedBankLine[] = [];
    const errors: ParseError[] = [];

    lines.forEach((line, idx) => {
      const parsed = tryParsePDFLine(line, bankName);
      if (parsed) {
        parsed.rowNumber = idx + 1;
        parsedLines.push(parsed);
      } else if (line.length > 10) {
        // Only error on substantial lines that look like transactions
        errors.push({
          rowNumber: idx + 1,
          field: 'pdf_parse',
          message: 'Tidak dapat memparsing baris PDF',
          rawValue: line,
        });
      }
    });

    // Extract metadata
    let metadata: BankStatementMetadata;
    if (parsedLines.length > 0) {
      const sortedLines = [...parsedLines].sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
      const startDate = sortedLines[0].transactionDate;
      const endDate = sortedLines[sortedLines.length - 1].transactionDate;

      let openingBalance = 0;
      let closingBalance = 0;

      const firstWithBalance = sortedLines.find((l) => l.balance !== undefined);
      const lastWithBalance = [...sortedLines].reverse().find((l) => l.balance !== undefined);

      if (firstWithBalance && firstWithBalance.balance !== undefined) {
        if (firstWithBalance.direction === 'MASUK') {
          openingBalance = firstWithBalance.balance - (firstWithBalance.creditAmount || 0);
        } else {
          openingBalance = firstWithBalance.balance + (firstWithBalance.debitAmount || 0);
        }
      }

      if (lastWithBalance && lastWithBalance.balance !== undefined) {
        closingBalance = lastWithBalance.balance;
      }

      metadata = {
        statementDate: endDate,
        startDate,
        endDate,
        openingBalance,
        closingBalance,
        currency: 'IDR',
        bankName,
      };
    } else {
      metadata = {
        statementDate: new Date(),
        startDate: new Date(),
        endDate: new Date(),
        openingBalance: 0,
        closingBalance: 0,
        currency: 'IDR',
        bankName,
      };
    }

    return { lines: parsedLines, metadata, errors };
  } catch (error) {
    return {
      lines: [],
      metadata: { statementDate: new Date(), startDate: new Date(), endDate: new Date(), openingBalance: 0, closingBalance: 0, currency: 'IDR' },
      errors: [{ rowNumber: 0, field: 'pdf_parse', message: `Gagal memparsing PDF: ${error instanceof Error ? error.message : 'Unknown error'}`, rawValue: null }],
    };
  }
}

export const pdfBankParser = {
  parse: parsePDFBankStatement,
  detectFormat: (file: Buffer, fileName: string): boolean => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ext === 'pdf';
  },
};