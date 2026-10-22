import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseBankStatement, computeFileHash } from '@/lib/bank-parsers';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = request.nextUrl.searchParams.get('workspaceId');
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

    const page = parseInt(request.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
    const status = request.nextUrl.searchParams.get('status');
    const cashAccountId = request.nextUrl.searchParams.get('cashAccountId');

    const where: any = { workspaceId };
    if (status) where.status = status;
    if (cashAccountId) where.cashAccountId = cashAccountId;

    const [statements, total] = await Promise.all([
      prisma.bankStatement.findMany({
        where,
        include: {
          cashAccount: { select: { id: true, code: true, name: true, bankName: true, accountNumber: true } },
          _count: { select: { lines: true, matchedLines: true } },
        },
        orderBy: { statementDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bankStatement.count({ where }),
    ]);

    return NextResponse.json({
      data: statements,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching bank statements:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = getUserFromRequest(request);
    if (!authUser?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const workspaceId = formData.get('workspaceId') as string;
    const cashAccountId = formData.get('cashAccountId') as string;

    if (!file || !workspaceId || !cashAccountId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check workspace access
    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: authUser.id } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check cash account belongs to workspace
    const cashAccount = await prisma.cashAccount.findFirst({
      where: { id: cashAccountId, workspaceId },
    });
    if (!cashAccount) {
      return NextResponse.json({ error: 'Cash account not found' }, { status: 404 });
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = computeFileHash(buffer);

    // Check for duplicate
    const existing = await prisma.bankStatement.findUnique({
      where: { workspaceId_fileHash: { workspaceId, fileHash } },
    });
    if (existing) {
      return NextResponse.json({ error: 'File already uploaded (duplicate detected)', existingId: existing.id }, { status: 409 });
    }

    // Parse the bank statement
    const parseResult = await parseBankStatement(buffer, file.name);

    if (parseResult.errors.length > 0 && parseResult.lines.length === 0) {
      return NextResponse.json(
        { error: 'Failed to parse bank statement', details: parseResult.errors },
        { status: 400 }
      );
    }

    // Create bank statement record
    const statement = await prisma.bankStatement.create({
      data: {
        workspaceId,
        cashAccountId,
        fileName: file.name,
        fileHash,
        statementDate: parseResult.metadata.statementDate,
        startDate: parseResult.metadata.startDate,
        endDate: parseResult.metadata.endDate,
        openingBalance: parseResult.metadata.openingBalance,
        closingBalance: parseResult.metadata.closingBalance,
        currency: parseResult.metadata.currency,
        status: 'PARSED',
        uploadedBy: authUser.id,
        parsedAt: new Date(),
        lines: {
          create: parseResult.lines.map((line) => ({
            rowNumber: line.rowNumber,
            transactionDate: line.transactionDate,
            valueDate: line.valueDate,
            description: line.description,
            referenceNumber: line.referenceNumber,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            balance: line.balance,
            direction: line.direction,
            rawData: line.rawData as any,
            isValid: true,
            workspace: { connect: { id: workspaceId } },
          })),
        },
      },
      include: {
        cashAccount: { select: { id: true, code: true, name: true, bankName: true, accountNumber: true } },
        _count: { select: { lines: true } },
      },
    });

    return NextResponse.json({ data: statement, parseErrors: parseResult.errors }, { status: 201 });
  } catch (error) {
    console.error('Error uploading bank statement:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}