import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import {
  assetDetailInclude,
  decimalToNumber,
  serializeAsset,
  serializeDepreciationEntry,
} from '@/lib/assets/service';
import {
  buildDepreciationSchedule,
  jakartaYearMonth,
  validateAssetInput,
  type DepreciationMethodKey,
} from '@/lib/assets/depreciation';

/**
 * Detail, perubahan, dan penghapusan aset.
 *  GET    /api/v1/assets/[id]
 *  PATCH  /api/v1/assets/[id]
 *  DELETE /api/v1/assets/[id]
 */

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const GET = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      const asset = await prisma.asset.findFirst({
        where: { id, workspaceId: auth.workspace.id },
        include: assetDetailInclude,
      });
      if (!asset) {
        return NextResponse.json({ message: 'Aset tidak ditemukan.' }, { status: 404 });
      }

      const cost = decimalToNumber(asset.acquisitionCost);
      const salvage = decimalToNumber(asset.salvageValue);
      const accumulatedImpairment = decimalToNumber(asset.accumulatedImpairment);
      const startDate = asset.depreciationStartDate ?? asset.acquisitionDate;

      const schedule = asset.isDepreciable
        ? buildDepreciationSchedule({
            acquisitionCost: cost,
            salvageValue: salvage,
            usefulLifeMonths: asset.usefulLifeMonths,
            method: asset.depreciationMethod as DepreciationMethodKey,
            startDate,
            totalEstimatedUnits: asset.totalEstimatedUnits
              ? decimalToNumber(asset.totalEstimatedUnits)
              : null,
          })
        : [];

      const now = jakartaYearMonth(new Date());
      const currentPeriodIndex = now.year * 12 + now.month;
      const elapsed = schedule.filter((p) => p.year * 12 + p.month <= currentPeriodIndex);
      const plannedAccumulated = elapsed.length > 0 ? elapsed[elapsed.length - 1].accumulated : 0;

      return NextResponse.json({
        success: true,
        data: serializeAsset(asset),
        schedule,
        depreciationSummary: {
          plannedAccumulated,
          plannedBookValue: round2(cost - plannedAccumulated - accumulatedImpairment),
          postedAccumulated: decimalToNumber(asset.accumulatedDepreciation),
          accumulatedImpairment,
          bookValue: round2(
            cost - decimalToNumber(asset.accumulatedDepreciation) - accumulatedImpairment
          ),
          remainingMonths: Math.max(0, schedule.length - elapsed.length),
          progressPct:
            schedule.length > 0 ? round2((elapsed.length / schedule.length) * 100) : 0,
        },
        depreciationEntries: asset.depreciationEntries.map(serializeDepreciationEntry),
      });
    } catch (err) {
      console.error('[Asset Detail GET]', err);
      return NextResponse.json({ message: publicApiError('Gagal memuat detail aset.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      const workspaceId = auth.workspace.id;
      const body = await req.json();

      const existing = await prisma.asset.findFirst({ where: { id, workspaceId } });
      if (!existing) {
        return NextResponse.json({ message: 'Aset tidak ditemukan.' }, { status: 404 });
      }

      const data: Prisma.AssetUpdateInput = {};

      const stringFields = [
        'name',
        'description',
        'brand',
        'model',
        'serialNumber',
        'location',
        'department',
        'assetCode',
      ] as const;
      for (const field of stringFields) {
        if (body?.[field] !== undefined) {
          const value = String(body[field] ?? '').trim();
          if (field === 'name' && !value) {
            return NextResponse.json({ message: 'Nama aset tidak boleh kosong.' }, { status: 400 });
          }
          (data as any)[field] = value || null;
        }
      }

      if (body?.categoryId !== undefined) {
        const category = await prisma.assetCategory.findFirst({
          where: { id: String(body.categoryId), workspaceId },
          select: { id: true },
        });
        if (!category) {
          return NextResponse.json({ message: 'Kategori aset tidak ditemukan.' }, { status: 404 });
        }
        data.category = { connect: { id: category.id } };
      }

      // Perubahan angka penyusutan hanya boleh sebelum ada jurnal penyusutan
      // yang diposting. Entri yang belum terjurnal akan dihitung ulang.
      const depreciationTouched =
        body?.acquisitionCost !== undefined ||
        body?.salvageValue !== undefined ||
        body?.usefulLifeMonths !== undefined ||
        body?.depreciationMethod !== undefined ||
        body?.depreciationStartDate !== undefined ||
        body?.isDepreciable !== undefined ||
        body?.totalEstimatedUnits !== undefined;

      let resetUnposted = false;

      if (depreciationTouched) {
        const [postedCount, entryCount] = await Promise.all([
          prisma.depreciationEntry.count({ where: { workspaceId, assetId: id, isPosted: true } }),
          prisma.depreciationEntry.count({ where: { workspaceId, assetId: id } }),
        ]);
        if (postedCount > 0) {
          return NextResponse.json(
            {
              message:
                'Nilai perolehan, nilai sisa, masa manfaat, dan metode tidak bisa diubah karena sudah ada jurnal penyusutan yang diposting. Buat jurnal penyesuaian bila perlu koreksi.',
            },
            { status: 400 }
          );
        }
        if (entryCount > 0) {
          await prisma.depreciationEntry.deleteMany({
            where: { workspaceId, assetId: id, isPosted: false },
          });
          resetUnposted = true;
        }

        const acquisitionCost =
          body?.acquisitionCost !== undefined
            ? Number(body.acquisitionCost)
            : decimalToNumber(existing.acquisitionCost);
        const salvageValue =
          body?.salvageValue !== undefined
            ? Number(body.salvageValue)
            : decimalToNumber(existing.salvageValue);
        const isDepreciable =
          body?.isDepreciable !== undefined ? Boolean(body.isDepreciable) : existing.isDepreciable;
        const usefulLifeMonths = isDepreciable
          ? Math.floor(
              Number(
                body?.usefulLifeMonths !== undefined
                  ? body.usefulLifeMonths
                  : existing.usefulLifeMonths
              )
            )
          : 0;
        const method = (body?.depreciationMethod ??
          existing.depreciationMethod) as DepreciationMethodKey;

        const error = validateAssetInput({
          acquisitionCost,
          salvageValue,
          usefulLifeMonths,
          method,
          totalEstimatedUnits:
            body?.totalEstimatedUnits !== undefined
              ? Number(body.totalEstimatedUnits)
              : existing.totalEstimatedUnits
                ? decimalToNumber(existing.totalEstimatedUnits)
                : null,
          isDepreciable,
        });
        if (error) return NextResponse.json({ message: error }, { status: 400 });

        data.acquisitionCost = new Prisma.Decimal(acquisitionCost);
        data.salvageValue = new Prisma.Decimal(salvageValue);
        data.usefulLifeMonths = usefulLifeMonths;
        data.isDepreciable = isDepreciable;
        data.depreciationMethod = method;
        if (body?.depreciationStartDate !== undefined) {
          data.depreciationStartDate = body.depreciationStartDate
            ? new Date(body.depreciationStartDate)
            : null;
        }
        if (body?.totalEstimatedUnits !== undefined) {
          data.totalEstimatedUnits =
            body.totalEstimatedUnits === null
              ? null
              : new Prisma.Decimal(Number(body.totalEstimatedUnits));
        }

        // Entri lama yang belum terjurnal sudah dihapus: mulai penyusutan dari nol.
        if (resetUnposted) {
          data.accumulatedDepreciation = new Prisma.Decimal(0);
          data.unitsProducedToDate = new Prisma.Decimal(0);
          data.lastDepreciationDate = null;
        }
      }

      if (body?.acquisitionDate !== undefined) {
        const parsed = new Date(body.acquisitionDate);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ message: 'Tanggal perolehan tidak valid.' }, { status: 400 });
        }
        data.acquisitionDate = parsed;
      }

      if (body?.custodianId !== undefined) {
        data.custodian = body.custodianId ? { connect: { id: String(body.custodianId) } } : { disconnect: true };
      }

      if (body?.assetAccountId !== undefined) {
        data.assetAccount = body.assetAccountId
          ? { connect: { id: String(body.assetAccountId) } }
          : { disconnect: true };
      }
      if (body?.depreciationExpenseAccountId !== undefined) {
        data.depreciationExpenseAccount = body.depreciationExpenseAccountId
          ? { connect: { id: String(body.depreciationExpenseAccountId) } }
          : { disconnect: true };
      }
      if (body?.accumulatedDepreciationAccountId !== undefined) {
        data.accumulatedDepreciationAccount = body.accumulatedDepreciationAccountId
          ? { connect: { id: String(body.accumulatedDepreciationAccountId) } }
          : { disconnect: true };
      }

      if (body?.status !== undefined) {
        const allowed = ['ACTIVE', 'UNDER_MAINTENANCE', 'IMPAIRED'];
        if (!allowed.includes(String(body.status))) {
          return NextResponse.json(
            { message: 'Status hanya bisa diubah ke ACTIVE, UNDER_MAINTENANCE, atau IMPAIRED. Pelepasan memakai menu Pelepasan Aset.' },
            { status: 400 }
          );
        }
        data.status = String(body.status) as any;
      }

      data.updater = { connect: { id: auth.user.id } };

      const updated = await prisma.asset.update({
        where: { id },
        data,
        include: {
          category: true,
          custodian: { select: { id: true, fullName: true, email: true } },
        },
      });

      return NextResponse.json({
        success: true,
        data: serializeAsset(updated),
        message: 'Aset berhasil diperbarui.',
      });
    } catch (err) {
      console.error('[Asset PATCH]', err);
      return NextResponse.json(
        { message: publicApiError('Aset gagal diperbarui. Periksa data dan coba lagi.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);

export const DELETE = withTenantGuard(
  async (_req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      const workspaceId = auth.workspace.id;

      const asset = await prisma.asset.findFirst({ where: { id, workspaceId } });
      if (!asset) {
        return NextResponse.json({ message: 'Aset tidak ditemukan.' }, { status: 404 });
      }

      const postedCount = await prisma.depreciationEntry.count({
        where: { workspaceId, assetId: id, isPosted: true },
      });
      if (postedCount > 0) {
        return NextResponse.json(
          {
            message:
              'Aset dengan jurnal penyusutan yang sudah diposting tidak bisa dihapus. Gunakan menu Pelepasan Aset agar jejak akuntansi tetap utuh.',
          },
          { status: 400 }
        );
      }

      await prisma.asset.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Aset dihapus.' });
    } catch (err) {
      console.error('[Asset DELETE]', err);
      return NextResponse.json({ message: publicApiError('Aset gagal dihapus.') }, { status: 500 });
    }
  },
  { minRole: 'ADMIN' }
);
