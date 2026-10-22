import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { normalizeCategoryCode } from '@/lib/assets/service';

/**
 * Ubah / hapus kategori aset.
 *  PATCH  /api/v1/assets/categories/[id]
 *  DELETE /api/v1/assets/categories/[id]
 */

export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      const workspaceId = auth.workspace.id;

      const existing = await prisma.assetCategory.findFirst({ where: { id, workspaceId } });
      if (!existing) {
        return NextResponse.json({ message: 'Kategori tidak ditemukan.' }, { status: 404 });
      }

      const body = await req.json();
      const data: Record<string, unknown> = {};

      if (body?.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) return NextResponse.json({ message: 'Nama kategori tidak boleh kosong.' }, { status: 400 });
        data.name = name;
      }

      if (body?.code !== undefined) {
        const code = normalizeCategoryCode(String(body.code));
        if (!code) return NextResponse.json({ message: 'Kode kategori tidak boleh kosong.' }, { status: 400 });
        const duplicate = await prisma.assetCategory.findFirst({
          where: { workspaceId, code, NOT: { id } },
          select: { id: true },
        });
        if (duplicate) {
          return NextResponse.json({ message: `Kode kategori "${code}" sudah dipakai.` }, { status: 409 });
        }
        data.code = code;
      }

      if (body?.description !== undefined) {
        data.description = body.description ? String(body.description).trim() : null;
      }
      if (body?.defaultUsefulLifeMonths !== undefined) {
        data.defaultUsefulLifeMonths =
          body.defaultUsefulLifeMonths === null
            ? null
            : Math.max(0, Math.floor(Number(body.defaultUsefulLifeMonths)));
      }
      if (body?.defaultDepreciationMethod !== undefined) {
        data.defaultDepreciationMethod = body.defaultDepreciationMethod || null;
      }
      if (body?.defaultSalvageValueRate !== undefined) {
        data.defaultSalvageValueRate = Math.min(
          100,
          Math.max(0, Number(body.defaultSalvageValueRate) || 0)
        );
      }
      if (body?.parentId !== undefined) {
        data.parentId = body.parentId || null;
      }

      const updated = await prisma.assetCategory.update({ where: { id }, data });
      return NextResponse.json({ success: true, data: updated });
    } catch (err) {
      console.error('[Asset Categories PATCH]', err);
      return NextResponse.json(
        { message: publicApiError('Kategori aset gagal diperbarui.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'ADMIN' }
);

export const DELETE = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      const workspaceId = auth.workspace.id;

      const existing = await prisma.assetCategory.findFirst({
        where: { id, workspaceId },
        include: { _count: { select: { assets: true } } },
      });
      if (!existing) {
        return NextResponse.json({ message: 'Kategori tidak ditemukan.' }, { status: 404 });
      }
      if (existing.isSystem) {
        return NextResponse.json(
          { message: 'Kategori bawaan sistem tidak boleh dihapus. Ubah nama bila perlu.' },
          { status: 400 }
        );
      }
      if (existing._count.assets > 0) {
        return NextResponse.json(
          {
            message: `Kategori masih dipakai ${existing._count.assets} aset. Pindahkan aset ke kategori lain terlebih dahulu.`,
          },
          { status: 400 }
        );
      }

      await prisma.assetCategory.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Kategori dihapus.' });
    } catch (err) {
      console.error('[Asset Categories DELETE]', err);
      return NextResponse.json(
        { message: publicApiError('Kategori aset gagal dihapus.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'ADMIN' }
);
