import { NextRequest, NextResponse } from 'next/server';
import { withTenantGuard } from '@/lib/tenant-guard';
import {
  getPendingSpendingApprovals,
  resolveSpendingApprovalRequest,
} from '@/lib/ai-brain/spending-approval-guardrail';
import { publicApiError } from '@/lib/api-error';

// Persetujuan pengeluaran berjenjang (9 Sep 2026, BUILD_PLAN item approval-berjenjang).
// Pola withTenantGuard + minRole ditiru dari src/app/api/v1/security/approvals/route.ts
// (GET/POST/PATCH tiga method berbeda di sana; di sini cuma 2 method sesuai scope tugas:
// GET list + POST resolve). Pembuatan tiket (createSpendingApprovalRequest) belum
// disambungkan ke endpoint HTTP manapun -- itu tanggung jawab endpoint yang benar-benar
// membuat PurchaseOrder, di luar berkas yang boleh disentuh sesi ini. Lihat komentar
// pembuka src/lib/ai-brain/spending-approval-guardrail.ts.

// GET /api/v1/purchasing/approvals -- daftar tiket approval pengeluaran/PO yang PENDING
// milik workspace ini. workspaceId dari auth.workspace.id (hasil tenant guard), bukan
// dari query param mentah -- konsisten pola security/approvals/route.ts.
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const pending = await getPendingSpendingApprovals(auth.workspace.id);
      return NextResponse.json({ success: true, data: pending });
    } catch (error: any) {
      console.error('[PurchasingApprovals API] GET Error:', error);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal memuat tiket approval pengeluaran.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'VIEWER' }
);

// POST /api/v1/purchasing/approvals -- menyetujui atau menolak satu tiket approval.
// Cek role DUA LAPIS:
// 1. Di sini (guard options minRole: 'MANAGER') -- lantai bawah, tolak MEMBER/VIEWER
//    lebih awal tanpa perlu query database dulu.
// 2. Di dalam resolveSpendingApprovalRequest() -- per-tiket, terhadap requiredMinRole
//    tiket yang bersangkutan (tiket >=Rp20jt butuh ADMIN; MANAGER lolos lapis 1 di sini
//    tapi ditolak 403 di lapis 2 kalau coba approve tiket ADMIN-tier).
// resolverId/resolverName/resolverRole SEMUA diambil dari auth (bukan dari body) --
// supaya body tidak bisa memalsukan siapa yang menyetujui atau role-nya.
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const { requestId, decision } = body;

      if (!requestId || typeof requestId !== 'string') {
        return NextResponse.json(
          { success: false, message: 'Parameter requestId wajib diisi.' },
          { status: 400 }
        );
      }
      if (decision !== 'APPROVED' && decision !== 'REJECTED') {
        return NextResponse.json(
          { success: false, message: 'Parameter decision harus APPROVED atau REJECTED.' },
          { status: 400 }
        );
      }

      const result = await resolveSpendingApprovalRequest({
        requestId,
        workspaceId: auth.workspace.id,
        decision,
        resolverId: auth.user.id,
        resolverName: auth.user.fullName || auth.user.email,
        resolverRole: auth.membership.role,
      });

      if (!result.success) {
        const status = result.code === 'NOT_FOUND' ? 404 : 403;
        return NextResponse.json({ success: false, message: result.message }, { status });
      }

      return NextResponse.json({ success: true, data: result.request });
    } catch (error: any) {
      console.error('[PurchasingApprovals API] POST Error:', error);
      return NextResponse.json(
        { success: false, message: publicApiError('Gagal memproses keputusan approval pengeluaran.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'MANAGER' }
);
