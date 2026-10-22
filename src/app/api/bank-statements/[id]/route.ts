import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const statement = await prisma.bankStatement.findUnique({
      where: { id },
      include: {
        cashAccount: { select: { id: true, code: true, name: true, bankName: true, accountNumber: true } },
        lines: {
          include: {
            matchedLine: {
              include: {
                cashTransaction: {
                  select: { id: true, transactionDate: true, description: true, amount: true, type: true, category: true },
                },
              },
            },
          },
          orderBy: { transactionDate: 'asc' },
        },
        matchedLines: {
          include: {
            cashTransaction: {
              select: { id: true, transactionDate: true, description: true, amount: true, type: true, category: true },
            },
            matchedByUser: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
    });

    if (!statement) {
      return NextResponse.json({ error: 'Bank statement not found' }, { status: 404 });
    }

    // Check workspace access
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: statement.workspaceId, userId: authUser.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: statement });
  } catch (error) {
    console.error('Error fetching bank statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const statement = await prisma.bankStatement.findUnique({ where: { id } });

    if (!statement) {
      return NextResponse.json({ error: 'Bank statement not found' }, { status: 404 });
    }

    // Check workspace access and permissions
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: statement.workspaceId, userId: authUser.id } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only allow deletion if not reconciled
    if (statement.status === 'RECONCILED') {
      return NextResponse.json({ error: 'Cannot delete reconciled statement' }, { status: 400 });
    }

    await prisma.bankStatement.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bank statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}