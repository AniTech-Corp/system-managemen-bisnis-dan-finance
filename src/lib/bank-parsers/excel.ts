/**
 * Excel Bank Statement Parser
 * Uses xlsx library (already in dependencies)
 */

import * as XLSX from 'xlsx';
import {
  BankStatementParseResult,
  ParsedBankLine,
  BankStatementMetadata,
  ParseError,
  BankFormat,
  parseIndonesianDate,
  parseIndonesianNumber,
  detectBankFromCSV,
} from './types';

interface ExcelRow {
  [key: string]: unknown;
}

function sheetToRows(worksheet: XLSX.WorkSheet): string[][] {
  // Use header: 1 to get arrays including header row (like CSV parsing)
  const json = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
  return json as string[][];
}

function findHeaderRow(rows: string[][], bankFormat: BankFormat): number {
  const keywords: Record<BankFormat, string[]> = {
    BCA: ['tanggal', 'keterangan', 'debet', 'kredit', 'saldo'],
    MANDIRI: ['tanggal', 'keterangan', 'mutasi debet', 'mutasi kredit', 'saldo'],
    BRI: ['tgl transaksi', 'keterangan', 'debet', 'kredit', 'saldo'],
    BNI: ['tanggal', 'uraian', 'debet', 'kredit', 'saldo'],
    GENERIC_CSV: ['tanggal', 'date', 'keterangan', 'deskripsi', 'debet', 'debit', 'kredit', 'credit', 'saldo', 'balance'],
    EXCEL: ['tanggal', 'keterangan', 'debet', 'kredit', 'saldo'],
    PDF: [],
  };

  const required = keywords[bankFormat] || keywords.GENERIC_CSV;

  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const rowKeys = Object.keys(rows[i]).map((k) => String(k).toLowerCase().trim());
    const matches = required.filter((kw) => rowKeys.some((rk) => rk.includes(kw))).length;
    if (matches >= 3) return i;
  }

  return 0;
}

function normalizeHeader(header: unknown): string {
  return String(header).toLowerCase().trim().replace(/\s+/g, ' ');
}

function mapRowByFormat(row: ExcelRow, rowNum: number, format: BankFormat): ParsedBankLine | null {
  const keys = Object.keys(row).map((k) => normalizeHeader(k));

  // Create a normalized row object
  const normalizedRow: Record<string, unknown> = {};
  Object.entries(row).forEach(([key, value]) => {
    normalizedRow[normalizeHeader(key)] = value;
  });

  // Find date column
  const dateKey = keys.find((k) => k.includes('tanggal') || k.includes('date') || k.includes('tgl'));
  if (!dateKey) return null;
  const date = parseIndonesianDate(normalizedRow[dateKey]);
  if (!date) return null;

  // Find description column
  const descKey = keys.find((k) => k.includes('keterangan') || k.includes('deskripsi') || k.includes('uraian') || k.includes('description') || k.includes('remark'));
  const description = descKey ? String(normalizedRow[descKey] || '').trim() : '';

  // Find amount columns
  const debitKey = keys.find((k) => k.includes('debet') || k.includes('debit') || k.includes('keluar') || k.includes('out') || k.includes('mutasi debet'));
  const creditKey = keys.find((k) => k.includes('kredit') || k.includes('credit') || k.includes('masuk') || k.includes('in') || k.includes('mutasi kredit'));
  const balanceKey = keys.find((k) => k.includes('saldo') || k.includes('balance'));

  const debit = debitKey ? parseIndonesianNumber(normalizedRow[debitKey]) : null;
  const credit = creditKey ? parseIndonesianNumber(normalizedRow[creditKey]) : null;
  const balance = balanceKey ? parseIndonesianNumber(normalizedRow[balanceKey]) : null;

  let direction: 'MASUK' | 'KELUAR';
  let amount: number;

  if (debit !== null && debit > 0) {
    direction = 'KELUAR';
    amount = debit;
  } else if (credit !== null && credit > 0) {
    direction = 'MASUK';
    amount = credit;
  } else {
    // Try single amount column with sign
    const amountKey = keys.find((k) => k.includes('amount') || k.includes('nominal') || k.includes('jumlah') || k.includes('mutasi'));
    if (amountKey) {
      const signedAmount = parseIndonesianNumber(normalizedRow[amountKey]);
      if (signedAmount !== null && signedAmount !== 0) {
        direction = signedAmount > 0 ? 'MASUK' : 'KELUAR';
        amount = Math.abs(signedAmount);
      } else {
        return null;
      }
    } else {
      return null;
    }
  }

  return {
    rowNumber: rowNum,
    transactionDate: date,
    description,
    debitAmount: direction === 'KELUAR' ? amount : undefined,
    creditAmount: direction === 'MASUK' ? amount : undefined,
    balance: balance ?? undefined,
    direction,
    rawData: normalizedRow,
  };
}

