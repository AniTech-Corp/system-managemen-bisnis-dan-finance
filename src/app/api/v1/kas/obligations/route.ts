import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { JournalSource, ObligationStatus, TransactionType } from '@prisma/client';
import {
  OBLIGATION_SETTLEMENT_CATEGORY,
  postCashTransaction,
  postObligationIssuedInTx,
} from '@/lib/accounting/posting';
import { JournalValidationError, reverseJournalBySourceInTx } from '@/lib/accounting/journal-service';
import { PeriodClosedError } from '@/lib/accounting/period';

// Roadmap 7 Sep, item 4.8 -- widget "Kewajiban Terjadwal" di FinanceModuleView.tsx
// (upcomingDues14/upcomingDues30) hardcode array kosong, tidak pernah fetch.
// Model Invoice yang ada adalah PIUTANG (uang masuk); ini untuk KEWAJIBAN (uang
// keluar terjadwal) -- konsep beda, endpoint terpisah, pola sama seperti
// /api/v1/kas/invoices (withTenantGuard, workspaceId dari auth).
//
// Sejak integrasi AP: mencatat kewajiban = mengakui beban (Dr Beban / Cr Utang),
// menandai lunas = melunasi utang (Dr Utang / Cr Kas). Jadi beban hanya dihitung
// sekali. Kalau modul laporan keuangan belum aktif, keduanya tidak menjurnal.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(raw: unknown, label: string): Date {
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    throw new JournalValidationError(`${label} tidak valid.`);
  }
  return date;
}

