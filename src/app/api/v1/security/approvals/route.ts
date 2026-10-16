import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingApprovals,
  createApprovalRequest,
  resolveApprovalRequest,
  HighRiskActionType,
} from '@/lib/security-guardrail';
// Guard tenant dikembalikan (M-temuan audit keamanan 6 Sep) -- ketiga handler di
// berkas ini sebelumnya polos (GET/POST/PATCH terbukti bisa dipanggil tanpa
// login di produksi). Pola withTenantGuard + minRole ditiru dari
// src/app/api/v1/documents/analyze/route.ts (POST, baris 209 & 328) dan
// src/app/api/v1/subscription/upgrade/route.ts (minRole OWNER, baris 96).
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';

/**
 * GET /api/v1/security/approvals
 * Returns pending approval requests for the workspace.
 * workspaceId diambil dari hasil autentikasi (auth.workspace.id), bukan lagi
 * dari query param mentah + fallback "workspace terbaru di seluruh DB" --
 * fallback lama itu sendiri lubang lintas-tenant (bisa nebak workspace lain).
 */
export const GET = withTenantGuard(async (req: NextRequest, { auth }) => {
  try {
    const pendingApprovals = await getPendingApprovals(auth.workspace.id);

    return NextResponse.json({
      success: true,
      data: pendingApprovals,
    });
  } catch (error: any) {
    console.error('[SecurityApprovals API] GET Error:', error);
    return NextResponse.json(
      { success: false, message: publicApiError('Gagal memuat tiket otorisasi') },
      { status: 500 }
    );
  }
}, { minRole: 'VIEWER' });

/**
 * POST /api/v1/security/approvals
 * Creates a new pending approval ticket.
 * workspaceId diambil dari auth.workspace.id (hasil autentikasi), bukan dari
 * body permintaan -- sebelumnya penyerang bisa kirim workspaceId workspace
 * ORANG LAIN dan membuat tiket persetujuan di sana.
 */
export const POST = withTenantGuard(async (req: NextRequest, { auth }) => {
  try {
    const body = await req.json().catch(() => ({}));
    const rawActionType = typeof body.actionType === 'string' ? body.actionType : 'PURGE_FINANCE';
    const originalPrompt = body.originalPrompt;
    const allowedActionTypes: HighRiskActionType[] = ['PURGE_FINANCE', 'PURGE_CASH', 'PURGE_INVOICES', 'DELETE_PROFILE', 'PURGE_CAMPAIGNS'];
    if (!allowedActionTypes.includes(rawActionType as HighRiskActionType)) {
      return NextResponse.json({ success: false, message: 'Jenis tindakan approval tidak diizinkan.' }, { status: 400 });
    }
    const actionType = rawActionType as HighRiskActionType;

    const canonicalDetails: Record<HighRiskActionType, { title: string; description: string }> = {
      PURGE_FINANCE: { title: 'Hapus & Reset Seluruh Data Keuangan', description: 'Menghapus transaksi kas dan invoice workspace setelah persetujuan Owner.' },
      PURGE_CASH: { title: 'Hapus Seluruh Transaksi Kas', description: 'Menghapus seluruh transaksi kas workspace setelah persetujuan Owner.' },
      PURGE_INVOICES: { title: 'Hapus Seluruh Invoice', description: 'Menghapus seluruh invoice workspace setelah persetujuan Owner.' },
      DELETE_PROFILE: { title: 'Hapus Profil Usaha & Memori', description: 'Menghapus profil usaha dan memori perusahaan setelah persetujuan Owner.' },
      PURGE_CAMPAIGNS: { title: 'Hapus Kampanye', description: 'Menghapus data kampanye setelah persetujuan Owner.' },
    };
    const details = canonicalDetails[actionType];

    const request = await createApprovalRequest({
      workspaceId: auth.workspace.id,
      requesterRole: auth.membership.role,
      requesterName: auth.user.fullName || auth.user.email,
      actionType,
      title: details.title,
      description: details.description,
      originalPrompt: typeof originalPrompt === 'string' ? originalPrompt.slice(0, 4000) : '',
    });

    return NextResponse.json({
      success: true,
      data: request,
    });
  } catch (error: any) {
    console.error('[SecurityApprovals API] POST Error:', error);
    return NextResponse.json(
      { success: false, message: publicApiError('Gagal membuat tiket otorisasi') },
      { status: 500 }
    );
  }
}, { minRole: 'MEMBER' });

/**
 * PATCH /api/v1/security/approvals
 * Resolves (Approves or Rejects) a pending approval request.
 * Ini titik paling berbahaya di berkas ini: kalau decision = APPROVED,
 * resolveApprovalRequest() LANGSUNG mengeksekusi purge data (hapus transaksi/
 * invoice) di database -- lihat src/lib/security-guardrail.ts. Tanpa guard,
 * request POST + PATCH bisa dirangkai tanpa login untuk bikin lalu menyetujui
 * tiket sendiri dan menghapus data. minRole OWNER dipasang (bukan MEMBER
 * seperti GET/POST) karena UI-nya sendiri ('CEO / Owner' portal, lihat
 * CEOApprovalModal) memang mensyaratkan Owner yang menyetujui -- deskripsi
 * tiket juga eksplisit bilang "memerlukan persetujuan dari Owner/CEO".
 * workspaceId & resolvedBy diambil dari auth (bukan body) -- sebelumnya body
 * bisa kirim resolvedBy: 'Owner / CEO' meski penyetujunya bukan Owner beneran
 * (CEOApprovalModal.tsx hardcode string itu di client, gampang dipalsukan
 * lewat curl/devtools tanpa guard ini).
 */
export const PATCH = withTenantGuard(async (req: NextRequest, { auth }) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { requestId, decision } = body;

    if (!requestId) {
      return NextResponse.json(
        { success: false, message: 'Parameter requestId diperlukan' },
        { status: 400 }
      );
    }

    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return NextResponse.json(
        { success: false, message: 'Decision harus APPROVED atau REJECTED' },
        { status: 400 }
      );
    }

    const result = await resolveApprovalRequest({
      requestId,
      workspaceId: auth.workspace.id,
      decision,
      resolvedBy: auth.user.fullName || auth.user.email,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: 'Tiket otorisasi tidak ditemukan atau sudah diselesaikan' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.request,
      executionResult: result.executionResult,
    });
  } catch (error: any) {
    console.error('[SecurityApprovals API] PATCH Error:', error);
    return NextResponse.json(
      { success: false, message: publicApiError('Gagal memproses keputusan otorisasi') },
      { status: 500 }
    );
  }
}, { minRole: 'OWNER' });
