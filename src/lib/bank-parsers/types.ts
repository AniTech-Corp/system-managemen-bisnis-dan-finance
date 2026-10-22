/**
 * Bank Statement Parser Types
 * Unified interface for parsing bank statements from various formats (CSV, Excel, PDF)
 */

export interface ParsedBankLine {
  rowNumber: number;
  transactionDate: Date;
  valueDate?: Date;
  description: string;
  referenceNumber?: string;
  debitAmount?: number;    // Positive number for outgoing
  creditAmount?: number;   // Positive number for incoming
  balance?: number;
  direction: 'MASUK' | 'KELUAR';
  rawData: Record<string, unknown>;
}

export interface BankStatementMetadata {
  statementDate: Date;
  startDate: Date;
  endDate: Date;
  openingBalance: number;
  closingBalance: number;
  currency: string;
  bankName?: string;
  accountNumber?: string;
}

export interface ParseError {
  rowNumber: number;
  field: string;
  message: string;
  rawValue: unknown;
}

export interface BankStatementParseResult {
  lines: ParsedBankLine[];
  metadata: BankStatementMetadata;
  errors: ParseError[];
}

export interface BankStatementParser {
  parse(file: Buffer, fileName: string): Promise<BankStatementParseResult>;
  detectFormat(file: Buffer, fileName: string): boolean;
}

export type BankFormat = 'BCA' | 'MANDIRI' | 'BRI' | 'BNI' | 'GENERIC_CSV' | 'EXCEL' | 'PDF';

// Indonesian date parsing utility
export function parseIndonesianDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial date
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 86400000);
    return isNaN(date.getTime()) ? null : date;
  }
  if (typeof value !== 'string') return null;

  const str = value.trim();

  // Try ISO format first (YYYY-MM-DD)
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    if (!isNaN(date.getTime())) return date;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmYMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmYMatch) {
    const day = parseInt(dmYMatch[1], 10);
    const month = parseInt(dmYMatch[2], 10) - 1;
    const year = parseInt(dmYMatch[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month) return date;
  }

  // Try DD MMM YYYY (Indonesian month names)
  const monthNames: Record<string, number> = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, maret: 2,
    apr: 3, april: 3,
    mei: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    agu: 7, agustus: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9,
    nov: 10, november: 10,
    des: 11, desember: 11,
  };
  const dMyMatch = str.match(/^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (dMyMatch) {
    const day = parseInt(dMyMatch[1], 10);
    const monthStr = dMyMatch[2].toLowerCase().slice(0, 3);
    const month = monthNames[monthStr];
    const year = parseInt(dMyMatch[3], 10);
    if (month !== undefined) {
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime()) && date.getDate() === day && date.getMonth() === month) return date;
    }
  }

  return null;
}

// Parse Indonesian number format (1.000.000,00 or 1000000 or 1,000.00)
export function parseIndonesianNumber(value: unknown): number | null {
  if (typeof value === 'number') return isNaN(value) ? null : value;
  if (typeof value !== 'string') return null;

  const str = value.trim();
  if (!str || str === '-' || str === '0') return 0;

  // Handle negative with parentheses: (1.000) = -1000
  const isNegative = str.startsWith('(') && str.endsWith(')');
  const cleanStr = isNegative ? str.slice(1, -1) : str;

  // Detect format by counting separators
  const dotCount = (cleanStr.match(/\./g) || []).length;
  const commaCount = (cleanStr.match(/,/g) || []).length;

  let normalized = cleanStr;

  if (commaCount > 0 && dotCount > 0) {
    // Both present - determine which is decimal separator
    const lastDot = cleanStr.lastIndexOf('.');
    const lastComma = cleanStr.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Indonesian: 1.000.000,50 (comma is decimal)
      normalized = cleanStr.replace(/\./g, '').replace(',', '.');
    } else {
      // US: 1,000,000.50 (dot is decimal)
      normalized = cleanStr.replace(/,/g, '');
    }
  } else if (commaCount === 1 && dotCount === 0) {
    // Single comma - could be decimal (Indonesian) or thousand (US)
    // If comma followed by 3 digits at end, it's likely thousand separator
    const commaIdx = cleanStr.indexOf(',');
    if (cleanStr.length - commaIdx - 1 === 3 && cleanStr.length > 4) {
      // Likely US thousand separator: 1,000
      normalized = cleanStr.replace(/,/g, '');
    } else {
      // Likely Indonesian decimal: 1000,50
      normalized = cleanStr.replace(',', '.');
    }
  } else if (dotCount === 1 && commaCount === 0) {
    // Single dot - could be decimal (US) or thousand (Indonesian)
    const dotIdx = cleanStr.indexOf('.');
    if (cleanStr.length - dotIdx - 1 === 3 && cleanStr.length > 4) {
      // Likely Indonesian thousand separator: 1.000
      normalized = cleanStr.replace(/\./g, '');
    } else {
      // Likely US decimal: 1000.50
      normalized = cleanStr;
    }
  } else if (commaCount > 1) {
    // Multiple commas - US thousand separators: 1,000,000
    normalized = cleanStr.replace(/,/g, '');
  } else if (dotCount > 1) {
    // Multiple dots - Indonesian thousand separators: 1.000.000
    normalized = cleanStr.replace(/\./g, '');
  } else {
    // No separators or single separator already handled
    normalized = cleanStr;
  }

  const num = parseFloat(normalized);
  if (isNaN(num)) return null;

  return isNegative ? -num : num;
}

// Detect bank from CSV header
export function detectBankFromCSV(header: string[]): BankFormat {
  const headerStr = header.join(',').toLowerCase();

  // Check for common Indonesian bank columns (tanggal or tgl transaksi, keterangan/uraian, debet/debit, kredit/credit, saldo/balance)
  const hasDateCol = headerStr.includes('tanggal') || headerStr.includes('tgl transaksi');
  const hasDescCol = headerStr.includes('keterangan') || headerStr.includes('uraian') || headerStr.includes('deskripsi');
  const hasDebitCol = headerStr.includes('debet') || headerStr.includes('debit') || headerStr.includes('mutasi debet');
  const hasCreditCol = headerStr.includes('kredit') || headerStr.includes('credit') || headerStr.includes('mutasi kredit');
  const hasBalanceCol = headerStr.includes('saldo') || headerStr.includes('balance');

  if (hasDateCol && hasDescCol && hasDebitCol && hasCreditCol && hasBalanceCol) {
    // Could be BCA, Mandiri, BRI, BNI - check specific patterns
    if (headerStr.includes('mutasi debet') && headerStr.includes('mutasi kredit')) {
      return 'MANDIRI';
    }
    if (headerStr.includes('tgl transaksi')) {
      return 'BRI';
    }
    if (headerStr.includes('uraian')) {
      return 'BNI';
    }
    return 'BCA'; // Default for generic Indonesian bank format
  }

  return 'GENERIC_CSV';
}