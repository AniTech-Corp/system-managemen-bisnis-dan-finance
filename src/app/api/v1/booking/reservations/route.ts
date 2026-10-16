import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { BookingStatus, TransactionType } from '@prisma/client';
import { encryptField, decryptFields } from '@/lib/crypto';
import { publicApiError } from '@/lib/api-error';

// GET: Ambil daftar reservasi booking
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;

      const reservations = await prisma.bookingReservation.findMany({
        where: { workspaceId },
        orderBy: { bookingDate: 'asc' },
      });

      const confirmedCount = reservations.filter((r) => r.status === BookingStatus.CONFIRMED).length;
      const completedCount = reservations.filter((r) => r.status === BookingStatus.COMPLETED).length;
      const totalRevenueBooked = reservations.reduce((acc, curr) => acc + curr.totalPrice, 0);

      return NextResponse.json({
        summary: {
          totalBookings: reservations.length,
          confirmedCount,
          completedCount,
          totalRevenueBooked,
        },
        reservations: reservations.map((r) => decryptFields(r, ['customerPhone', 'customerEmail'])),
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat data reservasi. Coba lagi beberapa saat.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Buat reservasi jadwal baru
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { customerName, customerPhone, customerEmail, serviceName, bookingDate, bookingTime = '14:00', durationMinutes = 60, totalPrice, depositAmount = 0, isDepositPaid = false, notes } = await req.json();

      if (!customerName || !customerPhone || !serviceName || !bookingDate || !totalPrice) {
        return NextResponse.json({ message: 'Nama, No WhatsApp, Layanan, Tanggal, dan Total Harga wajib diisi.' }, { status: 400 });
      }

      // Generate booking code unik: BKG-YYYYMMDD-XXXX
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const dateStr = new Date(bookingDate).toISOString().slice(0, 10).replace(/-/g, '');
      const bookingCode = `BKG-${dateStr}-${randomSuffix}`;

      const reservation = await prisma.$transaction(async (tx) => {
        const created = await tx.bookingReservation.create({
          data: {
            workspaceId: auth.workspace.id,
            bookingCode,
            customerName: customerName.trim(),
            customerPhone: encryptField(customerPhone.trim()) || customerPhone.trim(),
            customerEmail: encryptField(customerEmail?.trim()),
            serviceName: serviceName.trim(),
            bookingDate: new Date(bookingDate),
            bookingTime,
            durationMinutes: Number(durationMinutes) || 60,
            totalPrice: Number(totalPrice),
            depositAmount: Number(depositAmount) || 0,
            isDepositPaid: Boolean(isDepositPaid),
            status: isDepositPaid ? BookingStatus.CONFIRMED : BookingStatus.PENDING_DEPOSIT,
            notes: notes?.trim(),
          },
        });

        if (isDepositPaid && Number(depositAmount) > 0) {
          await tx.cashTransaction.create({
            data: {
              workspaceId: auth.workspace.id,
              userId: auth.user.id,
              type: TransactionType.INCOME,
              category: 'Deposit Reservasi Booking',
              amount: Number(depositAmount),
              description: `Uang Muka Reservasi #${bookingCode} (${created.customerName} - ${created.serviceName})`,
              paymentMethod: 'TRANSFER_BANK',
            },
          });
        }
        return created;
      });

      return NextResponse.json({
        success: true,
        message: `Reservasi #${bookingCode} untuk ${reservation.customerName} berhasil dibuat!`,
        reservation: decryptFields(reservation, ['customerPhone', 'customerEmail']),
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Reservasi gagal dibuat. Periksa data dan coba lagi.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// PUT: Perbarui status reservasi
export const PUT = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { reservationId, status, markDepositPaid = false } = await req.json();

      if (!reservationId || !status) {
        return NextResponse.json({ message: 'Reservation ID dan status baru wajib diisi.' }, { status: 400 });
      }

      const existingReservation = await prisma.bookingReservation.findUnique({
        where: { id: reservationId },
      });

      if (!existingReservation || existingReservation.workspaceId !== auth.workspace.id) {
        return NextResponse.json({ message: 'Data reservasi tidak ditemukan.' }, { status: 404 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const transition = await tx.bookingReservation.updateMany({
          where: { id: reservationId, workspaceId: auth.workspace.id, status: existingReservation.status },
          data: {
            status: status as BookingStatus,
            isDepositPaid: markDepositPaid ? true : existingReservation.isDepositPaid,
          },
        });

        if (transition.count === 0) {
          const latest = await tx.bookingReservation.findUnique({ where: { id: reservationId } });
          return { reservation: latest, postedCash: false, alreadyCompleted: latest?.status === BookingStatus.COMPLETED };
        }

        if (status === 'COMPLETED' && existingReservation.status !== 'COMPLETED') {
          const remainingAmount = existingReservation.totalPrice - (existingReservation.isDepositPaid ? existingReservation.depositAmount : 0);
          if (remainingAmount > 0) {
            await tx.cashTransaction.create({
              data: {
                workspaceId: auth.workspace.id,
                userId: auth.user.id,
                type: TransactionType.INCOME,
                category: 'Pelunasan Layanan Booking',
                amount: remainingAmount,
                description: `Pelunasan Layanan Reservasi #${existingReservation.bookingCode} (${existingReservation.customerName})`,
                paymentMethod: 'TRANSFER_BANK',
              },
            });
          }
        }

        const updated = await tx.bookingReservation.findUnique({ where: { id: reservationId } });
        return { reservation: updated, postedCash: true, alreadyCompleted: false };
      });

      if (!result.reservation) {
        return NextResponse.json({ message: 'Data reservasi tidak ditemukan.' }, { status: 404 });
      }
      const updatedReservation = result.reservation;

      return NextResponse.json({
        success: true,
        message: result.alreadyCompleted
          ? `Reservasi #${existingReservation.bookingCode} sudah COMPLETED; transaksi kas tidak digandakan.`
          : `Status reservasi #${existingReservation.bookingCode} diperbarui menjadi ${status}.`,
        reservation: decryptFields(updatedReservation, ['customerPhone', 'customerEmail']),
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Status reservasi gagal diperbarui. Coba lagi beberapa saat.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
