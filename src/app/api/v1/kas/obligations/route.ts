import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { ObligationStatus } from '@prisma/client';

// Roadmap 7 Sep, item 4.8 -- widget "Kewajiban Terjadwal" di FinanceModuleView.tsx
// (upcomingDues14/upcomingDues30) hardcode array kosong, tidak pernah fetch.
// Model Invoice yang ada adalah PIUTANG (uang masuk); ini untuk KEWAJIBAN (uang
// keluar terjadwal) -- konsep beda, endpoint terpisah, pola sama seperti
// /api/v1/kas/invoices (withTenantGuard, workspaceId dari auth).

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
        dueDate: o.dueDate.toISOString(),
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

// POST: Catat kewajiban terjadwal baru
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { name, dueDate, amount, category } = await req.json();

      if (!name || !dueDate || typeof amount !== 'number' || amount <= 0) {
        return NextResponse.json({ message: 'Nama, tanggal jatuh tempo, dan nominal (angka > 0) wajib diisi.' }, { status: 400 });
      }

      const parsedDate = new Date(dueDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ message: 'Tanggal jatuh tempo tidak valid.' }, { status: 400 });
      }

      const targetWsId = auth.workspace.id;

      const obligation = await prisma.scheduledObligation.create({
        data: {
          workspaceId: targetWsId,
          name: String(name).trim().slice(0, 150),
          dueDate: parsedDate,
          amount: Number(amount),
          category: category ? String(category).trim().slice(0, 100) : null,
        },
      });

      return NextResponse.json({ success: true, obligation });
    } catch (err: any) {
      console.error('[kas/obligations] POST error:', err);
      return NextResponse.json({ message: 'Gagal mencatat kewajiban.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// DELETE: Hapus atau tandai lunas kewajiban
export const DELETE = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const id = req.nextUrl.searchParams.get('id');
      if (!id) {
        return NextResponse.json({ message: 'ID kewajiban wajib diisi.' }, { status: 400 });
      }

      const targetWsId = auth.workspace.id;

      await prisma.scheduledObligation.delete({ where: { id, workspaceId: targetWsId } });

      return NextResponse.json({ success: true });
    } catch (err: any) {
      console.error('[kas/obligations] DELETE error:', err);
      return NextResponse.json({ message: 'Gagal menghapus kewajiban.' }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
