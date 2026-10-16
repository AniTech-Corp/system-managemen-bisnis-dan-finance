import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { TransactionType } from '@prisma/client';

async function calculateTax(
  auth: { workspace: { id: string }; user: { fullName: string } },
  entityType = 'BADAN_USAHA',
  monthlyRevenueCustom?: number | null,
  _year = 2026
) {
  let monthlyRevenue = Number(monthlyRevenueCustom) || 0;

  if (!monthlyRevenueCustom) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const agg = await prisma.cashTransaction.aggregate({
      where: {
        workspaceId: auth.workspace.id,
        type: TransactionType.INCOME,
        transactionDate: { gte: monthStart, lte: now },
      },
      _sum: { amount: true },
    });
    monthlyRevenue = agg._sum.amount || 0;
  }

  // Perhitungan Pajak PP No. 55 Tahun 2022
  const annualProjectedRevenue = monthlyRevenue * 12;
  let taxableRevenue = 0;
  const finalTaxRate = 0.005; // 0.5%

  if (entityType === 'ORANG_PRIBADI') {
    // PTKP Omset WP OP UMKM: Rp 500.000.000/tahun bebas pajak
    const ptkpThreshold = 500000000;
    if (annualProjectedRevenue > ptkpThreshold) {
      taxableRevenue = (annualProjectedRevenue - ptkpThreshold) / 12;
    } else {
      taxableRevenue = 0;
    }
  } else {
    // Badan Usaha (PT/CV/Firma) langsung 0.5% dari omset bruto
    taxableRevenue = monthlyRevenue;
  }

  const monthlyTaxDue = Math.round(taxableRevenue * finalTaxRate);
  const annualProjectedTaxDue = monthlyTaxDue * 12;

  return {
    entityType,
    entityLabel: entityType === 'ORANG_PRIBADI' ? 'Orang Pribadi (Bebas Pajak s.d. 500 Juta/Thn)' : 'Badan Usaha (PT/CV - Tarif Flat 0.5%)',
    monthlyRevenue,
    annualProjectedRevenue,
    taxableMonthlyRevenue: taxableRevenue,
    taxRate: '0.5%',
    monthlyTaxDue,
    annualProjectedTaxDue,
    legalBasis: 'PP No. 55 Tahun 2022 tentang Penyesuaian Pengaturan Pajak Penghasilan',
    paymentDeadlineNote: 'Wajib disetor paling lambat tanggal 15 bulan berikutnya melalui Kode Billing DJP.',
    calculatedBy: auth.user.fullName,
  };
}

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const entityType = req.nextUrl.searchParams.get('entityType') || 'BADAN_USAHA';
      const monthlyRevenueParam = req.nextUrl.searchParams.get('monthlyRevenue');
      const monthlyRevenueCustom = monthlyRevenueParam ? Number(monthlyRevenueParam) : undefined;
      const year = req.nextUrl.searchParams.get('year') ? Number(req.nextUrl.searchParams.get('year')) : 2026;

      const calculation = await calculateTax(auth, entityType, monthlyRevenueCustom, year);
      return NextResponse.json({ success: true, calculation });
    } catch (err: any) {
      console.error('[kas/tax-calculator] GET error:', err);
      return NextResponse.json({ message: 'Gagal menghitung estimasi pajak. Coba lagi beberapa saat.' }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { entityType = 'BADAN_USAHA', monthlyRevenueCustom, year = 2026 } = await req.json().catch(() => ({}));
      const calculation = await calculateTax(auth, entityType, monthlyRevenueCustom, year);
      return NextResponse.json({ success: true, calculation });
    } catch (err: any) {
      console.error('[kas/tax-calculator] POST error:', err);
      return NextResponse.json({ message: 'Gagal menghitung estimasi pajak. Coba lagi beberapa saat.' }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
