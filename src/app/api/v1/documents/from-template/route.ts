import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { runGeneration, GenerationType } from '@/lib/generation-engine';
import { authenticateTenantRequest, extractTokenFromRequest } from '@/lib/tenant-guard';
import { listDocTemplates, resolveDocTemplate, buildTemplatedBrief } from '@/lib/doc-templates';
import { recordActivity } from '@/lib/activity-log';
import { MediaError } from '@/lib/media-errors';
import { mediaErrorResponse } from '@/lib/media-http';

/**
 * GET /api/v1/documents/from-template
 * Query opsional: ?outputType=word|excel|ppt|video-plan
 * Mengembalikan daftar template dokumen (laporan keuangan, invoice/surat niaga, presentasi,
 * brief video) yang bisa dipilih pengguna sebelum generate -- dipakai UI untuk dropdown
 * pemilihan template.
 *
 * POST /api/v1/documents/from-template
 * Body: { templateId: string, brief: string, fileNameHint?: string, tone?: string, role?: string }
 * Memperkaya brief pengguna dengan struktur template yang dipilih (buildTemplatedBrief),
 * lalu memanggil runGeneration milik Fatur (generation-engine.ts, TIDAK diubah) dengan
 * `type` yang diambil dari outputType template itu sendiri -- bukan dari input pengguna --
 * supaya pengguna tidak bisa memaksa kombinasi template/tipe yang tidak cocok.
 *
 * Guard: meniru persis pola src/app/api/v1/brain/generate/route.ts (route generate dokumen
 * lain milik Fatur yang sudah ada) -- token wajib ada SEBELUM masuk tenant-guard, supaya
 * request tanpa autentikasi tidak pernah jatuh ke fallback user/workspace pertama di
 * database (lihat komentar SECURITY di authenticateTenantRequest, tenant-guard.ts).
 * Tidak ada template di sini yang outputType-nya 'image', jadi tidak perlu cabang
 * withMediaGuard/kredit seperti route brain/generate -- generate dari template ini tidak
 * memotong kredit, sama seperti generate word/excel/ppt/video-plan biasa via brain/generate.
 */

const VALID_OUTPUT_TYPES: GenerationType[] = ['word', 'excel', 'ppt', 'pdf', 'image', 'video-plan'];

export async function GET(req: NextRequest) {
  try {
    if (!extractTokenFromRequest(req)) {
      return NextResponse.json(
        { success: false, message: 'Autentikasi diperlukan untuk melihat daftar template dokumen.' },
        { status: 401 }
      );
    }
    const guard = await authenticateTenantRequest(req, {});
    if (guard.errorResponse) {
      return guard.errorResponse;
    }

    const { searchParams } = req.nextUrl;
    const outputTypeParam = searchParams.get('outputType');
    const filter =
      outputTypeParam && VALID_OUTPUT_TYPES.includes(outputTypeParam as GenerationType)
        ? { outputType: outputTypeParam as GenerationType }
        : undefined;

    const templates = listDocTemplates(filter);
    return NextResponse.json({ success: true, data: templates });
  } catch (err: any) {
    console.error('[DocumentsFromTemplate][GET] error:', err);
    return NextResponse.json(
      { success: false, message: publicApiError('Gagal mengambil daftar template dokumen.') },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const templateId = String(body.templateId || '').trim();
    const brief = String(body.brief || '').trim();

    if (!templateId) {
      return NextResponse.json(
        {
          success: false,
          message: 'templateId wajib diisi. Lihat daftar template lewat GET /api/v1/documents/from-template.',
        },
        { status: 400 }
      );
    }
    if (!brief) {
      return NextResponse.json(
        { success: false, message: 'Brief (deskripsi apa yang mau dibuat) wajib diisi.' },
        { status: 400 }
      );
    }

    const template = resolveDocTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        {
          success: false,
          message: `Template dengan id "${templateId}" tidak ditemukan. Lihat daftar template lewat GET /api/v1/documents/from-template.`,
        },
        { status: 404 }
      );
    }

    // SECURITY (Multi-Tenant Isolation & Zero-Auth Bypass Guard): pola identik dengan
    // src/app/api/v1/brain/generate/route.ts -- workspace SELALU di-resolve dari identitas
    // pemanggil via tenant-guard, dan token wajib ada sebelum masuk ke tenant-guard supaya
    // request tanpa autentikasi tidak pernah dapat workspace siapapun dari fallback.
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

    const enrichedBrief = buildTemplatedBrief(template.id, brief);

    const result = await runGeneration({
      workspaceId: guard.auth.workspace.id,
      type: template.outputType,
      brief: enrichedBrief,
      fileNameHint: body.fileNameHint,
      role: body.role,
      tone: body.tone,
      templateId: template.id,
    });

    // Non-fatally persist generated template document to WorkspaceFile for PostgreSQL permanence
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
            extractedSummary: result.summary || `Dokumen template ${template.label}`,
          },
        });
      } catch (saveErr) {
        console.warn('[DocumentsFromTemplate] Gagal menyimpan file ke workspace_files (non-fatal):', saveErr);
      }
    }

    void recordActivity(guard.auth.workspace.id, guard.auth.user.id, 'documents.from_template_generate', { templateId: template.id });

    return NextResponse.json({
      success: true,
      data: { ...result, templateId: template.id, templateLabel: template.label },
    });
  } catch (err: any) {
    console.error('[DocumentsFromTemplate][POST] error:', err);
    if (err instanceof MediaError) {
      return mediaErrorResponse(err);
    }
    return NextResponse.json(
      { success: false, message: publicApiError('Gagal membuat dokumen dari template.') },
      { status: 500 }
    );
  }
}
