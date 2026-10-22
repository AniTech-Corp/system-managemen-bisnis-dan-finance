import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reconcileBankStatement, BankMutationInput, CashTransactionInput } from '@/lib/ai-brain/bank-reconciliation';
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
        lines: { where: { isValid: true }, orderBy: { transactionDate: 'asc' } },
        cashAccount: true,
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

    // Get cash transactions for this workspace within the statement period
    const cashTransactions = await prisma.cashTransaction.findMany({
      where: {
        workspaceId: statement.workspaceId,
        transactionDate: {
          gte: statement.startDate,
          lte: statement.endDate,
        },
      },
      orderBy: { transactionDate: 'asc' },
    });

    // Update status to RECONCILING
    await prisma.bankStatement.update({
      where: { id },
      data: { status: 'RECONCILING' },
    });

    // Prepare bank mutations for reconciliation engine
    const bankMutations: BankMutationInput[] = statement.lines.map((line) => ({
      rowNo: line.rowNumber,
      dateRaw: line.transactionDate,
      description: line.description,
      amount: line.direction === 'MASUK' ? Number(line.creditAmount || 0) : -Number(line.debitAmount || 0),
    }));

    // Prepare cash transactions for reconciliation engine
    const cashTxInputs: CashTransactionInput[] = cashTransactions.map((tx) => ({
      id: tx.id,
      transactionDate: tx.transactionDate,
      type: tx.type,
      amount: Number(tx.amount),
      description: tx.description,
      category: tx.category,
    }));

    // Run the reconciliation engine
    const result = reconcileBankStatement(bankMutations, cashTxInputs);

    // Save matches to database
    const matchedLinesData = result.cocok.map((match) => {
      const line = statement.lines.find(l => l.rowNumber === match.bankMutation.rowNo);
      if (!line) return null;
      return {
        workspaceId: statement.workspaceId,
        statementId: statement.id,
        statementLineId: line.id,
        cashTransactionId: match.cashTransaction.id,
        status: 'AUTO_MATCHED' as const,
        matchScore: 1 - (match.amountDiff / Math.max(Math.abs(match.bankMutation.amount), Math.abs(match.cashTransaction.amount))) || 1,
        dateDiffDays: match.dateDiffDays,
        amountDiff: match.amountDiff,
        matchedBy: authUser.id,
        matchedAt: new Date(),
      };
    }).filter(Boolean);

    // Also add unmatched bank lines as UNMATCHED_BANK
    const unmatchedBankLines = result.adaDiBankTidakDiCatatan.map((unmatched) => {
      const line = statement.lines.find(l => l.rowNumber === unmatched.bankMutation.rowNo);
      return line ? {
        workspaceId: statement.workspaceId,
        statementId: statement.id,
        statementLineId: line.id,
        cashTransactionId: null,
        status: 'UNMATCHED_BANK' as const,
        matchScore: null,
        dateDiffDays: null,
        amountDiff: null,
        matchedBy: authUser.id,
        matchedAt: new Date(),
      } : null;
    }).filter(Boolean);

    // Also add unmatched cash lines as UNMATCHED_CASH
    // For these, we need to create a dummy statement line or handle differently
    // Since BankMatchedLine requires statementLineId to be unique, we'll skip these for now
    // and they can be handled in the UI

    // Delete existing matches for this statement
    await prisma.bankMatchedLine.deleteMany({ where: { statementId: statement.id } });

    // Create new matches
    await prisma.bankMatchedLine.createMany({ data: [...matchedLinesData, ...unmatchedBankLines] as any });

    // Update statement status
    await prisma.bankStatement.update({
      where: { id },
      data: {
        status: 'RECONCILED',
        reconciledAt: new Date(),
      },
    });

    // Return summary
    return NextResponse.json({
      data: {
        statementId: statement.id,
        totalBankLines: statement.lines.length,
        totalCashTransactions: cashTransactions.length,
        matched: result.cocok.length,
        unmatchedBankLines: result.adaDiBankTidakDiCatatan.length,
        unmatchedCashTransactions: result.adaDiCatatanTidakDiBank.length,
        invalidRows: result.invalidBankRows.length,
      },
    });
  } catch (error) {
    console.error('Error reconciling bank statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}