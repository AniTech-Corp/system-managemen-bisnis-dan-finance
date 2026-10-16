import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { TopUpCreditSchema } from '@/lib/validators';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limiter';
import { LedgerType } from '@prisma/client';

const TOPUP_PACKAGES = {
  MINI_1000: { name: 'Top-Up Mini 1.000 Kredit', credits: 1000, price: 15000 },
  MEDIUM_3000: { name: 'Top-Up Medium 3.000 Kredit', credits: 3000, price: 35000 },
  PRO_5000: { name: 'Top-Up Pro 5.000 Kredit', credits: 5000, price: 50000 },
  STARTER_WEEKLY: { name: 'Paket Starter (2.000 Kredit/Mgg)', credits: 2000, price: 30000 },
  BUSINESS_WEEKLY: { name: 'Paket Business (8.000 Kredit/Mgg)', credits: 8000, price: 100000 },
};

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, { max: 30, windowMs: 60000 });
  if (!rl.allowed) return rateLimitResponse(rl.resetTime);

  const authUser = getUserFromRequest(req);
  if (!authUser) {
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Silakan login terlebih dahulu' }, { status: 401 });
  }

  try {
    const rawBody = await req.json();
    const parsed = TopUpCreditSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json({ error: 'VALIDATION_ERROR', details: parsed.error.format() }, { status: 400 });
    }

    const { workspaceId, packageId, paymentMethod } = parsed.data;
    const selectedPkg = TOPUP_PACKAGES[packageId];

    if (!selectedPkg) {
      return NextResponse.json({ error: 'INVALID_PACKAGE', message: 'Paket kredit tidak ditemukan' }, { status: 404 });
    }

    // Buat invoice / order payment ID unik
    const orderId = `TOPUP-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Lakukan mutasi atomik penambahan kredit ke CreditAccount & CreditLedger
    const updatedCredit = await prisma.$transaction(async (tx) => {
      let creditRecord = await tx.creditAccount.findUnique({
        where: { workspaceId },
      });

      if (!creditRecord) {
        creditRecord = await tx.creditAccount.create({
          data: {
            workspaceId,
            weeklyCredit: selectedPkg.credits,
            reserveCredit: 0,
          },
        });
      } else {
        creditRecord = await tx.creditAccount.update({
          where: { workspaceId },
          data: {
            weeklyCredit: { increment: selectedPkg.credits },
          },
        });
      }

      await tx.creditLedger.create({
        data: {
          workspaceId,
          userId: authUser.userId || null,
          amount: selectedPkg.credits,
          type: LedgerType.REFILL,
          source: `payment.${paymentMethod.toLowerCase()}`,
          metadata: {
            orderId,
            packageName: selectedPkg.name,
            amountRp: selectedPkg.price,
            paymentMethod,
          },
        },
      });

      return creditRecord;
    });

    return NextResponse.json({
      status: 'SUCCESS',
      message: `Top-Up berhasil! +${selectedPkg.credits.toLocaleString()} Kredit telah ditambahkan ke dompet akun Anda.`,
      paymentDetails: {
        orderId,
        packageName: selectedPkg.name,
        amountRp: selectedPkg.price,
        creditsAdded: selectedPkg.credits,
        paymentMethod,
        qrisString: `00020101021226580014ID.LINKAJA.WWW0118936009110000000000520459995802ID5910ANITECH6007JAKARTA61051234062070703A016304${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        vaNumber: `8808${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        settledAt: new Date().toISOString(),
      },
      currentBalance: {
        weeklyCredit: updatedCredit.weeklyCredit,
        reserveCredit: updatedCredit.reserveCredit,
      },
    });
  } catch (error: any) {
    console.error('Error processing top-up:', error);
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR', message: error.message }, { status: 500 });
  }
}
