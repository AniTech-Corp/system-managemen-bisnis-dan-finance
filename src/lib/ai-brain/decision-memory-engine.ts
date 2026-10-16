/**
 * KLIR AI Brain - Decision Memory System
 * Stores and manages the persistent ledger of all executive strategic decisions,
 * baseline metrics, projected impacts, and actual evaluation outcomes.
 */

import { DecisionMemoryRecord, BusinessContextSnapshot, AIRecommendationItem } from './types';

// In-Memory Global Decision Memory Store (Workspace Partitioned)
const memoryStore = new Map<string, DecisionMemoryRecord[]>();

// FIX (sesi ini): fungsi ini dulu bernama "initializeDefaultDecisions" dan diam-diam
// nyuntik 1 keputusan KARANGAN ("Ekspansi Anggaran Kupon Promo Gajian +25%", status
// COMPLETED 12 hari lalu, hasil +22.3% revenue, akurasi prediksi 94%) ke SETIAP
// workspace yang belum pernah benar-benar bikin keputusan apapun -- riwayat
// perusahaan yang gak pernah kejadian, disajikan seolah nyata. Efek berantai:
// FeedbackLoopEngine.evaluateFeedbackLoop() baca seed ini sebagai "data completed"
// beneran (bukan 0), jadi cabang "belum ada histori" di file itu jadi TIDAK PERNAH
// kepakai walau workspace-nya baru banget. Dihapus total -- workspace baru = memori
// keputusan kosong beneran, jujur.
function ensureWorkspaceInitialized(workspaceId: string) {
  if (!memoryStore.has(workspaceId)) {
    memoryStore.set(workspaceId, []);
  }
}

export class DecisionMemoryEngine {
  /**
   * Records a new strategic decision execution
   */
  public static recordDecision(
    workspaceId: string,
    recommendation: {
      id: string;
      title: string;
      category: any;
      suggestedActionType: any;
      projectedImpact: any;
    },
    snapshot: BusinessContextSnapshot,
    approvedBy: string = 'CEO / Business Owner',
    notes?: string
  ): DecisionMemoryRecord {
    ensureWorkspaceInitialized(workspaceId);

    const newRecord: DecisionMemoryRecord = {
      id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      workspaceId,
      recommendationId: recommendation.id,
      title: recommendation.title,
      category: recommendation.category,
      actionType: recommendation.suggestedActionType,
      approvedAt: new Date().toISOString(),
      approvedBy,
      status: 'EXECUTED',
      baselineMetrics: {
        liquidCash: snapshot.financials.liquidCash,
        monthlyBurnRate: snapshot.financials.monthlyBurnRate,
        runwayMonths: snapshot.financials.runwayMonths,
        revenue30d: snapshot.financials.totalIncome30d,
      },
      projectedImpact: {
        runwayImpactDays: recommendation.projectedImpact?.runwayImpactDays,
        costSavingsEstimated: recommendation.projectedImpact?.costSavingsEstimated,
        revenueBoostPercent: recommendation.projectedImpact?.revenueBoostPercent,
        confidenceScore: recommendation.projectedImpact?.confidenceScore || 0.85,
      },
      lessonsLearned: notes || 'Sedang dalam pemantauan otomatis Closed Feedback Loop.',
    };

    const currentList = memoryStore.get(workspaceId) || [];
    currentList.unshift(newRecord);
    memoryStore.set(workspaceId, currentList);

    return newRecord;
  }

  /**
   * Retrieves all decision records for a workspace
   */
  public static getDecisions(workspaceId: string): DecisionMemoryRecord[] {
    ensureWorkspaceInitialized(workspaceId);
    return memoryStore.get(workspaceId) || [];
  }

  /**
   * Retrieves a specific decision by ID
   */
  public static getDecisionById(workspaceId: string, decisionId: string): DecisionMemoryRecord | undefined {
    ensureWorkspaceInitialized(workspaceId);
    const list = memoryStore.get(workspaceId) || [];
    return list.find((d) => d.id === decisionId);
  }

  /**
   * Updates an evaluation outcome for closed feedback loop
   */
  public static updateDecisionOutcome(
    workspaceId: string,
    decisionId: string,
    outcome: {
      actualRevenueDeltaPercent?: number;
      actualRunwayDeltaDays?: number;
      accuracyScore: number;
      lessonsLearned?: string;
    }
  ): boolean {
    const list = memoryStore.get(workspaceId) || [];
    const item = list.find((d) => d.id === decisionId);
    if (!item) return false;

    item.actualOutcome = {
      evaluatedAt: new Date().toISOString(),
      actualRevenueDeltaPercent: outcome.actualRevenueDeltaPercent,
      actualRunwayDeltaDays: outcome.actualRunwayDeltaDays,
      accuracyScore: outcome.accuracyScore,
    };
    item.status = 'COMPLETED';
    if (outcome.lessonsLearned) {
      item.lessonsLearned = outcome.lessonsLearned;
    }
    return true;
  }
}
