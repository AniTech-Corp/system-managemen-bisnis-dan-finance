import { prisma } from './prisma';
import { LedgerType } from '@prisma/client';

export async function deductCredit(workspaceId: string, cost: number, source: string, userId?: string) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.creditAccount.findUnique({
      where: { workspaceId },
    });

    if (!account) {
      throw new Error('Credit account not found');
    }

    let weeklyToDeduct = 0;
    let reserveToDeduct = 0;

    if (account.weeklyCredit >= cost) {
      weeklyToDeduct = cost;
    } else {
      weeklyToDeduct = account.weeklyCredit;
      reserveToDeduct = cost - weeklyToDeduct;
    }

    if (account.reserveCredit < reserveToDeduct) {
      throw new Error('Insufficient credit balance');
    }

    const updatedAccount = await tx.creditAccount.update({
      where: { workspaceId },
      data: {
        weeklyCredit: { decrement: weeklyToDeduct },
        reserveCredit: { decrement: reserveToDeduct },
      },
    });

    const ledger = await tx.creditLedger.create({
      data: {
        workspaceId,
        userId: userId || null,
        amount: -cost,
        type: LedgerType.CONSUME,
        source,
        metadata: { weeklyDeducted: weeklyToDeduct, reserveDeducted: reserveToDeduct },
      },
    });

    return { updatedAccount, ledger };
  });
}
