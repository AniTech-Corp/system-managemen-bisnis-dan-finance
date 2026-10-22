import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { decimalToNumber } from '@/lib/assets/service';

/**
 * Riwayat pemeliharaan aset.
 *  GET  /api/v1/assets/maintenance?assetId=&type=&from=&to=
 *  POST /api/v1/assets/maintenance
 */

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const serializeMaintenance = (row: any) => ({
  ...row,
  cost: decimalToNumber(row.cost),
});

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { searchParams } = req.nextUrl;

      const assetId = searchParams.get('assetId') || undefined;
      const type = searchParams.get('type') || undefined;
      const from = searchParams.get('from');
      const to = searchParams.get('to');
      const page = Math.max(1, Number(searchParams.get('page') || 1));
      const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') || 50)));

      const where: Prisma.AssetMaintenanceWhereInput = {
        workspaceId,
        ...(assetId ? { assetId } : {}),
        ...(type ? { type: type as any } : {}),
        ...(from || to
          ? {
              maintenanceDate: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to ? { lte: new Date(`${to.length === 10 ? `${to}T23:59:59` : to}`) } : {}),
              },
            }
          : {}),
      };

      const [total, rows, aggregate] = await Promise.all([
        prisma.assetMaintenance.count({ where }),
        prisma.assetMaintenance.findMany({
          where,
          orderBy: { maintenanceDate: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            asset: {
              select: {
                id: true,
                assetCode: true,
                name: true,
                location: true,
                category: { select: { id: true, code: true, name: true } },
              },
            },
          },
        }),
        prisma.assetMaintenance.aggregate({ where, _sum: { cost: true } }),
      ]);

      return NextResponse.json({
        success: true,
        data: rows.map(serializeMaintenance),
        pagination: { total, page, limit, pages: Math.ceil(total / limit) || 1 },
        summary: {
          totalRecords: total,
          totalCost: round2(decimalToNumber(aggregate._sum.cost)),
        },
      });
    } catch (err) {
      console.error('[Asset Maintenance GET]', err);
      return NextResponse.json(
        { message: publicApiError('Gagal memuat riwayat pemeliharaan.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const body = await req.json();

      const assetId = String(body?.assetId ?? '').trim();
      if (!assetId) {
        return NextResponse.json({ message: 'Aset wajib dipilih.' }, { status: 400 });
      }

      const asset = await prisma.asset.findFirst({
        where: { id: assetId, workspaceId },
        select: { id: true, name: true },
      });
      if (!asset) {
        return NextResponse.json({ message: 'Aset tidak ditemukan.' }, { status: 404 });
      }

      const description = String(body?.description ?? '').trim();
      if (!description) {
        return NextResponse.json({ message: 'Deskripsi pemeliharaan wajib diisi.' }, { status: 400 });
      }

      const maintenanceDate = body?.maintenanceDate ? new Date(body.maintenanceDate) : new Date();
      if (Number.isNaN(maintenanceDate.getTime())) {
        return NextResponse.json({ message: 'Tanggal pemeliharaan tidak valid.' }, { status: 400 });
      }

      const cost = Math.max(0, Number(body?.cost ?? 0));
      if (!Number.isFinite(cost)) {
        return NextResponse.json({ message: 'Biaya pemeliharaan tidak valid.' }, { status: 400 });
      }

      const created = await prisma.assetMaintenance.create({
        data: {
          workspaceId,
          assetId,
          maintenanceDate,
          type: (body?.type || 'PREVENTIVE') as any,
          description,
          cost: new Prisma.Decimal(cost),
          vendor: body?.vendor ? String(body.vendor).trim() : null,
          performedBy: body?.performedBy ? String(body.performedBy).trim() : null,
          nextMaintenanceDate: body?.nextMaintenanceDate
            ? new Date(body.nextMaintenanceDate)
            : null,
          notes: body?.notes ? String(body.notes).trim() : null,
          receiptUrl: body?.receiptUrl ? String(body.receiptUrl).trim() : null,
          sourceFileId: body?.sourceFileId || null,
          createdBy: auth.user.id,
        },
        include: {
          asset: { select: { id: true, assetCode: true, name: true } },
        },
      });

      return NextResponse.json(
        {
          success: true,
          data: serializeMaintenance(created),
          message: `Pemeliharaan ${asset.name} berhasil dicatat.`,
        },
        { status: 201 }
      );
    } catch (err) {
      console.error('[Asset Maintenance POST]', err);
      return NextResponse.json(
        { message: publicApiError('Pemeliharaan gagal disimpan.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);
