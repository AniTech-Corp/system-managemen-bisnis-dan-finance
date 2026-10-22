/**
 * Unified Bank Statement Parser
 * Routes files to appropriate parser based on format
 */

import { BankStatementParser, BankStatementParseResult, BankFormat, ParsedBankLine } from './types';
import { csvBankParser } from './csv';
import { excelBankParser } from './excel';
import { pdfBankParser } from './pdf';

const parsers: BankStatementParser[] = [csvBankParser, excelBankParser, pdfBankParser];

export function getParserForFile(fileName: string): BankStatementParser | null {
  for (const parser of parsers) {
    if (parser.detectFormat(Buffer.alloc(0), fileName)) {
      return parser;
    }
  }
  return null;
}

export async function parseBankStatement(
  file: Buffer,
  fileName: string
): Promise<BankStatementParseResult> {
  const parser = getParserForFile(fileName);
  if (!parser) {
    return {
      lines: [],
      metadata: {
        statementDate: new Date(),
        startDate: new Date(),
        endDate: new Date(),
        openingBalance: 0,
        closingBalance: 0,
        currency: 'IDR',
      },
      errors: [
        {
          rowNumber: 0,
          field: 'format',
          message: `Format file tidak didukung: ${fileName}. Gunakan CSV, Excel (.xlsx/.xls), atau PDF.`,
          rawValue: null,
        },
      ],
    };
  }

  return parser.parse(file, fileName);
}

export function computeFileHash(file: Buffer): string {
  // Simple hash for deduplication - in production use crypto.createHash('sha256')
  let hash = 0;
  for (let i = 0; i < file.length; i++) {
    const char = file[i];
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Convert to hex string
  return Math.abs(hash).toString(16).padStart(16, '0');
}

// Re-export types
export type { BankStatementParseResult, ParsedBankLine, BankStatementMetadata, ParseError, BankFormat, BankStatementParser } from './types';
export { parseIndonesianDate, parseIndonesianNumber, detectBankFromCSV } from './types';