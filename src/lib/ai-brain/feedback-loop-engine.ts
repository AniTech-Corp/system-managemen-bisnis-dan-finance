/**
 * KLIR AI Brain - Closed Feedback Loop Engine
 * Analyzes past decision outcomes, computes prediction accuracy variance,
 * and derives dynamic learning calibration weights for future AI decisions.
 */

import { DecisionMemoryEngine } from './decision-memory-engine';
import { FeedbackEvaluation, BusinessContextSnapshot } from './types';

export class FeedbackLoopEngine {
  /**
   * Evaluates the accuracy of past decisions for a workspace
   */
  public static evaluateFeedbackLoop(
    workspaceId: string,
    currentSnapshot: BusinessContextSnapshot
  ): FeedbackEvaluation {
    const decisions = DecisionMemoryEngine.getDecisions(workspaceId);

    const completedDecisions = decisions.filter(
      (d) => d.status === 'COMPLETED' && d.actualOutcome
    );

    if (completedDecisions.length === 0) {
      // FIX (sesi ini): dulu mengarang skor akurasi 92% + 1 "evaluasi baseline" palsu
      // ("Kalibrasi Algoritma Prediksi Awal") seolah sistem sudah punya rekam jejak
      // prediksi, padahal workspace ini belum pernah punya 1 pun keputusan yang
      // dievaluasi. Jujur: 0 keputusan = 0 skor, evaluations kosong -- bukan angka
      // karangan yang kedengeran meyakinkan.
      return {
        totalDecisionsEvaluated: decisions.length,
        averageAccuracyScore: 0,
        modelCalibrationFactor: 1.0,
        evaluations: [],
      };
    }

    let totalScore = 0;
    const evaluations = completedDecisions.map((d) => {
      // NOTE: `?? 0` bukan `|| 90` -- accuracyScore beneran 0 (prediksi meleset
      // total) HARUS tetap kebaca 0, bukan disulap jadi 90 (baik) oleh fallback.
      const score = d.actualOutcome?.accuracyScore ?? 0;
      totalScore += score;

      let status: 'EXCEEDED' | 'ON_TRACK' | 'UNDERPERFORMED' = 'ON_TRACK';
      if (score >= 95) status = 'EXCEEDED';
      else if (score < 80) status = 'UNDERPERFORMED';

      const projected = d.projectedImpact.revenueBoostPercent || d.projectedImpact.runwayImpactDays || 0;
      const actual = d.actualOutcome?.actualRevenueDeltaPercent || d.actualOutcome?.actualRunwayDeltaDays || 0;

      return {
        decisionId: d.id,
        title: d.title,
        accuracyScore: score,
        status,
        insight: `Proyeksi awal ${projected}% vs Capaian riil ${actual}%. Akurasi prediksi: ${score}%.`,
      };
    });

    const averageAccuracyScore = Math.round(totalScore / completedDecisions.length);

    // Calibration factor: if accuracy is very high (>=90%), factor is 1.02. If lower, gently conservative (0.95)
    let modelCalibrationFactor = 1.0;
    if (averageAccuracyScore >= 90) modelCalibrationFactor = 1.03;
    else if (averageAccuracyScore < 80) modelCalibrationFactor = 0.94;

    return {
      totalDecisionsEvaluated: completedDecisions.length,
      averageAccuracyScore,
      modelCalibrationFactor,
      evaluations,
    };
  }
}
