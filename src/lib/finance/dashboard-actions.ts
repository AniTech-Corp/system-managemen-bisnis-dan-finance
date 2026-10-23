/**
 * Aturan tampilan aksi di dashboard finance live.
 *
 * Dipisah dari komponen React supaya bisa diuji tanpa DOM dan supaya tombol
 * koreksi/hapus kas serta batal/buka faktur memakai aturan yang sama dengan
 * guard di server. Server tetap menjadi penentu akhir; helper ini hanya
 * mencegah tombol yang jelas tidak relevan muncul.
 */

export interface CashTransactionLinks {
  invoiceId?: string | null;
  obligationId?: string | null;
  payrollId?: string | null;
  settlementAccountId?: string | null;
}

export function isLinkedCashTransaction(tx: CashTransactionLinks): boolean {
  return Boolean(tx.invoiceId || tx.obligationId || tx.payrollId || tx.settlementAccountId);
}

/** Koreksi in-place hanya untuk transaksi kas standalone. */
export function canCorrectCashTransaction(tx: CashTransactionLinks): boolean {
  return !isLinkedCashTransaction(tx);
}

export type InvoiceStatusTone = 'emerald' | 'red' | 'amber' | 'slate';

export interface InvoiceDashboardActionState {
  statusLabel: string;
  statusTone: InvoiceStatusTone;
  canSendReminder: boolean;
  canCancel: boolean;
  canReopen: boolean;
}

/**
 * Status `PAID`/`PARTIAL` dibuka lewat tombol "Buka Lunas" (bukan "Batalkan")
 * agar alurnya sama dengan komponen akuntansi: pelunasan ditarik lebih dulu,
 * baru faktur bisa dibatalkan kalau memang diperlukan.
 */
export function getInvoiceDashboardActionState(status: string): InvoiceDashboardActionState {
  switch (status) {
    case 'PAID':
      return {
        statusLabel: 'Lunas',
        statusTone: 'emerald',
        canSendReminder: false,
        canCancel: false,
        canReopen: true,
      };
    case 'PARTIAL':
      return {
        statusLabel: 'Sebagian',
        statusTone: 'amber',
        canSendReminder: true,
        canCancel: true,
        canReopen: true,
      };
    case 'CANCELLED':
      return {
        statusLabel: 'Dibatalkan',
        statusTone: 'slate',
        canSendReminder: false,
        canCancel: false,
        canReopen: false,
      };
    case 'DRAFT':
      return {
        statusLabel: 'Draft',
        statusTone: 'slate',
        canSendReminder: false,
        canCancel: true,
        canReopen: false,
      };
    case 'OVERDUE':
      return {
        statusLabel: 'Jatuh Tempo',
        statusTone: 'red',
        canSendReminder: true,
        canCancel: true,
        canReopen: false,
      };
    case 'UNPAID':
    default:
      return {
        statusLabel: status || 'Belum Lunas',
        statusTone: 'red',
        canSendReminder: true,
        canCancel: true,
        canReopen: false,
      };
  }
}
