/**
 * Pembayaran sebagian & alokasi dokumen (Fase 3.2) — logika murni, tanpa DB.
 *
 * Sebelumnya satu faktur/kewajiban harus dilunasi penuh dalam satu baris kas.
 * Sekarang satu dokumen boleh menerima beberapa pembayaran, dan satu baris kas
 * boleh dialokasikan ke beberapa dokumen (split payment).
 *
 * Aturan yang dipegang:
 *
 * - `sisa = total - sudah dibayar`, tidak pernah negatif.
 * - Pembayaran melebihi sisa **ditolak** (belum ada akun uang muka pelanggan),
 *   supaya saldo piutang/utang tidak pernah berubah tanda tanpa jurnal khusus.
 * - Status dokumen: `PAID` bila sisa ≈ 0, `PARTIAL` bila sebagian, selain itu
 *   status asal (UNPAID/PENDING) tetap.
 */

/** Toleransi pembulatan rupiah (setengah sen) agar 0,005 tidak dianggap sisa. */
export const SETTLEMENT_EPSILON = 0.005;

export type DocumentStatus = 'UNPAID' | 'PENDING' | 'PARTIAL' | 'PAID';

export interface SettlementPlan {
  ok: true;
  /** Nominal yang benar-benar dialokasikan (dibulatkan 2 desimal). */
  amount: number;
  /** Sisa setelah pembayaran ini. */
  remaining: number;
  /** Total yang sudah dibayar setelah pembayaran ini. */
  newPaid: number;
  /** Status baru dokumen. */
  newStatus: Extract<DocumentStatus, 'PAID' | 'PARTIAL'>;
}

export interface SettlementPlanError {
  ok: false;
  error: string;
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Sisa tagihan/utang. Tidak pernah negatif walau data lama kurang rapi. */
export function computeRemaining(total: number, paidAmount: number): number {
  const total2 = Number.isFinite(total) ? total : 0;
  const paid2 = Number.isFinite(paidAmount) ? paidAmount : 0;
  return round2(Math.max(0, total2 - paid2));
}

/** Status dokumen berdasarkan total & yang sudah dibayar. */
export function statusFor(total: number, paidAmount: number): Extract<DocumentStatus, 'PAID' | 'PARTIAL'> {
  const remaining = computeRemaining(total, paidAmount);
  return remaining <= SETTLEMENT_EPSILON ? 'PAID' : 'PARTIAL';
}

/**
 * Validasi satu pembayaran terhadap sisa dokumen.
 *
 * `label` dipakai untuk pesan error (mis. nomor faktur) supaya staf tahu
 * dokumen mana yang bermasalah.
 */
export function planDocumentSettlement(args: {
  total: number;
  paidAmount: number;
  amount: number;
  label: string;
}): SettlementPlan | SettlementPlanError {
  const total = Number(args.total);
  const paid = Number(args.paidAmount);
  const amount = round2(Number(args.amount));

  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Nominal pembayaran harus lebih besar dari 0.' };
  }

  const remaining = computeRemaining(total, paid);
  if (remaining <= SETTLEMENT_EPSILON) {
    return { ok: false, error: `${args.label} sudah lunas.` };
  }
  if (amount > remaining + SETTLEMENT_EPSILON) {
    return {
      ok: false,
      error: `Nominal melebihi sisa ${args.label} (Rp ${remaining.toLocaleString('id-ID')}).`,
    };
  }

  const newPaid = round2(paid + amount);
  return {
    ok: true,
    amount,
    remaining: computeRemaining(total, newPaid),
    newPaid,
    newStatus: statusFor(total, newPaid),
  };
}

export interface AllocationInput {
  invoiceId?: string | null;
  obligationId?: string | null;
  amount: number;
}

export interface AllocationValidation {
  ok: true;
  total: number;
  hasInvoice: boolean;
  hasObligation: boolean;
}

/**
 * Validasi daftar alokasi satu baris kas.
 *
 * - Setiap alokasi harus tepat satu dokumen (faktur ATAU kewajiban).
 * - Jenis dokumen harus seragam: pemasukan melunasi faktur, pengeluaran
 *   melunasi kewajiban.
 * - Jumlah alokasi HARUS sama dengan nominal baris kas, supaya jurnal
 *   (Dr Kas / Cr Piutang dan sebaliknya) selalu seimbang.
 */
export function validateAllocations(
  allocations: AllocationInput[],
  cashAmount: number,
  cashType: 'INCOME' | 'EXPENSE'
): AllocationValidation | SettlementPlanError {
  if (allocations.length === 0) {
    return { ok: false, error: 'Daftar alokasi tidak boleh kosong.' };
  }

  let total = 0;
  let hasInvoice = false;
  let hasObligation = false;

  for (const allocation of allocations) {
    const hasInv = Boolean(allocation.invoiceId);
    const hasObl = Boolean(allocation.obligationId);
    if (hasInv === hasObl) {
      return { ok: false, error: 'Setiap alokasi harus menunjuk tepat satu faktur atau satu kewajiban.' };
    }
    if (cashType === 'INCOME' && !hasInv) {
      return { ok: false, error: 'Transaksi pemasukan hanya bisa dialokasikan ke faktur.' };
    }
    if (cashType === 'EXPENSE' && !hasObl) {
      return { ok: false, error: 'Transaksi pengeluaran hanya bisa dialokasikan ke kewajiban.' };
    }
    const amount = Number(allocation.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: 'Nominal setiap alokasi harus lebih besar dari 0.' };
    }
    total = round2(total + round2(amount));
    hasInvoice = hasInvoice || hasInv;
    hasObligation = hasObligation || hasObl;
  }

  const cash = round2(Number(cashAmount));
  if (Math.abs(total - cash) > SETTLEMENT_EPSILON) {
    return {
      ok: false,
      error: `Jumlah alokasi (Rp ${total.toLocaleString('id-ID')}) harus sama dengan nominal transaksi (Rp ${cash.toLocaleString('id-ID')}). Lebih/kurang bayar belum didukung.`,
    };
  }

  return { ok: true, total, hasInvoice, hasObligation };
}
