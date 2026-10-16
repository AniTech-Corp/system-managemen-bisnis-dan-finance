import { NextRequest, NextResponse } from 'next/server';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

// Bersihkan memory store setiap 5 menit
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (now > value.resetTime) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  windowMs?: number; // default 60.000 ms (1 menit)
  max?: number; // default 60 request per window
  keyPrefix?: string;
}

/**
 * Rate Limiter Helper untuk Next.js Route Handlers
 */
export function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {}
): { allowed: boolean; remaining: number; resetTime: number } {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 60;
  const keyPrefix = options.keyPrefix || 'rl_';

  // Identifikasi client dari IP atau Authorization header
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const authHeader = req.headers.get('authorization') || '';
  const identifier = authHeader.length > 20 ? authHeader.slice(-20) : ip;
  const key = `${keyPrefix}${identifier}`;

  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetTime) {
    memoryStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return { allowed: true, remaining: max - 1, resetTime: now + windowMs };
  }

  if (record.count >= max) {
    return { allowed: false, remaining: 0, resetTime: record.resetTime };
  }

  record.count += 1;
  return { allowed: true, remaining: max - record.count, resetTime: record.resetTime };
}

/**
 * Helper: Cepat mengembalikan respons 429 Too Many Requests jika rate limit terlampaui
 */
export function rateLimitResponse(resetTime: number): NextResponse {
  const retryAfterSec = Math.ceil((resetTime - Date.now()) / 1000);
  return NextResponse.json(
    {
      error: 'TOO_MANY_REQUESTS',
      message: `Terlalu banyak permintaan. Silakan tunggu ${retryAfterSec} detik lagi.`,
      retryAfterSeconds: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSec),
      },
    }
  );
}
