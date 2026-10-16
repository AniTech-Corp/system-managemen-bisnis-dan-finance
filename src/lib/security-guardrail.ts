import { prisma } from '@/lib/prisma';
import { invalidateContextCache } from '@/lib/ai-brain';

export type HighRiskActionType =
  | 'PURGE_FINANCE'
  | 'PURGE_CASH'
  | 'DELETE_PROFILE'
  | 'PURGE_INVOICES'
  | 'PURGE_CAMPAIGNS';

export interface ApprovalRequest {
  id: string;
  ticketNumber: string;
  workspaceId: string;
  requesterRole: 'FINANCE' | 'MARKETING' | 'STAFF' | string;
  requesterName: string;
  actionType: HighRiskActionType;
  title: string;
  description: string;
  originalPrompt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

/**
 * Detects whether a prompt expresses intent to perform a high-risk / destructive action.
 */
export function detectHighRiskAction(message: string): {
  isHighRisk: boolean;
  actionType?: HighRiskActionType;
  title?: string;
  description?: string;
} {
  const lower = (message || '').toLowerCase();

  // 0. Explicit confirmed tokens
  if (lower.includes('confirmed_purge_finance')) {
    return {
      isHighRisk: true,
      actionType: 'PURGE_FINANCE',
      title: 'Hapus & Reset Seluruh Data Keuangan',
      description: 'Menghapus seluruh riwayat transaksi kas (pemasukan & pengeluaran) serta mereset saldo kas ke Rp 0.',
    };
  }

  // 1. Purge financial data / cash book / all transactions
  if (
    /\b(hapus|penghapusan|delete|bersihkan|kosongkan|reset)\s+(semua\s+|seluruh\s+)?(data\s+)?(keuangan|kas|transaksi|buku\s+kas)\b/i.test(
      lower
    ) ||
    (/\b(hapus|penghapusan|delete|reset)\b/i.test(lower) && /\b(seluruh|semua)\b/i.test(lower) && /\b(keuangan|kas)\b/i.test(lower))
  ) {
    return {
      isHighRisk: true,
      actionType: 'PURGE_FINANCE',
      title: 'Hapus & Reset Seluruh Data Keuangan',
      description: 'Menghapus seluruh riwayat transaksi kas (pemasukan & pengeluaran) serta mereset saldo kas ke Rp 0.',
    };
  }

  // 2. Purge all invoices / clients receivables
  if (
    /\b(hapus|delete|batalkan|bersihkan)\s+(semua\s+|seluruh\s+)?(tagihan|invoice|faktur|piutang)\b/i.test(lower)
  ) {
    return {
      isHighRisk: true,
      actionType: 'PURGE_INVOICES',
      title: 'Hapus Seluruh Faktur Invoice & Piutang Klien',
      description: 'Menghapus seluruh daftar tagihan dan piutang klien yang tercatat di database.',
    };
  }

  // 3. Delete / reset company profile / business memory
  if (
    /\b(hapus|delete|reset|bersihkan)\s+(data\s+)?(profil|identitas|memori|perusahaan|usaha|pt|cv)\b/i.test(lower)
  ) {
    return {
      isHighRisk: true,
      actionType: 'DELETE_PROFILE',
      title: 'Hapus Profil Usaha & Memori Kecerdasan Bisnis',
      description: 'Menghapus identitas perusahaan, bidang usaha, dan memori AI yang telah dipelajari.',
    };
  }

  return { isHighRisk: false };
}

/**
 * In-memory fallback cache for pending approval requests per workspace
 * (backed by ActivityEvent in Postgres database).
 */
const MEMORY_APPROVALS: ApprovalRequest[] = [];

/**
 * Creates a new pending approval ticket for CEO review.
 */
export async function createApprovalRequest(params: {
  workspaceId: string;
  requesterRole: string;
  requesterName: string;
  actionType: HighRiskActionType;
  title: string;
  description: string;
  originalPrompt: string;
}): Promise<ApprovalRequest> {
  const ticketNumber = `REQ-${params.requesterRole.slice(0, 3).toUpperCase()}-${Math.floor(
    1000 + Math.random() * 9000
  )}`;

  const request: ApprovalRequest = {
    id: `appr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ticketNumber,
    workspaceId: params.workspaceId,
    requesterRole: params.requesterRole,
    requesterName: params.requesterName,
    actionType: params.actionType,
    title: params.title,
    description: params.description,
    originalPrompt: params.originalPrompt,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  MEMORY_APPROVALS.unshift(request);

  // Also persist in database as an ActivityEvent so it survives server reboots
  try {
    await prisma.activityEvent.create({
      data: {
        workspaceId: params.workspaceId,
        type: 'SECURITY_APPROVAL_REQUESTED',
        payload: request as any,
      },
    });
  } catch (err) {
    console.warn('[SecurityGuardrail] Failed to log approval to database:', err);
  }

  return request;
}

/**
 * Retrieves all pending approval requests for a workspace.
 */
export async function getPendingApprovals(workspaceId: string): Promise<ApprovalRequest[]> {
  try {
    const [requestEvents, resolutionEvents] = await Promise.all([
      prisma.activityEvent.findMany({
        where: { workspaceId, type: 'SECURITY_APPROVAL_REQUESTED' },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.activityEvent.findMany({
        where: {
          workspaceId,
          type: { in: ['SECURITY_APPROVAL_EXECUTED', 'SECURITY_APPROVAL_REJECTED'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ]);

    const resolvedIds = new Set<string>();
    for (const resEv of resolutionEvents) {
      const p = resEv.payload as any;
      if (p?.request?.id) resolvedIds.add(p.request.id);
      if (p?.request?.ticketNumber) resolvedIds.add(p.request.ticketNumber);
    }

    const dbRequests: ApprovalRequest[] = [];
    for (const ev of requestEvents) {
      if (ev.payload && typeof ev.payload === 'object') {
        const req = ev.payload as unknown as ApprovalRequest;
        if (!resolvedIds.has(req.id) && !resolvedIds.has(req.ticketNumber)) {
          dbRequests.push(req);
        }
      }
    }

    // Merge with in-memory ensuring uniqueness
    const merged: ApprovalRequest[] = [];
    for (const mem of MEMORY_APPROVALS.filter((m) => m.workspaceId === workspaceId)) {
      if (!resolvedIds.has(mem.id) && !resolvedIds.has(mem.ticketNumber) && mem.status === 'PENDING') {
        merged.push(mem);
      }
    }

    for (const dbReq of dbRequests) {
      if (!merged.find((m) => m.id === dbReq.id || m.ticketNumber === dbReq.ticketNumber)) {
        merged.push(dbReq);
      }
    }

    return merged.filter((r) => r.status === 'PENDING');
  } catch (err) {
    console.warn('[SecurityGuardrail] Failed to query approvals from database, using memory fallback:', err);
    return MEMORY_APPROVALS.filter((m) => m.workspaceId === workspaceId && m.status === 'PENDING');
  }
}

/**
 * Resolves (Approves or Rejects) a pending approval request.
 * If approved, executes the requested high-risk operation!
 */
async function resolveApprovalRequestInternal(params: {
  requestId: string;
  workspaceId: string;
  decision: 'APPROVED' | 'REJECTED';
  resolvedBy: string;
}): Promise<{
  success: boolean;
  request: ApprovalRequest | null;
  executionResult?: {
    deletedTransactionsCount?: number;
    deletedInvoicesCount?: number;
    message: string;
  };
}> {
  let targetReq = MEMORY_APPROVALS.find(
    (m) => (m.id === params.requestId || m.ticketNumber === params.requestId) && m.workspaceId === params.workspaceId && m.status === 'PENDING'
  );

  if (!targetReq) {
    const list = await getPendingApprovals(params.workspaceId);
    targetReq = list.find((m) => m.id === params.requestId || m.ticketNumber === params.requestId);
    if (targetReq) {
      MEMORY_APPROVALS.push(targetReq);
    }
  }

  if (!targetReq) {
    return { success: false, request: null };
  }

  const previousStatus = targetReq.status;
  targetReq.status = params.decision;
  targetReq.resolvedAt = new Date().toISOString();
  targetReq.resolvedBy = params.resolvedBy;


  let executionResult: any = undefined;

  try {
    if (params.decision === 'APPROVED') {
      // Execute actual database action
      if (targetReq.actionType === 'PURGE_FINANCE') {
      const [deletedTxs, deletedInvs] = await prisma.$transaction([
        prisma.cashTransaction.deleteMany({ where: { workspaceId: params.workspaceId } }),
        prisma.invoice.deleteMany({ where: { workspaceId: params.workspaceId } }),
      ]);

      invalidateContextCache(params.workspaceId);

      executionResult = {
        deletedTransactionsCount: deletedTxs.count,
        deletedInvoicesCount: deletedInvs.count,
        message: `Persetujuan CEO dieksekusi: ${deletedTxs.count} transaksi dan ${deletedInvs.count} invoice telah dihapus dari database.`,
      };
      } else if (targetReq.actionType === 'PURGE_CASH') {
        const deletedTxs = await prisma.cashTransaction.deleteMany({ where: { workspaceId: params.workspaceId } });
        invalidateContextCache(params.workspaceId);
        executionResult = {
          deletedTransactionsCount: deletedTxs.count,
          message: `Persetujuan Owner dieksekusi: ${deletedTxs.count} transaksi kas telah dihapus dari database.`,
        };
      } else if (targetReq.actionType === 'PURGE_INVOICES') {
      const deletedInvs = await prisma.invoice.deleteMany({ where: { workspaceId: params.workspaceId } });
      invalidateContextCache(params.workspaceId);
      executionResult = {
        deletedInvoicesCount: deletedInvs.count,
        message: `Persetujuan CEO dieksekusi: ${deletedInvs.count} faktur invoice telah dihapus.`,
      };
      } else if (targetReq.actionType === 'DELETE_PROFILE') {
      const deletedMemories = await prisma.memoryItem.deleteMany({
        where: {
          workspaceId: params.workspaceId,
          scope: 'WORKSPACE',
          content: { startsWith: '[COMPANY_PROFILE]' },
        },
      });
      invalidateContextCache(params.workspaceId);
      executionResult = {
        deletedMemoriesCount: deletedMemories.count,
        message: `Persetujuan CEO dieksekusi: Profil usaha dan memori bisnis telah dibersihkan.`,
      };
      } else if (targetReq.actionType === 'PURGE_CAMPAIGNS') {
        const deletedCampaigns = await prisma.campaign.deleteMany({ where: { workspaceId: params.workspaceId } });
        executionResult = {
          deletedCampaignsCount: deletedCampaigns.count,
          message: `Persetujuan Owner dieksekusi: ${deletedCampaigns.count} kampanye telah dihapus dari database.`,
        };
      }
    }
  } catch (error) {
    // Mutasi destruktif itu sendiri GAGAL -- belum ada apapun yang berubah di DB,
    // aman di-revert ke PENDING supaya tiket bisa dicoba lagi (retryable).
    targetReq.status = previousStatus;
    targetReq.resolvedAt = undefined;
    targetReq.resolvedBy = undefined;
    throw error;
  }

  // Titik ini HANYA tercapai kalau mutasi destruktif (kalau ada) SUDAH SUKSES commit.
  // Keputusan sudah final secara data -- JANGAN revert status ke PENDING lagi mulai
  // sini, walau audit-log di bawah gagal ditulis (DEEP-004: revert-on-any-error yang
  // lama bikin approval destructive bisa di-replay dan purge finansial jalan 2x kalau
  // logging-nya yang gagal, bukan mutasinya).
  try {
    await prisma.activityEvent.create({
      data: {
        workspaceId: params.workspaceId,
        type: params.decision === 'APPROVED' ? 'SECURITY_APPROVAL_EXECUTED' : 'SECURITY_APPROVAL_REJECTED',
        payload: {
          request: targetReq as any,
          executionResult,
        },
      },
    });
  } catch (auditLogError) {
    console.error(
      `[security-guardrail] Audit log GAGAL ditulis setelah resolusi tiket ${targetReq.id} (decision=${params.decision}) sudah final -- status TETAP ${targetReq.status}, TIDAK di-revert, supaya tiket tidak bisa direplay. Perlu rekonsiliasi manual audit-trail.`,
      auditLogError
    );
  }

  return {
    success: true,
    request: targetReq,
    executionResult,
  };
}

// Serialisasi per ticket mencegah dua klik/tab dalam proses Node yang sama dan
// advisory lock PostgreSQL menutup race yang sama lintas worker. Lock ini
// transaction-scoped, sehingga tidak perlu migration/schema baru. Resolver
// tetap mencari tiket PENDING setelah lock didapat; request kedua menjadi gagal
// setelah event resolusi pertama terlihat.
const approvalResolutionLocks = new Map<string, Promise<unknown>>();

export async function resolveApprovalRequest(
  params: Parameters<typeof resolveApprovalRequestInternal>[0]
): Promise<Awaited<ReturnType<typeof resolveApprovalRequestInternal>>> {
  const key = `${params.workspaceId}:${params.requestId}`;
  const previous = approvalResolutionLocks.get(key);
  const current = (previous ? previous.catch(() => undefined) : Promise.resolve())
    .then(() => prisma.$transaction(async (tx) => {
      const lockKey = `klir:security-approval:${params.workspaceId}:${params.requestId}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      return resolveApprovalRequestInternal(params);
    }));
  approvalResolutionLocks.set(key, current);
  try {
    return await current as Awaited<ReturnType<typeof resolveApprovalRequestInternal>>;
  } finally {
    if (approvalResolutionLocks.get(key) === current) approvalResolutionLocks.delete(key);
  }
}
