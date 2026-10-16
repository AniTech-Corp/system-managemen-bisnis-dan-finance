/**
 * Persetujuan pengeluaran berjenjang (spending approval guardrail).
 *
 * Masalah: PO/pengeluaran nominal besar bisa langsung tercatat tanpa ada yang
 * menyetujui -- staff biasa (MEMBER) bisa saja input pembelian Rp50 juta atas
 * nama workspace tanpa sepengetahuan atasan. Modul ini murni FUNGSI EVALUASI +
 * PENYIMPANAN TIKET, bukan yang mengeksekusi pembelian itu sendiri -- endpoint
 * yang benar-benar membuat PurchaseOrder (src/app/api/v1/inventory/
 * purchase-orders/route.ts) di luar berkas yang boleh disentuh sesi ini,
 * sehingga integrasi "cek dulu ke sini sebelum PurchaseOrder.create()" BELUM
 * disambungkan -- lihat catatan_jujur/butuh_dari_tim di laporan agent.
 *
 * Pola disalin dari security-guardrail.ts (detectHighRiskAction/createApprovalRequest/
 * getPendingApprovals/resolveApprovalRequest) TAPI dua beda penting:
 * 1. security-guardrail.ts mendeteksi INTENT dari teks bebas (regex atas prompt),
 *    modul ini mengevaluasi NOMINAL RUPIAH terhadap ambang tetap -- lebih sederhana,
 *    tidak butuh regex.
 * 2. security-guardrail.ts APPROVED langsung EKSEKUSI (hapus data) di dalam
 *    resolveApprovalRequest(). Modul ini SENGAJA TIDAK mengeksekusi apa pun saat
 *    APPROVED -- cuma mencatat keputusan. Alasan: aksi nyata (bikin PurchaseOrder,
 *    posting CashTransaction) adalah tanggung jawab endpoint pemanggil yang punya
 *    konteks penuh (item, supplier, dst), bukan tanggung jawab guardrail generik ini.
 *
 * Endpoint PurchaseOrder memakai modul ini sebagai gate sebelum mutasi stok/kas.
 * Penyimpanan: model ActivityEvent yang sudah ada (field `type` String bebas,
 * `payload` Json bebas) -- TIDAK ada migrasi skema baru. Dua tipe event baru:
 * - PURCHASING_APPROVAL_REQUESTED : tiket baru dibuat, status PENDING
 * - PURCHASING_APPROVAL_RESOLVED  : tiket diputuskan (APPROVED atau REJECTED)
 * Status "masih PENDING" dihitung dengan cara yang sama seperti security-guardrail.ts:
 * ambil semua REQUESTED, buang yang id-nya sudah muncul di RESOLVED.
 */

import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { hasMinRole } from '@/lib/tenant-guard';

// ---------------------------------------------------------------------------
// Konfigurasi ambang (Rupiah)
// ---------------------------------------------------------------------------

/**
 * < MANAGER_THRESHOLD           -> tidak butuh approval, siapapun (MEMBER ke atas) jalan.
 * >= MANAGER_THRESHOLD dan < OWNER_THRESHOLD -> butuh approval role >= MANAGER.
 * >= OWNER_THRESHOLD             -> butuh approval role >= ADMIN (OWNER otomatis lolos
 *                                    juga karena ROLE_HIERARCHY OWNER(5) > ADMIN(4)).
 */
export const SPENDING_APPROVAL_THRESHOLDS = {
  MANAGER_THRESHOLD: 5_000_000,
  OWNER_THRESHOLD: 20_000_000,
} as const;

export type SpendingApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface SpendingApprovalRequest {
  id: string;
  ticketNumber: string;
  workspaceId: string;
  requesterId: string;
  requesterName: string;
  requesterRole: Role;
  amount: number;
  requiredMinRole: Role;
  category: string;
  description: string;
  /** Soft-reference opsional ke sumber (mis. 'PURCHASE_ORDER_DRAFT' + id draft/PO),
   *  meniru pola StockMovement.sourceType/sourceId. Tidak wajib diisi. */
  sourceType?: string;
  sourceId?: string;
  status: SpendingApprovalStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolvedByRole?: Role;
  draftPayload?: {
    supplierName: string;
    supplierPhone?: string;
    paymentMethod: string;
    notes?: string;
    items: Array<{ productId: string; qty: number; unitCost: number }>;
  };
}

