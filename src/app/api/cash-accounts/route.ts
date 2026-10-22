import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
    const isActive = request.nextUrl.searchParams.get('isActive');

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID required' }, { status: 400 });
    }

    // Check workspace access
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: authUser.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: any = { workspaceId };
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }

    const accounts = await prisma.cashAccount.findMany({
      where,
      include: {
        account: { select: { id: true, code: true, name: true } },
      },
      orderBy: { code: 'asc' },
    });

    return NextResponse.json({
      data: accounts.map((acc) => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber,
        isActive: acc.isActive,
        coaAccount: acc.account,
      })),
    });
  } catch (error) {
    console.error('Error fetching cash accounts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}