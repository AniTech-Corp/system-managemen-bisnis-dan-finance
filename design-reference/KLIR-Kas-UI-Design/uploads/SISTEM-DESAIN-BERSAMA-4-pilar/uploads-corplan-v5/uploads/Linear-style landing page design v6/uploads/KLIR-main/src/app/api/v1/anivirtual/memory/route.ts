import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { MemoryScope } from '@prisma/client';

export async function POST(req: NextRequest) {
  try {
    const userPayload = getUserFromRequest(req);
    if (!userPayload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { content, scope } = await req.json();

    const memory = await prisma.memoryItem.create({
      data: {
        workspaceId: userPayload.workspaceId,
        userId: scope === 'PERSONAL' ? userPayload.userId : null,
        scope: scope === 'WORKSPACE' ? MemoryScope.WORKSPACE : MemoryScope.PERSONAL,
        content,
      },
    });

    return NextResponse.json(memory);
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

    const memories = await prisma.memoryItem.findMany({
      where: {
        workspaceId: userPayload.workspaceId,
        OR: [
          { scope: MemoryScope.WORKSPACE },
          { scope: MemoryScope.PERSONAL, userId: userPayload.userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(memories);
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
