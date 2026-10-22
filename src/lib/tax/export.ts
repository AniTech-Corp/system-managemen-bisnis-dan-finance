import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { TaxDocType, TaxPeriodStatus, TaxType } from '@prisma/client';
import { prisma } from '../prisma';
import { generatePdfBuffer, type PdfSection } from '../pdf-engine';
import { formatRupiah, round2, toNum } from './calc';
import { formatDateId, formatMonthId, wibParts } from './dates';
import {
  ACTIVE_TAX_TYPES,
  TAX_DOC_LABEL,
  TAX_TYPE_LABEL,
  TAX_TYPE_SHORT,
  TAX_DOC_SHORT,
} from './constants';
import {
  buildRecap,
  getTaxSetting,
  getYearFigures,
  computePeriodAmount,
  type PeriodAmount,
  type RecapResult,
  type TaxSettingView,
  type DeadlineView,
  toDeadlineView,
} from './service';

export interface TaxExportDocument {
  id: string;
  taxPeriodId: string | null;
  docType: TaxDocType;
  status: string;
  docNumber: string | null;
  fileName: string | null;
  sourceType: string | null;
  sourceId: string | null;
  amount: number | null;
  createdAt: Date;
}

export interface TaxExportData {
  companyName: string;
  generatedAt: Date;
  startDate: Date;
  endDate: Date;
  setting: TaxSettingView;
  recaps: RecapResult[];
  periods: Array<{
    id: string;
    taxType: TaxType;
    year: number;
    month: number;
    status: TaxPeriodStatus;
    amount: PeriodAmount;
  }>;
  documents: TaxExportDocument[];
  deadlines: DeadlineView[];
  totals: { dpp: number; taxAmount: number; count: number };
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31).trim() || 'Pajak';
}

