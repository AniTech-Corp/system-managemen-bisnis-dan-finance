/**
 * Bentuk data JSON dari API Modul Pajak. Dipakai komponen client agar tidak
 * mengimpor tipe Prisma (server) ke bundle browser.
 */

export type TaxTypeKey =
  | 'PPH_FINAL_UMKM'
  | 'PPN'
  | 'PPH_21'
  | 'PPH_23'
  | 'PPH_4_2'
  | 'PPH_26'
  | 'BPJS'
  | 'OTHER';

export type PeriodStatusKey = 'OPEN' | 'READY' | 'FILED' | 'PAID' | 'CLOSED';
export type DeadlineStatusKey = 'UPCOMING' | 'DUE_SOON' | 'OVERDUE' | 'DONE' | 'SKIPPED';
export type DocTypeKey =
  | 'TAX_INVOICE'
  | 'WITHHOLDING_SLIP'
  | 'PAYMENT_PROOF'
  | 'FILING_RECEIPT'
  | 'SUPPORTING';
export type DocStatusKey = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface TaxSettingView {
  taxProfile: string;
  entityType: string;
  enablePpn: boolean;
  ppnRate: number;
  pphFinalRate: number;
  umkmThreshold: number;
  pph23Rate: number;
  pph42Rate: number;
  pph21Method: string;
  npwp: string | null;
  nik: string | null;
  kppName: string | null;
  pkpEffectiveDate: string | Date | null;
  taxReminderDays: number[];
  taxReminderChannel: string;
}

export interface PeriodAmountView {
  amount: number;
  dpp: number;
  outputTax: number;
  inputTax: number;
  overpayment: number;
  transactionCount: number;
  note: string;
  ledgerAmount: number | null;
  ledgerDifference: number | null;
}

export interface PeriodView {
  id: string;
  taxType: TaxTypeKey;
  year: number;
  month: number;
  status: PeriodStatusKey;
  dueDatePayment: string | null;
  dueDateFiling: string | null;
  paymentRef: string | null;
  filingRef: string | null;
  filedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  amount: PeriodAmountView;
}

export interface DeadlineView {
  id: string;
  title: string;
  description: string | null;
  category: string;
  taxType: TaxTypeKey | null;
  dueDate: string;
  dueDateKey: string;
  recommendedDate: string;
  daysUntil: number;
  status: DeadlineStatusKey;
  storedStatus: DeadlineStatusKey;
  source: 'TEMPLATE' | 'CUSTOM';
  templateKey: string | null;
  kind: 'PAYMENT' | 'FILING' | 'OTHER';
  legalBasis: string | null;
  reminderDays: number[];
  isActive: boolean;
  taxPeriodId: string | null;
  completedAt: string | null;
  notes: string | null;
}

export interface OverviewAlert {
  level: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
}

export interface OverviewSummary {
  totalPayable: number;
  dueThisMonth: number;
  dueSoon: number;
  overdue: number;
  missingDocuments: number;
  criticalMissing: number;
  filedCount: number;
  paidCount: number;
  periodCount: number;
  compliancePct: number;
}

export interface OverviewResponse {
  setting: TaxSettingView;
  year: number;
  month: number;
  createdPeriods: number;
  createdDeadlines: number;
  periods: PeriodView[];
  currentMonthPeriods: PeriodView[];
  deadlines: DeadlineView[];
  allDeadlines: DeadlineView[];
  summary: OverviewSummary;
  alerts: OverviewAlert[];
}

export interface ComplianceItemView {
  key: string;
  docType: DocTypeKey;
  label: string;
  required: boolean;
  critical: boolean;
  sourceType: string | null;
  sourceId: string | null;
  reference: string;
  amount: number;
  present: boolean;
  documentId: string | null;
  note: string | null;
}

export interface DocumentView {
  id: string;
  docType: DocTypeKey;
  status: DocStatusKey;
  docNumber: string | null;
  fileName: string | null;
  fileId: string | null;
  amount: number | null;
  sourceType: string | null;
  sourceId: string | null;
  createdAt: string;
  taxPeriodId?: string | null;
  deadlineId?: string | null;
  notes?: string | null;
}

export interface ComplianceReportView {
  period: {
    id: string;
    taxType: TaxTypeKey;
    year: number;
    month: number;
    status: PeriodStatusKey;
  } | null;
  items: ComplianceItemView[];
  missing: ComplianceItemView[];
  documents: DocumentView[];
  completenessPct: number;
  requiredCount: number;
  presentCount: number;
}

export interface PeriodDetailResponse {
  period: PeriodView;
  compliance: ComplianceReportView;
}

export interface RecapRowView {
  date: string;
  monthKey: string;
  sourceType: string;
  sourceId: string;
  reference: string;
  partner: string;
  category: string;
  description: string;
  dpp: number;
  rate: number;
  taxAmount: number;
  direction: string;
}

export interface RecapGroupView {
  key: string;
  label: string;
  dpp: number;
  taxAmount: number;
  count: number;
}

export interface RecapResponse {
  taxType: TaxTypeKey;
  label: string;
  startDate: string;
  endDate: string;
  rows: RecapRowView[];
  groups: RecapGroupView[];
  totals: { dpp: number; taxAmount: number; count: number };
  note: string;
  groupBy: string;
}

export interface WithholdingRow {
  id: string;
  taxType: TaxTypeKey;
  sourceType: string;
  sourceId: string | null;
  partnerName: string | null;
  partnerNpwp: string | null;
  dpp: number;
  rate: number;
  taxAmount: number;
  periodYear: number;
  periodMonth: number;
  docNumber: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AccountOption {
  id: string;
  code: string;
  name: string;
  type: string;
}

export interface AccountMap {
  taxType: TaxTypeKey;
  component: string;
  accountId: string;
  code: string;
  name: string;
}

export interface TaxSettingsResponse {
  setting: TaxSettingView;
  hasAccountingSetting: boolean;
  accountMaps: AccountMap[];
  accounts: AccountOption[];
}

export interface PeriodsResponse {
  success: boolean;
  year: number;
  setting: TaxSettingView;
  periods: PeriodView[];
}

export interface DeadlinesResponse {
  success: boolean;
  startDate: string;
  endDate: string;
  deadlines: DeadlineView[];
  summary: Record<string, number>;
}

export interface PermissionsResponse {
  role: string;
  isOwner: boolean;
  permissions: Record<string, boolean>;
}

export interface DocumentListResponse {
  success: boolean;
  documents: DocumentView[];
}
