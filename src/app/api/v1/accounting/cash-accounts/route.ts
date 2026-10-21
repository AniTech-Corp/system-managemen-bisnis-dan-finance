import { NextRequest, NextResponse } from 'next/server';
import { AccountType, CashAccountType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';

const VALID_CASH_TYPES = new Set(Object.values(CashAccountType));

export const GET = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const cashAccounts = await prisma.cashAccount.findMany({
        where: { workspaceId: auth.workspace.id },
        orderBy: { code: 'asc' },
        include: { account: { select: { id: true, code: true, name: true, isActive: true } } },
      });
      return NextResponse.json({ success: true, data: cashAccounts });
    } catch (err) {
      return serverError('cash-accounts:get', err, 'Gagal memuat rekening kas/bank.');
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'manage_accounts');
    if (forbidden) return forbidden;

    try {
      const body = await req.json().catch(() => ({}));
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const name = typeof body.name === 'string' ? body.name.trim() : '';

      if (!code || !name) return badRequest('Kode dan nama rekening wajib diisi.');
      if (!VALID_CASH_TYPES.has(body.type)) return badRequest('Tipe rekening harus CASH atau BANK.');
      if (!body.accountId) return badRequest('Akun CoA rekening wajib dipilih.');

      const account = await prisma.account.findFirst({
        where: { id: body.accountId, workspaceId: auth.workspace.id },
        select: { id: true, type: true, isPostable: true, isActive: true },
      });
      if (!account) return badRequest('Akun CoA tidak ditemukan.');
      if (account.type !== AccountType.ASSET) return badRequest('Akun rekening harus bertipe aset.');
      if (!account.isPostable) return badRequest('Akun header tidak bisa dipakai sebagai rekening.');
      if (!account.isActive) return badRequest('Akun yang dipilih sudah nonaktif.');

      const created = await prisma.cashAccount.create({
        data: {
          workspaceId: auth.workspace.id,
          code,
          name,
          type: body.type,
          accountId: account.id,
          bankName: typeof body.bankName === 'string' ? body.bankName : null,
          accountNumber: typeof body.accountNumber === 'string' ? body.accountNumber : null,
        },
      });

      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return badRequest('Kode rekening sudah dipakai di workspace ini.');
      }
      return serverError('cash-accounts:post', err, 'Gagal membuat rekening kas/bank.');
    }
  },
  { minRole: 'VIEWER' }
);
