import { Prisma } from '@prisma/client';

/**
 * Helper uang untuk modul akuntansi.
 *
 * Aturan keras: JANGAN memakai `number` untuk penjumlahan nominal.
 * Semua aritmetika lewat Prisma.Decimal (decimal.js bawaan Prisma), dibulatkan
 * ke 2 desimal dengan ROUND_HALF_UP di batas input.
 */
export type MoneyInput = Prisma.Decimal | number | string | null | undefined;

export const ZERO = new Prisma.Decimal(0);
export const MONEY_SCALE = 2;

/** Konversi nilai apa pun ke Decimal 2 desimal. Melempar error untuk input tidak valid. */
export function toMoney(value: MoneyInput, field = 'nominal'): Prisma.Decimal {
  if (value === null || value === undefined || value === '') return new Prisma.Decimal(0);

  if (value instanceof Prisma.Decimal) {
    return value.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`${field} tidak valid.`);
    // Float legacy (CashTransaction.amount) dikonversi lewat string 2 desimal
    // supaya artefak biner seperti 0.1 + 0.2 tidak ikut terbawa.
    return new Prisma.Decimal(value.toFixed(MONEY_SCALE));
  }

  const parsed = new Prisma.Decimal(String(value).replace(/,/g, '.'));
  if (!parsed.isFinite()) throw new Error(`${field} tidak valid.`);
  return parsed.toDecimalPlaces(MONEY_SCALE, Prisma.Decimal.ROUND_HALF_UP);
}

/** Konversi Float legacy ke Decimal tanpa melempar untuk nilai aneh (fallback 0). */
export function fromLegacyFloat(value: number | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined || !Number.isFinite(value)) return new Prisma.Decimal(0);
  return new Prisma.Decimal(value.toFixed(MONEY_SCALE));
}

export function sumMoney(values: MoneyInput[]): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>((acc, v) => acc.plus(toMoney(v)), new Prisma.Decimal(0));
}

export function isZero(value: MoneyInput): boolean {
  return toMoney(value).isZero();
}

export function isPositive(value: MoneyInput): boolean {
  return toMoney(value).greaterThan(0);
}

/** Format Rupiah untuk keperluan server-side (log / export). UI memakai formatter sendiri. */
export function formatIDR(value: MoneyInput): string {
  const n = toMoney(value);
  const negative = n.isNegative();
  const abs = n.abs().toFixed(0);
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negative ? '-' : ''}Rp ${grouped}`;
}

/** Serialisasi Decimal ke string 2 desimal agar aman dikirim lewat JSON. */
export function moneyToString(value: MoneyInput): string {
  return toMoney(value).toFixed(MONEY_SCALE);
}
