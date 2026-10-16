import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { corPlanProjectId, title, outputData, revisionSeq } = await req.json();

      if (!corPlanProjectId) {
        return NextResponse.json({ message: 'corPlanProjectId wajib disertakan.' }, { status: 400 });
      }

      const prismaAny = prisma as any;
      const existing = await prismaAny.corPlanProject?.findUnique({
        where: { id: corPlanProjectId },
      });

      if (!existing) {
        return NextResponse.json({ message: 'Proyek CorPlan tidak ditemukan.' }, { status: 404 });
      }

      // Pastikan proyek milik workspace aktif (Tenant Isolation)
      if (existing.workspaceId !== auth.workspace.id) {
        return NextResponse.json(
          { message: 'Isolasi Keamanan: Anda tidak memiliki akses ke proyek workspace lain.' },
          { status: 403 }
        );
      }

      // Hybrid Last-Write-Wins (LWW) Collision Check
      if (revisionSeq <= existing.revisionSeq) {
        return NextResponse.json(
          {
            message: 'Server memiliki revisi yang lebih baru atau setara.',
            currentSeq: existing.revisionSeq,
          },
          { status: 409 }
        );
      }

      const updated = await prismaAny.corPlanProject?.update({
        where: { id: corPlanProjectId },
        data: {
          title: title || existing.title,
          revisionSeq,
          outputs: {
            create: { module: 'business_plan_sync', outputData: outputData || {} },
          },
        },
        include: { outputs: true },
      });

      return NextResponse.json(updated);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal menyinkronkan CorPlan.') }, { status: 500 });
    }
  },
  { minRole: 'MEMBER' }
);
