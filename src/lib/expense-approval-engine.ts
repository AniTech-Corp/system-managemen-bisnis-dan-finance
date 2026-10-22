import { Role } from '@prisma/client';

export const EXPENSE_APPROVAL_CONFIG = {
  thresholds: [
    { maxAmount: 5_000_000, levels: 0, requiredRoles: [] as Role[] },
    { maxAmount: 20_000_000, levels: 1, requiredRoles: ['MANAGER', 'ADMIN', 'OWNER'] as Role[] },
    { maxAmount: 100_000_000, levels: 2, requiredRoles: ['MANAGER', 'ADMIN'] as Role[] },
    { maxAmount: Infinity, levels: 3, requiredRoles: ['MANAGER', 'ADMIN', 'OWNER'] as Role[] },
  ],
  financeReviewThreshold: 0,
};

export interface ExpenseApprovalEvaluation {
  requiresApproval: boolean;
  requiresFinanceReview: boolean;
  levels: number;
  requiredRoles: Role[];
  approvalChain: { level: number; role: Role }[];
}

export function evaluateExpenseApproval(amount: number): ExpenseApprovalEvaluation {
  if (!Number.isFinite(amount)) {
    return {
      requiresApproval: true,
      requiresFinanceReview: true,
      levels: 3,
      requiredRoles: ['MANAGER', 'ADMIN', 'OWNER'],
      approvalChain: [
        { level: 1, role: 'MANAGER' },
        { level: 2, role: 'ADMIN' },
        { level: 3, role: 'OWNER' },
      ],
    };
  }

  const threshold = EXPENSE_APPROVAL_CONFIG.thresholds.find(
    (t) => amount <= t.maxAmount
  ) || EXPENSE_APPROVAL_CONFIG.thresholds[EXPENSE_APPROVAL_CONFIG.thresholds.length - 1];

  const approvalChain = threshold.requiredRoles.map((role, idx) => ({
    level: idx + 1,
    role,
  }));

  return {
    requiresApproval: threshold.levels > 0,
    requiresFinanceReview: true,
    levels: threshold.levels,
    requiredRoles: threshold.requiredRoles,
    approvalChain,
  };
}

export function generateRequestNumber(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EXP-${dateStr}-${randomSuffix}`;
}

export function getRoleHierarchy(role: Role): number {
  const hierarchy: Record<Role, number> = {
    OWNER: 5,
    ADMIN: 4,
    MANAGER: 3,
    MEMBER: 2,
    VIEWER: 1,
  };
  return hierarchy[role] ?? 0;
}

export function hasMinRole(userRole: Role, requiredRole: Role): boolean {
  return getRoleHierarchy(userRole) >= getRoleHierarchy(requiredRole);
}

export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  OPERATIONAL: 'Operasional',
  MARKETING: 'Pemasaran',
  TRAVEL: 'Perjalanan Dinas',
  MEALS: 'Konsumsi',
  EQUIPMENT: 'Peralatan',
  SOFTWARE: 'Software/Lisensi',
  TRAINING: 'Pelatihan',
  OTHER: 'Lainnya',
};

export const EXPENSE_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Diajukan',
  FINANCE_REVIEW: 'Review Finance',
  PENDING_APPROVAL: 'Menunggu Persetujuan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

export const EXPENSE_STATUS_COLORS: Record<string, string> = {
  DRAFT: '#94A3B8',
  SUBMITTED: '#3B82F6',
  FINANCE_REVIEW: '#F59E0B',
  PENDING_APPROVAL: '#8B5CF6',
  APPROVED: '#10B981',
  REJECTED: '#EF4444',
  CANCELLED: '#64748B',
};