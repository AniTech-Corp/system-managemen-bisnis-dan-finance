import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { serializeAsset } from '@/lib/assets/service';

/**
 * Mutasi aset (pindah lokasi / penanggung jawab / divisi).
 *  POST /api/v1/assets/[id]/transfer
 *
 * Menyimpan riwayat mutasi lalu memperbarui data aset saat ini.
 */
export const POST = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      const workspaceId = auth.workspace.id;
      const body = await req.json();

      const asset = await prisma.asset.findFirst({ where: { id, workspaceId } });
      if (!asset) {
        return NextResponse.json({ message: 'Aset tidak ditemukan.' }, { status: 404 });
      }
      if (asset.status === 'DISPOSED' || asset.status === 'SOLD') {
        return NextResponse.json(
          { message: 'Aset yang sudah dilepas tidak bisa dimutasi.' },
          { status: 400 }
        );
      }

      const transferDate = body?.transferDate ? new Date(body.transferDate) : new Date();
      if (Number.isNaN(transferDate.getTime())) {
        return NextResponse.json({ message: 'Tanggal mutasi tidak valid.' }, { status: 400 });
      }

      const toLocation = String(body?.toLocation ?? '').trim();
      const toCustodianId = body?.toCustodianId ? String(body.toCustodianId) : null;
      const toDepartment = body?.toDepartment ? String(body.toDepartment).trim() : null;

      if (!toLocation && !toCustodianId && !toDepartment) {
        return NextResponse.json(
          { message: 'Isi minimal satu tujuan mutasi: lokasi, penanggung jawab, atau divisi.' },
          { status: 400 }
        );
      }

      if (toCustodianId) {
        const custodian = await prisma.user.findUnique({
          where: { id: toCustodianId },
          select: { id: true },
        });
        if (!custodian) {
          return NextResponse.json({ message: 'Penanggung jawab tidak ditemukan.' }, { status: 404 });
        }
      }

      const result = await prisma.$transaction(async (tx) => {
        const transfer = await tx.assetTransfer.create({
          data: {
            workspaceId,
            assetId: asset.id,
            transferDate,
            fromLocation: asset.location,
            toLocation: toLocation || asset.location || '-',
            fromCustodianId: asset.custodianId,
            toCustodianId: toCustodianId ?? asset.custodianId,
            fromDepartment: asset.department,
            toDepartment: toDepartment ?? asset.department,
            reason: body?.reason ? String(body.reason).trim() : null,
            notes: body?.notes ? String(body.notes).trim() : null,
            createdBy: auth.user.id,
          },
        });

        const updated = await tx.asset.update({
          where: { id: asset.id },
          data: {
            location: toLocation || asset.location,
            custodianId: toCustodianId ?? asset.custodianId,
            department: toDepartment ?? asset.department,
            status: asset.status === 'DISPOSED' ? asset.status : 'ACTIVE',
            updatedBy: auth.user.id,
          },
          include: {
            category: true,
            custodian: { select: { id: true, fullName: true, email: true } },
          },
        });

        return { transfer, updated };
      });

      return NextResponse.json({
        success: true,
        data: serializeAsset(result.updated),
        transfer: result.transfer,
        message: 'Mutasi aset berhasil dicatat.',
      });
    } catch (err) {
      console.error('[Asset Transfer]', err);
      return NextResponse.json(
        { message: publicApiError('Mutasi aset gagal disimpan.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);
