import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loanAmount = 100000000, tenorMonths = 24, annualInterestRate = 6 } = body;

    const principal = Number(loanAmount);
    const tenor = Number(tenorMonths);
    const monthlyInterestRate = (Number(annualInterestRate) / 100) / 12;

    // Flat interest calculation for KUR simulation
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
      },
    });
  } catch (error: any) {
    return NextResponse.json({ message: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
