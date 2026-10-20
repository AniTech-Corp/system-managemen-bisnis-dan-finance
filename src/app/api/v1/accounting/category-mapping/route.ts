import { NextRequest, NextResponse } from 'next/server';
import { AccountType, Prisma, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';

const SUGGESTED_CODES: Record<'INCOME' | 'EXPENSE', string> = {
  INCOME: '4-1100',
  EXPENSE: '6-9000',
};

export const GET = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const workspaceId = auth.workspace.id;

      const [categories, mappings, accounts] = await Promise.all([
        prisma.cashTransaction.groupBy({
          by: ['category', 'type'],
          where: { workspaceId },
          _count: { _all: true },
        }),
        prisma.categoryAccountMap.findMany({ where: { workspaceId } }),
        prisma.account.findMany({
          where: { workspaceId, isActive: true, isPostable: true },
          select: { id: true, code: true, name: true, type: true },
          orderBy: { code: 'asc' },
        }),
      ]);

      const accountById = new Map(accounts.map((a) => [a.id, a]));
      const suggestedByCode = new Map(accounts.map((a) => [a.code, a]));

      const rows = categories
        .filter((c) => c.category?.trim())
        .map((c) => {
          const accountType = c.type === TransactionType.INCOME ? AccountType.REVENUE : AccountType.EXPENSE;
          const mapping = mappings.find((m) => m.category === c.category && m.type === accountType);
          const mapped = mapping ? accountById.get(mapping.accountId) : undefined;
          const suggested = suggestedByCode.get(SUGGESTED_CODES[c.type]);
          return {
            category: c.category,
            type: c.type,
            transactionCount: c._count._all,
            accountId: mapped?.id ?? null,
            accountCode: mapped?.code ?? null,
            accountName: mapped?.name ?? null,
            suggestedAccountId: suggested?.id ?? null,
            suggestedAccountCode: suggested?.code ?? null,
            suggestedAccountName: suggested?.name ?? null,
          };
        })
        .sort((a, b) => a.category.localeCompare(b.category));

      return NextResponse.json({ success: true, data: rows, accounts });
    } catch (err) {
      return serverError('category-mapping:get', err, 'Gagal memuat pemetaan kategori.');
    }
  },
  { minRole: 'VIEWER' }
);

export const PUT = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'manage_accounts');
    if (forbidden) return forbidden;

    try {
      const body = await req.json().catch(() => ({}));
      if (!Array.isArray(body.mappings)) return badRequest('Format pemetaan tidak valid.');

      const workspaceId = auth.workspace.id;
      let applied = 0;

      for (const item of body.mappings) {
        const category = typeof item.category === 'string' ? item.category.trim() : '';
        if (!category) continue;
        if (item.type !== TransactionType.INCOME && item.type !== TransactionType.EXPENSE) continue;

        const accountType = item.type === TransactionType.INCOME ? AccountType.REVENUE : AccountType.EXPENSE;
        const key = { workspaceId_category_type: { workspaceId, category, type: accountType } };

        if (!item.accountId) {
          await prisma.categoryAccountMap.deleteMany({ where: { workspaceId, category, type: accountType } });
          applied += 1;
          continue;
        }

        const account = await prisma.account.findFirst({
          where: { id: item.accountId, workspaceId, isActive: true, isPostable: true },
          select: { id: true, type: true },
        });
        if (!account) return badRequest(`Akun untuk kategori "${category}" tidak ditemukan atau tidak bisa dipakai.`);
        if (account.type !== accountType) {
          return badRequest(
            `Akun untuk kategori "${category}" harus bertipe ${accountType === AccountType.REVENUE ? 'pendapatan' : 'beban'}.`
          );
        }

        await prisma.categoryAccountMap.upsert({
          where: key,
          create: { workspaceId, category, type: accountType, accountId: account.id },
          update: { accountId: account.id },
        });
        applied += 1;
      }

      return NextResponse.json({ success: true, message: `${applied} pemetaan kategori disimpan.` });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return badRequest('Gagal menyimpan pemetaan kategori.');
      }
      return serverError('category-mapping:put', err, 'Gagal menyimpan pemetaan kategori.');
    }
  },
  { minRole: 'VIEWER' }
);
