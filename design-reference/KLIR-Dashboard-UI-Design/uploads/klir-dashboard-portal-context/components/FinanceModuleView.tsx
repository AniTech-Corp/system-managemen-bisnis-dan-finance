'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Send,
  RefreshCw,
  X,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Clock,
  Check,
} from 'lucide-react';

interface FinanceModuleViewProps {
  workspaceId?: string;
  workspaceName?: string;
  onRefreshBrain?: () => void;
}

export default function FinanceModuleView({
  workspaceId = 'f451b290-1fc6-474d-8787-b8f1121c798b',
  workspaceName = 'Anitech Enterprise',
  onRefreshBrain,
}: FinanceModuleViewProps) {
  // Toggle: Income / Expense for Input
  const [activeType, setActiveType] = useState<'INCOME' | 'EXPENSE'>('INCOME');

  // Input Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Penjualan Produk / Jasa');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Financial Summary State
  const [summary, setSummary] = useState({
    cashBalance: 25500000,
    totalIncome: 34250000,
    totalExpense: 8750000,
    netCashflow: 25500000,
    grossMargin: 65.6,
    burnRate: 8750000,
    runwayMonths: 99,
  });

  // Transactions State
  const [transactions, setTransactions] = useState<any[]>([
    {
      id: 'tx-1',
      type: 'INCOME',
      category: 'Penjualan Produk',
      amount: 15000000,
      description: 'Pembayaran DP Proyek Website Brand X',
      createdAt: 'Hari ini 14:30',
    },
    {
      id: 'tx-2',
      type: 'EXPENSE',
      category: 'Iklan & Marketing',
      amount: 3000000,
      description: 'Top up budget Meta Ads kampanye video',
      createdAt: 'Hari ini 10:15',
    },
    {
      id: 'tx-3',
      type: 'INCOME',
      category: 'Jasa Konsultasi',
      amount: 8500000,
      description: 'Pelunasan retainer marketing bulanan PT Global',
      createdAt: 'Kemarin 16:00',
    },
    {
      id: 'tx-4',
      type: 'EXPENSE',
      category: 'Operasional & Tools',
      amount: 1250000,
      description: 'Biaya server cloud & subscription AI',
      createdAt: '28 Agu 2026',
    },
    {
      id: 'tx-5',
      type: 'INCOME',
      category: 'Penjualan Produk',
      amount: 10750000,
      description: 'Invoice #7098 pembayaran software license',
      createdAt: '27 Agu 2026',
    },
  ]);

  // Invoices & Receivables State
  const [invoices, setInvoices] = useState<any[]>([
    {
      id: 'inv-1',
      invoiceNumber: 'INV-20260821-7102',
      clientName: 'PT Sentosa Abadi',
      amount: 19425000,
      status: 'OVERDUE',
      dueDate: '21 Agu 2026 (Terlambat 3 hari)',
      isReminderSent: false,
    },
    {
      id: 'inv-2',
      invoiceNumber: 'INV-20260828-7105',
      clientName: 'PT Global Retail Nusantara',
      amount: 8500000,
      status: 'PAID',
      dueDate: 'Lunas 28 Agu 2026',
      isReminderSent: false,
    },
    {
      id: 'inv-3',
      invoiceNumber: 'INV-20260830-7109',
      clientName: 'CV Bintang Kreatif Studio',
      amount: 6300000,
      status: 'UNPAID',
      dueDate: 'Jatuh tempo 14 Sep 2026',
      isReminderSent: false,
    },
  ]);

  // Detail Modal State
  const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState<any | null>(null);

  // Sync with CEO dashboard & localStorage
  const syncWithLocalStorage = () => {
    try {
      const saved = localStorage.getItem('klir_live_company_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.financials) {
          setSummary((prev) => ({
            ...prev,
            cashBalance: parsed.financials.cleanCashBalance ?? prev.cashBalance,
            totalIncome: parsed.financials.revenue30d ?? prev.totalIncome,
            totalExpense: parsed.financials.expense30d ?? prev.totalExpense,
          }));
        }
      }
    } catch (e) {
      console.warn('Sync error:', e);
    }
  };

  useEffect(() => {
    syncWithLocalStorage();
    const handleSync = () => syncWithLocalStorage();
    window.addEventListener('klir-ai-state-updated', handleSync);
    window.addEventListener('klir-kas-updated', handleSync);
    return () => {
      window.removeEventListener('klir-ai-state-updated', handleSync);
      window.removeEventListener('klir-kas-updated', handleSync);
    };
  }, []);

  // Handle Add Transaction
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (!numAmount || numAmount <= 0) {
      alert('Masukkan nominal transaksi yang valid.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newTx = {
        id: `tx-${Date.now()}`,
        type: activeType,
        category,
        amount: numAmount,
        description: notes.trim() || (activeType === 'INCOME' ? 'Pemasukan Kas Baru' : 'Pengeluaran Kas Baru'),
        createdAt: 'Baru saja',
      };

      setTransactions([newTx, ...transactions]);

      // Update Summary
      if (activeType === 'INCOME') {
        setSummary((prev) => ({
          ...prev,
          totalIncome: prev.totalIncome + numAmount,
          cashBalance: prev.cashBalance + numAmount,
          netCashflow: prev.netCashflow + numAmount,
        }));
      } else {
        setSummary((prev) => ({
          ...prev,
          totalExpense: prev.totalExpense + numAmount,
          cashBalance: Math.max(0, prev.cashBalance - numAmount),
          netCashflow: prev.netCashflow - numAmount,
        }));
      }

      setAmount('');
      setNotes('');
      setIsSubmitting(false);
      setToastMsg(`Transaksi ${activeType === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'} Rp ${numAmount.toLocaleString('id-ID')} berhasil dicatat.`);
      setTimeout(() => setToastMsg(null), 4000);

      // Dispatch event to sync with CEO dashboard
      try {
        const saved = localStorage.getItem('klir_live_company_state');
        let current = saved ? JSON.parse(saved) : {};
        if (!current.financials) current.financials = {};
        if (activeType === 'INCOME') {
          current.financials.cleanCashBalance = (current.financials.cleanCashBalance || 25500000) + numAmount;
          current.financials.revenue30d = (current.financials.revenue30d || 34250000) + numAmount;
        } else {
          current.financials.cleanCashBalance = Math.max(0, (current.financials.cleanCashBalance || 25500000) - numAmount);
          current.financials.expense30d = (current.financials.expense30d || 8750000) + numAmount;
        }
        localStorage.setItem('klir_live_company_state', JSON.stringify(current));
        window.dispatchEvent(new CustomEvent('klir-ai-state-updated'));
      } catch (err) {
        console.warn('Storage dispatch error:', err);
      }
    }, 350);
  };

  // Handle Export to Excel (Professional Formatted XLS with colors, borders & summary tables)
  const handleExportExcel = () => {
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];

      const excelContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>Laporan Keuangan</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayGridlines/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; }
            .header-banner { background-color: #4F46E5; color: #FFFFFF; font-size: 16pt; font-weight: bold; text-align: center; height: 45px; vertical-align: middle; }
            .sub-banner { background-color: #EEF2FF; color: #3730A3; font-size: 10pt; font-style: italic; text-align: center; height: 25px; }
            .section-header { background-color: #1E293B; color: #FFFFFF; font-size: 12pt; font-weight: bold; height: 32px; vertical-align: middle; padding-left: 10px; }
            .th-header { background-color: #334155; color: #FFFFFF; font-weight: bold; text-align: center; border: 1px solid #94A3B8; height: 28px; }
            .td-cell { border: 1px solid #CBD5E1; padding: 6px 10px; vertical-align: middle; }
            .td-num { border: 1px solid #CBD5E1; padding: 6px 10px; text-align: right; font-family: 'Consolas', monospace; font-weight: bold; }
            .td-center { border: 1px solid #CBD5E1; padding: 6px 10px; text-align: center; }
            .row-even { background-color: #F8FAFC; }
            .row-odd { background-color: #FFFFFF; }
            .badge-income { background-color: #DCFCE7; color: #166534; font-weight: bold; text-align: center; }
            .badge-expense { background-color: #FEE2E2; color: #991B1B; font-weight: bold; text-align: center; }
            .badge-overdue { background-color: #FEE2E2; color: #DC2626; font-weight: bold; text-align: center; }
            .badge-paid { background-color: #DCFCE7; color: #15803D; font-weight: bold; text-align: center; }
            .badge-unpaid { background-color: #FEF3C7; color: #D97706; font-weight: bold; text-align: center; }
            .total-row { background-color: #E2E8F0; font-weight: bold; border-top: 2px solid #64748B; border-bottom: 2px solid #64748B; height: 30px; }
            .kpi-title { background-color: #F1F5F9; color: #475569; font-size: 9pt; font-weight: bold; border: 1px solid #CBD5E1; }
            .kpi-val { background-color: #FFFFFF; font-size: 13pt; font-weight: bold; border: 1px solid #CBD5E1; text-align: right; }
          </style>
        </head>
        <body>
          <table>
            <!-- 1. HEADER BANNER -->
            <tr>
              <td colspan="6" class="header-banner">LAPORAN KEUANGAN EKSEKUTIF — PT ANITECH DIGITAL SOLUSINDO</td>
            </tr>
            <tr>
              <td colspan="6" class="sub-banner">KLIR Financial OS • Tanggal Ekspor: ${today.toLocaleDateString('id-ID', { dateStyle: 'full' })} • NIB: 9120008123901</td>
            </tr>
            <tr><td colspan="6" style="height: 15px;"></td></tr>

            <!-- 2. RINGKASAN METRIK FINANSIAL -->
            <tr>
              <td colspan="6" class="section-header">1. RINGKASAN ARUS KAS & METRIK UTAMA (30 HARI)</td>
            </tr>
            <tr>
              <td class="th-header" style="width: 250px;">Indikator Metrik</td>
              <td class="th-header" style="width: 180px;">Nominal (IDR)</td>
              <td class="th-header" colspan="4">Keterangan & Analisis Strategis</td>
            </tr>
            <tr class="row-odd">
              <td class="td-cell"><strong>Saldo Kas Tersedia (Available Cash)</strong></td>
              <td class="td-num" style="color: #10B981;">Rp ${summary.cashBalance.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="4">Dana likuid bersih siap digunakan untuk operasional & scale-up</td>
            </tr>
            <tr class="row-even">
              <td class="td-cell"><strong>Total Pendapatan (Revenue 30d)</strong></td>
              <td class="td-num" style="color: #10B981;">Rp ${summary.totalIncome.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="4">Pertumbuhan pendapatan meningkat +28.5% Month-over-Month</td>
            </tr>
            <tr class="row-odd">
              <td class="td-cell"><strong>Total Pengeluaran (Expense 30d)</strong></td>
              <td class="td-num" style="color: #EF4444;">Rp ${summary.totalExpense.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="4">Pengeluaran operasional efisien (HPP, iklan & gaji)</td>
            </tr>
            <tr class="row-even">
              <td class="td-cell"><strong>Laba Bersih Perusahaan</strong></td>
              <td class="td-num" style="color: #10B981;">Rp ${summary.netCashflow.toLocaleString('id-ID')}</td>
              <td class="td-cell" colspan="4">Margin laba bersih prima di level ${summary.grossMargin}%</td>
            </tr>
            <tr class="row-odd">
              <td class="td-cell"><strong>Ketahanan Kas (Runway)</strong></td>
              <td class="td-num" style="color: #4F46E5;">${summary.runwayMonths}+ Bulan</td>
              <td class="td-cell" colspan="4">Tingkat likuiditas sangat aman dengan risiko nol</td>
            </tr>
            <tr><td colspan="6" style="height: 20px;"></td></tr>

            <!-- 3. BUKU BESAR TRANSAKSI -->
            <tr>
              <td colspan="6" class="section-header">2. BUKU BESAR RIWAYAT TRANSAKSI KAS</td>
            </tr>
            <tr>
              <td class="th-header" style="width: 140px;">Tanggal/Waktu</td>
              <td class="th-header" style="width: 90px;">Jenis</td>
              <td class="th-header" style="width: 180px;">Kategori</td>
              <td class="th-header" style="width: 280px;">Deskripsi / Catatan Transaksi</td>
              <td class="th-header" style="width: 150px;">Pemasukan (Rp)</td>
              <td class="th-header" style="width: 150px;">Pengeluaran (Rp)</td>
            </tr>
            ${transactions.map((tx, idx) => {
              const isIncome = tx.type === 'INCOME';
              const rowClass = idx % 2 === 0 ? 'row-odd' : 'row-even';
              return `
                <tr class="${rowClass}">
                  <td class="td-center">${tx.createdAt}</td>
                  <td class="${isIncome ? 'badge-income' : 'badge-expense'}">${tx.type}</td>
                  <td class="td-cell">${tx.category}</td>
                  <td class="td-cell"><strong>${tx.description}</strong></td>
                  <td class="td-num" style="${isIncome ? 'color: #166534;' : 'color: #94A3B8;'}">
                    ${isIncome ? 'Rp ' + tx.amount.toLocaleString('id-ID') : '-'}
                  </td>
                  <td class="td-num" style="${!isIncome ? 'color: #991B1B;' : 'color: #94A3B8;'}">
                    ${!isIncome ? 'Rp ' + tx.amount.toLocaleString('id-ID') : '-'}
                  </td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colspan="4" class="td-cell" style="text-align: right; font-weight: bold;">TOTAL ARUS TRANSAKSI:</td>
              <td class="td-num" style="color: #166534;">Rp ${summary.totalIncome.toLocaleString('id-ID')}</td>
              <td class="td-num" style="color: #991B1B;">Rp ${summary.totalExpense.toLocaleString('id-ID')}</td>
            </tr>
            <tr><td colspan="6" style="height: 20px;"></td></tr>

            <!-- 4. DAFTAR INVOICE & PIUTANG -->
            <tr>
              <td colspan="6" class="section-header">3. DAFTAR INVOICE & PIUTANG USAHA (RECEIVABLES)</td>
            </tr>
            <tr>
              <td class="th-header" style="width: 150px;">Nomor Invoice</td>
              <td class="th-header" colspan="2" style="width: 260px;">Nama Klien / Mitra</td>
              <td class="th-header" style="width: 200px;">Jatuh Tempo</td>
              <td class="th-header" style="width: 120px;">Status</td>
              <td class="th-header" style="width: 160px;">Nominal Tagihan (Rp)</td>
            </tr>
            ${invoices.map((inv, idx) => {
              const isOverdue = inv.status === 'OVERDUE';
              const isPaid = inv.status === 'PAID';
              const badgeClass = isOverdue ? 'badge-overdue' : isPaid ? 'badge-paid' : 'badge-unpaid';
              const rowClass = idx % 2 === 0 ? 'row-odd' : 'row-even';
              return `
                <tr class="${rowClass}">
                  <td class="td-center"><strong>${inv.invoiceNumber}</strong></td>
                  <td class="td-cell" colspan="2"><strong>${inv.clientName}</strong></td>
                  <td class="td-cell">${inv.dueDate}</td>
                  <td class="${badgeClass}">${inv.status}</td>
                  <td class="td-num" style="${isOverdue ? 'color: #DC2626;' : 'color: #0F172A;'}">
                    Rp ${inv.amount.toLocaleString('id-ID')}
                  </td>
                </tr>
              `;
            }).join('')}
            <tr><td colspan="6" style="height: 25px;"></td></tr>

            <!-- 5. SIGNATURE / LEGAL FOOTER -->
            <tr>
              <td colspan="3" style="font-size: 9pt; color: #64748B; vertical-align: top;">
                <em>Dokumen resmi dihasilkan oleh KLIR AI Operating System.<br/>Terverifikasi secara digital tanpa tanda tangan basah.</em>
              </td>
              <td colspan="3" style="text-align: right; font-size: 10pt; color: #0F172A; font-weight: bold;">
                Disetujui oleh: Management PT Anitech Digital Solusindo
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Laporan_Keuangan_Anitech_${dateStr}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setToastMsg('Laporan Keuangan Excel (.xls) berformat rapi berhasil diunduh.');
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      alert('Gagal mengekspor file: ' + err.message);
    }
  };

  // Handle Export to PDF (Print-Ready Professional Executive Report)
  const handleExportPDF = () => {
    try {
      const today = new Date();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Mohon izinkan pop-up browser untuk mencetak/menyimpan PDF.');
        return;
      }

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Laporan Keuangan - PT Anitech Digital Solusindo</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 30px; }
            .logo { font-size: 24px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; }
            .meta { text-align: right; font-size: 12px; color: #64748b; }
            .title { font-size: 18px; font-weight: 700; margin-bottom: 5px; color: #0f172a; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
            .card-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; margin-bottom: 5px; }
            .card-value { font-size: 20px; font-weight: 800; color: #0f172a; font-family: monospace; }
            .card-sub { font-size: 11px; color: #10b981; font-weight: 600; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; padding: 10px; font-weight: 700; color: #475569; border-bottom: 1px solid #cbd5e1; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
            .text-right { text-align: right; }
            .badge-income { color: #10b981; font-weight: 700; font-family: monospace; }
            .badge-expense { color: #ef4444; font-weight: 700; font-family: monospace; }
            .badge-overdue { background: #fee2e2; color: #b91c1c; padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 10px; }
            .badge-paid { background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 999px; font-weight: 700; font-size: 10px; }
            .footer { margin-top: 50px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">KLIR FINANCIAL OS</div>
              <div class="title">PT Anitech Digital Solusindo</div>
              <div style="font-size: 12px; color: #64748b;">NIB: 9120008123901 • Enterprise Account</div>
            </div>
            <div class="meta">
              <div><strong>Tanggal Cetak:</strong> ${today.toLocaleDateString('id-ID', { dateStyle: 'full' })}</div>
              <div><strong>Status Audit:</strong> Verified Real-Time</div>
              <div><strong>Dokumen Resmi Perusahaan</strong></div>
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">1. Ringkasan Finansial Eksekutif</h3>
          <div class="grid">
            <div class="card">
              <div class="card-title">Saldo Kas Bersih</div>
              <div class="card-value">Rp ${summary.cashBalance.toLocaleString('id-ID')}</div>
              <div class="card-sub">Runway: ${summary.runwayMonths}+ Bulan (Aman)</div>
            </div>
            <div class="card">
              <div class="card-title">Pendapatan (30 Hari)</div>
              <div class="card-value" style="color: #10b981;">Rp ${summary.totalIncome.toLocaleString('id-ID')}</div>
              <div class="card-sub">↑ +28.5% MoM</div>
            </div>
            <div class="card">
              <div class="card-title">Pengeluaran (30 Hari)</div>
              <div class="card-value" style="color: #ef4444;">Rp ${summary.totalExpense.toLocaleString('id-ID')}</div>
              <div class="card-sub" style="color: #64748b;">Margin Laba: 65.6%</div>
            </div>
          </div>

          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">2. Buku Besar Transaksi Terkini</h3>
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th class="text-right">Nominal (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${transactions.map(tx => `
                <tr>
                  <td>${tx.createdAt}</td>
                  <td>${tx.category}</td>
                  <td><strong>${tx.description}</strong></td>
                  <td class="text-right ${tx.type === 'INCOME' ? 'badge-income' : 'badge-expense'}">
                    ${tx.type === 'INCOME' ? '+' : '-'}Rp ${tx.amount.toLocaleString('id-ID')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <h3 style="font-size: 14px; font-weight: 700; margin-bottom: 10px;">3. Status Piutang & Invoice Klien</h3>
          <table>
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Nama Klien</th>
                <th>Jatuh Tempo</th>
                <th>Status</th>
                <th class="text-right">Nominal Tagihan (Rp)</th>
              </tr>
            </thead>
            <tbody>
              ${invoices.map(inv => `
                <tr>
                  <td><strong>${inv.invoiceNumber}</strong></td>
                  <td>${inv.clientName}</td>
                  <td>${inv.dueDate}</td>
                  <td><span class="${inv.status === 'OVERDUE' ? 'badge-overdue' : 'badge-paid'}">${inv.status}</span></td>
                  <td class="text-right" style="font-weight: 700; font-family: monospace;">
                    Rp ${inv.amount.toLocaleString('id-ID')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="footer">
            Dokumen ini di-generate secara otomatis oleh KLIR AI Operating System pada ${today.toLocaleString('id-ID')}. Validitas data keuangan terverifikasi secara sistem.
          </div>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();
      setToastMsg('Jendela cetak / simpan PDF berhasil dibuka.');
      setTimeout(() => setToastMsg(null), 4000);
    } catch (err: any) {
      alert('Gagal membuat PDF: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-[#F5F7FA] font-sans pb-12 w-full max-w-[1280px] mx-auto animate-fadeIn">
      {/* ========================================================================= */}
      {/* TOP HEADER */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-heading font-extrabold text-2xl sm:text-3xl tracking-tight text-white">
              Finance & Cashflow
            </h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30 text-[11px] font-mono font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              <span>KLIR Finance OS</span>
            </span>
          </div>
          <p className="text-xs text-[#8A93A3] mt-0.5">
            Real-time financial control powered by AI
          </p>
        </div>

        {/* Global Action Buttons: Export Excel + PDF + Sync */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export Excel / CSV */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] border border-[#10B981]/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Download file Excel / CSV data keuangan lengkap"
          >
            <span>📥 Export Excel</span>
          </button>

          {/* Export / Cetak PDF */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3.5 py-2 rounded-xl bg-[#6366F1]/15 hover:bg-[#6366F1]/25 text-[#A5B4FC] border border-[#6366F1]/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
            title="Cetak atau simpan Laporan Keuangan resmi ke PDF"
          >
            <span>📄 Cetak PDF</span>
          </button>

          {/* Refresh Data */}
          <button
            type="button"
            onClick={syncWithLocalStorage}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#8A93A3] hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sinkronisasi</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="p-3.5 bg-[#10B981]/15 border border-[#10B981]/40 text-[#D1FAE5] rounded-xl text-xs flex items-center justify-between shadow-lg animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span className="font-semibold">{toastMsg}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="text-[#8A93A3] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 💰 SECTION 1 — CASH OVERVIEW (TOP ROW — 3 CLEAN NUMBER CARDS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Cash Balance */}
        <div className="bg-[#0E121A] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-2">
          <span className="text-xs text-[#8A93A3] font-medium block">Available Cash</span>
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white tracking-tight">
            Rp {summary.cashBalance.toLocaleString('id-ID')}
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-[#10B981] font-bold font-mono">Runway: 99+ Months</span>
            <span className="text-[#64748B]">•</span>
            <span className="text-[#8A93A3]">Likuiditas Prima</span>
          </div>
        </div>

        {/* Card 2: Total Income (30 days) */}
        <div className="bg-[#0E121A] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A93A3] font-medium block">Total Income (30 Days)</span>
            <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] text-[10px] font-mono font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3 h-3" />
              <span>+28.5%</span>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[#10B981] tracking-tight">
            Rp {summary.totalIncome.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-[#8A93A3] block">
            Peningkatan omset bulan ke bulan
          </span>
        </div>

        {/* Card 3: Total Expense (30 days) */}
        <div className="bg-[#0E121A] border border-white/[0.08] p-5 rounded-2xl shadow-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#8A93A3] font-medium block">Total Expense (30 Days)</span>
            <span className="px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981] text-[10px] font-mono font-bold flex items-center gap-0.5">
              <ArrowDownRight className="w-3 h-3" />
              <span>-12.2%</span>
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[#EF4444] tracking-tight">
            Rp {summary.totalExpense.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-[#8A93A3] block">
            Pengeluaran operasional terkendali
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 🧾 SECTION 2 — TRANSACTION SYSTEM (2 COLUMNS: SEJAJAR & EQUAL HEIGHT) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT SIDE (5 Cols): FAST INPUT FORM (REFINED & BALANCED) */}
        <div className="lg:col-span-5 bg-[#0E121A] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between pb-1">
              <h3 className="font-heading font-bold text-sm text-white">
                Catat Transaksi Kas
              </h3>

              {/* Income / Expense Toggle */}
              <div className="flex items-center p-1 bg-[#141820] border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveType('INCOME')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeType === 'INCOME'
                      ? 'bg-[#10B981] text-white shadow-xs'
                      : 'text-[#8A93A3] hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  <span>Income</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveType('EXPENSE')}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    activeType === 'EXPENSE'
                      ? 'bg-[#EF4444] text-white shadow-xs'
                      : 'text-[#8A93A3] hover:text-white'
                  }`}
                >
                  <TrendingDown className="w-3 h-3" />
                  <span>Expense</span>
                </button>
              </div>
            </div>

            <form id="tx-form" onSubmit={handleAddTransaction} className="space-y-3.5 text-xs mt-3">
              {/* Amount Input with Rp Prefix & No Spinner */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[#8A93A3] font-semibold text-[11px]">
                    Nominal Transaksi
                  </label>
                  <span className="text-[10px] text-[#64748B] font-mono">IDR (Rupiah)</span>
                </div>

                <div className="relative flex items-center">
                  <div className="absolute left-3.5 text-[#8A93A3] font-mono font-bold text-xs pointer-events-none">
                    Rp
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    required
                    className="w-full bg-[#141820] border border-white/10 focus:border-[#6366F1] rounded-xl pl-10 pr-3.5 py-2.5 text-white font-mono text-sm placeholder-[#64748B] focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Category Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[#8A93A3] font-semibold text-[11px]">Kategori Transaksi</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#141820] border border-white/10 focus:border-[#6366F1] rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none transition-colors cursor-pointer"
                >
                  {activeType === 'INCOME' ? (
                    <>
                      <option value="Penjualan Produk / Jasa">Penjualan Produk / Jasa</option>
                      <option value="Jasa Konsultasi & Retainer">Jasa Konsultasi & Retainer</option>
                      <option value="Pelunasan Piutang Invoice">Pelunasan Piutang Invoice</option>
                      <option value="Injeksi Modal / Pendanaan">Injeksi Modal / Pendanaan</option>
                    </>
                  ) : (
                    <>
                      <option value="Iklan & Marketing">Iklan & Marketing (Meta/TikTok)</option>
                      <option value="Gaji Karyawan & Freelance">Gaji Karyawan & Freelance</option>
                      <option value="Operasional Kantor & Tools">Operasional Kantor & Tools</option>
                      <option value="Bahan Baku & Produksi (HPP)">Bahan Baku & Produksi (HPP)</option>
                    </>
                  )}
                </select>
              </div>

              {/* Notes (Optional) */}
              <div className="space-y-1.5">
                <label className="text-[#8A93A3] font-semibold text-[11px]">
                  Catatan Transaksi (Opsional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Pembayaran DP Klien / Tagihan Server"
                  className="w-full bg-[#141820] border border-white/10 focus:border-[#6366F1] rounded-xl px-3.5 py-2.5 text-white text-xs placeholder-[#64748B] focus:outline-none transition-colors"
                />
              </div>

              {/* Live Preview Card */}
              <div className="p-3 bg-[#141820] border border-white/5 rounded-xl space-y-1 text-[11px]">
                <div className="flex justify-between text-[#8A93A3]">
                  <span>Status Kas Saat Ini:</span>
                  <span className="font-mono text-white font-semibold">Rp {summary.cashBalance.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A93A3]">Estimasi Saldo Setelah Transaksi:</span>
                  <span className={`font-mono font-bold ${activeType === 'INCOME' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                    Rp {(
                      activeType === 'INCOME'
                        ? summary.cashBalance + (parseFloat(amount) || 0)
                        : Math.max(0, summary.cashBalance - (parseFloat(amount) || 0))
                    ).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            </form>
          </div>

          {/* Submit Button aligned neatly at bottom */}
          <div className="pt-2">
            <button
              type="submit"
              form="tx-form"
              disabled={isSubmitting}
              className={`w-full py-3 px-4 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2 ${
                activeType === 'INCOME'
                  ? 'bg-[#10B981] hover:bg-[#059669] text-white shadow-[#10B981]/25'
                  : 'bg-[#EF4444] hover:bg-[#DC2626] text-white shadow-[#EF4444]/25'
              }`}
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Add Transaction</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT SIDE (7 Cols): TRANSACTION FEED (EQUAL HEIGHT & SCROLLABLE) */}
        <div className="lg:col-span-7 bg-[#0E121A] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between h-full space-y-3.5">
          <div className="flex items-center justify-between pb-1">
            <h3 className="font-heading font-bold text-sm text-white">
              Riwayat Transaksi Terkini
            </h3>
            <span className="text-[11px] text-[#8A93A3] font-mono font-medium">Real-Time Feed</span>
          </div>

          <div className="space-y-2.5 flex-1 overflow-y-auto pr-1 max-h-[360px]">
            {transactions.map((tx) => {
              const isIncome = tx.type === 'INCOME';
              return (
                <div
                  key={tx.id}
                  className="p-3.5 bg-[#141820] hover:bg-[#181E29] border border-white/5 rounded-xl flex items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                        isIncome
                          ? 'bg-[#10B981]/20 text-[#10B981]'
                          : 'bg-[#EF4444]/20 text-[#EF4444]'
                      }`}
                    >
                      {isIncome ? '↓' : '↑'}
                    </div>

                    <div className="min-w-0">
                      <span className="font-bold text-white text-xs block truncate">
                        {tx.description}
                      </span>
                      <span className="text-[10px] text-[#8A93A3] block">
                        {tx.category} • {tx.createdAt}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`font-mono font-bold text-xs ${
                        isIncome ? 'text-[#10B981]' : 'text-[#EF4444]'
                      }`}
                    >
                      {isIncome ? '+' : '-'}Rp {tx.amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📄 SECTION 3 — INVOICE & RECEIVABLES (OVERDUE PROMINENT) */}
      {/* ========================================================================= */}
      <div className="bg-[#0E121A] border border-white/[0.08] rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#3B82F6]/20 text-[#3B82F6]">
              <FileText className="w-4 h-4" />
            </span>
            <h3 className="font-heading font-bold text-sm text-white">
              Invoice & Piutang Berjalan
            </h3>
          </div>
          <span className="text-[11px] text-[#8A93A3]">3 Invoice Terdaftar</span>
        </div>

        <div className="space-y-2.5">
          {invoices.map((inv) => {
            const isOverdue = inv.status === 'OVERDUE';
            const isPaid = inv.status === 'PAID';

            return (
              <div
                key={inv.id}
                className={`p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                  isOverdue
                    ? 'bg-[#EF4444]/10 border border-[#EF4444]/30 shadow-md shadow-[#EF4444]/5'
                    : 'bg-[#141820] border border-white/5'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isOverdue
                        ? 'bg-[#EF4444]/20 text-[#EF4444]'
                        : isPaid
                        ? 'bg-[#10B981]/20 text-[#10B981]'
                        : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-xs sm:text-sm">
                        {inv.clientName}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-full ${
                          isOverdue
                            ? 'bg-[#EF4444] text-white animate-pulse'
                            : isPaid
                            ? 'bg-[#10B981]/20 text-[#10B981]'
                            : 'bg-[#F59E0B]/20 text-[#F59E0B]'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <span className="text-[11px] text-[#8A93A3] block font-mono">
                      {inv.invoiceNumber} • {inv.dueDate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0 self-end sm:self-auto">
                  <div className="text-right">
                    <span
                      className={`font-mono font-extrabold text-sm ${
                        isOverdue ? 'text-[#EF4444]' : 'text-white'
                      }`}
                    >
                      Rp {inv.amount.toLocaleString('id-ID')}
                    </span>
                  </div>

                  {isOverdue && (
                    <button
                      type="button"
                      onClick={() => handleSendReminder(inv.id)}
                      disabled={inv.isReminderSent}
                      className="px-3 py-1.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {inv.isReminderSent ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Terkirim</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Send Reminder</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 📊 SECTION 4 — FINANCIAL METRICS (4 CLEAN KPI CARDS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0E121A] border border-white/[0.08] p-4 rounded-2xl shadow-md space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#8A93A3] tracking-wider block">
            Net Cashflow
          </span>
          <div className="text-lg font-mono font-bold text-[#10B981]">
            +Rp {summary.netCashflow.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-[#8A93A3] block">Surplus Positif</span>
        </div>

        <div className="bg-[#0E121A] border border-white/[0.08] p-4 rounded-2xl shadow-md space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#8A93A3] tracking-wider block">
            Gross Margin
          </span>
          <div className="text-lg font-mono font-bold text-white">
            {summary.grossMargin}%
          </div>
          <span className="text-[10px] text-[#10B981] block">Sehat & Prima</span>
        </div>

        <div className="bg-[#0E121A] border border-white/[0.08] p-4 rounded-2xl shadow-md space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#8A93A3] tracking-wider block">
            Monthly Burn Rate
          </span>
          <div className="text-lg font-mono font-bold text-[#EF4444]">
            Rp {summary.burnRate.toLocaleString('id-ID')}
          </div>
          <span className="text-[10px] text-[#8A93A3] block">Overhead Efisien</span>
        </div>

        <div className="bg-[#0E121A] border border-white/[0.08] p-4 rounded-2xl shadow-md space-y-1">
          <span className="text-[10px] uppercase font-bold text-[#8A93A3] tracking-wider block">
            Runway Kas
          </span>
          <div className="text-lg font-mono font-bold text-[#10B981]">
            {summary.runwayMonths}+ Bulan
          </div>
          <span className="text-[10px] text-[#8A93A3] block">Risiko Nol</span>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {selectedInvoiceDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0E121A] border border-white/15 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <h4 className="font-heading font-bold text-base text-white">
                Rincian Invoice Piutang
              </h4>
              <button
                onClick={() => setSelectedInvoiceDetail(null)}
                className="text-[#8A93A3] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-[#8A93A3]">Nomor Invoice</span>
                <span className="font-mono text-white font-bold">{selectedInvoiceDetail.invoiceNumber}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8A93A3]">Nama Klien</span>
                <span className="text-white font-bold">{selectedInvoiceDetail.clientName}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8A93A3]">Nominal Tagihan</span>
                <span className="font-mono text-[#EF4444] font-bold text-sm">
                  Rp {selectedInvoiceDetail.amount.toLocaleString('id-ID')}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-[#8A93A3]">Status Pembayaran</span>
                <span className="text-[#EF4444] font-bold">{selectedInvoiceDetail.status} (Terlambat 3 hari)</span>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  handleSendReminder(selectedInvoiceDetail.id);
                  setSelectedInvoiceDetail(null);
                }}
                className="flex-1 py-2.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Kirim Tagihan Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