const ACTIVITY_TYPE_REQUESTED = 'PURCHASING_APPROVAL_REQUESTED';
const ACTIVITY_TYPE_RESOLVED = 'PURCHASING_APPROVAL_RESOLVED';

// ---------------------------------------------------------------------------
// Evaluasi ambang
// ---------------------------------------------------------------------------

/**
 * Menentukan apakah sebuah nominal pengeluaran/PO butuh approval berjenjang,
 * dan role minimum siapa yang berhak menyetujuinya. Fungsi murni (tidak
 * menyentuh database), aman dipanggil dari mana saja termasuk endpoint lain
 * sebelum benar-benar menulis PurchaseOrder/CashTransaction.
 */
export function evaluateSpendingApproval(amount: number): {
  requiresApproval: boolean;
  requiredMinRole: Role | null;
} {
  if (!Number.isFinite(amount)) {
    // Non-finite (Infinity/NaN, misal hasil overflow qty*unitCost) HARUS ditahan,
    // bukan diloloskan -- treat sebagai kasus paling berisiko (DEEP-002 overflow bypass).
    return { requiresApproval: true, requiredMinRole: 'ADMIN' };
  }
  if (amount < SPENDING_APPROVAL_THRESHOLDS.MANAGER_THRESHOLD) {
    return { requiresApproval: false, requiredMinRole: null };
  }
  if (amount >= SPENDING_APPROVAL_THRESHOLDS.OWNER_THRESHOLD) {
    return { requiresApproval: true, requiredMinRole: 'ADMIN' };
  }
  return { requiresApproval: true, requiredMinRole: 'MANAGER' };
}

function generateTicketNumber(requesterRole: string): string {
  const rolePrefix = (requesterRole || 'USR').slice(0, 3).toUpperCase();
  return `SPA-${rolePrefix}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ---------------------------------------------------------------------------
// Buat tiket approval
// ---------------------------------------------------------------------------

/**
 * Membuat tiket approval baru untuk sebuah pengeluaran/PO yang nominalnya di
 * atas ambang. Melempar Error kalau nominal ternyata di bawah ambang (caller
 * seharusnya sudah cek evaluateSpendingApproval() dulu sebelum sampai sini --
 * dilempar Error, bukan diam-diam dibolehkan, supaya bug caller ketahuan cepat).
 */
export async function createSpendingApprovalRequest(params: {
  workspaceId: string;
  requesterId: string;
  requesterName: string;
  requesterRole: Role;
  amount: number;
  category: string;
  description: string;
  sourceType?: string;
  sourceId?: string;
  draftPayload?: SpendingApprovalRequest['draftPayload'];
}): Promise<SpendingApprovalRequest> {
  const evaluation = evaluateSpendingApproval(params.amount);
  if (!evaluation.requiresApproval || !evaluation.requiredMinRole) {
    throw new Error(
      `Nominal Rp${params.amount.toLocaleString('id-ID')} di bawah ambang approval ` +
        `(Rp${SPENDING_APPROVAL_THRESHOLDS.MANAGER_THRESHOLD.toLocaleString('id-ID')}), ` +
        `tidak perlu tiket persetujuan.`
    );
  }

  const request: SpendingApprovalRequest = {
    id: `spa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ticketNumber: generateTicketNumber(params.requesterRole),
    workspaceId: params.workspaceId,
    requesterId: params.requesterId,
    requesterName: params.requesterName,
    requesterRole: params.requesterRole,
    amount: params.amount,
    requiredMinRole: evaluation.requiredMinRole,
    category: params.category,
    description: params.description,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    draftPayload: params.draftPayload,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  await prisma.activityEvent.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.requesterId,
      type: ACTIVITY_TYPE_REQUESTED,
      payload: request as any,
    },
  });

  return request;
}

