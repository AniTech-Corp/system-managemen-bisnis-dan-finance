import { NextRequest, NextResponse } from 'next/server';
import {
  REFRESH_TOKEN_COOKIE,
  revokeRefreshToken,
  clearAuthCookies,
} from '@/lib/session';

/**
 * POST /auth/logout — mencabut refresh token di DB & menghapus cookie auth.
 */
export async function POST(req: NextRequest) {
  try {
    const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value || null;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }

    const response = NextResponse.json({ success: true, message: 'Berhasil keluar.' });
    clearAuthCookies(response);

    return response;
  } catch (err: any) {
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}
