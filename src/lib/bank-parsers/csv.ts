/**
 * CSV Bank Statement Parser
 * Supports major Indonesian banks: BCA, Mandiri, BRI, BNI, and generic CSV
 */

import { parse, ParseResult } from 'papaparse';
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

interface RawRow {
  [key: string]: string;
}

function detectDelimiter(sample: string): string {
  const delimiters = [',', ';', '\t', '|'];
  const counts = delimiters.map((d) => {
    const escaped = d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return { delimiter: d, count: (sample.match(new RegExp(escaped, 'g')) || []).length };
  });
  return counts.reduce((max, curr) => (curr.count > max.count ? curr : max), { delimiter: ',', count: 0 }).delimiter;
}

function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/\s+/g, ' ');
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
    const rowValues = rows[i].map((v) => String(v).toLowerCase().trim());
    const matches = required.filter((kw) => rowValues.some((rv) => rv.includes(kw))).length;
    if (matches >= 3) return i;
  }

  return 0;
}

function getRowValue(row: RawRow, ...keys: string[]): unknown {
  const normalizedKeys = keys.map((k) => normalizeHeader(k));
  for (const nk of normalizedKeys) {
    if (row[nk] !== undefined) return row[nk];
  }
  return undefined;
}

function mapBCARow(row: RawRow, rowNum: number): ParsedBankLine | null {
  const date = parseIndonesianDate(getRowValue(row, 'Tanggal'));
  if (!date) return null;

  const description = String(getRowValue(row, 'Keterangan') || '').trim();
  const debit = parseIndonesianNumber(getRowValue(row, 'Debet'));
  const credit = parseIndonesianNumber(getRowValue(row, 'Kredit'));
  const balance = parseIndonesianNumber(getRowValue(row, 'Saldo'));

  let direction: 'MASUK' | 'KELUAR';
  let amount: number;

  if (debit !== null && debit > 0) {
    direction = 'KELUAR';
    amount = debit;
  } else if (credit !== null && credit > 0) {
    direction = 'MASUK';
    amount = credit;
  } else {
    return null;
  }

  return {
    rowNumber: rowNum,
    transactionDate: date,
    description,
    debitAmount: direction === 'KELUAR' ? amount : undefined,
    creditAmount: direction === 'MASUK' ? amount : undefined,
    balance: balance ?? undefined,
    direction,
    rawData: row,
  };
}

function mapMandiriRow(row: RawRow, rowNum: number): ParsedBankLine | null {
  const date = parseIndonesianDate(getRowValue(row, 'Tanggal'));
  if (!date) return null;

  const description = String(getRowValue(row, 'Keterangan') || '').trim();
  const debit = parseIndonesianNumber(getRowValue(row, 'Mutasi Debet', 'Debet'));
  const credit = parseIndonesianNumber(getRowValue(row, 'Mutasi Kredit', 'Kredit'));
  const balance = parseIndonesianNumber(getRowValue(row, 'Saldo'));

  let direction: 'MASUK' | 'KELUAR';
  let amount: number;

  if (debit !== null && debit > 0) {
    direction = 'KELUAR';
    amount = debit;
  } else if (credit !== null && credit > 0) {
    direction = 'MASUK';
    amount = credit;
  } else {
    return null;
  }

  return {
    rowNumber: rowNum,
    transactionDate: date,
    description,
    debitAmount: direction === 'KELUAR' ? amount : undefined,
    creditAmount: direction === 'MASUK' ? amount : undefined,
    balance: balance ?? undefined,
    direction,
    rawData: row,
  };
}

