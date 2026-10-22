import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { decimalToNumber, serializeAsset } from '@/lib/assets/service';
import { postDisposalInTx } from '@/lib/assets/posting';
import { PeriodClosedError } from '@/lib/accounting/period';

/**
 * Pelepasan aset (dijual, dihapuskan, disumbangkan, dipindahkan).
 *  POST /api/v1/assets/[id]/dispose
 *
 * Menghitung laba/rugi pelepasan, membuat jurnal pelepasan (bila akuntansi
 * aktif), lalu menandai aset DISPOSED/SOLD.
 */

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export const POST = withTenantGuard(
  async (req: NextRequest, { auth, params }) => {
    try {
      const { id } = await (params as Promise<{ id: string }>);
      const workspaceId = auth.workspace.id;
      const body = await req.json();

      const asset = await prisma.asset.findFirst({
        where: { id, workspaceId },
        include: { impairmentRecords: true },
      });
      if (!asset) {
        return NextResponse.json({ message: 'Aset tidak ditemukan.' }, { status: 404 });
      }
      if (asset.status === 'DISPOSED' || asset.status === 'SOLD') {
        return NextResponse.json({ message: 'Aset ini sudah dilepas sebelumnya.' }, { status: 400 });
      }

      const method = String(body?.disposalMethod ?? 'SALE').toUpperCase();
      const allowedMethods = ['SALE', 'SCRAP', 'DONATION', 'TRANSFER', 'LOSS', 'WRITE_OFF'];
      if (!allowedMethods.includes(method)) {
        return NextResponse.json({ message: 'Metode pelepasan tidak valid.' }, { status: 400 });
      }

      const disposalDate = body?.disposalDate ? new Date(body.disposalDate) : new Date();
      if (Number.isNaN(disposalDate.getTime())) {
        return NextResponse.json({ message: 'Tanggal pelepasan tidak valid.' }, { status: 400 });
      }

      const proceeds = Math.max(0, Number(body?.disposalProceeds ?? 0));
      const cost = decimalToNumber(asset.acquisitionCost);
      const accumulated = decimalToNumber(asset.accumulatedDepreciation);
      const impairment = decimalToNumber(asset.accumulatedImpairment);
      const carrying = round2(Math.max(0, cost - accumulated - impairment));

      const result = await prisma.$transaction(async (tx) => {
        const disposalResult = await postDisposalInTx(tx, {
          workspaceId,
          userId: auth.user.id,
          asset,
          entryDate: disposalDate,
          acquisitionCost: cost,
          accumulatedDepreciation: accumulated,
          accumulatedImpairment: impairment,
          carryingAmount: carrying,
          proceeds,
          proceedsAccountId: body?.proceedsAccountId || null,
        });

        const updatedAsset = await tx.asset.update({
          where: { id: asset.id },
          data: {
            status: method === 'SALE' ? 'SOLD' : 'DISPOSED',
            disposalDate,
            disposalMethod: method as any,
            disposalProceeds: new Prisma.Decimal(proceeds),
            disposalGainLoss: new Prisma.Decimal(disposalResult.gainLoss),
            disposalNotes: body?.notes ? String(body.notes).trim() : null,
            updatedBy: auth.user.id,
          },
          include: {
            category: true,
            custodian: { select: { id: true, fullName: true, email: true } },
          },
        });

        return { updated: updatedAsset, ...disposalResult };
      });

      return NextResponse.json({
        success: true,
        data: serializeAsset(result.updated),
        journal: result.journal
          ? { id: result.journal.id, entryNumber: result.journal.entryNumber }
          : null,
        gainLoss: result.gainLoss,
        message:
          result.gainLoss >= 0
            ? `Aset dilepas dengan keuntungan Rp ${Math.abs(result.gainLoss).toLocaleString('id-ID')}.`
            : `Aset dilepas dengan kerugian Rp ${Math.abs(result.gainLoss).toLocaleString('id-ID')}.`,
      });
    } catch (err) {
      console.error('[Asset Dispose]', err);
      if (err instanceof PeriodClosedError) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
      return NextResponse.json(
        { message: publicApiError('Pelepasan aset gagal diproses. Periksa data dan coba lagi.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);
