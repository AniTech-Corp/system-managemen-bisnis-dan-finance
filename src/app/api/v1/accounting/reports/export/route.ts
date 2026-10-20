import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { JournalStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';
import { resolveReportRange } from '@/lib/accounting/period';
import {
  getBalanceSheet,
  getCashFlowStatement,
  getEquityStatement,
  getIncomeStatement,
  getTrialBalance,
} from '@/lib/accounting/reports';
import { getAgingReport, getTaxSummary } from '@/lib/accounting/aux-reports';

function num(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const sp = req.nextUrl.searchParams;
      const workspaceId = auth.workspace.id;

      const setting = await prisma.accountingSetting.findUnique({ where: { workspaceId } });
      const range = resolveReportRange({
        period: sp.get('period'),
        startDate: sp.get('startDate'),
        endDate: sp.get('endDate'),
      });

      const [income, balance, cashFlow, equity, trial, entries, agingAr, agingAp, tax] = await Promise.all([
        getIncomeStatement(workspaceId, range),
        getBalanceSheet(workspaceId, range.endDate, setting?.fiscalYearStartMonth ?? 1),
        getCashFlowStatement(workspaceId, range),
        getEquityStatement(workspaceId, range, setting?.currentYearProfitAccountId),
        getTrialBalance(workspaceId, range),
        prisma.journalEntry.findMany({
          where: {
            workspaceId,
            status: JournalStatus.POSTED,
            entryDate: { gte: range.startDate, lte: range.endDate },
          },
          orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }],
          take: 5000,
          include: { lines: { orderBy: { lineNo: 'asc' }, include: { account: { select: { code: true, name: true } } } } },
        }),
        getAgingReport(workspaceId, 'AR', range.endDate),
        getAgingReport(workspaceId, 'AP', range.endDate),
        getTaxSummary(workspaceId, range, setting?.taxProfile ?? 'UMKM_NON_PKP'),
      ]);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'KLIR OS';
      workbook.created = new Date();

      const headerRow = (sheet: ExcelJS.Worksheet, title: string, subtitle: string) => {
        sheet.mergeCells('A1:E1');
        sheet.getCell('A1').value = title;
        sheet.getCell('A1').font = { bold: true, size: 14 };
        sheet.mergeCells('A2:E2');
        sheet.getCell('A2').value = subtitle;
        sheet.getCell('A2').font = { italic: true, color: { argb: 'FF64748B' } };
      };

      /* ── Laba Rugi ── */
      const is = workbook.addWorksheet('Laba Rugi');
      headerRow(is, 'Laporan Laba Rugi', range.label);
      is.addRow([]);
      is.addRow(['Kode', 'Akun', 'Jumlah']);
      is.getRow(4).font = { bold: true };
      is.addRow(['', 'PENDAPATAN', null]);
      for (const r of income.revenue) is.addRow([r.code, r.name, num(r.amount)]);
      is.addRow(['', 'Total Pendapatan', num(income.totals.revenue)]).font = { bold: true };
      is.addRow([]);
      is.addRow(['', 'HARGA POKOK PENJUALAN', null]);
      for (const r of income.cogs) is.addRow([r.code, r.name, num(r.amount)]);
      is.addRow(['', 'Laba Kotor', num(income.totals.grossProfit)]).font = { bold: true };
      is.addRow([]);
      is.addRow(['', 'BEBAN OPERASIONAL', null]);
      for (const r of income.operatingExpenses) is.addRow([r.code, r.name, num(r.amount)]);
      is.addRow(['', 'Total Beban Operasional', num(income.totals.operatingExpenses)]).font = { bold: true };
      is.addRow(['', 'Laba Operasional', num(income.totals.operatingProfit)]).font = { bold: true };
      is.addRow(['', 'Beban Pajak Penghasilan', num(income.totals.taxExpenses)]);
      is.addRow(['', 'LABA BERSIH', num(income.totals.netIncome)]).font = { bold: true };
      is.getColumn(3).numFmt = '#,##0';
      is.getColumn(2).width = 38;
      is.getColumn(1).width = 12;

      /* ── Neraca ── */
      const bs = workbook.addWorksheet('Neraca');
      headerRow(bs, 'Neraca', `Per ${range.endDate.toISOString().slice(0, 10)}`);
      bs.addRow([]);
      bs.addRow(['Kode', 'Akun', 'Jumlah']);
      bs.getRow(4).font = { bold: true };
      bs.addRow(['', 'ASET', null]);
      for (const r of balance.assets) bs.addRow([r.code, r.name, num(r.amount)]);
      bs.addRow(['', 'Total Aset', num(balance.totals.assets)]).font = { bold: true };
      bs.addRow([]);
      bs.addRow(['', 'LIABILITAS', null]);
      for (const r of balance.liabilities) bs.addRow([r.code, r.name, num(r.amount)]);
      bs.addRow(['', 'Total Liabilitas', num(balance.totals.liabilities)]).font = { bold: true };
      bs.addRow([]);
      bs.addRow(['', 'EKUITAS', null]);
      for (const r of balance.equityAccounts) bs.addRow([r.code, r.name, num(r.amount)]);
      bs.addRow(['', 'Laba Tahun Berjalan', num(balance.totals.currentYearProfit)]);
      bs.addRow(['', 'Total Ekuitas', num(balance.totals.equity)]).font = { bold: true };
      bs.addRow([]);
      bs.addRow(['', 'Total Liabilitas + Ekuitas', num(balance.totals.liabilitiesAndEquity)]).font = { bold: true };
      bs.addRow(['', 'Selisih', num(balance.totals.difference)]);
      bs.getColumn(3).numFmt = '#,##0';
      bs.getColumn(2).width = 38;

      /* ── Arus Kas ── */
      const cf = workbook.addWorksheet('Arus Kas');
      headerRow(cf, 'Laporan Arus Kas (Metode Langsung)', range.label);
      cf.addRow([]);
      cf.addRow(['Seksi', 'Kode', 'Akun', 'Jumlah']);
      cf.getRow(4).font = { bold: true };
      cf.addRow(['', '', 'Kas Awal', num(cashFlow.openingCash)]);
      for (const item of cashFlow.items) {
        const label = item.section === 'OPERATING' ? 'Operasional' : item.section === 'INVESTING' ? 'Investasi' : 'Pendanaan';
        cf.addRow([label, item.code, item.name, num(item.amount)]);
      }
      cf.addRow(['', '', 'Arus Kas Operasional', num(cashFlow.totals.operating)]).font = { bold: true };
      cf.addRow(['', '', 'Arus Kas Investasi', num(cashFlow.totals.investing)]).font = { bold: true };
      cf.addRow(['', '', 'Arus Kas Pendanaan', num(cashFlow.totals.financing)]).font = { bold: true };
      cf.addRow(['', '', 'Kas Akhir', num(cashFlow.totals.closingCash)]).font = { bold: true };
      cf.addRow(['', '', 'Saldo Rekening (audit)', num(cashFlow.totals.actualCashBalance)]);
      cf.getColumn(4).numFmt = '#,##0';
      cf.getColumn(3).width = 34;

      /* ── Perubahan Ekuitas ── */
      const eq = workbook.addWorksheet('Perubahan Ekuitas');
      headerRow(eq, 'Laporan Perubahan Ekuitas', range.label);
      eq.addRow([]);
      eq.addRow(['Keterangan', 'Jumlah']);
      eq.getRow(4).font = { bold: true };
      eq.addRow(['Ekuitas Awal', num(equity.openingEquity)]);
      eq.addRow(['Laba Bersih Periode', num(equity.netIncome)]);
      for (const c of equity.contributions) eq.addRow([`Setoran: ${c.name}`, num(c.amount)]);
      for (const w of equity.withdrawals) eq.addRow([`Prive/Dividen: ${w.name}`, -num(w.amount)]);
      eq.addRow(['Ekuitas Akhir', num(equity.totals.closingEquity)]).font = { bold: true };
      eq.getColumn(2).numFmt = '#,##0';
      eq.getColumn(1).width = 40;

      /* ── Neraca Saldo ── */
      const tb = workbook.addWorksheet('Neraca Saldo');
      headerRow(tb, 'Neraca Saldo', range.label);
      tb.addRow([]);
      tb.addRow(['Kode', 'Akun', 'Debit', 'Kredit']);
      tb.getRow(4).font = { bold: true };
      for (const r of trial.rows) {
        tb.addRow([r.code, r.name, num(r.debitSide), num(r.creditSide)]);
      }
      tb.addRow(['', 'TOTAL', num(trial.totals.debit), num(trial.totals.credit)]).font = { bold: true };
      tb.getColumn(3).numFmt = '#,##0';
      tb.getColumn(4).numFmt = '#,##0';
      tb.getColumn(2).width = 38;

      /* ── Jurnal Umum ── */
      const je = workbook.addWorksheet('Jurnal Umum');
      headerRow(je, 'Jurnal Umum', range.label);
      je.addRow([]);
      je.addRow(['No Jurnal', 'Tanggal', 'Keterangan', 'Kode Akun', 'Akun', 'Debit', 'Kredit', 'Sumber']);
      je.getRow(4).font = { bold: true };
      for (const entry of entries) {
        for (const line of entry.lines) {
          je.addRow([
            entry.entryNumber,
            entry.entryDate.toISOString().slice(0, 10),
            line.description || entry.description,
            line.account.code,
            line.account.name,
            num(line.debit),
            num(line.credit),
            entry.source,
          ]);
        }
      }
      je.getColumn(6).numFmt = '#,##0';
      je.getColumn(7).numFmt = '#,##0';
      je.getColumn(5).width = 34;
      je.getColumn(3).width = 34;

      /* ── Umur Piutang & Utang ── */
      for (const report of [agingAr, agingAp]) {
        const isAr = report.type === 'AR';
        const sheet = workbook.addWorksheet(isAr ? 'Umur Piutang' : 'Umur Utang');
        headerRow(
          sheet,
          isAr ? 'Umur Piutang (AR)' : 'Umur Utang (AP)',
          `Per tanggal ${range.endDate.toISOString().slice(0, 10)} — saldo buku besar ${num(report.ledgerBalance)}`
        );
        sheet.addRow([]);
        sheet.addRow([isAr ? 'No. Faktur' : 'Kewajiban', isAr ? 'Pelanggan' : 'Nama', 'Jatuh tempo', 'Terlambat (hari)', 'Nilai']);
        sheet.getRow(4).font = { bold: true };
        for (const row of report.rows) {
          sheet.addRow([
            row.reference,
            row.partner,
            row.dueDate.toISOString().slice(0, 10),
            row.daysOverdue,
            num(row.amount),
          ]);
        }
        sheet.addRow(['', '', '', 'TOTAL', num(report.total)]).font = { bold: true };
        sheet.addRow(['', '', '', 'Saldo buku besar', num(report.ledgerBalance)]);
        sheet.addRow(['', '', '', 'Selisih', num(report.difference)]);
        sheet.getColumn(2).width = 30;
        sheet.getColumn(5).numFmt = '#,##0';
      }

      /* ── Ringkasan PPN ── */
      const taxSheet = workbook.addWorksheet('PPN');
      headerRow(taxSheet, 'Ringkasan PPN', range.label);
      taxSheet.addRow([]);
      taxSheet.addRow(['Komponen', 'Jumlah']);
      taxSheet.getRow(4).font = { bold: true };
      taxSheet.addRow(['PPN Keluaran (2-1310)', num(tax.outputTax)]);
      taxSheet.addRow(['PPN Masukan (1-1600)', num(tax.inputTax)]);
      taxSheet.addRow(['PPN kurang/(lebih) bayar', num(tax.netPayable)]).font = { bold: true };
      for (const w of tax.withholding) {
        if (num(w.amount) === 0) continue;
        taxSheet.addRow([`${w.name} (${w.code})`, num(w.amount)]);
      }
      taxSheet.getColumn(1).width = 34;
      taxSheet.getColumn(2).numFmt = '#,##0';

      const buffer = await workbook.xlsx.writeBuffer();
      const fileName = `laporan-keuangan-${range.periodKey ?? range.endDate.toISOString().slice(0, 10)}.xlsx`;

      return new NextResponse(Buffer.from(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      if (err instanceof Error && /periode|tanggal|bulan/i.test(err.message)) {
        return badRequest(err.message);
      }
      return serverError('reports:export', err, 'Gagal membuat berkas ekspor.');
    }
  },
  { minRole: 'VIEWER' }
);