function csvCell(value: unknown): string {
  const text = String(value ?? '');
  if (/[";\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines = [headers.map(csvCell).join(';')];
  for (const row of rows) lines.push(row.map(csvCell).join(';'));
  return `\uFEFF${lines.join('\r\n')}`;
}

export async function buildExportData(params: {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
  taxTypes?: TaxType[];
}): Promise<TaxExportData> {
  const { workspaceId, startDate, endDate } = params;
  const taxTypes =
    params.taxTypes && params.taxTypes.length > 0 ? params.taxTypes : ACTIVE_TAX_TYPES;

  const [{ setting }, workspace] = await Promise.all([
    getTaxSetting(workspaceId),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } }),
  ]);

  const startParts = wibParts(startDate);
  const endParts = wibParts(endDate);
  const figureYears: number[] = [];
  for (let y = startParts.year; y <= endParts.year; y += 1) figureYears.push(y);

  const figuresByYear = new Map<number, Awaited<ReturnType<typeof getYearFigures>>>();
  for (const year of figureYears) {
    figuresByYear.set(year, await getYearFigures(workspaceId, year));
  }

  const [periodRows, documentRows, deadlineRows, recaps] = await Promise.all([
    prisma.taxPeriod.findMany({
      where: {
        workspaceId,
        taxType: { in: taxTypes },
        startDate: { gte: startDate },
        endDate: { lte: endDate },
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { taxType: 'asc' }],
    }),
    prisma.taxDocument.findMany({
      where: {
        workspaceId,
        OR: [
          { taxPeriodId: { not: null } },
          { createdAt: { gte: startDate, lte: endDate } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    }),
    prisma.complianceDeadline.findMany({
      where: { workspaceId, isActive: true, dueDate: { gte: startDate, lte: endDate } },
      orderBy: { dueDate: 'asc' },
      take: 1000,
    }),
    Promise.all(
      taxTypes.map((taxType) =>
        buildRecap({ workspaceId, taxType, startDate, endDate, groupBy: 'category' })
      )
    ),
  ]);

  const periods = periodRows.map((p) => {
    const figures = figuresByYear.get(p.year);
    return {
      id: p.id,
      taxType: p.taxType,
      year: p.year,
      month: p.month,
      status: p.status,
      amount: figures
        ? computePeriodAmount(p.taxType, p.year, p.month, figures, setting)
        : {
            amount: 0,
            dpp: 0,
            outputTax: 0,
            inputTax: 0,
            overpayment: 0,
            transactionCount: 0,
            note: '',
            ledgerAmount: null,
            ledgerDifference: null,
          },
    };
  });

  // Saring dokumen agar hanya milik periode dalam rentang (atau dokumen bebas
  // yang dibuat dalam rentang).
  const periodIds = new Set(periods.map((p) => p.id));
  const documents: TaxExportDocument[] = documentRows
    .filter((d) => !d.taxPeriodId || periodIds.has(d.taxPeriodId))
    .map((d) => ({
      id: d.id,
      taxPeriodId: d.taxPeriodId,
      docType: d.docType,
      status: d.status,
      docNumber: d.docNumber,
      fileName: d.fileName,
      sourceType: d.sourceType,
      sourceId: d.sourceId,
      amount: d.amount === null ? null : toNum(d.amount),
      createdAt: d.createdAt,
    }));

  const totals = recaps.reduce(
    (acc, r) => ({
      dpp: round2(acc.dpp + r.totals.dpp),
      taxAmount: round2(acc.taxAmount + r.totals.taxAmount),
      count: acc.count + r.totals.count,
    }),
    { dpp: 0, taxAmount: 0, count: 0 }
  );

  return {
    companyName: workspace?.name ?? 'Workspace',
    generatedAt: new Date(),
    startDate,
    endDate,
    setting,
    recaps,
    periods,
    documents,
    deadlines: deadlineRows.map((d) => toDeadlineView(d)),
    totals,
  };
}

function periodLabel(p: { month: number; year: number }): string {
  return formatMonthId(p.year, p.month);
}

/* ───────────────────────────── Excel ───────────────────────────── */

export async function buildTaxExcel(data: TaxExportData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KLIR OS — Modul Pajak';
  workbook.created = data.generatedAt;

  const rangeLabel = `${formatDateId(data.startDate)} – ${formatDateId(data.endDate)}`;

  const summary = workbook.addWorksheet('Ringkasan');
  summary.columns = [
    { key: 'label', width: 34 },
    { key: 'value', width: 24 },
    { key: 'count', width: 14 },
  ];
  summary.mergeCells('A1:C1');
  summary.getCell('A1').value = `Rekap Pajak — ${data.companyName}`;
  summary.getCell('A1').font = { bold: true, size: 16 };
  summary.mergeCells('A2:C2');
  summary.getCell('A2').value = `Periode ${rangeLabel} • dibuat ${formatDateId(data.generatedAt)} • NPWP ${data.setting.npwp ?? '-'}`;
  summary.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
  summary.addRow([]);
  summary.addRow(['Jenis Pajak', 'Pajak Terutang', 'Jumlah Baris']);
  summary.getRow(4).font = { bold: true };
  for (const recap of data.recaps) {
    summary.addRow([TAX_TYPE_LABEL[recap.taxType], recap.totals.taxAmount, recap.totals.count]);
  }
  summary.addRow(['TOTAL', data.totals.taxAmount, data.totals.count]).font = { bold: true };
  summary.getColumn(2).numFmt = '#,##0';
  summary.addRow([]);
  summary.addRow(['Catatan', 'Angka disusun dari dokumen sumber (faktur, kas, payroll, bukti potong).']);
  summary.getRow(summary.rowCount).getCell(1).font = { bold: true };

  for (const recap of data.recaps) {
    const sheet = workbook.addWorksheet(sanitizeSheetName(TAX_TYPE_SHORT[recap.taxType]));
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = `${TAX_TYPE_LABEL[recap.taxType]} — ${rangeLabel}`;
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.mergeCells('A2:I2');
    sheet.getCell('A2').value = recap.note;
    sheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
    sheet.addRow([]);
    sheet.addRow([
      'Tanggal',
      'Masa',
      'Sumber',
      'Referensi',
      'Pihak',
      'Kategori',
      'DPP',
      'Tarif %',
      'Pajak',
    ]);
    sheet.getRow(4).font = { bold: true };
    for (const row of recap.rows.slice(0, 2000)) {
      sheet.addRow([
        formatDateId(row.date),
        row.monthKey,
        row.sourceType,
        row.reference,
        row.partner,
        row.category,
        row.dpp,
        row.rate,
        row.taxAmount,
      ]);
    }
    sheet.addRow(['', '', '', '', '', 'TOTAL', recap.totals.dpp, '', recap.totals.taxAmount]).font = {
      bold: true,
    };
    sheet.getColumn(7).numFmt = '#,##0';
    sheet.getColumn(9).numFmt = '#,##0';
    sheet.getColumn(4).width = 26;
    sheet.getColumn(5).width = 24;
    sheet.getColumn(6).width = 22;
  }

  const docs = workbook.addWorksheet('Daftar Dokumen');
  docs.addRow(['Masa', 'Jenis Pajak', 'Tipe Dokumen', 'Nomor', 'Status', 'Nama File', 'Sumber', 'Dibuat']);
  docs.getRow(1).font = { bold: true };
  for (const doc of data.documents) {
    const period = data.periods.find((p) => p.id === doc.taxPeriodId);
    docs.addRow([
      period ? periodLabel(period) : '-',
      period ? TAX_TYPE_SHORT[period.taxType] : '-',
      TAX_DOC_LABEL[doc.docType] ?? doc.docType,
      doc.docNumber ?? '-',
      doc.status,
      doc.fileName ?? '-',
      doc.sourceType ?? '-',
      formatDateId(doc.createdAt),
    ]);
  }
  docs.getColumn(3).width = 24;
  docs.getColumn(6).width = 32;

  const deadlines = workbook.addWorksheet('Kalender Kepatuhan');
  deadlines.addRow(['Tenggat', 'Kategori', 'Jatuh Tempo', 'Rekomendasi Hari Kerja', 'Status', 'Sumber']);
  deadlines.getRow(1).font = { bold: true };
  for (const d of data.deadlines) {
    deadlines.addRow([
      d.title,
      d.category,
      formatDateId(d.dueDate),
      formatDateId(d.recommendedDate),
      d.status,
      d.source,
    ]);
  }
  deadlines.getColumn(1).width = 40;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/* ───────────────────────────── CSV ───────────────────────────── */

export async function buildTaxCsvZip(data: TaxExportData): Promise<Buffer> {
  const zip = new JSZip();
  const rangeLabel = `${formatDateId(data.startDate)} – ${formatDateId(data.endDate)}`;

  const summaryRows = data.recaps.map((r) => [
    TAX_TYPE_LABEL[r.taxType],
    r.totals.dpp,
    r.totals.taxAmount,
    r.totals.count,
  ]);
  summaryRows.push(['TOTAL', data.totals.dpp, data.totals.taxAmount, data.totals.count]);
  zip.file(
    '00-ringkasan.csv',
    toCsv(['Jenis Pajak', 'DPP', 'Pajak', 'Jumlah Baris'], summaryRows)
  );

  for (const recap of data.recaps) {
    const rows = recap.rows.map((r) => [
      formatDateId(r.date),
      r.monthKey,
      r.sourceType,
      r.reference,
      r.partner,
      r.category,
      r.dpp,
      r.rate,
      r.taxAmount,
    ]);
    rows.push(['', '', '', '', '', 'TOTAL', recap.totals.dpp, '', recap.totals.taxAmount]);
    zip.file(
      `${TAX_TYPE_SHORT[recap.taxType].replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}.csv`,
      toCsv(
        ['Tanggal', 'Masa', 'Sumber', 'Referensi', 'Pihak', 'Kategori', 'DPP', 'Tarif %', 'Pajak'],
        rows
      )
    );
  }

  zip.file(
    '90-dokumen.csv',
    toCsv(
      ['Masa', 'Jenis Pajak', 'Tipe Dokumen', 'Nomor', 'Status', 'Nama File', 'Sumber', 'Dibuat'],
      data.documents.map((d) => {
        const period = data.periods.find((p) => p.id === d.taxPeriodId);
        return [
          period ? periodLabel(period) : '-',
          period ? TAX_TYPE_SHORT[period.taxType] : '-',
          TAX_DOC_SHORT[d.docType] ?? d.docType,
          d.docNumber ?? '-',
          d.status,
          d.fileName ?? '-',
          d.sourceType ?? '-',
          formatDateId(d.createdAt),
        ];
      })
    )
  );

  zip.file(
    '91-kalender.csv',
    toCsv(
      ['Tenggat', 'Kategori', 'Jatuh Tempo', 'Rekomendasi', 'Status', 'Sumber'],
      data.deadlines.map((d) => [
        d.title,
        d.category,
        formatDateId(d.dueDate),
        formatDateId(d.recommendedDate),
        d.status,
        d.source,
      ])
    )
  );

  const readme = [
    `PAKET DATA PAJAK — ${data.companyName}`,
    `Periode: ${rangeLabel}`,
    `Dibuat: ${formatDateId(data.generatedAt)}`,
    '',
    'Isi paket:',
    '- 00-ringkasan.csv : total per jenis pajak',
    '- <jenis>.csv     : rincian transaksi per jenis pajak',
    '- 90-dokumen.csv  : daftar bukti/dokumen pendukung',
    '- 91-kalender.csv : tenggat setor & lapor',
    '',
    'Keterangan kolom:',
    'DPP   = Dasar Pengenaan Pajak (nilai sebelum pajak)',
    'Tarif = persen, mis. 11 berarti 11%',
    'Pajak = nilai pajak terutang/potongan',
    '',
    'Pemisah kolom memakai titik koma (;) agar terbuka rapi di Excel Indonesia.',
    'Angka disusun dari dokumen sumber KLIR: faktur, transaksi kas, payroll, dan bukti potong.',
    'Dokumen ini adalah alat bantu administrasi, bukan pengganti konsultasi pajak.',
  ].join('\r\n');
  zip.file('README.txt', `\uFEFF${readme}`);

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return buffer;
}

/* ───────────────────────────── PDF ───────────────────────────── */

export async function buildTaxPdf(data: TaxExportData): Promise<Buffer> {
  const rangeLabel = `${formatDateId(data.startDate)} – ${formatDateId(data.endDate)}`;

  const sections: PdfSection[] = [
    {
      heading: 'Ringkasan Kewajiban Pajak',
      paragraphs: [
        `Periode: ${rangeLabel}`,
        `NPWP: ${data.setting.npwp ?? '-'} • Status PKP: ${data.setting.enablePpn ? 'PKP' : 'Non-PKP'} • KPP: ${data.setting.kppName ?? '-'}`,
      ],
      table: {
        headers: ['Jenis Pajak', 'DPP', 'Pajak', 'Baris'],
        rows: [
          ...data.recaps.map((r) => [
            TAX_TYPE_LABEL[r.taxType],
            formatRupiah(r.totals.dpp),
            formatRupiah(r.totals.taxAmount),
            r.totals.count,
          ]),
          ['TOTAL', formatRupiah(data.totals.dpp), formatRupiah(data.totals.taxAmount), data.totals.count],
        ],
      },
    },
  ];

  for (const recap of data.recaps) {
    if (recap.rows.length === 0) continue;
    sections.push({
      heading: `${TAX_TYPE_LABEL[recap.taxType]}`,
      paragraphs: [recap.note],
      table: {
        headers: ['Masa', 'Referensi', 'Kategori', 'DPP', 'Pajak'],
        rows: [
          ...recap.rows.slice(0, 35).map((r) => [
            r.monthKey,
            r.reference.slice(0, 28),
            r.category.slice(0, 22),
            formatRupiah(r.dpp),
            formatRupiah(r.taxAmount),
          ]),
          ['TOTAL', '', '', formatRupiah(recap.totals.dpp), formatRupiah(recap.totals.taxAmount)],
        ],
      },
    });
    if (recap.rows.length > 35) {
      sections.push({
        heading: '',
        paragraphs: [`… ${recap.rows.length - 35} baris lainnya tersedia pada ekspor Excel/CSV.`],
      });
    }
  }

  const missingDocs = data.periods.length;
  sections.push({
    heading: 'Kelengkapan Dokumen',
    paragraphs: [
      `Total dokumen tersimpan pada rentang ini: ${data.documents.length}.`,
      `Masa pajak dalam rentang: ${missingDocs}.`,
      data.documents.length === 0
        ? 'Belum ada dokumen yang diunggah. Lengkapi bukti setor, bukti potong, dan bukti lapor sebelum arsip diserahkan ke akuntan.'
        : 'Rincian dokumen tersedia pada sheet "Daftar Dokumen" di ekspor Excel.',
    ],
  });

  sections.push({
    heading: 'Tenggat Terdekat',
    table: {
      headers: ['Tenggat', 'Jatuh Tempo', 'Rekomendasi', 'Status'],
      rows: data.deadlines.slice(0, 20).map((d) => [
        d.title.slice(0, 40),
        formatDateId(d.dueDate),
        formatDateId(d.recommendedDate),
        d.status,
      ]),
    },
  });

  return generatePdfBuffer({
    title: 'Paket Data Pajak',
    subtitle: `${data.companyName} • ${rangeLabel}`,
    companyName: data.companyName,
    dateStr: formatDateId(data.generatedAt),
    statCards: [
      { label: 'Total Pajak', value: formatRupiah(data.totals.taxAmount) },
      { label: 'DPP', value: formatRupiah(data.totals.dpp) },
      { label: 'Dokumen', value: data.documents.length },
    ],
    sections,
    disclaimer:
      'Dokumen ini dihasilkan otomatis oleh KLIR OS sebagai alat bantu administrasi. Angka dapat berubah bila ada transaksi yang belum dicatat. Verifikasi akhir dan kepatuhan perpajakan tetap menjadi tanggung jawab wajib pajak/konsultan pajak.',
  });
}
