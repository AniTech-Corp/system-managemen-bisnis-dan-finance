import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { PlanType, AccessType, SubscriptionStatus, LedgerType } from '@prisma/client';
import { PLAN_CONFIGS } from '@/lib/plan-guard';

/**
 * POST /subscription/upgrade — mengubah paket workspace (FREE → STARTED/BUSINESS).
 * Endpoint ini akan dipanggil oleh webhook payment (Midtrans) setelah pembayaran sukses.
 * Sementara ini hanya bisa diakses OWNER/ADMIN (untuk testing & demo).
 */
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { planType, billingCycle = 'monthly' } = await req.json();

      if (planType !== 'STARTED' && planType !== 'BUSINESS') {
        return NextResponse.json(
          { code: 'INVALID_PLAN', message: "Paket harus 'STARTED' atau 'BUSINESS'." },
          { status: 400 }
        );
      }

      const config = PLAN_CONFIGS[planType as PlanType];
      const workspaceId = auth.workspace.id;

      const cycleDays = billingCycle === 'weekly' ? 7 : 30;
      const now = new Date();
      const endDate = new Date(now.getTime() + cycleDays * 24 * 3600 * 1000);

      const result = await prisma.$transaction(async (tx) => {
        const subscription = await tx.subscription.upsert({
          where: { workspaceId },
          create: {
            workspaceId,
            planType: planType as PlanType,
            accessType: AccessType.KLIR_ALL,
            startDate: now,
            endDate,
            status: SubscriptionStatus.ACTIVE,
          },
          update: {
            planType: planType as PlanType,
            accessType: AccessType.KLIR_ALL,
            startDate: now,
            endDate,
            status: SubscriptionStatus.ACTIVE,
          },
        });

        const creditAccount = await tx.creditAccount.upsert({
          where: { workspaceId },
          create: {
            workspaceId,
            weeklyCredit: config.weeklyCredit,
            reserveCredit: 0,
            lastReset: now,
          },
          update: {
            weeklyCredit: config.weeklyCredit,
            lastReset: now,
          },
        });

        await tx.creditLedger.create({
          data: {
            workspaceId,
            userId: auth.user.id,
            amount: config.weeklyCredit,
            type: LedgerType.REFILL,
            source: `subscription.${planType.toLowerCase()}`,
            metadata: { billingCycle, packageLabel: config.label },
          },
        });

        return { subscription, creditAccount };
      });

      return NextResponse.json({
        success: true,
        message: `Paket berhasil di-upgrade ke ${config.label}.`,
        subscription: {
          planType: result.subscription.planType,
          status: result.subscription.status,
          endDate: result.subscription.endDate,
        },
        credit: {
          weeklyCredit: result.creditAccount.weeklyCredit,
          reserveCredit: result.creditAccount.reserveCredit,
        },
      });
    } catch (err: any) {
      return NextResponse.json({ message: err.message }, { status: 500 });
    }
  },
  { minRole: 'OWNER' }
);
