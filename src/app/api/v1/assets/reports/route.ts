import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { decimalToNumber, serializeAsset } from '@/lib/assets/service';

/**
 * Laporan modul aset.
 *  GET /api/v1/assets/reports?type=register|book-value|depreciation-schedule|maintenance|disposal|impairment|summary
 *
 * Semua laporan menerima filter opsional: categoryId, status, from, to.
 */

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;
      const type = searchParams.get('type') || 'register';
      const categoryId = searchParams.get('categoryId') || undefined;
      const status = searchParams.get('status') || undefined;
      const from = searchParams.get('from');
      const to = searchParams.get('to');

      const assetWhere: any = {
        workspaceId,
        ...(categoryId ? { categoryId } : {}),
        ...(status ? { status } : {}),
      };

      if (type === 'register') {
        const assets = await prisma.asset.findMany({
          where: assetWhere,
          orderBy: [{ category: { code: 'asc' } }, { assetCode: 'asc' }],
          include: {
            category: { select: { id: true, code: true, name: true } },
            custodian: { select: { id: true, fullName: true } },
          },
        });

        const rows = assets.map((asset) => {
          const serialized = serializeAsset(asset);
          return {
            id: asset.id,
            assetCode: asset.assetCode,
            name: asset.name,
            categoryName: asset.category.name,
            categoryCode: asset.category.code,
            acquisitionDate: asset.acquisitionDate,
            acquisitionCost: serialized.acquisitionCost,
            salvageValue: serialized.salvageValue,
            usefulLifeMonths: asset.usefulLifeMonths,
            method: asset.depreciationMethod,
            accumulatedDepreciation: serialized.accumulatedDepreciation,
            accumulatedImpairment: serialized.accumulatedImpairment,
            bookValue: serialized.bookValue,
            status: asset.status,
            location: asset.location,
            department: asset.department,
            custodianName: asset.custodian?.fullName ?? null,
          };
        });

        return NextResponse.json({
          success: true,
          data: rows,
          summary: {
            count: rows.length,
            totalCost: round2(rows.reduce((sum, row) => sum + row.acquisitionCost, 0)),
            totalAccumulated: round2(
              rows.reduce((sum, row) => sum + row.accumulatedDepreciation, 0)
            ),
            totalImpairment: round2(rows.reduce((sum, row) => sum + row.accumulatedImpairment, 0)),
            totalBookValue: round2(rows.reduce((sum, row) => sum + row.bookValue, 0)),
          },
        });
      }

      if (type === 'book-value') {
        const assets = await prisma.asset.findMany({
          where: { ...assetWhere, status: status || { notIn: ['DISPOSED', 'SOLD'] } },
          orderBy: [{ assetCode: 'asc' }],
          include: {
            category: { select: { id: true, code: true, name: true } },
            custodian: { select: { id: true, fullName: true } },
          },
        });

        const rows = assets.map((asset) => {
          const cost = decimalToNumber(asset.acquisitionCost);
          const accumulated = decimalToNumber(asset.accumulatedDepreciation);
          const impairment = decimalToNumber(asset.accumulatedImpairment);
          return {
            id: asset.id,
            assetCode: asset.assetCode,
            name: asset.name,
            categoryName: asset.category.name,
            acquisitionDate: asset.acquisitionDate,
            acquisitionCost: cost,
            accumulatedDepreciation: accumulated,
            accumulatedImpairment: impairment,
            bookValue: round2(cost - accumulated - impairment),
            status: asset.status,
            location: asset.location,
            custodianName: asset.custodian?.fullName ?? null,
          };
        });

        return NextResponse.json({
          success: true,
          data: rows,
          summary: {
            count: rows.length,
            totalCost: round2(rows.reduce((sum, row) => sum + row.acquisitionCost, 0)),
            totalAccumulated: round2(
              rows.reduce((sum, row) => sum + row.accumulatedDepreciation, 0)
            ),
            totalImpairment: round2(rows.reduce((sum, row) => sum + row.accumulatedImpairment, 0)),
            totalBookValue: round2(rows.reduce((sum, row) => sum + row.bookValue, 0)),
          },
        });
      }

      if (type === 'depreciation-schedule') {
        const fromYear = from ? Number(from.slice(0, 4)) : null;
        const fromMonth = from ? Number(from.slice(5, 7)) || 1 : null;
        const toYear = to ? Number(to.slice(0, 4)) : null;
        const toMonth = to ? Number(to.slice(5, 7)) || 12 : null;

        const entries = await prisma.depreciationEntry.findMany({
          where: {
            workspaceId,
            asset: assetWhere,
            ...(fromYear && fromMonth && toYear && toMonth
              ? {
                  AND: [
                    {
                      OR: [
                        { periodYear: { gt: fromYear } },
                        { periodYear: fromYear, periodMonth: { gte: fromMonth } },
                      ],
                    },
                    {
                      OR: [
                        { periodYear: { lt: toYear } },
                        { periodYear: toYear, periodMonth: { lte: toMonth } },
                      ],
                    },
                  ],
                }
              : {}),
          },
          orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }, { asset: { assetCode: 'asc' } }],
          take: 5000,
          include: {
            asset: {
              select: {
                id: true,
                assetCode: true,
                name: true,
                category: { select: { name: true } },
                depreciationMethod: true,
              },
            },
          },
        });

        const rows = entries.map((entry) => ({
          id: entry.id,
          periodYear: entry.periodYear,
          periodMonth: entry.periodMonth,
          assetId: entry.assetId,
          assetCode: entry.asset.assetCode,
          assetName: entry.asset.name,
          categoryName: entry.asset.category.name,
          method: entry.asset.depreciationMethod,
          depreciationAmount: decimalToNumber(entry.depreciationAmount),
          accumulatedDepreciation: decimalToNumber(entry.accumulatedDepreciation),
          bookValue: decimalToNumber(entry.bookValue),
          unitsProduced:
            entry.unitsProduced === null ? null : decimalToNumber(entry.unitsProduced),
          isPosted: entry.isPosted,
          journalEntryId: entry.journalEntryId,
        }));

        return NextResponse.json({
          success: true,
          data: rows,
          summary: {
            count: rows.length,
            totalAmount: round2(rows.reduce((sum, row) => sum + row.depreciationAmount, 0)),
            unpostedCount: rows.filter((row) => !row.isPosted).length,
          },
        });
      }

      if (type === 'maintenance') {
        const records = await prisma.assetMaintenance.findMany({
          where: {
            workspaceId,
            asset: assetWhere,
            ...(from || to
              ? {
                  maintenanceDate: {
                    ...(from ? { gte: new Date(from) } : {}),
                    ...(to ? { lte: new Date(`${to.length === 10 ? `${to}T23:59:59` : to}`) } : {}),
                  },
                }
              : {}),
          },
          orderBy: { maintenanceDate: 'desc' },
          take: 2000,
          include: {
            asset: {
              select: { id: true, assetCode: true, name: true, category: { select: { name: true } } },
            },
          },
        });

        const rows = records.map((record) => ({
          id: record.id,
          maintenanceDate: record.maintenanceDate,
          assetId: record.assetId,
          assetCode: record.asset.assetCode,
          assetName: record.asset.name,
          categoryName: record.asset.category.name,
          type: record.type,
          description: record.description,
          cost: decimalToNumber(record.cost),
          vendor: record.vendor,
          performedBy: record.performedBy,
          nextMaintenanceDate: record.nextMaintenanceDate,
        }));

        const byType: Record<string, { count: number; cost: number }> = {};
        for (const row of rows) {
          byType[row.type] = byType[row.type] ?? { count: 0, cost: 0 };
          byType[row.type].count += 1;
          byType[row.type].cost = round2(byType[row.type].cost + row.cost);
        }

        return NextResponse.json({
          success: true,
          data: rows,
          summary: {
            count: rows.length,
            totalCost: round2(rows.reduce((sum, row) => sum + row.cost, 0)),
            byType: Object.entries(byType).map(([maintenanceType, value]) => ({
              type: maintenanceType,
              ...value,
            })),
          },
        });
      }

      if (type === 'disposal') {
        const assets = await prisma.asset.findMany({
          where: {
            workspaceId,
            status: { in: ['DISPOSED', 'SOLD'] },
            ...(categoryId ? { categoryId } : {}),
            ...(from || to
              ? {
                  disposalDate: {
                    ...(from ? { gte: new Date(from) } : {}),
                    ...(to ? { lte: new Date(`${to.length === 10 ? `${to}T23:59:59` : to}`) } : {}),
                  },
                }
              : {}),
          },
          orderBy: { disposalDate: 'desc' },
          include: {
            category: { select: { name: true } },
            custodian: { select: { fullName: true } },
          },
        });

        const rows = assets.map((asset) => ({
          id: asset.id,
          assetCode: asset.assetCode,
          name: asset.name,
          categoryName: asset.category.name,
          acquisitionDate: asset.acquisitionDate,
          acquisitionCost: decimalToNumber(asset.acquisitionCost),
          accumulatedDepreciation: decimalToNumber(asset.accumulatedDepreciation),
          accumulatedImpairment: decimalToNumber(asset.accumulatedImpairment),
          disposalDate: asset.disposalDate,
          disposalMethod: asset.disposalMethod,
          disposalProceeds: decimalToNumber(asset.disposalProceeds),
          disposalGainLoss: decimalToNumber(asset.disposalGainLoss),
          custodianName: asset.custodian?.fullName ?? null,
        }));

        return NextResponse.json({
          success: true,
          data: rows,
          summary: {
            count: rows.length,
            totalProceeds: round2(rows.reduce((sum, row) => sum + row.disposalProceeds, 0)),
            totalGain: round2(
              rows.filter((row) => row.disposalGainLoss > 0).reduce((sum, row) => sum + row.disposalGainLoss, 0)
            ),
            totalLoss: round2(
              rows
                .filter((row) => row.disposalGainLoss < 0)
                .reduce((sum, row) => sum + Math.abs(row.disposalGainLoss), 0)
            ),
            netGainLoss: round2(rows.reduce((sum, row) => sum + row.disposalGainLoss, 0)),
          },
        });
      }

      if (type === 'impairment') {
        const records = await prisma.assetImpairment.findMany({
          where: {
            workspaceId,
            asset: assetWhere,
            ...(from || to
              ? {
                  impairmentDate: {
                    ...(from ? { gte: new Date(from) } : {}),
                    ...(to ? { lte: new Date(`${to.length === 10 ? `${to}T23:59:59` : to}`) } : {}),
                  },
                }
              : {}),
          },
          orderBy: { impairmentDate: 'desc' },
          take: 2000,
          include: {
            asset: {
              select: { id: true, assetCode: true, name: true, category: { select: { name: true } } },
            },
          },
        });

        const rows = records.map((record) => ({
          id: record.id,
          impairmentDate: record.impairmentDate,
          assetId: record.assetId,
          assetCode: record.asset.assetCode,
          assetName: record.asset.name,
          categoryName: record.asset.category.name,
          recoverableAmount: decimalToNumber(record.recoverableAmount),
          carryingAmount: decimalToNumber(record.carryingAmount),
          impairmentLoss: decimalToNumber(record.impairmentLoss),
          description: record.description,
          isPosted: record.isPosted,
        }));

        return NextResponse.json({
          success: true,
          data: rows,
          summary: {
            count: rows.length,
            totalLoss: round2(rows.reduce((sum, row) => sum + row.impairmentLoss, 0)),
            unpostedCount: rows.filter((row) => !row.isPosted).length,
          },
        });
      }

      if (type === 'summary') {
        const [assets, categories, maintenanceAgg, disposalAgg, impairmentAgg, recentEntries] =
          await Promise.all([
            prisma.asset.findMany({
              where: { workspaceId },
              select: {
                acquisitionCost: true,
                accumulatedDepreciation: true,
                accumulatedImpairment: true,
                status: true,
              },
            }),
            prisma.assetCategory.findMany({
              where: { workspaceId },
              orderBy: { code: 'asc' },
              include: {
                assets: {
                  select: {
                    acquisitionCost: true,
                    accumulatedDepreciation: true,
                    accumulatedImpairment: true,
                    status: true,
                  },
                },
              },
            }),
            prisma.assetMaintenance.aggregate({
              where: {
                workspaceId,
                maintenanceDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
              },
              _sum: { cost: true },
              _count: { id: true },
            }),
            prisma.asset.aggregate({
              where: { workspaceId, status: { in: ['DISPOSED', 'SOLD'] } },
              _sum: { disposalProceeds: true, disposalGainLoss: true },
              _count: { id: true },
            }),
            prisma.assetImpairment.aggregate({
              where: { workspaceId },
              _sum: { impairmentLoss: true },
              _count: { id: true },
            }),
            prisma.depreciationEntry.findMany({
              where: { workspaceId },
              orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
              take: 8,
              include: { asset: { select: { assetCode: true, name: true } } },
            }),
          ]);

        const active = assets.filter(
          (asset) => asset.status !== 'DISPOSED' && asset.status !== 'SOLD'
        );
        const totalCost = assets.reduce(
          (sum, asset) => sum + decimalToNumber(asset.acquisitionCost),
          0
        );
        const totalAccumulated = assets.reduce(
          (sum, asset) => sum + decimalToNumber(asset.accumulatedDepreciation),
          0
        );
        const totalImpairment = assets.reduce(
          (sum, asset) => sum + decimalToNumber(asset.accumulatedImpairment),
          0
        );

        return NextResponse.json({
          success: true,
          data: {
            totalAssets: assets.length,
            activeAssets: active.length,
            disposedAssets: assets.filter((a) => a.status === 'DISPOSED' || a.status === 'SOLD').length,
            totalAcquisitionCost: round2(totalCost),
            totalAccumulatedDepreciation: round2(totalAccumulated),
            totalAccumulatedImpairment: round2(totalImpairment),
            totalBookValue: round2(totalCost - totalAccumulated - totalImpairment),
            maintenanceThisYear: {
              count: maintenanceAgg._count.id,
              cost: round2(decimalToNumber(maintenanceAgg._sum.cost)),
            },
            disposals: {
              count: disposalAgg._count.id,
              proceeds: round2(decimalToNumber(disposalAgg._sum.disposalProceeds)),
              netGainLoss: round2(decimalToNumber(disposalAgg._sum.disposalGainLoss)),
            },
            impairments: {
              count: impairmentAgg._count.id,
              totalLoss: round2(decimalToNumber(impairmentAgg._sum.impairmentLoss)),
            },
            byCategory: categories.map((category) => {
              const cost = category.assets.reduce(
                (sum, asset) => sum + decimalToNumber(asset.acquisitionCost),
                0
              );
              const accumulated = category.assets.reduce(
                (sum, asset) => sum + decimalToNumber(asset.accumulatedDepreciation),
                0
              );
              const impairment = category.assets.reduce(
                (sum, asset) => sum + decimalToNumber(asset.accumulatedImpairment),
                0
              );
              return {
                id: category.id,
                code: category.code,
                name: category.name,
                count: category.assets.length,
                acquisitionCost: round2(cost),
                bookValue: round2(cost - accumulated - impairment),
              };
            }),
            recentDepreciation: recentEntries.map((entry) => ({
              id: entry.id,
              period: `${entry.periodYear}-${String(entry.periodMonth).padStart(2, '0')}`,
              assetCode: entry.asset.assetCode,
              assetName: entry.asset.name,
              amount: decimalToNumber(entry.depreciationAmount),
              isPosted: entry.isPosted,
            })),
          },
        });
      }

      return NextResponse.json(
        {
          message:
            'Tipe laporan tidak dikenal. Gunakan register, book-value, depreciation-schedule, maintenance, disposal, impairment, atau summary.',
        },
        { status: 400 }
      );
    } catch (err) {
      console.error('[Asset Reports GET]', err);
      return NextResponse.json(
        { message: publicApiError('Gagal memuat laporan aset.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'VIEWER' }
);
