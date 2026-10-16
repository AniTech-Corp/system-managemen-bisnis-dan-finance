import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { MemoryScope } from '@prisma/client';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { corPlanProjectId, includeFinancialSummary = false } = await req.json();

      let project: any;
      const prismaAny = prisma as any;
      if (corPlanProjectId) {
        project = await prismaAny.corPlanProject?.findFirst({
          where: { id: corPlanProjectId, workspaceId: auth.workspace.id },
          include: { outputs: true },
        });
      } else {
        project = await prismaAny.corPlanProject?.findFirst({
          where: { workspaceId: auth.workspace.id },
          include: { outputs: true },
          orderBy: { createdAt: 'desc' },
        });
      }

      if (!project) {
        return NextResponse.json({ message: 'Proyek CorPlan tidak ditemukan untuk dibagikan.' }, { status: 404 });
      }

      // Susun ringkasan konteks bisnis aman tanpa membocorkan strategi rahasia / detail laba bersih
      const outputBab1 = project.outputs?.[0]?.outputData?.bab1_eksekutif_summary || 'Bisnis terstandarisasi komersial.';
      const outputBab2 = project.outputs?.[0]?.outputData?.bab2_analisis_pasar || 'Target segmen profesional dan pasar aktif.';
      const outputBab5 = project.outputs?.[0]?.outputData?.bab5_rencana_keuangan;

      const contextSummary = `[Konteks Usaha CorPlan — ${project.title}]:\n${outputBab1}\nSasaran Pasar: ${outputBab2}${
        includeFinancialSummary && outputBab5 ? `\nRingkasan Keuangan: ${outputBab5}` : ''
      }`;

      // Simpan langsung ke MemoryItem Workspace agar AniVirtual otomatis mengenali konteks
      const memory = await prisma.memoryItem.create({
        data: {
          workspaceId: auth.workspace.id,
          userId: auth.user.id,
          scope: MemoryScope.WORKSPACE,
          content: contextSummary,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Konteks bisnis '${project.title}' berhasil dibagikan ke AniVirtual Memory!`,
        memoryId: memory.id,
        contextSummary,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal membagikan konteks CorPlan.') }, { status: 500 });
    }
  },
  { minRole: 'MEMBER' }
);
