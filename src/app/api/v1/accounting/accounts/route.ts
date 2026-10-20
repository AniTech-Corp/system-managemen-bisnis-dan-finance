import { NextRequest, NextResponse } from 'next/server';
import { AccountType, NormalBalance, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';

const VALID_TYPES = new Set(Object.values(AccountType));
const VALID_BALANCES = new Set(Object.values(NormalBalance));

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const includeInactive = req.nextUrl.searchParams.get('includeInactive') === 'true';
      const type = req.nextUrl.searchParams.get('type') as AccountType | null;

      const accounts = await prisma.account.findMany({
        where: {
          workspaceId: auth.workspace.id,
          ...(includeInactive ? {} : { isActive: true }),
          ...(type && VALID_TYPES.has(type) ? { type } : {}),
        },
        orderBy: { code: 'asc' },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          normalBalance: true,
          parentId: true,
          isPostable: true,
          isSystem: true,
          isActive: true,
          description: true,
        },
      });

      return NextResponse.json({ success: true, data: accounts });
    } catch (err) {
      return serverError('accounts:get', err, 'Gagal memuat bagan akun.');
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

      if (!code || !name) return badRequest('Kode dan nama akun wajib diisi.');
      if (!VALID_TYPES.has(body.type)) return badRequest('Tipe akun tidak dikenal.');
      if (!VALID_BALANCES.has(body.normalBalance)) return badRequest('Saldo normal akun tidak dikenal.');

      if (body.parentId) {
        const parent = await prisma.account.findFirst({
          where: { id: body.parentId, workspaceId: auth.workspace.id },
          select: { id: true },
        });
        if (!parent) return badRequest('Akun induk tidak ditemukan.');
      }

      const created = await prisma.account.create({
        data: {
          workspaceId: auth.workspace.id,
          code,
          name,
          type: body.type,
          normalBalance: body.normalBalance,
          parentId: body.parentId || null,
          isPostable: body.isPostable !== false,
          isSystem: false,
          isActive: true,
          description: typeof body.description === 'string' ? body.description : null,
        },
      });

      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return badRequest('Kode akun sudah dipakai di workspace ini.');
      }
      return serverError('accounts:post', err, 'Gagal membuat akun.');
    }
  },
  { minRole: 'VIEWER' }
);
