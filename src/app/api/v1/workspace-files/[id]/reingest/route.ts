import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { runAutoIngest } from '@/lib/ai-brain/auto-ingest';
import { invalidateContextCache } from '@/lib/ai-brain/context-engine';
import { invalidateDashboardInsightCache } from '@/lib/ai-brain/dashboard-insight';

/**
 * POST /api/v1/workspace-files/[id]/reingest
 * Membaca file dari database dan mengeksekusi ulang pipeline auto-ingest deterministik.
 * Berguna saat tombol kontekstual ("Impor Kampanye Iklan", "Impor ke Katalog Menu") diklik
 * untuk file yang belum sempat ter-ingest otomatis.
 */
export const POST = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const { id } = await (params as Promise<{ id: string }>);
    if (!id) {
      return NextResponse.json({ message: 'ID file wajib diisi.' }, { status: 400 });
    }

    const file = await prisma.workspaceFile.findFirst({
      where: { id, workspaceId: auth.workspace.id },
      select: {
        id: true,
        fileName: true,
        storageBlob: true,
        extractedSummary: true,
        linkedRecordIds: true,
      },
    });

    if (!file) {
      return NextResponse.json({ message: 'File tidak ditemukan di workspace ini.' }, { status: 404 });
    }

    if (!file.storageBlob) {
      return NextResponse.json({ message: 'Konten biner file tidak tersedia untuk diimpor ulang.' }, { status: 422 });
    }

    const summary = await runAutoIngest({
      workspaceId: auth.workspace.id,
      userId: auth.user.id,
      fileId: file.id,
      fileName: file.fileName,
      buffer: Buffer.from(file.storageBlob),
      extractedText: file.extractedSummary || '',
    });

    if (summary.kind !== 'gagal' && summary.kind !== 'tidak-ada') {
      invalidateContextCache(auth.workspace.id);
      void invalidateDashboardInsightCache(auth.workspace.id);
    }

    return NextResponse.json({
      success: summary.kind !== 'gagal' && summary.kind !== 'tidak-ada',
      ingest: summary,
      message: summary.label,
    });
  },
  { minRole: 'MEMBER' }
);
