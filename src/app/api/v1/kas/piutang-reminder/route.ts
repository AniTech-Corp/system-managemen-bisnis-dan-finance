import { NextRequest, NextResponse } from 'next/server';
import { publicApiError } from '@/lib/api-error';
import { withTenantGuard } from '@/lib/tenant-guard';
import { prisma } from '@/lib/prisma';

// Piutang Reminder -- pengingat WhatsApp untuk invoice yang sudah jatuh tempo.
// Pola link wa.me + normalisasi nomor 08xx->62xx ditiru PERSIS dari
// src/app/api/v1/booking/reminder/route.ts (termasuk fix nomor lokal). Beda
// sumber data saja: BookingReservation -> Invoice OVERDUE.
//
// Kenapa dua kondisi status di WHERE (bukan cuma status: 'OVERDUE'): status
// invoice di DB hanya berubah dari UNPAID -> OVERDUE lewat proses terpisah
// (cron/manual) yang belum tentu jalan tepat waktu. Supaya staff tetap lihat
// piutang yang sebenarnya sudah lewat jatuh tempo meski field status-nya
// belum sempat di-update, invoice UNPAID dengan dueDate < sekarang IKUT
// dianggap overdue untuk keperluan list & reminder ini (tidak mengubah data,
// hanya kriteria baca).
function overdueWhere(workspaceId: string) {
  return {
    workspaceId,
    OR: [
      { status: 'OVERDUE' as const },
      { status: 'UNPAID' as const, dueDate: { lt: new Date() } },
    ],
  };
}

import { normalizePhone } from '@/lib/validators';

function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const invoices = await prisma.invoice.findMany({
        where: overdueWhere(auth.workspace.id),
        orderBy: { dueDate: 'asc' },
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          clientPhone: true,
          totalAmount: true,
          dueDate: true,
          status: true,
        },
      });

      const today = new Date();
      const data = invoices.map((inv) => {
        const dueDate = new Date(inv.dueDate);
        const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)));
        return {
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.clientName,
          clientPhone: inv.clientPhone,
          hasPhone: !!inv.clientPhone,
          totalAmount: inv.totalAmount,
          dueDate: inv.dueDate,
          status: inv.status,
          daysOverdue,
        };
      });

      return NextResponse.json({ success: true, count: data.length, invoices: data });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat pengingat piutang.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { invoiceId } = await req.json();

      if (!invoiceId) {
        return NextResponse.json({ message: 'invoiceId wajib diisi.' }, { status: 400 });
      }

      const invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, workspaceId: auth.workspace.id },
        select: {
          id: true,
          invoiceNumber: true,
          clientName: true,
          clientPhone: true,
          totalAmount: true,
          dueDate: true,
          status: true,
        },
      });

      if (!invoice) {
        return NextResponse.json({ message: 'Invoice tidak ditemukan.' }, { status: 404 });
      }

      if (!invoice.clientPhone) {
        return NextResponse.json({ message: 'Invoice ini tidak punya nomor WhatsApp pelanggan.' }, { status: 400 });
      }

      const cleanPhone = normalizePhone(invoice.clientPhone);
      const formattedDueDate = new Date(invoice.dueDate).toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      const today = new Date();
      const dueDateOnly = new Date(invoice.dueDate);
      const daysOverdue = Math.max(0, Math.floor((today.getTime() - dueDateOnly.getTime()) / (1000 * 60 * 60 * 24)));

      const reminderMessage = `Halo Kak ${invoice.clientName}! 👋

Ini adalah pesan pengingat resmi mengenai tagihan Anda di *${auth.workspace.name}*:

🧾 *No. Invoice*: #${invoice.invoiceNumber}
💰 *Total Tagihan*: ${formatRupiah(invoice.totalAmount)}
📅 *Jatuh Tempo*: ${formattedDueDate}${daysOverdue > 0 ? `\n⚠️ *Sudah lewat ${daysOverdue} hari dari jatuh tempo*` : ''}

Mohon kesediaannya untuk segera melakukan pelunasan. Jika sudah melakukan pembayaran, mohon abaikan pesan ini atau balas dengan bukti transfer. Terima kasih atas kerja samanya! 🙏`;

      const directWaUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(reminderMessage)}`;

      return NextResponse.json({
        success: true,
        reminder: {
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          clientName: invoice.clientName,
          clientPhone: cleanPhone,
          reminderMessage,
          directWaUrl,
          sentBy: auth.user.fullName,
        },
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal menyimpan pengingat piutang.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);
