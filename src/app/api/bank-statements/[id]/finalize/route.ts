import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';

export async function POST(
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
        cashAccount: true,
        lines: { include: { matchedLine: true } },
      },
    });

    if (!statement) {
      return NextResponse.json({ error: 'Bank statement not found' }, { status: 404 });
    }

    // Check workspace access and admin permissions
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: statement.workspaceId, userId: authUser.id } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Verify all lines are either matched or explicitly ignored
    const unmatchedLines = statement.lines.filter(
      (l) => !l.matchedLine || (l.matchedLine.status !== 'IGNORED' && l.matchedLine.status !== 'DISPUTED' && !l.matchedLine.cashTransactionId)
    );

    if (unmatchedLines.length > 0) {
      return NextResponse.json(
        { error: 'Cannot finalize: there are unmatched lines that need review', unmatchedCount: unmatchedLines.length },
        { status: 400 }
      );
    }

    // Calculate final bank balance
    let bankBalance = Number(statement.openingBalance);
    for (const line of statement.lines) {
      if (line.direction === 'MASUK') {
        bankBalance += Number(line.creditAmount || 0);
      } else {
        bankBalance -= Number(line.debitAmount || 0);
      }
    }

    // Update cash account with reconciliation info
    await prisma.cashAccount.update({
      where: { id: statement.cashAccountId },
      data: {
        lastReconciledAt: new Date(),
        lastReconciledBalance: bankBalance,
      },
    });

    // Update statement status to finalized (ARCHIVED)
    await prisma.bankStatement.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        reconciledAt: new Date(),
        notes: (statement.notes ? statement.notes + '\n' : '') + `Finalized by ${authUser.id} at ${new Date().toISOString()}. Bank balance: ${bankBalance}`,
      },
    });

    return NextResponse.json({
      data: {
        statementId: statement.id,
        finalBankBalance: bankBalance,
        finalizedAt: new Date(),
        finalizedBy: authUser.id,
      },
    });
  } catch (error) {
    console.error('Error finalizing bank statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}