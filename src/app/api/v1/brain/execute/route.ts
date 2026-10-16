import { NextRequest, NextResponse } from 'next/server';
import { ExecutionEngine } from '@/lib/ai-brain';
import { authenticateTenantRequest, extractTokenFromRequest } from '@/lib/tenant-guard';

export async function POST(req: NextRequest) {
  try {
    // SECURITY (route-level, does NOT modify tenant-guard.ts): authenticateTenantRequest()
    // has a known, separately-tracked design gap where a MISSING token makes
    // `isOwner` default to true (`!token` branch, tenant-guard.ts baris 176) -- an
    // anonymous caller would otherwise be treated as OWNER of whatever workspace it
    // resolves to. That gap needs a Fatur/Mecca decision and is out of scope here.
    // This route writes a real promoCoupon to the database (SCALE_MARKETING), so it
    // cannot rely on that fallback: a token MUST be present before we even ask the
    // tenant guard to resolve a workspace/role.
    if (!extractTokenFromRequest(req)) {
      return NextResponse.json(
        { code: 'AUTH_REQUIRED', message: 'Silakan masuk ke KLIR terlebih dahulu.' },
        { status: 401 }
      );
    }

    // SECURITY (Multi-Tenant Isolation + RBAC): route ini mengeksekusi aksi bisnis nyata
    // (mis. SCALE_MARKETING menulis promoCoupon ke database), jadi minimum role dinaikkan
    // ke MANAGER -- default sementara, butuh konfirmasi Fatur/Mecca soal role yang benar.
    const guard = await authenticateTenantRequest(req, { minRole: 'MANAGER' });
    if (guard.errorResponse) {
      return guard.errorResponse;
    }

    const body = await req.json();
    const { recommendationId, actionType, userNotes } = body;
    const idempotencyKey = req.headers.get('idempotency-key');

    if (!recommendationId || !actionType) {
      return NextResponse.json(
        { message: 'recommendationId dan actionType wajib disertakan.' },
        { status: 400 }
      );
    }
    if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 200) {
      return NextResponse.json(
        { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key wajib dikirim untuk aksi yang menulis data.' },
        { status: 400 }
      );
    }

    const result = await ExecutionEngine.executeAction({
      workspaceId: guard.auth.workspace.id,
      recommendationId,
      actionType,
      // Atribusi approval WAJIB dari identitas pemanggil yang tervalidasi tenant guard --
      // tidak lagi menerima approvedBy dari body (bisa dipalsukan pemanggil) atau
      // fallback hardcode 'CEO / Business Owner' yang menyamarkan identitas asli.
      approvedBy: guard.auth.user.fullName,
      userNotes,
      idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('Execution Layer API error:', err);
    // FIX (7 Sep 2026): err.message dulu ikut dikirim ke browser -- bisa bocorin nama
    // tabel/kolom Prisma atau path internal ke user biasa. Detail tetap ke log server.
    return NextResponse.json(
      { message: 'Gagal mengeksekusi rekomendasi. Coba lagi beberapa saat, atau hubungi admin workspace.' },
      { status: 500 }
    );
  }
}
