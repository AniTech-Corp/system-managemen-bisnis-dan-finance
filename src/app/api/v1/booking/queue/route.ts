import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { QueueStatus } from '@prisma/client';
import { publicApiError } from '@/lib/api-error';
import { getWibDayRange } from '@/lib/time-series-engine';

// GET: Ambil status antrean tiket aktif
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;
      const { startDate: startOfToday, endDate: endOfToday } = getWibDayRange();
      const todayWhere = { workspaceId, createdAt: { gte: startOfToday, lte: endOfToday } };

      const tickets = await prisma.queueTicket.findMany({
        where: todayWhere,
        orderBy: { createdAt: 'asc' },
      });

      const waitingTickets = tickets.filter((t) => t.status === QueueStatus.WAITING);
      const currentlyServing = tickets.find((t) => t.status === QueueStatus.SERVING);
      const completedCount = tickets.filter((t) => t.status === QueueStatus.COMPLETED).length;

      return NextResponse.json({
        summary: {
          totalTicketsToday: tickets.length,
          waitingCount: waitingTickets.length,
          currentlyServingNumber: currentlyServing?.queueNumber || 'Belum Ada',
          currentlyServingName: currentlyServing?.customerName || '-',
          completedCount,
        },
        waitingTickets,
        currentlyServing,
        allTickets: tickets,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat antrean hari ini.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Ambil Nomor Antrean Baru
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { customerName, serviceType = 'Layanan Umum' } = await req.json();

      if (!customerName || !customerName.trim()) {
        return NextResponse.json({ message: 'Nama pelanggan wajib diisi.' }, { status: 400 });
      }

      const workspaceId = auth.workspace.id;
      const { startDate: startOfToday, endDate: endOfToday } = getWibDayRange();

      // Hitung total tiket hari ini untuk urutan nomor antrean
      const todayCount = await prisma.queueTicket.count({
        where: { workspaceId, createdAt: { gte: startOfToday, lte: endOfToday } },
      });

      const nextNumberSeq = (todayCount + 1).toString().padStart(3, '0');
      const queueNumber = `A-${nextNumberSeq}`;
      const estimatedWaitMinutes = todayCount * 15; // Estimasi 15 menit per antrean

      const ticket = await prisma.queueTicket.create({
        data: {
          workspaceId,
          queueNumber,
          customerName: customerName.trim(),
          serviceType: serviceType.trim(),
          status: QueueStatus.WAITING,
          estimatedWaitMinutes: estimatedWaitMinutes || 10,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Tiket antrean #${ticket.queueNumber} untuk ${ticket.customerName} berhasil dicetak!`,
        ticket,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Nomor antrean gagal dibuat.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// PUT: Panggil Antrean / Update Status Tiket
export const PUT = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { ticketId, status } = await req.json();

      if (!ticketId || !status) {
        return NextResponse.json({ message: 'Ticket ID dan status baru wajib diisi.' }, { status: 400 });
      }

      if (!Object.values(QueueStatus).includes(status as QueueStatus)) {
        return NextResponse.json({ message: 'Status antrean tidak valid.' }, { status: 400 });
      }

      // FIX (audit workflow, sesi ini): dulu langsung update by id tanpa cek kepemilikan
      // workspace -- IDOR cross-tenant, siapapun yang tahu/menebak ticketId tenant lain
      // bisa mengubah statusnya. Pola pengecekan disamakan dengan reservations/route.ts
      // PUT (baris 109-115) yang sudah benar dari awal.
      const existingTicket = await prisma.queueTicket.findUnique({
        where: { id: ticketId },
      });

      if (!existingTicket || existingTicket.workspaceId !== auth.workspace.id) {
        return NextResponse.json({ message: 'Data tiket antrean tidak ditemukan.' }, { status: 404 });
      }

      const updated = await prisma.queueTicket.updateMany({
        where: { id: ticketId, workspaceId: auth.workspace.id },
        data: { status: status as QueueStatus },
      });
      if (updated.count !== 1) {
        return NextResponse.json({ message: 'Data tiket antrean tidak ditemukan.' }, { status: 404 });
      }
      const ticket = await prisma.queueTicket.findFirst({
        where: { id: ticketId, workspaceId: auth.workspace.id },
      });
      if (!ticket) {
        return NextResponse.json({ message: 'Data tiket antrean tidak ditemukan.' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Tiket antrean #${ticket.queueNumber} statusnya diperbarui menjadi ${status}.`,
        ticket,
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Status antrean gagal diperbarui.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
