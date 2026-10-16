import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const userPayload = getUserFromRequest(req);
    if (!userPayload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { triggerSource, actionTarget, config } = await req.json();

    const workflow = await prisma.workflow.create({
      data: {
        workspaceId: userPayload.workspaceId,
        triggerSource,
        actionTarget,
        config: config || {},
      },
    });

    return NextResponse.json(workflow);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userPayload = getUserFromRequest(req);
    if (!userPayload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const workflows = await prisma.workflow.findMany({
      where: { workspaceId: userPayload.workspaceId },
      include: { logs: { orderBy: { createdAt: 'desc' } } },
    });

    return NextResponse.json(workflows);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
