'use client';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!res.ok) {
    throw new ApiError(payload?.message || `Permintaan gagal (${res.status}).`, res.status);
  }
  return payload as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
  return parse<T>(res);
}

export async function apiSend<T>(url: string, method: 'POST' | 'PATCH' | 'PUT' | 'DELETE', body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res);
}

const idFormatter = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });

/** Format Rupiah. Nilai negatif ditampilkan dalam tanda kurung agar rapi di kolom laporan. */
export function formatMoney(value: string | number | null | undefined, options: { parentheses?: boolean } = {}): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  if (!Number.isFinite(n)) return 'Rp 0';
  const abs = idFormatter.format(Math.abs(n));
  if (n < 0 && options.parentheses !== false) return `(Rp ${abs})`;
  return `${n < 0 ? '-' : ''}Rp ${abs}`;
}

export function formatNumber(value: string | number | null | undefined): string {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? idFormatter.format(n) : '0';
}

export function formatPercent(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(2)}%`;
}

export const MONTH_LABELS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function currentPeriodKey(): string {
  const now = new Date();
  const jakarta = new Date(now.getTime() + 7 * 3600 * 1000);
  return `${jakarta.getUTCFullYear()}-${String(jakarta.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function periodLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return `${MONTH_LABELS[(month || 1) - 1]} ${year}`;
}
