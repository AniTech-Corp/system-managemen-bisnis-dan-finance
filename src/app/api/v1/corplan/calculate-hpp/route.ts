import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const { rawMaterialCost = 0, laborCost = 0, overheadCost = 0, sellingPrice = 0, monthlyVolume = 1 } = body;

      const totalHPPPerUnit = Number(rawMaterialCost) + Number(laborCost) + Number(overheadCost);
      const grossProfitPerUnit = Number(sellingPrice) - totalHPPPerUnit;
      const marginPercentage = sellingPrice > 0 ? ((grossProfitPerUnit / Number(sellingPrice)) * 100).toFixed(2) : '0';
      const totalMonthlyRevenue = Number(sellingPrice) * Number(monthlyVolume);
      const totalMonthlyCost = totalHPPPerUnit * Number(monthlyVolume);
      const totalMonthlyGrossProfit = grossProfitPerUnit * Number(monthlyVolume);

      return NextResponse.json({
        success: true,
        calculation: {
          rawMaterialCost: Number(rawMaterialCost),
          laborCost: Number(laborCost),
          overheadCost: Number(overheadCost),
          totalHPPPerUnit,
          sellingPrice: Number(sellingPrice),
          grossProfitPerUnit,
          marginPercentage: `${marginPercentage}%`,
          monthlyVolume: Number(monthlyVolume),
          totalMonthlyRevenue,
          totalMonthlyCost,
          totalMonthlyGrossProfit,
          calculatedBy: auth.user.fullName,
        },
      });
    } catch (error: any) {
      console.error('[corplan/calculate-hpp] POST error:', error);
      return NextResponse.json({ message: publicApiError('Perhitungan HPP gagal diproses.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