function extractMetadata(lines: ParsedBankLine[], format: BankFormat): BankStatementMetadata {
  if (lines.length === 0) {
    return {
      statementDate: new Date(),
      startDate: new Date(),
      endDate: new Date(),
      openingBalance: 0,
      closingBalance: 0,
      currency: 'IDR',
    };
  }

  const sortedLines = [...lines].sort((a, b) => a.transactionDate.getTime() - b.transactionDate.getTime());
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

  let bankName: string | undefined;
  const allDesc = lines.map((l) => l.description.toLowerCase()).join(' ');
  if (allDesc.includes('bca') || allDesc.includes('bank central asia')) bankName = 'BCA';
  else if (allDesc.includes('mandiri') || allDesc.includes('bank mandiri')) bankName = 'Mandiri';
  else if (allDesc.includes('bri') || allDesc.includes('bank rakyat indonesia')) bankName = 'BRI';
  else if (allDesc.includes('bni') || allDesc.includes('bank negara indonesia')) bankName = 'BNI';

  return {
    statementDate: endDate,
    startDate,
    endDate,
    openingBalance,
    closingBalance,
    currency: 'IDR',
    bankName,
  };
}

export async function parseExcelBankStatement(
  file: Buffer,
  fileName: string
): Promise<BankStatementParseResult> {
  const workbook = XLSX.read(file, { type: 'buffer' });

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return {
      lines: [],
      metadata: { statementDate: new Date(), startDate: new Date(), endDate: new Date(), openingBalance: 0, closingBalance: 0, currency: 'IDR' },
      errors: [{ rowNumber: 0, field: 'file', message: 'File Excel tidak memiliki sheet', rawValue: null }],
    };
  }

  const worksheet = workbook.Sheets[sheetName];
  const rawRows = sheetToRows(worksheet);

  if (rawRows.length === 0) {
    return { lines: [], metadata: { statementDate: new Date(), startDate: new Date(), endDate: new Date(), openingBalance: 0, closingBalance: 0, currency: 'IDR' }, errors: [] };
  }

  // Detect bank format from first row (header row)
  const firstRowKeys = rawRows[0].map((v) => normalizeHeader(String(v)));
  const bankFormat = detectBankFromCSV(firstRowKeys);

  // Find header row
  const headerRowIndex = findHeaderRow(rawRows, bankFormat);
  const headerRow = rawRows[headerRowIndex];
  const headers = headerRow.map((v) => normalizeHeader(String(v)));

  // Convert data rows to objects
  const dataRows = rawRows.slice(headerRowIndex + 1);
  const parsedLines: ParsedBankLine[] = [];
  const errors: ParseError[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = headerRowIndex + 1 + idx + 1;
    const mapped: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      mapped[h] = row[i] || '';
    });

    const line = mapRowByFormat(mapped, rowNum, bankFormat);
    if (line) {
      parsedLines.push(line);
    } else {
      const hasData = row.some((v) => v !== null && v !== undefined && String(v).trim());
      if (hasData) {
        errors.push({
          rowNumber: rowNum,
          field: 'mapping',
          message: 'Gagal memetakan kolom ke format standar',
          rawValue: row,
        });
      }
    }
  });

  const metadata = extractMetadata(parsedLines, bankFormat);
  return { lines: parsedLines, metadata, errors };
}

export const excelBankParser = {
  parse: parseExcelBankStatement,
  detectFormat: (file: Buffer, fileName: string): boolean => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ext === 'xlsx' || ext === 'xls';
  },
};