import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { decimalToNumber, normalizeCategoryCode } from '@/lib/assets/service';

/**
 * Kategori aset.
 *  GET  /api/v1/assets/categories  -> daftar kategori + ringkasan aset
 *  POST /api/v1/assets/categories  -> buat kategori baru
 */

export const GET = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const categories = await prisma.assetCategory.findMany({
        where: { workspaceId },
        orderBy: [{ isSystem: 'desc' }, { code: 'asc' }],
        include: {
          _count: { select: { assets: true } },
          assets: { select: { acquisitionCost: true, accumulatedDepreciation: true, status: true } },
        },
      });

      const data = categories.map((category) => {
        const totalCost = category.assets.reduce(
          (sum, asset) => sum + decimalToNumber(asset.acquisitionCost),
          0
        );
        const totalAccumulated = category.assets.reduce(
          (sum, asset) => sum + decimalToNumber(asset.accumulatedDepreciation),
          0
        );
        return {
          ...category,
          assetCount: category._count.assets,
          activeCount: category.assets.filter((a) => a.status === 'ACTIVE').length,
          totalAcquisitionCost: totalCost,
          totalBookValue: totalCost - totalAccumulated,
          _count: undefined,
          assets: undefined,
        };
      });

      return NextResponse.json({ success: true, data });
    } catch (err) {
      console.error('[Asset Categories GET]', err);
      return NextResponse.json(
        { message: publicApiError('Gagal memuat kategori aset.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const body = await req.json();
      const name = String(body?.name ?? '').trim();
      const rawCode = String(body?.code ?? '').trim();
      const code = normalizeCategoryCode(rawCode || name);

      if (!name) {
        return NextResponse.json({ message: 'Nama kategori wajib diisi.' }, { status: 400 });
      }
      if (!code) {
        return NextResponse.json({ message: 'Kode kategori wajib diisi.' }, { status: 400 });
      }

      const duplicate = await prisma.assetCategory.findUnique({
        where: { workspaceId_code: { workspaceId: auth.workspace.id, code } },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json({ message: `Kode kategori "${code}" sudah dipakai.` }, { status: 409 });
      }

      const defaultUsefulLifeMonths =
        body?.defaultUsefulLifeMonths === undefined || body?.defaultUsefulLifeMonths === null
          ? null
          : Math.max(0, Math.floor(Number(body.defaultUsefulLifeMonths)));

      const created = await prisma.assetCategory.create({
        data: {
          workspaceId: auth.workspace.id,
          code,
          name,
          description: body?.description ? String(body.description).trim() : null,
          defaultUsefulLifeMonths,
          defaultDepreciationMethod: body?.defaultDepreciationMethod || undefined,
          defaultSalvageValueRate:
            body?.defaultSalvageValueRate === undefined
              ? 0
              : Math.min(100, Math.max(0, Number(body.defaultSalvageValueRate))),
          parentId: body?.parentId || null,
          isSystem: false,
        },
      });

      return NextResponse.json({ success: true, data: created }, { status: 201 });
    } catch (err) {
      console.error('[Asset Categories POST]', err);
      return NextResponse.json(
        { message: publicApiError('Kategori aset gagal disimpan.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'ADMIN' }
);
