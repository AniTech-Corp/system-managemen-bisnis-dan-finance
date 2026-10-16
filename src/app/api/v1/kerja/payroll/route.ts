import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { TransactionType } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';

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
      const { employeeName, role = 'Staf Operasional', basicSalary, allowance = 0, overtime = 0, deductions = 0, monthYear = 'Agustus 2026' } = await req.json();

      if (!employeeName || !basicSalary) {
        return NextResponse.json({ message: 'Nama staf dan gaji pokok wajib diisi.' }, { status: 400 });
      }

      const basic = Number(basicSalary) || 0;
      const allow = Number(allowance) || 0;
      const ot = Number(overtime) || 0;
      const deduct = Number(deductions) || 0;
      const netSalary = Math.max(basic + allow + ot - deduct, 0);

      const payroll = await prisma.employeePayroll.create({
        data: {
          workspaceId: auth.workspace.id,
          employeeName: employeeName.trim(),
          role: role.trim(),
          basicSalary: basic,
          allowance: allow,
          overtime: ot,
          deductions: deduct,
          netSalary,
          monthYear,
          isPaid: false,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Slip gaji untuk ${payroll.employeeName} periode ${payroll.monthYear} berhasil dibuat!`,
        payroll,
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
      const { payrollId } = await req.json();

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

      const result = await prisma.$transaction(async (tx) => {
        const transition = await tx.employeePayroll.updateMany({
          where: { id: payrollId, workspaceId: auth.workspace.id, isPaid: false },
          data: { isPaid: true, paidAt: new Date() },
        });

        if (transition.count === 0) {
          const latest = await tx.employeePayroll.findUnique({ where: { id: payrollId } });
          return { payroll: latest, postedCash: false, alreadyPaid: Boolean(latest?.isPaid) };
        }

        await tx.cashTransaction.create({
          data: {
            workspaceId: auth.workspace.id,
            userId: auth.user.id,
            type: TransactionType.EXPENSE,
            category: 'Gaji Staf & Honor Tim',
            amount: payroll.netSalary,
            description: `Pembayaran Gaji ${payroll.employeeName} (${payroll.role}) Periode ${payroll.monthYear}`,
            paymentMethod: 'TRANSFER_BANK',
          },
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
