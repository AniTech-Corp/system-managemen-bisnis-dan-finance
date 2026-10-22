import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { decimalToNumber, serializeAsset } from '@/lib/assets/service';
import { postImpairmentInTx } from '@/lib/assets/posting';
import { PeriodClosedError } from '@/lib/accounting/period';

/**
 * Penurunan nilai aset (impairment).
 *  POST /api/v1/assets/[id]/impair
 *
 * Nilai yang dapat dipulihkan lebih kecil dari nilai buku -> selisihnya diakui
 * sebagai kerugian penurunan nilai dan dijurnal (bila akuntansi aktif).
 */
const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

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
          { message: 'Aset yang sudah dilepas tidak bisa diturunkan nilainya.' },
          { status: 400 }
        );
      }

      const impairmentDate = body?.impairmentDate ? new Date(body.impairmentDate) : new Date();
      if (Number.isNaN(impairmentDate.getTime())) {
        return NextResponse.json({ message: 'Tanggal penurunan nilai tidak valid.' }, { status: 400 });
      }

      const recoverableAmount = Number(body?.recoverableAmount ?? 0);
      if (!Number.isFinite(recoverableAmount) || recoverableAmount < 0) {
        return NextResponse.json(
          { message: 'Nilai yang dapat dipulihkan harus angka dan tidak negatif.' },
          { status: 400 }
        );
      }

      const cost = decimalToNumber(asset.acquisitionCost);
      const accumulated = decimalToNumber(asset.accumulatedDepreciation);
      const previousImpairment = decimalToNumber(asset.accumulatedImpairment);
      const carrying = round2(Math.max(0, cost - accumulated - previousImpairment));
      const loss = round2(carrying - recoverableAmount);

      if (loss <= 0) {
        return NextResponse.json(
          {
            message: `Nilai yang dapat dipulihkan (Rp ${recoverableAmount.toLocaleString(
              'id-ID'
            )}) tidak lebih kecil dari nilai buku (Rp ${carrying.toLocaleString('id-ID')}). Tidak ada penurunan nilai.`,
          },
          { status: 400 }
        );
      }

      const description =
        String(body?.description ?? '').trim() ||
        `Penurunan nilai aset ${asset.name} menjadi Rp ${recoverableAmount.toLocaleString('id-ID')}.`;

      const result = await prisma.$transaction(async (tx) => {
        const impairment = await tx.assetImpairment.create({
          data: {
            workspaceId,
            assetId: asset.id,
            impairmentDate,
            recoverableAmount: new Prisma.Decimal(recoverableAmount),
            carryingAmount: new Prisma.Decimal(carrying),
            impairmentLoss: new Prisma.Decimal(loss),
            description,
            createdBy: auth.user.id,
          },
        });

        const journal = await postImpairmentInTx(tx, {
          workspaceId,
          userId: auth.user.id,
          asset,
          impairmentId: impairment.id,
          entryDate: impairmentDate,
          loss,
        });

        const savedImpairment = await tx.assetImpairment.update({
          where: { id: impairment.id },
          data: {
            journalEntryId: journal?.id ?? null,
            isPosted: Boolean(journal),
          },
        });

        const updated = await tx.asset.update({
          where: { id: asset.id },
          data: {
            accumulatedImpairment: new Prisma.Decimal(round2(previousImpairment + loss)),
            status: asset.status === 'ACTIVE' ? 'IMPAIRED' : asset.status,
            updatedBy: auth.user.id,
          },
          include: {
            category: true,
            custodian: { select: { id: true, fullName: true, email: true } },
          },
        });

        return { savedImpairment, journal, updated };
      });

      return NextResponse.json({
        success: true,
        data: serializeAsset(result.updated),
        impairment: {
          ...result.savedImpairment,
          recoverableAmount,
          carryingAmount: carrying,
          impairmentLoss: loss,
        },
        journal: result.journal
          ? { id: result.journal.id, entryNumber: result.journal.entryNumber }
          : null,
        message: `Penurunan nilai Rp ${loss.toLocaleString('id-ID')} berhasil dicatat.`,
      });
    } catch (err) {
      console.error('[Asset Impair]', err);
      if (err instanceof PeriodClosedError) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
      return NextResponse.json(
        { message: publicApiError('Penurunan nilai aset gagal disimpan.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MEMBER' }
);
