import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { TransactionType } from '@prisma/client';
import { resolveDateRange } from '@/lib/time-series-engine';
import { publicApiError } from '@/lib/api-error';

function calculateScore(revenue: number, expense: number, cash: number, hasRealData: boolean) {
  // 1. Profit Margin Score (Max 35 Poin)
  const netProfit = revenue - expense;
  const profitMarginPct = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  let marginScore = 0;
  if (profitMarginPct >= 30) marginScore = 35;
  else if (profitMarginPct >= 20) marginScore = 30;
  else if (profitMarginPct >= 10) marginScore = 20;
  else if (profitMarginPct > 0) marginScore = 10;
  else marginScore = 0;

  // 2. Liquidity Ratio Score (Max 35 Poin)
  const liquidityMonths = expense > 0 ? cash / expense : cash > 0 ? 12 : 0;
  let liquidityScore = 0;
  if (liquidityMonths >= 6) liquidityScore = 35;
  else if (liquidityMonths >= 3) liquidityScore = 25;
  else if (liquidityMonths >= 1) liquidityScore = 15;
  else if (liquidityMonths > 0) liquidityScore = 5;
  else liquidityScore = 0;

  // 3. Operational Discipline Score (Max 30 Poin)
  const disciplineScore = hasRealData ? 30 : 15;

  const totalScore = marginScore + liquidityScore + disciplineScore;

  let grade = 'A+';
  let gradeLabel = 'SANGAT SEHAT & BANKABLE';
  let summary = 'Kondisi finansial bisnis Anda sangat prima, memiliki daya tahan kas kuat, dan memenuhi kriteria kelayakan pembiayaan perbankan (Bankable).';

  if (!hasRealData && revenue === 0 && expense === 0) {
    grade = 'N/A';
    gradeLabel = 'BELUM ADA TRANSAKSI';
    summary = 'Belum ada transaksi yang tercatat pada periode ini. Mulai catat pemasukan & pengeluaran di modul Kas.';
  } else if (totalScore < 50) {
    grade = 'D';
    gradeLabel = 'BERISIKO TINGGI';
    summary = 'Bisnis mengalami defisit atau likuiditas terlalu tipis. Prioritaskan efisiensi biaya dan percepatan perputaran kas.';
  } else if (totalScore < 70) {
    grade = 'C';
    gradeLabel = 'CUKUP / PERLU PERBAIKAN';
    summary = 'Kondisi kas stabil namun margin keuntungan masih perlu dioptimalkan agar cadangan kas lebih tebal.';
  } else if (totalScore < 85) {
    grade = 'B';
    gradeLabel = 'SEHAT & STABIL';
    summary = 'Keuangan berjalan teratur dengan margin positif. Terus pertahankan kontrol biaya operasional.';
  }

  return {
    totalScore: hasRealData || revenue > 0 ? totalScore : 0,
    grade,
    gradeLabel,
    summary,
    breakdown: {
      marginScore,
      liquidityScore,
      disciplineScore,
      profitMarginPct: Math.round(profitMarginPct * 10) / 10,
      liquidityMonths: Math.round(liquidityMonths * 10) / 10,
    },
  };
}

async function computeHealth(workspaceId: string, monthParam?: string | null, customRevenue?: number, customExpense?: number, customCash?: number) {
  const hasProvidedNumber = (value: unknown) => value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));
  const hasCustomRevenue = hasProvidedNumber(customRevenue);
  const hasCustomExpense = hasProvidedNumber(customExpense);
  const hasCustomCash = hasProvidedNumber(customCash);
  let revenue = hasCustomRevenue ? Number(customRevenue) : 0;
  let expense = hasCustomExpense ? Number(customExpense) : 0;
  let cash = hasCustomCash ? Number(customCash) : 0;
  let hasRealData = false;

  const resolution = resolveDateRange({ month: monthParam });

  if (!hasCustomRevenue || !hasCustomExpense || !hasCustomCash) {
    const [periodTxs, allTxs] = await Promise.all([
      prisma.cashTransaction.findMany({
        where: {
          workspaceId,
          transactionDate: {
            gte: resolution.startDate,
            lte: resolution.endDate,
          },
        },
        select: { type: true, amount: true },
      }),
      prisma.cashTransaction.findMany({
        where: {
          workspaceId,
          transactionDate: {
            lte: resolution.endDate,
          },
        },
        select: { type: true, amount: true },
      }),
    ]);

    let inc = 0;
    let exp = 0;
    for (const t of periodTxs) {
      if (t.type === TransactionType.INCOME) inc += t.amount;
      else exp += t.amount;
    }

    let allInc = 0;
    let allExp = 0;
    for (const t of allTxs) {
      if (t.type === TransactionType.INCOME) allInc += t.amount;
      else allExp += t.amount;
    }

    if (periodTxs.length > 0) {
      if (!hasCustomRevenue) revenue = inc;
      if (!hasCustomExpense) expense = exp;
      if (!hasCustomCash) cash = allInc - allExp;
      hasRealData = true;
    } else {
      if (!hasCustomCash) cash = allInc - allExp;
      hasRealData = hasCustomRevenue || hasCustomExpense || hasCustomCash;
    }
  } else {
    hasRealData = true;
  }

  const result = calculateScore(revenue, expense, cash, hasRealData);

  return {
    period: {
      key: resolution.periodKey,
      label: resolution.periodLabel,
      isCurrentMonth: resolution.isCurrentMonth,
    },
    hasRealData,
    metrics: {
      revenue,
      expense,
      cashReserve: cash,
      netProfit: revenue - expense,
    },
    ...result,
  };
}

// GET: Baca skor kesehatan untuk bulan tertentu
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const month = req.nextUrl.searchParams.get('month');
      const health = await computeHealth(auth.workspace.id, month);
      return NextResponse.json({ success: true, health });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat skor kesehatan keuangan.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Hitung skor kesehatan dengan opsi simulasi custom
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const { customRevenue, customExpense, customCash, month } = body;
      const health = await computeHealth(auth.workspace.id, month, customRevenue, customExpense, customCash);

      return NextResponse.json({
        success: true,
        healthScore: health.totalScore,
        grade: health.grade,
        gradeLabel: health.gradeLabel,
        summary: health.summary,
        breakdown: health.breakdown,
        period: health.period,
        hasRealData: health.hasRealData,
        metrics: health.metrics,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal menghitung skor kesehatan keuangan.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
