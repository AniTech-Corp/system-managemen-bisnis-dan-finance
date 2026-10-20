import { NextRequest, NextResponse } from 'next/server';
import { PartnerType, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, serverError } from '@/lib/accounting/api';

const VALID_PARTNER_TYPES = new Set(Object.values(PartnerType));

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    const forbidden = guardAccounting(auth, 'view');
    if (forbidden) return forbidden;

    try {
      const search = req.nextUrl.searchParams.get('search')?.trim();
      const type = req.nextUrl.searchParams.get('type');

      const partners = await prisma.partner.findMany({
        where: {
          workspaceId: auth.workspace.id,
          ...(type && VALID_PARTNER_TYPES.has(type as PartnerType) ? { type: type as PartnerType } : {}),
          ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        },
        orderBy: { name: 'asc' },
        take: 200,
      });

      return NextResponse.json({ success: true, data: partners });
    } catch (err) {
      return serverError('partners:get', err, 'Gagal memuat daftar pelanggan/supplier.');
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
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return badRequest('Nama pelanggan/supplier wajib diisi.');

      const type = VALID_PARTNER_TYPES.has(body.type) ? (body.type as PartnerType) : PartnerType.CUSTOMER;

      const created = await prisma.partner.create({
        data: {
          workspaceId: auth.workspace.id,
          name,
          type,
          email: typeof body.email === 'string' ? body.email : null,
          phone: typeof body.phone === 'string' ? body.phone : null,
          address: typeof body.address === 'string' ? body.address : null,
          npwp: typeof body.npwp === 'string' ? body.npwp : null,
          notes: typeof body.notes === 'string' ? body.notes : null,
        },
      });

      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        return badRequest('Gagal menyimpan pelanggan/supplier.');
      }
      return serverError('partners:post', err, 'Gagal menyimpan pelanggan/supplier.');
    }
  },
  { minRole: 'VIEWER' }
);
