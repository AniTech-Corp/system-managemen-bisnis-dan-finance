import { NextRequest, NextResponse } from 'next/server';
import { runGeneration, GenerationType } from '@/lib/generation-engine';
import { authenticateTenantRequest, extractTokenFromRequest } from '@/lib/tenant-guard';
import { MediaError } from '@/lib/media-errors';
import { mediaErrorResponse } from '@/lib/media-http';
import { publicApiError } from '@/lib/api-error';

const VALID_TYPES: GenerationType[] = ['word', 'excel', 'ppt', 'pdf', 'image', 'video-plan'];

/**
 * POST /api/v1/brain/generate
 * Body: { type: 'word'|'excel'|'ppt'|'pdf'|'image'|'video-plan', brief: string, workspaceId?: string, fileNameHint?: string, role?: string, templateId?: string, tone?: string }
 * Menghasilkan file nyata (base64) yang bisa langsung di-download frontend.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const type = body.type as GenerationType;
    const brief = (body.brief || '').trim();

    if (!VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, message: `Tipe generate tidak valid. Pilihan: ${VALID_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!brief) {
      return NextResponse.json(
        { success: false, message: 'Brief (deskripsi apa yang mau dibuat) wajib diisi.' },
        { status: 400 }
      );
    }

    // Paid image compatibility path uses the same session/workspace preflight as media routes.
    if (type === 'image') {
      const { withMediaGuard } = await import('@/lib/media-http');
      return withMediaGuard(async (_request, { auth }) => {
        const result = await runGeneration({ workspaceId: auth.workspace.id, type, brief, fileNameHint: body.fileNameHint, role: body.role, tone: body.tone });
        return NextResponse.json({ success: true, data: result }, { headers: { 'Cache-Control': 'no-store' } });
      })(req);
    }

    // SECURITY (Multi-Tenant Isolation): route ini tidak pernah didesain untuk lintas-workspace
    // (tidak ada requiredWorkspaceId) -- workspace SELALU di-resolve dari identitas pemanggil
    // via tenant-guard, BUKAN dari body/header/query yang dikontrol pemanggil.
    // SECURITY (Zero-Auth Bypass Guard): tanpa token sama sekali, tenant-guard akan fallback
    // ke user/workspace pertama di database (lihat tenant-guard.ts) -- ditolak di sini SEBELUM
    // masuk ke fallback itu, supaya request tanpa autentikasi tidak pernah dapat workspace siapapun.
    if (!extractTokenFromRequest(req)) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi diperlukan untuk membuat dokumen.' },
        { status: 401 }
      );
    }

    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }

    const result = await runGeneration({
      workspaceId: guard.auth.workspace.id,
      type,
      brief,
      fileNameHint: body.fileNameHint,
      role: body.role,
      templateId: body.templateId,
      tone: body.tone,
      effort: body.effort,
      model: body.model,
    });

    // Simpan dokumen hasil generate ke PostgreSQL (workspace_files) secara non-fatal
    if (result.fileBase64 && guard.auth.workspace.id) {
      try {
        const { prisma } = await import('@/lib/prisma');
        const fileBuffer = Buffer.from(result.fileBase64, 'base64');
        await prisma.workspaceFile.create({
          data: {
            workspaceId: guard.auth.workspace.id,
            uploadedBy: guard.auth.user.id,
            fileName: result.fileName,
            fileType: result.mimeType,
            sizeBytes: fileBuffer.length,
            storageBlob: fileBuffer,
            status: 'PROCESSED',
            extractedSummary: result.summary || `Dokumen ${result.fileName} di-generate oleh AI Brain`,
          },
        });
      } catch (saveErr) {
        console.warn('[BrainGenerate] Gagal menyimpan file ke workspace_files (non-fatal):', saveErr);
      }
    }

    try {
      const { recordActivity } = await import('@/lib/activity-log');
      void recordActivity(guard.auth.workspace.id, guard.auth.user.id, 'brain.generate_document', {
        type,
        fileName: result.fileName,
        mimeType: result.mimeType,
      });
    } catch (actErr) {
      console.warn('[BrainGenerate] Gagal mencatat activity (non-fatal):', actErr);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[BrainGenerate] error:', err);
    if (err instanceof MediaError) {
      return mediaErrorResponse(err);
    }
    return NextResponse.json(
      { success: false, message: publicApiError('Gagal melakukan generate.') },
      { status: 500 }
    );
  }
}
