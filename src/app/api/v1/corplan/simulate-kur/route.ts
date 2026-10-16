import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const { loanAmount = 100000000, tenorMonths = 24, annualInterestRate = 6 } = body;

      const principal = Number(loanAmount);
      const tenor = Number(tenorMonths);

      // Perhitungan Bunga Flat Subsidi KUR Pemerintah (6% per tahun)
      const totalInterest = principal * (Number(annualInterestRate) / 100) * (tenor / 12);
      const totalRepayment = principal + totalInterest;
      const monthlyInstallment = Math.round(totalRepayment / tenor);
      const monthlyPrincipal = Math.round(principal / tenor);
      const monthlyInterest = Math.round(totalInterest / tenor);

      return NextResponse.json({
        success: true,
        simulation: {
          loanAmount: principal,
          tenorMonths: tenor,
          annualInterestRate: `${annualInterestRate}%`,
          monthlyInstallment,
          monthlyPrincipal,
          monthlyInterest,
          totalInterest,
          totalRepayment,
          simulatedBy: auth.user.fullName,
        },
      });
    } catch (error: any) {
      console.error('[corplan/simulate-kur] POST error:', error);
      return NextResponse.json({ message: publicApiError('Simulasi KUR gagal diproses.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
