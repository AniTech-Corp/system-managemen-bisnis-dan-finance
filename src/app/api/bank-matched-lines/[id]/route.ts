import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserFromRequest } from '@/lib/auth';
import { recordCashTransaction } from '@/lib/accounting/posting';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action, cashTransactionId, notes, newTransaction } = body;

    const matchedLine = await prisma.bankMatchedLine.findUnique({
      where: { id },
      include: { statement: true, statementLine: true, cashTransaction: true },
    });

    if (!matchedLine) {
      return NextResponse.json({ error: 'Matched line not found' }, { status: 404 });
    }

    // Check workspace access
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: matchedLine.workspaceId, userId: authUser.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let updatedLine;

    switch (action) {
      case 'CONFIRM_MATCH':
        // Confirm an existing match
        if (!cashTransactionId) {
          return NextResponse.json({ error: 'cashTransactionId required for CONFIRM_MATCH' }, { status: 400 });
        }
        // Verify the cash transaction exists and belongs to the workspace
        const tx = await prisma.cashTransaction.findFirst({
          where: { id: cashTransactionId, workspaceId: matchedLine.workspaceId },
        });
        if (!tx) {
          return NextResponse.json({ error: 'Cash transaction not found' }, { status: 404 });
        }
        updatedLine = await prisma.bankMatchedLine.update({
          where: { id },
          data: {
            cashTransactionId,
            status: 'MANUAL_MATCHED',
            matchedBy: authUser.id,
            matchedAt: new Date(),
            notes,
          },
        });
        break;

      case 'CREATE_TRANSACTION':
        // Create a new cash transaction from the bank statement line
        if (!newTransaction) {
          return NextResponse.json({ error: 'newTransaction data required for CREATE_TRANSACTION' }, { status: 400 });
        }
        const { accountId, type, amount, description, reference, transactionDate, partnerId, category } = newTransaction;
        
        // Verify the account belongs to workspace
        const account = await prisma.account.findFirst({
          where: { id: accountId, workspaceId: matchedLine.workspaceId },
        });
        if (!account) {
          return NextResponse.json({ error: 'Account not found' }, { status: 404 });
        }

        // Create cash transaction using the accounting engine
        const result = await recordCashTransaction(prisma, {
          workspaceId: matchedLine.workspaceId,
          userId: authUser.id,
          type,
          category: category || 'GENERAL',
          amount,
          description: description || matchedLine.statementLine.description,
          paymentMethod: 'TRANSFER_BANK',
          transactionDate: transactionDate ? new Date(transactionDate) : matchedLine.statementLine.transactionDate,
          settlementAccountId: null,
        });

        updatedLine = await prisma.bankMatchedLine.update({
          where: { id },
          data: {
            cashTransactionId: (result as any).transaction.id,
            status: 'MANUAL_MATCHED',
            matchedBy: authUser.id,
            matchedAt: new Date(),
            notes,
          },
        });
        break;

      case 'IGNORE':
        // Mark as ignored (unmatched bank line)
        updatedLine = await prisma.bankMatchedLine.update({
          where: { id },
          data: {
            status: 'IGNORED',
            cashTransactionId: null,
            matchedBy: authUser.id,
            matchedAt: new Date(),
            notes,
          },
        });
        break;

      case 'DISPUTE':
        // Mark as disputed
        updatedLine = await prisma.bankMatchedLine.update({
          where: { id },
          data: {
            status: 'DISPUTED',
            matchedBy: authUser.id,
            matchedAt: new Date(),
            notes,
          },
        });
        break;

      case 'UNMATCH':
        // Remove the match, set back to unmatched
        updatedLine = await prisma.bankMatchedLine.update({
          where: { id },
          data: {
            status: 'UNMATCHED_BANK',
            cashTransactionId: null,
            matchedBy: authUser.id,
            matchedAt: new Date(),
            notes,
          },
        });
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ data: updatedLine });
  } catch (error) {
    console.error('Error updating matched line:', error);
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
    const matchedLine = await prisma.bankMatchedLine.findUnique({ where: { id } });

    if (!matchedLine) {
      return NextResponse.json({ error: 'Matched line not found' }, { status: 404 });
    }

    // Check workspace access
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: matchedLine.workspaceId, userId: authUser.id } },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.bankMatchedLine.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting matched line:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}