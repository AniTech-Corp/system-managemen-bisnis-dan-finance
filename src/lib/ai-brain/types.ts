/**
 * KLIR AI Brain Layer - Data Contracts & Comprehensive Type System
 * Supports 7 Advanced Layers: Execution, Closed Feedback Loop, Priority Alerts,
 * Human Behavior Nudging, Data Trust, Decision Memory, and Explainable AI.
 */

export interface FinancialHealthMetrics {
  liquidCash: number;
  totalIncome30d: number;
  totalExpense30d: number;
  netCashflow30d: number;
  monthlyBurnRate: number;
  runwayMonths: number;
  /** Distinguishes no measured burn from a literal 99-month forecast. */
  runwayIsUnbounded?: boolean;
  totalUnpaidInvoices: number;
  unpaidInvoicesCount: number;
  overdueInvoicesCount: number;
  opEx30d: number;
  capEx30d: number;
  grossMarginPercent: number;
}

export interface MarketingHealthMetrics {
  activeCampaignsCount: number;
  activeCouponsCount: number;
  couponRedemptions30d: number;
  estimatedMarketingSpend30d: number;
  attributedRevenue30d: number;
  estimatedROAS: number;
  estimatedCAC: number;
  /** True only when revenue is linked to campaign/marketing attribution data. */
  attributionDataAvailable?: boolean;
  /** True only when redemption records carry timestamps inside the requested period. */
  couponRedemptionsDateScoped?: boolean;
}

export interface OperationsHealthMetrics {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  completionRatePercent: number;
  overdueTasksCount: number;
}

export interface StrategyHealthMetrics {
  corplanProjectsCount: number;
  strategicPillarsDefined: boolean;
  primaryIndustry: string;
  targetMarket: string;
  hasActiveOKRs: boolean;
}

export interface CompanyHealthScore {
  totalScore: number; // 0 - 100
  grade: 'EXCELLENT' | 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'WAITING';
  breakdown: {
    financeScore: number; // 0 - 100 (Weight: 35%)
    growthScore: number;  // 0 - 100 (Weight: 30%)
    opsScore: number;     // 0 - 100 (Weight: 20%)
    strategyScore: number;// 0 - 100 (Weight: 15%)
  };
  keyRisks: string[];
  keyStrengths: string[];
}

export interface InventoryHealthMetrics {
  totalStockValue: number;
  lowStockAlertCount: number;
  productsCount: number;
}

export interface DocumentHealthMetrics {
  totalFiles: number;
  legalContractsCount: number;
  meetingNotesCount: number;
  financialDocsCount: number;
  summaryManifest?: string;
}

export interface BusinessContextSnapshot {
  workspaceId: string;
  workspaceName: string;
  generatedAt: string;
  cacheTtlSeconds: number;
  financials: FinancialHealthMetrics;
  marketing: MarketingHealthMetrics;
  operations: OperationsHealthMetrics;
  strategy: StrategyHealthMetrics;
  inventory?: InventoryHealthMetrics;
  documents?: DocumentHealthMetrics;
  healthScore: CompanyHealthScore;
  /**
   * TAMBAHAN (KELOMPOK 3, 6-7 Sep 2026, aditif -- lihat context-engine.ts).
   * Ringkasan pengetahuan perusahaan dari dokumen yang pernah diupload pengguna
   * (memory item bertanda [COMPANY_KNOWLEDGE], BEDA dari [COMPANY_PROFILE] yang
   * sudah dibaca field `strategy` di atas). Opsional dan string kosong/undefined
   * kalau belum ada apapun -- consumer LAMA yang tidak tahu field ini (nudges,
   * alerts, recommendations, simulate, decision-memory, execution-engine) tetap
   * jalan tanpa berubah. Sudah dibatasi panjang/jumlahnya di sumbernya
   * (getAccumulatedCompanyKnowledge, src/lib/ai-brain/company-memory.ts: 10 item
   * terakhir, potong ~3000 karakter) supaya prompt tidak membengkak.
   */
  companyKnowledgeSummary?: string;
}

export type RecommendationCategory = 'FINANCE' | 'MARKETING' | 'OPERATIONS' | 'STRATEGY' | 'EXECUTIVE';
export type RecommendationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type SuggestedActionType =
  | 'COLLECT_INVOICES'
  | 'SCALE_MARKETING'
  | 'APPROVE_HIRING'
  | 'AUDIT_OPEX'
  | 'ADJUST_BUDGET'
  | 'PAUSE_CAMPAIGN'
  | 'GENERAL_ADVICE';

export interface ExplainableWhyDetails {
  evidencePoints: string[];
  mathFormula: string;
  counterFactualRisk: string;
  strategicRationale: string;
}

export interface AIRecommendationItem {
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  triggerReason: string;
  prescription: string;
  projectedImpact: {
    runwayImpactDays?: number;
    costSavingsEstimated?: number;
    revenueBoostPercent?: number;
    confidenceScore: number; // 0.0 - 1.0
  };
  suggestedActionType: SuggestedActionType;
  actionPayload?: Record<string, any>;
  whyDetails?: ExplainableWhyDetails;
  isExecutable: boolean;
}

// -----------------------------------------------------------------------------
// LAYER 1: EXECUTION LAYER
// -----------------------------------------------------------------------------
export interface ExecutionRequest {
  workspaceId: string;
  recommendationId: string;
  actionType: SuggestedActionType;
  actionPayload?: Record<string, any>;
  approvedBy?: string;
  userNotes?: string;
  idempotencyKey?: string;
}