function mapBRIRow(row: RawRow, rowNum: number): ParsedBankLine | null {
  const date = parseIndonesianDate(getRowValue(row, 'Tgl Transaksi', 'Tanggal'));
  if (!date) return null;

  const description = String(getRowValue(row, 'Keterangan') || '').trim();
  const debit = parseIndonesianNumber(getRowValue(row, 'Debet'));
  const credit = parseIndonesianNumber(getRowValue(row, 'Kredit'));
  const balance = parseIndonesianNumber(getRowValue(row, 'Saldo'));

  let direction: 'MASUK' | 'KELUAR';
  let amount: number;

  if (debit !== null && debit > 0) {
    direction = 'KELUAR';
    amount = debit;
  } else if (credit !== null && credit > 0) {
    direction = 'MASUK';
    amount = credit;
  } else {
    return null;
  }

  return {
    rowNumber: rowNum,
    transactionDate: date,
    description,
    debitAmount: direction === 'KELUAR' ? amount : undefined,
    creditAmount: direction === 'MASUK' ? amount : undefined,
    balance: balance ?? undefined,
    direction,
    rawData: row,
  };
}

function mapBNIRow(row: RawRow, rowNum: number): ParsedBankLine | null {
  const date = parseIndonesianDate(getRowValue(row, 'Tanggal'));
  if (!date) return null;

  const description = String(getRowValue(row, 'Uraian', 'Keterangan') || '').trim();
  const debit = parseIndonesianNumber(getRowValue(row, 'Debet'));
  const credit = parseIndonesianNumber(getRowValue(row, 'Kredit'));
  const balance = parseIndonesianNumber(getRowValue(row, 'Saldo'));

  let direction: 'MASUK' | 'KELUAR';
  let amount: number;

  if (debit !== null && debit > 0) {
    direction = 'KELUAR';
    amount = debit;
  } else if (credit !== null && credit > 0) {
    direction = 'MASUK';
    amount = credit;
  } else {
    return null;
  }

  return {
    rowNumber: rowNum,
    transactionDate: date,
    description,
    debitAmount: direction === 'KELUAR' ? amount : undefined,
    creditAmount: direction === 'MASUK' ? amount : undefined,
    balance: balance ?? undefined,
    direction,
    rawData: row,
  };
}