// GET: Ambil kewajiban terjadwal, dipecah 14 hari / 30 hari ke depan
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const targetWsId = auth.workspace.id;

      const obligations = await prisma.scheduledObligation.findMany({
        where: { workspaceId: targetWsId, status: ObligationStatus.PENDING },
        orderBy: { dueDate: 'asc' },
      });

      const now = new Date();
      const map = (o: (typeof obligations)[number]) => ({
        id: o.id,
        name: o.name,
        day: o.dueDate.getDate(),
        mon: o.dueDate.toLocaleDateString('id-ID', { month: 'short' }),
        amount: o.amount,
        category: o.category,
        status: o.status,
        dueDate: o.dueDate.toISOString(),
        dueDateRaw: o.dueDate.toISOString(),
      });

      const within = (days: number) =>
        obligations
          .filter((o) => {
            const diffDays = Math.ceil((o.dueDate.getTime() - now.getTime()) / MS_PER_DAY);
            return diffDays >= 0 && diffDays <= days;
          })
          .map(map);

      return NextResponse.json({
        upcomingDues14: within(14),
        upcomingDues30: within(30),
        all: obligations.map(map),
      });
    } catch (err: any) {
      console.error('[kas/obligations] GET error:', err);
      return NextResponse.json({ message: 'Gagal mengambil kewajiban terjadwal.' }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Catat kewajiban terjadwal baru (sekaligus mengakui bebannya)
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { name, dueDate, amount, category, accrualDate } = await req.json();

      if (!name || !dueDate || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json(
          { message: 'Nama, tanggal jatuh tempo, dan nominal (angka > 0) wajib diisi.' },
          { status: 400 }
        );
      }

      const parsedDate = parseDate(dueDate, 'Tanggal jatuh tempo');
      // Opsional: tanggal pengakuan beban (mis. mencatat tagihan bulan lalu).
      // Default hari ini, karena beban diakui saat kewajiban dicatat.
      const entryDate = accrualDate ? parseDate(accrualDate, 'Tanggal pengakuan') : undefined;
      const targetWsId = auth.workspace.id;

      const result = await prisma.$transaction(async (tx) => {
        const obligation = await tx.scheduledObligation.create({
          data: {
            workspaceId: targetWsId,
            name: String(name).trim().slice(0, 150),
            dueDate: parsedDate,
            amount: Number(amount),
            category: category ? String(category).trim().slice(0, 100) : null,
          },
        });

        // Basis akrual: beban diakui saat kewajiban timbul, bukan saat dibayar.
        const journal = await postObligationIssuedInTx(tx, {
          workspaceId: targetWsId,
          userId: auth.user.id,
          obligation,
          entryDate,
        });

        return { obligation, journal };
      });

      return NextResponse.json({
        success: true,
        obligation: result.obligation,
        journalNumber: result.journal?.entryNumber ?? null,
      });
    } catch (err: any) {
      if (err instanceof JournalValidationError || err instanceof PeriodClosedError) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
      console.error('[kas/obligations] POST error:', err);
      return NextResponse.json({ message: 'Gagal mencatat kewajiban.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// PATCH: Ubah status kewajiban (lunas / batal / kembalikan ke pending)
export const PATCH = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { id, status, paidAt, paymentMethod } = await req.json();

      if (!id || !status) {
        return NextResponse.json({ message: 'ID dan status kewajiban wajib diisi.' }, { status: 400 });
      }
      if (!['PENDING', 'PAID', 'CANCELLED'].includes(status)) {
        return NextResponse.json({ message: 'Status kewajiban tidak valid.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;
      const userId = auth.user.id;

      const updated = await prisma.$transaction(async (tx) => {
        const obligation = await tx.scheduledObligation.findFirst({ where: { id, workspaceId } });
        if (!obligation) throw new JournalValidationError('Kewajiban tidak ditemukan.');

        const paymentDate = paidAt ? parseDate(paidAt, 'Tanggal pembayaran') : new Date();
        const method = paymentMethod ? String(paymentMethod).trim().slice(0, 50) : 'TRANSFER_BANK';

        // PENDING -> PAID: uang keluar, utang berkurang. Beban TIDAK ditambah.
        if (status === 'PAID' && obligation.status !== ObligationStatus.PAID) {
          if (obligation.status === ObligationStatus.CANCELLED) {
            throw new JournalValidationError('Kewajiban yang sudah dibatalkan tidak bisa dibayar.');
          }

          const settlement = await tx.cashTransaction.create({
            data: {
              workspaceId,
              userId,
              type: TransactionType.EXPENSE,
              category: OBLIGATION_SETTLEMENT_CATEGORY,
              amount: obligation.amount,
              description: `Pembayaran kewajiban ${obligation.name}`,
              paymentMethod: method,
              transactionDate: paymentDate,
              obligationId: obligation.id,
            },
          });

          await postCashTransaction(tx, { workspaceId, userId, transaction: settlement });

          return tx.scheduledObligation.update({
            where: { id: obligation.id },
            data: { status: ObligationStatus.PAID, paidAt: paymentDate, paymentMethod: method },
          });
        }

        // PAID -> PENDING: tarik pelunasan (jurnal dibalik, baris kas dihapus).
        if (status === 'PENDING' && obligation.status === ObligationStatus.PAID) {
          const settlements = await tx.cashTransaction.findMany({
            where: { workspaceId, obligationId: obligation.id },
            select: { id: true },
          });
          for (const row of settlements) {
            await reverseJournalBySourceInTx(
              tx,
              workspaceId,
              userId,
              JournalSource.CASH_TX,
              row.id,
              `Pelunasan kewajiban ${obligation.name} dibatalkan`
            );
            await tx.cashTransaction.delete({ where: { id: row.id } });
          }

          return tx.scheduledObligation.update({
            where: { id: obligation.id },
            data: { status: ObligationStatus.PENDING, paidAt: null, paymentMethod: null },
          });
        }

        // -> CANCELLED: bebannya dibatalkan lewat jurnal pembalik.
        if (status === 'CANCELLED' && obligation.status !== ObligationStatus.CANCELLED) {
          if (obligation.status === ObligationStatus.PAID) {
            throw new JournalValidationError(
              'Kewajiban sudah dibayar. Batalkan pelunasan dulu, baru batalkan kewajibannya.'
            );
          }
          await reverseJournalBySourceInTx(
            tx,
            workspaceId,
            userId,
            JournalSource.OBLIGATION,
            obligation.id,
            `Kewajiban ${obligation.name} dibatalkan`
          );
          return tx.scheduledObligation.update({
            where: { id: obligation.id },
            data: { status: ObligationStatus.CANCELLED },
          });
        }

        // Status tidak berubah: tetap kembalikan data terbaru.
        return obligation;
      });

      return NextResponse.json({ success: true, obligation: updated });
    } catch (err: any) {
      if (err instanceof JournalValidationError || err instanceof PeriodClosedError) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
      console.error('[kas/obligations] PATCH error:', err);
      return NextResponse.json({ message: 'Gagal mengubah status kewajiban.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// DELETE: Hapus kewajiban (jurnal akrualnya dibalik lebih dulu)
export const DELETE = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const id = req.nextUrl.searchParams.get('id');
      if (!id) {
        return NextResponse.json({ message: 'ID kewajiban wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;

      await prisma.$transaction(async (tx) => {
        const obligation = await tx.scheduledObligation.findFirst({ where: { id, workspaceId } });
        if (!obligation) throw new JournalValidationError('Kewajiban tidak ditemukan.');

        if (obligation.status === ObligationStatus.PAID) {
          throw new JournalValidationError(
            'Kewajiban sudah dibayar. Batalkan pelunasan dulu sebelum menghapus.'
          );
        }

        // Jurnal aslinya tidak dihapus, hanya dibalik, supaya jejak audit tetap ada.
        await reverseJournalBySourceInTx(
          tx,
          workspaceId,
          auth.user.id,
          JournalSource.OBLIGATION,
          obligation.id,
          `Kewajiban ${obligation.name} dihapus`
        );
        await tx.scheduledObligation.delete({ where: { id: obligation.id } });
      });

      return NextResponse.json({ success: true });
    } catch (err: any) {
      if (err instanceof JournalValidationError || err instanceof PeriodClosedError) {
        return NextResponse.json({ message: err.message }, { status: 400 });
      }
      console.error('[kas/obligations] DELETE error:', err);
      return NextResponse.json({ message: 'Gagal menghapus kewajiban.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
