import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Audit trail keuangan.
 *
 * Memakai model `AuditLog` yang sudah ada (tabel `audit_logs`) agar tidak
 * membuat tabel audit kedua. `changes` menyimpan snapshot `before`/`after`
 * beserta daftar field yang berubah; `reason` menyimpan alasan koreksi.
 *
 * Aturan penting:
 * - Audit untuk mutasi uang ditulis di dalam transaksi database yang sama
 *   (`recordAuditInTx`). Kalau audit gagal, mutasi ikut dibatalkan.
 * - Tidak ada update/delete audit. Tabel ini append-only dari sisi aplikasi.
 * - `ActivityEvent` tetap dipakai untuk feed aktivitas/AI; jangan dihapus.
 */

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'CANCEL'
  | 'REVERSE'
  | 'ARCHIVE'
  | 'CLOSE'
  | 'LOCK'
  | 'REOPEN';

export type AuditEntityType =
  | 'CASH_TRANSACTION'
  | 'INVOICE'
  | 'JOURNAL_ENTRY'
  | 'EXPENSE_REQUEST'
  | 'PERIOD'
  | 'PROJECT'
  | 'ACCOUNTING_SETTING'
  | 'SECURITY_APPROVAL'
  | 'PURCHASING_APPROVAL'
  | 'SYSTEM';

export interface AuditSnapshotMap {
  [key: string]: unknown;
}

export interface RecordAuditInput {
  workspaceId: string;
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  before?: AuditSnapshotMap | null;
  after?: AuditSnapshotMap | null;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
}

function jsonSafe(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value, (_key, raw) => {
      if (typeof raw === 'bigint') return raw.toString();
      return raw;
    })
  ) as Prisma.InputJsonValue;
}

function changedKeys(before?: AuditSnapshotMap | null, after?: AuditSnapshotMap | null): string[] {
  if (!before && !after) return [];
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return Array.from(keys).filter((key) => {
    const a = before?.[key];
    const b = after?.[key];
    return JSON.stringify(a) !== JSON.stringify(b);
  });
}

function normalizeReason(reason?: string | null): string | null {
  const trimmed = typeof reason === 'string' ? reason.trim() : '';
  return trimmed.length > 0 ? trimmed.slice(0, 2000) : null;
}

/** Tulis audit di dalam transaksi pemanggil. Jangan ditelan error-nya. */
export async function recordAuditInTx(
  tx: Prisma.TransactionClient,
  input: RecordAuditInput
): Promise<void> {
  await tx.auditLog.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      changes: jsonSafe({
        before: input.before ?? null,
        after: input.after ?? null,
        diff: changedKeys(input.before, input.after),
      }),
      metadata: input.metadata ? jsonSafe(input.metadata) : Prisma.JsonNull,
      reason: normalizeReason(input.reason),
    },
  });
}

/**
 * Tulis audit non-kritis (mis. sesudah service yang punya transaksi sendiri).
 * Gagal menulis audit tidak boleh menggagalkan aksi yang sudah selesai.
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        changes: jsonSafe({
          before: input.before ?? null,
          after: input.after ?? null,
          diff: changedKeys(input.before, input.after),
        }),
        metadata: input.metadata ? jsonSafe(input.metadata) : Prisma.JsonNull,
        reason: normalizeReason(input.reason),
      },
    });
  } catch (err) {
    console.warn('[audit-trail] gagal menulis audit non-kritis:', err);
  }
}

/* ───────────────────────── snapshot helpers ───────────────────────── */

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function cashTransactionSnapshot(row: {
  id: string;
  userId?: string | null;
  type?: string | null;
  category?: string | null;
  amount?: number | Prisma.Decimal | null;
  description?: string | null;
  transactionDate?: Date | string | null;
  paymentMethod?: string | null;
  division?: string | null;
  projectId?: string | null;
  invoiceId?: string | null;
  obligationId?: string | null;
  payrollId?: string | null;
  settlementAccountId?: string | null;
  sourceFileId?: string | null;
}): AuditSnapshotMap {
  return {
    id: row.id,
    userId: row.userId ?? null,
    type: row.type ?? null,
    category: row.category ?? null,
    amount: row.amount == null ? null : Number(row.amount),
    description: row.description ?? null,
    transactionDate: iso(row.transactionDate),
    paymentMethod: row.paymentMethod ?? null,
    division: row.division ?? null,
    projectId: row.projectId ?? null,
    invoiceId: row.invoiceId ?? null,
    obligationId: row.obligationId ?? null,
    payrollId: row.payrollId ?? null,
    settlementAccountId: row.settlementAccountId ?? null,
    sourceFileId: row.sourceFileId ?? null,
  };
}

export function invoiceSnapshot(row: {
  id: string;
  invoiceNumber?: string | null;
  clientName?: string | null;
  status?: string | null;
  subtotal?: number | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  paidAmount?: number | null;
  issueDate?: Date | string | null;
  dueDate?: Date | string | null;
  paidAt?: Date | string | null;
  partnerId?: string | null;
  termDays?: number | null;
  division?: string | null;
  projectId?: string | null;
  itemCount?: number | null;
}): AuditSnapshotMap {
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber ?? null,
    clientName: row.clientName ?? null,
    status: row.status ?? null,
    subtotal: row.subtotal ?? null,
    taxRate: row.taxRate ?? null,
    taxAmount: row.taxAmount ?? null,
    totalAmount: row.totalAmount ?? null,
    paidAmount: row.paidAmount ?? null,
    issueDate: iso(row.issueDate),
    dueDate: iso(row.dueDate),
    paidAt: iso(row.paidAt),
    partnerId: row.partnerId ?? null,
    termDays: row.termDays ?? null,
    division: row.division ?? null,
    projectId: row.projectId ?? null,
    itemCount: row.itemCount ?? null,
  };
}

export function journalSnapshot(row: {
  id: string;
  entryNumber?: string | null;
  entryDate?: Date | string | null;
  description?: string | null;
  source?: string | null;
  sourceId?: string | null;
  status?: string | null;
  periodId?: string | null;
  reversedBy?: string | null;
  lineCount?: number | null;
  totalDebit?: number | Prisma.Decimal | null;
}): AuditSnapshotMap {
  return {
    id: row.id,
    entryNumber: row.entryNumber ?? null,
    entryDate: iso(row.entryDate),
    description: row.description ?? null,
    source: row.source ?? null,
    sourceId: row.sourceId ?? null,
    status: row.status ?? null,
    periodId: row.periodId ?? null,
    reversedBy: row.reversedBy ?? null,
    lineCount: row.lineCount ?? null,
    totalDebit: row.totalDebit == null ? null : Number(row.totalDebit),
  };
}

export function projectSnapshot(row: {
  id: string;
  code?: string | null;
  name?: string | null;
  clientName?: string | null;
  description?: string | null;
  division?: string | null;
  status?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
}): AuditSnapshotMap {
  return {
    id: row.id,
    code: row.code ?? null,
    name: row.name ?? null,
    clientName: row.clientName ?? null,
    description: row.description ?? null,
    division: row.division ?? null,
    status: row.status ?? null,
    startDate: iso(row.startDate),
    endDate: iso(row.endDate),
  };
}
