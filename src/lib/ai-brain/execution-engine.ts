/**
 * KLIR AI Brain - Execution Layer Engine
 * Converts passive strategic recommendations into 1-click deterministic actions,
 * interacting directly with PostgreSQL models and logging to Decision Memory.
 */

import { prisma } from '@/lib/prisma';
import {
  ExecutionRequest,
  ExecutionResult,
  BusinessContextSnapshot,
} from './types';
import { DecisionMemoryEngine } from './decision-memory-engine';
import { ContextEngine } from './context-engine';
import { generateStrategicRecommendations } from './decision-engine';

const executionReceipts = new Map<string, ExecutionResult>();

export class ExecutionEngine {
  /**
   * Executes an approved AI recommendation. The transaction-scoped advisory
   * lock makes the idempotency boundary durable across Node workers; the
   * in-memory receipt below remains a fast path for same-worker replays.
   */
  public static async executeAction(request: ExecutionRequest): Promise<ExecutionResult> {
    if (!request.idempotencyKey || request.idempotencyKey.length < 16 || request.idempotencyKey.length > 200) {
      throw new Error('Idempotency-Key wajib diisi untuk mencegah eksekusi ganda.');
    }
    return prisma.$transaction(async (tx) => {
      const lockKey = `klir:ai-execution:${request.workspaceId}:${request.idempotencyKey}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      return this.executeActionUnlocked(request);
    });
  }

  private static async executeActionUnlocked(request: ExecutionRequest): Promise<ExecutionResult> {
    const { workspaceId, recommendationId, actionType, approvedBy = 'CEO / Business Owner', userNotes, idempotencyKey } = request;

    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
      throw new Error('Idempotency-Key wajib diisi untuk mencegah eksekusi ganda.');
    }
    const receiptKey = `${workspaceId}:${idempotencyKey}`;
    const previous = executionReceipts.get(receiptKey);
    if (previous) return { ...previous, details: { ...previous.details, replayed: true } };

    // In-memory receipts protect double-clicks in one worker only. Read the
    // durable audit receipt as well so a browser retry after a server restart
    // cannot create the same coupon/task twice.
    const persistedReceipts = await prisma.activityEvent.findMany({
      where: { workspaceId, type: 'AI_ACTION_EXECUTED' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const persisted = persistedReceipts.find((event) => {
      const payload = event.payload as any;
      return payload?.idempotencyKey === idempotencyKey && payload?.result;
    });
    if (persisted) {
      const payload = persisted.payload as any;
      const result = payload.result as ExecutionResult;
      executionReceipts.set(receiptKey, result);
      return { ...result, details: { ...result.details, replayed: true } };
    }

    const snapshot = await ContextEngine.getSnapshot(workspaceId);
    const recommendation = generateStrategicRecommendations(snapshot).find((item) => item.id === recommendationId);
    if (!recommendation || !recommendation.isExecutable) {
      throw new Error('Rekomendasi tidak ditemukan, sudah kedaluwarsa, atau tidak dapat dieksekusi. Muat ulang rekomendasi terbaru.');
    }
    if (recommendation.suggestedActionType !== actionType) {
      throw new Error('Action type tidak cocok dengan rekomendasi server.');
    }

    // DEEP-001: Idempotency-Key di atas cuma nyegah REQUEST YANG SAMA PERSIS diulang
    // (client kirim key baru -> lolos lagi). recommendationId dari decision-engine adalah
    // string statis per kategori (bukan sekali-pakai) dan kondisi trigger-nya biasanya
    // tidak berubah akibat eksekusi action-nya sendiri -- tanpa guard ini, recommendationId
    // yang sama bisa dieksekusi berkali-kali tanpa batas (mis. bikin PromoCoupon/WorkTask
    // baru tiap panggilan). Cooldown 24 jam per recommendationId menutup celah "belum-
    // dieksekusi" yang tidak dicek sama sekali sebelumnya.
    const RECOMMENDATION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const recentSameRecommendation = persistedReceipts.find((event) => {
      const payload = event.payload as any;
      if (payload?.recommendationId !== recommendationId) return false;
      if (payload?.result?.success === false) return false;
      return Date.now() - new Date(event.createdAt).getTime() < RECOMMENDATION_COOLDOWN_MS;
    });
    if (recentSameRecommendation) {
      const executedAtLabel = new Date(recentSameRecommendation.createdAt).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
      });
      throw new Error(
        `Rekomendasi ini sudah dieksekusi pada ${executedAtLabel} WIB. Tunggu rekomendasi baru dari sistem (cooldown 24 jam per rekomendasi) sebelum eksekusi ulang.`
      );
    }

    // Payload rekomendasi adalah authority server. Client hanya boleh mengirim
    // notes; action payload client tidak boleh mengubah nominal/target action.
    const actionPayload = recommendation.actionPayload;
    const executedAt = new Date().toISOString();
    const actionId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    let message = '';
    let details: Record<string, any> = {};

    switch (actionType) {
      // 1. COLLECT INVOICES (Identify overdue invoices -- reminder is NOT auto-sent yet)
      case 'COLLECT_INVOICES': {
        const overdueInvoices = await prisma.invoice.findMany({
          where: {
            workspaceId,
            status: { in: ['UNPAID', 'OVERDUE'] },
          },
        });

        // NOTE: this only reads from the local database. No WhatsApp/Email/QRIS
        // provider is called here -- nothing is actually sent to the customer yet.
        message = `${overdueInvoices.length} invoice jatuh tempo teridentifikasi dan siap ditinjau untuk penagihan. Belum ada draf pesan pengingat yang dibuat oleh sistem -- kirim manual atau sambungkan ke provider WhatsApp/Email sungguhan untuk otomatisasi penuh.`;
        details = {
          invoicesIdentifiedCount: overdueInvoices.length,
          totalAmountTargeted: snapshot.financials.totalUnpaidInvoices,
          discountIncentiveSuggested: '3% untuk pelunasan dalam 48 jam (usulan -- belum diterapkan ke sistem pembayaran manapun)',
        };
        break;
      }

      // 2. SCALE MARKETING (Auto-generate Promotional Coupon)
      case 'SCALE_MARKETING': {
        const scalePercent = actionPayload?.scaleBudgetPercent || 25;
        const couponCode = `SCALE${scalePercent}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Create promo coupon in DB
        const createdCoupon = await prisma.promoCoupon.create({
          data: {
            workspaceId,
            code: couponCode,
            discountType: 'PERCENTAGE',
            discountValue: 15,
            minPurchase: 100000,
            quota: 150,
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            isActive: true,
          },
        });

        // NOTE: the coupon below is a real DB write. The ad-budget increase is
        // NOT applied anywhere -- there is no call to any ad platform (Meta Ads,
        // Google Ads, dll), so that part is reported as a pending manual step.
        message = `Kupon promo baru ${couponCode} berhasil dibuat dan tercatat aktif di sistem (diskon 15%, kuota 150, berlaku 30 hari). Kenaikan anggaran iklan +${scalePercent}% masih perlu diterapkan manual langsung di platform iklan (Meta Ads/Google Ads dll) -- belum ada integrasi otomatis untuk itu.`;
        details = {
          couponId: createdCoupon.id,
          couponCode: createdCoupon.code,
          budgetBoostPercentSuggested: scalePercent,
          budgetBoostAppliedToAdPlatform: false,
          validDays: 30,
        };
        break;
      }

      // 3. APPROVE HIRING (Create Work Task for HR / Recruiter)
      case 'APPROVE_HIRING': {
        const roleTitle = actionPayload?.roleTitle || 'Staf Operasional & Layanan';
        const budget = actionPayload?.budget || 5000000;

        const createdTask = await prisma.workTask.create({
          data: {
            workspaceId,
            title: `[REKRUTMEN DISETUJUI CEO] Buka lowongan: ${roleTitle}`,
            description: `Alokasi budget payroll disetujui: Rp ${budget.toLocaleString('id-ID')}/bulan. Lakukan proses screening dan interview calon kandidat.`,
            priority: 'HIGH',
            status: 'TODO',
            dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        });

        message = `Persetujuan rekrutmen berhasil dieksekusi. Tiket lowongan untuk ${roleTitle} telah dibuat di ruang kerja KLIR.`;
        details = {
          taskId: createdTask.id,
          roleTitle,
          allocatedBudget: budget,
        };
        break;
      }

      // 4. AUDIT OPEX / BUDGET
      case 'AUDIT_OPEX':
      case 'ADJUST_BUDGET': {
        const auditTask = await prisma.workTask.create({
          data: {
            workspaceId,
            title: `[AUDIT OPEX] Evaluasi Efisiensi Biaya Berulang Bulanan`,
            description: `Lakukan audit terhadap pos pengeluaran langganan software dan utilitas kantor untuk memangkas pemborosan 15%.`,
            priority: 'MEDIUM',
            status: 'TODO',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          },
        });

        message = `Audit OpEx telah dijadwalkan dan tugas peninjauan telah diterbitkan.`;
        details = {
          taskId: auditTask.id,
          targetSavingsPercent: 15,
        };
        break;
      }

      // DEFAULT
      default: {
        message = `Rekomendasi berhasil disetujui dan dicatat ke dalam audit trail operasional.`;
        details = {
          actionType,
          recommendationId,
        };
      }
    }

    // Persist to Decision Memory System
    const memoryRecord = DecisionMemoryEngine.recordDecision(
      workspaceId,
      {
        id: recommendationId,
        title: message,
        category: 'EXECUTIVE',
        suggestedActionType: actionType,
        projectedImpact: {
          confidenceScore: 0.9,
          runwayImpactDays: 14,
        },
      },
      snapshot,
      approvedBy,
      userNotes
    );

    const result: ExecutionResult = {
      success: true,
      actionId,
      actionType,
      executedAt,
      message,
      details,
      decisionMemoryId: memoryRecord.id,
    };
    executionReceipts.set(receiptKey, result);
    // The business mutation above is already complete. A receipt failure must
    // not turn a successful write into a client-visible 500; the in-memory
    // receipt still protects this worker and the warning exposes the durable
    // audit gap for operations monitoring.
    try {
      await prisma.activityEvent.create({
        data: {
          workspaceId,
          type: 'AI_ACTION_EXECUTED',
          payload: { idempotencyKey, recommendationId, actionType, result } as any,
        },
      });
    } catch (receiptError) {
      console.error('[ExecutionEngine] durable idempotency receipt failed:', receiptError);
    }
    return result;
  }
}
