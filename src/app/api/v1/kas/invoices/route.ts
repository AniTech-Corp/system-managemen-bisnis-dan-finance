import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withTenantGuard } from '@/lib/tenant-guard';
import { InvoiceStatus, TransactionType } from '@prisma/client';
import { encryptField, decryptFields } from '@/lib/crypto';
import { publicApiError } from '@/lib/api-error';

// V4f, 8 Sep 2026 (validasi ringan input keuangan -- kasus Pak Fajrul): cek
// tanggal masuk akal untuk bisnis (bukan validasi generik Date.parse). DIDUPLIKASI
// inline persis sama di kas/transactions/route.ts (bukan diekstrak ke lib
// terpisah) -- konsisten gaya validasi inline (Number(amount)<=0) yang SUDAH ada
// di kedua route ini, menghindari coupling lintas-file untuk 1 fungsi kecil.
function checkBusinessDate(raw: string, label: string): string | null {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return `Format ${label} tidak valid.`;
  const now = Date.now();
  if (d.getTime() - now > 365 * 24 * 3600 * 1000) return `${label} tidak boleh lebih dari 1 tahun ke depan.`;
  if (d.getFullYear() < 2000) return `${label} tidak boleh sebelum tahun 2000.`;
  return null;
}

// GET: Ambil daftar invoice digital
export const GET = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const workspaceId = auth.workspace.id;

      const [invoices, totalInvoices, statusAggregates] = await Promise.all([
        // The list is paginated/capped for response size; KPI aggregation below
        // intentionally never reuses this page.
        prisma.invoice.findMany({
          where: { workspaceId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.invoice.count({ where: { workspaceId } }),
        prisma.invoice.groupBy({
          by: ['status'],
          where: { workspaceId },
          _sum: { totalAmount: true },
        }),
      ]);

      let totalPaid = 0;
      let totalUnpaid = 0;
      for (const aggregate of statusAggregates) {
        if (aggregate.status === InvoiceStatus.PAID) totalPaid = aggregate._sum.totalAmount || 0;
        if (aggregate.status === InvoiceStatus.UNPAID) totalUnpaid = aggregate._sum.totalAmount || 0;
      }

      return NextResponse.json({
        summary: {
          totalInvoices,
          totalPaid,
          totalUnpaid,
        },
        invoices: invoices.map((inv) => decryptFields(inv, ['clientEmail', 'clientPhone'])),
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Gagal memuat data invoice. Coba lagi beberapa saat.') }, { status: 500 });
    }
  },
  { minRole: 'VIEWER' }
);

// POST: Terbitkan Invoice Digital Baru (Ber-QRIS & Virtual Account)
export const POST = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { clientName, clientEmail, clientPhone, items = [], taxRate = 0, dueDate, notes } = await req.json();

      if (!clientName || !items.length) {
        return NextResponse.json({ message: 'Nama klien dan minimal 1 item tagihan wajib diisi.' }, { status: 400 });
      }

      // V4f, 8 Sep 2026 -- nama klien bukan angka semua (kemungkinan salah ketik/
      // kolom tertukar, kasus nyata yang disinggung Pak Fajrul).
      if (/^\d+$/.test(String(clientName).trim())) {
        return NextResponse.json({ message: 'Nama klien tidak boleh berupa angka semua -- sepertinya salah ketik.' }, { status: 400 });
      }

      // V4f, 8 Sep 2026 -- harga NEGATIF ditolak (bukan `<=0`: harga 0 tetap SAH
      // untuk item bonus/gratis, lihat perhitungan subtotal di bawah yang
      // menerima itu apa adanya hari ini -- HARAM regresi pola input lama yang
      // sudah sah). Qty tetap ditolak di <=0 karena qty 0/negatif memang tidak
      // masuk akal secara bisnis untuk item tagihan apapun.
      for (const item of items) {
        const price = Number(item.price);
        const qty = Number(item.qty);
        if (Number.isFinite(price) && price < 0) {
          return NextResponse.json({ message: `Harga item "${item.name || item.description || 'tanpa nama'}" tidak boleh negatif.` }, { status: 400 });
        }
        if (item.qty !== undefined && Number.isFinite(qty) && qty <= 0) {
          return NextResponse.json({ message: `Jumlah (qty) item "${item.name || item.description || 'tanpa nama'}" harus lebih besar dari 0.` }, { status: 400 });
        }
      }

      // V4f, 8 Sep 2026 -- tanggal jatuh tempo dicek HANYA kalau diisi (kosong
      // tetap pakai default +7 hari existing di bawah, yang selalu valid).
      if (dueDate) {
        const dueDateError = checkBusinessDate(dueDate, 'Tanggal jatuh tempo');
        if (dueDateError) {
          return NextResponse.json({ message: dueDateError }, { status: 400 });
        }
      }

      // Hitung subtotal & total
      let subtotal = 0;
      for (const item of items) {
        subtotal += (Number(item.price) || 0) * (Number(item.qty) || 1);
      }

      const calculatedTaxRate = Number(taxRate) || 0;
      const taxAmount = (subtotal * calculatedTaxRate) / 100;
      const totalAmount = subtotal + taxAmount;

      // Generate invoice number unik: INV-YYYYMMDD-XXXX
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const invoiceNumber = `INV-${dateStr}-${randomSuffix}`;

      // Simulasi String QRIS Standar BI & VA Mandiri/BCA
      const qrisString = `00020101021226580016ID.CO.ANITECH.WWW011893600002011${invoiceNumber}520458125303360540${totalAmount}5802ID5914${clientName.slice(0, 14)}6007JAKARTA6304`;
      const virtualAccount = `8808${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      const invoice = await prisma.invoice.create({
        data: {
          workspaceId: auth.workspace.id,
          userId: auth.user.id,
          invoiceNumber,
          clientName,
          clientEmail: encryptField(clientEmail),
          clientPhone: encryptField(clientPhone),
          subtotal,
          taxRate: calculatedTaxRate,
          taxAmount,
          totalAmount,
          status: InvoiceStatus.UNPAID,
          dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 hari
          items,
          qrisString,
          virtualAccount,
          notes,
        },
      });

      return NextResponse.json({
        success: true,
        message: `Invoice #${invoiceNumber} berhasil diterbitkan!`,
        invoice: decryptFields(invoice, ['clientEmail', 'clientPhone']),
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Invoice gagal dibuat. Periksa data dan coba lagi.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);

// PUT: Update Status Invoice (Misal: Tandai LUNAS / PAID)
export const PUT = withTenantGuard(
  async (req: NextRequest, { auth }) => {
    try {
      const { invoiceId, status } = await req.json();

      if (!invoiceId || !status) {
        return NextResponse.json({ message: 'Invoice ID dan status baru wajib diisi.' }, { status: 400 });
      }

      if (!['DRAFT', 'UNPAID', 'PAID', 'CANCELLED', 'OVERDUE'].includes(status)) {
        return NextResponse.json({ message: 'Status invoice tidak valid.' }, { status: 400 });
      }

      const result = await prisma.$transaction(async (tx) => {
        const existingInvoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
        if (!existingInvoice || existingInvoice.workspaceId !== auth.workspace.id) return null;

        const shouldPostCash = status === 'PAID' && existingInvoice.status !== InvoiceStatus.PAID;
        const transition = await tx.invoice.updateMany({
          where: { id: invoiceId, workspaceId: auth.workspace.id, status: existingInvoice.status },
          data: {
            status: status as InvoiceStatus,
            paidAt: status === 'PAID' ? new Date() : null,
          },
        });

        // CAS: dua request bayar invoice yang sama hanya boleh memenangkan satu
        // transition. Request kedua membaca state terbaru dan tidak membuat kas
        // masuk duplicate.
        if (transition.count === 0) {
          const latest = await tx.invoice.findUnique({ where: { id: invoiceId } });
          return { invoice: latest, postedCash: false, alreadyPaid: latest?.status === InvoiceStatus.PAID };
        }

        if (shouldPostCash) {
          await tx.cashTransaction.create({
            data: {
              workspaceId: auth.workspace.id,
              userId: auth.user.id,
              type: TransactionType.INCOME,
              category: 'Pelunasan Invoice Digital',
              amount: existingInvoice.totalAmount,
              description: `Pelunasan Invoice #${existingInvoice.invoiceNumber} dari ${existingInvoice.clientName}`,
              paymentMethod: 'QRIS_VIRTUAL_ACCOUNT',
            },
          });
        }

        const updated = await tx.invoice.findUnique({ where: { id: invoiceId } });
        return { invoice: updated, postedCash: shouldPostCash, alreadyPaid: false };
      });

      if (!result) {
        return NextResponse.json({ message: 'Invoice tidak ditemukan dalam workspace ini.' }, { status: 404 });
      }
      if (!result.invoice) {
        return NextResponse.json({ message: 'Invoice tidak dapat dibaca setelah update.' }, { status: 409 });
      }

      const existingInvoice = result.invoice;
      const updatedInvoice = result.invoice;

      return NextResponse.json({
        success: true,
        message: result.alreadyPaid
          ? `Invoice #${existingInvoice.invoiceNumber} sudah berstatus PAID; transaksi kas tidak digandakan.`
          : `Invoice #${existingInvoice.invoiceNumber} berhasil diupdate ke status ${status}.`,
        invoice: decryptFields(updatedInvoice, ['clientEmail', 'clientPhone']),
      });
    } catch (err: any) {
      return NextResponse.json({ message: publicApiError('Status invoice gagal diperbarui. Coba lagi beberapa saat.') }, { status: 400 });
    }
  },
  { minRole: 'MEMBER' }
);
