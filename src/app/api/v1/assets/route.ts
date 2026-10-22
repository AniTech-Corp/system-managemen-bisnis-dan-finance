import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { decimalToNumber, generateAssetCode, serializeAsset } from '@/lib/assets/service';
import { validateAssetInput, type DepreciationMethodKey } from '@/lib/assets/depreciation';

/**
 * Daftar & pembuatan aset.
 *  GET  /api/v1/assets  -> daftar aset + ringkasan nilai
 *  POST /api/v1/assets  -> catat aset baru
 */

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;

      const search = searchParams.get('search')?.trim() || '';
      const categoryId = searchParams.get('categoryId') || undefined;
      const status = searchParams.get('status') || undefined;
      const custodianId = searchParams.get('custodianId') || undefined;
      const location = searchParams.get('location')?.trim() || undefined;
      const page = Math.max(1, Number(searchParams.get('page') || 1));
      const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));

      const where: Prisma.AssetWhereInput = {
        workspaceId,
        ...(categoryId ? { categoryId } : {}),
        ...(status ? { status: status as any } : {}),
        ...(custodianId ? { custodianId } : {}),
        ...(location ? { location: { contains: location, mode: 'insensitive' } } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { assetCode: { contains: search, mode: 'insensitive' } },
                { serialNumber: { contains: search, mode: 'insensitive' } },
                { brand: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      };

      const [total, rows, aggregate, byStatus] = await Promise.all([
        prisma.asset.count({ where }),
        prisma.asset.findMany({
          where,
          orderBy: [{ assetCode: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
          include: {
            category: { select: { id: true, code: true, name: true } },
            custodian: { select: { id: true, fullName: true, email: true } },
            _count: { select: { maintenanceRecords: true, depreciationEntries: true } },
          },
        }),
        prisma.asset.aggregate({
          where,
          _sum: { acquisitionCost: true, accumulatedDepreciation: true, accumulatedImpairment: true },
        }),
        prisma.asset.groupBy({ by: ['status'], where: { workspaceId }, _count: { id: true } }),
      ]);

      const totalCost = decimalToNumber(aggregate._sum.acquisitionCost);
      const totalAccumulated = decimalToNumber(aggregate._sum.accumulatedDepreciation);
      const totalImpairment = decimalToNumber(aggregate._sum.accumulatedImpairment);

      return NextResponse.json({
        success: true,
        data: rows.map(serializeAsset),
        pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
        summary: {
          totalAssets: total,
          totalAcquisitionCost: round2(totalCost),
          totalAccumulatedDepreciation: round2(totalAccumulated),
          totalAccumulatedImpairment: round2(totalImpairment),
          totalBookValue: round2(totalCost - totalAccumulated - totalImpairment),
          byStatus: byStatus.map((row) => ({ status: row.status, count: row._count.id })),
        },
      });
    } catch (err) {
      console.error('[Assets GET]', err);
      return NextResponse.json({ message: publicApiError('Gagal memuat daftar aset.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const body = await req.json();

      const name = String(body?.name ?? '').trim();
      if (!name) {
        return NextResponse.json({ message: 'Nama aset wajib diisi.' }, { status: 400 });
      }

      const categoryId = String(body?.categoryId ?? '').trim();
      if (!categoryId) {
        return NextResponse.json({ message: 'Kategori aset wajib dipilih.' }, { status: 400 });
      }

      const category = await prisma.assetCategory.findFirst({
        where: { id: categoryId, workspaceId },
      });
      if (!category) {
        return NextResponse.json({ message: 'Kategori aset tidak ditemukan.' }, { status: 404 });
      }

      const acquisitionCost = Number(body?.acquisitionCost ?? 0);
      const salvageValue = Number(
        body?.salvageValue ??
          round2((acquisitionCost * (category.defaultSalvageValueRate ?? 0)) / 100)
      );
      const isDepreciable = body?.isDepreciable === undefined
        ? (category.defaultUsefulLifeMonths ?? 0) > 0
        : Boolean(body.isDepreciable);
      const usefulLifeMonths = isDepreciable
        ? Math.floor(Number(body?.usefulLifeMonths ?? category.defaultUsefulLifeMonths ?? 0))
        : 0;
      const method = (body?.depreciationMethod ??
        category.defaultDepreciationMethod ??
        'STRAIGHT_LINE') as DepreciationMethodKey;

      const validationError = validateAssetInput({
        acquisitionCost,
        salvageValue,
        usefulLifeMonths,
        method,
        totalEstimatedUnits:
          body?.totalEstimatedUnits === undefined ? null : Number(body.totalEstimatedUnits),
        isDepreciable,
      });
      if (validationError) {
        return NextResponse.json({ message: validationError }, { status: 400 });
      }

      const acquisitionDateRaw = body?.acquisitionDate ? new Date(body.acquisitionDate) : new Date();
      if (Number.isNaN(acquisitionDateRaw.getTime())) {
        return NextResponse.json({ message: 'Tanggal perolehan tidak valid.' }, { status: 400 });
      }

      const requestedCode = String(body?.assetCode ?? '').trim();
      const created = await prisma.$transaction(async (tx) => {
        const assetCode = requestedCode || (await generateAssetCode(tx, workspaceId, category.code));

        const duplicate = await tx.asset.findFirst({
          where: { workspaceId, assetCode },
          select: { id: true },
        });
        if (duplicate) {
          throw new Error(`Kode aset "${assetCode}" sudah dipakai.`);
        }

        return tx.asset.create({
          data: {
            workspaceId,
            categoryId,
            assetCode,
            name,
            description: body?.description ? String(body.description).trim() : null,
            brand: body?.brand ? String(body.brand).trim() : null,
            model: body?.model ? String(body.model).trim() : null,
            serialNumber: body?.serialNumber ? String(body.serialNumber).trim() : null,
            acquisitionDate: acquisitionDateRaw,
            acquisitionCost: new Prisma.Decimal(acquisitionCost),
            salvageValue: new Prisma.Decimal(salvageValue),
            usefulLifeMonths,
            isDepreciable,
            depreciationMethod: method,
            depreciationStartDate: body?.depreciationStartDate
              ? new Date(body.depreciationStartDate)
              : acquisitionDateRaw,
            totalEstimatedUnits:
              body?.totalEstimatedUnits === undefined || body?.totalEstimatedUnits === null
                ? null
                : new Prisma.Decimal(Number(body.totalEstimatedUnits)),
            location: body?.location ? String(body.location).trim() : null,
            custodianId: body?.custodianId || null,
            department: body?.department ? String(body.department).trim() : null,
            assetAccountId: body?.assetAccountId || null,
            depreciationExpenseAccountId: body?.depreciationExpenseAccountId || null,
            accumulatedDepreciationAccountId: body?.accumulatedDepreciationAccountId || null,
            sourceFileId: body?.sourceFileId || null,
            sourceTransactionId: body?.sourceTransactionId || null,
            createdBy: auth.user.id,
          },
          include: {
            category: true,
            custodian: { select: { id: true, fullName: true, email: true } },
          },
        });
      });

      return NextResponse.json(
        {
          success: true,
          data: serializeAsset(created),
          message: `Aset ${created.assetCode} berhasil dicatat.`,
        },
        { status: 201 }
      );
    } catch (err) {
      console.error('[Assets POST]', err);
      if (err instanceof Error && err.message.includes('sudah dipakai')) {
        return NextResponse.json({ message: err.message }, { status: 409 });
      }
      return NextResponse.json(
        { message: publicApiError('Aset gagal disimpan. Periksa data dan coba lagi.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);
