import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { decimalToNumber } from '@/lib/assets/service';

/**
 * Ubah / hapus catatan pemeliharaan aset.
 *  PATCH  /api/v1/assets/maintenance/[id]
 *  DELETE /api/v1/assets/maintenance/[id]
 */

export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      const workspaceId = auth.workspace.id;

      const existing = await prisma.assetMaintenance.findFirst({ where: { id, workspaceId } });
      if (!existing) {
        return NextResponse.json({ message: 'Catatan pemeliharaan tidak ditemukan.' }, { status: 404 });
      }

      const body = await req.json();
      const data: Prisma.AssetMaintenanceUpdateInput = {};

      if (body?.description !== undefined) {
        const description = String(body.description).trim();
        if (!description) {
          return NextResponse.json({ message: 'Deskripsi pemeliharaan tidak boleh kosong.' }, { status: 400 });
        }
        data.description = description;
      }
      if (body?.maintenanceDate !== undefined) {
        const parsed = new Date(body.maintenanceDate);
        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json({ message: 'Tanggal pemeliharaan tidak valid.' }, { status: 400 });
        }
        data.maintenanceDate = parsed;
      }
      if (body?.type !== undefined) data.type = String(body.type) as any;
      if (body?.cost !== undefined) data.cost = new Prisma.Decimal(Math.max(0, Number(body.cost) || 0));
      if (body?.vendor !== undefined) data.vendor = body.vendor ? String(body.vendor).trim() : null;
      if (body?.performedBy !== undefined) {
        data.performedBy = body.performedBy ? String(body.performedBy).trim() : null;
      }
      if (body?.nextMaintenanceDate !== undefined) {
        data.nextMaintenanceDate = body.nextMaintenanceDate ? new Date(body.nextMaintenanceDate) : null;
      }
      if (body?.notes !== undefined) data.notes = body.notes ? String(body.notes).trim() : null;
      if (body?.receiptUrl !== undefined) {
        data.receiptUrl = body.receiptUrl ? String(body.receiptUrl).trim() : null;
      }

      const updated = await prisma.assetMaintenance.update({ where: { id }, data });
      return NextResponse.json({
        success: true,
        data: { ...updated, cost: decimalToNumber(updated.cost) },
        message: 'Catatan pemeliharaan diperbarui.',
      });
    } catch (err) {
      console.error('[Asset Maintenance PATCH]', err);
      return NextResponse.json(
        { message: publicApiError('Catatan pemeliharaan gagal diperbarui.') },
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

      const existing = await prisma.assetMaintenance.findFirst({
        where: { id, workspaceId },
        select: { id: true },
      });
      if (!existing) {
        return NextResponse.json({ message: 'Catatan pemeliharaan tidak ditemukan.' }, { status: 404 });
      }

      await prisma.assetMaintenance.delete({ where: { id } });
      return NextResponse.json({ success: true, message: 'Catatan pemeliharaan dihapus.' });
    } catch (err) {
      console.error('[Asset Maintenance DELETE]', err);
      return NextResponse.json(
        { message: publicApiError('Catatan pemeliharaan gagal dihapus.') },
        { status: 500 }
      );
    }
  },
  { minRole: 'MEMBER' }
);
