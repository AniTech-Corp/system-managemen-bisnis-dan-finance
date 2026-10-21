import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { TransactionType } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { postPayrollAccruedInTx, recordCashTransaction } from '@/lib/accounting/posting';
import { computePayroll } from '@/lib/accounting/payroll';

// GET: Ambil daftar slip gaji karyawan
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;

      const payrolls = await prisma.employeePayroll.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      });

      const totalPayrollAmount = payrolls.reduce((acc, curr) => acc + curr.netSalary, 0);
      const paidCount = payrolls.filter((p) => p.isPaid).length;

      return NextResponse.json({
        summary: {
          totalPayrolls: payrolls.length,
          totalPayrollAmount,
          paidCount,
          unpaidCount: payrolls.length - paidCount,
          totalPph21: payrolls.reduce((acc, curr) => acc + (curr.pph21 ?? 0), 0),
          totalBpjsEmployee: payrolls.reduce((acc, curr) => acc + (curr.bpjsEmployee ?? 0), 0),
          totalBpjsEmployer: payrolls.reduce((acc, curr) => acc + (curr.bpjsEmployer ?? 0), 0),
        },
        payrolls,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat data payroll. Coba lagi beberapa saat.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Buat Slip Gaji Karyawan Baru
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const {
        employeeName,
        role = 'Staf Operasional',
        basicSalary,
        allowance = 0,
        overtime = 0,
        deductions,
        pph21,
        bpjsEmployee,
        bpjsEmployer,
        otherDeductions,
        monthYear = 'Agustus 2026',
        accrualDate,
      } = body;

      if (!employeeName || !basicSalary) {
        return NextResponse.json({ message: 'Nama staf dan gaji pokok wajib diisi.' }, { status: 400 });
      }

      // Kompatibilitas: data/klien lama hanya mengirim `deductions` (total).
      // Kalau rincian baru tidak dikirim, seluruh potongan dianggap "potongan
      // lain" sehingga slip lama tetap bisa dibuat dan jurnalnya balance.
      const hasBreakdown =
        pph21 !== undefined || bpjsEmployee !== undefined || bpjsEmployer !== undefined || otherDeductions !== undefined;
      const legacyDeductions = Number(deductions) || 0;

      const calculated = computePayroll({
        basicSalary: Number(basicSalary) || 0,
        allowance: Number(allowance) || 0,
        overtime: Number(overtime) || 0,
        pph21: hasBreakdown ? Number(pph21) || 0 : 0,
        bpjsEmployee: hasBreakdown ? Number(bpjsEmployee) || 0 : 0,
        bpjsEmployer: hasBreakdown ? Number(bpjsEmployer) || 0 : 0,
        otherDeductions: hasBreakdown ? Number(otherDeductions) || 0 : legacyDeductions,
      });
      if (!calculated.ok) {
        return NextResponse.json({ message: calculated.error }, { status: 400 });
      }
      const pay = calculated.value;
      const netSalary = pay.net;

      // Opsional: tanggal pengakuan beban gaji (mis. mencatat slip bulan lalu).
      let entryDate: Date | undefined;
      if (accrualDate) {
        entryDate = new Date(String(accrualDate));
        if (Number.isNaN(entryDate.getTime())) {
          return NextResponse.json({ message: 'Tanggal pengakuan tidak valid.' }, { status: 400 });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const payroll = await tx.employeePayroll.create({
          data: {
            workspaceId: auth.workspace.id,
            employeeName: employeeName.trim(),
            role: role.trim(),
            basicSalary: Number(basicSalary) || 0,
            allowance: Number(allowance) || 0,
            overtime: Number(overtime) || 0,
            deductions: pay.deductions,
            pph21: pay.pph21,
            bpjsEmployee: pay.bpjsEmployee,
            bpjsEmployer: pay.bpjsEmployer,
            otherDeductions: pay.otherDeductions,
            netSalary,
            monthYear,
            isPaid: false,
          },
        });

        // Basis akrual: beban gaji diakui saat slip dibuat (Dr Beban Gaji /
        // Cr Utang Gaji). Pembayaran nanti hanya melunasi utang.
        const journal = await postPayrollAccruedInTx(tx, {
          workspaceId: auth.workspace.id,
          userId: auth.user.id,
          payroll,
          entryDate,
        });

        return { payroll, journal };
      });

      return NextResponse.json({
        success: true,
        message: `Slip gaji untuk ${result.payroll.employeeName} periode ${result.payroll.monthYear} berhasil dibuat!`,
        payroll: result.payroll,
        journalNumber: result.journal?.entryNumber ?? null,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Payroll gagal dibuat. Periksa data dan coba lagi.') }, { status: 400 });
    }
  },
  { minRole: 'MANAGER' }
);

// PUT: Bayarkan Gaji & Otomatis Catat Pengeluaran ke KLIR Kas
export const PUT = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { payrollId, paymentDate } = await req.json();

      if (!payrollId) {
        return NextResponse.json({ message: 'Payroll ID wajib diisi.' }, { status: 400 });
      }

      const payroll = await prisma.employeePayroll.findUnique({
        where: { id: payrollId },
      });

      if (!payroll || payroll.workspaceId !== auth.workspace.id) {
        return NextResponse.json({ message: 'Data slip gaji tidak ditemukan.' }, { status: 404 });
      }

      if (payroll.isPaid) {
        return NextResponse.json({ message: 'Gaji karyawan ini sudah dibayarkan sebelumnya.' }, { status: 400 });
      }

      let paidAt = new Date();
      if (paymentDate) {
        paidAt = new Date(String(paymentDate));
        if (Number.isNaN(paidAt.getTime())) {
          return NextResponse.json({ message: 'Tanggal pembayaran tidak valid.' }, { status: 400 });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const transition = await tx.employeePayroll.updateMany({
          where: { id: payrollId, workspaceId: auth.workspace.id, isPaid: false },
          data: { isPaid: true, paidAt },
        });

        if (transition.count === 0) {
          const latest = await tx.employeePayroll.findUnique({ where: { id: payrollId } });
          return { payroll: latest, postedCash: false, alreadyPaid: Boolean(latest?.isPaid) };
        }

        // Satu pintu: baris kas + jurnal pelunasan utang gaji (Dr Utang Gaji /
        // Cr Kas). Tanpa ini, pembayaran gaji tidak muncul di Laporan Keuangan.
        await recordCashTransaction(tx, {
          workspaceId: auth.workspace.id,
          userId: auth.user.id,
          type: TransactionType.EXPENSE,
          category: 'Gaji Staf & Honor Tim',
          amount: payroll.netSalary,
          description: `Pembayaran Gaji ${payroll.employeeName} (${payroll.role}) Periode ${payroll.monthYear}`,
          paymentMethod: 'TRANSFER_BANK',
          transactionDate: paidAt,
          payrollId: payroll.id,
        });

        const updated = await tx.employeePayroll.findUnique({ where: { id: payrollId } });
        return { payroll: updated, postedCash: true, alreadyPaid: false };
      });

      if (!result.payroll) {
        return NextResponse.json({ message: 'Data slip gaji tidak ditemukan.' }, { status: 404 });
      }
      const updatedPayroll = result.payroll;

      return NextResponse.json({
        success: true,
        message: result.alreadyPaid
          ? `Gaji ${payroll.employeeName} sudah dibayarkan sebelumnya; transaksi kas tidak digandakan.`
          : `Gaji Rp ${payroll.netSalary.toLocaleString()} untuk ${payroll.employeeName} telah dibayarkan & otomatis tercatat di KLIR Kas!`,
        payroll: updatedPayroll,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Pembayaran payroll gagal diproses. Coba lagi beberapa saat.') }, { status: 400 });
    }
  },
  { minRole: 'MANAGER' }
);
