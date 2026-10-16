import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';

export const ACCESS_TOKEN_COOKIE = 'klir_token';
export const REFRESH_TOKEN_COOKIE = 'klir_refresh_token';
export const ACCESS_TOKEN_MAX_AGE = 7 * 24 * 3600; // 7 hari
export const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 3600; // 30 hari

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function storeRefreshToken(userId: string, token: string) {
  const tokenHash = hashRefreshToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
}

export async function verifyRefreshToken(token: string): Promise<string | null> {
  try {
    const tokenHash = hashRefreshToken(token);
    const record = await prisma.refreshToken.findFirst({
      where: { tokenHash, isRevoked: false, expiresAt: { gt: new Date() } },
    });
    return record ? record.userId : null;
  } catch (err) {
    return null;
  }
}

export async function revokeRefreshToken(token: string) {
  try {
    const tokenHash = hashRefreshToken(token);
    await prisma.refreshToken.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
  } catch (err) {
    console.warn('[Session] Gagal mencabut refresh token:', err);
  }
}

export function setAuthCookies(res: NextResponse, accessToken: string, refreshToken: string) {
  const secure = process.env.HTTPS_ONLY === 'true';
  res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function clearAuthCookies(res: NextResponse) {
  res.cookies.set(ACCESS_TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}
