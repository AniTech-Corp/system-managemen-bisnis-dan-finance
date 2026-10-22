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
        cashAccount: { select: { id: true, code: true, name: true, bankName: true, accountNumber: true, lastReconciledBalance: true, lastReconciledAt: true } },
        lines: {
          include: {
            matchedLine: {
              include: {
                cashTransaction: { select: { id: true, transactionDate: true, description: true, amount: true, type: true } },
              },
            },
          },
          orderBy: { transactionDate: 'asc' },
        },
        matchedLines: {
          include: {
            cashTransaction: { select: { id: true, transactionDate: true, description: true, amount: true, type: true } },
            matchedByUser: { select: { id: true, fullName: true } },
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

    // Calculate bank balance from statement lines
    let bankBalance = Number(statement.openingBalance);
    for (const line of statement.lines) {
      if (line.direction === 'MASUK') {
        bankBalance += Number(line.creditAmount || 0);
      } else {
        bankBalance -= Number(line.debitAmount || 0);
      }
    }

    // Calculate book balance from matched cash transactions
    let bookBalance = Number(statement.cashAccount.lastReconciledBalance || 0);
    const matchedCashTransactions = statement.matchedLines
      .filter((ml) => ml.cashTransactionId && ml.status !== 'IGNORED' && ml.status !== 'DISPUTED')
      .map((ml) => ml.cashTransaction!);

    for (const tx of matchedCashTransactions) {
      if (tx.type === 'INCOME') {
        bookBalance += Number(tx.amount);
      } else {
        bookBalance -= Number(tx.amount);
      }
    }

    // Categorize lines
    const matchedLines = statement.lines.filter((l) => l.matchedLine && l.matchedLine.status !== 'IGNORED' && l.matchedLine.status !== 'DISPUTED');
    const unmatchedBankLines = statement.lines.filter((l) => !l.matchedLine || l.matchedLine.status === 'UNMATCHED_BANK' || l.matchedLine.status === 'IGNORED');
    const unmatchedCashLines = statement.matchedLines
      .filter((ml) => !ml.cashTransactionId || ml.status === 'UNMATCHED_CASH')
      .map((ml) => ml.cashTransaction)
      .filter(Boolean);

    // Admin fee detection: small amounts that appear only in bank
    const potentialFees = unmatchedBankLines.filter(
      (l) => l.direction === 'KELUAR' && Number(l.debitAmount || 0) < 50000 && l.description.toLowerCase().includes('admin')
    );

    // Duplicate detection: same amount, same date, similar description
    const duplicates: Array<{ line: typeof statement.lines[0]; matches: typeof statement.lines }> = [];
    for (const line of unmatchedBankLines) {
      const dupes = unmatchedBankLines.filter(
        (l) => l.id !== line.id && l.transactionDate.getTime() === line.transactionDate.getTime() && Number(l.debitAmount || 0) === Number(line.debitAmount || 0) && Number(l.creditAmount || 0) === Number(line.creditAmount || 0)
      );
      if (dupes.length > 0) {
        duplicates.push({ line, matches: dupes });
      }
    }

    const report = {
      statement: {
        id: statement.id,
        fileName: statement.fileName,
        statementDate: statement.statementDate,
        startDate: statement.startDate,
        endDate: statement.endDate,
        status: statement.status,
        cashAccount: statement.cashAccount,
      },
      balances: {
        bankOpeningBalance: Number(statement.openingBalance),
        bankClosingBalance: Number(statement.closingBalance),
        calculatedBankBalance: bankBalance,
        bookOpeningBalance: Number(statement.cashAccount.lastReconciledBalance || 0),
        calculatedBookBalance: bookBalance,
        difference: bankBalance - bookBalance,
      },
      summary: {
        totalBankLines: statement.lines.length,
        matchedLines: matchedLines.length,
        unmatchedBankLines: unmatchedBankLines.length,
        unmatchedCashLines: unmatchedCashLines.length,
        autoMatched: statement.matchedLines.filter((ml) => ml.status === 'AUTO_MATCHED').length,
        manualMatched: statement.matchedLines.filter((ml) => ml.status === 'MANUAL_MATCHED').length,
        ignored: statement.matchedLines.filter((ml) => ml.status === 'IGNORED').length,
        disputed: statement.matchedLines.filter((ml) => ml.status === 'DISPUTED').length,
      },
      details: {
        matchedLines: matchedLines.map((l) => ({
          id: l.id,
          rowNumber: l.rowNumber,
          date: l.transactionDate,
          description: l.description,
          direction: l.direction,
          amount: l.direction === 'MASUK' ? Number(l.creditAmount) : Number(l.debitAmount),
          balance: l.balance !== null ? Number(l.balance) : null,
          matchedTransaction: l.matchedLine?.cashTransaction
            ? {
                id: l.matchedLine.cashTransaction.id,
                date: l.matchedLine.cashTransaction.transactionDate,
                description: l.matchedLine.cashTransaction.description,
                amount: Number(l.matchedLine.cashTransaction.amount),
                type: l.matchedLine.cashTransaction.type,
              }
            : null,
          matchStatus: l.matchedLine?.status,
          matchScore: l.matchedLine?.matchScore,
        })),
        unmatchedBankLines: unmatchedBankLines.map((l) => ({
          id: l.id,
          rowNumber: l.rowNumber,
          date: l.transactionDate,
          description: l.description,
          direction: l.direction,
          amount: l.direction === 'MASUK' ? Number(l.creditAmount) : Number(l.debitAmount),
          balance: l.balance !== null ? Number(l.balance) : null,
          matchStatus: l.matchedLine?.status || 'UNMATCHED_BANK',
          isPotentialFee: potentialFees.some((f) => f.id === l.id),
        })),
        unmatchedCashLines: unmatchedCashLines.map((tx) => ({
          id: tx!.id,
          date: tx!.transactionDate,
          description: tx!.description,
          type: tx!.type,
          amount: Number(tx!.amount),
        })),
        potentialFees: potentialFees.map((l) => ({
          id: l.id,
          rowNumber: l.rowNumber,
          date: l.transactionDate,
          description: l.description,
          amount: Number(l.debitAmount),
        })),
        duplicates: duplicates.map((d) => ({
          original: {
            id: d.line.id,
            rowNumber: d.line.rowNumber,
            date: d.line.transactionDate,
            description: d.line.description,
            amount: d.line.direction === 'MASUK' ? Number(d.line.creditAmount) : Number(d.line.debitAmount),
          },
          duplicates: d.matches.map((m) => ({
            id: m.id,
            rowNumber: m.rowNumber,
            date: m.transactionDate,
            description: m.description,
            amount: m.direction === 'MASUK' ? Number(m.creditAmount) : Number(m.debitAmount),
          })),
        })),
      },
    };

    return NextResponse.json({ data: report });
  } catch (error) {
    console.error('Error generating reconciliation report:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}