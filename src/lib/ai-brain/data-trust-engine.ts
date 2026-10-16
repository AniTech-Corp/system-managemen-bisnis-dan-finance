/**
 * KLIR AI Brain - Data Trust & Validation Layer Engine
 * Validates input integrity, audits outliers, detects duplicate entries,
 * and computes the Data Trust Score (0-100%) to ensure clean inputs for AI.
 */

import { prisma } from '@/lib/prisma';
import { DataTrustReport, DataTrustAnomaly } from './types';

export class DataTrustEngine {
  /**
   * Performs an automated data sanity & integrity audit for a workspace
   */
  public static async auditDataSanity(workspaceId: string): Promise<DataTrustReport> {
    const anomalies: DataTrustAnomaly[] = [];

    // 1. Fetch recent transactions
    const transactions = await prisma.cashTransaction.findMany({
      where: { workspaceId },
      orderBy: { transactionDate: 'desc' },
      take: 100,
    });

    const invoices = await prisma.invoice.findMany({
      where: { workspaceId },
      take: 50,
    });

    // Compute average transaction amount
    let totalExpenseAmount = 0;
    let expenseCount = 0;

    for (const t of transactions) {
      if (t.type === 'EXPENSE') {
        totalExpenseAmount += t.amount;
        expenseCount++;
      }
    }

    const avgExpense = expenseCount > 0 ? totalExpenseAmount / expenseCount : 1000000;

    // Check for Outliers (> 5x average)
    for (const t of transactions) {
      if (t.type === 'EXPENSE' && t.amount > avgExpense * 5 && t.amount > 10000000) {
        anomalies.push({
          id: `anom-outlier-${t.id}`,
          type: 'OUTLIER_EXPENSE',
          severity: 'MEDIUM',
          description: `Pengeluaran ${t.description} (Rp ${t.amount.toLocaleString('id-ID')}) tercatat 5x lebih tinggi dari rata-rata transaksi.`,
          amount: t.amount,
          date: t.transactionDate.toISOString(),
          recordId: t.id,
        });
      }
    }

    // Check for Potential Duplicates (Same amount, same description within same day)
    const seen = new Map<string, string>();
    for (const t of transactions) {
      const dayKey = `${t.type}_${t.amount}_${t.description.trim().toLowerCase()}_${t.transactionDate.toISOString().split('T')[0]}`;
      if (seen.has(dayKey)) {
        anomalies.push({
          id: `anom-dup-${t.id}`,
          type: 'POSSIBLE_DUPLICATE',
          severity: 'HIGH',
          description: `Potensi duplikasi transaksi: "${t.description}" senilai Rp ${t.amount.toLocaleString('id-ID')} tercatat dua kali pada hari yang sama.`,
          amount: t.amount,
          date: t.transactionDate.toISOString(),
          recordId: t.id,
        });
      } else {
        seen.set(dayKey, t.id);
      }
    }

    // Calculate Data Trust Score (Base 100, minus penalties for anomalies)
    let penalty = 0;
    anomalies.forEach((a) => {
      if (a.severity === 'HIGH') penalty += 15;
      else if (a.severity === 'MEDIUM') penalty += 8;
      else penalty += 3;
    });

    // FIX (sesi ini): lantai 70 lama bikin skor gak pernah bisa jujur turun jauh
    // walau anomali-nya banyak/parah -- user tanya "audit data" ke chat (surfaced
    // live di brain/chat/route.ts) bisa dapat "70/100" yang kedengeran "lumayan"
    // padahal status di sebelahnya bilang ACTION_REQUIRED, kontradiktif. Lantai
    // sebenarnya cuma 0 (skor gak boleh negatif), bukan 70.
    const trustScore = Math.max(0, Math.min(100, 100 - penalty));

    let status: 'VERIFIED_CLEAN' | 'WARNING_FLAGS' | 'ACTION_REQUIRED' = 'VERIFIED_CLEAN';
    if (trustScore < 80) status = 'ACTION_REQUIRED';
    else if (trustScore < 95) status = 'WARNING_FLAGS';

    return {
      trustScore,
      status,
      totalTransactionsAudited: transactions.length,
      totalInvoicesAudited: invoices.length,
      anomaliesDetected: anomalies,
      lastAuditedAt: new Date().toISOString(),
    };
  }
}
