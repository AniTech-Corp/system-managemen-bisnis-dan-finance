import { NextResponse } from 'next/server';
import type { AuthContext } from '../tenant-guard';
import { accountingForbidden, canAccounting, type AccountingAction } from './rbac';

export function guardAccounting(
  auth: Pick<AuthContext, 'membership'>,
  action: AccountingAction
): NextResponse | null {
  if (!canAccounting(auth, action)) {
    return NextResponse.json(
      { success: false, message: accountingForbidden(action) },
      { status: 403 }
    );
  }
  return null;
}

export function badRequest(message: string) {
  return NextResponse.json({ success: false, message }, { status: 400 });
}

export function notFound(message = 'Data tidak ditemukan.') {
  return NextResponse.json({ success: false, message }, { status: 404 });
}

export function serverError(context: string, err: unknown, fallback: string) {
  console.error(`[accounting:${context}]`, err);
  return NextResponse.json({ success: false, message: fallback }, { status: 500 });
}

/** Serialisasi entri jurnal agar Decimal menjadi string 2 desimal yang stabil. */
export function serializeJournal(entry: any) {
  return {
    ...entry,
    totalDebit: entry.totalDebit?.toFixed?.(2) ?? entry.totalDebit,
    totalCredit: entry.totalCredit?.toFixed?.(2) ?? entry.totalCredit,
    lines: Array.isArray(entry.lines)
      ? entry.lines.map((line: any) => ({
          ...line,
          debit: line.debit?.toFixed?.(2) ?? line.debit,
          credit: line.credit?.toFixed?.(2) ?? line.credit,
          exchangeRate: line.exchangeRate?.toFixed?.(6) ?? line.exchangeRate,
        }))
      : undefined,
  };
}

export function serializeReportValue<T>(value: T): T {
  if (value && typeof value === 'object' && typeof (value as any).toFixed === 'function') {
    return (value as any).toFixed(2) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => serializeReportValue(v)) as unknown as T;
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeReportValue(v);
    }
    return out as T;
  }
  return value;
}
