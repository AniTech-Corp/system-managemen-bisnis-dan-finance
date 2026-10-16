import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const userPayload = getUserFromRequest(req);
    if (!userPayload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { corPlanProjectId, title, outputData, revisionSeq } = await req.json();

    const existing = await prisma.corPlanProject.findUnique({
      where: { id: corPlanProjectId },
    });

    if (!existing) {
      return NextResponse.json({ message: 'CorPlan project not found' }, { status: 404 });
    }

    if (revisionSeq <= existing.revisionSeq) {
      return NextResponse.json({
        message: 'Server has newer or equal revision',
        currentSeq: existing.revisionSeq,
      }, { status: 409 });
    }

    const updated = await prisma.corPlanProject.update({
      where: { id: corPlanProjectId },
      data: {
        title,
        revisionSeq,
        outputs: {
          create: { module: 'business_plan_sync', outputData },
        },
      },
      include: { outputs: true },
    });

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
