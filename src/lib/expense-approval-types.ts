import { Role, ExpenseCategory, ExpenseRequestStatus, ExpenseApprovalStatus, ExpenseDecision } from '@prisma/client';

export interface ExpenseRequestItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  accountCode?: string;
}

export interface ExpenseApproval {
  id: string;
  level: number;
  requiredRole: Role;
  status: ExpenseApprovalStatus;
  decision?: ExpenseDecision;
  reason?: string;
  decidedAt?: string;
  approver?: { id: string; fullName: string; email: string } | null;
}

export interface ExpenseRequest {
  id: string;
  requestNumber: string;
  title: string;
  description: string;
  category: ExpenseCategory;
  totalAmount: number;
  status: ExpenseRequestStatus;
  currentLevel: number;
  requiredLevels: number;
  receiptUrls: string[];
  submittedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  financeReviewedAt?: string;
  financeNotes?: string;
  createdAt: string;
  updatedAt: string;
  requesterId: string;
  requester: { id: string; fullName: string; email: string; avatarUrl?: string };
  financeReviewer?: { id: string; fullName: string; email: string; avatarUrl?: string } | null;
  items: ExpenseRequestItem[];
  approvals: ExpenseApproval[];
}