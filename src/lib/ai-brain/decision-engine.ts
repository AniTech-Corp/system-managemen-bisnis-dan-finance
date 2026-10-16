import { BusinessContextSnapshot, AIRecommendationItem } from './types';
import { WhyEngine } from './why-engine';

/**
 * Deterministic Decision & Recommendation Engine
 * Evaluates business state across finance, growth, operations, and strategy to generate prioritized prescriptions.
 * Augmented with Explainable AI (Why Engine) and 1-Click Execution bindings.
 */
export function generateStrategicRecommendations(
  context: BusinessContextSnapshot
): AIRecommendationItem[] {
  const recommendations: AIRecommendationItem[] = [];

  const { financials, marketing, operations, strategy } = context;

  // 1. Finance: Critical Runway Intervention
  if (financials.runwayMonths < 3.0 && financials.monthlyBurnRate > 0) {
    const item: AIRecommendationItem = {
      id: 'rec-fin-runway-critical',
      category: 'FINANCE',
      priority: 'CRITICAL',
      title: 'Darurat Likuiditas: Aktifkan Freeze Budget & Audit OpEx',
      triggerReason: `Runway kas saat ini ${financials.runwayMonths} bulan dengan defisit bulanan Rp ${financials.monthlyBurnRate.toLocaleString('id-ID')}.`,
      prescription: 'Tangguhkan pengeluaran non-primer sementara dan fokuskan penagihan piutang faktur untuk memperpanjang runway minimal hingga 6 bulan.',
      projectedImpact: {
        runwayImpactDays: 45,
        costSavingsEstimated: financials.monthlyBurnRate * 0.3,
        confidenceScore: 0.95,
      },
      suggestedActionType: 'AUDIT_OPEX',
      actionPayload: { targetReductionPercent: 30 },
      isExecutable: true,
    };
    item.whyDetails = WhyEngine.explainRecommendation(item.suggestedActionType, context, item.actionPayload);
    recommendations.push(item);
  }

  // 2. Finance: Overdue Invoices
  if (financials.overdueInvoicesCount > 0) {
    const item: AIRecommendationItem = {
      id: 'rec-fin-overdue-invoices',
      category: 'FINANCE',
      priority: financials.overdueInvoicesCount > 2 ? 'HIGH' : 'MEDIUM',
      title: 'Percepat Penagihan Piutang Jatuh Tempo',
      triggerReason: `Terdapat ${financials.overdueInvoicesCount} faktur piutang tertunggak senilai total Rp ${financials.totalUnpaidInvoices.toLocaleString('id-ID')}.`,
      prescription: 'Kirim reminder pembayaran otomatis dengan insentif diskon 3% jika dilunasi dalam 48 jam ke depan.',
      projectedImpact: {
        runwayImpactDays: Math.min(60, Math.round(financials.overdueInvoicesCount * 10)),
        costSavingsEstimated: financials.totalUnpaidInvoices,
        confidenceScore: 0.9,
      },
      suggestedActionType: 'COLLECT_INVOICES',
      isExecutable: true,
    };
    item.whyDetails = WhyEngine.explainRecommendation(item.suggestedActionType, context, item.actionPayload);
    recommendations.push(item);
  }

  // 3. Marketing: High ROAS Scaling Opportunity
  if (marketing.estimatedROAS >= 2.5 && financials.runwayMonths >= 4.0 && marketing.estimatedMarketingSpend30d > 0) {
    const item: AIRecommendationItem = {
      id: 'rec-mkt-scale-growth',
      category: 'MARKETING',
      priority: 'HIGH',
      title: 'Peluang Akselerasi: Naikkan Anggaran Akuisisi Pelanggan',
      triggerReason: `Efisiensi konversi sangat sehat dengan ROAS ${marketing.estimatedROAS}x dan cadangan kas memadai.`,
      prescription: 'Tingkatkan anggaran kampanye promo sebesar 20-30% untuk memaksimalkan perolehan pendapatan berulang.',
      projectedImpact: {
        revenueBoostPercent: 25,
        confidenceScore: 0.88,
      },
      suggestedActionType: 'SCALE_MARKETING',
      actionPayload: { scaleBudgetPercent: 25 },
      isExecutable: true,
    };
    item.whyDetails = WhyEngine.explainRecommendation(item.suggestedActionType, context, item.actionPayload);
    recommendations.push(item);
  } else if (marketing.activeCouponsCount === 0) {
    const item: AIRecommendationItem = {
      id: 'rec-mkt-create-coupon',
      category: 'MARKETING',
      priority: 'MEDIUM',
      title: 'Buat Promo Kupon Baru untuk Re-engagement Klien',
      triggerReason: 'Tidak ada kupon diskon atau promo yang aktif saat ini di modul KLIR Promo.',
      prescription: 'Luncurkan promo terbatas untuk produk/layanan unggulan guna memicu transaksi berulang.',
      projectedImpact: {
        revenueBoostPercent: 15,
        confidenceScore: 0.82,
      },
      suggestedActionType: 'SCALE_MARKETING',
      actionPayload: { scaleBudgetPercent: 15, isCouponCreationOnly: true },
      isExecutable: true,
    };
    item.whyDetails = WhyEngine.explainRecommendation(item.suggestedActionType, context, item.actionPayload);
    recommendations.push(item);
  }

  // 4. Operations: Task Execution Bottleneck / Hiring Approval
  if (operations.totalTasks > 0 && operations.completionRatePercent < 65) {
    const item: AIRecommendationItem = {
      id: 'rec-ops-execution-boost',
      category: 'OPERATIONS',
      priority: 'MEDIUM',
      title: 'Optimasi Alur Kerja Tim & Atasi Bottleneck',
      triggerReason: `Tingkat penyelesaian tugas tim saat ini hanya ${operations.completionRatePercent}% dengan ${operations.inProgressTasks} tugas tertahan.`,
      prescription: 'Pecah tugas besar menjadi sub-task mingguan dan setujui penambahan personil pendukung di ruang kerja tim KLIR.',
      projectedImpact: {
        confidenceScore: 0.85,
        runwayImpactDays: 7,
      },
      suggestedActionType: 'APPROVE_HIRING',
      actionPayload: { roleTitle: 'Staf Operasional & Layanan Tambahan', budget: 4500000 },
      isExecutable: true,
    };
    item.whyDetails = WhyEngine.explainRecommendation(item.suggestedActionType, context, item.actionPayload);
    recommendations.push(item);
  }

  // 5. Strategy: Formulate CorPlan Objectives
  if (!strategy.strategicPillarsDefined || strategy.corplanProjectsCount === 0) {
    const item: AIRecommendationItem = {
      id: 'rec-strat-define-model',
      category: 'STRATEGY',
      priority: 'LOW',
      title: 'Definisikan Dokumen Rencana Bisnis & OKR',
      triggerReason: 'Profil bisnis belum memiliki pilar target strategis yang lengkap di CorPlan.',
      prescription: 'Buka modul CorPlan dan selesaikan template strategi bisnis 1-halaman agar AI memiliki konteks tujuan jangka panjang perusahaan.',
      projectedImpact: {
        confidenceScore: 0.75,
      },
      suggestedActionType: 'GENERAL_ADVICE',
      isExecutable: false,
    };
    item.whyDetails = WhyEngine.explainRecommendation(item.suggestedActionType, context, item.actionPayload);
    recommendations.push(item);
  }

  // Sort: CRITICAL -> HIGH -> MEDIUM -> LOW
  const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}
