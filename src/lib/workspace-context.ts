import { prisma } from './prisma';

/**
 * Membangun konteks data perusahaan (workspace) yang akan disuntikkan ke prompt AI,
 * sehingga asisten bisa menjawab berdasarkan data riil (kas, piutang, tugas, booking, kredit).
 */
export async function buildWorkspaceContext(workspaceId: string): Promise<string> {
  try {
    const [workspace, credit, cashTx, invoices, tasks, bookings, memories] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: workspaceId }, include: { subscription: true } }),
      prisma.creditAccount.findUnique({ where: { workspaceId } }),
      prisma.cashTransaction.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 40 }),
      prisma.invoice.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.workTask.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.bookingReservation.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.memoryItem.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 10 }),
    ]);

    const parts: string[] = [];

    if (workspace) {
      // Nama workspace adalah nama internal akun, BUKAN profil perusahaan asli.
      parts.push(`Nama workspace (akun): ${workspace.name}`);
      if (workspace.subscription) parts.push(`Paket langganan: ${workspace.subscription.planType}`);
    }

    if (credit) {
      parts.push(`Kredit AI tersisa: ${credit.weeklyCredit} (mingguan) + ${credit.reserveCredit} (cadangan).`);
    }

    if (cashTx.length > 0) {
      const income = cashTx.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
      const expense = cashTx.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0);
      parts.push(
        `Kas (dari ${cashTx.length} transaksi): total pemasukan Rp ${income.toLocaleString('id-ID')}, total pengeluaran Rp ${expense.toLocaleString('id-ID')}, saldo bersih Rp ${(income - expense).toLocaleString('id-ID')}.`
      );
      const recent = cashTx
        .slice(0, 10)
        .map((t) => `- ${t.type === 'INCOME' ? 'Masuk' : 'Keluar'} Rp ${t.amount.toLocaleString('id-ID')} — ${t.category} (${t.description})`)
        .join('\n');
      parts.push(`Transaksi terakhir:\n${recent}`);
    } else {
      parts.push('Belum ada transaksi kas tercatat.');
    }

    const unpaid = invoices.filter((i) => i.status === 'UNPAID' || i.status === 'OVERDUE');
    if (invoices.length > 0) {
      parts.push(`Invoice: ${invoices.length} total, ${unpaid.length} belum dibayar.`);
      if (unpaid.length > 0) {
        const piutang = unpaid
          .map((i) => `- ${i.invoiceNumber} — ${i.clientName} — Rp ${i.totalAmount.toLocaleString('id-ID')} (${i.status})`)
          .join('\n');
        parts.push(`Piutang belum lunas:\n${piutang}`);
      }
    }

    if (tasks.length > 0) {
      const todo = tasks.filter((t) => t.status === 'TODO').length;
      const prog = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
      const done = tasks.filter((t) => t.status === 'DONE').length;
      parts.push(`Tugas tim: ${tasks.length} total (${todo} belum dikerjakan, ${prog} sedang, ${done} selesai).`);
      const recent = tasks
        .slice(0, 8)
        .map((t) => `- [${t.status}] ${t.title} (${t.assigneeName})`)
        .join('\n');
      parts.push(`Tugas terakhir:\n${recent}`);
    }

    if (bookings.length > 0) {
      const recent = bookings
        .slice(0, 8)
        .map((b) => `- ${b.bookingCode} — ${b.customerName} (${b.serviceName}) pada ${b.bookingDate.toISOString().slice(0, 10)} ${b.bookingTime} [${b.status}]`)
        .join('\n');
      parts.push(`Booking/reservasi terakhir:\n${recent}`);
    }

    if (memories.length > 0) {
      const memText = memories
        .map((m) => m.content)
        .filter(Boolean)
        .slice(0, 8)
        .join('; ');
      if (memText) parts.push(`Catatan/profil bisnis tersimpan: ${memText}`);
    }

    return parts.join('\n');
  } catch (err) {
    console.warn('[WorkspaceContext] Gagal membangun konteks:', err);
    return '';
  }
}
