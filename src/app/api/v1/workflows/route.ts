import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { triggerSource, actionTarget, config } = await req.json();

      if (!triggerSource || !actionTarget) {
        return NextResponse.json(
          { message: 'triggerSource dan actionTarget wajib disertakan.' },
          { status: 400 }
        );
      }

      const prismaAny = prisma as any;
      const workflow = await prismaAny.workflow?.create({
        data: {
          workspaceId: auth.workspace.id,
          triggerSource,
          actionTarget,
          config: config || {},
        },
      });

      return NextResponse.json(workflow);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Workflow gagal dibuat.') }, { status: 500 });
    }
  },
  { minRole: 'MANAGER' }
);

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const prismaAny = prisma as any;
      const workflows = await prismaAny.workflow?.findMany({
        where: { workspaceId: auth.workspace.id },
        include: { logs: { orderBy: { createdAt: 'desc' }, take: 10 } },
      }) || [];

      return NextResponse.json(workflows);
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat workflow.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
