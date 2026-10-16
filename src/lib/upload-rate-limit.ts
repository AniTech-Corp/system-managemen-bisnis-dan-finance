import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate-limit ringan khusus jalur UPLOAD/EKSTRAKSI (workspace-files, documents/extract-text,
 * documents/analyze). 8 Sep 2026, temuan verifikator TINGGI: multi-upload 12 file + zip
 * per-entri + OCR berbayar tanpa pagar laju.
 *
 * Kenapa TIDAK memakai src/lib/rate-limiter.ts (milik Fatur, zona merah): modul itu memasang
 * `setInterval` pembersih tanpa `unref()`, sehingga SETIAP route yang meng-import-nya membuat
 * proses `node --test` tidak pernah selesai (terbukti: suite 591 test menggantung 15 menit
 * setelah import ditambahkan). Di sini pembersihan dilakukan saat akses (lazy), tanpa timer.
 * In-memory per proses (PM2 1 instance) -- bukan batas billing, cukup untuk menahan loop liar.
 */
const store = new Map<string, { count: number; resetTime: number }>();
const MAX_KEYS = 5000;

export function checkUploadRateLimit(
  req: NextRequest,
  options: { max?: number; windowMs?: number; keyPrefix?: string } = {}
): { allowed: boolean; remaining: number; resetTime: number } {
  const windowMs = options.windowMs || 60_000;
  const max = options.max || 40;
  const keyPrefix = options.keyPrefix || 'upload';
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const cookie = req.cookies.get('klir_token')?.value;
  const auth = req.headers.get('authorization') || '';
  // Kunci per identitas (potongan token) supaya user di balik NAT yang sama tidak saling mengunci.
  const ident = cookie ? cookie.slice(-24) : auth.length > 20 ? auth.slice(-20) : ip;
  const key = `${keyPrefix}|${ident}`;
  const now = Date.now();

  if (store.size > MAX_KEYS) for (const [k, v] of store) if (v.resetTime <= now) store.delete(k);
  const rec = store.get(key);
  if (!rec || now > rec.resetTime) {
    store.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true, remaining: max - 1, resetTime: now + windowMs };
  }
  if (rec.count >= max) return { allowed: false, remaining: 0, resetTime: rec.resetTime };
  rec.count += 1;
  return { allowed: true, remaining: max - rec.count, resetTime: rec.resetTime };
}

export function uploadRateLimitResponse(resetTime: number): NextResponse {
  const retryAfterSec = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
  return NextResponse.json(
    { success: false, error: 'TOO_MANY_REQUESTS', message: `Terlalu banyak unggahan dalam semenit. Coba lagi ${retryAfterSec} detik lagi.` },
    { status: 429, headers: { 'Retry-After': String(retryAfterSec) } }
  );
}

/** Test-only: kosongkan state. */
export function resetUploadRateLimit() { store.clear(); }