export interface ExecutionResult {
  success: boolean;
  actionId: string;
  actionType: SuggestedActionType;
  executedAt: string;
  message: string;
  details: Record<string, any>;
  decisionMemoryId: string;
}

// -----------------------------------------------------------------------------
// LAYER 2 & 6: DECISION MEMORY & CLOSED FEEDBACK LOOP
// -----------------------------------------------------------------------------
export interface DecisionMemoryRecord {
  id: string;
  workspaceId: string;
  recommendationId: string;
  title: string;
  category: RecommendationCategory;
  actionType: SuggestedActionType;
  approvedAt: string;
  approvedBy: string;
  status: 'EXECUTED' | 'EVALUATING' | 'COMPLETED';
  baselineMetrics: {
    liquidCash: number;
    monthlyBurnRate: number;
    runwayMonths: number;
    revenue30d: number;
  };
  projectedImpact: {
    runwayImpactDays?: number;
    costSavingsEstimated?: number;
    revenueBoostPercent?: number;
    confidenceScore: number;
  };
  actualOutcome?: {
    evaluatedAt: string;
    actualRevenueDeltaPercent?: number;
    actualRunwayDeltaDays?: number;
    accuracyScore: number; // 0 - 100%
  };
  lessonsLearned?: string;
}

export interface FeedbackEvaluation {
  totalDecisionsEvaluated: number;
  averageAccuracyScore: number; // 0 - 100%
  modelCalibrationFactor: number; // multiplier applied to future confidence (e.g. 0.95 - 1.05)
  evaluations: Array<{
    decisionId: string;
    title: string;
    accuracyScore: number;
    status: 'EXCEEDED' | 'ON_TRACK' | 'UNDERPERFORMED';
    insight: string;
  }>;
}

// -----------------------------------------------------------------------------
// LAYER 3: PRIORITY & ALERT ENGINE
// -----------------------------------------------------------------------------
export type AlertSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export interface PriorityAlert {
  id: string;
  severity: AlertSeverity;
  category: RecommendationCategory;
  title: string;
  message: string;
  timestamp: string;
  actionLabel?: string;
  suggestedActionType?: SuggestedActionType;
  actionPayload?: Record<string, any>;
}

// -----------------------------------------------------------------------------
// LAYER 4: HUMAN BEHAVIOR & NUDGING LAYER
// -----------------------------------------------------------------------------
export interface NudgeItem {
  id: string;
  title: string;
  description: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'DATA_INPUT' | 'INVOICE_FOLLOWUP' | 'OKR_REVIEW';
  actionType: string;
  actionLabel: string;
  deepLinkPath?: string;
}

// -----------------------------------------------------------------------------
// LAYER 5: DATA TRUST & VALIDATION LAYER
// -----------------------------------------------------------------------------
export interface DataTrustAnomaly {
  id: string;
  type: 'OUTLIER_EXPENSE' | 'POSSIBLE_DUPLICATE' | 'MISSING_CATEGORY' | 'UNUSUAL_INCOME';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  amount?: number;
  date?: string;
  recordId?: string;
}

export interface DataTrustReport {
  trustScore: number; // 0 - 100%
  status: 'VERIFIED_CLEAN' | 'WARNING_FLAGS' | 'ACTION_REQUIRED';
  totalTransactionsAudited: number;
  totalInvoicesAudited: number;
  anomaliesDetected: DataTrustAnomaly[];
  lastAuditedAt: string;
}

// -----------------------------------------------------------------------------
// WHAT-IF SIMULATOR CONTRACTS
// -----------------------------------------------------------------------------
export interface SimulationScenarioInput {
  workspaceId: string;
  scenarioTitle?: string;
  promptDescription: string;
  adjustments?: {
    additionalMonthlyExpense?: number;
    oneTimeCapex?: number;
    marketingBudgetDeltaPercent?: number;
    expectedRevenueDeltaPercent?: number;
    durationMonths?: number;
  };
}

export interface SimulationMonthProjection {
  month: number;
  monthName: string;
  baselineCash: number;
  projectedCash: number;
  burnRate: number;
  netRevenue: number;
}

export interface SimulationResult {
  scenarioTitle: string;
  summary: string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  baselineRunwayMonths: number;
  simulatedRunwayMonths: number;
  runwayDeltaMonths: number;
  breakEvenMonthEstimated: number | null;
  cashOutDateProjected: string | null;
  monthlyProjections: SimulationMonthProjection[];
  strategicVerdict: string;
  actionableSteps: string[];
}

export interface HPPCalculationInput {
  rawMaterialCost: number;
  laborCost: number;
  overheadCost: number;
  sellingPrice: number;
  monthlyVolume?: number;
}

export interface HPPCalculationResult {
  rawMaterialCost: number;
  laborCost: number;
  overheadCost: number;
  totalHPPPerUnit: number;
  sellingPrice: number;
  grossProfitPerUnit: number;
  marginPercentage: number;
  monthlyVolume: number;
  totalMonthlyRevenue: number;
  totalMonthlyCost: number;
  totalMonthlyGrossProfit: number;
}

export interface KURSimulationInput {
  loanAmount: number;
  tenorMonths: number;
  annualInterestRate?: number;
}

export interface KURSimulationResult {
  loanAmount: number;
  tenorMonths: number;
  annualInterestRate: number;
  monthlyInstallment: number;
  monthlyPrincipal: number;
  monthlyInterest: number;
  totalInterest: number;
  totalRepayment: number;
}
