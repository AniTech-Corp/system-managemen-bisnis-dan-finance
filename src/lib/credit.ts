import { prisma } from './prisma';
import { LedgerType, CostType } from '@prisma/client';

/**
 * Tabel Default Biaya Kredit per Fitur
 */
export const DEFAULT_FEATURE_COSTS: Record<string, number> = {
  'promo.video_generate': 150,
  'promo.copywriting': 15,
  'hukum.kbli_search': 5,
  'kerja.voice_sop': 50,
  'booking.reserve': 0,
};

/**
 * Mengambil biaya kredit untuk fitur tertentu dari DB (fallback ke default table)
 */
export async function getFeatureCost(featureKey: string): Promise<number> {
  try {
    const costRecord = await prisma.featureCost.findUnique({
      where: { featureKey },
    });
    if (costRecord) {
      return costRecord.creditCost;
    }
  } catch (err) {
    console.warn(`Gagal mengambil FeatureCost untuk ${featureKey}:`, err);
  }
  return DEFAULT_FEATURE_COSTS[featureKey] ?? 10;
}

export interface DeductCreditParams {
  workspaceId: string;
  cost: number;
  source: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface DeductCreditResult {
  weeklyDeducted: number;
  reserveDeducted: number;
  remainingWeekly: number;
  remainingReserve: number;
  ledgerId: string;
}

/**
 * Pemotongan Kredit Secara Atomis (SQL Concurrency-Safe)
 * Mengurangi saldo Weekly Credit ➔ Fallback ke Reserve Credit ➔ Catat ke CreditLedger
 * Mendukung pemanggilan via Object `{ workspaceId, cost, source, ... }` maupun Positional `(workspaceId, cost, source, userId?, metadata?)`
 */
export async function deductCredit(
  paramsOrWorkspaceId: DeductCreditParams | string,
  costArg?: number,
  sourceArg?: string,
  userIdArg?: string,
  metadataArg?: Record<string, any>
): Promise<DeductCreditResult> {
  const params: DeductCreditParams =
    typeof paramsOrWorkspaceId === 'string'
      ? {
          workspaceId: paramsOrWorkspaceId,
          cost: costArg ?? 0,
          source: sourceArg ?? 'unknown.action',
          userId: userIdArg,
          metadata: metadataArg ?? {},
        }
      : paramsOrWorkspaceId;

  const { workspaceId, cost, source, userId, metadata = {} } = params;

  if (cost <= 0) {
    return {
      weeklyDeducted: 0,
      reserveDeducted: 0,
      remainingWeekly: 0,
      remainingReserve: 0,
      ledgerId: 'FREE_OPERATION',
    };
  }

  return prisma.$transaction(async (tx) => {
    // 1. Dapatkan atau inisialisasi akun kredit
    let account = await tx.creditAccount.findUnique({
      where: { workspaceId },
    });

    if (!account) {
      // Inisialisasi default jika belum ada
      account = await tx.creditAccount.create({
        data: {
          workspaceId,
          weeklyCredit: 1000,
          reserveCredit: 0,
        },
      });
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
      const totalBalance = account.weeklyCredit + account.reserveCredit;
      throw new Error(
        `Saldo kredit tidak mencukupi. Dibutuhkan: ${cost} kredit, Saldo tersedia: ${totalBalance} (Mingguan: ${account.weeklyCredit}, Cadangan: ${account.reserveCredit}).`
      );
    }

    // 2. Update saldo atomis
    const updatedAccount = await tx.creditAccount.update({
      where: { workspaceId },
      data: {
        weeklyCredit: { decrement: weeklyToDeduct },
        reserveCredit: { decrement: reserveToDeduct },
      },
    });

    // 3. Catat buku besar kredit (Credit Ledger)
    const ledger = await tx.creditLedger.create({
      data: {
        workspaceId,
        userId: userId || null,
        amount: -cost,
        type: LedgerType.CONSUME,
        source,
        metadata: {
          ...metadata,
          weeklyDeducted: weeklyToDeduct,
          reserveDeducted: reserveToDeduct,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return {
      weeklyDeducted: weeklyToDeduct,
      reserveDeducted: reserveToDeduct,
      remainingWeekly: updatedAccount.weeklyCredit,
      remainingReserve: updatedAccount.reserveCredit,
      ledgerId: ledger.id,
    };
  }, { timeout: 20000, maxWait: 8000 });
}

export interface RefundCreditParams {
  workspaceId: string;
  cost: number;
  source: string;
  userId?: string;
  reason?: string;
  originalLedgerId?: string;
}

/**
 * Pengembalian Kredit (Auto-Refund) jika operasi AI atau transaksi gagal di tengah jalan
 */
export async function refundCredit(
  paramsOrWorkspaceId: RefundCreditParams | string,
  costArg?: number,
  sourceArg?: string,
  userIdArg?: string,
  reasonArg?: string,
  originalLedgerIdArg?: string
) {
  const params: RefundCreditParams =
    typeof paramsOrWorkspaceId === 'string'
      ? {
          workspaceId: paramsOrWorkspaceId,
          cost: costArg ?? 0,
          source: sourceArg ?? 'unknown.action',
          userId: userIdArg,
          reason: reasonArg,
          originalLedgerId: originalLedgerIdArg,
        }
      : paramsOrWorkspaceId;

  const { workspaceId, cost, source, userId, reason = 'Operation failed compensation', originalLedgerId } = params;

  if (cost <= 0) return null;

  return prisma.$transaction(async (tx) => {
    // Kembalikan ke Weekly Credit
    const updatedAccount = await tx.creditAccount.update({
      where: { workspaceId },
      data: {
        weeklyCredit: { increment: cost },
      },
    });

    const ledger = await tx.creditLedger.create({
      data: {
        workspaceId,
        userId: userId || null,
        amount: cost,
        type: LedgerType.REFILL,
        source: `refund:${source}`,
        metadata: {
          reason,
          originalLedgerId,
          refundedAt: new Date().toISOString(),
        },
      },
    });

    return { updatedAccount, ledger };
  }, { timeout: 20000, maxWait: 8000 });
}

/**
 * Wrapper Eksekusi Atomis dengan Jaminan Auto-Refund
 * Menjamin kredit hanya terpotong permanen jika operasi bisnis berhasil 100%.
 */
export async function withAtomicCredit<T>(
  params: {
    workspaceId: string;
    featureKey: string;
    userId?: string;
    customCost?: number;
    metadata?: Record<string, any>;
  },
  operation: (deductResult: DeductCreditResult) => Promise<T>
): Promise<T> {
  const cost = params.customCost ?? (await getFeatureCost(params.featureKey));
  const deductResult = await deductCredit({
    workspaceId: params.workspaceId,
    cost,
    source: params.featureKey,
    userId: params.userId,
    metadata: params.metadata,
  });

  try {
    return await operation(deductResult);
  } catch (error: any) {
    // Auto-refund jika operasi throw exception
    console.error(`🚨 Operasi '${params.featureKey}' gagal. Melakukan auto-refund ${cost} kredit:`, error.message);
    try {
      await refundCredit({
        workspaceId: params.workspaceId,
        cost,
        source: params.featureKey,
        userId: params.userId,
        reason: `Auto-refund akibat kesalahan: ${error.message}`,
        originalLedgerId: deductResult.ledgerId,
      });
    } catch (refundErr) {
      console.error('CRITICAL: Auto-refund gagal dieksekusi:', refundErr);
    }
    throw error;
  }
}

/**
 * Mengambil ringkasan saldo kredit workspace
 */
export async function getWorkspaceCreditBalance(workspaceId: string) {
  const account = await prisma.creditAccount.findUnique({
    where: { workspaceId },
  });

  return {
    weeklyCredit: account?.weeklyCredit ?? 0,
    reserveCredit: account?.reserveCredit ?? 0,
    totalAvailable: (account?.weeklyCredit ?? 0) + (account?.reserveCredit ?? 0),
    lastReset: account?.lastReset ?? new Date(),
  };
}