function mapGenericRow(row: RawRow, rowNum: number): ParsedBankLine | null {
  const keys = Object.keys(row).map((k) => normalizeHeader(k));

  const dateKey = keys.find((k) => k.includes('tanggal') || k.includes('date') || k.includes('tgl'));
  if (!dateKey) return null;
  const date = parseIndonesianDate(row[dateKey]);
  if (!date) return null;

  const descKey = keys.find((k) => k.includes('keterangan') || k.includes('deskripsi') || k.includes('uraian') || k.includes('description') || k.includes('remark'));
  const description = descKey ? String(row[descKey] || '').trim() : '';

  const debitKey = keys.find((k) => k.includes('debet') || k.includes('debit') || k.includes('keluar') || k.includes('out') || k.includes('mutasi debet'));
  const creditKey = keys.find((k) => k.includes('kredit') || k.includes('credit') || k.includes('masuk') || k.includes('in') || k.includes('mutasi kredit'));
  const balanceKey = keys.find((k) => k.includes('saldo') || k.includes('balance'));

  const debit = debitKey ? parseIndonesianNumber(row[debitKey]) : null;
  const credit = creditKey ? parseIndonesianNumber(row[creditKey]) : null;
  const balance = balanceKey ? parseIndonesianNumber(row[balanceKey]) : null;

  let direction: 'MASUK' | 'KELUAR';
  let amount: number;

  if (debit !== null && debit > 0) {
    direction = 'KELUAR';
    amount = debit;
  } else if (credit !== null && credit > 0) {
    direction = 'MASUK';
    amount = credit;
  } else {
    const amountKey = keys.find((k) => k.includes('amount') || k.includes('nominal') || k.includes('jumlah') || k.includes('mutasi'));
    if (amountKey) {
      const signedAmount = parseIndonesianNumber(row[amountKey]);
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
    rawData: row,
  };
}

function mapRowByFormat(row: RawRow, rowNum: number, format: BankFormat): ParsedBankLine | null {
  switch (format) {
    case 'BCA':
      return mapBCARow(row, rowNum);
    case 'MANDIRI':
      return mapMandiriRow(row, rowNum);
    case 'BRI':
      return mapBRIRow(row, rowNum);
    case 'BNI':
      return mapBNIRow(row, rowNum);
    case 'GENERIC_CSV':
    default:
      return mapGenericRow(row, rowNum);
  }
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
  // Use detected format for bank name if available
  const formatBankNames: Record<BankFormat, string | undefined> = {
    BCA: 'BCA',
    MANDIRI: 'Mandiri',
    BRI: 'BRI',
    BNI: 'BNI',
    GENERIC_CSV: undefined,
    EXCEL: undefined,
    PDF: undefined,
  };
  bankName = formatBankNames[format];

  // Fallback: try to detect from descriptions
  if (!bankName) {
    const allDesc = lines.map((l) => l.description.toLowerCase()).join(' ');
    if (allDesc.includes('bca') || allDesc.includes('bank central asia')) bankName = 'BCA';
    else if (allDesc.includes('mandiri') || allDesc.includes('bank mandiri')) bankName = 'Mandiri';
    else if (allDesc.includes('bri') || allDesc.includes('bank rakyat indonesia')) bankName = 'BRI';
    else if (allDesc.includes('bni') || allDesc.includes('bank negara indonesia')) bankName = 'BNI';
  }

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

export async function parseCSVBankStatement(
  file: Buffer,
  fileName: string
): Promise<BankStatementParseResult> {
  const text = file.toString('utf-8');
  const sample = text.slice(0, 5000);
  const delimiter = detectDelimiter(sample);

  // @ts-ignore - papaparse overload resolution issue with header: false
  const result: { data: string[][]; errors: Array<{ row?: number; message: string }> } = parse(text, {
    delimiter,
    header: false,
    skipEmptyLines: true,
    encoding: 'utf-8',
  });

  if (result.errors.length > 0) {
    const errors: ParseError[] = result.errors.map((e) => ({
      rowNumber: e.row ?? 0,
      field: 'csv_parse',
      message: e.message,
      rawValue: null,
    }));
    return { lines: [], metadata: { statementDate: new Date(), startDate: new Date(), endDate: new Date(), openingBalance: 0, closingBalance: 0, currency: 'IDR' }, errors };
  }

  const rawRows = result.data as string[][];
  if (rawRows.length === 0) {
    return { lines: [], metadata: { statementDate: new Date(), startDate: new Date(), endDate: new Date(), openingBalance: 0, closingBalance: 0, currency: 'IDR' }, errors: [] };
  }

  // Detect bank format from first row (header row)
  const firstRowKeys = rawRows[0].map((v) => String(v).toLowerCase().trim());
  const bankFormat = detectBankFromCSV(firstRowKeys);

  // Find header row
  const headerRowIndex = findHeaderRow(rawRows, bankFormat);
  const headerRow = rawRows[headerRowIndex];
  const headers = headerRow.map(normalizeHeader);

  // Convert data rows to objects
  const dataRows = rawRows.slice(headerRowIndex + 1);
  const parsedLines: ParsedBankLine[] = [];
  const errors: ParseError[] = [];

  dataRows.forEach((row, idx) => {
    const rowNum = headerRowIndex + 1 + idx + 1;
    const mapped: RawRow = {};
    headers.forEach((h, i) => {
      mapped[h] = row[i] || '';
    });

    const line = mapRowByFormat(mapped, rowNum, bankFormat);
    if (line) {
      parsedLines.push(line);
    } else {
      const hasData = row.some((v) => v && String(v).trim());
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

export const csvBankParser = {
  parse: parseCSVBankStatement,
  detectFormat: (file: Buffer, fileName: string): boolean => {
    const ext = fileName.toLowerCase().split('.').pop();
    return ext === 'csv';
  },
};