// ---------------------------------------------------------------------------
// Baca tiket pending
// ---------------------------------------------------------------------------

/**
 * Mengambil semua tiket approval yang masih PENDING milik satu workspace.
 * "Masih pending" = ada event REQUESTED yang id-nya BELUM muncul di event
 * RESOLVED manapun untuk workspace yang sama.
 */
export async function getPendingSpendingApprovals(workspaceId: string): Promise<SpendingApprovalRequest[]> {
  const [requestEvents, resolutionEvents] = await Promise.all([
    prisma.activityEvent.findMany({
      where: { workspaceId, type: ACTIVITY_TYPE_REQUESTED },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.activityEvent.findMany({
      where: { workspaceId, type: ACTIVITY_TYPE_RESOLVED },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ]);

  const resolvedIds = new Set<string>();
  for (const ev of resolutionEvents) {
    const payload = ev.payload as any;
    const resolvedId = payload?.request?.id ?? payload?.request?.ticketNumber;
    if (resolvedId) resolvedIds.add(resolvedId);
  }

  const pending: SpendingApprovalRequest[] = [];
  for (const ev of requestEvents) {
    const req = ev.payload as unknown as SpendingApprovalRequest;
    if (!req?.id) continue;
    if (resolvedIds.has(req.id) || resolvedIds.has(req.ticketNumber)) continue;
    if (req.status !== 'PENDING') continue;
    pending.push(req);
  }
  return pending;
}

// ---------------------------------------------------------------------------
// Resolve (approve/reject)
// ---------------------------------------------------------------------------

/**
 * Read one ticket including its terminal decision. The approval inbox only
 * exposes PENDING tickets, but the PurchaseOrder retry needs to inspect an
 * APPROVED ticket without trusting a client-supplied draft.
 */
export async function getSpendingApprovalRequest(
  workspaceId: string,
  requestId: string
): Promise<SpendingApprovalRequest | null> {
  const [requestEvents, resolutionEvents] = await Promise.all([
    prisma.activityEvent.findMany({
      where: { workspaceId, type: ACTIVITY_TYPE_REQUESTED },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.activityEvent.findMany({
      where: { workspaceId, type: ACTIVITY_TYPE_RESOLVED },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);
  const requested = requestEvents
    .map((event) => event.payload as unknown as SpendingApprovalRequest)
    .find((request) => request?.id === requestId || request?.ticketNumber === requestId);
  if (!requested) return null;
  const resolution = resolutionEvents
    .map((event) => (event.payload as any)?.request as SpendingApprovalRequest | undefined)
    .find((request) => request?.id === requested.id || request?.ticketNumber === requested.ticketNumber);
  return resolution ? { ...requested, ...resolution } : requested;
}

export type ResolveSpendingApprovalResult =
  | { success: true; request: SpendingApprovalRequest }
  | {
      success: false;
      code: 'NOT_FOUND' | 'ROLE_INSUFFICIENT';
      message: string;
      request?: SpendingApprovalRequest;
    };

/**
 * Menyetujui atau menolak sebuah tiket approval. Cek role dilakukan DI SINI
 * (per-tiket, terhadap requiredMinRole tiket itu sendiri) -- ini lapis kedua,
 * terpisah dari lapis pertama di route.ts (withTenantGuard minRole di level
 * endpoint). Lapis pertama menyaring MEMBER/VIEWER lebih awal (murah), lapis
 * kedua di sini menyaring kasus role lolos syarat MINIMUM endpoint (MANAGER)
 * tapi TIDAK cukup untuk tiket spesifik yang butuh ADMIN (nominal >=Rp20jt).
 * TIDAK mengeksekusi transaksi finansial apapun saat APPROVED -- cuma mencatat
 * keputusan (lihat komentar pembuka berkas).
 */
async function resolveSpendingApprovalRequestInternal(params: {
  requestId: string;
  workspaceId: string;
  decision: 'APPROVED' | 'REJECTED';
  resolverId: string;
  resolverName: string;
  resolverRole: Role;
}): Promise<ResolveSpendingApprovalResult> {
  const pending = await getPendingSpendingApprovals(params.workspaceId);
  const target = pending.find((r) => r.id === params.requestId || r.ticketNumber === params.requestId);

  if (!target) {
    return {
      success: false,
      code: 'NOT_FOUND',
      message: 'Tiket persetujuan tidak ditemukan atau sudah diselesaikan.',
    };
  }

  if (!hasMinRole(params.resolverRole, target.requiredMinRole)) {
    return {
      success: false,
      code: 'ROLE_INSUFFICIENT',
      message:
        `Tiket #${target.ticketNumber} (Rp${target.amount.toLocaleString('id-ID')}) butuh ` +
        `persetujuan minimal role ${target.requiredMinRole}, role Anda saat ini ${params.resolverRole}.`,
      request: target,
    };
  }

  const resolved: SpendingApprovalRequest = {
    ...target,
    status: params.decision,
    resolvedAt: new Date().toISOString(),
    resolvedBy: params.resolverName,
    resolvedByRole: params.resolverRole,
  };

  await prisma.activityEvent.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.resolverId,
      type: ACTIVITY_TYPE_RESOLVED,
      payload: { request: resolved } as any,
    },
  });

  return { success: true, request: resolved };
}

// Serialize decisions for the same ticket in this process AND across workers.
// The database advisory lock is transaction-scoped and does not require a
// schema migration. It closes the double-click/two-tab race even when the
// deployment has multiple Node workers, while the resolver still checks
// PENDING after acquiring the lock so the second call becomes NOT_FOUND after
// the first resolution commits.
const spendingApprovalResolutionLocks = new Map<string, Promise<unknown>>();

// Satu tiket punya DUA identifier valid (id ATAU ticketNumber -- lihat
// resolveSpendingApprovalRequestInternal di atas). Kalau lock key dibangun dari
// params.requestId mentah, dua caller konkuren yang kebetulan pakai identifier
// BEDA buat tiket yang SAMA dapat lock key berbeda dan gak saling serialize
// (DEEP-009: race kebuka lagi). Fix: samakan dulu ke id kanonik SEBELUM bikin
// lock key. Lookup ini murni baca properti yang immutable (id tiket gak pernah
// berubah), jadi aman dipanggil tanpa lock -- dua caller konkuren yang
// nge-resolve requestId yang sama akan selalu berakhir di id kanonik yang sama.
async function resolveCanonicalTicketId(workspaceId: string, requestId: string): Promise<string | null> {
  const pending = await getPendingSpendingApprovals(workspaceId);
  const match = pending.find((r) => r.id === requestId || r.ticketNumber === requestId);
  return match?.id ?? null;
}

export async function resolveSpendingApprovalRequest(
  params: Parameters<typeof resolveSpendingApprovalRequestInternal>[0]
): Promise<ResolveSpendingApprovalResult> {
  const canonicalId = await resolveCanonicalTicketId(params.workspaceId, params.requestId);
  const lockIdentifier = canonicalId ?? params.requestId;

  const key = `${params.workspaceId}:${lockIdentifier}`;
  const previous = spendingApprovalResolutionLocks.get(key);
  const current = (previous ? previous.catch(() => undefined) : Promise.resolve())
    .then(() => prisma.$transaction(async (tx) => {
      const lockKey = `klir:spending-approval:${params.workspaceId}:${lockIdentifier}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
      return resolveSpendingApprovalRequestInternal(params);
    }));
  spendingApprovalResolutionLocks.set(key, current);
  try {
    return await current as ResolveSpendingApprovalResult;
  } finally {
    if (spendingApprovalResolutionLocks.get(key) === current) {
      spendingApprovalResolutionLocks.delete(key);
    }
  }
}
