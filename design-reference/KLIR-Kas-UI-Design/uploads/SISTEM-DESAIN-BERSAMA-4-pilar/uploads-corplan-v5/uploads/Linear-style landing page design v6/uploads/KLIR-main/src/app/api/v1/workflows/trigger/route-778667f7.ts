import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const userPayload = getUserFromRequest(req);
    if (!userPayload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { triggerSource, payload } = await req.json();

    const activeWorkflows = await prisma.workflow.findMany({
      where: {
        workspaceId: userPayload.workspaceId,
        triggerSource,
        status: 'ACTIVE',
      },
    });

    const executions = [];

    for (const wf of activeWorkflows) {
      const actionResult = {
        actionTarget: wf.actionTarget,
        status: 'SUCCESS',
        actionOutput: `Eksekusi otomatis '${wf.actionTarget}' berhasil dipicu dari event '${triggerSource}'`,
        executedAt: new Date().toISOString(),
      };

      const log = await prisma.workflowLog.create({
        data: {
          workflowId: wf.id,
          status: 'SUCCESS',
          payload: { triggerSource, triggerPayload: payload || {}, result: actionResult },
        },
      });

      executions.push({ workflowId: wf.id, logId: log.id, actionTarget: wf.actionTarget });
    }

    return NextResponse.json({ triggeredCount: executions.length, executions });
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
