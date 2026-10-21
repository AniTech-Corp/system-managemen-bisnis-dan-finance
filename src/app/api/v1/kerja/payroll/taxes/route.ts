import { NextRequest, NextResponse } from 'next/server';
import { JournalStatus, Prisma, TransactionType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { publicApiError } from '@/lib/api-error';
import { recordCashTransaction } from '@/lib/accounting/posting';
import { toMoney } from '@/lib/accounting/money';

/**
 * Setoran kewajiban payroll (PPh 21 & BPJS).
 *
 * GET  → saldo utang PPh 21 (2-1320), BPJS (2-1340), potongan lain (2-1350)
 * POST → catat uang keluar yang MELUNASI utang tersebut:
 *
 *   Dr  PPh 21 / Utang BPJS / Utang Karyawan
 *       Cr  Kas
 *
 * Bukan beban baru — bebannya sudah diakui saat slip gaji dibuat.
 */

const TYPES = {
  PPH21: { code: '2-1320', label: 'Setoran PPh 21' },
  BPJS: { code: '2-1340', label: 'Setoran BPJS' },
  OTHER: { code: '2-1350', label: 'Setoran potongan karyawan' },
} as const;

type TaxType = keyof typeof TYPES;

function isTaxType(value: unknown): value is TaxType {
  return typeof value === 'string' && value in TYPES;
}

async function outstandingFor(
  workspaceId: string,
  accountCode: string,
  asOf?: Date
): Promise<Prisma.Decimal> {
  const lines = await prisma.journalLine.findMany({
    where: {
      workspaceId,
      account: { code: accountCode },
      entry: {
        status: JournalStatus.POSTED,
        ...(asOf ? { entryDate: { lte: asOf } } : {}),
      },
    },
    select: { debit: true, credit: true },
  });

  // Liabilitas bertambah di kredit dan berkurang di debit.
  return lines.reduce((acc, l) => acc.plus(l.credit).minus(l.debit), new Prisma.Decimal(0));
}

export const GET = withTenantGuard(
  async (_req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const asOf = new Date();
      // Saldo kewajiban = seluruh jurnal POSTED (termasuk slip bertanggal
      // maju), karena yang ditagih adalah total yang belum disetor.
      const [pph21, bpjs, other] = await Promise.all([
        outstandingFor(workspaceId, TYPES.PPH21.code),
        outstandingFor(workspaceId, TYPES.BPJS.code),
        outstandingFor(workspaceId, TYPES.OTHER.code),
      ]);

      return NextResponse.json({
        success: true,
        data: {
          asOf,
          pph21: { accountCode: TYPES.PPH21.code, outstanding: pph21 },
          bpjs: { accountCode: TYPES.BPJS.code, outstanding: bpjs },
          other: { accountCode: TYPES.OTHER.code, outstanding: other },
          total: pph21.plus(bpjs).plus(other),
        },
      });
    } catch (err: any) {
      return NextResponse.json(
        { message: publicApiError('Gagal memuat kewajiban pajak payroll.') },
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
      const type = body?.type;
      if (!isTaxType(type)) {
        return NextResponse.json(
          { message: 'Jenis setoran harus PPH21, BPJS, atau OTHER.' },
          { status: 400 }
        );
      }

      let paymentDate = new Date();
      if (body?.paymentDate) {
        paymentDate = new Date(String(body.paymentDate));
        if (Number.isNaN(paymentDate.getTime())) {
          return NextResponse.json({ message: 'Tanggal setoran tidak valid.' }, { status: 400 });
        }
      }
      paymentDate.setHours(23, 59, 59, 999);

      const workspaceId = auth.workspace.id;
      const account = await prisma.account.findFirst({
        where: { workspaceId, code: TYPES[type].code },
        select: { id: true, name: true },
      });
      if (!account) {
        return NextResponse.json(
          { message: `Akun ${TYPES[type].code} belum ada. Siapkan ulang bagan akun di Pengaturan.` },
          { status: 400 }
        );
      }

      const outstanding = await outstandingFor(workspaceId, TYPES[type].code, paymentDate);
      if (outstanding.lte(0)) {
        return NextResponse.json(
          { message: `Tidak ada kewajiban ${account.name} yang perlu disetor.` },
          { status: 400 }
        );
      }

      const requested = body?.amount === undefined || body?.amount === null ? outstanding : toMoney(body.amount);
      if (requested.lte(0)) {
        return NextResponse.json({ message: 'Nominal setoran harus lebih dari 0.' }, { status: 400 });
      }
      if (requested.gt(outstanding)) {
        return NextResponse.json(
          {
            message: `Nominal setoran melebihi kewajiban ${account.name} (${outstanding.toFixed(2)}).`,
          },
          { status: 400 }
        );
      }

      const method =
        typeof body?.paymentMethod === 'string' && body.paymentMethod.trim()
          ? body.paymentMethod.trim().slice(0, 50)
          : 'TRANSFER_BANK';

      const recorded = await prisma.$transaction((tx) =>
        recordCashTransaction(tx, {
          workspaceId,
          userId: auth.user.id,
          type: TransactionType.EXPENSE,
          category: TYPES[type].label,
          amount: requested,
          description: `${TYPES[type].label} (${account.name})`,
          paymentMethod: method,
          transactionDate: paymentDate,
          settlementAccountId: account.id,
        })
      );

      return NextResponse.json({
        success: true,
        message: `${TYPES[type].label} Rp ${requested.toFixed(2)} berhasil dicatat.`,
        journalNumber: recorded.journal?.entryNumber ?? null,
        amount: requested,
        remaining: outstanding.minus(requested),
      });
    } catch (err: any) {
      return NextResponse.json(
        { message: publicApiError('Setoran pajak payroll gagal diproses.') },
        { status: 400 }
      );
    }
  },
  { minRole: 'MANAGER' }
);
