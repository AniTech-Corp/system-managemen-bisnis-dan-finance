/**
 * Safety boundary for natural-language data mutations from brain/chat.
 *
 * The LLM may extract a proposed action, but extraction is not confirmation.
 * This module is intentionally pure so the API route and the three assistants
 * can share one small, testable contract without touching auth or Fatur's lane.
 */

export type DataActionKind = 'RECORD_CASH' | 'UPDATE_PROFILE' | 'CREATE_INVOICE' | 'CREATE_PRODUCT';

export interface DataActionPreview {
  action: DataActionKind;
  title: string;
  description: string;
  confirmationMessage: string;
  actionLabel: string;
}

function safeText(value: unknown, maxLength: number): string {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maxLength) : '-';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function formatRupiah(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? `Rp ${Math.round(amount).toLocaleString('id-ID')}`
    : 'nominal perlu diperiksa';
}

function formatRupiahAllowZero(value: unknown): string {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0
    ? `Rp ${Math.round(amount).toLocaleString('id-ID')}`
    : 'belum diisi';
}

/**
 * Confirmation must come from the user message/body, never from attachment
 * content or an LLM field. Negative wording is excluded to avoid treating
 * "jangan konfirmasi dulu" as consent.
 */
export function hasExplicitDataConfirmation(message: unknown, bodyConfirmed?: unknown): boolean {
  if (bodyConfirmed === true) return true;
  const text = String(message ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!text) return false;
  if (text.includes('[confirmed_data_action]')) return true;
  if (/\b(jangan|tidak|belum|tanpa|butuh|perlu)\s+(?:di-?)?konfirmasi\b/.test(text)) return false;
  return /\b(?:konfirmasi(?:kan)?|saya\s+setuju|eksekusi\s+sekarang|simpan\s+sekarang)\b/.test(text);
}

/**
 * Build a safe, human-readable preview from parser output. The preview is not
 * trusted on the follow-up request; the server reparses the original message
 * before any mutation. That makes this UI card an acknowledgement boundary,
 * not a client-side authorization token.
 */
export function buildDataActionPreview(parsedData: unknown, originalMessage: unknown): DataActionPreview | null {
  const data = asRecord(parsedData);
  if (!data) return null;
  const message = safeText(originalMessage, 8000);
  if (!message || message === '-') return null;

  if (data.action === 'RECORD_CASH' && Array.isArray(data.cashTransactions) && data.cashTransactions.length > 0) {
    const rows = data.cashTransactions;
    const previewRows = rows.slice(0, 4).map((row: unknown, index: number) => {
      const rowRecord = asRecord(row);
      const type = rowRecord?.type === 'INCOME' ? 'Pemasukan' : rowRecord?.type === 'EXPENSE' ? 'Pengeluaran' : 'Tipe perlu diperiksa';
      return `${index + 1}. ${type} — ${formatRupiah(rowRecord?.amount)} — ${safeText(rowRecord?.description || rowRecord?.category, 80)}`;
    });
    const remaining = rows.length > previewRows.length ? `\n... dan ${rows.length - previewRows.length} baris lainnya.` : '';
    return {
      action: 'RECORD_CASH',
      title: `Pratinjau ${rows.length} transaksi Buku Kas`,
      description: `${previewRows.join('\n')}${remaining}\n\nBelum disimpan ke database. Periksa nominal, tipe, dan tanggal historisnya.`,
      confirmationMessage: `${message}\n[CONFIRMED_DATA_ACTION]`,
      actionLabel: 'Konfirmasi & Simpan',
    };
  }

  const profile = asRecord(data.profile);
  if (
    data.action === 'UPDATE_PROFILE' &&
    profile &&
    (profile.companyName || profile.industry || profile.description || profile.targetMarket)
  ) {
    const details = [
      profile.companyName ? `Nama bisnis: ${safeText(profile.companyName, 100)}` : null,
      profile.industry ? `Industri: ${safeText(profile.industry, 100)}` : null,
      profile.targetMarket ? `Target pasar: ${safeText(profile.targetMarket, 120)}` : null,
      profile.description ? `Deskripsi: ${safeText(profile.description, 180)}` : null,
    ].filter(Boolean).join('\n');
    return {
      action: 'UPDATE_PROFILE',
      title: 'Pratinjau pembaruan profil usaha',
      description: `${details}\n\nBelum mengubah profil atau memori workspace.`,
      confirmationMessage: `${message}\n[CONFIRMED_DATA_ACTION]`,
      actionLabel: 'Konfirmasi & Simpan',
    };
  }

  const invoice = asRecord(data.invoice);
  if (data.action === 'CREATE_INVOICE' && invoice?.clientName) {
    const dueDays = Number.isInteger(Number(invoice.dueDateDays)) && Number(invoice.dueDateDays) >= 1
      ? Number(invoice.dueDateDays)
      : 14;
    return {
      action: 'CREATE_INVOICE',
      title: 'Pratinjau penerbitan invoice',
      description: `Klien: ${safeText(invoice.clientName, 140)}\nNominal: ${formatRupiah(invoice.amount)}\nJatuh tempo: ${dueDays} hari\n\nInvoice belum diterbitkan dan belum masuk daftar piutang.`,
      confirmationMessage: `${message}\n[CONFIRMED_DATA_ACTION]`,
      actionLabel: 'Konfirmasi & Terbitkan',
    };
  }

  const product = asRecord(data.product);
  if (data.action === 'CREATE_PRODUCT' && product?.name) {
    const details = [
      `Nama: ${safeText(product.name, 140)}`,
      `SKU: ${product.sku ? safeText(product.sku, 80) : 'opsional — belum diisi'}`,
      `Kategori: ${product.category ? safeText(product.category, 100) : 'belum diisi'}`,
      `Satuan: ${product.unit ? safeText(product.unit, 40) : 'pcs (default)'}`,
      `Harga beli: ${formatRupiahAllowZero(product.costPrice)}`,
      `Harga jual: ${formatRupiahAllowZero(product.sellPrice)}`,
      `Stok minimum: ${formatRupiahAllowZero(product.minStock)}`,
      `Stok awal: ${formatRupiahAllowZero(product.openingStock)}`,
      `Pemasok: ${product.supplierName ? safeText(product.supplierName, 120) : 'belum diisi'}`,
    ].join('\n');

    return {
      action: 'CREATE_PRODUCT',
      title: 'Pratinjau produk baru',
      description: `${details}\n\nBelum disimpan ke database. Periksa nama, harga, satuan, dan jumlah stok awal sebelum konfirmasi.`,
      confirmationMessage: `${message}\n[CONFIRMED_DATA_ACTION]`,
      actionLabel: 'Konfirmasi & Simpan Produk',
    };
  }

  return null;
}
