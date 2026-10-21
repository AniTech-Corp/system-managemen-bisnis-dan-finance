import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { badRequest, guardAccounting, notFound, serverError } from '@/lib/accounting/api';
import { wouldCreateCycle } from '@/lib/accounting/account-tree';

export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'manage_accounts');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };

      const account = await prisma.account.findFirst({
        where: { id, workspaceId: auth.workspace.id },
      });
      if (!account) return notFound('Akun tidak ditemukan.');

      const body = await req.json().catch(() => ({}));
      const data: Prisma.AccountUpdateInput = {};

      if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
      if (typeof body.description === 'string') data.description = body.description;
      if (typeof body.isActive === 'boolean') data.isActive = body.isActive;
      if (typeof body.isPostable === 'boolean') data.isPostable = body.isPostable;
      if (body.parentId !== undefined) {
        if (body.parentId === id) return badRequest('Akun tidak bisa menjadi induk dirinya sendiri.');
        if (body.parentId) {
          // Hierarki dibaca sekaligus: cukup satu query untuk validasi induk &
          // siklus (akun tidak boleh dipindah ke bawah turunannya sendiri).
          const siblings = await prisma.account.findMany({
            where: { workspaceId: auth.workspace.id },
            select: { id: true, code: true, name: true, type: true, parentId: true },
          });
          const parent = siblings.find((a) => a.id === body.parentId);
          if (!parent) return badRequest('Akun induk tidak ditemukan.');
          if (parent.type !== account.type) {
            return badRequest('Tipe akun induk harus sama dengan tipe akun ini.');
          }
          if (wouldCreateCycle(siblings, id, parent.id)) {
            return badRequest('Akun induk tidak boleh akun itu sendiri atau turunannya.');
          }
        }
        data.parent = body.parentId ? { connect: { id: body.parentId } } : { disconnect: true };
      }

      if (Object.keys(data).length === 0) return badRequest('Tidak ada perubahan yang dikirim.');

      const updated = await prisma.account.update({ where: { id: account.id }, data });
      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      return serverError('accounts:patch', err, 'Gagal memperbarui akun.');
    }
  },
  { minRole: 'VIEWER' }
);

export const DELETE = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    const forbidden = guardAccounting(auth, 'manage_accounts');
    if (forbidden) return forbidden;

    try {
      const { id } = (await params) as { id: string };

      const account = await prisma.account.findFirst({
        where: { id, workspaceId: auth.workspace.id },
        include: { _count: { select: { lines: true, children: true } } },
      });
      if (!account) return notFound('Akun tidak ditemukan.');
      if (account.isSystem) {
        return badRequest('Akun sistem tidak bisa dihapus. Nonaktifkan saja bila tidak dipakai.');
      }
      if (account._count.lines > 0) {
        return badRequest(
          'Akun sudah dipakai di jurnal dan tidak bisa dihapus. Nonaktifkan akun ini bila tidak dipakai lagi.'
        );
      }
      if (account._count.children > 0) {
        return badRequest('Akun masih memiliki sub-akun. Pindahkan atau hapus sub-akunnya terlebih dahulu.');
      }

      await prisma.account.delete({ where: { id: account.id } });
      return NextResponse.json({ success: true, message: 'Akun berhasil dihapus.' });
    } catch (err) {
      return serverError('accounts:delete', err, 'Gagal menghapus akun.');
    }
  },
  { minRole: 'VIEWER' }
);
